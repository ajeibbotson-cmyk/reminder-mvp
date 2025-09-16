'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Globe2,
  RefreshCw,
  Download,
  Filter,
  Settings,
  Moon,
  Sun,
  Languages,
  MapPin,
  Activity
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Import other analytics components
import { PaymentPerformanceChart } from './PaymentPerformanceChart'
import { InvoiceAgingChart } from './InvoiceAgingChart'
import { CustomerInsightsPanel } from './CustomerInsightsPanel'
import { UAEBusinessIntelligence } from './UAEBusinessIntelligence'
import { RealTimeMetrics } from './RealTimeMetrics'
import { KPICards } from './KPICards'

// Import utilities
import { cn } from '@/lib/utils'
import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'

interface MainAnalyticsDashboardProps {
  companyId: string
  locale?: string
  className?: string
}

interface DashboardData {
  kpis: {
    paymentDelayReduction: number
    targetReduction: number
    totalRevenue: number
    activeInvoices: number
    customerSatisfaction: number
    cultureCompliance: number
    avgPaymentTime: number
    collectionEfficiency: number
  }
  trends: {
    paymentReduction: { period: string; value: number; target: number }[]
    revenueGrowth: { period: string; value: number }[]
    complianceScore: { period: string; value: number }[]
  }
  realTime: {
    activeReminders: number
    todayCollections: number
    systemHealth: number
    lastUpdated: string
  }
  uaeSpecific: {
    prayerTimeCompliance: number
    ramadanAdjustments: number
    businessHoursOptimization: number
    culturalSentimentScore: number
  }
}

export function MainAnalyticsDashboard({
  companyId,
  locale = 'en',
  className
}: MainAnalyticsDashboardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State management
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(searchParams?.get('dateRange') || '30')
  const [selectedKPI, setSelectedKPI] = useState('overview')
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Language and localization
  const [currentLang, setCurrentLang] = useState<'en' | 'ar'>(locale as 'en' | 'ar')
  const isRTL = currentLang === 'ar'

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/analytics/dashboard?` + new URLSearchParams({
        dateRange,
        companyId,
        locale: currentLang,
        includeRealTime: 'true'
      }))

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      setDashboardData(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  // Initial data fetch and real-time updates
  useEffect(() => {
    fetchDashboardData()
  }, [companyId, dateRange, currentLang])

  // Real-time updates every 30 seconds
  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      fetchDashboardData()
    }, 30000)

    return () => clearInterval(interval)
  }, [isRealTimeEnabled, companyId, dateRange, currentLang])

  // Calculate payment reduction progress
  const paymentReductionProgress = useMemo(() => {
    if (!dashboardData) return 0
    const current = dashboardData.kpis.paymentDelayReduction
    const target = dashboardData.kpis.targetReduction
    return Math.min((current / target) * 100, 100)
  }, [dashboardData])

  // Handle language toggle
  const toggleLanguage = () => {
    const newLang = currentLang === 'en' ? 'ar' : 'en'
    setCurrentLang(newLang)

    // Update URL to reflect language change
    const params = new URLSearchParams(searchParams?.toString())
    params.set('locale', newLang)
    router.push(`?${params.toString()}`)
  }

  // Handle date range change
  const handleDateRangeChange = (newRange: string) => {
    setDateRange(newRange)
    const params = new URLSearchParams(searchParams?.toString())
    params.set('dateRange', newRange)
    router.push(`?${params.toString()}`)
  }

  // Export functionality
  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          section: 'comprehensive',
          dateRange,
          companyId,
          locale: currentLang,
          includeCharts: true
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `analytics-dashboard-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  if (error) {
    return (
      <div className={cn("space-y-6", className)}>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {currentLang === 'ar'
              ? `خطأ في تحميل بيانات لوحة التحكم: ${error}`
              : `Error loading dashboard data: ${error}`
            }
          </AlertDescription>
        </Alert>
        <Button onClick={() => fetchDashboardData()} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          {currentLang === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl", className)}>
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {currentLang === 'ar'
              ? 'لوحة تحكم التحليلات المتقدمة'
              : 'Advanced Analytics Dashboard'
            }
          </h1>
          <p className="text-muted-foreground">
            {currentLang === 'ar'
              ? 'تحليلات شاملة لتحصيل المدفوعات في دولة الإمارات مع هدف تقليل التأخير بنسبة 25%'
              : 'Comprehensive UAE payment collection analytics targeting 25% delay reduction'
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="min-w-[120px]"
          >
            <Languages className="h-4 w-4 mr-2" />
            {currentLang === 'ar' ? 'English' : 'العربية'}
          </Button>

          {/* Date Range Selector */}
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">
                {currentLang === 'ar' ? 'آخر 7 أيام' : 'Last 7 days'}
              </SelectItem>
              <SelectItem value="30">
                {currentLang === 'ar' ? 'آخر 30 يوم' : 'Last 30 days'}
              </SelectItem>
              <SelectItem value="90">
                {currentLang === 'ar' ? 'آخر 90 يوم' : 'Last 90 days'}
              </SelectItem>
              <SelectItem value="365">
                {currentLang === 'ar' ? 'آخر سنة' : 'Last year'}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Real-time Toggle */}
          <Button
            variant={isRealTimeEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
          >
            <Activity className="h-4 w-4 mr-2" />
            {currentLang === 'ar'
              ? (isRealTimeEnabled ? 'مباشر' : 'غير مباشر')
              : (isRealTimeEnabled ? 'Live' : 'Offline')
            }
          </Button>

          {/* Export Button */}
          <Select onValueChange={handleExport}>
            <SelectTrigger className="w-[120px]">
              <Download className="h-4 w-4 mr-2" />
              <SelectValue placeholder={currentLang === 'ar' ? 'تصدير' : 'Export'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {currentLang === 'ar' ? 'مؤشرات الأداء الرئيسية' : 'Key Performance Indicators'}
          </h2>
          {lastRefresh && (
            <p className="text-sm text-muted-foreground">
              {currentLang === 'ar' ? 'آخر تحديث: ' : 'Last updated: '}
              {lastRefresh.toLocaleTimeString(currentLang === 'ar' ? 'ar-AE' : 'en-AE')}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <KPICards
            data={dashboardData}
            locale={currentLang}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Payment Delay Reduction Progress */}
      {dashboardData && (
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  {currentLang === 'ar'
                    ? 'هدف تقليل تأخير المدفوعات بنسبة 25%'
                    : '25% Payment Delay Reduction Goal'
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentLang === 'ar'
                    ? `تحقيق ${dashboardData.kpis.paymentDelayReduction}% من الهدف ${dashboardData.kpis.targetReduction}%`
                    : `Achieved ${dashboardData.kpis.paymentDelayReduction}% of ${dashboardData.kpis.targetReduction}% target`
                  }
                </p>
              </div>

              <div className="flex-1 lg:max-w-md space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{formatPercentage(dashboardData.kpis.paymentDelayReduction)}</span>
                  <span>{formatPercentage(dashboardData.kpis.targetReduction)}</span>
                </div>
                <Progress
                  value={paymentReductionProgress}
                  className="h-3"
                />
              </div>

              <Badge
                variant={paymentReductionProgress >= 100 ? "default" : "secondary"}
                className="text-sm px-3 py-1"
              >
                {paymentReductionProgress >= 100
                  ? (currentLang === 'ar' ? '✅ تم تحقيق الهدف' : '✅ Goal Achieved')
                  : (currentLang === 'ar' ? '🎯 قيد التقدم' : '🎯 In Progress')
                }
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="overview">
            {currentLang === 'ar' ? 'نظرة عامة' : 'Overview'}
          </TabsTrigger>
          <TabsTrigger value="payments">
            {currentLang === 'ar' ? 'المدفوعات' : 'Payments'}
          </TabsTrigger>
          <TabsTrigger value="customers">
            {currentLang === 'ar' ? 'العملاء' : 'Customers'}
          </TabsTrigger>
          <TabsTrigger value="uae-insights">
            {currentLang === 'ar' ? 'رؤى الإمارات' : 'UAE Insights'}
          </TabsTrigger>
          <TabsTrigger value="real-time">
            {currentLang === 'ar' ? 'مباشر' : 'Real-time'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PaymentPerformanceChart
              companyId={companyId}
              dateRange={dateRange}
              locale={currentLang}
              data={dashboardData?.trends.paymentReduction}
            />
            <InvoiceAgingChart
              companyId={companyId}
              dateRange={dateRange}
              locale={currentLang}
            />
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <PaymentPerformanceChart
            companyId={companyId}
            dateRange={dateRange}
            locale={currentLang}
            data={dashboardData?.trends.paymentReduction}
            detailed={true}
          />
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <CustomerInsightsPanel
            companyId={companyId}
            dateRange={dateRange}
            locale={currentLang}
          />
        </TabsContent>

        <TabsContent value="uae-insights" className="space-y-6">
          <UAEBusinessIntelligence
            companyId={companyId}
            dateRange={dateRange}
            locale={currentLang}
            data={dashboardData?.uaeSpecific}
          />
        </TabsContent>

        <TabsContent value="real-time" className="space-y-6">
          <RealTimeMetrics
            companyId={companyId}
            locale={currentLang}
            isEnabled={isRealTimeEnabled}
            data={dashboardData?.realTime}
          />
        </TabsContent>
      </Tabs>

      {/* UAE Business Context Footer */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <Globe2 className="h-4 w-4" />
              <span className="font-medium">
                {currentLang === 'ar'
                  ? 'متوافق مع الثقافة الإماراتية'
                  : 'UAE Culture Compliant'
                }
              </span>
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Moon className="h-3 w-3" />
                <span>
                  {currentLang === 'ar' ? 'متوافق مع أوقات الصلاة' : 'Prayer-time aware'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>
                  {currentLang === 'ar' ? 'توقيت دولة الإمارات' : 'UAE Timezone (GST)'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default MainAnalyticsDashboard