import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { invoiceStatusSchema, validateRequestBody } from '@/lib/validations'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { invoiceStatusService } from '@/lib/services/invoice-status-service'
import { auditTrailService, AuditEventType } from '@/lib/services/audit-trail-service'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'

// PATCH /api/invoices/[id]/status - Update invoice status with enhanced business rules
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])

    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to update invoice status')
    }

    const { id } = await params
    const { status, reason, notes, notifyCustomer, forceOverride } = await validateRequestBody(request, invoiceStatusSchema)

    // Use the comprehensive invoice status service
    const result = await invoiceStatusService.updateInvoiceStatus(id, status, {
      userId: authContext.user.id,
      userRole: authContext.user.role,
      companyId: authContext.user.companyId,
      reason,
      notes,
      notifyCustomer,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      forceOverride
    })

    if (!result.success) {
      throw new Error('Failed to update invoice status')
    }

    // Log comprehensive audit trail for status change
    await auditTrailService.logInvoiceEvent(
      AuditEventType.INVOICE_STATUS_CHANGED,
      { ...result.auditTrail.businessContext, id, number: result.auditTrail.invoiceNumber },
      {
        userId: authContext.user.id,
        userRole: authContext.user.role,
        companyId: authContext.user.companyId,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        apiEndpoint: '/api/invoices/[id]/status',
        requestId: crypto.randomUUID()
      },
      {
        before: { status: result.oldStatus },
        after: { status: result.newStatus },
        changedFields: ['status']
      },
      {
        reason,
        notes,
        notifyCustomer,
        forceOverride,
        complianceFlags: result.auditTrail.metadata.complianceFlags
      }
    )

    // Fetch the updated invoice with full details for response
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            email: true,
            phone: true,
            paymentTerms: true
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            trn: true,
            defaultVatRate: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            reference: true
          },
          orderBy: { paymentDate: 'desc' }
        },
        invoiceItems: {
          select: {
            id: true,
            description: true,
            descriptionAr: true,
            quantity: true,
            unitPrice: true,
            total: true,
            vatRate: true,
            vatAmount: true,
            totalWithVat: true,
            taxCategory: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!updatedInvoice) {
      throw new NotFoundError('Invoice not found after update')
    }

    // Calculate business insights
    const paidAmount = updatedInvoice.payments.reduce((sum, payment) => 
      sum.plus(payment.amount), new Decimal(0)
    )
    const remainingAmount = new Decimal(updatedInvoice.totalAmount || updatedInvoice.amount).minus(paidAmount)
    const isOverdue = updatedInvoice.dueDate < new Date() && 
      ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(updatedInvoice.status)
    
    // Enhanced response with comprehensive UAE business insights
    return successResponse({
      ...updatedInvoice,
      // Status change summary with audit trail
      statusChange: {
        from: result.oldStatus,
        to: result.newStatus,
        reason: result.reason,
        notes: notes,
        changedAt: result.auditTrail.timestamp.toISOString(),
        changedBy: authContext.user.name,
        complianceFlags: result.auditTrail.metadata.complianceFlags,
        automatedChange: result.auditTrail.metadata.automatedChange
      },
      // Computed UAE business fields
      paidAmount: paidAmount.toNumber(),
      remainingAmount: remainingAmount.toNumber(),
      isOverdue,
      daysPastDue: isOverdue ? Math.ceil((new Date().getTime() - updatedInvoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      isFullyPaid: remainingAmount.lessThanOrEqualTo(0),
      paymentStatus: remainingAmount.lessThanOrEqualTo(0) ? 'FULLY_PAID' : 
                    paidAmount.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID',
      // Formatted amounts for UAE display
      formattedAmounts: {
        totalAmount: formatUAECurrency(updatedInvoice.totalAmount || updatedInvoice.amount, updatedInvoice.currency),
        paidAmount: formatUAECurrency(paidAmount, updatedInvoice.currency),
        remainingAmount: formatUAECurrency(remainingAmount, updatedInvoice.currency)
      },
      // Enhanced business insights
      businessContext: result.auditTrail.businessContext,
      // Validation warnings and compliance notes
      validationWarnings: result.validationWarnings,
      businessRuleNotes: result.businessRuleNotes,
      // Next suggested actions based on new status and business rules
      suggestedActions: getSuggestedActions(updatedInvoice.status, isOverdue, remainingAmount.toNumber()),
      customerNotified: result.requiresNotification
    }, `Invoice status successfully updated from ${result.oldStatus} to ${result.newStatus}`)

  } catch (error) {
    logError('PATCH /api/invoices/[id]/status', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: (await params).id
    })
    return handleApiError(error)
  }
}

// GET /api/invoices/[id]/status - Get invoice status insights and history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    const { id } = await params

    // Get invoice with full details
    const invoice = await prisma.invoice.findUnique({
      where: { 
        id,
        companyId: authContext.user.companyId // Enforce company isolation
      },
      include: {
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            reference: true
          },
          orderBy: { paymentDate: 'desc' }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            paymentTerms: true
          }
        }
      }
    })

    if (!invoice) {
      throw new NotFoundError('Invoice')
    }

    // Get status change history from audit trail
    const statusHistory = await prisma.activity.findMany({
      where: {
        companyId: authContext.user.companyId,
        type: 'invoice_status_updated',
        metadata: {
          path: ['invoiceId'],
          equals: id
        }
      },
      include: {
        users: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Last 20 status changes
    })

    // Calculate business context
    const paidAmount = invoice.payments.reduce((sum, payment) => 
      sum.plus(payment.amount), new Decimal(0)
    )
    const remainingAmount = new Decimal(invoice.totalAmount || invoice.amount).minus(paidAmount)
    const isOverdue = invoice.dueDate < new Date() && 
      ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)

    // Get available status transitions
    const availableTransitions = invoiceStatusService.validateStatusTransition(
      invoice.status, 
      invoice.status, // Same status to get available transitions
      {
        invoice,
        user: { role: authContext.user.role, companyId: authContext.user.companyId }
      }
    )

    return successResponse({
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        totalAmount: invoice.totalAmount || invoice.amount,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
      },
      businessContext: {
        paidAmount: paidAmount.toNumber(),
        remainingAmount: remainingAmount.toNumber(),
        isOverdue,
        daysPastDue: isOverdue ? Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        isFullyPaid: remainingAmount.lessThanOrEqualTo(0),
        paymentStatus: remainingAmount.lessThanOrEqualTo(0) ? 'FULLY_PAID' : 
                      paidAmount.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID',
        paymentCount: invoice.payments.length,
        formattedAmounts: {
          totalAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
          paidAmount: formatUAECurrency(paidAmount, invoice.currency),
          remainingAmount: formatUAECurrency(remainingAmount, invoice.currency)
        }
      },
      statusHistory: statusHistory.map(activity => ({
        id: activity.id,
        oldStatus: activity.metadata.previousStatus as InvoiceStatus,
        newStatus: activity.metadata.newStatus as InvoiceStatus,
        reason: activity.metadata.reason as string,
        notes: activity.metadata.notes as string,
        changedAt: activity.createdAt,
        changedBy: activity.users?.name || 'System',
        automatedChange: activity.metadata.automatedChange as boolean,
        complianceFlags: activity.metadata.complianceFlags as string[]
      })),
      availableActions: getSuggestedActions(invoice.status, isOverdue, remainingAmount.toNumber()),
      complianceInfo: {
        auditTrailCompliant: statusHistory.length > 0,
        trnCompliant: !!invoice.trnNumber,
        uaeBusinessRulesApplied: true
      }
    }, 'Invoice status information retrieved successfully')

  } catch (error) {
    logError('GET /api/invoices/[id]/status', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: (await params).id
    })
    return handleApiError(error)
  }
}

// Helper function to get suggested actions based on status and business context

// Helper function to get suggested actions based on status
function getSuggestedActions(status: InvoiceStatus, isOverdue: boolean, remainingAmount: number): string[] {
  const actions: string[] = []
  
  switch (status) {
    case InvoiceStatus.DRAFT:
      actions.push('Review invoice details', 'Send to customer')
      break
    case InvoiceStatus.SENT:
      if (isOverdue) {
        actions.push('Send payment reminder', 'Contact customer', 'Consider marking as overdue')
      } else {
        actions.push('Monitor payment status', 'Schedule follow-up reminder')
      }
      break
    case InvoiceStatus.OVERDUE:
      actions.push('Send urgent payment reminder', 'Contact customer directly', 'Consider dispute resolution', 'Evaluate write-off possibility')
      break
    case InvoiceStatus.DISPUTED:
      actions.push('Review dispute details', 'Contact customer for resolution', 'Provide supporting documentation')
      break
    case InvoiceStatus.PAID:
      if (remainingAmount > 0.01) {
        actions.push('Review partial payment', 'Follow up on remaining balance')
      } else {
        actions.push('Archive invoice', 'Send payment confirmation')
      }
      break
    case InvoiceStatus.WRITTEN_OFF:
      actions.push('Document write-off reason', 'Update accounting records', 'Archive invoice')
      break
  }
  
  return actions
}