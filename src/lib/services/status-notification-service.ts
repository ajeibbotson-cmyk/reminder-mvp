/**
 * Status Notification Integration Service
 * Integrates invoice status management with email and payment systems
 * 
 * Features:
 * - Automated email notifications for status changes
 * - Integration with existing email service
 * - Payment system integration hooks
 * - UAE business hours compliance
 * - Template-based notifications
 */

import { EmailService, SendEmailOptions } from '../email-service'
import { prisma } from '../prisma'
import { formatUAECurrency } from '../vat-calculator'
import { InvoiceStatus, UserRole } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Status notification configuration
export interface StatusNotificationConfig {
  emailEnabled: boolean
  smsEnabled: boolean
  webhookEnabled: boolean
  respectBusinessHours: boolean
  delayMinutes: number
  retryAttempts: number
  templateOverrides: Record<string, string>
}

// Notification context for templates
export interface NotificationContext {
  invoice: {
    id: string
    number: string
    amount: number
    currency: string
    dueDate: Date
    customerName: string
    customerEmail: string
    status: InvoiceStatus
    previousStatus?: InvoiceStatus
    trnNumber?: string
  }
  company: {
    id: string
    name: string
    email: string
    phone?: string
    address?: string
    trn?: string
  }
  statusChange: {
    changedBy: string
    changedAt: Date
    reason: string
    notes?: string
    automatedChange: boolean
  }
  paymentInfo?: {
    totalPaid: number
    remainingAmount: number
    lastPaymentDate?: Date
    isFullyPaid: boolean
  }
  businessContext: {
    isOverdue: boolean
    daysPastDue: number
    formattedAmounts: {
      total: string
      paid: string
      remaining: string
    }
  }
}

// Email template types for status notifications
export enum StatusNotificationTemplate {
  INVOICE_SENT = 'INVOICE_SENT',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER', 
  OVERDUE_NOTICE = 'OVERDUE_NOTICE',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  DISPUTE_INITIATED = 'DISPUTE_INITIATED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  WRITEOFF_NOTICE = 'WRITEOFF_NOTICE'
}

/**
 * Status Notification Service
 * Handles all notification aspects of invoice status changes
 */
export class StatusNotificationService {
  private emailService: EmailService
  private defaultConfig: StatusNotificationConfig = {
    emailEnabled: true,
    smsEnabled: false,
    webhookEnabled: false,
    respectBusinessHours: true,
    delayMinutes: 0,
    retryAttempts: 3,
    templateOverrides: {}
  }

  constructor(emailService: EmailService) {
    this.emailService = emailService
  }

  /**
   * Send status change notification
   */
  async sendStatusChangeNotification(
    context: NotificationContext,
    config: Partial<StatusNotificationConfig> = {}
  ): Promise<{
    emailSent: boolean
    smsSent: boolean
    webhookSent: boolean
    scheduledFor?: Date
    errors: string[]
  }> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const result = {
      emailSent: false,
      smsSent: false,
      webhookSent: false,
      scheduledFor: undefined as Date | undefined,
      errors: [] as string[]
    }

    try {
      // Determine notification type based on status transition
      const notificationType = this.getNotificationType(
        context.invoice.previousStatus,
        context.invoice.status
      )

      if (!notificationType) {
        // No notification needed for this status change
        return result
      }

      // Send email notification
      if (finalConfig.emailEnabled) {
        try {
          const emailResult = await this.sendEmailNotification(
            context,
            notificationType,
            finalConfig
          )
          result.emailSent = emailResult.sent
          result.scheduledFor = emailResult.scheduledFor
        } catch (error) {
          result.errors.push(`Email notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Send SMS notification (if enabled)
      if (finalConfig.smsEnabled && context.company.phone) {
        try {
          const smsResult = await this.sendSMSNotification(
            context,
            notificationType,
            finalConfig
          )
          result.smsSent = smsResult.sent
        } catch (error) {
          result.errors.push(`SMS notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Send webhook notification (if enabled)
      if (finalConfig.webhookEnabled) {
        try {
          const webhookResult = await this.sendWebhookNotification(
            context,
            notificationType,
            finalConfig
          )
          result.webhookSent = webhookResult.sent
        } catch (error) {
          result.errors.push(`Webhook notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return result

    } catch (error) {
      result.errors.push(`Notification service error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return result
    }
  }

  /**
   * Send automated payment reminder
   */
  async sendPaymentReminder(
    invoiceId: string,
    reminderType: 'GENTLE' | 'URGENT' | 'FINAL'
  ): Promise<boolean> {
    try {
      // Get invoice with full context
      const invoice = await prisma.invoices.findUnique({
        where: { id: invoiceId },
        include: {
          companies: true,
          customers: true,
          payments: { select: { amount: true, paymentDate: true } }
        }
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // Build notification context
      const context = await this.buildNotificationContext(invoice, {
        changedBy: 'System',
        changedAt: new Date(),
        reason: `Automated ${reminderType.toLowerCase()} payment reminder`,
        automatedChange: true
      })

      // Determine template based on reminder type
      let templateType: StatusNotificationTemplate
      switch (reminderType) {
        case 'GENTLE':
          templateType = StatusNotificationTemplate.PAYMENT_REMINDER
          break
        case 'URGENT':
        case 'FINAL':
          templateType = StatusNotificationTemplate.OVERDUE_NOTICE
          break
      }

      const result = await this.sendEmailNotification(
        context,
        templateType,
        {
          delayMinutes: 0,
          respectBusinessHours: true
        }
      )

      return result.sent

    } catch (error) {
      console.error('Payment reminder failed:', error)
      return false
    }
  }

  /**
   * Integrate with payment system events
   */
  async handlePaymentReceived(
    invoiceId: string,
    paymentAmount: number,
    paymentReference?: string
  ): Promise<void> {
    try {
      // Get invoice and check if it should be marked as paid
      const invoice = await prisma.invoices.findUnique({
        where: { id: invoiceId },
        include: {
          companies: true,
          customers: true,
          payments: { select: { amount: true } }
        }
      })

      if (!invoice) return

      // Calculate total payments
      const totalPaid = invoice.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Decimal(paymentAmount)
      )

      const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)
      const isFullyPaid = totalPaid.greaterThanOrEqualTo(totalAmount.times(0.99)) // 1% tolerance

      // If fully paid, we might want to trigger status change
      if (isFullyPaid && invoice.status !== InvoiceStatus.PAID) {
        const context = await this.buildNotificationContext(invoice, {
          changedBy: 'Payment System',
          changedAt: new Date(),
          reason: `Payment received: ${paymentReference || 'No reference'}`,
          automatedChange: true
        })

        // Send payment confirmation
        await this.sendEmailNotification(
          context,
          StatusNotificationTemplate.PAYMENT_RECEIVED,
          { delayMinutes: 5 } // Brief delay to ensure payment is processed
        )
      }

    } catch (error) {
      console.error('Payment notification failed:', error)
    }
  }

  // Private methods

  private getNotificationType(
    fromStatus?: InvoiceStatus,
    toStatus?: InvoiceStatus
  ): StatusNotificationTemplate | null {
    if (!fromStatus || !toStatus) return null

    const transition = `${fromStatus}->${toStatus}`

    const transitionMap: Record<string, StatusNotificationTemplate> = {
      'DRAFT->SENT': StatusNotificationTemplate.INVOICE_SENT,
      'SENT->OVERDUE': StatusNotificationTemplate.OVERDUE_NOTICE,
      'OVERDUE->PAID': StatusNotificationTemplate.PAYMENT_RECEIVED,
      'SENT->PAID': StatusNotificationTemplate.PAYMENT_RECEIVED,
      'SENT->DISPUTED': StatusNotificationTemplate.DISPUTE_INITIATED,
      'OVERDUE->DISPUTED': StatusNotificationTemplate.DISPUTE_INITIATED,
      'DISPUTED->PAID': StatusNotificationTemplate.DISPUTE_RESOLVED,
      'DISPUTED->SENT': StatusNotificationTemplate.DISPUTE_RESOLVED,
      'SENT->WRITTEN_OFF': StatusNotificationTemplate.WRITEOFF_NOTICE,
      'OVERDUE->WRITTEN_OFF': StatusNotificationTemplate.WRITEOFF_NOTICE,
      'DISPUTED->WRITTEN_OFF': StatusNotificationTemplate.WRITEOFF_NOTICE
    }

    return transitionMap[transition] || null
  }

  private async sendEmailNotification(
    context: NotificationContext,
    templateType: StatusNotificationTemplate,
    config: Partial<StatusNotificationConfig>
  ): Promise<{ sent: boolean; scheduledFor?: Date }> {
    // Get template ID for the notification type
    const template = await this.getEmailTemplate(context.company.id, templateType)
    
    if (!template) {
      // Fall back to default content
      const { subject, content } = this.getDefaultEmailContent(templateType, context)
      
      const emailId = await this.emailService.sendEmail({
        companyId: context.company.id,
        invoiceId: context.invoice.id,
        recipientEmail: context.invoice.customerEmail,
        recipientName: context.invoice.customerName,
        subject,
        content,
        language: 'ENGLISH',
        scheduleForBusinessHours: config.respectBusinessHours,
        delayMinutes: config.delayMinutes,
        variables: this.buildEmailVariables(context)
      })

      return { sent: !!emailId }
    }

    // Use existing template
    const emailId = await this.emailService.sendEmail({
      templateId: template.id,
      companyId: context.company.id,
      invoiceId: context.invoice.id,
      recipientEmail: context.invoice.customerEmail,
      recipientName: context.invoice.customerName,
      language: 'ENGLISH',
      scheduleForBusinessHours: config.respectBusinessHours,
      delayMinutes: config.delayMinutes,
      variables: this.buildEmailVariables(context)
    })

    return { sent: !!emailId }
  }

  private async sendSMSNotification(
    context: NotificationContext,
    templateType: StatusNotificationTemplate,
    config: Partial<StatusNotificationConfig>
  ): Promise<{ sent: boolean }> {
    // SMS implementation would go here
    // For now, just log that it would be sent
    console.log(`SMS notification would be sent for ${templateType}`)
    return { sent: false }
  }

  private async sendWebhookNotification(
    context: NotificationContext,
    templateType: StatusNotificationTemplate,
    config: Partial<StatusNotificationConfig>
  ): Promise<{ sent: boolean }> {
    // Webhook implementation would go here
    // For now, just log that it would be sent
    console.log(`Webhook notification would be sent for ${templateType}`)
    return { sent: false }
  }

  private async getEmailTemplate(companyId: string, templateType: StatusNotificationTemplate) {
    return await prisma.emailTemplates.findFirst({
      where: {
        companyId,
        type: templateType,
        isActive: true
      }
    })
  }

  private getDefaultEmailContent(
    templateType: StatusNotificationTemplate,
    context: NotificationContext
  ): { subject: string; content: string } {
    const { invoice, company } = context

    switch (templateType) {
      case StatusNotificationTemplate.INVOICE_SENT:
        return {
          subject: `Invoice ${invoice.number} - Payment Due`,
          content: `Dear ${invoice.customerName},\n\nYour invoice ${invoice.number} for ${context.businessContext.formattedAmounts.total} is now due.\n\nDue Date: ${invoice.dueDate.toLocaleDateString()}\n\nPlease arrange payment at your earliest convenience.\n\nBest regards,\n${company.name}`
        }

      case StatusNotificationTemplate.OVERDUE_NOTICE:
        return {
          subject: `URGENT: Invoice ${invoice.number} is Past Due`,
          content: `Dear ${invoice.customerName},\n\nInvoice ${invoice.number} for ${context.businessContext.formattedAmounts.total} is now ${context.businessContext.daysPastDue} days overdue.\n\nImmediate payment is required to avoid further action.\n\nPlease contact us immediately to resolve this matter.\n\nBest regards,\n${company.name}`
        }

      case StatusNotificationTemplate.PAYMENT_RECEIVED:
        return {
          subject: `Payment Confirmed - Invoice ${invoice.number}`,
          content: `Dear ${invoice.customerName},\n\nThank you for your payment on invoice ${invoice.number}.\n\nPayment Amount: ${context.businessContext.formattedAmounts.paid}\nRemaining Balance: ${context.businessContext.formattedAmounts.remaining}\n\nWe appreciate your business.\n\nBest regards,\n${company.name}`
        }

      case StatusNotificationTemplate.DISPUTE_INITIATED:
        return {
          subject: `Invoice ${invoice.number} - Dispute Initiated`,
          content: `Dear ${invoice.customerName},\n\nWe have received your dispute regarding invoice ${invoice.number}.\n\nOur team will review this matter and contact you within 2 business days.\n\nThank you for bringing this to our attention.\n\nBest regards,\n${company.name}`
        }

      case StatusNotificationTemplate.DISPUTE_RESOLVED:
        return {
          subject: `Invoice ${invoice.number} - Dispute Resolved`,
          content: `Dear ${invoice.customerName},\n\nThe dispute for invoice ${invoice.number} has been resolved.\n\nUpdated Status: ${invoice.status}\n\nIf you have any further questions, please contact us.\n\nBest regards,\n${company.name}`
        }

      case StatusNotificationTemplate.WRITEOFF_NOTICE:
        return {
          subject: `Invoice ${invoice.number} - Account Update`,
          content: `Dear ${invoice.customerName},\n\nInvoice ${invoice.number} has been written off as per our company policy.\n\nNo further action is required from your side.\n\nBest regards,\n${company.name}`
        }

      default:
        return {
          subject: `Invoice ${invoice.number} - Status Update`,
          content: `Dear ${invoice.customerName},\n\nInvoice ${invoice.number} status has been updated to ${invoice.status}.\n\nBest regards,\n${company.name}`
        }
    }
  }

  private buildEmailVariables(context: NotificationContext): Record<string, any> {
    return {
      // Invoice variables
      invoiceNumber: context.invoice.number,
      invoiceAmount: context.businessContext.formattedAmounts.total,
      invoiceDueDate: context.invoice.dueDate.toLocaleDateString(),
      invoiceStatus: context.invoice.status,
      customerName: context.invoice.customerName,
      
      // Payment variables
      totalPaid: context.businessContext.formattedAmounts.paid,
      remainingAmount: context.businessContext.formattedAmounts.remaining,
      isFullyPaid: context.paymentInfo?.isFullyPaid || false,
      
      // Company variables
      companyName: context.company.name,
      companyEmail: context.company.email,
      companyPhone: context.company.phone || '',
      companyTRN: context.company.trn || '',
      
      // Status change variables
      changedBy: context.statusChange.changedBy,
      changedAt: context.statusChange.changedAt.toLocaleString(),
      changeReason: context.statusChange.reason,
      
      // Business context
      isOverdue: context.businessContext.isOverdue,
      daysPastDue: context.businessContext.daysPastDue,
      
      // UAE-specific
      currentDate: new Date().toLocaleDateString(),
      currency: context.invoice.currency
    }
  }

  private async buildNotificationContext(
    invoice: any,
    statusChangeInfo: {
      changedBy: string
      changedAt: Date
      reason: string
      notes?: string
      automatedChange: boolean
    }
  ): Promise<NotificationContext> {
    // Calculate payment information
    const totalPaid = invoice.payments.reduce(
      (sum: Decimal, payment: any) => sum.plus(payment.amount),
      new Decimal(0)
    )
    const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)
    const remainingAmount = totalAmount.minus(totalPaid)
    const isOverdue = invoice.dueDate < new Date() && 
      ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)

    return {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        amount: invoice.totalAmount || invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        status: invoice.status,
        trnNumber: invoice.trnNumber
      },
      company: {
        id: invoice.companies.id,
        name: invoice.companies.name,
        email: invoice.companies.email,
        phone: invoice.companies.phone,
        address: invoice.companies.address,
        trn: invoice.companies.trn
      },
      statusChange: statusChangeInfo,
      paymentInfo: {
        totalPaid: totalPaid.toNumber(),
        remainingAmount: remainingAmount.toNumber(),
        lastPaymentDate: invoice.payments.length > 0 ? 
          new Date(Math.max(...invoice.payments.map((p: any) => p.paymentDate.getTime()))) : 
          undefined,
        isFullyPaid: remainingAmount.lessThanOrEqualTo(0)
      },
      businessContext: {
        isOverdue,
        daysPastDue: isOverdue ? 
          Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        formattedAmounts: {
          total: formatUAECurrency(totalAmount, invoice.currency),
          paid: formatUAECurrency(totalPaid, invoice.currency),
          remaining: formatUAECurrency(remainingAmount, invoice.currency)
        }
      }
    }
  }
}

// Export singleton instance
let emailService: EmailService | null = null

// Initialize with default configuration
const defaultEmailConfig = {
  provider: 'smtp' as const,
  credentials: {
    smtpHost: process.env.SMTP_HOST || 'localhost',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || ''
  },
  fromEmail: process.env.FROM_EMAIL || 'noreply@uaepay.com',
  fromName: process.env.FROM_NAME || 'Reminder Invoice System',
  maxRetries: 3,
  retryDelayMs: 5000
}

if (!emailService) {
  emailService = new EmailService(defaultEmailConfig)
}

export const statusNotificationService = new StatusNotificationService(emailService)