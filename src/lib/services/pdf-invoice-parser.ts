/**
 * PDF Invoice Parser Service
 * Extracts invoice data from PDF files using text parsing and pattern recognition
 */

export interface ExtractedInvoiceData {
  invoiceNumber?: string
  customerName?: string
  customerEmail?: string
  amount?: number
  vatAmount?: number
  totalAmount?: number
  currency?: string
  dueDate?: string
  invoiceDate?: string
  description?: string
  trn?: string
  confidence: number // 0-100 confidence score
  rawText: string
  s3Key?: string // S3 key where PDF is stored
  s3Bucket?: string // S3 bucket where PDF is stored
}

export class PDFInvoiceParser {
  private static readonly INVOICE_NUMBER_PATTERNS = [
    // Most specific patterns first - exact format at start
    /^([A-Z]\d{8})\s/m, // Pattern for V01250857 format at start with space after
    /^([A-Z]{2,4}\d{6,10})\s/m, // UAE format like INV2024001, ABC123456789 at start with space

    // Invoice number with label
    /invoice\s*(?:no|number|#)?\s*:?\s*([A-Z]\d{8})/i, // Invoice number V01250857
    /invoice\s*(?:no|number|#)?\s*:?\s*([A-Z]{1,4}[-\s]?\d{4,10})/i, // INV-2024-001, INV 20240001
    /فاتورة\s*رقم\s*:?\s*([A-Z0-9\-\/\s]+)/i, // Arabic "Invoice Number"
    /رقم\s*الفاتورة\s*:?\s*([A-Z0-9\-\/\s]+)/i, // Arabic "Invoice Number" (alt)

    // International formats
    /^([A-Z]\d{8})$/m, // Pattern for V01250703 format on its own line
    /([A-Z]\d{8})\s*\n/m, // Pattern for V01250703 followed by newline
    /^(\d{8,})$/m, // Pattern for German format like 123100401 on its own line
    /rechnung\s*(?:nr|nummer|#)?\s*:?\s*([A-Z0-9\-\/]+)/i, // German
    /facture\s*(?:no|numero|#)?\s*:?\s*([A-Z0-9\-\/]+)/i, // French
    /factura\s*(?:no|numero|#)?\s*:?\s*([A-Z0-9\-\/]+)/i, // Spanish

    // Generic patterns (lower priority)
    /inv\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-\/\s]+)/i,
    /ref\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-\/\s]+)/i,
    /bill\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-\/\s]+)/i,
  ]

  private static readonly AMOUNT_PATTERNS = [
    // Total patterns (highest priority) - must come before generic amount patterns
    /total\s*(?:excl\.?\s*vat|incl\.?\s*vat|amount)?\s*:?\s*(?:EUR|AED|USD)?\s*([\d.,]+)/i,
    /totals?\s*:?\s*(?:EUR|AED|USD)?\s*([\d.,]+)/i,
    /grand\s*total\s*:?\s*(?:EUR|AED|USD)?\s*([\d.,]+)/i,
    /amount\s*due\s*:?\s*(?:EUR|AED|USD)?\s*([\d.,]+)/i,
    /balance\s*due\s*:?\s*(?:EUR|AED|USD)?\s*([\d.,]+)/i,

    // Currency specific patterns
    /AED\s*:?\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*AED/i,
    /EUR\s*:?\s*([\d.,]+)/i,
    /([\d.,]+)\s*EUR/i,

    // Generic amount patterns
    /amount\s*:?\s*(?:AED|USD|EUR)?\s*([\d,]+\.?\d*)/i,
    /المبلغ\s*:?\s*([\d,]+\.?\d*)/i, // Arabic "Amount"
    /الإجمالي\s*:?\s*([\d,]+\.?\d*)/i, // Arabic "Total"

    // Pattern matching numbers with currency symbols
    /(?:€|£|\$|₹)\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*(?:€|£|\$|₹)/,
  ]

  private static readonly EMAIL_PATTERNS = [
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  ]

  private static readonly DATE_PATTERNS = [
    // UAE date formats
    /due\s*(?:date|on)?\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    /(\d{1,2}-\d{1,2}-\d{4})/g,
    /(\d{4}-\d{1,2}-\d{1,2})/g,
  ]

  private static readonly TRN_PATTERNS = [
    // UAE TRN format (15 digits)
    /TRN\s*:?\s*(\d{15})/i,
    /رقم\s*التسجيل\s*الضريبي\s*:?\s*(\d{15})/i, // Arabic TRN
    /tax\s*registration\s*(?:number|no)?\s*:?\s*(\d{15})/i,
    // European VAT numbers (e.g., NL866078952B01)
    /VAT\s*number\s*:?\s*([A-Z]{2}[A-Z0-9]{8,12})/i,
    /BTW\s*nummer\s*:?\s*([A-Z]{2}[A-Z0-9]{8,12})/i, // Dutch
  ]

  /**
   * Extract text from PDF using pdf-parse library (more reliable)
   */
  private static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      // Use pdf2json which is designed for text extraction
      const PDFParser = (await import('pdf2json')).default

      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser()

        pdfParser.on('pdfParser_dataError', (errData: any) => {
          console.error('PDF parsing error:', errData.parserError)
          resolve('') // Return empty string instead of failing
        })

        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            let extractedText = ''

            // Debug: Log PDF structure
            console.log('PDF data structure:', {
              hasPages: !!pdfData.Pages,
              pagesType: Array.isArray(pdfData.Pages),
              pageCount: pdfData.Pages?.length || 0
            })

            // Extract text from all pages
            if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
              console.log(`Processing ${pdfData.Pages.length} pages`)

              for (const page of pdfData.Pages) {
                if (page.Texts && Array.isArray(page.Texts)) {
                  console.log(`Page has ${page.Texts.length} text objects`)

                  for (const textObj of page.Texts) {
                    if (textObj.R && Array.isArray(textObj.R)) {
                      for (const textRun of textObj.R) {
                        if (textRun.T) {
                          try {
                            // Decode URI component and add to text
                            const decodedText = decodeURIComponent(textRun.T)
                            extractedText += decodedText + ' '
                          } catch (decodeError) {
                            // If decoding fails, use original text
                            console.warn('Failed to decode text:', textRun.T)
                            extractedText += textRun.T + ' '
                          }
                        }
                      }
                    }
                  }
                  extractedText += '\n' // New line after each text object
                }
              }
            } else {
              console.error('No valid Pages array in PDF data')
            }

            console.log('Final extracted text length:', extractedText.length)
            console.log('First 200 chars:', extractedText.substring(0, 200))

            resolve(extractedText.trim())
          } catch (error) {
            console.error('Error processing PDF data:', error)
            resolve('')
          }
        })

        // Parse the buffer
        pdfParser.parseBuffer(pdfBuffer)
      })

    } catch (error) {
      console.error('PDF text extraction failed:', error)
      // If extraction fails, return empty string to allow processing to continue
      return ''
    }
  }

  /**
   * Extract invoice number from text
   */
  private static extractInvoiceNumber(text: string): string | undefined {
    for (const pattern of this.INVOICE_NUMBER_PATTERNS) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const invoiceNumber = match[1].trim()
        // Filter out common false positives
        if (invoiceNumber.length >= 3 && invoiceNumber.length <= 50) {
          return invoiceNumber
        }
      }
    }
    return undefined
  }

  /**
   * Extract monetary amounts from text
   */
  private static extractAmounts(text: string): {
    amount?: number
    currency?: string
    vatAmount?: number
    totalAmount?: number
  } {
    const amounts: number[] = []
    let currency = 'AED' // Default to AED for UAE
    let vatAmount: number | undefined
    let totalAmount: number | undefined

    // Detect currency from text
    if (/EUR|€/i.test(text)) {
      currency = 'EUR'
    } else if (/USD|\$/i.test(text)) {
      currency = 'USD'
    } else if (/AED/i.test(text)) {
      currency = 'AED'
    }

    // Extract VAT amount
    // Look for "X.XX EUR" or "X% VAT on Y.YY" patterns
    const vatAmountMatch = text.match(/VAT\s*(?:EUR|AED|USD)?\s*([\d.,]+)\s*(?:EUR|AED|USD)?/i)
    const vatPercentMatch = text.match(/([\d.,]+)%\s*VAT\s*on\s*([\d.,]+)/i)

    if (vatPercentMatch && vatPercentMatch[1] && vatPercentMatch[2]) {
      // Calculate VAT from percentage and base amount
      const vatPercent = this.parseNumber(vatPercentMatch[1])
      const baseAmount = this.parseNumber(vatPercentMatch[2])
      vatAmount = (baseAmount * vatPercent) / 100
    } else if (vatAmountMatch && vatAmountMatch[1]) {
      vatAmount = this.parseNumber(vatAmountMatch[1])
    }

    for (const pattern of this.AMOUNT_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))
      for (const match of matches) {
        if (match[1]) {
          const amount = this.parseNumber(match[1])
          if (!isNaN(amount) && amount > 0) {
            amounts.push(amount)
          }
        }
      }
    }

    // The largest amount is likely the total
    if (amounts.length > 0) {
      totalAmount = Math.max(...amounts)
      // If we have VAT, calculate subtotal
      if (vatAmount && vatAmount < totalAmount) {
        const amount = totalAmount - vatAmount
        return { amount, currency, vatAmount, totalAmount }
      }
    }

    return {
      amount: totalAmount,
      currency,
      vatAmount,
      totalAmount
    }
  }

  /**
   * Parse number from string handling European and US formats
   */
  private static parseNumber(numStr: string): number {
    // Handle both comma and period as decimal separators
    // European format: 1.534,00 or 1 534,00
    // US format: 1,534.00

    // If contains both . and , determine which is decimal separator
    if (numStr.includes(',') && numStr.includes('.')) {
      // If comma comes after period, comma is decimal (European)
      if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else {
        // Period is decimal (US format)
        numStr = numStr.replace(/,/g, '')
      }
    } else if (numStr.includes(',')) {
      // Only comma - could be thousands or decimal
      // If 2 digits after comma, it's decimal (European)
      if (/,\d{2}$/.test(numStr)) {
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else {
        // Otherwise it's thousands separator
        numStr = numStr.replace(/,/g, '')
      }
    }
    // If only period, keep as is (decimal separator)

    return parseFloat(numStr)
  }

  /**
   * Extract email addresses from text
   */
  private static extractEmails(text: string): string[] {
    const emails: string[] = []
    for (const pattern of this.EMAIL_PATTERNS) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) {
          emails.push(match[1].toLowerCase())
        }
      }
    }
    return [...new Set(emails)] // Remove duplicates
  }

  /**
   * Extract customer name from text
   * Customer appears between sender's email and "Invoice number" keywords
   */
  private static extractCustomerName(text: string): string | undefined {
    // Look for text between email address and "Invoice number"
    // Pattern: email@domain.com CUSTOMER NAME Invoice number
    const pattern = /@[a-z0-9.-]+\.[a-z]{2,}\s+(.+?)\s+Invoice\s+number/i
    const match = text.match(pattern)

    if (match && match[1]) {
      let name = match[1].trim()

      // Remove common noise words and clean up
      name = name.replace(/\s+(Invoice|Date|Number|Debtor|Total|Amount|Floor|Street|Letter|Box)\b.*$/i, '')

      // Take only the first line if multiple lines captured
      const lines = name.split(/\s{2,}|\n/)
      name = lines[0].trim()

      // Must be at least 3 chars and not look like an invoice number or date
      if (name.length >= 3 && name.length <= 100 &&
          !/^[A-Z]\d{8}/.test(name) &&
          !/\d{2}[-\/]\d{2}[-\/]\d{4}/.test(name)) {
        return name
      }
    }

    return undefined
  }

  /**
   * Extract dates from text - returns both invoice date and due date
   */
  private static extractDates(text: string): { invoiceDate?: string; dueDate?: string } {
    const dates: string[] = []
    let invoiceDate: string | undefined
    let dueDate: string | undefined

    // Try to find invoice date specifically
    const invoiceDateMatch = text.match(/invoice\s*date\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i) ||
                             text.match(/date[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i)
    if (invoiceDateMatch) {
      invoiceDate = invoiceDateMatch[1]
    }

    // Try to find due date explicitly stated
    const dueDateMatch = text.match(/due\s*(?:date|on)?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i)
    if (dueDateMatch) {
      dueDate = dueDateMatch[1]
    }

    // If no explicit due date, try to calculate from "Payment within X days"
    if (!dueDate && invoiceDate) {
      const paymentTermsMatch = text.match(/payment\s+within\s+(\d+)\s+days/i)
      if (paymentTermsMatch) {
        const days = parseInt(paymentTermsMatch[1])
        try {
          // Parse invoice date - handle both DD-MM-YYYY and MM-DD-YYYY formats
          const parts = invoiceDate.split(/[-\/]/).map(Number)
          let day: number, month: number, year: number

          // Determine format: if middle number > 12, it's DD-MM-YYYY, otherwise assume MM-DD-YYYY
          // Actually, Pop Trading uses MM-DD-YYYY format (American)
          if (parts[0] > 12) {
            // DD-MM-YYYY format
            [day, month, year] = parts
          } else if (parts[1] > 12) {
            // MM-DD-YYYY format (American)
            [month, day, year] = parts
          } else {
            // Ambiguous - assume MM-DD-YYYY (American format common in invoices)
            [month, day, year] = parts
          }

          const date = new Date(year, month - 1, day)
          date.setDate(date.getDate() + days)

          // Format as MM-DD-YYYY to match invoice date format
          const separator = invoiceDate.includes('-') ? '-' : '/'
          dueDate = `${String(date.getMonth() + 1).padStart(2, '0')}${separator}${String(date.getDate()).padStart(2, '0')}${separator}${date.getFullYear()}`
        } catch (e) {
          // If parsing fails, leave dueDate undefined
        }
      }
    }

    // If still no dates, extract all dates as fallback
    if (!invoiceDate && !dueDate) {
      for (const pattern of this.DATE_PATTERNS) {
        const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
        const matches = text.matchAll(new RegExp(pattern.source, flags))
        for (const match of matches) {
          if (match[1]) {
            dates.push(match[1])
          }
        }
      }

      // Use first date as invoice date, second as due date if available
      const uniqueDates = [...new Set(dates)]
      return {
        invoiceDate: uniqueDates[0],
        dueDate: uniqueDates[1] || uniqueDates[0]
      }
    }

    return { invoiceDate, dueDate }
  }

  /**
   * Extract description/items from invoice
   */
  private static extractDescription(text: string): string | undefined {
    // Try to extract line items or description section
    const descriptionMatch = text.match(/Description[:\s]+([^\n]+(?:\n(?!Total|Payment|IBAN)[^\n]+)*)/i)
    if (descriptionMatch && descriptionMatch[1]) {
      // Clean up and limit length
      const description = descriptionMatch[1].trim().substring(0, 500)
      return description
    }

    // Fallback: extract first meaningful text chunk
    const lines = text.split('\n').filter(line => line.trim().length > 20)
    if (lines.length > 2) {
      return lines.slice(2, 5).join(' ').substring(0, 200)
    }

    return undefined
  }

  /**
   * Extract TRN (Tax Registration Number) from text
   */
  private static extractTRN(text: string): string | undefined {
    for (const pattern of this.TRN_PATTERNS) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return undefined
  }

  /**
   * Calculate confidence score based on extracted data
   */
  private static calculateConfidence(data: Partial<ExtractedInvoiceData>): number {
    let score = 0

    if (data.invoiceNumber) score += 25
    if (data.customerName) score += 20
    if (data.customerEmail) score += 15
    if (data.amount && data.amount > 0) score += 20
    if (data.totalAmount && data.totalAmount > 0) score += 5
    if (data.currency) score += 5
    if (data.invoiceDate) score += 5
    if (data.dueDate) score += 5
    if (data.trn) score += 5

    return Math.min(score, 100)
  }

  /**
   * Parse PDF buffer and extract invoice data
   */
  public static async parseInvoicePDF(pdfBuffer: Buffer): Promise<ExtractedInvoiceData> {
    try {
      // Validate input
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Invalid PDF buffer provided')
      }

      // Extract text from PDF with timeout
      let timeoutId: NodeJS.Timeout
      const parseTimeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('PDF parsing timeout')), 30000) // 30 second timeout
      })

      const pdfParsePromise = this.extractTextFromPDF(pdfBuffer)

      let text: string
      try {
        text = await Promise.race([pdfParsePromise, parseTimeout])
      } finally {
        clearTimeout(timeoutId!)
      }

      console.log('Extracted text length:', text.length)

      // If no text was extracted, return minimal data
      if (!text || text.trim().length === 0) {
        return {
          confidence: 0,
          rawText: '',
          currency: 'AED' // Default currency
        }
      }

      // Extract all data fields
      const invoiceNumber = this.extractInvoiceNumber(text)
      const { amount, currency, vatAmount, totalAmount } = this.extractAmounts(text)
      const customerName = this.extractCustomerName(text)
      const emails = this.extractEmails(text)
      const { invoiceDate, dueDate } = this.extractDates(text)
      const trn = this.extractTRN(text)
      const description = this.extractDescription(text)

      // Build result object
      const extractedData: ExtractedInvoiceData = {
        invoiceNumber,
        customerName,
        customerEmail: emails[0], // Take first email found
        amount,
        vatAmount,
        totalAmount,
        currency: currency || 'AED',
        invoiceDate,
        dueDate,
        description,
        trn,
        confidence: 0,
        rawText: text.substring(0, 5000) // Limit raw text to 5000 chars
      }

      // Calculate confidence score
      extractedData.confidence = this.calculateConfidence(extractedData)

      console.log('Extracted invoice data:', {
        invoiceNumber: extractedData.invoiceNumber,
        customerName: extractedData.customerName,
        customerEmail: extractedData.customerEmail,
        amount: extractedData.amount,
        vatAmount: extractedData.vatAmount,
        totalAmount: extractedData.totalAmount,
        currency: extractedData.currency,
        invoiceDate: extractedData.invoiceDate,
        dueDate: extractedData.dueDate,
        description: extractedData.description?.substring(0, 100),
        trn: extractedData.trn,
        confidence: extractedData.confidence
      })

      return extractedData

    } catch (error) {
      console.error('PDF parsing error:', error)

      // Return user-friendly error information
      if (error instanceof Error) {
        if (error.message.includes('password')) {
          throw new Error('PDF is password protected and cannot be parsed')
        } else {
          throw new Error(`Failed to parse PDF invoice: ${error.message}`)
        }
      }

      throw new Error('Failed to parse PDF invoice')
    }
  }

  /**
   * Validate extracted data for completeness
   */
  public static validateExtractedData(data: ExtractedInvoiceData): {
    isValid: boolean
    missingFields: string[]
    suggestions: string[]
  } {
    const missingFields: string[] = []
    const suggestions: string[] = []

    if (!data.invoiceNumber) {
      missingFields.push('Invoice Number')
      suggestions.push('Ensure the PDF contains a clear invoice number or reference')
    }

    if (!data.amount || data.amount <= 0) {
      missingFields.push('Amount')
      suggestions.push('Check that the PDF contains monetary amounts in a recognizable format')
    }

    if (!data.customerEmail) {
      missingFields.push('Customer Email')
      suggestions.push('Add customer email address to the PDF for automatic processing')
    }

    const isValid = missingFields.length === 0 && data.confidence >= 50

    return {
      isValid,
      missingFields,
      suggestions
    }
  }
}