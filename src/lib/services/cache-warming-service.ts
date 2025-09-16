/**
 * Cache Warming Service
 * Intelligent cache warming and invalidation system for analytics data
 * Optimized for UAE business patterns and multi-tenant architecture
 */

import { AnalyticsFilters, DashboardAnalytics } from '../types/analytics'
import { advancedCachingService } from './advanced-caching-service'
import { concurrentQueryOptimizer } from './concurrent-query-optimizer'
import { uaeOptimizationService } from './uae-optimization-service'
import { kpiCalculationEngine } from './kpi-calculation-engine'
import { analyticsAggregationService } from './analytics-aggregation-service'
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns'

interface WarmupTask {
  id: string
  companyId: string
  taskType: 'dashboard' | 'kpis' | 'customers' | 'invoices' | 'payments' | 'email' | 'reports'
  filters: AnalyticsFilters
  priority: 'low' | 'medium' | 'high' | 'critical'
  scheduledTime: Date
  estimatedDuration: number
  dependencies: string[] // Other task IDs that must complete first
  retryCount: number
  maxRetries: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  completedAt?: Date
  error?: string
}

interface WarmupSchedule {
  companyId: string
  schedule: Array<{
    time: string // HH:mm format
    taskTypes: string[]
    priority: 'low' | 'medium' | 'high'
    conditions: {
      businessDaysOnly: boolean
      avoidPrayerTimes: boolean
      skipDuringRamadan: boolean
    }
  }>
  timezone: string
  enabled: boolean
}

interface InvalidationRule {
  id: string
  name: string
  trigger: 'data_change' | 'time_based' | 'manual' | 'event_based'
  patterns: string[] // Cache key patterns to invalidate
  conditions: {
    entityTypes?: string[] // invoice, payment, customer, etc.
    companyIds?: string[]
    delayMs?: number // Delay before invalidation
    cascadeInvalidation?: boolean
  }
  priority: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
}

interface WarmupMetrics {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  averageExecutionTime: number
  cacheHitImprovementRatio: number
  systemResourceUsage: {
    cpu: number
    memory: number
    database: number
  }
  businessImpact: {
    responseTimeImprovement: number
    userExperienceScore: number
    systemLoadReduction: number
  }
}

export class CacheWarmingService {
  private warmupTasks: Map<string, WarmupTask> = new Map()
  private warmupSchedules: Map<string, WarmupSchedule> = new Map()
  private invalidationRules: Map<string, InvalidationRule> = new Map()
  private activeWarmups = new Set<string>()
  private metrics: WarmupMetrics
  private readonly MAX_CONCURRENT_WARMUPS = 5
  private readonly WARMUP_TIMEOUT = 300000 // 5 minutes

  constructor() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      cacheHitImprovementRatio: 0,
      systemResourceUsage: { cpu: 0, memory: 0, database: 0 },
      businessImpact: { responseTimeImprovement: 0, userExperienceScore: 0, systemLoadReduction: 0 }
    }

    this.initializeDefaultSchedules()
    this.initializeInvalidationRules()
    this.startWarmupProcessor()
    this.startMetricsCollector()
  }

  /**
   * Schedule cache warmup for a company with intelligent timing
   */
  async scheduleWarmup(
    companyId: string,
    taskTypes: WarmupTask['taskType'][],
    options: {
      priority?: WarmupTask['priority']
      scheduledTime?: Date
      filters?: Partial<AnalyticsFilters>
      dependencies?: string[]
    } = {}
  ): Promise<string[]> {
    const taskIds: string[] = []

    // Get optimal timing based on UAE business patterns
    const optimalTiming = await uaeOptimizationService.isOptimalTimeForOperation('query')
    const scheduledTime = options.scheduledTime || (optimalTiming.optimal ? new Date() : optimalTiming.nextOptimalTime)

    for (const taskType of taskTypes) {
      const taskId = crypto.randomUUID()

      // Generate appropriate filters for the task type
      const filters = await this.generateOptimalFilters(companyId, taskType, options.filters)

      const task: WarmupTask = {
        id: taskId,
        companyId,
        taskType,
        filters,
        priority: options.priority || 'medium',
        scheduledTime: scheduledTime || new Date(),
        estimatedDuration: this.estimateWarmupDuration(taskType),
        dependencies: options.dependencies || [],
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        createdAt: new Date()
      }

      this.warmupTasks.set(taskId, task)
      taskIds.push(taskId)
    }

    this.metrics.totalTasks += taskIds.length
    console.log(`Scheduled ${taskIds.length} warmup tasks for company ${companyId}`)

    return taskIds
  }

  /**
   * Execute intelligent cache warmup based on usage patterns
   */
  async executeIntelligentWarmup(companyId: string): Promise<{
    tasksScheduled: number
    estimatedCompletionTime: Date
    cacheStrategy: any
  }> {
    // Analyze usage patterns to determine what to warm up
    const usagePatterns = await this.analyzeUsagePatterns(companyId)
    const businessContext = await uaeOptimizationService.getCurrentOptimization()

    // Prioritize warmup tasks based on usage and business context
    const taskTypes = this.prioritizeWarmupTasks(usagePatterns, businessContext)

    // Create optimal filters for each task type
    const warmupPromises = taskTypes.map(async taskType => {
      const filters = await this.generateOptimalFilters(companyId, taskType)

      return this.scheduleWarmup(companyId, [taskType], {
        priority: this.determinePriority(taskType, usagePatterns),
        filters
      })
    })

    const results = await Promise.allSettled(warmupPromises)
    const allTaskIds = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => (result as PromiseFulfilledResult<string[]>).value)

    // Calculate estimated completion time
    const totalEstimatedDuration = allTaskIds.reduce((sum, taskId) => {
      const task = this.warmupTasks.get(taskId)
      return sum + (task?.estimatedDuration || 0)
    }, 0)

    const estimatedCompletionTime = new Date(Date.now() + totalEstimatedDuration)

    // Get cache strategy recommendations
    const cacheStrategy = await this.getCacheStrategyRecommendations(companyId, businessContext)

    return {
      tasksScheduled: allTaskIds.length,
      estimatedCompletionTime,
      cacheStrategy
    }
  }

  /**
   * Pre-warm cache before UAE business hours
   */
  async preWarmForBusinessDay(companyId?: string): Promise<{
    companiesWarmed: number
    tasksExecuted: number
    errors: string[]
  }> {
    const errors: string[] = []
    let companiesWarmed = 0
    let tasksExecuted = 0

    try {
      // Get list of active companies to warm up
      const companies = companyId ? [companyId] : await this.getActiveCompanies()

      for (const company of companies) {
        try {
          // Check if company needs warming based on usage patterns
          const needsWarming = await this.shouldWarmCompany(company)

          if (needsWarming) {
            const result = await this.executeIntelligentWarmup(company)
            tasksExecuted += result.tasksScheduled
            companiesWarmed++

            console.log(`Pre-warmed cache for company ${company}: ${result.tasksScheduled} tasks`)
          }

        } catch (error) {
          const errorMessage = `Failed to warm cache for company ${company}: ${error.message}`
          errors.push(errorMessage)
          console.error(errorMessage)
        }
      }

    } catch (error) {
      errors.push(`Pre-warming process failed: ${error.message}`)
      console.error('Pre-warming process failed:', error)
    }

    return { companiesWarmed, tasksExecuted, errors }
  }

  /**
   * Invalidate cache based on data changes
   */
  async invalidateByDataChange(
    entityType: string,
    entityId: string,
    companyId: string,
    changeType: 'create' | 'update' | 'delete'
  ): Promise<{
    rulesTriggered: number
    cacheKeysInvalidated: number
    cascadeInvalidations: number
  }> {
    let rulesTriggered = 0
    let cacheKeysInvalidated = 0
    let cascadeInvalidations = 0

    // Find applicable invalidation rules
    const applicableRules = Array.from(this.invalidationRules.values()).filter(rule =>
      rule.enabled &&
      rule.trigger === 'data_change' &&
      (!rule.conditions.entityTypes || rule.conditions.entityTypes.includes(entityType)) &&
      (!rule.conditions.companyIds || rule.conditions.companyIds.includes(companyId))
    )

    for (const rule of applicableRules) {
      try {
        rulesTriggered++

        // Apply delay if specified
        if (rule.conditions.delayMs) {
          setTimeout(async () => {
            await this.executeInvalidationRule(rule, companyId, entityType, entityId)
          }, rule.conditions.delayMs)
        } else {
          const result = await this.executeInvalidationRule(rule, companyId, entityType, entityId)
          cacheKeysInvalidated += result.invalidatedKeys
          cascadeInvalidations += result.cascadeInvalidations
        }

      } catch (error) {
        console.error(`Failed to execute invalidation rule ${rule.id}:`, error)
      }
    }

    // Schedule intelligent re-warming for high-impact invalidations
    if (cacheKeysInvalidated > 10 || cascadeInvalidations > 0) {
      setTimeout(() => {
        this.scheduleReWarming(companyId, entityType, changeType)
      }, 30000) // Re-warm after 30 seconds
    }

    return { rulesTriggered, cacheKeysInvalidated, cascadeInvalidations }
  }

  /**
   * Setup automated warming schedules for companies
   */
  async setupWarmingSchedule(
    companyId: string,
    schedule: WarmupSchedule['schedule'],
    options: {
      timezone?: string
      businessDaysOnly?: boolean
      avoidPrayerTimes?: boolean
      skipDuringRamadan?: boolean
    } = {}
  ): Promise<void> {
    const warmupSchedule: WarmupSchedule = {
      companyId,
      schedule: schedule.map(item => ({
        ...item,
        conditions: {
          businessDaysOnly: options.businessDaysOnly ?? true,
          avoidPrayerTimes: options.avoidPrayerTimes ?? true,
          skipDuringRamadan: options.skipDuringRamadan ?? false
        }
      })),
      timezone: options.timezone || 'Asia/Dubai',
      enabled: true
    }

    this.warmupSchedules.set(companyId, warmupSchedule)
    console.log(`Warming schedule configured for company ${companyId}`)
  }

  /**
   * Get cache warming recommendations based on current system state
   */
  async getWarmingRecommendations(companyId: string): Promise<{
    recommendations: Array<{
      taskType: WarmupTask['taskType']
      priority: WarmupTask['priority']
      reason: string
      estimatedImpact: number
      suggestedTime: Date
    }>
    systemLoad: {
      current: number
      optimal: number
      canWarmNow: boolean
    }
    businessContext: {
      period: string
      isBusinessHours: boolean
      nextOptimalWindow: Date
    }
  }> {
    const recommendations = []
    const usagePatterns = await this.analyzeUsagePatterns(companyId)
    const businessContext = await uaeOptimizationService.getCurrentOptimization()
    const systemLoad = await this.getCurrentSystemLoad()

    // Analyze each task type for warming potential
    const taskTypes: WarmupTask['taskType'][] = ['dashboard', 'kpis', 'customers', 'invoices', 'payments', 'email']

    for (const taskType of taskTypes) {
      const cacheAge = await this.getCacheAge(companyId, taskType)
      const usageFrequency = usagePatterns[taskType] || 0

      if (cacheAge > 300000 && usageFrequency > 0.1) { // Cache older than 5 minutes and used recently
        recommendations.push({
          taskType,
          priority: this.determinePriority(taskType, usagePatterns),
          reason: `Cache is ${Math.round(cacheAge / 60000)} minutes old with ${Math.round(usageFrequency * 100)}% recent usage`,
          estimatedImpact: this.estimateImpact(taskType, usageFrequency),
          suggestedTime: await this.getSuggestedWarmingTime(taskType, businessContext)
        })
      }
    }

    // Sort by priority and impact
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return (priorityOrder[b.priority] - priorityOrder[a.priority]) ||
             (b.estimatedImpact - a.estimatedImpact)
    })

    const businessHoursInfo = await uaeOptimizationService.isOptimalTimeForOperation('query')

    return {
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      systemLoad: {
        current: systemLoad,
        optimal: 0.7, // 70% optimal load threshold
        canWarmNow: systemLoad < 0.8 // Can warm if system load < 80%
      },
      businessContext: {
        period: businessContext.currentPeriod,
        isBusinessHours: businessHoursInfo.optimal,
        nextOptimalWindow: businessHoursInfo.nextOptimalTime || new Date(Date.now() + 3600000) // 1 hour from now
      }
    }
  }

  /**
   * Initialize default warming schedules for UAE business patterns
   */
  private initializeDefaultSchedules(): void {
    // Default UAE business schedule
    const defaultSchedule: WarmupSchedule['schedule'] = [
      {
        time: '07:00', // Before business starts
        taskTypes: ['dashboard', 'kpis'],
        priority: 'high',
        conditions: {
          businessDaysOnly: true,
          avoidPrayerTimes: true,
          skipDuringRamadan: false
        }
      },
      {
        time: '11:30', // Before lunch
        taskTypes: ['customers', 'invoices'],
        priority: 'medium',
        conditions: {
          businessDaysOnly: true,
          avoidPrayerTimes: true,
          skipDuringRamadan: false
        }
      },
      {
        time: '14:00', // After lunch
        taskTypes: ['payments', 'email'],
        priority: 'medium',
        conditions: {
          businessDaysOnly: true,
          avoidPrayerTimes: true,
          skipDuringRamadan: false
        }
      },
      {
        time: '19:00', // After business hours
        taskTypes: ['reports'],
        priority: 'low',
        conditions: {
          businessDaysOnly: false,
          avoidPrayerTimes: true,
          skipDuringRamadan: true
        }
      }
    ]

    // This would be set per company in production
    // For now, we store it as a template
  }

  /**
   * Initialize cache invalidation rules
   */
  private initializeInvalidationRules(): void {
    const rules: InvalidationRule[] = [
      {
        id: 'invoice-changes',
        name: 'Invoice Data Changes',
        trigger: 'data_change',
        patterns: [
          'analytics:*:dashboard*',
          'analytics:*:invoices*',
          'analytics:*:kpis*'
        ],
        conditions: {
          entityTypes: ['invoice'],
          cascadeInvalidation: true
        },
        priority: 'high',
        enabled: true
      },
      {
        id: 'payment-changes',
        name: 'Payment Data Changes',
        trigger: 'data_change',
        patterns: [
          'analytics:*:payments*',
          'analytics:*:dashboard*',
          'analytics:*:kpis*'
        ],
        conditions: {
          entityTypes: ['payment'],
          delayMs: 5000, // 5 second delay to batch related changes
          cascadeInvalidation: true
        },
        priority: 'high',
        enabled: true
      },
      {
        id: 'customer-changes',
        name: 'Customer Data Changes',
        trigger: 'data_change',
        patterns: [
          'analytics:*:customers*',
          'analytics:*:dashboard*'
        ],
        conditions: {
          entityTypes: ['customer'],
          cascadeInvalidation: false
        },
        priority: 'medium',
        enabled: true
      },
      {
        id: 'daily-refresh',
        name: 'Daily Cache Refresh',
        trigger: 'time_based',
        patterns: ['analytics:*:*'],
        conditions: {
          delayMs: 0
        },
        priority: 'low',
        enabled: true
      }
    ]

    rules.forEach(rule => {
      this.invalidationRules.set(rule.id, rule)
    })
  }

  /**
   * Helper methods
   */
  private async generateOptimalFilters(
    companyId: string,
    taskType: WarmupTask['taskType'],
    baseFilters?: Partial<AnalyticsFilters>
  ): Promise<AnalyticsFilters> {
    // Generate filters optimized for the task type and business context
    const optimization = await uaeOptimizationService.getCurrentOptimization()

    let dateRange = {
      startDate: subDays(new Date(), 30), // Default to last 30 days
      endDate: new Date(),
      preset: 'month' as const
    }

    // Adjust date range based on task type
    switch (taskType) {
      case 'dashboard':
      case 'kpis':
        dateRange = {
          startDate: subDays(new Date(), 7), // Last week for dashboard
          endDate: new Date(),
          preset: 'week' as const
        }
        break

      case 'customers':
        dateRange = {
          startDate: subDays(new Date(), 90), // Last 3 months for customer analysis
          endDate: new Date(),
          preset: 'quarter' as const
        }
        break

      case 'reports':
        dateRange = {
          startDate: subDays(new Date(), 365), // Last year for reports
          endDate: new Date(),
          preset: 'year' as const
        }
        break
    }

    const filters: AnalyticsFilters = {
      dateRange,
      companyId,
      granularity: taskType === 'dashboard' ? 'day' : 'week',
      includeArchived: false,
      ...baseFilters
    }

    return await uaeOptimizationService.optimizeAnalyticsFilters(filters)
  }

  private estimateWarmupDuration(taskType: WarmupTask['taskType']): number {
    // Estimate warming duration based on task complexity
    const durations = {
      dashboard: 30000,  // 30 seconds
      kpis: 20000,       // 20 seconds
      customers: 45000,  // 45 seconds
      invoices: 40000,   // 40 seconds
      payments: 35000,   // 35 seconds
      email: 25000,      // 25 seconds
      reports: 120000    // 2 minutes
    }

    return durations[taskType] || 30000
  }

  private async analyzeUsagePatterns(companyId: string): Promise<Record<string, number>> {
    // Analyze cache hit ratios and access patterns
    // This would integrate with actual analytics data in production

    return {
      dashboard: 0.8,  // 80% usage frequency
      kpis: 0.6,       // 60% usage frequency
      customers: 0.4,  // 40% usage frequency
      invoices: 0.7,   // 70% usage frequency
      payments: 0.5,   // 50% usage frequency
      email: 0.3       // 30% usage frequency
    }
  }

  private prioritizeWarmupTasks(
    usagePatterns: Record<string, number>,
    businessContext: any
  ): WarmupTask['taskType'][] {
    const taskTypes: WarmupTask['taskType'][] = ['dashboard', 'kpis', 'customers', 'invoices', 'payments', 'email']

    return taskTypes.sort((a, b) => {
      const usageA = usagePatterns[a] || 0
      const usageB = usagePatterns[b] || 0

      // Prioritize high-usage items
      return usageB - usageA
    })
  }

  private determinePriority(
    taskType: WarmupTask['taskType'],
    usagePatterns: Record<string, number>
  ): WarmupTask['priority'] {
    const usage = usagePatterns[taskType] || 0

    if (usage > 0.7) return 'high'
    if (usage > 0.4) return 'medium'
    return 'low'
  }

  private async getCacheStrategyRecommendations(
    companyId: string,
    businessContext: any
  ): Promise<any> {
    return await uaeOptimizationService.getOptimalCachingStrategy('analytics')
  }

  private async getActiveCompanies(): Promise<string[]> {
    // Would get from database in production
    return ['company1', 'company2'] // Placeholder
  }

  private async shouldWarmCompany(companyId: string): Promise<boolean> {
    // Check if company has recent activity and would benefit from warming
    const lastActivity = Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
    // Would check actual activity in production
    return true
  }

  private async executeInvalidationRule(
    rule: InvalidationRule,
    companyId: string,
    entityType: string,
    entityId: string
  ): Promise<{ invalidatedKeys: number; cascadeInvalidations: number }> {
    let invalidatedKeys = 0
    let cascadeInvalidations = 0

    for (const pattern of rule.patterns) {
      const actualPattern = pattern.replace('*', companyId)
      const count = await advancedCachingService.invalidateByPattern(actualPattern)
      invalidatedKeys += count

      if (rule.conditions.cascadeInvalidation) {
        // Invalidate related caches
        cascadeInvalidations += await this.executeCascadeInvalidation(companyId, entityType)
      }
    }

    return { invalidatedKeys, cascadeInvalidations }
  }

  private async executeCascadeInvalidation(companyId: string, entityType: string): Promise<number> {
    // Invalidate related cache entries based on entity relationships
    const cascadePatterns = {
      invoice: ['dashboard', 'kpis', 'payments'],
      payment: ['dashboard', 'kpis', 'invoices'],
      customer: ['dashboard', 'invoices']
    }

    const patterns = cascadePatterns[entityType] || []
    let totalInvalidated = 0

    for (const pattern of patterns) {
      const count = await advancedCachingService.invalidateByPattern(`analytics:${companyId}:${pattern}`)
      totalInvalidated += count
    }

    return totalInvalidated
  }

  private async scheduleReWarming(
    companyId: string,
    entityType: string,
    changeType: string
  ): Promise<void> {
    const taskTypes = this.getReWarmingTaskTypes(entityType, changeType)
    await this.scheduleWarmup(companyId, taskTypes, {
      priority: 'high' // High priority for re-warming after invalidation
    })
  }

  private getReWarmingTaskTypes(
    entityType: string,
    changeType: string
  ): WarmupTask['taskType'][] {
    const reWarmingMap = {
      invoice: ['dashboard', 'kpis', 'invoices'],
      payment: ['dashboard', 'kpis', 'payments'],
      customer: ['dashboard', 'customers']
    }

    return (reWarmingMap[entityType] || ['dashboard']) as WarmupTask['taskType'][]
  }

  private async getCacheAge(companyId: string, taskType: string): Promise<number> {
    // Would check actual cache timestamps in production
    return Math.random() * 600000 // 0-10 minutes random age for simulation
  }

  private estimateImpact(taskType: WarmupTask['taskType'], usageFrequency: number): number {
    const baseImpact = {
      dashboard: 90,  // High impact
      kpis: 85,       // High impact
      customers: 60,  // Medium impact
      invoices: 70,   // Medium-high impact
      payments: 65,   // Medium impact
      email: 50       // Medium-low impact
    }

    return (baseImpact[taskType] || 50) * usageFrequency
  }

  private async getSuggestedWarmingTime(
    taskType: WarmupTask['taskType'],
    businessContext: any
  ): Promise<Date> {
    const timing = await uaeOptimizationService.getOptimalExecutionTiming('medium')
    return timing.alternativeTime || new Date(Date.now() + 300000) // 5 minutes from now
  }

  private async getCurrentSystemLoad(): Promise<number> {
    // Would get actual system metrics in production
    return Math.random() * 0.5 + 0.2 // 20-70% simulated load
  }

  /**
   * Background processors
   */
  private startWarmupProcessor(): void {
    setInterval(async () => {
      await this.processWarmupQueue()
    }, 10000) // Process every 10 seconds
  }

  private startMetricsCollector(): void {
    setInterval(() => {
      this.updateMetrics()
    }, 60000) // Update metrics every minute
  }

  private async processWarmupQueue(): Promise<void> {
    if (this.activeWarmups.size >= this.MAX_CONCURRENT_WARMUPS) {
      return // Too many active warmups
    }

    // Get pending tasks sorted by priority and scheduled time
    const pendingTasks = Array.from(this.warmupTasks.values())
      .filter(task => task.status === 'pending' && task.scheduledTime <= new Date())
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return (priorityOrder[b.priority] - priorityOrder[a.priority]) ||
               (a.scheduledTime.getTime() - b.scheduledTime.getTime())
      })

    for (const task of pendingTasks) {
      if (this.activeWarmups.size >= this.MAX_CONCURRENT_WARMUPS) {
        break
      }

      // Check dependencies
      const dependenciesMet = task.dependencies.every(depId => {
        const depTask = this.warmupTasks.get(depId)
        return depTask?.status === 'completed'
      })

      if (!dependenciesMet) {
        continue
      }

      // Execute the warmup task
      this.executeWarmupTask(task).catch(error => {
        console.error(`Warmup task ${task.id} failed:`, error)
      })
    }
  }

  private async executeWarmupTask(task: WarmupTask): Promise<void> {
    this.activeWarmups.add(task.id)
    task.status = 'running'

    const startTime = Date.now()

    try {
      // Execute the actual warming based on task type
      await this.performWarmup(task)

      task.status = 'completed'
      task.completedAt = new Date()
      this.metrics.completedTasks++

      console.log(`Completed warmup task ${task.id} for ${task.companyId}:${task.taskType}`)

    } catch (error) {
      task.status = 'failed'
      task.error = error.message
      task.retryCount++

      if (task.retryCount < task.maxRetries) {
        // Reschedule with exponential backoff
        task.status = 'pending'
        task.scheduledTime = new Date(Date.now() + Math.pow(2, task.retryCount) * 60000)
        console.log(`Rescheduling failed warmup task ${task.id} (retry ${task.retryCount}/${task.maxRetries})`)
      } else {
        this.metrics.failedTasks++
        console.error(`Warmup task ${task.id} failed permanently:`, error)
      }

    } finally {
      this.activeWarmups.delete(task.id)

      // Update average execution time
      const executionTime = Date.now() - startTime
      this.metrics.averageExecutionTime = (this.metrics.averageExecutionTime + executionTime) / 2
    }
  }

  private async performWarmup(task: WarmupTask): Promise<void> {
    switch (task.taskType) {
      case 'dashboard':
        await kpiCalculationEngine.getDashboardAnalytics(task.companyId, task.filters)
        break

      case 'kpis':
        // Warm up specific KPI calculations
        await this.warmKPIs(task.companyId, task.filters)
        break

      case 'customers':
        await analyticsAggregationService.getCustomerBehaviorAggregation(task.companyId, task.filters.dateRange)
        break

      case 'invoices':
        await analyticsAggregationService.getInvoiceStatusAggregation(task.companyId, task.filters.dateRange)
        break

      case 'payments':
        await analyticsAggregationService.getPaymentPerformanceAggregation(task.companyId, task.filters.dateRange)
        break

      case 'email':
        await analyticsAggregationService.getEmailAnalyticsAggregation(task.companyId, task.filters.dateRange)
        break

      default:
        console.warn(`Unknown warmup task type: ${task.taskType}`)
    }
  }

  private async warmKPIs(companyId: string, filters: AnalyticsFilters): Promise<void> {
    // Warm up commonly accessed KPIs
    const commonKPIs = [
      'payment_delay_reduction',
      'collection_efficiency',
      'customer_satisfaction'
    ]

    for (const kpi of commonKPIs) {
      // This would call the KPI calculation engine
      // await kpiCalculationEngine.calculateSpecificKPI(companyId, kpi, filters)
    }
  }

  private updateMetrics(): void {
    // Update cache hit improvement ratio
    const stats = advancedCachingService.getCacheStats()
    const overallHitRatio = Object.values(stats).reduce((sum, stat) => sum + stat.hitRatio, 0) / Object.keys(stats).length
    this.metrics.cacheHitImprovementRatio = overallHitRatio

    // Log metrics periodically
    if (Date.now() % 300000 < 60000) { // Every 5 minutes
      console.log('Cache Warming Metrics:', this.metrics)
    }
  }

  /**
   * Public API methods
   */
  getWarmupMetrics(): WarmupMetrics {
    return { ...this.metrics }
  }

  getActiveWarmupCount(): number {
    return this.activeWarmups.size
  }

  getPendingTasksCount(): number {
    return Array.from(this.warmupTasks.values()).filter(task => task.status === 'pending').length
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.warmupTasks.clear()
    this.warmupSchedules.clear()
    this.invalidationRules.clear()
    this.activeWarmups.clear()
  }
}

// Export singleton instance
export const cacheWarmingService = new CacheWarmingService()