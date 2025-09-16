/**
 * KPI Calculation Engine Tests
 * Comprehensive test suite for the analytics calculation engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { kpiCalculationEngine } from '@/lib/services/kpi-calculation-engine'
import { prismaMock } from '../setup/prisma-mock'
import { createMockCompany, createMockAnalyticsFilters } from '../setup/analytics-fixtures'

// Mock all the analytics services
vi.mock('@/lib/services/payment-analytics-service', () => ({
  paymentAnalyticsService: {
    getPaymentPerformance: vi.fn()
  }
}))

vi.mock('@/lib/services/invoice-analytics-service', () => ({
  invoiceAnalyticsService: {
    getInvoiceStatusAnalytics: vi.fn()
  }
}))

vi.mock('@/lib/services/customer-analytics-service', () => ({
  customerAnalyticsService: {
    getCustomerInsights: vi.fn()
  }
}))

vi.mock('@/lib/services/email-analytics-service', () => ({
  emailAnalyticsService: {
    getEmailAnalytics: vi.fn()
  }
}))

vi.mock('@/lib/services/uae-business-intelligence-service', () => ({
  uaeBusinessIntelligenceService: {
    getUAEBusinessIntelligence: vi.fn()
  }
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}))

import { paymentAnalyticsService } from '@/lib/services/payment-analytics-service'
import { invoiceAnalyticsService } from '@/lib/services/invoice-analytics-service'
import { customerAnalyticsService } from '@/lib/services/customer-analytics-service'
import { emailAnalyticsService } from '@/lib/services/email-analytics-service'
import { uaeBusinessIntelligenceService } from '@/lib/services/uae-business-intelligence-service'

describe('KPICalculationEngine', () => {
  const mockCompanyId = 'company-123'
  const mockFilters = createMockAnalyticsFilters()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock responses for all services
    vi.mocked(paymentAnalyticsService.getPaymentPerformance).mockResolvedValue({
      data: {
        averagePaymentDelay: 10,
        paymentDelayReduction: 15,
        daysOutstanding: { current: 35, previous: 40, improvement: 12.5 },
        onTimePayments: { count: 80, percentage: 80, trend: 5 },
        overduePayments: { count: 20, totalAmount: new Decimal(50000), averageDaysOverdue: 15, trend: -10 },
        collectionRate: { current: 85, target: 25, progress: 60 },
        paymentTrends: []
      },
      metadata: {
        queryTime: 150,
        recordsProcessed: 100,
        cacheHit: false,
        freshness: new Date(),
        filters: mockFilters,
        performance: {
          queryOptimization: 'test',
          indexesUsed: ['test_index'],
          executionPlan: 'test_plan'
        }
      }
    })

    vi.mocked(invoiceAnalyticsService.getInvoiceStatusAnalytics).mockResolvedValue({
      data: {
        statusDistribution: {
          draft: { count: 5, amount: new Decimal(10000) },
          sent: { count: 30, amount: new Decimal(150000) },
          overdue: { count: 20, amount: new Decimal(75000) },
          paid: { count: 80, amount: new Decimal(400000) },
          disputed: { count: 2, amount: new Decimal(5000) },
          writtenOff: { count: 1, amount: new Decimal(2000) }
        },
        agingBuckets: {
          current: { count: 25, amount: new Decimal(100000) },
          overdue30: { count: 15, amount: new Decimal(50000) },
          overdue60: { count: 8, amount: new Decimal(30000) },
          overdue90: { count: 5, amount: new Decimal(20000) }
        },
        processingMetrics: {
          averageProcessingTime: 12,
          averagePaymentTime: 25,
          conversionRates: {
            sentToPaid: 75,
            overdueToDisputed: 5,
            overdueToWrittenOff: 2
          }
        },
        realtimeUpdates: {
          newInvoices: 3,
          paymentsReceived: 7,
          overdueAlerts: 2
        }
      },
      metadata: {
        queryTime: 120,
        recordsProcessed: 138,
        cacheHit: false,
        freshness: new Date(),
        filters: mockFilters,
        performance: {
          queryOptimization: 'test',
          indexesUsed: ['test_index'],
          executionPlan: 'test_plan'
        }
      }
    })

    vi.mocked(customerAnalyticsService.getCustomerInsights).mockResolvedValue({
      data: {
        paymentBehaviorSegments: {
          excellent: { count: 20, criteria: 'Pays early', avgPaymentDays: 3 },
          good: { count: 40, criteria: 'Pays on time', avgPaymentDays: 8 },
          average: { count: 25, criteria: 'Sometimes late', avgPaymentDays: 18 },
          poor: { count: 15, criteria: 'Frequently late', avgPaymentDays: 35 }
        },
        riskDistribution: {
          low: { count: 60, percentage: 60, totalOutstanding: new Decimal(100000) },
          medium: { count: 25, percentage: 25, totalOutstanding: new Decimal(75000) },
          high: { count: 12, percentage: 12, totalOutstanding: new Decimal(50000) },
          critical: { count: 3, percentage: 3, totalOutstanding: new Decimal(25000) }
        },
        customerValueMetrics: {
          averageLTV: new Decimal(15000),
          topCustomers: [],
          churnRisk: { highRisk: 5, mediumRisk: 15, lowRisk: 80 }
        },
        paymentPatterns: {
          preferredMethods: { BANK_TRANSFER: 70, CREDIT_CARD: 25, OTHER: 5 },
          paymentTiming: { early: 20, onTime: 50, late: 30 },
          seasonalTrends: []
        }
      },
      metadata: {
        queryTime: 180,
        recordsProcessed: 100,
        cacheHit: false,
        freshness: new Date(),
        filters: mockFilters,
        performance: {
          queryOptimization: 'test',
          indexesUsed: ['test_index'],
          executionPlan: 'test_plan'
        }
      }
    })

    vi.mocked(emailAnalyticsService.getEmailAnalytics).mockResolvedValue({
      summary: {
        totalSent: 1000,
        delivered: 950,
        opened: 300,
        clicked: 75,
        bounced: 30,
        complained: 5,
        unsubscribed: 10,
        deliveryRate: 95,
        openRate: 31.6,
        clickRate: 25,
        bounceRate: 3,
        complaintRate: 0.5
      },
      timeAnalytics: {
        dailyStats: [],
        hourlyStats: [],
        dayOfWeekStats: []
      },
      templateAnalytics: [],
      languageAnalytics: {
        english: { sent: 700, openRate: 30, clickRate: 20 },
        arabic: { sent: 300, openRate: 35, clickRate: 30 }
      },
      deviceAnalytics: {
        mobile: 600,
        desktop: 350,
        tablet: 50,
        unknown: 0
      },
      geographicAnalytics: {
        uaeEmails: 800,
        internationalEmails: 200,
        topCities: []
      }
    })

    vi.mocked(uaeBusinessIntelligenceService.getUAEBusinessIntelligence).mockResolvedValue({
      data: {
        culturalCompliance: {
          overallScore: 85,
          businessHoursRespect: { score: 90, violationsCount: 5, improvements: [] },
          prayerTimeAvoidance: { score: 88, respectfulTiming: 95, adjustmentsMade: 25 },
          ramadanAdjustments: { score: 92, adaptedCommunications: 80, culturalSensitivity: 90 },
          languageEffectiveness: { arabicUsage: 30, englishUsage: 70, bilingualEffectiveness: 85 }
        },
        marketInsights: {
          businessTypeDistribution: { LLC: 60, FREE_ZONE: 25, SOLE_PROPRIETORSHIP: 15 },
          geographicDistribution: { Dubai: 40, 'Abu Dhabi': 25, Sharjah: 15 },
          industryPerformance: [],
          trnComplianceRate: 92,
          vatCalculationAccuracy: 98
        },
        economicImpact: {
          currencyStability: 98.5,
          businessConfidence: 82,
          seasonalImpacts: {
            ramadan: { impact: 15, adjustments: [] },
            summer: { impact: 10, adjustments: [] },
            yearEnd: { impact: 20, adjustments: [] }
          }
        }
      },
      metadata: {
        queryTime: 200,
        recordsProcessed: 200,
        cacheHit: false,
        freshness: new Date(),
        filters: mockFilters,
        performance: {
          queryOptimization: 'test',
          indexesUsed: ['test_index'],
          executionPlan: 'test_plan'
        }
      }
    })

    // Mock prisma queries for overview KPIs
    prismaMock.invoice.aggregate.mockResolvedValue({
      _count: { id: 138 },
      _sum: { totalAmount: new Decimal(642000) }
    })

    prismaMock.users.count.mockResolvedValue(5)
    prismaMock.company.findUnique.mockResolvedValue(createMockCompany())
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getDashboardAnalytics', () => {
    it('should return comprehensive dashboard analytics', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.metadata).toBeDefined()

      // Check all main sections are present
      expect(result.data.overview).toBeDefined()
      expect(result.data.paymentPerformance).toBeDefined()
      expect(result.data.invoiceStatus).toBeDefined()
      expect(result.data.customerInsights).toBeDefined()
      expect(result.data.emailCampaigns).toBeDefined()
      expect(result.data.uaeIntelligence).toBeDefined()
      expect(result.data.realtimeMetrics).toBeDefined()
      expect(result.data.predictions).toBeDefined()
    })

    it('should meet performance target (<200ms)', async () => {
      const startTime = Date.now()
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      const executionTime = Date.now() - startTime

      expect(executionTime).toBeLessThan(200)
      expect(result.metadata.queryTime).toBeLessThan(200)
    })

    it('should calculate overview KPIs correctly', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.data.overview.totalInvoices).toBe(138)
      expect(result.data.overview.totalAmount).toEqual(new Decimal(642000))
      expect(result.data.overview.paymentDelayReduction).toBe(15)
      expect(result.data.overview.collectionEfficiency).toBeGreaterThanOrEqual(0)
      expect(result.data.overview.customerSatisfaction).toBeGreaterThanOrEqual(0)
    })

    it('should include real-time metrics', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.data.realtimeMetrics).toBeDefined()
      expect(result.data.realtimeMetrics.activeUsers).toBe(5)
      expect(result.data.realtimeMetrics.processingTime).toBeGreaterThan(0)
      expect(result.data.realtimeMetrics.systemHealth).toBeGreaterThanOrEqual(0)
      expect(result.data.realtimeMetrics.systemHealth).toBeLessThanOrEqual(100)
      expect(result.data.realtimeMetrics.dataFreshness).toBeInstanceOf(Date)
    })

    it('should generate predictive analytics', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.data.predictions).toBeDefined()
      expect(result.data.predictions.expectedPayments).toBeDefined()
      expect(result.data.predictions.riskAlerts).toBeDefined()
      expect(result.data.predictions.recommendations).toBeDefined()

      expect(Array.isArray(result.data.predictions.expectedPayments)).toBe(true)
      expect(Array.isArray(result.data.predictions.riskAlerts)).toBe(true)
      expect(Array.isArray(result.data.predictions.recommendations)).toBe(true)
    })

    it('should consolidate recommendations from all services', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)

      // Should have recommendations based on mock data performance issues
      const hasRecommendations = (result.recommendations?.length || 0) > 0
      expect(hasRecommendations).toBe(true)
    })

    it('should include performance metadata', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.metadata.performance).toBeDefined()
      expect(result.metadata.performance.queryOptimization).toBeDefined()
      expect(result.metadata.performance.indexesUsed).toBeDefined()
      expect(result.metadata.performance.executionPlan).toBeDefined()

      expect(Array.isArray(result.metadata.performance.indexesUsed)).toBe(true)
      expect(result.metadata.recordsProcessed).toBeGreaterThan(0)
    })
  })

  describe('Real-time Event Processing', () => {
    it('should process real-time analytics events', async () => {
      const mockEvent = {
        id: 'event-123',
        timestamp: new Date(),
        eventType: 'payment_received' as const,
        companyId: mockCompanyId,
        entityId: 'payment-123',
        entityType: 'payment',
        metadata: { amount: 1000 },
        impact: {
          kpiUpdates: ['payment_performance', 'collection_rate'],
          realtimeRefresh: true,
          cacheInvalidation: ['dashboard', 'payments']
        }
      }

      // Should not throw an error
      await expect(
        kpiCalculationEngine.processRealtimeEvent(mockEvent)
      ).resolves.toBeUndefined()
    })

    it('should handle event processing errors gracefully', async () => {
      const invalidEvent = {
        id: 'event-456',
        timestamp: new Date(),
        eventType: 'invalid_event' as any,
        companyId: mockCompanyId,
        entityId: 'test-123',
        entityType: 'test',
        metadata: {},
        impact: {
          kpiUpdates: [],
          realtimeRefresh: false,
          cacheInvalidation: []
        }
      }

      // Should handle gracefully without throwing
      await expect(
        kpiCalculationEngine.processRealtimeEvent(invalidEvent)
      ).resolves.toBeUndefined()
    })
  })

  describe('Caching Behavior', () => {
    it('should cache results for subsequent requests', async () => {
      // First request
      const result1 = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      expect(result1.metadata.cacheHit).toBe(false)

      // Second request should hit cache
      const result2 = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      expect(result2.metadata.cacheHit).toBe(true)
    })

    it('should invalidate cache correctly', async () => {
      // Initial request
      await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      // Process event that invalidates cache
      const event = {
        id: 'event-789',
        timestamp: new Date(),
        eventType: 'invoice_created' as const,
        companyId: mockCompanyId,
        entityId: 'invoice-123',
        entityType: 'invoice',
        metadata: {},
        impact: {
          kpiUpdates: ['invoice_status'],
          realtimeRefresh: true,
          cacheInvalidation: ['dashboard']
        }
      }

      await kpiCalculationEngine.processRealtimeEvent(event)

      // Next request should not hit cache
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      expect(result.metadata.cacheHit).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle service failures gracefully', async () => {
      // Make one service fail
      vi.mocked(paymentAnalyticsService.getPaymentPerformance).mockRejectedValue(
        new Error('Payment service unavailable')
      )

      await expect(
        kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      ).rejects.toThrow('Failed to calculate comprehensive dashboard analytics')
    })

    it('should handle partial service failures in batch processing', async () => {
      // Simulate partial failure scenario
      vi.mocked(emailAnalyticsService.getEmailAnalytics).mockRejectedValue(
        new Error('Email service temporarily unavailable')
      )

      await expect(
        kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      ).rejects.toThrow('Failed to calculate comprehensive dashboard analytics')
    })
  })

  describe('Data Consistency', () => {
    it('should maintain data consistency across all KPIs', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      // Check data consistency
      expect(result.data.overview.totalInvoices).toBeGreaterThanOrEqual(0)
      expect(result.data.paymentPerformance.collectionRate.current).toBeGreaterThanOrEqual(0)
      expect(result.data.paymentPerformance.collectionRate.current).toBeLessThanOrEqual(100)

      // Check that percentages are valid
      expect(result.data.customerInsights.riskDistribution.low.percentage).toBeGreaterThanOrEqual(0)
      expect(result.data.customerInsights.riskDistribution.low.percentage).toBeLessThanOrEqual(100)
    })

    it('should validate financial data precision', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      // Check Decimal precision for financial amounts
      expect(result.data.overview.totalAmount).toBeInstanceOf(Decimal)
      expect(result.data.overview.totalOutstanding).toBeInstanceOf(Decimal)

      // Ensure no negative values where not appropriate
      expect(result.data.overview.totalAmount.gte(0)).toBe(true)
      expect(result.data.overview.totalOutstanding.gte(0)).toBe(true)
    })
  })

  describe('UAE-Specific Features', () => {
    it('should include UAE cultural compliance metrics', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.data.uaeIntelligence.culturalCompliance).toBeDefined()
      expect(result.data.uaeIntelligence.culturalCompliance.overallScore).toBe(85)
      expect(result.data.uaeIntelligence.culturalCompliance.businessHoursRespect.score).toBe(90)
    })

    it('should include UAE market insights', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.data.uaeIntelligence.marketInsights).toBeDefined()
      expect(result.data.uaeIntelligence.marketInsights.trnComplianceRate).toBe(92)
      expect(result.data.uaeIntelligence.marketInsights.vatCalculationAccuracy).toBe(98)
    })

    it('should track 25% payment delay reduction target', async () => {
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      expect(result.data.paymentPerformance.collectionRate.target).toBe(25)
      expect(result.data.paymentPerformance.collectionRate.progress).toBeGreaterThanOrEqual(0)
      expect(result.data.paymentPerformance.collectionRate.progress).toBeLessThanOrEqual(100)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should maintain sub-200ms response time with large datasets', async () => {
      // Mock larger dataset
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 10000 },
        _sum: { totalAmount: new Decimal(5000000) }
      })

      const startTime = Date.now()
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)
      const executionTime = Date.now() - startTime

      expect(executionTime).toBeLessThan(200)
      expect(result.metadata.recordsProcessed).toBeGreaterThan(1000)
    })

    it('should efficiently process parallel analytics calculations', async () => {
      const startTime = Date.now()

      // All service calls should be parallel, not sequential
      const result = await kpiCalculationEngine.getDashboardAnalytics(mockCompanyId, mockFilters)

      const executionTime = Date.now() - startTime

      // Should be much faster than sequential execution (which would be 5 * 150ms = 750ms+)
      expect(executionTime).toBeLessThan(300)
      expect(result.metadata.performance.queryOptimization).toContain('Parallel execution')
    })
  })
})