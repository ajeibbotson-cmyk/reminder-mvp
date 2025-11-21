/**
 * Payment Analytics API Route
 * Payment performance analytics with delay reduction tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { paymentAnalyticsService } from '@/lib/services/payment-analytics-service'
import { AnalyticsFilters } from '@/lib/types/analytics'
import { z } from 'zod'

const paymentFiltersSchema = z.object({
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    preset: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional()
  }),
  paymentMethods: z.array(z.string()).optional(),
  customerIds: z.array(z.string()).optional(),
  amountRange: z.object({
    min: z.number().transform(n => new Decimal(n)),
    max: z.number().transform(n => new Decimal(n))
  }).optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day')
})

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.companyId

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawFilters = {
      dateRange: {
        startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        preset: searchParams.get('preset') || 'month'
      },
      paymentMethods: searchParams.get('paymentMethods')?.split(','),
      customerIds: searchParams.get('customerIds')?.split(','),
      granularity: searchParams.get('granularity') || 'day'
    }

    // Add amount range if provided
    if (searchParams.get('minAmount') || searchParams.get('maxAmount')) {
      rawFilters.amountRange = {
        min: parseFloat(searchParams.get('minAmount') || '0'),
        max: parseFloat(searchParams.get('maxAmount') || '999999999')
      }
    }

    // Validate filters
    const filters: AnalyticsFilters = paymentFiltersSchema.parse(rawFilters)

    // Get payment performance analytics
    const analytics = await paymentAnalyticsService.getPaymentPerformance(companyId, filters)

    // Add response headers
    const response = NextResponse.json(analytics, { status: 200 })
    response.headers.set('Cache-Control', 'private, max-age=300') // 5 minutes cache
    response.headers.set('X-Analytics-Type', 'payment-performance')

    return response

  } catch (error) {
    console.error('Payment analytics API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch payment analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.companyId
    const body = await request.json()

    const filters: AnalyticsFilters = paymentFiltersSchema.parse(body)
    const analytics = await paymentAnalyticsService.getPaymentPerformance(companyId, filters)

    return NextResponse.json(analytics, { status: 200 })

  } catch (error) {
    console.error('Payment analytics POST API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch payment analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}