"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeroMetricsProps {
  outstanding: number
  overdue: number
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  currency?: string
}

export function HeroMetrics({
  outstanding,
  overdue,
  trend,
  currency = 'AED'
}: HeroMetricsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Total Outstanding */}
      <Card className="border-2 hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Total Outstanding
          </div>
          <div className="text-5xl md:text-6xl font-bold text-foreground mb-2">
            {currency} {formatCurrency(outstanding)}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center text-sm font-medium",
              trend.direction === 'up' ? "text-green-600" : "text-red-600"
            )}>
              {trend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {trend.value}% from last month
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue Amount */}
      <Card className="border-2 border-amber-200 bg-amber-50/50 hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-2">
            <AlertCircle className="h-4 w-4" />
            Overdue Amount
          </div>
          <div className="text-5xl md:text-6xl font-bold text-amber-600 mb-2">
            {currency} {formatCurrency(overdue)}
          </div>
          <div className="text-sm text-amber-700 font-medium">
            ⚠️ Requires immediate attention
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
