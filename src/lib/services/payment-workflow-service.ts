/**
 * Payment Workflow Integration Service
 * Advanced service for payment-invoice status correlation and automation
 * 
 * Features:
 * - Intelligent payment-to-status mapping
 * - Automated status transitions based on payment events
 * - Partial payment handling and tracking
 * - UAE business rule compliance
 * - Multi-currency payment processing
 * - Webhook-style event handling for payment notifications
 */

import { InvoiceStatus, PaymentMethod, UserRole, Prisma } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { invoiceStatusService, StatusChangeResult } from '@/lib/services/invoice-status-service'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { DEFAULT_UAE_BUSINESS_HOURS } from '@/types/invoice'

// Payment workflow event types
export type PaymentWorkflowEvent = 
  | 'payment_received'
  | 'payment_failed'
  | 'payment_reversed'
  | 'payment_partial'
  | 'payment_completed'
  | 'payment_overdue_cleared'

// Payment workflow result
export interface PaymentWorkflowResult {
  success: boolean
  paymentId: string
  invoiceId: string
  invoiceNumber: string
  event: PaymentWorkflowEvent
  statusTransition?: {
    from: InvoiceStatus
    to: InvoiceStatus
    automatic: boolean
    reason: string
  }
  paymentSummary: {
    totalPaid: number
    remainingAmount: number
    paymentCount: number
    isPartialPayment: boolean
    isFullyPaid: boolean
    formattedAmounts: {
      totalPaid: string
      remainingAmount: string
      currentPayment: string
    }
  }
  businessRules: {
    uaeCompliant: boolean
    complianceFlags: string[]
    businessHours: boolean
    auditTrailCreated: boolean
  }
  recommendedActions: string[]
  error?: string
}

// Batch payment processing result
export interface BatchPaymentProcessingResult {
  totalRequested: number
  successCount: number
  failedCount: number
  results: PaymentWorkflowResult[]
  aggregatedSummary: {
    totalAmountProcessed: number
    formattedTotalAmount: string
    invoicesFullyPaid: number
    invoicesPartiallyPaid: number
    statusTransitionsTriggered: number
  }
  processingTime: number
}

// Payment reconciliation result
export interface PaymentReconciliationResult {
  invoiceId: string
  invoiceNumber: string
  totalInvoiceAmount: number
  totalPaymentsRecorded: number
  discrepancy: number
  status: 'RECONCILED' | 'OVERPAID' | 'UNDERPAID' | 'DISCREPANCY'
  recommendedAction: string
  paymentBreakdown: Array<{
    paymentId: string
    amount: number
    method: PaymentMethod
    date: Date
    reference?: string
  }>
}

/**
 * Payment Workflow Integration Service
 * Handles complex payment-to-invoice status workflows with UAE compliance
 */
export class PaymentWorkflowService {
  private readonly tolerancePercentage = 0.01 // 1% tolerance for payment rounding

  /**
   * Process a payment event and automatically update invoice status
   */
  public async processPaymentWorkflow(
    paymentId: string,
    event: PaymentWorkflowEvent,
    context: {
      userId: string
      userRole: UserRole
      companyId: string
      reason?: string
      metadata?: Record<string, any>
    }
  ): Promise<PaymentWorkflowResult> {
    return await prisma.$transaction(async (tx) => {
      // Fetch payment with complete invoice and payment history
      const payment = await tx.payments.findUnique({
        where: { id: paymentId },
        include: {
          invoices: {
            include: {
              payments: {
                select: { id: true, amount: true, paymentDate: true, method: true, reference: true },
                orderBy: { paymentDate: 'desc' }
              },
              companies: {
                select: { id: true, name: true }
              }
            }
          }
        }
      })

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`)
      }

      // Verify company isolation
      if (payment.invoices.companies.id !== context.companyId) {
        throw new Error('Access denied: Payment belongs to different company')
      }

      const invoice = payment.invoices

      // Calculate payment summary
      const paymentSummary = this.calculatePaymentSummary(invoice, payment)

      // Determine required status transition based on payment event and business rules
      const statusTransition = await this.determineStatusTransition(
        invoice,
        paymentSummary,
        event,
        context
      )

      // Execute status transition if required
      let statusChangeResult: StatusChangeResult | null = null
      if (statusTransition) {
        statusChangeResult = await invoiceStatusService.updateInvoiceStatus(
          invoice.id,
          statusTransition.targetStatus,
          {
            userId: context.userId,
            userRole: context.userRole,
            companyId: context.companyId,
            reason: statusTransition.reason,
            notes: statusTransition.notes,
            notifyCustomer: statusTransition.notifyCustomer
          }
        )
      }

      // Generate compliance flags and business context
      const businessRules = this.generateBusinessRuleContext(invoice, payment, paymentSummary)

      // Log payment workflow event
      await this.logPaymentWorkflowEvent(tx, payment, invoice, event, statusChangeResult, context)

      // Generate recommended actions
      const recommendedActions = this.generateRecommendedActions(
        paymentSummary,
        statusChangeResult?.newStatus || invoice.status,
        event
      )

      return {
        success: true,
        paymentId: payment.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        event,
        statusTransition: statusChangeResult ? {
          from: statusChangeResult.oldStatus,
          to: statusChangeResult.newStatus,
          automatic: true,
          reason: statusChangeResult.reason
        } : undefined,
        paymentSummary: {
          ...paymentSummary,
          formattedAmounts: {
            totalPaid: formatUAECurrency(new Decimal(paymentSummary.totalPaid), invoice.currency),
            remainingAmount: formatUAECurrency(new Decimal(paymentSummary.remainingAmount), invoice.currency),
            currentPayment: formatUAECurrency(new Decimal(payment.amount), invoice.currency)
          }
        },
        businessRules,
        recommendedActions
      }
    })
  }

  /**
   * Process multiple payments in batch with workflow automation
   */
  public async processBatchPaymentWorkflow(
    paymentEvents: Array<{
      paymentId: string
      event: PaymentWorkflowEvent
    }>,
    context: {
      userId: string
      userRole: UserRole
      companyId: string
      batchId?: string
    }
  ): Promise<BatchPaymentProcessingResult> {
    const startTime = Date.now()
    const results: PaymentWorkflowResult[] = []
    let successCount = 0
    let failedCount = 0

    for (const { paymentId, event } of paymentEvents) {
      try {
        const result = await this.processPaymentWorkflow(paymentId, event, {
          ...context,
          reason: `Batch payment processing - ${context.batchId || 'system'}`
        })
        results.push(result)
        successCount++
      } catch (error) {
        const failureResult: PaymentWorkflowResult = {
          success: false,
          paymentId,
          invoiceId: '',
          invoiceNumber: '',
          event,
          paymentSummary: {
            totalPaid: 0,
            remainingAmount: 0,
            paymentCount: 0,
            isPartialPayment: false,
            isFullyPaid: false,
            formattedAmounts: { totalPaid: '', remainingAmount: '', currentPayment: '' }
          },
          businessRules: {
            uaeCompliant: false,
            complianceFlags: [],
            businessHours: false,
            auditTrailCreated: false
          },
          recommendedActions: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        results.push(failureResult)
        failedCount++
      }
    }

    // Calculate aggregated summary
    const aggregatedSummary = this.calculateBatchSummary(results.filter(r => r.success))
    const processingTime = Date.now() - startTime

    return {
      totalRequested: paymentEvents.length,
      successCount,
      failedCount,
      results,
      aggregatedSummary,
      processingTime
    }
  }

  /**
   * Reconcile payments for an invoice and detect discrepancies
   */
  public async reconcileInvoicePayments(
    invoiceId: string,
    companyId: string
  ): Promise<PaymentReconciliationResult> {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId, companyId },
      include: {
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            paymentDate: true,
            reference: true
          },
          orderBy: { paymentDate: 'desc' }
        }
      }
    })

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found or access denied`)
    }

    const totalInvoiceAmount = invoice.totalAmount?.toNumber() || invoice.amount.toNumber()
    const totalPaymentsRecorded = invoice.payments.reduce(
      (sum, p) => sum + p.amount.toNumber(), 0
    )
    const discrepancy = totalPaymentsRecorded - totalInvoiceAmount

    // Determine reconciliation status
    let status: PaymentReconciliationResult['status']
    let recommendedAction: string

    const toleranceAmount = totalInvoiceAmount * this.tolerancePercentage

    if (Math.abs(discrepancy) <= toleranceAmount) {
      status = 'RECONCILED'
      recommendedAction = 'Payments reconciled successfully - no action required'
    } else if (discrepancy > toleranceAmount) {
      status = 'OVERPAID'
      recommendedAction = `Process refund or credit note for ${formatUAECurrency(new Decimal(discrepancy), invoice.currency)}`
    } else if (discrepancy < -toleranceAmount) {
      status = 'UNDERPAID'
      recommendedAction = `Follow up for outstanding balance of ${formatUAECurrency(new Decimal(Math.abs(discrepancy)), invoice.currency)}`
    } else {
      status = 'DISCREPANCY'
      recommendedAction = 'Review payment records for data entry errors'
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      totalInvoiceAmount,
      totalPaymentsRecorded,
      discrepancy,
      status,
      recommendedAction,
      paymentBreakdown: invoice.payments.map(p => ({
        paymentId: p.id,
        amount: p.amount.toNumber(),
        method: p.method,
        date: p.paymentDate,
        reference: p.reference || undefined
      }))
    }
  }

  /**
   * Process incoming payment notifications (webhook-style)
   */
  public async processPaymentNotification(
    notification: {
      externalPaymentId: string
      invoiceNumber: string
      amount: number
      currency: string
      method: PaymentMethod
      reference?: string
      paymentDate: Date
      status: 'success' | 'failed' | 'pending'
    },
    companyId: string
  ): Promise<PaymentWorkflowResult> {
    return await prisma.$transaction(async (tx) => {
      // Find invoice by number
      const invoice = await tx.invoices.findUnique({
        where: { 
          companyId_number: { 
            companyId, 
            number: notification.invoiceNumber 
          } 
        },
        include: {
          payments: { select: { id: true, amount: true } }
        }
      })

      if (!invoice) {
        throw new Error(`Invoice ${notification.invoiceNumber} not found`)
      }

      // Check if payment already exists
      const existingPayment = await tx.payments.findFirst({
        where: { 
          invoiceId: invoice.id,
          reference: notification.externalPaymentId
        }
      })

      if (existingPayment && notification.status === 'success') {
        // Payment already processed, return existing workflow result
        return await this.processPaymentWorkflow(existingPayment.id, 'payment_received', {
          userId: 'system',
          userRole: UserRole.ADMIN,
          companyId,
          reason: 'Duplicate payment notification - already processed'
        })
      }

      if (notification.status === 'failed') {
        // Log failed payment attempt
        await tx.activities.create({
          data: {
            id: crypto.randomUUID(),
            companyId,
            userId: 'system',
            type: 'payment_failed',
            description: `Payment failed for invoice ${invoice.number}`,
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              externalPaymentId: notification.externalPaymentId,
              amount: notification.amount,
              currency: notification.currency,
              method: notification.method,
              reference: notification.reference,
              failureReason: 'Payment gateway reported failure'
            }
          }
        })

        throw new Error('Payment failed - no workflow processing required')
      }

      if (notification.status === 'pending') {
        // Log pending payment for tracking
        await tx.activities.create({
          data: {
            id: crypto.randomUUID(),
            companyId,
            userId: 'system',
            type: 'payment_pending',
            description: `Payment pending for invoice ${invoice.number}`,
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              externalPaymentId: notification.externalPaymentId,
              amount: notification.amount,
              currency: notification.currency,
              method: notification.method,
              reference: notification.reference
            }
          }
        })

        throw new Error('Payment pending - workflow will process on completion')
      }

      // Create new payment record for successful payment
      const payment = await tx.payments.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          amount: notification.amount,
          paymentDate: notification.paymentDate,
          method: notification.method,
          reference: notification.externalPaymentId,
          notes: 'Automated payment via payment gateway'
        }
      })

      // Process payment workflow
      return await this.processPaymentWorkflow(payment.id, 'payment_received', {
        userId: 'system',
        userRole: UserRole.ADMIN,
        companyId,
        reason: 'Payment received via payment gateway',
        metadata: {
          externalPaymentId: notification.externalPaymentId,
          gateway: 'automated',
          notificationProcessed: true
        }
      })
    })
  }

  // Private helper methods

  private calculatePaymentSummary(invoice: any, currentPayment: any) {
    const totalPaid = invoice.payments.reduce(
      (sum: Decimal, p: any) => sum.plus(p.amount), new Decimal(0)
    )
    const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
    const remainingAmount = invoiceTotal.minus(totalPaid)

    return {
      totalPaid: totalPaid.toNumber(),
      remainingAmount: Math.max(0, remainingAmount.toNumber()),
      paymentCount: invoice.payments.length,
      isPartialPayment: totalPaid.greaterThan(0) && totalPaid.lessThan(invoiceTotal.times(1 - this.tolerancePercentage)),
      isFullyPaid: remainingAmount.lessThanOrEqualTo(invoiceTotal.times(this.tolerancePercentage))
    }
  }

  private async determineStatusTransition(
    invoice: any,
    paymentSummary: any,
    event: PaymentWorkflowEvent,
    context: any
  ): Promise<{
    targetStatus: InvoiceStatus
    reason: string
    notes?: string
    notifyCustomer: boolean
  } | null> {
    const currentStatus = invoice.status

    switch (event) {
      case 'payment_received':
      case 'payment_completed':
        if (paymentSummary.isFullyPaid && currentStatus !== InvoiceStatus.PAID) {
          return {
            targetStatus: InvoiceStatus.PAID,
            reason: 'Payment completed - invoice fully paid',
            notes: `Total paid: ${formatUAECurrency(new Decimal(paymentSummary.totalPaid), invoice.currency)}`,
            notifyCustomer: true
          }
        }
        break

      case 'payment_overdue_cleared':
        if (currentStatus === InvoiceStatus.OVERDUE && paymentSummary.isFullyPaid) {
          return {
            targetStatus: InvoiceStatus.PAID,
            reason: 'Overdue payment cleared - invoice fully paid',
            notes: 'Overdue status cleared by payment',
            notifyCustomer: true
          }
        }
        break

      case 'payment_partial':
        // Partial payments don't typically trigger status changes,
        // but we might want to clear OVERDUE if significant progress made
        if (currentStatus === InvoiceStatus.OVERDUE && paymentSummary.totalPaid > 0) {
          const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
          const paidPercentage = new Decimal(paymentSummary.totalPaid).dividedBy(invoiceTotal)
          
          if (paidPercentage.greaterThanOrEqualTo(0.5)) { // 50% paid
            return {
              targetStatus: InvoiceStatus.SENT,
              reason: 'Significant partial payment received - removed from overdue',
              notes: `${paidPercentage.times(100).toFixed(1)}% of invoice amount paid`,
              notifyCustomer: false
            }
          }
        }
        break

      case 'payment_reversed':
        if (currentStatus === InvoiceStatus.PAID && !paymentSummary.isFullyPaid) {
          const targetStatus = invoice.dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT
          return {
            targetStatus,
            reason: 'Payment reversed - invoice no longer fully paid',
            notes: `Outstanding balance: ${formatUAECurrency(new Decimal(paymentSummary.remainingAmount), invoice.currency)}`,
            notifyCustomer: true
          }
        }
        break
    }

    return null
  }

  private generateBusinessRuleContext(invoice: any, payment: any, paymentSummary: any) {
    const complianceFlags: string[] = []

    // UAE compliance checks
    if (invoice.trnNumber) {
      complianceFlags.push('TRN_COMPLIANT')
    }

    if (payment.method === PaymentMethod.BANK_TRANSFER) {
      complianceFlags.push('BANK_TRANSFER_TRACEABLE')
    }

    if (payment.reference) {
      complianceFlags.push('REFERENCE_PROVIDED')
    }

    const businessHours = this.isUAEBusinessHours()
    if (businessHours) {
      complianceFlags.push('PROCESSED_BUSINESS_HOURS')
    }

    return {
      uaeCompliant: true,
      complianceFlags,
      businessHours,
      auditTrailCreated: true
    }
  }

  private generateRecommendedActions(
    paymentSummary: any,
    currentStatus: InvoiceStatus,
    event: PaymentWorkflowEvent
  ): string[] {
    const actions: string[] = []

    if (paymentSummary.isFullyPaid) {
      actions.push('Send payment confirmation to customer')
      actions.push('Archive invoice')
      actions.push('Update accounting records')
    } else if (paymentSummary.isPartialPayment) {
      actions.push('Send partial payment acknowledgment')
      actions.push('Schedule follow-up for remaining balance')
      actions.push('Monitor payment completion')
    }

    if (event === 'payment_overdue_cleared') {
      actions.push('Remove from overdue tracking')
      actions.push('Cancel pending reminder emails')
    }

    if (event === 'payment_reversed') {
      actions.push('Investigate payment reversal')
      actions.push('Contact customer for alternative payment')
      actions.push('Resume collection activities if necessary')
    }

    return actions
  }

  private calculateBatchSummary(successfulResults: PaymentWorkflowResult[]) {
    const totalAmountProcessed = successfulResults.reduce(
      (sum, result) => sum + result.paymentSummary.totalPaid, 0
    )

    return {
      totalAmountProcessed,
      formattedTotalAmount: formatUAECurrency(new Decimal(totalAmountProcessed), 'AED'),
      invoicesFullyPaid: successfulResults.filter(r => r.paymentSummary.isFullyPaid).length,
      invoicesPartiallyPaid: successfulResults.filter(r => r.paymentSummary.isPartialPayment).length,
      statusTransitionsTriggered: successfulResults.filter(r => r.statusTransition).length
    }
  }

  private async logPaymentWorkflowEvent(
    tx: any,
    payment: any,
    invoice: any,
    event: PaymentWorkflowEvent,
    statusChangeResult: StatusChangeResult | null,
    context: any
  ) {
    await tx.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: context.companyId,
        userId: context.userId,
        type: 'payment_workflow_processed',
        description: `Payment workflow processed: ${event} for invoice ${invoice.number}`,
        metadata: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          event,
          amount: payment.amount,
          currency: invoice.currency,
          method: payment.method,
          reference: payment.reference,
          statusTransition: statusChangeResult ? {
            from: statusChangeResult.oldStatus,
            to: statusChangeResult.newStatus,
            reason: statusChangeResult.reason
          } : null,
          businessContext: {
            processedDuringBusinessHours: this.isUAEBusinessHours(),
            automaticWorkflow: true,
            complianceFlags: this.generateBusinessRuleContext(invoice, payment, {}).complianceFlags
          }
        }
      }
    })
  }

  private isUAEBusinessHours(): boolean {
    const now = new Date()
    const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
    const day = dubaiTime.getDay()
    const hour = dubaiTime.getHours()

    // UAE business hours: Sunday-Thursday, 8 AM-6 PM
    return [0, 1, 2, 3, 4].includes(day) && hour >= 8 && hour < 18
  }
}

// Export singleton instance
export const paymentWorkflowService = new PaymentWorkflowService()