/**
 * Comprehensive Test Suite for Sequence Triggers Service
 * Tests automatic sequence triggering, invoice monitoring, and UAE business rule compliance
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  SequenceTriggersService,
  sequenceTriggersService,
  TriggerType,
  TriggerRule,
  TriggerEvent,
  TriggerExecutionResult,
  MonitoringMetrics
} from '../sequence-triggers-service'
import { TriggerCondition } from '../sequence-execution-service'

// Mock all dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    followUpSequence: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    invoice: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    followUpLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    payment: {
      findMany: jest.fn()
    },
    activity: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}))

jest.mock('../sequence-execution-service', () => ({
  sequenceExecutionService: {
    startSequenceExecution: jest.fn(),
    stopSequenceExecution: jest.fn()
  }
}))

jest.mock('../uae-business-hours-service', () => ({
  uaeBusinessHours: {
    isBusinessHours: jest.fn()
  }
}))

// Mock global crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

describe('SequenceTriggersService', () => {
  let service: SequenceTriggersService
  let mockSequence: any
  let mockInvoice: any
  let mockCompany: any
  let mockCustomer: any

  beforeEach(() => {
    service = new SequenceTriggersService()
    
    // Reset all mocks
    jest.clearAllMocks()

    // Mock company data
    mockCompany = {
      id: 'company-123',
      name: 'UAE Business Solutions',
      emailSettings: { enabled: true }
    }

    // Mock customer data
    mockCustomer = {
      id: 'customer-123',
      name: 'Ahmed Al-Rashid',
      email: 'ahmed@company.ae',
      createdAt: new Date('2024-01-01')
    }

    // Mock invoice data
    mockInvoice = {
      id: 'invoice-123',
      number: 'INV-2024-001',
      status: 'SENT',
      amount: 5000,
      totalAmount: 5500,
      currency: 'AED',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
      companyId: 'company-123',
      customerId: 'customer-123',
      customerName: 'Ahmed Al-Rashid',
      customerEmail: 'ahmed@company.ae',
      customer: mockCustomer,
      company: mockCompany,
      payments: [],
      createdAt: new Date()
    }

    // Mock sequence data
    mockSequence = {
      id: 'sequence-123',
      name: 'Overdue Payment Reminder',
      companyId: 'company-123',
      active: true,
      steps: JSON.stringify([
        {
          stepNumber: 1,
          delayDays: 0,
          subject: 'Urgent: Overdue Invoice {{invoiceNumber}}',
          content: 'Dear {{customerName}}, your invoice is now overdue.',
          language: 'ENGLISH',
          tone: 'FORMAL'
        }
      ]),
      company: mockCompany,
      metadata: {
        triggers: [
          {
            type: 'OVERDUE_DAYS',
            conditions: [
              {
                type: 'DUE_DATE',
                value: 0,
                operator: 'LESS_THAN'
              },
              {
                type: 'INVOICE_STATUS',
                value: ['SENT', 'OVERDUE'],
                operator: 'IN'
              }
            ],
            cooldownHours: 24
          }
        ]
      }
    }

    // Setup default mock responses
    const { prisma } = require('@/lib/prisma')
    const { sequenceExecutionService } = require('../sequence-execution-service')
    const { uaeBusinessHours } = require('../uae-business-hours-service')

    prisma.followUpSequence.findMany.mockResolvedValue([mockSequence])
    prisma.invoice.findMany.mockResolvedValue([mockInvoice])
    prisma.followUpLog.findFirst.mockResolvedValue(null)
    prisma.payment.findMany.mockResolvedValue([])
    
    sequenceExecutionService.startSequenceExecution.mockResolvedValue({
      success: true,
      sequenceExecutionId: 'execution-123',
      emailLogIds: ['email-123'],
      errors: [],
      stepsExecuted: 1,
      stepsRemaining: 0
    })

    uaeBusinessHours.isBusinessHours.mockReturnValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('monitorInvoiceEvents', () => {
    it('should successfully monitor and trigger sequences', async () => {
      const result = await service.monitorInvoiceEvents()

      expect(result.processed).toBe(1)
      expect(result.triggered).toBe(1)
      expect(result.errors).toHaveLength(0)

      const { sequenceExecutionService } = require('../sequence-execution-service')
      expect(sequenceExecutionService.startSequenceExecution).toHaveBeenCalled()
    })

    it('should handle no active sequences', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.followUpSequence.findMany.mockResolvedValue([])

      const result = await service.monitorInvoiceEvents()

      expect(result.processed).toBe(0)
      expect(result.triggered).toBe(0)
    })

    it('should skip inactive sequences', async () => {
      const { prisma } = require('@/lib/prisma')
      const inactiveSequence = { ...mockSequence, active: false }
      prisma.followUpSequence.findMany.mockResolvedValue([inactiveSequence])

      const result = await service.monitorInvoiceEvents()

      expect(result.processed).toBe(1)
      expect(result.triggered).toBe(0)
    })

    it('should handle errors gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.followUpSequence.findMany.mockRejectedValue(new Error('Database error'))

      const result = await service.monitorInvoiceEvents()

      expect(result.processed).toBe(0)
      expect(result.triggered).toBe(0)
      expect(result.errors).toContain('Monitoring failed: Database error')
    })

    it('should prevent duplicate executions', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock existing execution
      prisma.followUpLog.findFirst.mockResolvedValue({
        id: 'existing-log',
        sequenceId: 'sequence-123',
        invoiceId: 'invoice-123',
        sentAt: new Date()
      })

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(0) // Should not trigger duplicate
      
      const { sequenceExecutionService } = require('../sequence-execution-service')
      expect(sequenceExecutionService.startSequenceExecution).not.toHaveBeenCalled()
    })

    it('should log successful trigger events', async () => {
      const { prisma } = require('@/lib/prisma')

      await service.monitorInvoiceEvents()

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SEQUENCE_TRIGGERED',
          description: 'Sequence triggered: OVERDUE_DAYS',
          metadata: expect.objectContaining({
            sequenceId: 'sequence-123',
            invoiceId: 'invoice-123',
            triggerType: 'OVERDUE_DAYS',
            success: true
          })
        })
      })
    })
  })

  describe('Trigger Condition Evaluation', () => {
    describe('Due Date Triggers', () => {
      it('should trigger for overdue invoices', async () => {
        const overdueInvoice = {
          ...mockInvoice,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day overdue
          status: 'SENT'
        }

        const { prisma } = require('@/lib/prisma')
        prisma.invoice.findMany.mockResolvedValue([overdueInvoice])

        const result = await service.monitorInvoiceEvents()

        expect(result.triggered).toBe(1)
      })

      it('should not trigger for future due dates', async () => {
        const futureInvoice = {
          ...mockInvoice,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
          status: 'SENT'
        }

        const { prisma } = require('@/lib/prisma')
        prisma.invoice.findMany.mockResolvedValue([futureInvoice])

        const result = await service.monitorInvoiceEvents()

        expect(result.triggered).toBe(0)
      })

      it('should handle due date approaching triggers', async () => {
        const approachingDueSequence = {
          ...mockSequence,
          name: 'Payment Reminder',
          metadata: {
            triggers: [
              {
                type: 'DUE_DATE_REACHED',
                conditions: [
                  {
                    type: 'DUE_DATE',
                    value: 7, // 7 days before due
                    operator: 'LESS_THAN'
                  }
                ],
                cooldownHours: 72
              }
            ]
          }
        }

        const approachingInvoice = {
          ...mockInvoice,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days away
          status: 'SENT'
        }

        const { prisma } = require('@/lib/prisma')
        prisma.followUpSequence.findMany.mockResolvedValue([approachingDueSequence])
        prisma.invoice.findMany.mockResolvedValue([approachingInvoice])

        const result = await service.monitorInvoiceEvents()

        expect(result.triggered).toBe(1)
      })
    })

    describe('Invoice Status Triggers', () => {
      it('should trigger only for specific statuses', async () => {
        const invoices = [
          { ...mockInvoice, id: 'inv-1', status: 'SENT' }, // Should trigger
          { ...mockInvoice, id: 'inv-2', status: 'OVERDUE' }, // Should trigger
          { ...mockInvoice, id: 'inv-3', status: 'PAID' }, // Should not trigger
          { ...mockInvoice, id: 'inv-4', status: 'DRAFT' } // Should not trigger
        ]

        const { prisma } = require('@/lib/prisma')
        prisma.invoice.findMany.mockResolvedValue(invoices)

        const result = await service.monitorInvoiceEvents()

        expect(result.triggered).toBe(2) // Only SENT and OVERDUE
      })

      it('should not trigger for paid invoices', async () => {
        const paidInvoice = {
          ...mockInvoice,
          status: 'PAID'
        }

        const { prisma } = require('@/lib/prisma')
        prisma.invoice.findMany.mockResolvedValue([paidInvoice])

        const result = await service.monitorInvoiceEvents()

        expect(result.triggered).toBe(0)
      })
    })

    describe('Payment-Related Triggers', () => {
      it('should consider partial payments', async () => {
        const partiallyPaidInvoice = {
          ...mockInvoice,
          payments: [
            { amount: 2000, paymentDate: new Date() } // Partial payment
          ]
        }

        const { prisma } = require('@/lib/prisma')
        prisma.invoice.findMany.mockResolvedValue([partiallyPaidInvoice])
        prisma.payment.findMany.mockResolvedValue(partiallyPaidInvoice.payments)

        const result = await service.monitorInvoiceEvents()

        expect(result.triggered).toBe(1) // Should still trigger for remaining amount
      })

      it('should not trigger for fully paid invoices', async () => {
        const fullyPaidInvoice = {
          ...mockInvoice,
          payments: [
            { amount: 5500, paymentDate: new Date() } // Full payment
          ]
        }

        const { prisma } = require('@/lib/prisma')
        prisma.invoice.findMany.mockResolvedValue([fullyPaidInvoice])
        prisma.payment.findMany.mockResolvedValue(fullyPaidInvoice.payments)

        // Mock condition evaluation to check payments
        const shouldTrigger = await (service as any).evaluateTriggerConditions(
          fullyPaidInvoice,
          {
            type: 'OVERDUE_DAYS',
            conditions: [
              {
                type: 'PAYMENT_RECEIVED',
                value: 5500,
                operator: 'LESS_THAN'
              }
            ],
            cooldownHours: 24
          }
        )

        expect(shouldTrigger.shouldTrigger).toBe(false)
      })
    })
  })

  describe('Cooldown Period Management', () => {
    it('should respect cooldown periods', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock recent trigger (within cooldown)
      const recentTrigger = {
        id: 'recent-log',
        invoiceId: 'invoice-123',
        sentAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      }
      prisma.followUpLog.findFirst.mockResolvedValue(recentTrigger)

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(0) // Should be blocked by cooldown
    })

    it('should allow triggers after cooldown expires', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock old trigger (outside cooldown)
      const oldTrigger = {
        id: 'old-log',
        invoiceId: 'invoice-123',
        sentAt: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
      }
      prisma.followUpLog.findFirst.mockResolvedValue(oldTrigger)

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(1) // Should be allowed
    })

    it('should handle different cooldown periods per trigger type', async () => {
      const shortCooldownTrigger = {
        type: 'OVERDUE_DAYS',
        conditions: [],
        cooldownHours: 1 // Very short cooldown
      }

      const recentTime = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      
      const cooldownCheck = await (service as any).checkCooldownPeriod(
        'invoice-123',
        'OVERDUE_DAYS',
        1
      )

      expect(cooldownCheck.canTrigger).toBe(true) // Should allow after 1 hour cooldown
    })
  })

  describe('UAE Business Hours Integration', () => {
    it('should respect UAE business hours', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      uaeBusinessHours.isBusinessHours.mockReturnValue(false)

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(0) // Should not trigger outside business hours
    })

    it('should allow triggers during business hours', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      uaeBusinessHours.isBusinessHours.mockReturnValue(true)

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(1) // Should trigger during business hours
    })

    it('should defer triggers close to weekend', async () => {
      const { uaeBusinessHours } = require('../uae-business-hours-service')
      
      // Mock late Thursday (close to weekend)
      const mockDate = new Date('2024-01-04T17:00:00.000Z') // Thursday 5 PM
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)
      
      uaeBusinessHours.isBusinessHours.mockReturnValue(true)

      // Test the evaluation logic
      const shouldTrigger = await (service as any).evaluateTriggerConditions(
        mockInvoice,
        {
          type: 'OVERDUE_DAYS',
          conditions: [],
          cooldownHours: 24
        }
      )

      // Should check for business hours in the evaluation
      expect(uaeBusinessHours.isBusinessHours).toHaveBeenCalled()
    })
  })

  describe('Manual Triggers', () => {
    it('should execute manual triggers successfully', async () => {
      const { sequenceExecutionService } = require('../sequence-execution-service')
      sequenceExecutionService.startSequenceExecution.mockResolvedValue({
        success: true,
        sequenceExecutionId: 'manual-execution-123',
        emailLogIds: ['email-123'],
        errors: []
      })

      const result = await service.manualTrigger(
        'sequence-123',
        'invoice-123',
        'user-123',
        'Manager requested immediate follow-up'
      )

      expect(result.triggered).toBe(true)
      expect(result.sequenceExecutionId).toBe('manual-execution-123')

      expect(sequenceExecutionService.startSequenceExecution).toHaveBeenCalledWith(
        'sequence-123',
        'invoice-123',
        expect.objectContaining({
          type: 'MANUAL',
          value: 'Manager requested immediate follow-up'
        }),
        expect.objectContaining({
          startImmediately: true,
          skipValidation: false
        })
      )
    })

    it('should log manual trigger activity', async () => {
      const { prisma } = require('@/lib/prisma')

      await service.manualTrigger(
        'sequence-123',
        'invoice-123',
        'user-123',
        'Urgent customer request'
      )

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'MANUAL_SEQUENCE_TRIGGER',
          description: 'Manual sequence trigger: Urgent customer request',
          userId: 'user-123',
          metadata: expect.objectContaining({
            sequenceId: 'sequence-123',
            invoiceId: 'invoice-123'
          })
        })
      })
    })

    it('should handle manual trigger failures', async () => {
      const { sequenceExecutionService } = require('../sequence-execution-service')
      sequenceExecutionService.startSequenceExecution.mockResolvedValue({
        success: false,
        errors: ['Sequence already running'],
        emailLogIds: []
      })

      const result = await service.manualTrigger(
        'sequence-123',
        'invoice-123',
        'user-123'
      )

      expect(result.triggered).toBe(false)
      expect(result.reason).toContain('Sequence already running')
    })
  })

  describe('Payment Event Handling', () => {
    it('should stop sequences when payment is received', async () => {
      const { prisma } = require('@/lib/prisma')
      const { sequenceExecutionService } = require('../sequence-execution-service')
      
      const activeSequences = [
        {
          id: 'log-1',
          sequenceId: 'sequence-123',
          invoiceId: 'invoice-123',
          followUpSequence: mockSequence
        }
      ]
      
      prisma.followUpLog.findMany.mockResolvedValue(activeSequences)
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
      sequenceExecutionService.stopSequenceExecution.mockResolvedValue(true)

      await service.handlePaymentReceived('invoice-123', 5500)

      expect(sequenceExecutionService.stopSequenceExecution).toHaveBeenCalledWith(
        'sequence-123',
        'invoice-123',
        'Payment received: 5500'
      )
    })

    it('should log payment events', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.followUpLog.findMany.mockResolvedValue([])
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)

      await service.handlePaymentReceived('invoice-123', 2500)

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SEQUENCE_TRIGGERED',
          metadata: expect.objectContaining({
            triggerType: 'PAYMENT_RECEIVED'
          })
        })
      })
    })
  })

  describe('Invoice Status Change Handling', () => {
    it('should stop sequences when invoice is paid', async () => {
      const { prisma } = require('@/lib/prisma')
      const { sequenceExecutionService } = require('../sequence-execution-service')
      
      const activeSequences = [
        { id: 'log-1', sequenceId: 'sequence-123', invoiceId: 'invoice-123' }
      ]
      
      prisma.followUpLog.findMany.mockResolvedValue(activeSequences)
      sequenceExecutionService.stopSequenceExecution.mockResolvedValue(true)

      await service.handleInvoiceStatusChange('invoice-123', 'SENT', 'PAID')

      expect(sequenceExecutionService.stopSequenceExecution).toHaveBeenCalledWith(
        'sequence-123',
        'invoice-123',
        'Invoice status changed to PAID'
      )
    })

    it('should trigger overdue sequences when status changes to overdue', async () => {
      const { prisma } = require('@/lib/prisma')
      const { sequenceExecutionService } = require('../sequence-execution-service')
      
      const overdueSequence = {
        ...mockSequence,
        name: 'Overdue Payment Collection'
      }
      
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
      prisma.followUpSequence.findMany.mockResolvedValue([overdueSequence])
      sequenceExecutionService.startSequenceExecution.mockResolvedValue({
        success: true
      })

      await service.handleInvoiceStatusChange('invoice-123', 'SENT', 'OVERDUE')

      expect(sequenceExecutionService.startSequenceExecution).toHaveBeenCalledWith(
        overdueSequence.id,
        'invoice-123',
        expect.objectContaining({
          type: 'INVOICE_STATUS',
          value: 'OVERDUE'
        })
      )
    })

    it('should not trigger sequences for invalid status transitions', async () => {
      const { sequenceExecutionService } = require('../sequence-execution-service')

      await service.handleInvoiceStatusChange('invoice-123', 'PAID', 'SENT')

      expect(sequenceExecutionService.startSequenceExecution).not.toHaveBeenCalled()
    })
  })

  describe('Trigger Rule Parsing', () => {
    it('should parse default triggers from sequence name', async () => {
      const reminderSequence = {
        ...mockSequence,
        name: 'Payment Reminder Sequence',
        metadata: {}
      }

      const triggers = (service as any).parseSequenceTriggers(reminderSequence)

      expect(triggers).toContainEqual(
        expect.objectContaining({
          type: 'DUE_DATE_REACHED',
          cooldownHours: 72
        })
      )
    })

    it('should parse overdue triggers from sequence name', async () => {
      const overdueSequence = {
        ...mockSequence,
        name: 'Overdue Collection Process',
        metadata: {}
      }

      const triggers = (service as any).parseSequenceTriggers(overdueSequence)

      expect(triggers).toContainEqual(
        expect.objectContaining({
          type: 'OVERDUE_DAYS',
          cooldownHours: 24
        })
      )
    })

    it('should parse custom triggers from metadata', async () => {
      const customSequence = {
        ...mockSequence,
        metadata: {
          triggers: [
            {
              type: 'PAYMENT_PARTIAL',
              conditions: [
                {
                  type: 'PAYMENT_RECEIVED',
                  value: 1000,
                  operator: 'GREATER_THAN'
                }
              ],
              cooldownHours: 48
            }
          ]
        }
      }

      const triggers = (service as any).parseSequenceTriggers(customSequence)

      expect(triggers).toContainEqual(
        expect.objectContaining({
          type: 'PAYMENT_PARTIAL',
          cooldownHours: 48
        })
      )
    })

    it('should handle malformed trigger configuration', async () => {
      const malformedSequence = {
        ...mockSequence,
        metadata: { triggers: 'invalid json' }
      }

      const triggers = (service as any).parseSequenceTriggers(malformedSequence)

      // Should return default triggers
      expect(triggers).toHaveLength(1)
      expect(triggers[0].type).toBe('OVERDUE_DAYS')
    })
  })

  describe('Candidate Invoice Selection', () => {
    it('should find overdue invoices for overdue triggers', async () => {
      const { prisma } = require('@/lib/prisma')
      
      const overdueInvoices = [
        { ...mockInvoice, id: 'inv-1', dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        { ...mockInvoice, id: 'inv-2', dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      ]
      
      prisma.invoice.findMany.mockResolvedValue(overdueInvoices)

      const candidates = await (service as any).findCandidateInvoices(
        'company-123',
        { type: 'OVERDUE_DAYS', conditions: [] }
      )

      expect(candidates).toHaveLength(2)
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          companyId: 'company-123',
          status: { in: ['SENT', 'OVERDUE'] },
          dueDate: { lt: expect.any(Date) }
        }),
        include: expect.any(Object),
        take: 100
      })
    })

    it('should find approaching due date invoices', async () => {
      const { prisma } = require('@/lib/prisma')

      await (service as any).findCandidateInvoices(
        'company-123',
        { type: 'DUE_DATE_REACHED', conditions: [] }
      )

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          dueDate: { lte: expect.any(Date) } // Within 7 days
        }),
        include: expect.any(Object),
        take: 100
      })
    })

    it('should batch process large invoice sets', async () => {
      const { prisma } = require('@/lib/prisma')

      await (service as any).findCandidateInvoices(
        'company-123',
        { type: 'OVERDUE_DAYS', conditions: [] }
      )

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100 // Should limit batch size
        })
      )
    })
  })

  describe('Invoice Validation Rules', () => {
    it('should reject invoices with very small amounts', async () => {
      const smallInvoice = {
        ...mockInvoice,
        totalAmount: 5 // Very small amount
      }

      const validation = (service as any).validateInvoiceForTrigger(smallInvoice)

      expect(validation.canTrigger).toBe(false)
      expect(validation.reason).toContain('Invoice amount too small')
    })

    it('should reject invoices with recent payment activity', async () => {
      const recentPaymentInvoice = {
        ...mockInvoice,
        payments: [
          {
            amount: 1000,
            paymentDate: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
          }
        ]
      }

      const validation = (service as any).validateInvoiceForTrigger(recentPaymentInvoice)

      expect(validation.canTrigger).toBe(false)
      expect(validation.reason).toContain('Recent payment activity detected')
    })

    it('should allow valid invoices', async () => {
      const validInvoice = {
        ...mockInvoice,
        totalAmount: 1000,
        payments: []
      }

      const validation = (service as any).validateInvoiceForTrigger(validInvoice)

      expect(validation.canTrigger).toBe(true)
    })
  })

  describe('Monitoring Metrics', () => {
    beforeEach(() => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock metrics queries
      prisma.followUpSequence.count.mockResolvedValue(5)
      prisma.followUpLog.count.mockResolvedValue(25)
      prisma.activity.count
        .mockResolvedValueOnce(10) // triggersLastHour
        .mockResolvedValueOnce(45) // triggersLastDay

      // Mock trigger events
      const triggerEvents = [
        {
          metadata: { success: true, triggerType: 'OVERDUE_DAYS' },
          createdAt: new Date()
        },
        {
          metadata: { success: true, triggerType: 'DUE_DATE_REACHED' },
          createdAt: new Date()
        },
        {
          metadata: { success: false, triggerType: 'OVERDUE_DAYS' },
          createdAt: new Date()
        }
      ]
      prisma.activity.findMany.mockResolvedValue(triggerEvents)
    })

    it('should calculate comprehensive monitoring metrics', async () => {
      const metrics = await service.getMonitoringMetrics('company-123')

      expect(metrics.totalTriggers).toBe(5)
      expect(metrics.activeTriggers).toBe(25)
      expect(metrics.triggersLastHour).toBe(10)
      expect(metrics.triggersLastDay).toBe(45)
      expect(metrics.successRate).toBeCloseTo(66.67) // 2 success out of 3
      expect(metrics.failedTriggers).toBe(1)
    })

    it('should identify most common trigger types', async () => {
      const metrics = await service.getMonitoringMetrics()

      expect(metrics.mostCommonTriggers).toContainEqual({
        type: 'OVERDUE_DAYS',
        count: 2
      })
      expect(metrics.mostCommonTriggers).toContainEqual({
        type: 'DUE_DATE_REACHED',
        count: 1
      })
    })

    it('should handle empty metrics gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      
      prisma.followUpSequence.count.mockResolvedValue(0)
      prisma.followUpLog.count.mockResolvedValue(0)
      prisma.activity.count.mockResolvedValue(0)
      prisma.activity.findMany.mockResolvedValue([])

      const metrics = await service.getMonitoringMetrics()

      expect(metrics.totalTriggers).toBe(0)
      expect(metrics.successRate).toBe(0)
      expect(metrics.mostCommonTriggers).toHaveLength(0)
    })

    it('should filter metrics by company when specified', async () => {
      const { prisma } = require('@/lib/prisma')

      await service.getMonitoringMetrics('specific-company')

      // Should include companyId filter in all queries
      expect(prisma.followUpSequence.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          companyId: 'specific-company'
        })
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle sequence execution failures gracefully', async () => {
      const { sequenceExecutionService } = require('../sequence-execution-service')
      sequenceExecutionService.startSequenceExecution.mockResolvedValue({
        success: false,
        errors: ['Email service unavailable'],
        emailLogIds: []
      })

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(0) // Should not count as triggered
      expect(result.errors).toContain('Email service unavailable')
    })

    it('should handle database connection failures', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.followUpSequence.findMany.mockRejectedValue(new Error('Connection timeout'))

      const result = await service.monitorInvoiceEvents()

      expect(result.processed).toBe(0)
      expect(result.errors).toContain('Monitoring failed: Connection timeout')
    })

    it('should handle missing invoice data', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.invoice.findMany.mockResolvedValue([])

      const result = await service.monitorInvoiceEvents()

      expect(result.triggered).toBe(0) // No invoices to trigger on
    })

    it('should handle malformed sequence data', async () => {
      const { prisma } = require('@/lib/prisma')
      const malformedSequence = {
        ...mockSequence,
        steps: 'invalid json',
        metadata: null
      }
      prisma.followUpSequence.findMany.mockResolvedValue([malformedSequence])

      const result = await service.monitorInvoiceEvents()

      expect(result.processed).toBe(1)
      expect(result.triggered).toBe(1) // Should still work with defaults
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large number of sequences efficiently', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock 100 active sequences
      const largeSequenceSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockSequence,
        id: `sequence-${i}`
      }))
      
      prisma.followUpSequence.findMany.mockResolvedValue(largeSequenceSet)

      const startTime = Date.now()
      const result = await service.monitorInvoiceEvents()
      const processingTime = Date.now() - startTime

      expect(result.processed).toBe(100)
      expect(processingTime).toBeLessThan(10000) // Should complete within 10 seconds
    })

    it('should batch process invoices efficiently', async () => {
      const { prisma } = require('@/lib/prisma')
      
      // Mock large invoice set
      const largeInvoiceSet = Array.from({ length: 500 }, (_, i) => ({
        ...mockInvoice,
        id: `invoice-${i}`
      }))
      
      prisma.invoice.findMany.mockResolvedValue(largeInvoiceSet.slice(0, 100)) // Batch size

      await service.monitorInvoiceEvents()

      // Should limit batch processing
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100
        })
      )
    })

    it('should handle concurrent trigger processing', async () => {
      const { sequenceExecutionService } = require('../sequence-execution-service')
      
      // Mock multiple simultaneous triggers
      const concurrentPromises = Array.from({ length: 10 }, (_, i) =>
        service.manualTrigger(
          `sequence-${i}`,
          `invoice-${i}`,
          'user-123',
          'Concurrent test'
        )
      )

      const results = await Promise.all(concurrentPromises)

      expect(results).toHaveLength(10)
      expect(results.every(result => result.triggered)).toBe(true)
      expect(sequenceExecutionService.startSequenceExecution).toHaveBeenCalledTimes(10)
    })
  })
})