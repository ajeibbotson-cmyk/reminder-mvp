# 🔗 UNIFIED API STRUCTURE SPECIFICATION
## Complete Invoice → Email Workflow Design

**Purpose**: Define unified API structure for seamless invoice-to-campaign email automation
**Context**: Integration layer between Reminder's invoice management and SendAChaser's email automation
**Updated**: September 28, 2025

---

## 🏗️ API ARCHITECTURE OVERVIEW

### **Integration Strategy**
- **Foundation**: Reminder APIs as primary endpoints
- **Enhancement**: New campaign endpoints extending existing patterns
- **Service Layer**: UnifiedEmailService bridging invoice data with email automation
- **Authentication**: Maintain NextAuth.js with extended OAuth provider support
- **Data Flow**: Invoice data → Campaign creation → Email automation → Tracking

### **Unified Workflow Pattern**
```typescript
// Simplified workflow - 3 API calls instead of 15+ manual steps
POST /api/campaigns/from-invoices    // Create campaign from invoices
GET  /api/campaigns/[id]/preview     // Preview before sending
POST /api/campaigns/[id]/send        // Execute campaign with progress tracking
```

---

## 📊 ENHANCED EXISTING ENDPOINTS

### **Invoice Management (Enhanced)**

#### `GET /api/invoices` (Enhanced)
**New Response Fields**:
```typescript
{
  invoices: EnhancedInvoice[],
  pagination: PaginationInfo,
  statusCounts: Record<InvoiceStatus, number>,
  insights: BusinessInsights,
  // NEW: Email automation insights
  emailCapabilities: {
    emailableCount: number,           // Invoices with valid email addresses
    campaignReadyCount: number,       // Invoices eligible for campaigns
    lastEmailSentDate?: Date,        // Last campaign date for these invoices
    suppressedCount: number          // Emails on suppression list
  }
}
```

#### `POST /api/invoices/[id]/send-email` (Enhanced)
**New Request Schema**:
```typescript
{
  // Existing fields maintained
  templateId?: string,
  recipientEmail?: string,
  subject?: string,
  content?: string,
  language: 'ENGLISH' | 'ARABIC',

  // NEW: Campaign integration fields
  campaignMode?: boolean,            // Single email or part of campaign
  campaignId?: string,              // Associated campaign if applicable
  mergeData?: Record<string, any>,  // Dynamic merge tag data
  trackingEnabled?: boolean,        // Enable click/open tracking
  scheduleFor?: Date               // Delayed sending option
}
```

---

## 🚀 NEW CAMPAIGN ENDPOINTS

### **Campaign Creation & Management**

#### `POST /api/campaigns/from-invoices`
**Purpose**: Create email campaign from selected invoices with validation and preview
**Request**:
```typescript
{
  invoiceIds: string[],                    // Selected invoices for campaign
  campaignName: string,                    // Campaign identifier
  emailSubject: string,                    // Email subject with merge tag support
  emailContent: string,                    // Email body with merge tags
  language: 'ENGLISH' | 'ARABIC',          // Template language
  templateId?: string,                     // Pre-existing template to use

  // Sending configuration
  sendingOptions: {
    emailProvider: 'gmail' | 'outlook',    // OAuth provider to use
    scheduleFor?: Date,                    // Immediate or scheduled
    respectBusinessHours: boolean,         // UAE business hours compliance
    batchSize?: number,                    // Emails per batch (default: 5)
    delayBetweenBatches?: number          // Delay in ms (default: 3000)
  },

  // Advanced options
  personalization: {
    enableMergeTags: boolean,              // Use dynamic content
    customFields?: Record<string, any>,    // Additional merge data
    fallbackContent?: string              // Content for missing merge data
  }
}
```

**Response**:
```typescript
{
  campaign: {
    id: string,
    name: string,
    status: 'draft',
    totalRecipients: number,
    estimatedDuration: string,             // "Approximately 8 minutes"

    // Validation results
    validationSummary: {
      validEmails: number,
      invalidEmails: number,
      suppressedEmails: number,
      duplicateEmails: number,
      issues: ValidationIssue[]
    },

    // Preview data
    previewData: {
      sampleEmail: {
        to: string,
        subject: string,                   // With merge tags resolved
        content: string,                   // With merge tags resolved
        mergeTagsUsed: string[]
      },
      mergeTags: {
        available: string[],               // Available merge tags
        used: string[],                    // Used in template
        missing: string[]                  // Missing from some invoices
      }
    }
  },

  // Ready to send or needs fixes
  readyToSend: boolean,
  requiredActions?: string[]               // Steps needed before sending
}
```

#### `GET /api/campaigns`
**Purpose**: List company campaigns with filtering and analytics
**Query Parameters**:
```typescript
{
  status?: 'draft' | 'sending' | 'completed' | 'failed',
  startDate?: Date,
  endDate?: Date,
  search?: string,                         // Search by name or content
  sortBy?: 'created_at' | 'sent_at' | 'name' | 'success_rate',
  sortOrder?: 'asc' | 'desc',
  page?: number,
  limit?: number
}
```

**Response**:
```typescript
{
  campaigns: Campaign[],
  pagination: PaginationInfo,
  analytics: {
    totalCampaigns: number,
    activeCampaigns: number,
    avgSuccessRate: number,
    totalEmailsSent: number,
    totalEmailsOpened: number,
    totalEmailsClicked: number
  }
}
```

#### `GET /api/campaigns/[id]`
**Purpose**: Get detailed campaign information with real-time progress
**Response**:
```typescript
{
  campaign: {
    id: string,
    name: string,
    status: CampaignStatus,
    createdAt: Date,
    startedAt?: Date,
    completedAt?: Date,

    // Configuration
    emailSubject: string,
    emailContent: string,
    language: 'ENGLISH' | 'ARABIC',
    sendingOptions: SendingOptions,

    // Progress tracking
    progress: {
      totalRecipients: number,
      sentCount: number,
      failedCount: number,
      openedCount: number,
      clickedCount: number,
      bouncedCount: number,
      unsubscribedCount: number,

      // Real-time progress (for active campaigns)
      currentBatch?: number,
      totalBatches?: number,
      percentComplete: number,
      estimatedTimeRemaining?: string,
      lastEmailSentAt?: Date
    },

    // Associated data
    invoices: MinimalInvoice[],            // Invoices included in campaign
    emailLogs: CampaignEmailLog[]          // Individual email statuses
  }
}
```

#### `POST /api/campaigns/[id]/send`
**Purpose**: Execute campaign with real-time progress tracking
**Request**:
```typescript
{
  confirmSend: boolean,                    // Explicit confirmation required
  finalValidation?: boolean               // Re-run validation before sending
}
```

**Response** (Streaming):
```typescript
// Initial response
{
  success: true,
  campaignId: string,
  totalEmails: number,
  estimatedDuration: string,
  progressEndpoint: string                 // SSE endpoint for progress updates
}

// Server-Sent Events on /api/campaigns/[id]/progress
{
  type: 'progress',
  data: {
    sentCount: number,
    failedCount: number,
    currentBatch: number,
    totalBatches: number,
    percentComplete: number,
    lastEmailTo: string,
    estimatedTimeRemaining: string
  }
}

{
  type: 'completion',
  data: {
    status: 'completed' | 'failed',
    totalSent: number,
    totalFailed: number,
    duration: string,
    successRate: number
  }
}
```

#### `GET /api/campaigns/[id]/progress`
**Purpose**: Server-Sent Events endpoint for real-time campaign progress
**Headers**: `text/event-stream`
**Response**: Continuous SSE stream with progress updates

---

## 🔧 EMAIL PROVIDER ENDPOINTS

### **OAuth Provider Management**

#### `POST /api/email-providers`
**Purpose**: Connect new OAuth email provider (Gmail/Outlook)
**Request**:
```typescript
{
  providerType: 'gmail' | 'outlook',
  authorizationCode: string,               // OAuth authorization code
  redirectUri: string,                     // OAuth redirect URI
  displayName?: string                     // User-friendly provider name
}
```

**Response**:
```typescript
{
  provider: {
    id: string,
    providerType: 'gmail' | 'outlook',
    email: string,                         // Provider email address
    displayName: string,
    isActive: boolean,
    dailyQuotaUsed: number,
    dailyQuotaLimit: number,
    connectedAt: Date,
    lastUsedAt?: Date
  },
  isDefault: boolean                       // Whether this is now the default provider
}
```

#### `GET /api/email-providers`
**Purpose**: List connected email providers with status
**Response**:
```typescript
{
  providers: EmailProvider[],
  defaultProvider?: EmailProvider,
  quotaStatus: {
    totalDailyLimit: number,
    totalDailyUsed: number,
    availableToday: number,
    nextResetAt: Date
  }
}
```

#### `POST /api/email-providers/[id]/refresh`
**Purpose**: Refresh OAuth token for provider
**Response**:
```typescript
{
  success: boolean,
  provider: EmailProvider,
  tokenExpiresAt: Date
}
```

#### `DELETE /api/email-providers/[id]`
**Purpose**: Disconnect email provider
**Response**:
```typescript
{
  success: boolean,
  message: string,
  newDefaultProvider?: EmailProvider      // If default provider was changed
}
```

---

## 📊 ANALYTICS & TRACKING ENDPOINTS

### **Campaign Analytics**

#### `GET /api/analytics/campaigns`
**Purpose**: Campaign performance analytics and insights
**Query Parameters**:
```typescript
{
  timeRange?: '7d' | '30d' | '90d' | 'custom',
  startDate?: Date,
  endDate?: Date,
  campaignIds?: string[],                  // Specific campaigns
  groupBy?: 'day' | 'week' | 'month'
}
```

**Response**:
```typescript
{
  summary: {
    totalCampaigns: number,
    totalEmailsSent: number,
    avgOpenRate: number,
    avgClickRate: number,
    avgBounceRate: number,
    totalRevenue?: number                  // If payment tracking enabled
  },

  trends: {
    dates: string[],                       // Date labels
    emailsSent: number[],                  // Emails sent per period
    openRates: number[],                   // Open rates per period
    clickRates: number[],                  // Click rates per period
    bounceRates: number[]                  // Bounce rates per period
  },

  topPerformingCampaigns: {
    name: string,
    sentAt: Date,
    openRate: number,
    clickRate: number,
    totalSent: number
  }[],

  // Performance insights
  insights: {
    bestSendTime: string,                  // "Tuesday 10:00 AM"
    bestSubjectLines: string[],            // Top performing subjects
    recommendedActions: string[]           // Suggested improvements
  }
}
```

#### `GET /api/analytics/emails/[campaignId]`
**Purpose**: Detailed email-level analytics for specific campaign
**Response**:
```typescript
{
  campaign: CampaignSummary,
  emailDetails: {
    id: string,
    recipientEmail: string,
    invoiceNumber: string,
    sentAt: Date,
    deliveryStatus: EmailDeliveryStatus,
    openedAt?: Date,
    clickedAt?: Date,
    bouncedAt?: Date,
    errorMessage?: string,

    // Tracking events
    events: {
      type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained',
      timestamp: Date,
      metadata?: Record<string, any>
    }[]
  }[],

  // Aggregated metrics
  metrics: {
    deliveryRate: number,
    openRate: number,
    clickRate: number,
    bounceRate: number,
    complaintRate: number
  }
}
```

---

## 🔄 UNIFIED WORKFLOW PATTERNS

### **Complete Workflow Example**
```typescript
// 1. Create campaign from overdue invoices
const campaign = await fetch('/api/campaigns/from-invoices', {
  method: 'POST',
  body: JSON.stringify({
    invoiceIds: ['inv_001', 'inv_002', 'inv_003'],
    campaignName: 'September Overdue Follow-up',
    emailSubject: 'Payment Reminder: Invoice {{invoiceNumber}} - {{customerName}}',
    emailContent: `
      Dear {{customerName}},

      This is a friendly reminder that invoice {{invoiceNumber}} for {{amount}}
      is now {{daysPastDue}} days overdue.

      Please process payment at your earliest convenience.

      Best regards,
      {{companyName}}
    `,
    language: 'ENGLISH',
    sendingOptions: {
      emailProvider: 'gmail',
      respectBusinessHours: true,
      batchSize: 5,
      delayBetweenBatches: 3000
    },
    personalization: {
      enableMergeTags: true
    }
  })
});

// 2. Preview and validate
const preview = await fetch(`/api/campaigns/${campaign.id}`);
if (!preview.readyToSend) {
  // Handle validation issues
  console.log('Fixes needed:', preview.requiredActions);
  return;
}

// 3. Execute campaign with progress tracking
const execution = await fetch(`/api/campaigns/${campaign.id}/send`, {
  method: 'POST',
  body: JSON.stringify({ confirmSend: true })
});

// 4. Monitor progress via SSE
const eventSource = new EventSource(`/api/campaigns/${campaign.id}/progress`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'progress') {
    updateProgressBar(data.percentComplete);
  } else if (data.type === 'completion') {
    showCompletionSummary(data);
    eventSource.close();
  }
};

// 5. View analytics
const analytics = await fetch(`/api/analytics/emails/${campaign.id}`);
displayCampaignResults(analytics);
```

### **Error Handling Patterns**
```typescript
// Consistent error responses across all endpoints
{
  error: string,                           // Human-readable error message
  code: string,                           // Machine-readable error code
  details?: ValidationError[],            // Detailed validation errors
  retryable: boolean,                     // Whether operation can be retried
  suggestions?: string[]                  // Recommended actions
}

// Common error codes
'INVALID_OAUTH_TOKEN'                     // Provider token expired/invalid
'DAILY_QUOTA_EXCEEDED'                    // Email sending limit reached
'INVALID_MERGE_TAGS'                      // Template contains invalid merge tags
'INSUFFICIENT_PERMISSIONS'                // User lacks required permissions
'CAMPAIGN_ALREADY_SENDING'                // Cannot modify active campaign
'NO_VALID_RECIPIENTS'                     // All recipients filtered out
```

---

## 🛡️ SECURITY & VALIDATION

### **Authentication & Authorization**
- **Session Validation**: All endpoints require valid NextAuth session
- **Company Isolation**: Multi-tenant data scoping on all operations
- **Rate Limiting**: 100 requests/minute per user for campaign operations
- **OAuth Scoping**: Minimum required scopes for email providers
- **Data Validation**: Comprehensive Zod schema validation on all inputs

### **Data Privacy & Compliance**
- **Email Suppression**: Automatic suppression list checking
- **Unsubscribe Handling**: Automatic unsubscribe link injection
- **Data Retention**: Configurable retention periods for email logs
- **Audit Logging**: Complete audit trail for all campaign operations
- **UAE Compliance**: Business hours respect and cultural considerations

### **Performance & Reliability**
- **Database Optimization**: Optimized queries with proper indexing
- **Caching Strategy**: Campaign data cached for improved performance
- **Connection Pooling**: Database connection pooling via Supabase
- **Background Processing**: Long-running operations handled asynchronously
- **Graceful Degradation**: Fallback options when providers unavailable

---

## 🎯 INTEGRATION BENEFITS

### **Developer Experience**
- **Reduced Complexity**: 3 API calls instead of 15+ manual operations
- **Type Safety**: Complete TypeScript interfaces for all endpoints
- **Consistent Patterns**: Unified response formats and error handling
- **Real-time Updates**: SSE-based progress tracking for long operations
- **Comprehensive Documentation**: Complete API documentation with examples

### **Business Value**
- **Time Savings**: 2.5 hours → 10 minutes for invoice reminder campaigns
- **Improved Success Rates**: Professional email automation vs manual processes
- **Better Analytics**: Comprehensive tracking and performance insights
- **Scalability**: Bulk operations designed for high-volume usage
- **UAE Business Compliance**: Built-in business hours and cultural respect

### **Technical Foundation**
- **Production Ready**: Built on Reminder's proven multi-tenant architecture
- **OAuth Integration**: Secure email provider connections with automatic refresh
- **Rate Limiting**: Intelligent rate limiting to respect provider constraints
- **Error Recovery**: Comprehensive error handling with retry logic
- **Audit Trail**: Complete activity logging for compliance and debugging

This unified API structure transforms complex invoice reminder workflows into simple, automated operations while maintaining the security, reliability, and UAE business compliance that Reminder's architecture provides! 🚀