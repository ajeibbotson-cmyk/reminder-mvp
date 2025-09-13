'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Library, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Eye, 
  Copy, 
  Star, 
  Clock,
  Tag,
  Globe,
  CheckCircle,
  ArrowRight,
  Heart,
  TrendingUp,
  Sparkles,
  FileText,
  Languages
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'

interface TemplateLibraryProps {
  onSelectTemplate?: (template: any) => void
  onImportTemplate?: (template: any) => Promise<void>
  onExportTemplates?: (templates: any[]) => Promise<void>
  locale?: string
  companyId?: string
  className?: string
}

// UAE Business Template Categories
const UAE_TEMPLATE_CATEGORIES = [
  {
    id: 'gentle_reminders',
    nameEn: 'Gentle Reminders',
    nameAr: 'التذكيرات الودية',
    description: 'Professional, respectful reminders for UAE business culture',
    icon: '💌',
    color: 'blue',
    templates: [
      {
        id: 'gentle_day3',
        nameEn: 'Day 3 - Gentle Reminder',
        nameAr: 'اليوم 3 - تذكير ودود',
        descriptionEn: 'Polite reminder 3 days after due date',
        descriptionAr: 'تذكير مهذب بعد 3 أيام من تاريخ الاستحقاق',
        subjectEn: 'Friendly Payment Reminder - Invoice {{invoice_number}}',
        subjectAr: 'تذكير ودي بالدفع - فاتورة {{invoice_number}}',
        bodyEn: `Dear {{customer_name}},

I hope this email finds you well. This is a gentle reminder that Invoice {{invoice_number}} for {{invoice_amount}} was due on {{due_date}}.

We understand that sometimes invoices can be overlooked in busy schedules. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.

You can make payment through our secure portal: {{payment_link}}

Thank you for your continued business relationship.

Best regards,
{{company_name}}
TRN: {{company_trn}}`,
        bodyAr: `عزيزي {{customer_name_ar}}،

أتمنى أن تكون بخير. هذا تذكير ودي بأن الفاتورة رقم {{invoice_number}} بمبلغ {{invoice_amount}} كان موعد استحقاقها في {{due_date}}.

نتفهم أنه أحياناً قد يتم نسيان الفواتير في ظل الجداول المزدحمة. إذا كان لديك أي أسئلة حول هذه الفاتورة أو تحتاج لمناقشة ترتيبات الدفع، يرجى عدم التردد في الاتصال بنا.

يمكنك القيام بالدفع من خلال بوابتنا الآمنة: {{payment_link}}

شكراً لاستمرار علاقتنا التجارية.

أطيب التحيات،
{{company_name}}
الرقم الضريبي: {{company_trn}}`,
        tags: ['gentle', 'day3', 'professional'],
        popularity: 95,
        effectiveness: 87,
        usage: 1250
      }
    ]
  },
  {
    id: 'professional_followups',
    nameEn: 'Professional Follow-ups',
    nameAr: 'المتابعات المهنية', 
    description: 'Direct but respectful follow-ups with payment options',
    icon: '📋',
    color: 'orange',
    templates: [
      {
        id: 'followup_day7',
        nameEn: 'Day 7 - Professional Follow-up',
        nameAr: 'اليوم 7 - متابعة مهنية',
        descriptionEn: 'Professional follow-up 7 days after due date',
        descriptionAr: 'متابعة مهنية بعد 7 أيام من تاريخ الاستحقاق',
        subjectEn: 'Payment Follow-up Required - Invoice {{invoice_number}}',
        subjectAr: 'متابعة دفع مطلوبة - فاتورة {{invoice_number}}',
        bodyEn: `Dear {{customer_name}},

We hope you are doing well. We are following up on Invoice {{invoice_number}} for {{invoice_amount}}, which was due on {{due_date}} and is now {{days_overdue}} days overdue.

Please arrange payment at your earliest convenience through our secure payment portal: {{payment_link}}

Payment Options Available:
• Online payment via our secure portal
• Bank transfer to our account
• Payment by phone during business hours

If you have already processed this payment, please accept our apologies and kindly forward the payment confirmation to {{support_email}}.

For any payment-related queries, please contact us during UAE business hours at {{contact_phone}}.

Thank you for your prompt attention to this matter.

Regards,
{{company_name}}
TRN: {{company_trn}}`,
        bodyAr: `عزيزي {{customer_name_ar}}،

نأمل أن تكون بخير. نتابع معك بخصوص الفاتورة رقم {{invoice_number}} بمبلغ {{invoice_amount}}، والتي كانت مستحقة في {{due_date}} وهي الآن متأخرة {{days_overdue}} يوماً.

يرجى ترتيب الدفع في أقرب وقت ممكن من خلال بوابة الدفع الآمنة: {{payment_link}}

خيارات الدفع المتاحة:
• الدفع الإلكتروني عبر بوابتنا الآمنة
• التحويل البنكي إلى حسابنا
• الدفع عبر الهاتف خلال ساعات العمل

إذا كنت قد قمت بالدفع بالفعل، نعتذر ونرجو إرسال تأكيد الدفع إلى {{support_email}}.

لأي استفسارات متعلقة بالدفع، يرجى الاتصال بنا خلال ساعات العمل في الإمارات على {{contact_phone}}.

شكراً لاهتمامك السريع بهذا الأمر.

مع التحية،
{{company_name}}
الرقم الضريبي: {{company_trn}}`,
        tags: ['professional', 'day7', 'payment_options'],
        popularity: 89,
        effectiveness: 82,
        usage: 980
      }
    ]
  },
  {
    id: 'firm_notices',
    nameEn: 'Firm Notices',
    nameAr: 'الإشعارات الحازمة',
    description: 'Clear consequences while maintaining business relationships',
    icon: '⚠️',
    color: 'red',
    templates: [
      {
        id: 'firm_day15',
        nameEn: 'Day 15 - Firm Notice',
        nameAr: 'اليوم 15 - إشعار حازم',
        descriptionEn: 'Firm notice with clear next steps',
        descriptionAr: 'إشعار حازم مع خطوات واضحة',
        subjectEn: 'URGENT: Payment Required - Invoice {{invoice_number}} ({{days_overdue}} days overdue)',
        subjectAr: 'عاجل: دفع مطلوب - فاتورة {{invoice_number}} (متأخرة {{days_overdue}} يوماً)',
        bodyEn: `Dear {{customer_name}},

This is an urgent notice regarding your overdue invoice {{invoice_number}} for {{invoice_amount}}.

Invoice Details:
• Original Due Date: {{due_date}}
• Days Overdue: {{days_overdue}}
• Outstanding Amount: {{invoice_amount}}

Despite our previous reminders, this invoice remains unpaid. We must receive payment within the next 7 business days to avoid any service interruption or collection proceedings.

IMMEDIATE ACTION REQUIRED:
Please make payment using: {{payment_link}}

If there are any issues preventing payment, please contact our accounts department immediately at {{contact_phone}} or {{support_email}}.

We value our business relationship and hope to resolve this matter promptly.

Regards,
{{company_name}}
Accounts Department
TRN: {{company_trn}}`,
        bodyAr: `عزيزي {{customer_name_ar}}،

هذا إشعار عاجل بخصوص الفاتورة المتأخرة رقم {{invoice_number}} بمبلغ {{invoice_amount}}.

تفاصيل الفاتورة:
• تاريخ الاستحقاق الأصلي: {{due_date}}
• الأيام المتأخرة: {{days_overdue}}
• المبلغ المستحق: {{invoice_amount}}

رغم تذكيراتنا السابقة، تبقى هذه الفاتورة غير مسددة. يجب أن نتلقى الدفع خلال الـ 7 أيام عمل القادمة لتجنب أي انقطاع في الخدمة أو إجراءات التحصيل.

مطلوب إجراء فوري:
يرجى سداد المبلغ باستخدام: {{payment_link}}

إذا كانت هناك أي مشاكل تمنع الدفع، يرجى الاتصال بقسم الحسابات فوراً على {{contact_phone}} أو {{support_email}}.

نقدر علاقتنا التجارية ونأمل في حل هذا الأمر بسرعة.

مع التحية،
{{company_name}}
قسم الحسابات
الرقم الضريبي: {{company_trn}}`,
        tags: ['urgent', 'day15', 'consequences'],
        popularity: 76,
        effectiveness: 91,
        usage: 654
      }
    ]
  },
  {
    id: 'final_notices',
    nameEn: 'Final Notices',
    nameAr: 'الإشعارات الأخيرة',
    description: 'Formal notices with legal implications, UAE compliant',
    icon: '🔔',
    color: 'purple',
    templates: [
      {
        id: 'final_day30',
        nameEn: 'Day 30 - Final Notice',
        nameAr: 'اليوم 30 - الإشعار الأخير',
        descriptionEn: 'Final notice before legal action',
        descriptionAr: 'الإشعار الأخير قبل الإجراء القانوني',
        subjectEn: 'FINAL NOTICE - Legal Action Pending - Invoice {{invoice_number}}',
        subjectAr: 'الإشعار الأخير - إجراء قانوني معلق - فاتورة {{invoice_number}}',
        bodyEn: `Dear {{customer_name}},

This is the FINAL NOTICE regarding the outstanding Invoice {{invoice_number}} for {{invoice_amount}}, which is now {{days_overdue}} days overdue.

ACCOUNT STATUS:
• Original Invoice Date: {{invoice_date}}
• Due Date: {{due_date}}
• Days Overdue: {{days_overdue}}
• Outstanding Amount: {{invoice_amount}}

Despite multiple attempts to collect payment, this invoice remains unsettled. Unless payment is received within 5 business days from the date of this notice, we will be compelled to:

1. Suspend all services with immediate effect
2. Transfer your account to our legal collection agency
3. Initiate legal proceedings as permitted under UAE Commercial Law
4. Report this matter to relevant credit agencies

LAST OPPORTUNITY TO RESOLVE:
Please make immediate payment using: {{payment_link}}

If you wish to discuss payment arrangements, please contact our senior accounts manager immediately at {{contact_phone}}.

This notice serves as formal demand for payment under UAE Commercial Transactions Law.

Yours truly,
{{company_name}}
Senior Management
TRN: {{company_trn}}

---
This is a formal business communication. Please retain this notice for your records.`,
        bodyAr: `عزيزي {{customer_name_ar}}،

هذا هو الإشعار الأخير بخصوص الفاتورة المستحقة رقم {{invoice_number}} بمبلغ {{invoice_amount}}، والمتأخرة الآن {{days_overdue}} يوماً.

حالة الحساب:
• تاريخ الفاتورة الأصلي: {{invoice_date}}
• تاريخ الاستحقاق: {{due_date}}
• الأيام المتأخرة: {{days_overdue}}
• المبلغ المستحق: {{invoice_amount}}

رغم المحاولات المتعددة لتحصيل المبلغ، تبقى هذه الفاتورة غير مسددة. ما لم يتم استلام الدفع خلال 5 أيام عمل من تاريخ هذا الإشعار، سنضطر إلى:

1. إيقاف جميع الخدمات بأثر فوري
2. تحويل حسابك إلى وكالة التحصيل القانونية
3. بدء الإجراءات القانونية كما يسمح قانون التجارة الإماراتي
4. الإبلاغ عن هذا الأمر لوكالات الائتمان ذات الصلة

الفرصة الأخيرة للحل:
يرجى سداد المبلغ فوراً باستخدام: {{payment_link}}

إذا كنت ترغب في مناقشة ترتيبات الدفع، يرجى الاتصال بمدير الحسابات الأول فوراً على {{contact_phone}}.

يعتبر هذا الإشعار بمثابة مطالبة رسمية بالدفع بموجب قانون المعاملات التجارية الإماراتي.

المخلصون لكم،
{{company_name}}
الإدارة العليا
الرقم الضريبي: {{company_trn}}

---
هذه مراسلة تجارية رسمية. يرجى الاحتفاظ بهذا الإشعار في سجلاتك.`,
        tags: ['final', 'legal', 'day30', 'formal'],
        popularity: 45,
        effectiveness: 96,
        usage: 234
      }
    ]
  },
  {
    id: 'welcome_series',
    nameEn: 'Welcome Series',
    nameAr: 'سلسلة الترحيب',
    description: 'Welcome new customers with UAE hospitality',
    icon: '🤝',
    color: 'green',
    templates: [
      {
        id: 'welcome_new_customer',
        nameEn: 'New Customer Welcome',
        nameAr: 'ترحيب بالعميل الجديد',
        descriptionEn: 'Welcome new customers to your business',
        descriptionAr: 'ترحيب بالعملاء الجدد في عملك',
        subjectEn: 'Welcome to {{company_name}} - Your Business Partner in the UAE',
        subjectAr: 'أهلاً بك في {{company_name}} - شريك أعمالك في الإمارات',
        bodyEn: `Dear {{customer_name}},

Ahlan wa Sahlan! Welcome to {{company_name}}.

We are delighted to welcome you as our new business partner. As a UAE-based company, we understand the unique needs of businesses operating in this dynamic market.

What you can expect from us:
• Professional service tailored to UAE business culture
• Timely invoicing and transparent billing
• Multiple payment options for your convenience
• Dedicated support during UAE business hours
• Compliance with all UAE commercial regulations

Your account is now set up and ready. You can access your dashboard and manage invoices at: {{payment_link}}

For any questions or support, please don't hesitate to contact us:
📧 {{support_email}}
📞 {{contact_phone}}
🕒 Sunday - Thursday, 9:00 AM - 6:00 PM (UAE Time)

We look forward to a successful business relationship.

Welcome aboard!

{{company_name}} Team
TRN: {{company_trn}}`,
        bodyAr: `عزيزي {{customer_name_ar}}،

أهلاً وسهلاً! مرحباً بك في {{company_name}}.

يسعدنا الترحيب بك كشريك أعمال جديد. كشركة مقرها في الإمارات، نتفهم الاحتياجات الفريدة للشركات العاملة في هذا السوق الديناميكي.

ما يمكنك توقعه منا:
• خدمة مهنية مصممة خصيصاً لثقافة الأعمال الإماراتية
• فوترة في الوقت المحدد وفواتير شفافة
• خيارات دفع متعددة لراحتك
• دعم مخصص خلال ساعات العمل الإماراتية
• الامتثال لجميع اللوائح التجارية الإماراتية

تم إعداد حسابك الآن وهو جاهز. يمكنك الوصول إلى لوحة التحكم وإدارة الفواتير على: {{payment_link}}

لأي أسئلة أو دعم، لا تتردد في الاتصال بنا:
📧 {{support_email}}
📞 {{contact_phone}}
🕒 الأحد - الخميس، 9:00 ص - 6:00 م (توقيت الإمارات)

نتطلع إلى علاقة تجارية ناجحة.

أهلاً بك على متن السفينة!

فريق {{company_name}}
الرقم الضريبي: {{company_trn}}`,
        tags: ['welcome', 'new_customer', 'onboarding'],
        popularity: 88,
        effectiveness: 94,
        usage: 445
      }
    ]
  },
  {
    id: 'payment_confirmations',
    nameEn: 'Payment Confirmations',
    nameAr: 'تأكيدات الدفع',
    description: 'Professional payment received confirmations',
    icon: '✅',
    color: 'green',
    templates: [
      {
        id: 'payment_received',
        nameEn: 'Payment Received Confirmation',
        nameAr: 'تأكيد استلام الدفع',
        descriptionEn: 'Confirm payment receipt with thanks',
        descriptionAr: 'تأكيد استلام الدفع مع الشكر',
        subjectEn: 'Payment Received - Invoice {{invoice_number}} - Thank You',
        subjectAr: 'تم استلام الدفع - فاتورة {{invoice_number}} - شكراً لك',
        bodyEn: `Dear {{customer_name}},

Shukran! Thank you for your payment.

We are pleased to confirm that we have received your payment for Invoice {{invoice_number}}.

Payment Details:
• Invoice Number: {{invoice_number}}
• Amount Paid: {{invoice_amount}}
• Payment Date: {{current_date}}
• Payment Method: {{payment_method}}

Your account has been updated and the invoice has been marked as paid. You can view your updated account status at: {{payment_link}}

We appreciate your prompt payment and look forward to continuing our business relationship.

If you need a formal receipt or have any questions, please contact us at {{support_email}} or {{contact_phone}}.

Thank you for choosing {{company_name}}.

Best regards,
{{company_name}} Accounts Team
TRN: {{company_trn}}`,
        bodyAr: `عزيزي {{customer_name_ar}}،

شكراً! نشكرك على دفعتك.

يسعدنا تأكيد أننا استلمنا دفعك للفاتورة رقم {{invoice_number}}.

تفاصيل الدفع:
• رقم الفاتورة: {{invoice_number}}
• المبلغ المدفوع: {{invoice_amount}}
• تاريخ الدفع: {{current_date}}
• طريقة الدفع: {{payment_method}}

تم تحديث حسابك وتم تسجيل الفاتورة كمدفوعة. يمكنك عرض حالة حسابك المحدثة على: {{payment_link}}

نقدر دفعك السريع ونتطلع إلى استمرار علاقتنا التجارية.

إذا كنت بحاجة إلى إيصال رسمي أو لديك أي أسئلة، يرجى الاتصال بنا على {{support_email}} أو {{contact_phone}}.

شكراً لاختيارك {{company_name}}.

أطيب التحيات،
فريق حسابات {{company_name}}
الرقم الضريبي: {{company_trn}}`,
        tags: ['confirmation', 'payment', 'thank_you'],
        popularity: 92,
        effectiveness: 98,
        usage: 1876
      }
    ]
  }
]

export function TemplateLibrary({
  onSelectTemplate,
  onImportTemplate,
  onExportTemplates,
  locale = 'en',
  companyId,
  className
}: TemplateLibraryProps) {
  const t = useTranslations('templateLibrary')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [importingTemplate, setImportingTemplate] = useState(false)

  // Filter templates based on search and category
  const getFilteredTemplates = () => {
    let filteredCategories = UAE_TEMPLATE_CATEGORIES

    if (selectedCategory !== 'all') {
      filteredCategories = UAE_TEMPLATE_CATEGORIES.filter(cat => cat.id === selectedCategory)
    }

    if (searchQuery) {
      filteredCategories = filteredCategories.map(category => ({
        ...category,
        templates: category.templates.filter(template =>
          template.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.nameAr.includes(searchQuery) ||
          template.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.descriptionAr.includes(searchQuery) ||
          template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      })).filter(category => category.templates.length > 0)
    }

    return filteredCategories
  }

  const handlePreviewTemplate = (template: any) => {
    setSelectedTemplate(template)
    setShowPreview(true)
  }

  const handleImportTemplate = async (template: any) => {
    if (!onImportTemplate) return
    
    setImportingTemplate(true)
    try {
      await onImportTemplate(template)
    } catch (error) {
      console.error('Failed to import template:', error)
    } finally {
      setImportingTemplate(false)
    }
  }

  const getEffectivenessColor = (effectiveness: number) => {
    if (effectiveness >= 90) return 'text-green-600'
    if (effectiveness >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getEffectivenessText = (effectiveness: number) => {
    if (effectiveness >= 90) return t('highEffectiveness')
    if (effectiveness >= 75) return t('mediumEffectiveness')
    return t('lowEffectiveness')
  }

  const filteredCategories = getFilteredTemplates()

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-6 w-6" />
                {t('templateLibrary')}
              </CardTitle>
              <CardDescription>
                {t('libraryDescription')}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                {t('import')}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t('export')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchTemplates')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {UAE_TEMPLATE_CATEGORIES.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{locale === 'ar' ? category.nameAr : category.nameEn}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Template Categories */}
      <div className="space-y-8">
        {filteredCategories.map(category => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div>
                    <CardTitle className="text-lg">
                      {locale === 'ar' ? category.nameAr : category.nameEn}
                    </CardTitle>
                    <CardDescription>
                      {category.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline">
                  {category.templates.length} {t('templates')}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {category.templates.map(template => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {locale === 'ar' ? template.nameAr : template.nameEn}
                            <Languages className="h-4 w-4 text-muted-foreground" />
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {locale === 'ar' ? template.descriptionAr : template.descriptionEn}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">{template.popularity}%</span>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Template Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{template.usage.toLocaleString()}</div>
                          <div className="text-muted-foreground">{t('timesUsed')}</div>
                        </div>
                        <div className="text-center">
                          <div className={cn("font-medium", getEffectivenessColor(template.effectiveness))}>
                            {template.effectiveness}%
                          </div>
                          <div className="text-muted-foreground">{t('effective')}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-600">{template.popularity}%</div>
                          <div className="text-muted-foreground">{t('popular')}</div>
                        </div>
                      </div>

                      {/* Effectiveness Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{t('effectiveness')}</span>
                          <span className={getEffectivenessColor(template.effectiveness)}>
                            {getEffectivenessText(template.effectiveness)}
                          </span>
                        </div>
                        <Progress 
                          value={template.effectiveness} 
                          className="h-2"
                        />
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-between pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreviewTemplate(template)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {t('preview')}
                        </Button>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImportTemplate(template)}
                            disabled={importingTemplate}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            {t('useTemplate')}
                          </Button>
                          
                          {onSelectTemplate && (
                            <Button
                              size="sm"
                              onClick={() => onSelectTemplate(template)}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Library className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">{t('noTemplatesFound')}</h3>
            <p className="text-gray-600 mb-4">{t('noTemplatesFoundDescription')}</p>
            <Button onClick={() => {setSearchQuery(''); setSelectedCategory('all')}}>
              {t('clearFilters')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Template Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {selectedTemplate && (locale === 'ar' ? selectedTemplate.nameAr : selectedTemplate.nameEn)}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate && (locale === 'ar' ? selectedTemplate.descriptionAr : selectedTemplate.descriptionEn)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="flex-1 overflow-auto">
              <Tabs defaultValue="preview" className="h-full">
                <TabsList>
                  <TabsTrigger value="preview">{t('preview')}</TabsTrigger>
                  <TabsTrigger value="english">English</TabsTrigger>
                  <TabsTrigger value="arabic">العربية</TabsTrigger>
                </TabsList>
                
                <TabsContent value="preview" className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('previewNote')}
                    </AlertDescription>
                  </Alert>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {selectedTemplate.subjectEn}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: selectedTemplate.bodyEn.replace(/\n/g, '<br />') 
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="english" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="font-medium">{t('subject')}</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md font-mono text-sm">
                        {selectedTemplate.subjectEn}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="font-medium">{t('body')}</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md font-mono text-sm whitespace-pre-wrap">
                        {selectedTemplate.bodyEn}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="arabic" className="space-y-4">
                  <div className="space-y-4" dir="rtl">
                    <div>
                      <Label className="font-medium">{t('subject')}</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                        {selectedTemplate.subjectAr}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="font-medium">{t('body')}</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                        {selectedTemplate.bodyAr}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                >
                  {t('close')}
                </Button>
                <Button
                  onClick={() => {
                    handleImportTemplate(selectedTemplate)
                    setShowPreview(false)
                  }}
                  disabled={importingTemplate}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('useTemplate')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}