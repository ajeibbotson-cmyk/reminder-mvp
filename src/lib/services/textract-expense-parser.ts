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
   */
  private static getFieldValue(
    fields: ExpenseField[] | undefined,
    ...fieldTypes: string[]
  ): { value: string | undefined; confidence: number } {
    if (!fields) return { value: undefined, confidence: 0 }

    for (const type of fieldTypes) {
      const field = fields.find(f =>
        f.Type?.Text?.toUpperCase() === type.toUpperCase() ||
        f.LabelDetection?.Text?.toUpperCase().includes(type.toUpperCase())
      )

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

    for (const doc of documents) {
      const fields = doc.SummaryFields

      // Extract standard invoice fields using Textract's expense-specific types
      const invoiceId = this.getFieldValue(fields, 'INVOICE_RECEIPT_ID', 'INVOICE_NUMBER', 'RECEIPT_ID')
      if (invoiceId.value) {
        result.invoiceNumber = invoiceId.value
        totalConfidence += invoiceId.confidence
        fieldCount++
      }

      const vendorName = this.getFieldValue(fields, 'VENDOR_NAME', 'SUPPLIER_NAME', 'NAME')
      if (vendorName.value) {
        result.vendorName = vendorName.value
        result.customerName = vendorName.value // Use vendor as customer for consistency
        totalConfidence += vendorName.confidence
        fieldCount++
      }

      const total = this.getFieldValue(fields, 'TOTAL', 'AMOUNT_DUE', 'GRAND_TOTAL')
      if (total.value) {
        result.totalAmount = this.parseAmount(total.value)
        totalConfidence += total.confidence
        fieldCount++
      }

      const subtotal = this.getFieldValue(fields, 'SUBTOTAL', 'NET_TOTAL')
      if (subtotal.value) {
        result.amount = this.parseAmount(subtotal.value)
        totalConfidence += subtotal.confidence
        fieldCount++
      }

      const tax = this.getFieldValue(fields, 'TAX', 'VAT', 'TAX_AMOUNT')
      if (tax.value) {
        result.vatAmount = this.parseAmount(tax.value)
        totalConfidence += tax.confidence
        fieldCount++
      }

      const invoiceDate = this.getFieldValue(fields, 'INVOICE_RECEIPT_DATE', 'DATE', 'INVOICE_DATE')
      if (invoiceDate.value) {
        result.invoiceDate = this.normalizeDate(invoiceDate.value)
        totalConfidence += invoiceDate.confidence
        fieldCount++
      }

      const dueDate = this.getFieldValue(fields, 'DUE_DATE', 'PAYMENT_DUE')
      if (dueDate.value) {
        result.dueDate = this.normalizeDate(dueDate.value)
        totalConfidence += dueDate.confidence
        fieldCount++
      }

      const vendorAddress = this.getFieldValue(fields, 'VENDOR_ADDRESS', 'ADDRESS')
      if (vendorAddress.value) {
        result.vendorAddress = vendorAddress.value
        totalConfidence += vendorAddress.confidence
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

      // Extract line items for description
      if (doc.LineItemGroups) {
        const descriptions: string[] = []
        doc.LineItemGroups.forEach((group: LineItemGroup) => {
          group.LineItems?.forEach(item => {
            item.LineItemExpenseFields?.forEach(field => {
              if (field.Type?.Text === 'ITEM' || field.Type?.Text === 'DESCRIPTION') {
                if (field.ValueDetection?.Text) {
                  descriptions.push(field.ValueDetection.Text)
                }
              }
            })
          })
        })
        if (descriptions.length > 0) {
          result.description = descriptions.slice(0, 3).join('; ')
        }
      }
    }

    // Extract email from raw text
    result.customerEmail = this.extractEmail(rawText)

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
