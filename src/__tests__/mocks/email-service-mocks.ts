/**
 * Email Service Mocks for Testing
 * Comprehensive mocking for AWS SES, SMTP, and email delivery services
 */

import { jest } from '@jest/globals'

// Email delivery status types
export type EmailDeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'REJECTED'
  | 'COMPLAINT'
  | 'UNSUBSCRIBED'
  | 'FAILED'

// Mock email log entry
export interface MockEmailLog {
  id: string
  messageId: string
  recipientEmail: string
  subject: string
  content: string
  deliveryStatus: EmailDeliveryStatus
  sentAt: Date
  deliveredAt?: Date
  bouncedAt?: Date
  openedAt?: Date
  clickedAt?: Date
  unsubscribedAt?: Date
  metadata: Record<string, any>
}

// Mock email service configuration
export interface MockEmailServiceConfig {
  deliverySuccessRate: number // 0-1, percentage of emails that succeed
  deliveryDelay: number // milliseconds to simulate delivery delay
  simulateBounces: boolean
  simulateOpens: boolean
  simulateClicks: boolean
  enableWebhooks: boolean
  maxRetries: number
}

/**
 * Mock AWS SES Service
 */
export class MockAWSSESService {
  private config: MockEmailServiceConfig
  private emailLogs: Map<string, MockEmailLog> = new Map()
  private webhookEndpoints: string[] = []

  constructor(config: Partial<MockEmailServiceConfig> = {}) {
    this.config = {
      deliverySuccessRate: 0.95,
      deliveryDelay: 1000,
      simulateBounces: true,
      simulateOpens: true,
      simulateClicks: false,
      enableWebhooks: false,
      maxRetries: 3,
      ...config
    }
  }

  // Mock SES sendEmail
  async sendEmail(params: {
    Source: string
    Destination: { ToAddresses: string[] }
    Message: {
      Subject: { Data: string }
      Body: { Html?: { Data: string }, Text?: { Data: string } }
    }
    ConfigurationSetName?: string
    Tags?: Array<{ Name: string, Value: string }>
  }): Promise<{ MessageId: string }> {
    const messageId = `mock-aws-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const recipient = params.Destination.ToAddresses[0]

    // Simulate email validation
    if (!this.isValidEmail(recipient)) {
      throw new Error(`Invalid email address: ${recipient}`)
    }

    // Simulate rate limiting
    if (this.shouldSimulateRateLimit()) {
      throw new Error('SendingQuotaExceeded: Maximum sending rate exceeded')
    }

    // Create email log
    const emailLog: MockEmailLog = {
      id: `mock-log-${messageId}`,
      messageId,
      recipientEmail: recipient,
      subject: params.Message.Subject.Data,
      content: params.Message.Body.Html?.Data || params.Message.Body.Text?.Data || '',
      deliveryStatus: 'QUEUED',
      sentAt: new Date(),
      metadata: {
        source: params.Source,
        configurationSet: params.ConfigurationSetName,
        tags: params.Tags || []
      }
    }

    this.emailLogs.set(messageId, emailLog)

    // Simulate async delivery
    this.simulateDelivery(messageId)

    return { MessageId: messageId }
  }

  // Mock SES sendBulkTemplatedEmail
  async sendBulkTemplatedEmail(params: {
    Source: string
    Template: string
    DefaultTemplateData: string
    Destinations: Array<{
      Destination: { ToAddresses: string[] }
      ReplacementTemplateData: string
    }>
    ConfigurationSetName?: string
  }): Promise<{ MessageId: string, Status: string }[]> {
    const results: Array<{ MessageId: string, Status: string }> = []

    for (const destination of params.Destinations) {
      try {
        const messageId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const recipient = destination.Destination.ToAddresses[0]

        // Simulate some bulk operations failing
        if (Math.random() < 0.02) { // 2% failure rate for bulk
          results.push({
            MessageId: '',
            Status: 'MessageRejected'
          })
          continue
        }

        const emailLog: MockEmailLog = {
          id: `bulk-log-${messageId}`,
          messageId,
          recipientEmail: recipient,
          subject: `Bulk Template: ${params.Template}`,
          content: params.DefaultTemplateData,
          deliveryStatus: 'QUEUED',
          sentAt: new Date(),
          metadata: {
            source: params.Source,
            template: params.Template,
            bulk: true,
            templateData: destination.ReplacementTemplateData
          }
        }

        this.emailLogs.set(messageId, emailLog)
        this.simulateDelivery(messageId)

        results.push({
          MessageId: messageId,
          Status: 'Success'
        })

      } catch (error) {
        results.push({
          MessageId: '',
          Status: 'MessageRejected'
        })
      }
    }

    return results
  }

  // Mock SES getMessageEvents (for tracking)
  async getMessageEvents(messageId: string): Promise<{
    Events: Array<{
      EventType: string
      Timestamp: Date
      MessageId: string
      EventData?: any
    }>
  }> {
    const emailLog = this.emailLogs.get(messageId)
    if (!emailLog) {
      throw new Error(`Message not found: ${messageId}`)
    }

    const events: any[] = [
      {
        EventType: 'send',
        Timestamp: emailLog.sentAt,
        MessageId: messageId
      }
    ]

    if (emailLog.deliveredAt) {
      events.push({
        EventType: 'delivery',
        Timestamp: emailLog.deliveredAt,
        MessageId: messageId
      })
    }

    if (emailLog.bouncedAt) {
      events.push({
        EventType: 'bounce',
        Timestamp: emailLog.bouncedAt,
        MessageId: messageId,
        EventData: {
          bounceType: 'Permanent',
          bounceSubType: 'General'
        }
      })
    }

    if (emailLog.openedAt) {
      events.push({
        EventType: 'open',
        Timestamp: emailLog.openedAt,
        MessageId: messageId
      })
    }

    if (emailLog.clickedAt) {
      events.push({
        EventType: 'click',
        Timestamp: emailLog.clickedAt,
        MessageId: messageId,
        EventData: {
          linkUrl: 'https://example.com/payment-link'
        }
      })
    }

    return { Events: events }
  }

  // Mock SES configuration set operations
  async putConfigurationSetEventDestination(params: {
    ConfigurationSetName: string
    EventDestination: {
      Name: string
      Enabled: boolean
      MatchingEventTypes: string[]
      SNSDestination?: { TopicARN: string }
      CloudWatchDestination?: any
    }
  }): Promise<void> {
    // Mock webhook setup
    if (params.EventDestination.SNSDestination) {
      this.webhookEndpoints.push(params.EventDestination.SNSDestination.TopicARN)
    }
  }

  // Get email delivery statistics
  getDeliveryStatistics() {
    const logs = Array.from(this.emailLogs.values())

    return {
      totalSent: logs.length,
      delivered: logs.filter(l => l.deliveryStatus === 'DELIVERED').length,
      bounced: logs.filter(l => l.deliveryStatus === 'BOUNCED').length,
      complained: logs.filter(l => l.deliveryStatus === 'COMPLAINT').length,
      rejected: logs.filter(l => l.deliveryStatus === 'REJECTED').length,
      opened: logs.filter(l => l.openedAt).length,
      clicked: logs.filter(l => l.clickedAt).length,
      deliveryRate: logs.length > 0 ?
        logs.filter(l => l.deliveryStatus === 'DELIVERED').length / logs.length : 0
    }
  }

  // Get specific email log
  getEmailLog(messageId: string): MockEmailLog | undefined {
    return this.emailLogs.get(messageId)
  }

  // Clear all logs (for testing)
  clearLogs(): void {
    this.emailLogs.clear()
  }

  // Private helper methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private shouldSimulateRateLimit(): boolean {
    // Simulate rate limiting occasionally
    return Math.random() < 0.001 // 0.1% chance
  }

  private async simulateDelivery(messageId: string): Promise<void> {
    setTimeout(() => {
      const emailLog = this.emailLogs.get(messageId)
      if (!emailLog) return

      // Simulate delivery success/failure based on config
      const willSucceed = Math.random() < this.config.deliverySuccessRate

      if (willSucceed) {
        emailLog.deliveryStatus = 'DELIVERED'
        emailLog.deliveredAt = new Date()

        // Simulate opens
        if (this.config.simulateOpens && Math.random() < 0.25) { // 25% open rate
          setTimeout(() => {
            emailLog.openedAt = new Date()
          }, Math.random() * 3600000) // Within 1 hour
        }

        // Simulate clicks
        if (this.config.simulateClicks && Math.random() < 0.05) { // 5% click rate
          setTimeout(() => {
            emailLog.clickedAt = new Date()
          }, Math.random() * 7200000) // Within 2 hours
        }

      } else {
        // Simulate different failure types
        const failureTypes: EmailDeliveryStatus[] = ['BOUNCED', 'REJECTED', 'FAILED']
        emailLog.deliveryStatus = failureTypes[Math.floor(Math.random() * failureTypes.length)]

        if (emailLog.deliveryStatus === 'BOUNCED') {
          emailLog.bouncedAt = new Date()
        }
      }

      // Trigger webhook if enabled
      if (this.config.enableWebhooks) {
        this.triggerWebhook(emailLog)
      }

      this.emailLogs.set(messageId, emailLog)
    }, this.config.deliveryDelay)
  }

  private triggerWebhook(emailLog: MockEmailLog): void {
    // Mock webhook payload
    const webhookPayload = {
      eventType: emailLog.deliveryStatus,
      messageId: emailLog.messageId,
      recipient: emailLog.recipientEmail,
      timestamp: new Date().toISOString(),
      metadata: emailLog.metadata
    }

    // In real implementation, this would make HTTP calls to webhook endpoints
    console.log('Mock Webhook Triggered:', webhookPayload)
  }
}

/**
 * Mock SMTP Service (for backup email delivery)
 */
export class MockSMTPService {
  private config: MockEmailServiceConfig
  private sentEmails: MockEmailLog[] = []

  constructor(config: Partial<MockEmailServiceConfig> = {}) {
    this.config = {
      deliverySuccessRate: 0.92, // Slightly lower than SES
      deliveryDelay: 2000, // Slower than SES
      simulateBounces: true,
      simulateOpens: false, // SMTP usually doesn't track opens
      simulateClicks: false,
      enableWebhooks: false,
      maxRetries: 5,
      ...config
    }
  }

  async sendMail(options: {
    from: string
    to: string | string[]
    subject: string
    text?: string
    html?: string
    attachments?: Array<{
      filename: string
      content: Buffer | string
    }>
  }): Promise<{ messageId: string }> {
    const messageId = `smtp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const recipients = Array.isArray(options.to) ? options.to : [options.to]

    for (const recipient of recipients) {
      const emailLog: MockEmailLog = {
        id: `smtp-log-${messageId}`,
        messageId,
        recipientEmail: recipient,
        subject: options.subject,
        content: options.html || options.text || '',
        deliveryStatus: 'QUEUED',
        sentAt: new Date(),
        metadata: {
          from: options.from,
          provider: 'SMTP',
          attachmentCount: options.attachments?.length || 0
        }
      }

      this.sentEmails.push(emailLog)
      this.simulateDelivery(emailLog)
    }

    return { messageId }
  }

  private async simulateDelivery(emailLog: MockEmailLog): Promise<void> {
    setTimeout(() => {
      const willSucceed = Math.random() < this.config.deliverySuccessRate

      if (willSucceed) {
        emailLog.deliveryStatus = 'SENT' // SMTP doesn't track delivery confirmation
      } else {
        emailLog.deliveryStatus = 'FAILED'
      }
    }, this.config.deliveryDelay)
  }

  getSentEmails(): MockEmailLog[] {
    return this.sentEmails
  }

  clearSentEmails(): void {
    this.sentEmails = []
  }
}

/**
 * Mock Email Template Service
 */
export class MockEmailTemplateService {
  private templates: Map<string, any> = new Map()

  constructor() {
    // Pre-populate with common templates
    this.setupDefaultTemplates()
  }

  async createTemplate(templateData: {
    id: string
    name: string
    subject: string
    htmlContent: string
    textContent?: string
    language: 'ENGLISH' | 'ARABIC' | 'BOTH'
  }): Promise<{ success: boolean }> {
    this.templates.set(templateData.id, {
      ...templateData,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return { success: true }
  }

  async getTemplate(templateId: string): Promise<any> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }
    return template
  }

  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<{
    subject: string
    htmlContent: string
    textContent: string
  }> {
    const template = await this.getTemplate(templateId)

    let subject = template.subject
    let htmlContent = template.htmlContent
    let textContent = template.textContent || ''

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      subject = subject.replace(placeholder, value)
      htmlContent = htmlContent.replace(placeholder, value)
      textContent = textContent.replace(placeholder, value)
    })

    return { subject, htmlContent, textContent }
  }

  private setupDefaultTemplates(): void {
    // English templates
    this.templates.set('friendly-reminder-en', {
      id: 'friendly-reminder-en',
      name: 'Friendly Reminder (English)',
      subject: 'Gentle Reminder: Invoice {{invoiceNumber}} - {{customerName}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Dear {{customerName}},</h2>
          <p>As-salamu alaykum and greetings! We hope this email finds you in good health.</p>
          <p>This is a gentle reminder regarding Invoice <strong>{{invoiceNumber}}</strong> for <strong>{{invoiceAmount}} {{currency}}</strong>.</p>
          <p>We would appreciate your kind attention to this matter at your earliest convenience.</p>
          <p>JazakAllahu khair for your cooperation.</p>
          <p>Best regards,<br>{{companyName}} Team</p>
        </div>
      `,
      textContent: 'Dear {{customerName}}, As-salamu alaykum! Gentle reminder for Invoice {{invoiceNumber}} ({{invoiceAmount}} {{currency}}). JazakAllahu khair. Best regards, {{companyName}}',
      language: 'ENGLISH'
    })

    // Arabic templates
    this.templates.set('friendly-reminder-ar', {
      id: 'friendly-reminder-ar',
      name: 'Friendly Reminder (Arabic)',
      subject: 'تذكير لطيف: فاتورة {{invoiceNumber}} - {{customerName}}',
      htmlContent: `
        <div style="font-family: 'Arial', 'Tahoma', sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
          <h2>عزيزي {{customerName}}،</h2>
          <p>السلام عليكم ورحمة الله وبركاته</p>
          <p>نتمنى أن تكون بأفضل حال. هذا تذكير لطيف بخصوص الفاتورة رقم <strong>{{invoiceNumber}}</strong> بمبلغ <strong>{{invoiceAmount}} {{currency}}</strong>.</p>
          <p>نقدر تعاونكم في تسوية هذا المبلغ في أقرب وقت ممكن.</p>
          <p>جزاكم الله خيراً</p>
          <p>مع خالص التقدير<br>فريق {{companyName}}</p>
        </div>
      `,
      textContent: 'عزيزي {{customerName}}، السلام عليكم! تذكير لطيف للفاتورة {{invoiceNumber}} ({{invoiceAmount}} {{currency}}). جزاكم الله خيراً. {{companyName}}',
      language: 'ARABIC'
    })
  }

  getAllTemplates(): Array<any> {
    return Array.from(this.templates.values())
  }

  clearTemplates(): void {
    this.templates.clear()
    this.setupDefaultTemplates()
  }
}

/**
 * Mock Email Scheduling Service
 */
export class MockEmailSchedulingService {
  private scheduledEmails: Map<string, {
    id: string
    scheduledFor: Date
    emailData: any
    status: 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED'
  }> = new Map()

  async scheduleEmail(emailData: any, scheduledFor: Date): Promise<string> {
    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    this.scheduledEmails.set(scheduleId, {
      id: scheduleId,
      scheduledFor,
      emailData,
      status: 'SCHEDULED'
    })

    // Simulate future sending
    const delay = scheduledFor.getTime() - Date.now()
    if (delay > 0) {
      setTimeout(() => {
        this.processScheduledEmail(scheduleId)
      }, Math.min(delay, 60000)) // Cap at 1 minute for testing
    } else {
      // Send immediately if scheduled in past
      this.processScheduledEmail(scheduleId)
    }

    return scheduleId
  }

  async cancelScheduledEmail(scheduleId: string): Promise<boolean> {
    const scheduled = this.scheduledEmails.get(scheduleId)
    if (!scheduled || scheduled.status !== 'SCHEDULED') {
      return false
    }

    scheduled.status = 'CANCELLED'
    this.scheduledEmails.set(scheduleId, scheduled)
    return true
  }

  getScheduledEmail(scheduleId: string): any {
    return this.scheduledEmails.get(scheduleId)
  }

  getAllScheduledEmails(): Array<any> {
    return Array.from(this.scheduledEmails.values())
  }

  private async processScheduledEmail(scheduleId: string): Promise<void> {
    const scheduled = this.scheduledEmails.get(scheduleId)
    if (!scheduled || scheduled.status !== 'SCHEDULED') {
      return
    }

    try {
      // Simulate sending email
      scheduled.status = 'SENT'
      console.log(`Mock: Sent scheduled email ${scheduleId}`)
    } catch (error) {
      scheduled.status = 'FAILED'
      console.error(`Mock: Failed to send scheduled email ${scheduleId}:`, error)
    }

    this.scheduledEmails.set(scheduleId, scheduled)
  }

  clearScheduledEmails(): void {
    this.scheduledEmails.clear()
  }
}

/**
 * Jest Mock Factory Functions
 */
export const createEmailServiceMocks = () => {
  const awsService = new MockAWSSESService()
  const smtpService = new MockSMTPService()
  const templateService = new MockEmailTemplateService()
  const schedulingService = new MockEmailSchedulingService()

  return {
    // AWS SES Mocks
    sendEmail: jest.fn().mockImplementation(awsService.sendEmail.bind(awsService)),
    sendBulkTemplatedEmail: jest.fn().mockImplementation(awsService.sendBulkTemplatedEmail.bind(awsService)),
    getMessageEvents: jest.fn().mockImplementation(awsService.getMessageEvents.bind(awsService)),

    // SMTP Mocks
    sendMail: jest.fn().mockImplementation(smtpService.sendMail.bind(smtpService)),

    // Template Mocks
    createTemplate: jest.fn().mockImplementation(templateService.createTemplate.bind(templateService)),
    getTemplate: jest.fn().mockImplementation(templateService.getTemplate.bind(templateService)),
    renderTemplate: jest.fn().mockImplementation(templateService.renderTemplate.bind(templateService)),

    // Scheduling Mocks
    scheduleEmail: jest.fn().mockImplementation(schedulingService.scheduleEmail.bind(schedulingService)),
    cancelScheduledEmail: jest.fn().mockImplementation(schedulingService.cancelScheduledEmail.bind(schedulingService)),

    // Service instances for advanced testing
    awsService,
    smtpService,
    templateService,
    schedulingService
  }
}

// Export default mock setup for easy jest.mock() usage
export const mockEmailService = createEmailServiceMocks()