// Follow-up Dashboard Types
// These types define the data structures used across all follow-up automation components

export interface SequenceStatus {
  id: string
  name: string
  sequenceType: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR' | 'SCHEDULED' | 'DRAFT'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  active: boolean
  createdAt: Date
  updatedAt: Date
  lastActivity: Date
  nextScheduled?: Date
}

export interface SequenceProgress {
  totalInvoices: number
  completed: number
  inProgress: number
  pending: number
  errors: number
}

export interface SequencePerformance {
  emailsSent: number
  emailsDelivered: number
  emailsOpened: number
  emailsClicked: number
  responseRate: number
  conversionRate: number
  paymentReceived: number
  averageResponseTime: number // in hours
  bounceRate: number
  unsubscribeRate: number
}

export interface UAEComplianceMetrics {
  businessHoursCompliance: number // percentage
  holidayRespect: number // percentage
  prayerTimeAvoidance: number // percentage
  culturalAppropriatenesScore: number // percentage
}

export interface SequenceStepPerformance {
  stepOrder: number
  stepName: string
  stepType: 'EMAIL' | 'WAIT' | 'CONDITION' | 'ACTION'
  emailsSent: number
  responseRate: number
  effectiveness: number
}

export interface TimeSeriesDataPoint {
  date: string
  emailsSent: number
  responseRate: number
  conversionRate: number
  paymentAmount: number
}

export interface SequenceMetricData extends SequenceStatus {
  progress: SequenceProgress
  metrics: SequencePerformance
  timeSeriesData: TimeSeriesDataPoint[]
  stepPerformance: SequenceStepPerformance[]
  uaeMetrics: UAEComplianceMetrics
}

export interface TimelineEvent {
  id: string
  type: 'EMAIL_SENT' | 'EMAIL_OPENED' | 'EMAIL_CLICKED' | 'RESPONSE_RECEIVED' | 'PAYMENT_RECEIVED' |
        'SEQUENCE_PAUSED' | 'SEQUENCE_RESUMED' | 'STEP_SKIPPED' | 'ERROR_OCCURRED'
  timestamp: Date
  sequenceId: string
  sequenceName: string
  stepOrder?: number
  stepName?: string
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  emailSubject?: string
  emailTemplate?: string
  deliveryStatus: 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'PENDING'
  responseDetails?: {
    message?: string
    paymentAmount?: number
    responseTime?: number
  }
  metadata: {
    userAgent?: string
    ipAddress?: string
    emailClient?: string
    deviceType?: string
    location?: string
  }
  uaeCompliance: {
    sentDuringBusinessHours: boolean
    respectedHolidays: boolean
    avoidedPrayerTimes: boolean
  }
}

export interface FollowUpRecord {
  id: string
  emailId: string
  sequenceId: string
  sequenceName: string
  stepOrder: number
  stepName: string
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  subject: string
  templateName?: string
  sentAt: Date
  deliveryStatus: 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'PENDING'
  openedAt?: Date
  clickedAt?: Date
  respondedAt?: Date
  responseMessage?: string
  paymentReceivedAt?: Date
  paymentAmount?: number
  errorMessage?: string
  retryCount: number
  lastRetryAt?: Date
  nextRetryAt?: Date
  tags: string[]
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  uaeCompliance: {
    sentDuringBusinessHours: boolean
    respectedHolidays: boolean
    avoidedPrayerTimes: boolean
  }
  metadata: {
    userAgent?: string
    deviceType?: string
    location?: string
    emailClient?: string
  }
}

export interface ManualOverrideAction {
  id: string
  action: 'PAUSE' | 'RESUME' | 'STOP' | 'SKIP_STEP' | 'RESTART' | 'EMERGENCY_STOP'
  sequenceId?: string
  sequenceIds?: string[]
  initiatedBy: string
  initiatedAt: Date
  reason: string
  options?: Record<string, any>
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  completedAt?: Date
  errorMessage?: string
}

export interface BulkOperationStatus {
  id: string
  operation: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  progress: number
  message?: string
  affectedSequences: number
  startedAt: Date
  completedAt?: Date
  errors?: string[]
}

export interface SequenceHealth {
  overall: 'GOOD' | 'WARNING' | 'CRITICAL'
  issues: Array<{
    type: 'DELIVERY_RATE' | 'RESPONSE_RATE' | 'ERROR_RATE' | 'COMPLIANCE'
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    message: string
    affectedSequences: number
  }>
  recommendations: Array<{
    type: 'PERFORMANCE' | 'COMPLIANCE' | 'MAINTENANCE'
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    message: string
    actionRequired: boolean
  }>
}

export interface DashboardFilters {
  searchQuery: string
  statusFilter: string
  typeFilter: string
  priorityFilter: string
  dateRangeFilter: string
  complianceFilter: string
}

export interface DashboardSettings {
  autoRefresh: boolean
  refreshInterval: number // in milliseconds
  defaultView: 'grid' | 'list' | 'table'
  notificationsEnabled: boolean
  alertThresholds: {
    errorRate: number
    responseRate: number
    deliveryRate: number
  }
  uaeBusinessHours: {
    start: string // HH:mm format
    end: string // HH:mm format
    timezone: string
    workDays: number[] // 0-6, where 0 is Sunday
  }
}

// Utility types for component props
export type SortDirection = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list' | 'table' | 'cards'
export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d' | '1y' | 'all'
export type SequenceAction = 'PAUSE' | 'RESUME' | 'STOP' | 'RESTART' | 'DUPLICATE' | 'DELETE' | 'ARCHIVE'

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface SequenceListResponse extends ApiResponse<SequenceMetricData[]> {
  filters?: DashboardFilters
  health?: SequenceHealth
}

export interface TimelineResponse extends ApiResponse<TimelineEvent[]> {
  hasMore: boolean
  nextCursor?: string
}

export interface HistoryResponse extends ApiResponse<FollowUpRecord[]> {
  summary: {
    totalEmails: number
    deliveryRate: number
    responseRate: number
    conversionRate: number
  }
}