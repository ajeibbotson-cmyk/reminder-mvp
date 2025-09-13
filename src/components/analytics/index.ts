/**
 * Analytics Components - Centralized exports
 * UAE Payment Collection Platform Analytics Dashboard
 */

// Main components
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