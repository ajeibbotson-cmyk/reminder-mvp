/**
 * Create Stripe Payment Intent API
 * Handles UAE-compliant payment processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPaymentIntent, createStripeCustomer, aedToFils } from '@/lib/stripe'

const CreatePaymentIntentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('aed'),
})

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const { invoiceId, amount, currency } = CreatePaymentIntentSchema.parse(body)

    // Fetch invoice with customer details
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        companyId: session.user.companyId,
      },
      include: {
        customer: true,
        company: true,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Check if invoice is already paid
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Invoice is already paid' },
        { status: 400 }
      )
    }

    // Validate amount matches invoice
    const invoiceAmount = parseFloat(invoice.totalAmount.toString())
    if (Math.abs(amount - invoiceAmount) > 0.01) {
      return NextResponse.json(
        { error: 'Amount does not match invoice total' },
        { status: 400 }
      )
    }

    // Create or retrieve Stripe customer
    let stripeCustomer
    try {
      stripeCustomer = await createStripeCustomer({
        email: invoice.customerEmail,
        name: invoice.customerName,
        phone: invoice.customer?.phone,
        address: invoice.customer?.address ? {
          line1: invoice.customer.address,
          city: 'Dubai', // Default for UAE
          country: 'AE',
        } : undefined,
        companyId: session.user.companyId,
        customerId: invoice.customerId || 'unknown',
      })
    } catch (stripeError) {
      console.error('Stripe Customer Creation Failed:', stripeError)
      return NextResponse.json(
        { error: 'Failed to create payment customer' },
        { status: 500 }
      )
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent({
      amount: aedToFils(amount), // Convert AED to fils
      currency,
      customerId: invoice.customerId || 'unknown',
      invoiceId: invoice.id,
      metadata: {
        invoiceNumber: invoice.number,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        companyId: session.user.companyId,
        companyName: invoice.company.name,
        stripeCustomerId: stripeCustomer.id,
      },
    })

    // Store payment intent reference in database
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'PAYMENT_INTENT_CREATED',
        description: `Payment intent created for invoice ${invoice.number}`,
        metadata: {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id,
          amount: amount,
          currency: currency.toUpperCase(),
        },
        userId: session.user.id,
        companyId: session.user.companyId,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        stripeCustomerId: stripeCustomer.id,
      },
    })

  } catch (error) {
    console.error('Create Payment Intent Error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get payment intent status
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
    const paymentIntentId = searchParams.get('payment_intent_id')

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID required' },
        { status: 400 }
      )
    }

    // Find invoice with this payment intent
    const invoice = await prisma.invoice.findFirst({
      where: {
        paymentIntentId,
        companyId: session.user.companyId,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Payment intent not found' },
        { status: 404 }
      )
    }

    // Retrieve from Stripe
    const { retrievePaymentIntent } = await import('@/lib/stripe')
    const paymentIntent = await retrievePaymentIntent(paymentIntentId)

    return NextResponse.json({
      success: true,
      data: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
      },
    })

  } catch (error) {
    console.error('Get Payment Intent Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}