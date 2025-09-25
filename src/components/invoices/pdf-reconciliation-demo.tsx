'use client'

import { useState } from 'react'
import { Upload, FileText, Zap, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'

import { PDFSmartReconciliation } from './pdf-smart-reconciliation'
import { pdfSmartReconciliationService, PDFExtractionResult } from '@/lib/services/pdf-smart-reconciliation-service'

interface PDFReconciliationDemoProps {
  onImportComplete?: (data: Record<string, any>) => void
  className?: string
}

type ProcessingStage = 'upload' | 'extracting' | 'reconciling' | 'completed'

export function PDFReconciliationDemo({
  onImportComplete,
  className
}: PDFReconciliationDemoProps) {
  const [stage, setStage] = useState<ProcessingStage>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<PDFExtractionResult[]>([])
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [extractionStats, setExtractionStats] = useState<{
    confidence: number
    extractedFields: number
    totalFields: number
  } | null>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)
    setError(null)
    await processFile(file)
  }

  const processFile = async (file: File) => {
    try {
      setStage('extracting')
      setProcessingProgress(10)

      console.log('🚀 Starting PDF reconciliation process...')

      // Simulate processing stages for better UX
      const stages = [
        { progress: 25, message: 'Reading PDF structure...' },
        { progress: 50, message: 'Extracting text content...' },
        { progress: 75, message: 'Applying AI pattern recognition...' },
        { progress: 90, message: 'Calculating confidence scores...' }
      ]

      for (const stageInfo of stages) {
        setProcessingProgress(stageInfo.progress)
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      // Actual PDF processing
      const result = await pdfSmartReconciliationService.extractAndReconcile(file)

      setExtractedData(result.extractedFields)
      setExtractionStats({
        confidence: result.confidence,
        extractedFields: result.extractionStats.extractedFields,
        totalFields: result.extractionStats.totalFields
      })

      setProcessingProgress(100)
      setStage('reconciling')

      console.log('✅ PDF reconciliation complete:', result)

    } catch (error) {
      console.error('Processing error:', error)
      setError(error instanceof Error ? error.message : 'Processing failed')
      setStage('upload')
      setProcessingProgress(0)
    }
  }

  const handleReconciliationComplete = (reconciledData: Record<string, any>) => {
    setStage('completed')
    console.log('🎉 Reconciliation completed:', reconciledData)

    if (onImportComplete) {
      onImportComplete(reconciledData)
    }
  }

  const handleStartOver = () => {
    setStage('upload')
    setUploadedFile(null)
    setExtractedData([])
    setProcessingProgress(0)
    setError(null)
    setExtractionStats(null)
  }

  const getStageIcon = (currentStage: ProcessingStage) => {
    switch (currentStage) {
      case 'upload': return <Upload className="h-5 w-5" />
      case 'extracting': return <FileText className="h-5 w-5 animate-pulse" />
      case 'reconciling': return <Zap className="h-5 w-5" />
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStageIcon(stage)}
            PDF Smart Reconciliation Demo
          </CardTitle>
          <CardDescription>
            Experience intelligent PDF data extraction with confidence-based reconciliation
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Stage */}
      {stage === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 1: Upload PDF Invoice</CardTitle>
            <CardDescription>
              Upload a PDF invoice to see smart extraction in action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Drop your PDF invoice here</p>
                <p className="text-sm text-gray-500">or click to browse files</p>
                <p className="text-xs text-gray-400">Maximum file size: 10MB</p>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="font-medium">What happens next:</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>AI extracts text and identifies invoice fields</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>Smart reconciliation matches extracted data to template</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>You review and confirm the extracted data</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Stage */}
      {(stage === 'extracting') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 animate-pulse" />
              Processing PDF: {uploadedFile?.name}
            </CardTitle>
            <CardDescription>
              Applying AI pattern recognition and confidence scoring...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing Progress</span>
                <span>{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {uploadedFile ? (uploadedFile.size / 1024).toFixed(1) : '0'}
                </div>
                <div className="text-xs text-gray-500">KB File Size</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {stage === 'extracting' ? '...' : extractionStats?.extractedFields || 0}
                </div>
                <div className="text-xs text-gray-500">Fields Extracted</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Stage */}
      {stage === 'reconciling' && uploadedFile && extractedData.length > 0 && (
        <div className="space-y-4">
          {/* Extraction Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Extraction Complete!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">
                    {extractionStats?.confidence.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Overall Confidence</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-green-600">
                    {extractionStats?.extractedFields}
                  </div>
                  <div className="text-xs text-gray-500">Fields Found</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-orange-600">
                    {extractedData.filter(field => field.confidence >= 95).length}
                  </div>
                  <div className="text-xs text-gray-500">High Confidence</div>
                </div>
              </div>

              {extractionStats && extractionStats.confidence >= 80 && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Excellent extraction quality! Most fields can be auto-accepted.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Smart Reconciliation Component */}
          <PDFSmartReconciliation
            pdfFile={uploadedFile}
            extractedData={extractedData}
            onReconciliationComplete={handleReconciliationComplete}
          />
        </div>
      )}

      {/* Completion Stage */}
      {stage === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Import Completed Successfully!
            </CardTitle>
            <CardDescription>
              Your invoice data has been processed and is ready for import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-3xl">🎉</div>
              <p className="text-lg font-medium">Invoice data reconciled and validated</p>
              <p className="text-sm text-gray-600">
                The extracted data is now ready to be imported into your system
              </p>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={handleStartOver}>
                <Upload className="h-4 w-4 mr-2" />
                Process Another PDF
              </Button>
              <Button>
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue to Invoice Management
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demo Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base text-blue-800">Demo Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">AI</Badge>
            <span>90% extraction accuracy based on real POP Trading invoice testing</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-green-300 text-green-700">UAE</Badge>
            <span>UAE-specific validation for TRN, phone numbers, and currency</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-purple-300 text-purple-700">Smart</Badge>
            <span>Confidence-based auto-accept with manual review capabilities</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}