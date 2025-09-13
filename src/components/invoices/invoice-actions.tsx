'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { InvoiceWithDetails, BulkActionType } from '@/types/invoice'
import { InvoiceStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Mail,
  FileDown,
  Copy,
  Calendar,
  DollarSign,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface InvoiceActionsProps {
  invoice: InvoiceWithDetails
  onAction: (action: string, data?: any) => Promise<void>
  className?: string
}

interface BulkActionsProps {
  selectedInvoices: InvoiceWithDetails[]
  onBulkAction: (action: BulkActionType, data?: any) => Promise<void>
  onClearSelection: () => void
  className?: string
}

const STATUS_TRANSITIONS = {
  'DRAFT': ['SENT'],
  'SENT': ['PAID', 'OVERDUE', 'DISPUTED'],
  'OVERDUE': ['PAID', 'DISPUTED', 'WRITTEN_OFF'],
  'PAID': ['DISPUTED'],
  'DISPUTED': ['PAID', 'WRITTEN_OFF'],
  'WRITTEN_OFF': []
}

export function InvoiceActions({ invoice, onAction, className }: InvoiceActionsProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: string, data?: any) => {
    setLoading(true)
    try {
      await onAction(action, data)
      toast.success(
        locale === 'ar' ? 'تم تنفيذ العملية بنجاح' : 'Action completed successfully'
      )
    } catch (error) {
      toast.error(
        locale === 'ar' ? 'فشل في تنفيذ العملية' : 'Action failed'
      )
    } finally {
      setLoading(false)
    }
  }

  const availableStatusTransitions = STATUS_TRANSITIONS[invoice.status] || []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={cn("h-8 w-8 p-0", className)}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-48">
        <DropdownMenuLabel>
          {locale === 'ar' ? 'إجراءات الفاتورة' : 'Invoice Actions'}
        </DropdownMenuLabel>
        
        <DropdownMenuItem onClick={() => handleAction('view')}>
          <Eye className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'عرض' : 'View'}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleAction('edit')}>
          <Edit className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'تعديل' : 'Edit'}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleAction('duplicate')}>
          <Copy className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'نسخ' : 'Duplicate'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Status Transitions */}
        {availableStatusTransitions.length > 0 && (
          <>
            <DropdownMenuLabel>
              {locale === 'ar' ? 'تغيير الحالة' : 'Change Status'}
            </DropdownMenuLabel>
            {availableStatusTransitions.map((status) => (
              <DropdownMenuItem 
                key={status}
                onClick={() => handleAction('updateStatus', { status })}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {getStatusLabel(status, locale)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Communication Actions */}
        {invoice.status !== 'DRAFT' && (
          <DropdownMenuItem onClick={() => handleAction('sendReminder')}>
            <Send className="h-4 w-4 mr-2" />
            {locale === 'ar' ? 'إرسال تذكير' : 'Send Reminder'}
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={() => handleAction('sendEmail')}>
          <Mail className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'إرسال بريد إلكتروني' : 'Send Email'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Export Actions */}
        <DropdownMenuItem onClick={() => handleAction('downloadPdf')}>
          <Download className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'تحميل PDF' : 'Download PDF'}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleAction('print')}>
          <FileDown className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'طباعة' : 'Print'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Payment Actions */}
        {invoice.status !== 'PAID' && (
          <DropdownMenuItem onClick={() => handleAction('recordPayment')}>
            <DollarSign className="h-4 w-4 mr-2" />
            {locale === 'ar' ? 'تسجيل دفعة' : 'Record Payment'}
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={() => handleAction('viewPayments')}>
          <Calendar className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'عرض المدفوعات' : 'View Payments'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Danger Actions */}
        <DropdownMenuItem 
          className="text-red-600 focus:text-red-600"
          onClick={() => handleAction('delete')}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'حذف' : 'Delete'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BulkInvoiceActions({ 
  selectedInvoices, 
  onBulkAction, 
  onClearSelection,
  className 
}: BulkActionsProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  
  const [loading, setLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action?: BulkActionType
    title: string
    description: string
    confirmText: string
    data?: any
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: ''
  })

  const handleBulkAction = async (action: BulkActionType, data?: any) => {
    // Show confirmation dialog for destructive actions
    if (action === 'delete') {
      setConfirmDialog({
        isOpen: true,
        action,
        title: locale === 'ar' ? 'حذف الفواتير المحددة' : 'Delete Selected Invoices',
        description: locale === 'ar' 
          ? `هل أنت متأكد من حذف ${selectedInvoices.length} فاتورة؟ لا يمكن التراجع عن هذا الإجراء.`
          : `Are you sure you want to delete ${selectedInvoices.length} invoices? This action cannot be undone.`,
        confirmText: locale === 'ar' ? 'حذف' : 'Delete',
        data
      })
      return
    }

    await executeBulkAction(action, data)
  }

  const executeBulkAction = async (action: BulkActionType, data?: any) => {
    setLoading(true)
    try {
      await onBulkAction(action, data)
      toast.success(
        locale === 'ar' 
          ? `تم تنفيذ العملية على ${selectedInvoices.length} فاتورة`
          : `Action completed for ${selectedInvoices.length} invoices`
      )
      onClearSelection()
    } catch (error) {
      toast.error(
        locale === 'ar' ? 'فشل في تنفيذ العملية' : 'Bulk action failed'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (confirmDialog.action) {
      executeBulkAction(confirmDialog.action, confirmDialog.data)
    }
    setConfirmDialog({ ...confirmDialog, isOpen: false })
  }

  const selectedCount = selectedInvoices.length
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  if (selectedCount === 0) return null

  return (
    <>
      <Card className={cn('mb-4 border-blue-200 bg-blue-50/50', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Checkbox checked={true} readOnly />
              <div>
                <div className="font-medium">
                  {locale === 'ar' 
                    ? `${selectedCount} فاتورة محددة`
                    : `${selectedCount} invoices selected`
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  {locale === 'ar' 
                    ? `القيمة الإجمالية: ${totalAmount.toLocaleString('ar-AE', { style: 'currency', currency: 'AED' })}`
                    : `Total value: ${totalAmount.toLocaleString('en-AE', { style: 'currency', currency: 'AED' })}`
                  }
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Change Dropdown */}
              <Select onValueChange={(value) => handleBulkAction('mark_paid', { status: value })}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder={locale === 'ar' ? 'تغيير الحالة' : 'Change Status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SENT">
                    {locale === 'ar' ? 'مرسلة' : 'Sent'}
                  </SelectItem>
                  <SelectItem value="PAID">
                    {locale === 'ar' ? 'مدفوعة' : 'Paid'}
                  </SelectItem>
                  <SelectItem value="OVERDUE">
                    {locale === 'ar' ? 'متأخرة' : 'Overdue'}
                  </SelectItem>
                  <SelectItem value="DISPUTED">
                    {locale === 'ar' ? 'متنازع عليها' : 'Disputed'}
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('send_reminder')}
                disabled={loading}
              >
                <Send className="h-4 w-4 mr-2" />
                {locale === 'ar' ? 'إرسال تذكير' : 'Send Reminders'}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={loading}>
                    <Download className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'تصدير' : 'Export'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem 
                    onClick={() => handleBulkAction('export_pdf')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'PDF' : 'Export as PDF'}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleBulkAction('export_csv')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'CSV' : 'Export as CSV'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {locale === 'ar' ? 'حذف' : 'Delete'}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
              >
                {locale === 'ar' ? 'إلغاء التحديد' : 'Clear Selection'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog({...confirmDialog, isOpen: open})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({...confirmDialog, isOpen: false})}
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              {confirmDialog.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper function to get status labels
function getStatusLabel(status: InvoiceStatus, locale: string): string {
  const labels = {
    'DRAFT': { en: 'Draft', ar: 'مسودة' },
    'SENT': { en: 'Sent', ar: 'مرسلة' },
    'OVERDUE': { en: 'Overdue', ar: 'متأخرة' },
    'PAID': { en: 'Paid', ar: 'مدفوعة' },
    'DISPUTED': { en: 'Disputed', ar: 'متنازع عليها' },
    'WRITTEN_OFF': { en: 'Written Off', ar: 'شطب' }
  }
  
  return locale === 'ar' ? labels[status].ar : labels[status].en
}