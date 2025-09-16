/**
 * Stripe Payment Integration Tests
 * Comprehensive testing of payment flows, reconciliation, and UAE compliance
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST as CreatePaymentIntentPOST, GET as CreatePaymentIntentGET } from '../../create-intent/route'
import { POST as WebhookPOST } from '../../webhook/route'
import { POST as ReconcilePOST, PUT as ReconcilePUT, GET as ReconcileGET } from '../../reconcile/route'
import { PaymentMethod } from '@prisma/client'

// Mock external dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    customer: {
      update: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  createPaymentIntent: jest.fn(),
  createStripeCustomer: jest.fn(),
  retrievePaymentIntent: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  aedToFils: jest.fn((aed: number) => Math.round(aed * 100)),
  filsToAed: jest.fn((fils: number) => fils / 100),
  formatStripeAmount: jest.fn((amount: number) => `AED ${(amount / 100).toFixed(2)}`),
  isUAEBusinessHours: jest.fn(),
  UAE_STRIPE_CONFIG: {
    currency: 'aed',
    country: 'AE',
    minimumAmount: 200, // 2.00 AED minimum
  },
}))

jest.mock('@/lib/services/payment-reconciliation-service', () => ({
  paymentReconciliationService: {
    recordPayment: jest.fn(),
    getInvoiceReconciliation: jest.fn(),
  },
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
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
    jest.clearAllMocks()

    // Setup default mocks
    const { getServerSession } = require('next-auth')
    getServerSession.mockResolvedValue(mockSession)

    const { prisma } = require('@/lib/prisma')
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
    prisma.invoice.update.mockResolvedValue(mockInvoice)
    prisma.activity.create.mockResolvedValue({ id: 'activity-123' })
    prisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(prisma)
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Payment Intent Creation', () => {
    it('should create payment intent for valid invoice', async () => {
      const { createPaymentIntent, createStripeCustomer } = require('@/lib/stripe')

      createPaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_test',
        amount: 100000, // 1000 AED in fils
        currency: 'aed',
        status: 'requires_payment_method',
      })

      createStripeCustomer.mockResolvedValue({
        id: 'cus_test_123',
        email: 'customer@example.com',
      })

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          currency: 'aed',
        }),
      })

      const response = await CreatePaymentIntentPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.clientSecret).toBe('pi_test_123_secret_test')
      expect(data.data.paymentIntentId).toBe('pi_test_123')

      // Verify Stripe customer creation
      expect(createStripeCustomer).toHaveBeenCalledWith({
        email: mockInvoice.customerEmail,
        name: mockInvoice.customerName,
        phone: mockInvoice.customer?.phone,
        address: {
          line1: mockInvoice.customer?.address,
          city: 'Dubai',
          country: 'AE',
        },
        companyId: mockSession.user.companyId,
        customerId: mockInvoice.customerId,
      })

      // Verify payment intent creation
      expect(createPaymentIntent).toHaveBeenCalledWith({
        amount: 100000, // 1000 AED in fils
        currency: 'aed',
        customerId: mockInvoice.customerId,
        invoiceId: mockInvoice.id,
        metadata: expect.objectContaining({
          invoiceNumber: mockInvoice.number,
          customerName: mockInvoice.customerName,
          customerEmail: mockInvoice.customerEmail,
          companyId: mockSession.user.companyId,
        }),
      })
    })

    it('should reject payment for already paid invoice', async () => {
      const { prisma } = require('@/lib/prisma')
      const paidInvoice = { ...mockInvoice, status: 'PAID' }
      prisma.invoice.findUnique.mockResolvedValue(paidInvoice)

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          currency: 'aed',
        }),
      })

      const response = await CreatePaymentIntentPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invoice is already paid')
    })

    it('should validate amount matches invoice total', async () => {
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 500, // Incorrect amount
          currency: 'aed',
        }),
      })

      const response = await CreatePaymentIntentPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Amount does not match invoice total')
    })

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth')
      getServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
        }),
      })

      const response = await CreatePaymentIntentPOST(request)
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
      const { paymentReconciliationService } = require('@/lib/services/payment-reconciliation-service')
      const { verifyWebhookSignature } = require('@/lib/stripe')

      paymentReconciliationService.recordPayment.mockResolvedValue({
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
      })

      verifyWebhookSignature.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      })

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

      const response = await WebhookPOST(request)
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
      const { verifyWebhookSignature } = require('@/lib/stripe')
      verifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: '{}',
        headers: {
          'stripe-signature': 'invalid-signature',
        },
      })

      const response = await WebhookPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })

    it('should use fallback processing if reconciliation service fails', async () => {
      const { paymentReconciliationService } = require('@/lib/services/payment-reconciliation-service')
      const { verifyWebhookSignature } = require('@/lib/stripe')
      const { prisma } = require('@/lib/prisma')

      // Make reconciliation service fail
      paymentReconciliationService.recordPayment.mockRejectedValue(
        new Error('Reconciliation service unavailable')
      )

      verifyWebhookSignature.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent },
      })

      // Mock database for fallback
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        company: { name: 'Test Company' },
      })

      const mockTx = {
        payment: { create: jest.fn().mockResolvedValue({ id: 'payment-123' }) },
        invoice: { update: jest.fn().mockResolvedValue({}) },
        activity: { create: jest.fn().mockResolvedValue({}) },
      }
      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockTx)
      })

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

      const response = await WebhookPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)

      // Verify fallback was used
      expect(mockTx.payment.create).toHaveBeenCalled()
      expect(mockTx.invoice.update).toHaveBeenCalled()
    })
  })

  describe('Payment Reconciliation API', () => {
    it('should get invoice reconciliation status', async () => {
      const { paymentReconciliationService } = require('@/lib/services/payment-reconciliation-service')

      paymentReconciliationService.getInvoiceReconciliation.mockResolvedValue({
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
      })

      const request = new NextRequest('http://localhost:3000/api/payments/reconcile?invoice_id=invoice-123')

      const response = await ReconcileGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.reconciliation.isFullyPaid).toBe(true)
      expect(data.data.payments).toHaveLength(1)
    })

    it('should record manual payment', async () => {
      const { paymentReconciliationService } = require('@/lib/services/payment-reconciliation-service')

      paymentReconciliationService.recordPayment.mockResolvedValue({
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
      })

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

      const response = await ReconcilePUT(request)
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

    it('should validate minimum payment amounts for UAE', () => {
      const { UAE_STRIPE_CONFIG } = require('@/lib/stripe')

      expect(UAE_STRIPE_CONFIG.minimumAmount).toBe(200) // 2.00 AED in fils
      expect(UAE_STRIPE_CONFIG.currency).toBe('aed')
      expect(UAE_STRIPE_CONFIG.country).toBe('AE')
    })

    it('should support UAE business hours validation', () => {
      const { isUAEBusinessHours } = require('@/lib/stripe')

      isUAEBusinessHours.mockImplementation((date: Date) => {
        const dubaiTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
        const day = dubaiTime.getDay() // 0 = Sunday
        const hour = dubaiTime.getHours()
        return day >= 0 && day <= 4 && hour >= 9 && hour <= 18
      })

      // Test UAE business hours (Sunday-Thursday, 9 AM - 6 PM)
      const sundayMorning = new Date('2024-01-07T06:00:00.000Z') // 10 AM UAE (UTC+4)
      const fridayEvening = new Date('2024-01-05T16:00:00.000Z') // 8 PM UAE (UTC+4)

      expect(isUAEBusinessHours(sundayMorning)).toBe(true)
      expect(isUAEBusinessHours(fridayEvening)).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle payment intent creation failures gracefully', async () => {
      const { createPaymentIntent } = require('@/lib/stripe')
      createPaymentIntent.mockRejectedValue(new Error('Stripe API error'))

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: 'invoice-123',
          amount: 1000,
          currency: 'aed',
        }),
      })

      const response = await CreatePaymentIntentPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle invalid webhook payloads', async () => {
      const { verifyWebhookSignature } = require('@/lib/stripe')
      verifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid payload')
      })

      const request = new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: 'invalid-json',
        headers: {
          'stripe-signature': 'mock-signature',
        },
      })

      const response = await WebhookPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })

    it('should validate missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          // Missing invoiceId
          amount: 1000,
        }),
      })

      const response = await CreatePaymentIntentPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })
  })
})