# 📡 EXISTING REMINDER API ENDPOINTS
## Current Production API Architecture Analysis

**Purpose**: Document existing Reminder API endpoints to inform unified platform integration
**Context**: Foundation for merging with SendAChaser email automation capabilities
**Updated**: September 28, 2025

---

## 🏗️ API ARCHITECTURE OVERVIEW

### **Framework & Patterns**
- **Next.js 15 App Router**: Route handlers in `src/app/api/`
- **Authentication**: NextAuth.js with JWT sessions
- **Database**: Prisma ORM with PostgreSQL (Supabase)
- **Validation**: Zod schemas for input validation
- **Error Handling**: Standardized error responses with logging
- **Multi-tenancy**: Company-scoped data isolation on all endpoints

### **Response Format Standards**
```typescript
// Success Response
{
  message: "Success message",
  data: result,
  pagination?: PaginationInfo,
  insights?: BusinessInsights
}

// Error Response
{
  error: "Error message",
  details?: ValidationErrors
}
```

---

## 📊 INVOICE MANAGEMENT ENDPOINTS

### **Core Invoice Operations**

#### `GET /api/invoices`
**Purpose**: Fetch company invoices with advanced filtering and pagination
**Features**:
- ✅ Multi-tenant data isolation (`company_id` scoping)
- ✅ Advanced filtering (status, amount, date ranges, UAE TRN)
- ✅ Full-text search (English/Arabic support)
- ✅ Pagination with metadata
- ✅ Business insights calculation
- ✅ Related data includes (customers, payments, email logs)

**Key Filters**:
```typescript
{
  status?: InvoiceStatus
  customerEmail?: string
  startDate?: Date
  endDate?: Date
  dueDateStart?: Date
  dueDateEnd?: Date
  minAmount?: number
  maxAmount?: number
  currency?: string
  trnNumber?: string  // UAE business compliance
  search?: string     // Multi-field search
  isOverdue?: boolean
  hasPayments?: boolean
  sortBy?: 'number'|'customerName'|'amount'|'dueDate'|'status'
  sortOrder?: 'asc'|'desc'
  page?: number
  limit?: number
}
```

**Response Data**:
```typescript
{
  invoices: EnhancedInvoice[]  // With computed fields
  pagination: PaginationInfo
  statusCounts: Record<InvoiceStatus, number>
  insights: {
    totalOutstanding: number
    totalOverdue: number
    overdueCount: number
    averageAmount: number
    formatted: { // UAE currency formatting
      totalOutstanding: string
      totalOverdue: string
    }
  }
}
```

#### `POST /api/invoices` (Planned)
**Purpose**: Create new invoice
**Features**: Full invoice creation with line items and VAT

#### `PUT /api/invoices/[id]` (Planned)
**Purpose**: Update existing invoice
**Features**: Partial updates with audit logging

### **Specialized Invoice Operations**

#### `POST /api/invoices/bulk`
**Purpose**: Bulk invoice operations (create, update, delete)
**Features**: Batch processing with transaction safety

#### `POST /api/invoices/upload-pdf`
**Purpose**: PDF invoice extraction and processing
**Features**:
- ✅ 93% accuracy PDF extraction (POP Trading validated)
- ✅ Multi-file upload support
- ✅ Automatic data extraction and validation

#### `GET /api/invoices/search`
**Purpose**: Advanced invoice search with autocomplete
**Features**: Real-time search suggestions

#### `POST /api/invoices/bulk-update-status`
**Purpose**: Bulk status updates for multiple invoices
**Features**: Mass status changes with validation

#### `GET /api/invoices/bulk-status`
**Purpose**: Get bulk operation status and progress
**Features**: Real-time progress tracking

### **Invoice Email Integration** (🎯 Key for Unification)

#### `POST /api/invoices/[id]/send-email`
**Purpose**: Send individual invoice email with template support
**Features**:
- ✅ Template-based email composition
- ✅ Custom content override capability
- ✅ Email suppression list checking
- ✅ UAE business hours scheduling
- ✅ Multi-language support (English/Arabic)
- ✅ Activity logging and audit trail

**Request Schema**:
```typescript
{
  templateId?: string          // Email template to use
  recipientEmail?: string      // Override customer email
  recipientName?: string       // Override customer name
  subject?: string             // Custom subject override
  content?: string             // Custom content override
  language: 'ENGLISH' | 'ARABIC'
  scheduleForBusinessHours: boolean
  sendImmediately: boolean
}
```

**Integration Points for Unification**:
- 🔗 Template system ready for enhancement
- 🔗 Email service integration pattern established
- 🔗 Audit logging infrastructure in place
- 🔗 Multi-language support framework ready

#### `GET /api/invoices/[id]/send-email`
**Purpose**: Get email sending options and templates for invoice
**Features**:
- ✅ Available template listing
- ✅ Email history for invoice
- ✅ Suppression status checking
- ✅ Suggested template recommendation
- ✅ Current invoice status analysis

**Response Data**:
```typescript
{
  invoice: InvoiceDetails
  templates: EmailTemplate[]
  suggestedTemplate: EmailTemplate
  emailHistory: EmailLogEntry[]
  restrictions: {
    isEmailSuppressed: boolean
    suppressionReason?: string
    canSendEmail: boolean
  }
}
```

---

## 👥 CUSTOMER MANAGEMENT ENDPOINTS

### **Core Customer Operations**

#### `GET /api/customers`
**Purpose**: List company customers with filtering
**Features**: Similar advanced filtering as invoices

#### `POST /api/customers`
**Purpose**: Create new customer
**Features**: UAE business fields (TRN, business type)

#### `GET /api/customers/[id]`
**Purpose**: Get customer details with invoice history
**Features**: Complete customer profile with relationships

#### `PUT /api/customers/[id]`
**Purpose**: Update customer information
**Features**: Partial updates with validation

### **Specialized Customer Operations**

#### `POST /api/customers/bulk`
**Purpose**: Bulk customer operations
**Features**: CSV import and batch processing

#### `GET /api/customers/search`
**Purpose**: Customer search and autocomplete
**Features**: Real-time search with suggestion

#### `POST /api/customers/extract`
**Purpose**: Extract customer data from external sources
**Features**: Data extraction and validation

#### `GET /api/customers/analytics`
**Purpose**: Customer analytics and insights
**Features**: Payment behavior and risk analysis

---

## 💰 PAYMENT MANAGEMENT ENDPOINTS

### **Core Payment Operations**

#### `GET /api/payments`
**Purpose**: List payments with filtering
**Features**: Payment history and reconciliation data

#### `POST /api/payments`
**Purpose**: Record new payment
**Features**: Manual payment entry with validation

#### `GET /api/payments/[id]`
**Purpose**: Get payment details
**Features**: Full payment information with invoice links

#### `PUT /api/payments/[id]`
**Purpose**: Update payment information
**Features**: Payment modifications with audit trail

### **Specialized Payment Operations**

#### `POST /api/payments/reconcile`
**Purpose**: Payment reconciliation workflows
**Features**: Bank statement matching

#### `POST /api/payments/webhook`
**Purpose**: Payment provider webhooks (Stripe)
**Features**: Automated payment processing

#### `POST /api/payments/create-intent`
**Purpose**: Create payment intent for online payments
**Features**: Stripe integration for AED payments

#### `GET /api/payments/workflow`
**Purpose**: Payment workflow management
**Features**: Approval and verification workflows

---

## 🔐 AUTHENTICATION ENDPOINTS

### **NextAuth Integration**

#### `GET/POST /api/auth/[...nextauth]`
**Purpose**: NextAuth.js authentication handler
**Features**:
- ✅ Email/password authentication
- ✅ Session management with JWT
- ✅ User role-based access control
- ✅ Company-scoped authentication

#### `POST /api/auth/signup`
**Purpose**: User and company registration
**Features**:
- ✅ Atomic user + company creation
- ✅ Role assignment (ADMIN, FINANCE, VIEWER)
- ✅ UAE business validation (TRN, business type)
- ✅ Password strength validation

**Registration Flow**:
```typescript
{
  // User information
  name: string
  email: string
  password: string

  // Company information
  companyName: string
  trn?: string              // UAE Trade Registration Number
  address?: string
  businessType?: UaeBusinessType

  // System fields
  role: UserRole            // ADMIN for company creator
}
```

---

## 📧 EMAIL SYSTEM ENDPOINTS (Current Foundation)

### **Email Template Management**

#### Email Templates (Database-driven)
**Current Tables**: `email_templates`, `email_logs`
**Features**:
- ✅ Multi-language templates (English/Arabic)
- ✅ Template variables and merge tags
- ✅ UAE business hours scheduling
- ✅ Template versioning and activation

### **Email Delivery System**

#### Email Service Integration
**Current Implementation**: AWS SES via `@/lib/email-service`
**Features**:
- ✅ Template rendering with variables
- ✅ Delivery status tracking
- ✅ Bounce and complaint handling
- ✅ Email suppression list management

**Email Log Schema** (Ready for Enhancement):
```typescript
{
  id: string
  template_id?: string
  company_id: string
  invoice_id?: string
  customer_id?: string
  recipient_email: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC'
  delivery_status: EmailDeliveryStatus
  sent_at?: Date
  delivered_at?: Date
  opened_at?: Date
  clicked_at?: Date
  // ... tracking fields
}
```

---

## 🎯 INTEGRATION OPPORTUNITIES

### **Ready for SendAChaser Integration**

#### 1. **Email Infrastructure** ✅
- **Templates**: Existing system ready for bulk campaign enhancement
- **Delivery**: AWS SES foundation ready for OAuth provider integration
- **Tracking**: Email logs ready for campaign association
- **Suppression**: Bounce handling ready for deliverability enhancement

#### 2. **Customer Data** ✅
- **Contact Management**: Customer system ready for bulk email features
- **Custom Fields**: Schema ready for merge tag expansion
- **Search**: Advanced filtering ready for campaign targeting

#### 3. **Authentication & Authorization** ✅
- **Multi-tenant**: Company isolation ready for campaign scoping
- **Role-based**: Permission system ready for campaign access control
- **Session Management**: NextAuth ready for OAuth provider integration

#### 4. **API Patterns** ✅
- **Validation**: Zod schemas ready for campaign endpoint validation
- **Error Handling**: Standardized error responses ready for campaign APIs
- **Pagination**: Advanced pagination ready for campaign listing
- **Audit Logging**: Activity system ready for campaign tracking

### **Missing Capabilities** (SendAChaser Will Add)

#### 1. **Bulk Email Operations**
- ❌ Campaign creation and management
- ❌ Bulk email sending with rate limiting
- ❌ OAuth provider integration (Gmail/Outlook)
- ❌ Email queue processing
- ❌ Advanced email analytics

#### 2. **Campaign Management**
- ❌ Campaign workflow automation
- ❌ A/B testing framework
- ❌ Email sequence automation
- ❌ Performance analytics dashboard

#### 3. **Email Provider Integration**
- ❌ Gmail API integration
- ❌ Outlook API integration
- ❌ OAuth token management
- ❌ Provider-specific rate limiting

---

## 🛠️ TECHNICAL SPECIFICATIONS

### **Request/Response Patterns**

#### Authentication Pattern
```typescript
// All protected endpoints use this pattern
const session = await getServerSession(authOptions)
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Company isolation
const companyId = session.user.companyId
const data = await prisma.table.findMany({
  where: { company_id: companyId }
})
```

#### Error Handling Pattern
```typescript
try {
  // Business logic
  return NextResponse.json({ success: true, data })
} catch (error) {
  console.error('API Error:', error)

  if (error instanceof z.ZodError) {
    return NextResponse.json({
      error: 'Invalid request data',
      details: error.errors
    }, { status: 400 })
  }

  return NextResponse.json({
    error: 'Internal server error'
  }, { status: 500 })
}
```

#### Input Validation Pattern
```typescript
const schema = z.object({
  field: z.string().min(1),
  email: z.string().email(),
  amount: z.number().positive()
})

const validatedData = schema.parse(await request.json())
```

### **Database Access Patterns**

#### Multi-tenant Query Pattern
```typescript
// Always include company_id for data isolation
const records = await prisma.table.findMany({
  where: {
    company_id: session.user.companyId,
    // ... other filters
  },
  include: {
    // ... related data
  }
})
```

#### Pagination Pattern
```typescript
const skip = (page - 1) * limit
const [data, totalCount] = await Promise.all([
  prisma.table.findMany({ where, skip, take: limit }),
  prisma.table.count({ where })
])

return {
  data,
  pagination: {
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    hasMore: skip + data.length < totalCount
  }
}
```

---

## 📊 PERFORMANCE CHARACTERISTICS

### **Current Performance Metrics**
- **Average Response Time**: < 500ms for list endpoints
- **Database Queries**: Optimized with proper indexing
- **Pagination**: Efficient offset-based pagination
- **Parallel Processing**: Concurrent database queries where possible

### **Scalability Considerations**
- **Connection Pooling**: Supabase handles automatically
- **Query Optimization**: Strategic use of `include` vs `select`
- **Caching**: Ready for Redis integration if needed
- **Rate Limiting**: Ready for implementation on campaign endpoints

---

## 🎯 NEXT STEPS FOR UNIFICATION

### **Priority 1: Campaign Endpoints** (Week 1-2)
- `POST /api/campaigns` - Create email campaign from invoices
- `GET /api/campaigns` - List company campaigns with analytics
- `POST /api/campaigns/[id]/send` - Execute campaign with progress tracking
- `GET /api/campaigns/[id]/progress` - Real-time campaign progress

### **Priority 2: Email Provider Integration** (Week 2-3)
- `POST /api/email-providers` - Add OAuth provider (Gmail/Outlook)
- `GET /api/email-providers` - List active providers
- `POST /api/email-providers/[id]/refresh` - Refresh OAuth tokens
- `DELETE /api/email-providers/[id]` - Remove provider

### **Priority 3: Enhanced Analytics** (Week 3-4)
- `GET /api/analytics/campaigns` - Campaign performance analytics
- `GET /api/analytics/customers` - Customer engagement analytics
- `GET /api/analytics/emails` - Email deliverability analytics

This foundation provides a solid base for integrating SendAChaser's bulk email capabilities while maintaining Reminder's production-grade multi-tenant architecture! 🚀