/**
 * Invoice Management Types
 * TypeScript definitions for Reminder invoice system
 */

import { 
  Invoice, 
  InvoiceItem, 
  Customer, 
  Payment, 
  InvoiceStatus, 
  PaymentMethod,
  ImportBatch,
  ImportBatchStatus,
  ImportType,
  ImportError,
  ImportErrorType 
} from '@prisma/client'

// Extended Invoice with relations
export interface InvoiceWithDetails extends Invoice {
  customer?: Customer
  invoice_items: InvoiceItem[]
  payments: Payment[]
  _count?: {
    payments: number
  }
}


// Invoice filters for dashboard
export interface InvoiceFilters {
  status?: InvoiceStatus[]
  customerName?: string
  customerEmail?: string
  dueDateFrom?: Date | string
  dueDateTo?: Date | string
  amountFrom?: number
  amountTo?: number
  currency?: string
  search?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'dueDate' | 'amount' | 'number'
  sortOrder?: 'asc' | 'desc'
}

// Invoice dashboard statistics
export interface InvoiceDashboardStats {
  total_count: number
  total_amount: number
  paid_amount: number
  overdue_amount: number
  draft_count: number
  sent_count: number
  overdue_count: number
  paid_count: number
  disputed_count: number
  written_off_count: number
  average_payment_time: number // days
  payment_rate: number // percentage
}

// Bulk action types
export type BulkActionType = 
  | 'mark_sent'
  | 'mark_overdue' 
  | 'mark_paid'
  | 'delete'
  | 'send_reminder'
  | 'export_pdf'
  | 'export_csv'

export interface BulkActionPayload {
  action: BulkActionType
  invoice_ids: string[]
  additional_data?: Record<string, any>
}

// Payment recording
export interface CreatePaymentFormData {
  invoice_id: string
  amount: number
  payment_date: Date | string
  method: PaymentMethod
  reference?: string
  notes?: string
}

// CSV Import types
export interface CSVImportPreview {
  headers: string[]
  sample_rows: string[][]
  total_rows: number
  detected_delimiter: ',' | ';' | '\t'
}

export interface CSVFieldMapping {
  csv_column: string
  system_field: string
  data_type: 'string' | 'number' | 'date' | 'email' | 'currency'
  is_required: boolean
  default_value?: string
  validation_rule?: string
  transformation?: string
}

export interface CSVImportConfig {
  file_name: string
  total_rows: number
  field_mappings: CSVFieldMapping[]
  import_type: ImportType
  skip_header_row: boolean
  create_missing_customers: boolean
  update_existing_invoices: boolean
}

// Import batch with details
export interface ImportBatchWithDetails extends ImportBatch {
  import_errors: ImportError[]
  invoices: Invoice[]
  _count: {
    invoices: number
    import_errors: number
  }
}

// UAE-specific validation types
export interface UAEValidationRules {
  trn_format: RegExp
  business_hours: {
    start_hour: number
    end_hour: number
    working_days: number[] // 0-6, Sunday=0
  }
  vat_rate: number
  currency_codes: string[]
  phone_format: RegExp
}

// Invoice status transitions
export interface StatusTransition {
  from: InvoiceStatus
  to: InvoiceStatus
  allowed: boolean
  requires_confirmation?: boolean
  confirmation_message?: string
}

// Export types
export interface ExportConfig {
  format: 'pdf' | 'csv' | 'xlsx'
  invoice_ids?: string[]
  filters?: InvoiceFilters
  include_items?: boolean
  include_payments?: boolean
  template?: string
}

// API Response types
export interface InvoiceListResponse {
  invoices: InvoiceWithDetails[]
  total_count: number
  page: number
  limit: number
  has_next: boolean
  has_previous: boolean
}


export interface BulkActionResponse {
  success: boolean
  processed_count: number
  failed_count: number
  errors?: Array<{
    invoice_id: string
    error: string
  }>
}

export interface ImportPreviewResponse {
  success: boolean
  preview?: CSVImportPreview
  error?: string
}

export interface ImportValidationResponse {
  success: boolean
  validation_errors?: Array<{
    row: number
    field: string
    error: string
    value: any
  }>
  warnings?: Array<{
    row: number
    field: string
    warning: string
    value: any
  }>
}


// Currency formatting options
export interface CurrencyFormatOptions {
  currency: string
  locale: string
  show_symbol: boolean
  decimal_places: number
}

// Default values and constants
export const DEFAULT_UAE_VAT_RATE = 5.00
export const DEFAULT_CURRENCY = 'AED'
export const DEFAULT_LOCALE = 'en-AE'

export const UAE_TRN_REGEX = /^[0-9]{15}$/
export const UAE_PHONE_REGEX = /^(\+971|0)?[5-9][0-9]{8}$/

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'gray',
  SENT: 'blue',
  OVERDUE: 'red',
  PAID: 'green',
  DISPUTED: 'orange',
  WRITTEN_OFF: 'gray'
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT_CARD: 'Credit Card',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  OTHER: 'Other'
}

// Status transition rules
export const STATUS_TRANSITIONS: StatusTransition[] = [
  { from: 'DRAFT', to: 'SENT', allowed: true },
  { from: 'SENT', to: 'OVERDUE', allowed: true },
  { from: 'SENT', to: 'PAID', allowed: true },
  { from: 'SENT', to: 'DISPUTED', allowed: true },
  { from: 'OVERDUE', to: 'PAID', allowed: true },
  { from: 'OVERDUE', to: 'DISPUTED', allowed: true },
  { from: 'OVERDUE', to: 'WRITTEN_OFF', allowed: true, requires_confirmation: true },
  { from: 'DISPUTED', to: 'PAID', allowed: true },
  { from: 'DISPUTED', to: 'WRITTEN_OFF', allowed: true, requires_confirmation: true },
  { from: 'PAID', to: 'DISPUTED', allowed: true, requires_confirmation: true }
]

// Enhanced API types for comprehensive invoice management

// Enhanced invoice response with computed fields
export interface EnhancedInvoiceResponse extends InvoiceWithDetails {
  // Computed UAE business fields
  paidAmount?: number
  remainingAmount?: number
  isOverdue?: boolean
  daysPastDue?: number
  isFullyPaid?: boolean
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID'
  
  // Formatted amounts for UAE display
  formattedAmounts?: {
    subtotal: string
    vatAmount: string
    totalAmount: string
    paidAmount: string
    remainingAmount: string
  }
  
  // VAT breakdown for compliance
  vatSummary?: {
    standardRate: InvoiceItem[]
    zeroRated: InvoiceItem[]
    exempt: InvoiceItem[]
  }
}

// Enhanced invoice list response with insights
export interface EnhancedInvoiceListResponse {
  invoices: EnhancedInvoiceResponse[]
  pagination: {
    totalCount: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
    hasPrevious: boolean
  }
  statusCounts: Record<InvoiceStatus, number>
  insights: {
    totalOutstanding: number
    totalOverdue: number
    overdueCount: number
    recentInvoicesCount: number
    averageAmount: number
    formatted: {
      totalOutstanding: string
      totalOverdue: string
    }
  }
  filters: {
    applied: string[]
    companyId: string
  }
}

// Status change request and response types
export interface StatusChangeRequest {
  status: InvoiceStatus
  reason?: string
  notes?: string
  notifyCustomer?: boolean
}

export interface StatusChangeResponse extends EnhancedInvoiceResponse {
  statusChange: {
    from: InvoiceStatus
    to: InvoiceStatus
    reason: string
    notes?: string
    changedAt: string
    changedBy: string
  }
  suggestedActions: string[]
  customerNotified: boolean
}

// Bulk operation enhanced types
export interface EnhancedBulkActionPayload {
  invoiceIds: string[]
  action: 'update_status' | 'delete' | 'send_reminder' | 'export'
  status?: InvoiceStatus
  emailTemplateId?: string
}

export interface EnhancedBulkActionResponse {
  action: string
  requestedCount: number
  processedCount: number
  successCount: number
  failedCount: number
  details: Array<{
    invoiceId: string
    invoiceNumber: string
    customerName?: string
    status: 'success' | 'failed' | 'skipped'
    reason?: string
    previousStatus?: InvoiceStatus
    newStatus?: InvoiceStatus
    amount?: string
    customerEmail?: string
    deletedAmount?: string
  }>
  errors: string[]
  totalAmount?: string
  summary?: {
    totalAmount: number
    totalPaid: number
    totalOutstanding: number
    statusBreakdown: Record<string, number>
  }
}

// Enhanced filters for comprehensive searching
export interface EnhancedInvoiceFilters extends InvoiceFilters {
  dueDateFrom?: Date | string
  dueDateTo?: Date | string
  trnNumber?: string
  isOverdue?: boolean
  hasPayments?: boolean
  includeAllPayments?: boolean
}

// UAE business validation types
export interface UAEBusinessValidation {
  valid: boolean
  reason?: string
  complianceNote?: string
}

// Email notification types
export interface EmailNotificationConfig {
  templateId: string
  recipientEmail: string
  recipientName: string
  subject: string
  variables: Record<string, string>
  language: 'ENGLISH' | 'ARABIC'
  scheduleForBusinessHours: boolean
}

// Export configuration with UAE features
export interface UAEExportConfig extends ExportConfig {
  includeArabicFields?: boolean
  includeVATBreakdown?: boolean
  includeTRN?: boolean
  businessHoursOnly?: boolean
  complianceNotes?: boolean
}

// Comprehensive validation error type
export interface ValidationError {
  field: string
  message: string
  code: string
  value?: any
}

// API response wrapper with enhanced error handling
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  validationErrors?: ValidationError[]
  code?: string
}


// Activity logging for audit trail
export interface ActivityLogEntry {
  id: string
  companyId: string
  userId: string
  type: string
  description: string
  metadata: {
    invoiceId?: string
    invoiceNumber?: string
    customerName?: string
    customerEmail?: string
    amount?: string
    currency?: string
    previousStatus?: InvoiceStatus
    newStatus?: InvoiceStatus
    totalAmount?: string
    userAgent?: string
    ipAddress?: string
    complianceNote?: string
    [key: string]: any
  }
  createdAt: Date
}

// Business insights calculation
export interface BusinessInsights {
  totalOutstanding: number
  totalOverdue: number
  overdueCount: number
  recentInvoicesCount: number
  averageAmount: number
  paymentRate: number
  averagePaymentTime: number
  formatted: {
    totalOutstanding: string
    totalOverdue: string
  }
}

// UAE business hours configuration
export interface UAEBusinessHours {
  timezone: string
  workingDays: number[]
  startHour: number
  endHour: number
  allowWeekends: boolean
  allowHolidays: boolean
}

// Default UAE business configuration
export const DEFAULT_UAE_BUSINESS_HOURS: UAEBusinessHours = {
  timezone: 'Asia/Dubai',
  workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
  startHour: 8,
  endHour: 18,
  allowWeekends: false,
  allowHolidays: false
}

// Enhanced constants
export const UAE_SUPPORTED_CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR'] as const
export const UAE_TAX_CATEGORIES = ['STANDARD', 'EXEMPT', 'ZERO_RATED'] as const

export type UAESupportedCurrency = typeof UAE_SUPPORTED_CURRENCIES[number]
export type UAETaxCategory = typeof UAE_TAX_CATEGORIES[number]