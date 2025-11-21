'use client'

import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import { InvoiceWithDetails } from '@/types/invoice'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AEDAmount } from '@/components/ui/uae-formatters'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Receipt,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InvoiceStatsProps {
  invoices: InvoiceWithDetails[]
  loading?: boolean
  className?: string
}

interface StatCard {
  title: string
  titleAr: string
  value: string | number
  formattedValue?: string
  change?: number
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ReactNode
  color: string
  bgColor: string
  description: string
  descriptionAr: string
}

export function InvoiceStats({ invoices, loading = false, className }: InvoiceStatsProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'

  const stats = useMemo(() => {
    if (!invoices.length) {
      return {
        totalCount: 0,
        totalAmount: 0,
        paidCount: 0,
        paidAmount: 0,
        overdueCount: 0,
        overdueAmount: 0,
        draftCount: 0,
        sentCount: 0,
        averagePaymentTime: 0,
        paymentRate: 0
      }
    }

    const totalCount = invoices.length
    const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    
    const paidInvoices = invoices.filter(invoice => invoice.status === 'PAID')
    const paidCount = paidInvoices.length
    const paidAmount = paidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    
    const overdueInvoices = invoices.filter(invoice => {
      if (invoice.status === 'OVERDUE') return true
      if (invoice.status === 'SENT' && new Date(invoice.dueDate) < new Date()) return true
      return false
    })
    const overdueCount = overdueInvoices.length
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    
    const draftCount = invoices.filter(invoice => invoice.status === 'DRAFT').length
    const sentCount = invoices.filter(invoice => invoice.status === 'SENT').length
    
    // Calculate average payment time (simplified - would need payment data)
    const averagePaymentTime = paidInvoices.length > 0 ?
      paidInvoices.reduce((sum, invoice) => {
        const dueDate = new Date(invoice.dueDate)
        const createdDate = new Date(invoice.createdAt)
        const daysDiff = Math.floor((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
        return sum + Math.max(0, daysDiff)
      }, 0) / paidInvoices.length : 0

    const paymentRate = totalCount > 0 ? (paidCount / totalCount) * 100 : 0

    return {
      totalCount,
      totalAmount,
      paidCount,
      paidAmount,
      overdueCount,
      overdueAmount,
      draftCount,
      sentCount,
      averagePaymentTime,
      paymentRate
    }
  }, [invoices])

  const statCards: StatCard[] = useMemo(() => [
    {
      title: 'Total',
      titleAr: 'الإجمالي',
      value: stats.totalCount,
      formattedValue: stats.totalAmount.toLocaleString('en-AE', {
        style: 'currency',
        currency: 'AED',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
      icon: <Receipt className="h-5 w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: `${stats.totalAmount.toLocaleString('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 })} total value`,
      descriptionAr: `${stats.totalAmount.toLocaleString('ar-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 })} القيمة الإجمالية`
    },
    {
      title: 'Paid',
      titleAr: 'مدفوع',
      value: stats.paidCount,
      formattedValue: stats.paidAmount.toLocaleString('en-AE', {
        style: 'currency',
        currency: 'AED',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
      change: stats.paymentRate,
      changeType: stats.paymentRate >= 80 ? 'positive' : stats.paymentRate >= 60 ? 'neutral' : 'negative',
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: `${stats.paymentRate.toFixed(1)}% payment rate`,
      descriptionAr: `${stats.paymentRate.toFixed(1)}% معدل الدفع`
    },
    {
      title: 'Overdue',
      titleAr: 'متأخر',
      value: stats.overdueCount,
      formattedValue: stats.overdueAmount.toLocaleString('en-AE', {
        style: 'currency',
        currency: 'AED',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
      change: stats.totalCount > 0 ? (stats.overdueCount / stats.totalCount) * 100 : 0,
      changeType: 'negative',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Requires immediate attention',
      descriptionAr: 'تتطلب اهتماماً فورياً'
    },
    {
      title: 'Avg Days',
      titleAr: 'متوسط الأيام',
      value: Math.round(stats.averagePaymentTime),
      formattedValue: `${Math.round(stats.averagePaymentTime)} days`,
      change: stats.averagePaymentTime <= 30 ? 15 : stats.averagePaymentTime <= 45 ? 0 : -10,
      changeType: stats.averagePaymentTime <= 30 ? 'positive' : stats.averagePaymentTime <= 45 ? 'neutral' : 'negative',
      icon: <Clock className="h-5 w-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Time from invoice to payment',
      descriptionAr: 'الوقت من الفاتورة إلى الدفع'
    },
    {
      title: 'Draft',
      titleAr: 'مسودة',
      value: stats.draftCount,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      description: 'Pending completion',
      descriptionAr: 'في انتظار الإكمال'
    },
    {
      title: 'Rate',
      titleAr: 'المعدل',
      value: `${stats.paymentRate.toFixed(1)}%`,
      change: stats.paymentRate >= 80 ? 5 : stats.paymentRate >= 60 ? 0 : -5,
      changeType: stats.paymentRate >= 80 ? 'positive' : stats.paymentRate >= 60 ? 'neutral' : 'negative',
      icon: <Target className="h-5 w-5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: `${stats.paidCount} of ${stats.totalCount} paid`,
      descriptionAr: `${stats.paidCount} من ${stats.totalCount} مدفوع`
    }
  ], [stats])

  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4', className)}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4', className)}>
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow duration-200 h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className={cn(
              "text-sm font-medium text-muted-foreground truncate",
              isRTL ? 'text-right' : 'text-left'
            )}>
              {locale === 'ar' ? stat.titleAr : stat.title}
            </CardTitle>
            <div className={cn('p-2 rounded-lg flex-shrink-0', stat.bgColor)}>
              <div className={stat.color}>
                {stat.icon}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className={cn('flex items-center justify-between', isRTL ? 'flex-row-reverse' : '')}>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-bold truncate">
                  {typeof stat.value === 'number' && stat.value > 999999
                    ? `${(stat.value / 1000000).toFixed(1)}M`
                    : typeof stat.value === 'number' && stat.value > 999
                    ? `${(stat.value / 1000).toFixed(1)}K`
                    : stat.value
                  }
                </div>
                {stat.formattedValue && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {stat.formattedValue}
                  </p>
                )}
              </div>

              {stat.change !== undefined && (
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {stat.changeType === 'positive' ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : stat.changeType === 'negative' ? (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  ) : null}
                  {stat.change !== 0 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        stat.changeType === 'positive'
                          ? 'text-green-700 border-green-200 bg-green-50'
                          : stat.changeType === 'negative'
                          ? 'text-red-700 border-red-200 bg-red-50'
                          : 'text-gray-700 border-gray-200 bg-gray-50'
                      )}
                    >
                      {stat.changeType === 'positive' ? '+' : ''}{stat.change.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <p className={cn(
              'text-xs text-muted-foreground mt-2 line-clamp-2',
              isRTL ? 'text-right' : 'text-left'
            )}>
              {locale === 'ar' ? stat.descriptionAr : stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}