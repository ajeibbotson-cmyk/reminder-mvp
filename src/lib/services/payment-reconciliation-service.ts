/**
 * Payment Reconciliation Service
 * Comprehensive payment management system for UAE Payment Collection Platform
 * 
 * Features:
 * - Payment validation and recording
 * - Automatic reconciliation and status updates
 * - Overpayment handling and refund management
 * - Partial payment tracking
 * - UAE business rule compliance
 * - Multi-currency support with AED focus
 * - Audit trail and compliance logging
 */

import { PaymentMethod, InvoiceStatus, UserRole, Prisma } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { formatUAECurrency, isUAEBusinessHours } from '@/lib/vat-calculator'
import { invoiceStatusService } from './invoice-status-service'

// Payment validation rules
export interface PaymentValidationRules {
  allowFuturePayments: boolean
  requireReferenceForBankTransfer: boolean
  requireReferenceForCheque: boolean
  allowOverpayment: boolean
  overpaymentTolerancePercent: number
  validateBusinessHours: boolean
  minimumPaymentAmount: number
  maximumPaymentAmount?: number
}

// Payment recording context
export interface PaymentRecordingContext {
  userId: string
  userRole: UserRole
  companyId: string
  userAgent?: string
  ipAddress?: string
  validateBusinessRules: boolean
  autoUpdateInvoiceStatus: boolean
  notifyCustomer: boolean
}

// Payment reconciliation result
export interface PaymentReconciliationResult {
  invoiceId: string
  invoiceNumber: string
  invoiceTotal: Decimal
  previouslyPaid: Decimal
  newPaymentAmount: Decimal
  totalPaid: Decimal
  remainingAmount: Decimal
  isFullyPaid: boolean
  isOverpaid: boolean
  overpaymentAmount: Decimal
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERPAID'
  suggestedInvoiceStatus: InvoiceStatus
  currency: string
  formattedAmounts: {
    invoiceTotal: string
    previouslyPaid: string
    newPayment: string
    totalPaid: string
    remainingAmount: string
    overpaymentAmount: string
  }
}

// Payment audit entry
export interface PaymentAuditEntry {
  paymentId: string
  invoiceId: string
  invoiceNumber: string
  companyId: string
  userId: string
  userRole: UserRole
  amount: Decimal
  method: PaymentMethod
  reference?: string
  notes?: string
  paymentDate: Date
  reconciliation: PaymentReconciliationResult
  businessValidation: {
    withinBusinessHours: boolean
    validationRules: PaymentValidationRules
    complianceFlags: string[]
  }
  metadata: {
    userAgent?: string
    ipAddress?: string
    automatedReconciliation: boolean
    statusUpdated: boolean
    customerNotified: boolean
  }
  timestamp: Date
}

// Bulk payment processing result
export interface BulkPaymentResult {
  totalRequested: number
  successCount: number
  failedCount: number
  totalAmountProcessed: Decimal
  results: Array<{
    invoiceId: string
    invoiceNumber: string
    success: boolean
    paymentId?: string
    amount?: number
    error?: string
    reconciliation?: PaymentReconciliationResult
  }>
  auditEntries: PaymentAuditEntry[]
  summary: {
    totalAmountProcessed: string
    averagePaymentAmount: string
    invoicesFullyPaid: number
    invoicesPartiallyPaid: number
  }
}

/**
 * Payment Reconciliation Service
 * Handles all payment-related operations with UAE business compliance
 */
export class PaymentReconciliationService {
  private readonly defaultValidationRules: PaymentValidationRules = {
    allowFuturePayments: false,
    requireReferenceForBankTransfer: true,
    requireReferenceForCheque: true,
    allowOverpayment: false,
    overpaymentTolerancePercent: 1.0, // 1% tolerance for rounding
    validateBusinessHours: true,
    minimumPaymentAmount: 0.01,
    maximumPaymentAmount: undefined // No maximum limit
  }

  /**
   * Record a new payment for an invoice with comprehensive validation
   */
  public async recordPayment(
    invoiceId: string,
    paymentData: {
      amount: number | string | Decimal
      paymentDate: Date | string
      method: PaymentMethod
      reference?: string
      notes?: string
    },
    context: PaymentRecordingContext,
    validationRules: Partial<PaymentValidationRules> = {}
  ): Promise<{
    payment: any
    reconciliation: PaymentReconciliationResult
    auditEntry: PaymentAuditEntry
    statusUpdateResult?: any
  }> {
    const rules = { ...this.defaultValidationRules, ...validationRules }
    
    return await prisma.$transaction(async (tx) => {
      // Fetch invoice with payments
      const invoice = await tx.invoices.findUnique({
        where: { 
          id: invoiceId,
          companyId: context.companyId
        },
        include: {
          payments: true,
          customers: {
            select: { id: true, name: true, email: true }
          }
        }
      })

      if (!invoice) {
        throw new Error('Invoice not found or access denied')
      }

      // Validate payment data
      const validatedPayment = this.validatePaymentData(paymentData, rules)
      
      // Calculate reconciliation before recording
      const reconciliation = this.calculateReconciliation(
        invoice,
        new Decimal(validatedPayment.amount)
      )

      // Validate business rules
      this.validateBusinessRules(reconciliation, rules, validatedPayment)

      // Create payment record
      const payment = await tx.payments.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          amount: reconciliation.newPaymentAmount.toNumber(),
          paymentDate: validatedPayment.paymentDate,
          method: validatedPayment.method,
          reference: validatedPayment.reference,
          notes: validatedPayment.notes
        }
      })

      // Create audit entry
      const auditEntry = this.createAuditEntry(
        payment,
        invoice,
        reconciliation,
        context,
        rules
      )

      // Log activity
      await this.logPaymentActivity(tx, auditEntry)

      // Auto-update invoice status if required
      let statusUpdateResult = null
      if (context.autoUpdateInvoiceStatus && reconciliation.isFullyPaid) {
        try {
          statusUpdateResult = await invoiceStatusService.updateInvoiceStatus(
            invoice.id,
            InvoiceStatus.PAID,
            {
              userId: context.userId,
              userRole: context.userRole,
              companyId: context.companyId,
              reason: `Automatic status update - full payment received (${reconciliation.formattedAmounts.newPayment})`,
              notes: `Payment method: ${validatedPayment.method}${validatedPayment.reference ? `, Reference: ${validatedPayment.reference}` : ''}`,
              notifyCustomer: context.notifyCustomer,
              userAgent: context.userAgent,
              ipAddress: context.ipAddress
            }
          )
        } catch (error) {
          console.warn('Failed to auto-update invoice status:', error)
        }
      }

      // Schedule customer notification if required
      if (context.notifyCustomer) {
        await this.schedulePaymentNotification(tx, invoice, payment, context.companyId)
      }

      return {
        payment,
        reconciliation,
        auditEntry,
        statusUpdateResult
      }
    })
  }

  /**
   * Process multiple payments in batch with comprehensive reporting
   */
  public async processBulkPayments(
    payments: Array<{
      invoiceId: string
      amount: number | string | Decimal
      paymentDate: Date | string
      method: PaymentMethod
      reference?: string
      notes?: string
    }>,
    context: PaymentRecordingContext,
    validationRules: Partial<PaymentValidationRules> = {}
  ): Promise<BulkPaymentResult> {
    const result: BulkPaymentResult = {
      totalRequested: payments.length,
      successCount: 0,
      failedCount: 0,
      totalAmountProcessed: new Decimal(0),
      results: [],
      auditEntries: [],
      summary: {
        totalAmountProcessed: '',
        averagePaymentAmount: '',
        invoicesFullyPaid: 0,
        invoicesPartiallyPaid: 0
      }
    }

    for (const paymentData of payments) {
      try {
        const paymentResult = await this.recordPayment(
          paymentData.invoiceId,
          paymentData,
          context,
          validationRules
        )

        result.successCount++
        result.totalAmountProcessed = result.totalAmountProcessed.plus(paymentResult.reconciliation.newPaymentAmount)
        result.auditEntries.push(paymentResult.auditEntry)

        if (paymentResult.reconciliation.isFullyPaid) {
          result.summary.invoicesFullyPaid++
        } else if (paymentResult.reconciliation.totalPaid.greaterThan(0)) {
          result.summary.invoicesPartiallyPaid++
        }

        result.results.push({
          invoiceId: paymentData.invoiceId,
          invoiceNumber: paymentResult.reconciliation.invoiceNumber,
          success: true,
          paymentId: paymentResult.payment.id,
          amount: paymentResult.reconciliation.newPaymentAmount.toNumber(),
          reconciliation: paymentResult.reconciliation
        })

      } catch (error) {
        result.failedCount++
        result.results.push({
          invoiceId: paymentData.invoiceId,
          invoiceNumber: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Calculate final summary
    result.summary.totalAmountProcessed = formatUAECurrency(result.totalAmountProcessed)
    result.summary.averagePaymentAmount = result.successCount > 0
      ? formatUAECurrency(result.totalAmountProcessed.dividedBy(result.successCount))
      : formatUAECurrency(0)

    return result
  }

  /**
   * Get comprehensive payment reconciliation for an invoice
   */
  public async getInvoiceReconciliation(
    invoiceId: string,
    companyId: string
  ): Promise<PaymentReconciliationResult & {
    payments: Array<{
      id: string
      amount: number
      formattedAmount: string
      paymentDate: Date
      method: PaymentMethod
      reference?: string
      notes?: string
    }>
    paymentTimeline: Array<{
      date: Date
      amount: number
      cumulativeAmount: number
      remainingAmount: number
      formattedAmounts: {
        amount: string
        cumulative: string
        remaining: string
      }
    }>
  }> {
    const invoice = await prisma.invoice.findUnique({
      where: { 
        id: invoiceId,
        companyId
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'asc' }
        }
      }
    })

    if (!invoice) {
      throw new Error('Invoice not found or access denied')
    }

    const reconciliation = this.calculateReconciliation(invoice)
    
    // Build payment timeline
    const paymentTimeline = []
    let cumulativeAmount = new Decimal(0)
    const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)

    for (const payment of invoice.payments) {
      cumulativeAmount = cumulativeAmount.plus(payment.amount)
      const remainingAmount = invoiceTotal.minus(cumulativeAmount)

      paymentTimeline.push({
        date: payment.paymentDate,
        amount: payment.amount,
        cumulativeAmount: cumulativeAmount.toNumber(),
        remainingAmount: Math.max(0, remainingAmount.toNumber()),
        formattedAmounts: {
          amount: formatUAECurrency(payment.amount, invoice.currency),
          cumulative: formatUAECurrency(cumulativeAmount, invoice.currency),
          remaining: formatUAECurrency(Math.max(0, remainingAmount.toNumber()), invoice.currency)
        }
      })
    }

    return {
      ...reconciliation,
      payments: invoice.payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        formattedAmount: formatUAECurrency(payment.amount, invoice.currency),
        paymentDate: payment.paymentDate,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes
      })),
      paymentTimeline
    }
  }

  /**
   * Handle overpayment scenarios with refund processing
   */
  public async processOverpaymentRefund(
    invoiceId: string,
    refundAmount: number | string | Decimal,
    context: PaymentRecordingContext,
    refundMethod: PaymentMethod = PaymentMethod.BANK_TRANSFER,
    refundReference?: string
  ): Promise<{
    refundPayment: any
    reconciliation: PaymentReconciliationResult
    auditEntry: PaymentAuditEntry
  }> {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoices.findUnique({
        where: { 
          id: invoiceId,
          companyId: context.companyId
        },
        include: { payments: true }
      })

      if (!invoice) {
        throw new Error('Invoice not found or access denied')
      }

      const reconciliation = this.calculateReconciliation(invoice)
      
      if (!reconciliation.isOverpaid) {
        throw new Error('Invoice is not overpaid - no refund required')
      }

      const refundAmountDecimal = new Decimal(refundAmount)
      if (refundAmountDecimal.greaterThan(reconciliation.overpaymentAmount)) {
        throw new Error('Refund amount cannot exceed overpayment amount')
      }

      // Create negative payment record for refund
      const refundPayment = await tx.payments.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          amount: refundAmountDecimal.negated().toNumber(),
          paymentDate: new Date(),
          method: refundMethod,
          reference: refundReference,
          notes: `Overpayment refund - ${formatUAECurrency(refundAmountDecimal, invoice.currency)}`
        }
      })

      // Recalculate reconciliation after refund
      const updatedReconciliation = this.calculateReconciliation({
        ...invoice,
        payments: [...invoice.payments, refundPayment]
      })

      // Create audit entry
      const auditEntry = this.createAuditEntry(
        refundPayment,
        invoice,
        updatedReconciliation,
        context,
        this.defaultValidationRules
      )

      // Log refund activity
      await this.logPaymentActivity(tx, auditEntry, 'overpayment_refund')

      return {
        refundPayment,
        reconciliation: updatedReconciliation,
        auditEntry
      }
    })
  }

  // Private helper methods

  private validatePaymentData(
    paymentData: {
      amount: number | string | Decimal
      paymentDate: Date | string
      method: PaymentMethod
      reference?: string
      notes?: string
    },
    rules: PaymentValidationRules
  ) {
    const amount = new Decimal(paymentData.amount)
    const paymentDate = new Date(paymentData.paymentDate)

    // Validate amount
    if (amount.lessThanOrEqualTo(rules.minimumPaymentAmount)) {
      throw new Error(`Payment amount must be greater than ${formatUAECurrency(rules.minimumPaymentAmount)}`)
    }

    if (rules.maximumPaymentAmount && amount.greaterThan(rules.maximumPaymentAmount)) {
      throw new Error(`Payment amount cannot exceed ${formatUAECurrency(rules.maximumPaymentAmount)}`)
    }

    // Validate payment date
    if (!rules.allowFuturePayments && paymentDate > new Date()) {
      throw new Error('Payment date cannot be in the future')
    }

    // Validate business hours
    if (rules.validateBusinessHours && !isUAEBusinessHours(paymentDate)) {
      throw new Error('Payment recording outside UAE business hours requires approval')
    }

    // Validate references
    if (rules.requireReferenceForBankTransfer && 
        paymentData.method === PaymentMethod.BANK_TRANSFER && 
        !paymentData.reference) {
      throw new Error('Bank transfer payments require a transaction reference')
    }

    if (rules.requireReferenceForCheque && 
        paymentData.method === PaymentMethod.CHEQUE && 
        !paymentData.reference) {
      throw new Error('Cheque payments require a cheque number reference')
    }

    return {
      amount,
      paymentDate,
      method: paymentData.method,
      reference: paymentData.reference,
      notes: paymentData.notes
    }
  }

  private calculateReconciliation(
    invoice: any,
    newPaymentAmount?: Decimal
  ): PaymentReconciliationResult {
    const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
    const previouslyPaid = invoice.payments.reduce(
      (sum: Decimal, payment: any) => sum.plus(payment.amount),
      new Decimal(0)
    )
    
    const newPayment = newPaymentAmount || new Decimal(0)
    const totalPaid = previouslyPaid.plus(newPayment)
    const remainingAmount = invoiceTotal.minus(totalPaid)
    
    const isFullyPaid = remainingAmount.lessThanOrEqualTo(0.01) // 1 cent tolerance
    const isOverpaid = remainingAmount.lessThan(-0.01)
    const overpaymentAmount = isOverpaid ? remainingAmount.negated() : new Decimal(0)

    let paymentStatus: PaymentReconciliationResult['paymentStatus']
    let suggestedInvoiceStatus: InvoiceStatus

    if (isOverpaid) {
      paymentStatus = 'OVERPAID'
      suggestedInvoiceStatus = InvoiceStatus.PAID
    } else if (isFullyPaid) {
      paymentStatus = 'FULLY_PAID'
      suggestedInvoiceStatus = InvoiceStatus.PAID
    } else if (totalPaid.greaterThan(0)) {
      paymentStatus = 'PARTIALLY_PAID'
      suggestedInvoiceStatus = invoice.status // Keep current status
    } else {
      paymentStatus = 'UNPAID'
      suggestedInvoiceStatus = InvoiceStatus.SENT
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceTotal,
      previouslyPaid,
      newPaymentAmount: newPayment,
      totalPaid,
      remainingAmount: remainingAmount.greaterThan(0) ? remainingAmount : new Decimal(0),
      isFullyPaid,
      isOverpaid,
      overpaymentAmount,
      paymentStatus,
      suggestedInvoiceStatus,
      currency: invoice.currency,
      formattedAmounts: {
        invoiceTotal: formatUAECurrency(invoiceTotal, invoice.currency),
        previouslyPaid: formatUAECurrency(previouslyPaid, invoice.currency),
        newPayment: formatUAECurrency(newPayment, invoice.currency),
        totalPaid: formatUAECurrency(totalPaid, invoice.currency),
        remainingAmount: formatUAECurrency(remainingAmount.greaterThan(0) ? remainingAmount : new Decimal(0), invoice.currency),
        overpaymentAmount: formatUAECurrency(overpaymentAmount, invoice.currency)
      }
    }
  }

  private validateBusinessRules(
    reconciliation: PaymentReconciliationResult,
    rules: PaymentValidationRules,
    paymentData: any
  ) {
    // Check overpayment rules
    if (!rules.allowOverpayment && reconciliation.isOverpaid) {
      const toleranceAmount = reconciliation.invoiceTotal.times(rules.overpaymentTolerancePercent / 100)
      if (reconciliation.overpaymentAmount.greaterThan(toleranceAmount)) {
        throw new Error(
          `Payment would result in overpayment. ` +
          `Invoice total: ${reconciliation.formattedAmounts.invoiceTotal}, ` +
          `Already paid: ${reconciliation.formattedAmounts.previouslyPaid}, ` +
          `Remaining: ${reconciliation.formattedAmounts.remainingAmount}`
        )
      }
    }
  }

  private createAuditEntry(
    payment: any,
    invoice: any,
    reconciliation: PaymentReconciliationResult,
    context: PaymentRecordingContext,
    rules: PaymentValidationRules
  ): PaymentAuditEntry {
    const complianceFlags = []
    
    if (reconciliation.isOverpaid) {
      complianceFlags.push('OVERPAYMENT_DETECTED')
    }
    
    if (reconciliation.isFullyPaid) {
      complianceFlags.push('FULLY_PAID')
    }
    
    if (payment.method === PaymentMethod.CASH) {
      complianceFlags.push('CASH_PAYMENT')
    }

    return {
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      companyId: context.companyId,
      userId: context.userId,
      userRole: context.userRole,
      amount: new Decimal(payment.amount),
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      paymentDate: payment.paymentDate,
      reconciliation,
      businessValidation: {
        withinBusinessHours: isUAEBusinessHours(payment.paymentDate),
        validationRules: rules,
        complianceFlags
      },
      metadata: {
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        automatedReconciliation: context.autoUpdateInvoiceStatus,
        statusUpdated: reconciliation.isFullyPaid && context.autoUpdateInvoiceStatus,
        customerNotified: context.notifyCustomer
      },
      timestamp: new Date()
    }
  }

  private async logPaymentActivity(
    tx: any,
    auditEntry: PaymentAuditEntry,
    activityType = 'payment_recorded'
  ) {
    await tx.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: auditEntry.companyId,
        userId: auditEntry.userId,
        type: activityType,
        description: `${activityType === 'overpayment_refund' ? 'Processed refund' : 'Recorded payment'} of ${auditEntry.reconciliation.formattedAmounts.newPayment} for invoice ${auditEntry.invoiceNumber}`,
        metadata: {
          paymentId: auditEntry.paymentId,
          invoiceId: auditEntry.invoiceId,
          invoiceNumber: auditEntry.invoiceNumber,
          amount: auditEntry.amount.toNumber(),
          method: auditEntry.method,
          reference: auditEntry.reference,
          paymentDate: auditEntry.paymentDate.toISOString(),
          reconciliation: {
            paymentStatus: auditEntry.reconciliation.paymentStatus,
            isFullyPaid: auditEntry.reconciliation.isFullyPaid,
            isOverpaid: auditEntry.reconciliation.isOverpaid,
            totalPaid: auditEntry.reconciliation.totalPaid.toNumber(),
            remainingAmount: auditEntry.reconciliation.remainingAmount.toNumber()
          },
          businessValidation: auditEntry.businessValidation,
          ...auditEntry.metadata
        }
      }
    })
  }

  private async schedulePaymentNotification(
    tx: any,
    invoice: any,
    payment: any,
    companyId: string
  ) {
    const sendTime = this.getNextBusinessHourSendTime()
    
    await tx.emailLogs.create({
      data: {
        id: crypto.randomUUID(),
        companyId,
        invoiceId: invoice.id,
        customerId: invoice.customers?.id,
        recipientEmail: invoice.customerEmail,
        recipientName: invoice.customerName,
        subject: `Payment Received - Invoice ${invoice.number}`,
        content: `Thank you for your payment of ${formatUAECurrency(payment.amount, invoice.currency)} for invoice ${invoice.number}`,
        deliveryStatus: 'QUEUED',
        language: 'ENGLISH',
        uaeSendTime: sendTime,
        metadata: {
          type: 'payment_confirmation',
          paymentId: payment.id,
          paymentAmount: payment.amount,
          paymentMethod: payment.method,
          paymentReference: payment.reference
        }
      }
    })
  }

  private getNextBusinessHourSendTime(): Date {
    const now = new Date()
    const dubaiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }))
    
    const day = dubaiTime.getDay()
    const hour = dubaiTime.getHours()
    
    if ([0, 1, 2, 3, 4].includes(day) && hour >= 8 && hour < 18) {
      return now
    }
    
    const nextBusinessDay = new Date(dubaiTime)
    if (day === 5) {
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 2)
    } else if (day === 6) {
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1)
    } else {
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1)
    }
    
    nextBusinessDay.setHours(9, 0, 0, 0)
    return nextBusinessDay
  }
}

// Export singleton instance
export const paymentReconciliationService = new PaymentReconciliationService()