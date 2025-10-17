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

describe('/api/invoices/buckets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/invoices/buckets', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Unauthorized')
    })

    it('should return bucket data for authenticated user', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      // Mock invoice data
      const mockInvoices = [
        {
          id: 'invoice-1',
          number: 'INV-001',
          amount: 1000,
          currency: 'AED',
          dueDate: new Date('2024-01-01'),
          status: 'SENT',
          customer: {
            id: 'customer-1',
            name: 'Customer 1',
            email: 'customer1@test.com'
          },
          followUpLogs: []
        },
        {
          id: 'invoice-2',
          number: 'INV-002',
          amount: 2000,
          currency: 'AED',
          dueDate: new Date('2024-01-15'),
          status: 'SENT',
          customer: {
            id: 'customer-2',
            name: 'Customer 2',
            email: 'customer2@test.com'
          },
          followUpLogs: []
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('buckets')
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('lastUpdated')

      // Verify buckets structure
      expect(data.buckets).toBeInstanceOf(Array)
      expect(data.buckets).toHaveLength(6) // 6 time-based buckets

      // Verify each bucket has required properties
      data.buckets.forEach((bucket: any) => {
        expect(bucket).toHaveProperty('id')
        expect(bucket).toHaveProperty('label')
        expect(bucket).toHaveProperty('count')
        expect(bucket).toHaveProperty('totalAmount')
        expect(bucket).toHaveProperty('priority')
        expect(bucket).toHaveProperty('color')
        expect(bucket).toHaveProperty('eligibleForReminder')
        expect(bucket).toHaveProperty('needsReview')
        expect(bucket).toHaveProperty('sampleInvoices')
      })

      // Verify summary structure
      expect(data.summary).toHaveProperty('totalInvoices')
      expect(data.summary).toHaveProperty('totalAmount')
      expect(data.summary).toHaveProperty('overdueCount')
      expect(data.summary).toHaveProperty('overdueAmount')
      expect(data.summary).toHaveProperty('eligibleForReminder')
    })

    it('should calculate days overdue correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const today = new Date()
      const threeDaysAgo = new Date(today)
      threeDaysAgo.setDate(today.getDate() - 3)

      const mockOverdueInvoice = {
        id: 'invoice-overdue',
        number: 'INV-OVERDUE',
        amount: 500,
        currency: 'AED',
        dueDate: threeDaysAgo,
        status: 'SENT',
        customer: {
          id: 'customer-1',
          name: 'Customer 1',
          email: 'customer1@test.com'
        },
        followUpLogs: []
      }

      mockPrisma.invoice.findMany.mockResolvedValue([mockOverdueInvoice] as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Find the 1-3 days bucket
      const bucket1to3 = data.buckets.find((b: any) => b.id === 'bucket-1-3-days')
      expect(bucket1to3).toBeDefined()
      expect(bucket1to3.count).toBe(1)
      expect(bucket1to3.totalAmount).toBe(500)
    })

    it('should categorize invoices into correct buckets', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const today = new Date()

      // Create invoices for different time periods
      const mockInvoices = [
        // Not due yet (future date)
        {
          id: 'invoice-future',
          dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days future
          status: 'SENT',
          amount: 100,
          currency: 'AED',
          number: 'INV-FUTURE',
          customer: { id: 'c1', name: 'Customer 1', email: 'c1@test.com' },
          followUpLogs: []
        },
        // 2 days overdue
        {
          id: 'invoice-2days',
          dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          amount: 200,
          currency: 'AED',
          number: 'INV-2DAYS',
          customer: { id: 'c2', name: 'Customer 2', email: 'c2@test.com' },
          followUpLogs: []
        },
        // 6 days overdue
        {
          id: 'invoice-6days',
          dueDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          amount: 300,
          currency: 'AED',
          number: 'INV-6DAYS',
          customer: { id: 'c3', name: 'Customer 3', email: 'c3@test.com' },
          followUpLogs: []
        },
        // 45 days overdue
        {
          id: 'invoice-45days',
          dueDate: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          amount: 400,
          currency: 'AED',
          number: 'INV-45DAYS',
          customer: { id: 'c4', name: 'Customer 4', email: 'c4@test.com' },
          followUpLogs: []
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Check bucket categorization
      const notDueBucket = data.buckets.find((b: any) => b.id === 'bucket-not-due')
      expect(notDueBucket.count).toBe(1)
      expect(notDueBucket.totalAmount).toBe(100)

      const bucket1to3 = data.buckets.find((b: any) => b.id === 'bucket-1-3-days')
      expect(bucket1to3.count).toBe(1)
      expect(bucket1to3.totalAmount).toBe(200)

      const bucket4to7 = data.buckets.find((b: any) => b.id === 'bucket-4-7-days')
      expect(bucket4to7.count).toBe(1)
      expect(bucket4to7.totalAmount).toBe(300)

      const bucket30plus = data.buckets.find((b: any) => b.id === 'bucket-30-plus-days')
      expect(bucket30plus.count).toBe(1)
      expect(bucket30plus.totalAmount).toBe(400)
    })

    it('should calculate summary statistics correctly', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const today = new Date()
      const overdueDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)

      const mockInvoices = [
        {
          id: 'invoice-1',
          dueDate: overdueDate,
          status: 'SENT',
          amount: 1000,
          currency: 'AED',
          number: 'INV-001',
          customer: { id: 'c1', name: 'Customer 1', email: 'c1@test.com' },
          followUpLogs: []
        },
        {
          id: 'invoice-2',
          dueDate: overdueDate,
          status: 'SENT',
          amount: 2000,
          currency: 'AED',
          number: 'INV-002',
          customer: { id: 'c2', name: 'Customer 2', email: 'c2@test.com' },
          followUpLogs: []
        }
      ]

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.summary.totalInvoices).toBe(2)
      expect(data.summary.totalAmount).toBe(3000)
      expect(data.summary.overdueCount).toBe(2)
      expect(data.summary.overdueAmount).toBe(3000)
    })

    it('should handle high-value invoice detection', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)

      const mockHighValueInvoice = {
        id: 'invoice-high-value',
        amount: 15000, // Above 10k threshold
        currency: 'AED',
        dueDate: new Date(),
        status: 'SENT',
        number: 'INV-HIGH',
        customer: { id: 'c1', name: 'Customer 1', email: 'c1@test.com' },
        followUpLogs: []
      }

      mockPrisma.invoice.findMany.mockResolvedValue([mockHighValueInvoice] as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      const bucket = data.buckets.find((b: any) => b.count > 0)
      expect(bucket.needsReview).toBe(1) // High value invoice needs review
    })

    it('should handle database errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)
      mockPrisma.invoice.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.message).toBe('Internal server error')
    })

    it('should respect company data isolation', async () => {
      mockGetServerSession.mockResolvedValue(mockSession as any)
      mockPrisma.invoice.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      await GET(request)

      // Verify that Prisma was called with company filter
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          status: {
            in: ['SENT', 'OVERDUE', 'DISPUTED']
          }
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          followUpLogs: {
            where: {
              emailSent: true
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        },
        orderBy: {
          dueDate: 'asc'
        }
      })
    })
  })
})