'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Calculator, Save, User, Building, Receipt } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AEDAmount } from '@/components/ui/uae-formatters'
import { calculateVAT, calculateInvoiceVAT, formatUAECurrency, formatUAETRN, validateUAETRN } from '@/lib/vat-calculator'
import { useCustomerStore } from '@/lib/stores/customer-store'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { CreateInvoiceFormData, CreateInvoiceItemFormData, DEFAULT_UAE_VAT_RATE, UAE_TRN_REGEX } from '@/types/invoice'
import { cn } from '@/lib/utils'

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  description_ar: z.string().optional(),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
  unit_price: z.coerce.number().min(0.01, 'Unit price must be greater than 0'),
  total: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100).default(5),
  vat_amount: z.coerce.number().min(0).default(0),
  total_with_vat: z.coerce.number().min(0).default(0),
  tax_category: z.enum(['STANDARD', 'EXEMPT', 'ZERO_RATED']).default('STANDARD'),
})

const invoiceSchema = z.object({
  // Invoice Details  
  number: z.string().min(1, 'Invoice number is required'),
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email('Invalid email address'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  subtotal: z.coerce.number().min(0).optional(),
  vat_amount: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  currency: z.string().default('AED'),
  due_date: z.string().min(1, 'Due date is required'),
  description: z.string().optional(),
  description_ar: z.string().optional(),
  notes: z.string().optional(),
  notes_ar: z.string().optional(),
  trn_number: z.string().refine(
    (val) => !val || validateUAETRN(val), 
    'TRN must be 15 digits in UAE format'
  ).optional(),
  
  // Line Items
  invoice_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface InvoiceFormProps {
  invoiceId?: string
  onSave?: (data: InvoiceFormData) => void
  onCancel?: () => void
  locale?: string
  companyId?: string
  enableAutoSave?: boolean
}

export function InvoiceForm({ 
  invoiceId, 
  onSave, 
  onCancel, 
  locale = 'en', 
  companyId,
  enableAutoSave = true 
}: InvoiceFormProps) {
  const t = useTranslations('invoiceForm')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isDraft, setIsDraft] = useState(true)
  
  const { customers, fetchCustomers, createCustomer } = useCustomerStore()
  const { addInvoice, updateInvoice, getInvoiceById } = useInvoiceStore()

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      number: '',
      customer_name: '',
      customer_email: '',
      amount: 0,
      subtotal: 0,
      vat_amount: 0,
      total_amount: 0,
      currency: 'AED',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: '',
      description_ar: '',
      notes: '',
      notes_ar: '',
      trn_number: '',
      invoice_items: [{
        description: '',
        description_ar: '',
        quantity: 1,
        unit_price: 0,
        total: 0,
        vat_rate: DEFAULT_UAE_VAT_RATE,
        vat_amount: 0,
        total_with_vat: 0,
        tax_category: 'STANDARD' as const,
      }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invoice_items"
  })

  // Auto-generate invoice number
  const generateInvoiceNumber = useCallback(() => {
    const prefix = 'INV'
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const timestamp = Date.now().toString().slice(-4)
    return `${prefix}-${year}${month}-${timestamp}`
  }, [])

  // Load existing invoice data
  useEffect(() => {
    if (invoiceId) {
      const loadInvoice = async () => {
        try {
          const invoice = getInvoiceById(invoiceId)
          if (invoice) {
            form.reset({
              number: invoice.number,
              customer_name: invoice.customer_name,
              customer_email: invoice.customer_email,
              amount: invoice.amount,
              subtotal: invoice.subtotal || 0,
              vat_amount: invoice.vat_amount || 0,
              total_amount: invoice.total_amount || 0,
              currency: invoice.currency,
              due_date: new Date(invoice.due_date).toISOString().split('T')[0],
              description: invoice.description || '',
              description_ar: invoice.description_ar || '',
              notes: invoice.notes || '',
              notes_ar: invoice.notes_ar || '',
              trn_number: invoice.trn_number || '',
              invoice_items: invoice.invoice_items || [{
                description: '',
                description_ar: '',
                quantity: 1,
                unit_price: 0,
                total: 0,
                vat_rate: DEFAULT_UAE_VAT_RATE,
                vat_amount: 0,
                total_with_vat: 0,
                tax_category: 'STANDARD' as const,
              }],
            })
            setIsDraft(invoice.status === 'DRAFT')
          }
        } catch (error) {
          console.error('Failed to load invoice:', error)
        }
      }
      loadInvoice()
    } else {
      // Generate invoice number for new invoices
      form.setValue('number', generateInvoiceNumber())
    }
  }, [invoiceId, getInvoiceById, form, generateInvoiceNumber])

  // Load customers
  useEffect(() => {
    fetchCustomers('')
  }, [fetchCustomers])

  // Calculate totals whenever line items change using enhanced VAT calculator
  const calculateTotals = useCallback(() => {
    const lineItems = form.getValues('invoice_items')
    
    if (!lineItems || lineItems.length === 0) {
      form.setValue('subtotal', 0)
      form.setValue('vat_amount', 0)
      form.setValue('total_amount', 0)
      form.setValue('amount', 0)
      return
    }

    // Use the enhanced VAT calculator for accurate calculations
    const vatSummary = calculateInvoiceVAT(
      lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        vatRate: item.vat_rate,
        taxCategory: item.tax_category
      })),
      form.getValues('currency')
    )

    // Update form values with calculated amounts
    const subtotal = vatSummary.subtotal.toNumber()
    const vatAmount = vatSummary.totalVatAmount.toNumber()
    const totalAmount = vatSummary.grandTotal.toNumber()

    form.setValue('subtotal', subtotal)
    form.setValue('vat_amount', vatAmount)
    form.setValue('total_amount', totalAmount)
    form.setValue('amount', totalAmount)

    // Update individual line items with calculated values
    vatSummary.lineItems.forEach((calculatedItem, index) => {
      form.setValue(`invoice_items.${index}.total`, calculatedItem.lineTotal.toNumber())
      form.setValue(`invoice_items.${index}.vat_amount`, calculatedItem.vatAmount.toNumber())
      form.setValue(`invoice_items.${index}.total_with_vat`, calculatedItem.totalWithVat.toNumber())
    })
  }, [form])

  // Auto-save functionality
  const saveAsDraft = useCallback(async () => {
    if (!enableAutoSave || !companyId) return
    
    try {
      const formData = form.getValues()
      if (!formData.customer_name || !formData.customer_email) return
      
      const draftData = {
        ...formData,
        companyId,
        status: 'DRAFT' as const
      }

      if (invoiceId) {
        await updateInvoice(invoiceId, draftData)
      } else {
        const newInvoice = await addInvoice(draftData)
        // Update the form with the new invoice ID for future saves
        if (newInvoice?.id && !invoiceId) {
          window.history.replaceState(null, '', `/dashboard/invoices/${newInvoice.id}/edit`)
        }
      }
      
      setLastSaved(new Date())
    } catch (error) {
      console.error('Auto-save failed:', error)
    }
  }, [enableAutoSave, companyId, form, invoiceId, updateInvoice, addInvoice])

  // Watch line items for changes and trigger calculations
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('invoice_items')) {
        calculateTotals()
      }
      
      // Auto-save after changes (debounced)
      if (enableAutoSave && isDraft) {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer)
        }
        const newTimer = setTimeout(() => {
          saveAsDraft()
        }, 2000) // Save after 2 seconds of inactivity
        setAutoSaveTimer(newTimer)
      }
    })
    
    return () => {
      subscription.unsubscribe()
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
      }
    }
  }, [form, calculateTotals, enableAutoSave, isDraft, autoSaveTimer, saveAsDraft])

  const addLineItem = () => {
    append({
      description: '',
      description_ar: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
      vat_rate: DEFAULT_UAE_VAT_RATE,
      vat_amount: 0,
      total_with_vat: 0,
      tax_category: 'STANDARD' as const,
    })
  }

  const removeLineItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === 'new') {
      setShowNewCustomer(true)
      setSelectedCustomer(null)
      // Clear customer fields
      form.setValue('customer_name', '')
      form.setValue('customer_email', '')
      form.setValue('trn_number', '')
    } else {
      const customer = customers.find(c => c.id === customerId)
      if (customer) {
        setSelectedCustomer(customer)
        setShowNewCustomer(false)
        // Fill customer fields
        form.setValue('customer_name', customer.name)
        form.setValue('customer_email', customer.email)
        if (customer.trn) {
          form.setValue('trn_number', customer.trn)
        }
      }
    }
  }

  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true)
    try {
      // Ensure calculations are up to date
      calculateTotals()
      
      const submitData = {
        ...data,
        companyId: companyId || '',
        status: isDraft ? 'DRAFT' : 'SENT'
      }

      if (invoiceId) {
        await updateInvoice(invoiceId, submitData)
      } else {
        await addInvoice(submitData)
      }

      // Clear auto-save timer
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        setAutoSaveTimer(null)
      }

      onSave?.(data)
    } catch (error) {
      console.error('Failed to save invoice:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateLineTotal = (item: any) => {
    if (!item.quantity || !item.unit_price) return 0
    
    const vatCalc = calculateVAT({
      amount: item.quantity * item.unit_price,
      vatRate: item.vat_rate || DEFAULT_UAE_VAT_RATE,
      taxCategory: item.tax_category || 'STANDARD',
      currency: form.getValues('currency'),
      isVatInclusive: false
    })
    
    return vatCalc.totalAmount.toNumber()
  }

  return (
    <div className={cn("max-w-5xl mx-auto space-y-6", locale === 'ar' && "text-right")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-6 w-6" />
                {invoiceId ? t('editInvoice') : t('createInvoice')}
              </CardTitle>
              <CardDescription>
                {t('invoiceFormDescription')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Tabs defaultValue="details" className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="details">{t('invoiceDetails')}</TabsTrigger>
              <TabsTrigger value="customer">{t('customerInfo')}</TabsTrigger>
              <TabsTrigger value="items">{t('lineItems')}</TabsTrigger>
            </TabsList>

            {/* Customer Information */}
            <TabsContent value="customer" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('customerInformation')}
                  </CardTitle>
                  <CardDescription>
                    {t('customerInformationDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!showNewCustomer && (
                    <div className="space-y-2">
                      <FormLabel>{t('selectCustomer')}</FormLabel>
                      <Select onValueChange={handleCustomerSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('chooseCustomer')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">{t('addNewCustomer')}</SelectItem>
                          {customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} ({customer.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customerName')} *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t('enterCustomerName')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customer_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customerEmail')} *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder={t('enterCustomerEmail')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="trn_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customerTrn')}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="123456789012345" 
                              maxLength={15}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '')
                                field.onChange(value)
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('trnFormat')} - {field.value && formatUAETRN(field.value)}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoice Details */}
            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    {t('invoiceDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('invoiceNumber')} *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="INV-001" readOnly={!!invoiceId} />
                          </FormControl>
                          <FormDescription>
                            {!invoiceId && 'Auto-generated invoice number'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('currency')}</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AED">AED (UAE Dirham)</SelectItem>
                                <SelectItem value="USD">USD (US Dollar)</SelectItem>
                                <SelectItem value="EUR">EUR (Euro)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('description')}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={t('invoiceDescription')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {locale === 'ar' && (
                        <FormField
                          control={form.control}
                          name="description_ar"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('descriptionArabic')}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('invoiceDescriptionArabic')} dir="rtl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('dueDate')} *</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormDescription>
                            Payment due date in UAE business days
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {enableAutoSave && lastSaved && (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        Last saved: {lastSaved.toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('notes')}</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder={t('notesPlaceholder')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {locale === 'ar' && (
                        <FormField
                          control={form.control}
                          name="notes_ar"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('notesArabic')}</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder={t('notesPlaceholderArabic')} dir="rtl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Line Items */}
            <TabsContent value="items" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      {t('lineItems')}
                    </div>
                    <Button type="button" onClick={addLineItem} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      {t('addLineItem')}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">{t('item')} {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <FormField
                          control={form.control}
                          name={`invoice_items.${index}.description`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>{t('description')} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('itemDescription')} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`invoice_items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('quantity')}</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  step="0.01" 
                                  min="0.01" 
                                  onChange={(e) => {
                                    field.onChange(parseFloat(e.target.value) || 0)
                                    calculateTotals()
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`invoice_items.${index}.unit_price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('unitPrice')}</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  onChange={(e) => {
                                    field.onChange(parseFloat(e.target.value) || 0)
                                    calculateTotals()
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`invoice_items.${index}.vat_rate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('vatRate')}</FormLabel>
                              <FormControl>
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(Number(value))
                                    // Update tax category based on VAT rate
                                    const taxCategory = value === '0' ? 'EXEMPT' : 'STANDARD'
                                    form.setValue(`invoice_items.${index}.tax_category`, taxCategory)
                                    calculateTotals()
                                  }} 
                                  defaultValue={String(field.value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">0% (Exempt)</SelectItem>
                                    <SelectItem value="5">5% (Standard UAE VAT)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {locale === 'ar' && (
                        <FormField
                          control={form.control}
                          name={`invoice_items.${index}.description_ar`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('descriptionArabic')}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('itemDescriptionArabic')} dir="rtl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-sm space-y-1">
                          <FormLabel>{t('lineSubtotal')}</FormLabel>
                          <div className="font-medium">
                            {formatUAECurrency(
                              form.watch(`invoice_items.${index}.total`) || 0,
                              form.getValues('currency')
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm space-y-1">
                          <FormLabel>{t('vatAmount')}</FormLabel>
                          <div className="font-medium">
                            {formatUAECurrency(
                              form.watch(`invoice_items.${index}.vat_amount`) || 0,
                              form.getValues('currency')
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm space-y-1">
                          <FormLabel>{t('lineTotal')}</FormLabel>
                          <div className="text-lg font-semibold">
                            {formatUAECurrency(
                              form.watch(`invoice_items.${index}.total_with_vat`) || 0,
                              form.getValues('currency')
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Totals Summary */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span>{t('subtotal')}:</span>
                        <span className="font-medium">
                          {formatUAECurrency(form.watch('subtotal') || 0, form.getValues('currency'))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('vatAmount')}:</span>
                        <span className="font-medium">
                          {formatUAECurrency(form.watch('vat_amount') || 0, form.getValues('currency'))}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-3">
                      <span>{t('totalAmount')}:</span>
                      <span className="text-xl">
                        {formatUAECurrency(form.watch('total_amount') || 0, form.getValues('currency'))}
                      </span>
                    </div>
                    
                    {/* VAT Summary for UAE Compliance */}
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex justify-between">
                        <span>UAE VAT Registration Required for amounts above AED 375,000</span>
                        <span>Currency: {form.getValues('currency')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {invoiceId ? t('updateInvoice') : t('createInvoice')}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}