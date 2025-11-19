'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Monitor,
  Smartphone,
  Mail,
  Eye,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react'

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  templateId?: string
  language?: 'ENGLISH' | 'ARABIC'
  customSubject?: string
  customContent?: string
}

interface PreviewData {
  preview: {
    subject: string
    content: string
    variables: Record<string, string>
    recipientEmail: string
    recipientName: string
  }
  invoice: {
    number: string
    amount: number
    currency: string
    dueDate: string
    status: string
    hasPDF: boolean
  }
  metrics: {
    subjectLength: number
    contentLength: number
    wordCount: number
    estimatedReadTime: number
    variablesUsed: number
    hasAttachment: boolean
    language: string
  }
  insights: {
    subjectLineQuality: {
      score: number
      assessment: string
      length: number
      hasNumbers: boolean
      hasUrgency: boolean
      hasPersonalization: boolean
    }
    contentQuality: {
      score: number
      assessment: string
      wordCount: number
      hasCallToAction: boolean
      hasPersonalization: boolean
      hasList: boolean
      hasInvoiceDetails: boolean
    }
    personalizationLevel: {
      score: number
      level: string
      usedFields: number
      totalFields: number
    }
    recommendations: string[]
  }
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  invoiceId,
  templateId,
  language = 'ENGLISH',
  customSubject,
  customContent
}: EmailPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')

  // Load preview when modal opens
  useState(() => {
    if (isOpen && !previewData && !isLoading) {
      loadPreview()
    }
  })

  const loadPreview = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/invoices/email/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId,
          templateId,
          language,
          customSubject,
          customContent
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate preview')
      }

      const data = await response.json()
      setPreviewData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load preview')
      console.error('Preview error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getQualityBadge = (assessment: string) => {
    switch (assessment) {
      case 'good':
        return <Badge className="bg-green-500">Good</Badge>
      case 'fair':
        return <Badge className="bg-yellow-500">Fair</Badge>
      case 'needs_improvement':
        return <Badge className="bg-red-500">Needs Improvement</Badge>
      default:
        return <Badge>{assessment}</Badge>
    }
  }

  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-500">{score}/100</Badge>
    if (score >= 50) return <Badge className="bg-yellow-500">{score}/100</Badge>
    return <Badge className="bg-red-500">{score}/100</Badge>
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Email Preview
          </DialogTitle>
          <DialogDescription>
            Preview how your email will appear to customers
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Generating preview...</span>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <Button
                onClick={loadPreview}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {previewData && (
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">
                <Mail className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="metrics">
                <TrendingUp className="h-4 w-4 mr-2" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="insights">
                <FileText className="h-4 w-4 mr-2" />
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              {/* View Mode Toggle */}
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'desktop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('desktop')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Desktop
                  </Button>
                  <Button
                    variant={viewMode === 'mobile' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('mobile')}
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Mobile
                  </Button>
                </div>

                {previewData.invoice.hasPDF && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    <FileText className="h-3 w-3 mr-1" />
                    PDF Attached
                  </Badge>
                )}
              </div>

              {/* Email Header */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">To:</div>
                      <div className="font-medium">
                        {previewData.preview.recipientName} ({previewData.preview.recipientEmail})
                      </div>
                    </div>
                    <Badge>{previewData.metrics.language}</Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Subject:</div>
                    <div className="font-medium">{previewData.preview.subject}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Body */}
              <Card>
                <CardContent className="pt-6">
                  <div
                    className={`
                      border rounded-lg bg-white overflow-auto transition-all
                      ${viewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'}
                    `}
                    style={{
                      minHeight: viewMode === 'mobile' ? '600px' : '500px',
                    }}
                  >
                    <div
                      className="p-6"
                      dangerouslySetInnerHTML={{ __html: previewData.preview.content }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Metrics Tab */}
            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Subject Length</div>
                    <div className="text-2xl font-bold mt-1">
                      {previewData.metrics.subjectLength}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {previewData.metrics.subjectLength >= 30 && previewData.metrics.subjectLength <= 60
                        ? '✓ Optimal'
                        : 'Consider 30-60 chars'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Word Count</div>
                    <div className="text-2xl font-bold mt-1">
                      {previewData.metrics.wordCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ~{previewData.metrics.estimatedReadTime} min read
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Variables Used</div>
                    <div className="text-2xl font-bold mt-1">
                      {previewData.metrics.variablesUsed}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Personalization fields
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Details */}
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold mb-3">Invoice Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Number:</span>{' '}
                      <span className="font-medium">{previewData.invoice.number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{' '}
                      <span className="font-medium">
                        {previewData.invoice.currency} {previewData.invoice.amount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <Badge variant="secondary">{previewData.invoice.status}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PDF:</span>{' '}
                      {previewData.invoice.hasPDF ? (
                        <CheckCircle2 className="inline h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="inline h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              {/* Quality Scores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Subject Line</div>
                      {getScoreBadge(previewData.insights.subjectLineQuality.score)}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        {previewData.insights.subjectLineQuality.hasPersonalization ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        Personalization
                      </div>
                      <div className="flex items-center gap-2">
                        {previewData.insights.subjectLineQuality.hasUrgency ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        Urgency
                      </div>
                      <div className="flex items-center gap-2">
                        {previewData.insights.subjectLineQuality.hasNumbers ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        Numbers
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Content Quality</div>
                      {getScoreBadge(previewData.insights.contentQuality.score)}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        {previewData.insights.contentQuality.hasCallToAction ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        Call to Action
                      </div>
                      <div className="flex items-center gap-2">
                        {previewData.insights.contentQuality.hasInvoiceDetails ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        Invoice Details
                      </div>
                      <div className="flex items-center gap-2">
                        {previewData.insights.contentQuality.hasPersonalization ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        Personalized
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Personalization</div>
                      <Badge
                        className={
                          previewData.insights.personalizationLevel.level === 'high'
                            ? 'bg-green-500'
                            : previewData.insights.personalizationLevel.level === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }
                      >
                        {previewData.insights.personalizationLevel.level}
                      </Badge>
                    </div>
                    <div className="text-xs">
                      <div>
                        {previewData.insights.personalizationLevel.usedFields} of{' '}
                        {previewData.insights.personalizationLevel.totalFields} fields used
                      </div>
                      <div className="text-muted-foreground mt-1">
                        Score: {Math.round(previewData.insights.personalizationLevel.score)}/100
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {previewData.insights.recommendations.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500" />
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {previewData.insights.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {previewData && (
            <Button onClick={() => loadPreview()}>
              Refresh Preview
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
