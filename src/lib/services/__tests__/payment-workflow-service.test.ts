/**
 * Comprehensive Test Suite for Payment Workflow Service
 * Tests for payment-status correlation, automation, and UAE business compliance
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  PaymentWorkflowService, 
  paymentWorkflowService,
  PaymentWorkflowEvent 
} from '../payment-workflow-service'
import { InvoiceStatus, PaymentMethod, UserRole } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    payments: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn()
    },
    invoices: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    activities: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  }
}))

jest.mock('../invoice-status-service', () => ({
  invoiceStatusService: {
    updateInvoiceStatus: jest.fn(),
    validateStatusTransition: jest.fn()
  }
}))

jest.mock('@/lib/vat-calculator', () => ({
  formatUAECurrency: jest.fn((amount: any, currency: string) => {
    const num = amount instanceof Decimal ? amount.toNumber() : amount
    return `${currency} ${num.toFixed(2)}`
  })
}))

const { prisma } = require('@/lib/prisma')
const { invoiceStatusService } = require('../invoice-status-service')

describe('PaymentWorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock current time to be within UAE business hours
    const mockDate = new Date('2024-01-15T10:00:00.000Z') // Monday 2PM Dubai time
    jest.useFakeTimers()
    jest.setSystemTime(mockDate)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('processPaymentWorkflow', () => {
    const mockContext = {
      userId: 'user-123',
      userRole: UserRole.FINANCE,
      companyId: 'company-123',
      reason: 'Test payment workflow'
    }

    const mockPayment = {
      id: 'payment-123',
      amount: new Decimal(1000),
      paymentDate: new Date(),
      method: PaymentMethod.BANK_TRANSFER,
      reference: 'REF-123',
      notes: 'Test payment',
      invoices: {
        id: 'invoice-123',
        number: 'INV-001',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        totalAmount: new Decimal(2000),
        amount: new Decimal(2000),
        currency: 'AED',
        status: InvoiceStatus.SENT,
        dueDate: new Date('2024-01-10'),
        payments: [
          {
            id: 'payment-123',
            amount: new Decimal(1000),
            paymentDate: new Date(),
            method: PaymentMethod.BANK_TRANSFER,
            reference: 'REF-123'
          }
        ],
        companies: {
          id: 'company-123',
          name: 'Test Company'
        }
      }
    }

    it('should process payment_received event successfully', async () => {
      // Setup mocks
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(mockPayment)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      const result = await paymentWorkflowService.processPaymentWorkflow(
        'payment-123',
        'payment_received',
        mockContext
      )

      expect(result).toMatchObject({
        success: true,
        paymentId: 'payment-123',
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-001',
        event: 'payment_received',
        paymentSummary: {
          totalPaid: 1000,
          remainingAmount: 1000,
          paymentCount: 1,
          isPartialPayment: true,
          isFullyPaid: false
        }
      })

      expect(result.businessRules).toMatchObject({
        uaeCompliant: true,
        businessHours: true,
        auditTrailCreated: true
      })

      expect(result.recommendedActions).toContain('Send partial payment acknowledgment')
    })

    it('should trigger status transition to PAID when payment completes invoice', async () => {
      const fullPaymentMock = {
        ...mockPayment,
        amount: new Decimal(2000),
        invoices: {
          ...mockPayment.invoices,
          payments: [
            {
              id: 'payment-123',
              amount: new Decimal(2000),
              paymentDate: new Date(),
              method: PaymentMethod.BANK_TRANSFER,
              reference: 'REF-123'
            }
          ]
        }
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(fullPaymentMock)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      invoiceStatusService.updateInvoiceStatus.mockResolvedValue({
        success: true,
        oldStatus: InvoiceStatus.SENT,
        newStatus: InvoiceStatus.PAID,
        reason: 'Payment completed - invoice fully paid'
      })

      const result = await paymentWorkflowService.processPaymentWorkflow(
        'payment-123',
        'payment_completed',
        mockContext
      )

      expect(result.statusTransition).toMatchObject({
        from: InvoiceStatus.SENT,
        to: InvoiceStatus.PAID,
        automatic: true
      })

      expect(result.paymentSummary.isFullyPaid).toBe(true)
      expect(result.recommendedActions).toContain('Send payment confirmation to customer')

      expect(invoiceStatusService.updateInvoiceStatus).toHaveBeenCalledWith(
        'invoice-123',
        InvoiceStatus.PAID,
        expect.objectContaining({
          userId: 'user-123',
          userRole: UserRole.FINANCE,
          companyId: 'company-123'
        })
      )
    })

    it('should handle payment_overdue_cleared event', async () => {
      const overdueInvoiceMock = {
        ...mockPayment,
        amount: new Decimal(2000),
        invoices: {
          ...mockPayment.invoices,
          status: InvoiceStatus.OVERDUE,
          payments: [
            {
              id: 'payment-123',
              amount: new Decimal(2000),
              paymentDate: new Date(),
              method: PaymentMethod.BANK_TRANSFER,
              reference: 'REF-123'
            }
          ]
        }
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(overdueInvoiceMock)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      invoiceStatusService.updateInvoiceStatus.mockResolvedValue({
        success: true,
        oldStatus: InvoiceStatus.OVERDUE,
        newStatus: InvoiceStatus.PAID,
        reason: 'Overdue payment cleared - invoice fully paid'
      })

      const result = await paymentWorkflowService.processPaymentWorkflow(
        'payment-123',
        'payment_overdue_cleared',
        mockContext
      )

      expect(result.statusTransition).toMatchObject({
        from: InvoiceStatus.OVERDUE,
        to: InvoiceStatus.PAID
      })

      expect(result.recommendedActions).toContain('Remove from overdue tracking')
    })

    it('should handle payment_reversed event', async () => {
      const paidInvoiceMock = {
        ...mockPayment,
        amount: new Decimal(1000),
        invoices: {
          ...mockPayment.invoices,
          status: InvoiceStatus.PAID,
          payments: [
            {
              id: 'payment-123',
              amount: new Decimal(1000),
              paymentDate: new Date(),
              method: PaymentMethod.BANK_TRANSFER,
              reference: 'REF-123'
            }
          ]
        }
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(paidInvoiceMock)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      invoiceStatusService.updateInvoiceStatus.mockResolvedValue({
        success: true,
        oldStatus: InvoiceStatus.PAID,
        newStatus: InvoiceStatus.OVERDUE,
        reason: 'Payment reversed - invoice no longer fully paid'
      })

      const result = await paymentWorkflowService.processPaymentWorkflow(
        'payment-123',
        'payment_reversed',
        mockContext
      )

      expect(result.statusTransition).toMatchObject({
        from: InvoiceStatus.PAID,
        to: InvoiceStatus.OVERDUE
      })

      expect(result.recommendedActions).toContain('Investigate payment reversal')
    })

    it('should enforce company isolation', async () => {
      const wrongCompanyPayment = {
        ...mockPayment,
        invoices: {
          ...mockPayment.invoices,
          companies: {
            id: 'different-company',
            name: 'Different Company'
          }
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
          'payment-123',
          'payment_received',
          mockContext
        )
      ).rejects.toThrow('Access denied: Payment belongs to different company')
    })

    it('should handle payment not found', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(null)
          }
        })
      })

      await expect(
        paymentWorkflowService.processPaymentWorkflow(
          'nonexistent-payment',
          'payment_received',
          mockContext
        )
      ).rejects.toThrow('Payment nonexistent-payment not found')
    })
  })

  describe('processBatchPaymentWorkflow', () => {
    it('should process multiple payment events successfully', async () => {
      const paymentEvents = [
        { paymentId: 'payment-1', event: 'payment_received' as PaymentWorkflowEvent },
        { paymentId: 'payment-2', event: 'payment_completed' as PaymentWorkflowEvent }
      ]

      const mockContext = {
        userId: 'user-123',
        userRole: UserRole.FINANCE,
        companyId: 'company-123',
        batchId: 'batch-123'
      }

      // Mock successful workflow processing
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
          recommendedActions: ['Send partial payment acknowledgment']
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
            complianceFlags: ['TRN_COMPLIANT', 'BANK_TRANSFER_TRACEABLE'],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: ['Send payment confirmation to customer']
        })

      const result = await paymentWorkflowService.processBatchPaymentWorkflow(
        paymentEvents,
        mockContext
      )

      expect(result).toMatchObject({
        totalRequested: 2,
        successCount: 2,
        failedCount: 0,
        aggregatedSummary: {
          totalAmountProcessed: 3000,
          formattedTotalAmount: 'AED 3000.00',
          invoicesFullyPaid: 1,
          invoicesPartiallyPaid: 1,
          statusTransitionsTriggered: 0
        }
      })

      expect(result.results).toHaveLength(2)
      expect(result.processingTime).toBeGreaterThan(0)
    })

    it('should handle mixed success and failure in batch processing', async () => {
      const paymentEvents = [
        { paymentId: 'payment-1', event: 'payment_received' as PaymentWorkflowEvent },
        { paymentId: 'payment-invalid', event: 'payment_completed' as PaymentWorkflowEvent }
      ]

      const mockContext = {
        userId: 'user-123',
        userRole: UserRole.FINANCE,
        companyId: 'company-123'
      }

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
            complianceFlags: [],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: []
        })
        .mockRejectedValueOnce(new Error('Payment not found'))

      const result = await paymentWorkflowService.processBatchPaymentWorkflow(
        paymentEvents,
        mockContext
      )

      expect(result.successCount).toBe(1)
      expect(result.failedCount).toBe(1)
      expect(result.results[1]).toMatchObject({
        success: false,
        paymentId: 'payment-invalid',
        error: 'Payment not found'
      })
    })
  })

  describe('reconcileInvoicePayments', () => {
    it('should reconcile payments successfully when amounts match', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        number: 'INV-001',
        totalAmount: new Decimal(2000),
        amount: new Decimal(2000),
        currency: 'AED',
        payments: [
          {
            id: 'payment-1',
            amount: new Decimal(1000),
            method: PaymentMethod.BANK_TRANSFER,
            paymentDate: new Date('2024-01-10'),
            reference: 'REF-001'
          },
          {
            id: 'payment-2',
            amount: new Decimal(1000),
            method: PaymentMethod.CREDIT_CARD,
            paymentDate: new Date('2024-01-12'),
            reference: 'REF-002'
          }
        ]
      }

      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

      const result = await paymentWorkflowService.reconcileInvoicePayments(
        'invoice-123',
        'company-123'
      )

      expect(result).toMatchObject({
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-001',
        totalInvoiceAmount: 2000,
        totalPaymentsRecorded: 2000,
        discrepancy: 0,
        status: 'RECONCILED',
        recommendedAction: 'Payments reconciled successfully - no action required'
      })

      expect(result.paymentBreakdown).toHaveLength(2)
    })

    it('should detect overpayment', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        number: 'INV-001',
        totalAmount: new Decimal(1000),
        amount: new Decimal(1000),
        currency: 'AED',
        payments: [
          {
            id: 'payment-1',
            amount: new Decimal(1200),
            method: PaymentMethod.BANK_TRANSFER,
            paymentDate: new Date('2024-01-10'),
            reference: 'REF-001'
          }
        ]
      }

      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

      const result = await paymentWorkflowService.reconcileInvoicePayments(
        'invoice-123',
        'company-123'
      )

      expect(result).toMatchObject({
        status: 'OVERPAID',
        discrepancy: 200
      })

      expect(result.recommendedAction).toContain('Process refund or credit note')
    })

    it('should detect underpayment', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        number: 'INV-001',
        totalAmount: new Decimal(2000),
        amount: new Decimal(2000),
        currency: 'AED',
        payments: [
          {
            id: 'payment-1',
            amount: new Decimal(1500),
            method: PaymentMethod.BANK_TRANSFER,
            paymentDate: new Date('2024-01-10'),
            reference: 'REF-001'
          }
        ]
      }

      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

      const result = await paymentWorkflowService.reconcileInvoicePayments(
        'invoice-123',
        'company-123'
      )

      expect(result).toMatchObject({
        status: 'UNDERPAID',
        discrepancy: -500
      })

      expect(result.recommendedAction).toContain('Follow up for outstanding balance')
    })

    it('should handle invoice not found', async () => {
      prisma.invoices.findUnique.mockResolvedValue(null)

      await expect(
        paymentWorkflowService.reconcileInvoicePayments('nonexistent', 'company-123')
      ).rejects.toThrow('Invoice nonexistent not found or access denied')
    })
  })

  describe('processPaymentNotification', () => {
    const mockNotification = {
      externalPaymentId: 'gateway-payment-123',
      invoiceNumber: 'INV-001',
      amount: 1000,
      currency: 'AED',
      method: PaymentMethod.BANK_TRANSFER,
      reference: 'REF-GATEWAY-123',
      paymentDate: new Date('2024-01-15'),
      status: 'success' as const
    }

    const mockInvoice = {
      id: 'invoice-123',
      number: 'INV-001',
      customerName: 'Test Customer',
      totalAmount: new Decimal(1000),
      currency: 'AED',
      payments: []
    }

    it('should process successful payment notification', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          invoices: {
            findUnique: jest.fn().mockResolvedValue(mockInvoice)
          },
          payments: {
            findFirst: jest.fn().mockResolvedValue(null), // No existing payment
            create: jest.fn().mockResolvedValue({
              id: 'new-payment-123',
              ...mockNotification
            })
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      jest.spyOn(paymentWorkflowService, 'processPaymentWorkflow')
        .mockResolvedValue({
          success: true,
          paymentId: 'new-payment-123',
          invoiceId: 'invoice-123',
          invoiceNumber: 'INV-001',
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
            complianceFlags: ['BANK_TRANSFER_TRACEABLE'],
            businessHours: true,
            auditTrailCreated: true
          },
          recommendedActions: ['Send payment confirmation to customer']
        })

      const result = await paymentWorkflowService.processPaymentNotification(
        mockNotification,
        'company-123'
      )

      expect(result.success).toBe(true)
      expect(result.paymentSummary.isFullyPaid).toBe(true)
    })

    it('should handle failed payment notification', async () => {
      const failedNotification = {
        ...mockNotification,
        status: 'failed' as const
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          invoices: {
            findUnique: jest.fn().mockResolvedValue(mockInvoice)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      await expect(
        paymentWorkflowService.processPaymentNotification(
          failedNotification,
          'company-123'
        )
      ).rejects.toThrow('Payment failed - no workflow processing required')
    })

    it('should handle duplicate payment notification', async () => {
      const existingPayment = {
        id: 'existing-payment-123',
        reference: 'gateway-payment-123'
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          invoices: {
            findUnique: jest.fn().mockResolvedValue(mockInvoice)
          },
          payments: {
            findFirst: jest.fn().mockResolvedValue(existingPayment)
          }
        })
      })

      jest.spyOn(paymentWorkflowService, 'processPaymentWorkflow')
        .mockResolvedValue({
          success: true,
          paymentId: 'existing-payment-123',
          invoiceId: 'invoice-123',
          invoiceNumber: 'INV-001',
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
        })

      const result = await paymentWorkflowService.processPaymentNotification(
        mockNotification,
        'company-123'
      )

      expect(result.success).toBe(true)
      // Should process existing payment workflow
    })
  })

  describe('UAE Business Rules Compliance', () => {
    it('should generate correct compliance flags', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: new Decimal(1000),
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'REF-123',
        invoices: {
          id: 'invoice-123',
          number: 'INV-001',
          trnNumber: '123456789012345',
          currency: 'AED',
          status: InvoiceStatus.SENT,
          totalAmount: new Decimal(1000),
          companies: { id: 'company-123', name: 'Test Company' },
          payments: []
        }
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          payments: {
            findUnique: jest.fn().mockResolvedValue(mockPayment)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        })
      })

      const result = await paymentWorkflowService.processPaymentWorkflow(
        'payment-123',
        'payment_received',
        {
          userId: 'user-123',
          userRole: UserRole.FINANCE,
          companyId: 'company-123'
        }
      )

      expect(result.businessRules.complianceFlags).toContain('TRN_COMPLIANT')
      expect(result.businessRules.complianceFlags).toContain('BANK_TRANSFER_TRACEABLE')
      expect(result.businessRules.complianceFlags).toContain('REFERENCE_PROVIDED')
      expect(result.businessRules.complianceFlags).toContain('PROCESSED_BUSINESS_HOURS')
      expect(result.businessRules.uaeCompliant).toBe(true)
    })

    it('should handle business hours correctly', () => {
      // Test during business hours (already mocked)
      const service = new PaymentWorkflowService()
      expect(service['isUAEBusinessHours']()).toBe(true)

      // Test outside business hours
      const fridayEvening = new Date('2024-01-19T20:00:00.000Z') // Friday 12AM Dubai time
      jest.setSystemTime(fridayEvening)
      expect(service['isUAEBusinessHours']()).toBe(false)

      // Test weekend
      const saturday = new Date('2024-01-20T10:00:00.000Z') // Saturday 2PM Dubai time
      jest.setSystemTime(saturday)
      expect(service['isUAEBusinessHours']()).toBe(false)
    })
  })
})