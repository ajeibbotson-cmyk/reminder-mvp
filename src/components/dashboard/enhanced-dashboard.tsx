'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Mail, FileText, 
  Users, BarChart3, PieChart, Calendar, Filter, Download,
  CheckSquare, AlertCircle, Send, Eye, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AEDAmount, UAEDateDisplay, InvoiceStatusBadge } from '@/components/ui/uae-formatters'
import { ImportInterface } from '@/components/invoices/import-interface'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { useImportBatchStore } from '@/lib/stores/import-batch-store'
import { useEmailDeliveryStore } from '@/lib/stores/email-delivery-store'
import { cn } from '@/lib/utils'

interface EnhancedDashboardProps {
  companyId: string
  locale?: string
}

interface DashboardMetrics {
  totalOutstanding: number
  overdueAmount: number
  avgDaysToCollection: number
  totalInvoices: number
  paidInvoices: number
  overdueInvoices: number
  thisMonthCollections: number
  lastMonthCollections: number
  emailsSent: number
  emailOpenRate: number
  paymentRate: number
}

export function EnhancedDashboard({ companyId, locale = 'en' }: EnhancedDashboardProps) {
  const t = useTranslations('dashboard')
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalOutstanding: 0,
    overdueAmount: 0,
    avgDaysToCollection: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    thisMonthCollections: 0,
    lastMonthCollections: 0,
    emailsSent: 0,
    emailOpenRate: 0,
    paymentRate: 0,
  })
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [showImportInterface, setShowImportInterface] = useState(false)
  const [recentImports, setRecentImports] = useState<any[]>([])
  const [emailAnalytics, setEmailAnalytics] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { invoices, fetchInvoices, bulkUpdateStatus } = useInvoiceStore()
  const { batches, fetchBatches } = useImportBatchStore()
  const { deliveries, analytics, fetchDeliveries, fetchAnalytics } = useEmailDeliveryStore()

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          fetchInvoices(companyId),
          fetchBatches(companyId),
          fetchDeliveries(companyId),
          fetchAnalytics(companyId, selectedPeriod)
        ])
        
        // Calculate metrics from loaded data
        calculateMetrics()
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [companyId, selectedPeriod, fetchInvoices, fetchBatches, fetchDeliveries, fetchAnalytics])

  const calculateMetrics = () => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

    const totalOutstanding = invoices
      .filter(inv => ['PENDING', 'OVERDUE'].includes(inv.status))
      .reduce((sum, inv) => sum + inv.totalAmount, 0)

    const overdueAmount = invoices
      .filter(inv => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + inv.totalAmount, 0)

    const paidInvoices = invoices.filter(inv => inv.status === 'PAID')
    const overdueInvoices = invoices.filter(inv => inv.status === 'OVERDUE')

    const thisMonthCollections = invoices
      .filter(inv => {
        const paidDate = inv.paidDate ? new Date(inv.paidDate) : null
        return paidDate && 
               paidDate.getMonth() === thisMonth && 
               paidDate.getFullYear() === thisYear
      })
      .reduce((sum, inv) => sum + inv.totalAmount, 0)

    const lastMonthCollections = invoices
      .filter(inv => {
        const paidDate = inv.paidDate ? new Date(inv.paidDate) : null
        return paidDate && 
               paidDate.getMonth() === lastMonth && 
               paidDate.getFullYear() === lastMonthYear
      })
      .reduce((sum, inv) => sum + inv.totalAmount, 0)

    // Calculate average days to collection
    const avgDaysToCollection = paidInvoices.length > 0 
      ? paidInvoices.reduce((sum, inv) => {
          const issueDate = new Date(inv.issueDate)
          const paidDate = new Date(inv.paidDate!)
          const daysToCollection = Math.ceil((paidDate.getTime() - issueDate.getTime()) / (1000 * 3600 * 24))
          return sum + daysToCollection
        }, 0) / paidInvoices.length
      : 0

    setMetrics({
      totalOutstanding,
      overdueAmount,
      avgDaysToCollection,
      totalInvoices: invoices.length,
      paidInvoices: paidInvoices.length,
      overdueInvoices: overdueInvoices.length,
      thisMonthCollections,
      lastMonthCollections,
      emailsSent: deliveries.length,
      emailOpenRate: analytics?.openRate || 0,
      paymentRate: analytics?.paymentRate || 0,
    })

    setRecentImports(batches.slice(0, 5))
    setEmailAnalytics(analytics?.recentCampaigns || [])
  }

  const handleBulkOperation = async (operation: string, invoiceIds: string[]) => {
    try {
      switch (operation) {
        case 'mark-paid':
          await bulkUpdateStatus(invoiceIds, 'PAID')
          break
        case 'send-reminder':
          // Send reminder emails
          break
        case 'mark-overdue':
          await bulkUpdateStatus(invoiceIds, 'OVERDUE')
          break
        default:
          break
      }
      await fetchInvoices(companyId) // Refresh data
    } catch (error) {
      console.error('Bulk operation failed:', error)
    }
  }

  const getCollectionTrend = () => {
    const trend = metrics.thisMonthCollections - metrics.lastMonthCollections
    const percentage = metrics.lastMonthCollections > 0 
      ? (trend / metrics.lastMonthCollections) * 100 
      : 0
    
    return {
      value: Math.abs(percentage),
      isPositive: trend >= 0,
      amount: trend
    }
  }

  const getPaymentRate = () => {
    return metrics.totalInvoices > 0 
      ? (metrics.paidInvoices / metrics.totalInvoices) * 100 
      : 0
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    )
  }

  const collectionTrend = getCollectionTrend()
  const paymentRate = getPaymentRate()

  return (
    <div className={cn("space-y-6", locale === 'ar' && "text-right")}>
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('enhancedDashboard')}</h1>
          <p className="text-gray-600">{t('dashboardDescription')}</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('last7Days')}</SelectItem>
              <SelectItem value="30d">{t('last30Days')}</SelectItem>
              <SelectItem value="90d">{t('last90Days')}</SelectItem>
              <SelectItem value="1y">{t('lastYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowImportInterface(true)}>
            <FileText className="h-4 w-4 mr-2" />
            {t('importInvoices')}
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalOutstanding')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AEDAmount amount={metrics.totalOutstanding} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('fromInvoices', { count: metrics.totalInvoices - metrics.paidInvoices })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('overdueAmount')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              <AEDAmount amount={metrics.overdueAmount} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('fromInvoices', { count: metrics.overdueInvoices })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('avgCollectionTime')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.avgDaysToCollection)} {t('days')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('averageTimeToPayment')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentRate.toFixed(1)}%</div>
            <Progress value={paymentRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Collection Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('collectionTrends')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('thisMonth')}</span>
                <AEDAmount amount={metrics.thisMonthCollections} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('lastMonth')}</span>
                <AEDAmount amount={metrics.lastMonthCollections} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">{t('change')}</span>
                <div className="flex items-center gap-2">
                  {collectionTrend.isPositive ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={cn(
                    "font-medium",
                    collectionTrend.isPositive ? "text-green-600" : "text-red-600"
                  )}>
                    {collectionTrend.value.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t('emailPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('emailsSent')}</span>
                <Badge variant="outline">{metrics.emailsSent}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('openRate')}</span>
                <span className="font-medium">{metrics.emailOpenRate.toFixed(1)}%</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('engagement')}</span>
                  <span>{metrics.emailOpenRate.toFixed(1)}%</span>
                </div>
                <Progress value={metrics.emailOpenRate} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-gray-600">{t('paymentRate')}</span>
                <span className="font-medium text-green-600">
                  {metrics.paymentRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="imports" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="imports">{t('recentImports')}</TabsTrigger>
          <TabsTrigger value="emails">{t('emailActivity')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics')}</TabsTrigger>
        </TabsList>

        <TabsContent value="imports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('recentImports')}
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowImportInterface(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('newImport')}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentImports.length > 0 ? (
                <div className="space-y-4">
                  {recentImports.map((batch) => (
                    <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{batch.fileName}</span>
                          <Badge variant={batch.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {batch.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {t('imported')} {batch.processedCount} {t('of')} {batch.totalRecords} {t('invoices')}
                        </div>
                      </div>
                      <div className="text-right">
                        <UAEDateDisplay date={batch.createdAt} format="short" />
                        {batch.status === 'PROCESSING' && (
                          <Progress value={(batch.processedCount / batch.totalRecords) * 100} className="w-24 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noRecentImports')}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowImportInterface(true)}>
                    {t('startFirstImport')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {t('recentEmailActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emailAnalytics.length > 0 ? (
                <div className="space-y-4">
                  {emailAnalytics.map((campaign: any) => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{campaign.templateName}</span>
                          <Badge variant="outline">{campaign.type}</Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {t('sent')} {campaign.sentCount} {t('emails')} • 
                          {t('opened')} {campaign.openCount} ({((campaign.openCount / campaign.sentCount) * 100).toFixed(1)}%)
                        </div>
                      </div>
                      <div className="text-right">
                        <UAEDateDisplay date={campaign.sentAt} format="short" />
                        <div className="flex items-center gap-2 mt-1">
                          <Eye className="h-3 w-3" />
                          <span className="text-xs">{campaign.clickCount} {t('clicks')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noEmailActivity')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  {t('invoiceStatusBreakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <InvoiceStatusBadge status="PAID" />
                      <span className="text-sm">{t('paid')}</span>
                    </div>
                    <span className="font-medium">{metrics.paidInvoices}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <InvoiceStatusBadge status="PENDING" />
                      <span className="text-sm">{t('pending')}</span>
                    </div>
                    <span className="font-medium">
                      {metrics.totalInvoices - metrics.paidInvoices - metrics.overdueInvoices}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <InvoiceStatusBadge status="OVERDUE" />
                      <span className="text-sm">{t('overdue')}</span>
                    </div>
                    <span className="font-medium">{metrics.overdueInvoices}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('uaeBusinessInsights')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('avgPaymentTime')}</span>
                    <span className="font-medium">{Math.round(metrics.avgDaysToCollection)} {t('days')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('bestCollectionDay')}</span>
                    <span className="font-medium">{t('tuesday')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('emailResponseRate')}</span>
                    <span className="font-medium">{metrics.emailOpenRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('peakBusinessHours')}</span>
                    <span className="font-medium">9 AM - 11 AM</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Import Interface Dialog */}
      {showImportInterface && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{t('importInvoices')}</h2>
                <Button variant="ghost" onClick={() => setShowImportInterface(false)}>
                  ×
                </Button>
              </div>
              <ImportInterface
                companyId={companyId}
                locale={locale}
                onImportComplete={() => {
                  setShowImportInterface(false)
                  fetchInvoices(companyId)
                  fetchBatches(companyId)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}