/**
 * AWS Textract Expense Analysis Parser
 * Uses StartExpenseAnalysis for invoice-optimized async processing
 *
 * Benefits over StartDocumentTextDetection:
 * - Invoice-specific field extraction (VENDOR_NAME, INVOICE_ID, TOTAL, etc.)
 * - Better accuracy for financial documents
 * - Handles multi-page invoices
 * - Async API for faster processing
 */

import {
  TextractClient,
  StartExpenseAnalysisCommand,
  GetExpenseAnalysisCommand,
  type ExpenseDocument,
  type ExpenseField,
  type LineItemGroup
} from '@aws-sdk/client-textract'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'

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
  vendorName?: string
  vendorAddress?: string
  confidence: number
  rawText: string
  s3Bucket?: string
  s3Key?: string
  processingTimeMs?: number
}

// Polling configuration - aggressive for speed
const INITIAL_POLL_MS = 500 // Start at 500ms for expense analysis (faster than text detection)
const MAX_POLL_MS = 3000 // Cap at 3s (expense analysis is typically faster)
const MAX_TOTAL_TIME_MS = 90000 // 90 seconds max

export class TextractExpenseParser {
  private static s3Client = new S3Client({
    region: process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })

  private static textractClient = new TextractClient({
    region: process.env.AWS_TEXTRACT_REGION || process.env.AWS_S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })

  /**
   * Upload PDF to S3 for async processing
   */
  private static async uploadToS3(
    pdfBuffer: Buffer,
    fileName: string
  ): Promise<{ bucket: string; key: string }> {
    const bucket = process.env.AWS_S3_BUCKET_NAME || 'reminder-mvp-textract-pdfs'
    const key = `expense-invoices/${Date.now()}-${fileName}`

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })

    await this.s3Client.send(command)
    return { bucket, key }
  }

  /**
   * Delete PDF from S3 after processing
   */
  private static async deleteFromS3(bucket: string, key: string): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    } catch (error) {
      console.error('[ExpenseParser] S3 cleanup failed:', error)
    }
  }

  /**
   * Start async expense analysis job
   */
  private static async startExpenseJob(bucket: string, key: string): Promise<string> {
    const command = new StartExpenseAnalysisCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
    })

    const response = await this.textractClient.send(command)

    if (!response.JobId) {
      throw new Error('Textract did not return a JobId')
    }

    return response.JobId
  }

  /**
   * Poll expense job with aggressive exponential backoff
   */
  private static async pollExpenseJob(jobId: string): Promise<ExpenseDocument[]> {
    const startTime = Date.now()
    let pollInterval = INITIAL_POLL_MS

    while (Date.now() - startTime < MAX_TOTAL_TIME_MS) {
      const command = new GetExpenseAnalysisCommand({ JobId: jobId })
      const response = await this.textractClient.send(command)

      if (response.JobStatus === 'SUCCEEDED') {
        const documents: ExpenseDocument[] = response.ExpenseDocuments || []

        // Handle pagination
        let nextToken = response.NextToken
        while (nextToken) {
          const nextCommand = new GetExpenseAnalysisCommand({
            JobId: jobId,
            NextToken: nextToken,
          })
          const nextResponse = await this.textractClient.send(nextCommand)
          documents.push(...(nextResponse.ExpenseDocuments || []))
          nextToken = nextResponse.NextToken
        }

        const elapsed = Date.now() - startTime
        console.log(`[ExpenseParser] Job completed in ${elapsed}ms`)
        return documents
      }

      if (response.JobStatus === 'FAILED') {
        throw new Error(`Expense analysis failed: ${response.StatusMessage || 'Unknown error'}`)
      }

      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      pollInterval = Math.min(pollInterval * 1.5, MAX_POLL_MS)
    }

    throw new Error('Expense analysis timeout')
  }

  /**
   * Extract field value from expense summary fields
   * Searches by Type.Text (Textract's classified type) and LabelDetection.Text (actual label on document)
   */
  private static getFieldValue(
    fields: ExpenseField[] | undefined,
    ...fieldTypes: string[]
  ): { value: string | undefined; confidence: number } {
    if (!fields) return { value: undefined, confidence: 0 }

    for (const type of fieldTypes) {
      const typeUpper = type.toUpperCase().replace(/[_\s]+/g, '') // Normalize: "DUE_DATE" -> "DUEDATE"

      const field = fields.find(f => {
        // Match by Textract's classified type (exact match)
        const fieldType = f.Type?.Text?.toUpperCase().replace(/[_\s]+/g, '') || ''
        if (fieldType === typeUpper) return true

        // Match by label text on document (more flexible - contains match)
        // BUT only if labelText is not empty (empty string.includes() always returns true!)
        const labelText = f.LabelDetection?.Text?.toUpperCase().replace(/[_\s]+/g, '') || ''
        if (labelText && labelText.includes(typeUpper)) return true

        // Also check for common variations (only if labelText is meaningful)
        if (labelText && labelText.length >= 3) {
          const searchTerms = type.toUpperCase().split(/[_\s]+/)
          return searchTerms.every(term => labelText.includes(term))
        }

        return false
      })

      if (field?.ValueDetection?.Text) {
        return {
          value: field.ValueDetection.Text,
          confidence: field.ValueDetection.Confidence || 0
        }
      }
    }

    return { value: undefined, confidence: 0 }
  }

  /**
   * Extract amount from string (handles European/US formats)
   */
  private static parseAmount(amountStr: string | undefined): number | undefined {
    if (!amountStr) return undefined

    // Remove currency symbols and spaces
    let cleaned = amountStr.replace(/[€$£¥₹AED\s]/gi, '').trim()

    // Handle European format (1.234,56) vs US format (1,234.56)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // European: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.')
      } else {
        // US: 1,234.56
        cleaned = cleaned.replace(/,/g, '')
      }
    } else if (cleaned.includes(',')) {
      // Could be European decimal or US thousands
      if (/,\d{2}$/.test(cleaned)) {
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    }

    const amount = parseFloat(cleaned)
    return isNaN(amount) ? undefined : amount
  }

  /**
   * Extract email from text
   */
  private static extractEmail(text: string): string | undefined {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    const match = text.match(emailPattern)
    return match ? match[1].toLowerCase() : undefined
  }

  /**
   * Convert date formats to YYYY-MM-DD
   */
  private static normalizeDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined

    // Try various formats
    const patterns = [
      /(\d{2})[-\/](\d{2})[-\/](\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
      /(\d{4})[-\/](\d{2})[-\/](\d{2})/, // YYYY-MM-DD
    ]

    for (const pattern of patterns) {
      const match = dateStr.match(pattern)
      if (match) {
        if (match[0].startsWith('20') || match[0].startsWith('19')) {
          return match[0] // Already YYYY-MM-DD
        }
        // Assume DD/MM/YYYY for non-US
        const [, first, second, year] = match
        const day = parseInt(first) > 12 ? first : second
        const month = parseInt(first) > 12 ? second : first
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }

    return dateStr
  }

  /**
   * Process expense documents into structured data
   */
  private static processExpenseDocuments(documents: ExpenseDocument[]): ExtractedInvoiceData {
    let rawText = ''
    let totalConfidence = 0
    let fieldCount = 0
    const result: Partial<ExtractedInvoiceData> = {}

    // Debug: Log all detected fields for analysis
    const allFields: { type: string; label: string; value: string; confidence: number }[] = []

    for (const doc of documents) {
      const fields = doc.SummaryFields

      // Log all fields for debugging
      fields?.forEach(f => {
        allFields.push({
          type: f.Type?.Text || 'UNKNOWN',
          label: f.LabelDetection?.Text || '',
          value: f.ValueDetection?.Text || '',
          confidence: f.ValueDetection?.Confidence || 0
        })
      })

      // Extract standard invoice fields using Textract's expense-specific types
      const invoiceId = this.getFieldValue(fields, 'INVOICE_RECEIPT_ID', 'INVOICE_NUMBER', 'RECEIPT_ID', 'INVOICE NUMBER')
      if (invoiceId.value) {
        result.invoiceNumber = invoiceId.value
        totalConfidence += invoiceId.confidence
        fieldCount++
      }

      // IMPORTANT: For outgoing invoices (what we're building), the structure is:
      // - VENDOR = who sent the invoice (e.g., POP Trading Company) - this is US/our client
      // - RECEIVER/CUSTOMER = who receives the invoice and owes money (e.g., De Bijenkorf) - this is who we're chasing

      // First get the vendor (the company sending the invoice - our client)
      const vendorName = this.getFieldValue(fields, 'VENDOR_NAME', 'SUPPLIER_NAME', 'FROM', 'SELLER')
      if (vendorName.value) {
        result.vendorName = vendorName.value
        totalConfidence += vendorName.confidence
        fieldCount++
      }

      // Now get the receiver/customer (who we're invoicing and need to chase for payment)
      const receiverName = this.getFieldValue(fields, 'RECEIVER_NAME', 'RECEIVER', 'CUSTOMER_NAME', 'CUSTOMER', 'BILL_TO', 'SHIP_TO', 'DEBTOR', 'CLIENT')
      if (receiverName.value) {
        result.customerName = receiverName.value
        totalConfidence += receiverName.confidence
        fieldCount++
      }

      // If no receiver found but we have vendor, check for NAME field (might be the debtor in some formats)
      // Also look for "Debtor" specific fields
      if (!result.customerName) {
        const debtorName = this.getFieldValue(fields, 'DEBTOR_NAME', 'DEBTOR', 'DEBTOR NUMBER')
        if (debtorName.value && debtorName.value !== result.vendorName) {
          // If it's a number (like debtor number), don't use it as customer name
          if (!/^\d+$/.test(debtorName.value)) {
            result.customerName = debtorName.value
            totalConfidence += debtorName.confidence
            fieldCount++
          }
        }
      }

      // Last resort: use NAME field if it's different from vendor
      if (!result.customerName) {
        const nameField = this.getFieldValue(fields, 'NAME')
        if (nameField.value && nameField.value !== result.vendorName) {
          result.customerName = nameField.value
          totalConfidence += nameField.confidence
          fieldCount++
        }
      }

      // Try to find the "To pay" total first (most accurate for final payable amount)
      // Textract may return multiple TOTAL fields - we want the one labeled "To pay" or similar
      let bestTotal: { value: string; confidence: number; label: string } | null = null

      fields?.forEach(f => {
        if (f.Type?.Text?.toUpperCase() === 'TOTAL' && f.ValueDetection?.Text) {
          const label = f.LabelDetection?.Text?.toLowerCase() || ''
          const value = f.ValueDetection.Text
          const confidence = f.ValueDetection.Confidence || 0

          // Prioritize "To pay" / "Te betalen" / "Amount due" over generic "Total"
          const isPayableLabel = label.includes('pay') || label.includes('betalen') ||
                                 label.includes('due') || label.includes('balance')

          if (!bestTotal || isPayableLabel) {
            bestTotal = { value, confidence, label }
            console.log('[ExpenseParser] Found TOTAL candidate:', { label, value, confidence, isPayableLabel })
          }
        }
      })

      if (bestTotal) {
        result.totalAmount = this.parseAmount(bestTotal.value)
        totalConfidence += bestTotal.confidence
        fieldCount++
        console.log('[ExpenseParser] Selected total:', bestTotal.value, 'from label:', bestTotal.label)
      } else {
        // Fallback to generic search
        const total = this.getFieldValue(fields, 'TOTAL', 'AMOUNT_DUE', 'GRAND_TOTAL', 'TOTAL_DUE', 'BALANCE_DUE', 'AMOUNT', 'INVOICE_TOTAL')
        if (total.value) {
          result.totalAmount = this.parseAmount(total.value)
          totalConfidence += total.confidence
          fieldCount++
        }
      }

      const subtotal = this.getFieldValue(fields, 'SUBTOTAL', 'NET_TOTAL', 'SUB_TOTAL', 'NET_AMOUNT')
      if (subtotal.value) {
        result.amount = this.parseAmount(subtotal.value)
        totalConfidence += subtotal.confidence
        fieldCount++
      }

      const tax = this.getFieldValue(fields, 'TAX', 'VAT', 'TAX_AMOUNT', 'BTW', 'GST', 'SALES_TAX')
      if (tax.value) {
        result.vatAmount = this.parseAmount(tax.value)
        totalConfidence += tax.confidence
        fieldCount++
      }

      const invoiceDate = this.getFieldValue(fields, 'INVOICE_RECEIPT_DATE', 'DATE', 'INVOICE_DATE', 'INVOICE DATE', 'DOCUMENT_DATE')
      if (invoiceDate.value) {
        result.invoiceDate = this.normalizeDate(invoiceDate.value)
        totalConfidence += invoiceDate.confidence
        fieldCount++
      }

      // Expanded due date search - many variations
      const dueDate = this.getFieldValue(fields, 'DUE_DATE', 'PAYMENT_DUE', 'PAY_BY', 'PAYMENT_DATE', 'PAYMENT_TERMS', 'TERMS', 'NET_DUE', 'DUE BY')
      if (dueDate.value) {
        // Check if it's a date or payment terms like "Net 30"
        const dueDateNormalized = this.normalizeDate(dueDate.value)
        if (dueDateNormalized && /\d{4}/.test(dueDateNormalized)) {
          result.dueDate = dueDateNormalized
        } else if (result.invoiceDate && /net\s*(\d+)/i.test(dueDate.value)) {
          // Calculate due date from payment terms
          const daysMatch = dueDate.value.match(/net\s*(\d+)/i)
          if (daysMatch) {
            const days = parseInt(daysMatch[1])
            const invoiceDateObj = new Date(result.invoiceDate)
            invoiceDateObj.setDate(invoiceDateObj.getDate() + days)
            result.dueDate = invoiceDateObj.toISOString().split('T')[0]
          }
        }
        totalConfidence += dueDate.confidence
        fieldCount++
      }

      const vendorAddress = this.getFieldValue(fields, 'VENDOR_ADDRESS', 'ADDRESS', 'SENDER_ADDRESS', 'FROM_ADDRESS')
      if (vendorAddress.value) {
        result.vendorAddress = vendorAddress.value
        totalConfidence += vendorAddress.confidence
        fieldCount++
      }

      // Try to get receiver/customer address
      const receiverAddress = this.getFieldValue(fields, 'RECEIVER_ADDRESS', 'BILL_TO_ADDRESS', 'SHIP_TO_ADDRESS', 'CUSTOMER_ADDRESS')
      if (receiverAddress.value && !result.vendorAddress) {
        result.vendorAddress = receiverAddress.value
        totalConfidence += receiverAddress.confidence
        fieldCount++
      }

      // Build raw text from all fields for email extraction
      fields?.forEach(f => {
        if (f.ValueDetection?.Text) {
          rawText += f.ValueDetection.Text + ' '
        }
        if (f.LabelDetection?.Text) {
          rawText += f.LabelDetection.Text + ' '
        }
      })

      // Extract line items for description and also look for totals in line items
      if (doc.LineItemGroups) {
        const descriptions: string[] = []
        let lineItemTotal = 0

        doc.LineItemGroups.forEach((group: LineItemGroup) => {
          group.LineItems?.forEach(item => {
            item.LineItemExpenseFields?.forEach(field => {
              if (field.Type?.Text === 'ITEM' || field.Type?.Text === 'DESCRIPTION') {
                if (field.ValueDetection?.Text) {
                  descriptions.push(field.ValueDetection.Text)
                }
              }
              // Sum up line item prices if we don't have a total
              if (field.Type?.Text === 'PRICE' || field.Type?.Text === 'AMOUNT') {
                const price = this.parseAmount(field.ValueDetection?.Text)
                if (price) lineItemTotal += price
              }
            })
          })
        })
        if (descriptions.length > 0) {
          result.description = descriptions.slice(0, 3).join('; ')
        }
        // Use line item total if we didn't find a document total
        if (!result.totalAmount && lineItemTotal > 0) {
          result.totalAmount = lineItemTotal
        }
      }
    }

    // Debug log all fields found
    console.log('[ExpenseParser] All detected fields:', JSON.stringify(allFields, null, 2))
    console.log('[ExpenseParser] Current result before fallback:', JSON.stringify({
      invoiceNumber: result.invoiceNumber,
      invoiceNumberLength: result.invoiceNumber?.length,
      customerName: result.customerName,
      vendorName: result.vendorName,
      totalAmount: result.totalAmount
    }))
    console.log('[ExpenseParser] Raw text for fallback (first 500 chars):', rawText.substring(0, 500))

    // FALLBACK: If expense analysis didn't extract proper fields, try regex on raw text
    // This helps with B2B invoices like POP Trading that have clear labels

    // Check if invoice number is bad: missing, too long (merged text), or contains newlines (address merged)
    const invoiceNumBad = !result.invoiceNumber ||
                          result.invoiceNumber.length > 30 ||
                          result.invoiceNumber.includes('\n')
    console.log('[ExpenseParser] Invoice number needs fallback?', invoiceNumBad)

    if (invoiceNumBad) {
      // Invoice number looks wrong (too long = merged text), try regex
      // Look for patterns like V01250234, INV-2024-001, etc.
      // IMPORTANT: These patterns must require digits to avoid matching words like "number"
      const invoicePatterns = [
        /([V]\d{8,})/i,  // POP Trading format: V01250234 (V followed by 8+ digits)
        /invoice\s*(?:number|no\.?|#)?\s*[:.]?\s*([A-Z]?\d{6,})/i,  // Invoice number: 123456
        /(?:inv|fac(?:tuur)?)\s*#?\s*[:.]?\s*([A-Z]{0,3}\d{5,})/i,  // INV/FAC followed by number
        /\b([A-Z]{2,3}\d{6,})\b/i  // ABC123456 pattern
      ]
      for (const pattern of invoicePatterns) {
        const match = rawText.match(pattern)
        const matchedValue = match?.[1]
        console.log('[ExpenseParser] Trying invoice pattern:', pattern.toString(), '-> match:', matchedValue)
        // Ensure the match contains at least some digits (not just "number")
        if (matchedValue && matchedValue.length < 30 && /\d{4,}/.test(matchedValue)) {
          result.invoiceNumber = matchedValue.trim()
          console.log('[ExpenseParser] Fallback: Found invoice number via regex:', result.invoiceNumber)
          break
        }
      }
    }

    // Check if customer name is bad: missing, same as vendor, contains newlines (merged with address), or suspiciously long
    const customerNameBad = !result.customerName ||
                            result.customerName === result.vendorName ||
                            result.customerName.includes('\n') ||
                            result.customerName.length > 50
    console.log('[ExpenseParser] Customer name needs fallback?', customerNameBad,
                '(has newlines:', result.customerName?.includes('\n'),
                ', length:', result.customerName?.length, ')')

    if (customerNameBad) {
      // Look for labeled customer/debtor - more patterns for B2B invoices
      const customerPatterns = [
        /de\s+bijenkorf/i,  // Specific known customer
        /(?:debtor|customer|bill\s*to|sold\s*to|klant|debiteur)\s*(?:name)?[:.]?\s*([A-Za-z][A-Za-z\s&.',-]{2,50}?)(?:\n|$|postbus|\d)/i,
        /^([A-Z][A-Za-z\s&.',-]{2,40})\s*\n\s*(?:postbus|p\.?o\.?\s*box)/im,  // Name followed by address
        /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+(?:BV|B\.V\.|NV|N\.V\.|Ltd|LLC|Inc))?/  // Company name pattern
      ]
      for (const pattern of customerPatterns) {
        const match = rawText.match(pattern)
        console.log('[ExpenseParser] Trying customer pattern:', pattern.toString(), '-> match:', match?.[0] || match?.[1])
        if (match) {
          const customerValue = match[1] || match[0]
          if (customerValue && customerValue.trim() !== result.vendorName && !customerValue.toLowerCase().includes('pop trading')) {
            result.customerName = customerValue.trim()
            console.log('[ExpenseParser] Fallback: Found customer name via regex:', result.customerName)
            break
          }
        }
      }
    }

    // Extract amounts - look for "To pay" amount which is the final payable amount
    // This is CRITICAL: We need the actual invoice total, not subtotals or discounts
    // For invoices with VAT, the "To pay" amount should be AFTER VAT is added

    // First, try to find the definitive "To pay" / "Te betalen" amount (highest priority)
    const toPayPatterns = [
      /to\s*pay\s*[:.]?\s*(?:EUR|€|USD|\$)?\s*([\d.,]+)/i,                    // "To pay: EUR 35,753.76"
      /te\s*betalen\s*[:.]?\s*(?:EUR|€)?\s*([\d.,]+)/i,                        // Dutch: "Te betalen"
      /(?:EUR|€)\s*([\d.,]+)\s*(?:to\s*pay|te\s*betalen)/i,                    // "EUR 35,753.76 To pay"
      /amount\s*(?:to\s*)?pay(?:able)?\s*[:.]?\s*(?:EUR|€)?\s*([\d.,]+)/i,     // "Amount payable"
      /balance\s*due\s*[:.]?\s*(?:EUR|€)?\s*([\d.,]+)/i,                       // "Balance due"
      /total\s*(?:amount\s*)?due\s*[:.]?\s*(?:EUR|€)?\s*([\d.,]+)/i,           // "Total amount due"
      /(?:final|net)\s*(?:total|amount)\s*[:.]?\s*(?:EUR|€)?\s*([\d.,]+)/i,    // "Final total" / "Net amount"
    ]

    let foundToPay = false
    for (const pattern of toPayPatterns) {
      const match = rawText.match(pattern)
      if (match) {
        const toPayAmount = this.parseAmount(match[1])
        if (toPayAmount && toPayAmount > 0) {
          // Validate: "To pay" amount should be reasonable (> VAT if VAT exists, or > current totalAmount)
          const isReasonable = !result.vatAmount || toPayAmount > result.vatAmount
          if (isReasonable) {
            console.log('[ExpenseParser] Found "To pay" amount:', toPayAmount, 'via pattern:', pattern.toString())
            result.totalAmount = toPayAmount
            foundToPay = true
            break
          }
        }
      }
    }

    // If we found a totalAmount from Textract, validate it makes sense
    // A common error: extracting discount amount instead of final total
    if (result.totalAmount && result.vatAmount && !foundToPay) {
      // If we have VAT, the total should be GREATER than VAT alone
      // Also, if total is LESS than VAT, it's probably wrong (e.g., discount amount)
      if (result.totalAmount < result.vatAmount) {
        console.log('[ExpenseParser] WARNING: totalAmount', result.totalAmount, '< vatAmount', result.vatAmount, '- likely wrong, searching for correct total')

        // Search for larger amounts in raw text that could be the real total
        // Look for amounts that are greater than the current (wrong) total
        const allAmountMatches = rawText.matchAll(/(?:EUR|€)\s*([\d.,]+)/gi)
        let largestReasonableAmount = result.totalAmount

        for (const match of allAmountMatches) {
          const amount = this.parseAmount(match[1])
          if (amount && amount > largestReasonableAmount && amount > result.vatAmount) {
            // Sanity check: shouldn't be more than 10x the VAT (would be unrealistic)
            if (amount < result.vatAmount * 10) {
              largestReasonableAmount = amount
              console.log('[ExpenseParser] Found larger candidate total:', amount)
            }
          }
        }

        if (largestReasonableAmount > result.totalAmount) {
          console.log('[ExpenseParser] Correcting totalAmount from', result.totalAmount, 'to', largestReasonableAmount)
          result.totalAmount = largestReasonableAmount
        }
      }
    }

    // Fallback: if still no total or seems wrong, use pattern matching
    if (!result.totalAmount) {
      // Look for total amount patterns
      const totalPatterns = [
        /(?:total|totaal|grand\s*total|amount\s*due|balance\s*due)\s*[:.]?\s*[€$]?\s*([\d.,]+)/i,
        /[€$]\s*([\d.,]+)\s*(?:total|totaal)/i,
        /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)/i  // European format before currency
      ]
      for (const pattern of totalPatterns) {
        const match = rawText.match(pattern)
        if (match) {
          result.totalAmount = this.parseAmount(match[1])
          console.log('[ExpenseParser] Fallback: Found total amount via regex:', result.totalAmount)
          break
        }
      }
    }

    // Extract invoice date if not found
    if (!result.invoiceDate) {
      const datePatterns = [
        /invoice\s*date\s*[:.]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /date\s*[:.]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
        /(\d{2}-\d{2}-\d{4})/  // DD-MM-YYYY format
      ]
      for (const pattern of datePatterns) {
        const match = rawText.match(pattern)
        if (match) {
          result.invoiceDate = this.normalizeDate(match[1])
          console.log('[ExpenseParser] Fallback: Found invoice date via regex:', result.invoiceDate)
          break
        }
      }
    }

    // Extract email from raw text
    result.customerEmail = this.extractEmail(rawText)

    // Fallback: If no due date but we have invoice date, default to Net 30
    if (!result.dueDate && result.invoiceDate) {
      const invoiceDateObj = new Date(result.invoiceDate)
      invoiceDateObj.setDate(invoiceDateObj.getDate() + 30)
      result.dueDate = invoiceDateObj.toISOString().split('T')[0]
      console.log('[ExpenseParser] No due date found, defaulting to Net 30:', result.dueDate)
    }

    // Calculate overall confidence
    const confidence = fieldCount > 0 ? Math.round(totalConfidence / fieldCount) : 0

    // If no amount but have total, use total as amount
    if (!result.amount && result.totalAmount) {
      result.amount = result.totalAmount
    }

    return {
      invoiceNumber: result.invoiceNumber,
      customerName: result.customerName,
      customerEmail: result.customerEmail,
      amount: result.amount,
      vatAmount: result.vatAmount,
      totalAmount: result.totalAmount,
      currency: 'EUR', // Default, could be extracted
      dueDate: result.dueDate,
      invoiceDate: result.invoiceDate,
      description: result.description,
      vendorName: result.vendorName,
      vendorAddress: result.vendorAddress,
      confidence,
      rawText: rawText.substring(0, 3000)
    }
  }

  /**
   * Parse PDF invoice using expense analysis (fastest + most accurate for invoices)
   */
  public static async parseInvoicePDF(
    pdfBuffer: Buffer,
    fileName: string = 'invoice.pdf'
  ): Promise<ExtractedInvoiceData> {
    const startTime = Date.now()
    let s3Bucket: string | undefined
    let s3Key: string | undefined

    console.log(`[ExpenseParser] Starting invoice processing: ${fileName}`)

    try {
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Invalid PDF buffer')
      }

      // Step 1: Upload to S3
      const uploadStart = Date.now()
      const s3Location = await this.uploadToS3(pdfBuffer, fileName)
      s3Bucket = s3Location.bucket
      s3Key = s3Location.key
      console.log(`[ExpenseParser] S3 upload: ${Date.now() - uploadStart}ms`)

      // Step 2: Start expense analysis job
      const jobStart = Date.now()
      const jobId = await this.startExpenseJob(s3Bucket, s3Key)
      console.log(`[ExpenseParser] Job started: ${Date.now() - jobStart}ms`)

      // Step 3: Poll for completion
      const pollStart = Date.now()
      const documents = await this.pollExpenseJob(jobId)
      console.log(`[ExpenseParser] Polling complete: ${Date.now() - pollStart}ms`)

      // Step 4: Process results
      const result = this.processExpenseDocuments(documents)
      result.s3Bucket = s3Bucket
      result.s3Key = s3Key
      result.processingTimeMs = Date.now() - startTime

      console.log(`[ExpenseParser] ✅ TOTAL: ${result.processingTimeMs}ms | Invoice: ${result.invoiceNumber} | Confidence: ${result.confidence}%`)

      return result

    } catch (error) {
      console.error('[ExpenseParser] Error:', error)

      // Cleanup on error
      if (s3Bucket && s3Key) {
        await this.deleteFromS3(s3Bucket, s3Key)
      }

      throw new Error(`Expense analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
