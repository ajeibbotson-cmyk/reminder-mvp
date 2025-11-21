'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  File,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from '@/lib/utils'

interface ExtractedData {
  invoiceNumber?: string
  customerName?: string
  amount?: number
  totalAmount?: number
  currency?: string
  invoiceDate?: string
  dueDate?: string
  confidence: number
}

interface BulkResult {
  fileName: string
  success: boolean
  error?: string
  processingTimeMs: number
  extractedData: ExtractedData | null
  validation: {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }
}

interface BulkSummary {
  totalFiles: number
  successful: number
  failed: number
  totalTimeMs: number
  averageTimePerFile: number
}

interface BulkPDFUploadProps {
  onComplete?: (results: BulkResult[]) => void
}

export function BulkPDFUpload({ onComplete }: BulkPDFUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [summary, setSummary] = useState<BulkSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter to only PDF files
    const pdfFiles = acceptedFiles.filter(f => f.type === 'application/pdf')
    setFiles(prev => [...prev, ...pdfFiles])
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  })

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setResults(null)
    setSummary(null)
    setError(null)
    setProgress(0)
  }

  const processFiles = async () => {
    if (files.length === 0) return

    setProcessing(true)
    setProgress(10)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })

      setProgress(20)

      const response = await fetch('/api/invoices/upload-pdf-bulk', {
        method: 'POST',
        body: formData
      })

      setProgress(80)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Bulk processing failed')
      }

      const data = await response.json()
      setResults(data.results)
      setSummary(data.summary)
      setProgress(100)

      if (onComplete) {
        onComplete(data.results)
      }

    } catch (err) {
      console.error('Bulk upload failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to process PDFs')
    } finally {
      setProcessing(false)
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatCurrency = (amount: number | undefined, currency: string = 'EUR') => {
    if (amount === undefined) return '-'
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Show results view if processing is complete
  if (results && summary) {
    return (
      <div className="space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Bulk Processing Complete
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearFiles}>
                Process More Files
              </Button>
            </div>
            <CardDescription>
              Processed {summary.totalFiles} files in {formatTime(summary.totalTimeMs)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold">{summary.totalFiles}</div>
                <div className="text-sm text-gray-500">Total Files</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.successful}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{formatTime(summary.averageTimePerFile)}</div>
                <div className="text-sm text-blue-700">Avg per File</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results List */}
        <Card>
          <CardHeader>
            <CardTitle>Extraction Results</CardTitle>
            <CardDescription>
              Review extracted data for each invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-4 border rounded-lg",
                      result.success ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-red-600 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium">{result.fileName}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {formatTime(result.processingTimeMs)}
                            {result.extractedData && (
                              <>
                                <span className="mx-1">•</span>
                                <span>{result.extractedData.confidence}% confidence</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {result.success && result.extractedData && (
                        <Badge variant="outline" className="ml-2">
                          {result.extractedData.invoiceNumber || 'No Invoice #'}
                        </Badge>
                      )}
                    </div>

                    {result.success && result.extractedData && (
                      <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500">Customer</div>
                          <div className="font-medium truncate">
                            {result.extractedData.customerName || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Amount</div>
                          <div className="font-medium">
                            {formatCurrency(result.extractedData.totalAmount, result.extractedData.currency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Invoice Date</div>
                          <div className="font-medium">
                            {result.extractedData.invoiceDate || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Due Date</div>
                          <div className="font-medium">
                            {result.extractedData.dueDate || '-'}
                          </div>
                        </div>
                      </div>
                    )}

                    {!result.success && result.error && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {result.error}
                      </div>
                    )}

                    {result.validation.warnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {result.validation.warnings.map((warning, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk PDF Upload
          </CardTitle>
          <CardDescription>
            Upload multiple PDF invoices for parallel processing. Much faster than one-by-one!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50",
              processing && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-primary font-medium">Drop the PDF files here...</p>
            ) : (
              <>
                <p className="text-gray-600 font-medium">
                  Drag & drop PDF invoices here, or click to select
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Maximum 100 files, 10MB each
                </p>
              </>
            )}
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{files.length} files selected</h3>
                <Button variant="ghost" size="sm" onClick={clearFiles} disabled={processing}>
                  Clear all
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-1">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-red-500" />
                        <span className="text-sm truncate max-w-[300px]">{file.name}</span>
                        <span className="text-xs text-gray-400">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={processing}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-600">
                  Processing {files.length} files with parallel AI extraction...
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500">
                This may take 1-3 minutes for large batches. Please wait.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Button */}
          <div className="flex justify-end">
            <Button
              onClick={processFiles}
              disabled={files.length === 0 || processing}
              className="min-w-[200px]"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Process {files.length} Invoice{files.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Optimized for Speed</h3>
              <p className="text-sm text-blue-700 mt-1">
                Our parallel processing can handle 60 invoices in 2-3 minutes instead of 15 minutes.
                Upload all your invoices at once to save time!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
