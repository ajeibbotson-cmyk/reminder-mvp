/**
 * Test Suite for Bulk Invoice Operations API
 * Tests bulk actions, UAE business compliance, and multi-tenancy
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals')
const { NextRequest } = require('next/server')
const { GET, POST } = require('../route')
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

const mockInvoices = [
  {
    id: 'invoice-1',
    companyId: 'company-1',
    number: 'INV-001',
    customerName: 'Customer 1',
    customerEmail: 'customer1@example.ae',
    amount: 1000,
    totalAmount: 1000,
    currency: 'AED',
    status: InvoiceStatus.DRAFT,
    dueDate: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    customer: {
      id: 'customer-1',
      name: 'Customer 1',
      email: 'customer1@example.ae',
    },
    payments: [],
    company: mockCompany,
  },
  {
    id: 'invoice-2',
    companyId: 'company-1',
    number: 'INV-002',
    customerName: 'Customer 2',
    customerEmail: 'customer2@example.ae',
    amount: 1500,
    totalAmount: 1500,
    currency: 'AED',
    status: InvoiceStatus.SENT,
    dueDate: new Date('2024-01-20'),
    createdAt: new Date('2024-01-02'),
    customer: {
      id: 'customer-2',
      name: 'Customer 2',
      email: 'customer2@example.ae',
    },
    payments: [],
    company: mockCompany,
  },
  {
    id: 'invoice-3',
    companyId: 'company-1',
    number: 'INV-003',
    customerName: 'Customer 3',
    customerEmail: 'customer3@example.ae',
    amount: 2000,
    totalAmount: 2000,
    currency: 'AED',
    status: InvoiceStatus.PAID,
    dueDate: new Date('2024-01-10'),
    createdAt: new Date('2023-12-15'),
    customer: {
      id: 'customer-3',
      name: 'Customer 3',
      email: 'customer3@example.ae',
    },
    payments: [{ id: 'payment-1', amount: 2000 }],
    company: mockCompany,
  },
]

describe('Bulk Invoice Operations API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup auth mocks
    const { requireRole, canManageInvoices } = require('@/lib/auth-utils')
    requireRole.mockResolvedValue(mockAuthContext)
    canManageInvoices.mockReturnValue(true)
    
    // Setup VAT calculator mocks
    const { formatUAECurrency } = require('@/lib/vat-calculator')
    formatUAECurrency.mockImplementation((amount) => `AED ${amount.toFixed(2)}`)
  })

  describe('GET /api/invoices/bulk', () => {
    it('should return bulk operation capabilities', async () => {
      const request = new NextRequest('http://localhost:3000/api/invoices/bulk')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.supportedActions).toHaveLength(4)
      expect(data.data.supportedActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'update_status',
            description: 'Update status for multiple invoices',
          }),
          expect.objectContaining({
            action: 'send_reminder',
            description: 'Send email reminders for multiple invoices',
          }),
          expect.objectContaining({
            action: 'delete',
            description: 'Delete multiple invoices',
          }),
          expect.objectContaining({
            action: 'export',
            description: 'Export multiple invoices to CSV/Excel',
          }),
        ])
      )
      expect(data.data.limits).toBeDefined()
      expect(data.data.statusTransitions).toBeDefined()
    })
  })

  describe('POST /api/invoices/bulk', () => {
    describe('Bulk Status Update', () => {
      it('should update status for multiple invoices with UAE validation', async () => {
        const eligibleInvoices = [mockInvoices[0], mockInvoices[1]] // DRAFT and SENT
        
        prisma.invoice.findMany.mockResolvedValue(eligibleInvoices)
        
        const mockTx = {
          invoices: {
            update: jest.fn()
              .mockResolvedValueOnce({ ...mockInvoices[0], status: InvoiceStatus.SENT })
              .mockResolvedValueOnce({ ...mockInvoices[1], status: InvoiceStatus.OVERDUE }),
          },
          activities: {
            create: jest.fn(),
          },
        }
        
        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'test-agent',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({
            invoiceIds: ['invoice-1', 'invoice-2'],
            action: 'update_status',
            status: InvoiceStatus.SENT,
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.successCount).toBe(2)
        expect(data.data.failedCount).toBe(0)
        expect(data.data.details).toHaveLength(2)
        
        // Verify audit trail
        const activityCalls = mockTx.activities.create.mock.calls
        expect(activityCalls).toHaveLength(3) // 2 individual + 1 bulk operation
        expect(activityCalls[2][0].data.type).toBe('bulk_invoice_operation')
      })

      it('should handle invalid status transitions', async () => {
        const invalidInvoices = [mockInvoices[2]] // PAID invoice
        
        prisma.invoice.findMany.mockResolvedValue(invalidInvoices)
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-3'],
            action: 'update_status',
            status: InvoiceStatus.DRAFT, // Invalid transition
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.successCount).toBe(0)
        expect(data.data.failedCount).toBe(1)
        expect(data.data.details[0].status).toBe('failed')
        expect(data.data.details[0].reason).toContain('transition')
      })

      it('should validate payment requirements for PAID status', async () => {
        const unpaidInvoice = [mockInvoices[1]] // SENT invoice with no payments
        
        prisma.invoice.findMany.mockResolvedValue(unpaidInvoice)
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-2'],
            action: 'update_status',
            status: InvoiceStatus.PAID,
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.failedCount).toBe(1)
        expect(data.data.details[0].reason).toContain('Insufficient payments')
      })
    })

    describe('Bulk Delete', () => {
      it('should delete eligible invoices with UAE compliance', async () => {
        const draftInvoices = [
          {
            ...mockInvoices[0],
            status: InvoiceStatus.DRAFT,
            createdAt: new Date(), // Recent invoice
            payments: [],
          },
        ]
        
        prisma.invoice.findMany.mockResolvedValue(draftInvoices)
        
        const mockTx = {
          activities: {
            create: jest.fn(),
          },
          invoiceItems: {
            deleteMany: jest.fn(),
          },
          payments: {
            deleteMany: jest.fn(),
          },
          emailLogs: {
            deleteMany: jest.fn(),
          },
          followUpLogs: {
            deleteMany: jest.fn(),
          },
          invoices: {
            delete: jest.fn(),
          },
        }
        
        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'delete',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.successCount).toBe(1)
        expect(data.data.failedCount).toBe(0)
        
        // Verify deletion audit trail
        expect(mockTx.activities.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            type: 'invoice_deleted',
            metadata: expect.objectContaining({
              bulkOperation: true,
              complianceNote: expect.stringContaining('UAE'),
            }),
          }),
        })
      })

      it('should prevent deletion of non-draft invoices', async () => {
        const nonDraftInvoices = [mockInvoices[1]] // SENT invoice
        
        prisma.invoice.findMany.mockResolvedValue(nonDraftInvoices)
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-2'],
            action: 'delete',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.successCount).toBe(0)
        expect(data.data.failedCount).toBe(1)
        expect(data.data.details[0].reason).toContain('UAE regulations')
      })

      it('should prevent deletion of invoices with payments', async () => {
        const invoiceWithPayments = [{
          ...mockInvoices[0],
          payments: [{ id: 'payment-1', amount: 500 }],
        }]
        
        prisma.invoice.findMany.mockResolvedValue(invoiceWithPayments)
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'delete',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data.data.failedCount).toBe(1)
        expect(data.data.details[0].reason).toContain('payments')
      })

      it('should prevent deletion of old invoices', async () => {
        const oldInvoice = [{
          ...mockInvoices[0],
          status: InvoiceStatus.DRAFT,
          createdAt: new Date('2023-01-01'), // Over 30 days old
          payments: [],
        }]
        
        prisma.invoice.findMany.mockResolvedValue(oldInvoice)
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'delete',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data.data.failedCount).toBe(1)
        expect(data.data.details[0].reason).toContain('30 days')
      })
    })

    describe('Bulk Send Reminder', () => {
      it('should queue reminder emails for eligible invoices', async () => {
        const eligibleInvoices = [mockInvoices[1]] // SENT invoice
        const mockEmailTemplate = {
          id: 'template-1',
          companyId: 'company-1',
          isActive: true,
          contentEn: 'Reminder for {{invoiceNumber}}',
        }
        
        prisma.invoice.findMany.mockResolvedValue(eligibleInvoices)
        
        const mockTx = {
          emailTemplates: {
            findFirst: jest.fn().mockResolvedValue(mockEmailTemplate),
          },
          emailLogs: {
            create: jest.fn().mockResolvedValue({ id: 'email-log-1' }),
          },
          activities: {
            create: jest.fn(),
          },
        }
        
        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-2'],
            action: 'send_reminder',
            emailTemplateId: 'template-1',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.successCount).toBe(1)
        expect(data.data.details[0].status).toBe('queued')
        
        // Verify email was queued for UAE business hours
        expect(mockTx.emailLogs.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            deliveryStatus: 'QUEUED',
            uaeSendTime: expect.any(Date),
          }),
        })
      })

      it('should skip ineligible invoices for reminders', async () => {
        const ineligibleInvoices = [mockInvoices[2]] // PAID invoice
        
        prisma.invoice.findMany.mockResolvedValue(ineligibleInvoices)
        
        const mockTx = {
          emailTemplates: {
            findFirst: jest.fn().mockResolvedValue({ id: 'template-1' }),
          },
          activities: {
            create: jest.fn(),
          },
        }
        
        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-3'],
            action: 'send_reminder',
            emailTemplateId: 'template-1',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data.data.successCount).toBe(0)
        expect(data.data.failedCount).toBe(1)
        expect(data.data.details[0].reason).toContain('PAID')
      })

      it('should validate email template access', async () => {
        prisma.invoice.findMany.mockResolvedValue([mockInvoices[1]])
        
        const mockTx = {
          emailTemplates: {
            findFirst: jest.fn().mockResolvedValue(null), // Template not found
          },
          activities: {
            create: jest.fn(),
          },
        }
        
        prisma.$transaction.mockImplementation(async (callback) => callback(mockTx))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-2'],
            action: 'send_reminder',
            emailTemplateId: 'invalid-template',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('not found')
      })
    })

    describe('Bulk Export', () => {
      it('should export invoice data with UAE business fields', async () => {
        const invoicesForExport = mockInvoices
        
        prisma.invoice.findMany
          .mockResolvedValueOnce(invoicesForExport) // Initial query
          .mockResolvedValueOnce(invoicesForExport.map(inv => ({ // Detailed query
            ...inv,
            invoiceItems: [
              {
                description: 'Test Item',
                quantity: 1,
                unitPrice: inv.amount,
                total: inv.amount,
              },
            ],
          })))
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1', 'invoice-2', 'invoice-3'],
            action: 'export',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.successCount).toBe(3)
        expect(data.data.failedCount).toBe(0)
        expect(data.data.format).toBe('json')
        expect(data.data.summary).toEqual({
          totalInvoices: 3,
          totalAmount: expect.any(Number),
          statusBreakdown: expect.any(Object),
          overdueCount: expect.any(Number),
          exportedAt: expect.any(String),
          exportedBy: 'Test User',
        })
      })
    })

    describe('Company-Level Data Isolation', () => {
      it('should enforce company isolation for bulk operations', async () => {
        const invoicesFromOtherCompany = [
          { ...mockInvoices[0], companyId: 'other-company' },
        ]
        
        prisma.invoice.findMany.mockResolvedValue(invoicesFromOtherCompany)

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'update_status',
            status: InvoiceStatus.SENT,
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('access denied')
      })

      it('should only query invoices from user company', async () => {
        prisma.invoice.findMany.mockResolvedValue([mockInvoices[0]])
        
        prisma.$transaction.mockImplementation(async (callback) => callback({
          invoices: { update: jest.fn() },
          activities: { create: jest.fn() },
        }))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'update_status',
            status: InvoiceStatus.SENT,
          }),
        })

        await POST(request)

        expect(prisma.invoice.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            companyId: 'company-1',
          }),
          include: expect.any(Object),
        })
      })
    })

    describe('Role-Based Access Control', () => {
      it('should require appropriate permissions', async () => {
        const { canManageInvoices } = require('@/lib/auth-utils')
        canManageInvoices.mockReturnValue(false)

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'delete',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('permissions')
      })
    })

    describe('Error Handling', () => {
      it('should handle missing invoice IDs', async () => {
        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_status',
            status: InvoiceStatus.SENT,
            // Missing invoiceIds
          }),
        })

        const response = await POST(request)

        expect(response.status).toBe(400) // Validation error
      })

      it('should handle unsupported actions', async () => {
        prisma.invoice.findMany.mockResolvedValue([mockInvoices[0]])

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'invalid_action',
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toContain('Unsupported')
      })

      it('should handle database errors gracefully', async () => {
        prisma.invoice.findMany.mockRejectedValue(new Error('Database error'))

        const request = new NextRequest('http://localhost:3000/api/invoices/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceIds: ['invoice-1'],
            action: 'export',
          }),
        })

        const response = await POST(request)

        expect(response.status).toBe(500)
      })
    })
  })
})