'use client'

import { useState } from 'react'
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
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'

interface SequenceAnalyticsProps {
  sequenceId?: string
  dateRange?: string
}

interface AnalyticsData {
  overview: {
    totalSequences: number
    activeSequences: number
    totalEmailsSent: number
    averageResponseRate: number
    paymentAcceleration: number // days saved on average
    cultureScore: number // UAE cultural appropriateness score
  }
  performance: {
    deliveryRate: number
    openRate: number
    clickRate: number
    responseRate: number
    paymentRate: number
    escalationRate: number
  }
  trends: {
    period: string
    emailsSentTrend: number
    responseRateTrend: number
    paymentRateTrend: number
    cultureScoreTrend: number
  }
  sequenceComparison: {
    sequenceType: string
    effectiveness: number
    usage: number
    avgDuration: number
    culturalScore: number
  }[]
  uaeInsights: {
    businessHoursCompliance: number
    holidayRespect: number
    prayerTimeAvoidance: number
    bilingualUsage: number
    toneAppropriate: number
  }
  abTests: {
    testName: string
    variantA: string
    variantB: string
    winningVariant: 'A' | 'B' | 'TIE'
    improvement: number
    confidence: number
  }[]
}

export function SequenceAnalytics({ sequenceId, dateRange = '30' }: SequenceAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(dateRange)
  const [selectedMetric, setSelectedMetric] = useState('effectiveness')

  // Mock analytics data - in real implementation, this would come from API
  const analyticsData: AnalyticsData = {
    overview: {
      totalSequences: 12,
      activeSequences: 8,
      totalEmailsSent: 2847,
      averageResponseRate: 23.4,
      paymentAcceleration: 8.5,
      cultureScore: 94.2
    },
    performance: {
      deliveryRate: 97.8,
      openRate: 31.2,
      clickRate: 8.7,
      responseRate: 23.4,
      paymentRate: 78.9,
      escalationRate: 4.2
    },
    trends: {
      period: 'Last 30 days',
      emailsSentTrend: 12.3,
      responseRateTrend: 5.7,
      paymentRateTrend: 8.1,
      cultureScoreTrend: 2.3
    },
    sequenceComparison: [
      { sequenceType: 'Gentle Collection', effectiveness: 87.5, usage: 45, avgDuration: 14, culturalScore: 96.8 },
      { sequenceType: 'Professional Standard', effectiveness: 82.3, usage: 30, avgDuration: 21, culturalScore: 93.2 },
      { sequenceType: 'Relationship Preserving', effectiveness: 79.2, usage: 15, avgDuration: 35, culturalScore: 98.1 },
      { sequenceType: 'Quick Collection', effectiveness: 91.7, usage: 8, avgDuration: 7, culturalScore: 88.5 },
      { sequenceType: 'Firm Recovery', effectiveness: 85.1, usage: 2, avgDuration: 28, culturalScore: 82.3 }
    ],
    uaeInsights: {
      businessHoursCompliance: 98.5,
      holidayRespect: 100,
      prayerTimeAvoidance: 95.2,
      bilingualUsage: 87.3,
      toneAppropriate: 94.7
    },
    abTests: [
      {
        testName: 'Subject Line Test',
        variantA: 'Payment Reminder',
        variantB: 'Gentle Payment Reminder',
        winningVariant: 'B',
        improvement: 15.2,
        confidence: 94.5
      },
      {
        testName: 'Send Time Test',
        variantA: '10 AM',
        variantB: '2 PM',
        winningVariant: 'A',
        improvement: 8.7,
        confidence: 87.3
      }
    ]
  }

  const MetricCard = ({ title, value, change, icon: Icon, format = 'number' }: {
    title: string
    value: number
    change?: number
    icon: any
    format?: 'number' | 'percentage' | 'currency' | 'days'
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
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{title}</p>
              <p className="text-2xl font-bold">{formatValue()}</p>
              {change !== undefined && (
                <div className={cn(
                  "flex items-center text-sm",
                  change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600"
                )}>
                  {change > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : change < 0 ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : null}
                  {Math.abs(change).toFixed(1)}%
                </div>
              )}
            </div>
            <Icon className="h-8 w-8 text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sequence Analytics</h2>
          <p className="text-gray-600">
            Performance insights and UAE business compliance metrics
          </p>
        </div>
        
        <div className="flex items-center gap-2">
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
            Export
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Sequences"
          value={analyticsData.overview.totalSequences}
          icon={Target}
        />
        <MetricCard
          title="Active Sequences"
          value={analyticsData.overview.activeSequences}
          icon={CheckCircle}
        />
        <MetricCard
          title="Emails Sent"
          value={analyticsData.overview.totalEmailsSent}
          change={analyticsData.trends.emailsSentTrend}
          icon={Mail}
        />
        <MetricCard
          title="Response Rate"
          value={analyticsData.overview.averageResponseRate}
          change={analyticsData.trends.responseRateTrend}
          format="percentage"
          icon={TrendingUp}
        />
        <MetricCard
          title="Payment Acceleration"
          value={analyticsData.overview.paymentAcceleration}
          format="days"
          icon={Zap}
        />
        <MetricCard
          title="Culture Score"
          value={analyticsData.overview.cultureScore}
          change={analyticsData.trends.cultureScoreTrend}
          format="percentage"
          icon={Globe}
        />
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="uae-insights">UAE Insights</TabsTrigger>
          <TabsTrigger value="sequences">Sequence Comparison</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Performance</CardTitle>
                <CardDescription>
                  Delivery, engagement, and response metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Delivery Rate</span>
                    <span className="font-medium">{analyticsData.performance.deliveryRate}%</span>
                  </div>
                  <Progress value={analyticsData.performance.deliveryRate} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Open Rate</span>
                    <span className="font-medium">{analyticsData.performance.openRate}%</span>
                  </div>
                  <Progress value={analyticsData.performance.openRate} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Click Rate</span>
                    <span className="font-medium">{analyticsData.performance.clickRate}%</span>
                  </div>
                  <Progress value={analyticsData.performance.clickRate} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Response Rate</span>
                    <span className="font-medium">{analyticsData.performance.responseRate}%</span>
                  </div>
                  <Progress value={analyticsData.performance.responseRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Outcomes</CardTitle>
                <CardDescription>
                  Payment collection and escalation metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {analyticsData.performance.paymentRate}%
                    </div>
                    <div className="text-sm text-green-700">Payment Rate</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {analyticsData.performance.escalationRate}%
                    </div>
                    <div className="text-sm text-orange-700">Escalation Rate</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sequences Completed Successfully</span>
                    <span className="font-medium">
                      {(100 - analyticsData.performance.escalationRate).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Average Response Time</span>
                    <span className="font-medium">2.3 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Payment Acceleration</span>
                    <span className="font-medium text-green-600">
                      +{analyticsData.overview.paymentAcceleration} days faster
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="uae-insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>UAE Business Compliance</CardTitle>
              <CardDescription>
                How well your sequences respect UAE business culture and practices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Business Hours Compliance</span>
                      <span className="font-medium">{analyticsData.uaeInsights.businessHoursCompliance}%</span>
                    </div>
                    <Progress value={analyticsData.uaeInsights.businessHoursCompliance} className="h-2" />
                    <p className="text-xs text-gray-600">
                      Emails sent during UAE business hours (Sunday-Thursday, 9 AM - 6 PM)
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Holiday Respect</span>
                      <span className="font-medium">{analyticsData.uaeInsights.holidayRespect}%</span>
                    </div>
                    <Progress value={analyticsData.uaeInsights.holidayRespect} className="h-2" />
                    <p className="text-xs text-gray-600">
                      Emails avoided during UAE public and Islamic holidays
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Prayer Time Avoidance</span>
                      <span className="font-medium">{analyticsData.uaeInsights.prayerTimeAvoidance}%</span>
                    </div>
                    <Progress value={analyticsData.uaeInsights.prayerTimeAvoidance} className="h-2" />
                    <p className="text-xs text-gray-600">
                      Emails avoided during Maghrib and Isha prayer times
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bilingual Usage</span>
                      <span className="font-medium">{analyticsData.uaeInsights.bilingualUsage}%</span>
                    </div>
                    <Progress value={analyticsData.uaeInsights.bilingualUsage} className="h-2" />
                    <p className="text-xs text-gray-600">
                      Emails utilizing both Arabic and English content
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Appropriate Tone</span>
                      <span className="font-medium">{analyticsData.uaeInsights.toneAppropriate}%</span>
                    </div>
                    <Progress value={analyticsData.uaeInsights.toneAppropriate} className="h-2" />
                    <p className="text-xs text-gray-600">
                      Emails using culturally appropriate tone and language
                    </p>
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {analyticsData.overview.cultureScore}%
                        </div>
                        <div className="text-sm text-gray-600">Overall Culture Score</div>
                        <div className="flex items-center justify-center mt-2">
                          {analyticsData.overview.cultureScore >= 90 ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Excellent
                            </Badge>
                          ) : analyticsData.overview.cultureScore >= 80 ? (
                            <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                              Good
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-red-100 text-red-800">
                              Needs Improvement
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sequence Type Comparison</CardTitle>
              <CardDescription>
                Performance comparison across different sequence types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.sequenceComparison.map((sequence, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{sequence.sequenceType}</h4>
                      <div className="grid grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                        <div>
                          <span className="block text-xs">Effectiveness</span>
                          <span className="font-medium">{sequence.effectiveness}%</span>
                        </div>
                        <div>
                          <span className="block text-xs">Usage</span>
                          <span className="font-medium">{sequence.usage}%</span>
                        </div>
                        <div>
                          <span className="block text-xs">Avg Duration</span>
                          <span className="font-medium">{sequence.avgDuration} days</span>
                        </div>
                        <div>
                          <span className="block text-xs">Culture Score</span>
                          <span className="font-medium">{sequence.culturalScore}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${sequence.effectiveness}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ab-testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>A/B Test Results</CardTitle>
              <CardDescription>
                Active and completed A/B tests with performance insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.abTests.map((test, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{test.testName}</h4>
                      <Badge variant={test.winningVariant === 'TIE' ? 'secondary' : 'default'}>
                        {test.winningVariant === 'TIE' ? 'Inconclusive' : `Variant ${test.winningVariant} Wins`}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn(
                        "p-3 rounded border",
                        test.winningVariant === 'A' ? "border-green-500 bg-green-50" : "border-gray-200"
                      )}>
                        <div className="text-sm font-medium">Variant A</div>
                        <div className="text-sm text-gray-600">{test.variantA}</div>
                      </div>
                      
                      <div className={cn(
                        "p-3 rounded border",
                        test.winningVariant === 'B' ? "border-green-500 bg-green-50" : "border-gray-200"
                      )}>
                        <div className="text-sm font-medium">Variant B</div>
                        <div className="text-sm text-gray-600">{test.variantB}</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex justify-between text-sm">
                      <span>Improvement: <span className="font-medium text-green-600">+{test.improvement}%</span></span>
                      <span>Confidence: <span className="font-medium">{test.confidence}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6">
                <Button>
                  <Repeat className="h-4 w-4 mr-2" />
                  Start New A/B Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}