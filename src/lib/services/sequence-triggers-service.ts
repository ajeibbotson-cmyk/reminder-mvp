import { prisma } from '../prisma'
import { sequenceExecutionService, TriggerCondition } from './sequence-execution-service'
import { uaeBusinessHours } from './uae-business-hours-service'

export interface TriggerRule {
  id: string
  companyId: string
  sequenceId: string
  name: string
  description: string
  isActive: boolean
  triggerType: TriggerType
  conditions: TriggerCondition[]
  priority: number
  cooldownHours: number
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export type TriggerType = 
  | 'DUE_DATE_REACHED'
  | 'OVERDUE_DAYS'
  | 'INVOICE_STATUS_CHANGE'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_PARTIAL'
  | 'MANUAL_TRIGGER'
  | 'CUSTOMER_RESPONSE'
  | 'EMAIL_BOUNCE'
  | 'SCHEDULED_FOLLOWUP'

export interface TriggerEvent {
  id: string
  companyId: string
  triggerRuleId: string
  invoiceId: string
  triggerType: TriggerType
  eventData: Record<string, any>
  processedAt?: Date
  success?: boolean
  errorMessage?: string
  sequenceExecutionId?: string
  createdAt: Date
}

export interface TriggerExecutionResult {
  triggered: boolean
  sequenceExecutionId?: string
  reason?: string
  nextCheckAt?: Date
}

export interface MonitoringMetrics {
  totalTriggers: number
  activeTriggers: number
  triggersLastHour: number
  triggersLastDay: number
  successRate: number
  mostCommonTriggers: { type: TriggerType; count: number }[]
  failedTriggers: number
}

/**
 * Sequence Triggers Service
 * Monitors invoice events and automatically triggers appropriate email sequences
 */
export class SequenceTriggersService {

  /**
   * Monitor invoice status changes and trigger sequences
   */
  async monitorInvoiceEvents(): Promise<{
    processed: number
    triggered: number
    errors: string[]
  }> {
    const results = {
      processed: 0,
      triggered: 0,
      errors: [] as string[]
    }

    try {
      // Get all active trigger rules
      const triggerRules = await prisma.followUpSequence.findMany({
        where: { active: true },
        include: { company: true }
      })

      for (const sequence of triggerRules) {
        try {
          const triggerResult = await this.checkSequenceTriggers(sequence)
          results.processed++
          
          if (triggerResult.triggered > 0) {
            results.triggered += triggerResult.triggered
          }
          
          results.errors.push(...triggerResult.errors)

        } catch (error) {
          results.errors.push(`Error processing sequence ${sequence.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return results

    } catch (error) {
      results.errors.push(`Monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return results
    }
  }

  /**
   * Check triggers for a specific sequence
   */
  private async checkSequenceTriggers(sequence: any): Promise<{
    triggered: number
    errors: string[]
  }> {
    const results = {
      triggered: 0,
      errors: [] as string[]
    }

    try {
      // Parse trigger conditions from sequence metadata
      const triggerConditions = this.parseSequenceTriggers(sequence)

      for (const trigger of triggerConditions) {
        try {
          const candidateInvoices = await this.findCandidateInvoices(sequence.companyId, trigger)
          
          for (const invoice of candidateInvoices) {
            const shouldTrigger = await this.evaluateTriggerConditions(invoice, trigger)
            
            if (shouldTrigger.shouldTrigger) {
              // Check if sequence is already running for this invoice
              const existingExecution = await this.checkExistingExecution(sequence.id, invoice.id)
              
              if (!existingExecution) {
                const triggerResult = await this.executeTrigger(sequence.id, invoice.id, trigger)
                
                if (triggerResult.triggered) {
                  results.triggered++
                  
                  // Log trigger event
                  await this.logTriggerEvent({
                    companyId: sequence.companyId,
                    sequenceId: sequence.id,
                    invoiceId: invoice.id,
                    triggerType: trigger.type,
                    success: true,
                    sequenceExecutionId: triggerResult.sequenceExecutionId
                  })
                } else if (triggerResult.reason) {
                  results.errors.push(triggerResult.reason)
                }
              }
            }
          }

        } catch (error) {
          results.errors.push(`Trigger evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return results

    } catch (error) {
      results.errors.push(`Sequence trigger check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return results
    }
  }

  /**
   * Parse trigger conditions from sequence configuration
   */
  private parseSequenceTriggers(sequence: any): Array<{
    type: TriggerType
    conditions: TriggerCondition[]
    cooldownHours: number
  }> {
    const triggers: Array<{
      type: TriggerType
      conditions: TriggerCondition[]
      cooldownHours: number
    }> = []

    try {
      // Default triggers based on sequence name and configuration
      const sequenceName = sequence.name.toLowerCase()

      if (sequenceName.includes('overdue') || sequenceName.includes('past due')) {
        triggers.push({
          type: 'OVERDUE_DAYS',
          conditions: [
            {
              type: 'DUE_DATE',
              value: 0,
              operator: 'LESS_THAN' // Past due date
            },
            {
              type: 'INVOICE_STATUS',
              value: ['SENT', 'OVERDUE'],
              operator: 'IN'
            }
          ],
          cooldownHours: 24
        })
      }

      if (sequenceName.includes('reminder') || sequenceName.includes('follow')) {
        triggers.push({
          type: 'DUE_DATE_REACHED',
          conditions: [
            {
              type: 'DUE_DATE',
              value: 7, // 7 days before due date
              operator: 'LESS_THAN'
            },
            {
              type: 'INVOICE_STATUS',
              value: 'SENT',
              operator: 'EQUALS'
            }
          ],
          cooldownHours: 72
        })
      }

      // Add more sophisticated trigger parsing from sequence metadata
      if (sequence.metadata && sequence.metadata.triggers) {
        // Parse custom triggers from metadata
        const customTriggers = sequence.metadata.triggers
        triggers.push(...customTriggers)
      }

      return triggers

    } catch {
      // Return default triggers if parsing fails
      return [
        {
          type: 'OVERDUE_DAYS',
          conditions: [
            {
              type: 'DUE_DATE',
              value: 0,
              operator: 'LESS_THAN'
            }
          ],
          cooldownHours: 24
        }
      ]
    }
  }

  /**
   * Find candidate invoices for trigger evaluation
   */
  private async findCandidateInvoices(
    companyId: string,
    trigger: { type: TriggerType; conditions: TriggerCondition[] }
  ): Promise<any[]> {
    const baseWhere: any = {
      companyId,
      status: { in: ['SENT', 'OVERDUE'] } // Only unpaid invoices
    }

    // Add specific filters based on trigger type
    switch (trigger.type) {
      case 'DUE_DATE_REACHED':
        baseWhere.dueDate = {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Due within 7 days
        }
        break

      case 'OVERDUE_DAYS':
        baseWhere.dueDate = {
          lt: new Date() // Past due date
        }
        break

      case 'INVOICE_STATUS_CHANGE':
        // Would need to track status changes - simplified for now
        break
    }

    return await prisma.invoice.findMany({
      where: baseWhere,
      include: {
        customer: true,
        company: true,
        payments: true
      },
      take: 100 // Process in batches
    })
  }

  /**
   * Evaluate if trigger conditions are met for an invoice
   */
  private async evaluateTriggerConditions(
    invoice: any,
    trigger: { type: TriggerType; conditions: TriggerCondition[]; cooldownHours: number }
  ): Promise<{ shouldTrigger: boolean; reason?: string }> {
    
    // Check cooldown period
    const cooldownCheck = await this.checkCooldownPeriod(
      invoice.id,
      trigger.type,
      trigger.cooldownHours
    )
    
    if (!cooldownCheck.canTrigger) {
      return { shouldTrigger: false, reason: cooldownCheck.reason }
    }

    // Evaluate each condition
    for (const condition of trigger.conditions) {
      const conditionMet = this.evaluateCondition(invoice, condition)
      
      if (!conditionMet) {
        return { shouldTrigger: false, reason: `Condition not met: ${condition.type}` }
      }
    }

    // Check if invoice is in a state that allows triggering
    const invoiceCheck = this.validateInvoiceForTrigger(invoice)
    if (!invoiceCheck.canTrigger) {
      return { shouldTrigger: false, reason: invoiceCheck.reason }
    }

    // Check UAE business context
    if (!uaeBusinessHours.isBusinessHours(new Date())) {
      const nextBusinessHour = uaeBusinessHours.getNextBusinessHour(new Date())
      if (nextBusinessHour.getTime() - Date.now() > 4 * 60 * 60 * 1000) { // More than 4 hours away
        return { shouldTrigger: false, reason: 'Outside UAE business hours' }
      }
    }

    return { shouldTrigger: true }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(invoice: any, condition: TriggerCondition): boolean {
    let actualValue: any

    switch (condition.type) {
      case 'INVOICE_STATUS':
        actualValue = invoice.status
        break

      case 'DUE_DATE':
        const daysToDue = Math.ceil((invoice.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        actualValue = daysToDue
        break

      case 'DAYS_OVERDUE':
        const daysOverdue = Math.max(0, Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        actualValue = daysOverdue
        break

      case 'PAYMENT_RECEIVED':
        const totalPaid = invoice.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
        actualValue = totalPaid
        break

      default:
        return false
    }

    // Apply operator
    switch (condition.operator) {
      case 'EQUALS':
        return actualValue === condition.value

      case 'GREATER_THAN':
        return actualValue > condition.value

      case 'LESS_THAN':
        return actualValue < condition.value

      case 'IN':
        return Array.isArray(condition.value) && condition.value.includes(actualValue)

      case 'NOT_IN':
        return Array.isArray(condition.value) && !condition.value.includes(actualValue)

      default:
        return false
    }
  }

  /**
   * Check cooldown period for trigger
   */
  private async checkCooldownPeriod(
    invoiceId: string,
    triggerType: TriggerType,
    cooldownHours: number
  ): Promise<{ canTrigger: boolean; reason?: string }> {
    
    const cooldownTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000)

    // Check recent trigger events for this invoice and type
    const recentTrigger = await prisma.followUpLog.findFirst({
      where: {
        invoiceId,
        sentAt: {
          gte: cooldownTime
        }
      },
      orderBy: { sentAt: 'desc' }
    })

    if (recentTrigger) {
      return { 
        canTrigger: false, 
        reason: `Cooldown period active (${cooldownHours}h)` 
      }
    }

    return { canTrigger: true }
  }

  /**
   * Validate invoice state for triggering
   */
  private validateInvoiceForTrigger(invoice: any): { canTrigger: boolean; reason?: string } {
    
    // Check if customer has unsubscribed
    // This would be checked against email logs in a real implementation
    
    // Check if invoice amount is reasonable for automated follow-up
    const invoiceAmount = Number(invoice.totalAmount || invoice.amount)
    if (invoiceAmount < 10) { // Very small amounts might not warrant automated follow-up
      return { canTrigger: false, reason: 'Invoice amount too small for automated follow-up' }
    }

    // Check if there are any recent payments (partial)
    const recentPayments = invoice.payments.filter((payment: any) => {
      const paymentAge = Date.now() - payment.paymentDate.getTime()
      return paymentAge < 48 * 60 * 60 * 1000 // Within last 48 hours
    })

    if (recentPayments.length > 0) {
      return { canTrigger: false, reason: 'Recent payment activity detected' }
    }

    return { canTrigger: true }
  }

  /**
   * Execute a trigger
   */
  private async executeTrigger(
    sequenceId: string,
    invoiceId: string,
    trigger: { type: TriggerType; conditions: TriggerCondition[] }
  ): Promise<TriggerExecutionResult> {
    
    try {
      const triggerCondition: TriggerCondition = {
        type: trigger.type === 'DUE_DATE_REACHED' ? 'DUE_DATE' : 'INVOICE_STATUS',
        value: trigger.type,
        operator: 'EQUALS'
      }

      const executionResult = await sequenceExecutionService.startSequenceExecution(
        sequenceId,
        invoiceId,
        triggerCondition,
        {
          startImmediately: false, // Respect scheduling
          skipValidation: false
        }
      )

      if (executionResult.success) {
        return {
          triggered: true,
          sequenceExecutionId: executionResult.sequenceExecutionId,
          nextCheckAt: executionResult.nextExecutionAt
        }
      } else {
        return {
          triggered: false,
          reason: executionResult.errors.join(', ')
        }
      }

    } catch (error) {
      return {
        triggered: false,
        reason: error instanceof Error ? error.message : 'Execution failed'
      }
    }
  }

  /**
   * Check if sequence is already running for invoice
   */
  private async checkExistingExecution(sequenceId: string, invoiceId: string): Promise<boolean> {
    const existingLog = await prisma.followUpLog.findFirst({
      where: {
        sequenceId,
        invoiceId,
        sentAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Within last 30 days
        }
      }
    })

    return !!existingLog
  }

  /**
   * Log trigger event
   */
  private async logTriggerEvent(event: {
    companyId: string
    sequenceId: string
    invoiceId: string
    triggerType: TriggerType
    success: boolean
    sequenceExecutionId?: string
    errorMessage?: string
  }): Promise<void> {
    
    try {
      // In a real implementation, you'd have a dedicated trigger_events table
      // For now, we'll log to activities table
      await prisma.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: event.companyId,
          userId: 'system', // System user for automated triggers
          type: 'SEQUENCE_TRIGGERED',
          description: `Sequence triggered: ${event.triggerType}`,
          metadata: {
            sequenceId: event.sequenceId,
            invoiceId: event.invoiceId,
            triggerType: event.triggerType,
            success: event.success,
            sequenceExecutionId: event.sequenceExecutionId,
            errorMessage: event.errorMessage
          }
        }
      })
    } catch (error) {
      console.error('Failed to log trigger event:', error)
    }
  }

  /**
   * Manual trigger for sequence
   */
  async manualTrigger(
    sequenceId: string,
    invoiceId: string,
    userId: string,
    reason?: string
  ): Promise<TriggerExecutionResult> {
    
    try {
      const triggerCondition: TriggerCondition = {
        type: 'MANUAL',
        value: reason || 'Manual trigger',
        operator: 'EQUALS'
      }

      const executionResult = await sequenceExecutionService.startSequenceExecution(
        sequenceId,
        invoiceId,
        triggerCondition,
        {
          startImmediately: true,
          skipValidation: false
        }
      )

      // Log manual trigger
      await prisma.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: '', // Would get from sequence
          userId,
          type: 'MANUAL_SEQUENCE_TRIGGER',
          description: `Manual sequence trigger: ${reason || 'No reason specified'}`,
          metadata: {
            sequenceId,
            invoiceId,
            sequenceExecutionId: executionResult.sequenceExecutionId
          }
        }
      })

      return {
        triggered: executionResult.success,
        sequenceExecutionId: executionResult.sequenceExecutionId,
        reason: executionResult.success ? undefined : executionResult.errors.join(', ')
      }

    } catch (error) {
      return {
        triggered: false,
        reason: error instanceof Error ? error.message : 'Manual trigger failed'
      }
    }
  }

  /**
   * Handle payment received event
   */
  async handlePaymentReceived(invoiceId: string, paymentAmount: number): Promise<void> {
    try {
      // Stop any active sequences for this invoice
      const activeSequences = await prisma.followUpLog.findMany({
        where: { invoiceId },
        distinct: ['sequenceId'],
        include: { followUpSequence: true }
      })

      for (const log of activeSequences) {
        await sequenceExecutionService.stopSequenceExecution(
          log.sequenceId,
          invoiceId,
          `Payment received: ${paymentAmount}`
        )
      }

      // Log payment event
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
      if (invoice) {
        await this.logTriggerEvent({
          companyId: invoice.companyId,
          sequenceId: '',
          invoiceId,
          triggerType: 'PAYMENT_RECEIVED',
          success: true
        })
      }

    } catch (error) {
      console.error('Error handling payment received:', error)
    }
  }

  /**
   * Handle invoice status change
   */
  async handleInvoiceStatusChange(
    invoiceId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    
    try {
      // If invoice is paid or written off, stop sequences
      if (newStatus === 'PAID' || newStatus === 'WRITTEN_OFF') {
        const activeSequences = await prisma.followUpLog.findMany({
          where: { invoiceId },
          distinct: ['sequenceId']
        })

        for (const log of activeSequences) {
          await sequenceExecutionService.stopSequenceExecution(
            log.sequenceId,
            invoiceId,
            `Invoice status changed to ${newStatus}`
          )
        }
      }

      // If invoice becomes overdue, trigger overdue sequences
      if (newStatus === 'OVERDUE' && oldStatus !== 'OVERDUE') {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { company: true }
        })

        if (invoice) {
          // Find overdue sequences for this company
          const overdueSequences = await prisma.followUpSequence.findMany({
            where: {
              companyId: invoice.companyId,
              active: true,
              name: { contains: 'overdue', mode: 'insensitive' }
            }
          })

          for (const sequence of overdueSequences) {
            const triggerCondition: TriggerCondition = {
              type: 'INVOICE_STATUS',
              value: 'OVERDUE',
              operator: 'EQUALS'
            }

            await sequenceExecutionService.startSequenceExecution(
              sequence.id,
              invoiceId,
              triggerCondition
            )
          }
        }
      }

    } catch (error) {
      console.error('Error handling invoice status change:', error)
    }
  }

  /**
   * Get trigger monitoring metrics
   */
  async getMonitoringMetrics(companyId?: string): Promise<MonitoringMetrics> {
    try {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const whereClause: any = {}
      if (companyId) {
        whereClause.companyId = companyId
      }

      const [
        totalTriggers,
        activeTriggers,
        triggersLastHour,
        triggersLastDay,
        triggerEvents
      ] = await Promise.all([
        // Total trigger rules
        prisma.followUpSequence.count({
          where: { ...whereClause, active: true }
        }),

        // Active sequences (simplified)
        prisma.followUpLog.count({
          where: {
            ...whereClause,
            sentAt: {
              gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),

        // Triggers last hour (using activities as proxy)
        prisma.activity.count({
          where: {
            ...whereClause,
            type: 'SEQUENCE_TRIGGERED',
            createdAt: { gte: hourAgo }
          }
        }),

        // Triggers last day
        prisma.activity.count({
          where: {
            ...whereClause,
            type: 'SEQUENCE_TRIGGERED',
            createdAt: { gte: dayAgo }
          }
        }),

        // Recent trigger events for analysis
        prisma.activity.findMany({
          where: {
            ...whereClause,
            type: { in: ['SEQUENCE_TRIGGERED', 'MANUAL_SEQUENCE_TRIGGER'] },
            createdAt: { gte: dayAgo }
          },
          select: {
            metadata: true,
            createdAt: true
          }
        })
      ])

      // Calculate success rate
      const successfulTriggers = triggerEvents.filter(event => 
        event.metadata && (event.metadata as any).success
      ).length
      const successRate = triggerEvents.length > 0 ? 
        (successfulTriggers / triggerEvents.length) * 100 : 100

      // Get most common trigger types
      const triggerTypeCounts: Record<string, number> = {}
      triggerEvents.forEach(event => {
        if (event.metadata && (event.metadata as any).triggerType) {
          const triggerType = (event.metadata as any).triggerType
          triggerTypeCounts[triggerType] = (triggerTypeCounts[triggerType] || 0) + 1
        }
      })

      const mostCommonTriggers = Object.entries(triggerTypeCounts)
        .map(([type, count]) => ({ type: type as TriggerType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const failedTriggers = triggerEvents.length - successfulTriggers

      return {
        totalTriggers,
        activeTriggers,
        triggersLastHour,
        triggersLastDay,
        successRate: Math.round(successRate * 100) / 100,
        mostCommonTriggers,
        failedTriggers
      }

    } catch (error) {
      console.error('Error getting monitoring metrics:', error)
      return {
        totalTriggers: 0,
        activeTriggers: 0,
        triggersLastHour: 0,
        triggersLastDay: 0,
        successRate: 0,
        mostCommonTriggers: [],
        failedTriggers: 0
      }
    }
  }
}

// Export singleton instance
export const sequenceTriggersService = new SequenceTriggersService()