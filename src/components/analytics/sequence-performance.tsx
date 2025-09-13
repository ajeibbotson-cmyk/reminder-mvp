'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  Calendar,
  MessageSquare,
  DollarSign,
  Activity
} from 'lucide-react'
import { 
  FunnelChart,
  Funnel,
  LabelList,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from '@/lib/utils'

interface SequencePerformanceProps {
  sequenceId?: string
  dateRange?: string
  companyId?: string
}

interface SequenceStep {
  stepNumber: number
  stepType: 'email' | 'sms' | 'call' | 'wait'
  name: string
  triggerDelay: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  responded: number
  bounced: number
  unsubscribed: number
  effectiveness: number
  cultureScore: number
  dropoffRate: number
}

interface PerformanceData {
  sequence: {
    id: string
    name: string
    type: string
    status: 'active' | 'paused' | 'draft'
    totalSteps: number
    avgDuration: number
    createdAt: string
    lastModified: string
  }
  overview: {
    totalContacts: number
    completionRate: number
    averageResponseTime: number
    totalRevenue: number
    costPerConversion: number
    roi: number
  }
  funnel: Array<{
    stage: string
    count: number
    rate: number
    dropoff: number
  }>
  steps: SequenceStep[]
  timingAnalysis: Array<{
    day: string
    startedContacts: number
    completedContacts: number
    responseRate: number
    cultureCompliance: number
  }>
  recommendations: Array<{
    type: 'optimization' | 'cultural' | 'timing' | 'content'
    priority: 'high' | 'medium' | 'low'
    title: string
    description: string
    expectedImprovement: string
  }>
}

export function SequencePerformance({ sequenceId, dateRange = '30', companyId }: SequencePerformanceProps) {
  const [selectedSequence, setSelectedSequence] = useState(sequenceId || 'seq-001')
  const [selectedDateRange, setSelectedDateRange] = useState(dateRange)
  const [isLoading, setIsLoading] = useState(true)
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)

  useEffect(() => {
    const fetchSequencePerformance = async () => {
      setIsLoading(true)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const mockData: PerformanceData = {
        sequence: {
          id: selectedSequence,
          name: 'Gentle Collection Sequence',
          type: 'payment_reminder',
          status: 'active',
          totalSteps: 5,
          avgDuration: 14,
          createdAt: '2024-01-15',
          lastModified: '2024-01-20'
        },
        overview: {
          totalContacts: 847,
          completionRate: 78.3,
          averageResponseTime: 2.4,
          totalRevenue: 186500,
          costPerConversion: 12.50,
          roi: 3.2
        },
        funnel: [
          { stage: 'Sequence Started', count: 847, rate: 100, dropoff: 0 },
          { stage: 'First Email Delivered', count: 829, rate: 97.9, dropoff: 2.1 },
          { stage: 'First Email Opened', count: 267, rate: 32.2, dropoff: 67.8 },
          { stage: 'Any Response Received', count: 156, rate: 18.8, dropoff: 81.2 },
          { stage: 'Payment Initiated', count: 134, rate: 16.1, dropoff: 83.9 },
          { stage: 'Payment Completed', count: 127, rate: 15.3, dropoff: 84.7 }
        ],
        steps: [
          {
            stepNumber: 1,
            stepType: 'email',
            name: 'Friendly Payment Reminder',
            triggerDelay: 0,
            sent: 847,
            delivered: 829,
            opened: 267,
            clicked: 45,
            responded: 23,
            bounced: 18,
            unsubscribed: 2,
            effectiveness: 89.2,
            cultureScore: 95.8,
            dropoffRate: 2.1
          },
          {
            stepNumber: 2,
            stepType: 'wait',
            name: 'Wait Period (Respect Business Hours)',
            triggerDelay: 3,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            responded: 0,
            bounced: 0,
            unsubscribed: 0,
            effectiveness: 100,
            cultureScore: 98.5,
            dropoffRate: 5.2
          },
          {
            stepNumber: 3,
            stepType: 'email',
            name: 'Professional Follow-up',
            triggerDelay: 3,
            sent: 785,
            delivered: 771,
            opened: 234,
            clicked: 67,
            responded: 45,
            bounced: 14,
            unsubscribed: 3,
            effectiveness: 87.6,
            cultureScore: 92.3,
            dropoffRate: 7.8
          },
          {
            stepNumber: 4,
            stepType: 'email',
            name: 'Account Statement Reminder',
            triggerDelay: 7,
            sent: 668,
            delivered: 651,
            opened: 198,
            clicked: 89,
            responded: 67,
            bounced: 17,
            unsubscribed: 1,
            effectiveness: 85.4,
            cultureScore: 94.1,
            dropoffRate: 12.5
          },
          {
            stepNumber: 5,
            stepType: 'email',
            name: 'Final Notice (Relationship Preserving)',
            triggerDelay: 14,
            sent: 432,
            delivered: 421,
            opened: 167,
            clicked: 78,
            responded: 89,
            bounced: 11,
            unsubscribed: 4,
            effectiveness: 91.8,
            cultureScore: 89.7,
            dropoffRate: 18.9
          }
        ],
        timingAnalysis: [
          { day: '2024-01-01', startedContacts: 32, completedContacts: 24, responseRate: 18.2, cultureCompliance: 94.1 },
          { day: '2024-01-02', startedContacts: 45, completedContacts: 36, responseRate: 21.5, cultureCompliance: 96.3 },
          { day: '2024-01-03', startedContacts: 38, completedContacts: 29, responseRate: 19.8, cultureCompliance: 95.7 },
          { day: '2024-01-04', startedContacts: 52, completedContacts: 41, responseRate: 23.1, cultureCompliance: 97.2 },
          { day: '2024-01-05', startedContacts: 29, completedContacts: 22, responseRate: 17.4, cultureCompliance: 93.8 },
          { day: '2024-01-06', startedContacts: 41, completedContacts: 33, responseRate: 20.7, cultureCompliance: 95.4 },
          { day: '2024-01-07', startedContacts: 35, completedContacts: 28, responseRate: 19.1, cultureCompliance: 94.9 }
        ],
        recommendations: [
          {
            type: 'timing',
            priority: 'high',
            title: 'Optimize Send Times for Better Engagement',
            description: 'Data shows 23% higher open rates when emails are sent between 10-11 AM UAE time, avoiding prayer times.',
            expectedImprovement: '+15% response rate'
          },
          {
            type: 'cultural',
            priority: 'high',
            title: 'Enhance Arabic Content Integration',
            description: 'Adding more Arabic phrases and cultural references could improve engagement by 18% based on UAE market data.',
            expectedImprovement: '+18% engagement'
          },
          {
            type: 'content',
            priority: 'medium',
            title: 'Personalize Subject Lines',
            description: 'Including company name and invoice number in subject lines shows 12% better open rates.',
            expectedImprovement: '+12% open rate'
          },
          {
            type: 'optimization',
            priority: 'medium',
            title: 'Reduce Wait Time Between Steps 3-4',
            description: 'Analysis suggests reducing the 7-day wait to 5 days could capture 8% more responses before contacts lose interest.',
            expectedImprovement: '+8% conversion'
          }
        ]
      }
      
      setPerformanceData(mockData)
      setIsLoading(false)
    }

    fetchSequencePerformance()
  }, [selectedSequence, selectedDateRange])

  if (isLoading || !performanceData) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const CustomFunnelChart = ({ data }: { data: any[] }) => (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{item.stage}</span>
            <div className="text-right">
              <span className="text-lg font-bold">{item.count.toLocaleString()}</span>
              <span className="text-sm text-gray-500 ml-2">({item.rate.toFixed(1)}%)</span>
            </div>
          </div>
          
          <div className="relative">
            <div className="w-full bg-gray-200 rounded h-8 overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded transition-all duration-500",
                  index === 0 ? "bg-green-500" :
                  index === 1 ? "bg-green-400" :
                  index === 2 ? "bg-yellow-500" :
                  index === 3 ? "bg-orange-500" :
                  index === 4 ? "bg-orange-600" : "bg-red-500"
                )}
                style={{ width: `${item.rate}%` }}
              ></div>
            </div>
            
            {index < data.length - 1 && (
              <div className="absolute -bottom-1 right-4 text-xs text-red-600 bg-white px-1 rounded">
                -{item.dropoff.toFixed(1)}%
              </div>
            )}
          </div>
          
          {index < data.length - 1 && (
            <div className="flex justify-center my-1">
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{performanceData.sequence.name}</h2>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant={performanceData.sequence.status === 'active' ? 'default' : 'secondary'}>
              {performanceData.sequence.status}
            </Badge>
            <span className="text-sm text-gray-600">
              {performanceData.sequence.totalSteps} steps • {performanceData.sequence.avgDuration} day avg duration
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
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
            Compare Sequences
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Contacts</p>
                <p className="text-2xl font-bold">{performanceData.overview.totalContacts.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold">{performanceData.overview.completionRate}%</p>
              </div>
              <Target className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-bold">{performanceData.overview.averageResponseTime} days</p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue Generated</p>
                <p className="text-2xl font-bold">AED {performanceData.overview.totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cost per Conversion</p>
                <p className="text-2xl font-bold">AED {performanceData.overview.costPerConversion}</p>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ROI</p>
                <p className="text-2xl font-bold">{performanceData.overview.roi}x</p>
              </div>
              <TrendingUp className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
          <TabsTrigger value="steps">Step Analysis</TabsTrigger>
          <TabsTrigger value="timing">Timing Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel Visualization</CardTitle>
                <CardDescription>
                  Track how contacts progress through each stage of the sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomFunnelChart data={performanceData.funnel} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Funnel Analysis</CardTitle>
                <CardDescription>
                  Key insights and conversion metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {performanceData.funnel[performanceData.funnel.length - 1].rate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-green-700">Final Conversion Rate</div>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {(performanceData.funnel[2].rate - performanceData.funnel[1].rate).toFixed(1)}%
                    </div>
                    <div className="text-sm text-blue-700">Biggest Drop-off</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Conversion Insights:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Strong initial delivery rate (97.9%)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>Opportunity to improve open rates (32.2%)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>Good response-to-payment conversion (81.4%)</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="steps" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Performance</CardTitle>
              <CardDescription>
                Detailed analysis of each sequence step
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {performanceData.steps.map((step, index) => (
                  <div key={step.stepNumber} className="border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold">
                          {step.stepNumber}
                        </div>
                        <div>
                          <h4 className="font-medium">{step.name}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Type: {step.stepType}</span>
                            {step.triggerDelay > 0 && (
                              <span>Delay: {step.triggerDelay} days</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Effectiveness</div>
                          <div className="text-lg font-bold">{step.effectiveness}%</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Culture Score</div>
                          <div className="text-lg font-bold">{step.cultureScore}%</div>
                        </div>
                      </div>
                    </div>

                    {step.stepType === 'email' && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500">Sent</span>
                          <span className="font-medium">{step.sent.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Delivered</span>
                          <span className="font-medium">{step.delivered.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Opened</span>
                          <span className="font-medium">{step.opened.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Clicked</span>
                          <span className="font-medium">{step.clicked.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Responded</span>
                          <span className="font-medium">{step.responded.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Bounced</span>
                          <span className="font-medium">{step.bounced.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">Unsubscribed</span>
                          <span className="font-medium">{step.unsubscribed.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Performance</span>
                          <span>{step.effectiveness}%</span>
                        </div>
                        <Progress value={step.effectiveness} className="h-2" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Cultural Compliance</span>
                          <span>{step.cultureScore}%</span>
                        </div>
                        <Progress value={step.cultureScore} className="h-2" />
                      </div>
                    </div>

                    {step.dropoffRate > 10 && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">
                            High drop-off rate of {step.dropoffRate}% detected at this step
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timing Performance Analysis</CardTitle>
              <CardDescription>
                How sequence performance varies by start time and cultural factors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData.timingAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="day" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: any, name: string) => [
                        name.includes('Rate') || name.includes('Compliance') ? `${value.toFixed(1)}%` : value,
                        name.replace(/([A-Z])/g, ' $1')
                      ]}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="responseRate" 
                      stroke="#3B82F6" 
                      strokeWidth={2} 
                      name="Response Rate" 
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="cultureCompliance" 
                      stroke="#10B981" 
                      strokeWidth={2} 
                      name="Culture Compliance" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Volume Distribution</CardTitle>
                <CardDescription>
                  Contacts started vs completed by day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData.timingAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="day" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <Bar dataKey="startedContacts" fill="#3B82F6" name="Started" />
                      <Bar dataKey="completedContacts" fill="#10B981" name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
                <CardDescription>
                  Key timing and cultural observations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      <strong>Best performance:</strong> Sundays and Tuesdays
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      <strong>Optimal timing:</strong> 10-11 AM UAE time
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">
                      <strong>Cultural score:</strong> Consistently above 93%
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Recommendations:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Schedule more sequences on Sundays and Tuesdays</li>
                    <li>• Focus sends between 10-11 AM for best engagement</li>
                    <li>• Maintain current cultural compliance practices</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <div className="grid gap-6">
            {performanceData.recommendations.map((rec, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn(
                        "p-2 rounded-lg",
                        rec.type === 'optimization' ? "bg-blue-100" :
                        rec.type === 'cultural' ? "bg-green-100" :
                        rec.type === 'timing' ? "bg-yellow-100" : "bg-purple-100"
                      )}>
                        <Lightbulb className={cn(
                          "h-5 w-5",
                          rec.type === 'optimization' ? "text-blue-600" :
                          rec.type === 'cultural' ? "text-green-600" :
                          rec.type === 'timing' ? "text-yellow-600" : "text-purple-600"
                        )} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{rec.title}</h3>
                          <Badge 
                            variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                          >
                            {rec.priority} priority
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                        
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-green-600">
                            Expected improvement: {rec.expectedImprovement}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Button size="sm" variant="outline">
                      Apply Recommendation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}