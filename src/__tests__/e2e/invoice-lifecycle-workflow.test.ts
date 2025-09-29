/**
 * End-to-End Tests for Full Invoice Workflow
 * Tests complete invoice lifecycle: Create → Send → Payment → Complete
 * Validates UAE business compliance and multi-user scenarios
 */

import { describe, it, expect, jest, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { createMocks } from 'node-mocks-http'
import { 
  generateUAECompany, 
  generateUAECustomer, 
  generateUAEInvoice,
  generateInvoiceBatch,
  testScenarios,
  mockAWSResponse,
  mockPaymentGatewayResponse,
  UAE_BUSINESS_DATA
} from '../utils/uae-test-data'

// Import API handlers for E2E testing
import { POST as createInvoiceHandler } from '@/app/api/invoices/route'
import { PUT as updateInvoiceHandler } from '@/app/api/invoices/[id]/route'
import { POST as updateStatusHandler } from '@/app/api/invoices/[id]/status/route'
import { POST as sendInvoiceHandler } from '@/app/api/invoices/[id]/send/route'
import { POST as processPaymentHandler } from '@/app/api/payments/process/route'
import { POST as bulkActionsHandler } from '@/app/api/invoices/bulk/route'

// Mock external dependencies
jest.mock('@aws-sdk/client-ses')
jest.mock('@/lib/services/email-scheduling-service')
jest.mock('@/lib/services/payment-workflow-service')
jest.mock('@/lib/services/cultural-compliance-service')

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

const prisma = new PrismaClient()

describe('Invoice Lifecycle Workflow E2E Tests', () => {
  let testCompany1: ReturnType<typeof generateUAECompany>
  let testCompany2: ReturnType<typeof generateUAECompany>
  let testCustomer1: ReturnType<typeof generateUAECustomer>
  let testCustomer2: ReturnType<typeof generateUAECustomer>
  let testSession1: any
  let testSession2: any

  beforeAll(async () => {
    await prisma.$connect()
    
    // Setup test companies
    testCompany1 = generateUAECompany()
    testCompany2 = generateUAECompany()
    
    await prisma.companies.createMany({
      data: [
        {
          id: testCompany1.id,
          name: testCompany1.name,
          email: testCompany1.email,
          phone: testCompany1.phone,
          trn: testCompany1.trn,
          isActive: true
        },
        {
          id: testCompany2.id,
          name: testCompany2.name,
          email: testCompany2.email,
          phone: testCompany2.phone,
          trn: testCompany2.trn,
          isActive: true
        }
      ]
    })

    // Setup test customers
    testCustomer1 = generateUAECustomer()
    testCustomer2 = generateUAECustomer()

    await prisma.customers.createMany({
      data: [
        {
          id: testCustomer1.id,
          companyId: testCompany1.id,
          name: testCustomer1.name,
          email: testCustomer1.email,
          phone: testCustomer1.phone,
          isIndividual: testCustomer1.isIndividual
        },
        {
          id: testCustomer2.id,
          companyId: testCompany2.id,
          name: testCustomer2.name,
          email: testCustomer2.email,
          phone: testCustomer2.phone,
          isIndividual: testCustomer2.isIndividual
        }
      ]
    })

    // Setup test sessions
    testSession1 = {
      user: {
        id: 'user-1',
        email: testCompany1.email,
        companyId: testCompany1.id
      }
    }

    testSession2 = {
      user: {
        id: 'user-2',
        email: testCompany2.email,
        companyId: testCompany2.id
      }
    }
  })

  afterAll(async () => {
    // Cleanup test data
    await prisma.invoices.deleteMany({ 
      where: { 
        companyId: { in: [testCompany1.id, testCompany2.id] }
      }
    })
    await prisma.customers.deleteMany({ 
      where: { 
        companyId: { in: [testCompany1.id, testCompany2.id] }
      }
    })
    await prisma.companies.deleteMany({ 
      where: { 
        id: { in: [testCompany1.id, testCompany2.id] }
      }
    })
    await prisma.$disconnect()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock next-auth session
    const { getServerSession } = require('next-auth/next')
    getServerSession.mockResolvedValue(testSession1)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete Invoice Lifecycle - Draft to Paid', () => {
    it('should complete full workflow: Create → Send → View → Payment → Complete', async () => {
      // Step 1: Create Draft Invoice
      const invoiceData = {
        customerId: testCustomer1.id,
        customerName: testCustomer1.name,
        customerEmail: testCustomer1.email,
        customerPhone: testCustomer1.phone,
        amount: 5000.00,
        currency: 'AED',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        description: 'Professional Services - UAE Business Consultation',
        paymentTerms: 'Net 30',
        lineItems: [
          {
            description: 'Business Consultation Hours',
            quantity: 20,
            unitPrice: 250.00,
            total: 5000.00,
            vatRate: 0.05
          }
        ]
      }

      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(createReq as any, createRes as any)

      expect(createRes._getStatusCode()).toBe(201)
      const createResponse = JSON.parse(createRes._getData())
      expect(createResponse.success).toBe(true)
      
      const invoiceId = createResponse.invoice.id
      expect(createResponse.invoice.status).toBe('DRAFT')
      expect(createResponse.invoice.companyId).toBe(testCompany1.id)

      // Step 2: Send Invoice
      const { req: sendReq, res: sendRes } = createMocks({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/send`,
        body: {
          subject: 'Invoice Due - Professional Services',
          message: 'Dear valued customer, please find your invoice attached.',
          sendCopy: true
        }
      })

      // Mock AWS SES
      const mockSES = {
        sendEmail: jest.fn().mockResolvedValue(mockAWSResponse.ses.sendEmail)
      }
      jest.doMock('@aws-sdk/client-ses', () => ({
        SESClient: jest.fn(() => mockSES),
        SendEmailCommand: jest.fn()
      }))

      await sendInvoiceHandler(sendReq as any, sendRes as any)

      expect(sendRes._getStatusCode()).toBe(200)
      const sendResponse = JSON.parse(sendRes._getData())
      expect(sendResponse.success).toBe(true)

      // Verify status changed to SENT
      const sentInvoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(sentInvoice?.status).toBe('SENT')
      expect(sentInvoice?.sentAt).toBeTruthy()

      // Step 3: Customer Views Invoice (simulate)
      const { req: statusReq, res: statusRes } = createMocks({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/status`,
        body: { status: 'VIEWED' }
      })

      await updateStatusHandler(statusReq as any, statusRes as any)

      expect(statusRes._getStatusCode()).toBe(200)
      
      // Verify status changed to VIEWED
      const viewedInvoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(viewedInvoice?.status).toBe('VIEWED')

      // Step 4: Process Payment
      const { req: paymentReq, res: paymentRes } = createMocks({
        method: 'POST',
        body: {
          invoiceId,
          amount: 5250.00, // Including 5% VAT
          currency: 'AED',
          paymentMethod: 'card',
          paymentReference: 'pay_test_123456789'
        }
      })

      // Mock payment gateway
      const mockPaymentService = require('@/lib/services/payment-workflow-service')
      mockPaymentService.processPayment = jest.fn().mockResolvedValue(
        mockPaymentGatewayResponse.success
      )

      await processPaymentHandler(paymentReq as any, paymentRes as any)

      expect(paymentRes._getStatusCode()).toBe(200)
      const paymentResponse = JSON.parse(paymentRes._getData())
      expect(paymentResponse.success).toBe(true)

      // Verify final status is PAID
      const paidInvoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(paidInvoice?.status).toBe('PAID')
      expect(paidInvoice?.paidAt).toBeTruthy()
      expect(paidInvoice?.paymentReference).toBe('pay_test_123456789')
    })

    it('should handle overdue invoice workflow with automated reminders', async () => {
      // Create invoice with past due date
      const overdueInvoiceData = {
        customerId: testCustomer1.id,
        customerName: testCustomer1.name,
        customerEmail: testCustomer1.email,
        customerPhone: testCustomer1.phone,
        amount: 2500.00,
        currency: 'AED',
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        description: 'Overdue Invoice Test',
        status: 'SENT'
      }

      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: overdueInvoiceData
      })

      await createInvoiceHandler(createReq as any, createRes as any)
      const createResponse = JSON.parse(createRes._getData())
      const invoiceId = createResponse.invoice.id

      // Manually update to simulate overdue
      await prisma.invoices.update({
        where: { id: invoiceId },
        data: { 
          status: 'OVERDUE',
          dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      })

      // Test overdue status update
      const { req: statusReq, res: statusRes } = createMocks({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/status`,
        body: { status: 'OVERDUE', sendReminder: true }
      })

      await updateStatusHandler(statusReq as any, statusRes as any)

      expect(statusRes._getStatusCode()).toBe(200)
      
      // Verify overdue handling
      const overdueInvoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(overdueInvoice?.status).toBe('OVERDUE')
      
      // Verify reminder was triggered
      const mockEmailService = require('@/lib/services/email-scheduling-service')
      expect(mockEmailService.scheduleReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId,
          reminderType: 'overdue'
        })
      )
    })
  })

  describe('UAE Business Compliance Validation', () => {
    it('should enforce UAE VAT calculation (5%)', async () => {
      const invoiceData = {
        customerId: testCustomer1.id,
        customerName: testCustomer1.name,
        customerEmail: testCustomer1.email,
        customerPhone: testCustomer1.phone,
        amount: 1000.00,
        currency: 'AED',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: 'VAT Calculation Test',
        applyVat: true
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(201)
      const response = JSON.parse(res._getData())
      
      expect(response.invoice.amount).toBe(1000.00)
      expect(response.invoice.vatAmount).toBe(50.00) // 5% VAT
      expect(response.invoice.totalAmount).toBe(1050.00)
    })

    it('should validate UAE business hours for invoice sending', async () => {
      const mockCulturalService = require('@/lib/services/cultural-compliance-service')
      mockCulturalService.isWithinBusinessHours = jest.fn()
      mockCulturalService.isWorkingDay = jest.fn().mockReturnValue(true)

      // Test during business hours (10 AM UAE time)
      const duringBusinessHours = new Date()
      duringBusinessHours.setUTCHours(6, 0, 0, 0) // 10 AM UAE time (UTC+4)
      mockCulturalService.isWithinBusinessHours.mockReturnValue(true)

      const invoiceData = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })

      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(createReq as any, createRes as any)
      const createResponse = JSON.parse(createRes._getData())
      const invoiceId = createResponse.invoice.id

      const { req: sendReq, res: sendRes } = createMocks({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/send`,
        body: {
          subject: 'Business Hours Test',
          message: 'Test invoice during business hours'
        }
      })

      await sendInvoiceHandler(sendReq as any, sendRes as any)

      expect(sendRes._getStatusCode()).toBe(200)
      expect(mockCulturalService.isWithinBusinessHours).toHaveBeenCalled()
    })

    it('should handle Arabic language support in invoice content', async () => {
      const arabicInvoiceData = {
        customerId: testCustomer1.id,
        customerName: 'شركة الاختبار المحدودة',
        customerEmail: testCustomer1.email,
        customerPhone: testCustomer1.phone,
        amount: 3000.00,
        currency: 'AED',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: 'خدمات استشارية مهنية',
        descriptionAr: 'خدمات استشارية مهنية للأعمال',
        notes: 'يرجى السداد خلال 30 يوم',
        locale: 'ar'
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: arabicInvoiceData
      })

      await createInvoiceHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(201)
      const response = JSON.parse(res._getData())
      
      expect(response.invoice.customerName).toBe('شركة الاختبار المحدودة')
      expect(response.invoice.description).toBe('خدمات استشارية مهنية')
      expect(response.invoice.descriptionAr).toBe('خدمات استشارية مهنية للأعمال')
    })

    it('should validate UAE TRN format when provided', async () => {
      const invoiceWithTRN = {
        customerId: testCustomer1.id,
        customerName: testCustomer1.name,
        customerEmail: testCustomer1.email,
        customerPhone: testCustomer1.phone,
        customerTrn: '100123456789012',
        amount: 1500.00,
        currency: 'AED',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: 'TRN Validation Test'
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: invoiceWithTRN
      })

      await createInvoiceHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(201)
      const response = JSON.parse(res._getData())
      expect(response.invoice.customerTrn).toBe('100123456789012')
    })
  })

  describe('Multi-User and Company Isolation', () => {
    it('should enforce company isolation between different users', async () => {
      // Company 1 user creates invoice
      getServerSession.mockResolvedValue(testSession1)
      
      const invoice1Data = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })

      const { req: create1Req, res: create1Res } = createMocks({
        method: 'POST',
        body: invoice1Data
      })

      await createInvoiceHandler(create1Req as any, create1Res as any)
      const create1Response = JSON.parse(create1Res._getData())
      const invoice1Id = create1Response.invoice.id

      // Company 2 user tries to access Company 1's invoice
      getServerSession.mockResolvedValue(testSession2)

      const { req: update2Req, res: update2Res } = createMocks({
        method: 'PUT',
        url: `/api/invoices/${invoice1Id}`,
        query: { id: invoice1Id },
        body: { amount: 9999.99 } // Attempt to modify
      })

      await updateInvoiceHandler(update2Req as any, update2Res as any)

      // Should be forbidden
      expect(update2Res._getStatusCode()).toBe(403)
      const errorResponse = JSON.parse(update2Res._getData())
      expect(errorResponse.error).toContain('authorized')

      // Verify invoice wasn't modified
      const unchangedInvoice = await prisma.invoices.findUnique({
        where: { id: invoice1Id }
      })
      expect(unchangedInvoice?.amount).toBe(invoice1Data.amount)
    })

    it('should handle concurrent operations from different companies', async () => {
      const company1InvoiceData = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })
      
      const company2InvoiceData = generateUAEInvoice({ 
        customerId: testCustomer2.id,
        companyId: testCompany2.id 
      })

      // Simulate concurrent requests
      getServerSession
        .mockResolvedValueOnce(testSession1)
        .mockResolvedValueOnce(testSession2)

      const [res1, res2] = await Promise.all([
        new Promise<any>(async (resolve) => {
          const { req, res } = createMocks({
            method: 'POST',
            body: company1InvoiceData
          })
          await createInvoiceHandler(req as any, res as any)
          resolve(JSON.parse(res._getData()))
        }),
        new Promise<any>(async (resolve) => {
          const { req, res } = createMocks({
            method: 'POST',
            body: company2InvoiceData
          })
          await createInvoiceHandler(req as any, res as any)
          resolve(JSON.parse(res._getData()))
        })
      ])

      // Both should succeed
      expect(res1.success).toBe(true)
      expect(res2.success).toBe(true)
      
      // Should belong to correct companies
      expect(res1.invoice.companyId).toBe(testCompany1.id)
      expect(res2.invoice.companyId).toBe(testCompany2.id)
    })
  })

  describe('Bulk Operations Workflow', () => {
    it('should handle bulk status updates with business rule validation', async () => {
      // Create multiple invoices for bulk operations
      const bulkInvoices = generateInvoiceBatch(5, { 
        companyId: testCompany1.id,
        customerId: testCustomer1.id 
      })

      const invoiceIds: string[] = []

      for (const invoiceData of bulkInvoices) {
        const { req, res } = createMocks({
          method: 'POST',
          body: invoiceData
        })

        await createInvoiceHandler(req as any, res as any)
        const response = JSON.parse(res._getData())
        invoiceIds.push(response.invoice.id)
      }

      // Perform bulk status update
      const { req: bulkReq, res: bulkRes } = createMocks({
        method: 'POST',
        body: {
          action: 'update_status',
          invoiceIds,
          status: 'SENT',
          sendEmails: true
        }
      })

      await bulkActionsHandler(bulkReq as any, bulkRes as any)

      expect(bulkRes._getStatusCode()).toBe(200)
      const bulkResponse = JSON.parse(bulkRes._getData())
      expect(bulkResponse.success).toBe(true)
      expect(bulkResponse.processed).toBe(5)

      // Verify all invoices were updated
      const updatedInvoices = await prisma.invoices.findMany({
        where: { id: { in: invoiceIds } }
      })

      updatedInvoices.forEach(invoice => {
        expect(invoice.status).toBe('SENT')
        expect(invoice.sentAt).toBeTruthy()
      })
    })

    it('should handle bulk payment processing with validation', async () => {
      // Create invoices for bulk payment
      const paymentInvoices = generateInvoiceBatch(3, { 
        companyId: testCompany1.id,
        customerId: testCustomer1.id,
        status: 'SENT'
      })

      const invoiceIds: string[] = []

      for (const invoiceData of paymentInvoices) {
        const { req, res } = createMocks({
          method: 'POST',
          body: invoiceData
        })

        await createInvoiceHandler(req as any, res as any)
        const response = JSON.parse(res._getData())
        invoiceIds.push(response.invoice.id)
      }

      // Mock successful bulk payment
      const mockPaymentService = require('@/lib/services/payment-workflow-service')
      mockPaymentService.processBulkPayments = jest.fn().mockResolvedValue({
        successful: invoiceIds.length,
        failed: 0,
        results: invoiceIds.map(id => ({
          invoiceId: id,
          success: true,
          transactionId: `tx_${id.substring(0, 8)}`
        }))
      })

      const { req: bulkPaymentReq, res: bulkPaymentRes } = createMocks({
        method: 'POST',
        body: {
          action: 'bulk_payment',
          invoiceIds,
          paymentMethod: 'bank_transfer',
          totalAmount: paymentInvoices.reduce((sum, inv) => sum + inv.amount, 0)
        }
      })

      await bulkActionsHandler(bulkPaymentReq as any, bulkPaymentRes as any)

      expect(bulkPaymentRes._getStatusCode()).toBe(200)
      const response = JSON.parse(bulkPaymentRes._getData())
      expect(response.success).toBe(true)
      expect(response.processed).toBe(3)
    })
  })

  describe('Error Scenarios and Recovery', () => {
    it('should handle payment failures gracefully', async () => {
      const invoiceData = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })

      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(createReq as any, createRes as any)
      const createResponse = JSON.parse(createRes._getData())
      const invoiceId = createResponse.invoice.id

      // Mock payment failure
      const mockPaymentService = require('@/lib/services/payment-workflow-service')
      mockPaymentService.processPayment = jest.fn().mockRejectedValue(
        new Error('Payment gateway error: insufficient funds')
      )

      const { req: paymentReq, res: paymentRes } = createMocks({
        method: 'POST',
        body: {
          invoiceId,
          amount: invoiceData.amount,
          currency: 'AED',
          paymentMethod: 'card'
        }
      })

      await processPaymentHandler(paymentReq as any, paymentRes as any)

      expect(paymentRes._getStatusCode()).toBe(400)
      const paymentResponse = JSON.parse(paymentRes._getData())
      expect(paymentResponse.success).toBe(false)
      expect(paymentResponse.error).toContain('Payment gateway error')

      // Verify invoice status unchanged
      const unchangedInvoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(unchangedInvoice?.status).not.toBe('PAID')
    })

    it('should handle email sending failures with retry logic', async () => {
      const invoiceData = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })

      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(createReq as any, createRes as any)
      const createResponse = JSON.parse(createRes._getData())
      const invoiceId = createResponse.invoice.id

      // Mock email sending failure
      const mockSES = {
        sendEmail: jest.fn().mockRejectedValue(new Error('SES service unavailable'))
      }
      
      jest.doMock('@aws-sdk/client-ses', () => ({
        SESClient: jest.fn(() => mockSES),
        SendEmailCommand: jest.fn()
      }))

      const { req: sendReq, res: sendRes } = createMocks({
        method: 'POST',
        url: `/api/invoices/${invoiceId}/send`,
        body: {
          subject: 'Test Invoice',
          message: 'Email failure test'
        }
      })

      await sendInvoiceHandler(sendReq as any, sendRes as any)

      expect(sendRes._getStatusCode()).toBe(500)
      const sendResponse = JSON.parse(sendRes._getData())
      expect(sendResponse.success).toBe(false)
      expect(sendResponse.error).toContain('Failed to send email')

      // Verify invoice status didn't change to SENT
      const invoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(invoice?.status).toBe('DRAFT')
    })

    it('should handle database transaction rollbacks', async () => {
      // Mock database error during invoice creation
      const originalCreate = prisma.invoices.create
      prisma.invoices.create = jest.fn().mockRejectedValueOnce(
        new Error('Database connection lost')
      )

      const invoiceData = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(false)
      expect(response.error).toContain('Database')

      // Restore original method
      prisma.invoices.create = originalCreate
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle high-volume invoice creation efficiently', async () => {
      const startTime = Date.now()
      const batchSize = 50
      
      const invoiceBatch = generateInvoiceBatch(batchSize, {
        companyId: testCompany1.id,
        customerId: testCustomer1.id
      })

      const promises = invoiceBatch.map(invoiceData => 
        new Promise<void>(async (resolve) => {
          const { req, res } = createMocks({
            method: 'POST',
            body: invoiceData
          })
          
          await createInvoiceHandler(req as any, res as any)
          expect(res._getStatusCode()).toBe(201)
          resolve()
        })
      )

      await Promise.all(promises)
      
      const processingTime = Date.now() - startTime
      const avgTimePerInvoice = processingTime / batchSize
      
      // Should process each invoice in reasonable time
      expect(avgTimePerInvoice).toBeLessThan(100) // Less than 100ms per invoice
      
      // Verify all invoices were created
      const createdInvoices = await prisma.invoices.findMany({
        where: { companyId: testCompany1.id }
      })
      expect(createdInvoices.length).toBeGreaterThanOrEqual(batchSize)
    })

    it('should maintain data integrity under concurrent operations', async () => {
      const invoiceData = generateUAEInvoice({ 
        customerId: testCustomer1.id,
        companyId: testCompany1.id 
      })

      const { req: createReq, res: createRes } = createMocks({
        method: 'POST',
        body: invoiceData
      })

      await createInvoiceHandler(createReq as any, createRes as any)
      const createResponse = JSON.parse(createRes._getData())
      const invoiceId = createResponse.invoice.id

      // Simulate concurrent status updates
      const statusUpdates = [
        { status: 'SENT' },
        { status: 'VIEWED' },
        { status: 'PAID' }
      ]

      const promises = statusUpdates.map(update => 
        new Promise<any>(async (resolve) => {
          const { req, res } = createMocks({
            method: 'POST',
            url: `/api/invoices/${invoiceId}/status`,
            body: update
          })
          
          await updateStatusHandler(req as any, res as any)
          resolve(res._getStatusCode())
        })
      )

      const results = await Promise.all(promises)
      
      // At least one should succeed
      expect(results.some(status => status === 200)).toBe(true)
      
      // Final state should be consistent
      const finalInvoice = await prisma.invoices.findUnique({
        where: { id: invoiceId }
      })
      expect(['SENT', 'VIEWED', 'PAID']).toContain(finalInvoice?.status)
    })
  })
})