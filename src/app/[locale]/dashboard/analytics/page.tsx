'use client'

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { SequencePerformance } from "@/components/analytics/sequence-performance" 
import { EmailAnalytics } from "@/components/analytics/email-analytics"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Calendar,
  Filter,
  RefreshCw,
  Settings,
  Share,
  FileText
} from 'lucide-react'

interface AnalyticsPageProps {
  params: {
    locale: string
  }
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { data: session, status } = useSession()
  const [dateRange, setDateRange] = useState('30')
  const [exportFormat, setExportFormat] = useState('pdf')
  const [isExporting, setIsExporting] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin")
    }
  }, [status])

  const handleExport = async (format: string, section: string) => {
    setIsExporting(true)
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // In a real implementation, this would generate and download the report
    console.log(`Exporting ${section} analytics as ${format}`)
    
    setIsExporting(false)
  }

  const handleDateRangeChange = (newRange: string) => {
    setDateRange(newRange)
    // This would trigger a refresh of all analytics components
  }

  if (status === "loading") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <UAEErrorBoundary>
      <DashboardLayout>
        <div className="space-y-6 p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Analytics & Insights</h1>
              <p className="text-gray-600 mt-1">
                Comprehensive performance analytics for your UAE payment collection campaigns
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="w-[120px]">
                  <FileText className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Report</SelectItem>
                  <SelectItem value="excel">Excel Export</SelectItem>
                  <SelectItem value="csv">CSV Data</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport(exportFormat, 'comprehensive')}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
              
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>

              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                    <p className="text-2xl font-bold">24</p>
                    <div className="flex items-center text-sm text-green-600 mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +12% vs last month
                    </div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">AED 2.45M</p>
                    <div className="flex items-center text-sm text-green-600 mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +18% vs last month
                    </div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">UAE Culture Score</p>
                    <p className="text-2xl font-bold">94.8%</p>
                    <div className="flex items-center text-sm text-green-600 mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +2.3% vs last month
                    </div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Response Rate</p>
                    <p className="text-2xl font-bold">31.2%</p>
                    <div className="flex items-center text-sm text-green-600 mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +5.7% vs last month
                    </div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview Dashboard</TabsTrigger>
              <TabsTrigger value="sequences">Sequence Performance</TabsTrigger>
              <TabsTrigger value="emails">Email Analytics</TabsTrigger>
              <TabsTrigger value="reports">Custom Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Suspense fallback={
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading dashboard...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              }>
                <AnalyticsDashboard 
                  companyId={session.user.companyId}
                  dateRange={dateRange}
                  locale={params.locale}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="sequences" className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Sequence Performance Analysis</h2>
                  <p className="text-gray-600">Deep dive into individual sequence effectiveness</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport(exportFormat, 'sequences')}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Sequence Data
                </Button>
              </div>
              
              <Suspense fallback={
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading sequence analytics...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              }>
                <SequencePerformance 
                  dateRange={dateRange}
                  companyId={session.user.companyId}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="emails" className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Email Campaign Analytics</h2>
                  <p className="text-gray-600">Detailed email performance and UAE cultural insights</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport(exportFormat, 'emails')}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Email Data
                </Button>
              </div>
              
              <Suspense fallback={
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading email analytics...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              }>
                <EmailAnalytics 
                  companyId={session.user.companyId}
                  dateRange={dateRange}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Executive Summary</CardTitle>
                    <CardDescription>
                      High-level overview for leadership team
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Includes:</span>
                        <Badge variant="secondary">Monthly</Badge>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Revenue metrics</li>
                        <li>• Culture compliance score</li>
                        <li>• Key recommendations</li>
                        <li>• Trend analysis</li>
                      </ul>
                      <Button 
                        className="w-full"
                        onClick={() => handleExport('pdf', 'executive')}
                        disabled={isExporting}
                      >
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cultural Compliance Report</CardTitle>
                    <CardDescription>
                      UAE-specific cultural effectiveness analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Includes:</span>
                        <Badge variant="secondary">Weekly</Badge>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Prayer time compliance</li>
                        <li>• Arabic language usage</li>
                        <li>• Holiday awareness</li>
                        <li>• Cultural recommendations</li>
                      </ul>
                      <Button 
                        className="w-full"
                        onClick={() => handleExport('pdf', 'cultural')}
                        disabled={isExporting}
                      >
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Optimization</CardTitle>
                    <CardDescription>
                      Actionable insights for improving campaigns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Includes:</span>
                        <Badge variant="secondary">Bi-weekly</Badge>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• A/B test results</li>
                        <li>• Timing optimization</li>
                        <li>• Content recommendations</li>
                        <li>• ROI improvements</li>
                      </ul>
                      <Button 
                        className="w-full"
                        onClick={() => handleExport('pdf', 'optimization')}
                        disabled={isExporting}
                      >
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Deliverability Health</CardTitle>
                    <CardDescription>
                      Email deliverability and sender reputation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Includes:</span>
                        <Badge variant="secondary">Daily</Badge>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Bounce rate analysis</li>
                        <li>• Domain reputation</li>
                        <li>• Spam score monitoring</li>
                        <li>• Deliverability tips</li>
                      </ul>
                      <Button 
                        className="w-full"
                        onClick={() => handleExport('pdf', 'deliverability')}
                        disabled={isExporting}
                      >
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Impact Analysis</CardTitle>
                    <CardDescription>
                      Financial performance and ROI tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Includes:</span>
                        <Badge variant="secondary">Monthly</Badge>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Revenue attribution</li>
                        <li>• Cost per acquisition</li>
                        <li>• Payment acceleration</li>
                        <li>• ROI by sequence type</li>
                      </ul>
                      <Button 
                        className="w-full"
                        onClick={() => handleExport('pdf', 'revenue')}
                        disabled={isExporting}
                      >
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Custom Analytics</CardTitle>
                    <CardDescription>
                      Build your own custom reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Features:</span>
                        <Badge variant="outline">Pro</Badge>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• Custom date ranges</li>
                        <li>• Metric combinations</li>
                        <li>• Automated scheduling</li>
                        <li>• Team sharing</li>
                      </ul>
                      <Button className="w-full" variant="outline">
                        Create Custom Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </UAEErrorBoundary>
  )
}