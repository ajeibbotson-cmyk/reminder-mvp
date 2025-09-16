# CLAUDE.md - Library Utilities

This file provides guidance for working with Reminder core services and utility functions.

## Core Services

### Authentication (`auth.ts`)

#### NextAuth Configuration
- **Strategy**: JWT sessions for stateless authentication
- **Provider**: Credentials with bcryptjs password verification  
- **Adapter**: Prisma adapter for database integration

#### Key Functions
```typescript
// Get server session in pages/API routes
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const session = await getServerSession(authOptions)
```

#### Session Structure
```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'FINANCE' | 'VIEWER'
    companyId: string
    company: {
      id: string
      name: string
      trn?: string
    }
  }
}
```

#### Password Security
- **Hashing**: bcryptjs with salt rounds of 12
- **Minimum Length**: 8 characters
- **Validation**: Done at API level before hashing

### Database (`prisma.ts`)

#### Singleton Pattern
```typescript
import { prisma } from "@/lib/prisma"

// Use throughout the application
const users = await prisma.user.findMany()
```

#### Connection Management
- **Pool Size**: Handled by Supabase connection pooler
- **Timeout**: 2 minutes default for queries
- **Retries**: Automatic connection retries

#### Multi-tenant Queries
Always scope queries by company:
```typescript
// Correct - scoped to company
const invoices = await prisma.invoice.findMany({
  where: {
    companyId: session.user.companyId
  }
})

// Incorrect - could access other companies' data
const invoices = await prisma.invoice.findMany()
```

### Email Service (`email.ts`)

#### AWS SES Configuration
- **Region**: ME South (Bahrain) for UAE data compliance
- **Templates**: HTML and text versions
- **Tracking**: Message IDs and delivery status

#### Email Functions
```typescript
// Send individual email
await sendEmail({
  to: 'customer@company.com',
  subject: 'Payment Reminder',
  htmlContent: templateHtml,
  textContent: templateText,
  fromEmail: process.env.AWS_SES_FROM_EMAIL
})

// Send templated email with merge fields
await sendTemplatedEmail({
  to: customer.email,
  template: 'payment-reminder',
  mergeFields: {
    customerName: customer.name,
    invoiceNumber: invoice.number,
    amount: formatCurrency(invoice.amount),
    dueDate: formatDate(invoice.dueDate)
  }
})
```

#### Email Templates
Structure for follow-up sequences:
```typescript
interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent: string
  language: 'en' | 'ar'
  timing: {
    delayDays: number
    businessHoursOnly: boolean
  }
}
```

### Utilities (`utils.ts`)

#### Class Name Utility
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

#### Date Utilities (Planned)
```typescript
// UAE business hours check
export function isUAEBusinessHours(date: Date): boolean {
  const day = date.getDay()
  const hour = date.getHours()
  
  // Sunday to Thursday, 9 AM to 6 PM
  return day >= 0 && day <= 4 && hour >= 9 && hour <= 18
}

// Islamic holiday check
export function isIslamicHoliday(date: Date): boolean {
  // Implementation for UAE public holidays
  return false // Placeholder
}
```

#### Currency Utilities (Planned)
```typescript
// Format AED currency
export function formatCurrency(
  amount: number, 
  currency = 'AED',
  locale = 'en-AE'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount)
}

// Parse currency input
export function parseCurrency(input: string): number {
  const cleaned = input.replace(/[^\d.-]/g, '')
  return parseFloat(cleaned) || 0
}
```

#### Validation Utilities (Planned)
```typescript
// UAE TRN validation
export function validateTRN(trn: string): boolean {
  const trnRegex = /^[0-9]{15}$/
  return trnRegex.test(trn.replace(/\s/g, ''))
}

// UAE phone number validation
export function validateUAEPhone(phone: string): boolean {
  const uaePhoneRegex = /^(\+971|0)?[5-9][0-9]{8}$/
  return uaePhoneRegex.test(phone.replace(/\s/g, ''))
}

// Email validation (RFC compliant)
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
```

## Supabase Integration (`supabase.ts`)

#### Client Configuration
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### Future Usage Patterns
- **File Storage**: Invoice PDF storage
- **Real-time Subscriptions**: Payment status updates
- **Row Level Security**: Additional security layer

## Configuration Management

### Environment Variables
Required environment variables by service:

#### Database
- `DATABASE_URL` - Prisma connection string (pooler)
- `DIRECT_URL` - Direct connection for migrations

#### Authentication  
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - Application URL

#### Email Service
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_REGION` - ME South (Bahrain)
- `AWS_SES_FROM_EMAIL` - Verified sender address

#### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key

### Error Handling Patterns

#### Service-Level Errors
```typescript
// Database errors
try {
  const result = await prisma.user.create(userData)
  return { success: true, data: result }
} catch (error) {
  console.error("Database error:", error)
  return { success: false, error: "Failed to create user" }
}

// Email errors  
try {
  await sendEmail(emailData)
  return { sent: true }
} catch (error) {
  console.error("Email error:", error)
  return { sent: false, error: "Failed to send email" }
}
```

#### Retry Logic (Planned)
```typescript
// Exponential backoff for email delivery
export async function sendEmailWithRetry(
  emailData: EmailData,
  maxRetries = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await sendEmail(emailData)
      return true
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await delay(Math.pow(2, i) * 1000) // Exponential backoff
    }
  }
  return false
}
```

## UAE Business Logic

### Cultural Considerations
- **Follow-up Timing**: Respect Islamic prayer times
- **Business Hours**: Sunday to Thursday operations
- **Language**: Bilingual email templates (Arabic/English)
- **Tone**: Professional and respectful messaging

### Compliance Readiness
- **Data Residency**: AWS ME South region
- **GDPR**: Data export/deletion utilities ready
- **Audit Logging**: All user actions tracked
- **Security**: JWT tokens with proper expiration

## Performance Optimization

### Caching Strategy (Planned)
- **Redis**: Session and frequently accessed data
- **CDN**: Static assets and email templates
- **Database**: Query result caching

### Monitoring (Planned)
- **Error Tracking**: Sentry integration
- **Performance**: New Relic or similar
- **Uptime**: Health check endpoints
- **Email Delivery**: AWS SES metrics