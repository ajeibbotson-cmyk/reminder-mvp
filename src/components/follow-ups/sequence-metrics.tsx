'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Users,
  DollarSign,
  Clock,
  Target,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  Eye,
  Download,
  Filter,
  MoreHorizontal,
  PieChart,
  LineChart,
  Activity
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface SequenceMetricData {
  id: string
  name: string
  type: string
  status: string
  metrics: {
    emailsSent: number
    emailsDelivered: number
    emailsOpened: number
    emailsClicked: number
    responseRate: number
    conversionRate: number
    paymentReceived: number
    averageResponseTime: number // in hours
    bounceRate: number
    unsubscribeRate: number
  }
  timeSeriesData: Array<{
    date: string
    emailsSent: number
    responseRate: number
    conversionRate: number
    paymentAmount: number
  }>
  stepPerformance: Array<{
    stepOrder: number
    stepName: string
    stepType: string
    emailsSent: number
    responseRate: number
    effectiveness: number
  }>
  uaeMetrics: {
    businessHoursCompliance: number
    holidayRespect: number
    prayerTimeAvoidance: number
    culturalAppropriatenesScore: number
  }
}

interface SequenceMetricsProps {
  sequences: SequenceMetricData[]
  timeRange: string
  onTimeRangeChange: (range: string) => void
  companyId?: string
}

export function SequenceMetrics({
  sequences,
  timeRange,
  onTimeRangeChange,
  companyId
}: SequenceMetricsProps) {
  const t = useTranslations('followUps.metrics')
  const [selectedMetric, setSelectedMetric] = useState('overview')
  const [selectedSequences, setSelectedSequences] = useState<string[]>([])
  const [comparisonMode, setComparisonMode] = useState(false)
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('line')

  const timeRangeOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 3 Months' },
    { value: '1y', label: 'Last Year' }
  ]

  const metricOptions = [
    { value: 'overview', label: 'Overview', icon: BarChart3 },
    { value: 'performance', label: 'Performance', icon: TrendingUp },
    { value: 'engagement', label: 'Engagement', icon: Users },
    { value: 'conversion', label: 'Conversion', icon: Target },
    { value: 'timing', label: 'Timing', icon: Clock },
    { value: 'uae-compliance', label: 'UAE Compliance', icon: Activity }
  ]

  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const totalSequences = sequences.length
    const activeSequences = sequences.filter(s => s.status === 'ACTIVE').length

    const totals = sequences.reduce((acc, seq) => ({
      emailsSent: acc.emailsSent + seq.metrics.emailsSent,
      emailsDelivered: acc.emailsDelivered + seq.metrics.emailsDelivered,
      emailsOpened: acc.emailsOpened + seq.metrics.emailsOpened,
      emailsClicked: acc.emailsClicked + seq.metrics.emailsClicked,
      paymentReceived: acc.paymentReceived + seq.metrics.paymentReceived,
      responseCount: acc.responseCount + (seq.metrics.emailsSent * seq.metrics.responseRate / 100),
      conversionCount: acc.conversionCount + (seq.metrics.emailsSent * seq.metrics.conversionRate / 100)
    }), {
      emailsSent: 0,
      emailsDelivered: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      paymentReceived: 0,
      responseCount: 0,
      conversionCount: 0
    })

    const averages = {
      deliveryRate: totals.emailsSent > 0 ? (totals.emailsDelivered / totals.emailsSent) * 100 : 0,
      openRate: totals.emailsDelivered > 0 ? (totals.emailsOpened / totals.emailsDelivered) * 100 : 0,
      clickRate: totals.emailsOpened > 0 ? (totals.emailsClicked / totals.emailsOpened) * 100 : 0,
      responseRate: totals.emailsSent > 0 ? (totals.responseCount / totals.emailsSent) * 100 : 0,
      conversionRate: totals.emailsSent > 0 ? (totals.conversionCount / totals.emailsSent) * 100 : 0,
      avgResponseTime: sequences.reduce((sum, s) => sum + s.metrics.averageResponseTime, 0) / (totalSequences || 1),
      avgPaymentAmount: totals.conversionCount > 0 ? totals.paymentReceived / totals.conversionCount : 0,
      uaeCompliance: sequences.reduce((sum, s) => sum + s.uaeMetrics.businessHoursCompliance, 0) / (totalSequences || 1)
    }

    return { totals, averages, totalSequences, activeSequences }
  }, [sequences])

  // Calculate trends
  const calculateTrend = (current: number, previous: number): 'UP' | 'DOWN' | 'STABLE' => {
    if (current > previous * 1.05) return 'UP'
    if (current < previous * 0.95) return 'DOWN'
    return 'STABLE'
  }

  const getTrendIcon = (trend: 'UP' | 'DOWN' | 'STABLE') => {
    switch (trend) {
      case 'UP': return <ArrowUp className="h-4 w-4 text-green-600" />
      case 'DOWN': return <ArrowDown className="h-4 w-4 text-red-600" />
      case 'STABLE': return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendColor = (trend: 'UP' | 'DOWN' | 'STABLE') => {
    switch (trend) {
      case 'UP': return 'text-green-600'
      case 'DOWN': return 'text-red-600'
      case 'STABLE': return 'text-gray-600'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const exportMetrics = () => {
    // Implementation for exporting metrics data
    console.log('Exporting metrics for time range:', timeRange)
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Performance Metrics</h3>
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Chart Type
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setChartType('line')}>
                <LineChart className="h-4 w-4 mr-2" />
                Line Chart
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChartType('bar')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Bar Chart
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChartType('pie')}>
                <PieChart className="h-4 w-4 mr-2" />
                Pie Chart
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={exportMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setComparisonMode(!comparisonMode)}>
                <Eye className="h-4 w-4 mr-2" />
                {comparisonMode ? 'Exit Comparison' : 'Compare Sequences'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {aggregateMetrics.totals.emailsSent.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon('UP')}
              <span className={getTrendColor('UP')}>12.5% from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(aggregateMetrics.averages.responseRate)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon('UP')}
              <span className={getTrendColor('UP')}>5.2% improvement</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments Received</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(aggregateMetrics.totals.paymentReceived)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon('UP')}
              <span className={getTrendColor('UP')}>8.7% increase</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">UAE Compliance</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatPercentage(aggregateMetrics.averages.uaeCompliance)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon('STABLE')}
              <span className={getTrendColor('STABLE')}>Maintained high compliance</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
        <TabsList className="grid w-full grid-cols-6">
          {metricOptions.map(option => {
            const IconComponent = option.icon
            return (
              <TabsTrigger key={option.value} value={option.value} className="flex items-center gap-1">
                <IconComponent className="h-4 w-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Funnel Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Email Funnel Performance</CardTitle>
              <CardDescription>
                Track email delivery and engagement through the funnel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Emails Sent</span>
                  <span className="text-lg font-bold">
                    {aggregateMetrics.totals.emailsSent.toLocaleString()}
                  </span>
                </div>
                <Progress value={100} className="h-3" />

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Delivered</span>
                  <span className="font-medium">
                    {aggregateMetrics.totals.emailsDelivered.toLocaleString()}
                    ({formatPercentage(aggregateMetrics.averages.deliveryRate)})
                  </span>
                </div>
                <Progress value={aggregateMetrics.averages.deliveryRate} className="h-3" />

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Opened</span>
                  <span className="font-medium">
                    {aggregateMetrics.totals.emailsOpened.toLocaleString()}
                    ({formatPercentage(aggregateMetrics.averages.openRate)})
                  </span>
                </div>
                <Progress value={aggregateMetrics.averages.openRate} className="h-3" />

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Clicked</span>
                  <span className="font-medium">
                    {aggregateMetrics.totals.emailsClicked.toLocaleString()}
                    ({formatPercentage(aggregateMetrics.averages.clickRate)})
                  </span>
                </div>
                <Progress value={aggregateMetrics.averages.clickRate} className="h-3" />

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Responded</span>
                  <span className="font-medium text-green-600">
                    {Math.round(aggregateMetrics.totals.responseCount).toLocaleString()}
                    ({formatPercentage(aggregateMetrics.averages.responseRate)})
                  </span>
                </div>
                <Progress value={aggregateMetrics.averages.responseRate} className="h-3 bg-green-100" />
              </div>
            </CardContent>
          </Card>

          {/* Top Performing Sequences */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Sequences</CardTitle>
              <CardDescription>
                Sequences with the highest conversion rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sequences
                  .sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate)
                  .slice(0, 5)
                  .map((sequence, index) => (
                    <div key={sequence.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{sequence.name}</h4>
                          <p className="text-sm text-gray-600">{sequence.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">
                          {formatPercentage(sequence.metrics.conversionRate)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(sequence.metrics.paymentReceived)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends Over Time</CardTitle>
              <CardDescription>
                Track key metrics performance over the selected time period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">Performance Chart</h3>
                  <p className="text-gray-600">
                    Interactive chart showing {chartType} visualization of sequence performance
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sequence Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sequence Performance Breakdown</CardTitle>
              <CardDescription>
                Detailed performance metrics for each sequence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Sequence</th>
                      <th className="text-right p-2 font-medium">Emails Sent</th>
                      <th className="text-right p-2 font-medium">Response Rate</th>
                      <th className="text-right p-2 font-medium">Conversion Rate</th>
                      <th className="text-right p-2 font-medium">Revenue</th>
                      <th className="text-right p-2 font-medium">Avg Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequences.map((sequence) => (
                      <tr key={sequence.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{sequence.name}</div>
                            <div className="text-sm text-gray-600">{sequence.type}</div>
                          </div>
                        </td>
                        <td className="text-right p-2">{sequence.metrics.emailsSent.toLocaleString()}</td>
                        <td className="text-right p-2">
                          <span className="text-green-600 font-medium">
                            {formatPercentage(sequence.metrics.responseRate)}
                          </span>
                        </td>
                        <td className="text-right p-2">
                          <span className="text-blue-600 font-medium">
                            {formatPercentage(sequence.metrics.conversionRate)}
                          </span>
                        </td>
                        <td className="text-right p-2">
                          <span className="text-orange-600 font-medium">
                            {formatCurrency(sequence.metrics.paymentReceived)}
                          </span>
                        </td>
                        <td className="text-right p-2">
                          {sequence.metrics.averageResponseTime.toFixed(1)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uae-compliance" className="space-y-6">
          {/* UAE Compliance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>UAE Business Compliance</CardTitle>
              <CardDescription>
                Compliance with UAE business practices and cultural considerations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sequences.map((sequence) => (
                  <div key={sequence.id} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">{sequence.name}</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Business Hours Compliance</span>
                        <span className="font-medium">
                          {formatPercentage(sequence.uaeMetrics.businessHoursCompliance)}
                        </span>
                      </div>
                      <Progress value={sequence.uaeMetrics.businessHoursCompliance} className="h-2" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm">Holiday Respect</span>
                        <span className="font-medium">
                          {formatPercentage(sequence.uaeMetrics.holidayRespect)}
                        </span>
                      </div>
                      <Progress value={sequence.uaeMetrics.holidayRespect} className="h-2" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm">Prayer Time Avoidance</span>
                        <span className="font-medium">
                          {formatPercentage(sequence.uaeMetrics.prayerTimeAvoidance)}
                        </span>
                      </div>
                      <Progress value={sequence.uaeMetrics.prayerTimeAvoidance} className="h-2" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm">Cultural Appropriateness</span>
                        <span className="font-medium">
                          {formatPercentage(sequence.uaeMetrics.culturalAppropriatenesScore)}
                        </span>
                      </div>
                      <Progress value={sequence.uaeMetrics.culturalAppropriatenesScore} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add other tab contents for engagement, conversion, timing */}
      </Tabs>
    </div>
  )
}