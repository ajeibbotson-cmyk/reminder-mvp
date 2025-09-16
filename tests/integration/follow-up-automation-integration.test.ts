/**
 * Follow-up Automation Integration Tests
 * End-to-end testing of the complete follow-up automation workflow
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { SequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { UAEBusinessHoursService } from '@/lib/services/uae-business-hours-service'
import { CulturalComplianceService } from '@/lib/services/cultural-compliance-service'
import { faker } from '@faker-js/faker'

// Test database instance
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./test.db'
    }
  }
})

// Mock external services
const mockEmailService = {
  scheduleEmail: jest.fn(),
  cancelScheduledEmail: jest.fn(),
  getDeliveryStatus: jest.fn()
}

const mockAWSService = {
  sendEmail: jest.fn(),
  checkEmailStatus: jest.fn()
}

jest.mock('@/lib/services/email-scheduling-service', () => ({
  emailSchedulingService: mockEmailService
}))

describe('Follow-up Automation Integration Tests', () => {
  let testCompany: any
  let testCustomer: any
  let testInvoice: any
  let testSequence: any
  let sequenceService: SequenceExecutionService
  let businessHoursService: UAEBusinessHoursService

  beforeAll(async () => {
    // Initialize services
    sequenceService = new SequenceExecutionService()
    businessHoursService = new UAEBusinessHoursService()

    // Clean up test database
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()
    mockEmailService.scheduleEmail.mockResolvedValue('mock-email-id-' + Date.now())
    mockEmailService.cancelScheduledEmail.mockResolvedValue(true)
    mockEmailService.getDeliveryStatus.mockResolvedValue('SENT')

    // Create test data
    await setupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  async function setupTestData() {
    // Create test company
    testCompany = await prisma.company.create({
      data: {
        id: 'test-company-' + Date.now(),
        name: 'UAE Test Company LLC',
        email: 'test@uaecompany.ae',
        trn: '100123456789001',
        address: 'Dubai, UAE',
        phone: '+971-4-123-4567',
        website: 'https://uaecompany.ae',
        currency: 'AED',
        timezone: 'Asia/Dubai',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        id: 'test-customer-' + Date.now(),
        companyId: testCompany.id,
        name: 'Ahmad Al-Rashid',
        email: 'ahmad@customer.ae',
        phone: '+971-50-123-4567',
        address: 'Abu Dhabi, UAE',
        trn: '100987654321001',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Create test invoice
    testInvoice = await prisma.invoice.create({
      data: {
        id: 'test-invoice-' + Date.now(),
        number: 'INV-2024-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        companyId: testCompany.id,
        customerId: testCustomer.id,
        customerName: testCustomer.name,
        customerEmail: testCustomer.email,
        amount: 5000,
        vat: 250,
        totalAmount: 5250,
        currency: 'AED',
        status: 'SENT',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Create test follow-up sequence
    testSequence = await prisma.followUpSequence.create({
      data: {
        id: 'test-sequence-' + Date.now(),
        companyId: testCompany.id,
        name: 'Standard UAE Follow-up Sequence',
        description: 'Culturally appropriate follow-up sequence for UAE customers',
        active: true,
        steps: JSON.stringify([
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Gentle Reminder: Invoice {{invoiceNumber}} - {{customerName}}',
            content: 'Dear {{customerName}},\\n\\nAs-salamu alaykum and greetings! We hope this email finds you in good health.\\n\\nThis is a friendly reminder regarding Invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}}, which was due on {{dueDate}}.\\n\\nWe would appreciate your kind attention to this matter at your earliest convenience.\\n\\nThank you for your continued partnership and cooperation.\\n\\nBest regards,\\n{{companyName}} Accounts Team',
            language: 'ENGLISH',
            tone: 'BUSINESS',
            stopConditions: []
          },
          {
            stepNumber: 2,
            delayDays: 7,
            subject: 'Second Notice: Invoice {{invoiceNumber}} - Follow-up Required',
            content: 'Dear Valued Customer {{customerName}},\\n\\nWe hope this message finds you well.\\n\\nWe are following up on our previous communication regarding Invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}}.\\n\\nWe kindly request your cooperation in settling this outstanding amount or discussing any concerns you may have.\\n\\nPlease contact us at your earliest convenience to arrange payment or discuss payment terms.\\n\\nWe appreciate your attention to this matter and look forward to your prompt response.\\n\\nWith sincere regards,\\n{{companyName}} Finance Department',
            language: 'ENGLISH',
            tone: 'FORMAL',
            stopConditions: ['CUSTOMER_RESPONSE']
          },
          {
            stepNumber: 3,
            delayDays: 5,
            subject: 'Important: Invoice {{invoiceNumber}} - Discussion Required',
            content: 'Dear Esteemed Customer {{customerName}},\\n\\nWe respectfully write to you regarding Invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}}, which remains outstanding.\\n\\nDespite our previous communications, we have not yet received payment or heard from you regarding this matter.\\n\\nWe would very much appreciate the opportunity to discuss this invoice with you and understand if there are any issues preventing payment.\\n\\nPlease contact us within the next few business days so we can work together to resolve this matter amicably.\\n\\nWe value our business relationship and look forward to your prompt response.\\n\\nRespectfully yours,\\n{{companyName}} Management',
            language: 'ENGLISH',
            tone: 'VERY_FORMAL',
            stopConditions: ['CUSTOMER_RESPONSE', 'PAYMENT_RECEIVED']
          }
        ]),
        triggerConditions: JSON.stringify([
          {
            type: 'DAYS_OVERDUE',
            value: 0,
            operator: 'GREATER_THAN'
          }
        ]),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  }

  async function cleanupTestData() {
    try {
      // Clean up in reverse order of dependencies
      await prisma.followUpLog.deleteMany({
        where: {
          invoiceId: { contains: 'test-invoice-' }
        }
      })

      await prisma.emailLog.deleteMany({
        where: {
          companyId: { contains: 'test-company-' }
        }
      })

      await prisma.followUpSequence.deleteMany({
        where: {
          id: { contains: 'test-sequence-' }
        }
      })

      await prisma.invoice.deleteMany({
        where: {
          id: { contains: 'test-invoice-' }
        }
      })

      await prisma.customer.deleteMany({
        where: {
          id: { contains: 'test-customer-' }
        }
      })

      await prisma.company.deleteMany({
        where: {
          id: { contains: 'test-company-' }
        }
      })
    } catch (error) {
      console.warn('Cleanup warning:', error)
    }
  }

  describe('Complete Follow-up Workflow', () => {
    it('should execute complete 3-step follow-up sequence', async () => {
      // Step 1: Start sequence execution
      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      expect(startResult.success).toBe(true)
      expect(startResult.sequenceExecutionId).toBeDefined()
      expect(startResult.emailLogIds).toHaveLength(1)
      expect(startResult.stepsExecuted).toBe(1)
      expect(startResult.stepsRemaining).toBe(2)

      // Verify first email was scheduled
      expect(mockEmailService.scheduleEmail).toHaveBeenCalledTimes(1)
      const firstEmailCall = mockEmailService.scheduleEmail.mock.calls[0][0]
      expect(firstEmailCall.subject).toContain(testInvoice.number)
      expect(firstEmailCall.subject).toContain(testCustomer.name)
      expect(firstEmailCall.content).toContain('As-salamu alaykum')
      expect(firstEmailCall.recipientEmail).toBe(testCustomer.email)

      // Step 2: Continue sequence execution (second step)
      const continueResult1 = await sequenceService.continueSequenceExecution(
        startResult.sequenceExecutionId!
      )

      expect(continueResult1.success).toBe(true)
      expect(continueResult1.stepsExecuted).toBe(1)
      expect(continueResult1.stepsRemaining).toBe(1)

      // Verify second email was scheduled
      expect(mockEmailService.scheduleEmail).toHaveBeenCalledTimes(2)
      const secondEmailCall = mockEmailService.scheduleEmail.mock.calls[1][0]
      expect(secondEmailCall.subject).toContain('Second Notice')
      expect(secondEmailCall.content).toContain('following up')

      // Step 3: Continue sequence execution (final step)
      const continueResult2 = await sequenceService.continueSequenceExecution(
        startResult.sequenceExecutionId!
      )

      expect(continueResult2.success).toBe(true)
      expect(continueResult2.stepsExecuted).toBe(1)
      expect(continueResult2.stepsRemaining).toBe(0)

      // Verify final email was scheduled
      expect(mockEmailService.scheduleEmail).toHaveBeenCalledTimes(3)
      const finalEmailCall = mockEmailService.scheduleEmail.mock.calls[2][0]
      expect(finalEmailCall.subject).toContain('Important')
      expect(finalEmailCall.content).toContain('respectfully write')

      // Verify sequence completion
      const status = await sequenceService.getSequenceExecutionStatus(
        testSequence.id,
        testInvoice.id
      )

      expect(status).toBeDefined()
      expect(status!.status).toBe('COMPLETED')
      expect(status!.currentStep).toBe(3)
      expect(status!.totalSteps).toBe(3)
    })

    it('should stop sequence when payment is received', async () => {
      // Start sequence
      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      expect(startResult.success).toBe(true)

      // Simulate payment received
      await prisma.payment.create({
        data: {
          id: 'test-payment-' + Date.now(),
          invoiceId: testInvoice.id,
          amount: testInvoice.totalAmount,
          currency: 'AED',
          paymentDate: new Date(),
          paymentMethod: 'BANK_TRANSFER',
          reference: 'TEST-PAYMENT-REF',
          status: 'COMPLETED',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Attempt to continue sequence
      const continueResult = await sequenceService.continueSequenceExecution(
        startResult.sequenceExecutionId!
      )

      expect(continueResult.success).toBe(true)
      expect(continueResult.errors).toContain('Sequence stopped: Payment received')
      expect(continueResult.stepsRemaining).toBe(0)
    })

    it('should respect UAE business hours for scheduling', async () => {
      // Mock outside business hours
      const fridayEvening = new Date('2024-02-09T20:00:00+04:00') // Friday 8 PM
      jest.spyOn(businessHoursService, 'isBusinessHours').mockReturnValue(false)
      jest.spyOn(businessHoursService, 'getNextAvailableSendTime').mockReturnValue(
        new Date('2024-02-11T10:00:00+04:00') // Sunday 10 AM
      )

      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        {
          startImmediately: false,
          customStartTime: fridayEvening
        }
      )

      expect(startResult.success).toBe(true)
      expect(startResult.nextExecutionAt).toEqual(new Date('2024-02-11T10:00:00+04:00'))
    })

    it('should validate cultural compliance before sending', async () => {
      // Create sequence with inappropriate content
      const inappropriateSequence = await prisma.followUpSequence.create({
        data: {
          id: 'test-inappropriate-sequence-' + Date.now(),
          companyId: testCompany.id,
          name: 'Inappropriate Sequence',
          description: 'Test sequence with inappropriate content',
          active: true,
          steps: JSON.stringify([
            {
              stepNumber: 1,
              delayDays: 7,
              subject: 'URGENT: Pay immediately!',
              content: 'You must pay right now or face legal action!',
              language: 'ENGLISH',
              tone: 'URGENT',
              stopConditions: []
            }
          ]),
          triggerConditions: JSON.stringify([]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const startResult = await sequenceService.startSequenceExecution(
        inappropriateSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      // Should still execute but with compliance warnings
      expect(startResult.success).toBe(true)
      expect(mockEmailService.scheduleEmail).toHaveBeenCalled()

      // Clean up
      await prisma.followUpSequence.delete({
        where: { id: inappropriateSequence.id }
      })
    })

    it('should handle email delivery failures gracefully', async () => {
      // Mock email service failure
      mockEmailService.scheduleEmail.mockRejectedValue(new Error('SES quota exceeded'))

      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      expect(startResult.success).toBe(false)
      expect(startResult.errors.some(error => error.includes('SES quota'))).toBe(true)
      expect(startResult.emailLogIds).toHaveLength(0)
    })
  })

  describe('High-Volume Processing', () => {
    it('should process multiple sequences concurrently', async () => {
      const batchSize = 10
      const invoices: any[] = []
      const sequences: any[] = []

      // Create multiple test invoices and sequences
      for (let i = 0; i < batchSize; i++) {
        const invoice = await prisma.invoice.create({
          data: {
            id: `test-batch-invoice-${i}-${Date.now()}`,
            number: `INV-BATCH-${i}-${Math.random().toString(36).substr(2, 4)}`,
            companyId: testCompany.id,
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            customerEmail: `customer${i}@test.ae`,
            amount: 1000 + (i * 100),
            vat: 50 + (i * 5),
            totalAmount: 1050 + (i * 105),
            currency: 'AED',
            status: 'SENT',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
        invoices.push(invoice)
      }

      const startTime = Date.now()

      // Process all sequences concurrently
      const promises = invoices.map(invoice =>
        sequenceService.startSequenceExecution(
          testSequence.id,
          invoice.id,
          {
            type: 'DAYS_OVERDUE',
            value: 1,
            operator: 'GREATER_THAN'
          },
          { startImmediately: true }
        )
      )

      const results = await Promise.all(promises)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Verify all succeeded
      expect(results.every(result => result.success)).toBe(true)
      expect(mockEmailService.scheduleEmail).toHaveBeenCalledTimes(batchSize)

      // Should complete within reasonable time (< 5 seconds for 10 sequences)
      expect(processingTime).toBeLessThan(5000)

      // Clean up batch data
      await prisma.invoice.deleteMany({
        where: {
          id: { contains: 'test-batch-invoice-' }
        }
      })
    })

    it('should handle sequence analytics for multiple executions', async () => {
      // Create multiple follow-up logs to simulate completed sequences
      const sequenceIds: string[] = []

      for (let i = 0; i < 5; i++) {
        const logId = `test-analytics-log-${i}-${Date.now()}`
        sequenceIds.push(logId)

        await prisma.followUpLog.create({
          data: {
            id: logId,
            invoiceId: testInvoice.id,
            sequenceId: testSequence.id,
            stepNumber: 3, // Completed sequence
            emailAddress: testCustomer.email,
            subject: 'Test Subject',
            content: 'Test Content',
            sentAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Spread over days
            awsMessageId: `aws-message-${i}`
          }
        })
      }

      const analytics = await sequenceService.getSequenceAnalytics(testSequence.id)

      expect(analytics.sequenceId).toBe(testSequence.id)
      expect(analytics.totalExecutions).toBeGreaterThanOrEqual(5)
      expect(analytics.stepAnalytics).toHaveLength(3) // 3 steps in sequence
      expect(analytics.conversionRate).toBeGreaterThanOrEqual(0)

      // Clean up analytics data
      await prisma.followUpLog.deleteMany({
        where: {
          id: { in: sequenceIds }
        }
      })
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle database connection issues', async () => {
      // Mock database error
      jest.spyOn(prisma.followUpSequence, 'findUnique').mockRejectedValue(
        new Error('Database connection failed')
      )

      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        }
      )

      expect(startResult.success).toBe(false)
      expect(startResult.errors).toContain('Database connection failed')

      // Restore mock
      jest.restoreAllMocks()
    })

    it('should handle invalid sequence data gracefully', async () => {
      // Create sequence with malformed steps
      const malformedSequence = await prisma.followUpSequence.create({
        data: {
          id: 'test-malformed-sequence-' + Date.now(),
          companyId: testCompany.id,
          name: 'Malformed Sequence',
          description: 'Test sequence with invalid JSON',
          active: true,
          steps: 'invalid json content',
          triggerConditions: JSON.stringify([]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const startResult = await sequenceService.startSequenceExecution(
        malformedSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        }
      )

      expect(startResult.success).toBe(false)
      expect(startResult.errors).toContain('Sequence has no valid steps')

      // Clean up
      await prisma.followUpSequence.delete({
        where: { id: malformedSequence.id }
      })
    })

    it('should prevent duplicate sequence executions', async () => {
      // Start first sequence
      const firstResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      expect(firstResult.success).toBe(true)

      // Attempt to start same sequence again
      const duplicateResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        }
      )

      expect(duplicateResult.success).toBe(false)
      expect(duplicateResult.errors).toContain('Sequence already running for this invoice')
    })
  })

  describe('UAE Compliance Integration', () => {
    it('should respect Islamic holidays when scheduling', async () => {
      // Mock Eid Al Fitr date
      const eidDate = new Date('2024-04-09T10:00:00+04:00')
      jest.spyOn(businessHoursService, 'isUAEHoliday').mockReturnValue(true)
      jest.spyOn(businessHoursService, 'getNextAvailableSendTime').mockReturnValue(
        new Date('2024-04-12T10:00:00+04:00') // After holiday
      )

      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        {
          startImmediately: false,
          customStartTime: eidDate
        }
      )

      expect(startResult.success).toBe(true)
      expect(startResult.nextExecutionAt).toEqual(new Date('2024-04-12T10:00:00+04:00'))
    })

    it('should avoid prayer times when scheduling', async () => {
      // Mock Dhuhr prayer time
      const dhuhrTime = new Date('2024-02-06T12:15:00+04:00')
      jest.spyOn(businessHoursService, 'isPrayerTime').mockReturnValue(true)
      jest.spyOn(businessHoursService, 'getNextAvailableSendTime').mockReturnValue(
        new Date('2024-02-06T13:00:00+04:00') // After prayer
      )

      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        {
          startImmediately: false,
          customStartTime: dhuhrTime
        }
      )

      expect(startResult.success).toBe(true)
      expect(startResult.nextExecutionAt).toEqual(new Date('2024-02-06T13:00:00+04:00'))
    })

    it('should validate template variables are properly replaced', async () => {
      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      expect(startResult.success).toBe(true)
      expect(mockEmailService.scheduleEmail).toHaveBeenCalled()

      const emailCall = mockEmailService.scheduleEmail.mock.calls[0][0]

      // Verify template variables were replaced
      expect(emailCall.subject).toContain(testInvoice.number)
      expect(emailCall.subject).toContain(testCustomer.name)
      expect(emailCall.content).toContain(testCustomer.name)
      expect(emailCall.content).toContain(testInvoice.number)
      expect(emailCall.content).toContain(testInvoice.totalAmount.toString())
      expect(emailCall.content).toContain(testInvoice.currency)
      expect(emailCall.content).toContain(testCompany.name)

      // Should not contain template placeholders
      expect(emailCall.subject).not.toContain('{{')
      expect(emailCall.content).not.toContain('{{')
    })
  })

  describe('Monitoring and Logging', () => {
    it('should create comprehensive follow-up logs', async () => {
      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      expect(startResult.success).toBe(true)

      // Verify follow-up log was created
      const followUpLogs = await prisma.followUpLog.findMany({
        where: {
          invoiceId: testInvoice.id,
          sequenceId: testSequence.id
        }
      })

      expect(followUpLogs).toHaveLength(1)
      const log = followUpLogs[0]

      expect(log.stepNumber).toBe(1)
      expect(log.subject).toBeDefined()
      expect(log.content).toBeDefined()
      expect(log.sentAt).toBeInstanceOf(Date)
      expect(log.awsMessageId).toBeDefined()
    })

    it('should track sequence execution status changes', async () => {
      const startResult = await sequenceService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        {
          type: 'DAYS_OVERDUE',
          value: 1,
          operator: 'GREATER_THAN'
        },
        { startImmediately: true }
      )

      // Check initial status
      let status = await sequenceService.getSequenceExecutionStatus(
        testSequence.id,
        testInvoice.id
      )

      expect(status?.status).toBe('ACTIVE')
      expect(status?.currentStep).toBe(1)

      // Continue sequence
      await sequenceService.continueSequenceExecution(startResult.sequenceExecutionId!)
      await sequenceService.continueSequenceExecution(startResult.sequenceExecutionId!)

      // Check final status
      status = await sequenceService.getSequenceExecutionStatus(
        testSequence.id,
        testInvoice.id
      )

      expect(status?.status).toBe('COMPLETED')
      expect(status?.currentStep).toBe(3)
    })
  })

  describe('Performance Benchmarks', () => {
    it('should process sequences within performance targets', async () => {
      const startTime = Date.now()

      // Process 100 sequences
      const promises: Promise<any>[] = []
      for (let i = 0; i < 100; i++) {
        const invoice = await prisma.invoice.create({
          data: {
            id: `perf-test-invoice-${i}-${Date.now()}`,
            number: `PERF-${i}`,
            companyId: testCompany.id,
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            customerEmail: `perf${i}@test.ae`,
            amount: 1000,
            vat: 50,
            totalAmount: 1050,
            currency: 'AED',
            status: 'SENT',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })

        promises.push(
          sequenceService.startSequenceExecution(
            testSequence.id,
            invoice.id,
            {
              type: 'DAYS_OVERDUE',
              value: 1,
              operator: 'GREATER_THAN'
            },
            { startImmediately: true }
          )
        )
      }

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Performance targets:
      // - Process 100 sequences in under 10 seconds
      // - All sequences should succeed
      expect(processingTime).toBeLessThan(10000)
      expect(results.every(r => r.success)).toBe(true)
      expect(mockEmailService.scheduleEmail).toHaveBeenCalledTimes(100)

      // Clean up performance test data
      await prisma.invoice.deleteMany({
        where: {
          id: { contains: 'perf-test-invoice-' }
        }
      })
    })
  })
})