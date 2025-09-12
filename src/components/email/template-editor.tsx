'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Mail, Eye, Save, Palette, Type, Image, Code, 
  Calendar, Clock, Send, Languages, AlertCircle 
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useEmailTemplateStore } from '@/lib/stores/email-template-store'
import { cn } from '@/lib/utils'

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  type: z.enum(['INVOICE_REMINDER', 'PAYMENT_REQUEST', 'OVERDUE_NOTICE', 'PAYMENT_CONFIRMATION', 'CUSTOM']),
  
  // English version
  subjectEn: z.string().min(1, 'English subject is required'),
  bodyEn: z.string().min(1, 'English body is required'),
  
  // Arabic version
  subjectAr: z.string().min(1, 'Arabic subject is required'),
  bodyAr: z.string().min(1, 'Arabic body is required'),
  
  // Scheduling
  sendTime: z.string().optional(),
  timezone: z.string().default('Asia/Dubai'),
  
  // Settings
  isActive: z.boolean().default(true),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
})

type TemplateFormData = z.infer<typeof templateSchema>

interface TemplateEditorProps {
  templateId?: string
  onSave?: (data: TemplateFormData) => void
  onCancel?: () => void
  locale?: string
}

const TEMPLATE_VARIABLES = [
  { key: '{{customerName}}', description: 'Customer name' },
  { key: '{{invoiceNumber}}', description: 'Invoice number' },
  { key: '{{amount}}', description: 'Invoice amount' },
  { key: '{{dueDate}}', description: 'Due date' },
  { key: '{{companyName}}', description: 'Your company name' },
  { key: '{{paymentLink}}', description: 'Payment link' },
  { key: '{{invoiceLink}}', description: 'Invoice view link' },
  { key: '{{currentDate}}', description: 'Current date' },
  { key: '{{daysPastDue}}', description: 'Days past due' },
  { key: '{{totalOutstanding}}', description: 'Total outstanding amount' },
]

const TEMPLATE_TYPES = [
  { value: 'INVOICE_REMINDER', labelEn: 'Invoice Reminder', labelAr: 'تذكير بالفاتورة' },
  { value: 'PAYMENT_REQUEST', labelEn: 'Payment Request', labelAr: 'طلب دفع' },
  { value: 'OVERDUE_NOTICE', labelEn: 'Overdue Notice', labelAr: 'إشعار تأخير' },
  { value: 'PAYMENT_CONFIRMATION', labelEn: 'Payment Confirmation', labelAr: 'تأكيد الدفع' },
  { value: 'CUSTOM', labelEn: 'Custom Template', labelAr: 'قالب مخصص' },
]

export function TemplateEditor({ templateId, onSave, onCancel, locale = 'en' }: TemplateEditorProps) {
  const t = useTranslations('emailTemplate')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>('en')
  const [previewData, setPreviewData] = useState<any>({
    customerName: 'Ahmed Al Rashid',
    invoiceNumber: 'INV-2024-001',
    amount: 'AED 5,250.00',
    dueDate: '2024-09-15',
    companyName: 'Your Company Ltd',
    paymentLink: 'https://pay.yourcompany.com/invoice/123',
    invoiceLink: 'https://yourcompany.com/invoice/123',
    currentDate: new Date().toLocaleDateString('en-AE'),
    daysPastDue: '5',
    totalOutstanding: 'AED 15,750.00',
  })

  const { createTemplate, updateTemplate, getTemplate } = useEmailTemplateStore()

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'INVOICE_REMINDER',
      subjectEn: '',
      bodyEn: '',
      subjectAr: '',
      bodyAr: '',
      sendTime: '',
      timezone: 'Asia/Dubai',
      isActive: true,
      priority: 'NORMAL',
    },
  })

  // Load existing template
  useEffect(() => {
    if (templateId) {
      const loadTemplate = async () => {
        try {
          const template = await getTemplate(templateId)
          if (template) {
            form.reset(template)
          }
        } catch (error) {
          console.error('Failed to load template:', error)
        }
      }
      loadTemplate()
    }
  }, [templateId, getTemplate, form])

  const insertVariable = (variable: string, isArabic: boolean) => {
    const fieldName = isArabic ? 'bodyAr' : 'bodyEn'
    const currentValue = form.getValues(fieldName)
    form.setValue(fieldName, currentValue + variable)
  }

  const onSubmit = async (data: TemplateFormData) => {
    setIsSubmitting(true)
    try {
      if (templateId) {
        await updateTemplate(templateId, data)
      } else {
        await createTemplate(data)
      }
      onSave?.(data)
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderPreview = (subject: string, body: string, isRTL: boolean) => {
    let processedSubject = subject
    let processedBody = body

    // Replace variables with preview data
    Object.entries(previewData).forEach(([key, value]) => {
      const variable = `{{${key}}}`
      processedSubject = processedSubject.replace(new RegExp(variable, 'g'), value)
      processedBody = processedBody.replace(new RegExp(variable, 'g'), value)
    })

    return (
      <div className={cn("border rounded-lg p-4 bg-white", isRTL && "text-right")} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="border-b pb-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4" />
            <span className="text-sm text-gray-500">
              {isRTL ? 'إلى:' : 'To:'} {previewData.customerName} &lt;customer@example.com&gt;
            </span>
          </div>
          <h3 className="font-medium">{processedSubject}</h3>
        </div>
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ 
            __html: processedBody.replace(/\n/g, '<br />') 
          }}
        />
      </div>
    )
  }

  return (
    <div className={cn("max-w-6xl mx-auto space-y-6", locale === 'ar' && "text-right")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-6 w-6" />
                {templateId ? t('editTemplate') : t('createTemplate')}
              </CardTitle>
              <CardDescription>
                {t('templateEditorDescription')}
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs defaultValue="content" className="space-y-6">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="content">{t('content')}</TabsTrigger>
                  <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
                  <TabsTrigger value="preview">{t('preview')}</TabsTrigger>
                </TabsList>

                {/* Content Tab */}
                <TabsContent value="content" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('templateInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('templateName')} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('enterTemplateName')} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('templateType')} *</FormLabel>
                              <FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TEMPLATE_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {locale === 'ar' ? type.labelAr : type.labelEn}
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

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('description')}</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder={t('enterDescription')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Languages className="h-5 w-5" />
                        {t('emailContent')}
                      </CardTitle>
                      <CardDescription>
                        {t('bilingualSupport')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* English Content */}
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <span className="w-6 h-4 bg-blue-500 text-white text-xs flex items-center justify-center rounded">EN</span>
                          {t('englishVersion')}
                        </h4>
                        
                        <FormField
                          control={form.control}
                          name="subjectEn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('subject')} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('enterSubject')} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="bodyEn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('emailBody')} *</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field} 
                                  placeholder={t('enterEmailBody')}
                                  className="min-h-[200px]"
                                />
                              </FormControl>
                              <FormDescription>
                                {t('useVariables')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Arabic Content */}
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <span className="w-6 h-4 bg-green-500 text-white text-xs flex items-center justify-center rounded">AR</span>
                          {t('arabicVersion')}
                        </h4>
                        
                        <FormField
                          control={form.control}
                          name="subjectAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('subject')} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('enterSubjectAr')} dir="rtl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="bodyAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('emailBody')} *</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field} 
                                  placeholder={t('enterEmailBodyAr')}
                                  className="min-h-[200px]"
                                  dir="rtl"
                                />
                              </FormControl>
                              <FormDescription>
                                {t('useVariablesAr')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {t('scheduleSettings')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="sendTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('preferredSendTime')}</FormLabel>
                              <FormControl>
                                <Input {...field} type="time" />
                              </FormControl>
                              <FormDescription>
                                {t('businessHours')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="timezone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('timezone')}</FormLabel>
                              <FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Asia/Dubai">Asia/Dubai (GMT+4)</SelectItem>
                                    <SelectItem value="Asia/Riyadh">Asia/Riyadh (GMT+3)</SelectItem>
                                    <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('priority')}</FormLabel>
                              <FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="LOW">{t('lowPriority')}</SelectItem>
                                    <SelectItem value="NORMAL">{t('normalPriority')}</SelectItem>
                                    <SelectItem value="HIGH">{t('highPriority')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t('uaeBusinessHours')}</AlertTitle>
                        <AlertDescription>
                          {t('businessHoursDesc')}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Preview Tab */}
                <TabsContent value="preview" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="h-5 w-5" />
                          {t('emailPreview')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={previewLang === 'en' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewLang('en')}
                          >
                            English
                          </Button>
                          <Button
                            type="button"
                            variant={previewLang === 'ar' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewLang('ar')}
                          >
                            العربية
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {previewLang === 'en' ? (
                        renderPreview(
                          form.watch('subjectEn') || t('noSubject'),
                          form.watch('bodyEn') || t('noBody'),
                          false
                        )
                      ) : (
                        renderPreview(
                          form.watch('subjectAr') || t('noSubjectAr'),
                          form.watch('bodyAr') || t('noBodyAr'),
                          true
                        )
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Variables Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    {t('availableVariables')}
                  </CardTitle>
                  <CardDescription>
                    {t('variablesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <div key={variable.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <code className="text-xs bg-gray-100 px-1 rounded">
                          {variable.key}
                        </code>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => insertVariable(variable.key, false)}
                          >
                            EN
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => insertVariable(variable.key, true)}
                          >
                            AR
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">{variable.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('quickTemplates')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      form.setValue('subjectEn', 'Payment Reminder - Invoice {{invoiceNumber}}')
                      form.setValue('bodyEn', 'Dear {{customerName}},\n\nWe hope this message finds you well. We wanted to remind you that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.\n\nPlease make your payment at your earliest convenience. You can view and pay your invoice using the link below:\n{{paymentLink}}\n\nIf you have any questions, please don\'t hesitate to contact us.\n\nBest regards,\n{{companyName}}')
                      form.setValue('subjectAr', 'تذكير بالدفع - فاتورة {{invoiceNumber}}')
                      form.setValue('bodyAr', 'عزيزي {{customerName}}،\n\nنأمل أن تكون بخير. نود تذكيركم بأن الفاتورة رقم {{invoiceNumber}} بقيمة {{amount}} مستحقة الدفع في {{dueDate}}.\n\nيرجى سداد المبلغ في أقرب وقت ممكن. يمكنكم مراجعة ودفع الفاتورة من خلال الرابط أدناه:\n{{paymentLink}}\n\nإذا كان لديكم أي استفسارات، لا تترددوا في التواصل معنا.\n\nمع أطيب التحيات،\n{{companyName}}')
                    }}
                  >
                    {t('paymentReminder')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      form.setValue('subjectEn', 'URGENT: Overdue Invoice {{invoiceNumber}}')
                      form.setValue('bodyEn', 'Dear {{customerName}},\n\nThis is an urgent notice regarding your overdue invoice {{invoiceNumber}} for {{amount}}. This invoice was due on {{dueDate}} and is now {{daysPastDue}} days overdue.\n\nImmediate payment is required to avoid any service interruption. Please pay using the link below:\n{{paymentLink}}\n\nIf you have already made this payment, please ignore this notice.\n\nRegards,\n{{companyName}}')
                      form.setValue('subjectAr', 'عاجل: فاتورة متأخرة {{invoiceNumber}}')
                      form.setValue('bodyAr', 'عزيزي {{customerName}}،\n\nهذا إشعار عاجل بخصوص الفاتورة المتأخرة رقم {{invoiceNumber}} بقيمة {{amount}}. كانت هذه الفاتورة مستحقة في {{dueDate}} وهي الآن متأخرة {{daysPastDue}} يوماً.\n\nيتطلب الأمر دفع فوري لتجنب أي انقطاع في الخدمة. يرجى الدفع باستخدام الرابط أدناه:\n{{paymentLink}}\n\nإذا كنتم قد دفعتم هذا المبلغ بالفعل، يرجى تجاهل هذا الإشعار.\n\nمع التحية،\n{{companyName}}')
                    }}
                  >
                    {t('overdueNotice')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

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
                  {templateId ? t('updateTemplate') : t('saveTemplate')}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}