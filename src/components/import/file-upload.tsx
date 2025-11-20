'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  Check,
  RefreshCw,
  FileText,
  Download,
  File
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileUpload: (file: File) => void
  isLoading?: boolean
  error?: string | null
  locale?: string
  acceptedFileTypes?: 'all' | 'spreadsheet' | 'pdf'
}

export function FileUpload({
  onFileUpload,
  isLoading = false,
  error,
  locale = 'en',
  acceptedFileTypes = 'all'
}: FileUploadProps) {
  const t = useTranslations('import')
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      handleFileSelection(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      handleFileSelection(file)
    }
  }, [])

  const handleFileSelection = async (file: File) => {
    const validation = validateFile(file)
    setValidationResult(validation)

    if (validation.isValid) {
      setUploadedFile(file)
      // Progress will be set during actual upload in handleUpload function
    }
  }

  const validateFile = (file: File): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } => {
    const errors: string[] = []
    const warnings: string[] = []

    // File type validation based on accepted types
    let validTypes: string[] = []
    let validExtensions: string[] = []

    switch (acceptedFileTypes) {
      case 'spreadsheet':
        validTypes = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
        validExtensions = ['.csv', '.xls', '.xlsx']
        break
      case 'pdf':
        validTypes = ['application/pdf']
        validExtensions = ['.pdf']
        break
      case 'all':
      default:
        validTypes = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/pdf'
        ]
        validExtensions = ['.csv', '.xls', '.xlsx', '.pdf']
        break
    }

    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      errors.push(t('fileValidation.invalidFileType'))
    }
    
    // File size validation (10MB limit)
    const maxSizeInBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSizeInBytes) {
      errors.push(t('fileValidation.fileTooLarge', { maxSize: '10MB' }))
    }
    
    // File size warnings
    const warningSize = 5 * 1024 * 1024 // 5MB
    if (file.size > warningSize && file.size <= maxSizeInBytes) {
      warnings.push(t('fileValidation.largeFileWarning'))
    }
    
    // File name validation
    if (file.name.includes('#') || file.name.includes('&') || file.name.includes('?')) {
      warnings.push(t('fileValidation.specialCharactersWarning'))
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  const handleUpload = async () => {
    if (!uploadedFile || !validationResult?.isValid) return

    try {
      // For PDF files, skip progress simulation and trigger immediately
      // The parent component will handle processing state
      await onFileUpload(uploadedFile)

    } catch (err) {
      console.error('Upload failed:', err)
      setUploadProgress(0)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setUploadProgress(0)
    setValidationResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const downloadTemplate = () => {
    const headers = [
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Customer TRN',
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Description',
      'Description (Arabic)',
      'Amount',
      'VAT Amount',
      'Total Amount',
      'Currency',
      'Payment Terms'
    ]
    
    const sampleRow = [
      'Emirates Trading LLC',
      'billing@emirates-trading.com',
      '+971 4 123 4567',
      '100123456789012',
      'INV-2025-001',
      '2025-01-15',
      '2025-02-14',
      'Professional consultation services',
      'خدمات الاستشارة المهنية',
      '5000.00',
      '250.00',
      '5250.00',
      'AED',
      '30 days'
    ]
    
    const csvContent = [
      headers.join(','),
      sampleRow.join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'uaepay_invoice_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className={cn("space-y-6", locale === 'ar' && "text-right")}>
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t('fileUpload.title')}
          </CardTitle>
          <CardDescription>
            {t('fileUpload.description')}
            <br />
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">
                  PDF Support: Upload invoice PDFs for automatic AI data extraction
                </span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200",
              dragActive ? "border-primary bg-primary/10 scale-[1.02]" : "border-gray-300",
              uploadedFile && validationResult?.isValid ? "border-green-500 bg-green-50" : "",
              uploadedFile && !validationResult?.isValid ? "border-red-500 bg-red-50" : "",
              isLoading && "pointer-events-none opacity-60"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              id="file-upload-input"
              type="file"
              accept={
                acceptedFileTypes === 'pdf' ? '.pdf' :
                acceptedFileTypes === 'spreadsheet' ? '.csv,.xlsx,.xls' :
                '.csv,.xlsx,.xls,.pdf'
              }
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLoading}
            />
            
            {!uploadedFile ? (
              <div className="space-y-4">
                <div className={cn(
                  "mx-auto h-16 w-16 transition-all duration-200",
                  dragActive && "scale-110"
                )}>
                  <Upload className={cn(
                    "h-full w-full transition-colors",
                    dragActive ? "text-primary" : "text-gray-400"
                  )} />
                </div>
                
                <div>
                  <p className="text-lg font-medium mb-2">
                    {dragActive ? t('fileUpload.dropHere') : t('fileUpload.dragDrop')}
                  </p>
                  <div className="text-sm text-gray-500 mb-4">
                    {acceptedFileTypes === 'pdf' ? (
                      <span className="inline-flex items-center gap-1">
                        <File className="h-4 w-4" />
                        PDF files only
                      </span>
                    ) : acceptedFileTypes === 'spreadsheet' ? (
                      <span className="inline-flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4" />
                        CSV, Excel (.xlsx, .xls)
                      </span>
                    ) : (
                      <div className="flex items-center justify-center gap-4">
                        <span className="inline-flex items-center gap-1">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          <span>CSV, Excel</span>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="inline-flex items-center gap-1">
                          <File className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-600">PDF</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    {t('fileUpload.maxSize')}
                  </p>
                </div>
                
                <label
                  htmlFor="file-upload-input"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    "h-10 px-4 py-2 mt-4 cursor-pointer"
                  )}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('fileUpload.browseFiles')}
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  {uploadedFile.name.toLowerCase().endsWith('.pdf') ? (
                    <File className={cn(
                      "h-8 w-8",
                      validationResult?.isValid ? "text-green-500" : "text-red-500"
                    )} />
                  ) : (
                    <FileSpreadsheet className={cn(
                      "h-8 w-8",
                      validationResult?.isValid ? "text-green-500" : "text-red-500"
                    )} />
                  )}
                  <div className="text-left">
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="ml-auto"
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Validation Results */}
                {validationResult && (
                  <div className="space-y-2">
                    {validationResult.errors.length > 0 && (
                      <Alert variant="destructive" className="text-left">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t('fileValidation.errorsFound')}</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1">
                            {validationResult.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <Alert className="text-left">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t('fileValidation.warningsFound')}</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1">
                            {validationResult.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validationResult.isValid && validationResult.warnings.length === 0 && (
                      <div className="flex items-center justify-center space-x-2 text-green-600 py-2">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">{t('fileValidation.fileValid')}</span>
                      </div>
                    )}
                  </div>
                )}

                {validationResult?.isValid && (
                  <Button
                    onClick={handleUpload}
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        {t('fileUpload.processing')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('fileUpload.startImport')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Import Guidelines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('guidelines.title')}</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t('guidelines.downloadTemplate')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Required Fields */}
            <div>
              <h4 className="font-medium mb-3 text-primary">{t('guidelines.requiredFields')}</h4>
              <div className="space-y-2">
                {[
                  { field: 'customerName', example: 'Emirates Trading LLC' },
                  { field: 'customerEmail', example: 'billing@company.ae' },
                  { field: 'invoiceNumber', example: 'INV-2025-001' },
                  { field: 'amount', example: '5000.00' },
                  { field: 'dueDate', example: '2025-02-14' }
                ].map(({ field, example }) => (
                  <div key={field} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                    <Badge variant="outline" className="text-xs">
                      {t(`fields.${field}`)}
                    </Badge>
                    <span className="text-gray-600 text-xs">{example}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* UAE Specific Guidelines */}
            <div>
              <h4 className="font-medium mb-3 text-primary">{t('guidelines.uaeSpecific')}</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  {t('guidelines.trnFormat')}
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  {t('guidelines.phoneFormat')}
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  {t('guidelines.currencyFormat')}
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  {t('guidelines.dateFormat')}
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  {t('guidelines.vatCalculation')}
                </li>
              </ul>
            </div>
          </div>

          {/* Tips Section */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium mb-3 text-primary">{t('guidelines.tips')}</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
              <ul className="space-y-1">
                <li>• {t('guidelines.tip1')}</li>
                <li>• {t('guidelines.tip2')}</li>
                <li>• {t('guidelines.tip3')}</li>
              </ul>
              <ul className="space-y-1">
                <li>• {t('guidelines.tip4')}</li>
                <li>• {t('guidelines.tip5')}</li>
                <li>• {t('guidelines.tip6')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}