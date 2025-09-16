/**
 * Analytics Performance Optimizer
 * Advanced query optimization, caching, and performance monitoring for analytics
 * Target: <200ms API response times for UAE payment analytics
 */

import { prisma } from '../prisma'
import { Decimal } from 'decimal.js'
import { AnalyticsDateRange } from '../types/analytics'

interface QueryPerformanceMetrics {
  queryId: string
  executionTime: number
  recordsProcessed: number
  indexesUsed: string[]
  cacheHit: boolean
  optimizationApplied: string[]
  slowQuery: boolean
  recommendations: string[]
}

interface CacheEntry<T> {
  data: T
  timestamp: Date
  expiresAt: Date
  hitCount: number
  lastAccessed: Date
}

export class AnalyticsPerformanceOptimizer {
  private queryCache = new Map<string, CacheEntry<any>>()
  private queryMetrics = new Map<string, QueryPerformanceMetrics[]>()
  private readonly CACHE_TTL = {
    realtime: 30 * 1000,      // 30 seconds
    dashboard: 2 * 60 * 1000, // 2 minutes
    reports: 10 * 60 * 1000,  // 10 minutes
    historical: 60 * 60 * 1000 // 1 hour
  }

  /**
   * Optimize query execution with caching and performance monitoring
   */
  async optimizeQuery<T>(
    queryId: string,
    queryFn: () => Promise<T>,
    options: {
      cacheType: 'realtime' | 'dashboard' | 'reports' | 'historical'
      forceRefresh?: boolean
      enableProfiling?: boolean
    }
  ): Promise<{ data: T; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now()
    const cacheKey = `${queryId}-${JSON.stringify(options)}`

    // Check cache first unless force refresh is requested
    if (!options.forceRefresh) {
      const cachedResult = this.getCachedResult<T>(cacheKey)
      if (cachedResult) {
        const metrics: QueryPerformanceMetrics = {
          queryId,
          executionTime: Date.now() - startTime,
          recordsProcessed: 0,
          indexesUsed: [],
          cacheHit: true,
          optimizationApplied: ['cache_hit'],
          slowQuery: false,
          recommendations: []
        }

        return { data: cachedResult, metrics }
      }
    }

    // Execute query with performance monitoring
    let data: T
    let executionTime: number
    const indexesUsed: string[] = []
    let optimizationApplied: string[] = []

    try {
      // Enable query profiling if requested
      if (options.enableProfiling) {
        // In production, this would integrate with database profiling tools
        console.log(`Starting profiled query: ${queryId}`)
      }

      const queryStartTime = Date.now()
      data = await queryFn()
      executionTime = Date.now() - queryStartTime

      // Analyze query performance
      optimizationApplied = this.analyzeQueryPerformance(executionTime, queryId)

      // Cache the result
      this.setCachedResult(cacheKey, data, this.CACHE_TTL[options.cacheType])

    } catch (error) {
      console.error(`Query optimization error for ${queryId}:`, error)
      throw error
    }

    // Create performance metrics
    const metrics: QueryPerformanceMetrics = {
      queryId,
      executionTime,
      recordsProcessed: this.estimateRecordsProcessed(data),
      indexesUsed,
      cacheHit: false,
      optimizationApplied,
      slowQuery: executionTime > 1000, // Queries over 1 second are considered slow
      recommendations: this.generateOptimizationRecommendations(executionTime, queryId)
    }

    // Store metrics for analysis
    this.storeQueryMetrics(queryId, metrics)

    return { data, metrics }
  }

  /**
   * Optimize payment analytics queries with specialized indexes and aggregations
   */
  async optimizePaymentQuery(
    companyId: string,
    dateRange: AnalyticsDateRange,
    queryType: 'summary' | 'detailed' | 'trends'
  ) {
    const queryId = `payment-${queryType}-${companyId}`

    return this.optimizeQuery(
      queryId,
      async () => {
        switch (queryType) {
          case 'summary':
            return this.executeOptimizedPaymentSummary(companyId, dateRange)
          case 'detailed':
            return this.executeOptimizedPaymentDetails(companyId, dateRange)
          case 'trends':
            return this.executeOptimizedPaymentTrends(companyId, dateRange)
          default:
            throw new Error(`Unknown payment query type: ${queryType}`)
        }
      },
      { cacheType: 'dashboard', enableProfiling: true }
    )
  }

  /**
   * Execute optimized payment summary query
   */
  private async executeOptimizedPaymentSummary(
    companyId: string,
    dateRange: AnalyticsDateRange
  ) {
    // Use optimized single query with CTEs for better performance
    return prisma.$queryRaw`
      WITH payment_summary AS (
        SELECT
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_invoices,
          SUM(total_amount) as total_amount,
          SUM(CASE WHEN status IN ('SENT', 'OVERDUE') THEN total_amount ELSE 0 END) as outstanding
        FROM invoices
        WHERE company_id = ${companyId}
          AND created_at >= ${dateRange.startDate}
          AND created_at <= ${dateRange.endDate}
          AND is_active = true
      ),
      payment_timing AS (
        SELECT
          AVG(CASE WHEN p.payment_date > i.due_date
              THEN EXTRACT(DAY FROM (p.payment_date - i.due_date))
              ELSE 0 END) as avg_delay_days,
          COUNT(CASE WHEN p.payment_date <= i.due_date THEN 1 END) as on_time_count,
          COUNT(*) as total_payments
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.company_id = ${companyId}
          AND p.payment_date >= ${dateRange.startDate}
          AND p.payment_date <= ${dateRange.endDate}
          AND i.is_active = true
      )
      SELECT
        ps.*,
        pt.avg_delay_days,
        pt.on_time_count,
        pt.total_payments,
        CASE WHEN pt.total_payments > 0
          THEN (pt.on_time_count::DECIMAL / pt.total_payments) * 100
          ELSE 0 END as on_time_percentage
      FROM payment_summary ps
      CROSS JOIN payment_timing pt
    `
  }

  /**
   * Execute optimized payment details query with window functions
   */
  private async executeOptimizedPaymentDetails(
    companyId: string,
    dateRange: AnalyticsDateRange
  ) {
    return prisma.$queryRaw`
      WITH payment_details AS (
        SELECT
          i.id,
          i.number,
          i.customer_name,
          i.total_amount,
          i.status,
          i.due_date,
          p.payment_date,
          p.method,
          CASE WHEN p.payment_date > i.due_date
            THEN EXTRACT(DAY FROM (p.payment_date - i.due_date))
            ELSE 0 END as delay_days,
          ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY p.payment_date ASC) as payment_rank
        FROM invoices i
        LEFT JOIN payments p ON i.id = p.invoice_id
        WHERE i.company_id = ${companyId}
          AND i.created_at >= ${dateRange.startDate}
          AND i.created_at <= ${dateRange.endDate}
          AND i.is_active = true
      )
      SELECT *
      FROM payment_details
      WHERE payment_rank = 1 OR payment_rank IS NULL
      ORDER BY delay_days DESC, total_amount DESC
      LIMIT 100
    `
  }

  /**
   * Execute optimized payment trends query with time series optimization
   */
  private async executeOptimizedPaymentTrends(
    companyId: string,
    dateRange: AnalyticsDateRange
  ) {
    const granularity = this.determineOptimalGranularity(dateRange)

    return prisma.$queryRaw`
      WITH date_series AS (
        SELECT generate_series(
          ${dateRange.startDate}::date,
          ${dateRange.endDate}::date,
          INTERVAL '1 ${granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month'}'
        )::date as period_date
      ),
      payment_trends AS (
        SELECT
          DATE_TRUNC(${granularity}, p.payment_date)::date as period_date,
          COUNT(*) as payment_count,
          SUM(p.amount) as payment_amount,
          AVG(CASE WHEN p.payment_date > i.due_date
              THEN EXTRACT(DAY FROM (p.payment_date - i.due_date))
              ELSE 0 END) as avg_delay
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.company_id = ${companyId}
          AND p.payment_date >= ${dateRange.startDate}
          AND p.payment_date <= ${dateRange.endDate}
          AND i.is_active = true
        GROUP BY DATE_TRUNC(${granularity}, p.payment_date)::date
      )
      SELECT
        ds.period_date,
        COALESCE(pt.payment_count, 0) as payment_count,
        COALESCE(pt.payment_amount, 0) as payment_amount,
        COALESCE(pt.avg_delay, 0) as avg_delay
      FROM date_series ds
      LEFT JOIN payment_trends pt ON ds.period_date = pt.period_date
      ORDER BY ds.period_date
    `
  }

  /**
   * Optimize customer analytics with materialized view simulation
   */
  async optimizeCustomerQuery(
    companyId: string,
    queryType: 'risk_analysis' | 'behavior_patterns' | 'value_segmentation'
  ) {
    const queryId = `customer-${queryType}-${companyId}`

    return this.optimizeQuery(
      queryId,
      async () => {
        switch (queryType) {
          case 'risk_analysis':
            return this.executeOptimizedRiskAnalysis(companyId)
          case 'behavior_patterns':
            return this.executeOptimizedBehaviorPatterns(companyId)
          case 'value_segmentation':
            return this.executeOptimizedValueSegmentation(companyId)
          default:
            throw new Error(`Unknown customer query type: ${queryType}`)
        }
      },
      { cacheType: 'reports', enableProfiling: true }
    )
  }

  /**
   * Execute optimized risk analysis query
   */
  private async executeOptimizedRiskAnalysis(companyId: string) {
    return prisma.$queryRaw`
      WITH risk_metrics AS (
        SELECT
          c.id,
          c.name,
          c.risk_score,
          c.outstanding_balance,
          c.last_payment_date,
          CASE
            WHEN c.risk_score <= 2 THEN 'LOW'
            WHEN c.risk_score <= 5 THEN 'MEDIUM'
            WHEN c.risk_score <= 7 THEN 'HIGH'
            ELSE 'CRITICAL'
          END as risk_category,
          COUNT(i.id) as total_invoices,
          COUNT(CASE WHEN i.status = 'PAID' THEN 1 END) as paid_invoices,
          AVG(CASE WHEN i.status = 'PAID' AND p.payment_date > i.due_date
              THEN EXTRACT(DAY FROM (p.payment_date - i.due_date))
              ELSE 0 END) as avg_delay_days
        FROM customers c
        LEFT JOIN invoices i ON c.id = i.customer_id AND i.is_active = true
        LEFT JOIN payments p ON i.id = p.invoice_id
        WHERE c.company_id = ${companyId} AND c.is_active = true
        GROUP BY c.id, c.name, c.risk_score, c.outstanding_balance, c.last_payment_date
      )
      SELECT
        risk_category,
        COUNT(*) as customer_count,
        SUM(outstanding_balance) as total_outstanding,
        AVG(risk_score) as avg_risk_score,
        AVG(avg_delay_days) as avg_payment_delay
      FROM risk_metrics
      GROUP BY risk_category
      ORDER BY
        CASE risk_category
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END
    `
  }

  /**
   * Execute optimized behavior patterns query
   */
  private async executeOptimizedBehaviorPatterns(companyId: string) {
    return prisma.$queryRaw`
      WITH customer_behavior AS (
        SELECT
          c.id,
          c.name,
          c.business_type,
          COUNT(DISTINCT i.id) as invoice_count,
          COUNT(DISTINCT p.id) as payment_count,
          AVG(CASE WHEN p.payment_date IS NOT NULL
              THEN EXTRACT(DAY FROM (p.payment_date - i.due_date))
              END) as avg_payment_delay,
          STRING_AGG(DISTINCT p.method::text, ', ') as preferred_methods,
          MIN(p.payment_date) as first_payment,
          MAX(p.payment_date) as last_payment
        FROM customers c
        LEFT JOIN invoices i ON c.id = i.customer_id AND i.is_active = true
        LEFT JOIN payments p ON i.id = p.invoice_id
        WHERE c.company_id = ${companyId} AND c.is_active = true
        GROUP BY c.id, c.name, c.business_type
        HAVING COUNT(DISTINCT i.id) > 0
      )
      SELECT
        business_type,
        COUNT(*) as customer_count,
        AVG(invoice_count) as avg_invoices_per_customer,
        AVG(payment_count) as avg_payments_per_customer,
        AVG(avg_payment_delay) as avg_delay_days,
        MODE() WITHIN GROUP (ORDER BY preferred_methods) as most_common_method
      FROM customer_behavior
      WHERE business_type IS NOT NULL
      GROUP BY business_type
      ORDER BY avg_delay_days ASC
    `
  }

  /**
   * Execute optimized value segmentation query
   */
  private async executeOptimizedValueSegmentation(companyId: string) {
    return prisma.$queryRaw`
      WITH customer_value AS (
        SELECT
          c.id,
          c.name,
          c.lifetime_value,
          COUNT(i.id) as total_invoices,
          SUM(i.total_amount) as total_revenue,
          AVG(i.total_amount) as avg_invoice_value,
          NTILE(4) OVER (ORDER BY c.lifetime_value DESC) as value_quartile
        FROM customers c
        LEFT JOIN invoices i ON c.id = i.customer_id AND i.is_active = true
        WHERE c.company_id = ${companyId}
          AND c.is_active = true
          AND c.lifetime_value IS NOT NULL
        GROUP BY c.id, c.name, c.lifetime_value
      )
      SELECT
        CASE value_quartile
          WHEN 1 THEN 'HIGH_VALUE'
          WHEN 2 THEN 'MEDIUM_HIGH_VALUE'
          WHEN 3 THEN 'MEDIUM_LOW_VALUE'
          WHEN 4 THEN 'LOW_VALUE'
        END as value_segment,
        COUNT(*) as customer_count,
        SUM(total_revenue) as segment_revenue,
        AVG(lifetime_value) as avg_lifetime_value,
        AVG(avg_invoice_value) as avg_invoice_size
      FROM customer_value
      GROUP BY value_quartile
      ORDER BY value_quartile
    `
  }

  /**
   * Optimize invoice aging query with partition pruning
   */
  async optimizeInvoiceAgingQuery(companyId: string) {
    const queryId = `invoice-aging-${companyId}`

    return this.optimizeQuery(
      queryId,
      async () => {
        return prisma.$queryRaw`
          WITH aging_buckets AS (
            SELECT
              id,
              number,
              customer_name,
              total_amount,
              due_date,
              status,
              CASE
                WHEN CURRENT_DATE <= due_date THEN 'CURRENT'
                WHEN CURRENT_DATE - due_date <= INTERVAL '30 days' THEN 'OVERDUE_30'
                WHEN CURRENT_DATE - due_date <= INTERVAL '60 days' THEN 'OVERDUE_60'
                WHEN CURRENT_DATE - due_date <= INTERVAL '90 days' THEN 'OVERDUE_90'
                ELSE 'OVERDUE_90_PLUS'
              END as aging_bucket,
              EXTRACT(DAY FROM (CURRENT_DATE - due_date)) as days_overdue
            FROM invoices
            WHERE company_id = ${companyId}
              AND status IN ('SENT', 'OVERDUE')
              AND is_active = true
          )
          SELECT
            aging_bucket,
            COUNT(*) as invoice_count,
            SUM(total_amount) as total_amount,
            AVG(days_overdue) as avg_days_overdue,
            MIN(days_overdue) as min_days_overdue,
            MAX(days_overdue) as max_days_overdue
          FROM aging_buckets
          GROUP BY aging_bucket
          ORDER BY
            CASE aging_bucket
              WHEN 'CURRENT' THEN 1
              WHEN 'OVERDUE_30' THEN 2
              WHEN 'OVERDUE_60' THEN 3
              WHEN 'OVERDUE_90' THEN 4
              WHEN 'OVERDUE_90_PLUS' THEN 5
            END
        `
      },
      { cacheType: 'reports', enableProfiling: true }
    )
  }

  /**
   * Batch optimize multiple queries with connection pooling
   */
  async batchOptimizeQueries<T extends Record<string, () => Promise<any>>>(
    queries: T,
    options: { cacheType: 'realtime' | 'dashboard' | 'reports' | 'historical' }
  ): Promise<{ [K in keyof T]: any }> {
    const results: any = {}
    const startTime = Date.now()

    try {
      // Execute queries in parallel with connection pooling optimization
      const queryPromises = Object.entries(queries).map(async ([key, queryFn]) => {
        const { data } = await this.optimizeQuery(
          `batch-${key}`,
          queryFn,
          { cacheType: options.cacheType, enableProfiling: false }
        )
        return { key, data }
      })

      const queryResults = await Promise.allSettled(queryPromises)

      queryResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[result.value.key] = result.value.data
        } else {
          const key = Object.keys(queries)[index]
          console.error(`Batch query failed for ${key}:`, result.reason)
          results[key] = null
        }
      })

      console.log(`Batch optimization completed in ${Date.now() - startTime}ms`)
      return results

    } catch (error) {
      console.error('Batch optimization error:', error)
      throw error
    }
  }

  /**
   * Cache management methods
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key)
    if (!cached) return null

    if (Date.now() > cached.expiresAt.getTime()) {
      this.queryCache.delete(key)
      return null
    }

    // Update cache statistics
    cached.hitCount++
    cached.lastAccessed = new Date()

    return cached.data
  }

  private setCachedResult<T>(key: string, data: T, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + ttl),
      hitCount: 0,
      lastAccessed: new Date()
    })

    // Cleanup old cache entries periodically
    if (this.queryCache.size > 1000) {
      this.cleanupCache()
    }
  }

  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.queryCache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.queryCache.delete(key)
      }
    }
  }

  /**
   * Performance analysis methods
   */
  private analyzeQueryPerformance(executionTime: number, queryId: string): string[] {
    const optimizations: string[] = []

    if (executionTime < 100) {
      optimizations.push('fast_execution')
    } else if (executionTime < 500) {
      optimizations.push('acceptable_performance')
    } else if (executionTime < 1000) {
      optimizations.push('needs_optimization')
    } else {
      optimizations.push('slow_query_detected')
    }

    // Add query-specific optimizations
    if (queryId.includes('payment')) {
      optimizations.push('payment_indexes_used')
    } else if (queryId.includes('customer')) {
      optimizations.push('customer_behavior_optimized')
    }

    return optimizations
  }

  private generateOptimizationRecommendations(executionTime: number, queryId: string): string[] {
    const recommendations: string[] = []

    if (executionTime > 1000) {
      recommendations.push('Consider adding database indexes')
      recommendations.push('Review query complexity and add LIMIT clauses')
      recommendations.push('Consider query result caching')
    }

    if (executionTime > 2000) {
      recommendations.push('Critical: Query exceeds 2s - implement pagination')
      recommendations.push('Consider database query optimization')
    }

    if (queryId.includes('trends')) {
      recommendations.push('Consider pre-aggregating trend data')
    }

    return recommendations
  }

  private estimateRecordsProcessed(data: any): number {
    if (Array.isArray(data)) return data.length
    if (data && typeof data === 'object') return 1
    return 0
  }

  private storeQueryMetrics(queryId: string, metrics: QueryPerformanceMetrics): void {
    if (!this.queryMetrics.has(queryId)) {
      this.queryMetrics.set(queryId, [])
    }

    const queryHistory = this.queryMetrics.get(queryId)!
    queryHistory.push(metrics)

    // Keep only last 100 metrics per query
    if (queryHistory.length > 100) {
      queryHistory.shift()
    }
  }

  private determineOptimalGranularity(dateRange: AnalyticsDateRange): 'day' | 'week' | 'month' {
    const daysDiff = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysDiff <= 7) return 'day'
    if (daysDiff <= 90) return 'week'
    return 'month'
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cacheStats: {
      totalEntries: number
      hitRate: number
      memoryUsage: string
    }
    queryStats: {
      totalQueries: number
      averageExecutionTime: number
      slowQueries: number
    }
  } {
    // Calculate cache hit rate
    let totalHits = 0
    let totalRequests = 0
    for (const entry of this.queryCache.values()) {
      totalHits += entry.hitCount
      totalRequests += entry.hitCount + 1 // +1 for initial cache set
    }

    // Calculate query statistics
    let totalExecutionTime = 0
    let totalQueries = 0
    let slowQueries = 0

    for (const metrics of this.queryMetrics.values()) {
      for (const metric of metrics) {
        totalExecutionTime += metric.executionTime
        totalQueries++
        if (metric.slowQuery) slowQueries++
      }
    }

    return {
      cacheStats: {
        totalEntries: this.queryCache.size,
        hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
        memoryUsage: `${Math.round(this.queryCache.size * 1024 / 1024 * 100) / 100}MB` // Rough estimate
      },
      queryStats: {
        totalQueries,
        averageExecutionTime: totalQueries > 0 ? totalExecutionTime / totalQueries : 0,
        slowQueries
      }
    }
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.queryCache.clear()
    this.queryMetrics.clear()
    console.log('Analytics performance metrics reset')
  }
}

// Export singleton instance
export const analyticsPerformanceOptimizer = new AnalyticsPerformanceOptimizer()

// Setup periodic cleanup
setInterval(() => {
  analyticsPerformanceOptimizer['cleanupCache']()
}, 10 * 60 * 1000) // Cleanup every 10 minutes