/**
 * Payment Reconciliation API
 * Integrates Stripe payments with existing reconciliation system
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { paymentReconciliationService } from '@/lib/services/payment-reconciliation-service'
import { retrievePaymentIntent } from '@/lib/stripe'
import { PaymentMethod } from '@prisma/client'

const ReconcilePaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
  invoiceId: z.string().min(1),
})

const ManualPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.string().optional(),
})

// Reconcile Stripe payment with invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { paymentIntentId, invoiceId } = ReconcilePaymentSchema.parse(body)

    // Retrieve payment intent from Stripe
    const paymentIntent = await retrievePaymentIntent(paymentIntentId)

    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'Payment intent not found' },
        { status: 404 }
      )
    }

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment intent status is ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    // Convert Stripe payment to our system format
    const paymentAmount = paymentIntent.amount / 100 // Convert from cents
    const paymentDate = new Date(paymentIntent.created * 1000)

    // Record payment using our reconciliation service
    const result = await paymentReconciliationService.recordPayment(
      invoiceId,
      {
        amount: paymentAmount,
        paymentDate,
        method: PaymentMethod.STRIPE_CARD,
        reference: paymentIntent.id,
        notes: `Stripe payment - ${paymentIntent.charges.data[0]?.id || paymentIntent.id}`,
      },
      {
        userId: session.user.id,
        userRole: session.user.role,
        companyId: session.user.companyId,
        validateBusinessRules: true,
        autoUpdateInvoiceStatus: true,
        notifyCustomer: true,
      },
      {
        allowOverpayment: true, // Allow small overpayments for Stripe
        overpaymentTolerancePercent: 2.0,
        validateBusinessHours: false, // Stripe payments can happen anytime
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        paymentId: result.payment.id,
        reconciliation: {
          invoiceNumber: result.reconciliation.invoiceNumber,
          paymentStatus: result.reconciliation.paymentStatus,
          totalPaid: result.reconciliation.totalPaid.toNumber(),
          remainingAmount: result.reconciliation.remainingAmount.toNumber(),
          isFullyPaid: result.reconciliation.isFullyPaid,
          isOverpaid: result.reconciliation.isOverpaid,
          formattedAmounts: result.reconciliation.formattedAmounts,
        },
        statusUpdated: !!result.statusUpdateResult,
      },
    })

  } catch (error) {
    console.error('Payment reconciliation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Payment reconciliation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Manual payment recording
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const paymentData = ManualPaymentSchema.parse(body)

    // Record manual payment
    const result = await paymentReconciliationService.recordPayment(
      paymentData.invoiceId,
      {
        amount: paymentData.amount,
        paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
        method: paymentData.method,
        reference: paymentData.reference,
        notes: paymentData.notes,
      },
      {
        userId: session.user.id,
        userRole: session.user.role,
        companyId: session.user.companyId,
        validateBusinessRules: true,
        autoUpdateInvoiceStatus: true,
        notifyCustomer: true,
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        paymentId: result.payment.id,
        reconciliation: {
          invoiceNumber: result.reconciliation.invoiceNumber,
          paymentStatus: result.reconciliation.paymentStatus,
          totalPaid: result.reconciliation.totalPaid.toNumber(),
          remainingAmount: result.reconciliation.remainingAmount.toNumber(),
          isFullyPaid: result.reconciliation.isFullyPaid,
          isOverpaid: result.reconciliation.isOverpaid,
          formattedAmounts: result.reconciliation.formattedAmounts,
        },
        statusUpdated: !!result.statusUpdateResult,
      },
    })

  } catch (error) {
    console.error('Manual payment recording error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Payment recording failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get payment reconciliation status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoice_id')

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID required' },
        { status: 400 }
      )
    }

    const reconciliation = await paymentReconciliationService.getInvoiceReconciliation(
      invoiceId,
      session.user.companyId
    )

    return NextResponse.json({
      success: true,
      data: {
        reconciliation: {
          invoiceId: reconciliation.invoiceId,
          invoiceNumber: reconciliation.invoiceNumber,
          paymentStatus: reconciliation.paymentStatus,
          totalPaid: reconciliation.totalPaid.toNumber(),
          remainingAmount: reconciliation.remainingAmount.toNumber(),
          isFullyPaid: reconciliation.isFullyPaid,
          isOverpaid: reconciliation.isOverpaid,
          formattedAmounts: reconciliation.formattedAmounts,
        },
        payments: reconciliation.payments,
        paymentTimeline: reconciliation.paymentTimeline,
      },
    })

  } catch (error) {
    console.error('Get reconciliation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get reconciliation status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}