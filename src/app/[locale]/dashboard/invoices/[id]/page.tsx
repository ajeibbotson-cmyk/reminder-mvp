'use client'

import { useSession } from 'next-auth/react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { formatUAECurrency, formatUAETRN } from '@/lib/vat-calculator'
import { 
  Receipt, 
  ArrowLeft, 
  Edit, 
  Send, 
  Download, 
  Copy, 
  MoreVertical, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  DollarSign,
  User,
  Calendar,
  FileText,
  CreditCard,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { INVOICE_STATUS_COLORS, STATUS_TRANSITIONS, InvoiceStatus } from '@/types/invoice'

export default function InvoiceDetailPage() {
  const { data: session } = useSession()
  const t = useTranslations('invoices')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const isRTL = locale === 'ar'
  
  const { getInvoiceById, updateInvoiceStatus, deleteInvoice } = useInvoiceStore()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const invoiceId = params.id as string

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      try {
        setLoading(true)
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
        setLoading(false)
      }
    }

    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId, getInvoiceById, locale])

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    setStatusUpdating(true)
    try {
      await updateInvoiceStatus(invoiceId, newStatus)
      setInvoice({ ...invoice, status: newStatus })
      
      toast.success(
        locale === 'ar' 
          ? `تم تحديث حالة الفاتورة إلى ${newStatus}` 
          : `Invoice status updated to ${newStatus}`
      )
    } catch (error) {
      toast.error(
        locale === 'ar' 
          ? 'فشل في تحديث حالة الفاتورة' 
          : 'Failed to update invoice status'
      )
      console.error('Failed to update status:', error)
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleEdit = () => {
    router.push(`/dashboard/invoices/${invoiceId}/edit`)
  }

  const handleDelete = async () => {
    if (window.confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoice(invoiceId)
        toast.success(locale === 'ar' ? 'تم حذف الفاتورة' : 'Invoice deleted')
        router.push('/dashboard/invoices')
      } catch (error) {
        toast.error(locale === 'ar' ? 'فشل في حذف الفاتورة' : 'Failed to delete invoice')
      }
    }
  }

  const getAvailableStatusTransitions = () => {
    if (!invoice) return []
    
    return STATUS_TRANSITIONS
      .filter(transition => transition.from === invoice.status && transition.allowed)
      .map(transition => transition.to)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT': return <FileText className="h-4 w-4" />
      case 'SENT': return <Send className="h-4 w-4" />
      case 'PAID': return <CheckCircle className="h-4 w-4" />
      case 'OVERDUE': return <AlertTriangle className="h-4 w-4" />
      case 'DISPUTED': return <XCircle className="h-4 w-4" />
      case 'WRITTEN_OFF': return <Trash2 className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
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

  if (loading) {
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

  const statusColor = INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS]
  const availableTransitions = getAvailableStatusTransitions()
  const canEdit = invoice.status === 'DRAFT' || invoice.status === 'SENT'
  const isOverdue = new Date(invoice.due_date) < new Date() && invoice.status !== 'PAID'

  return (
    <DashboardLayout>
      <UAEErrorBoundary>
        <div className={cn('space-y-6 p-6', isRTL ? 'rtl' : 'ltr')}>
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {locale === 'ar' ? 'الفاتورة' : 'Invoice'} #{invoice.number}
                  </h1>
                  <p className="text-muted-foreground">
                    {locale === 'ar' 
                      ? `عميل: ${invoice.customer_name}`
                      : `Customer: ${invoice.customer_name}`
                    }
                  </p>
                </div>
              </div>
              
              {/* Status and metadata */}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge 
                  variant={statusColor === 'green' ? 'default' : 'secondary'}
                  className={cn(
                    'gap-1',
                    statusColor === 'red' && 'bg-red-100 text-red-800',
                    statusColor === 'blue' && 'bg-blue-100 text-blue-800',
                    statusColor === 'orange' && 'bg-orange-100 text-orange-800',
                    statusColor === 'gray' && 'bg-gray-100 text-gray-800'
                  )}
                >
                  {getStatusIcon(invoice.status)}
                  {invoice.status}
                </Badge>
                
                {isOverdue && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {locale === 'ar' ? 'متأخرة' : 'Overdue'}
                  </Badge>
                )}
                
                <Badge variant="outline" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatUAECurrency(invoice.total_amount, invoice.currency)}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard/invoices')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {locale === 'ar' ? 'العودة للفواتير' : 'Back to Invoices'}
              </Button>
              
              {canEdit && (
                <Button onClick={handleEdit} className="gap-2">
                  <Edit className="h-4 w-4" />
                  {locale === 'ar' ? 'تعديل' : 'Edit'}
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {locale === 'ar' ? 'إجراءات الفاتورة' : 'Invoice Actions'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem>
                    <Send className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'إرسال بالبريد' : 'Send via Email'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem>
                    <Copy className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
                  </DropdownMenuItem>
                  
                  {availableTransitions.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>
                        {locale === 'ar' ? 'تغيير الحالة' : 'Change Status'}
                      </DropdownMenuLabel>
                      {availableTransitions.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          disabled={statusUpdating}
                        >
                          {getStatusIcon(status)}
                          <span className="ml-2">{status}</span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  {invoice.status === 'DRAFT' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={handleDelete}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {locale === 'ar' ? 'حذف' : 'Delete'}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Invoice Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {locale === 'ar' ? 'معلومات العميل' : 'Customer Information'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {locale === 'ar' ? 'اسم العميل' : 'Customer Name'}
                      </p>
                      <p className="text-lg font-semibold">{invoice.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                      </p>
                      <p>{invoice.customer_email}</p>
                    </div>
                    {invoice.trn_number && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {locale === 'ar' ? 'رقم التسجيل الضريبي' : 'TRN Number'}
                        </p>
                        <p className="font-mono">{formatUAETRN(invoice.trn_number)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {locale === 'ar' ? 'تفاصيل الأصناف' : 'Line Items'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoice.invoice_items?.map((item: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <p className="font-medium">{item.description}</p>
                            {item.description_ar && locale === 'ar' && (
                              <p className="text-sm text-muted-foreground" dir="rtl">
                                {item.description_ar}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {locale === 'ar' ? 'الكمية × السعر' : 'Qty × Price'}
                            </p>
                            <p>{item.quantity} × {formatUAECurrency(item.unit_price, invoice.currency)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {locale === 'ar' ? 'الإجمالي' : 'Total'}
                            </p>
                            <p className="font-semibold">
                              {formatUAECurrency(item.total_with_vat || item.total, invoice.currency)}
                            </p>
                          </div>
                        </div>
                        {item.vat_rate > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            VAT ({item.vat_rate}%): {formatUAECurrency(item.vat_amount || 0, invoice.currency)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {(invoice.notes || invoice.description) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{locale === 'ar' ? 'ملاحظات' : 'Notes'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {invoice.description && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {locale === 'ar' ? 'الوصف' : 'Description'}
                        </p>
                        <p>{invoice.description}</p>
                      </div>
                    )}
                    {invoice.notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {locale === 'ar' ? 'ملاحظات' : 'Notes'}
                        </p>
                        <p>{invoice.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Invoice Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {locale === 'ar' ? 'ملخص الفاتورة' : 'Invoice Summary'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>{locale === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}:</span>
                    <span>{formatUAECurrency(invoice.subtotal || 0, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{locale === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}:</span>
                    <span>{formatUAECurrency(invoice.vat_amount || 0, invoice.currency)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>{locale === 'ar' ? 'الإجمالي' : 'Total'}:</span>
                    <span>{formatUAECurrency(invoice.total_amount, invoice.currency)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {locale === 'ar' ? 'التواريخ المهمة' : 'Important Dates'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {locale === 'ar' ? 'تاريخ الإنشاء' : 'Created Date'}
                    </p>
                    <p>{new Date(invoice.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {locale === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                    </p>
                    <p className={cn(
                      isOverdue && 'text-red-600 font-semibold'
                    )}>
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Information */}
              {invoice.payments && invoice.payments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {locale === 'ar' ? 'المدفوعات' : 'Payments'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {invoice.payments.map((payment: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              {formatUAECurrency(payment.amount, invoice.currency)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {payment.method}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </UAEErrorBoundary>
    </DashboardLayout>
  )
}