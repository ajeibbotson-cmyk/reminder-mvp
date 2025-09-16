'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
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
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts'
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  DollarSign,
  Clock,
  Star,
  Shield,
  Activity,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Filter,
  Search,
  Download,
  Eye
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface CustomerInsightsPanelProps {
  companyId: string
  dateRange: string
  locale: 'en' | 'ar'
  className?: string
}

interface Customer {
  id: string
  name: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  totalValue: number
  paymentBehavior: {
    avgPaymentDays: number
    onTimePayments: number
    latePayments: number
    missedPayments: number
    responseRate: number
  }
  demographics: {
    emirate: string
    businessType: string
    industry: string
    businessSize: 'small' | 'medium' | 'large'
  }
  engagement: {
    emailResponseRate: number
    preferredLanguage: 'en' | 'ar' | 'both'
    culturalCompliance: number
    lastContactDate: string
  }
  predictions: {
    churnRisk: number
    nextPaymentDate: string
    recommendedAction: string
  }
}

interface CustomerSegment {
  name: string
  count: number
  value: number
  avgRiskScore: number
  color: string
  characteristics: string[]
}

interface ChurnRiskData {
  date: string
  lowRisk: number
  mediumRisk: number
  highRisk: number
  criticalRisk: number
}

const CustomerInsightsPanel: React.FC<CustomerInsightsPanelProps> = ({
  companyId,
  dateRange,
  locale,
  className
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [churnData, setChurnData] = useState<ChurnRiskData[]>([])
  const [selectedView, setSelectedView] = useState<'overview' | 'risk-matrix' | 'segments' | 'predictions'>('overview')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [filterEmirate, setFilterEmirate] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isRTL = locale === 'ar'

  // Risk level colors
  const riskColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#7c2d12'
  }

  // UAE Emirates
  const emirates = [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
    'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'
  ]

  // Fetch customer insights data
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/analytics/customers?` + new URLSearchParams({
          companyId,
          dateRange,
          locale,
          includeRiskScoring: 'true',
          includeSegmentation: 'true',
          includeChurnPrediction: 'true'
        }))

        if (!response.ok) {
          throw new Error(`Failed to fetch customer data: ${response.status}`)
        }

        const result = await response.json()

        setCustomers(result.customers || [])
        setSegments(result.segments || [])
        setChurnData(result.churnTrends || [])

      } catch (err) {
        console.error('Error fetching customer data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomerData()
  }, [companyId, dateRange, locale])

  // Filter and search customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesRisk = filterRisk === 'all' || customer.riskLevel === filterRisk
      const matchesEmirate = filterEmirate === 'all' || customer.demographics.emirate === filterEmirate
      const matchesSearch = searchQuery === '' ||
        customer.name.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesRisk && matchesEmirate && matchesSearch
    })
  }, [customers, filterRisk, filterEmirate, searchQuery])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (customers.length === 0) return null

    const totalValue = customers.reduce((sum, c) => sum + c.totalValue, 0)
    const avgRiskScore = customers.reduce((sum, c) => sum + c.riskScore, 0) / customers.length
    const highRiskCount = customers.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length
    const avgPaymentDays = customers.reduce((sum, c) => sum + c.paymentBehavior.avgPaymentDays, 0) / customers.length

    return {
      totalCustomers: customers.length,
      totalValue,
      avgRiskScore,
      highRiskCount,
      highRiskPercentage: (highRiskCount / customers.length) * 100,
      avgPaymentDays
    }
  }, [customers])

  // Custom tooltip for risk matrix
  const RiskMatrixTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const customer = payload[0].payload
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg max-w-xs">
        <p className="font-medium mb-2">{customer.name}</p>
        <div className="space-y-1 text-sm">
          <p>
            {locale === 'ar' ? 'نقاط المخاطر: ' : 'Risk Score: '}
            <span className="font-medium">{customer.riskScore}</span>
          </p>
          <p>
            {locale === 'ar' ? 'القيمة الإجمالية: ' : 'Total Value: '}
            <span className="font-medium">{formatAEDCurrency(customer.totalValue)}</span>
          </p>
          <p>
            {locale === 'ar' ? 'متوسط أيام الدفع: ' : 'Avg Payment Days: '}
            <span className="font-medium">{customer.paymentBehavior.avgPaymentDays}</span>
          </p>
          <p>
            {locale === 'ar' ? 'الإمارة: ' : 'Emirate: '}
            <span className="font-medium">{customer.demographics.emirate}</span>
          </p>
        </div>
      </div>
    )
  }

  // Render risk matrix scatter plot
  const renderRiskMatrix = () => (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="riskScore"
            name="Risk Score"
            domain={[0, 100]}
            axisLine={{ stroke: '#6b7280' }}
          />
          <YAxis
            type="number"
            dataKey="totalValue"
            name="Total Value"
            axisLine={{ stroke: '#6b7280' }}
            tickFormatter={(value) => formatAEDCurrency(value)}
          />
          <Tooltip content={<RiskMatrixTooltip />} />

          <Scatter
            name="Customers"
            data={filteredCustomers}
            fill={(entry: any) => riskColors[entry.riskLevel as keyof typeof riskColors]}
          >
            {filteredCustomers.map((customer, index) => (
              <Cell
                key={`cell-${index}`}
                fill={riskColors[customer.riskLevel]}
              />
            ))}
          </Scatter>

          {/* Risk quadrants */}
          <Area
            type="monotone"
            dataKey={() => 50}
            stroke="none"
            fill="#ef4444"
            fillOpacity={0.1}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )

  // Render customer segments
  const renderSegments = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segments Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {locale === 'ar' ? 'توزيع الشرائح' : 'Segment Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segments}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {segments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Segment Value */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {locale === 'ar' ? 'قيمة الشرائح' : 'Segment Value'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatAEDCurrency(value)} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {segments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((segment, index) => (
          <Card key={index} className="border-l-4" style={{ borderLeftColor: segment.color }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">{segment.name}</h4>
                <Badge
                  variant="outline"
                  style={{ borderColor: segment.color, color: segment.color }}
                >
                  {segment.count} {locale === 'ar' ? 'عميل' : 'customers'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{locale === 'ar' ? 'القيمة الإجمالية:' : 'Total Value:'}</span>
                  <span className="font-medium">{formatAEDCurrency(segment.value)}</span>
                </div>

                <div className="flex justify-between">
                  <span>{locale === 'ar' ? 'متوسط المخاطر:' : 'Avg Risk Score:'}</span>
                  <span className="font-medium">{segment.avgRiskScore.toFixed(1)}</span>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {locale === 'ar' ? 'الخصائص:' : 'Characteristics:'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {segment.characteristics.slice(0, 2).map((char, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {char}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // Render churn risk trends
  const renderChurnTrends = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {locale === 'ar' ? 'اتجاهات مخاطر فقدان العملاء' : 'Churn Risk Trends'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={churnData}>
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
                  dataKey="lowRisk"
                  stackId="1"
                  stroke={riskColors.low}
                  fill={riskColors.low}
                  name={locale === 'ar' ? 'مخاطر منخفضة' : 'Low Risk'}
                />

                <Area
                  type="monotone"
                  dataKey="mediumRisk"
                  stackId="1"
                  stroke={riskColors.medium}
                  fill={riskColors.medium}
                  name={locale === 'ar' ? 'مخاطر متوسطة' : 'Medium Risk'}
                />

                <Area
                  type="monotone"
                  dataKey="highRisk"
                  stackId="1"
                  stroke={riskColors.high}
                  fill={riskColors.high}
                  name={locale === 'ar' ? 'مخاطر عالية' : 'High Risk'}
                />

                <Area
                  type="monotone"
                  dataKey="criticalRisk"
                  stackId="1"
                  stroke={riskColors.critical}
                  fill={riskColors.critical}
                  name={locale === 'ar' ? 'مخاطر حرجة' : 'Critical Risk'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Action Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              {locale === 'ar' ? 'عملاء عالي المخاطر' : 'High-Risk Customers'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customers
                .filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical')
                .slice(0, 5)
                .map((customer, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {locale === 'ar' ? 'نقاط المخاطر: ' : 'Risk Score: '}
                        {customer.riskScore}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      {locale === 'ar' ? 'اتخاذ إجراء' : 'Take Action'}
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-gold-600" />
              {locale === 'ar' ? 'العملاء المتميزون' : 'VIP Customers'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customers
                .filter(c => c.riskLevel === 'low' && c.totalValue > 50000)
                .slice(0, 5)
                .map((customer, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatAEDCurrency(customer.totalValue)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-700">
                      VIP
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
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
              {locale === 'ar' ? `خطأ في تحميل بيانات العملاء: ${error}` : `Error loading customer data: ${error}`}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {locale === 'ar' ? 'رؤى العملاء وتحليل المخاطر' : 'Customer Insights & Risk Analysis'}
              </CardTitle>
              <CardDescription className="mt-1">
                {locale === 'ar'
                  ? 'تحليل سلوك العملاء وتسجيل المخاطر مع التوقعات الذكية'
                  : 'Customer behavior analysis and risk scoring with intelligent predictions'
                }
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder={locale === 'ar' ? 'البحث عن عميل...' : 'Search customer...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48"
              />

              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {locale === 'ar' ? 'جميع المخاطر' : 'All Risk'}
                  </SelectItem>
                  <SelectItem value="low">
                    {locale === 'ar' ? 'منخفض' : 'Low'}
                  </SelectItem>
                  <SelectItem value="medium">
                    {locale === 'ar' ? 'متوسط' : 'Medium'}
                  </SelectItem>
                  <SelectItem value="high">
                    {locale === 'ar' ? 'عالي' : 'High'}
                  </SelectItem>
                  <SelectItem value="critical">
                    {locale === 'ar' ? 'حرج' : 'Critical'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {/* Summary Statistics */}
        {summaryStats && (
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-xl font-bold text-blue-600">
                  {summaryStats.totalCustomers}
                </div>
                <div className="text-xs text-blue-700">
                  {locale === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}
                </div>
              </div>

              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {formatAEDCurrency(summaryStats.totalValue)}
                </div>
                <div className="text-xs text-green-700">
                  {locale === 'ar' ? 'القيمة الإجمالية' : 'Total Value'}
                </div>
              </div>

              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">
                  {summaryStats.avgRiskScore.toFixed(1)}
                </div>
                <div className="text-xs text-yellow-700">
                  {locale === 'ar' ? 'متوسط المخاطر' : 'Avg Risk Score'}
                </div>
              </div>

              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  {summaryStats.highRiskCount}
                </div>
                <div className="text-xs text-red-700">
                  {locale === 'ar' ? 'عالي المخاطر' : 'High Risk'}
                </div>
              </div>

              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {formatPercentage(summaryStats.highRiskPercentage)}
                </div>
                <div className="text-xs text-purple-700">
                  {locale === 'ar' ? 'نسبة المخاطر' : 'Risk Percentage'}
                </div>
              </div>

              <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                <div className="text-xl font-bold text-indigo-600">
                  {summaryStats.avgPaymentDays.toFixed(1)}
                </div>
                <div className="text-xs text-indigo-700">
                  {locale === 'ar' ? 'أيام الدفع' : 'Avg Pay Days'}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            {locale === 'ar' ? 'نظرة عامة' : 'Overview'}
          </TabsTrigger>
          <TabsTrigger value="risk-matrix">
            {locale === 'ar' ? 'مصفوفة المخاطر' : 'Risk Matrix'}
          </TabsTrigger>
          <TabsTrigger value="segments">
            {locale === 'ar' ? 'الشرائح' : 'Segments'}
          </TabsTrigger>
          <TabsTrigger value="predictions">
            {locale === 'ar' ? 'التوقعات' : 'Predictions'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {summaryStats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {locale === 'ar' ? 'تفاصيل العملاء' : 'Customer Details'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{locale === 'ar' ? 'العميل' : 'Customer'}</TableHead>
                        <TableHead>{locale === 'ar' ? 'المخاطر' : 'Risk'}</TableHead>
                        <TableHead>{locale === 'ar' ? 'القيمة' : 'Value'}</TableHead>
                        <TableHead>{locale === 'ar' ? 'الإمارة' : 'Emirate'}</TableHead>
                        <TableHead>{locale === 'ar' ? 'أيام الدفع' : 'Pay Days'}</TableHead>
                        <TableHead>{locale === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.slice(0, 10).map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {customer.demographics.businessType}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: riskColors[customer.riskLevel],
                                color: riskColors[customer.riskLevel]
                              }}
                            >
                              {customer.riskScore}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatAEDCurrency(customer.totalValue)}</TableCell>
                          <TableCell>{customer.demographics.emirate}</TableCell>
                          <TableCell>{customer.paymentBehavior.avgPaymentDays}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risk-matrix" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {locale === 'ar' ? 'مصفوفة المخاطر مقابل القيمة' : 'Risk vs Value Matrix'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar'
                  ? 'تصور العلاقة بين مستوى مخاطر العملاء وقيمتهم التجارية'
                  : 'Visualize the relationship between customer risk levels and business value'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRiskMatrix()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          {renderSegments()}
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          {renderChurnTrends()}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CustomerInsightsPanel
export { CustomerInsightsPanel }