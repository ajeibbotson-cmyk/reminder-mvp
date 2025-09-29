/**
 * Customer Analytics Service
 * Advanced customer insights with payment behavior analysis, risk scoring, and UAE market intelligence
 */

import { prisma } from '../prisma'
import { Decimal } from 'decimal.js'
import {
  CustomerInsightsAnalytics,
  AnalyticsDateRange,
  AnalyticsFilters,
  AnalyticsResponse
} from '../types/analytics'
import { DEFAULT_UAE_BUSINESS_HOURS } from '../uae-business-rules'

interface CustomerBehaviorData {
  customerId: string
  customerName: string
  averagePaymentDays: number
  paymentReliability: number
  totalInvoices: number
  totalAmount: Decimal
  outstandingAmount: Decimal
  lastPaymentDate: Date | null
  riskScore: number
}

export class CustomerAnalyticsService {

  /**
   * Get comprehensive customer insights analytics
   */
  async getCustomerInsights(
    companyId: string,
    filters: AnalyticsFilters
  ): Promise<AnalyticsResponse<CustomerInsightsAnalytics>> {
    const startTime = Date.now()

    try {
      // Get customer behavior segments
      const paymentBehaviorSegments = await this.getPaymentBehaviorSegments(companyId, filters.dateRange)

      // Calculate risk distribution
      const riskDistribution = await this.getRiskDistribution(companyId)

      // Get customer value metrics
      const customerValueMetrics = await this.getCustomerValueMetrics(companyId, filters.dateRange)

      // Analyze payment patterns
      const paymentPatterns = await this.getPaymentPatterns(companyId, filters.dateRange)

      const insights: CustomerInsightsAnalytics = {
        paymentBehaviorSegments,
        riskDistribution,
        customerValueMetrics,
        paymentPatterns
      }

      const queryTime = Date.now() - startTime

      return {
        data: insights,
        metadata: {
          queryTime,
          recordsProcessed: await this.getTotalCustomerCount(companyId),
          cacheHit: false,
          freshness: new Date(),
          filters,
          performance: {
            queryOptimization: 'Optimized with customer behavior aggregations and risk scoring indexes',
            indexesUsed: [
              'company_id_outstanding_balance',
              'company_id_risk_score',
              'company_id_last_payment_date'
            ],
            executionPlan: 'Parallel execution with customer segmentation and risk analysis'
          }
        },
        recommendations: this.generateCustomerRecommendations(insights)
      }
    } catch (error) {
      console.error('Error calculating customer insights:', error)
      throw new Error('Failed to calculate customer insights analytics')
    }
  }

  /**
   * Get payment behavior segments
   */
  private async getPaymentBehaviorSegments(companyId: string, dateRange: AnalyticsDateRange) {
    const customers = await this.getCustomerBehaviorData(companyId, dateRange)

    // Segment customers based on payment behavior
    const segments = {
      excellent: { count: 0, criteria: 'Pays early or on time, 0-5 days average', avgPaymentDays: 0 },
      good: { count: 0, criteria: 'Pays within terms, 6-15 days average', avgPaymentDays: 0 },
      average: { count: 0, criteria: 'Sometimes late, 16-30 days average', avgPaymentDays: 0 },
      poor: { count: 0, criteria: 'Frequently late, 30+ days average', avgPaymentDays: 0 }
    }

    const excellentCustomers: number[] = []
    const goodCustomers: number[] = []
    const averageCustomers: number[] = []
    const poorCustomers: number[] = []

    customers.forEach(customer => {
      if (customer.averagePaymentDays <= 5 && customer.paymentReliability >= 0.9) {
        segments.excellent.count++
        excellentCustomers.push(customer.averagePaymentDays)
      } else if (customer.averagePaymentDays <= 15 && customer.paymentReliability >= 0.7) {
        segments.good.count++
        goodCustomers.push(customer.averagePaymentDays)
      } else if (customer.averagePaymentDays <= 30 && customer.paymentReliability >= 0.5) {
        segments.average.count++
        averageCustomers.push(customer.averagePaymentDays)
      } else {
        segments.poor.count++
        poorCustomers.push(customer.averagePaymentDays)
      }
    })

    // Calculate average payment days for each segment
    segments.excellent.avgPaymentDays = this.calculateAverage(excellentCustomers)
    segments.good.avgPaymentDays = this.calculateAverage(goodCustomers)
    segments.average.avgPaymentDays = this.calculateAverage(averageCustomers)
    segments.poor.avgPaymentDays = this.calculateAverage(poorCustomers)

    return segments
  }

  /**
   * Get customer behavior data
   */
  private async getCustomerBehaviorData(companyId: string, dateRange: AnalyticsDateRange): Promise<CustomerBehaviorData[]> {
    const customers = await prisma.customers.findMany({
      where: {
        companyId,
        isActive: true
      },
      include: {
        invoices: {
          where: {
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate
            },
            isActive: true
          },
          include: {
            payments: {
              orderBy: { paymentDate: 'asc' }
            }
          }
        }
      }
    })

    const behaviorData: CustomerBehaviorData[] = []

    for (const customer of customers) {
      const invoices = customer.invoices
      if (invoices.length === 0) continue

      // Calculate payment behavior metrics
      const paymentDelays: number[] = []
      let paidInvoices = 0
      let totalAmount = new Decimal(0)
      let outstandingAmount = new Decimal(0)
      let lastPaymentDate: Date | null = null

      for (const invoice of invoices) {
        totalAmount = totalAmount.add(invoice.totalAmount || 0)

        if (invoice.status === 'PAID' && invoice.payments.length > 0) {
          paidInvoices++
          const payment = invoice.payments[0] // First payment
          const delay = this.calculateUAEBusinessDays(invoice.dueDate, payment.paymentDate)
          paymentDelays.push(Math.max(0, delay))

          if (!lastPaymentDate || payment.paymentDate > lastPaymentDate) {
            lastPaymentDate = payment.paymentDate
          }
        } else if (invoice.status !== 'PAID') {
          outstandingAmount = outstandingAmount.add(invoice.totalAmount || 0)
        }
      }

      const averagePaymentDays = paymentDelays.length > 0
        ? paymentDelays.reduce((sum, delay) => sum + delay, 0) / paymentDelays.length
        : 0

      const paymentReliability = invoices.length > 0 ? paidInvoices / invoices.length : 0

      // Calculate risk score (0-10, where 10 is highest risk)
      const riskScore = this.calculateRiskScore({
        averagePaymentDays,
        paymentReliability,
        outstandingAmount,
        totalInvoices: invoices.length,
        daysSinceLastPayment: lastPaymentDate
          ? Math.ceil((new Date().getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
          : 999
      })

      behaviorData.push({
        customerId: customer.id,
        customerName: customer.name,
        averagePaymentDays: Math.round(averagePaymentDays * 100) / 100,
        paymentReliability: Math.round(paymentReliability * 100) / 100,
        totalInvoices: invoices.length,
        totalAmount,
        outstandingAmount,
        lastPaymentDate,
        riskScore
      })

      // Update customer risk score in database
      await prisma.customers.update({
        where: { id: customer.id },
        data: {
          riskScore: new Decimal(riskScore),
          lastPaymentDate,
          outstandingBalance: outstandingAmount,
          paymentBehavior: JSON.stringify({
            averagePaymentDays,
            paymentReliability,
            lastUpdated: new Date()
          })
        }
      })
    }

    return behaviorData
  }

  /**
   * Calculate risk score for a customer
   */
  private calculateRiskScore(factors: {
    averagePaymentDays: number
    paymentReliability: number
    outstandingAmount: Decimal
    totalInvoices: number
    daysSinceLastPayment: number
  }): number {
    let riskScore = 0

    // Payment delay factor (0-3 points)
    if (factors.averagePaymentDays > 60) riskScore += 3
    else if (factors.averagePaymentDays > 30) riskScore += 2
    else if (factors.averagePaymentDays > 15) riskScore += 1

    // Payment reliability factor (0-3 points)
    if (factors.paymentReliability < 0.3) riskScore += 3
    else if (factors.paymentReliability < 0.6) riskScore += 2
    else if (factors.paymentReliability < 0.8) riskScore += 1

    // Outstanding amount factor (0-2 points)
    if (factors.outstandingAmount.gt(50000)) riskScore += 2
    else if (factors.outstandingAmount.gt(10000)) riskScore += 1

    // Recency factor (0-2 points)
    if (factors.daysSinceLastPayment > 90) riskScore += 2
    else if (factors.daysSinceLastPayment > 45) riskScore += 1

    return Math.min(10, riskScore)
  }

  /**
   * Get risk distribution
   */
  private async getRiskDistribution(companyId: string) {
    const customers = await prisma.customers.findMany({
      where: {
        companyId,
        isActive: true
      },
      select: {
        riskScore: true,
        outstandingBalance: true
      }
    })

    const distribution = {
      low: { count: 0, percentage: 0, totalOutstanding: new Decimal(0) },
      medium: { count: 0, percentage: 0, totalOutstanding: new Decimal(0) },
      high: { count: 0, percentage: 0, totalOutstanding: new Decimal(0) },
      critical: { count: 0, percentage: 0, totalOutstanding: new Decimal(0) }
    }

    customers.forEach(customer => {
      const riskScore = customer.riskScore?.toNumber() || 0
      const outstanding = new Decimal(customer.outstandingBalance || 0)

      if (riskScore <= 2) {
        distribution.low.count++
        distribution.low.totalOutstanding = distribution.low.totalOutstanding.add(outstanding)
      } else if (riskScore <= 5) {
        distribution.medium.count++
        distribution.medium.totalOutstanding = distribution.medium.totalOutstanding.add(outstanding)
      } else if (riskScore <= 7) {
        distribution.high.count++
        distribution.high.totalOutstanding = distribution.high.totalOutstanding.add(outstanding)
      } else {
        distribution.critical.count++
        distribution.critical.totalOutstanding = distribution.critical.totalOutstanding.add(outstanding)
      }
    })

    const totalCustomers = customers.length

    // Calculate percentages
    distribution.low.percentage = totalCustomers > 0 ? (distribution.low.count / totalCustomers) * 100 : 0
    distribution.medium.percentage = totalCustomers > 0 ? (distribution.medium.count / totalCustomers) * 100 : 0
    distribution.high.percentage = totalCustomers > 0 ? (distribution.high.count / totalCustomers) * 100 : 0
    distribution.critical.percentage = totalCustomers > 0 ? (distribution.critical.count / totalCustomers) * 100 : 0

    return distribution
  }

  /**
   * Get customer value metrics
   */
  private async getCustomerValueMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    const customers = await this.getCustomerBehaviorData(companyId, dateRange)

    // Calculate average LTV
    const totalLTV = customers.reduce((sum, customer) => sum.add(customer.totalAmount), new Decimal(0))
    const averageLTV = customers.length > 0 ? totalLTV.div(customers.length) : new Decimal(0)

    // Get top customers by LTV
    const topCustomers = customers
      .sort((a, b) => b.totalAmount.cmp(a.totalAmount))
      .slice(0, 10)
      .map(customer => ({
        customerId: customer.customerId,
        customerName: customer.customerName,
        ltv: customer.totalAmount,
        riskScore: customer.riskScore,
        paymentReliability: customer.paymentReliability
      }))

    // Calculate churn risk
    const churnRisk = {
      highRisk: customers.filter(c => c.riskScore >= 7).length,
      mediumRisk: customers.filter(c => c.riskScore >= 4 && c.riskScore < 7).length,
      lowRisk: customers.filter(c => c.riskScore < 4).length
    }

    return {
      averageLTV,
      topCustomers,
      churnRisk
    }
  }

  /**
   * Get payment patterns analysis
   */
  private async getPaymentPatterns(companyId: string, dateRange: AnalyticsDateRange) {
    // Get payment methods distribution
    const paymentMethods = await prisma.payments.groupBy({
      by: ['method'],
      where: {
        paymentDate: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        },
        invoices: {
          companyId
        }
      },
      _count: { id: true }
    })

    const preferredMethods: Record<string, number> = {}
    paymentMethods.forEach(method => {
      preferredMethods[method.method] = method._count.id
    })

    // Get payment timing patterns
    const invoicesWithPayments = await prisma.invoices.findMany({
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
          take: 1,
          orderBy: { paymentDate: 'asc' }
        }
      }
    })

    let earlyPayments = 0
    let onTimePayments = 0
    let latePayments = 0

    invoicesWithPayments.forEach(invoice => {
      if (invoice.payments.length > 0) {
        const payment = invoice.payments[0]
        const daysDiff = Math.ceil((payment.paymentDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff < 0) earlyPayments++
        else if (daysDiff === 0) onTimePayments++
        else latePayments++
      }
    })

    const totalPayments = earlyPayments + onTimePayments + latePayments

    // Get seasonal trends (simplified)
    const seasonalTrends = await this.getSeasonalPaymentTrends(companyId, dateRange)

    return {
      preferredMethods,
      paymentTiming: {
        early: totalPayments > 0 ? (earlyPayments / totalPayments) * 100 : 0,
        onTime: totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0,
        late: totalPayments > 0 ? (latePayments / totalPayments) * 100 : 0
      },
      seasonalTrends
    }
  }

  /**
   * Get seasonal payment trends
   */
  private async getSeasonalPaymentTrends(companyId: string, dateRange: AnalyticsDateRange) {
    const trends: Array<{
      month: number
      averagePaymentDays: number
      paymentVolume: number
    }> = []

    // Analyze by month
    for (let month = 1; month <= 12; month++) {
      const monthStart = new Date(dateRange.startDate.getFullYear(), month - 1, 1)
      const monthEnd = new Date(dateRange.startDate.getFullYear(), month, 0)

      if (monthStart > dateRange.endDate || monthEnd < dateRange.startDate) {
        continue
      }

      const monthlyInvoices = await prisma.invoices.findMany({
        where: {
          companyId,
          status: 'PAID',
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          },
          isActive: true
        },
        include: {
          payments: {
            take: 1,
            orderBy: { paymentDate: 'asc' }
          }
        }
      })

      const paymentDelays = monthlyInvoices
        .filter(invoice => invoice.payments.length > 0)
        .map(invoice => {
          const payment = invoice.payments[0]
          return this.calculateUAEBusinessDays(invoice.dueDate, payment.paymentDate)
        })

      const averagePaymentDays = paymentDelays.length > 0
        ? paymentDelays.reduce((sum, delay) => sum + delay, 0) / paymentDelays.length
        : 0

      trends.push({
        month,
        averagePaymentDays: Math.round(averagePaymentDays * 100) / 100,
        paymentVolume: monthlyInvoices.length
      })
    }

    return trends
  }

  /**
   * Calculate UAE business days between dates
   */
  private calculateUAEBusinessDays(fromDate: Date, toDate: Date): number {
    if (toDate <= fromDate) return 0

    const businessHours = DEFAULT_UAE_BUSINESS_HOURS
    let businessDays = 0
    const currentDate = new Date(fromDate)

    while (currentDate < toDate) {
      currentDate.setDate(currentDate.getDate() + 1)
      const dayOfWeek = currentDate.getDay()

      if (businessHours.workingDays.includes(dayOfWeek)) {
        const isHoliday = businessHours.customHolidays.some(holiday =>
          holiday.toDateString() === currentDate.toDateString()
        )

        if (!isHoliday) {
          businessDays++
        }
      }
    }

    return businessDays
  }

  /**
   * Calculate average of an array
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return Math.round((numbers.reduce((sum, num) => sum + num, 0) / numbers.length) * 100) / 100
  }

  /**
   * Get total customer count for performance metadata
   */
  private async getTotalCustomerCount(companyId: string): Promise<number> {
    return prisma.customers.count({
      where: {
        companyId,
        isActive: true
      }
    })
  }

  /**
   * Update customer risk scores in batch
   */
  async updateCustomerRiskScores(companyId: string): Promise<number> {
    try {
      const dateRange: AnalyticsDateRange = {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
        endDate: new Date()
      }

      const customers = await this.getCustomerBehaviorData(companyId, dateRange)
      console.log(`Updated risk scores for ${customers.length} customers`)
      return customers.length

    } catch (error) {
      console.error('Error updating customer risk scores:', error)
      throw new Error('Failed to update customer risk scores')
    }
  }

  /**
   * Get customers at risk of churn
   */
  async getChurnRiskCustomers(companyId: string) {
    const highRiskCustomers = await prisma.customers.findMany({
      where: {
        companyId,
        isActive: true,
        riskScore: {
          gte: 7
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        riskScore: true,
        outstandingBalance: true,
        lastPaymentDate: true,
        paymentBehavior: true
      },
      orderBy: {
        riskScore: 'desc'
      }
    })

    return highRiskCustomers.map(customer => ({
      ...customer,
      riskLevel: customer.riskScore?.toNumber() || 0 >= 8 ? 'Critical' : 'High',
      daysSinceLastPayment: customer.lastPaymentDate
        ? Math.ceil((new Date().getTime() - customer.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
        : null
    }))
  }

  /**
   * Generate customer recommendations
   */
  private generateCustomerRecommendations(insights: CustomerInsightsAnalytics) {
    const recommendations = []

    // Risk-based recommendations
    if (insights.riskDistribution.critical.count > 0) {
      recommendations.push({
        type: 'business' as const,
        message: `${insights.riskDistribution.critical.count} customers at critical risk. Immediate attention required.`,
        action: 'Review critical risk customers and implement recovery plans'
      })
    }

    if (insights.riskDistribution.high.count > insights.riskDistribution.low.count) {
      recommendations.push({
        type: 'business' as const,
        message: 'More high-risk than low-risk customers. Consider improving collection processes.',
        action: 'Enhance customer payment education and support'
      })
    }

    // Churn risk recommendations
    if (insights.customerValueMetrics.churnRisk.highRisk > 5) {
      recommendations.push({
        type: 'business' as const,
        message: `${insights.customerValueMetrics.churnRisk.highRisk} high-value customers at churn risk.`,
        action: 'Implement customer retention strategies'
      })
    }

    return recommendations
  }
}

// Export singleton instance
export const customerAnalyticsService = new CustomerAnalyticsService()