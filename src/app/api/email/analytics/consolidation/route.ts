import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'

/**
 * GET /api/email/analytics/consolidation - Get consolidation email analytics
 * Comprehensive analytics for consolidated email performance and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const timeRange = searchParams.get('timeRange') || '30' // days
    const granularity = searchParams.get('granularity') || 'day' // day, week, month
    const comparisonPeriod = searchParams.get('comparison') === 'true'
    const segmentBy = searchParams.get('segmentBy') // customer, template, escalation

    const daysBack = parseInt(timeRange)
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000))

    // Comparison period dates (previous period of same length)
    const comparisonEndDate = new Date(startDate)
    const comparisonStartDate = new Date(comparisonEndDate.getTime() - (daysBack * 24 * 60 * 60 * 1000))

    // Base query conditions
    const baseWhere = {
      companyId: authContext.user.companyId,
      consolidatedReminderId: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    const comparisonWhere = comparisonPeriod ? {
      companyId: authContext.user.companyId,
      consolidatedReminderId: { not: null },
      createdAt: {
        gte: comparisonStartDate,
        lte: comparisonEndDate
      }
    } : null

    // Execute parallel queries for comprehensive analytics
    const [
      consolidatedEmails,
      comparisonEmails,
      consolidationSummary,
      templatePerformance,
      customerInsights,
      timeSeriesData,
      escalationAnalysis,
      deliveryMetrics,
      engagementMetrics,
      savingsAnalysis
    ] = await Promise.all([
      // Current period consolidated emails
      prisma.emailLog.findMany({
        where: baseWhere,
        include: {
          emailTemplate: {
            select: { name: true, templateType: true }
          },
          customer: {
            select: { name: true, businessType: true }
          },
          consolidatedReminder: {
            select: {
              escalationLevel: true,
              priorityScore: true,
              totalAmount: true,
              currency: true
            }
          }
        }
      }),

      // Comparison period emails (if requested)
      comparisonWhere ? prisma.emailLog.findMany({
        where: comparisonWhere,
        select: {
          id: true,
          invoiceCount: true,
          consolidationSavings: true,
          deliveryStatus: true,
          openedAt: true,
          clickedAt: true,
          sentAt: true
        }
      }) : Promise.resolve([]),

      // Consolidation summary statistics
      prisma.emailLog.aggregate({
        where: baseWhere,
        _count: { id: true },
        _sum: {
          invoiceCount: true,
          consolidationSavings: true
        },
        _avg: {
          invoiceCount: true,
          consolidationSavings: true
        }
      }),

      // Template performance analysis
      prisma.emailLog.groupBy({
        by: ['templateId'],
        where: baseWhere,
        _count: { id: true },
        _sum: { invoiceCount: true },
        _avg: { consolidationSavings: true },
        orderBy: { _count: { id: 'desc' } }
      }),

      // Customer insights
      prisma.emailLog.groupBy({
        by: ['customerId'],
        where: baseWhere,
        _count: { id: true },
        _sum: { invoiceCount: true },
        _max: { sentAt: true },
        orderBy: { _sum: { invoiceCount: 'desc' } }
      }),

      // Time series data for trends
      getTimeSeriesData(authContext.user.companyId, startDate, endDate, granularity),

      // Escalation level analysis
      getEscalationAnalysis(authContext.user.companyId, startDate, endDate),

      // Delivery and performance metrics
      getDeliveryMetrics(authContext.user.companyId, startDate, endDate),

      // Engagement metrics (opens, clicks, responses)
      getEngagementMetrics(authContext.user.companyId, startDate, endDate),

      // Cost and efficiency savings analysis
      getSavingsAnalysis(authContext.user.companyId, startDate, endDate)
    ])

    // Process results and calculate insights
    const analytics = {
      summary: {
        totalConsolidatedEmails: consolidatedEmails.length,
        totalInvoicesConsolidated: consolidationSummary._sum.invoiceCount || 0,
        averageInvoicesPerEmail: consolidationSummary._avg.invoiceCount || 0,
        totalEmailsSaved: Math.round(consolidationSummary._sum.consolidationSavings || 0),
        averageConsolidationSavings: Math.round(consolidationSummary._avg.consolidationSavings || 0),
        timeRange: {
          start: startDate,
          end: endDate,
          days: daysBack
        }
      },

      comparison: comparisonPeriod && comparisonEmails.length > 0 ? {
        totalEmails: comparisonEmails.length,
        totalInvoices: comparisonEmails.reduce((sum, e) => sum + (e.invoiceCount || 0), 0),
        totalSavings: comparisonEmails.reduce((sum, e) => sum + (e.consolidationSavings || 0), 0),
        changes: calculatePeriodChanges(consolidatedEmails, comparisonEmails)
      } : null,

      trends: {
        timeSeries: timeSeriesData,
        growth: calculateGrowthTrends(timeSeriesData),
        seasonality: calculateSeasonalityPatterns(timeSeriesData)
      },

      performance: {
        delivery: deliveryMetrics,
        engagement: engagementMetrics,
        effectiveness: calculateEffectivenessMetrics(consolidatedEmails)
      },

      segmentation: {
        byTemplate: await enrichTemplatePerformance(templatePerformance),
        byCustomer: await enrichCustomerInsights(customerInsights),
        byEscalation: escalationAnalysis,
        byBusinessType: getBusinessTypeSegmentation(consolidatedEmails)
      },

      efficiency: {
        savings: savingsAnalysis,
        consolidationRate: calculateConsolidationRate(consolidatedEmails),
        timeEfficiency: calculateTimeEfficiency(consolidatedEmails),
        resourceOptimization: calculateResourceOptimization(consolidatedEmails)
      },

      insights: {
        topPerformingTemplates: getTopPerformingTemplates(consolidatedEmails),
        customerBehaviorPatterns: getCustomerBehaviorPatterns(consolidatedEmails),
        optimizationOpportunities: getOptimizationOpportunities(consolidatedEmails),
        recommendations: generateRecommendations(consolidatedEmails, timeSeriesData)
      }
    }

    return successResponse(analytics, 'Consolidation analytics retrieved successfully')

  } catch (error) {
    logError('GET /api/email/analytics/consolidation', error)
    return handleApiError(error)
  }
}

/**
 * Helper functions for analytics calculations
 */

async function getTimeSeriesData(companyId: string, startDate: Date, endDate: Date, granularity: string) {
  const groupByClause = granularity === 'day' ? 'DATE(created_at)' :
                       granularity === 'week' ? 'YEARWEEK(created_at)' :
                       'DATE_FORMAT(created_at, "%Y-%m")'

  // This would be a raw SQL query in a real implementation
  // For now, simulate with daily data
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const timeSeriesData = []

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000))
    const dayEmails = await prisma.emailLog.count({
      where: {
        companyId,
        consolidatedReminderId: { not: null },
        createdAt: {
          gte: date,
          lt: new Date(date.getTime() + (24 * 60 * 60 * 1000))
        }
      }
    })

    timeSeriesData.push({
      date: date.toISOString().split('T')[0],
      emails: dayEmails,
      consolidatedInvoices: dayEmails * 2.5, // Estimated average
      savings: dayEmails * 1.5 // Estimated savings
    })
  }

  return timeSeriesData
}

async function getEscalationAnalysis(companyId: string, startDate: Date, endDate: Date) {
  const escalationData = await prisma.customerConsolidatedReminder.groupBy({
    by: ['escalationLevel'],
    where: {
      companyId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: { id: true },
    _avg: {
      totalAmount: true,
      priorityScore: true
    }
  })

  return escalationData.map(item => ({
    escalationLevel: item.escalationLevel,
    count: item._count.id,
    averageAmount: item._avg.totalAmount || 0,
    averagePriority: item._avg.priorityScore || 0
  }))
}

async function getDeliveryMetrics(companyId: string, startDate: Date, endDate: Date) {
  const deliveryData = await prisma.emailLog.groupBy({
    by: ['deliveryStatus'],
    where: {
      companyId,
      consolidatedReminderId: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: { id: true }
  })

  const total = deliveryData.reduce((sum, item) => sum + item._count.id, 0)

  return {
    total,
    breakdown: deliveryData.map(item => ({
      status: item.deliveryStatus,
      count: item._count.id,
      percentage: total > 0 ? (item._count.id / total) * 100 : 0
    })),
    deliveryRate: total > 0 ?
      (deliveryData.find(d => d.deliveryStatus === 'DELIVERED')?._count.id || 0) / total * 100 : 0
  }
}

async function getEngagementMetrics(companyId: string, startDate: Date, endDate: Date) {
  const engagementData = await prisma.emailLog.aggregate({
    where: {
      companyId,
      consolidatedReminderId: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      deliveryStatus: 'DELIVERED'
    },
    _count: {
      id: true,
      openedAt: true,
      clickedAt: true
    }
  })

  const delivered = engagementData._count.id
  const opened = engagementData._count.openedAt || 0
  const clicked = engagementData._count.clickedAt || 0

  return {
    delivered,
    opened,
    clicked,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
    clickToOpenRate: opened > 0 ? (clicked / opened) * 100 : 0
  }
}

async function getSavingsAnalysis(companyId: string, startDate: Date, endDate: Date) {
  const savingsData = await prisma.emailLog.aggregate({
    where: {
      companyId,
      consolidatedReminderId: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: {
      invoiceCount: true,
      consolidationSavings: true
    },
    _count: { id: true }
  })

  const totalConsolidatedEmails = savingsData._count.id
  const totalInvoicesProcessed = savingsData._sum.invoiceCount || 0
  const emailsSaved = savingsData._sum.consolidationSavings || 0

  // Calculate cost savings (estimate $0.10 per email)
  const costPerEmail = 0.10
  const costSavings = emailsSaved * costPerEmail

  // Calculate time savings (estimate 2 minutes per email)
  const timePerEmailMinutes = 2
  const timeSavings = emailsSaved * timePerEmailMinutes

  return {
    emailsSaved,
    costSavings,
    timeSavings,
    consolidationEfficiency: totalConsolidatedEmails > 0 ?
      (totalInvoicesProcessed / totalConsolidatedEmails) : 0,
    estimatedROI: calculateROI(costSavings, totalConsolidatedEmails)
  }
}

function calculatePeriodChanges(current: any[], comparison: any[]) {
  const currentMetrics = {
    total: current.length,
    invoices: current.reduce((sum, e) => sum + (e.invoiceCount || 0), 0),
    savings: current.reduce((sum, e) => sum + (e.consolidationSavings || 0), 0)
  }

  const comparisonMetrics = {
    total: comparison.length,
    invoices: comparison.reduce((sum, e) => sum + (e.invoiceCount || 0), 0),
    savings: comparison.reduce((sum, e) => sum + (e.consolidationSavings || 0), 0)
  }

  return {
    emailChange: calculatePercentageChange(currentMetrics.total, comparisonMetrics.total),
    invoiceChange: calculatePercentageChange(currentMetrics.invoices, comparisonMetrics.invoices),
    savingsChange: calculatePercentageChange(currentMetrics.savings, comparisonMetrics.savings)
  }
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function calculateGrowthTrends(timeSeriesData: any[]) {
  if (timeSeriesData.length < 2) return { trend: 'stable', rate: 0 }

  const firstWeek = timeSeriesData.slice(0, 7).reduce((sum, d) => sum + d.emails, 0)
  const lastWeek = timeSeriesData.slice(-7).reduce((sum, d) => sum + d.emails, 0)

  const growthRate = firstWeek > 0 ? ((lastWeek - firstWeek) / firstWeek) * 100 : 0

  return {
    trend: growthRate > 10 ? 'growing' : growthRate < -10 ? 'declining' : 'stable',
    rate: growthRate
  }
}

function calculateSeasonalityPatterns(timeSeriesData: any[]) {
  // Simple day-of-week analysis
  const dayPatterns = Array(7).fill(0)

  timeSeriesData.forEach((item, index) => {
    const dayOfWeek = new Date(item.date).getDay()
    dayPatterns[dayOfWeek] += item.emails
  })

  const peakDay = dayPatterns.indexOf(Math.max(...dayPatterns))
  const quietDay = dayPatterns.indexOf(Math.min(...dayPatterns))

  return {
    dayOfWeekPatterns: dayPatterns,
    peakDay,
    quietDay,
    weekdayAverage: (dayPatterns[1] + dayPatterns[2] + dayPatterns[3] + dayPatterns[4] + dayPatterns[5]) / 5,
    weekendAverage: (dayPatterns[0] + dayPatterns[6]) / 2
  }
}

function calculateEffectivenessMetrics(emails: any[]) {
  const delivered = emails.filter(e => e.deliveryStatus === 'DELIVERED').length
  const opened = emails.filter(e => e.openedAt).length
  const clicked = emails.filter(e => e.clickedAt).length

  return {
    deliveryRate: emails.length > 0 ? (delivered / emails.length) * 100 : 0,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
    overallEffectiveness: delivered > 0 ? (clicked / emails.length) * 100 : 0
  }
}

async function enrichTemplatePerformance(templateData: any[]) {
  const enriched = await Promise.all(
    templateData.map(async (item) => {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: item.templateId },
        select: { name: true, templateType: true }
      })

      return {
        templateId: item.templateId,
        templateName: template?.name || 'Unknown',
        templateType: template?.templateType || 'Unknown',
        emailCount: item._count.id,
        totalInvoices: item._sum.invoiceCount || 0,
        averageSavings: item._avg.consolidationSavings || 0
      }
    })
  )

  return enriched.sort((a, b) => b.emailCount - a.emailCount)
}

async function enrichCustomerInsights(customerData: any[]) {
  const enriched = await Promise.all(
    customerData.slice(0, 10).map(async (item) => {
      const customer = await prisma.customer.findUnique({
        where: { id: item.customerId },
        select: { name: true, businessType: true }
      })

      return {
        customerId: item.customerId,
        customerName: customer?.name || 'Unknown',
        businessType: customer?.businessType || 'Unknown',
        emailCount: item._count.id,
        totalInvoices: item._sum.invoiceCount || 0,
        lastEmailDate: item._max.sentAt
      }
    })
  )

  return enriched
}

function getBusinessTypeSegmentation(emails: any[]) {
  const segmentation = new Map()

  emails.forEach(email => {
    const businessType = email.customers?.businessType || 'Unknown'
    if (!segmentation.has(businessType)) {
      segmentation.set(businessType, { count: 0, invoices: 0 })
    }
    const segment = segmentation.get(businessType)
    segment.count++
    segment.invoices += email.invoiceCount || 0
  })

  return Array.from(segmentation.entries()).map(([type, data]) => ({
    businessType: type,
    emailCount: data.count,
    invoiceCount: data.invoices,
    averageInvoicesPerEmail: data.count > 0 ? data.invoices / data.count : 0
  }))
}

function calculateConsolidationRate(emails: any[]) {
  const totalInvoices = emails.reduce((sum, e) => sum + (e.invoiceCount || 0), 0)
  const totalEmails = emails.length

  return {
    consolidationRatio: totalEmails > 0 ? totalInvoices / totalEmails : 0,
    efficiency: totalInvoices > 0 ? ((totalInvoices - totalEmails) / totalInvoices) * 100 : 0
  }
}

function calculateTimeEfficiency(emails: any[]) {
  // Estimate time savings based on consolidation
  const timePerIndividualEmail = 5 // minutes
  const timePerConsolidatedEmail = 8 // minutes

  const totalInvoices = emails.reduce((sum, e) => sum + (e.invoiceCount || 0), 0)
  const timeWithoutConsolidation = totalInvoices * timePerIndividualEmail
  const timeWithConsolidation = emails.length * timePerConsolidatedEmail
  const timeSaved = timeWithoutConsolidation - timeWithConsolidation

  return {
    timeWithoutConsolidation,
    timeWithConsolidation,
    timeSaved,
    efficiencyGain: timeWithoutConsolidation > 0 ? (timeSaved / timeWithoutConsolidation) * 100 : 0
  }
}

function calculateResourceOptimization(emails: any[]) {
  const totalInvoices = emails.reduce((sum, e) => sum + (e.invoiceCount || 0), 0)
  const emailsSaved = totalInvoices - emails.length

  return {
    emailVolumeBefore: totalInvoices,
    emailVolumeAfter: emails.length,
    emailsSaved,
    volumeReduction: totalInvoices > 0 ? (emailsSaved / totalInvoices) * 100 : 0,
    processingEfficiency: emails.length > 0 ? totalInvoices / emails.length : 0
  }
}

function getTopPerformingTemplates(emails: any[]) {
  const templatePerformance = new Map()

  emails.forEach(email => {
    const templateId = email.templateId
    if (!templatePerformance.has(templateId)) {
      templatePerformance.set(templateId, {
        templateName: email.emailTemplate?.name || 'Unknown',
        count: 0,
        opened: 0,
        clicked: 0
      })
    }
    const perf = templatePerformance.get(templateId)
    perf.count++
    if (email.openedAt) perf.opened++
    if (email.clickedAt) perf.clicked++
  })

  return Array.from(templatePerformance.entries())
    .map(([id, data]) => ({
      templateId: id,
      templateName: data.templateName,
      emailCount: data.count,
      openRate: data.count > 0 ? (data.opened / data.count) * 100 : 0,
      clickRate: data.count > 0 ? (data.clicked / data.count) * 100 : 0
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 5)
}

function getCustomerBehaviorPatterns(emails: any[]) {
  const patterns = {
    highEngagement: emails.filter(e => e.openedAt && e.clickedAt).length,
    mediumEngagement: emails.filter(e => e.openedAt && !e.clickedAt).length,
    lowEngagement: emails.filter(e => !e.openedAt).length,
    repeatCustomers: new Set(emails.map(e => e.customerId)).size
  }

  return patterns
}

function getOptimizationOpportunities(emails: any[]) {
  const opportunities = []

  // Low open rate templates
  const lowOpenRateTemplates = getTopPerformingTemplates(emails)
    .filter(t => t.openRate < 20)

  if (lowOpenRateTemplates.length > 0) {
    opportunities.push({
      type: 'template_optimization',
      priority: 'high',
      description: 'Some templates have low open rates and need optimization',
      affectedTemplates: lowOpenRateTemplates.length
    })
  }

  // Underutilized consolidation
  const avgInvoicesPerEmail = emails.reduce((sum, e) => sum + (e.invoiceCount || 0), 0) / emails.length
  if (avgInvoicesPerEmail < 2.5) {
    opportunities.push({
      type: 'consolidation_improvement',
      priority: 'medium',
      description: 'Consolidation efficiency can be improved',
      currentAverage: avgInvoicesPerEmail
    })
  }

  return opportunities
}

function generateRecommendations(emails: any[], timeSeriesData: any[]) {
  const recommendations = []

  // Volume-based recommendations
  if (emails.length > 100) {
    recommendations.push({
      type: 'automation',
      priority: 'high',
      title: 'Increase Automation',
      description: 'High email volume suggests opportunities for increased automation'
    })
  }

  // Timing recommendations
  const trends = calculateGrowthTrends(timeSeriesData)
  if (trends.trend === 'growing') {
    recommendations.push({
      type: 'capacity',
      priority: 'medium',
      title: 'Scale Infrastructure',
      description: 'Growing email volume may require infrastructure scaling'
    })
  }

  // Engagement recommendations
  const avgOpenRate = emails.filter(e => e.openedAt).length / emails.length * 100
  if (avgOpenRate < 25) {
    recommendations.push({
      type: 'content',
      priority: 'high',
      title: 'Improve Email Content',
      description: 'Low open rates suggest need for better subject lines and content'
    })
  }

  return recommendations
}

function calculateROI(costSavings: number, totalEmails: number) {
  const estimatedImplementationCost = totalEmails * 0.05 // $0.05 per email setup cost
  return estimatedImplementationCost > 0 ? (costSavings / estimatedImplementationCost) * 100 : 0
}