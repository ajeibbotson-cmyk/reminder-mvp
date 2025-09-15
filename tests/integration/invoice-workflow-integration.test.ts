/**
 * Phase 4 Sprint 1.5: Complete Invoice Workflow Integration Tests
 * Tests the entire invoice lifecycle with UAE compliance validation
 * 
 * Covers:
 * - Complete invoice workflows: Create → Send → Pay → Status Updates
 * - Status transitions between frontend and backend
 * - Payment recording and automatic status updates
 * - Filtering, search, and bulk operations
 * - Payment reconciliation system end-to-end
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { NextRequest } from 'next/server'
import { InvoiceStatus, PaymentMethod, UserRole, TaxCategory } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Import API handlers
import { GET as InvoicesGet, POST as InvoicesPost } from '../../src/app/api/invoices/route'
import { GET as InvoiceGet, PUT as InvoicePut, DELETE as InvoiceDelete } from '../../src/app/api/invoices/[id]/route'
import { PATCH as InvoiceStatusPatch } from '../../src/app/api/invoices/[id]/status/route'
import { POST as PaymentsPost } from '../../src/app/api/payments/route'
import { POST as BulkPost } from '../../src/app/api/invoices/bulk/route'

// Import services
import { prisma } from '../../src/lib/prisma'
import { invoiceStatusService } from '../../src/lib/services/invoice-status-service'
import { paymentWorkflowService } from '../../src/lib/services/payment-workflow-service'

// Test data generators
function generateTestCompany() {
  const timestamp = Date.now()
  return {
    id: `company-${timestamp}`,
    name: `Test Company UAE ${timestamp}`,
    trn: `100${timestamp.toString().slice(-12)}3`,
    email: `company${timestamp}@uaetest.com`,
    phone: '+971501234567',
    address: 'Dubai, UAE',
    defaultVatRate: new Decimal(5.0),
    currency: 'AED',
    timezone: 'Asia/Dubai',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateTestUser(companyId: string) {
  const timestamp = Date.now()
  return {
    id: `user-${timestamp}`,
    email: `testuser${timestamp}@uaetest.com`,
    name: 'Test Finance User',
    role: UserRole.FINANCE,
    companyId,
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateTestCustomer(companyId: string) {
  const timestamp = Date.now()
  return {
    id: `customer-${timestamp}`,
    name: `Test Customer ${timestamp}`,
    nameAr: `عميل اختبار ${timestamp}`,
    email: `customer${timestamp}@uaetest.com`,
    phone: '+971507654321',
    address: 'Abu Dhabi, UAE',
    addressAr: 'أبوظبي، دولة الإمارات العربية المتحدة',
    companyId,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateTestInvoice(companyId: string, customerId: string) {
  const timestamp = Date.now()
  const subtotal = new Decimal(952.38)
  const vatAmount = new Decimal(47.62)
  const totalAmount = new Decimal(1000.00)
  
  return {
    id: `invoice-${timestamp}`,
    companyId,
    customerId,
    number: `INV-${timestamp}`,
    customerName: 'Test Customer',
    customerNameAr: 'عميل اختبار',
    customerEmail: `customer${timestamp}@uaetest.com`,
    amount: totalAmount,
    subtotal,
    vatAmount,
    totalAmount,
    currency: 'AED',
    status: InvoiceStatus.DRAFT,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    trnNumber: `100${timestamp.toString().slice(-12)}3`,
    description: 'Integration test invoice',
    descriptionAr: 'فاتورة اختبار التكامل',
    notes: 'Generated for integration testing',
    notesAr: 'تم إنشاؤها لاختبار التكامل',
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function generateInvoiceItems(invoiceId: string) {
  return [
    {
      id: `item-${Date.now()}-1`,
      invoiceId,
      description: 'Professional Services',
      descriptionAr: 'خدمات مهنية',
      quantity: new Decimal(1),
      unitPrice: new Decimal(952.38),
      total: new Decimal(952.38),
      vatRate: new Decimal(5.0),
      vatAmount: new Decimal(47.62),
      totalWithVat: new Decimal(1000.00),
      taxCategory: TaxCategory.STANDARD,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
}

// Helper function to create authenticated request
function createAuthenticatedRequest(url: string, method: string = 'GET', body?: any) {
  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    ...(body && { body: JSON.stringify(body) })
  })
  return request
}

describe('Invoice Workflow Integration Tests - Phase 4 Sprint 1.5', () => {
  let testCompany: any
  let testUser: any
  let testCustomer: any
  let testInvoice: any
  let testItems: any[]

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.activities.deleteMany({ where: { userId: { contains: 'user-' } } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'invoice-' } } })
    await prisma.invoices.deleteMany({ where: { id: { contains: 'invoice-' } } })
    await prisma.customers.deleteMany({ where: { id: { contains: 'customer-' } } })
    await prisma.users.deleteMany({ where: { id: { contains: 'user-' } } })
    await prisma.companies.deleteMany({ where: { id: { contains: 'company-' } } })
  })

  beforeEach(async () => {
    // Create test data
    testCompany = generateTestCompany()
    testUser = generateTestUser(testCompany.id)
    testCustomer = generateTestCustomer(testCompany.id)
    testInvoice = generateTestInvoice(testCompany.id, testCustomer.id)
    testItems = generateInvoiceItems(testInvoice.id)

    // Insert test data
    await prisma.companies.create({ data: testCompany })
    await prisma.users.create({ data: testUser })
    await prisma.customers.create({ data: testCustomer })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.activities.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.payments.deleteMany({ where: { invoiceId: testInvoice.id } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: testInvoice.id } })
    await prisma.invoices.deleteMany({ where: { id: testInvoice.id } })
    await prisma.customers.deleteMany({ where: { id: testCustomer.id } })
    await prisma.users.deleteMany({ where: { id: testUser.id } })
    await prisma.companies.deleteMany({ where: { id: testCompany.id } })
  })

  afterAll(async () => {
    // Final cleanup
    await prisma.$disconnect()
  })

  describe('Complete Invoice Lifecycle: Create → Send → Pay → Reconcile', () => {
    it('should execute complete invoice workflow with UAE compliance', async () => {
      // Step 1: Create Invoice (DRAFT status)
      const createRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        {
          ...testInvoice,
          items: testItems.map(item => ({
            description: item.description,
            descriptionAr: item.descriptionAr,
            quantity: item.quantity.toNumber(),
            unitPrice: item.unitPrice.toNumber(),
            total: item.total.toNumber(),
            vatRate: item.vatRate.toNumber(),
            vatAmount: item.vatAmount.toNumber(),
            totalWithVat: item.totalWithVat.toNumber(),
            taxCategory: item.taxCategory
          }))
        }
      )

      const createResponse = await InvoicesPost(createRequest)
      expect(createResponse.status).toBe(200)
      
      const createData = await createResponse.json()
      expect(createData.success).toBe(true)
      expect(createData.data.invoice.status).toBe(InvoiceStatus.DRAFT)
      expect(createData.data.invoice.currency).toBe('AED')
      expect(createData.data.vatBreakdown).toBeDefined()
      
      const invoiceId = createData.data.invoice.id

      // Step 2: Send Invoice (DRAFT → SENT)
      const sendRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/invoices/${invoiceId}/status`,
        'PATCH',
        {
          status: InvoiceStatus.SENT,
          reason: 'Sending invoice to customer',
          notifyCustomer: true
        }
      )

      const sendResponse = await InvoiceStatusPatch(sendRequest, { params: { id: invoiceId } })
      expect(sendResponse.status).toBe(200)
      
      const sendData = await sendResponse.json()
      expect(sendData.success).toBe(true)
      expect(sendData.data.transition.from).toBe(InvoiceStatus.DRAFT)
      expect(sendData.data.transition.to).toBe(InvoiceStatus.SENT)

      // Step 3: Record Partial Payment
      const partialPaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId,
          amount: 600,
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'TXN-PARTIAL-001',
          notes: 'Partial payment from customer'
        }
      )

      const partialPaymentResponse = await PaymentsPost(partialPaymentRequest)
      expect(partialPaymentResponse.status).toBe(200)
      
      const partialPaymentData = await partialPaymentResponse.json()
      expect(partialPaymentData.success).toBe(true)
      expect(partialPaymentData.data.paymentSummary.isPartialPayment).toBe(true)
      expect(partialPaymentData.data.paymentSummary.remainingAmount).toBe(400)

      // Step 4: Record Final Payment (SENT → PAID)
      const finalPaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId,
          amount: 400,
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'TXN-FINAL-001',
          notes: 'Final payment completing invoice'
        }
      )

      const finalPaymentResponse = await PaymentsPost(finalPaymentRequest)
      expect(finalPaymentResponse.status).toBe(200)
      
      const finalPaymentData = await finalPaymentResponse.json()
      expect(finalPaymentData.success).toBe(true)
      expect(finalPaymentData.data.paymentSummary.isFullyPaid).toBe(true)
      expect(finalPaymentData.data.statusTransition.automaticUpdate).toBe(true)
      expect(finalPaymentData.data.statusTransition.to).toBe(InvoiceStatus.PAID)

      // Step 5: Verify Final Invoice State
      const verifyRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/invoices/${invoiceId}`,
        'GET'
      )

      const verifyResponse = await InvoiceGet(verifyRequest, { params: { id: invoiceId } })
      expect(verifyResponse.status).toBe(200)
      
      const verifyData = await verifyResponse.json()
      expect(verifyData.success).toBe(true)
      expect(verifyData.data.invoice.status).toBe(InvoiceStatus.PAID)
      expect(verifyData.data.paymentSummary.totalPaid).toBe(1000)
      expect(verifyData.data.paymentSummary.paymentCount).toBe(2)
      expect(verifyData.data.payments).toHaveLength(2)

      // Step 6: Verify Audit Trail
      const activities = await prisma.activities.findMany({
        where: { companyId: testCompany.id },
        orderBy: { createdAt: 'asc' }
      })

      expect(activities.length).toBeGreaterThanOrEqual(4) // At least create, send, 2 payments
      expect(activities.some(a => a.type === 'invoice_created')).toBe(true)
      expect(activities.some(a => a.type === 'invoice_status_changed')).toBe(true)
      expect(activities.some(a => a.type === 'payment_recorded')).toBe(true)
    })

    it('should handle overpayment scenarios correctly', async () => {
      // Create invoice first
      await prisma.invoices.create({
        data: {
          ...testInvoice,
          status: InvoiceStatus.SENT
        }
      })
      await prisma.invoiceItems.createMany({ data: testItems })

      // Attempt overpayment
      const overpaymentRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        {
          invoiceId: testInvoice.id,
          amount: 1500, // More than invoice total
          paymentDate: new Date().toISOString(),
          method: PaymentMethod.BANK_TRANSFER,
          reference: 'TXN-OVER-001',
          notes: 'Overpayment attempt'
        }
      )

      const response = await PaymentsPost(overpaymentRequest)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('OVERPAYMENT_NOT_ALLOWED')
    })

    it('should handle payment reconciliation correctly', async () => {
      // Create invoice with complex payment history
      await prisma.invoices.create({
        data: {
          ...testInvoice,
          status: InvoiceStatus.SENT,
          totalAmount: new Decimal(3000) // Higher amount for multiple payments
        }
      })

      // Create multiple payments
      const payments = [
        { amount: 1000, reference: 'PAY-001', method: PaymentMethod.BANK_TRANSFER },
        { amount: 800, reference: 'PAY-002', method: PaymentMethod.CREDIT_CARD },
        { amount: 1200, reference: 'PAY-003', method: PaymentMethod.BANK_TRANSFER }
      ]

      for (const payment of payments) {
        await prisma.payments.create({
          data: {
            id: `payment-${payment.reference}`,
            invoiceId: testInvoice.id,
            amount: new Decimal(payment.amount),
            paymentDate: new Date(),
            method: payment.method,
            reference: payment.reference,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      }

      // Test reconciliation
      const reconciliation = await paymentWorkflowService.reconcileInvoicePayments(testInvoice.id)
      
      expect(reconciliation.success).toBe(true)
      expect(reconciliation.totalInvoiceAmount).toBe(3000)
      expect(reconciliation.totalPaymentsRecorded).toBe(3000)
      expect(reconciliation.discrepancy).toBe(0)
      expect(reconciliation.status).toBe('RECONCILED')
      expect(reconciliation.paymentBreakdown).toHaveLength(3)
    })
  })

  describe('Bulk Operations Integration', () => {
    it('should handle bulk status updates with proper validation', async () => {
      // Create multiple invoices
      const invoiceIds = []
      for (let i = 0; i < 5; i++) {
        const invoice = generateTestInvoice(testCompany.id, testCustomer.id)
        invoice.id = `invoice-bulk-${i}`
        invoice.number = `INV-BULK-${i}`
        
        await prisma.invoices.create({ data: invoice })
        invoiceIds.push(invoice.id)
      }

      // Bulk status update
      const bulkRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices/bulk',
        'POST',
        {
          operation: 'status_update',
          invoiceIds,
          data: {
            status: InvoiceStatus.SENT,
            reason: 'Bulk sending invoices to customers'
          }
        }
      )

      const response = await BulkPost(bulkRequest)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.totalRequested).toBe(5)
      expect(data.data.successCount).toBe(5)
      expect(data.data.failedCount).toBe(0)

      // Verify all invoices were updated
      const updatedInvoices = await prisma.invoices.findMany({
        where: { id: { in: invoiceIds } }
      })
      
      expect(updatedInvoices).toHaveLength(5)
      updatedInvoices.forEach(invoice => {
        expect(invoice.status).toBe(InvoiceStatus.SENT)
      })
    })

    it('should handle bulk operations with partial failures', async () => {
      // Create mix of valid and problematic invoices
      const validInvoice = generateTestInvoice(testCompany.id, testCustomer.id)
      validInvoice.id = 'invoice-valid'
      validInvoice.status = InvoiceStatus.DRAFT
      
      await prisma.invoices.create({ data: validInvoice })

      // Try bulk operation with mix of valid and invalid IDs
      const bulkRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices/bulk',
        'POST',
        {
          operation: 'status_update',
          invoiceIds: ['invoice-valid', 'invoice-nonexistent'],
          data: {
            status: InvoiceStatus.SENT,
            reason: 'Bulk operation with failures'
          }
        }
      )

      const response = await BulkPost(bulkRequest)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.totalRequested).toBe(2)
      expect(data.data.successCount).toBe(1)
      expect(data.data.failedCount).toBe(1)
      expect(data.data.errors).toHaveLength(1)
    })
  })

  describe('Advanced Filtering and Search Integration', () => {
    it('should filter invoices with complex UAE business criteria', async () => {
      // Create test invoices with different characteristics
      const testScenarios = [
        { ...testInvoice, id: 'inv-aed', currency: 'AED', status: InvoiceStatus.SENT, totalAmount: new Decimal(1000) },
        { ...testInvoice, id: 'inv-usd', currency: 'USD', status: InvoiceStatus.PAID, totalAmount: new Decimal(500) },
        { ...testInvoice, id: 'inv-overdue', currency: 'AED', status: InvoiceStatus.SENT, 
          totalAmount: new Decimal(2000), dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      ]

      for (const scenario of testScenarios) {
        await prisma.invoices.create({ data: scenario })
      }

      // Test complex filtering
      const filterRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices?' + new URLSearchParams({
          currency: 'AED',
          status: InvoiceStatus.SENT,
          isOverdue: 'true',
          minAmount: '1500',
          maxAmount: '2500'
        }).toString()
      )

      const response = await InvoicesGet(filterRequest)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.invoices).toHaveLength(1)
      expect(data.data.invoices[0].id).toBe('inv-overdue')
    })

    it('should support Arabic text search in bilingual fields', async () => {
      // Create invoice with Arabic content
      const arabicInvoice = {
        ...testInvoice,
        id: 'invoice-arabic',
        customerNameAr: 'شركة الاختبار الإماراتية',
        descriptionAr: 'خدمات استشارية متخصصة',
        notesAr: 'ملاحظات مهمة للفاتورة'
      }

      await prisma.invoices.create({ data: arabicInvoice })

      // Search using Arabic terms
      const searchRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices?' + new URLSearchParams({
          search: 'استشارية',
          searchFields: 'customerNameAr,descriptionAr,notesAr'
        }).toString()
      )

      const response = await InvoicesGet(searchRequest)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.invoices).toHaveLength(1)
      expect(data.data.invoices[0].id).toBe('invoice-arabic')
    })
  })

  describe('Multi-tenant Security Integration', () => {
    it('should enforce strict company isolation across all operations', async () => {
      // Create second company and user
      const otherCompany = generateTestCompany()
      otherCompany.id = 'other-company'
      const otherUser = generateTestUser(otherCompany.id)
      otherUser.id = 'other-user'

      await prisma.companies.create({ data: otherCompany })
      await prisma.users.create({ data: otherUser })

      // Create invoice in first company
      await prisma.invoices.create({ data: testInvoice })

      // Try to access from other company context
      // This would normally be handled by auth middleware, but we simulate it
      const unauthorizedRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/invoices/${testInvoice.id}`,
        'GET'
      )
      
      // Mock auth context to simulate other company user
      const originalAuth = jest.requireMock('@/lib/auth-utils')
      originalAuth.requireRole.mockResolvedValueOnce({
        user: otherUser,
        company: otherCompany
      })

      const response = await InvoiceGet(unauthorizedRequest, { params: { id: testInvoice.id } })
      expect(response.status).toBe(404) // Should not find invoice from other company

      // Cleanup
      await prisma.users.delete({ where: { id: otherUser.id } })
      await prisma.companies.delete({ where: { id: otherCompany.id } })
    })
  })

  describe('Performance and Load Testing Integration', () => {
    it('should handle realistic invoice volumes efficiently', async () => {
      const startTime = Date.now()
      
      // Create 100 invoices to simulate realistic load
      const invoicePromises = []
      for (let i = 0; i < 100; i++) {
        const invoice = generateTestInvoice(testCompany.id, testCustomer.id)
        invoice.id = `load-invoice-${i}`
        invoice.number = `LOAD-${i.toString().padStart(3, '0')}`
        
        invoicePromises.push(prisma.invoices.create({ data: invoice }))
      }
      
      await Promise.all(invoicePromises)
      
      // Test pagination performance
      const listRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices?' + new URLSearchParams({
          page: '1',
          limit: '20',
          includePayments: 'true',
          includeInsights: 'true'
        }).toString()
      )

      const response = await InvoicesGet(listRequest)
      const endTime = Date.now()
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.invoices).toHaveLength(20)
      expect(data.data.pagination.totalCount).toBeGreaterThanOrEqual(100)
      
      // Performance assertion - should complete within 2 seconds
      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(2000)
      
      // Cleanup
      await prisma.invoices.deleteMany({
        where: { id: { startsWith: 'load-invoice-' } }
      })
    })
  })

  describe('Error Handling and Recovery Integration', () => {
    it('should handle database transaction failures gracefully', async () => {
      // Mock database failure
      const originalTransaction = prisma.$transaction
      jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(
        new Error('Database connection timeout')
      )

      const createRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        testInvoice
      )

      const response = await InvoicesPost(createRequest)
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.type).toBe('INTERNAL_ERROR')

      // Restore original function
      jest.restoreAllMocks()
    })

    it('should validate invoice state transitions properly', async () => {
      // Create invoice in PAID status
      await prisma.invoices.create({
        data: {
          ...testInvoice,
          status: InvoiceStatus.PAID
        }
      })

      // Try to transition from PAID to DRAFT (invalid transition)
      const invalidTransitionRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/invoices/${testInvoice.id}/status`,
        'PATCH',
        {
          status: InvoiceStatus.DRAFT,
          reason: 'Invalid transition attempt'
        }
      )

      const response = await InvoiceStatusPatch(invalidTransitionRequest, { 
        params: { id: testInvoice.id } 
      })
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_STATUS_TRANSITION')
    })
  })
})