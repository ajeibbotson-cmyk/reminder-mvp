'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { 
  User, 
  Building, 
  Mail, 
  Phone, 
  Hash, 
  Calculator, 
  Calendar,
  FileText,
  DollarSign,
  Clock,
  Edit,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Eye
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AEDAmount,
  TRNDisplay,
  UAEPhoneDisplay,
  BusinessTypeDisplay,
  InvoiceStatusBadge,
  UAEDateDisplay
} from '@/components/ui/uae-formatters'
import { CustomerWithInvoices } from '@/lib/types/store'
import { CustomerFormDialog } from './customer-form-dialog'
import { useCustomerStore } from '@/lib/stores/customer-store'
import { toast } from 'sonner'

interface CustomerDetailsModalProps {
  customer: CustomerWithInvoices
  companyId: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
}

export function CustomerDetailsModal({
  customer,
  companyId,
  trigger,
  open,
  onOpenChange,
  onEdit,
  onDelete
}: CustomerDetailsModalProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [showEditDialog, setShowEditDialog] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  const { deleteCustomer } = useCustomerStore()

  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  // Calculate customer metrics
  const totalInvoices = customer.invoices?.length || 0
  const totalAmount = customer.invoices?.reduce((sum, invoice) => sum + Number(invoice.amount), 0) || 0
  const outstandingAmount = customer.invoices?.reduce((sum, invoice) => {
    return invoice.status !== 'PAID' ? sum + Number(invoice.amount) : sum
  }, 0) || 0
  const paidAmount = totalAmount - outstandingAmount
  
  // Status counts
  const statusCounts = customer.invoices?.reduce((counts, invoice) => {
    counts[invoice.status] = (counts[invoice.status] || 0) + 1
    return counts
  }, {} as Record<string, number>) || {}

  // Recent invoices (last 5)
  const recentInvoices = customer.invoices
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    ?.slice(0, 5) || []

  const handleDelete = async () => {
    if (!confirm(locale === 'ar' 
      ? 'هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع الفواتير المرتبطة به.'
      : 'Are you sure you want to delete this customer? All associated invoices will also be deleted.'
    )) return

    setIsDeleting(true)
    
    try {
      await deleteCustomer(customer.id)
      toast.success(locale === 'ar' ? 'تم حذف العميل بنجاح' : 'Customer deleted successfully')
      setOpen(false)
      onDelete?.()
    } catch (error) {
      toast.error(locale === 'ar' ? 'فشل في حذف العميل' : 'Failed to delete customer')
      console.error('Failed to delete customer:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEdit = () => {
    setShowEditDialog(true)
    onEdit?.()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'text-green-600 bg-green-50'
      case 'OVERDUE': return 'text-red-600 bg-red-50'
      case 'SENT': return 'text-blue-600 bg-blue-50'
      case 'DRAFT': return 'text-gray-600 bg-gray-50'
      default: return 'text-yellow-600 bg-yellow-50'
    }
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Eye className="h-4 w-4" />
    </Button>
  )

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
        <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold">{customer.name}</div>
                {customer.name_ar && (
                  <div className="text-sm text-muted-foreground font-normal" dir="rtl">
                    {customer.name_ar}
                  </div>
                )}
              </div>
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>
                {locale === 'ar' 
                  ? 'عرض تفاصيل العميل الكاملة والفواتير المرتبطة'
                  : 'View complete customer details and associated invoices'
                }
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  {locale === 'ar' ? 'تعديل' : 'Edit'}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {locale === 'ar' ? 'حذف' : 'Delete'}
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {locale === 'ar' ? 'البريد الإلكتروني:' : 'Email:'}
                      </span>
                      <span className="text-sm">{customer.email}</span>
                    </div>
                    
                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {locale === 'ar' ? 'الهاتف:' : 'Phone:'}
                        </span>
                        <UAEPhoneDisplay phone={customer.phone} />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {locale === 'ar' ? 'تاريخ الإنشاء:' : 'Created:'}
                      </span>
                      <UAEDateDisplay date={customer.created_at} locale={locale} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {locale === 'ar' ? 'معلومات الشركة' : 'Business Information'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {customer.businessName && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {locale === 'ar' ? 'اسم الشركة:' : 'Business:'}
                        </span>
                        <span className="text-sm">{customer.businessName}</span>
                      </div>
                    )}

                    {customer.businessType && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {locale === 'ar' ? 'نوع النشاط:' : 'Type:'}
                        </span>
                        <BusinessTypeDisplay type={customer.businessType} locale={locale} />
                      </div>
                    )}

                    {customer.trn && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {locale === 'ar' ? 'الرقم الضريبي:' : 'TRN:'}
                        </span>
                        <TRNDisplay trn={customer.trn} locale={locale} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {locale === 'ar' ? 'المعلومات المالية' : 'Financial Information'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      <AEDAmount amount={totalAmount} locale={locale} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {locale === 'ar' ? 'إجمالي الفواتير' : 'Total Invoiced'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      <AEDAmount amount={paidAmount} locale={locale} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {locale === 'ar' ? 'المبلغ المدفوع' : 'Total Paid'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${outstandingAmount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      <AEDAmount amount={outstandingAmount} locale={locale} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {locale === 'ar' ? 'المبلغ المستحق' : 'Outstanding'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {totalInvoices}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {locale === 'ar' ? 'عدد الفواتير' : 'Total Invoices'}
                    </div>
                  </div>
                </div>

                {/* Payment Terms and Credit Limit */}
                <Separator className="my-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {locale === 'ar' ? 'شروط الدفع:' : 'Payment Terms:'}
                    </span>
                    <span className="text-sm">
                      {customer.payment_terms 
                        ? (locale === 'ar' 
                            ? `${customer.payment_terms} يوم` 
                            : `${customer.payment_terms} days`
                          )
                        : (locale === 'ar' ? 'غير محدد' : 'Not specified')
                      }
                    </span>
                  </div>
                  
                  {customer.credit_limit && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {locale === 'ar' ? 'حد الائتمان:' : 'Credit Limit:'}
                      </span>
                      <AEDAmount amount={Number(customer.credit_limit)} locale={locale} className="text-sm" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Invoice Status Summary */}
            {totalInvoices > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {locale === 'ar' ? 'ملخص حالة الفواتير' : 'Invoice Status Summary'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <Badge key={status} variant="outline" className={getStatusColor(status)}>
                        <InvoiceStatusBadge status={status as any} locale={locale} className="mr-2" />
                        {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Invoices */}
            {recentInvoices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {locale === 'ar' ? 'الفواتير الأخيرة' : 'Recent Invoices'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                            {locale === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}
                          </TableHead>
                          <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                            {locale === 'ar' ? 'التاريخ' : 'Date'}
                          </TableHead>
                          <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                            {locale === 'ar' ? 'المبلغ' : 'Amount'}
                          </TableHead>
                          <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                            {locale === 'ar' ? 'الحالة' : 'Status'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">
                              {invoice.number}
                            </TableCell>
                            <TableCell>
                              <UAEDateDisplay date={invoice.created_at} format="short" locale={locale} />
                            </TableCell>
                            <TableCell>
                              <AEDAmount amount={Number(invoice.amount)} locale={locale} />
                            </TableCell>
                            <TableCell>
                              <InvoiceStatusBadge status={invoice.status} locale={locale} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {(customer.notes || customer.notes_ar) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {locale === 'ar' ? 'ملاحظات' : 'Notes'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customer.notes && (
                    <div>
                      <div className="text-sm font-medium mb-2">
                        {locale === 'ar' ? 'ملاحظات (إنجليزي):' : 'Notes (English):'}
                      </div>
                      <div className="text-sm bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                        {customer.notes}
                      </div>
                    </div>
                  )}
                  
                  {customer.notes_ar && (
                    <div>
                      <div className="text-sm font-medium mb-2">
                        {locale === 'ar' ? 'ملاحظات (عربي):' : 'Notes (Arabic):'}
                      </div>
                      <div className="text-sm bg-gray-50 p-3 rounded border-r-4 border-blue-500 text-right" dir="rtl">
                        {customer.notes_ar}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <CustomerFormDialog
        companyId={companyId}
        customer={customer}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  )
}