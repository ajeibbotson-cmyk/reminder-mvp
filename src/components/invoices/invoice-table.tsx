'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingOverlay, LoadingSpinner } from '@/components/ui/loading-spinner'
import { InvoiceTableSkeleton } from '@/components/ui/skeleton'
import { 
  AEDAmount, 
  UAEDateDisplay, 
  InvoiceStatusBadge 
} from '@/components/ui/uae-formatters'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Plus, 
  FileDown, 
  Filter,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface InvoiceTableProps {
  companyId: string
}

export function InvoiceTable({ companyId }: InvoiceTableProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === 'ar'
  
  const { 
    invoices, 
    loading, 
    error, 
    totalCount,
    fetchInvoices,
    updateInvoiceStatus,
    deleteInvoice,
    clearError
  } = useInvoiceStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  useEffect(() => {
    if (companyId) {
      fetchInvoices(companyId).catch((err) => {
        toast.error('Failed to load invoices')
        console.error('Failed to fetch invoices:', err)
      })
    }
  }, [companyId, fetchInvoices])

  const handleStatusUpdate = async (invoiceId: string, newStatus: any) => {
    try {
      await updateInvoiceStatus(invoiceId, newStatus)
      toast.success('Invoice status updated successfully')
    } catch (error) {
      toast.error('Failed to update invoice status')
      console.error('Failed to update status:', error)
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return

    try {
      await deleteInvoice(invoiceId)
      toast.success('Invoice deleted successfully')
    } catch (error) {
      toast.error('Failed to delete invoice')
      console.error('Failed to delete invoice:', error)
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = !searchQuery || 
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer?.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-red-600 font-medium">
            {locale === 'ar' ? 'حدث خطأ في تحميل الفواتير' : 'Error loading invoices'}
          </div>
          <Button onClick={() => {
            clearError()
            fetchInvoices(companyId)
          }} variant="outline">
            {locale === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {t('invoices.title')}
          </h2>
          <p className="text-muted-foreground">
            {locale === 'ar' 
              ? `${totalCount} فاتورة إجمالي`
              : `${totalCount} total invoices`
            }
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            {locale === 'ar' ? 'تصدير' : 'Export'}
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('invoices.addInvoice')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className={`h-4 w-4 absolute top-3 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                placeholder={locale === 'ar' ? 'البحث في الفواتير...' : 'Search invoices...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${isRTL ? 'pr-10' : 'pl-10'}`}
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="ALL">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="DRAFT">{locale === 'ar' ? 'مسودة' : 'Draft'}</option>
              <option value="PENDING">{locale === 'ar' ? 'معلقة' : 'Pending'}</option>
              <option value="PAID">{locale === 'ar' ? 'مدفوعة' : 'Paid'}</option>
              <option value="OVERDUE">{locale === 'ar' ? 'متأخرة' : 'Overdue'}</option>
              <option value="CANCELLED">{locale === 'ar' ? 'ملغية' : 'Cancelled'}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card>
        <LoadingOverlay 
          isLoading={loading} 
          text={locale === 'ar' ? 'جاري تحميل الفواتير...' : 'Loading invoices...'}
        >
          {loading ? (
            <div className="p-6">
              <InvoiceTableSkeleton />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium">
                {searchQuery 
                  ? (locale === 'ar' ? 'لا توجد فواتير مطابقة' : 'No matching invoices')
                  : (locale === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet')
                }
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? (locale === 'ar' ? 'جرب تعديل البحث أو الفلاتر' : 'Try adjusting your search or filters')
                  : (locale === 'ar' ? 'أنشئ أول فاتورة لك للبدء' : 'Create your first invoice to get started')
                }
              </p>
              {!searchQuery && (
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('invoices.addInvoice')}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {t('invoices.invoiceNumber')}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {t('invoices.customer')}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {t('invoices.amount')}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {t('invoices.dueDate')}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {t('invoices.status')}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {t('invoices.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.customer?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">
                          {invoice.customer?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AEDAmount 
                        amount={invoice.amount} 
                        locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                      />
                    </TableCell>
                    <TableCell>
                      <UAEDateDisplay 
                        date={invoice.dueDate} 
                        locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                      />
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge 
                        status={invoice.status} 
                        locale={locale}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            {locale === 'ar' ? 'عرض' : 'View'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            {locale === 'ar' ? 'تعديل' : 'Edit'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {locale === 'ar' ? 'حذف' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </LoadingOverlay>
      </Card>
    </div>
  )
}