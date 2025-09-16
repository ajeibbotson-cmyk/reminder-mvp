'use client'

import React, { useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Globe2,
  Mail,
  MessageSquare,
  CreditCard,
  Award,
  Activity,
  BarChart3,
  Zap,
  Shield,
  Heart,
  Star
} from 'lucide-react'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface KPICardsProps {
  data: any
  locale: 'en' | 'ar'
  isLoading: boolean
  className?: string
}

interface KPICard {
  id: string
  title: string
  titleAr: string
  value: number
  previousValue?: number
  format: 'currency' | 'percentage' | 'number' | 'days' | 'rate'
  icon: React.ComponentType<any>
  color: string
  bgColor: string
  target?: number
  trend?: Array<{ date: string; value: number }>
  description?: string
  descriptionAr?: string
  status?: 'excellent' | 'good' | 'warning' | 'critical'
  priority?: 'high' | 'medium' | 'low'
  uaeContext?: {
    culturalRelevance: boolean
    businessHoursImpact?: number
    prayerTimeAware?: boolean
    ramadanAdjusted?: boolean
  }
}

const KPICards: React.FC<KPICardsProps> = ({
  data,
  locale,
  isLoading,
  className
}) => {
  const isRTL = locale === 'ar'

  // Define KPI cards configuration
  const kpiCards: KPICard[] = useMemo(() => {
    if (!data || !data.kpis) return []

    return [
      {
        id: 'payment-delay-reduction',
        title: 'Payment Delay Reduction',
        titleAr: 'تقليل تأخير المدفوعات',
        value: data.kpis.paymentDelayReduction || 0,
        previousValue: data.kpis.paymentDelayReduction - 2.1,
        format: 'percentage',
        icon: Target,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        target: data.kpis.targetReduction || 25,
        trend: data.trends?.paymentReduction?.slice(-7) || [],
        description: 'Progress toward 25% reduction goal',
        descriptionAr: 'التقدم نحو هدف تقليل 25%',
        status: data.kpis.paymentDelayReduction >= 20 ? 'excellent' : data.kpis.paymentDelayReduction >= 15 ? 'good' : 'warning',
        priority: 'high',
        uaeContext: {
          culturalRelevance: true,
          businessHoursImpact: 85,
          prayerTimeAware: true,
          ramadanAdjusted: true
        }
      },
      {
        id: 'total-revenue',
        title: 'Total Revenue Collected',
        titleAr: 'إجمالي الإيرادات المحصلة',
        value: data.kpis.totalRevenue || 0,
        previousValue: data.kpis.totalRevenue * 0.92,
        format: 'currency',
        icon: DollarSign,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        trend: data.trends?.revenueGrowth?.slice(-7) || [],
        description: 'Revenue collected through automated reminders',
        descriptionAr: 'الإيرادات المحصلة من خلال التذكيرات التلقائية',
        status: 'good',
        priority: 'high'
      },
      {
        id: 'active-invoices',
        title: 'Active Invoices',
        titleAr: 'الفواتير النشطة',
        value: data.kpis.activeInvoices || 0,
        previousValue: data.kpis.activeInvoices + 12,
        format: 'number',
        icon: CreditCard,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        description: 'Invoices currently being processed',
        descriptionAr: 'الفواتير قيد المعالجة حالياً',
        status: 'good',
        priority: 'medium'
      },
      {
        id: 'customer-satisfaction',
        title: 'Customer Satisfaction',
        titleAr: 'رضا العملاء',
        value: data.kpis.customerSatisfaction || 0,
        previousValue: data.kpis.customerSatisfaction - 3.2,
        format: 'percentage',
        icon: Heart,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        description: 'Customer satisfaction with reminder process',
        descriptionAr: 'رضا العملاء عن عملية التذكير',
        status: data.kpis.customerSatisfaction >= 90 ? 'excellent' : data.kpis.customerSatisfaction >= 80 ? 'good' : 'warning',
        priority: 'high',
        uaeContext: {
          culturalRelevance: true,
          businessHoursImpact: 92,
          prayerTimeAware: true
        }
      },
      {
        id: 'culture-compliance',
        title: 'UAE Culture Compliance',
        titleAr: 'الامتثال الثقافي الإماراتي',
        value: data.kpis.cultureCompliance || 0,
        previousValue: data.kpis.cultureCompliance - 1.5,
        format: 'percentage',
        icon: Globe2,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        description: 'Cultural appropriateness score',
        descriptionAr: 'نقاط الملاءمة الثقافية',
        status: data.kpis.cultureCompliance >= 95 ? 'excellent' : data.kpis.cultureCompliance >= 85 ? 'good' : 'warning',
        priority: 'high',
        uaeContext: {
          culturalRelevance: true,
          businessHoursImpact: 98,
          prayerTimeAware: true,
          ramadanAdjusted: true
        }
      },
      {
        id: 'avg-payment-time',
        title: 'Avg Payment Time',
        titleAr: 'متوسط وقت الدفع',
        value: data.kpis.avgPaymentTime || 0,
        previousValue: data.kpis.avgPaymentTime + 2.8,
        format: 'days',
        icon: Clock,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        description: 'Average days to payment',
        descriptionAr: 'متوسط الأيام حتى الدفع',
        status: data.kpis.avgPaymentTime <= 15 ? 'excellent' : data.kpis.avgPaymentTime <= 25 ? 'good' : 'warning',
        priority: 'medium',
        uaeContext: {
          culturalRelevance: true,
          businessHoursImpact: 76
        }
      },
      {
        id: 'collection-efficiency',
        title: 'Collection Efficiency',
        titleAr: 'كفاءة التحصيل',
        value: data.kpis.collectionEfficiency || 0,
        previousValue: data.kpis.collectionEfficiency - 4.2,
        format: 'percentage',
        icon: Award,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        description: 'Overall collection effectiveness',
        descriptionAr: 'الفعالية الإجمالية للتحصيل',
        status: data.kpis.collectionEfficiency >= 85 ? 'excellent' : data.kpis.collectionEfficiency >= 75 ? 'good' : 'warning',
        priority: 'medium'
      },
      {
        id: 'response-rate',
        title: 'Email Response Rate',
        titleAr: 'معدل الاستجابة للبريد الإلكتروني',
        value: data.kpis.emailResponseRate || 31.2,
        previousValue: 26.8,
        format: 'percentage',
        icon: Mail,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        description: 'Customer response to email reminders',
        descriptionAr: 'استجابة العملاء لتذكيرات البريد الإلكتروني',
        status: data.kpis.emailResponseRate >= 35 ? 'excellent' : data.kpis.emailResponseRate >= 25 ? 'good' : 'warning',
        priority: 'medium'
      }
    ]
  }, [data])

  // Format values based on type
  const formatValue = (value: number, format: string, locale: string) => {
    switch (format) {
      case 'currency':
        return formatAEDCurrency(value)
      case 'percentage':
        return formatPercentage(value)
      case 'days':
        return `${value.toFixed(1)} ${locale === 'ar' ? 'أيام' : 'days'}`
      case 'rate':
        return `${value.toFixed(1)}%`
      default:
        return value.toLocaleString(locale === 'ar' ? 'ar-AE' : 'en-AE')
    }
  }

  // Calculate trend direction
  const getTrendDirection = (current: number, previous: number) => {
    if (current > previous) return 'up'
    if (current < previous) return 'down'
    return 'neutral'
  }

  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'good':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // Render mini trend chart
  const renderMiniChart = (trend: Array<{ date: string; value: number }>) => {
    if (!trend || trend.length < 2) return null

    return (
      <div className="w-16 h-8">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend}>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", isRTL && "rtl", className)}>
      {kpiCards.map((kpi) => {
        const trend = kpi.previousValue ? getTrendDirection(kpi.value, kpi.previousValue) : 'neutral'
        const trendValue = kpi.previousValue ? Math.abs(kpi.value - kpi.previousValue) : 0
        const trendPercentage = kpi.previousValue ? ((trendValue / kpi.previousValue) * 100) : 0

        return (
          <Card
            key={kpi.id}
            className={cn(
              "relative overflow-hidden transition-all duration-200 hover:shadow-lg",
              getStatusColor(kpi.status),
              kpi.priority === 'high' && "ring-1 ring-blue-200"
            )}
          >
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {locale === 'ar' ? kpi.titleAr : kpi.title}
                    </h3>
                  </div>

                  {/* Priority indicator */}
                  {kpi.priority === 'high' && (
                    <Badge variant="outline" className="text-xs mb-2">
                      {locale === 'ar' ? 'أولوية عالية' : 'High Priority'}
                    </Badge>
                  )}
                </div>

                {/* Mini trend chart */}
                {kpi.trend && renderMiniChart(kpi.trend)}
              </div>

              {/* Main Value */}
              <div className="mb-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatValue(kpi.value, kpi.format, locale)}
                </div>

                {/* Target progress for specific KPIs */}
                {kpi.target && kpi.id === 'payment-delay-reduction' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{locale === 'ar' ? 'التقدم:' : 'Progress:'}</span>
                      <span>{formatPercentage((kpi.value / kpi.target) * 100)}</span>
                    </div>
                    <Progress
                      value={Math.min((kpi.value / kpi.target) * 100, 100)}
                      className="h-1.5"
                    />
                  </div>
                )}
              </div>

              {/* Trend Indicator */}
              {kpi.previousValue && (
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "flex items-center text-xs",
                    trend === 'up' ? (kpi.format === 'days' ? "text-green-600" : "text-green-600") :
                    trend === 'down' ? (kpi.format === 'days' ? "text-green-600" : "text-red-600") :
                    "text-gray-600"
                  )}>
                    {trend === 'up' && (kpi.format === 'days' ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />)}
                    {trend === 'down' && (kpi.format === 'days' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />)}

                    <span>
                      {formatPercentage(trendPercentage)} {locale === 'ar' ? 'من الفترة السابقة' : 'from last period'}
                    </span>
                  </div>

                  {/* Status indicator */}
                  {kpi.status && (
                    <div className="flex items-center gap-1">
                      {kpi.status === 'excellent' && <CheckCircle className="h-3 w-3 text-green-600" />}
                      {kpi.status === 'good' && <CheckCircle className="h-3 w-3 text-blue-600" />}
                      {kpi.status === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-600" />}
                      {kpi.status === 'critical' && <AlertTriangle className="h-3 w-3 text-red-600" />}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                {locale === 'ar' ? kpi.descriptionAr : kpi.description}
              </p>

              {/* UAE Context Indicators */}
              {kpi.uaeContext && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    {kpi.uaeContext.prayerTimeAware && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        🕌 {locale === 'ar' ? 'متوافق مع أوقات الصلاة' : 'Prayer-aware'}
                      </Badge>
                    )}
                    {kpi.uaeContext.ramadanAdjusted && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        🌙 {locale === 'ar' ? 'رمضان' : 'Ramadan'}
                      </Badge>
                    )}
                  </div>

                  {kpi.uaeContext.businessHoursImpact && (
                    <div className="text-xs text-gray-600">
                      {formatPercentage(kpi.uaeContext.businessHoursImpact)} {locale === 'ar' ? 'تأثير ساعات العمل' : 'business hours impact'}
                    </div>
                  )}
                </div>
              )}

              {/* Priority stripe */}
              {kpi.priority === 'high' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600" />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default KPICards
export { KPICards }