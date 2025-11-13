import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Postmark Click Tracking Webhook Handler
 * Tracks when recipients click links in emails
 *
 * Webhook Documentation: https://postmarkapp.com/developer/webhooks/click-webhook
 */
export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json()

    // Postmark click webhook format
    const {
      MessageID,
      RecordType, // "Click"
      Recipient, // Email address
      ReceivedAt, // ISO timestamp
      OriginalLink, // The actual URL that was clicked
      UserAgent,
      Platform,
      Client,
      OS,
      Geo // Geographic location data
    } = webhook

    console.log(`[Postmark Webhook] Link clicked by ${Recipient}: ${OriginalLink}`)

    // Find email log by Postmark MessageID
    const emailLog = await prisma.emailLog.findFirst({
      where: { awsMessageId: MessageID }
    })

    if (!emailLog) {
      console.warn(`[Postmark Webhook] Email log not found for MessageID: ${MessageID}`)
      return NextResponse.json({ received: true, message: 'Email log not found' })
    }

    // Update email log with first click tracking
    if (!emailLog.clickedAt) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          clickedAt: new Date(ReceivedAt),
          deliveryStatus: 'CLICKED',
          updatedAt: new Date()
        }
      })
    }

    // Create click tracking record
    await prisma.emailClickTracking.create({
      data: {
        id: crypto.randomUUID(),
        emailLogId: emailLog.id,
        clickedAt: new Date(ReceivedAt),
        url: OriginalLink,
        userAgent: UserAgent || null,
        ipAddress: Geo?.IP || null,
        location: Geo?.City && Geo?.Country ? `${Geo.City}, ${Geo.Country}` : null
      }
    })

    console.log(`✅ [Postmark Webhook] Tracked click for ${Recipient}`)

    return NextResponse.json({
      received: true,
      processed: true,
      emailLogId: emailLog.id,
      link: OriginalLink
    })

  } catch (error) {
    console.error('❌ [Postmark Webhook] Click webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
