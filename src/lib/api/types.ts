// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  details?: any
}

// Campaign Types
export interface Campaign {
  id: string
  name: string
  status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused'
  createdAt: string
  startedAt?: string
  completedAt?: string

  // Configuration
  emailSubject: string
  emailContent: string
  language: 'ENGLISH' | 'ARABIC'
  batchSize: number
  delayBetweenBatches: number
  respectBusinessHours: boolean
  scheduledFor?: string

  // Progress tracking
  progress: {
    totalRecipients: number
    sentCount: number
    failedCount: number
    openedCount: number
    clickedCount: number
    bouncedCount: number
    unsubscribedCount: number

    // Real-time progress (for active campaigns)
    currentBatch?: number
    totalBatches?: number
    percentComplete: number
    estimatedTimeRemaining?: string
    lastEmailSentAt?: string
  }

  // Associated data
  invoices: Array<{
    id: string
    number: string
    customerName: string
    amount: number
    status: string
  }>

  emailLogs: Array<{
    id: string
    recipientEmail: string
    invoiceNumber: string
    deliveryStatus: string
    sentAt?: string
    errorMessage?: string
  }>

  // Creator info
  createdBy: {
    id: string
    name: string
  }
}

export interface CampaignListItem {
  id: string
  name: string
  status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused'
  totalRecipients: number
  sentCount: number
  failedCount: number
  successRate: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  createdBy: {
    id: string
    name: string
  }
}

export interface CampaignsListResponse {
  campaigns: CampaignListItem[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
  analytics: {
    totalCampaigns: number
    activeCampaigns: number
    avgSuccessRate: number
    totalEmailsSent: number
    totalEmailsOpened: number
    totalEmailsClicked: number
  }
}

// Campaign Creation Types
export interface CreateCampaignRequest {
  name: string
  selectedInvoiceIds: string[]
  emailSubject: string
  emailContent: string
  language: 'ENGLISH' | 'ARABIC'
  batchSize?: number
  delayBetweenBatches?: number
  respectBusinessHours?: boolean
  scheduledFor?: string
}

export interface CreateCampaignResponse {
  success: true
  campaignId: string
  validation: {
    totalInvoices: number
    validRecipients: number
    invalidEmails: string[]
    duplicateEmails: string[]
    estimatedDuration: string
  }
  preview: {
    sampleEmail: {
      to: string
      subject: string
      content: string
    }
    mergeFieldsUsed: string[]
  }
}

// Campaign Send Types
export interface SendCampaignRequest {
  confirmSend: boolean
  finalValidation?: boolean
}

export interface SendCampaignResponse {
  success: true
  campaignId: string
  totalEmails: number
  estimatedDuration: string
  progressEndpoint: string
  message: string
}

// Progress Types
export interface CampaignProgress {
  campaignId: string
  sentCount: number
  failedCount: number
  currentBatch?: number
  totalBatches?: number
  percentComplete: number
  lastEmailTo?: string
  estimatedTimeRemaining?: string
  status: string
  totalRecipients: number
}

// Error Types
export interface ApiError {
  error: string
  code?: string
  details?: any
  retryable?: boolean
  suggestions?: string[]
}

// Query Parameters
export interface CampaignsQueryParams {
  status?: 'draft' | 'sending' | 'completed' | 'failed' | 'paused'
  startDate?: string
  endDate?: string
  search?: string
  sortBy?: 'created_at' | 'sent_at' | 'name' | 'success_rate'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Invoice Types (for campaign creation)
export interface Invoice {
  id: string
  number: string
  customerName: string
  customerEmail: string
  amount: number
  currency: string
  dueDate: string
  status: string
  description?: string
  company_id: string
}