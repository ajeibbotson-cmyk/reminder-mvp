'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts'
import {
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  Mail,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Pause,
  Play,
  RefreshCw,
  Bell,
  BellOff,
  Server,
  Database,
  Globe,
  Cpu,
  HardDrive,
  Monitor
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface RealTimeMetricsProps {
  companyId: string
  locale: 'en' | 'ar'
  isEnabled: boolean
  data?: {
    activeReminders: number
    todayCollections: number
    systemHealth: number
    lastUpdated: string
  }
  className?: string
}

interface RealTimeData {
  timestamp: string
  activeEmails: number
  responseRate: number
  todayRevenue: number
  systemLoad: number
  onlineUsers: number
  queueSize: number
  errorRate: number
}

interface SystemHealth {
  cpu: number
  memory: number
  database: number
  email: number
  api: number
  storage: number
  overall: number
}

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  timestamp: string
  acknowledged: boolean
}

const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({
  companyId,
  locale,
  isEnabled,
  data: propData,
  className
}) => {
  const [isConnected, setIsConnected] = useState(false)
  const [realTimeData, setRealTimeData] = useState<RealTimeData[]>([])
  const [currentMetrics, setCurrentMetrics] = useState<RealTimeData | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isPaused, setIsPaused] = useState(!isEnabled)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isRTL = locale === 'ar'

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')

    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'}/api/analytics/realtime/ws?companyId=${companyId}`
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsConnected(true)
        setConnectionStatus('connected')
        console.log('Real-time analytics WebSocket connected')
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'metrics':
              const newData: RealTimeData = {
                timestamp: new Date().toISOString(),
                ...message.data
              }
              setCurrentMetrics(newData)
              setRealTimeData(prev => [...prev.slice(-29), newData])
              break

            case 'health':
              setSystemHealth(message.data)
              break

            case 'alert':
              const alert: Alert = {
                id: Math.random().toString(36).substr(2, 9),
                type: message.data.type,
                title: message.data.title,
                message: message.data.message,
                timestamp: new Date().toISOString(),
                acknowledged: false
              }
              setAlerts(prev => [alert, ...prev.slice(0, 9)])

              // Show browser notification if enabled
              if (notificationsEnabled && Notification.permission === 'granted') {
                new Notification(alert.title, {
                  body: alert.message,
                  icon: '/favicon.ico'
                })
              }
              break
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
        setConnectionStatus('disconnected')
      }

      wsRef.current.onclose = () => {
        setIsConnected(false)
        setConnectionStatus('disconnected')

        // Attempt to reconnect after 5 seconds if enabled
        if (isEnabled && !isPaused) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, 5000)
        }
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setConnectionStatus('disconnected')
    }
  }, [companyId, isEnabled, isPaused, notificationsEnabled])

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  // Initialize WebSocket connection
  useEffect(() => {
    if (isEnabled && !isPaused) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [isEnabled, isPaused, connectWebSocket, disconnectWebSocket])

  // Request notification permission
  useEffect(() => {
    if (notificationsEnabled && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [notificationsEnabled])

  // Handle pause/resume
  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  // Acknowledge alert
  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    )
  }

  // Get status color based on value
  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-600'
    if (value >= thresholds.warning) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Render real-time chart
  const renderRealTimeChart = () => (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={realTimeData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) =>
              new Date(timestamp).toLocaleTimeString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip
            labelFormatter={(timestamp) =>
              new Date(timestamp).toLocaleString(locale === 'ar' ? 'ar-AE' : 'en-AE')
            }
          />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="activeEmails"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            name={locale === 'ar' ? 'رسائل نشطة' : 'Active Emails'}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="responseRate"
            stroke="#10b981"
            strokeWidth={2}
            name={locale === 'ar' ? 'معدل الاستجابة' : 'Response Rate'}
          />

          <Bar
            yAxisId="left"
            dataKey="queueSize"
            fill="#f59e0b"
            fillOpacity={0.7}
            name={locale === 'ar' ? 'حجم الطابور' : 'Queue Size'}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  // Render system health indicators
  const renderSystemHealth = () => {
    if (!systemHealth) return null

    const healthItems = [
      { name: locale === 'ar' ? 'المعالج' : 'CPU', value: systemHealth.cpu, icon: Cpu },
      { name: locale === 'ar' ? 'الذاكرة' : 'Memory', value: systemHealth.memory, icon: HardDrive },
      { name: locale === 'ar' ? 'قاعدة البيانات' : 'Database', value: systemHealth.database, icon: Database },
      { name: locale === 'ar' ? 'البريد الإلكتروني' : 'Email', value: systemHealth.email, icon: Mail },
      { name: locale === 'ar' ? 'واجهة البرمجة' : 'API', value: systemHealth.api, icon: Server },
      { name: locale === 'ar' ? 'التخزين' : 'Storage', value: systemHealth.storage, icon: HardDrive }
    ]

    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {healthItems.map((item, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <item.icon className={cn("h-5 w-5", getStatusColor(item.value, { good: 80, warning: 60 }))} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.name}</span>
                <span className={cn("text-sm font-bold", getStatusColor(item.value, { good: 80, warning: 60 }))}>
                  {item.value}%
                </span>
              </div>
              <Progress value={item.value} className="h-1 mt-1" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl", className)}>
      {/* Header with Connection Status */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                {locale === 'ar' ? 'المقاييس المباشرة' : 'Real-Time Metrics'}
              </CardTitle>
              <CardDescription className="mt-1">
                {locale === 'ar'
                  ? 'مراقبة مباشرة للأداء وحالة النظام'
                  : 'Live monitoring of system performance and health'
                }
              </CardDescription>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <Badge
                  variant={isConnected ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {connectionStatus === 'connecting' ? (
                    locale === 'ar' ? 'جاري الاتصال...' : 'Connecting...'
                  ) : isConnected ? (
                    locale === 'ar' ? 'متصل' : 'Connected'
                  ) : (
                    locale === 'ar' ? 'غير متصل' : 'Disconnected'
                  )}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePause}
                  disabled={!isEnabled}
                >
                  {isPaused ? (
                    <Play className="h-4 w-4 mr-2" />
                  ) : (
                    <Pause className="h-4 w-4 mr-2" />
                  )}
                  {isPaused ? (locale === 'ar' ? 'تشغيل' : 'Resume') : (locale === 'ar' ? 'إيقاف' : 'Pause')}
                </Button>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                  />
                  {notificationsEnabled ? (
                    <Bell className="h-4 w-4 text-blue-600" />
                  ) : (
                    <BellOff className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Metrics */}
      {currentMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium">
                  {locale === 'ar' ? 'رسائل نشطة' : 'Active Emails'}
                </span>
              </div>
              <div className="text-lg font-bold">{currentMetrics.activeEmails}</div>
              <div className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'قيد المعالجة' : 'Processing'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium">
                  {locale === 'ar' ? 'معدل الاستجابة' : 'Response Rate'}
                </span>
              </div>
              <div className="text-lg font-bold">{formatPercentage(currentMetrics.responseRate)}</div>
              <div className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'مباشر' : 'Live'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium">
                  {locale === 'ar' ? 'إيرادات اليوم' : 'Today Revenue'}
                </span>
              </div>
              <div className="text-lg font-bold">{formatAEDCurrency(currentMetrics.todayRevenue)}</div>
              <div className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'محدث' : 'Updated'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium">
                  {locale === 'ar' ? 'مستخدمون متصلون' : 'Online Users'}
                </span>
              </div>
              <div className="text-lg font-bold">{currentMetrics.onlineUsers}</div>
              <div className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'الآن' : 'Now'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium">
                  {locale === 'ar' ? 'طابور المعالجة' : 'Queue Size'}
                </span>
              </div>
              <div className="text-lg font-bold">{currentMetrics.queueSize}</div>
              <div className="text-xs text-muted-foreground">
                {locale === 'ar' ? 'عنصر' : 'Items'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium">
                  {locale === 'ar' ? 'معدل الأخطاء' : 'Error Rate'}
                </span>
              </div>
              <div className="text-lg font-bold">{formatPercentage(currentMetrics.errorRate)}</div>
              <div className={cn(
                "text-xs",
                currentMetrics.errorRate < 1 ? 'text-green-600' :
                currentMetrics.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {currentMetrics.errorRate < 1 ?
                  (locale === 'ar' ? 'ممتاز' : 'Excellent') :
                  currentMetrics.errorRate < 5 ?
                  (locale === 'ar' ? 'مقبول' : 'Acceptable') :
                  (locale === 'ar' ? 'يحتاج انتباه' : 'Needs Attention')
                }
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="live-chart" className="space-y-6">
        <TabsList>
          <TabsTrigger value="live-chart">
            {locale === 'ar' ? 'الرسم المباشر' : 'Live Chart'}
          </TabsTrigger>
          <TabsTrigger value="system-health">
            {locale === 'ar' ? 'صحة النظام' : 'System Health'}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            {locale === 'ar' ? 'التنبيهات' : 'Alerts'}
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {alerts.filter(a => !a.acknowledged).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-chart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {locale === 'ar' ? 'المقاييس المباشرة' : 'Live Performance Metrics'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar'
                  ? 'بيانات محدثة كل 30 ثانية'
                  : 'Data updated every 30 seconds'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {realTimeData.length > 0 ? (
                renderRealTimeChart()
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Monitor className="h-8 w-8 mb-2" />
                  <p className="text-sm">
                    {locale === 'ar' ? 'انتظار البيانات المباشرة...' : 'Waiting for live data...'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system-health" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {locale === 'ar' ? 'صحة النظام' : 'System Health'}
                  </CardTitle>
                  <CardDescription>
                    {locale === 'ar'
                      ? 'مراقبة أداء مكونات النظام'
                      : 'Monitor system component performance'
                    }
                  </CardDescription>
                </div>

                {systemHealth && (
                  <div className="text-center">
                    <div className={cn(
                      "text-2xl font-bold",
                      getStatusColor(systemHealth.overall, { good: 80, warning: 60 })
                    )}>
                      {systemHealth.overall}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {locale === 'ar' ? 'الصحة العامة' : 'Overall Health'}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {systemHealth ? (
                renderSystemHealth()
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Server className="h-6 w-6 mb-2" />
                  <p className="text-sm">
                    {locale === 'ar' ? 'تحميل بيانات الصحة...' : 'Loading health data...'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {locale === 'ar' ? 'التنبيهات والإشعارات' : 'Alerts & Notifications'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CheckCircle className="h-6 w-6 mb-2" />
                    <p className="text-sm">
                      {locale === 'ar' ? 'لا توجد تنبيهات' : 'No alerts'}
                    </p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <Alert
                      key={alert.id}
                      className={cn(
                        "border-l-4",
                        alert.type === 'critical' && "border-l-red-500 bg-red-50 dark:bg-red-950",
                        alert.type === 'warning' && "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950",
                        alert.type === 'info' && "border-l-blue-500 bg-blue-50 dark:bg-blue-950",
                        alert.type === 'success' && "border-l-green-500 bg-green-50 dark:bg-green-950",
                        alert.acknowledged && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {alert.type === 'critical' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                            {alert.type === 'info' && <Activity className="h-4 w-4 text-blue-600" />}
                            {alert.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}

                            <h4 className="font-medium text-sm">{alert.title}</h4>

                            <Badge variant="outline" className="text-xs">
                              {alert.type}
                            </Badge>
                          </div>

                          <AlertDescription className="text-sm">
                            {alert.message}
                          </AlertDescription>

                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(alert.timestamp).toLocaleString(locale === 'ar' ? 'ar-AE' : 'en-AE')}
                          </p>
                        </div>

                        {!alert.acknowledged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="ml-4"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Alert>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connection Lost Warning */}
      {!isConnected && isEnabled && !isPaused && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {locale === 'ar'
                ? 'انقطع الاتصال المباشر. جاري المحاولة للإعادة الاتصال...'
                : 'Real-time connection lost. Attempting to reconnect...'
              }
            </span>
            <Button variant="outline" size="sm" onClick={connectWebSocket}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {locale === 'ar' ? 'إعادة الاتصال' : 'Reconnect'}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default RealTimeMetrics
export { RealTimeMetrics }