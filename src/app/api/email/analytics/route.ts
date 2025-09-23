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
      company_id: authContext.user.companyId,
      created_at: { gte: startDate }
    }

    // Add filters
    if (templateId) {
      Object.assign(baseWhere, { template_id: templateId })
    }

    if (templateType) {
      Object.assign(baseWhere, {
        email_templates: { template_id: templateType }
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
    prisma.email_logs.count({ where: { ...whereClause, delivery_status: { not: 'QUEUED' } } }),
    prisma.email_logs.count({ where: { ...whereClause, delivery_status: 'DELIVERED' } }),
    prisma.email_logs.count({ where: { ...whereClause, opened_at: { not: null } } }),
    prisma.email_logs.count({ where: { ...whereClause, clicked_at: { not: null } } }),
    prisma.email_logs.count({ where: { ...whereClause, delivery_status: 'BOUNCED' } }),
    prisma.email_logs.count({ where: { ...whereClause, delivery_status: 'COMPLAINED' } }),
    prisma.email_logs.count({ where: { ...whereClause, delivery_status: 'UNSUBSCRIBED' } }),
    prisma.email_logs.count({ where: { ...whereClause, language: 'ARABIC' } })
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
  const statusCounts = await prisma.email_logs.groupBy({
    by: ['delivery_status'],
    where: whereClause,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  })

  return statusCounts.map(status => ({
    status: status.delivery_status,
    count: status._count.id
  }))
}

async function getDailyStats(whereClause: any, daysBack: number) {
  // This would typically use raw SQL for better performance
  // For simplicity, we'll group by day using JavaScript
  const emailLogs = await prisma.email_logs.findMany({
    where: whereClause,
    select: {
      created_at: true,
      delivery_status: true,
      opened_at: true,
      clicked_at: true
    }
  })

  const dailyStats: Record<string, any> = {}
  
  emailLogs.forEach(log => {
    const day = log.created_at.toISOString().split('T')[0]
    
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
    
    if (log.delivery_status === 'DELIVERED') dailyStats[day].delivered++
    if (log.opened_at) dailyStats[day].opened++
    if (log.clicked_at) dailyStats[day].clicked++
    if (log.delivery_status === 'BOUNCED') dailyStats[day].bounced++
  })

  return Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date))
}

async function getTemplatePerformance(companyId: string, startDate: Date) {
  const templates = await prisma.email_templates.findMany({
    where: {
      company_id: companyId,
      email_logs: {
        some: {
          created_at: { gte: startDate }
        }
      }
    },
    include: {
      email_logs: {
        where: { created_at: { gte: startDate } },
        select: {
          delivery_status: true,
          opened_at: true,
          clicked_at: true
        }
      }
    }
  })

  return templates.map(template => {
    const logs = template.email_logs
    const sent = logs.length
    const delivered = logs.filter(log => log.delivery_status === 'DELIVERED').length
    const opened = logs.filter(log => log.opened_at).length
    const clicked = logs.filter(log => log.clicked_at).length

    return {
      templateId: template.id,
      templateName: template.name,
      templateType: template.template_id,
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
  const recipientStats = await prisma.email_logs.groupBy({
    by: ['recipient_email'],
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
    recipientEmail: stat.recipient_email,
    emailsReceived: stat._count.id
  }))
}

async function getBounceAnalysis(whereClause: any) {
  const bounces = await prisma.email_bounce_tracking.findMany({
    where: {
      email_logs: whereClause
    },
    include: {
      email_logs: {
        select: {
          recipient_email: true,
          bounce_reason: true
        }
      }
    }
  })

  const bounceTypes = bounces.reduce((acc: any, bounce) => {
    acc[bounce.bounce_type] = (acc[bounce.bounce_type] || 0) + 1
    return acc
  }, {})

  const topBounceReasons = bounces.reduce((acc: any, bounce) => {
    const reason = bounce.email_logs.bounce_reason || 'Unknown'
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
  const allEmails = await prisma.email_logs.findMany({
    where: whereClause,
    select: {
      uae_send_time: true,
      sent_at: true
    }
  })

  let businessHoursSent = 0
  let afterHoursSent = 0

  allEmails.forEach(email => {
    const sendTime = email.uae_send_time || email.sent_at
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