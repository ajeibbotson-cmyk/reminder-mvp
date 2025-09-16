import { prisma } from '../prisma'
import { uaeBusinessHours } from './uae-business-hours-service'
import { culturalCompliance } from './cultural-compliance-service'
import { InvoiceStatus } from '@prisma/client'

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
  errors: string[]
  warnings: string[]
  metrics: {
    byCompany: Record<string, number>
    byAmount: Record<string, number>
    byDaysOverdue: Record<string, number>
    byCustomerSegment: Record<string, number>
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
   */
  async detectAndTriggerFollowUps(
    conditions: Partial<FollowUpTriggerConditions> = {}
  ): Promise<DetectionResults> {
    const triggerConditions = { ...FollowUpDetectionService.DEFAULT_TRIGGER_CONDITIONS, ...conditions }

    const results: DetectionResults = {
      eligibleInvoices: 0,
      triggeredSequences: 0,
      skippedInvoices: 0,
      errors: [],
      warnings: [],
      metrics: {
        byCompany: {},
        byAmount: {},
        byDaysOverdue: {},
        byCustomerSegment: {}
      }
    }

    try {
      console.log('🔍 Starting follow-up detection with conditions:', triggerConditions)

      // Find eligible invoices
      const eligibleInvoices = await this.findEligibleInvoices(triggerConditions)
      results.eligibleInvoices = eligibleInvoices.length

      console.log(`📋 Found ${eligibleInvoices.length} eligible invoices for follow-up`)

      // Process each invoice
      for (const invoice of eligibleInvoices) {
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

      console.log(`✅ Detection completed: ${results.triggeredSequences} triggered, ${results.skippedInvoices} skipped`)

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

    return await prisma.invoice.findMany({
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
    const followUpLog = await prisma.followUpLog.create({
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
    await prisma.activity.create({
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
    const recentPayments = await prisma.payment.findMany({
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
    const manualOverride = await prisma.activity.findFirst({
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
   * Get detection statistics for monitoring
   */
  async getDetectionStatistics(
    companyId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalEligibleInvoices: number
    triggeredSequences: number
    skippedInvoices: number
    averageResponseTime: number
    topSkipReasons: Array<{ reason: string; count: number }>
    escalationDistribution: Record<string, number>
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

    const [activities, followUpLogs] = await Promise.all([
      prisma.activity.findMany({
        where: {
          type: 'FOLLOW_UP_TRIGGERED',
          ...whereClause
        }
      }),
      prisma.followUpLog.findMany({
        where: {
          ...whereClause,
          deliveryStatus: { not: 'FAILED' }
        }
      })
    ])

    // Calculate statistics
    const triggeredSequences = activities.length
    const escalationDistribution: Record<string, number> = {}

    activities.forEach(activity => {
      const escalationLevel = activity.metadata?.escalationLevel || 'UNKNOWN'
      escalationDistribution[escalationLevel] = (escalationDistribution[escalationLevel] || 0) + 1
    })

    return {
      totalEligibleInvoices: triggeredSequences + 100, // Placeholder - would need more complex calculation
      triggeredSequences,
      skippedInvoices: 100, // Placeholder
      averageResponseTime: 24, // Placeholder - hours
      topSkipReasons: [
        { reason: 'Outside business hours', count: 25 },
        { reason: 'UAE holiday', count: 15 },
        { reason: 'Prayer time conflict', count: 10 }
      ], // Placeholder
      escalationDistribution
    }
  }
}

// Singleton instance for global use
export const followUpDetectionService = new FollowUpDetectionService()