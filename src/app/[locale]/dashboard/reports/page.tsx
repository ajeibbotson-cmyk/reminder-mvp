'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, TrendingUp, TrendingDown, Users, FileText, DollarSign, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface AgingBucket {
  id: string
  label: string
  count: number
  totalAmount: number
}

interface AgingSummary {
  totalInvoices: number
  totalOutstanding: number
  totalOverdue: number
  averageDaysOverdue: number
}

interface PaymentSummary {
  totalPayments: number
  totalAmount: number
  byMethod: Record<string, number>
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [agingData, setAgingData] = useState<{ buckets: AgingBucket[], summary: AgingSummary } | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentSummary | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [agingResponse, paymentResponse] = await Promise.all([
        fetch('/api/reports/aging'),
        fetch('/api/payments?includeInvoiceDetails=true&limit=1000')
      ])

      if (agingResponse.ok) {
        const data = await agingResponse.json()
        setAgingData(data)
      }

      if (paymentResponse.ok) {
        const data = await paymentResponse.json()
        setPaymentData({
          totalPayments: data.statistics?.paymentCount || 0,
          totalAmount: Number(data.statistics?.totalAmount || 0),
          byMethod: (data.statistics?.methodBreakdown || []).reduce((acc: Record<string, number>, m: any) => {
            acc[m.method] = Number(m.totalAmount || 0)
            return acc
          }, {})
        })
      }
    } catch (error) {
      console.error('Error loading report data:', error)
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleExport = async (reportType: 'aging' | 'payments') => {
    setExporting(reportType)
    try {
      const url = reportType === 'aging'
        ? '/api/reports/aging?format=csv'
        : '/api/payments?format=csv'

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success(`${reportType === 'aging' ? 'Aging' : 'Payment'} report exported`)
    } catch (error) {
      toast.error(`Failed to export ${reportType} report`)
    } finally {
      setExporting(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-gray-600">Financial insights and performance metrics</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded w-24 mb-2" />
                <div className="h-4 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-600">Financial insights and performance metrics for your UAE business</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => handleExport('aging')}
                disabled={exporting === 'aging'}
              >
                {exporting === 'aging' ? 'Exporting...' : 'Aging Report (CSV)'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport('payments')}
                disabled={exporting === 'payments'}
              >
                {exporting === 'payments' ? 'Exporting...' : 'Payment History (CSV)'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(agingData?.summary?.totalOutstanding || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {agingData?.summary?.totalInvoices || 0} invoices
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(agingData?.summary?.totalOverdue || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg {agingData?.summary?.averageDaysOverdue || 0} days overdue
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments Received</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(paymentData?.totalAmount || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {paymentData?.totalPayments || 0} payments
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agingData?.summary?.totalOutstanding && paymentData?.totalAmount
                ? Math.round((paymentData.totalAmount / (paymentData.totalAmount + agingData.summary.totalOutstanding)) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted-foreground">
              of total invoiced
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="aging" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="aging" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Aging Analysis</h2>
              <p className="text-sm text-muted-foreground">Outstanding invoices by age</p>
            </div>
            <Button variant="outline" onClick={() => handleExport('aging')} disabled={exporting === 'aging'}>
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'aging' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {(agingData?.buckets || []).map(bucket => (
              <Card key={bucket.id} className={bucket.id === '90+' && bucket.count > 0 ? 'border-red-300' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{bucket.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{bucket.count}</div>
                  <div className={`text-sm font-medium ${bucket.id === '90+' ? 'text-red-600' : ''}`}>
                    {formatCurrency(bucket.totalAmount)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Aging Summary</CardTitle>
              <CardDescription>Overview of outstanding amounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(agingData?.buckets || []).map(bucket => {
                  const percentage = agingData?.summary?.totalOutstanding
                    ? (bucket.totalAmount / agingData.summary.totalOutstanding) * 100
                    : 0
                  return (
                    <div key={bucket.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{bucket.label}</span>
                        <span className="font-medium">{formatCurrency(bucket.totalAmount)} ({Math.round(percentage)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            bucket.id === 'current' ? 'bg-green-500' :
                            bucket.id === '1-30' ? 'bg-yellow-500' :
                            bucket.id === '31-60' ? 'bg-orange-500' :
                            bucket.id === '61-90' ? 'bg-red-400' :
                            'bg-red-600'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Payment History</h2>
              <p className="text-sm text-muted-foreground">All recorded payments</p>
            </div>
            <Button variant="outline" onClick={() => handleExport('payments')} disabled={exporting === 'payments'}>
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'payments' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Breakdown by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(paymentData?.byMethod || {}).map(([method, amount]) => (
                  <div key={method} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{method.replace('_', ' ')}</Badge>
                    </div>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
                {Object.keys(paymentData?.byMethod || {}).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments recorded yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
              <CardDescription>Total payments received</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {paymentData?.totalPayments || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Payments</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(paymentData?.totalAmount || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Collected</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
