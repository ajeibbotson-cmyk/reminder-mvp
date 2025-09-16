/**
 * Analytics Test Fixtures
 * Comprehensive mock data factories for analytics testing
 */

import { Decimal } from 'decimal.js'
import { AnalyticsFilters, AnalyticsDateRange } from '@/lib/types/analytics'

// Mock data factories
export const createMockCompany = (overrides: Partial<any> = {}) => ({
  id: 'company-123',
  name: 'Test Company LLC',
  trn: '123456789012345',
  address: 'Dubai, UAE',
  settings: {},
  defaultVatRate: new Decimal(5.00),
  emailSettings: {},
  businessHours: {
    timezone: 'Asia/Dubai',
    workingDays: [0, 1, 2, 3, 4],
    startHour: 8,
    endHour: 17
  },
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides
})

export const createMockCustomer = (overrides: Partial<any> = {}) => ({
  id: 'customer-123',
  companyId: 'company-123',
  name: 'Test Customer',
  nameAr: 'عميل اختبار',
  email: 'customer@example.com',
  phone: '+971501234567',
  paymentTerms: 30,
  isActive: true,
  trn: '123456789012345',
  businessType: 'LLC',
  businessName: 'Customer Business LLC',
  address: 'Dubai, UAE',
  contactPerson: 'John Doe',
  riskScore: new Decimal(3.5),
  paymentBehavior: {
    averagePaymentDays: 25,
    paymentReliability: 0.85,
    lastUpdated: new Date()
  },
  lastPaymentDate: new Date('2024-01-15'),
  outstandingBalance: new Decimal(15000),
  lifetimeValue: new Decimal(50000),
  preferredLanguage: 'en',
  paymentMethodPref: 'BANK_TRANSFER',
  communicationPref: 'email',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides
})

export const createMockInvoice = (overrides: Partial<any> = {}) => ({
  id: 'invoice-123',
  companyId: 'company-123',
  number: 'INV-2024-001',
  customerName: 'Test Customer',
  customerEmail: 'customer@example.com',
  amount: new Decimal(10000),
  subtotal: new Decimal(9523.81),
  vatAmount: new Decimal(476.19),
  totalAmount: new Decimal(10000),
  currency: 'AED',
  dueDate: new Date('2024-01-31'),
  status: 'SENT',
  description: 'Test Invoice',
  isActive: true,
  lastReminderSent: null,
  paymentLink: 'https://pay.example.com/invoice-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  payments: [],
  invoiceItems: [
    {
      id: 'item-123',
      invoiceId: 'invoice-123',
      description: 'Test Service',
      quantity: new Decimal(1),
      unitPrice: new Decimal(9523.81),
      total: new Decimal(9523.81),
      vatRate: new Decimal(5.00),
      vatAmount: new Decimal(476.19),
      totalWithVat: new Decimal(10000)
    }
  ],
  ...overrides
})

export const createMockPayment = (overrides: Partial<any> = {}) => ({
  id: 'payment-123',
  invoiceId: 'invoice-123',
  amount: new Decimal(10000),
  paymentDate: new Date('2024-01-30'),
  method: 'BANK_TRANSFER',
  reference: 'TXN123456789',
  isVerified: true,
  verifiedBy: 'user-123',
  verifiedAt: new Date('2024-01-30'),
  bankReference: 'BANK123456',
  feesAmount: new Decimal(0),
  createdAt: new Date('2024-01-30'),
  updatedAt: new Date('2024-01-30'),
  ...overrides
})

export const createMockEmailLog = (overrides: Partial<any> = {}) => ({
  id: 'email-123',
  templateId: 'template-123',
  companyId: 'company-123',
  invoiceId: 'invoice-123',
  customerId: 'customer-123',
  recipientEmail: 'customer@example.com',
  recipientName: 'Test Customer',
  subject: 'Payment Reminder',
  content: 'Your invoice is due soon.',
  language: 'ENGLISH',
  deliveryStatus: 'DELIVERED',
  sentAt: new Date('2024-01-15T09:00:00Z'),
  deliveredAt: new Date('2024-01-15T09:01:00Z'),
  openedAt: new Date('2024-01-15T10:30:00Z'),
  clickedAt: new Date('2024-01-15T10:35:00Z'),
  uaeSendTime: new Date('2024-01-15T13:00:00Z'), // UAE time (UTC+4)
  engagementScore: new Decimal(0.75),
  retryCount: 0,
  createdAt: new Date('2024-01-15T09:00:00Z'),
  updatedAt: new Date('2024-01-15T10:35:00Z'),
  ...overrides
})

export const createMockAnalyticsFilters = (overrides: Partial<AnalyticsFilters> = {}): AnalyticsFilters => ({
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    preset: 'month'
  },
  customerIds: undefined,
  invoiceStatus: undefined,
  paymentMethods: undefined,
  businessTypes: undefined,
  riskLevels: undefined,
  includeArchived: false,
  granularity: 'day',
  ...overrides
})

export const createMockDateRange = (overrides: Partial<AnalyticsDateRange> = {}): AnalyticsDateRange => ({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  preset: 'month',
  ...overrides
})

// Mock aggregated data
export const createMockPaymentPerformanceData = () => ({
  averagePaymentDelay: 12.5,
  paymentDelayReduction: 18.2,
  daysOutstanding: {
    current: 32.5,
    previous: 39.8,
    improvement: 18.3
  },
  onTimePayments: {
    count: 75,
    percentage: 78.2,
    trend: 8.5
  },
  overduePayments: {
    count: 21,
    totalAmount: new Decimal(48500),
    averageDaysOverdue: 18.7,
    trend: -12.3
  },
  collectionRate: {
    current: 87.5,
    target: 25,
    progress: 73.2
  },
  paymentTrends: [
    {
      date: '2024-01-01',
      onTimePayments: 8,
      delayedPayments: 3,
      averageDelay: 15.2,
      totalAmount: new Decimal(45000)
    },
    {
      date: '2024-01-02',
      onTimePayments: 12,
      delayedPayments: 2,
      averageDelay: 8.5,
      totalAmount: new Decimal(38000)
    }
  ]
})

export const createMockInvoiceStatusData = () => ({
  statusDistribution: {
    draft: { count: 8, amount: new Decimal(15000) },
    sent: { count: 45, amount: new Decimal(235000) },
    overdue: { count: 23, amount: new Decimal(98000) },
    paid: { count: 120, amount: new Decimal(560000) },
    disputed: { count: 3, amount: new Decimal(8500) },
    writtenOff: { count: 2, amount: new Decimal(3200) }
  },
  agingBuckets: {
    current: { count: 35, amount: new Decimal(145000) },
    overdue30: { count: 18, amount: new Decimal(75000) },
    overdue60: { count: 12, amount: new Decimal(45000) },
    overdue90: { count: 8, amount: new Decimal(28000) }
  },
  processingMetrics: {
    averageProcessingTime: 14.5,
    averagePaymentTime: 28.3,
    conversionRates: {
      sentToPaid: 72.8,
      overdueToDisputed: 6.2,
      overdueToWrittenOff: 1.8
    }
  },
  realtimeUpdates: {
    newInvoices: 4,
    paymentsReceived: 9,
    overdueAlerts: 3
  }
})

export const createMockCustomerInsightsData = () => ({
  paymentBehaviorSegments: {
    excellent: { count: 25, criteria: 'Pays early or on time', avgPaymentDays: 4.2 },
    good: { count: 48, criteria: 'Usually pays on time', avgPaymentDays: 12.8 },
    average: { count: 32, criteria: 'Sometimes late', avgPaymentDays: 24.5 },
    poor: { count: 18, criteria: 'Frequently late', avgPaymentDays: 42.1 }
  },
  riskDistribution: {
    low: { count: 73, percentage: 59.3, totalOutstanding: new Decimal(125000) },
    medium: { count: 32, percentage: 26.0, totalOutstanding: new Decimal(98000) },
    high: { count: 15, percentage: 12.2, totalOutstanding: new Decimal(67000) },
    critical: { count: 3, percentage: 2.4, totalOutstanding: new Decimal(28000) }
  },
  customerValueMetrics: {
    averageLTV: new Decimal(18500),
    topCustomers: [
      {
        customerId: 'customer-1',
        customerName: 'Top Customer LLC',
        ltv: new Decimal(125000),
        riskScore: 2.1,
        paymentReliability: 0.95
      }
    ],
    churnRisk: {
      highRisk: 8,
      mediumRisk: 18,
      lowRisk: 97
    }
  },
  paymentPatterns: {
    preferredMethods: {
      BANK_TRANSFER: 68,
      CREDIT_CARD: 22,
      CASH: 8,
      OTHER: 2
    },
    paymentTiming: {
      early: 18.5,
      onTime: 54.2,
      late: 27.3
    },
    seasonalTrends: [
      { month: 1, averagePaymentDays: 22.5, paymentVolume: 85 },
      { month: 2, averagePaymentDays: 19.8, paymentVolume: 92 }
    ]
  }
})

export const createMockUAEIntelligenceData = () => ({
  culturalCompliance: {
    overallScore: 88,
    businessHoursRespect: {
      score: 92,
      violationsCount: 12,
      improvements: [
        'Reduce after-hours email sending',
        'Implement UAE business hours scheduling'
      ]
    },
    prayerTimeAvoidance: {
      score: 85,
      respectfulTiming: 88,
      adjustmentsMade: 35
    },
    ramadanAdjustments: {
      score: 94,
      adaptedCommunications: 78,
      culturalSensitivity: 92
    },
    languageEffectiveness: {
      arabicUsage: 28,
      englishUsage: 72,
      bilingualEffectiveness: 86
    }
  },
  marketInsights: {
    businessTypeDistribution: {
      LLC: 58,
      FREE_ZONE: 28,
      SOLE_PROPRIETORSHIP: 12,
      OTHER: 2
    },
    geographicDistribution: {
      Dubai: 42,
      'Abu Dhabi': 28,
      Sharjah: 18,
      'Other Emirates': 12
    },
    industryPerformance: [
      {
        industry: 'TECHNOLOGY',
        avgPaymentDays: 18.5,
        collectionRate: 89.2,
        riskLevel: 2.8
      },
      {
        industry: 'RETAIL',
        avgPaymentDays: 32.1,
        collectionRate: 76.5,
        riskLevel: 4.2
      }
    ],
    trnComplianceRate: 94.5,
    vatCalculationAccuracy: 98.2
  },
  economicImpact: {
    currencyStability: 98.8,
    businessConfidence: 84.2,
    seasonalImpacts: {
      ramadan: {
        impact: 18,
        adjustments: [
          'Extended payment terms during Ramadan',
          'Cultural sensitivity in communications'
        ]
      },
      summer: {
        impact: 12,
        adjustments: [
          'Earlier communication times',
          'Vacation schedule adjustments'
        ]
      },
      yearEnd: {
        impact: 25,
        adjustments: [
          'Budget cycle considerations',
          'Holiday payment schedules'
        ]
      }
    }
  }
})

// Mock database response helpers
export const createMockDatabaseResponse = <T>(data: T, metadata: any = {}) => ({
  data,
  metadata: {
    queryTime: 125,
    recordsProcessed: 100,
    cacheHit: false,
    freshness: new Date(),
    filters: createMockAnalyticsFilters(),
    performance: {
      queryOptimization: 'Mock query optimization',
      indexesUsed: ['mock_index_1', 'mock_index_2'],
      executionPlan: 'Mock execution plan'
    },
    ...metadata
  },
  recommendations: []
})

// Performance test helpers
export const createLargeDataset = (size: number) => ({
  invoices: Array.from({ length: size }, (_, i) => createMockInvoice({
    id: `invoice-${i}`,
    number: `INV-2024-${String(i).padStart(4, '0')}`,
    totalAmount: new Decimal(Math.random() * 50000 + 1000)
  })),
  payments: Array.from({ length: Math.floor(size * 0.7) }, (_, i) => createMockPayment({
    id: `payment-${i}`,
    invoiceId: `invoice-${i}`,
    amount: new Decimal(Math.random() * 50000 + 1000)
  })),
  customers: Array.from({ length: Math.floor(size * 0.3) }, (_, i) => createMockCustomer({
    id: `customer-${i}`,
    email: `customer${i}@example.com`,
    riskScore: new Decimal(Math.random() * 10)
  }))
})

// Edge case data factories
export const createEdgeCaseData = () => ({
  emptyInvoice: createMockInvoice({
    totalAmount: new Decimal(0),
    status: 'DRAFT',
    payments: []
  }),
  highRiskCustomer: createMockCustomer({
    riskScore: new Decimal(9.8),
    outstandingBalance: new Decimal(250000),
    lastPaymentDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) // 120 days ago
  }),
  perfectCustomer: createMockCustomer({
    riskScore: new Decimal(0.1),
    outstandingBalance: new Decimal(0),
    lastPaymentDate: new Date(),
    paymentBehavior: {
      averagePaymentDays: -2, // Pays early
      paymentReliability: 1.0,
      lastUpdated: new Date()
    }
  }),
  overdueInvoice: createMockInvoice({
    status: 'OVERDUE',
    dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days overdue
    totalAmount: new Decimal(75000)
  }),
  paidEarlyInvoice: createMockInvoice({
    status: 'PAID',
    dueDate: new Date('2024-01-31'),
    payments: [createMockPayment({
      paymentDate: new Date('2024-01-25') // 6 days early
    })]
  })
})