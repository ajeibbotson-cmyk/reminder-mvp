// Sprint 3: Consolidation Metrics Widget
// Reusable metrics widget for dashboard analytics

'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AEDAmount } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface ConsolidationMetricsWidgetProps {
  title: string
  value: number
  change?: number
  icon: ReactNode
  format: 'number' | 'currency' | 'percentage'
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export function ConsolidationMetricsWidget({
  title,
  value,
  change,
  icon,
  format,
  description,
  trend,
  size = 'medium',
  className
}: ConsolidationMetricsWidgetProps) {

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return <AEDAmount amount={val} />
      case 'percentage':
        return `${val.toFixed(1)}%`
      case 'number':
        return val.toLocaleString()
      default:
        return val.toString()
    }
  }

  const formatChange = (changeVal: number) => {
    const isPositive = changeVal >= 0
    const prefix = isPositive ? '+' : ''
    return `${prefix}${changeVal.toFixed(1)}%`
  }

  const getTrendColor = () => {
    if (change === undefined) return 'text-gray-600'
    if (trend) {
      return trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
    }
    return change >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getTrendIcon = () => {
    if (change === undefined) return null
    if (trend) {
      return trend === 'up' ? <TrendingUp className="h-3 w-3" /> :
             trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null
    }
    return change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
  }

  const getCardSize = () => {
    switch (size) {
      case 'small':
        return 'p-3'
      case 'large':
        return 'p-6'
      default:
        return 'p-4'
    }
  }

  const getValueSize = () => {
    switch (size) {
      case 'small':
        return 'text-lg'
      case 'large':
        return 'text-3xl'
      default:
        return 'text-2xl'
    }
  }

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-2", getCardSize())}>
        <CardTitle className={cn(
          "text-sm font-medium",
          size === 'small' ? 'text-xs' : 'text-sm'
        )}>
          {title}
        </CardTitle>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-1", getCardSize(), "pt-0")}>
        <div className={cn("font-bold", getValueSize())}>
          {formatValue(value)}
        </div>

        {change !== undefined && (
          <div className={cn("flex items-center text-xs", getTrendColor())}>
            {getTrendIcon()}
            <span className="ml-1">{formatChange(change)}</span>
          </div>
        )}

        {description && (
          <p className={cn(
            "text-muted-foreground",
            size === 'small' ? 'text-xs' : 'text-sm'
          )}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}