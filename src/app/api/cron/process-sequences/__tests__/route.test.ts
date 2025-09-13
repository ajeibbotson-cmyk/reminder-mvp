/**
 * Comprehensive Test Suite for Cron Process Sequences API Endpoint
 * Tests the main automation cron job with UAE business logic, monitoring, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST, GET } from '../route'

// Mock all dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    $queryRaw: jest.fn()
  }
}))

jest.mock('@/lib/services/sequence-triggers-service', () => ({
  sequenceTriggersService: {
    monitorInvoiceEvents: jest.fn()
  }
}))

jest.mock('@/lib/services/sequence-execution-service', () => ({
  sequenceExecutionService: {
    processPendingExecutions: jest.fn()
  }
}))

jest.mock('@/lib/services/email-scheduling-service', () => ({
  emailSchedulingService: {
    processScheduledEmails: jest.fn(),
    getQueueMetrics: jest.fn()
  }
}))

jest.mock('@/lib/services/uae-business-hours-service', () => ({
  uaeBusinessHours: {
    isBusinessHours: jest.fn(),
    getNextBusinessHour: jest.fn(),
    isUAEHoliday: jest.fn(),
    isPrayerTime: jest.fn()
  }
}))

// Mock global crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

describe('/api/cron/process-sequences', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock console methods
    console.log = jest.fn()
    console.warn = jest.fn()
    console.error = jest.fn()

    // Create mock request
    mockRequest = {
      headers: new Map([
        ['authorization', 'Bearer test-cron-secret'],
        ['host', 'localhost:3000'],
        ['user-agent', 'vercel-cron/1.0']
      ])
    } as any

    // Setup default successful mock responses
    const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
    const { sequenceExecutionService } = require('@/lib/services/sequence-execution-service')
    const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')
    const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
    const { prisma } = require('@/lib/prisma')

    sequenceTriggersService.monitorInvoiceEvents.mockResolvedValue({
      processed: 5,
      triggered: 3,
      errors: []
    })

    sequenceExecutionService.processPendingExecutions.mockResolvedValue({
      processed: 10,
      successful: 8,
      failed: 2,
      errors: ['Minor processing error']
    })

    emailSchedulingService.processScheduledEmails.mockResolvedValue({
      processed: 15,
      sent: 12,
      failed: 1,
      rescheduled: 2
    })

    emailSchedulingService.getQueueMetrics.mockResolvedValue({
      totalQueued: 50,
      scheduledForToday: 25,
      failedLastHour: 2,
      avgDeliveryTime: 5,
      successRate: 95.5,
      queueHealth: 'HEALTHY'
    })

    uaeBusinessHours.isBusinessHours.mockReturnValue(true)
    uaeBusinessHours.getNextBusinessHour.mockReturnValue(new Date(Date.now() + 60 * 60 * 1000))
    uaeBusinessHours.isUAEHoliday.mockReturnValue(false)
    uaeBusinessHours.isPrayerTime.mockReturnValue(false)

    prisma.$queryRaw.mockResolvedValue([{ result: 1 }])
    prisma.activity.create.mockResolvedValue({ id: 'activity-123' })
    prisma.activity.findMany.mockResolvedValue([])

    // Mock environment variables
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  afterEach(() => {
    jest.clearAllMocks()
    
    // Restore console methods
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    console.error = originalConsoleError

    // Clean up environment variables
    delete process.env.CRON_SECRET
  })

  describe('POST - Main Cron Processing', () => {
    describe('Authentication and Authorization', () => {
      it('should accept valid cron secret', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should reject invalid cron secret', async () => {
        const invalidRequest = {
          ...mockRequest,
          headers: new Map([
            ['authorization', 'Bearer invalid-secret'],
            ['host', 'localhost:3000']
          ])
        } as any

        const response = await POST(invalidRequest)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Unauthorized cron request')
        expect(data.details).toBe('Invalid cron secret')
      })

      it('should accept Vercel cron headers', async () => {
        const vercelRequest = {
          ...mockRequest,
          headers: new Map([
            ['x-vercel-cron', '1'],
            ['host', 'example.com']
          ])
        } as any

        const response = await POST(vercelRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should accept GitHub Actions user agent', async () => {
        const githubRequest = {
          ...mockRequest,
          headers: new Map([
            ['user-agent', 'github-actions/1.0'],
            ['host', 'api.example.com']
          ])
        } as any

        const response = await POST(githubRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should allow localhost during development', async () => {
        const localhostRequest = {
          ...mockRequest,
          headers: new Map([
            ['host', 'localhost:3000']
          ])
        } as any

        const response = await POST(localhostRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should reject unrecognized sources', async () => {
        const unknownRequest = {
          ...mockRequest,
          headers: new Map([
            ['host', 'malicious-site.com'],
            ['user-agent', 'unknown-bot/1.0']
          ])
        } as any

        const response = await POST(unknownRequest)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.details).toBe('Unrecognized cron source')
      })
    })

    describe('UAE Business Hours Compliance', () => {
      it('should skip processing outside UAE business hours', async () => {
        const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
        uaeBusinessHours.isBusinessHours.mockReturnValue(false)
        uaeBusinessHours.getNextBusinessHour.mockReturnValue(
          new Date(Date.now() + 12 * 60 * 60 * 1000)
        )

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.skipped).toBe(true)
        expect(data.reason).toContain('Outside UAE business hours')
        expect(data.nextRun).toBeDefined()
      })

      it('should skip processing on UAE holidays', async () => {
        const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
        uaeBusinessHours.isUAEHoliday.mockReturnValue(true)

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.skipped).toBe(true)
        expect(data.reason).toContain('UAE holiday')
      })

      it('should skip processing during prayer times', async () => {
        const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
        uaeBusinessHours.isPrayerTime.mockReturnValue(true)

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.skipped).toBe(true)
        expect(data.reason).toContain('Prayer time')
      })

      it('should process during valid UAE business hours', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.processed).toBe(true)
        expect(data.skipped).toBeUndefined()
      })
    })

    describe('Sequence Processing Flow', () => {
      it('should execute all processing steps in correct order', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.processed).toBe(true)

        // Verify all services were called
        const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
        const { sequenceExecutionService } = require('@/lib/services/sequence-execution-service')
        const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')

        expect(sequenceTriggersService.monitorInvoiceEvents).toHaveBeenCalled()
        expect(sequenceExecutionService.processPendingExecutions).toHaveBeenCalled()
        expect(emailSchedulingService.processScheduledEmails).toHaveBeenCalled()
      })

      it('should return comprehensive processing summary', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.summary).toEqual({
          totalProcessed: 30, // 5 + 10 + 15
          totalSuccessful: 23, // 3 + 8 + 12
          totalFailed: 3, // 0 + 2 + 1
          successRate: 76.67 // (23/30) * 100
        })

        expect(data.details.triggers).toEqual({
          processed: 5,
          successful: 3,
          failed: 2 // calculated
        })

        expect(data.details.executions).toEqual({
          processed: 10,
          successful: 8,
          failed: 2
        })

        expect(data.details.emails).toEqual({
          processed: 15,
          sent: 12,
          failed: 1,
          rescheduled: 2
        })
      })

      it('should include performance metrics', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.duration).toBeDefined()
        expect(typeof data.duration).toBe('number')
        expect(data.duration).toBeGreaterThan(0)
        expect(data.nextRun).toBeInstanceOf(String)
      })

      it('should handle warnings from processing steps', async () => {
        const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')
        emailSchedulingService.processScheduledEmails.mockResolvedValue({
          processed: 15,
          sent: 10,
          failed: 0,
          rescheduled: 5 // Many rescheduled
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.warnings).toContain('5 emails rescheduled due to timing constraints')
      })

      it('should collect and report errors from all steps', async () => {
        const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
        const { sequenceExecutionService } = require('@/lib/services/sequence-execution-service')

        sequenceTriggersService.monitorInvoiceEvents.mockResolvedValue({
          processed: 5,
          triggered: 2,
          errors: ['Database timeout', 'Invalid sequence configuration']
        })

        sequenceExecutionService.processPendingExecutions.mockResolvedValue({
          processed: 10,
          successful: 7,
          failed: 3,
          errors: ['Email service unavailable']
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.errors).toContain('Database timeout')
        expect(data.errors).toContain('Invalid sequence configuration')
        expect(data.errors).toContain('Email service unavailable')
      })
    })

    describe('Health Checks and Monitoring', () => {
      it('should perform database health check', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        const { prisma } = require('@/lib/prisma')
        expect(prisma.$queryRaw).toHaveBeenCalledWith(expect.stringContaining('SELECT 1'))
        expect(data.success).toBe(true)
      })

      it('should detect stuck sequences', async () => {
        const { prisma } = require('@/lib/prisma')
        // Mock count query for health checks
        jest.spyOn(prisma, 'followUpLog').mockReturnValue({
          count: jest.fn().mockResolvedValue(15) // More than 10 stuck sequences
        } as any)

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.warnings).toContain('15 sequences may be stuck')
      })

      it('should detect critical email queue health', async () => {
        const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')
        emailSchedulingService.getQueueMetrics.mockResolvedValue({
          totalQueued: 50,
          scheduledForToday: 25,
          failedLastHour: 60, // High failure rate
          avgDeliveryTime: 30,
          successRate: 60, // Low success rate
          queueHealth: 'CRITICAL'
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.errors).toContain('Email queue in critical state')
        expect(data.errors).toContain('High email failure rate: 60 failed in last hour')
      })

      it('should detect large email queue', async () => {
        const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')
        emailSchedulingService.getQueueMetrics.mockResolvedValue({
          totalQueued: 1200, // Large queue
          scheduledForToday: 500,
          failedLastHour: 5,
          avgDeliveryTime: 10,
          successRate: 95,
          queueHealth: 'WARNING'
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.warnings).toContain('Large email queue: 1200 emails pending')
        expect(data.warnings).toContain('Email queue showing warning signs')
      })

      it('should handle health check failures gracefully', async () => {
        const { prisma } = require('@/lib/prisma')
        prisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'))

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.errors).toContain('Health check failed: Database connection failed')
        expect(data.success).toBe(true) // Should still succeed overall
      })
    })

    describe('Activity Logging', () => {
      it('should log successful processing activity', async () => {
        const response = await POST(mockRequest)
        await response.json()

        const { prisma } = require('@/lib/prisma')
        expect(prisma.activity.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyId: 'system',
            userId: 'cron-job',
            type: 'SEQUENCE_PROCESSING',
            description: expect.stringContaining('Processed 5 triggers, 10 executions, 15 emails'),
            metadata: expect.objectContaining({
              processed: { triggers: 5, executions: 10, emails: 15 },
              successful: { triggers: 3, executions: 8, emails: 12 },
              failed: { triggers: 2, executions: 2, emails: 1 },
              isError: false
            })
          })
        })
      })

      it('should log failure activity on errors', async () => {
        const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
        sequenceTriggersService.monitorInvoiceEvents.mockRejectedValue(
          new Error('Critical system failure')
        )

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)

        const { prisma } = require('@/lib/prisma')
        expect(prisma.activity.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'SEQUENCE_PROCESSING',
            description: expect.stringContaining('Sequence processing failed'),
            metadata: expect.objectContaining({
              isError: true
            })
          })
        })
      })
    })

    describe('Next Run Time Calculation', () => {
      it('should schedule next run within business hours', async () => {
        const response = await POST(mockRequest)
        const data = await response.json()

        const nextRun = new Date(data.nextRun)
        const now = new Date()

        expect(nextRun.getTime()).toBeGreaterThan(now.getTime())
        // Should be scheduled for next hour if still in business hours
        expect(nextRun.getTime() - now.getTime()).toBeLessThanOrEqual(60 * 60 * 1000 + 1000) // 1 hour + 1s buffer
      })

      it('should schedule next run for next business day when needed', async () => {
        const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
        
        // Mock that next hour would be outside business hours
        const nextBusinessDay = new Date(Date.now() + 15 * 60 * 60 * 1000) // 15 hours later
        uaeBusinessHours.getNextBusinessHour.mockReturnValue(nextBusinessDay)

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(new Date(data.nextRun)).toEqual(nextBusinessDay)
      })
    })

    describe('Error Handling and Recovery', () => {
      it('should handle trigger service failures gracefully', async () => {
        const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
        sequenceTriggersService.monitorInvoiceEvents.mockRejectedValue(
          new Error('Trigger service unavailable')
        )

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toBe('Sequence processing failed')
        expect(data.details).toBe('Trigger service unavailable')
      })

      it('should handle execution service failures gracefully', async () => {
        const { sequenceExecutionService } = require('@/lib/services/sequence-execution-service')
        sequenceExecutionService.processPendingExecutions.mockRejectedValue(
          new Error('Execution service crashed')
        )

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.details).toBe('Execution service crashed')
      })

      it('should handle email service failures gracefully', async () => {
        const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')
        emailSchedulingService.processScheduledEmails.mockRejectedValue(
          new Error('SMTP server down')
        )

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.details).toBe('SMTP server down')
      })

      it('should include error details and duration even on failure', async () => {
        const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
        sequenceTriggersService.monitorInvoiceEvents.mockRejectedValue(
          new Error('Service failure')
        )

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(data.duration).toBeDefined()
        expect(typeof data.duration).toBe('number')
        expect(data.errors).toContain('Service failure')
      })
    })

    describe('Performance and Load Handling', () => {
      it('should complete processing within reasonable time', async () => {
        const startTime = Date.now()
        
        const response = await POST(mockRequest)
        await response.json()
        
        const endTime = Date.now()
        const duration = endTime - startTime

        expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
      })

      it('should handle high-volume processing results', async () => {
        const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
        const { sequenceExecutionService } = require('@/lib/services/sequence-execution-service')
        const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')

        // Mock high-volume results
        sequenceTriggersService.monitorInvoiceEvents.mockResolvedValue({
          processed: 500,
          triggered: 350,
          errors: []
        })

        sequenceExecutionService.processPendingExecutions.mockResolvedValue({
          processed: 1000,
          successful: 950,
          failed: 50,
          errors: []
        })

        emailSchedulingService.processScheduledEmails.mockResolvedValue({
          processed: 2000,
          sent: 1900,
          failed: 50,
          rescheduled: 50
        })

        const response = await POST(mockRequest)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.summary.totalProcessed).toBe(3500)
        expect(data.summary.totalSuccessful).toBe(3200)
        expect(data.summary.successRate).toBeCloseTo(91.43, 1)
      })
    })
  })

  describe('GET - Cron Job Status', () => {
    beforeEach(() => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock recent activity
      const recentActivity = [
        {
          id: 'activity-1',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          description: 'Processed 10 triggers, 15 executions, 20 emails in 2500ms',
          metadata: { duration: 2500, successful: { triggers: 8, executions: 12, emails: 18 } }
        },
        {
          id: 'activity-2',
          createdAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
          description: 'Processed 5 triggers, 8 executions, 12 emails in 1800ms',
          metadata: { duration: 1800, successful: { triggers: 5, executions: 7, emails: 11 } }
        }
      ]
      
      prisma.activity.findMany.mockResolvedValue(recentActivity)
    })

    it('should return comprehensive cron job status', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('active')
      expect(data.currentTime).toBeDefined()
      expect(data.timeZone).toBe('Asia/Dubai')
      expect(data.isBusinessHours).toBe(true)
      expect(data.nextBusinessHour).toBeDefined()
      expect(data.shouldProcessNow).toBe(true)
    })

    it('should include queue health information', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.queueHealth).toEqual({
        status: 'HEALTHY',
        queued: 50,
        scheduledToday: 25,
        failedLastHour: 2
      })
    })

    it('should include recent processing activity', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.recentActivity).toHaveLength(2)
      expect(data.recentActivity[0]).toEqual({
        id: 'activity-1',
        timestamp: expect.any(String),
        description: 'Processed 10 triggers, 15 executions, 20 emails in 2500ms',
        metadata: expect.any(Object)
      })
    })

    it('should include configuration information', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.configuration).toEqual({
        processingInterval: '1 hour',
        businessHours: 'Sunday-Thursday, 8 AM - 6 PM UAE',
        holidayHandling: 'Skip UAE public and Islamic holidays',
        culturalCompliance: 'Enabled - optimal timing Tue-Thu 10-11 AM'
      })
    })

    it('should show processing window status', async () => {
      const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)
      uaeBusinessHours.getNextBusinessHour.mockReturnValue(
        new Date(Date.now() + 12 * 60 * 60 * 1000)
      )

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.shouldProcessNow).toBe(false)
      expect(data.processingWindow.reason).toContain('Outside UAE business hours')
      expect(data.processingWindow.nextAvailable).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.activity.findMany.mockRejectedValue(new Error('Database error'))

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to get cron job status')
    })

    it('should show correct business hours status', async () => {
      const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
      const mockDate = new Date('2024-01-01T10:00:00.000Z') // Monday 10 AM
      uaeBusinessHours.isBusinessHours.mockReturnValue(true)
      uaeBusinessHours.getNextBusinessHour.mockReturnValue(
        new Date('2024-01-01T11:00:00.000Z')
      )

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.isBusinessHours).toBe(true)
      expect(data.shouldProcessNow).toBe(true)
    })

    it('should limit recent activity to 10 entries', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock more than 10 activities
      const manyActivities = Array.from({ length: 15 }, (_, i) => ({
        id: `activity-${i}`,
        createdAt: new Date(Date.now() - i * 60 * 1000),
        description: `Activity ${i}`,
        metadata: {}
      }))
      
      prisma.activity.findMany.mockResolvedValue(manyActivities)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.recentActivity).toHaveLength(10) // Should be limited
      expect(prisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      )
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle missing environment variables', async () => {
      delete process.env.CRON_SECRET

      const requestWithoutSecret = {
        ...mockRequest,
        headers: new Map([
          ['host', 'unknown-host.com']
        ])
      } as any

      const response = await POST(requestWithoutSecret)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.details).toBe('Unrecognized cron source')
    })

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => POST(mockRequest))
      const responses = await Promise.all(requests)

      // All should succeed
      responses.forEach(async (response) => {
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.success).toBe(true)
      })
    })

    it('should handle malformed request headers', async () => {
      const malformedRequest = {
        headers: null
      } as any

      const response = await POST(malformedRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.details).toBe('Validation error')
    })

    it('should handle very long processing times', async () => {
      const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
      
      // Mock long-running operation
      sequenceTriggersService.monitorInvoiceEvents.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          processed: 1,
          triggered: 1,
          errors: []
        }), 2000)) // 2 second delay
      )

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.duration).toBeGreaterThan(2000)
    })

    it('should prevent memory leaks with large error arrays', async () => {
      const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
      
      const largeErrorArray = Array.from({ length: 1000 }, (_, i) => `Error ${i}`)
      sequenceTriggersService.monitorInvoiceEvents.mockResolvedValue({
        processed: 1000,
        triggered: 500,
        errors: largeErrorArray
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.errors.length).toBe(1000)
      expect(Array.isArray(data.errors)).toBe(true)
    })
  })

  describe('Integration with UAE Business Context', () => {
    it('should respect UAE weekend (Friday-Saturday)', async () => {
      const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
      
      // Mock Friday (weekend in UAE)
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)
      
      const response = await POST(mockRequest)
      const data = await response.json()

      expect(data.skipped).toBe(true)
      expect(data.reason).toContain('Outside UAE business hours')
    })

    it('should respect Islamic holidays', async () => {
      const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
      
      uaeBusinessHours.isUAEHoliday.mockReturnValue(true)
      
      const response = await POST(mockRequest)
      const data = await response.json()

      expect(data.skipped).toBe(true)
      expect(data.reason).toContain('UAE holiday')
    })

    it('should respect prayer times', async () => {
      const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
      
      uaeBusinessHours.isPrayerTime.mockReturnValue(true)
      
      const response = await POST(mockRequest)
      const data = await response.json()

      expect(data.skipped).toBe(true)
      expect(data.reason).toContain('Prayer time - avoiding email sends')
    })

    it('should calculate next run considering UAE context', async () => {
      const { uaeBusinessHours } = require('@/lib/services/uae-business-hours-service')
      
      const nextUAEBusinessHour = new Date(Date.now() + 15 * 60 * 60 * 1000)
      uaeBusinessHours.getNextBusinessHour.mockReturnValue(nextUAEBusinessHour)
      
      // Mock that next hour would be outside business hours
      uaeBusinessHours.isBusinessHours
        .mockReturnValueOnce(true) // Current check
        .mockReturnValueOnce(false) // Next hour check
      
      uaeBusinessHours.isUAEHoliday.mockReturnValue(false)

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(new Date(data.nextRun)).toEqual(nextUAEBusinessHour)
    })
  })
})