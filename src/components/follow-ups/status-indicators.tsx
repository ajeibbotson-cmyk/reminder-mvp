'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Calendar,
  Users,
  Mail,
  ArrowUp,
  ArrowDown,
  Minus,
  Gauge,
  Signal
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from '@/lib/utils'

interface SequenceStatus {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR' | 'SCHEDULED' | 'DRAFT'
  type: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  health: 'GOOD' | 'WARNING' | 'CRITICAL'
  performance: {
    emailsSent: number
    responseRate: number
    conversionRate: number
    errorRate: number
  }
  progress: {
    totalInvoices: number
    completed: number
    inProgress: number
    pending: number
    errors: number
  }
  trends: {
    responseRate: 'UP' | 'DOWN' | 'STABLE'
    conversionRate: 'UP' | 'DOWN' | 'STABLE'
    errorRate: 'UP' | 'DOWN' | 'STABLE'
  }
  lastActivity: Date
  nextScheduled?: Date
  uaeCompliant: boolean
  businessHoursOnly: boolean
}

interface StatusIndicatorsProps {
  sequences: SequenceStatus[]
  onStatusClick?: (status: string) => void
  onSequenceClick?: (sequenceId: string) => void
  showTrends?: boolean
  compact?: boolean
}

export function StatusIndicators({
  sequences,
  onStatusClick,
  onSequenceClick,
  showTrends = true,
  compact = false
}: StatusIndicatorsProps) {
  const t = useTranslations('followUps.status')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  const getStatusCounts = () => {
    return {
      ACTIVE: sequences.filter(s => s.status === 'ACTIVE').length,
      PAUSED: sequences.filter(s => s.status === 'PAUSED').length,
      COMPLETED: sequences.filter(s => s.status === 'COMPLETED').length,
      ERROR: sequences.filter(s => s.status === 'ERROR').length,
      SCHEDULED: sequences.filter(s => s.status === 'SCHEDULED').length,
      DRAFT: sequences.filter(s => s.status === 'DRAFT').length,
    }
  }

  const getHealthCounts = () => {
    return {
      GOOD: sequences.filter(s => s.health === 'GOOD').length,
      WARNING: sequences.filter(s => s.health === 'WARNING').length,
      CRITICAL: sequences.filter(s => s.health === 'CRITICAL').length,
    }
  }

  const getPriorityCounts = () => {
    return {
      URGENT: sequences.filter(s => s.priority === 'URGENT').length,
      HIGH: sequences.filter(s => s.priority === 'HIGH').length,
      MEDIUM: sequences.filter(s => s.priority === 'MEDIUM').length,
      LOW: sequences.filter(s => s.priority === 'LOW').length,
    }
  }

  const getOverallStats = () => {
    const totalEmailsSent = sequences.reduce((sum, s) => sum + s.performance.emailsSent, 0)
    const avgResponseRate = sequences.reduce((sum, s) => sum + s.performance.responseRate, 0) / (sequences.length || 1)
    const avgConversionRate = sequences.reduce((sum, s) => sum + s.performance.conversionRate, 0) / (sequences.length || 1)
    const totalErrors = sequences.reduce((sum, s) => sum + s.progress.errors, 0)
    const uaeCompliantCount = sequences.filter(s => s.uaeCompliant).length

    return {
      totalEmailsSent,
      avgResponseRate,
      avgConversionRate,
      totalErrors,
      uaeCompliantCount,
      complianceRate: (uaeCompliantCount / (sequences.length || 1)) * 100
    }
  }

  const statusCounts = getStatusCounts()
  const healthCounts = getHealthCounts()
  const priorityCounts = getPriorityCounts()
  const overallStats = getOverallStats()

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return {
          icon: Play,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-200',
          label: 'Active',
          description: 'Currently running sequences'
        }
      case 'PAUSED':
        return {
          icon: Pause,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          label: 'Paused',
          description: 'Temporarily paused sequences'
        }
      case 'COMPLETED':
        return {
          icon: CheckCircle,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          label: 'Completed',
          description: 'Successfully completed sequences'
        }
      case 'ERROR':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-200',
          label: 'Error',
          description: 'Sequences with errors'
        }
      case 'SCHEDULED':
        return {
          icon: Clock,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          borderColor: 'border-purple-200',
          label: 'Scheduled',
          description: 'Scheduled to start later'
        }
      case 'DRAFT':
        return {
          icon: Target,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-200',
          label: 'Draft',
          description: 'Draft sequences not yet activated'
        }
      default:
        return {
          icon: Target,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-200',
          label: status,
          description: ''
        }
    }
  }

  const getHealthConfig = (health: string) => {
    switch (health) {
      case 'GOOD':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Good'
        }
      case 'WARNING':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          label: 'Warning'
        }
      case 'CRITICAL':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          label: 'Critical'
        }
      default:
        return {
          icon: Activity,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          label: health
        }
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'UP': return <ArrowUp className="h-3 w-3 text-green-600" />
      case 'DOWN': return <ArrowDown className="h-3 w-3 text-red-600" />
      case 'STABLE': return <Minus className="h-3 w-3 text-gray-600" />
      default: return <Minus className="h-3 w-3 text-gray-600" />
    }
  }

  const handleStatusClick = (status: string) => {
    setSelectedStatus(selectedStatus === status ? null : status)
    onStatusClick?.(status)
  }

  if (compact) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => {
          const config = getStatusConfig(status)
          const IconComponent = config.icon

          return (
            <TooltipProvider key={status}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-auto p-3 flex flex-col items-center gap-2",
                      selectedStatus === status && "ring-2 ring-blue-500"
                    )}
                    onClick={() => handleStatusClick(status)}
                  >
                    <div className={cn("p-2 rounded-full", config.bgColor)}>
                      <IconComponent className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-xs text-gray-600">{config.label}</div>
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{config.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => {
          const config = getStatusConfig(status)
          const IconComponent = config.icon

          return (
            <Card
              key={status}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedStatus === status && "ring-2 ring-blue-500",
                config.borderColor
              )}
              onClick={() => handleStatusClick(status)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("p-2 rounded-full", config.bgColor)}>
                    <IconComponent className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-gray-600">{config.label}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{config.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>
            Overall health status of automation sequences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(healthCounts).map(([health, count]) => {
              const config = getHealthConfig(health)
              const IconComponent = config.icon
              const percentage = (count / (sequences.length || 1)) * 100

              return (
                <div key={health} className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", config.bgColor)}>
                    <IconComponent className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{config.label}</span>
                      <span className="text-sm text-gray-600">{count}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {overallStats.totalEmailsSent.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Total Emails Sent</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {overallStats.avgResponseRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">Avg Response Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {overallStats.avgConversionRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">Avg Conversion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {overallStats.complianceRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-600">UAE Compliance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Trends */}
      {showTrends && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Trends
            </CardTitle>
            <CardDescription>
              Recent performance trends across all sequences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-sm font-medium">Response Rate</span>
                  {getTrendIcon(sequences[0]?.trends?.responseRate || 'STABLE')}
                </div>
                <div className="text-2xl font-bold">
                  {overallStats.avgResponseRate.toFixed(1)}%
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-sm font-medium">Conversion Rate</span>
                  {getTrendIcon(sequences[0]?.trends?.conversionRate || 'STABLE')}
                </div>
                <div className="text-2xl font-bold">
                  {overallStats.avgConversionRate.toFixed(1)}%
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-sm font-medium">Error Rate</span>
                  {getTrendIcon(sequences[0]?.trends?.errorRate || 'STABLE')}
                </div>
                <div className="text-2xl font-bold">
                  {((overallStats.totalErrors / (sequences.length || 1)) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Priority Distribution
          </CardTitle>
          <CardDescription>
            Sequence priority levels and workload distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(priorityCounts).map(([priority, count]) => {
              const percentage = (count / (sequences.length || 1)) * 100
              const colorMap = {
                URGENT: 'bg-red-500',
                HIGH: 'bg-orange-500',
                MEDIUM: 'bg-blue-500',
                LOW: 'bg-gray-500'
              }

              return (
                <div key={priority} className="flex items-center gap-3">
                  <div className="w-16 text-sm font-medium">{priority}</div>
                  <div className="flex-1">
                    <Progress
                      value={percentage}
                      className="h-3"
                      style={{
                        background: colorMap[priority as keyof typeof colorMap] || 'bg-gray-500'
                      }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm text-gray-600">
                    {count}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Indicator */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Signal className="h-6 w-6 text-blue-600" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Real-time Monitoring Active</h4>
                <p className="text-sm text-blue-700">
                  Sequences are being monitored continuously for optimal performance
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              Live
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}