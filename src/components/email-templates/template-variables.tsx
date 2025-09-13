'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Code, 
  Search, 
  Copy, 
  Check, 
  User, 
  CreditCard, 
  Building, 
  Calendar, 
  Phone, 
  Globe, 
  MapPin,
  Clock,
  Hash,
  DollarSign,
  Link,
  Tag,
  Info,
  Star,
  AlertCircle,
  FileText,
  Mail,
  Shield,
  RefreshCw
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface TemplateVariablesProps {
  onInsertVariable?: (variable: string) => void
  onPreviewVariable?: (variable: string, sampleValue: string) => void
  locale?: string
  className?: string
  compactMode?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

// Comprehensive UAE-specific template variables
const UAE_TEMPLATE_VARIABLES = {
  customer: {
    nameEn: 'Customer Information',
    nameAr: 'معلومات العميل',
    icon: User,
    color: 'blue',
    variables: [
      {
        key: 'customer_name',
        nameEn: 'Customer Name',
        nameAr: 'اسم العميل',
        descriptionEn: 'Customer company or individual name',
        descriptionAr: 'اسم الشركة أو الفرد العميل',
        exampleEn: 'Emirates Trading Company LLC',
        exampleAr: 'شركة الإمارات للتجارة ش.م.م',
        required: true,
        category: 'basic'
      },
      {
        key: 'customer_name_ar',
        nameEn: 'Customer Name (Arabic)',
        nameAr: 'اسم العميل (عربي)',
        descriptionEn: 'Customer name in Arabic',
        descriptionAr: 'اسم العميل باللغة العربية',
        exampleEn: 'شركة الإمارات للتجارة ش.م.م',
        exampleAr: 'شركة الإمارات للتجارة ش.م.م',
        required: false,
        category: 'localization'
      },
      {
        key: 'customer_email',
        nameEn: 'Customer Email',
        nameAr: 'بريد العميل الإلكتروني',
        descriptionEn: 'Customer primary email address',
        descriptionAr: 'عنوان البريد الإلكتروني الرئيسي للعميل',
        exampleEn: 'accounts@emiratestrading.ae',
        exampleAr: 'accounts@emiratestrading.ae',
        required: false,
        category: 'contact'
      },
      {
        key: 'customer_phone',
        nameEn: 'Customer Phone',
        nameAr: 'هاتف العميل',
        descriptionEn: 'Customer phone number (UAE format)',
        descriptionAr: 'رقم هاتف العميل (تنسيق الإمارات)',
        exampleEn: '+971 4 123 4567',
        exampleAr: '+971 4 123 4567',
        required: false,
        category: 'contact'
      },
      {
        key: 'customer_trn',
        nameEn: 'Customer TRN',
        nameAr: 'الرقم الضريبي للعميل',
        descriptionEn: 'Customer Tax Registration Number',
        descriptionAr: 'رقم التسجيل الضريبي للعميل',
        exampleEn: '100234567890003',
        exampleAr: '100234567890003',
        required: false,
        category: 'legal'
      },
      {
        key: 'customer_address',
        nameEn: 'Customer Address',
        nameAr: 'عنوان العميل',
        descriptionEn: 'Customer business address',
        descriptionAr: 'عنوان عمل العميل',
        exampleEn: 'Dubai International Financial Centre, Dubai',
        exampleAr: 'مركز دبي المالي العالمي، دبي',
        required: false,
        category: 'address'
      }
    ]
  },
  invoice: {
    nameEn: 'Invoice Information',
    nameAr: 'معلومات الفاتورة',
    icon: CreditCard,
    color: 'green',
    variables: [
      {
        key: 'invoice_number',
        nameEn: 'Invoice Number',
        nameAr: 'رقم الفاتورة',
        descriptionEn: 'Unique invoice identifier',
        descriptionAr: 'معرف الفاتورة الفريد',
        exampleEn: 'INV-2025-001',
        exampleAr: 'INV-2025-001',
        required: true,
        category: 'basic'
      },
      {
        key: 'invoice_amount',
        nameEn: 'Invoice Amount',
        nameAr: 'مبلغ الفاتورة',
        descriptionEn: 'Total invoice amount in AED',
        descriptionAr: 'إجمالي مبلغ الفاتورة بالدرهم',
        exampleEn: 'AED 12,500.00',
        exampleAr: '12,500.00 د.إ',
        required: true,
        category: 'financial'
      },
      {
        key: 'invoice_amount_words',
        nameEn: 'Amount in Words',
        nameAr: 'المبلغ بالكلمات',
        descriptionEn: 'Invoice amount written in words',
        descriptionAr: 'مبلغ الفاتورة مكتوب بالكلمات',
        exampleEn: 'Twelve Thousand Five Hundred Dirhams Only',
        exampleAr: 'اثنا عشر ألف وخمسمائة درهم فقط',
        required: false,
        category: 'financial'
      },
      {
        key: 'invoice_date',
        nameEn: 'Invoice Date',
        nameAr: 'تاريخ الفاتورة',
        descriptionEn: 'Invoice creation date',
        descriptionAr: 'تاريخ إنشاء الفاتورة',
        exampleEn: 'January 10, 2025',
        exampleAr: '10 يناير 2025',
        required: false,
        category: 'dates'
      },
      {
        key: 'due_date',
        nameEn: 'Due Date',
        nameAr: 'تاريخ الاستحقاق',
        descriptionEn: 'Payment due date (UAE format)',
        descriptionAr: 'تاريخ استحقاق الدفع (تنسيق الإمارات)',
        exampleEn: 'January 25, 2025',
        exampleAr: '25 يناير 2025',
        required: true,
        category: 'dates'
      },
      {
        key: 'days_overdue',
        nameEn: 'Days Overdue',
        nameAr: 'الأيام المتأخرة',
        descriptionEn: 'Number of days past due date',
        descriptionAr: 'عدد الأيام المتأخرة عن تاريخ الاستحقاق',
        exampleEn: '5',
        exampleAr: '5',
        required: false,
        category: 'calculations'
      },
      {
        key: 'vat_amount',
        nameEn: 'VAT Amount',
        nameAr: 'مبلغ ضريبة القيمة المضافة',
        descriptionEn: 'UAE VAT amount (5%)',
        descriptionAr: 'مبلغ ضريبة القيمة المضافة الإماراتية (5%)',
        exampleEn: 'AED 625.00',
        exampleAr: '625.00 د.إ',
        required: false,
        category: 'financial'
      },
      {
        key: 'subtotal_amount',
        nameEn: 'Subtotal Amount',
        nameAr: 'المبلغ الفرعي',
        descriptionEn: 'Amount before VAT',
        descriptionAr: 'المبلغ قبل ضريبة القيمة المضافة',
        exampleEn: 'AED 11,875.00',
        exampleAr: '11,875.00 د.إ',
        required: false,
        category: 'financial'
      }
    ]
  },
  company: {
    nameEn: 'Company Information',
    nameAr: 'معلومات الشركة',
    icon: Building,
    color: 'purple',
    variables: [
      {
        key: 'company_name',
        nameEn: 'Company Name',
        nameAr: 'اسم الشركة',
        descriptionEn: 'Your company name',
        descriptionAr: 'اسم شركتك',
        exampleEn: 'Smart Invoice Solutions LLC',
        exampleAr: 'شركة الحلول الذكية للفواتير ش.م.م',
        required: true,
        category: 'basic'
      },
      {
        key: 'company_name_ar',
        nameEn: 'Company Name (Arabic)',
        nameAr: 'اسم الشركة (عربي)',
        descriptionEn: 'Company name in Arabic',
        descriptionAr: 'اسم الشركة باللغة العربية',
        exampleEn: 'شركة الحلول الذكية للفواتير ش.م.م',
        exampleAr: 'شركة الحلول الذكية للفواتير ش.م.م',
        required: false,
        category: 'localization'
      },
      {
        key: 'company_trn',
        nameEn: 'Company TRN',
        nameAr: 'الرقم الضريبي للشركة',
        descriptionEn: 'Company Tax Registration Number',
        descriptionAr: 'رقم التسجيل الضريبي للشركة',
        exampleEn: '100123456789001',
        exampleAr: '100123456789001',
        required: true,
        category: 'legal'
      },
      {
        key: 'trade_license',
        nameEn: 'Trade License',
        nameAr: 'الرخصة التجارية',
        descriptionEn: 'UAE Trade License Number',
        descriptionAr: 'رقم الرخصة التجارية الإماراتية',
        exampleEn: 'DED-123456',
        exampleAr: 'DED-123456',
        required: false,
        category: 'legal'
      },
      {
        key: 'contact_phone',
        nameEn: 'Contact Phone',
        nameAr: 'هاتف الاتصال',
        descriptionEn: 'Company contact phone number',
        descriptionAr: 'رقم هاتف الاتصال بالشركة',
        exampleEn: '+971 4 987 6543',
        exampleAr: '+971 4 987 6543',
        required: false,
        category: 'contact'
      },
      {
        key: 'support_email',
        nameEn: 'Support Email',
        nameAr: 'بريد الدعم',
        descriptionEn: 'Customer support email address',
        descriptionAr: 'عنوان بريد دعم العملاء',
        exampleEn: 'support@smartinvoice.ae',
        exampleAr: 'support@smartinvoice.ae',
        required: false,
        category: 'contact'
      },
      {
        key: 'company_website',
        nameEn: 'Company Website',
        nameAr: 'موقع الشركة',
        descriptionEn: 'Company website URL',
        descriptionAr: 'رابط موقع الشركة',
        exampleEn: 'www.smartinvoice.ae',
        exampleAr: 'www.smartinvoice.ae',
        required: false,
        category: 'contact'
      },
      {
        key: 'company_address',
        nameEn: 'Company Address',
        nameAr: 'عنوان الشركة',
        descriptionEn: 'Company business address',
        descriptionAr: 'عنوان عمل الشركة',
        exampleEn: 'Business Bay, Dubai, UAE',
        exampleAr: 'الخليج التجاري، دبي، الإمارات',
        required: false,
        category: 'address'
      }
    ]
  },
  system: {
    nameEn: 'System & Dates',
    nameAr: 'النظام والتواريخ',
    icon: Clock,
    color: 'orange',
    variables: [
      {
        key: 'current_date',
        nameEn: 'Current Date',
        nameAr: 'التاريخ الحالي',
        descriptionEn: 'Current date (UAE format)',
        descriptionAr: 'التاريخ الحالي (تنسيق الإمارات)',
        exampleEn: 'January 15, 2025',
        exampleAr: '15 يناير 2025',
        required: false,
        category: 'dates'
      },
      {
        key: 'current_time',
        nameEn: 'Current Time',
        nameAr: 'الوقت الحالي',
        descriptionEn: 'Current time (UAE timezone)',
        descriptionAr: 'الوقت الحالي (توقيت الإمارات)',
        exampleEn: '10:30 AM',
        exampleAr: '10:30 صباحاً',
        required: false,
        category: 'dates'
      },
      {
        key: 'business_hours',
        nameEn: 'Business Hours',
        nameAr: 'ساعات العمل',
        descriptionEn: 'UAE business operating hours',
        descriptionAr: 'ساعات عمل الشركة في الإمارات',
        exampleEn: 'Sunday - Thursday, 9:00 AM - 6:00 PM',
        exampleAr: 'الأحد - الخميس، 9:00 ص - 6:00 م',
        required: false,
        category: 'business'
      },
      {
        key: 'financial_year',
        nameEn: 'Financial Year',
        nameAr: 'السنة المالية',
        descriptionEn: 'Current financial year',
        descriptionAr: 'السنة المالية الحالية',
        exampleEn: '2025',
        exampleAr: '2025',
        required: false,
        category: 'business'
      }
    ]
  },
  payment: {
    nameEn: 'Payment & Links',
    nameAr: 'الدفع والروابط',
    icon: Link,
    color: 'indigo',
    variables: [
      {
        key: 'payment_link',
        nameEn: 'Payment Link',
        nameAr: 'رابط الدفع',
        descriptionEn: 'Secure payment portal link',
        descriptionAr: 'رابط بوابة الدفع الآمنة',
        exampleEn: 'https://pay.smartinvoice.ae/invoice/2025001',
        exampleAr: 'https://pay.smartinvoice.ae/invoice/2025001',
        required: false,
        category: 'links'
      },
      {
        key: 'invoice_link',
        nameEn: 'Invoice Link',
        nameAr: 'رابط الفاتورة',
        descriptionEn: 'Direct link to view invoice',
        descriptionAr: 'رابط مباشر لعرض الفاتورة',
        exampleEn: 'https://app.smartinvoice.ae/invoices/2025001',
        exampleAr: 'https://app.smartinvoice.ae/invoices/2025001',
        required: false,
        category: 'links'
      },
      {
        key: 'payment_methods',
        nameEn: 'Available Payment Methods',
        nameAr: 'طرق الدفع المتاحة',
        descriptionEn: 'List of accepted payment methods',
        descriptionAr: 'قائمة بطرق الدفع المقبولة',
        exampleEn: 'Bank Transfer, Credit Card, Cash',
        exampleAr: 'تحويل بنكي، بطاقة ائتمان، نقداً',
        required: false,
        category: 'payment'
      },
      {
        key: 'bank_details',
        nameEn: 'Bank Details',
        nameAr: 'تفاصيل البنك',
        descriptionEn: 'Company bank account details for transfers',
        descriptionAr: 'تفاصيل الحساب البنكي للشركة للتحويلات',
        exampleEn: 'Emirates NBD - Account: 1234567890',
        exampleAr: 'بنك الإمارات دبي الوطني - الحساب: 1234567890',
        required: false,
        category: 'payment'
      },
      {
        key: 'total_outstanding',
        nameEn: 'Total Outstanding',
        nameAr: 'إجمالي المستحق',
        descriptionEn: 'Total amount outstanding across all invoices',
        descriptionAr: 'إجمالي المبلغ المستحق عبر جميع الفواتير',
        exampleEn: 'AED 37,500.00',
        exampleAr: '37,500.00 د.إ',
        required: false,
        category: 'financial'
      }
    ]
  }
}

export function TemplateVariables({
  onInsertVariable,
  onPreviewVariable,
  locale = 'en',
  className,
  compactMode = false,
  searchQuery: externalSearchQuery,
  onSearchChange
}: TemplateVariablesProps) {
  const t = useTranslations('templateVariables')
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || '')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [copiedVariable, setCopiedVariable] = useState<string>('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    onSearchChange?.(query)
  }

  const handleInsertVariable = (variableKey: string) => {
    const formattedVariable = `{{${variableKey}}}`
    onInsertVariable?.(formattedVariable)
  }

  const handleCopyVariable = async (variableKey: string) => {
    const formattedVariable = `{{${variableKey}}}`
    try {
      await navigator.clipboard.writeText(formattedVariable)
      setCopiedVariable(variableKey)
      setTimeout(() => setCopiedVariable(''), 2000)
    } catch (error) {
      console.error('Failed to copy variable:', error)
    }
  }

  const handlePreviewVariable = (variableKey: string, example: string) => {
    onPreviewVariable?.(variableKey, example)
  }

  // Filter variables based on search query and category
  const getFilteredVariables = () => {
    let filteredCategories = Object.entries(UAE_TEMPLATE_VARIABLES)

    if (selectedCategory !== 'all') {
      filteredCategories = filteredCategories.filter(([key]) => key === selectedCategory)
    }

    if (searchQuery) {
      filteredCategories = filteredCategories.map(([categoryKey, category]) => [
        categoryKey,
        {
          ...category,
          variables: category.variables.filter(variable =>
            variable.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            variable.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
            variable.nameAr.includes(searchQuery) ||
            variable.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
            variable.descriptionAr.includes(searchQuery)
          )
        }
      ]).filter(([, category]) => (category as any).variables.length > 0)
    }

    return filteredCategories
  }

  const getCategoryIcon = (iconComponent: any) => {
    const IconComponent = iconComponent
    return <IconComponent className="h-4 w-4" />
  }

  const getVariableBadgeColor = (category: string) => {
    switch (category) {
      case 'basic': return 'bg-blue-100 text-blue-800'
      case 'financial': return 'bg-green-100 text-green-800'
      case 'dates': return 'bg-orange-100 text-orange-800'
      case 'contact': return 'bg-purple-100 text-purple-800'
      case 'legal': return 'bg-red-100 text-red-800'
      case 'localization': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredCategories = getFilteredVariables()

  if (compactMode) {
    return (
      <Card className={cn("w-80", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Code className="h-4 w-4" />
            {t('variables')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={t('searchVariables')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-9"
              size="sm"
            />
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredCategories.map(([categoryKey, category]) => (
              <div key={categoryKey} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {locale === 'ar' ? (category as any).nameAr : (category as any).nameEn}
                </h4>
                <div className="space-y-1">
                  {(category as any).variables.map((variable: any) => (
                    <Button
                      key={variable.key}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-auto p-2 text-left"
                      onClick={() => handleInsertVariable(variable.key)}
                    >
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-xs bg-muted px-1 rounded">
                            {variable.key}
                          </code>
                          {variable.required && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              <Star className="h-2 w-2" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {locale === 'ar' ? variable.nameAr : variable.nameEn}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-6 w-6" />
            {t('templateVariables')}
          </CardTitle>
          <CardDescription>
            {t('variablesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder={t('searchVariables')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList>
                <TabsTrigger value="all">{t('allCategories')}</TabsTrigger>
                <TabsTrigger value="customer">{t('customer')}</TabsTrigger>
                <TabsTrigger value="invoice">{t('invoice')}</TabsTrigger>
                <TabsTrigger value="company">{t('company')}</TabsTrigger>
                <TabsTrigger value="system">{t('system')}</TabsTrigger>
                <TabsTrigger value="payment">{t('payment')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Variables by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCategories.map(([categoryKey, category]) => (
          <Card key={categoryKey}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {getCategoryIcon((category as any).icon)}
                {locale === 'ar' ? (category as any).nameAr : (category as any).nameEn}
              </CardTitle>
              <CardDescription>
                {(category as any).variables.length} {t('variablesAvailable')}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                {(category as any).variables.map((variable: any) => (
                  <Card key={variable.key} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Variable Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                                {`{{${variable.key}}}`}
                              </code>
                              {variable.required && (
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  {t('required')}
                                </Badge>
                              )}
                              <Badge 
                                className={cn("text-xs", getVariableBadgeColor(variable.category))}
                                variant="secondary"
                              >
                                {t(`category.${variable.category}`)}
                              </Badge>
                            </div>
                            
                            <h4 className="font-medium">
                              {locale === 'ar' ? variable.nameAr : variable.nameEn}
                            </h4>
                            
                            <p className="text-sm text-muted-foreground mt-1">
                              {locale === 'ar' ? variable.descriptionAr : variable.descriptionEn}
                            </p>
                          </div>
                        </div>

                        {/* Example */}
                        <div className="bg-muted/50 p-3 rounded-md">
                          <Label className="text-xs font-medium text-muted-foreground">
                            {t('example')}:
                          </Label>
                          <p className="text-sm mt-1" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                            {locale === 'ar' ? variable.exampleAr : variable.exampleEn}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewVariable(variable.key, locale === 'ar' ? variable.exampleAr : variable.exampleEn)}
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {t('preview')}
                          </Button>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyVariable(variable.key)}
                              className="text-xs"
                            >
                              {copiedVariable === variable.key ? (
                                <Check className="h-3 w-3 mr-1" />
                              ) : (
                                <Copy className="h-3 w-3 mr-1" />
                              )}
                              {copiedVariable === variable.key ? t('copied') : t('copy')}
                            </Button>
                            
                            <Button
                              size="sm"
                              onClick={() => handleInsertVariable(variable.key)}
                              className="text-xs"
                            >
                              {t('insert')}
                            </Button>
                          </div>
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
            <Search className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">{t('noVariablesFound')}</h3>
            <p className="text-gray-600 mb-4">{t('noVariablesFoundDescription')}</p>
            <Button onClick={() => {handleSearchChange(''); setSelectedCategory('all')}}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('clearSearch')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* UAE Business Context Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('uaeContextNote')}
        </AlertDescription>
      </Alert>
    </div>
  )
}