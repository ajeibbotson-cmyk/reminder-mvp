/**
 * Enhanced Email Scheduling Service
 * Advanced scheduling service with UAE business hours compliance, cultural sensitivity,
 * and optimized delivery timing for consolidated emails
 */

import { prisma } from '../prisma'

interface UAEBusinessHours {
  sunday: { start: number; end: number }
  monday: { start: number; end: number }
  tuesday: { start: number; end: number }
  wednesday: { start: number; end: number }
  thursday: { start: number; end: number }
  friday: { closed: boolean }
  saturday: { closed: boolean }
}

interface IslamicHoliday {
  name: string
  nameAr: string
  date: Date
  isBusinessDay: boolean
}

interface PrayerTime {
  name: string
  time: Date
  duration: number // minutes
}

interface SchedulingOptions {
  respectBusinessHours?: boolean
  avoidPrayerTimes?: boolean
  avoidHolidays?: boolean
  preferredTimeSlot?: 'morning' | 'afternoon' | 'any'
  urgencyLevel?: 'low' | 'medium' | 'high' | 'urgent'
  customerTimeZone?: string
  consolidationBatch?: boolean
  maxDelay?: number // hours
}

interface OptimalSchedulingResult {
  scheduledFor: Date
  originalRequest: Date
  delayMinutes: number
  reason: string
  confidence: number // 0-100
  alternatives: Array<{
    time: Date
    confidence: number
    reason: string
  }>
  businessRulesApplied: string[]
  culturalComplianceFlags: string[]
}

export class EnhancedEmailSchedulingService {
  private readonly UAE_TIMEZONE = 'Asia/Dubai'
  private readonly DEFAULT_BUSINESS_HOURS: UAEBusinessHours = {
    sunday: { start: 9, end: 17 },
    monday: { start: 9, end: 17 },
    tuesday: { start: 9, end: 17 },
    wednesday: { start: 9, end: 17 },
    thursday: { start: 9, end: 17 },
    friday: { closed: true },
    saturday: { closed: true }
  }

  private readonly PRAYER_TIMES_APPROXIMATE = [
    { name: 'Fajr', hour: 5, duration: 30 },
    { name: 'Dhuhr', hour: 12, duration: 45 },
    { name: 'Asr', hour: 15, duration: 30 },
    { name: 'Maghrib', hour: 18, duration: 30 },
    { name: 'Isha', hour: 19, duration: 30 }
  ]

  /**
   * Get optimal send time for email delivery
   */
  async getOptimalSendTime(
    customerId: string,
    options: SchedulingOptions = {}
  ): Promise<OptimalSchedulingResult> {
    try {
      const now = new Date()
      const customer = await this.getCustomerPreferences(customerId)
      const businessHours = await this.getCompanyBusinessHours(customer.companyId)

      // Start with current time or requested time
      let scheduledTime = new Date(now)
      const originalRequest = new Date(now)

      const appliedRules: string[] = []
      const complianceFlags: string[] = []
      const alternatives: Array<{ time: Date; confidence: number; reason: string }> = []

      // Apply business hours constraints
      if (options.respectBusinessHours !== false) {
        const businessHoursResult = this.adjustForBusinessHours(
          scheduledTime,
          businessHours || this.DEFAULT_BUSINESS_HOURS
        )
        scheduledTime = businessHoursResult.adjustedTime
        if (businessHoursResult.wasAdjusted) {
          appliedRules.push('UAE_BUSINESS_HOURS')
        }
      }

      // Apply holiday constraints
      if (options.avoidHolidays !== false) {
        const holidayResult = await this.adjustForHolidays(scheduledTime)
        scheduledTime = holidayResult.adjustedTime
        if (holidayResult.wasAdjusted) {
          appliedRules.push('UAE_HOLIDAYS')
          complianceFlags.push('HOLIDAY_AVOIDANCE')
        }
      }

      // Apply prayer time constraints
      if (options.avoidPrayerTimes !== false) {
        const prayerResult = this.adjustForPrayerTimes(scheduledTime)
        scheduledTime = prayerResult.adjustedTime
        if (prayerResult.wasAdjusted) {
          appliedRules.push('PRAYER_TIMES')
          complianceFlags.push('PRAYER_TIME_SENSITIVITY')
        }
      }

      // Apply preferred time slot
      if (options.preferredTimeSlot && options.preferredTimeSlot !== 'any') {
        const timeSlotResult = this.adjustForPreferredTimeSlot(
          scheduledTime,
          options.preferredTimeSlot,
          businessHours || this.DEFAULT_BUSINESS_HOURS
        )
        scheduledTime = timeSlotResult.adjustedTime
        if (timeSlotResult.wasAdjusted) {
          appliedRules.push('PREFERRED_TIME_SLOT')
        }
      }

      // Apply urgency level adjustments
      if (options.urgencyLevel) {
        const urgencyResult = this.adjustForUrgency(
          scheduledTime,
          options.urgencyLevel,
          options.maxDelay || 24
        )
        scheduledTime = urgencyResult.adjustedTime
        if (urgencyResult.wasAdjusted) {
          appliedRules.push('URGENCY_LEVEL')
        }
      }

      // Optimize for consolidation batching
      if (options.consolidationBatch) {
        const batchResult = await this.optimizeForConsolidationBatch(
          scheduledTime,
          customerId
        )
        scheduledTime = batchResult.adjustedTime
        if (batchResult.wasAdjusted) {
          appliedRules.push('CONSOLIDATION_BATCHING')
        }
      }

      // Apply Ramadan sensitivity if applicable
      if (await this.isRamadanPeriod()) {
        const ramadanResult = this.adjustForRamadan(scheduledTime)
        scheduledTime = ramadanResult.adjustedTime
        if (ramadanResult.wasAdjusted) {
          appliedRules.push('RAMADAN_SENSITIVITY')
          complianceFlags.push('RAMADAN_COMPLIANCE')
        }
      }

      // Calculate confidence score and generate alternatives
      const confidence = this.calculateConfidenceScore(
        originalRequest,
        scheduledTime,
        appliedRules,
        options
      )

      const alternativeOptions = this.generateAlternatives(
        originalRequest,
        scheduledTime,
        businessHours || this.DEFAULT_BUSINESS_HOURS,
        options
      )

      const delayMinutes = Math.floor(
        (scheduledTime.getTime() - originalRequest.getTime()) / (1000 * 60)
      )

      const reason = this.generateSchedulingReason(appliedRules, delayMinutes)

      return {
        scheduledFor: scheduledTime,
        originalRequest,
        delayMinutes,
        reason,
        confidence,
        alternatives: alternativeOptions,
        businessRulesApplied: appliedRules,
        culturalComplianceFlags: complianceFlags
      }

    } catch (error) {
      console.error('Failed to calculate optimal send time:', error)

      // Fallback to safe default
      const fallbackTime = this.getFallbackSafeTime()

      return {
        scheduledFor: fallbackTime,
        originalRequest: new Date(),
        delayMinutes: Math.floor((fallbackTime.getTime() - Date.now()) / (1000 * 60)),
        reason: 'Using fallback safe time due to scheduling error',
        confidence: 50,
        alternatives: [],
        businessRulesApplied: ['FALLBACK_SAFE_TIME'],
        culturalComplianceFlags: ['ERROR_RECOVERY']
      }
    }
  }

  /**
   * Batch schedule multiple emails for optimal delivery
   */
  async batchScheduleEmails(
    emailRequests: Array<{
      customerId: string
      emailType: 'individual' | 'consolidated'
      urgency: 'low' | 'medium' | 'high' | 'urgent'
      preferredTime?: Date
    }>,
    options: SchedulingOptions = {}
  ): Promise<Array<OptimalSchedulingResult & { emailIndex: number }>> {
    try {
      const results = []

      // Group emails by customer for consolidation opportunities
      const customerGroups = new Map<string, typeof emailRequests>()

      emailRequests.forEach((request, index) => {
        if (!customerGroups.has(request.customerId)) {
          customerGroups.set(request.customerId, [])
        }
        customerGroups.get(request.customerId)!.push({ ...request, originalIndex: index })
      })

      // Process each customer group
      for (const [customerId, customerEmails] of customerGroups) {
        // Determine if consolidation is beneficial
        const shouldConsolidate = customerEmails.length > 1 &&
                                 customerEmails.every(e => e.emailType === 'consolidated')

        if (shouldConsolidate) {
          // Schedule as consolidated batch
          const batchOptions = {
            ...options,
            consolidationBatch: true,
            urgencyLevel: this.getHighestUrgency(customerEmails.map(e => e.urgency))
          }

          const batchResult = await this.getOptimalSendTime(customerId, batchOptions)

          // Apply same schedule to all emails in batch
          customerEmails.forEach((email) => {
            results.push({
              ...batchResult,
              emailIndex: email.originalIndex
            })
          })

        } else {
          // Schedule individually
          for (const email of customerEmails) {
            const individualOptions = {
              ...options,
              urgencyLevel: email.urgency,
              consolidationBatch: false
            }

            const result = await this.getOptimalSendTime(customerId, individualOptions)

            results.push({
              ...result,
              emailIndex: email.originalIndex
            })
          }
        }
      }

      // Sort results by original email order
      return results.sort((a, b) => a.emailIndex - b.emailIndex)

    } catch (error) {
      console.error('Failed to batch schedule emails:', error)
      throw error
    }
  }

  /**
   * Check if it's currently UAE business hours
   */
  isUAEBusinessHours(date: Date = new Date()): boolean {
    const uaeTime = new Date(date.toLocaleString("en-US", { timeZone: this.UAE_TIMEZONE }))
    const day = uaeTime.getDay() // 0 = Sunday, 6 = Saturday
    const hour = uaeTime.getHours()

    // UAE weekend is Friday-Saturday
    if (day === 5 || day === 6) return false

    // Business hours are typically 9 AM to 5 PM
    return hour >= 9 && hour < 17
  }

  /**
   * Check if date falls on UAE holiday
   */
  async isUAEHoliday(date: Date): Promise<boolean> {
    const holidays = await this.getUAEHolidays(date.getFullYear())
    return holidays.some(holiday =>
      holiday.date.toDateString() === date.toDateString()
    )
  }

  /**
   * Get next available business time
   */
  async getNextBusinessTime(
    fromDate: Date = new Date(),
    options: SchedulingOptions = {}
  ): Promise<Date> {
    const result = await this.getOptimalSendTime('', {
      respectBusinessHours: true,
      avoidHolidays: true,
      avoidPrayerTimes: true,
      ...options
    })

    return result.scheduledFor
  }

  /**
   * Private helper methods
   */

  private async getCustomerPreferences(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        companyId: true,
        preferredContactInterval: true,
        consolidationPreference: true
      }
    })

    return customer || { companyId: '', preferredContactInterval: 7, consolidationPreference: 'ENABLED' }
  }

  private async getCompanyBusinessHours(companyId: string): Promise<UAEBusinessHours | null> {
    if (!companyId) return null

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { businessHours: true }
    })

    return company?.businessHours as UAEBusinessHours || null
  }

  private adjustForBusinessHours(
    date: Date,
    businessHours: UAEBusinessHours
  ): { adjustedTime: Date; wasAdjusted: boolean } {
    const uaeTime = new Date(date.toLocaleString("en-US", { timeZone: this.UAE_TIMEZONE }))
    const day = uaeTime.getDay()
    const hour = uaeTime.getHours()

    // Check if it's a weekend (Friday-Saturday in UAE)
    if (day === 5 || day === 6) {
      // Move to Sunday (next business day)
      const nextSunday = new Date(uaeTime)
      nextSunday.setDate(nextSunday.getDate() + (7 - day))
      nextSunday.setHours(businessHours.sunday.start, 0, 0, 0)
      return { adjustedTime: nextSunday, wasAdjusted: true }
    }

    // Get business hours for current day
    const dayHours = this.getBusinessHoursForDay(day, businessHours)

    if (!dayHours || dayHours.closed) {
      return this.moveToNextBusinessDay(uaeTime, businessHours)
    }

    // Check if current time is within business hours
    if (hour < dayHours.start) {
      // Too early, move to start of business day
      const adjustedTime = new Date(uaeTime)
      adjustedTime.setHours(dayHours.start, 0, 0, 0)
      return { adjustedTime, wasAdjusted: true }
    }

    if (hour >= dayHours.end) {
      // Too late, move to next business day
      return this.moveToNextBusinessDay(uaeTime, businessHours)
    }

    // Within business hours
    return { adjustedTime: date, wasAdjusted: false }
  }

  private getBusinessHoursForDay(day: number, businessHours: UAEBusinessHours) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return businessHours[dayNames[day] as keyof UAEBusinessHours]
  }

  private moveToNextBusinessDay(
    date: Date,
    businessHours: UAEBusinessHours
  ): { adjustedTime: Date; wasAdjusted: boolean } {
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)
    nextDay.setHours(9, 0, 0, 0) // Default to 9 AM

    // Recursively adjust until we find a business day
    const result = this.adjustForBusinessHours(nextDay, businessHours)
    return { adjustedTime: result.adjustedTime, wasAdjusted: true }
  }

  private async adjustForHolidays(date: Date): Promise<{ adjustedTime: Date; wasAdjusted: boolean }> {
    const holidays = await this.getUAEHolidays(date.getFullYear())
    const isHoliday = holidays.some(holiday =>
      holiday.date.toDateString() === date.toDateString()
    )

    if (isHoliday) {
      // Move to next day
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      // Recursively check next day
      return await this.adjustForHolidays(nextDay)
    }

    return { adjustedTime: date, wasAdjusted: false }
  }

  private adjustForPrayerTimes(date: Date): { adjustedTime: Date; wasAdjusted: boolean } {
    const uaeTime = new Date(date.toLocaleString("en-US", { timeZone: this.UAE_TIMEZONE }))
    const hour = uaeTime.getHours()
    const minute = uaeTime.getMinutes()
    const timeInMinutes = hour * 60 + minute

    for (const prayer of this.PRAYER_TIMES_APPROXIMATE) {
      const prayerStart = prayer.hour * 60
      const prayerEnd = prayerStart + prayer.duration

      if (timeInMinutes >= prayerStart && timeInMinutes <= prayerEnd) {
        // During prayer time, move to after prayer
        const adjustedTime = new Date(uaeTime)
        adjustedTime.setHours(prayer.hour, prayer.duration, 0, 0)
        return { adjustedTime, wasAdjusted: true }
      }
    }

    return { adjustedTime: date, wasAdjusted: false }
  }

  private adjustForPreferredTimeSlot(
    date: Date,
    timeSlot: 'morning' | 'afternoon',
    businessHours: UAEBusinessHours
  ): { adjustedTime: Date; wasAdjusted: boolean } {
    const uaeTime = new Date(date.toLocaleString("en-US", { timeZone: this.UAE_TIMEZONE }))
    const hour = uaeTime.getHours()

    const morningStart = 9
    const morningEnd = 12
    const afternoonStart = 13
    const afternoonEnd = 17

    if (timeSlot === 'morning' && (hour < morningStart || hour >= morningEnd)) {
      const adjustedTime = new Date(uaeTime)
      if (hour < morningStart) {
        adjustedTime.setHours(morningStart, 0, 0, 0)
      } else {
        // Move to next day morning
        adjustedTime.setDate(adjustedTime.getDate() + 1)
        adjustedTime.setHours(morningStart, 0, 0, 0)
      }
      return { adjustedTime, wasAdjusted: true }
    }

    if (timeSlot === 'afternoon' && (hour < afternoonStart || hour >= afternoonEnd)) {
      const adjustedTime = new Date(uaeTime)
      if (hour < afternoonStart) {
        adjustedTime.setHours(afternoonStart, 0, 0, 0)
      } else {
        // Move to next day afternoon
        adjustedTime.setDate(adjustedTime.getDate() + 1)
        adjustedTime.setHours(afternoonStart, 0, 0, 0)
      }
      return { adjustedTime, wasAdjusted: true }
    }

    return { adjustedTime: date, wasAdjusted: false }
  }

  private adjustForUrgency(
    date: Date,
    urgency: 'low' | 'medium' | 'high' | 'urgent',
    maxDelayHours: number
  ): { adjustedTime: Date; wasAdjusted: boolean } {
    const now = new Date()
    const delayHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60)

    const urgencyDelayLimits = {
      urgent: 0.5,   // 30 minutes max
      high: 2,       // 2 hours max
      medium: 8,     // 8 hours max
      low: 24        // 24 hours max
    }

    const maxDelay = Math.min(urgencyDelayLimits[urgency], maxDelayHours)

    if (delayHours > maxDelay) {
      // Reduce delay to match urgency level
      const adjustedTime = new Date(now.getTime() + (maxDelay * 60 * 60 * 1000))
      return { adjustedTime, wasAdjusted: true }
    }

    return { adjustedTime: date, wasAdjusted: false }
  }

  private async optimizeForConsolidationBatch(
    date: Date,
    customerId: string
  ): Promise<{ adjustedTime: Date; wasAdjusted: boolean }> {
    // Check if there are other pending emails for this customer
    const pendingEmails = await prisma.emailLog.count({
      where: {
        customerId,
        deliveryStatus: 'SCHEDULED',
        sentAt: null
      }
    })

    if (pendingEmails > 0) {
      // Slight delay to allow for potential consolidation
      const adjustedTime = new Date(date.getTime() + (15 * 60 * 1000)) // 15 minutes
      return { adjustedTime, wasAdjusted: true }
    }

    return { adjustedTime: date, wasAdjusted: false }
  }

  private adjustForRamadan(date: Date): { adjustedTime: Date; wasAdjusted: boolean } {
    const uaeTime = new Date(date.toLocaleString("en-US", { timeZone: this.UAE_TIMEZONE }))
    const hour = uaeTime.getHours()

    // During Ramadan, avoid late afternoon (before Iftar) and early morning
    if (hour >= 16 && hour <= 19) {
      // Move to after 8 PM
      const adjustedTime = new Date(uaeTime)
      adjustedTime.setHours(20, 0, 0, 0)
      return { adjustedTime, wasAdjusted: true }
    }

    if (hour >= 4 && hour <= 7) {
      // Move to after 8 AM
      const adjustedTime = new Date(uaeTime)
      adjustedTime.setHours(8, 0, 0, 0)
      return { adjustedTime, wasAdjusted: true }
    }

    return { adjustedTime: date, wasAdjusted: false }
  }

  private calculateConfidenceScore(
    original: Date,
    scheduled: Date,
    appliedRules: string[],
    options: SchedulingOptions
  ): number {
    let confidence = 100

    // Reduce confidence based on delay
    const delayHours = (scheduled.getTime() - original.getTime()) / (1000 * 60 * 60)
    if (delayHours > 24) confidence -= 30
    else if (delayHours > 8) confidence -= 20
    else if (delayHours > 2) confidence -= 10

    // Increase confidence for business compliance
    if (appliedRules.includes('UAE_BUSINESS_HOURS')) confidence += 10
    if (appliedRules.includes('PRAYER_TIMES')) confidence += 10
    if (appliedRules.includes('UAE_HOLIDAYS')) confidence += 5

    // Adjust for urgency alignment
    if (options.urgencyLevel === 'urgent' && delayHours < 1) confidence += 15
    if (options.urgencyLevel === 'low' && delayHours < 8) confidence += 5

    return Math.max(0, Math.min(100, confidence))
  }

  private generateAlternatives(
    original: Date,
    scheduled: Date,
    businessHours: UAEBusinessHours,
    options: SchedulingOptions
  ): Array<{ time: Date; confidence: number; reason: string }> {
    const alternatives = []

    // Next business day option
    const nextBusinessDay = this.moveToNextBusinessDay(scheduled, businessHours)
    alternatives.push({
      time: nextBusinessDay.adjustedTime,
      confidence: 85,
      reason: 'Next business day delivery'
    })

    // Immediate send (if urgent)
    if (options.urgencyLevel === 'urgent') {
      alternatives.push({
        time: new Date(),
        confidence: 60,
        reason: 'Immediate delivery (urgent)'
      })
    }

    return alternatives.slice(0, 3) // Return top 3 alternatives
  }

  private generateSchedulingReason(appliedRules: string[], delayMinutes: number): string {
    if (appliedRules.length === 0) {
      return 'Immediate delivery'
    }

    const reasons = []

    if (appliedRules.includes('UAE_BUSINESS_HOURS')) {
      reasons.push('UAE business hours compliance')
    }

    if (appliedRules.includes('PRAYER_TIMES')) {
      reasons.push('prayer time sensitivity')
    }

    if (appliedRules.includes('UAE_HOLIDAYS')) {
      reasons.push('UAE holiday avoidance')
    }

    if (appliedRules.includes('RAMADAN_SENSITIVITY')) {
      reasons.push('Ramadan cultural sensitivity')
    }

    const reasonText = reasons.join(', ')
    const delayText = delayMinutes > 0 ? ` (delayed ${Math.round(delayMinutes)} minutes)` : ''

    return `Scheduled for ${reasonText}${delayText}`
  }

  private getFallbackSafeTime(): Date {
    const now = new Date()
    const safeTime = new Date(now)

    // Move to next business day at 10 AM
    safeTime.setDate(safeTime.getDate() + 1)
    safeTime.setHours(10, 0, 0, 0)

    // Ensure it's not weekend
    while (safeTime.getDay() === 5 || safeTime.getDay() === 6) {
      safeTime.setDate(safeTime.getDate() + 1)
    }

    return safeTime
  }

  private getHighestUrgency(urgencies: Array<'low' | 'medium' | 'high' | 'urgent'>): 'low' | 'medium' | 'high' | 'urgent' {
    if (urgencies.includes('urgent')) return 'urgent'
    if (urgencies.includes('high')) return 'high'
    if (urgencies.includes('medium')) return 'medium'
    return 'low'
  }

  private async getUAEHolidays(year: number): Promise<IslamicHoliday[]> {
    // This would typically fetch from an API or database
    // For now, return common UAE holidays (simplified)
    return [
      {
        name: 'New Year\'s Day',
        nameAr: 'رأس السنة الميلادية',
        date: new Date(year, 0, 1),
        isBusinessDay: false
      },
      {
        name: 'UAE National Day',
        nameAr: 'اليوم الوطني للإمارات',
        date: new Date(year, 11, 2),
        isBusinessDay: false
      }
      // Add more holidays as needed
    ]
  }

  private async isRamadanPeriod(): Promise<boolean> {
    // This would typically check against Islamic calendar
    // For now, return false (placeholder)
    return false
  }
}

// Singleton instance for global use
export const enhancedEmailSchedulingService = new EnhancedEmailSchedulingService()

// Backward compatibility export
export const emailSchedulingService = enhancedEmailSchedulingService