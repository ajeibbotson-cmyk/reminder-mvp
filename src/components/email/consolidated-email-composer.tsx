'use client'

/**
 * Consolidated Email Composer
 * Interface for composing and sending consolidated emails for multiple invoices
 * Supports template selection, preview, PDF attachments, and scheduling
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Mail,
  Send,
  Eye,
  Paperclip,
  Calendar,
  Users,
  FileText,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Download,
  ChevronDown,
  X,
  Plus,
  Edit,
  Languages
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { consolidatedEmailService } from '@/lib/services/consolidated-email-service'
import { pdfAttachmentService } from '@/lib/services/pdf-attachment-service'
import { cn } from '@/lib/utils'

interface ConsolidatedEmailComposerProps {
  customerId: string
  invoiceIds: string[]
  onClose: () => void
  onSent?: (consolidationId: string) => void
}

interface InvoicePreview {
  id: string
  number: string
  amount: number
  currency: string
  dueDate: Date
  daysOverdue: number
  description?: string
}

interface TemplateOption {
  id: string
  name: string
  description?: string
  templateType: string
  supportsConsolidation: boolean
  maxInvoiceCount: number
  language: 'en' | 'ar' | 'both'
}

interface EmailPreview {
  subject: string
  content: string
  variables: Record<string, any>
}

export function ConsolidatedEmailComposer({
  customerId,
  invoiceIds,
  onClose,
  onSent
}: ConsolidatedEmailComposerProps) {
  const { data: session } = useSession()

  // State management
  const [step, setStep] = useState<'compose' | 'preview' | 'schedule' | 'sending'>('compose')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [customMessage, setCustomMessage] = useState('')
  const [includePdfAttachments, setIncludePdfAttachments] = useState(true)
  const [includeIndividualInvoices, setIncludeIndividualInvoices] = useState(false)
  const [includeSummaryPdf, setIncludeSummaryPdf] = useState(true)
  const [scheduleOption, setScheduleOption] = useState<'now' | 'schedule'>('now')
  const [scheduledFor, setScheduledFor] = useState<Date>(new Date())
  const [escalationLevel, setEscalationLevel] = useState<'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'>('POLITE')

  // Data states
  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<InvoicePreview[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<any[]>([])

  // UI states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingProgress, setSendingProgress] = useState(0)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  // Load initial data
  useEffect(() => {
    loadComposerData()
  }, [customerId, invoiceIds])

  // Generate preview when template or language changes
  useEffect(() => {
    if (selectedTemplateId && invoiceIds.length > 0) {
      generateEmailPreview()
    }
  }, [selectedTemplateId, language, customMessage])

  const loadComposerData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load customer data
      const customerResponse = await fetch(`/api/customers/${customerId}`)
      if (!customerResponse.ok) throw new Error('Failed to load customer')
      const customerData = await customerResponse.json()
      setCustomer(customerData)

      // Load invoice data
      const invoicesResponse = await fetch(`/api/invoices?ids=${invoiceIds.join(',')}`)
      if (!invoicesResponse.ok) throw new Error('Failed to load invoices')
      const invoicesData = await invoicesResponse.json()

      const invoicePreview = invoicesData.map((inv: any) => ({
        id: inv.id,
        number: inv.number,
        amount: Number(inv.totalAmount || inv.amount),
        currency: inv.currency || 'AED',
        dueDate: new Date(inv.dueDate),
        daysOverdue: Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        description: inv.description
      }))
      setInvoices(invoicePreview)

      // Load consolidation templates
      const templatesResponse = await fetch(`/api/email/templates?supportsConsolidation=true&companyId=${session?.user?.companyId}`)
      if (!templatesResponse.ok) throw new Error('Failed to load templates')
      const templatesData = await templatesResponse.json()

      const templateOptions = templatesData.templates.map((template: any) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        templateType: template.templateType,
        supportsConsolidation: template.supportsConsolidation,
        maxInvoiceCount: template.maxInvoiceCount,
        language: template.subjectAr && template.contentAr ? 'both' : 'en'
      }))
      setTemplates(templateOptions)

      // Auto-select first suitable template
      const suitableTemplate = templateOptions.find((t: TemplateOption) =>
        t.supportsConsolidation && t.maxInvoiceCount >= invoiceIds.length
      )
      if (suitableTemplate) {
        setSelectedTemplateId(suitableTemplate.id)
      }

    } catch (error) {
      console.error('Failed to load composer data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const generateEmailPreview = async () => {
    if (!selectedTemplateId || invoiceIds.length === 0) return

    try {
      setIsLoading(true)
      const preview = await consolidatedEmailService.previewConsolidatedEmail(
        customerId,
        invoiceIds,
        selectedTemplateId,
        language
      )
      setEmailPreview(preview)
    } catch (error) {
      console.error('Failed to generate preview:', error)
      setError('Failed to generate email preview')
    } finally {
      setIsLoading(false)
    }
  }

  const generateAttachmentPreview = async () => {
    if (!includePdfAttachments) {
      setAttachmentPreview([])
      return
    }

    try {
      setIsLoading(true)
      const attachments = await pdfAttachmentService.generateConsolidatedPDFAttachments(
        invoiceIds,
        {
          includeIndividualInvoices,
          includeSummaryPDF: includeSummaryPdf,
          companyId: session?.user?.companyId || '',
          language
        }
      )
      setAttachmentPreview(attachments)
    } catch (error) {
      console.error('Failed to generate attachment preview:', error)
      setError('Failed to generate PDF attachments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendEmail = async () => {
    try {
      setStep('sending')
      setSendingProgress(0)
      setError(null)

      // Validate inputs
      if (!selectedTemplateId) {
        throw new Error('Please select an email template')
      }

      if (invoiceIds.length === 0) {
        throw new Error('No invoices selected')
      }

      setSendingProgress(25)

      // Create consolidated email
      const emailRequest = {
        customerId,
        invoiceIds,
        templateId: selectedTemplateId,
        escalationLevel,
        scheduledFor: scheduleOption === 'schedule' ? scheduledFor : undefined,
        language,
        includePdfAttachments,
        customMessage: customMessage.trim() || undefined
      }

      setSendingProgress(50)

      const result = await consolidatedEmailService.createConsolidatedEmail(emailRequest)

      setSendingProgress(75)

      // Generate and attach PDFs if requested
      if (includePdfAttachments) {
        await generateAttachmentPreview()
      }

      setSendingProgress(100)

      // Success
      setTimeout(() => {
        onSent?.(result.consolidationId)
        onClose()
      }, 1000)

    } catch (error) {
      console.error('Failed to send email:', error)
      setError(error instanceof Error ? error.message : 'Failed to send email')
      setStep('compose')
      setSendingProgress(0)
    }
  }

  const calculateTotalAmount = () => {
    return invoices.reduce((sum, inv) => sum + inv.amount, 0)
  }

  const formatCurrency = (amount: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  if (isLoading && !customer) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading composer...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Consolidated Email Composer
          </h2>
          <p className="text-gray-600">
            Send payment reminder for {invoiceIds.length} invoices to {customer?.name}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4">
        {[
          { key: 'compose', label: 'Compose', icon: Edit },
          { key: 'preview', label: 'Preview', icon: Eye },
          { key: 'schedule', label: 'Schedule', icon: Calendar },
          { key: 'sending', label: 'Sending', icon: Send }
        ].map((stepItem, index) => {
          const Icon = stepItem.icon
          const isActive = step === stepItem.key
          const isCompleted = ['compose', 'preview', 'schedule'].indexOf(step) > index

          return (
            <div key={stepItem.key} className="flex items-center">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border-2",
                isActive ? "border-blue-500 bg-blue-500 text-white" :
                isCompleted ? "border-green-500 bg-green-500 text-white" :
                "border-gray-300 text-gray-500"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={cn(
                "ml-2 text-sm font-medium",
                isActive ? "text-blue-600" :
                isCompleted ? "text-green-600" :
                "text-gray-500"
              )}>
                {stepItem.label}
              </span>
              {index < 3 && <div className="w-8 h-px bg-gray-300 mx-4" />}
            </div>
          )
        })}
      </div>

      {/* Invoice Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Summary
          </CardTitle>
          <CardDescription>
            {invoices.length} overdue invoices totaling {formatCurrency(calculateTotalAmount())}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invoices.slice(0, 3).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{invoice.number}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    {invoice.daysOverdue} days overdue
                  </span>
                </div>
                <span className="font-medium">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </span>
              </div>
            ))}
            {invoices.length > 3 && (
              <p className="text-sm text-gray-600 text-center">
                ... and {invoices.length - 3} more invoices
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={step} onValueChange={(value: any) => setStep(value)}>
        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Email Template</CardTitle>
                <CardDescription>
                  Choose a consolidation-enabled template for your email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="ml-2">
                            Max {template.maxInvoiceCount}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="language">Language:</Label>
                  <Select value={language} onValueChange={(value: 'en' | 'ar') => setLanguage(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="escalation">Escalation Level:</Label>
                  <Select value={escalationLevel} onValueChange={(value: any) => setEscalationLevel(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POLITE">Polite Reminder</SelectItem>
                      <SelectItem value="FIRM">Firm Notice</SelectItem>
                      <SelectItem value="URGENT">Urgent Notice</SelectItem>
                      <SelectItem value="FINAL">Final Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-message">Custom Message (Optional)</Label>
                  <Textarea
                    id="custom-message"
                    placeholder="Add a personal message to include in the email..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* PDF Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  PDF Attachments
                </CardTitle>
                <CardDescription>
                  Configure PDF attachments for the email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-pdf"
                    checked={includePdfAttachments}
                    onCheckedChange={setIncludePdfAttachments}
                  />
                  <Label htmlFor="include-pdf">Include PDF attachments</Label>
                </div>

                {includePdfAttachments && (
                  <div className="space-y-3 ml-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="individual-invoices"
                        checked={includeIndividualInvoices}
                        onCheckedChange={(checked) => setIncludeIndividualInvoices(!!checked)}
                      />
                      <Label htmlFor="individual-invoices">Individual invoice PDFs</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="summary-pdf"
                        checked={includeSummaryPdf}
                        onCheckedChange={(checked) => setIncludeSummaryPdf(!!checked)}
                      />
                      <Label htmlFor="summary-pdf">Consolidated summary PDF</Label>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateAttachmentPreview}
                      disabled={isLoading}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Attachments
                    </Button>

                    {attachmentPreview.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm font-medium mb-2">
                          {attachmentPreview.length} attachment(s) ready
                        </p>
                        {attachmentPreview.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{attachment.filename}</span>
                            <span className="text-gray-500">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep('preview')} disabled={!selectedTemplateId}>
              <Eye className="h-4 w-4 mr-2" />
              Preview Email
            </Button>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          {emailPreview ? (
            <Card>
              <CardHeader>
                <CardTitle>Email Preview</CardTitle>
                <CardDescription>
                  Preview how the email will appear to the customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Subject:</Label>
                    <div className="p-3 bg-gray-50 rounded mt-1">
                      {emailPreview.subject}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Content:</Label>
                    <div
                      className="p-4 bg-white border rounded mt-1 max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: emailPreview.content }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Generating preview...
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('compose')}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button onClick={() => setStep('schedule')}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule & Send
            </Button>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Delivery</CardTitle>
              <CardDescription>
                Choose when to send the consolidated email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="send-now"
                    name="schedule"
                    checked={scheduleOption === 'now'}
                    onChange={() => setScheduleOption('now')}
                  />
                  <Label htmlFor="send-now">Send immediately</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="send-later"
                    name="schedule"
                    checked={scheduleOption === 'schedule'}
                    onChange={() => setScheduleOption('schedule')}
                  />
                  <Label htmlFor="send-later">Schedule for later</Label>
                </div>

                {scheduleOption === 'schedule' && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="scheduled-date">Delivery Date & Time:</Label>
                    <Input
                      id="scheduled-date"
                      type="datetime-local"
                      value={scheduledFor.toISOString().slice(0, 16)}
                      onChange={(e) => setScheduledFor(new Date(e.target.value))}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <p className="text-xs text-gray-600">
                      Will be adjusted for UAE business hours if needed
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('preview')}>
              <Eye className="h-4 w-4 mr-2" />
              Back to Preview
            </Button>
            <Button onClick={handleSendEmail} className="bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4 mr-2" />
              Send Consolidated Email
            </Button>
          </div>
        </TabsContent>

        {/* Sending Tab */}
        <TabsContent value="sending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Sending Email...
              </CardTitle>
              <CardDescription>
                Processing your consolidated email request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={sendingProgress} className="w-full" />
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    {sendingProgress < 25 && "Preparing email..."}
                    {sendingProgress >= 25 && sendingProgress < 50 && "Creating consolidation..."}
                    {sendingProgress >= 50 && sendingProgress < 75 && "Processing template..."}
                    {sendingProgress >= 75 && sendingProgress < 100 && "Generating attachments..."}
                    {sendingProgress === 100 && "Email sent successfully!"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}