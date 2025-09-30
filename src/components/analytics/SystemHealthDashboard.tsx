/**
 * System Health Dashboard
 * Comprehensive performance monitoring dashboard for data integration and analytics
 * Real-time monitoring of database, cache, API, and system performance
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import {
  Activity,
  Database,
  Zap,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Server,
  Monitor,
  Cpu,
  HardDrive,
  Wifi,
  Users
} from 'lucide-react'

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  overallResponseTime: number
  errorRate: number
  throughput: number
  activeConnections: number
  memoryUsage: number
  cpuUsage: number
  databaseHealth: {
    connectionPool: number
    avgQueryTime: number
    slowQueries: number
  }
  cacheHealth: {
    hitRatio: number
    memoryUsage: number
    evictions: number
  }
  alerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    timestamp: Date
    endpoint?: string
  }>
}

interface PerformanceMetrics {
  responseTime: Array<{ timestamp: Date; value: number }>
  errorRate: Array<{ timestamp: Date; value: number }>
  throughput: Array<{ timestamp: Date; value: number }>
  cacheHitRatio: Array<{ timestamp: Date; value: number }>
  dbPerformance: Array<{ timestamp: Date; queryTime: number; connections: number }>
}

interface EndpointStats {
  endpoint: string
  totalRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  throughput: number
  successRate: number
  cacheHitRatio: number
}

export const SystemHealthDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [endpointStats, setEndpointStats] = useState<EndpointStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch system health data
  useEffect(() => {
    const fetchSystemHealth = async () => {
      try {
        setIsLoading(true)

        const [healthResponse, metricsResponse, endpointsResponse] = await Promise.all([
          fetch('/api/system/health'),
          fetch('/api/system/metrics'),
          fetch('/api/system/endpoints')
        ])

        const health = await healthResponse.json()
        const metrics = await metricsResponse.json()
        const endpoints = await endpointsResponse.json()

        setSystemHealth(health)
        setPerformanceMetrics(metrics)
        setEndpointStats(endpoints)
        setLastUpdate(new Date())

      } catch (error) {
        console.error('Failed to fetch system health:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSystemHealth()

    // Auto-refresh every 30 seconds
    const interval = autoRefresh ? setInterval(fetchSystemHealth, 30000) : null

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200'
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'unhealthy': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />
      case 'degraded': return <AlertTriangle className="h-5 w-5" />
      case 'unhealthy': return <XCircle className="h-5 w-5" />
      default: return <Activity className="h-5 w-5" />
    }
  }

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!performanceMetrics) return null

    return {
      responseTime: performanceMetrics.responseTime.map(item => ({
        time: item.timestamp.toLocaleTimeString(),
        value: item.value
      })),
      throughput: performanceMetrics.throughput.map(item => ({
        time: item.timestamp.toLocaleTimeString(),
        value: item.value
      })),
      errorRate: performanceMetrics.errorRate.map(item => ({
        time: item.timestamp.toLocaleTimeString(),
        value: item.value
      })),
      cacheHitRatio: performanceMetrics.cacheHitRatio.map(item => ({
        time: item.timestamp.toLocaleTimeString(),
        value: item.value
      }))
    }
  }, [performanceMetrics])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading system health data...</span>
      </div>
    )
  }

  if (!systemHealth) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load system health data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health Dashboard</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>System Status Overview</span>
            <Badge className={getStatusColor(systemHealth.status)}>
              {getStatusIcon(systemHealth.status)}
              {systemHealth.status.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {systemHealth.overallResponseTime.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
              <div className="text-xs text-gray-500">Target: &lt;200ms</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {systemHealth.throughput.toFixed(1)}/min
              </div>
              <div className="text-sm text-gray-600">Requests/Min</div>
              <div className="text-xs text-gray-500">Peak capacity: 10k/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {systemHealth.errorRate.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600">Error Rate</div>
              <div className="text-xs text-gray-500">Target: &lt;1%</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {systemHealth.activeConnections}
              </div>
              <div className="text-sm text-gray-600">Active Users</div>
              <div className="text-xs text-gray-500">Capacity: 500</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {systemHealth.alerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Active Alerts ({systemHealth.alerts.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemHealth.alerts.slice(0, 5).map((alert, index) => (
                <Alert key={index} className={`
                  ${alert.severity === 'critical' ? 'border-red-400 bg-red-50' :
                    alert.severity === 'high' ? 'border-orange-400 bg-orange-50' :
                    alert.severity === 'medium' ? 'border-yellow-400 bg-yellow-50' :
                    'border-blue-400 bg-blue-50'}
                `}>
                  <AlertTriangle className="h-4 w-4" />
                  <div className="flex justify-between items-start">
                    <div>
                      <AlertDescription>
                        <strong>{alert.severity.toUpperCase()}:</strong> {alert.message}
                        {alert.endpoint && (
                          <span className="text-sm text-gray-600 block">
                            Endpoint: {alert.endpoint}
                          </span>
                        )}
                      </AlertDescription>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="cache">Cache & Database</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Response Time Trend</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData?.responseTime || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}ms`, 'Response Time']} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      y={200}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      strokeWidth={1}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="text-xs text-gray-500 mt-2">
                  Red line indicates 200ms target threshold
                </div>
              </CardContent>
            </Card>

            {/* Throughput Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Request Throughput</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData?.throughput || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}/min`, 'Requests']} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Error Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5" />
                  <span>Error Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData?.errorRate || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, 'Error Rate']} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cache Hit Ratio */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Cache Hit Ratio</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData?.cacheHitRatio || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Hit Ratio']} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* CPU Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5" />
                  <span>CPU Usage</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Current</span>
                    <span className="font-bold">{systemHealth.cpuUsage.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemHealth.cpuUsage} className="h-2" />
                  <div className="text-xs text-gray-500">
                    {systemHealth.cpuUsage < 70 ? 'Normal' :
                     systemHealth.cpuUsage < 85 ? 'High' : 'Critical'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HardDrive className="h-5 w-5" />
                  <span>Memory Usage</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Current</span>
                    <span className="font-bold">{systemHealth.memoryUsage.toFixed(1)} MB</span>
                  </div>
                  <Progress value={(systemHealth.memoryUsage / 1024) * 100} className="h-2" />
                  <div className="text-xs text-gray-500">
                    {systemHealth.memoryUsage < 512 ? 'Normal' :
                     systemHealth.memoryUsage < 768 ? 'High' : 'Critical'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Connections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Active Connections</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Current</span>
                    <span className="font-bold">{systemHealth.activeConnections}</span>
                  </div>
                  <Progress value={(systemHealth.activeConnections / 500) * 100} className="h-2" />
                  <div className="text-xs text-gray-500">
                    Capacity: 500 connections
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>API Endpoint Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Endpoint</th>
                      <th className="text-right p-2">Requests</th>
                      <th className="text-right p-2">Avg Response</th>
                      <th className="text-right p-2">P95</th>
                      <th className="text-right p-2">Error Rate</th>
                      <th className="text-right p-2">Cache Hit</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointStats.slice(0, 10).map((endpoint, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-mono text-xs">{endpoint.endpoint}</td>
                        <td className="p-2 text-right">{endpoint.totalRequests.toLocaleString()}</td>
                        <td className="p-2 text-right">
                          <span className={endpoint.avgResponseTime > 200 ? 'text-red-600' : 'text-green-600'}>
                            {endpoint.avgResponseTime.toFixed(0)}ms
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className={endpoint.p95ResponseTime > 500 ? 'text-red-600' : 'text-yellow-600'}>
                            {endpoint.p95ResponseTime.toFixed(0)}ms
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className={endpoint.errorRate > 1 ? 'text-red-600' : 'text-green-600'}>
                            {endpoint.errorRate.toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className={endpoint.cacheHitRatio > 80 ? 'text-green-600' : 'text-yellow-600'}>
                            {endpoint.cacheHitRatio.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <Badge
                            className={endpoint.errorRate < 1 && endpoint.avgResponseTime < 200
                              ? 'bg-green-100 text-green-800'
                              : endpoint.errorRate < 5 && endpoint.avgResponseTime < 500
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                            }
                          >
                            {endpoint.errorRate < 1 && endpoint.avgResponseTime < 200
                              ? 'Healthy'
                              : endpoint.errorRate < 5 && endpoint.avgResponseTime < 500
                              ? 'Degraded'
                              : 'Unhealthy'
                            }
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache & Database Tab */}
        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Database Health</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Connection Pool</span>
                    <span className="font-bold">{systemHealth.databaseHealth.connectionPool}/25</span>
                  </div>
                  <Progress
                    value={(systemHealth.databaseHealth.connectionPool / 25) * 100}
                    className="h-2"
                  />

                  <div className="flex justify-between items-center">
                    <span>Avg Query Time</span>
                    <span className={`font-bold ${
                      systemHealth.databaseHealth.avgQueryTime > 100 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {systemHealth.databaseHealth.avgQueryTime.toFixed(1)}ms
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Slow Queries ({'>'}500ms)</span>
                    <span className={`font-bold ${
                      systemHealth.databaseHealth.slowQueries > 5 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {systemHealth.databaseHealth.slowQueries}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cache Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Cache Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Hit Ratio</span>
                    <span className={`font-bold ${
                      systemHealth.cacheHealth.hitRatio > 80 ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {systemHealth.cacheHealth.hitRatio.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={systemHealth.cacheHealth.hitRatio} className="h-2" />

                  <div className="flex justify-between items-center">
                    <span>Memory Usage</span>
                    <span className="font-bold">
                      {systemHealth.cacheHealth.memoryUsage.toFixed(1)} MB
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Recent Evictions</span>
                    <span className={`font-bold ${
                      systemHealth.cacheHealth.evictions > 10 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {systemHealth.cacheHealth.evictions}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SystemHealthDashboard