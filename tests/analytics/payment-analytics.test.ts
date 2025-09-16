/**
 * Payment Analytics Service Tests
 * Comprehensive test suite for payment performance analytics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { paymentAnalyticsService } from '@/lib/services/payment-analytics-service'
import { prismaMock } from '../setup/prisma-mock'
import { createMockCompany, createMockInvoice, createMockPayment, createMockCustomer } from '../setup/analytics-fixtures'

// Mock the prisma import
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}))

describe('PaymentAnalyticsService', () => {
  const mockCompanyId = 'company-123'
  const mockFilters = {
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getPaymentPerformance', () => {
    it('should calculate payment performance metrics correctly', async () => {
      // Setup mock data
      const mockInvoices = [
        createMockInvoice({
          id: '1',
          status: 'PAID',
          totalAmount: new Decimal(1000),
          dueDate: new Date('2024-01-15'),
          payments: [createMockPayment({ paymentDate: new Date('2024-01-10') })]
        }),
        createMockInvoice({
          id: '2',
          status: 'PAID',
          totalAmount: new Decimal(2000),
          dueDate: new Date('2024-01-20'),
          payments: [createMockPayment({ paymentDate: new Date('2024-01-25') })]
        }),
        createMockInvoice({
          id: '3',
          status: 'OVERDUE',
          totalAmount: new Decimal(1500),
          dueDate: new Date('2024-01-10')
        })
      ]

      // Mock aggregate queries
      prismaMock.invoice.aggregate.mockResolvedValueOnce({
        _count: { id: 3 },
        _sum: { totalAmount: new Decimal(4500) }
      })

      prismaMock.invoice.count
        .mockResolvedValueOnce(2) // PAID invoices
        .mockResolvedValueOnce(1) // OVERDUE invoices
        .mockResolvedValueOnce(2) // delivered emails
        .mockResolvedValueOnce(1) // opened emails
        .mockResolvedValueOnce(1) // clicked emails
        .mockResolvedValueOnce(0) // bounced emails
        .mockResolvedValueOnce(0) // complained emails
        .mockResolvedValueOnce(0) // unsubscribed emails

      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices)

      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(3000) }
      })

      // Execute test
      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      // Assertions
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata.queryTime).toBeGreaterThan(0)
      expect(result.data.averagePaymentDelay).toBeGreaterThanOrEqual(0)
      expect(result.data.collectionRate.current).toBeGreaterThanOrEqual(0)
      expect(result.data.collectionRate.target).toBe(25)
    })

    it('should handle empty data gracefully', async () => {
      // Mock empty results
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalAmount: null }
      })

      prismaMock.invoice.count.mockResolvedValue(0)
      prismaMock.invoice.findMany.mockResolvedValue([])
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: null }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      expect(result.data.averagePaymentDelay).toBe(0)
      expect(result.data.onTimePayments.count).toBe(0)
      expect(result.data.overduePayments.count).toBe(0)
    })

    it('should calculate payment delay reduction correctly', async () => {
      // Mock current period data
      prismaMock.invoice.aggregate
        .mockResolvedValueOnce({ _count: { id: 2 }, _sum: { totalAmount: new Decimal(3000) } })
        .mockResolvedValueOnce({ _count: { id: 1 }, _sum: { totalAmount: new Decimal(1500) } }) // Previous period

      prismaMock.invoice.count.mockResolvedValue(1)

      const mockCurrentPeriodInvoices = [
        createMockInvoice({
          status: 'PAID',
          dueDate: new Date('2024-01-15'),
          payments: [createMockPayment({ paymentDate: new Date('2024-01-17') })] // 2 days delay
        })
      ]

      const mockPreviousPeriodInvoices = [
        createMockInvoice({
          status: 'PAID',
          dueDate: new Date('2023-12-15'),
          payments: [createMockPayment({ paymentDate: new Date('2023-12-20') })] // 5 days delay
        })
      ]

      prismaMock.invoice.findMany
        .mockResolvedValueOnce(mockCurrentPeriodInvoices)
        .mockResolvedValueOnce(mockPreviousPeriodInvoices)

      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(3000) }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      // Should show improvement (reduction in delay)
      expect(result.data.paymentDelayReduction).toBeGreaterThan(0)
    })

    it('should include payment trends data', async () => {
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalAmount: new Decimal(1000) }
      })

      prismaMock.invoice.count.mockResolvedValue(1)
      prismaMock.invoice.findMany.mockResolvedValue([
        createMockInvoice({
          status: 'PAID',
          payments: [createMockPayment()]
        })
      ])

      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(1000) }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      expect(result.data.paymentTrends).toBeDefined()
      expect(Array.isArray(result.data.paymentTrends)).toBe(true)
    })
  })

  describe('UAE Business Days Calculation', () => {
    it('should calculate UAE business days correctly', async () => {
      const mockInvoice = createMockInvoice({
        status: 'PAID',
        dueDate: new Date('2024-01-15'), // Monday
        payments: [createMockPayment({ paymentDate: new Date('2024-01-17') })] // Wednesday
      })

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalAmount: new Decimal(1000) }
      })

      prismaMock.invoice.count.mockResolvedValue(1)
      prismaMock.invoice.findMany.mockResolvedValue([mockInvoice])

      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(1000) }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      // Should calculate business days correctly (2 UAE business days delay)
      expect(result.data.averagePaymentDelay).toBe(2)
    })

    it('should exclude UAE weekends from business day calculations', async () => {
      const mockInvoice = createMockInvoice({
        status: 'PAID',
        dueDate: new Date('2024-01-18'), // Thursday
        payments: [createMockPayment({ paymentDate: new Date('2024-01-21') })] // Sunday
      })

      prismaMock.invoice.findMany.mockResolvedValue([mockInvoice])
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalAmount: new Decimal(1000) }
      })
      prismaMock.invoice.count.mockResolvedValue(1)
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(1000) }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      // Should only count Friday and Sunday as 1 business day (excluding Fri-Sat weekend)
      expect(result.data.averagePaymentDelay).toBe(1)
    })
  })

  describe('Performance Optimization', () => {
    it('should complete within performance target (<200ms)', async () => {
      const startTime = Date.now()

      // Mock minimal data for fast execution
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalAmount: null }
      })
      prismaMock.invoice.count.mockResolvedValue(0)
      prismaMock.invoice.findMany.mockResolvedValue([])
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: null }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      const executionTime = Date.now() - startTime
      expect(executionTime).toBeLessThan(200) // Target: <200ms
      expect(result.metadata.queryTime).toBeLessThan(200)
    })

    it('should use appropriate database indexes', async () => {
      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalAmount: null }
      })
      prismaMock.invoice.count.mockResolvedValue(0)
      prismaMock.invoice.findMany.mockResolvedValue([])
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: null }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      expect(result.metadata.performance.indexesUsed).toContain('company_id_status_created_at')
      expect(result.metadata.performance.indexesUsed).toContain('company_id_payment_date')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prismaMock.invoice.aggregate.mockRejectedValue(new Error('Database connection failed'))

      await expect(
        paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)
      ).rejects.toThrow('Failed to calculate payment performance metrics')
    })

    it('should handle invalid date ranges', async () => {
      const invalidFilters = {
        dateRange: {
          startDate: new Date('2024-01-31'),
          endDate: new Date('2024-01-01') // End before start
        }
      }

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalAmount: null }
      })
      prismaMock.invoice.count.mockResolvedValue(0)
      prismaMock.invoice.findMany.mockResolvedValue([])
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: null }
      })

      // Should handle gracefully without throwing
      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, invalidFilters)
      expect(result).toBeDefined()
    })
  })

  describe('Data Validation', () => {
    it('should validate decimal precision for financial calculations', async () => {
      const mockInvoices = [
        createMockInvoice({
          totalAmount: new Decimal('1000.999'), // Should be rounded appropriately
          status: 'PAID',
          payments: [createMockPayment({ amount: new Decimal('1000.99') })]
        })
      ]

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalAmount: new Decimal('1000.999') }
      })
      prismaMock.invoice.count.mockResolvedValue(1)
      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices)
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('1000.99') }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      // Financial calculations should maintain precision
      expect(result.data.collectionRate.current).toBeLessThanOrEqual(100)
      expect(result.data.collectionRate.current).toBeGreaterThanOrEqual(0)
    })

    it('should handle null and undefined values in payment data', async () => {
      const mockInvoices = [
        createMockInvoice({
          totalAmount: null as any,
          status: 'DRAFT',
          payments: []
        })
      ]

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 1 },
        _sum: { totalAmount: null }
      })
      prismaMock.invoice.count.mockResolvedValue(0)
      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices)
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: null }
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      expect(result.data.averagePaymentDelay).toBe(0)
      expect(result.data.collectionRate.current).toBe(0)
    })
  })

  describe('Recommendations Generation', () => {
    it('should generate appropriate recommendations for poor performance', async () => {
      // Mock data indicating poor performance
      const mockInvoices = Array.from({ length: 10 }, (_, i) =>
        createMockInvoice({
          id: `invoice-${i}`,
          status: 'PAID',
          dueDate: new Date('2024-01-15'),
          payments: [createMockPayment({
            paymentDate: new Date('2024-02-01') // 17 days delay
          })]
        })
      )

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 10 },
        _sum: { totalAmount: new Decimal(10000) }
      })
      prismaMock.invoice.count.mockResolvedValue(10)
      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices)
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(5000) } // 50% collection rate
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      expect(result.recommendations).toBeDefined()
      expect(result.recommendations?.length).toBeGreaterThan(0)
      expect(result.recommendations?.some(r => r.message.includes('payment delay'))).toBe(true)
    })

    it('should provide minimal recommendations for good performance', async () => {
      // Mock data indicating good performance
      const mockInvoices = Array.from({ length: 5 }, (_, i) =>
        createMockInvoice({
          id: `invoice-${i}`,
          status: 'PAID',
          dueDate: new Date('2024-01-15'),
          payments: [createMockPayment({
            paymentDate: new Date('2024-01-14') // 1 day early
          })]
        })
      )

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: { id: 5 },
        _sum: { totalAmount: new Decimal(5000) }
      })
      prismaMock.invoice.count.mockResolvedValue(5)
      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices)
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(4800) } // 96% collection rate
      })

      const result = await paymentAnalyticsService.getPaymentPerformance(mockCompanyId, mockFilters)

      // Good performance should have fewer recommendations
      expect(result.recommendations?.length || 0).toBeLessThan(2)
    })
  })
})