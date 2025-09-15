import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { z } from 'zod'

// Analytics query parameters schema
const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '6m', '1y', 'custom']).default('30d'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'status', 'customer']).default('day'),
  currency: z.string().length(3).default('AED'),
  includeForecasting: z.coerce.boolean().default(false),
  includeComparisons: z.coerce.boolean().default(true)
})

interface InvoiceAnalytics {
  overview: {
    totalInvoices: number
    totalAmount: number
    formattedTotalAmount: string
    averageInvoiceAmount: number
    formattedAverageAmount: string
    outstandingAmount: number
    formattedOutstandingAmount: string
    overdueAmount: number
    formattedOverdueAmount: string
    collectionRate: number
    averageDaysToPayment: number
  }
  statusBreakdown: Array<{
    status: InvoiceStatus
    count: number
    totalAmount: number
    formattedAmount: string
    percentage: number
  }>
  timeSeriesData: Array<{
    period: string
    date: Date
    invoiceCount: number
    totalAmount: number
    formattedAmount: string
    paidAmount: number
    formattedPaidAmount: string
    outstandingAmount: number
    formattedOutstandingAmount: string
  }>
  topCustomers: Array<{
    customerName: string
    customerEmail: string
    invoiceCount: number
    totalAmount: number
    formattedAmount: string
    paidAmount: number
    outstandingAmount: number
    averageDaysToPayment: number
    lastInvoiceDate: Date
  }>
  paymentMethodBreakdown: Array<{
    method: string
    count: number
    totalAmount: number
    formattedAmount: string
    percentage: number
  }>
  overdueAnalysis: {
    totalOverdueInvoices: number
    totalOverdueAmount: number
    formattedOverdueAmount: string
    averageDaysOverdue: number
    overdueByAging: Array<{
      agingBucket: string
      count: number
      totalAmount: number
      formattedAmount: string
    }>
  }
  comparisons?: {
    previousPeriod: {
      totalInvoices: number
      totalAmount: number
      growthRate: number
      outstandingAmount: number
      collectionRate: number
    }
    yearOverYear?: {
      totalInvoices: number
      totalAmount: number
      growthRate: number
    }
  }
  forecasting?: {
    expectedRevenue: Array<{
      period: string
      expectedAmount: number
      confidence: number
    }>
    cashFlowProjection: Array<{
      period: string
      projectedInflow: number
      projectedOutstanding: number
    }>
  }
  insights: Array<{
    type: 'warning' | 'info' | 'success'
    title: string
    description: string
    actionable: boolean
    priority: 'high' | 'medium' | 'low'
  }>
}

// GET /api/invoices/analytics - Get comprehensive invoice analytics
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const query = analyticsQuerySchema.parse(Object.fromEntries(searchParams.entries()))
    
    // Calculate date range based on period
    const { startDate, endDate } = calculateDateRange(query.period, query.startDate, query.endDate)
    
    // Execute comprehensive analytics queries in parallel
    const [
      overviewData,
      statusBreakdown,
      timeSeriesData,
      topCustomersData,
      paymentMethodData,
      overdueData,
      comparisonData
    ] = await Promise.all([
      getOverviewMetrics(authContext.user.companyId, startDate, endDate, query.currency),
      getStatusBreakdown(authContext.user.companyId, startDate, endDate, query.currency),
      getTimeSeriesData(authContext.user.companyId, startDate, endDate, query.groupBy, query.currency),
      getTopCustomers(authContext.user.companyId, startDate, endDate, query.currency),
      getPaymentMethodBreakdown(authContext.user.companyId, startDate, endDate, query.currency),
      getOverdueAnalysis(authContext.user.companyId, query.currency),
      query.includeComparisons ? getComparisonData(authContext.user.companyId, startDate, endDate, query.currency) : null
    ])

    // Generate forecasting data if requested
    let forecastingData = null
    if (query.includeForecasting) {
      forecastingData = await generateForecastingData(authContext.user.companyId, startDate, endDate, query.currency)
    }

    // Generate business insights
    const insights = generateBusinessInsights(overviewData, statusBreakdown, overdueData, comparisonData)

    const analytics: InvoiceAnalytics = {
      overview: overviewData,
      statusBreakdown,
      timeSeriesData,
      topCustomers: topCustomersData,
      paymentMethodBreakdown: paymentMethodData,
      overdueAnalysis: overdueData,
      comparisons: comparisonData,
      forecasting: forecastingData,
      insights
    }

    return successResponse({
      analytics,
      metadata: {
        companyId: authContext.user.companyId,
        period: query.period,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        currency: query.currency,
        generatedAt: new Date().toISOString(),
        dataFreshness: 'real-time'
      }
    }, 'Invoice analytics retrieved successfully')

  } catch (error) {
    logError('GET /api/invoices/analytics', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// Helper functions for analytics calculations

function calculateDateRange(period: string, customStart?: Date, customEnd?: Date) {
  const now = new Date()
  let startDate: Date
  let endDate = now

  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd }
  }

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case '6m':
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      break
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return { startDate, endDate }
}

async function getOverviewMetrics(companyId: string, startDate: Date, endDate: Date, currency: string) {
  const [invoiceStats, paymentStats] = await Promise.all([
    prisma.invoices.aggregate({
      where: {
        companyId,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true }
    }),
    prisma.payments.aggregate({
      where: {
        invoices: {
          companyId,
          createdAt: { gte: startDate, lte: endDate }
        }
      },
      _sum: { amount: true },
      _avg: { amount: true }
    })
  ])

  // Calculate outstanding and overdue amounts
  const outstandingInvoices = await prisma.invoices.findMany({
    where: {
      companyId,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED] },
      createdAt: { gte: startDate, lte: endDate }
    },
    include: { payments: true }
  })

  const overdueInvoices = await prisma.invoices.findMany({
    where: {
      companyId,
      status: InvoiceStatus.OVERDUE,
      createdAt: { gte: startDate, lte: endDate }
    },
    include: { payments: true }
  })

  // Calculate payment timing
  const paidInvoices = await prisma.invoices.findMany({
    where: {
      companyId,
      status: InvoiceStatus.PAID,
      createdAt: { gte: startDate, lte: endDate }
    },
    include: {
      payments: {
        orderBy: { paymentDate: 'desc' },
        take: 1
      }
    }
  })

  const totalInvoices = invoiceStats._count.id || 0
  const totalAmount = new Decimal(invoiceStats._sum.totalAmount || 0)
  const averageInvoiceAmount = new Decimal(invoiceStats._avg.totalAmount || 0)

  const outstandingAmount = outstandingInvoices.reduce((sum, invoice) => {
    const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
    const paidAmount = invoice.payments.reduce((pSum, payment) => pSum.plus(payment.amount), new Decimal(0))
    return sum.plus(invoiceTotal.minus(paidAmount))
  }, new Decimal(0))

  const overdueAmount = overdueInvoices.reduce((sum, invoice) => {
    const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
    const paidAmount = invoice.payments.reduce((pSum, payment) => pSum.plus(payment.amount), new Decimal(0))
    return sum.plus(invoiceTotal.minus(paidAmount))
  }, new Decimal(0))

  const paidAmount = new Decimal(paymentStats._sum.amount || 0)
  const collectionRate = totalAmount.greaterThan(0) ? paidAmount.dividedBy(totalAmount).times(100).toNumber() : 0

  const averageDaysToPayment = paidInvoices.length > 0
    ? paidInvoices.reduce((sum, invoice) => {
        if (invoice.payments[0]) {
          const daysDiff = Math.ceil(
            (invoice.payments[0].paymentDate.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + daysDiff
        }
        return sum
      }, 0) / paidInvoices.length
    : 0

  return {
    totalInvoices,
    totalAmount: totalAmount.toNumber(),
    formattedTotalAmount: formatUAECurrency(totalAmount, currency),
    averageInvoiceAmount: averageInvoiceAmount.toNumber(),
    formattedAverageAmount: formatUAECurrency(averageInvoiceAmount, currency),
    outstandingAmount: outstandingAmount.toNumber(),
    formattedOutstandingAmount: formatUAECurrency(outstandingAmount, currency),
    overdueAmount: overdueAmount.toNumber(),
    formattedOverdueAmount: formatUAECurrency(overdueAmount, currency),
    collectionRate: Math.round(collectionRate * 100) / 100,
    averageDaysToPayment: Math.round(averageDaysToPayment)
  }
}

async function getStatusBreakdown(companyId: string, startDate: Date, endDate: Date, currency: string) {
  const statusData = await prisma.invoices.groupBy({
    by: ['status'],
    where: {
      companyId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: { status: true },
    _sum: { totalAmount: true }
  })

  const totalInvoices = statusData.reduce((sum, item) => sum + item._count.status, 0)
  const totalAmount = statusData.reduce((sum, item) => sum.plus(item._sum.totalAmount || 0), new Decimal(0))

  return statusData.map(item => ({
    status: item.status,
    count: item._count.status,
    totalAmount: new Decimal(item._sum.totalAmount || 0).toNumber(),
    formattedAmount: formatUAECurrency(item._sum.totalAmount || 0, currency),
    percentage: totalInvoices > 0 ? Math.round((item._count.status / totalInvoices) * 100 * 100) / 100 : 0
  }))
}

async function getTimeSeriesData(companyId: string, startDate: Date, endDate: Date, groupBy: string, currency: string) {
  // This would need to be implemented with proper date grouping based on the database
  // For now, returning a simplified version
  const intervals = generateTimeIntervals(startDate, endDate, groupBy)
  
  const timeSeriesData = []
  for (const interval of intervals) {
    const periodStart = interval.start
    const periodEnd = interval.end

    const [invoiceData, paymentData] = await Promise.all([
      prisma.invoices.aggregate({
        where: {
          companyId,
          createdAt: { gte: periodStart, lt: periodEnd }
        },
        _count: { id: true },
        _sum: { totalAmount: true }
      }),
      prisma.payments.aggregate({
        where: {
          invoices: { companyId },
          paymentDate: { gte: periodStart, lt: periodEnd }
        },
        _sum: { amount: true }
      })
    ])

    const totalAmount = new Decimal(invoiceData._sum.totalAmount || 0)
    const paidAmount = new Decimal(paymentData._sum.amount || 0)
    const outstandingAmount = totalAmount.minus(paidAmount)

    timeSeriesData.push({
      period: interval.label,
      date: periodStart,
      invoiceCount: invoiceData._count.id || 0,
      totalAmount: totalAmount.toNumber(),
      formattedAmount: formatUAECurrency(totalAmount, currency),
      paidAmount: paidAmount.toNumber(),
      formattedPaidAmount: formatUAECurrency(paidAmount, currency),
      outstandingAmount: Math.max(0, outstandingAmount.toNumber()),
      formattedOutstandingAmount: formatUAECurrency(Math.max(0, outstandingAmount.toNumber()), currency)
    })
  }

  return timeSeriesData
}

async function getTopCustomers(companyId: string, startDate: Date, endDate: Date, currency: string) {
  const customerData = await prisma.invoices.groupBy({
    by: ['customerName', 'customerEmail'],
    where: {
      companyId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: { id: true },
    _sum: { totalAmount: true },
    _max: { createdAt: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 10
  })

  const topCustomers = []
  for (const customer of customerData) {
    // Get payment data for this customer
    const customerPayments = await prisma.payments.aggregate({
      where: {
        invoices: {
          companyId,
          customerEmail: customer.customerEmail,
          createdAt: { gte: startDate, lte: endDate }
        }
      },
      _sum: { amount: true }
    })

    // Calculate average days to payment for this customer
    const customerPaidInvoices = await prisma.invoices.findMany({
      where: {
        companyId,
        customerEmail: customer.customerEmail,
        status: InvoiceStatus.PAID,
        createdAt: { gte: startDate, lte: endDate }
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 1
        }
      }
    })

    const averageDaysToPayment = customerPaidInvoices.length > 0
      ? customerPaidInvoices.reduce((sum, invoice) => {
          if (invoice.payments[0]) {
            const daysDiff = Math.ceil(
              (invoice.payments[0].paymentDate.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            return sum + daysDiff
          }
          return sum
        }, 0) / customerPaidInvoices.length
      : 0

    const totalAmount = new Decimal(customer._sum.totalAmount || 0)
    const paidAmount = new Decimal(customerPayments._sum.amount || 0)
    const outstandingAmount = totalAmount.minus(paidAmount)

    topCustomers.push({
      customerName: customer.customerName,
      customerEmail: customer.customerEmail,
      invoiceCount: customer._count.id,
      totalAmount: totalAmount.toNumber(),
      formattedAmount: formatUAECurrency(totalAmount, currency),
      paidAmount: paidAmount.toNumber(),
      outstandingAmount: Math.max(0, outstandingAmount.toNumber()),
      averageDaysToPayment: Math.round(averageDaysToPayment),
      lastInvoiceDate: customer._max.createdAt || new Date()
    })
  }

  return topCustomers
}

async function getPaymentMethodBreakdown(companyId: string, startDate: Date, endDate: Date, currency: string) {
  const paymentMethodData = await prisma.payments.groupBy({
    by: ['method'],
    where: {
      invoices: { companyId },
      paymentDate: { gte: startDate, lte: endDate }
    },
    _count: { method: true },
    _sum: { amount: true }
  })

  const totalPayments = paymentMethodData.reduce((sum, item) => sum + item._count.method, 0)

  return paymentMethodData.map(item => ({
    method: item.method,
    count: item._count.method,
    totalAmount: new Decimal(item._sum.amount || 0).toNumber(),
    formattedAmount: formatUAECurrency(item._sum.amount || 0, currency),
    percentage: totalPayments > 0 ? Math.round((item._count.method / totalPayments) * 100 * 100) / 100 : 0
  }))
}

async function getOverdueAnalysis(companyId: string, currency: string) {
  const overdueInvoices = await prisma.invoices.findMany({
    where: {
      companyId,
      status: InvoiceStatus.OVERDUE
    },
    include: { payments: true }
  })

  const now = new Date()
  const agingBuckets = [
    { label: '1-30 days', min: 1, max: 30 },
    { label: '31-60 days', min: 31, max: 60 },
    { label: '61-90 days', min: 61, max: 90 },
    { label: '90+ days', min: 91, max: Infinity }
  ]

  const overdueByAging = agingBuckets.map(bucket => {
    const invoicesInBucket = overdueInvoices.filter(invoice => {
      const daysOverdue = Math.ceil((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysOverdue >= bucket.min && daysOverdue <= bucket.max
    })

    const totalAmount = invoicesInBucket.reduce((sum, invoice) => {
      const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
      const paidAmount = invoice.payments.reduce((pSum, payment) => pSum.plus(payment.amount), new Decimal(0))
      return sum.plus(invoiceTotal.minus(paidAmount))
    }, new Decimal(0))

    return {
      agingBucket: bucket.label,
      count: invoicesInBucket.length,
      totalAmount: totalAmount.toNumber(),
      formattedAmount: formatUAECurrency(totalAmount, currency)
    }
  })

  const totalOverdueAmount = overdueByAging.reduce((sum, bucket) => sum + bucket.totalAmount, 0)
  const averageDaysOverdue = overdueInvoices.length > 0
    ? overdueInvoices.reduce((sum, invoice) => {
        const daysOverdue = Math.ceil((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        return sum + daysOverdue
      }, 0) / overdueInvoices.length
    : 0

  return {
    totalOverdueInvoices: overdueInvoices.length,
    totalOverdueAmount,
    formattedOverdueAmount: formatUAECurrency(totalOverdueAmount, currency),
    averageDaysOverdue: Math.round(averageDaysOverdue),
    overdueByAging
  }
}

async function getComparisonData(companyId: string, startDate: Date, endDate: Date, currency: string) {
  const periodDuration = endDate.getTime() - startDate.getTime()
  const previousPeriodStart = new Date(startDate.getTime() - periodDuration)
  const previousPeriodEnd = startDate

  const [currentPeriod, previousPeriod] = await Promise.all([
    getOverviewMetrics(companyId, startDate, endDate, currency),
    getOverviewMetrics(companyId, previousPeriodStart, previousPeriodEnd, currency)
  ])

  const invoiceGrowthRate = previousPeriod.totalInvoices > 0
    ? ((currentPeriod.totalInvoices - previousPeriod.totalInvoices) / previousPeriod.totalInvoices) * 100
    : 0

  const revenueGrowthRate = previousPeriod.totalAmount > 0
    ? ((currentPeriod.totalAmount - previousPeriod.totalAmount) / previousPeriod.totalAmount) * 100
    : 0

  return {
    previousPeriod: {
      totalInvoices: previousPeriod.totalInvoices,
      totalAmount: previousPeriod.totalAmount,
      growthRate: Math.round(invoiceGrowthRate * 100) / 100,
      outstandingAmount: previousPeriod.outstandingAmount,
      collectionRate: previousPeriod.collectionRate
    }
  }
}

async function generateForecastingData(companyId: string, startDate: Date, endDate: Date, currency: string) {
  // Simple forecasting based on historical trends
  // In a real implementation, this would use more sophisticated algorithms
  
  const historical = await getOverviewMetrics(companyId, startDate, endDate, currency)
  const periodDuration = endDate.getTime() - startDate.getTime()
  const periodsInFuture = 3

  const expectedRevenue = []
  const cashFlowProjection = []

  for (let i = 1; i <= periodsInFuture; i++) {
    const futureStart = new Date(endDate.getTime() + (periodDuration * (i - 1)))
    const futureEnd = new Date(endDate.getTime() + (periodDuration * i))

    // Simple linear projection based on current trends
    const projectedAmount = historical.totalAmount * (1 + (historical.collectionRate / 100) * 0.1)
    const confidence = Math.max(0.5, 1 - (i * 0.2)) // Decreasing confidence over time

    expectedRevenue.push({
      period: `Period ${i}`,
      expectedAmount: projectedAmount,
      confidence: Math.round(confidence * 100)
    })

    cashFlowProjection.push({
      period: `Period ${i}`,
      projectedInflow: projectedAmount * (historical.collectionRate / 100),
      projectedOutstanding: projectedAmount * (1 - historical.collectionRate / 100)
    })
  }

  return {
    expectedRevenue,
    cashFlowProjection
  }
}

function generateBusinessInsights(overview: any, statusBreakdown: any[], overdueData: any, comparisonData: any) {
  const insights = []

  // Collection rate insights
  if (overview.collectionRate < 70) {
    insights.push({
      type: 'warning' as const,
      title: 'Low Collection Rate',
      description: `Collection rate of ${overview.collectionRate}% is below optimal range. Consider improving follow-up processes.`,
      actionable: true,
      priority: 'high' as const
    })
  } else if (overview.collectionRate > 85) {
    insights.push({
      type: 'success' as const,
      title: 'Excellent Collection Rate',
      description: `Collection rate of ${overview.collectionRate}% is excellent. Keep up the good work!`,
      actionable: false,
      priority: 'low' as const
    })
  }

  // Overdue insights
  if (overdueData.totalOverdueInvoices > 0) {
    const overduePercentage = (overdueData.totalOverdueAmount / overview.totalAmount) * 100
    
    if (overduePercentage > 20) {
      insights.push({
        type: 'warning' as const,
        title: 'High Overdue Amount',
        description: `${Math.round(overduePercentage)}% of total invoice value is overdue. Immediate action required.`,
        actionable: true,
        priority: 'high' as const
      })
    }
  }

  // Payment timing insights
  if (overview.averageDaysToPayment > 45) {
    insights.push({
      type: 'info' as const,
      title: 'Slow Payment Processing',
      description: `Average payment time of ${overview.averageDaysToPayment} days could be improved with better payment terms.`,
      actionable: true,
      priority: 'medium' as const
    })
  }

  // Growth insights
  if (comparisonData && comparisonData.previousPeriod.growthRate > 20) {
    insights.push({
      type: 'success' as const,
      title: 'Strong Growth',
      description: `Invoice volume grew by ${Math.round(comparisonData.previousPeriod.growthRate)}% compared to previous period.`,
      actionable: false,
      priority: 'low' as const
    })
  }

  return insights
}

function generateTimeIntervals(startDate: Date, endDate: Date, groupBy: string) {
  const intervals = []
  const current = new Date(startDate)

  while (current < endDate) {
    const intervalStart = new Date(current)
    let intervalEnd: Date

    switch (groupBy) {
      case 'day':
        intervalEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000)
        break
      case 'week':
        intervalEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        intervalEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1)
        break
      default:
        intervalEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000)
    }

    if (intervalEnd > endDate) {
      intervalEnd = endDate
    }

    intervals.push({
      start: intervalStart,
      end: intervalEnd,
      label: formatIntervalLabel(intervalStart, groupBy)
    })

    current.setTime(intervalEnd.getTime())
  }

  return intervals
}

function formatIntervalLabel(date: Date, groupBy: string): string {
  switch (groupBy) {
    case 'day':
      return date.toISOString().split('T')[0]
    case 'week':
      const weekStart = new Date(date)
      const weekEnd = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000)
      return `${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    default:
      return date.toISOString().split('T')[0]
  }
}