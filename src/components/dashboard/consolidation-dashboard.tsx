// Sprint 3: Frontend Agent - Customer-Grouped Consolidation Dashboard
// Mobile-responsive design for UAE business users

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart3, PieChart, TrendingUp, TrendingDown, Users, Mail,
  Clock, DollarSign, CheckCircle, AlertCircle, PlayCircle,
  PauseCircle, Settings, Filter, RefreshCw, Download, Eye,
  Calendar, ArrowRight, Plus, MoreVertical
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AEDAmount, UAEDateDisplay } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'
import { ConsolidationMetricsWidget } from './widgets/consolidation-metrics-widget'
import { CustomerConsolidationModal } from './modals/customer-consolidation-modal'
import { BulkActionsInterface } from './interfaces/bulk-actions-interface'
import { ConsolidationQueueManager } from './queue/consolidation-queue-manager'
import { ProfessionalLoading } from '@/components/ui/professional-loading'

interface ConsolidationDashboardProps {
  companyId: string
  locale?: string
}

interface DashboardData {
  analytics: {
    totalConsolidations: number
    totalAmountConsolidated: number
    avgInvoicesPerConsolidation: number
    emailSavingsPercentage: number
    paymentSuccessRate: number
    responseRate: number
    queuedConsolidations: number
    scheduledConsolidations: number
    highPriorityPending: number
    trendsData: {
      date: string
      consolidations: number
      amount: number
      emailsSaved: number
    }[]
    periodComparison: {
      consolidationsChange: number
      amountChange: number
      successRateChange: number
    }
  }
  customers: {
    customerId: string
    customerName: string
    email: string
    totalConsolidations: number
    totalAmount: number
    effectivenessScore: number
    lastActivity: string
    pendingConsolidations: number
    consolidationPreference: string
    status: 'active' | 'pending' | 'inactive'
  }[]
  queue: {
    id: string
    customerId: string
    customerName: string
    invoiceCount: number
    totalAmount: number
    scheduledFor: string
    priorityScore: number
    escalationLevel: string
    status: string
  }[]
}

// Safe number formatter to prevent undefined errors
const safeToFixed = (value: number | undefined | null, decimals = 1): string => {
  return (value || 0).toFixed(decimals)
}

// Safe array length checker
const safeLength = (arr: any[] | undefined | null): number => {
  return arr?.length || 0
}

export function ConsolidationDashboard({ companyId, locale = 'en' }: ConsolidationDashboardProps) {
  const t = useTranslations('consolidation')
  const [data, setData] = useState<DashboardData>({
    analytics: {
      totalConsolidations: 0, totalAmountConsolidated: 0, avgInvoicesPerConsolidation: 0,
      emailSavingsPercentage: 0, paymentSuccessRate: 0, responseRate: 0,
      queuedConsolidations: 0, scheduledConsolidations: 0, highPriorityPending: 0,
      trendsData: [], periodComparison: { consolidationsChange: 0, amountChange: 0, successRateChange: 0 }
    },
    customers: [],
    queue: []
  })
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'customers' | 'queue' | 'analytics'>('customers')
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Load dashboard data
  useEffect(() => {
    loadDashboardData()
  }, [companyId, selectedPeriod])

  // Auto-refresh every 2 minutes for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData(false) // Silent refresh
    }, 120000)
    return () => clearInterval(interval)
  }, [companyId, selectedPeriod])

  const loadDashboardData = async (showLoader = true) => {
    if (showLoader) setIsLoading(true)

    try {
      // Parallel API calls for performance
      const [analyticsRes, customersRes, queueRes] = await Promise.all([
        fetch(`/api/analytics/consolidation/dashboard?period=${selectedPeriod}&includeCustomerBreakdown=true`),
        fetch(`/api/customers/consolidation-analytics?companyId=${companyId}`),
        fetch(`/api/consolidation/queue?companyId=${companyId}&status=pending,scheduled`)
      ])

      const [analytics, customers, queue] = await Promise.all([
        analyticsRes.json(),
        customersRes.json(),
        queueRes.json()
      ])

      setData({
        analytics: analytics.data || {
          totalConsolidations: 0, totalAmountConsolidated: 0, avgInvoicesPerConsolidation: 0,
          emailSavingsPercentage: 0, paymentSuccessRate: 0, responseRate: 0,
          queuedConsolidations: 0, scheduledConsolidations: 0, highPriorityPending: 0,
          trendsData: [], periodComparison: { consolidationsChange: 0, amountChange: 0, successRateChange: 0 }
        },
        customers: customers.data || [],
        queue: queue.data || []
      })
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      if (showLoader) setIsLoading(false)
    }
  }

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customerId)
  }

  const handleBulkAction = async (action: string, itemIds: string[]) => {
    try {
      const response = await fetch('/api/consolidation/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: action,
          consolidationIds: itemIds,
          parameters: {} // Would include action-specific parameters
        })
      })

      if (response.ok) {
        await loadDashboardData()
        setSelectedItems([])
        setShowBulkActions(false)
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ProfessionalLoading
          variant="branded"
          size="lg"
          message={t('loading')}
          showBrand
        />
      </div>
    )
  }

  const isRTL = locale === 'ar'

  return (
    <div className={cn("space-y-4 md:space-y-6 p-4 md:p-0", isRTL && "text-right")}>
      {/* Mobile-Optimized Header with Controls */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm md:text-base text-gray-600">{t('dashboard.description')}</p>
          <div className="flex items-center gap-2 mt-2 text-xs md:text-sm text-gray-500">
            <Clock className="h-3 w-3 md:h-4 md:w-4" />
            <span>{t('lastUpdated')}: <UAEDateDisplay date={lastRefresh} format="time" /></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('periods.7days')}</SelectItem>
              <SelectItem value="30d">{t('periods.30days')}</SelectItem>
              <SelectItem value="90d">{t('periods.90days')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <Button variant="outline" onClick={() => loadDashboardData()} className="text-xs md:text-sm">
              <RefreshCw className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('refresh')}</span>
              <span className="sm:hidden">{t('refreshShort')}</span>
            </Button>

            <Button className="text-xs md:text-sm">
              <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('createConsolidation')}</span>
              <span className="sm:hidden">{t('create')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile-Optimized Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <ConsolidationMetricsWidget
          title={t('metrics.totalConsolidations')}
          value={data.analytics?.totalConsolidations || 0}
          change={data.analytics?.periodComparison?.consolidationsChange || 0}
          icon={<Mail className="h-3 w-3 md:h-4 md:w-4" />}
          format="number"
          size="small"
          className="md:!p-4"
        />

        <ConsolidationMetricsWidget
          title={t('metrics.totalAmount')}
          value={data.analytics?.totalAmountConsolidated || 0}
          change={data.analytics?.periodComparison?.amountChange || 0}
          icon={<DollarSign className="h-3 w-3 md:h-4 md:w-4" />}
          format="currency"
          size="small"
          className="md:!p-4"
        />

        <ConsolidationMetricsWidget
          title={t('metrics.emailSavings')}
          value={data.analytics?.emailSavingsPercentage || 0}
          icon={<TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-500" />}
          format="percentage"
          description={t('metrics.emailSavingsDesc')}
          size="small"
          className="md:!p-4"
        />

        <ConsolidationMetricsWidget
          title={t('metrics.successRate')}
          value={data.analytics?.paymentSuccessRate || 0}
          change={data.analytics?.periodComparison?.successRateChange || 0}
          icon={<CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-500" />}
          format="percentage"
          size="small"
          className="md:!p-4"
        />
      </div>

      {/* Mobile-Optimized Queue Status Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium text-blue-600">{t('queue.queued')}</p>
                <p className="text-lg md:text-2xl font-bold text-blue-700">{data.analytics?.queuedConsolidations || 0}</p>
              </div>
              <PlayCircle className="h-5 w-5 md:h-8 md:w-8 text-blue-500 mt-1 md:mt-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium text-orange-600">{t('queue.scheduled')}</p>
                <p className="text-lg md:text-2xl font-bold text-orange-700">{data.analytics?.scheduledConsolidations || 0}</p>
              </div>
              <Calendar className="h-5 w-5 md:h-8 md:w-8 text-orange-500 mt-1 md:mt-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium text-red-600">{t('queue.highPriority')}</p>
                <p className="text-lg md:text-2xl font-bold text-red-700">{data.analytics?.highPriorityPending || 0}</p>
              </div>
              <AlertCircle className="h-5 w-5 md:h-8 md:w-8 text-red-500 mt-1 md:mt-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile-Optimized Main Content Tabs */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)} className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="grid grid-cols-3 w-full md:max-w-md">
            <TabsTrigger value="customers" className="text-xs md:text-sm">
              <span className="hidden sm:inline">{t('tabs.customers')}</span>
              <span className="sm:hidden">{t('tabs.customersShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="queue" className="text-xs md:text-sm">
              <span className="hidden sm:inline">{t('tabs.queue')}</span>
              <span className="sm:hidden">{t('tabs.queueShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs md:text-sm">
              <span className="hidden sm:inline">{t('tabs.analytics')}</span>
              <span className="sm:hidden">{t('tabs.analyticsShort')}</span>
            </TabsTrigger>
          </TabsList>

          {safeLength(selectedItems) > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowBulkActions(true)}
              className="w-full md:w-auto text-xs md:text-sm"
            >
              {t('bulkActions')} ({safeLength(selectedItems)})
            </Button>
          )}
        </div>

        {/* Customers View */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('customers.title')}
                  </CardTitle>
                  <CardDescription>{t('customers.description')}</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  {t('filter')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safeLength(data.customers) > 0 ? (
                  <div className="grid gap-4">
                    {data.customers.map((customer) => (
                      <div
                        key={customer.customerId}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleCustomerSelect(customer.customerId)}
                      >
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{customer.customerName || 'Unknown Customer'}</span>
                              <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                                {customer.status || 'inactive'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{customer.email || 'No email'}</p>
                          </div>

                          <div className="text-center">
                            <p className="font-medium">{customer.totalConsolidations || 0}</p>
                            <p className="text-sm text-gray-600">{t('customers.consolidations')}</p>
                          </div>

                          <div className="text-center">
                            <p className="font-medium">
                              <AEDAmount amount={customer.totalAmount || 0} />
                            </p>
                            <p className="text-sm text-gray-600">{t('customers.totalAmount')}</p>
                          </div>

                          <div className="text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Progress value={customer.effectivenessScore || 0} className="h-2" />
                              </div>
                              <span className="text-sm font-medium">{customer.effectivenessScore || 0}%</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{t('customers.effectiveness')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {(customer.pendingConsolidations || 0) > 0 && (
                            <Badge variant="outline" className="text-orange-600">
                              {customer.pendingConsolidations || 0} {t('pending')}
                            </Badge>
                          )}
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('customers.noData')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Management View */}
        <TabsContent value="queue" className="space-y-6">
          <ConsolidationQueueManager
            queue={data.queue || []}
            onSelectionChange={setSelectedItems}
            onBulkAction={handleBulkAction}
            locale={locale}
          />
        </TabsContent>

        {/* Analytics View */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('analytics.consolidationTrends')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  {/* Chart component would go here */}
                  <p>{t('analytics.chartPlaceholder')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  {t('analytics.emailEfficiency')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>{t('analytics.averageInvoicesPerEmail')}</span>
                    <span className="font-medium">{safeToFixed(data.analytics?.avgInvoicesPerConsolidation)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('analytics.emailsSavedPercentage')}</span>
                    <span className="font-medium text-green-600">
                      {safeToFixed(data.analytics?.emailSavingsPercentage)}%
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-sm text-gray-600 mb-2">{t('analytics.responseRates')}</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">{t('analytics.emailResponseRate')}</span>
                        <span className="text-sm font-medium">{safeToFixed(data.analytics?.responseRate)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">{t('analytics.paymentSuccessRate')}</span>
                        <span className="text-sm font-medium">{safeToFixed(data.analytics?.paymentSuccessRate)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerConsolidationModal
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          locale={locale}
        />
      )}

      {/* Bulk Actions Interface */}
      {showBulkActions && (
        <BulkActionsInterface
          selectedItems={selectedItems}
          onAction={handleBulkAction}
          onClose={() => setShowBulkActions(false)}
          locale={locale}
        />
      )}
    </div>
  )
}