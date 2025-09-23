// Sprint 3: Real-time Analytics Charts and Visualizations
// Recharts integration for consolidation effectiveness metrics

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ComposedChart, Area, AreaChart
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AEDAmount } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface ConsolidationAnalyticsChartsProps {
  companyId: string
  period: string
  locale?: string
  data: {
    trendsData: {
      date: string
      consolidations: number
      amount: number
      emailsSaved: number
    }[]
    analytics: {
      totalConsolidations: number
      totalAmountConsolidated: number
      avgInvoicesPerConsolidation: number
      emailSavingsPercentage: number
      paymentSuccessRate: number
      responseRate: number
    }
    topPerformingCustomers?: {
      customerId: string
      customerName: string
      effectivenessScore: number
      totalAmount: number
      consolidationCount: number
    }[]
  }
}

export function ConsolidationAnalyticsCharts({
  companyId,
  period,
  locale = 'en',
  data
}: ConsolidationAnalyticsChartsProps) {
  const t = useTranslations('analyticsCharts')
  const [chartType, setChartType] = useState<'trends' | 'efficiency' | 'customers' | 'performance'>('trends')
  const [isRealTime, setIsRealTime] = useState(true)

  // UAE business colors for charts
  const colors = {
    primary: '#0ea5e9', // Blue
    secondary: '#10b981', // Green
    accent: '#f59e0b', // Orange
    warning: '#ef4444', // Red
    muted: '#6b7280' // Gray
  }

  // Custom tooltip for AED amounts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {
                entry.dataKey.includes('amount') || entry.dataKey.includes('Amount')
                  ? <AEDAmount amount={entry.value} />
                  : entry.value
              }
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Format date labels for UAE locale
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  // Consolidation trends chart data
  const trendsChartData = data.trendsData.map(item => ({
    ...item,
    dateLabel: formatDateLabel(item.date),
    emailEfficiency: item.emailsSaved / Math.max(item.consolidations, 1) // Emails saved per consolidation
  }))

  // Email efficiency pie chart data
  const efficiencyData = [
    {
      name: t('efficiency.consolidated'),
      value: data.analytics.emailSavingsPercentage,
      color: colors.primary
    },
    {
      name: t('efficiency.individual'),
      value: 100 - data.analytics.emailSavingsPercentage,
      color: colors.muted
    }
  ]

  // Performance metrics data
  const performanceData = [
    {
      metric: t('performance.paymentSuccess'),
      value: data.analytics.paymentSuccessRate,
      target: 75,
      color: colors.primary
    },
    {
      metric: t('performance.responseRate'),
      value: data.analytics.responseRate,
      target: 60,
      color: colors.secondary
    },
    {
      metric: t('performance.avgInvoicesPerEmail'),
      value: data.analytics.avgInvoicesPerConsolidation,
      target: 3,
      color: colors.accent
    }
  ]

  // Customer performance chart data
  const customerChartData = (data.topPerformingCustomers || []).slice(0, 10).map(customer => ({
    ...customer,
    shortName: customer.customerName.length > 15
      ? customer.customerName.substring(0, 12) + '...'
      : customer.customerName
  }))

  const renderChart = () => {
    switch (chartType) {
      case 'trends':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t('trends.title')}</CardTitle>
              <CardDescription>{t('trends.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 12 }}
                      stroke={colors.muted}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      stroke={colors.muted}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke={colors.muted}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    <Bar
                      yAxisId="left"
                      dataKey="consolidations"
                      name={t('trends.consolidations')}
                      fill={colors.primary}
                      radius={[2, 2, 0, 0]}
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="amount"
                      name={t('trends.amount')}
                      stroke={colors.secondary}
                      strokeWidth={3}
                      dot={{ fill: colors.secondary, strokeWidth: 2, r: 4 }}
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="emailEfficiency"
                      name={t('trends.emailEfficiency')}
                      stroke={colors.accent}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: colors.accent, strokeWidth: 2, r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )

      case 'efficiency':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('efficiency.emailSavings')}</CardTitle>
                <CardDescription>{t('efficiency.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={efficiencyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {efficiencyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [`${value.toFixed(1)}%`, '']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {data.analytics.emailSavingsPercentage.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600">{t('efficiency.totalSavings')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('efficiency.consolidationImpact')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">{t('efficiency.avgInvoicesPerEmail')}</span>
                    <Badge variant="outline" className="text-blue-600">
                      {data.analytics.avgInvoicesPerConsolidation.toFixed(1)}x
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium">{t('efficiency.emailReduction')}</span>
                    <Badge variant="outline" className="text-green-600">
                      -{Math.round((data.analytics.avgInvoicesPerConsolidation - 1) / data.analytics.avgInvoicesPerConsolidation * 100)}%
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm font-medium">{t('efficiency.totalConsolidations')}</span>
                    <Badge variant="outline" className="text-orange-600">
                      {data.analytics.totalConsolidations}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        <AEDAmount amount={data.analytics.totalAmountConsolidated} />
                      </div>
                      <p className="text-sm text-gray-600">{t('efficiency.totalAmountConsolidated')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 'performance':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t('performance.title')}</CardTitle>
              <CardDescription>{t('performance.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis
                      dataKey="metric"
                      type="category"
                      width={150}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        name === 'target' ? `${value}% (Target)` : `${value.toFixed(1)}%`,
                        name === 'target' ? 'Target' : 'Current'
                      ]}
                    />
                    <Bar dataKey="value" fill={colors.primary} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="target" fill={colors.muted} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )

      case 'customers':
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t('customers.title')}</CardTitle>
              <CardDescription>{t('customers.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      stroke={colors.muted}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke={colors.muted}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    <Bar
                      yAxisId="left"
                      dataKey="effectivenessScore"
                      name={t('customers.effectivenessScore')}
                      fill={colors.primary}
                      radius={[2, 2, 0, 0]}
                    />

                    <Bar
                      yAxisId="right"
                      dataKey="totalAmount"
                      name={t('customers.totalAmount')}
                      fill={colors.secondary}
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Customer details table */}
              <div className="mt-6 space-y-2">
                <h4 className="text-sm font-medium">{t('customers.topPerformers')}</h4>
                <div className="space-y-1 text-sm">
                  {customerChartData.slice(0, 5).map((customer, index) => (
                    <div key={customer.customerId} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span>{customer.customerName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-green-600 font-medium">
                          {customer.effectivenessScore}%
                        </span>
                        <span className="text-gray-600">
                          <AEDAmount amount={customer.totalAmount} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  const isRTL = locale === 'ar'

  return (
    <div className={cn("space-y-6", isRTL && "text-right")}>
      {/* Chart Type Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <p className="text-sm text-gray-600">{t('description')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trends">{t('chartTypes.trends')}</SelectItem>
              <SelectItem value="efficiency">{t('chartTypes.efficiency')}</SelectItem>
              <SelectItem value="performance">{t('chartTypes.performance')}</SelectItem>
              <SelectItem value="customers">{t('chartTypes.customers')}</SelectItem>
            </SelectContent>
          </Select>

          {isRealTime && (
            <Badge variant="outline" className="animate-pulse">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              {t('realTime')}
            </Badge>
          )}
        </div>
      </div>

      {/* Chart Content */}
      {renderChart()}

      {/* Chart Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('insights.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-700">{t('insights.emailEfficiency')}</div>
              <div className="text-blue-600 mt-1">
                {Math.round((data.analytics.avgInvoicesPerConsolidation - 1) / data.analytics.avgInvoicesPerConsolidation * 100)}%
                {t('insights.emailReduction')}
              </div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <div className="font-medium text-green-700">{t('insights.successRate')}</div>
              <div className="text-green-600 mt-1">
                {data.analytics.paymentSuccessRate.toFixed(1)}% {t('insights.paymentSuccess')}
              </div>
            </div>

            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="font-medium text-orange-700">{t('insights.totalImpact')}</div>
              <div className="text-orange-600 mt-1">
                <AEDAmount amount={data.analytics.totalAmountConsolidated} /> {t('insights.consolidated')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}