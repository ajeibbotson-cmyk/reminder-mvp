/**
 * Stripe Payment Form Component
 * UAE-compliant payment form with AED currency support
 */

'use client'

import { useState, useEffect } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Shield, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Invoice {
  id: string
  number: string
  customerName: string
  customerEmail: string
  totalAmount: number
  dueDate: string
  description: string
  company: {
    name: string
  }
}

interface StripePaymentFormProps {
  invoice: Invoice
  clientSecret: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

function PaymentForm({ invoice, clientSecret, onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!stripe) return

    // Retrieve the payment intent status on mount
    const clientSecretParam = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    )

    if (clientSecretParam) {
      stripe.retrievePaymentIntent(clientSecretParam).then(({ paymentIntent }) => {
        if (!paymentIntent) return

        switch (paymentIntent.status) {
          case 'succeeded':
            setMessage('Payment succeeded!')
            onSuccess?.()
            break
          case 'processing':
            setMessage('Your payment is processing.')
            break
          case 'requires_payment_method':
            setMessage('Your payment was not successful, please try again.')
            break
          default:
            setMessage('Something went wrong.')
            break
        }
      })
    }
  }, [stripe, onSuccess])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setMessage(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success?invoice=${invoice.id}`,
      },
    })

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message || 'Payment failed')
        onError?.(error.message || 'Payment failed')
      } else {
        setMessage('An unexpected error occurred.')
        onError?.('An unexpected error occurred.')
      }
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        id="payment-element"
        options={{
          layout: 'tabs',
          fields: {
            billingDetails: {
              name: 'auto',
              email: 'auto',
              address: 'auto',
            },
          },
        }}
      />

      <Button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="w-full h-12"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {new Intl.NumberFormat('en-AE', {
              style: 'currency',
              currency: 'AED'
            }).format(invoice.totalAmount)}
          </>
        )}
      </Button>

      {message && (
        <div className={`text-sm p-3 rounded-md ${
          message.includes('succeeded')
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="flex items-center justify-center text-xs text-muted-foreground gap-2">
        <Shield className="h-3 w-3" />
        Secured by Stripe • PCI DSS Compliant
      </div>
    </form>
  )
}

export default function StripePaymentForm({
  invoice,
  clientSecret,
  onSuccess,
  onError
}: StripePaymentFormProps) {
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0f172a',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#dc2626',
      fontFamily: 'Inter, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    },
    rules: {
      '.Tab': {
        padding: '12px',
        border: '1px solid #e5e7eb',
      },
      '.Tab--selected': {
        borderColor: '#0f172a',
        backgroundColor: '#f8fafc',
      },
      '.Input': {
        padding: '12px',
        fontSize: '14px',
      },
      '.Label': {
        fontWeight: '500',
        marginBottom: '8px',
      },
    },
  }

  const options = {
    clientSecret,
    appearance,
    locale: 'en' as const, // UAE uses English for payments
  }

  const isOverdue = new Date(invoice.dueDate) < new Date()
  const daysPastDue = Math.floor(
    (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24)
  )

  return (
    <div className="max-w-md mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Invoice Payment</CardTitle>
            {isOverdue && (
              <Badge variant="destructive">
                {daysPastDue} days overdue
              </Badge>
            )}
          </div>
          <CardDescription>
            Secure payment powered by Stripe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice Number:</span>
              <span className="font-medium">{invoice.number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{invoice.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Company:</span>
              <span className="font-medium">{invoice.company.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date:</span>
              <span className="font-medium">
                {new Date(invoice.dueDate).toLocaleDateString('en-AE')}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Amount Due:</span>
              <span className="font-semibold text-lg">
                {new Intl.NumberFormat('en-AE', {
                  style: 'currency',
                  currency: 'AED'
                }).format(invoice.totalAmount)}
              </span>
            </div>
          </div>

          {invoice.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Description:</span>
              <p className="mt-1 text-sm">{invoice.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stripePromise && clientSecret ? (
            <Elements options={options} stripe={stripePromise}>
              <PaymentForm
                invoice={invoice}
                clientSecret={clientSecret}
                onSuccess={onSuccess}
                onError={onError}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}