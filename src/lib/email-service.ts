import { prisma } from './prisma'
import { 
  isUAEBusinessHours, 
  getNextUAEBusinessHour, 
  formatUAECurrency 
} from './vat-calculator'
import { emailSuppressionService } from './services/email-suppression-service'
import { generateUnsubscribeToken } from '../app/api/email/unsubscribe/route'

export interface EmailTemplateVariables {
  [key: string]: string | number | Date | boolean
}

export interface SendEmailOptions {
  templateId?: string
  companyId: string
  invoiceId?: string
  customerId?: string
  recipientEmail: string
  recipientName?: string
  subject?: string
  content?: string
  language?: 'ENGLISH' | 'ARABIC'
  variables?: EmailTemplateVariables
  scheduleForBusinessHours?: boolean
  delayMinutes?: number
}

export interface EmailServiceConfig {
  provider: 'aws-ses' | 'sendgrid' | 'smtp'
  credentials: {
    accessKey?: string
    secretKey?: string
    region?: string
    apiKey?: string
    smtpHost?: string
    smtpPort?: number
    smtpUser?: string
    smtpPass?: string
  }
  fromEmail: string
  fromName: string
  replyTo?: string
  maxRetries: number
  retryDelayMs: number
}

export class EmailService {
  private config: EmailServiceConfig

  constructor(config: EmailServiceConfig) {
    this.config = config
  }

  /**
   * Send email using template or direct content
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    try {
      // Check if email address is suppressed
      const suppressionCheck = await emailSuppressionService.checkSuppression(
        options.recipientEmail, 
        options.companyId
      )
      
      if (suppressionCheck.isSuppressed) {
        throw new Error(
          `Email address ${options.recipientEmail} is suppressed: ${suppressionCheck.reason} (${suppressionCheck.suppressionType})`
        )
      }

      // Get or create email template
      let template = null
      let subject = options.subject || ''
      let content = options.content || ''

      if (options.templateId) {
        template = await prisma.emailTemplate.findUnique({
          where: { id: options.templateId },
          include: { company: true }
        })

        if (!template) {
          throw new Error('Email template not found')
        }

        if (!template.isActive) {
          throw new Error('Email template is inactive')
        }

        // Use template content based on language
        subject = options.language === 'ARABIC' 
          ? (template.subjectAr || template.subjectEn)
          : template.subjectEn
        
        content = options.language === 'ARABIC'
          ? (template.contentAr || template.contentEn)
          : template.contentEn
      }

      // Replace template variables
      if (options.variables) {
        const processedVariables = await this.processVariables(options)
        subject = this.replaceVariables(subject, processedVariables)
        content = this.replaceVariables(content, processedVariables)
      }

      // Determine send time
      let scheduledSendTime = new Date()
      
      if (options.delayMinutes && options.delayMinutes > 0) {
        scheduledSendTime = new Date(Date.now() + options.delayMinutes * 60 * 1000)
      }

      // Schedule for UAE business hours if required
      if (template?.uaeBusinessHoursOnly || options.scheduleForBusinessHours) {
        if (!isUAEBusinessHours(scheduledSendTime)) {
          scheduledSendTime = getNextUAEBusinessHour(scheduledSendTime)
        }
      }

      // Create email log entry
      const emailLog = await prisma.emailLog.create({
        data: {
          id: crypto.randomUUID(),
          templateId: options.templateId,
          companyId: options.companyId,
          invoiceId: options.invoiceId,
          customerId: options.customerId,
          recipientEmail: options.recipientEmail,
          recipientName: options.recipientName,
          subject,
          content,
          language: options.language || 'ENGLISH',
          deliveryStatus: 'QUEUED',
          uaeSendTime: scheduledSendTime
        }
      })

      // Send immediately or schedule
      if (scheduledSendTime.getTime() <= Date.now() + 60000) { // Send within 1 minute
        await this.sendImmediately(emailLog.id, subject, content, options.recipientEmail, options.recipientName)
      } else {
        // In production, this would schedule the email in a queue system
        console.log(`Email scheduled for ${scheduledSendTime.toISOString()}`)
      }

      return emailLog.id

    } catch (error) {
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send email immediately with real provider integration
   */
  private async sendImmediately(
    emailLogId: string, 
    subject: string, 
    content: string, 
    recipientEmail: string, 
    recipientName?: string
  ): Promise<void> {
    let messageId: string | undefined
    let retryCount = 0

    while (retryCount <= this.config.maxRetries) {
      try {
        // Update status to sending
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: { 
            deliveryStatus: 'SENT',
            sentAt: new Date(),
            retryCount
          }
        })

        // Send via configured email provider
        let result: { messageId: string }
        
        switch (this.config.provider) {
          case 'aws-ses':
            result = await this.sendViaAWSSES(subject, content, recipientEmail, recipientName)
            messageId = result.messageId
            break
          case 'sendgrid':
            result = await this.sendViaSendGrid(subject, content, recipientEmail, recipientName)
            messageId = result.messageId
            break
          case 'smtp':
            result = await this.sendViaSMTP(subject, content, recipientEmail, recipientName)
            messageId = result.messageId
            break
          default:
            throw new Error(`Unsupported email provider: ${this.config.provider}`)
        }

        // Update status to delivered with message ID
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: { 
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date(),
            awsMessageId: messageId
          }
        })

        return // Success, exit retry loop

      } catch (error) {
        retryCount++
        const isLastRetry = retryCount > this.config.maxRetries
        
        console.error(`Email delivery attempt ${retryCount} failed for ${emailLogId}:`, error)

        if (isLastRetry) {
          // Final failure - update status to failed
          await prisma.emailLog.update({
            where: { id: emailLogId },
            data: { 
              deliveryStatus: 'FAILED',
              bounceReason: error instanceof Error ? error.message : 'Unknown error',
              retryCount
            }
          })
          throw error
        } else {
          // Wait before retry with exponential backoff
          const delayMs = this.config.retryDelayMs * Math.pow(2, retryCount - 1)
          console.log(`Retrying email ${emailLogId} in ${delayMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }
  }

  /**
   * Process and enhance template variables with invoice/customer data
   */
  private async processVariables(options: SendEmailOptions): Promise<EmailTemplateVariables> {
    const variables = { ...options.variables }

    // Add invoice-specific variables
    if (options.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: options.invoiceId },
        include: {
          customer: true,
          company: true,
          invoiceItems: true,
          payments: true
        }
      })

      if (invoice) {
        Object.assign(variables, {
          invoiceNumber: invoice.number,
          invoiceAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
          invoiceSubtotal: formatUAECurrency(invoice.subtotal || 0, invoice.currency),
          invoiceVatAmount: formatUAECurrency(invoice.vatAmount || 0, invoice.currency),
          invoiceTotalAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
          invoiceCurrency: invoice.currency,
          invoiceStatus: invoice.status,
          invoiceDueDate: invoice.dueDate.toLocaleDateString('en-AE'),
          invoiceDescription: invoice.description || '',
          invoiceDescriptionAr: invoice.descriptionAr || '',
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          companyName: invoice.company.name,
          companyTrn: invoice.company.trn || '',
          daysPastDue: Math.max(0, Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))),
          totalPaid: invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          outstandingAmount: Number(invoice.totalAmount || invoice.amount) - 
                           invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
          itemCount: invoice.invoiceItems.length,
          lastPaymentDate: invoice.payments.length > 0 
            ? new Date(Math.max(...invoice.payments.map(p => p.paymentDate.getTime()))).toLocaleDateString('en-AE')
            : null
        })
      }
    }

    // Add customer-specific variables
    if (options.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: options.customerId },
        include: {
          invoices: {
            where: { status: { in: ['SENT', 'OVERDUE'] } }
          }
        }
      })

      if (customer) {
        Object.assign(variables, {
          customerName: customer.name,
          customerNameAr: customer.nameAr || '',
          customerEmail: customer.email,
          customerPhone: customer.phone || '',
          customerPaymentTerms: customer.paymentTerms || 30,
          customerNotes: customer.notes || '',
          customerNotesAr: customer.notesAr || '',
          outstandingInvoiceCount: customer.invoices.length,
          totalOutstanding: customer.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount), 0)
        })
      }
    }

    // Add common variables including unsubscribe link
    const unsubscribeToken = generateUnsubscribeToken(options.recipientEmail, options.companyId)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.ae'
    const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(options.recipientEmail)}&companyId=${options.companyId}&token=${unsubscribeToken}`
    
    Object.assign(variables, {
      currentDate: new Date().toLocaleDateString('en-AE'),
      currentDateAr: new Date().toLocaleDateString('ar-AE'),
      currentTime: new Date().toLocaleTimeString('en-AE'),
      businessYear: new Date().getFullYear(),
      supportEmail: 'support@usereminder.com',
      supportPhone: '+971-4-REMINDER',
      unsubscribeUrl,
      unsubscribeLink: `<a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Unsubscribe</a>`
    })

    return variables
  }

  /**
   * Replace template variables in content
   */
  private replaceVariables(content: string, variables: EmailTemplateVariables): string {
    let processedContent = content

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      const stringValue = value !== null && value !== undefined ? String(value) : ''
      processedContent = processedContent.replace(new RegExp(placeholder, 'g'), stringValue)
    })

    return processedContent
  }

  /**
   * Strip HTML tags from content for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Send via AWS SES with real implementation
   */
  private async sendViaAWSSES(
    subject: string, 
    content: string, 
    recipientEmail: string, 
    recipientName?: string
  ): Promise<{ messageId: string }> {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')
    
    const sesClient = new SESClient({
      region: this.config.credentials.region || 'me-south-1',
      credentials: {
        accessKeyId: this.config.credentials.accessKey!,
        secretAccessKey: this.config.credentials.secretKey!,
      },
      maxAttempts: this.config.maxRetries,
      requestTimeout: 30000
    })

    const toAddress = recipientName ? `"${recipientName}" <${recipientEmail}>` : recipientEmail
    const fromAddress = this.config.fromName ? 
      `"${this.config.fromName}" <${this.config.fromEmail}>` : 
      this.config.fromEmail

    const params = {
      Source: fromAddress,
      Destination: {
        ToAddresses: [toAddress],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: content,
            Charset: 'UTF-8',
          },
          Text: {
            Data: this.stripHtml(content),
            Charset: 'UTF-8',
          },
        },
      },
      ReplyToAddresses: this.config.replyTo ? [this.config.replyTo] : undefined,
      Tags: [
        {
          Name: 'Environment',
          Value: process.env.NODE_ENV || 'development'
        },
        {
          Name: 'Service',
          Value: 'UAE-InvoiceSystem'
        },
        {
          Name: 'Region',
          Value: this.config.credentials.region || 'me-south-1'
        }
      ]
    }

    try {
      const command = new SendEmailCommand(params)
      const result = await sesClient.send(command)
      
      if (!result.MessageId) {
        throw new Error('SES did not return MessageId')
      }

      console.log(`[AWS SES] Email sent successfully. MessageId: ${result.MessageId}`)
      return { messageId: result.MessageId }

    } catch (error: any) {
      console.error(`[AWS SES] Failed to send email to ${recipientEmail}:`, error)
      
      // Enhanced error handling for different SES error types
      if (error.name === 'MessageRejected') {
        throw new Error(`Email rejected by SES: ${error.message}`)
      } else if (error.name === 'SendingPausedException') {
        throw new Error('SES sending is paused for this account')
      } else if (error.name === 'MailFromDomainNotVerifiedException') {
        throw new Error('Mail-from domain not verified in SES')
      } else if (error.name === 'ConfigurationSetDoesNotExistException') {
        throw new Error('SES configuration set does not exist')
      } else if (error.name === 'AccountSendingPausedException') {
        throw new Error('SES account sending is paused')
      } else {
        throw new Error(`SES delivery failed: ${error.message || 'Unknown SES error'}`)
      }
    }
  }

  /**
   * Send via SendGrid (fallback implementation)
   */
  private async sendViaSendGrid(
    subject: string, 
    content: string, 
    recipientEmail: string, 
    recipientName?: string
  ): Promise<{ messageId: string }> {
    // This is a fallback implementation - in production you'd use @sendgrid/mail
    console.log(`[SendGrid] Sending email to ${recipientEmail}`)
    console.log(`Subject: ${subject}`)
    
    // Simulate SendGrid API call
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Generate a mock message ID
    const messageId = `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Simulate 97% success rate for SendGrid
    if (Math.random() < 0.03) {
      throw new Error('SendGrid delivery failed')
    }
    
    return { messageId }
  }

  /**
   * Send via SMTP (fallback implementation)
   */
  private async sendViaSMTP(
    subject: string, 
    content: string, 
    recipientEmail: string, 
    recipientName?: string
  ): Promise<{ messageId: string }> {
    // This is a fallback implementation - in production you'd use nodemailer
    console.log(`[SMTP] Sending email to ${recipientEmail}`)
    console.log(`Subject: ${subject}`)
    
    // Simulate SMTP delivery
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Generate a mock message ID
    const messageId = `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Simulate 93% success rate for SMTP
    if (Math.random() < 0.07) {
      throw new Error('SMTP delivery failed')
    }
    
    return { messageId }
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmails(
    emails: SendEmailOptions[],
    rateLimit = 10, // emails per second
    batchSize = 50
  ): Promise<{
    sent: string[]
    failed: { email: string; error: string }[]
    totalProcessed: number
  }> {
    const sent: string[] = []
    const failed: { email: string; error: string }[] = []
    const delay = 1000 / rateLimit // ms between emails

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, Math.min(i + batchSize, emails.length))
      
      const batchPromises = batch.map(async (emailOptions, batchIndex) => {
        try {
          // Rate limiting delay
          if (batchIndex > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * batchIndex))
          }

          const emailLogId = await this.sendEmail(emailOptions)
          sent.push(emailLogId)
        } catch (error) {
          failed.push({
            email: emailOptions.recipientEmail,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      await Promise.all(batchPromises)

      // Delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delay * batchSize))
      }
    }

    return {
      sent,
      failed,
      totalProcessed: emails.length
    }
  }

  /**
   * Track email engagement (opens, clicks)
   */
  async trackEmailEvent(
    emailLogId: string,
    eventType: 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED',
    eventData?: Record<string, any>
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date()
    }

    switch (eventType) {
      case 'OPENED':
        updateData.openedAt = new Date()
        updateData.deliveryStatus = 'OPENED'
        break
      case 'CLICKED':
        updateData.clickedAt = new Date()
        updateData.deliveryStatus = 'CLICKED'
        break
      case 'BOUNCED':
        updateData.bouncedAt = new Date()
        updateData.deliveryStatus = 'BOUNCED'
        updateData.bounceReason = eventData?.reason || 'Email bounced'
        break
      case 'COMPLAINED':
        updateData.complainedAt = new Date()
        updateData.deliveryStatus = 'COMPLAINED'
        updateData.complaintFeedback = eventData?.feedback || 'Spam complaint'
        break
      case 'UNSUBSCRIBED':
        updateData.unsubscribedAt = new Date()
        updateData.deliveryStatus = 'UNSUBSCRIBED'
        break
    }

    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: updateData
    })

    // Create bounce tracking record if needed
    if (eventType === 'BOUNCED') {
      await prisma.emailBounceTracking.create({
        data: {
          id: crypto.randomUUID(),
          emailLogId,
          bounceType: eventData?.bounceType || 'hard',
          bounceSubtype: eventData?.bounceSubtype,
          diagnosticCode: eventData?.diagnosticCode,
          arrivalDate: new Date()
        }
      })
    }
  }

  /**
   * Get email analytics for company
   */
  async getEmailAnalytics(
    companyId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalSent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    unsubscribed: number
    deliveryRate: number
    openRate: number
    clickRate: number
    bounceRate: number
    complaintRate: number
    topTemplates: Array<{ templateName: string; sentCount: number; openRate: number }>
  }> {
    const whereClause: any = { companyId }
    
    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      }
    }

    const [
      totalSent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      unsubscribed,
      templateStats
    ] = await Promise.all([
      prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: { not: 'QUEUED' } } }),
      prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'DELIVERED' } }),
      prisma.emailLog.count({ where: { ...whereClause, openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...whereClause, clickedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'BOUNCED' } }),
      prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'COMPLAINED' } }),
      prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'UNSUBSCRIBED' } }),
      
      // Template performance
      prisma.emailLog.groupBy({
        by: ['templateId'],
        where: whereClause,
        _count: { id: true },
        _sum: { 
          // We would need raw SQL or custom aggregation for this
        }
      })
    ])

    const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
    const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0
    const complaintRate = totalSent > 0 ? (complained / totalSent) * 100 : 0

    return {
      totalSent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      unsubscribed,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      complaintRate: Math.round(complaintRate * 100) / 100,
      topTemplates: [] // Would be populated from templateStats
    }
  }
}

// Default email service configuration (would be loaded from environment)
export const getDefaultEmailService = (): EmailService => {
  const config: EmailServiceConfig = {
    provider: 'aws-ses', // or from process.env.EMAIL_PROVIDER
    credentials: {
      accessKey: process.env.AWS_ACCESS_KEY_ID,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'me-south-1' // UAE region
    },
    fromEmail: process.env.FROM_EMAIL || 'noreply@usereminder.com',
    fromName: process.env.FROM_NAME || 'Reminder - Payment Collection',
    replyTo: process.env.REPLY_TO_EMAIL,
    maxRetries: 3,
    retryDelayMs: 5000
  }

  return new EmailService(config)
}

// Utility functions
export const validateEmailTemplate = (template: any): string[] => {
  const errors: string[] = []

  if (!template.subjectEn?.trim()) {
    errors.push('English subject is required')
  }

  if (!template.contentEn?.trim()) {
    errors.push('English content is required')
  }

  // Check for valid template variables
  const validVariables = [
    'invoiceNumber', 'invoiceAmount', 'customerName', 'dueDate', 
    'companyName', 'daysPastDue', 'outstandingAmount'
  ]
  
  const usedVariables = (template.contentEn.match(/{{(\w+)}}/g) || [])
    .map((v: string) => v.replace(/[{}]/g, ''))
  
  const invalidVariables = usedVariables.filter((v: string) => !validVariables.includes(v))
  
  if (invalidVariables.length > 0) {
    errors.push(`Invalid template variables: ${invalidVariables.join(', ')}`)
  }

  return errors
}