'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  FileText,
  Eye,
  EyeOff,
  Wand2,
  Zap
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from '@/lib/utils'

interface PDFExtractionResult {
  field: string
  value: string | null
  confidence: number
  rawValue?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

interface PDFSmartReconciliationProps {
  pdfFile: File
  extractedData: PDFExtractionResult[]
  onReconciliationComplete: (reconciled: Record<string, any>) => void
  locale?: string
}

const REQUIRED_FIELDS = [
  'customerName',
  'invoiceNumber',
  'amount',
  'dueDate'
] as const

const OPTIONAL_FIELDS = [
  'customerEmail',
  'customerPhone',
  'customerTrn',
  'description',
  'issueDate',
  'vatAmount',
  'totalAmount',
  'currency',
  'paymentTerms'
] as const

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const

type FieldType = typeof ALL_FIELDS[number]

interface FieldTemplate {
  key: FieldType
  label: string
  required: boolean
  placeholder: string
  uaeSpecific?: boolean
  validation?: RegExp | ((value: string) => boolean)
  format?: (value: string) => string
}

const FIELD_TEMPLATES: Record<FieldType, FieldTemplate> = {
  customerName: {
    key: 'customerName',
    label: 'Customer Name',
    required: true,
    placeholder: 'ABC Trading Company LLC'
  },
  invoiceNumber: {
    key: 'invoiceNumber',
    label: 'Invoice Number',
    required: true,
    placeholder: 'INV-2024-001'
  },
  amount: {
    key: 'amount',
    label: 'Invoice Amount',
    required: true,
    placeholder: '5,250.00',
    validation: (value) => !isNaN(parseFloat(value.replace(/,/g, ''))) && parseFloat(value.replace(/,/g, '')) > 0,
    format: (value) => parseFloat(value.replace(/,/g, '')).toLocaleString('en-AE', { minimumFractionDigits: 2 })
  },
  dueDate: {
    key: 'dueDate',
    label: 'Due Date',
    required: true,
    placeholder: '2024-12-15',
    validation: (value) => !isNaN(Date.parse(value))
  },
  customerEmail: {
    key: 'customerEmail',
    label: 'Email Address',
    required: false,
    placeholder: 'billing@company.ae',
    validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  customerPhone: {
    key: 'customerPhone',
    label: 'Phone Number',
    required: false,
    placeholder: '+971 50 123 4567',
    uaeSpecific: true,
    validation: /^(\+971|00971|971|0)?([2-9]\d{8}|5[0-9]\d{7})$/
  },
  customerTrn: {
    key: 'customerTrn',
    label: 'TRN',
    required: false,
    placeholder: '100123456789012',
    uaeSpecific: true,
    validation: /^\d{15}$/
  },
  description: {
    key: 'description',
    label: 'Description',
    required: false,
    placeholder: 'Professional consultation services'
  },
  issueDate: {
    key: 'issueDate',
    label: 'Invoice Date',
    required: false,
    placeholder: '2024-11-15',
    validation: (value) => !isNaN(Date.parse(value))
  },
  vatAmount: {
    key: 'vatAmount',
    label: 'VAT Amount',
    required: false,
    placeholder: '250.00',
    uaeSpecific: true,
    validation: (value) => !isNaN(parseFloat(value.replace(/,/g, ''))) && parseFloat(value.replace(/,/g, '')) >= 0,
    format: (value) => parseFloat(value.replace(/,/g, '')).toLocaleString('en-AE', { minimumFractionDigits: 2 })
  },
  totalAmount: {
    key: 'totalAmount',
    label: 'Total Amount',
    required: false,
    placeholder: '5,500.00',
    validation: (value) => !isNaN(parseFloat(value.replace(/,/g, ''))) && parseFloat(value.replace(/,/g, '')) > 0,
    format: (value) => parseFloat(value.replace(/,/g, '')).toLocaleString('en-AE', { minimumFractionDigits: 2 })
  },
  currency: {
    key: 'currency',
    label: 'Currency',
    required: false,
    placeholder: 'AED',
    validation: (value) => ['AED', 'USD', 'EUR', 'SAR', 'QAR'].includes(value.toUpperCase())
  },
  paymentTerms: {
    key: 'paymentTerms',
    label: 'Payment Terms',
    required: false,
    placeholder: 'Net 30'
  }
}

export function PDFSmartReconciliation({
  pdfFile,
  extractedData,
  onReconciliationComplete,
  locale = 'en'
}: PDFSmartReconciliationProps) {
  const t = useTranslations('smartReconciliation')
  const [reconciledData, setReconciledData] = useState<Record<string, any>>({})
  const [selectedTab, setSelectedTab] = useState<'reconciliation' | 'preview' | 'raw'>('reconciliation')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [autoAcceptThreshold, setAutoAcceptThreshold] = useState(95)

  // Initialize reconciled data with extracted values
  useEffect(() => {
    const initialData: Record<string, any> = {}

    extractedData.forEach(extraction => {
      const fieldKey = mapExtractionToField(extraction.field)
      if (fieldKey && extraction.value) {
        initialData[fieldKey] = {
          value: extraction.value,
          confidence: extraction.confidence,
          source: 'extracted',
          rawValue: extraction.rawValue || extraction.value
        }
      }
    })

    setReconciledData(initialData)
  }, [extractedData])

  // Map extraction field names to component field keys
  const mapExtractionToField = (extractionField: string): FieldType | null => {
    const mapping: Record<string, FieldType> = {
      'name': 'customerName',
      'customerName': 'customerName',
      'email': 'customerEmail',
      'phone': 'customerPhone',
      'trn': 'customerTrn',
      'invoiceNumber': 'invoiceNumber',
      'amount': 'amount',
      'dueDate': 'dueDate',
      'issueDate': 'issueDate',
      'vatAmount': 'vatAmount',
      'totalAmount': 'totalAmount',
      'currency': 'currency',
      'description': 'description',
      'paymentTerms': 'paymentTerms'
    }
    return mapping[extractionField] || null
  }

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 95) return 'high'
    if (confidence >= 70) return 'medium'
    return 'low'
  }

  const getConfidenceIcon = (confidence: number) => {
    const level = getConfidenceLevel(confidence)
    switch (level) {
      case 'high': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'medium': return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'low': return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    const level = getConfidenceLevel(confidence)
    const variant = level === 'high' ? 'default' : level === 'medium' ? 'outline' : 'destructive'
    return (
      <Badge variant={variant} className="text-xs">
        {confidence}%
      </Badge>
    )
  }

  const handleFieldEdit = (fieldKey: FieldType, newValue: string) => {
    setReconciledData(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        value: newValue,
        source: 'manual',
        confidence: prev[fieldKey]?.confidence || 0
      }
    }))

    // Clear validation error
    if (validationErrors[fieldKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldKey]
        return newErrors
      })
    }
  }

  const validateField = (fieldKey: FieldType, value: string): string | null => {
    const template = FIELD_TEMPLATES[fieldKey]

    if (template.required && !value.trim()) {
      return 'This field is required'
    }

    if (value.trim() && template.validation) {
      if (template.validation instanceof RegExp) {
        if (!template.validation.test(value)) {
          return `Invalid format for ${template.label}`
        }
      } else if (typeof template.validation === 'function') {
        if (!template.validation(value)) {
          return `Invalid value for ${template.label}`
        }
      }
    }

    return null
  }

  const handleAcceptAll = () => {
    // Auto-accept all high confidence extractions
    const autoAccepted: Record<string, any> = {}

    Object.entries(reconciledData).forEach(([fieldKey, data]) => {
      if (data.confidence >= autoAcceptThreshold) {
        autoAccepted[fieldKey] = data.value
      }
    })

    console.log(`Auto-accepted ${Object.keys(autoAccepted).length} fields with ${autoAcceptThreshold}%+ confidence`)
  }

  const handleProceed = () => {
    // Validate all fields
    const errors: Record<string, string> = {}

    Object.keys(FIELD_TEMPLATES).forEach(fieldKey => {
      const field = fieldKey as FieldType
      const data = reconciledData[field]
      const value = data?.value || ''

      const error = validateField(field, value)
      if (error) {
        errors[field] = error
      }
    })

    setValidationErrors(errors)

    if (Object.keys(errors).length === 0) {
      // Convert to final format
      const finalData: Record<string, any> = {}

      Object.entries(reconciledData).forEach(([fieldKey, data]) => {
        if (data?.value) {
          const template = FIELD_TEMPLATES[fieldKey as FieldType]
          finalData[fieldKey] = template.format ? template.format(data.value) : data.value
        }
      })

      onReconciliationComplete(finalData)
    }
  }

  const getExtractionStats = () => {
    const total = Object.keys(FIELD_TEMPLATES).length
    const extracted = Object.keys(reconciledData).length
    const highConfidence = Object.values(reconciledData).filter(data => data.confidence >= 95).length
    const mediumConfidence = Object.values(reconciledData).filter(data => data.confidence >= 70 && data.confidence < 95).length

    return { total, extracted, highConfidence, mediumConfidence }
  }

  const stats = getExtractionStats()

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", locale === 'ar' && "text-right")}>
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Smart PDF Reconciliation
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {pdfFile.name} • {(pdfFile.size / 1024).toFixed(1)} KB
            </CardDescription>
            <div className="flex items-center gap-4 pt-2">
              <Badge variant="default">
                ✅ Extracted: {stats.extracted}/{stats.total}
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-300">
                High: {stats.highConfidence}
              </Badge>
              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                Medium: {stats.mediumConfidence}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={(tab) => setSelectedTab(tab as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reconciliation" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Smart Reconciliation
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="raw" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Raw Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reconciliation" className="space-y-6">
            {/* Auto Accept Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Manage extracted data efficiently</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="threshold">Auto-accept threshold:</Label>
                    <Input
                      id="threshold"
                      type="number"
                      min="70"
                      max="100"
                      value={autoAcceptThreshold}
                      onChange={(e) => setAutoAcceptThreshold(parseInt(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <Button variant="outline" onClick={handleAcceptAll}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Accept All ({stats.highConfidence} fields)
                </Button>
              </CardContent>
            </Card>

            {/* Field Reconciliation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel - Template Fields */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Required Invoice Fields</CardTitle>
                  <CardDescription>Template with expected data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.values(FIELD_TEMPLATES).map(template => (
                    <div key={template.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          {template.label}
                          {template.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          {template.uaeSpecific && <Badge variant="outline" className="text-xs border-green-500 text-green-700">UAE</Badge>}
                        </Label>
                      </div>
                      <Input
                        placeholder={template.placeholder}
                        value=""
                        disabled
                        className="text-gray-500 bg-gray-50"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Right Panel - Extracted Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extracted from PDF</CardTitle>
                  <CardDescription>AI-extracted data with confidence scores</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.values(FIELD_TEMPLATES).map(template => {
                    const data = reconciledData[template.key]
                    const hasError = validationErrors[template.key]

                    return (
                      <div key={template.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            {template.label}
                            {data?.confidence && getConfidenceIcon(data.confidence)}
                            {data?.confidence && getConfidenceBadge(data.confidence)}
                          </Label>
                        </div>
                        <Input
                          placeholder={data ? `Extracted: ${data.rawValue || data.value}` : "Not found"}
                          value={data?.value || ''}
                          onChange={(e) => handleFieldEdit(template.key, e.target.value)}
                          className={cn(
                            data?.confidence >= 95 && "border-green-300 bg-green-50/30",
                            data?.confidence >= 70 && data?.confidence < 95 && "border-yellow-300 bg-yellow-50/30",
                            data?.confidence < 70 && "border-red-300 bg-red-50/30",
                            hasError && "border-red-500",
                            !data && "bg-gray-50 text-gray-400"
                          )}
                        />
                        {hasError && (
                          <div className="text-red-500 text-xs">
                            {hasError}
                          </div>
                        )}
                        {data?.confidence && (
                          <div className="text-xs text-gray-600">
                            Confidence: {data.confidence}% • Source: {data.source}
                            {data.rawValue && data.rawValue !== data.value && (
                              <span className="ml-2">• Original: "{data.rawValue}"</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reconciliation Preview</CardTitle>
                <CardDescription>Final data that will be imported</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(reconciledData).map(([fieldKey, data]) => {
                      const template = FIELD_TEMPLATES[fieldKey as FieldType]
                      return (
                        <TableRow key={fieldKey}>
                          <TableCell className="font-medium">{template.label}</TableCell>
                          <TableCell>{data?.value || '-'}</TableCell>
                          <TableCell>
                            {data?.confidence ? getConfidenceBadge(data.confidence) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={data?.source === 'extracted' ? 'default' : 'outline'}>
                              {data?.source || 'none'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Raw Extraction Data</CardTitle>
                <CardDescription>Original PDF extraction results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {extractedData.map((extraction, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{extraction.field}</span>
                        <div className="flex items-center gap-2">
                          {getConfidenceIcon(extraction.confidence)}
                          {getConfidenceBadge(extraction.confidence)}
                        </div>
                      </div>
                      <div className="text-sm">
                        <strong>Value:</strong> {extraction.value || 'null'}
                      </div>
                      {extraction.rawValue && extraction.rawValue !== extraction.value && (
                        <div className="text-xs text-gray-600">
                          <strong>Raw:</strong> {extraction.rawValue}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={handleAcceptAll}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Accept All High Confidence
          </Button>
          <Button onClick={handleProceed}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Proceed with Import
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}