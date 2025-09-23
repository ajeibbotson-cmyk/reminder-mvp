'use client'

/**
 * Consolidated Template Preview
 * Enhanced preview component specifically for consolidated email templates
 * Shows how templates render with multiple invoices and consolidation variables
 */

import { useState, useEffect } from 'react'
import {
  Eye,
  Send,
  Download,
  RefreshCw,
  Globe,
  FileText,
  Settings,
  Languages,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Edit,
  Code,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { consolidatedEmailService } from '@/lib/services/consolidated-email-service'
import { cn } from '@/lib/utils'

interface ConsolidatedTemplatePreviewProps {
  template: {
    id: string
    name: string
    description?: string
    templateType: string
    subjectEn: string
    subjectAr?: string
    contentEn: string
    contentAr?: string
    supportsConsolidation: boolean
    maxInvoiceCount: number
    variables: Record<string, any>
    consolidationVariables: Record<string, any>
  }
  onSendTest?: (email: string, language: 'en' | 'ar') => Promise<void>
  onEdit?: () => void
  className?: string
}

interface MockInvoiceData {
  id: string
  number: string
  amount: number
  currency: string
  dueDate: Date
  daysOverdue: number
  description: string
}

interface PreviewOptions {
  language: 'en' | 'ar'
  invoiceCount: number
  customerType: 'individual' | 'business'
  escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  includeCustomMessage: boolean
  customMessage: string
  deviceView: 'desktop' | 'tablet' | 'mobile'
}

export function ConsolidatedTemplatePreview({
  template,
  onSendTest,
  onEdit,
  className
}: ConsolidatedTemplatePreviewProps) {
  // Preview state
  const [previewOptions, setPreviewOptions] = useState<PreviewOptions>({
    language: 'en',
    invoiceCount: Math.min(3, template.maxInvoiceCount),
    customerType: 'business',
    escalationLevel: 'POLITE',
    includeCustomMessage: false,
    customMessage: '',
    deviceView: 'desktop'
  })

  // Preview data
  const [previewContent, setPreviewContent] = useState<{
    subject: string
    content: string
    variables: Record<string, any>
  } | null>(null)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVariables, setShowVariables] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  // Generate preview when options change
  useEffect(() => {
    generatePreview()
  }, [previewOptions, template])

  const generateMockInvoices = (count: number): MockInvoiceData[] => {
    const invoices: MockInvoiceData[] = []
    const baseDate = new Date()

    for (let i = 0; i < count; i++) {
      const daysOverdue = Math.floor(Math.random() * 90) + 1
      const dueDate = new Date(baseDate.getTime() - (daysOverdue * 24 * 60 * 60 * 1000))

      invoices.push({
        id: `mock-${i + 1}`,
        number: `INV-${String(1000 + i).padStart(4, '0')}`,
        amount: Math.floor(Math.random() * 5000) + 500,
        currency: 'AED',
        dueDate,
        daysOverdue,
        description: `Professional services ${i + 1}`
      })
    }

    return invoices.sort((a, b) => a.daysOverdue - b.daysOverdue)
  }

  const generateMockVariables = (): Record<string, any> => {
    const invoices = generateMockInvoices(previewOptions.invoiceCount)
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
    const oldestInvoiceDays = Math.max(...invoices.map(inv => inv.daysOverdue))
    const averageDaysOverdue = Math.round(
      invoices.reduce((sum, inv) => sum + inv.daysOverdue, 0) / invoices.length
    )

    const isArabic = previewOptions.language === 'ar'

    return {
      // Customer variables
      customerName: previewOptions.customerType === 'business' ? 'Ahmed Al-Rashid' : 'Fatima Al-Zahra',
      customerNameAr: previewOptions.customerType === 'business' ? 'أحمد الراشد' : 'فاطمة الزهراء',
      businessName: previewOptions.customerType === 'business' ? 'Al-Rashid Trading LLC' : '',
      businessNameAr: previewOptions.customerType === 'business' ? 'شركة الراشد التجارية ذ.م.م' : '',
      contactPerson: previewOptions.customerType === 'business' ? 'Ahmed Al-Rashid' : '',

      // Company variables
      companyName: 'Reminder Tech Solutions',
      companyEmail: 'billing@reminder.com',
      companyPhone: '+971 4 123 4567',
      companyAddress: 'Dubai Internet City, Dubai, UAE',

      // Consolidated invoice variables
      invoiceCount: invoices.length,
      totalAmount: this.formatCurrency(totalAmount),
      currency: 'AED',
      oldestInvoiceDays,
      invoiceList: invoices.map(inv => ({
        number: inv.number,
        amount: this.formatCurrency(inv.amount),
        dueDate: this.formatDate(inv.dueDate, previewOptions.language),
        daysOverdue: inv.daysOverdue,
        description: inv.description
      })),

      // Summary variables
      totalOverdueAmount: this.formatCurrency(totalAmount),
      averageDaysOverdue,
      earliestDueDate: this.formatDate(new Date(Math.min(...invoices.map(inv => inv.dueDate.getTime()))), previewOptions.language),
      latestDueDate: this.formatDate(new Date(Math.max(...invoices.map(inv => inv.dueDate.getTime()))), previewOptions.language),

      // Cultural variables
      currentDate: this.formatDate(new Date(), previewOptions.language),
      currentDateAr: isArabic ? this.formatDate(new Date(), 'ar') : undefined,
      islamicDate: this.formatIslamicDate(new Date()),
      greeting: this.getCulturalGreeting(previewOptions.language, new Date()),
      culturalSalutation: this.getCulturalSalutation(previewOptions.language),

      // Action variables
      paymentLink: 'https://pay.reminder.com/consolidated/abc123',
      contactEmail: 'billing@reminder.com',
      contactPhone: '+971 4 123 4567',
      nextFollowUpDate: this.formatDate(
        new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
        previewOptions.language
      ),

      // Custom message
      customMessage: previewOptions.includeCustomMessage ? previewOptions.customMessage : ''
    }
  }

  const generatePreview = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Generate mock variables
      const variables = generateMockVariables()

      // Process template with variables
      const subject = previewOptions.language === 'ar' && template.subjectAr
        ? template.subjectAr
        : template.subjectEn

      const content = previewOptions.language === 'ar' && template.contentAr
        ? template.contentAr
        : template.contentEn

      const processedSubject = this.replaceTemplateVariables(subject, variables)
      const processedContent = this.replaceTemplateVariables(content, variables)

      setPreviewContent({
        subject: processedSubject,
        content: processedContent,
        variables
      })

    } catch (error) {
      console.error('Failed to generate preview:', error)
      setError('Failed to generate template preview')
    } finally {
      setIsLoading(false)
    }
  }

  const replaceTemplateVariables = (template: string, variables: Record<string, any>): string => {
    let processed = template

    // Replace all variables in the format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processed = processed.replace(regex, String(value || ''))
    })

    // Handle invoice list template
    if (template.includes('{{#invoiceList}}') && template.includes('{{/invoiceList}}')) {
      const listRegex = /{{#invoiceList}}(.*?){{\/invoiceList}}/gs
      const listMatch = template.match(listRegex)

      if (listMatch && variables.invoiceList) {
        const listTemplate = listMatch[0].replace('{{#invoiceList}}', '').replace('{{/invoiceList}}', '')
        const listItems = variables.invoiceList.map((invoice: any) => {
          let item = listTemplate
          Object.entries(invoice).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
            item = item.replace(regex, String(value || ''))
          })
          return item
        })
        processed = processed.replace(listRegex, listItems.join('\n'))
      }
    }

    return processed
  }

  const formatCurrency = (amount: number, currency: string = 'AED'): string => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (date: Date, language: string = 'en'): string => {
    const locale = language === 'ar' ? 'ar-AE' : 'en-AE'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  const formatIslamicDate = (date: Date): string => {
    // Placeholder for Islamic date formatting
    return this.formatDate(date, 'ar')
  }

  const getCulturalGreeting = (language: string, date: Date): string => {
    const hour = date.getHours()

    if (language === 'ar') {
      if (hour < 12) return 'صباح الخير'
      if (hour < 17) return 'مساء الخير'
      return 'مساء الخير'
    }

    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const getCulturalSalutation = (language: string): string => {
    return language === 'ar'
      ? 'مع أطيب التحيات'
      : 'Best regards'
  }

  const handleSendTest = async () => {
    if (!onSendTest || !testEmail.trim()) return

    try {
      setIsLoading(true)
      await onSendTest(testEmail, previewOptions.language)
      setShowTestDialog(false)
      setTestEmail('')
    } catch (error) {
      setError('Failed to send test email')
    } finally {
      setIsLoading(false)
    }
  }

  const getDeviceWidth = () => {
    switch (previewOptions.deviceView) {
      case 'mobile': return '375px'
      case 'tablet': return '768px'
      default: return '100%'
    }
  }

  const getDeviceIcon = () => {
    switch (previewOptions.deviceView) {
      case 'mobile': return <Smartphone className="h-4 w-4" />
      case 'tablet': return <Tablet className="h-4 w-4" />
      default: return <Monitor className="h-4 w-4" />
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Consolidated Template Preview
          </h3>
          <p className="text-sm text-gray-600">{template.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVariables(true)}>
            <Code className="h-4 w-4 mr-2" />
            Variables
          </Button>

          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {onSendTest && (
            <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Test
            </Button>
          )}
        </div>
      </div>

      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-gray-600">Type</Label>
              <p className="font-medium">{template.templateType}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Max Invoices</Label>
              <p className="font-medium">{template.maxInvoiceCount}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Languages</Label>
              <div className="flex items-center gap-1">
                <Badge variant="outline">EN</Badge>
                {template.subjectAr && template.contentAr && (
                  <Badge variant="outline">AR</Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Consolidation</Label>
              <Badge variant={template.supportsConsolidation ? "default" : "secondary"}>
                {template.supportsConsolidation ? "Supported" : "Individual Only"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Preview Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={previewOptions.language}
                onValueChange={(value: 'en' | 'ar') =>
                  setPreviewOptions(prev => ({ ...prev, language: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  {template.subjectAr && template.contentAr && (
                    <SelectItem value="ar">العربية</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="invoice-count">Invoice Count</Label>
              <Select
                value={previewOptions.invoiceCount.toString()}
                onValueChange={(value) =>
                  setPreviewOptions(prev => ({ ...prev, invoiceCount: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: template.maxInvoiceCount }, (_, i) => i + 2).map(count => (
                    <SelectItem key={count} value={count.toString()}>
                      {count} invoices
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="customer-type">Customer Type</Label>
              <Select
                value={previewOptions.customerType}
                onValueChange={(value: 'individual' | 'business') =>
                  setPreviewOptions(prev => ({ ...prev, customerType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="device-view">Device View</Label>
              <Select
                value={previewOptions.deviceView}
                onValueChange={(value: 'desktop' | 'tablet' | 'mobile') =>
                  setPreviewOptions(prev => ({ ...prev, deviceView: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Desktop
                    </div>
                  </SelectItem>
                  <SelectItem value="tablet">
                    <div className="flex items-center gap-2">
                      <Tablet className="h-4 w-4" />
                      Tablet
                    </div>
                  </SelectItem>
                  <SelectItem value="mobile">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Mobile
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Content */}
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="subject" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Subject
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Raw HTML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Email Preview</CardTitle>
                <div className="flex items-center gap-2">
                  {getDeviceIcon()}
                  <span className="text-sm text-gray-600">
                    {previewOptions.deviceView.charAt(0).toUpperCase() + previewOptions.deviceView.slice(1)} View
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Generating preview...
                </div>
              ) : previewContent ? (
                <div
                  className="mx-auto border rounded-lg overflow-hidden"
                  style={{ maxWidth: getDeviceWidth() }}
                >
                  {/* Email Header */}
                  <div className="bg-gray-100 p-4 border-b">
                    <div className="text-sm">
                      <strong>Subject:</strong> {previewContent.subject}
                    </div>
                  </div>

                  {/* Email Content */}
                  <div
                    className="p-4 bg-white overflow-auto max-h-96"
                    style={{
                      direction: previewOptions.language === 'ar' ? 'rtl' : 'ltr',
                      fontFamily: previewOptions.language === 'ar' ? 'Arial, sans-serif' : 'inherit'
                    }}
                    dangerouslySetInnerHTML={{ __html: previewContent.content }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No preview available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subject">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject Line</CardTitle>
            </CardHeader>
            <CardContent>
              {previewContent ? (
                <div className="p-4 bg-gray-50 rounded border font-mono text-sm">
                  {previewContent.subject}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No preview available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw HTML Content</CardTitle>
            </CardHeader>
            <CardContent>
              {previewContent ? (
                <pre className="p-4 bg-gray-50 rounded border text-xs overflow-auto max-h-96">
                  {previewContent.content}
                </pre>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No preview available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Variables Dialog */}
      <Dialog open={showVariables} onOpenChange={setShowVariables}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Template Variables</DialogTitle>
            <DialogDescription>
              Available variables for this consolidation template
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewContent?.variables && (
              <div className="space-y-4">
                {Object.entries(previewContent.variables).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded">
                    <div className="font-mono text-sm">{'{{' + key + '}}'}</div>
                    <div className="text-sm">{typeof value}</div>
                    <div className="text-sm truncate">{String(value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email to see how the template looks in practice
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendTest} disabled={!testEmail.trim() || isLoading}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}