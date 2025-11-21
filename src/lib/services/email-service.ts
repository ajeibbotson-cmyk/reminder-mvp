/**
 * AWS SES Email Service
 * Handles email sending for invoice reminders with comprehensive error handling and database logging
 */

import { SESClient, SendEmailCommand, type SendEmailCommandInput } from '@aws-sdk/client-ses'
import { prisma } from '@/lib/prisma'

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export interface SendEmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent: string
  fromEmail?: string
  fromName?: string
  // Optional: For database logging
  companyId?: string
  invoiceId?: string
  customerId?: string
  templateId?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  attempts?: number
  retried?: boolean
}

/**
 * Delay helper for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if error is retryable (transient failure)
 */
function isRetryableError(error: any): boolean {
  const retryableErrors = [
    'Throttling',
    'ServiceUnavailable',
    'RequestTimeout',
    'RequestTimeTooSkewed',
    'NetworkingError',
    'TimeoutError',
  ]

  const errorMessage = error.message || error.toString()
  return retryableErrors.some(retryable => errorMessage.includes(retryable))
}

/**
 * Log email to database
 */
async function logEmailToDatabase(params: {
  recipientEmail: string
  recipientName?: string
  subject: string
  content: string
  companyId?: string
  invoiceId?: string
  customerId?: string
  templateId?: string
  awsMessageId?: string
  deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED'
  sentAt?: Date
  bounceReason?: string
}): Promise<string | null> {
  try {
    const emailLog = await prisma.emailLog.create({
      data: {
        id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        subject: params.subject,
        content: params.content,
        deliveryStatus: params.deliveryStatus,
        awsMessageId: params.awsMessageId,
        sentAt: params.sentAt,
        bounceReason: params.bounceReason,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Optional fields
        ...(params.companyId && { companyId: params.companyId }),
        ...(params.invoiceId && { invoiceId: params.invoiceId }),
        ...(params.customerId && { customerId: params.customerId }),
        ...(params.templateId && { templateId: params.templateId }),
      },
    })

    return emailLog.id
  } catch (error) {
    console.error('Failed to log email to database:', error)
    // Don't throw - logging failure shouldn't break email sending
    return null
  }
}

/**
 * Send email via AWS SES with retry logic
 */
export async function sendEmailWithRetry(
  params: SendEmailParams,
  maxRetries: number = 3
): Promise<SendEmailResult> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendEmail(params)

      // If successful, return with attempt count
      if (result.success) {
        return {
          ...result,
          attempts: attempt,
          retried: attempt > 1,
        }
      }

      // If error is not retryable, fail immediately
      if (!result.error || !isRetryableError({ message: result.error })) {
        return {
          ...result,
          attempts: attempt,
          retried: false,
        }
      }

      lastError = result.error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000
      console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms delay...`)
      await delay(delayMs)

    } catch (error) {
      lastError = error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: attempt,
          retried: false,
        }
      }

      // Exponential backoff
      const delayMs = Math.pow(2, attempt - 1) * 1000
      console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms delay...`)
      await delay(delayMs)
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : lastError,
    attempts: maxRetries,
    retried: true,
  }
}

/**
 * Send email via AWS SES (single attempt, no retry)
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    // Validate required parameters
    if (!params.to || !params.subject || (!params.htmlContent && !params.textContent)) {
      return {
        success: false,
        error: 'Missing required email parameters: to, subject, and content required',
      }
    }

    // Validate AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        success: false,
        error: 'AWS credentials not configured in environment variables',
      }
    }

    // Validate FROM email is configured
    const fromEmail = params.fromEmail || process.env.AWS_SES_FROM_EMAIL
    if (!fromEmail) {
      return {
        success: false,
        error: 'FROM email address not configured (AWS_SES_FROM_EMAIL)',
      }
    }

    // Build FROM address with optional name
    const sourceAddress = params.fromName
      ? `${params.fromName} <${fromEmail}>`
      : fromEmail

    console.log('📧 Sending email via AWS SES:', {
      to: params.to,
      from: sourceAddress,
      subject: params.subject,
      region: process.env.AWS_REGION,
    })

    // Prepare email command
    const emailParams: SendEmailCommandInput = {
      Source: sourceAddress,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8',
        },
        Body: {},
      },
    }

    // Add HTML content if provided
    if (params.htmlContent) {
      emailParams.Message!.Body!.Html = {
        Data: params.htmlContent,
        Charset: 'UTF-8',
      }
    }

    // Add text content if provided
    if (params.textContent) {
      emailParams.Message!.Body!.Text = {
        Data: params.textContent,
        Charset: 'UTF-8',
      }
    }

    // Send email
    const command = new SendEmailCommand(emailParams)
    const response = await sesClient.send(command)

    console.log('✅ Email sent successfully:', {
      messageId: response.MessageId,
      to: params.to,
      subject: params.subject,
    })

    // Log to database (non-blocking)
    if (params.companyId) {
      await logEmailToDatabase({
        recipientEmail: params.to,
        recipientName: params.fromName,
        subject: params.subject,
        content: params.htmlContent || params.textContent,
        companyId: params.companyId,
        invoiceId: params.invoiceId,
        customerId: params.customerId,
        templateId: params.templateId,
        awsMessageId: response.MessageId,
        deliveryStatus: 'SENT',
        sentAt: new Date(),
      })
    }

    return {
      success: true,
      messageId: response.MessageId,
    }
  } catch (error) {
    console.error('❌ Email send failed:', error)

    // Extract meaningful error message
    let errorMessage = 'Unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message

      // Provide helpful error messages for common issues
      if (errorMessage.includes('Email address is not verified')) {
        errorMessage = `Email address not verified in AWS SES. Please verify ${params.to} or verify your sending domain.`
      } else if (errorMessage.includes('AccessDenied')) {
        errorMessage = 'AWS SES access denied. Check IAM permissions for ses:SendEmail.'
      } else if (errorMessage.includes('InvalidParameterValue')) {
        errorMessage = 'Invalid email address format or parameters.'
      }
    }

    // Log failure to database (non-blocking)
    if (params.companyId) {
      await logEmailToDatabase({
        recipientEmail: params.to,
        recipientName: params.fromName,
        subject: params.subject,
        content: params.htmlContent || params.textContent,
        companyId: params.companyId,
        invoiceId: params.invoiceId,
        customerId: params.customerId,
        templateId: params.templateId,
        deliveryStatus: 'FAILED',
        bounceReason: errorMessage,
      })
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Send invoice reminder email
 */
export async function sendInvoiceReminder(params: {
  to: string
  customerName: string
  invoiceNumber: string
  amount: number
  currency: string
  dueDate: string
  daysOverdue?: number
}): Promise<SendEmailResult> {
  const { to, customerName, invoiceNumber, amount, currency, dueDate, daysOverdue } = params

  // Format currency amount
  const formattedAmount = new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: currency,
  }).format(amount)

  // Determine email tone based on days overdue
  const isOverdue = daysOverdue && daysOverdue > 0
  const urgency = daysOverdue && daysOverdue > 30 ? 'urgent' : 'polite'

  // Build subject line
  const subject = isOverdue
    ? `Payment Reminder: Invoice ${invoiceNumber} - ${daysOverdue} days overdue`
    : `Payment Reminder: Invoice ${invoiceNumber} due ${dueDate}`

  // HTML email template
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: ${isOverdue ? '#dc2626' : '#1f2937'}; margin-top: 0;">
      ${isOverdue ? '⚠️ Payment Overdue' : '💰 Payment Reminder'}
    </h2>
  </div>

  <p>Dear ${customerName},</p>

  <p>
    ${isOverdue
      ? `This is a ${urgency === 'urgent' ? 'urgent ' : ''}reminder that the following invoice is <strong>${daysOverdue} days overdue</strong>:`
      : `This is a friendly reminder about the following invoice:`
    }
  </p>

  <div style="background-color: #f3f4f6; border-left: 4px solid ${isOverdue ? '#dc2626' : '#3b82f6'}; padding: 16px; margin: 24px 0;">
    <p style="margin: 8px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
    <p style="margin: 8px 0;"><strong>Amount Due:</strong> ${formattedAmount}</p>
    <p style="margin: 8px 0;"><strong>Due Date:</strong> ${dueDate}</p>
    ${isOverdue ? `<p style="margin: 8px 0; color: #dc2626;"><strong>Days Overdue:</strong> ${daysOverdue} days</p>` : ''}
  </div>

  <p>
    ${isOverdue
      ? 'We kindly request immediate payment to bring your account current. If you have already made this payment, please disregard this message.'
      : 'If you have already made this payment, please disregard this message. Otherwise, we would appreciate payment at your earliest convenience.'
    }
  </p>

  <p>If you have any questions or concerns regarding this invoice, please don't hesitate to reach out to us.</p>

  <p>Thank you for your business.</p>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
    <p style="margin: 4px 0;">Best regards,</p>
    <p style="margin: 4px 0;"><strong>Accounts Receivable Team</strong></p>
    <p style="margin: 16px 0 4px 0; font-size: 12px;">
      This is an automated reminder sent via Reminder.
      Please do not reply directly to this email.
    </p>
  </div>

</body>
</html>
`

  // Plain text version
  const textContent = `
Payment Reminder - Invoice ${invoiceNumber}

Dear ${customerName},

${isOverdue
    ? `This is a ${urgency === 'urgent' ? 'urgent ' : ''}reminder that the following invoice is ${daysOverdue} days overdue:`
    : 'This is a friendly reminder about the following invoice:'
  }

Invoice Number: ${invoiceNumber}
Amount Due: ${formattedAmount}
Due Date: ${dueDate}
${isOverdue ? `Days Overdue: ${daysOverdue} days` : ''}

${isOverdue
    ? 'We kindly request immediate payment to bring your account current. If you have already made this payment, please disregard this message.'
    : 'If you have already made this payment, please disregard this message. Otherwise, we would appreciate payment at your earliest convenience.'
  }

If you have any questions or concerns regarding this invoice, please don't hesitate to reach out to us.

Thank you for your business.

Best regards,
Accounts Receivable Team

---
This is an automated reminder sent via Reminder.
Please do not reply directly to this email.
`

  // Use retry logic for invoice reminders (production-critical)
  return sendEmailWithRetry({
    to,
    subject,
    htmlContent,
    textContent,
    fromName: 'Reminder',
  }, 3) // 3 retries with exponential backoff
}
