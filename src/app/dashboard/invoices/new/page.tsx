'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Receipt, ArrowLeft } from 'lucide-react'

export default function NewInvoicePage() {
  const { data: session } = useSession()
  const t = useTranslations('invoiceForm')
  const router = useRouter()

  const handleSave = (data: any) => {
    console.log('Invoice saved:', data)
    router.push('/dashboard/invoices')
  }

  const handleCancel = () => {
    router.push('/dashboard/invoices')
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <Receipt className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    )
  }

  return (
    <UAEErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              {t('createNewInvoice')}
            </h1>
            <p className="text-gray-600 mt-2">{t('createNewInvoiceDescription')}</p>
          </div>
          
          <Button variant="outline" onClick={() => router.push('/dashboard/invoices')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToInvoices')}
          </Button>
        </div>

        {/* Invoice Form */}
        <InvoiceForm
          onSave={handleSave}
          onCancel={handleCancel}
          locale="en"
        />
      </div>
    </UAEErrorBoundary>
  )
}