'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { InvoiceWithDetails, InvoiceFilters, BulkActionType } from '@/types/invoice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { InvoiceActions, BulkInvoiceActions } from './invoice-actions'
import { 
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Edit,
  Plus,
  FileDown,
  ArrowUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface InvoiceTableProps {
  companyId: string
  invoices: InvoiceWithDetails[]
  loading?: boolean
  filters?: InvoiceFilters
  onFiltersChange?: (filters: InvoiceFilters) => void
  totalCount?: number
  className?: string
}

type SortField = 'number' | 'customer_name' | 'amount' | 'due_date' | 'created_at' | 'status'
type SortOrder = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  order: SortOrder
}

export function InvoiceTable({ 
  companyId, 
  invoices, 
  loading = false, 
  filters = {}, 
  onFiltersChange,
  totalCount = 0,
  className 
}: InvoiceTableProps) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const isRTL = locale === 'ar'
  
  const { 
    updateInvoiceStatus,
    deleteInvoice,
    clearError
  } = useInvoiceStore()

  // Table state
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    order: 'desc'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Handle bulk selections
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(paginatedInvoices.map(inv => inv.id))
    } else {
      setSelectedInvoices([])
    }
  }

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, invoiceId])
    } else {
      setSelectedInvoices(selectedInvoices.filter(id => id !== invoiceId))
    }
  }

  const clearSelection = () => {
    setSelectedInvoices([])
  }

  // Handle sorting
  const handleSort = (field: SortField) => {
    const newOrder = sortConfig.field === field && sortConfig.order === 'asc' ? 'desc' : 'asc'
    const newSortConfig = { field, order: newOrder }
    setSortConfig(newSortConfig)
    
    // Update filters to trigger API call
    onFiltersChange?.({ 
      ...filters, 
      sort_by: field, 
      sort_order: newOrder,
      page: 1 // Reset to first page when sorting
    })
  }

  // Sort invoices locally as backup
  const sortedInvoices = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortConfig.field) {
        case 'number':
          aValue = a.number || ''
          bValue = b.number || ''
          break
        case 'customer_name':
          aValue = a.customer_name || ''
          bValue = b.customer_name || ''
          break
        case 'amount':
          aValue = a.amount || 0
          bValue = b.amount || 0
          break
        case 'due_date':
          aValue = new Date(a.due_date || 0).getTime()
          bValue = new Date(b.due_date || 0).getTime()
          break
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime()
          bValue = new Date(b.created_at || 0).getTime()
          break
        case 'status':
          aValue = a.status || ''
          bValue = b.status || ''
          break
        default:
          return 0
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1
      return 0
    })
    
    return sorted
  }, [invoices, sortConfig])

  // Handle pagination
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedInvoices = sortedInvoices.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    onFiltersChange?.({ ...filters, page, limit: pageSize })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    onFiltersChange?.({ ...filters, page: 1, limit: size })
  }

  // Handle individual invoice actions
  const handleInvoiceAction = async (invoice: InvoiceWithDetails, action: string, data?: any) => {
    try {
      switch (action) {
        case 'view':
          // Navigate to invoice view
          window.location.href = `/dashboard/invoices/${invoice.id}`
          break
        case 'edit':
          // Navigate to invoice edit
          window.location.href = `/dashboard/invoices/${invoice.id}/edit`
          break
        case 'updateStatus':
          await updateInvoiceStatus(invoice.id, data.status)
          toast.success('Invoice status updated successfully')
          break
        case 'delete':
          if (confirm('Are you sure you want to delete this invoice?')) {
            await deleteInvoice(invoice.id)
            toast.success('Invoice deleted successfully')
          }
          break
        case 'duplicate':
          // Handle duplicate logic
          toast.info('Duplicate functionality coming soon')
          break
        case 'downloadPdf':
          // Handle PDF download
          toast.info('PDF download coming soon')
          break
        default:
          toast.info(`${action} functionality coming soon`)
      }
    } catch (error) {
      toast.error(`Failed to ${action} invoice`)
      console.error(`Failed to ${action}:`, error)
    }
  }

  // Handle bulk actions
  const handleBulkAction = async (action: BulkActionType, data?: any) => {
    const selectedInvoiceObjects = invoices.filter(inv => selectedInvoices.includes(inv.id))
    
    try {
      switch (action) {
        case 'mark_paid':
          for (const invoice of selectedInvoiceObjects) {
            await updateInvoiceStatus(invoice.id, data.status)
          }
          break
        case 'delete':
          for (const invoice of selectedInvoiceObjects) {
            await deleteInvoice(invoice.id)
          }
          break
        case 'send_reminder':
        case 'export_pdf':
        case 'export_csv':
        default:
          toast.info(`${action} functionality coming soon`)
          return
      }
      
      toast.success(`Bulk ${action} completed successfully`)
    } catch (error) {
      toast.error(`Failed to perform bulk ${action}`)
      console.error(`Bulk ${action} failed:`, error)
    }
  }

  // Render sort icon
  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ChevronsUpDown className="h-4 w-4" />
    }
    return sortConfig.order === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />
  }

  // Calculate selection state
  const isAllSelected = paginatedInvoices.length > 0 && selectedInvoices.length === paginatedInvoices.length
  const isPartiallySelected = selectedInvoices.length > 0 && selectedInvoices.length < paginatedInvoices.length

  const selectedInvoiceObjects = invoices.filter(inv => selectedInvoices.includes(inv.id))

  return (
    <div className={cn('space-y-4', isRTL ? 'rtl' : 'ltr', className)}>
      {/* Bulk Actions Bar */}
      <BulkInvoiceActions
        selectedInvoices={selectedInvoiceObjects}
        onBulkAction={handleBulkAction}
        onClearSelection={clearSelection}
      />

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
          ) : paginatedInvoices.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium">
                {totalCount === 0
                  ? (locale === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet')
                  : (locale === 'ar' ? 'لا توجد فواتير مطابقة' : 'No matching invoices')
                }
              </h3>
              <p className="text-muted-foreground">
                {totalCount === 0
                  ? (locale === 'ar' ? 'أنشئ أول فاتورة لك للبدء' : 'Create your first invoice to get started')
                  : (locale === 'ar' ? 'جرب تعديل البحث أو الفلاتر' : 'Try adjusting your search or filters')
                }
              </p>
              {totalCount === 0 && (
                <Button
                  className="mt-4"
                  onClick={() => router.push(`/${locale}/dashboard/invoices/import`)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {locale === 'ar' ? 'رفع فواتير' : 'Import Invoices'}
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        indeterminate={isPartiallySelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all invoices"
                      />
                    </TableHead>
                    
                    <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('number')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        {t('invoices.invoiceNumber')}
                        {getSortIcon('number')}
                      </Button>
                    </TableHead>
                    
                    <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('customer_name')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        {t('invoices.customer')}
                        {getSortIcon('customer_name')}
                      </Button>
                    </TableHead>
                    
                    <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('amount')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        {t('invoices.amount')}
                        {getSortIcon('amount')}
                      </Button>
                    </TableHead>
                    
                    <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('due_date')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        {t('invoices.dueDate')}
                        {getSortIcon('due_date')}
                      </Button>
                    </TableHead>
                    
                    <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('status')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        {t('invoices.status')}
                        {getSortIcon('status')}
                      </Button>
                    </TableHead>
                    
                    <TableHead className={cn('w-12', isRTL ? 'text-right' : 'text-left')}>
                      {t('invoices.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => {
                    const isSelected = selectedInvoices.includes(invoice.id)
                    const isOverdue = invoice.status === 'OVERDUE' || 
                      (invoice.status === 'SENT' && new Date(invoice.due_date) < new Date())
                    
                    return (
                      <TableRow 
                        key={invoice.id}
                        className={cn(
                          'hover:bg-muted/50 transition-colors',
                          isSelected && 'bg-blue-50/50 hover:bg-blue-50/70',
                          isOverdue && 'border-l-4 border-l-red-500'
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              handleSelectInvoice(invoice.id, checked as boolean)
                            }
                            aria-label={`Select invoice ${invoice.number}`}
                          />
                        </TableCell>
                        
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="font-mono text-sm">{invoice.number}</span>
                            {invoice.trn_number && (
                              <span className="text-xs text-muted-foreground">
                                TRN: {invoice.trn_number}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {invoice.customer?.name || invoice.customer_name || 'Unknown Customer'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.customer?.email || invoice.customer_email}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-right">
                            <AEDAmount 
                              amount={invoice.amount} 
                              locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                              className="font-medium"
                            />
                            {invoice.vat_amount && invoice.vat_amount > 0 && (
                              <div className="text-xs text-muted-foreground">
                                VAT: <AEDAmount 
                                  amount={invoice.vat_amount} 
                                  locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                                  showCurrency={false}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <UAEDateDisplay 
                              date={invoice.due_date} 
                              locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                              className={isOverdue ? 'text-red-600 font-medium' : ''}
                            />
                            {isOverdue && (
                              <div className="text-xs text-red-600">
                                {locale === 'ar' ? 'متأخر' : 'Overdue'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <InvoiceStatusBadge 
                            status={invoice.status} 
                            locale={locale}
                          />
                        </TableCell>
                        
                        <TableCell>
                          <InvoiceActions
                            invoice={invoice}
                            onAction={(action, data) => handleInvoiceAction(invoice, action, data)}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {locale === 'ar' 
                        ? `عرض ${startIndex + 1}-${Math.min(endIndex, totalCount)} من ${totalCount}`
                        : `Showing ${startIndex + 1}-${Math.min(endIndex, totalCount)} of ${totalCount}`
                      }
                    </span>
                    
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                      className="ml-2 px-2 py-1 border rounded text-sm"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    
                    <span className="text-xs">
                      {locale === 'ar' ? 'لكل صفحة' : 'per page'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      {locale === 'ar' ? 'السابق' : 'Previous'}
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 7) {
                          pageNum = i + 1
                        } else {
                          if (currentPage <= 4) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 3) {
                            pageNum = totalPages - 6 + i
                          } else {
                            pageNum = currentPage - 3 + i
                          }
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      {locale === 'ar' ? 'التالي' : 'Next'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </LoadingOverlay>
      </Card>
    </div>
  )
}