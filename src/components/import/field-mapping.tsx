'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Download,
  Wand2,
  Eye,
  EyeOff,
  Info
} from 'lucide-react'
import { validateInvoiceRowData } from '@/lib/validation/uae-validation'
import { suggestFieldMappings, validateFieldMappings } from '@/lib/import/import-utils'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from '@/lib/utils'

interface FieldMappingProps {
  batchId: string
  csvHeaders: string[]
  sampleData: Record<string, any>[]
  onMappingComplete: (mappings: Record<string, string>) => void
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
  'descriptionAr',
  'issueDate',
  'vatAmount',
  'totalAmount',
  'currency',
  'paymentTerms'
] as const

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const

type FieldType = typeof ALL_FIELDS[number]

interface FieldConfig {
  key: FieldType
  required: boolean
  validation?: (value: any) => { isValid: boolean; message?: string }
  format?: (value: any) => string
  description?: string
  uaeSpecific?: boolean
}

interface ValidationResult {
  field: FieldType
  errors: string[]
  warnings: string[]
  sampleValues: { value: any; isValid: boolean; message?: string }[]
}

export function FieldMapping({ 
  batchId, 
  csvHeaders, 
  sampleData, 
  onMappingComplete, 
  locale = 'en' 
}: FieldMappingProps) {
  const t = useTranslations('fieldMapping')
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [autoMapEnabled, setAutoMapEnabled] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'mapping' | 'preview' | 'validation'>('mapping')

  const fieldConfigs: Record<FieldType, FieldConfig> = {
    customerName: { 
      key: 'customerName', 
      required: true,
      description: 'Full business or individual name'
    },
    invoiceNumber: { 
      key: 'invoiceNumber', 
      required: true,
      description: 'Unique identifier for the invoice'
    },
    amount: { 
      key: 'amount', 
      required: true,
      validation: (value) => {
        const num = parseFloat(value)
        if (isNaN(num)) return { isValid: false, message: 'Must be a valid number' }
        if (num <= 0) return { isValid: false, message: 'Must be greater than zero' }
        return { isValid: true }
      },
      format: (value) => parseFloat(value).toFixed(2),
      description: 'Invoice amount excluding VAT'
    },
    dueDate: { 
      key: 'dueDate', 
      required: true,
      validation: (value) => {
        const date = new Date(value)
        if (isNaN(date.getTime())) return { isValid: false, message: 'Invalid date format' }
        if (date < new Date()) return { isValid: false, message: 'Due date should be in the future' }
        return { isValid: true }
      },
      description: 'Payment due date (YYYY-MM-DD format preferred)'
    },
    customerEmail: { 
      key: 'customerEmail', 
      required: false,
      validation: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) return { isValid: false, message: 'Invalid email format' }
        return { isValid: true }
      },
      description: 'Customer email address for invoice delivery'
    },
    customerPhone: { 
      key: 'customerPhone', 
      required: false,
      validation: (value) => {
        // UAE phone number format
        const uaePhoneRegex = /^(\+971|00971|971|0)?([2-9]\d{8}|5[0-9]\d{7})$/
        const cleaned = value.replace(/\s|-/g, '')
        if (!uaePhoneRegex.test(cleaned)) {
          return { isValid: false, message: 'Invalid UAE phone format' }
        }
        return { isValid: true }
      },
      uaeSpecific: true,
      description: 'UAE mobile or landline number'
    },
    customerTrn: { 
      key: 'customerTrn', 
      required: false,
      validation: (value) => {
        const trnRegex = /^\d{15}$/
        if (!trnRegex.test(value)) {
          return { isValid: false, message: 'TRN must be exactly 15 digits' }
        }
        return { isValid: true }
      },
      uaeSpecific: true,
      description: 'UAE Tax Registration Number (15 digits)'
    },
    description: { 
      key: 'description', 
      required: false,
      description: 'Invoice description in English'
    },
    descriptionAr: { 
      key: 'descriptionAr', 
      required: false,
      uaeSpecific: true,
      description: 'Invoice description in Arabic'
    },
    issueDate: { 
      key: 'issueDate', 
      required: false,
      validation: (value) => {
        const date = new Date(value)
        if (isNaN(date.getTime())) return { isValid: false, message: 'Invalid date format' }
        return { isValid: true }
      },
      description: 'Invoice issue date (defaults to today if empty)'
    },
    vatAmount: { 
      key: 'vatAmount', 
      required: false,
      validation: (value) => {
        const num = parseFloat(value)
        if (isNaN(num)) return { isValid: false, message: 'Must be a valid number' }
        if (num < 0) return { isValid: false, message: 'VAT amount cannot be negative' }
        return { isValid: true }
      },
      uaeSpecific: true,
      description: 'VAT amount (5% for UAE, auto-calculated if empty)'
    },
    totalAmount: { 
      key: 'totalAmount', 
      required: false,
      validation: (value) => {
        const num = parseFloat(value)
        if (isNaN(num)) return { isValid: false, message: 'Must be a valid number' }
        if (num <= 0) return { isValid: false, message: 'Must be greater than zero' }
        return { isValid: true }
      },
      description: 'Total amount including VAT'
    },
    currency: { 
      key: 'currency', 
      required: false,
      validation: (value) => {
        const validCurrencies = ['AED', 'USD', 'EUR', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR']
        if (!validCurrencies.includes(value.toUpperCase())) {
          return { isValid: false, message: 'Unsupported currency' }
        }
        return { isValid: true }
      },
      description: 'Currency code (defaults to AED for UAE)'
    },
    paymentTerms: { 
      key: 'paymentTerms', 
      required: false,
      description: 'Payment terms (e.g., "30 days", "Net 15")'
    }
  }

  // Auto-suggest mappings based on header names
  useEffect(() => {
    if (!autoMapEnabled) return
    
    const autoMappings = suggestFieldMappings(csvHeaders)
    setMappings(autoMappings)
  }, [csvHeaders, autoMapEnabled])

  const handleMappingChange = (fieldKey: FieldType, csvHeader: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldKey]: csvHeader === 'none' ? '' : csvHeader
    }))
    
    // Clear validation for this field
    setValidationResults(prev => 
      prev.filter(result => result.field !== fieldKey)
    )
  }

  const validateMappings = async () => {
    setIsValidating(true)
    setSelectedTab('validation')
    
    // First validate field mappings
    const mappingValidation = validateFieldMappings(mappings, csvHeaders)
    
    const results: ValidationResult[] = []

    // Add mapping validation errors
    if (!mappingValidation.isValid) {
      mappingValidation.errors.forEach(error => {
        results.push({
          field: 'mapping' as FieldType,
          errors: [error],
          warnings: [],
          sampleValues: []
        })
      })
    }

    // Add mapping warnings
    if (mappingValidation.warnings.length > 0) {
      results.push({
        field: 'mapping' as FieldType,
        errors: [],
        warnings: mappingValidation.warnings,
        sampleValues: []
      })
    }

    // Validate sample data using UAE validation
    const validationConfig = {
      strictMode: false,
      autoCorrect: true,
      defaultCurrency: 'AED',
      vatRate: 0.05
    }

    sampleData.forEach((row, index) => {
      const rowValidation = validateInvoiceRowData(row, mappings, validationConfig)
      
      if (!rowValidation.isValid || rowValidation.warnings.length > 0) {
        rowValidation.errors.forEach(error => {
          const existingResult = results.find(r => r.field === error.field)
          if (existingResult) {
            existingResult.errors.push(`Row ${index + 2}: ${error.message}`)
          } else {
            results.push({
              field: error.field as FieldType,
              errors: [`Row ${index + 2}: ${error.message}`],
              warnings: [],
              sampleValues: []
            })
          }
        })

        rowValidation.warnings.forEach(warning => {
          const existingResult = results.find(r => r.field === warning.field)
          if (existingResult) {
            existingResult.warnings.push(`Row ${index + 2}: ${warning.message}`)
          } else {
            results.push({
              field: warning.field as FieldType,
              errors: [],
              warnings: [`Row ${index + 2}: ${warning.message}`],
              sampleValues: []
            })
          }
        })
      }
    })

    setValidationResults(results)
    setIsValidating(false)

    const hasErrors = results.some(result => result.errors.length > 0)
    
    if (!hasErrors) {
      onMappingComplete(mappings)
    }
  }

  const downloadTemplate = () => {
    const headers = ALL_FIELDS.map(field => t(`fields.${field}`))
    const sampleRow = [
      'Emirates Trading LLC',
      'INV-2025-001',
      '5000.00',
      '2025-02-14',
      'billing@emirates-trading.com',
      '+971 4 123 4567',
      '100123456789012',
      'Professional consultation services',
      'خدمات الاستشارة المهنية',
      '2025-01-15',
      '250.00',
      '5250.00',
      'AED',
      '30 days'
    ]
    
    const csvContent = headers.join(',') + '\n' + sampleRow.join(',')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'uaepay_invoice_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getMappedFieldsCount = () => {
    return Object.values(mappings).filter(Boolean).length
  }

  const getRequiredFieldsCount = () => {
    return REQUIRED_FIELDS.filter(field => mappings[field]).length
  }

  const getValidationSummary = () => {
    const totalErrors = validationResults.reduce((sum, result) => sum + result.errors.length, 0)
    const totalWarnings = validationResults.reduce((sum, result) => sum + result.warnings.length, 0)
    const fieldsWithIssues = validationResults.filter(result => 
      result.errors.length > 0 || result.warnings.length > 0
    ).length
    
    return { totalErrors, totalWarnings, fieldsWithIssues }
  }

  const resetAutoMapping = () => {
    setMappings({})
    setValidationResults([])
    setAutoMapEnabled(true)
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", locale === 'ar' && "text-right")}>
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <CardDescription>
              {t('description')}
            </CardDescription>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <Badge variant={getRequiredFieldsCount() === REQUIRED_FIELDS.length ? "default" : "destructive"}>
                  {t('requiredFields')}: {getRequiredFieldsCount()}/{REQUIRED_FIELDS.length}
                </Badge>
                <Badge variant="outline">
                  {t('totalMapped')}: {getMappedFieldsCount()}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-mapping"
                    checked={autoMapEnabled}
                    onCheckedChange={setAutoMapEnabled}
                  />
                  <Label htmlFor="auto-mapping" className="text-sm">
                    {t('autoMapping')}
                  </Label>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={resetAutoMapping}>
                      <Wand2 className="h-4 w-4 mr-1" />
                      {t('resetMapping')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('resetMappingTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-1" />
                  {t('downloadTemplate')}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Content Tabs */}
        <Tabs value={selectedTab} onValueChange={(tab) => setSelectedTab(tab as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mapping" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              {t('tabs.mapping')}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              {showPreview ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {t('tabs.preview')}
            </TabsTrigger>
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t('tabs.validation')}
              {validationResults.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {getValidationSummary().fieldsWithIssues}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mapping" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {ALL_FIELDS.map(field => {
                const config = fieldConfigs[field]
                const validationResult = validationResults.find(r => r.field === field)
                const hasError = validationResult?.errors.length ?? 0 > 0
                
                return (
                  <Card key={field} className={cn(
                    "transition-all duration-200",
                    hasError && "border-red-300 bg-red-50/30",
                    config.required && !mappings[field] && "border-orange-300 bg-orange-50/30"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {t(`fields.${field}`)}
                          {config.required && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                              Required
                            </Badge>
                          )}
                          {config.uaeSpecific && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-green-500 text-green-700">
                              UAE
                            </Badge>
                          )}
                        </CardTitle>
                        {config.description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-gray-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{config.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Select
                        value={mappings[field] || 'none'}
                        onValueChange={(value) => handleMappingChange(field, value)}
                      >
                        <SelectTrigger className={cn(hasError && "border-red-500")}>
                          <SelectValue placeholder={t('selectColumn')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('doNotMap')}</SelectItem>
                          {csvHeaders.map(header => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {hasError && (
                        <div className="mt-2 text-red-500 text-xs">
                          {validationResult!.errors.slice(0, 2).map((error, index) => (
                            <div key={index}>• {error}</div>
                          ))}
                        </div>
                      )}
                      
                      {mappings[field] && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">Sample:</span>{' '}
                          {sampleData.slice(0, 2).map(row => row[mappings[field]]).filter(Boolean).join(', ') || 'No data'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {t('dataPreview')}
                </CardTitle>
                <CardDescription>
                  {t('dataPreviewDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">{t('csvColumn')}</TableHead>
                        <TableHead className="w-32">{t('mappedField')}</TableHead>
                        <TableHead>{t('sampleValues')}</TableHead>
                        <TableHead className="w-20">{t('status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvHeaders.map(header => {
                        const mappedField = Object.entries(mappings).find(([_, csvHeader]) => csvHeader === header)?.[0]
                        const sampleValues = sampleData.slice(0, 3).map(row => row[header]).filter(Boolean)
                        const validationResult = mappedField ? validationResults.find(r => r.field === mappedField) : null
                        const hasError = validationResult?.errors.length ?? 0 > 0
                        
                        return (
                          <TableRow key={header} className={cn(hasError && "bg-red-50")}>
                            <TableCell className="font-medium">{header}</TableCell>
                            <TableCell>
                              {mappedField ? (
                                <Badge variant={hasError ? "destructive" : "outline"}>
                                  {t(`fields.${mappedField}`)}
                                </Badge>
                              ) : (
                                <span className="text-sm text-gray-400">{t('notMapped')}</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-sm text-gray-600 truncate">
                                {sampleValues.length > 0 ? sampleValues.join(', ') : t('noData')}
                              </div>
                            </TableCell>
                            <TableCell>
                              {hasError ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : mappedField ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="h-4 w-4" />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            {validationResults.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('noValidationResultsYet')}</p>
                  <p className="text-sm mt-2">{t('clickValidateToSeeResults')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Validation Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      {t('validationSummary')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {getValidationSummary().totalErrors}
                        </div>
                        <div className="text-sm text-gray-500">{t('errors')}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">
                          {getValidationSummary().totalWarnings}
                        </div>
                        <div className="text-sm text-gray-500">{t('warnings')}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {getValidationSummary().fieldsWithIssues}
                        </div>
                        <div className="text-sm text-gray-500">{t('fieldsWithIssues')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Validation Details */}
                {validationResults.map(result => (
                  <Card key={result.field} className={cn(
                    result.errors.length > 0 && "border-red-300"
                  )}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        {result.errors.length > 0 ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {t(`fields.${result.field}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.errors.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTitle>{t('errorsFound')}</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {result.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {result.sampleValues.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">{t('sampleValidation')}</h4>
                          <div className="space-y-1">
                            {result.sampleValues.map((sample, index) => (
                              <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                                <span className="font-mono">{sample.value}</span>
                                <div className="flex items-center gap-2">
                                  {sample.isValid ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                      <span className="text-red-600 text-xs">{sample.message}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            {t('downloadTemplate')}
          </Button>
          <Button 
            onClick={validateMappings}
            disabled={isValidating || getRequiredFieldsCount() < REQUIRED_FIELDS.length}
          >
            {isValidating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                {t('validating')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('validateAndProceed')}
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}