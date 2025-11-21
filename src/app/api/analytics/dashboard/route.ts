/**
 * Dashboard Analytics API Route
 * Comprehensive dashboard analytics endpoint with real-time KPIs
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'
import { kpiCalculationEngine } from '@/lib/services/kpi-calculation-engine'
import { AnalyticsFilters } from '@/lib/types/analytics'
import { z } from 'zod'

// Validation schema for analytics filters
const analyticsFiltersSchema = z.object({
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    preset: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional()
  }),
  customerIds: z.array(z.string()).optional(),
  invoiceStatus: z.array(z.string()).optional(),
  paymentMethods: z.array(z.string()).optional(),
  businessTypes: z.array(z.string()).optional(),
  riskLevels: z.array(z.string()).optional(),
  includeArchived: z.boolean().default(false),
  granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional()
})

export async function GET(request: NextRequest) {
  try {
    // Authenticate user using requireRole (consistent with other API routes)
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const companyId = authContext.user.companyId

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawFilters = {
      dateRange: {
        startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        preset: searchParams.get('preset') || 'month'
      },
      customerIds: searchParams.get('customerIds')?.split(','),
      invoiceStatus: searchParams.get('invoiceStatus')?.split(','),
      paymentMethods: searchParams.get('paymentMethods')?.split(','),
      businessTypes: searchParams.get('businessTypes')?.split(','),
      riskLevels: searchParams.get('riskLevels')?.split(','),
      includeArchived: searchParams.get('includeArchived') === 'true',
      granularity: searchParams.get('granularity') || 'day'
    }

    // Validate filters
    const filters: AnalyticsFilters = analyticsFiltersSchema.parse(rawFilters)

    // Get comprehensive dashboard analytics
    const analytics = await kpiCalculationEngine.getDashboardAnalytics(companyId, filters)

    // Add response headers for caching and performance
    const response = NextResponse.json(analytics, { status: 200 })

    // Cache for 2 minutes for dashboard data
    response.headers.set('Cache-Control', 'private, max-age=120')
    response.headers.set('X-Analytics-Version', '3.1')
    response.headers.set('X-Performance-Mode', 'optimized')

    return response

  } catch (error) {
    console.error('Dashboard analytics API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user using requireRole (consistent with GET handler)
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const companyId = authContext.user.companyId
    const body = await request.json()

    // Validate request body
    const filters: AnalyticsFilters = analyticsFiltersSchema.parse(body)

    // Get analytics with custom filters
    const analytics = await kpiCalculationEngine.getDashboardAnalytics(companyId, filters)

    return NextResponse.json(analytics, { status: 200 })

  } catch (error) {
    console.error('Dashboard analytics POST API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}