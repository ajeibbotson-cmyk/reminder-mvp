import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

// Mock dependencies
jest.mock('next-auth')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    invoice: {
      findMany: jest.fn(),
      count: jest.fn(),
    }
  }
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

const mockSession = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    companyId: 'company-1',
    company: {
      id: 'company-1',
      name: 'Test Company'
    }
  }
}

const mockContext = {
  params: { bucketId: 'bucket-1-3-days' }
}

describe('/api/invoices/buckets/[bucketId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/invoices/buckets/[bucketId]', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days')
      const response = await GET(request, mockContext)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Unauthorized')
    })

    it('should return 400 for invalid bucket ID', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const invalidContext = { params: { bucketId: 'invalid-bucket' } }
      const request = new NextRequest('http://localhost/api/invoices/buckets/invalid-bucket')
      const response = await GET(request, invalidContext)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.message).toBe('Invalid bucket ID')
    })

    it('should return detailed invoice data for valid bucket', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const today = new Date()
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)

      const mockInvoices = [
        {
          id: 'invoice-1',
          number: 'INV-001',
          amount: 1500,
          currency: 'AED',
          dueDate: twoDaysAgo,
          status: 'SENT',
          customer: {
            id: 'customer-1',
            name: 'ABC Trading LLC',
            email: 'accounts@abctrading.ae'
          },
          followUpLogs: [
            {
              id: 'log-1',
              createdAt: new Date(today.getTime() - 24 * 60 * 60 * 1000),
              emailSent: true
            }
          ]
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days')
      const response = await GET(request, mockContext)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('invoices')
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('pagination')

      // Verify invoice data structure
      expect(data.invoices).toHaveLength(1)
      const invoice = data.invoices[0]
      expect(invoice).toHaveProperty('id')
      expect(invoice).toHaveProperty('number')
      expect(invoice).toHaveProperty('customerName')
      expect(invoice).toHaveProperty('customerEmail')
      expect(invoice).toHaveProperty('amount')
      expect(invoice).toHaveProperty('currency')
      expect(invoice).toHaveProperty('dueDate')
      expect(invoice).toHaveProperty('daysOverdue')
      expect(invoice).toHaveProperty('canSendReminder')
      expect(invoice).toHaveProperty('needsUrgentAttention')
      expect(invoice).toHaveProperty('isHighValue')
      expect(invoice).toHaveProperty('suggestedActions')

      // Verify calculated fields
      expect(invoice.daysOverdue).toBe(2)
      expect(invoice.customerName).toBe('ABC Trading LLC')
      expect(invoice.customerEmail).toBe('accounts@abctrading.ae')

      // Verify stats
      expect(data.stats).toHaveProperty('totalInvoices')
      expect(data.stats).toHaveProperty('totalAmount')
      expect(data.stats).toHaveProperty('averageAmount')
      expect(data.stats).toHaveProperty('eligibleForReminder')
      expect(data.stats).toHaveProperty('needsUrgentAttention')
      expect(data.stats).toHaveProperty('highValueInvoices')
      expect(data.stats).toHaveProperty('averageDaysOverdue')
    })

    it('should handle pagination correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      // Mock 25 invoices for pagination testing
      const mockInvoices = Array.from({ length: 20 }, (_, i) => ({
        id: `invoice-${i + 1}`,
        number: `INV-${String(i + 1).padStart(3, '0')}`,
        amount: 1000 + i * 100,
        currency: 'AED',
        dueDate: new Date(),
        status: 'SENT',
        customer: {
          id: `customer-${i + 1}`,
          name: `Customer ${i + 1}`,
          email: `customer${i + 1}@test.com`
        },
        followUpLogs: []
      }))

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(25) // Total count

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days?page=1&limit=20')
      const response = await GET(request, mockContext)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.invoices).toHaveLength(20)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.totalCount).toBe(25)
      expect(data.pagination.totalPages).toBe(2)
      expect(data.pagination.hasNext).toBe(true)
      expect(data.pagination.hasPrev).toBe(false)
    })

    it('should handle search queries', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const mockInvoices = [
        {
          id: 'invoice-1',
          number: 'INV-001',
          amount: 1000,
          currency: 'AED',
          dueDate: new Date(),
          status: 'SENT',
          customer: {
            id: 'customer-1',
            name: 'ABC Trading LLC',
            email: 'abc@trading.ae'
          },
          followUpLogs: []
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days?search=ABC')
      const response = await GET(request, mockContext)

      expect(response.status).toBe(200)

      // Verify search filter was applied
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { customer: { name: { contains: 'ABC', mode: 'insensitive' } } },
              { customer: { email: { contains: 'ABC', mode: 'insensitive' } } },
              { number: { contains: 'ABC', mode: 'insensitive' } }
            ]
          })
        })
      )
    })

    it('should handle sorting correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days?sortBy=amount&sortOrder=desc')
      const response = await GET(request, mockContext)

      expect(response.status).toBe(200)

      // Verify sort was applied
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amount: 'desc' }
        })
      )
    })

    it('should calculate suggested actions correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const today = new Date()
      const mockInvoices = [
        // High value invoice (>10k AED)
        {
          id: 'invoice-high',
          number: 'INV-HIGH',
          amount: 15000,
          currency: 'AED',
          dueDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          customer: {
            id: 'customer-1',
            name: 'Big Customer LLC',
            email: 'big@customer.ae'
          },
          followUpLogs: []
        },
        // Regular invoice with recent follow-up
        {
          id: 'invoice-recent',
          number: 'INV-RECENT',
          amount: 2000,
          currency: 'AED',
          dueDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          customer: {
            id: 'customer-2',
            name: 'Regular Customer',
            email: 'regular@customer.ae'
          },
          followUpLogs: [
            {
              id: 'log-1',
              createdAt: new Date(today.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
              emailSent: true
            }
          ]
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(2)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-4-7-days')
      const response = await GET(request, { params: { bucketId: 'bucket-4-7-days' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      const highValueInvoice = data.invoices.find((inv: any) => inv.id === 'invoice-high')
      const recentFollowUpInvoice = data.invoices.find((inv: any) => inv.id === 'invoice-recent')

      // High value invoice should need urgent attention and personal follow-up
      expect(highValueInvoice.isHighValue).toBe(true)
      expect(highValueInvoice.needsUrgentAttention).toBe(true)
      expect(highValueInvoice.suggestedActions).toContain('personal_follow_up')

      // Recent follow-up invoice should not be eligible for immediate reminder
      expect(recentFollowUpInvoice.canSendReminder).toBe(false)
      expect(recentFollowUpInvoice.suggestedActions).toContain('wait_before_follow_up')
    })

    it('should handle different bucket types correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      // Test not due bucket
      const notDueRequest = new NextRequest('http://localhost/api/invoices/buckets/bucket-not-due')
      await GET(notDueRequest, { params: { bucketId: 'bucket-not-due' } })

      // Verify correct date filtering for not due bucket
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: { gt: expect.any(Date) } // Future date
          })
        })
      )

      jest.clearAllMocks()

      // Test 30+ days bucket
      const longOverdueRequest = new NextRequest('http://localhost/api/invoices/buckets/bucket-30-plus-days')
      await GET(longOverdueRequest, { params: { bucketId: 'bucket-30-plus-days' } })

      // Verify correct date filtering for 30+ days bucket
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: { lt: expect.any(Date) } // More than 30 days ago
          })
        })
      )
    })

    it('should calculate business metrics correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const mockInvoices = [
        {
          id: 'invoice-1',
          amount: 5000,
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
          status: 'SENT',
          number: 'INV-001',
          currency: 'AED',
          customer: { id: 'c1', name: 'Customer 1', email: 'c1@test.com' },
          followUpLogs: []
        },
        {
          id: 'invoice-2',
          amount: 15000, // High value
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
          status: 'SENT',
          number: 'INV-002',
          currency: 'AED',
          customer: { id: 'c2', name: 'Customer 2', email: 'c2@test.com' },
          followUpLogs: []
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(2)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-4-7-days')
      const response = await GET(request, { params: { bucketId: 'bucket-4-7-days' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.stats.totalInvoices).toBe(2)
      expect(data.stats.totalAmount).toBe(20000)
      expect(data.stats.averageAmount).toBe(10000)
      expect(data.stats.averageDaysOverdue).toBe(7.5) // (10 + 5) / 2
      expect(data.stats.highValueInvoices).toBe(1) // One invoice > 10k
      expect(data.stats.eligibleForReminder).toBe(2) // Both can receive reminders
    })

    it('should handle database errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)
      mockPrisma.invoice.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days')
      const response = await GET(request, mockContext)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.message).toBe('Internal server error')
    })

    it('should respect company data isolation', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days')
      await GET(request, mockContext)

      // Verify company filter is applied
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1'
          })
        })
      )
    })
  })
})