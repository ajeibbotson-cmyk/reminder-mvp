'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, UserPlus, User, Building, Mail, Phone, Hash, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BusinessTypeSelect } from '@/components/ui/business-type-select'
import { TRNInput } from '@/components/ui/trn-input'
import { PaymentTermsSelect } from '@/components/ui/payment-terms-select'
import { createCustomerSchema, updateCustomerSchema, UAEBusinessType } from '@/lib/validations'
import { useCustomerStore } from '@/lib/stores/customer-store'
import { CustomerWithInvoices } from '@/lib/types/store'

interface CustomerFormDialogProps {
  companyId: string
  customer?: CustomerWithInvoices // For editing
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type CustomerFormData = z.infer<typeof createCustomerSchema>

export function CustomerFormDialog({
  companyId,
  customer,
  trigger,
  open,
  onOpenChange
}: CustomerFormDialogProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  const { addCustomer, updateCustomer } = useCustomerStore()

  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const isEditing = !!customer

  // Form schema - use create schema for new customers, update schema for editing
  const formSchema = isEditing ? updateCustomerSchema : createCustomerSchema

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: companyId,
      name: customer?.name || '',
      nameAr: customer?.name_ar || '',
      businessName: customer?.businessName || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      trn: customer?.trn || '',
      businessType: customer?.businessType as UAEBusinessType || undefined,
      paymentTerms: customer?.payment_terms || 30,
      creditLimit: customer?.credit_limit ? Number(customer.credit_limit) : undefined,
      notes: customer?.notes || '',
      notesAr: customer?.notes_ar || '',
    }
  })

  const onSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true)
    
    try {
      if (isEditing && customer) {
        await updateCustomer(customer.id, data)
        toast.success(
          locale === 'ar' 
            ? 'تم تحديث بيانات العميل بنجاح' 
            : 'Customer updated successfully'
        )
      } else {
        await addCustomer(data)
        toast.success(
          locale === 'ar' 
            ? 'تم إنشاء العميل بنجاح' 
            : 'Customer created successfully'
        )
        form.reset()
      }
      
      setOpen(false)
    } catch (error) {
      toast.error(
        locale === 'ar' 
          ? 'حدث خطأ أثناء معالجة البيانات' 
          : 'An error occurred while processing the request'
      )
      console.error('Customer form error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    if (isEditing && customer) {
      form.reset({
        name: customer.name,
        nameAr: customer.name_ar || '',
        businessName: customer.businessName || '',
        email: customer.email,
        phone: customer.phone || '',
        trn: customer.trn || '',
        businessType: customer.businessType as UAEBusinessType || undefined,
        paymentTerms: customer.payment_terms || 30,
        creditLimit: customer.credit_limit ? Number(customer.credit_limit) : undefined,
        notes: customer.notes || '',
        notesAr: customer.notes_ar || '',
      })
    } else {
      form.reset({
        companyId: companyId,
        name: '',
        nameAr: '',
        businessName: '',
        email: '',
        phone: '',
        trn: '',
        businessType: undefined,
        paymentTerms: 30,
        creditLimit: undefined,
        notes: '',
        notesAr: '',
      })
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      resetForm()
    }
    setOpen(open)
  }

  const defaultTrigger = (
    <Button>
      <UserPlus className="h-4 w-4 mr-2" />
      {locale === 'ar' ? 'إضافة عميل' : 'Add Customer'}
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${isRTL ? 'rtl' : 'ltr'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isEditing ? <User className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {isEditing 
              ? (locale === 'ar' ? 'تعديل بيانات العميل' : 'Edit Customer')
              : (locale === 'ar' ? 'إضافة عميل جديد' : 'Add New Customer')
            }
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? (locale === 'ar' 
                  ? 'قم بتحديث بيانات العميل حسب الحاجة' 
                  : 'Update the customer information as needed')
              : (locale === 'ar' 
                  ? 'أدخل بيانات العميل الجديد. الحقول المطلوبة مميزة بعلامة *' 
                  : 'Enter the new customer details. Required fields are marked with *')
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {locale === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {locale === 'ar' ? 'اسم العميل *' : 'Customer Name *'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={locale === 'ar' ? 'أدخل اسم العميل' : 'Enter customer name'}
                            className={isRTL ? 'text-right' : ''}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Arabic Name */}
                  <FormField
                    control={form.control}
                    name="nameAr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {locale === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={locale === 'ar' ? 'أدخل الاسم بالعربي' : 'Enter Arabic name'}
                            className="text-right"
                            dir="rtl"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          {locale === 'ar' ? 'البريد الإلكتروني *' : 'Email Address *'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder={locale === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter email address'}
                            dir="ltr"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="tel"
                            placeholder={locale === 'ar' ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                            dir="ltr"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {locale === 'ar' ? 'مثال: +971501234567' : 'Example: +971501234567'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business Name */}
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building className="h-3 w-3" />
                          {locale === 'ar' ? 'اسم الشركة' : 'Business Name'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={locale === 'ar' ? 'أدخل اسم الشركة' : 'Enter business name'}
                            className={isRTL ? 'text-right' : ''}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Business Type */}
                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {locale === 'ar' ? 'نوع النشاط' : 'Business Type'}
                        </FormLabel>
                        <FormControl>
                          <BusinessTypeSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder={locale === 'ar' ? 'اختر نوع النشاط' : 'Select business type'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* TRN */}
                <FormField
                  control={form.control}
                  name="trn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Hash className="h-3 w-3" />
                        {locale === 'ar' ? 'الرقم الضريبي (TRN)' : 'Tax Registration Number (TRN)'}
                      </FormLabel>
                      <FormControl>
                        <TRNInput
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder={locale === 'ar' ? 'أدخل الرقم الضريبي' : 'Enter TRN'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {locale === 'ar' ? 'المعلومات المالية' : 'Financial Information'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Payment Terms */}
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {locale === 'ar' ? 'شروط الدفع' : 'Payment Terms'}
                        </FormLabel>
                        <FormControl>
                          <PaymentTermsSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder={locale === 'ar' ? 'اختر شروط الدفع' : 'Select payment terms'}
                          />
                        </FormControl>
                        <FormDescription>
                          {locale === 'ar' 
                            ? 'عدد الأيام المسموحة للدفع بعد تاريخ الفاتورة'
                            : 'Number of days allowed for payment after invoice date'
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Credit Limit */}
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calculator className="h-3 w-3" />
                          {locale === 'ar' ? 'حد الائتمان (AED)' : 'Credit Limit (AED)'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={locale === 'ar' ? '0.00' : '0.00'}
                            dir="ltr"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>
                          {locale === 'ar' 
                            ? 'الحد الأقصى للمبلغ المستحق للعميل'
                            : 'Maximum outstanding amount allowed for this customer'
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {locale === 'ar' ? 'ملاحظات' : 'Notes'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notes (English) */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {locale === 'ar' ? 'ملاحظات (إنجليزي)' : 'Notes (English)'}
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={locale === 'ar' ? 'أدخل أي ملاحظات' : 'Enter any notes'}
                            className={`min-h-[80px] ${isRTL ? 'text-right' : ''}`}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes (Arabic) */}
                  <FormField
                    control={form.control}
                    name="notesAr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {locale === 'ar' ? 'ملاحظات (عربي)' : 'Notes (Arabic)'}
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={locale === 'ar' ? 'أدخل أي ملاحظات بالعربي' : 'Enter any notes in Arabic'}
                            className="min-h-[80px] text-right"
                            dir="rtl"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing 
                  ? (locale === 'ar' ? 'تحديث العميل' : 'Update Customer')
                  : (locale === 'ar' ? 'إنشاء العميل' : 'Create Customer')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}