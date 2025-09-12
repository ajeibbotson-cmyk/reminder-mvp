'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { 
  CheckSquare, 
  Mail, 
  Download, 
  Trash2, 
  Archive, 
  RefreshCw,
  AlertCircle,
  Send,
  FileText,
  CreditCard,
  Calendar,
  Filter,
  X
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AEDAmount, InvoiceStatusBadge } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

export interface BulkInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  amount: number
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  dueDate: Date
  customerEmail?: string
  isSelected?: boolean
}

export interface BulkOperation {
  id: string
  label: string
  icon: React.ComponentType<any>
  description: string
  requiresConfirmation?: boolean
  confirmationMessage?: string
  allowedStatuses?: Array<'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'>
  minSelection?: number
  maxSelection?: number
}

interface BulkOperationsPanelProps {
  invoices: BulkInvoice[]
  onInvoiceSelect?: (invoiceId: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  onBulkOperation?: (operationId: string, invoiceIds: string[]) => Promise<void>
  isLoading?: boolean
  locale?: string
  className?: string
}

const BULK_OPERATIONS: BulkOperation[] = [
  {
    id: 'mark-paid',
    label: 'Mark as Paid',
    icon: CheckSquare,
    description: 'Mark selected invoices as paid',
    requiresConfirmation: true,
    confirmationMessage: 'Are you sure you want to mark the selected invoices as paid?',
    allowedStatuses: ['PENDING', 'OVERDUE'],
    minSelection: 1
  },
  {
    id: 'mark-overdue',
    label: 'Mark as Overdue',
    icon: AlertCircle,
    description: 'Mark selected invoices as overdue',
    requiresConfirmation: true,
    confirmationMessage: 'This will mark selected invoices as overdue and may trigger reminder emails.',
    allowedStatuses: ['PENDING'],
    minSelection: 1
  },
  {
    id: 'send-reminder',
    label: 'Send Reminders',
    icon: Mail,
    description: 'Send payment reminder emails',
    requiresConfirmation: true,
    confirmationMessage: 'This will send reminder emails to customers for the selected invoices.',
    allowedStatuses: ['PENDING', 'OVERDUE'],
    minSelection: 1
  },
  {
    id: 'generate-report',
    label: 'Generate Report',
    icon: FileText,
    description: 'Generate a detailed report for selected invoices',
    minSelection: 1
  },
  {
    id: 'export-csv',
    label: 'Export to CSV',
    icon: Download,
    description: 'Export selected invoices to CSV file',
    minSelection: 1
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    description: 'Archive selected invoices',
    requiresConfirmation: true,
    confirmationMessage: 'Archived invoices will be moved to the archive section.',
    allowedStatuses: ['PAID', 'CANCELLED'],
    minSelection: 1
  }
]

export function BulkOperationsPanel({
  invoices,
  onInvoiceSelect,
  onSelectAll,
  onBulkOperation,
  isLoading = false,
  locale = 'en',
  className
}: BulkOperationsPanelProps) {
  const t = useTranslations('bulkOperations')
  const [selectedOperation, setSelectedOperation] = useState<BulkOperation | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const selectedInvoices = invoices.filter(invoice => invoice.isSelected)
  const selectedCount = selectedInvoices.length
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  const filteredInvoices = statusFilter === 'all' 
    ? invoices 
    : invoices.filter(inv => inv.status === statusFilter)

  const allSelected = filteredInvoices.length > 0 && 
    filteredInvoices.every(invoice => invoice.isSelected)
  const someSelected = filteredInvoices.some(invoice => invoice.isSelected)

  const getAvailableOperations = () => {
    return BULK_OPERATIONS.filter(operation => {
      // Check minimum selection
      if (operation.minSelection && selectedCount < operation.minSelection) {
        return false
      }

      // Check maximum selection
      if (operation.maxSelection && selectedCount > operation.maxSelection) {
        return false
      }

      // Check allowed statuses
      if (operation.allowedStatuses) {
        return selectedInvoices.some(invoice => 
          operation.allowedStatuses!.includes(invoice.status)
        )
      }

      return true
    })
  }

  const handleSelectAll = (checked: boolean) => {
    filteredInvoices.forEach(invoice => {
      onInvoiceSelect?.(invoice.id, checked)
    })
    onSelectAll?.(checked)
  }

  const handleOperationSelect = (operation: BulkOperation) => {
    setSelectedOperation(operation)
    if (operation.requiresConfirmation) {
      setShowConfirmation(true)
    } else {
      executeOperation(operation)
    }
  }

  const executeOperation = async (operation: BulkOperation) => {
    if (selectedCount === 0) return

    try {
      await onBulkOperation?.(operation.id, selectedInvoices.map(inv => inv.id))
      setShowConfirmation(false)
      setSelectedOperation(null)
    } catch (error) {
      console.error('Bulk operation failed:', error)
    }
  }

  const getOperationCount = (operation: BulkOperation) => {
    if (!operation.allowedStatuses) return selectedCount
    
    return selectedInvoices.filter(invoice => 
      operation.allowedStatuses!.includes(invoice.status)
    ).length
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Selection Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                {t('bulkOperations')}
              </CardTitle>
              <CardDescription>
                {selectedCount > 0 ? (
                  <span>
                    {t('selectedInvoices', { count: selectedCount })} • 
                    <AEDAmount amount={totalAmount} className="font-medium ml-1" />
                  </span>
                ) : (
                  t('selectInvoicesDescription')
                )}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatuses')}</SelectItem>
                  <SelectItem value="PENDING">{t('pending')}</SelectItem>
                  <SelectItem value="OVERDUE">{t('overdue')}</SelectItem>
                  <SelectItem value="PAID">{t('paid')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Select All Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  ref={(ref) => {
                    if (ref) ref.indeterminate = someSelected && !allSelected
                  }}
                  onCheckedChange={handleSelectAll}
                  disabled={isLoading}
                />
                <span className="text-sm">
                  {t('selectAll')} ({filteredInvoices.length})
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Quick Stats */}
        {selectedCount > 0 && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{selectedCount}</div>
                <div className="text-xs text-blue-600">{t('selected')}</div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  <AEDAmount amount={totalAmount} />
                </div>
                <div className="text-xs text-green-600">{t('totalValue')}</div>
              </div>

              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {selectedInvoices.filter(inv => inv.status === 'OVERDUE').length}
                </div>
                <div className="text-xs text-orange-600">{t('overdue')}</div>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {selectedInvoices.filter(inv => inv.customerEmail).length}
                </div>
                <div className="text-xs text-purple-600">{t('withEmail')}</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Operations Grid */}
      {selectedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('availableOperations')}</CardTitle>
            <CardDescription>
              {t('operationsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getAvailableOperations().map((operation) => {
                const Icon = operation.icon
                const operationCount = getOperationCount(operation)
                const isDisabled = operationCount === 0 || isLoading

                return (
                  <Button
                    key={operation.id}
                    variant="outline"
                    className={cn(
                      "h-auto p-4 justify-start text-left",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !isDisabled && handleOperationSelect(operation)}
                    disabled={isDisabled}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Icon className="h-5 w-5 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{t(operation.id)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {t(`${operation.id}Description`)}
                        </div>
                        {operationCount > 0 && (
                          <Badge variant="secondary" className="mt-2">
                            {t('affectsCount', { count: operationCount })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>

            {getAvailableOperations().length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('noOperationsAvailable')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceList')}</CardTitle>
          <CardDescription>
            {t('selectInvoicesForBulkOperations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length > 0 ? (
            <div className="space-y-2">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={cn(
                    "flex items-center gap-4 p-3 border rounded-lg transition-colors",
                    invoice.isSelected && "bg-blue-50 border-blue-200"
                  )}
                >
                  <Checkbox
                    checked={invoice.isSelected || false}
                    onCheckedChange={(checked) => 
                      onInvoiceSelect?.(invoice.id, checked as boolean)
                    }
                    disabled={isLoading}
                  />
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <div className="font-medium">{invoice.invoiceNumber}</div>
                      <div className="text-sm text-gray-600">{invoice.customerName}</div>
                    </div>
                    
                    <div>
                      <AEDAmount amount={invoice.amount} className="font-medium" />
                    </div>
                    
                    <div>
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {t('due')}: {new Date(invoice.dueDate).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('noInvoicesFound')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('confirmOperation')} - {selectedOperation && t(selectedOperation.id)}
            </DialogTitle>
            <DialogDescription>
              {selectedOperation?.confirmationMessage || t('confirmationMessage')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('affectedInvoices', { count: selectedCount })}
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => selectedOperation && executeOperation(selectedOperation)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {t('processing')}
                  </>
                ) : (
                  <>
                    {selectedOperation?.icon && <selectedOperation.icon className="h-4 w-4 mr-2" />}
                    {t('confirm')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}