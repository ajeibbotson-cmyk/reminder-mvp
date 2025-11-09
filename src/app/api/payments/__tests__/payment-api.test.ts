/**
 * Integration Test Suite for Payment API Endpoints
 * Tests the complete payment recording and workflow integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST as PaymentsPost, GET as PaymentsGet } from '../route'
import { POST as WorkflowPost, GET as WorkflowGet } from '../workflow/route'
import { PATCH as PaymentPatch, DELETE as PaymentDelete, GET as PaymentGet } from '../[id]/route'
import { InvoiceStatus, PaymentMethod, UserRole } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Mock external dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    payments: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
      findMany: jest.fn(),
      groupBy: jest.fn()
    }
  }
}))

jest.mock('@/lib/auth-utils', () => ({
  requireRole: jest.fn(),
  canManageInvoices: jest.fn().mockReturnValue(true)
}))

jest.mock('@/lib/services/invoice-status-service', () => ({
  invoiceStatusService: {
    updateInvoiceStatus: jest.fn()
  }
}))

jest.mock('@/lib/services/payment-workflow-service', () => ({
  paymentWorkflowService: {
    processPaymentWorkflow: jest.fn(),
    processBatchPaymentWorkflow: jest.fn(),
    reconcileInvoicePayments: jest.fn(),
    processPaymentNotification: jest.fn()
  }
}))

jest.mock('@/lib/vat-calculator', () => ({
  formatUAECurrency: jest.fn((amount, currency) => {
    const num = amount instanceof Decimal ? amount.toNumber() : amount
    return `${currency} ${num.toFixed(2)}`
  })
}))

const { prisma } = require('@/lib/prisma')
const { requireRole } = require('@/lib/auth-utils')
const { invoiceStatusService } = require('@/lib/services/invoice-status-service')
const { paymentWorkflowService } = require('@/lib/services/payment-workflow-service')

// Test helper functions
function createMockRequest(body: any, method: string = 'POST', searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/payments')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return {
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers(),
    url: url.toString(),
    method
  } as any as NextRequest
}

const mockAuthContext = {
  user: {
    id: 'user-123',
    name: 'Test User',
    role: UserRole.FINANCE,
    companyId: 'company-123'
  }
}

describe('Payment API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requireRole.mockResolvedValue(mockAuthContext)
  })

  describe('POST /api/payments', () => {
    const validPaymentData = {
      invoiceId: 'invoice-123',
      amount: 1000,
      paymentDate: '2024-01-15',
      method: PaymentMethod.BANK_TRANSFER,
      reference: 'REF-123',
      notes: 'Test payment'
    }

    const mockInvoice = {
      id: 'invoice-123',
      number: 'INV-001',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      totalAmount: new Decimal(2000),
      amount: new Decimal(2000),
      currency: 'AED',
      status: InvoiceStatus.SENT,
      dueDate: new Date('2024-01-10'),
      payments: [],
      customer: {
        name: 'Test Customer',
        email: 'test@example.com'
      }
    }

    it('should create payment and update invoice status automatically', async () => {
      const fullPaymentData = {
        ...validPaymentData,
        amount: 2000 // Full payment
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoices: {
            findUnique: jest.fn().mockResolvedValue(mockInvoice)
          },
          payments: {
            create: jest.fn().mockResolvedValue({
              id: 'payment-123',
              ...fullPaymentData,
              createdAt: new Date()
            })
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        }
        return await callback(mockTx)
      })

      invoiceStatusService.updateInvoiceStatus.mockResolvedValue({
        success: true,
        oldStatus: InvoiceStatus.SENT,
        newStatus: InvoiceStatus.PAID,
        reason: 'Payment received - invoice fully paid'
      })

      const request = createMockRequest(fullPaymentData)
      const response = await PaymentsPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.paymentSummary.isFullyPaid).toBe(true)
      expect(responseData.data.statusTransition).toMatchObject({
        automaticUpdate: true,
        from: InvoiceStatus.SENT,
        to: InvoiceStatus.PAID
      })
      
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

    it('should handle partial payments correctly', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoices: {
            findUnique: jest.fn().mockResolvedValue(mockInvoice)
          },
          payments: {
            create: jest.fn().mockResolvedValue({
              id: 'payment-123',
              ...validPaymentData,
              createdAt: new Date()
            })
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        }
        return await callback(mockTx)
      })

      const request = createMockRequest(validPaymentData)
      const response = await PaymentsPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.paymentSummary.isPartialPayment).toBe(true)
      expect(responseData.data.paymentSummary.isFullyPaid).toBe(false)
      expect(responseData.data.statusTransition).toBeNull()
      expect(responseData.data.nextActions).toContain('Send partial payment acknowledgment')
    })

    it('should validate payment amount against invoice total', async () => {
      const overpaymentData = {
        ...validPaymentData,
        amount: 5000 // Way more than invoice total
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoices: {
            findUnique: jest.fn().mockResolvedValue(mockInvoice)
          }
        }
        return await callback(mockTx)
      })

      const request = createMockRequest(overpaymentData)
      const response = await PaymentsPost(request)

      expect(response.status).toBe(400)
    })

    it('should enforce company isolation', async () => {
      const wrongCompanyInvoice = {
        ...mockInvoice,
        companyId: 'different-company'
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoices: {
            findUnique: jest.fn().mockResolvedValue(null) // Simulates not found due to company filter
          }
        }
        return await callback(mockTx)
      })

      const request = createMockRequest(validPaymentData)
      const response = await PaymentsPost(request)

      expect(response.status).toBe(400)
    })

    it('should require proper authentication and permissions', async () => {
      requireRole.mockRejectedValue(new Error('Unauthorized'))

      const request = createMockRequest(validPaymentData)
      const response = await PaymentsPost(request)

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/payments', () => {
    it('should retrieve payments with filtering and pagination', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          amount: new Decimal(1000),
          paymentDate: new Date('2024-01-15'),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'REF-001',
          notes: 'Payment 1',
          createdAt: new Date('2024-01-15'),
          invoices: {
            id: 'invoice-1',
            number: 'INV-001',
            currency: 'AED',
            status: InvoiceStatus.PAID
          }
        }
      ]

      prisma.payment.findMany.mockResolvedValue(mockPayments)
      prisma.payment.count.mockResolvedValue(1)
      
      // Mock payment statistics
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 1000 },
        _avg: { amount: 1000 },
        _count: { id: 1 }
      })
      
      prisma.payment.groupBy.mockResolvedValue([{
        method: PaymentMethod.BANK_TRANSFER,
        _sum: { amount: 1000 },
        _count: { id: 1 }
      }])

      const request = createMockRequest({}, 'GET', {
        page: '1',
        limit: '20',
        includeInvoiceDetails: 'true'
      })

      const response = await PaymentsGet(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.payments).toHaveLength(1)
      expect(responseData.data.pagination.totalCount).toBe(1)
      expect(responseData.data.statistics.paymentCount).toBe(1)
    })

    it('should filter payments by invoice ID', async () => {
      prisma.payment.findMany.mockResolvedValue([])
      prisma.payment.count.mockResolvedValue(0)
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _avg: { amount: null },
        _count: { id: 0 }
      })
      prisma.payment.groupBy.mockResolvedValue([])

      const request = createMockRequest({}, 'GET', {
        invoiceId: 'specific-invoice'
      })

      const response = await PaymentsGet(request)

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceId: 'specific-invoice'
          })
        })
      )
    })
  })

  describe('Payment Workflow API', () => {
    it('should process single payment workflow event', async () => {
      const workflowData = {
        paymentId: 'payment-123',
        event: 'payment_received',
        reason: 'Test workflow'
      }

      paymentWorkflowService.processPaymentWorkflow.mockResolvedValue({
        success: true,
        paymentId: 'payment-123',
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-001',
        event: 'payment_received',
        paymentSummary: {
          totalPaid: 1000,
          remainingAmount: 500,
          paymentCount: 1,
          isPartialPayment: true,
          isFullyPaid: false,
          formattedAmounts: {
            totalPaid: 'AED 1000.00',
            remainingAmount: 'AED 500.00',
            currentPayment: 'AED 1000.00'
          }
        },
        businessRules: {
          uaeCompliant: true,
          complianceFlags: ['TRN_COMPLIANT'],
          businessHours: true,
          auditTrailCreated: true
        },
        recommendedActions: ['Send partial payment acknowledgment']
      })

      const request = createMockRequest(workflowData)
      const response = await WorkflowPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.workflowResult.success).toBe(true)
      expect(responseData.data.nextSteps).toContain('Send partial payment acknowledgment')
    })

    it('should process batch payment workflow', async () => {
      const batchData = {
        paymentEvents: [
          { paymentId: 'payment-1', event: 'payment_received' },
          { paymentId: 'payment-2', event: 'payment_completed' }
        ],
        batchId: 'batch-123'
      }

      paymentWorkflowService.processBatchPaymentWorkflow.mockResolvedValue({
        totalRequested: 2,
        successCount: 2,
        failedCount: 0,
        results: [],
        aggregatedSummary: {
          totalAmountProcessed: 3000,
          formattedTotalAmount: 'AED 3000.00',
          invoicesFullyPaid: 1,
          invoicesPartiallyPaid: 1,
          statusTransitionsTriggered: 1
        },
        processingTime: 150
      })

      const request = createMockRequest(batchData, 'POST', { operation: 'batch' })
      const response = await WorkflowPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.batchResult.successCount).toBe(2)
      expect(responseData.data.performance.throughput).toBeGreaterThan(0)
    })

    it('should process payment webhook notifications', async () => {
      const webhookData = {
        externalPaymentId: 'gateway-123',
        invoiceNumber: 'INV-001',
        amount: 1000,
        currency: 'AED',
        method: PaymentMethod.BANK_TRANSFER,
        paymentDate: '2024-01-15',
        status: 'success',
        gatewayMetadata: { gateway: 'test' }
      }

      paymentWorkflowService.processPaymentNotification.mockResolvedValue({
        success: true,
        paymentId: 'payment-123',
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-001',
        event: 'payment_received',
        paymentSummary: {
          totalPaid: 1000,
          remainingAmount: 0,
          paymentCount: 1,
          isPartialPayment: false,
          isFullyPaid: true,
          formattedAmounts: {
            totalPaid: 'AED 1000.00',
            remainingAmount: 'AED 0.00',
            currentPayment: 'AED 1000.00'
          }
        },
        businessRules: {
          uaeCompliant: true,
          complianceFlags: ['BANK_TRANSFER_TRACEABLE'],
          businessHours: true,
          auditTrailCreated: true
        },
        recommendedActions: ['Send payment confirmation to customer']
      })

      const request = createMockRequest(webhookData, 'POST', { operation: 'webhook' })
      // Mock webhook authentication
      request.headers.set('x-webhook-secret', 'uaepay-webhook-secret')

      const response = await WorkflowPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.webhookResult.paymentSummary.isFullyPaid).toBe(true)
    })

    it('should reconcile invoice payments', async () => {
      paymentWorkflowService.reconcileInvoicePayments.mockResolvedValue({
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-001',
        totalInvoiceAmount: 2000,
        totalPaymentsRecorded: 2000,
        discrepancy: 0,
        status: 'RECONCILED',
        recommendedAction: 'Payments reconciled successfully - no action required',
        paymentBreakdown: [
          {
            paymentId: 'payment-1',
            amount: 1000,
            method: PaymentMethod.BANK_TRANSFER,
            date: new Date('2024-01-10'),
            reference: 'REF-001'
          },
          {
            paymentId: 'payment-2',
            amount: 1000,
            method: PaymentMethod.CREDIT_CARD,
            date: new Date('2024-01-12'),
            reference: 'REF-002'
          }
        ]
      })

      const request = createMockRequest({}, 'POST', { 
        operation: 'reconcile',
        invoiceId: 'invoice-123'
      })

      const response = await WorkflowPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.reconciliation.status).toBe('RECONCILED')
      expect(responseData.data.reconciliation.discrepancy).toBe(0)
    })
  })

  describe('Individual Payment Management', () => {
    it('should get payment details with full context', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: new Decimal(1000),
        paymentDate: new Date('2024-01-15'),
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'REF-123',
        notes: 'Test payment',
        createdAt: new Date('2024-01-15'),
        invoices: {
          id: 'invoice-123',
          number: 'INV-001',
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          totalAmount: new Decimal(2000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date('2024-01-20'),
          company: {
            id: 'company-123',
            name: 'Test Company'
          },
          customer: {
            name: 'Test Customer',
            email: 'test@example.com'
          },
          payments: [
            {
              id: 'payment-123',
              amount: new Decimal(1000),
              paymentDate: new Date('2024-01-15'),
              method: PaymentMethod.BANK_TRANSFER,
              reference: 'REF-123'
            }
          ]
        }
      }

      prisma.payment.findUnique.mockResolvedValue(mockPayment)

      const request = createMockRequest({}, 'GET')
      const response = await PaymentGet(request, { params: { id: 'payment-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.payment.id).toBe('payment-123')
      expect(responseData.data.paymentContext.totalPaid).toBe(1000)
      expect(responseData.data.paymentContext.remainingAmount).toBe(1000)
      expect(responseData.data.allPayments).toHaveLength(1)
    })

    it('should update payment and recalculate status', async () => {
      const updateData = {
        amount: 1500,
        notes: 'Updated payment amount'
      }

      const mockCurrentPayment = {
        id: 'payment-123',
        amount: new Decimal(1000),
        invoices: {
          id: 'invoice-123',
          number: 'INV-001',
          totalAmount: new Decimal(2000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          company: { id: 'company-123' },
          payments: [{ id: 'payment-123', amount: new Decimal(1000) }]
        }
      }

      const updatedPayment = {
        ...mockCurrentPayment,
        amount: new Decimal(1500),
        notes: 'Updated payment amount'
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          payments: {
            findUnique: jest.fn().mockResolvedValue(mockCurrentPayment),
            update: jest.fn().mockResolvedValue(updatedPayment),
            findMany: jest.fn().mockResolvedValue([{ amount: new Decimal(1500) }])
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        }
        return await callback(mockTx)
      })

      const request = createMockRequest(updateData, 'PATCH')
      const response = await PaymentPatch(request, { params: { id: 'payment-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.payment.amount).toBe(1500)
      expect(responseData.data.paymentSummary.totalPaid).toBe(1500)
    })

    it('should delete payment and update invoice status', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: new Decimal(2000),
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'REF-123',
        invoices: {
          id: 'invoice-123',
          number: 'INV-001',
          totalAmount: new Decimal(2000),
          currency: 'AED',
          status: InvoiceStatus.PAID,
          company: { id: 'company-123' },
          payments: [{ id: 'payment-123', amount: new Decimal(2000) }]
        }
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          payments: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            delete: jest.fn().mockResolvedValue(mockPayment)
          },
          activities: {
            create: jest.fn().mockResolvedValue({ id: 'activity-123' })
          }
        }
        return await callback(mockTx)
      })

      invoiceStatusService.updateInvoiceStatus.mockResolvedValue({
        success: true,
        oldStatus: InvoiceStatus.PAID,
        newStatus: InvoiceStatus.SENT,
        reason: 'Payment deleted - invoice no longer fully paid'
      })

      const request = createMockRequest({}, 'DELETE')
      const response = await PaymentDelete(request, { params: { id: 'payment-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.data.deleted).toBe(true)
      expect(responseData.data.statusUpdate.from).toBe(InvoiceStatus.PAID)
      expect(responseData.data.statusUpdate.to).toBe(InvoiceStatus.SENT)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database transaction failures', async () => {
      prisma.$transaction.mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest({
        invoiceId: 'invoice-123',
        amount: 1000,
        paymentDate: '2024-01-15',
        method: PaymentMethod.BANK_TRANSFER
      })

      const response = await PaymentsPost(request)
      expect(response.status).toBe(500)
    })

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required fields
        amount: 1000
      }

      const request = createMockRequest(invalidData)
      const response = await PaymentsPost(request)
      expect(response.status).toBe(400)
    })

    it('should handle invalid payment amounts', async () => {
      const invalidData = {
        invoiceId: 'invoice-123',
        amount: -100, // Negative amount
        paymentDate: '2024-01-15',
        method: PaymentMethod.BANK_TRANSFER
      }

      const request = createMockRequest(invalidData)
      const response = await PaymentsPost(request)
      expect(response.status).toBe(400)
    })
  })
})