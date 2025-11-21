import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ==========================================
// CAMPAIGN DETAILS ENDPOINT
// ==========================================
// GET /api/campaigns/[id]
// Purpose: Get detailed campaign information with real-time progress

// Response Types
interface CampaignDetailsResponse {
  campaign: {
    id: string
    name: string
    status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused'
    createdAt: string
    startedAt?: string
    completedAt?: string

    // Configuration
    emailSubject: string
    emailContent: string
    language: 'ENGLISH' | 'ARABIC'
    batchSize: number
    delayBetweenBatches: number
    respectBusinessHours: boolean
    scheduledFor?: string

    // Progress tracking
    progress: {
      totalRecipients: number
      sentCount: number
      failedCount: number
      openedCount: number
      clickedCount: number
      bouncedCount: number
      unsubscribedCount: number

      // Real-time progress (for active campaigns)
      currentBatch?: number
      totalBatches?: number
      percentComplete: number
      estimatedTimeRemaining?: string
      lastEmailSentAt?: string
    }

    // Associated data
    invoices: Array<{
      id: string
      number: string
      customerName: string
      amount: number
      status: string
    }>

    emailLogs: Array<{
      id: string
      recipientEmail: string
      invoiceNumber: string
      deliveryStatus: string
      sentAt?: string
      errorMessage?: string
    }>

    // Creator info
    createdBy: {
      id: string
      name: string
    }
  }
}

// ==========================================
// GET ROUTE HANDLER
// ==========================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Session validation
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Valid session required' },
        { status: 401 }
      )
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized - Company association required' },
        { status: 401 }
      )
    }

    const companyId = session.user.companyId
    const campaignId = params.id

    // 2. Validate campaign ID format
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid campaign ID' },
        { status: 400 }
      )
    }

    // 3. Fetch campaign with all related data
    const campaign = await prisma.invoiceCampaign.findFirst({
      where: {
        id: campaignId,
        companyId: companyId // Multi-tenant security
      },
      include: {
        campaignEmailSends: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                amount: true,
                status: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      )
    }

    // 4. Calculate engagement metrics
    const engagementMetrics = await calculateEngagementMetrics(campaignId)

    // 5. Calculate progress information
    const progress = calculateCampaignProgress(campaign, engagementMetrics)

    // 6. Extract unique invoices from email sends
    const uniqueInvoices = new Map()
    campaign.campaignEmailSends.forEach(send => {
      if (send.invoice && !uniqueInvoices.has(send.invoice.id)) {
        uniqueInvoices.set(send.invoice.id, {
          id: send.invoice.id,
          number: send.invoice.number,
          customerName: 'Unknown',
          amount: Number(send.invoice.amount) || 0,
          status: send.invoice.status
        })
      }
    })

    // 7. Format email logs
    const emailLogs = campaign.campaignEmailSends.map(send => ({
      id: send.id,
      recipientEmail: send.recipientEmail,
      invoiceNumber: send.invoice?.number || 'Unknown',
      deliveryStatus: send.deliveryStatus,
      sentAt: send.sentAt?.toISOString(),
      errorMessage: send.errorMessage
    }))

    // 8. Build response
    const response: CampaignDetailsResponse = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status as any,
        createdAt: campaign.createdAt.toISOString(),
        startedAt: campaign.startedAt?.toISOString(),
        completedAt: campaign.completedAt?.toISOString(),

        // Configuration
        emailSubject: campaign.emailSubject,
        emailContent: campaign.emailContent,
        language: campaign.language as any,
        batchSize: campaign.batchSize,
        delayBetweenBatches: campaign.delayBetweenBatches,
        respectBusinessHours: campaign.respectBusinessHours,
        scheduledFor: campaign.scheduledFor?.toISOString(),

        // Progress
        progress,

        // Associated data
        invoices: Array.from(uniqueInvoices.values()),
        emailLogs,

        // Creator info
        createdBy: {
          id: campaign.createdBy,
          name: 'Unknown'
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Campaign details error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      campaignId: params.id,
      userId: (await getServerSession(authOptions))?.user?.id
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate engagement metrics from email tracking events
 */
async function calculateEngagementMetrics(campaignId: string) {
  try {
    const metrics = await prisma.emailEventTracking.groupBy({
      by: ['eventType'],
      where: {
        campaignEmailSend: {
          campaignId: campaignId
        }
      },
      _count: { id: true }
    })

    return {
      opened: metrics.find(m => m.eventType === 'opened')?._count.id || 0,
      clicked: metrics.find(m => m.eventType === 'clicked')?._count.id || 0,
      bounced: metrics.find(m => m.eventType === 'bounced')?._count.id || 0,
      unsubscribed: metrics.find(m => m.eventType === 'unsubscribed')?._count.id || 0
    }
  } catch (error) {
    console.error('Engagement metrics calculation error:', error)
    return {
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0
    }
  }
}

/**
 * Calculate real-time campaign progress
 */
function calculateCampaignProgress(
  campaign: any,
  engagementMetrics: any
): CampaignDetailsResponse['campaign']['progress'] {
  const totalRecipients = campaign.totalRecipients
  const sentCount = campaign.sentCount
  const failedCount = campaign.failedCount
  const pendingCount = campaign.campaignEmailSends.filter(
    (send: any) => send.deliveryStatus === 'pending'
  ).length

  const percentComplete = totalRecipients > 0
    ? Math.round(((sentCount + failedCount) / totalRecipients) * 100)
    : 0

  const currentBatch = Math.ceil((sentCount + failedCount) / campaign.batchSize)
  const totalBatches = Math.ceil(totalRecipients / campaign.batchSize)

  // Calculate estimated time remaining for active campaigns
  let estimatedTimeRemaining: string | undefined
  if (campaign.status === 'sending' && pendingCount > 0) {
    const remainingBatches = totalBatches - currentBatch
    const avgBatchTime = campaign.delayBetweenBatches + 2000 // Estimate 2s processing time
    const remainingTime = remainingBatches * avgBatchTime

    if (remainingTime > 60000) {
      estimatedTimeRemaining = `${Math.round(remainingTime / 60000)} minutes`
    } else {
      estimatedTimeRemaining = `${Math.round(remainingTime / 1000)} seconds`
    }
  }

  // Find last sent email timestamp
  const lastSentEmail = campaign.campaignEmailSends
    .filter((send: any) => send.sentAt)
    .sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0]

  return {
    totalRecipients,
    sentCount,
    failedCount,
    openedCount: engagementMetrics.opened,
    clickedCount: engagementMetrics.clicked,
    bouncedCount: engagementMetrics.bounced,
    unsubscribedCount: engagementMetrics.unsubscribed,

    // Real-time progress
    currentBatch: campaign.status === 'sending' ? currentBatch : undefined,
    totalBatches: campaign.status === 'sending' ? totalBatches : undefined,
    percentComplete,
    estimatedTimeRemaining,
    lastEmailSentAt: lastSentEmail?.sentAt?.toISOString()
  }
}

// Note: GET function is already exported above