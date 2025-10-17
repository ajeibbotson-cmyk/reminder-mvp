import { PrismaClient } from '@prisma/client'
import { Session } from 'next-auth'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
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
    delayBetweenBatches: z.number().min(1000).default(3000)
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
// UNIFIED EMAIL SERVICE CLASS
// ==========================================

export class UnifiedEmailService {
  private prisma: PrismaClient
  private session: Session
  private config: UnifiedEmailConfig
  private sesClient: SESClient

  constructor(
    prisma: PrismaClient,
    session: Session,
    config: Partial<UnifiedEmailConfig> = {}
  ) {
    this.prisma = prisma
    this.session = session
    this.config = UnifiedEmailConfigSchema.parse(config)

    // Initialize AWS SES client
    this.sesClient = new SESClient({
      region: this.config.awsRegion,
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

    try {
      // 1. Validate and parse options
      const validatedOptions = CampaignOptionsSchema.parse(options)

      // 2. Fetch invoices with customer data
      const invoices = await this.prisma.invoices.findMany({
        where: {
          id: { in: invoiceIds },
          company_id: companyId // Multi-tenant security
        },
        include: {
          customer: true,
          companies: true
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
          company_id: companyId,
          name: validatedOptions.campaignName,
          email_subject: validatedOptions.emailSubject,
          email_content: validatedOptions.emailContent,
          language: validatedOptions.language,
          template_id: validatedOptions.templateId,
          status: 'draft',
          total_recipients: validation.validEmails,
          batch_size: validatedOptions.sendingOptions.batchSize,
          delay_between_batches: validatedOptions.sendingOptions.delayBetweenBatches,
          respect_business_hours: validatedOptions.sendingOptions.respectBusinessHours,
          scheduled_for: validatedOptions.sendingOptions.scheduleFor,
          created_by: this.session.user.id,

          // Create associated email send records
          campaign_email_sends: {
            create: invoices
              .filter(invoice => invoice.customer?.email) // Only valid emails
              .map(invoice => ({
                company_id: companyId,
                invoice_id: invoice.id,
                customer_id: invoice.customer_id,
                recipient_email: invoice.customer!.email!,
                email_subject: this.resolveSubjectMergeTags(validatedOptions.emailSubject, invoice),
                email_content: this.resolveContentMergeTags(validatedOptions.emailContent, invoice),
                delivery_status: 'pending',
                language: validatedOptions.language
              }))
          }
        },
        include: {
          campaign_email_sends: true
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
        company_id: this.session.user.companyId
      },
      include: {
        campaign_email_sends: {
          where: { delivery_status: 'pending' }
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
    const pendingEmails = campaign.campaign_email_sends
    const results: EmailSendResult[] = []

    try {
      // Update campaign status to sending
      await this.prisma.invoiceCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'sending',
          started_at: new Date()
        }
      })

      // Calculate batch information
      const batchSize = campaign.batch_size
      const totalBatches = Math.ceil(pendingEmails.length / batchSize)
      let currentBatch = 0
      let sentCount = 0
      let failedCount = 0

      // Process emails in batches
      for (let i = 0; i < pendingEmails.length; i += batchSize) {
        currentBatch++
        const batch = pendingEmails.slice(i, i + batchSize)

        // Send batch emails in parallel
        const batchPromises = batch.map(async (emailSend) => {
          try {
            const result = await this.sendSingleEmail(emailSend)

            // Update database record
            await this.prisma.campaignEmailSend.update({
              where: { id: emailSend.id },
              data: {
                delivery_status: result.status === 'sent' ? 'sent' : 'failed',
                ses_message_id: result.messageId,
                error_message: result.errorMessage,
                sent_at: result.status === 'sent' ? new Date() : null
              }
            })

            return result

          } catch (error) {
            const failedResult: EmailSendResult = {
              recipientEmail: emailSend.recipient_email,
              invoiceId: emailSend.invoice_id,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              sentAt: new Date()
            }

            // Update database with failure
            await this.prisma.campaignEmailSend.update({
              where: { id: emailSend.id },
              data: {
                delivery_status: 'failed',
                error_message: failedResult.errorMessage,
                sent_at: new Date()
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
          await new Promise(resolve => setTimeout(resolve, campaign.delay_between_batches))
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
          completed_at: new Date(),
          sent_count: sentCount,
          failed_count: failedCount,
          success_rate: successRate
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
          completed_at: new Date(),
          error_message: error instanceof Error ? error.message : 'Unknown error'
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
        company_id: this.session.user.companyId
      },
      include: {
        campaign_email_sends: {
          select: {
            delivery_status: true,
            sent_at: true
          }
        }
      }
    })

    if (!campaign) {
      throw new Error('Campaign not found or access denied')
    }

    const totalRecipients = campaign.total_recipients
    const sentCount = campaign.campaign_email_sends.filter(s => s.delivery_status === 'sent').length
    const failedCount = campaign.campaign_email_sends.filter(s => s.delivery_status === 'failed').length
    const pendingCount = campaign.campaign_email_sends.filter(s => s.delivery_status === 'pending').length

    const percentComplete = totalRecipients > 0 ? Math.round(((sentCount + failedCount) / totalRecipients) * 100) : 0
    const currentBatch = Math.ceil((sentCount + failedCount) / campaign.batch_size)
    const totalBatches = Math.ceil(totalRecipients / campaign.batch_size)

    // Calculate estimated time remaining for active campaigns
    let estimatedTimeRemaining: string | undefined
    if (campaign.status === 'sending' && pendingCount > 0) {
      const remainingBatches = totalBatches - currentBatch
      const avgBatchTime = campaign.delay_between_batches + 2000 // Estimate 2 seconds per batch processing
      const remainingTime = remainingBatches * avgBatchTime
      estimatedTimeRemaining = `${Math.round(remainingTime / 1000)} seconds`
    }

    const lastSentEmail = campaign.campaign_email_sends
      .filter(s => s.sent_at)
      .sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime())[0]

    return {
      campaignId,
      totalRecipients,
      sentCount,
      failedCount,
      currentBatch,
      totalBatches,
      percentComplete,
      estimatedTimeRemaining,
      lastEmailSentAt: lastSentEmail?.sent_at,
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
    const suppressedEmailList = await this.prisma.emailSuppression.findMany({
      where: { company_id: this.session.user.companyId },
      select: { email: true }
    })
    const suppressedSet = new Set(suppressedEmailList.map(s => s.email.toLowerCase()))

    for (const invoice of invoices) {
      const email = invoice.customer?.email?.toLowerCase()

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
   * Send single email via AWS SES
   */
  private async sendSingleEmail(emailSend: any): Promise<EmailSendResult> {
    try {
      const command = new SendEmailCommand({
        Source: this.config.defaultFromEmail,
        Destination: {
          ToAddresses: [emailSend.recipient_email]
        },
        Message: {
          Subject: {
            Data: emailSend.email_subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: emailSend.email_content,
              Charset: 'UTF-8'
            }
          }
        }
      })

      const response = await this.sesClient.send(command)

      return {
        recipientEmail: emailSend.recipient_email,
        invoiceId: emailSend.invoice_id,
        status: 'sent',
        messageId: response.MessageId,
        sentAt: new Date()
      }

    } catch (error) {
      console.error('SES send error:', error)
      return {
        recipientEmail: emailSend.recipient_email,
        invoiceId: emailSend.invoice_id,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'AWS SES send failed',
        sentAt: new Date()
      }
    }
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
      .replace(/\{\{customerName\}\}/g, invoice.customer?.name || '')
      .replace(/\{\{amount\}\}/g, invoice.amount_aed?.toString() || '')
      .replace(/\{\{companyName\}\}/g, invoice.company?.name || '')
  }

  /**
   * Resolve content merge tags
   */
  private resolveContentMergeTags(content: string, invoice: any): string {
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : ''
    const daysPastDue = invoice.due_date ?
      Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 0

    return content
      .replace(/\{\{invoiceNumber\}\}/g, invoice.number || '')
      .replace(/\{\{customerName\}\}/g, invoice.customer?.name || '')
      .replace(/\{\{amount\}\}/g, invoice.amount_aed?.toString() || '')
      .replace(/\{\{dueDate\}\}/g, dueDate)
      .replace(/\{\{daysPastDue\}\}/g, daysPastDue.toString())
      .replace(/\{\{companyName\}\}/g, invoice.company?.name || '')
      .replace(/\{\{customerEmail\}\}/g, invoice.customer?.email || '')
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