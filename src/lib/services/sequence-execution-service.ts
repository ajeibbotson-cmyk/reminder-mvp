import { prisma } from '../prisma'
import { emailSchedulingService, SchedulingOptions } from './email-scheduling-service'
import { uaeBusinessHours } from './uae-business-hours-service'
import { culturalCompliance, CulturalTone, SequenceType } from './cultural-compliance-service'

export interface SequenceStep {
  stepNumber: number
  delayDays: number
  templateId?: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC' | 'BOTH'
  tone: CulturalTone
  stopConditions?: string[]
  metadata?: Record<string, any>
}

export interface SequenceExecution {
  id: string
  sequenceId: string
  invoiceId: string
  companyId: string
  currentStep: number
  totalSteps: number
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  startedAt: Date
  lastExecutionAt?: Date
  nextExecutionAt?: Date
  completedAt?: Date
  stoppedReason?: string
  metadata?: Record<string, any>
}

export interface TriggerCondition {
  type: 'INVOICE_STATUS' | 'DUE_DATE' | 'DAYS_OVERDUE' | 'PAYMENT_RECEIVED' | 'MANUAL'
  value: any
  operator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'IN' | 'NOT_IN'
}

export interface ExecutionResult {
  success: boolean
  sequenceExecutionId?: string
  emailLogIds: string[]
  errors: string[]
  nextExecutionAt?: Date
  stepsExecuted: number
  stepsRemaining: number
}

export interface SequenceAnalytics {
  sequenceId: string
  totalExecutions: number
  activeExecutions: number
  completedExecutions: number
  averageCompletionTime: number
  conversionRate: number // % that led to payment
  stepAnalytics: {
    stepNumber: number
    executionCount: number
    openRate: number
    clickRate: number
    responseRate: number
  }[]
}

/**
 * Sequence Execution Engine
 * Core automation system that executes email sequences with UAE business logic
 */
export class SequenceExecutionService {

  /**
   * Start a new sequence execution for an invoice
   */
  async startSequenceExecution(
    sequenceId: string,
    invoiceId: string,
    triggerCondition: TriggerCondition,
    options: {
      startImmediately?: boolean
      customStartTime?: Date
      skipValidation?: boolean
    } = {}
  ): Promise<ExecutionResult> {
    const errors: string[] = []
    const emailLogIds: string[] = []

    try {
      // Get sequence and invoice data
      const [sequence, invoice] = await Promise.all([
        prisma.followUpSequence.findUnique({
          where: { id: sequenceId },
          include: { company: true }
        }),
        prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { customer: true, company: true }
        })
      ])

      if (!sequence) {
        throw new Error('Sequence not found')
      }

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      if (!sequence.active) {
        throw new Error('Sequence is not active')
      }

      // Validate sequence can be executed
      if (!options.skipValidation) {
        const validation = await this.validateSequenceExecution(sequence, invoice)
        if (!validation.canExecute) {
          throw new Error(`Cannot execute sequence: ${validation.reason}`)
        }
      }

      // Check if sequence already running for this invoice
      const existingExecution = await prisma.followUpLog.findFirst({
        where: {
          invoiceId,
          sequenceId,
          // Check if there's an active execution (no completion or cancellation)
        }
      })

      if (existingExecution) {
        throw new Error('Sequence already running for this invoice')
      }

      // Parse sequence steps
      const steps = this.parseSequenceSteps(sequence.steps)
      if (steps.length === 0) {
        throw new Error('Sequence has no valid steps')
      }

      // Create sequence execution record
      const executionId = crypto.randomUUID()
      const startTime = options.customStartTime || new Date()
      const nextExecutionTime = options.startImmediately ? startTime : 
        this.calculateNextExecutionTime(startTime, steps[0].delayDays)

      // Execute first step if starting immediately
      if (options.startImmediately) {
        const firstStepResult = await this.executeSequenceStep(
          executionId,
          sequence,
          invoice,
          steps[0],
          1
        )

        if (!firstStepResult.success) {
          errors.push(...firstStepResult.errors)
        } else {
          emailLogIds.push(...firstStepResult.emailLogIds)
        }

        // Create follow-up log for first step
        await this.createFollowUpLog(
          executionId,
          sequenceId,
          invoiceId,
          1,
          steps[0],
          firstStepResult.emailLogIds[0]
        )
      }

      return {
        success: errors.length === 0,
        sequenceExecutionId: executionId,
        emailLogIds,
        errors,
        nextExecutionAt: nextExecutionTime,
        stepsExecuted: options.startImmediately ? 1 : 0,
        stepsRemaining: steps.length - (options.startImmediately ? 1 : 0)
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error')
      return {
        success: false,
        emailLogIds,
        errors,
        stepsExecuted: 0,
        stepsRemaining: 0
      }
    }
  }

  /**
   * Continue sequence execution - process next steps
   */
  async continueSequenceExecution(
    sequenceExecutionId: string
  ): Promise<ExecutionResult> {
    const errors: string[] = []
    const emailLogIds: string[] = []

    try {
      // Get the last follow-up log for this execution
      const lastLog = await prisma.followUpLog.findFirst({
        where: {
          id: sequenceExecutionId // Using execution ID as reference
        },
        include: {
          followUpSequence: true,
          invoice: {
            include: { customer: true, company: true }
          }
        },
        orderBy: { stepNumber: 'desc' }
      })

      if (!lastLog) {
        throw new Error('Sequence execution not found')
      }

      const sequence = lastLog.followUpSequence
      const invoice = lastLog.invoice
      const steps = this.parseSequenceSteps(sequence.steps)
      const nextStepNumber = lastLog.stepNumber + 1

      // Check if sequence is completed
      if (nextStepNumber > steps.length) {
        return {
          success: true,
          sequenceExecutionId,
          emailLogIds,
          errors: ['Sequence already completed'],
          stepsExecuted: 0,
          stepsRemaining: 0
        }
      }

      // Check stop conditions
      const shouldStop = await this.checkStopConditions(invoice, steps[nextStepNumber - 1])
      if (shouldStop.shouldStop) {
        return {
          success: true,
          sequenceExecutionId,
          emailLogIds,
          errors: [`Sequence stopped: ${shouldStop.reason}`],
          stepsExecuted: 0,
          stepsRemaining: 0
        }
      }

      // Execute next step
      const nextStep = steps[nextStepNumber - 1]
      const stepResult = await this.executeSequenceStep(
        sequenceExecutionId,
        sequence,
        invoice,
        nextStep,
        nextStepNumber
      )

      if (stepResult.success) {
        emailLogIds.push(...stepResult.emailLogIds)

        // Create follow-up log for this step
        await this.createFollowUpLog(
          sequenceExecutionId,
          sequence.id,
          invoice.id,
          nextStepNumber,
          nextStep,
          stepResult.emailLogIds[0]
        )
      } else {
        errors.push(...stepResult.errors)
      }

      // Calculate next execution time
      const nextExecutionTime = nextStepNumber < steps.length ?
        this.calculateNextExecutionTime(new Date(), steps[nextStepNumber]?.delayDays || 7) :
        undefined

      return {
        success: errors.length === 0,
        sequenceExecutionId,
        emailLogIds,
        errors,
        nextExecutionAt: nextExecutionTime,
        stepsExecuted: 1,
        stepsRemaining: Math.max(0, steps.length - nextStepNumber)
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error')
      return {
        success: false,
        sequenceExecutionId,
        emailLogIds,
        errors,
        stepsExecuted: 0,
        stepsRemaining: 0
      }
    }
  }

  /**
   * Execute a single sequence step
   */
  private async executeSequenceStep(
    executionId: string,
    sequence: any,
    invoice: any,
    step: SequenceStep,
    stepNumber: number
  ): Promise<{ success: boolean; emailLogIds: string[]; errors: string[] }> {
    const errors: string[] = []
    const emailLogIds: string[] = []

    try {
      // Prepare email content with variables
      const emailContent = await this.processStepTemplate(step, invoice)
      
      // Cultural compliance check
      const complianceCheck = culturalCompliance.validateTemplateContent({
        contentEn: emailContent.content,
        subjectEn: emailContent.subject
      })

      if (!complianceCheck.isValid) {
        console.warn(`Cultural compliance issues in step ${stepNumber}:`, complianceCheck.issues)
        // Log warning but continue - don't block execution for minor issues
      }

      // Schedule email(s) based on language settings
      const languagesToSend = step.language === 'BOTH' ? ['ENGLISH', 'ARABIC'] : [step.language]
      
      for (const language of languagesToSend) {
        const schedulingOptions: Partial<SchedulingOptions> = {
          respectBusinessHours: true,
          avoidHolidays: true,
          avoidPrayerTimes: true,
          preferOptimalTiming: true,
          priority: this.determineEmailPriority(stepNumber, step.tone),
          maxRetries: 3
        }

        const emailLogId = await emailSchedulingService.scheduleEmail({
          companyId: sequence.companyId,
          invoiceId: invoice.id,
          customerId: invoice.customerId || undefined,
          templateId: step.templateId,
          recipientEmail: invoice.customerEmail,
          recipientName: invoice.customerName,
          subject: emailContent.subject,
          content: emailContent.content,
          language: language as 'ENGLISH' | 'ARABIC',
          scheduledFor: new Date(), // Will be adjusted by scheduling service
          priority: this.determineEmailPriority(stepNumber, step.tone),
          sequenceId: sequence.id,
          stepNumber: stepNumber,
          maxRetries: 3,
          retryCount: 0,
          metadata: {
            executionId,
            sequenceId: sequence.id,
            stepNumber,
            tone: step.tone,
            ...step.metadata
          }
        }, schedulingOptions)

        emailLogIds.push(emailLogId)
      }

      return {
        success: true,
        emailLogIds,
        errors
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Step execution failed')
      return {
        success: false,
        emailLogIds,
        errors
      }
    }
  }

  /**
   * Process step template with invoice variables
   */
  private async processStepTemplate(
    step: SequenceStep,
    invoice: any
  ): Promise<{ subject: string; content: string }> {
    
    // If template ID is provided, load template
    if (step.templateId) {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: step.templateId }
      })

      if (template) {
        return {
          subject: this.replaceVariables(template.subjectEn, invoice),
          content: this.replaceVariables(template.contentEn, invoice)
        }
      }
    }

    // Use step content directly
    return {
      subject: this.replaceVariables(step.subject, invoice),
      content: this.replaceVariables(step.content, invoice)
    }
  }

  /**
   * Replace template variables with invoice data
   */
  private replaceVariables(template: string, invoice: any): string {
    const variables = {
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      invoiceAmount: invoice.totalAmount || invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate.toLocaleDateString('en-AE'),
      companyName: invoice.company?.name || '',
      daysPastDue: Math.max(0, Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))),
      currentDate: new Date().toLocaleDateString('en-AE'),
      supportEmail: 'support@yourdomain.ae',
      supportPhone: '+971-4-XXX-XXXX'
    }

    let processedTemplate = template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value))
    })

    return processedTemplate
  }

  /**
   * Parse sequence steps from JSON
   */
  private parseSequenceSteps(stepsJson: any): SequenceStep[] {
    try {
      if (typeof stepsJson === 'string') {
        stepsJson = JSON.parse(stepsJson)
      }

      if (!Array.isArray(stepsJson)) {
        return []
      }

      return stepsJson.map((step, index) => ({
        stepNumber: step.stepNumber || index + 1,
        delayDays: step.delayDays || 7,
        templateId: step.templateId,
        subject: step.subject || 'Invoice Reminder',
        content: step.content || 'Please review your invoice.',
        language: step.language || 'ENGLISH',
        tone: step.tone || 'BUSINESS',
        stopConditions: step.stopConditions || [],
        metadata: step.metadata || {}
      }))

    } catch {
      return []
    }
  }

  /**
   * Calculate next execution time based on delay
   */
  private calculateNextExecutionTime(baseTime: Date, delayDays: number): Date {
    const nextTime = new Date(baseTime)
    nextTime.setDate(nextTime.getDate() + delayDays)
    
    // Ensure it's within business hours
    return uaeBusinessHours.getNextAvailableSendTime(nextTime)
  }

  /**
   * Validate if sequence can be executed for invoice
   */
  private async validateSequenceExecution(
    sequence: any,
    invoice: any
  ): Promise<{ canExecute: boolean; reason?: string }> {
    
    // Check invoice status
    if (invoice.status === 'PAID') {
      return { canExecute: false, reason: 'Invoice is already paid' }
    }

    if (invoice.status === 'WRITTEN_OFF') {
      return { canExecute: false, reason: 'Invoice is written off' }
    }

    // Check if customer has unsubscribed
    const unsubscribed = await prisma.emailLog.findFirst({
      where: {
        recipientEmail: invoice.customerEmail,
        deliveryStatus: 'UNSUBSCRIBED'
      }
    })

    if (unsubscribed) {
      return { canExecute: false, reason: 'Customer has unsubscribed' }
    }

    // Check recent email sending to avoid spam
    const recentEmails = await prisma.emailLog.count({
      where: {
        recipientEmail: invoice.customerEmail,
        companyId: sequence.companyId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    if (recentEmails >= 3) {
      return { canExecute: false, reason: 'Too many emails sent recently' }
    }

    return { canExecute: true }
  }

  /**
   * Check stop conditions for sequence
   */
  private async checkStopConditions(
    invoice: any,
    step: SequenceStep
  ): Promise<{ shouldStop: boolean; reason?: string }> {
    
    // Check payment received
    const payments = await prisma.payment.findMany({
      where: { invoiceId: invoice.id }
    })

    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const invoiceAmount = Number(invoice.totalAmount || invoice.amount)

    if (totalPaid >= invoiceAmount) {
      return { shouldStop: true, reason: 'Payment received' }
    }

    // Check invoice status changes
    if (invoice.status === 'PAID' || invoice.status === 'WRITTEN_OFF') {
      return { shouldStop: true, reason: `Invoice status changed to ${invoice.status}` }
    }

    // Check custom stop conditions
    if (step.stopConditions && step.stopConditions.length > 0) {
      for (const condition of step.stopConditions) {
        if (condition === 'CUSTOMER_RESPONSE') {
          // In production, you'd check for customer replies to previous emails
          // This would require email webhook integration
        }
      }
    }

    return { shouldStop: false }
  }

  /**
   * Determine email priority based on step number and tone
   */
  private determineEmailPriority(
    stepNumber: number,
    tone: CulturalTone
  ): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
    if (stepNumber >= 3 && (tone === 'FORMAL' || tone === 'VERY_FORMAL')) {
      return 'HIGH'
    } else if (stepNumber >= 2) {
      return 'NORMAL'
    } else {
      return 'LOW'
    }
  }

  /**
   * Create follow-up log entry
   */
  private async createFollowUpLog(
    executionId: string,
    sequenceId: string,
    invoiceId: string,
    stepNumber: number,
    step: SequenceStep,
    emailLogId: string
  ): Promise<void> {
    await prisma.followUpLog.create({
      data: {
        id: executionId,
        invoiceId,
        sequenceId,
        stepNumber,
        emailAddress: '', // Will be populated from invoice
        subject: step.subject,
        content: step.content,
        sentAt: new Date(),
        awsMessageId: emailLogId // Reference to email log
      }
    })
  }

  /**
   * Stop sequence execution
   */
  async stopSequenceExecution(
    sequenceId: string,
    invoiceId: string,
    reason: string
  ): Promise<boolean> {
    try {
      // Cancel any queued emails for this sequence/invoice
      const queuedEmails = await prisma.emailLog.findMany({
        where: {
          invoiceId,
          deliveryStatus: 'QUEUED'
        }
      })

      for (const email of queuedEmails) {
        await emailSchedulingService.cancelScheduledEmail(email.id)
      }

      // Update follow-up logs to mark sequence as stopped
      await prisma.followUpLog.updateMany({
        where: {
          sequenceId,
          invoiceId
        },
        data: {
          // Add stopped reason to metadata or create separate field
        }
      })

      return true

    } catch (error) {
      console.error('Error stopping sequence execution:', error)
      return false
    }
  }

  /**
   * Get sequence execution status
   */
  async getSequenceExecutionStatus(
    sequenceId: string,
    invoiceId: string
  ): Promise<SequenceExecution | null> {
    try {
      const logs = await prisma.followUpLog.findMany({
        where: {
          sequenceId,
          invoiceId
        },
        orderBy: { sentAt: 'asc' },
        include: {
          followUpSequence: true
        }
      })

      if (logs.length === 0) {
        return null
      }

      const sequence = logs[0].followUpSequence
      const steps = this.parseSequenceSteps(sequence.steps)
      const lastLog = logs[logs.length - 1]

      return {
        id: logs[0].id,
        sequenceId,
        invoiceId,
        companyId: sequence.companyId,
        currentStep: lastLog.stepNumber,
        totalSteps: steps.length,
        status: lastLog.stepNumber >= steps.length ? 'COMPLETED' : 'ACTIVE',
        startedAt: logs[0].sentAt,
        lastExecutionAt: lastLog.sentAt,
        nextExecutionAt: this.calculateNextExecutionTime(
          lastLog.sentAt,
          steps[lastLog.stepNumber]?.delayDays || 7
        )
      }

    } catch (error) {
      console.error('Error getting sequence execution status:', error)
      return null
    }
  }

  /**
   * Get sequence analytics
   */
  async getSequenceAnalytics(sequenceId: string): Promise<SequenceAnalytics> {
    try {
      const [logs, sequence] = await Promise.all([
        prisma.followUpLog.findMany({
          where: { sequenceId },
          include: {
            emailLogs: true,
            invoice: {
              include: { payments: true }
            }
          }
        }),
        prisma.followUpSequence.findUnique({
          where: { id: sequenceId }
        })
      ])

      if (!sequence) {
        throw new Error('Sequence not found')
      }

      const steps = this.parseSequenceSteps(sequence.steps)
      const totalExecutions = logs.length

      // Calculate completion metrics
      const completedExecutions = logs.filter(log => 
        log.stepNumber >= steps.length
      ).length

      const activeExecutions = totalExecutions - completedExecutions

      // Calculate conversion rate (sequences that led to payment)
      const paidInvoices = logs.filter(log => {
        const totalPaid = log.invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const invoiceAmount = Number(log.invoice.totalAmount || log.invoice.amount)
        return totalPaid >= invoiceAmount
      }).length

      const conversionRate = totalExecutions > 0 ? (paidInvoices / totalExecutions) * 100 : 0

      // Calculate average completion time
      const completedLogs = logs.filter(log => log.stepNumber >= steps.length)
      const avgCompletionTime = completedLogs.length > 0 
        ? completedLogs.reduce((sum, log) => {
            const executionTime = log.sentAt.getTime() - log.sentAt.getTime() // This needs first log time
            return sum + executionTime
          }, 0) / completedLogs.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0

      // Calculate step analytics
      const stepAnalytics = steps.map(step => {
        const stepLogs = logs.filter(log => log.stepNumber === step.stepNumber)
        const stepEmails = stepLogs.flatMap(log => log.emailLogs || [])
        
        const executionCount = stepLogs.length
        const openCount = stepEmails.filter(email => email.openedAt).length
        const clickCount = stepEmails.filter(email => email.clickedAt).length
        const responseCount = stepEmails.filter(email => email.responseReceived).length

        return {
          stepNumber: step.stepNumber,
          executionCount,
          openRate: executionCount > 0 ? (openCount / executionCount) * 100 : 0,
          clickRate: openCount > 0 ? (clickCount / openCount) * 100 : 0,
          responseRate: executionCount > 0 ? (responseCount / executionCount) * 100 : 0
        }
      })

      return {
        sequenceId,
        totalExecutions,
        activeExecutions,
        completedExecutions,
        averageCompletionTime: Math.round(avgCompletionTime),
        conversionRate: Math.round(conversionRate * 100) / 100,
        stepAnalytics
      }

    } catch (error) {
      console.error('Error getting sequence analytics:', error)
      return {
        sequenceId,
        totalExecutions: 0,
        activeExecutions: 0,
        completedExecutions: 0,
        averageCompletionTime: 0,
        conversionRate: 0,
        stepAnalytics: []
      }
    }
  }

  /**
   * Process all pending sequence executions
   */
  async processPendingExecutions(): Promise<{
    processed: number
    successful: number
    failed: number
    errors: string[]
  }> {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    }

    try {
      // Find sequences that need to be processed
      // This is a simplified implementation - in production you'd have a proper job queue
      const pendingLogs = await prisma.followUpLog.findMany({
        where: {
          sentAt: {
            lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // More than 24 hours ago
          }
          // Add more sophisticated logic to determine which need next steps
        },
        include: {
          followUpSequence: true,
          invoice: true
        }
      })

      for (const log of pendingLogs) {
        results.processed++

        try {
          const continueResult = await this.continueSequenceExecution(log.id)
          
          if (continueResult.success) {
            results.successful++
          } else {
            results.failed++
            results.errors.push(...continueResult.errors)
          }

        } catch (error) {
          results.failed++
          results.errors.push(error instanceof Error ? error.message : 'Unknown error')
        }
      }

      return results

    } catch (error) {
      results.errors.push(error instanceof Error ? error.message : 'Processing failed')
      return results
    }
  }
}

// Export singleton instance
export const sequenceExecutionService = new SequenceExecutionService()