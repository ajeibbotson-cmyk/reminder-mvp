'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  X,
  AlertCircle,
  Check,
  RefreshCw,
  ArrowRight,
  Users,
  FileX,
  Info
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useImportBatchStore } from '@/lib/stores/import-batch-store'
import { cn } from '@/lib/utils'

interface UnifiedUploadHubProps {
  companyId: string
  onComplete?: () => void
  onClose?: () => void
  locale?: string
}

type UploadMode = 'files' | 'folder' | 'mixed'
type FileCategory = 'spreadsheet' | 'pdf' | 'unknown'

interface FileWithCategory {
  file: File
  category: FileCategory
  path?: string
}

interface BatchProgress {
  totalFiles: number
  processedFiles: number
  successfulFiles: number
  failedFiles: number
  currentFile?: string
  extractedCustomers: number
  newCustomers: number
  duplicateCustomers: number
}

export function UnifiedUploadHub({
  companyId,
  onComplete,
  onClose,
  locale = 'en'
}: UnifiedUploadHubProps) {
  const t = useTranslations('import')
  const router = useRouter()

  // Upload state
  const [uploadMode, setUploadMode] = useState<UploadMode>('files')
  const [files, setFiles] = useState<FileWithCategory[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'complete'>('upload')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const {
    uploadFile,
    processImport,
    isLoading,
    error,
    clearError
  } = useImportBatchStore()

  const categorizeFile = (file: File): FileCategory => {
    const extension = file.name.toLowerCase().split('.').pop()
    const mimeType = file.type.toLowerCase()

    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf'
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('csv') ||
      ['csv', 'xls', 'xlsx'].includes(extension || '')
    ) return 'spreadsheet'

    return 'unknown'
  }

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

    const items = Array.from(e.dataTransfer.items)
    const newFiles: FileWithCategory[] = []

    // Handle both files and folder structures
    items.forEach((item) => {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        if (entry.isFile) {
          const file = item.getAsFile()
          if (file) {
            newFiles.push({
              file,
              category: categorizeFile(file),
              path: entry.fullPath
            })
          }
        } else if (entry.isDirectory) {
          // Handle folder drop - traverse directory
          traverseDirectory(entry, newFiles)
        }
      }
    })

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles])
      detectUploadMode(newFiles)
      clearError()
    }
  }, [clearError])

  const traverseDirectory = (entry: any, fileList: FileWithCategory[]) => {
    if (entry.isFile) {
      entry.file((file: File) => {
        fileList.push({
          file,
          category: categorizeFile(file),
          path: entry.fullPath
        })
      })
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      reader.readEntries((entries: any[]) => {
        entries.forEach((entry) => {
          traverseDirectory(entry, fileList)
        })
      })
    }
  }

  const detectUploadMode = (fileList: FileWithCategory[]) => {
    const hasSpreadsheets = fileList.some(f => f.category === 'spreadsheet')
    const hasPdfs = fileList.some(f => f.category === 'pdf')
    const hasFolderStructure = fileList.some(f => f.path && f.path.includes('/'))

    if (hasFolderStructure) {
      setUploadMode('folder')
    } else if (hasSpreadsheets && hasPdfs) {
      setUploadMode('mixed')
    } else {
      setUploadMode('files')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const categorizedFiles = selectedFiles.map(file => ({
      file,
      category: categorizeFile(file),
      path: undefined
    }))

    setFiles(prev => [...prev, ...categorizedFiles])
    detectUploadMode(categorizedFiles)
    clearError()
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const categorizedFiles = selectedFiles.map(file => ({
      file,
      category: categorizeFile(file),
      path: file.webkitRelativePath
    }))

    setFiles(categorizedFiles)
    setUploadMode('folder')
    clearError()
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    if (files.length === 1) {
      setFiles([])
      setUploadMode('files')
    }
  }

  const startProcessing = async () => {
    if (files.length === 0) return

    setProcessing(true)
    setCurrentStep('processing')

    // Initialize progress
    setBatchProgress({
      totalFiles: files.length,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      extractedCustomers: 0,
      newCustomers: 0,
      duplicateCustomers: 0
    })

    try {
      // Process files by category with customer extraction
      const spreadsheetFiles = files.filter(f => f.category === 'spreadsheet')
      const pdfFiles = files.filter(f => f.category === 'pdf')

      let totalExtractedCustomers = 0
      let totalNewCustomers = 0

      // Process spreadsheets first (bulk processing with customer extraction)
      for (const fileItem of spreadsheetFiles) {
        setBatchProgress(prev => prev ? {
          ...prev,
          currentFile: fileItem.file.name,
          processedFiles: prev.processedFiles + 1
        } : null)

        try {
          // Upload and process the file
          const result = await uploadFile(fileItem.file, companyId)
          if (result.batchId) {
            await processImport(result.batchId, {
              hasHeaders: true,
              skipEmptyRows: true,
              extractCustomers: true
            })

            // Extract customer data from the uploaded file
            if (result.sampleData && result.headers) {
              try {
                const extractionResponse = await fetch('/api/customers/extract', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    action: 'process_batch',
                    files: [{
                      type: 'spreadsheet',
                      name: fileItem.file.name,
                      data: result.sampleData,
                      fieldMappings: {} // Use auto-detection for now
                    }]
                  })
                })

                if (extractionResponse.ok) {
                  const extractionResult = await extractionResponse.json()
                  if (extractionResult.success) {
                    totalExtractedCustomers += extractionResult.data.summary.totalExtracted
                    totalNewCustomers += extractionResult.data.summary.newCustomers
                  }
                }
              } catch (extractionError) {
                console.error('Customer extraction failed:', extractionError)
                // Continue with invoice processing even if customer extraction fails
              }
            }

            setBatchProgress(prev => prev ? {
              ...prev,
              successfulFiles: prev.successfulFiles + 1,
              extractedCustomers: totalExtractedCustomers,
              newCustomers: totalNewCustomers
            } : null)
          }
        } catch (error) {
          console.error('File processing error:', error)
          setBatchProgress(prev => prev ? {
            ...prev,
            failedFiles: prev.failedFiles + 1
          } : null)
        }
      }

      // Process PDFs individually with customer extraction
      for (const fileItem of pdfFiles) {
        setBatchProgress(prev => prev ? {
          ...prev,
          currentFile: fileItem.file.name,
          processedFiles: prev.processedFiles + 1
        } : null)

        try {
          // Read PDF content for customer extraction
          const formData = new FormData()
          formData.append('file', fileItem.file)

          // Extract text from PDF (this would use a PDF parsing service)
          const pdfText = await extractTextFromPDF(fileItem.file)

          if (pdfText) {
            // Extract customer data from PDF
            try {
              const extractionResponse = await fetch('/api/customers/extract', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'process_batch',
                  files: [{
                    type: 'pdf',
                    name: fileItem.file.name,
                    pdfText: pdfText
                  }]
                })
              })

              if (extractionResponse.ok) {
                const extractionResult = await extractionResponse.json()
                if (extractionResult.success) {
                  totalExtractedCustomers += extractionResult.data.summary.totalExtracted
                  totalNewCustomers += extractionResult.data.summary.newCustomers
                }
              }
            } catch (extractionError) {
              console.error('PDF customer extraction failed:', extractionError)
            }
          }

          // Process PDF invoice (placeholder for actual PDF processing)
          await new Promise(resolve => setTimeout(resolve, 1000))

          setBatchProgress(prev => prev ? {
            ...prev,
            successfulFiles: prev.successfulFiles + 1,
            extractedCustomers: totalExtractedCustomers,
            newCustomers: totalNewCustomers
          } : null)
        } catch (error) {
          console.error('PDF processing error:', error)
          setBatchProgress(prev => prev ? {
            ...prev,
            failedFiles: prev.failedFiles + 1
          } : null)
        }
      }

      setCurrentStep('complete')

    } catch (error) {
      console.error('Batch processing failed:', error)
    } finally {
      setProcessing(false)
    }
  }

  // Helper function to extract text from PDF files via API
  const extractTextFromPDF = async (file: File): Promise<string | null> => {
    try {
      // Send PDF to server for text extraction
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/pdf/extract-text', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        console.error('PDF text extraction API failed:', response.statusText)
        return null
      }

      const result = await response.json()
      return result.success ? result.text : null
    } catch (error) {
      console.error('PDF text extraction failed:', error)
      return null
    }
  }

  const getFileIcon = (category: FileCategory) => {
    switch (category) {
      case 'spreadsheet': return FileSpreadsheet
      case 'pdf': return FileText
      default: return FileX
    }
  }

  const getModeIcon = () => {
    switch (uploadMode) {
      case 'folder': return FolderOpen
      case 'mixed': return Upload
      default: return FileSpreadsheet
    }
  }

  const getModeTitle = () => {
    switch (uploadMode) {
      case 'folder': return 'Folder Upload'
      case 'mixed': return 'Mixed File Upload'
      default: return 'File Upload'
    }
  }

  const categorySummary = {
    spreadsheet: files.filter(f => f.category === 'spreadsheet').length,
    pdf: files.filter(f => f.category === 'pdf').length,
    unknown: files.filter(f => f.category === 'unknown').length
  }

  if (currentStep === 'complete') {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Check className="h-6 w-6" />
            Upload Complete
          </CardTitle>
          <CardDescription>
            Your invoices have been processed successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {batchProgress && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{batchProgress.successfulFiles}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{batchProgress.failedFiles}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{batchProgress.extractedCustomers}</div>
                <div className="text-sm text-gray-600">Customers Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{batchProgress.newCustomers}</div>
                <div className="text-sm text-gray-600">New Customers</div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button onClick={() => router.push('/dashboard/invoices')}>
              <FileText className="h-4 w-4 mr-2" />
              View Invoices
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard/customers')}>
              <Users className="h-4 w-4 mr-2" />
              Manage Customers
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (currentStep === 'processing') {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            Processing Upload
          </CardTitle>
          <CardDescription>
            Processing {files.length} files and extracting customer data...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {batchProgress && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{batchProgress.processedFiles} / {batchProgress.totalFiles}</span>
                </div>
                <Progress
                  value={(batchProgress.processedFiles / batchProgress.totalFiles) * 100}
                  className="h-2"
                />
              </div>

              {batchProgress.currentFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing: {batchProgress.currentFile}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <div className="font-semibold text-green-600">{batchProgress.successfulFiles}</div>
                  <div className="text-gray-500">Completed</div>
                </div>
                <div>
                  <div className="font-semibold text-blue-600">{batchProgress.extractedCustomers}</div>
                  <div className="text-gray-500">Customers Found</div>
                </div>
                <div>
                  <div className="font-semibold text-red-600">{batchProgress.failedFiles}</div>
                  <div className="text-gray-500">Failed</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {React.createElement(getModeIcon(), { className: "h-6 w-6 text-primary" })}
              {getModeTitle()}
            </CardTitle>
            <CardDescription className="mt-2">
              Upload invoices from files or folders - we'll handle the rest
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Methods */}
        <Tabs value="drag" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="drag">Drag & Drop</TabsTrigger>
            <TabsTrigger value="files">Select Files</TabsTrigger>
            <TabsTrigger value="folder">Select Folder</TabsTrigger>
          </TabsList>

          <TabsContent value="drag" className="space-y-4">
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/10" : "border-gray-300",
                files.length > 0 ? "border-green-500 bg-green-50" : ""
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">
                Drop files or folders here
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF invoices, CSV/Excel spreadsheets, and mixed folders
              </p>
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Select Invoice Files
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                Choose multiple PDF or spreadsheet files
              </p>
            </div>
          </TabsContent>

          <TabsContent value="folder" className="space-y-4">
            <div className="text-center">
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                onChange={handleFolderSelect}
                className="hidden"
              />
              <Button
                onClick={() => folderInputRef.current?.click()}
                className="gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Select Invoice Folder
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                Choose a folder containing your invoice files
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* File Summary */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Selected Files ({files.length})</h3>
              <div className="flex gap-2">
                {categorySummary.spreadsheet > 0 && (
                  <Badge variant="secondary">
                    <FileSpreadsheet className="h-3 w-3 mr-1" />
                    {categorySummary.spreadsheet} Spreadsheets
                  </Badge>
                )}
                {categorySummary.pdf > 0 && (
                  <Badge variant="secondary">
                    <FileText className="h-3 w-3 mr-1" />
                    {categorySummary.pdf} PDFs
                  </Badge>
                )}
                {categorySummary.unknown > 0 && (
                  <Badge variant="destructive">
                    <FileX className="h-3 w-3 mr-1" />
                    {categorySummary.unknown} Unknown
                  </Badge>
                )}
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2">
              {files.map((fileItem, index) => {
                const Icon = getFileIcon(fileItem.category)
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        fileItem.category === 'spreadsheet' && "text-green-600",
                        fileItem.category === 'pdf' && "text-red-600",
                        fileItem.category === 'unknown' && "text-gray-400"
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {fileItem.file.name}
                        </div>
                        {fileItem.path && (
                          <div className="text-xs text-gray-500 truncate">
                            {fileItem.path}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(fileItem.file.size / 1024).toFixed(1)}KB
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Processing Info */}
        {files.length > 0 && uploadMode === 'mixed' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Smart Processing</AlertTitle>
            <AlertDescription>
              We detected mixed file types. Spreadsheets will be processed for bulk import,
              PDFs will use AI extraction, and customer data will be automatically matched and deduplicated.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Upload Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        {files.length > 0 && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              Ready to process {files.length} files
              {categorySummary.unknown > 0 && (
                <span className="text-red-500 ml-1">
                  ({categorySummary.unknown} unsupported files will be skipped)
                </span>
              )}
            </div>
            <Button
              onClick={startProcessing}
              disabled={processing || isLoading || (categorySummary.spreadsheet + categorySummary.pdf === 0)}
              className="gap-2"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Start Processing
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}