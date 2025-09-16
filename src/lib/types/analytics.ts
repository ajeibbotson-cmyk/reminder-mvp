/**
 * Advanced Analytics Dashboard Types for UAE Payment Reminder Platform
 * Sprint 3.1: Comprehensive analytics infrastructure with UAE-specific KPIs
 */

import { Decimal } from 'decimal.js'

// Core Analytics Time Ranges
export interface AnalyticsDateRange {
  startDate: Date
  endDate: Date
  preset?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
}

// Payment Performance Analytics
export interface PaymentPerformanceMetrics {
  // Core payment delay metrics
  averagePaymentDelay: number // days
  paymentDelayReduction: number // percentage improvement
  daysOutstanding: {
    current: number
    previous: number
    improvement: number
  }

  // Payment success rates
  onTimePayments: {
    count: number
    percentage: number
    trend: number // vs previous period
  }

  overduePayments: {
    count: number
    totalAmount: Decimal
    averageDaysOverdue: number
    trend: number
  }

  // Collection efficiency
  collectionRate: {
    current: number // percentage
    target: number // 25% improvement target
    progress: number // progress towards target
  }

  // Trend analysis
  paymentTrends: Array<{
    date: string
    onTimePayments: number
    delayedPayments: number
    averageDelay: number
    totalAmount: Decimal
  }>
}

// Invoice Status Analytics
export interface InvoiceStatusAnalytics {
  // Real-time status distribution
  statusDistribution: {
    draft: { count: number; amount: Decimal }
    sent: { count: number; amount: Decimal }
    overdue: { count: number; amount: Decimal }
    paid: { count: number; amount: Decimal }
    disputed: { count: number; amount: Decimal }
    writtenOff: { count: number; amount: Decimal }
  }

  // Aging analysis
  agingBuckets: {
    current: { count: number; amount: Decimal } // 0-30 days
    overdue30: { count: number; amount: Decimal } // 31-60 days
    overdue60: { count: number; amount: Decimal } // 61-90 days
    overdue90: { count: number; amount: Decimal } // 90+ days
  }

  // Invoice processing metrics
  processingMetrics: {
    averageProcessingTime: number // hours from creation to sent
    averagePaymentTime: number // days from sent to paid
    conversionRates: {
      sentToPaid: number // percentage
      overdueToDisputed: number
      overdueToWrittenOff: number
    }
  }

  // Real-time updates
  realtimeUpdates: {
    newInvoices: number // in last hour
    paymentsReceived: number // in last hour
    overdueAlerts: number // new overdue today
  }
}

// Customer Insights Analytics
export interface CustomerInsightsAnalytics {
  // Payment behavior analysis
  paymentBehaviorSegments: {
    excellent: { count: number; criteria: string; avgPaymentDays: number }
    good: { count: number; criteria: string; avgPaymentDays: number }
    average: { count: number; criteria: string; avgPaymentDays: number }
    poor: { count: number; criteria: string; avgPaymentDays: number }
  }

  // Risk scoring
  riskDistribution: {
    low: { count: number; percentage: number; totalOutstanding: Decimal }
    medium: { count: number; percentage: number; totalOutstanding: Decimal }
    high: { count: number; percentage: number; totalOutstanding: Decimal }
    critical: { count: number; percentage: number; totalOutstanding: Decimal }
  }

  // Customer lifetime value
  customerValueMetrics: {
    averageLTV: Decimal
    topCustomers: Array<{
      customerId: string
      customerName: string
      ltv: Decimal
      riskScore: number
      paymentReliability: number
    }>
    churnRisk: {
      highRisk: number
      mediumRisk: number
      lowRisk: number
    }
  }

  // Payment patterns
  paymentPatterns: {
    preferredMethods: Record<string, number>
    paymentTiming: {
      early: number // pay before due date
      onTime: number // pay on due date
      late: number // pay after due date
    }
    seasonalTrends: Array<{
      month: number
      averagePaymentDays: number
      paymentVolume: number
    }>
  }
}

// Email Campaign Performance Analytics
export interface EmailCampaignAnalytics {
  // Campaign effectiveness
  campaignMetrics: {
    totalCampaigns: number
    emailsSent: number
    deliveryRate: number
    openRate: number
    clickRate: number
    responseRate: number
    conversionRate: number // leads to payment
  }

  // Follow-up sequence performance
  sequencePerformance: Array<{
    sequenceId: string
    sequenceName: string
    step: number
    emailsSent: number
    openRate: number
    clickRate: number
    paymentConversions: number
    effectiveness: number // weighted score
  }>

  // Template optimization
  templateAnalytics: Array<{
    templateId: string
    templateName: string
    templateType: string
    usage: number
    performance: {
      openRate: number
      clickRate: number
      responseRate: number
      conversionToPayment: number
    }
    languageEffectiveness: {
      english: { openRate: number; conversionRate: number }
      arabic: { openRate: number; conversionRate: number }
    }
  }>

  // A/B test results
  abTestResults: Array<{
    testId: string
    testName: string
    variantA: { name: string; performance: number }
    variantB: { name: string; performance: number }
    winner: string
    confidence: number
    recommendation: string
  }>
}

// UAE Business Intelligence Analytics
export interface UAEBusinessIntelligence {
  // Cultural compliance metrics
  culturalCompliance: {
    overallScore: number // 0-100
    businessHoursRespect: {
      score: number
      violationsCount: number
      improvements: Array<string>
    }
    prayerTimeAvoidance: {
      score: number
      respectfulTiming: number
      adjustmentsMade: number
    }
    ramadanAdjustments: {
      score: number
      adaptedCommunications: number
      culturalSensitivity: number
    }
    languageEffectiveness: {
      arabicUsage: number
      englishUsage: number
      bilingualEffectiveness: number
    }
  }

  // UAE market insights
  marketInsights: {
    businessTypeDistribution: Record<string, number>
    geographicDistribution: Record<string, number>
    industryPerformance: Array<{
      industry: string
      avgPaymentDays: number
      collectionRate: number
      riskLevel: number
    }>
    trnComplianceRate: number
    vatCalculationAccuracy: number
  }

  // Economic indicators
  economicImpact: {
    currencyStability: number // AED performance indicator
    businessConfidence: number // based on payment behaviors
    seasonalImpacts: {
      ramadan: { impact: number; adjustments: string[] }
      summer: { impact: number; adjustments: string[] }
      yearEnd: { impact: number; adjustments: string[] }
    }
  }
}

// Comprehensive Dashboard Analytics
export interface DashboardAnalytics {
  // Overview KPIs
  overview: {
    totalInvoices: number
    totalAmount: Decimal
    totalOutstanding: Decimal
    paymentDelayReduction: number
    collectionEfficiency: number
    customerSatisfaction: number
  }

  // Performance metrics
  paymentPerformance: PaymentPerformanceMetrics
  invoiceStatus: InvoiceStatusAnalytics
  customerInsights: CustomerInsightsAnalytics
  emailCampaigns: EmailCampaignAnalytics
  uaeIntelligence: UAEBusinessIntelligence

  // Real-time indicators
  realtimeMetrics: {
    activeUsers: number
    processingTime: number // ms
    systemHealth: number // 0-100
    alertsCount: number
    dataFreshness: Date
  }

  // Predictive analytics
  predictions: {
    expectedPayments: Array<{
      date: string
      amount: Decimal
      confidence: number
    }>
    riskAlerts: Array<{
      type: 'customer' | 'invoice' | 'system'
      severity: 'low' | 'medium' | 'high' | 'critical'
      description: string
      action: string
    }>
    recommendations: Array<{
      category: string
      title: string
      description: string
      impact: number
      effort: number
    }>
  }
}

// Analytics Query Filters
export interface AnalyticsFilters {
  dateRange: AnalyticsDateRange
  companyId?: string
  customerIds?: string[]
  invoiceStatus?: string[]
  paymentMethods?: string[]
  businessTypes?: string[]
  riskLevels?: string[]
  amountRange?: {
    min: Decimal
    max: Decimal
  }
  includeArchived?: boolean
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
}

// Analytics Response Wrapper
export interface AnalyticsResponse<T> {
  data: T
  metadata: {
    queryTime: number // ms
    recordsProcessed: number
    cacheHit: boolean
    freshness: Date
    filters: AnalyticsFilters
    performance: {
      queryOptimization: string
      indexesUsed: string[]
      executionPlan: string
    }
  }
  warnings?: string[]
  recommendations?: Array<{
    type: 'performance' | 'data_quality' | 'business'
    message: string
    action?: string
  }>
}

// Real-time Analytics Events
export interface AnalyticsEvent {
  id: string
  timestamp: Date
  eventType: 'payment_received' | 'invoice_created' | 'email_sent' | 'customer_updated' | 'system_alert'
  companyId: string
  entityId: string
  entityType: string
  metadata: Record<string, any>
  impact: {
    kpiUpdates: string[] // which KPIs are affected
    realtimeRefresh: boolean
    cacheInvalidation: string[]
  }
}

// Export all types
export type {
  AnalyticsDateRange,
  PaymentPerformanceMetrics,
  InvoiceStatusAnalytics,
  CustomerInsightsAnalytics,
  EmailCampaignAnalytics,
  UAEBusinessIntelligence,
  DashboardAnalytics,
  AnalyticsFilters,
  AnalyticsResponse,
  AnalyticsEvent
}