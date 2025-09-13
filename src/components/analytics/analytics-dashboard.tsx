'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Target,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Eye,
  MousePointer,
  Repeat,
  Globe,
  Download,
  Filter,
  RefreshCw,
  DollarSign,
  Timer,
  MessageSquare
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'

interface AnalyticsDashboardProps {
  companyId: string
  dateRange?: string
  locale?: string
}

interface DashboardMetrics {
  overview: {
    totalSequences: number
    activeSequences: number
    totalEmailsSent: number
    averageResponseRate: number
    paymentAcceleration: number
    cultureScore: number
    totalRevenue: number
    pendingAmount: number
  }
  trends: {
    emailVolume: Array<{ date: string; sent: number; delivered: number; opened: number }>
    conversionFunnel: Array<{ stage: string; count: number; rate: number }>
    performanceOverTime: Array<{ date: string; responseRate: number; paymentRate: number; cultureScore: number }>
  }
  businessHours: {
    compliance: number
    optimalTimes: Array<{ hour: number; effectiveness: number }>
    prayerTimeRespect: number
    holidayCompliance: number
  }
  culturalMetrics: {
    arabicUsage: number
    toneAppropriateness: number
    localCustomsRespect: number
    timeZoneAccuracy: number
  }
  sequenceTypes: Array<{
    name: string
    usage: number
    effectiveness: number
    avgDuration: number
    culturalScore: number
    color: string
  }>
}

export function AnalyticsDashboard({ companyId, dateRange = '30', locale = 'en' }: AnalyticsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(dateRange)
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)

  // Mock data - in production, this would fetch from analytics API
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockData: DashboardMetrics = {
        overview: {
          totalSequences: 24,
          activeSequences: 18,
          totalEmailsSent: 5847,
          averageResponseRate: 31.2,
          paymentAcceleration: 12.3,
          cultureScore: 94.8,
          totalRevenue: 2450000,
          pendingAmount: 185000
        },
        trends: {
          emailVolume: [
            { date: '2024-01-01', sent: 120, delivered: 117, opened: 42 },
            { date: '2024-01-02', sent: 145, delivered: 142, opened: 51 },
            { date: '2024-01-03', sent: 132, delivered: 128, opened: 47 },
            { date: '2024-01-04', sent: 156, delivered: 153, opened: 58 },
            { date: '2024-01-05', sent: 189, delivered: 185, opened: 67 },
            { date: '2024-01-06', sent: 134, delivered: 131, opened: 49 },
            { date: '2024-01-07', sent: 98, delivered: 96, opened: 32 }
          ],
          conversionFunnel: [
            { stage: 'Emails Sent', count: 5847, rate: 100 },
            { stage: 'Delivered', count: 5721, rate: 97.8 },
            { stage: 'Opened', count: 1785, rate: 31.2 },
            { stage: 'Clicked', count: 428, rate: 7.4 },
            { stage: 'Responded', count: 245, rate: 4.2 },
            { stage: 'Payment Made', count: 193, rate: 3.3 }
          ],
          performanceOverTime: [
            { date: '2024-01-01', responseRate: 28.5, paymentRate: 75.2, cultureScore: 92.1 },
            { date: '2024-01-02', responseRate: 31.2, paymentRate: 78.9, cultureScore: 94.3 },
            { date: '2024-01-03', responseRate: 29.8, paymentRate: 76.5, cultureScore: 93.7 },
            { date: '2024-01-04', responseRate: 33.1, paymentRate: 81.2, cultureScore: 95.1 },
            { date: '2024-01-05', responseRate: 35.4, paymentRate: 83.7, cultureScore: 96.2 },
            { date: '2024-01-06', responseRate: 32.7, paymentRate: 79.8, cultureScore: 94.9 },
            { date: '2024-01-07', responseRate: 30.9, paymentRate: 77.3, cultureScore: 93.8 }
          ]
        },
        businessHours: {
          compliance: 96.7,
          optimalTimes: [
            { hour: 9, effectiveness: 85.2 },
            { hour: 10, effectiveness: 92.1 },
            { hour: 11, effectiveness: 89.5 },
            { hour: 14, effectiveness: 91.8 },
            { hour: 15, effectiveness: 88.3 },
            { hour: 16, effectiveness: 86.7 }
          ],
          prayerTimeRespect: 98.5,
          holidayCompliance: 100
        },
        culturalMetrics: {
          arabicUsage: 87.3,
          toneAppropriateness: 94.7,
          localCustomsRespect: 96.2,
          timeZoneAccuracy: 99.1
        },
        sequenceTypes: [
          { name: 'Gentle Collection', usage: 45, effectiveness: 87.5, avgDuration: 14, culturalScore: 96.8, color: '#10B981' },
          { name: 'Professional Standard', usage: 30, effectiveness: 82.3, avgDuration: 21, culturalScore: 93.2, color: '#3B82F6' },
          { name: 'Relationship Preserving', usage: 15, effectiveness: 79.2, avgDuration: 35, culturalScore: 98.1, color: '#8B5CF6' },
          { name: 'Quick Collection', usage: 8, effectiveness: 91.7, avgDuration: 7, culturalScore: 88.5, color: '#F59E0B' },
          { name: 'Firm Recovery', usage: 2, effectiveness: 85.1, avgDuration: 28, culturalScore: 82.3, color: '#EF4444' }
        ]
      }
      
      setMetrics(mockData)
      setIsLoading(false)
    }

    fetchAnalytics()
  }, [companyId, selectedPeriod])

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    format = 'number',
    trendData
  }: {
    title: string
    value: number
    change?: number
    icon: any
    format?: 'number' | 'percentage' | 'currency' | 'days'
    trendData?: Array<{ date: string; value: number }>
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'percentage':
          return `${value.toFixed(1)}%`
        case 'currency':
          return `AED ${value.toLocaleString()}`
        case 'days':
          return `${value.toFixed(1)} days`
        default:
          return value.toLocaleString()
      }
    }

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-2xl font-bold mt-1">{formatValue()}</p>
              {change !== undefined && (
                <div className={cn(
                  "flex items-center text-sm mt-1",
                  change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600"
                )}>
                  {change > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : change < 0 ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : null}
                  {Math.abs(change).toFixed(1)}% from last period
                </div>
              )}
            </div>
            <div className="flex flex-col items-end">
              <Icon className="h-8 w-8 text-gray-400" />
              {trendData && (
                <div className="w-16 h-8 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.2}
                        strokeWidth={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive insights for UAE payment collection performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue Collected"
          value={metrics.overview.totalRevenue}
          change={8.2}
          format="currency"
          icon={DollarSign}
        />
        <MetricCard
          title="Active Sequences"
          value={metrics.overview.activeSequences}
          change={12.5}
          icon={Target}
        />
        <MetricCard
          title="Response Rate"
          value={metrics.overview.averageResponseRate}
          change={5.7}
          format="percentage"
          icon={MessageSquare}
        />
        <MetricCard
          title="UAE Culture Score"
          value={metrics.overview.cultureScore}
          change={2.3}
          format="percentage"
          icon={Globe}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="cultural">UAE Insights</TabsTrigger>
          <TabsTrigger value="sequences">Sequence Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Email Volume Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Email Performance Over Time</CardTitle>
              <CardDescription>
                Daily email volume, delivery rates, and engagement metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trends.emailVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value, name) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Area type="monotone" dataKey="sent" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="delivered" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="opened" stackId="3" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>
                  Step-by-step conversion rates through the payment process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.trends.conversionFunnel.map((stage, index) => (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{stage.stage}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold">{stage.count.toLocaleString()}</span>
                          <span className="text-xs text-gray-500 ml-2">({stage.rate.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${stage.rate}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Statistics</CardTitle>
                <CardDescription>
                  Key performance indicators at a glance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.overview.paymentAcceleration}
                    </div>
                    <div className="text-sm text-green-700">Days Faster Payment</div>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.overview.totalEmailsSent.toLocaleString()}
                    </div>
                    <div className="text-sm text-blue-700">Total Emails Sent</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      AED {metrics.overview.pendingAmount.toLocaleString()}
                    </div>
                    <div className="text-sm text-purple-700">Pending Collections</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {metrics.businessHours.compliance.toFixed(1)}%
                    </div>
                    <div className="text-sm text-orange-700">Business Hours Compliance</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends Over Time</CardTitle>
              <CardDescription>
                Track response rates, payment success, and cultural compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.trends.performanceOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value, name) => [`${value.toFixed(1)}%`, name.replace(/([A-Z])/g, ' $1')]}
                    />
                    <Line type="monotone" dataKey="responseRate" stroke="#3B82F6" strokeWidth={2} name="Response Rate" />
                    <Line type="monotone" dataKey="paymentRate" stroke="#10B981" strokeWidth={2} name="Payment Rate" />
                    <Line type="monotone" dataKey="cultureScore" stroke="#8B5CF6" strokeWidth={2} name="Culture Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cultural" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>UAE Business Compliance</CardTitle>
                <CardDescription>
                  Adherence to UAE business practices and cultural norms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Business Hours Compliance</span>
                    <span className="font-medium">{metrics.businessHours.compliance}%</span>
                  </div>
                  <Progress value={metrics.businessHours.compliance} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Prayer Time Respect</span>
                    <span className="font-medium">{metrics.businessHours.prayerTimeRespect}%</span>
                  </div>
                  <Progress value={metrics.businessHours.prayerTimeRespect} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Holiday Compliance</span>
                    <span className="font-medium">{metrics.businessHours.holidayCompliance}%</span>
                  </div>
                  <Progress value={metrics.businessHours.holidayCompliance} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cultural Effectiveness</CardTitle>
                <CardDescription>
                  How well your content resonates with UAE culture
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Arabic Language Usage</span>
                    <span className="font-medium">{metrics.culturalMetrics.arabicUsage}%</span>
                  </div>
                  <Progress value={metrics.culturalMetrics.arabicUsage} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Tone Appropriateness</span>
                    <span className="font-medium">{metrics.culturalMetrics.toneAppropriateness}%</span>
                  </div>
                  <Progress value={metrics.culturalMetrics.toneAppropriateness} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Local Customs Respect</span>
                    <span className="font-medium">{metrics.culturalMetrics.localCustomsRespect}%</span>
                  </div>
                  <Progress value={metrics.culturalMetrics.localCustomsRespect} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Optimal Send Times</CardTitle>
              <CardDescription>
                Most effective hours for email delivery in UAE timezone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.businessHours.optimalTimes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      labelFormatter={(hour) => `${hour}:00 UAE Time`}
                      formatter={(value) => [`${value.toFixed(1)}%`, 'Effectiveness']}
                    />
                    <Bar dataKey="effectiveness" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sequence Type Performance</CardTitle>
                <CardDescription>
                  Effectiveness comparison across different sequence types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.sequenceTypes.map((sequence, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{sequence.name}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{sequence.usage}% usage</Badge>
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: sequence.color }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500">Effectiveness</span>
                          <span className="font-medium">{sequence.effectiveness}%</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Avg Duration</span>
                          <span className="font-medium">{sequence.avgDuration} days</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Culture Score</span>
                          <span className="font-medium">{sequence.culturalScore}%</span>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-300" 
                            style={{ 
                              width: `${sequence.effectiveness}%`,
                              backgroundColor: sequence.color
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Distribution</CardTitle>
                <CardDescription>
                  How different sequence types are being utilized
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.sequenceTypes}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="usage"
                        label={({ name, usage }) => `${name}: ${usage}%`}
                      >
                        {metrics.sequenceTypes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Usage']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}