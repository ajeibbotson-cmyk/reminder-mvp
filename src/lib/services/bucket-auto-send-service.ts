import { prisma } from '@/lib/prisma'
import { UnifiedEmailService, createSystemSession } from './unifiedEmailService'

/**
 * Bucket Auto-Send Service
 * Handles automatic email sending for buckets with auto-send enabled
 * Now integrated with UnifiedEmailService for proper campaign tracking
 */

interface AutoSendResult {
  success: boolean
  companiesProcessed: number
  bucketsProcessed: number
  campaignsCreated: number
  emailsSent: number
  errors: Array<{
    companyId: string
    bucketId: string
    error: string
  }>
}

/**
 * Check if current time matches bucket send schedule
 */
function shouldSendNow(config: any): boolean {
  const now = new Date()

  // Get UAE time (UTC+4)
  const uaeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const currentHour = uaeTime.getHours()
  const currentDay = uaeTime.getDay() // 0 = Sunday, 6 = Saturday

  // Check if current hour matches send time
  if (currentHour !== config.sendTimeHour) {
    return false
  }

  // Check if today is in send days
  const sendDays = Array.isArray(config.sendDaysOfWeek)
    ? config.sendDaysOfWeek
    : JSON.parse(config.sendDaysOfWeek as string)

  if (!sendDays.includes(currentDay)) {
    return false
  }

  // Check if already sent today
  if (config.lastAutoSendAt) {
    const lastSend = new Date(config.lastAutoSendAt)
    const today = new Date(uaeTime.toDateString())

    if (lastSend >= today) {
      return false // Already sent today
    }
  }

  return true
}

/**
 * Get invoices for a specific bucket
 */
async function getBucketInvoices(companyId: string, bucketId: string): Promise<string[]> {
  const now = new Date()

  // Map bucket IDs to day ranges
  const bucketRanges: Record<string, { min: number; max: number | null }> = {
    'not_due': { min: -999, max: 0 },
    'overdue_1_3': { min: 1, max: 3 },
    'overdue_4_7': { min: 4, max: 7 },
    'overdue_8_14': { min: 8, max: 14 },
    'overdue_15_30': { min: 15, max: 30 },
    'overdue_30_plus': { min: 31, max: null }
  }

  const range = bucketRanges[bucketId]
  if (!range) {
    throw new Error(`Unknown bucket ID: ${bucketId}`)
  }

  // Calculate date ranges
  const minDate = new Date(now.getTime() - range.min * 24 * 60 * 60 * 1000)
  const maxDate = range.max ? new Date(now.getTime() - range.max * 24 * 60 * 60 * 1000) : null

  // Query invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: companyId,
      status: { not: 'PAID' },
      dueDate: maxDate
        ? { lte: minDate, gte: maxDate }
        : { lte: minDate }
    },
    select: { id: true }
  })

  return invoices.map(inv => inv.id)
}

/**
 * Get default email template for bucket
 */
function getDefaultEmailTemplate(bucketId: string): { subject: string; content: string } {
  const templates: Record<string, { subject: string; content: string }> = {
    'not_due': {
      subject: 'Upcoming Payment Reminder: Invoice {{invoiceNumber}}',
      content: `Dear {{customerName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{amount}} will be due on {{dueDate}}.

Please ensure timely payment to avoid any inconvenience.

Thank you for your business.

Best regards,
{{companyName}} Team`
    },
    'overdue_1_3': {
      subject: 'Payment Reminder: Invoice {{invoiceNumber}} Now Overdue',
      content: `Dear {{customerName}},

We hope this message finds you well. This is a friendly reminder that invoice {{invoiceNumber}} is now {{daysPastDue}} days overdue.

Invoice Number: {{invoiceNumber}}
Amount: {{amount}}
Original Due Date: {{dueDate}}
Days Overdue: {{daysPastDue}}

We kindly request that you arrange payment at your earliest convenience.

Thank you for your business.

Best regards,
{{companyName}} Team`
    },
    'overdue_4_7': {
      subject: 'Important: Payment Reminder for Invoice {{invoiceNumber}}',
      content: `Dear {{customerName}},

We are writing to remind you that invoice {{invoiceNumber}} is now {{daysPastDue}} days overdue.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount: {{amount}}
- Original Due Date: {{dueDate}}
- Days Overdue: {{daysPastDue}}

Please arrange payment as soon as possible to avoid any service interruption.

If you have any questions or concerns, please don't hesitate to contact us.

Thank you for your prompt attention to this matter.

Best regards,
{{companyName}} Team`
    },
    'overdue_8_14': {
      subject: 'Urgent: Payment Required for Invoice {{invoiceNumber}}',
      content: `Dear {{customerName}},

This is an urgent reminder that invoice {{invoiceNumber}} is now significantly overdue ({{daysPastDue}} days).

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount: {{amount}}
- Original Due Date: {{dueDate}}
- Days Overdue: {{daysPastDue}}

Immediate payment is requested to maintain our business relationship and avoid further action.

Please contact us immediately if there are any issues preventing payment.

Best regards,
{{companyName}} Team`
    },
    'overdue_15_30': {
      subject: 'Final Notice: Payment Required for Invoice {{invoiceNumber}}',
      content: `Dear {{customerName}},

This is a final notice regarding the outstanding payment for invoice {{invoiceNumber}}, which is now {{daysPastDue}} days overdue.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount: {{amount}}
- Original Due Date: {{dueDate}}
- Days Overdue: {{daysPastDue}}

We must receive payment within the next 7 days to avoid further action, which may include:
- Suspension of services
- Referral to collections
- Legal proceedings

Please treat this matter with urgency and contact us immediately to arrange payment.

Best regards,
{{companyName}} Team`
    },
    'overdue_30_plus': {
      subject: 'Legal Notice: Immediate Payment Required - Invoice {{invoiceNumber}}',
      content: `Dear {{customerName}},

This is a formal notice regarding the severely overdue invoice {{invoiceNumber}}, which has been outstanding for {{daysPastDue}} days.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Amount: {{amount}}
- Original Due Date: {{dueDate}}
- Days Overdue: {{daysPastDue}}

IMMEDIATE ACTION REQUIRED:
This account is now being prepared for collection proceedings. Payment must be received within 3 business days to avoid:
- Referral to a collection agency
- Legal action to recover the debt
- Additional collection fees and legal costs
- Negative impact on business credit rating

This is your final opportunity to resolve this matter directly with us.

Please contact us immediately at {{customerEmail}} or arrange payment without delay.

Best regards,
{{companyName}} Legal Department`
    }
  }

  return templates[bucketId] || templates['overdue_1_3']
}

/**
 * Process auto-send for a single bucket
 * Now uses UnifiedEmailService for proper campaign tracking
 */
async function processAutoSendBucket(
  companyId: string,
  bucketId: string,
  config: any
): Promise<{ emailsSent: number; campaignId?: string }> {

  // Get invoices in this bucket
  const invoiceIds = await getBucketInvoices(companyId, bucketId)

  if (invoiceIds.length === 0) {
    console.log(`[Auto-Send] No invoices found for ${companyId}/${bucketId}`)
    return { emailsSent: 0 }
  }

  console.log(`[Auto-Send] Processing ${invoiceIds.length} invoices for ${companyId}/${bucketId}`)

  try {
    // Create system session for this company
    const systemSession = createSystemSession(companyId)

    // Initialize UnifiedEmailService with system session
    const emailService = new UnifiedEmailService(prisma, systemSession, {
      defaultFromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@reminder.com',
      awsRegion: process.env.AWS_REGION || 'me-south-1',
      defaultBatchSize: config.batchSize || 5,
      defaultDelayBetweenBatches: config.delayBetweenBatches || 3000
    })

    // Get email template (use custom template if configured, otherwise default)
    const template = getDefaultEmailTemplate(bucketId)

    // Create campaign using UnifiedEmailService
    const { campaign, validation } = await emailService.createCampaignFromInvoices(
      invoiceIds,
      {
        campaignName: `Auto-Send: ${bucketId} - ${new Date().toISOString()}`,
        emailSubject: template.subject,
        emailContent: template.content,
        language: 'ENGLISH',
        sendingOptions: {
          respectBusinessHours: true,
          batchSize: config.batchSize || 5,
          delayBetweenBatches: config.delayBetweenBatches || 3000,
          attachInvoicePdf: true // Always attach PDF for auto-send reminders
        },
        personalization: {
          enableMergeTags: true
        }
      }
    )

    console.log(`[Auto-Send] Campaign created: ${campaign.id} with ${validation.validEmails} valid recipients`)

    // Send campaign immediately
    const sendResult = await emailService.sendCampaign(campaign.id)

    console.log(`[Auto-Send] Campaign ${campaign.id} sent: ${sendResult.totalSent} emails sent, ${sendResult.totalFailed} failed`)

    // Update last send time
    await prisma.bucketConfig.update({
      where: {
        companyId_bucketId: {
          companyId: companyId,
          bucketId: bucketId
        }
      },
      data: {
        lastAutoSendAt: new Date()
      }
    })

    return {
      emailsSent: sendResult.totalSent,
      campaignId: campaign.id
    }

  } catch (error) {
    console.error(`[Auto-Send] Error processing bucket ${companyId}/${bucketId}:`, error)
    throw error
  }
}

/**
 * Main auto-send job
 * Processes all companies and buckets with auto-send enabled
 */
export async function processAutoSendJob(): Promise<AutoSendResult> {
  const result: AutoSendResult = {
    success: true,
    companiesProcessed: 0,
    bucketsProcessed: 0,
    campaignsCreated: 0,
    emailsSent: 0,
    errors: []
  }

  try {
    console.log('[Auto-Send] Starting auto-send job...')

    // Get all bucket configs with auto-send enabled
    const configs = await prisma.bucketConfig.findMany({
      where: {
        autoSendEnabled: true
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    })

    console.log(`[Auto-Send] Found ${configs.length} auto-send enabled bucket configs`)

    // Group by company
    const companiesMap = new Map<string, typeof configs>()
    for (const config of configs) {
      if (!config.company.isActive) {
        console.log(`[Auto-Send] Skipping inactive company: ${config.companyId}`)
        continue
      }

      const existing = companiesMap.get(config.companyId) || []
      companiesMap.set(config.companyId, [...existing, config])
    }

    console.log(`[Auto-Send] Processing ${companiesMap.size} active companies`)

    // Process each company
    for (const [companyId, companyConfigs] of companiesMap) {
      result.companiesProcessed++
      console.log(`[Auto-Send] Processing company: ${companyId} (${companyConfigs[0].company.name})`)

      for (const config of companyConfigs) {
        // Check if should send now
        if (!shouldSendNow(config)) {
          console.log(`[Auto-Send] Skipping ${config.bucketId} - not scheduled for now`)
          continue
        }

        console.log(`[Auto-Send] Processing bucket: ${config.bucketId}`)

        try {
          const bucketResult = await processAutoSendBucket(
            companyId,
            config.bucketId,
            config
          )

          result.bucketsProcessed++

          if (bucketResult.campaignId) {
            result.campaignsCreated++
          }

          result.emailsSent += bucketResult.emailsSent

          console.log(`[Auto-Send] Bucket ${config.bucketId} completed: ${bucketResult.emailsSent} emails sent`)

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          result.errors.push({
            companyId,
            bucketId: config.bucketId,
            error: errorMessage
          })

          console.error(`[Auto-Send] Error processing ${companyId}/${config.bucketId}:`, error)
        }
      }
    }

    result.success = result.errors.length === 0

    console.log(`[Auto-Send] Job completed: ${result.emailsSent} emails sent, ${result.errors.length} errors`)

    return result

  } catch (error) {
    console.error('[Auto-Send] Job failed:', error)
    result.success = false
    throw error
  }
}
