# Customer-Consolidated Payment Reminders - Feature Specification

## Overview

This feature implements intelligent customer-consolidated payment reminders for the reminder-mvp application, specifically designed for the UAE business market. The system groups multiple outstanding invoices by customer and sends professional, culturally-appropriate reminder emails that reduce communication volume while maintaining effectiveness.

## Business Context

### Problem Statement
UAE businesses using invoice reminder systems face challenges with:
- **Email fatigue**: Customers receive multiple individual reminder emails for different invoices
- **Relationship strain**: Excessive communication can damage professional relationships
- **Inefficient collections**: Fragmented communication reduces payment response rates
- **Cultural misalignment**: Generic templates don't match UAE business customs

### Solution Benefits
- **70% reduction** in email volume through intelligent consolidation
- **Professional communication** tailored to UAE market expectations
- **Improved collection rates** through comprehensive invoice visibility
- **Relationship preservation** via respectful communication cadence

## Functional Requirements

### FR1: Customer Invoice Consolidation
**Description**: Group multiple outstanding invoices by customer for unified communication.

**Acceptance Criteria**:
- System identifies all overdue invoices for each customer
- Groups invoices by customer ID from contacts table
- Calculates total outstanding amount across all customer invoices
- Determines oldest overdue invoice for priority assessment
- Excludes disputed or partially paid invoices from consolidation

**Business Rules**:
- Minimum 2 overdue invoices required for consolidation
- Maximum 10 invoices displayed in email body (others in attachments)
- Consolidation occurs daily at 9:00 AM UAE time
- Only includes invoices overdue by 1+ days

### FR2: Contact Frequency Management
**Description**: Enforce minimum time intervals between reminder emails to same customer.

**Acceptance Criteria**:
- System tracks last contact date per customer
- Enforces 7-day minimum between reminder emails
- Allows manual override with manager approval
- Logs all contact attempts and timing

**Business Rules**:
- 7 days = minimum interval for polite reminders
- 3 days = minimum for urgent reminders (45+ days overdue)
- 1 day = minimum for final notices (90+ days overdue)
- No reminders during UAE holidays (Eid, National Day, etc.)

### FR3: Professional Email Templates
**Description**: Generate culturally-appropriate consolidated reminder emails.

**Acceptance Criteria**:
- Templates available in English and Arabic
- Professional business tone suitable for UAE market
- Clear invoice breakdown with totals
- Respectful escalation language based on overdue duration
- Company branding and contact information

**Template Variables**:
```
{{customer_name}} - Contact person name
{{company_name}} - Customer company name
{{invoice_count}} - Number of overdue invoices
{{total_amount}} - Sum of all overdue amounts
{{currency}} - AED, USD, EUR
{{oldest_days}} - Days overdue for oldest invoice
{{invoice_list}} - Formatted table of invoice details
{{payment_terms}} - Original payment terms
{{contact_info}} - Sender contact information
```

### FR4: Automated Reminder Scheduling
**Description**: Automatically trigger consolidated reminders based on due dates and escalation rules.

**Acceptance Criteria**:
- Daily automated scan for overdue invoices
- Customer-level reminder queue generation
- Escalation based on oldest invoice age
- Integration with existing email rate limiting
- Progress tracking and status updates

**Escalation Schedule**:
- **Day 1-14**: Polite reminder (once per week)
- **Day 15-44**: Standard reminder (twice per week)
- **Day 45-89**: Urgent reminder (every 3 days)
- **Day 90+**: Final notice (daily, with legal warning)

### FR5: Invoice PDF Attachments
**Description**: Generate and attach professional invoice PDFs to reminder emails.

**Acceptance Criteria**:
- PDF generation for each overdue invoice
- UAE business standard formatting
- Company branding and TRN display
- Consolidated statement option for multiple invoices
- Automatic attachment to reminder emails

**PDF Requirements**:
- A4 size, portrait orientation
- Arabic/English bilingual headers
- TRN (Tax Registration Number) display
- Company logo and branding
- Payment instructions and bank details

## Non-Functional Requirements

### NFR1: Performance
- **Email generation**: < 5 seconds per consolidated reminder
- **PDF creation**: < 3 seconds per invoice
- **Dashboard loading**: < 2 seconds for reminder queue
- **Database queries**: < 500ms for customer consolidation

### NFR2: Scalability
- Support up to 10,000 invoices per user account
- Handle 1,000 customers per consolidation run
- Process 500 reminder emails per day within rate limits
- Scale horizontally with user base growth

### NFR3: Reliability
- 99.9% uptime for automated reminder service
- Zero data loss during consolidation processing
- Automatic retry logic for failed email sends
- Graceful degradation during high load periods

### NFR4: Security
- Row-level security (RLS) for multi-tenant data isolation
- Encrypted email content and attachments
- Audit logging for all reminder activities
- Secure handling of financial information

### NFR5: Usability
- Intuitive dashboard for reminder queue management
- Clear visual indicators for customer priority levels
- Easy manual override capabilities
- Comprehensive analytics and reporting

## Integration Requirements

### INT1: Contact Management System
**Description**: Seamless integration with existing contact management system.

**Integration Points**:
- Use existing `contacts` table for customer information
- Leverage custom_fields JSON for invoice-specific data
- Maintain contact tagging and segmentation capabilities
- Preserve existing import/export functionality

### INT2: Email Service Integration
**Description**: Utilize existing OAuth email infrastructure.

**Integration Points**:
- Gmail/Outlook OAuth token management
- Existing rate limiting and quota management
- Campaign tracking and analytics
- Template merge tag system extension

### INT3: Analytics Dashboard
**Description**: Extend current analytics with payment reminder metrics.

**New Metrics**:
- Reminder effectiveness rate (emails sent vs payments received)
- Customer response time analysis
- Consolidation impact measurement
- Collection improvement tracking

## User Interface Requirements

### UI1: Reminder Dashboard
**Description**: Customer-grouped view of pending reminders.

**Components**:
```
┌──────────────────────────────────────────────────────────────┐
│ 🔴 ABC Trading LLC (3 invoices)                            │
│    Total overdue: AED 14,450                               │
│    Oldest invoice: 37 days | Last contact: 14 days ago     │
│    [Send Consolidated] [Preview] [Skip] [Details]          │
└──────────────────────────────────────────────────────────────┘
```

### UI2: Invoice Management
**Description**: CRUD interface for invoice tracking.

**Features**:
- Invoice creation with customer linking
- Status tracking (pending, overdue, paid, disputed)
- Bulk import from CSV/Excel files
- Integration with existing contact management

### UI3: Template Management
**Description**: Configuration interface for reminder templates.

**Capabilities**:
- Template editor with live preview
- Variable insertion assistance
- Language switching (English/Arabic)
- A/B testing setup for effectiveness comparison

## Data Model

### Entities

#### Invoice
```typescript
interface Invoice {
  id: string
  userId: string
  contactId: string
  invoiceNumber: string
  amount: number
  currency: 'AED' | 'USD' | 'EUR'
  issueDate: Date
  dueDate: Date
  status: 'pending' | 'overdue' | 'paid' | 'disputed' | 'cancelled'
  paymentTerms: number // days
  description?: string
  taxAmount?: number
  createdAt: Date
  updatedAt: Date
}
```

#### CustomerReminder
```typescript
interface CustomerReminder {
  id: string
  userId: string
  contactId: string
  scheduleId: string
  invoiceIds: string[]
  totalAmount: number
  currency: string
  sentAt: Date
  emailStatus: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced'
  openedAt?: Date
  respondedAt?: Date
  paymentReceived?: boolean
}
```

#### ReminderSchedule
```typescript
interface ReminderSchedule {
  id: string
  userId: string
  name: string
  triggerDays: number[] // [7, 14, 30, 60, 90]
  consolidateByCustomer: boolean
  minDaysBetweenReminders: number
  templateId: string
  isActive: boolean
  createdAt: Date
}
```

## API Specifications

### Endpoints

#### GET /api/reminders/queue
**Description**: Retrieve customer-grouped reminder queue.

**Query Parameters**:
- `page`: number (default: 1)
- `limit`: number (default: 50, max: 100)
- `priority`: 'high' | 'medium' | 'low'
- `sortBy`: 'oldest_invoice' | 'total_amount' | 'last_contact'

**Response**:
```typescript
{
  customers: Array<{
    contactId: string
    name: string
    email: string
    company: string
    overdueInvoices: number
    totalAmount: number
    oldestInvoiceDays: number
    lastContactDate: Date | null
    priority: 'high' | 'medium' | 'low'
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

#### POST /api/reminders/send-consolidated
**Description**: Send consolidated reminder to specific customer.

**Request Body**:
```typescript
{
  contactId: string
  invoiceIds: string[]
  templateType: 'polite' | 'standard' | 'urgent' | 'final'
  scheduleId?: string
  sendAt?: Date // for scheduling
}
```

**Response**:
```typescript
{
  success: boolean
  reminderId?: string
  emailStatus: string
  error?: string
}
```

#### GET /api/invoices
**Description**: Retrieve invoices with filtering and pagination.

**Query Parameters**:
- `contactId`: string (filter by customer)
- `status`: 'pending' | 'overdue' | 'paid' | 'disputed'
- `dueBefore`: Date (overdue before specific date)
- `page`: number
- `limit`: number

## Testing Requirements

### Unit Tests
- Service layer business logic (consolidation, scheduling)
- Template rendering with various invoice combinations
- Email rate limiting and queue management
- PDF generation accuracy and formatting

### Integration Tests
- End-to-end reminder workflow
- Email delivery and tracking
- Database transaction integrity
- OAuth token refresh during operations

### User Acceptance Tests
- Customer consolidation reduces email volume
- Templates render correctly in Arabic and English
- Reminder timing respects minimum intervals
- Analytics accurately track collection improvements

## Cultural Considerations - UAE Market

### Business Communication Standards
- **Formal tone**: Professional language appropriate for business relationships
- **Respectful persistence**: Firm but courteous payment requests
- **Relationship focus**: Emphasis on continued partnership
- **Cultural sensitivity**: Respect for Islamic business practices

### Language Requirements
- **Arabic support**: Full template translation with proper RTL formatting
- **Bilingual PDFs**: Arabic headers with English content acceptable
- **Cultural greetings**: Appropriate opening and closing phrases
- **Number formatting**: Arabic-Indic numerals option

### Holiday and Timing Considerations
- **Prayer times**: Avoid sending during prayer hours
- **Weekend respect**: No Friday emails, consider Thursday afternoon timing
- **Ramadan sensitivity**: Adjusted reminder frequency during holy month
- **UAE holidays**: Automatic suspension during national holidays

## Success Metrics

### Quantitative Metrics
- **Email Volume**: 70% reduction in total reminder emails sent
- **Response Rate**: 25% improvement in customer response time
- **Collection Rate**: 15% increase in timely payments
- **Customer Satisfaction**: 90% positive feedback on communication

### Qualitative Metrics
- **Professional Communication**: Stakeholder approval of template tone
- **Cultural Appropriateness**: UAE business community acceptance
- **Relationship Preservation**: Reduced complaint frequency
- **Brand Enhancement**: Positive impact on company reputation

---

**Document Version**: 1.0
**Last Updated**: September 19, 2025
**Next Review**: Post-Implementation Review