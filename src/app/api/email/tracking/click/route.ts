/**
 * Email Click Tracking Endpoint
 * Handles email link click tracking for consolidated reminders
 * Redirects to the original URL while recording the click event
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailLogId = searchParams.get('id')
    const targetUrl = searchParams.get('url')
    const linkType = searchParams.get('type') // 'payment', 'unsubscribe', 'contact', etc.
    const utm_source = searchParams.get('utm_source')
    const utm_campaign = searchParams.get('utm_campaign')

    if (!emailLogId || !targetUrl) {
      console.warn('⚠️ Email click tracking called without required parameters')
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Decode the target URL
    const decodedUrl = decodeURIComponent(targetUrl)

    // Validate that the target URL is safe
    if (!isValidTargetUrl(decodedUrl)) {
      console.warn('⚠️ Invalid target URL in click tracking:', decodedUrl)
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Record the email click event
    const updateResult = await prisma.emailLog.updateMany({
      where: {
        id: emailLogId,
        clickedAt: null // Only update if not already clicked
      },
      data: {
        clickedAt: new Date(),
        updatedAt: new Date()
      }
    })

    if (updateResult.count > 0) {
      console.log(`🖱️ Email clicked: ${emailLogId}, Link: ${linkType || 'unknown'}`)

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
          escalationLevel: true,
          invoiceCount: true
        }
      })

      if (emailLog) {
        // Log activity for consolidated email clicks
        if (emailLog.consolidatedReminderId) {
          await prisma.activity.create({
            data: {
              id: crypto.randomUUID(),
              companyId: emailLog.companyId,
              userId: 'system',
              type: 'consolidated_email_clicked',
              description: `Consolidated email link clicked: ${emailLog.recipientEmail}`,
              metadata: {
                emailLogId: emailLog.id,
                consolidatedReminderId: emailLog.consolidatedReminderId,
                subject: emailLog.subject,
                language: emailLog.language,
                escalationLevel: emailLog.escalationLevel,
                linkType: linkType || 'unknown',
                targetUrl: decodedUrl,
                clickedAt: new Date().toISOString(),
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
          const currentMetrics = await prisma.customerConsolidatedReminder.findUnique({
            where: { id: emailLog.consolidatedReminderId },
            select: { effectivenessMetrics: true }
          })

          const metrics = currentMetrics?.effectivenessMetrics as any || {}

          await prisma.customerConsolidatedReminder.update({
            where: { id: emailLog.consolidatedReminderId },
            data: {
              effectivenessMetrics: {
                ...metrics,
                lastClickedAt: new Date().toISOString(),
                totalClicks: (metrics.totalClicks || 0) + 1,
                engagementLevel: 'clicked',
                clickedLinkType: linkType || 'unknown'
              },
              updatedAt: new Date()
            }
          })
        }

        // Track specific link types
        if (linkType === 'payment' && emailLog.consolidatedReminderId) {
          // This indicates potential payment intent
          await prisma.activity.create({
            data: {
              id: crypto.randomUUID(),
              companyId: emailLog.companyId,
              userId: 'system',
              type: 'payment_link_clicked',
              description: `Payment link clicked from consolidated email: ${emailLog.invoiceCount} invoices`,
              metadata: {
                consolidatedReminderId: emailLog.consolidatedReminderId,
                invoiceCount: emailLog.invoiceCount,
                escalationLevel: emailLog.escalationLevel,
                clickedAt: new Date().toISOString()
              }
            }
          })
        }
      }
    }

    // Redirect to the target URL
    return NextResponse.redirect(decodedUrl)

  } catch (error) {
    console.error('Failed to track email click:', error)

    // Redirect to home page on error
    return NextResponse.redirect(new URL('/', request.url))
  }
}

function isValidTargetUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const allowedDomains = [
      process.env.NEXTAUTH_URL,
      'localhost',
      '127.0.0.1'
    ].filter(Boolean)

    // Check if it's a relative URL (starts with /)
    if (url.startsWith('/')) {
      return true
    }

    // Check if it's an allowed domain
    return allowedDomains.some(domain =>
      parsedUrl.hostname === domain ||
      parsedUrl.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
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