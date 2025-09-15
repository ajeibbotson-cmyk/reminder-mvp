'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatUAECurrency } from '@/lib/vat-calculator'
import { 
  CheckCircle, 
  Send, 
  Trash2, 
  FileDown, 
  Mail, 
  MoreVertical,
  X,
  AlertTriangle,
  DollarSign,
  FileText,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BulkActionType, InvoiceWithDetails } from '@/types/invoice'

interface BulkActionsToolbarProps {
  selectedInvoices: InvoiceWithDetails[]
  onClearSelection: () => void
  onBulkAction: (action: BulkActionType, invoiceIds: string[]) => Promise<void>
  className?: string
}

export function BulkActionsToolbar({
  selectedInvoices,
  onClearSelection,
  onBulkAction,
  className
}: BulkActionsToolbarProps) {
  const t = useTranslations('invoices')
  const locale = useLocale()
  const isRTL = locale === 'ar'
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    action: BulkActionType
    title: string
    description: string
    destructive?: boolean
  } | null>(null)

  if (selectedInvoices.length === 0) {
    return null
  }

  const invoiceIds = selectedInvoices.map(invoice => invoice.id)
  const totalAmount = selectedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  
  // Calculate status counts
  const statusCounts = selectedInvoices.reduce((acc, invoice) => {
    acc[invoice.status] = (acc[invoice.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Determine available actions based on selected invoices
  const canMarkSent = selectedInvoices.some(invoice => invoice.status === 'DRAFT')
  const canMarkPaid = selectedInvoices.some(invoice => ['SENT', 'OVERDUE'].includes(invoice.status))
  const canMarkOverdue = selectedInvoices.some(invoice => invoice.status === 'SENT')
  const canDelete = selectedInvoices.every(invoice => invoice.status === 'DRAFT')

  const handleAction = async (action: BulkActionType) => {
    let title: string
    let description: string
    let destructive = false

    switch (action) {
      case 'mark_sent':
        title = locale === 'ar' ? 'تأكيد إرسال الفواتير' : 'Confirm Send Invoices'
        description = locale === 'ar' 
          ? `هل أنت متأكد من إرسال ${selectedInvoices.length} فاتورة؟`
          : `Are you sure you want to send ${selectedInvoices.length} invoice(s)?`
        break
      case 'mark_paid':
        title = locale === 'ar' ? 'تأكيد تحديد كمدفوعة' : 'Confirm Mark as Paid'
        description = locale === 'ar' 
          ? `هل أنت متأكد من تحديد ${selectedInvoices.length} فاتورة كمدفوعة؟`
          : `Are you sure you want to mark ${selectedInvoices.length} invoice(s) as paid?`
        break
      case 'mark_overdue':
        title = locale === 'ar' ? 'تأكيد تحديد كمتأخرة' : 'Confirm Mark as Overdue'
        description = locale === 'ar' 
          ? `هل أنت متأكد من تحديد ${selectedInvoices.length} فاتورة كمتأخرة؟`
          : `Are you sure you want to mark ${selectedInvoices.length} invoice(s) as overdue?`
        break
      case 'delete':
        title = locale === 'ar' ? 'تأكيد حذف الفواتير' : 'Confirm Delete Invoices'
        description = locale === 'ar' 
          ? `هل أنت متأكد من حذف ${selectedInvoices.length} فاتورة؟ هذا الإجراء لا يمكن التراجع عنه.`
          : `Are you sure you want to delete ${selectedInvoices.length} invoice(s)? This action cannot be undone.`
        destructive = true
        break
      case 'send_reminder':
        title = locale === 'ar' ? 'إرسال تذكير' : 'Send Reminder'
        description = locale === 'ar' 
          ? `إرسال تذكير بالدفع لـ ${selectedInvoices.length} فاتورة؟`
          : `Send payment reminder for ${selectedInvoices.length} invoice(s)?`
        break
      case 'export_pdf':
      case 'export_csv':
        // Execute immediately for export actions
        executeAction(action)
        return
      default:
        return
    }

    setConfirmAction({ action, title, description, destructive })
  }

  const executeAction = async (action: BulkActionType) => {
    setIsProcessing(true)
    try {
      await onBulkAction(action, invoiceIds)
      
      let successMessage: string
      switch (action) {
        case 'mark_sent':
          successMessage = locale === 'ar' ? 'تم إرسال الفواتير بنجاح' : 'Invoices sent successfully'
          break
        case 'mark_paid':
          successMessage = locale === 'ar' ? 'تم تحديد الفواتير كمدفوعة' : 'Invoices marked as paid'
          break
        case 'mark_overdue':
          successMessage = locale === 'ar' ? 'تم تحديد الفواتير كمتأخرة' : 'Invoices marked as overdue'
          break
        case 'delete':
          successMessage = locale === 'ar' ? 'تم حذف الفواتير' : 'Invoices deleted'
          break
        case 'send_reminder':
          successMessage = locale === 'ar' ? 'تم إرسال التذكيرات' : 'Reminders sent'
          break
        case 'export_pdf':
          successMessage = locale === 'ar' ? 'تم تصدير PDF' : 'PDF exported'
          break
        case 'export_csv':
          successMessage = locale === 'ar' ? 'تم تصدير CSV' : 'CSV exported'
          break
        default:
          successMessage = locale === 'ar' ? 'تم تنفيذ الإجراء بنجاح' : 'Action completed successfully'
      }
      
      toast.success(successMessage)
      onClearSelection()
    } catch (error) {
      toast.error(
        locale === 'ar' ? 'فشل في تنفيذ الإجراء' : 'Failed to execute action'
      )
      console.error('Bulk action failed:', error)
    } finally {
      setIsProcessing(false)
      setConfirmAction(null)
    }
  }

  return (
    <>
      <Card className={cn('border-blue-200 bg-blue-50/50', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {selectedInvoices.length} {' '}
                  {locale === 'ar' 
                    ? (selectedInvoices.length === 1 ? 'فاتورة محددة' : 'فاتورة محددة')
                    : (selectedInvoices.length === 1 ? 'invoice selected' : 'invoices selected')
                  }
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatUAECurrency(totalAmount, 'AED')}
                </Badge>
                
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="text-xs">
                    {count} {status}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Actions */}
              {canMarkSent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('mark_sent')}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {locale === 'ar' ? 'إرسال' : 'Send'}
                </Button>
              )}

              {canMarkPaid && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('mark_paid')}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {locale === 'ar' ? 'تحديد كمدفوعة' : 'Mark Paid'}
                </Button>
              )}

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isProcessing}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {locale === 'ar' ? 'إجراءات الحالة' : 'Status Actions'}
                  </DropdownMenuLabel>
                  
                  {canMarkOverdue && (
                    <DropdownMenuItem onClick={() => handleAction('mark_overdue')}>
                      <Clock className="h-4 w-4 mr-2" />
                      {locale === 'ar' ? 'تحديد كمتأخرة' : 'Mark Overdue'}
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuItem onClick={() => handleAction('send_reminder')}>
                    <Mail className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'إرسال تذكير' : 'Send Reminder'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>
                    {locale === 'ar' ? 'التصدير' : 'Export'}
                  </DropdownMenuLabel>
                  
                  <DropdownMenuItem onClick={() => handleAction('export_pdf')}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => handleAction('export_csv')}>
                    <FileText className="h-4 w-4 mr-2" />
                    {locale === 'ar' ? 'تصدير CSV' : 'Export CSV'}
                  </DropdownMenuItem>
                  
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleAction('delete')}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {locale === 'ar' ? 'حذف' : 'Delete'}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear Selection */}
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                {locale === 'ar' ? 'إلغاء التحديد' : 'Clear'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={!!confirmAction} 
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmAction?.destructive ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-blue-500" />
              )}
              {confirmAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeAction(confirmAction.action)}
              className={cn(
                confirmAction?.destructive && 'bg-red-600 hover:bg-red-700'
              )}
            >
              {locale === 'ar' ? 'تأكيد' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}