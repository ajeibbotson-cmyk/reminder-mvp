import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailSuppressionService } from '@/lib/services/email-suppression-service'

/**
 * Postmark Bounce Webhook Handler
 * Handles hard and soft bounces from Postmark
 *
 * Webhook Documentation: https://postmarkapp.com/developer/webhooks/bounce-webhook
 */
export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json()

    // Postmark bounce webhook format
    const {
      MessageID,
      RecordType, // "Bounce"
      Type, // "HardBounce" or "SoftBounce"
      TypeCode, // Numeric code
      Email, // Recipient email
      BouncedAt, // ISO timestamp
      Description,
      Details,
      Inactive // true if email is permanently suppressed
    } = webhook

    console.log(`[Postmark Webhook] Received ${Type} for ${Email}`)

    // Find email log by Postmark MessageID
    const emailLog = await prisma.emailLog.findFirst({
      where: { awsMessageId: MessageID } // We store Postmark MessageID here
    })

    if (!emailLog) {
      console.warn(`[Postmark Webhook] Email log not found for MessageID: ${MessageID}`)
      return NextResponse.json({ received: true, message: 'Email log not found' })
    }

    // Update email log with bounce info
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        deliveryStatus: 'BOUNCED',
        bouncedAt: new Date(BouncedAt),
        bounceReason: `${Type}: ${Description}`,
        updatedAt: new Date()
      }
    })

    // Add to suppression list if hard bounce or permanently inactive
    if (Type === 'HardBounce' || Inactive) {
      await emailSuppressionService.suppressEmail(
        Email,
        emailLog.companyId,
        'HARD_BOUNCE',
        Description
      )
      console.log(`[Postmark Webhook] Added ${Email} to suppression list (${Type})`)
    }

    // Create bounce tracking record
    await prisma.emailBounceTracking.create({
      data: {
        id: crypto.randomUUID(),
        emailLogId: emailLog.id,
        bounceType: Type.toLowerCase().includes('hard') ? 'hard' : 'soft',
        bounceSubtype: Description,
        diagnosticCode: `Postmark TypeCode: ${TypeCode}`,
        arrivalDate: new Date(BouncedAt)
      }
    })

    console.log(`✅ [Postmark Webhook] Processed ${Type} for ${Email}`)

    return NextResponse.json({
      received: true,
      processed: true,
      emailLogId: emailLog.id
    })

  } catch (error) {
    console.error('❌ [Postmark Webhook] Bounce webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
