'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Save, 
  Eye, 
  Type, 
  Bold, 
  Italic, 
  Underline, 
  Link, 
  List, 
  Code, 
  Languages, 
  Palette, 
  Settings,
  Plus,
  X,
  Copy,
  Sparkles,
  AlertCircle,
  CheckCircle
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from '@/lib/utils'

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.enum(['GENTLE_REMINDER', 'PROFESSIONAL_FOLLOWUP', 'FIRM_NOTICE', 'FINAL_NOTICE', 'CUSTOM']),
  
  // English version
  subjectEn: z.string().min(1, 'English subject is required'),
  bodyEn: z.string().min(1, 'English body is required'),
  
  // Arabic version  
  subjectAr: z.string().min(1, 'Arabic subject is required'),
  bodyAr: z.string().min(1, 'Arabic body is required'),
  
  // Settings
  isActive: z.boolean().default(true),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  sendTime: z.string().optional(),
  timezone: z.string().default('Asia/Dubai'),
  uaeBusinessHoursOnly: z.boolean().default(true),
  
  // Advanced options
  tags: z.array(z.string()).default([]),
  variables: z.record(z.string()).default({}),
})

type TemplateFormData = z.infer<typeof templateSchema>

interface TemplateBuilderProps {
  templateId?: string
  initialData?: Partial<TemplateFormData>
  onSave?: (data: TemplateFormData) => Promise<void>
  onCancel?: () => void
  locale?: string
  companyId?: string
}

// UAE-specific template variables
const UAE_VARIABLES = {
  customer: [
    { key: '{{customer_name}}', description: 'Customer name', descriptionAr: 'اسم العميل' },
    { key: '{{customer_name_ar}}', description: 'Arabic customer name', descriptionAr: 'الاسم العربي للعميل' },
    { key: '{{customer_email}}', description: 'Customer email', descriptionAr: 'بريد العميل الإلكتروني' },
    { key: '{{customer_phone}}', description: 'Customer phone (UAE format)', descriptionAr: 'هاتف العميل (تنسيق الإمارات)' }
  ],
  invoice: [
    { key: '{{invoice_number}}', description: 'Invoice number', descriptionAr: 'رقم الفاتورة' },
    { key: '{{invoice_amount}}', description: 'Invoice amount in AED', descriptionAr: 'مبلغ الفاتورة بالدرهم' },
    { key: '{{due_date}}', description: 'Due date (UAE format)', descriptionAr: 'تاريخ الاستحقاق (تنسيق الإمارات)' },
    { key: '{{days_overdue}}', description: 'Days past due', descriptionAr: 'الأيام المتأخرة' },
    { key: '{{payment_link}}', description: 'Secure payment portal link', descriptionAr: 'رابط بوابة الدفع الآمنة' }
  ],
  company: [
    { key: '{{company_name}}', description: 'Your company name', descriptionAr: 'اسم الشركة' },
    { key: '{{company_trn}}', description: 'Company TRN', descriptionAr: 'الرقم الضريبي للشركة' },
    { key: '{{contact_phone}}', description: 'Company phone number', descriptionAr: 'رقم هاتف الشركة' },
    { key: '{{support_email}}', description: 'Support email address', descriptionAr: 'بريد الدعم الفني' }
  ],
  system: [
    { key: '{{current_date}}', description: 'Current date (UAE format)', descriptionAr: 'التاريخ الحالي (تنسيق الإمارات)' },
    { key: '{{business_hours}}', description: 'UAE business hours', descriptionAr: 'ساعات العمل في الإمارات' }
  ]
}

// Template categories with UAE business context
const TEMPLATE_CATEGORIES = [
  {
    value: 'GENTLE_REMINDER',
    labelEn: 'Gentle Reminder (Day 3)',
    labelAr: 'تذكير ودود (اليوم 3)',
    description: 'Professional, respectful reminder assuming good faith',
    color: 'blue',
    icon: '💌'
  },
  {
    value: 'PROFESSIONAL_FOLLOWUP', 
    labelEn: 'Professional Follow-up (Day 7)',
    labelAr: 'متابعة مهنية (اليوم 7)',
    description: 'Direct but respectful with payment options',
    color: 'orange',
    icon: '📋'
  },
  {
    value: 'FIRM_NOTICE',
    labelEn: 'Firm Notice (Day 15)', 
    labelAr: 'إشعار حازم (اليوم 15)',
    description: 'Clear consequences while maintaining relationship focus',
    color: 'red',
    icon: '⚠️'
  },
  {
    value: 'FINAL_NOTICE',
    labelEn: 'Final Notice (Day 30)',
    labelAr: 'الإشعار الأخير (اليوم 30)',
    description: 'Formal tone with legal implications, UAE compliant',
    color: 'purple',
    icon: '🔔'
  },
  {
    value: 'CUSTOM',
    labelEn: 'Custom Template',
    labelAr: 'قالب مخصص', 
    description: 'Fully customizable template for specific needs',
    color: 'gray',
    icon: '🎨'
  }
]

// Pre-built template content for UAE businesses
const TEMPLATE_CONTENT = {
  GENTLE_REMINDER: {
    subjectEn: 'Friendly Reminder - Invoice {{invoice_number}} Payment',
    subjectAr: 'تذكير ودي - دفع الفاتورة {{invoice_number}}',
    bodyEn: `Dear {{customer_name}},

I hope this email finds you well. This is a gentle reminder that Invoice {{invoice_number}} for {{invoice_amount}} was due on {{due_date}}.

We understand that sometimes invoices can be overlooked in busy schedules. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.

You can make payment through our secure portal: {{payment_link}}

Thank you for your continued business relationship.

Best regards,
{{company_name}}
TRN: {{company_trn}}
Phone: {{contact_phone}}`,
    bodyAr: `عزيزي {{customer_name_ar}}،

أتمنى أن تكون بخير. هذا تذكير ودي بأن الفاتورة رقم {{invoice_number}} بمبلغ {{invoice_amount}} كان موعد استحقاقها في {{due_date}}.

نتفهم أنه أحياناً قد يتم نسيان الفواتير في ظل الجداول المزدحمة. إذا كان لديك أي أسئلة حول هذه الفاتورة أو تحتاج لمناقشة ترتيبات الدفع، يرجى عدم التردد في الاتصال بنا.

يمكنك القيام بالدفع من خلال بوابتنا الآمنة: {{payment_link}}

شكراً لاستمرار علاقتنا التجارية.

أطيب التحيات،
{{company_name}}
الرقم الضريبي: {{company_trn}}
الهاتف: {{contact_phone}}`
  },
  PROFESSIONAL_FOLLOWUP: {
    subjectEn: 'Payment Follow-up - Invoice {{invoice_number}} ({{days_overdue}} days overdue)',
    subjectAr: 'متابعة الدفع - فاتورة {{invoice_number}} (متأخرة {{days_overdue}} يوماً)',
    bodyEn: `Dear {{customer_name}},

We hope you are doing well. We are following up on Invoice {{invoice_number}} for {{invoice_amount}}, which was due on {{due_date}} and is now {{days_overdue}} days overdue.

Please arrange payment at your earliest convenience through our secure payment portal: {{payment_link}}

If you have already processed this payment, please accept our apologies and kindly forward the payment confirmation.

For any payment-related queries, please contact us during UAE business hours ({{business_hours}}) at {{contact_phone}}.

Thank you for your prompt attention to this matter.

Regards,
{{company_name}}
TRN: {{company_trn}}`,
    bodyAr: `عزيزي {{customer_name_ar}}،

نأمل أن تكون بخير. نتابع معك بخصوص الفاتورة رقم {{invoice_number}} بمبلغ {{invoice_amount}}، والتي كانت مستحقة في {{due_date}} وهي الآن متأخرة {{days_overdue}} يوماً.

يرجى ترتيب الدفع في أقرب وقت ممكن من خلال بوابة الدفع الآمنة: {{payment_link}}

إذا كنت قد قمت بالدفع بالفعل، نعتذر ونرجو إرسال تأكيد الدفع.

لأي استفسارات متعلقة بالدفع، يرجى الاتصال بنا خلال ساعات العمل في الإمارات ({{business_hours}}) على {{contact_phone}}.

شكراً لاهتمامك السريع بهذا الأمر.

مع التحية،
{{company_name}}
الرقم الضريبي: {{company_trn}}`
  }
}

export function TemplateBuilder({
  templateId,
  initialData,
  onSave,
  onCancel,
  locale = 'en',
  companyId
}: TemplateBuilderProps) {
  const t = useTranslations('templateBuilder')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState<'en' | 'ar'>('en')
  const [showPreview, setShowPreview] = useState(false)
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'GENTLE_REMINDER',
      subjectEn: '',
      bodyEn: '',
      subjectAr: '',
      bodyAr: '',
      isActive: true,
      priority: 'NORMAL',
      sendTime: '10:00',
      timezone: 'Asia/Dubai',
      uaeBusinessHoursOnly: true,
      tags: [],
      variables: {},
      ...initialData
    },
  })

  const watchCategory = form.watch('category')
  const watchSubjectEn = form.watch('subjectEn')
  const watchBodyEn = form.watch('bodyEn')
  const watchSubjectAr = form.watch('subjectAr')
  const watchBodyAr = form.watch('bodyAr')

  // Load template content when category changes
  useEffect(() => {
    if (watchCategory && watchCategory !== 'CUSTOM' && TEMPLATE_CONTENT[watchCategory]) {
      const content = TEMPLATE_CONTENT[watchCategory]
      if (!watchSubjectEn) form.setValue('subjectEn', content.subjectEn)
      if (!watchBodyEn) form.setValue('bodyEn', content.bodyEn)
      if (!watchSubjectAr) form.setValue('subjectAr', content.subjectAr)
      if (!watchBodyAr) form.setValue('bodyAr', content.bodyAr)
    }
  }, [watchCategory, form, watchSubjectEn, watchBodyEn, watchSubjectAr, watchBodyAr])

  const insertVariable = (variable: string) => {
    const field = activeLanguage === 'ar' ? 'bodyAr' : 'bodyEn'
    const currentValue = form.getValues(field)
    const textarea = document.getElementById(`${field}-textarea`) as HTMLTextAreaElement
    
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = currentValue.slice(0, start) + variable + currentValue.slice(end)
      form.setValue(field, newValue)
      
      // Reset cursor position
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    } else {
      form.setValue(field, currentValue + variable)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !customTags.includes(newTag.trim())) {
      const updatedTags = [...customTags, newTag.trim()]
      setCustomTags(updatedTags)
      form.setValue('tags', updatedTags)
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    const updatedTags = customTags.filter(tag => tag !== tagToRemove)
    setCustomTags(updatedTags)
    form.setValue('tags', updatedTags)
  }

  const applyQuickTemplate = (category: string) => {
    if (category !== 'CUSTOM' && TEMPLATE_CONTENT[category as keyof typeof TEMPLATE_CONTENT]) {
      const content = TEMPLATE_CONTENT[category as keyof typeof TEMPLATE_CONTENT]
      form.setValue('category', category as any)
      form.setValue('subjectEn', content.subjectEn)
      form.setValue('bodyEn', content.bodyEn)
      form.setValue('subjectAr', content.subjectAr)
      form.setValue('bodyAr', content.bodyAr)
    }
  }

  const onSubmit = async (data: TemplateFormData) => {
    setIsSubmitting(true)
    try {
      await onSave?.(data)
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCategoryInfo = (category: string) => {
    return TEMPLATE_CATEGORIES.find(cat => cat.value === category) || TEMPLATE_CATEGORIES[0]
  }

  const isRTL = activeLanguage === 'ar'

  return (
    <div className={cn("max-w-7xl mx-auto space-y-6", locale === 'ar' && "text-right")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6" />
                    {templateId ? t('editTemplate') : t('createTemplate')}
                  </CardTitle>
                  <CardDescription>
                    {t('builderDescription')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showPreview ? t('hidePreview') : t('showPreview')}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Main Content */}
            <div className="xl:col-span-3 space-y-6">
              <Tabs defaultValue="basic" className="space-y-6">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
                  <TabsTrigger value="content">{t('content')}</TabsTrigger>
                  <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
                  <TabsTrigger value="advanced">{t('advanced')}</TabsTrigger>
                </TabsList>

                {/* Basic Info Tab */}
                <TabsContent value="basic" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('templateInformation')}</CardTitle>
                      <CardDescription>{t('basicInfoDescription')}</CardDescription>
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
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('templateCategory')} *</FormLabel>
                              <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TEMPLATE_CATEGORIES.map(category => (
                                      <SelectItem key={category.value} value={category.value}>
                                        <div className="flex items-center gap-2">
                                          <span>{category.icon}</span>
                                          <span>{locale === 'ar' ? category.labelAr : category.labelEn}</span>
                                        </div>
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
                              <Textarea 
                                {...field} 
                                placeholder={t('enterDescription')}
                                rows={3}
                              />
                            </FormControl>
                            <FormDescription>
                              {getCategoryInfo(watchCategory).description}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category-specific alert */}
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>UAE Business Context</AlertTitle>
                        <AlertDescription>
                          This template follows UAE business etiquette and cultural norms for professional communication.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {/* Quick Templates */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('quickTemplates')}</CardTitle>
                      <CardDescription>{t('preBuiltTemplates')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {TEMPLATE_CATEGORIES.filter(cat => cat.value !== 'CUSTOM').map(category => (
                          <Button
                            key={category.value}
                            type="button"
                            variant="outline"
                            className="justify-start h-auto p-4"
                            onClick={() => applyQuickTemplate(category.value)}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-lg">{category.icon}</span>
                              <div className="text-left">
                                <div className="font-medium">
                                  {locale === 'ar' ? category.labelAr : category.labelEn}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {category.description}
                                </div>
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Content Tab */}
                <TabsContent value="content" className="space-y-6">
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
                      {/* Language Selector */}
                      <div className="flex items-center gap-4">
                        <Label>{t('editingLanguage')}:</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={activeLanguage === 'en' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveLanguage('en')}
                          >
                            <span className="w-6 h-4 bg-blue-500 text-white text-xs flex items-center justify-center rounded mr-2">EN</span>
                            English
                          </Button>
                          <Button
                            type="button"
                            variant={activeLanguage === 'ar' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveLanguage('ar')}
                          >
                            <span className="w-6 h-4 bg-green-500 text-white text-xs flex items-center justify-center rounded mr-2">AR</span>
                            العربية
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* English Content */}
                      {activeLanguage === 'en' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="subjectEn"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('emailSubject')} *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder={t('enterSubjectEn')} />
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
                                    id="bodyEn-textarea"
                                    placeholder={t('enterBodyEn')}
                                    className="min-h-[300px] font-mono"
                                    style={{ fontFamily: 'Segoe UI, sans-serif' }}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t('useVariablesEn')}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Arabic Content */}
                      {activeLanguage === 'ar' && (
                        <div className="space-y-4" dir="rtl">
                          <FormField
                            control={form.control}
                            name="subjectAr"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('emailSubject')} *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder={t('enterSubjectAr')} 
                                    dir="rtl"
                                    style={{ fontFamily: 'Noto Sans Arabic, Arial Unicode MS, sans-serif' }}
                                  />
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
                                    id="bodyAr-textarea"
                                    placeholder={t('enterBodyAr')}
                                    className="min-h-[300px]"
                                    dir="rtl"
                                    style={{ fontFamily: 'Noto Sans Arabic, Arial Unicode MS, sans-serif' }}
                                  />
                                </FormControl>
                                <FormDescription dir="ltr">
                                  {t('useVariablesAr')}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        {t('templateSettings')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('priority')}</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
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
                                  {t('uaeBusinessHours')}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="timezone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('timezone')}</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
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
                            name="uaeBusinessHoursOnly"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">{t('businessHoursOnly')}</FormLabel>
                                  <FormDescription>
                                    {t('businessHoursDescription')}
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Advanced Tab */}
                <TabsContent value="advanced" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('advancedOptions')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Tags */}
                      <div>
                        <Label className="text-base font-medium">{t('tags')}</Label>
                        <p className="text-sm text-muted-foreground mb-3">
                          {t('tagsDescription')}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {customTags.map(tag => (
                            <Badge key={tag} variant="secondary" className="gap-1">
                              {tag}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => removeTag(tag)}
                              />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('enterTag')}
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          />
                          <Button type="button" onClick={addTag} size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Status Toggle */}
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">{t('activeTemplate')}</FormLabel>
                              <FormDescription>
                                {t('activeTemplateDescription')}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Variables Sidebar */}
            <div className="xl:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    {t('templateVariables')}
                  </CardTitle>
                  <CardDescription>
                    {t('clickToInsert')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(UAE_VARIABLES).map(([category, variables]) => (
                    <div key={category}>
                      <h4 className="font-medium text-sm uppercase tracking-wide text-gray-600 mb-2">
                        {t(`variableCategory.${category}`)}
                      </h4>
                      <div className="space-y-2">
                        {variables.map((variable) => (
                          <Button
                            key={variable.key}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start h-auto p-2"
                            onClick={() => insertVariable(variable.key)}
                          >
                            <div className="text-left w-full">
                              <code className="text-xs bg-gray-100 px-1 rounded block mb-1">
                                {variable.key}
                              </code>
                              <p className="text-xs text-gray-600">
                                {locale === 'ar' ? variable.descriptionAr : variable.description}
                              </p>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}