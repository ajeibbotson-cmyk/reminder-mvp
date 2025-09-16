'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  Bar,
  BarChart
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Zap
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface PaymentPerformanceChartProps {
  companyId: string
  dateRange: string
  locale: 'en' | 'ar'
  data?: Array<{ period: string; value: number; target: number }>
  detailed?: boolean
  className?: string
}

interface PaymentData {
  date: string
  delayReduction: number
  target: number
  avgPaymentDays: number
  collectedAmount: number
  overdueAmount: number
  projectedReduction: number
  businessDaysOptimized: number
  culturalCompliance: number
}

interface PaymentInsight {
  type: 'success' | 'warning' | 'improvement'
  title: string
  description: string
  impact: string
  action?: string
}

const PaymentPerformanceChart: React.FC<PaymentPerformanceChartProps> = ({
  companyId,
  dateRange,
  locale,
  data: propData,
  detailed = false,
  className
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [paymentData, setPaymentData] = useState<PaymentData[]>([])
  const [insights, setInsights] = useState<PaymentInsight[]>([])
  const [selectedMetric, setSelectedMetric] = useState<string>('delay-reduction')
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'insights'>('chart')

  const isRTL = locale === 'ar'

  // Fetch payment performance data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        const response = await fetch(`/api/analytics/payments?` + new URLSearchParams({
          companyId,
          dateRange,
          locale,
          includeProjections: 'true',
          includeUAEMetrics: 'true'
        }))

        if (!response.ok) throw new Error('Failed to fetch payment data')

        const result = await response.json()

        // Transform API data to chart format
        const transformedData: PaymentData[] = result.performanceData?.map((item: any) => ({
          date: item.date,
          delayReduction: item.delayReduction || 0,
          target: 25, // 25% target goal
          avgPaymentDays: item.averagePaymentDays || 0,
          collectedAmount: item.collectedAmount || 0,
          overdueAmount: item.overdueAmount || 0,
          projectedReduction: item.projectedReduction || 0,
          businessDaysOptimized: item.businessDaysOptimized || 0,
          culturalCompliance: item.culturalCompliance || 0
        })) || []

        setPaymentData(transformedData)
        setInsights(result.insights || [])

      } catch (error) {
        console.error('Error fetching payment data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [companyId, dateRange, locale])

  // Calculate key metrics
  const metrics = useMemo(() => {
    if (paymentData.length === 0) return null

    const latest = paymentData[paymentData.length - 1]
    const previous = paymentData[paymentData.length - 2] || latest

    const currentReduction = latest.delayReduction
    const previousReduction = previous.delayReduction
    const trend = currentReduction - previousReduction
    const progressToTarget = Math.min((currentReduction / 25) * 100, 100)

    const totalCollected = paymentData.reduce((sum, item) => sum + item.collectedAmount, 0)
    const avgComplianceScore = paymentData.reduce((sum, item) => sum + item.culturalCompliance, 0) / paymentData.length

    return {
      currentReduction,
      trend,
      progressToTarget,
      totalCollected,
      avgPaymentDays: latest.avgPaymentDays,
      avgComplianceScore,
      isOnTrack: currentReduction >= 20, // On track if 80% of target
      daysAhead: Math.max(0, currentReduction - 20)
    }
  }, [paymentData])

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
        <p className="font-medium mb-2">
          {new Date(label).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
            month: 'short',
            day: 'numeric'
          })}
        </p>
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}: {formatPercentage(item.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Render insight cards
  const renderInsights = () => (
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <Card key={index} className={cn(
          "border-l-4",
          insight.type === 'success' && "border-l-green-500 bg-green-50 dark:bg-green-950",
          insight.type === 'warning' && "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950",
          insight.type === 'improvement' && "border-l-blue-500 bg-blue-50 dark:bg-blue-950"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {insight.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />}
              {insight.type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />}
              {insight.type === 'improvement' && <Zap className="h-5 w-5 text-blue-600 mt-0.5" />}

              <div className="flex-1">
                <h4 className="font-medium mb-1">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {locale === 'ar' ? 'التأثير: ' : 'Impact: '}{insight.impact}
                  </Badge>
                  {insight.action && (
                    <Button variant="ghost" size="sm" className="text-xs h-auto p-1">
                      {insight.action}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />
            <div className="h-64 bg-gray-100 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl", className)}>
      {/* Header with key metrics */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                {locale === 'ar'
                  ? 'أداء تقليل تأخير المدفوعات'
                  : 'Payment Delay Reduction Performance'
                }
              </CardTitle>
              <CardDescription className="mt-1">
                {locale === 'ar'
                  ? 'تتبع التقدم نحو هدف تقليل تأخير المدفوعات بنسبة 25%'
                  : 'Track progress toward 25% payment delay reduction goal'
                }
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chart">
                    {locale === 'ar' ? 'الرسم البياني' : 'Chart'}
                  </SelectItem>
                  <SelectItem value="insights">
                    {locale === 'ar' ? 'الرؤى' : 'Insights'}
                  </SelectItem>
                </SelectContent>
              </Select>

              {detailed && (
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delay-reduction">
                      {locale === 'ar' ? 'تقليل التأخير' : 'Delay Reduction'}
                    </SelectItem>
                    <SelectItem value="payment-days">
                      {locale === 'ar' ? 'أيام الدفع' : 'Payment Days'}
                    </SelectItem>
                    <SelectItem value="compliance">
                      {locale === 'ar' ? 'الامتثال الثقافي' : 'Cultural Compliance'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Current Reduction */}
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(metrics.currentReduction)}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {locale === 'ar' ? 'التقليل الحالي' : 'Current Reduction'}
                </div>
                <div className="flex items-center justify-center mt-1">
                  {metrics.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span className={cn(
                    "text-xs",
                    metrics.trend > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatPercentage(Math.abs(metrics.trend))}
                  </span>
                </div>
              </div>

              {/* Progress to Target */}
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(metrics.progressToTarget)}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  {locale === 'ar' ? 'التقدم للهدف' : 'Target Progress'}
                </div>
                <div className="mt-2">
                  <Progress value={metrics.progressToTarget} className="h-2" />
                </div>
              </div>

              {/* Average Payment Days */}
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.avgPaymentDays.toFixed(1)}
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  {locale === 'ar' ? 'أيام الدفع المتوسطة' : 'Avg Payment Days'}
                </div>
              </div>

              {/* Total Collected */}
              <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">
                  {formatAEDCurrency(metrics.totalCollected)}
                </div>
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  {locale === 'ar' ? 'إجمالي المحصل' : 'Total Collected'}
                </div>
              </div>
            </div>
          )}

          {/* Goal Achievement Alert */}
          {metrics && (
            <Alert className={cn(
              "mb-6",
              metrics.isOnTrack ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"
            )}>
              {metrics.isOnTrack ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Info className="h-4 w-4 text-yellow-600" />
              )}
              <AlertDescription>
                {metrics.isOnTrack ? (
                  locale === 'ar'
                    ? `ممتاز! أنت على المسار الصحيح لتحقيق هدف 25%. متقدم بـ ${metrics.daysAhead.toFixed(1)}% عن الجدول الزمني.`
                    : `Excellent! You're on track to achieve the 25% goal. ${metrics.daysAhead.toFixed(1)}% ahead of schedule.`
                ) : (
                  locale === 'ar'
                    ? `تحتاج إلى تسريع الوتيرة لتحقيق هدف 25%. حاليًا عند ${formatPercentage(metrics.currentReduction)}.`
                    : `Need to accelerate pace to achieve 25% goal. Currently at ${formatPercentage(metrics.currentReduction)}.`
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Chart or Insights View */}
          {viewMode === 'chart' ? (
            <div className="space-y-6">
              {/* Main Performance Chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paymentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) =>
                        new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
                          month: 'short',
                          day: 'numeric'
                        })
                      }
                      stroke="#6b7280"
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    {/* Target line */}
                    <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" label="25% Target" />

                    {/* Actual reduction line */}
                    <Line
                      type="monotone"
                      dataKey="delayReduction"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      name={locale === 'ar' ? 'التقليل الفعلي' : 'Actual Reduction'}
                    />

                    {/* Projected reduction area */}
                    <Area
                      type="monotone"
                      dataKey="projectedReduction"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.2}
                      strokeDasharray="3 3"
                      name={locale === 'ar' ? 'التقليل المتوقع' : 'Projected Reduction'}
                    />

                    {/* Cultural compliance bars */}
                    {detailed && (
                      <Bar
                        dataKey="culturalCompliance"
                        fill="#8b5cf6"
                        fillOpacity={0.6}
                        name={locale === 'ar' ? 'الامتثال الثقافي' : 'Cultural Compliance'}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Secondary metrics if detailed view */}
              {detailed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Average Payment Days Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {locale === 'ar' ? 'اتجاه أيام الدفع' : 'Payment Days Trend'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={paymentData}>
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date) =>
                                new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
                                  month: 'short',
                                  day: 'numeric'
                                })
                              }
                            />
                            <YAxis />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="avgPaymentDays"
                              stroke="#f59e0b"
                              fill="#f59e0b"
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Collections vs Overdue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {locale === 'ar' ? 'المحصلات مقابل المستحق' : 'Collections vs Overdue'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={paymentData}>
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date) =>
                                new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
                                  month: 'short',
                                  day: 'numeric'
                                })
                              }
                            />
                            <YAxis />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="collectedAmount"
                              stackId="1"
                              stroke="#10b981"
                              fill="#10b981"
                              name={locale === 'ar' ? 'المحصل' : 'Collected'}
                            />
                            <Area
                              type="monotone"
                              dataKey="overdueAmount"
                              stackId="1"
                              stroke="#ef4444"
                              fill="#ef4444"
                              name={locale === 'ar' ? 'المستحق' : 'Overdue'}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            renderInsights()
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentPerformanceChart
export { PaymentPerformanceChart }