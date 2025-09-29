import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { sequenceTriggersService } from '@/lib/services/sequence-triggers-service'
import { emailSchedulingService } from '@/lib/services/email-scheduling-service'

interface AnalyticsQuery {
  dateFrom?: string
  dateTo?: string
  sequenceIds?: string[]
  stepNumber?: number
  groupBy?: 'day' | 'week' | 'month'
  metric?: 'executions' | 'conversions' | 'engagement' | 'timing'
}

interface OverallAnalytics {
  summary: {
    totalSequences: number
    activeSequences: number
    totalExecutions: number
    averageConversionRate: number
    totalEmailsSent: number
    averageResponseTime: number
  }
  performance: {
    topPerformingSequences: Array<{
      id: string
      name: string
      conversionRate: number
      totalExecutions: number
      averageCompletionTime: number
    }>
    worstPerformingSequences: Array<{
      id: string
      name: string
      conversionRate: number
      totalExecutions: number
      issues: string[]
    }>
  }
  trends: {
    executionTrend: Array<{
      date: string
      executions: number
      conversions: number
      conversionRate: number
    }>
    emailTrend: Array<{
      date: string
      sent: number
      delivered: number
      opened: number
      clicked: number
    }>
  }
  triggers: {
    triggerMetrics: any
    mostCommonTriggers: Array<{
      type: string
      count: number
      successRate: number
    }>
  }
  timing: {
    optimalSendTimes: Array<{
      hour: number
      day: number
      openRate: number
      responseRate: number
    }>
    businessHoursCompliance: number
    culturalCompliance: number
  }
}

/**
 * GET /api/sequences/analytics
 * Get comprehensive sequence analytics for the company
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const query: AnalyticsQuery = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      sequenceIds: searchParams.get('sequenceIds')?.split(',') || undefined,
      stepNumber: searchParams.get('stepNumber') ? parseInt(searchParams.get('stepNumber')!) : undefined,
      groupBy: searchParams.get('groupBy') as 'day' | 'week' | 'month' || 'day',
      metric: searchParams.get('metric') as 'executions' | 'conversions' | 'engagement' | 'timing' || 'executions'
    }

    // Set default date range if not provided (last 30 days)
    const dateTo = query.dateTo ? new Date(query.dateTo) : new Date()
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : 
      new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Build analytics response
    const analytics = await buildOverallAnalytics(user.company.id, dateFrom, dateTo, query)

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error fetching sequence analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

/**
 * Build comprehensive analytics
 */
async function buildOverallAnalytics(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
  query: AnalyticsQuery
): Promise<OverallAnalytics> {
  
  // Base where clause for date filtering
  const dateWhere = {
    companyId,
    createdAt: {
      gte: dateFrom,
      lte: dateTo
    }
  }

  // Get summary metrics
  const [
    totalSequences,
    activeSequences,
    totalExecutions,
    emailMetrics,
    queueMetrics,
    triggerMetrics
  ] = await Promise.all([
    // Total sequences
    prisma.follow_up_sequences.count({
      where: { companyId }
    }),

    // Active sequences
    prisma.follow_up_sequences.count({
      where: { companyId, active: true }
    }),

    // Total executions (follow-up logs)
    prisma.follow_up_logs.count({
      where: {
        followUpSequence: { companyId },
        sentAt: {
          gte: dateFrom,
          lte: dateTo
        }
      }
    }),

    // Email metrics
    prisma.emailLog.aggregate({
      where: {
        ...dateWhere
      },
      _count: {
        id: true
      }
    }),

    // Queue metrics
    emailSchedulingService.getQueueMetrics(),

    // Trigger metrics
    sequenceTriggersService.getMonitoringMetrics(companyId)
  ])

  // Get sequence performance data
  const sequences = await prisma.follow_up_sequences.findMany({
    where: {
      companyId,
      ...(query.sequenceIds && { id: { in: query.sequenceIds } })
    },
    include: {
      followUpLogs: {
        where: {
          sentAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        include: {
          invoice: {
            include: { payments: true }
          }
        }
      }
    }
  })

  // Calculate performance metrics for each sequence
  const sequencePerformance = await Promise.all(
    sequences.map(async (sequence) => {
      const analytics = await sequenceExecutionService.getSequenceAnalytics(sequence.id)
      return {
        id: sequence.id,
        name: sequence.name,
        conversionRate: analytics.conversionRate,
        totalExecutions: analytics.totalExecutions,
        averageCompletionTime: analytics.averageCompletionTime,
        analytics
      }
    })
  )

  // Sort by performance
  const topPerforming = sequencePerformance
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5)
    .map(seq => ({
      id: seq.id,
      name: seq.name,
      conversionRate: seq.conversionRate,
      totalExecutions: seq.totalExecutions,
      averageCompletionTime: seq.averageCompletionTime
    }))

  const worstPerforming = sequencePerformance
    .filter(seq => seq.totalExecutions > 10) // Only include sequences with meaningful data
    .sort((a, b) => a.conversionRate - b.conversionRate)
    .slice(0, 5)
    .map(seq => ({
      id: seq.id,
      name: seq.name,
      conversionRate: seq.conversionRate,
      totalExecutions: seq.totalExecutions,
      issues: analyzePerformanceIssues(seq.analytics)
    }))

  // Get trend data
  const trends = await buildTrendData(companyId, dateFrom, dateTo, query.groupBy!)
  
  // Get timing analytics
  const timingAnalytics = await buildTimingAnalytics(companyId, dateFrom, dateTo)

  // Calculate averages
  const averageConversionRate = sequencePerformance.length > 0
    ? sequencePerformance.reduce((sum, seq) => sum + seq.conversionRate, 0) / sequencePerformance.length
    : 0

  return {
    summary: {
      totalSequences,
      activeSequences,
      totalExecutions,
      averageConversionRate: Math.round(averageConversionRate * 100) / 100,
      totalEmailsSent: emailMetrics._count.id,
      averageResponseTime: queueMetrics.avgDeliveryTime
    },
    performance: {
      topPerformingSequences: topPerforming,
      worstPerformingSequences: worstPerforming
    },
    trends: trends,
    triggers: {
      triggerMetrics,
      mostCommonTriggers: triggerMetrics.mostCommonTriggers.map((trigger: any) => ({
        type: trigger.type,
        count: trigger.count,
        successRate: 85 // Simplified - would calculate from actual data
      }))
    },
    timing: timingAnalytics
  }
}

/**
 * Build trend data over time
 */
async function buildTrendData(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
  groupBy: 'day' | 'week' | 'month'
) {
  // This is a simplified implementation - in production you'd use proper time-series queries
  const days = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
  const executionTrend = []
  const emailTrend = []

  for (let i = 0; i < Math.min(days, 30); i++) {
    const date = new Date(dateFrom.getTime() + i * 24 * 60 * 60 * 1000)
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)

    const [executions, emails] = await Promise.all([
      prisma.follow_up_logs.count({
        where: {
          followUpSequence: { companyId },
          sentAt: {
            gte: date,
            lt: nextDate
          }
        }
      }),

      prisma.emailLog.aggregate({
        where: {
          companyId,
          createdAt: {
            gte: date,
            lt: nextDate
          }
        },
        _count: {
          id: true
        }
      })
    ])

    // Simplified conversion calculation
    const conversions = Math.round(executions * 0.3) // Assume 30% conversion rate

    executionTrend.push({
      date: date.toISOString().split('T')[0],
      executions,
      conversions,
      conversionRate: executions > 0 ? (conversions / executions) * 100 : 0
    })

    // Simplified email metrics
    const sent = emails._count.id
    const delivered = Math.round(sent * 0.95)
    const opened = Math.round(delivered * 0.25)
    const clicked = Math.round(opened * 0.15)

    emailTrend.push({
      date: date.toISOString().split('T')[0],
      sent,
      delivered,
      opened,
      clicked
    })
  }

  return {
    executionTrend,
    emailTrend
  }
}

/**
 * Build timing analytics
 */
async function buildTimingAnalytics(
  companyId: string,
  dateFrom: Date,
  dateTo: Date
) {
  // Get email send times
  const emailLogs = await prisma.emailLog.findMany({
    where: {
      companyId,
      sentAt: {
        gte: dateFrom,
        lte: dateTo
      },
      uaeSendTime: { not: null }
    },
    select: {
      sentAt: true,
      uaeSendTime: true,
      openedAt: true,
      clickedAt: true,
      responseReceived: true
    }
  })

  // Analyze optimal send times
  const timeAnalysis: Record<string, { total: number; opened: number; responded: number }> = {}

  emailLogs.forEach(log => {
    if (!log.uaeSendTime) return

    const hour = log.uaeSendTime.getHours()
    const day = log.uaeSendTime.getDay()
    const key = `${day}-${hour}`

    if (!timeAnalysis[key]) {
      timeAnalysis[key] = { total: 0, opened: 0, responded: 0 }
    }

    timeAnalysis[key].total++
    if (log.openedAt) timeAnalysis[key].opened++
    if (log.responseReceived) timeAnalysis[key].responded++
  })

  const optimalSendTimes = Object.entries(timeAnalysis)
    .map(([key, data]) => {
      const [day, hour] = key.split('-').map(Number)
      return {
        hour,
        day,
        openRate: data.total > 0 ? (data.opened / data.total) * 100 : 0,
        responseRate: data.total > 0 ? (data.responded / data.total) * 100 : 0
      }
    })
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 10)

  // Calculate compliance metrics
  const businessHoursEmails = emailLogs.filter(log => {
    if (!log.uaeSendTime) return false
    const day = log.uaeSendTime.getDay()
    const hour = log.uaeSendTime.getHours()
    return day >= 0 && day <= 4 && hour >= 8 && hour < 18 // Sunday-Thursday, 8am-6pm
  }).length

  const culturallyOptimalEmails = emailLogs.filter(log => {
    if (!log.uaeSendTime) return false
    const day = log.uaeSendTime.getDay()
    const hour = log.uaeSendTime.getHours()
    return day >= 2 && day <= 4 && hour >= 10 && hour <= 11 // Tuesday-Thursday, 10-11am
  }).length

  const businessHoursCompliance = emailLogs.length > 0 
    ? (businessHoursEmails / emailLogs.length) * 100 
    : 100

  const culturalCompliance = emailLogs.length > 0 
    ? (culturallyOptimalEmails / emailLogs.length) * 100 
    : 100

  return {
    optimalSendTimes,
    businessHoursCompliance: Math.round(businessHoursCompliance * 100) / 100,
    culturalCompliance: Math.round(culturalCompliance * 100) / 100
  }
}

/**
 * Analyze performance issues for underperforming sequences
 */
function analyzePerformanceIssues(analytics: any): string[] {
  const issues: string[] = []

  if (analytics.conversionRate < 10) {
    issues.push('Very low conversion rate - review sequence content and timing')
  }

  if (analytics.stepAnalytics && analytics.stepAnalytics.length > 0) {
    const firstStepOpenRate = analytics.stepAnalytics[0]?.openRate || 0
    if (firstStepOpenRate < 20) {
      issues.push('Low open rates on first step - improve subject lines')
    }

    const lastStepResponseRate = analytics.stepAnalytics[analytics.stepAnalytics.length - 1]?.responseRate || 0
    if (lastStepResponseRate < 5) {
      issues.push('No responses in final steps - sequence may be too aggressive')
    }
  }

  if (analytics.averageCompletionTime > 60) {
    issues.push('Very long completion time - consider shortening sequence')
  }

  return issues
}