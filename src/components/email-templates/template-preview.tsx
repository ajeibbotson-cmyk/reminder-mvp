'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Eye, 
  Mail, 
  Monitor, 
  Smartphone, 
  Tablet,
  Maximize2,
  Languages,
  Send,
  Download,
  Share,
  Copy,
  Check,
  Printer,
  RefreshCw,
  Settings,
  Globe,
  Clock,
  User,
  CreditCard,
  Building,
  Phone,
  MapPin,
  Calendar
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from '@/lib/utils'

interface TemplatePreviewProps {
  template: {
    id: string
    name: string
    templateType?: string
    category?: string
    subjectEn: string
    subjectAr: string
    bodyEn?: string
    bodyAr?: string
    contentEn?: string
    contentAr?: string
    isActive: boolean
    variables?: Record<string, any>
    tags?: string[]
  }
  previewData?: Record<string, any>
  onSendTest?: (email: string, language: 'en' | 'ar') => Promise<void>
  onExport?: (format: 'html' | 'pdf' | 'docx') => void
  onPrint?: () => void
  locale?: string
  className?: string
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop'
type PreviewMode = 'email' | 'web' | 'print'

// Enhanced UAE-specific preview data
const DEFAULT_PREVIEW_DATA = {
  // Customer Information
  customer_name: 'Emirates Trading Company LLC',
  customer_name_ar: 'شركة الإمارات للتجارة ش.م.م',
  customer_email: 'accounts@emiratestrading.ae',
  customer_phone: '+971 4 123 4567',
  customer_address: 'Dubai International Financial Centre, Dubai',
  customer_trn: '100234567890003',
  
  // Invoice Information
  invoice_number: 'INV-2025-001',
  invoice_amount: 'AED 12,500.00',
  invoice_amount_ar: '12,500.00 د.إ',
  invoice_date: 'January 10, 2025',
  invoice_date_ar: '10 يناير 2025',
  due_date: 'January 25, 2025',
  due_date_ar: '25 يناير 2025',
  days_overdue: '5',
  payment_method: 'Bank Transfer',
  payment_method_ar: 'تحويل بنكي',
  
  // Company Information
  company_name: 'Smart Invoice Solutions LLC',
  company_name_ar: 'شركة الحلول الذكية للفواتير ش.م.م',
  company_trn: '100123456789001',
  company_address: 'Business Bay, Dubai, UAE',
  company_address_ar: 'الخليج التجاري، دبي، الإمارات',
  contact_phone: '+971 4 987 6543',
  support_email: 'support@smartinvoice.ae',
  website: 'www.smartinvoice.ae',
  
  // System Information
  current_date: 'January 15, 2025',
  current_date_ar: '15 يناير 2025',
  current_time: '10:30 AM',
  current_time_ar: '10:30 صباحاً',
  business_hours: 'Sunday - Thursday, 9:00 AM - 6:00 PM',
  business_hours_ar: 'الأحد - الخميس، 9:00 ص - 6:00 م',
  
  // Payment Information
  payment_link: 'https://pay.smartinvoice.ae/invoice/2025001',
  invoice_link: 'https://app.smartinvoice.ae/invoices/2025001',
  total_outstanding: 'AED 37,500.00',
  total_outstanding_ar: '37,500.00 د.إ',
  
  // UAE-specific
  vat_number: '100123456789001',
  trade_license: 'DED-123456',
  emirates_id: 'Smart Invoice Solutions',
  business_activity: 'Software Development & IT Consultancy'
}

// Email client viewport simulations
const EMAIL_CLIENTS = {
  gmail: { name: 'Gmail', width: '600px', bg: '#f6f8fc' },
  outlook: { name: 'Outlook', width: '660px', bg: '#ffffff' },
  apple: { name: 'Apple Mail', width: '600px', bg: '#f7f7f7' },
  mobile: { name: 'Mobile Mail', width: '320px', bg: '#ffffff' }
}

export function TemplatePreview({
  template,
  previewData = DEFAULT_PREVIEW_DATA,
  onSendTest,
  onExport,
  onPrint,
  locale = 'en',
  className
}: TemplatePreviewProps) {
  const t = useTranslations('templatePreview')
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>('en')
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('email')
  const [emailClient, setEmailClient] = useState('gmail')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [copied, setCopied] = useState(false)
  const [customPreviewData, setCustomPreviewData] = useState(previewData)
  const [showCustomData, setShowCustomData] = useState(false)

  const processContent = (content: string, language: 'en' | 'ar') => {
    let processed = content

    // Replace template variables with preview data
    Object.entries(customPreviewData).forEach(([key, value]) => {
      const variable = `{{${key}}}`
      processed = processed.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value))
    })

    // Convert line breaks to HTML
    processed = processed.replace(/\n/g, '<br />')

    return processed
  }

  const getSubject = () => {
    const subject = selectedLanguage === 'ar' ? template.subjectAr : template.subjectEn
    return processContent(subject, selectedLanguage)
  }

  const getContent = () => {
    const content = selectedLanguage === 'ar' 
      ? (template.bodyAr || template.contentAr) 
      : (template.bodyEn || template.contentEn)
    return processContent(content || '', selectedLanguage)
  }

  const getViewportClass = () => {
    switch (viewportSize) {
      case 'mobile':
        return 'max-w-sm mx-auto'
      case 'tablet':
        return 'max-w-2xl mx-auto'
      default:
        return 'max-w-4xl mx-auto'
    }
  }

  const getEmailClientStyle = () => {
    const client = EMAIL_CLIENTS[emailClient as keyof typeof EMAIL_CLIENTS]
    return {
      width: viewportSize === 'mobile' ? '320px' : client.width,
      backgroundColor: client.bg
    }
  }

  const handleSendTest = async () => {
    if (!testEmail || !onSendTest) return
    
    setSendingTest(true)
    try {
      await onSendTest(testEmail, selectedLanguage)
      setTestEmail('')
    } catch (error) {
      console.error('Failed to send test email:', error)
    } finally {
      setSendingTest(false)
    }
  }

  const handleCopyContent = async () => {
    const fullContent = `Subject: ${getSubject()}\n\n${getContent().replace(/<br\s*\/?>/g, '\n').replace(/<[^>]*>/g, '')}`
    
    try {
      await navigator.clipboard.writeText(fullContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
  }

  const updatePreviewData = (key: string, value: string) => {
    setCustomPreviewData(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const resetPreviewData = () => {
    setCustomPreviewData(DEFAULT_PREVIEW_DATA)
  }

  const isRTL = selectedLanguage === 'ar'

  return (
    <div className={cn("space-y-4", className)}>
      {/* Preview Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t('templatePreview')}
              </CardTitle>
              <CardDescription>
                {template.name} • {template.category && t(`templateCategory.${template.category}`)}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={template.isActive ? 'default' : 'secondary'}>
                {template.isActive ? t('active') : t('inactive')}
              </Badge>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(true)}
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                {t('fullscreen')}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as PreviewMode)}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              {/* Preview Mode Tabs */}
              <TabsList>
                <TabsTrigger value="email">
                  <Mail className="h-4 w-4 mr-2" />
                  {t('emailPreview')}
                </TabsTrigger>
                <TabsTrigger value="web">
                  <Globe className="h-4 w-4 mr-2" />
                  {t('webPreview')}
                </TabsTrigger>
                <TabsTrigger value="print">
                  <Printer className="h-4 w-4 mr-2" />
                  {t('printPreview')}
                </TabsTrigger>
              </TabsList>

              {/* Language Toggle */}
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                <Select value={selectedLanguage} onValueChange={(value: 'en' | 'ar') => setSelectedLanguage(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Email Preview Controls */}
            <TabsContent value="email" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Email Client Selector */}
                <div className="flex items-center gap-2">
                  <Label>{t('emailClient')}:</Label>
                  <Select value={emailClient} onValueChange={setEmailClient}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMAIL_CLIENTS).map(([key, client]) => (
                        <SelectItem key={key} value={key}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Viewport Size Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewportSize === 'mobile' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewportSize('mobile')}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewportSize === 'tablet' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewportSize('tablet')}
                  >
                    <Tablet className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewportSize === 'desktop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewportSize('desktop')}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomData(!showCustomData)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {t('customizeData')}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyContent}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copied ? t('copied') : t('copy')}
                  </Button>

                  {onExport && (
                    <Select onValueChange={(format: 'html' | 'pdf' | 'docx') => onExport(format)}>
                      <SelectTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          {t('export')}
                        </Button>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">{t('exportHtml')}</SelectItem>
                        <SelectItem value="pdf">{t('exportPdf')}</SelectItem>
                        <SelectItem value="docx">{t('exportDocx')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {onSendTest && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Send className="h-4 w-4 mr-2" />
                          {t('sendTest')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('sendTestEmail')}</DialogTitle>
                          <DialogDescription>
                            {t('sendTestDescription')}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="test-email">{t('emailAddress')}</Label>
                            <Input
                              id="test-email"
                              type="email"
                              placeholder="test@example.com"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                            />
                          </div>
                          
                          <Alert>
                            <AlertDescription>
                              {t('testEmailNote', { language: selectedLanguage.toUpperCase() })}
                            </AlertDescription>
                          </Alert>
                          
                          <div className="flex justify-end gap-3">
                            <Button
                              onClick={handleSendTest}
                              disabled={!testEmail || sendingTest}
                            >
                              {sendingTest ? (
                                <>
                                  <Send className="h-4 w-4 mr-2 animate-pulse" />
                                  {t('sending')}
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-2" />
                                  {t('send')} ({selectedLanguage.toUpperCase()})
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Custom Data Panel */}
              {showCustomData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      {t('customizePreviewData')}
                      <Button variant="outline" size="sm" onClick={resetPreviewData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t('reset')}
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      {t('customizeDataDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Customer Information */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {t('customerInfo')}
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Customer Name</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.customer_name}
                              onChange={(e) => updatePreviewData('customer_name', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Customer Name (Arabic)</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.customer_name_ar}
                              onChange={(e) => updatePreviewData('customer_name_ar', e.target.value)}
                              dir="rtl"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Invoice Information */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          {t('invoiceInfo')}
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Invoice Number</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.invoice_number}
                              onChange={(e) => updatePreviewData('invoice_number', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Invoice Amount</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.invoice_amount}
                              onChange={(e) => updatePreviewData('invoice_amount', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Days Overdue</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.days_overdue}
                              onChange={(e) => updatePreviewData('days_overdue', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Company Information */}
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {t('companyInfo')}
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Company Name</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.company_name}
                              onChange={(e) => updatePreviewData('company_name', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Company TRN</Label>
                            <Input
                              size="sm"
                              value={customPreviewData.company_trn}
                              onChange={(e) => updatePreviewData('company_trn', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="web" className="space-y-4">
              <Alert>
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  {t('webPreviewDescription')}
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="print" className="space-y-4">
              <div className="flex justify-between items-center">
                <Alert className="flex-1 mr-4">
                  <Printer className="h-4 w-4" />
                  <AlertDescription>
                    {t('printPreviewDescription')}
                  </AlertDescription>
                </Alert>
                {onPrint && (
                  <Button onClick={onPrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    {t('print')}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Content */}
      <Card>
        <CardContent className="p-0">
          <div className={cn("bg-gray-50 p-4", getViewportClass())}>
            {/* Email Client Simulation */}
            {previewMode === 'email' && (
              <div 
                className="mx-auto bg-white rounded-lg shadow-lg overflow-hidden"
                style={getEmailClientStyle()}
              >
                {/* Email Client Header */}
                <div className="bg-gray-100 p-3 border-b text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>{EMAIL_CLIENTS[emailClient as keyof typeof EMAIL_CLIENTS].name}</span>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{customPreviewData.current_time}</span>
                    </div>
                  </div>
                </div>

                {/* Email Header */}
                <div className="bg-white p-4 border-b">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <Mail className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {customPreviewData.company_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customPreviewData.support_email}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {isRTL ? customPreviewData.current_date_ar : customPreviewData.current_date}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-2">
                    {isRTL ? 'إلى:' : 'To:'} {isRTL ? customPreviewData.customer_name_ar : customPreviewData.customer_name}
                    <span className="text-gray-500 ml-2">&lt;{customPreviewData.customer_email}&gt;</span>
                  </div>
                  
                  <h2 className={cn("text-lg font-semibold text-gray-800", isRTL && "text-right")} dir={isRTL ? 'rtl' : 'ltr'}>
                    {getSubject()}
                  </h2>
                </div>

                {/* Email Body */}
                <div className={cn("p-6", isRTL && "text-right")} dir={isRTL ? 'rtl' : 'ltr'}>
                  <div 
                    className={cn(
                      "prose max-w-none text-gray-800 leading-relaxed",
                      isRTL && "prose-rtl"
                    )}
                    style={{
                      fontFamily: isRTL 
                        ? "'Noto Sans Arabic', 'Arial Unicode MS', sans-serif" 
                        : "'Segoe UI', 'Helvetica Neue', sans-serif"
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: getContent()
                    }}
                  />
                </div>

                {/* Email Footer */}
                <div className="bg-gray-50 p-4 border-t text-center">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      {isRTL ? customPreviewData.company_name_ar : customPreviewData.company_name}
                    </div>
                    <div>
                      {isRTL ? customPreviewData.company_address_ar : customPreviewData.company_address}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customPreviewData.contact_phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customPreviewData.support_email}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 pt-2 border-t">
                      {isRTL 
                        ? 'تم إرسال هذا البريد الإلكتروني تلقائياً من نظام إدارة الفواتير'
                        : 'This email was sent automatically from the Invoice Management System'
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Web Preview */}
            {previewMode === 'web' && (
              <div className={cn("bg-white rounded-lg shadow-lg p-8", isRTL && "text-right")} dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-6">
                    {getSubject()}
                  </h1>
                  
                  <div 
                    className={cn(
                      "prose prose-lg max-w-none text-gray-800 leading-relaxed",
                      isRTL && "prose-rtl"
                    )}
                    style={{
                      fontFamily: isRTL 
                        ? "'Noto Sans Arabic', 'Arial Unicode MS', sans-serif" 
                        : "'Segoe UI', 'Helvetica Neue', sans-serif"
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: getContent()
                    }}
                  />
                </div>
              </div>
            )}

            {/* Print Preview */}
            {previewMode === 'print' && (
              <div className={cn("bg-white p-8 shadow-lg", isRTL && "text-right")} dir={isRTL ? 'rtl' : 'ltr'} style={{ width: '8.5in', minHeight: '11in', margin: '0 auto' }}>
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h1 className="text-xl font-bold">
                        {isRTL ? customPreviewData.company_name_ar : customPreviewData.company_name}
                      </h1>
                      <p className="text-sm text-gray-600">
                        TRN: {customPreviewData.company_trn}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{isRTL ? customPreviewData.current_date_ar : customPreviewData.current_date}</p>
                      <p>{customPreviewData.contact_phone}</p>
                    </div>
                  </div>

                  {/* Subject */}
                  <h2 className="text-lg font-semibold">
                    {getSubject()}
                  </h2>

                  {/* Content */}
                  <div 
                    className="prose max-w-none"
                    style={{
                      fontFamily: isRTL 
                        ? "'Noto Sans Arabic', 'Arial Unicode MS', sans-serif" 
                        : "'Segoe UI', 'Helvetica Neue', sans-serif"
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: getContent()
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Preview Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-7xl h-[95vh]">
          <DialogHeader>
            <DialogTitle>
              {t('fullscreenPreview')} - {template.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div 
              className={cn(
                "bg-white p-8",
                isRTL && "text-right"
              )}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">
                  {getSubject()}
                </h1>
                
                <Separator />
                
                <div 
                  className={cn(
                    "prose prose-lg max-w-none text-gray-800 leading-relaxed",
                    isRTL && "prose-rtl"
                  )}
                  style={{
                    fontFamily: isRTL 
                      ? "'Noto Sans Arabic', 'Arial Unicode MS', sans-serif" 
                      : "'Segoe UI', 'Helvetica Neue', sans-serif"
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: getContent()
                  }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}