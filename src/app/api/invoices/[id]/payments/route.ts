import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError, ValidationError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { UserRole, PaymentMethod, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { formatUAECurrency, isUAEBusinessHours } from '@/lib/vat-calculator'
import { invoiceStatusService } from '@/lib/services/invoice-status-service'
import { z } from 'zod'

// Payment recording schema with UAE business validation
const paymentRecordingSchema = z.object({
  amount: z.number().positive('Payment amount must be positive'),
  paymentDate: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid payment date'),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  notifyCustomer: z.boolean().default(false),
  autoUpdateStatus: z.boolean().default(true),
  validateBusinessHours: z.boolean().default(true)
})

const paymentUpdateSchema = z.object({
  amount: z.number().positive('Payment amount must be positive').optional(),
  paymentDate: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid payment date').optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
})

interface PaymentReconciliationResult {
  invoiceTotal: number
  totalPaid: number
  remainingAmount: number
  isFullyPaid: boolean
  isOverpaid: boolean
  overpaymentAmount: number
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERPAID'
  suggestedInvoiceStatus: InvoiceStatus
}

// POST /api/invoices/[id]/payments - Record new payment for invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to record payments')
    }

    const { id: invoiceId } = params
    const body = await request.json()
    const paymentData = paymentRecordingSchema.parse(body)

    // Validate payment date and UAE business hours if required
    const paymentDate = new Date(paymentData.paymentDate)
    if (paymentData.validateBusinessHours && !isUAEBusinessHours(paymentDate)) {
      throw new ValidationError('Payment recording outside UAE business hours requires approval')
    }

    // Validate payment date is not in the future
    if (paymentDate > new Date()) {
      throw new ValidationError('Payment date cannot be in the future')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch invoice with company isolation
      const invoice = await tx.invoice.findUnique({
        where: { 
          id: invoiceId,
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
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      if (!invoice) {
        throw new NotFoundError('Invoice not found or access denied')
      }

      // Validate payment amount against invoice
      const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
      const currentPaid = invoice.payments.reduce((sum, payment) => 
        sum.plus(payment.amount), new Decimal(0)
      )
      const newPaymentAmount = new Decimal(paymentData.amount)
      const newTotalPaid = currentPaid.plus(newPaymentAmount)

      // Check for overpayment (allow small tolerance for rounding)
      if (newTotalPaid.greaterThan(invoiceTotal.times(1.01))) {
        throw new ValidationError(
          `Payment amount would result in overpayment. ` +
          `Invoice total: ${formatUAECurrency(invoiceTotal, invoice.currency)}, ` +
          `Already paid: ${formatUAECurrency(currentPaid, invoice.currency)}, ` +
          `Remaining: ${formatUAECurrency(invoiceTotal.minus(currentPaid), invoice.currency)}`
        )
      }

      // Validate payment method and reference
      if (paymentData.method === PaymentMethod.BANK_TRANSFER && !paymentData.reference) {
        throw new ValidationError('Bank transfer payments require a transaction reference')
      }

      if (paymentData.method === PaymentMethod.CHEQUE && !paymentData.reference) {
        throw new ValidationError('Cheque payments require a cheque number reference')
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          amount: newPaymentAmount.toNumber(),
          paymentDate: paymentDate,
          method: paymentData.method,
          reference: paymentData.reference,
          notes: paymentData.notes
        }
      })

      // Calculate reconciliation
      const reconciliation = calculatePaymentReconciliation(
        invoiceTotal.toNumber(),
        newTotalPaid.toNumber()
      )

      // Auto-update invoice status if enabled
      let statusUpdateResult = null
      if (paymentData.autoUpdateStatus && reconciliation.isFullyPaid) {
        try {
          statusUpdateResult = await invoiceStatusService.updateInvoiceStatus(
            invoice.id,
            InvoiceStatus.PAID,
            {
              userId: authContext.user.id,
              userRole: authContext.user.role,
              companyId: authContext.user.companyId,
              reason: `Automatic status update - payment received (${formatUAECurrency(newPaymentAmount, invoice.currency)})`,
              notes: `Payment method: ${paymentData.method}${paymentData.reference ? `, Reference: ${paymentData.reference}` : ''}`,
              notifyCustomer: paymentData.notifyCustomer,
              userAgent: request.headers.get('user-agent') || undefined,
              ipAddress: request.headers.get('x-forwarded-for') || undefined
            }
          )
        } catch (statusError) {
          // Log but don't fail the payment recording
          console.warn('Failed to auto-update invoice status:', statusError)
        }
      }

      // Log payment activity for audit trail
      await tx.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'payment_recorded',
          description: `Recorded ${formatUAECurrency(newPaymentAmount, invoice.currency)} payment for invoice ${invoice.number}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            paymentId: payment.id,
            amount: newPaymentAmount.toNumber(),
            method: paymentData.method,
            reference: paymentData.reference,
            previousPaidAmount: currentPaid.toNumber(),
            newTotalPaid: newTotalPaid.toNumber(),
            remainingAmount: reconciliation.remainingAmount,
            paymentStatus: reconciliation.paymentStatus,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            currency: invoice.currency,
            paymentDate: paymentDate.toISOString(),
            userAgent: request.headers.get('user-agent'),
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            autoStatusUpdate: !!statusUpdateResult,
            newInvoiceStatus: statusUpdateResult?.newStatus
          }
        }
      })

      // Schedule customer notification if requested
      if (paymentData.notifyCustomer) {
        await schedulePaymentNotification(tx, invoice, payment, authContext.user.companyId)
      }

      // Fetch updated invoice for response
      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              method: true,
              reference: true,
              notes: true,
              createdAt: true
            },
            orderBy: { paymentDate: 'desc' }
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      return {
        payment,
        updatedInvoice,
        reconciliation,
        statusUpdateResult
      }
    })

    return successResponse({
      payment: {
        ...result.payment,
        formattedAmount: formatUAECurrency(result.payment.amount, result.updatedInvoice.currency)
      },
      invoice: {
        id: result.updatedInvoice.id,
        number: result.updatedInvoice.number,
        status: result.updatedInvoice.status,
        customerName: result.updatedInvoice.customerName,
        totalAmount: result.updatedInvoice.totalAmount || result.updatedInvoice.amount,
        payments: result.updatedInvoice.payments
      },
      reconciliation: {
        ...result.reconciliation,
        formattedAmounts: {
          invoiceTotal: formatUAECurrency(result.reconciliation.invoiceTotal, result.updatedInvoice.currency),
          totalPaid: formatUAECurrency(result.reconciliation.totalPaid, result.updatedInvoice.currency),
          remainingAmount: formatUAECurrency(result.reconciliation.remainingAmount, result.updatedInvoice.currency),
          overpaymentAmount: formatUAECurrency(result.reconciliation.overpaymentAmount, result.updatedInvoice.currency)
        }
      },
      statusUpdate: result.statusUpdateResult ? {
        updated: true,
        oldStatus: result.statusUpdateResult.oldStatus,
        newStatus: result.statusUpdateResult.newStatus,
        reason: result.statusUpdateResult.reason
      } : { updated: false },
      auditTrail: {
        paymentRecorded: true,
        activityLogged: true,
        customerNotified: paymentData.notifyCustomer
      }
    }, `Payment of ${formatUAECurrency(result.payment.amount, result.updatedInvoice.currency)} recorded successfully`)

  } catch (error) {
    logError('POST /api/invoices/[id]/payments', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: (await params).id
    })
    return handleApiError(error)
  }
}

// GET /api/invoices/[id]/payments - Get payment history and reconciliation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    const { id: invoiceId } = params

    // Fetch invoice with payments and company isolation
    const invoice = await prisma.invoice.findUnique({
      where: { 
        id: invoiceId,
        companyId: authContext.user.companyId // Enforce company isolation
      },
      include: {
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            reference: true,
            notes: true,
            createdAt: true
          },
          orderBy: { paymentDate: 'desc' }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!invoice) {
      throw new NotFoundError('Invoice not found or access denied')
    }

    // Calculate payment reconciliation
    const invoiceTotal = invoice.totalAmount || invoice.amount
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const reconciliation = calculatePaymentReconciliation(invoiceTotal, totalPaid)

    // Get payment activity history
    const paymentActivities = await prisma.activity.findMany({
      where: {
        companyId: authContext.user.companyId,
        type: 'payment_recorded',
        metadata: {
          path: ['invoiceId'],
          equals: invoiceId
        }
      },
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return successResponse({
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        totalAmount: invoiceTotal,
        currency: invoice.currency,
        dueDate: invoice.dueDate
      },
      payments: invoice.payments.map(payment => ({
        ...payment,
        formattedAmount: formatUAECurrency(payment.amount, invoice.currency)
      })),
      reconciliation: {
        ...reconciliation,
        formattedAmounts: {
          invoiceTotal: formatUAECurrency(reconciliation.invoiceTotal, invoice.currency),
          totalPaid: formatUAECurrency(reconciliation.totalPaid, invoice.currency),
          remainingAmount: formatUAECurrency(reconciliation.remainingAmount, invoice.currency),
          overpaymentAmount: formatUAECurrency(reconciliation.overpaymentAmount, invoice.currency)
        }
      },
      paymentHistory: paymentActivities.map(activity => ({
        id: activity.id,
        amount: (activity.metadata as any).amount as number,
        method: (activity.metadata as any).method as PaymentMethod,
        reference: (activity.metadata as any).reference as string,
        recordedAt: activity.createdAt,
        recordedBy: activity.user?.name || 'System',
        previousTotal: (activity.metadata as any).previousPaidAmount as number,
        newTotal: (activity.metadata as any).newTotalPaid as number,
        formattedAmount: formatUAECurrency((activity.metadata as any).amount as number, invoice.currency)
      })),
      summary: {
        paymentCount: invoice.payments.length,
        averagePaymentAmount: invoice.payments.length > 0 
          ? totalPaid / invoice.payments.length 
          : 0,
        formattedAveragePayment: invoice.payments.length > 0 
          ? formatUAECurrency(totalPaid / invoice.payments.length, invoice.currency)
          : formatUAECurrency(0, invoice.currency),
        daysSinceLastPayment: invoice.payments.length > 0
          ? Math.ceil((new Date().getTime() - new Date(invoice.payments[0].paymentDate).getTime()) / (1000 * 60 * 60 * 24))
          : null
      }
    }, 'Payment information retrieved successfully')

  } catch (error) {
    logError('GET /api/invoices/[id]/payments', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: (await params).id
    })
    return handleApiError(error)
  }
}

// Helper function to calculate payment reconciliation
function calculatePaymentReconciliation(invoiceTotal: number, totalPaid: number): PaymentReconciliationResult {
  const remainingAmount = invoiceTotal - totalPaid
  const isFullyPaid = remainingAmount <= 0.01 // Allow for rounding tolerance
  const isOverpaid = remainingAmount < -0.01
  const overpaymentAmount = isOverpaid ? Math.abs(remainingAmount) : 0

  let paymentStatus: PaymentReconciliationResult['paymentStatus']
  let suggestedInvoiceStatus: InvoiceStatus

  if (isOverpaid) {
    paymentStatus = 'OVERPAID'
    suggestedInvoiceStatus = InvoiceStatus.PAID // Still considered paid
  } else if (isFullyPaid) {
    paymentStatus = 'FULLY_PAID'
    suggestedInvoiceStatus = InvoiceStatus.PAID
  } else if (totalPaid > 0) {
    paymentStatus = 'PARTIALLY_PAID'
    suggestedInvoiceStatus = InvoiceStatus.SENT // Keep existing status for partial payments
  } else {
    paymentStatus = 'UNPAID'
    suggestedInvoiceStatus = InvoiceStatus.SENT
  }

  return {
    invoiceTotal,
    totalPaid,
    remainingAmount: Math.max(0, remainingAmount),
    isFullyPaid,
    isOverpaid,
    overpaymentAmount,
    paymentStatus,
    suggestedInvoiceStatus
  }
}

// Helper function to schedule payment notification
async function schedulePaymentNotification(
  tx: any,
  invoice: any,
  payment: any,
  companyId: string
) {
  // Calculate next business hour for sending notifications
  const sendTime = getNextBusinessHourSendTime()
  
  await tx.emailLog.create({
    data: {
      id: crypto.randomUUID(),
      companyId,
      invoiceId: invoice.id,
      customerId: invoice.customer?.id,
      recipientEmail: invoice.customerEmail,
      recipientName: invoice.customerName,
      subject: `Payment Received - Invoice ${invoice.number}`,
      content: `Payment confirmation for invoice ${invoice.number}`,
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

// Helper function to calculate next business hour send time (UAE timezone)
function getNextBusinessHourSendTime(): Date {
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