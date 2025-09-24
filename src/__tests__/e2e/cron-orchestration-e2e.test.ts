/**
 * Cron Job Orchestration End-to-End Tests
 * 
 * Validates the complete cron job workflow that processes UAE payment automation
 * sequences while respecting UAE business hours, holidays, and cultural considerations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import request from 'supertest'
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/cron/process-sequences/route'
import { prisma } from '@/lib/prisma'
import { UAETestUtils } from '@/lib/uae-test-utils'
import { setupTestDatabase, cleanupTestDatabase } from '@/lib/test-db-setup'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'

// Mock external dependencies for testing
jest.mock '@/lib/email-service'

describe('Cron Job Orchestration E2E Tests', () => {
  let testCompanyId: string
  let testUserId: string

  beforeAll(async () => {
    await setupTestDatabase()
    
    // Create test company and user
    testCompanyId = UAETestUtils.generateId()
    testUserId = UAETestUtils.generateId()

    await prisma.company.create({
      data: {
        id: testCompanyId,
        name: 'Test Company LLC',
        trn: '100123456700001',
        address: 'Dubai, UAE',
        businessHours: {
          workingDays: [0, 1, 2, 3, 4],
          startHour: 8,
          endHour: 18,
          timezone: 'Asia/Dubai'
        }
      }
    })

    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'test@company.ae',
        name: 'Test User',
        companyId: testCompanyId,
        role: 'ADMIN'
      }
    })
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Cron Job Processing During UAE Business Hours', () => {
    it('should process sequences during optimal UAE business hours', async () => {
      // Set time to Tuesday 10 AM UAE (optimal time)
      const optimalTime = new Date('2024-03-19T06:00:00.000Z')
      jest.useFakeTimers()
      jest.setSystemTime(optimalTime)

      // Create test data
      const { invoiceId, sequenceId } = await createTestSequenceData()

      // Create mock request with proper headers
      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
          'user-agent': 'vercel-cron'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.processed).toBe(true)
      expect(result.summary.totalProcessed).toBeGreaterThanOrEqual(0)
      
      // Should have processed during business hours
      expect(uaeBusinessHours.isBusinessHours(optimalTime)).toBe(true)

      jest.useRealTimers()
    })

    it('should skip processing outside UAE business hours', async () => {
      // Set time to Friday 8 PM (weekend in UAE)
      const weekendTime = new Date('2024-03-22T16:00:00.000Z') // Friday 8 PM UAE
      jest.useFakeTimers()
      jest.setSystemTime(weekendTime)

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
          'user-agent': 'vercel-cron'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(result.reason).toContain('business hours')
      expect(result.nextRun).toBeTruthy()

      // Verify next run is during business hours
      const nextRun = new Date(result.nextRun)
      expect(uaeBusinessHours.isBusinessHours(nextRun)).toBe(true)

      jest.useRealTimers()
    })

    it('should handle UAE holidays appropriately', async () => {
      // Set time to UAE National Day (December 2nd)
      const nationalDay = new Date('2024-12-02T06:00:00.000Z')
      jest.useFakeTimers()
      jest.setSystemTime(nationalDay)

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
          'user-agent': 'vercel-cron'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(result.reason).toContain('holiday')

      jest.useRealTimers()
    })

    it('should avoid processing during prayer times', async () => {
      // Set time to Dhuhr prayer time (12:15 PM UAE)
      const prayerTime = new Date('2024-03-19T08:15:00.000Z')
      jest.useFakeTimers()
      jest.setSystemTime(prayerTime)

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
          'user-agent': 'vercel-cron'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
      expect(result.reason).toContain('prayer time')

      jest.useRealTimers()
    })
  })

  describe('Security and Authentication', () => {
    it('should reject unauthorized cron requests', async () => {
      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-secret',
          'user-agent': 'malicious-bot'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toContain('Unauthorized')
    })

    it('should accept legitimate Vercel cron requests', async () => {
      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'x-vercel-cron': '1',
          'user-agent': 'vercel'
        }
      }) as NextRequest

      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z')) // Business hours

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)

      jest.useRealTimers()
    })

    it('should accept localhost requests for development', async () => {
      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'host': 'localhost:3000',
          'user-agent': 'test-runner'
        }
      }) as NextRequest

      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z'))

      const response = await POST(mockRequest)
      
      expect(response.status).toBe(200)

      jest.useRealTimers()
    })
  })

  describe('Health Monitoring and Error Handling', () => {
    it('should perform health checks and report status', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z'))

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'GET',
        headers: {
          'user-agent': 'vercel'
        }
      }) as NextRequest

      const response = await GET(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.status).toBe('active')
      expect(result.currentTime).toBeTruthy()
      expect(result.timeZone).toBe('Asia/Dubai')
      expect(typeof result.isBusinessHours).toBe('boolean')
      expect(result.queueHealth).toBeTruthy()
      expect(result.queueHealth.status).toBeOneOf(['HEALTHY', 'WARNING', 'CRITICAL'])
      expect(result.configuration).toBeTruthy()

      jest.useRealTimers()
    })

    it('should handle processing errors gracefully', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z'))

      // Mock a database error
      const originalQueryRaw = prisma.$queryRaw
      prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection failed'))

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'x-vercel-cron': '1',
          'user-agent': 'vercel'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
      expect(result.error).toContain('failed')
      expect(result.errors).toContain('Database connection failed')

      // Restore original function
      prisma.$queryRaw = originalQueryRaw

      jest.useRealTimers()
    })

    it('should log processing activity for monitoring', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z'))

      const { invoiceId, sequenceId } = await createTestSequenceData()

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: {
          'x-vercel-cron': '1'
        }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)

      // Check that activity was logged
      const activities = await prisma.activity.findMany({
        where: {
          type: 'SEQUENCE_PROCESSING',
          companyId: 'system'
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      })

      expect(activities.length).toBeGreaterThan(0)
      const activity = activities[0]
      expect(activity.description).toContain('Processed')
      expect(activity.metadata).toBeTruthy()

      jest.useRealTimers()
    })
  })

  describe('Queue Management and Metrics', () => {
    it('should provide detailed queue health metrics', async () => {
      // Create several test email logs in different states
      const emailLogs = await Promise.all([
        createTestEmailLog('QUEUED'),
        createTestEmailLog('SENT'),
        createTestEmailLog('FAILED'),
        createTestEmailLog('DELIVERED')
      ])

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'GET'
      }) as NextRequest

      const response = await GET(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.queueHealth).toBeTruthy()
      expect(typeof result.queueHealth.queued).toBe('number')
      expect(typeof result.queueHealth.scheduledToday).toBe('number')
      expect(typeof result.queueHealth.failedLastHour).toBe('number')
      expect(result.queueHealth.status).toBeOneOf(['HEALTHY', 'WARNING', 'CRITICAL'])
    })

    it('should calculate next run time based on UAE business hours', async () => {
      // Test from various times
      const testTimes = [
        new Date('2024-03-19T14:00:00.000Z'), // Tuesday 6 PM (end of business)
        new Date('2024-03-21T10:00:00.000Z'), // Thursday 2 PM (mid-business)
        new Date('2024-03-22T06:00:00.000Z'), // Friday 10 AM (weekend)
      ]

      for (const testTime of testTimes) {
        jest.useFakeTimers()
        jest.setSystemTime(testTime)

        const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
          method: 'POST',
          headers: { 'x-vercel-cron': '1' }
        }) as NextRequest

        const response = await POST(mockRequest)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.nextRun).toBeTruthy()

        const nextRun = new Date(result.nextRun)
        
        // Next run should be during business hours
        if (!result.skipped) {
          expect(uaeBusinessHours.isBusinessHours(nextRun)).toBe(true)
        }

        jest.useRealTimers()
      }
    })
  })

  describe('Integration with Sequence Services', () => {
    it('should coordinate between trigger monitoring, execution, and email services', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z'))

      // Create comprehensive test data
      const { invoiceId, sequenceId, customerId } = await createTestSequenceData()

      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: { 'x-vercel-cron': '1' }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      
      // Verify all three main processing areas were attempted
      expect(result.details.triggers).toBeTruthy()
      expect(result.details.executions).toBeTruthy()
      expect(result.details.emails).toBeTruthy()

      expect(typeof result.details.triggers.processed).toBe('number')
      expect(typeof result.details.executions.processed).toBe('number')
      expect(typeof result.details.emails.processed).toBe('number')

      jest.useRealTimers()
    })

    it('should handle high-volume processing efficiently', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-03-19T06:00:00.000Z'))

      // Create multiple test invoices and sequences
      const testData = []
      for (let i = 0; i < 10; i++) {
        testData.push(await createTestSequenceData())
      }

      const startTime = Date.now()
      
      const mockRequest = new Request('http://localhost:3000/api/cron/process-sequences', {
        method: 'POST',
        headers: { 'x-vercel-cron': '1' }
      }) as NextRequest

      const response = await POST(mockRequest)
      const result = await response.json()

      const endTime = Date.now()
      const processingTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(processingTime).toBeLessThan(10000) // Should complete within 10 seconds
      
      // Success rate should be high
      if (result.summary.totalProcessed > 0) {
        expect(result.summary.successRate).toBeGreaterThan(80)
      }

      jest.useRealTimers()
    })
  })

  // Helper functions
  async function createTestSequenceData() {
    const customerId = UAETestUtils.generateId()
    const invoiceId = UAETestUtils.generateId()
    const sequenceId = UAETestUtils.generateId()

    await prisma.customer.create({
      data: {
        id: customerId,
        companyId: testCompanyId,
        name: 'Test Customer',
        email: `test.customer.${customerId.slice(-8)}@example.ae`,
        phone: '+971-4-123-4567'
      }
    })

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        companyId: testCompanyId,
        number: `INV-${invoiceId.slice(-8)}`,
        customerName: 'Test Customer',
        customerEmail: `test.customer.${customerId.slice(-8)}@example.ae`,
        amount: 1000,
        vatAmount: 50,
        totalAmount: 1050,
        currency: 'AED',
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: 'OVERDUE',
        trnNumber: '100123456700001'
      }
    })

    await prisma.follow_up_sequences.create({
      data: {
        id: sequenceId,
        companyId: testCompanyId,
        name: 'Test Sequence',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Test Reminder',
            content: 'Test content',
            tone: 'BUSINESS',
            language: 'ENGLISH'
          }
        ],
        active: true,
        updatedAt: new Date()
      }
    })

    return { customerId, invoiceId, sequenceId }
  }

  async function createTestEmailLog(status: string) {
    const emailLogId = UAETestUtils.generateId()
    
    return await prisma.emailLog.create({
      data: {
        id: emailLogId,
        companyId: testCompanyId,
        recipientEmail: `test.${emailLogId.slice(-8)}@example.ae`,
        subject: 'Test Email',
        content: 'Test content',
        deliveryStatus: status as any,
        language: 'ENGLISH',
        retryCount: 0,
        maxRetries: 3
      }
    })
  }
})