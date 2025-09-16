'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts'
import {
  Moon,
  Sun,
  Calendar,
  Clock,
  Globe2,
  MapPin,
  Users,
  Star,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  Languages,
  Heart,
  Zap,
  Shield,
  Award,
  Target,
  Activity
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

interface UAEBusinessIntelligenceProps {
  companyId: string
  dateRange: string
  locale: 'en' | 'ar'
  data?: {
    prayerTimeCompliance: number
    ramadanAdjustments: number
    businessHoursOptimization: number
    culturalSentimentScore: number
  }
  className?: string
}

interface CulturalMetrics {
  prayerTimeCompliance: {
    score: number
    fajr: number
    dhuhr: number
    asr: number
    maghrib: number
    isha: number
    impactOnResponses: number
  }
  ramadanCompliance: {
    overallScore: number
    schedulingAdjustment: number
    contentAdaptation: number
    workingHoursRespect: number
    fastingConsideration: number
  }
  languageUsage: {
    arabicPreference: number
    englishPreference: number
    bilingualEffectiveness: number
    rtlOptimization: number
  }
  businessEtiquette: {
    greetingsScore: number
    respectfulCommunication: number
    formalityLevel: number
    relationshipBuilding: number
  }
  calendarCompliance: {
    islamicHolidays: number
    nationalDays: number
    weekendAdjustments: number
    businessSeasons: number
  }
  emirateSpecific: {
    dubai: { effectiveness: number; volume: number }
    abuDhabi: { effectiveness: number; volume: number }
    sharjah: { effectiveness: number; volume: number }
    ajman: { effectiveness: number; volume: number }
    rasAlKhaimah: { effectiveness: number; volume: number }
    fujairah: { effectiveness: number; volume: number }
    ummAlQuwain: { effectiveness: number; volume: number }
  }
}

interface CulturalInsight {
  type: 'success' | 'warning' | 'improvement' | 'celebration'
  category: 'prayer' | 'ramadan' | 'language' | 'etiquette' | 'calendar' | 'emirate'
  title: string
  description: string
  recommendation: string
  impact: 'high' | 'medium' | 'low'
  urgency: 'immediate' | 'soon' | 'later'
}

const UAEBusinessIntelligence: React.FC<UAEBusinessIntelligenceProps> = ({
  companyId,
  dateRange,
  locale,
  data: propData,
  className
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [culturalMetrics, setCulturalMetrics] = useState<CulturalMetrics | null>(null)
  const [insights, setInsights] = useState<CulturalInsight[]>([])
  const [selectedView, setSelectedView] = useState<'overview' | 'prayer-times' | 'ramadan' | 'emirates' | 'recommendations'>('overview')
  const [error, setError] = useState<string | null>(null)

  const isRTL = locale === 'ar'

  // Prayer time names in both languages
  const prayerNames = {
    en: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    ar: ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء']
  }

  // UAE Emirates with colors
  const emirateColors = {
    dubai: '#e97132',
    abuDhabi: '#2563eb',
    sharjah: '#16a34a',
    ajman: '#dc2626',
    rasAlKhaimah: '#7c3aed',
    fujairah: '#0891b2',
    ummAlQuwain: '#ea580c'
  }

  // Fetch UAE business intelligence data
  useEffect(() => {
    const fetchUAEData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/analytics/uae-intelligence?` + new URLSearchParams({
          companyId,
          dateRange,
          locale,
          includeDetailedMetrics: 'true',
          includePrayerTimes: 'true',
          includeEmirateBreakdown: 'true'
        }))

        if (!response.ok) {
          throw new Error(`Failed to fetch UAE intelligence data: ${response.status}`)
        }

        const result = await response.json()

        setCulturalMetrics(result.culturalMetrics || null)
        setInsights(result.insights || [])

      } catch (err) {
        console.error('Error fetching UAE data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUAEData()
  }, [companyId, dateRange, locale])

  // Calculate overall cultural compliance score
  const overallComplianceScore = useMemo(() => {
    if (!culturalMetrics) return 0

    const scores = [
      culturalMetrics.prayerTimeCompliance.score,
      culturalMetrics.ramadanCompliance.overallScore,
      culturalMetrics.languageUsage.bilingualEffectiveness,
      culturalMetrics.businessEtiquette.respectfulCommunication,
      culturalMetrics.calendarCompliance.islamicHolidays
    ]

    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }, [culturalMetrics])

  // Prayer times compliance chart data
  const prayerComplianceData = useMemo(() => {
    if (!culturalMetrics) return []

    return [
      {
        name: locale === 'ar' ? 'الفجر' : 'Fajr',
        compliance: culturalMetrics.prayerTimeCompliance.fajr,
        fill: '#8b5cf6'
      },
      {
        name: locale === 'ar' ? 'الظهر' : 'Dhuhr',
        compliance: culturalMetrics.prayerTimeCompliance.dhuhr,
        fill: '#3b82f6'
      },
      {
        name: locale === 'ar' ? 'العصر' : 'Asr',
        compliance: culturalMetrics.prayerTimeCompliance.asr,
        fill: '#10b981'
      },
      {
        name: locale === 'ar' ? 'المغرب' : 'Maghrib',
        compliance: culturalMetrics.prayerTimeCompliance.maghrib,
        fill: '#f59e0b'
      },
      {
        name: locale === 'ar' ? 'العشاء' : 'Isha',
        compliance: culturalMetrics.prayerTimeCompliance.isha,
        fill: '#ef4444'
      }
    ]
  }, [culturalMetrics, locale])

  // Emirate performance data
  const emirateData = useMemo(() => {
    if (!culturalMetrics) return []

    return Object.entries(culturalMetrics.emirateSpecific).map(([emirate, data]) => ({
      name: emirate.charAt(0).toUpperCase() + emirate.slice(1).replace(/([A-Z])/g, ' $1'),
      effectiveness: data.effectiveness,
      volume: data.volume,
      fill: emirateColors[emirate as keyof typeof emirateColors] || '#6b7280'
    }))
  }, [culturalMetrics])

  // Custom tooltip
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
            <span>
              {item.name}: {typeof item.value === 'number' ? formatPercentage(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // Render cultural compliance gauge
  const renderComplianceGauge = () => (
    <div className="h-64 flex items-center justify-center">
      <div className="relative">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              startAngle={180}
              endAngle={0}
              data={[{ score: overallComplianceScore }]}
            >
              <RadialBar
                dataKey="score"
                cornerRadius={10}
                fill={
                  overallComplianceScore >= 90 ? '#10b981' :
                  overallComplianceScore >= 70 ? '#f59e0b' : '#ef4444'
                }
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold">
            {formatPercentage(overallComplianceScore)}
          </div>
          <div className="text-sm text-muted-foreground text-center">
            {locale === 'ar' ? 'نقاط الامتثال الثقافي' : 'Cultural Compliance Score'}
          </div>
        </div>
      </div>
    </div>
  )

  // Render prayer times analysis
  const renderPrayerTimesAnalysis = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-4 w-4" />
            {locale === 'ar' ? 'تحليل أوقات الصلاة' : 'Prayer Times Analysis'}
          </CardTitle>
          <CardDescription>
            {locale === 'ar'
              ? 'مدى احترام نظام التذكيرات لأوقات الصلاة'
              : 'How well the reminder system respects prayer times'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prayerComplianceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="compliance" radius={[4, 4, 0, 0]}>
                  {prayerComplianceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {culturalMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {locale === 'ar' ? 'تأثير أوقات الصلاة على الاستجابة' : 'Prayer Time Impact on Responses'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(culturalMetrics.prayerTimeCompliance.impactOnResponses)}
                  </div>
                  <div className="text-sm text-green-700">
                    {locale === 'ar' ? 'تحسن في معدل الاستجابة' : 'Response Rate Improvement'}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  {locale === 'ar'
                    ? 'عندما يتم تجنب إرسال التذكيرات خلال أوقات الصلاة'
                    : 'When reminders avoid prayer times'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {locale === 'ar' ? 'أوقات الصلاة الأكثر تأثيراً' : 'Most Impactful Prayer Times'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {prayerComplianceData
                  .sort((a, b) => b.compliance - a.compliance)
                  .slice(0, 3)
                  .map((prayer, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <span className="font-medium">{prayer.name}</span>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={prayer.compliance}
                          className="w-16 h-2"
                        />
                        <span className="text-sm font-medium">
                          {formatPercentage(prayer.compliance)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )

  // Render Ramadan compliance
  const renderRamadanCompliance = () => (
    <div className="space-y-6">
      {culturalMetrics && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-gold-600" />
                {locale === 'ar' ? 'امتثال شهر رمضان المبارك' : 'Ramadan Compliance'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">
                    {formatPercentage(culturalMetrics.ramadanCompliance.schedulingAdjustment)}
                  </div>
                  <div className="text-xs text-purple-700">
                    {locale === 'ar' ? 'تعديل الجدولة' : 'Scheduling Adj.'}
                  </div>
                </div>

                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">
                    {formatPercentage(culturalMetrics.ramadanCompliance.contentAdaptation)}
                  </div>
                  <div className="text-xs text-blue-700">
                    {locale === 'ar' ? 'تكييف المحتوى' : 'Content Adapt.'}
                  </div>
                </div>

                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-xl font-bold text-green-600">
                    {formatPercentage(culturalMetrics.ramadanCompliance.workingHoursRespect)}
                  </div>
                  <div className="text-xs text-green-700">
                    {locale === 'ar' ? 'احترام ساعات العمل' : 'Working Hours'}
                  </div>
                </div>

                <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="text-xl font-bold text-orange-600">
                    {formatPercentage(culturalMetrics.ramadanCompliance.fastingConsideration)}
                  </div>
                  <div className="text-xs text-orange-700">
                    {locale === 'ar' ? 'مراعاة الصيام' : 'Fasting Consider.'}
                  </div>
                </div>
              </div>

              <Alert className="border-gold-200 bg-gradient-to-r from-yellow-50 to-orange-50">
                <Star className="h-4 w-4" />
                <AlertDescription>
                  {locale === 'ar'
                    ? 'نظام التذكيرات يحترم تلقائياً شهر رمضان المبارك ويعدل الجداول والمحتوى وفقاً للقيم الإسلامية'
                    : 'The reminder system automatically respects Ramadan and adjusts schedules and content according to Islamic values'
                  }
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )

  // Render emirates breakdown
  const renderEmiratesBreakdown = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {locale === 'ar' ? 'الأداء حسب الإمارة' : 'Performance by Emirate'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={emirateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                <Bar
                  yAxisId="left"
                  dataKey="effectiveness"
                  name={locale === 'ar' ? 'الفعالية' : 'Effectiveness'}
                  radius={[4, 4, 0, 0]}
                >
                  {emirateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="volume"
                  stroke="#ef4444"
                  strokeWidth={3}
                  name={locale === 'ar' ? 'الحجم' : 'Volume'}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {emirateData.slice(0, 4).map((emirate, index) => (
          <Card key={index} className="border-l-4" style={{ borderLeftColor: emirate.fill }}>
            <CardContent className="p-4">
              <h4 className="font-medium text-sm mb-2">{emirate.name}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{locale === 'ar' ? 'الفعالية:' : 'Effectiveness:'}</span>
                  <span className="font-medium">{formatPercentage(emirate.effectiveness)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>{locale === 'ar' ? 'الحجم:' : 'Volume:'}</span>
                  <span className="font-medium">{emirate.volume}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // Render insights and recommendations
  const renderRecommendations = () => (
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <Card
          key={index}
          className={cn(
            "border-l-4",
            insight.type === 'success' && "border-l-green-500 bg-green-50 dark:bg-green-950",
            insight.type === 'warning' && "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950",
            insight.type === 'improvement' && "border-l-blue-500 bg-blue-50 dark:bg-blue-950",
            insight.type === 'celebration' && "border-l-purple-500 bg-purple-50 dark:bg-purple-950"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {insight.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                  {insight.type === 'improvement' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                  {insight.type === 'celebration' && <Award className="h-4 w-4 text-purple-600" />}

                  <h4 className="font-medium">{insight.title}</h4>

                  <Badge variant="outline" className="text-xs">
                    {insight.category}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground mb-2">
                  {insight.description}
                </p>

                <p className="text-sm font-medium">
                  {locale === 'ar' ? 'التوصية: ' : 'Recommendation: '}
                  {insight.recommendation}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {insight.impact} {locale === 'ar' ? 'تأثير' : 'impact'}
                </Badge>

                <Badge
                  variant={insight.urgency === 'immediate' ? 'destructive' : insight.urgency === 'soon' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {insight.urgency}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {insights.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {locale === 'ar'
                ? 'ممتاز! نظامك متوافق بالكامل مع الثقافة الإماراتية'
                : 'Excellent! Your system is fully compliant with UAE culture'
              }
            </p>
          </CardContent>
        </Card>
      )}
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
              {locale === 'ar'
                ? `خطأ في تحميل بيانات الذكاء التجاري الإماراتي: ${error}`
                : `Error loading UAE business intelligence data: ${error}`
              }
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl", className)}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-emerald-600" />
                {locale === 'ar' ? 'الذكاء التجاري الإماراتي' : 'UAE Business Intelligence'}
              </CardTitle>
              <CardDescription className="mt-1">
                {locale === 'ar'
                  ? 'تحليل شامل للامتثال الثقافي والفعالية في دولة الإمارات'
                  : 'Comprehensive cultural compliance and effectiveness analysis for UAE market'
                }
              </CardDescription>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {formatPercentage(overallComplianceScore)}
                </div>
                <div className="text-xs text-emerald-700">
                  {locale === 'ar' ? 'نقاط الامتثال الإجمالية' : 'Overall Compliance'}
                </div>
              </div>

              <Badge
                variant={overallComplianceScore >= 90 ? 'default' : 'outline'}
                className="text-sm px-3 py-1"
              >
                {overallComplianceScore >= 90
                  ? (locale === 'ar' ? '🏆 متميز' : '🏆 Excellent')
                  : overallComplianceScore >= 70
                  ? (locale === 'ar' ? '✅ جيد' : '✅ Good')
                  : (locale === 'ar' ? '⚠️ يحتاج تحسين' : '⚠️ Needs Improvement')
                }
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            {locale === 'ar' ? 'نظرة عامة' : 'Overview'}
          </TabsTrigger>
          <TabsTrigger value="prayer-times">
            {locale === 'ar' ? 'أوقات الصلاة' : 'Prayer Times'}
          </TabsTrigger>
          <TabsTrigger value="ramadan">
            {locale === 'ar' ? 'رمضان' : 'Ramadan'}
          </TabsTrigger>
          <TabsTrigger value="emirates">
            {locale === 'ar' ? 'الإمارات' : 'Emirates'}
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            {locale === 'ar' ? 'التوصيات' : 'Recommendations'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {locale === 'ar' ? 'مؤشر الامتثال الثقافي' : 'Cultural Compliance Gauge'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderComplianceGauge()}
              </CardContent>
            </Card>

            {culturalMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {locale === 'ar' ? 'تفصيل النقاط' : 'Score Breakdown'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        {locale === 'ar' ? 'أوقات الصلاة' : 'Prayer Times'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={culturalMetrics.prayerTimeCompliance.score} className="w-16 h-2" />
                        <span className="font-medium text-sm">
                          {formatPercentage(culturalMetrics.prayerTimeCompliance.score)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        {locale === 'ar' ? 'رمضان' : 'Ramadan'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={culturalMetrics.ramadanCompliance.overallScore} className="w-16 h-2" />
                        <span className="font-medium text-sm">
                          {formatPercentage(culturalMetrics.ramadanCompliance.overallScore)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        {locale === 'ar' ? 'اللغة' : 'Language'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={culturalMetrics.languageUsage.bilingualEffectiveness} className="w-16 h-2" />
                        <span className="font-medium text-sm">
                          {formatPercentage(culturalMetrics.languageUsage.bilingualEffectiveness)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {locale === 'ar' ? 'آداب العمل' : 'Business Etiquette'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={culturalMetrics.businessEtiquette.respectfulCommunication} className="w-16 h-2" />
                        <span className="font-medium text-sm">
                          {formatPercentage(culturalMetrics.businessEtiquette.respectfulCommunication)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {locale === 'ar' ? 'التقويم الإسلامي' : 'Islamic Calendar'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Progress value={culturalMetrics.calendarCompliance.islamicHolidays} className="w-16 h-2" />
                        <span className="font-medium text-sm">
                          {formatPercentage(culturalMetrics.calendarCompliance.islamicHolidays)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="prayer-times">
          {renderPrayerTimesAnalysis()}
        </TabsContent>

        <TabsContent value="ramadan">
          {renderRamadanCompliance()}
        </TabsContent>

        <TabsContent value="emirates">
          {renderEmiratesBreakdown()}
        </TabsContent>

        <TabsContent value="recommendations">
          {renderRecommendations()}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default UAEBusinessIntelligence
export { UAEBusinessIntelligence }