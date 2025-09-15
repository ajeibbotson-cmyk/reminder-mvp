import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDefaultEmailService } from '@/lib/email-service'

// AWS SES Event Types
interface SESDeliveryEvent {
  eventType: 'delivery' | 'bounce' | 'complaint' | 'reject' | 'send' | 'open' | 'click'
  timestamp: string
  messageId: string
  source: string
  destination: string[]
  delivery?: {
    timestamp: string
    processingTimeMillis: number
    recipients: string[]
    smtpResponse: string
    reportingMTA: string
  }
  bounce?: {
    feedbackId: string
    bounceType: 'Undetermined' | 'Permanent' | 'Transient'
    bounceSubType: string
    bouncedRecipients: Array<{
      emailAddress: string
      action: string
      status: string
      diagnosticCode: string
    }>
    timestamp: string
    reportingMTA: string
  }
  complaint?: {
    feedbackId: string
    complaintSubType: string
    complainedRecipients: Array<{
      emailAddress: string
    }>
    timestamp: string
    userAgent: string
    complaintFeedbackType: string
    arrivalDate: string
  }
  reject?: {
    reason: string
  }
  open?: {
    timestamp: string
    userAgent: string
    ipAddress: string
  }
  click?: {
    timestamp: string
    userAgent: string
    ipAddress: string
    link: string
    linkTags: Record<string, string[]>
  }
}

interface SNSNotification {
  Type: string
  MessageId: string
  TopicArn: string
  Subject: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  SubscriptionArn: string
}

/**
 * POST /api/webhooks/ses-delivery
 * Handle AWS SES delivery notifications via SNS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const contentType = request.headers.get('content-type')

    // Handle SNS subscription confirmation
    if (contentType?.includes('text/plain')) {
      const snsMessage: SNSNotification = JSON.parse(body)

      if (snsMessage.Type === 'SubscriptionConfirmation') {
        console.log('SNS Subscription confirmation received')
        // In production, you might want to auto-confirm the subscription
        return NextResponse.json({
          message: 'Subscription confirmation received',
          subscribeURL: JSON.parse(snsMessage.Message).SubscribeURL
        })
      }

      if (snsMessage.Type === 'Notification') {
        const sesEvent: SESDeliveryEvent = JSON.parse(snsMessage.Message)
        await handleSESEvent(sesEvent)
        return NextResponse.json({ message: 'Event processed successfully' })
      }
    }

    // Handle direct SES events (for testing)
    if (contentType?.includes('application/json')) {
      const sesEvent: SESDeliveryEvent = JSON.parse(body)
      await handleSESEvent(sesEvent)
      return NextResponse.json({ message: 'Event processed successfully' })
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })

  } catch (error) {
    console.error('Failed to process SES webhook:', error)
    return NextResponse.json({
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Handle individual SES events
 */
async function handleSESEvent(event: SESDeliveryEvent): Promise<void> {
  console.log(`Processing SES event: ${event.eventType} for message ${event.messageId}`)

  // Find the email log by AWS message ID
  const emailLog = await prisma.emailLog.findFirst({
    where: { awsMessageId: event.messageId }
  })

  if (!emailLog) {
    console.warn(`Email log not found for message ID: ${event.messageId}`)
    return
  }

  const emailService = getDefaultEmailService()

  switch (event.eventType) {
    case 'send':
      // Email was successfully sent to SES
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'SENT',
          sentAt: new Date(event.timestamp)
        }
      })
      break

    case 'delivery':
      // Email was successfully delivered to recipient's mail server
      await emailService.trackEmailEvent(emailLog.id, 'OPENED', {
        timestamp: event.delivery?.timestamp,
        smtpResponse: event.delivery?.smtpResponse,
        processingTime: event.delivery?.processingTimeMillis
      })

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(event.delivery?.timestamp || event.timestamp)
        }
      })
      break

    case 'bounce':
      // Email bounced - handle hard and soft bounces
      await emailService.trackEmailEvent(emailLog.id, 'BOUNCED', {
        bounceType: event.bounce?.bounceType?.toLowerCase(),
        bounceSubtype: event.bounce?.bounceSubType,
        reason: event.bounce?.bouncedRecipients?.[0]?.diagnosticCode || 'Email bounced',
        diagnosticCode: event.bounce?.bouncedRecipients?.[0]?.diagnosticCode
      })

      // For hard bounces, add to suppression list
      if (event.bounce?.bounceType === 'Permanent') {
        await addToSuppressionList(
          emailLog.recipientEmail,
          emailLog.companyId,
          'hard_bounce',
          `Hard bounce: ${event.bounce.bounceSubType}`
        )
      }
      break

    case 'complaint':
      // Recipient marked email as spam
      await emailService.trackEmailEvent(emailLog.id, 'COMPLAINED', {
        complaintType: event.complaint?.complaintFeedbackType,
        complaintSubType: event.complaint?.complaintSubType,
        feedback: `Spam complaint: ${event.complaint?.complaintFeedbackType}`,
        userAgent: event.complaint?.userAgent
      })

      // Add to suppression list
      await addToSuppressionList(
        emailLog.recipientEmail,
        emailLog.companyId,
        'complaint',
        `Spam complaint: ${event.complaint?.complaintFeedbackType}`
      )
      break

    case 'reject':
      // Email was rejected by SES (usually due to policy violations)
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'FAILED',
          bounceReason: event.reject?.reason || 'Email rejected by SES'
        }
      })
      break

    case 'open':
      // Email was opened by recipient
      await emailService.trackEmailEvent(emailLog.id, 'OPENED', {
        timestamp: event.open?.timestamp,
        userAgent: event.open?.userAgent,
        ipAddress: event.open?.ipAddress
      })
      break

    case 'click':
      // Link in email was clicked
      await emailService.trackEmailEvent(emailLog.id, 'CLICKED', {
        timestamp: event.click?.timestamp,
        userAgent: event.click?.userAgent,
        ipAddress: event.click?.ipAddress,
        link: event.click?.link,
        linkTags: event.click?.linkTags
      })
      break

    default:
      console.warn(`Unknown SES event type: ${event.eventType}`)
  }

  // Log the webhook event for debugging
  await logWebhookEvent(event, emailLog.id)
}

/**
 * Add email address to suppression list
 */
async function addToSuppressionList(
  emailAddress: string,
  companyId: string,
  suppressionType: string,
  reason: string
): Promise<void> {
  try {
    await prisma.emailSuppressionList.upsert({
      where: {
        emailAddress_companyId: {
          emailAddress,
          companyId
        }
      },
      update: {
        suppressionType,
        reason,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        id: crypto.randomUUID(),
        emailAddress,
        companyId,
        suppressionType,
        reason,
        suppressedAt: new Date(),
        isActive: true
      }
    })

    console.log(`Added ${emailAddress} to suppression list: ${reason}`)
  } catch (error) {
    console.error(`Failed to add ${emailAddress} to suppression list:`, error)
  }
}

/**
 * Log webhook events for debugging and compliance
 */
async function logWebhookEvent(
  event: SESDeliveryEvent,
  emailLogId: string
): Promise<void> {
  try {
    // Store webhook event details (you might want to create a dedicated table for this)
    console.log({
      eventType: 'ses_webhook_received',
      emailLogId,
      messageId: event.messageId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      details: JSON.stringify(event)
    })

    // In production, you might want to store this in a dedicated webhooks table:
    /*
    await prisma.webhookEvent.create({
      data: {
        id: crypto.randomUUID(),
        source: 'aws-ses',
        eventType: event.eventType,
        messageId: event.messageId,
        emailLogId,
        payload: event,
        processedAt: new Date()
      }
    })
    */
  } catch (error) {
    console.error('Failed to log webhook event:', error)
  }
}

/**
 * GET /api/webhooks/ses-delivery
 * Health check endpoint for SES webhook
 */
export async function GET() {
  return NextResponse.json({
    service: 'SES Delivery Webhook',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
}

/**
 * Test endpoint for simulating SES events (development only)
 */
export async function PUT(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Test endpoint not available in production' }, { status: 403 })
  }

  try {
    const { messageId, eventType } = await request.json()

    if (!messageId || !eventType) {
      return NextResponse.json({ error: 'messageId and eventType required' }, { status: 400 })
    }

    // Create a mock SES event
    const mockEvent: SESDeliveryEvent = {
      eventType: eventType as any,
      timestamp: new Date().toISOString(),
      messageId,
      source: 'test@example.com',
      destination: ['test@recipient.com'],
      ...(eventType === 'delivery' && {
        delivery: {
          timestamp: new Date().toISOString(),
          processingTimeMillis: 1200,
          recipients: ['test@recipient.com'],
          smtpResponse: '250 2.0.0 OK',
          reportingMTA: 'a8-70.smtp-out.amazonses.com'
        }
      }),
      ...(eventType === 'bounce' && {
        bounce: {
          feedbackId: 'mock-feedback-id',
          bounceType: 'Permanent',
          bounceSubType: 'General',
          bouncedRecipients: [{
            emailAddress: 'test@recipient.com',
            action: 'failed',
            status: '5.1.1',
            diagnosticCode: 'smtp; 550 5.1.1 user unknown'
          }],
          timestamp: new Date().toISOString(),
          reportingMTA: 'dsn; a8-70.smtp-out.amazonses.com'
        }
      }),
      ...(eventType === 'open' && {
        open: {
          timestamp: new Date().toISOString(),
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ipAddress: '192.0.2.1'
        }
      })
    }

    await handleSESEvent(mockEvent)

    return NextResponse.json({
      message: 'Mock SES event processed successfully',
      event: mockEvent
    })

  } catch (error) {
    console.error('Failed to process mock SES event:', error)
    return NextResponse.json({
      error: 'Failed to process mock event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}