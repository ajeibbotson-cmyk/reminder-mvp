/**
 * Stripe Payment Integration Tests
 * Comprehensive testing of payment flows, reconciliation, and UAE compliance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { prismaMock } from '../setup/prisma-mock'
import { PaymentMethod } from '@prisma/client'

// Mock external dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  createPaymentIntent: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  aedToFils: vi.fn((aed: number) => Math.round(aed * 100)),
  filsToAed: vi.fn((fils: number) => fils / 100),
  formatStripeAmount: vi.fn((amount: number) => `AED ${(amount / 100).toFixed(2)}`),
}))

vi.mock('@/lib/services/payment-reconciliation-service', () => ({
  paymentReconciliationService: {
    recordPayment: vi.fn(),
    getInvoiceReconciliation: vi.fn(),
    bulkReconcilePayments: vi.fn(),
  },
}))

describe('Stripe Payment Integration', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'admin@company.com',
      companyId: 'company-123',
      role: 'ADMIN',
    },
  }

  const mockInvoice = {
    id: 'invoice-123',
    number: 'INV-2024-001',
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    totalAmount: { toString: () => '1000.00' },
    currency: 'AED',
    dueDate: new Date('2024-01-31'),
    status: 'SENT',
    companyId: 'company-123',
    customerId: 'customer-123',
    paymentIntentId: null,
    company: {
      name: 'Test Company LLC',
    },
    customer: {
      phone: '+971501234567',
      address: 'Dubai, UAE',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession)
  })

  describe('Payment Intent Creation API', () => {
    it('should create payment intent for valid invoice', async () => {
      // Mock database response
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any)
      prismaMock.invoice.update.mockResolvedValue(mockInvoice as any)
      prismaMock.activity.create.mockResolvedValue({} as any)

      // Mock Stripe functions
      const { createPaymentIntent, createStripeCustomer } = await import('@/lib/stripe')
      vi.mocked(createPaymentIntent).mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_test',
        amount: 100000, // 1000 AED in fils
        currency: 'aed',
        status: 'requires_payment_method',
      } as any)

      vi.mocked(createStripeCustomer).mockResolvedValue({
        id: 'cus_test_123',
        email: 'customer@example.com',
      } as any)

      // Import API handler
      const { POST } = await import('@/app/api/payments/create-intent/route')

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          currency: 'aed',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.clientSecret).toBe('pi_test_123_secret_test')
      expect(data.data.paymentIntentId).toBe('pi_test_123')

      // Verify database updates
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: {
          paymentIntentId: 'pi_test_123',
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should reject payment for already paid invoice', async () => {
      const paidInvoice = { ...mockInvoice, status: 'PAID' }
      prismaMock.invoice.findUnique.mockResolvedValue(paidInvoice as any)

      const { POST } = await import('@/app/api/payments/create-intent/route')

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          currency: 'aed',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invoice is already paid')
    })

    it('should validate amount matches invoice total', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any)

      const { POST } = await import('@/app/api/payments/create-intent/route')

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 500, // Incorrect amount
          currency: 'aed',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Amount does not match invoice total')
    })

    it('should require authentication', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const { POST } = await import('@/app/api/payments/create-intent/route')

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('Webhook Payment Processing', () => {
    const mockPaymentIntent = {
      id: 'pi_test_123',
      amount: 100000, // 1000 AED in fils
      currency: 'aed',
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000),
      metadata: {
        invoiceId: 'invoice-123',
        companyId: 'company-123',
        invoiceNumber: 'INV-2024-001',
      },
      charges: {
        data: [{ id: 'ch_test_123' }],
      },
    }

    it('should process successful payment through reconciliation service', async () => {
      const { paymentReconciliationService } = await import('@/lib/services/payment-reconciliation-service')

      vi.mocked(paymentReconciliationService.recordPayment).mockResolvedValue({
        payment: { id: 'payment-123' },
        reconciliation: {
          invoiceNumber: 'INV-2024-001',
          paymentStatus: 'FULLY_PAID',
          isFullyPaid: true,
          totalPaid: { toNumber: () => 1000 },
          formattedAmounts: {
            newPayment: 'AED 1,000.00',
          },
        },
        auditEntry: {},
        statusUpdateResult: { success: true },
      } as any)

      // Mock webhook handler
      const { POST } = await import('@/app/api/payments/webhook/route')

      const webhookPayload = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      })

      const request = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: webhookPayload,
        headers: {
          'stripe-signature': 'mock-signature',
        },
      })

      // Mock signature verification
      const { verifyWebhookSignature } = await import('@/lib/stripe')
      vi.mocked(verifyWebhookSignature).mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      } as any)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)

      // Verify reconciliation service was called
      expect(paymentReconciliationService.recordPayment).toHaveBeenCalledWith(
        'invoice-123',
        {
          amount: 1000,
          paymentDate: expect.any(Date),
          method: 'STRIPE_CARD',
          reference: 'pi_test_123',
          notes: expect.stringContaining('Stripe payment'),
        },
        {
          userId: 'stripe-webhook',
          userRole: 'ADMIN',
          companyId: 'company-123',
          validateBusinessRules: false,
          autoUpdateInvoiceStatus: true,
          notifyCustomer: true,
        },
        {
          allowOverpayment: true,
          overpaymentTolerancePercent: 2.0,
          validateBusinessHours: false,
        }
      )
    })

    it('should handle webhook signature verification failure', async () => {
      const { verifyWebhookSignature } = await import('@/lib/stripe')
      vi.mocked(verifyWebhookSignature).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const { POST } = await import('@/app/api/payments/webhook/route')

      const request = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: '{}',
        headers: {
          'stripe-signature': 'invalid-signature',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })

    it('should use fallback processing if reconciliation service fails', async () => {
      const { paymentReconciliationService } = await import('@/lib/services/payment-reconciliation-service')

      // Make reconciliation service fail
      vi.mocked(paymentReconciliationService.recordPayment).mockRejectedValue(
        new Error('Reconciliation service unavailable')
      )

      // Mock database for fallback
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any)
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: { create: vi.fn().mockResolvedValue({ id: 'payment-123' }) },
          invoice: { update: vi.fn().mockResolvedValue({}) },
          activity: { create: vi.fn().mockResolvedValue({}) },
        }
        return callback(mockTx)
      })

      const { POST } = await import('@/app/api/payments/webhook/route')
      const { verifyWebhookSignature } = await import('@/lib/stripe')

      vi.mocked(verifyWebhookSignature).mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      } as any)

      const webhookPayload = JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      })

      const request = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: webhookPayload,
        headers: {
          'stripe-signature': 'mock-signature',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)

      // Verify fallback was used
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })
  })

  describe('Payment Reconciliation API', () => {
    it('should get invoice reconciliation status', async () => {
      const { paymentReconciliationService } = await import('@/lib/services/payment-reconciliation-service')

      vi.mocked(paymentReconciliationService.getInvoiceReconciliation).mockResolvedValue({
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-2024-001',
        paymentStatus: 'FULLY_PAID',
        totalPaid: { toNumber: () => 1000 },
        remainingAmount: { toNumber: () => 0 },
        isFullyPaid: true,
        isOverpaid: false,
        formattedAmounts: {
          totalPaid: 'AED 1,000.00',
          remainingAmount: 'AED 0.00',
        },
        payments: [
          {
            id: 'payment-123',
            amount: 1000,
            formattedAmount: 'AED 1,000.00',
            paymentDate: new Date(),
            method: PaymentMethod.STRIPE_CARD,
            reference: 'pi_test_123',
          },
        ],
        paymentTimeline: [],
      } as any)

      const { GET } = await import('@/app/api/payments/reconcile/route')

      const request = new NextRequest('http://localhost:3000/api/payments/reconcile?invoice_id=invoice-123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.reconciliation.isFullyPaid).toBe(true)
      expect(data.data.payments).toHaveLength(1)
    })

    it('should record manual payment', async () => {
      const { paymentReconciliationService } = await import('@/lib/services/payment-reconciliation-service')

      vi.mocked(paymentReconciliationService.recordPayment).mockResolvedValue({
        payment: { id: 'payment-456' },
        reconciliation: {
          invoiceNumber: 'INV-2024-001',
          paymentStatus: 'FULLY_PAID',
          isFullyPaid: true,
          totalPaid: { toNumber: () => 1000 },
          remainingAmount: { toNumber: () => 0 },
          formattedAmounts: {
            newPayment: 'AED 1,000.00',
          },
        },
        auditEntry: {},
        statusUpdateResult: { success: true },
      } as any)

      const { PUT } = await import('@/app/api/payments/reconcile/route')

      const request = new NextRequest('http://localhost:3000/api/payments/reconcile', {
        method: 'PUT',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'TXN123456',
          notes: 'Manual payment entry',
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.reconciliation.isFullyPaid).toBe(true)

      expect(paymentReconciliationService.recordPayment).toHaveBeenCalledWith(
        'invoice-123',
        {
          amount: 1000,
          paymentDate: expect.any(Date),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'TXN123456',
          notes: 'Manual payment entry',
        },
        {
          userId: 'user-123',
          userRole: 'ADMIN',
          companyId: 'company-123',
          validateBusinessRules: true,
          autoUpdateInvoiceStatus: true,
          notifyCustomer: true,
        }
      )
    })
  })

  describe('UAE Business Compliance', () => {
    it('should handle AED currency formatting correctly', () => {
      const { aedToFils, filsToAed, formatStripeAmount } = require('@/lib/stripe')

      expect(aedToFils(100.50)).toBe(10050)
      expect(aedToFils(1000)).toBe(100000)
      expect(filsToAed(10050)).toBe(100.50)
      expect(filsToAed(100000)).toBe(1000)
      expect(formatStripeAmount(100000)).toBe('AED 1000.00')
    })

    it('should validate minimum payment amounts for UAE', async () => {
      const { createPaymentIntent, UAE_STRIPE_CONFIG } = await import('@/lib/stripe')

      expect(UAE_STRIPE_CONFIG.minimumAmount).toBe(200) // 2.00 AED in fils
      expect(UAE_STRIPE_CONFIG.currency).toBe('aed')
      expect(UAE_STRIPE_CONFIG.country).toBe('AE')
    })

    it('should support UAE business hours validation', async () => {
      const { isUAEBusinessHours } = await import('@/lib/stripe')

      // Test UAE business hours (Sunday-Thursday, 9 AM - 6 PM)
      const sundayMorning = new Date('2024-01-07T10:00:00+04:00') // Sunday 10 AM UAE
      const fridayEvening = new Date('2024-01-05T20:00:00+04:00') // Friday 8 PM UAE

      expect(isUAEBusinessHours(sundayMorning)).toBe(true)
      expect(isUAEBusinessHours(fridayEvening)).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle payment intent creation failures gracefully', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any)

      const { createPaymentIntent } = await import('@/lib/stripe')
      vi.mocked(createPaymentIntent).mockRejectedValue(new Error('Stripe API error'))

      const { POST } = await import('@/app/api/payments/create-intent/route')

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          currency: 'aed',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle invalid webhook payloads', async () => {
      const { POST } = await import('@/app/api/payments/webhook/route')

      const request = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: 'invalid-json',
        headers: {
          'stripe-signature': 'mock-signature',
        },
      })

      const { verifyWebhookSignature } = await import('@/lib/stripe')
      vi.mocked(verifyWebhookSignature).mockImplementation(() => {
        throw new Error('Invalid payload')
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })
  })
})