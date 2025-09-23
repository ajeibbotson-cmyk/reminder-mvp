/**
 * Mock data utilities for consolidation feature development
 * Provides realistic test data for UI components and testing
 */

import {
  ConsolidationCandidate,
  ConsolidatedReminder,
  ConsolidationMetrics,
  ConsolidatedInvoice,
  ConsolidationDashboardData,
  CustomerConsolidationHistory,
  ConsolidationEmailContent
} from '../types/consolidation'
import {
  ConsolidationEmailTemplate,
  ConsolidationCandidateStats,
  ConsolidationAnalyticsData,
  ConsolidationHistoricalData
} from '../types/consolidation-ui'

// =============================================================================
// MOCK DATA GENERATORS
// =============================================================================

/**
 * Generates mock consolidation candidates for development
 */
export function generateMockConsolidationCandidates(count: number = 20): ConsolidationCandidate[] {
  const candidates: ConsolidationCandidate[] = []

  const uaeCompanyNames = [
    'Emirates Trading LLC', 'Dubai Retail Solutions', 'Al Maktoum Enterprises',
    'Gulf Construction Co.', 'UAE Digital Services', 'Arabian Business Group',
    'Sharjah Manufacturing', 'Abu Dhabi Logistics', 'Al Ain Trading House',
    'Dubai Tech Solutions', 'Fujairah Import Export', 'Ras Al Khaimah Industries'
  ]

  const arabicNames = [
    'أحمد محمد الشامي', 'فاطمة سالم النعيمي', 'محمد عبدالله الراشد',
    'نورا أحمد الزعابي', 'سالم محمد الكعبي', 'مريم سعيد الشرقي'
  ]

  const englishNames = [
    'Ahmed Al-Shamsi', 'Fatima Al-Nuaimi', 'Mohammed Al-Rashid',
    'Sarah Al-Zaabi', 'Omar Al-Kaabi', 'Mariam Al-Sharqi',
    'John Smith', 'Emma Johnson', 'Michael Brown', 'Lisa Davis'
  ]

  for (let i = 0; i < count; i++) {
    const isArabicName = Math.random() < 0.4 // 40% Arabic names
    const customerName = isArabicName
      ? arabicNames[Math.floor(Math.random() * arabicNames.length)]
      : englishNames[Math.floor(Math.random() * englishNames.length)]

    const companyName = Math.random() < 0.7
      ? uaeCompanyNames[Math.floor(Math.random() * uaeCompanyNames.length)]
      : undefined

    const invoiceCount = Math.floor(Math.random() * 8) + 2 // 2-10 invoices
    const overdueInvoices = generateMockOverdueInvoices(invoiceCount, customerName)
    const totalAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const oldestInvoiceDays = Math.max(...overdueInvoices.map(inv => inv.daysOverdue))

    // Priority score based on amount and age
    const amountScore = Math.min((totalAmount / 50000) * 50, 50) // Max 50 points for amount
    const ageScore = Math.min((oldestInvoiceDays / 90) * 50, 50) // Max 50 points for age
    const priorityScore = Math.round(amountScore + ageScore)

    const escalationLevels: Array<'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'> = ['POLITE', 'FIRM', 'URGENT', 'FINAL']
    const escalationLevel = escalationLevels[Math.floor(priorityScore / 25)]

    // Contact eligibility - 70% can contact
    const canContact = Math.random() < 0.7
    const lastContactDate = canContact ? undefined : new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    const nextEligibleContact = new Date(Date.now() + (canContact ? 0 : Math.random() * 7 * 24 * 60 * 60 * 1000))

    candidates.push({
      customerId: `customer-${i + 1}`,
      customerName,
      customerEmail: generateEmail(customerName, companyName),
      companyName,
      overdueInvoices,
      totalAmount,
      currency: 'AED',
      oldestInvoiceDays,
      lastContactDate,
      nextEligibleContact,
      priorityScore,
      escalationLevel,
      canContact,
      consolidationReason: generateConsolidationReason(invoiceCount, totalAmount, oldestInvoiceDays),
      customerPreferences: {
        consolidationPreference: 'ENABLED',
        preferredContactInterval: 7
      }
    })
  }

  return candidates.sort((a, b) => b.priorityScore - a.priorityScore)
}

/**
 * Generates mock overdue invoices for a customer
 */
function generateMockOverdueInvoices(count: number, customerName: string): ConsolidatedInvoice[] {
  const invoices: ConsolidatedInvoice[] = []

  for (let i = 0; i < count; i++) {
    const issueDate = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000) // Up to 6 months ago
    const dueDate = new Date(issueDate.getTime() + (30 + Math.random() * 30) * 24 * 60 * 60 * 1000) // 30-60 days payment terms
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)))

    const amount = Math.round((Math.random() * 25000 + 1000) * 100) / 100 // AED 1,000 - 25,000

    invoices.push({
      id: `invoice-${Date.now()}-${i}`,
      number: `INV-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`,
      amount,
      currency: 'AED',
      issueDate,
      dueDate,
      daysOverdue,
      description: generateInvoiceDescription(),
      customerName,
      customerEmail: generateEmail(customerName),
      status: daysOverdue > 0 ? 'OVERDUE' : 'SENT'
    })
  }

  return invoices.sort((a, b) => b.daysOverdue - a.daysOverdue)
}

/**
 * Generates mock consolidation metrics
 */
export function generateMockConsolidationMetrics(): ConsolidationMetrics {
  const totalCandidates = Math.floor(Math.random() * 200) + 50
  const eligibleForConsolidation = Math.floor(totalCandidates * 0.7)
  const emailsSaved = Math.floor(eligibleForConsolidation * 2.3)

  return {
    totalCandidates,
    eligibleForConsolidation,
    consolidationRate: Math.round((eligibleForConsolidation / totalCandidates) * 100) / 100,
    emailsSaved,
    averageInvoicesPerConsolidation: Math.round((emailsSaved / eligibleForConsolidation + 1) * 100) / 100,
    priorityDistribution: {
      high: Math.floor(totalCandidates * 0.15),
      medium: Math.floor(totalCandidates * 0.35),
      low: Math.floor(totalCandidates * 0.5)
    },
    effectivenessMetrics: {
      openRate: Math.round((0.65 + Math.random() * 0.2) * 100) / 100, // 65-85%
      clickRate: Math.round((0.15 + Math.random() * 0.1) * 100) / 100, // 15-25%
      responseRate: Math.round((0.08 + Math.random() * 0.07) * 100) / 100, // 8-15%
      paymentRate: Math.round((0.25 + Math.random() * 0.15) * 100) / 100 // 25-40%
    },
    volumeReduction: {
      emailsSaved,
      percentageReduction: Math.round((emailsSaved / (emailsSaved + eligibleForConsolidation)) * 100),
      periodComparison: {
        individual: emailsSaved + eligibleForConsolidation,
        consolidated: eligibleForConsolidation
      }
    }
  }
}

/**
 * Generates mock dashboard data
 */
export function generateMockDashboardData(): ConsolidationDashboardData {
  const metrics = generateMockConsolidationMetrics()

  return {
    queueSummary: {
      totalCustomers: metrics.totalCandidates,
      eligibleCustomers: metrics.eligibleForConsolidation,
      totalOutstanding: Math.round(Math.random() * 500000 + 100000), // AED 100k - 600k
      emailsSaved: metrics.emailsSaved,
      avgPriorityScore: Math.round((Math.random() * 40 + 30) * 100) / 100 // 30-70
    },
    recentActivity: generateMockRecentActivity(10),
    upcomingScheduled: generateMockUpcomingReminders(5),
    effectivenessMetrics: metrics
  }
}

/**
 * Generates mock recent activity
 */
function generateMockRecentActivity(count: number) {
  const activities = []
  const actions: Array<'sent' | 'opened' | 'clicked' | 'responded' | 'paid'> =
    ['sent', 'opened', 'clicked', 'responded', 'paid']

  for (let i = 0; i < count; i++) {
    activities.push({
      id: `activity-${i}`,
      customerId: `customer-${i + 1}`,
      customerName: `Customer ${i + 1}`,
      action: actions[Math.floor(Math.random() * actions.length)],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Last 24 hours
      invoiceCount: Math.floor(Math.random() * 5) + 2,
      amount: Math.round(Math.random() * 30000 + 5000)
    })
  }

  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Generates mock upcoming reminders
 */
function generateMockUpcomingReminders(count: number): ConsolidatedReminder[] {
  const reminders: ConsolidatedReminder[] = []

  for (let i = 0; i < count; i++) {
    const scheduledFor = new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000) // Next 7 days

    reminders.push({
      id: `reminder-${i}`,
      customerId: `customer-${i + 1}`,
      companyId: 'company-1',
      invoiceIds: [`invoice-${i}-1`, `invoice-${i}-2`, `invoice-${i}-3`],
      totalAmount: Math.round(Math.random() * 40000 + 10000),
      currency: 'AED',
      invoiceCount: Math.floor(Math.random() * 5) + 2,
      reminderType: 'CONSOLIDATED',
      escalationLevel: ['POLITE', 'FIRM', 'URGENT'][Math.floor(Math.random() * 3)] as any,
      scheduledFor,
      deliveryStatus: 'QUEUED',
      contactIntervalDays: 7,
      priorityScore: Math.floor(Math.random() * 100),
      businessRules: {
        minInvoicesRequired: 2,
        maxInvoicesAllowed: 25,
        contactIntervalDays: 7,
        escalationLevel: 'POLITE',
        priorityScore: 50,
        totalInvoicesConsolidated: 3,
        consolidationReason: 'Multiple overdue invoices'
      },
      culturalCompliance: {
        uaeBusinessHours: true,
        islamicCalendarChecked: true,
        prayerTimesAvoided: true,
        ramadanSensitivity: false,
        culturalToneApplied: true,
        languagePreferenceRespected: true,
        businessCustomsRespected: true
      },
      responseTracking: {},
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  return reminders
}

/**
 * Generates mock email templates
 */
export function generateMockEmailTemplates(): ConsolidationEmailTemplate[] {
  return [
    {
      id: 'template-polite-en',
      name: 'Polite Reminder (English)',
      description: 'Professional and courteous consolidated reminder',
      subject: 'Payment Reminder: Multiple Outstanding Invoices',
      content: `Dear {{customer_name}},

We hope this message finds you well. This is a friendly reminder regarding {{invoice_count}} outstanding invoices totaling {{formatted_total}}.

Invoice Details:
{{#each invoice_list}}
- Invoice {{number}}: {{formatted_amount}} (Due: {{due_date}}, {{days_overdue}} days overdue)
{{/each}}

We would appreciate your prompt attention to these matters. If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
{{company_name}}`,
      language: 'en',
      templateType: 'consolidated',
      variables: ['customer_name', 'invoice_count', 'formatted_total', 'invoice_list', 'company_name'],
      maxInvoiceCount: 10,
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'template-polite-ar',
      name: 'تذكير مهذب (عربي)',
      description: 'تذكير مهذب ومهني بالفواتير المستحقة',
      subject: 'تذكير بالدفع: فواتير متعددة مستحقة',
      content: `عزيزي {{customer_name}}،

نأمل أن تكون بخير. هذا تذكير ودود بخصوص {{invoice_count}} فاتورة مستحقة بقيمة إجمالية {{formatted_total}}.

تفاصيل الفواتير:
{{#each invoice_list}}
- فاتورة {{number}}: {{formatted_amount}} (تاريخ الاستحقاق: {{due_date}}، متأخرة {{days_overdue}} يوم)
{{/each}}

نقدر اهتمامكم العاجل بهذه الأمور. إذا كان لديكم أي استفسارات أو تحتاجون إلى مساعدة، يرجى عدم التردد في الاتصال بنا.

مع أطيب التحيات،
{{company_name}}`,
      language: 'ar',
      templateType: 'consolidated',
      variables: ['customer_name', 'invoice_count', 'formatted_total', 'invoice_list', 'company_name'],
      maxInvoiceCount: 10,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'template-urgent-en',
      name: 'Urgent Reminder (English)',
      description: 'Urgent consolidated reminder for overdue payments',
      subject: 'URGENT: Immediate Action Required - Multiple Overdue Invoices',
      content: `Dear {{customer_name}},

This is an urgent reminder regarding {{invoice_count}} significantly overdue invoices totaling {{formatted_total}}.

Critical Outstanding Items:
{{#each invoice_list}}
- Invoice {{number}}: {{formatted_amount}} ({{days_overdue}} days overdue)
{{/each}}

Immediate payment is required to avoid further action. Please contact us within 48 hours to resolve this matter.

Urgent regards,
{{company_name}}`,
      language: 'en',
      templateType: 'urgent-consolidated',
      variables: ['customer_name', 'invoice_count', 'formatted_total', 'invoice_list', 'company_name'],
      maxInvoiceCount: 15,
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
}

/**
 * Generates mock candidate statistics
 */
export function generateMockCandidateStats(): ConsolidationCandidateStats {
  const total = Math.floor(Math.random() * 150) + 50
  const eligible = Math.floor(total * 0.72)

  return {
    total,
    eligible,
    highPriority: Math.floor(total * 0.18),
    mediumPriority: Math.floor(total * 0.35),
    lowPriority: Math.floor(total * 0.47),
    politeLevel: Math.floor(total * 0.45),
    firmLevel: Math.floor(total * 0.30),
    urgentLevel: Math.floor(total * 0.20),
    finalLevel: Math.floor(total * 0.05),
    totalOutstanding: Math.round(Math.random() * 800000 + 200000),
    averagePriority: Math.round((Math.random() * 30 + 35) * 100) / 100,
    contactableToday: Math.floor(eligible * 0.85)
  }
}

/**
 * Generates mock analytics data for charts
 */
export function generateMockAnalyticsData(type: 'effectiveness' | 'volume-reduction' | 'priority-distribution'): ConsolidationAnalyticsData {
  switch (type) {
    case 'effectiveness':
      return {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Open Rate (%)',
            data: [68, 72, 70, 75, 73, 78],
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true
          },
          {
            label: 'Response Rate (%)',
            data: [12, 15, 14, 18, 16, 20],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true
          }
        ]
      }

    case 'volume-reduction':
      return {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Individual Emails',
            data: [245, 267, 289, 312],
            backgroundColor: '#EF4444'
          },
          {
            label: 'Consolidated Emails',
            data: [89, 95, 102, 108],
            backgroundColor: '#10B981'
          }
        ]
      }

    case 'priority-distribution':
      return {
        labels: ['High Priority', 'Medium Priority', 'Low Priority'],
        datasets: [
          {
            label: 'Distribution',
            data: [18, 35, 47],
            backgroundColor: ['#EF4444', '#F59E0B', '#10B981']
          }
        ]
      }

    default:
      return { labels: [], datasets: [] }
  }
}

/**
 * Generates mock historical data for trends
 */
export function generateMockHistoricalData(days: number = 30): ConsolidationHistoricalData[] {
  const data: ConsolidationHistoricalData[] = []

  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)

    data.push({
      date,
      totalCandidates: Math.floor(Math.random() * 20) + 80,
      emailsSent: Math.floor(Math.random() * 15) + 25,
      emailsSaved: Math.floor(Math.random() * 30) + 50,
      responseRate: Math.round((0.10 + Math.random() * 0.15) * 100) / 100,
      effectivenessScore: Math.round((0.60 + Math.random() * 0.30) * 100) / 100
    })
  }

  return data
}

/**
 * Generates mock customer consolidation history
 */
export function generateMockCustomerHistory(customerId: string): CustomerConsolidationHistory {
  const consolidationCount = Math.floor(Math.random() * 8) + 2
  const consolidations = []

  for (let i = 0; i < consolidationCount; i++) {
    const sentAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000)
    consolidations.push({
      id: `consolidation-${i}`,
      sentAt,
      invoiceCount: Math.floor(Math.random() * 5) + 2,
      totalAmount: Math.round(Math.random() * 30000 + 5000),
      deliveryStatus: ['DELIVERED', 'OPENED', 'CLICKED'][Math.floor(Math.random() * 3)],
      responseReceived: Math.random() < 0.3,
      paymentReceived: Math.random() < 0.6
    })
  }

  return {
    customerId,
    customerName: 'Ahmed Al-Shamsi',
    totalConsolidations: consolidationCount,
    lastConsolidationDate: consolidations.length > 0
      ? new Date(Math.max(...consolidations.map(c => c.sentAt!.getTime())))
      : undefined,
    consolidations: consolidations.sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime()),
    paymentBehavior: {
      averagePaymentDelay: Math.floor(Math.random() * 20) + 5,
      paymentRate: Math.round((0.4 + Math.random() * 0.4) * 100) / 100,
      lastPaymentDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generates email address from name and optional company
 */
function generateEmail(name: string, company?: string): string {
  const cleanName = name.toLowerCase()
    .replace(/[أ-ي]/g, '') // Remove Arabic characters
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '')

  if (company) {
    const cleanCompany = company.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z]/g, '')
      .replace(/(llc|ltd|co|inc)$/, '')

    return `${cleanName}@${cleanCompany}.com`
  }

  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
  return `${cleanName}@${domains[Math.floor(Math.random() * domains.length)]}`
}

/**
 * Generates consolidation reason based on invoice data
 */
function generateConsolidationReason(invoiceCount: number, totalAmount: number, oldestDays: number): string {
  if (oldestDays > 60) {
    return `${invoiceCount} invoices significantly overdue (oldest ${oldestDays} days)`
  } else if (totalAmount > 30000) {
    return `High value outstanding amount (AED ${totalAmount.toLocaleString()})`
  } else {
    return `Multiple invoices suitable for consolidation (${invoiceCount} items)`
  }
}

/**
 * Generates invoice description
 */
function generateInvoiceDescription(): string {
  const descriptions = [
    'Professional Services - Consulting',
    'Software License Renewal',
    'Marketing Services - Q1',
    'IT Support and Maintenance',
    'Office Supplies and Equipment',
    'Training and Development',
    'Legal Advisory Services',
    'Accounting and Bookkeeping',
    'Website Development',
    'Digital Marketing Campaign'
  ]

  return descriptions[Math.floor(Math.random() * descriptions.length)]
}

// =============================================================================
// DEVELOPMENT UTILITIES
// =============================================================================

/**
 * Utility class for managing mock data in development
 */
export class ConsolidationMockDataManager {
  private static instance: ConsolidationMockDataManager
  private candidates: ConsolidationCandidate[] = []
  private metrics: ConsolidationMetrics | null = null
  private templates: ConsolidationEmailTemplate[] = []

  private constructor() {
    this.initializeMockData()
  }

  public static getInstance(): ConsolidationMockDataManager {
    if (!ConsolidationMockDataManager.instance) {
      ConsolidationMockDataManager.instance = new ConsolidationMockDataManager()
    }
    return ConsolidationMockDataManager.instance
  }

  private initializeMockData() {
    this.candidates = generateMockConsolidationCandidates(50)
    this.metrics = generateMockConsolidationMetrics()
    this.templates = generateMockEmailTemplates()
  }

  public getCandidates(filters?: any): ConsolidationCandidate[] {
    let filtered = [...this.candidates]

    if (filters?.priority && filters.priority !== 'all') {
      filtered = filtered.filter(c => this.getPriorityLevel(c.priorityScore) === filters.priority)
    }

    if (filters?.escalationLevel && filters.escalationLevel !== 'all') {
      filtered = filtered.filter(c => c.escalationLevel.toLowerCase() === filters.escalationLevel)
    }

    if (filters?.contactEligibility && filters.contactEligibility !== 'all') {
      if (filters.contactEligibility === 'eligible') {
        filtered = filtered.filter(c => c.canContact)
      } else {
        filtered = filtered.filter(c => !c.canContact)
      }
    }

    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.customerName.toLowerCase().includes(query) ||
        c.customerEmail.toLowerCase().includes(query) ||
        (c.companyName && c.companyName.toLowerCase().includes(query))
      )
    }

    return filtered
  }

  public getMetrics(): ConsolidationMetrics {
    return this.metrics!
  }

  public getTemplates(): ConsolidationEmailTemplate[] {
    return this.templates
  }

  public getDashboardData(): ConsolidationDashboardData {
    return generateMockDashboardData()
  }

  public getCustomerHistory(customerId: string): CustomerConsolidationHistory {
    return generateMockCustomerHistory(customerId)
  }

  private getPriorityLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }

  public refreshData(): void {
    this.initializeMockData()
  }

  public addCandidate(candidate: ConsolidationCandidate): void {
    this.candidates.push(candidate)
  }

  public removeCandidate(customerId: string): void {
    this.candidates = this.candidates.filter(c => c.customerId !== customerId)
  }

  public updateCandidateStatus(customerId: string, updates: Partial<ConsolidationCandidate>): void {
    const index = this.candidates.findIndex(c => c.customerId === customerId)
    if (index >= 0) {
      this.candidates[index] = { ...this.candidates[index], ...updates }
    }
  }
}

/**
 * Quick access to mock data manager
 */
export const mockDataManager = ConsolidationMockDataManager.getInstance()

/**
 * Development helper functions
 */
export const devUtils = {
  /**
   * Simulate API delay for realistic testing
   */
  async simulateApiDelay(min: number = 500, max: number = 1500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min)
    return new Promise(resolve => setTimeout(resolve, delay))
  },

  /**
   * Simulate API error for testing error handling
   */
  simulateApiError(probability: number = 0.1): void {
    if (Math.random() < probability) {
      throw new Error('Simulated API error for testing')
    }
  },

  /**
   * Generate test scenarios for specific cases
   */
  getTestScenarios(): {
    highPriorityCustomers: ConsolidationCandidate[]
    contactableCustomers: ConsolidationCandidate[]
    waitingPeriodCustomers: ConsolidationCandidate[]
  } {
    const candidates = mockDataManager.getCandidates()

    return {
      highPriorityCustomers: candidates.filter(c => c.priorityScore >= 70),
      contactableCustomers: candidates.filter(c => c.canContact),
      waitingPeriodCustomers: candidates.filter(c => !c.canContact)
    }
  }
}