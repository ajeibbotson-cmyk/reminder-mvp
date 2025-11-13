import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Postmark Delivery Webhook Handler
 * Confirms successful email delivery
 *
 * Webhook Documentation: https://postmarkapp.com/developer/webhooks/delivery-webhook
 */
export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json()

    // Postmark delivery webhook format
    const {
      MessageID,
      RecordType, // "Delivery"
      Recipient, // Email address
      DeliveredAt, // ISO timestamp
      Details,
      ServerID
    } = webhook

    console.log(`[Postmark Webhook] Email delivered to ${Recipient}`)

    // Find email log by Postmark MessageID
    const emailLog = await prisma.emailLog.findFirst({
      where: { awsMessageId: MessageID }
    })

    if (!emailLog) {
      console.warn(`[Postmark Webhook] Email log not found for MessageID: ${MessageID}`)
      return NextResponse.json({ received: true, message: 'Email log not found' })
    }

    // Update email log with delivery confirmation
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date(DeliveredAt),
        updatedAt: new Date()
      }
    })

    console.log(`✅ [Postmark Webhook] Confirmed delivery for ${Recipient}`)

    return NextResponse.json({
      received: true,
      processed: true,
      emailLogId: emailLog.id
    })

  } catch (error) {
    console.error('❌ [Postmark Webhook] Delivery webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
