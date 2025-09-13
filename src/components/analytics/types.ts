/**
 * TypeScript type definitions for UAE Payment Collection Analytics System
 * Comprehensive types covering all analytics data structures and API interfaces
 */

// ===== BASE TYPES =====
export type DateRange = '7' | '30' | '90' | '365' | 'custom'
export type CurrencyCode = 'AED' | 'USD' | 'EUR'
export type LanguageCode = 'en' | 'ar' | 'bilingual'
export type SequenceStatus = 'active' | 'paused' | 'draft' | 'completed'
export type SequenceType = 'email' | 'sms' | 'call' | 'wait'
export type ABTestStatus = 'running' | 'completed' | 'paused'
export type Priority = 'high' | 'medium' | 'low'
export type RecommendationType = 'optimization' | 'cultural' | 'timing' | 'content'
export type TestVariantType = 'subject' | 'content' | 'sendTime' | 'language'
export type UAEEmirate = 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ajman' | 'Ras Al Khaimah' | 'Fujairah' | 'Umm Al Quwain'
export type PrayerTime = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'
export type DeviceType = 'Mobile' | 'Desktop' | 'Tablet'
export type Weekday = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

// ===== DASHBOARD ANALYTICS TYPES =====
export interface DashboardOverview {
  totalSequences: number
  activeSequences: number
  totalEmailsSent: number
  averageResponseRate: number
  paymentAcceleration: number // days saved on average
  cultureScore: number // UAE cultural appropriateness score
  totalRevenue: number
  pendingAmount: number
}

export interface TrendData {
  emailVolume: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
  }>
  conversionFunnel: Array<{
    stage: string
    count: number
    rate: number
  }>
  performanceOverTime: Array<{
    date: string
    responseRate: number
    paymentRate: number
    cultureScore: number
  }>
}

export interface BusinessHoursMetrics {
  compliance: number
  optimalTimes: Array<{
    hour: number
    effectiveness: number
  }>
  prayerTimeRespect: number
  holidayCompliance: number
}

export interface CulturalMetrics {
  arabicUsage: number
  toneAppropriateness: number
  localCustomsRespect: number
  timeZoneAccuracy: number
}

export interface SequenceTypeMetrics {
  name: string
  usage: number
  effectiveness: number
  avgDuration: number
  culturalScore: number
  color: string
}

export interface DashboardMetrics {
  overview: DashboardOverview
  trends: TrendData
  businessHours: BusinessHoursMetrics
  culturalMetrics: CulturalMetrics
  sequenceTypes: SequenceTypeMetrics[]
}

// ===== SEQUENCE PERFORMANCE TYPES =====
export interface SequenceInfo {
  id: string
  name: string
  type: string
  status: SequenceStatus
  totalSteps: number
  avgDuration: number
  createdAt: string
  lastModified: string
}

export interface SequenceOverviewMetrics {
  totalContacts: number
  completionRate: number
  averageResponseTime: number
  totalRevenue: number
  costPerConversion: number
  roi: number
}

export interface FunnelStage {
  stage: string
  count: number
  rate: number
  dropoff: number
}

export interface SequenceStep {
  stepNumber: number
  stepType: SequenceType
  name: string
  triggerDelay: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  responded: number
  bounced: number
  unsubscribed: number
  effectiveness: number
  cultureScore: number
  dropoffRate: number
}

export interface TimingAnalysisPoint {
  day: string
  startedContacts: number
  completedContacts: number
  responseRate: number
  cultureCompliance: number
}

export interface PerformanceRecommendation {
  type: RecommendationType
  priority: Priority
  title: string
  description: string
  expectedImprovement: string
}

export interface PerformanceData {
  sequence: SequenceInfo
  overview: SequenceOverviewMetrics
  funnel: FunnelStage[]
  steps: SequenceStep[]
  timingAnalysis: TimingAnalysisPoint[]
  recommendations: PerformanceRecommendation[]
}

// ===== EMAIL ANALYTICS TYPES =====
export interface EmailOverviewMetrics {
  totalEmailsSent: number
  deliveryRate: number
  openRate: number
  clickRate: number
  responseRate: number
  bounceRate: number
  unsubscribeRate: number
  averageEngagement: number
}

export interface DeliverabilityMetrics {
  deliveredEmails: number
  bouncedEmails: number
  blockedEmails: number
  deferredEmails: number
  reputationScore: number
  domainHealth: number
}

export interface HourlyEngagement {
  hour: number
  opens: number
  clicks: number
  responses: number
}

export interface DailyEngagement {
  day: string
  opens: number
  clicks: number
  responses: number
}

export interface DeviceBreakdown {
  device: DeviceType
  percentage: number
  color: string
}

export interface LocationData {
  emirate: UAEEmirate
  engagement: number
  volume: number
}

export interface EngagementMetrics {
  hourlyEngagement: HourlyEngagement[]
  dailyEngagement: DailyEngagement[]
  deviceBreakdown: DeviceBreakdown[]
  locationData: LocationData[]
}

export interface LanguagePerformance {
  language: string
  opens: number
  clicks: number
  responses: number
  volume: number
}

export interface CulturalElement {
  usage: number
  effectiveness: number
}

export interface CulturalElements {
  arabicGreetings: CulturalElement
  islamicPhrases: CulturalElement
  localReferences: CulturalElement
  culturalTiming: CulturalElement
}

export interface RamadanPerformance {
  beforeRamadan: number
  duringRamadan: number
  afterRamadan: number
}

export interface EmailCulturalMetrics {
  languagePerformance: LanguagePerformance[]
  culturalElements: CulturalElements
  ramadanPerformance: RamadanPerformance
}

export interface OptimalSendTime {
  hour: number
  effectiveness: number
  volume: number
}

export interface PrayerTimeImpact {
  prayer: PrayerTime
  beforePrayer: number
  afterPrayer: number
}

export interface WeekdayPerformance {
  day: Weekday
  effectiveness: number
  volume: number
}

export interface TimingMetrics {
  optimalSendTimes: OptimalSendTime[]
  prayerTimeImpact: PrayerTimeImpact[]
  businessHoursCompliance: number
  weekdayPerformance: WeekdayPerformance[]
}

export interface ABTestVariant {
  name: string
  type: TestVariantType
  openRate: number
  clickRate: number
  responseRate: number
  sampleSize: number
}

export interface ABTest {
  testId: string
  name: string
  status: ABTestStatus
  variants: ABTestVariant[]
  winner?: string
  confidence?: number
  startDate: string
  endDate?: string
}

export interface EmailMetrics {
  overview: EmailOverviewMetrics
  deliverability: DeliverabilityMetrics
  engagement: EngagementMetrics
  cultural: EmailCulturalMetrics
  timing: TimingMetrics
  abTests: ABTest[]
}

// ===== API INTERFACES =====
export interface AnalyticsApiRequest {
  companyId: string
  dateRange: DateRange
  startDate?: string
  endDate?: string
  sequenceId?: string
  templateId?: string
  locale?: LanguageCode
}

export interface AnalyticsApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface ExportRequest {
  format: 'pdf' | 'excel' | 'csv'
  section: 'comprehensive' | 'sequences' | 'emails' | 'cultural' | 'executive' | 'optimization' | 'deliverability' | 'revenue'
  dateRange: DateRange
  companyId: string
  includeCharts?: boolean
  includeRecommendations?: boolean
}

// ===== COMPONENT PROPS =====
export interface AnalyticsDashboardProps {
  companyId: string
  dateRange?: string
  locale?: string
}

export interface SequencePerformanceProps {
  sequenceId?: string
  dateRange?: string
  companyId?: string
}

export interface EmailAnalyticsProps {
  companyId: string
  dateRange?: string
  templateId?: string
}

// ===== UTILITY TYPES =====
export interface MetricCardProps {
  title: string
  value: number
  change?: number
  icon: React.ComponentType<any>
  format?: 'number' | 'percentage' | 'currency' | 'days'
  trendData?: Array<{ date: string; value: number }>
  color?: string
}

export interface ChartDataPoint {
  date: string
  [key: string]: string | number
}

export interface FilterOptions {
  dateRange: DateRange
  startDate?: Date
  endDate?: Date
  sequenceTypes?: string[]
  templateIds?: string[]
  emirates?: UAEEmirate[]
  languages?: LanguageCode[]
}

// ===== CULTURAL COMPLIANCE TYPES =====
export interface UAEBusinessHours {
  sunday: { start: number; end: number }
  monday: { start: number; end: number }
  tuesday: { start: number; end: number }
  wednesday: { start: number; end: number }
  thursday: { start: number; end: number }
  friday: { start?: number; end?: number } // Optional for half day
  saturday: { start?: number; end?: number } // Optional for half day
}

export interface IslamicHoliday {
  name: string
  startDate: string
  endDate: string
  description: string
  impact: 'full' | 'partial' | 'none'
}

export interface CulturalComplianceReport {
  score: number
  breakdown: {
    businessHours: number
    prayerTimes: number
    holidays: number
    language: number
    tone: number
  }
  violations: Array<{
    type: string
    description: string
    severity: 'high' | 'medium' | 'low'
    recommendation: string
  }>
  improvements: Array<{
    area: string
    currentScore: number
    potentialScore: number
    actions: string[]
  }>
}

// ===== REAL-TIME ANALYTICS TYPES =====
export interface RealTimeMetrics {
  timestamp: string
  emailsInProgress: number
  currentResponseRate: number
  todaysRevenue: number
  activeCampaigns: number
  cultureComplianceScore: number
}

export interface AlertRule {
  id: string
  name: string
  metric: string
  condition: 'above' | 'below' | 'equals'
  threshold: number
  enabled: boolean
  recipients: string[]
}

export interface AnalyticsAlert {
  id: string
  ruleId: string
  triggered: string
  metric: string
  currentValue: number
  threshold: number
  severity: 'critical' | 'warning' | 'info'
  message: string
  acknowledged: boolean
}

// ===== BENCHMARKING TYPES =====
export interface IndustryBenchmark {
  metric: string
  industryAverage: number
  topQuartile: number
  yourValue: number
  percentile: number
  trend: 'improving' | 'declining' | 'stable'
}

export interface CompetitiveAnalysis {
  market: 'UAE' | 'GCC' | 'MENA'
  metrics: IndustryBenchmark[]
  insights: string[]
  recommendations: string[]
}

// ===== PREDICTIVE ANALYTICS TYPES =====
export interface Forecast {
  metric: string
  current: number
  predicted: Array<{
    date: string
    value: number
    confidence: number
  }>
  factors: Array<{
    name: string
    impact: number
    trend: 'positive' | 'negative' | 'neutral'
  }>
}

export interface PredictiveInsights {
  revenue: Forecast
  responseRate: Forecast
  cultureScore: Forecast
  recommendations: Array<{
    action: string
    expectedImpact: string
    confidence: number
    timeline: string
  }>
}

// ===== ADVANCED ANALYTICS TYPES =====
export interface CohortAnalysis {
  cohorts: Array<{
    cohortDate: string
    size: number
    responseRates: number[]
    cumulativeRevenue: number[]
    retention: number[]
  }>
  insights: string[]
}

export interface AttributionModel {
  touchpoints: Array<{
    channel: string
    contribution: number
    firstTouch: number
    lastTouch: number
    linearAttribution: number
  }>
  conversionPaths: Array<{
    path: string[]
    frequency: number
    conversionRate: number
    averageRevenue: number
  }>
}

// Re-export all types for easy importing
export type {
  // Main analytics interfaces
  DashboardMetrics,
  PerformanceData,
  EmailMetrics,
  
  // API interfaces
  AnalyticsApiRequest,
  AnalyticsApiResponse,
  ExportRequest,
  
  // Component props
  AnalyticsDashboardProps,
  SequencePerformanceProps,
  EmailAnalyticsProps,
  MetricCardProps,
  
  // Utility types
  FilterOptions,
  ChartDataPoint,
  
  // Cultural compliance
  CulturalComplianceReport,
  UAEBusinessHours,
  IslamicHoliday,
  
  // Advanced analytics
  RealTimeMetrics,
  AlertRule,
  AnalyticsAlert,
  IndustryBenchmark,
  CompetitiveAnalysis,
  Forecast,
  PredictiveInsights,
  CohortAnalysis,
  AttributionModel
}