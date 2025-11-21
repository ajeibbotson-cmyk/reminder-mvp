import { PrismaClient } from '@prisma/client'
import { Session } from 'next-auth'
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'

// ==========================================
// UNIFIED EMAIL SERVICE - AWS SES MVP
// ==========================================
// Purpose: Core service for invoice → email campaign workflow
// Email Provider: AWS SES (production infrastructure)
// Architecture: NextAuth + Prisma + AWS SES

// Configuration Schema
const UnifiedEmailConfigSchema = z.object({
  defaultBatchSize: z.number().min(1).max(50).default(5),
  defaultDelayBetweenBatches: z.number().min(1000).default(3000),
  maxDailyEmails: z.number().min(1).default(10000), // AWS SES quota
  defaultFromEmail: z.string().email(),
  awsRegion: z.string().default('me-south-1'), // UAE region
  enableProgressTracking: z.boolean().default(true),
  enableBusinessHours: z.boolean().default(true),
  enableArabicSupport: z.boolean().default(true)
})

type UnifiedEmailConfig = z.infer<typeof UnifiedEmailConfigSchema>

// Campaign Options Schema
const CampaignOptionsSchema = z.object({
  campaignName: z.string().min(1).max(100),
  emailSubject: z.string().min(1).max(200),
  emailContent: z.string().min(10),
  language: z.enum(['ENGLISH', 'ARABIC']).default('ENGLISH'),
  templateId: z.string().uuid().optional(),

  // Sending configuration
  sendingOptions: z.object({
    scheduleFor: z.date().optional(), // Immediate or scheduled
    respectBusinessHours: z.boolean().default(true),
    batchSize: z.number().min(1).max(50).default(5),
    delayBetweenBatches: z.number().min(1000).default(3000),
    attachInvoicePdf: z.boolean().default(true) // Attach invoice PDF from S3
  }).default({}),

  // Personalization
  personalization: z.object({
    enableMergeTags: z.boolean().default(true),
    customFields: z.record(z.any()).optional(),
    fallbackContent: z.string().optional()
  }).default({})
})

type CampaignOptions = z.infer<typeof CampaignOptionsSchema>

// Progress Callback Types
interface CampaignProgress {
  campaignId: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  currentBatch: number
  totalBatches: number
  percentComplete: number
  estimatedTimeRemaining?: string
  lastEmailSentAt?: Date
  status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused'
}

interface EmailSendResult {
  recipientEmail: string
  invoiceId: string
  status: 'sent' | 'failed'
  messageId?: string
  errorMessage?: string
  sentAt: Date
}

type ProgressCallback = (progress: CampaignProgress) => void
type EmailResultCallback = (result: EmailSendResult) => void

// Validation Results
interface ValidationResult {
  isValid: boolean
  validEmails: number
  invalidEmails: number
  suppressedEmails: number
  duplicateEmails: number
  issues: ValidationIssue[]
}

interface ValidationIssue {
  type: 'invalid_email' | 'suppressed_email' | 'duplicate_email' | 'missing_data'
  invoiceId: string
  email: string
  message: string
}

// Campaign Send Results
interface SendResults {
  campaignId: string
  totalSent: number
  totalFailed: number
  successRate: number
  duration: string
  results: EmailSendResult[]
}

// ==========================================
// SYSTEM SESSION HELPER
// ==========================================

/**
 * Create a system session for background jobs (auto-send, cron tasks)
 * Used when operations run without a user session
 */
export function createSystemSession(companyId: string, userId?: string): Session {
  return {
    user: {
      id: userId || 'system',
      email: 'system@reminder.internal',
      name: 'System',
      companyId: companyId,
      role: 'ADMIN' as any
    },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString() // 1 hour
  }
}

// ==========================================
// UNIFIED EMAIL SERVICE CLASS
// ==========================================

export class UnifiedEmailService {
  private prisma: PrismaClient
  private session: Session | null
  private config: UnifiedEmailConfig
  private sesClient: SESClient
  private s3Client: S3Client

  constructor(
    prisma: PrismaClient,
    session: Session | null,  // Now optional for system operations
    config: Partial<UnifiedEmailConfig> = {}
  ) {
    this.prisma = prisma
    this.session = session

    // Validate session is required for the config
    const defaultFromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@reminder.com'

    this.config = UnifiedEmailConfigSchema.parse({
      defaultFromEmail,
      ...config
    })

    // Initialize AWS SES client
    this.sesClient = new SESClient({
      region: this.config.awsRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    })

    // Initialize AWS S3 client for PDF attachments
    this.s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || this.config.awsRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    })
  }

  // ==========================================
  // CORE CAMPAIGN METHODS
  // ==========================================

  /**
   * Create email campaign from selected invoices
   * Validates recipients, processes merge tags, creates campaign record
   */
  async createCampaignFromInvoices(
    invoiceIds: string[],
    options: CampaignOptions
  ): Promise<{ campaign: any; validation: ValidationResult; readyToSend: boolean }> {
    // Validate session and company access
    if (!this.session?.user?.companyId) {
      throw new Error('Invalid session or missing company ID')
    }

    const companyId = this.session.user.companyId
    const userId = this.session.user.id || 'system'

    try {
      // 1. Validate and parse options
      const validatedOptions = CampaignOptionsSchema.parse(options)

      // 2. Fetch invoices with customer data
      const invoices = await this.prisma.invoice.findMany({
        where: {
          id: { in: invoiceIds },
          companyId: companyId // Multi-tenant security
        },
        include: {
          customer: true,
          company: true
        }
      })

      if (invoices.length === 0) {
        throw new Error('No valid invoices found for the provided IDs')
      }

      // 3. Validate email recipients
      const validation = await this.validateCampaignRecipients(invoices)

      // 4. Process merge tags in template
      const processedTemplate = await this.processMergeTags(
        validatedOptions.emailContent,
        invoices[0] // Use first invoice for merge tag validation
      )

      // 5. Create campaign record
      const campaign = await this.prisma.invoiceCampaign.create({
        data: {
          companyId: companyId,
          name: validatedOptions.campaignName,
          emailSubject: validatedOptions.emailSubject,
          emailContent: validatedOptions.emailContent,
          language: validatedOptions.language,
          templateId: validatedOptions.templateId,
          status: 'draft',
          totalRecipients: validation.validEmails,
          batchSize: validatedOptions.sendingOptions.batchSize,
          delayBetweenBatches: validatedOptions.sendingOptions.delayBetweenBatches,
          respectBusinessHours: validatedOptions.sendingOptions.respectBusinessHours,
          attachInvoicePdf: validatedOptions.sendingOptions.attachInvoicePdf,
          scheduledFor: validatedOptions.sendingOptions.scheduleFor,
          createdBy: userId,  // Support both user and system sessions

          // Create associated email send records
          campaignEmailSends: {
            create: invoices
              .filter(invoice => invoice.customerEmail) // Only valid emails
              .map(invoice => ({
                companyId: companyId,
                invoiceId: invoice.id,
                customerId: invoice.customer?.id, // Get customer ID from included relation
                recipientEmail: invoice.customerEmail!,
                emailSubject: this.resolveSubjectMergeTags(validatedOptions.emailSubject, invoice),
                emailContent: this.resolveContentMergeTags(validatedOptions.emailContent, invoice),
                deliveryStatus: 'pending',
                language: validatedOptions.language
              }))
          }
        },
        include: {
          campaignEmailSends: true
        }
      })

      const readyToSend = validation.isValid && validation.validEmails > 0

      return {
        campaign,
        validation,
        readyToSend
      }

    } catch (error) {
      console.error('Campaign creation failed:', error)
      throw new Error(`Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute email campaign with real-time progress tracking
   * Sends emails in batches with rate limiting and progress callbacks
   */
  async sendCampaign(
    campaignId: string,
    progressCallback?: ProgressCallback,
    emailResultCallback?: EmailResultCallback
  ): Promise<SendResults> {
    // Validate campaign ownership and status
    const campaign = await this.prisma.invoiceCampaign.findFirst({
      where: {
        id: campaignId,
        companyId: this.session.user.companyId
      },
      include: {
        campaignEmailSends: {
          where: { deliveryStatus: 'pending' },
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                pdfS3Key: true,
                pdfS3Bucket: true
              }
            }
          }
        }
      }
    })

    if (!campaign) {
      throw new Error('Campaign not found or access denied')
    }

    if (campaign.status !== 'draft') {
      throw new Error(`Campaign cannot be sent. Current status: ${campaign.status}`)
    }

    const startTime = Date.now()
    const pendingEmails = campaign.campaignEmailSends
    const results: EmailSendResult[] = []

    try {
      // Update campaign status to sending
      await this.prisma.invoiceCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'sending',
          startedAt: new Date()
        }
      })

      // Calculate batch information
      const batchSize = campaign.batchSize
      const totalBatches = Math.ceil(pendingEmails.length / batchSize)
      let currentBatch = 0
      let sentCount = 0
      let failedCount = 0

      // Get attachment setting (default true for backward compatibility)
      const attachPdf = campaign.attachInvoicePdf ?? true

      // Process emails in batches
      for (let i = 0; i < pendingEmails.length; i += batchSize) {
        currentBatch++
        const batch = pendingEmails.slice(i, i + batchSize)

        // Send batch emails in parallel
        const batchPromises = batch.map(async (emailSend) => {
          try {
            const result = await this.sendSingleEmail(emailSend, attachPdf)

            // Update database record
            await this.prisma.campaignEmailSend.update({
              where: { id: emailSend.id },
              data: {
                deliveryStatus: result.status === 'sent' ? 'sent' : 'failed',
                sesMessageId: result.messageId,
                errorMessage: result.errorMessage,
                sentAt: result.status === 'sent' ? new Date() : null
              }
            })

            return result

          } catch (error) {
            const failedResult: EmailSendResult = {
              recipientEmail: emailSend.recipientEmail,
              invoiceId: emailSend.invoiceId,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              sentAt: new Date()
            }

            // Update database with failure
            await this.prisma.campaignEmailSend.update({
              where: { id: emailSend.id },
              data: {
                deliveryStatus: 'failed',
                errorMessage: failedResult.errorMessage,
                sentAt: new Date()
              }
            })

            return failedResult
          }
        })

        // Wait for batch completion
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // Update counters
        const batchSentCount = batchResults.filter(r => r.status === 'sent').length
        const batchFailedCount = batchResults.filter(r => r.status === 'failed').length
        sentCount += batchSentCount
        failedCount += batchFailedCount

        // Report batch results
        if (emailResultCallback) {
          batchResults.forEach(result => emailResultCallback(result))
        }

        // Report progress
        if (progressCallback) {
          const percentComplete = Math.round((currentBatch / totalBatches) * 100)
          const remainingBatches = totalBatches - currentBatch
          const avgBatchTime = (Date.now() - startTime) / currentBatch
          const estimatedTimeRemaining = remainingBatches > 0
            ? `${Math.round((remainingBatches * avgBatchTime) / 1000)} seconds`
            : undefined

          progressCallback({
            campaignId,
            totalRecipients: pendingEmails.length,
            sentCount,
            failedCount,
            currentBatch,
            totalBatches,
            percentComplete,
            estimatedTimeRemaining,
            lastEmailSentAt: new Date(),
            status: 'sending'
          })
        }

        // Delay between batches (except for last batch)
        if (currentBatch < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, campaign.delayBetweenBatches))
        }
      }

      // Update campaign completion
      const endTime = Date.now()
      const duration = `${Math.round((endTime - startTime) / 1000)} seconds`
      const successRate = Math.round((sentCount / pendingEmails.length) * 100)

      await this.prisma.invoiceCampaign.update({
        where: { id: campaignId },
        data: {
          status: failedCount === 0 ? 'completed' : 'completed_with_errors',
          completedAt: new Date(),
          sentCount: sentCount,
          failedCount: failedCount,
          successRate: successRate
        }
      })

      // Final progress update
      if (progressCallback) {
        progressCallback({
          campaignId,
          totalRecipients: pendingEmails.length,
          sentCount,
          failedCount,
          currentBatch: totalBatches,
          totalBatches,
          percentComplete: 100,
          lastEmailSentAt: new Date(),
          status: failedCount === 0 ? 'completed' : 'completed'
        })
      }

      return {
        campaignId,
        totalSent: sentCount,
        totalFailed: failedCount,
        successRate,
        duration,
        results
      }

    } catch (error) {
      // Update campaign status to failed
      await this.prisma.invoiceCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      throw error
    }
  }

  /**
   * Get real-time campaign progress
   */
  async getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
    const campaign = await this.prisma.invoiceCampaign.findFirst({
      where: {
        id: campaignId,
        companyId: this.session.user.companyId
      },
      include: {
        campaignEmailSends: {
          select: {
            deliveryStatus: true,
            sentAt: true
          }
        }
      }
    })

    if (!campaign) {
      throw new Error('Campaign not found or access denied')
    }

    const totalRecipients = campaign.totalRecipients
    const sentCount = campaign.campaignEmailSends.filter(s => s.deliveryStatus === 'sent').length
    const failedCount = campaign.campaignEmailSends.filter(s => s.deliveryStatus === 'failed').length
    const pendingCount = campaign.campaignEmailSends.filter(s => s.deliveryStatus === 'pending').length

    const percentComplete = totalRecipients > 0 ? Math.round(((sentCount + failedCount) / totalRecipients) * 100) : 0
    const currentBatch = Math.ceil((sentCount + failedCount) / campaign.batchSize)
    const totalBatches = Math.ceil(totalRecipients / campaign.batchSize)

    // Calculate estimated time remaining for active campaigns
    let estimatedTimeRemaining: string | undefined
    if (campaign.status === 'sending' && pendingCount > 0) {
      const remainingBatches = totalBatches - currentBatch
      const avgBatchTime = campaign.delayBetweenBatches + 2000 // Estimate 2 seconds per batch processing
      const remainingTime = remainingBatches * avgBatchTime
      estimatedTimeRemaining = `${Math.round(remainingTime / 1000)} seconds`
    }

    const lastSentEmail = campaign.campaignEmailSends
      .filter(s => s.sentAt)
      .sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())[0]

    return {
      campaignId,
      totalRecipients,
      sentCount,
      failedCount,
      currentBatch,
      totalBatches,
      percentComplete,
      estimatedTimeRemaining,
      lastEmailSentAt: lastSentEmail?.sentAt,
      status: campaign.status as any
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Validate email recipients for campaign
   */
  private async validateCampaignRecipients(invoices: any[]): Promise<ValidationResult> {
    const issues: ValidationIssue[] = []
    const emailSet = new Set<string>()
    let validEmails = 0
    let invalidEmails = 0
    let suppressedEmails = 0
    let duplicateEmails = 0

    // Check suppression list
    const suppressedEmailList = await this.prisma.emailSuppressionList.findMany({
      where: { companyId: this.session.user.companyId },
      select: { emailAddress: true }
    })
    const suppressedSet = new Set(suppressedEmailList.map(s => s.emailAddress.toLowerCase()))

    for (const invoice of invoices) {
      // Use denormalized customerEmail field (invoices have it directly)
      const email = invoice.customerEmail?.toLowerCase()

      // Missing email
      if (!email) {
        issues.push({
          type: 'missing_data',
          invoiceId: invoice.id,
          email: '',
          message: 'Customer email address is missing'
        })
        invalidEmails++
        continue
      }

      // Invalid email format
      if (!this.isValidEmail(email)) {
        issues.push({
          type: 'invalid_email',
          invoiceId: invoice.id,
          email,
          message: 'Invalid email address format'
        })
        invalidEmails++
        continue
      }

      // Suppressed email
      if (suppressedSet.has(email)) {
        issues.push({
          type: 'suppressed_email',
          invoiceId: invoice.id,
          email,
          message: 'Email address is on suppression list'
        })
        suppressedEmails++
        continue
      }

      // Duplicate email
      if (emailSet.has(email)) {
        issues.push({
          type: 'duplicate_email',
          invoiceId: invoice.id,
          email,
          message: 'Duplicate email address in campaign'
        })
        duplicateEmails++
        continue
      }

      emailSet.add(email)
      validEmails++
    }

    return {
      isValid: validEmails > 0 && issues.length === 0,
      validEmails,
      invalidEmails,
      suppressedEmails,
      duplicateEmails,
      issues
    }
  }

  /**
   * Determine Reply-To email address for invoice reminder
   * Priority: Customer override > Company default > Invoice customer email
   */
  private async getReplyToAddress(invoice: any): Promise<string | undefined> {
    try {
      // Get company email settings
      const company = await this.prisma.company.findUnique({
        where: { id: invoice.companyId },
        select: { emailSettings: true }
      })

      const emailSettings = company?.emailSettings as any
      const companyReplyTo = emailSettings?.replyTo

      // If company has a default Reply-To configured, use it
      if (companyReplyTo && typeof companyReplyTo === 'string' && companyReplyTo.includes('@')) {
        return companyReplyTo
      }

      // Otherwise, use the customer's email as Reply-To (they reply to themselves)
      // This makes sense for B2B invoicing where customer knows the context
      if (invoice.customerEmail && invoice.customerEmail.includes('@')) {
        return invoice.customerEmail
      }

      // No Reply-To configured
      return undefined
    } catch (error) {
      console.error('Error determining Reply-To address:', error)
      return undefined
    }
  }

  /**
   * Fetch PDF from S3 for email attachment
   */
  private async fetchPdfFromS3(s3Key: string, s3Bucket: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key
      })

      const response = await this.s3Client.send(command)

      if (!response.Body) {
        console.error(`S3 PDF fetch failed: No body for ${s3Key}`)
        return null
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks)
    } catch (error) {
      console.error(`S3 PDF fetch error for ${s3Key}:`, error)
      return null
    }
  }

  /**
   * Build MIME email with PDF attachment
   * AWS SES requires raw MIME format for attachments
   */
  private buildMimeEmailWithAttachment(
    to: string,
    subject: string,
    htmlBody: string,
    pdfBuffer: Buffer,
    pdfFileName: string,
    replyTo?: string
  ): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Email headers
    const headers = [
      `From: ${this.config.defaultFromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`
    ].join('\r\n')

    // HTML body part
    const htmlPart = [
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlBody,
      ``
    ].join('\r\n')

    // PDF attachment part
    const base64Pdf = pdfBuffer.toString('base64')
    const attachmentPart = [
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFileName}"`,
      `Content-Description: ${pdfFileName}`,
      `Content-Disposition: attachment; filename="${pdfFileName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      base64Pdf,
      ``
    ].join('\r\n')

    // Final boundary
    const endBoundary = `--${boundary}--`

    return [headers, '', htmlPart, attachmentPart, endBoundary].join('\r\n')
  }

  /**
   * Send single email via AWS SES (with optional PDF attachment)
   */
  private async sendSingleEmail(emailSend: any, attachPdf: boolean = true): Promise<EmailSendResult> {
    try {
      // Check if we should attach PDF and if PDF is available
      const invoice = emailSend.invoice
      const shouldAttachPdf = attachPdf && invoice?.pdfS3Key && invoice?.pdfS3Bucket

      // Determine Reply-To address for this email
      const replyTo = await this.getReplyToAddress(invoice)

      let response: any

      if (shouldAttachPdf) {
        // Fetch PDF from S3
        const pdfBuffer = await this.fetchPdfFromS3(invoice.pdfS3Key, invoice.pdfS3Bucket)

        if (pdfBuffer) {
          // Build MIME email with attachment
          const pdfFileName = `invoice-${invoice.number || invoice.id}.pdf`
          const rawMessage = this.buildMimeEmailWithAttachment(
            emailSend.recipientEmail,
            emailSend.emailSubject,
            emailSend.emailContent,
            pdfBuffer,
            pdfFileName,
            replyTo
          )

          // Send using SendRawEmailCommand
          const rawCommand = new SendRawEmailCommand({
            RawMessage: {
              Data: Buffer.from(rawMessage)
            }
          })

          response = await this.sesClient.send(rawCommand)
          console.log(`Email sent with PDF attachment: ${pdfFileName} to ${emailSend.recipientEmail}${replyTo ? ` (Reply-To: ${replyTo})` : ''}`)
        } else {
          // PDF fetch failed, send without attachment
          console.warn(`PDF fetch failed for invoice ${invoice.id}, sending email without attachment`)
          response = await this.sendEmailWithoutAttachment(emailSend, replyTo)
        }
      } else {
        // Send without attachment
        response = await this.sendEmailWithoutAttachment(emailSend, replyTo)
      }

      return {
        recipientEmail: emailSend.recipientEmail,
        invoiceId: emailSend.invoiceId,
        status: 'sent',
        messageId: response.MessageId,
        sentAt: new Date()
      }

    } catch (error) {
      console.error('SES send error:', error)
      return {
        recipientEmail: emailSend.recipientEmail,
        invoiceId: emailSend.invoiceId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'AWS SES send failed',
        sentAt: new Date()
      }
    }
  }

  /**
   * Send email without attachment using standard SES command
   */
  private async sendEmailWithoutAttachment(emailSend: any, replyTo?: string): Promise<any> {
    const command = new SendEmailCommand({
      Source: this.config.defaultFromEmail,
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      Destination: {
        ToAddresses: [emailSend.recipientEmail]
      },
      Message: {
        Subject: {
          Data: emailSend.emailSubject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: emailSend.emailContent,
            Charset: 'UTF-8'
          }
        }
      }
    })

    return await this.sesClient.send(command)
  }

  /**
   * Process merge tags in email template
   */
  private async processMergeTags(template: string, sampleInvoice: any): Promise<string> {
    // Extract merge tags from template
    const mergeTags = template.match(/\{\{([^}]+)\}\}/g) || []

    // Validate merge tags against available data
    const availableFields = this.getAvailableMergeFields(sampleInvoice)
    const invalidTags = mergeTags.filter(tag => {
      const fieldName = tag.replace(/[{}]/g, '')
      return !availableFields.includes(fieldName)
    })

    if (invalidTags.length > 0) {
      throw new Error(`Invalid merge tags found: ${invalidTags.join(', ')}`)
    }

    return template
  }

  /**
   * Resolve subject line merge tags
   */
  private resolveSubjectMergeTags(subject: string, invoice: any): string {
    return subject
      .replace(/\{\{invoiceNumber\}\}/g, invoice.number || '')
      .replace(/\{\{customerName\}\}/g, invoice.customerName || invoice.customer?.name || '')
      .replace(/\{\{amount\}\}/g, invoice.amount?.toString() || invoice.amountAed?.toString() || '')
      .replace(/\{\{companyName\}\}/g, invoice.company?.name || '')
  }

  /**
   * Resolve content merge tags
   */
  private resolveContentMergeTags(content: string, invoice: any): string {
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''
    const daysPastDue = invoice.dueDate ?
      Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0

    return content
      .replace(/\{\{invoiceNumber\}\}/g, invoice.number || '')
      .replace(/\{\{customerName\}\}/g, invoice.customerName || invoice.customer?.name || '')
      .replace(/\{\{amount\}\}/g, invoice.amount?.toString() || invoice.amountAed?.toString() || '')
      .replace(/\{\{dueDate\}\}/g, dueDate)
      .replace(/\{\{daysPastDue\}\}/g, daysPastDue.toString())
      .replace(/\{\{companyName\}\}/g, invoice.company?.name || '')
      .replace(/\{\{customerEmail\}\}/g, invoice.customerEmail || invoice.customer?.email || '')
  }

  /**
   * Get available merge tag fields
   */
  private getAvailableMergeFields(invoice: any): string[] {
    return [
      'invoiceNumber',
      'customerName',
      'amount',
      'dueDate',
      'daysPastDue',
      'companyName',
      'customerEmail'
    ]
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

// ==========================================
// SINGLETON INSTANCE CREATOR
// ==========================================

/**
 * Create UnifiedEmailService instance with session validation
 * Now supports both user sessions and system sessions for auto-send
 */
export async function createUnifiedEmailService(
  session: Session | null,
  config: Partial<UnifiedEmailConfig> = {}
): Promise<UnifiedEmailService> {
  if (!session?.user?.companyId) {
    throw new Error('Valid session with company ID required')
  }

  // Get Prisma instance (assuming singleton pattern)
  const { prisma } = await import('@/lib/prisma')

  // Set default configuration
  const defaultConfig: Partial<UnifiedEmailConfig> = {
    defaultFromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@reminder.com',
    awsRegion: 'me-south-1', // UAE region
    defaultBatchSize: 5,
    defaultDelayBetweenBatches: 3000,
    maxDailyEmails: 10000, // AWS SES quota
    ...config
  }

  return new UnifiedEmailService(prisma, session, defaultConfig)
}

export default UnifiedEmailService