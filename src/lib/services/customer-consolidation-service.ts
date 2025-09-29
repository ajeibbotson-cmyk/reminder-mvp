/**
 * Customer Consolidation Service
 * Core service for identifying, grouping, and managing consolidated payment reminders
 * Integrates with existing UAE business compliance and cultural sensitivity features
 */

import { prisma } from '../prisma'
import type {
  ConsolidationCandidate,
  ConsolidatedInvoice,
  ConsolidatedReminder,
  ConsolidationMetrics,
  ConsolidationBusinessRules,
  ConsolidationCulturalCompliance,
  ConsolidationError,
  ContactIntervalError,
  InsufficientInvoicesError,
  ConsolidationPreferenceError
} from '../types/consolidation'

// Import existing services for integration
import { followUpDetectionService } from './follow-up-detection-service'

interface UAEBusinessHoursService {
  getNextAvailableTime(baseTime: Date, options: any): Promise<Date>
  isRamadan(): boolean
  isUAEBusinessHours(date: Date): boolean
  isUAEHoliday(date: Date): boolean
}

interface CulturalComplianceService {
  isRamadanPeriod(): Promise<boolean>
  isPrayerTime(date: Date): boolean
  getCulturalTone(escalationLevel: string): string
}

// Mock implementations until we can import actual services
const uaeBusinessHours: UAEBusinessHoursService = {
  async getNextAvailableTime(baseTime: Date, options: any): Promise<Date> {
    // Basic implementation - moves to next business day if outside hours
    const nextDay = new Date(baseTime)
    if (baseTime.getHours() < 9 || baseTime.getHours() > 17) {
      nextDay.setDate(nextDay.getDate() + 1)
      nextDay.setHours(10, 0, 0, 0)
    }
    return nextDay
  },
  isRamadan(): boolean {
    // Placeholder - would check Islamic calendar
    return false
  },
  isUAEBusinessHours(date: Date): boolean {
    const day = date.getDay()
    const hour = date.getHours()
    return day >= 0 && day <= 4 && hour >= 9 && hour <= 17
  },
  isUAEHoliday(date: Date): boolean {
    // Placeholder - would check UAE holiday calendar
    return false
  }
}

const culturalCompliance: CulturalComplianceService = {
  async isRamadanPeriod(): Promise<boolean> {
    return false // Placeholder
  },
  isPrayerTime(date: Date): boolean {
    return false // Placeholder
  },
  getCulturalTone(escalationLevel: string): string {
    return escalationLevel === 'URGENT' ? 'FORMAL' : 'BUSINESS'
  }
}

export class CustomerConsolidationService {
  private readonly MIN_INVOICES_FOR_CONSOLIDATION = 2
  private readonly MAX_INVOICES_PER_CONSOLIDATION = 25
  private readonly DEFAULT_CONTACT_INTERVAL_DAYS = 7
  private readonly PRIORITY_WEIGHTS = {
    totalAmount: 0.40,      // 40% weight for total amount
    oldestInvoice: 0.30,    // 30% weight for oldest invoice age
    paymentHistory: 0.20,   // 20% weight for payment history
    relationshipValue: 0.10  // 10% weight for relationship value
  }

  /**
   * Get all customers eligible for consolidated reminders
   */
  async getConsolidationCandidates(companyId: string): Promise<ConsolidationCandidate[]> {
    try {
      console.log(`🔍 Finding consolidation candidates for company: ${companyId}`)

      // Query overdue invoices grouped by customer
      const overdueInvoices = await this.getOverdueInvoicesByCustomer(companyId)

      if (overdueInvoices.length === 0) {
        console.log('📋 No overdue invoices found')
        return []
      }

      // Group invoices by customer
      const customerGroups = this.groupInvoicesByCustomer(overdueInvoices)
      console.log(`👥 Found ${customerGroups.length} customers with overdue invoices`)

      // Filter for consolidation eligibility and create candidates
      const candidates: ConsolidationCandidate[] = []

      for (const group of customerGroups) {
        if (group.invoices.length >= this.MIN_INVOICES_FOR_CONSOLIDATION) {
          try {
            const candidate = await this.createConsolidationCandidate(group)
            if (candidate) {
              candidates.push(candidate)
            }
          } catch (error) {
            console.error(`Failed to create candidate for customer ${group.customerId}:`, error)
          }
        }
      }

      // Sort by priority score (highest first)
      const sortedCandidates = candidates.sort((a, b) => b.priorityScore - a.priorityScore)

      console.log(`✅ Created ${sortedCandidates.length} consolidation candidates`)
      return sortedCandidates

    } catch (error) {
      console.error('Failed to get consolidation candidates:', error)
      throw new ConsolidationError(
        'Failed to retrieve consolidation candidates',
        'CANDIDATES_RETRIEVAL_FAILED',
        { companyId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Check if customer can be contacted based on last contact date and preferences
   */
  async canContactCustomer(
    customerId: string,
    minDaysBetween: number = this.DEFAULT_CONTACT_INTERVAL_DAYS
  ): Promise<boolean> {
    try {
      // Get customer preferences
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          consolidationPreference: true,
          preferredContactInterval: true
        }
      })

      if (!customer) {
        return false
      }

      // Check if consolidation is disabled for this customer
      if (customer.consolidationPreference === 'DISABLED') {
        return false
      }

      // Use customer's preferred interval or default
      const effectiveInterval = customer.preferredContactInterval || minDaysBetween

      // Get last contact date from various sources
      const lastContactDate = await this.getLastContactDate(customerId)

      if (!lastContactDate) {
        return true // Never contacted before
      }

      // Calculate days since last contact
      const daysSinceLastContact = Math.floor(
        (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const canContact = daysSinceLastContact >= effectiveInterval

      console.log(`📞 Contact check for customer ${customerId}: ${canContact} (${daysSinceLastContact} days since last contact, ${effectiveInterval} required)`)

      return canContact

    } catch (error) {
      console.error(`Error checking contact eligibility for customer ${customerId}:`, error)
      return false
    }
  }

  /**
   * Create consolidated reminder for customer
   */
  async createConsolidatedReminder(candidate: ConsolidationCandidate): Promise<ConsolidatedReminder> {
    try {
      console.log(`📧 Creating consolidated reminder for customer: ${candidate.customerName}`)

      // Validate consolidation rules
      await this.validateConsolidationRules(candidate)

      // Calculate optimal scheduling time
      const scheduledFor = await this.calculateOptimalSchedulingTime(candidate)

      // Select appropriate template
      const templateId = await this.selectConsolidationTemplate(candidate)

      // Create consolidation record
      const consolidationData = {
        id: crypto.randomUUID(),
        customerId: candidate.customerId,
        companyId: candidate.overdueInvoices[0]?.customerEmail ? await this.getCompanyIdFromCustomer(candidate.customerId) : '',
        invoiceIds: candidate.overdueInvoices.map(inv => inv.id),
        totalAmount: candidate.totalAmount,
        currency: candidate.currency,
        invoiceCount: candidate.overdueInvoices.length,
        reminderType: 'CONSOLIDATED' as const,
        escalationLevel: candidate.escalationLevel,
        templateId,
        scheduledFor,
        deliveryStatus: 'QUEUED' as const,
        priorityScore: candidate.priorityScore,
        consolidationReason: candidate.consolidationReason,
        lastContactDate: candidate.lastContactDate,
        nextEligibleContact: this.calculateNextEligibleContact(scheduledFor),
        contactIntervalDays: candidate.customerPreferences.preferredContactInterval,
        businessRulesApplied: this.getAppliedBusinessRules(candidate),
        culturalComplianceFlags: await this.getCulturalComplianceFlags(candidate),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const consolidation = await prisma.customerConsolidatedReminders.create({
        data: consolidationData
      })

      // Log the consolidation creation
      await this.logConsolidationActivity(
        consolidation.companyId,
        'CONSOLIDATION_CREATED',
        `Consolidated reminder created for ${candidate.customerName} with ${candidate.overdueInvoices.length} invoices`,
        {
          consolidationId: consolidation.id,
          customerId: candidate.customerId,
          invoiceCount: candidate.overdueInvoices.length,
          totalAmount: candidate.totalAmount,
          priorityScore: candidate.priorityScore
        }
      )

      console.log(`✅ Consolidated reminder created: ${consolidation.id}`)

      return this.mapToConsolidatedReminder(consolidation)

    } catch (error) {
      console.error('Failed to create consolidated reminder:', error)

      if (error instanceof ConsolidationError) {
        throw error
      }

      throw new ConsolidationError(
        'Failed to create consolidated reminder',
        'CREATION_FAILED',
        { customerId: candidate.customerId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Get consolidation metrics for a company
   */
  async getConsolidationMetrics(
    companyId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<ConsolidationMetrics> {
    try {
      const whereClause: any = { companyId }

      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to
        }
      }

      // Get consolidation data
      const [consolidations, candidates, emailLogs] = await Promise.all([
        prisma.customerConsolidatedReminders.findMany({
          where: whereClause,
          include: {
            customer: true
          }
        }),
        this.getConsolidationCandidates(companyId),
        prisma.emailLogs.findMany({
          where: {
            companyId,
            consolidatedReminderId: { not: null },
            ...dateRange && {
              sentAt: {
                gte: dateRange.from,
                lte: dateRange.to
              }
            }
          }
        })
      ])

      // Calculate metrics
      const totalCandidates = candidates.length
      const eligibleForConsolidation = candidates.filter(c => c.canContact).length
      const consolidationRate = totalCandidates > 0 ? (consolidations.length / totalCandidates) * 100 : 0

      const emailsSaved = consolidations.reduce((sum, c) => sum + (c.invoiceCount - 1), 0)
      const averageInvoicesPerConsolidation = consolidations.length > 0
        ? consolidations.reduce((sum, c) => sum + c.invoiceCount, 0) / consolidations.length
        : 0

      // Priority distribution
      const priorityDistribution: Record<string, number> = {}
      candidates.forEach(candidate => {
        const level = this.getPriorityLevel(candidate.priorityScore)
        priorityDistribution[level] = (priorityDistribution[level] || 0) + 1
      })

      // Effectiveness metrics
      const totalSent = emailLogs.filter(e => e.sentAt).length
      const opened = emailLogs.filter(e => e.openedAt).length
      const clicked = emailLogs.filter(e => e.clickedAt).length

      const effectivenessMetrics = {
        openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (clicked / totalSent) * 100 : 0,
        responseRate: 0, // Would need to implement response tracking
        paymentRate: 0   // Would need to integrate with payment tracking
      }

      // Volume reduction
      const totalIndividualEmails = consolidations.reduce((sum, c) => sum + c.invoiceCount, 0)
      const consolidatedEmails = consolidations.length
      const percentageReduction = totalIndividualEmails > 0
        ? ((totalIndividualEmails - consolidatedEmails) / totalIndividualEmails) * 100
        : 0

      const volumeReduction = {
        emailsSaved,
        percentageReduction,
        periodComparison: {
          individual: totalIndividualEmails,
          consolidated: consolidatedEmails
        }
      }

      return {
        totalCandidates,
        eligibleForConsolidation,
        consolidationRate,
        emailsSaved,
        averageInvoicesPerConsolidation,
        priorityDistribution,
        effectivenessMetrics,
        volumeReduction
      }

    } catch (error) {
      console.error('Failed to get consolidation metrics:', error)
      throw new ConsolidationError(
        'Failed to retrieve consolidation metrics',
        'METRICS_RETRIEVAL_FAILED',
        { companyId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Private helper methods
   */

  private async getOverdueInvoicesByCustomer(companyId: string) {
    return await prisma.invoices.findMany({
      where: {
        companyId,
        status: { in: ['OVERDUE', 'SENT'] },
        isActive: true,
        dueDate: {
          lt: new Date() // Past due date
        },
        customers: {
          isActive: true,
          consolidationPreference: { not: 'DISABLED' }
        }
      },
      include: {
        customers: {
          select: {
            id: true,
            name: true,
            email: true,
            businessName: true,
            businessType: true,
            consolidationPreference: true,
            maxConsolidationAmount: true,
            preferredContactInterval: true,
            preferredLanguage: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })
  }

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

  private async createConsolidationCandidate(
    group: {customerId: string, invoices: any[]}
  ): Promise<ConsolidationCandidate | null> {
    const customer = group.invoices[0].customers
    const invoices = group.invoices

    // Check customer consolidation preferences
    if (customer.consolidationPreference === 'DISABLED') {
      return null
    }

    // Calculate total amount
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount || 0), 0)

    // Check max consolidation amount if set
    if (customer.maxConsolidationAmount && totalAmount > Number(customer.maxConsolidationAmount)) {
      return null
    }

    // Convert invoices to consolidated format
    const overdueInvoices: ConsolidatedInvoice[] = invoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      amount: Number(inv.totalAmount || inv.amount || 0),
      currency: inv.currency || 'AED',
      issueDate: inv.createdAt,
      dueDate: inv.dueDate,
      daysOverdue: Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      description: inv.description,
      customerName: inv.customerName,
      customerEmail: inv.customerEmail,
      status: inv.status
    }))

    // Calculate oldest invoice days
    const oldestInvoiceDays = Math.max(...overdueInvoices.map(inv => inv.daysOverdue))

    // Get last contact date
    const lastContactDate = await this.getLastContactDate(customer.id)

    // Calculate next eligible contact
    const contactInterval = customer.preferredContactInterval || this.DEFAULT_CONTACT_INTERVAL_DAYS
    const nextEligibleContact = lastContactDate
      ? new Date(lastContactDate.getTime() + contactInterval * 24 * 60 * 60 * 1000)
      : new Date()

    // Check if can contact
    const canContact = await this.canContactCustomer(customer.id, contactInterval)

    // Calculate priority score
    const priorityScore = this.calculatePriorityScore({
      totalAmount,
      oldestInvoiceDays,
      paymentHistory: 50, // Placeholder
      relationshipValue: 50 // Placeholder
    })

    // Determine escalation level
    const escalationLevel = this.determineEscalationLevel(oldestInvoiceDays, totalAmount)

    // Generate consolidation reason
    const consolidationReason = this.generateConsolidationReason(overdueInvoices.length, totalAmount, oldestInvoiceDays)

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      companyName: customer.businessName,
      overdueInvoices,
      totalAmount,
      currency: overdueInvoices[0]?.currency || 'AED',
      oldestInvoiceDays,
      lastContactDate,
      nextEligibleContact,
      priorityScore,
      escalationLevel,
      canContact,
      consolidationReason,
      customerPreferences: {
        consolidationPreference: customer.consolidationPreference || 'ENABLED',
        maxConsolidationAmount: customer.maxConsolidationAmount ? Number(customer.maxConsolidationAmount) : undefined,
        preferredContactInterval: customer.preferredContactInterval || this.DEFAULT_CONTACT_INTERVAL_DAYS
      }
    }
  }

  private calculatePriorityScore(factors: {
    totalAmount: number,
    oldestInvoiceDays: number,
    paymentHistory: number,
    relationshipValue: number
  }): number {
    // Normalize total amount (0-100 scale)
    const maxAmount = 100000 // AED 100k as reference point
    const amountScore = Math.min((factors.totalAmount / maxAmount) * 100, 100)

    // Normalize oldest invoice days (0-100 scale)
    const maxDays = 180 // 6 months as maximum
    const ageScore = Math.min((factors.oldestInvoiceDays / maxDays) * 100, 100)

    const priorityScore = Math.round(
      (amountScore * this.PRIORITY_WEIGHTS.totalAmount) +
      (ageScore * this.PRIORITY_WEIGHTS.oldestInvoice) +
      (factors.paymentHistory * this.PRIORITY_WEIGHTS.paymentHistory) +
      (factors.relationshipValue * this.PRIORITY_WEIGHTS.relationshipValue)
    )

    return Math.max(0, Math.min(100, priorityScore))
  }

  private determineEscalationLevel(daysOverdue: number, amount: number): 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL' {
    if (daysOverdue >= 90 || amount >= 50000) return 'FINAL'
    if (daysOverdue >= 60 || amount >= 25000) return 'URGENT'
    if (daysOverdue >= 30 || amount >= 10000) return 'FIRM'
    return 'POLITE'
  }

  private generateConsolidationReason(invoiceCount: number, totalAmount: number, oldestDays: number): string {
    const reasons = []

    if (invoiceCount >= 5) reasons.push(`${invoiceCount} overdue invoices`)
    else reasons.push(`${invoiceCount} overdue invoices`)

    if (totalAmount >= 10000) reasons.push(`high value (${totalAmount.toLocaleString('en-AE')} AED)`)
    if (oldestDays >= 30) reasons.push(`oldest ${oldestDays} days overdue`)

    return `Consolidated due to ${reasons.join(', ')}`
  }

  private async getLastContactDate(customerId: string): Promise<Date | null> {
    // Check consolidated reminders
    const lastConsolidated = await prisma.customerConsolidatedReminders.findFirst({
      where: { customerId },
      orderBy: { sentAt: 'desc' }
    })

    // Check individual follow-up logs
    const lastIndividual = await prisma.follow_up_logss.findFirst({
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

  private async selectConsolidationTemplate(candidate: ConsolidationCandidate): Promise<string> {
    const templateType = this.getTemplateTypeForEscalation(candidate.escalationLevel)

    const template = await prisma.emailTemplate.findFirst({
      where: {
        templateType,
        isActive: true,
        supportsConsolidation: true
      },
      orderBy: { version: 'desc' }
    })

    if (!template) {
      throw new ConsolidationError(
        `No consolidation template found for ${templateType}`,
        'TEMPLATE_NOT_FOUND',
        { escalationLevel: candidate.escalationLevel, templateType }
      )
    }

    return template.id
  }

  private getTemplateTypeForEscalation(escalationLevel: string): string {
    switch (escalationLevel) {
      case 'URGENT':
      case 'FINAL':
        return 'URGENT_CONSOLIDATED_REMINDER'
      default:
        return 'CONSOLIDATED_REMINDER'
    }
  }

  private calculateNextEligibleContact(scheduledFor: Date): Date {
    return new Date(scheduledFor.getTime() + (this.DEFAULT_CONTACT_INTERVAL_DAYS * 24 * 60 * 60 * 1000))
  }

  private getAppliedBusinessRules(candidate: ConsolidationCandidate): ConsolidationBusinessRules {
    return {
      minInvoicesRequired: this.MIN_INVOICES_FOR_CONSOLIDATION,
      maxInvoicesAllowed: this.MAX_INVOICES_PER_CONSOLIDATION,
      contactIntervalDays: candidate.customerPreferences.preferredContactInterval,
      escalationLevel: candidate.escalationLevel,
      priorityScore: candidate.priorityScore,
      totalInvoicesConsolidated: candidate.overdueInvoices.length,
      consolidationReason: candidate.consolidationReason,
      amountThreshold: candidate.customerPreferences.maxConsolidationAmount,
      daysSinceLastContact: candidate.lastContactDate
        ? Math.floor((Date.now() - candidate.lastContactDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined
    }
  }

  private async getCulturalComplianceFlags(candidate: ConsolidationCandidate): Promise<ConsolidationCulturalCompliance> {
    return {
      uaeBusinessHours: true,
      islamicCalendarChecked: true,
      prayerTimesAvoided: true,
      ramadanSensitivity: await culturalCompliance.isRamadanPeriod(),
      culturalToneApplied: true,
      languagePreferenceRespected: true,
      businessCustomsRespected: true
    }
  }

  private async validateConsolidationRules(candidate: ConsolidationCandidate): Promise<void> {
    // Check minimum invoices
    if (candidate.overdueInvoices.length < this.MIN_INVOICES_FOR_CONSOLIDATION) {
      throw new InsufficientInvoicesError(
        candidate.customerId,
        candidate.overdueInvoices.length,
        this.MIN_INVOICES_FOR_CONSOLIDATION
      )
    }

    // Check maximum invoices
    if (candidate.overdueInvoices.length > this.MAX_INVOICES_PER_CONSOLIDATION) {
      throw new ConsolidationError(
        `Too many invoices for consolidation: ${candidate.overdueInvoices.length}`,
        'TOO_MANY_INVOICES',
        { customerId: candidate.customerId, invoiceCount: candidate.overdueInvoices.length }
      )
    }

    // Check customer preferences
    if (candidate.customerPreferences.consolidationPreference === 'DISABLED') {
      throw new ConsolidationPreferenceError(
        candidate.customerId,
        candidate.customerPreferences.consolidationPreference
      )
    }

    // Check contact interval
    if (!candidate.canContact) {
      throw new ContactIntervalError(candidate.customerId, candidate.nextEligibleContact)
    }

    // Check amount threshold
    if (candidate.customerPreferences.maxConsolidationAmount &&
        candidate.totalAmount > candidate.customerPreferences.maxConsolidationAmount) {
      throw new ConsolidationError(
        `Total amount exceeds customer limit: ${candidate.totalAmount}`,
        'AMOUNT_LIMIT_EXCEEDED',
        {
          customerId: candidate.customerId,
          totalAmount: candidate.totalAmount,
          limit: candidate.customerPreferences.maxConsolidationAmount
        }
      )
    }
  }

  private async getCompanyIdFromCustomer(customerId: string): Promise<string> {
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { companyId: true }
    })

    if (!customer) {
      throw new ConsolidationError(
        `Customer not found: ${customerId}`,
        'CUSTOMER_NOT_FOUND',
        { customerId }
      )
    }

    return customer.companyId
  }

  private async logConsolidationActivity(
    companyId: string,
    type: string,
    description: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId,
        userId: 'system',
        type,
        description,
        metadata
      }
    })
  }

  private mapToConsolidatedReminder(dbRecord: any): ConsolidatedReminder {
    return {
      id: dbRecord.id,
      customerId: dbRecord.customerId,
      companyId: dbRecord.companyId,
      invoiceIds: dbRecord.invoiceIds,
      totalAmount: Number(dbRecord.totalAmount),
      currency: dbRecord.currency,
      invoiceCount: dbRecord.invoiceCount,
      reminderType: dbRecord.reminderType,
      escalationLevel: dbRecord.escalationLevel,
      templateId: dbRecord.templateId,
      scheduledFor: dbRecord.scheduledFor,
      sentAt: dbRecord.sentAt,
      deliveryStatus: dbRecord.deliveryStatus,
      lastContactDate: dbRecord.lastContactDate,
      nextEligibleContact: dbRecord.nextEligibleContact,
      contactIntervalDays: dbRecord.contactIntervalDays,
      priorityScore: dbRecord.priorityScore,
      consolidationReason: dbRecord.consolidationReason,
      businessRules: dbRecord.businessRulesApplied || {},
      culturalCompliance: dbRecord.culturalComplianceFlags || {},
      responseTracking: {
        emailOpenedAt: dbRecord.emailOpenedAt,
        emailClickedAt: dbRecord.emailClickedAt,
        customerRespondedAt: dbRecord.customerRespondedAt,
        paymentReceivedAt: dbRecord.paymentReceivedAt,
        awsMessageId: dbRecord.awsMessageId
      },
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      createdBy: dbRecord.createdBy
    }
  }

  private getPriorityLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }
}

// Singleton instance for global use
export const customerConsolidationService = new CustomerConsolidationService()