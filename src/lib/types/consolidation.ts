/**
 * TypeScript interfaces for customer consolidation functionality
 * Used throughout the consolidation system for type safety and consistency
 */

export interface ConsolidationCandidate {
  customerId: string
  customerName: string
  customerEmail: string
  companyName?: string
  overdueInvoices: ConsolidatedInvoice[]
  totalAmount: number
  currency: string
  oldestInvoiceDays: number
  lastContactDate?: Date
  nextEligibleContact: Date
  priorityScore: number
  escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  canContact: boolean
  consolidationReason: string
  customerPreferences: {
    consolidationPreference: 'ENABLED' | 'DISABLED' | 'AUTO'
    maxConsolidationAmount?: number
    preferredContactInterval: number
  }
}

export interface ConsolidatedInvoice {
  id: string
  number: string
  amount: number
  currency: string
  issueDate: Date
  dueDate: Date
  daysOverdue: number
  description?: string
  customerName: string
  customerEmail: string
  status: 'SENT' | 'OVERDUE' | 'DISPUTED'
}

export interface ConsolidatedReminder {
  id: string
  customerId: string
  companyId: string
  invoiceIds: string[]
  totalAmount: number
  currency: string
  invoiceCount: number
  reminderType: 'CONSOLIDATED' | 'URGENT_CONSOLIDATED' | 'FINAL_CONSOLIDATED' | 'MANUAL_CONSOLIDATED'
  escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  templateId?: string
  scheduledFor?: Date
  sentAt?: Date
  deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED' | 'FAILED'
  lastContactDate?: Date
  nextEligibleContact?: Date
  contactIntervalDays: number
  priorityScore: number
  consolidationReason?: string
  businessRules: ConsolidationBusinessRules
  culturalCompliance: ConsolidationCulturalCompliance
  responseTracking: ConsolidationResponseTracking
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface ConsolidationBusinessRules {
  minInvoicesRequired: number
  maxInvoicesAllowed: number
  contactIntervalDays: number
  escalationLevel: string
  priorityScore: number
  totalInvoicesConsolidated: number
  consolidationReason: string
  amountThreshold?: number
  daysSinceLastContact?: number
}

export interface ConsolidationCulturalCompliance {
  uaeBusinessHours: boolean
  islamicCalendarChecked: boolean
  prayerTimesAvoided: boolean
  ramadanSensitivity: boolean
  culturalToneApplied: boolean
  languagePreferenceRespected: boolean
  businessCustomsRespected: boolean
}

export interface ConsolidationResponseTracking {
  emailOpenedAt?: Date
  emailClickedAt?: Date
  customerRespondedAt?: Date
  paymentReceivedAt?: Date
  awsMessageId?: string
  bounceReason?: string
  complaintFeedback?: string
  engagementScore?: number
}

export interface ConsolidationMetrics {
  totalCandidates: number
  eligibleForConsolidation: number
  consolidationRate: number
  emailsSaved: number
  averageInvoicesPerConsolidation: number
  priorityDistribution: Record<string, number>
  effectivenessMetrics: {
    openRate: number
    clickRate: number
    responseRate: number
    paymentRate: number
  }
  volumeReduction: {
    emailsSaved: number
    percentageReduction: number
    periodComparison: {
      individual: number
      consolidated: number
    }
  }
}

export interface ConsolidatedEmailOptions {
  consolidatedReminderId: string
  customerId: string
  invoiceIds: string[]
  templateId: string
  totalAmount: number
  currency: string
  escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  attachmentSettings: {
    includeIndividualInvoices: boolean
    includeConsolidatedStatement: boolean
    maxAttachmentSize: number // in MB
  }
  schedulingOptions: {
    respectBusinessHours: boolean
    avoidHolidays: boolean
    avoidPrayerTimes: boolean
    scheduledFor?: Date
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  }
  trackingOptions: {
    enableOpenTracking: boolean
    enableClickTracking: boolean
    enableDeliveryTracking: boolean
  }
}

export interface ConsolidationEmailContent {
  subject: string
  content: string
  language: 'en' | 'ar'
  variables: ConsolidatedTemplateVariables
}

export interface ConsolidatedTemplateVariables {
  // Customer variables
  customer_name: string
  customer_company?: string
  customer_email: string
  contact_person?: string

  // Consolidation variables
  invoice_list: Array<{
    number: string
    amount: number
    currency: string
    issue_date: string
    due_date: string
    days_overdue: number
    description?: string
  }>
  total_amount: number
  total_currency: string
  invoice_count: number
  oldest_invoice_days: number

  // Company variables
  company_name: string
  company_trn?: string
  company_address?: string
  company_phone?: string
  company_email?: string

  // Formatting helpers
  formatted_total: string

  // Escalation context
  escalation_level: string
  urgency_indicator?: string

  // Cultural context
  language: 'en' | 'ar'
  is_arabic: boolean
  business_greeting: string
  professional_closing: string
  cultural_tone: string
}

export interface BulkConsolidationRequest {
  customerIds: string[]
  scheduledFor?: Date
  templateOverride?: string
  escalationLevelOverride?: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  priorityOverride?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  attachmentSettings?: ConsolidatedEmailOptions['attachmentSettings']
  schedulingOptions?: ConsolidatedEmailOptions['schedulingOptions']
  trackingOptions?: ConsolidatedEmailOptions['trackingOptions']
}

export interface BulkOperationResult {
  total: number
  successful: number
  failed: number
  results: Array<{
    customerId: string
    success: boolean
    consolidationId?: string
    error?: string
    scheduledFor?: Date
  }>
  summary: {
    emailsSaved: number
    totalInvoicesConsolidated: number
    estimatedDeliveryTime?: Date
  }
}

export interface ConsolidationQueueFilters {
  priority: 'all' | 'high' | 'medium' | 'low'
  escalationLevel: 'all' | 'polite' | 'firm' | 'urgent' | 'final'
  contactEligibility: 'all' | 'eligible' | 'waiting'
  minAmount?: number
  maxAmount?: number
  searchQuery: string
  dateRange?: {
    from: Date
    to: Date
  }
  customerSegment?: 'all' | 'high_value' | 'frequent' | 'at_risk'
}

export interface ConsolidationDashboardData {
  queueSummary: {
    totalCustomers: number
    eligibleCustomers: number
    totalOutstanding: number
    emailsSaved: number
    avgPriorityScore: number
  }
  recentActivity: Array<{
    id: string
    customerId: string
    customerName: string
    action: 'sent' | 'opened' | 'clicked' | 'responded' | 'paid'
    timestamp: Date
    invoiceCount: number
    amount: number
  }>
  upcomingScheduled: ConsolidatedReminder[]
  effectivenessMetrics: ConsolidationMetrics
}

export interface CustomerConsolidationHistory {
  customerId: string
  customerName: string
  totalConsolidations: number
  lastConsolidationDate?: Date
  consolidations: Array<{
    id: string
    sentAt?: Date
    invoiceCount: number
    totalAmount: number
    deliveryStatus: string
    responseReceived: boolean
    paymentReceived: boolean
  }>
  paymentBehavior: {
    averagePaymentDelay: number
    paymentRate: number
    lastPaymentDate?: Date
  }
}

// Error types for consolidation operations
export class ConsolidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ConsolidationError'
  }
}

export class ContactIntervalError extends ConsolidationError {
  constructor(customerId: string, nextEligibleDate: Date) {
    super(
      `Customer ${customerId} is in waiting period until ${nextEligibleDate.toISOString()}`,
      'CONTACT_INTERVAL_VIOLATION',
      { customerId, nextEligibleDate }
    )
  }
}

export class InsufficientInvoicesError extends ConsolidationError {
  constructor(customerId: string, invoiceCount: number, required: number) {
    super(
      `Customer ${customerId} has ${invoiceCount} invoices, minimum ${required} required for consolidation`,
      'INSUFFICIENT_INVOICES',
      { customerId, invoiceCount, required }
    )
  }
}

export class ConsolidationPreferenceError extends ConsolidationError {
  constructor(customerId: string, preference: string) {
    super(
      `Customer ${customerId} has consolidation disabled (preference: ${preference})`,
      'CONSOLIDATION_DISABLED',
      { customerId, preference }
    )
  }
}

// Utility types for API responses
export interface ConsolidationApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
  timestamp: string
}

export interface PaginatedConsolidationResponse<T> extends ConsolidationApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}