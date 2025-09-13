'use client'

import { useState, useEffect } from 'react'
import { 
  Mail,
  Eye,
  MousePointer,
  TrendingUp,
  TrendingDown,
  Clock,
  Globe,
  Users,
  MessageSquare,
  Languages,
  Calendar,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart
} from 'lucide-react'
import { 
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from '@/lib/utils'

interface EmailAnalyticsProps {
  companyId: string
  dateRange?: string
  templateId?: string
}

interface EmailMetrics {
  overview: {
    totalEmailsSent: number
    deliveryRate: number
    openRate: number
    clickRate: number
    responseRate: number
    bounceRate: number
    unsubscribeRate: number
    averageEngagement: number
  }
  deliverability: {
    deliveredEmails: number
    bouncedEmails: number
    blockedEmails: number
    deferredEmails: number
    reputationScore: number
    domainHealth: number
  }
  engagement: {
    hourlyEngagement: Array<{ hour: number; opens: number; clicks: number; responses: number }>
    dailyEngagement: Array<{ day: string; opens: number; clicks: number; responses: number }>
    deviceBreakdown: Array<{ device: string; percentage: number; color: string }>
    locationData: Array<{ emirate: string; engagement: number; volume: number }>
  }
  cultural: {
    languagePerformance: Array<{ language: string; opens: number; clicks: number; responses: number; volume: number }>
    culturalElements: {
      arabicGreetings: { usage: number; effectiveness: number }
      islamicPhrases: { usage: number; effectiveness: number }
      localReferences: { usage: number; effectiveness: number }
      culturalTiming: { compliance: number; effectiveness: number }
    }
    ramadanPerformance: {
      beforeRamadan: number
      duringRamadan: number
      afterRamadan: number
    }
  }
  timing: {
    optimalSendTimes: Array<{ hour: number; effectiveness: number; volume: number }>
    prayerTimeImpact: Array<{ prayer: string; beforePrayer: number; afterPrayer: number }>
    businessHoursCompliance: number
    weekdayPerformance: Array<{ day: string; effectiveness: number; volume: number }>
  }
  abTests: Array<{
    testId: string
    name: string
    status: 'running' | 'completed' | 'paused'
    variants: Array<{
      name: string
      type: 'subject' | 'content' | 'sendTime' | 'language'
      openRate: number
      clickRate: number
      responseRate: number
      sampleSize: number
    }>
    winner?: string
    confidence?: number
    startDate: string
    endDate?: string
  }>
}

export function EmailAnalytics({ companyId, dateRange = '30', templateId }: EmailAnalyticsProps) {
  const [selectedDateRange, setSelectedDateRange] = useState(dateRange)
  const [selectedTemplate, setSelectedTemplate] = useState(templateId || 'all')
  const [isLoading, setIsLoading] = useState(true)
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics | null>(null)

  useEffect(() => {
    const fetchEmailAnalytics = async () => {
      setIsLoading(true)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockData: EmailMetrics = {
        overview: {
          totalEmailsSent: 8547,
          deliveryRate: 97.8,
          openRate: 31.2,
          clickRate: 8.7,
          responseRate: 4.2,
          bounceRate: 2.2,
          unsubscribeRate: 0.3,
          averageEngagement: 89.4
        },
        deliverability: {
          deliveredEmails: 8359,
          bouncedEmails: 188,
          blockedEmails: 23,
          deferredEmails: 45,
          reputationScore: 94.2,
          domainHealth: 96.7
        },
        engagement: {
          hourlyEngagement: [
            { hour: 8, opens: 45, clicks: 12, responses: 3 },
            { hour: 9, opens: 67, clicks: 18, responses: 8 },
            { hour: 10, opens: 89, clicks: 24, responses: 12 },
            { hour: 11, opens: 78, clicks: 21, responses: 9 },
            { hour: 12, opens: 34, clicks: 8, responses: 2 },
            { hour: 13, opens: 23, clicks: 5, responses: 1 },
            { hour: 14, opens: 71, clicks: 19, responses: 7 },
            { hour: 15, opens: 65, clicks: 17, responses: 6 },
            { hour: 16, opens: 58, clicks: 15, responses: 5 },
            { hour: 17, opens: 42, clicks: 11, responses: 3 }
          ],
          dailyEngagement: [
            { day: '2024-01-01', opens: 234, clicks: 67, responses: 23 },
            { day: '2024-01-02', opens: 267, clicks: 78, responses: 31 },
            { day: '2024-01-03', opens: 198, clicks: 54, responses: 18 },
            { day: '2024-01-04', opens: 289, clicks: 89, responses: 37 },
            { day: '2024-01-05', opens: 156, clicks: 41, responses: 14 },
            { day: '2024-01-06', opens: 178, clicks: 48, responses: 16 },
            { day: '2024-01-07', opens: 203, clicks: 59, responses: 21 }
          ],
          deviceBreakdown: [
            { device: 'Mobile', percentage: 67.3, color: '#3B82F6' },
            { device: 'Desktop', percentage: 28.4, color: '#10B981' },
            { device: 'Tablet', percentage: 4.3, color: '#F59E0B' }
          ],
          locationData: [
            { emirate: 'Dubai', engagement: 89.2, volume: 3420 },
            { emirate: 'Abu Dhabi', engagement: 87.5, volume: 2180 },
            { emirate: 'Sharjah', engagement: 85.1, volume: 1560 },
            { emirate: 'Ajman', engagement: 83.7, volume: 680 },
            { emirate: 'Ras Al Khaimah', engagement: 81.9, volume: 420 },
            { emirate: 'Fujairah', engagement: 84.2, volume: 180 },
            { emirate: 'Umm Al Quwain', engagement: 82.6, volume: 107 }
          ]
        },
        cultural: {
          languagePerformance: [
            { language: 'English', opens: 28.4, clicks: 7.8, responses: 3.9, volume: 5128 },
            { language: 'Arabic', opens: 35.7, clicks: 10.2, responses: 5.1, volume: 2419 },
            { language: 'Bilingual', opens: 42.3, clicks: 12.6, responses: 6.8, volume: 1000 }
          ],
          culturalElements: {
            arabicGreetings: { usage: 67.3, effectiveness: 112.4 },
            islamicPhrases: { usage: 23.7, effectiveness: 127.8 },
            localReferences: { usage: 45.2, effectiveness: 108.9 },
            culturalTiming: { compliance: 94.7, effectiveness: 115.6 }
          },
          ramadanPerformance: {
            beforeRamadan: 31.8,
            duringRamadan: 18.4,
            afterRamadan: 35.2
          }
        },
        timing: {
          optimalSendTimes: [
            { hour: 9, effectiveness: 94.2, volume: 856 },
            { hour: 10, effectiveness: 97.8, volume: 1234 },
            { hour: 11, effectiveness: 89.5, volume: 978 },
            { hour: 14, effectiveness: 91.7, volume: 1089 },
            { hour: 15, effectiveness: 88.3, volume: 745 },
            { hour: 16, effectiveness: 85.9, volume: 623 }
          ],
          prayerTimeImpact: [
            { prayer: 'Fajr', beforePrayer: 78.2, afterPrayer: 89.7 },
            { prayer: 'Dhuhr', beforePrayer: 91.4, afterPrayer: 67.8 },
            { prayer: 'Asr', beforePrayer: 88.6, afterPrayer: 82.3 },
            { prayer: 'Maghrib', beforePrayer: 85.1, afterPrayer: 45.2 },
            { prayer: 'Isha', beforePrayer: 72.9, afterPrayer: 38.7 }
          ],
          businessHoursCompliance: 96.8,
          weekdayPerformance: [
            { day: 'Sunday', effectiveness: 92.4, volume: 1456 },
            { day: 'Monday', effectiveness: 89.7, volume: 1389 },
            { day: 'Tuesday', effectiveness: 94.1, volume: 1502 },
            { day: 'Wednesday', effectiveness: 87.3, volume: 1298 },
            { day: 'Thursday', effectiveness: 85.9, volume: 1167 },
            { day: 'Friday', effectiveness: 45.2, volume: 234 },
            { day: 'Saturday', effectiveness: 78.6, volume: 501 }
          ]
        },
        abTests: [
          {
            testId: 'ab-001',
            name: 'Arabic Subject Line vs English',
            status: 'completed',
            variants: [
              { name: 'English Subject', type: 'subject', openRate: 28.4, clickRate: 7.2, responseRate: 3.4, sampleSize: 1000 },
              { name: 'Arabic Subject', type: 'subject', openRate: 35.7, clickRate: 9.8, responseRate: 4.9, sampleSize: 1000 }
            ],
            winner: 'Arabic Subject',
            confidence: 94.2,
            startDate: '2024-01-01',
            endDate: '2024-01-15'
          },
          {
            testId: 'ab-002',
            name: 'Send Time Optimization',
            status: 'running',
            variants: [
              { name: '10 AM Send', type: 'sendTime', openRate: 32.1, clickRate: 8.7, responseRate: 4.2, sampleSize: 750 },
              { name: '2 PM Send', type: 'sendTime', openRate: 29.8, clickRate: 7.9, responseRate: 3.8, sampleSize: 750 }
            ],
            startDate: '2024-01-20'
          },
          {
            testId: 'ab-003',
            name: 'Cultural Greeting Variations',
            status: 'completed',
            variants: [
              { name: 'Standard Greeting', type: 'content', openRate: 30.2, clickRate: 8.1, responseRate: 3.9, sampleSize: 500 },
              { name: 'Islamic Greeting', type: 'content', openRate: 38.6, clickRate: 11.4, responseRate: 5.7, sampleSize: 500 }
            ],
            winner: 'Islamic Greeting',
            confidence: 89.7,
            startDate: '2024-01-10',
            endDate: '2024-01-25'
          }
        ]
      }
      
      setEmailMetrics(mockData)
      setIsLoading(false)
    }

    fetchEmailAnalytics()
  }, [companyId, selectedDateRange, selectedTemplate])

  if (isLoading || !emailMetrics) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    format = 'percentage',
    color = 'blue'
  }: {
    title: string
    value: number
    change?: number
    icon: any
    format?: 'percentage' | 'number' | 'rate'
    color?: string
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'percentage':
          return `${value.toFixed(1)}%`
        case 'number':
          return value.toLocaleString()
        case 'rate':
          return `${value.toFixed(1)}%`
        default:
          return value.toString()
      }
    }

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
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
                  {Math.abs(change).toFixed(1)}% vs last period
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
          <h2 className="text-2xl font-bold">Email Analytics</h2>
          <p className="text-gray-600 mt-1">
            Detailed insights for UAE email campaign performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              <SelectItem value="reminder">Payment Reminders</SelectItem>
              <SelectItem value="followup">Follow-ups</SelectItem>
              <SelectItem value="notice">Final Notices</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <MetricCard
          title="Emails Sent"
          value={emailMetrics.overview.totalEmailsSent}
          change={8.2}
          format="number"
          icon={Mail}
        />
        <MetricCard
          title="Delivery Rate"
          value={emailMetrics.overview.deliveryRate}
          change={1.3}
          icon={CheckCircle}
        />
        <MetricCard
          title="Open Rate"
          value={emailMetrics.overview.openRate}
          change={5.7}
          icon={Eye}
        />
        <MetricCard
          title="Click Rate"
          value={emailMetrics.overview.clickRate}
          change={2.1}
          icon={MousePointer}
        />
        <MetricCard
          title="Response Rate"
          value={emailMetrics.overview.responseRate}
          change={3.4}
          icon={MessageSquare}
        />
        <MetricCard
          title="Bounce Rate"
          value={emailMetrics.overview.bounceRate}
          change={-0.8}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Unsubscribe Rate"
          value={emailMetrics.overview.unsubscribeRate}
          change={-0.2}
          icon={Users}
        />
        <MetricCard
          title="Engagement Score"
          value={emailMetrics.overview.averageEngagement}
          change={4.1}
          icon={Target}
        />
      </div>

      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="deliverability">Deliverability</TabsTrigger>
          <TabsTrigger value="cultural">Cultural Insights</TabsTrigger>
          <TabsTrigger value="timing">Optimal Timing</TabsTrigger>
          <TabsTrigger value="testing">A/B Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Engagement Trends</CardTitle>
                <CardDescription>
                  Email opens, clicks, and responses over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={emailMetrics.engagement.dailyEngagement}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="day" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <Area type="monotone" dataKey="opens" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="clicks" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="responses" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hourly Engagement Pattern</CardTitle>
                <CardDescription>
                  Best performing hours throughout the day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emailMetrics.engagement.hourlyEngagement}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                      <YAxis />
                      <Tooltip labelFormatter={(hour) => `${hour}:00 UAE Time`} />
                      <Bar dataKey="opens" fill="#3B82F6" name="Opens" />
                      <Bar dataKey="clicks" fill="#10B981" name="Clicks" />
                      <Bar dataKey="responses" fill="#F59E0B" name="Responses" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
                <CardDescription>
                  How users engage across different devices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={emailMetrics.engagement.deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="percentage"
                        label={({ device, percentage }) => `${device}: ${percentage}%`}
                      >
                        {emailMetrics.engagement.deviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Usage']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement by Emirates</CardTitle>
                <CardDescription>
                  Performance across UAE regions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailMetrics.engagement.locationData.map((location, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{location.emirate}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold">{location.engagement.toFixed(1)}%</span>
                        <span className="text-xs text-gray-500 ml-2">({location.volume} emails)</span>
                      </div>
                    </div>
                    <Progress value={location.engagement} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deliverability" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Status Breakdown</CardTitle>
                <CardDescription>
                  Email delivery success and failure analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {emailMetrics.deliverability.deliveredEmails.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-700">Delivered</div>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {emailMetrics.deliverability.bouncedEmails.toLocaleString()}
                    </div>
                    <div className="text-sm text-red-700">Bounced</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {emailMetrics.deliverability.blockedEmails.toLocaleString()}
                    </div>
                    <div className="text-sm text-orange-700">Blocked</div>
                  </div>
                  
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {emailMetrics.deliverability.deferredEmails.toLocaleString()}
                    </div>
                    <div className="text-sm text-yellow-700">Deferred</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sender Reputation</CardTitle>
                <CardDescription>
                  Your domain and IP reputation scores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Reputation Score</span>
                    <span className="font-medium">{emailMetrics.deliverability.reputationScore}%</span>
                  </div>
                  <Progress value={emailMetrics.deliverability.reputationScore} className="h-3" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Domain Health</span>
                    <span className="font-medium">{emailMetrics.deliverability.domainHealth}%</span>
                  </div>
                  <Progress value={emailMetrics.deliverability.domainHealth} className="h-3" />
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Recommendations:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Monitor bounce rates closely</li>
                    <li>• Clean your email list regularly</li>
                    <li>• Implement SPF and DKIM records</li>
                    <li>• Maintain consistent sending patterns</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cultural" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Language Performance</CardTitle>
                <CardDescription>
                  Effectiveness of different language approaches
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {emailMetrics.cultural.languagePerformance.map((lang, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">{lang.language}</h4>
                        <Badge variant="outline">{lang.volume.toLocaleString()} emails</Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500">Open Rate</span>
                          <span className="font-medium">{lang.opens.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Click Rate</span>
                          <span className="font-medium">{lang.clicks.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Response Rate</span>
                          <span className="font-medium">{lang.responses.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cultural Elements Impact</CardTitle>
                <CardDescription>
                  How UAE cultural elements affect engagement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Arabic Greetings</span>
                    <div className="text-right">
                      <span className="font-medium">{emailMetrics.cultural.culturalElements.arabicGreetings.usage}% usage</span>
                      <div className="text-xs text-green-600">+{(emailMetrics.cultural.culturalElements.arabicGreetings.effectiveness - 100).toFixed(1)}% effectiveness</div>
                    </div>
                  </div>
                  <Progress value={emailMetrics.cultural.culturalElements.arabicGreetings.usage} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Islamic Phrases</span>
                    <div className="text-right">
                      <span className="font-medium">{emailMetrics.cultural.culturalElements.islamicPhrases.usage}% usage</span>
                      <div className="text-xs text-green-600">+{(emailMetrics.cultural.culturalElements.islamicPhrases.effectiveness - 100).toFixed(1)}% effectiveness</div>
                    </div>
                  </div>
                  <Progress value={emailMetrics.cultural.culturalElements.islamicPhrases.usage} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Local References</span>
                    <div className="text-right">
                      <span className="font-medium">{emailMetrics.cultural.culturalElements.localReferences.usage}% usage</span>
                      <div className="text-xs text-green-600">+{(emailMetrics.cultural.culturalElements.localReferences.effectiveness - 100).toFixed(1)}% effectiveness</div>
                    </div>
                  </div>
                  <Progress value={emailMetrics.cultural.culturalElements.localReferences.usage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ramadan Performance Impact</CardTitle>
              <CardDescription>
                Email engagement during different periods of Ramadan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {emailMetrics.cultural.ramadanPerformance.beforeRamadan.toFixed(1)}%
                  </div>
                  <div className="text-sm text-blue-700">Before Ramadan</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {emailMetrics.cultural.ramadanPerformance.duringRamadan.toFixed(1)}%
                  </div>
                  <div className="text-sm text-orange-700">During Ramadan</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {emailMetrics.cultural.ramadanPerformance.afterRamadan.toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-700">After Ramadan</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    42% decrease in engagement during Ramadan - adjust expectations and frequency
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Optimal Send Times</CardTitle>
                <CardDescription>
                  Best performing hours for email delivery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emailMetrics.timing.optimalSendTimes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(hour) => `${hour}:00 UAE Time`}
                        formatter={(value, name) => [
                          name === 'effectiveness' ? `${value.toFixed(1)}%` : value,
                          name === 'effectiveness' ? 'Effectiveness' : 'Volume'
                        ]}
                      />
                      <Bar dataKey="effectiveness" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prayer Time Impact</CardTitle>
                <CardDescription>
                  Engagement before vs after prayer times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {emailMetrics.timing.prayerTimeImpact.map((prayer, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">{prayer.prayer}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {prayer.beforePrayer.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">Before Prayer</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {prayer.afterPrayer.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">After Prayer</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Weekday Performance</CardTitle>
              <CardDescription>
                Email effectiveness by day of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emailMetrics.timing.weekdayPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [
                      name === 'effectiveness' ? `${value.toFixed(1)}%` : value,
                      name === 'effectiveness' ? 'Effectiveness' : 'Volume'
                    ]} />
                    <Bar dataKey="effectiveness" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <div className="space-y-6">
            {emailMetrics.abTests.map((test, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{test.name}</CardTitle>
                      <CardDescription>
                        {test.status === 'running' ? 'Currently running' : `Completed on ${test.endDate}`}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={test.status === 'running' ? 'default' : test.status === 'completed' ? 'secondary' : 'outline'}
                    >
                      {test.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {test.variants.map((variant, variantIndex) => (
                      <div 
                        key={variantIndex} 
                        className={cn(
                          "p-4 border rounded-lg",
                          test.winner === variant.name ? "border-green-500 bg-green-50" : "border-gray-200"
                        )}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium">{variant.name}</h4>
                          {test.winner === variant.name && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Winner
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="block text-xs text-gray-500">Open Rate</span>
                            <span className="font-medium">{variant.openRate.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Click Rate</span>
                            <span className="font-medium">{variant.clickRate.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Response Rate</span>
                            <span className="font-medium">{variant.responseRate.toFixed(1)}%</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          Sample size: {variant.sampleSize.toLocaleString()} emails
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {test.winner && test.confidence && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-800">
                          {test.winner} wins with {test.confidence}% confidence
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Button>
                  <Target className="h-4 w-4 mr-2" />
                  Create New A/B Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}