/**
 * Advanced Caching Service
 * Multi-tier caching system with Redis-compatible interface
 * Optimized for UAE Payment Reminder Platform analytics
 */

import { AnalyticsFilters, AnalyticsResponse } from '../types/analytics'
import { Decimal } from 'decimal.js'
import { LRUCache } from 'lru-cache'

interface CacheEntry<T> {
  data: T
  timestamp: Date
  expiresAt: Date
  hitCount: number
  lastAccessed: Date
  tags: string[]
}

interface CacheStats {
  hits: number
  misses: number
  hitRatio: number
  totalEntries: number
  memoryUsage: number
  evictions: number
}

interface CacheConfig {
  maxSize: number
  ttl: number
  maxAge: number
  tags?: string[]
  compression?: boolean
  priority?: 'low' | 'medium' | 'high'
}

// Cache tiers with different strategies
enum CacheTier {
  L1_MEMORY = 'L1_MEMORY', // In-memory LRU cache (fastest)
  L2_REDIS = 'L2_REDIS',   // Redis cache (shared across instances)
  L3_DATABASE = 'L3_DATABASE', // Database query result cache
  L4_CDN = 'L4_CDN'        // CDN cache for API responses
}

interface CacheTierConfig {
  [CacheTier.L1_MEMORY]: {
    maxSize: 1000
    ttl: 60000 // 1 minute
    enabled: true
  }
  [CacheTier.L2_REDIS]: {
    maxSize: 10000
    ttl: 300000 // 5 minutes
    enabled: boolean
  }
  [CacheTier.L3_DATABASE]: {
    maxSize: 50000
    ttl: 900000 // 15 minutes
    enabled: true
  }
  [CacheTier.L4_CDN]: {
    maxSize: 100000
    ttl: 1800000 // 30 minutes
    enabled: boolean
  }
}

export class AdvancedCachingService {
  private l1Cache: LRUCache<string, CacheEntry<any>>
  private stats: Map<CacheTier, CacheStats> = new Map()
  private readonly tierConfig: CacheTierConfig
  private cacheWarmupSchedule: Map<string, NodeJS.Timer> = new Map()
  private invalidationPatterns: Map<string, RegExp> = new Map()

  constructor() {
    this.tierConfig = {
      [CacheTier.L1_MEMORY]: {
        maxSize: 1000,
        ttl: 60000, // 1 minute for real-time data
        enabled: true
      },
      [CacheTier.L2_REDIS]: {
        maxSize: 10000,
        ttl: 300000, // 5 minutes for analytics
        enabled: process.env.REDIS_URL !== undefined
      },
      [CacheTier.L3_DATABASE]: {
        maxSize: 50000,
        ttl: 900000, // 15 minutes for aggregated data
        enabled: true
      },
      [CacheTier.L4_CDN]: {
        maxSize: 100000,
        ttl: 1800000, // 30 minutes for static analytics
        enabled: process.env.CDN_ENABLED === 'true'
      }
    }

    this.initializeCaches()
    this.setupInvalidationPatterns()
    this.scheduleWarmupTasks()
  }

  /**
   * Initialize cache tiers
   */
  private initializeCaches(): void {
    // L1 Memory Cache (LRU)
    this.l1Cache = new LRUCache<string, CacheEntry<any>>({
      max: this.tierConfig[CacheTier.L1_MEMORY].maxSize,
      ttl: this.tierConfig[CacheTier.L1_MEMORY].ttl,
      dispose: (value, key) => {
        this.trackEviction(CacheTier.L1_MEMORY)
      }
    })

    // Initialize stats for each tier
    Object.values(CacheTier).forEach(tier => {
      this.stats.set(tier, {
        hits: 0,
        misses: 0,
        hitRatio: 0,
        totalEntries: 0,
        memoryUsage: 0,
        evictions: 0
      })
    })
  }

  /**
   * Get cached data with multi-tier fallback
   */
  async get<T>(
    key: string,
    tier: CacheTier = CacheTier.L1_MEMORY,
    options?: {
      fallbackTiers?: CacheTier[]
      refreshOnMiss?: boolean
    }
  ): Promise<T | null> {
    const fallbackTiers = options?.fallbackTiers || this.getDefaultFallbackTiers(tier)

    // Try primary tier first
    const result = await this.getFromTier<T>(key, tier)
    if (result) {
      this.trackHit(tier)
      this.updateLastAccessed(key, tier)
      return result.data
    }

    // Try fallback tiers
    for (const fallbackTier of fallbackTiers) {
      const fallbackResult = await this.getFromTier<T>(key, fallbackTier)
      if (fallbackResult) {
        this.trackHit(fallbackTier)

        // Promote to higher tier for future access
        await this.set(key, fallbackResult.data, tier, {
          ttl: fallbackResult.expiresAt.getTime() - Date.now(),
          tags: fallbackResult.tags
        })

        return fallbackResult.data
      }
    }

    this.trackMiss(tier)
    return null
  }

  /**
   * Set cached data across tiers
   */
  async set<T>(
    key: string,
    data: T,
    tier: CacheTier = CacheTier.L1_MEMORY,
    config?: Partial<CacheConfig>
  ): Promise<void> {
    const cacheEntry: CacheEntry<T> = {
      data: this.serializeData(data),
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + (config?.ttl || this.tierConfig[tier].ttl)),
      hitCount: 0,
      lastAccessed: new Date(),
      tags: config?.tags || []
    }

    await this.setInTier(key, cacheEntry, tier)

    // Optionally replicate to other tiers
    if (config?.priority === 'high') {
      await this.replicateToTiers(key, cacheEntry, tier)
    }
  }

  /**
   * Cache analytics data with specialized handling
   */
  async cacheAnalytics<T>(
    companyId: string,
    queryType: string,
    filters: AnalyticsFilters,
    data: AnalyticsResponse<T>,
    tier: CacheTier = CacheTier.L2_REDIS
  ): Promise<void> {
    const cacheKey = this.generateAnalyticsCacheKey(companyId, queryType, filters)

    // Determine TTL based on data freshness and query type
    let ttl = this.tierConfig[tier].ttl

    if (queryType.includes('realtime')) {
      ttl = 30000 // 30 seconds for real-time data
    } else if (queryType.includes('dashboard')) {
      ttl = 120000 // 2 minutes for dashboard data
    } else if (queryType.includes('report')) {
      ttl = 900000 // 15 minutes for reports
    }

    const tags = [
      `company:${companyId}`,
      `query:${queryType}`,
      `date-range:${filters.dateRange.preset || 'custom'}`,
      'analytics'
    ]

    await this.set(cacheKey, data, tier, { ttl, tags })

    // Set up smart invalidation
    this.setupSmartInvalidation(companyId, queryType, cacheKey)
  }

  /**
   * Get cached analytics with intelligent fallback
   */
  async getCachedAnalytics<T>(
    companyId: string,
    queryType: string,
    filters: AnalyticsFilters,
    tier: CacheTier = CacheTier.L2_REDIS
  ): Promise<AnalyticsResponse<T> | null> {
    const cacheKey = this.generateAnalyticsCacheKey(companyId, queryType, filters)

    const cachedData = await this.get<AnalyticsResponse<T>>(cacheKey, tier, {
      fallbackTiers: this.getAnalyticsFallbackTiers(queryType),
      refreshOnMiss: this.shouldRefreshOnMiss(queryType)
    })

    if (cachedData) {
      // Enhance cached data with freshness information
      cachedData.metadata.cacheHit = true
      cachedData.metadata.freshness = new Date()
    }

    return cachedData
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern: string, tier?: CacheTier): Promise<number> {
    const regex = new RegExp(pattern)
    let invalidatedCount = 0

    if (!tier || tier === CacheTier.L1_MEMORY) {
      // Invalidate L1 cache
      const keysToDelete: string[] = []
      this.l1Cache.forEach((entry, key) => {
        if (regex.test(key)) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => {
        this.l1Cache.delete(key)
        invalidatedCount++
      })
    }

    // Invalidate other tiers if Redis is available
    if (this.tierConfig[CacheTier.L2_REDIS].enabled) {
      invalidatedCount += await this.invalidateRedisPattern(pattern)
    }

    return invalidatedCount
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[], tier?: CacheTier): Promise<number> {
    let invalidatedCount = 0

    if (!tier || tier === CacheTier.L1_MEMORY) {
      const keysToDelete: string[] = []
      this.l1Cache.forEach((entry, key) => {
        if (entry.tags.some(tag => tags.includes(tag))) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => {
        this.l1Cache.delete(key)
        invalidatedCount++
      })
    }

    return invalidatedCount
  }

  /**
   * Cache warming for frequently accessed data
   */
  async warmCache(
    companyId: string,
    dataTypes: string[] = ['dashboard', 'kpis', 'customers', 'invoices']
  ): Promise<void> {
    const warmupPromises = dataTypes.map(async (dataType) => {
      try {
        const filters: AnalyticsFilters = {
          dateRange: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            endDate: new Date(),
            preset: 'month'
          }
        }

        // Check if data is already cached
        const cacheKey = this.generateAnalyticsCacheKey(companyId, dataType, filters)
        const exists = await this.get(cacheKey)

        if (!exists) {
          console.log(`Warming cache for ${companyId}:${dataType}`)

          // This would trigger the actual data fetching
          // await analyticsService.getData(companyId, dataType, filters)

          // For now, create placeholder warm data
          await this.set(cacheKey, { warmed: true, timestamp: new Date() }, CacheTier.L2_REDIS, {
            ttl: this.tierConfig[CacheTier.L2_REDIS].ttl,
            tags: [`company:${companyId}`, `warmup:${dataType}`]
          })
        }
      } catch (error) {
        console.error(`Cache warming failed for ${dataType}:`, error)
      }
    })

    await Promise.allSettled(warmupPromises)
  }

  /**
   * UAE-specific cache optimizations
   */
  async optimizeForUAEBusinessHours(): Promise<void> {
    const now = new Date()
    const uaeHour = now.getUTCHours() + 4 // UAE is UTC+4
    const isBusinessHours = uaeHour >= 8 && uaeHour <= 18

    if (isBusinessHours) {
      // Reduce cache TTL during business hours for fresher data
      this.tierConfig[CacheTier.L1_MEMORY].ttl = 30000 // 30 seconds
      this.tierConfig[CacheTier.L2_REDIS].ttl = 120000 // 2 minutes
    } else {
      // Increase cache TTL outside business hours
      this.tierConfig[CacheTier.L1_MEMORY].ttl = 300000 // 5 minutes
      this.tierConfig[CacheTier.L2_REDIS].ttl = 900000 // 15 minutes
    }

    // Pre-warm caches before business hours start
    if (uaeHour === 7) { // 1 hour before business starts
      await this.preWarmForBusinessDay()
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): Record<CacheTier, CacheStats> {
    const stats: Record<CacheTier, CacheStats> = {} as any

    this.stats.forEach((tierStats, tier) => {
      const currentStats = { ...tierStats }

      // Calculate hit ratio
      currentStats.hitRatio = currentStats.hits + currentStats.misses > 0
        ? (currentStats.hits / (currentStats.hits + currentStats.misses)) * 100
        : 0

      // Update memory usage for L1 cache
      if (tier === CacheTier.L1_MEMORY) {
        currentStats.totalEntries = this.l1Cache.size
        currentStats.memoryUsage = this.calculateL1MemoryUsage()
      }

      stats[tier] = currentStats
    })

    return stats
  }

  /**
   * Cache health monitoring
   */
  async checkCacheHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy'
    tiers: Record<CacheTier, { status: string; issues: string[] }>
  }> {
    const tierHealth: Record<CacheTier, { status: string; issues: string[] }> = {} as any
    let healthyTiers = 0
    let totalTiers = 0

    for (const tier of Object.values(CacheTier)) {
      totalTiers++
      const issues: string[] = []
      const stats = this.stats.get(tier)!

      // Check hit ratio
      if (stats.hitRatio < 50) {
        issues.push(`Low hit ratio: ${stats.hitRatio.toFixed(1)}%`)
      }

      // Check if tier is responding
      try {
        await this.healthCheck(tier)
        if (issues.length === 0) {
          healthyTiers++
          tierHealth[tier] = { status: 'healthy', issues: [] }
        } else {
          tierHealth[tier] = { status: 'degraded', issues }
        }
      } catch (error) {
        tierHealth[tier] = {
          status: 'unhealthy',
          issues: [...issues, `Connection error: ${error.message}`]
        }
      }
    }

    const overallHealth = healthyTiers === totalTiers ? 'healthy'
      : healthyTiers > totalTiers / 2 ? 'degraded'
      : 'unhealthy'

    return { overall: overallHealth, tiers: tierHealth }
  }

  /**
   * Private helper methods
   */
  private async getFromTier<T>(key: string, tier: CacheTier): Promise<CacheEntry<T> | null> {
    switch (tier) {
      case CacheTier.L1_MEMORY:
        const entry = this.l1Cache.get(key)
        return entry && !this.isExpired(entry) ? entry as CacheEntry<T> : null

      case CacheTier.L2_REDIS:
        return await this.getFromRedis<T>(key)

      default:
        return null
    }
  }

  private async setInTier<T>(key: string, entry: CacheEntry<T>, tier: CacheTier): Promise<void> {
    switch (tier) {
      case CacheTier.L1_MEMORY:
        this.l1Cache.set(key, entry)
        break

      case CacheTier.L2_REDIS:
        await this.setInRedis(key, entry)
        break
    }

    // Update stats
    const stats = this.stats.get(tier)!
    stats.totalEntries++
  }

  private generateAnalyticsCacheKey(
    companyId: string,
    queryType: string,
    filters: AnalyticsFilters
  ): string {
    const filterHash = this.hashFilters(filters)
    return `analytics:${companyId}:${queryType}:${filterHash}`
  }

  private hashFilters(filters: AnalyticsFilters): string {
    const key = JSON.stringify({
      dateRange: filters.dateRange,
      customerIds: filters.customerIds?.sort(),
      invoiceStatus: filters.invoiceStatus?.sort(),
      businessTypes: filters.businessTypes?.sort(),
      granularity: filters.granularity
    })
    return Buffer.from(key).toString('base64').slice(0, 16)
  }

  private getDefaultFallbackTiers(primaryTier: CacheTier): CacheTier[] {
    switch (primaryTier) {
      case CacheTier.L1_MEMORY:
        return [CacheTier.L2_REDIS, CacheTier.L3_DATABASE]
      case CacheTier.L2_REDIS:
        return [CacheTier.L1_MEMORY, CacheTier.L3_DATABASE]
      default:
        return [CacheTier.L1_MEMORY]
    }
  }

  private getAnalyticsFallbackTiers(queryType: string): CacheTier[] {
    if (queryType.includes('realtime')) {
      return [CacheTier.L1_MEMORY]
    }
    return [CacheTier.L1_MEMORY, CacheTier.L2_REDIS, CacheTier.L3_DATABASE]
  }

  private shouldRefreshOnMiss(queryType: string): boolean {
    return queryType.includes('realtime') || queryType.includes('dashboard')
  }

  private serializeData<T>(data: T): T {
    // Handle Decimal serialization and other complex types
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (value instanceof Decimal) {
        return { __type: 'Decimal', value: value.toString() }
      }
      return value
    }))
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt.getTime()
  }

  private trackHit(tier: CacheTier): void {
    const stats = this.stats.get(tier)!
    stats.hits++
  }

  private trackMiss(tier: CacheTier): void {
    const stats = this.stats.get(tier)!
    stats.misses++
  }

  private trackEviction(tier: CacheTier): void {
    const stats = this.stats.get(tier)!
    stats.evictions++
  }

  private updateLastAccessed(key: string, tier: CacheTier): void {
    if (tier === CacheTier.L1_MEMORY) {
      const entry = this.l1Cache.get(key)
      if (entry) {
        entry.hitCount++
        entry.lastAccessed = new Date()
      }
    }
  }

  private calculateL1MemoryUsage(): number {
    // Estimate memory usage of L1 cache
    let totalSize = 0
    this.l1Cache.forEach((entry) => {
      totalSize += JSON.stringify(entry).length * 2 // Rough estimate
    })
    return totalSize
  }

  private setupInvalidationPatterns(): void {
    this.invalidationPatterns.set('payment', /analytics:.*:.*payment.*/i)
    this.invalidationPatterns.set('invoice', /analytics:.*:.*invoice.*/i)
    this.invalidationPatterns.set('customer', /analytics:.*:.*customer.*/i)
    this.invalidationPatterns.set('dashboard', /analytics:.*:dashboard.*/i)
  }

  private setupSmartInvalidation(companyId: string, queryType: string, cacheKey: string): void {
    // Set up automatic invalidation based on data dependencies
    // This would integrate with database change streams or webhook events
  }

  private scheduleWarmupTasks(): void {
    // Schedule cache warming during off-peak hours (UAE time)
    const warmupInterval = setInterval(async () => {
      try {
        await this.optimizeForUAEBusinessHours()

        const now = new Date()
        const uaeHour = now.getUTCHours() + 4

        // Warm cache at 6 AM UAE time (before business starts)
        if (uaeHour === 6) {
          console.log('Starting automated cache warmup for UAE business hours')
          // This would warm caches for all active companies
          // await this.warmAllActiveCaches()
        }
      } catch (error) {
        console.error('Cache warmup task failed:', error)
      }
    }, 60 * 60 * 1000) // Check every hour

    // Store reference for cleanup
    this.cacheWarmupSchedule.set('hourly-warmup', warmupInterval)
  }

  private async preWarmForBusinessDay(): Promise<void> {
    console.log('Pre-warming caches for UAE business day')
    // Implementation would warm caches for the most accessed data
  }

  private async replicateToTiers<T>(key: string, entry: CacheEntry<T>, sourceTier: CacheTier): Promise<void> {
    // Replicate high-priority data to multiple tiers
    const targetTiers = Object.values(CacheTier).filter(tier =>
      tier !== sourceTier && this.tierConfig[tier].enabled
    )

    const replicationPromises = targetTiers.map(tier =>
      this.setInTier(key, entry, tier).catch(error =>
        console.warn(`Failed to replicate to ${tier}:`, error)
      )
    )

    await Promise.allSettled(replicationPromises)
  }

  private async getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
    // Redis implementation placeholder
    // Would use actual Redis client here
    return null
  }

  private async setInRedis<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Redis implementation placeholder
    // Would use actual Redis client here
  }

  private async invalidateRedisPattern(pattern: string): Promise<number> {
    // Redis pattern invalidation placeholder
    return 0
  }

  private async healthCheck(tier: CacheTier): Promise<void> {
    switch (tier) {
      case CacheTier.L1_MEMORY:
        // L1 is always available
        return

      case CacheTier.L2_REDIS:
        if (this.tierConfig[tier].enabled) {
          // Would ping Redis here
          return
        }
        break

      default:
        return
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear scheduled tasks
    this.cacheWarmupSchedule.forEach(timer => clearInterval(timer))
    this.cacheWarmupSchedule.clear()

    // Clear caches
    this.l1Cache.clear()

    // Disconnect from Redis if connected
    // await this.redisClient?.disconnect()
  }
}

// Export singleton instance
export const advancedCachingService = new AdvancedCachingService()