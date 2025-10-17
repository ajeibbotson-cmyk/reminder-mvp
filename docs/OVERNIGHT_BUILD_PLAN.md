# Overnight Build Plan - Zero-Bug Implementation

**Date**: 2025-10-17
**Execution Window**: While you sleep
**Goal**: Complete remaining P1 tasks with ZERO new bugs
**Approach**: Defensive, incremental, test-after-every-step

---

## 🎯 Scope: What Will Be Built

### Task 1: Email Template Database Schema (2 hours)
**Status**: Not started → Complete
**Risk Level**: LOW (pure database work, no frontend changes)

### Task 2: Template API Endpoints (1.5 hours)
**Status**: Not started → Complete
**Risk Level**: LOW (CRUD API, standard patterns)

### Task 3: Seed 5 Production Templates (1 hour)
**Status**: Not started → Complete
**Risk Level**: VERY LOW (data only, no code changes)

### Task 4: Connect Modal to Database Templates (2 hours)
**Status**: Hardcoded → Database-driven
**Risk Level**: MEDIUM (requires frontend changes with careful testing)

### Task 5: Metrics Validation Script (1 hour)
**Status**: Not started → Validation tool ready
**Risk Level**: VERY LOW (read-only script, no changes)

**Total Estimated Time**: 7.5 hours
**Buffer for Testing**: 1.5 hours
**Total Window**: 9 hours (comfortable overnight)

---

## 🛡️ Safety Protocols

### Before ANY Code Changes
1. ✅ Verify build passes: `npm run build`
2. ✅ Run linter: `npm run lint`
3. ✅ Check git status (no uncommitted changes)
4. ✅ Create feature branch

### After EACH Task
1. ✅ Build verification: `npm run build`
2. ✅ Type checking: `npx tsc --noEmit`
3. ✅ Lint check: `npm run lint`
4. ✅ Commit with descriptive message
5. ✅ Test in browser (if UI changed)

### Rollback Strategy
- Every task committed separately
- If ANY task fails 3 attempts → skip and document
- Never force-push broken code
- Main branch stays clean

---

## 📋 Task 1: Email Template Database Schema

### Objective
Add `email_templates` table to Prisma schema for storing customizable email templates.

### Implementation Steps

**Step 1.1: Update Prisma Schema** (10 min)
```prisma
// Add to prisma/schema.prisma

model email_templates {
  id          String    @id @default(uuid())
  company_id  String
  name        String
  subject     String
  content     String    @db.Text
  language    Language  @default(ENGLISH)
  bucket_id   String?
  is_active   Boolean   @default(true)
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt

  company     companies @relation(fields: [company_id], references: [id], onDelete: Cascade)

  @@index([company_id])
  @@index([company_id, is_active])
  @@map("email_templates")
}

// Add relation to companies model
model companies {
  // ... existing fields
  email_templates email_templates[]
}
```

**Step 1.2: Generate Migration** (5 min)
```bash
npx prisma migrate dev --name add_email_templates_table
```

**Step 1.3: Generate Prisma Client** (2 min)
```bash
npx prisma generate
```

**Step 1.4: Verify Schema** (3 min)
```bash
npx prisma studio
# Check that email_templates table exists
```

**Safety Checks**:
- ✅ Migration created successfully
- ✅ No breaking changes to existing tables
- ✅ Prisma client regenerated
- ✅ Build still passes: `npm run build`

**Commit Message**:
```
feat(db): Add email_templates table for customizable templates

- Added email_templates model with company relation
- Indexed company_id and is_active for query performance
- Supports multi-language templates (ENGLISH/ARABIC)
- Optional bucket_id for bucket-specific templates
- Cascade delete when company is deleted

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Rollback**: `npx prisma migrate reset` (last resort only)

---

## 📋 Task 2: Template API Endpoints

### Objective
Create REST API endpoints for template CRUD operations.

### Implementation Steps

**Step 2.1: Create GET /api/templates** (20 min)
```typescript
// File: src/app/api/templates/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bucketId = searchParams.get('bucketId')
    const language = searchParams.get('language')

    const templates = await prisma.email_templates.findMany({
      where: {
        company_id: session.user.companyId,
        is_active: true,
        ...(bucketId && { bucket_id: bucketId }),
        ...(language && { language: language.toUpperCase() })
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}
```

**Step 2.2: Create POST /api/templates** (20 min)
```typescript
// Add to same file

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, subject, content, language, bucket_id } = body

    // Validation
    if (!name || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, content' },
        { status: 400 }
      )
    }

    const template = await prisma.email_templates.create({
      data: {
        company_id: session.user.companyId,
        name,
        subject,
        content,
        language: language?.toUpperCase() || 'ENGLISH',
        bucket_id: bucket_id || null,
        is_active: true
      }
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
```

**Step 2.3: Create PUT /api/templates/[id]** (20 min)
```typescript
// File: src/app/api/templates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, subject, content, language, bucket_id, is_active } = body

    // Verify template belongs to company
    const existing = await prisma.email_templates.findFirst({
      where: {
        id,
        company_id: session.user.companyId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const template = await prisma.email_templates.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(subject && { subject }),
        ...(content && { content }),
        ...(language && { language: language.toUpperCase() }),
        ...(bucket_id !== undefined && { bucket_id }),
        ...(is_active !== undefined && { is_active })
      }
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify template belongs to company
    const existing = await prisma.email_templates.findFirst({
      where: {
        id,
        company_id: session.user.companyId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Soft delete by setting is_active to false
    await prisma.email_templates.update({
      where: { id },
      data: { is_active: false }
    })

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
```

**Step 2.4: Test API Endpoints** (10 min)
```bash
# Start dev server
npm run dev

# Test GET (should return empty array initially)
curl http://localhost:3000/api/templates

# Test POST
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Template","subject":"Test","content":"Hello {customer_name}"}'

# Test GET again (should return 1 template)
curl http://localhost:3000/api/templates
```

**Safety Checks**:
- ✅ All endpoints return correct status codes
- ✅ Unauthorized requests blocked (401)
- ✅ Multi-tenant isolation working (company_id filter)
- ✅ Build passes: `npm run build`
- ✅ TypeScript happy: `npx tsc --noEmit`

**Commit Message**:
```
feat(api): Add email template CRUD endpoints

- GET /api/templates - List company templates with filters
- POST /api/templates - Create new template
- PUT /api/templates/[id] - Update existing template
- DELETE /api/templates/[id] - Soft delete template

Features:
- Multi-tenant isolation (company_id filtering)
- Optional bucket-specific templates
- Language filtering (English/Arabic)
- Soft delete (is_active flag)
- Full validation and error handling

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 📋 Task 3: Seed 5 Production Templates

### Objective
Create 5 professional email templates (3 escalation levels + 2 UAE-specific).

### Implementation Steps

**Step 3.1: Create Seed Script** (30 min)
```typescript
// File: scripts/seed-email-templates.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const templates = [
  // Level 1: Gentle Reminder
  {
    name: 'Gentle Reminder - English',
    subject: 'Friendly Payment Reminder for Invoice {invoice_number}',
    content: `Dear {customer_name},

I hope this message finds you well.

This is a friendly reminder that Invoice {invoice_number} for {invoice_amount} is now due for payment. The original due date was {due_date}.

We understand that oversights happen, and we're here to help if you have any questions about this invoice.

Payment Details:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount}
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

You can make payment via bank transfer to:
{company_bank_details}

If you've already made this payment, please disregard this message and accept our thanks.

If you have any questions or concerns, please don't hesitate to reach out.

Best regards,
{company_name}
{company_email}
{company_phone}`,
    language: 'ENGLISH',
    bucket_id: null
  },

  // Level 2: Firm Reminder
  {
    name: 'Firm Reminder - English',
    subject: 'Second Payment Reminder - Invoice {invoice_number} Now Overdue',
    content: `Dear {customer_name},

We are writing to follow up on our previous reminder regarding Invoice {invoice_number}.

Invoice Details:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount}
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

This invoice is now {days_overdue} days overdue. We kindly request that you prioritize this payment to avoid any disruption to our business relationship.

If there are any issues preventing payment, please contact us immediately so we can discuss a resolution.

Payment can be made via bank transfer to:
{company_bank_details}

We value our business relationship and look forward to resolving this matter promptly.

Regards,
{company_name}
{company_email}
{company_phone}`,
    language: 'ENGLISH',
    bucket_id: null
  },

  // Level 3: Final Notice
  {
    name: 'Final Notice - English',
    subject: 'URGENT: Final Payment Notice for Invoice {invoice_number}',
    content: `Dear {customer_name},

FINAL NOTICE - IMMEDIATE ACTION REQUIRED

Despite previous reminders, Invoice {invoice_number} remains unpaid.

Outstanding Invoice:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount}
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

This is a final notice before we are forced to take further action, which may include:
- Suspension of services
- Engaging a collection agency
- Legal proceedings

To avoid these measures, please arrange payment immediately.

Bank Transfer Details:
{company_bank_details}

If you have already made payment, please send us confirmation immediately.

For payment arrangements or to discuss this matter urgently, contact:
{company_email}
{company_phone}

We strongly encourage you to resolve this matter within the next 7 days.

{company_name}`,
    language: 'ENGLISH',
    bucket_id: null
  },

  // UAE-Specific: Respectful Reminder
  {
    name: 'UAE Respectful Reminder - English',
    subject: 'Kind Payment Reminder - Invoice {invoice_number}',
    content: `Dear Valued Customer {customer_name},

Assalamu Alaikum,

We hope this message finds you and your business in good health and prosperity.

We are writing to kindly remind you about Invoice {invoice_number} which is currently pending payment.

Invoice Summary:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount} AED
- Due Date: {due_date}
- Days Overdue: {days_overdue}

We understand that business operations can be demanding, and we greatly value our ongoing partnership with you.

Should there be any concerns or if you require any clarification regarding this invoice, please do not hesitate to contact us. We are always ready to assist and discuss any payment arrangements if needed.

Bank Transfer Details (UAE):
{company_bank_details}

We look forward to your prompt attention to this matter and thank you for your continued trust in our services.

With warm regards,
{company_name}
{company_email}
{company_phone}`,
    language: 'ENGLISH',
    bucket_id: null
  },

  // Arabic: Gentle Reminder
  {
    name: 'Gentle Reminder - Arabic',
    subject: 'تذكير ودي بالدفع - فاتورة {invoice_number}',
    content: `عزيزي/عزيزتي {customer_name},

السلام عليكم ورحمة الله وبركاته،

نأمل أن تكون بصحة جيدة وأن تسير أعمالك بشكل ممتاز.

نود تذكيرك بلطف بأن الفاتورة رقم {invoice_number} بمبلغ {invoice_amount} درهم إماراتي مستحقة الدفع. تاريخ الاستحقاق الأصلي كان {due_date}.

تفاصيل الفاتورة:
- رقم الفاتورة: {invoice_number}
- المبلغ المستحق: {invoice_amount} درهم
- تاريخ الاستحقاق: {due_date}
- عدد الأيام المتأخرة: {days_overdue}

يمكنك إجراء الدفع عن طريق التحويل البنكي إلى:
{company_bank_details}

إذا كنت قد قمت بالدفع بالفعل، يرجى تجاهل هذه الرسالة مع شكرنا لك.

إذا كان لديك أي أسئلة أو استفسارات، فلا تتردد في التواصل معنا.

مع خالص التحيات،
{company_name}
{company_email}
{company_phone}`,
    language: 'ARABIC',
    bucket_id: null
  }
]

async function main() {
  console.log('🌱 Seeding email templates...')

  // Get all companies
  const companies = await prisma.companies.findMany({
    where: { is_active: true }
  })

  if (companies.length === 0) {
    console.log('⚠️  No active companies found. Templates will be created when companies sign up.')
    return
  }

  let totalCreated = 0

  for (const company of companies) {
    console.log(`\n📧 Creating templates for: ${company.name}`)

    for (const template of templates) {
      // Check if template already exists
      const existing = await prisma.email_templates.findFirst({
        where: {
          company_id: company.id,
          name: template.name
        }
      })

      if (existing) {
        console.log(`  ⏭️  Skipping "${template.name}" (already exists)`)
        continue
      }

      await prisma.email_templates.create({
        data: {
          company_id: company.id,
          ...template
        }
      })

      console.log(`  ✅ Created "${template.name}"`)
      totalCreated++
    }
  }

  console.log(`\n🎉 Seed complete! Created ${totalCreated} templates for ${companies.length} companies.`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 3.2: Run Seed Script** (5 min)
```bash
npx tsx scripts/seed-email-templates.ts
```

**Step 3.3: Verify Templates** (5 min)
```bash
npx prisma studio
# Check email_templates table has 5 templates per company
```

**Safety Checks**:
- ✅ Templates created for all companies
- ✅ No duplicate templates
- ✅ All merge tags present: {customer_name}, {invoice_number}, etc.
- ✅ Arabic text displays correctly

**Commit Message**:
```
feat(templates): Add 5 production email templates with seed script

Templates added:
1. Gentle Reminder (English) - Friendly first contact
2. Firm Reminder (English) - Professional follow-up
3. Final Notice (English) - Urgent escalation
4. UAE Respectful Reminder (English) - Culturally appropriate
5. Gentle Reminder (Arabic) - Arabic translation

Features:
- Professional tone appropriate for UAE business culture
- All merge tags included: {customer_name}, {invoice_number}, etc.
- Escalation levels for progressive reminder sequences
- Seed script creates templates for all active companies
- No duplicates (checks before creating)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 📋 Task 4: Connect Modal to Database Templates

### Objective
Replace hardcoded templates in EmailCampaignModal with database-driven template selection.

### Implementation Steps

**Step 4.1: Read Current Modal Code** (10 min)
```bash
# Analyze how templates are currently used
head -100 src/components/invoices/email-campaign-modal.tsx
```

**Step 4.2: Create Template Fetch Hook** (15 min)
```typescript
// File: src/hooks/use-email-templates.ts

import { useState, useEffect } from 'react'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  language: string
  bucket_id: string | null
}

export function useEmailTemplates(bucketId?: string | null) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTemplates() {
      try {
        setIsLoading(true)
        setError(null)

        const params = new URLSearchParams()
        if (bucketId) {
          params.append('bucketId', bucketId)
        }

        const response = await fetch(`/api/templates?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch templates')
        }

        const data = await response.json()
        setTemplates(data.templates || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Error fetching templates:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTemplates()
  }, [bucketId])

  return { templates, isLoading, error }
}
```

**Step 4.3: Update Modal Component** (30 min)
```typescript
// In src/components/invoices/email-campaign-modal.tsx
// Find the hardcoded emailTemplates array and replace with:

import { useEmailTemplates } from '@/hooks/use-email-templates'

// Inside component:
const { templates, isLoading: templatesLoading, error: templatesError } = useEmailTemplates()

// Update template selection UI to use fetched templates:
{templatesLoading ? (
  <div>Loading templates...</div>
) : templatesError ? (
  <div className="text-red-600">Error loading templates: {templatesError}</div>
) : templates.length === 0 ? (
  <div className="text-amber-600">
    No templates available. Using default template.
  </div>
) : (
  <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate}>
    {templates.map((template) => (
      <div key={template.id} className="flex items-start space-x-2">
        <RadioGroupItem value={template.id} id={template.id} />
        <label htmlFor={template.id} className="flex-1 cursor-pointer">
          <div className="font-medium">{template.name}</div>
          <div className="text-sm text-gray-500">{template.subject}</div>
        </label>
      </div>
    ))}
  </RadioGroup>
)}
```

**Step 4.4: Graceful Fallback** (15 min)
```typescript
// Add fallback to hardcoded templates if database is empty

const FALLBACK_TEMPLATES = [
  {
    id: 'fallback-gentle',
    name: 'Gentle Reminder',
    subject: 'Payment Reminder for Invoice {invoice_number}',
    content: '...' // existing hardcoded template
  },
  // ... other fallback templates
]

// In component:
const effectiveTemplates = templates.length > 0 ? templates : FALLBACK_TEMPLATES
```

**Step 4.5: Test Modal** (20 min)
```bash
# Start dev server
npm run dev

# Navigate to dashboard
# Click "Email Selected" on a bucket
# Verify:
# 1. Templates load from database
# 2. Template selection works
# 3. Preview shows correct content
# 4. Fallback works if database is empty
```

**Safety Checks**:
- ✅ Modal opens without errors
- ✅ Templates load from database
- ✅ Selection updates preview correctly
- ✅ Fallback to hardcoded templates works
- ✅ No console errors
- ✅ Build passes: `npm run build`
- ✅ TypeScript happy: `npx tsc --noEmit`

**Commit Message**:
```
feat(modal): Connect email modal to database templates

Changes:
- Created useEmailTemplates hook for fetching templates
- Replaced hardcoded templates with database-driven selection
- Added loading and error states
- Graceful fallback to hardcoded templates if DB empty
- Maintains all existing modal functionality

Testing:
- Verified template selection works
- Confirmed preview updates correctly
- Tested with empty database (fallback works)
- No breaking changes to existing flow

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 📋 Task 5: Metrics Validation Script

### Objective
Create read-only script to validate dashboard metrics accuracy.

### Implementation Steps

**Step 5.1: Create Validation Script** (40 min)
```typescript
// File: scripts/validate-metrics.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MetricsReport {
  companyName: string
  totalInvoices: number
  totalOutstanding: number
  overdueCount: number
  overdueAmount: number
  bucketDistribution: Record<string, number>
  avgDaysOverdue: number
  oldestInvoice: {
    number: string
    daysOverdue: number
  } | null
}

async function validateMetrics() {
  console.log('📊 Validating Dashboard Metrics\n')
  console.log('=' .repeat(60))

  const companies = await prisma.companies.findMany({
    where: { is_active: true },
    include: {
      invoices: {
        where: {
          status: { in: ['SENT', 'OVERDUE'] },
          is_active: true
        }
      }
    }
  })

  const reports: MetricsReport[] = []

  for (const company of companies) {
    console.log(`\n🏢 ${company.name}`)
    console.log('-'.repeat(60))

    const invoices = company.invoices
    const totalInvoices = invoices.length

    // Calculate total outstanding
    const totalOutstanding = invoices.reduce((sum, inv) => {
      return sum + Number(inv.total_amount || inv.amount || 0)
    }, 0)

    // Calculate overdue
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueInvoices = invoices.filter(inv => {
      return new Date(inv.due_date) < today
    })

    const overdueCount = overdueInvoices.length
    const overdueAmount = overdueInvoices.reduce((sum, inv) => {
      return sum + Number(inv.total_amount || inv.amount || 0)
    }, 0)

    // Calculate bucket distribution
    const buckets = {
      'not_due': 0,
      '1-3_days': 0,
      '4-7_days': 0,
      '8-14_days': 0,
      '15-30_days': 0,
      '30+_days': 0
    }

    let totalDaysOverdue = 0
    let oldestInvoice: { number: string; daysOverdue: number } | null = null

    for (const invoice of invoices) {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysOverdue < 0) {
        buckets['not_due']++
      } else if (daysOverdue >= 1 && daysOverdue <= 3) {
        buckets['1-3_days']++
      } else if (daysOverdue >= 4 && daysOverdue <= 7) {
        buckets['4-7_days']++
      } else if (daysOverdue >= 8 && daysOverdue <= 14) {
        buckets['8-14_days']++
      } else if (daysOverdue >= 15 && daysOverdue <= 30) {
        buckets['15-30_days']++
      } else if (daysOverdue > 30) {
        buckets['30+_days']++
      }

      if (daysOverdue > 0) {
        totalDaysOverdue += daysOverdue
      }

      if (!oldestInvoice || daysOverdue > oldestInvoice.daysOverdue) {
        oldestInvoice = {
          number: invoice.number,
          daysOverdue
        }
      }
    }

    const avgDaysOverdue = overdueCount > 0 ? totalDaysOverdue / overdueCount : 0

    // Print results
    console.log(`Total Invoices: ${totalInvoices}`)
    console.log(`Total Outstanding: AED ${totalOutstanding.toFixed(2)}`)
    console.log(`Overdue Count: ${overdueCount}`)
    console.log(`Overdue Amount: AED ${overdueAmount.toFixed(2)}`)
    console.log(`Average Days Overdue: ${avgDaysOverdue.toFixed(1)} days`)

    if (oldestInvoice) {
      console.log(`Oldest Invoice: ${oldestInvoice.number} (${oldestInvoice.daysOverdue} days)`)
    }

    console.log('\nBucket Distribution:')
    Object.entries(buckets).forEach(([bucket, count]) => {
      console.log(`  ${bucket}: ${count} invoices`)
    })

    reports.push({
      companyName: company.name,
      totalInvoices,
      totalOutstanding,
      overdueCount,
      overdueAmount,
      bucketDistribution: buckets,
      avgDaysOverdue,
      oldestInvoice
    })
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📈 SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total Companies: ${companies.length}`)
  console.log(`Total Invoices: ${reports.reduce((sum, r) => sum + r.totalInvoices, 0)}`)
  console.log(`Total Outstanding: AED ${reports.reduce((sum, r) => sum + r.totalOutstanding, 0).toFixed(2)}`)
  console.log(`Total Overdue: ${reports.reduce((sum, r) => sum + r.overdueCount, 0)} invoices`)

  // Health check
  console.log('\n✅ VALIDATION COMPLETE')
  console.log('Compare these numbers with dashboard display.')
  console.log('If discrepancies found, check:')
  console.log('  1. Dashboard query filters (company_id, is_active, status)')
  console.log('  2. Date calculations (timezone, hours)')
  console.log('  3. Amount calculations (total_amount vs amount field)')
}

validateMetrics()
  .catch((e) => {
    console.error('❌ Validation failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 5.2: Run Validation** (5 min)
```bash
npx tsx scripts/validate-metrics.ts
```

**Step 5.3: Document Results** (5 min)
```bash
# Save output to file for reference
npx tsx scripts/validate-metrics.ts > metrics-validation-output.txt
```

**Safety Checks**:
- ✅ Script runs without errors
- ✅ No database modifications (read-only)
- ✅ Output is clear and readable
- ✅ All metrics calculated correctly

**Commit Message**:
```
feat(scripts): Add metrics validation script for dashboard accuracy

Script validates:
- Total invoices count
- Total outstanding amount
- Overdue count and amount
- Bucket distribution (6 buckets)
- Average days overdue
- Oldest invoice

Features:
- Read-only (no database changes)
- Per-company breakdown
- Summary across all companies
- Health check suggestions

Usage: npx tsx scripts/validate-metrics.ts

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🧪 Final Integration Testing

### Test Checklist

**Before Finishing**:
1. ✅ Run full build: `npm run build`
2. ✅ Run linter: `npm run lint`
3. ✅ TypeScript check: `npx tsc --noEmit`
4. ✅ Start dev server: `npm run dev`

**Manual Testing**:
1. ✅ Navigate to dashboard
2. ✅ Click "Email Selected" on bucket
3. ✅ Verify templates load from database
4. ✅ Select different templates
5. ✅ Verify preview updates correctly
6. ✅ Submit campaign (verify no errors)
7. ✅ Check Prisma Studio for campaign record

**Database Testing**:
1. ✅ Check email_templates table exists
2. ✅ Verify 5 templates per company
3. ✅ Check all merge tags present
4. ✅ Verify no duplicate templates

**API Testing**:
1. ✅ GET /api/templates returns templates
2. ✅ POST /api/templates creates template
3. ✅ PUT /api/templates/[id] updates template
4. ✅ DELETE /api/templates/[id] soft deletes

---

## 📊 Success Criteria

### Must Have (Zero Tolerance)
- ✅ Build passes completely
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ No runtime errors in browser
- ✅ Email modal opens without errors
- ✅ Templates load from database
- ✅ Existing functionality still works

### Should Have (Test and Document)
- ✅ All 5 templates created
- ✅ Template API endpoints working
- ✅ Modal uses database templates
- ✅ Metrics validation script runs
- ✅ All commits have good messages

### Nice to Have (Document if Skipped)
- ✅ Template CRUD UI (can be built later)
- ✅ Template preview in selection
- ✅ Bucket-specific template filtering

---

## 🚨 Failure Handling

### If Task Fails After 3 Attempts
1. Document the failure in `OVERNIGHT_BUILD_NOTES.md`
2. Revert changes: `git reset --hard HEAD~1`
3. Skip task and move to next
4. Mark task as "BLOCKED" with reason

### If Build Breaks
1. Immediately revert last commit
2. Document error in detail
3. Do NOT proceed with remaining tasks
4. Leave clear note about what broke

### If Test Fails
1. Check if it's a new failure (caused by changes)
2. If new: revert changes, investigate
3. If pre-existing: document and proceed
4. Never ignore test failures caused by new code

---

## 📝 Completion Report Template

```markdown
# Overnight Build Completion Report

**Start Time**: [timestamp]
**End Time**: [timestamp]
**Duration**: [hours]

## Tasks Completed
- [x] Task 1: Email Template Schema ✅
- [x] Task 2: Template API Endpoints ✅
- [x] Task 3: Seed Production Templates ✅
- [x] Task 4: Connect Modal to Database ✅
- [x] Task 5: Metrics Validation Script ✅

## Commits Created
1. [commit hash] - Email template schema
2. [commit hash] - Template API endpoints
3. [commit hash] - Production templates seed
4. [commit hash] - Modal database integration
5. [commit hash] - Metrics validation script

## Build Status
- Build: ✅ PASSING
- TypeScript: ✅ NO ERRORS
- ESLint: ✅ NO ERRORS
- Tests: 62% passing (unchanged)

## New Features
- 5 professional email templates (3 EN, 1 UAE-EN, 1 AR)
- Template CRUD API endpoints
- Database-driven template selection
- Metrics validation script

## Known Issues
- None introduced

## Manual Testing Needed
- Test email sending with database templates
- Verify templates render correctly in emails
- Test with POP Trading invoice data

## Next Steps
1. Test with real invoice data
2. Build template management UI (optional)
3. AWS SES domain verification

## Notes
[Any observations, concerns, or recommendations]
```

---

## 🎯 Summary

**Approach**: Defensive, incremental, test-after-every-step
**Risk Level**: LOW (mostly backend/database work)
**Estimated Time**: 7.5 hours + 1.5 hours testing = 9 hours
**Rollback Strategy**: Every task committed separately, easy to revert

**What Will Be Built**:
1. Email template database schema
2. Template CRUD API endpoints
3. 5 production-ready templates
4. Database-driven template selection in modal
5. Metrics validation script

**What Will NOT Be Built** (out of scope):
- Template management UI (can be built later)
- Auto-send scheduler (Week 5+)
- Email open/click tracking (future enhancement)

**Safety Protocols**:
- Build verification after every task
- Separate commits for easy rollback
- Skip task after 3 failed attempts
- Stop immediately if build breaks

**Your Action Required**:
- Review this plan
- Approve to proceed
- Sleep well knowing zero bugs will be introduced 😊
