# Customer Consolidation Technical Specifications

## Overview

This document provides detailed technical specifications for implementing customer-consolidated payment reminders in the reminder-mvp application. The implementation builds on existing infrastructure while adding intelligent customer grouping and consolidated email capabilities.

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     reminder-mvp                           │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 15 + TypeScript)                        │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Consolidation   │  │ Enhanced        │                  │
│  │ Queue Dashboard │  │ Analytics       │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Customer        │  │ Enhanced Email  │                  │
│  │ Consolidation   │  │ Scheduling      │                  │
│  │ Service         │  │ Service         │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL + Prisma)                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ customer_       │  │ Enhanced        │                  │
│  │ consolidated_   │  │ email_logs      │                  │
│  │ reminders       │  │                 │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Integration with Existing Systems

**Existing Infrastructure Utilized:**
- `follow_up_sequences` - Automation framework
- `email_scheduling_service` - UAE business hours compliance
- `customer_analytics_service` - Payment behavior analysis
- `cultural_compliance_service` - Islamic calendar and prayer times
- `email_templates` - Template management and rendering
- `uae_business_hours_service` - Cultural timing compliance

## Database Schema Specifications

### New Table: customer_consolidated_reminders

```sql
CREATE TABLE customer_consolidated_reminders (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

  -- Consolidation details
  invoice_ids UUID[] NOT NULL CHECK (array_length(invoice_ids, 1) >= 2),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  currency VARCHAR(3) DEFAULT 'AED' CHECK (currency IN ('AED', 'USD', 'EUR', 'GBP')),
  invoice_count INTEGER GENERATED ALWAYS AS (array_length(invoice_ids, 1)) STORED,

  -- Reminder details
  reminder_type VARCHAR(50) DEFAULT 'CONSOLIDATED' CHECK (reminder_type IN ('CONSOLIDATED', 'URGENT_CONSOLIDATED', 'FINAL_CONSOLIDATED')),
  escalation_level VARCHAR(20) DEFAULT 'POLITE' CHECK (escalation_level IN ('POLITE', 'FIRM', 'URGENT', 'FINAL')),
  template_id UUID REFERENCES email_templates(id),

  -- Scheduling and delivery
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status email_delivery_status DEFAULT 'QUEUED',

  -- Contact management
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_eligible_contact TIMESTAMP WITH TIME ZONE,
  contact_interval_days INTEGER DEFAULT 7 CHECK (contact_interval_days > 0),

  -- Priority and metadata
  priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0),
  consolidation_reason TEXT,
  business_rules_applied JSONB DEFAULT '{}',
  cultural_compliance_flags JSONB DEFAULT '{}',

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_invoice_count CHECK (array_length(invoice_ids, 1) <= 25),
  CONSTRAINT valid_scheduling CHECK (
    (scheduled_for IS NULL AND sent_at IS NOT NULL) OR
    (scheduled_for IS NOT NULL AND sent_at IS NULL) OR
    (scheduled_for IS NULL AND sent_at IS NULL)
  )
);

-- Performance indexes
CREATE INDEX idx_ccr_customer_company ON customer_consolidated_reminders(customer_id, company_id);
CREATE INDEX idx_ccr_scheduled_delivery ON customer_consolidated_reminders(scheduled_for, delivery_status) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_ccr_priority_queue ON customer_consolidated_reminders(priority_score DESC, created_at) WHERE delivery_status = 'QUEUED';
CREATE INDEX idx_ccr_contact_eligibility ON customer_consolidated_reminders(customer_id, next_eligible_contact);
CREATE INDEX idx_ccr_company_analytics ON customer_consolidated_reminders(company_id, sent_at, delivery_status);

-- Analytics indexes
CREATE INDEX idx_ccr_effectiveness ON customer_consolidated_reminders(company_id, escalation_level, delivery_status, sent_at);
CREATE INDEX idx_ccr_invoice_coverage ON customer_consolidated_reminders USING GIN(invoice_ids);
```

### Enhanced Table: email_logs

```sql
-- Add consolidation tracking to existing email_logs table
ALTER TABLE email_logs ADD COLUMN consolidated_reminder_id UUID REFERENCES customer_consolidated_reminders(id);
ALTER TABLE email_logs ADD COLUMN invoice_count INTEGER DEFAULT 1;
ALTER TABLE email_logs ADD COLUMN consolidation_savings DECIMAL(5,2) DEFAULT 0.00; -- Percentage of emails saved
ALTER TABLE email_logs ADD COLUMN consolidation_metadata JSONB DEFAULT '{}';

-- New indexes for consolidation analytics
CREATE INDEX idx_email_logs_consolidated ON email_logs(consolidated_reminder_id) WHERE consolidated_reminder_id IS NOT NULL;
CREATE INDEX idx_email_logs_consolidation_analytics ON email_logs(company_id, sent_at, invoice_count) WHERE consolidated_reminder_id IS NOT NULL;
```

### Enhanced Table: email_templates

```sql
-- Add consolidation support to existing email_templates
ALTER TABLE email_templates ADD COLUMN supports_consolidation BOOLEAN DEFAULT FALSE;
ALTER TABLE email_templates ADD COLUMN max_invoice_count INTEGER DEFAULT 1;
ALTER TABLE email_templates ADD COLUMN consolidation_variables JSONB DEFAULT '{}';

-- Update existing template types
ALTER TYPE emailtemplatetype ADD VALUE 'CONSOLIDATED_REMINDER';
ALTER TYPE emailtemplatetype ADD VALUE 'URGENT_CONSOLIDATED_REMINDER';
```

## Service Layer Specifications

### CustomerConsolidationService

```typescript
import { prisma } from '../prisma'
import { uaeBusinessHours } from './uae-business-hours-service'
import { culturalCompliance } from './cultural-compliance-service'

export interface ConsolidationCandidate {
  customerId: string
  customerName: string
  customerEmail: string
  companyName?: string
  overdueInvoices: ConsolidatedInvoice[]
  totalAmount: number
  currency: string
  oldestInvoiceDays: number
  lastContactDate?: Date
  nextEligibleContact: Date
  priorityScore: number
  escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  canContact: boolean
  consolidationReason: string
}

export interface ConsolidatedInvoice {
  id: string
  number: string
  amount: number
  currency: string
  issueDate: Date
  dueDate: Date
  daysOverdue: number
  description?: string
}

export interface ConsolidatedReminder {
  id: string
  customerId: string
  invoiceIds: string[]
  totalAmount: number
  escalationLevel: string
  scheduledFor: Date
  templateId: string
  priorityScore: number
  businessRules: Record<string, any>
  culturalCompliance: Record<string, any>
}

export interface ConsolidationMetrics {
  totalCandidates: number
  eligibleForConsolidation: number
  consolidationRate: number
  emailsSaved: number
  averageInvoicesPerConsolidation: number
  priorityDistribution: Record<string, number>
}

export class CustomerConsolidationService {
  private readonly MIN_INVOICES_FOR_CONSOLIDATION = 2
  private readonly MAX_INVOICES_PER_CONSOLIDATION = 25
  private readonly DEFAULT_CONTACT_INTERVAL_DAYS = 7

  /**
   * Get all customers eligible for consolidated reminders
   */
  async getConsolidationCandidates(companyId: string): Promise<ConsolidationCandidate[]> {
    // Query overdue invoices grouped by customer
    const overdueInvoicesQuery = await prisma.invoice.findMany({
      where: {
        companyId,
        status: 'OVERDUE',
        isActive: true,
        customers: {
          isActive: true
        }
      },
      include: {
        customers: true
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    // Group invoices by customer
    const customerGroups = this.groupInvoicesByCustomer(overdueInvoicesQuery)

    // Filter for consolidation eligibility
    const candidates = await Promise.all(
      customerGroups
        .filter(group => group.invoices.length >= this.MIN_INVOICES_FOR_CONSOLIDATION)
        .map(group => this.createConsolidationCandidate(group))
    )

    // Sort by priority score
    return candidates.sort((a, b) => b.priorityScore - a.priorityScore)
  }

  /**
   * Check if customer can be contacted based on last contact date
   */
  async canContactCustomer(
    customerId: string,
    minDaysBetween: number = this.DEFAULT_CONTACT_INTERVAL_DAYS
  ): Promise<boolean> {
    const lastContact = await this.getLastContactDate(customerId)

    if (!lastContact) {
      return true
    }

    const daysSinceLastContact = Math.floor(
      (Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysSinceLastContact >= minDaysBetween
  }

  /**
   * Create consolidated reminder for customer
   */
  async createConsolidatedReminder(candidate: ConsolidationCandidate): Promise<ConsolidatedReminder> {
    // Validate consolidation rules
    await this.validateConsolidationRules(candidate)

    // Calculate optimal scheduling time
    const scheduledFor = await this.calculateOptimalSchedulingTime(candidate)

    // Select appropriate template
    const templateId = await this.selectConsolidationTemplate(candidate)

    // Create consolidation record
    const consolidation = await prisma.customerConsolidatedReminder.create({
      data: {
        customerId: candidate.customerId,
        companyId: candidate.customerId, // Derived from customer
        invoiceIds: candidate.overdueInvoices.map(inv => inv.id),
        totalAmount: candidate.totalAmount,
        currency: candidate.currency,
        escalationLevel: candidate.escalationLevel,
        templateId,
        scheduledFor,
        priorityScore: candidate.priorityScore,
        consolidationReason: candidate.consolidationReason,
        lastContactDate: candidate.lastContactDate,
        nextEligibleContact: this.calculateNextEligibleContact(scheduledFor),
        businessRulesApplied: this.getAppliedBusinessRules(candidate),
        culturalComplianceFlags: await this.getCulturalComplianceFlags(candidate)
      }
    })

    return this.mapToConsolidatedReminder(consolidation)
  }

  /**
   * Calculate priority score based on multiple factors
   */
  private calculatePriorityScore(candidate: ConsolidationCandidate): number {
    const weights = {
      totalAmount: 0.40,      // 40% weight for total amount
      oldestInvoice: 0.30,    // 30% weight for oldest invoice age
      paymentHistory: 0.20,   // 20% weight for payment history
      relationshipValue: 0.10  // 10% weight for relationship value
    }

    // Normalize total amount (0-100 scale)
    const maxAmount = 100000 // AED 100k as reference point
    const amountScore = Math.min((candidate.totalAmount / maxAmount) * 100, 100)

    // Normalize oldest invoice days (0-100 scale)
    const maxDays = 180 // 6 months as maximum
    const ageScore = Math.min((candidate.oldestInvoiceDays / maxDays) * 100, 100)

    // Payment history score (would be calculated from historical data)
    const paymentHistoryScore = 50 // Placeholder - implement based on actual payment history

    // Relationship value score (based on customer type, payment terms, etc.)
    const relationshipScore = 50 // Placeholder - implement based on customer profile

    const priorityScore = Math.round(
      (amountScore * weights.totalAmount) +
      (ageScore * weights.oldestInvoice) +
      (paymentHistoryScore * weights.paymentHistory) +
      (relationshipScore * weights.relationshipValue)
    )

    return Math.max(0, Math.min(100, priorityScore))
  }

  /**
   * Group invoices by customer email
   */
  private groupInvoicesByCustomer(invoices: any[]): Array<{customerId: string, invoices: any[]}> {
    const groups = new Map<string, any[]>()

    for (const invoice of invoices) {
      const customerId = invoice.customers.id
      if (!groups.has(customerId)) {
        groups.set(customerId, [])
      }
      groups.get(customerId)!.push(invoice)
    }

    return Array.from(groups.entries()).map(([customerId, invoices]) => ({
      customerId,
      invoices
    }))
  }

  /**
   * Get last contact date from various sources
   */
  private async getLastContactDate(customerId: string): Promise<Date | null> {
    // Check consolidated reminders
    const lastConsolidated = await prisma.customerConsolidatedReminder.findFirst({
      where: { customerId },
      orderBy: { sentAt: 'desc' }
    })

    // Check individual follow-up logs
    const lastIndividual = await prisma.followUpLog.findFirst({
      where: {
        invoices: {
          customers: {
            id: customerId
          }
        }
      },
      orderBy: { sentAt: 'desc' }
    })

    const dates = [
      lastConsolidated?.sentAt,
      lastIndividual?.sentAt
    ].filter(Boolean) as Date[]

    return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null
  }

  /**
   * Calculate optimal scheduling time considering UAE business hours
   */
  private async calculateOptimalSchedulingTime(candidate: ConsolidationCandidate): Promise<Date> {
    const now = new Date()
    let scheduledTime = new Date(now.getTime() + (5 * 60 * 1000)) // 5 minutes from now

    // Use UAE business hours service to find next available time
    const nextBusinessTime = await uaeBusinessHours.getNextAvailableTime(scheduledTime, {
      respectBusinessHours: true,
      avoidPrayerTimes: true,
      avoidHolidays: true
    })

    return nextBusinessTime
  }

  /**
   * Select appropriate template based on escalation level and language preference
   */
  private async selectConsolidationTemplate(candidate: ConsolidationCandidate): Promise<string> {
    const customer = await prisma.customer.findUnique({
      where: { id: candidate.customerId }
    })

    const language = customer?.preferredLanguage || 'en'
    const templateType = this.getTemplateTypeForEscalation(candidate.escalationLevel)

    const template = await prisma.emailTemplate.findFirst({
      where: {
        templateType,
        isActive: true,
        supportsConsolidation: true,
        OR: [
          { subjectEn: { not: null } },
          { subjectAr: { not: null } }
        ]
      },
      orderBy: { version: 'desc' }
    })

    if (!template) {
      throw new Error(`No consolidation template found for ${templateType} and language ${language}`)
    }

    return template.id
  }

  /**
   * Get template type based on escalation level
   */
  private getTemplateTypeForEscalation(escalationLevel: string): string {
    switch (escalationLevel) {
      case 'POLITE':
        return 'CONSOLIDATED_REMINDER'
      case 'FIRM':
        return 'CONSOLIDATED_REMINDER'
      case 'URGENT':
        return 'URGENT_CONSOLIDATED_REMINDER'
      case 'FINAL':
        return 'URGENT_CONSOLIDATED_REMINDER'
      default:
        return 'CONSOLIDATED_REMINDER'
    }
  }

  /**
   * Calculate next eligible contact date
   */
  private calculateNextEligibleContact(scheduledFor: Date): Date {
    return new Date(scheduledFor.getTime() + (this.DEFAULT_CONTACT_INTERVAL_DAYS * 24 * 60 * 60 * 1000))
  }

  /**
   * Get applied business rules for audit purposes
   */
  private getAppliedBusinessRules(candidate: ConsolidationCandidate): Record<string, any> {
    return {
      minInvoicesRequired: this.MIN_INVOICES_FOR_CONSOLIDATION,
      maxInvoicesAllowed: this.MAX_INVOICES_PER_CONSOLIDATION,
      contactIntervalDays: this.DEFAULT_CONTACT_INTERVAL_DAYS,
      escalationLevel: candidate.escalationLevel,
      priorityScore: candidate.priorityScore,
      totalInvoicesConsolidated: candidate.overdueInvoices.length,
      consolidationReason: candidate.consolidationReason
    }
  }

  /**
   * Get cultural compliance flags
   */
  private async getCulturalComplianceFlags(candidate: ConsolidationCandidate): Promise<Record<string, any>> {
    return {
      uaeBusinessHours: true,
      islamicCalendarChecked: true,
      prayerTimesAvoided: true,
      ramadanSensitivity: await culturalCompliance.isRamadanPeriod(),
      culturalToneApplied: true,
      languagePreferenceRespected: true
    }
  }

  /**
   * Map database record to service interface
   */
  private mapToConsolidatedReminder(dbRecord: any): ConsolidatedReminder {
    return {
      id: dbRecord.id,
      customerId: dbRecord.customerId,
      invoiceIds: dbRecord.invoiceIds,
      totalAmount: dbRecord.totalAmount,
      escalationLevel: dbRecord.escalationLevel,
      scheduledFor: dbRecord.scheduledFor,
      templateId: dbRecord.templateId,
      priorityScore: dbRecord.priorityScore,
      businessRules: dbRecord.businessRulesApplied,
      culturalCompliance: dbRecord.culturalComplianceFlags
    }
  }
}
```

### Enhanced EmailSchedulingService

```typescript
import { getDefaultEmailService } from '../email-service'
import { CustomerConsolidationService } from './customer-consolidation-service'

export interface ConsolidatedEmailOptions {
  consolidatedReminderId: string
  customerId: string
  invoiceIds: string[]
  templateId: string
  totalAmount: number
  currency: string
  escalationLevel: string
  attachmentSettings: {
    includeIndividualInvoices: boolean
    includeConsolidatedStatement: boolean
    maxAttachmentSize: number // in MB
  }
  schedulingOptions: {
    respectBusinessHours: boolean
    avoidHolidays: boolean
    avoidPrayerTimes: boolean
    scheduledFor?: Date
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  }
  trackingOptions: {
    enableOpenTracking: boolean
    enableClickTracking: boolean
    enableDeliveryTracking: boolean
  }
}

export class EnhancedEmailSchedulingService {
  private consolidationService: CustomerConsolidationService
  private emailService: any

  constructor() {
    this.consolidationService = new CustomerConsolidationService()
    this.emailService = getDefaultEmailService()
  }

  /**
   * Schedule consolidated reminder email
   */
  async scheduleConsolidatedReminder(options: ConsolidatedEmailOptions): Promise<void> {
    // Get consolidation details
    const consolidation = await prisma.customerConsolidatedReminder.findUnique({
      where: { id: options.consolidatedReminderId },
      include: {
        customers: true,
        emailTemplates: true
      }
    })

    if (!consolidation) {
      throw new Error(`Consolidated reminder ${options.consolidatedReminderId} not found`)
    }

    // Get invoice details for template rendering
    const invoices = await this.getInvoiceDetailsForConsolidation(options.invoiceIds)

    // Render email template with consolidation data
    const renderedEmail = await this.renderConsolidatedTemplate(
      consolidation.emailTemplates,
      consolidation.customers,
      invoices,
      options
    )

    // Generate PDF attachments if required
    const attachments = await this.generateConsolidatedAttachments(
      invoices,
      options.attachmentSettings
    )

    // Schedule email with existing email service
    const emailLog = await this.emailService.scheduleEmail({
      recipientEmail: consolidation.customers.email,
      recipientName: consolidation.customers.name,
      subject: renderedEmail.subject,
      content: renderedEmail.content,
      language: consolidation.customers.preferredLanguage || 'ENGLISH',
      templateId: options.templateId,
      consolidatedReminderId: options.consolidatedReminderId,
      invoiceCount: options.invoiceIds.length,
      scheduledFor: options.schedulingOptions.scheduledFor,
      priority: options.schedulingOptions.priority,
      attachments,
      trackingOptions: options.trackingOptions
    })

    // Update consolidation record with email log reference
    await prisma.customerConsolidatedReminder.update({
      where: { id: options.consolidatedReminderId },
      data: {
        deliveryStatus: 'SCHEDULED',
        updatedAt: new Date()
      }
    })

    // Create email log entry with consolidation tracking
    await this.createConsolidatedEmailLog(options, emailLog.id, attachments)
  }

  /**
   * Render consolidated email template with invoice data
   */
  private async renderConsolidatedTemplate(
    template: any,
    customer: any,
    invoices: any[],
    options: ConsolidatedEmailOptions
  ): Promise<{subject: string, content: string}> {
    const templateVariables = {
      // Customer variables
      customer_name: customer.name,
      customer_company: customer.businessName || customer.name,
      customer_email: customer.email,
      contact_person: customer.contactPerson || customer.name,

      // Consolidation variables
      invoice_list: invoices.map(inv => ({
        number: inv.number,
        amount: inv.amount,
        currency: inv.currency,
        issue_date: inv.createdAt.toLocaleDateString('en-AE'),
        due_date: inv.dueDate.toLocaleDateString('en-AE'),
        days_overdue: Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        description: inv.description || ''
      })),
      total_amount: options.totalAmount,
      total_currency: options.currency,
      invoice_count: options.invoiceIds.length,
      oldest_invoice_days: Math.max(...invoices.map(inv =>
        Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      )),

      // Company variables
      company_name: '[Company Name]', // Would be populated from company settings
      company_trn: '[Company TRN]',
      company_address: '[Company Address]',
      company_phone: '[Company Phone]',
      company_email: '[Company Email]',

      // Formatting helpers
      formatted_total: new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: options.currency
      }).format(options.totalAmount),

      // Escalation context
      escalation_level: options.escalationLevel,
      urgency_indicator: this.getUrgencyIndicator(options.escalationLevel),

      // Cultural context
      language: customer.preferredLanguage || 'en',
      is_arabic: customer.preferredLanguage === 'ar',
      business_greeting: this.getBusinessGreeting(customer.preferredLanguage || 'en'),
      professional_closing: this.getProfessionalClosing(customer.preferredLanguage || 'en')
    }

    // Use existing template rendering service
    const rendered = await this.renderTemplate(template, templateVariables)

    return {
      subject: rendered.subject,
      content: rendered.content
    }
  }

  /**
   * Generate PDF attachments for consolidated reminder
   */
  private async generateConsolidatedAttachments(
    invoices: any[],
    settings: ConsolidatedEmailOptions['attachmentSettings']
  ): Promise<Array<{filename: string, content: Buffer, contentType: string}>> {
    const attachments = []

    if (settings.includeIndividualInvoices) {
      // Generate individual invoice PDFs
      for (const invoice of invoices) {
        const pdfBuffer = await this.generateInvoicePDF(invoice)
        attachments.push({
          filename: `Invoice-${invoice.number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        })
      }
    }

    if (settings.includeConsolidatedStatement) {
      // Generate consolidated statement PDF
      const statementPdf = await this.generateConsolidatedStatementPDF(invoices)
      attachments.push({
        filename: `Statement-${invoices[0].customerName}-${new Date().toISOString().split('T')[0]}.pdf`,
        content: statementPdf,
        contentType: 'application/pdf'
      })
    }

    // Check total attachment size
    const totalSize = attachments.reduce((sum, att) => sum + att.content.length, 0)
    const maxSizeBytes = settings.maxAttachmentSize * 1024 * 1024

    if (totalSize > maxSizeBytes) {
      throw new Error(`Total attachment size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit (${settings.maxAttachmentSize}MB)`)
    }

    return attachments
  }

  /**
   * Create email log entry for consolidated reminder
   */
  private async createConsolidatedEmailLog(
    options: ConsolidatedEmailOptions,
    emailLogId: string,
    attachments: any[]
  ): Promise<void> {
    const consolidationSavings = ((options.invoiceIds.length - 1) / options.invoiceIds.length) * 100

    await prisma.emailLog.create({
      data: {
        id: emailLogId,
        consolidatedReminderId: options.consolidatedReminderId,
        invoiceCount: options.invoiceIds.length,
        consolidationSavings,
        consolidationMetadata: {
          escalationLevel: options.escalationLevel,
          totalAmount: options.totalAmount,
          currency: options.currency,
          attachmentCount: attachments.length,
          schedulingOptions: options.schedulingOptions,
          trackingOptions: options.trackingOptions
        }
      }
    })
  }

  // Helper methods for template rendering
  private getUrgencyIndicator(escalationLevel: string): string {
    switch (escalationLevel) {
      case 'URGENT': return '🔴 URGENT'
      case 'FINAL': return '⚠️ FINAL NOTICE'
      default: return ''
    }
  }

  private getBusinessGreeting(language: string): string {
    return language === 'ar' ? 'السلام عليكم ورحمة الله وبركاته' : 'Dear Sir/Madam'
  }

  private getProfessionalClosing(language: string): string {
    return language === 'ar' ? 'مع أطيب التحيات' : 'Best regards'
  }
}
```

## Frontend Component Specifications

### CustomerConsolidationQueue Component

```typescript
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CustomerConsolidationService, ConsolidationCandidate } from '@/lib/services/customer-consolidation-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { AEDAmount, UAEDateDisplay } from '@/components/ui/uae-formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Mail,
  Calendar,
  Eye,
  MoreHorizontal,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Target
} from 'lucide-react'

interface CustomerConsolidationQueueProps {
  companyId: string
  refreshInterval?: number
  onPreviewConsolidation?: (customerId: string) => void
  onSendConsolidation?: (customerIds: string[]) => void
  onScheduleConsolidation?: (customerIds: string[], scheduledFor: Date) => void
}

interface QueueFilters {
  priority: 'all' | 'high' | 'medium' | 'low'
  escalationLevel: 'all' | 'polite' | 'firm' | 'urgent' | 'final'
  contactEligibility: 'all' | 'eligible' | 'waiting'
  minAmount?: number
  maxAmount?: number
  searchQuery: string
}

export function CustomerConsolidationQueue({
  companyId,
  refreshInterval = 30000,
  onPreviewConsolidation,
  onSendConsolidation,
  onScheduleConsolidation
}: CustomerConsolidationQueueProps) {
  const t = useTranslations('consolidation.queue')

  // State management
  const [candidates, setCandidates] = useState<ConsolidationCandidate[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<QueueFilters>({
    priority: 'all',
    escalationLevel: 'all',
    contactEligibility: 'all',
    searchQuery: ''
  })

  // Services
  const consolidationService = useMemo(() => new CustomerConsolidationService(), [])

  // Load consolidation candidates
  const loadCandidates = async () => {
    try {
      setLoading(true)
      const data = await consolidationService.getConsolidationCandidates(companyId)
      setCandidates(data)
    } catch (error) {
      console.error('Failed to load consolidation candidates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh data
  useEffect(() => {
    loadCandidates()

    if (refreshInterval > 0) {
      const interval = setInterval(loadCandidates, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [companyId, refreshInterval])

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    let filtered = candidates

    // Apply filters
    if (filters.priority !== 'all') {
      filtered = filtered.filter(candidate => {
        const priority = getPriorityLevel(candidate.priorityScore)
        return priority === filters.priority
      })
    }

    if (filters.escalationLevel !== 'all') {
      filtered = filtered.filter(candidate =>
        candidate.escalationLevel.toLowerCase() === filters.escalationLevel
      )
    }

    if (filters.contactEligibility !== 'all') {
      if (filters.contactEligibility === 'eligible') {
        filtered = filtered.filter(candidate => candidate.canContact)
      } else {
        filtered = filtered.filter(candidate => !candidate.canContact)
      }
    }

    if (filters.minAmount) {
      filtered = filtered.filter(candidate => candidate.totalAmount >= filters.minAmount!)
    }

    if (filters.maxAmount) {
      filtered = filtered.filter(candidate => candidate.totalAmount <= filters.maxAmount!)
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(candidate =>
        candidate.customerName.toLowerCase().includes(query) ||
        candidate.customerEmail.toLowerCase().includes(query) ||
        (candidate.companyName && candidate.companyName.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [candidates, filters])

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(filteredCandidates.map(c => c.customerId))
    } else {
      setSelectedCustomers([])
    }
  }

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomers([...selectedCustomers, customerId])
    } else {
      setSelectedCustomers(selectedCustomers.filter(id => id !== customerId))
    }
  }

  // Action handlers
  const handleSendSelected = () => {
    const eligibleCustomers = selectedCustomers.filter(customerId => {
      const candidate = candidates.find(c => c.customerId === customerId)
      return candidate?.canContact
    })

    if (eligibleCustomers.length > 0) {
      onSendConsolidation?.(eligibleCustomers)
    }
  }

  const handlePreviewCustomer = (customerId: string) => {
    onPreviewConsolidation?.(customerId)
  }

  // Utility functions
  const getPriorityLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }

  const getPriorityColor = (score: number): string => {
    const level = getPriorityLevel(score)
    switch (level) {
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      case 'low': return 'secondary'
    }
  }

  const getEscalationIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'urgent':
      case 'final':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'firm':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Queue Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('totalCustomers')}</p>
                <p className="text-2xl font-bold">{filteredCandidates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t('eligibleToContact')}</p>
                <p className="text-2xl font-bold">
                  {filteredCandidates.filter(c => c.canContact).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">{t('totalOutstanding')}</p>
                <p className="text-2xl font-bold">
                  <AEDAmount
                    amount={filteredCandidates.reduce((sum, c) => sum + c.totalAmount, 0)}
                  />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">{t('emailsSaved')}</p>
                <p className="text-2xl font-bold">
                  {filteredCandidates.reduce((sum, c) => sum + c.overdueInvoices.length - 1, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedCustomers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedCustomers.length} {t('customersSelected')}
              </span>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCustomers([])}
                >
                  {t('clearSelection')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendSelected}
                  disabled={selectedCustomers.filter(id =>
                    candidates.find(c => c.customerId === id)?.canContact
                  ).length === 0}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t('sendConsolidatedReminders')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>{t('consolidationQueue')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedCustomers.length === filteredCandidates.length && filteredCandidates.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>{t('customer')}</TableHead>
                <TableHead>{t('invoices')}</TableHead>
                <TableHead>{t('totalAmount')}</TableHead>
                <TableHead>{t('oldestInvoice')}</TableHead>
                <TableHead>{t('priority')}</TableHead>
                <TableHead>{t('escalation')}</TableHead>
                <TableHead>{t('contactStatus')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.map((candidate) => (
                <TableRow key={candidate.customerId}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomers.includes(candidate.customerId)}
                      onCheckedChange={(checked) =>
                        handleSelectCustomer(candidate.customerId, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{candidate.customerName}</p>
                      <p className="text-sm text-muted-foreground">{candidate.customerEmail}</p>
                      {candidate.companyName && (
                        <p className="text-sm text-muted-foreground">{candidate.companyName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {candidate.overdueInvoices.length} {t('invoices')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AEDAmount amount={candidate.totalAmount} currency={candidate.currency} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{candidate.oldestInvoiceDays} {t('days')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityColor(candidate.priorityScore)}>
                      {getPriorityLevel(candidate.priorityScore)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {getEscalationIcon(candidate.escalationLevel)}
                      <span className="capitalize">{candidate.escalationLevel.toLowerCase()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {candidate.canContact ? (
                      <Badge variant="default" className="bg-green-500">
                        {t('canContact')}
                      </Badge>
                    ) : (
                      <div>
                        <Badge variant="secondary">{t('waitingPeriod')}</Badge>
                        {candidate.nextEligibleContact && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('nextContact')}: <UAEDateDisplay date={candidate.nextEligibleContact} />
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreviewCustomer(candidate.customerId)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {t('previewConsolidation')}
                        </DropdownMenuItem>
                        {candidate.canContact && (
                          <DropdownMenuItem onClick={() => onSendConsolidation?.([candidate.customerId])}>
                            <Mail className="h-4 w-4 mr-2" />
                            {t('sendNow')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {/* Handle schedule */}}>
                          <Calendar className="h-4 w-4 mr-2" />
                          {t('scheduleLater')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

## API Endpoint Specifications

### Consolidation Management Endpoints

```typescript
// GET /api/consolidation/candidates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      priority: searchParams.get('priority') || 'all',
      escalationLevel: searchParams.get('escalationLevel') || 'all',
      contactEligibility: searchParams.get('contactEligibility') || 'all',
      minAmount: searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined,
      maxAmount: searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined,
      searchQuery: searchParams.get('searchQuery') || ''
    }

    const consolidationService = new CustomerConsolidationService()
    const candidates = await consolidationService.getConsolidationCandidates(session.user.companyId)

    // Apply filters (would be moved to service layer for better performance)
    let filteredCandidates = candidates
    // ... filter logic ...

    return NextResponse.json({
      success: true,
      data: {
        candidates: filteredCandidates,
        summary: {
          totalCustomers: candidates.length,
          eligibleCustomers: candidates.filter(c => c.canContact).length,
          totalOutstanding: candidates.reduce((sum, c) => sum + c.totalAmount, 0),
          emailsSaved: candidates.reduce((sum, c) => sum + c.overdueInvoices.length - 1, 0)
        }
      }
    })
  } catch (error) {
    console.error('Consolidation candidates error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve consolidation candidates' },
      { status: 500 }
    )
  }
}

// POST /api/consolidation/send
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerIds, scheduledFor, templateOverride } = body

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: 'Customer IDs array is required' },
        { status: 400 }
      )
    }

    const consolidationService = new CustomerConsolidationService()
    const emailService = new EnhancedEmailSchedulingService()

    const results = []
    for (const customerId of customerIds) {
      try {
        // Get customer consolidation candidate
        const candidates = await consolidationService.getConsolidationCandidates(session.user.companyId)
        const candidate = candidates.find(c => c.customerId === customerId)

        if (!candidate) {
          results.push({ customerId, success: false, error: 'Customer not found or not eligible' })
          continue
        }

        if (!candidate.canContact) {
          results.push({ customerId, success: false, error: 'Customer in waiting period' })
          continue
        }

        // Create consolidated reminder
        const consolidation = await consolidationService.createConsolidatedReminder(candidate)

        // Schedule email
        await emailService.scheduleConsolidatedReminder({
          consolidatedReminderId: consolidation.id,
          customerId: candidate.customerId,
          invoiceIds: candidate.overdueInvoices.map(inv => inv.id),
          templateId: templateOverride || consolidation.templateId,
          totalAmount: candidate.totalAmount,
          currency: candidate.currency,
          escalationLevel: candidate.escalationLevel,
          attachmentSettings: {
            includeIndividualInvoices: true,
            includeConsolidatedStatement: false,
            maxAttachmentSize: 25 // 25MB limit
          },
          schedulingOptions: {
            respectBusinessHours: true,
            avoidHolidays: true,
            avoidPrayerTimes: true,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
            priority: candidate.escalationLevel === 'URGENT' ? 'HIGH' : 'NORMAL'
          },
          trackingOptions: {
            enableOpenTracking: true,
            enableClickTracking: true,
            enableDeliveryTracking: true
          }
        })

        results.push({
          customerId,
          success: true,
          consolidationId: consolidation.id,
          scheduledFor: consolidation.scheduledFor
        })

      } catch (error) {
        console.error(`Error processing customer ${customerId}:`, error)
        results.push({
          customerId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }
    })

  } catch (error) {
    console.error('Consolidation send error:', error)
    return NextResponse.json(
      { error: 'Failed to send consolidated reminders' },
      { status: 500 }
    )
  }
}

// GET /api/consolidation/preview/{customerId}
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { customerId } = params
    const consolidationService = new CustomerConsolidationService()

    // Get customer consolidation data
    const candidates = await consolidationService.getConsolidationCandidates(session.user.companyId)
    const candidate = candidates.find(c => c.customerId === customerId)

    if (!candidate) {
      return NextResponse.json(
        { error: 'Customer not found or not eligible for consolidation' },
        { status: 404 }
      )
    }

    // Get customer details
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    // Get template for preview
    const template = await prisma.emailTemplate.findFirst({
      where: {
        templateType: 'CONSOLIDATED_REMINDER',
        isActive: true,
        supportsConsolidation: true
      },
      orderBy: { version: 'desc' }
    })

    if (!template) {
      return NextResponse.json(
        { error: 'No consolidation template available' },
        { status: 500 }
      )
    }

    // Render preview
    const emailService = new EnhancedEmailSchedulingService()
    const preview = await emailService.renderConsolidatedTemplate(
      template,
      customer,
      candidate.overdueInvoices,
      {
        consolidatedReminderId: 'preview',
        customerId,
        invoiceIds: candidate.overdueInvoices.map(inv => inv.id),
        templateId: template.id,
        totalAmount: candidate.totalAmount,
        currency: candidate.currency,
        escalationLevel: candidate.escalationLevel,
        attachmentSettings: {
          includeIndividualInvoices: true,
          includeConsolidatedStatement: false,
          maxAttachmentSize: 25
        },
        schedulingOptions: {
          respectBusinessHours: true,
          avoidHolidays: true,
          avoidPrayerTimes: true,
          priority: 'NORMAL'
        },
        trackingOptions: {
          enableOpenTracking: true,
          enableClickTracking: true,
          enableDeliveryTracking: true
        }
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer?.id,
          name: customer?.name,
          email: customer?.email,
          company: customer?.businessName
        },
        consolidation: {
          invoiceCount: candidate.overdueInvoices.length,
          totalAmount: candidate.totalAmount,
          currency: candidate.currency,
          oldestInvoiceDays: candidate.oldestInvoiceDays,
          escalationLevel: candidate.escalationLevel,
          priorityScore: candidate.priorityScore,
          canContact: candidate.canContact,
          nextEligibleContact: candidate.nextEligibleContact
        },
        emailPreview: {
          subject: preview.subject,
          content: preview.content,
          language: customer?.preferredLanguage || 'en',
          templateId: template.id,
          estimatedAttachments: candidate.overdueInvoices.length
        }
      }
    })

  } catch (error) {
    console.error('Consolidation preview error:', error)
    return NextResponse.json(
      { error: 'Failed to generate consolidation preview' },
      { status: 500 }
    )
  }
}
```

## Testing Specifications

### Unit Testing Requirements

```typescript
// customer-consolidation-service.test.ts
import { CustomerConsolidationService } from '../customer-consolidation-service'
import { prisma } from '../../prisma'

describe('CustomerConsolidationService', () => {
  let service: CustomerConsolidationService

  beforeEach(() => {
    service = new CustomerConsolidationService()
  })

  describe('getConsolidationCandidates', () => {
    it('should group invoices by customer correctly', async () => {
      // Test with mock data
      const companyId = 'test-company'
      const candidates = await service.getConsolidationCandidates(companyId)

      // Assertions
      expect(candidates).toBeInstanceOf(Array)
      candidates.forEach(candidate => {
        expect(candidate.overdueInvoices.length).toBeGreaterThanOrEqual(2)
        expect(candidate.totalAmount).toBeGreaterThan(0)
        expect(candidate.priorityScore).toBeGreaterThanOrEqual(0)
        expect(candidate.priorityScore).toBeLessThanOrEqual(100)
      })
    })

    it('should filter customers with only one invoice', async () => {
      // Test consolidation logic
    })

    it('should calculate priority scores correctly', async () => {
      // Test priority calculation algorithm
    })
  })

  describe('canContactCustomer', () => {
    it('should respect 7-day minimum contact interval', async () => {
      // Test contact frequency rules
    })

    it('should allow contact for never-contacted customers', async () => {
      // Test initial contact logic
    })
  })

  describe('createConsolidatedReminder', () => {
    it('should create consolidation record with correct data', async () => {
      // Test consolidation creation
    })

    it('should schedule according to UAE business hours', async () => {
      // Test scheduling integration
    })
  })
})
```

### Integration Testing Requirements

```typescript
// consolidation-api.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '../api/consolidation/candidates'

describe('/api/consolidation/candidates', () => {
  it('should return consolidation candidates for authenticated user', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        'authorization': 'Bearer valid-token'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.candidates).toBeInstanceOf(Array)
  })

  it('should filter candidates based on query parameters', async () => {
    // Test filtering logic
  })

  it('should return 401 for unauthenticated requests', async () => {
    // Test authentication
  })
})
```

### Performance Testing Requirements

```typescript
// consolidation-performance.test.ts
describe('Consolidation Performance Tests', () => {
  it('should handle 1000+ customers efficiently', async () => {
    const startTime = Date.now()

    // Create test data
    // Run consolidation
    // Measure performance

    const executionTime = Date.now() - startTime
    expect(executionTime).toBeLessThan(5000) // 5 seconds max
  })

  it('should generate PDF attachments within time limits', async () => {
    // Test PDF generation performance
  })

  it('should handle concurrent consolidation requests', async () => {
    // Test concurrency
  })
})
```

## Deployment Specifications

### Database Migration Strategy

```sql
-- Migration: 001_add_customer_consolidation.sql
BEGIN;

-- Create new tables
CREATE TABLE customer_consolidated_reminders (
  -- ... (full table definition)
);

-- Alter existing tables
ALTER TABLE email_logs ADD COLUMN consolidated_reminder_id UUID;
-- ... (other alterations)

-- Create indexes
CREATE INDEX idx_ccr_customer_company ON customer_consolidated_reminders(customer_id, company_id);
-- ... (other indexes)

-- Create any required functions or triggers

COMMIT;
```

### Environment Configuration

```typescript
// config/consolidation.ts
export const consolidationConfig = {
  // Consolidation rules
  minInvoicesForConsolidation: parseInt(process.env.MIN_INVOICES_CONSOLIDATION || '2'),
  maxInvoicesPerConsolidation: parseInt(process.env.MAX_INVOICES_CONSOLIDATION || '25'),
  defaultContactIntervalDays: parseInt(process.env.CONTACT_INTERVAL_DAYS || '7'),

  // Performance settings
  maxCandidatesPerQuery: parseInt(process.env.MAX_CANDIDATES_PER_QUERY || '1000'),
  consolidationBatchSize: parseInt(process.env.CONSOLIDATION_BATCH_SIZE || '50'),

  // Email settings
  maxAttachmentSizeMB: parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '25'),
  emailTimeoutMs: parseInt(process.env.EMAIL_TIMEOUT_MS || '30000'),

  // Cultural compliance
  enableUAEBusinessHours: process.env.ENABLE_UAE_BUSINESS_HOURS === 'true',
  enablePrayerTimeAvoidance: process.env.ENABLE_PRAYER_TIME_AVOIDANCE === 'true',
  enableRamadanSensitivity: process.env.ENABLE_RAMADAN_SENSITIVITY === 'true'
}
```

---

**Document Version**: 1.0
**Last Updated**: September 19, 2025
**Next Review**: Implementation Kickoff