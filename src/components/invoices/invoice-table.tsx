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
  CurrencyAmount,
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

type SortField = 'number' | 'customerName' | 'amount' | 'dueDate' | 'createdAt' | 'status'
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
    field: 'createdAt',
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
      sortBy: field,
      sortOrder: newOrder,
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
        case 'customerName':
          aValue = a.customerName || ''
          bValue = b.customerName || ''
          break
        case 'amount':
          aValue = a.amount || 0
          bValue = b.amount || 0
          break
        case 'dueDate':
          aValue = new Date(a.dueDate || 0).getTime()
          bValue = new Date(b.dueDate || 0).getTime()
          break
        case 'createdAt':
          aValue = new Date(a.createdAt || 0).getTime()
          bValue = new Date(b.createdAt || 0).getTime()
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
          // Navigate to invoice view (use router with locale)
          router.push(`/${locale}/dashboard/invoices/${invoice.id}`)
          break
        case 'edit':
          // Edit page not yet implemented - show view page instead
          router.push(`/${locale}/dashboard/invoices/${invoice.id}`)
          toast.info('Edit mode coming soon - viewing invoice details')
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
              <div className="px-4">
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        indeterminate={isPartiallySelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all invoices"
                      />
                    </TableHead>

                    <TableHead className="w-[140px]">
                      <button
                        onClick={() => handleSort('number')}
                        className="flex items-center gap-1 font-medium hover:text-foreground/80"
                      >
                        {t('invoices.invoiceNumber')}
                        {getSortIcon('number')}
                      </button>
                    </TableHead>

                    <TableHead>
                      <button
                        onClick={() => handleSort('customerName')}
                        className="flex items-center gap-1 font-medium hover:text-foreground/80"
                      >
                        {t('invoices.customer')}
                        {getSortIcon('customerName')}
                      </button>
                    </TableHead>

                    <TableHead className="w-[140px] text-right pr-4">
                      <button
                        onClick={() => handleSort('amount')}
                        className="flex items-center gap-1 font-medium hover:text-foreground/80 ml-auto"
                      >
                        {t('invoices.amount')}
                        {getSortIcon('amount')}
                      </button>
                    </TableHead>

                    <TableHead className="w-[120px]">
                      <button
                        onClick={() => handleSort('dueDate')}
                        className="flex items-center gap-1 font-medium hover:text-foreground/80"
                      >
                        {t('invoices.dueDate')}
                        {getSortIcon('dueDate')}
                      </button>
                    </TableHead>

                    <TableHead className="w-[100px]">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 font-medium hover:text-foreground/80"
                      >
                        {t('invoices.status')}
                        {getSortIcon('status')}
                      </button>
                    </TableHead>

                    <TableHead className="w-[70px]">
                      {t('invoices.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => {
                    const isSelected = selectedInvoices.includes(invoice.id)
                    const isOverdue = invoice.status === 'OVERDUE' ||
                      (invoice.status === 'SENT' && new Date(invoice.dueDate) < new Date())

                    return (
                      <TableRow
                        key={invoice.id}
                        className={cn(
                          'hover:bg-muted/50 transition-colors',
                          isSelected && 'bg-blue-50/50 hover:bg-blue-50/70'
                        )}
                      >
                        <TableCell className="w-[50px]">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectInvoice(invoice.id, checked as boolean)
                            }
                            aria-label={`Select invoice ${invoice.number}`}
                          />
                        </TableCell>

                        <TableCell className="w-[140px]">
                          <span className="font-mono text-sm">{invoice.number}</span>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {invoice.customer?.name || invoice.customerName || 'Unknown Customer'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.customer?.email || invoice.customerEmail}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="w-[140px] text-right pr-4">
                          <CurrencyAmount
                            amount={invoice.amount}
                            currency={invoice.currency || 'AED'}
                            locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                            className="font-medium"
                          />
                        </TableCell>

                        <TableCell className="w-[120px]">
                          <UAEDateDisplay
                            date={invoice.dueDate}
                            locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                            className={isOverdue ? 'text-red-600 font-medium' : ''}
                          />
                        </TableCell>

                        <TableCell className="w-[100px]">
                          <InvoiceStatusBadge
                            status={invoice.status}
                            locale={locale}
                          />
                        </TableCell>

                        <TableCell className="w-[70px]">
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
            </div>

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