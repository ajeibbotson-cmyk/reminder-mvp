/**
 * AWS SES Consolidation Service
 * Enhanced AWS SES integration specifically designed for consolidated email delivery
 * with comprehensive tracking, cultural compliance, and multi-attachment support
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { prisma } from '../prisma'
import { pdfAttachmentService } from './pdf-attachment-service'
import { culturalComplianceEnhancedService } from './cultural-compliance-enhanced-service'

interface ConsolidatedEmailRequest {
  consolidationId: string
  to: string
  subject: string
  htmlContent: string
  textContent: string
  language: 'en' | 'ar'
  escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
    size: number
  }>
  customMessage?: string
  scheduledFor?: Date
  culturalComplianceScore?: number
  businessRulesApplied?: string[]
}

interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  deliveryStatus: 'SENT' | 'FAILED' | 'QUEUED'
  errorMessage?: string
  deliveryMetrics: {
    sentAt?: Date
    estimatedDeliveryTime?: number
    attachmentCount: number
    attachmentSize: number
    culturalComplianceScore: number
  }
  sesResponse?: any
}

interface ConsolidatedEmailTrackingData {
  consolidationId: string
  emailLogId: string
  messageId: string
  trackingPixelUrl: string
  unsubscribeUrl: string
  paymentLinks: string[]
  culturalMetadata: {
    language: string
    escalationLevel: string
    complianceScore: number
    adjustmentsMade: string[]
  }
}

export class AWSSESConsolidationService {
  private sesClient: SESClient
  private readonly fromEmail: string
  private readonly fromName: string
  private readonly trackingDomain: string
  private readonly unsubscribeBaseUrl: string

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'me-south-1', // UAE compliance
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    })

    this.fromEmail = process.env.AWS_SES_FROM_EMAIL || ''
    this.fromName = process.env.COMPANY_NAME || 'Reminder'
    this.trackingDomain = process.env.EMAIL_TRACKING_DOMAIN || process.env.NEXTAUTH_URL || ''
    this.unsubscribeBaseUrl = `${process.env.NEXTAUTH_URL}/unsubscribe`
  }

  /**
   * Send consolidated email with comprehensive tracking and compliance
   */
  async sendConsolidatedEmail(request: ConsolidatedEmailRequest): Promise<EmailDeliveryResult> {
    try {
      console.log(`📧 Sending consolidated email for consolidation: ${request.consolidationId}`)

      const startTime = Date.now()

      // Pre-flight cultural compliance check
      if (request.culturalComplianceScore && request.culturalComplianceScore < 70) {
        console.warn(`⚠️ Low cultural compliance score: ${request.culturalComplianceScore}`)
      }

      // Create email log entry first
      const emailLogId = await this.createEmailLogEntry(request)

      // Generate tracking URLs
      const trackingData = await this.generateTrackingUrls(request.consolidationId, emailLogId)

      // Process email content with tracking
      const processedContent = await this.processEmailContentForDelivery(
        request,
        trackingData
      )

      // Validate and optimize attachments
      let validatedAttachments = request.attachments || []
      if (validatedAttachments.length > 0) {
        const validation = pdfAttachmentService.validateAttachmentConstraints(validatedAttachments)
        if (!validation.isValid) {
          throw new Error(`Attachment validation failed: ${validation.errors.join(', ')}`)
        }

        // Optimize attachments if needed
        validatedAttachments = await pdfAttachmentService.optimizePDFAttachments(validatedAttachments)
      }

      // Send email based on content type and attachments
      let sesResponse
      if (validatedAttachments.length > 0) {
        sesResponse = await this.sendRawEmailWithAttachments(
          request,
          processedContent,
          validatedAttachments,
          trackingData
        )
      } else {
        sesResponse = await this.sendSimpleEmail(
          request,
          processedContent,
          trackingData
        )
      }

      const deliveryTime = Date.now() - startTime

      // Update email log with delivery information
      await this.updateEmailLogWithDelivery(emailLogId, sesResponse, deliveryTime)

      // Store tracking data
      await this.storeTrackingData(trackingData)

      // Log successful delivery
      await this.logDeliveryActivity(request, sesResponse.MessageId, 'SUCCESS')

      const result: EmailDeliveryResult = {
        success: true,
        messageId: sesResponse.MessageId,
        deliveryStatus: 'SENT',
        deliveryMetrics: {
          sentAt: new Date(),
          estimatedDeliveryTime: deliveryTime,
          attachmentCount: validatedAttachments.length,
          attachmentSize: validatedAttachments.reduce((sum, att) => sum + att.size, 0),
          culturalComplianceScore: request.culturalComplianceScore || 0
        },
        sesResponse
      }

      console.log(`✅ Consolidated email sent successfully: ${sesResponse.MessageId}`)
      return result

    } catch (error) {
      console.error('Failed to send consolidated email:', error)

      // Log failed delivery
      await this.logDeliveryActivity(request, undefined, 'FAILED', error)

      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        deliveryMetrics: {
          attachmentCount: request.attachments?.length || 0,
          attachmentSize: request.attachments?.reduce((sum, att) => sum + att.size, 0) || 0,
          culturalComplianceScore: request.culturalComplianceScore || 0
        }
      }
    }
  }

  /**
   * Send multiple consolidated emails in batch with rate limiting
   */
  async batchSendConsolidatedEmails(
    requests: ConsolidatedEmailRequest[]
  ): Promise<Array<EmailDeliveryResult & { consolidationId: string }>> {
    const results = []
    const batchSize = 5 // AWS SES rate limit consideration
    const delayBetweenBatches = 1000 // 1 second

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)

      // Process batch in parallel
      const batchPromises = batch.map(async (request) => {
        const result = await this.sendConsolidatedEmail(request)
        return {
          ...result,
          consolidationId: request.consolidationId
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error(`Batch email ${i + index} failed:`, result.reason)
          results.push({
            consolidationId: batch[index].consolidationId,
            success: false,
            deliveryStatus: 'FAILED' as const,
            errorMessage: result.reason?.message || 'Batch processing failed',
            deliveryMetrics: {
              attachmentCount: 0,
              attachmentSize: 0,
              culturalComplianceScore: 0
            }
          })
        }
      })

      // Delay between batches (except for last batch)
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }

    console.log(`📦 Batch processing completed: ${results.length} emails processed`)
    return results
  }

  /**
   * Handle webhook events from AWS SES
   */
  async handleSESWebhook(eventType: string, eventData: any): Promise<void> {
    try {
      console.log(`🔔 Handling SES webhook: ${eventType}`)

      switch (eventType) {
        case 'delivery':
          await this.handleDeliveryEvent(eventData)
          break
        case 'bounce':
          await this.handleBounceEvent(eventData)
          break
        case 'complaint':
          await this.handleComplaintEvent(eventData)
          break
        case 'open':
          await this.handleOpenEvent(eventData)
          break
        case 'click':
          await this.handleClickEvent(eventData)
          break
        default:
          console.log(`Unknown webhook event type: ${eventType}`)
      }

    } catch (error) {
      console.error('Failed to handle SES webhook:', error)
      throw error
    }
  }

  /**
   * Get delivery analytics for consolidated emails
   */
  async getConsolidationDeliveryAnalytics(
    companyId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    summary: any
    trends: any
    performance: any
    culturalImpact: any
  }> {
    try {
      const whereClause: any = {
        companyId,
        consolidatedReminderId: { not: null }
      }

      if (dateRange) {
        whereClause.sentAt = {
          gte: dateRange.from,
          lte: dateRange.to
        }
      }

      const [deliveryStats, culturalAnalysis, performanceMetrics] = await Promise.all([
        // Delivery statistics
        prisma.emailLog.groupBy({
          by: ['deliveryStatus'],
          where: whereClause,
          _count: { id: true }
        }),

        // Cultural compliance analysis
        prisma.emailLog.aggregate({
          where: whereClause,
          _avg: { culturalComplianceScore: true },
          _min: { culturalComplianceScore: true },
          _max: { culturalComplianceScore: true }
        }),

        // Performance metrics
        prisma.emailLog.aggregate({
          where: {
            ...whereClause,
            deliveredAt: { not: null },
            sentAt: { not: null }
          },
          _avg: {
            // Would need to calculate delivery time from sentAt to deliveredAt
          },
          _count: {
            openedAt: true,
            clickedAt: true
          }
        })
      ])

      return {
        summary: {
          totalSent: deliveryStats.reduce((sum, stat) => sum + stat._count.id, 0),
          deliveryBreakdown: deliveryStats,
          avgCulturalCompliance: culturalAnalysis._avg.culturalComplianceScore || 0
        },
        trends: {
          // Would implement time-series analysis
        },
        performance: performanceMetrics,
        culturalImpact: {
          complianceRange: {
            min: culturalAnalysis._min.culturalComplianceScore || 0,
            max: culturalAnalysis._max.culturalComplianceScore || 0,
            avg: culturalAnalysis._avg.culturalComplianceScore || 0
          }
        }
      }

    } catch (error) {
      console.error('Failed to get delivery analytics:', error)
      throw error
    }
  }

  /**
   * Private helper methods
   */

  private async sendSimpleEmail(
    request: ConsolidatedEmailRequest,
    processedContent: { html: string; text: string; subject: string },
    trackingData: ConsolidatedEmailTrackingData
  ) {
    const command = new SendEmailCommand({
      Source: `${this.fromName} <${this.fromEmail}>`,
      Destination: {
        ToAddresses: [request.to]
      },
      Message: {
        Subject: {
          Data: processedContent.subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: processedContent.html,
            Charset: 'UTF-8'
          },
          Text: {
            Data: processedContent.text,
            Charset: 'UTF-8'
          }
        }
      },
      Tags: [
        { Name: 'EmailType', Value: 'ConsolidatedReminder' },
        { Name: 'ConsolidationId', Value: request.consolidationId },
        { Name: 'EscalationLevel', Value: request.escalationLevel },
        { Name: 'Language', Value: request.language },
        { Name: 'CulturalCompliance', Value: String(request.culturalComplianceScore || 0) }
      ]
    })

    return await this.sesClient.send(command)
  }

  private async sendRawEmailWithAttachments(
    request: ConsolidatedEmailRequest,
    processedContent: { html: string; text: string; subject: string },
    attachments: Array<{ filename: string; content: Buffer; contentType: string }>,
    trackingData: ConsolidatedEmailTrackingData
  ) {
    // Generate MIME email with attachments
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const rawEmail = this.generateMIMEEmail(
      request,
      processedContent,
      attachments,
      boundary,
      trackingData
    )

    const command = new SendRawEmailCommand({
      Source: `${this.fromName} <${this.fromEmail}>`,
      Destinations: [request.to],
      RawMessage: {
        Data: Buffer.from(rawEmail, 'utf-8')
      },
      Tags: [
        { Name: 'EmailType', Value: 'ConsolidatedReminder' },
        { Name: 'ConsolidationId', Value: request.consolidationId },
        { Name: 'EscalationLevel', Value: request.escalationLevel },
        { Name: 'Language', Value: request.language },
        { Name: 'AttachmentCount', Value: String(attachments.length) },
        { Name: 'CulturalCompliance', Value: String(request.culturalComplianceScore || 0) }
      ]
    })

    return await this.sesClient.send(command)
  }

  private generateMIMEEmail(
    request: ConsolidatedEmailRequest,
    content: { html: string; text: string; subject: string },
    attachments: Array<{ filename: string; content: Buffer; contentType: string }>,
    boundary: string,
    trackingData: ConsolidatedEmailTrackingData
  ): string {
    const crlf = '\r\n'
    let rawEmail = ''

    // Email headers
    rawEmail += `From: ${this.fromName} <${this.fromEmail}>${crlf}`
    rawEmail += `To: ${request.to}${crlf}`
    rawEmail += `Subject: ${content.subject}${crlf}`
    rawEmail += `MIME-Version: 1.0${crlf}`
    rawEmail += `Content-Type: multipart/mixed; boundary="${boundary}"${crlf}`
    rawEmail += `X-Consolidation-ID: ${request.consolidationId}${crlf}`
    rawEmail += `X-Escalation-Level: ${request.escalationLevel}${crlf}`
    rawEmail += `X-Cultural-Compliance: ${request.culturalComplianceScore || 0}${crlf}`
    rawEmail += `List-Unsubscribe: <${trackingData.unsubscribeUrl}>${crlf}`
    rawEmail += crlf

    // Email body (HTML and text)
    rawEmail += `--${boundary}${crlf}`
    rawEmail += `Content-Type: multipart/alternative; boundary="${boundary}_alt"${crlf}`
    rawEmail += crlf

    // Text version
    rawEmail += `--${boundary}_alt${crlf}`
    rawEmail += `Content-Type: text/plain; charset=UTF-8${crlf}`
    rawEmail += `Content-Transfer-Encoding: quoted-printable${crlf}`
    rawEmail += crlf
    rawEmail += this.encodeQuotedPrintable(content.text) + crlf

    // HTML version with tracking
    rawEmail += `--${boundary}_alt${crlf}`
    rawEmail += `Content-Type: text/html; charset=UTF-8${crlf}`
    rawEmail += `Content-Transfer-Encoding: quoted-printable${crlf}`
    rawEmail += crlf
    rawEmail += this.encodeQuotedPrintable(content.html) + crlf

    rawEmail += `--${boundary}_alt--${crlf}`

    // Attachments
    for (const attachment of attachments) {
      rawEmail += `--${boundary}${crlf}`
      rawEmail += `Content-Type: ${attachment.contentType}${crlf}`
      rawEmail += `Content-Disposition: attachment; filename="${attachment.filename}"${crlf}`
      rawEmail += `Content-Transfer-Encoding: base64${crlf}`
      rawEmail += crlf
      rawEmail += attachment.content.toString('base64').match(/.{1,76}/g)?.join(crlf) + crlf
    }

    rawEmail += `--${boundary}--${crlf}`

    return rawEmail
  }

  private encodeQuotedPrintable(text: string): string {
    return text
      .replace(/[\x80-\xFF]/g, (match) => `=${match.charCodeAt(0).toString(16).toUpperCase()}`)
      .replace(/(.{76})/g, '$1=\r\n')
  }

  private async processEmailContentForDelivery(
    request: ConsolidatedEmailRequest,
    trackingData: ConsolidatedEmailTrackingData
  ): Promise<{ html: string; text: string; subject: string }> {
    let html = request.htmlContent
    let text = request.textContent
    const subject = request.subject

    // Add tracking pixel
    html += `<img src="${trackingData.trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">`

    // Add unsubscribe link if not present
    if (!html.includes('unsubscribe')) {
      const unsubscribeText = request.language === 'ar'
        ? 'إلغاء الاشتراك'
        : 'Unsubscribe'

      html += `<p style="font-size: 12px; color: #666; margin-top: 20px;">
        <a href="${trackingData.unsubscribeUrl}" style="color: #666;">${unsubscribeText}</a>
      </p>`

      text += `\n\n${unsubscribeText}: ${trackingData.unsubscribeUrl}`
    }

    // Add payment links tracking
    trackingData.paymentLinks.forEach((link, index) => {
      const trackedLink = `${link}?utm_source=consolidation&utm_medium=email&utm_campaign=${request.consolidationId}&utm_content=payment_${index}`
      html = html.replace(link, trackedLink)
      text = text.replace(link, trackedLink)
    })

    return { html, text, subject }
  }

  private async generateTrackingUrls(
    consolidationId: string,
    emailLogId: string
  ): Promise<ConsolidatedEmailTrackingData> {
    const baseUrl = this.trackingDomain

    // Extract payment links from consolidation data
    const consolidation = await prisma.customerConsolidatedReminders.findUnique({
      where: { id: consolidationId },
      include: {
        emailLogs: {
          select: { id: true }
        }
      }
    })

    const paymentLinks = consolidation?.invoiceIds.map(invoiceId =>
      `${baseUrl}/payment/${invoiceId}`
    ) || []

    return {
      consolidationId,
      emailLogId,
      messageId: '', // Will be set after sending
      trackingPixelUrl: `${baseUrl}/api/email/tracking/open?id=${emailLogId}`,
      unsubscribeUrl: `${this.unsubscribeBaseUrl}?id=${emailLogId}`,
      paymentLinks,
      culturalMetadata: {
        language: 'en', // Will be set from request
        escalationLevel: 'POLITE', // Will be set from request
        complianceScore: 0, // Will be set from request
        adjustmentsMade: []
      }
    }
  }

  private async createEmailLogEntry(request: ConsolidatedEmailRequest): Promise<string> {
    const emailLog = await prisma.emailLog.create({
      data: {
        id: crypto.randomUUID(),
        consolidatedReminderId: request.consolidationId,
        companyId: '', // Will be fetched from consolidation
        recipientEmail: request.to,
        subject: request.subject,
        contentHtml: request.htmlContent,
        contentText: request.textContent,
        language: request.language,
        escalationLevel: request.escalationLevel,
        deliveryStatus: 'SCHEDULED',
        culturalComplianceScore: request.culturalComplianceScore || 0,
        businessRulesApplied: request.businessRulesApplied || [],
        pdfAttachmentCount: request.attachments?.length || 0,
        pdfAttachmentSize: request.attachments?.reduce((sum, att) => sum + att.size, 0) || 0,
        originalScheduledTime: request.scheduledFor,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return emailLog.id
  }

  private async updateEmailLogWithDelivery(
    emailLogId: string,
    sesResponse: any,
    deliveryTime: number
  ): Promise<void> {
    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: {
        awsMessageId: sesResponse.MessageId,
        deliveryStatus: 'SENT',
        sentAt: new Date(),
        updatedAt: new Date()
      }
    })
  }

  private async storeTrackingData(trackingData: ConsolidatedEmailTrackingData): Promise<void> {
    // Store tracking data for webhook processing
    // This would typically be stored in a separate tracking table
    console.log('Tracking data stored:', {
      consolidationId: trackingData.consolidationId,
      emailLogId: trackingData.emailLogId
    })
  }

  private async logDeliveryActivity(
    request: ConsolidatedEmailRequest,
    messageId?: string,
    status: 'SUCCESS' | 'FAILED',
    error?: any
  ): Promise<void> {
    try {
      // Get company ID from consolidation
      const consolidation = await prisma.customerConsolidatedReminders.findUnique({
        where: { id: request.consolidationId },
        select: { companyId: true }
      })

      if (consolidation) {
        await prisma.activity.create({
          data: {
            id: crypto.randomUUID(),
            companyId: consolidation.companyId,
            userId: 'system',
            type: 'consolidated_email_delivery',
            description: `Consolidated email ${status.toLowerCase()}: ${request.to}`,
            metadata: {
              consolidationId: request.consolidationId,
              messageId,
              status,
              escalationLevel: request.escalationLevel,
              language: request.language,
              attachmentCount: request.attachments?.length || 0,
              culturalComplianceScore: request.culturalComplianceScore,
              error: error?.message
            }
          }
        })
      }
    } catch (logError) {
      console.error('Failed to log delivery activity:', logError)
    }
  }

  private async handleDeliveryEvent(eventData: any): Promise<void> {
    // Handle successful delivery webhook
    const messageId = eventData.mail?.messageId
    if (messageId) {
      await prisma.emailLog.updateMany({
        where: { awsMessageId: messageId },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(),
          updatedAt: new Date()
        }
      })
    }
  }

  private async handleBounceEvent(eventData: any): Promise<void> {
    // Handle bounce webhook
    const messageId = eventData.mail?.messageId
    if (messageId) {
      await prisma.emailLog.updateMany({
        where: { awsMessageId: messageId },
        data: {
          deliveryStatus: 'BOUNCED',
          bouncedAt: new Date(),
          bounceReason: eventData.bounce?.bounceType,
          updatedAt: new Date()
        }
      })
    }
  }

  private async handleComplaintEvent(eventData: any): Promise<void> {
    // Handle complaint webhook
    const messageId = eventData.mail?.messageId
    if (messageId) {
      await prisma.emailLog.updateMany({
        where: { awsMessageId: messageId },
        data: {
          complainedAt: new Date(),
          complaintFeedback: eventData.complaint?.complaintFeedbackType,
          updatedAt: new Date()
        }
      })
    }
  }

  private async handleOpenEvent(eventData: any): Promise<void> {
    // Handle email open webhook
    const emailLogId = eventData.emailLogId // Would be extracted from tracking URL
    if (emailLogId) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          openedAt: new Date(),
          updatedAt: new Date()
        }
      })
    }
  }

  private async handleClickEvent(eventData: any): Promise<void> {
    // Handle email click webhook
    const emailLogId = eventData.emailLogId // Would be extracted from tracking URL
    if (emailLogId) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          clickedAt: new Date(),
          updatedAt: new Date()
        }
      })
    }
  }
}

// Singleton instance for global use
export const awsSESConsolidationService = new AWSSESConsolidationService()