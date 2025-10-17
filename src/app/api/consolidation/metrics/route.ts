/**
 * Consolidation Metrics API
 * GET /api/consolidation/metrics - Get consolidation effectiveness metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import { followUpDetectionService } from '@/lib/services/follow-up-detection-service'
import type { ConsolidationApiResponse, ConsolidationMetrics } from '@/lib/types/consolidation'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const period = searchParams.get('period') || 'month' // week, month, quarter, year

    // Parse date range
    let dateRange: { from: Date; to: Date } | undefined
    if (fromDate && toDate) {
      dateRange = {
        from: new Date(fromDate),
        to: new Date(toDate)
      }
    } else {
      // Default to current period based on parameter
      const now = new Date()
      const start = new Date(now)

      switch (period) {
        case 'week':
          start.setDate(start.getDate() - 7)
          break
        case 'quarter':
          start.setMonth(start.getMonth() - 3)
          break
        case 'year':
          start.setFullYear(start.getFullYear() - 1)
          break
        default: // month
          start.setMonth(start.getMonth() - 1)
          break
      }

      dateRange = { from: start, to: now }
    }

    console.log(`📊 Getting consolidation metrics for company ${session.user.companyId}, period: ${period}`)

    // Get metrics from consolidation service
    const [consolidationMetrics, detectionStats] = await Promise.all([
      customerConsolidationService.getConsolidationMetrics(session.user.companyId, dateRange),
      followUpDetectionService.getConsolidationStatistics(session.user.companyId, dateRange)
    ])

    // Combine and enhance metrics
    const enhancedMetrics: ConsolidationMetrics = {
      totalCandidates: consolidationMetrics.totalCandidates,
      eligibleForConsolidation: consolidationMetrics.eligibleForConsolidation,
      consolidationRate: consolidationMetrics.consolidationRate,
      emailsSaved: consolidationMetrics.emailsSaved,
      averageInvoicesPerConsolidation: consolidationMetrics.averageInvoicesPerConsolidation,
      priorityDistribution: consolidationMetrics.priorityDistribution,
      effectivenessMetrics: {
        openRate: detectionStats.effectiveness.openRate,
        clickRate: detectionStats.effectiveness.clickRate,
        responseRate: detectionStats.effectiveness.responseRate,
        paymentRate: 0 // Would need payment correlation analysis
      },
      volumeReduction: {
        emailsSaved: detectionStats.emailsSaved,
        percentageReduction: detectionStats.totalInvoicesConsolidated > 0
          ? (detectionStats.emailsSaved / detectionStats.totalInvoicesConsolidated) * 100
          : 0,
        periodComparison: {
          individual: Math.max(0, detectionStats.totalInvoicesConsolidated - detectionStats.consolidationsCreated),
          consolidated: detectionStats.consolidationsCreated
        }
      }
    }

    // Add additional context
    const additionalMetrics = {
      period: {
        label: period,
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        days: Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
      },
      trends: {
        consolidationRateChange: 0, // Would calculate vs previous period
        emailSavingsChange: 0, // Would calculate vs previous period
        effectivenessChange: 0 // Would calculate vs previous period
      },
      benchmarks: {
        targetConsolidationRate: 70, // Company target
        targetEmailSavings: 500, // Company target
        industryBenchmark: {
          consolidationRate: 60,
          emailSavings: 40
        }
      },
      recommendations: generateRecommendations(enhancedMetrics, detectionStats)
    }

    const response: ConsolidationApiResponse<typeof enhancedMetrics> = {
      success: true,
      data: enhancedMetrics,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      ...response,
      additional: additionalMetrics
    })

  } catch (error) {
    console.error('Consolidation metrics error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to retrieve consolidation metrics',
      code: 'METRICS_RETRIEVAL_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * Generate actionable recommendations based on metrics
 */
function generateRecommendations(
  metrics: ConsolidationMetrics,
  detectionStats: any
): Array<{ type: string; priority: 'high' | 'medium' | 'low'; message: string; action?: string }> {
  const recommendations = []

  // Consolidation rate recommendations
  if (metrics.consolidationRate < 50) {
    recommendations.push({
      type: 'consolidation_rate',
      priority: 'high' as const,
      message: `Consolidation rate is ${metrics.consolidationRate.toFixed(1)}%, which is below optimal. Consider adjusting customer consolidation preferences.`,
      action: 'Review customer consolidation settings and contact intervals'
    })
  }

  // Email effectiveness recommendations
  if (metrics.effectivenessMetrics.openRate < 30) {
    recommendations.push({
      type: 'email_effectiveness',
      priority: 'medium' as const,
      message: `Email open rate is ${metrics.effectivenessMetrics.openRate.toFixed(1)}%, which suggests subject lines could be improved.`,
      action: 'A/B test different subject line templates'
    })
  }

  // Volume efficiency recommendations
  if (metrics.emailsSaved < 100 && metrics.totalCandidates > 50) {
    recommendations.push({
      type: 'volume_efficiency',
      priority: 'medium' as const,
      message: `Only ${metrics.emailsSaved} emails saved from ${metrics.totalCandidates} candidates. More aggressive consolidation could improve efficiency.`,
      action: 'Consider reducing contact intervals or adjusting consolidation criteria'
    })
  }

  // Escalation optimization
  if (metrics.priorityDistribution.high && (metrics.priorityDistribution.high / metrics.totalCandidates) > 0.3) {
    recommendations.push({
      type: 'escalation_optimization',
      priority: 'high' as const,
      message: `${Math.round((metrics.priorityDistribution.high / metrics.totalCandidates) * 100)}% of candidates are high priority. Consider reviewing payment terms or follow-up timing.`,
      action: 'Analyze high-priority customers for common patterns'
    })
  }

  // Success recognition
  if (metrics.consolidationRate > 70 && metrics.emailsSaved > 200) {
    recommendations.push({
      type: 'success',
      priority: 'low' as const,
      message: `Excellent consolidation performance! ${metrics.consolidationRate.toFixed(1)}% rate with ${metrics.emailsSaved} emails saved.`,
      action: 'Consider sharing best practices with other companies'
    })
  }

  return recommendations
}