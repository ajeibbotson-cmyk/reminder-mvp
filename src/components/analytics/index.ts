/**
 * Analytics Components - Centralized exports
 * UAE Payment Collection Platform Analytics Dashboard
 * Sprint 3.1: Advanced Analytics Dashboard with UAE-specific features
 */

// Main Dashboard Components (Sprint 3.1)
export { default as MainAnalyticsDashboard } from './MainAnalyticsDashboard'
export { MainAnalyticsDashboard } from './MainAnalyticsDashboard'

// Individual Chart and Panel Components (Sprint 3.1)
export { default as PaymentPerformanceChart } from './PaymentPerformanceChart'
export { PaymentPerformanceChart } from './PaymentPerformanceChart'

export { default as InvoiceAgingChart } from './InvoiceAgingChart'
export { InvoiceAgingChart } from './InvoiceAgingChart'

export { default as CustomerInsightsPanel } from './CustomerInsightsPanel'
export { CustomerInsightsPanel } from './CustomerInsightsPanel'

export { default as UAEBusinessIntelligence } from './UAEBusinessIntelligence'
export { UAEBusinessIntelligence } from './UAEBusinessIntelligence'

export { default as RealTimeMetrics } from './RealTimeMetrics'
export { RealTimeMetrics } from './RealTimeMetrics'

export { default as KPICards } from './KPICards'
export { KPICards } from './KPICards'

// Legacy Components (maintained for backward compatibility)
export { AnalyticsDashboard } from './analytics-dashboard'
export { SequencePerformance } from './sequence-performance'
export { EmailAnalytics } from './email-analytics'

// Types
export * from './types'

// Re-export commonly used types for convenience
export type {
  DashboardMetrics,
  PerformanceData,
  EmailMetrics,
  AnalyticsDashboardProps,
  SequencePerformanceProps,
  EmailAnalyticsProps,
  MetricCardProps,
  FilterOptions,
  CulturalComplianceReport
} from './types'

// UAE-specific Business Intelligence Features
export const UAEAnalyticsFeatures = {
  prayerTimeAwareness: true,
  ramadanCompliance: true,
  islamicCalendar: true,
  bilingualSupport: true,
  aedCurrency: true,
  businessHoursOptimization: true,
  culturalCompliance: true,
  emirateSpecificAnalytics: true,
  realTimeUpdates: true,
  mobileOptimized: true
}

// Performance targets for UAE market
export const UAEPerformanceTargets = {
  paymentDelayReduction: 25, // 25% reduction goal
  cultureCompliance: 95, // 95% cultural compliance target
  customerSatisfaction: 90, // 90% satisfaction target
  responseRate: 35, // 35% email response rate target
  collectionEfficiency: 85, // 85% collection efficiency target
  prayerTimeCompliance: 98, // 98% prayer time compliance target
  ramadanAdjustment: 90 // 90% ramadan adjustment score target
}