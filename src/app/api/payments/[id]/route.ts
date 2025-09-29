/**
 * Individual Payment Management API
 * Handles operations on specific payment records
 * 
 * Features:
 * - Get payment details with invoice context
 * - Update payment information
 * - Delete payments with automatic status recalculation
 * - UAE business compliance tracking
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError, ValidationError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { validateRequestBody } from '@/lib/validations'
import { invoiceStatusService } from '@/lib/services/invoice-status-service'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus, PaymentMethod } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { z } from 'zod'

// Update payment schema
const updatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive').multipleOf(0.01).optional(),
  paymentDate: z.coerce.date().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
})

/**
 * GET /api/payments/[id]
 * Get payment details with full invoice context
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    const { id } = await params

    // Fetch payment with invoice details and company isolation
    const payment = await prisma.payments.findUnique({
      where: { id },
      include: {
        invoices: {
          include: {
            companies: {
              select: { id: true, name: true }
            },
            customers: {
              select: { name: true, email: true }
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
            }
          }
        }
      }
    })

    if (!payment) {
      throw new NotFoundError('Payment')
    }

    // Verify company access
    if (payment.invoices.companies.id !== authContext.user.companiesId) {
      throw new NotFoundError('Payment')
    }

    // Calculate payment context
    const invoice = payment.invoices
    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum.plus(p.amount), new Decimal(0)
    )
    const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
    const remainingAmount = invoiceTotal.minus(totalPaid)

    return successResponse({
      payment: {
        id: payment.id,
        amount: payment.amount,
        formattedAmount: formatUAECurrency(new Decimal(payment.amount), invoice.currency),
        paymentDate: payment.paymentDate,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        createdAt: payment.createdAt
      },
      invoice: {
        id: invoice.id,
        number: invoice.number,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        totalAmount: invoice.totalAmount || invoice.amount,
        formattedTotalAmount: formatUAECurrency(invoiceTotal, invoice.currency),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate,
        company: invoice.companies.name
      },
      paymentContext: {
        totalPaid: totalPaid.toNumber(),
        formattedTotalPaid: formatUAECurrency(totalPaid, invoice.currency),
        remainingAmount: Math.max(0, remainingAmount.toNumber()),
        formattedRemainingAmount: formatUAECurrency(new Decimal(Math.max(0, remainingAmount.toNumber())), invoice.currency),
        isFullyPaid: remainingAmount.lessThanOrEqualTo(0.01),
        paymentCount: invoice.payments.length,
        paymentRank: invoice.payments.findIndex(p => p.id === payment.id) + 1
      },
      allPayments: invoice.payments.map(p => ({
        id: p.id,
        amount: p.amount,
        formattedAmount: formatUAECurrency(new Decimal(p.amount), invoice.currency),
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        isCurrentPayment: p.id === payment.id
      }))
    }, 'Payment details retrieved successfully')

  } catch (error) {
    logError('GET /api/payments/[id]', error, {
      paymentId: params.id,
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}

/**
 * PATCH /api/payments/[id]
 * Update payment information with automatic status recalculation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to update payments')
    }

    const { id } = await params
    const updateData = await validateRequestBody(request, updatePaymentSchema)

    // Process update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current payment with invoice
      const currentPayment = await tx.payments.findUnique({
        where: { id },
        include: {
          invoices: {
            include: {
              companies: { select: { id: true } },
              payments: { select: { id: true, amount: true } }
            }
          }
        }
      })

      if (!currentPayment) {
        throw new NotFoundError('Payment')
      }

      // Verify company access
      if (currentPayment.invoices.companies.id !== authContext.user.companiesId) {
        throw new NotFoundError('Payment')
      }

      const invoice = currentPayment.invoices

      // 2. Validate update if amount is changing
      if (updateData.amount && updateData.amount !== currentPayment.amount.toNumber()) {
        // Calculate new total payments
        const otherPayments = invoice.payments
          .filter(p => p.id !== id)
          .reduce((sum, p) => sum.plus(p.amount), new Decimal(0))
        const newTotal = otherPayments.plus(updateData.amount)
        const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)

        // Check for overpayment
        if (newTotal.greaterThan(invoiceTotal.times(1.1))) {
          throw new ValidationError(
            `Updated payment would result in overpayment. Invoice total: ${formatUAECurrency(invoiceTotal, invoice.currency)}, New payment total: ${formatUAECurrency(newTotal, invoice.currency)}`
          )
        }
      }

      // 3. Update payment
      const updatedPayment = await tx.payments.update({
        where: { id },
        data: updateData
      })

      // 4. Recalculate invoice payment status
      const allPayments = await tx.payments.findMany({
        where: { invoiceId: invoice.id },
        select: { amount: true }
      })

      const totalPaid = allPayments.reduce(
        (sum, p) => sum.plus(p.amount), new Decimal(0)
      )
      const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
      const remainingAmount = invoiceTotal.minus(totalPaid)

      // 5. Update invoice status if necessary
      let statusUpdateResult = null
      const shouldBePaid = remainingAmount.lessThanOrEqualTo(0.01)
      const shouldBePartial = totalPaid.greaterThan(0) && totalPaid.lessThan(invoiceTotal.times(0.99))

      if (shouldBePaid && invoice.status !== InvoiceStatus.PAID) {
        // Update to PAID
        statusUpdateResult = await invoiceStatusService.updateInvoiceStatus(
          invoice.id,
          InvoiceStatus.PAID,
          {
            userId: authContext.user.id,
            userRole: authContext.user.role,
            companyId: authContext.user.companiesId,
            reason: `Payment updated - total now ${formatUAECurrency(totalPaid, invoice.currency)}`,
            notes: `Payment ${id} updated, invoice now fully paid`
          }
        )
      } else if (!shouldBePaid && invoice.status === InvoiceStatus.PAID && totalPaid.greaterThan(0)) {
        // Revert from PAID to previous status
        const targetStatus = invoice.dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT
        statusUpdateResult = await invoiceStatusService.updateInvoiceStatus(
          invoice.id,
          targetStatus,
          {
            userId: authContext.user.id,
            userRole: authContext.user.role,
            companyId: authContext.user.companiesId,
            reason: `Payment updated - amount reduced, invoice no longer fully paid`,
            notes: `Payment ${id} updated, remaining balance: ${formatUAECurrency(remainingAmount, invoice.currency)}`
          }
        )
      }

      // 6. Log update activity
      await tx.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companiesId,
          userId: authContext.user.id,
          type: 'payment_updated',
          description: `Payment ${id} updated for invoice ${invoice.number}`,
          metadata: {
            paymentId: id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            previousAmount: currentPayment.amount,
            newAmount: updatedPayment.amount,
            updatedFields: Object.keys(updateData),
            totalPaid: totalPaid.toNumber(),
            remainingAmount: remainingAmount.toNumber(),
            statusUpdate: statusUpdateResult ? {
              from: statusUpdateResult.oldStatus,
              to: statusUpdateResult.newStatus
            } : null
          }
        }
      })

      return {
        payment: updatedPayment,
        invoice,
        statusUpdate: statusUpdateResult,
        paymentSummary: {
          totalPaid: totalPaid.toNumber(),
          remainingAmount: Math.max(0, remainingAmount.toNumber()),
          isFullyPaid: shouldBePaid
        }
      }
    })

    return successResponse({
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        formattedAmount: formatUAECurrency(new Decimal(result.payment.amount), result.invoice.currency),
        paymentDate: result.payment.paymentDate,
        method: result.payment.method,
        reference: result.payment.reference,
        notes: result.payment.notes
      },
      paymentSummary: {
        ...result.paymentSummary,
        formattedTotalPaid: formatUAECurrency(new Decimal(result.paymentSummary.totalPaid), result.invoice.currency),
        formattedRemainingAmount: formatUAECurrency(new Decimal(result.paymentSummary.remainingAmount), result.invoice.currency)
      },
      statusUpdate: result.statusUpdate ? {
        from: result.statusUpdate.oldStatus,
        to: result.statusUpdate.newStatus,
        reason: result.statusUpdate.reason
      } : null,
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
        currentStatus: result.statusUpdate?.newStatus || result.invoice.status
      }
    }, 'Payment updated successfully')

  } catch (error) {
    logError('PATCH /api/payments/[id]', error, {
      paymentId: params.id,
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}

/**
 * DELETE /api/payments/[id]
 * Delete payment with automatic invoice status recalculation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to delete payments')
    }

    const { id } = await params

    // Process deletion in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch payment with invoice details
      const payment = await tx.payments.findUnique({
        where: { id },
        include: {
          invoices: {
            include: {
              companies: { select: { id: true } },
              payments: { select: { id: true, amount: true } }
            }
          }
        }
      })

      if (!payment) {
        throw new NotFoundError('Payment')
      }

      // Verify company access
      if (payment.invoices.companies.id !== authContext.user.companiesId) {
        throw new NotFoundError('Payment')
      }

      const invoice = payment.invoices

      // 2. Calculate new payment totals after deletion
      const remainingPayments = invoice.payments
        .filter(p => p.id !== id)
        .reduce((sum, p) => sum.plus(p.amount), new Decimal(0))
      const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
      const newRemainingAmount = invoiceTotal.minus(remainingPayments)

      // 3. Delete the payment
      await tx.payments.delete({ where: { id } })

      // 4. Update invoice status if necessary
      let statusUpdateResult = null
      if (invoice.status === InvoiceStatus.PAID && newRemainingAmount.greaterThan(0.01)) {
        // Revert from PAID status
        const targetStatus = invoice.dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT
        statusUpdateResult = await invoiceStatusService.updateInvoiceStatus(
          invoice.id,
          targetStatus,
          {
            userId: authContext.user.id,
            userRole: authContext.user.role,
            companyId: authContext.user.companiesId,
            reason: `Payment deleted - invoice no longer fully paid`,
            notes: `Payment ${id} (${formatUAECurrency(new Decimal(payment.amount), invoice.currency)}) deleted. Outstanding: ${formatUAECurrency(newRemainingAmount, invoice.currency)}`
          }
        )
      }

      // 5. Log deletion activity
      await tx.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companiesId,
          userId: authContext.user.id,
          type: 'payment_deleted',
          description: `Payment deleted from invoice ${invoice.number}`,
          metadata: {
            deletedPaymentId: id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            deletedAmount: payment.amount,
            deletedMethod: payment.method,
            deletedReference: payment.reference,
            newTotalPaid: remainingPayments.toNumber(),
            newRemainingAmount: newRemainingAmount.toNumber(),
            statusUpdate: statusUpdateResult ? {
              from: statusUpdateResult.oldStatus,
              to: statusUpdateResult.newStatus
            } : null,
            deletionReason: 'Manual deletion by user'
          }
        }
      })

      return {
        deletedPayment: payment,
        invoice,
        statusUpdate: statusUpdateResult,
        newPaymentSummary: {
          totalPaid: remainingPayments.toNumber(),
          remainingAmount: newRemainingAmount.toNumber(),
          isFullyPaid: newRemainingAmount.lessThanOrEqualTo(0.01),
          paymentCount: invoice.payments.length - 1
        }
      }
    })

    return successResponse({
      deleted: true,
      paymentId: id,
      deletedAmount: result.deletedPayment.amount,
      formattedDeletedAmount: formatUAECurrency(new Decimal(result.deletedPayment.amount), result.invoice.currency),
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
        previousStatus: result.invoice.status,
        newStatus: result.statusUpdate?.newStatus || result.invoice.status
      },
      newPaymentSummary: {
        ...result.newPaymentSummary,
        formattedTotalPaid: formatUAECurrency(new Decimal(result.newPaymentSummary.totalPaid), result.invoice.currency),
        formattedRemainingAmount: formatUAECurrency(new Decimal(result.newPaymentSummary.remainingAmount), result.invoice.currency)
      },
      statusUpdate: result.statusUpdate ? {
        automaticUpdate: true,
        from: result.statusUpdate.oldStatus,
        to: result.statusUpdate.newStatus,
        reason: result.statusUpdate.reason
      } : null
    }, `Payment of ${formatUAECurrency(new Decimal(result.deletedPayment.amount), result.invoice.currency)} deleted successfully`)

  } catch (error) {
    logError('DELETE /api/payments/[id]', error, {
      paymentId: params.id,
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}