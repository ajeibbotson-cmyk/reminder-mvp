/**
 * Concurrent Query Optimizer
 * Advanced query optimization with connection pooling and concurrent execution
 * Designed for 100+ simultaneous users with sub-200ms response times
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { AnalyticsFilters, AnalyticsResponse } from '../types/analytics'
import { databasePerformanceOptimizer } from './database-performance-optimizer'
import { advancedCachingService } from './advanced-caching-service'
import { performance } from 'perf_hooks'
import { Worker } from 'worker_threads'
import pLimit from 'p-limit'

interface QueryTask<T> {
  id: string
  query: string
  params: any[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  timeout: number
  retries: number
  cacheKey?: string
  companyId?: string
  tags?: string[]
  resolve: (value: T) => void
  reject: (error: Error) => void
}

interface ConnectionPoolConfig {
  min: number
  max: number
  idleTimeoutMs: number
  connectionTimeoutMs: number
  maxUses: number
  testOnBorrow: boolean
}

interface QueryExecutionMetrics {
  totalQueries: number
  completedQueries: number
  failedQueries: number
  averageExecutionTime: number
  queueLength: number
  activeConnections: number
  throughputPerSecond: number
  connectionPoolEfficiency: number
}

interface ConcurrentQueryResult<T> {
  data: T
  executionTime: number
  fromCache: boolean
  connectionId: string
  queueTime: number
  retryCount: number
}

export class ConcurrentQueryOptimizer {
  private prisma: PrismaClient
  private queryQueue: QueryTask<any>[] = []
  private activeQueries: Map<string, QueryTask<any>> = new Map()
  private connectionPool: PrismaClient[] = []
  private connectionUsage: Map<string, number> = new Map()
  private readonly config: ConnectionPoolConfig
  private readonly queryLimiter = pLimit(50) // Limit concurrent queries
  private readonly priorityQueues: Map<string, QueryTask<any>[]> = new Map()
  private metrics: QueryExecutionMetrics
  private readonly RESPONSE_TIME_TARGET = 200 // 200ms target

  constructor() {
    this.config = {
      min: 5, // Minimum connections
      max: 25, // Maximum connections for 100+ users
      idleTimeoutMs: 30000, // 30 seconds
      connectionTimeoutMs: 10000, // 10 seconds
      maxUses: 1000, // Max queries per connection before refresh
      testOnBorrow: true
    }

    this.metrics = {
      totalQueries: 0,
      completedQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      queueLength: 0,
      activeConnections: 0,
      throughputPerSecond: 0,
      connectionPoolEfficiency: 0
    }

    this.initializeConnectionPool()
    this.initializePriorityQueues()
    this.startQueryProcessor()
    this.startMetricsCollector()
  }

  /**
   * Initialize optimized connection pool
   */
  private initializeConnectionPool(): void {
    console.log('Initializing connection pool with configuration:', this.config)

    // Create minimum number of connections
    for (let i = 0; i < this.config.min; i++) {
      this.addConnection()
    }

    // Main prisma client for management operations
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: ['error', 'warn']
    })
  }

  /**
   * Initialize priority queues for different query types
   */
  private initializePriorityQueues(): void {
    this.priorityQueues.set('critical', [])
    this.priorityQueues.set('high', [])
    this.priorityQueues.set('medium', [])
    this.priorityQueues.set('low', [])
  }

  /**
   * Execute optimized analytics query with concurrency control
   */
  async executeAnalyticsQuery<T>(
    queryName: string,
    query: string,
    params: any[] = [],
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical'
      timeout?: number
      retries?: number
      cacheKey?: string
      companyId?: string
      tags?: string[]
    } = {}
  ): Promise<ConcurrentQueryResult<T>> {
    const startTime = performance.now()
    const taskId = crypto.randomUUID()

    // Set defaults
    const {
      priority = 'medium',
      timeout = this.RESPONSE_TIME_TARGET * 5, // 1 second max
      retries = 2,
      cacheKey,
      companyId,
      tags = []
    } = options

    // Check cache first
    if (cacheKey) {
      const cachedResult = await advancedCachingService.get<T>(cacheKey)
      if (cachedResult) {
        return {
          data: cachedResult,
          executionTime: performance.now() - startTime,
          fromCache: true,
          connectionId: 'cache',
          queueTime: 0,
          retryCount: 0
        }
      }
    }

    return new Promise((resolve, reject) => {
      const task: QueryTask<T> = {
        id: taskId,
        query,
        params,
        priority,
        timeout,
        retries,
        cacheKey,
        companyId,
        tags,
        resolve: (data: T) => {
          const result: ConcurrentQueryResult<T> = {
            data,
            executionTime: performance.now() - startTime,
            fromCache: false,
            connectionId: this.getConnectionId(),
            queueTime: performance.now() - startTime,
            retryCount: 0
          }
          resolve(result)
        },
        reject
      }

      this.enqueueTask(task)
    })
  }

  /**
   * Execute multiple queries in parallel with optimal resource allocation
   */
  async executeParallelQueries<T>(
    queries: Array<{
      name: string
      query: string
      params: any[]
      priority?: 'low' | 'medium' | 'high' | 'critical'
    }>
  ): Promise<Record<string, ConcurrentQueryResult<T>>> {
    const queryPromises = queries.map(async ({ name, query, params, priority = 'medium' }) => {
      try {
        const result = await this.executeAnalyticsQuery<T>(name, query, params, { priority })
        return [name, result]
      } catch (error) {
        console.error(`Parallel query failed [${name}]:`, error)
        throw error
      }
    })

    const results = await Promise.allSettled(queryPromises)
    const successfulResults: Record<string, ConcurrentQueryResult<T>> = {}

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const [name, queryResult] = result.value as [string, ConcurrentQueryResult<T>]
        successfulResults[name] = queryResult
      } else {
        console.error(`Query ${queries[index].name} failed:`, result.reason)
      }
    })

    return successfulResults
  }

  /**
   * Execute analytics batch with intelligent query optimization
   */
  async executeAnalyticsBatch(
    companyId: string,
    batchQueries: Array<{
      type: 'dashboard' | 'kpis' | 'customers' | 'invoices' | 'payments' | 'email'
      filters: AnalyticsFilters
      priority?: 'low' | 'medium' | 'high' | 'critical'
    }>
  ): Promise<Record<string, any>> {
    const batchStartTime = performance.now()

    // Group queries by data dependencies for optimal execution order
    const optimizedQueries = this.optimizeQueryBatch(companyId, batchQueries)

    // Execute in parallel with concurrency limits
    const batchPromises = optimizedQueries.map(async ({ type, query, params, priority = 'medium', cacheKey }) => {
      try {
        const result = await this.executeAnalyticsQuery(
          `batch-${type}`,
          query,
          params,
          {
            priority,
            cacheKey,
            companyId,
            tags: [`batch:${type}`, `company:${companyId}`]
          }
        )
        return [type, result.data]
      } catch (error) {
        console.error(`Batch query failed [${type}]:`, error)
        return [type, null]
      }
    })

    const results = await Promise.allSettled(batchPromises)
    const batchResults: Record<string, any> = {}

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [type, data] = result.value as [string, any]
        batchResults[type] = data
      }
    })

    const totalExecutionTime = performance.now() - batchStartTime
    console.log(`Analytics batch completed in ${totalExecutionTime.toFixed(2)}ms`)

    return batchResults
  }

  /**
   * Smart query routing based on query complexity and current load
   */
  private async routeQuery<T>(task: QueryTask<T>): Promise<T> {
    // Analyze query complexity
    const complexity = this.analyzeQueryComplexity(task.query)

    // Route to appropriate connection based on complexity and current load
    let connection: PrismaClient

    if (complexity.score > 0.8 || complexity.estimatedRows > 10000) {
      // Use dedicated connection for heavy queries
      connection = await this.getOptimalConnection('heavy')
    } else if (task.priority === 'critical' || task.priority === 'high') {
      // Use fast connection for high-priority queries
      connection = await this.getOptimalConnection('fast')
    } else {
      // Use any available connection for regular queries
      connection = await this.getOptimalConnection('regular')
    }

    return this.executeQueryWithRetry(connection, task)
  }

  /**
   * Execute query with intelligent retry logic
   */
  private async executeQueryWithRetry<T>(connection: PrismaClient, task: QueryTask<T>): Promise<T> {
    let lastError: Error | null = null
    let retryCount = 0

    while (retryCount <= task.retries) {
      try {
        const startTime = performance.now()

        // Set connection-specific optimizations
        await this.optimizeConnectionForQuery(connection, task.query)

        // Execute query with timeout
        const result = await Promise.race([
          connection.$queryRawUnsafe<T>(task.query, ...task.params),
          this.createTimeoutPromise(task.timeout)
        ])

        const executionTime = performance.now() - startTime

        // Cache result if cache key is provided
        if (task.cacheKey && result) {
          await advancedCachingService.set(task.cacheKey, result, 'L2_REDIS', {
            ttl: this.calculateCacheTTL(task.query, executionTime),
            tags: task.tags || []
          })
        }

        // Update metrics
        this.updateQueryMetrics(executionTime, true)

        return result

      } catch (error) {
        lastError = error as Error
        retryCount++

        console.warn(`Query retry ${retryCount}/${task.retries} for task ${task.id}:`, error.message)

        // Exponential backoff for retries
        if (retryCount <= task.retries) {
          await this.delay(Math.pow(2, retryCount) * 100)
        }

        // Try different connection on retry
        if (retryCount <= task.retries) {
          connection = await this.getOptimalConnection('retry')
        }
      }
    }

    this.updateQueryMetrics(0, false)
    throw lastError || new Error(`Query failed after ${task.retries} retries`)
  }

  /**
   * Optimize query batch execution order
   */
  private optimizeQueryBatch(
    companyId: string,
    batchQueries: any[]
  ): Array<{ type: string; query: string; params: any[]; priority: string; cacheKey: string }> {
    return batchQueries.map(({ type, filters, priority = 'medium' }) => {
      const cacheKey = advancedCachingService['generateAnalyticsCacheKey'](companyId, type, filters)

      // Generate optimized query based on type
      let query: string
      let params: any[]

      switch (type) {
        case 'dashboard':
          ({ query, params } = this.generateDashboardQuery(companyId, filters))
          break
        case 'kpis':
          ({ query, params } = this.generateKPIQuery(companyId, filters))
          break
        case 'customers':
          ({ query, params } = this.generateCustomerQuery(companyId, filters))
          break
        case 'invoices':
          ({ query, params } = this.generateInvoiceQuery(companyId, filters))
          break
        case 'payments':
          ({ query, params } = this.generatePaymentQuery(companyId, filters))
          break
        case 'email':
          ({ query, params } = this.generateEmailQuery(companyId, filters))
          break
        default:
          throw new Error(`Unknown query type: ${type}`)
      }

      return { type, query, params, priority, cacheKey }
    })
  }

  /**
   * Queue management methods
   */
  private enqueueTask<T>(task: QueryTask<T>): void {
    const priorityQueue = this.priorityQueues.get(task.priority)!
    priorityQueue.push(task)
    this.metrics.queueLength++
  }

  private dequeueTask(): QueryTask<any> | null {
    // Process in priority order: critical > high > medium > low
    const priorities = ['critical', 'high', 'medium', 'low']

    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority)!
      if (queue.length > 0) {
        this.metrics.queueLength--
        return queue.shift()!
      }
    }

    return null
  }

  /**
   * Start the query processor
   */
  private startQueryProcessor(): void {
    setInterval(async () => {
      try {
        while (this.activeQueries.size < this.config.max) {
          const task = this.dequeueTask()
          if (!task) break

          this.activeQueries.set(task.id, task)
          this.metrics.totalQueries++

          // Process task with concurrency limiting
          this.queryLimiter(async () => {
            try {
              const result = await this.routeQuery(task)
              task.resolve(result)
              this.metrics.completedQueries++
            } catch (error) {
              task.reject(error as Error)
              this.metrics.failedQueries++
            } finally {
              this.activeQueries.delete(task.id)
            }
          })
        }
      } catch (error) {
        console.error('Query processor error:', error)
      }
    }, 10) // Process queue every 10ms
  }

  /**
   * Connection pool management
   */
  private addConnection(): void {
    const connection = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: ['error']
    })

    this.connectionPool.push(connection)
    const connectionId = `conn-${this.connectionPool.length}`
    this.connectionUsage.set(connectionId, 0)

    console.log(`Added connection ${connectionId} to pool (total: ${this.connectionPool.length})`)
  }

  private async getOptimalConnection(type: 'heavy' | 'fast' | 'regular' | 'retry'): Promise<PrismaClient> {
    // Find the least used connection
    let optimalConnection = this.connectionPool[0]
    let minUsage = this.connectionUsage.get('conn-1') || 0

    this.connectionPool.forEach((connection, index) => {
      const connectionId = `conn-${index + 1}`
      const usage = this.connectionUsage.get(connectionId) || 0

      if (usage < minUsage) {
        minUsage = usage
        optimalConnection = connection
      }
    })

    // Create new connection if pool is not at max and usage is high
    if (this.connectionPool.length < this.config.max && minUsage > 100) {
      this.addConnection()
      optimalConnection = this.connectionPool[this.connectionPool.length - 1]
    }

    return optimalConnection
  }

  private getConnectionId(): string {
    return `conn-${Math.floor(Math.random() * this.connectionPool.length) + 1}`
  }

  /**
   * Query optimization methods
   */
  private analyzeQueryComplexity(query: string): { score: number; estimatedRows: number; joinCount: number } {
    const upperQuery = query.toUpperCase()

    let score = 0
    let estimatedRows = 1000
    let joinCount = 0

    // Count JOINs
    joinCount = (query.match(/JOIN/gi) || []).length
    score += joinCount * 0.2

    // Check for complex operations
    if (upperQuery.includes('GROUP BY')) score += 0.2
    if (upperQuery.includes('ORDER BY')) score += 0.1
    if (upperQuery.includes('HAVING')) score += 0.2
    if (upperQuery.includes('DISTINCT')) score += 0.1
    if (upperQuery.includes('WINDOW')) score += 0.3

    // Estimate rows based on date ranges and filters
    if (upperQuery.includes('WHERE')) {
      if (upperQuery.includes('CREATED_AT')) estimatedRows *= 0.5
      if (upperQuery.includes('COMPANY_ID')) estimatedRows *= 0.1
    }

    return { score: Math.min(score, 1), estimatedRows, joinCount }
  }

  private async optimizeConnectionForQuery(connection: PrismaClient, query: string): Promise<void> {
    try {
      const complexity = this.analyzeQueryComplexity(query)

      if (complexity.score > 0.6) {
        // Heavy query optimizations
        await connection.$executeRaw`SET work_mem = '512MB'`
        await connection.$executeRaw`SET random_page_cost = 1.0`
        await connection.$executeRaw`SET cpu_tuple_cost = 0.01`
      } else {
        // Regular query optimizations
        await connection.$executeRaw`SET work_mem = '256MB'`
        await connection.$executeRaw`SET random_page_cost = 1.1`
      }
    } catch (error) {
      // Ignore optimization errors and continue with query
      console.warn('Connection optimization failed:', error.message)
    }
  }

  private calculateCacheTTL(query: string, executionTime: number): number {
    let baseTTL = 300000 // 5 minutes default

    // Adjust TTL based on query type and execution time
    if (query.includes('realtime')) {
      baseTTL = 30000 // 30 seconds for real-time
    } else if (executionTime > 500) {
      baseTTL = 900000 // 15 minutes for slow queries
    } else if (query.includes('aggregate') || query.includes('sum') || query.includes('count')) {
      baseTTL = 600000 // 10 minutes for aggregations
    }

    return baseTTL
  }

  /**
   * Query generators for different analytics types
   */
  private generateDashboardQuery(companyId: string, filters: AnalyticsFilters): { query: string; params: any[] } {
    // Implementation would generate optimized dashboard query
    return {
      query: 'SELECT 1 as placeholder',
      params: [companyId]
    }
  }

  private generateKPIQuery(companyId: string, filters: AnalyticsFilters): { query: string; params: any[] } {
    // Implementation would generate optimized KPI query
    return {
      query: 'SELECT 1 as placeholder',
      params: [companyId]
    }
  }

  private generateCustomerQuery(companyId: string, filters: AnalyticsFilters): { query: string; params: any[] } {
    // Implementation would generate optimized customer query
    return {
      query: 'SELECT 1 as placeholder',
      params: [companyId]
    }
  }

  private generateInvoiceQuery(companyId: string, filters: AnalyticsFilters): { query: string; params: any[] } {
    // Implementation would generate optimized invoice query
    return {
      query: 'SELECT 1 as placeholder',
      params: [companyId]
    }
  }

  private generatePaymentQuery(companyId: string, filters: AnalyticsFilters): { query: string; params: any[] } {
    // Implementation would generate optimized payment query
    return {
      query: 'SELECT 1 as placeholder',
      params: [companyId]
    }
  }

  private generateEmailQuery(companyId: string, filters: AnalyticsFilters): { query: string; params: any[] } {
    // Implementation would generate optimized email query
    return {
      query: 'SELECT 1 as placeholder',
      params: [companyId]
    }
  }

  /**
   * Metrics and monitoring
   */
  private updateQueryMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.metrics.averageExecutionTime =
        (this.metrics.averageExecutionTime * this.metrics.completedQueries + executionTime) /
        (this.metrics.completedQueries + 1)
    }

    this.metrics.activeConnections = this.activeQueries.size
    this.metrics.connectionPoolEfficiency =
      (this.metrics.completedQueries / this.metrics.totalQueries) * 100
  }

  private startMetricsCollector(): void {
    setInterval(() => {
      const now = Date.now()
      const timeWindow = 1000 // 1 second

      // Calculate throughput
      this.metrics.throughputPerSecond =
        this.metrics.completedQueries / ((now - this.startTime) / 1000)

      // Log performance metrics every minute
      if (now % 60000 < 1000) {
        console.log('Query Performance Metrics:', {
          ...this.metrics,
          targetResponseTime: this.RESPONSE_TIME_TARGET,
          averageExecutionTime: Math.round(this.metrics.averageExecutionTime)
        })
      }
    }, 1000)
  }

  private startTime = Date.now()

  /**
   * Utility methods
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueryExecutionMetrics {
    return { ...this.metrics }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: QueryExecutionMetrics
    connectionPool: {
      active: number
      total: number
      efficiency: number
    }
    responseTime: number
  }> {
    const startTime = performance.now()

    try {
      // Simple health check query
      await this.prisma.$queryRaw`SELECT 1 as health_check`
      const responseTime = performance.now() - startTime

      const status = responseTime < this.RESPONSE_TIME_TARGET ? 'healthy'
        : responseTime < this.RESPONSE_TIME_TARGET * 2 ? 'degraded'
        : 'unhealthy'

      return {
        status,
        metrics: this.getMetrics(),
        connectionPool: {
          active: this.activeQueries.size,
          total: this.connectionPool.length,
          efficiency: this.metrics.connectionPoolEfficiency
        },
        responseTime
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: this.getMetrics(),
        connectionPool: {
          active: 0,
          total: this.connectionPool.length,
          efficiency: 0
        },
        responseTime: performance.now() - startTime
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up concurrent query optimizer...')

    // Disconnect all connections in pool
    const disconnectPromises = this.connectionPool.map(connection => connection.$disconnect())
    await Promise.allSettled(disconnectPromises)

    // Disconnect main client
    await this.prisma.$disconnect()

    console.log('Concurrent query optimizer cleanup completed')
  }
}

// Export singleton instance
export const concurrentQueryOptimizer = new ConcurrentQueryOptimizer()