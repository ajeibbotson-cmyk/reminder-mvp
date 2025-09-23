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
}

export class PDFInvoiceParser {
  private static readonly INVOICE_NUMBER_PATTERNS = [
    // UAE specific patterns (most specific first)
    /^([A-Z]{2,4}\d{6,10})$/m, // UAE format like INV2024001, ABC123456789
    /invoice\s*(?:no|number|#)?\s*:?\s*([A-Z]{1,4}[-\s]?\d{4,10})/i, // INV-2024-001, INV 20240001
    /فاتورة\s*رقم\s*:?\s*([A-Z0-9\-\/\s]+)/i, // Arabic "Invoice Number"
    /رقم\s*الفاتورة\s*:?\s*([A-Z0-9\-\/\s]+)/i, // Arabic "Invoice Number" (alt)

    // International formats
    /^([A-Z]\d{8})$/m, // Pattern for V01250703 format at start of line
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
    // UAE AED patterns
    /AED\s*:?\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*AED/i,

    // Generic currency patterns
    /total\s*:?\s*(?:AED|USD|EUR)?\s*([\d,]+\.?\d*)/i,
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
  ]

  /**
   * Extract text from PDF using pdf2json library
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

            // Extract text from all pages
            if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
              for (const page of pdfData.Pages) {
                if (page.Texts && Array.isArray(page.Texts)) {
                  for (const textObj of page.Texts) {
                    if (textObj.R && Array.isArray(textObj.R)) {
                      for (const textRun of textObj.R) {
                        if (textRun.T) {
                          // Decode URI component and add to text
                          const decodedText = decodeURIComponent(textRun.T)
                          extractedText += decodedText + ' '
                        }
                      }
                    }
                  }
                  extractedText += '\n' // Add newline after each page
                }
              }
            }

            resolve(extractedText.trim())
          } catch (processingError) {
            console.error('Error processing PDF data:', processingError)
            resolve('') // Return empty string on processing error
          }
        })

        // Parse the PDF buffer
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
  private static extractAmounts(text: string): { amount?: number; currency?: string } {
    const amounts: number[] = []
    let currency = 'AED' // Default to AED for UAE

    for (const pattern of this.AMOUNT_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))
      for (const match of matches) {
        if (match[1]) {
          const numStr = match[1].replace(/,/g, '')
          const amount = parseFloat(numStr)
          if (!isNaN(amount) && amount > 0) {
            amounts.push(amount)
          }
        }
      }
    }

    // Return the largest amount found (likely to be the total)
    const amount = amounts.length > 0 ? Math.max(...amounts) : undefined

    return { amount, currency }
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
   * Extract dates from text
   */
  private static extractDates(text: string): string[] {
    const dates: string[] = []
    for (const pattern of this.DATE_PATTERNS) {
      // Ensure global flag is set without duplicating
      const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
      const matches = text.matchAll(new RegExp(pattern.source, flags))
      for (const match of matches) {
        if (match[1]) {
          dates.push(match[1])
        }
      }
    }
    return [...new Set(dates)]
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

    if (data.invoiceNumber) score += 30
    if (data.amount && data.amount > 0) score += 25
    if (data.customerEmail) score += 20
    if (data.currency) score += 10
    if (data.dueDate) score += 10
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
      const { amount, currency } = this.extractAmounts(text)
      const emails = this.extractEmails(text)
      const dates = this.extractDates(text)
      const trn = this.extractTRN(text)

      // Build result object
      const extractedData: ExtractedInvoiceData = {
        invoiceNumber,
        customerEmail: emails[0], // Take first email found
        amount,
        currency: currency || 'AED',
        dueDate: dates[0], // Take first date found
        trn,
        confidence: 0,
        rawText: text.substring(0, 5000) // Limit raw text to 5000 chars
      }

      // Calculate confidence score
      extractedData.confidence = this.calculateConfidence(extractedData)

      console.log('Extracted invoice data:', {
        invoiceNumber: extractedData.invoiceNumber,
        amount: extractedData.amount,
        currency: extractedData.currency,
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