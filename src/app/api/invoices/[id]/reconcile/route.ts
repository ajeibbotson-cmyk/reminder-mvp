import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError, ValidationError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { UserRole, PaymentMethod, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { paymentReconciliationService } from '@/lib/services/payment-reconciliation-service'
import { auditTrailService, AuditEventType } from '@/lib/services/audit-trail-service'
import { webhookService, WebhookEventType } from '@/lib/services/webhook-service'
import { z } from 'zod'

// Reconciliation action schema
const reconcileActionSchema = z.object({
  action: z.enum(['auto_reconcile', 'manual_reconcile', 'mark_discrepancy', 'approve_overpayment']),
  adjustmentAmount: z.number().optional(),
  adjustmentReason: z.string().optional(),
  overrideValidation: z.boolean().default(false),
  notifyCustomer: z.boolean().default(false)
})

interface ReconciliationResult {
  reconciled: boolean
  adjustmentApplied: boolean
  adjustmentAmount?: number
  discrepancyFound: boolean
  discrepancyDetails?: {
    type: 'overpayment' | 'underpayment' | 'rounding_error'
    amount: number
    tolerance: number
    requiresAction: boolean
  }
  finalStatus: InvoiceStatus
  actions: string[]
  auditTrail: any[]
}

// GET /api/invoices/[id]/reconcile - Get payment reconciliation status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    const { id: invoiceId } = params

    // Get comprehensive reconciliation data
    const reconciliation = await paymentReconciliationService.getInvoiceReconciliation(
      invoiceId,
      authContext.user.companyId
    )

    // Check for discrepancies
    const discrepancies = analyzeDiscrepancies(reconciliation)
    
    // Get suggested actions
    const suggestedActions = generateReconciliationActions(reconciliation, discrepancies)

    return successResponse({
      reconciliation: {
        ...reconciliation,
        formattedAmounts: {
          invoiceTotal: reconciliation.formattedAmounts.invoiceTotal,
          totalPaid: reconciliation.formattedAmounts.totalPaid,
          remainingAmount: reconciliation.formattedAmounts.remainingAmount,
          overpaymentAmount: reconciliation.formattedAmounts.overpaymentAmount
        }
      },
      discrepancies,
      suggestedActions,
      reconciliationStatus: {
        isReconciled: reconciliation.isFullyPaid && !reconciliation.isOverpaid,
        requiresAction: discrepancies.length > 0 || reconciliation.isOverpaid,
        complianceStatus: 'COMPLIANT',
        lastReconciled: null // Would track last reconciliation date
      }
    }, 'Payment reconciliation data retrieved successfully')

  } catch (error) {
    logError('GET /api/invoices/[id]/reconcile', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}

// POST /api/invoices/[id]/reconcile - Perform payment reconciliation action
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to perform reconciliation actions')
    }

    const { id: invoiceId } = params
    const body = await request.json()
    const actionData = reconcileActionSchema.parse(body)

    const result = await prisma.$transaction(async (tx) => {
      // Get current reconciliation status
      const reconciliation = await paymentReconciliationService.getInvoiceReconciliation(
        invoiceId,
        authContext.user.companyId
      )

      // Validate action is appropriate
      validateReconciliationAction(actionData.action, reconciliation)

      let reconciliationResult: ReconciliationResult
      
      switch (actionData.action) {
        case 'auto_reconcile':
          reconciliationResult = await performAutoReconciliation(reconciliation, authContext)
          break
          
        case 'manual_reconcile':
          reconciliationResult = await performManualReconciliation(
            reconciliation, 
            actionData, 
            authContext
          )
          break
          
        case 'mark_discrepancy':
          reconciliationResult = await markDiscrepancy(reconciliation, actionData, authContext)
          break
          
        case 'approve_overpayment':
          reconciliationResult = await approveOverpayment(reconciliation, actionData, authContext)
          break
          
        default:
          throw new ValidationError('Unknown reconciliation action')
      }

      // Log comprehensive audit trail
      await auditTrailService.logEvent(
        AuditEventType.PAYMENT_RECORDED,
        {
          userId: authContext.user.id,
          userRole: authContext.user.role,
          companyId: authContext.user.companyId,
          ipAddress: request.headers.get('x-forwarded-for') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          apiEndpoint: '/api/invoices/[id]/reconcile'
        },
        'reconciliation',
        invoiceId,
        `Payment reconciliation: ${actionData.action}`,
        {
          reconciliation,
          action: actionData.action,
          result: reconciliationResult
        },
        undefined,
        'HIGH',
        ['reconciliation', actionData.action]
      )

      // Trigger webhooks for important reconciliation events
      if (reconciliationResult.reconciled) {
        await webhookService.triggerInvoiceEvent(
          WebhookEventType.INVOICE_PAID,
          { id: invoiceId, number: reconciliation.invoiceNumber },
          authContext.user.companyId,
          { reconciliationResult, action: actionData.action }
        )
      }

      return reconciliationResult
    })

    return successResponse(result, `Reconciliation action '${actionData.action}' completed successfully`)

  } catch (error) {
    logError('POST /api/invoices/[id]/reconcile', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}

// Helper functions for reconciliation logic

function analyzeDiscrepancies(reconciliation: any) {
  const discrepancies = []
  const tolerance = 0.02 // 2 cents tolerance for rounding

  if (reconciliation.isOverpaid) {
    const overpaymentAmount = reconciliation.overpaymentAmount.toNumber()
    
    if (overpaymentAmount <= tolerance) {
      discrepancies.push({
        type: 'rounding_error',
        amount: overpaymentAmount,
        severity: 'LOW',
        description: 'Minor overpayment within rounding tolerance',
        autoResolvable: true
      })
    } else {
      discrepancies.push({
        type: 'overpayment',
        amount: overpaymentAmount,
        severity: overpaymentAmount > 10 ? 'HIGH' : 'MEDIUM',
        description: `Customer overpaid by ${formatUAECurrency(overpaymentAmount, reconciliation.currency)}`,
        autoResolvable: false,
        requiresRefund: overpaymentAmount > 1.00
      })
    }
  }

  // Check for suspicious payment patterns
  if (reconciliation.payments.length > 5) {
    discrepancies.push({
      type: 'multiple_payments',
      amount: 0,
      severity: 'LOW',
      description: 'Multiple payments received - review for potential issues',
      autoResolvable: false
    })
  }

  // Check payment timing
  const overduePayments = reconciliation.payments.filter(payment => 
    new Date(payment.paymentDate) > new Date(reconciliation.dueDate)
  )
  
  if (overduePayments.length > 0) {
    discrepancies.push({
      type: 'late_payment',
      amount: 0,
      severity: 'LOW',
      description: 'Some payments received after due date',
      autoResolvable: false
    })
  }

  return discrepancies
}

function generateReconciliationActions(reconciliation: any, discrepancies: any[]) {
  const actions = []

  if (reconciliation.isFullyPaid && !reconciliation.isOverpaid) {
    actions.push({
      action: 'auto_reconcile',
      description: 'Mark invoice as fully reconciled',
      priority: 'HIGH',
      automated: true
    })
  }

  if (reconciliation.isOverpaid) {
    const overpaymentAmount = reconciliation.overpaymentAmount.toNumber()
    
    if (overpaymentAmount <= 0.02) {
      actions.push({
        action: 'approve_overpayment',
        description: 'Approve minor overpayment (within tolerance)',
        priority: 'MEDIUM',
        automated: false
      })
    } else {
      actions.push({
        action: 'approve_overpayment',
        description: 'Process overpayment refund or credit note',
        priority: 'HIGH',
        automated: false
      })
    }
  }

  if (discrepancies.some(d => d.autoResolvable)) {
    actions.push({
      action: 'manual_reconcile',
      description: 'Apply automatic adjustments for minor discrepancies',
      priority: 'MEDIUM',
      automated: false
    })
  }

  if (discrepancies.some(d => d.severity === 'HIGH')) {
    actions.push({
      action: 'mark_discrepancy',
      description: 'Mark for manual review due to significant discrepancies',
      priority: 'HIGH',
      automated: false
    })
  }

  return actions
}

function validateReconciliationAction(action: string, reconciliation: any) {
  switch (action) {
    case 'auto_reconcile':
      if (!reconciliation.isFullyPaid) {
        throw new ValidationError('Cannot auto-reconcile: Invoice is not fully paid')
      }
      if (reconciliation.isOverpaid) {
        throw new ValidationError('Cannot auto-reconcile: Invoice has overpayment that requires review')
      }
      break
      
    case 'approve_overpayment':
      if (!reconciliation.isOverpaid) {
        throw new ValidationError('Cannot approve overpayment: No overpayment detected')
      }
      break
  }
}

async function performAutoReconciliation(reconciliation: any, authContext: any): Promise<ReconciliationResult> {
  // Update invoice status to PAID
  await prisma.invoices.update({
    where: { id: reconciliation.invoiceId },
    data: { status: InvoiceStatus.PAID }
  })

  return {
    reconciled: true,
    adjustmentApplied: false,
    discrepancyFound: false,
    finalStatus: InvoiceStatus.PAID,
    actions: ['marked_as_paid', 'reconciliation_completed'],
    auditTrail: []
  }
}

async function performManualReconciliation(
  reconciliation: any, 
  actionData: any, 
  authContext: any
): Promise<ReconciliationResult> {
  let adjustmentAmount = 0
  let adjustmentApplied = false

  // Apply adjustment if specified
  if (actionData.adjustmentAmount && Math.abs(actionData.adjustmentAmount) > 0) {
    // Create adjustment payment record
    await prisma.payments.create({
      data: {
        id: crypto.randomUUID(),
        invoiceId: reconciliation.invoiceId,
        amount: actionData.adjustmentAmount,
        paymentDate: new Date(),
        method: PaymentMethod.OTHER,
        reference: 'RECONCILIATION_ADJUSTMENT',
        notes: actionData.adjustmentReason || 'Manual reconciliation adjustment'
      }
    })

    adjustmentAmount = actionData.adjustmentAmount
    adjustmentApplied = true
  }

  // Update invoice status
  const newStatus = reconciliation.isFullyPaid ? InvoiceStatus.PAID : reconciliation.suggestedInvoiceStatus
  
  await prisma.invoices.update({
    where: { id: reconciliation.invoiceId },
    data: { status: newStatus }
  })

  return {
    reconciled: newStatus === InvoiceStatus.PAID,
    adjustmentApplied,
    adjustmentAmount,
    discrepancyFound: false,
    finalStatus: newStatus,
    actions: adjustmentApplied ? ['adjustment_applied', 'status_updated'] : ['status_updated'],
    auditTrail: []
  }
}

async function markDiscrepancy(
  reconciliation: any, 
  actionData: any, 
  authContext: any
): Promise<ReconciliationResult> {
  // Log discrepancy for review
  await prisma.activities.create({
    data: {
      id: crypto.randomUUID(),
      companyId: authContext.user.companyId,
      userId: authContext.user.id,
      type: 'payment_discrepancy_marked',
      description: `Payment discrepancy marked for invoice ${reconciliation.invoiceNumber}`,
      metadata: {
        invoiceId: reconciliation.invoiceId,
        reconciliation,
        reason: actionData.adjustmentReason,
        markedBy: authContext.user.id
      }
    }
  })

  return {
    reconciled: false,
    adjustmentApplied: false,
    discrepancyFound: true,
    discrepancyDetails: {
      type: 'overpayment',
      amount: reconciliation.overpaymentAmount?.toNumber() || 0,
      tolerance: 0.02,
      requiresAction: true
    },
    finalStatus: reconciliation.status,
    actions: ['discrepancy_marked', 'review_required'],
    auditTrail: []
  }
}

async function approveOverpayment(
  reconciliation: any, 
  actionData: any, 
  authContext: any
): Promise<ReconciliationResult> {
  const overpaymentAmount = reconciliation.overpaymentAmount.toNumber()

  // For small overpayments, mark as resolved
  if (overpaymentAmount <= 0.02) {
    await prisma.invoices.update({
      where: { id: reconciliation.invoiceId },
      data: { 
        status: InvoiceStatus.PAID,
        notes: `${reconciliation.notes || ''}\nMinor overpayment of ${formatUAECurrency(overpaymentAmount, reconciliation.currency)} approved - within tolerance.`.trim()
      }
    })

    return {
      reconciled: true,
      adjustmentApplied: false,
      discrepancyFound: false,
      finalStatus: InvoiceStatus.PAID,
      actions: ['overpayment_approved', 'marked_as_paid'],
      auditTrail: []
    }
  }

  // For larger overpayments, create credit note or mark for refund
  await prisma.activities.create({
    data: {
      id: crypto.randomUUID(),
      companyId: authContext.user.companyId,
      userId: authContext.user.id,
      type: 'overpayment_approved',
      description: `Overpayment of ${formatUAECurrency(overpaymentAmount, reconciliation.currency)} approved for refund processing`,
      metadata: {
        invoiceId: reconciliation.invoiceId,
        overpaymentAmount,
        currency: reconciliation.currency,
        approvedBy: authContext.user.id,
        requiresRefund: true
      }
    }
  })

  await prisma.invoices.update({
    where: { id: reconciliation.invoiceId },
    data: { status: InvoiceStatus.PAID }
  })

  return {
    reconciled: true,
    adjustmentApplied: false,
    discrepancyFound: true,
    discrepancyDetails: {
      type: 'overpayment',
      amount: overpaymentAmount,
      tolerance: 0.02,
      requiresAction: true
    },
    finalStatus: InvoiceStatus.PAID,
    actions: ['overpayment_approved', 'refund_required', 'marked_as_paid'],
    auditTrail: []
  }
}