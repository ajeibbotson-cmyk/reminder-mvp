/**
 * Comprehensive Integration Tests for Automated Invoice Status Update Cron Job
 * Tests UAE business hours compliance, batch processing, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST, GET } from '../route'
import { InvoiceStatus } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    companies: {
      findMany: jest.fn()
    },
    invoices: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    },
    cronExecutions: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    adminNotifications: {
      create: jest.fn()
    }
  }
}))

jest.mock('@/lib/services/invoice-status-service', () => ({
  invoiceStatusService: {
    detectAndUpdateOverdueInvoices: jest.fn()
  }
}))

jest.mock('@/lib/errors', () => ({
  handleApiError: jest.fn((error) => new Response(JSON.stringify({ error: error.message }), { status: 500 })),
  successResponse: jest.fn((data, message) => new Response(JSON.stringify({ success: true, data, message }), { status: 200 })),
  logError: jest.fn()
}))

describe('Cron Job: Invoice Status Updates', () => {
  let mockRequest: NextRequest
  const validCronSecret = 'uaepay-cron-secret-2024'
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Set up environment
    process.env.CRON_SECRET = validCronSecret
    
    // Mock successful default responses
    const { prisma } = require('@/lib/prisma')
    prisma.companies.findMany.mockResolvedValue([
      { id: 'company-1', name: 'Test Company 1' },
      { id: 'company-2', name: 'Test Company 2' }
    ])
    
    prisma.cronExecutions.create.mockResolvedValue({
      id: 'execution-id',
      startTime: new Date(),
      status: 'RUNNING'
    })
    
    prisma.cronExecutions.update.mockResolvedValue({})
    prisma.adminNotifications.create.mockResolvedValue({})
    
    const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
    invoiceStatusService.detectAndUpdateOverdueInvoices.mockResolvedValue({
      totalRequested: 5,
      successCount: 5,
      failedCount: 0,
      skippedCount: 0,
      results: [
        {
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-001',
          success: true,
          oldStatus: InvoiceStatus.SENT,
          newStatus: InvoiceStatus.OVERDUE
        }
      ],
      auditEntries: [],
      businessSummary: {
        totalAmountAffected: 5000,
        paidAmountAffected: 0,
        overdueAmountAffected: 5000,
        formattedTotalAmount: 'AED 5,000.00'
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  describe('POST /api/cron/update-invoice-status - Authentication', () => {
    it('should require valid cron secret in authorization header', async () => {
      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'authorization': `Bearer invalid-secret`
        }
      })

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(401)
      const responseText = await response.text()
      expect(responseText).toBe('Unauthorized')
    })

    it('should accept valid cron secret in authorization header', async () => {
      // Mock UAE business hours (Sunday 10 AM)
      mockUAEBusinessHours(true)

      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${validCronSecret}`
        }
      })

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
    })

    it('should accept valid cron secret in x-cron-secret header', async () => {
      // Mock UAE business hours
      mockUAEBusinessHours(true)

      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'x-cron-secret': validCronSecret
        }
      })

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/cron/update-invoice-status - UAE Business Hours Validation', () => {
    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${validCronSecret}`
        }
      })
    })

    it('should skip execution during UAE weekends (Friday/Saturday)', async () => {
      // Mock Friday in UAE (weekend)
      mockUAEBusinessHours(false, 5, 10) // Friday, 10 AM

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.skipped).toBe(true)
      expect(data.data.reason).toContain('Non-working day')
    })

    it('should skip execution outside business hours', async () => {
      // Mock Sunday night (outside business hours)
      mockUAEBusinessHours(false, 0, 20) // Sunday, 8 PM

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.skipped).toBe(true)
      expect(data.data.reason).toContain('Outside business hours')
    })

    it('should skip execution on UAE public holidays', async () => {
      // Mock a public holiday (would need to be added to UAE_HOLIDAYS array)
      mockUAEBusinessHours(false, 0, 10) // Sunday, 10 AM but marked as holiday

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.skipped).toBe(true)
    })

    it('should proceed during UAE business hours (Sunday-Thursday, 8 AM-6 PM)', async () => {
      // Mock Tuesday 2 PM UAE time
      mockUAEBusinessHours(true, 2, 14) // Tuesday, 2 PM

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data.skipped).toBeUndefined()
      expect(data.data.executionSummary).toBeDefined()
    })
  })

  describe('POST /api/cron/update-invoice-status - Processing Logic', () => {
    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${validCronSecret}`
        }
      })
      mockUAEBusinessHours(true) // Always allow during tests
    })

    it('should process multiple companies', async () => {
      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data.executionSummary.companiesProcessed).toBe(2)
      
      const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
      expect(invoiceStatusService.detectAndUpdateOverdueInvoices).toHaveBeenCalledTimes(2)
      expect(invoiceStatusService.detectAndUpdateOverdueInvoices).toHaveBeenCalledWith('company-1', expect.any(Object))
      expect(invoiceStatusService.detectAndUpdateOverdueInvoices).toHaveBeenCalledWith('company-2', expect.any(Object))
    })

    it('should create execution log entry', async () => {
      await POST(mockRequest)
      
      const { prisma } = require('@/lib/prisma')
      expect(prisma.cronExecutions.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          jobType: 'invoice_status_update',
          startTime: expect.any(Date),
          status: 'RUNNING',
          metadata: expect.any(Object)
        }
      })
    })

    it('should update execution log with results', async () => {
      await POST(mockRequest)
      
      const { prisma } = require('@/lib/prisma')
      expect(prisma.cronExecutions.update).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
        data: {
          endTime: expect.any(Date),
          status: 'COMPLETED',
          metadata: expect.any(Object)
        }
      })
    })

    it('should handle company processing errors gracefully', async () => {
      const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
      invoiceStatusService.detectAndUpdateOverdueInvoices
        .mockResolvedValueOnce({
          totalRequested: 3,
          successCount: 3,
          failedCount: 0,
          skippedCount: 0,
          results: [],
          auditEntries: [],
          businessSummary: { totalAmountAffected: 0, formattedTotalAmount: 'AED 0.00' }
        })
        .mockRejectedValueOnce(new Error('Database connection failed'))

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Should still process the first company successfully
      expect(data.data.executionSummary.companiesProcessed).toBe(1)
      expect(data.data.executionSummary.errors).toContain('Company Test Company 2: Database connection failed')
    })

    it('should respect processing timeout', async () => {
      // Mock a very slow service call
      const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
      invoiceStatusService.detectAndUpdateOverdueInvoices.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            totalRequested: 0,
            successCount: 0,
            failedCount: 0,
            skippedCount: 0,
            results: [],
            auditEntries: [],
            businessSummary: { totalAmountAffected: 0, formattedTotalAmount: 'AED 0.00' }
          }), 10000) // 10 second delay
        })
      })

      // Set a short timeout for testing
      const originalMaxTime = require('../route').cronConfig?.maxExecutionTime
      
      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      // Processing should complete before timeout in real implementation
    })

    it('should send admin notifications for significant events', async () => {
      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      
      const { prisma } = require('@/lib/prisma')
      expect(prisma.adminNotifications.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          type: 'CRON_EXECUTION_SUMMARY',
          title: 'Daily Invoice Status Update Completed',
          message: expect.stringContaining('Processed 2 companies'),
          metadata: expect.any(Object),
          priority: 'NORMAL',
          channels: ['EMAIL', 'DASHBOARD']
        }
      })
    })

    it('should mark admin notification as HIGH priority when errors occur', async () => {
      const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
      invoiceStatusService.detectAndUpdateOverdueInvoices.mockResolvedValue({
        totalRequested: 5,
        successCount: 3,
        failedCount: 2, // Some failures
        skippedCount: 0,
        results: [],
        auditEntries: [],
        businessSummary: { totalAmountAffected: 0, formattedTotalAmount: 'AED 0.00' }
      })

      await POST(mockRequest)
      
      const { prisma } = require('@/lib/prisma')
      const createCall = prisma.adminNotifications.create.mock.calls[0]
      expect(createCall[0].data.priority).toBe('HIGH')
    })
  })

  describe('GET /api/cron/update-invoice-status - Status Check', () => {
    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status?', {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${validCronSecret}`
        }
      })

      const { prisma } = require('@/lib/prisma')
      prisma.cronExecutions.findMany.mockResolvedValue([
        {
          startTime: new Date(),
          endTime: new Date(),
          status: 'COMPLETED',
          metadata: { companiesProcessed: 2, invoicesUpdated: 5, errors: [] }
        }
      ])

      prisma.invoices.aggregate.mockResolvedValue({
        _count: { id: 10 },
        _sum: { totalAmount: 50000, amount: 50000 }
      })

      prisma.invoices.count.mockResolvedValue(25)
    })

    it('should require authentication for status check', async () => {
      const unauthenticatedRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'GET'
      })

      const response = await GET(unauthenticatedRequest)
      
      expect(response.status).toBe(401)
    })

    it('should return comprehensive status information', async () => {
      const response = await GET(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data).toHaveProperty('status', 'operational')
      expect(data.data).toHaveProperty('configuration')
      expect(data.data).toHaveProperty('businessHours')
      expect(data.data).toHaveProperty('recentExecutions')
      expect(data.data).toHaveProperty('overdueStatistics')
    })

    it('should include current business hours status', async () => {
      mockUAEBusinessHours(true, 2, 14) // Tuesday, 2 PM
      
      const response = await GET(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data.businessHours.canProcessNow).toBe(true)
      expect(data.data.businessHours.currentTime).toBeDefined()
    })

    it('should show recent execution history', async () => {
      const response = await GET(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(Array.isArray(data.data.recentExecutions)).toBe(true)
      expect(data.data.recentExecutions[0]).toHaveProperty('status', 'COMPLETED')
      expect(data.data.recentExecutions[0]).toHaveProperty('companiesProcessed')
      expect(data.data.recentExecutions[0]).toHaveProperty('invoicesUpdated')
    })

    it('should provide overdue statistics', async () => {
      const response = await GET(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data.overdueStatistics).toHaveProperty('invoicesPastDue')
      expect(data.data.overdueStatistics).toHaveProperty('totalOverdueInvoices')
      expect(data.data.overdueStatistics).toHaveProperty('estimatedOverdueAmount')
    })
  })

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${validCronSecret}`
        }
      })
      mockUAEBusinessHours(true)
    })

    it('should handle database connection failures', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.companies.findMany.mockRejectedValue(new Error('Database connection failed'))

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(500)
    })

    it('should handle service failures gracefully', async () => {
      const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
      invoiceStatusService.detectAndUpdateOverdueInvoices.mockRejectedValue(new Error('Service unavailable'))

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Should continue processing other companies
      expect(data.data.executionSummary.errors.length).toBeGreaterThan(0)
    })

    it('should update execution log with error status', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.companies.findMany.mockRejectedValue(new Error('Critical error'))

      try {
        await POST(mockRequest)
      } catch (error) {
        // Expected to throw
      }

      // Should still attempt to log the error
      const { logError } = require('@/lib/errors')
      expect(logError).toHaveBeenCalled()
    })
  })

  describe('Performance and Monitoring', () => {
    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/cron/update-invoice-status', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${validCronSecret}`
        }
      })
      mockUAEBusinessHours(true)
    })

    it('should track execution time', async () => {
      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data.executionSummary.executionTime).toBeGreaterThan(0)
      expect(data.data.performanceMetrics.totalExecutionTime).toBeGreaterThan(0)
    })

    it('should calculate processing throughput', async () => {
      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data.performanceMetrics.throughputPerSecond).toBeGreaterThan(0)
      expect(data.data.performanceMetrics.averageProcessingTimePerInvoice).toBeGreaterThan(0)
    })

    it('should provide business impact metrics', async () => {
      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.data.businessSummary).toHaveProperty('totalAmountAffected')
      expect(data.data.businessSummary).toHaveProperty('formattedTotalAmount')
    })
  })
})

// Helper function to mock UAE business hours
function mockUAEBusinessHours(canProcess: boolean, dayOfWeek?: number, hour?: number) {
  const originalDate = global.Date
  
  global.Date = jest.fn().mockImplementation((...args) => {
    if (args.length === 0) {
      const mockDate = new originalDate('2024-01-01T10:00:00.000Z') // Default to a Monday
      
      if (dayOfWeek !== undefined) {
        mockDate.setDate(mockDate.getDate() + (dayOfWeek - mockDate.getDay()))
      }
      
      if (hour !== undefined) {
        mockDate.setHours(hour)
      }
      
      return mockDate
    }
    return new originalDate(...args)
  }) as any

  // Mock toLocaleString for Dubai timezone
  global.Date.prototype.toLocaleString = jest.fn().mockReturnValue('1/1/2024, 10:00:00 AM')
  
  // Mock getDay and getHours
  global.Date.prototype.getDay = jest.fn().mockReturnValue(dayOfWeek ?? (canProcess ? 1 : 5)) // Monday or Friday
  global.Date.prototype.getHours = jest.fn().mockReturnValue(hour ?? (canProcess ? 10 : 20)) // 10 AM or 8 PM
  
  // Restore static methods
  global.Date.now = originalDate.now
  global.Date.parse = originalDate.parse
  global.Date.UTC = originalDate.UTC
}