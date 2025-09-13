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
  Download
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
}

export function FileUpload({ 
  onFileUpload, 
  isLoading = false, 
  error, 
  locale = 'en' 
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
      
      // Simulate file analysis progress
      if (validation.warnings.length === 0) {
        setUploadProgress(100)
      }
    }
  }

  const validateFile = (file: File): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } => {
    const errors: string[] = []
    const warnings: string[] = []
    
    // File type validation
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    const validExtensions = ['.csv', '.xls', '.xlsx']
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
      setUploadProgress(0)
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)
      
      await onFileUpload(uploadedFile)
      setUploadProgress(100)
      
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
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
                  <p className="text-sm text-gray-500 mb-4">
                    {t('fileUpload.supportedFormats')}
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    {t('fileUpload.maxSize')}
                  </p>
                </div>
                
                <Button variant="outline" className="mt-4">
                  <FileText className="h-4 w-4 mr-2" />
                  {t('fileUpload.browseFiles')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  <FileSpreadsheet className={cn(
                    "h-8 w-8",
                    validationResult?.isValid ? "text-green-500" : "text-red-500"
                  )} />
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

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span>{t('fileUpload.uploading')}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                {validationResult?.isValid && uploadProgress === 0 && (
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

                {uploadProgress === 100 && !isLoading && (
                  <div className="flex items-center justify-center space-x-2 text-green-600 py-4">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">{t('fileUpload.uploadComplete')}</span>
                  </div>
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