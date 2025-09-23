/**
 * Stripe Webhook Handler
 * Processes payment events and updates invoice status
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature, filsToAed } from '@/lib/stripe'
import { sendEmail } from '@/lib/email'
import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      throw new ValidationError('Missing Stripe signature');
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = verifyWebhookSignature(body, signature, WEBHOOK_SECRET)
    } catch (error) {
      throw new ValidationError('Invalid Stripe signature');
    }

    console.log(`Processing webhook event: ${event.type}`)

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.requires_action':
        await handlePaymentRequiresAction(event.data.object as Stripe.PaymentIntent)
        break

      default:
        console.log(`Unhandled webhook event type: ${event.type}`)
    }

    return successResponse({ received: true });

  } catch (error) {
    logError('POST /api/payments/webhook', error, {
      eventType: event?.type || 'unknown',
      eventId: event?.id || 'unknown'
    });
    return handleApiError(error);
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { invoiceId, companyId } = paymentIntent.metadata

    if (!invoiceId) {
      console.error(`Invoice ID not found in payment intent metadata: ${paymentIntent.id}`)
      return
    }

    // Use our comprehensive reconciliation service
    const { paymentReconciliationService } = await import('@/lib/services/payment-reconciliation-service')

    const paymentAmount = filsToAed(paymentIntent.amount)
    const paymentDate = new Date(paymentIntent.created * 1000)

    // Record payment using reconciliation service
    const result = await paymentReconciliationService.recordPayment(
      invoiceId,
      {
        amount: paymentAmount,
        paymentDate,
        method: 'STRIPE_CARD' as any,
        reference: paymentIntent.id,
        notes: `Stripe payment - Charge: ${paymentIntent.charges.data[0]?.id || paymentIntent.id}`,
      },
      {
        userId: 'stripe-webhook', // System user for webhooks
        userRole: 'ADMIN' as any,
        companyId: companyId || 'unknown',
        validateBusinessRules: false, // Skip business hour validation for webhooks
        autoUpdateInvoiceStatus: true,
        notifyCustomer: true,
      },
      {
        allowOverpayment: true,
        overpaymentTolerancePercent: 2.0,
        validateBusinessHours: false,
      }
    )

    console.log(`Payment reconciled successfully for invoice: ${result.reconciliation.invoiceNumber}`)
    console.log(`Payment Status: ${result.reconciliation.paymentStatus}`)
    console.log(`Invoice Status Updated: ${!!result.statusUpdateResult}`)

  } catch (error) {
    console.error('Error handling payment succeeded:', error)

    // Fallback to direct database update if reconciliation service fails
    try {
      await fallbackPaymentProcessing(paymentIntent)
    } catch (fallbackError) {
      console.error('Fallback payment processing also failed:', fallbackError)
      throw error
    }
  }
}

// Fallback payment processing for webhook failures
async function fallbackPaymentProcessing(paymentIntent: Stripe.PaymentIntent) {
  const { invoiceId, companyId } = paymentIntent.metadata

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true },
  })

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`)
  }

  await prisma.$transaction(async (tx) => {
    // Create payment record
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: new (await import('decimal.js')).Decimal(filsToAed(paymentIntent.amount)),
        paymentDate: new Date(paymentIntent.created * 1000),
        method: 'STRIPE_CARD',
        reference: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        isVerified: true,
        verifiedAt: new Date(),
        bankReference: paymentIntent.charges.data[0]?.id,
        feesAmount: new (await import('decimal.js')).Decimal(0),
        companyId: invoice.companyId,
      },
    })

    // Update invoice status
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Log fallback activity
    await tx.activity.create({
      data: {
        type: 'PAYMENT_RECEIVED',
        description: `Payment received for invoice ${invoice.number} via Stripe (fallback processing)`,
        metadata: {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id,
          amount: filsToAed(paymentIntent.amount),
          fallback: true,
        },
        companyId: invoice.companyId,
      },
    })
  })

  console.log(`Fallback payment processing completed for invoice: ${invoice.number}`)
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { invoiceId } = paymentIntent.metadata

    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        paymentIntentId: paymentIntent.id,
      },
    })

    if (!invoice) {
      console.error(`Invoice not found for failed payment: ${paymentIntent.id}`)
      return
    }

    // Log failed payment attempt
    await prisma.activity.create({
      data: {
        type: 'PAYMENT_FAILED',
        description: `Payment failed for invoice ${invoice.number}`,
        metadata: {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id,
          amount: filsToAed(paymentIntent.amount),
          currency: paymentIntent.currency.toUpperCase(),
          failureReason: paymentIntent.last_payment_error?.message || 'Unknown',
        },
        companyId: invoice.companyId,
      },
    })

    console.log(`Payment failed for invoice: ${invoice.number}`)

  } catch (error) {
    console.error('Error handling payment failed:', error)
    throw error
  }
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { invoiceId } = paymentIntent.metadata

    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        paymentIntentId: paymentIntent.id,
      },
    })

    if (!invoice) {
      console.error(`Invoice not found for canceled payment: ${paymentIntent.id}`)
      return
    }

    // Clear payment intent ID from invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentIntentId: null,
        updatedAt: new Date(),
      },
    })

    // Log canceled payment
    await prisma.activity.create({
      data: {
        type: 'PAYMENT_CANCELED',
        description: `Payment canceled for invoice ${invoice.number}`,
        metadata: {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id,
          amount: filsToAed(paymentIntent.amount),
          currency: paymentIntent.currency.toUpperCase(),
        },
        companyId: invoice.companyId,
      },
    })

    console.log(`Payment canceled for invoice: ${invoice.number}`)

  } catch (error) {
    console.error('Error handling payment canceled:', error)
    throw error
  }
}

async function handlePaymentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { invoiceId } = paymentIntent.metadata

    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        paymentIntentId: paymentIntent.id,
      },
    })

    if (!invoice) {
      console.error(`Invoice not found for payment requiring action: ${paymentIntent.id}`)
      return
    }

    // Log action required
    await prisma.activity.create({
      data: {
        type: 'PAYMENT_REQUIRES_ACTION',
        description: `Payment requires additional authentication for invoice ${invoice.number}`,
        metadata: {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id,
          amount: filsToAed(paymentIntent.amount),
          currency: paymentIntent.currency.toUpperCase(),
        },
        companyId: invoice.companyId,
      },
    })

    console.log(`Payment requires action for invoice: ${invoice.number}`)

  } catch (error) {
    console.error('Error handling payment requires action:', error)
    throw error
  }
}

async function sendPaymentConfirmationEmail(
  invoice: any,
  paymentIntent: Stripe.PaymentIntent
) {
  const amount = filsToAed(paymentIntent.amount)

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #22c55e;">Payment Confirmation</h2>

      <p>Dear ${invoice.customerName},</p>

      <p>We have successfully received your payment for the following invoice:</p>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Payment Details</h3>
        <p><strong>Invoice Number:</strong> ${invoice.number}</p>
        <p><strong>Amount Paid:</strong> ${new Intl.NumberFormat('en-AE', {
          style: 'currency',
          currency: 'AED'
        }).format(amount)}</p>
        <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString('en-AE')}</p>
        <p><strong>Reference:</strong> ${paymentIntent.id}</p>
      </div>

      <p>Thank you for your prompt payment. Your invoice has been marked as paid in our system.</p>

      <p>Best regards,<br>
      ${invoice.company.name}<br>
      Powered by Reminder Reminder Platform</p>
    </div>
  `

  const textContent = `
    Payment Confirmation

    Dear ${invoice.customerName},

    We have successfully received your payment for invoice ${invoice.number}.

    Payment Details:
    - Invoice Number: ${invoice.number}
    - Amount Paid: ${new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED'
      }).format(amount)}
    - Payment Date: ${new Date().toLocaleDateString('en-AE')}
    - Reference: ${paymentIntent.id}

    Thank you for your prompt payment.

    Best regards,
    ${invoice.company.name}
    Powered by Reminder Reminder Platform
  `

  await sendEmail({
    to: invoice.customerEmail,
    subject: `Payment Confirmation - Invoice ${invoice.number}`,
    htmlContent,
    textContent,
  })
}