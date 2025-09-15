'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Mail,
  Send,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  MousePointer,
  RefreshCw,
  Plus,
  History,
  Calendar,
  User,
  Languages,
  Template,
  ExternalLink
} from 'lucide-react'
import { EmailSendModal } from './email-send-modal'
import { cn } from '@/lib/utils'

interface EmailHistory {
  id: string
  subject: string
  content: string
  recipientEmail: string
  recipientName?: string
  deliveryStatus: string
  language: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  clickedAt?: string
  bouncedAt?: string
  bounceReason?: string
  retryCount: number
  awsMessageId?: string
  template?: {
    id: string
    name: string
    templateType: string
  }
  createdAt: string
  updatedAt: string
}

interface InvoiceEmailHistoryProps {
  invoiceId: string
  invoiceNumber: string
  customerEmail?: string
  customerName?: string
  className?: string
  showSendButton?: boolean
  onEmailSent?: () => void
}

const STATUS_CONFIG = {
  QUEUED: {
    label: 'Queued',
    icon: Clock,
    variant: 'secondary' as const,
    color: 'text-yellow-600',
    description: 'Email is queued for sending'
  },
  SENT: {
    label: 'Sent',
    icon: Send,
    variant: 'default' as const,
    color: 'text-blue-600',
    description: 'Email was sent successfully'
  },
  DELIVERED: {
    label: 'Delivered',
    icon: CheckCircle,
    variant: 'default' as const,
    color: 'text-green-600',
    description: 'Email was delivered to recipient'
  },
  OPENED: {
    label: 'Opened',
    icon: Eye,
    variant: 'secondary' as const,
    color: 'text-purple-600',
    description: 'Email was opened by recipient'
  },
  CLICKED: {
    label: 'Clicked',
    icon: MousePointer,
    variant: 'secondary' as const,
    color: 'text-indigo-600',
    description: 'Links in email were clicked'
  },
  BOUNCED: {
    label: 'Bounced',
    icon: AlertCircle,
    variant: 'destructive' as const,
    color: 'text-red-600',
    description: 'Email bounced back'
  },
  FAILED: {
    label: 'Failed',
    icon: X,
    variant: 'destructive' as const,
    color: 'text-red-600',
    description: 'Email delivery failed'
  },
  COMPLAINED: {
    label: 'Spam',
    icon: AlertCircle,
    variant: 'destructive' as const,
    color: 'text-orange-600',
    description: 'Marked as spam by recipient'
  }
} as const

export function InvoiceEmailHistory({
  invoiceId,
  invoiceNumber,
  customerEmail,
  customerName,
  className,
  showSendButton = true,
  onEmailSent
}: InvoiceEmailHistoryProps) {
  const t = useTranslations('invoiceEmailHistory')
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showContentModal, setShowContentModal] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailHistory | null>(null)

  useEffect(() => {
    loadEmailHistory()
  }, [invoiceId])

  const loadEmailHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/invoices/${invoiceId}/email-history`)

      if (response.ok) {
        const data = await response.json()
        setEmailHistory(data.history || [])
      } else {
        console.error('Failed to load email history')
      }
    } catch (error) {
      console.error('Error loading email history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSent = () => {
    loadEmailHistory() // Refresh history
    if (onEmailSent) {
      onEmailSent()
    }
  }

  const getStatusIcon = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.QUEUED
    const Icon = config.icon
    return <Icon className={cn('h-4 w-4', config.color)} />
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.QUEUED
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {config.label}
      </Badge>
    )
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not available'
    return new Date(dateString).toLocaleString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEmailTimeline = (email: EmailHistory) => {
    const events = []

    if (email.sentAt) {
      events.push({
        type: 'sent',
        time: email.sentAt,
        label: 'Sent',
        icon: Send,
        color: 'text-blue-600'
      })
    }

    if (email.deliveredAt) {
      events.push({
        type: 'delivered',
        time: email.deliveredAt,
        label: 'Delivered',
        icon: CheckCircle,
        color: 'text-green-600'
      })
    }

    if (email.openedAt) {
      events.push({
        type: 'opened',
        time: email.openedAt,
        label: 'Opened',
        icon: Eye,
        color: 'text-purple-600'
      })
    }

    if (email.clickedAt) {
      events.push({
        type: 'clicked',
        time: email.clickedAt,
        label: 'Clicked',
        icon: MousePointer,
        color: 'text-indigo-600'
      })
    }

    if (email.bouncedAt) {
      events.push({
        type: 'bounced',
        time: email.bouncedAt,
        label: 'Bounced',
        icon: AlertCircle,
        color: 'text-red-600'
      })
    }

    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email History
              </CardTitle>
              <CardDescription>
                {emailHistory.length} email{emailHistory.length !== 1 ? 's' : ''} sent for this invoice
              </CardDescription>
            </div>
            {showSendButton && (
              <Button
                onClick={() => setShowSendModal(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Send Email
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emailHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No emails sent for this invoice yet</p>
              {showSendButton && (
                <Button
                  variant="outline"
                  onClick={() => setShowSendModal(true)}
                  className="mt-4"
                >
                  Send First Email
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {emailHistory.map((email, index) => (
                <div key={email.id}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(email.deliveryStatus)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-sm truncate">
                            {email.subject}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {email.recipientEmail}
                            <Calendar className="h-3 w-3 ml-2" />
                            {formatDateTime(email.sentAt || email.createdAt)}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(email.deliveryStatus)}
                            {email.language === 'ARABIC' && (
                              <Badge variant="outline" className="text-xs">
                                <Languages className="h-3 w-3 mr-1" />
                                العربية
                              </Badge>
                            )}
                            {email.template && (
                              <Badge variant="outline" className="text-xs">
                                <Template className="h-3 w-3 mr-1" />
                                {email.template.name}
                              </Badge>
                            )}
                            {email.retryCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {email.retryCount} retr{email.retryCount === 1 ? 'y' : 'ies'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEmail(email)
                              setShowContentModal(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {email.awsMessageId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(email.awsMessageId!)
                              }}
                              title="Copy AWS Message ID"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Email Timeline */}
                      {(email.sentAt || email.deliveredAt || email.openedAt || email.clickedAt) && (
                        <div className="mt-3 pl-4 border-l-2 border-muted">
                          <div className="space-y-2">
                            {getEmailTimeline(email).map((event, eventIndex) => {
                              const Icon = event.icon
                              return (
                                <div key={eventIndex} className="flex items-center gap-2 text-xs">
                                  <Icon className={cn('h-3 w-3', event.color)} />
                                  <span className="text-muted-foreground">
                                    {event.label} at {formatDateTime(event.time)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Bounce/Error Information */}
                      {email.bounceReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <span className="font-medium text-red-700">Error: </span>
                          <span className="text-red-600">{email.bounceReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {index < emailHistory.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Email Modal */}
      <EmailSendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        defaultRecipientEmail={customerEmail}
        defaultRecipientName={customerName}
        onEmailSent={handleEmailSent}
      />

      {/* Email Content Modal */}
      <Dialog open={showContentModal} onOpenChange={setShowContentModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </DialogTitle>
            <DialogDescription>
              View the complete email content and delivery information
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4 overflow-y-auto">
              {/* Email Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">To:</span> {selectedEmail.recipientEmail}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {getStatusBadge(selectedEmail.deliveryStatus)}
                </div>
                <div>
                  <span className="font-medium">Language:</span> {selectedEmail.language}
                </div>
                <div>
                  <span className="font-medium">Sent:</span> {formatDateTime(selectedEmail.sentAt)}
                </div>
              </div>

              <Separator />

              {/* Subject */}
              <div>
                <h4 className="font-medium mb-2">Subject</h4>
                <div className="p-3 bg-muted rounded text-sm">
                  {selectedEmail.subject}
                </div>
              </div>

              {/* Content */}
              <div>
                <h4 className="font-medium mb-2">Content</h4>
                <div className="p-4 bg-muted rounded text-sm max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {selectedEmail.content}
                </div>
              </div>

              {/* Template Information */}
              {selectedEmail.template && (
                <div>
                  <h4 className="font-medium mb-2">Template Used</h4>
                  <div className="p-3 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Template className="h-4 w-4" />
                      {selectedEmail.template.name}
                      <Badge variant="outline" className="text-xs">
                        {selectedEmail.template.templateType}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Timeline */}
              {getEmailTimeline(selectedEmail).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Delivery Timeline</h4>
                  <div className="space-y-2">
                    {getEmailTimeline(selectedEmail).map((event, index) => {
                      const Icon = event.icon
                      return (
                        <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded text-sm">
                          <Icon className={cn('h-4 w-4', event.color)} />
                          <span className="font-medium">{event.label}</span>
                          <span className="text-muted-foreground">
                            {formatDateTime(event.time)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}