'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  AreaChart,
  LabelList
} from 'recharts'
import {
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  FileText,
  Moon,
  Sun,
  RefreshCw,
  Filter
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface InvoiceAgingChartProps {
  companyId: string
  dateRange: string
  locale: 'en' | 'ar'
  className?: string
}

interface AgingBucket {
  range: string
  current: number
  overdue: number
  count: number
  amount: number
  color: string
  uaeBusinessDays: number
  isWeekend: boolean
  prayerImpact: number
}

interface AgingData {
  buckets: AgingBucket[]
  summary: {
    totalInvoices: number
    totalAmount: number
    currentPercentage: number
    overduePercentage: number
    avgDaysOverdue: number
    worstPerformingBucket: string
  }
  trends: Array<{
    date: string
    current: number
    overdue: number
    weekend: number
    prayerTime: number
  }>
  uaeContext: {
    businessDaysOnly: boolean
    fridayImpact: number
    ramadanAdjustment: number
    holidayDays: number
  }
}

const InvoiceAgingChart: React.FC<InvoiceAgingChartProps> = ({
  companyId,
  dateRange,
  locale,
  className
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [agingData, setAgingData] = useState<AgingData | null>(null)
  const [viewType, setViewType] = useState<'pie' | 'bar' | 'trend'>('pie')
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [showUAEAdjustments, setShowUAEAdjustments] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isRTL = locale === 'ar'

  // UAE business day colors and labels
  const agingColors = {
    current: '#10b981', // Green for current
    '1-15': '#3b82f6',  // Blue for 1-15 days
    '16-30': '#f59e0b', // Orange for 16-30 days
    '31-60': '#ef4444', // Red for 31-60 days
    '61-90': '#8b5cf6', // Purple for 61-90 days
    '90+': '#6b7280'    // Gray for 90+ days
  }

  // Fetch aging data
  useEffect(() => {
    const fetchAgingData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/analytics/invoices/aging?` + new URLSearchParams({
          companyId,
          dateRange,
          locale,
          includeWeekends: includeWeekends.toString(),
          uaeAdjustments: showUAEAdjustments.toString()
        }))

        if (!response.ok) {
          throw new Error(`Failed to fetch aging data: ${response.status}`)
        }

        const result = await response.json()

        // Transform data for UAE business context
        const transformedData: AgingData = {
          buckets: result.buckets?.map((bucket: any) => ({
            range: bucket.range,
            current: bucket.current || 0,
            overdue: bucket.overdue || 0,
            count: bucket.count || 0,
            amount: bucket.amount || 0,
            color: agingColors[bucket.range as keyof typeof agingColors] || '#6b7280',
            uaeBusinessDays: bucket.uaeBusinessDays || 0,
            isWeekend: bucket.isWeekend || false,
            prayerImpact: bucket.prayerImpact || 0
          })) || [],
          summary: result.summary || {
            totalInvoices: 0,
            totalAmount: 0,
            currentPercentage: 0,
            overduePercentage: 0,
            avgDaysOverdue: 0,
            worstPerformingBucket: 'N/A'
          },
          trends: result.trends || [],
          uaeContext: result.uaeContext || {
            businessDaysOnly: true,
            fridayImpact: 0,
            ramadanAdjustment: 0,
            holidayDays: 0
          }
        }

        setAgingData(transformedData)

      } catch (err) {
        console.error('Error fetching aging data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgingData()
  }, [companyId, dateRange, locale, includeWeekends, showUAEAdjustments])

  // Calculate insights
  const insights = useMemo(() => {
    if (!agingData) return []

    const insights = []

    // High overdue percentage insight
    if (agingData.summary.overduePercentage > 30) {
      insights.push({
        type: 'warning' as const,
        title: locale === 'ar' ? 'نسبة عالية من المستحقات' : 'High Overdue Percentage',
        description: locale === 'ar'
          ? `${formatPercentage(agingData.summary.overduePercentage)} من الفواتير متأخرة`
          : `${formatPercentage(agingData.summary.overduePercentage)} of invoices are overdue`,
        action: locale === 'ar' ? 'تفعيل التذكيرات التلقائية' : 'Enable automatic reminders'
      })
    }

    // UAE business days impact
    if (agingData.uaeContext.fridayImpact > 20) {
      insights.push({
        type: 'info' as const,
        title: locale === 'ar' ? 'تأثير يوم الجمعة' : 'Friday Impact',
        description: locale === 'ar'
          ? `يوم الجمعة يؤثر على ${formatPercentage(agingData.uaeContext.fridayImpact)} من المدفوعات`
          : `Friday impacts ${formatPercentage(agingData.uaeContext.fridayImpact)} of payments`,
        action: locale === 'ar' ? 'جدولة التذكيرات قبل الجمعة' : 'Schedule reminders before Friday'
      })
    }

    // Ramadan adjustment insight
    if (agingData.uaeContext.ramadanAdjustment > 0) {
      insights.push({
        type: 'success' as const,
        title: locale === 'ar' ? 'تعديلات رمضان نشطة' : 'Ramadan Adjustments Active',
        description: locale === 'ar'
          ? 'تم تطبيق تعديلات خاصة لشهر رمضان المبارك'
          : 'Special adjustments applied for Ramadan period',
        action: locale === 'ar' ? 'مراجعة النتائج' : 'Review performance'
      })
    }

    return insights
  }, [agingData, locale])

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}: {formatAEDCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Render pie chart
  const renderPieChart = () => (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={agingData?.buckets || []}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={2}
            dataKey="amount"
          >
            {agingData?.buckets.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList
              dataKey="range"
              position="outside"
              className="text-xs font-medium"
            />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => (
              <span style={{ color: entry.color }}>
                {value} ({formatAEDCurrency((entry.payload as any)?.amount || 0)})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )

  // Render bar chart
  const renderBarChart = () => (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={agingData?.buckets || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="range" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Bar
            yAxisId="left"
            dataKey="amount"
            fill="#3b82f6"
            name={locale === 'ar' ? 'المبلغ' : 'Amount'}
            radius={[4, 4, 0, 0]}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="count"
            stroke="#ef4444"
            strokeWidth={2}
            name={locale === 'ar' ? 'عدد الفواتير' : 'Invoice Count'}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  // Render trend chart
  const renderTrendChart = () => (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={agingData?.trends || []}>
          <CartesianGrid strokeDasharray="3 3" />
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
          <Legend />

          <Area
            type="monotone"
            dataKey="current"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.8}
            name={locale === 'ar' ? 'جاري' : 'Current'}
          />

          <Area
            type="monotone"
            dataKey="overdue"
            stackId="1"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.8}
            name={locale === 'ar' ? 'متأخر' : 'Overdue'}
          />

          {showUAEAdjustments && (
            <>
              <Area
                type="monotone"
                dataKey="weekend"
                stackId="2"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
                name={locale === 'ar' ? 'عطلة نهاية الأسبوع' : 'Weekend Impact'}
              />

              <Area
                type="monotone"
                dataKey="prayerTime"
                stackId="2"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
                name={locale === 'ar' ? 'تأثير أوقات الصلاة' : 'Prayer Time Impact'}
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
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

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {locale === 'ar' ? `خطأ في تحميل بيانات عمر الفواتير: ${error}` : `Error loading aging data: ${error}`}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("space-y-6", isRTL && "rtl", className)}>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {locale === 'ar' ? 'تحليل عمر الفواتير' : 'Invoice Aging Analysis'}
            </CardTitle>
            <CardDescription className="mt-1">
              {locale === 'ar'
                ? 'توزيع الفواتير حسب العمر مع مراعاة أيام العمل الإماراتية'
                : 'Invoice distribution by age with UAE business days consideration'
              }
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pie">
                  {locale === 'ar' ? 'دائري' : 'Pie Chart'}
                </SelectItem>
                <SelectItem value="bar">
                  {locale === 'ar' ? 'أعمدة' : 'Bar Chart'}
                </SelectItem>
                <SelectItem value="trend">
                  {locale === 'ar' ? 'الاتجاه' : 'Trend'}
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showUAEAdjustments ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUAEAdjustments(!showUAEAdjustments)}
            >
              <Moon className="h-4 w-4 mr-2" />
              {locale === 'ar' ? 'التعديلات الإماراتية' : 'UAE Adjustments'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        {agingData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(agingData.summary.currentPercentage)}
              </div>
              <div className="text-sm text-green-700">
                {locale === 'ar' ? 'فواتير جارية' : 'Current Invoices'}
              </div>
            </div>

            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {formatPercentage(agingData.summary.overduePercentage)}
              </div>
              <div className="text-sm text-red-700">
                {locale === 'ar' ? 'فواتير متأخرة' : 'Overdue Invoices'}
              </div>
            </div>

            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {agingData.summary.avgDaysOverdue.toFixed(1)}
              </div>
              <div className="text-sm text-blue-700">
                {locale === 'ar' ? 'متوسط أيام التأخير' : 'Avg Days Overdue'}
              </div>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatAEDCurrency(agingData.summary.totalAmount)}
              </div>
              <div className="text-sm text-purple-700">
                {locale === 'ar' ? 'إجمالي القيمة' : 'Total Value'}
              </div>
            </div>
          </div>
        )}

        {/* UAE Context Alert */}
        {agingData?.uaeContext && showUAEAdjustments && (
          <Alert className="border-blue-200 bg-blue-50">
            <Calendar className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {locale === 'ar'
                  ? 'تم تطبيق تعديلات أيام العمل الإماراتية'
                  : 'UAE business days adjustments applied'
                }
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span>
                  {locale === 'ar' ? 'أيام الأعياد: ' : 'Holiday days: '}
                  {agingData.uaeContext.holidayDays}
                </span>
                <span>
                  {locale === 'ar' ? 'تأثير الجمعة: ' : 'Friday impact: '}
                  {formatPercentage(agingData.uaeContext.fridayImpact)}
                </span>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Chart Display */}
        <div className="space-y-4">
          {viewType === 'pie' && renderPieChart()}
          {viewType === 'bar' && renderBarChart()}
          {viewType === 'trend' && renderTrendChart()}
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">
              {locale === 'ar' ? 'رؤى مهمة' : 'Key Insights'}
            </h4>

            {insights.map((insight, index) => (
              <Alert
                key={index}
                className={cn(
                  insight.type === 'warning' && "border-yellow-200 bg-yellow-50",
                  insight.type === 'info' && "border-blue-200 bg-blue-50",
                  insight.type === 'success' && "border-green-200 bg-green-50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-sm">{insight.title}</h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      {insight.description}
                    </p>
                  </div>

                  {insight.action && (
                    <Button variant="ghost" size="sm" className="ml-4 text-xs">
                      {insight.action}
                    </Button>
                  )}
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Aging Buckets Detail Table */}
        {agingData && (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    {locale === 'ar' ? 'الفئة العمرية' : 'Age Range'}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {locale === 'ar' ? 'عدد الفواتير' : 'Count'}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {locale === 'ar' ? 'المبلغ' : 'Amount'}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {locale === 'ar' ? 'أيام العمل الإماراتية' : 'UAE Business Days'}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {locale === 'ar' ? 'النسبة' : 'Percentage'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {agingData.buckets.map((bucket, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: bucket.color }}
                        />
                        <span className="font-medium">{bucket.range}</span>
                        {bucket.isWeekend && (
                          <Badge variant="outline" className="text-xs">
                            {locale === 'ar' ? 'عطلة' : 'Weekend'}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {bucket.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatAEDCurrency(bucket.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {bucket.uaeBusinessDays.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatPercentage(
                        (bucket.amount / agingData.summary.totalAmount) * 100
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default InvoiceAgingChart
export { InvoiceAgingChart }