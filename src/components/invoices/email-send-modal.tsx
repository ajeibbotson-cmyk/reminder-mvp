'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Send,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  Languages,
  Template,
  User,
  Calendar,
  DollarSign,
  FileText,
  History,
  X,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const emailFormSchema = z.object({
  templateId: z.string().optional(),
  recipientEmail: z.string().email('Invalid email address'),
  recipientName: z.string().optional(),
  subject: z.string().min(1, 'Subject is required').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  language: z.enum(['ENGLISH', 'ARABIC']).default('ENGLISH'),
  scheduleForBusinessHours: z.boolean().default(true),
  sendImmediately: z.boolean().default(false)
})

type EmailFormData = z.infer<typeof emailFormSchema>

interface EmailSendModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  invoiceNumber: string
  defaultRecipientEmail?: string
  defaultRecipientName?: string
  onEmailSent?: (emailLogId: string) => void
}

interface EmailTemplate {
  id: string
  name: string
  description?: string
  templateType: string
  subjectEn: string
  subjectAr?: string
  isDefault: boolean
  uaeBusinessHoursOnly: boolean
}

interface EmailHistory {
  id: string
  subject: string
  recipientEmail: string
  deliveryStatus: string
  language: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  template?: {
    id: string
    name: string
    templateType: string
  }
}

interface InvoiceData {
  id: string
  number: string
  amount: number
  currency: string
  status: string
  dueDate: string
  customerName: string
  customerEmail: string
  daysPastDue: number
}

export function EmailSendModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  defaultRecipientEmail,
  defaultRecipientName,
  onEmailSent
}: EmailSendModalProps) {
  const t = useTranslations('emailSend')
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([])
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [suggestedTemplate, setSuggestedTemplate] = useState<EmailTemplate | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [restrictions, setRestrictions] = useState({
    isEmailSuppressed: false,
    suppressionReason: '',
    canSendEmail: true
  })
  const [activeTab, setActiveTab] = useState('compose')

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      recipientEmail: defaultRecipientEmail || '',
      recipientName: defaultRecipientName || '',
      language: 'ENGLISH',
      scheduleForBusinessHours: true,
      sendImmediately: false
    }
  })

  const { watch, setValue, reset } = form
  const selectedTemplateId = watch('templateId')
  const selectedLanguage = watch('language')
  const recipientEmail = watch('recipientEmail')

  // Load email options when modal opens
  useEffect(() => {
    if (isOpen && invoiceId) {
      loadEmailOptions()
    }
  }, [isOpen, invoiceId])

  // Update form when default recipient changes
  useEffect(() => {
    if (defaultRecipientEmail) {
      setValue('recipientEmail', defaultRecipientEmail)
    }
    if (defaultRecipientName) {
      setValue('recipientName', defaultRecipientName)
    }
  }, [defaultRecipientEmail, defaultRecipientName, setValue])

  // Generate preview when template or language changes
  useEffect(() => {
    if (selectedTemplateId) {
      generatePreview()
    }
  }, [selectedTemplateId, selectedLanguage])

  const loadEmailOptions = async () => {
    setLoadingOptions(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send-email`)
      if (!response.ok) {
        throw new Error('Failed to load email options')
      }

      const result = await response.json()
      const { invoice, templates, suggestedTemplate, emailHistory, restrictions } = result.data

      setInvoice(invoice)
      setTemplates(templates)
      setSuggestedTemplate(suggestedTemplate)
      setEmailHistory(emailHistory)
      setRestrictions(restrictions)

      // Set default recipient from invoice if not provided
      if (!defaultRecipientEmail && invoice.customerEmail) {
        setValue('recipientEmail', invoice.customerEmail)
      }
      if (!defaultRecipientName && invoice.customerName) {
        setValue('recipientName', invoice.customerName)
      }

      // Auto-select suggested template
      if (suggestedTemplate) {
        setValue('templateId', suggestedTemplate.id)
      }

    } catch (error) {
      console.error('Failed to load email options:', error)
      toast.error('Failed to load email options')
    } finally {
      setLoadingOptions(false)
    }
  }

  const generatePreview = async () => {
    const template = templates.find(t => t.id === selectedTemplateId)
    if (!template || !invoice) return

    try {
      const subject = selectedLanguage === 'ARABIC' ?
        (template.subjectAr || template.subjectEn) :
        template.subjectEn

      // For preview, we'll use sample data since we don't have content in template list
      const sampleData = {
        invoiceNumber: invoice.number,
        invoiceAmount: `${invoice.currency} ${invoice.amount.toLocaleString()}`,
        customerName: invoice.customerName,
        companyName: 'Your Company',
        dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        daysPastDue: invoice.daysPastDue.toString(),
        currentDate: new Date().toLocaleDateString()
      }

      // Simple variable replacement for preview
      let processedSubject = subject
      let processedContent = `Dear {{customerName}},\n\nThis is regarding invoice {{invoiceNumber}} for {{invoiceAmount}} which was due on {{dueDate}}.`

      if (invoice.daysPastDue > 0) {
        processedContent += `\n\nThis invoice is now {{daysPastDue}} days overdue.`
      }

      processedContent += `\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\n{{companyName}}`

      Object.entries(sampleData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        processedSubject = processedSubject.replace(regex, value)
        processedContent = processedContent.replace(regex, value)
      })

      setPreviewSubject(processedSubject)
      setPreviewContent(processedContent)

    } catch (error) {
      console.error('Failed to generate preview:', error)
    }
  }

  const handleSendEmail = async (data: EmailFormData) => {
    if (!restrictions.canSendEmail) {
      toast.error('Cannot send email to this recipient')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email')
      }

      toast.success('Email sent successfully!')

      if (onEmailSent) {
        onEmailSent(result.data.emailLogId)
      }

      reset()
      onClose()

    } catch (error) {
      console.error('Failed to send email:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      QUEUED: { variant: 'secondary', icon: Clock },
      SENT: { variant: 'default', icon: Send },
      DELIVERED: { variant: 'default', icon: CheckCircle },
      OPENED: { variant: 'secondary', icon: Eye },
      CLICKED: { variant: 'secondary', icon: Eye },
      BOUNCED: { variant: 'destructive', icon: AlertCircle },
      FAILED: { variant: 'destructive', icon: X },
      COMPLAINED: { variant: 'destructive', icon: AlertCircle }
    } as const

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: 'secondary' as const,
      icon: Mail
    }

    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Invoice Email - {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            Send an email for this invoice using a template or custom content
          </DialogDescription>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading email options...
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="compose">Compose</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="history">History ({emailHistory.length})</TabsTrigger>
            </TabsList>

            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              <TabsContent value="compose" className="space-y-4">
                {restrictions.isEmailSuppressed && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Cannot send email: {restrictions.suppressionReason}
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={form.handleSubmit(handleSendEmail)} className="space-y-4">
                  {/* Recipient Information */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Recipient</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="recipientEmail">Email Address *</Label>
                          <Input
                            id="recipientEmail"
                            {...form.register('recipientEmail')}
                            className={cn(
                              form.formState.errors.recipientEmail && 'border-red-500'
                            )}
                          />
                          {form.formState.errors.recipientEmail && (
                            <p className="text-sm text-red-500 mt-1">
                              {form.formState.errors.recipientEmail.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="recipientName">Name</Label>
                          <Input
                            id="recipientName"
                            {...form.register('recipientName')}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Template Selection */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Template className="h-4 w-4" />
                        Template & Language
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="template">Email Template</Label>
                          <Select
                            value={selectedTemplateId || ''}
                            onValueChange={(value) => setValue('templateId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  <div className="flex items-center gap-2">
                                    {template.name}
                                    {template.isDefault && (
                                      <Badge variant="secondary" className="text-xs">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="language">Language</Label>
                          <Select
                            value={selectedLanguage}
                            onValueChange={(value) => setValue('language', value as any)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ENGLISH">
                                <div className="flex items-center gap-2">
                                  <Languages className="h-4 w-4" />
                                  English
                                </div>
                              </SelectItem>
                              <SelectItem value="ARABIC">
                                <div className="flex items-center gap-2">
                                  <Languages className="h-4 w-4" />
                                  العربية (Arabic)
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {suggestedTemplate && selectedTemplateId === suggestedTemplate.id && (
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            This template is recommended for {invoice?.status.toLowerCase()} invoices.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Custom Content (optional) */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Custom Content (Optional)</CardTitle>
                      <CardDescription>
                        Override template content with custom subject and message
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          {...form.register('subject')}
                          placeholder="Leave empty to use template subject"
                        />
                      </div>
                      <div>
                        <Label htmlFor="content">Message</Label>
                        <Textarea
                          id="content"
                          {...form.register('content')}
                          rows={4}
                          placeholder="Leave empty to use template content"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sending Options */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Sending Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="scheduleForBusinessHours">Schedule for Business Hours</Label>
                          <p className="text-xs text-muted-foreground">
                            Send during UAE business hours (Sun-Thu, 9 AM - 6 PM)
                          </p>
                        </div>
                        <Switch
                          id="scheduleForBusinessHours"
                          checked={watch('scheduleForBusinessHours')}
                          onCheckedChange={(value) => setValue('scheduleForBusinessHours', value)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="sendImmediately">Send Immediately</Label>
                          <p className="text-xs text-muted-foreground">
                            Bypass business hours scheduling
                          </p>
                        </div>
                        <Switch
                          id="sendImmediately"
                          checked={watch('sendImmediately')}
                          onCheckedChange={(value) => setValue('sendImmediately', value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </form>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                {selectedTemplateId ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Email Preview</CardTitle>
                      <CardDescription>
                        Preview how the email will appear to the recipient
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
                        <div className="mt-1 p-2 bg-muted rounded text-sm">
                          {previewSubject || 'Loading preview...'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Content</Label>
                        <div className="mt-1 p-4 bg-muted rounded text-sm whitespace-pre-wrap">
                          {previewContent || 'Loading preview...'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Template className="h-8 w-8 mx-auto mb-2" />
                    <p>Select a template to see preview</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {emailHistory.length > 0 ? (
                  <div className="space-y-3">
                    {emailHistory.map((email) => (
                      <Card key={email.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium text-sm">{email.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                To: {email.recipientEmail}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {email.sentAt ?
                                  new Date(email.sentAt).toLocaleString() :
                                  'Not sent yet'
                                }
                                <Badge variant="outline" className="text-xs">
                                  {email.language}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getStatusBadge(email.deliveryStatus)}
                              {email.template && (
                                <Badge variant="outline" className="text-xs">
                                  {email.template.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2" />
                    <p>No emails sent for this invoice yet</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(handleSendEmail)}
            disabled={loading || !restrictions.canSendEmail || loadingOptions}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}