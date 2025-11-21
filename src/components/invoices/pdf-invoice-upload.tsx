'use client'

import { useState } from 'react'
import {
  Upload,
  File,
  Check,
  AlertCircle,
  Eye,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  FileText
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
}

interface FieldConfirmation {
  [fieldKey: string]: boolean
}

interface FieldDefinition {
  key: string
  label: string
  placeholder: string
  value: any
  extractedValue: any
  confidence: number
  type: 'text' | 'email' | 'number' | 'date' | 'textarea'
  required: boolean
}

const REQUIRED_FIELDS = [
  'invoiceNumber',
  'customerName',
  'customerEmail',
  'totalAmount',
  'currency',
  'invoiceDate',
  'dueDate'
]

/**
 * Convert various date formats to YYYY-MM-DD for HTML date inputs
 * Handles: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, and already correct YYYY-MM-DD
 */
const convertDateFormat = (dateStr: string | undefined): string => {
  if (!dateStr) return ''

  // Try to parse date parts
  const parts = dateStr.split(/[-\/]/)
  if (parts.length !== 3) return dateStr

  const [first, second, third] = parts

  // Check if already in YYYY-MM-DD format (first part is 4 digits)
  if (first.length === 4) {
    // Already in correct format, just ensure proper padding
    return `${first}-${second.padStart(2, '0')}-${third.padStart(2, '0')}`
  }

  // Otherwise, assume DD/MM/YYYY or MM/DD/YYYY with year as last part
  const year = third

  // Detect format based on first part (day > 12 means DD/MM/YYYY)
  const day = parseInt(first) > 12 ? first : second
  const month = parseInt(first) > 12 ? second : first

  // Return YYYY-MM-DD format
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export function PDFInvoiceUpload({ onInvoiceCreate, isLoading = false }: PDFInvoiceUploadProps) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [editableData, setEditableData] = useState<Partial<ExtractedInvoiceData>>({})
  const [confirmedFields, setConfirmedFields] = useState<FieldConfirmation>({})
  const [confirmedValues, setConfirmedValues] = useState<Partial<ExtractedInvoiceData>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setProcessing(true)
    setError(null)

    // Store the file and create preview URL
    setUploadedFile(file)
    const previewUrl = URL.createObjectURL(file)
    setPdfPreviewUrl(previewUrl)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Use async API for faster perceived performance
      const uploadResponse = await fetch('/api/invoices/upload-pdf-async', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to upload PDF')
      }

      const { trackingId } = await uploadResponse.json()
      console.log('[Upload] Started with trackingId:', trackingId)

      // Poll for results with fast interval
      const pollInterval = 500 // Check every 500ms for fast feedback
      const maxPollTime = 120000 // 2 minutes max
      const startTime = Date.now()

      while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const statusResponse = await fetch(`/api/invoices/upload-pdf-async?trackingId=${trackingId}`)
        const statusData = await statusResponse.json()

        console.log('[Upload] Status:', statusData.status, statusData.elapsedMs ? `${statusData.elapsedMs}ms` : '')

        if (statusData.status === 'completed') {
          const result = statusData.data
          setParseResult(result)

          // Convert date formats for HTML date inputs
          const extractedData = result.extractedData
          const convertedInvoiceDate = convertDateFormat(extractedData.invoiceDate)
          const convertedDueDate = convertDateFormat(extractedData.dueDate)

          setEditableData({
            ...extractedData,
            invoiceDate: convertedInvoiceDate,
            dueDate: convertedDueDate
          })

          console.log('[Upload] Complete in', statusData.processingTimeMs, 'ms')
          return
        }

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Processing failed')
        }
      }

      throw new Error('Processing timeout - please try again')

    } catch (err) {
      console.error('PDF upload failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to process PDF')
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmField = (fieldKey: string) => {
    const currentValue = editableData[fieldKey as keyof ExtractedInvoiceData]

    setConfirmedFields(prev => ({ ...prev, [fieldKey]: true }))
    setConfirmedValues(prev => ({ ...prev, [fieldKey]: currentValue }))
  }

  const handleFieldEdit = (fieldKey: string, value: any) => {
    // Editing unconfirms the field
    setConfirmedFields(prev => ({ ...prev, [fieldKey]: false }))
    setEditableData(prev => ({ ...prev, [fieldKey]: value }))
  }

  const getFieldButtonState = (fieldKey: string) => {
    const isConfirmed = confirmedFields[fieldKey]
    const currentValue = editableData[fieldKey as keyof ExtractedInvoiceData]
    const hasValue = currentValue !== undefined && currentValue !== '' && currentValue !== null

    return {
      disabled: !hasValue,
      variant: isConfirmed ? 'default' as const : 'outline' as const,
      icon: isConfirmed
    }
  }

  const handleCreateInvoice = () => {
    if (!parseResult) return

    // Debug: Log confirmed values to diagnose issues
    console.log('=== INVOICE CREATION DEBUG ===')
    console.log('confirmedValues:', confirmedValues)
    console.log('editableData:', editableData)
    console.log('parseResult:', parseResult)

    // Parse total amount first (this is confirmed by user)
    const rawTotalAmount = confirmedValues.totalAmount
    const parsedTotalAmount = typeof rawTotalAmount === 'string' ? parseFloat(rawTotalAmount) : (rawTotalAmount ?? 0)
    const finalTotalAmount = isNaN(parsedTotalAmount) ? 0 : parsedTotalAmount

    // Parse VAT amount (optional, may not be confirmed)
    const rawVatAmount = confirmedValues.vatAmount || editableData.vatAmount
    const parsedVatAmount = typeof rawVatAmount === 'string' ? parseFloat(rawVatAmount) : (rawVatAmount ?? 0)
    const finalVatAmount = isNaN(parsedVatAmount) ? 0 : parsedVatAmount

    // Calculate amount (net amount before VAT)
    // If we have totalAmount and VAT, calculate: amount = total - VAT
    // Otherwise use the amount from editableData as fallback
    let finalAmount = finalTotalAmount - finalVatAmount

    // If calculated amount is invalid, try using amount from editableData
    if (finalAmount <= 0) {
      const fallbackAmount = editableData.amount || confirmedValues.amount
      const parsedFallback = typeof fallbackAmount === 'string' ? parseFloat(fallbackAmount) : (fallbackAmount ?? 0)
      finalAmount = isNaN(parsedFallback) ? finalTotalAmount : parsedFallback
    }

    // Use confirmed values for invoice creation
    // All field names use camelCase to match Prisma schema
    const invoiceData = {
      number: confirmedValues.invoiceNumber || '',
      customerName: confirmedValues.customerName || '',
      customerEmail: confirmedValues.customerEmail || '',
      amount: finalAmount,
      vatAmount: finalVatAmount,
      totalAmount: finalTotalAmount,
      currency: confirmedValues.currency || 'AED',
      dueDate: confirmedValues.dueDate || '',
      invoiceDate: confirmedValues.invoiceDate || '',
      description: confirmedValues.description || '',
      pdfS3Key: parseResult.extractedData.s3Key,
      pdfS3Bucket: parseResult.extractedData.s3Bucket,
      pdfUploadedAt: new Date().toISOString()
    }

    console.log('invoiceData to be sent:', invoiceData)
    console.log('=== END DEBUG ===')

    onInvoiceCreate(invoiceData)
  }

  const resetUpload = () => {
    setParseResult(null)
    setEditableData({})
    setConfirmedFields({})
    setConfirmedValues({})
    setError(null)
    setUploadedFile(null)

    // Clean up the preview URL to prevent memory leaks
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(null)
    }
  }

  const getFieldsWithConfidence = (): FieldDefinition[] => {
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
        type: 'text',
        required: true
      },
      {
        key: 'customerName',
        label: 'Customer Name',
        placeholder: 'ABC Trading LLC',
        value: editableData.customerName || '',
        extractedValue: extracted.customerName || '',
        confidence: extracted.customerName ? 90 : 0,
        type: 'text',
        required: true
      },
      {
        key: 'customerEmail',
        label: 'Email Address',
        placeholder: 'ahmad@abctrading.ae',
        value: editableData.customerEmail || '',
        extractedValue: extracted.customerEmail || '',
        confidence: extracted.customerEmail ? 85 : 0,
        type: 'email',
        required: true
      },
      {
        key: 'totalAmount',
        label: 'Invoice Amount',
        placeholder: '5250.00',
        // Use nullish coalescing to allow empty string values (user clearing the field)
        value: editableData.totalAmount !== undefined ? editableData.totalAmount : (editableData.amount ?? ''),
        extractedValue: extracted.totalAmount ?? extracted.amount ?? '',
        confidence: (extracted.totalAmount || extracted.amount) ? 90 : 0,
        type: 'number',
        required: true
      },
      {
        key: 'currency',
        label: 'Currency',
        placeholder: 'AED',
        value: editableData.currency || 'AED',
        extractedValue: extracted.currency || 'AED',
        confidence: 95,
        type: 'text',
        required: true
      },
      {
        key: 'invoiceDate',
        label: 'Invoice Date',
        placeholder: '2024-11-15',
        value: editableData.invoiceDate || '',
        extractedValue: extracted.invoiceDate || '',
        confidence: extracted.invoiceDate ? 85 : 0,
        type: 'date',
        required: true
      },
      {
        key: 'dueDate',
        label: 'Due Date',
        placeholder: '2024-12-15',
        value: editableData.dueDate || '',
        extractedValue: extracted.dueDate || '',
        confidence: extracted.dueDate ? 80 : 0,
        type: 'date',
        required: true
      },
      {
        key: 'trn',
        label: 'TRN',
        placeholder: '100123456789012',
        value: editableData.trn || '',
        extractedValue: extracted.trn || '',
        confidence: extracted.trn ? 95 : 0,
        type: 'text',
        required: false
      },
      {
        key: 'description',
        label: 'Notes',
        placeholder: 'Invoice notes',
        value: editableData.description || '',
        extractedValue: extracted.description || '',
        confidence: extracted.description ? 70 : 0,
        type: 'textarea',
        required: false
      }
    ]
  }

  const allRequiredConfirmed = REQUIRED_FIELDS.every(field => confirmedFields[field])

  /**
   * Format date for display (YYYY-MM-DD -> DD/MM/YYYY)
   */
  const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return '-'
    // Parse YYYY-MM-DD format
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }

  const renderConfirmedValue = (field: FieldDefinition) => {
    const isConfirmed = confirmedFields[field.key]
    const value = confirmedValues[field.key as keyof ExtractedInvoiceData]

    // Format value based on field type
    const displayValue = (() => {
      if (!value) return '-'
      if (field.type === 'number') {
        return Number(value).toLocaleString('en-AE', { minimumFractionDigits: 2 })
      }
      if (field.type === 'date') {
        return formatDateForDisplay(value as string)
      }
      return value
    })()

    return (
      <div
        key={field.key}
        className={cn(
          "p-4 border rounded-lg bg-gray-50 flex flex-col",
          field.type === 'textarea' ? 'min-h-[120px]' : 'h-[100px]'
        )}
      >
        <Label className="text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="flex-1 flex items-center">
          {isConfirmed ? (
            <div className="text-sm font-semibold text-gray-900">
              {displayValue}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">Pending confirmation</div>
          )}
        </div>
      </div>
    )
  }

  const renderConfirmButton = (field: FieldDefinition) => {
    const buttonState = getFieldButtonState(field.key)
    const confidenceColor = field.confidence >= 95 ? 'text-green-600' :
                           field.confidence >= 70 ? 'text-orange-600' :
                           'text-red-600'

    return (
      <div
        key={field.key}
        className={cn(
          "p-4 flex items-center justify-center",
          field.type === 'textarea' ? 'min-h-[120px]' : 'h-[100px]'
        )}
      >
        <Button
          variant={buttonState.variant}
          size="sm"
          onClick={() => handleConfirmField(field.key)}
          disabled={buttonState.disabled}
          className={cn(
            "w-full",
            buttonState.icon && "bg-green-600 hover:bg-green-700 text-white"
          )}
        >
          {buttonState.icon ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Confirmed
            </>
          ) : (
            <>
              {field.confidence >= 95 ? (
                <CheckCircle className={cn("h-4 w-4 mr-1", confidenceColor)} />
              ) : field.confidence >= 70 ? (
                <AlertTriangle className={cn("h-4 w-4 mr-1", confidenceColor)} />
              ) : (
                <X className={cn("h-4 w-4 mr-1", confidenceColor)} />
              )}
              Confirm
            </>
          )}
        </Button>
      </div>
    )
  }

  const handleQuickDueDate = (days: number) => {
    const invoiceDate = editableData.invoiceDate
    if (!invoiceDate) return

    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + days)
    const formattedDueDate = dueDate.toISOString().split('T')[0] // YYYY-MM-DD format
    handleFieldEdit('dueDate', formattedDueDate)
  }

  const renderEditableField = (field: FieldDefinition) => {
    const confidenceColor = field.confidence >= 95 ? 'border-green-200 bg-green-50' :
                           field.confidence >= 70 ? 'border-orange-200 bg-orange-50' :
                           'border-red-200 bg-red-50'

    // Special handling for due date field with quick buttons
    const showQuickButtons = field.key === 'dueDate' && !field.extractedValue && editableData.invoiceDate

    return (
      <div
        key={field.key}
        className={cn(
          'p-4 rounded-lg border-2 flex flex-col',
          field.type === 'textarea' ? 'min-h-[120px]' : showQuickButtons ? 'min-h-[130px]' : 'h-[100px]',
          confidenceColor
        )}
      >
        <Label className="text-sm font-medium mb-2 block">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {field.type === 'textarea' ? (
          <Textarea
            value={field.value}
            onChange={(e) => handleFieldEdit(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="flex-1"
          />
        ) : (
          <>
            <Input
              type={field.type === 'number' ? 'text' : field.type}
              inputMode={field.type === 'number' ? 'decimal' : undefined}
              value={field.value === 0 ? '0' : field.value || ''}
              onChange={(e) => {
                if (field.type === 'number') {
                  const value = e.target.value
                  // Allow empty string, numbers with decimals, and partial decimals (e.g., "123.")
                  if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                    // Store as string while editing to preserve trailing decimals/zeros
                    // Convert to number only when needed for calculations
                    handleFieldEdit(field.key, value)
                  }
                } else {
                  handleFieldEdit(field.key, e.target.value)
                }
              }}
              placeholder={field.placeholder}
            />

            {showQuickButtons && (
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDueDate(30)}
                  className="flex-1 text-xs"
                >
                  +30 days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDueDate(60)}
                  className="flex-1 text-xs"
                >
                  +60 days
                </Button>
              </div>
            )}
          </>
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
      </div>
    )
  }

  const fields = getFieldsWithConfidence()

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
            Review and confirm the extracted data before importing the invoice
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
              <div className="text-lg font-semibold">
                {Object.keys(confirmedFields).filter(k => confirmedFields[k]).length}/{REQUIRED_FIELDS.length}
              </div>
              <div className="text-sm text-gray-500">Fields Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {fields.filter(f => f.confidence >= 95).length}/{fields.length}
              </div>
              <div className="text-sm text-gray-500">High Confidence</div>
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

      {/* Completion Message */}
      {allRequiredConfirmed && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-900">
                Invoice details complete
              </h3>
              <p className="text-sm text-green-700 mt-2">
                All required fields have been confirmed. Review optional fields below or save the invoice.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Three-Column Reconciliation Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review & Confirm Invoice Data
          </CardTitle>
          <CardDescription>
            Confirm each field by reviewing the AI-extracted value on the right. Edit if needed, then click Confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Column Headers */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 text-sm">Confirmed Values</h3>
                <p className="text-xs text-blue-700 mt-1">Values that will be saved</p>
              </div>
            </div>
            <div className="col-span-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <h3 className="font-medium text-gray-900 text-sm">Action</h3>
              </div>
            </div>
            <div className="col-span-6">
              <div className="p-3 bg-green-50 rounded-lg">
                <h3 className="font-medium text-green-900 text-sm">AI Extracted Data</h3>
                <p className="text-xs text-green-700 mt-1">Edit values if needed before confirming</p>
              </div>
            </div>
          </div>

          {/* All three columns - no scroll wrapper for better UX */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left Column - Confirmed Values (Read-only) */}
            <div className="col-span-4">
              <div className="space-y-3">
                {fields.map(field => renderConfirmedValue(field))}
              </div>
            </div>

            {/* Middle Column - Confirmation Buttons */}
            <div className="col-span-2">
              <div className="space-y-3">
                {fields.map(field => renderConfirmButton(field))}
              </div>
            </div>

            {/* Right Column - AI Extracted (Editable) */}
            <div className="col-span-6">
              <div className="space-y-3">
                {fields.map(field => renderEditableField(field))}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-600" />
                {fields.filter(f => f.confidence >= 95).length} High Confidence
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-orange-600" />
                {fields.filter(f => f.confidence >= 70 && f.confidence < 95).length} Review Needed
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <X className="h-3 w-3 text-red-600" />
                {fields.filter(f => f.confidence < 70).length} Manual Entry
              </Badge>
            </div>
            <div className="flex space-x-4">
              <Button variant="outline" onClick={resetUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload New PDF
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={isLoading || !allRequiredConfirmed}
                className="min-w-[150px]"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Import Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Extraction Data - Debug View */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Raw Extraction Data
          </CardTitle>
          <CardDescription className="text-xs">
            What Textract extracted from the PDF (for debugging)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Show raw data
            </summary>
            <div className="mt-4 space-y-4">
              {/* Processing Stats */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 text-xs">Confidence</div>
                  <div className="font-semibold">{parseResult?.extractedData?.confidence ?? 0}%</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 text-xs">Processing Time</div>
                  <div className="font-semibold">{parseResult?.extractedData?.processingTimeMs ?? 0}ms</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 text-xs">File Size</div>
                  <div className="font-semibold">{parseResult?.fileSize ? (parseResult.fileSize / 1024).toFixed(1) + ' KB' : '-'}</div>
                </div>
              </div>

              {/* Extracted Fields */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Field</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Extracted Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parseResult?.extractedData && Object.entries(parseResult.extractedData)
                      .filter(([key]) => !['rawText', 's3Bucket', 's3Key', 'processingTimeMs', 'confidence'].includes(key))
                      .map(([key, value]) => (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{key}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {value === null || value === undefined ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : typeof value === 'object' ? (
                              JSON.stringify(value)
                            ) : (
                              String(value)
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Raw Text Sample */}
              {parseResult?.extractedData?.rawText && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Raw Text (first 500 chars)</div>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {parseResult.extractedData.rawText.substring(0, 500)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* View Uploaded Invoice PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            View Invoice
          </CardTitle>
          <CardDescription>
            Preview of the uploaded invoice PDF
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details className="space-y-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Show invoice preview
            </summary>
            {pdfPreviewUrl && (
              <div className="mt-4 border rounded-lg overflow-hidden bg-gray-50">
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-[600px]"
                  title="Invoice PDF Preview"
                />
              </div>
            )}
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
