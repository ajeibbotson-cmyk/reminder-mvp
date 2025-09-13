import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Verify SNS message signature (basic validation)
    const messageType = request.headers.get('x-amz-sns-message-type')
    
    if (!messageType) {
      return NextResponse.json({ error: 'Missing SNS message type header' }, { status: 400 })
    }

    // Handle SNS subscription confirmation
    if (messageType === 'SubscriptionConfirmation') {
      const { SubscribeURL } = body
      
      if (SubscribeURL) {
        // In production, you'd make a GET request to SubscribeURL
        console.log('SNS Subscription URL:', SubscribeURL)
        return NextResponse.json({ message: 'Subscription confirmation logged' })
      }
      
      return NextResponse.json({ error: 'Missing SubscribeURL' }, { status: 400 })
    }

    // Handle notification messages
    if (messageType === 'Notification') {
      const message = JSON.parse(body.Message)
      const notificationType = message.notificationType
      
      console.log('Received SES notification:', notificationType)
      
      if (notificationType === 'Bounce') {
        await handleBounceNotification(message)
      } else if (notificationType === 'Complaint') {
        await handleComplaintNotification(message)
      } else if (notificationType === 'Delivery') {
        await handleDeliveryNotification(message)
      }
      
      return NextResponse.json({ message: 'Notification processed' })
    }

    return NextResponse.json({ error: 'Unknown message type' }, { status: 400 })

  } catch (error) {
    console.error('Error processing SES webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' }, 
      { status: 500 }
    )
  }
}

/**
 * Handle bounce notifications from SES
 */
async function handleBounceNotification(message: any) {
  const { bounce, mail } = message
  const { bounceType, bounceSubType, bouncedRecipients, timestamp } = bounce
  
  for (const recipient of bouncedRecipients) {
    const { emailAddress, action, status, diagnosticCode } = recipient
    
    try {
      // Find the email log entry using message ID
      const emailLog = await prisma.emailLog.findFirst({
        where: {
          awsMessageId: mail.messageId,
          recipientEmail: emailAddress
        }
      })

      if (emailLog) {
        // Update email log status
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            deliveryStatus: 'BOUNCED',
            bouncedAt: new Date(timestamp),
            bounceReason: `${bounceType}: ${diagnosticCode || status}`
          }
        })

        // Create bounce tracking record
        await prisma.emailBounceTracking.create({
          data: {
            id: crypto.randomUUID(),
            emailLogId: emailLog.id,
            bounceType: bounceType.toLowerCase(),
            bounceSubtype: bounceSubType?.toLowerCase(),
            diagnosticCode,
            arrivalDate: new Date(timestamp),
            isSuppressed: bounceType === 'Permanent'
          }
        })

        // For hard bounces, mark email address for suppression
        if (bounceType === 'Permanent') {
          await suppressEmailAddress(emailAddress, emailLog.companyId, 'hard_bounce')
        }

        console.log(`Processed bounce for ${emailAddress}: ${bounceType}`)
      } else {
        console.warn(`Could not find email log for message ID: ${mail.messageId}`)
      }

    } catch (error) {
      console.error(`Failed to process bounce for ${emailAddress}:`, error)
    }
  }
}

/**
 * Handle complaint notifications from SES
 */
async function handleComplaintNotification(message: any) {
  const { complaint, mail } = message
  const { complainedRecipients, timestamp, feedbackId, complaintFeedbackType } = complaint
  
  for (const recipient of complainedRecipients) {
    const { emailAddress } = recipient
    
    try {
      // Find the email log entry using message ID
      const emailLog = await prisma.emailLog.findFirst({
        where: {
          awsMessageId: mail.messageId,
          recipientEmail: emailAddress
        }
      })

      if (emailLog) {
        // Update email log status
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            deliveryStatus: 'COMPLAINED',
            complainedAt: new Date(timestamp),
            complaintFeedback: complaintFeedbackType || 'Spam complaint'
          }
        })

        // Create bounce tracking record for complaint
        await prisma.emailBounceTracking.create({
          data: {
            id: crypto.randomUUID(),
            emailLogId: emailLog.id,
            bounceType: 'complaint',
            bounceSubtype: complaintFeedbackType?.toLowerCase(),
            feedbackId,
            arrivalDate: new Date(timestamp),
            isSuppressed: true // Always suppress complaints
          }
        })

        // Suppress email address immediately for complaints
        await suppressEmailAddress(emailAddress, emailLog.companyId, 'complaint')

        console.log(`Processed complaint for ${emailAddress}: ${complaintFeedbackType || 'spam'}`)
      } else {
        console.warn(`Could not find email log for message ID: ${mail.messageId}`)
      }

    } catch (error) {
      console.error(`Failed to process complaint for ${emailAddress}:`, error)
    }
  }
}

/**
 * Handle delivery notifications from SES
 */
async function handleDeliveryNotification(message: any) {
  const { delivery, mail } = message
  const { recipients, timestamp } = delivery
  
  for (const emailAddress of recipients) {
    try {
      // Update email log status to delivered
      const result = await prisma.emailLog.updateMany({
        where: {
          awsMessageId: mail.messageId,
          recipientEmail: emailAddress,
          deliveryStatus: 'SENT' // Only update if still in SENT status
        },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(timestamp)
        }
      })

      if (result.count > 0) {
        console.log(`Confirmed delivery for ${emailAddress}`)
      }

    } catch (error) {
      console.error(`Failed to update delivery status for ${emailAddress}:`, error)
    }
  }
}

/**
 * Suppress an email address from future communications
 */
async function suppressEmailAddress(emailAddress: string, companyId: string, reason: string) {
  try {
    // Check if customer exists and update their email status
    const customer = await prisma.customer.findFirst({
      where: {
        email: emailAddress,
        companyId
      }
    })

    if (customer) {
      // Add suppression note to customer
      const suppressionNote = `Email suppressed due to ${reason} on ${new Date().toISOString()}`
      const existingNotes = customer.notes || ''
      const newNotes = existingNotes ? `${existingNotes}\n${suppressionNote}` : suppressionNote

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          notes: newNotes
          // In a more complex system, you'd have a separate email_suppressions table
        }
      })

      console.log(`Suppressed email address ${emailAddress} for customer ${customer.id}`)
    } else {
      console.log(`No customer found for suppressed email: ${emailAddress}`)
    }

  } catch (error) {
    console.error(`Failed to suppress email address ${emailAddress}:`, error)
  }
}

// Allow preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-amz-sns-message-type',
    },
  })
}