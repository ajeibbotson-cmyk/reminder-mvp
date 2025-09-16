/**
 * Stripe Integration for UAE Payment Processing
 * Supports AED currency with UAE business compliance
 */

import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  appInfo: {
    name: 'UAEPay Reminder Platform',
    version: '1.0.0',
  },
})

// Client-side Stripe promise
let stripePromise: Promise<Stripe | null>
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// UAE-specific configuration
export const UAE_STRIPE_CONFIG = {
  currency: 'aed',
  country: 'AE',
  minimumAmount: 200, // 2.00 AED minimum (in fils)
  maximumAmount: 99999999, // Reasonable maximum for SME invoices
  payoutSchedule: 'manual', // T+5 business days for UAE
}

// Payment method types supported in UAE
export const UAE_PAYMENT_METHODS = [
  'card',
  'link', // Stripe Link for faster checkout
] as const

// Create payment intent for UAE transactions
export const createPaymentIntent = async ({
  amount,
  currency = 'aed',
  customerId,
  invoiceId,
  metadata = {},
}: {
  amount: number // Amount in fils (1 AED = 100 fils)
  currency?: string
  customerId: string
  invoiceId: string
  metadata?: Record<string, string>
}) => {
  try {
    // Validate minimum amount for UAE
    if (amount < UAE_STRIPE_CONFIG.minimumAmount) {
      throw new Error(`Minimum payment amount is ${UAE_STRIPE_CONFIG.minimumAmount / 100} AED`)
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      payment_method_types: UAE_PAYMENT_METHODS,
      metadata: {
        customerId,
        invoiceId,
        region: 'UAE',
        ...metadata,
      },
      // UAE business compliance
      description: `Payment for Invoice ${metadata.invoiceNumber || invoiceId}`,
      statement_descriptor: 'UAEPAY INVOICE', // Max 22 characters
      // Enable automatic payment methods
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never', // Keep simple for UAE market
      },
    })

    return paymentIntent
  } catch (error) {
    console.error('Stripe Payment Intent Error:', error)
    throw error
  }
}

// Create or retrieve Stripe customer
export const createStripeCustomer = async ({
  email,
  name,
  phone,
  address,
  companyId,
  customerId,
}: {
  email: string
  name: string
  phone?: string
  address?: {
    line1: string
    city: string
    country: string
    postal_code?: string
  }
  companyId: string
  customerId: string
}) => {
  try {
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0]
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      address,
      metadata: {
        companyId,
        customerId,
        region: 'UAE',
      },
    })

    return customer
  } catch (error) {
    console.error('Stripe Customer Creation Error:', error)
    throw error
  }
}

// Retrieve payment intent
export const retrievePaymentIntent = async (paymentIntentId: string) => {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch (error) {
    console.error('Stripe Payment Intent Retrieval Error:', error)
    throw error
  }
}

// Cancel payment intent
export const cancelPaymentIntent = async (paymentIntentId: string) => {
  try {
    return await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (error) {
    console.error('Stripe Payment Intent Cancellation Error:', error)
    throw error
  }
}

// Confirm payment intent (server-side)
export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId: string
) => {
  try {
    return await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    })
  } catch (error) {
    console.error('Stripe Payment Intent Confirmation Error:', error)
    throw error
  }
}

// Format amount for display (fils to AED)
export const formatStripeAmount = (amount: number, currency = 'AED') => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

// Convert AED to fils for Stripe
export const aedToFils = (aed: number): number => {
  return Math.round(aed * 100)
}

// Convert fils to AED from Stripe
export const filsToAed = (fils: number): number => {
  return fils / 100
}

// Webhook signature verification
export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string
) => {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (error) {
    console.error('Stripe Webhook Verification Error:', error)
    throw error
  }
}

// UAE business hours check for payment processing
export const isUAEBusinessHours = (date = new Date()): boolean => {
  const uaeTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const day = uaeTime.getDay() // 0 = Sunday
  const hour = uaeTime.getHours()

  // Sunday to Thursday, 9 AM to 6 PM UAE time
  return day >= 0 && day <= 4 && hour >= 9 && hour <= 18
}

// Generate payment link for email integration
export const generatePaymentLink = async ({
  amount,
  invoiceId,
  customerEmail,
  description,
  metadata = {},
}: {
  amount: number
  invoiceId: string
  customerEmail: string
  description: string
  metadata?: Record<string, string>
}) => {
  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: {
              name: description,
              metadata: {
                invoiceId,
                ...metadata,
              },
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId,
        customerEmail,
        ...metadata,
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?invoice=${invoiceId}`,
        },
      },
    })

    return paymentLink
  } catch (error) {
    console.error('Stripe Payment Link Creation Error:', error)
    throw error
  }
}

export default stripe