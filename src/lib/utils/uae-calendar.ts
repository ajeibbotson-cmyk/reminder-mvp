/**
 * UAE Business Calendar Utilities
 * 
 * This module provides utilities for handling UAE business hours, holidays, 
 * prayer times, and cultural considerations for automated email sequences.
 */

export interface UAEHoliday {
  date: string // ISO date string (YYYY-MM-DD)
  name: string
  nameAr: string
  type: 'PUBLIC' | 'ISLAMIC' | 'CULTURAL'
  observance: 'FULL_DAY' | 'HALF_DAY' | 'EVENING'
  moveable: boolean // Whether the date changes yearly (Islamic holidays)
}

export interface PrayerTimes {
  fajr: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

export interface BusinessHours {
  start: number // Hour in 24-hour format
  end: number   // Hour in 24-hour format
  timezone: string
}

export interface UAECalendarConfig {
  businessHours: BusinessHours
  workingDays: number[] // 0 = Sunday, 1 = Monday, etc.
  avoidPrayerTimes: boolean
  respectRamadan: boolean
  preferredSendTimes: number[] // Optimal hours for sending emails
}

// Default UAE business configuration
export const DEFAULT_UAE_CONFIG: UAECalendarConfig = {
  businessHours: {
    start: 9,  // 9 AM
    end: 18,   // 6 PM
    timezone: 'Asia/Dubai'
  },
  workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
  avoidPrayerTimes: true,
  respectRamadan: true,
  preferredSendTimes: [10, 11, 14, 15] // 10 AM, 11 AM, 2 PM, 3 PM
}

// UAE Public and Islamic Holidays for 2025
// Note: Islamic holidays are approximate and should be updated yearly
export const UAE_HOLIDAYS_2025: UAEHoliday[] = [
  // Fixed Public Holidays
  {
    date: '2025-01-01',
    name: 'New Year\'s Day',
    nameAr: 'رأس السنة الميلادية',
    type: 'PUBLIC',
    observance: 'FULL_DAY',
    moveable: false
  },
  {
    date: '2025-12-01',
    name: 'Commemoration Day',
    nameAr: 'يوم الشهيد',
    type: 'PUBLIC',
    observance: 'FULL_DAY',
    moveable: false
  },
  {
    date: '2025-12-02',
    name: 'UAE National Day',
    nameAr: 'اليوم الوطني لدولة الإمارات',
    type: 'PUBLIC',
    observance: 'FULL_DAY',
    moveable: false
  },
  {
    date: '2025-12-03',
    name: 'UAE National Day Holiday',
    nameAr: 'عطلة اليوم الوطني',
    type: 'PUBLIC',
    observance: 'FULL_DAY',
    moveable: false
  },
  
  // Islamic Holidays (approximate dates - should be confirmed)
  {
    date: '2025-03-30',
    name: 'Eid Al-Fitr',
    nameAr: 'عيد الفطر',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-03-31',
    name: 'Eid Al-Fitr Holiday',
    nameAr: 'عطلة عيد الفطر',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-04-01',
    name: 'Eid Al-Fitr Holiday',
    nameAr: 'عطلة عيد الفطر',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-06-06',
    name: 'Eid Al-Adha',
    nameAr: 'عيد الأضحى',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-06-07',
    name: 'Eid Al-Adha Holiday',
    nameAr: 'عطلة عيد الأضحى',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-06-08',
    name: 'Eid Al-Adha Holiday',
    nameAr: 'عطلة عيد الأضحى',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-06-27',
    name: 'Islamic New Year',
    nameAr: 'رأس السنة الهجرية',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-09-05',
    name: 'Prophet Muhammad\'s Birthday',
    nameAr: 'المولد النبوي الشريف',
    type: 'ISLAMIC',
    observance: 'FULL_DAY',
    moveable: true
  },
  {
    date: '2025-10-31',
    name: 'Laylat Al-Miraj',
    nameAr: 'ليلة الإسراء والمعراج',
    type: 'ISLAMIC',
    observance: 'HALF_DAY',
    moveable: true
  }
]

// Approximate prayer times for Dubai (varies by season)
export const DUBAI_PRAYER_TIMES: { [month: number]: PrayerTimes } = {
  1: { fajr: '06:20', dhuhr: '12:25', asr: '15:35', maghrib: '18:10', isha: '19:40' }, // January
  2: { fajr: '06:15', dhuhr: '12:30', asr: '15:55', maghrib: '18:25', isha: '19:55' }, // February
  3: { fajr: '05:55', dhuhr: '12:30', asr: '16:10', maghrib: '18:35', isha: '20:05' }, // March
  4: { fajr: '05:30', dhuhr: '12:25', asr: '16:20', maghrib: '18:45', isha: '20:15' }, // April
  5: { fajr: '05:10', dhuhr: '12:25', asr: '16:35', maghrib: '18:55', isha: '20:25' }, // May
  6: { fajr: '05:00', dhuhr: '12:30', asr: '16:45', maghrib: '19:05', isha: '20:35' }, // June
  7: { fajr: '05:05', dhuhr: '12:35', asr: '16:50', maghrib: '19:10', isha: '20:40' }, // July
  8: { fajr: '05:15', dhuhr: '12:35', asr: '16:45', maghrib: '19:05', isha: '20:35' }, // August
  9: { fajr: '05:25', dhuhr: '12:30', asr: '16:30', maghrib: '18:50', isha: '20:20' }, // September
  10: { fajr: '05:35', dhuhr: '12:25', asr: '16:10', maghrib: '18:35', isha: '20:05' }, // October
  11: { fajr: '05:50', dhuhr: '12:25', asr: '15:50', maghrib: '18:20', isha: '19:50' }, // November
  12: { fajr: '06:10', dhuhr: '12:25', asr: '15:40', maghrib: '18:15', isha: '19:45' }  // December
}

/**
 * Check if a given date is a UAE holiday
 */
export function isUAEHoliday(date: Date): UAEHoliday | null {
  const dateString = date.toISOString().split('T')[0]
  return UAE_HOLIDAYS_2025.find(holiday => holiday.date === dateString) || null
}

/**
 * Check if a given date is a UAE business day
 */
export function isUAEBusinessDay(date: Date, config: UAECalendarConfig = DEFAULT_UAE_CONFIG): boolean {
  const dayOfWeek = date.getDay()
  return config.workingDays.includes(dayOfWeek) && !isUAEHoliday(date)
}

/**
 * Check if a given time is within UAE business hours
 */
export function isWithinBusinessHours(date: Date, config: UAECalendarConfig = DEFAULT_UAE_CONFIG): boolean {
  const hour = date.getHours()
  return hour >= config.businessHours.start && hour < config.businessHours.end
}

/**
 * Check if a given time conflicts with prayer times
 */
export function isNearPrayerTime(date: Date, bufferMinutes: number = 30): boolean {
  const month = date.getMonth() + 1
  const time = date.toTimeString().slice(0, 5) // HH:MM format
  const prayerTimes = DUBAI_PRAYER_TIMES[month]
  
  if (!prayerTimes) return false
  
  // Check if current time is within buffer of Maghrib or Isha prayers
  const maghribTime = new Date(`1970-01-01T${prayerTimes.maghrib}:00`)
  const ishaTime = new Date(`1970-01-01T${prayerTimes.isha}:00`)
  const currentTime = new Date(`1970-01-01T${time}:00`)
  
  const maghribBuffer = new Date(maghribTime.getTime() - (bufferMinutes * 60000))
  const ishaBuffer = new Date(ishaTime.getTime() + (bufferMinutes * 60000))
  
  return currentTime >= maghribBuffer && currentTime <= ishaBuffer
}

/**
 * Get the next suitable business time for sending emails
 */
export function getNextBusinessTime(
  fromDate: Date, 
  config: UAECalendarConfig = DEFAULT_UAE_CONFIG
): Date {
  const nextDate = new Date(fromDate)
  
  // Find next business day
  while (!isUAEBusinessDay(nextDate, config)) {
    nextDate.setDate(nextDate.getDate() + 1)
    nextDate.setHours(config.businessHours.start, 0, 0, 0)
  }
  
  // Ensure it's within business hours
  if (!isWithinBusinessHours(nextDate, config)) {
    if (nextDate.getHours() < config.businessHours.start) {
      nextDate.setHours(config.businessHours.start, 0, 0, 0)
    } else {
      // Move to next business day
      nextDate.setDate(nextDate.getDate() + 1)
      nextDate.setHours(config.businessHours.start, 0, 0, 0)
      return getNextBusinessTime(nextDate, config)
    }
  }
  
  // Avoid prayer times if configured
  if (config.avoidPrayerTimes && isNearPrayerTime(nextDate)) {
    // Move to a preferred send time
    const preferredHour = config.preferredSendTimes.find(hour => 
      hour > nextDate.getHours() && hour < config.businessHours.end
    )
    
    if (preferredHour) {
      nextDate.setHours(preferredHour, 0, 0, 0)
    } else {
      // Move to next day
      nextDate.setDate(nextDate.getDate() + 1)
      nextDate.setHours(config.preferredSendTimes[0] || config.businessHours.start, 0, 0, 0)
      return getNextBusinessTime(nextDate, config)
    }
  }
  
  return nextDate
}

/**
 * Get the optimal send time for emails based on UAE best practices
 */
export function getOptimalSendTime(
  baseDate: Date,
  config: UAECalendarConfig = DEFAULT_UAE_CONFIG
): Date {
  const nextBusinessTime = getNextBusinessTime(baseDate, config)
  
  // Try to set to a preferred send time
  const currentHour = nextBusinessTime.getHours()
  const preferredHour = config.preferredSendTimes.find(hour => 
    hour >= currentHour && hour < config.businessHours.end
  ) || config.preferredSendTimes[0]
  
  if (preferredHour && preferredHour < config.businessHours.end) {
    nextBusinessTime.setHours(preferredHour, 0, 0, 0)
  }
  
  return nextBusinessTime
}

/**
 * Calculate business days between two dates (excluding weekends and holidays)
 */
export function getBusinessDaysBetween(
  startDate: Date, 
  endDate: Date, 
  config: UAECalendarConfig = DEFAULT_UAE_CONFIG
): number {
  let businessDays = 0
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    if (isUAEBusinessDay(currentDate, config)) {
      businessDays++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return businessDays
}

/**
 * Check if it's currently Ramadan (approximate)
 */
export function isRamadan(date: Date = new Date()): boolean {
  const year = date.getFullYear()
  
  // Approximate Ramadan dates for 2025 (should be updated yearly)
  if (year === 2025) {
    const ramadanStart = new Date('2025-02-28')
    const ramadanEnd = new Date('2025-03-29')
    return date >= ramadanStart && date <= ramadanEnd
  }
  
  // Add other years as needed
  return false
}

/**
 * Get Ramadan-adjusted business hours (if applicable)
 */
export function getRamadanBusinessHours(config: UAECalendarConfig = DEFAULT_UAE_CONFIG): BusinessHours {
  if (!config.respectRamadan) {
    return config.businessHours
  }
  
  // During Ramadan, many businesses operate shorter hours
  return {
    ...config.businessHours,
    start: 10, // Start later
    end: 15    // End earlier for Iftar preparation
  }
}

/**
 * Format time for UAE timezone
 */
export function formatUAETime(date: Date, locale: 'en' | 'ar' = 'en'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }
  
  return date.toLocaleTimeString(locale === 'ar' ? 'ar-AE' : 'en-AE', options)
}

/**
 * Format date for UAE timezone
 */
export function formatUAEDate(date: Date, locale: 'en' | 'ar' = 'en'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }
  
  return date.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', options)
}

/**
 * Get upcoming UAE holidays within a specified number of days
 */
export function getUpcomingHolidays(days: number = 30): UAEHoliday[] {
  const now = new Date()
  const future = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000))
  
  return UAE_HOLIDAYS_2025.filter(holiday => {
    const holidayDate = new Date(holiday.date)
    return holidayDate >= now && holidayDate <= future
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Cultural tone recommendations based on UAE business practices
 */
export const CULTURAL_TONE_GUIDELINES = {
  GENTLE: {
    description: 'Soft, understanding approach respecting relationships',
    recommendedFor: ['first_reminder', 'valued_customers', 'long_term_clients'],
    phrases: {
      en: ['hope all is well', 'gentle reminder', 'we understand', 'at your convenience'],
      ar: ['نتمنى أن تكونوا بخير', 'تذكير لطيف', 'نتفهم', 'في الوقت المناسب لكم']
    }
  },
  PROFESSIONAL: {
    description: 'Business-like, respectful tone',
    recommendedFor: ['standard_reminders', 'sme_clients', 'regular_follow_ups'],
    phrases: {
      en: ['as per our records', 'kindly arrange', 'we appreciate', 'please confirm'],
      ar: ['حسب سجلاتنا', 'نرجو ترتيب', 'نقدر', 'يرجى التأكيد']
    }
  },
  FIRM: {
    description: 'Direct but still respectful',
    recommendedFor: ['overdue_payments', 'repeat_offenders', 'final_notices'],
    phrases: {
      en: ['immediate attention required', 'payment is overdue', 'urgent action needed'],
      ar: ['مطلوب اهتمام فوري', 'الدفع متأخر', 'مطلوب إجراء عاجل']
    }
  },
  URGENT: {
    description: 'Immediate action required',
    recommendedFor: ['final_demands', 'legal_notices', 'critical_situations'],
    phrases: {
      en: ['final notice', 'immediate payment required', 'legal action may follow'],
      ar: ['إشعار أخير', 'مطلوب دفع فوري', 'قد يتبع إجراء قانوني']
    }
  }
}

/**
 * Get recommended cultural tone based on context
 */
export function getRecommendedTone(context: {
  attemptNumber: number
  daysPastDue: number
  customerType: 'INDIVIDUAL' | 'SME' | 'ENTERPRISE'
  paymentHistory: 'EXCELLENT' | 'GOOD' | 'POOR'
  relationshipLength: number // months
}): keyof typeof CULTURAL_TONE_GUIDELINES {
  const { attemptNumber, daysPastDue, customerType, paymentHistory, relationshipLength } = context
  
  // Long-term, excellent customers get gentle treatment
  if (relationshipLength > 24 && paymentHistory === 'EXCELLENT' && attemptNumber <= 2) {
    return 'GENTLE'
  }
  
  // Poor payment history gets firmer treatment sooner
  if (paymentHistory === 'POOR' && (attemptNumber > 2 || daysPastDue > 14)) {
    return 'FIRM'
  }
  
  // Very overdue or many attempts
  if (daysPastDue > 45 || attemptNumber > 4) {
    return 'URGENT'
  }
  
  // Firm approach for significantly overdue payments
  if (daysPastDue > 21 || attemptNumber > 3) {
    return 'FIRM'
  }
  
  // Default to professional
  return 'PROFESSIONAL'
}

export default {
  isUAEHoliday,
  isUAEBusinessDay,
  isWithinBusinessHours,
  isNearPrayerTime,
  getNextBusinessTime,
  getOptimalSendTime,
  getBusinessDaysBetween,
  isRamadan,
  getRamadanBusinessHours,
  formatUAETime,
  formatUAEDate,
  getUpcomingHolidays,
  getRecommendedTone,
  DEFAULT_UAE_CONFIG,
  UAE_HOLIDAYS_2025,
  DUBAI_PRAYER_TIMES,
  CULTURAL_TONE_GUIDELINES
}