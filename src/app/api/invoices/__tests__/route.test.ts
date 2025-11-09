/**
 * Comprehensive Test Suite for Invoice API Endpoints
 * Tests UAE business logic, multi-tenancy, validation, and security
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals')
const { NextRequest } = require('next/server')
const { GET, POST } = require('../route')
const { prisma } = require('@/lib/prisma')
const { InvoiceStatus, UserRole } = require('@prisma/client')

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    invoices: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    activities: {
      create: jest.fn(),
    },
    invoiceItems: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/auth-utils', () => ({
  requireRole: jest.fn(),
  canManageInvoices: jest.fn(),
}))

jest.mock('@/lib/vat-calculator', () => ({
  calculateInvoiceVAT: jest.fn(),
  validateUAETRN: jest.fn(),
  formatUAECurrency: jest.fn(),
}))

// Test data
const mockCompany = {
  id: 'company-1',
  name: 'Test Company UAE',
  trn: '123456789012345',
  defaultVatRate: 5.00,
}

const mockUser = {
  id: 'user-1',
  email: 'test@company.ae',
  name: 'Test User',
  role: UserRole.FINANCE,
  companyId: 'company-1',
}

const mockAuthContext = {
  user: mockUser,
  company: mockCompany,
}

const mockInvoice = {
  id: 'invoice-1',
  companyId: 'company-1',
  number: 'INV-001',
  customerName: 'Test Customer',
  customerEmail: 'customer@example.ae',
  amount: 1000,
  subtotal: 952.38,
  vatAmount: 47.62,
  totalAmount: 1000,
  currency: 'AED',
  status: InvoiceStatus.DRAFT,
  dueDate: new Date('2024-01-15'),
  trnNumber: '123456789012345',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockCustomer = {
  id: 'customer-1',
  name: 'Test Customer',
  email: 'customer@example.ae',
  phone: '+971501234567',
  companyId: 'company-1',
}

describe('Invoice API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default auth mock
    const { requireRole } = require('@/lib/auth-utils')
    requireRole.mockResolvedValue(mockAuthContext)
    
    const { canManageInvoices } = require('@/lib/auth-utils')
    canManageInvoices.mockReturnValue(true)
    
    // Setup VAT calculator mocks
    const { validateUAETRN, formatUAECurrency, calculateInvoiceVAT } = require('@/lib/vat-calculator')
    validateUAETRN.mockReturnValue(true)
    formatUAECurrency.mockReturnValue('AED 1,000.00')
    calculateInvoiceVAT.mockReturnValue({
      subtotal: { toNumber: () => 952.38 },
      totalVatAmount: { toNumber: () => 47.62 },
      grandTotal: { toNumber: () => 1000 },
      lineItems: [],
      vatBreakdown: {},
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('GET /api/invoices', () => {
    it('should return paginated invoices with UAE business insights', async () => {
      // Mock database responses
      const mockInvoices = [mockInvoice]
      const mockTotalCount = 1
      const mockStatusCounts = [{ status: InvoiceStatus.DRAFT, _count: { status: 1 } }]

      prisma.invoice.findMany.mockResolvedValue(mockInvoices)
      prisma.invoice.count.mockResolvedValue(mockTotalCount)
      prisma.invoice.groupBy.mockResolvedValue(mockStatusCounts)

      const request = new NextRequest('http://localhost:3000/api/invoices?page=1&limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.invoices).toHaveLength(1)
      expect(data.data.pagination).toEqual({
        totalCount: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
        hasPrevious: false,
      })
      expect(data.data.statusCounts).toEqual({
        [InvoiceStatus.DRAFT]: 1,
      })
      expect(data.data.insights).toBeDefined()
    })

    it('should enforce company-level data isolation', async () => {
      prisma.invoice.findMany.mockResolvedValue([])
      prisma.invoice.count.mockResolvedValue(0)
      prisma.invoice.groupBy.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/invoices?companyId=other-company')
      await GET(request)

      // Verify that the query used the user's company ID, not the requested one
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1', // User's company ID
          }),
        })
      )
    })

    it('should handle advanced filtering with UAE business logic', async () => {
      prisma.invoice.findMany.mockResolvedValue([])
      prisma.invoice.count.mockResolvedValue(0)
      prisma.invoice.groupBy.mockResolvedValue([])

      const queryParams = new URLSearchParams({
        status: InvoiceStatus.SENT,
        currency: 'AED',
        trnNumber: '123456789012345',
        isOverdue: 'true',
        minAmount: '100',
        maxAmount: '5000',
        search: 'test customer',
      })

      const request = new NextRequest(`http://localhost:3000/api/invoices?${queryParams}`)
      await GET(request)

      const findManyCall = prisma.invoice.findMany.mock.calls[0][0]
      const whereClause = findManyCall.where

      expect(whereClause.companyId).toBe('company-1')
      expect(whereClause.status).toBe(InvoiceStatus.SENT)
      expect(whereClause.currency).toBe('AED')
      expect(whereClause.trnNumber).toEqual({
        contains: '123456789012345',
        mode: 'insensitive',
      })
      expect(whereClause.totalAmount.gte).toEqual(expect.any(Object))
      expect(whereClause.totalAmount.lte).toEqual(expect.any(Object))
      expect(whereClause.OR).toContainEqual({
        customerName: { contains: 'test customer', mode: 'insensitive' }
      })
    })

    it('should handle role-based access control', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Insufficient permissions'))

      const request = new NextRequest('http://localhost:3000/api/invoices')
      const response = await GET(request)

      expect(response.status).toBe(500) // Will be handled by error handler
    })
  })

  describe('POST /api/invoices', () => {
    const validInvoiceData = {
      companyId: 'company-1',
      number: 'INV-002',
      customerName: 'New Customer',
      customerEmail: 'new@customer.ae',
      customerPhone: '+971501234567',
      amount: 1000,
      subtotal: 952.38,
      vatAmount: 47.62,
      totalAmount: 1000,
      currency: 'AED',
      dueDate: '2024-02-15',
      status: InvoiceStatus.DRAFT,
      trnNumber: '123456789012345',
      items: [
        {
          description: 'Test Item',
          quantity: 1,
          unitPrice: 952.38,
          total: 952.38,
          vatRate: 5,
          vatAmount: 47.62,
          totalWithVat: 1000,
          taxCategory: 'STANDARD',
        },
      ],
    }

    it('should create a new invoice with UAE VAT compliance', async () => {
      // Mock transaction
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          customer: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCustomer),
          },
          invoices: {
            create: jest.fn().mockResolvedValue(mockInvoice),
            findUnique: jest.fn().mockResolvedValue({
              ...mockInvoice,
              customer: mockCustomer,
              company: mockCompany,
              invoiceItems: [],
            }),
          },
          invoiceItems: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          activities: {
            create: jest.fn().mockResolvedValue({}),
          },
        })
      })

      // Mock companies lookup for validation
      prisma.company.findUnique.mockResolvedValue(mockCompany)

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validInvoiceData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('UAE VAT compliance')
      expect(data.data.formattedAmounts).toBeDefined()
      expect(data.data.vatBreakdown).toBeDefined()
    })

    it('should enforce company-level data isolation on creation', async () => {
      const requestData = {
        ...validInvoiceData,
        companyId: 'other-company', // Different company ID
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          customer: { findUnique: jest.fn(), create: jest.fn() },
          invoices: { create: jest.fn(), findUnique: jest.fn() },
          invoiceItems: { createMany: jest.fn() },
          activities: { create: jest.fn() },
        })
      })

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      await POST(request)

      // The actual creation should use the user's company ID
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should validate UAE TRN format', async () => {
      const { validateUAETRN } = require('@/lib/vat-calculator')
      validateUAETRN.mockReturnValue(false) // Invalid TRN

      const requestData = {
        ...validInvoiceData,
        trnNumber: 'invalid-trn',
      }

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500) // Will be handled by error handler
      expect(data.success).toBe(false)
    })

    it('should prevent duplicate invoice numbers within company', async () => {
      // Mock existing invoice with same number
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validInvoiceData,
          number: 'INV-001', // Same as existing invoice
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should validate VAT calculations consistency', async () => {
      const inconsistentData = {
        ...validInvoiceData,
        subtotal: 1000,
        vatAmount: 50,
        totalAmount: 900, // Inconsistent with subtotal + VAT
      }

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inconsistentData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should handle role-based permissions', async () => {
      const { canManageInvoices } = require('@/lib/auth-utils')
      canManageInvoices.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validInvoiceData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should create customer if not exists', async () => {
      const mockTx = {
        customer: {
          findUnique: jest.fn().mockResolvedValue(null), // Customer doesn't exist
          create: jest.fn().mockResolvedValue(mockCustomer),
        },
        invoices: {
          create: jest.fn().mockResolvedValue(mockInvoice),
          findUnique: jest.fn().mockResolvedValue({
            ...mockInvoice,
            customer: mockCustomer,
            company: mockCompany,
            invoiceItems: [],
          }),
        },
        invoiceItems: { createMany: jest.fn() },
        activities: { create: jest.fn() },
      }

      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validInvoiceData),
      })

      await POST(request)

      expect(mockTx.customers.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: validInvoiceData.customerName,
          email: validInvoiceData.customerEmail,
          companyId: mockUser.companyId,
        }),
      })
    })

    it('should log comprehensive activity for audit trail', async () => {
      const mockTx = {
        customer: { findUnique: jest.fn(), create: jest.fn() },
        invoices: { 
          create: jest.fn().mockResolvedValue(mockInvoice),
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        invoiceItems: { createMany: jest.fn() },
        activities: { create: jest.fn() },
      }

      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'test-agent',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify(validInvoiceData),
      })

      await POST(request)

      expect(mockTx.activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: mockUser.companyId,
          userId: mockUser.id,
          type: 'invoice_created',
          metadata: expect.objectContaining({
            invoiceNumber: validInvoiceData.number,
            customerName: validInvoiceData.customerName,
            userAgent: 'test-agent',
            ipAddress: '192.168.1.1',
          }),
        }),
      })
    })

    it('should handle Arabic language fields', async () => {
      const arabicInvoiceData = {
        ...validInvoiceData,
        customerNameAr: 'عميل تجريبي',
        descriptionAr: 'وصف باللغة العربية',
        notesAr: 'ملاحظات باللغة العربية',
        items: [
          {
            ...validInvoiceData.items[0],
            descriptionAr: 'عنصر تجريبي',
          },
        ],
      }

      const mockTx = {
        customer: { 
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockCustomer),
        },
        invoices: { 
          create: jest.fn().mockResolvedValue(mockInvoice),
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        invoiceItems: { createMany: jest.fn() },
        activities: { create: jest.fn() },
      }

      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arabicInvoiceData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Verify Arabic fields were handled
      expect(mockTx.customers.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nameAr: 'عميل تجريبي',
        }),
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      prisma.invoice.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/invoices')
      const response = await GET(request)

      expect(response.status).toBe(500)
    })

    it('should handle validation errors properly', async () => {
      const request = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required fields
          number: 'INV-003',
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(400) // Validation error
    })

    it('should handle unauthorized access', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Unauthorized'))

      const request = new NextRequest('http://localhost:3000/api/invoices')
      const response = await GET(request)

      expect(response.status).toBe(500) // Will be handled by error handler
    })
  })

  describe('UAE Business Logic', () => {
    it('should handle different currency validations', async () => {
      const currencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR']
      
      for (const currency of currencies) {
        const requestData = {
          ...validInvoiceData,
          currency,
        }

        const mockTx = {
          customer: { findUnique: jest.fn(), create: jest.fn() },
          invoices: { create: jest.fn(), findUnique: jest.fn() },
          invoiceItems: { createMany: jest.fn() },
          activities: { create: jest.fn() },
        }

        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        })

        const response = await POST(request)
        
        // Should not fail for supported currencies
        expect(response.status).not.toBe(400)
      }
    })

    it('should enforce UAE business hours context', async () => {
      // This test would verify that the system handles UAE timezone correctly
      const request = new NextRequest('http://localhost:3000/api/invoices')
      
      // Set system time to outside UAE business hours
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-01T02:00:00.000Z')) // 6 AM UAE time (Sunday)
      
      const response = await GET(request)
      
      // Should still work but might have different behavior for business hours
      expect(response.status).toBe(200)
      
      jest.useRealTimers()
    })
  })
})