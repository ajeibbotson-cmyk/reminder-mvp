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
  const { bounce_type, bounceSubType, bouncedRecipients, timestamp } = bounce
  
  for (const recipient of bouncedRecipients) {
    const { emailAddress, action, status, diagnostic_code } = recipient
    
    try {
      // Find the email log entry using message ID
      const emailLog = await prisma.email_logs.findFirst({
        where: {
          aws_message_id: mail.messageId,
          recipient_email: emailAddress
        }
      })

      if (emailLog) {
        // Update email log status
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            delivery_status: 'BOUNCED',
            bounced_at: new Date(timestamp),
            bounce_reason: `${bounce_type}: ${diagnostic_code || status}`
          }
        })

        // Create bounce tracking record
        await prisma.email_bounce_tracking.create({
          data: {
            id: crypto.randomUUID(),
            email_log_id: emailLog.id,
            bounce_type: bounce_type.toLowerCase(),
            bounce_subtype: bounceSubType?.toLowerCase(),
            diagnostic_code,
            arrival_date: new Date(timestamp),
            is_suppressed: bounce_type === 'Permanent'
          }
        })

        // For hard bounces, mark email address for suppression
        if (bounce_type === 'Permanent') {
          await suppressEmailAddress(emailAddress, emailLog.company_id, 'hard_bounce')
        }

        console.log(`Processed bounce for ${emailAddress}: ${bounce_type}`)
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
      const emailLog = await prisma.email_logs.findFirst({
        where: {
          aws_message_id: mail.messageId,
          recipient_email: emailAddress
        }
      })

      if (emailLog) {
        // Update email log status
        await prisma.email_logs.update({
          where: { id: emailLog.id },
          data: {
            delivery_status: 'COMPLAINED',
            complainedAt: new Date(timestamp),
            complaintFeedback: complaintFeedbackType || 'Spam complaint'
          }
        })

        // Create bounce tracking record for complaint
        await prisma.email_bounce_tracking.create({
          data: {
            id: crypto.randomUUID(),
            email_log_id: emailLog.id,
            bounce_type: 'complaint',
            bounce_subtype: complaintFeedbackType?.toLowerCase(),
            feedbackId,
            arrival_date: new Date(timestamp),
            is_suppressed: true // Always suppress complaints
          }
        })

        // Suppress email address immediately for complaints
        await suppressEmailAddress(emailAddress, emailLog.company_id, 'complaint')

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
      const result = await prisma.email_logs.updateMany({
        where: {
          aws_message_id: mail.messageId,
          recipient_email: emailAddress,
          delivery_status: 'SENT' // Only update if still in SENT status
        },
        data: {
          delivery_status: 'DELIVERED',
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