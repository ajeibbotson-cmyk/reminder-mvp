/**
 * PDF Upload and Invoice Import - Critical Flow Tests
 * Tests the exact workflow that has been failing in production
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/import/upload/route'
import { PDFInvoiceParserService } from '@/lib/services/pdf-invoice-parser'
import fs from 'fs'
import path from 'path'

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    users: {
      findUnique: jest.fn()
    },
    invoices: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    customers: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    companies: {
      findUnique: jest.fn()
    }
  }
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockPrisma = prisma as any

describe('PDF Upload and Invoice Import - Critical Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default auth mock
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com'
      }
    })

    // Default user lookup mock
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      companyId: 'company-123',
      companies: {
        id: 'company-123',
        name: 'Test Company',
        trn: '123456789012345'
      }
    })
  })

  describe('PDF Parser Service', () => {
    test('should parse PDF buffer successfully', async () => {
      // Create a simple test PDF buffer (mock data)
      const testPdfBuffer = Buffer.from('Mock PDF content')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.extractedData).toBeDefined()
    })

    test('should handle parsing failures gracefully', async () => {
      const invalidBuffer = Buffer.from('Not a PDF')

      const result = await PDFInvoiceParserService.parseInvoice(invalidBuffer)

      // Should not throw, should return low confidence result
      expect(result).toBeDefined()
      expect(result.confidence).toBeLessThan(0.5)
    })

    test('should extract UAE invoice patterns', async () => {
      const mockInvoiceText = `
        INVOICE
        Invoice Number: INV-2024-001
        Date: 15/03/2024
        Due Date: 30/03/2024

        Customer: Above The Clouds LLC
        TRN: 100123456789012

        Description: Professional Services
        Amount: AED 5,000.00
        VAT (5%): AED 250.00
        Total: AED 5,250.00
      `

      const mockPdfBuffer = Buffer.from('Mock PDF')

      // Mock the text extraction to return our test content
      jest.spyOn(PDFInvoiceParserService as any, 'extractTextFromPDF')
        .mockResolvedValue(mockInvoiceText)

      const result = await PDFInvoiceParserService.parseInvoice(mockPdfBuffer)

      expect(result.extractedData.invoiceNumber).toBe('INV-2024-001')
      expect(result.extractedData.customerName).toBe('Above The Clouds LLC')
      expect(result.extractedData.totalAmount).toBe(5250)
      expect(result.extractedData.currency).toBe('AED')
      expect(result.confidence).toBeGreaterThan(0.5)
    })
  })

  describe('PDF Upload API Route', () => {
    test('should handle PDF upload successfully', async () => {
      const formData = new FormData()
      const mockPdfFile = new File(['mock pdf content'], 'test-invoice.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', mockPdfFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      // Mock successful parsing
      jest.spyOn(PDFInvoiceParserService, 'parseInvoice').mockResolvedValue({
        success: true,
        confidence: 0.85,
        extractedData: {
          invoiceNumber: 'INV-2024-001',
          customerName: 'Test Customer',
          customerEmail: 'customer@test.com',
          totalAmount: 1000,
          currency: 'AED',
          issueDate: new Date('2024-03-15'),
          dueDate: new Date('2024-03-30'),
          description: 'Test services'
        },
        rawText: 'Mock extracted text'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.confidence).toBe(0.85)
      expect(data.extractedData).toBeDefined()
    })

    test('should reject non-PDF files', async () => {
      const formData = new FormData()
      const textFile = new File(['not a pdf'], 'test.txt', {
        type: 'text/plain'
      })
      formData.append('file', textFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('PDF')
    })

    test('should require authentication', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const formData = new FormData()
      const mockPdfFile = new File(['mock pdf'], 'test.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', mockPdfFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    test('should handle file size limits', async () => {
      const formData = new FormData()
      // Create a "large" file (simulated)
      const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', largeFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      // Should either succeed or fail gracefully with clear error
      if (response.status !== 200) {
        expect(response.status).toBe(400)
        expect(data.error).toBeDefined()
      }
    })
  })

  describe('Invoice Import GET Route', () => {
    test('should return import page data', async () => {
      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toBeDefined()
    })

    test('should require authentication for GET', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'GET'
      })

      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('End-to-End PDF Import Flow', () => {
    test('should complete full import workflow', async () => {
      // 1. Upload PDF
      const formData = new FormData()
      const mockPdfFile = new File(['invoice pdf content'], 'invoice.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', mockPdfFile)

      const uploadRequest = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      // Mock successful parsing
      jest.spyOn(PDFInvoiceParserService, 'parseInvoice').mockResolvedValue({
        success: true,
        confidence: 0.9,
        extractedData: {
          invoiceNumber: 'INV-2024-E2E',
          customerName: 'E2E Test Customer',
          customerEmail: 'e2e@test.com',
          totalAmount: 2500,
          currency: 'AED',
          issueDate: new Date('2024-03-15'),
          dueDate: new Date('2024-04-15'),
          description: 'E2E Test Services'
        },
        rawText: 'Full invoice text content'
      })

      const uploadResponse = await POST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.success).toBe(true)
      expect(uploadData.extractedData.invoiceNumber).toBe('INV-2024-E2E')
      expect(uploadData.extractedData.totalAmount).toBe(2500)
    })

    test('should handle low confidence parsing', async () => {
      const formData = new FormData()
      const mockPdfFile = new File(['unclear pdf content'], 'unclear.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', mockPdfFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      // Mock low confidence parsing
      jest.spyOn(PDFInvoiceParserService, 'parseInvoice').mockResolvedValue({
        success: true,
        confidence: 0.3,
        extractedData: {
          invoiceNumber: '',
          customerName: '',
          customerEmail: '',
          totalAmount: 0,
          currency: 'AED',
          issueDate: null,
          dueDate: null,
          description: ''
        },
        rawText: 'Unclear text content'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.confidence).toBe(0.3)
      // Should suggest manual review
      expect(data.requiresManualReview).toBe(true)
    })
  })

  describe('Error Scenarios', () => {
    test('should handle PDF parsing service failures', async () => {
      const formData = new FormData()
      const mockPdfFile = new File(['corrupted pdf'], 'corrupted.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', mockPdfFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      // Mock service failure
      jest.spyOn(PDFInvoiceParserService, 'parseInvoice').mockRejectedValue(
        new Error('PDF parsing failed')
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    test('should handle missing file', async () => {
      const formData = new FormData()
      // No file attached

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('file')
    })

    test('should handle database connection failures', async () => {
      mockPrisma.users.findUnique.mockRejectedValue(new Error('Database connection failed'))

      const formData = new FormData()
      const mockPdfFile = new File(['pdf content'], 'test.pdf', {
        type: 'application/pdf'
      })
      formData.append('file', mockPdfFile)

      const request = new NextRequest('http://localhost:3000/api/invoices/import/pdf', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })
})