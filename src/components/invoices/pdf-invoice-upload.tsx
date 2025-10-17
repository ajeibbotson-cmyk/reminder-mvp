'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Upload,
  File,
  Check,
  AlertCircle,
  Eye,
  Edit,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  ArrowRight,
  ZoomIn,
  Download,
  FileText,
  Target,
  Layers,
  Split
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUpload } from '@/components/import/file-upload'
import { ExtractedInvoiceData } from '@/lib/services/pdf-invoice-parser'
import { cn } from '@/lib/utils'

interface PDFInvoiceUploadProps {
  onInvoiceCreate: (invoiceData: any) => void
  isLoading?: boolean
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface ParseResult {
  fileName: string
  fileSize: number
  extractedData: ExtractedInvoiceData
  validation: ValidationResult
  timestamp: string
  previewUrl?: string
  rawTextHighlights?: {
    [field: string]: {
      text: string
      confidence: number
      position: { start: number; end: number }
    }
  }
}

export function PDFInvoiceUpload({ onInvoiceCreate, isLoading = false }: PDFInvoiceUploadProps) {
  const t = useTranslations('invoices')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [editableData, setEditableData] = useState<Partial<ExtractedInvoiceData>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('reconciliation')
  const [hoveredField, setHoveredField] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/invoices/upload-pdf', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process PDF')
      }

      const result = await response.json()
      setParseResult(result.data)
      setEditableData(result.data.extractedData)

    } catch (err) {
      console.error('PDF upload failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to process PDF')
    } finally {
      setProcessing(false)
    }
  }

  const handleCreateInvoice = () => {
    if (!parseResult) return

    // Combine extracted data with any user edits
    const invoiceData = {
      invoiceNumber: editableData.invoiceNumber || '',
      customerName: editableData.customerName || '',
      customerEmail: editableData.customerEmail || '',
      amount: editableData.amount || editableData.totalAmount || 0,
      vatAmount: editableData.vatAmount,
      totalAmount: editableData.totalAmount,
      currency: editableData.currency || 'EUR',
      dueDate: editableData.dueDate || '',
      description: editableData.description || '',
      pdf_s3_key: parseResult.extractedData.s3Key,
      pdf_s3_bucket: parseResult.extractedData.s3Bucket,
      pdf_uploaded_at: new Date().toISOString()
    }

    onInvoiceCreate(invoiceData)
  }

  const resetUpload = () => {
    setParseResult(null)
    setEditableData({})
    setError(null)
  }

  // Helper function to get field data with confidence scores
  const getFieldsWithConfidence = () => {
    if (!parseResult) return []

    const extracted = parseResult.extractedData
    return [
      {
        key: 'invoiceNumber',
        label: 'Invoice Number',
        placeholder: 'INV-2024-001',
        value: editableData.invoiceNumber || '',
        extractedValue: extracted.invoiceNumber || '',
        confidence: extracted.invoiceNumber ? 95 : 0,
        type: 'text'
      },
      {
        key: 'customerName',
        label: 'Customer Name',
        placeholder: 'ABC Trading LLC',
        value: editableData.customerName || '',
        extractedValue: extracted.customerName || '',
        confidence: extracted.customerName ? 90 : 0,
        type: 'text'
      },
      {
        key: 'customerEmail',
        label: 'Email Address',
        placeholder: 'ahmad@abctrading.ae',
        value: editableData.customerEmail || '',
        extractedValue: extracted.customerEmail || '',
        confidence: extracted.customerEmail ? 85 : 0,
        type: 'email'
      },
      {
        key: 'totalAmount',
        label: 'Invoice Amount',
        placeholder: 'AED 5,250.00',
        value: editableData.totalAmount || '',
        extractedValue: extracted.totalAmount || extracted.amount || '',
        confidence: (extracted.totalAmount || extracted.amount) ? 90 : 0,
        type: 'number'
      },
      {
        key: 'vatAmount',
        label: 'VAT Amount',
        placeholder: 'AED 250.00',
        value: editableData.vatAmount || '',
        extractedValue: extracted.vatAmount || '',
        confidence: extracted.vatAmount ? 80 : 50, // Often calculated
        type: 'number'
      },
      {
        key: 'invoiceDate',
        label: 'Invoice Date',
        placeholder: '2024-11-15',
        value: editableData.invoiceDate || '',
        extractedValue: extracted.invoiceDate || '',
        confidence: extracted.invoiceDate ? 85 : 0,
        type: 'date'
      },
      {
        key: 'dueDate',
        label: 'Due Date',
        placeholder: '2024-12-15',
        value: editableData.dueDate || '',
        extractedValue: extracted.dueDate || '',
        confidence: extracted.dueDate ? 80 : 0,
        type: 'date'
      },
      {
        key: 'trn',
        label: 'TRN',
        placeholder: '100123456789012',
        value: editableData.trn || '',
        extractedValue: extracted.trn || '',
        confidence: extracted.trn ? 95 : 0,
        type: 'text'
      },
      {
        key: 'currency',
        label: 'Currency',
        placeholder: 'AED',
        value: editableData.currency || 'AED',
        extractedValue: extracted.currency || 'AED',
        confidence: 95, // Usually reliable
        type: 'text'
      },
      {
        key: 'description',
        label: 'Notes',
        placeholder: 'Project Alpha completion',
        value: editableData.description || '',
        extractedValue: extracted.description || '',
        confidence: extracted.description ? 70 : 0,
        type: 'textarea'
      }
    ]
  }

  // Helper function to render editable fields with confidence indicators
  const renderEditableField = (field: any) => {
    const confidenceIcon = field.confidence >= 95 ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : field.confidence >= 70 ? (
      <AlertTriangle className="h-4 w-4 text-orange-500" />
    ) : (
      <X className="h-4 w-4 text-red-500" />
    )

    const confidenceColor = field.confidence >= 95 ? 'border-green-200 bg-green-50' :
                           field.confidence >= 70 ? 'border-orange-200 bg-orange-50' :
                           'border-red-200 bg-red-50'

    return (
      <div key={field.key} className={cn('p-3 rounded-lg border-2', confidenceColor)}>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            {confidenceIcon}
            {field.label}
            {field.confidence >= 95 && <span className="text-xs text-green-600">(High confidence)</span>}
            {field.confidence >= 70 && field.confidence < 95 && <span className="text-xs text-orange-600">(Review needed)</span>}
            {field.confidence < 70 && <span className="text-xs text-red-600">(Manual entry required)</span>}
          </Label>
          {field.confidence > 0 && (
            <Badge variant="outline" className="text-xs">
              {field.confidence}%
            </Badge>
          )}
        </div>

        {field.extractedValue && field.confidence >= 70 && (
          <div className="text-xs text-gray-600 mb-2 p-2 bg-white rounded border">
            <strong>Extracted:</strong> {field.extractedValue}
          </div>
        )}

        {field.type === 'textarea' ? (
          <Textarea
            value={field.value}
            onChange={(e) => setEditableData(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.confidence < 70 ? field.placeholder : ''}
            rows={2}
            className="mt-1"
          />
        ) : (
          <Input
            type={field.type}
            value={field.value}
            onChange={(e) => {
              const value = field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value
              setEditableData(prev => ({ ...prev, [field.key]: value }))
            }}
            placeholder={field.confidence < 70 ? field.placeholder : ''}
            step={field.type === 'number' ? '0.01' : undefined}
            className="mt-1"
          />
        )}

        {field.confidence < 70 && field.extractedValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditableData(prev => ({ ...prev, [field.key]: field.extractedValue }))}
            className="mt-2 text-xs"
          >
            Use extracted value: "{field.extractedValue}"
          </Button>
        )}
      </div>
    )
  }

  if (!parseResult) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Upload PDF Invoice
            </CardTitle>
            <CardDescription>
              Upload a PDF invoice to automatically extract invoice data using AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileUpload={handleFileUpload}
              isLoading={processing}
              error={error}
              acceptedFileTypes="pdf"
            />
          </CardContent>
        </Card>

        {processing && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center space-x-3">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Processing PDF...</p>
                  <p className="text-sm text-gray-500">Extracting invoice data using AI</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Parsing Results Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              PDF Processed Successfully
            </CardTitle>
            <Button variant="outline" size="sm" onClick={resetUpload}>
              Upload Different PDF
            </Button>
          </div>
          <CardDescription>
            Review and edit the extracted data before importing the invoice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {parseResult.extractedData.confidence}%
              </div>
              <div className="text-sm text-gray-500">AI Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold truncate">{parseResult.fileName}</div>
              <div className="text-sm text-gray-500">
                {(parseResult.fileSize / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <div className="text-center">
              <Badge
                variant={parseResult.validation?.isValid ? "default" : "destructive"}
                className="text-sm"
              >
                {parseResult.validation?.isValid ? "Valid" : "Review"}
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {getFieldsWithConfidence().filter(f => f.confidence >= 95).length}/{getFieldsWithConfidence().length}
              </div>
              <div className="text-sm text-gray-500">Fields Matched</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Alerts */}
      {parseResult.validation?.errors && parseResult.validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errors Found</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {parseResult.validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {parseResult.validation?.warnings && parseResult.validation.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {parseResult.validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Smart Reconciliation Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Smart Reconciliation System
          </CardTitle>
          <CardDescription>
            AI-powered invoice field matching with confidence scoring and manual override capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="reconciliation" className="flex items-center gap-2">
                <Split className="h-4 w-4" />
                Side-by-Side
              </TabsTrigger>
              <TabsTrigger value="extraction" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Field Details
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                PDF Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reconciliation" className="space-y-6 mt-6">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Left Panel - Required Fields Template */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Required Invoice Structure</h3>
                  </div>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {getFieldsWithConfidence().map((field) => (
                        <div
                          key={field.key}
                          className={cn(
                            "flex items-center justify-between p-3 border rounded-lg transition-colors cursor-pointer",
                            hoveredField === field.key && "bg-blue-50 border-blue-200"
                          )}
                          onMouseEnter={() => setHoveredField(field.key)}
                          onMouseLeave={() => setHoveredField(null)}
                        >
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-gray-700">{field.label}</Label>
                            <div className="text-sm text-gray-500 mt-1">{field.placeholder}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {field.confidence >= 95 ? (
                              <CheckCircle className="h-5 w-5 text-green-500" title="High confidence match" />
                            ) : field.confidence >= 70 ? (
                              <AlertTriangle className="h-5 w-5 text-orange-500" title="Partial match - review needed" />
                            ) : (
                              <X className="h-5 w-5 text-red-500" title="Not found or low confidence" />
                            )}
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right Panel - Extracted Data with Editing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Target className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-green-900">AI Extracted Data</h3>
                  </div>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {getFieldsWithConfidence().map((field) => (
                        <div
                          key={field.key}
                          className={cn(
                            "transition-all duration-200",
                            hoveredField === field.key && "scale-105 z-10 relative"
                          )}
                        >
                          {renderEditableField(field)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="extraction" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Layers className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium">Detailed Field Analysis</h3>
                </div>
                <div className="grid gap-4">
                  {getFieldsWithConfidence().map((field) => renderEditableField(field))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Eye className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium">Document Preview & Extraction Highlights</h3>
                </div>
                {parseResult.previewUrl ? (
                  <div className="border rounded-lg p-4 bg-white">
                    <iframe
                      src={parseResult.previewUrl}
                      className="w-full h-[600px] border rounded"
                      title="PDF Preview"
                    />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">PDF Preview Not Available</h3>
                    <p className="text-gray-500">Preview functionality will be added in future updates</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />

          {/* Enhanced Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-2">
                <Target className="h-3 w-3" />
                {getFieldsWithConfidence().filter(f => f.confidence >= 95).length} High Confidence
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" />
                {getFieldsWithConfidence().filter(f => f.confidence >= 70 && f.confidence < 95).length} Review Needed
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <X className="h-3 w-3" />
                {getFieldsWithConfidence().filter(f => f.confidence < 70).length} Manual Entry
              </Badge>
            </div>
            <div className="flex space-x-4">
              <Button variant="outline" onClick={resetUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload New PDF
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={isLoading || !editableData.invoiceNumber || !editableData.customerName}
                className="min-w-[150px]"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Import Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Extracted Text (Collapsible) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Raw Extracted Text
          </CardTitle>
        </CardHeader>
        <CardContent>
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              View original PDF text (for debugging)
            </summary>
            <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap">
              {parseResult.extractedData.rawText}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}