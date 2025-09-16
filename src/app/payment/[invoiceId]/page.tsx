/**
 * Invoice Payment Page
 * Public payment page for invoice payments via Stripe
 */

import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import StripePaymentForm from '@/components/payments/StripePaymentForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Clock, Building2 } from 'lucide-react'

interface PaymentPageProps {
  params: {
    invoiceId: string
  }
  searchParams: {
    client_secret?: string
    payment_intent_client_secret?: string
  }
}

async function getInvoice(invoiceId: string) {
  return await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
      // Only allow payment for SENT or OVERDUE invoices
      status: {
        in: ['SENT', 'OVERDUE']
      }
    },
    include: {
      company: {
        select: {
          name: true,
          address: true,
          emailSettings: true,
        }
      },
      customer: {
        select: {
          name: true,
          email: true,
        }
      },
      payments: {
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          isVerified: true,
        }
      }
    }
  })
}

export async function generateMetadata({ params }: PaymentPageProps): Promise<Metadata> {
  const invoice = await getInvoice(params.invoiceId)

  if (!invoice) {
    return {
      title: 'Invoice Not Found - Reminder',
    }
  }

  return {
    title: `Pay Invoice ${invoice.number} - ${invoice.company.name}`,
    description: `Secure payment for invoice ${invoice.number} from ${invoice.company.name}. Amount: ${new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED'
    }).format(parseFloat(invoice.totalAmount.toString()))}`,
    robots: 'noindex, nofollow', // Don't index payment pages
  }
}

export default async function PaymentPage({ params, searchParams }: PaymentPageProps) {
  const invoice = await getInvoice(params.invoiceId)

  if (!invoice) {
    notFound()
  }

  // Check if payment was successful
  const paymentSuccess = searchParams.payment_intent_client_secret ||
                        searchParams.client_secret

  // Calculate payment status
  const totalPaid = invoice.payments
    .filter(p => p.isVerified)
    .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0)

  const totalAmount = parseFloat(invoice.totalAmount.toString())
  const isFullyPaid = totalPaid >= totalAmount
  const isOverdue = new Date(invoice.dueDate) < new Date()
  const daysPastDue = Math.floor(
    (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24)
  )

  // If already paid, show success message
  if (isFullyPaid || invoice.status === 'PAID') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto px-4">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-700">
                Invoice Already Paid
              </CardTitle>
              <CardDescription>
                This invoice has been fully paid and processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Number:</span>
                    <span className="font-medium">{invoice.number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Company:</span>
                    <span className="font-medium">{invoice.company.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('en-AE', {
                        style: 'currency',
                        currency: 'AED'
                      }).format(totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Status:</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Paid
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="h-6 w-6" />
            <h1 className="text-2xl font-bold">{invoice.company.name}</h1>
          </div>
          <p className="text-gray-600">Invoice Payment Portal</p>
        </div>

        {/* Status Banner */}
        {isOverdue && (
          <div className="mb-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-orange-800">
                    Invoice Overdue
                  </p>
                  <p className="text-sm text-orange-700">
                    This invoice is {daysPastDue} day{daysPastDue !== 1 ? 's' : ''} past due.
                    Please make payment at your earliest convenience.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Invoice Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Number:</span>
                    <span className="font-medium">{invoice.number}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Issue Date:</span>
                    <span className="font-medium">
                      {new Date(invoice.createdAt).toLocaleDateString('en-AE')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Due Date:</span>
                    <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                      {new Date(invoice.dueDate).toLocaleDateString('en-AE')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{invoice.customerName}</span>
                  </div>

                  {invoice.description && (
                    <div className="border-t pt-3">
                      <span className="text-gray-600 block mb-1">Description:</span>
                      <p className="text-sm">{invoice.description}</p>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total Amount:</span>
                      <span className="text-2xl">
                        {new Intl.NumberFormat('en-AE', {
                          style: 'currency',
                          currency: 'AED'
                        }).format(totalAmount)}
                      </span>
                    </div>
                  </div>

                  {totalPaid > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 text-xs">
                      <div className="flex justify-between">
                        <span>Previous Payments:</span>
                        <span className="font-medium">
                          -{new Intl.NumberFormat('en-AE', {
                            style: 'currency',
                            currency: 'AED'
                          }).format(totalPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold border-t mt-2 pt-2">
                        <span>Amount Due:</span>
                        <span>
                          {new Intl.NumberFormat('en-AE', {
                            style: 'currency',
                            currency: 'AED'
                          }).format(totalAmount - totalPaid)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>
                  <span className="font-medium">{invoice.company.name}</span>
                </div>
                {invoice.company.address && (
                  <div className="text-gray-600">
                    {invoice.company.address}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div>
            {searchParams.client_secret ? (
              <StripePaymentForm
                invoice={{
                  id: invoice.id,
                  number: invoice.number,
                  customerName: invoice.customerName,
                  customerEmail: invoice.customerEmail,
                  totalAmount: totalAmount - totalPaid, // Remaining amount
                  dueDate: invoice.dueDate.toISOString(),
                  description: invoice.description || '',
                  company: {
                    name: invoice.company.name,
                  }
                }}
                clientSecret={searchParams.client_secret}
                onSuccess={() => {
                  window.location.href = `/payment/success?invoice=${invoice.id}`
                }}
                onError={(error) => {
                  console.error('Payment error:', error)
                }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Initialize Payment</CardTitle>
                  <CardDescription>
                    Click below to securely pay this invoice
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action="/api/payments/create-intent" method="POST">
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input type="hidden" name="amount" value={totalAmount - totalPaid} />
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Pay {new Intl.NumberFormat('en-AE', {
                        style: 'currency',
                        currency: 'AED'
                      }).format(totalAmount - totalPaid)}
                    </button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-500">
          <p>Powered by Reminder Reminder Platform • Secured by Stripe • PCI DSS Compliant</p>
        </div>
      </div>
    </div>
  )
}