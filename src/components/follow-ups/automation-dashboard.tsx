'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  Users,
  TrendingUp,
  Calendar,
  Zap,
  BarChart3,
  Timer,
  Target,
  Gauge,
  RefreshCw,
  Filter,
  Settings,
  Download,
  Eye,
  Edit,
  MoreHorizontal
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ManualOverrideControls } from './manual-override-controls'
import { SequenceMetrics } from './sequence-metrics'
import { StatusIndicators } from './status-indicators'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { cn } from '@/lib/utils'

interface ActiveSequence {
  id: string
  name: string
  type: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  progress: {
    totalInvoices: number
    completed: number
    inProgress: number
    pending: number
  }
  lastActivity: Date
  nextScheduled: Date
  performance: {
    emailsSent: number
    responseRate: number
    paymentReceived: number
    averageResponseTime: number
  }
  recentActivity: Array<{
    id: string
    type: 'EMAIL_SENT' | 'PAYMENT_RECEIVED' | 'SEQUENCE_PAUSED' | 'SEQUENCE_RESUMED'
    timestamp: Date
    invoiceId: string
    customerName: string
    details: string
  }>
}

interface AutomationDashboardProps {
  companyId?: string
  refreshInterval?: number
  onSequenceClick?: (sequenceId: string) => void
  onInvoiceClick?: (invoiceId: string) => void
}

export function AutomationDashboard({
  companyId,
  refreshInterval = 30000,
  onSequenceClick,
  onInvoiceClick
}: AutomationDashboardProps) {
  const t = useTranslations('followUps.dashboard')
  const [activeSequences, setActiveSequences] = useState<ActiveSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const { sequences, fetchSequences } = useFollowUpSequenceStore()

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  // Initial data load
  useEffect(() => {
    if (companyId) {
      refreshData()
    }
  }, [companyId])

  const refreshData = async () => {
    setLoading(true)
    try {
      // Fetch active sequence data
      const response = await fetch(`/api/follow-up-sequences/active?companyId=${companyId}`)
      if (response.ok) {
        const data = await response.json()
        setActiveSequences(data.sequences || [])
      }

      // Refresh sequence data from store
      if (companyId) {
        await fetchSequences(companyId)
      }

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualRefresh = () => {
    refreshData()
  }

  const handleBulkAction = async (action: string, sequenceIds: string[]) => {
    try {
      const response = await fetch('/api/follow-up-sequences/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          sequenceIds,
          companyId
        })
      })

      if (response.ok) {
        refreshData()
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
    }
  }

  const filteredSequences = activeSequences.filter(sequence => {
    const matchesSearch = sequence.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || sequence.status === statusFilter
    const matchesType = typeFilter === 'all' || sequence.type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const getDashboardStats = () => {
    const total = activeSequences.length
    const active = activeSequences.filter(s => s.status === 'ACTIVE').length
    const paused = activeSequences.filter(s => s.status === 'PAUSED').length
    const completed = activeSequences.filter(s => s.status === 'COMPLETED').length
    const errors = activeSequences.filter(s => s.status === 'ERROR').length

    const totalEmailsSent = activeSequences.reduce((sum, s) => sum + s.performance.emailsSent, 0)
    const avgResponseRate = activeSequences.reduce((sum, s) => sum + s.performance.responseRate, 0) / (total || 1)
    const totalPayments = activeSequences.reduce((sum, s) => sum + s.performance.paymentReceived, 0)

    return {
      total,
      active,
      paused,
      completed,
      errors,
      totalEmailsSent,
      avgResponseRate,
      totalPayments
    }
  }

  const stats = getDashboardStats()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-blue-100 text-blue-800'
      case 'ERROR': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Play className="h-3 w-3" />
      case 'PAUSED': return <Pause className="h-3 w-3" />
      case 'COMPLETED': return <CheckCircle className="h-3 w-3" />
      case 'ERROR': return <AlertCircle className="h-3 w-3" />
      default: return <Clock className="h-3 w-3" />
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Automation Dashboard
          </h2>
          <p className="text-gray-600">
            Real-time monitoring of active follow-up sequences
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last updated: {formatTimeAgo(lastRefresh)}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sequences</CardTitle>
            <Gauge className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total} total sequences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent Today</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalEmailsSent}</div>
            <p className="text-xs text-muted-foreground">
              Across all sequences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.avgResponseRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Customer engagement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues Detected</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequences">Active Sequences</TabsTrigger>
          <TabsTrigger value="metrics">Performance</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Sequence Status Distribution</CardTitle>
              <CardDescription>
                Current status of all automated sequences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusIndicators
                sequences={activeSequences}
                onStatusClick={(status) => setStatusFilter(status)}
              />
            </CardContent>
          </Card>

          {/* Manual Override Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Manage sequences and override automation when needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManualOverrideControls
                sequences={filteredSequences}
                onBulkAction={handleBulkAction}
                onSequenceAction={(sequenceId, action) => {
                  handleBulkAction(action, [sequenceId])
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Active Sequence Monitor</CardTitle>
              <CardDescription>
                Real-time view of all running automation sequences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Input
                    placeholder="Search sequences..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Active Sequences List */}
              <div className="space-y-4">
                {filteredSequences.map((sequence) => (
                  <div
                    key={sequence.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{sequence.name}</h4>
                        <Badge className={getStatusColor(sequence.status)}>
                          {getStatusIcon(sequence.status)}
                          {sequence.status}
                        </Badge>
                        <Badge variant="outline">{sequence.type}</Badge>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => onSequenceClick?.(sequence.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Sequence
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            {sequence.status === 'ACTIVE' ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause Sequence
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Resume Sequence
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>
                          {sequence.progress.completed} of {sequence.progress.totalInvoices} invoices
                        </span>
                      </div>
                      <Progress
                        value={(sequence.progress.completed / sequence.progress.totalInvoices) * 100}
                        className="h-2"
                      />
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Emails Sent:</span>
                        <div className="font-medium">{sequence.performance.emailsSent}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Response Rate:</span>
                        <div className="font-medium">{sequence.performance.responseRate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Activity:</span>
                        <div className="font-medium">{formatTimeAgo(sequence.lastActivity)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Next Scheduled:</span>
                        <div className="font-medium">{formatTimeAgo(sequence.nextScheduled)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredSequences.length === 0 && (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No active sequences found</h3>
                  <p className="text-gray-600">
                    {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Start your first automated sequence to see activity here'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <SequenceMetrics
            sequences={activeSequences}
            timeRange={selectedTimeRange}
            onTimeRangeChange={setSelectedTimeRange}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          {/* Recent Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest automation events and system actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeSequences.flatMap(seq =>
                  seq.recentActivity.map(activity => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{activity.type.replace('_', ' ')}</span>
                          <Badge variant="outline" className="text-xs">
                            {seq.name}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {activity.details} - {activity.customerName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onInvoiceClick?.(activity.invoiceId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}