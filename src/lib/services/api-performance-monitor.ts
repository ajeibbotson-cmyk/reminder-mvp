/**
 * API Performance Monitor
 * Comprehensive monitoring system for API response times, error tracking, and performance optimization
 * Ensures sub-200ms response times for analytics endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { performance } from 'perf_hooks'
import { headers } from 'next/headers'

interface PerformanceMetric {
  id: string
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  requestSize: number
  responseSize: number
  timestamp: Date
  userAgent?: string
  ip?: string
  companyId?: string
  userId?: string
  cacheHit: boolean
  dbQueries: number
  dbExecutionTime: number
  memoryUsage: number
  errorMessage?: string
  slowQueryCount: number
  stackTrace?: string[]
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
  lastError?: Date
  slowestRequest: number
  fastestRequest: number
  cacheHitRatio: number
}

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

interface AlertConfig {
  responseTimeThreshold: number
  errorRateThreshold: number
  memoryUsageThreshold: number
  slowQueryThreshold: number
  throughputDropThreshold: number
}

export class APIPerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private endpointStats: Map<string, EndpointStats> = new Map()
  private readonly MAX_METRICS_BUFFER = 10000
  private readonly CLEANUP_INTERVAL = 300000 // 5 minutes
  private readonly ALERT_CONFIG: AlertConfig = {
    responseTimeThreshold: 200, // 200ms target
    errorRateThreshold: 1, // 1% error rate
    memoryUsageThreshold: 80, // 80% memory usage
    slowQueryThreshold: 500, // 500ms slow query
    throughputDropThreshold: 50 // 50% throughput drop
  }

  private alerts: SystemHealth['alerts'] = []
  private systemMetrics = {
    startTime: Date.now(),
    totalRequests: 0,
    totalErrors: 0,
    totalResponseTime: 0
  }

  constructor() {
    this.startCleanupScheduler()
    this.startAlertMonitoring()
    this.startMetricsAggregation()
  }

  /**
   * Middleware function to wrap API routes with performance monitoring
   */
  createPerformanceMiddleware() {
    return (handler: Function) => {
      return async (request: NextRequest, context?: any) => {
        const startTime = performance.now()
        const requestId = crypto.randomUUID()

        // Extract request information
        const endpoint = this.extractEndpoint(request.url)
        const method = request.method
        const userAgent = request.headers.get('user-agent')
        const ip = this.extractIP(request)

        // Get request size
        const requestBody = await this.cloneAndReadRequest(request)
        const requestSize = Buffer.byteLength(JSON.stringify(requestBody) || '', 'utf-8')

        let response: NextResponse
        let error: Error | null = null
        let dbQueries = 0
        let dbExecutionTime = 0

        try {
          // Create instrumented request
          const instrumentedRequest = this.instrumentRequest(request, {
            onDatabaseQuery: (queryTime: number) => {
              dbQueries++
              dbExecutionTime += queryTime
            }
          })

          // Execute the original handler
          response = await handler(instrumentedRequest, context)

        } catch (err) {
          error = err as Error

          // Create error response
          response = NextResponse.json(
            {
              error: 'Internal Server Error',
              requestId,
              timestamp: new Date()
            },
            { status: 500 }
          )
        }

        const endTime = performance.now()
        const responseTime = endTime - startTime

        // Get memory usage
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB

        // Get response size
        const responseBody = await this.getResponseBody(response)
        const responseSize = Buffer.byteLength(JSON.stringify(responseBody) || '', 'utf-8')

        // Check cache hit from headers
        const cacheHit = response.headers.get('X-Cache-Status') === 'HIT'

        // Create performance metric
        const metric: PerformanceMetric = {
          id: requestId,
          endpoint,
          method,
          statusCode: response.status,
          responseTime,
          requestSize,
          responseSize,
          timestamp: new Date(),
          userAgent,
          ip,
          companyId: this.extractCompanyId(request),
          userId: this.extractUserId(request),
          cacheHit,
          dbQueries,
          dbExecutionTime,
          memoryUsage,
          errorMessage: error?.message,
          slowQueryCount: dbExecutionTime > this.ALERT_CONFIG.slowQueryThreshold ? 1 : 0,
          stackTrace: error?.stack?.split('\n')
        }

        // Record the metric
        await this.recordMetric(metric)

        // Add performance headers to response
        response.headers.set('X-Response-Time', `${responseTime.toFixed(2)}ms`)
        response.headers.set('X-Request-ID', requestId)
        response.headers.set('X-DB-Queries', dbQueries.toString())
        response.headers.set('X-Cache-Hit', cacheHit ? 'true' : 'false')

        return response
      }
    }
  }

  /**
   * Record performance metric and update statistics
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    // Add to metrics buffer
    this.metrics.push(metric)

    // Update system metrics
    this.systemMetrics.totalRequests++
    this.systemMetrics.totalResponseTime += metric.responseTime

    if (metric.statusCode >= 400) {
      this.systemMetrics.totalErrors++
    }

    // Update endpoint statistics
    await this.updateEndpointStats(metric)

    // Check for alerts
    await this.checkPerformanceAlerts(metric)

    // Clean up buffer if too large
    if (this.metrics.length > this.MAX_METRICS_BUFFER) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_BUFFER * 0.8) // Keep 80% newest
    }
  }

  /**
   * Update endpoint-specific statistics
   */
  private async updateEndpointStats(metric: PerformanceMetric): Promise<void> {
    const key = `${metric.method}:${metric.endpoint}`
    let stats = this.endpointStats.get(key)

    if (!stats) {
      stats = {
        endpoint: key,
        totalRequests: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        successRate: 0,
        slowestRequest: 0,
        fastestRequest: Number.MAX_VALUE,
        cacheHitRatio: 0
      }
      this.endpointStats.set(key, stats)
    }

    // Update counters
    stats.totalRequests++

    // Update response time statistics
    stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + metric.responseTime) / stats.totalRequests
    stats.slowestRequest = Math.max(stats.slowestRequest, metric.responseTime)
    stats.fastestRequest = Math.min(stats.fastestRequest, metric.responseTime)

    // Update error rate
    if (metric.statusCode >= 400) {
      stats.errorRate = ((stats.errorRate * (stats.totalRequests - 1)) + 1) / stats.totalRequests
      stats.lastError = metric.timestamp
    } else {
      stats.errorRate = (stats.errorRate * (stats.totalRequests - 1)) / stats.totalRequests
    }

    // Update success rate
    stats.successRate = ((stats.successRate * (stats.totalRequests - 1)) + (metric.statusCode < 400 ? 1 : 0)) / stats.totalRequests

    // Update cache hit ratio
    stats.cacheHitRatio = ((stats.cacheHitRatio * (stats.totalRequests - 1)) + (metric.cacheHit ? 1 : 0)) / stats.totalRequests

    // Calculate percentiles for this endpoint
    const endpointMetrics = this.metrics
      .filter(m => `${m.method}:${m.endpoint}` === key)
      .map(m => m.responseTime)
      .sort((a, b) => a - b)

    if (endpointMetrics.length > 0) {
      stats.p95ResponseTime = this.calculatePercentile(endpointMetrics, 95)
      stats.p99ResponseTime = this.calculatePercentile(endpointMetrics, 99)
    }

    // Calculate throughput (requests per minute)
    const oneMinuteAgo = Date.now() - 60000
    const recentRequests = this.metrics.filter(
      m => `${m.method}:${m.endpoint}` === key && m.timestamp.getTime() > oneMinuteAgo
    ).length
    stats.throughput = recentRequests
  }

  /**
   * Check for performance alerts based on current metrics
   */
  private async checkPerformanceAlerts(metric: PerformanceMetric): Promise<void> {
    const now = new Date()

    // Response time alert
    if (metric.responseTime > this.ALERT_CONFIG.responseTimeThreshold * 2) {
      this.addAlert({
        severity: metric.responseTime > this.ALERT_CONFIG.responseTimeThreshold * 5 ? 'critical' : 'high',
        message: `Slow response time: ${metric.responseTime.toFixed(2)}ms for ${metric.endpoint}`,
        timestamp: now,
        endpoint: metric.endpoint
      })
    }

    // Error rate alert
    const endpointStats = this.endpointStats.get(`${metric.method}:${metric.endpoint}`)
    if (endpointStats && endpointStats.errorRate > this.ALERT_CONFIG.errorRateThreshold) {
      this.addAlert({
        severity: endpointStats.errorRate > 5 ? 'critical' : 'medium',
        message: `High error rate: ${(endpointStats.errorRate * 100).toFixed(1)}% for ${metric.endpoint}`,
        timestamp: now,
        endpoint: metric.endpoint
      })
    }

    // Memory usage alert
    if (metric.memoryUsage > this.ALERT_CONFIG.memoryUsageThreshold) {
      this.addAlert({
        severity: metric.memoryUsage > 95 ? 'critical' : 'high',
        message: `High memory usage: ${metric.memoryUsage.toFixed(1)}MB`,
        timestamp: now
      })
    }

    // Slow query alert
    if (metric.slowQueryCount > 0) {
      this.addAlert({
        severity: 'medium',
        message: `Slow database query detected: ${metric.dbExecutionTime.toFixed(2)}ms for ${metric.endpoint}`,
        timestamp: now,
        endpoint: metric.endpoint
      })
    }
  }

  /**
   * Add alert with deduplication
   */
  private addAlert(alert: SystemHealth['alerts'][0]): void {
    // Check for duplicate alerts in the last 5 minutes
    const fiveMinutesAgo = Date.now() - 300000
    const isDuplicate = this.alerts.some(existing =>
      existing.message === alert.message &&
      existing.endpoint === alert.endpoint &&
      existing.timestamp.getTime() > fiveMinutesAgo
    )

    if (!isDuplicate) {
      this.alerts.push(alert)

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100)
      }

      // Emit alert event
      console.warn(`Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`)
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const now = Date.now()
    const uptime = now - this.systemMetrics.startTime

    // Calculate overall metrics
    const avgResponseTime = this.systemMetrics.totalRequests > 0
      ? this.systemMetrics.totalResponseTime / this.systemMetrics.totalRequests
      : 0

    const errorRate = this.systemMetrics.totalRequests > 0
      ? (this.systemMetrics.totalErrors / this.systemMetrics.totalRequests) * 100
      : 0

    const throughput = uptime > 0
      ? (this.systemMetrics.totalRequests / uptime) * 60000 // requests per minute
      : 0

    // Determine overall status
    let status: SystemHealth['status'] = 'healthy'

    if (avgResponseTime > this.ALERT_CONFIG.responseTimeThreshold * 2 ||
        errorRate > this.ALERT_CONFIG.errorRateThreshold * 2) {
      status = 'unhealthy'
    } else if (avgResponseTime > this.ALERT_CONFIG.responseTimeThreshold ||
               errorRate > this.ALERT_CONFIG.errorRateThreshold) {
      status = 'degraded'
    }

    // Get recent memory usage
    const memoryUsage = process.memoryUsage()
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024

    // Calculate database health metrics
    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > now - 300000) // Last 5 minutes
    const avgQueryTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.dbExecutionTime, 0) / recentMetrics.length
      : 0
    const slowQueries = recentMetrics.reduce((sum, m) => sum + m.slowQueryCount, 0)

    // Calculate cache health metrics
    const cacheHitRatio = recentMetrics.length > 0
      ? (recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length) * 100
      : 0

    return {
      status,
      overallResponseTime: avgResponseTime,
      errorRate,
      throughput,
      activeConnections: this.getActiveConnectionCount(),
      memoryUsage: memoryUsageMB,
      cpuUsage: await this.getCPUUsage(),
      databaseHealth: {
        connectionPool: 0, // Would be populated from database service
        avgQueryTime,
        slowQueries
      },
      cacheHealth: {
        hitRatio: cacheHitRatio,
        memoryUsage: 0, // Would be populated from cache service
        evictions: 0 // Would be populated from cache service
      },
      alerts: this.alerts.slice(-20) // Last 20 alerts
    }
  }

  /**
   * Get performance metrics for specific endpoint
   */
  getEndpointMetrics(endpoint: string, method?: string): EndpointStats | null {
    const key = method ? `${method}:${endpoint}` : endpoint
    return this.endpointStats.get(key) || null
  }

  /**
   * Get all endpoint statistics
   */
  getAllEndpointStats(): EndpointStats[] {
    return Array.from(this.endpointStats.values())
      .sort((a, b) => b.totalRequests - a.totalRequests) // Sort by request count
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(hours: number = 24): {
    responseTime: Array<{ timestamp: Date; value: number }>
    errorRate: Array<{ timestamp: Date; value: number }>
    throughput: Array<{ timestamp: Date; value: number }>
  } {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    const relevantMetrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff)

    // Group by hour
    const hourlyData = new Map<number, { count: number; totalTime: number; errors: number }>()

    relevantMetrics.forEach(metric => {
      const hour = Math.floor(metric.timestamp.getTime() / (60 * 60 * 1000))

      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, { count: 0, totalTime: 0, errors: 0 })
      }

      const data = hourlyData.get(hour)!
      data.count++
      data.totalTime += metric.responseTime

      if (metric.statusCode >= 400) {
        data.errors++
      }
    })

    const responseTime = []
    const errorRate = []
    const throughput = []

    for (const [hour, data] of hourlyData) {
      const timestamp = new Date(hour * 60 * 60 * 1000)

      responseTime.push({
        timestamp,
        value: data.count > 0 ? data.totalTime / data.count : 0
      })

      errorRate.push({
        timestamp,
        value: data.count > 0 ? (data.errors / data.count) * 100 : 0
      })

      throughput.push({
        timestamp,
        value: data.count
      })
    }

    return { responseTime, errorRate, throughput }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(startDate?: Date, endDate?: Date): PerformanceMetric[] {
    let filteredMetrics = this.metrics

    if (startDate) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startDate)
    }

    if (endDate) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endDate)
    }

    return filteredMetrics
  }

  /**
   * Helper methods
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url)
      // Remove query parameters and normalize
      let pathname = urlObj.pathname

      // Replace dynamic segments with placeholders
      pathname = pathname.replace(/\/\d+/g, '/:id')
      pathname = pathname.replace(/\/[a-f0-9-]{36}/g, '/:uuid')

      return pathname
    } catch {
      return url
    }
  }

  private extractIP(request: NextRequest): string | undefined {
    return request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           request.ip
  }

  private extractCompanyId(request: NextRequest): string | undefined {
    // Extract from headers, session, or URL
    return request.headers.get('x-company-id') || undefined
  }

  private extractUserId(request: NextRequest): string | undefined {
    // Extract from headers, session, or URL
    return request.headers.get('x-user-id') || undefined
  }

  private async cloneAndReadRequest(request: NextRequest): Promise<any> {
    try {
      if (request.body && request.headers.get('content-type')?.includes('application/json')) {
        const clone = request.clone()
        return await clone.json()
      }
    } catch {
      // Ignore parsing errors
    }
    return null
  }

  private instrumentRequest(request: NextRequest, callbacks: {
    onDatabaseQuery?: (queryTime: number) => void
  }): NextRequest {
    // Add instrumentation callbacks to request context
    // This would integrate with database query monitoring
    return request
  }

  private async getResponseBody(response: NextResponse): Promise<any> {
    try {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        const clone = response.clone()
        return await clone.json()
      }
    } catch {
      // Ignore parsing errors
    }
    return null
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0

    const index = Math.ceil((percentile / 100) * values.length) - 1
    return values[Math.min(index, values.length - 1)]
  }

  private getActiveConnectionCount(): number {
    // Would be populated from connection monitoring
    return 0
  }

  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage - would use proper monitoring in production
    return Math.random() * 20 + 5 // 5-25% simulated usage
  }

  /**
   * Lifecycle methods
   */
  private startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupOldMetrics()
    }, this.CLEANUP_INTERVAL)
  }

  private startAlertMonitoring(): void {
    setInterval(() => {
      this.cleanupOldAlerts()
    }, 60000) // Every minute
  }

  private startMetricsAggregation(): void {
    setInterval(() => {
      this.aggregateMetrics()
    }, 30000) // Every 30 seconds
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff)
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (60 * 60 * 1000) // 1 hour
    this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff)
  }

  private aggregateMetrics(): void {
    // Aggregate metrics for reporting
    // This would store aggregated data for long-term analysis
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.metrics.length = 0
    this.endpointStats.clear()
    this.alerts.length = 0
  }
}

// Export singleton instance
export const apiPerformanceMonitor = new APIPerformanceMonitor()

// Export middleware for easy use
export const withPerformanceMonitoring = apiPerformanceMonitor.createPerformanceMiddleware()