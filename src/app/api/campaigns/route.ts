import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ==========================================
// CAMPAIGNS LISTING ENDPOINT
// ==========================================
// GET /api/campaigns
// Purpose: List company campaigns with filtering and analytics

// Query Parameters Schema
const CampaignsQuerySchema = z.object({
  status: z.enum(['draft', 'sending', 'completed', 'failed', 'paused']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'sent_at', 'name', 'success_rate']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
})

// Response Types
interface CampaignListItem {
  id: string
  name: string
  status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused'
  totalRecipients: number
  sentCount: number
  failedCount: number
  successRate: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  createdBy: {
    id: string
    name: string
  }
}

interface CampaignsResponse {
  campaigns: CampaignListItem[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
  analytics: {
    totalCampaigns: number
    activeCampaigns: number
    avgSuccessRate: number
    totalEmailsSent: number
    totalEmailsOpened: number
    totalEmailsClicked: number
  }
}

// ==========================================
// GET ROUTE HANDLER
// ==========================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Session validation
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Valid session required' },
        { status: 401 }
      )
    }

    if (!session.user.companiesId) {
      return NextResponse.json(
        { error: 'Unauthorized - Company association required' },
        { status: 401 }
      )
    }

    const companyId = session.user.companiesId

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    let validatedQuery
    try {
      validatedQuery = CampaignsQuerySchema.parse(queryParams)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: validationError.errors
          },
          { status: 400 }
        )
      }
      throw validationError
    }

    // 3. Build where clause
    const whereClause: any = {
      company_id: companyId
    }

    // Add status filter
    if (validatedQuery.status) {
      whereClause.status = validatedQuery.status
    }

    // Add date range filter
    if (validatedQuery.startDate || validatedQuery.endDate) {
      whereClause.created_at = {}
      if (validatedQuery.startDate) {
        whereClause.created_at.gte = new Date(validatedQuery.startDate)
      }
      if (validatedQuery.endDate) {
        whereClause.created_at.lte = new Date(validatedQuery.endDate)
      }
    }

    // Add search filter
    if (validatedQuery.search) {
      whereClause.OR = [
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { email_subject: { contains: validatedQuery.search, mode: 'insensitive' } }
      ]
    }

    // 4. Build order clause
    const orderBy: any = {}
    if (validatedQuery.sortBy === 'sent_at') {
      orderBy.started_at = validatedQuery.sortOrder
    } else if (validatedQuery.sortBy === 'success_rate') {
      orderBy.success_rate = validatedQuery.sortOrder
    } else {
      orderBy[validatedQuery.sortBy] = validatedQuery.sortOrder
    }

    // 5. Calculate pagination
    const skip = (validatedQuery.page - 1) * validatedQuery.limit
    const take = validatedQuery.limit

    // 6. Execute parallel queries
    const [campaigns, totalCount, analytics] = await Promise.all([
      // Fetch campaigns with pagination
      prisma.invoiceCampaign.findMany({
        where: whereClause,
        orderBy,
        skip,
        take,
        include: {
          created_by_user: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              campaign_email_sends: true
            }
          }
        }
      }),

      // Count total campaigns
      prisma.invoiceCampaign.count({
        where: whereClause
      }),

      // Calculate analytics
      calculateCampaignAnalytics(companyId)
    ])

    // 7. Transform campaigns data
    const transformedCampaigns: CampaignListItem[] = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status as any,
      totalRecipients: campaign.total_recipients,
      sentCount: campaign.sent_count,
      failedCount: campaign.failed_count,
      successRate: campaign.success_rate || 0,
      createdAt: campaign.created_at.toISOString(),
      startedAt: campaign.started_at?.toISOString(),
      completedAt: campaign.completed_at?.toISOString(),
      createdBy: {
        id: campaign.created_by_user.id,
        name: campaign.created_by_user.name
      }
    }))

    // 8. Build pagination info
    const totalPages = Math.ceil(totalCount / validatedQuery.limit)
    const hasMore = validatedQuery.page < totalPages

    // 9. Build response
    const response: CampaignsResponse = {
      campaigns: transformedCampaigns,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        totalCount,
        totalPages,
        hasMore
      },
      analytics
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Campaigns listing error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
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
 * Calculate campaign analytics for company
 */
async function calculateCampaignAnalytics(companyId: string): Promise<CampaignsResponse['analytics']> {
  try {
    // Get basic campaign stats
    const campaignStats = await prisma.invoiceCampaign.aggregate({
      where: { company_id: companyId },
      _count: { id: true },
      _sum: {
        sent_count: true,
        total_recipients: true
      },
      _avg: {
        success_rate: true
      }
    })

    // Count active campaigns
    const activeCampaigns = await prisma.invoiceCampaign.count({
      where: {
        company_id: companyId,
        status: { in: ['sending', 'draft'] }
      }
    })

    // Get email engagement stats from tracking table
    const emailStats = await prisma.emailEventTracking.groupBy({
      by: ['event_type'],
      where: {
        company_id: companyId
      },
      _count: { id: true }
    })

    // Count opens and clicks
    const openedCount = emailStats.find(stat => stat.event_type === 'opened')?._count.id || 0
    const clickedCount = emailStats.find(stat => stat.event_type === 'clicked')?._count.id || 0

    return {
      totalCampaigns: campaignStats._count.id,
      activeCampaigns,
      avgSuccessRate: Math.round(campaignStats._avg.success_rate || 0),
      totalEmailsSent: campaignStats._sum.sent_count || 0,
      totalEmailsOpened: openedCount,
      totalEmailsClicked: clickedCount
    }

  } catch (error) {
    console.error('Analytics calculation error:', error)

    // Return default analytics on error
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      avgSuccessRate: 0,
      totalEmailsSent: 0,
      totalEmailsOpened: 0,
      totalEmailsClicked: 0
    }
  }
}

// Note: GET function is already exported above