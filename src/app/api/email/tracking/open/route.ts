/**
 * Email Open Tracking Endpoint
 * Handles email open tracking for consolidated reminders
 * Returns a 1x1 pixel image while recording the open event
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1x1 transparent pixel in base64
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailLogId = searchParams.get('id')
    const utm_source = searchParams.get('utm_source')
    const utm_campaign = searchParams.get('utm_campaign')

    if (!emailLogId) {
      console.warn('⚠️ Email tracking called without email log ID')
      return new NextResponse(TRACKING_PIXEL, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Record the email open event
    const updateResult = await prisma.emailLog.updateMany({
      where: {
        id: emailLogId,
        openedAt: null // Only update if not already opened
      },
      data: {
        openedAt: new Date(),
        updatedAt: new Date()
      }
    })

    if (updateResult.count > 0) {
      console.log(`📧 Email opened: ${emailLogId}`)

      // Get email details for additional logging
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: emailLogId },
        select: {
          id: true,
          companyId: true,
          consolidatedReminderId: true,
          recipientEmail: true,
          subject: true,
          language: true,
          escalationLevel: true
        }
      })

      if (emailLog) {
        // Log activity for consolidated email opens
        if (emailLog.consolidatedReminderId) {
          await prisma.activity.create({
            data: {
              id: crypto.randomUUID(),
              companyId: emailLog.companyId,
              userId: 'system',
              type: 'consolidated_email_opened',
              description: `Consolidated email opened: ${emailLog.recipientEmail}`,
              metadata: {
                emailLogId: emailLog.id,
                consolidatedReminderId: emailLog.consolidatedReminderId,
                subject: emailLog.subject,
                language: emailLog.language,
                escalationLevel: emailLog.escalationLevel,
                openedAt: new Date().toISOString(),
                utmSource: utm_source,
                utmCampaign: utm_campaign,
                userAgent: request.headers.get('user-agent'),
                ipAddress: getClientIP(request)
              }
            }
          })
        }

        // Update consolidation effectiveness metrics
        if (emailLog.consolidatedReminderId) {
          await prisma.customerConsolidatedReminder.update({
            where: { id: emailLog.consolidatedReminderId },
            data: {
              effectivenessMetrics: {
                lastOpenedAt: new Date().toISOString(),
                totalOpens: 1,
                engagementLevel: 'opened'
              },
              updatedAt: new Date()
            }
          })
        }
      }
    }

    // Return tracking pixel
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Failed to track email open:', error)

    // Always return the tracking pixel even on error
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

function getClientIP(request: NextRequest): string {
  // Try various headers for getting client IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP.trim()
  }

  if (cfConnectingIP) {
    return cfConnectingIP.trim()
  }

  return 'unknown'
}