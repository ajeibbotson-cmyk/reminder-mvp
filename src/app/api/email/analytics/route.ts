import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'

// GET /api/email/analytics - Get comprehensive email analytics
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const daysBack = parseInt(searchParams.get('days') || '30')
    const templateId = searchParams.get('templateId')
    const templateType = searchParams.get('templateType')
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    // Base where clause
    const baseWhere = {
      companyId: authContext.user.companyId,
      createdAt: { gte: startDate }
    }

    // Add filters
    if (templateId) {
      Object.assign(baseWhere, { templateId })
    }

    if (templateType) {
      Object.assign(baseWhere, { 
        emailTemplates: { templateType: templateType }
      })
    }

    // Get comprehensive analytics in parallel
    const [
      overallStats,
      deliveryStatusStats,
      dailyStats,
      templatePerformance,
      recipientEngagement,
      bounceAnalysis,
      uaeBusinessHoursStats
    ] = await Promise.all([
      // Overall statistics
      getOverallStats(baseWhere),
      
      // Delivery status breakdown
      getDeliveryStatusStats(baseWhere),
      
      // Daily performance over the period
      getDailyStats(baseWhere, daysBack),
      
      // Template performance comparison
      getTemplatePerformance(authContext.user.companyId, startDate),
      
      // Top recipient engagement
      getRecipientEngagement(baseWhere),
      
      // Bounce analysis
      getBounceAnalysis(baseWhere),
      
      // UAE business hours analysis
      getUAEBusinessHoursStats(baseWhere)
    ])

    // Calculate key performance indicators
    const kpis = {
      deliveryRate: overallStats.totalSent > 0 
        ? Math.round((overallStats.totalDelivered / overallStats.totalSent) * 10000) / 100 
        : 0,
      openRate: overallStats.totalDelivered > 0 
        ? Math.round((overallStats.totalOpened / overallStats.totalDelivered) * 10000) / 100 
        : 0,
      clickThroughRate: overallStats.totalOpened > 0 
        ? Math.round((overallStats.totalClicked / overallStats.totalOpened) * 10000) / 100 
        : 0,
      bounceRate: overallStats.totalSent > 0 
        ? Math.round((overallStats.totalBounced / overallStats.totalSent) * 10000) / 100 
        : 0,
      complaintRate: overallStats.totalSent > 0 
        ? Math.round((overallStats.totalComplaints / overallStats.totalSent) * 10000) / 100 
        : 0,
      unsubscribeRate: overallStats.totalSent > 0 
        ? Math.round((overallStats.totalUnsubscribed / overallStats.totalSent) * 10000) / 100 
        : 0,
      
      // UAE-specific KPIs
      businessHoursSendRate: uaeBusinessHoursStats.totalSent > 0 
        ? Math.round((uaeBusinessHoursStats.businessHoursSent / uaeBusinessHoursStats.totalSent) * 10000) / 100 
        : 0,
      arabicContentUsage: overallStats.totalSent > 0 
        ? Math.round((overallStats.arabicEmails / overallStats.totalSent) * 10000) / 100 
        : 0
    }

    // Identify trends (compare with previous period)
    const previousPeriodStart = new Date(startDate)
    previousPeriodStart.setDate(previousPeriodStart.getDate() - daysBack)
    
    const previousStats = await getOverallStats({
      ...baseWhere,
      createdAt: { 
        gte: previousPeriodStart, 
        lt: startDate 
      }
    })

    const trends = {
      deliveryRateTrend: calculateTrend(
        previousStats.totalSent > 0 ? (previousStats.totalDelivered / previousStats.totalSent) * 100 : 0,
        kpis.deliveryRate
      ),
      openRateTrend: calculateTrend(
        previousStats.totalDelivered > 0 ? (previousStats.totalOpened / previousStats.totalDelivered) * 100 : 0,
        kpis.openRate
      ),
      clickRateTrend: calculateTrend(
        previousStats.totalOpened > 0 ? (previousStats.totalClicked / previousStats.totalOpened) * 100 : 0,
        kpis.clickThroughRate
      ),
      bounceRateTrend: calculateTrend(
        previousStats.totalSent > 0 ? (previousStats.totalBounced / previousStats.totalSent) * 100 : 0,
        kpis.bounceRate
      )
    }

    return successResponse({
      period: {
        daysBack,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      },
      filters: {
        templateId,
        templateType
      },
      kpis,
      trends,
      overallStats,
      deliveryStatusStats,
      dailyStats,
      templatePerformance,
      recipientEngagement,
      bounceAnalysis,
      uaeSpecific: {
        businessHoursStats: uaeBusinessHoursStats,
        languageBreakdown: {
          english: overallStats.totalSent - overallStats.arabicEmails,
          arabic: overallStats.arabicEmails,
          englishRate: overallStats.totalSent > 0 
            ? Math.round(((overallStats.totalSent - overallStats.arabicEmails) / overallStats.totalSent) * 10000) / 100 
            : 0,
          arabicRate: kpis.arabicContentUsage
        }
      },
      recommendations: generateRecommendations(kpis, trends, bounceAnalysis, uaeBusinessHoursStats)
    })

  } catch (error) {
    logError('GET /api/email/analytics', error)
    return handleApiError(error)
  }
}

// Helper functions for analytics

async function getOverallStats(whereClause: any) {
  const [
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalBounced,
    totalComplaints,
    totalUnsubscribed,
    arabicEmails
  ] = await Promise.all([
    prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: { not: 'QUEUED' } } }),
    prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'DELIVERED' } }),
    prisma.emailLog.count({ where: { ...whereClause, openedAt: { not: null } } }),
    prisma.emailLog.count({ where: { ...whereClause, clickedAt: { not: null } } }),
    prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'BOUNCED' } }),
    prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'COMPLAINED' } }),
    prisma.emailLog.count({ where: { ...whereClause, deliveryStatus: 'UNSUBSCRIBED' } }),
    prisma.emailLog.count({ where: { ...whereClause, language: 'ARABIC' } })
  ])

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalBounced,
    totalComplaints,
    totalUnsubscribed,
    arabicEmails
  }
}

async function getDeliveryStatusStats(whereClause: any) {
  const statusCounts = await prisma.emailLog.groupBy({
    by: ['deliveryStatus'],
    where: whereClause,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  })

  return statusCounts.map(status => ({
    status: status.deliveryStatus,
    count: status._count.id
  }))
}

async function getDailyStats(whereClause: any, daysBack: number) {
  // This would typically use raw SQL for better performance
  // For simplicity, we'll group by day using JavaScript
  const emailLogs = await prisma.emailLog.findMany({
    where: whereClause,
    select: {
      createdAt: true,
      deliveryStatus: true,
      openedAt: true,
      clickedAt: true
    }
  })

  const dailyStats: Record<string, any> = {}
  
  emailLogs.forEach(log => {
    const day = log.createdAt.toISOString().split('T')[0]
    
    if (!dailyStats[day]) {
      dailyStats[day] = {
        date: day,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0
      }
    }
    
    dailyStats[day].sent++
    
    if (log.deliveryStatus === 'DELIVERED') dailyStats[day].delivered++
    if (log.openedAt) dailyStats[day].opened++
    if (log.clickedAt) dailyStats[day].clicked++
    if (log.deliveryStatus === 'BOUNCED') dailyStats[day].bounced++
  })

  return Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date))
}

async function getTemplatePerformance(companyId: string, startDate: Date) {
  const templates = await prisma.emailTemplate.findMany({
    where: {
      companyId,
      emailLogs: {
        some: {
          createdAt: { gte: startDate }
        }
      }
    },
    include: {
      emailLogs: {
        where: { createdAt: { gte: startDate } },
        select: {
          deliveryStatus: true,
          openedAt: true,
          clickedAt: true
        }
      }
    }
  })

  return templates.map(template => {
    const logs = template.emailLogs
    const sent = logs.length
    const delivered = logs.filter(log => log.deliveryStatus === 'DELIVERED').length
    const opened = logs.filter(log => log.openedAt).length
    const clicked = logs.filter(log => log.clickedAt).length

    return {
      templateId: template.id,
      templateName: template.name,
      templateType: template.templateType,
      sent,
      delivered,
      opened,
      clicked,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 10000) / 100 : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 10000) / 100 : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 10000) / 100 : 0
    }
  }).sort((a, b) => b.sent - a.sent)
}

async function getRecipientEngagement(whereClause: any) {
  const recipientStats = await prisma.emailLog.groupBy({
    by: ['recipientEmail'],
    where: whereClause,
    _count: { id: true },
    _sum: {
      // We would need to convert boolean fields to numbers for this to work
      // This is a simplified version
    },
    orderBy: { _count: { id: 'desc' } },
    take: 10
  })

  return recipientStats.map(stat => ({
    recipientEmail: stat.recipientEmail,
    emailsReceived: stat._count.id
  }))
}

async function getBounceAnalysis(whereClause: any) {
  const bounces = await prisma.emailBounceTracking.findMany({
    where: {
      emailLogs: whereClause
    },
    include: {
      emailLogs: {
        select: {
          recipientEmail: true,
          bounceReason: true
        }
      }
    }
  })

  const bounceTypes = bounces.reduce((acc: any, bounce) => {
    acc[bounce.bounceType] = (acc[bounce.bounceType] || 0) + 1
    return acc
  }, {})

  const topBounceReasons = bounces.reduce((acc: any, bounce) => {
    const reason = bounce.emailLogs.bounceReason || 'Unknown'
    acc[reason] = (acc[reason] || 0) + 1
    return acc
  }, {})

  return {
    totalBounces: bounces.length,
    bounceTypes,
    topBounceReasons: Object.entries(topBounceReasons)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }))
  }
}

async function getUAEBusinessHoursStats(whereClause: any) {
  const allEmails = await prisma.emailLog.findMany({
    where: whereClause,
    select: {
      uaeSendTime: true,
      sentAt: true
    }
  })

  let businessHoursSent = 0
  let afterHoursSent = 0

  allEmails.forEach(email => {
    const sendTime = email.uaeSendTime || email.sentAt
    if (sendTime) {
      const hour = sendTime.getHours()
      const dayOfWeek = sendTime.getDay()
      
      // UAE business hours: Sunday-Thursday, 8 AM - 6 PM
      if (dayOfWeek >= 0 && dayOfWeek <= 4 && hour >= 8 && hour < 18) {
        businessHoursSent++
      } else {
        afterHoursSent++
      }
    }
  })

  return {
    totalSent: allEmails.length,
    businessHoursSent,
    afterHoursSent,
    businessHoursRate: allEmails.length > 0 
      ? Math.round((businessHoursSent / allEmails.length) * 10000) / 100 
      : 0
  }
}

function calculateTrend(previous: number, current: number): { direction: string, percentage: number } {
  if (previous === 0) {
    return { direction: current > 0 ? 'up' : 'neutral', percentage: 0 }
  }
  
  const change = ((current - previous) / previous) * 100
  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    percentage: Math.round(Math.abs(change) * 100) / 100
  }
}

function generateRecommendations(
  kpis: any, 
  trends: any, 
  bounceAnalysis: any, 
  businessHoursStats: any
): string[] {
  const recommendations: string[] = []

  // Delivery rate recommendations
  if (kpis.deliveryRate < 95) {
    recommendations.push('Consider cleaning your email list to improve delivery rate')
  }

  // Open rate recommendations  
  if (kpis.openRate < 20) {
    recommendations.push('Try A/B testing different subject lines to improve open rates')
  }

  // Bounce rate recommendations
  if (kpis.bounceRate > 5) {
    recommendations.push('High bounce rate detected. Review and clean your recipient list')
  }

  // UAE business hours recommendations
  if (businessHoursStats.businessHoursRate < 80) {
    recommendations.push('Consider scheduling more emails during UAE business hours (Sun-Thu, 8 AM - 6 PM)')
  }

  // Arabic content recommendations
  if (kpis.arabicContentUsage < 30) {
    recommendations.push('Consider adding Arabic email templates to better serve UAE customers')
  }

  // Trend-based recommendations
  if (trends.openRateTrend.direction === 'down' && trends.openRateTrend.percentage > 10) {
    recommendations.push('Open rates are declining. Review recent template changes or sending frequency')
  }

  if (trends.deliveryRateTrend.direction === 'down') {
    recommendations.push('Delivery rates are declining. Check your sender reputation and authentication settings')
  }

  // Default recommendation if no issues found
  if (recommendations.length === 0) {
    recommendations.push('Your email performance is good! Continue monitoring metrics for optimization opportunities.')
  }

  return recommendations
}