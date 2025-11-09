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

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized - Company association required' },
        { status: 401 }
      )
    }

    const companyId = session.user.companyId

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
      companyId: companyId
    }

    // Add status filter
    if (validatedQuery.status) {
      whereClause.status = validatedQuery.status
    }

    // Add date range filter
    if (validatedQuery.startDate || validatedQuery.endDate) {
      whereClause.createdAt = {}
      if (validatedQuery.startDate) {
        whereClause.createdAt.gte = new Date(validatedQuery.startDate)
      }
      if (validatedQuery.endDate) {
        whereClause.createdAt.lte = new Date(validatedQuery.endDate)
      }
    }

    // Add search filter
    if (validatedQuery.search) {
      whereClause.OR = [
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { emailSubject: { contains: validatedQuery.search, mode: 'insensitive' } }
      ]
    }

    // 4. Build order clause
    const orderBy: any = {}
    if (validatedQuery.sortBy === 'sent_at') {
      orderBy.startedAt = validatedQuery.sortOrder
    } else if (validatedQuery.sortBy === 'success_rate') {
      orderBy.successRate = validatedQuery.sortOrder
    } else if (validatedQuery.sortBy === 'created_at') {
      orderBy.createdAt = validatedQuery.sortOrder
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
          // Note: createdBy is a String field, not a relation (schema doesn't define users relation yet)
          // TODO: Add proper users relation to schema and re-enable created_by_user include
          _count: {
            select: {
              campaignEmailSends: true
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
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      successRate: campaign.successRate || 0,
      createdAt: campaign.createdAt.toISOString(),
      startedAt: campaign.startedAt?.toISOString(),
      completedAt: campaign.completedAt?.toISOString(),
      createdBy: {
        id: campaign.createdBy, // Just use the user ID string for now
        name: 'Unknown' // TODO: Fetch from users table once relation is defined
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
      where: { companyId: companyId },
      _count: { id: true },
      _sum: {
        sentCount: true,
        totalRecipients: true
      },
      _avg: {
        successRate: true
      }
    })

    // Count active campaigns
    const activeCampaigns = await prisma.invoiceCampaign.count({
      where: {
        companyId: companyId,
        status: { in: ['sending', 'draft'] }
      }
    })

    // Get email engagement stats from tracking table
    const emailStats = await prisma.emailEventTracking.groupBy({
      by: ['eventType'],
      where: {
        companyId: companyId
      },
      _count: { id: true }
    })

    // Count opens and clicks
    const openedCount = emailStats.find(stat => stat.eventType === 'opened')?._count.id || 0
    const clickedCount = emailStats.find(stat => stat.eventType === 'clicked')?._count.id || 0

    return {
      totalCampaigns: campaignStats._count.id,
      activeCampaigns,
      avgSuccessRate: Math.round(campaignStats._avg.successRate || 0),
      totalEmailsSent: campaignStats._sum.sentCount || 0,
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