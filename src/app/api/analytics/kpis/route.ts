/**
 * KPIs API Route
 * Key Performance Indicators endpoint for specific KPI calculations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { kpiCalculationEngine } from '@/lib/services/kpi-calculation-engine'
import { z } from 'zod'

const kpiRequestSchema = z.object({
  kpis: z.array(z.enum([
    'payment_delay_reduction',
    'collection_efficiency',
    'days_sales_outstanding',
    'customer_satisfaction',
    'invoice_processing_time',
    'email_effectiveness',
    'cultural_compliance',
    'risk_distribution'
  ])),
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str))
  }).optional(),
  comparison: z.enum(['none', 'previous_period', 'year_over_year']).default('previous_period')
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
    const requestedKpis = searchParams.get('kpis')?.split(',') || [
      'payment_delay_reduction',
      'collection_efficiency',
      'customer_satisfaction'
    ]

    const dateRange = {
      startDate: new Date(searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      endDate: new Date(searchParams.get('endDate') || new Date().toISOString())
    }

    const comparison = searchParams.get('comparison') || 'previous_period'

    // Validate request
    const validatedRequest = kpiRequestSchema.parse({
      kpis: requestedKpis,
      dateRange,
      comparison
    })

    // Calculate KPIs
    const kpiResults = await calculateSpecificKPIs(companyId, validatedRequest)

    const response = NextResponse.json({
      data: kpiResults,
      metadata: {
        queryTime: Date.now(),
        requestedKpis: validatedRequest.kpis,
        dateRange: validatedRequest.dateRange,
        comparison: validatedRequest.comparison,
        freshness: new Date()
      }
    }, { status: 200 })

    response.headers.set('Cache-Control', 'private, max-age=180') // 3 minutes cache
    response.headers.set('X-Analytics-Type', 'specific-kpis')

    return response

  } catch (error) {
    console.error('KPI API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid KPI request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to calculate KPIs',
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

    const validatedRequest = kpiRequestSchema.parse(body)
    const kpiResults = await calculateSpecificKPIs(companyId, validatedRequest)

    return NextResponse.json({
      data: kpiResults,
      metadata: {
        queryTime: Date.now(),
        requestedKpis: validatedRequest.kpis,
        dateRange: validatedRequest.dateRange,
        comparison: validatedRequest.comparison,
        freshness: new Date()
      }
    }, { status: 200 })

  } catch (error) {
    console.error('KPI POST API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to calculate KPIs',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate specific KPIs based on request
 */
async function calculateSpecificKPIs(companyId: string, request: any) {
  const filters = {
    dateRange: request.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    }
  }

  // Get full dashboard analytics (cached)
  const analytics = await kpiCalculationEngine.getDashboardAnalytics(companyId, filters)

  const kpiResults: Record<string, any> = {}

  for (const kpiName of request.kpis) {
    switch (kpiName) {
      case 'payment_delay_reduction':
        kpiResults[kpiName] = {
          value: analytics.data.overview.paymentDelayReduction,
          unit: 'percentage',
          target: 25, // 25% reduction target
          trend: analytics.data.paymentPerformance.paymentDelayReduction > 0 ? 'improving' : 'declining',
          description: 'Payment delay reduction vs previous period'
        }
        break

      case 'collection_efficiency':
        kpiResults[kpiName] = {
          value: analytics.data.overview.collectionEfficiency,
          unit: 'percentage',
          target: 85,
          trend: analytics.data.paymentPerformance.collectionRate.current > 80 ? 'good' : 'needs_improvement',
          description: 'Percentage of invoiced amount collected'
        }
        break

      case 'days_sales_outstanding':
        kpiResults[kpiName] = {
          value: analytics.data.paymentPerformance.daysOutstanding.current,
          unit: 'days',
          target: 30,
          trend: analytics.data.paymentPerformance.daysOutstanding.improvement > 0 ? 'improving' : 'declining',
          description: 'Average days to collect receivables'
        }
        break

      case 'customer_satisfaction':
        kpiResults[kpiName] = {
          value: analytics.data.overview.customerSatisfaction,
          unit: 'score',
          target: 85,
          trend: analytics.data.overview.customerSatisfaction > 80 ? 'good' : 'needs_improvement',
          description: 'Customer satisfaction based on payment behavior'
        }
        break

      case 'invoice_processing_time':
        kpiResults[kpiName] = {
          value: analytics.data.invoiceStatus.processingMetrics.averageProcessingTime,
          unit: 'hours',
          target: 24,
          trend: analytics.data.invoiceStatus.processingMetrics.averageProcessingTime < 24 ? 'good' : 'needs_improvement',
          description: 'Average time from invoice creation to sending'
        }
        break

      case 'email_effectiveness':
        kpiResults[kpiName] = {
          value: analytics.data.emailCampaigns.campaignMetrics.openRate,
          unit: 'percentage',
          target: 25,
          trend: analytics.data.emailCampaigns.campaignMetrics.openRate > 25 ? 'good' : 'needs_improvement',
          description: 'Email campaign open rate'
        }
        break

      case 'cultural_compliance':
        kpiResults[kpiName] = {
          value: analytics.data.uaeIntelligence.culturalCompliance.overallScore,
          unit: 'score',
          target: 85,
          trend: analytics.data.uaeIntelligence.culturalCompliance.overallScore > 80 ? 'good' : 'needs_improvement',
          description: 'UAE cultural compliance score'
        }
        break

      case 'risk_distribution':
        const riskDist = analytics.data.customerInsights.riskDistribution
        kpiResults[kpiName] = {
          value: {
            low: riskDist.low.percentage,
            medium: riskDist.medium.percentage,
            high: riskDist.high.percentage,
            critical: riskDist.critical.percentage
          },
          unit: 'distribution',
          target: { low: 70, medium: 20, high: 8, critical: 2 },
          trend: riskDist.low.percentage > 60 ? 'good' : 'needs_improvement',
          description: 'Customer risk distribution'
        }
        break

      default:
        kpiResults[kpiName] = {
          error: `Unknown KPI: ${kpiName}`
        }
    }
  }

  return kpiResults
}