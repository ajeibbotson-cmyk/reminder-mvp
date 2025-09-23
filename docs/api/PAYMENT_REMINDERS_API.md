# Payment Reminders API Documentation

## Overview

This document specifies the REST API endpoints for the customer-consolidated payment reminders feature in the reminder-mvp application. The API follows existing patterns and integrates seamlessly with the current authentication and rate limiting systems.

## Base Configuration

**Base URL**: `/api/v1`
**Authentication**: Bearer token (Supabase JWT)
**Rate Limiting**: Inherits existing application limits
**Content-Type**: `application/json`

## Authentication

All endpoints require valid Supabase JWT token in Authorization header:
```http
Authorization: Bearer <supabase_jwt_token>
```

User isolation is enforced through Row Level Security (RLS) policies.

---

## Invoice Management Endpoints

### GET /api/invoices
Retrieve invoices with filtering and pagination.

#### Query Parameters
```typescript
{
  contactId?: string        // Filter by customer
  status?: InvoiceStatus    // Filter by status
  dueBefore?: string       // ISO date - overdue before this date
  dueAfter?: string        // ISO date - due after this date
  minAmount?: number       // Minimum invoice amount
  maxAmount?: number       // Maximum invoice amount
  page?: number            // Page number (default: 1)
  limit?: number           // Items per page (default: 50, max: 100)
  sortBy?: string          // Sort field (due_date, amount, created_at)
  sortOrder?: 'asc' | 'desc' // Sort order (default: desc)
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    invoices: Array<{
      id: string
      contactId: string
      invoiceNumber: string
      amount: number
      currency: string
      issueDate: string      // ISO date
      dueDate: string        // ISO date
      status: InvoiceStatus
      paymentTerms: number
      description?: string
      contact: {
        id: string
        name: string
        email: string
        company?: string
      }
      daysOverdue?: number   // Calculated field for overdue invoices
      createdAt: string
      updatedAt: string
    }>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}
```

#### Example
```bash
curl -X GET "/api/invoices?status=overdue&limit=20&sortBy=due_date" \
  -H "Authorization: Bearer <token>"
```

### POST /api/invoices (DEPRECATED - Use bulk import only)
⚠️ **NOTICE**: Manual invoice creation has been removed from scope. Use `POST /api/invoices/import` for bulk invoice processing.

*This endpoint has been deprecated in favor of bulk import workflows that better serve UAE SME use cases.*

### PUT /api/invoices/:id
Update an existing invoice.

#### Request Body
Same as POST, all fields optional except those being updated.

#### Response
```typescript
{
  success: boolean
  data: {
    invoice: Invoice
  }
  error?: string
}
```

### DELETE /api/invoices/:id
Delete an invoice (soft delete).

#### Response
```typescript
{
  success: boolean
  message: string
}
```

### POST /api/invoices/import
Import invoices from CSV file.

#### Request Body (multipart/form-data)
```typescript
{
  file: File              // CSV file
  mapping: {
    contactId: string      // CSV column name for contact ID
    invoiceNumber: string  // CSV column name for invoice number
    amount: string         // CSV column name for amount
    issueDate: string      // CSV column name for issue date
    dueDate: string        // CSV column name for due date
    // ... other field mappings
  }
  validateOnly?: boolean   // If true, validate without importing
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    imported: number       // Number of invoices imported
    failed: number         // Number of failed imports
    errors: Array<{
      row: number
      field: string
      message: string
    }>
    preview?: Array<Invoice> // If validateOnly=true
  }
}
```

---

## Reminder Management Endpoints

### GET /api/reminders/queue
Retrieve customer-grouped reminder queue.

#### Query Parameters
```typescript
{
  priority?: 'high' | 'medium' | 'low'
  eligibleOnly?: boolean   // Only customers eligible for reminders
  minAmount?: number       // Minimum total overdue amount
  page?: number
  limit?: number
  sortBy?: 'total_amount' | 'oldest_invoice' | 'last_contact' | 'priority'
  sortOrder?: 'asc' | 'desc'
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    customers: Array<{
      contactId: string
      name: string
      email: string
      company?: string
      overdueInvoices: Array<{
        id: string
        invoiceNumber: string
        amount: number
        currency: string
        dueDate: string
        daysOverdue: number
      }>
      totalAmount: number
      currency: string
      maxDaysOverdue: number
      lastReminderSent?: string  // ISO datetime
      totalRemindersSent: number
      priority: 'high' | 'medium' | 'low'
      eligibleForReminder: boolean
      estimatedReminderType: 'polite' | 'standard' | 'urgent' | 'final'
    }>
    pagination: PaginationInfo
    summary: {
      totalCustomers: number
      totalAmount: number
      avgDaysOverdue: number
      eligibleCustomers: number
    }
  }
}
```

### POST /api/reminders/send-consolidated
Send consolidated reminder to specific customer.

#### Request Body
```typescript
{
  contactId: string
  invoiceIds: string[]     // Specific invoices to include
  templateType?: 'polite' | 'standard' | 'urgent' | 'final' | 'manual'
  scheduleId?: string      // Reference to reminder schedule
  customSubject?: string   // Override template subject
  customMessage?: string   // Additional message to include
  sendAt?: string          // ISO datetime - schedule for later
  includePDFs?: boolean    // Include invoice PDFs (default: true)
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    reminderId: string
    emailStatus: string
    scheduledFor?: string    // If scheduled for later
    invoicesIncluded: number
    totalAmount: number
    estimatedDelivery?: string
  }
  error?: string
}
```

### POST /api/reminders/send-bulk
Send reminders to multiple customers (batch operation).

#### Request Body
```typescript
{
  customers: Array<{
    contactId: string
    invoiceIds: string[]
    templateType?: string
  }>
  scheduleId?: string
  sendAt?: string          // Schedule all for same time
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    queued: number
    failed: number
    estimatedCompletionTime: string
    batchId: string          // For tracking batch progress
  }
  errors: Array<{
    contactId: string
    error: string
  }>
}
```

### GET /api/reminders/history
Retrieve reminder history with filtering.

#### Query Parameters
```typescript
{
  contactId?: string       // Filter by customer
  reminderType?: string    // Filter by reminder type
  emailStatus?: string     // Filter by delivery status
  dateFrom?: string        // ISO date
  dateTo?: string          // ISO date
  page?: number
  limit?: number
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    reminders: Array<{
      id: string
      contactId: string
      contactName: string
      invoiceIds: string[]
      totalAmount: number
      currency: string
      reminderType: string
      emailSubject: string
      sentAt: string
      emailStatus: string
      openedAt?: string
      clickedAt?: string
      respondedAt?: string
      paymentReceivedAt?: string
      template: {
        id: string
        name: string
      }
    }>
    pagination: PaginationInfo
  }
}
```

### GET /api/reminders/:id/preview
Preview reminder email before sending.

#### Query Parameters
```typescript
{
  contactId: string
  invoiceIds: string[]
  templateType?: string
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    preview: {
      subject: string
      body: string           // Rendered HTML
      attachments: Array<{
        filename: string
        size: number
        type: string
      }>
      estimatedDeliveryTime: string
    }
    warnings?: string[]      // Any issues with the preview
  }
}
```

---

## Reminder Schedule Endpoints

### GET /api/reminder-schedules
Retrieve user's reminder schedules.

#### Response
```typescript
{
  success: boolean
  data: {
    schedules: Array<{
      id: string
      name: string
      description?: string
      isActive: boolean
      triggerDays: number[]
      consolidateByCustomer: boolean
      minDaysBetweenReminders: number
      templates: {
        polite?: TemplateInfo
        standard?: TemplateInfo
        urgent?: TemplateInfo
        final?: TemplateInfo
      }
      businessRules: {
        excludeDisputed: boolean
        excludePartial: boolean
        minimumAmount: number
      }
      createdAt: string
    }>
  }
}
```

### POST /api/reminder-schedules
Create new reminder schedule.

#### Request Body
```typescript
{
  name: string
  description?: string
  triggerDays: number[]
  consolidateByCustomer?: boolean
  minDaysBetweenReminders?: number
  politeTemplateId?: string
  standardTemplateId?: string
  urgentTemplateId?: string
  finalTemplateId?: string
  excludeDisputed?: boolean
  excludePartial?: boolean
  minimumAmount?: number
}
```

### PUT /api/reminder-schedules/:id
Update reminder schedule.

### DELETE /api/reminder-schedules/:id
Delete reminder schedule.

---

## Analytics Endpoints

### GET /api/analytics/reminder-effectiveness
Retrieve reminder effectiveness analytics.

#### Query Parameters
```typescript
{
  dateFrom?: string        // ISO date (default: 3 months ago)
  dateTo?: string          // ISO date (default: today)
  groupBy?: 'day' | 'week' | 'month'
  reminderType?: string
}
```

#### Response
```typescript
{
  success: boolean
  data: {
    metrics: {
      totalReminders: number
      totalCustomers: number
      avgResponseTime: number      // Days
      paymentRate: number          // Percentage
      openRate: number             // Percentage
      clickRate: number            // Percentage
    }
    timeline: Array<{
      date: string
      remindersSent: number
      paymentsReceived: number
      responseRate: number
      avgResponseTime: number
    }>
    byReminderType: Array<{
      type: string
      sent: number
      payments: number
      rate: number
    }>
  }
}
```

### GET /api/analytics/payment-behavior
Analyze customer payment behavior patterns.

#### Response
```typescript
{
  success: boolean
  data: {
    summary: {
      avgPaymentDays: number
      onTimePaymentRate: number
      improvedCustomers: number    // After reminder implementation
    }
    customerSegments: Array<{
      segment: 'excellent' | 'good' | 'average' | 'poor'
      customerCount: number
      avgDaysToPayment: number
      totalOutstanding: number
    }>
    monthlyTrends: Array<{
      month: string
      avgPaymentDays: number
      totalCollected: number
      remindersSent: number
    }>
  }
}
```

### GET /api/analytics/collection-kpis
Key performance indicators for collections.

#### Response
```typescript
{
  success: boolean
  data: {
    kpis: {
      dso: number                  // Days Sales Outstanding
      collectionRate: number       // Percentage
      reminderEffectiveness: number // Percentage
      avgReminderResponse: number  // Days
    }
    trends: {
      dsoTrend: 'improving' | 'stable' | 'declining'
      collectionTrend: 'improving' | 'stable' | 'declining'
      reminderVolume: number       // Change from previous period
    }
    comparisons: {
      previousPeriod: KPIMetrics
      industryBenchmark?: KPIMetrics
    }
  }
}
```

---

## PDF Generation Endpoints

### GET /api/invoices/:id/pdf
Generate PDF for specific invoice.

#### Query Parameters
```typescript
{
  language?: 'en' | 'ar'   // Default: 'en'
  format?: 'A4' | 'letter' // Default: 'A4'
  watermark?: string       // Optional watermark text
}
```

#### Response
Binary PDF file with appropriate headers:
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-{number}.pdf"
```

### POST /api/invoices/pdf/bulk
Generate PDFs for multiple invoices.

#### Request Body
```typescript
{
  invoiceIds: string[]
  format?: 'individual' | 'consolidated'
  language?: 'en' | 'ar'
}
```

#### Response
Binary ZIP file containing PDFs:
```http
Content-Type: application/zip
Content-Disposition: attachment; filename="invoices-{date}.zip"
```

---

## Error Handling

### Standard Error Response
```typescript
{
  success: false
  error: {
    code: string             // Error code for programmatic handling
    message: string          // Human-readable error message
    details?: any           // Additional error context
    field?: string          // Field name for validation errors
  }
  timestamp: string          // ISO datetime
  requestId: string          // For debugging and support
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `RATE_LIMITED`: Rate limit exceeded
- `INVOICE_ALREADY_PAID`: Cannot modify paid invoice
- `REMINDER_TOO_SOON`: Cannot send reminder due to timing rules
- `EMAIL_QUOTA_EXCEEDED`: Daily email limit reached
- `PDF_GENERATION_FAILED`: PDF generation error

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

---

## Rate Limiting

### Current Limits (inherited from existing system)
- **Email sending**: 50 emails per day per user
- **API requests**: 1000 requests per hour per user
- **PDF generation**: 100 PDFs per hour per user
- **Bulk operations**: 5 concurrent operations per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1632150000
X-RateLimit-Type: api_requests
```

## Webhook Support

### Available Events
- `reminder.sent`: Reminder email sent successfully
- `reminder.opened`: Customer opened reminder email
- `reminder.clicked`: Customer clicked link in reminder
- `payment.received`: Payment received for reminded invoice
- `reminder.bounced`: Reminder email bounced

### Webhook Payload Example
```typescript
{
  event: 'reminder.sent'
  timestamp: string
  data: {
    reminderId: string
    contactId: string
    invoiceIds: string[]
    totalAmount: number
    reminderType: string
  }
  userId: string
}
```

---

**Document Version**: 1.0
**Last Updated**: September 19, 2025
**Next Review**: Post-Implementation Testing