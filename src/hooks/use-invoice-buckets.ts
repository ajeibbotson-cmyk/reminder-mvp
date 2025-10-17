import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export interface InvoiceBucket {
  id: string
  label: string
  dayRange: { min: number; max: number | null }
  count: number
  totalAmount: number
  color: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  hasUrgentCustomers: boolean
  hasAutoRemindersEnabled: boolean
  hasRecentActivity: boolean
  eligibleForReminder: number
  needsReview: number
  sampleInvoices: Array<{
    id: string
    number: string
    customerName: string
    amount: number
    daysOverdue: number
    lastReminderSent: string | null
  }>
}

export interface BucketSummary {
  totalInvoices: number
  totalAmount: number
  overdueCount: number
  overdueAmount: number
  criticalCount: number
  eligibleForReminder: number
  needsReview: number
}

export interface BucketData {
  buckets: InvoiceBucket[]
  summary: BucketSummary
  lastUpdated: string
}

export interface DetailedInvoice {
  id: string
  number: string
  customerName: string
  customerEmail: string
  amount: number
  currency: string
  dueDate: string
  status: string
  daysOverdue: number
  lastReminderSent: string | null
  daysSinceLastReminder: number
  canSendReminder: boolean
  needsUrgentAttention: boolean
  isHighValue: boolean
  createdAt: string
  notes: string | null
  suggestedActions: string[]
}

export interface BucketDetails {
  bucketId: string
  invoices: DetailedInvoice[]
  stats: {
    totalInvoices: number
    totalAmount: number
    eligibleForReminder: number
    needsUrgentAttention: number
    highValueInvoices: number
    averageAmount: number
    averageDaysOverdue: number
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    search: string
    sortBy: string
    sortOrder: string
  }
  lastUpdated: string
}

export function useBucketData(refreshInterval: number = 60000) {
  const { data: session } = useSession()
  const [data, setData] = useState<BucketData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBuckets = async () => {
    if (!session?.user) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/invoices/buckets')
      if (!response.ok) {
        throw new Error(`Failed to fetch buckets: ${response.statusText}`)
      }

      const bucketData = await response.json()
      setData(bucketData)
      setError(null)
    } catch (err) {
      console.error('Error fetching bucket data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBuckets()

    // Set up refresh interval if specified
    let interval: NodeJS.Timeout | null = null
    if (refreshInterval > 0) {
      interval = setInterval(fetchBuckets, refreshInterval)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [session, refreshInterval])

  return {
    data,
    isLoading,
    error,
    refetch: fetchBuckets
  }
}

export function useBucketDetails(
  bucketId: string | null,
  options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
    enabled?: boolean
  } = {}
) {
  const { data: session } = useSession()
  const [data, setData] = useState<BucketDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    page = 1,
    limit = 20,
    sortBy = 'due_date',
    sortOrder = 'asc',
    search = '',
    enabled = true
  } = options

  const fetchBucketDetails = async () => {
    if (!session?.user || !bucketId || !enabled) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        ...(search && { search })
      })

      const response = await fetch(`/api/invoices/buckets/${bucketId}?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch bucket details: ${response.statusText}`)
      }

      const detailData = await response.json()
      setData(detailData)
    } catch (err) {
      console.error('Error fetching bucket details:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBucketDetails()
  }, [session, bucketId, page, limit, sortBy, sortOrder, search, enabled])

  return {
    data,
    isLoading,
    error,
    refetch: fetchBucketDetails
  }
}

// Utility function to format currency
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  // Convert from cents to full units
  const amountInFullUnits = amount / 100

  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountInFullUnits)
}

// Utility function to get bucket color classes
export function getBucketColorClasses(color: string) {
  const colorMap = {
    'green': {
      border: 'border-l-green-500',
      bg: 'bg-green-50',
      text: 'text-green-800',
      badge: 'bg-green-100 text-green-800'
    },
    'yellow': {
      border: 'border-l-yellow-500',
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      badge: 'bg-yellow-100 text-yellow-800'
    },
    'amber': {
      border: 'border-l-amber-500',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-800'
    },
    'orange': {
      border: 'border-l-orange-500',
      bg: 'bg-orange-50',
      text: 'text-orange-800',
      badge: 'bg-orange-100 text-orange-800'
    },
    'red': {
      border: 'border-l-red-500',
      bg: 'bg-red-50',
      text: 'text-red-800',
      badge: 'bg-red-100 text-red-800'
    },
    'dark-red': {
      border: 'border-l-red-700',
      bg: 'bg-red-100',
      text: 'text-red-900',
      badge: 'bg-red-200 text-red-900'
    }
  }

  return colorMap[color as keyof typeof colorMap] || colorMap.green
}

// Utility function to get priority badge variant
export function getPriorityVariant(priority: string) {
  const variantMap = {
    'low': 'secondary',
    'medium': 'default',
    'high': 'destructive',
    'critical': 'destructive'
  }

  return variantMap[priority as keyof typeof variantMap] || 'default'
}