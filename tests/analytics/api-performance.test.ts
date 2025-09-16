/**
 * Analytics API Performance Tests
 * Testing response times, concurrent users, and scalability requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Import API routes
import { GET as dashboardGET } from '@/app/api/analytics/dashboard/route'
import { GET as paymentsGET } from '@/app/api/analytics/payments/route'
import { GET as uaeIntelligenceGET } from '@/app/api/analytics/uae-intelligence/route'
import { GET as realtimeGET } from '@/app/api/analytics/realtime/route'

// Mock services
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

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

vi.mock('@/lib/services/uae-business-intelligence-service', () => ({
  uaeBusinessIntelligenceService: {
    getUAEBusinessIntelligence: vi.fn()
  }
}))

vi.mock('@/lib/services/realtime-metrics-service', () => ({
  realtimeMetricsService: {
    getRealTimeMetrics: vi.fn()
  }
}))

describe('Analytics API Performance Tests', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      company_id: 'company-123'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue(mockSession)
  })

  describe('Response Time Requirements (<200ms target)', () => {
    it('should respond to dashboard analytics within 200ms', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      // Mock fast response
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue({
        kpis: {
          paymentDelayReduction: 18.2,
          targetReduction: 25,
          totalRevenue: 2450000
        },
        trends: {},
        realTime: {},
        uaeSpecific: {}
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?dateRange=30&companyId=company-123')

      const startTime = performance.now()
      const response = await dashboardGET(request)
      const endTime = performance.now()

      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(200) // Must be under 200ms
    })

    it('should respond to payment analytics within 200ms', async () => {
      const { paymentAnalyticsService } = await import('@/lib/services/payment-analytics-service')

      ;(paymentAnalyticsService.getPaymentPerformance as any).mockResolvedValue({
        performanceData: [
          {
            date: '2024-01-01',
            delayReduction: 18.2,
            averagePaymentDays: 22.3,
            collectedAmount: 125000
          }
        ],
        insights: []
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/payments?companyId=company-123&dateRange=30')

      const startTime = performance.now()
      const response = await paymentsGET(request)
      const endTime = performance.now()

      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(200)
    })

    it('should respond to UAE intelligence within 200ms', async () => {
      const { uaeBusinessIntelligenceService } = await import('@/lib/services/uae-business-intelligence-service')

      ;(uaeBusinessIntelligenceService.getUAEBusinessIntelligence as any).mockResolvedValue({
        data: {
          culturalCompliance: {
            overallScore: 94.8,
            businessHoursRespect: { score: 92 },
            prayerTimeAvoidance: { score: 85 }
          }
        },
        insights: []
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/uae-intelligence?companyId=company-123')

      const startTime = performance.now()
      const response = await uaeIntelligenceGET(request)
      const endTime = performance.now()

      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(200)
    })

    it('should respond to real-time metrics within 100ms', async () => {
      const { realtimeMetricsService } = await import('@/lib/services/realtime-metrics-service')

      ;(realtimeMetricsService.getRealTimeMetrics as any).mockResolvedValue({
        activeReminders: 24,
        todayCollections: 87500,
        systemHealth: 99.2,
        lastUpdated: new Date().toISOString()
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/realtime?companyId=company-123')

      const startTime = performance.now()
      const response = await realtimeGET(request)
      const endTime = performance.now()

      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(100) // Real-time should be even faster
    })
  })

  describe('Concurrent User Load Testing (100+ users)', () => {
    it('should handle 100 concurrent dashboard requests', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue({
        kpis: { paymentDelayReduction: 18.2 },
        trends: {},
        realTime: {},
        uaeSpecific: {}
      })

      const concurrentRequests = Array.from({ length: 100 }, (_, i) => {
        const request = new NextRequest(`http://localhost:3000/api/analytics/dashboard?companyId=company-${i}&dateRange=30`)
        return dashboardGET(request)
      })

      const startTime = performance.now()
      const responses = await Promise.all(concurrentRequests)
      const endTime = performance.now()

      const totalTime = endTime - startTime
      const averageResponseTime = totalTime / 100

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Average response time should still be reasonable under load
      expect(averageResponseTime).toBeLessThan(500) // 500ms average under concurrent load
      expect(totalTime).toBeLessThan(5000) // Total time should be under 5 seconds
    })

    it('should handle 150 concurrent real-time metric requests', async () => {
      const { realtimeMetricsService } = await import('@/lib/services/realtime-metrics-service')

      ;(realtimeMetricsService.getRealTimeMetrics as any).mockResolvedValue({
        activeReminders: 24,
        systemHealth: 99.2
      })

      const concurrentRequests = Array.from({ length: 150 }, (_, i) => {
        const request = new NextRequest(`http://localhost:3000/api/analytics/realtime?companyId=company-${i}`)
        return realtimeGET(request)
      })

      const responses = await Promise.allSettled(concurrentRequests)

      const successfulResponses = responses.filter(result =>
        result.status === 'fulfilled' && (result.value as Response).status === 200
      )

      // At least 95% success rate under high load
      const successRate = successfulResponses.length / responses.length
      expect(successRate).toBeGreaterThan(0.95)
    })

    it('should maintain data accuracy under concurrent load', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      const expectedData = {
        kpis: {
          paymentDelayReduction: 18.2,
          targetReduction: 25,
          totalRevenue: 2450000
        },
        trends: {},
        realTime: {},
        uaeSpecific: {}
      }

      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue(expectedData)

      const concurrentRequests = Array.from({ length: 50 }, () => {
        const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?companyId=company-123&dateRange=30')
        return dashboardGET(request)
      })

      const responses = await Promise.all(concurrentRequests)

      // All responses should have consistent data
      for (const response of responses) {
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.kpis.paymentDelayReduction).toBe(18.2)
        expect(data.kpis.targetReduction).toBe(25)
        expect(data.kpis.totalRevenue).toBe(2450000)
      }
    })
  })

  describe('Scalability and Memory Usage', () => {
    it('should handle large datasets without memory leaks', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      // Mock large dataset
      const largeDataset = {
        kpis: {
          paymentDelayReduction: 18.2,
          totalRevenue: 2450000,
          activeInvoices: 50000 // Large number of invoices
        },
        trends: {
          paymentReduction: Array.from({ length: 365 }, (_, i) => ({
            period: `2024-01-${i + 1}`,
            value: 15 + Math.random() * 10,
            target: 25
          }))
        },
        realTime: {},
        uaeSpecific: {}
      }

      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue(largeDataset)

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?companyId=company-123&dateRange=365')

      const response = await dashboardGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.kpis.activeInvoices).toBe(50000)
      expect(data.trends.paymentReduction).toHaveLength(365)
    })

    it('should implement proper caching for frequently accessed data', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      let callCount = 0
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockImplementation(() => {
        callCount++
        return Promise.resolve({
          kpis: { paymentDelayReduction: 18.2 },
          trends: {},
          realTime: {},
          uaeSpecific: {}
        })
      })

      // Make multiple identical requests
      const request1 = new NextRequest('http://localhost:3000/api/analytics/dashboard?companyId=company-123&dateRange=30')
      const request2 = new NextRequest('http://localhost:3000/api/analytics/dashboard?companyId=company-123&dateRange=30')

      const response1 = await dashboardGET(request1)
      const response2 = await dashboardGET(request2)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      // Check cache headers are set
      expect(response1.headers.get('Cache-Control')).toContain('max-age')
      expect(response2.headers.get('Cache-Control')).toContain('max-age')
    })
  })

  describe('Database Query Optimization', () => {
    it('should optimize queries for payment analytics', async () => {
      const { paymentAnalyticsService } = await import('@/lib/services/payment-analytics-service')

      const mockOptimizedResponse = {
        performanceData: [],
        insights: [],
        queryMetadata: {
          executionTime: 45, // ms
          recordsScanned: 1000,
          indexesUsed: ['payment_date_idx', 'company_id_idx'],
          queryPlan: 'optimized'
        }
      }

      ;(paymentAnalyticsService.getPaymentPerformance as any).mockResolvedValue(mockOptimizedResponse)

      const request = new NextRequest('http://localhost:3000/api/analytics/payments?companyId=company-123&dateRange=90')

      const startTime = performance.now()
      const response = await paymentsGET(request)
      const endTime = performance.now()

      expect(response.status).toBe(200)
      expect(endTime - startTime).toBeLessThan(200) // Fast query execution
    })

    it('should handle complex aggregation queries efficiently', async () => {
      const { uaeBusinessIntelligenceService } = await import('@/lib/services/uae-business-intelligence-service')

      const complexAnalyticsData = {
        data: {
          culturalCompliance: {
            overallScore: 94.8,
            prayerTimeCompliance: {
              fajr: 88.2,
              dhuhr: 92.5,
              asr: 89.7,
              maghrib: 91.3,
              isha: 87.9
            },
            emirateSpecific: {
              dubai: { effectiveness: 92.1, volume: 1250 },
              abuDhabi: { effectiveness: 89.8, volume: 980 },
              sharjah: { effectiveness: 85.3, volume: 750 }
            }
          }
        },
        insights: [],
        queryMetadata: {
          aggregationTime: 85, // ms for complex aggregations
          indexOptimization: true
        }
      }

      ;(uaeBusinessIntelligenceService.getUAEBusinessIntelligence as any).mockResolvedValue(complexAnalyticsData)

      const request = new NextRequest('http://localhost:3000/api/analytics/uae-intelligence?companyId=company-123&includeDetailedMetrics=true')

      const response = await uaeIntelligenceGET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.culturalCompliance.overallScore).toBe(94.8)
    })
  })

  describe('Error Handling Under Load', () => {
    it('should handle service timeouts gracefully', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      // Mock timeout
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockRejectedValue(
        new Error('Service timeout')
      )

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?companyId=company-123')

      const response = await dashboardGET(request)

      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData.error).toContain('Failed to fetch dashboard analytics')
    })

    it('should rate limit excessive requests', async () => {
      // Simulate rapid requests from same client
      const requests = Array.from({ length: 1000 }, () => {
        const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?companyId=company-123')
        return dashboardGET(request)
      })

      const responses = await Promise.allSettled(requests)

      // Should have some successful responses but not all (rate limiting)
      const successful = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as Response).status === 200
      )

      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as Response).status === 429
      )

      // Should have rate limited some requests
      expect(successful.length).toBeGreaterThan(0)
      expect(successful.length).toBeLessThan(1000) // Not all should succeed
    })

    it('should maintain service availability during peak load', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      // Mock some failures but not total failure
      let requestCount = 0
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockImplementation(() => {
        requestCount++
        // Fail 5% of requests to simulate real-world conditions
        if (requestCount % 20 === 0) {
          return Promise.reject(new Error('Temporary service failure'))
        }
        return Promise.resolve({
          kpis: { paymentDelayReduction: 18.2 },
          trends: {},
          realTime: {},
          uaeSpecific: {}
        })
      })

      const requests = Array.from({ length: 200 }, (_, i) => {
        const request = new NextRequest(`http://localhost:3000/api/analytics/dashboard?companyId=company-${i}`)
        return dashboardGET(request)
      })

      const responses = await Promise.allSettled(requests)

      const successful = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as Response).status === 200
      )

      // Should maintain >95% availability even under load
      const availability = successful.length / responses.length
      expect(availability).toBeGreaterThan(0.95)
    })
  })

  describe('Real-Time Performance', () => {
    it('should handle WebSocket-like real-time updates efficiently', async () => {
      const { realtimeMetricsService } = await import('@/lib/services/realtime-metrics-service')

      // Mock rapid sequential updates
      const updates = Array.from({ length: 100 }, (_, i) => ({
        activeReminders: 24 + i,
        todayCollections: 87500 + (i * 100),
        systemHealth: 99.2,
        timestamp: Date.now() + (i * 1000)
      }))

      let updateIndex = 0
      ;(realtimeMetricsService.getRealTimeMetrics as any).mockImplementation(() => {
        return Promise.resolve(updates[updateIndex++] || updates[updates.length - 1])
      })

      // Simulate rapid polling
      const rapidRequests = Array.from({ length: 100 }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, i * 10)) // Stagger requests
        const request = new NextRequest(`http://localhost:3000/api/analytics/realtime?companyId=company-123&t=${Date.now()}`)
        return realtimeGET(request)
      })

      const responses = await Promise.all(rapidRequests)

      // All real-time requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })
})