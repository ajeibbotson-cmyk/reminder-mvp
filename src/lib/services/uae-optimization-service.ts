/**
 * UAE Optimization Service
 * Specialized optimizations for UAE business hours, Islamic calendar, and cultural compliance
 * Ensures optimal performance during UAE business patterns
 */

import { addDays, addMonths, format, isAfter, isBefore, isWeekend, startOfDay, endOfDay } from 'date-fns'
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'
import { AnalyticsFilters } from '../types/analytics'
import { advancedCachingService } from './advanced-caching-service'

interface UAEBusinessDay {
  date: Date
  isBusinessDay: boolean
  isRamadan: boolean
  isPrayerTime: boolean
  businessHours: {
    start: Date
    end: Date
    lunchBreak: {
      start: Date
      end: Date
    }
  }
  culturalEvents: string[]
  optimizationLevel: 'high' | 'medium' | 'low'
}

interface IslamicCalendarEvent {
  name: string
  nameAr: string
  date: Date
  duration: number // days
  businessImpact: 'high' | 'medium' | 'low'
  cacheOptimization: {
    ttlMultiplier: number
    preWarm: boolean
    reducedFrequency: boolean
  }
}

interface PrayerTimes {
  fajr: Date
  dhuhr: Date
  asr: Date
  maghrib: Date
  isha: Date
  location: 'dubai' | 'abu_dhabi' | 'sharjah' | 'ajman' | 'ras_al_khaimah' | 'fujairah' | 'umm_al_quwain'
}

interface CulturalOptimization {
  currentPeriod: 'normal' | 'ramadan' | 'eid' | 'national_day' | 'summer'
  recommendedCacheTTL: number
  emailSendingOptimal: boolean
  queryOptimizationLevel: number
  realTimeUpdateFrequency: number
  businessHoursAdjustment: {
    startOffset: number // minutes
    endOffset: number // minutes
    lunchExtension: number // minutes
  }
}

export class UAEOptimizationService {
  private readonly UAE_TIMEZONE = 'Asia/Dubai'
  private readonly BUSINESS_HOURS = {
    start: 8, // 8 AM
    end: 18,  // 6 PM
    lunchStart: 12, // 12 PM
    lunchEnd: 13   // 1 PM
  }

  private islamicEvents: Map<string, IslamicCalendarEvent> = new Map()
  private prayerTimesCache: Map<string, PrayerTimes> = new Map()
  private businessDayCache: Map<string, UAEBusinessDay> = new Map()
  private optimizationHistory: Array<{
    date: Date
    optimization: CulturalOptimization
    performance: {
      cacheHitRatio: number
      avgResponseTime: number
      userActivity: number
    }
  }> = []

  constructor() {
    this.initializeIslamicCalendar()
    this.startOptimizationScheduler()
    this.preloadBusinessDayCache()
  }

  /**
   * Get current UAE business context and optimization settings
   */
  async getCurrentOptimization(): Promise<CulturalOptimization> {
    const now = new Date()
    const uaeNow = utcToZonedTime(now, this.UAE_TIMEZONE)

    const currentPeriod = this.determinePeriod(uaeNow)
    const prayerTimes = await this.getPrayerTimes(uaeNow, 'dubai')
    const isBusinessHours = this.isBusinessHours(uaeNow)
    const isPrayerTime = this.isPrayerTime(uaeNow, prayerTimes)

    let optimization: CulturalOptimization = {
      currentPeriod,
      recommendedCacheTTL: this.calculateOptimalCacheTTL(currentPeriod, isBusinessHours),
      emailSendingOptimal: this.isOptimalForEmailSending(uaeNow, currentPeriod, isPrayerTime),
      queryOptimizationLevel: this.getQueryOptimizationLevel(currentPeriod, isBusinessHours),
      realTimeUpdateFrequency: this.getRealTimeUpdateFrequency(currentPeriod, isBusinessHours),
      businessHoursAdjustment: this.getBusinessHoursAdjustment(currentPeriod)
    }

    return optimization
  }

  /**
   * Optimize analytics filters for UAE business context
   */
  async optimizeAnalyticsFilters(filters: AnalyticsFilters): Promise<AnalyticsFilters> {
    const optimizedFilters = { ...filters }
    const currentOptimization = await this.getCurrentOptimization()

    // Adjust date ranges for UAE business days
    if (filters.dateRange) {
      const { startDate, endDate } = filters.dateRange

      // Convert to UAE timezone for business day calculations
      const uaeStartDate = utcToZonedTime(startDate, this.UAE_TIMEZONE)
      const uaeEndDate = utcToZonedTime(endDate, this.UAE_TIMEZONE)

      // Adjust for business days only if requested
      const businessDayAdjustment = this.adjustForBusinessDays(uaeStartDate, uaeEndDate)

      if (businessDayAdjustment.hasWeekends || businessDayAdjustment.hasHolidays) {
        // Add metadata about the adjustment
        optimizedFilters.dateRange = {
          ...filters.dateRange,
          startDate: zonedTimeToUtc(businessDayAdjustment.adjustedStart, this.UAE_TIMEZONE),
          endDate: zonedTimeToUtc(businessDayAdjustment.adjustedEnd, this.UAE_TIMEZONE)
        }
      }
    }

    // Optimize granularity based on current period
    if (currentOptimization.currentPeriod === 'ramadan' || currentOptimization.currentPeriod === 'eid') {
      // Use less granular data during cultural periods to reduce load
      if (optimizedFilters.granularity === 'hour') {
        optimizedFilters.granularity = 'day'
      }
    }

    return optimizedFilters
  }

  /**
   * Get optimal caching strategy based on UAE business patterns
   */
  async getOptimalCachingStrategy(queryType: string): Promise<{
    ttl: number
    tier: 'L1_MEMORY' | 'L2_REDIS' | 'L3_DATABASE'
    warmup: boolean
    compression: boolean
    tags: string[]
  }> {
    const optimization = await this.getCurrentOptimization()
    const uaeNow = utcToZonedTime(new Date(), this.UAE_TIMEZONE)
    const isBusinessHours = this.isBusinessHours(uaeNow)

    let strategy = {
      ttl: optimization.recommendedCacheTTL,
      tier: 'L2_REDIS' as const,
      warmup: false,
      compression: false,
      tags: [`period:${optimization.currentPeriod}`]
    }

    // Adjust strategy based on query type and business context
    if (queryType.includes('realtime')) {
      strategy.ttl = isBusinessHours ? 30000 : 120000 // 30s during business, 2min after
      strategy.tier = 'L1_MEMORY'
      strategy.warmup = isBusinessHours
    } else if (queryType.includes('dashboard')) {
      strategy.ttl = isBusinessHours ? 60000 : 300000 // 1min during business, 5min after
      strategy.warmup = this.shouldWarmupCache(optimization.currentPeriod)
      strategy.compression = true
    } else if (queryType.includes('report')) {
      strategy.ttl = 900000 // 15 minutes for reports
      strategy.tier = 'L3_DATABASE'
      strategy.compression = true
    }

    // Special handling for cultural periods
    if (optimization.currentPeriod === 'ramadan') {
      strategy.ttl *= 1.5 // Extend cache during Ramadan
      strategy.tags.push('ramadan-optimized')
    } else if (optimization.currentPeriod === 'eid') {
      strategy.ttl *= 2 // Much longer cache during Eid
      strategy.tags.push('eid-optimized')
    }

    return strategy
  }

  /**
   * Optimize query execution timing for UAE business patterns
   */
  async getOptimalExecutionTiming(priority: 'low' | 'medium' | 'high' | 'critical'): Promise<{
    executeNow: boolean
    suggestedDelay: number
    reason: string
    alternativeTime?: Date
  }> {
    const uaeNow = utcToZonedTime(new Date(), this.UAE_TIMEZONE)
    const prayerTimes = await this.getPrayerTimes(uaeNow, 'dubai')
    const optimization = await this.getCurrentOptimization()

    // Always execute critical queries immediately
    if (priority === 'critical') {
      return {
        executeNow: true,
        suggestedDelay: 0,
        reason: 'Critical priority - execute immediately'
      }
    }

    // Check for prayer times
    if (this.isPrayerTime(uaeNow, prayerTimes)) {
      const nextSafeTime = this.getNextSafeExecutionTime(uaeNow, prayerTimes)
      return {
        executeNow: false,
        suggestedDelay: nextSafeTime.getTime() - uaeNow.getTime(),
        reason: 'Respecting prayer time',
        alternativeTime: nextSafeTime
      }
    }

    // Check for lunch break
    const isLunchTime = uaeNow.getHours() >= this.BUSINESS_HOURS.lunchStart &&
                       uaeNow.getHours() < this.BUSINESS_HOURS.lunchEnd

    if (isLunchTime && priority === 'low') {
      const lunchEndTime = new Date(uaeNow)
      lunchEndTime.setHours(this.BUSINESS_HOURS.lunchEnd, 0, 0, 0)

      return {
        executeNow: false,
        suggestedDelay: lunchEndTime.getTime() - uaeNow.getTime(),
        reason: 'Avoiding lunch break for low priority queries',
        alternativeTime: lunchEndTime
      }
    }

    // Check for weekend (Friday-Saturday in UAE)
    const dayOfWeek = uaeNow.getDay()
    if ((dayOfWeek === 5 || dayOfWeek === 6) && priority !== 'high') {
      const nextSunday = addDays(uaeNow, dayOfWeek === 5 ? 2 : 1)
      nextSunday.setHours(this.BUSINESS_HOURS.start, 0, 0, 0)

      return {
        executeNow: false,
        suggestedDelay: nextSunday.getTime() - uaeNow.getTime(),
        reason: 'Weekend - deferring to next business day',
        alternativeTime: nextSunday
      }
    }

    // Cultural period adjustments
    if (optimization.currentPeriod === 'ramadan' && priority === 'low') {
      // During Ramadan, defer low priority to after Iftar
      const iftarTime = prayerTimes.maghrib
      if (uaeNow < iftarTime) {
        const afterIftar = addMinutes(iftarTime, 60) // 1 hour after Iftar

        return {
          executeNow: false,
          suggestedDelay: afterIftar.getTime() - uaeNow.getTime(),
          reason: 'Ramadan consideration - scheduling after Iftar',
          alternativeTime: afterIftar
        }
      }
    }

    return {
      executeNow: true,
      suggestedDelay: 0,
      reason: 'Optimal execution time'
    }
  }

  /**
   * Pre-calculate Islamic calendar dates for the year
   */
  private initializeIslamicCalendar(): void {
    const currentYear = new Date().getFullYear()

    // Note: These are approximate dates - in production, would use actual Islamic calendar API
    const islamicEvents: Array<Omit<IslamicCalendarEvent, 'date'> & { approximateDate: string }> = [
      {
        name: 'Ramadan',
        nameAr: 'رمضان',
        approximateDate: `${currentYear}-03-10`, // Approximate - varies yearly
        duration: 30,
        businessImpact: 'high',
        cacheOptimization: {
          ttlMultiplier: 1.5,
          preWarm: true,
          reducedFrequency: true
        }
      },
      {
        name: 'Eid Al-Fitr',
        nameAr: 'عيد الفطر',
        approximateDate: `${currentYear}-04-09`, // Day after Ramadan
        duration: 3,
        businessImpact: 'high',
        cacheOptimization: {
          ttlMultiplier: 2,
          preWarm: false,
          reducedFrequency: true
        }
      },
      {
        name: 'Eid Al-Adha',
        nameAr: 'عيد الأضحى',
        approximateDate: `${currentYear}-06-16`, // Approximate
        duration: 4,
        businessImpact: 'high',
        cacheOptimization: {
          ttlMultiplier: 2,
          preWarm: false,
          reducedFrequency: true
        }
      },
      {
        name: 'UAE National Day',
        nameAr: 'اليوم الوطني لدولة الإمارات',
        approximateDate: `${currentYear}-12-02`,
        duration: 2,
        businessImpact: 'medium',
        cacheOptimization: {
          ttlMultiplier: 1.3,
          preWarm: true,
          reducedFrequency: false
        }
      }
    ]

    islamicEvents.forEach(event => {
      const eventWithDate: IslamicCalendarEvent = {
        ...event,
        date: new Date(event.approximateDate)
      }
      this.islamicEvents.set(event.name, eventWithDate)
    })
  }

  /**
   * Get prayer times for UAE cities
   */
  private async getPrayerTimes(date: Date, location: PrayerTimes['location']): Promise<PrayerTimes> {
    const cacheKey = `prayer-${format(date, 'yyyy-MM-dd')}-${location}`

    if (this.prayerTimesCache.has(cacheKey)) {
      return this.prayerTimesCache.get(cacheKey)!
    }

    // Simplified prayer time calculation - in production would use proper Islamic prayer time API
    const prayerTimes: PrayerTimes = {
      fajr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 5, 30), // 5:30 AM
      dhuhr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 15), // 12:15 PM
      asr: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15, 45), // 3:45 PM
      maghrib: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 30), // 6:30 PM
      isha: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 0), // 8:00 PM
      location
    }

    this.prayerTimesCache.set(cacheKey, prayerTimes)
    return prayerTimes
  }

  /**
   * Helper methods for business logic
   */
  private determinePeriod(date: Date): CulturalOptimization['currentPeriod'] {
    const currentDate = startOfDay(date)

    // Check for Islamic events
    for (const [name, event] of this.islamicEvents) {
      const eventStart = startOfDay(event.date)
      const eventEnd = endOfDay(addDays(event.date, event.duration - 1))

      if (currentDate >= eventStart && currentDate <= eventEnd) {
        if (name === 'Ramadan') return 'ramadan'
        if (name.includes('Eid')) return 'eid'
        if (name === 'UAE National Day') return 'national_day'
      }
    }

    // Check for summer period (June-August in UAE has different business patterns)
    const month = date.getMonth()
    if (month >= 5 && month <= 7) {
      return 'summer'
    }

    return 'normal'
  }

  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours()
    const dayOfWeek = date.getDay()

    // UAE weekend is Friday (5) and Saturday (6)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return false
    }

    return hour >= this.BUSINESS_HOURS.start && hour < this.BUSINESS_HOURS.end
  }

  private isPrayerTime(date: Date, prayerTimes: PrayerTimes): boolean {
    const currentTime = date.getTime()
    const prayerBuffer = 10 * 60 * 1000 // 10 minutes buffer

    const prayers = [prayerTimes.fajr, prayerTimes.dhuhr, prayerTimes.asr, prayerTimes.maghrib, prayerTimes.isha]

    return prayers.some(prayerTime => {
      return Math.abs(currentTime - prayerTime.getTime()) <= prayerBuffer
    })
  }

  private getNextSafeExecutionTime(currentTime: Date, prayerTimes: PrayerTimes): Date {
    const prayers = [prayerTimes.fajr, prayerTimes.dhuhr, prayerTimes.asr, prayerTimes.maghrib, prayerTimes.isha]
    const prayerBuffer = 15 * 60 * 1000 // 15 minutes after prayer

    for (const prayerTime of prayers) {
      if (currentTime < prayerTime) {
        return new Date(prayerTime.getTime() + prayerBuffer)
      }
    }

    // If past all prayers today, return early next morning
    const tomorrow = addDays(currentTime, 1)
    return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), this.BUSINESS_HOURS.start, 0, 0, 0)
  }

  private calculateOptimalCacheTTL(period: CulturalOptimization['currentPeriod'], isBusinessHours: boolean): number {
    let baseTTL = isBusinessHours ? 120000 : 300000 // 2min vs 5min

    switch (period) {
      case 'ramadan':
        return baseTTL * 1.5 // Longer cache during Ramadan
      case 'eid':
        return baseTTL * 2 // Much longer during Eid
      case 'summer':
        return baseTTL * 1.2 // Slightly longer in summer
      default:
        return baseTTL
    }
  }

  private isOptimalForEmailSending(date: Date, period: CulturalOptimization['currentPeriod'], isPrayerTime: boolean): boolean {
    // Never send during prayer times
    if (isPrayerTime) return false

    // Check business hours
    if (!this.isBusinessHours(date)) return false

    // Special considerations for cultural periods
    if (period === 'ramadan') {
      // Avoid sending emails close to Iftar (Maghrib prayer)
      const hour = date.getHours()
      if (hour >= 17 && hour <= 19) return false // Around sunset
    }

    return true
  }

  private getQueryOptimizationLevel(period: CulturalOptimization['currentPeriod'], isBusinessHours: boolean): number {
    let baseLevel = isBusinessHours ? 1.0 : 0.7

    switch (period) {
      case 'ramadan':
      case 'eid':
        return baseLevel * 0.8 // Reduce optimization during cultural periods
      case 'summer':
        return baseLevel * 0.9 // Slight reduction in summer
      default:
        return baseLevel
    }
  }

  private getRealTimeUpdateFrequency(period: CulturalOptimization['currentPeriod'], isBusinessHours: boolean): number {
    let baseFrequency = isBusinessHours ? 1000 : 5000 // 1s vs 5s

    switch (period) {
      case 'ramadan':
      case 'eid':
        return baseFrequency * 2 // Reduce frequency during cultural periods
      case 'summer':
        return baseFrequency * 1.5 // Slight reduction in summer
      default:
        return baseFrequency
    }
  }

  private getBusinessHoursAdjustment(period: CulturalOptimization['currentPeriod']): CulturalOptimization['businessHoursAdjustment'] {
    switch (period) {
      case 'ramadan':
        return {
          startOffset: 30, // Start 30 minutes later
          endOffset: -60, // End 1 hour earlier
          lunchExtension: 30 // Extend lunch by 30 minutes
        }
      case 'summer':
        return {
          startOffset: -30, // Start 30 minutes earlier
          endOffset: -30, // End 30 minutes earlier
          lunchExtension: 15 // Extend lunch by 15 minutes
        }
      default:
        return {
          startOffset: 0,
          endOffset: 0,
          lunchExtension: 0
        }
    }
  }

  private adjustForBusinessDays(startDate: Date, endDate: Date): {
    adjustedStart: Date
    adjustedEnd: Date
    hasWeekends: boolean
    hasHolidays: boolean
    businessDaysCount: number
  } {
    let current = startDate
    let businessDaysCount = 0
    let hasWeekends = false
    let hasHolidays = false

    while (current <= endDate) {
      const dayOfWeek = current.getDay()

      // Check for UAE weekend (Friday-Saturday)
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        hasWeekends = true
      } else if (this.isIslamicHoliday(current)) {
        hasHolidays = true
      } else {
        businessDaysCount++
      }

      current = addDays(current, 1)
    }

    return {
      adjustedStart: startDate,
      adjustedEnd: endDate,
      hasWeekends,
      hasHolidays,
      businessDaysCount
    }
  }

  private isIslamicHoliday(date: Date): boolean {
    const currentDate = startOfDay(date)

    for (const event of this.islamicEvents.values()) {
      const eventStart = startOfDay(event.date)
      const eventEnd = endOfDay(addDays(event.date, event.duration - 1))

      if (currentDate >= eventStart && currentDate <= eventEnd) {
        return true
      }
    }

    return false
  }

  private shouldWarmupCache(period: CulturalOptimization['currentPeriod']): boolean {
    return period === 'normal' || period === 'ramadan'
  }

  private preloadBusinessDayCache(): void {
    // Pre-calculate business days for the next 90 days
    const today = new Date()

    for (let i = 0; i < 90; i++) {
      const date = addDays(today, i)
      const uaeDate = utcToZonedTime(date, this.UAE_TIMEZONE)
      const businessDay = this.calculateBusinessDay(uaeDate)

      const cacheKey = format(uaeDate, 'yyyy-MM-dd')
      this.businessDayCache.set(cacheKey, businessDay)
    }
  }

  private calculateBusinessDay(date: Date): UAEBusinessDay {
    const dayOfWeek = date.getDay()
    const isBusinessDay = dayOfWeek !== 5 && dayOfWeek !== 6 && !this.isIslamicHoliday(date)
    const period = this.determinePeriod(date)

    return {
      date,
      isBusinessDay,
      isRamadan: period === 'ramadan',
      isPrayerTime: false, // Would be calculated with actual prayer times
      businessHours: {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), this.BUSINESS_HOURS.start, 0, 0),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), this.BUSINESS_HOURS.end, 0, 0),
        lunchBreak: {
          start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), this.BUSINESS_HOURS.lunchStart, 0, 0),
          end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), this.BUSINESS_HOURS.lunchEnd, 0, 0)
        }
      },
      culturalEvents: this.getCulturalEventsForDate(date),
      optimizationLevel: isBusinessDay ? 'high' : 'low'
    }
  }

  private getCulturalEventsForDate(date: Date): string[] {
    const events: string[] = []
    const currentDate = startOfDay(date)

    for (const [name, event] of this.islamicEvents) {
      const eventStart = startOfDay(event.date)
      const eventEnd = endOfDay(addDays(event.date, event.duration - 1))

      if (currentDate >= eventStart && currentDate <= eventEnd) {
        events.push(name)
      }
    }

    return events
  }

  /**
   * Start optimization scheduler
   */
  private startOptimizationScheduler(): void {
    // Run optimization updates every hour
    setInterval(async () => {
      try {
        const optimization = await this.getCurrentOptimization()

        // Apply optimizations to caching service
        await this.applyCachingOptimizations(optimization)

        // Log performance metrics
        this.logOptimizationMetrics(optimization)

      } catch (error) {
        console.error('UAE optimization scheduler error:', error)
      }
    }, 3600000) // Every hour

    // Daily business day cache update
    setInterval(() => {
      this.preloadBusinessDayCache()
    }, 24 * 60 * 60 * 1000) // Every 24 hours
  }

  private async applyCachingOptimizations(optimization: CulturalOptimization): Promise<void> {
    // Apply optimization to caching service
    await advancedCachingService.optimizeForUAEBusinessHours()
  }

  private logOptimizationMetrics(optimization: CulturalOptimization): void {
    console.log('UAE Optimization Applied:', {
      period: optimization.currentPeriod,
      cacheTTL: optimization.recommendedCacheTTL,
      emailOptimal: optimization.emailSendingOptimal,
      queryLevel: optimization.queryOptimizationLevel
    })
  }

  /**
   * Public API methods
   */
  async getBusinessDayInfo(date: Date): Promise<UAEBusinessDay> {
    const uaeDate = utcToZonedTime(date, this.UAE_TIMEZONE)
    const cacheKey = format(uaeDate, 'yyyy-MM-dd')

    if (this.businessDayCache.has(cacheKey)) {
      return this.businessDayCache.get(cacheKey)!
    }

    const businessDay = this.calculateBusinessDay(uaeDate)
    this.businessDayCache.set(cacheKey, businessDay)
    return businessDay
  }

  getIslamicEvents(year?: number): IslamicCalendarEvent[] {
    return Array.from(this.islamicEvents.values())
  }

  async isOptimalTimeForOperation(operationType: 'query' | 'email' | 'report' | 'backup'): Promise<{
    optimal: boolean
    reason: string
    nextOptimalTime?: Date
  }> {
    const uaeNow = utcToZonedTime(new Date(), this.UAE_TIMEZONE)
    const prayerTimes = await this.getPrayerTimes(uaeNow, 'dubai')
    const optimization = await this.getCurrentOptimization()

    switch (operationType) {
      case 'email':
        return {
          optimal: optimization.emailSendingOptimal,
          reason: optimization.emailSendingOptimal ? 'Optimal business hours' : 'Outside optimal sending window'
        }

      case 'query':
        const isBusinessHours = this.isBusinessHours(uaeNow)
        const isPrayer = this.isPrayerTime(uaeNow, prayerTimes)

        return {
          optimal: isBusinessHours && !isPrayer,
          reason: !isBusinessHours ? 'Outside business hours' : isPrayer ? 'Prayer time' : 'Optimal time'
        }

      default:
        return {
          optimal: true,
          reason: 'No specific restrictions'
        }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.islamicEvents.clear()
    this.prayerTimesCache.clear()
    this.businessDayCache.clear()
    this.optimizationHistory.length = 0
  }
}

// Helper function for date manipulation
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

// Export singleton instance
export const uaeOptimizationService = new UAEOptimizationService()