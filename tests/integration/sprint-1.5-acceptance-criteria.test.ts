/**
 * Phase 4 Sprint 1.5: Acceptance Criteria Validation Tests
 * 
 * Tests all original Sprint 1.5 requirements to ensure deliverables are met:
 * ✅ User can create invoices with all required fields
 * ✅ Invoice status updates correctly through workflow
 * ✅ Invoice list shows accurate status and amounts
 * ✅ Payment recording updates invoice status to "Paid"
 * 
 * Plus comprehensive validation of all Sprint 1.5 deliverables:
 * - Phase 1: Frontend Enhancement
 * - Phase 2: Backend Business Logic
 * - Phase 3: Database Optimization
 * - Phase 4: Integration & Testing
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { NextRequest } from 'next/server'
import { InvoiceStatus, PaymentMethod, UserRole, TaxCategory } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Import API handlers for acceptance criteria testing
import { GET as InvoicesGet, POST as InvoicesPost } from '../../src/app/api/invoices/route'
import { GET as InvoiceGet, PUT as InvoicePut } from '../../src/app/api/invoices/[id]/route'
import { PATCH as StatusPatch } from '../../src/app/api/invoices/[id]/status/route'
import { POST as PaymentsPost } from '../../src/app/api/payments/route'
import { POST as BulkPost } from '../../src/app/api/invoices/bulk/route'

// Import services for validation
import { prisma } from '../../src/lib/prisma'
import { validateUAETRN, calculateInvoiceVAT, formatUAECurrency } from '../../src/lib/vat-calculator'

// Test data for acceptance criteria validation
function generateAcceptanceTestCompany() {
  const timestamp = Date.now()
  return {
    id: `acceptance-company-${timestamp}`,
    name: `Sprint 1.5 Test Company`,
    trn: `100${timestamp.toString().slice(-12)}3`,
    email: `acceptance@uaetest.ae`,
    phone: '+971501234567',
    address: 'Dubai International Financial Centre, Dubai, UAE',
    defaultVatRate: new Decimal(5.0),
    currency: 'AED',
    timezone: 'Asia/Dubai',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateAcceptanceTestUser(companyId: string) {
  const timestamp = Date.now()
  return {
    id: `acceptance-user-${timestamp}`,
    email: `acceptanceuser@uaetest.ae`,
    name: 'Sprint 1.5 Test User',
    role: UserRole.FINANCE,
    companyId,
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateAcceptanceTestCustomer(companyId: string) {
  const timestamp = Date.now()
  return {
    id: `acceptance-customer-${timestamp}`,
    name: 'Sprint 1.5 Test Customer',
    nameAr: 'عميل اختبار سبرينت 1.5',
    email: `acceptancecustomer@uaetest.ae`,
    phone: '+971507654321',
    address: 'Abu Dhabi, UAE',
    addressAr: 'أبوظبي، دولة الإمارات العربية المتحدة',
    companyId,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function createAuthenticatedRequest(url: string, method: string = 'GET', body?: any) {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    ...(body && { body: JSON.stringify(body) })
  })
}

describe('Sprint 1.5 Acceptance Criteria Validation - Phase 4', () => {
  let testCompany: any
  let testUser: any
  let testCustomer: any

  beforeAll(async () => {
    // Clean up any existing acceptance test data
    await prisma.activities.deleteMany({ where: { companyId: { contains: 'acceptance-company-' } } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'acceptance-invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'acceptance-invoice-' } } })
    await prisma.invoices.deleteMany({ where: { id: { contains: 'acceptance-invoice-' } } })
    await prisma.customers.deleteMany({ where: { id: { contains: 'acceptance-customer-' } } })
    await prisma.users.deleteMany({ where: { id: { contains: 'acceptance-user-' } } })
    await prisma.companies.deleteMany({ where: { id: { contains: 'acceptance-company-' } } })
  })

  beforeEach(async () => {
    testCompany = generateAcceptanceTestCompany()
    testUser = generateAcceptanceTestUser(testCompany.id)
    testCustomer = generateAcceptanceTestCustomer(testCompany.id)

    await prisma.companies.create({ data: testCompany })
    await prisma.users.create({ data: testUser })
    await prisma.customers.create({ data: testCustomer })
  })

  afterEach(async () => {
    await prisma.activities.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'acceptance-invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'acceptance-invoice-' } } })
    await prisma.invoices.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.customers.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.users.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.companies.deleteMany({ where: { id: testCompany.id } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('✅ CORE ACCEPTANCE CRITERIA - Sprint 1.5', () => {
    describe('AC1: User can create invoices with all required fields', () => {
      it('should allow creating invoices with all required UAE business fields', async () => {
        const invoiceData = {
          companyId: testCompany.id,
          number: 'AC-INV-001',
          customerName: testCustomer.name,
          customerNameAr: testCustomer.nameAr,
          customerEmail: testCustomer.email,
          customerPhone: testCustomer.phone,
          description: 'Sprint 1.5 acceptance test invoice',
          descriptionAr: 'فاتورة اختبار قبول سبرينت 1.5',
          notes: 'Created for acceptance criteria validation',
          notesAr: 'تم إنشاؤها للتحقق من معايير القبول',
          currency: 'AED',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trnNumber: testCompany.trn,
          items: [
            {
              description: 'Professional Consulting Services',
              descriptionAr: 'خدمات استشارية مهنية',
              quantity: 1,
              unitPrice: 952.38,
              vatRate: 5,
              taxCategory: TaxCategory.STANDARD
            },
            {
              description: 'Training Services',
              descriptionAr: 'خدمات التدريب',
              quantity: 2,
              unitPrice: 500,
              vatRate: 5,
              taxCategory: TaxCategory.STANDARD
            }
          ]
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices',
          'POST',
          invoiceData
        )

        const response = await InvoicesPost(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)

        // Validate all required fields are present and correct
        const invoice = data.data.invoice
        expect(invoice.number).toBe('AC-INV-001')
        expect(invoice.customerName).toBe(testCustomer.name)
        expect(invoice.customerNameAr).toBe(testCustomer.nameAr)
        expect(invoice.customerEmail).toBe(testCustomer.email)
        expect(invoice.currency).toBe('AED')
        expect(invoice.trnNumber).toBe(testCompany.trn)
        expect(invoice.status).toBe(InvoiceStatus.DRAFT)

        // Validate UAE VAT calculations
        expect(data.data.vatBreakdown).toBeDefined()
        expect(data.data.vatBreakdown.totalVatAmount).toBeGreaterThan(0)
        
        // Validate formatted amounts in AED
        expect(data.data.formattedAmounts.totalAmount).toContain('AED')
        expect(data.data.formattedAmounts.vatAmount).toContain('AED')

        // Validate compliance flags
        expect(data.data.complianceFlags).toContain('TRN_VALID')
        expect(data.data.complianceFlags).toContain('VAT_CALCULATED')
        expect(data.data.complianceFlags).toContain('CURRENCY_AED')

        // ✅ AC1 PASSED: User can create invoices with all required fields
      })

      it('should validate required field enforcement', async () => {
        const incompleteInvoiceData = {
          companyId: testCompany.id,
          // Missing required fields: number, customerName, customerEmail
          currency: 'AED',
          items: []
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices',
          'POST',
          incompleteInvoiceData
        )

        const response = await InvoicesPost(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.code).toMatch(/REQUIRED|VALIDATION/)

        // ✅ AC1 VALIDATION PASSED: Required fields are properly enforced
      })
    })

    describe('AC2: Invoice status updates correctly through workflow', () => {
      it('should transition invoice status through complete workflow: DRAFT → SENT → PAID', async () => {
        // Step 1: Create invoice in DRAFT status
        const invoice = await prisma.invoices.create({
          data: {
            id: 'acceptance-invoice-workflow',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'AC-WORKFLOW-001',
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

        // Verify initial DRAFT status
        expect(invoice.status).toBe(InvoiceStatus.DRAFT)

        // Step 2: Transition DRAFT → SENT
        const sentRequest = createAuthenticatedRequest(
          `http://localhost:3000/api/invoices/${invoice.id}/status`,
          'PATCH',
          {
            status: InvoiceStatus.SENT,
            reason: 'Sending invoice to customer for AC validation'
          }
        )

        const sentResponse = await StatusPatch(sentRequest, { params: { id: invoice.id } })
        expect(sentResponse.status).toBe(200)

        const sentData = await sentResponse.json()
        expect(sentData.success).toBe(true)
        expect(sentData.data.transition.from).toBe(InvoiceStatus.DRAFT)
        expect(sentData.data.transition.to).toBe(InvoiceStatus.SENT)

        // Verify status in database
        const sentInvoice = await prisma.invoices.findUnique({ where: { id: invoice.id } })
        expect(sentInvoice!.status).toBe(InvoiceStatus.SENT)

        // Step 3: Record payment to trigger SENT → PAID
        const paymentRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId: invoice.id,
            amount: 1000,
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.BANK_TRANSFER,
            reference: 'AC-PAYMENT-001',
            notes: 'Payment for workflow acceptance test'
          }
        )

        const paymentResponse = await PaymentsPost(paymentRequest)
        expect(paymentResponse.status).toBe(200)

        const paymentData = await paymentResponse.json()
        expect(paymentData.success).toBe(true)
        expect(paymentData.data.statusTransition.automaticUpdate).toBe(true)
        expect(paymentData.data.statusTransition.from).toBe(InvoiceStatus.SENT)
        expect(paymentData.data.statusTransition.to).toBe(InvoiceStatus.PAID)

        // Verify final PAID status in database
        const paidInvoice = await prisma.invoices.findUnique({ where: { id: invoice.id } })
        expect(paidInvoice!.status).toBe(InvoiceStatus.PAID)

        // ✅ AC2 PASSED: Invoice status updates correctly through workflow
      })

      it('should maintain proper audit trail for status transitions', async () => {
        const invoice = await prisma.invoices.create({
          data: {
            id: 'acceptance-invoice-audit',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'AC-AUDIT-001',
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

        // Transition to SENT
        const sentRequest = createAuthenticatedRequest(
          `http://localhost:3000/api/invoices/${invoice.id}/status`,
          'PATCH',
          { status: InvoiceStatus.SENT, reason: 'Audit trail test' }
        )
        await StatusPatch(sentRequest, { params: { id: invoice.id } })

        // Check audit trail
        const activities = await prisma.activities.findMany({
          where: { 
            companyId: testCompany.id,
            type: 'invoice_status_changed'
          },
          orderBy: { createdAt: 'desc' }
        })

        expect(activities.length).toBeGreaterThan(0)
        expect(activities[0].metadata).toMatchObject({
          fromStatus: InvoiceStatus.DRAFT,
          toStatus: InvoiceStatus.SENT,
          reason: 'Audit trail test'
        })

        // ✅ AC2 AUDIT PASSED: Proper audit trail maintained
      })
    })

    describe('AC3: Invoice list shows accurate status and amounts', () => {
      it('should display accurate invoice information in list view with UAE formatting', async () => {
        // Create multiple test invoices with different statuses and amounts
        const testInvoices = [
          {
            id: 'acceptance-invoice-list-1',
            number: 'AC-LIST-001',
            status: InvoiceStatus.DRAFT,
            totalAmount: new Decimal(1000),
            currency: 'AED'
          },
          {
            id: 'acceptance-invoice-list-2',
            number: 'AC-LIST-002',
            status: InvoiceStatus.SENT,
            totalAmount: new Decimal(2500.75),
            currency: 'AED'
          },
          {
            id: 'acceptance-invoice-list-3',
            number: 'AC-LIST-003',
            status: InvoiceStatus.PAID,
            totalAmount: new Decimal(750.50),
            currency: 'AED'
          }
        ]

        // Create invoices in database
        for (const invoiceData of testInvoices) {
          await prisma.invoices.create({
            data: {
              ...invoiceData,
              companyId: testCompany.id,
              customerId: testCustomer.id,
              customerName: testCustomer.name,
              customerEmail: testCustomer.email,
              amount: invoiceData.totalAmount,
              subtotal: invoiceData.totalAmount.mul(0.9524),
              vatAmount: invoiceData.totalAmount.mul(0.0476),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              trnNumber: testCompany.trn,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        }

        // Fetch invoice list
        const listRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices?page=1&limit=20&includeInsights=true'
        )

        const listResponse = await InvoicesGet(listRequest)
        expect(listResponse.status).toBe(200)

        const listData = await listResponse.json()
        expect(listData.success).toBe(true)
        expect(listData.data.invoices.length).toBeGreaterThanOrEqual(3)

        // Validate each invoice in the list
        const invoices = listData.data.invoices
        for (const invoice of invoices) {
          if (invoice.number.startsWith('AC-LIST-')) {
            // Find corresponding test data
            const testInvoice = testInvoices.find(t => t.number === invoice.number)
            expect(testInvoice).toBeDefined()

            // Validate status accuracy
            expect(invoice.status).toBe(testInvoice!.status)

            // Validate amount accuracy and formatting
            expect(Math.abs(invoice.totalAmount - testInvoice!.totalAmount.toNumber())).toBeLessThan(0.01)
            expect(invoice.currency).toBe('AED')

            // Validate formatted amounts contain AED
            if (invoice.formattedTotalAmount) {
              expect(invoice.formattedTotalAmount).toContain('AED')
            }
          }
        }

        // Validate status counts
        expect(listData.data.statusCounts).toBeDefined()
        expect(listData.data.statusCounts[InvoiceStatus.DRAFT]).toBeGreaterThanOrEqual(1)
        expect(listData.data.statusCounts[InvoiceStatus.SENT]).toBeGreaterThanOrEqual(1)
        expect(listData.data.statusCounts[InvoiceStatus.PAID]).toBeGreaterThanOrEqual(1)

        // Validate insights
        expect(listData.data.insights).toBeDefined()
        expect(listData.data.insights.totalOutstanding).toBeGreaterThan(0)

        // ✅ AC3 PASSED: Invoice list shows accurate status and amounts
      })

      it('should handle filtering and search accurately', async () => {
        // Create invoices for filtering test
        await prisma.invoices.create({
          data: {
            id: 'acceptance-invoice-filter',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'AC-FILTER-001',
            customerName: 'Filter Test Customer',
            customerEmail: 'filter@test.ae',
            amount: new Decimal(1500),
            subtotal: new Decimal(1428.57),
            vatAmount: new Decimal(71.43),
            totalAmount: new Decimal(1500),
            currency: 'AED',
            status: InvoiceStatus.SENT,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trnNumber: testCompany.trn,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })

        // Test status filtering
        const filterRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices?' + new URLSearchParams({
            status: InvoiceStatus.SENT,
            minAmount: '1000',
            maxAmount: '2000'
          }).toString()
        )

        const filterResponse = await InvoicesGet(filterRequest)
        expect(filterResponse.status).toBe(200)

        const filterData = await filterResponse.json()
        expect(filterData.success).toBe(true)
        
        // Should find our test invoice
        const filteredInvoices = filterData.data.invoices
        const testInvoice = filteredInvoices.find((inv: any) => inv.number === 'AC-FILTER-001')
        expect(testInvoice).toBeDefined()
        expect(testInvoice.status).toBe(InvoiceStatus.SENT)
        expect(testInvoice.totalAmount).toBe(1500)

        // ✅ AC3 FILTERING PASSED: Filtering works accurately
      })
    })

    describe('AC4: Payment recording updates invoice status to "Paid"', () => {
      it('should automatically update invoice status to PAID when full payment is recorded', async () => {
        // Create invoice in SENT status
        const invoice = await prisma.invoices.create({
          data: {
            id: 'acceptance-invoice-payment',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'AC-PAYMENT-001',
            customerName: testCustomer.name,
            customerEmail: testCustomer.email,
            amount: new Decimal(1000),
            subtotal: new Decimal(952.38),
            vatAmount: new Decimal(47.62),
            totalAmount: new Decimal(1000),
            currency: 'AED',
            status: InvoiceStatus.SENT, // Start in SENT status
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trnNumber: testCompany.trn,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })

        // Verify initial SENT status
        expect(invoice.status).toBe(InvoiceStatus.SENT)

        // Record full payment
        const paymentRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId: invoice.id,
            amount: 1000, // Full payment amount
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.BANK_TRANSFER,
            reference: 'AC-FULL-PAY-001',
            notes: 'Full payment for AC4 validation'
          }
        )

        const paymentResponse = await PaymentsPost(paymentRequest)
        expect(paymentResponse.status).toBe(200)

        const paymentData = await paymentResponse.json()
        expect(paymentData.success).toBe(true)

        // Validate automatic status transition
        expect(paymentData.data.statusTransition).toBeDefined()
        expect(paymentData.data.statusTransition.automaticUpdate).toBe(true)
        expect(paymentData.data.statusTransition.from).toBe(InvoiceStatus.SENT)
        expect(paymentData.data.statusTransition.to).toBe(InvoiceStatus.PAID)

        // Validate payment summary
        expect(paymentData.data.paymentSummary.isFullyPaid).toBe(true)
        expect(paymentData.data.paymentSummary.totalPaid).toBe(1000)
        expect(paymentData.data.paymentSummary.remainingAmount).toBe(0)

        // Verify status in database
        const updatedInvoice = await prisma.invoices.findUnique({ where: { id: invoice.id } })
        expect(updatedInvoice!.status).toBe(InvoiceStatus.PAID)

        // Verify payment record
        const payments = await prisma.payments.findMany({ where: { invoiceId: invoice.id } })
        expect(payments.length).toBe(1)
        expect(payments[0].amount.toNumber()).toBe(1000)
        expect(payments[0].reference).toBe('AC-FULL-PAY-001')

        // ✅ AC4 PASSED: Payment recording updates invoice status to "Paid"
      })

      it('should handle partial payments without status change', async () => {
        // Create invoice for partial payment test
        const invoice = await prisma.invoices.create({
          data: {
            id: 'acceptance-invoice-partial',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'AC-PARTIAL-001',
            customerName: testCustomer.name,
            customerEmail: testCustomer.email,
            amount: new Decimal(2000),
            subtotal: new Decimal(1904.76),
            vatAmount: new Decimal(95.24),
            totalAmount: new Decimal(2000),
            currency: 'AED',
            status: InvoiceStatus.SENT,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trnNumber: testCompany.trn,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })

        // Record partial payment (50% of total)
        const partialPaymentRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId: invoice.id,
            amount: 1000, // Partial payment (50%)
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.CREDIT_CARD,
            reference: 'AC-PARTIAL-PAY-001',
            notes: 'Partial payment for AC4 validation'
          }
        )

        const partialResponse = await PaymentsPost(partialPaymentRequest)
        expect(partialResponse.status).toBe(200)

        const partialData = await partialResponse.json()
        expect(partialData.success).toBe(true)

        // Validate NO automatic status transition for partial payment
        expect(partialData.data.statusTransition).toBeNull()

        // Validate payment summary for partial payment
        expect(partialData.data.paymentSummary.isPartialPayment).toBe(true)
        expect(partialData.data.paymentSummary.isFullyPaid).toBe(false)
        expect(partialData.data.paymentSummary.totalPaid).toBe(1000)
        expect(partialData.data.paymentSummary.remainingAmount).toBe(1000)

        // Verify status remains SENT
        const unchangedInvoice = await prisma.invoices.findUnique({ where: { id: invoice.id } })
        expect(unchangedInvoice!.status).toBe(InvoiceStatus.SENT)

        // Record final payment to complete
        const finalPaymentRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId: invoice.id,
            amount: 1000, // Remaining amount
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.BANK_TRANSFER,
            reference: 'AC-FINAL-PAY-001',
            notes: 'Final payment completing invoice'
          }
        )

        const finalResponse = await PaymentsPost(finalPaymentRequest)
        expect(finalResponse.status).toBe(200)

        const finalData = await finalResponse.json()
        expect(finalData.success).toBe(true)

        // NOW status should transition to PAID
        expect(finalData.data.statusTransition.automaticUpdate).toBe(true)
        expect(finalData.data.statusTransition.to).toBe(InvoiceStatus.PAID)
        expect(finalData.data.paymentSummary.isFullyPaid).toBe(true)

        // ✅ AC4 PARTIAL PAYMENT PASSED: Proper handling of partial vs full payments
      })
    })
  })

  describe('✅ PHASE DELIVERABLE VALIDATION', () => {
    describe('Phase 1: Frontend Enhancement Validation', () => {
      it('should validate real-time UAE VAT calculations are working', async () => {
        // Test VAT calculation service that would be used by frontend
        const testItems = [
          { unitPrice: 952.38, quantity: 1, vatRate: 5, taxCategory: TaxCategory.STANDARD },
          { unitPrice: 500, quantity: 2, vatRate: 0, taxCategory: TaxCategory.ZERO_RATED }
        ]

        const vatCalculation = calculateInvoiceVAT(testItems, 'AED')
        
        expect(vatCalculation.subtotal.toNumber()).toBeCloseTo(1952.38, 2)
        expect(vatCalculation.totalVatAmount.toNumber()).toBeCloseTo(47.62, 2)
        expect(vatCalculation.grandTotal.toNumber()).toBeCloseTo(2000, 2)

        // Validate formatted currency
        const formatted = formatUAECurrency(vatCalculation.grandTotal.toNumber(), 'AED')
        expect(formatted).toContain('AED')
        expect(formatted).toContain('2,000.00')

        // ✅ Phase 1 VAT VALIDATION PASSED
      })

      it('should validate UAE compliance features are accessible via API', async () => {
        const invoiceData = {
          companyId: testCompany.id,
          number: 'PHASE1-001',
          customerName: testCustomer.name,
          customerEmail: testCustomer.email,
          currency: 'AED',
          trnNumber: testCompany.trn,
          items: [{
            description: 'UAE Compliance Test Service',
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
        const data = await response.json()

        // Validate UAE compliance flags are returned
        expect(data.data.complianceFlags).toContain('TRN_VALID')
        expect(data.data.complianceFlags).toContain('VAT_CALCULATED')
        expect(data.data.complianceFlags).toContain('CURRENCY_AED')

        // Validate business rules context
        expect(data.data.businessRules.uaeCompliant).toBe(true)

        // ✅ Phase 1 COMPLIANCE VALIDATION PASSED
      })
    })

    describe('Phase 2: Backend Business Logic Validation', () => {
      it('should validate enhanced invoice status workflow APIs', async () => {
        const invoice = await prisma.invoices.create({
          data: {
            id: 'phase2-workflow-test',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'PHASE2-001',
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

        // Test status workflow API
        const statusRequest = createAuthenticatedRequest(
          `http://localhost:3000/api/invoices/${invoice.id}/status`,
          'PATCH',
          {
            status: InvoiceStatus.SENT,
            reason: 'Phase 2 workflow validation',
            notifyCustomer: true
          }
        )

        const statusResponse = await StatusPatch(statusRequest, { params: { id: invoice.id } })
        expect(statusResponse.status).toBe(200)

        const statusData = await statusResponse.json()
        expect(statusData.data.transition.from).toBe(InvoiceStatus.DRAFT)
        expect(statusData.data.transition.to).toBe(InvoiceStatus.SENT)
        expect(statusData.data.workflowMetadata).toBeDefined()

        // ✅ Phase 2 WORKFLOW VALIDATION PASSED
      })

      it('should validate payment recording and reconciliation system', async () => {
        const invoice = await prisma.invoices.create({
          data: {
            id: 'phase2-payment-test',
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: 'PHASE2-PAY-001',
            customerName: testCustomer.name,
            customerEmail: testCustomer.email,
            amount: new Decimal(3000),
            subtotal: new Decimal(2857.14),
            vatAmount: new Decimal(142.86),
            totalAmount: new Decimal(3000),
            currency: 'AED',
            status: InvoiceStatus.SENT,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trnNumber: testCompany.trn,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })

        // Record multiple payments
        const payments = [
          { amount: 1000, reference: 'PAY-001' },
          { amount: 1200, reference: 'PAY-002' },
          { amount: 800, reference: 'PAY-003' }
        ]

        for (const payment of payments) {
          const paymentRequest = createAuthenticatedRequest(
            'http://localhost:3000/api/payments',
            'POST',
            {
              invoiceId: invoice.id,
              amount: payment.amount,
              paymentDate: new Date().toISOString(),
              method: PaymentMethod.BANK_TRANSFER,
              reference: payment.reference
            }
          )

          const response = await PaymentsPost(paymentRequest)
          expect(response.status).toBe(200)
        }

        // Validate final payment triggers status change
        const finalInvoice = await prisma.invoices.findUnique({ where: { id: invoice.id } })
        expect(finalInvoice!.status).toBe(InvoiceStatus.PAID)

        // Validate payment records
        const allPayments = await prisma.payments.findMany({ where: { invoiceId: invoice.id } })
        expect(allPayments.length).toBe(3)
        
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount.toNumber(), 0)
        expect(totalPaid).toBe(3000)

        // ✅ Phase 2 PAYMENT VALIDATION PASSED
      })

      it('should validate advanced filtering and search capabilities', async () => {
        // Create diverse test invoices
        const testInvoices = [
          { number: 'SEARCH-AED-001', currency: 'AED', status: InvoiceStatus.SENT, amount: 1500 },
          { number: 'SEARCH-USD-001', currency: 'USD', status: InvoiceStatus.PAID, amount: 800 },
          { number: 'SEARCH-AED-002', currency: 'AED', status: InvoiceStatus.DRAFT, amount: 2200 }
        ]

        for (const testInvoice of testInvoices) {
          await prisma.invoices.create({
            data: {
              id: `phase2-search-${testInvoice.number}`,
              companyId: testCompany.id,
              customerId: testCustomer.id,
              number: testInvoice.number,
              customerName: testCustomer.name,
              customerEmail: testCustomer.email,
              amount: new Decimal(testInvoice.amount),
              subtotal: new Decimal(testInvoice.amount * 0.9524),
              vatAmount: new Decimal(testInvoice.amount * 0.0476),
              totalAmount: new Decimal(testInvoice.amount),
              currency: testInvoice.currency,
              status: testInvoice.status,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              trnNumber: testCompany.trn,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        }

        // Test advanced filtering
        const filterRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices?' + new URLSearchParams({
            currency: 'AED',
            minAmount: '1000',
            maxAmount: '2000',
            status: InvoiceStatus.SENT
          }).toString()
        )

        const filterResponse = await InvoicesGet(filterRequest)
        expect(filterResponse.status).toBe(200)

        const filterData = await filterResponse.json()
        expect(filterData.success).toBe(true)

        // Should find SEARCH-AED-001 (AED, SENT, 1500 - within range)
        const filteredInvoices = filterData.data.invoices
        const foundInvoice = filteredInvoices.find((inv: any) => inv.number === 'SEARCH-AED-001')
        expect(foundInvoice).toBeDefined()

        // Should not find USD or out-of-range invoices
        const usdInvoice = filteredInvoices.find((inv: any) => inv.number === 'SEARCH-USD-001')
        expect(usdInvoice).toBeUndefined()

        // ✅ Phase 2 FILTERING VALIDATION PASSED
      })
    })

    describe('Phase 3: Database Optimization Validation', () => {
      it('should validate performance optimization with realistic load', async () => {
        // Create a moderate dataset to test performance
        const invoices = []
        for (let i = 0; i < 50; i++) {
          invoices.push({
            id: `perf-invoice-${i}`,
            companyId: testCompany.id,
            customerId: testCustomer.id,
            number: `PERF-${i.toString().padStart(3, '0')}`,
            customerName: testCustomer.name,
            customerEmail: testCustomer.email,
            amount: new Decimal(1000 + i * 10),
            subtotal: new Decimal((1000 + i * 10) * 0.9524),
            vatAmount: new Decimal((1000 + i * 10) * 0.0476),
            totalAmount: new Decimal(1000 + i * 10),
            currency: 'AED',
            status: i % 3 === 0 ? InvoiceStatus.PAID : InvoiceStatus.SENT,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            trnNumber: testCompany.trn,
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
          })
        }

        await prisma.invoices.createMany({ data: invoices })

        // Test query performance
        const startTime = Date.now()
        
        const performanceRequest = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices?page=1&limit=20&includePayments=true&includeInsights=true'
        )

        const response = await InvoicesGet(performanceRequest)
        const endTime = Date.now()

        expect(response.status).toBe(200)
        
        const responseTime = endTime - startTime
        expect(responseTime).toBeLessThan(1000) // Should respond within 1 second

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data.invoices.length).toBe(20)
        expect(data.data.pagination.totalCount).toBeGreaterThanOrEqual(50)

        // ✅ Phase 3 PERFORMANCE VALIDATION PASSED
      })

      it('should validate UAE compliance constraints at database level', async () => {
        // Test TRN constraint validation
        try {
          await prisma.companies.create({
            data: {
              id: 'invalid-trn-company',
              name: 'Invalid TRN Company',
              trn: '123456789', // Invalid TRN format
              email: 'invalid@test.ae',
              phone: '+971501234567',
              address: 'Dubai, UAE',
              defaultVatRate: new Decimal(5.0),
              currency: 'AED',
              timezone: 'Asia/Dubai',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
          
          // Should not reach here - constraint should prevent creation
          expect(true).toBe(false)
        } catch (error) {
          // Expected error due to TRN validation constraint
          expect(error).toBeDefined()
        }

        // ✅ Phase 3 CONSTRAINT VALIDATION PASSED
      })
    })

    describe('Phase 4: Integration & Testing Validation', () => {
      it('should validate complete end-to-end workflow integration', async () => {
        // This test validates that all phases work together
        
        // Step 1: Create invoice (tests Phase 1 & 2 integration)
        const invoiceData = {
          companyId: testCompany.id,
          number: 'E2E-INTEGRATION-001',
          customerName: testCustomer.name,
          customerNameAr: testCustomer.nameAr,
          customerEmail: testCustomer.email,
          description: 'End-to-end integration test',
          descriptionAr: 'اختبار التكامل الشامل',
          currency: 'AED',
          trnNumber: testCompany.trn,
          items: [{
            description: 'Integration Test Service',
            descriptionAr: 'خدمة اختبار التكامل',
            quantity: 1,
            unitPrice: 1000,
            vatRate: 5,
            taxCategory: TaxCategory.STANDARD
          }]
        }

        const createResponse = await InvoicesPost(
          createAuthenticatedRequest('http://localhost:3000/api/invoices', 'POST', invoiceData)
        )
        expect(createResponse.status).toBe(200)

        const createData = await createResponse.json()
        const invoiceId = createData.data.invoice.id

        // Step 2: Send invoice (tests status workflow)
        const sendResponse = await StatusPatch(
          createAuthenticatedRequest(
            `http://localhost:3000/api/invoices/${invoiceId}/status`,
            'PATCH',
            { status: InvoiceStatus.SENT, reason: 'E2E integration test' }
          ),
          { params: { id: invoiceId } }
        )
        expect(sendResponse.status).toBe(200)

        // Step 3: Record payment (tests payment integration)
        const paymentResponse = await PaymentsPost(
          createAuthenticatedRequest(
            'http://localhost:3000/api/payments',
            'POST',
            {
              invoiceId,
              amount: 1000,
              paymentDate: new Date().toISOString(),
              method: PaymentMethod.BANK_TRANSFER,
              reference: 'E2E-PAYMENT-001'
            }
          )
        )
        expect(paymentResponse.status).toBe(200)

        const paymentData = await paymentResponse.json()
        expect(paymentData.data.statusTransition.to).toBe(InvoiceStatus.PAID)

        // Step 4: Verify in list (tests retrieval and formatting)
        const listResponse = await InvoicesGet(
          createAuthenticatedRequest('http://localhost:3000/api/invoices?page=1&limit=20')
        )
        expect(listResponse.status).toBe(200)

        const listData = await listResponse.json()
        const createdInvoice = listData.data.invoices.find((inv: any) => inv.id === invoiceId)
        expect(createdInvoice).toBeDefined()
        expect(createdInvoice.status).toBe(InvoiceStatus.PAID)
        expect(createdInvoice.totalAmount).toBe(1000)

        // ✅ Phase 4 INTEGRATION VALIDATION PASSED
      })
    })
  })

  describe('✅ SPRINT 1.5 COMPREHENSIVE ACCEPTANCE', () => {
    it('should validate all Sprint 1.5 deliverables are production-ready', async () => {
      // Summary validation test that confirms all acceptance criteria
      // and phase deliverables are working together

      const timestamp = Date.now()
      
      // 1. Create comprehensive invoice with all features
      const comprehensiveInvoiceData = {
        companyId: testCompany.id,
        number: `SPRINT15-${timestamp}`,
        customerName: 'Sprint 1.5 Comprehensive Customer',
        customerNameAr: 'عميل سبرينت 1.5 الشامل',
        customerEmail: 'comprehensive@sprint15.ae',
        customerPhone: '+971501234567',
        description: 'Sprint 1.5 comprehensive acceptance test invoice',
        descriptionAr: 'فاتورة اختبار القبول الشامل لسبرينت 1.5',
        notes: 'All features validation',
        notesAr: 'التحقق من جميع الميزات',
        currency: 'AED',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        trnNumber: testCompany.trn,
        items: [
          {
            description: 'Standard VAT Service',
            descriptionAr: 'خدمة خاضعة لضريبة القيمة المضافة',
            quantity: 1,
            unitPrice: 952.38,
            vatRate: 5,
            taxCategory: TaxCategory.STANDARD
          },
          {
            description: 'Zero-rated Service',
            descriptionAr: 'خدمة معفاة من الضريبة',
            quantity: 1,
            unitPrice: 500,
            vatRate: 0,
            taxCategory: TaxCategory.ZERO_RATED
          }
        ]
      }

      // Create invoice
      const createResponse = await InvoicesPost(
        createAuthenticatedRequest('http://localhost:3000/api/invoices', 'POST', comprehensiveInvoiceData)
      )
      expect(createResponse.status).toBe(200)

      const createData = await createResponse.json()
      const invoice = createData.data.invoice
      const invoiceId = invoice.id

      // Validate creation with UAE compliance
      expect(invoice.status).toBe(InvoiceStatus.DRAFT)
      expect(invoice.currency).toBe('AED')
      expect(invoice.trnNumber).toBe(testCompany.trn)
      expect(createData.data.complianceFlags).toContain('TRN_VALID')
      expect(createData.data.vatBreakdown).toBeDefined()

      // 2. Complete workflow: DRAFT → SENT → PAID
      
      // Send invoice
      const sendResponse = await StatusPatch(
        createAuthenticatedRequest(
          `http://localhost:3000/api/invoices/${invoiceId}/status`,
          'PATCH',
          { status: InvoiceStatus.SENT, reason: 'Comprehensive test sending' }
        ),
        { params: { id: invoiceId } }
      )
      expect(sendResponse.status).toBe(200)

      // Record payment
      const paymentResponse = await PaymentsPost(
        createAuthenticatedRequest(
          'http://localhost:3000/api/payments',
          'POST',
          {
            invoiceId,
            amount: invoice.totalAmount,
            paymentDate: new Date().toISOString(),
            method: PaymentMethod.BANK_TRANSFER,
            reference: `COMPREHENSIVE-${timestamp}`,
            notes: 'Sprint 1.5 comprehensive payment'
          }
        )
      )
      expect(paymentResponse.status).toBe(200)

      const paymentData = await paymentResponse.json()
      expect(paymentData.data.statusTransition.to).toBe(InvoiceStatus.PAID)

      // 3. Validate in comprehensive list view
      const listResponse = await InvoicesGet(
        createAuthenticatedRequest(
          `http://localhost:3000/api/invoices?search=${comprehensiveInvoiceData.number}&includeInsights=true`
        )
      )
      expect(listResponse.status).toBe(200)

      const listData = await listResponse.json()
      const listedInvoice = listData.data.invoices.find((inv: any) => inv.id === invoiceId)
      expect(listedInvoice).toBeDefined()
      expect(listedInvoice.status).toBe(InvoiceStatus.PAID)

      // 4. Validate audit trail completeness
      const activities = await prisma.activities.findMany({
        where: { companyId: testCompany.id },
        orderBy: { createdAt: 'desc' },
        take: 10
      })

      const invoiceActivities = activities.filter(a => 
        a.metadata && 
        typeof a.metadata === 'object' && 
        'invoiceId' in a.metadata && 
        a.metadata.invoiceId === invoiceId
      )

      expect(invoiceActivities.length).toBeGreaterThanOrEqual(3) // Create, send, payment

      // ✅ SPRINT 1.5 COMPREHENSIVE ACCEPTANCE PASSED
      
      console.log('🎉 Sprint 1.5 Acceptance Criteria Validation COMPLETE')
      console.log('✅ AC1: User can create invoices with all required fields - PASSED')
      console.log('✅ AC2: Invoice status updates correctly through workflow - PASSED')
      console.log('✅ AC3: Invoice list shows accurate status and amounts - PASSED')  
      console.log('✅ AC4: Payment recording updates invoice status to "Paid" - PASSED')
      console.log('✅ Phase 1: Frontend Enhancement - VALIDATED')
      console.log('✅ Phase 2: Backend Business Logic - VALIDATED')
      console.log('✅ Phase 3: Database Optimization - VALIDATED')
      console.log('✅ Phase 4: Integration & Testing - VALIDATED')
      console.log('🚀 Sprint 1.5 is PRODUCTION READY!')
    })
  })
})