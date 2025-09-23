/**
 * AWS SES Webhook Handler for Consolidation Email Events
 * Handles delivery, bounce, complaint, open, and click events from AWS SES
 * with specific support for consolidated email tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { awsSESConsolidationService } from '@/lib/services/aws-ses-consolidation-service'
import { headers } from 'next/headers'

interface SESWebhookEvent {
  eventType: string
  mail?: {
    messageId: string
    timestamp: string
    source: string
    destination: string[]
  }
  delivery?: {
    timestamp: string
    processingTimeMillis: number
    recipients: string[]
  }
  bounce?: {
    bounceType: string
    bounceSubType: string
    bouncedRecipients: Array<{
      emailAddress: string
      status?: string
      action?: string
      diagnosticCode?: string
    }>
    timestamp: string
  }
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string
    }>
    timestamp: string
    complaintFeedbackType?: string
  }
  open?: {
    timestamp: string
    userAgent?: string
    ipAddress?: string
  }
  click?: {
    timestamp: string
    userAgent?: string
    ipAddress?: string
    link?: string
  }
}

interface SESNotification {
  Type: string
  Message: string
  Timestamp: string
  MessageId: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Received AWS SES webhook event')

    // Verify the webhook source (in production, verify SNS signature)
    const headersList = headers()
    const userAgent = headersList.get('user-agent')
    const contentType = headersList.get('content-type')

    if (!userAgent?.includes('Amazon') && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Suspicious webhook request - non-Amazon user agent')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Handle SNS notification format
    if (body.Type === 'Notification') {
      const notification: SESNotification = body
      const eventData: SESWebhookEvent = JSON.parse(notification.Message)

      await processWebhookEvent(eventData)

      return NextResponse.json({ message: 'Webhook processed successfully' })
    }

    // Handle direct SES event format
    if (body.eventType) {
      await processWebhookEvent(body as SESWebhookEvent)
      return NextResponse.json({ message: 'Event processed successfully' })
    }

    console.warn('⚠️ Unknown webhook format received')
    return NextResponse.json({ error: 'Unknown webhook format' }, { status: 400 })

  } catch (error) {
    console.error('❌ Failed to process SES webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

async function processWebhookEvent(eventData: SESWebhookEvent): Promise<void> {
  try {
    console.log(`🔔 Processing SES event: ${eventData.eventType}`)

    switch (eventData.eventType) {
      case 'delivery':
        await awsSESConsolidationService.handleSESWebhook('delivery', eventData)
        console.log('✅ Delivery event processed')
        break

      case 'bounce':
        await awsSESConsolidationService.handleSESWebhook('bounce', eventData)
        console.log('📋 Bounce event processed')
        break

      case 'complaint':
        await awsSESConsolidationService.handleSESWebhook('complaint', eventData)
        console.log('⚠️ Complaint event processed')
        break

      case 'open':
        await awsSESConsolidationService.handleSESWebhook('open', eventData)
        console.log('👁️ Open event processed')
        break

      case 'click':
        await awsSESConsolidationService.handleSESWebhook('click', eventData)
        console.log('🖱️ Click event processed')
        break

      case 'send':
        // Handle send confirmation
        console.log('📤 Send event logged')
        break

      case 'reject':
        // Handle send rejection
        console.log('❌ Send rejection logged')
        break

      default:
        console.log(`⚠️ Unknown event type: ${eventData.eventType}`)
    }

  } catch (error) {
    console.error('Failed to process webhook event:', error)
    throw error
  }
}

// Handle SNS subscription confirmation (one-time setup)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const topicArn = searchParams.get('TopicArn')

  if (token && topicArn) {
    console.log('🔗 SNS subscription confirmation received')
    // In production, confirm the subscription by visiting the SubscribeURL
    return NextResponse.json({
      message: 'SNS subscription confirmation received',
      token,
      topicArn
    })
  }

  return NextResponse.json({
    message: 'AWS SES Webhook Endpoint',
    supported_events: [
      'delivery',
      'bounce',
      'complaint',
      'open',
      'click',
      'send',
      'reject'
    ],
    consolidation_support: true
  })
}