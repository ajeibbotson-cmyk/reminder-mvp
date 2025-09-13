/**
 * Comprehensive Test Suite for UAE Business Hours Service
 * Tests UAE business hours, holidays, prayer times, and cultural timing optimization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  UAEBusinessHoursService,
  uaeBusinessHours,
  UAEBusinessHoursConfig,
  UAEHoliday,
  ScheduleConfig,
  isUAEBusinessHours,
  getNextUAEBusinessHour,
  isUAEHoliday,
  isPrayerTime,
  getOptimalSendTime
} from '../uae-business-hours-service'

// Mock the vat-calculator module
jest.mock('@/lib/vat-calculator', () => ({
  isUAEBusinessHours: jest.fn(),
  getNextUAEBusinessHour: jest.fn()
}))

describe('UAEBusinessHoursService', () => {
  let service: UAEBusinessHoursService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new UAEBusinessHoursService()

    // Mock the imported functions
    const { isUAEBusinessHours: mockIsBusinessHours, getNextUAEBusinessHour: mockGetNextBusinessHour } = require('@/lib/vat-calculator')
    mockIsBusinessHours.mockReturnValue(true)
    mockGetNextBusinessHour.mockReturnValue(new Date())
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with default UAE configuration', () => {
      const defaultService = new UAEBusinessHoursService()
      const config = defaultService.getConfig()

      expect(config.workingDays).toEqual([0, 1, 2, 3, 4]) // Sunday to Thursday
      expect(config.startHour).toBe(8)
      expect(config.endHour).toBe(18)
      expect(config.timezone).toBe('Asia/Dubai')
      expect(config.prayerTimes).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customConfig: Partial<UAEBusinessHoursConfig> = {
        startHour: 9,
        endHour: 17,
        lunchBreakStart: 12,
        lunchBreakEnd: 13
      }

      const customService = new UAEBusinessHoursService(customConfig)
      const config = customService.getConfig()

      expect(config.startHour).toBe(9)
      expect(config.endHour).toBe(17)
      expect(config.lunchBreakStart).toBe(12)
      expect(config.lunchBreakEnd).toBe(13)
    })

    it('should accept custom holidays', () => {
      const customHolidays: UAEHoliday[] = [
        {
          date: new Date('2024-06-15'),
          name: 'Company Anniversary',
          type: 'PUBLIC',
          isRecurring: true
        }
      ]

      const customService = new UAEBusinessHoursService({}, customHolidays)
      const holidays = customService.getHolidaysForYear(2024)

      expect(holidays.some(h => h.name === 'Company Anniversary')).toBe(true)
    })

    it('should update configuration after initialization', () => {
      service.updateConfig({ startHour: 10, endHour: 16 })
      const config = service.getConfig()

      expect(config.startHour).toBe(10)
      expect(config.endHour).toBe(16)
    })
  })

  describe('Business Hours Detection', () => {
    it('should delegate to vat-calculator for business hours check', () => {
      const { isUAEBusinessHours: mockIsBusinessHours } = require('@/lib/vat-calculator')
      mockIsBusinessHours.mockReturnValue(true)

      const testDate = new Date('2024-01-01T10:00:00.000Z') // Monday 10 AM
      const result = service.isBusinessHours(testDate)

      expect(result).toBe(true)
      expect(mockIsBusinessHours).toHaveBeenCalledWith(testDate, {
        workingDays: [0, 1, 2, 3, 4],
        startHour: 8,
        endHour: 18,
        timezone: 'Asia/Dubai'
      })
    })

    it('should return false outside business hours', () => {
      const { isUAEBusinessHours: mockIsBusinessHours } = require('@/lib/vat-calculator')
      mockIsBusinessHours.mockReturnValue(false)

      const testDate = new Date('2024-01-05T10:00:00.000Z') // Friday 10 AM (weekend)
      const result = service.isBusinessHours(testDate)

      expect(result).toBe(false)
    })

    it('should handle different timezones correctly', () => {
      const customService = new UAEBusinessHoursService({
        timezone: 'UTC'
      })

      const testDate = new Date('2024-01-01T10:00:00.000Z')
      customService.isBusinessHours(testDate)

      const { isUAEBusinessHours: mockIsBusinessHours } = require('@/lib/vat-calculator')
      expect(mockIsBusinessHours).toHaveBeenCalledWith(testDate, 
        expect.objectContaining({
          timezone: 'UTC'
        })
      )
    })
  })

  describe('Next Business Hour Calculation', () => {
    it('should delegate to vat-calculator for next business hour', () => {
      const { getNextUAEBusinessHour: mockGetNextBusinessHour } = require('@/lib/vat-calculator')
      const expectedDate = new Date('2024-01-01T08:00:00.000Z')
      mockGetNextBusinessHour.mockReturnValue(expectedDate)

      const testDate = new Date('2024-01-01T07:00:00.000Z')
      const result = service.getNextBusinessHour(testDate)

      expect(result).toBe(expectedDate)
      expect(mockGetNextBusinessHour).toHaveBeenCalledWith(testDate, {
        workingDays: [0, 1, 2, 3, 4],
        startHour: 8,
        endHour: 18,
        timezone: 'Asia/Dubai'
      })
    })

    it('should handle weekend transitions', () => {
      const { getNextUAEBusinessHour: mockGetNextBusinessHour } = require('@/lib/vat-calculator')
      const nextSunday = new Date('2024-01-07T08:00:00.000Z') // Next Sunday 8 AM
      mockGetNextBusinessHour.mockReturnValue(nextSunday)

      const fridayEvening = new Date('2024-01-05T20:00:00.000Z') // Friday 8 PM
      const result = service.getNextBusinessHour(fridayEvening)

      expect(result).toBe(nextSunday)
    })
  })

  describe('UAE Holiday Detection', () => {
    it('should detect New Year as holiday', () => {
      const newYear = new Date('2024-01-01')
      const isHoliday = service.isUAEHoliday(newYear)

      expect(isHoliday).toBe(true)
    })

    it('should detect UAE National Day as holiday', () => {
      const nationalDay = new Date('2024-12-02')
      const isHoliday = service.isUAEHoliday(nationalDay)

      expect(isHoliday).toBe(true)
    })

    it('should detect Islamic holidays', () => {
      const eidAlFitr = new Date('2024-04-09')
      const eidAlAdha = new Date('2024-06-16')
      
      expect(service.isUAEHoliday(eidAlFitr)).toBe(true)
      expect(service.isUAEHoliday(eidAlAdha)).toBe(true)
    })

    it('should not detect regular days as holidays', () => {
      const regularDay = new Date('2024-03-15')
      const isHoliday = service.isUAEHoliday(regularDay)

      expect(isHoliday).toBe(false)
    })

    it('should return holidays for specific year', () => {
      const holidays2024 = service.getHolidaysForYear(2024)
      
      expect(holidays2024.length).toBeGreaterThan(0)
      expect(holidays2024.every(h => h.date.getFullYear() === 2024)).toBe(true)
      
      // Check for specific holidays
      const nationalDay = holidays2024.find(h => h.name === 'UAE National Day')
      expect(nationalDay).toBeDefined()
      expect(nationalDay?.type).toBe('NATIONAL')
    })

    it('should handle custom holidays', () => {
      const customHoliday: UAEHoliday = {
        date: new Date('2024-07-20'),
        name: 'Custom Company Holiday',
        type: 'PUBLIC',
        isRecurring: false
      }

      service.addHolidays([customHoliday])
      
      const isHoliday = service.isUAEHoliday(new Date('2024-07-20'))
      expect(isHoliday).toBe(true)

      const holidays = service.getHolidaysForYear(2024)
      expect(holidays.some(h => h.name === 'Custom Company Holiday')).toBe(true)
    })
  })

  describe('Prayer Time Detection', () => {
    beforeEach(() => {
      // Mock Date methods for consistent testing
      jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('1/1/2024, 12:20:00 PM')
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12)
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(20)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should detect Dhuhr prayer time', () => {
      // 12:20 PM should be within 15 minutes of 12:15 PM Dhuhr
      const testDate = new Date('2024-01-01T12:20:00.000Z')
      const isPrayer = service.isPrayerTime(testDate)

      expect(isPrayer).toBe(true)
    })

    it('should detect prayer time with custom buffer', () => {
      const testDate = new Date('2024-01-01T12:20:00.000Z')
      const isPrayer = service.isPrayerTime(testDate, 10) // 10 minute buffer

      expect(isPrayer).toBe(true)
    })

    it('should not detect prayer time outside buffer', () => {
      // Mock time outside prayer buffer
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10)
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)

      const testDate = new Date('2024-01-01T10:00:00.000Z')
      const isPrayer = service.isPrayerTime(testDate)

      expect(isPrayer).toBe(false)
    })

    it('should handle timezone conversion errors gracefully', () => {
      jest.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => {
        throw new Error('Timezone error')
      })

      const testDate = new Date()
      const isPrayer = service.isPrayerTime(testDate)

      expect(isPrayer).toBe(false) // Should default to false on error
    })

    it('should work with all prayer times', () => {
      const prayerTimes = [
        { hour: 5, minute: 30, name: 'Fajr' },
        { hour: 12, minute: 15, name: 'Dhuhr' },
        { hour: 15, minute: 30, name: 'Asr' },
        { hour: 18, minute: 30, name: 'Maghrib' },
        { hour: 20, minute: 0, name: 'Isha' }
      ]

      prayerTimes.forEach(prayer => {
        jest.spyOn(Date.prototype, 'getHours').mockReturnValue(prayer.hour)
        jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(prayer.minute)
        
        const testDate = new Date()
        const isPrayer = service.isPrayerTime(testDate)

        expect(isPrayer).toBe(true)
      })
    })
  })

  describe('Optimal Send Time Calculation', () => {
    it('should return optimal time on Tuesday-Thursday 10 AM', () => {
      const optimalTime = service.getOptimalSendTime()

      const dayOfWeek = optimalTime.getDay()
      const hour = optimalTime.getHours()

      expect([2, 3, 4]).toContain(dayOfWeek) // Tuesday, Wednesday, Thursday
      expect(hour).toBe(10)
    })

    it('should find next optimal day if current day is not optimal', () => {
      const friday = new Date('2024-01-05T10:00:00.000Z') // Friday
      const optimalTime = service.getOptimalSendTime(friday)

      const dayOfWeek = optimalTime.getDay()
      expect([2, 3, 4]).toContain(dayOfWeek) // Should move to next optimal day
    })

    it('should avoid holidays', () => {
      // Test with a holiday date
      const holidayDate = new Date('2024-01-01T10:00:00.000Z') // New Year (holiday)
      jest.spyOn(service, 'isUAEHoliday').mockReturnValue(true)

      const optimalTime = service.getOptimalSendTime(holidayDate)

      expect(optimalTime.getTime()).toBeGreaterThan(holidayDate.getTime())
    })

    it('should avoid prayer times', () => {
      const duringPrayer = new Date('2024-01-02T12:15:00.000Z') // Tuesday at Dhuhr
      jest.spyOn(service, 'isPrayerTime').mockReturnValue(true)

      const optimalTime = service.getOptimalSendTime(duringPrayer)

      // Should move to a different time
      expect(optimalTime.getTime()).not.toBe(duringPrayer.getTime())
    })

    it('should prevent infinite loops with fallback', () => {
      // Mock scenario where no optimal time can be found
      const baseDate = new Date()
      jest.spyOn(service, 'isUAEHoliday').mockReturnValue(true) // All days are holidays
      jest.spyOn(service, 'isPrayerTime').mockReturnValue(true) // All times are prayer times

      const { getNextUAEBusinessHour } = require('@/lib/vat-calculator')
      const fallbackTime = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
      getNextUAEBusinessHour.mockReturnValue(fallbackTime)

      const optimalTime = service.getOptimalSendTime(baseDate)

      expect(optimalTime).toBe(fallbackTime) // Should use fallback
    })
  })

  describe('Next Available Send Time with Schedule Config', () => {
    it('should respect preferred days configuration', () => {
      const config: Partial<ScheduleConfig> = {
        preferredDays: [1, 2], // Monday, Tuesday only
        preferredHours: [9, 10],
        avoidPrayerTimes: false,
        respectRamadan: false,
        culturalTone: 'BUSINESS'
      }

      const wednesday = new Date('2024-01-03T10:00:00.000Z') // Wednesday
      const nextTime = service.getNextAvailableSendTime(wednesday, config)

      const dayOfWeek = nextTime.getDay()
      expect([1, 2]).toContain(dayOfWeek) // Should be Monday or Tuesday
    })

    it('should respect preferred hours configuration', () => {
      const config: Partial<ScheduleConfig> = {
        preferredDays: [1, 2, 3, 4], // Monday-Thursday
        preferredHours: [14, 15], // 2-3 PM only
        avoidPrayerTimes: false,
        respectRamadan: false,
        culturalTone: 'BUSINESS'
      }

      const morning = new Date('2024-01-01T09:00:00.000Z') // Monday 9 AM
      const nextTime = service.getNextAvailableSendTime(morning, config)

      const hour = nextTime.getHours()
      expect([14, 15]).toContain(hour) // Should be 2 PM or 3 PM
    })

    it('should avoid prayer times when configured', () => {
      const config: Partial<ScheduleConfig> = {
        preferredDays: [1, 2, 3, 4],
        preferredHours: [12], // Noon hour
        avoidPrayerTimes: true,
        respectRamadan: false,
        culturalTone: 'BUSINESS'
      }

      jest.spyOn(service, 'isPrayerTime').mockReturnValue(true)

      const noonTime = new Date('2024-01-01T12:00:00.000Z')
      const nextTime = service.getNextAvailableSendTime(noonTime, config)

      // Should move away from prayer time
      expect(nextTime.getTime()).toBeGreaterThan(noonTime.getTime())
    })

    it('should respect business hours', () => {
      const { isUAEBusinessHours, getNextUAEBusinessHour } = require('@/lib/vat-calculator')
      isUAEBusinessHours.mockReturnValue(false)
      
      const nextBusinessTime = new Date('2024-01-08T08:00:00.000Z') // Next Monday 8 AM
      getNextUAEBusinessHour.mockReturnValue(nextBusinessTime)

      const eveningTime = new Date('2024-01-01T20:00:00.000Z') // Monday 8 PM
      const nextTime = service.getNextAvailableSendTime(eveningTime)

      expect(nextTime).toBe(nextBusinessTime)
    })

    it('should avoid holidays', () => {
      jest.spyOn(service, 'isUAEHoliday').mockReturnValue(true)

      const holidayDate = new Date('2024-01-01T10:00:00.000Z')
      const nextTime = service.getNextAvailableSendTime(holidayDate)

      expect(nextTime.getTime()).toBeGreaterThan(holidayDate.getTime())
    })

    it('should use fallback when no optimal time found within iterations', () => {
      const { getNextUAEBusinessHour } = require('@/lib/vat-calculator')
      const fallbackTime = new Date('2024-01-08T08:00:00.000Z')
      getNextUAEBusinessHour.mockReturnValue(fallbackTime)

      // Mock impossible conditions
      jest.spyOn(service, 'isBusinessHours').mockReturnValue(false)

      const baseDate = new Date()
      const nextTime = service.getNextAvailableSendTime(baseDate)

      expect(nextTime).toBe(fallbackTime)
    })
  })

  describe('Ramadan Handling', () => {
    it('should detect Ramadan period correctly', () => {
      const ramadanDate = new Date('2024-03-15') // During Ramadan 2024
      const isRamadan = service.isRamadan(ramadanDate)

      expect(isRamadan).toBe(true)
    })

    it('should not detect non-Ramadan periods', () => {
      const nonRamadanDate = new Date('2024-01-15')
      const isRamadan = service.isRamadan(nonRamadanDate)

      expect(isRamadan).toBe(false)
    })

    it('should provide Ramadan-specific schedule configuration', () => {
      const ramadanConfig = service.getRamadanScheduleConfig()

      expect(ramadanConfig.preferredDays).toEqual([0, 1, 2, 3]) // Sunday-Wednesday
      expect(ramadanConfig.preferredHours).toEqual([9, 10, 14, 15]) // Avoid iftar time
      expect(ramadanConfig.avoidPrayerTimes).toBe(true)
      expect(ramadanConfig.respectRamadan).toBe(true)
      expect(ramadanConfig.culturalTone).toBe('FORMAL')
    })

    it('should handle different Ramadan years', () => {
      const ramadan2024 = new Date('2024-03-15')
      const ramadan2025 = new Date('2025-03-05')

      expect(service.isRamadan(ramadan2024)).toBe(true)
      expect(service.isRamadan(ramadan2025)).toBe(true)
    })
  })

  describe('Schedule Validation', () => {
    it('should validate appropriate scheduling times', () => {
      const { isUAEBusinessHours } = require('@/lib/vat-calculator')
      isUAEBusinessHours.mockReturnValue(true)
      jest.spyOn(service, 'isUAEHoliday').mockReturnValue(false)
      jest.spyOn(service, 'isPrayerTime').mockReturnValue(false)

      const goodTime = new Date('2024-01-01T10:00:00.000Z') // Monday 10 AM
      const validation = service.validateScheduledTime(goodTime)

      expect(validation.isValid).toBe(true)
      expect(validation.reasons).toHaveLength(0)
      expect(validation.suggestions).toHaveLength(0)
    })

    it('should flag outside business hours', () => {
      const { isUAEBusinessHours } = require('@/lib/vat-calculator')
      isUAEBusinessHours.mockReturnValue(false)

      const badTime = new Date('2024-01-05T10:00:00.000Z') // Friday 10 AM
      const validation = service.validateScheduledTime(badTime)

      expect(validation.isValid).toBe(false)
      expect(validation.reasons).toContain('Outside business hours')
      expect(validation.suggestions).toContain('Schedule during Sunday-Thursday, 8 AM - 6 PM')
    })

    it('should flag holidays with specific holiday name', () => {
      jest.spyOn(service, 'isUAEHoliday').mockReturnValue(true)

      const holidayTime = new Date('2024-12-02T10:00:00.000Z') // UAE National Day
      const validation = service.validateScheduledTime(holidayTime)

      expect(validation.isValid).toBe(false)
      expect(validation.reasons).toContain('UAE Holiday: UAE National Day')
      expect(validation.suggestions).toContain('Reschedule to next business day')
    })

    it('should flag prayer times', () => {
      jest.spyOn(service, 'isPrayerTime').mockReturnValue(true)

      const prayerTime = new Date('2024-01-01T12:15:00.000Z')
      const validation = service.validateScheduledTime(prayerTime)

      expect(validation.isValid).toBe(false)
      expect(validation.reasons).toContain('Conflicts with prayer time')
      expect(validation.suggestions).toContain('Avoid sending during prayer times (±15 minutes)')
    })

    it('should flag weekends', () => {
      const friday = new Date('2024-01-05T10:00:00.000Z') // Friday
      const saturday = new Date('2024-01-06T10:00:00.000Z') // Saturday

      const fridayValidation = service.validateScheduledTime(friday)
      const saturdayValidation = service.validateScheduledTime(saturday)

      expect(fridayValidation.isValid).toBe(false)
      expect(saturdayValidation.isValid).toBe(false)
      expect(fridayValidation.reasons).toContain('Weekend in UAE')
      expect(fridayValidation.suggestions).toContain('Schedule for Sunday-Thursday')
    })

    it('should flag suboptimal Ramadan timing', () => {
      jest.spyOn(service, 'isRamadan').mockReturnValue(true)

      const lateRamadanTime = new Date('2024-03-15T17:00:00.000Z') // 5 PM during Ramadan
      const validation = service.validateScheduledTime(lateRamadanTime)

      expect(validation.isValid).toBe(false)
      expect(validation.reasons).toContain('Ramadan period - suboptimal timing')
      expect(validation.suggestions).toContain('During Ramadan, prefer 9 AM - 3 PM')
    })

    it('should provide comprehensive validation for multiple issues', () => {
      const { isUAEBusinessHours } = require('@/lib/vat-calculator')
      isUAEBusinessHours.mockReturnValue(false)
      jest.spyOn(service, 'isUAEHoliday').mockReturnValue(true)
      jest.spyOn(service, 'isPrayerTime').mockReturnValue(true)
      jest.spyOn(service, 'isRamadan').mockReturnValue(true)

      const problematicTime = new Date('2024-03-15T18:30:00.000Z') // Multiple issues
      const validation = service.validateScheduledTime(problematicTime)

      expect(validation.isValid).toBe(false)
      expect(validation.reasons.length).toBeGreaterThan(1)
      expect(validation.suggestions.length).toBeGreaterThan(1)
    })
  })

  describe('Helper Functions', () => {
    it('should provide backward compatibility functions', () => {
      const testDate = new Date('2024-01-01T10:00:00.000Z')

      // Test helper functions
      expect(typeof isUAEBusinessHours).toBe('function')
      expect(typeof getNextUAEBusinessHour).toBe('function')
      expect(typeof isUAEHoliday).toBe('function')
      expect(typeof isPrayerTime).toBe('function')
      expect(typeof getOptimalSendTime).toBe('function')

      // Test that they delegate to service instance
      const result1 = isUAEBusinessHours(testDate)
      const result2 = uaeBusinessHours.isBusinessHours(testDate)
      expect(result1).toBe(result2)
    })

    it('should maintain singleton instance consistency', () => {
      const instance1 = uaeBusinessHours
      const instance2 = uaeBusinessHours

      expect(instance1).toBe(instance2) // Should be same instance
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle rapid successive calls efficiently', () => {
      const startTime = Date.now()
      const testDate = new Date('2024-01-01T10:00:00.000Z')

      // Make 1000 rapid calls
      for (let i = 0; i < 1000; i++) {
        service.isBusinessHours(testDate)
        service.isUAEHoliday(testDate)
        service.isPrayerTime(testDate)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid')

      expect(() => service.isBusinessHours(invalidDate)).not.toThrow()
      expect(() => service.isUAEHoliday(invalidDate)).not.toThrow()
      expect(() => service.isPrayerTime(invalidDate)).not.toThrow()
    })

    it('should handle timezone edge cases', () => {
      const edgeService = new UAEBusinessHoursService({
        timezone: 'Pacific/Midway' // Extreme timezone
      })

      const testDate = new Date()
      expect(() => edgeService.isBusinessHours(testDate)).not.toThrow()
    })

    it('should handle year boundary conditions', () => {
      const newYearEve = new Date('2023-12-31T23:59:59.999Z')
      const newYearDay = new Date('2024-01-01T00:00:00.000Z')

      expect(() => service.getOptimalSendTime(newYearEve)).not.toThrow()
      expect(() => service.getOptimalSendTime(newYearDay)).not.toThrow()
    })

    it('should handle concurrent access safely', async () => {
      const testDate = new Date('2024-01-01T10:00:00.000Z')

      // Create concurrent promises
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => ({
          business: service.isBusinessHours(testDate),
          holiday: service.isUAEHoliday(testDate),
          prayer: service.isPrayerTime(testDate),
          optimal: service.getOptimalSendTime(testDate)
        }))
      )

      const results = await Promise.all(promises)

      // All results should be consistent
      const firstResult = results[0]
      results.forEach(result => {
        expect(result.business).toBe(firstResult.business)
        expect(result.holiday).toBe(firstResult.holiday)
        expect(result.prayer).toBe(firstResult.prayer)
      })
    })

    it('should handle memory efficiently with large holiday sets', () => {
      const largeHolidaySet: UAEHoliday[] = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(2024, 0, i % 365 + 1),
        name: `Holiday ${i}`,
        type: 'PUBLIC',
        isRecurring: false
      }))

      const heavyService = new UAEBusinessHoursService({}, largeHolidaySet)
      const testDate = new Date('2024-06-15')

      const startTime = Date.now()
      heavyService.isUAEHoliday(testDate)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // Should be fast even with many holidays
    })
  })

  describe('Cultural Context Integration', () => {
    it('should provide culturally appropriate default configurations', () => {
      const config = service.getConfig()

      // UAE-specific defaults
      expect(config.workingDays).toEqual([0, 1, 2, 3, 4]) // Sunday-Thursday
      expect(config.startHour).toBe(8) // 8 AM start
      expect(config.endHour).toBe(18) // 6 PM end
      expect(config.timezone).toBe('Asia/Dubai')
      expect(config.prayerTimes).toBeDefined()
      expect(config.lunchBreakStart).toBe(12)
      expect(config.lunchBreakEnd).toBe(13)
    })

    it('should include all major UAE holidays', () => {
      const holidays2024 = service.getHolidaysForYear(2024)
      
      const expectedHolidays = [
        'New Year Day',
        'Eid Al Fitr',
        'Eid Al Adha',
        'Islamic New Year',
        'Prophet Muhammad Birthday',
        'UAE National Day',
        'Commemoration Day'
      ]

      expectedHolidays.forEach(holidayName => {
        expect(holidays2024.some(h => h.name.includes(holidayName.split(' ')[0]))).toBe(true)
      })
    })

    it('should include all five daily prayers', () => {
      const config = service.getConfig()
      const prayerTimes = config.prayerTimes!

      expect(prayerTimes.fajr).toBeDefined()
      expect(prayerTimes.dhuhr).toBeDefined()
      expect(prayerTimes.asr).toBeDefined()
      expect(prayerTimes.maghrib).toBeDefined()
      expect(prayerTimes.isha).toBeDefined()
    })

    it('should respect Islamic calendar considerations', () => {
      // Test Ramadan handling
      expect(service.isRamadan(new Date('2024-03-15'))).toBe(true)
      expect(service.isRamadan(new Date('2025-03-05'))).toBe(true)

      // Test Ramadan schedule adjustments
      const ramadanConfig = service.getRamadanScheduleConfig()
      expect(ramadanConfig.culturalTone).toBe('FORMAL')
      expect(ramadanConfig.respectRamadan).toBe(true)
    })
  })
})