'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Mail,
  Send,
  Clock,
  Users,
  FileText,
  Globe,
  Settings,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react'
import { formatCurrency } from '@/hooks/use-invoice-buckets'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { EmailPreviewModal } from '@/components/email/email-preview-modal'

interface EmailCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceIds: string[]
  invoiceDetails?: {
    id: string
    customerName: string
    customerEmail: string
    number: string
    amount: number
    currency: string
    daysOverdue: number
  }[]
}

interface CampaignFormData {
  campaignName: string
  emailSubject: string
  emailContent: string
  language: 'ENGLISH' | 'ARABIC'
  templateId?: string
  sendingOptions: {
    scheduleFor?: string
    respectBusinessHours: boolean
    batchSize: number
    delayBetweenBatches: number
  }
  personalization: {
    enableMergeTags: boolean
    customFields?: Record<string, any>
    fallbackContent?: string
  }
}

export function EmailCampaignModal({
  isOpen,
  onClose,
  invoiceIds,
  invoiceDetails = []
}: EmailCampaignModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<CampaignFormData>({
    campaignName: `Payment Reminder - ${new Date().toLocaleDateString()}`,
    emailSubject: 'Payment Reminder: Outstanding Invoice {{invoiceNumber}}',
    emailContent: `Dear {{customerName}},

We hope this message finds you well. This is a friendly reminder regarding the following outstanding invoice:

Invoice Number: {{invoiceNumber}}
Amount: {{amount}}
Due Date: {{dueDate}}
Days Overdue: {{daysPastDue}}

We kindly request that you arrange payment at your earliest convenience. If you have any questions or require assistance, please don't hesitate to contact us.

Thank you for your business and cooperation.

Best regards,
{{companyName}} Team`,
    language: 'ENGLISH',
    sendingOptions: {
      respectBusinessHours: true,
      batchSize: 5,
      delayBetweenBatches: 3000
    },
    personalization: {
      enableMergeTags: true
    }
  })

  // Fetch database templates with fallback
  const { templates: dbTemplates, loading: templatesLoading, error: templatesError } = useEmailTemplates('INVOICE_REMINDER')

  // Hardcoded fallback templates (used if database fails or is empty)
  const fallbackTemplates = [
    {
      id: 'gentle-reminder',
      name: 'Gentle Reminder',
      description: 'Polite follow-up for recent overdue invoices',
      subject: 'Friendly Payment Reminder - Invoice {invoice_number}',
      preview: 'We hope this message finds you well...'
    },
    {
      id: 'urgent-notice',
      name: 'Urgent Notice',
      description: 'Firm reminder for significantly overdue invoices',
      subject: 'Urgent: Payment Required - Invoice {invoice_number}',
      preview: 'This is an urgent notice regarding...'
    },
    {
      id: 'final-notice',
      name: 'Final Notice',
      description: 'Last reminder before collection action',
      subject: 'Final Notice: Immediate Payment Required',
      preview: 'This is our final attempt to collect...'
    }
  ]

  // Use database templates if available, otherwise fall back to hardcoded
  const emailTemplates = dbTemplates.length > 0 ? dbTemplates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description || 'Email template',
    subject: t.subject_en || '',
    preview: (t.content_en || '').substring(0, 50) + '...',
    content: t.content_en || ''
  })) : fallbackTemplates

  const mergeTagOptions = [
    { tag: '{{customerName}}', description: 'Customer full name' },
    { tag: '{{invoiceNumber}}', description: 'Invoice number' },
    { tag: '{{amount}}', description: 'Formatted invoice amount' },
    { tag: '{{dueDate}}', description: 'Original due date' },
    { tag: '{{daysPastDue}}', description: 'Number of days overdue' },
    { tag: '{{companyName}}', description: 'Your company name' },
    { tag: '{{customerEmail}}', description: 'Customer email address' }
  ]

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      // Step 1: Create campaign
      const createResponse = await fetch('/api/campaigns/from-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceIds,
          ...formData,
          sendingOptions: {
            ...formData.sendingOptions,
            scheduleFor: formData.sendingOptions.scheduleFor || undefined
          }
        }),
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(error.error || 'Failed to create campaign')
      }

      const createResult = await createResponse.json()
      console.log('Campaign created:', createResult)

      // Step 2: Send campaign immediately (unless scheduled)
      if (!formData.sendingOptions.scheduleFor && createResult.readyToSend) {
        const sendResponse = await fetch(`/api/campaigns/${createResult.campaign.id}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmSend: true })
        })

        if (!sendResponse.ok) {
          const error = await sendResponse.json()
          console.error('Failed to send campaign:', error)
          throw new Error(error.error || 'Campaign created but failed to send')
        }

        const sendResult = await sendResponse.json()
        console.log('Campaign sent:', sendResult)

        alert(`✅ Success! Sent ${sendResult.sentCount || 0} emails to customers.`)
      } else if (formData.sendingOptions.scheduleFor) {
        alert(`✅ Campaign scheduled for ${new Date(formData.sendingOptions.scheduleFor).toLocaleString()}`)
      } else {
        alert('⚠️ Campaign created but requires manual validation before sending.')
      }

      // Show success message and close
      onClose()
    } catch (error) {
      console.error('Error with campaign:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to process campaign'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (updates: Partial<CampaignFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const insertMergeTag = (tag: string) => {
    const textarea = document.querySelector('textarea[name="emailContent"]') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = formData.emailContent.substring(0, start) + tag + formData.emailContent.substring(end)
      updateFormData({ emailContent: newContent })
    }
  }

  const totalAmount = invoiceDetails.reduce((sum, invoice) => sum + invoice.amount, 0)
  const avgDaysOverdue = invoiceDetails.length > 0
    ? Math.round(invoiceDetails.reduce((sum, invoice) => sum + invoice.daysOverdue, 0) / invoiceDetails.length)
    : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Create Email Campaign
          </DialogTitle>
          <DialogDescription>
            Send payment reminders to {invoiceIds.length} customers for outstanding invoices
          </DialogDescription>
        </DialogHeader>

        {/* Campaign Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{invoiceIds.length}</div>
            <div className="text-sm text-gray-600">Invoices</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</div>
            <div className="text-sm text-gray-600">Total Amount</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{avgDaysOverdue}d</div>
            <div className="text-sm text-gray-600">Avg Days Overdue</div>
          </div>
        </div>

        <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="1" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="2" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="3" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="4" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Content */}
          <TabsContent value="1" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="campaignName">Campaign Name</Label>
                  <Input
                    id="campaignName"
                    value={formData.campaignName}
                    onChange={(e) => updateFormData({ campaignName: e.target.value })}
                    placeholder="Enter campaign name"
                  />
                </div>

                <div>
                  <Label htmlFor="template">Email Template</Label>
                  <div className="space-y-2 mt-2">
                    {templatesLoading && (
                      <div className="text-sm text-gray-500 py-2">Loading templates...</div>
                    )}
                    {templatesError && (
                      <div className="text-sm text-amber-600 py-2">Using default templates (database unavailable)</div>
                    )}
                    {emailTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-colors ${
                          formData.templateId === template.id ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          updateFormData({
                            templateId: template.id,
                            emailSubject: template.subject,
                            emailContent: (template as any).content || formData.emailContent
                          })
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-sm text-gray-600">{template.description}</p>
                            </div>
                            <Checkbox
                              checked={formData.templateId === template.id}
                              onChange={() => {}}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value: 'ENGLISH' | 'ARABIC') => updateFormData({ language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENGLISH">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          English
                        </div>
                      </SelectItem>
                      <SelectItem value="ARABIC">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Arabic
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="emailSubject">Email Subject</Label>
                  <Input
                    id="emailSubject"
                    value={formData.emailSubject}
                    onChange={(e) => updateFormData({ emailSubject: e.target.value })}
                    placeholder="Enter email subject"
                  />
                </div>

                <div>
                  <Label htmlFor="emailContent">Email Content</Label>
                  <Textarea
                    id="emailContent"
                    name="emailContent"
                    value={formData.emailContent}
                    onChange={(e) => updateFormData({ emailContent: e.target.value })}
                    placeholder="Enter email content"
                    rows={12}
                    className="resize-none"
                  />
                </div>

                <div>
                  <Label>Merge Tags</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mergeTagOptions.map((option) => (
                      <Button
                        key={option.tag}
                        variant="outline"
                        size="sm"
                        onClick={() => insertMergeTag(option.tag)}
                        className="justify-start text-left h-auto p-2"
                      >
                        <div>
                          <div className="font-mono text-xs">{option.tag}</div>
                          <div className="text-xs text-gray-500">{option.description}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Step 2: Settings */}
          <TabsContent value="2" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Sending Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="scheduleFor">Schedule For (Optional)</Label>
                    <Input
                      id="scheduleFor"
                      type="datetime-local"
                      value={formData.sendingOptions.scheduleFor || ''}
                      onChange={(e) => updateFormData({
                        sendingOptions: { ...formData.sendingOptions, scheduleFor: e.target.value }
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to send immediately
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="respectBusinessHours"
                      checked={formData.sendingOptions.respectBusinessHours}
                      onCheckedChange={(checked) => updateFormData({
                        sendingOptions: { ...formData.sendingOptions, respectBusinessHours: checked as boolean }
                      })}
                    />
                    <Label htmlFor="respectBusinessHours">Respect UAE Business Hours</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Emails will only be sent Sunday-Thursday, 9 AM - 6 PM GST
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Delivery Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Select
                      value={formData.sendingOptions.batchSize.toString()}
                      onValueChange={(value) => updateFormData({
                        sendingOptions: { ...formData.sendingOptions, batchSize: parseInt(value) }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 email at a time</SelectItem>
                        <SelectItem value="5">5 emails per batch</SelectItem>
                        <SelectItem value="10">10 emails per batch</SelectItem>
                        <SelectItem value="25">25 emails per batch</SelectItem>
                        <SelectItem value="50">50 emails per batch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="delayBetweenBatches">Delay Between Batches (ms)</Label>
                    <Select
                      value={formData.sendingOptions.delayBetweenBatches.toString()}
                      onValueChange={(value) => updateFormData({
                        sendingOptions: { ...formData.sendingOptions, delayBetweenBatches: parseInt(value) }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1000">1 second</SelectItem>
                        <SelectItem value="3000">3 seconds</SelectItem>
                        <SelectItem value="5000">5 seconds</SelectItem>
                        <SelectItem value="10000">10 seconds</SelectItem>
                        <SelectItem value="30000">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enableMergeTags"
                      checked={formData.personalization.enableMergeTags}
                      onCheckedChange={(checked) => updateFormData({
                        personalization: { ...formData.personalization, enableMergeTags: checked as boolean }
                      })}
                    />
                    <Label htmlFor="enableMergeTags">Enable Personalization</Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Step 3: Preview */}
          <TabsContent value="3" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Preview</CardTitle>
                <CardDescription>
                  Preview how your email will appear to recipients with full details and insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoiceDetails.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div>
                        <div className="font-medium">Preview with real invoice data</div>
                        <div className="text-sm text-muted-foreground">
                          See desktop/mobile views, quality scores, and personalization insights
                        </div>
                      </div>
                      <Button
                        onClick={() => setShowPreview(true)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Open Preview
                      </Button>
                    </div>

                    {/* Quick Preview */}
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="text-sm font-medium mb-3">Quick Preview</div>
                      <div className="border-b pb-3 mb-3">
                        <div className="text-xs text-gray-600">Subject:</div>
                        <div className="font-medium text-sm">{formData.emailSubject}</div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">Content Preview:</div>
                      <div className="whitespace-pre-wrap text-sm text-gray-700 line-clamp-6">
                        {formData.emailContent}
                      </div>
                      <Button
                        variant="link"
                        onClick={() => setShowPreview(true)}
                        className="mt-2 p-0 h-auto text-xs"
                      >
                        View full preview with personalization →
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <div>No invoices selected for preview</div>
                    <div className="text-sm">Select invoices to see personalized preview</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 4: Send */}
          <TabsContent value="4" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Ready to Send
                </CardTitle>
                <CardDescription>
                  Review campaign details before sending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Recipients:</span>
                      <span className="ml-2 font-medium">{invoiceIds.length} customers</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="ml-2 font-medium">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Language:</span>
                      <span className="ml-2 font-medium">{formData.language}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Schedule:</span>
                      <span className="ml-2 font-medium">
                        {formData.sendingOptions.scheduleFor ?
                          new Date(formData.sendingOptions.scheduleFor).toLocaleString() :
                          'Send immediately'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <div className="text-sm">
                      <div className="font-medium text-yellow-800">Important Notice</div>
                      <div className="text-yellow-700">
                        Emails will be sent in batches of {formData.sendingOptions.batchSize} with {formData.sendingOptions.delayBetweenBatches/1000} second delays.
                        {formData.sendingOptions.respectBusinessHours && ' Sending will respect UAE business hours.'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                Previous
              </Button>
            )}

            {currentStep < 4 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Creating Campaign...' : 'Send Campaign'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Email Preview Modal */}
      {showPreview && invoiceDetails.length > 0 && (
        <EmailPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          invoiceId={invoiceDetails[0].id}
          templateId={formData.templateId}
          language={formData.language}
          customSubject={formData.emailSubject}
          customContent={formData.emailContent}
        />
      )}
    </Dialog>
  )
}