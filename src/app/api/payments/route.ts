/**
 * Payment Recording API
 * Comprehensive payment management with automatic invoice status integration
 * 
 * Features:
 * - Payment recording with UAE business validation
 * - Automatic invoice status updates (SENT/OVERDUE → PAID)
 * - Partial payment handling
 * - Multi-currency support (AED, USD, EUR, etc.)
 * - Audit trail and activity logging
 * - UAE business rules enforcement
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { validateRequestBody, createPaymentSchema } from '@/lib/validations'
import { invoiceStatusService } from '@/lib/services/invoice-status-service'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus, PaymentMethod } from '@prisma/client'
import { Decimal } from 'decimal.js'

/**
 * POST /api/payments
 * Record a new payment and automatically update invoice status
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to record payments')
    }

    const paymentData = await validateRequestBody(request, createPaymentSchema)

    // Start transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch invoice with current payments to validate payment
      const invoice = await tx.invoices.findUnique({
        where: { 
          id: paymentData.invoiceId,
          companyId: authContext.user.companyId // Enforce company isolation
        },
        include: {
          payments: {
            select: { amount: true, paymentDate: true, method: true, reference: true }
          },
          customers: {
            select: { name: true, email: true }
          }
        }
      })

      if (!invoice) {
        throw new ValidationError('Invoice not found or access denied')
      }

      // 2. Validate payment business rules
      const paymentValidation = validatePaymentBusinessRules(invoice, paymentData)
      if (!paymentValidation.isValid) {
        throw new ValidationError(paymentValidation.reason || 'Payment validation failed')
      }

      // 3. Create payment record
      const payment = await tx.payments.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: paymentData.invoiceId,
          amount: paymentData.amount,
          paymentDate: new Date(paymentData.paymentDate),
          method: paymentData.method,
          reference: paymentData.reference,
          notes: paymentData.notes,
          createdAt: new Date()
        }
      })

      // 4. Calculate payment status and amounts
      const existingPayments = invoice.payments.reduce(
        (sum, p) => sum.plus(p.amount), new Decimal(0)
      )
      const totalPaid = existingPayments.plus(paymentData.amount)
      const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)
      const remainingAmount = invoiceTotal.minus(totalPaid)

      // 5. Determine if invoice should be marked as PAID
      const shouldMarkPaid = remainingAmount.lessThanOrEqualTo(0.01) // 1 cent tolerance
      const isPartialPayment = totalPaid.greaterThan(0) && totalPaid.lessThan(invoiceTotal.times(0.99))

      let statusUpdateResult = null

      // 6. Automatically update invoice status if fully paid
      if (shouldMarkPaid && invoice.status !== InvoiceStatus.PAID) {
        console.log(`Payment completed invoice ${invoice.number} - updating status to PAID`)
        
        statusUpdateResult = await invoiceStatusService.updateInvoiceStatus(
          invoice.id,
          InvoiceStatus.PAID,
          {
            userId: authContext.user.id,
            userRole: authContext.user.role,
            companyId: authContext.user.companyId,
            reason: `Payment received - ${formatUAECurrency(new Decimal(paymentData.amount), invoice.currency)} via ${paymentData.method}`,
            notes: `Reference: ${paymentData.reference || 'N/A'}. Total paid: ${formatUAECurrency(totalPaid, invoice.currency)}`,
            notifyCustomer: true
          }
        )
      }

      // 7. Log payment activity for audit trail
      await tx.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'payment_recorded',
          description: `Payment of ${formatUAECurrency(new Decimal(paymentData.amount), invoice.currency)} recorded for invoice ${invoice.number}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            paymentId: payment.id,
            amount: paymentData.amount,
            currency: invoice.currency,
            method: paymentData.method,
            reference: paymentData.reference,
            customerEmail: invoice.customerEmail,
            customerName: invoice.customerName,
            totalPaid: totalPaid.toNumber(),
            remainingAmount: remainingAmount.toNumber(),
            isPartialPayment,
            isFullPayment: shouldMarkPaid,
            previousStatus: invoice.status,
            newStatus: statusUpdateResult?.newStatus || invoice.status,
            automaticStatusUpdate: !!statusUpdateResult,
            uaeBusinessContext: {
              businessHours: isUAEBusinessHours(),
              paymentProcessedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }),
              complianceFlags: generatePaymentComplianceFlags(invoice, paymentData)
            }
          }
        }
      })

      return {
        payment,
        invoice,
        statusUpdate: statusUpdateResult,
        paymentSummary: {
          totalPaid: totalPaid.toNumber(),
          remainingAmount: Math.max(0, remainingAmount.toNumber()),
          isPartialPayment,
          isFullyPaid: shouldMarkPaid,
          paymentCount: invoice.payments.length + 1
        }
      }
    })

    // 8. Format response with comprehensive UAE business context
    return successResponse({
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        paymentDate: result.payment.paymentDate,
        method: result.payment.method,
        reference: result.payment.reference,
        notes: result.payment.notes,
        formattedAmount: formatUAECurrency(new Decimal(result.payment.amount), result.invoice.currency)
      },
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
        customerName: result.invoice.customerName,
        customerEmail: result.invoice.customerEmail,
        totalAmount: result.invoice.totalAmount || result.invoice.amount,
        currency: result.invoice.currency,
        previousStatus: result.invoice.status,
        newStatus: result.statusUpdate?.newStatus || result.invoice.status,
        formattedTotalAmount: formatUAECurrency(
          new Decimal(result.invoice.totalAmount || result.invoice.amount), 
          result.invoice.currency
        )
      },
      paymentSummary: {
        ...result.paymentSummary,
        formattedTotalPaid: formatUAECurrency(
          new Decimal(result.paymentSummary.totalPaid), 
          result.invoice.currency
        ),
        formattedRemainingAmount: formatUAECurrency(
          new Decimal(result.paymentSummary.remainingAmount), 
          result.invoice.currency
        )
      },
      statusTransition: result.statusUpdate ? {
        automaticUpdate: true,
        from: result.statusUpdate.oldStatus,
        to: result.statusUpdate.newStatus,
        reason: result.statusUpdate.reason,
        customerNotified: result.statusUpdate.requiresNotification
      } : null,
      businessContext: {
        uaeCompliant: true,
        auditTrailCreated: true,
        processedDuringBusinessHours: isUAEBusinessHours(),
        complianceFlags: generatePaymentComplianceFlags(result.invoice, result.payment)
      },
      nextActions: getPaymentNextActions(result.paymentSummary, result.statusUpdate?.newStatus || result.invoice.status)
    }, `Payment of ${formatUAECurrency(new Decimal(result.payment.amount), result.invoice.currency)} recorded successfully`)

  } catch (error) {
    logError('POST /api/payments', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId'
    })
    return handleApiError(error)
  }
}

/**
 * GET /api/payments
 * Get payment history with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    const { searchParams } = new URL(request.url)
    
    // Extract query parameters
    const invoiceId = searchParams.get('invoiceId')
    const paymentMethod = searchParams.get('method')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const includeInvoiceDetails = searchParams.get('includeInvoiceDetails') === 'true'

    // Build where clause with company isolation
    const whereClause: any = {
      invoices: {
        companyId: authContext.user.companyId
      }
    }

    if (invoiceId) {
      whereClause.invoiceId = invoiceId
    }

    if (paymentMethod && Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      whereClause.method = paymentMethod as PaymentMethod
    }

    if (startDate || endDate) {
      whereClause.paymentDate = {}
      if (startDate) whereClause.paymentDate.gte = new Date(startDate)
      if (endDate) whereClause.paymentDate.lte = new Date(endDate)
    }

    if (minAmount || maxAmount) {
      whereClause.amount = {}
      if (minAmount) whereClause.amount.gte = parseFloat(minAmount)
      if (maxAmount) whereClause.amount.lte = parseFloat(maxAmount)
    }

    // Fetch payments with pagination
    const [payments, totalCount] = await Promise.all([
      prisma.payments.findMany({
        where: whereClause,
        include: {
          invoices: includeInvoiceDetails ? {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerEmail: true,
              totalAmount: true,
              amount: true,
              currency: true,
              status: true,
              dueDate: true
            }
          } : false
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.payments.count({ where: whereClause })
    ])

    // Calculate payment statistics
    const paymentStats = await getPaymentStatistics(authContext.user.companyId, whereClause)

    // Format response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      formattedAmount: formatUAECurrency(
        new Decimal(payment.amount), 
        includeInvoiceDetails && payment.invoices ? payment.invoices.currency : 'AED'
      ),
      paymentDate: payment.paymentDate,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: payment.createdAt,
      invoice: includeInvoiceDetails && payment.invoices ? {
        id: payment.invoices.id,
        number: payment.invoices.number,
        customerName: payment.invoices.customerName,
        customerEmail: payment.invoices.customerEmail,
        totalAmount: payment.invoices.totalAmount || payment.invoices.amount,
        currency: payment.invoices.currency,
        status: payment.invoices.status,
        dueDate: payment.invoices.dueDate
      } : undefined
    }))

    return successResponse({
      payments: formattedPayments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: page * limit < totalCount,
        limit
      },
      statistics: paymentStats,
      filters: {
        invoiceId,
        paymentMethod,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        includeInvoiceDetails
      }
    }, `Retrieved ${payments.length} payments`)

  } catch (error) {
    logError('GET /api/payments', error)
    return handleApiError(error)
  }
}

// Helper Functions

/**
 * Validate payment against UAE business rules
 */
function validatePaymentBusinessRules(invoice: any, paymentData: any): {
  isValid: boolean
  reason?: string
  warningFlags?: string[]
} {
  const warnings: string[] = []

  // 1. Validate payment amount
  if (paymentData.amount <= 0) {
    return { isValid: false, reason: 'Payment amount must be positive' }
  }

  // 2. Check for overpayment
  const existingPayments = invoice.payments.reduce(
    (sum: Decimal, p: any) => sum.plus(p.amount), new Decimal(0)
  )
  const totalAfterPayment = existingPayments.plus(paymentData.amount)
  const invoiceTotal = new Decimal(invoice.totalAmount || invoice.amount)

  if (totalAfterPayment.greaterThan(invoiceTotal.times(1.1))) { // 10% tolerance
    return { 
      isValid: false, 
      reason: `Payment would result in overpayment. Invoice total: ${formatUAECurrency(invoiceTotal, invoice.currency)}, Total payments: ${formatUAECurrency(totalAfterPayment, invoice.currency)}` 
    }
  }

  // 3. Validate payment date
  const paymentDate = new Date(paymentData.paymentDate)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (paymentDate > now) {
    return { isValid: false, reason: 'Payment date cannot be in the future' }
  }

  if (paymentDate < thirtyDaysAgo) {
    warnings.push('Payment date is more than 30 days old')
  }

  // 4. UAE business context validations
  if (paymentData.method === PaymentMethod.CASH && paymentData.amount > 3000) {
    warnings.push('Large cash payment - may require additional documentation for UAE compliance')
  }

  // 5. Reference validation for certain payment methods
  if ([PaymentMethod.BANK_TRANSFER, PaymentMethod.CHEQUE].includes(paymentData.method) && !paymentData.reference) {
    warnings.push('Reference number recommended for bank transfers and cheques')
  }

  return { 
    isValid: true, 
    warningFlags: warnings.length > 0 ? warnings : undefined 
  }
}

/**
 * Check if current time is within UAE business hours
 */
function isUAEBusinessHours(): boolean {
  const now = new Date()
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const day = dubaiTime.getDay()
  const hour = dubaiTime.getHours()

  // UAE business hours: Sunday-Thursday, 8 AM-6 PM
  return [0, 1, 2, 3, 4].includes(day) && hour >= 8 && hour < 18
}

/**
 * Generate compliance flags for payment
 */
function generatePaymentComplianceFlags(invoice: any, payment: any): string[] {
  const flags: string[] = []

  if (invoice.trnNumber) {
    flags.push('TRN_COMPLIANT')
  }

  if (payment.method === PaymentMethod.BANK_TRANSFER) {
    flags.push('BANK_TRANSFER_TRACEABLE')
  }

  if (isUAEBusinessHours()) {
    flags.push('PROCESSED_BUSINESS_HOURS')
  }

  if (payment.reference) {
    flags.push('REFERENCE_PROVIDED')
  }

  return flags
}

/**
 * Get suggested next actions after payment
 */
function getPaymentNextActions(paymentSummary: any, currentStatus: InvoiceStatus): string[] {
  const actions: string[] = []

  if (paymentSummary.isFullyPaid) {
    actions.push('Send payment confirmation to customer')
    actions.push('Archive invoice')
    actions.push('Update accounting records')
  } else if (paymentSummary.isPartialPayment) {
    actions.push('Send partial payment acknowledgment')
    actions.push('Follow up for remaining balance')
    actions.push(`Outstanding: ${paymentSummary.formattedRemainingAmount}`)
  }

  if (currentStatus === InvoiceStatus.OVERDUE && paymentSummary.isFullyPaid) {
    actions.push('Review and clear overdue notifications')
  }

  return actions
}

/**
 * Get payment statistics for the company
 */
async function getPaymentStatistics(companyId: string, baseWhereClause: any) {
  const stats = await prisma.payments.aggregate({
    where: {
      ...baseWhereClause,
      invoices: { companyId }
    },
    _sum: { amount: true },
    _avg: { amount: true },
    _count: { id: true }
  })

  // Get payment method breakdown
  const methodBreakdown = await prisma.payments.groupBy({
    by: ['method'],
    where: {
      ...baseWhereClause,
      invoices: { companyId }
    },
    _sum: { amount: true },
    _count: { id: true }
  })

  return {
    totalAmount: stats._sum.amount || 0,
    averageAmount: stats._avg.amount || 0,
    paymentCount: stats._count.id || 0,
    formattedTotalAmount: formatUAECurrency(new Decimal(stats._sum.amount || 0), 'AED'),
    methodBreakdown: methodBreakdown.map(method => ({
      method: method.method,
      count: method._count.id,
      totalAmount: method._sum.amount || 0,
      formattedAmount: formatUAECurrency(new Decimal(method._sum.amount || 0), 'AED')
    }))
  }
}