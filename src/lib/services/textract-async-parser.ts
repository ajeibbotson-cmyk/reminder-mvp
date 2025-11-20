/**
 * AWS Textract Async PDF Invoice Parser
 * Handles multi-page PDFs using async Textract API with S3 integration
 */

import {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
  type DocumentLocation,
  type Block
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
  confidence: number
  rawText: string
  s3Bucket?: string
  s3Key?: string
}

export class TextractAsyncParser {
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
   * Upload PDF to S3 for async Textract processing
   */
  private static async uploadToS3(
    pdfBuffer: Buffer,
    fileName: string
  ): Promise<{ bucket: string; key: string }> {
    const bucket = process.env.AWS_S3_BUCKET_NAME || 'reminder-mvp-textract-pdfs'
    const key = `invoices/${Date.now()}-${fileName}`

    try {
      console.log('Uploading PDF to S3:', { bucket, key, size: pdfBuffer.length })

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })

      await this.s3Client.send(command)
      console.log('S3 upload successful')

      return { bucket, key }
    } catch (error) {
      console.error('S3 upload failed:', error)
      throw new Error(`Failed to upload PDF to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete PDF from S3 after processing
   */
  private static async deleteFromS3(bucket: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
      await this.s3Client.send(command)
      console.log('S3 cleanup successful:', key)
    } catch (error) {
      console.error('S3 cleanup failed:', error)
      // Don't throw - cleanup failure shouldn't break extraction
    }
  }

  /**
   * Start async Textract job
   */
  private static async startTextractJob(
    bucket: string,
    key: string
  ): Promise<string> {
    try {
      console.log('Starting Textract async job:', { bucket, key })

      const documentLocation: DocumentLocation = {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      }

      const command = new StartDocumentTextDetectionCommand({
        DocumentLocation: documentLocation,
      })

      const response = await this.textractClient.send(command)

      if (!response.JobId) {
        throw new Error('Textract did not return a JobId')
      }

      console.log('Textract job started:', response.JobId)
      return response.JobId
    } catch (error) {
      console.error('Textract job start failed:', error)
      throw new Error(`Failed to start Textract job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Poll Textract job until complete
   */
  private static async pollTextractJob(jobId: string): Promise<Block[]> {
    const maxAttempts = 60 // 5 minutes max (5 second intervals)
    const pollInterval = 5000 // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`Polling Textract job (attempt ${attempt + 1}/${maxAttempts}):`, jobId)

        const command = new GetDocumentTextDetectionCommand({
          JobId: jobId,
        })

        const response = await this.textractClient.send(command)

        console.log('Job status:', response.JobStatus)

        if (response.JobStatus === 'SUCCEEDED') {
          const blocks: Block[] = response.Blocks || []

          // Handle pagination if needed
          let nextToken = response.NextToken
          while (nextToken) {
            const nextCommand = new GetDocumentTextDetectionCommand({
              JobId: jobId,
              NextToken: nextToken,
            })
            const nextResponse = await this.textractClient.send(nextCommand)
            blocks.push(...(nextResponse.Blocks || []))
            nextToken = nextResponse.NextToken
          }

          console.log('Textract job completed, blocks:', blocks.length)
          return blocks
        }

        if (response.JobStatus === 'FAILED') {
          throw new Error(`Textract job failed: ${response.StatusMessage || 'Unknown error'}`)
        }

        // Job still in progress, wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error) {
        console.error('Textract polling error:', error)
        throw error
      }
    }

    throw new Error('Textract job timeout - exceeded maximum polling attempts')
  }

  /**
   * Extract text from Textract blocks
   */
  private static extractTextFromBlocks(blocks: Block[]): string {
    const text = blocks
      .filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .filter(Boolean)
      .join(' ')

    console.log('Extracted text length:', text.length)
    console.log('First 200 chars:', text.substring(0, 200))

    return text
  }

  /**
   * Extract invoice number - Pop Trading format: V01250724
   */
  private static extractInvoiceNumber(text: string): string | undefined {
    const patterns = [
      /\b(V\d{8})\b/,
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
   * Extract customer name - appears after "Debtor number" before "Pop Trading Company"
   */
  private static extractCustomerName(text: string): string | undefined {
    // Pattern 1: After debtor number before Pop Trading Company
    const pattern1 = /Debtor\s+number\s+\d+\s+(?:Your\s+VAT\s+[A-Z0-9]+\s+)?P\s+P\s+(.+?)\s+Pop\s+Trading\s+Company/i
    const match1 = text.match(pattern1)

    if (match1 && match1[1]) {
      let name = match1[1].trim()
      // Remove extra P markers
      name = name.replace(/P\s+P\s+/g, '').trim()

      if (name.length >= 3 && name.length <= 100) {
        return name
      }
    }

    // Pattern 2: Original pattern as fallback
    const pattern2 = /@[a-z0-9.-]+\.[a-z]{2,}\s+(.+?)\s+Invoice\s+number/i
    const match2 = text.match(pattern2)

    if (match2 && match2[1]) {
      let name = match2[1].trim()
      name = name.split(/\s{2,}/)[0]

      if (name.length >= 3 && name.length <= 100 &&
          !/\d{2}[-\/]/.test(name)) {
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

    if (/EUR|€/i.test(text)) currency = 'EUR'
    else if (/USD|\$/i.test(text)) currency = 'USD'
    else if (/AED/i.test(text)) currency = 'AED'

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

    let vatAmount: number | undefined
    const vatPercentMatch = text.match(/([\d.,]+)%\s+VAT\s+on\s+([\d.,]+)/i)

    if (vatPercentMatch) {
      const vatPercent = this.parseNumber(vatPercentMatch[1])
      const baseAmount = this.parseNumber(vatPercentMatch[2])
      vatAmount = (baseAmount * vatPercent) / 100

      if (vatAmount === 0 && totalAmount) {
        return { amount: totalAmount, currency, vatAmount: 0, totalAmount }
      }
    }

    const amount = totalAmount && vatAmount !== undefined
      ? totalAmount - vatAmount
      : totalAmount

    return { amount, currency, vatAmount, totalAmount }
  }

  /**
   * Parse European number format (1.534,00) to float
   */
  private static parseNumber(numStr: string): number {
    if (numStr.includes(',') && numStr.includes('.')) {
      if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else {
        numStr = numStr.replace(/,/g, '')
      }
    } else if (numStr.includes(',')) {
      if (/,\d{2}$/.test(numStr)) {
        numStr = numStr.replace(/\./g, '').replace(',', '.')
      } else {
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

    const invoiceDateMatch = text.match(/Invoice\s+date\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i)
    if (invoiceDateMatch) {
      invoiceDate = invoiceDateMatch[1]
    }

    if (invoiceDate) {
      const paymentTermsMatch = text.match(/Payment\s+within\s+(\d+)\s+days/i)
      if (paymentTermsMatch) {
        const days = parseInt(paymentTermsMatch[1])
        const parts = invoiceDate.split(/[-\/]/).map(Number)

        let day: number, month: number, year: number
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
   * Parse PDF invoice using AWS Textract async API
   */
  public static async parseInvoicePDF(
    pdfBuffer: Buffer,
    fileName: string = 'invoice.pdf'
  ): Promise<ExtractedInvoiceData> {
    let s3Bucket: string | undefined
    let s3Key: string | undefined

    const startTime = Date.now()
    console.log(`[Textract] Starting PDF processing for ${fileName}`)

    try {
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Invalid PDF buffer provided')
      }

      // Step 1: Upload to S3
      const s3StartTime = Date.now()
      const s3Location = await this.uploadToS3(pdfBuffer, fileName)
      s3Bucket = s3Location.bucket
      s3Key = s3Location.key
      console.log(`[Textract] S3 upload complete (${Date.now() - s3StartTime}ms)`)

      // Step 2: Start Textract job
      const jobStartTime = Date.now()
      const jobId = await this.startTextractJob(s3Bucket, s3Key)
      console.log(`[Textract] Job started: ${jobId} (${Date.now() - jobStartTime}ms)`)

      // Step 3: Poll until complete
      const pollStartTime = Date.now()
      const blocks = await this.pollTextractJob(jobId)
      console.log(`[Textract] Job completed after polling (${Date.now() - pollStartTime}ms)`)

      // Step 4: Extract text from blocks
      const extractStartTime = Date.now()
      const text = this.extractTextFromBlocks(blocks)
      console.log(`[Textract] Text extracted from blocks (${Date.now() - extractStartTime}ms)`)

      if (!text || text.trim().length === 0) {
        return {
          confidence: 0,
          rawText: '',
          currency: 'EUR'
        }
      }

      // Step 5: Extract all fields
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
        rawText: text.substring(0, 5000),
        s3Bucket,
        s3Key
      }

      extractedData.confidence = this.calculateConfidence(extractedData)

      const totalTime = Date.now() - startTime
      console.log(`[Textract] ✅ TOTAL TIME: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`)
      console.log('Textract async extraction complete:', {
        invoiceNumber: extractedData.invoiceNumber,
        customerName: extractedData.customerName,
        totalAmount: extractedData.totalAmount,
        confidence: extractedData.confidence,
        s3Location: `s3://${s3Bucket}/${s3Key}`
      })

      return extractedData

    } catch (error) {
      console.error('Textract async parsing error:', error)
      // On error, cleanup: Delete from S3
      if (s3Bucket && s3Key) {
        await this.deleteFromS3(s3Bucket, s3Key)
      }
      throw new Error(`Failed to parse PDF with Textract async: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
