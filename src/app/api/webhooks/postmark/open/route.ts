import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Postmark Open Tracking Webhook Handler
 * Tracks when recipients open emails
 *
 * Webhook Documentation: https://postmarkapp.com/developer/webhooks/open-tracking-webhook
 */
export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json()

    // Postmark open webhook format
    const {
      MessageID,
      RecordType, // "Open"
      FirstOpen, // true if this is the first open
      Recipient, // Email address
      ReceivedAt, // ISO timestamp
      UserAgent,
      Platform,
      Client,
      OS,
      Geo // Geographic location data
    } = webhook

    console.log(`[Postmark Webhook] Email opened by ${Recipient} (FirstOpen: ${FirstOpen})`)

    // Find email log by Postmark MessageID
    const emailLog = await prisma.emailLog.findFirst({
      where: { awsMessageId: MessageID }
    })

    if (!emailLog) {
      console.warn(`[Postmark Webhook] Email log not found for MessageID: ${MessageID}`)
      return NextResponse.json({ received: true, message: 'Email log not found' })
    }

    // Update email log with open tracking
    const updateData: any = {
      updatedAt: new Date()
    }

    if (FirstOpen) {
      updateData.openedAt = new Date(ReceivedAt)
      updateData.deliveryStatus = 'OPENED'
    }

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: updateData
    })

    // Create open tracking record
    await prisma.emailOpenTracking.create({
      data: {
        id: crypto.randomUUID(),
        emailLogId: emailLog.id,
        openedAt: new Date(ReceivedAt),
        userAgent: UserAgent || null,
        ipAddress: Geo?.IP || null,
        location: Geo?.City && Geo?.Country ? `${Geo.City}, ${Geo.Country}` : null
      }
    })

    console.log(`✅ [Postmark Webhook] Tracked open for ${Recipient}`)

    return NextResponse.json({
      received: true,
      processed: true,
      emailLogId: emailLog.id,
      firstOpen: FirstOpen
    })

  } catch (error) {
    console.error('❌ [Postmark Webhook] Open webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
