'use client'

import { useSession } from 'next-auth/react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { Receipt, ArrowLeft, Save, AlertTriangle, Edit, Clock, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { INVOICE_STATUS_COLORS } from '@/types/invoice'

interface EditInvoicePageProps {
  params: {
    id: string
    locale: string
  }
}

export default function EditInvoicePage() {
  const { data: session } = useSession()
  const t = useTranslations('invoices')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const isRTL = locale === 'ar'
  
  const { getInvoiceById, loading } = useInvoiceStore()
  const [invoice, setInvoice] = useState<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const invoiceId = params.id as string

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      try {
        setLoadingInvoice(true)
        setError(null)
        
        const invoiceData = getInvoiceById(invoiceId)
        if (invoiceData) {
          setInvoice(invoiceData)
        } else {
          setError(locale === 'ar' ? 'لم يتم العثور على الفاتورة' : 'Invoice not found')
        }
      } catch (error) {
        console.error('Failed to load invoice:', error)
        setError(locale === 'ar' ? 'فشل في تحميل الفاتورة' : 'Failed to load invoice')
      } finally {
        setLoadingInvoice(false)
      }
    }

    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId, getInvoiceById, locale])

  const handleSave = async (data: any) => {
    setIsUpdating(true)
    try {
      toast.success(
        locale === 'ar' 
          ? 'تم تحديث الفاتورة بنجاح' 
          : 'Invoice updated successfully'
      )
      
      // Navigate back to invoice detail or list
      router.push(`/dashboard/invoices/${invoiceId}`)
    } catch (error) {
      toast.error(
        locale === 'ar' 
          ? 'فشل في تحديث الفاتورة' 
          : 'Failed to update invoice'
      )
      console.error('Failed to update invoice:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/invoices/${invoiceId}`)
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Receipt className="h-8 w-8 animate-spin" />
          <span className="ml-2">{t('loading')}</span>
        </div>
      </DashboardLayout>
    )
  }

  if (loadingInvoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
          <span className="ml-3">
            {locale === 'ar' ? 'جاري تحميل الفاتورة...' : 'Loading invoice...'}
          </span>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error || (locale === 'ar' ? 'لم يتم العثور على الفاتورة' : 'Invoice not found')}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={() => router.push('/dashboard/invoices')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {locale === 'ar' ? 'العودة للفواتير' : 'Back to Invoices'}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const canEdit = invoice.status === 'DRAFT' || invoice.status === 'SENT'
  const statusColor = INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS]

  return (
    <DashboardLayout>
      <UAEErrorBoundary>
        <div className={cn('space-y-6 p-6', isRTL ? 'rtl' : 'ltr')}>
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Edit className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {locale === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice'} #{invoice.number}
                  </h1>
                  <p className="text-muted-foreground">
                    {locale === 'ar' 
                      ? 'تعديل تفاصيل الفاتورة وحفظ التغييرات'
                      : 'Modify invoice details and save changes'
                    }
                  </p>
                </div>
              </div>
              
              {/* Status and metadata */}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge 
                  variant={statusColor === 'green' ? 'default' : 'secondary'}
                  className={cn(
                    statusColor === 'red' && 'bg-red-100 text-red-800',
                    statusColor === 'blue' && 'bg-blue-100 text-blue-800',
                    statusColor === 'orange' && 'bg-orange-100 text-orange-800',
                    statusColor === 'gray' && 'bg-gray-100 text-gray-800'
                  )}
                >
                  {invoice.status}
                </Badge>
                
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {locale === 'ar' ? 'تاريخ الاستحقاق' : 'Due'}: {new Date(invoice.due_date).toLocaleDateString()}
                </Badge>
                
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {locale === 'ar' ? 'حفظ تلقائي نشط' : 'Auto-save enabled'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {locale === 'ar' ? 'إلغاء التعديل' : 'Cancel Edit'}
              </Button>
            </div>
          </div>

          {/* Edit permissions warning */}
          {!canEdit && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                {locale === 'ar' 
                  ? 'تحذير: الفواتير المدفوعة أو المتنازع عليها أو المشطوبة لا يمكن تعديلها. يمكنك عرض التفاصيل فقط.'
                  : 'Warning: Paid, disputed, or written-off invoices cannot be edited. You can only view details.'
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Edit restrictions info */}
          {canEdit && invoice.status === 'SENT' && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                  <AlertTriangle className="h-5 w-5" />
                  {locale === 'ar' ? 'فاتورة مرسلة - تحذير' : 'Sent Invoice - Warning'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700">
                <p>
                  {locale === 'ar' 
                    ? 'هذه الفاتورة تم إرسالها بالفعل للعميل. أي تعديلات ستتطلب إرسال نسخة محدثة.'
                    : 'This invoice has been sent to the customer. Any changes will require sending an updated version.'
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Invoice Form */}
          <InvoiceForm
            invoiceId={invoiceId}
            onSave={handleSave}
            onCancel={handleCancel}
            locale={locale}
            companyId={session.user.companyId}
            enableAutoSave={canEdit}
          />
        </div>
      </UAEErrorBoundary>
    </DashboardLayout>
  )
}