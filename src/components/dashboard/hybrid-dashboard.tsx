"use client"

import { useState, useEffect } from 'react'
import { HeroMetrics } from './hero-metrics'
import { PaymentTrendsChart } from './payment-trends-chart'
import { RecentActivity } from './recent-activity'
import { InvoiceBucketDashboard } from '../invoices/invoice-bucket-dashboard'
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import { ProfessionalLoading } from '@/components/ui/professional-loading'

interface HybridDashboardProps {
  companyId: string
  locale?: string
}

interface DashboardMetrics {
  totalOutstanding: number
  overdueAmount: number
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
}

export function HybridDashboard({ companyId, locale = 'en' }: HybridDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalOutstanding: 0,
    overdueAmount: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  const { invoices, fetchInvoices } = useInvoiceStore()

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true)
      try {
        await fetchInvoices()
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [companyId, fetchInvoices])

  // Calculate metrics whenever invoices change
  useEffect(() => {
    if (invoices.length > 0) {
      calculateMetrics()
    }
  }, [invoices])

  const calculateMetrics = () => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

    // Total outstanding (all unpaid invoices)
    const totalOutstanding = invoices
      .filter(inv => ['PENDING', 'SENT', 'OVERDUE'].includes(inv.status))
      .reduce((sum, inv) => sum + Number(inv.total_amount || inv.totalAmount || 0), 0)

    // Overdue amount
    const overdueAmount = invoices
      .filter(inv => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + Number(inv.total_amount || inv.totalAmount || 0), 0)

    // Calculate trend based on collections
    const thisMonthCollections = invoices
      .filter(inv => {
        const paidDate = inv.paidDate ? new Date(inv.paidDate) : null
        return paidDate &&
               paidDate.getMonth() === thisMonth &&
               paidDate.getFullYear() === thisYear
      })
      .reduce((sum, inv) => sum + Number(inv.total_amount || inv.totalAmount || 0), 0)

    const lastMonthCollections = invoices
      .filter(inv => {
        const paidDate = inv.paidDate ? new Date(inv.paidDate) : null
        return paidDate &&
               paidDate.getMonth() === lastMonth &&
               paidDate.getFullYear() === lastMonthYear
      })
      .reduce((sum, inv) => sum + Number(inv.total_amount || inv.totalAmount || 0), 0)

    const trendValue = lastMonthCollections > 0
      ? Math.abs(((thisMonthCollections - lastMonthCollections) / lastMonthCollections) * 100)
      : 0

    const trendDirection = thisMonthCollections >= lastMonthCollections ? 'up' : 'down'

    setMetrics({
      totalOutstanding,
      overdueAmount,
      trend: {
        value: Math.round(trendValue),
        direction: trendDirection
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ProfessionalLoading
          variant="branded"
          size="lg"
          message="Loading your dashboard..."
          showBrand
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero Metrics - Large numbers at the top */}
      <HeroMetrics
        outstanding={metrics.totalOutstanding}
        overdue={metrics.overdueAmount}
        trend={metrics.trend}
        currency="AED"
      />

      {/* Secondary Row: Trends + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentTrendsChart currency="AED" />
        <RecentActivity maxItems={5} />
      </div>

      {/* Invoice Buckets - Primary view */}
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Invoice Buckets</h2>
          <p className="text-muted-foreground">
            Manage and send reminders for invoices grouped by due date
          </p>
        </div>
        <InvoiceBucketDashboard />
      </div>
    </div>
  )
}
