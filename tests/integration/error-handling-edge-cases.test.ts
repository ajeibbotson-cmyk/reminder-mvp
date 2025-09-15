/**
 * Phase 4 Sprint 1.5: Error Handling & Edge Cases Integration Tests
 * 
 * Tests comprehensive error scenarios and edge cases:
 * - Payment edge cases (overpayments, partial payments)
 * - Invalid data validation (malformed TRN, invalid VAT rates)
 * - Multi-tenant data isolation
 * - Proper error messages in both Arabic and English
 * - Network failures and recovery
 * - Database constraint violations
 * - Concurrent operation conflicts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { NextRequest } from 'next/server'
import { InvoiceStatus, PaymentMethod, UserRole, TaxCategory } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Import API handlers
import { GET as InvoicesGet, POST as InvoicesPost } from '../../src/app/api/invoices/route'
import { POST as PaymentsPost } from '../../src/app/api/payments/route'
import { POST as SignupPost } from '../../src/app/api/auth/signup/route'
import { PATCH as StatusPatch } from '../../src/app/api/invoices/[id]/status/route'
import { POST as BulkPost } from '../../src/app/api/invoices/bulk/route'

// Import services
import { prisma } from '../../src/lib/prisma'

// Test data generators for edge cases
function generateEdgeCaseCompany(suffix: string) {
  const timestamp = Date.now()
  return {
    id: `edge-company-${suffix}-${timestamp}`,
    name: `Edge Case Company ${suffix}`,
    trn: `100${timestamp.toString().slice(-12)}3`,
    email: `edge${suffix}@uaetest.ae`,
    phone: '+971501234567',
    address: 'Dubai, UAE',
    defaultVatRate: new Decimal(5.0),
    currency: 'AED',
    timezone: 'Asia/Dubai',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateEdgeCaseUser(companyId: string, suffix: string) {
  const timestamp = Date.now()
  return {
    id: `edge-user-${suffix}-${timestamp}`,
    email: `edgeuser${suffix}@uaetest.ae`,
    name: `Edge Case User ${suffix}`,
    role: UserRole.FINANCE,
    companyId,
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function createAuthenticatedRequest(url: string, method: string = 'GET', body?: any, headers?: Record<string, string>) {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      'Accept-Language': 'en,ar',
      ...headers
    },
    ...(body && { body: JSON.stringify(body) })
  })
}

describe('Error Handling & Edge Cases Integration Tests - Phase 4 Sprint 1.5', () => {
  let testCompany: any
  let testUser: any
  let testCustomer: any

  beforeAll(async () => {
    // Clean up any existing edge case test data
    await prisma.activities.deleteMany({ where: { companyId: { contains: 'edge-company-' } } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'edge-invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'edge-invoice-' } } })
    await prisma.invoices.deleteMany({ where: { id: { contains: 'edge-invoice-' } } })
    await prisma.customers.deleteMany({ where: { companyId: { contains: 'edge-company-' } } })
    await prisma.users.deleteMany({ where: { id: { contains: 'edge-user-' } } })
    await prisma.companies.deleteMany({ where: { id: { contains: 'edge-company-' } } })
  })

  beforeEach(async () => {
    testCompany = generateEdgeCaseCompany('main')
    testUser = generateEdgeCaseUser(testCompany.id, 'main')
    testCustomer = {
      id: `edge-customer-${Date.now()}`,
      name: 'Edge Case Customer',
      nameAr: 'عميل الحالة الحدية',
      email: 'edgecustomer@uaetest.ae',
      phone: '+971507654321',
      address: 'Abu Dhabi, UAE',
      addressAr: 'أبوظبي، دولة الإمارات العربية المتحدة',
      companyId: testCompany.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await prisma.companies.create({ data: testCompany })
    await prisma.users.create({ data: testUser })
    await prisma.customers.create({ data: testCustomer })
  })

  afterEach(async () => {
    await prisma.activities.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'edge-invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'edge-invoice-' } } })
    await prisma.invoices.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.customers.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.users.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.companies.deleteMany({ where: { id: testCompany.id } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Payment Edge Cases', () => {
    it('should handle overpayment attempts gracefully', async () => {
      // Create invoice
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-overpay',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'OVERPAY-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Attempt overpayment
      const overpaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: invoice.id,
          amount: 1500, // 50% more than invoice total
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'OVERPAY-REF-001',
          notes: 'Overpayment attempt test'
        }
      )

      const response = await PaymentsPost(overpaymentRequest)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('OVERPAYMENT_NOT_ALLOWED')
      expect(data.error.message).toContain('exceeds')
      expect(data.error.details.invoiceTotal).toBe(1000)
      expect(data.error.details.attemptedPayment).toBe(1500)
      expect(data.error.details.maxAllowed).toBe(1000)
    })

    it('should handle multiple small overpayments', async () => {
      // Create invoice
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-multi-overpay',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'MULTI-OVERPAY-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Make partial payment first
      const partialPayment = await prisma.payments.create({
        data: {
          id: 'partial-payment-1',
          invoiceId: invoice.id,
          amount: new Decimal(800),
          paymentDate: new Date(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'PARTIAL-001',
          notes: 'Partial payment',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Attempt to pay more than remaining amount
      const overpaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: invoice.id,
          amount: 300, // Only 200 remaining, so this is 100 overpayment
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.CREDIT_CARD,
          reference: 'FINAL-OVERPAY-001',
          notes: 'Final payment with overpayment'
        }
      )

      const response = await PaymentsPost(overpaymentRequest)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('OVERPAYMENT_NOT_ALLOWED')
      expect(data.error.details.remainingAmount).toBe(200)
      expect(data.error.details.attemptedPayment).toBe(300)
    })

    it('should handle zero and negative payment amounts', async () => {
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-zero-pay',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'ZERO-PAY-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Test zero payment
      const zeroPaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: invoice.id,
          amount: 0,
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'ZERO-REF-001'
        }
      )

      const zeroResponse = await PaymentsPost(zeroPaymentRequest)
      expect(zeroResponse.status).toBe(400)

      const zeroData = await zeroResponse.json()
      expect(zeroData.success).toBe(false)
      expect(zeroData.error.code).toBe('INVALID_PAYMENT_AMOUNT')

      // Test negative payment
      const negativePaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: invoice.id,
          amount: -100,
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'NEG-REF-001'
        }
      )

      const negativeResponse = await PaymentsPost(negativePaymentRequest)
      expect(negativeResponse.status).toBe(400)

      const negativeData = await negativeResponse.json()
      expect(negativeData.success).toBe(false)
      expect(negativeData.error.code).toBe('INVALID_PAYMENT_AMOUNT')
    })

    it('should handle payments to non-existent invoices', async () => {
      const nonExistentPaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: 'non-existent-invoice-id',
          amount: 1000,
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'NON-EXIST-REF-001'
        }
      )

      const response = await PaymentsPost(nonExistentPaymentRequest)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVOICE_NOT_FOUND')
    })

    it('should handle payments with invalid future dates', async () => {
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-future-pay',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'FUTURE-PAY-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Payment date far in the future
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year in future
      const futurePaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: invoice.id,
          amount: 1000,
          paymentDate: futureDate.toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'FUTURE-REF-001'
        }
      )

      const response = await PaymentsPost(futurePaymentRequest)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_PAYMENT_DATE')
    })
  })

  describe('Invalid Data Validation', () => {
    it('should reject malformed TRN formats', async () => {
      const malformedTRNs = [
        '123456789',        // Too short
        '1234567890123456', // Too long
        'ABC123456780003',  // Contains letters
        '000000000000000',  // All zeros
        '999999999999999',  // Invalid check digit
        '12345678901234a',  // Mixed alphanumeric
        '12-345-678-901-23', // With hyphens
        '',                 // Empty
        null,               // Null
        undefined           // Undefined
      ]

      for (const invalidTRN of malformedTRNs) {
        const signupData = {
          companyName: `Invalid TRN Company ${invalidTRN}`,
          trn: invalidTRN,
          name: 'Test User',
          email: `invalid${Date.now()}@uaetest.ae`,
          password: 'SecurePass123!'
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/auth/signup',
          'POST',
          signupData
        )

        const response = await SignupPost(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('INVALID_TRN_FORMAT')
        expect(data.error.field).toBe('trn')
      }
    })

    it('should reject invalid VAT rates', async () => {
      const invalidVATRates = [-1, 101, 999, -0.5, 50.5, NaN, Infinity, null, undefined]

      for (const invalidRate of invalidVATRates) {
        const invoiceData = {
          companyId: testCompany.id,
          number: `INVALID-VAT-${Date.now()}`,
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: 1000,
          currency: 'AED',
          trnNumber: testCompany.trn,
          items: [{
            description: 'Invalid VAT test item',
            quantity: 1,
            unitPrice: 1000,
            vatRate: invalidRate,
            taxCategory: TaxCategory.STANDARD
          }]
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices',
          'POST',
          invoiceData
        )

        const response = await InvoicesPost(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('INVALID_VAT_RATE')
      }
    })

    it('should validate email formats strictly', async () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user@domain',
        'user@domain.',
        'user name@domain.com', // Space in local part
        'user@domain com',      // Space in domain
        'user@domain..com',     // Double dot
        '',                     // Empty
        null,                   // Null
        'user@.com',           // Leading dot in domain
        'user@domain.c',       // Single character TLD
        'a'.repeat(300) + '@domain.com' // Too long
      ]

      for (const invalidEmail of invalidEmails) {
        const signupData = {
          companyName: 'Email Test Company',
          trn: '100123456780003',
          name: 'Test User',
          email: invalidEmail,
          password: 'SecurePass123!'
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/auth/signup',
          'POST',
          signupData
        )

        const response = await SignupPost(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('INVALID_EMAIL_FORMAT')
      }
    })

    it('should validate currency codes', async () => {
      const invalidCurrencies = ['INVALID', 'AE', 'AEDD', '123', '', null, undefined]

      for (const invalidCurrency of invalidCurrencies) {
        const invoiceData = {
          companyId: testCompany.id,
          number: `INVALID-CURR-${Date.now()}`,
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: 1000,
          currency: invalidCurrency,
          trnNumber: testCompany.trn,
          items: [{
            description: 'Invalid currency test item',
            quantity: 1,
            unitPrice: 1000,
            vatRate: 5,
            taxCategory: TaxCategory.STANDARD
          }]
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices',
          'POST',
          invoiceData
        )

        const response = await InvoicesPost(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('INVALID_CURRENCY')
      }
    })
  })

  describe('Multi-tenant Data Isolation', () => {
    it('should prevent cross-company data access in invoice operations', async () => {
      // Create second company and user
      const otherCompany = generateEdgeCaseCompany('other')
      const otherUser = generateEdgeCaseUser(otherCompany.id, 'other')

      await prisma.companies.create({ data: otherCompany })
      await prisma.users.create({ data: otherUser })

      // Create invoice in first company
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-isolation',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'ISOLATION-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Mock auth context to simulate other company user trying to access
      // This would normally be handled by auth middleware, but we simulate the database query result
      const invoiceFromOtherCompany = await prisma.invoices.findUnique({
        where: {
          id: invoice.id,
          companyId: otherCompany.id // Should not find invoice from different company
        }
      })

      expect(invoiceFromOtherCompany).toBeNull()

      // Cleanup
      await prisma.users.delete({ where: { id: otherUser.id } })
      await prisma.companies.delete({ where: { id: otherCompany.id } })
    })

    it('should prevent cross-company payment access', async () => {
      // Create second company
      const otherCompany = generateEdgeCaseCompany('payment-isolation')
      await prisma.companies.create({ data: otherCompany })

      // Create invoice and payment in first company
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-payment-isolation',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'PAY-ISOLATION-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const payment = await prisma.payments.create({
        data: {
          id: 'edge-payment-isolation',
          invoiceId: invoice.id,
          amount: new Decimal(1000),
          paymentDate: new Date(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'ISOLATION-PAY-001',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Try to access payment from other company context
      const paymentFromOtherCompany = await prisma.payments.findUnique({
        where: { id: payment.id },
        include: {
          invoices: {
            where: { companyId: otherCompany.id }
          }
        }
      })

      // Should find payment but not the invoice (due to company filter)
      expect(paymentFromOtherCompany).toBeTruthy()
      expect(paymentFromOtherCompany!.invoices).toBeNull()

      // Cleanup
      await prisma.companies.delete({ where: { id: otherCompany.id } })
    })

    it('should prevent bulk operations across companies', async () => {
      // Create second company with invoice
      const otherCompany = generateEdgeCaseCompany('bulk-isolation')
      const otherCustomer = {
        id: `edge-customer-other-${Date.now()}`,
        name: 'Other Company Customer',
        email: 'other@uaetest.ae',
        companyId: otherCompany.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await prisma.companies.create({ data: otherCompany })
      await prisma.customers.create({ data: otherCustomer })

      const otherInvoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-other-company',
          companyId: otherCompany.id,
          customerId: otherCustomer.id,
          number: 'OTHER-001',
          customerName: otherCustomer.name,
          customerEmail: otherCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: otherCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create invoice in test company
      const testInvoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-test-company',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'TEST-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Attempt bulk operation including invoice from other company
      const bulkRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices/bulk',
        'POST',
        {
          operation: 'status_update',
          invoiceIds: [testInvoice.id, otherInvoice.id], // Mix of different companies
          data: {
            status: InvoiceStatus.SENT,
            reason: 'Cross-company bulk test'
          }
        }
      )

      const response = await BulkPost(bulkRequest)
      expect(response.status).toBe(200) // Should partially succeed

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.successCount).toBe(1) // Only test company invoice
      expect(data.data.failedCount).toBe(1)  // Other company invoice should fail
      expect(data.data.errors).toHaveLength(1)
      expect(data.data.errors[0].code).toBe('INVOICE_NOT_FOUND')

      // Cleanup
      await prisma.invoices.delete({ where: { id: otherInvoice.id } })
      await prisma.customers.delete({ where: { id: otherCustomer.id } })
      await prisma.companies.delete({ where: { id: otherCompany.id } })
    })
  })

  describe('Bilingual Error Messages', () => {
    it('should provide Arabic error messages when Arabic locale is requested', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        {
          // Missing required fields to trigger validation errors
          companyId: testCompany.id,
          number: '',
          customerName: '',
          customerEmail: 'invalid-email'
        },
        { 'Accept-Language': 'ar' }
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.message_ar).toBeDefined()
      expect(data.error.message_ar).toMatch(/مطلوب|غير صحيح|خطأ/) // Contains Arabic error terms
    })

    it('should provide English error messages by default', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: 'non-existent',
          amount: -100,
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER
        }
      )

      const response = await PaymentsPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.message).toBeDefined()
      expect(data.error.message).toMatch(/invalid|required|not found/i)
      expect(data.error.code).toBeDefined()
    })

    it('should provide bilingual validation for TRN errors', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/auth/signup',
        'POST',
        {
          companyName: 'Test Company',
          trn: '123456789', // Invalid TRN
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        },
        { 'Accept-Language': 'ar,en' }
      )

      const response = await SignupPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.message).toBeDefined()
      expect(data.error.message_ar).toBeDefined()
      expect(data.error.code).toBe('INVALID_TRN_FORMAT')
      expect(data.error.message_ar).toContain('رقم التعريف الضريبي') // Arabic for TRN
    })
  })

  describe('Concurrent Operation Conflicts', () => {
    it('should handle concurrent status updates gracefully', async () => {
      // Create invoice
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-concurrent',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'CONCURRENT-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create concurrent status update requests
      const statusUpdates = [
        StatusPatch(
          createAuthenticatedRequest(
            `http://localhost:3000/api/invoices/${invoice.id}/status`,
            'PATCH',
            { status: InvoiceStatus.SENT, reason: 'Concurrent update 1' }
          ),
          { params: { id: invoice.id } }
        ),
        StatusPatch(
          createAuthenticatedRequest(
            `http://localhost:3000/api/invoices/${invoice.id}/status`,
            'PATCH',
            { status: InvoiceStatus.CANCELLED, reason: 'Concurrent update 2' }
          ),
          { params: { id: invoice.id } }
        )
      ]

      const responses = await Promise.all(statusUpdates)
      
      // One should succeed, one should fail (or handle gracefully)
      const successResponses = responses.filter(r => r.status === 200)
      const errorResponses = responses.filter(r => r.status !== 200)
      
      expect(successResponses.length).toBeGreaterThanOrEqual(1)
      
      // If there are conflicts, they should be handled gracefully
      if (errorResponses.length > 0) {
        const errorData = await errorResponses[0].json()
        expect(errorData.error.code).toMatch(/CONCURRENT|CONFLICT|OPTIMISTIC_LOCK/)
      }
    })

    it('should handle concurrent payment attempts', async () => {
      // Create invoice
      const invoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-concurrent-pay',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'CONCURRENT-PAY-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create concurrent payment requests for full amount
      const paymentRequests = [
        PaymentsPost(createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId: invoice.id,
            amount: 1000,
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.BANK_TRANSFER,
            reference: 'CONCURRENT-1'
          }
        )),
        PaymentsPost(createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId: invoice.id,
            amount: 1000,
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.CREDIT_CARD,
            reference: 'CONCURRENT-2'
          }
        ))
      ]

      const responses = await Promise.all(paymentRequests)
      
      // Only one should succeed (first one), second should be rejected for overpayment
      const successResponses = responses.filter(r => r.status === 200)
      const errorResponses = responses.filter(r => r.status === 400)
      
      expect(successResponses.length).toBe(1)
      expect(errorResponses.length).toBe(1)
      
      const errorData = await errorResponses[0].json()
      expect(errorData.error.code).toBe('OVERPAYMENT_NOT_ALLOWED')
    })
  })

  describe('Database Constraint Violations', () => {
    it('should handle duplicate invoice number attempts', async () => {
      // Create first invoice
      const firstInvoice = await prisma.invoices.create({
        data: {
          id: 'edge-invoice-first',
          companyId: testCompany.id,
          customerId: testCustomer.id,
          number: 'DUPLICATE-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Attempt to create second invoice with same number
      const duplicateInvoiceData = {
        companyId: testCompany.id,
        number: 'DUPLICATE-001', // Same number
        customerName: testCustomer.name,
        customerEmail: testCustomer.email,
        amount: 1000,
        currency: 'AED',
        trnNumber: testCompany.trn,
        items: [{
          description: 'Duplicate test item',
          quantity: 1,
          unitPrice: 952.38,
          vatRate: 5,
          taxCategory: TaxCategory.STANDARD
        }]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        duplicateInvoiceData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('DUPLICATE_INVOICE_NUMBER')
      expect(data.error.details.existingInvoiceId).toBe(firstInvoice.id)
    })

    it('should handle foreign key constraint violations', async () => {
      // Attempt to create invoice with non-existent customer
      const invalidInvoiceData = {
        companyId: testCompany.id,
        customerId: 'non-existent-customer-id',
        number: 'FK-VIOLATION-001',
        customerName: 'Non-existent Customer',
        customerEmail: 'nonexistent@test.com',
        amount: 1000,
        currency: 'AED',
        trnNumber: testCompany.trn,
        items: [{
          description: 'FK violation test item',
          quantity: 1,
          unitPrice: 952.38,
          vatRate: 5,
          taxCategory: TaxCategory.STANDARD
        }]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        invalidInvoiceData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_CUSTOMER_REFERENCE')
    })
  })

  describe('Network Simulation and Recovery', () => {
    it('should handle request timeout scenarios', async () => {
      // Create a request that would timeout (simulated)
      // This test would be more effective with actual network delay simulation
      
      const startTime = Date.now()
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices?page=1&limit=1000' // Large limit to simulate slow query
      )

      try {
        const response = await InvoicesGet(request)
        const duration = Date.now() - startTime
        
        // If it succeeds, it should be within reasonable time
        if (response.status === 200) {
          expect(duration).toBeLessThan(30000) // 30 seconds max
        }
      } catch (error) {
        // If it fails, it should be a timeout or appropriate error
        expect(error.message).toMatch(/timeout|connection|network/i)
      }
    })

    it('should handle malformed JSON requests', async () => {
      const malformedRequest = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: '{ invalid json structure ,,'
      })

      const response = await InvoicesPost(malformedRequest)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('MALFORMED_REQUEST_BODY')
    })
  })
})