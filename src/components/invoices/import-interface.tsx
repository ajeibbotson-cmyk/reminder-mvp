'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileSpreadsheet, X, AlertCircle, Check, RefreshCw } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useImportBatchStore } from '@/lib/stores/import-batch-store'
import { cn } from '@/lib/utils'

interface ImportInterfaceProps {
  companyId: string
  onImportComplete?: (batchId: string) => void
  locale?: string
}

export function ImportInterface({ companyId, onImportComplete, locale = 'en' }: ImportInterfaceProps) {
  const t = useTranslations('import')
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { 
    uploadFile, 
    getProgress, 
    processImport,
    isLoading, 
    error,
    clearError 
  } = useImportBatchStore()

  // Poll for progress updates when batch is processing
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (currentBatchId && uploadProgress > 0 && uploadProgress < 100) {
      interval = setInterval(async () => {
        const progress = await getProgress(currentBatchId)
        if (progress) {
          setUploadProgress(progress.progress)
          if (progress.progress === 100) {
            setCurrentBatchId(null)
            onImportComplete?.(currentBatchId)
          }
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentBatchId, uploadProgress, getProgress, onImportComplete])

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
      if (isValidFile(file)) {
        setUploadedFile(file)
        clearError()
      }
    }
  }, [clearError])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (isValidFile(file)) {
        setUploadedFile(file)
        clearError()
      }
    }
  }, [clearError])

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    const validExtensions = ['.csv', '.xls', '.xlsx']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    return validTypes.includes(file.type) || validExtensions.includes(fileExtension)
  }

  const handleUpload = async () => {
    if (!uploadedFile) return

    try {
      // First upload the file
      const response = await uploadFile(uploadedFile, companyId)
      if (response.batchId) {
        setCurrentBatchId(response.batchId)
        setUploadProgress(10)
        
        // Then process the import
        await processImport(response.batchId, {
          hasHeaders: true,
          skipEmptyRows: true
        })
        
        setUploadProgress(20) // Processing started
      }
    } catch (err) {
      console.error('Upload failed:', err)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setUploadProgress(0)
    setCurrentBatchId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    clearError()
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn("space-y-6", locale === 'ar' && "text-right")}>
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              dragActive ? "border-primary bg-primary/10" : "border-gray-300",
              uploadedFile ? "border-green-500 bg-green-50" : ""
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
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium">
                    {t('dragDrop')}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {t('supportedFormats')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('maxSize')}
                  </p>
                </div>
                <Button variant="outline" className="mt-4">
                  {t('browseFiles')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <FileSpreadsheet className="h-8 w-8 text-green-500" />
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

                {uploadProgress > 0 && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span>{t('processing')}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    {uploadProgress < 100 && (
                      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t('analyzingFile')}</span>
                      </div>
                    )}
                  </div>
                )}

                {uploadProgress === 0 && (
                  <Button
                    onClick={handleUpload}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        {t('uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('startImport')}
                      </>
                    )}
                  </Button>
                )}

                {uploadProgress === 100 && (
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span>{t('importComplete')}</span>
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
          <CardTitle className="text-lg">{t('guidelines.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{t('guidelines.requiredFields')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'customerName',
                  'invoiceNumber', 
                  'amount',
                  'dueDate',
                  'customerEmail',
                  'customerPhone'
                ].map((field) => (
                  <Badge key={field} variant="outline" className="justify-start">
                    {t(`fields.${field}`)}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">{t('guidelines.uaeFormats')}</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• {t('guidelines.phoneFormat')}</li>
                <li>• {t('guidelines.dateFormat')}</li>
                <li>• {t('guidelines.amountFormat')}</li>
                <li>• {t('guidelines.trnFormat')}</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">{t('guidelines.tips')}</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• {t('guidelines.tip1')}</li>
                <li>• {t('guidelines.tip2')}</li>
                <li>• {t('guidelines.tip3')}</li>
                <li>• {t('guidelines.tip4')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}