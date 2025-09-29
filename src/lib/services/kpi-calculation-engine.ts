/**
 * KPI Calculation Engine
 * Real-time KPI processing with performance optimization and caching
 * Advanced analytics engine for UAE payment reminder platform
 */

import { prisma } from '../prisma'
import { Decimal } from 'decimal.js'
import {
  DashboardAnalytics,
  AnalyticsDateRange,
  AnalyticsFilters,
  AnalyticsResponse,
  AnalyticsEvent
} from '../types/analytics'
import { paymentAnalyticsService } from './payment-analytics-service'
import { invoiceAnalyticsService } from './invoice-analytics-service'
import { customerAnalyticsService } from './customer-analytics-service'
import { emailAnalyticsService } from './email-analytics-service'
import { uaeBusinessIntelligenceService } from './uae-business-intelligence-service'

interface KPICache {
  [key: string]: {
    data: any
    timestamp: Date
    expiresAt: Date
  }
}

interface RealtimeKPI {
  name: string
  value: number | Decimal
  trend: number
  target?: number
  unit?: string
  lastUpdated: Date
}

export class KPICalculationEngine {
  private cache: KPICache = {}
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly REALTIME_TTL = 30 * 1000 // 30 seconds for real-time KPIs

  /**
   * Get comprehensive dashboard analytics with real-time KPIs
   */
  async getDashboardAnalytics(
    companyId: string,
    filters: AnalyticsFilters
  ): Promise<AnalyticsResponse<DashboardAnalytics>> {
    const startTime = Date.now()

    try {
      // Check cache first for non-real-time data
      const cacheKey = this.generateCacheKey('dashboard', companyId, filters)
      const cachedData = this.getCachedData(cacheKey)

      if (cachedData) {
        return {
          ...cachedData,
          metadata: {
            ...cachedData.metadata,
            cacheHit: true,
            queryTime: Date.now() - startTime
          }
        }
      }

      // Calculate all analytics in parallel for performance
      const [
        overview,
        paymentPerformance,
        invoiceStatus,
        customerInsights,
        emailCampaigns,
        uaeIntelligence,
        realtimeMetrics,
        predictions
      ] = await Promise.all([
        this.calculateOverviewKPIs(companyId, filters),
        paymentAnalyticsService.getPaymentPerformance(companyId, filters),
        invoiceAnalyticsService.getInvoiceStatusAnalytics(companyId, filters),
        customerAnalyticsService.getCustomerInsights(companyId, filters),
        emailAnalyticsService.getEmailAnalytics(companyId, filters.dateRange.startDate, filters.dateRange.endDate),
        uaeBusinessIntelligenceService.getUAEBusinessIntelligence(companyId, filters),
        this.getRealtimeMetrics(companyId),
        this.generatePredictiveAnalytics(companyId, filters)
      ])

      const analytics: DashboardAnalytics = {
        overview,
        paymentPerformance: paymentPerformance.data,
        invoiceStatus: invoiceStatus.data,
        customerInsights: customerInsights.data,
        emailCampaigns: this.transformEmailAnalytics(emailCampaigns),
        uaeIntelligence: uaeIntelligence.data,
        realtimeMetrics,
        predictions
      }

      const response: AnalyticsResponse<DashboardAnalytics> = {
        data: analytics,
        metadata: {
          queryTime: Date.now() - startTime,
          recordsProcessed: this.calculateTotalRecords([
            paymentPerformance.metadata.recordsProcessed,
            invoiceStatus.metadata.recordsProcessed,
            customerInsights.metadata.recordsProcessed
          ]),
          cacheHit: false,
          freshness: new Date(),
          filters,
          performance: {
            queryOptimization: 'Parallel execution with selective caching',
            indexesUsed: this.combineIndexesUsed([
              paymentPerformance.metadata.performance.indexesUsed,
              invoiceStatus.metadata.performance.indexesUsed,
              customerInsights.metadata.performance.indexesUsed
            ]),
            executionPlan: 'Comprehensive dashboard with real-time KPI calculation'
          }
        },
        recommendations: this.consolidateRecommendations([
          paymentPerformance.recommendations || [],
          invoiceStatus.recommendations || [],
          customerInsights.recommendations || [],
          uaeIntelligence.recommendations || []
        ])
      }

      // Cache the response (excluding real-time metrics)
      this.setCachedData(cacheKey, response, this.CACHE_TTL)

      return response

    } catch (error) {
      console.error('Error calculating dashboard analytics:', error)
      throw new Error('Failed to calculate comprehensive dashboard analytics')
    }
  }

  /**
   * Calculate overview KPIs
   */
  private async calculateOverviewKPIs(companyId: string, filters: AnalyticsFilters) {
    const [
      invoiceMetrics,
      paymentMetrics,
      customerMetrics,
      collectionEfficiency
    ] = await Promise.all([
      this.getInvoiceOverviewMetrics(companyId, filters.dateRange),
      this.getPaymentOverviewMetrics(companyId, filters.dateRange),
      this.getCustomerOverviewMetrics(companyId),
      this.calculateCollectionEfficiency(companyId, filters.dateRange)
    ])

    return {
      totalInvoices: invoiceMetrics.count,
      totalAmount: invoiceMetrics.totalAmount,
      totalOutstanding: invoiceMetrics.outstandingAmount,
      paymentDelayReduction: paymentMetrics.delayReduction,
      collectionEfficiency: collectionEfficiency,
      customerSatisfaction: customerMetrics.satisfactionScore
    }
  }

  /**
   * Get invoice overview metrics
   */
  private async getInvoiceOverviewMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    const [totalMetrics, outstandingMetrics] = await Promise.all([
      prisma.invoices.aggregate({
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

    return {
      count: totalMetrics._count.id || 0,
      totalAmount: new Decimal(totalMetrics._sum.totalAmount || 0),
      outstandingAmount: new Decimal(outstandingMetrics._sum.totalAmount || 0)
    }
  }

  /**
   * Get payment overview metrics
   */
  private async getPaymentOverviewMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    // Get current and previous period for comparison
    const periodDuration = dateRange.endDate.getTime() - dateRange.startDate.getTime()
    const previousStart = new Date(dateRange.startDate.getTime() - periodDuration)
    const previousEnd = new Date(dateRange.startDate.getTime() - 1)

    const [currentDelays, previousDelays] = await Promise.all([
      this.calculateAveragePaymentDelay(companyId, dateRange),
      this.calculateAveragePaymentDelay(companyId, { startDate: previousStart, endDate: previousEnd })
    ])

    const delayReduction = previousDelays > 0 ?
      ((previousDelays - currentDelays) / previousDelays) * 100 : 0

    return {
      currentDelay: currentDelays,
      previousDelay: previousDelays,
      delayReduction: Math.round(delayReduction * 100) / 100
    }
  }

  /**
   * Calculate average payment delay
   */
  private async calculateAveragePaymentDelay(companyId: string, dateRange: AnalyticsDateRange) {
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

    if (paidInvoices.length === 0) return 0

    const delays = paidInvoices
      .filter(invoice => invoice.payments.length > 0)
      .map(invoice => {
        const payment = invoice.payments[0]
        const delay = Math.ceil((payment.paymentDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        return Math.max(0, delay)
      })

    return delays.length > 0 ? delays.reduce((sum, delay) => sum + delay, 0) / delays.length : 0
  }

  /**
   * Get customer overview metrics
   */
  private async getCustomerOverviewMetrics(companyId: string) {
    const customers = await prisma.customers.findMany({
      where: {
        companyId,
        isActive: true
      },
      select: {
        riskScore: true,
        paymentBehavior: true
      }
    })

    // Calculate satisfaction score based on risk scores and payment behavior
    const riskScores = customers
      .filter(c => c.riskScore)
      .map(c => c.riskScore!.toNumber())

    const averageRiskScore = riskScores.length > 0 ?
      riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length : 5

    // Convert risk score (0-10) to satisfaction score (0-100), where lower risk = higher satisfaction
    const satisfactionScore = Math.max(0, 100 - (averageRiskScore * 10))

    return {
      satisfactionScore: Math.round(satisfactionScore)
    }
  }

  /**
   * Calculate collection efficiency
   */
  private async calculateCollectionEfficiency(companyId: string, dateRange: AnalyticsDateRange) {
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
          invoices: { companyId }
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
   * Get real-time metrics
   */
  private async getRealtimeMetrics(companyId: string) {
    const cacheKey = `realtime-${companyId}`
    const cached = this.getCachedData(cacheKey, this.REALTIME_TTL)

    if (cached) {
      return cached
    }

    const now = Date.now()
    const [
      activeUsers,
      processingTime,
      systemHealth,
      alertsCount
    ] = await Promise.all([
      this.getActiveUsersCount(companyId),
      this.calculateSystemProcessingTime(),
      this.calculateSystemHealth(companyId),
      this.getAlertsCount(companyId)
    ])

    const realtimeMetrics = {
      activeUsers,
      processingTime,
      systemHealth,
      alertsCount,
      dataFreshness: new Date()
    }

    this.setCachedData(cacheKey, realtimeMetrics, this.REALTIME_TTL)
    return realtimeMetrics
  }

  /**
   * Get active users count (simplified)
   */
  private async getActiveUsersCount(companyId: string): Promise<number> {
    // This would integrate with session management in a real application
    return prisma.users.count({
      where: { companyId }
    })
  }

  /**
   * Calculate system processing time
   */
  private async calculateSystemProcessingTime(): Promise<number> {
    // This would measure actual system response times
    // For now, return a simulated processing time
    return Math.round(Math.random() * 200) + 50 // 50-250ms
  }

  /**
   * Calculate system health score
   */
  private async calculateSystemHealth(companyId: string): Promise<number> {
    try {
      // Test database connectivity and performance
      const startTime = Date.now()
      await prisma.companies.findUnique({ where: { id: companyId } })
      const dbResponseTime = Date.now() - startTime

      // Calculate health score based on response time
      if (dbResponseTime < 100) return 100
      if (dbResponseTime < 500) return 90
      if (dbResponseTime < 1000) return 80
      if (dbResponseTime < 2000) return 70
      return 60

    } catch (error) {
      console.error('Health check error:', error)
      return 50 // Degraded performance
    }
  }

  /**
   * Get alerts count
   */
  private async getAlertsCount(companyId: string): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Count various types of alerts
    const [overdueInvoices, highRiskCustomers, failedEmails] = await Promise.all([
      prisma.invoices.count({
        where: {
          companyId,
          status: 'OVERDUE',
          updatedAt: { gte: today },
          isActive: true
        }
      }),
      prisma.customers.count({
        where: {
          companyId,
          riskScore: { gte: 8 },
          isActive: true
        }
      }),
      prisma.emailLog.count({
        where: {
          companyId,
          deliveryStatus: 'FAILED',
          createdAt: { gte: today }
        }
      })
    ])

    return overdueInvoices + highRiskCustomers + failedEmails
  }

  /**
   * Generate predictive analytics
   */
  private async generatePredictiveAnalytics(companyId: string, filters: AnalyticsFilters) {
    const [expectedPayments, riskAlerts, recommendations] = await Promise.all([
      this.predictExpectedPayments(companyId),
      this.generateRiskAlerts(companyId),
      this.generateSmartRecommendations(companyId, filters)
    ])

    return {
      expectedPayments,
      riskAlerts,
      recommendations
    }
  }

  /**
   * Predict expected payments
   */
  private async predictExpectedPayments(companyId: string) {
    const outstandingInvoices = await prisma.invoices.findMany({
      where: {
        companyId,
        status: { in: ['SENT', 'OVERDUE'] },
        isActive: true
      },
      include: {
        customers: {
          select: {
            paymentBehavior: true,
            riskScore: true
          }
        }
      }
    })

    const predictions = []
    const now = new Date()

    for (const invoice of outstandingInvoices) {
      const customer = invoice.customers
      const riskScore = customer.riskScore?.toNumber() || 5

      // Simple prediction model based on risk score
      const confidence = Math.max(10, 100 - (riskScore * 10))
      const daysToPayment = Math.round(7 + (riskScore * 2)) // 7-27 days based on risk

      const predictedDate = new Date(now.getTime() + daysToPayment * 24 * 60 * 60 * 1000)

      predictions.push({
        date: predictedDate.toISOString().split('T')[0],
        amount: invoice.totalAmount || new Decimal(0),
        confidence
      })
    }

    return predictions.slice(0, 10) // Return top 10 predictions
  }

  /**
   * Generate risk alerts
   */
  private async generateRiskAlerts(companyId: string) {
    const alerts = []

    // High-risk customers
    const highRiskCustomers = await prisma.customers.count({
      where: {
        companyId,
        riskScore: { gte: 8 },
        isActive: true
      }
    })

    if (highRiskCustomers > 0) {
      alerts.push({
        type: 'customer' as const,
        severity: 'high' as const,
        description: `${highRiskCustomers} customers at high risk of non-payment`,
        action: 'Review payment terms and implement proactive measures'
      })
    }

    // Overdue invoices
    const overdueInvoices = await prisma.invoices.count({
      where: {
        companyId,
        status: 'OVERDUE',
        isActive: true
      }
    })

    if (overdueInvoices > 10) {
      alerts.push({
        type: 'invoice' as const,
        severity: overdueInvoices > 50 ? 'critical' as const : 'medium' as const,
        description: `${overdueInvoices} invoices are overdue`,
        action: 'Activate intensive follow-up sequences'
      })
    }

    return alerts
  }

  /**
   * Generate smart recommendations
   */
  private async generateSmartRecommendations(companyId: string, filters: AnalyticsFilters) {
    const recommendations = []

    // Analyze payment patterns
    const avgDelay = await this.calculateAveragePaymentDelay(companyId, filters.dateRange)
    if (avgDelay > 15) {
      recommendations.push({
        category: 'payment_optimization',
        title: 'Reduce Payment Delays',
        description: `Average payment delay is ${Math.round(avgDelay)} days. Implement automated follow-ups to reach 25% reduction target.`,
        impact: 85,
        effort: 60
      })
    }

    // Check email performance
    const emailStats = await prisma.emailLog.aggregate({
      where: {
        companyId,
        createdAt: {
          gte: filters.dateRange.startDate,
          lte: filters.dateRange.endDate
        }
      },
      _count: { id: true }
    })

    const openedCount = await prisma.emailLog.count({
      where: {
        companyId,
        openedAt: { not: null },
        createdAt: {
          gte: filters.dateRange.startDate,
          lte: filters.dateRange.endDate
        }
      }
    })

    const openRate = emailStats._count.id > 0 ? (openedCount / emailStats._count.id) * 100 : 0

    if (openRate < 25) {
      recommendations.push({
        category: 'email_optimization',
        title: 'Improve Email Open Rates',
        description: `Email open rate is ${Math.round(openRate)}%. Optimize subject lines and send timing for UAE market.`,
        impact: 70,
        effort: 40
      })
    }

    return recommendations
  }

  /**
   * Process real-time analytics event
   */
  async processRealtimeEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Invalidate relevant caches
      this.invalidateCache(event.companyId, event.impact.cacheInvalidation)

      // Update real-time KPIs if needed
      if (event.impact.realtimeRefresh) {
        await this.updateRealtimeKPIs(event)
      }

      // Log event for debugging
      console.log(`Processed analytics event: ${event.eventType} for ${event.entityType}:${event.entityId}`)

    } catch (error) {
      console.error('Error processing real-time event:', error)
    }
  }

  /**
   * Update real-time KPIs
   */
  private async updateRealtimeKPIs(event: AnalyticsEvent): Promise<void> {
    const realtimeCacheKey = `realtime-${event.companyId}`
    this.invalidateCacheKey(realtimeCacheKey)

    // Force refresh of real-time metrics
    await this.getRealtimeMetrics(event.companyId)
  }

  /**
   * Cache management methods
   */
  private generateCacheKey(type: string, companyId: string, filters: AnalyticsFilters): string {
    const filterHash = JSON.stringify({
      dateRange: filters.dateRange,
      customerIds: filters.customerIds?.sort(),
      invoiceStatus: filters.invoiceStatus?.sort(),
      businessTypes: filters.businessTypes?.sort()
    })

    return `${type}-${companyId}-${Buffer.from(filterHash).toString('base64').slice(0, 16)}`
  }

  private getCachedData(key: string, ttl?: number): any {
    const cached = this.cache[key]
    if (!cached) return null

    const effectiveTtl = ttl || this.CACHE_TTL
    if (Date.now() - cached.timestamp.getTime() > effectiveTtl) {
      delete this.cache[key]
      return null
    }

    return cached.data
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.cache[key] = {
      data,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + ttl)
    }
  }

  private invalidateCache(companyId: string, patterns: string[]): void {
    patterns.forEach(pattern => {
      Object.keys(this.cache).forEach(key => {
        if (key.includes(companyId) && key.includes(pattern)) {
          delete this.cache[key]
        }
      })
    })
  }

  private invalidateCacheKey(key: string): void {
    delete this.cache[key]
  }

  /**
   * Utility methods
   */
  private transformEmailAnalytics(emailAnalytics: any): any {
    // Transform email analytics to match expected format
    return {
      campaignMetrics: {
        totalCampaigns: 1, // Simplified
        emailsSent: emailAnalytics.summary.totalSent,
        deliveryRate: emailAnalytics.summary.deliveryRate,
        openRate: emailAnalytics.summary.openRate,
        clickRate: emailAnalytics.summary.clickRate,
        responseRate: 0, // Would be calculated from actual data
        conversionRate: 0 // Would be calculated from payment conversions
      },
      sequencePerformance: [],
      templateAnalytics: emailAnalytics.templateAnalytics.map((template: any) => ({
        templateId: template.templateId,
        templateName: template.templateName,
        templateType: 'follow_up',
        usage: template.sentCount,
        performance: {
          openRate: template.openRate,
          clickRate: template.clickRate,
          responseRate: template.responseRate,
          conversionToPayment: 0
        },
        languageEffectiveness: {
          english: { openRate: 0, conversionRate: 0 },
          arabic: { openRate: 0, conversionRate: 0 }
        }
      })),
      abTestResults: []
    }
  }

  private calculateTotalRecords(recordCounts: number[]): number {
    return recordCounts.reduce((sum, count) => sum + count, 0)
  }

  private combineIndexesUsed(indexArrays: string[][]): string[] {
    const allIndexes = new Set<string>()
    indexArrays.forEach(indexes => {
      indexes.forEach(index => allIndexes.add(index))
    })
    return Array.from(allIndexes)
  }

  private consolidateRecommendations(recommendationArrays: any[][]): any[] {
    const allRecommendations = []
    recommendationArrays.forEach(recommendations => {
      allRecommendations.push(...recommendations)
    })

    // Remove duplicates based on message similarity
    const unique = allRecommendations.filter((recommendation, index, array) =>
      index === array.findIndex(r => r.message === recommendation.message)
    )

    return unique.slice(0, 10) // Return top 10 recommendations
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): void {
    const now = new Date()
    Object.keys(this.cache).forEach(key => {
      if (this.cache[key].expiresAt < now) {
        delete this.cache[key]
      }
    })
  }
}

// Export singleton instance
export const kpiCalculationEngine = new KPICalculationEngine()

// Setup periodic cache cleanup
setInterval(() => {
  kpiCalculationEngine.cleanupCache()
}, 5 * 60 * 1000) // Cleanup every 5 minutes