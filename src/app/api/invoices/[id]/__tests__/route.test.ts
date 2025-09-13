/**
 * Test Suite for Individual Invoice API Endpoints
 * Tests CRUD operations, UAE business validation, and security
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals')
const { NextRequest } = require('next/server')
const { GET, PUT, DELETE } = require('../route')
const { prisma } = require('@/lib/prisma')
const { InvoiceStatus, UserRole } = require('@prisma/client')

// Mock dependencies
jest.mock('@/lib/prisma')
jest.mock('@/lib/auth-utils')
jest.mock('@/lib/vat-calculator')

// Test data setup
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
  customers: {
    id: 'customer-1',
    name: 'Test Customer',
    email: 'customer@example.ae',
    phone: '+971501234567',
  },
  companies: mockCompany,
  invoiceItems: [
    {
      id: 'item-1',
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
  payments: [],
  followUpLogs: [],
  emailLogs: [],
}

describe('Individual Invoice API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup auth mocks
    const { requireRole, canManageInvoices } = require('@/lib/auth-utils')
    requireRole.mockResolvedValue(mockAuthContext)
    canManageInvoices.mockReturnValue(true)
    
    // Setup VAT calculator mocks
    const { formatUAECurrency, validateUAETRN, calculateInvoiceVAT } = require('@/lib/vat-calculator')
    formatUAECurrency.mockReturnValue('AED 1,000.00')
    validateUAETRN.mockReturnValue(true)
    calculateInvoiceVAT.mockReturnValue({
      subtotal: { toNumber: () => 952.38 },
      totalVatAmount: { toNumber: () => 47.62 },
      grandTotal: { toNumber: () => 1000 },
      lineItems: [],
      vatBreakdown: {},
    })
  })

  describe('GET /api/invoices/[id]', () => {
    it('should return invoice with comprehensive UAE business data', async () => {
      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1')
      const response = await GET(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('invoice-1')
      expect(data.data.formattedAmounts).toBeDefined()
      expect(data.data.paidAmount).toBe(0)
      expect(data.data.remainingAmount).toBe(1000)
      expect(data.data.isOverdue).toBe(false)
      expect(data.data.paymentStatus).toBe('UNPAID')
      expect(data.data.vatSummary).toBeDefined()
    })

    it('should enforce company-level data isolation', async () => {
      const invoiceFromOtherCompany = {
        ...mockInvoice,
        companyId: 'other-company',
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceFromOtherCompany)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1')
      const response = await GET(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should return 404 for non-existent invoice', async () => {
      prisma.invoices.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/invoices/non-existent')
      const response = await GET(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should calculate overdue status correctly', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        dueDate: new Date('2023-12-01'), // Past due
        status: InvoiceStatus.SENT,
      }
      
      prisma.invoices.findUnique.mockResolvedValue(overdueInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1')
      const response = await GET(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(data.data.isOverdue).toBe(true)
      expect(data.data.daysPastDue).toBeGreaterThan(0)
    })

    it('should handle invoices with payments correctly', async () => {
      const invoiceWithPayments = {
        ...mockInvoice,
        payments: [
          { id: 'payment-1', amount: 500, paymentDate: new Date('2024-01-10') },
          { id: 'payment-2', amount: 200, paymentDate: new Date('2024-01-11') },
        ],
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceWithPayments)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1')
      const response = await GET(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(data.data.paidAmount).toBe(700)
      expect(data.data.remainingAmount).toBe(300)
      expect(data.data.paymentStatus).toBe('PARTIALLY_PAID')
      expect(data.data.isFullyPaid).toBe(false)
    })
  })

  describe('PUT /api/invoices/[id]', () => {
    const updateData = {
      customerName: 'Updated Customer',
      customerNameAr: 'عميل محدث',
      amount: 1200,
      notes: 'Updated notes',
      notesAr: 'ملاحظات محدثة',
    }

    it('should update invoice with UAE business validation', async () => {
      const updatedInvoice = { ...mockInvoice, ...updateData }
      
      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)
      
      const mockTx = {
        customers: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        invoices: {
          update: jest.fn().mockResolvedValue(updatedInvoice),
        },
        invoiceItems: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        activities: {
          create: jest.fn(),
        },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('UAE VAT compliance')
      expect(data.data.formattedAmounts).toBeDefined()
    })

    it('should enforce company-level data isolation', async () => {
      const invoiceFromOtherCompany = {
        ...mockInvoice,
        companyId: 'other-company',
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceFromOtherCompany)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should validate UAE business rules for paid invoices', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      }
      
      prisma.invoices.findUnique.mockResolvedValue(paidInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1500 }), // Try to change financial data
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('paid invoices')
    })

    it('should prevent updates to financial data when payments exist', async () => {
      const invoiceWithPayments = {
        ...mockInvoice,
        payments: [{ id: 'payment-1', amount: 500 }],
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceWithPayments)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1500, items: [] }),
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('UAE audit compliance')
    })

    it('should validate TRN format when updating', async () => {
      const { validateUAETRN } = require('@/lib/vat-calculator')
      validateUAETRN.mockReturnValue(false)

      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trnNumber: 'invalid-trn' }),
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should handle invoice number uniqueness validation', async () => {
      prisma.invoices.findUnique
        .mockResolvedValueOnce(mockInvoice) // First call - original invoice
        .mockResolvedValueOnce({ // Second call - duplicate check
          id: 'other-invoice',
          number: 'INV-002',
          companyId: 'company-1',
        })

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: 'INV-002' }), // Existing number
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('already exists')
    })

    it('should update invoice items when provided', async () => {
      const updateWithItems = {
        ...updateData,
        items: [
          {
            description: 'New Item',
            quantity: 2,
            unitPrice: 600,
            total: 1200,
            vatRate: 5,
            vatAmount: 60,
            totalWithVat: 1260,
            taxCategory: 'STANDARD',
          },
        ],
      }

      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)
      
      const mockTx = {
        customers: { upsert: jest.fn() },
        invoices: { update: jest.fn().mockResolvedValue(mockInvoice) },
        invoiceItems: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        activities: { create: jest.fn() },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateWithItems),
      })

      await PUT(request, { params: { id: 'invoice-1' } })

      expect(mockTx.invoiceItems.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'invoice-1' },
      })
      expect(mockTx.invoiceItems.createMany).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/invoices/[id]', () => {
    it('should delete eligible invoice with comprehensive audit trail', async () => {
      const draftInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.DRAFT,
        createdAt: new Date(), // Recent invoice
        payments: [],
        followUpLogs: [],
        emailLogs: [],
      }
      
      prisma.invoices.findUnique.mockResolvedValue(draftInvoice)
      
      const mockTx = {
        invoiceItems: { deleteMany: jest.fn() },
        invoices: { delete: jest.fn() },
        activities: { create: jest.fn() },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
        headers: { 
          'User-Agent': 'test-agent',
          'x-forwarded-for': '192.168.1.1',
        },
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('UAE regulations')
      expect(data.data.deletedInvoice).toBeDefined()
      
      // Verify audit trail
      expect(mockTx.activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'invoice_deleted',
          metadata: expect.objectContaining({
            complianceNote: expect.stringContaining('UAE'),
            userAgent: 'test-agent',
            ipAddress: '192.168.1.1',
          }),
        }),
      })
    })

    it('should prevent deletion of sent invoices', async () => {
      const sentInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
      }
      
      prisma.invoices.findUnique.mockResolvedValue(sentInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Only draft invoices')
    })

    it('should prevent deletion of invoices with payments', async () => {
      const invoiceWithPayments = {
        ...mockInvoice,
        payments: [{ id: 'payment-1', amount: 500 }],
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceWithPayments)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('UAE tax regulations')
    })

    it('should prevent deletion of old invoices', async () => {
      const oldInvoice = {
        ...mockInvoice,
        createdAt: new Date('2023-01-01'), // Over 90 days old
      }
      
      prisma.invoices.findUnique.mockResolvedValue(oldInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('90 days')
    })

    it('should prevent deletion of invoices with follow-up history', async () => {
      const invoiceWithFollowUps = {
        ...mockInvoice,
        followUpLogs: [{ id: 'log-1', sentAt: new Date() }],
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceWithFollowUps)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('audit trail')
    })

    it('should prevent deletion of VAT invoices with TRN', async () => {
      const vatInvoice = {
        ...mockInvoice,
        trnNumber: '123456789012345',
        vatAmount: 47.62,
      }
      
      prisma.invoices.findUnique.mockResolvedValue(vatInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('UAE tax regulations')
    })

    it('should enforce company-level data isolation', async () => {
      const invoiceFromOtherCompany = {
        ...mockInvoice,
        companyId: 'other-company',
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceFromOtherCompany)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  describe('Role-Based Access Control', () => {
    it('should allow ADMIN and FINANCE roles to manage invoices', async () => {
      const roles = [UserRole.ADMIN, UserRole.FINANCE]
      
      for (const role of roles) {
        const { requireRole, canManageInvoices } = require('@/lib/auth-utils')
        requireRole.mockResolvedValue({
          ...mockAuthContext,
          user: { ...mockUser, role },
        })
        canManageInvoices.mockReturnValue(true)
        
        prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

        const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1')
        const response = await GET(request, { params: { id: 'invoice-1' } })

        expect(response.status).toBe(200)
      }
    })

    it('should allow VIEWER role to read invoices', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockResolvedValue({
        ...mockAuthContext,
        user: { ...mockUser, role: UserRole.VIEWER },
      })
      
      prisma.invoices.findUnique.mockResolvedValue(mockInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1')
      const response = await GET(request, { params: { id: 'invoice-1' } })

      expect(response.status).toBe(200)
    })

    it('should prevent VIEWER role from updating invoices', async () => {
      const { requireRole, canManageInvoices } = require('@/lib/auth-utils')
      requireRole.mockResolvedValue({
        ...mockAuthContext,
        user: { ...mockUser, role: UserRole.VIEWER },
      })
      canManageInvoices.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Updated' }),
      })

      const response = await PUT(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })
})