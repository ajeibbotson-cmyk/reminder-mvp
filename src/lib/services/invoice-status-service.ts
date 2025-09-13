/**
 * Invoice Status Management Service
 * Comprehensive status management system for UAE Payment Collection Platform
 * 
 * Features:
 * - Status transition validation
 * - Automated overdue detection
 * - UAE business rule enforcement
 * - Audit trail creation
 * - Batch processing capabilities
 */

import { InvoiceStatus, UserRole, Prisma } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { DEFAULT_UAE_BUSINESS_HOURS } from '@/types/invoice'

// Status transition rules for UAE business compliance
export const STATUS_TRANSITION_RULES: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.WRITTEN_OFF],
  [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED, InvoiceStatus.WRITTEN_OFF],
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.DISPUTED, InvoiceStatus.WRITTEN_OFF],
  [InvoiceStatus.PAID]: [InvoiceStatus.DISPUTED], // Allow disputes even after payment
  [InvoiceStatus.DISPUTED]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.SENT, InvoiceStatus.WRITTEN_OFF],
  [InvoiceStatus.WRITTEN_OFF]: [] // Terminal status
}

// UAE business validation rules
export interface UAEBusinessValidation {
  isValid: boolean
  reason?: string
  complianceNote?: string
  requiresApproval?: boolean
  approvalLevel?: UserRole
}

// Status change result interface
export interface StatusChangeResult {
  success: boolean
  oldStatus: InvoiceStatus
  newStatus: InvoiceStatus
  reason: string
  requiresNotification: boolean
  auditTrail: StatusChangeAuditEntry
  validationWarnings?: string[]
  businessRuleNotes?: string[]
}

// Audit trail entry for status changes
export interface StatusChangeAuditEntry {
  invoiceId: string
  invoiceNumber: string
  companyId: string
  userId: string
  userRole: UserRole
  oldStatus: InvoiceStatus
  newStatus: InvoiceStatus
  reason: string
  notes?: string
  businessContext: {
    isOverdue: boolean
    daysPastDue: number
    hasPayments: boolean
    totalPaid: number
    remainingAmount: number
    customerEmail: string
    dueDate: Date
  }
  metadata: {
    userAgent?: string
    ipAddress?: string
    apiEndpoint?: string
    automatedChange: boolean
    batchOperation: boolean
    complianceFlags: string[]
  }
  timestamp: Date
}

// Batch operation result
export interface BatchStatusChangeResult {
  totalRequested: number
  successCount: number
  failedCount: number
  skippedCount: number
  results: Array<{
    invoiceId: string
    invoiceNumber: string
    success: boolean
    oldStatus?: InvoiceStatus
    newStatus?: InvoiceStatus
    error?: string
    reason?: string
  }>
  auditEntries: StatusChangeAuditEntry[]
  businessSummary: {
    totalAmountAffected: number
    paidAmountAffected: number
    overdueAmountAffected: number
    formattedTotalAmount: string
  }
}

// Overdue detection configuration
export interface OverdueDetectionConfig {
  gracePeriodDays: number
  respectBusinessHours: boolean
  respectHolidays: boolean
  batchSize: number
  enableNotifications: boolean
  dryRun: boolean
}

/**
 * Invoice Status Management Service
 * Handles all status-related operations with UAE business compliance
 */
export class InvoiceStatusService {
  private readonly defaultOverdueConfig: OverdueDetectionConfig = {
    gracePeriodDays: 0, // No grace period for overdue detection
    respectBusinessHours: true,
    respectHolidays: true,
    batchSize: 100,
    enableNotifications: true,
    dryRun: false
  }

  /**
   * Validate if a status transition is allowed according to UAE business rules
   */
  public validateStatusTransition(
    currentStatus: InvoiceStatus,
    newStatus: InvoiceStatus,
    context: {
      invoice: any
      user: { role: UserRole; companyId: string }
      reason?: string
      forceOverride?: boolean
    }
  ): UAEBusinessValidation {
    // Check basic transition rules
    const allowedTransitions = STATUS_TRANSITION_RULES[currentStatus]
    if (!allowedTransitions.includes(newStatus)) {
      return {
        isValid: false,
        reason: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`
      }
    }

    // UAE-specific business validations
    const validation = this.validateUAEBusinessRules(currentStatus, newStatus, context)
    if (!validation.isValid) {
      return validation
    }

    // Role-based permissions
    const roleValidation = this.validateRolePermissions(newStatus, context.user.role, context.forceOverride)
    if (!roleValidation.isValid) {
      return roleValidation
    }

    return { isValid: true, complianceNote: 'Status transition approved under UAE business rules' }
  }

  /**
   * Update invoice status with comprehensive validation and audit trail
   */
  public async updateInvoiceStatus(
    invoiceId: string,
    newStatus: InvoiceStatus,
    context: {
      userId: string
      userRole: UserRole
      companyId: string
      reason?: string
      notes?: string
      notifyCustomer?: boolean
      userAgent?: string
      ipAddress?: string
      forceOverride?: boolean
    }
  ): Promise<StatusChangeResult> {
    return await prisma.$transaction(async (tx) => {
      // Fetch invoice with related data
      const invoice = await tx.invoices.findUnique({
        where: { id: invoiceId },
        include: {
          payments: { select: { amount: true, paymentDate: true } },
          customers: { select: { email: true, name: true } },
          companies: { select: { id: true, name: true } }
        }
      })

      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`)
      }

      // Enforce company isolation
      if (invoice.companyId !== context.companyId) {
        throw new Error('Access denied: Invoice belongs to different company')
      }

      // Validate transition
      const validation = this.validateStatusTransition(invoice.status, newStatus, {
        invoice,
        user: { role: context.userRole, companyId: context.companyId },
        reason: context.reason,
        forceOverride: context.forceOverride
      })

      if (!validation.isValid) {
        throw new Error(validation.reason || 'Status transition not allowed')
      }

      // Calculate business context
      const businessContext = this.calculateBusinessContext(invoice)

      // Handle automatic status transitions based on UAE business logic
      const finalStatus = this.determineActualStatus(invoice, newStatus, businessContext)

      // Update invoice status
      const updatedInvoice = await tx.invoices.update({
        where: { id: invoiceId },
        data: { 
          status: finalStatus,
          updatedAt: new Date()
        }
      })

      // Create audit trail entry
      const auditEntry: StatusChangeAuditEntry = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        companyId: context.companyId,
        userId: context.userId,
        userRole: context.userRole,
        oldStatus: invoice.status,
        newStatus: finalStatus,
        reason: context.reason || this.getDefaultStatusChangeReason(invoice.status, finalStatus),
        notes: context.notes,
        businessContext,
        metadata: {
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          automatedChange: false,
          batchOperation: false,
          complianceFlags: this.generateComplianceFlags(invoice, finalStatus, validation)
        },
        timestamp: new Date()
      }

      // Log activity for audit trail
      await this.createAuditTrailEntry(tx, auditEntry)

      // Handle customer notification if requested
      if (context.notifyCustomer && finalStatus !== invoice.status) {
        await this.scheduleCustomerNotification(tx, invoice, invoice.status, finalStatus, context.companyId)
      }

      return {
        success: true,
        oldStatus: invoice.status,
        newStatus: finalStatus,
        reason: auditEntry.reason,
        requiresNotification: context.notifyCustomer || false,
        auditTrail: auditEntry,
        validationWarnings: validation.requiresApproval ? [`Status change requires ${validation.approvalLevel} approval`] : undefined,
        businessRuleNotes: validation.complianceNote ? [validation.complianceNote] : undefined
      }
    })
  }

  /**
   * Detect and update overdue invoices in batch
   */
  public async detectAndUpdateOverdueInvoices(
    companyId?: string,
    config: Partial<OverdueDetectionConfig> = {}
  ): Promise<BatchStatusChangeResult> {
    const finalConfig = { ...this.defaultOverdueConfig, ...config }

    // Check if we should process during UAE business hours
    if (finalConfig.respectBusinessHours && !this.isUAEBusinessHours()) {
      throw new Error('Overdue detection can only run during UAE business hours (Sunday-Thursday, 8 AM-6 PM GST)')
    }

    const results: BatchStatusChangeResult = {
      totalRequested: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      results: [],
      auditEntries: [],
      businessSummary: {
        totalAmountAffected: 0,
        paidAmountAffected: 0,
        overdueAmountAffected: 0,
        formattedTotalAmount: ''
      }
    }

    // Find invoices that should be marked as overdue
    const overdueInvoices = await this.findOverdueInvoices(companyId, finalConfig)
    results.totalRequested = overdueInvoices.length

    if (finalConfig.dryRun) {
      console.log(`DRY RUN: Would update ${overdueInvoices.length} invoices to OVERDUE status`)
      return results
    }

    // Process in batches
    for (let i = 0; i < overdueInvoices.length; i += finalConfig.batchSize) {
      const batch = overdueInvoices.slice(i, i + finalConfig.batchSize)
      const batchResults = await this.processBatchStatusUpdate(batch, InvoiceStatus.OVERDUE, {
        reason: 'Automated overdue detection - past due date',
        automatedChange: true,
        enableNotifications: finalConfig.enableNotifications
      })

      // Aggregate results
      results.successCount += batchResults.successCount
      results.failedCount += batchResults.failedCount
      results.skippedCount += batchResults.skippedCount
      results.results.push(...batchResults.results)
      results.auditEntries.push(...batchResults.auditEntries)

      // Update business summary
      batchResults.auditEntries.forEach(entry => {
        results.businessSummary.totalAmountAffected += entry.businessContext.remainingAmount
        results.businessSummary.paidAmountAffected += entry.businessContext.totalPaid
        if (entry.newStatus === InvoiceStatus.OVERDUE) {
          results.businessSummary.overdueAmountAffected += entry.businessContext.remainingAmount
        }
      })
    }

    // Format final amounts
    results.businessSummary.formattedTotalAmount = formatUAECurrency(
      new Decimal(results.businessSummary.totalAmountAffected),
      'AED'
    )

    return results
  }

  /**
   * Bulk update invoice statuses with comprehensive validation
   */
  public async bulkUpdateInvoiceStatus(
    invoiceIds: string[],
    newStatus: InvoiceStatus,
    context: {
      companyId: string
      userId: string
      userRole: UserRole
      reason?: string
      forceOverride?: boolean
      enableNotifications?: boolean
    }
  ): Promise<BatchStatusChangeResult> {
    // Fetch all invoices with validation
    const invoices = await prisma.invoices.findMany({
      where: {
        id: { in: invoiceIds },
        companyId: context.companyId // Enforce company isolation
      },
      include: {
        payments: { select: { amount: true, paymentDate: true } },
        customers: { select: { email: true, name: true } }
      }
    })

    if (invoices.length !== invoiceIds.length) {
      throw new Error('Some invoices not found or access denied')
    }

    return await this.processBatchStatusUpdate(invoices, newStatus, {
      reason: context.reason || `Bulk status update to ${newStatus}`,
      automatedChange: false,
      userId: context.userId,
      userRole: context.userRole,
      companyId: context.companyId,
      forceOverride: context.forceOverride,
      enableNotifications: context.enableNotifications || false
    })
  }

  /**
   * Get invoice status insights and analytics
   */
  public async getStatusInsights(companyId: string): Promise<{
    statusCounts: Record<InvoiceStatus, number>
    overdueAnalysis: {
      totalOverdue: number
      averageDaysOverdue: number
      totalOverdueAmount: number
      formattedOverdueAmount: string
    }
    recentStatusChanges: Array<{
      invoiceNumber: string
      oldStatus: InvoiceStatus
      newStatus: InvoiceStatus
      changedAt: Date
      changedBy: string
      reason: string
    }>
  }> {
    // Get status counts
    const statusCounts = await this.getStatusCounts(companyId)

    // Get overdue analysis
    const overdueAnalysis = await this.getOverdueAnalysis(companyId)

    // Get recent status changes from audit trail
    const recentChanges = await prisma.activities.findMany({
      where: {
        companyId,
        type: 'invoice_status_updated',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { users: { select: { name: true } } }
    })

    const recentStatusChanges = recentChanges.map(activity => ({
      invoiceNumber: activity.metadata.invoiceNumber as string,
      oldStatus: activity.metadata.previousStatus as InvoiceStatus,
      newStatus: activity.metadata.newStatus as InvoiceStatus,
      changedAt: activity.createdAt,
      changedBy: activity.users?.name || 'System',
      reason: activity.metadata.reason as string
    }))

    return {
      statusCounts,
      overdueAnalysis,
      recentStatusChanges
    }
  }

  // Private helper methods

  private validateUAEBusinessRules(
    currentStatus: InvoiceStatus,
    newStatus: InvoiceStatus,
    context: { invoice: any; reason?: string }
  ): UAEBusinessValidation {
    const { invoice } = context

    // Payment validation for PAID status
    if (newStatus === InvoiceStatus.PAID) {
      const totalPaid = invoice.payments.reduce(
        (sum: Decimal, payment: any) => sum.plus(payment.amount),
        new Decimal(0)
      )
      const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)

      if (totalPaid.lessThan(totalAmount.times(0.99))) { // 1% tolerance for rounding
        return {
          isValid: false,
          reason: `Cannot mark as PAID. Payments (${formatUAECurrency(totalPaid, invoice.currency)}) insufficient for amount (${formatUAECurrency(totalAmount, invoice.currency)})`
        }
      }
    }

    // Reason requirements for certain transitions
    if ([InvoiceStatus.WRITTEN_OFF, InvoiceStatus.DISPUTED].includes(newStatus) && !context.reason) {
      return {
        isValid: false,
        reason: `${newStatus} status requires a reason for UAE audit compliance`
      }
    }

    // Cannot transition from terminal states without approval
    if (currentStatus === InvoiceStatus.WRITTEN_OFF) {
      return {
        isValid: false,
        reason: 'Cannot change status from WRITTEN_OFF - terminal state',
        requiresApproval: true,
        approvalLevel: UserRole.ADMIN
      }
    }

    return { isValid: true }
  }

  private validateRolePermissions(
    newStatus: InvoiceStatus,
    userRole: UserRole,
    forceOverride?: boolean
  ): UAEBusinessValidation {
    // Admin and Finance can change any status
    if ([UserRole.ADMIN, UserRole.FINANCE].includes(userRole)) {
      return { isValid: true }
    }

    // Sensitive status changes require higher permissions
    if ([InvoiceStatus.WRITTEN_OFF, InvoiceStatus.DISPUTED].includes(newStatus)) {
      if (!forceOverride) {
        return {
          isValid: false,
          reason: `${newStatus} status requires ADMIN or FINANCE role`,
          requiresApproval: true,
          approvalLevel: UserRole.FINANCE
        }
      }
    }

    return { isValid: true }
  }

  private calculateBusinessContext(invoice: any) {
    const totalPaid = invoice.payments.reduce(
      (sum: Decimal, payment: any) => sum.plus(payment.amount),
      new Decimal(0)
    )
    const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)
    const remainingAmount = totalAmount.minus(totalPaid)
    const isOverdue = invoice.dueDate < new Date() && 
      ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)
    const daysPastDue = isOverdue ? 
      Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

    return {
      isOverdue,
      daysPastDue,
      hasPayments: invoice.payments.length > 0,
      totalPaid: totalPaid.toNumber(),
      remainingAmount: remainingAmount.toNumber(),
      customerEmail: invoice.customers?.email || invoice.customerEmail,
      dueDate: invoice.dueDate
    }
  }

  private determineActualStatus(
    invoice: any,
    requestedStatus: InvoiceStatus,
    businessContext: any
  ): InvoiceStatus {
    // Auto-transition to OVERDUE if past due date and not paid/written off
    if (businessContext.isOverdue && 
        [InvoiceStatus.SENT].includes(invoice.status) &&
        ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF, InvoiceStatus.DISPUTED].includes(requestedStatus)) {
      return InvoiceStatus.OVERDUE
    }

    // Auto-validate payment status for PAID requests
    if (requestedStatus === InvoiceStatus.PAID) {
      const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)
      const totalPaid = new Decimal(businessContext.totalPaid)
      
      if (totalPaid.greaterThanOrEqualTo(totalAmount.times(0.99))) {
        return InvoiceStatus.PAID
      } else {
        // Insufficient payment, return to previous status
        return invoice.status
      }
    }

    return requestedStatus
  }

  private generateComplianceFlags(
    invoice: any,
    newStatus: InvoiceStatus,
    validation: UAEBusinessValidation
  ): string[] {
    const flags: string[] = []

    if (validation.requiresApproval) {
      flags.push(`REQUIRES_${validation.approvalLevel}_APPROVAL`)
    }

    if (newStatus === InvoiceStatus.WRITTEN_OFF) {
      flags.push('TAX_DEDUCTION_ELIGIBLE')
    }

    if (invoice.trnNumber) {
      flags.push('TRN_COMPLIANT')
    }

    const businessContext = this.calculateBusinessContext(invoice)
    if (businessContext.isOverdue) {
      flags.push('OVERDUE_STATUS')
    }

    return flags
  }

  private getDefaultStatusChangeReason(from: InvoiceStatus, to: InvoiceStatus): string {
    const reasons: Record<string, string> = {
      'DRAFT->SENT': 'Invoice sent to customer',
      'SENT->PAID': 'Payment received and confirmed',
      'SENT->OVERDUE': 'Invoice past due date - automated detection',
      'OVERDUE->PAID': 'Late payment received and processed',
      'SENT->DISPUTED': 'Customer disputed invoice terms',
      'OVERDUE->DISPUTED': 'Overdue invoice disputed by customer',
      'DISPUTED->PAID': 'Dispute resolved - payment received',
      'DISPUTED->SENT': 'Dispute resolved - invoice reactivated',
      'SENT->WRITTEN_OFF': 'Invoice written off as uncollectable',
      'OVERDUE->WRITTEN_OFF': 'Overdue invoice written off',
      'DISPUTED->WRITTEN_OFF': 'Disputed invoice written off'
    }

    return reasons[`${from}->${to}`] || `Status changed from ${from} to ${to}`
  }

  private async createAuditTrailEntry(tx: any, auditEntry: StatusChangeAuditEntry) {
    await tx.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: auditEntry.companyId,
        userId: auditEntry.userId,
        type: 'invoice_status_updated',
        description: `Changed invoice ${auditEntry.invoiceNumber} status from ${auditEntry.oldStatus} to ${auditEntry.newStatus}`,
        metadata: {
          invoiceId: auditEntry.invoiceId,
          invoiceNumber: auditEntry.invoiceNumber,
          previousStatus: auditEntry.oldStatus,
          newStatus: auditEntry.newStatus,
          reason: auditEntry.reason,
          notes: auditEntry.notes,
          businessContext: auditEntry.businessContext,
          ...auditEntry.metadata
        }
      }
    })
  }

  private async scheduleCustomerNotification(
    tx: any,
    invoice: any,
    fromStatus: InvoiceStatus,
    toStatus: InvoiceStatus,
    companyId: string
  ) {
    // Only send notifications for meaningful status changes
    const notifiableTransitions = [
      'DRAFT->SENT',
      'SENT->OVERDUE',
      'OVERDUE->PAID',
      'SENT->PAID'
    ]

    if (notifiableTransitions.includes(`${fromStatus}->${toStatus}`)) {
      await tx.emailLogs.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          invoiceId: invoice.id,
          customerId: invoice.customers?.id,
          recipientEmail: invoice.customerEmail,
          recipientName: invoice.customerName,
          subject: this.getNotificationSubject(invoice.number, fromStatus, toStatus),
          content: `Status update notification for invoice ${invoice.number}`,
          deliveryStatus: 'QUEUED',
          language: 'ENGLISH',
          uaeSendTime: this.calculateNextBusinessHourSendTime()
        }
      })
    }
  }

  private getNotificationSubject(invoiceNumber: string, from: InvoiceStatus, to: InvoiceStatus): string {
    const subjects: Record<string, string> = {
      'DRAFT->SENT': `Invoice ${invoiceNumber} - Payment Due`,
      'SENT->OVERDUE': `URGENT: Invoice ${invoiceNumber} is Past Due`,
      'OVERDUE->PAID': `Thank You - Invoice ${invoiceNumber} Payment Received`,
      'SENT->PAID': `Payment Confirmed - Invoice ${invoiceNumber}`
    }

    return subjects[`${from}->${to}`] || `Invoice ${invoiceNumber} Status Update`
  }

  private calculateNextBusinessHourSendTime(): Date {
    const now = new Date()
    const dubaiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }))
    
    // If it's during business hours (Sunday-Thursday, 8 AM-6 PM), send immediately
    const day = dubaiTime.getDay()
    const hour = dubaiTime.getHours()
    
    if ([0, 1, 2, 3, 4].includes(day) && hour >= 8 && hour < 18) {
      return now
    }
    
    // Otherwise, schedule for next business day at 9 AM
    const nextBusinessDay = new Date(dubaiTime)
    if (day === 5) { // Friday
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 2) // Skip to Sunday
    } else if (day === 6) { // Saturday
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1) // Skip to Sunday
    } else {
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1) // Next day
    }
    
    nextBusinessDay.setHours(9, 0, 0, 0)
    return nextBusinessDay
  }

  private isUAEBusinessHours(): boolean {
    const now = new Date()
    const dubaiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }))
    const day = dubaiTime.getDay()
    const hour = dubaiTime.getHours()

    // UAE business hours: Sunday-Thursday, 8 AM-6 PM
    return [0, 1, 2, 3, 4].includes(day) && hour >= 8 && hour < 18
  }

  private async findOverdueInvoices(companyId?: string, config: OverdueDetectionConfig) {
    const whereClause: any = {
      status: InvoiceStatus.SENT,
      dueDate: {
        lt: new Date(Date.now() - config.gracePeriodDays * 24 * 60 * 60 * 1000)
      }
    }

    if (companyId) {
      whereClause.companyId = companyId
    }

    return await prisma.invoices.findMany({
      where: whereClause,
      include: {
        payments: { select: { amount: true, paymentDate: true } },
        customers: { select: { email: true, name: true } }
      },
      orderBy: { dueDate: 'asc' }
    })
  }

  private async processBatchStatusUpdate(
    invoices: any[],
    newStatus: InvoiceStatus,
    options: {
      reason: string
      automatedChange: boolean
      userId?: string
      userRole?: UserRole
      companyId?: string
      forceOverride?: boolean
      enableNotifications?: boolean
    }
  ): Promise<BatchStatusChangeResult> {
    const results: BatchStatusChangeResult = {
      totalRequested: invoices.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      results: [],
      auditEntries: [],
      businessSummary: {
        totalAmountAffected: 0,
        paidAmountAffected: 0,
        overdueAmountAffected: 0,
        formattedTotalAmount: ''
      }
    }

    for (const invoice of invoices) {
      try {
        // Skip if already in target status
        if (invoice.status === newStatus) {
          results.skippedCount++
          results.results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            success: true,
            reason: 'Already in target status'
          })
          continue
        }

        // Validate transition (skip role validation for automated changes)
        const validation = this.validateStatusTransition(invoice.status, newStatus, {
          invoice,
          user: { role: options.userRole || UserRole.ADMIN, companyId: options.companyId || invoice.companyId },
          reason: options.reason,
          forceOverride: options.automatedChange || options.forceOverride
        })

        if (!validation.isValid && !options.automatedChange) {
          results.failedCount++
          results.results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            success: false,
            error: validation.reason
          })
          continue
        }

        // Update in transaction
        await prisma.$transaction(async (tx) => {
          const businessContext = this.calculateBusinessContext(invoice)
          const finalStatus = this.determineActualStatus(invoice, newStatus, businessContext)

          await tx.invoices.update({
            where: { id: invoice.id },
            data: { status: finalStatus, updatedAt: new Date() }
          })

          // Create audit entry
          const auditEntry: StatusChangeAuditEntry = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            companyId: invoice.companyId,
            userId: options.userId || 'system',
            userRole: options.userRole || UserRole.ADMIN,
            oldStatus: invoice.status,
            newStatus: finalStatus,
            reason: options.reason,
            businessContext,
            metadata: {
              automatedChange: options.automatedChange,
              batchOperation: true,
              complianceFlags: this.generateComplianceFlags(invoice, finalStatus, validation)
            },
            timestamp: new Date()
          }

          await this.createAuditTrailEntry(tx, auditEntry)

          if (options.enableNotifications) {
            await this.scheduleCustomerNotification(tx, invoice, invoice.status, finalStatus, invoice.companyId)
          }

          results.auditEntries.push(auditEntry)
        })

        results.successCount++
        results.results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          success: true,
          oldStatus: invoice.status,
          newStatus: newStatus,
          reason: options.reason
        })

      } catch (error) {
        results.failedCount++
        results.results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  private async getStatusCounts(companyId: string): Promise<Record<InvoiceStatus, number>> {
    const counts = await prisma.invoices.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { status: true }
    })

    const result: Record<InvoiceStatus, number> = {
      [InvoiceStatus.DRAFT]: 0,
      [InvoiceStatus.SENT]: 0,
      [InvoiceStatus.OVERDUE]: 0,
      [InvoiceStatus.PAID]: 0,
      [InvoiceStatus.DISPUTED]: 0,
      [InvoiceStatus.WRITTEN_OFF]: 0
    }

    counts.forEach(count => {
      result[count.status] = count._count.status
    })

    return result
  }

  private async getOverdueAnalysis(companyId: string) {
    const overdueInvoices = await prisma.invoices.findMany({
      where: {
        companyId,
        status: InvoiceStatus.OVERDUE
      },
      select: {
        dueDate: true,
        totalAmount: true,
        amount: true
      }
    })

    const totalOverdue = overdueInvoices.length
    const totalOverdueAmount = overdueInvoices.reduce(
      (sum, invoice) => sum + (invoice.totalAmount || invoice.amount),
      0
    )

    const averageDaysOverdue = totalOverdue > 0 
      ? overdueInvoices.reduce((sum, invoice) => {
          const daysOverdue = Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          return sum + daysOverdue
        }, 0) / totalOverdue
      : 0

    return {
      totalOverdue,
      averageDaysOverdue: Math.round(averageDaysOverdue),
      totalOverdueAmount,
      formattedOverdueAmount: formatUAECurrency(new Decimal(totalOverdueAmount), 'AED')
    }
  }
}

// Export singleton instance
export const invoiceStatusService = new InvoiceStatusService()