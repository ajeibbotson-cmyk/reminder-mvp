import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'

interface DetailedSequenceAnalytics {
  sequence: {
    id: string
    name: string
    description: string
    active: boolean
    stepsCount: number
    createdAt: Date
    updatedAt: Date
  }
  performance: {
    totalExecutions: number
    activeExecutions: number
    completedExecutions: number
    conversionRate: number
    averageCompletionTime: number
    successRate: number
  }
  stepAnalytics: Array<{
    stepNumber: number
    executionCount: number
    openRate: number
    clickRate: number
    responseRate: number
    averageTimeToOpen: number
    bounceRate: number
    issues: string[]
  }>
  timeAnalytics: {
    executionsByDay: Array<{
      date: string
      executions: number
      conversions: number
    }>
    executionsByHour: Array<{
      hour: number
      executions: number
      openRate: number
    }>
    executionsByDayOfWeek: Array<{
      dayOfWeek: number
      dayName: string
      executions: number
      conversionRate: number
    }>
  }
  customerAnalytics: {
    topConvertingCustomers: Array<{
      customerName: string
      customerEmail: string
      conversions: number
      totalInvoiceValue: number
    }>
    customerSegmentPerformance: Array<{
      segment: string
      count: number
      conversionRate: number
    }>
  }
  recentActivity: Array<{
    id: string
    invoiceNumber: string
    customerName: string
    stepNumber: number
    status: string
    sentAt: Date
    lastActivity: Date
  }>
  recommendations: Array<{
    type: 'TIMING' | 'CONTENT' | 'FREQUENCY' | 'TARGETING'
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    title: string
    description: string
    expectedImprovement: string
  }>
}

/**
 * GET /api/sequences/analytics/[id]
 * Get detailed analytics for a specific sequence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') 
      ? new Date(searchParams.get('dateFrom')!) 
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Default 90 days

    const dateTo = searchParams.get('dateTo') 
      ? new Date(searchParams.get('dateTo')!) 
      : new Date()

    // Get sequence and verify ownership
    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.companies.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    // Parse sequence steps
    let steps = []
    try {
      steps = typeof sequence.steps === 'string' 
        ? JSON.parse(sequence.steps) 
        : sequence.steps || []
    } catch {
      steps = []
    }

    // Get comprehensive analytics
    const analytics = await buildDetailedAnalytics(
      sequence,
      steps,
      user.companies.id,
      dateFrom,
      dateTo
    )

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error fetching sequence analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sequence analytics' },
      { status: 500 }
    )
  }
}

/**
 * Build detailed analytics for a specific sequence
 */
async function buildDetailedAnalytics(
  sequence: any,
  steps: any[],
  companyId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<DetailedSequenceAnalytics> {

  // Get basic sequence analytics
  const baseAnalytics = await sequenceExecutionService.getSequenceAnalytics(sequence.id)

  // Get detailed execution data
  const executionLogs = await prisma.follow_up_logs.findMany({
    where: {
      sequenceId: sequence.id,
      sentAt: {
        gte: dateFrom,
        lte: dateTo
      }
    },
    include: {
      invoice: {
        include: {
          customer: true,
          payments: true
        }
      },
      emailLogs: true
    },
    orderBy: { sentAt: 'desc' }
  })

  // Build step analytics with detailed metrics
  const stepAnalytics = await buildStepAnalytics(executionLogs, steps)

  // Build time-based analytics
  const timeAnalytics = buildTimeAnalytics(executionLogs)

  // Build customer analytics
  const customerAnalytics = buildCustomerAnalytics(executionLogs)

  // Get recent activity (last 20 executions)
  const recentActivity = executionLogs.slice(0, 20).map(log => ({
    id: log.id,
    invoiceNumber: log.invoice.number,
    customerName: log.invoice.customerName,
    stepNumber: log.stepNumber,
    status: determineExecutionStatus(log),
    sentAt: log.sentAt,
    lastActivity: log.responseReceived || log.emailClicked || log.emailOpened || log.sentAt
  }))

  // Generate recommendations
  const recommendations = generateRecommendations(baseAnalytics, stepAnalytics, timeAnalytics)

  // Calculate success rate
  const totalEmails = executionLogs.flatMap(log => log.emailLogs || []).length
  const deliveredEmails = executionLogs.flatMap(log => 
    (log.emailLogs || []).filter(email => email.deliveryStatus === 'DELIVERED')
  ).length
  const successRate = totalEmails > 0 ? (deliveredEmails / totalEmails) * 100 : 100

  return {
    sequence: {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description || '',
      active: sequence.active,
      stepsCount: steps.length,
      createdAt: sequence.createdAt,
      updatedAt: sequence.updatedAt
    },
    performance: {
      totalExecutions: baseAnalytics.totalExecutions,
      activeExecutions: baseAnalytics.activeExecutions,
      completedExecutions: baseAnalytics.completedExecutions,
      conversionRate: baseAnalytics.conversionRate,
      averageCompletionTime: baseAnalytics.averageCompletionTime,
      successRate: Math.round(successRate * 100) / 100
    },
    stepAnalytics,
    timeAnalytics,
    customerAnalytics,
    recentActivity,
    recommendations
  }
}

/**
 * Build detailed step analytics
 */
async function buildStepAnalytics(executionLogs: any[], steps: any[]) {
  const stepMetrics: Record<number, {
    executions: number
    emails: any[]
    opens: number
    clicks: number
    responses: number
    bounces: number
    totalTimeToOpen: number
    openCount: number
  }> = {}

  // Initialize metrics for each step
  steps.forEach(step => {
    stepMetrics[step.stepNumber] = {
      executions: 0,
      emails: [],
      opens: 0,
      clicks: 0,
      responses: 0,
      bounces: 0,
      totalTimeToOpen: 0,
      openCount: 0
    }
  })

  // Aggregate metrics from execution logs
  executionLogs.forEach(log => {
    const stepNum = log.stepNumber
    if (!stepMetrics[stepNum]) return

    stepMetrics[stepNum].executions++

    if (log.emailLogs && log.emailLogs.length > 0) {
      log.emailLogs.forEach((email: any) => {
        stepMetrics[stepNum].emails.push(email)

        if (email.openedAt) {
          stepMetrics[stepNum].opens++
          if (email.sentAt) {
            const timeToOpen = email.openedAt.getTime() - email.sentAt.getTime()
            stepMetrics[stepNum].totalTimeToOpen += timeToOpen
            stepMetrics[stepNum].openCount++
          }
        }

        if (email.clickedAt) {
          stepMetrics[stepNum].clicks++
        }

        if (email.deliveryStatus === 'BOUNCED') {
          stepMetrics[stepNum].bounces++
        }
      })
    }

    if (log.responseReceived) {
      stepMetrics[stepNum].responses++
    }
  })

  // Convert to analytics format
  return steps.map(step => {
    const metrics = stepMetrics[step.stepNumber] || {
      executions: 0, emails: [], opens: 0, clicks: 0, responses: 0, bounces: 0,
      totalTimeToOpen: 0, openCount: 0
    }

    const openRate = metrics.executions > 0 ? (metrics.opens / metrics.executions) * 100 : 0
    const clickRate = metrics.opens > 0 ? (metrics.clicks / metrics.opens) * 100 : 0
    const responseRate = metrics.executions > 0 ? (metrics.responses / metrics.executions) * 100 : 0
    const bounceRate = metrics.emails.length > 0 ? (metrics.bounces / metrics.emails.length) * 100 : 0
    const averageTimeToOpen = metrics.openCount > 0 
      ? metrics.totalTimeToOpen / metrics.openCount / (1000 * 60 * 60) // Convert to hours
      : 0

    // Identify issues
    const issues: string[] = []
    if (openRate < 15) issues.push('Low open rate - improve subject line')
    if (clickRate < 5) issues.push('Low click rate - improve content relevance')
    if (bounceRate > 5) issues.push('High bounce rate - check email list quality')
    if (responseRate < 2 && step.stepNumber > 2) issues.push('No responses - may be too aggressive')

    return {
      stepNumber: step.stepNumber,
      executionCount: metrics.executions,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      responseRate: Math.round(responseRate * 100) / 100,
      averageTimeToOpen: Math.round(averageTimeToOpen * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      issues
    }
  })
}

/**
 * Build time-based analytics
 */
function buildTimeAnalytics(executionLogs: any[]) {
  // Group by date
  const executionsByDate: Record<string, { executions: number; conversions: number }> = {}
  
  // Group by hour
  const executionsByHour: Record<number, { executions: number; opens: number }> = {}
  
  // Group by day of week
  const executionsByDayOfWeek: Record<number, { executions: number; conversions: number }> = {}

  executionLogs.forEach(log => {
    const date = log.sentAt.toISOString().split('T')[0]
    const hour = log.sentAt.getHours()
    const dayOfWeek = log.sentAt.getDay()

    // By date
    if (!executionsByDate[date]) {
      executionsByDate[date] = { executions: 0, conversions: 0 }
    }
    executionsByDate[date].executions++
    
    // Check if converted (simplified - payment received)
    if (log.invoice.payments && log.invoice.payments.length > 0) {
      executionsByDate[date].conversions++
    }

    // By hour
    if (!executionsByHour[hour]) {
      executionsByHour[hour] = { executions: 0, opens: 0 }
    }
    executionsByHour[hour].executions++
    if (log.emailOpened) {
      executionsByHour[hour].opens++
    }

    // By day of week
    if (!executionsByDayOfWeek[dayOfWeek]) {
      executionsByDayOfWeek[dayOfWeek] = { executions: 0, conversions: 0 }
    }
    executionsByDayOfWeek[dayOfWeek].executions++
    if (log.invoice.payments && log.invoice.payments.length > 0) {
      executionsByDayOfWeek[dayOfWeek].conversions++
    }
  })

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return {
    executionsByDay: Object.entries(executionsByDate).map(([date, data]) => ({
      date,
      executions: data.executions,
      conversions: data.conversions
    })).sort((a, b) => a.date.localeCompare(b.date)),

    executionsByHour: Array.from({ length: 24 }, (_, hour) => {
      const data = executionsByHour[hour] || { executions: 0, opens: 0 }
      return {
        hour,
        executions: data.executions,
        openRate: data.executions > 0 ? (data.opens / data.executions) * 100 : 0
      }
    }),

    executionsByDayOfWeek: Array.from({ length: 7 }, (_, dayOfWeek) => {
      const data = executionsByDayOfWeek[dayOfWeek] || { executions: 0, conversions: 0 }
      return {
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        executions: data.executions,
        conversionRate: data.executions > 0 ? (data.conversions / data.executions) * 100 : 0
      }
    })
  }
}

/**
 * Build customer analytics
 */
function buildCustomerAnalytics(executionLogs: any[]) {
  const customerMetrics: Record<string, {
    customerName: string
    customerEmail: string
    executions: number
    conversions: number
    totalInvoiceValue: number
  }> = {}

  executionLogs.forEach(log => {
    const email = log.invoice.customerEmail
    
    if (!customerMetrics[email]) {
      customerMetrics[email] = {
        customerName: log.invoice.customerName,
        customerEmail: email,
        executions: 0,
        conversions: 0,
        totalInvoiceValue: 0
      }
    }

    customerMetrics[email].executions++
    customerMetrics[email].totalInvoiceValue += Number(log.invoice.totalAmount || log.invoice.amount)

    // Check if converted
    if (log.invoice.payments && log.invoice.payments.length > 0) {
      customerMetrics[email].conversions++
    }
  })

  const topConvertingCustomers = Object.values(customerMetrics)
    .filter(customer => customer.conversions > 0)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 10)

  // Simple customer segmentation
  const customerSegmentPerformance = [
    {
      segment: 'High Value (>AED 10,000)',
      count: Object.values(customerMetrics).filter(c => c.totalInvoiceValue > 10000).length,
      conversionRate: calculateSegmentConversionRate(
        Object.values(customerMetrics).filter(c => c.totalInvoiceValue > 10000)
      )
    },
    {
      segment: 'Medium Value (AED 1,000-10,000)',
      count: Object.values(customerMetrics).filter(c => 
        c.totalInvoiceValue >= 1000 && c.totalInvoiceValue <= 10000
      ).length,
      conversionRate: calculateSegmentConversionRate(
        Object.values(customerMetrics).filter(c => 
          c.totalInvoiceValue >= 1000 && c.totalInvoiceValue <= 10000
        )
      )
    },
    {
      segment: 'Low Value (<AED 1,000)',
      count: Object.values(customerMetrics).filter(c => c.totalInvoiceValue < 1000).length,
      conversionRate: calculateSegmentConversionRate(
        Object.values(customerMetrics).filter(c => c.totalInvoiceValue < 1000)
      )
    }
  ]

  return {
    topConvertingCustomers,
    customerSegmentPerformance
  }
}

/**
 * Calculate conversion rate for customer segment
 */
function calculateSegmentConversionRate(customer: any[]): number {
  if (customers.length === 0) return 0
  
  const totalExecutions = customers.reduce((sum, c) => sum + c.executions, 0)
  const totalConversions = customers.reduce((sum, c) => sum + c.conversions, 0)
  
  return totalExecutions > 0 ? (totalConversions / totalExecutions) * 100 : 0
}

/**
 * Determine execution status
 */
function determineExecutionStatus(log: any): string {
  if (log.responseReceived) return 'RESPONDED'
  if (log.emailClicked) return 'CLICKED'
  if (log.emailOpened) return 'OPENED'
  if (log.emailLogs && log.emailLogs.some((e: any) => e.deliveryStatus === 'DELIVERED')) return 'DELIVERED'
  if (log.emailLogs && log.emailLogs.some((e: any) => e.deliveryStatus === 'BOUNCED')) return 'BOUNCED'
  return 'SENT'
}

/**
 * Generate recommendations based on analytics
 */
function generateRecommendations(
  baseAnalytics: any,
  stepAnalytics: any[],
  timeAnalytics: any
): Array<{
  type: 'TIMING' | 'CONTENT' | 'FREQUENCY' | 'TARGETING'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
  expectedImprovement: string
}> {
  const recommendations = []

  // Timing recommendations
  const bestHour = timeAnalytics.executionsByHour
    .reduce((best, current) => current.openRate > best.openRate ? current : best)
  
  if (bestHour.openRate > 30) {
    recommendations.push({
      type: 'TIMING' as const,
      priority: 'MEDIUM' as const,
      title: `Optimize send time to ${bestHour.hour}:00`,
      description: `Your sequence performs best when sent at ${bestHour.hour}:00 with ${bestHour.openRate.toFixed(1)}% open rate`,
      expectedImprovement: '+15% open rate'
    })
  }

  // Content recommendations
  const lowPerformingSteps = stepAnalytics.filter(step => step.openRate < 15)
  if (lowPerformingSteps.length > 0) {
    recommendations.push({
      type: 'CONTENT' as const,
      priority: 'HIGH' as const,
      title: 'Improve subject lines for low-performing steps',
      description: `Steps ${lowPerformingSteps.map(s => s.stepNumber).join(', ')} have open rates below 15%`,
      expectedImprovement: '+25% open rate'
    })
  }

  // Frequency recommendations
  if (baseAnalytics.conversionRate < 20) {
    recommendations.push({
      type: 'FREQUENCY' as const,
      priority: 'MEDIUM' as const,
      title: 'Adjust sequence timing',
      description: 'Low conversion rate suggests timing may be too aggressive for UAE culture',
      expectedImprovement: '+10% conversion rate'
    })
  }

  // Cultural compliance
  const bestDay = timeAnalytics.executionsByDayOfWeek
    .filter(day => day.dayOfWeek >= 2 && day.dayOfWeek <= 4) // Tue-Thu
    .reduce((best, current) => current.conversionRate > best.conversionRate ? current : best, { conversionRate: 0 })

  if (bestDay.conversionRate > 25) {
    recommendations.push({
      type: 'TIMING' as const,
      priority: 'LOW' as const,
      title: `Focus on ${bestDay.dayName}s`,
      description: `Best performance on ${bestDay.dayName}s with ${bestDay.conversionRate.toFixed(1)}% conversion rate`,
      expectedImprovement: '+8% conversion rate'
    })
  }

  return recommendations.slice(0, 5) // Return top 5 recommendations
}