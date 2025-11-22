/**
 * AWS Textract-based PDF Invoice Parser
 * Uses AWS Textract for reliable text extraction from PDF invoices
 */

import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract'

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
  confidence: number
  rawText: string
}

export class TextractInvoiceParser {
  private static textractClient = new TextractClient({
    region: process.env.AWS_TEXTRACT_REGION || process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })

  /**
   * Extract text from PDF using AWS Textract
   */
  private static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      console.log('Using AWS Textract for PDF extraction...')
      console.log('PDF buffer size:', pdfBuffer.length)

      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: pdfBuffer,
        },
      })

      const response = await this.textractClient.send(command)
      
      // Combine all detected text blocks
      const text = response.Blocks
        ?.filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .join(' ') || ''

      console.log('Textract extracted text length:', text.length)
      console.log('First 200 chars:', text.substring(0, 200))

      return text
    } catch (error) {
      console.error('Textract extraction failed:', error)
      throw new Error(`AWS Textract extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract invoice number - supports multiple formats:
   * - Pop Trading: V01250724
   * - UAE standard: INV-004935, INV004935
   * - Generic: Invoice Number followed by alphanumeric
   */
  private static extractInvoiceNumber(text: string): string | undefined {
    const patterns = [
      /\b(V\d{8})\b/,  // V01250724 format (Pop Trading)
      /invoice\s*(?:no|number|#)?\s*:?\s*(V\d{8})/i,
      /Invoice\s+Number\s+(INV[-]?\d+)/i,  // INV-004935 or INV004935
      /\b(INV[-]?\d{4,})\b/i,  // Standalone INV-XXXXX
      /invoice\s*(?:no|number|#)?\s*:?\s*([A-Z]{2,4}[-]?\d{4,})/i,  // Generic invoice number
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return undefined
  }

  /**
   * Extract customer name - multiple formats:
   * - Pop Trading: email@domain.com CUSTOMER NAME Invoice number
   * - UAE format: Customer Details followed by company name
   */
  private static extractCustomerName(text: string): string | undefined {
    // Try UAE format first: "Customer Details" followed by company name
    const uaePatterns = [
      /Customer\s+Details\s+([A-Z][A-Z0-9\s.,&'-]+(?:L\.?L\.?C\.?|LLC|LTD|INC|CORP|FZE|FZC|FZCO)?)/i,
      /Bill\s+To\s*:?\s*([A-Z][A-Z0-9\s.,&'-]+(?:L\.?L\.?C\.?|LLC|LTD)?)/i,
      /Customer\s*:?\s*([A-Z][A-Z0-9\s.,&'-]+(?:L\.?L\.?C\.?|LLC|LTD)?)/i,
    ]

    for (const pattern of uaePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        let name = match[1].trim()
        // Clean up - stop at newline markers or addresses
        name = name.split(/\s{2,}|Honey|P\.?O\.?\s*Box|\d{3,}/)[0].trim()
        if (name.length >= 3 && name.length <= 100) {
          return name
        }
      }
    }

    // Pop Trading format: email@domain.com CUSTOMER NAME Invoice number
    const popPattern = /@[a-z0-9.-]+\.[a-z]{2,}\s+(.+?)\s+Invoice\s+number/i
    const popMatch = text.match(popPattern)

    if (popMatch && popMatch[1]) {
      let name = popMatch[1].trim()
      name = name.split(/\s{2,}/)[0]
      if (name.length >= 3 && name.length <= 100 &&
          !/\d{2}[-\/]\d{2}/.test(name)) {
        return name
      }
    }
    return undefined
  }

  /**
   * Extract email addresses
   */
  private static extractEmails(text: string): string[] {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    const emails = text.match(emailPattern) || []
    return [...new Set(emails.map(e => e.toLowerCase()))]
  }

  /**
   * Extract amounts with VAT calculation - supports EUR and AED formats
   */
  private static extractAmounts(text: string): {
    amount?: number
    currency?: string
    vatAmount?: number
    totalAmount?: number
  } {
    let currency = 'EUR'

    // Detect currency - prioritize AED for UAE invoices
    if (/AED|Amount\s+Due\s+AED|Invoice\s+Total\s+AED/i.test(text)) currency = 'AED'
    else if (/EUR|€/i.test(text)) currency = 'EUR'
    else if (/USD|\$/i.test(text)) currency = 'USD'

    let totalAmount: number | undefined
    let vatAmount: number | undefined

    // UAE format: "Amount Due AED 149,494.35" or "Invoice Total AED 149,494.35"
    const uaeAmountPatterns = [
      /Amount\s+Due\s+AED\s*([\d,]+\.?\d*)/i,
      /Invoice\s+Total\s+AED\s*([\d,]+\.?\d*)/i,
      /Total\s+(?:Amount\s+)?AED\s*([\d,]+\.?\d*)/i,
      /AED\s*([\d,]+\.?\d*)\s*$/im,  // AED at end of line
    ]

    for (const pattern of uaeAmountPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        totalAmount = this.parseNumber(match[1])
        if (totalAmount > 0) break
      }
    }

    // UAE VAT: "Total Tax on sales 5% 7,118.78"
    const uaeVatMatch = text.match(/Total\s+Tax\s+(?:on\s+sales\s+)?(?:\d+%\s+)?([\d,]+\.?\d*)/i)
    if (uaeVatMatch) {
      vatAmount = this.parseNumber(uaeVatMatch[1])
    }

    // Fall back to EUR/Pop Trading format if no UAE amount found
    if (!totalAmount) {
      const totalPatterns = [
        /([\d.,]+)\s+Total/i,
        /Total\s+(?:excl\.?\s+VAT\s*:?\s*)?(?:EUR|AED|USD)?\s*([\d.,]+)/i,
      ]

      for (const pattern of totalPatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
          totalAmount = this.parseNumber(match[1])
          break
        }
      }
    }

    // EUR VAT format: "0,00% VAT on 1.534,00"
    if (vatAmount === undefined) {
      const vatPercentMatch = text.match(/([\d.,]+)%\s+VAT\s+on\s+([\d.,]+)/i)
      if (vatPercentMatch) {
        const vatPercent = this.parseNumber(vatPercentMatch[1])
        const baseAmount = this.parseNumber(vatPercentMatch[2])
        vatAmount = (baseAmount * vatPercent) / 100

        if (vatAmount === 0 && totalAmount) {
          // 0% VAT means amount = total
          return { amount: totalAmount, currency, vatAmount: 0, totalAmount }
        }
      }
    }

    // Calculate subtotal
    const amount = totalAmount && vatAmount !== undefined
      ? totalAmount - vatAmount
      : totalAmount

    return { amount, currency, vatAmount, totalAmount }
  }

  /**
   * Parse European number format (1.534,00) to float
   */
  private static parseNumber(numStr: string): number {
    // European format: 1.534,00 or 1 534,00
    // US format: 1,534.00
    
    if (numStr.includes(',') && numStr.includes('.')) {
      // Both present - check which comes last
      if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
        // European: 1.534,00
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else {
        // US: 1,534.00
        numStr = numStr.replace(/,/g, '')
      }
    } else if (numStr.includes(',')) {
      // Only comma - check if decimal (2 digits after) or thousands
      if (/,\d{2}$/.test(numStr)) {
        // European decimal: 1534,00
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else {
        // Thousands separator
        numStr = numStr.replace(/,/g, '')
      }
    }
    
    return parseFloat(numStr) || 0
  }

  /**
   * Extract dates - invoice date and due date
   * Supports multiple formats:
   * - UAE: "28 Apr 2025", "Due Date: 20 May 2025"
   * - US: MM-DD-YYYY, MM/DD/YYYY
   * - EU: DD-MM-YYYY, DD/MM/YYYY
   */
  private static extractDates(text: string): { invoiceDate?: string; dueDate?: string } {
    let invoiceDate: string | undefined
    let dueDate: string | undefined

    const months: Record<string, number> = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }

    // UAE format: "Invoice Date 28 Apr 2025" or "28 Apr 2025"
    const uaeDatePattern = /Invoice\s+Date\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/i
    const uaeMatch = text.match(uaeDatePattern)
    if (uaeMatch) {
      const [, day, monthStr, year] = uaeMatch
      const month = months[monthStr.toLowerCase()]
      if (month) {
        invoiceDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }

    // UAE due date: "Due Date: 20 May 2025"
    const uaeDueDatePattern = /Due\s+Date\s*:?\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/i
    const uaeDueMatch = text.match(uaeDueDatePattern)
    if (uaeDueMatch) {
      const [, day, monthStr, year] = uaeDueMatch
      const month = months[monthStr.toLowerCase()]
      if (month) {
        dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }

    // Fall back to numeric formats if UAE format not found
    if (!invoiceDate) {
      const numericDateMatch = text.match(/Invoice\s+date\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i)
      if (numericDateMatch) {
        invoiceDate = numericDateMatch[1]
      }
    }

    // Calculate due date from payment terms if not explicitly found
    if (invoiceDate && !dueDate) {
      const paymentTermsMatch = text.match(/Payment\s+within\s+(\d+)\s+days/i)
      if (paymentTermsMatch) {
        const days = parseInt(paymentTermsMatch[1])
        const parts = invoiceDate.split(/[-\/]/).map(Number)

        let day: number, month: number, year: number
        if (invoiceDate.includes('-') && parts[0] > 31) {
          // YYYY-MM-DD format
          [year, month, day] = parts
        } else if (parts[0] > 12) {
          [day, month, year] = parts
        } else {
          [month, day, year] = parts
        }

        const date = new Date(year, month - 1, day)
        date.setDate(date.getDate() + days)

        dueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
    }

    return { invoiceDate, dueDate }
  }

  /**
   * Extract TRN/VAT number - supports:
   * - UAE TRN: 15-digit format (e.g., 104779489400003)
   * - EU VAT: Country code + alphanumeric (e.g., NL123456789B01)
   */
  private static extractTRN(text: string): string | undefined {
    const patterns = [
      /TRN\s*#?\s*:?\s*(\d{15})/i,  // UAE TRN: TRN # :104779489400003
      /TRN\s*:?\s*(\d{15})/i,  // TRN: 104779489400003
      /\b(\d{15})\b/,  // Standalone 15-digit number (likely TRN in UAE context)
      /VAT\s+number\s*:?\s*([A-Z]{2}[A-Z0-9]{8,12})/i,  // EU VAT number
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        // Validate UAE TRN (15 digits, starts with 100)
        if (/^\d{15}$/.test(match[1]) && match[1].startsWith('100')) {
          return match[1]
        }
        // EU VAT format
        if (/^[A-Z]{2}[A-Z0-9]{8,12}$/.test(match[1])) {
          return match[1]
        }
      }
    }

    // Broader search for 15-digit numbers that look like TRN
    const broadMatch = text.match(/\b(100\d{12})\b/)
    if (broadMatch) {
      return broadMatch[1]
    }

    return undefined
  }

  /**
   * Calculate confidence score
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

    return Math.min(score, 100)
  }

  /**
   * Parse PDF invoice using AWS Textract
   */
  public static async parseInvoicePDF(pdfBuffer: Buffer): Promise<ExtractedInvoiceData> {
    try {
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Invalid PDF buffer provided')
      }

      // Extract text using Textract
      const text = await this.extractTextFromPDF(pdfBuffer)

      if (!text || text.trim().length === 0) {
        return {
          confidence: 0,
          rawText: '',
          currency: 'EUR'
        }
      }

      // Extract all fields
      const invoiceNumber = this.extractInvoiceNumber(text)
      const customerName = this.extractCustomerName(text)
      const emails = this.extractEmails(text)
      const { amount, currency, vatAmount, totalAmount } = this.extractAmounts(text)
      const { invoiceDate, dueDate } = this.extractDates(text)
      const trn = this.extractTRN(text)

      const extractedData: ExtractedInvoiceData = {
        invoiceNumber,
        customerName,
        customerEmail: emails[0],
        amount,
        vatAmount,
        totalAmount,
        currency: currency || 'EUR',
        invoiceDate,
        dueDate,
        trn,
        confidence: 0,
        rawText: text.substring(0, 5000)
      }

      extractedData.confidence = this.calculateConfidence(extractedData)

      console.log('Textract extraction complete:', {
        invoiceNumber: extractedData.invoiceNumber,
        customerName: extractedData.customerName,
        totalAmount: extractedData.totalAmount,
        confidence: extractedData.confidence
      })

      return extractedData

    } catch (error) {
      console.error('Textract parsing error:', error)
      throw new Error(`Failed to parse PDF with Textract: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
