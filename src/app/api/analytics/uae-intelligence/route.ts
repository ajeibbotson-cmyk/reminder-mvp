/**
 * UAE Business Intelligence API Route
 * UAE-specific analytics with cultural compliance and market insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { uaeBusinessIntelligenceService } from '@/lib/services/uae-business-intelligence-service'
import { AnalyticsFilters } from '@/lib/types/analytics'
import { z } from 'zod'

const uaeFiltersSchema = z.object({
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    preset: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional()
  }),
  businessTypes: z.array(z.string()).optional(),
  includeSeasonalAnalysis: z.boolean().default(true),
  includeCulturalMetrics: z.boolean().default(true)
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

    const companyId = session.user.companies_id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawFilters = {
      dateRange: {
        startDate: searchParams.get('startDate') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        preset: searchParams.get('preset') || 'quarter'
      },
      businessTypes: searchParams.get('businessTypes')?.split(','),
      includeSeasonalAnalysis: searchParams.get('includeSeasonalAnalysis') !== 'false',
      includeCulturalMetrics: searchParams.get('includeCulturalMetrics') !== 'false'
    }

    const filters: AnalyticsFilters = uaeFiltersSchema.parse(rawFilters)

    // Get UAE business intelligence analytics
    const intelligence = await uaeBusinessIntelligenceService.getUAEBusinessIntelligence(companyId, filters)

    const response = NextResponse.json(intelligence, { status: 200 })
    response.headers.set('Cache-Control', 'private, max-age=1800') // 30 minutes cache
    response.headers.set('X-Analytics-Type', 'uae-business-intelligence')
    response.headers.set('X-Cultural-Compliance', intelligence.data.culturalCompliance.overallScore.toString())

    return response

  } catch (error) {
    console.error('UAE intelligence API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch UAE business intelligence',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.companies_id
    const body = await request.json()

    const filters: AnalyticsFilters = uaeFiltersSchema.parse(body)
    const intelligence = await uaeBusinessIntelligenceService.getUAEBusinessIntelligence(companyId, filters)

    return NextResponse.json(intelligence, { status: 200 })

  } catch (error) {
    console.error('UAE intelligence POST API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch UAE business intelligence',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}