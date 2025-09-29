'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Clock,
  Download,
  Eye,
  RotateCcw
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ImportProgress as ImportProgressType } from '@/lib/types/store'
import { cn } from '@/lib/utils'

interface ImportProgressProps {
  batchId: string
  progress: ImportProgressType | null
  onComplete?: () => void
}

interface ProcessingStage {
  id: string
  name: string
  description: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  startTime?: Date
  endTime?: Date
  details?: string[]
}

export function ImportProgress({ 
  batchId, 
  progress, 
  onComplete 
}: ImportProgressProps) {
  const t = useTranslations('importProgress')
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([
    {
      id: 'validation',
      name: t('stages.validation.name'),
      description: t('stages.validation.description'),
      status: 'pending',
      progress: 0
    },
    {
      id: 'customerCreation',
      name: t('stages.customerCreation.name'),
      description: t('stages.customerCreation.description'),
      status: 'pending',
      progress: 0
    },
    {
      id: 'invoiceCreation',
      name: t('stages.invoiceCreation.name'),
      description: t('stages.invoiceCreation.description'),
      status: 'pending',
      progress: 0
    },
    {
      id: 'completion',
      name: t('stages.completion.name'),
      description: t('stages.completion.description'),
      status: 'pending',
      progress: 0
    }
  ])
  const [realtimeStats, setRealtimeStats] = useState({
    recordsPerSecond: 0,
    estimatedTimeRemaining: 0,
    currentRecord: 0
  })
  const [selectedTab, setSelectedTab] = useState<'overview' | 'stages' | 'errors' | 'logs'>('overview')

  // Update processing stages based on progress
  useEffect(() => {
    if (!progress) return

    const overallProgress = progress.processedRecords / progress.totalRecords * 100

    setProcessingStages(prev => prev.map(stage => {
      let stageProgress = 0
      let status: ProcessingStage['status'] = 'pending'

      switch (stage.id) {
        case 'validation':
          stageProgress = Math.min(overallProgress * 1.2, 100) // Validation happens quickly
          status = overallProgress > 0 ? 'completed' : 'processing'
          break
        case 'customerCreation':
          stageProgress = Math.max(0, Math.min((overallProgress - 10) * 1.1, 100))
          status = overallProgress > 10 ? (overallProgress > 40 ? 'completed' : 'processing') : 'pending'
          break
        case 'invoiceCreation':
          stageProgress = Math.max(0, Math.min((overallProgress - 40) * 1.67, 100))
          status = overallProgress > 40 ? (overallProgress > 90 ? 'completed' : 'processing') : 'pending'
          break
        case 'completion':
          stageProgress = overallProgress >= 100 ? 100 : 0
          status = overallProgress >= 100 ? 'completed' : 'pending'
          break
      }

      // Add error status if there are errors in this stage
      if (progress.errors.some(error => error.errorType.toLowerCase().includes(stage.id))) {
        status = 'error'
      }

      return {
        ...stage,
        progress: stageProgress,
        status
      }
    }))

    // Update realtime stats
    setRealtimeStats({
      recordsPerSecond: progress.processingRate || 0,
      estimatedTimeRemaining: progress.estimatedCompletion 
        ? Math.ceil((new Date(progress.estimatedCompletion).getTime() - new Date().getTime()) / 1000 / 60) 
        : 0,
      currentRecord: progress.currentRecord || progress.processedRecords
    })

    // Call onComplete when processing is done
    if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
      onComplete?.()
    }
  }, [progress, onComplete])

  const getOverallProgress = () => {
    if (!progress) return 0
    return Math.round((progress.processedRecords / progress.totalRecords) * 100)
  }

  const getProcessingRate = () => {
    if (!progress?.processingRate) return '0'
    return progress.processingRate.toFixed(1)
  }

  const getEstimatedCompletion = () => {
    if (!progress?.estimatedCompletion) return t('calculating')
    const eta = new Date(progress.estimatedCompletion)
    return eta.toLocaleTimeString('en-AE', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Dubai'
    })
  }

  const getElapsedTime = () => {
    if (!progress?.startTime) return '0:00'
    const elapsed = Math.floor((Date.now() - new Date(progress.startTime).getTime()) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROCESSING': return 'text-blue-600'
      case 'COMPLETED': return 'text-green-600'
      case 'FAILED': return 'text-red-600'
      case 'CANCELLED': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getStageIcon = (status: ProcessingStage['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const downloadErrors = () => {
    window.open(`/api/import-batches/${batchId}/errors/download`, '_blank')
  }

  const viewDetailedLogs = () => {
    window.open(`/api/import-batches/${batchId}/logs`, '_blank')
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">{t('loadingProgress')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            {t('importInProgress')}
            <Badge variant="outline" className={getStatusColor(progress.status)}>
              {progress.status}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t('processingInvoiceData')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Main Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('overallProgress')}</span>
                <span className="font-medium">{getOverallProgress()}%</span>
              </div>
              <Progress 
                value={getOverallProgress()} 
                className="h-3"
              />
              <div className="text-sm text-gray-600 text-center">
                {progress.processedRecords} of {progress.totalRecords} records processed
              </div>
            </div>

            {/* Key Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{progress.totalRecords}</div>
                  <div className="text-sm text-blue-700">{t('totalRecords')}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{progress.successfulRecords}</div>
                  <div className="text-sm text-green-700">{t('successful')}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{progress.failedRecords}</div>
                  <div className="text-sm text-red-700">{t('failed')}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {getProcessingRate()}
                  </div>
                  <div className="text-sm text-orange-700">{t('recordsPerSecond')}</div>
                </CardContent>
              </Card>
            </div>

            {/* Processing Details */}
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-600">{t('currentRecord')}</span>
                <span className="font-medium">{realtimeStats.currentRecord}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-600">{t('elapsedTime')}</span>
                <span className="font-medium">{getElapsedTime()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-600">{t('estimatedCompletion')}</span>
                <span className="font-medium">{getEstimatedCompletion()}</span>
              </div>
            </div>

            {/* Real-time Activity Indicator */}
            {progress.status === 'PROCESSING' && (
              <div className="flex items-center justify-center space-x-2 py-4 bg-blue-50 rounded-lg">
                <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="text-blue-700 font-medium">
                  {t('processingRecord', { current: realtimeStats.currentRecord })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Progress Tabs */}
      <Tabs value={selectedTab} onValueChange={(tab) => setSelectedTab(tab as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="stages">{t('tabs.stages')}</TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-1">
            {t('tabs.errors')}
            {progress.failedRecords > 0 && (
              <Badge variant="destructive" className="text-xs">
                {progress.failedRecords}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">{t('tabs.logs')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('customerProcessing')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>{t('newCustomers')}</span>
                    <Badge variant="outline">{t('calculating')}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('existingCustomers')}</span>
                    <Badge variant="outline">{t('calculating')}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('duplicatesFound')}</span>
                    <Badge variant="outline">{t('calculating')}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('invoiceProcessing')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>{t('invoicesCreated')}</span>
                    <Badge variant="default">{progress.successfulRecords}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('vatCalculated')}</span>
                    <Badge variant="outline">{progress.successfulRecords}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('totalValue')}</span>
                    <Badge variant="outline">{t('calculating')}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <div className="space-y-4">
            {processingStages.map((stage, index) => (
              <Card key={stage.id} className={cn(
                "transition-all duration-300",
                stage.status === 'processing' && "ring-2 ring-blue-200 bg-blue-50/30",
                stage.status === 'error' && "ring-2 ring-red-200 bg-red-50/30"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStageIcon(stage.status)}
                      <div>
                        <h4 className="font-medium">{stage.name}</h4>
                        <p className="text-sm text-gray-600">{stage.description}</p>
                      </div>
                    </div>
                    <Badge variant={
                      stage.status === 'completed' ? 'default' :
                      stage.status === 'processing' ? 'secondary' :
                      stage.status === 'error' ? 'destructive' : 'outline'
                    }>
                      {t(`stageStatus.${stage.status}`)}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('stageProgress')}</span>
                      <span>{Math.round(stage.progress)}%</span>
                    </div>
                    <Progress 
                      value={stage.progress} 
                      className={cn(
                        "h-2",
                        stage.status === 'error' && "bg-red-100 [&>div]:bg-red-500"
                      )}
                    />
                  </div>

                  {stage.details && (
                    <div className="mt-3 text-xs text-gray-500">
                      <ul className="list-disc list-inside space-y-1">
                        {stage.details.map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {(progress.errors?.length || 0) === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="font-medium">{t('noErrors')}</p>
                <p className="text-sm mt-1">{t('allRecordsProcessedSuccessfully')}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      {t('processingErrors')}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={downloadErrors}>
                      <Download className="h-4 w-4 mr-2" />
                      {t('downloadErrorReport')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('errorsDetected')}</AlertTitle>
                      <AlertDescription>
                        {t('errorsDetectedDescription', { count: progress.errors?.length || 0 })}
                      </AlertDescription>
                    </Alert>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('row')}</TableHead>
                            <TableHead>{t('field')}</TableHead>
                            <TableHead>{t('error')}</TableHead>
                            <TableHead>{t('value')}</TableHead>
                            <TableHead>{t('suggestion')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {progress.errors.slice(0, 10).map((error, index) => (
                            <TableRow key={index}>
                              <TableCell>{error.rowNumber}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{error.fieldName}</Badge>
                              </TableCell>
                              <TableCell className="text-red-600">{error.errorMessage}</TableCell>
                              <TableCell className="font-mono text-sm max-w-xs truncate">
                                {error.attemptedValue}
                              </TableCell>
                              <TableCell className="text-blue-600 text-sm">
                                {error.suggestion || t('noSuggestion')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {(progress.errors?.length || 0) > 10 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {t('showingFirstErrors', { shown: 10, total: progress.errors?.length || 0 })}
                        </p>
                        <Button variant="outline" size="sm" onClick={downloadErrors}>
                          <Download className="h-4 w-4 mr-2" />
                          {t('downloadFullErrorReport')}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('processingLogs')}</CardTitle>
                <Button variant="outline" size="sm" onClick={viewDetailedLogs}>
                  <Eye className="h-4 w-4 mr-2" />
                  {t('viewDetailedLogs')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm bg-gray-50 p-4 rounded max-h-64 overflow-y-auto">
                <div className="text-blue-600">[{new Date(progress.startTime).toLocaleTimeString()}] Import batch started</div>
                <div className="text-green-600">[{new Date().toLocaleTimeString()}] Processing {progress.processedRecords} / {progress.totalRecords} records</div>
                <div className="text-orange-600">[{new Date().toLocaleTimeString()}] Processing rate: {getProcessingRate()} records/sec</div>
                {(progress.errors?.length || 0) > 0 && (
                  <div className="text-red-600">[{new Date().toLocaleTimeString()}] {progress.errors?.length || 0} errors encountered</div>
                )}
                <div className="text-gray-600">[{new Date().toLocaleTimeString()}] Status: {progress.status}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {progress.status !== 'PROCESSING' && (
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refreshStatus')}
          </Button>
          
          {(progress.errors?.length || 0) > 0 && (
            <Button variant="outline" onClick={downloadErrors}>
              <Download className="h-4 w-4 mr-2" />
              {t('downloadErrors')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}