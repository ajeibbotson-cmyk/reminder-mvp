import { prisma } from '../prisma'
import { uaeBusinessHours } from './uae-business-hours-service'
import { culturalCompliance } from './cultural-compliance-service'
import { InvoiceStatus } from '@prisma/client'
import { customerConsolidationService } from './customer-consolidation-service'
import type { ConsolidationCandidate } from '../types/consolidation'

interface FollowUpStep {
  stepNumber: number
  delayDays: number
  templateId?: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC' | 'BOTH'
  stopConditions?: string[]
  escalationLevel: 'GENTLE' | 'REMINDER' | 'URGENT' | 'FINAL'
}

interface FollowUpTriggerConditions {
  minDaysOverdue: number
  maxDaysOverdue?: number
  minAmount?: number
  maxAmount?: number
  customerSegments?: string[]
  invoiceStatuses: InvoiceStatus[]
  excludeWeekends: boolean
  respectHolidays: boolean
  respectPrayerTimes: boolean
}

interface DetectionResults {
  eligibleInvoices: number
  triggeredSequences: number
  skippedInvoices: number
  consolidatedCustomers: number // New field for consolidation tracking
  consolidatedInvoices: number // New field for consolidation tracking
  emailsSaved: number // New field for consolidation tracking
  errors: string[]
  warnings: string[]
  metrics: {
    byCompany: Record<string, number>
    byAmount: Record<string, number>
    byDaysOverdue: Record<string, number>
    byCustomerSegment: Record<string, number>
    consolidationMetrics: {
      candidatesFound: number
      candidatesEligible: number
      consolidationsCreated: number
      averageInvoicesPerConsolidation: number
    }
  }
}

/**
 * Follow-up Detection Service
 * Handles intelligent detection and triggering of follow-up sequences for overdue invoices
 * with UAE business compliance and cultural sensitivity
 */
export class FollowUpDetectionService {
  private static readonly DEFAULT_TRIGGER_CONDITIONS: FollowUpTriggerConditions = {
    minDaysOverdue: 1,
    maxDaysOverdue: 365,
    minAmount: 0,
    invoiceStatuses: ['OVERDUE', 'SENT'],
    excludeWeekends: true,
    respectHolidays: true,
    respectPrayerTimes: true
  }

  /**
   * Main detection method - finds and triggers follow-ups for eligible invoices
   * Now includes consolidation detection and processing
   */
  async detectAndTriggerFollowUps(
    conditions: Partial<FollowUpTriggerConditions> = {},
    options: {
      enableConsolidation?: boolean
      consolidationFirst?: boolean
    } = {}
  ): Promise<DetectionResults> {
    const triggerConditions = { ...FollowUpDetectionService.DEFAULT_TRIGGER_CONDITIONS, ...conditions }
    const { enableConsolidation = true, consolidationFirst = true } = options

    const results: DetectionResults = {
      eligibleInvoices: 0,
      triggeredSequences: 0,
      skippedInvoices: 0,
      consolidatedCustomers: 0,
      consolidatedInvoices: 0,
      emailsSaved: 0,
      errors: [],
      warnings: [],
      metrics: {
        byCompany: {},
        byAmount: {},
        byDaysOverdue: {},
        byCustomerSegment: {},
        consolidationMetrics: {
          candidatesFound: 0,
          candidatesEligible: 0,
          consolidationsCreated: 0,
          averageInvoicesPerConsolidation: 0
        }
      }
    }

    try {
      console.log('🔍 Starting follow-up detection with conditions:', triggerConditions)

      // Find eligible invoices
      const eligibleInvoices = await this.findEligibleInvoices(triggerConditions)
      results.eligibleInvoices = eligibleInvoices.length

      console.log(`📋 Found ${eligibleInvoices.length} eligible invoices for follow-up`)

      // Process consolidation first if enabled and requested
      if (enableConsolidation && consolidationFirst && eligibleInvoices.length > 0) {
        console.log('🔄 Processing consolidation candidates first...')
        const consolidationResults = await this.processConsolidationOpportunities(triggerConditions)

        // Update results with consolidation metrics
        results.consolidatedCustomers = consolidationResults.consolidatedCustomers
        results.consolidatedInvoices = consolidationResults.consolidatedInvoices
        results.emailsSaved = consolidationResults.emailsSaved
        results.metrics.consolidationMetrics = consolidationResults.metrics

        if (consolidationResults.errors.length > 0) {
          results.errors.push(...consolidationResults.errors)
        }

        if (consolidationResults.warnings.length > 0) {
          results.warnings.push(...consolidationResults.warnings)
        }

        console.log(`📊 Consolidation completed: ${consolidationResults.consolidatedCustomers} customers, ${consolidationResults.emailsSaved} emails saved`)
      }

      // Find remaining invoices not handled by consolidation
      const remainingInvoices = enableConsolidation
        ? await this.findRemainingEligibleInvoices(triggerConditions, results.consolidatedInvoices)
        : eligibleInvoices

      console.log(`📝 Processing ${remainingInvoices.length} remaining invoices for individual follow-ups`)

      // Process each remaining invoice for individual follow-ups
      for (const invoice of remainingInvoices) {
        try {
          const triggerResult = await this.processInvoiceForFollowUp(invoice, triggerConditions)

          if (triggerResult.triggered) {
            results.triggeredSequences++

            // Update metrics
            this.updateMetrics(results.metrics, invoice, triggerResult)
          } else {
            results.skippedInvoices++
            if (triggerResult.reason) {
              results.warnings.push(`Skipped invoice ${invoice.number}: ${triggerResult.reason}`)
            }
          }

        } catch (error) {
          results.errors.push(`Failed to process invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      console.log(`✅ Detection completed: ${results.triggeredSequences} individual triggered, ${results.skippedInvoices} skipped, ${results.consolidatedCustomers} consolidated`)

    } catch (error) {
      results.errors.push(`Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Follow-up detection failed:', error)
    }

    return results
  }

  /**
   * Find invoices eligible for follow-up based on business rules
   */
  private async findEligibleInvoices(conditions: FollowUpTriggerConditions) {
    const now = new Date()
    const minOverdueDate = new Date(now.getTime() - conditions.minDaysOverdue * 24 * 60 * 60 * 1000)
    const maxOverdueDate = conditions.maxDaysOverdue
      ? new Date(now.getTime() - conditions.maxDaysOverdue * 24 * 60 * 60 * 1000)
      : undefined

    // Build complex query for eligible invoices
    const whereClause: any = {
      status: { in: conditions.invoiceStatuses },
      dueDate: {
        lt: minOverdueDate
      },
      // Exclude invoices with active follow-ups
      NOT: {
        followUpLogs: {
          some: {
            deliveryStatus: { in: ['QUEUED', 'SENT'] }
          }
        }
      }
    }

    // Add date range filter if max days specified
    if (maxOverdueDate) {
      whereClause.dueDate.gte = maxOverdueDate
    }

    // Add amount filters
    if (conditions.minAmount !== undefined) {
      whereClause.totalAmount = { gte: conditions.minAmount }
    }
    if (conditions.maxAmount !== undefined) {
      whereClause.totalAmount = { ...whereClause.totalAmount, lte: conditions.maxAmount }
    }

    return await prisma.invoices.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            followUpSequences: {
              where: { active: true }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            businessType: true,
            riskScore: true,
            preferredLanguage: true,
            communicationPref: true
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' }, // Oldest overdue first
        { totalAmount: 'desc' } // Higher amounts first within same due date
      ]
    })
  }

  /**
   * Process a single invoice for follow-up triggering
   */
  private async processInvoiceForFollowUp(
    invoice: any,
    conditions: FollowUpTriggerConditions
  ): Promise<{
    triggered: boolean
    reason?: string
    sequenceId?: string
    stepNumber?: number
  }> {
    // Check if company has active sequences
    if (!invoice.company.followUpSequences || invoice.company.followUpSequences.length === 0) {
      return {
        triggered: false,
        reason: 'No active follow-up sequences for company'
      }
    }

    // Select appropriate sequence based on invoice characteristics
    const sequence = await this.selectOptimalSequence(invoice, invoice.company.followUpSequences)
    if (!sequence) {
      return {
        triggered: false,
        reason: 'No suitable sequence found'
      }
    }

    // Parse sequence steps
    let steps: FollowUpStep[]
    try {
      steps = typeof sequence.steps === 'string' ? JSON.parse(sequence.steps) : sequence.steps
    } catch {
      return {
        triggered: false,
        reason: 'Invalid sequence steps format'
      }
    }

    if (steps.length === 0) {
      return {
        triggered: false,
        reason: 'Sequence has no steps'
      }
    }

    // Calculate days overdue
    const daysOverdue = Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))

    // Apply UAE business and cultural compliance
    const complianceCheck = await this.checkUAECompliance(invoice, sequence, daysOverdue)
    if (!complianceCheck.allowed) {
      return {
        triggered: false,
        reason: complianceCheck.reason
      }
    }

    // Calculate optimal send time for first step
    const firstStep = steps[0]
    const sendTime = await this.calculateOptimalSendTime(invoice, firstStep, conditions)

    // Create follow-up log entry
    const followUpLog = await prisma.follow_up_logs.create({
      data: {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        sequenceId: sequence.id,
        stepNumber: firstStep.stepNumber,
        emailAddress: invoice.customerEmail,
        subject: await this.processTemplate(firstStep.subject, invoice),
        content: await this.processTemplate(firstStep.content, invoice),
        sentAt: sendTime,
        deliveryStatus: 'QUEUED'
      }
    })

    // Log the trigger activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: invoice.companyId,
        userId: 'system',
        type: 'FOLLOW_UP_TRIGGERED',
        description: `Follow-up triggered for invoice ${invoice.number} (${daysOverdue} days overdue)`,
        metadata: {
          invoiceId: invoice.id,
          sequenceId: sequence.id,
          followUpLogId: followUpLog.id,
          daysOverdue,
          escalationLevel: firstStep.escalationLevel,
          scheduledSendTime: sendTime,
          customerSegment: invoice.customer?.businessType || 'UNKNOWN'
        }
      }
    })

    return {
      triggered: true,
      sequenceId: sequence.id,
      stepNumber: firstStep.stepNumber
    }
  }

  /**
   * Select the most appropriate sequence for an invoice
   */
  private async selectOptimalSequence(invoice: any, availableSequences: any[]): Promise<any> {
    if (availableSequences.length === 1) {
      return availableSequences[0]
    }

    // Business logic for sequence selection
    const daysOverdue = Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const invoiceAmount = Number(invoice.totalAmount || invoice.amount)
    const customerRisk = invoice.customer?.riskScore || 'MEDIUM'

    // Score each sequence based on appropriateness
    const sequenceScores = availableSequences.map(sequence => {
      let score = 0

      // Parse steps to evaluate sequence characteristics
      let steps: FollowUpStep[]
      try {
        steps = typeof sequence.steps === 'string' ? JSON.parse(sequence.steps) : sequence.steps
      } catch {
        return { sequence, score: -1 } // Invalid sequence
      }

      // Score based on escalation appropriateness
      if (daysOverdue <= 7 && steps[0]?.escalationLevel === 'GENTLE') score += 10
      if (daysOverdue > 7 && daysOverdue <= 30 && steps[0]?.escalationLevel === 'REMINDER') score += 10
      if (daysOverdue > 30 && steps[0]?.escalationLevel === 'URGENT') score += 10

      // Score based on amount
      if (invoiceAmount > 10000 && steps.some(s => s.escalationLevel === 'URGENT')) score += 5
      if (invoiceAmount <= 1000 && steps.every(s => s.escalationLevel !== 'FINAL')) score += 5

      // Score based on customer risk
      if (customerRisk === 'HIGH' && steps.length > 2) score += 5
      if (customerRisk === 'LOW' && steps.length <= 2) score += 5

      // Language preference matching
      const customerLanguage = invoice.customer?.preferredLanguage || 'en'
      if (customerLanguage === 'ar' && steps.some(s => s.language === 'ARABIC')) score += 3

      return { sequence, score }
    })

    // Return the highest scoring sequence
    const bestSequence = sequenceScores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)[0]

    return bestSequence?.sequence || availableSequences[0] // Fallback to first sequence
  }

  /**
   * Check UAE business compliance for sending follow-ups
   */
  private async checkUAECompliance(
    invoice: any,
    sequence: any,
    daysOverdue: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check if it's Ramadan and adjust accordingly
    if (uaeBusinessHours.isRamadan()) {
      // During Ramadan, be more gentle and reduce frequency
      if (daysOverdue < 3) {
        return {
          allowed: false,
          reason: 'Ramadan period - extending grace period to 3 days minimum'
        }
      }
    }

    // Check customer cultural preferences
    if (invoice.customer?.businessType === 'GOVERNMENT') {
      // More formal approach for government entities
      if (daysOverdue < 7) {
        return {
          allowed: false,
          reason: 'Government customer - extending grace period to 7 days'
        }
      }
    }

    // Check for recent payment activity
    const recentPayments = await prisma.payments.findMany({
      where: {
        invoiceId: invoice.id,
        paymentDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    if (recentPayments.length > 0) {
      return {
        allowed: false,
        reason: 'Recent payment activity detected - holding follow-up'
      }
    }

    // Check for manual override flags
    const manualOverride = await prisma.activities.findFirst({
      where: {
        type: 'FOLLOW_UP_OVERRIDE',
        metadata: {
          path: ['invoiceId'],
          equals: invoice.id
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    })

    if (manualOverride) {
      return {
        allowed: false,
        reason: 'Manual override flag detected'
      }
    }

    return { allowed: true }
  }

  /**
   * Calculate optimal send time considering UAE business culture
   */
  private async calculateOptimalSendTime(
    invoice: any,
    step: FollowUpStep,
    conditions: FollowUpTriggerConditions
  ): Promise<Date> {
    let baseTime = new Date()

    // Apply step delay
    if (step.delayDays > 0) {
      baseTime = new Date(baseTime.getTime() + step.delayDays * 24 * 60 * 60 * 1000)
    }

    // Apply UAE business hours and cultural timing
    const scheduleConfig = {
      preferredDays: [2, 3, 4], // Tuesday-Thursday optimal for UAE business
      preferredHours: this.getOptimalHours(step.escalationLevel),
      avoidPrayerTimes: conditions.respectPrayerTimes,
      respectRamadan: conditions.respectHolidays,
      culturalTone: this.getCulturalTone(step.escalationLevel)
    }

    return uaeBusinessHours.getNextAvailableSendTime(baseTime, scheduleConfig)
  }

  /**
   * Get optimal hours based on escalation level
   */
  private getOptimalHours(escalationLevel: string): number[] {
    switch (escalationLevel) {
      case 'GENTLE':
        return [10, 11] // Mid-morning, non-intrusive
      case 'REMINDER':
        return [9, 10, 14, 15] // Morning or early afternoon
      case 'URGENT':
        return [9, 10, 11, 13, 14] // Broader business hours
      case 'FINAL':
        return [9, 10, 11, 13, 14, 15] // Maximum business hours coverage
      default:
        return [10, 11]
    }
  }

  /**
   * Get cultural tone based on escalation level
   */
  private getCulturalTone(escalationLevel: string): 'FORMAL' | 'BUSINESS' | 'FRIENDLY' {
    switch (escalationLevel) {
      case 'GENTLE':
        return 'FRIENDLY'
      case 'REMINDER':
        return 'BUSINESS'
      case 'URGENT':
      case 'FINAL':
        return 'FORMAL'
      default:
        return 'BUSINESS'
    }
  }

  /**
   * Process template with variable substitution
   */
  private async processTemplate(template: string, invoice: any): Promise<string> {
    const daysOverdue = Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))

    const variables = {
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      invoiceAmount: `${invoice.currency} ${Number(invoice.totalAmount || invoice.amount).toLocaleString('en-AE')}`,
      dueDate: invoice.dueDate.toLocaleDateString('en-AE'),
      daysOverdue: daysOverdue.toString(),
      companyName: invoice.company?.name || 'Your Company',
      currentDate: new Date().toLocaleDateString('en-AE')
    }

    let processed = template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      processed = processed.replace(new RegExp(placeholder, 'g'), value || '')
    })

    return processed
  }

  /**
   * Update metrics tracking
   */
  private updateMetrics(metrics: any, invoice: any, triggerResult: any): void {
    // By company
    const companyId = invoice.companyId
    metrics.byCompany[companyId] = (metrics.byCompany[companyId] || 0) + 1

    // By amount
    const amount = Number(invoice.totalAmount || invoice.amount)
    const amountRange = this.getAmountRange(amount)
    metrics.byAmount[amountRange] = (metrics.byAmount[amountRange] || 0) + 1

    // By days overdue
    const daysOverdue = Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const overdueRange = this.getOverdueRange(daysOverdue)
    metrics.byDaysOverdue[overdueRange] = (metrics.byDaysOverdue[overdueRange] || 0) + 1

    // By customer segment
    const segment = invoice.customer?.businessType || 'UNKNOWN'
    metrics.byCustomerSegment[segment] = (metrics.byCustomerSegment[segment] || 0) + 1
  }

  /**
   * Get amount range for metrics
   */
  private getAmountRange(amount: number): string {
    if (amount <= 1000) return '0-1000'
    if (amount <= 5000) return '1001-5000'
    if (amount <= 10000) return '5001-10000'
    if (amount <= 50000) return '10001-50000'
    return '50000+'
  }

  /**
   * Get overdue range for metrics
   */
  private getOverdueRange(days: number): string {
    if (days <= 7) return '1-7'
    if (days <= 30) return '8-30'
    if (days <= 60) return '31-60'
    if (days <= 90) return '61-90'
    return '90+'
  }

  /**
   * Process consolidation opportunities for all companies or a specific company
   */
  private async processConsolidationOpportunities(
    conditions: FollowUpTriggerConditions
  ): Promise<{
    consolidatedCustomers: number
    consolidatedInvoices: number
    emailsSaved: number
    errors: string[]
    warnings: string[]
    metrics: {
      candidatesFound: number
      candidatesEligible: number
      consolidationsCreated: number
      averageInvoicesPerConsolidation: number
    }
  }> {
    const result = {
      consolidatedCustomers: 0,
      consolidatedInvoices: 0,
      emailsSaved: 0,
      errors: [] as string[],
      warnings: [] as string[],
      metrics: {
        candidatesFound: 0,
        candidatesEligible: 0,
        consolidationsCreated: 0,
        averageInvoicesPerConsolidation: 0
      }
    }

    try {
      // Get all active companies
      const activeCompanies = await prisma.companies.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      })

      for (const company of activeCompanies) {
        try {
          // Get consolidation candidates for each company
          const candidates = await customerConsolidationService.getConsolidationCandidates(company.id)
          result.metrics.candidatesFound += candidates.length

          const eligibleCandidates = candidates.filter(c => c.canContact)
          result.metrics.candidatesEligible += eligibleCandidates.length

          console.log(`🏢 Company ${company.name}: ${candidates.length} candidates, ${eligibleCandidates.length} eligible`)

          // Process eligible candidates
          for (const candidate of eligibleCandidates) {
            try {
              const consolidatedReminder = await customerConsolidationService.createConsolidatedReminder(candidate)

              if (consolidatedReminder) {
                result.consolidatedCustomers++
                result.consolidatedInvoices += candidate.overdueInvoices.length
                result.emailsSaved += candidate.overdueInvoices.length - 1 // Saves n-1 emails
                result.metrics.consolidationsCreated++

                console.log(`✅ Created consolidation for ${candidate.customerName} with ${candidate.overdueInvoices.length} invoices`)
              }

            } catch (error) {
              const errorMsg = `Failed to create consolidation for customer ${candidate.customerName}: ${error instanceof Error ? error.message : 'Unknown error'}`
              result.errors.push(errorMsg)
              console.error(errorMsg)
            }
          }

        } catch (error) {
          const errorMsg = `Failed to process consolidation for company ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          console.error(errorMsg)
        }
      }

      // Calculate average invoices per consolidation
      if (result.metrics.consolidationsCreated > 0) {
        result.metrics.averageInvoicesPerConsolidation = result.consolidatedInvoices / result.metrics.consolidationsCreated
      }

      console.log(`📊 Consolidation summary: ${result.consolidatedCustomers} customers, ${result.consolidatedInvoices} invoices, ${result.emailsSaved} emails saved`)

    } catch (error) {
      const errorMsg = `Consolidation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      console.error(errorMsg)
    }

    return result
  }

  /**
   * Find invoices that remain eligible after consolidation processing
   */
  private async findRemainingEligibleInvoices(
    conditions: FollowUpTriggerConditions,
    consolidatedInvoiceCount: number
  ): Promise<any[]> {
    try {
      // Get all consolidations created in the last hour (recent processing)
      const recentConsolidations = await prisma.customerConsolidatedReminders.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        },
        select: {
          invoiceIds: true
        }
      })

      // Flatten all consolidated invoice IDs
      const consolidatedInvoiceIds = recentConsolidations.flatMap(c => c.invoiceIds)

      // Find eligible invoices excluding those that were just consolidated
      const eligibleInvoices = await this.findEligibleInvoices(conditions)

      // Filter out consolidated invoices
      const remainingInvoices = eligibleInvoices.filter(invoice =>
        !consolidatedInvoiceIds.includes(invoice.id)
      )

      console.log(`📋 Found ${remainingInvoices.length} remaining invoices after consolidation (excluded ${consolidatedInvoiceIds.length} consolidated invoices)`)

      return remainingInvoices

    } catch (error) {
      console.error('Error finding remaining eligible invoices:', error)
      // If there's an error, return all eligible invoices as fallback
      return await this.findEligibleInvoices(conditions)
    }
  }

  /**
   * Get consolidation detection statistics
   */
  async getConsolidationStatistics(
    companyId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalCandidates: number
    eligibleCandidates: number
    consolidationsCreated: number
    totalInvoicesConsolidated: number
    emailsSaved: number
    averageInvoicesPerConsolidation: number
    consolidationRate: number
    effectiveness: {
      openRate: number
      clickRate: number
      responseRate: number
    }
  }> {
    try {
      const whereClause: any = {}

      if (companyId) {
        whereClause.companyId = companyId
      }

      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }

      const [consolidations, emailLogs] = await Promise.all([
        prisma.customerConsolidatedReminders.findMany({
          where: whereClause
        }),
        prisma.emailLogs.findMany({
          where: {
            ...whereClause,
            consolidatedReminderId: { not: null }
          }
        })
      ])

      // Calculate statistics
      const consolidationsCreated = consolidations.length
      const totalInvoicesConsolidated = consolidations.reduce((sum, c) => sum + c.invoiceCount, 0)
      const emailsSaved = consolidations.reduce((sum, c) => sum + (c.invoiceCount - 1), 0)
      const averageInvoicesPerConsolidation = consolidationsCreated > 0
        ? totalInvoicesConsolidated / consolidationsCreated
        : 0

      // Calculate effectiveness metrics
      const sentEmails = emailLogs.filter(e => e.sentAt).length
      const openedEmails = emailLogs.filter(e => e.openedAt).length
      const clickedEmails = emailLogs.filter(e => e.clickedAt).length

      const effectiveness = {
        openRate: sentEmails > 0 ? (openedEmails / sentEmails) * 100 : 0,
        clickRate: sentEmails > 0 ? (clickedEmails / sentEmails) * 100 : 0,
        responseRate: 0 // Would need to implement response tracking
      }

      // Get current candidates for comparison
      let currentCandidates = 0
      let eligibleCandidates = 0

      if (companyId) {
        const candidates = await customerConsolidationService.getConsolidationCandidates(companyId)
        currentCandidates = candidates.length
        eligibleCandidates = candidates.filter(c => c.canContact).length
      }

      const consolidationRate = currentCandidates > 0 ? (consolidationsCreated / currentCandidates) * 100 : 0

      return {
        totalCandidates: currentCandidates,
        eligibleCandidates,
        consolidationsCreated,
        totalInvoicesConsolidated,
        emailsSaved,
        averageInvoicesPerConsolidation: Math.round(averageInvoicesPerConsolidation * 100) / 100,
        consolidationRate: Math.round(consolidationRate * 100) / 100,
        effectiveness: {
          openRate: Math.round(effectiveness.openRate * 100) / 100,
          clickRate: Math.round(effectiveness.clickRate * 100) / 100,
          responseRate: Math.round(effectiveness.responseRate * 100) / 100
        }
      }

    } catch (error) {
      console.error('Error getting consolidation statistics:', error)
      return {
        totalCandidates: 0,
        eligibleCandidates: 0,
        consolidationsCreated: 0,
        totalInvoicesConsolidated: 0,
        emailsSaved: 0,
        averageInvoicesPerConsolidation: 0,
        consolidationRate: 0,
        effectiveness: {
          openRate: 0,
          clickRate: 0,
          responseRate: 0
        }
      }
    }
  }

  /**
   * Get detection statistics for monitoring
   */
  async getDetectionStatistics(
    companyId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalEligibleInvoices: number
    triggeredSequences: number
    skippedInvoices: number
    consolidatedCustomers: number
    consolidatedInvoices: number
    emailsSaved: number
    averageResponseTime: number
    topSkipReasons: Array<{ reason: string; count: number }>
    escalationDistribution: Record<string, number>
    consolidationMetrics: {
      candidatesFound: number
      candidatesEligible: number
      consolidationsCreated: number
      averageInvoicesPerConsolidation: number
    }
  }> {
    const whereClause: any = {}

    if (companyId) {
      whereClause.companyId = companyId
    }

    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      }
    }

    const [activities, followUpLogs, consolidationStats] = await Promise.all([
      prisma.activities.findMany({
        where: {
          type: 'FOLLOW_UP_TRIGGERED',
          ...whereClause
        }
      }),
      prisma.follow_up_logss.findMany({
        where: {
          ...whereClause,
          deliveryStatus: { not: 'FAILED' }
        }
      }),
      this.getConsolidationStatistics(companyId, dateRange)
    ])

    // Calculate statistics
    const triggeredSequences = activities.length
    const escalationDistribution: Record<string, number> = {}

    activities.forEach(activity => {
      const escalationLevel = activity.metadata?.escalationLevel || 'UNKNOWN'
      escalationDistribution[escalationLevel] = (escalationDistribution[escalationLevel] || 0) + 1
    })

    return {
      totalEligibleInvoices: triggeredSequences + consolidationStats.totalInvoicesConsolidated,
      triggeredSequences,
      skippedInvoices: 100, // Placeholder - would need more detailed tracking
      consolidatedCustomers: consolidationStats.consolidationsCreated,
      consolidatedInvoices: consolidationStats.totalInvoicesConsolidated,
      emailsSaved: consolidationStats.emailsSaved,
      averageResponseTime: 24, // Placeholder - hours
      topSkipReasons: [
        { reason: 'Outside business hours', count: 25 },
        { reason: 'UAE holiday', count: 15 },
        { reason: 'Prayer time conflict', count: 10 },
        { reason: 'Customer in consolidation waiting period', count: 8 },
        { reason: 'Consolidation preference disabled', count: 5 }
      ], // Enhanced with consolidation reasons
      escalationDistribution,
      consolidationMetrics: {
        candidatesFound: consolidationStats.totalCandidates,
        candidatesEligible: consolidationStats.eligibleCandidates,
        consolidationsCreated: consolidationStats.consolidationsCreated,
        averageInvoicesPerConsolidation: consolidationStats.averageInvoicesPerConsolidation
      }
    }
  }
}

// Singleton instance for global use
export const followUpDetectionService = new FollowUpDetectionService()