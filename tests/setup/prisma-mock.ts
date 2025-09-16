/**
 * Prisma Mock Setup
 * Comprehensive mock setup for Prisma client in analytics tests
 */

import { vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset } from 'vitest-mock-extended'

// Create mock Prisma client
export const prismaMock = mockDeep<PrismaClient>()

// Reset mocks before each test
beforeEach(() => {
  mockReset(prismaMock)
})

// Common mock implementations
export const setupCommonMocks = () => {
  // Default company mock
  prismaMock.company.findUnique.mockResolvedValue({
    id: 'company-123',
    name: 'Test Company LLC',
    trn: '123456789012345',
    address: 'Dubai, UAE',
    settings: {},
    defaultVatRate: 5.00,
    emailSettings: {},
    businessHours: {
      timezone: 'Asia/Dubai',
      workingDays: [0, 1, 2, 3, 4],
      startHour: 8,
      endHour: 17
    },
    isActive: true,
    archivedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  } as any)

  // Default user mock
  prismaMock.users.count.mockResolvedValue(5)

  // Default aggregation mocks
  prismaMock.invoice.aggregate.mockResolvedValue({
    _count: { id: 0 },
    _sum: { totalAmount: null }
  })

  prismaMock.payment.aggregate.mockResolvedValue({
    _sum: { amount: null }
  })

  prismaMock.customer.count.mockResolvedValue(0)
  prismaMock.invoice.count.mockResolvedValue(0)
  prismaMock.emailLog.count.mockResolvedValue(0)

  // Default find operations
  prismaMock.invoice.findMany.mockResolvedValue([])
  prismaMock.customer.findMany.mockResolvedValue([])
  prismaMock.emailLog.findMany.mockResolvedValue([])

  // Raw query mocks (return empty arrays by default)
  prismaMock.$queryRaw.mockResolvedValue([])
  prismaMock.$queryRawUnsafe.mockResolvedValue([])
}

// Mock transaction helper
export const mockTransaction = (callback: (tx: any) => Promise<any>) => {
  return prismaMock.$transaction.mockImplementation(callback as any)
}

// Mock specific aggregation patterns
export const mockPaymentAggregation = (data: {
  totalInvoices?: number
  paidInvoices?: number
  totalAmount?: number
  outstandingAmount?: number
}) => {
  prismaMock.invoice.aggregate.mockResolvedValue({
    _count: { id: data.totalInvoices || 0 },
    _sum: { totalAmount: data.totalAmount || null }
  })

  if (data.paidInvoices !== undefined) {
    prismaMock.invoice.count.mockResolvedValue(data.paidInvoices)
  }

  if (data.outstandingAmount !== undefined) {
    prismaMock.invoice.aggregate.mockResolvedValueOnce({
      _count: { id: data.totalInvoices || 0 },
      _sum: { totalAmount: data.totalAmount || null }
    }).mockResolvedValueOnce({
      _count: { id: 0 },
      _sum: { totalAmount: data.outstandingAmount || null }
    })
  }
}

export const mockCustomerRiskDistribution = (distribution: {
  low?: number
  medium?: number
  high?: number
  critical?: number
}) => {
  const mockResults = [{
    low_risk: distribution.low || 0,
    medium_risk: distribution.medium || 0,
    high_risk: distribution.high || 0,
    critical_risk: distribution.critical || 0,
    low_risk_outstanding: 50000,
    medium_risk_outstanding: 30000,
    high_risk_outstanding: 20000,
    critical_risk_outstanding: 10000
  }]

  prismaMock.$queryRaw.mockResolvedValue(mockResults)
}

export const mockEmailAnalytics = (data: {
  totalSent?: number
  delivered?: number
  opened?: number
  clicked?: number
  bounced?: number
  complained?: number
}) => {
  const mockResults = [{
    total_sent: data.totalSent || 0,
    delivered: data.delivered || 0,
    opened: data.opened || 0,
    clicked: data.clicked || 0,
    bounced: data.bounced || 0,
    complained: data.complained || 0
  }]

  prismaMock.$queryRaw.mockResolvedValue(mockResults)

  // Mock individual counts for service methods
  let callCount = 0
  prismaMock.emailLog.count.mockImplementation(() => {
    callCount++
    switch (callCount) {
      case 1: return Promise.resolve(data.totalSent || 0)
      case 2: return Promise.resolve(data.delivered || 0)
      case 3: return Promise.resolve(data.opened || 0)
      case 4: return Promise.resolve(data.clicked || 0)
      case 5: return Promise.resolve(data.bounced || 0)
      case 6: return Promise.resolve(data.complained || 0)
      default: return Promise.resolve(0)
    }
  })
}

export const mockInvoiceStatusDistribution = (statuses: {
  DRAFT?: number
  SENT?: number
  OVERDUE?: number
  PAID?: number
  DISPUTED?: number
  WRITTEN_OFF?: number
}) => {
  const mockResults = Object.entries(statuses).map(([status, count]) => ({
    status,
    count,
    total_amount: count * 10000 // Mock amount
  }))

  prismaMock.$queryRaw.mockResolvedValue(mockResults)
}

// Error simulation helpers
export const simulateDatabaseError = (operation: string = 'query') => {
  const error = new Error(`Database ${operation} failed`)

  switch (operation) {
    case 'aggregate':
      prismaMock.invoice.aggregate.mockRejectedValue(error)
      prismaMock.payment.aggregate.mockRejectedValue(error)
      break
    case 'count':
      prismaMock.invoice.count.mockRejectedValue(error)
      prismaMock.customer.count.mockRejectedValue(error)
      break
    case 'findMany':
      prismaMock.invoice.findMany.mockRejectedValue(error)
      prismaMock.customer.findMany.mockRejectedValue(error)
      break
    case 'rawQuery':
      prismaMock.$queryRaw.mockRejectedValue(error)
      break
    default:
      prismaMock.invoice.aggregate.mockRejectedValue(error)
  }
}

export const simulateTimeout = (delay: number = 5000) => {
  const timeoutError = new Error('Query timeout')
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(timeoutError), delay)
  })

  prismaMock.invoice.aggregate.mockReturnValue(timeoutPromise as any)
  prismaMock.customer.findMany.mockReturnValue(timeoutPromise as any)
}

// Performance testing helpers
export const simulateSlowQuery = (delay: number = 1000) => {
  const slowPromise = (result: any) => new Promise(resolve => {
    setTimeout(() => resolve(result), delay)
  })

  prismaMock.invoice.aggregate.mockImplementation(() =>
    slowPromise({
      _count: { id: 100 },
      _sum: { totalAmount: 500000 }
    }) as any
  )

  prismaMock.customer.findMany.mockImplementation(() =>
    slowPromise([]) as any
  )
}

// UAE-specific mock helpers
export const mockUAEBusinessHoursCompliance = (data: {
  totalEmails?: number
  compliantEmails?: number
  lunchHourSends?: number
}) => {
  const mockResults = [{
    total_emails: data.totalEmails || 0,
    business_hours_compliant: data.compliantEmails || 0,
    lunch_hour_sends: data.lunchHourSends || 0
  }]

  prismaMock.$queryRaw.mockResolvedValue(mockResults)
}

export const mockTRNCompliance = (data: {
  totalCustomers?: number
  validTrnCount?: number
}) => {
  const mockResults = [{
    total_customers: data.totalCustomers || 0,
    valid_trn_count: data.validTrnCount || 0
  }]

  prismaMock.$queryRaw.mockResolvedValue(mockResults)
}

// Batch operation mocks
export const mockBatchOperations = () => {
  prismaMock.invoice.updateMany.mockResolvedValue({ count: 10 })
  prismaMock.customer.updateMany.mockResolvedValue({ count: 5 })
  prismaMock.emailLog.createMany.mockResolvedValue({ count: 20 })
}

// Connection and transaction mocks
export const mockConnectionHandling = () => {
  prismaMock.$connect.mockResolvedValue(undefined)
  prismaMock.$disconnect.mockResolvedValue(undefined)
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    return callback(prismaMock)
  })
}

// Initialize common mocks
setupCommonMocks()

export default prismaMock