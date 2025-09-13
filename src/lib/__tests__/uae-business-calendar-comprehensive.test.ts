/**
 * Comprehensive Test Suite for UAE Business Calendar and Hours
 * Tests business hours, prayer times, Islamic holidays, and cultural timing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
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
} from '../utils/uae-calendar'

describe('UAE Business Calendar Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('UAE Business Week (Sunday-Thursday)', () => {
    describe('Business Day Identification', () => {
      it('should correctly identify UAE business days', () => {
        // Test a typical business week in January 2025
        const sunday = new Date('2025-01-05')    // Business day
        const monday = new Date('2025-01-06')    // Business day
        const tuesday = new Date('2025-01-07')   // Business day
        const wednesday = new Date('2025-01-08') // Business day
        const thursday = new Date('2025-01-09')  // Business day
        const friday = new Date('2025-01-10')    // Weekend
        const saturday = new Date('2025-01-11')  // Weekend

        expect(isUAEBusinessDay(sunday)).toBe(true)
        expect(isUAEBusinessDay(monday)).toBe(true)
        expect(isUAEBusinessDay(tuesday)).toBe(true)
        expect(isUAEBusinessDay(wednesday)).toBe(true)
        expect(isUAEBusinessDay(thursday)).toBe(true)
        expect(isUAEBusinessDay(friday)).toBe(false)
        expect(isUAEBusinessDay(saturday)).toBe(false)
      })

      it('should exclude holidays from business days', () => {
        // UAE National Day (December 2, 2025) - falls on Tuesday
        const nationalDay = new Date('2025-12-02')
        expect(isUAEBusinessDay(nationalDay)).toBe(false)
        
        // New Year's Day (January 1, 2025) - falls on Wednesday
        const newYear = new Date('2025-01-01')
        expect(isUAEBusinessDay(newYear)).toBe(false)
      })

      it('should handle weekend holidays correctly', () => {
        // If a holiday falls on weekend, still not a business day
        const weekendHoliday = new Date('2025-06-07') // Eid Al-Adha Holiday (Saturday)
        expect(isUAEBusinessDay(weekendHoliday)).toBe(false)
      })
    })

    describe('Business Hours (9 AM - 6 PM)', () => {
      it('should validate standard UAE business hours', () => {
        const testCases = [
          { hour: 8, expected: false },  // Before business hours
          { hour: 9, expected: true },   // Start of business hours
          { hour: 12, expected: true },  // Lunch time
          { hour: 15, expected: true },  // Afternoon
          { hour: 17, expected: true },  // End of business hours
          { hour: 18, expected: false }, // After business hours
          { hour: 22, expected: false }  // Evening
        ]

        testCases.forEach(({ hour, expected }) => {
          const testDate = new Date('2025-01-06') // Monday
          testDate.setHours(hour, 0, 0, 0)
          
          expect(isWithinBusinessHours(testDate)).toBe(expected)
        })
      })

      it('should work with custom business hour configurations', () => {
        const customConfig = {
          ...DEFAULT_UAE_CONFIG,
          businessHours: {
            start: 8,
            end: 17,
            timezone: 'Asia/Dubai'
          }
        }

        const morningDate = new Date('2025-01-06')
        morningDate.setHours(8, 30, 0, 0)

        expect(isWithinBusinessHours(morningDate, customConfig)).toBe(true)
      })
    })

    describe('Next Business Time Calculation', () => {
      it('should find next business time when current time is outside business hours', () => {
        // Friday evening (weekend)
        const fridayEvening = new Date('2025-01-10')
        fridayEvening.setHours(19, 0, 0, 0)

        const nextBusinessTime = getNextBusinessTime(fridayEvening)

        // Should be Sunday 9 AM
        expect(nextBusinessTime.getDay()).toBe(0) // Sunday
        expect(nextBusinessTime.getHours()).toBe(9)
        expect(nextBusinessTime.getMinutes()).toBe(0)
      })

      it('should return current time if already within business hours', () => {
        const mondayMorning = new Date('2025-01-06')
        mondayMorning.setHours(10, 30, 0, 0)

        const nextBusinessTime = getNextBusinessTime(mondayMorning)

        expect(nextBusinessTime.getTime()).toBe(mondayMorning.getTime())
      })

      it('should skip holidays when finding next business time', () => {
        // Day before UAE National Day
        const beforeNationalDay = new Date('2025-12-01')
        beforeNationalDay.setHours(19, 0, 0, 0) // After hours

        const nextBusinessTime = getNextBusinessTime(beforeNationalDay)

        // Should skip December 2 (National Day) and December 3 (Holiday)
        // and go to December 4
        expect(nextBusinessTime.getDate()).toBe(4)
        expect(nextBusinessTime.getMonth()).toBe(11) // December (0-indexed)
      })
    })

    describe('Business Days Calculation', () => {
      it('should correctly count business days between dates', () => {
        // Week with no holidays: January 6-10, 2025 (Monday-Friday)
        const startDate = new Date('2025-01-06') // Monday
        const endDate = new Date('2025-01-10')   // Friday

        const businessDays = getBusinessDaysBetween(startDate, endDate)

        // Monday, Tuesday, Wednesday, Thursday = 4 business days
        expect(businessDays).toBe(4)
      })

      it('should exclude holidays from business day count', () => {
        // Include UAE National Day week
        const startDate = new Date('2025-12-01') // Monday
        const endDate = new Date('2025-12-05')   // Friday

        const businessDays = getBusinessDaysBetween(startDate, endDate)

        // Should exclude December 2 and 3 (holidays), count only Dec 1, 4, 5
        expect(businessDays).toBe(3)
      })

      it('should handle same day calculation', () => {
        const sameDay = new Date('2025-01-06') // Monday

        const businessDays = getBusinessDaysBetween(sameDay, sameDay)

        expect(businessDays).toBe(1)
      })
    })
  })

  describe('Prayer Time Awareness (5 Daily Prayers)', () => {
    describe('Prayer Time Detection', () => {
      it('should detect all five daily prayer times', () => {
        const januaryPrayers = DUBAI_PRAYER_TIMES[1]

        expect(januaryPrayers).toHaveProperty('fajr')
        expect(januaryPrayers).toHaveProperty('dhuhr')
        expect(januaryPrayers).toHaveProperty('asr')
        expect(januaryPrayers).toHaveProperty('maghrib')
        expect(januaryPrayers).toHaveProperty('isha')

        // Verify time format (HH:MM)
        const timeRegex = /^\d{2}:\d{2}$/
        expect(timeRegex.test(januaryPrayers.fajr)).toBe(true)
        expect(timeRegex.test(januaryPrayers.dhuhr)).toBe(true)
        expect(timeRegex.test(januaryPrayers.asr)).toBe(true)
        expect(timeRegex.test(januaryPrayers.maghrib)).toBe(true)
        expect(timeRegex.test(januaryPrayers.isha)).toBe(true)
      })

      it('should provide prayer times for all 12 months', () => {
        for (let month = 1; month <= 12; month++) {
          const prayers = DUBAI_PRAYER_TIMES[month as keyof typeof DUBAI_PRAYER_TIMES]
          
          expect(prayers).toBeDefined()
          expect(prayers.fajr).toBeDefined()
          expect(prayers.dhuhr).toBeDefined()
          expect(prayers.asr).toBeDefined()
          expect(prayers.maghrib).toBeDefined()
          expect(prayers.isha).toBeDefined()
        }
      })

      it('should show seasonal variation in prayer times', () => {
        const januaryPrayers = DUBAI_PRAYER_TIMES[1]  // Winter
        const julypPrayers = DUBAI_PRAYER_TIMES[7]    // Summer

        // Fajr should be later in winter than summer
        const januaryFajr = new Date(`1970-01-01T${januaryPrayers.fajr}:00`)
        const julyFajr = new Date(`1970-01-01T${julypPrayers.fajr}:00`)

        expect(januaryFajr.getTime()).toBeGreaterThan(julyFajr.getTime())

        // Maghrib should be earlier in winter than summer
        const januaryMaghrib = new Date(`1970-01-01T${januaryPrayers.maghrib}:00`)
        const julyMaghrib = new Date(`1970-01-01T${julypPrayers.maghrib}:00`)

        expect(januaryMaghrib.getTime()).toBeLessThan(julyMaghrib.getTime())
      })
    })

    describe('Prayer Time Buffer Zones', () => {
      it('should detect when communication time is near Maghrib prayer', () => {
        // January Maghrib is at 18:10
        const beforeMaghrib = new Date('2025-01-15T17:50:00') // 20 min before
        const duringMaghrib = new Date('2025-01-15T18:10:00') // Exact time
        const afterMaghrib = new Date('2025-01-15T18:35:00')  // 25 min after

        expect(isNearPrayerTime(beforeMaghrib, 30)).toBe(true)
        expect(isNearPrayerTime(duringMaghrib, 30)).toBe(true)
        expect(isNearPrayerTime(afterMaghrib, 30)).toBe(true)
      })

      it('should detect when communication time is near Isha prayer', () => {
        // January Isha is at 19:40
        const beforeIsha = new Date('2025-01-15T19:20:00') // 20 min before
        const afterIsha = new Date('2025-01-15T20:05:00')  // 25 min after

        expect(isNearPrayerTime(beforeIsha, 30)).toBe(true)
        expect(isNearPrayerTime(afterIsha, 30)).toBe(true)
      })

      it('should not detect prayer times outside the buffer zone', () => {
        const morningTime = new Date('2025-01-15T10:00:00')
        const afternoonTime = new Date('2025-01-15T15:00:00')

        expect(isNearPrayerTime(morningTime, 30)).toBe(false)
        expect(isNearPrayerTime(afternoonTime, 30)).toBe(false)
      })

      it('should work with custom buffer times', () => {
        const maghribTime = new Date('2025-01-15T18:10:00')
        const justOutsideBuffer = new Date('2025-01-15T17:45:00') // 25 min before

        expect(isNearPrayerTime(justOutsideBuffer, 20)).toBe(false) // 20 min buffer
        expect(isNearPrayerTime(justOutsideBuffer, 30)).toBe(true)  // 30 min buffer
      })
    })

    describe('Prayer Time Integration with Scheduling', () => {
      it('should avoid scheduling during prayer times', () => {
        const maghribTime = new Date('2025-01-15T18:10:00')
        
        const optimalTime = getOptimalSendTime(maghribTime)

        // Should not be during Maghrib-Isha buffer period
        expect(isNearPrayerTime(optimalTime)).toBe(false)
      })

      it('should respect prayer times in business hour calculations', () => {
        const configWithPrayerAvoidance = {
          ...DEFAULT_UAE_CONFIG,
          avoidPrayerTimes: true
        }

        const configWithoutPrayerAvoidance = {
          ...DEFAULT_UAE_CONFIG,
          avoidPrayerTimes: false
        }

        const maghribTime = new Date('2025-01-15T18:05:00')

        const timeWithAvoidance = getNextBusinessTime(maghribTime, configWithPrayerAvoidance)
        const timeWithoutAvoidance = getNextBusinessTime(maghribTime, configWithoutPrayerAvoidance)

        // With avoidance should be different from without
        expect(timeWithAvoidance.getTime()).not.toBe(timeWithoutAvoidance.getTime())
      })
    })
  })

  describe('Islamic Holiday Detection', () => {
    describe('Major Islamic Holidays', () => {
      it('should identify Eid Al-Fitr celebrations', () => {
        const eidAlFitrHolidays = UAE_HOLIDAYS_2025.filter(h => 
          h.name.includes('Eid Al-Fitr') && h.type === 'ISLAMIC'
        )

        expect(eidAlFitrHolidays.length).toBeGreaterThanOrEqual(3) // Usually 3 days
        expect(eidAlFitrHolidays.every(h => h.moveable)).toBe(true)
        expect(eidAlFitrHolidays.every(h => h.observance === 'FULL_DAY')).toBe(true)
      })

      it('should identify Eid Al-Adha celebrations', () => {
        const eidAlAdhaHolidays = UAE_HOLIDAYS_2025.filter(h => 
          h.name.includes('Eid Al-Adha') && h.type === 'ISLAMIC'
        )

        expect(eidAlAdhaHolidays.length).toBeGreaterThanOrEqual(3) // Usually 3 days
        expect(eidAlAdhaHolidays.every(h => h.moveable)).toBe(true)
        expect(eidAlAdhaHolidays.every(h => h.observance === 'FULL_DAY')).toBe(true)
      })

      it('should identify Islamic New Year', () => {
        const islamicNewYear = UAE_HOLIDAYS_2025.find(h => 
          h.name.includes('Islamic New Year')
        )

        expect(islamicNewYear).toBeDefined()
        expect(islamicNewYear?.type).toBe('ISLAMIC')
        expect(islamicNewYear?.moveable).toBe(true)
      })

      it('should identify Prophet Muhammad\'s Birthday', () => {
        const prophetBirthday = UAE_HOLIDAYS_2025.find(h => 
          h.name.includes('Prophet Muhammad')
        )

        expect(prophetBirthday).toBeDefined()
        expect(prophetBirthday?.type).toBe('ISLAMIC')
        expect(prophetBirthday?.moveable).toBe(true)
      })

      it('should identify Laylat Al-Miraj', () => {
        const laylahAlMiraj = UAE_HOLIDAYS_2025.find(h => 
          h.name.includes('Laylat Al-Miraj')
        )

        expect(laylahAlMiraj).toBeDefined()
        expect(laylahAlMiraj?.type).toBe('ISLAMIC')
        expect(laylahAlMiraj?.observance).toBe('HALF_DAY')
      })
    })

    describe('UAE National Holidays', () => {
      it('should identify UAE National Day and related holidays', () => {
        const nationalHolidays = UAE_HOLIDAYS_2025.filter(h => 
          (h.name.includes('UAE National Day') || h.name.includes('Commemoration Day')) &&
          h.type === 'PUBLIC'
        )

        expect(nationalHolidays.length).toBeGreaterThanOrEqual(3) // Commemoration + National Day + Holiday
        expect(nationalHolidays.every(h => !h.moveable)).toBe(true) // Fixed dates
        expect(nationalHolidays.every(h => h.observance === 'FULL_DAY')).toBe(true)
      })

      it('should have Arabic translations for all holidays', () => {
        UAE_HOLIDAYS_2025.forEach(holiday => {
          expect(holiday.nameAr).toBeDefined()
          expect(holiday.nameAr.length).toBeGreaterThan(0)
          expect(holiday.nameAr).not.toBe(holiday.name) // Should be different from English
        })
      })
    })

    describe('Holiday Date Validation', () => {
      it('should correctly identify specific holiday dates', () => {
        const testCases = [
          { date: '2025-01-01', expected: 'New Year\'s Day' },
          { date: '2025-12-01', expected: 'Commemoration Day' },
          { date: '2025-12-02', expected: 'UAE National Day' },
          { date: '2025-03-30', expected: 'Eid Al-Fitr' }
        ]

        testCases.forEach(({ date, expected }) => {
          const testDate = new Date(date)
          const holiday = isUAEHoliday(testDate)
          
          expect(holiday).toBeTruthy()
          expect(holiday?.name).toContain(expected)
        })
      })

      it('should return null for non-holiday dates', () => {
        const regularDates = [
          '2025-01-15',
          '2025-03-15',
          '2025-05-15',
          '2025-08-15',
          '2025-10-15'
        ]

        regularDates.forEach(date => {
          const testDate = new Date(date)
          const holiday = isUAEHoliday(testDate)
          
          expect(holiday).toBeNull()
        })
      })
    })

    describe('Upcoming Holiday Calculation', () => {
      it('should find upcoming holidays within specified timeframe', () => {
        // Mock current date to January 1, 2025
        const mockDate = new Date('2025-01-01')
        jest.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime())

        const upcomingHolidays = getUpcomingHolidays(90) // Next 90 days

        expect(upcomingHolidays.length).toBeGreaterThan(0)
        expect(upcomingHolidays.every(h => {
          const holidayDate = new Date(h.date)
          return holidayDate >= mockDate
        })).toBe(true)

        // Should be sorted by date
        for (let i = 1; i < upcomingHolidays.length; i++) {
          const prevDate = new Date(upcomingHolidays[i-1].date)
          const currDate = new Date(upcomingHolidays[i].date)
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime())
        }

        jest.restoreAllMocks()
      })

      it('should handle different timeframe periods', () => {
        const mockDate = new Date('2025-01-01')
        jest.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime())

        const next30Days = getUpcomingHolidays(30)
        const next90Days = getUpcomingHolidays(90)
        const next365Days = getUpcomingHolidays(365)

        expect(next30Days.length).toBeLessThanOrEqual(next90Days.length)
        expect(next90Days.length).toBeLessThanOrEqual(next365Days.length)

        jest.restoreAllMocks()
      })
    })
  })

  describe('Ramadan Special Considerations', () => {
    describe('Ramadan Period Detection', () => {
      it('should correctly identify Ramadan 2025 period', () => {
        const ramadanPeriod = [
          new Date('2025-02-28'), // Start of Ramadan
          new Date('2025-03-15'), // Middle of Ramadan
          new Date('2025-03-29')  // End of Ramadan
        ]

        const nonRamadanPeriod = [
          new Date('2025-02-25'), // Before Ramadan
          new Date('2025-04-05'),  // After Ramadan
          new Date('2025-06-15')   // Much later
        ]

        ramadanPeriod.forEach(date => {
          expect(isRamadan(date)).toBe(true)
        })

        nonRamadanPeriod.forEach(date => {
          expect(isRamadan(date)).toBe(false)
        })
      })
    })

    describe('Ramadan Business Hours Adjustment', () => {
      it('should provide adjusted business hours during Ramadan', () => {
        const standardConfig = DEFAULT_UAE_CONFIG
        const ramadanHours = getRamadanBusinessHours(standardConfig)

        // Ramadan hours should be shorter
        expect(ramadanHours.start).toBeGreaterThanOrEqual(standardConfig.businessHours.start)
        expect(ramadanHours.end).toBeLessThanOrEqual(standardConfig.businessHours.end)
        
        // Should end significantly earlier for Iftar
        expect(ramadanHours.end).toBeLessThanOrEqual(15) // 3 PM or earlier
      })

      it('should respect respectRamadan configuration', () => {
        const configWithRamadan = { ...DEFAULT_UAE_CONFIG, respectRamadan: true }
        const configWithoutRamadan = { ...DEFAULT_UAE_CONFIG, respectRamadan: false }

        const ramadanHours = getRamadanBusinessHours(configWithRamadan)
        const normalHours = getRamadanBusinessHours(configWithoutRamadan)

        expect(ramadanHours.end).toBeLessThan(normalHours.end)
      })
    })

    describe('Ramadan Cultural Sensitivity', () => {
      it('should adjust optimal send times during Ramadan', () => {
        const ramadanDate = new Date('2025-03-15T16:00:00') // During Ramadan, late afternoon

        const optimalTime = getOptimalSendTime(ramadanDate)

        // Should avoid late afternoon during Ramadan (Iftar preparation)
        expect(optimalTime.getHours()).toBeLessThan(15)
      })
    })
  })

  describe('Cultural Tone Recommendations', () => {
    describe('Tone Guidelines System', () => {
      it('should provide tone guidelines for different scenarios', () => {
        const toneTypes = ['GENTLE', 'PROFESSIONAL', 'FIRM', 'URGENT'] as const

        toneTypes.forEach(tone => {
          const guidelines = CULTURAL_TONE_GUIDELINES[tone]
          
          expect(guidelines).toBeDefined()
          expect(guidelines.description).toBeDefined()
          expect(guidelines.recommendedFor).toBeDefined()
          expect(guidelines.phrases.en).toBeDefined()
          expect(guidelines.phrases.ar).toBeDefined()
          expect(Array.isArray(guidelines.recommendedFor)).toBe(true)
          expect(Array.isArray(guidelines.phrases.en)).toBe(true)
          expect(Array.isArray(guidelines.phrases.ar)).toBe(true)
        })
      })

      it('should provide culturally appropriate phrases for each tone', () => {
        const gentlePhrases = CULTURAL_TONE_GUIDELINES.GENTLE.phrases.en
        const urgentPhrases = CULTURAL_TONE_GUIDELINES.URGENT.phrases.en

        // Gentle phrases should be softer
        expect(gentlePhrases.some(phrase => 
          phrase.includes('hope') || phrase.includes('convenience')
        )).toBe(true)

        // Urgent phrases should be firmer but still respectful
        expect(urgentPhrases.some(phrase => 
          phrase.includes('immediate') || phrase.includes('final')
        )).toBe(true)
      })

      it('should provide Arabic equivalents for all English phrases', () => {
        Object.values(CULTURAL_TONE_GUIDELINES).forEach(guideline => {
          expect(guideline.phrases.en.length).toBeGreaterThan(0)
          expect(guideline.phrases.ar.length).toBeGreaterThan(0)
          
          // Should have roughly similar number of phrases in both languages
          expect(Math.abs(guideline.phrases.en.length - guideline.phrases.ar.length)).toBeLessThanOrEqual(2)
        })
      })
    })

    describe('Contextual Tone Recommendations', () => {
      it('should recommend gentle tone for excellent customers with few attempts', () => {
        const context = {
          attemptNumber: 1,
          daysPastDue: 5,
          customerType: 'ENTERPRISE' as const,
          paymentHistory: 'EXCELLENT' as const,
          relationshipLength: 36 // 3 years
        }

        const tone = getRecommendedTone(context)
        expect(tone).toBe('GENTLE')
      })

      it('should escalate to firm tone for poor payment history', () => {
        const context = {
          attemptNumber: 3,
          daysPastDue: 20,
          customerType: 'SME' as const,
          paymentHistory: 'POOR' as const,
          relationshipLength: 6
        }

        const tone = getRecommendedTone(context)
        expect(tone).toBe('FIRM')
      })

      it('should recommend urgent tone for very overdue payments', () => {
        const context = {
          attemptNumber: 5,
          daysPastDue: 50,
          customerType: 'INDIVIDUAL' as const,
          paymentHistory: 'POOR' as const,
          relationshipLength: 12
        }

        const tone = getRecommendedTone(context)
        expect(tone).toBe('URGENT')
      })

      it('should maintain professional tone for most standard scenarios', () => {
        const context = {
          attemptNumber: 2,
          daysPastDue: 10,
          customerType: 'SME' as const,
          paymentHistory: 'GOOD' as const,
          relationshipLength: 18
        }

        const tone = getRecommendedTone(context)
        expect(tone).toBe('PROFESSIONAL')
      })

      it('should protect long-term excellent customers', () => {
        const longTermExcellentCustomer = {
          attemptNumber: 3,
          daysPastDue: 15,
          customerType: 'ENTERPRISE' as const,
          paymentHistory: 'EXCELLENT' as const,
          relationshipLength: 48 // 4 years
        }

        const newPoorCustomer = {
          attemptNumber: 3,
          daysPastDue: 15,
          customerType: 'INDIVIDUAL' as const,
          paymentHistory: 'POOR' as const,
          relationshipLength: 3
        }

        const excellentTone = getRecommendedTone(longTermExcellentCustomer)
        const poorTone = getRecommendedTone(newPoorCustomer)

        expect(excellentTone).toBe('GENTLE')
        expect(poorTone).toBe('FIRM')
      })
    })
  })

  describe('UAE Time and Date Formatting', () => {
    describe('UAE Timezone Formatting', () => {
      it('should format time in UAE timezone', () => {
        const testDate = new Date('2025-01-15T14:30:00Z') // UTC time

        const uaeTimeEn = formatUAETime(testDate, 'en')
        const uaeTimeAr = formatUAETime(testDate, 'ar')

        expect(uaeTimeEn).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i)
        expect(uaeTimeAr).toMatch(/\d{1,2}:\d{2}/)
        
        // Should be 4 hours ahead of UTC (UAE is UTC+4)
        expect(uaeTimeEn).toContain('6:30') // 14:30 UTC + 4 hours = 18:30 = 6:30 PM
      })

      it('should format dates in UAE timezone with proper locale', () => {
        const testDate = new Date('2025-01-15T10:00:00Z')

        const uaeDateEn = formatUAEDate(testDate, 'en')
        const uaeDateAr = formatUAEDate(testDate, 'ar')

        expect(uaeDateEn).toContain('January')
        expect(uaeDateEn).toContain('2025')
        expect(uaeDateEn).toContain('Wednesday') // January 15, 2025 is a Wednesday

        expect(uaeDateAr).toBeDefined()
        expect(uaeDateAr.length).toBeGreaterThan(0)
      })
    })

    describe('Business Context Date Formatting', () => {
      it('should recognize UAE business days in date formatting', () => {
        const businessDays = [
          new Date('2025-01-05'), // Sunday
          new Date('2025-01-06'), // Monday
          new Date('2025-01-07'), // Tuesday
          new Date('2025-01-08'), // Wednesday
          new Date('2025-01-09')  // Thursday
        ]

        const weekendDays = [
          new Date('2025-01-10'), // Friday
          new Date('2025-01-11')  // Saturday
        ]

        businessDays.forEach(date => {
          const formatted = formatUAEDate(date, 'en')
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
          expect(dayNames.some(day => formatted.includes(day))).toBe(true)
        })

        weekendDays.forEach(date => {
          const formatted = formatUAEDate(date, 'en')
          expect(formatted.includes('Friday') || formatted.includes('Saturday')).toBe(true)
        })
      })
    })
  })

  describe('Integration with Business Rules', () => {
    describe('Optimal Communication Timing', () => {
      it('should find optimal send times avoiding prayer times and holidays', () => {
        // Test during a holiday week
        const duringNationalDayWeek = new Date('2025-12-02T10:00:00') // UAE National Day

        const optimalTime = getOptimalSendTime(duringNationalDayWeek)

        // Should not be on a holiday
        expect(isUAEHoliday(optimalTime)).toBeNull()
        
        // Should be a business day
        expect(isUAEBusinessDay(optimalTime)).toBe(true)
        
        // Should be within business hours
        expect(isWithinBusinessHours(optimalTime)).toBe(true)
        
        // Should not be near prayer times
        expect(isNearPrayerTime(optimalTime)).toBe(false)
      })

      it('should prioritize preferred send times', () => {
        const earlyMorning = new Date('2025-01-06T09:00:00') // Monday 9 AM

        const optimalTime = getOptimalSendTime(earlyMorning)

        // Should be within preferred hours
        const preferredHours = DEFAULT_UAE_CONFIG.preferredSendTimes
        expect(preferredHours.includes(optimalTime.getHours())).toBe(true)
      })
    })

    describe('Cultural Business Rules Integration', () => {
      it('should respect all cultural constraints simultaneously', () => {
        const testDate = new Date('2025-03-15T17:00:00') // During Ramadan, near Maghrib

        const nextGoodTime = getNextBusinessTime(testDate)

        // Should satisfy all constraints
        expect(isUAEBusinessDay(nextGoodTime)).toBe(true)
        expect(isWithinBusinessHours(nextGoodTime)).toBe(true)
        expect(isUAEHoliday(nextGoodTime)).toBeNull()
        expect(isNearPrayerTime(nextGoodTime)).toBe(false)
      })

      it('should handle complex scheduling around multiple constraints', () => {
        // Friday during Eid Al-Fitr (multiple constraints)
        const complexDate = new Date('2025-03-30T15:00:00') // Eid Al-Fitr

        const nextBusinessTime = getNextBusinessTime(complexDate)

        // Should skip weekend + holiday and find next business day
        expect(isUAEBusinessDay(nextBusinessTime)).toBe(true)
        expect(isUAEHoliday(nextBusinessTime)).toBeNull()
      })
    })
  })

  describe('Configuration and Customization', () => {
    describe('Custom Business Hour Configurations', () => {
      it('should handle custom working days', () => {
        const customConfig = {
          ...DEFAULT_UAE_CONFIG,
          workingDays: [1, 2, 3, 4, 5] // Monday-Friday (Western schedule)
        }

        const sunday = new Date('2025-01-05')
        const monday = new Date('2025-01-06')

        expect(isUAEBusinessDay(sunday, customConfig)).toBe(false) // Not in working days
        expect(isUAEBusinessDay(monday, customConfig)).toBe(true)  // In working days
      })

      it('should handle custom business hours', () => {
        const customConfig = {
          ...DEFAULT_UAE_CONFIG,
          businessHours: { start: 8, end: 16, timezone: 'Asia/Dubai' } // 8 AM - 4 PM
        }

        const morningTime = new Date('2025-01-06T08:30:00')
        const eveningTime = new Date('2025-01-06T16:30:00')

        expect(isWithinBusinessHours(morningTime, customConfig)).toBe(true)
        expect(isWithinBusinessHours(eveningTime, customConfig)).toBe(false)
      })

      it('should handle prayer time configuration', () => {
        const withPrayerAvoidance = { ...DEFAULT_UAE_CONFIG, avoidPrayerTimes: true }
        const withoutPrayerAvoidance = { ...DEFAULT_UAE_CONFIG, avoidPrayerTimes: false }

        const maghribTime = new Date('2025-01-15T18:10:00')

        const timeWithAvoidance = getNextBusinessTime(maghribTime, withPrayerAvoidance)
        const timeWithoutAvoidance = getNextBusinessTime(maghribTime, withoutPrayerAvoidance)

        // Should be different when prayer avoidance is enabled
        expect(timeWithAvoidance.getTime()).not.toBe(timeWithoutAvoidance.getTime())
      })
    })

    describe('Holiday Configuration Flexibility', () => {
      it('should work with the predefined UAE holidays list', () => {
        const allHolidays = UAE_HOLIDAYS_2025

        expect(allHolidays.length).toBeGreaterThan(10) // Should have many holidays
        
        // Should include both Islamic and public holidays
        expect(allHolidays.some(h => h.type === 'ISLAMIC')).toBe(true)
        expect(allHolidays.some(h => h.type === 'PUBLIC')).toBe(true)
        
        // All should have required properties
        allHolidays.forEach(holiday => {
          expect(holiday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(holiday.name).toBeDefined()
          expect(holiday.nameAr).toBeDefined()
          expect(holiday.type).toMatch(/^(PUBLIC|ISLAMIC|CULTURAL)$/)
          expect(holiday.observance).toMatch(/^(FULL_DAY|HALF_DAY|EVENING)$/)
          expect(typeof holiday.moveable).toBe('boolean')
        })
      })
    })
  })
})