/**
 * UI-specific TypeScript interfaces for consolidation components
 * These interfaces extend the core consolidation types with UI-specific properties
 * and are designed for React component props and state management
 */

import { ConsolidationCandidate, ConsolidatedReminder, ConsolidationMetrics, ConsolidationQueueFilters } from './consolidation'

// =============================================================================
// COMPONENT PROP INTERFACES
// =============================================================================

/**
 * Props for the main consolidation queue component
 */
export interface ConsolidationQueueProps {
  companyId: string
  refreshInterval?: number
  maxCandidatesPerPage?: number
  autoRefresh?: boolean
  onPreviewConsolidation?: (customerId: string) => void
  onSendConsolidation?: (customerIds: string[]) => Promise<void>
  onScheduleConsolidation?: (customerIds: string[], scheduledFor: Date) => Promise<void>
  onBulkAction?: (action: BulkActionType, customerIds: string[]) => Promise<void>
  onFilterChange?: (filters: ConsolidationQueueFilters) => void
  className?: string
}

/**
 * Props for individual customer consolidation cards
 */
export interface CustomerConsolidationCardProps {
  candidate: ConsolidationCandidate
  isSelected?: boolean
  isExpanded?: boolean
  showActions?: boolean
  onSelect?: (customerId: string, selected: boolean) => void
  onExpand?: (customerId: string, expanded: boolean) => void
  onPreview?: (customerId: string) => void
  onSendNow?: (customerId: string) => Promise<void>
  onSchedule?: (customerId: string, scheduledFor: Date) => Promise<void>
  onEditCustomer?: (customerId: string) => void
  className?: string
}

/**
 * Props for consolidation metrics dashboard cards
 */
export interface ConsolidationMetricsCardProps {
  metrics: ConsolidationMetrics
  timeframe: MetricsTimeframe
  comparisonEnabled?: boolean
  onTimeframeChange?: (timeframe: MetricsTimeframe) => void
  onExportData?: () => void
  loading?: boolean
  error?: string | null
  className?: string
}

/**
 * Props for consolidated email preview component
 */
export interface ConsolidatedEmailPreviewProps {
  customerId: string
  templateId?: string
  language?: 'en' | 'ar'
  showAttachments?: boolean
  onSend?: () => Promise<void>
  onSchedule?: (scheduledFor: Date) => Promise<void>
  onTemplateChange?: (templateId: string) => void
  onLanguageChange?: (language: 'en' | 'ar') => void
  onClose?: () => void
  className?: string
}

/**
 * Props for bulk action components
 */
export interface BulkActionPanelProps {
  selectedCustomers: string[]
  availableActions: BulkActionType[]
  onAction?: (action: BulkActionType, customerIds: string[]) => Promise<void>
  onClearSelection?: () => void
  loading?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Props for consolidation filters panel
 */
export interface ConsolidationFiltersProps {
  filters: ConsolidationQueueFilters
  candidateStats: ConsolidationCandidateStats
  onFiltersChange: (filters: ConsolidationQueueFilters) => void
  onResetFilters: () => void
  collapsible?: boolean
  className?: string
}

/**
 * Props for consolidation analytics charts
 */
export interface ConsolidationAnalyticsChartProps {
  data: ConsolidationAnalyticsData
  chartType: 'effectiveness' | 'volume-reduction' | 'priority-distribution' | 'timeline'
  timeframe: MetricsTimeframe
  height?: number
  responsive?: boolean
  onDataPointClick?: (dataPoint: any) => void
  className?: string
}

// =============================================================================
// UI-SPECIFIC STATE INTERFACES
// =============================================================================

/**
 * UI state for consolidation queue management
 */
export interface ConsolidationQueueUIState {
  // Data state
  candidates: ConsolidationCandidate[]
  selectedCustomers: string[]
  expandedCustomers: string[]

  // UI state
  view: 'grid' | 'list' | 'table'
  sortBy: ConsolidationSortField
  sortOrder: 'asc' | 'desc'
  filters: ConsolidationQueueFilters
  searchQuery: string

  // Pagination
  currentPage: number
  itemsPerPage: number
  totalItems: number

  // Loading states
  loading: boolean
  refreshing: boolean
  loadingActions: Set<string> // Customer IDs currently being processed

  // Error handling
  error: string | null
  actionErrors: Record<string, string> // Customer ID -> error message

  // Preview state
  previewCustomerId: string | null
  previewLoading: boolean
  previewError: string | null
}

/**
 * UI state for consolidation analytics
 */
export interface ConsolidationAnalyticsUIState {
  // Data
  metrics: ConsolidationMetrics | null
  historicalData: ConsolidationHistoricalData[]
  chartData: Record<string, ConsolidationAnalyticsData>

  // UI state
  timeframe: MetricsTimeframe
  selectedCharts: string[]
  comparisonMode: boolean
  comparisonTimeframe?: MetricsTimeframe

  // Loading
  loading: boolean
  refreshing: boolean

  // Error handling
  error: string | null

  // Export
  exportInProgress: boolean
  lastExportedAt?: Date
}

/**
 * UI state for email preview and composition
 */
export interface ConsolidationEmailUIState {
  // Preview data
  previewData: ConsolidatedEmailPreviewData | null

  // Template selection
  availableTemplates: ConsolidationEmailTemplate[]
  selectedTemplateId: string | null
  selectedLanguage: 'en' | 'ar'

  // Scheduling
  schedulingMode: boolean
  scheduledFor: Date | null
  scheduleOptions: ScheduleOptions

  // Attachments
  includeAttachments: boolean
  attachmentSettings: AttachmentSettings

  // Loading states
  loading: boolean
  sending: boolean

  // Error handling
  error: string | null
  validationErrors: Record<string, string>
}

// =============================================================================
// SUPPORTING INTERFACES
// =============================================================================

/**
 * Bulk action types for consolidation operations
 */
export type BulkActionType =
  | 'send-now'
  | 'schedule'
  | 'pause'
  | 'resume'
  | 'delete'
  | 'export'
  | 'mark-contacted'
  | 'update-priority'

/**
 * Sort fields for consolidation queue
 */
export type ConsolidationSortField =
  | 'priority'
  | 'total-amount'
  | 'invoice-count'
  | 'oldest-invoice'
  | 'customer-name'
  | 'last-contact'
  | 'next-eligible'

/**
 * Timeframe options for metrics
 */
export type MetricsTimeframe =
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | '1y'
  | 'all'

/**
 * Candidate statistics for filtering UI
 */
export interface ConsolidationCandidateStats {
  total: number
  eligible: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
  politeLevel: number
  firmLevel: number
  urgentLevel: number
  finalLevel: number
  totalOutstanding: number
  averagePriority: number
  contactableToday: number
}

/**
 * Analytics data structure for charts
 */
export interface ConsolidationAnalyticsData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    fill?: boolean
    tension?: number
  }>
  options?: {
    responsive?: boolean
    maintainAspectRatio?: boolean
    plugins?: Record<string, any>
    scales?: Record<string, any>
  }
}

/**
 * Historical data for trend analysis
 */
export interface ConsolidationHistoricalData {
  date: Date
  totalCandidates: number
  emailsSent: number
  emailsSaved: number
  responseRate: number
  effectivenessScore: number
}

/**
 * Email preview data structure
 */
export interface ConsolidatedEmailPreviewData {
  subject: string
  content: string
  plainText: string
  attachments: EmailAttachment[]
  estimatedDeliveryTime: Date
  culturalCompliance: {
    businessHours: boolean
    prayerTimesAvoided: boolean
    culturalTone: boolean
  }
  variables: Record<string, any>
}

/**
 * Email template for consolidation
 */
export interface ConsolidationEmailTemplate {
  id: string
  name: string
  description?: string
  subject: string
  content: string
  language: 'en' | 'ar'
  templateType: 'consolidated' | 'urgent-consolidated' | 'final-consolidated'
  variables: string[]
  maxInvoiceCount?: number
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Email attachment information
 */
export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  url?: string
  isGenerated: boolean
}

/**
 * Schedule options for consolidated emails
 */
export interface ScheduleOptions {
  respectBusinessHours: boolean
  avoidHolidays: boolean
  avoidPrayerTimes: boolean
  preferredTime?: string // HH:mm format
  timezone: string
  maxDelay: number // hours
}

/**
 * Attachment settings for email generation
 */
export interface AttachmentSettings {
  includeIndividualInvoices: boolean
  includeConsolidatedStatement: boolean
  maxTotalSize: number // MB
  compressionLevel: 'none' | 'low' | 'medium' | 'high'
  format: 'pdf' | 'pdf-a'
}

// =============================================================================
// UI COMPONENT STATE INTERFACES
// =============================================================================

/**
 * State for consolidation queue table component
 */
export interface ConsolidationTableState {
  selectedRows: Set<string>
  expandedRows: Set<string>
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  columns: ConsolidationTableColumn[]
  density: 'compact' | 'standard' | 'comfortable'
}

/**
 * Column configuration for consolidation table
 */
export interface ConsolidationTableColumn {
  key: string
  label: string
  sortable: boolean
  filterable: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  visible: boolean
  formatter?: (value: any, row: ConsolidationCandidate) => React.ReactNode
}

/**
 * State for bulk action confirmation dialogs
 */
export interface BulkActionConfirmationState {
  action: BulkActionType | null
  customerIds: string[]
  showConfirmation: boolean
  confirmationData?: {
    title: string
    message: string
    consequences: string[]
    requirements?: string[]
  }
  processing: boolean
  result?: {
    success: boolean
    processed: number
    failed: number
    errors: string[]
  }
}

/**
 * State for consolidation filter panel
 */
export interface ConsolidationFilterPanelState {
  isCollapsed: boolean
  activeFilters: Set<string>
  filterValues: ConsolidationQueueFilters
  presets: ConsolidationFilterPreset[]
  selectedPreset: string | null
  customPresetName: string
  showSavePreset: boolean
}

/**
 * Filter preset for quick filter application
 */
export interface ConsolidationFilterPreset {
  id: string
  name: string
  filters: ConsolidationQueueFilters
  isDefault: boolean
  createdAt: Date
  usage: number
}

// =============================================================================
// RESPONSIVE DESIGN INTERFACES
// =============================================================================

/**
 * Responsive breakpoint configuration
 */
export interface ConsolidationResponsiveConfig {
  mobile: {
    maxWidth: string
    itemsPerPage: number
    view: 'list'
    columnsVisible: string[]
  }
  tablet: {
    maxWidth: string
    itemsPerPage: number
    view: 'grid' | 'list'
    columnsVisible: string[]
  }
  desktop: {
    minWidth: string
    itemsPerPage: number
    view: 'table'
    columnsVisible: string[]
  }
}

/**
 * Mobile-specific consolidation card props
 */
export interface MobileConsolidationCardProps {
  candidate: ConsolidationCandidate
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onViewDetails: () => void
  onQuickAction: (action: 'send' | 'schedule' | 'preview') => void
  compact?: boolean
}

// =============================================================================
// ACCESSIBILITY INTERFACES
// =============================================================================

/**
 * Accessibility configuration for consolidation components
 */
export interface ConsolidationA11yConfig {
  announcements: {
    selectionChange: (count: number) => string
    actionComplete: (action: string, count: number) => string
    errorOccurred: (error: string) => string
    dataUpdated: (newCount: number) => string
  }
  keyboardNavigation: {
    enableArrowKeys: boolean
    enableHomeEnd: boolean
    enablePageUpDown: boolean
    enableSelectAll: boolean
  }
  highContrast: boolean
  reduceMotion: boolean
  screenReaderOptimized: boolean
}

/**
 * Screen reader optimized data structures
 */
export interface ConsolidationScreenReaderData {
  candidateSummary: string
  priorityDescription: string
  escalationDescription: string
  contactStatusDescription: string
  actionDescriptions: Record<string, string>
  tableDescription: string
}

// =============================================================================
// INTERNATIONALIZATION INTERFACES
// =============================================================================

/**
 * UI text keys for consolidation components
 */
export interface ConsolidationUIText {
  queue: {
    title: string
    subtitle: string
    empty: string
    loading: string
    error: string
    refresh: string
    selectAll: string
    clearSelection: string
  }
  candidate: {
    priority: string
    escalation: string
    contactStatus: string
    actions: string
    preview: string
    sendNow: string
    schedule: string
    details: string
  }
  bulkActions: {
    title: string
    send: string
    schedule: string
    pause: string
    resume: string
    delete: string
    export: string
    confirm: string
    cancel: string
  }
  metrics: {
    title: string
    totalCandidates: string
    eligibleCustomers: string
    totalOutstanding: string
    emailsSaved: string
    effectiveness: string
  }
  filters: {
    title: string
    priority: string
    escalation: string
    contactability: string
    amount: string
    search: string
    reset: string
    save: string
  }
}

/**
 * RTL support configuration
 */
export interface ConsolidationRTLConfig {
  enabled: boolean
  direction: 'ltr' | 'rtl'
  layoutAdjustments: {
    flipIcons: boolean
    reverseOrder: boolean
    adjustSpacing: boolean
  }
  textAlignment: {
    numbers: 'left' | 'right'
    currency: 'left' | 'right'
    dates: 'left' | 'right'
  }
}