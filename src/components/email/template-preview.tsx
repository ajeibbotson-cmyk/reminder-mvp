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
  Check
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AEDAmount } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface TemplatePreviewProps {
  template: {
    id: string
    name: string
    templateType: string
    subjectEn: string
    subjectAr: string
    contentEn: string
    contentAr: string
    isActive: boolean
    variables?: Record<string, any>
  }
  previewData?: Record<string, any>
  onSendTest?: (email: string, language: 'en' | 'ar') => Promise<void>
  onExport?: (format: 'html' | 'pdf') => void
  locale?: string
  className?: string
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop'

const DEFAULT_PREVIEW_DATA = {
  customerName: 'شركة الإمارات للتجارة',
  customerNameEn: 'Emirates Trading Company',
  invoiceNumber: 'INV-2025-001',
  invoiceAmount: 'AED 1,250.00',
  invoiceAmountAr: '1,250.00 د.إ',
  companyName: 'شركة الفواتير الذكية',
  companyNameEn: 'Smart Invoice Solutions',
  dueDate: '15 يناير 2025',
  dueDateEn: 'January 15, 2025',
  daysPastDue: '5',
  currentDate: '20 يناير 2025',
  currentDateEn: 'January 20, 2025',
  totalOutstanding: 'AED 5,750.00',
  totalOutstandingAr: '5,750.00 د.إ',
  paymentLink: 'https://pay.yourcompany.com/invoice/123',
  invoiceLink: 'https://yourcompany.com/invoice/123',
  supportEmail: 'support@yourcompany.com',
  supportPhone: '+971 4 123 4567'
}

export function TemplatePreview({
  template,
  previewData = DEFAULT_PREVIEW_DATA,
  onSendTest,
  onExport,
  locale = 'en',
  className
}: TemplatePreviewProps) {
  const t = useTranslations('templatePreview')
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>('en')
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [copied, setCopied] = useState(false)

  const processContent = (content: string, language: 'en' | 'ar') => {
    let processed = content

    // Replace template variables
    Object.entries(previewData).forEach(([key, value]) => {
      const variable = `{{${key}}}`
      processed = processed.replace(new RegExp(variable, 'g'), String(value))
    })

    // Convert line breaks to HTML
    processed = processed.replace(/\n/g, '<br />')

    return processed
  }

  const getSubject = () => {
    return selectedLanguage === 'ar' ? template.subjectAr : template.subjectEn
  }

  const getContent = () => {
    const content = selectedLanguage === 'ar' ? template.contentAr : template.contentEn
    return processContent(content, selectedLanguage)
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
    const fullContent = `Subject: ${getSubject()}\n\n${getContent().replace(/<br\s*\/?>/g, '\n')}`
    
    try {
      await navigator.clipboard.writeText(fullContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
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
                {template.name} • {t(`templateType.${template.templateType}`)}
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
          <div className="flex flex-wrap items-center justify-between gap-4">
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
                <Select onValueChange={(format: 'html' | 'pdf') => onExport(format)}>
                  <SelectTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      {t('export')}
                    </Button>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">{t('exportHtml')}</SelectItem>
                    <SelectItem value="pdf">{t('exportPdf')}</SelectItem>
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
                      <Textarea
                        placeholder={t('enterTestEmail')}
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                      
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
        </CardContent>
      </Card>

      {/* Preview Content */}
      <Card>
        <CardContent className="p-0">
          <div className={cn("bg-gray-50 p-4", getViewportClass())}>
            <div 
              className={cn(
                "bg-white rounded-lg shadow-lg overflow-hidden",
                isRTL && "text-right"
              )}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Email Header */}
              <div className="bg-gray-100 p-4 border-b">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600">
                      {isRTL ? 'إلى:' : 'To:'} {previewData.customerName || previewData.customerNameEn}
                    </div>
                    <div className="text-sm text-gray-500">customer@example.com</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {isRTL ? previewData.currentDate : previewData.currentDateEn}
                  </div>
                </div>
                
                <h2 className="text-lg font-semibold text-gray-800">
                  {processContent(getSubject(), selectedLanguage)}
                </h2>
              </div>

              {/* Email Body */}
              <div className="p-6">
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
                <div className="text-xs text-gray-500">
                  {isRTL ? (
                    <>
                      {previewData.companyName} | {previewData.supportEmail} | {previewData.supportPhone}
                    </>
                  ) : (
                    <>
                      {previewData.companyNameEn} | {previewData.supportEmail} | {previewData.supportPhone}
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {isRTL 
                    ? 'تم إرسال هذا البريد الإلكتروني تلقائياً من نظام إدارة الفواتير'
                    : 'This email was sent automatically from the Invoice Management System'
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Preview Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-6xl h-[90vh]">
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
              <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">
                  {processContent(getSubject(), selectedLanguage)}
                </h1>
                
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}