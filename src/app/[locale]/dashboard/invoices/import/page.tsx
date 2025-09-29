'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { 
  FileSpreadsheet, 
  Upload, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Download,
  FileText,
  History,
  Users,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileUpload } from '@/components/import/file-upload'
import { FieldMapping } from '@/components/import/field-mapping'
import { ImportProgress } from '@/components/import/import-progress'
import { ImportHistory } from '@/components/import/import-history'
import { FileTypeSelector } from '@/components/import/file-type-selector'
import { PDFInvoiceUpload } from '@/components/invoices/pdf-invoice-upload'
import { useImportBatchStore } from '@/lib/stores/import-batch-store'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { cn } from '@/lib/utils'

type ImportStep = 'fileType' | 'upload' | 'mapping' | 'processing' | 'complete'
type FileType = 'spreadsheet' | 'pdf' | null

interface UploadResult {
  batchId: string
  headers: string[]
  sampleData: Record<string, any>[]
  recordCount: number
}

export default function InvoiceImportPage() {
  const { data: session, status } = useSession()
  const t = useTranslations('import')
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState<ImportStep>('fileType')
  const [selectedFileType, setSelectedFileType] = useState<FileType>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [importStats, setImportStats] = useState<{
    totalRecords: number
    processedRecords: number
    successfulRecords: number
    failedRecords: number
  } | null>(null)

  const { 
    batches, 
    currentBatch,
    progress,
    fetchBatches, 
    uploadFile,
    processImport, 
    getBatchProgress,
    loading: isLoading, 
    error,
    clearError 
  } = useImportBatchStore()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.companyId) {
      fetchBatches(session.user.companyId)
    }
  }, [status, session?.user?.companyId, fetchBatches])

  const handleFileTypeSelect = (fileType: FileType) => {
    setSelectedFileType(fileType)
    if (fileType === 'pdf') {
      setCurrentStep('upload') // Will show PDF upload interface
    } else if (fileType === 'spreadsheet') {
      setCurrentStep('upload') // Will show CSV/Excel upload interface
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!session?.user?.companyId) return

    try {
      clearError()

      // Handle CSV/Excel files through existing import flow
      const result = await uploadFile(file, session.user.companyId)

      setUploadResult({
        batchId: result.batchId,
        headers: result.headers || [],
        sampleData: result.sampleData || [],
        recordCount: result.sampleData?.length || 0
      })

      setCurrentStep('mapping')
    } catch (error) {
      console.error('File upload failed:', error)
    }
  }

  const handlePDFInvoiceCreate = async (invoiceData: any) => {
    // This would typically save the invoice to the database
    // For now, just show success and redirect
    console.log('Creating invoice from PDF data:', invoiceData)
    router.push('/dashboard/invoices?pdf_imported=true')
  }

  const handleMappingComplete = async (mappings: Record<string, string>) => {
    if (!uploadResult) return

    try {
      clearError()
      setFieldMappings(mappings)
      setCurrentStep('processing')
      
      const importResult = await processImport(uploadResult.batchId, {
        fieldMappings: mappings,
        hasHeaders: true,
        skipEmptyRows: true
      })
      
      // Start polling for progress
      pollProgress(uploadResult.batchId)
      
    } catch (error) {
      console.error('Import processing failed:', error)
    }
  }

  const pollProgress = async (batchId: string) => {
    const poll = async () => {
      try {
        const progressData = await getBatchProgress(batchId)
        
        if (progressData) {
          setImportStats({
            totalRecords: progressData.totalRecords,
            processedRecords: progressData.processedRecords,
            successfulRecords: progressData.successfulRecords,
            failedRecords: progressData.failedRecords
          })
          
          // Check if processing is complete
          if (progressData.status === 'COMPLETED' || progressData.status === 'FAILED') {
            setCurrentStep('complete')
            // Refresh batches list
            if (session?.user?.companyId) {
              fetchBatches(session.user.companyId)
            }
            return
          }
          
          // Continue polling
          setTimeout(poll, 2000)
        }
      } catch (error) {
        console.error('Progress polling error:', error)
        setTimeout(poll, 5000) // Retry after longer delay on error
      }
    }
    
    setTimeout(poll, 1000)
  }

  const resetImport = () => {
    setCurrentStep('fileType')
    setSelectedFileType(null)
    setUploadResult(null)
    setFieldMappings({})
    setImportStats(null)
    clearError()
  }

  const getStepIcon = (step: ImportStep) => {
    switch (step) {
      case 'fileType':
        return <FileSpreadsheet className="h-5 w-5" />
      case 'upload':
        return <Upload className="h-5 w-5" />
      case 'mapping':
        return <ArrowRight className="h-5 w-5" />
      case 'processing':
        return <RefreshCw className="h-5 w-5" />
      case 'complete':
        return <CheckCircle className="h-5 w-5" />
      default:
        return <FileSpreadsheet className="h-5 w-5" />
    }
  }

  const getStepStatus = (step: ImportStep) => {
    const steps: ImportStep[] = selectedFileType === 'pdf'
      ? ['fileType', 'upload', 'complete']
      : ['fileType', 'upload', 'mapping', 'processing', 'complete']
    const currentIndex = steps.indexOf(currentStep)
    const stepIndex = steps.indexOf(step)

    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'pending'
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    router.push('/auth/signin')
    return null
  }

  return (
    <UAEErrorBoundary>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              {t('invoiceImportTitle')}
            </h1>
            <p className="text-gray-600 mt-2">{t('invoiceImportDescription')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard/invoices')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('backToInvoices')}
            </Button>
            
            {currentStep !== 'fileType' && (
              <Button variant="outline" onClick={resetImport}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('startNewImport')}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              {t('importProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              {(selectedFileType === 'pdf'
                ? (['fileType', 'upload', 'complete'] as ImportStep[])
                : (['fileType', 'upload', 'mapping', 'processing', 'complete'] as ImportStep[])
              ).map((step, index, steps) => {
                const status = getStepStatus(step)
                
                return (
                  <div
                    key={step}
                    className={cn(
                      "flex items-center",
                      index < 3 && "flex-1"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300",
                      status === 'completed' && "border-green-500 bg-green-500 text-white",
                      status === 'current' && "border-primary bg-primary text-primary-foreground shadow-lg scale-110",
                      status === 'pending' && "border-gray-300 text-gray-400"
                    )}>
                      {getStepIcon(step)}
                    </div>
                    
                    <div className="ml-3 text-sm">
                      <div className={cn(
                        "font-medium transition-colors",
                        status === 'current' && "text-primary",
                        status === 'completed' && "text-green-600"
                      )}>
                        {t(`steps.${step}.title`)}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {t(`steps.${step}.description`)}
                      </div>
                    </div>
                    
                    {index < steps.length - 1 && (
                      <div className={cn(
                        "flex-1 h-px mx-4 transition-colors duration-300",
                        status === 'completed' && "bg-green-500",
                        status !== 'completed' && "bg-gray-300"
                      )} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Import Statistics */}
            {importStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importStats.totalRecords}</div>
                  <div className="text-sm text-gray-500">{t('totalRecords')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{importStats.processedRecords}</div>
                  <div className="text-sm text-gray-500">{t('processedRecords')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importStats.successfulRecords}</div>
                  <div className="text-sm text-gray-500">{t('successfulRecords')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{importStats.failedRecords}</div>
                  <div className="text-sm text-gray-500">{t('failedRecords')}</div>
                </div>
              </div>
            )}
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

        {/* Import Content */}
        <Tabs value={currentStep} className="space-y-6">
          <TabsContent value="fileType" className="space-y-6">
            <FileTypeSelector
              onFileTypeSelect={handleFileTypeSelect}
              selectedType={selectedFileType}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            {selectedFileType === 'pdf' ? (
              <PDFInvoiceUpload
                onInvoiceCreate={handlePDFInvoiceCreate}
                isLoading={isLoading}
              />
            ) : (
              <FileUpload
                onFileUpload={handleFileUpload}
                isLoading={isLoading}
                error={error}
                locale="en"
                acceptedFileTypes="spreadsheet"
              />
            )}
          </TabsContent>

          <TabsContent value="mapping" className="space-y-6">
            {uploadResult && (
              <FieldMapping
                batchId={uploadResult.batchId}
                csvHeaders={uploadResult.headers}
                sampleData={uploadResult.sampleData}
                onMappingComplete={handleMappingComplete}
                locale="en"
              />
            )}
          </TabsContent>

          <TabsContent value="processing" className="space-y-6">
            <ImportProgress
              batchId={uploadResult?.batchId || ''}
              progress={progress}
              onComplete={() => setCurrentStep('complete')}
            />
          </TabsContent>

          <TabsContent value="complete" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-6 w-6" />
                  {t('importComplete')}
                </CardTitle>
                <CardDescription>
                  {t('importCompleteDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-green-700">
                    {t('importSuccessful')}
                  </h3>
                  
                  {importStats && (
                    <div className="mb-6 p-4 bg-green-50 rounded-lg">
                      <div className="text-lg font-semibold text-green-800">
                        {importStats.successfulRecords} of {importStats.totalRecords} invoices imported successfully
                      </div>
                      {importStats.failedRecords > 0 && (
                        <div className="text-sm text-red-600 mt-1">
                          {importStats.failedRecords} records failed - check error report for details
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Button onClick={() => router.push('/dashboard/invoices')}>
                      <FileText className="h-4 w-4 mr-2" />
                      {t('viewInvoices')}
                    </Button>
                    
                    <Button variant="outline" onClick={resetImport}>
                      <Upload className="h-4 w-4 mr-2" />
                      {t('importMore')}
                    </Button>
                    
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      {t('downloadReport')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Import History */}
        <ImportHistory
          batches={batches}
          onRetryBatch={(batchId) => {
            // Handle retry logic
            console.log('Retry batch:', batchId)
          }}
          onDownloadErrors={(batchId) => {
            // Handle download errors logic
            window.open(`/api/import-batches/${batchId}/errors/download`, '_blank')
          }}
        />
      </div>
    </UAEErrorBoundary>
  )
}