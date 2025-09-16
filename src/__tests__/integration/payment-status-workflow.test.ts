/**
 * End-to-End Integration Test for Payment-Status Workflow
 * Demonstrates the complete flow from invoice creation to payment processing
 * with automatic status transitions and UAE business compliance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { InvoiceStatus, PaymentMethod, UserRole } from '@prisma/client'
import { invoiceStatusService } from '@/lib/services/invoice-status-service'
import { paymentWorkflowService } from '@/lib/services/payment-workflow-service'
import { Decimal } from 'decimal.js'

// Mock setup for integration testing
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    invoices: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    payments: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    activities: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    customers: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    companies: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/lib/vat-calculator', () => ({
  formatUAECurrency: jest.fn((amount, currency) => {
    const num = amount instanceof Decimal ? amount.toNumber() : amount
    return `${currency} ${num.toFixed(2)}`
  })
}))

const { prisma } = require('@/lib/prisma')

// Test data setup
const testCompany = {
  id: 'company-test-123',
  name: 'UAEPay Test Company',
  trn: '123456789012345'
}

const testUser = {
  id: 'user-test-123',
  name: 'Test Finance User',
  role: UserRole.FINANCE,
  companyId: testCompany.id
}

const testCustomer = {
  id: 'customer-test-123',
  companyId: testCompany.id,
  name: 'Test Customer LLC',
  email: 'test@customer.ae',
  phone: '+971501234567'
}

describe('Payment-Status Workflow Integration', () => {
  let testInvoice: any
  let testPayments: any[] = []

  beforeAll(() => {
    // Mock system time to be within UAE business hours
    const mockDate = new Date('2024-01-15T10:00:00.000Z') // Monday 2PM Dubai time
    jest.useFakeTimers()
    jest.setSystemTime(mockDate)
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    testPayments = []
    
    // Setup test invoice
    testInvoice = {
      id: 'invoice-test-123',
      companyId: testCompany.id,
      number: 'INV-TEST-001',
      customerName: testCustomer.name,
      customerEmail: testCustomer.email,
      amount: new Decimal(5000),
      subtotal: new Decimal(4761.90),
      vatAmount: new Decimal(238.10),
      totalAmount: new Decimal(5000),
      currency: 'AED',
      dueDate: new Date('2024-01-30'),
      status: InvoiceStatus.DRAFT,
      trnNumber: '123456789012345',
      description: 'Test invoice for integration testing',
      descriptionAr: 'فاتورة اختبار للاختبار المتكامل',
      payments: testPayments,
      customers: testCustomer,
      companies: testCompany,
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10')
    }
  })

  describe('Complete Invoice Lifecycle with Payment Integration', () => {
    it('should handle complete invoice workflow from DRAFT to PAID with multiple payments', async () => {
      console.log('🧪 Starting complete invoice workflow test...')

      // Step 1: Invoice starts as DRAFT
      expect(testInvoice.status).toBe(InvoiceStatus.DRAFT)
      console.log('✅ Invoice created in DRAFT status')

      // Mock database responses for status transitions
      let currentStatus = InvoiceStatus.DRAFT
      const currentPayments: any[] = []

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoices: {
            findUnique: jest.fn().mockReturnValue({
              ...testInvoice,
              status: currentStatus,
              payments: currentPayments
            }),
            update: jest.fn().mockImplementation((args) => {
              currentStatus = args.data.status || currentStatus
              return { ...testInvoice, status: currentStatus }
            })
          },
          payments: {
            create: jest.fn().mockImplementation((args) => {
              const newPayment = { id: `payment-${Date.now()}`, ...args.data }
              currentPayments.push(newPayment)
              return newPayment
            }),
            findMany: jest.fn().mockReturnValue(currentPayments)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: `activity-${Date.now()}` })
          }
        }
        return await callback(mockTx)
      })

      // Step 2: Transition from DRAFT to SENT
      console.log('🔄 Transitioning invoice from DRAFT to SENT...')
      
      const sentResult = await invoiceStatusService.updateInvoiceStatus(
        testInvoice.id,
        InvoiceStatus.SENT,
        {
          userId: testUser.id,
          userRole: testUser.role,
          companyId: testUser.companyId,
          reason: 'Invoice reviewed and sent to customer',
          notifyCustomer: true
        }
      )

      expect(sentResult.success).toBe(true)
      expect(sentResult.oldStatus).toBe(InvoiceStatus.DRAFT)
      expect(sentResult.newStatus).toBe(InvoiceStatus.SENT)
      console.log('✅ Invoice successfully transitioned to SENT status')

      // Step 3: First partial payment (50% of invoice amount)
      console.log('💰 Processing first partial payment (50% of invoice)...')
      
      const partialPaymentAmount = 2500 // 50% of AED 5000
      
      // Mock payment processing
      const mockPartialPayment = {
        id: 'payment-partial-123',
        invoiceId: testInvoice.id,
        amount: new Decimal(partialPaymentAmount),
        paymentDate: new Date('2024-01-20'),
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'TXN-PARTIAL-001',
        notes: 'Partial payment - first installment'
      }

      currentPayments.push(mockPartialPayment)

      const partialWorkflowResult = await paymentWorkflowService.processPaymentWorkflow(
        mockPartialPayment.id,
        'payment_partial',
        {
          userId: testUser.id,
          userRole: testUser.role,
          companyId: testUser.companyId,
          reason: 'Partial payment received via bank transfer'
        }
      )

      expect(partialWorkflowResult.success).toBe(true)
      expect(partialWorkflowResult.paymentSummary.isPartialPayment).toBe(true)
      expect(partialWorkflowResult.paymentSummary.isFullyPaid).toBe(false)
      expect(partialWorkflowResult.paymentSummary.totalPaid).toBe(partialPaymentAmount)
      expect(partialWorkflowResult.paymentSummary.remainingAmount).toBe(2500)
      expect(partialWorkflowResult.businessRules.uaeCompliant).toBe(true)
      
      // Status should remain SENT for partial payment
      expect(partialWorkflowResult.statusTransition).toBeUndefined()
      console.log('✅ Partial payment processed - invoice remains SENT')

      // Step 4: Simulate invoice becoming overdue (past due date)
      console.log('⏰ Simulating overdue detection (past due date)...')
      
      // Mock time passing beyond due date
      const overdueDate = new Date('2024-02-01T10:00:00.000Z')
      jest.setSystemTime(overdueDate)

      // Overdue detection would be triggered by cron job
      const overdueResult = await invoiceStatusService.updateInvoiceStatus(
        testInvoice.id,
        InvoiceStatus.OVERDUE,
        {
          userId: 'system',
          userRole: UserRole.ADMIN,
          companyId: testCompany.id,
          reason: 'Automated overdue detection - past due date',
          notifyCustomer: true
        }
      )

      expect(overdueResult.success).toBe(true)
      expect(overdueResult.newStatus).toBe(InvoiceStatus.OVERDUE)
      console.log('✅ Invoice automatically marked as OVERDUE')

      // Step 5: Final payment to complete invoice
      console.log('💰 Processing final payment to complete invoice...')
      
      const finalPaymentAmount = 2500 // Remaining 50%
      
      const mockFinalPayment = {
        id: 'payment-final-123',
        invoiceId: testInvoice.id,
        amount: new Decimal(finalPaymentAmount),
        paymentDate: new Date('2024-02-05'),
        method: PaymentMethod.CREDIT_CARD,
        reference: 'TXN-FINAL-001',
        notes: 'Final payment - completing invoice'
      }

      currentPayments.push(mockFinalPayment)

      const finalWorkflowResult = await paymentWorkflowService.processPaymentWorkflow(
        mockFinalPayment.id,
        'payment_overdue_cleared',
        {
          userId: testUser.id,
          userRole: testUser.role,
          companyId: testUser.companyId,
          reason: 'Final payment received - clearing overdue status'
        }
      )

      expect(finalWorkflowResult.success).toBe(true)
      expect(finalWorkflowResult.paymentSummary.isFullyPaid).toBe(true)
      expect(finalWorkflowResult.paymentSummary.totalPaid).toBe(5000)
      expect(finalWorkflowResult.paymentSummary.remainingAmount).toBe(0)
      expect(finalWorkflowResult.statusTransition).toBeDefined()
      expect(finalWorkflowResult.statusTransition?.to).toBe(InvoiceStatus.PAID)
      expect(finalWorkflowResult.recommendedActions).toContain('Remove from overdue tracking')
      console.log('✅ Final payment processed - invoice marked as PAID')

      // Step 6: Verify payment reconciliation
      console.log('🔍 Verifying payment reconciliation...')
      
      const reconciliationResult = await paymentWorkflowService.reconcileInvoicePayments(
        testInvoice.id,
        testCompany.id
      )

      expect(reconciliationResult.status).toBe('RECONCILED')
      expect(reconciliationResult.totalInvoiceAmount).toBe(5000)
      expect(reconciliationResult.totalPaymentsRecorded).toBe(5000)
      expect(reconciliationResult.discrepancy).toBe(0)
      expect(reconciliationResult.paymentBreakdown).toHaveLength(2)
      console.log('✅ Payment reconciliation completed successfully')

      // Step 7: Verify UAE business compliance
      console.log('🇦🇪 Verifying UAE business compliance...')
      
      expect(finalWorkflowResult.businessRules.uaeCompliant).toBe(true)
      expect(finalWorkflowResult.businessRules.complianceFlags).toContain('TRN_COMPLIANT')
      expect(finalWorkflowResult.businessRules.businessHours).toBe(true)
      expect(finalWorkflowResult.businessRules.auditTrailCreated).toBe(true)
      console.log('✅ UAE business compliance verified')

      console.log('🎉 Complete invoice workflow test completed successfully!')
    })

    it('should handle payment reversal and status rollback', async () => {
      console.log('🧪 Testing payment reversal and status rollback...')

      // Setup: Invoice paid in full
      const paidInvoice = {
        ...testInvoice,
        status: InvoiceStatus.PAID,
        payments: [
          {
            id: 'payment-full-123',
            amount: new Decimal(5000),
            paymentDate: new Date('2024-01-20'),
            method: PaymentMethod.BANK_TRANSFER,
            reference: 'TXN-FULL-001'
          }
        ]
      }

      const currentStatus = InvoiceStatus.PAID
      const currentPayments = [...paidInvoice.payments]

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          payments: {
            findUnique: jest.fn().mockReturnValue({
              id: 'payment-full-123',
              amount: new Decimal(5000),
              invoices: {
                ...paidInvoice,
                status: currentStatus,
                payments: currentPayments
              }
            })
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: `activity-${Date.now()}` })
          }
        }
        return await callback(mockTx)
      })

      // Process payment reversal
      const reversalResult = await paymentWorkflowService.processPaymentWorkflow(
        'payment-full-123',
        'payment_reversed',
        {
          userId: testUser.id,
          userRole: testUser.role,
          companyId: testUser.companyId,
          reason: 'Payment reversed by bank - insufficient funds',
          metadata: { reversalReason: 'NSF', bankCode: 'R01' }
        }
      )

      expect(reversalResult.success).toBe(true)
      expect(reversalResult.statusTransition).toBeDefined()
      expect(reversalResult.statusTransition?.from).toBe(InvoiceStatus.PAID)
      expect(reversalResult.statusTransition?.to).toBe(InvoiceStatus.OVERDUE) // Past due date
      expect(reversalResult.recommendedActions).toContain('Investigate payment reversal')
      
      console.log('✅ Payment reversal processed correctly with status rollback')
    })

    it('should handle batch payment processing with mixed results', async () => {
      console.log('🧪 Testing batch payment processing...')

      const batchPaymentEvents = [
        { paymentId: 'payment-1', event: 'payment_received' as const },
        { paymentId: 'payment-2', event: 'payment_completed' as const },
        { paymentId: 'payment-invalid', event: 'payment_received' as const } // This will fail
      ]

      // Mock successful processing for first two, failure for third
      jest.spyOn(paymentWorkflowService, 'processPaymentWorkflow')
        .mockResolvedValueOnce({
          success: true,
          paymentId: 'payment-1',
          invoiceId: 'invoice-1',
          invoiceNumber: 'INV-001',
          event: 'payment_received',
          paymentSummary: {
            totalPaid: 1000,
            remainingAmount: 500,
            paymentCount: 1,
            isPartialPayment: true,
            isFullyPaid: false,
            formattedAmounts: { totalPaid: 'AED 1000.00', remainingAmount: 'AED 500.00', currentPayment: 'AED 1000.00' }
          },
          businessRules: {
            uaeCompliant: true,
            complianceFlags: ['TRN_COMPLIANT'],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: []
        })
        .mockResolvedValueOnce({
          success: true,
          paymentId: 'payment-2',
          invoiceId: 'invoice-2',
          invoiceNumber: 'INV-002',
          event: 'payment_completed',
          paymentSummary: {
            totalPaid: 2000,
            remainingAmount: 0,
            paymentCount: 1,
            isPartialPayment: false,
            isFullyPaid: true,
            formattedAmounts: { totalPaid: 'AED 2000.00', remainingAmount: 'AED 0.00', currentPayment: 'AED 2000.00' }
          },
          businessRules: {
            uaeCompliant: true,
            complianceFlags: ['BANK_TRANSFER_TRACEABLE'],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: [],
          statusTransition: {
            from: InvoiceStatus.SENT,
            to: InvoiceStatus.PAID,
            automatic: true,
            reason: 'Payment completed'
          }
        })
        .mockRejectedValueOnce(new Error('Payment not found'))

      const batchResult = await paymentWorkflowService.processBatchPaymentWorkflow(
        batchPaymentEvents,
        {
          userId: testUser.id,
          userRole: testUser.role,
          companyId: testUser.companyId,
          batchId: 'batch-test-123'
        }
      )

      expect(batchResult.totalRequested).toBe(3)
      expect(batchResult.successCount).toBe(2)
      expect(batchResult.failedCount).toBe(1)
      expect(batchResult.aggregatedSummary.invoicesFullyPaid).toBe(1)
      expect(batchResult.aggregatedSummary.invoicesPartiallyPaid).toBe(1)
      expect(batchResult.aggregatedSummary.statusTransitionsTriggered).toBe(1)
      
      console.log('✅ Batch payment processing handled mixed results correctly')
    })

    it('should enforce UAE business hours for automated processing', async () => {
      console.log('🧪 Testing UAE business hours enforcement...')

      // Test outside business hours (Friday evening)
      const fridayEvening = new Date('2024-01-19T20:00:00.000Z') // Friday 12AM Dubai
      jest.setSystemTime(fridayEvening)

      // Business hours check
      const service = paymentWorkflowService as any
      expect(service.isUAEBusinessHours()).toBe(false)

      // Reset to business hours
      const mondayMorning = new Date('2024-01-15T10:00:00.000Z') // Monday 2PM Dubai
      jest.setSystemTime(mondayMorning)
      expect(service.isUAEBusinessHours()).toBe(true)

      console.log('✅ UAE business hours enforcement working correctly')
    })

    it('should handle webhook payment notifications', async () => {
      console.log('🧪 Testing webhook payment notifications...')

      const webhookNotification = {
        externalPaymentId: 'gateway-payment-123456',
        invoiceNumber: testInvoice.number,
        amount: 5000,
        currency: 'AED',
        method: PaymentMethod.CREDIT_CARD,
        reference: 'GATEWAY-REF-123',
        paymentDate: new Date('2024-01-20'),
        status: 'success' as const
      }

      // Mock successful webhook processing
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoices: {
            findUnique: jest.fn().mockResolvedValue({
              ...testInvoice,
              status: InvoiceStatus.SENT
            })
          },
          payments: {
            findFirst: jest.fn().mockResolvedValue(null), // No existing payment
            create: jest.fn().mockResolvedValue({
              id: 'webhook-payment-123',
              ...webhookNotification
            })
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'webhook-activity-123' })
          }
        }
        return await callback(mockTx)
      })

      jest.spyOn(paymentWorkflowService, 'processPaymentWorkflow')
        .mockResolvedValue({
          success: true,
          paymentId: 'webhook-payment-123',
          invoiceId: testInvoice.id,
          invoiceNumber: testInvoice.number,
          event: 'payment_received',
          paymentSummary: {
            totalPaid: 5000,
            remainingAmount: 0,
            paymentCount: 1,
            isPartialPayment: false,
            isFullyPaid: true,
            formattedAmounts: { totalPaid: 'AED 5000.00', remainingAmount: 'AED 0.00', currentPayment: 'AED 5000.00' }
          },
          businessRules: {
            uaeCompliant: true,
            complianceFlags: ['REFERENCE_PROVIDED', 'PROCESSED_BUSINESS_HOURS'],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: ['Send payment confirmation to customer'],
          statusTransition: {
            from: InvoiceStatus.SENT,
            to: InvoiceStatus.PAID,
            automatic: true,
            reason: 'Payment received via payment gateway'
          }
        })

      const webhookResult = await paymentWorkflowService.processPaymentNotification(
        webhookNotification,
        testCompany.id
      )

      expect(webhookResult.success).toBe(true)
      expect(webhookResult.paymentSummary.isFullyPaid).toBe(true)
      expect(webhookResult.statusTransition?.to).toBe(InvoiceStatus.PAID)
      expect(webhookResult.businessRules.uaeCompliant).toBe(true)

      console.log('✅ Webhook payment notification processed successfully')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database transaction failures gracefully', async () => {
      console.log('🧪 Testing error handling for database failures...')

      prisma.$transaction.mockRejectedValue(new Error('Database connection timeout'))

      await expect(
        paymentWorkflowService.processPaymentWorkflow(
          'payment-123',
          'payment_received',
          {
            userId: testUser.id,
            userRole: testUser.role,
            companyId: testUser.companyId
          }
        )
      ).rejects.toThrow('Database connection timeout')

      console.log('✅ Database error handling working correctly')
    })

    it('should prevent cross-company access violations', async () => {
      console.log('🧪 Testing cross-company access prevention...')

      const wrongCompanyPayment = {
        id: 'payment-wrong-company',
        invoices: {
          companies: { id: 'different-company-123' }
        }
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(wrongCompanyPayment)
          }
        })
      })

      await expect(
        paymentWorkflowService.processPaymentWorkflow(
          'payment-wrong-company',
          'payment_received',
          {
            userId: testUser.id,
            userRole: testUser.role,
            companyId: testUser.companyId
          }
        )
      ).rejects.toThrow('Access denied: Payment belongs to different company')

      console.log('✅ Cross-company access prevention working correctly')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large batch operations efficiently', async () => {
      console.log('🧪 Testing performance with large batch operations...')

      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        paymentId: `payment-${i}`,
        event: 'payment_received' as const
      }))

      // Mock successful processing for all items
      jest.spyOn(paymentWorkflowService, 'processPaymentWorkflow')
        .mockImplementation(() => Promise.resolve({
          success: true,
          paymentId: 'test',
          invoiceId: 'test',
          invoiceNumber: 'test',
          event: 'payment_received',
          paymentSummary: {
            totalPaid: 1000,
            remainingAmount: 0,
            paymentCount: 1,
            isPartialPayment: false,
            isFullyPaid: true,
            formattedAmounts: { totalPaid: 'AED 1000.00', remainingAmount: 'AED 0.00', currentPayment: 'AED 1000.00' }
          },
          businessRules: {
            uaeCompliant: true,
            complianceFlags: [],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: []
        }))

      const startTime = Date.now()
      const batchResult = await paymentWorkflowService.processBatchPaymentWorkflow(
        largeBatch,
        {
          userId: testUser.id,
          userRole: testUser.role,
          companyId: testUser.companyId,
          batchId: 'large-batch-test'
        }
      )
      const processingTime = Date.now() - startTime

      expect(batchResult.successCount).toBe(100)
      expect(batchResult.failedCount).toBe(0)
      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(batchResult.processingTime).toBeGreaterThan(0)

      console.log(`✅ Large batch (100 items) processed in ${processingTime}ms`)
    })
  })
})

console.log('🎉 Payment-Status Workflow Integration Test Suite Ready!')