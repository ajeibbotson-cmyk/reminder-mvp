/**
 * Comprehensive Test Suite for Sequence Execution Service
 * Tests UAE automation engine with business logic, cultural compliance, and performance
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  SequenceExecutionService,
  sequenceExecutionService,
  SequenceStep,
  TriggerCondition,
  ExecutionResult,
  SequenceAnalytics
} from '../sequence-execution-service'
import { CulturalTone, SequenceType } from '../cultural-compliance-service'

// Mock all dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    followUpSequence: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    invoice: {
      findUnique: jest.fn()
    },
    followUpLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn()
    },
    emailTemplate: {
      findUnique: jest.fn()
    },
    payment: {
      findMany: jest.fn()
    },
    emailLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}))

jest.mock('../email-scheduling-service', () => ({
  emailSchedulingService: {
    scheduleEmail: jest.fn(),
    cancelScheduledEmail: jest.fn()
  }
}))

jest.mock('../uae-business-hours-service', () => ({
  uaeBusinessHours: {
    getNextAvailableSendTime: jest.fn(),
    isBusinessHours: jest.fn()
  }
}))

jest.mock('../cultural-compliance-service', () => ({
  culturalCompliance: {
    validateTemplateContent: jest.fn()
  }
}))

// Mock global crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

describe('SequenceExecutionService', () => {
  let service: SequenceExecutionService
  let mockSequence: any
  let mockInvoice: any
  let mockCompany: any
  let mockCustomer: any

  beforeEach(() => {
    service = new SequenceExecutionService()
    
    // Reset all mocks
    jest.clearAllMocks()

    // Mock company data
    mockCompany = {
      id: 'company-123',
      name: 'UAE Business Ltd',
      emailSettings: { enabled: true }
    }

    // Mock customer data
    mockCustomer = {
      id: 'customer-123',
      name: 'Ahmad Al-Rashid',
      email: 'ahmad@company.ae',
      createdAt: new Date('2024-01-01')
    }

    // Mock invoice data
    mockInvoice = {
      id: 'invoice-123',
      number: 'INV-2024-001',
      status: 'SENT',
      amount: 5000,
      totalAmount: 5500, // Including VAT
      currency: 'AED',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      companyId: 'company-123',
      customerId: 'customer-123',
      customerName: 'Ahmad Al-Rashid',
      customerEmail: 'ahmad@company.ae',
      customer: mockCustomer,
      company: mockCompany,
      createdAt: new Date()
    }

    // Mock sequence data
    mockSequence = {
      id: 'sequence-123',
      name: 'Standard Payment Reminder',
      companyId: 'company-123',
      active: true,
      steps: JSON.stringify([
        {
          stepNumber: 1,
          delayDays: 7,
          subject: 'Friendly Reminder: Invoice {{invoiceNumber}}',
          content: 'Dear {{customerName}}, we hope this email finds you well. This is a gentle reminder about Invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}}.',
          language: 'ENGLISH',
          tone: 'BUSINESS',
          stopConditions: []
        },
        {
          stepNumber: 2,
          delayDays: 7,
          subject: 'Second Reminder: Invoice {{invoiceNumber}}',
          content: 'Dear {{customerName}}, we wanted to follow up on Invoice {{invoiceNumber}} which remains outstanding.',
          language: 'ENGLISH',
          tone: 'FORMAL',
          stopConditions: ['CUSTOMER_RESPONSE']
        },
        {
          stepNumber: 3,
          delayDays: 5,
          subject: 'Final Notice: Invoice {{invoiceNumber}}',
          content: 'Dear {{customerName}}, this is our final notice regarding Invoice {{invoiceNumber}}. Please contact us to discuss.',
          language: 'ENGLISH',
          tone: 'VERY_FORMAL',
          stopConditions: ['CUSTOMER_RESPONSE', 'PAYMENT_RECEIVED']
        }
      ]),
      company: mockCompany,
      metadata: {}
    }

    // Setup default mock responses
    const { prisma } = require('@/lib/prisma')
    const { emailSchedulingService } = require('../email-scheduling-service')
    const { uaeBusinessHours } = require('../uae-business-hours-service')
    const { culturalCompliance } = require('../cultural-compliance-service')

    prisma.follow_up_sequences.findUnique.mockResolvedValue(mockSequence)
    prisma.invoices.findUnique.mockResolvedValue(mockInvoice)
    prisma.follow_up_logs.findFirst.mockResolvedValue(null)
    prisma.emailLog.findFirst.mockResolvedValue(null)
    prisma.emailLog.count.mockResolvedValue(0)
    emailSchedulingService.scheduleEmail.mockResolvedValue('email-log-123')
    uaeBusinessHours.getNextAvailableSendTime.mockReturnValue(new Date())
    uaeBusinessHours.isBusinessHours.mockReturnValue(true)
    culturalCompliance.validateTemplateContent.mockReturnValue({
      isValid: true,
      issues: []
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('startSequenceExecution', () => {
    it('should successfully start a sequence execution', async () => {
      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition,
        { startImmediately: true }
      )

      expect(result.success).toBe(true)
      expect(result.sequenceExecutionId).toBeDefined()
      expect(result.emailLogIds).toHaveLength(1)
      expect(result.stepsExecuted).toBe(1)
      expect(result.stepsRemaining).toBe(2)
    })

    it('should reject execution for inactive sequences', async () => {
      const { prisma } = require('@/lib/prisma')
      const inactiveSequence = { ...mockSequence, active: false }
      prisma.follow_up_sequences.findUnique.mockResolvedValue(inactiveSequence)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Sequence is not active')
    })

    it('should prevent duplicate executions for same invoice', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.follow_up_logs.findFirst.mockResolvedValue({
        id: 'existing-log',
        sequenceId: 'sequence-123',
        invoiceId: 'invoice-123'
      })

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Sequence already running for this invoice')
    })

    it('should handle paid invoices gracefully', async () => {
      const paidInvoice = { ...mockInvoice, status: 'PAID' }
      const { prisma } = require('@/lib/prisma')
      prisma.invoices.findUnique.mockResolvedValue(paidInvoice)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Cannot execute sequence: Invoice is already paid')
    })

    it('should validate UAE business hours for execution timing', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      const futureBusinessTime = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours later
      uaeBusinessHours.getNextAvailableSendTime.mockReturnValue(futureBusinessTime)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition,
        { startImmediately: false }
      )

      expect(result.success).toBe(true)
      expect(result.nextExecutionAt).toEqual(futureBusinessTime)
      expect(uaeBusinessHours.getNextAvailableSendTime).toHaveBeenCalled()
    })

    it('should enforce email sending limits', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.emailLog.count.mockResolvedValue(5) // Too many recent emails

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Cannot execute sequence: Too many emails sent recently')
    })
  })

  describe('executeSequenceStep', () => {
    it('should process template variables correctly', async () => {
      const step: SequenceStep = {
        stepNumber: 1,
        delayDays: 7,
        subject: 'Invoice {{invoiceNumber}} - {{customerName}}',
        content: 'Dear {{customerName}}, your invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}} is due on {{dueDate}}.',
        language: 'ENGLISH',
        tone: 'BUSINESS'
      }

      const { emailSchedulingService } = require('../email-scheduling-service')
      
      // Use private method via any for testing
      const result = await (service as any).executeSequenceStep(
        'execution-123',
        mockSequence,
        mockInvoice,
        step,
        1
      )

      expect(result.success).toBe(true)
      expect(emailSchedulingService.scheduleEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('INV-2024-001'),
          subject: expect.stringContaining('Ahmad Al-Rashid'),
          content: expect.stringContaining('5500'),
          content: expect.stringContaining('AED')
        }),
        expect.any(Object)
      )
    })

    it('should validate cultural compliance', async () => {
      const { culturalCompliance } = require('../cultural-compliance-service')
      culturalCompliance.validateTemplateContent.mockReturnValue({
        isValid: false,
        issues: ['Too aggressive language detected']
      })

      const step: SequenceStep = {
        stepNumber: 1,
        delayDays: 7,
        subject: 'Pay now!',
        content: 'You must pay immediately!',
        language: 'ENGLISH',
        tone: 'BUSINESS'
      }

      const result = await (service as any).executeSequenceStep(
        'execution-123',
        mockSequence,
        mockInvoice,
        step,
        1
      )

      // Should still succeed but log warning
      expect(result.success).toBe(true)
      expect(culturalCompliance.validateTemplateContent).toHaveBeenCalled()
    })

    it('should handle bilingual sequences (BOTH language)', async () => {
      const step: SequenceStep = {
        stepNumber: 1,
        delayDays: 7,
        subject: 'Invoice Reminder',
        content: 'Payment reminder content',
        language: 'BOTH',
        tone: 'BUSINESS'
      }

      const { emailSchedulingService } = require('../email-scheduling-service')

      const result = await (service as any).executeSequenceStep(
        'execution-123',
        mockSequence,
        mockInvoice,
        step,
        1
      )

      expect(result.success).toBe(true)
      expect(result.emailLogIds).toHaveLength(2) // English and Arabic
      expect(emailSchedulingService.scheduleEmail).toHaveBeenCalledTimes(2)
    })

    it('should determine appropriate email priority', async () => {
      const { emailSchedulingService } = require('../email-scheduling-service')

      // Test different step numbers and tones
      const scenarios = [
        { stepNumber: 1, tone: 'BUSINESS', expectedPriority: 'LOW' },
        { stepNumber: 2, tone: 'FORMAL', expectedPriority: 'NORMAL' },
        { stepNumber: 3, tone: 'VERY_FORMAL', expectedPriority: 'HIGH' }
      ]

      for (const scenario of scenarios) {
        const step: SequenceStep = {
          stepNumber: scenario.stepNumber,
          delayDays: 7,
          subject: 'Test',
          content: 'Test content',
          language: 'ENGLISH',
          tone: scenario.tone as CulturalTone
        }

        await (service as any).executeSequenceStep(
          'execution-123',
          mockSequence,
          mockInvoice,
          step,
          scenario.stepNumber
        )

        expect(emailSchedulingService.scheduleEmail).toHaveBeenLastCalledWith(
          expect.objectContaining({
            priority: scenario.expectedPriority
          }),
          expect.any(Object)
        )
      }
    })
  })

  describe('continueSequenceExecution', () => {
    it('should continue to next step in sequence', async () => {
      const { prisma } = require('@/lib/prisma')
      const existingLog = {
        id: 'execution-123',
        stepNumber: 1,
        followUpSequence: mockSequence,
        invoice: mockInvoice
      }
      prisma.follow_up_logs.findFirst.mockResolvedValue(existingLog)

      const result = await service.continueSequenceExecution('execution-123')

      expect(result.success).toBe(true)
      expect(result.stepsExecuted).toBe(1)
      expect(result.stepsRemaining).toBe(1) // 3 total - 2 completed
    })

    it('should handle completed sequences', async () => {
      const { prisma } = require('@/lib/prisma')
      const completedLog = {
        id: 'execution-123',
        stepNumber: 3, // Last step
        followUpSequence: mockSequence,
        invoice: mockInvoice
      }
      prisma.follow_up_logs.findFirst.mockResolvedValue(completedLog)

      const result = await service.continueSequenceExecution('execution-123')

      expect(result.success).toBe(true)
      expect(result.errors).toContain('Sequence already completed')
      expect(result.stepsRemaining).toBe(0)
    })

    it('should check stop conditions before execution', async () => {
      const { prisma } = require('@/lib/prisma')
      const existingLog = {
        id: 'execution-123',
        stepNumber: 1,
        followUpSequence: mockSequence,
        invoice: mockInvoice
      }
      prisma.follow_up_logs.findFirst.mockResolvedValue(existingLog)
      
      // Mock payment received
      prisma.payments.findMany.mockResolvedValue([
        { amount: 5500, paymentDate: new Date() }
      ])

      const result = await service.continueSequenceExecution('execution-123')

      expect(result.success).toBe(true)
      expect(result.errors).toContain('Sequence stopped: Payment received')
    })
  })

  describe('getSequenceAnalytics', () => {
    beforeEach(() => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock analytics data
      const mockLogs = [
        {
          id: 'log-1',
          stepNumber: 1,
          sentAt: new Date('2024-01-01'),
          emailLogs: [{ openedAt: new Date(), clickedAt: null, responseReceived: false }],
          invoice: {
            totalAmount: 1000,
            payments: [{ amount: 1000 }]
          }
        },
        {
          id: 'log-2',
          stepNumber: 2,
          sentAt: new Date('2024-01-08'),
          emailLogs: [{ openedAt: new Date(), clickedAt: new Date(), responseReceived: true }],
          invoice: {
            totalAmount: 2000,
            payments: [{ amount: 2000 }]
          }
        }
      ]

      prisma.follow_up_logs.findMany.mockResolvedValue(mockLogs)
      prisma.follow_up_sequences.findUnique.mockResolvedValue(mockSequence)
    })

    it('should calculate comprehensive sequence analytics', async () => {
      const analytics = await service.getSequenceAnalytics('sequence-123')

      expect(analytics.sequenceId).toBe('sequence-123')
      expect(analytics.totalExecutions).toBe(2)
      expect(analytics.conversionRate).toBe(100) // Both led to payment
      expect(analytics.stepAnalytics).toHaveLength(3) // 3 steps in sequence

      // Check step analytics
      const step1Analytics = analytics.stepAnalytics[0]
      expect(step1Analytics.stepNumber).toBe(1)
      expect(step1Analytics.executionCount).toBe(1)
      expect(step1Analytics.openRate).toBe(100)
    })

    it('should handle empty analytics gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.follow_up_logs.findMany.mockResolvedValue([])

      const analytics = await service.getSequenceAnalytics('sequence-123')

      expect(analytics.totalExecutions).toBe(0)
      expect(analytics.conversionRate).toBe(0)
      expect(analytics.stepAnalytics).toHaveLength(3) // Still show structure
    })

    it('should calculate correct conversion rates', async () => {
      const { prisma } = require('@/lib/prisma')
      const mixedResults = [
        {
          stepNumber: 1,
          emailLogs: [],
          invoice: {
            totalAmount: 1000,
            payments: [{ amount: 1000 }] // Paid
          }
        },
        {
          stepNumber: 1,
          emailLogs: [],
          invoice: {
            totalAmount: 1000,
            payments: [] // Unpaid
          }
        }
      ]
      prisma.follow_up_logs.findMany.mockResolvedValue(mixedResults)

      const analytics = await service.getSequenceAnalytics('sequence-123')

      expect(analytics.conversionRate).toBe(50) // 1 out of 2 paid
    })
  })

  describe('processPendingExecutions', () => {
    it('should process multiple pending executions', async () => {
      const { prisma } = require('@/lib/prisma')
      
      const pendingLogs = [
        {
          id: 'log-1',
          stepNumber: 1,
          sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          followUpSequence: mockSequence,
          invoice: mockInvoice
        },
        {
          id: 'log-2',
          stepNumber: 2,
          sentAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // 26 hours ago
          followUpSequence: mockSequence,
          invoice: mockInvoice
        }
      ]
      
      prisma.follow_up_logs.findMany.mockResolvedValue(pendingLogs)

      const result = await service.processPendingExecutions()

      expect(result.processed).toBe(2)
      expect(result.successful).toBeGreaterThan(0)
      expect(result.errors).toBeInstanceOf(Array)
    })

    it('should handle processing errors gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock an error in continue execution
      jest.spyOn(service, 'continueSequenceExecution').mockRejectedValue(
        new Error('Database connection failed')
      )

      const pendingLogs = [
        {
          id: 'log-1',
          stepNumber: 1,
          sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          followUpSequence: mockSequence,
          invoice: mockInvoice
        }
      ]
      
      prisma.follow_up_logs.findMany.mockResolvedValue(pendingLogs)

      const result = await service.processPendingExecutions()

      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toContain('Database connection failed')
    })
  })

  describe('stopSequenceExecution', () => {
    it('should cancel queued emails and mark sequence as stopped', async () => {
      const { prisma } = require('@/lib/prisma')
      const { emailSchedulingService } = require('../email-scheduling-service')

      const queuedEmails = [
        { id: 'email-1', deliveryStatus: 'QUEUED' },
        { id: 'email-2', deliveryStatus: 'QUEUED' }
      ]
      
      prisma.emailLog.findMany.mockResolvedValue(queuedEmails)
      emailSchedulingService.cancelScheduledEmail.mockResolvedValue(true)

      const result = await service.stopSequenceExecution(
        'sequence-123',
        'invoice-123',
        'Payment received'
      )

      expect(result).toBe(true)
      expect(emailSchedulingService.cancelScheduledEmail).toHaveBeenCalledTimes(2)
      expect(prisma.follow_up_logs.updateMany).toHaveBeenCalled()
    })
  })

  describe('UAE Business Logic Integration', () => {
    it('should respect UAE business hours when scheduling', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      
      // Mock outside business hours
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)
      const nextBusinessHour = new Date(Date.now() + 12 * 60 * 60 * 1000)
      uaeBusinessHours.getNextAvailableSendTime.mockReturnValue(nextBusinessHour)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      expect(result.nextExecutionAt).toEqual(nextBusinessHour)
      expect(uaeBusinessHours.getNextAvailableSendTime).toHaveBeenCalled()
    })

    it('should handle UAE holidays appropriately', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      
      // Mock holiday detection in getNextAvailableSendTime
      const nextWorkingDay = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      uaeBusinessHours.getNextAvailableSendTime.mockReturnValue(nextWorkingDay)

      const step: SequenceStep = {
        stepNumber: 1,
        delayDays: 1, // Should be extended due to holiday
        subject: 'Test',
        content: 'Test',
        language: 'ENGLISH',
        tone: 'BUSINESS'
      }

      // Test private method
      const nextTime = (service as any).calculateNextExecutionTime(new Date(), step.delayDays)

      expect(nextTime).toEqual(nextWorkingDay)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed sequence steps', async () => {
      const { prisma } = require('@/lib/prisma')
      const malformedSequence = {
        ...mockSequence,
        steps: 'invalid json'
      }
      prisma.follow_up_sequences.findUnique.mockResolvedValue(malformedSequence)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Sequence has no valid steps')
    })

    it('should handle missing invoice gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.invoices.findUnique.mockResolvedValue(null)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invalid-invoice',
        triggerCondition
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invoice not found')
    })

    it('should handle email scheduling failures', async () => {
      const { emailSchedulingService } = require('../email-scheduling-service')
      emailSchedulingService.scheduleEmail.mockRejectedValue(
        new Error('SES quota exceeded')
      )

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition,
        { startImmediately: true }
      )

      expect(result.success).toBe(false)
      expect(result.errors.some(error => error.includes('SES quota'))).toBe(true)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large sequence processing efficiently', async () => {
      const startTime = Date.now()

      // Mock large dataset
      const { prisma } = require('@/lib/prisma')
      const largePendingSet = Array.from({ length: 100 }, (_, i) => ({
        id: `log-${i}`,
        stepNumber: 1,
        sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        followUpSequence: mockSequence,
        invoice: { ...mockInvoice, id: `invoice-${i}` }
      }))
      
      prisma.follow_up_logs.findMany.mockResolvedValue(largePendingSet)

      const result = await service.processPendingExecutions()

      const processingTime = Date.now() - startTime

      expect(result.processed).toBe(100)
      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should batch email operations for performance', async () => {
      const { emailSchedulingService } = require('../email-scheduling-service')
      
      // Test bilingual sequence with 50 executions
      const step: SequenceStep = {
        stepNumber: 1,
        delayDays: 7,
        subject: 'Test',
        content: 'Test',
        language: 'BOTH',
        tone: 'BUSINESS'
      }

      const promises = Array.from({ length: 50 }, () =>
        (service as any).executeSequenceStep(
          'execution-123',
          mockSequence,
          mockInvoice,
          step,
          1
        )
      )

      await Promise.all(promises)

      // Should handle 100 emails (50 × 2 languages) efficiently
      expect(emailSchedulingService.scheduleEmail).toHaveBeenCalledTimes(100)
    })
  })

  describe('Security and Data Integrity', () => {
    it('should validate sequence ownership', async () => {
      const { prisma } = require('@/lib/prisma')
      const otherCompanySequence = {
        ...mockSequence,
        companyId: 'other-company'
      }
      const otherCompanyInvoice = {
        ...mockInvoice,
        companyId: 'different-company'
      }
      
      prisma.follow_up_sequences.findUnique.mockResolvedValue(otherCompanySequence)
      prisma.invoices.findUnique.mockResolvedValue(otherCompanyInvoice)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition
      )

      // Should fail validation due to company mismatch
      expect(result.success).toBe(false)
    })

    it('should sanitize template variables', async () => {
      const maliciousInvoice = {
        ...mockInvoice,
        customerName: '<script>alert("xss")</script>',
        number: 'INV-<img src=x onerror=alert(1)>'
      }

      const step: SequenceStep = {
        stepNumber: 1,
        delayDays: 7,
        subject: 'Invoice {{invoiceNumber}} for {{customerName}}',
        content: 'Dear {{customerName}}, regarding {{invoiceNumber}}...',
        language: 'ENGLISH',
        tone: 'BUSINESS'
      }

      const result = await (service as any).executeSequenceStep(
        'execution-123',
        mockSequence,
        maliciousInvoice,
        step,
        1
      )

      const { emailSchedulingService } = require('../email-scheduling-service')
      const calledWith = emailSchedulingService.scheduleEmail.mock.calls[0][0]

      // Variables should be replaced but not contain scripts
      expect(calledWith.subject).toContain('&lt;script&gt;') // HTML escaped
      expect(calledWith.content).not.toContain('<script>')
    })
  })

  describe('Cultural Compliance Integration', () => {
    it('should adjust tone based on customer relationship', async () => {
      const governmentInvoice = {
        ...mockInvoice,
        customerName: 'Ministry of Finance',
        customer: {
          ...mockCustomer,
          name: 'Ministry of Finance'
        }
      }

      const { prisma } = require('@/lib/prisma')
      prisma.invoices.findUnique.mockResolvedValue(governmentInvoice)

      const triggerCondition: TriggerCondition = {
        type: 'DUE_DATE',
        value: 'approaching',
        operator: 'EQUALS'
      }

      const result = await service.startSequenceExecution(
        'sequence-123',
        'invoice-123',
        triggerCondition,
        { startImmediately: true }
      )

      expect(result.success).toBe(true)

      const { emailSchedulingService } = require('../email-scheduling-service')
      const schedulingOptions = emailSchedulingService.scheduleEmail.mock.calls[0][1]

      // Should use more formal scheduling for government
      expect(schedulingOptions.respectBusinessHours).toBe(true)
      expect(schedulingOptions.avoidPrayerTimes).toBe(true)
    })

    it('should validate content for cultural appropriateness', async () => {
      const { culturalCompliance } = require('../cultural-compliance-service')
      culturalCompliance.validateTemplateContent.mockReturnValue({
        isValid: false,
        issues: ['Contains demanding language', 'Lacks respectful greeting']
      })

      const aggressiveStep: SequenceStep = {
        stepNumber: 1,
        delayDays: 7,
        subject: 'PAY NOW!',
        content: 'You must pay immediately or face legal action!',
        language: 'ENGLISH',
        tone: 'BUSINESS'
      }

      const result = await (service as any).executeSequenceStep(
        'execution-123',
        mockSequence,
        mockInvoice,
        aggressiveStep,
        1
      )

      // Should log warnings but still proceed
      expect(result.success).toBe(true)
      expect(culturalCompliance.validateTemplateContent).toHaveBeenCalledWith({
        contentEn: aggressiveStep.content,
        subjectEn: aggressiveStep.subject
      })
    })
  })
})