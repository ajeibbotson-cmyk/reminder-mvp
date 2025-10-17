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
   * Extract invoice number - Pop Trading format: V01250724
   */
  private static extractInvoiceNumber(text: string): string | undefined {
    const patterns = [
      /\b(V\d{8})\b/,  // V01250724 format
      /invoice\s*(?:no|number|#)?\s*:?\s*(V\d{8})/i,
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
   * Extract customer name - appears after email before "Invoice number"
   */
  private static extractCustomerName(text: string): string | undefined {
    // Pattern: email@domain.com CUSTOMER NAME Invoice number
    const pattern = /@[a-z0-9.-]+\.[a-z]{2,}\s+(.+?)\s+Invoice\s+number/i
    const match = text.match(pattern)

    if (match && match[1]) {
      let name = match[1].trim()
      
      // Clean up common noise
      name = name.split(/\s{2,}/)[0] // Take first segment
      
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
   * Extract amounts with VAT calculation
   */
  private static extractAmounts(text: string): {
    amount?: number
    currency?: string
    vatAmount?: number
    totalAmount?: number
  } {
    let currency = 'EUR'
    
    // Detect currency
    if (/EUR|€/i.test(text)) currency = 'EUR'
    else if (/USD|\$/i.test(text)) currency = 'USD'
    else if (/AED/i.test(text)) currency = 'AED'

    // Extract total amount - look for patterns like "7.978,00 Total" or "Total EUR 7.978,00"
    const totalPatterns = [
      /([\d.,]+)\s+Total/i,
      /Total\s+(?:excl\.?\s+VAT\s*:?\s*)?(?:EUR|AED|USD)?\s*([\d.,]+)/i,
    ]

    let totalAmount: number | undefined
    for (const pattern of totalPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        totalAmount = this.parseNumber(match[1])
        break
      }
    }

    // Extract VAT - format: "0,00% VAT on 1.534,00"
    let vatAmount: number | undefined
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
   * Extract dates - invoice date and calculate due date
   */
  private static extractDates(text: string): { invoiceDate?: string; dueDate?: string } {
    let invoiceDate: string | undefined
    let dueDate: string | undefined

    // Extract invoice date - format: MM-DD-YYYY or DD/MM/YYYY
    const invoiceDateMatch = text.match(/Invoice\s+date\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i)
    if (invoiceDateMatch) {
      invoiceDate = invoiceDateMatch[1]
    }

    // Calculate due date from "Payment within X days"
    if (invoiceDate) {
      const paymentTermsMatch = text.match(/Payment\s+within\s+(\d+)\s+days/i)
      if (paymentTermsMatch) {
        const days = parseInt(paymentTermsMatch[1])
        const parts = invoiceDate.split(/[-\/]/).map(Number)
        
        let day: number, month: number, year: number
        // Assume MM-DD-YYYY format (American)
        if (parts[0] > 12) {
          [day, month, year] = parts
        } else {
          [month, day, year] = parts
        }

        const date = new Date(year, month - 1, day)
        date.setDate(date.getDate() + days)
        
        const separator = invoiceDate.includes('-') ? '-' : '/'
        dueDate = `${String(date.getMonth() + 1).padStart(2, '0')}${separator}${String(date.getDate()).padStart(2, '0')}${separator}${date.getFullYear()}`
      }
    }

    return { invoiceDate, dueDate }
  }

  /**
   * Extract TRN/VAT number
   */
  private static extractTRN(text: string): string | undefined {
    const patterns = [
      /VAT\s+number\s*:?\s*([A-Z]{2}[A-Z0-9]{8,12})/i,
      /TRN\s*:?\s*(\d{15})/i,
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
