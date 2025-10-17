import { performance } from 'perf_hooks'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/invoices/buckets/route'
import { GET as getBucketDetails } from '@/app/api/invoices/buckets/[bucketId]/route'
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

// Helper function to generate mock invoice data
function generateMockInvoices(count: number) {
  const invoices = []
  const today = new Date()

  for (let i = 0; i < count; i++) {
    const daysOffset = Math.floor(Math.random() * 60) - 30 // -30 to +30 days
    const dueDate = new Date(today.getTime() + daysOffset * 24 * 60 * 60 * 1000)
    const amount = Math.floor(Math.random() * 50000) + 1000 // 1k to 51k

    invoices.push({
      id: `invoice-${i}`,
      number: `INV-${String(i + 1).padStart(4, '0')}`,
      amount,
      currency: 'AED',
      dueDate,
      status: 'SENT',
      customer: {
        id: `customer-${i % 100}`, // Simulate some customers with multiple invoices
        name: `Customer ${i % 100}`,
        email: `customer${i % 100}@test.com`
      },
      followUpLogs: Math.random() > 0.7 ? [
        {
          id: `log-${i}`,
          createdAt: new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          emailSent: true
        }
      ] : []
    })
  }

  return invoices
}

// Helper function to measure execution time
async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
  const startTime = performance.now()
  const result = await fn()
  const endTime = performance.now()
  return { result, executionTime: endTime - startTime }
}

describe('Bucket Calculations Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession as any)
  })

  describe('Bucket API Performance', () => {
    test('should handle 100 invoices within 500ms', async () => {
      const mockInvoices = generateMockInvoices(100)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await GET(request)
      })

      expect(result.status).toBe(200)
      expect(executionTime).toBeLessThan(500) // Should complete within 500ms

      const data = await result.json()
      expect(data.buckets).toHaveLength(6)
      expect(data.summary.totalInvoices).toBe(100)
    })

    test('should handle 1000 invoices within 2 seconds', async () => {
      const mockInvoices = generateMockInvoices(1000)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await GET(request)
      })

      expect(result.status).toBe(200)
      expect(executionTime).toBeLessThan(2000) // Should complete within 2 seconds

      const data = await result.json()
      expect(data.buckets).toHaveLength(6)
      expect(data.summary.totalInvoices).toBe(1000)
    })

    test('should handle 10000 invoices within 5 seconds', async () => {
      const mockInvoices = generateMockInvoices(10000)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await GET(request)
      })

      expect(result.status).toBe(200)
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds

      const data = await result.json()
      expect(data.buckets).toHaveLength(6)
      expect(data.summary.totalInvoices).toBe(10000)
    })

    test('should maintain consistent performance across multiple requests', async () => {
      const mockInvoices = generateMockInvoices(500)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const executionTimes: number[] = []
      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const request = new NextRequest('http://localhost/api/invoices/buckets')

        const { executionTime } = await measureExecutionTime(async () => {
          return await GET(request)
        })

        executionTimes.push(executionTime)
      }

      // Calculate statistics
      const average = executionTimes.reduce((sum, time) => sum + time, 0) / iterations
      const max = Math.max(...executionTimes)
      const min = Math.min(...executionTimes)
      const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / iterations
      const standardDeviation = Math.sqrt(variance)

      console.log(`Performance stats for ${iterations} iterations with 500 invoices:`)
      console.log(`Average: ${average.toFixed(2)}ms`)
      console.log(`Min: ${min.toFixed(2)}ms`)
      console.log(`Max: ${max.toFixed(2)}ms`)
      console.log(`Standard Deviation: ${standardDeviation.toFixed(2)}ms`)

      // Performance assertions
      expect(average).toBeLessThan(1000) // Average should be under 1 second
      expect(max).toBeLessThan(2000) // Max should be under 2 seconds
      expect(standardDeviation).toBeLessThan(500) // Low variance in performance
    })
  })

  describe('Bucket Detail API Performance', () => {
    test('should handle paginated bucket details efficiently', async () => {
      const mockInvoices = generateMockInvoices(50) // 50 invoices in one bucket
      const mockCount = 200 // Total count for pagination

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(mockCount)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days?page=1&limit=50')
      const context = { params: { bucketId: 'bucket-1-3-days' } }

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await getBucketDetails(request, context)
      })

      expect(result.status).toBe(200)
      expect(executionTime).toBeLessThan(300) // Should complete within 300ms

      const data = await result.json()
      expect(data.invoices).toHaveLength(50)
      expect(data.pagination.totalCount).toBe(200)
    })

    test('should handle search queries without significant performance impact', async () => {
      const mockInvoices = generateMockInvoices(20) // Filtered results
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(20)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days?search=ABC&sortBy=amount&sortOrder=desc')
      const context = { params: { bucketId: 'bucket-1-3-days' } }

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await getBucketDetails(request, context)
      })

      expect(result.status).toBe(200)
      expect(executionTime).toBeLessThan(400) // Should complete within 400ms even with search/sort

      const data = await result.json()
      expect(data.invoices).toHaveLength(20)
    })
  })

  describe('Memory Usage Tests', () => {
    test('should handle large datasets without memory leaks', async () => {
      const initialMemory = process.memoryUsage()

      // Process 5000 invoices multiple times
      for (let iteration = 0; iteration < 5; iteration++) {
        const mockInvoices = generateMockInvoices(5000)
        mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

        const request = new NextRequest('http://localhost/api/invoices/buckets')
        const response = await GET(request)

        expect(response.status).toBe(200)

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreaseKB = memoryIncrease / 1024

      console.log(`Memory usage increase: ${memoryIncreaseKB.toFixed(2)} KB`)

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseKB).toBeLessThan(50 * 1024)
    })
  })

  describe('Concurrent Request Performance', () => {
    test('should handle multiple concurrent requests efficiently', async () => {
      const mockInvoices = generateMockInvoices(1000)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const concurrentRequests = 10
      const requests: Promise<any>[] = []

      const startTime = performance.now()

      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        const request = new NextRequest('http://localhost/api/invoices/buckets')
        requests.push(GET(request))
      }

      // Wait for all requests to complete
      const responses = await Promise.all(requests)
      const endTime = performance.now()

      const totalTime = endTime - startTime
      const averageTimePerRequest = totalTime / concurrentRequests

      console.log(`${concurrentRequests} concurrent requests completed in ${totalTime.toFixed(2)}ms`)
      console.log(`Average time per request: ${averageTimePerRequest.toFixed(2)}ms`)

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Concurrent execution should be reasonably efficient
      expect(averageTimePerRequest).toBeLessThan(1000)
      expect(totalTime).toBeLessThan(5000) // Total time should be less than 5 seconds
    })
  })

  describe('Bucket Calculation Algorithm Performance', () => {
    test('should efficiently categorize invoices into buckets', async () => {
      const largeDataset = generateMockInvoices(5000)
      mockPrisma.invoice.findMany.mockResolvedValue(largeDataset as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await GET(request)
      })

      expect(result.status).toBe(200)

      const data = await result.json()

      // Verify all invoices are categorized
      const totalCategorizedInvoices = data.buckets.reduce((sum: number, bucket: any) => sum + bucket.count, 0)
      expect(totalCategorizedInvoices).toBe(5000)

      // Verify bucket calculations are consistent
      const totalAmount = data.buckets.reduce((sum: number, bucket: any) => sum + bucket.totalAmount, 0)
      expect(totalAmount).toBe(data.summary.totalAmount)

      // Performance should scale linearly
      const expectedTimeThreshold = 3000 // 3 seconds for 5000 invoices
      expect(executionTime).toBeLessThan(expectedTimeThreshold)

      console.log(`Categorized 5000 invoices in ${executionTime.toFixed(2)}ms`)
    })

    test('should handle edge cases efficiently', async () => {
      // Test with all invoices in one time period
      const today = new Date()
      const sameTimeInvoices = Array.from({ length: 1000 }, (_, i) => ({
        id: `invoice-${i}`,
        number: `INV-${i}`,
        amount: 1000,
        currency: 'AED',
        dueDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), // All 5 days overdue
        status: 'SENT',
        customer: {
          id: `customer-${i}`,
          name: `Customer ${i}`,
          email: `customer${i}@test.com`
        },
        followUpLogs: []
      }))

      mockPrisma.invoice.findMany.mockResolvedValue(sameTimeInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')

      const { result, executionTime } = await measureExecutionTime(async () => {
        return await GET(request)
      })

      expect(result.status).toBe(200)
      expect(executionTime).toBeLessThan(1000) // Should handle edge case efficiently

      const data = await result.json()

      // All invoices should be in the 4-7 days bucket
      const bucket4to7 = data.buckets.find((b: any) => b.id === 'bucket-4-7-days')
      expect(bucket4to7.count).toBe(1000)
    })
  })

  describe('Database Query Optimization', () => {
    test('should make minimal database queries', async () => {
      const mockInvoices = generateMockInvoices(100)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)

      const request = new NextRequest('http://localhost/api/invoices/buckets')
      await GET(request)

      // Should only make one main query for bucket data
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(1)

      // Verify the query includes proper includes and filters
      const callArgs = mockPrisma.invoice.findMany.mock.calls[0][0]
      expect(callArgs.include.customer).toBeDefined()
      expect(callArgs.include.followUpLogs).toBeDefined()
      expect(callArgs.where.companyId).toBe('company-1')
    })

    test('should optimize bucket detail queries with pagination', async () => {
      const mockInvoices = generateMockInvoices(20)
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices as any)
      mockPrisma.invoice.count.mockResolvedValue(100)

      const request = new NextRequest('http://localhost/api/invoices/buckets/bucket-1-3-days?page=2&limit=20')
      const context = { params: { bucketId: 'bucket-1-3-days' } }

      await getBucketDetails(request, context)

      // Should make one query for data and one for count
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.invoice.count).toHaveBeenCalledTimes(1)

      // Verify pagination parameters
      const findManyCall = mockPrisma.invoice.findMany.mock.calls[0][0]
      expect(findManyCall.skip).toBe(20) // page 2, limit 20 = skip 20
      expect(findManyCall.take).toBe(20)
    })
  })
})