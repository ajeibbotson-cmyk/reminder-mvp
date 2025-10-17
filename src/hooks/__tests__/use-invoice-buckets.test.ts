import { renderHook, waitFor } from '@testing-library/react'
import { useBucketData, useBucketDetails, formatCurrency, getBucketColorClasses, getPriorityVariant } from '../use-invoice-buckets'

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock next-auth session
const mockSession = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    companyId: 'company-1'
  }
}

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: mockSession,
    status: 'authenticated'
  }))
}))

describe('useInvoiceBuckets hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('useBucketData', () => {
    it('should fetch bucket data successfully', async () => {
      const mockBucketData = {
        buckets: [
          {
            id: 'bucket-not-due',
            label: 'Not Due Yet',
            count: 5,
            totalAmount: 10000,
            priority: 'low',
            color: 'green',
            eligibleForReminder: 0,
            needsReview: 0,
            sampleInvoices: []
          }
        ],
        summary: {
          totalInvoices: 5,
          totalAmount: 10000,
          overdueCount: 0,
          overdueAmount: 0,
          eligibleForReminder: 0
        },
        lastUpdated: new Date().toISOString()
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBucketData,
      } as Response)

      const { result } = renderHook(() => useBucketData())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockBucketData)
      expect(result.current.error).toBeNull()
      expect(mockFetch).toHaveBeenCalledWith('/api/invoices/buckets')
    })

    it('should handle fetch errors', async () => {
      const errorMessage = 'Failed to fetch bucket data'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: errorMessage,
        json: async () => ({ message: errorMessage }),
      } as Response)

      const { result } = renderHook(() => useBucketData())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toContain(errorMessage)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useBucketData())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBe('Network error')
    })

    it('should refetch data on demand', async () => {
      const mockBucketData = {
        buckets: [],
        summary: {
          totalInvoices: 0,
          totalAmount: 0,
          overdueCount: 0,
          overdueAmount: 0,
          eligibleForReminder: 0
        },
        lastUpdated: new Date().toISOString()
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockBucketData,
      } as Response)

      const { result } = renderHook(() => useBucketData())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Trigger refetch
      result.current.refetch()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should auto-refresh based on refresh interval', async () => {
      const mockBucketData = {
        buckets: [],
        summary: {
          totalInvoices: 0,
          totalAmount: 0,
          overdueCount: 0,
          overdueAmount: 0,
          eligibleForReminder: 0
        },
        lastUpdated: new Date().toISOString()
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockBucketData,
      } as Response)

      const { result } = renderHook(() => useBucketData(5000)) // 5 second refresh

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Fast-forward time by 5 seconds
      jest.advanceTimersByTime(5000)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('useBucketDetails', () => {
    it('should fetch bucket details successfully', async () => {
      const mockBucketDetails = {
        invoices: [
          {
            id: 'invoice-1',
            number: 'INV-001',
            customerName: 'Test Customer',
            customerEmail: 'test@customer.com',
            amount: 1500,
            currency: 'AED',
            dueDate: '2024-01-01',
            daysOverdue: 5,
            canSendReminder: true,
            needsUrgentAttention: false,
            isHighValue: false,
            lastReminderSent: null,
            daysSinceLastReminder: null,
            suggestedActions: ['send_reminder']
          }
        ],
        stats: {
          totalInvoices: 1,
          totalAmount: 1500,
          averageAmount: 1500,
          eligibleForReminder: 1,
          needsUrgentAttention: 0,
          highValueInvoices: 0,
          averageDaysOverdue: 5
        },
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBucketDetails,
      } as Response)

      const options = {
        page: 1,
        limit: 20,
        sortBy: 'due_date',
        sortOrder: 'asc' as const,
        search: ''
      }

      const { result } = renderHook(() => useBucketDetails('bucket-1-3-days', options))

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockBucketDetails)
      expect(result.current.error).toBeNull()
      expect(mockFetch).toHaveBeenCalledWith('/api/invoices/buckets/bucket-1-3-days?page=1&limit=20&sortBy=due_date&sortOrder=asc')
    })

    it('should handle search parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: [], stats: {}, pagination: {} }),
      } as Response)

      const options = {
        page: 2,
        limit: 10,
        sortBy: 'amount',
        sortOrder: 'desc' as const,
        search: 'ABC Trading'
      }

      const { result } = renderHook(() => useBucketDetails('bucket-4-7-days', options))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/invoices/buckets/bucket-4-7-days?page=2&limit=10&sortBy=amount&sortOrder=desc&search=ABC+Trading')
    })

    it('should handle API errors', async () => {
      const errorMessage = 'Bucket not found'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: errorMessage,
        json: async () => ({ message: errorMessage }),
      } as Response)

      const { result } = renderHook(() => useBucketDetails('invalid-bucket', {}))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toContain(errorMessage)
    })

    it('should skip fetch if bucketId is empty', () => {
      const { result } = renderHook(() => useBucketDetails('', {}))

      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Utility Functions', () => {
    describe('formatCurrency', () => {
      it('should format AED currency correctly', () => {
        const result1 = formatCurrency(1000)
        const result2 = formatCurrency(1500.50)
        const result3 = formatCurrency(1000000)

        expect(result1).toContain('1,000')
        expect(result1).toContain('AED')
        expect(result2).toContain('1,500')
        expect(result3).toContain('1,000,000')
      })

      it('should handle different currencies', () => {
        const usdResult = formatCurrency(1000, 'USD')
        const eurResult = formatCurrency(1000, 'EUR')

        expect(usdResult).toContain('1,000')
        expect(eurResult).toContain('1,000')
      })

      it('should handle zero and negative amounts', () => {
        const zeroResult = formatCurrency(0)
        const negativeResult = formatCurrency(-100)

        expect(zeroResult).toContain('0')
        expect(negativeResult).toContain('100')
      })

      it('should handle invalid amounts gracefully', () => {
        const nanResult = formatCurrency(NaN)
        const infinityResult = formatCurrency(Infinity)

        expect(typeof nanResult).toBe('string')
        expect(typeof infinityResult).toBe('string')
      })
    })

    describe('getBucketColorClasses', () => {
      it('should return correct classes for each color', () => {
        expect(getBucketColorClasses('red')).toEqual({
          border: 'border-l-red-500',
          bg: 'bg-red-50',
          text: 'text-red-800',
          badge: 'bg-red-100 text-red-800'
        })

        expect(getBucketColorClasses('orange')).toEqual({
          border: 'border-l-orange-500',
          bg: 'bg-orange-50',
          text: 'text-orange-800',
          badge: 'bg-orange-100 text-orange-800'
        })

        expect(getBucketColorClasses('yellow')).toEqual({
          border: 'border-l-yellow-500',
          bg: 'bg-yellow-50',
          text: 'text-yellow-800',
          badge: 'bg-yellow-100 text-yellow-800'
        })

        expect(getBucketColorClasses('green')).toEqual({
          border: 'border-l-green-500',
          bg: 'bg-green-50',
          text: 'text-green-800',
          badge: 'bg-green-100 text-green-800'
        })
      })

      it('should default to green for unknown colors', () => {
        expect(getBucketColorClasses('purple')).toEqual({
          border: 'border-l-green-500',
          bg: 'bg-green-50',
          text: 'text-green-800',
          badge: 'bg-green-100 text-green-800'
        })
      })
    })

    describe('getPriorityVariant', () => {
      it('should return correct variants for each priority', () => {
        expect(getPriorityVariant('critical')).toBe('destructive')
        expect(getPriorityVariant('high')).toBe('destructive')
        expect(getPriorityVariant('medium')).toBe('default')
        expect(getPriorityVariant('low')).toBe('secondary')
      })

      it('should default to default for unknown priorities', () => {
        expect(getPriorityVariant('unknown')).toBe('default')
      })
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript interfaces', async () => {
      const mockData = {
        buckets: [
          {
            id: 'bucket-1',
            label: 'Test Bucket',
            count: 1,
            totalAmount: 1000,
            priority: 'high' as const,
            color: 'red' as const,
            eligibleForReminder: 1,
            needsReview: 0,
            sampleInvoices: [],
            hasUrgentCustomers: false,
            hasAutoRemindersEnabled: true,
            hasRecentActivity: false
          }
        ],
        summary: {
          totalInvoices: 1,
          totalAmount: 1000,
          overdueCount: 1,
          overdueAmount: 1000,
          eligibleForReminder: 1,
          criticalCount: 0,
          needsReview: 0
        },
        lastUpdated: new Date().toISOString()
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      const { result } = renderHook(() => useBucketData())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // TypeScript should enforce the correct structure
      expect(result.current.data?.buckets[0].priority).toBe('high')
      expect(result.current.data?.buckets[0].color).toBe('red')
      expect(result.current.data?.summary.totalInvoices).toBe(1)
    })
  })

  describe('Error Recovery', () => {
    it('should recover from temporary network failures', async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useBucketData())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBe('Network error')
      })

      // Second call succeeds
      const mockData = {
        buckets: [],
        summary: {
          totalInvoices: 0,
          totalAmount: 0,
          overdueCount: 0,
          overdueAmount: 0,
          eligibleForReminder: 0
        },
        lastUpdated: new Date().toISOString()
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      // Trigger refetch
      result.current.refetch()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.data).toEqual(mockData)
      })
    })
  })
})