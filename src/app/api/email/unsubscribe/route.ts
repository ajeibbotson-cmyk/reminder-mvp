import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailSuppressionService } from '@/lib/services/email-suppression-service'

export async function POST(request: NextRequest) {
  try {
    const { email, companyId, token } = await request.json()

    if (!email || !companyId) {
      return NextResponse.json({ error: 'Missing email or companyId' }, { status: 400 })
    }

    // Verify unsubscribe token if provided (for security)
    if (token) {
      const isValidToken = await verifyUnsubscribeToken(email, companyId, token)
      if (!isValidToken) {
        return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 400 })
      }
    }

    // Add to suppression list
    const suppressionId = await emailSuppressionService.suppressEmail(
      email,
      companyId,
      'unsubscribe',
      'User requested unsubscribe'
    )

    // Track unsubscribe event
    await trackUnsubscribeEvent(email, companyId, token)

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from email communications',
      suppressionId
    })

  } catch (error) {
    console.error('Error processing unsubscribe:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' }, 
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const companyId = searchParams.get('companyId')
    const token = searchParams.get('token')

    if (!email || !companyId) {
      return NextResponse.json({ error: 'Missing email or companyId' }, { status: 400 })
    }

    // Check if already unsubscribed
    const suppressionCheck = await emailSuppressionService.checkSuppression(email, companyId)
    
    // Get customer preferences if available
    const customer = await prisma.customers.findFirst({
      where: {
        email,
        companyId
      }
    })

    return NextResponse.json({
      email,
      companyId,
      isUnsubscribed: suppressionCheck.isSuppressed,
      suppressionType: suppressionCheck.suppressionType,
      suppressedAt: suppressionCheck.suppressedAt,
      customerExists: !!customer,
      customerName: customer?.name,
      preferences: await getEmailPreferences(email, companyId)
    })

  } catch (error) {
    console.error('Error checking unsubscribe status:', error)
    return NextResponse.json(
      { error: 'Failed to check unsubscribe status' }, 
      { status: 500 }
    )
  }
}

/**
 * Verify unsubscribe token for security
 */
async function verifyUnsubscribeToken(
  email: string, 
  companyId: string, 
  token: string
): Promise<boolean> {
  try {
    // In production, this would verify a JWT or encrypted token
    // For now, we'll do a simple hash verification
    const expectedToken = generateUnsubscribeToken(email, companyId)
    return token === expectedToken

  } catch (error) {
    console.error('Error verifying unsubscribe token:', error)
    return false
  }
}

/**
 * Generate unsubscribe token
 */
function generateUnsubscribeToken(email: string, companyId: string): string {
  // Simple hash for demo - in production use proper JWT or encryption
  const crypto = require('crypto')
  const secret = process.env.UNSUBSCRIBE_SECRET || 'default-secret'
  return crypto
    .createHash('sha256')
    .update(`${email}:${companyId}:${secret}`)
    .digest('hex')
    .slice(0, 16)
}

/**
 * Track unsubscribe event for analytics
 */
async function trackUnsubscribeEvent(
  email: string, 
  companyId: string, 
  token?: string
): Promise<void> {
  try {
    // Find the most recent email sent to this address
    const recentEmail = await prisma.emailLog.findFirst({
      where: {
        recipientEmail: email,
        companyId,
        deliveryStatus: { in: ['DELIVERED', 'OPENED', 'CLICKED'] }
      },
      orderBy: { sentAt: 'desc' }
    })

    if (recentEmail) {
      // Update the email log with unsubscribe event
      await prisma.emailLog.update({
        where: { id: recentEmail.id },
        data: {
          deliveryStatus: 'UNSUBSCRIBED',
          unsubscribedAt: new Date()
        }
      })
    }

  } catch (error) {
    console.error('Error tracking unsubscribe event:', error)
    // Don't throw - this is supplementary functionality
  }
}

/**
 * Get email preferences for customer
 */
async function getEmailPreferences(email: string, companyId: string) {
  try {
    const customer = await prisma.customers.findFirst({
      where: { email, companyId }
    })

    if (!customer) return null

    // Extract preferences from customer settings or notes
    // In a more advanced system, you'd have a separate preferences table
    return {
      invoiceReminders: true,
      paymentReminders: true,
      marketingEmails: false,
      newsletters: false,
      language: 'ENGLISH'
    }

  } catch (error) {
    console.error('Error getting email preferences:', error)
    return null
  }
}

// Export the token generator for use in email templates
export { generateUnsubscribeToken }