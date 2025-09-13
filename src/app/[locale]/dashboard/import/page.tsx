'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Upload, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Download,
  Settings
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImportInterface } from '@/components/invoices/import-interface'
import { FieldMapping } from '@/components/invoices/field-mapping'
import { AdvancedProgress, useProgressManager, createProgressStep } from '@/components/ui/advanced-progress'
import { useImportBatchStore } from '@/lib/stores/import-batch-store'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { cn } from '@/lib/utils'

export default function ImportPage() {
  const { data: session } = useSession()
  const t = useTranslations('import')
  const router = useRouter()
  
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'processing' | 'complete'>('upload')
  const [currentBatch, setCurrentBatch] = useState<any>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [sampleData, setSampleData] = useState<any[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})

  const { 
    batches, 
    fetchBatches, 
    processImport, 
    getBatchProgress,
    isLoading, 
    error 
  } = useImportBatchStore()

  // Progress management for the import process
  const { 
    steps,
    currentStepId,
    overallStatus,
    overallProgress,
    startStep,
    completeStep,
    failStep,
    updateStep
  } = useProgressManager([
    createProgressStep('file-upload', t('steps.fileUpload'), { 
      description: t('steps.fileUploadDesc') 
    }),
    createProgressStep('field-mapping', t('steps.fieldMapping'), { 
      description: t('steps.fieldMappingDesc') 
    }),
    createProgressStep('data-processing', t('steps.dataProcessing'), { 
      description: t('steps.dataProcessingDesc') 
    }),
    createProgressStep('completion', t('steps.completion'), { 
      description: t('steps.completionDesc') 
    })
  ])

  useEffect(() => {
    if (session?.user?.companyId) {
      fetchBatches(session.user.companyId)
    }
  }, [session?.user?.companyId, fetchBatches])

  const handleFileUpload = async (batchId: string) => {
    startStep('file-upload')
    
    try {
      setCurrentBatch({ id: batchId })
      // Simulate getting CSV headers and sample data
      setCsvHeaders(['Customer Name', 'Invoice Number', 'Amount', 'Due Date', 'Email'])
      setSampleData([
        { 'Customer Name': 'Emirates Trading LLC', 'Invoice Number': 'INV-001', 'Amount': '1250.00', 'Due Date': '2025-01-15', 'Email': 'billing@emirates-trading.com' },
        { 'Customer Name': 'Dubai Tech Solutions', 'Invoice Number': 'INV-002', 'Amount': '2500.00', 'Due Date': '2025-01-20', 'Email': 'finance@dubaitech.ae' },
        { 'Customer Name': 'Abu Dhabi Consulting', 'Invoice Number': 'INV-003', 'Amount': '3750.00', 'Due Date': '2025-01-25', 'Email': 'accounts@adconsulting.ae' }
      ])
      
      completeStep('file-upload')
      setCurrentStep('mapping')
      startStep('field-mapping')
    } catch (error) {
      failStep('file-upload', [error instanceof Error ? error.message : 'File upload failed'])
    }
  }

  const handleMappingComplete = async (mappings: Record<string, string>) => {
    setFieldMappings(mappings)
    completeStep('field-mapping')
    setCurrentStep('processing')
    startStep('data-processing')

    try {
      if (currentBatch?.id) {
        await processImport(currentBatch.id, {
          fieldMappings: mappings,
          hasHeaders: true,
          skipEmptyRows: true
        })
        
        // Poll for progress updates
        const pollProgress = async () => {
          const progress = await getBatchProgress(currentBatch.id)
          if (progress) {
            updateStep('data-processing', { 
              progress: progress.progress 
            })
            
            if (progress.progress === 100) {
              completeStep('data-processing')
              startStep('completion')
              setCurrentStep('complete')
              completeStep('completion')
            } else {
              setTimeout(pollProgress, 2000)
            }
          }
        }
        
        setTimeout(pollProgress, 1000)
      }
    } catch (error) {
      failStep('data-processing', [error instanceof Error ? error.message : 'Processing failed'])
    }
  }

  const resetImport = () => {
    setCurrentStep('upload')
    setCurrentBatch(null)
    setCsvHeaders([])
    setSampleData([])
    setFieldMappings({})
  }

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'upload':
        return <Upload className="h-5 w-5" />
      case 'mapping':
        return <ArrowRight className="h-5 w-5" />
      case 'processing':
        return <RefreshCw className="h-5 w-5" />
      case 'complete':
        return <CheckCircle className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    )
  }

  return (
    <UAEErrorBoundary>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-gray-600 mt-2">{t('pageDescription')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              {t('backToDashboard')}
            </Button>
            
            {currentStep !== 'upload' && (
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
              <FileText className="h-6 w-6" />
              {t('importProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              {['upload', 'mapping', 'processing', 'complete'].map((step, index) => (
                <div
                  key={step}
                  className={cn(
                    "flex items-center",
                    index < 3 && "flex-1"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                    currentStep === step && "border-primary bg-primary text-primary-foreground",
                    ['mapping', 'processing', 'complete'].includes(currentStep) && 
                    ['upload', 'mapping'].includes(step) && "border-green-500 bg-green-500 text-white",
                    ['processing', 'complete'].includes(currentStep) && 
                    step === 'processing' && currentStep !== 'processing' && "border-green-500 bg-green-500 text-white",
                    currentStep === 'complete' && step === 'complete' && "border-green-500 bg-green-500 text-white",
                    !['upload', 'mapping', 'processing', 'complete'].slice(0, ['upload', 'mapping', 'processing', 'complete'].indexOf(currentStep) + 1).includes(step) && "border-gray-300 text-gray-400"
                  )}>
                    {getStepIcon(step)}
                  </div>
                  
                  <div className="ml-3 text-sm">
                    <div className="font-medium">{t(`steps.${step}`)}</div>
                    <div className="text-gray-500">{t(`steps.${step}Short`)}</div>
                  </div>
                  
                  {index < 3 && (
                    <div className={cn(
                      "flex-1 h-px mx-4 transition-colors",
                      ['mapping', 'processing', 'complete'].includes(currentStep) && index === 0 && "bg-green-500",
                      ['processing', 'complete'].includes(currentStep) && index === 1 && "bg-green-500",
                      currentStep === 'complete' && index === 2 && "bg-green-500",
                      "bg-gray-300"
                    )} />
                  )}
                </div>
              ))}
            </div>

            {/* Advanced Progress Component */}
            {currentStep !== 'upload' && (
              <AdvancedProgress
                steps={steps}
                currentStepId={currentStepId}
                overallProgress={overallProgress}
                status={overallStatus}
                showDetails={true}
                showTimings={true}
                showErrors={true}
              />
            )}
          </CardContent>
        </Card>

        {/* Import Content */}
        <Tabs value={currentStep} className="space-y-6">
          <TabsContent value="upload" className="space-y-6">
            <ImportInterface
              companyId={session.user.companyId}
              onImportComplete={handleFileUpload}
              locale="en"
            />
          </TabsContent>

          <TabsContent value="mapping" className="space-y-6">
            {csvHeaders.length > 0 && (
              <FieldMapping
                batchId={currentBatch?.id || ''}
                csvHeaders={csvHeaders}
                sampleData={sampleData}
                onMappingComplete={handleMappingComplete}
                locale="en"
              />
            )}
          </TabsContent>

          <TabsContent value="processing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  {t('processingInvoices')}
                </CardTitle>
                <CardDescription>
                  {t('processingDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <RefreshCw className="h-16 w-16 animate-spin mx-auto mb-4 text-blue-500" />
                  <h3 className="text-lg font-semibold mb-2">{t('processingInProgress')}</h3>
                  <p className="text-gray-600">{t('processingPleaseWait')}</p>
                </div>
              </CardContent>
            </Card>
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
                  <p className="text-gray-600 mb-6">
                    {t('importSuccessfulDescription')}
                  </p>
                  
                  <div className="flex justify-center gap-4">
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

        {/* Recent Import History */}
        <Card>
          <CardHeader>
            <CardTitle>{t('recentImports')}</CardTitle>
            <CardDescription>
              {t('recentImportsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {batches.length > 0 ? (
              <div className="space-y-3">
                {batches.slice(0, 5).map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="font-medium">{batch.fileName}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(batch.createdAt).toLocaleDateString('en-AE')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant={batch.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {batch.status}
                      </Badge>
                      <div className="text-sm text-gray-600">
                        {batch.processedCount || 0} / {batch.totalRecords || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('noRecentImports')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UAEErrorBoundary>
  )
}