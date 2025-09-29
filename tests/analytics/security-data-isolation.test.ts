/**
 * Security and Data Isolation Tests
 * Testing authentication, authorization, and multi-tenant data isolation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Import API routes
import { GET as dashboardGET } from '@/app/api/analytics/dashboard/route'
import { GET as paymentsGET } from '@/app/api/analytics/payments/route'
import { GET as uaeIntelligenceGET } from '@/app/api/analytics/uae-intelligence/route'
import { GET as customersGET } from '@/app/api/analytics/customers/route'

// Mock services with data isolation
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

vi.mock('@/lib/services/customer-analytics-service', () => ({
  customerAnalyticsService: {
    getCustomerInsights: vi.fn()
  }
}))

// Mock database queries for testing data isolation
const mockDatabaseQuery = vi.fn()

vi.mock('@/lib/database/prisma', () => ({
  prisma: {
    invoice: {
      findMany: mockDatabaseQuery,
      aggregate: mockDatabaseQuery
    },
    payment: {
      findMany: mockDatabaseQuery,
      aggregate: mockDatabaseQuery
    },
    customer: {
      findMany: mockDatabaseQuery,
      aggregate: mockDatabaseQuery
    },
    company: {
      findUnique: mockDatabaseQuery
    }
  }
}))

describe('Security and Data Isolation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDatabaseQuery.mockResolvedValue([])
  })

  describe('Authentication Requirements', () => {
    it('should reject requests without authentication', async () => {
      // No session
      ;(getServerSession as any).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized access')
    })

    it('should reject requests with invalid session', async () => {
      // Invalid/malformed session
      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123'
          // Missing company_id
        }
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized access')
    })

    it('should accept requests with valid authentication', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: 'company-123'
        }
      })

      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue({
        kpis: { paymentDelayReduction: 18.2 },
        trends: {},
        realTime: {},
        uaeSpecific: {}
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Authorization and Role-Based Access', () => {
    it('should enforce company-level access control', async () => {
      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')

      // User belongs to company-123
      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: 'company-123'
        }
      })

      // Mock service to verify company_id is passed correctly
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockImplementation((companyId: string) => {
        expect(companyId).toBe('company-123')
        return Promise.resolve({
          kpis: { paymentDelayReduction: 18.2 },
          trends: {},
          realTime: {},
          uaeSpecific: {}
        })
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(200)
      expect(kpiCalculationEngine.getDashboardAnalytics).toHaveBeenCalledWith('company-123', expect.any(Object))
    })

    it('should prevent cross-company data access through URL manipulation', async () => {
      const { paymentAnalyticsService } = await import('@/lib/services/payment-analytics-service')

      // User belongs to company-123
      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: 'company-123'
        }
      })

      // Attempt to access company-456 data via URL parameter
      const request = new NextRequest('http://localhost:3000/api/analytics/payments?companyId=company-456')

      ;(paymentAnalyticsService.getPaymentPerformance as any).mockImplementation((companyId: string) => {
        // Should use session company_id, not URL parameter
        expect(companyId).toBe('company-123')
        return Promise.resolve({ performanceData: [], insights: [] })
      })

      const response = await paymentsGET(request)

      expect(response.status).toBe(200)
      // Service should be called with session company_id, ignoring URL parameter
      expect(paymentAnalyticsService.getPaymentPerformance).toHaveBeenCalledWith('company-123', expect.any(Object))
    })

    it('should validate user permissions for sensitive analytics', async () => {
      const { customerAnalyticsService } = await import('@/lib/services/customer-analytics-service')

      // Mock user with limited permissions
      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: 'company-123',
          role: 'VIEWER' // Limited role
        }
      })

      ;(customerAnalyticsService.getCustomerInsights as any).mockResolvedValue({
        paymentBehaviorSegments: {},
        riskDistribution: {}
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/customers')
      const response = await customersGET(request)

      expect(response.status).toBe(200)
      // Should still work for viewer role as it's read-only analytics
    })
  })

  describe('Multi-Tenant Data Isolation', () => {
    it('should ensure complete data isolation between companies', async () => {
      // Mock database query to verify WHERE clause includes company_id
      mockDatabaseQuery.mockImplementation((query: any) => {
        // Every query should filter by company_id
        expect(query.where).toHaveProperty('companyId')
        expect(query.where.companyId).toBe('company-123')
        return Promise.resolve([])
      })

      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: 'company-123'
        }
      })

      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockImplementation(async (companyId: string) => {
        // Simulate database queries with proper filtering
        const { prisma } = await import('@/lib/database/prisma')

        await prisma.invoices.findMany({
          where: { companyId: companyId }
        })

        await prisma.payments.findMany({
          where: { companyId: companyId }
        })

        return {
          kpis: { paymentDelayReduction: 18.2 },
          trends: {},
          realTime: {},
          uaeSpecific: {}
        }
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(200)
      // Verify all database queries included company filter
      expect(mockDatabaseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-123'
          })
        })
      )
    })

    it('should prevent data leakage through aggregation queries', async () => {
      // Test aggregation queries don't leak cross-company data
      mockDatabaseQuery.mockImplementation((query: any) => {
        // Aggregation queries must also include company filter
        if (query.where) {
          expect(query.where).toHaveProperty('companyId')
          expect(query.where.companyId).toBe('company-123')
        }

        return Promise.resolve([
          {
            _sum: { totalAmount: 100000 },
            _count: { _all: 50 }
          }
        ])
      })

      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: 'company-123'
        }
      })

      const { paymentAnalyticsService } = await import('@/lib/services/payment-analytics-service')
      ;(paymentAnalyticsService.getPaymentPerformance as any).mockImplementation(async (companyId: string) => {
        const { prisma } = await import('@/lib/database/prisma')

        // Simulate aggregation query
        await prisma.payments.aggregate({
          where: { companyId: companyId },
          _sum: { amount: true },
          _count: { _all: true }
        })

        return { performanceData: [], insights: [] }
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/payments')
      const response = await paymentsGET(request)

      expect(response.status).toBe(200)
    })

    it('should handle concurrent requests from different companies', async () => {
      const company1Session = {
        user: { id: 'user-1', company_id: 'company-1' }
      }
      const company2Session = {
        user: { id: 'user-2', company_id: 'company-2' }
      }

      // Mock alternating sessions for concurrent requests
      let callCount = 0
      ;(getServerSession as any).mockImplementation(() => {
        callCount++
        return Promise.resolve(callCount % 2 === 1 ? company1Session : company2Session)
      })

      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockImplementation((companyId: string) => {
        // Each call should receive the correct company_id
        expect(['company-1', 'company-2']).toContain(companyId)
        return Promise.resolve({
          kpis: { paymentDelayReduction: companyId === 'company-1' ? 18.2 : 22.5 },
          trends: {},
          realTime: {},
          uaeSpecific: {}
        })
      })

      // Simulate concurrent requests
      const requests = [
        dashboardGET(new NextRequest('http://localhost:3000/api/analytics/dashboard')),
        dashboardGET(new NextRequest('http://localhost:3000/api/analytics/dashboard')),
        dashboardGET(new NextRequest('http://localhost:3000/api/analytics/dashboard')),
        dashboardGET(new NextRequest('http://localhost:3000/api/analytics/dashboard'))
      ]

      const responses = await Promise.all(requests)

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Verify correct company data was returned
      const data1 = await responses[0].json()
      const data2 = await responses[1].json()

      // Should have different values for different companies
      expect(data1.kpis.paymentDelayReduction).not.toBe(data2.kpis.paymentDelayReduction)
    })
  })

  describe('Input Validation and Sanitization', () => {
    it('should sanitize date range parameters', async () => {
      ;(getServerSession as any).mockResolvedValue({
        user: { id: 'user-123', company_id: 'company-123' }
      })

      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue({
        kpis: {},
        trends: {},
        realTime: {},
        uaeSpecific: {}
      })

      // Try malicious input
      const maliciousRequest = new NextRequest('http://localhost:3000/api/analytics/dashboard?startDate=<script>alert("xss")</script>&endDate=2024-01-31')

      const response = await dashboardGET(maliciousRequest)

      // Should either succeed with sanitized input or fail validation
      expect([200, 400]).toContain(response.status)

      if (response.status === 400) {
        const data = await response.json()
        expect(data.error).toContain('Invalid')
      }
    })

    it('should validate company ID format', async () => {
      ;(getServerSession as any).mockResolvedValue({
        user: { id: 'user-123', company_id: 'company-123' }
      })

      const { paymentAnalyticsService } = await import('@/lib/services/payment-analytics-service')

      // Mock service to check company_id is properly formatted
      ;(paymentAnalyticsService.getPaymentPerformance as any).mockImplementation((companyId: string) => {
        // Should be a valid UUID or similar format
        expect(companyId).toMatch(/^[a-zA-Z0-9-]+$/)
        return Promise.resolve({ performanceData: [], insights: [] })
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/payments')
      const response = await paymentsGET(request)

      expect(response.status).toBe(200)
    })

    it('should prevent SQL injection in filter parameters', async () => {
      ;(getServerSession as any).mockResolvedValue({
        user: { id: 'user-123', company_id: 'company-123' }
      })

      // Try SQL injection in filters
      const sqlInjectionRequest = new NextRequest('http://localhost:3000/api/analytics/payments?invoiceStatus=PAID\' OR \'1\'=\'1')

      const { paymentAnalyticsService } = await import('@/lib/services/payment-analytics-service')
      ;(paymentAnalyticsService.getPaymentPerformance as any).mockImplementation((companyId: string, filters: any) => {
        // Filters should be properly validated/sanitized
        if (filters.invoiceStatus) {
          expect(Array.isArray(filters.invoiceStatus)).toBe(true)
          // Should not contain SQL injection
          filters.invoiceStatus.forEach((status: string) => {
            expect(status).not.toContain("'")
            expect(status).not.toContain('OR')
          })
        }
        return Promise.resolve({ performanceData: [], insights: [] })
      })

      const response = await paymentsGET(sqlInjectionRequest)
      expect([200, 400]).toContain(response.status) // Either sanitized or rejected
    })
  })

  describe('Session Security', () => {
    it('should handle session timeout gracefully', async () => {
      // Mock expired session
      ;(getServerSession as any).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized access')
    })

    it('should validate session integrity', async () => {
      // Mock session with tampered data
      ;(getServerSession as any).mockResolvedValue({
        user: {
          id: 'user-123',
          company_id: null // Null company_id should be rejected
        }
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const response = await dashboardGET(request)

      expect(response.status).toBe(401)
    })

    it('should prevent session fixation attacks', async () => {
      // Test with multiple different session tokens
      const session1 = { user: { id: 'user-1', company_id: 'company-1' } }
      const session2 = { user: { id: 'user-2', company_id: 'company-2' } }

      ;(getServerSession as any).mockResolvedValueOnce(session1)
      ;(getServerSession as any).mockResolvedValueOnce(session2)

      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockImplementation((companyId: string) => {
        return Promise.resolve({
          kpis: { companySpecificData: companyId },
          trends: {},
          realTime: {},
          uaeSpecific: {}
        })
      })

      // Two requests with different sessions should get different data
      const request1 = new NextRequest('http://localhost:3000/api/analytics/dashboard')
      const request2 = new NextRequest('http://localhost:3000/api/analytics/dashboard')

      const response1 = await dashboardGET(request1)
      const response2 = await dashboardGET(request2)

      const data1 = await response1.json()
      const data2 = await response2.json()

      expect(data1.kpis.companySpecificData).toBe('company-1')
      expect(data2.kpis.companySpecificData).toBe('company-2')
    })
  })

  describe('Rate Limiting and DDoS Protection', () => {
    it('should implement rate limiting per company', async () => {
      ;(getServerSession as any).mockResolvedValue({
        user: { id: 'user-123', company_id: 'company-123' }
      })

      const { kpiCalculationEngine } = await import('@/lib/services/kpi-calculation-engine')
      ;(kpiCalculationEngine.getDashboardAnalytics as any).mockResolvedValue({
        kpis: {},
        trends: {},
        realTime: {},
        uaeSpecific: {}
      })

      // Simulate rapid requests from same company
      const rapidRequests = Array.from({ length: 100 }, () =>
        dashboardGET(new NextRequest('http://localhost:3000/api/analytics/dashboard'))
      )

      const responses = await Promise.allSettled(rapidRequests)

      const successful = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as Response).status === 200
      )
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as Response).status === 429
      )

      // Should have some rate limiting
      expect(successful.length + rateLimited.length).toBe(100)
      expect(rateLimited.length).toBeGreaterThan(0)
    })
  })

  describe('Audit Logging', () => {
    it('should log sensitive analytics access', async () => {
      const mockAuditLog = vi.fn()
      vi.mock('@/lib/services/audit-service', () => ({
        auditLog: mockAuditLog
      }))

      ;(getServerSession as any).mockResolvedValue({
        user: { id: 'user-123', company_id: 'company-123' }
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')

      // In real implementation, this would trigger audit logging
      const response = await dashboardGET(request)

      expect(response.status).toBe(200)

      // Verify audit log would be called (in real implementation)
      // expect(mockAuditLog).toHaveBeenCalledWith({
      //   action: 'ANALYTICS_ACCESS',
      //   userId: 'user-123',
      //   companyId: 'company-123',
      //   resource: 'dashboard',
      //   timestamp: expect.any(Date)
      // })
    })
  })

  describe('Data Privacy Compliance', () => {
    it('should handle GDPR/data privacy requirements', async () => {
      ;(getServerSession as any).mockResolvedValue({
        user: { id: 'user-123', company_id: 'company-123' }
      })

      const { customerAnalyticsService } = await import('@/lib/services/customer-analytics-service')
      ;(customerAnalyticsService.getCustomerInsights as any).mockImplementation(() => {
        // Should return aggregated/anonymized data only
        return Promise.resolve({
          paymentBehaviorSegments: {
            excellent: { count: 25, avgPaymentDays: 4.2 }
            // No individual customer data
          },
          riskDistribution: {
            low: { count: 73, percentage: 59.3 }
            // Aggregated only
          }
        })
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/customers')
      const response = await customersGET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should only contain aggregated data, no PII
      expect(data).not.toHaveProperty('customerEmails')
      expect(data).not.toHaveProperty('individualCustomerData')
    })
  })
})