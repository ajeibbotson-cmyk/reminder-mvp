import { 
  Invoice, 
  Customer, 
  FollowUpSequence, 
  User, 
  Company, 
  InvoiceStatus,
  Payment,
  Activity,
  ImportBatch,
  ImportError,
  EmailTemplate,
  EmailLog,
  ImportBatchStatus,
  EmailTemplateType,
  EmailDeliveryStatus
} from '@prisma/client'

// Extended types for store usage
export type InvoiceWithDetails = Invoice & {
  customer: Customer
  company: Company
  payments: Payment[]
}

export type CustomerWithInvoices = Customer & {
  invoices: Invoice[]
}

export type UserWithCompany = User & {
  company: Company
}

// Store states
export interface InvoiceState {
  invoices: InvoiceWithDetails[]
  loading: boolean
  error: string | null
  totalCount: number

  // Actions
  fetchInvoices: (filters?: InvoiceFilters) => Promise<void>
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  getInvoiceById: (id: string) => InvoiceWithDetails | null
  bulkUpdateStatus: (invoiceIds: string[], status: InvoiceStatus) => Promise<BulkActionResult>
  clearError: () => void
}

export interface CustomerState {
  customers: CustomerWithInvoices[]
  loading: boolean
  error: string | null
  totalCount: number
  
  // Actions
  fetchCustomers: (companyId: string) => Promise<void>
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Customer>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  getCustomerById: (id: string) => CustomerWithInvoices | null
  getCustomerByEmail: (email: string) => CustomerWithInvoices | null
  clearError: () => void
}

export interface FollowUpSequenceState {
  sequences: FollowUpSequence[]
  loading: boolean
  error: string | null
  
  // Actions
  fetchSequences: (companyId: string) => Promise<void>
  addSequence: (sequence: Omit<FollowUpSequence, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FollowUpSequence>
  updateSequence: (id: string, updates: Partial<FollowUpSequence>) => Promise<void>
  deleteSequence: (id: string) => Promise<void>
  toggleSequenceActive: (id: string) => Promise<void>
  clearError: () => void
}

export interface UserState {
  currentUser: UserWithCompany | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchCurrentUser: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  clearError: () => void
}

export interface ActivityState {
  activities: Activity[]
  loading: boolean
  error: string | null
  
  // Actions
  fetchActivities: (companyId: string, limit?: number) => Promise<void>
  logActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>
  clearError: () => void
}

// Filter and pagination types
export interface InvoiceFilters {
  status?: InvoiceStatus
  customerEmail?: string
  startDate?: Date
  endDate?: Date
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  limit?: number
}

export interface PaginationResult<T> {
  data: T[]
  totalCount: number
  page: number
  limit: number
  hasMore: boolean
}

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  message: string
  code?: string
  field?: string
}

// Week 2 Enhancement: Import Batch types
export type ImportBatchWithDetails = ImportBatch & {
  user: User
  company: Company
  importErrors: ImportError[]
  invoices: Invoice[]
}

export interface ImportBatchState {
  batches: ImportBatchWithDetails[]
  currentBatch: ImportBatchWithDetails | null
  progress: ImportProgress | null
  loading: boolean
  error: string | null
  totalCount: number
  
  // Actions
  fetchBatches: (companyId: string, filters?: ImportBatchFilters) => Promise<void>
  createBatch: (batch: Omit<ImportBatch, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ImportBatch>
  getBatchById: (id: string) => Promise<ImportBatchWithDetails | null>
  getBatchProgress: (batchId: string) => Promise<ImportProgress | null>
  startProcessing: (batchId: string, options?: ProcessingOptions) => Promise<void>
  cancelBatch: (batchId: string) => Promise<void>
  clearError: () => void
  clearProgress: () => void
}

export interface ImportProgress {
  importBatchId: string
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  currentRecord?: number
  status: ImportBatchStatus
  errors: ImportProcessingError[]
  startTime: Date
  estimatedCompletion?: Date
  processingRate?: number
}

export interface ImportProcessingError {
  rowNumber: number
  errorType: string
  errorMessage: string
  fieldName?: string
  attemptedValue?: string
  suggestion?: string
  csvData: Record<string, unknown>
}

export interface ImportBatchFilters {
  status?: ImportBatchStatus
  importType?: string
  userId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

export interface ProcessingOptions {
  chunkSize?: number
  validateOnly?: boolean
  rollbackOnError?: boolean
}

// Week 2 Enhancement: Email Template types
export type EmailTemplateWithDetails = EmailTemplate & {
  user: User
  company: Company
  emailLogs: EmailLog[]
}

export interface EmailTemplateState {
  templates: EmailTemplateWithDetails[]
  currentTemplate: EmailTemplateWithDetails | null
  loading: boolean
  error: string | null
  totalCount: number
  
  // Actions
  fetchTemplates: (companyId: string, filters?: EmailTemplateFilters) => Promise<void>
  createTemplate: (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<EmailTemplate>
  updateTemplate: (id: string, updates: Partial<EmailTemplate>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  duplicateTemplate: (id: string, newName: string) => Promise<EmailTemplate>
  setAsDefault: (id: string, templateType: EmailTemplateType) => Promise<void>
  getTemplateById: (id: string) => EmailTemplateWithDetails | null
  clearError: () => void
}

export interface EmailTemplateFilters {
  templateType?: EmailTemplateType
  isActive?: boolean
  isDefault?: boolean
  language?: 'ENGLISH' | 'ARABIC'
  search?: string
  page?: number
  limit?: number
}

// Week 2 Enhancement: Email Delivery types
export type EmailLogWithDetails = EmailLog & {
  emailTemplates?: EmailTemplate
  invoices?: Invoice
  customers?: Customer
  company: Company
}

export interface EmailDeliveryState {
  emailLogs: EmailLogWithDetails[]
  analytics: EmailAnalytics | null
  loading: boolean
  error: string | null
  totalCount: number
  
  // Actions
  fetchEmailLogs: (companyId: string, filters?: EmailDeliveryFilters) => Promise<void>
  sendEmail: (emailData: SendEmailData) => Promise<string>
  trackEmailEvent: (emailLogId: string, eventType: EmailEventType, eventData?: Record<string, any>) => Promise<void>
  getAnalytics: (companyId: string, options?: AnalyticsOptions) => Promise<EmailAnalytics>
  resendEmail: (emailLogId: string) => Promise<string>
  clearError: () => void
  clearAnalytics: () => void
}

export interface EmailDeliveryFilters {
  templateId?: string
  invoiceId?: string
  customerId?: string
  recipientEmail?: string
  deliveryStatus?: EmailDeliveryStatus
  language?: 'ENGLISH' | 'ARABIC'
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

export interface SendEmailData {
  templateId?: string
  companyId: string
  invoiceId?: string
  customerId?: string
  recipientEmail: string
  recipientName?: string
  subject?: string
  content?: string
  language?: 'ENGLISH' | 'ARABIC'
  variables?: Record<string, any>
  scheduleForBusinessHours?: boolean
  delayMinutes?: number
}

export type EmailEventType = 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'UNSUBSCRIBED'

export interface EmailAnalytics {
  period: {
    daysBack: number
    startDate: string
    endDate: string
  }
  kpis: {
    deliveryRate: number
    openRate: number
    clickThroughRate: number
    bounceRate: number
    complaintRate: number
    unsubscribeRate: number
    businessHoursSendRate: number
    arabicContentUsage: number
  }
  trends: {
    deliveryRateTrend: TrendData
    openRateTrend: TrendData
    clickRateTrend: TrendData
    bounceRateTrend: TrendData
  }
  overallStats: {
    totalSent: number
    totalDelivered: number
    totalOpened: number
    totalClicked: number
    totalBounced: number
    totalComplaints: number
    totalUnsubscribed: number
    arabicEmails: number
  }
  templatePerformance: TemplatePerformance[]
  recommendations: string[]
}

export interface TrendData {
  direction: 'up' | 'down' | 'neutral'
  percentage: number
}

export interface TemplatePerformance {
  templateId: string
  templateName: string
  templateType: EmailTemplateType
  sent: number
  delivered: number
  opened: number
  clicked: number
  deliveryRate: number
  openRate: number
  clickRate: number
}

export interface AnalyticsOptions {
  days?: number
  templateId?: string
  templateType?: EmailTemplateType
}

// Enhanced invoice state with VAT support
export interface EnhancedInvoiceState extends InvoiceState {
  // VAT calculation methods
  calculateVAT: (lineItems: InvoiceLineItem[], currency?: string) => Promise<VATCalculationResult>
  recalculateInvoiceVAT: (invoiceId: string) => Promise<void>
  
  // Bulk operations
  bulkUpdateStatus: (invoiceIds: string[], status: InvoiceStatus) => Promise<BulkActionResult>
  bulkSendReminders: (invoiceIds: string[], templateId: string) => Promise<BulkActionResult>
  bulkDelete: (invoiceIds: string[]) => Promise<BulkActionResult>
  bulkExport: (invoiceIds: string[], format?: 'csv' | 'xlsx' | 'pdf') => Promise<ExportResult>
}

export interface InvoiceLineItem {
  description: string
  descriptionAr?: string
  quantity: number
  unitPrice: number
  total: number
  vatRate?: number
  vatAmount?: number
  totalWithVat?: number
  taxCategory?: 'STANDARD' | 'EXEMPT' | 'ZERO_RATED'
}

export interface VATCalculationResult {
  subtotal: number
  totalVatAmount: number
  grandTotal: number
  lineItems: CalculatedLineItem[]
  vatBreakdown: Record<string, VATBreakdownItem>
}

export interface CalculatedLineItem extends InvoiceLineItem {
  lineTotal: number
  vatAmount: number
  totalWithVat: number
}

export interface VATBreakdownItem {
  rate: number
  taxableAmount: number
  vatAmount: number
}

export interface BulkActionResult {
  action: string
  requestedCount: number
  processedCount: number
  successCount: number
  failureCount: number
  results: any[]
  errors: string[]
}

export interface ExportResult {
  exportId: string
  format: string
  recordCount: number
  generatedAt: string
  downloadUrl?: string
  data?: any[]
  summary: {
    totalAmount: number
    totalPaid: number
    totalOutstanding: number
    statusBreakdown: Record<string, number>
  }
}