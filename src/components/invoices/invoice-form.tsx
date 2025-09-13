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
import { calculateVAT, calculateTotalWithVAT } from '@/lib/vat-calculator'
import { useCustomerStore } from '@/lib/stores/customer-store'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { CreateInvoiceFormData, CreateInvoiceItemFormData } from '@/types/invoice'
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
  trn_number: z.string().regex(/^\d{15}$/, 'TRN must be 15 digits').optional().or(z.literal('')),
  
  // Line Items
  invoice_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface InvoiceFormProps {
  invoiceId?: string
  onSave?: (data: InvoiceFormData) => void
  onCancel?: () => void
  locale?: string
}

export function InvoiceForm({ invoiceId, onSave, onCancel, locale = 'en' }: InvoiceFormProps) {
  const t = useTranslations('invoiceForm')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  
  const { customers, fetchCustomers, createCustomer } = useCustomerStore()
  const { createInvoice, updateInvoice, getInvoice } = useInvoiceStore()

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerTrn: '',
      customerAddress: '',
      invoiceNumber: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 30',
      currency: 'AED',
      lineItems: [{
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: 5,
        discount: 0,
      }],
      notes: '',
      terms: '',
      subtotal: 0,
      vatAmount: 0,
      totalAmount: 0,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems"
  })

  // Load existing invoice data
  useEffect(() => {
    if (invoiceId) {
      const loadInvoice = async () => {
        try {
          const invoice = await getInvoice(invoiceId)
          if (invoice) {
            form.reset({
              customerId: invoice.customerId,
              customerName: invoice.customerName,
              customerEmail: invoice.customerEmail,
              customerPhone: invoice.customerPhone,
              customerTrn: invoice.customerTrn || '',
              customerAddress: invoice.customerAddress || '',
              invoiceNumber: invoice.invoiceNumber,
              issueDate: new Date(invoice.issueDate).toISOString().split('T')[0],
              dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
              paymentTerms: invoice.paymentTerms,
              currency: invoice.currency,
              lineItems: invoice.lineItems || [{
                description: '',
                quantity: 1,
                unitPrice: 0,
                vatRate: 5,
                discount: 0,
              }],
              notes: invoice.notes || '',
              terms: invoice.terms || '',
              subtotal: invoice.subtotal,
              vatAmount: invoice.vatAmount,
              totalAmount: invoice.totalAmount,
            })
          }
        } catch (error) {
          console.error('Failed to load invoice:', error)
        }
      }
      loadInvoice()
    }
  }, [invoiceId, getInvoice, form])

  // Load customers
  useEffect(() => {
    fetchCustomers('')
  }, [fetchCustomers])

  // Calculate totals whenever line items change
  const calculateTotals = useCallback(() => {
    const lineItems = form.getValues('lineItems')
    let subtotal = 0
    let totalVat = 0

    lineItems.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice
      const discountAmount = lineTotal * (item.discount / 100)
      const lineSubtotal = lineTotal - discountAmount
      const lineVat = calculateVAT(lineSubtotal, item.vatRate)
      
      subtotal += lineSubtotal
      totalVat += lineVat
    })

    const totalAmount = subtotal + totalVat

    form.setValue('subtotal', subtotal)
    form.setValue('vatAmount', totalVat)
    form.setValue('totalAmount', totalAmount)
  }, [form])

  // Watch line items for changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('lineItems')) {
        calculateTotals()
      }
    })
    return () => subscription.unsubscribe()
  }, [form, calculateTotals])

  const addLineItem = () => {
    append({
      description: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: 5,
      discount: 0,
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
      form.setValue('customerId', '')
      form.setValue('customerName', '')
      form.setValue('customerEmail', '')
      form.setValue('customerPhone', '')
      form.setValue('customerTrn', '')
      form.setValue('customerAddress', '')
    } else {
      const customer = customers.find(c => c.id === customerId)
      if (customer) {
        setSelectedCustomer(customer)
        setShowNewCustomer(false)
        // Fill customer fields
        form.setValue('customerId', customer.id)
        form.setValue('customerName', customer.name)
        form.setValue('customerEmail', customer.email)
        form.setValue('customerPhone', customer.phone)
        form.setValue('customerTrn', customer.trn || '')
        form.setValue('customerAddress', customer.address || '')
      }
    }
  }

  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true)
    try {
      // Create customer if new
      if (showNewCustomer && !data.customerId) {
        const newCustomer = await createCustomer({
          name: data.customerName,
          email: data.customerEmail,
          phone: data.customerPhone,
          trn: data.customerTrn || undefined,
          address: data.customerAddress || undefined,
        })
        data.customerId = newCustomer.id
      }

      if (invoiceId) {
        await updateInvoice(invoiceId, data)
      } else {
        await createInvoice(data)
      }

      onSave?.(data)
    } catch (error) {
      console.error('Failed to save invoice:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateLineTotal = (item: any) => {
    const lineTotal = item.quantity * item.unitPrice
    const discountAmount = lineTotal * (item.discount / 100)
    const subtotal = lineTotal - discountAmount
    const vat = calculateVAT(subtotal, item.vatRate)
    return subtotal + vat
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
                      name="customerName"
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
                      name="customerEmail"
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
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customerPhone')} *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+971 50 123 4567" />
                          </FormControl>
                          <FormDescription>
                            {t('uaePhoneFormat')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerTrn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customerTrn')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="123456789012345" maxLength={15} />
                          </FormControl>
                          <FormDescription>
                            {t('trnFormat')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="customerAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('customerAddress')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder={t('enterCustomerAddress')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('invoiceNumber')} *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="INV-001" />
                          </FormControl>
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

                    <FormField
                      control={form.control}
                      name="issueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('issueDate')} *</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('dueDate')} *</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paymentTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentTerms')}</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                                <SelectItem value="Net 15">Net 15</SelectItem>
                                <SelectItem value="Net 30">Net 30</SelectItem>
                                <SelectItem value="Net 60">Net 60</SelectItem>
                                <SelectItem value="Net 90">Net 90</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
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

                    <FormField
                      control={form.control}
                      name="terms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('terms')}</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder={t('termsPlaceholder')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                          name={`lineItems.${index}.description`}
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
                          name={`lineItems.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('quantity')}</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" min="0.01" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('unitPrice')}</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" min="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.vatRate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('vatRate')}</FormLabel>
                              <FormControl>
                                <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">0% (Exempt)</SelectItem>
                                    <SelectItem value="5">5% (Standard)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.discount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('discount')} (%)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" min="0" max="100" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex items-end">
                          <div className="text-right">
                            <FormLabel>{t('lineTotal')}</FormLabel>
                            <div className="text-lg font-semibold">
                              <AEDAmount amount={calculateLineTotal(form.getValues(`lineItems.${index}`))} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Totals Summary */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('subtotal')}:</span>
                      <AEDAmount amount={form.watch('subtotal')} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('vatAmount')}:</span>
                      <AEDAmount amount={form.watch('vatAmount')} />
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span>{t('totalAmount')}:</span>
                      <AEDAmount amount={form.watch('totalAmount')} />
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