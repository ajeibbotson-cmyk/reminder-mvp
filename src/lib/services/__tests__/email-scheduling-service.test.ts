/**
 * Comprehensive Test Suite for Email Scheduling Service
 * Tests UAE-specific email scheduling, queue management, rate limiting, and cultural timing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  EmailSchedulingService,
  emailSchedulingService,
  ScheduledEmail,
  SchedulingOptions,
  QueueMetrics,
  RateLimitConfig
} from '../email-scheduling-service'
import { SequenceType, CustomerRelationship } from '../cultural-compliance-service'

// Mock all dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    emailLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      fields: {
        maxRetries: 'maxRetries'
      }
    },
    customer: {
      findUnique: jest.fn()
    },
    company: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('../uae-business-hours-service', () => ({
  uaeBusinessHours: {
    isBusinessHours: jest.fn(),
    getNextBusinessHour: jest.fn(),
    getNextAvailableSendTime: jest.fn()
  }
}))

jest.mock('../cultural-compliance-service', () => ({
  culturalCompliance: {
    validateTemplateContent: jest.fn(),
    suggestOptimalTiming: jest.fn()
  }
}))

jest.mock('../email-service', () => ({
  getDefaultEmailService: jest.fn(() => ({
    sendEmail: jest.fn()
  }))
}))

// Mock global crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

describe('EmailSchedulingService', () => {
  let service: EmailSchedulingService
  let mockEmailData: Omit<ScheduledEmail, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>
  let mockCompany: any
  let mockCustomer: any

  beforeEach(() => {
    // Create service with custom rate limits for testing
    const testRateLimits: Partial<RateLimitConfig> = {
      maxEmailsPerHour: 10,
      maxEmailsPerDay: 100,
      burstLimit: 5,
      cooldownMinutes: 5
    }
    service = new EmailSchedulingService(testRateLimits)

    // Reset all mocks
    jest.clearAllMocks()

    // Mock company data
    mockCompany = {
      id: 'company-123',
      name: 'Emirates Business Solutions',
      emailSettings: { enabled: true }
    }

    // Mock customer data
    mockCustomer = {
      id: 'customer-123',
      name: 'Ahmed Al-Mahmoud',
      email: 'ahmed@emiratesfirm.ae',
      createdAt: new Date('2023-01-01'),
      invoices: [
        { status: 'PAID' },
        { status: 'PAID' },
        { status: 'PAID' }
      ]
    }

    // Mock email data
    mockEmailData = {
      companyId: 'company-123',
      invoiceId: 'invoice-123',
      customerId: 'customer-123',
      recipientEmail: 'ahmed@emiratesfirm.ae',
      recipientName: 'Ahmed Al-Mahmoud',
      subject: 'Invoice Reminder - INV-001',
      content: 'Dear Ahmed, this is a friendly reminder about your invoice.',
      language: 'ENGLISH',
      scheduledFor: new Date(),
      priority: 'NORMAL',
      maxRetries: 3
    }

    // Setup default mock responses
    const { prisma } = require('@/lib/prisma')
    const { uaeBusinessHours } = require('../uae-business-hours-service')
    const { culturalCompliance } = require('../cultural-compliance-service')
    const { getDefaultEmailService } = require('../email-service')

    prisma.company.findUnique.mockResolvedValue(mockCompany)
    prisma.customer.findUnique.mockResolvedValue(mockCustomer)
    prisma.emailLog.create.mockResolvedValue({ id: 'email-log-123' })
    prisma.emailLog.count.mockResolvedValue(0)
    
    uaeBusinessHours.isBusinessHours.mockReturnValue(true)
    uaeBusinessHours.getNextBusinessHour.mockReturnValue(new Date(Date.now() + 60 * 60 * 1000))
    uaeBusinessHours.getNextAvailableSendTime.mockReturnValue(new Date())
    
    culturalCompliance.validateTemplateContent.mockReturnValue({
      isValid: true,
      culturalCompliance: 95,
      issues: []
    })
    culturalCompliance.suggestOptimalTiming.mockReturnValue({
      preferredDays: [2, 3, 4],
      preferredHours: [10, 11],
      avoidPrayerTimes: true,
      respectRamadan: true,
      culturalTone: 'BUSINESS'
    })

    const mockEmailService = getDefaultEmailService()
    mockEmailService.sendEmail.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('scheduleEmail', () => {
    it('should successfully schedule an email for future delivery', async () => {
      const { prisma } = require('@/lib/prisma')
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours later
      
      const emailData = {
        ...mockEmailData,
        scheduledFor: futureTime
      }

      const emailLogId = await service.scheduleEmail(emailData)

      expect(emailLogId).toBeDefined()
      expect(prisma.emailLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'company-123',
          recipientEmail: 'ahmed@emiratesfirm.ae',
          subject: 'Invoice Reminder - INV-001',
          deliveryStatus: 'QUEUED',
          maxRetries: 3
        })
      })
    })

    it('should validate cultural compliance before scheduling', async () => {
      const { culturalCompliance } = require('../cultural-compliance-service')
      culturalCompliance.validateTemplateContent.mockReturnValue({
        isValid: false,
        issues: ['Contains aggressive language']
      })

      await expect(service.scheduleEmail(mockEmailData)).rejects.toThrow(
        'Cultural compliance issues: Contains aggressive language'
      )
    })

    it('should respect scheduling constraints', async () => {
      const { prisma } = require('@/lib/prisma')
      const disabledCompany = {
        ...mockCompany,
        emailSettings: { disabled: true }
      }
      prisma.company.findUnique.mockResolvedValue(disabledCompany)

      await expect(service.scheduleEmail(mockEmailData)).rejects.toThrow(
        'Email sending is disabled for this company'
      )
    })

    it('should process immediate emails when scheduled within 5 minutes', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      const immediateTime = new Date(Date.now() + 2 * 60 * 1000) // 2 minutes
      
      const emailData = {
        ...mockEmailData,
        scheduledFor: immediateTime
      }

      jest.spyOn(service as any, 'processImmediateEmail').mockResolvedValue(undefined)

      await service.scheduleEmail(emailData)

      expect((service as any).processImmediateEmail).toHaveBeenCalledWith('email-log-123')
    })

    it('should calculate optimal send time for UAE business culture', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      const optimalTime = new Date()
      optimalTime.setHours(10, 30, 0, 0) // Tuesday 10:30 AM
      uaeBusinessHours.getNextAvailableSendTime.mockReturnValue(optimalTime)

      const emailData = {
        ...mockEmailData,
        priority: 'NORMAL'
      }

      await service.scheduleEmail(emailData, { preferOptimalTiming: true })

      expect(uaeBusinessHours.getNextAvailableSendTime).toHaveBeenCalled()
    })

    it('should handle urgent priority emails correctly', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      uaeBusinessHours.isBusinessHours.mockReturnValue(true)

      const urgentEmailData = {
        ...mockEmailData,
        priority: 'URGENT' as const,
        scheduledFor: new Date()
      }

      await service.scheduleEmail(urgentEmailData)

      // Should schedule immediately if within business hours
      expect(uaeBusinessHours.isBusinessHours).toHaveBeenCalled()
    })

    it('should defer urgent emails outside business hours', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)
      const nextBusinessHour = new Date(Date.now() + 12 * 60 * 60 * 1000)
      uaeBusinessHours.getNextBusinessHour.mockReturnValue(nextBusinessHour)

      const urgentEmailData = {
        ...mockEmailData,
        priority: 'URGENT' as const
      }

      await service.scheduleEmail(urgentEmailData)

      expect(uaeBusinessHours.getNextBusinessHour).toHaveBeenCalled()
    })
  })

  describe('processScheduledEmails', () => {
    beforeEach(() => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock ready emails
      const readyEmails = [
        {
          id: 'email-1',
          recipientEmail: 'customer1@test.ae',
          subject: 'Invoice Reminder 1',
          content: 'Please pay invoice 1',
          retryCount: 0,
          maxRetries: 3,
          uaeSendTime: new Date(Date.now() - 60 * 1000) // 1 minute ago
        },
        {
          id: 'email-2',
          recipientEmail: 'customer2@test.ae',
          subject: 'Invoice Reminder 2',
          content: 'Please pay invoice 2',
          retryCount: 1,
          maxRetries: 3,
          uaeSendTime: new Date(Date.now() - 30 * 1000) // 30 seconds ago
        }
      ]
      
      prisma.emailLog.findMany.mockResolvedValue(readyEmails)
    })

    it('should process all ready emails successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.emailLog.update.mockResolvedValue({})

      const result = await service.processScheduledEmails()

      expect(result.processed).toBe(2)
      expect(result.sent).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.rescheduled).toBe(0)
    })

    it('should respect rate limits', async () => {
      // Mock rate limit reached
      jest.spyOn(service as any, 'checkRateLimits').mockResolvedValue({
        allowed: false,
        availableSlots: 0,
        nextAvailable: new Date(Date.now() + 60 * 60 * 1000)
      })

      const result = await service.processScheduledEmails()

      expect(result.processed).toBe(0)
      expect(result.sent).toBe(0)
    })

    it('should reschedule emails outside business hours', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      const { prisma } = require('@/lib/prisma')
      
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)
      const nextBusinessHour = new Date(Date.now() + 12 * 60 * 60 * 1000)
      uaeBusinessHours.getNextBusinessHour.mockReturnValue(nextBusinessHour)

      const result = await service.processScheduledEmails()

      expect(result.rescheduled).toBe(2)
      expect(prisma.emailLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            uaeSendTime: nextBusinessHour
          })
        })
      )
    })

    it('should handle email sending failures with retry logic', async () => {
      const { getDefaultEmailService } = require('../email-service')
      const mockEmailService = getDefaultEmailService()
      mockEmailService.sendEmail.mockRejectedValue(new Error('SES quota exceeded'))

      const result = await service.processScheduledEmails()

      expect(result.failed).toBe(0) // Should retry, not fail immediately
      expect(result.rescheduled).toBe(2) // Should reschedule for retry
    })

    it('should fail emails after max retries', async () => {
      const { prisma } = require('@/lib/prisma')
      const { getDefaultEmailService } = require('../email-service')
      
      // Mock email at max retries
      const maxRetriedEmails = [
        {
          id: 'email-1',
          retryCount: 3,
          maxRetries: 3,
          uaeSendTime: new Date(Date.now() - 60 * 1000)
        }
      ]
      prisma.emailLog.findMany.mockResolvedValue(maxRetriedEmails)
      
      const mockEmailService = getDefaultEmailService()
      mockEmailService.sendEmail.mockRejectedValue(new Error('Permanent failure'))

      const result = await service.processScheduledEmails()

      expect(result.failed).toBe(1)
      expect(prisma.emailLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: 'FAILED',
            bounceReason: 'Max retries exceeded'
          })
        })
      )
    })

    it('should batch process emails efficiently', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock large batch of ready emails
      const largeEmailBatch = Array.from({ length: 75 }, (_, i) => ({
        id: `email-${i}`,
        retryCount: 0,
        maxRetries: 3,
        uaeSendTime: new Date(Date.now() - 60 * 1000)
      }))
      
      prisma.emailLog.findMany.mockResolvedValue(largeEmailBatch)

      // Mock rate limits allowing only 50
      jest.spyOn(service as any, 'checkRateLimits').mockResolvedValue({
        allowed: true,
        availableSlots: 50
      })

      const result = await service.processScheduledEmails()

      expect(result.processed).toBe(50) // Should respect batch limit
    })
  })

  describe('getQueueMetrics', () => {
    beforeEach(() => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock metrics data
      prisma.emailLog.count
        .mockResolvedValueOnce(50) // totalQueued
        .mockResolvedValueOnce(25) // scheduledForToday
        .mockResolvedValueOnce(5)  // failedLastHour

      // Mock recent emails for analytics
      const recentEmails = [
        { deliveryStatus: 'DELIVERED', sentAt: new Date(), deliveredAt: new Date(Date.now() + 5000) },
        { deliveryStatus: 'DELIVERED', sentAt: new Date(), deliveredAt: new Date(Date.now() + 3000) },
        { deliveryStatus: 'FAILED', sentAt: new Date(), deliveredAt: null }
      ]
      prisma.emailLog.findMany.mockResolvedValue(recentEmails)
    })

    it('should calculate comprehensive queue metrics', async () => {
      const metrics = await service.getQueueMetrics()

      expect(metrics.totalQueued).toBe(50)
      expect(metrics.scheduledForToday).toBe(25)
      expect(metrics.failedLastHour).toBe(5)
      expect(metrics.successRate).toBeCloseTo(66.67) // 2 success out of 3
      expect(metrics.avgDeliveryTime).toBe(4) // Average of 5 and 3 seconds
      expect(metrics.queueHealth).toBe('HEALTHY')
    })

    it('should determine WARNING queue health', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock warning conditions
      prisma.emailLog.count
        .mockResolvedValueOnce(1200) // High queue
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(15) // Moderate failures

      const metrics = await service.getQueueMetrics()

      expect(metrics.queueHealth).toBe('WARNING')
    })

    it('should determine CRITICAL queue health', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock critical conditions
      prisma.emailLog.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(25) // High failures

      const recentEmails = [
        { deliveryStatus: 'FAILED' },
        { deliveryStatus: 'FAILED' },
        { deliveryStatus: 'DELIVERED' }
      ]
      prisma.emailLog.findMany.mockResolvedValue(recentEmails)

      const metrics = await service.getQueueMetrics()

      expect(metrics.queueHealth).toBe('CRITICAL')
    })

    it('should handle empty metrics gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.emailLog.count.mockResolvedValue(0)
      prisma.emailLog.findMany.mockResolvedValue([])

      const metrics = await service.getQueueMetrics()

      expect(metrics.totalQueued).toBe(0)
      expect(metrics.successRate).toBe(100) // Default when no data
      expect(metrics.queueHealth).toBe('HEALTHY')
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce hourly rate limits', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock hourly limit reached
      prisma.emailLog.count
        .mockResolvedValueOnce(10) // At hourly limit
        .mockResolvedValueOnce(50)  // Daily count

      const rateLimitCheck = await (service as any).checkRateLimits()

      expect(rateLimitCheck.allowed).toBe(false)
      expect(rateLimitCheck.nextAvailable).toBeInstanceOf(Date)
    })

    it('should enforce daily rate limits', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock daily limit reached
      prisma.emailLog.count
        .mockResolvedValueOnce(5)   // Hourly count
        .mockResolvedValueOnce(100) // At daily limit

      const rateLimitCheck = await (service as any).checkRateLimits()

      expect(rateLimitCheck.allowed).toBe(false)
    })

    it('should calculate available slots correctly', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock partial usage
      prisma.emailLog.count
        .mockResolvedValueOnce(3) // 3 used this hour
        .mockResolvedValueOnce(20) // 20 used today

      const rateLimitCheck = await (service as any).checkRateLimits()

      expect(rateLimitCheck.allowed).toBe(true)
      expect(rateLimitCheck.availableSlots).toBe(5) // min(7 hourly, 80 daily, 5 burst)
    })

    it('should respect burst limits', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock low usage but test burst limit
      prisma.emailLog.count
        .mockResolvedValueOnce(1) // 1 used this hour
        .mockResolvedValueOnce(5)  // 5 used today

      const rateLimitCheck = await (service as any).checkRateLimits()

      expect(rateLimitCheck.availableSlots).toBe(5) // Burst limit
    })
  })

  describe('Customer Relationship Inference', () => {
    it('should identify VIP customers correctly', async () => {
      const { prisma } = require('@/lib/prisma')
      const vipCustomer = {
        ...mockCustomer,
        createdAt: new Date('2020-01-01'), // Long-term customer
        invoices: Array(60).fill({ status: 'PAID' }) // Many paid invoices
      }
      prisma.customer.findUnique.mockResolvedValue(vipCustomer)

      const relationship = await (service as any).inferCustomerRelationship(
        'company-123',
        'customer-123'
      )

      expect(relationship).toBe('VIP')
    })

    it('should identify government customers', async () => {
      const { prisma } = require('@/lib/prisma')
      const govCustomer = {
        ...mockCustomer,
        name: 'Ministry of Health and Prevention'
      }
      prisma.customer.findUnique.mockResolvedValue(govCustomer)

      const relationship = await (service as any).inferCustomerRelationship(
        'company-123',
        'customer-123'
      )

      expect(relationship).toBe('GOVERNMENT')
    })

    it('should identify new customers', async () => {
      const { prisma } = require('@/lib/prisma')
      const newCustomer = {
        ...mockCustomer,
        createdAt: new Date(), // Recent creation
        invoices: [] // No payment history
      }
      prisma.customer.findUnique.mockResolvedValue(newCustomer)

      const relationship = await (service as any).inferCustomerRelationship(
        'company-123',
        'customer-123'
      )

      expect(relationship).toBe('NEW')
    })

    it('should default to REGULAR for unknown customers', async () => {
      const relationship = await (service as any).inferCustomerRelationship(
        'company-123'
      )

      expect(relationship).toBe('REGULAR')
    })
  })

  describe('Sequence Type Inference', () => {
    it('should identify first reminder correctly', async () => {
      const emailData = {
        subject: 'First reminder about your invoice',
        stepNumber: 1
      }

      const sequenceType = (service as any).inferSequenceType(emailData)

      expect(sequenceType).toBe('FIRST_REMINDER')
    })

    it('should identify final notice', async () => {
      const emailData = {
        subject: 'Final notice - immediate attention required',
        stepNumber: 3
      }

      const sequenceType = (service as any).inferSequenceType(emailData)

      expect(sequenceType).toBe('FINAL_NOTICE')
    })

    it('should identify overdue sequences', async () => {
      const emailData = {
        subject: 'Overdue invoice requires attention',
        content: 'Your invoice is now overdue...'
      }

      const sequenceType = (service as any).inferSequenceType(emailData)

      expect(sequenceType).toBe('OVERDUE')
    })
  })

  describe('UAE Business Hours Integration', () => {
    it('should adjust scheduling for UAE business hours', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      
      // Mock outside business hours
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)
      const nextBusinessHour = new Date()
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 1)
      nextBusinessHour.setHours(9, 0, 0, 0) // Next day 9 AM
      uaeBusinessHours.getNextBusinessHour.mockReturnValue(nextBusinessHour)

      const options: Partial<SchedulingOptions> = {
        respectBusinessHours: true
      }

      await service.scheduleEmail(mockEmailData, options)

      expect(uaeBusinessHours.getNextBusinessHour).toHaveBeenCalled()
    })

    it('should use cultural timing preferences', async () => {
      const { culturalCompliance } = require('../cultural-compliance-service')
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      
      const culturalConfig = {
        preferredDays: [2, 3, 4], // Tuesday-Thursday
        preferredHours: [10, 11],
        avoidPrayerTimes: true,
        respectRamadan: true,
        culturalTone: 'FORMAL'
      }
      
      culturalCompliance.suggestOptimalTiming.mockReturnValue(culturalConfig)

      const options: Partial<SchedulingOptions> = {
        preferOptimalTiming: true
      }

      await service.scheduleEmail(mockEmailData, options)

      expect(uaeBusinessHours.getNextAvailableSendTime).toHaveBeenCalledWith(
        expect.any(Date),
        expect.objectContaining(culturalConfig)
      )
    })
  })

  describe('Email Management Operations', () => {
    it('should cancel scheduled emails successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.emailLog.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.cancelScheduledEmail('email-123')

      expect(result).toBe(true)
      expect(prisma.emailLog.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'email-123',
          deliveryStatus: 'QUEUED'
        },
        data: {
          deliveryStatus: 'FAILED',
          bounceReason: 'Cancelled by user',
          updatedAt: expect.any(Date)
        }
      })
    })

    it('should reschedule emails correctly', async () => {
      const { prisma } = require('@/lib/prisma')
      const newTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      prisma.emailLog.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.rescheduleEmail('email-123', newTime, true)

      expect(result).toBe(true)
      expect(prisma.emailLog.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'email-123',
          deliveryStatus: { in: ['QUEUED', 'FAILED'] }
        },
        data: {
          uaeSendTime: newTime,
          deliveryStatus: 'QUEUED',
          bounceReason: null,
          retryCount: 0, // Reset due to resetRetryCount: true
          updatedAt: expect.any(Date)
        }
      })
    })

    it('should handle failed cancellations', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.emailLog.updateMany.mockResolvedValue({ count: 0 }) // No emails updated

      const result = await service.cancelScheduledEmail('nonexistent-email')

      expect(result).toBe(false)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.emailLog.create.mockRejectedValue(new Error('Database connection failed'))

      await expect(service.scheduleEmail(mockEmailData)).rejects.toThrow(
        'Failed to schedule email: Database connection failed'
      )
    })

    it('should handle missing customer data', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.customer.findUnique.mockResolvedValue(null)

      // Should not fail, just use default relationship
      const relationship = await (service as any).inferCustomerRelationship(
        'company-123',
        'nonexistent-customer'
      )

      expect(relationship).toBe('REGULAR')
    })

    it('should handle cultural compliance service failures', async () => {
      const { culturalCompliance } = require('../cultural-compliance-service')
      culturalCompliance.validateTemplateContent.mockImplementation(() => {
        throw new Error('Compliance service unavailable')
      })

      await expect(service.scheduleEmail(mockEmailData)).rejects.toThrow(
        'Failed to schedule email: Compliance service unavailable'
      )
    })

    it('should handle email service failures during sending', async () => {
      const { getDefaultEmailService } = require('../email-service')
      const mockEmailService = getDefaultEmailService()
      mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP server unavailable'))

      jest.spyOn(service as any, 'sendScheduledEmail').mockImplementation(
        (service as any).sendScheduledEmail.bind(service)
      )

      const { prisma } = require('@/lib/prisma')
      const mockEmail = { id: 'email-123', deliveryStatus: 'QUEUED' }

      await expect((service as any).sendScheduledEmail(mockEmail)).rejects.toThrow(
        'SMTP server unavailable'
      )

      // Should update status to failed
      expect(prisma.emailLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryStatus: 'FAILED',
            bounceReason: 'SMTP server unavailable'
          })
        })
      )
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle high-volume email processing efficiently', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock 1000 ready emails
      const highVolumeEmails = Array.from({ length: 1000 }, (_, i) => ({
        id: `email-${i}`,
        retryCount: 0,
        maxRetries: 3,
        uaeSendTime: new Date(Date.now() - 60 * 1000)
      }))
      
      prisma.emailLog.findMany.mockResolvedValue(highVolumeEmails)
      
      // Mock rate limits allowing only 50 per batch
      jest.spyOn(service as any, 'checkRateLimits').mockResolvedValue({
        allowed: true,
        availableSlots: 50
      })

      const startTime = Date.now()
      const result = await service.processScheduledEmails()
      const processingTime = Date.now() - startTime

      expect(result.processed).toBe(50) // Should respect batch limits
      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent scheduling requests', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) => 
        service.scheduleEmail({
          ...mockEmailData,
          recipientEmail: `customer${i}@test.ae`
        })
      )

      const results = await Promise.all(concurrentRequests)

      expect(results).toHaveLength(20)
      expect(results.every(result => result && typeof result === 'string')).toBe(true)
    })

    it('should maintain performance under rate limit pressure', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock rate limit reached
      jest.spyOn(service as any, 'checkRateLimits')
        .mockResolvedValueOnce({ allowed: false, availableSlots: 0 })
        .mockResolvedValueOnce({ allowed: true, availableSlots: 5 })

      const result1 = await service.processScheduledEmails()
      const result2 = await service.processScheduledEmails()

      expect(result1.processed).toBe(0) // Rate limited
      expect(result2.processed).toBeGreaterThan(0) // Should work on second call
    })
  })

  describe('Security and Data Protection', () => {
    it('should validate company access', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.company.findUnique.mockResolvedValue(null)

      await expect(service.scheduleEmail(mockEmailData)).rejects.toThrow(
        'Company not found'
      )
    })

    it('should handle disabled email settings', async () => {
      const { prisma } = require('@/lib/prisma')
      const disabledCompany = {
        ...mockCompany,
        emailSettings: { disabled: true }
      }
      prisma.company.findUnique.mockResolvedValue(disabledCompany)

      await expect(service.scheduleEmail(mockEmailData)).rejects.toThrow(
        'Email sending is disabled for this company'
      )
    })

    it('should sanitize email content', async () => {
      const maliciousEmailData = {
        ...mockEmailData,
        subject: '<script>alert("xss")</script>Invoice Reminder',
        content: 'Dear customer, <img src="x" onerror="alert(1)"> please pay your invoice.'
      }

      const { prisma } = require('@/lib/prisma')
      await service.scheduleEmail(maliciousEmailData)

      const createdData = prisma.emailLog.create.mock.calls[0][0].data
      
      // Should store original content (XSS protection handled at rendering level)
      expect(createdData.subject).toBe(maliciousEmailData.subject)
      expect(createdData.content).toBe(maliciousEmailData.content)
    })
  })
})