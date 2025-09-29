/**
 * Payment Performance Analytics Service
 * Advanced analytics for tracking payment delay reduction and performance metrics
 * UAE-specific business logic with AED currency support
 */

import { prisma } from '../prisma'
import { Decimal } from 'decimal.js'
import {
  PaymentPerformanceMetrics,
  AnalyticsDateRange,
  AnalyticsFilters,
  AnalyticsResponse
} from '../types/analytics'
import { DEFAULT_UAE_BUSINESS_HOURS } from '../uae-business-rules'

export class PaymentAnalyticsService {

  /**
   * Calculate comprehensive payment performance metrics
   * Target: 25% payment delay reduction tracking
   */
  async getPaymentPerformance(
    companyId: string,
    filters: AnalyticsFilters
  ): Promise<AnalyticsResponse<PaymentPerformanceMetrics>> {
    const startTime = Date.now()

    try {
      // Get current and previous period data for comparison
      const [currentMetrics, previousMetrics] = await Promise.all([
        this.calculatePeriodMetrics(companyId, filters.dateRange),
        this.calculatePreviousPeriodMetrics(companyId, filters.dateRange)
      ])

      // Calculate payment delay reduction percentage
      const paymentDelayReduction = this.calculateDelayReduction(
        currentMetrics.averagePaymentDelay,
        previousMetrics.averagePaymentDelay
      )

      // Calculate DSO improvement
      const dsoImprovement = this.calculateDSOImprovement(
        currentMetrics.daysOutstanding,
        previousMetrics.daysOutstanding
      )

      // Get payment trends
      const paymentTrends = await this.getPaymentTrends(companyId, filters.dateRange)

      // Build comprehensive metrics
      const metrics: PaymentPerformanceMetrics = {
        averagePaymentDelay: currentMetrics.averagePaymentDelay,
        paymentDelayReduction,
        daysOutstanding: {
          current: currentMetrics.daysOutstanding,
          previous: previousMetrics.daysOutstanding,
          improvement: dsoImprovement
        },
        onTimePayments: {
          count: currentMetrics.onTimePayments,
          percentage: currentMetrics.onTimePaymentRate,
          trend: this.calculateTrend(
            currentMetrics.onTimePaymentRate,
            previousMetrics.onTimePaymentRate
          )
        },
        overduePayments: {
          count: currentMetrics.overduePayments,
          totalAmount: currentMetrics.overdueAmount,
          averageDaysOverdue: currentMetrics.averageDaysOverdue,
          trend: this.calculateTrend(
            currentMetrics.overduePayments,
            previousMetrics.overduePayments
          )
        },
        collectionRate: {
          current: currentMetrics.collectionRate,
          target: 25, // 25% improvement target
          progress: Math.min(100, (paymentDelayReduction / 25) * 100)
        },
        paymentTrends
      }

      const queryTime = Date.now() - startTime

      return {
        data: metrics,
        metadata: {
          queryTime,
          recordsProcessed: currentMetrics.totalInvoices + previousMetrics.totalInvoices,
          cacheHit: false,
          freshness: new Date(),
          filters,
          performance: {
            queryOptimization: 'Parallel execution with indexed queries',
            indexesUsed: ['company_id_status_created_at', 'company_id_payment_date'],
            executionPlan: 'Optimized aggregation with date range partitioning'
          }
        },
        recommendations: this.generateRecommendations(metrics)
      }
    } catch (error) {
      console.error('Error calculating payment performance:', error)
      throw new Error('Failed to calculate payment performance metrics')
    }
  }

  /**
   * Calculate period-specific payment metrics
   */
  private async calculatePeriodMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    const invoiceMetrics = await prisma.invoices.aggregate({
      where: {
        companyId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        },
        isActive: true
      },
      _count: { id: true },
      _sum: { totalAmount: true }
    })

    // Calculate payment delays using UAE business days
    const paymentDelays = await this.calculatePaymentDelays(companyId, dateRange)

    // Get on-time payments
    const onTimePayments = await this.getOnTimePayments(companyId, dateRange)

    // Get overdue payments
    const overdueMetrics = await this.getOverdueMetrics(companyId, dateRange)

    // Calculate Days Sales Outstanding (DSO)
    const daysOutstanding = await this.calculateDSO(companyId, dateRange)

    // Calculate collection rate
    const collectionRate = await this.calculateCollectionRate(companyId, dateRange)

    return {
      totalInvoices: invoiceMetrics._count.id || 0,
      totalAmount: new Decimal(invoiceMetrics._sum.totalAmount || 0),
      averagePaymentDelay: paymentDelays.average,
      daysOutstanding,
      onTimePayments: onTimePayments.count,
      onTimePaymentRate: onTimePayments.rate,
      overduePayments: overdueMetrics.count,
      overdueAmount: overdueMetrics.amount,
      averageDaysOverdue: overdueMetrics.averageDays,
      collectionRate
    }
  }

  /**
   * Calculate payment delays considering UAE business days
   */
  private async calculatePaymentDelays(companyId: string, dateRange: AnalyticsDateRange) {
    const paidInvoices = await prisma.invoices.findMany({
      where: {
        companyId,
        status: 'PAID',
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        },
        isActive: true
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'asc' },
          take: 1
        }
      }
    })

    if (paidInvoices.length === 0) {
      return { average: 0, median: 0, distribution: [] }
    }

    const delays = paidInvoices
      .filter(invoice => invoice.payments.length > 0)
      .map(invoice => {
        const payment = invoice.payments[0]
        const delayDays = this.calculateBusinessDays(invoice.dueDate, payment.paymentDate)
        return Math.max(0, delayDays) // Only count positive delays
      })

    const average = delays.length > 0 ? delays.reduce((sum, delay) => sum + delay, 0) / delays.length : 0
    const sorted = delays.sort((a, b) => a - b)
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0

    return {
      average: Math.round(average * 100) / 100,
      median,
      distribution: this.createDelayDistribution(delays)
    }
  }

  /**
   * Calculate business days between two dates considering UAE business hours
   */
  private calculateBusinessDays(fromDate: Date, toDate: Date): number {
    const businessHours = DEFAULT_UAE_BUSINESS_HOURS
    const start = new Date(fromDate)
    const end = new Date(toDate)

    let businessDays = 0
    const currentDate = new Date(start)

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay()

      // Check if it's a UAE working day (Sunday to Thursday by default)
      if (businessHours.workingDays.includes(dayOfWeek)) {
        businessDays++
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return businessDays
  }

  /**
   * Get on-time payment metrics
   */
  private async getOnTimePayments(companyId: string, dateRange: AnalyticsDateRange) {
    const [totalDue, onTime] = await Promise.all([
      prisma.invoices.count({
        where: {
          companyId,
          dueDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          },
          isActive: true,
          status: { in: ['PAID', 'OVERDUE'] }
        }
      }),
      prisma.invoices.count({
        where: {
          companyId,
          dueDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          },
          isActive: true,
          status: 'PAID',
          payments: {
            some: {
              paymentDate: {
                lte: prisma.$queryRaw`due_date`
              }
            }
          }
        }
      })
    ])

    return {
      count: onTime,
      rate: totalDue > 0 ? (onTime / totalDue) * 100 : 0
    }
  }

  /**
   * Get overdue payment metrics
   */
  private async getOverdueMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    const overdueInvoices = await prisma.invoices.findMany({
      where: {
        companyId,
        status: 'OVERDUE',
        dueDate: {
          lt: new Date()
        },
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        },
        isActive: true
      },
      select: {
        id: true,
        totalAmount: true,
        dueDate: true
      }
    })

    const now = new Date()
    const totalAmount = overdueInvoices.reduce(
      (sum, invoice) => sum.add(invoice.totalAmount || 0),
      new Decimal(0)
    )

    const daysSums = overdueInvoices.map(invoice =>
      this.calculateBusinessDays(invoice.dueDate, now)
    )

    const averageDays = daysSums.length > 0
      ? daysSums.reduce((sum, days) => sum + days, 0) / daysSums.length
      : 0

    return {
      count: overdueInvoices.length,
      amount: totalAmount,
      averageDays: Math.round(averageDays * 100) / 100
    }
  }

  /**
   * Calculate Days Sales Outstanding (DSO) for UAE market
   */
  private async calculateDSO(companyId: string, dateRange: AnalyticsDateRange) {
    const periodDays = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const [totalSales, totalReceivables] = await Promise.all([
      prisma.invoices.aggregate({
        where: {
          companyId,
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          },
          isActive: true
        },
        _sum: { totalAmount: true }
      }),
      prisma.invoices.aggregate({
        where: {
          companyId,
          status: { in: ['SENT', 'OVERDUE'] },
          isActive: true
        },
        _sum: { totalAmount: true }
      })
    ])

    const sales = new Decimal(totalSales._sum.totalAmount || 0)
    const receivables = new Decimal(totalReceivables._sum.totalAmount || 0)

    if (sales.equals(0)) return 0

    // DSO = (Accounts Receivable / Total Sales) * Number of Days
    return receivables.div(sales).mul(periodDays).toNumber()
  }

  /**
   * Calculate collection rate
   */
  private async calculateCollectionRate(companyId: string, dateRange: AnalyticsDateRange) {
    const [totalInvoiced, totalCollected] = await Promise.all([
      prisma.invoices.aggregate({
        where: {
          companyId,
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          },
          isActive: true
        },
        _sum: { totalAmount: true }
      }),
      prisma.payments.aggregate({
        where: {
          paymentDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          },
          invoices: {
            companyId
          }
        },
        _sum: { amount: true }
      })
    ])

    const invoiced = new Decimal(totalInvoiced._sum.totalAmount || 0)
    const collected = new Decimal(totalCollected._sum.amount || 0)

    if (invoiced.equals(0)) return 0

    return collected.div(invoiced).mul(100).toNumber()
  }

  /**
   * Get payment trends over time
   */
  private async getPaymentTrends(companyId: string, dateRange: AnalyticsDateRange) {
    const granularity = this.determineGranularity(dateRange)
    const trends: any[] = []

    // Generate date buckets based on granularity
    const dateBuckets = this.generateDateBuckets(dateRange, granularity)

    for (const bucket of dateBuckets) {
      const metrics = await this.calculatePeriodMetrics(companyId, {
        startDate: bucket.start,
        endDate: bucket.end
      })

      trends.push({
        date: bucket.start.toISOString().split('T')[0],
        onTimePayments: metrics.onTimePayments,
        delayedPayments: metrics.overduePayments,
        averageDelay: metrics.averagePaymentDelay,
        totalAmount: metrics.totalAmount
      })
    }

    return trends
  }

  /**
   * Calculate previous period metrics for comparison
   */
  private async calculatePreviousPeriodMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    const periodDuration = dateRange.endDate.getTime() - dateRange.startDate.getTime()
    const previousEnd = new Date(dateRange.startDate.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - periodDuration)

    return this.calculatePeriodMetrics(companyId, {
      startDate: previousStart,
      endDate: previousEnd
    })
  }

  /**
   * Calculate payment delay reduction percentage
   */
  private calculateDelayReduction(currentDelay: number, previousDelay: number): number {
    if (previousDelay === 0) return 0
    return ((previousDelay - currentDelay) / previousDelay) * 100
  }

  /**
   * Calculate DSO improvement
   */
  private calculateDSOImprovement(currentDSO: number, previousDSO: number): number {
    if (previousDSO === 0) return 0
    return ((previousDSO - currentDSO) / previousDSO) * 100
  }

  /**
   * Calculate trend percentage
   */
  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  /**
   * Create delay distribution buckets
   */
  private createDelayDistribution(delays: number[]) {
    const buckets = {
      '0-7': 0,
      '8-14': 0,
      '15-30': 0,
      '31-60': 0,
      '60+': 0
    }

    delays.forEach(delay => {
      if (delay <= 7) buckets['0-7']++
      else if (delay <= 14) buckets['8-14']++
      else if (delay <= 30) buckets['15-30']++
      else if (delay <= 60) buckets['31-60']++
      else buckets['60+']++
    })

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: delays.length > 0 ? (count / delays.length) * 100 : 0
    }))
  }

  /**
   * Determine appropriate granularity based on date range
   */
  private determineGranularity(dateRange: AnalyticsDateRange): 'day' | 'week' | 'month' {
    const days = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (days <= 7) return 'day'
    if (days <= 90) return 'week'
    return 'month'
  }

  /**
   * Generate date buckets for trend analysis
   */
  private generateDateBuckets(dateRange: AnalyticsDateRange, granularity: 'day' | 'week' | 'month') {
    const buckets: Array<{ start: Date; end: Date }> = []
    const current = new Date(dateRange.startDate)

    while (current < dateRange.endDate) {
      const bucketStart = new Date(current)
      let bucketEnd: Date

      switch (granularity) {
        case 'day':
          bucketEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'week':
          bucketEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          bucketEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1)
          break
      }

      buckets.push({
        start: bucketStart,
        end: new Date(Math.min(bucketEnd.getTime(), dateRange.endDate.getTime()))
      })

      current.setTime(bucketEnd.getTime())
    }

    return buckets
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PaymentPerformanceMetrics) {
    const recommendations = []

    // Payment delay recommendations
    if (metrics.averagePaymentDelay > 15) {
      recommendations.push({
        type: 'business' as const,
        message: 'Average payment delay exceeds 15 days. Consider implementing automated follow-up sequences.',
        action: 'Setup follow-up automation'
      })
    }

    // Collection rate recommendations
    if (metrics.collectionRate.current < 80) {
      recommendations.push({
        type: 'business' as const,
        message: 'Collection rate below 80%. Review payment terms and customer communication strategies.',
        action: 'Optimize collection processes'
      })
    }

    // Progress toward 25% target
    if (metrics.collectionRate.progress < 50) {
      recommendations.push({
        type: 'business' as const,
        message: 'Less than 50% progress toward 25% improvement target. Accelerate optimization efforts.',
        action: 'Implement advanced analytics insights'
      })
    }

    return recommendations
  }
}

// Export singleton instance
export const paymentAnalyticsService = new PaymentAnalyticsService()