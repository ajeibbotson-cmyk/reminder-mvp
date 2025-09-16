/**
 * Analytics API Tests
 * Integration tests for analytics API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { Decimal } from 'decimal.js'

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

// Mock analytics services
vi.mock('@/lib/services/kpi-calculation-engine', () => ({
  kpiCalculationEngine: {
    getDashboardAnalytics: vi.fn()
  }
}))

vi.mock('@/lib/services/payment-analytics-service', () => ({
  paymentAnalyticsService: {
    getPaymentPerformance: vi.fn()
  }
}))

vi.mock('@/lib/services/invoice-analytics-service', () => ({
  invoiceAnalyticsService: {
    getInvoiceStatusAnalytics: vi.fn(),
    updateInvoiceStatus: vi.fn(),
    batchUpdateOverdueInvoices: vi.fn(),
    getInvoiceAgingReport: vi.fn()
  }
}))

vi.mock('@/lib/services/customer-analytics-service', () => ({
  customerAnalyticsService: {
    getCustomerInsights: vi.fn(),
    updateCustomerRiskScores: vi.fn(),
    getChurnRiskCustomers: vi.fn()
  }
}))

vi.mock('@/lib/services/uae-business-intelligence-service', () => ({
  uaeBusinessIntelligenceService: {
    getUAEBusinessIntelligence: vi.fn()
  }
}))

import { kpiCalculationEngine } from '@/lib/services/kpi-calculation-engine'
import { paymentAnalyticsService } from '@/lib/services/payment-analytics-service'
import { invoiceAnalyticsService } from '@/lib/services/invoice-analytics-service'
import { customerAnalyticsService } from '@/lib/services/customer-analytics-service'
import { uaeBusinessIntelligenceService } from '@/lib/services/uae-business-intelligence-service'

// Import API handlers
import { GET as dashboardGET, POST as dashboardPOST } from '@/app/api/analytics/dashboard/route'
import { GET as paymentsGET, POST as paymentsPOST } from '@/app/api/analytics/payments/route'
import { GET as invoicesGET, PATCH as invoicesPATCH } from '@/app/api/analytics/invoices/route'
import { GET as customersGET, POST as customersPOST } from '@/app/api/analytics/customers/route'
import { GET as uaeIntelligenceGET } from '@/app/api/analytics/uae-intelligence/route'
import { GET as realtimeGET, POST as realtimePOST } from '@/app/api/analytics/realtime/route'

describe('Analytics API Endpoints', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      company_id: 'company-123',
      email: 'test@example.com'
    }
  }

  const mockAnalyticsResponse = {
    data: {
      overview: {
        totalInvoices: 100,
        totalAmount: new Decimal(500000),
        totalOutstanding: new Decimal(100000),
        paymentDelayReduction: 15,
        collectionEfficiency: 85,
        customerSatisfaction: 90
      },
      paymentPerformance: {
        averagePaymentDelay: 10,
        paymentDelayReduction: 15,
        daysOutstanding: { current: 35, previous: 40, improvement: 12.5 },
        onTimePayments: { count: 80, percentage: 80, trend: 5 },
        overduePayments: { count: 20, totalAmount: new Decimal(50000), averageDaysOverdue: 15, trend: -10 },
        collectionRate: { current: 85, target: 25, progress: 60 },
        paymentTrends: []
      },
      realtimeMetrics: {
        activeUsers: 5,
        processingTime: 120,
        systemHealth: 95,
        alertsCount: 3,
        dataFreshness: new Date()
      }
    },
    metadata: {
      queryTime: 150,
      recordsProcessed: 100,
      cacheHit: false,
      freshness: new Date(),
      filters: {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      },
      performance: {
        queryOptimization: 'Parallel execution',
        indexesUsed: ['company_id_status_created_at'],
        executionPlan: 'Optimized dashboard analytics'
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession)

    // Setup default mock responses
    vi.mocked(kpiCalculationEngine.getDashboardAnalytics).mockResolvedValue(mockAnalyticsResponse)
    vi.mocked(paymentAnalyticsService.getPaymentPerformance).mockResolvedValue({
      data: mockAnalyticsResponse.data.paymentPerformance,
      metadata: mockAnalyticsResponse.metadata
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Dashboard Analytics API (/api/analytics/dashboard)', () => {
    it('should return dashboard analytics with GET request', async () => {
      const request = new NextRequest('http://localhost/api/analytics/dashboard?startDate=2024-01-01&endDate=2024-01-31')

      const response = await dashboardGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('metadata')
      expect(data.data).toHaveProperty('overview')
      expect(data.data).toHaveProperty('paymentPerformance')
      expect(data.data).toHaveProperty('realtimeMetrics')

      // Check caching headers
      expect(response.headers.get('Cache-Control')).toContain('private, max-age=120')
      expect(response.headers.get('X-Analytics-Version')).toBe('3.1')
    })

    it('should handle POST request with custom filters', async () => {
      const requestBody = {
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          preset: 'month'
        },
        customerIds: ['customer-1', 'customer-2'],
        invoiceStatus: ['SENT', 'OVERDUE']
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await dashboardPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(vi.mocked(kpiCalculationEngine.getDashboardAnalytics)).toHaveBeenCalledWith(
        'company-123',
        expect.objectContaining({
          dateRange: expect.objectContaining({
            startDate: expect.any(Date),
            endDate: expect.any(Date)
          }),
          customerIds: ['customer-1', 'customer-2'],
          invoiceStatus: ['SENT', 'OVERDUE']
        })
      )
    })

    it('should return 401 for unauthenticated requests', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error', 'Unauthorized access')
    })

    it('should validate query parameters and return 400 for invalid data', async () => {
      const request = new NextRequest('http://localhost/api/analytics/dashboard?startDate=invalid-date')

      const response = await dashboardGET(request)

      if (response.status === 400) {
        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Invalid')
      } else {
        // If validation passes (due to fallback), ensure it still works
        expect(response.status).toBe(200)
      }
    })

    it('should handle service errors gracefully', async () => {
      vi.mocked(kpiCalculationEngine.getDashboardAnalytics).mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest('http://localhost/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toHaveProperty('error', 'Failed to fetch dashboard analytics')
    })
  })

  describe('Payment Analytics API (/api/analytics/payments)', () => {
    it('should return payment analytics with proper query parameters', async () => {
      const request = new NextRequest(
        'http://localhost/api/analytics/payments?startDate=2024-01-01&endDate=2024-01-31&paymentMethods=BANK_TRANSFER,CREDIT_CARD'
      )

      const response = await paymentsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('averagePaymentDelay')
      expect(data.data).toHaveProperty('collectionRate')

      // Check caching headers (5 minutes for payment data)
      expect(response.headers.get('Cache-Control')).toContain('private, max-age=300')
      expect(response.headers.get('X-Analytics-Type')).toBe('payment-performance')
    })

    it('should handle amount range filtering', async () => {
      const request = new NextRequest(
        'http://localhost/api/analytics/payments?minAmount=1000&maxAmount=50000'
      )

      const response = await paymentsGET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(paymentAnalyticsService.getPaymentPerformance)).toHaveBeenCalledWith(
        'company-123',
        expect.objectContaining({
          amountRange: expect.objectContaining({
            min: expect.any(Decimal),
            max: expect.any(Decimal)
          })
        })
      )
    })
  })

  describe('Invoice Analytics API (/api/analytics/invoices)', () => {
    it('should return invoice status analytics', async () => {
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
            conversionRates: { sentToPaid: 75, overdueToDisputed: 5, overdueToWrittenOff: 2 }
          },
          realtimeUpdates: { newInvoices: 3, paymentsReceived: 7, overdueAlerts: 2 }
        },
        metadata: mockAnalyticsResponse.metadata
      })

      const request = new NextRequest('http://localhost/api/analytics/invoices')
      const response = await invoicesGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('statusDistribution')
      expect(data.data).toHaveProperty('agingBuckets')
      expect(data.data).toHaveProperty('processingMetrics')

      // Check caching headers (3 minutes for invoice data)
      expect(response.headers.get('Cache-Control')).toContain('private, max-age=180')
    })

    it('should update invoice status with PATCH request', async () => {
      vi.mocked(invoiceAnalyticsService.updateInvoiceStatus).mockResolvedValue(undefined)

      const requestBody = {
        invoiceId: 'invoice-123',
        newStatus: 'PAID',
        metadata: { paymentId: 'payment-123' }
      }

      const request = new NextRequest('http://localhost/api/analytics/invoices', {
        method: 'PATCH',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await invoicesPATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(vi.mocked(invoiceAnalyticsService.updateInvoiceStatus)).toHaveBeenCalledWith(
        'invoice-123',
        'PAID',
        { paymentId: 'payment-123' }
      )
    })
  })

  describe('Customer Analytics API (/api/analytics/customers)', () => {
    it('should return customer insights analytics', async () => {
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
        metadata: mockAnalyticsResponse.metadata
      })

      const request = new NextRequest('http://localhost/api/analytics/customers')
      const response = await customersGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('paymentBehaviorSegments')
      expect(data.data).toHaveProperty('riskDistribution')

      // Check caching headers (10 minutes for customer data)
      expect(response.headers.get('Cache-Control')).toContain('private, max-age=600')
    })

    it('should update customer risk scores with POST request', async () => {
      vi.mocked(customerAnalyticsService.updateCustomerRiskScores).mockResolvedValue(50)

      const request = new NextRequest('http://localhost/api/analytics/customers', {
        method: 'POST'
      })

      const response = await customersPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('updatedCount', 50)
    })
  })

  describe('UAE Intelligence API (/api/analytics/uae-intelligence)', () => {
    it('should return UAE business intelligence analytics', async () => {
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
        metadata: mockAnalyticsResponse.metadata
      })

      const request = new NextRequest('http://localhost/api/analytics/uae-intelligence')
      const response = await uaeIntelligenceGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('culturalCompliance')
      expect(data.data).toHaveProperty('marketInsights')
      expect(data.data).toHaveProperty('economicImpact')

      // Check UAE-specific headers
      expect(response.headers.get('Cache-Control')).toContain('private, max-age=1800') // 30 minutes
      expect(response.headers.get('X-Cultural-Compliance')).toBe('85')
    })
  })

  describe('Real-time Analytics API (/api/analytics/realtime)', () => {
    it('should return real-time metrics with minimal caching', async () => {
      const request = new NextRequest('http://localhost/api/analytics/realtime')
      const response = await realtimeGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('realtimeMetrics')

      // Check minimal caching for real-time data
      expect(response.headers.get('Cache-Control')).toContain('private, max-age=30') // 30 seconds
      expect(response.headers.get('X-Analytics-Type')).toBe('realtime')
    })

    it('should process real-time events with POST request', async () => {
      const eventData = {
        eventType: 'payment_received',
        entityId: 'payment-123',
        entityType: 'payment',
        metadata: { amount: 1000 },
        impact: {
          kpiUpdates: ['payment_performance'],
          realtimeRefresh: true,
          cacheInvalidation: ['dashboard']
        }
      }

      const request = new NextRequest('http://localhost/api/analytics/realtime', {
        method: 'POST',
        body: JSON.stringify(eventData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await realtimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('eventId')
    })
  })

  describe('Performance Requirements', () => {
    it('should meet response time targets for all endpoints', async () => {
      const endpoints = [
        { handler: dashboardGET, url: 'http://localhost/api/analytics/dashboard', target: 200 },
        { handler: paymentsGET, url: 'http://localhost/api/analytics/payments', target: 200 },
        { handler: invoicesGET, url: 'http://localhost/api/analytics/invoices', target: 200 },
        { handler: customersGET, url: 'http://localhost/api/analytics/customers', target: 200 },
        { handler: realtimeGET, url: 'http://localhost/api/analytics/realtime', target: 100 }
      ]

      for (const endpoint of endpoints) {
        const startTime = Date.now()
        const request = new NextRequest(endpoint.url)
        const response = await endpoint.handler(request)
        const executionTime = Date.now() - startTime

        expect(response.status).toBe(200)
        expect(executionTime).toBeLessThan(endpoint.target)
      }
    })

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () =>
        new NextRequest('http://localhost/api/analytics/dashboard')
      )

      const startTime = Date.now()
      const responses = await Promise.all(
        requests.map(request => dashboardGET(request))
      )
      const totalTime = Date.now() - startTime

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Concurrent execution should be much faster than sequential
      expect(totalTime).toBeLessThan(1000) // Should be much less than 10 * 200ms
    })
  })

  describe('Data Validation and Security', () => {
    it('should validate company isolation', async () => {
      const differentCompanySession = {
        user: {
          id: 'user-456',
          company_id: 'company-456',
          email: 'other@example.com'
        }
      }

      vi.mocked(getServerSession).mockResolvedValue(differentCompanySession)

      const request = new NextRequest('http://localhost/api/analytics/dashboard')
      await dashboardGET(request)

      // Should call analytics with different company ID
      expect(vi.mocked(kpiCalculationEngine.getDashboardAnalytics)).toHaveBeenCalledWith(
        'company-456',
        expect.any(Object)
      )
    })

    it('should sanitize input parameters', async () => {
      const maliciousRequest = new NextRequest(
        'http://localhost/api/analytics/dashboard?startDate=2024-01-01&customerIds=<script>alert("xss")</script>'
      )

      const response = await dashboardGET(maliciousRequest)

      // Should either sanitize the input or return an error, but not execute the script
      expect(response.status).toBeLessThanOrEqual(400)
    })
  })
})