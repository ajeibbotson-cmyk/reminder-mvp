'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle, AlertCircle, RefreshCw, Download } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  validation?: (value: any) => boolean
  format?: (value: any) => string
  description?: string
}

export function FieldMapping({ batchId, csvHeaders, sampleData, onMappingComplete, locale = 'en' }: FieldMappingProps) {
  const t = useTranslations('fieldMapping')
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({})
  const [isValidating, setIsValidating] = useState(false)

  const fieldConfigs: Record<FieldType, FieldConfig> = {
    customerName: { key: 'customerName', required: true },
    invoiceNumber: { key: 'invoiceNumber', required: true },
    amount: { 
      key: 'amount', 
      required: true,
      validation: (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0,
      format: (value) => parseFloat(value).toFixed(2)
    },
    dueDate: { 
      key: 'dueDate', 
      required: true,
      validation: (value) => !isNaN(Date.parse(value))
    },
    customerEmail: { 
      key: 'customerEmail', 
      required: false,
      validation: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    },
    customerPhone: { 
      key: 'customerPhone', 
      required: false,
      validation: (value) => /^(\+971|0)(2|3|4|5|6|7|9|50|51|52|53|54|55|56|58)\d{7}$/.test(value.replace(/\s/g, ''))
    },
    customerTrn: { 
      key: 'customerTrn', 
      required: false,
      validation: (value) => /^\d{15}$/.test(value)
    },
    description: { key: 'description', required: false },
    issueDate: { 
      key: 'issueDate', 
      required: false,
      validation: (value) => !isNaN(Date.parse(value))
    },
    vatAmount: { 
      key: 'vatAmount', 
      required: false,
      validation: (value) => !isNaN(parseFloat(value)) && parseFloat(value) >= 0
    },
    totalAmount: { 
      key: 'totalAmount', 
      required: false,
      validation: (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0
    },
    currency: { key: 'currency', required: false },
    paymentTerms: { key: 'paymentTerms', required: false }
  }

  // Auto-suggest mappings based on header names
  useEffect(() => {
    const autoMappings: Record<string, string> = {}
    
    csvHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      // Auto-mapping logic
      const mappingRules: Record<string, FieldType> = {
        'customername': 'customerName',
        'customer': 'customerName',
        'clientname': 'customerName',
        'name': 'customerName',
        'invoicenumber': 'invoiceNumber',
        'invoice': 'invoiceNumber',
        'number': 'invoiceNumber',
        'invoiceno': 'invoiceNumber',
        'amount': 'amount',
        'total': 'totalAmount',
        'totalamount': 'totalAmount',
        'duedate': 'dueDate',
        'due': 'dueDate',
        'paymentdue': 'dueDate',
        'email': 'customerEmail',
        'customeremail': 'customerEmail',
        'emailaddress': 'customerEmail',
        'phone': 'customerPhone',
        'customerphone': 'customerPhone',
        'phonenumber': 'customerPhone',
        'mobile': 'customerPhone',
        'trn': 'customerTrn',
        'customertrn': 'customerTrn',
        'taxnumber': 'customerTrn',
        'description': 'description',
        'desc': 'description',
        'details': 'description',
        'issuedate': 'issueDate',
        'invoicedate': 'issueDate',
        'date': 'issueDate',
        'vat': 'vatAmount',
        'vatamount': 'vatAmount',
        'tax': 'vatAmount',
        'currency': 'currency',
        'paymentterms': 'paymentTerms',
        'terms': 'paymentTerms'
      }

      const matchedField = mappingRules[lowerHeader]
      if (matchedField && !autoMappings[matchedField]) {
        autoMappings[matchedField] = header
      }
    })

    setMappings(autoMappings)
  }, [csvHeaders])

  const handleMappingChange = (fieldKey: FieldType, csvHeader: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldKey]: csvHeader === 'none' ? '' : csvHeader
    }))
    
    // Clear validation errors for this field
    if (validationErrors[fieldKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldKey]
        return newErrors
      })
    }
  }

  const validateMappings = async () => {
    setIsValidating(true)
    const errors: Record<string, string[]> = {}

    // Check required fields
    REQUIRED_FIELDS.forEach(field => {
      if (!mappings[field]) {
        errors[field] = errors[field] || []
        errors[field].push(t('errors.fieldRequired'))
      }
    })

    // Validate sample data for each mapped field
    Object.entries(mappings).forEach(([fieldKey, csvHeader]) => {
      if (!csvHeader) return
      
      const fieldConfig = fieldConfigs[fieldKey as FieldType]
      if (!fieldConfig.validation) return

      const fieldErrors: string[] = []
      
      sampleData.forEach((row, index) => {
        const value = row[csvHeader]
        if (value !== null && value !== undefined && value !== '' && !fieldConfig.validation!(value)) {
          fieldErrors.push(t('errors.invalidValue', { row: index + 1, value: String(value) }))
        }
      })

      if (fieldErrors.length > 0) {
        errors[fieldKey] = fieldErrors.slice(0, 3) // Show only first 3 errors
        if (fieldErrors.length > 3) {
          errors[fieldKey].push(t('errors.moreErrors', { count: fieldErrors.length - 3 }))
        }
      }
    })

    setValidationErrors(errors)
    setIsValidating(false)

    const hasErrors = Object.keys(errors).length > 0
    if (!hasErrors) {
      onMappingComplete(mappings)
    }
  }

  const downloadTemplate = () => {
    const headers = ALL_FIELDS.map(field => t(`fields.${field}`))
    const csvContent = headers.join(',') + '\n' + 
      t('sampleRow.customerName') + ',' +
      t('sampleRow.invoiceNumber') + ',' +
      t('sampleRow.amount') + ',' +
      t('sampleRow.dueDate') + ',' +
      t('sampleRow.customerEmail') + ',' +
      t('sampleRow.customerPhone') + ',' +
      t('sampleRow.customerTrn') + ',' +
      t('sampleRow.description') + ',' +
      t('sampleRow.issueDate') + ',' +
      t('sampleRow.vatAmount') + ',' +
      t('sampleRow.totalAmount') + ',' +
      'AED,' +
      t('sampleRow.paymentTerms')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'invoice_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getMappedFieldsCount = () => {
    return Object.values(mappings).filter(Boolean).length
  }

  const getRequiredFieldsCount = () => {
    return REQUIRED_FIELDS.filter(field => mappings[field]).length
  }

  return (
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
          <div className="flex items-center gap-4 pt-2">
            <Badge variant={getRequiredFieldsCount() === REQUIRED_FIELDS.length ? "default" : "destructive"}>
              {t('requiredFields')}: {getRequiredFieldsCount()}/{REQUIRED_FIELDS.length}
            </Badge>
            <Badge variant="outline">
              {t('totalMapped')}: {getMappedFieldsCount()}
            </Badge>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t('downloadTemplate')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Field Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('fieldMapping')}</CardTitle>
            <CardDescription>{t('fieldMappingDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ALL_FIELDS.map(field => {
              const config = fieldConfigs[field]
              const hasError = validationErrors[field]
              
              return (
                <div key={field} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      {t(`fields.${field}`)}
                      {config.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </label>
                  </div>
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
                    <div className="text-red-500 text-xs space-y-1">
                      {hasError.map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dataPreview')}</CardTitle>
            <CardDescription>{t('dataPreviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">{t('csvColumn')}</TableHead>
                    <TableHead>{t('sampleValues')}</TableHead>
                    <TableHead>{t('mappedTo')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map(header => {
                    const mappedField = Object.entries(mappings).find(([_, csvHeader]) => csvHeader === header)?.[0]
                    const sampleValues = sampleData.slice(0, 3).map(row => row[header]).filter(Boolean)
                    
                    return (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {sampleValues.length > 0 ? sampleValues.join(', ') : t('noData')}
                        </TableCell>
                        <TableCell>
                          {mappedField ? (
                            <Badge variant="outline">
                              {t(`fields.${mappedField}`)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">{t('notMapped')}</span>
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
      </div>

      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('validationErrors')}</AlertTitle>
          <AlertDescription>
            {t('validationErrorsDesc')}
          </AlertDescription>
        </Alert>
      )}

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
              {t('proceedImport')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}