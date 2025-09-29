'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { 
  History, 
  FileText, 
  Download, 
  Eye, 
  RotateCcw, 
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Users,
  DollarSign,
  Calendar,
  Filter,
  Search,
  MoreHorizontal
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImportBatchWithDetails } from '@/lib/types/store'
import { cn } from '@/lib/utils'

interface ImportHistoryProps {
  batches: ImportBatchWithDetails[]
  onRetryBatch?: (batchId: string) => void
  onDownloadErrors?: (batchId: string) => void
  onDeleteBatch?: (batchId: string) => void
  onViewDetails?: (batchId: string) => void
}

type FilterStatus = 'all' | 'completed' | 'failed' | 'processing' | 'pending'
type SortField = 'createdAt' | 'fileName' | 'totalRecords' | 'successfulRecords' | 'status'
type SortOrder = 'asc' | 'desc'

export function ImportHistory({ 
  batches, 
  onRetryBatch, 
  onDownloadErrors,
  onDeleteBatch,
  onViewDetails 
}: ImportHistoryProps) {
  const t = useTranslations('importHistory')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedTab, setSelectedTab] = useState<'recent' | 'all' | 'analytics'>('recent')

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'PROCESSING':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'default'
      case 'FAILED':
        return 'destructive'
      case 'PROCESSING':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const filteredAndSortedBatches = batches
    .filter(batch => {
      if (filterStatus !== 'all' && batch.status.toLowerCase() !== filterStatus) {
        return false
      }
      if (searchQuery && !batch.fileName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'fileName':
          comparison = a.fileName.localeCompare(b.fileName)
          break
        case 'totalRecords':
          comparison = (a.totalRecords || 0) - (b.totalRecords || 0)
          break
        case 'successfulRecords':
          comparison = (a.processedCount || 0) - (b.processedCount || 0)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

  const recentBatches = filteredAndSortedBatches.slice(0, 5)

  const getAnalytics = () => {
    const totalImports = batches.length
    const completedImports = batches.filter(b => b.status === 'COMPLETED').length
    const failedImports = batches.filter(b => b.status === 'FAILED').length
    const totalRecords = batches.reduce((sum, b) => sum + (b.totalRecords || 0), 0)
    const successfulRecords = batches.reduce((sum, b) => sum + (b.processedCount || 0), 0)
    const successRate = totalRecords > 0 ? (successfulRecords / totalRecords * 100).toFixed(1) : '0'
    
    return {
      totalImports,
      completedImports,
      failedImports,
      totalRecords,
      successfulRecords,
      successRate: parseFloat(successRate)
    }
  }

  const analytics = getAnalytics()

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai'
    })
  }

  const getProgressPercentage = (batch: ImportBatchWithDetails) => {
    if (!batch.totalRecords || batch.totalRecords === 0) return 0
    return Math.round(((batch.processedCount || 0) / batch.totalRecords) * 100)
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-2">{t('noImportsYet')}</p>
            <p className="text-sm">{t('noImportsDescription')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-6 w-6" />
          {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description', { count: batches.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={(tab) => setSelectedTab(tab as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">{t('tabs.recent')}</TabsTrigger>
            <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('tabs.analytics')}</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-4">
            {recentBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>{t('noRecentImports')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBatches.map((batch) => (
                  <div 
                    key={batch.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(batch.status)}
                      <div className="flex-1">
                        <div className="font-medium">{batch.fileName}</div>
                        <div className="text-sm text-gray-600">
                          {formatDate(batch.createdAt)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          {batch.processedCount || 0} / {batch.totalRecords || 0}
                        </div>
                        <div className="text-gray-500">
                          {getProgressPercentage(batch)}% complete
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(batch.status)}>
                          {batch.status}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDetails?.(batch.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            {batch.status === 'FAILED' && onRetryBatch && (
                              <DropdownMenuItem onClick={() => onRetryBatch(batch.id)}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                {t('retryImport')}
                              </DropdownMenuItem>
                            )}
                            {(batch.importErrors?.length ?? 0) > 0 && onDownloadErrors && (
                              <DropdownMenuItem onClick={() => onDownloadErrors(batch.id)}>
                                <Download className="h-4 w-4 mr-2" />
                                {t('downloadErrors')}
                              </DropdownMenuItem>
                            )}
                            {onDeleteBatch && (
                              <DropdownMenuItem 
                                onClick={() => onDeleteBatch(batch.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('deleteImport')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                  <SelectTrigger className="w-32">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.all')}</SelectItem>
                    <SelectItem value="completed">{t('filters.completed')}</SelectItem>
                    <SelectItem value="failed">{t('filters.failed')}</SelectItem>
                    <SelectItem value="processing">{t('filters.processing')}</SelectItem>
                    <SelectItem value="pending">{t('filters.pending')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={`${sortField}-${sortOrder}`} 
                  onValueChange={(value) => {
                    const [field, order] = value.split('-')
                    setSortField(field as SortField)
                    setSortOrder(order as SortOrder)
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt-desc">{t('sort.newestFirst')}</SelectItem>
                    <SelectItem value="createdAt-asc">{t('sort.oldestFirst')}</SelectItem>
                    <SelectItem value="fileName-asc">{t('sort.fileNameAZ')}</SelectItem>
                    <SelectItem value="fileName-desc">{t('sort.fileNameZA')}</SelectItem>
                    <SelectItem value="totalRecords-desc">{t('sort.recordsDesc')}</SelectItem>
                    <SelectItem value="totalRecords-asc">{t('sort.recordsAsc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Table */}
            {filteredAndSortedBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>{t('noMatchingImports')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.fileName')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                      <TableHead>{t('table.records')}</TableHead>
                      <TableHead>{t('table.progress')}</TableHead>
                      <TableHead>{t('table.created')}</TableHead>
                      <TableHead className="w-20">{t('table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{batch.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(batch.status)}
                            <Badge variant={getStatusVariant(batch.status)}>
                              {batch.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {batch.processedCount || 0} / {batch.totalRecords || 0}
                            </div>
                            {(batch.importErrors?.length ?? 0) > 0 && (
                              <div className="text-red-600">
                                {batch.importErrors?.length ?? 0} errors
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={cn(
                                  "h-2 rounded-full transition-all",
                                  batch.status === 'COMPLETED' ? "bg-green-500" :
                                  batch.status === 'FAILED' ? "bg-red-500" :
                                  batch.status === 'PROCESSING' ? "bg-blue-500" :
                                  "bg-gray-400"
                                )}
                                style={{ width: `${getProgressPercentage(batch)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {getProgressPercentage(batch)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(batch.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewDetails?.(batch.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t('viewDetails')}
                              </DropdownMenuItem>
                              {batch.status === 'FAILED' && onRetryBatch && (
                                <DropdownMenuItem onClick={() => onRetryBatch(batch.id)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  {t('retryImport')}
                                </DropdownMenuItem>
                              )}
                              {(batch.importErrors?.length ?? 0) > 0 && onDownloadErrors && (
                                <DropdownMenuItem onClick={() => onDownloadErrors(batch.id)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  {t('downloadErrors')}
                                </DropdownMenuItem>
                              )}
                              {onDeleteBatch && (
                                <DropdownMenuItem 
                                  onClick={() => onDeleteBatch(batch.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('deleteImport')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-600">{analytics.totalImports}</div>
                  <div className="text-sm text-blue-700">{t('analytics.totalImports')}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">{analytics.completedImports}</div>
                  <div className="text-sm text-green-700">{t('analytics.completed')}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 text-center">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
                  <div className="text-2xl font-bold text-red-600">{analytics.failedImports}</div>
                  <div className="text-sm text-red-700">{t('analytics.failed')}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-600">{analytics.successRate}%</div>
                  <div className="text-sm text-purple-700">{t('analytics.successRate')}</div>
                </CardContent>
              </Card>
            </div>

            {/* Record Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('analytics.recordStatistics')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{t('analytics.totalRecordsProcessed')}</span>
                      <span className="text-2xl font-bold">{analytics.totalRecords.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{t('analytics.successfulRecords')}</span>
                      <span className="text-2xl font-bold text-green-600">
                        {analytics.successfulRecords.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{t('analytics.failedRecords')}</span>
                      <span className="text-2xl font-bold text-red-600">
                        {(analytics.totalRecords - analytics.successfulRecords).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-lg font-medium mb-2">{t('analytics.overallSuccessRate')}</div>
                      <div className="relative w-32 h-32 mx-auto">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            strokeDasharray={`${analytics.successRate}, 100`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold">{analytics.successRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}