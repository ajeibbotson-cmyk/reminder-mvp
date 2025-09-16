/**
 * Customer Analytics API Route
 * Customer insights with payment behavior and risk scoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { customerAnalyticsService } from '@/lib/services/customer-analytics-service'
import { AnalyticsFilters } from '@/lib/types/analytics'
import { z } from 'zod'

const customerFiltersSchema = z.object({
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    preset: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional()
  }),
  customerIds: z.array(z.string()).optional(),
  businessTypes: z.array(z.string()).optional(),
  riskLevels: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
  includeArchived: z.boolean().default(false)
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.company_id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawFilters = {
      dateRange: {
        startDate: searchParams.get('startDate') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        preset: searchParams.get('preset') || 'quarter'
      },
      customerIds: searchParams.get('customerIds')?.split(','),
      businessTypes: searchParams.get('businessTypes')?.split(','),
      riskLevels: searchParams.get('riskLevels')?.split(','),
      includeArchived: searchParams.get('includeArchived') === 'true'
    }

    const filters: AnalyticsFilters = customerFiltersSchema.parse(rawFilters)

    // Get customer insights analytics
    const analytics = await customerAnalyticsService.getCustomerInsights(companyId, filters)

    const response = NextResponse.json(analytics, { status: 200 })
    response.headers.set('Cache-Control', 'private, max-age=600') // 10 minutes cache
    response.headers.set('X-Analytics-Type', 'customer-insights')

    return response

  } catch (error) {
    console.error('Customer analytics API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch customer analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Update customer risk scores
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.company_id

    // Trigger customer risk score updates
    const updatedCount = await customerAnalyticsService.updateCustomerRiskScores(companyId)

    return NextResponse.json({
      success: true,
      message: `Updated risk scores for ${updatedCount} customers`,
      updatedCount
    }, { status: 200 })

  } catch (error) {
    console.error('Customer risk score update API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update customer risk scores',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}