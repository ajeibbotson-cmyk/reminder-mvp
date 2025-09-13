import { 
  isUAEBusinessHours as isBusinessHours, 
  getNextUAEBusinessHour as getNextBusinessHour 
} from '../vat-calculator'

export interface UAEBusinessHoursConfig {
  workingDays: number[] // 0=Sunday, 1=Monday, etc.
  startHour: number
  endHour: number
  timezone: string
  lunchBreakStart?: number
  lunchBreakEnd?: number
  prayerTimes?: {
    fajr: string
    dhuhr: string
    asr: string
    maghrib: string
    isha: string
  }
}

export interface UAEHoliday {
  date: Date
  name: string
  type: 'PUBLIC' | 'ISLAMIC' | 'NATIONAL'
  isRecurring: boolean
}

export interface ScheduleConfig {
  preferredDays: number[] // Tuesday-Thursday = [2, 3, 4]
  preferredHours: number[] // 10-11 AM = [10, 11]
  avoidPrayerTimes: boolean
  respectRamadan: boolean
  culturalTone: 'FORMAL' | 'BUSINESS' | 'FRIENDLY'
}

/**
 * UAE Business Hours Service
 * Manages business hours, holidays, prayer times, and cultural timing for UAE businesses
 */
export class UAEBusinessHoursService {
  private static readonly DEFAULT_CONFIG: UAEBusinessHoursConfig = {
    workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
    startHour: 8, // 8 AM
    endHour: 18, // 6 PM
    timezone: 'Asia/Dubai',
    lunchBreakStart: 12, // 12 PM
    lunchBreakEnd: 13, // 1 PM
    prayerTimes: {
      fajr: '05:30',
      dhuhr: '12:15',
      asr: '15:30',
      maghrib: '18:30',
      isha: '20:00'
    }
  }

  private static readonly UAE_HOLIDAYS_2024: UAEHoliday[] = [
    { date: new Date('2024-01-01'), name: 'New Year Day', type: 'PUBLIC', isRecurring: true },
    { date: new Date('2024-04-09'), name: 'Eid Al Fitr', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-04-10'), name: 'Eid Al Fitr Holiday', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-04-11'), name: 'Eid Al Fitr Holiday', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-06-15'), name: 'Arafat Day', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-06-16'), name: 'Eid Al Adha', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-06-17'), name: 'Eid Al Adha Holiday', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-06-18'), name: 'Eid Al Adha Holiday', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-07-07'), name: 'Islamic New Year', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-09-15'), name: 'Prophet Muhammad Birthday', type: 'ISLAMIC', isRecurring: false },
    { date: new Date('2024-12-01'), name: 'Commemoration Day', type: 'NATIONAL', isRecurring: true },
    { date: new Date('2024-12-02'), name: 'UAE National Day', type: 'NATIONAL', isRecurring: true },
    { date: new Date('2024-12-03'), name: 'UAE National Day Holiday', type: 'NATIONAL', isRecurring: true }
  ]

  private config: UAEBusinessHoursConfig
  private holidays: UAEHoliday[]

  constructor(
    config: Partial<UAEBusinessHoursConfig> = {},
    customHolidays: UAEHoliday[] = []
  ) {
    this.config = { ...UAEBusinessHoursService.DEFAULT_CONFIG, ...config }
    this.holidays = [...UAEBusinessHoursService.UAE_HOLIDAYS_2024, ...customHolidays]
  }

  /**
   * Check if given date/time is within UAE business hours
   */
  isBusinessHours(date: Date): boolean {
    return isBusinessHours(date, {
      workingDays: this.config.workingDays,
      startHour: this.config.startHour,
      endHour: this.config.endHour,
      timezone: this.config.timezone
    })
  }

  /**
   * Get next business hour from given date
   */
  getNextBusinessHour(date: Date): Date {
    return getNextBusinessHour(date, {
      workingDays: this.config.workingDays,
      startHour: this.config.startHour,
      endHour: this.config.endHour,
      timezone: this.config.timezone
    })
  }

  /**
   * Check if date is a UAE holiday
   */
  isUAEHoliday(date: Date): boolean {
    return this.holidays.some(holiday => 
      holiday.date.getFullYear() === date.getFullYear() &&
      holiday.date.getMonth() === date.getMonth() &&
      holiday.date.getDate() === date.getDate()
    )
  }

  /**
   * Check if time conflicts with prayer times
   */
  isPrayerTime(date: Date, bufferMinutes = 15): boolean {
    if (!this.config.prayerTimes) return false

    try {
      const uaeDate = new Date(date.toLocaleString('en-US', { timeZone: this.config.timezone }))
      const currentTime = `${uaeDate.getHours().toString().padStart(2, '0')}:${uaeDate.getMinutes().toString().padStart(2, '0')}`
      
      for (const [prayerName, prayerTime] of Object.entries(this.config.prayerTimes)) {
        const [hour, minute] = prayerTime.split(':').map(Number)
        const prayerStart = new Date(uaeDate)
        prayerStart.setHours(hour, minute - bufferMinutes, 0, 0)
        
        const prayerEnd = new Date(uaeDate)
        prayerEnd.setHours(hour, minute + bufferMinutes, 0, 0)
        
        if (uaeDate >= prayerStart && uaeDate <= prayerEnd) {
          return true
        }
      }
      
      return false
    } catch {
      return false
    }
  }

  /**
   * Get optimal send time for UAE business communications
   * Returns Tuesday-Thursday, 10-11 AM by default
   */
  getOptimalSendTime(fromDate?: Date): Date {
    const baseDate = fromDate || new Date()
    let optimalDate = new Date(baseDate)
    
    // Optimal days: Tuesday (2), Wednesday (3), Thursday (4)
    // Optimal hours: 10-11 AM
    const optimalDays = [2, 3, 4]
    const optimalHour = 10
    
    // Find next optimal day
    while (true) {
      const dayOfWeek = optimalDate.getDay()
      
      if (optimalDays.includes(dayOfWeek) && 
          !this.isUAEHoliday(optimalDate) &&
          !this.isPrayerTime(optimalDate)) {
        
        optimalDate.setHours(optimalHour, 0, 0, 0)
        
        // If this time has passed today, try tomorrow
        if (optimalDate <= baseDate) {
          optimalDate.setDate(optimalDate.getDate() + 1)
          continue
        }
        
        break
      }
      
      optimalDate.setDate(optimalDate.getDate() + 1)
      
      // Prevent infinite loop
      if (optimalDate.getTime() - baseDate.getTime() > 14 * 24 * 60 * 60 * 1000) {
        optimalDate = this.getNextBusinessHour(baseDate)
        break
      }
    }
    
    return optimalDate
  }

  /**
   * Get next available send time considering all constraints
   */
  getNextAvailableSendTime(
    fromDate: Date,
    scheduleConfig: Partial<ScheduleConfig> = {}
  ): Date {
    const config: ScheduleConfig = {
      preferredDays: [2, 3, 4], // Tuesday-Thursday
      preferredHours: [10, 11], // 10-11 AM
      avoidPrayerTimes: true,
      respectRamadan: true,
      culturalTone: 'BUSINESS',
      ...scheduleConfig
    }

    let candidateDate = new Date(fromDate)
    const maxIterations = 100

    for (let i = 0; i < maxIterations; i++) {
      // Check if it's a business hour
      if (!this.isBusinessHours(candidateDate)) {
        candidateDate = this.getNextBusinessHour(candidateDate)
        continue
      }

      // Check if it's a holiday
      if (this.isUAEHoliday(candidateDate)) {
        candidateDate.setDate(candidateDate.getDate() + 1)
        candidateDate.setHours(this.config.startHour, 0, 0, 0)
        continue
      }

      // Check prayer times if enabled
      if (config.avoidPrayerTimes && this.isPrayerTime(candidateDate)) {
        candidateDate.setMinutes(candidateDate.getMinutes() + 30)
        continue
      }

      // Check preferred days
      const dayOfWeek = candidateDate.getDay()
      if (config.preferredDays.length > 0 && !config.preferredDays.includes(dayOfWeek)) {
        candidateDate.setDate(candidateDate.getDate() + 1)
        candidateDate.setHours(this.config.startHour, 0, 0, 0)
        continue
      }

      // Check preferred hours
      const hour = candidateDate.getHours()
      if (config.preferredHours.length > 0 && !config.preferredHours.includes(hour)) {
        if (hour < Math.min(...config.preferredHours)) {
          candidateDate.setHours(Math.min(...config.preferredHours), 0, 0, 0)
        } else {
          candidateDate.setDate(candidateDate.getDate() + 1)
          candidateDate.setHours(Math.min(...config.preferredHours), 0, 0, 0)
        }
        continue
      }

      // All conditions met
      return candidateDate
    }

    // Fallback to next business hour if no optimal time found
    return this.getNextBusinessHour(fromDate)
  }

  /**
   * Check if current period is Ramadan
   */
  isRamadan(date: Date = new Date()): boolean {
    // Ramadan dates vary each year - this is a simplified implementation
    // In production, you'd use a proper Islamic calendar library
    const year = date.getFullYear()
    
    // Approximate Ramadan dates for 2024-2025
    const ramadanPeriods = [
      { start: new Date('2024-03-10'), end: new Date('2024-04-09') },
      { start: new Date('2025-02-28'), end: new Date('2025-03-30') }
    ]
    
    return ramadanPeriods.some(period => 
      date >= period.start && date <= period.end
    )
  }

  /**
   * Get Ramadan-adjusted schedule configuration
   */
  getRamadanScheduleConfig(): ScheduleConfig {
    return {
      preferredDays: [0, 1, 2, 3], // Sunday-Wednesday (avoiding Thursday before weekend)
      preferredHours: [9, 10, 14, 15], // Morning or mid-afternoon
      avoidPrayerTimes: true,
      respectRamadan: true,
      culturalTone: 'FORMAL'
    }
  }

  /**
   * Get all holidays for a given year
   */
  getHolidaysForYear(year: number): UAEHoliday[] {
    return this.holidays.filter(holiday => 
      holiday.date.getFullYear() === year
    )
  }

  /**
   * Add custom holidays
   */
  addHolidays(holidays: UAEHoliday[]): void {
    this.holidays.push(...holidays)
  }

  /**
   * Update business hours configuration
   */
  updateConfig(config: Partial<UAEBusinessHoursConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): UAEBusinessHoursConfig {
    return { ...this.config }
  }

  /**
   * Validate if a scheduled time is appropriate for UAE business culture
   */
  validateScheduledTime(date: Date): {
    isValid: boolean
    reasons: string[]
    suggestions: string[]
  } {
    const reasons: string[] = []
    const suggestions: string[] = []

    if (!this.isBusinessHours(date)) {
      reasons.push('Outside business hours')
      suggestions.push('Schedule during Sunday-Thursday, 8 AM - 6 PM')
    }

    if (this.isUAEHoliday(date)) {
      const holiday = this.holidays.find(h => 
        h.date.getFullYear() === date.getFullYear() &&
        h.date.getMonth() === date.getMonth() &&
        h.date.getDate() === date.getDate()
      )
      reasons.push(`UAE Holiday: ${holiday?.name}`)
      suggestions.push('Reschedule to next business day')
    }

    if (this.isPrayerTime(date)) {
      reasons.push('Conflicts with prayer time')
      suggestions.push('Avoid sending during prayer times (±15 minutes)')
    }

    const dayOfWeek = date.getDay()
    if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday, Saturday
      reasons.push('Weekend in UAE')
      suggestions.push('Schedule for Sunday-Thursday')
    }

    if (this.isRamadan(date)) {
      const hour = date.getHours()
      if (hour < 9 || hour > 15) {
        reasons.push('Ramadan period - suboptimal timing')
        suggestions.push('During Ramadan, prefer 9 AM - 3 PM')
      }
    }

    return {
      isValid: reasons.length === 0,
      reasons,
      suggestions
    }
  }
}

// Singleton instance for global use
export const uaeBusinessHours = new UAEBusinessHoursService()

// Helper functions for backward compatibility
export const isUAEBusinessHours = (date: Date): boolean => 
  uaeBusinessHours.isBusinessHours(date)

export const getNextUAEBusinessHour = (date: Date): Date => 
  uaeBusinessHours.getNextBusinessHour(date)

export const isUAEHoliday = (date: Date): boolean => 
  uaeBusinessHours.isUAEHoliday(date)

export const isPrayerTime = (date: Date): boolean => 
  uaeBusinessHours.isPrayerTime(date)

export const getOptimalSendTime = (): Date => 
  uaeBusinessHours.getOptimalSendTime()