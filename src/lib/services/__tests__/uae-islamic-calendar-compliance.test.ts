/**
 * UAE Islamic Calendar Compliance Test Suite
 * Comprehensive testing for Islamic holidays, Ramadan, prayer times, and cultural calendar integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  UAEBusinessHoursService,
  uaeBusinessHours,
  UAEHoliday,
  ScheduleConfig
} from '../uae-business-hours-service'
import {
  CulturalComplianceService,
  CulturalTimingPreferences
} from '../cultural-compliance-service'

describe('UAE Islamic Calendar Compliance', () => {
  let service: UAEBusinessHoursService
  let customHolidays: UAEHoliday[]

  beforeEach(() => {
    // Add comprehensive Islamic holidays for 2024-2025
    customHolidays = [
      // 2024 Islamic Calendar
      { date: new Date('2024-03-10'), name: 'Ramadan Begins', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-04-09'), name: 'Eid Al Fitr Day 1', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-04-10'), name: 'Eid Al Fitr Day 2', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-04-11'), name: 'Eid Al Fitr Day 3', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-06-15'), name: 'Arafat Day', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-06-16'), name: 'Eid Al Adha Day 1', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-06-17'), name: 'Eid Al Adha Day 2', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-06-18'), name: 'Eid Al Adha Day 3', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-07-07'), name: 'Islamic New Year (Muharram)', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2024-09-15'), name: 'Prophet Muhammad Birthday (Mawlid)', type: 'ISLAMIC', isRecurring: false },

      // 2025 Islamic Calendar (approximate dates)
      { date: new Date('2025-02-28'), name: 'Ramadan Begins 2025', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-03-30'), name: 'Eid Al Fitr 2025 Day 1', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-03-31'), name: 'Eid Al Fitr 2025 Day 2', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-04-01'), name: 'Eid Al Fitr 2025 Day 3', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-06-05'), name: 'Arafat Day 2025', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-06-06'), name: 'Eid Al Adha 2025 Day 1', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-06-07'), name: 'Eid Al Adha 2025 Day 2', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-06-08'), name: 'Eid Al Adha 2025 Day 3', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-06-26'), name: 'Islamic New Year 2025', type: 'ISLAMIC', isRecurring: false },
      { date: new Date('2025-09-04'), name: 'Prophet Muhammad Birthday 2025', type: 'ISLAMIC', isRecurring: false }
    ]

    service = new UAEBusinessHoursService({}, customHolidays)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Islamic Holiday Detection and Validation', () => {
    it('should detect all major Islamic holidays for 2024', () => {
      const islamicHolidays2024 = [
        { date: new Date('2024-04-09'), name: 'Eid Al Fitr' },
        { date: new Date('2024-06-16'), name: 'Eid Al Adha' },
        { date: new Date('2024-07-07'), name: 'Islamic New Year' },
        { date: new Date('2024-09-15'), name: 'Prophet Muhammad Birthday' }
      ]

      islamicHolidays2024.forEach(holiday => {
        expect(service.isUAEHoliday(holiday.date)).toBe(true)
      })
    })

    it('should detect all major Islamic holidays for 2025', () => {
      const islamicHolidays2025 = [
        { date: new Date('2025-03-30'), name: 'Eid Al Fitr 2025' },
        { date: new Date('2025-06-06'), name: 'Eid Al Adha 2025' },
        { date: new Date('2025-06-26'), name: 'Islamic New Year 2025' },
        { date: new Date('2025-09-04'), name: 'Prophet Muhammad Birthday 2025' }
      ]

      islamicHolidays2025.forEach(holiday => {
        expect(service.isUAEHoliday(holiday.date)).toBe(true)
      })
    })

    it('should distinguish between Islamic and national holidays', () => {
      const holidays2024 = service.getHolidaysForYear(2024)

      const islamicHolidays = holidays2024.filter(h => h.type === 'ISLAMIC')
      const nationalHolidays = holidays2024.filter(h => h.type === 'NATIONAL')

      expect(islamicHolidays.length).toBeGreaterThan(8) // Multiple Islamic holidays
      expect(nationalHolidays.length).toBeGreaterThan(2) // UAE National Day, Commemoration Day

      // Verify specific Islamic holidays
      expect(islamicHolidays.some(h => h.name.includes('Eid Al Fitr'))).toBe(true)
      expect(islamicHolidays.some(h => h.name.includes('Eid Al Adha'))).toBe(true)
      expect(islamicHolidays.some(h => h.name.includes('Islamic New Year'))).toBe(true)
    })

    it('should handle multi-day Islamic celebrations correctly', () => {
      // Eid Al Fitr 2024 (3 days)
      const eidDays = [
        new Date('2024-04-09'),
        new Date('2024-04-10'),
        new Date('2024-04-11')
      ]

      eidDays.forEach(day => {
        expect(service.isUAEHoliday(day)).toBe(true)
      })

      // Eid Al Adha 2024 (3 days)
      const adhaaDays = [
        new Date('2024-06-16'),
        new Date('2024-06-17'),
        new Date('2024-06-18')
      ]

      adhaaDays.forEach(day => {
        expect(service.isUAEHoliday(day)).toBe(true)
      })
    })

    it('should validate holiday schedule across year boundaries', () => {
      const yearEnd2024 = service.getHolidaysForYear(2024)
      const yearStart2025 = service.getHolidaysForYear(2025)

      expect(yearEnd2024.length).toBeGreaterThan(10)
      expect(yearStart2025.length).toBeGreaterThan(10)

      // Should have different holiday sets
      const holiday2024Dates = yearEnd2024.map(h => h.date.getTime())
      const holiday2025Dates = yearStart2025.map(h => h.date.getTime())

      const overlap = holiday2024Dates.filter(date => holiday2025Dates.includes(date))
      expect(overlap.length).toBeLessThan(3) // Minimal overlap (only recurring holidays like New Year)
    })
  })

  describe('Ramadan Period Detection and Compliance', () => {
    it('should accurately detect Ramadan 2024 period', () => {
      const ramadanStart2024 = new Date('2024-03-10')
      const ramadanEnd2024 = new Date('2024-04-09')

      // During Ramadan
      const midRamadan = new Date('2024-03-25')
      expect(service.isRamadan(midRamadan)).toBe(true)

      // Start and end dates
      expect(service.isRamadan(ramadanStart2024)).toBe(true)
      expect(service.isRamadan(ramadanEnd2024)).toBe(true)

      // Before and after
      const beforeRamadan = new Date('2024-03-05')
      const afterRamadan = new Date('2024-04-15')
      expect(service.isRamadan(beforeRamadan)).toBe(false)
      expect(service.isRamadan(afterRamadan)).toBe(false)
    })

    it('should accurately detect Ramadan 2025 period', () => {
      const ramadanStart2025 = new Date('2025-02-28')
      const ramadanEnd2025 = new Date('2025-03-30')

      // During Ramadan
      const midRamadan = new Date('2025-03-15')
      expect(service.isRamadan(midRamadan)).toBe(true)

      // Before and after
      const beforeRamadan = new Date('2025-02-20')
      const afterRamadan = new Date('2025-04-05')
      expect(service.isRamadan(beforeRamadan)).toBe(false)
      expect(service.isRamadan(afterRamadan)).toBe(false)
    })

    it('should provide Ramadan-specific scheduling configuration', () => {
      const ramadanConfig = service.getRamadanScheduleConfig()

      // Ramadan-specific preferences
      expect(ramadanConfig.preferredDays).toEqual([0, 1, 2, 3]) // Sunday-Wednesday
      expect(ramadanConfig.preferredHours).toEqual([9, 10, 14, 15]) // Avoid iftar time
      expect(ramadanConfig.avoidPrayerTimes).toBe(true)
      expect(ramadanConfig.respectRamadan).toBe(true)
      expect(ramadanConfig.culturalTone).toBe('FORMAL')
    })

    it('should adjust send times during Ramadan', () => {
      const ramadanDate = new Date('2024-03-20T17:00:00+04:00') // 5 PM during Ramadan

      const validation = service.validateScheduledTime(ramadanDate)

      expect(validation.isValid).toBe(false)
      expect(validation.reasons).toContain('Ramadan period - suboptimal timing')
      expect(validation.suggestions).toContain('During Ramadan, prefer 9 AM - 3 PM')
    })

    it('should detect Ramadan in cultural timing preferences', () => {
      const ramadanPeriod = new Date('2024-03-15')
      const endDate = new Date('2024-04-15')

      const preferences = CulturalComplianceService.getCulturalTimingPreferences(ramadanPeriod, endDate)

      const ramadanAvoidance = preferences.avoidancePeriods.find(p => p.name === 'Ramadan')
      expect(ramadanAvoidance).toBeDefined()
      expect(ramadanAvoidance?.reason).toContain('Holy month')

      const ramadanConsideration = preferences.culturalConsiderations.find(c =>
        c.toLowerCase().includes('ramadan')
      )
      expect(ramadanConsideration).toBeDefined()
    })
  })

  describe('Prayer Time Integration and Compliance', () => {
    it('should avoid all five daily prayers with appropriate buffers', () => {
      const prayerTimes = [
        { time: '05:30', name: 'Fajr', testTime: new Date('2024-03-15T05:30:00+04:00') },
        { time: '12:15', name: 'Dhuhr', testTime: new Date('2024-03-15T12:15:00+04:00') },
        { time: '15:30', name: 'Asr', testTime: new Date('2024-03-15T15:30:00+04:00') },
        { time: '18:30', name: 'Maghrib', testTime: new Date('2024-03-15T18:30:00+04:00') },
        { time: '20:00', name: 'Isha', testTime: new Date('2024-03-15T20:00:00+04:00') }
      ]

      prayerTimes.forEach(prayer => {
        expect(service.isPrayerTime(prayer.testTime)).toBe(true)

        // Test with buffer
        const beforePrayer = new Date(prayer.testTime.getTime() - 10 * 60 * 1000) // 10 min before
        const afterPrayer = new Date(prayer.testTime.getTime() + 10 * 60 * 1000)  // 10 min after

        expect(service.isPrayerTime(beforePrayer, 15)).toBe(true)  // Within 15-min buffer
        expect(service.isPrayerTime(afterPrayer, 15)).toBe(true)   // Within 15-min buffer
      })
    })

    it('should provide different prayer time buffers for different contexts', () => {
      const dhuhrTime = new Date('2024-03-15T12:15:00+04:00')

      // Standard 15-minute buffer
      const before15 = new Date('2024-03-15T12:00:00+04:00')
      const after15 = new Date('2024-03-15T12:30:00+04:00')
      expect(service.isPrayerTime(before15, 15)).toBe(true)
      expect(service.isPrayerTime(after15, 15)).toBe(true)

      // Shorter 5-minute buffer
      const before5 = new Date('2024-03-15T12:10:00+04:00')
      const after5 = new Date('2024-03-15T12:20:00+04:00')
      expect(service.isPrayerTime(before5, 5)).toBe(true)
      expect(service.isPrayerTime(after5, 5)).toBe(true)

      // Outside 5-minute buffer
      const wayBefore = new Date('2024-03-15T12:00:00+04:00')
      expect(service.isPrayerTime(wayBefore, 5)).toBe(false)
    })

    it('should integrate prayer times with business hour scheduling', () => {
      const duringDhuhr = new Date('2024-03-12T12:15:00+04:00') // Tuesday at Dhuhr

      const scheduleConfig: Partial<ScheduleConfig> = {
        avoidPrayerTimes: true,
        preferredDays: [2], // Tuesday
        preferredHours: [12], // Noon hour
        respectRamadan: false,
        culturalTone: 'BUSINESS'
      }

      const nextTime = service.getNextAvailableSendTime(duringDhuhr, scheduleConfig)

      // Should schedule after prayer time
      expect(nextTime.getTime()).toBeGreaterThan(duringDhuhr.getTime())
      expect(service.isPrayerTime(nextTime)).toBe(false)
    })

    it('should handle prayer times during Ramadan with extra sensitivity', () => {
      const ramadanMaghrib = new Date('2024-03-20T18:30:00+04:00') // Maghrib during Ramadan

      expect(service.isPrayerTime(ramadanMaghrib)).toBe(true)
      expect(service.isRamadan(ramadanMaghrib)).toBe(true)

      // Should validate as inappropriate during Ramadan
      const validation = service.validateScheduledTime(ramadanMaghrib)
      expect(validation.isValid).toBe(false)
      expect(validation.reasons).toContain('Conflicts with prayer time')
      expect(validation.reasons).toContain('Ramadan period - suboptimal timing')
    })
  })

  describe('Cultural Timing Optimization', () => {
    it('should provide comprehensive cultural timing for Islamic calendar year', () => {
      const islamicYearStart = new Date('2024-07-07') // Islamic New Year
      const islamicYearEnd = new Date('2025-06-26')   // Next Islamic New Year

      const preferences = CulturalComplianceService.getCulturalTimingPreferences(
        islamicYearStart,
        islamicYearEnd
      )

      expect(preferences.avoidancePeriods.length).toBeGreaterThan(8) // Multiple Islamic holidays
      expect(preferences.culturalConsiderations.length).toBeGreaterThan(3)

      // Should include major Islamic celebrations
      const holidayNames = preferences.avoidancePeriods.map(p => p.name)
      expect(holidayNames.some(name => name.includes('Eid'))).toBe(true)
      expect(holidayNames.some(name => name.includes('Ramadan'))).toBe(true)
    })

    it('should recommend appropriate delays during Islamic holidays', () => {
      const beforeEid = new Date('2024-04-08T10:00:00+04:00') // Day before Eid Al Fitr
      const duringEid = new Date('2024-04-09T10:00:00+04:00')  // Eid Al Fitr Day 1
      const afterEid = new Date('2024-04-12T10:00:00+04:00')   // Day after Eid celebrations

      // Should avoid scheduling during Eid
      expect(service.isUAEHoliday(duringEid)).toBe(true)

      const nextTime = service.getNextAvailableSendTime(duringEid)
      expect(nextTime.getDate()).toBeGreaterThan(duringEid.getDate())
      expect(!service.isUAEHoliday(nextTime)).toBe(true)
    })

    it('should provide culturally sensitive scheduling for Islamic months', () => {
      // Muharram (Islamic New Year) - more formal approach
      const muharram = new Date('2024-07-07')

      // Ramadan - very formal and respectful
      const ramadan = new Date('2024-03-20')

      // Eid periods - joyful but respectful
      const eid = new Date('2024-04-09')

      // All should be treated with cultural sensitivity
      expect(service.isUAEHoliday(muharram)).toBe(true)
      expect(service.isRamadan(ramadan)).toBe(true)
      expect(service.isUAEHoliday(eid)).toBe(true)

      // Validation should flag these as needing special consideration
      const muharramValidation = service.validateScheduledTime(muharram)
      const ramadanValidation = service.validateScheduledTime(ramadan)
      const eidValidation = service.validateScheduledTime(eid)

      expect(muharramValidation.isValid).toBe(false)
      expect(ramadanValidation.isValid).toBe(false)
      expect(eidValidation.isValid).toBe(false)
    })
  })

  describe('Integration with Follow-up Sequences', () => {
    it('should adjust sequence timing for Islamic calendar considerations', () => {
      // Test sequence that would span Ramadan
      const preRamadanStart = new Date('2024-03-05T10:00:00+04:00')

      const optimalTime = service.getOptimalSendTime(preRamadanStart)

      // Should find time that considers Islamic calendar
      expect(optimalTime).toBeInstanceOf(Date)
      expect(optimalTime.getTime()).toBeGreaterThan(preRamadanStart.getTime())

      // During optimal time, should not conflict with Islamic observances
      expect(!service.isPrayerTime(optimalTime)).toBe(true)
    })

    it('should provide Ramadan-specific sequence configurations', () => {
      const ramadanAdjustments = CulturalComplianceService.getRamadanAdjustments(
        new Date('2024-03-20')
      )

      expect(ramadanAdjustments.preferredDays).toEqual([0, 1, 2, 3]) // Sunday-Wednesday
      expect(ramadanAdjustments.preferredHours).toEqual([9, 10, 14, 15])
      expect(ramadanAdjustments.culturalTone).toBe('FORMAL')
      expect(ramadanAdjustments.respectRamadan).toBe(true)
    })

    it('should validate sequence steps against Islamic calendar', () => {
      const sequenceSteps = [
        { tone: 'FRIENDLY', content: 'Ramadan Mubarak! Gentle reminder...', delayDays: 10 },
        { tone: 'BUSINESS', content: 'Following up after Eid...', delayDays: 7 },
        { tone: 'FORMAL', content: 'Respectful final notice...', delayDays: 7 }
      ]

      const validation = CulturalComplianceService.validateToneEscalation(
        sequenceSteps,
        'REGULAR'
      )

      // Should be appropriate with longer delays during Islamic observances
      expect(validation.appropriate).toBe(true)
      expect(validation.issues.length).toBe(0)
    })
  })

  describe('Regional and Cultural Variations', () => {
    it('should handle UAE-specific Islamic calendar variations', () => {
      // UAE follows standard Islamic calendar with potential local adjustments
      const holidays2024 = service.getHolidaysForYear(2024)

      // Should include UAE-specific Islamic observances
      const islamicHolidays = holidays2024.filter(h => h.type === 'ISLAMIC')
      expect(islamicHolidays.length).toBeGreaterThan(8)

      // Should include both major and minor Islamic observances
      const majorHolidays = ['Eid Al Fitr', 'Eid Al Adha', 'Islamic New Year']
      majorHolidays.forEach(holidayName => {
        expect(islamicHolidays.some(h => h.name.includes(holidayName.split(' ')[0]))).toBe(true)
      })
    })

    it('should respect UAE business culture during Islamic observances', () => {
      // Test various Islamic dates throughout the year
      const islamicObservances = [
        new Date('2024-03-15'), // During Ramadan
        new Date('2024-04-09'), // Eid Al Fitr
        new Date('2024-06-16'), // Eid Al Adha
        new Date('2024-07-07'), // Islamic New Year
        new Date('2024-09-15')  // Prophet's Birthday
      ]

      islamicObservances.forEach(date => {
        const validation = service.validateScheduledTime(date)

        // All should be flagged as culturally sensitive
        expect(validation.isValid).toBe(false)
        expect(validation.suggestions.length).toBeGreaterThan(0)
      })
    })

    it('should provide appropriate business messaging during Islamic periods', () => {
      // During Ramadan
      const ramadanContent = 'Ramadan Mubarak! We hope this blessed month brings you peace. Please consider this gentle reminder about your invoice.'

      const ramadanScore = CulturalComplianceService.calculateCulturalScore(
        ramadanContent,
        {
          language: 'en',
          isRamadan: true,
          sequenceType: 'FIRST_REMINDER',
          customerRelationship: 'REGULAR'
        }
      )

      expect(ramadanScore.score).toBeGreaterThan(80)
      expect(ramadanScore.breakdown.culturalSensitivity).toBeGreaterThan(85)
      expect(ramadanScore.breakdown.islamicEtiquette).toBeGreaterThan(90)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing Islamic calendar data gracefully', () => {
      const serviceWithoutHolidays = new UAEBusinessHoursService({}, [])

      // Should still detect built-in holidays
      expect(serviceWithoutHolidays.isUAEHoliday(new Date('2024-04-09'))).toBe(true)

      // Should handle Ramadan detection even without custom holidays
      expect(serviceWithoutHolidays.isRamadan(new Date('2024-03-20'))).toBe(true)
    })

    it('should handle year transitions in Islamic calendar', () => {
      const islamicNewYear2024 = new Date('2024-07-07')
      const islamicNewYear2025 = new Date('2025-06-26')

      expect(service.isUAEHoliday(islamicNewYear2024)).toBe(true)
      expect(service.isUAEHoliday(islamicNewYear2025)).toBe(true)

      // Should handle scheduling across Islamic year boundary
      const crossYearOptimal = service.getOptimalSendTime(islamicNewYear2024)
      expect(crossYearOptimal).toBeInstanceOf(Date)
    })

    it('should handle conflicting Islamic and business calendar events', () => {
      // Islamic holiday on a Tuesday (preferred business day)
      const islamicHolidayOnTuesday = new Date('2024-04-09T10:00:00+04:00') // Eid Al Fitr on Tuesday

      const nextOptimalTime = service.getOptimalSendTime(islamicHolidayOnTuesday)

      // Should find next appropriate time after holiday
      expect(nextOptimalTime.getTime()).toBeGreaterThan(islamicHolidayOnTuesday.getTime())
      expect(!service.isUAEHoliday(nextOptimalTime)).toBe(true)
    })

    it('should handle invalid Islamic dates gracefully', () => {
      const invalidDate = new Date('invalid-date')

      expect(() => service.isUAEHoliday(invalidDate)).not.toThrow()
      expect(() => service.isRamadan(invalidDate)).not.toThrow()
      expect(() => service.isPrayerTime(invalidDate)).not.toThrow()
    })
  })

  describe('Performance with Islamic Calendar Data', () => {
    it('should efficiently process Islamic calendar queries', () => {
      const startTime = Date.now()

      // Test 1000 Islamic calendar queries
      for (let i = 0; i < 1000; i++) {
        const testDate = new Date(2024, 0, 1 + (i % 365))
        service.isUAEHoliday(testDate)
        service.isRamadan(testDate)
        service.isPrayerTime(testDate)
      }

      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(1000)
    })

    it('should handle large Islamic holiday datasets efficiently', () => {
      // Create service with extensive Islamic holiday data
      const extensiveHolidays: UAEHoliday[] = []

      // Generate 5 years of Islamic holidays
      for (let year = 2024; year <= 2028; year++) {
        extensiveHolidays.push(
          { date: new Date(`${year}-04-09`), name: `Eid Al Fitr ${year}`, type: 'ISLAMIC', isRecurring: false },
          { date: new Date(`${year}-06-16`), name: `Eid Al Adha ${year}`, type: 'ISLAMIC', isRecurring: false },
          { date: new Date(`${year}-07-07`), name: `Islamic New Year ${year}`, type: 'ISLAMIC', isRecurring: false }
        )
      }

      const heavyService = new UAEBusinessHoursService({}, extensiveHolidays)

      const startTime = Date.now()

      // Test 100 holiday lookups
      for (let i = 0; i < 100; i++) {
        heavyService.isUAEHoliday(new Date(2024 + (i % 5), 3, 9))
      }

      const endTime = Date.now()
      const processingTime = endTime - startTime

      // Should remain efficient even with large datasets
      expect(processingTime).toBeLessThan(500)
    })
  })
})