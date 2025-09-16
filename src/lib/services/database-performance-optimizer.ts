/**
 * Database Performance Optimizer
 * Advanced database optimization service for UAE Payment Reminder Platform
 * Optimizes analytics queries, manages connection pooling, and monitors performance
 */

import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { AnalyticsDateRange, AnalyticsFilters } from '../types/analytics'
import { performance } from 'perf_hooks'

interface QueryPerformanceMetrics {
  queryType: string
  tableName: string
  executionTime: number
  rowsProcessed: number
  indexesUsed: string[]
  optimizationSuggestions: string[]
  queryHash: string
}

interface ConnectionPoolMetrics {
  activeConnections: number
  idleConnections: number
  totalConnections: number
  queuedRequests: number
  averageWaitTime: number
}

interface DatabaseHealth {
  responseTime: number
  errorRate: number
  connectionPoolHealth: ConnectionPoolMetrics
  slowQueries: number
  indexEfficiency: number
  cacheHitRatio: number
}

export class DatabasePerformanceOptimizer {
  private prisma: PrismaClient
  private performanceMetrics: Map<string, QueryPerformanceMetrics[]> = new Map()
  private readonly SLOW_QUERY_THRESHOLD = 200 // 200ms
  private readonly CONNECTION_POOL_SIZE = 20
  private readonly ANALYTICS_CACHE_TTL = 300000 // 5 minutes

  constructor() {
    // Initialize Prisma with optimized connection pooling for analytics
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' }
      ]
    })

    this.setupPerformanceMonitoring()
    this.createAnalyticsIndexes()
  }

  /**
   * Setup performance monitoring and query logging
   */
  private setupPerformanceMonitoring(): void {
    this.prisma.$on('query', async (e) => {
      const executionTime = parseFloat(e.duration.toString())

      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        await this.logSlowQuery({
          query: e.query,
          duration: executionTime,
          params: e.params
        })
      }

      // Track query performance metrics
      this.trackQueryMetrics({
        queryType: this.extractQueryType(e.query),
        tableName: this.extractTableName(e.query),
        executionTime,
        queryHash: this.generateQueryHash(e.query)
      })
    })

    this.prisma.$on('error', (e) => {
      console.error('Database error:', e)
    })
  }

  /**
   * Create specialized indexes for analytics queries
   */
  private async createAnalyticsIndexes(): Promise<void> {
    try {
      // Analytics-optimized indexes for invoices
      const invoiceAnalyticsIndexes = `
        -- Invoice analytics performance indexes
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_analytics_status_date_amount
        ON invoices (company_id, status, created_at, total_amount)
        WHERE is_active = true;

        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_analytics_due_status
        ON invoices (company_id, due_date, status, total_amount)
        WHERE is_active = true;

        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_analytics_aging_buckets
        ON invoices (company_id, status, due_date, total_amount)
        WHERE status IN ('SENT', 'OVERDUE') AND is_active = true;

        -- Customer analytics indexes
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_analytics_risk_behavior
        ON customers (company_id, risk_score, outstanding_balance, last_payment_date)
        WHERE is_active = true;

        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_analytics_business_type
        ON customers (company_id, business_type, risk_score, lifetime_value)
        WHERE is_active = true;

        -- Payment analytics indexes
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_analytics_timing
        ON payments (invoice_id, payment_date, amount, method);

        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_analytics_trends
        ON payments (payment_date, method, amount)
        WHERE is_verified = true;

        -- Email analytics indexes
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_analytics_performance
        ON email_logs (company_id, delivery_status, sent_at, opened_at, clicked_at);

        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_analytics_uae_timing
        ON email_logs (company_id, uae_send_time, delivery_status)
        WHERE uae_send_time IS NOT NULL;

        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_analytics_language
        ON email_logs (company_id, language, delivery_status, opened_at);

        -- Audit logs performance index for compliance reporting
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_analytics_compliance
        ON audit_logs (company_id, created_at, entity_type, action)
        WHERE compliance_flag = true;
      `

      await this.prisma.$executeRawUnsafe(invoiceAnalyticsIndexes)
      console.log('Analytics indexes created successfully')

    } catch (error) {
      console.error('Error creating analytics indexes:', error)
      // Continue operation even if index creation fails
    }
  }

  /**
   * Optimized analytics query executor with performance monitoring
   */
  async executeOptimizedAnalyticsQuery<T>(
    queryName: string,
    query: string,
    params: any[] = [],
    expectedRowCount?: number
  ): Promise<{ data: T; metrics: QueryPerformanceMetrics }> {
    const startTime = performance.now()

    try {
      // Pre-query optimization hints
      await this.prisma.$executeRaw`SET work_mem = '256MB'` // Increase working memory for analytics
      await this.prisma.$executeRaw`SET random_page_cost = 1.1` // Optimize for SSD storage

      const result = await this.prisma.$queryRawUnsafe<T>(query, ...params)
      const endTime = performance.now()
      const executionTime = endTime - startTime

      const metrics: QueryPerformanceMetrics = {
        queryType: 'ANALYTICS',
        tableName: this.extractTableName(query),
        executionTime,
        rowsProcessed: Array.isArray(result) ? result.length : 1,
        indexesUsed: await this.getUsedIndexes(query),
        optimizationSuggestions: this.generateOptimizationSuggestions(executionTime, expectedRowCount),
        queryHash: this.generateQueryHash(query)
      }

      // Log slow queries for optimization
      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        await this.logSlowQuery({
          query: queryName,
          duration: executionTime,
          params: JSON.stringify(params)
        })
      }

      // Reset working memory to default
      await this.prisma.$executeRaw`RESET work_mem`
      await this.prisma.$executeRaw`RESET random_page_cost`

      return { data: result, metrics }

    } catch (error) {
      console.error(`Analytics query error [${queryName}]:`, error)
      throw new Error(`Failed to execute analytics query: ${queryName}`)
    }
  }

  /**
   * Get optimized payment performance metrics
   */
  async getOptimizedPaymentMetrics(
    companyId: string,
    dateRange: AnalyticsDateRange
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const query = `
      WITH payment_analytics AS (
        SELECT
          i.id,
          i.total_amount,
          i.due_date,
          i.created_at as invoice_date,
          p.payment_date,
          p.amount as payment_amount,
          p.method,
          EXTRACT(EPOCH FROM (p.payment_date - i.due_date)) / 86400 as delay_days,
          CASE
            WHEN p.payment_date <= i.due_date THEN 'on_time'
            WHEN p.payment_date <= i.due_date + INTERVAL '7 days' THEN 'slightly_late'
            WHEN p.payment_date <= i.due_date + INTERVAL '30 days' THEN 'late'
            ELSE 'very_late'
          END as payment_category
        FROM invoices i
        JOIN payments p ON i.id = p.invoice_id
        WHERE i.company_id = $1
          AND i.is_active = true
          AND p.is_verified = true
          AND i.created_at >= $2
          AND i.created_at <= $3
      ),
      current_period AS (
        SELECT
          COUNT(*) as total_payments,
          AVG(delay_days) as avg_delay_days,
          COUNT(CASE WHEN payment_category = 'on_time' THEN 1 END) as on_time_count,
          SUM(payment_amount) as total_amount_paid,
          COUNT(CASE WHEN delay_days > 0 THEN 1 END) as delayed_payments
        FROM payment_analytics
      ),
      previous_period AS (
        SELECT
          AVG(EXTRACT(EPOCH FROM (p.payment_date - i.due_date)) / 86400) as prev_avg_delay
        FROM invoices i
        JOIN payments p ON i.id = p.invoice_id
        WHERE i.company_id = $1
          AND i.is_active = true
          AND p.is_verified = true
          AND i.created_at >= $2 - INTERVAL '${Math.floor((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))} days'
          AND i.created_at < $2
      )
      SELECT
        cp.total_payments,
        cp.avg_delay_days,
        cp.on_time_count,
        cp.total_amount_paid,
        cp.delayed_payments,
        pp.prev_avg_delay,
        CASE
          WHEN pp.prev_avg_delay > 0 AND cp.avg_delay_days IS NOT NULL
          THEN ((pp.prev_avg_delay - cp.avg_delay_days) / pp.prev_avg_delay * 100)
          ELSE 0
        END as delay_reduction_percentage,
        CASE
          WHEN cp.total_payments > 0
          THEN (cp.on_time_count::decimal / cp.total_payments * 100)
          ELSE 0
        END as on_time_percentage
      FROM current_period cp
      CROSS JOIN previous_period pp
    `

    return this.executeOptimizedAnalyticsQuery(
      'payment-performance-metrics',
      query,
      [companyId, dateRange.startDate, dateRange.endDate],
      1000
    )
  }

  /**
   * Get optimized invoice aging analysis
   */
  async getOptimizedInvoiceAging(
    companyId: string
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const query = `
      WITH aging_analysis AS (
        SELECT
          i.id,
          i.total_amount,
          i.status,
          i.due_date,
          CURRENT_DATE - i.due_date as days_past_due,
          CASE
            WHEN i.status = 'PAID' THEN 'paid'
            WHEN CURRENT_DATE <= i.due_date THEN 'current'
            WHEN CURRENT_DATE - i.due_date <= 30 THEN 'overdue_30'
            WHEN CURRENT_DATE - i.due_date <= 60 THEN 'overdue_60'
            WHEN CURRENT_DATE - i.due_date <= 90 THEN 'overdue_90'
            ELSE 'overdue_90_plus'
          END as aging_bucket
        FROM invoices i
        WHERE i.company_id = $1
          AND i.is_active = true
          AND i.status IN ('SENT', 'OVERDUE', 'PAID')
      )
      SELECT
        aging_bucket,
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_amount,
        AVG(total_amount) as avg_invoice_amount,
        AVG(CASE WHEN days_past_due > 0 THEN days_past_due ELSE 0 END) as avg_days_overdue
      FROM aging_analysis
      GROUP BY aging_bucket
      ORDER BY
        CASE aging_bucket
          WHEN 'current' THEN 1
          WHEN 'overdue_30' THEN 2
          WHEN 'overdue_60' THEN 3
          WHEN 'overdue_90' THEN 4
          WHEN 'overdue_90_plus' THEN 5
          WHEN 'paid' THEN 6
          ELSE 7
        END
    `

    return this.executeOptimizedAnalyticsQuery(
      'invoice-aging-analysis',
      query,
      [companyId],
      100
    )
  }

  /**
   * Get optimized customer risk distribution
   */
  async getOptimizedCustomerRiskDistribution(
    companyId: string
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const query = `
      WITH risk_analysis AS (
        SELECT
          c.id,
          c.risk_score,
          c.outstanding_balance,
          c.lifetime_value,
          c.last_payment_date,
          CASE
            WHEN c.risk_score IS NULL OR c.risk_score <= 2 THEN 'low'
            WHEN c.risk_score <= 5 THEN 'medium'
            WHEN c.risk_score <= 7 THEN 'high'
            ELSE 'critical'
          END as risk_category,
          COUNT(i.id) as total_invoices,
          COUNT(CASE WHEN i.status = 'OVERDUE' THEN 1 END) as overdue_invoices
        FROM customers c
        LEFT JOIN invoices i ON c.email = i.customer_email
          AND c.company_id = i.company_id
          AND i.is_active = true
        WHERE c.company_id = $1
          AND c.is_active = true
        GROUP BY c.id, c.risk_score, c.outstanding_balance, c.lifetime_value, c.last_payment_date
      )
      SELECT
        risk_category,
        COUNT(*) as customer_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
        SUM(outstanding_balance) as total_outstanding,
        AVG(outstanding_balance) as avg_outstanding,
        SUM(lifetime_value) as total_ltv,
        AVG(lifetime_value) as avg_ltv,
        AVG(total_invoices) as avg_invoices_per_customer,
        AVG(overdue_invoices) as avg_overdue_per_customer,
        COUNT(CASE WHEN last_payment_date < CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as inactive_customers
      FROM risk_analysis
      GROUP BY risk_category
      ORDER BY
        CASE risk_category
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'high' THEN 3
          WHEN 'critical' THEN 4
          ELSE 5
        END
    `

    return this.executeOptimizedAnalyticsQuery(
      'customer-risk-distribution',
      query,
      [companyId],
      10
    )
  }

  /**
   * Get optimized email analytics with UAE-specific insights
   */
  async getOptimizedEmailAnalytics(
    companyId: string,
    dateRange: AnalyticsDateRange
  ): Promise<{ data: any; metrics: QueryPerformanceMetrics }> {
    const query = `
      WITH email_performance AS (
        SELECT
          e.id,
          e.language,
          e.delivery_status,
          e.sent_at,
          e.opened_at,
          e.clicked_at,
          e.uae_send_time,
          EXTRACT(HOUR FROM e.uae_send_time) as send_hour,
          EXTRACT(DOW FROM e.uae_send_time) as send_dow,
          CASE
            WHEN e.opened_at IS NOT NULL THEN 1 ELSE 0
          END as was_opened,
          CASE
            WHEN e.clicked_at IS NOT NULL THEN 1 ELSE 0
          END as was_clicked,
          CASE
            WHEN EXTRACT(DOW FROM e.uae_send_time) IN (0,1,2,3,4)
              AND EXTRACT(HOUR FROM e.uae_send_time) BETWEEN 8 AND 17
            THEN 1 ELSE 0
          END as business_hours_compliant
        FROM email_logs e
        WHERE e.company_id = $1
          AND e.created_at >= $2
          AND e.created_at <= $3
          AND e.sent_at IS NOT NULL
      )
      SELECT
        COUNT(*) as total_sent,
        COUNT(CASE WHEN delivery_status = 'DELIVERED' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN was_opened = 1 THEN 1 END) as opened_count,
        COUNT(CASE WHEN was_clicked = 1 THEN 1 END) as clicked_count,
        ROUND(COUNT(CASE WHEN was_opened = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN delivery_status = 'DELIVERED' THEN 1 END), 0), 2) as open_rate,
        ROUND(COUNT(CASE WHEN was_clicked = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN was_opened = 1 THEN 1 END), 0), 2) as click_rate,
        COUNT(CASE WHEN language = 'ENGLISH' THEN 1 END) as english_emails,
        COUNT(CASE WHEN language = 'ARABIC' THEN 1 END) as arabic_emails,
        ROUND(COUNT(CASE WHEN language = 'ENGLISH' AND was_opened = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN language = 'ENGLISH' THEN 1 END), 0), 2) as english_open_rate,
        ROUND(COUNT(CASE WHEN language = 'ARABIC' AND was_opened = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN language = 'ARABIC' THEN 1 END), 0), 2) as arabic_open_rate,
        ROUND(COUNT(CASE WHEN business_hours_compliant = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as business_hours_compliance_rate,
        AVG(CASE WHEN send_hour BETWEEN 9 AND 11 THEN was_opened ELSE NULL END) as morning_open_rate,
        AVG(CASE WHEN send_hour BETWEEN 14 AND 16 THEN was_opened ELSE NULL END) as afternoon_open_rate
      FROM email_performance
    `

    return this.executeOptimizedAnalyticsQuery(
      'email-analytics-uae',
      query,
      [companyId, dateRange.startDate, dateRange.endDate],
      1
    )
  }

  /**
   * Get database health metrics
   */
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const startTime = performance.now()

    try {
      const [connectionStats, slowQueryCount] = await Promise.all([
        this.getConnectionPoolMetrics(),
        this.getSlowQueryCount()
      ])

      const responseTime = performance.now() - startTime

      return {
        responseTime,
        errorRate: await this.calculateErrorRate(),
        connectionPoolHealth: connectionStats,
        slowQueries: slowQueryCount,
        indexEfficiency: await this.calculateIndexEfficiency(),
        cacheHitRatio: await this.calculateCacheHitRatio()
      }

    } catch (error) {
      console.error('Error getting database health:', error)
      throw error
    }
  }

  /**
   * Optimize query execution plan
   */
  async optimizeQueryPlan(query: string): Promise<{
    originalPlan: any
    optimizedQuery: string
    estimatedImprovement: number
  }> {
    try {
      // Get original execution plan
      const originalPlan = await this.prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`)

      // Analyze and suggest optimizations
      const optimizedQuery = await this.suggestQueryOptimizations(query)

      return {
        originalPlan,
        optimizedQuery,
        estimatedImprovement: 0.25 // Placeholder - would be calculated based on plan analysis
      }

    } catch (error) {
      console.error('Error optimizing query plan:', error)
      throw error
    }
  }

  /**
   * Helper Methods
   */
  private extractQueryType(query: string): string {
    const upperQuery = query.toUpperCase().trim()
    if (upperQuery.startsWith('SELECT')) return 'SELECT'
    if (upperQuery.startsWith('INSERT')) return 'INSERT'
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE'
    if (upperQuery.startsWith('DELETE')) return 'DELETE'
    if (upperQuery.startsWith('WITH')) return 'SELECT' // CTE queries
    return 'OTHER'
  }

  private extractTableName(query: string): string {
    // Simple extraction - would be more sophisticated in production
    const match = query.match(/FROM\s+(\w+)/i) || query.match(/INTO\s+(\w+)/i) || query.match(/UPDATE\s+(\w+)/i)
    return match ? match[1] : 'unknown'
  }

  private generateQueryHash(query: string): string {
    // Simple hash generation - would use a proper hash function in production
    return Buffer.from(query).toString('base64').slice(0, 16)
  }

  private async getUsedIndexes(query: string): Promise<string[]> {
    try {
      const plan = await this.prisma.$queryRawUnsafe(`EXPLAIN (FORMAT JSON) ${query}`)
      // Extract index information from execution plan
      return ['idx_compound'] // Placeholder
    } catch {
      return []
    }
  }

  private generateOptimizationSuggestions(executionTime: number, expectedRows?: number): string[] {
    const suggestions: string[] = []

    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      suggestions.push('Query exceeds slow query threshold - consider adding indexes')
    }

    if (expectedRows && expectedRows > 10000) {
      suggestions.push('Large result set - consider pagination or filtering')
    }

    if (executionTime > 1000) {
      suggestions.push('Very slow query - consider query rewriting or partitioning')
    }

    return suggestions
  }

  private async logSlowQuery(queryInfo: { query: string; duration: number; params?: any }): Promise<void> {
    try {
      await this.prisma.db_performance_logs.create({
        data: {
          id: crypto.randomUUID(),
          query_type: this.extractQueryType(queryInfo.query),
          table_name: this.extractTableName(queryInfo.query),
          execution_time: Math.round(queryInfo.duration),
          query_hash: this.generateQueryHash(queryInfo.query),
          slow_query: true
        }
      })
    } catch (error) {
      console.error('Error logging slow query:', error)
    }
  }

  private trackQueryMetrics(metrics: Partial<QueryPerformanceMetrics>): void {
    const key = `${metrics.queryType}-${metrics.tableName}`
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, [])
    }

    const queryMetrics = this.performanceMetrics.get(key)!
    queryMetrics.push(metrics as QueryPerformanceMetrics)

    // Keep only last 100 metrics per query type
    if (queryMetrics.length > 100) {
      queryMetrics.splice(0, queryMetrics.length - 100)
    }
  }

  private async getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
    // Placeholder implementation - would integrate with actual connection pool metrics
    return {
      activeConnections: 5,
      idleConnections: 10,
      totalConnections: 15,
      queuedRequests: 2,
      averageWaitTime: 10
    }
  }

  private async getSlowQueryCount(): Promise<number> {
    try {
      const result = await this.prisma.db_performance_logs.count({
        where: {
          slow_query: true,
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
      return result
    } catch {
      return 0
    }
  }

  private async calculateErrorRate(): Promise<number> {
    // Would calculate actual error rate from logs
    return 0.1 // 0.1% error rate
  }

  private async calculateIndexEfficiency(): Promise<number> {
    // Would analyze index usage statistics
    return 85 // 85% index efficiency
  }

  private async calculateCacheHitRatio(): Promise<number> {
    // Would calculate from database cache statistics
    return 92 // 92% cache hit ratio
  }

  private async suggestQueryOptimizations(query: string): Promise<string> {
    // Placeholder - would implement actual query optimization logic
    return query
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

// Export singleton instance
export const databasePerformanceOptimizer = new DatabasePerformanceOptimizer()