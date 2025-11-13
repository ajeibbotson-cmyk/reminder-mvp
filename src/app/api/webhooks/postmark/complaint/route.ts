import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailSuppressionService } from '@/lib/services/email-suppression-service'

/**
 * Postmark Spam Complaint Webhook Handler
 * Handles when recipients mark emails as spam
 *
 * Webhook Documentation: https://postmarkapp.com/developer/webhooks/spam-complaint-webhook
 */
export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json()

    // Postmark spam complaint webhook format
    const {
      MessageID,
      RecordType, // "SpamComplaint"
      Email, // Recipient email
      BouncedAt, // ISO timestamp
      Description,
      Details
    } = webhook

    console.log(`[Postmark Webhook] Spam complaint from ${Email}`)

    // Find email log by Postmark MessageID
    const emailLog = await prisma.emailLog.findFirst({
      where: { awsMessageId: MessageID }
    })

    if (!emailLog) {
      console.warn(`[Postmark Webhook] Email log not found for MessageID: ${MessageID}`)
      return NextResponse.json({ received: true, message: 'Email log not found' })
    }

    // Update email log with complaint info
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        deliveryStatus: 'COMPLAINED',
        complainedAt: new Date(BouncedAt),
        complaintReason: Description || 'Spam complaint',
        updatedAt: new Date()
      }
    })

    // IMMEDIATELY add to suppression list - never send to this address again
    await emailSuppressionService.suppressEmail(
      Email,
      emailLog.companyId,
      'SPAM_COMPLAINT',
      Description || 'Marked as spam'
    )

    console.log(`✅ [Postmark Webhook] Added ${Email} to suppression list (spam complaint)`)

    // Create complaint tracking record
    await prisma.emailComplaintTracking.create({
      data: {
        id: crypto.randomUUID(),
        emailLogId: emailLog.id,
        complaintType: 'spam',
        complaintFeedback: Description || 'Spam complaint',
        arrivalDate: new Date(BouncedAt)
      }
    })

    // TODO: Notify company admin about spam complaint for review
    // This is a serious issue that needs manual investigation

    return NextResponse.json({
      received: true,
      processed: true,
      emailLogId: emailLog.id,
      suppressed: true
    })

  } catch (error) {
    console.error('❌ [Postmark Webhook] Complaint webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
