/**
 * Payment Success Page
 * Displays successful payment confirmation
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Download, Receipt, ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

interface PaymentSuccessProps {
  searchParams: {
    invoice?: string
    payment_intent?: string
    payment_intent_client_secret?: string
  }
}

async function getPaymentDetails(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      company: {
        select: {
          name: true,
          address: true,
        }
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          method: true,
          reference: true,
          stripePaymentIntentId: true,
        }
      }
    }
  })

  return invoice
}

function PaymentSuccessContent({ searchParams }: PaymentSuccessProps) {
  return (
    <Suspense fallback={<PaymentSuccessLoading />}>
      <PaymentSuccessPage searchParams={searchParams} />
    </Suspense>
  )
}

function PaymentSuccessLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto px-4">
        <Card className="text-center">
          <CardContent className="pt-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function PaymentSuccessPage({ searchParams }: PaymentSuccessProps) {
  const invoiceId = searchParams.invoice

  if (!invoiceId) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto px-4">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Receipt className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-700">
                Payment Information Missing
              </CardTitle>
              <CardDescription>
                Unable to retrieve payment details.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const invoice = await getPaymentDetails(invoiceId)

  if (!invoice) {
    notFound()
  }

  const latestPayment = invoice.payments[0]
  const totalAmount = parseFloat(invoice.totalAmount.toString())

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Success Header */}
        <Card className="text-center mb-8">
          <CardHeader className="pb-4">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700 mb-2">
              Payment Successful!
            </CardTitle>
            <CardDescription className="text-base">
              Thank you for your payment. Your invoice has been marked as paid.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Payment Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium">{invoice.number}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Company:</span>
                <span className="font-medium">{invoice.company.name}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{invoice.customerName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Payment Date:</span>
                <span className="font-medium">
                  {latestPayment
                    ? new Date(latestPayment.paymentDate).toLocaleDateString('en-AE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : new Date().toLocaleDateString('en-AE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">
                  {latestPayment?.method === 'STRIPE_CARD' ? 'Credit/Debit Card' : latestPayment?.method || 'Credit/Debit Card'}
                </span>
              </div>

              {(latestPayment?.reference || searchParams.payment_intent) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-medium font-mono text-xs">
                    {latestPayment?.reference || searchParams.payment_intent}
                  </span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-semibold text-green-700">
                  <span>Amount Paid:</span>
                  <span className="text-2xl">
                    {new Intl.NumberFormat('en-AE', {
                      style: 'currency',
                      currency: 'AED'
                    }).format(latestPayment ? parseFloat(latestPayment.amount.toString()) : totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmation Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Payment Confirmed:</strong> Your payment has been processed successfully.
                A confirmation email will be sent to {invoice.customerEmail} shortly.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>You will receive a payment confirmation email within the next few minutes</p>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Your invoice has been marked as paid in our system</p>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Future payment reminders for this invoice have been cancelled</p>
            </div>
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p>Keep this confirmation page for your records</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Button variant="outline" className="h-12" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" />
            Print Confirmation
          </Button>

          <Button
            className="h-12"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back()
              } else {
                window.close()
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Close Window
          </Button>
        </div>

        {/* Support */}
        <Card className="mt-8 bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">Need help or have questions about your payment?</p>
              <p>
                Contact <strong>{invoice.company.name}</strong> directly for any invoice-related inquiries.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 space-y-1">
          <p>Powered by Reminder Reminder Platform</p>
          <p>Secured by Stripe • PCI DSS Compliant • Data Protected</p>
        </div>
      </div>
    </div>
  )
}

export default PaymentSuccessContent