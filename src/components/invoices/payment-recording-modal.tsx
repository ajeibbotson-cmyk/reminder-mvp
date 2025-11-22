'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatUAECurrency } from '@/lib/vat-calculator'
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Receipt, 
  CheckCircle, 
  AlertTriangle,
  Save,
  Calculator
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CreatePaymentFormData, PAYMENT_METHOD_LABELS } from '@/types/invoice'

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Payment amount must be greater than 0'),
  payment_date: z.string().min(1, 'Payment date is required'),
  method: z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'CHEQUE', 'OTHER'], {
    required_error: 'Payment method is required'
  }),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PaymentRecordingModalProps {
  invoice: {
    id: string
    number: string
    customer_name: string
    total_amount: number
    paid_amount?: number
    currency: string
    status: string
  }
  onPaymentRecorded?: (payment: CreatePaymentFormData) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PaymentRecordingModal({
  invoice,
  onPaymentRecorded,
  trigger,
  open,
  onOpenChange
}: PaymentRecordingModalProps) {
  const t = useTranslations('payments')
  const locale = useLocale()
  const isRTL = locale === 'ar'
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen

  const remainingAmount = invoice.totalAmount - (invoice.paidAmount || 0)
  const isFullyPaid = remainingAmount <= 0
  const canRecordPayment = !isFullyPaid && ['SENT', 'OVERDUE'].includes(invoice.status)

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: remainingAmount > 0 ? remainingAmount : 0,
      payment_date: new Date().toISOString().split('T')[0],
      method: 'BANK_TRANSFER',
      reference: '',
      notes: '',
    },
  })

  const watchAmount = form.watch('amount')
  const isPartialPayment = watchAmount < remainingAmount
  const isOverpayment = watchAmount > remainingAmount

  const onSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true)
    try {
      const paymentData: CreatePaymentFormData = {
        invoice_id: invoice.id,
        amount: data.amount,
        payment_date: data.payment_date,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      }

      await onPaymentRecorded?.(paymentData)
      
      toast.success(
        locale === 'ar' 
          ? 'تم تسجيل الدفعة بنجاح' 
          : 'Payment recorded successfully'
      )
      
      setOpen(false)
      form.reset()
    } catch (error) {
      toast.error(
        locale === 'ar' 
          ? 'فشل في تسجيل الدفعة' 
          : 'Failed to record payment'
      )
      console.error('Failed to record payment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickAmount = (percentage: number) => {
    const amount = remainingAmount * (percentage / 100)
    form.setValue('amount', Number(amount.toFixed(2)))
  }

  if (!canRecordPayment) {
    return (
      <Dialog open={isOpen} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {locale === 'ar' ? 'لا يمكن تسجيل دفعة' : 'Cannot Record Payment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isFullyPaid 
                  ? (locale === 'ar' ? 'هذه الفاتورة مدفوعة بالكامل' : 'This invoice is fully paid')
                  : (locale === 'ar' 
                      ? 'يمكن تسجيل الدفعات فقط للفواتير المرسلة أو المتأخرة' 
                      : 'Payments can only be recorded for sent or overdue invoices'
                    )
                }
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {locale === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn('sm:max-w-lg', isRTL && 'rtl')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            {locale === 'ar' ? 'تسجيل دفعة جديدة' : 'Record New Payment'}
          </DialogTitle>
          <DialogDescription>
            {locale === 'ar' 
              ? `تسجيل دفعة للفاتورة #${invoice.number} - ${invoice.customerName}`
              : `Record a payment for Invoice #${invoice.number} - ${invoice.customerName}`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Summary */}
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-green-900">
              <Receipt className="h-4 w-4" />
              {locale === 'ar' ? 'ملخص الفاتورة' : 'Invoice Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-700 font-medium">
                  {locale === 'ar' ? 'إجمالي الفاتورة' : 'Invoice Total'}
                </p>
                <p className="text-lg font-semibold text-green-900">
                  {formatUAECurrency(invoice.totalAmount, invoice.currency)}
                </p>
              </div>
              <div>
                <p className="text-green-700 font-medium">
                  {locale === 'ar' ? 'المبلغ المستحق' : 'Amount Due'}
                </p>
                <p className="text-lg font-semibold text-green-900">
                  {formatUAECurrency(remainingAmount, invoice.currency)}
                </p>
              </div>
            </div>
            {invoice.paidAmount && invoice.paidAmount > 0 && (
              <div className="pt-2 border-t border-green-200">
                <p className="text-sm text-green-700">
                  {locale === 'ar' ? 'المدفوع سابقاً' : 'Previously Paid'}: {' '}
                  <span className="font-medium">
                    {formatUAECurrency(invoice.paidAmount, invoice.currency)}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Quick Amount Buttons */}
            <div className="space-y-2">
              <FormLabel>{locale === 'ar' ? 'مبالغ سريعة' : 'Quick Amounts'}</FormLabel>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(25)}
                  className="gap-1"
                >
                  25% <span className="text-xs">({formatUAECurrency(remainingAmount * 0.25, invoice.currency)})</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(50)}
                  className="gap-1"
                >
                  50% <span className="text-xs">({formatUAECurrency(remainingAmount * 0.5, invoice.currency)})</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(100)}
                  className="gap-1"
                >
                  {locale === 'ar' ? 'كامل' : 'Full'} <span className="text-xs">({formatUAECurrency(remainingAmount, invoice.currency)})</span>
                </Button>
              </div>
            </div>

            {/* Payment Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {locale === 'ar' ? 'مبلغ الدفعة' : 'Payment Amount'} *
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        min="0.01" 
                        max={remainingAmount * 1.1} // Allow slight overpayment
                        placeholder="0.00"
                        className="pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {invoice.currency}
                      </div>
                    </div>
                  </FormControl>
                  {isPartialPayment && (
                    <FormDescription className="text-orange-600">
                      {locale === 'ar' 
                        ? 'دفعة جزئية - سيبقى مبلغ مستحق'
                        : 'Partial payment - remaining amount will be due'
                      }
                    </FormDescription>
                  )}
                  {isOverpayment && (
                    <FormDescription className="text-red-600">
                      {locale === 'ar' 
                        ? 'المبلغ أكبر من المستحق - سيتم إنشاء رصيد'
                        : 'Amount exceeds due amount - credit will be created'
                      }
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Date */}
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {locale === 'ar' ? 'تاريخ الدفع' : 'Payment Date'} *
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{locale === 'ar' ? 'طريقة الدفع' : 'Payment Method'} *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Reference Number */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{locale === 'ar' ? 'رقم المرجع' : 'Reference Number'}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder={locale === 'ar' 
                        ? 'رقم التحويل، رقم الشيك، إلخ'
                        : 'Transaction ID, check number, etc.'
                      } 
                    />
                  </FormControl>
                  <FormDescription>
                    {locale === 'ar' 
                      ? 'اختياري - يساعد في تتبع المدفوعات'
                      : 'Optional - helps with payment tracking'
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{locale === 'ar' ? 'ملاحظات' : 'Notes'}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder={locale === 'ar' 
                        ? 'ملاحظات إضافية حول الدفعة...'
                        : 'Additional notes about this payment...'
                      }
                      className="resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Save className="h-4 w-4 animate-spin" />
                    {locale === 'ar' ? 'جاري التسجيل...' : 'Recording...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {locale === 'ar' ? 'تسجيل الدفعة' : 'Record Payment'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}