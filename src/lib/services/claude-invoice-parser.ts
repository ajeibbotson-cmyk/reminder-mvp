/**
 * Claude-based PDF Invoice Parser
 * Uses Claude Haiku for intelligent invoice extraction
 * Handles any invoice layout without regex patterns
 */

import Anthropic from '@anthropic-ai/sdk'

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
  rawText?: string
}

interface ClaudeExtractionResult {
  invoice_number: string | null
  customer_name: string | null
  customer_email: string | null
  subtotal: number | null
  vat_amount: number | null
  total_amount: number | null
  currency: string
  invoice_date: string | null
  due_date: string | null
  description: string | null
  customer_trn: string | null
  confidence: number
}

export class ClaudeInvoiceParser {
  private static client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  })

  private static EXTRACTION_PROMPT = `You are an invoice data extraction assistant. Extract the following fields from this invoice image/document.

Return ONLY a JSON object with these exact fields (use null for missing values):
{
  "invoice_number": "the invoice number/ID",
  "customer_name": "the customer/buyer company name (not the seller)",
  "customer_email": "customer email if visible",
  "subtotal": numeric amount before tax (no currency symbol),
  "vat_amount": numeric VAT/tax amount (no currency symbol),
  "total_amount": numeric final payable amount (no currency symbol),
  "currency": "AED" or "EUR" or "USD" etc,
  "invoice_date": "YYYY-MM-DD format",
  "due_date": "YYYY-MM-DD format",
  "description": "brief description of what's being invoiced",
  "customer_trn": "customer's TRN/VAT number if visible",
  "confidence": 0-100 score of extraction confidence
}

Important:
- total_amount should be the "Amount Due" or final payable amount, not subtotals
- customer_name is who is RECEIVING the invoice (buyer), not the company issuing it
- Dates must be in YYYY-MM-DD format
- All amounts must be plain numbers without currency symbols or commas
- If a field is not clearly visible, use null`

  /**
   * Parse invoice from PDF buffer using Claude Vision
   */
  public static async parseInvoicePDF(pdfBuffer: Buffer): Promise<ExtractedInvoiceData> {
    try {
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Invalid PDF buffer provided')
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured')
      }

      console.log('[Claude Parser] Processing PDF, size:', pdfBuffer.length)

      // Convert PDF to base64
      const base64PDF = pdfBuffer.toString('base64')

      // Call Claude with the PDF
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64PDF,
                },
              },
              {
                type: 'text',
                text: this.EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      })

      // Extract the text response
      const textContent = response.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      console.log('[Claude Parser] Raw response:', textContent.text)

      // Parse the JSON response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Claude response')
      }

      const extracted: ClaudeExtractionResult = JSON.parse(jsonMatch[0])

      console.log('[Claude Parser] Extracted data:', extracted)

      // Convert to our standard format
      return {
        invoiceNumber: extracted.invoice_number || undefined,
        customerName: extracted.customer_name || undefined,
        customerEmail: extracted.customer_email || undefined,
        amount: extracted.subtotal || extracted.total_amount || undefined,
        vatAmount: extracted.vat_amount || undefined,
        totalAmount: extracted.total_amount || undefined,
        currency: extracted.currency || 'AED',
        invoiceDate: extracted.invoice_date || undefined,
        dueDate: extracted.due_date || undefined,
        description: extracted.description || undefined,
        trn: extracted.customer_trn || undefined,
        confidence: extracted.confidence || 0,
      }

    } catch (error) {
      console.error('[Claude Parser] Extraction failed:', error)

      // Return empty result with zero confidence
      return {
        confidence: 0,
        currency: 'AED',
      }
    }
  }

  /**
   * Parse invoice from image buffer (PNG/JPEG)
   */
  public static async parseInvoiceImage(
    imageBuffer: Buffer,
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/png'
  ): Promise<ExtractedInvoiceData> {
    try {
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Invalid image buffer provided')
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured')
      }

      console.log('[Claude Parser] Processing image, size:', imageBuffer.length)

      const base64Image = imageBuffer.toString('base64')

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: this.EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      })

      const textContent = response.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Claude response')
      }

      const extracted: ClaudeExtractionResult = JSON.parse(jsonMatch[0])

      return {
        invoiceNumber: extracted.invoice_number || undefined,
        customerName: extracted.customer_name || undefined,
        customerEmail: extracted.customer_email || undefined,
        amount: extracted.subtotal || extracted.total_amount || undefined,
        vatAmount: extracted.vat_amount || undefined,
        totalAmount: extracted.total_amount || undefined,
        currency: extracted.currency || 'AED',
        invoiceDate: extracted.invoice_date || undefined,
        dueDate: extracted.due_date || undefined,
        description: extracted.description || undefined,
        trn: extracted.customer_trn || undefined,
        confidence: extracted.confidence || 0,
      }

    } catch (error) {
      console.error('[Claude Parser] Image extraction failed:', error)
      return {
        confidence: 0,
        currency: 'AED',
      }
    }
  }
}

/**
 * Hybrid parser - tries Claude first, falls back to Textract
 */
export async function parseInvoiceWithFallback(pdfBuffer: Buffer): Promise<ExtractedInvoiceData> {
  // Try Claude first
  const claudeResult = await ClaudeInvoiceParser.parseInvoicePDF(pdfBuffer)

  if (claudeResult.confidence >= 70) {
    console.log('[Hybrid Parser] Using Claude result, confidence:', claudeResult.confidence)
    return claudeResult
  }

  // Fall back to Textract if Claude confidence is low
  console.log('[Hybrid Parser] Claude confidence low, falling back to Textract')
  const { TextractInvoiceParser } = await import('./textract-invoice-parser')
  return TextractInvoiceParser.parseInvoicePDF(pdfBuffer)
}
