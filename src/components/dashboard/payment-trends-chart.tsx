"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface PaymentTrendsChartProps {
  data?: {
    date: string
    collected: number
    outstanding: number
  }[]
  currency?: string
}

export function PaymentTrendsChart({ data = [], currency = 'AED' }: PaymentTrendsChartProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Use real data only - no sample/dummy data
  const chartData = data

  // Handle empty state
  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Payment Trends (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No payment data yet</p>
            <p className="text-sm mt-1">Payment trends will appear here as invoices are paid</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxValue = Math.max(...chartData.map(d => Math.max(d.collected, d.outstanding)))
  const totalCollected = chartData.reduce((sum, d) => sum + d.collected, 0)
  const totalOutstanding = chartData.reduce((sum, d) => sum + d.outstanding, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Payment Trends (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700 font-medium">Collected</p>
            <p className="text-xl font-bold text-green-800">{currency} {formatCurrency(totalCollected)}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-sm text-amber-700 font-medium">Still Outstanding</p>
            <p className="text-xl font-bold text-amber-800">{currency} {formatCurrency(totalOutstanding)}</p>
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="space-y-3">
          {chartData.slice(-7).map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{item.date}</span>
                <span>{currency} {formatCurrency(item.collected)}</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(item.collected / maxValue) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${(item.outstanding / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-600">Collected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-400" />
            <span className="text-gray-600">Outstanding</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

