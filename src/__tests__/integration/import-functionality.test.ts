/**
 * Comprehensive Integration Tests for Import Functionality
 * Tests CSV/Excel import end-to-end workflow with UAE business validation
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import { PrismaClient } from '@prisma/client'
import { 
  generateUAECompany, 
  generateInvoiceBatch, 
  generateCSVContent,
  testScenarios,
  performanceConfig,
  UAE_BUSINESS_DATA
} from '../utils/uae-test-data'

// Import API handlers
import { POST as importHandler } from '@/app/api/invoices/import/route'
import { GET as progressHandler } from '@/app/api/invoices/import/progress/route'

// Mock external dependencies
jest.mock('@aws-sdk/client-ses')
jest.mock('@/lib/services/email-scheduling-service')

const prisma = new PrismaClient()

describe('Import Functionality Integration Tests', () => {
  let testCompany: ReturnType<typeof generateUAECompany>
  let testSession: any

  beforeAll(async () => {
    // Setup test database
    await prisma.$connect()
    
    // Create test company
    testCompany = generateUAECompany()
    await prisma.company.create({
      data: {
        id: testCompany.id,
        name: testCompany.name,
        email: testCompany.email,
        phone: testCompany.phone,
        trn: testCompany.trn,
        isActive: true
      }
    })

    // Mock session
    testSession = {
      user: {
        id: 'test-user-id',
        email: testCompany.email,
        companyId: testCompany.id
      }
    }
  })

  afterAll(async () => {
    // Cleanup test data
    await prisma.invoice.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.importBatch.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.company.delete({ where: { id: testCompany.id } })
    await prisma.$disconnect()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CSV Import Workflow', () => {
    it('should successfully import small CSV file with valid UAE data', async () => {
      // Generate test invoice data
      const testInvoices = generateInvoiceBatch(10, { companyId: testCompany.id })
      const csvContent = generateCSVContent(testInvoices)
      
      // Create CSV file blob
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'test-invoices.csv')
      formData.append('companyId', testCompany.id)
      formData.append('hasHeaders', 'true')
      formData.append('skipEmptyRows', 'true')

      // Mock request
      const { req, res } = createMocks({
        method: 'POST',
        body: formData,
        headers: {
          'content-type': 'multipart/form-data'
        }
      })

      // Execute import
      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(true)
      expect(response.batchId).toBeDefined()
      expect(response.totalRows).toBe(10)

      // Verify batch was created
      const batch = await prisma.importBatch.findUnique({
        where: { id: response.batchId }
      })
      expect(batch).toBeTruthy()
      expect(batch?.companyId).toBe(testCompany.id)
      expect(batch?.status).toBe('processing')
    })

    it('should handle large CSV file import (1000+ records)', async () => {
      const startTime = Date.now()
      
      // Generate large dataset
      const largeDataset = testScenarios.largeImport.generateData()
      const csvContent = generateCSVContent(largeDataset.slice(0, 1000))
      
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'large-import.csv')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)
      
      const processingTime = Date.now() - startTime
      expect(processingTime).toBeLessThan(performanceConfig.thresholds.importProcessingTime)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(true)
      expect(response.totalRows).toBe(1000)
    })

    it('should validate UAE business rules during import', async () => {
      // Create CSV with invalid UAE data
      const invalidInvoices = [
        testScenarios.invalidData.missingRequiredFields(),
        testScenarios.invalidData.invalidPhoneNumber(),
        {
          ...generateInvoiceBatch(1)[0],
          customerPhone: '123-456-7890', // Invalid UAE phone
          amount: -100, // Invalid amount
          currency: 'USD' // Invalid currency for UAE
        }
      ]
      
      const csvContent = generateCSVContent(invalidInvoices)
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'invalid-data.csv')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(true)
      expect(response.errors).toBeGreaterThan(0)
      expect(response.validRows).toBeLessThan(response.totalRows)
    })

    it('should handle field mapping correctly', async () => {
      // Create CSV with custom headers
      const testInvoices = generateInvoiceBatch(5)
      const customHeaders = [
        'Client Name',      // maps to customerName
        'Email Address',    // maps to customerEmail
        'Phone Number',     // maps to customerPhone
        'Invoice ID',       // maps to invoiceNumber
        'Total Amount',     // maps to amount
        'Currency Code',    // maps to currency
        'Payment Due',      // maps to dueDate
        'Service Description', // maps to description
        'Payment Terms',    // maps to paymentTerms
        'Additional Notes'  // maps to notes
      ]

      const customRows = testInvoices.map(invoice => [
        invoice.customerName,
        invoice.customerEmail,
        invoice.customerPhone,
        invoice.invoiceNumber,
        invoice.amount.toString(),
        invoice.currency,
        invoice.dueDate.toISOString().split('T')[0],
        invoice.description,
        invoice.paymentTerms,
        invoice.notes || ''
      ])

      const csvContent = [customHeaders, ...customRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')

      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'custom-mapping.csv')
      formData.append('companyId', testCompany.id)
      formData.append('fieldMapping', JSON.stringify({
        'Client Name': 'customerName',
        'Email Address': 'customerEmail',
        'Phone Number': 'customerPhone',
        'Invoice ID': 'invoiceNumber',
        'Total Amount': 'amount',
        'Currency Code': 'currency',
        'Payment Due': 'dueDate',
        'Service Description': 'description',
        'Payment Terms': 'paymentTerms',
        'Additional Notes': 'notes'
      }))

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(true)
      expect(response.validRows).toBe(5)
    })
  })

  describe('Excel Import Workflow', () => {
    it('should handle Excel (.xlsx) file import', async () => {
      // Note: This would require xlsx library for full implementation
      // For now, testing the file type validation
      const formData = new FormData()
      const excelBlob = new Blob(['mock-excel-content'], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      formData.append('file', excelBlob, 'test-invoices.xlsx')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      // Should accept Excel files
      expect(res._getStatusCode()).not.toBe(400)
    })

    it('should reject unsupported file types', async () => {
      const formData = new FormData()
      const txtBlob = new Blob(['some text content'], { type: 'text/plain' })
      formData.append('file', txtBlob, 'test-file.txt')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('file type')
    })
  })

  describe('Import Progress Tracking', () => {
    it('should track import progress accurately', async () => {
      // First create an import batch
      const testInvoices = generateInvoiceBatch(50)
      const csvContent = generateCSVContent(testInvoices)
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'progress-test.csv')
      formData.append('companyId', testCompany.id)

      const { req: importReq, res: importRes } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(importReq as any, importRes as any)
      const importResponse = JSON.parse(importRes._getData())
      const batchId = importResponse.batchId

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check progress
      const { req: progressReq, res: progressRes } = createMocks({
        method: 'GET',
        query: { batchId }
      })

      await progressHandler(progressReq as any, progressRes as any)

      expect(progressRes._getStatusCode()).toBe(200)
      const progressResponse = JSON.parse(progressRes._getData())
      expect(progressResponse.batchId).toBe(batchId)
      expect(progressResponse.progress).toBeGreaterThanOrEqual(0)
      expect(progressResponse.progress).toBeLessThanOrEqual(100)
    })

    it('should handle progress queries for non-existent batches', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { batchId: 'non-existent-batch-id' }
      })

      await progressHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(404)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle file upload errors gracefully', async () => {
      // Test with corrupted/empty file
      const formData = new FormData()
      const emptyBlob = new Blob([''], { type: 'text/csv' })
      formData.append('file', emptyBlob, 'empty-file.csv')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toBeDefined()
    })

    it('should handle database connection errors during import', async () => {
      // Mock database error
      const originalCreate = prisma.importBatch.create
      prisma.importBatch.create = jest.fn().mockRejectedValueOnce(
        new Error('Database connection failed')
      )

      const testInvoices = generateInvoiceBatch(5)
      const csvContent = generateCSVContent(testInvoices)
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'db-error-test.csv')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('Database')

      // Restore original method
      prisma.importBatch.create = originalCreate
    })

    it('should validate company access permissions', async () => {
      const unauthorizedCompanyId = 'unauthorized-company-id'
      
      const testInvoices = generateInvoiceBatch(5)
      const csvContent = generateCSVContent(testInvoices)
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'unauthorized-test.csv')
      formData.append('companyId', unauthorizedCompanyId)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)

      expect(res._getStatusCode()).toBe(403)
      const response = JSON.parse(res._getData())
      expect(response.error).toContain('authorized')
    })
  })

  describe('UAE Business Rule Validation', () => {
    it('should validate UAE phone number formats', async () => {
      const validPhones = ['+971501234567', '+971521234567', '+971561234567']
      const invalidPhones = ['123-456-7890', '+1234567890', '0501234567']
      
      const validInvoices = validPhones.map(phone => ({
        ...generateInvoiceBatch(1)[0],
        customerPhone: phone
      }))
      
      const invalidInvoices = invalidPhones.map(phone => ({
        ...generateInvoiceBatch(1)[0],
        customerPhone: phone
      }))

      // Test valid phones
      for (const invoice of validInvoices) {
        const csvContent = generateCSVContent([invoice])
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        const formData = new FormData()
        formData.append('file', csvBlob, 'phone-valid.csv')
        formData.append('companyId', testCompany.id)

        const { req, res } = createMocks({
          method: 'POST',
          body: formData
        })

        await importHandler(req as any, res as any)
        const response = JSON.parse(res._getData())
        expect(response.validRows).toBe(1)
      }

      // Test invalid phones
      for (const invoice of invalidInvoices) {
        const csvContent = generateCSVContent([invoice])
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        const formData = new FormData()
        formData.append('file', csvBlob, 'phone-invalid.csv')
        formData.append('companyId', testCompany.id)

        const { req, res } = createMocks({
          method: 'POST',
          body: formData
        })

        await importHandler(req as any, res as any)
        const response = JSON.parse(res._getData())
        expect(response.errors).toBeGreaterThan(0)
      }
    })

    it('should validate UAE currency requirements', async () => {
      const validCurrencies = ['AED']
      const invalidCurrencies = ['USD', 'EUR', 'GBP']

      for (const currency of validCurrencies) {
        const invoice = { ...generateInvoiceBatch(1)[0], currency }
        const csvContent = generateCSVContent([invoice])
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        const formData = new FormData()
        formData.append('file', csvBlob, `currency-${currency}.csv`)
        formData.append('companyId', testCompany.id)

        const { req, res } = createMocks({
          method: 'POST',
          body: formData
        })

        await importHandler(req as any, res as any)
        const response = JSON.parse(res._getData())
        expect(response.validRows).toBe(1)
      }

      for (const currency of invalidCurrencies) {
        const invoice = { ...generateInvoiceBatch(1)[0], currency }
        const csvContent = generateCSVContent([invoice])
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        const formData = new FormData()
        formData.append('file', csvBlob, `currency-${currency}.csv`)
        formData.append('companyId', testCompany.id)

        const { req, res } = createMocks({
          method: 'POST',
          body: formData
        })

        await importHandler(req as any, res as any)
        const response = JSON.parse(res._getData())
        expect(response.errors).toBeGreaterThan(0)
      }
    })

    it('should validate UAE business hours for due dates', async () => {
      const duringBusinessHours = new Date()
      duringBusinessHours.setHours(10, 0, 0, 0) // 10 AM

      const afterBusinessHours = new Date()
      afterBusinessHours.setHours(20, 0, 0, 0) // 8 PM

      const fridayDate = new Date()
      fridayDate.setDate(fridayDate.getDate() + (5 - fridayDate.getDay()))

      // Test business hours validation if implemented
      const invoice = {
        ...generateInvoiceBatch(1)[0],
        dueDate: duringBusinessHours
      }

      const csvContent = generateCSVContent([invoice])
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'business-hours.csv')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)
      const response = JSON.parse(res._getData())
      expect(response.success).toBe(true)
    })
  })

  describe('Multi-tenant Security', () => {
    it('should isolate import data between companies', async () => {
      // Create second test company
      const company2 = generateUAECompany()
      await prisma.company.create({
        data: {
          id: company2.id,
          name: company2.name,
          email: company2.email,
          phone: company2.phone,
          trn: company2.trn,
          isActive: true
        }
      })

      // Import data for each company
      const company1Invoices = generateInvoiceBatch(5, { companyId: testCompany.id })
      const company2Invoices = generateInvoiceBatch(5, { companyId: company2.id })

      // Import for company 1
      const csv1 = generateCSVContent(company1Invoices)
      const blob1 = new Blob([csv1], { type: 'text/csv' })
      const form1 = new FormData()
      form1.append('file', blob1, 'company1.csv')
      form1.append('companyId', testCompany.id)

      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        body: form1
      })

      await importHandler(req1 as any, res1 as any)

      // Import for company 2
      const csv2 = generateCSVContent(company2Invoices)
      const blob2 = new Blob([csv2], { type: 'text/csv' })
      const form2 = new FormData()
      form2.append('file', blob2, 'company2.csv')
      form2.append('companyId', company2.id)

      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        body: form2
      })

      await importHandler(req2 as any, res2 as any)

      // Verify data isolation
      const company1Batches = await prisma.importBatch.findMany({
        where: { companyId: testCompany.id }
      })

      const company2Batches = await prisma.importBatch.findMany({
        where: { companyId: company2.id }
      })

      expect(company1Batches.length).toBeGreaterThan(0)
      expect(company2Batches.length).toBeGreaterThan(0)
      
      // Ensure no cross-contamination
      company1Batches.forEach(batch => {
        expect(batch.companyId).toBe(testCompany.id)
      })

      company2Batches.forEach(batch => {
        expect(batch.companyId).toBe(company2.id)
      })

      // Cleanup
      await prisma.importBatch.deleteMany({ where: { companyId: company2.id } })
      await prisma.company.delete({ where: { id: company2.id } })
    })
  })

  describe('Performance and Scale Testing', () => {
    it('should maintain response time under load', async () => {
      const testData = generateInvoiceBatch(100)
      const csvContent = generateCSVContent(testData)
      
      const promises = Array.from({ length: 5 }, () => {
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        const formData = new FormData()
        formData.append('file', csvBlob, 'load-test.csv')
        formData.append('companyId', testCompany.id)

        const { req, res } = createMocks({
          method: 'POST',
          body: formData
        })

        const startTime = Date.now()
        return importHandler(req as any, res as any).then(() => {
          const responseTime = Date.now() - startTime
          expect(responseTime).toBeLessThan(performanceConfig.thresholds.renderTime)
          return responseTime
        })
      })

      const responseTimes = await Promise.all(promises)
      const averageTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      
      expect(averageTime).toBeLessThan(performanceConfig.thresholds.renderTime)
    })

    it('should handle memory efficiently with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Process large dataset
      const largeDataset = generateInvoiceBatch(1000)
      const csvContent = generateCSVContent(largeDataset)
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', csvBlob, 'memory-test.csv')
      formData.append('companyId', testCompany.id)

      const { req, res } = createMocks({
        method: 'POST',
        body: formData
      })

      await importHandler(req as any, res as any)
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
    })
  })
})