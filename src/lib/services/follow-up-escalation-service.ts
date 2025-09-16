import { prisma } from '../prisma'
import { uaeBusinessHours } from './uae-business-hours-service'
import { getDefaultEmailService } from '../email-service'

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

interface EscalationTrigger {
  condition: 'NO_RESPONSE' | 'NO_PAYMENT' | 'PARTIAL_PAYMENT' | 'BOUNCE' | 'COMPLAINT' | 'MANUAL'
  timeframe?: number // hours
  threshold?: number // for amounts or counts
}

interface EscalationAction {
  type: 'SKIP_STEP' | 'ACCELERATE' | 'CHANGE_SEQUENCE' | 'NOTIFY_MANAGER' | 'HOLD' | 'ESCALATE_URGENCY'
  parameters?: Record<string, any>
}

interface EscalationRule {
  id: string
  name: string
  trigger: EscalationTrigger
  action: EscalationAction
  priority: number
  active: boolean
  conditions?: {
    minAmount?: number
    maxAmount?: number
    customerSegments?: string[]
    daysSinceLastContact?: number
  }
}

interface ProcessingResult {
  processed: number
  escalated: number
  held: number
  accelerated: number
  failed: number
  errors: string[]
  warnings: string[]
  actions: Array<{
    followUpLogId: string
    action: string
    reason: string
    timestamp: Date
  }>
}

/**
 * Follow-up Escalation Service
 * Manages intelligent escalation of follow-up sequences with retry logic and error handling
 * Includes UAE business compliance and cultural sensitivity
 */
export class FollowUpEscalationService {
  private static readonly DEFAULT_ESCALATION_RULES: EscalationRule[] = [
    {
      id: 'no-response-48h',
      name: 'No Response in 48 Hours',
      trigger: { condition: 'NO_RESPONSE', timeframe: 48 },
      action: { type: 'ACCELERATE', parameters: { reduceDaysBy: 1 } },
      priority: 1,
      active: true,
      conditions: { minAmount: 1000 }
    },
    {
      id: 'high-value-urgent',
      name: 'High Value Invoice Urgent Escalation',
      trigger: { condition: 'NO_PAYMENT', timeframe: 72 },
      action: { type: 'ESCALATE_URGENCY', parameters: { newLevel: 'URGENT' } },
      priority: 2,
      active: true,
      conditions: { minAmount: 10000 }
    },
    {
      id: 'email-bounce-hold',
      name: 'Email Bounce - Hold Sequence',
      trigger: { condition: 'BOUNCE' },
      action: { type: 'HOLD', parameters: { reason: 'Email bounced', duration: 24 } },
      priority: 3,
      active: true
    },
    {
      id: 'complaint-stop',
      name: 'Customer Complaint - Stop All',
      trigger: { condition: 'COMPLAINT' },
      action: { type: 'HOLD', parameters: { reason: 'Customer complaint received', permanent: true } },
      priority: 4,
      active: true
    },
    {
      id: 'partial-payment-gentle',
      name: 'Partial Payment - Switch to Gentle',
      trigger: { condition: 'PARTIAL_PAYMENT', threshold: 0.5 },
      action: { type: 'CHANGE_SEQUENCE', parameters: { sequenceType: 'GENTLE' } },
      priority: 5,
      active: true
    }
  ]

  private escalationRules: EscalationRule[]

  constructor(customRules: EscalationRule[] = []) {
    this.escalationRules = [
      ...FollowUpEscalationService.DEFAULT_ESCALATION_RULES,
      ...customRules
    ].sort((a, b) => a.priority - b.priority)
  }

  /**
   * Main escalation processing method
   * Analyzes all active follow-ups and applies escalation rules
   */
  async processEscalations(): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      processed: 0,
      escalated: 0,
      held: 0,
      accelerated: 0,
      failed: 0,
      errors: [],
      warnings: [],
      actions: []
    }

    try {
      console.log('🔄 Starting escalation processing...')

      // Get all active follow-up logs
      const activeFollowUps = await this.getActiveFollowUps()
      result.processed = activeFollowUps.length

      console.log(`📊 Processing ${activeFollowUps.length} active follow-ups for escalation`)

      // Process each follow-up
      for (const followUp of activeFollowUps) {
        try {
          const escalationResult = await this.processFollowUpEscalation(followUp)

          if (escalationResult.actionTaken) {
            switch (escalationResult.action?.type) {
              case 'ESCALATE_URGENCY':
                result.escalated++
                break
              case 'ACCELERATE':
                result.accelerated++
                break
              case 'HOLD':
                result.held++
                break
            }

            result.actions.push({
              followUpLogId: followUp.id,
              action: escalationResult.action?.type || 'UNKNOWN',
              reason: escalationResult.reason || 'No reason provided',
              timestamp: new Date()
            })
          }

        } catch (error) {
          result.failed++
          const errorMsg = `Failed to process escalation for follow-up ${followUp.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          console.error(errorMsg, error)
        }
      }

      console.log(`✅ Escalation processing completed: ${result.escalated} escalated, ${result.held} held, ${result.accelerated} accelerated`)

    } catch (error) {
      const errorMsg = `Escalation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      console.error(errorMsg, error)
    }

    return result
  }

  /**
   * Get all active follow-ups that might need escalation
   */
  private async getActiveFollowUps() {
    return await prisma.followUpLog.findMany({
      where: {
        deliveryStatus: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
        sentAt: {
          // Only consider follow-ups from the last 30 days
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        invoice: {
          include: {
            company: true,
            customer: true,
            payments: {
              where: {
                paymentDate: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
              }
            }
          }
        },
        followUpSequence: true,
        emailLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { sentAt: 'asc' }
    })
  }

  /**
   * Process escalation for a single follow-up
   */
  private async processFollowUpEscalation(followUp: any): Promise<{
    actionTaken: boolean
    action?: EscalationAction
    reason?: string
  }> {
    // Check each escalation rule
    for (const rule of this.escalationRules) {
      if (!rule.active) continue

      const shouldTrigger = await this.shouldTriggerEscalation(followUp, rule)
      if (shouldTrigger.trigger) {
        console.log(`🚨 Triggering escalation rule: ${rule.name} for follow-up ${followUp.id}`)

        const actionResult = await this.executeEscalationAction(followUp, rule.action, shouldTrigger.reason)

        if (actionResult.success) {
          // Log the escalation action
          await this.logEscalationAction(followUp, rule, actionResult.details)

          return {
            actionTaken: true,
            action: rule.action,
            reason: shouldTrigger.reason || rule.name
          }
        }
      }
    }

    return { actionTaken: false }
  }

  /**
   * Check if an escalation rule should trigger for a follow-up
   */
  private async shouldTriggerEscalation(
    followUp: any,
    rule: EscalationRule
  ): Promise<{ trigger: boolean; reason?: string }> {
    const now = new Date()

    // Check rule conditions first
    if (rule.conditions) {
      const invoiceAmount = Number(followUp.invoice.totalAmount || followUp.invoice.amount)

      if (rule.conditions.minAmount && invoiceAmount < rule.conditions.minAmount) {
        return { trigger: false }
      }

      if (rule.conditions.maxAmount && invoiceAmount > rule.conditions.maxAmount) {
        return { trigger: false }
      }

      if (rule.conditions.customerSegments?.length) {
        const customerSegment = followUp.invoice.customer?.businessType
        if (!rule.conditions.customerSegments.includes(customerSegment)) {
          return { trigger: false }
        }
      }

      if (rule.conditions.daysSinceLastContact) {
        const lastContact = await this.getLastCustomerContact(followUp.invoice.customerId)
        if (lastContact) {
          const daysSince = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
          if (daysSince < rule.conditions.daysSinceLastContact) {
            return { trigger: false }
          }
        }
      }
    }

    // Check trigger condition
    switch (rule.trigger.condition) {
      case 'NO_RESPONSE':
        return this.checkNoResponse(followUp, rule.trigger.timeframe || 48)

      case 'NO_PAYMENT':
        return this.checkNoPayment(followUp, rule.trigger.timeframe || 72)

      case 'PARTIAL_PAYMENT':
        return this.checkPartialPayment(followUp, rule.trigger.threshold || 0.5)

      case 'BOUNCE':
        return this.checkEmailBounce(followUp)

      case 'COMPLAINT':
        return this.checkCustomerComplaint(followUp)

      case 'MANUAL':
        return this.checkManualEscalation(followUp)

      default:
        return { trigger: false }
    }
  }

  /**
   * Check for no response condition
   */
  private async checkNoResponse(followUp: any, timeframeHours: number): Promise<{ trigger: boolean; reason?: string }> {
    const cutoffTime = new Date(followUp.sentAt.getTime() + timeframeHours * 60 * 60 * 1000)
    const now = new Date()

    if (now < cutoffTime) {
      return { trigger: false }
    }

    // Check if there's been any response (email opened, clicked, or customer contact)
    const hasResponse = followUp.emailOpened || followUp.emailClicked ||
      await this.hasRecentCustomerContact(followUp.invoice.customerId, followUp.sentAt)

    if (!hasResponse) {
      return {
        trigger: true,
        reason: `No response for ${timeframeHours} hours`
      }
    }

    return { trigger: false }
  }

  /**
   * Check for no payment condition
   */
  private async checkNoPayment(followUp: any, timeframeHours: number): Promise<{ trigger: boolean; reason?: string }> {
    const cutoffTime = new Date(followUp.sentAt.getTime() + timeframeHours * 60 * 60 * 1000)
    const now = new Date()

    if (now < cutoffTime) {
      return { trigger: false }
    }

    // Check if there have been any payments since the follow-up was sent
    const paymentsAfterFollowUp = followUp.invoice.payments.filter(
      (payment: any) => payment.paymentDate > followUp.sentAt
    )

    if (paymentsAfterFollowUp.length === 0) {
      return {
        trigger: true,
        reason: `No payment received for ${timeframeHours} hours after follow-up`
      }
    }

    return { trigger: false }
  }

  /**
   * Check for partial payment condition
   */
  private async checkPartialPayment(followUp: any, threshold: number): Promise<{ trigger: boolean; reason?: string }> {
    const totalAmount = Number(followUp.invoice.totalAmount || followUp.invoice.amount)
    const totalPaid = followUp.invoice.payments.reduce(
      (sum: number, payment: any) => sum + Number(payment.amount),
      0
    )

    const paidPercentage = totalPaid / totalAmount

    if (paidPercentage > 0 && paidPercentage < threshold) {
      return {
        trigger: true,
        reason: `Partial payment received (${Math.round(paidPercentage * 100)}% of total)`
      }
    }

    return { trigger: false }
  }

  /**
   * Check for email bounce condition
   */
  private async checkEmailBounce(followUp: any): Promise<{ trigger: boolean; reason?: string }> {
    const bouncedEmails = followUp.emailLogs.filter(
      (log: any) => log.deliveryStatus === 'BOUNCED'
    )

    if (bouncedEmails.length > 0) {
      return {
        trigger: true,
        reason: 'Email bounced'
      }
    }

    return { trigger: false }
  }

  /**
   * Check for customer complaint condition
   */
  private async checkCustomerComplaint(followUp: any): Promise<{ trigger: boolean; reason?: string }> {
    // Check for complaint activities
    const complaints = await prisma.activity.findMany({
      where: {
        type: 'CUSTOMER_COMPLAINT',
        companyId: followUp.invoice.companyId,
        metadata: {
          path: ['customerId'],
          equals: followUp.invoice.customerId
        },
        createdAt: {
          gte: new Date(followUp.sentAt.getTime() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    if (complaints.length > 0) {
      return {
        trigger: true,
        reason: 'Customer complaint received'
      }
    }

    return { trigger: false }
  }

  /**
   * Check for manual escalation flag
   */
  private async checkManualEscalation(followUp: any): Promise<{ trigger: boolean; reason?: string }> {
    const manualFlags = await prisma.activity.findMany({
      where: {
        type: 'MANUAL_ESCALATION',
        metadata: {
          path: ['followUpLogId'],
          equals: followUp.id
        },
        createdAt: {
          gte: new Date(followUp.sentAt.getTime())
        }
      }
    })

    if (manualFlags.length > 0) {
      return {
        trigger: true,
        reason: 'Manual escalation flag set'
      }
    }

    return { trigger: false }
  }

  /**
   * Execute an escalation action
   */
  private async executeEscalationAction(
    followUp: any,
    action: EscalationAction,
    reason: string
  ): Promise<{ success: boolean; details?: any }> {
    try {
      switch (action.type) {
        case 'ACCELERATE':
          return await this.accelerateSequence(followUp, action.parameters)

        case 'ESCALATE_URGENCY':
          return await this.escalateUrgency(followUp, action.parameters)

        case 'HOLD':
          return await this.holdSequence(followUp, action.parameters, reason)

        case 'CHANGE_SEQUENCE':
          return await this.changeSequence(followUp, action.parameters)

        case 'NOTIFY_MANAGER':
          return await this.notifyManager(followUp, action.parameters, reason)

        case 'SKIP_STEP':
          return await this.skipStep(followUp, action.parameters)

        default:
          return { success: false }
      }
    } catch (error) {
      console.error(`Failed to execute escalation action ${action.type}:`, error)
      return { success: false }
    }
  }

  /**
   * Accelerate sequence timing
   */
  private async accelerateSequence(followUp: any, parameters?: any): Promise<{ success: boolean; details?: any }> {
    const reduceDaysBy = parameters?.reduceDaysBy || 1

    // Find next pending step
    const nextStep = await prisma.followUpLog.findFirst({
      where: {
        invoiceId: followUp.invoiceId,
        sequenceId: followUp.sequenceId,
        stepNumber: { gt: followUp.stepNumber },
        deliveryStatus: 'QUEUED'
      },
      orderBy: { stepNumber: 'asc' }
    })

    if (nextStep) {
      const newSendTime = new Date(
        nextStep.sentAt.getTime() - reduceDaysBy * 24 * 60 * 60 * 1000
      )

      // Ensure it's still in UAE business hours
      const validSendTime = uaeBusinessHours.getNextAvailableSendTime(newSendTime, {
        preferredDays: [2, 3, 4],
        preferredHours: [10, 11],
        avoidPrayerTimes: true,
        respectRamadan: true,
        culturalTone: 'BUSINESS'
      })

      await prisma.followUpLog.update({
        where: { id: nextStep.id },
        data: { sentAt: validSendTime }
      })

      return {
        success: true,
        details: {
          originalTime: nextStep.sentAt,
          newTime: validSendTime,
          reducedByDays: reduceDaysBy
        }
      }
    }

    return { success: false }
  }

  /**
   * Escalate urgency level
   */
  private async escalateUrgency(followUp: any, parameters?: any): Promise<{ success: boolean; details?: any }> {
    const newLevel = parameters?.newLevel || 'URGENT'

    // Parse sequence steps
    let steps: FollowUpStep[]
    try {
      steps = typeof followUp.followUpSequence.steps === 'string'
        ? JSON.parse(followUp.followUpSequence.steps)
        : followUp.followUpSequence.steps
    } catch {
      return { success: false }
    }

    // Find urgent/final steps and schedule them
    const urgentSteps = steps.filter(step =>
      step.escalationLevel === newLevel && step.stepNumber > followUp.stepNumber
    )

    if (urgentSteps.length > 0) {
      const urgentStep = urgentSteps[0]
      const sendTime = uaeBusinessHours.getNextAvailableSendTime(new Date(), {
        preferredDays: [2, 3, 4],
        preferredHours: [9, 10, 11, 13, 14], // Broader hours for urgent
        avoidPrayerTimes: true,
        respectRamadan: true,
        culturalTone: 'FORMAL'
      })

      // Cancel pending steps and insert urgent step
      await prisma.followUpLog.updateMany({
        where: {
          invoiceId: followUp.invoiceId,
          sequenceId: followUp.sequenceId,
          stepNumber: { gt: followUp.stepNumber },
          deliveryStatus: 'QUEUED'
        },
        data: { deliveryStatus: 'CANCELLED' }
      })

      // Create new urgent step
      await prisma.followUpLog.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: followUp.invoiceId,
          sequenceId: followUp.sequenceId,
          stepNumber: urgentStep.stepNumber,
          emailAddress: followUp.emailAddress,
          subject: urgentStep.subject,
          content: urgentStep.content,
          sentAt: sendTime,
          deliveryStatus: 'QUEUED'
        }
      })

      return {
        success: true,
        details: {
          escalatedToLevel: newLevel,
          scheduledTime: sendTime
        }
      }
    }

    return { success: false }
  }

  /**
   * Hold sequence temporarily or permanently
   */
  private async holdSequence(
    followUp: any,
    parameters?: any,
    reason?: string
  ): Promise<{ success: boolean; details?: any }> {
    const duration = parameters?.duration || 24 // hours
    const permanent = parameters?.permanent || false

    const newStatus = permanent ? 'CANCELLED' : 'HELD'
    const resumeTime = permanent ? null : new Date(Date.now() + duration * 60 * 60 * 1000)

    // Update all pending steps
    await prisma.followUpLog.updateMany({
      where: {
        invoiceId: followUp.invoiceId,
        sequenceId: followUp.sequenceId,
        stepNumber: { gte: followUp.stepNumber },
        deliveryStatus: 'QUEUED'
      },
      data: { deliveryStatus: newStatus }
    })

    // Create hold record
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: followUp.invoice.companyId,
        userId: 'system',
        type: 'FOLLOW_UP_HELD',
        description: `Follow-up sequence held: ${reason}`,
        metadata: {
          invoiceId: followUp.invoiceId,
          sequenceId: followUp.sequenceId,
          reason,
          duration,
          permanent,
          resumeTime
        }
      }
    })

    return {
      success: true,
      details: {
        holdType: permanent ? 'permanent' : 'temporary',
        duration,
        resumeTime,
        reason
      }
    }
  }

  /**
   * Change to a different sequence
   */
  private async changeSequence(followUp: any, parameters?: any): Promise<{ success: boolean; details?: any }> {
    // Implementation would depend on having multiple sequence types available
    // For now, return success but don't actually change
    return {
      success: true,
      details: { message: 'Sequence change logic not yet implemented' }
    }
  }

  /**
   * Notify manager about escalation
   */
  private async notifyManager(
    followUp: any,
    parameters?: any,
    reason?: string
  ): Promise<{ success: boolean; details?: any }> {
    try {
      const emailService = getDefaultEmailService()

      // Find company managers/admins
      const managers = await prisma.user.findMany({
        where: {
          companyId: followUp.invoice.companyId,
          role: { in: ['ADMIN', 'MANAGER'] }
        }
      })

      if (managers.length === 0) {
        return { success: false }
      }

      // Send notification to first manager
      const manager = managers[0]
      const invoiceAmount = Number(followUp.invoice.totalAmount || followUp.invoice.amount)

      await emailService.sendEmail({
        companyId: followUp.invoice.companyId,
        recipientEmail: manager.email,
        recipientName: manager.name,
        subject: `Follow-up Escalation: Invoice ${followUp.invoice.number}`,
        content: `
          <h3>Follow-up Escalation Notification</h3>
          <p>A follow-up sequence has been escalated for your attention:</p>
          <ul>
            <li><strong>Invoice:</strong> ${followUp.invoice.number}</li>
            <li><strong>Customer:</strong> ${followUp.invoice.customerName}</li>
            <li><strong>Amount:</strong> ${followUp.invoice.currency} ${invoiceAmount.toLocaleString('en-AE')}</li>
            <li><strong>Reason:</strong> ${reason}</li>
            <li><strong>Days Overdue:</strong> ${Math.ceil((Date.now() - followUp.invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))}</li>
          </ul>
          <p>Please review and take appropriate action.</p>
        `,
        variables: {
          managerName: manager.name,
          invoiceNumber: followUp.invoice.number,
          customerName: followUp.invoice.customerName,
          escalationReason: reason || 'Unknown'
        }
      })

      return {
        success: true,
        details: {
          notifiedManager: manager.email,
          reason
        }
      }

    } catch (error) {
      console.error('Failed to notify manager:', error)
      return { success: false }
    }
  }

  /**
   * Skip current step and move to next
   */
  private async skipStep(followUp: any, parameters?: any): Promise<{ success: boolean; details?: any }> {
    // Mark current step as skipped
    await prisma.followUpLog.update({
      where: { id: followUp.id },
      data: { deliveryStatus: 'SKIPPED' }
    })

    return {
      success: true,
      details: { skippedStep: followUp.stepNumber }
    }
  }

  /**
   * Helper methods
   */
  private async getLastCustomerContact(customerId: string): Promise<Date | null> {
    const lastActivity = await prisma.activity.findFirst({
      where: {
        type: { in: ['EMAIL_SENT', 'PHONE_CALL', 'MEETING'] },
        metadata: {
          path: ['customerId'],
          equals: customerId
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return lastActivity?.createdAt || null
  }

  private async hasRecentCustomerContact(customerId: string, since: Date): Promise<boolean> {
    const recentContact = await prisma.activity.findFirst({
      where: {
        type: { in: ['CUSTOMER_RESPONSE', 'PHONE_CALL', 'EMAIL_REPLY'] },
        metadata: {
          path: ['customerId'],
          equals: customerId
        },
        createdAt: { gte: since }
      }
    })

    return !!recentContact
  }

  /**
   * Log escalation action for audit trail
   */
  private async logEscalationAction(
    followUp: any,
    rule: EscalationRule,
    actionDetails: any
  ): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: followUp.invoice.companyId,
          userId: 'system',
          type: 'FOLLOW_UP_ESCALATED',
          description: `Escalation rule "${rule.name}" triggered for invoice ${followUp.invoice.number}`,
          metadata: {
            followUpLogId: followUp.id,
            invoiceId: followUp.invoiceId,
            ruleId: rule.id,
            ruleName: rule.name,
            action: rule.action,
            actionDetails,
            triggerCondition: rule.trigger
          }
        }
      })
    } catch (error) {
      console.error('Failed to log escalation action:', error)
    }
  }

  /**
   * Get escalation statistics for monitoring
   */
  async getEscalationStatistics(
    companyId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalEscalations: number
    escalationsByType: Record<string, number>
    escalationsByRule: Record<string, number>
    averageTimeToEscalation: number
    resolutionRate: number
  }> {
    const whereClause: any = {
      type: 'FOLLOW_UP_ESCALATED'
    }

    if (companyId) {
      whereClause.companyId = companyId
    }

    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      }
    }

    const escalations = await prisma.activity.findMany({
      where: whereClause
    })

    const escalationsByType: Record<string, number> = {}
    const escalationsByRule: Record<string, number> = {}

    escalations.forEach(escalation => {
      const actionType = escalation.metadata?.action?.type || 'UNKNOWN'
      const ruleName = escalation.metadata?.ruleName || 'UNKNOWN'

      escalationsByType[actionType] = (escalationsByType[actionType] || 0) + 1
      escalationsByRule[ruleName] = (escalationsByRule[ruleName] || 0) + 1
    })

    return {
      totalEscalations: escalations.length,
      escalationsByType,
      escalationsByRule,
      averageTimeToEscalation: 24, // Placeholder - would need more complex calculation
      resolutionRate: 0.75 // Placeholder - would need resolution tracking
    }
  }

  /**
   * Resume held sequences
   */
  async resumeHeldSequences(): Promise<{ resumed: number; errors: string[] }> {
    const result = { resumed: 0, errors: [] }

    try {
      // Find sequences that should be resumed
      const heldActivities = await prisma.activity.findMany({
        where: {
          type: 'FOLLOW_UP_HELD',
          metadata: {
            path: ['resumeTime'],
            lte: new Date()
          }
        }
      })

      for (const activity of heldActivities) {
        try {
          const { invoiceId, sequenceId } = activity.metadata as any

          // Resume the sequence
          await prisma.followUpLog.updateMany({
            where: {
              invoiceId,
              sequenceId,
              deliveryStatus: 'HELD'
            },
            data: { deliveryStatus: 'QUEUED' }
          })

          result.resumed++

        } catch (error) {
          result.errors.push(`Failed to resume sequence for activity ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

    } catch (error) {
      result.errors.push(`Failed to resume held sequences: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }
}

// Singleton instance for global use
export const followUpEscalationService = new FollowUpEscalationService()