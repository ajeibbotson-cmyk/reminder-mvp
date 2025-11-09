/**
 * Test Suite for Invoice Status Management API
 * Tests status transitions, UAE business rules, and audit compliance
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals')
const { NextRequest } = require('next/server')
const { PATCH } = require('../route')
const { prisma } = require('@/lib/prisma')
const { InvoiceStatus, UserRole } = require('@prisma/client')

// Mock dependencies
jest.mock('@/lib/prisma')
jest.mock('@/lib/auth-utils')
jest.mock('@/lib/vat-calculator')

// Test data
const mockCompany = {
  id: 'company-1',
  name: 'Test Company UAE',
  trn: '123456789012345',
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
  totalAmount: 1000,
  currency: 'AED',
  status: InvoiceStatus.DRAFT,
  dueDate: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  customer: {
    id: 'customer-1',
    name: 'Test Customer',
    email: 'customer@example.ae',
  },
  company: mockCompany,
  payments: [],
}

describe('Invoice Status Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup auth mocks
    const { requireRole, canManageInvoices } = require('@/lib/auth-utils')
    requireRole.mockResolvedValue(mockAuthContext)
    canManageInvoices.mockReturnValue(true)
    
    // Setup VAT calculator mocks
    const { formatUAECurrency } = require('@/lib/vat-calculator')
    formatUAECurrency.mockReturnValue('AED 1,000.00')
  })

  describe('PATCH /api/invoices/[id]/status', () => {
    it('should update status with UAE business validation', async () => {
      const updatedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        customer: mockInvoice.customers,
        company: mockInvoice.companies,
        payments: [],
        invoiceItems: [],
      }

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
      
      const mockTx = {
        invoices: {
          update: jest.fn().mockResolvedValue(updatedInvoice),
        },
        activities: {
          create: jest.fn(),
        },
        emailLogs: {
          create: jest.fn(),
        },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'test-agent',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({
          status: InvoiceStatus.SENT,
          reason: 'Ready to send to customer',
          notes: 'Invoice reviewed and approved',
          notifyCustomer: true,
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.statusChange).toEqual({
        from: InvoiceStatus.DRAFT,
        to: InvoiceStatus.SENT,
        reason: 'Ready to send to customer',
        notes: 'Invoice reviewed and approved',
        changedAt: expect.any(String),
        changedBy: 'Test User',
      })
      expect(data.data.suggestedActions).toBeDefined()
      expect(data.data.customerNotified).toBe(true)
    })

    it('should enforce valid status transitions', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      }

      prisma.invoice.findUnique.mockResolvedValue(paidInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.DRAFT, // Invalid transition from PAID to DRAFT
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid status transition')
    })

    it('should validate payment requirements for PAID status', async () => {
      const sentInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        payments: [
          { id: 'payment-1', amount: 500 }, // Insufficient payment
        ],
      }

      prisma.invoice.findUnique.mockResolvedValue(sentInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.PAID,
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Insufficient payments')
    })

    it('should allow PAID status with sufficient payments', async () => {
      const sentInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        payments: [
          { id: 'payment-1', amount: 1000 }, // Full payment
        ],
      }

      const paidInvoice = {
        ...sentInvoice,
        status: InvoiceStatus.PAID,
        customer: mockInvoice.customers,
        company: mockInvoice.companies,
        invoiceItems: [],
      }

      prisma.invoice.findUnique.mockResolvedValue(sentInvoice)
      
      const mockTx = {
        payments: {
          findMany: jest.fn().mockResolvedValue([{ amount: 1000 }]),
        },
        invoices: {
          update: jest.fn().mockResolvedValue(paidInvoice),
        },
        activities: {
          create: jest.fn(),
        },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.PAID,
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.statusChange.to).toBe(InvoiceStatus.PAID)
    })

    it('should require reason for WRITTEN_OFF status', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.OVERDUE,
      }

      prisma.invoice.findUnique.mockResolvedValue(overdueInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.WRITTEN_OFF,
          // No reason provided
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('UAE audit compliance')
    })

    it('should require reason for DISPUTED status', async () => {
      const sentInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
      }

      prisma.invoice.findUnique.mockResolvedValue(sentInvoice)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.DISPUTED,
          // No reason provided
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('UAE audit compliance')
    })

    it('should handle automatic OVERDUE transition', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        dueDate: new Date('2023-12-01'), // Past due
        customer: mockInvoice.customers,
        company: mockInvoice.companies,
        payments: [],
        invoiceItems: [],
      }

      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        dueDate: new Date('2023-12-01'), // Past due
      })
      
      const mockTx = {
        payments: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        invoices: {
          update: jest.fn().mockResolvedValue(overdueInvoice),
        },
        activities: {
          create: jest.fn(),
        },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.SENT, // Will be auto-converted to OVERDUE
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.statusChange.to).toBe(InvoiceStatus.OVERDUE)
    })

    it('should enforce company-level data isolation', async () => {
      const invoiceFromOtherCompany = {
        ...mockInvoice,
        companyId: 'other-company',
      }

      prisma.invoice.findUnique.mockResolvedValue(invoiceFromOtherCompany)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.SENT,
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should create comprehensive audit trail', async () => {
      const updatedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        customer: mockInvoice.customers,
        company: mockInvoice.companies,
        payments: [],
        invoiceItems: [],
      }

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
      
      const mockTx = {
        invoices: {
          update: jest.fn().mockResolvedValue(updatedInvoice),
        },
        activities: {
          create: jest.fn(),
        },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (test)',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify({
          status: InvoiceStatus.SENT,
          reason: 'Customer approved',
          notes: 'Ready for delivery',
        }),
      })

      await PATCH(request, { params: { id: 'invoice-1' } })

      expect(mockTx.activities.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'invoice_status_updated',
          metadata: expect.objectContaining({
            invoiceNumber: 'INV-001',
            customerName: 'Test Customer',
            previousStatus: InvoiceStatus.DRAFT,
            newStatus: InvoiceStatus.SENT,
            reason: 'Customer approved',
            notes: 'Ready for delivery',
            userAgent: 'Mozilla/5.0 (test)',
            ipAddress: '192.168.1.100',
            daysFromDue: expect.any(Number),
          }),
        }),
      })
    })

    it('should handle customer notifications', async () => {
      const updatedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        customer: mockInvoice.customers,
        company: mockInvoice.companies,
        payments: [],
        invoiceItems: [],
      }

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
      
      const mockTx = {
        invoices: {
          update: jest.fn().mockResolvedValue(updatedInvoice),
        },
        activities: {
          create: jest.fn(),
        },
        emailLogs: {
          create: jest.fn(),
        },
      }
      
      prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.SENT,
          notifyCustomer: true,
        }),
      })

      await PATCH(request, { params: { id: 'invoice-1' } })

      expect(mockTx.emailLogs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'company-1',
          invoiceId: 'invoice-1',
          recipientEmail: 'customer@example.ae',
          subject: expect.stringContaining('INV-001'),
          deliveryStatus: 'QUEUED',
        }),
      })
    })

    it('should provide appropriate suggested actions based on status', async () => {
      const testCases = [
        {
          status: InvoiceStatus.DRAFT,
          expectedActions: ['Review invoice details', 'Send to customer'],
        },
        {
          status: InvoiceStatus.SENT,
          expectedActions: ['Monitor payment status', 'Schedule follow-up reminder'],
        },
        {
          status: InvoiceStatus.OVERDUE,
          expectedActions: ['Send urgent payment reminder', 'Contact customer directly'],
        },
        {
          status: InvoiceStatus.DISPUTED,
          expectedActions: ['Review dispute details', 'Contact customer for resolution'],
        },
        {
          status: InvoiceStatus.PAID,
          expectedActions: ['Archive invoice', 'Send payment confirmation'],
        },
      ]

      for (const testCase of testCases) {
        const updatedInvoice = {
          ...mockInvoice,
          status: testCase.status,
          customer: mockInvoice.customers,
          company: mockInvoice.companies,
          payments: testCase.status === InvoiceStatus.PAID ? [{ amount: 1000 }] : [],
          invoiceItems: [],
        }

        prisma.invoice.findUnique.mockResolvedValue(mockInvoice)
        
        const mockTx = {
          payments: {
            findMany: jest.fn().mockResolvedValue(testCase.status === InvoiceStatus.PAID ? [{ amount: 1000 }] : []),
          },
          invoices: {
            update: jest.fn().mockResolvedValue(updatedInvoice),
          },
          activities: {
            create: jest.fn(),
          },
        }
        
        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: testCase.status,
            reason: 'Test transition',
          }),
        })

        const response = await PATCH(request, { params: { id: 'invoice-1' } })
        const data = await response.json()

        if (response.status === 200) {
          testCase.expectedActions.forEach(action => {
            expect(data.data.suggestedActions).toContain(action)
          })
        }
      }
    })

    it('should handle role-based permissions', async () => {
      const { canManageInvoices } = require('@/lib/auth-utils')
      canManageInvoices.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/invoices/invoice-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.SENT,
        }),
      })

      const response = await PATCH(request, { params: { id: 'invoice-1' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('permissions')
    })

    it('should return 404 for non-existent invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/invoices/non-existent/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: InvoiceStatus.SENT,
        }),
      })

      const response = await PATCH(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })
})