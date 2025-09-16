# CLAUDE.md - Database Schema

This file provides guidance for working with the Reminder database schema and Prisma ORM.

## Database Architecture

### Multi-tenant Design
Reminder uses a **shared database, shared schema** multi-tenancy model where:
- All companies share the same database and tables
- Data isolation is enforced through `companyId` foreign keys
- Row-level security ensures companies only access their own data

### Core Database Entities

#### User Management
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String?
  companyId String   @map("company_id")
  role      UserRole @default(FINANCE)
  
  // Relations
  company    Company     @relation(fields: [companyId], references: [id])
  accounts   Account[]   // NextAuth tables
  sessions   Session[]   // NextAuth tables
  activities Activity[]  // Audit logging
}

enum UserRole {
  ADMIN    // Full access, user management
  FINANCE  // Invoice and payment management  
  VIEWER   // Read-only access
}
```

#### Company Management
```prisma
model Company {
  id        String   @id @default(cuid())
  name      String
  trn       String?  @unique // UAE Trade Registration Number
  address   String?
  settings  Json?    @default("{}")
  
  // Relations - all company data
  users             User[]
  invoices          Invoice[]
  customers         Customer[]
  followUpSequences FollowUpSequence[]
  activities        Activity[]
}
```

### Business Logic Models

#### Invoice Management
```prisma
model Invoice {
  id               String        @id @default(cuid())
  companyId        String        @map("company_id")
  number           String        // Company-unique invoice number
  customerName     String        @map("customer_name")
  customerEmail    String        @map("customer_email")  
  amount           Decimal       @db.Decimal(10, 2) // AED amounts
  currency         String        @default("AED")
  dueDate          DateTime      @map("due_date")
  status           InvoiceStatus @default(SENT)
  description      String?
  notes            String?
  
  // Relations
  company       Company        @relation(fields: [companyId], references: [id])
  customer      Customer?      @relation(fields: [customerEmail, companyId], references: [email, companyId])
  items         InvoiceItem[]  // Line items
  payments      Payment[]      // Payment reconciliation
  followUpLogs  FollowUpLog[]  // Email automation
  
  @@unique([companyId, number]) // Invoice numbers unique per company
}

enum InvoiceStatus {
  DRAFT       // Not yet sent
  SENT        // Sent to customer
  OVERDUE     // Past due date
  PAID        // Fully paid
  DISPUTED    // Customer dispute
  WRITTEN_OFF // Bad debt
}
```

#### Customer Relationships
```prisma
model Customer {
  id           String  @id @default(cuid())
  companyId    String  @map("company_id")
  name         String
  email        String
  phone        String?
  paymentTerms Int?    @map("payment_terms") // Days
  notes        String?
  
  // Relations
  company  Company   @relation(fields: [companyId], references: [id])
  invoices Invoice[] // All customer invoices
  
  @@unique([email, companyId]) // Email unique per company
}
```

### Follow-up Automation System

#### Email Sequences
```prisma
model FollowUpSequence {
  id        String   @id @default(cuid())
  companyId String   @map("company_id")
  name      String   // "3-Step Gentle Reminder"
  steps     Json     // Array of step configurations
  active    Boolean  @default(true)
  
  // Relations
  company      Company       @relation(fields: [companyId], references: [id])
  followUpLogs FollowUpLog[] // Execution history
}

// Step configuration structure in JSON:
{
  "steps": [
    {
      "stepNumber": 1,
      "delayDays": 3,
      "subject": "Friendly Payment Reminder",
      "templateId": "gentle-reminder-1",
      "language": "en"
    },
    {
      "stepNumber": 2, 
      "delayDays": 7,
      "subject": "Second Payment Reminder", 
      "templateId": "gentle-reminder-2",
      "language": "en"
    }
  ]
}
```

#### Email Delivery Tracking
```prisma
model FollowUpLog {
  id                  String    @id @default(cuid())
  invoiceId           String    @map("invoice_id")
  sequenceId          String    @map("sequence_id")
  stepNumber          Int       @map("step_number")
  emailAddress        String    @map("email_address")
  subject             String
  content             String    @db.Text
  sentAt              DateTime  @map("sent_at")
  emailOpened         DateTime? @map("email_opened")
  emailClicked        DateTime? @map("email_clicked")
  responseReceived    DateTime? @map("response_received")
  awsMessageId        String?   @map("aws_message_id")
  deliveryStatus      String?   @map("delivery_status")
  
  // Relations
  invoice  Invoice          @relation(fields: [invoiceId], references: [id])
  sequence FollowUpSequence @relation(fields: [sequenceId], references: [id])
}
```

### Payment Tracking

#### Payment Records
```prisma
model Payment {
  id          String      @id @default(cuid())
  invoiceId   String      @map("invoice_id")
  amount      Decimal     @db.Decimal(10, 2)
  paymentDate DateTime    @map("payment_date")
  method      PaymentMethod @default(BANK_TRANSFER)
  reference   String?     // Bank reference, cheque number, etc.
  notes       String?
  
  // Relations
  invoice Invoice @relation(fields: [invoiceId], references: [id])
}

enum PaymentMethod {
  BANK_TRANSFER
  CREDIT_CARD
  CASH
  CHEQUE
  OTHER
}
```

### Audit Logging

#### Activity Tracking
```prisma
model Activity {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  userId      String   @map("user_id")
  type        String   // "invoice_created", "payment_recorded", etc.
  description String   // Human-readable description
  metadata    Json?    @default("{}") // Additional context
  createdAt   DateTime @default(now()) @map("created_at")
  
  // Relations
  company Company @relation(fields: [companyId], references: [id])
  user    User    @relation(fields: [userId], references: [id])
}
```

## Database Development Workflow

### Schema Modifications
```bash
# 1. Edit schema.prisma
# 2. Push changes to development database
npx prisma db push

# 3. Generate new Prisma client  
npx prisma generate

# 4. For production, create migration
npx prisma migrate dev --name describe_change
```

### Seeding Development Data
```bash
# Run seed script (when implemented)
npx prisma db seed
```

### Database Administration
```bash
# Visual database browser
npx prisma studio

# Reset database (development only)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

## Query Patterns

### Multi-tenant Queries
Always include `companyId` filter:
```typescript
// Get company's invoices
const invoices = await prisma.invoice.findMany({
  where: {
    companyId: session.user.companyId
  },
  include: {
    customer: true,
    items: true,
    payments: true
  }
})

// Get invoice with validation
const invoice = await prisma.invoice.findFirst({
  where: {
    id: invoiceId,
    companyId: session.user.companyId // Security check
  }
})
```

### Aggregation Queries
```typescript
// Company dashboard KPIs
const stats = await prisma.invoice.aggregate({
  where: {
    companyId: session.user.companyId
  },
  _sum: {
    amount: true
  },
  _count: {
    id: true
  }
})

// Overdue amounts
const overdue = await prisma.invoice.aggregate({
  where: {
    companyId: session.user.companyId,
    status: 'OVERDUE',
    dueDate: {
      lt: new Date()
    }
  },
  _sum: {
    amount: true
  }
})
```

### Complex Relationships
```typescript
// Invoice with full payment history
const invoiceDetails = await prisma.invoice.findUnique({
  where: { id: invoiceId },
  include: {
    customer: true,
    items: true,
    payments: {
      orderBy: { paymentDate: 'desc' }
    },
    followUpLogs: {
      include: { sequence: true },
      orderBy: { sentAt: 'desc' }
    }
  }
})
```

## UAE-Specific Database Considerations

### Currency Handling
- All monetary values stored as `Decimal(10, 2)` for precision
- Default currency is AED across all tables
- Support for multi-currency if needed in future

### TRN (Trade Registration Number)
- 15-digit unique identifier for UAE companies
- Validation at application level before database insert
- Optional field as not all SMEs have TRN initially

### Cultural Data Points
- Arabic names supported in all text fields (UTF-8)
- Business hours consideration for follow-up timing
- Islamic calendar support for date calculations

## Performance Considerations

### Database Indexing
Key indexes for performance:
- `Invoice.companyId` - Multi-tenant filtering
- `Invoice.customerEmail` - Customer lookups  
- `Invoice.dueDate` - Overdue calculations
- `FollowUpLog.sentAt` - Email delivery tracking
- `Activity.createdAt` - Audit log queries

### Connection Pooling
- Supabase handles connection pooling automatically
- PgBouncer configuration optimized for serverless
- Connection limits managed at infrastructure level

### Query Optimization
- Use appropriate `include` vs `select` for data fetching
- Implement pagination for large result sets
- Consider database views for complex aggregations

## Data Migration Patterns

### Adding New Fields
```prisma
// Always make new fields optional initially
model Invoice {
  // existing fields...
  newField String? // Optional during migration
}
```

### Changing Data Types
```bash
# Create migration for breaking changes
npx prisma migrate dev --name convert_field_type

# Handle data transformation in migration SQL
```

### Backfilling Data
```typescript
// Script pattern for data backfill
const invoices = await prisma.invoice.findMany({
  where: { newField: null }
})

for (const invoice of invoices) {
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { newField: calculateValue(invoice) }
  })
}
```

## Security Best Practices

### Row Level Security (Future)
Consider implementing Postgres RLS for additional security:
```sql
-- Example RLS policy
CREATE POLICY company_isolation ON invoices 
  FOR ALL TO authenticated 
  USING (company_id = current_setting('app.current_company_id'));
```

### Sensitive Data Handling
- Never log sensitive data (passwords, payment details)
- Use environment variables for database credentials
- Implement soft deletes for audit trail preservation
- Encrypt sensitive fields if required by compliance