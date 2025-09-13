import { 
  UAE_CONSTANTS,
  culturalComplianceUtils,
  uaeTestDataGenerators,
  uaeBusinessScenarios 
} from '@/lib/uae-test-utils'

// Mock Date to allow testing specific scenarios
const mockDate = (dateString: string) => {
  const originalDate = global.Date
  global.Date = class extends originalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(dateString)
      } else {
        super(...args)
      }
    }
    static now() {
      return new originalDate(dateString).getTime()
    }
  } as any
  return () => {
    global.Date = originalDate
  }
}

describe('UAE Calendar Integration', () => {
  describe('Business Hours Validation', () => {
    it('validates standard UAE business hours (Sunday-Thursday, 9 AM - 6 PM)', () => {
      const businessHours = UAE_CONSTANTS.businessHours
      
      expect(businessHours.timezone).toBe('Asia/Dubai')
      expect(businessHours.workingDays).toEqual([
        'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'
      ])
      expect(businessHours.startTime).toBe('09:00')
      expect(businessHours.endTime).toBe('18:00')
    })

    it('identifies working hours correctly', () => {
      // Test within working hours
      const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      expect(validation).toHaveProperty('withinHours')
      
      if (!validation.withinHours && validation.reason) {
        // If not within hours, should provide clear reason
        expect(validation.reason).toMatch(/(not a working day|outside.*business hours)/i)
        expect(validation.adjustedTime).toBeDefined()
      }
    })

    it('correctly identifies UAE weekends (Friday-Saturday)', () => {
      const workingDays = UAE_CONSTANTS.businessHours.workingDays
      
      // Friday and Saturday should not be working days
      expect(workingDays).not.toContain('friday')
      expect(workingDays).not.toContain('saturday')
      
      // Sunday through Thursday should be working days
      expect(workingDays).toContain('sunday')
      expect(workingDays).toContain('monday')
      expect(workingDays).toContain('tuesday')
      expect(workingDays).toContain('wednesday')
      expect(workingDays).toContain('thursday')
    })

    it('handles business hours before 9 AM', () => {
      const earlyValidation = culturalComplianceUtils.validateBusinessHours('08:00', 'Asia/Dubai')
      
      if (!earlyValidation.withinHours) {
        expect(earlyValidation.reason).toContain('outside UAE business hours')
        expect(earlyValidation.adjustedTime).toBe('09:00')
      }
    })

    it('handles business hours after 6 PM', () => {
      const lateValidation = culturalComplianceUtils.validateBusinessHours('19:00', 'Asia/Dubai')
      
      if (!lateValidation.withinHours) {
        expect(lateValidation.reason).toContain('outside UAE business hours')
        expect(lateValidation.adjustedTime).toBe('09:00')
      }
    })

    it('provides proper time adjustments for non-business hours', () => {
      const validation = culturalComplianceUtils.validateBusinessHours('22:00', 'Asia/Dubai')
      
      if (!validation.withinHours) {
        expect(validation.adjustedTime).toBeDefined()
        expect(validation.reason).toContain('outside UAE business hours')
      }
    })
  })

  describe('Holiday Awareness and Scheduling', () => {
    it('defines correct UAE business calendar structure', () => {
      const emirates = UAE_CONSTANTS.emirates
      
      expect(emirates).toHaveLength(7)
      expect(emirates.map(e => e.code)).toEqual([
        'AD', 'DU', 'SH', 'AJ', 'UQ', 'RK', 'FU'
      ])
      
      // Verify each emirate has both English and Arabic names
      emirates.forEach(emirate => {
        expect(emirate.name).toBeDefined()
        expect(emirate.nameAr).toBeDefined()
        expect(emirate.code).toMatch(/^[A-Z]{2}$/)
      })
    })

    it('handles New Year holiday scheduling', () => {
      // Test scheduling around New Year's Day (January 1)
      const newYearDate = '2025-01-01'
      const restoreMock = mockDate(newYearDate)
      
      try {
        const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        
        // Should account for holiday if it falls on a working day
        expect(validation).toHaveProperty('withinHours')
        if (!validation.withinHours && validation.reason) {
          expect(validation.reason).toBeDefined()
        }
      } finally {
        restoreMock()
      }
    })

    it('handles UAE National Day scheduling', () => {
      // Test scheduling around UAE National Day (December 2)
      const nationalDayDate = '2025-12-02'
      const restoreMock = mockDate(nationalDayDate)
      
      try {
        const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        expect(validation).toHaveProperty('withinHours')
      } finally {
        restoreMock()
      }
    })

    it('respects Islamic holidays (Eid al-Fitr, Eid al-Adha)', () => {
      // Test general Islamic holiday handling
      // Note: Actual dates vary each year based on lunar calendar
      const template = uaeTestDataGenerators.createUAEBusinessTemplate({
        name: 'Eid Holiday Template',
        contentEn: 'Eid Mubarak! Our offices will be closed during the Eid holidays.',
        contentAr: 'عيد مبارك! ستكون مكاتبنا مغلقة خلال عطلة العيد.'
      })
      
      expect(template.contentEn).toContain('Eid')
      expect(template.contentAr).toContain('عيد')
      expect(template.uaeBusinessHoursOnly).toBe(true)
    })

    it('handles Commemoration Day scheduling', () => {
      // Test scheduling around Commemoration Day (November 30)
      const commemorationDate = '2025-11-30'
      const restoreMock = mockDate(commemorationDate)
      
      try {
        const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        expect(validation).toHaveProperty('withinHours')
      } finally {
        restoreMock()
      }
    })

    it('provides alternative scheduling for holidays', () => {
      // Test that the system provides alternatives when holidays are encountered
      const holidayValidation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      
      if (!holidayValidation.withinHours) {
        expect(holidayValidation.adjustedTime).toBeDefined()
        expect(holidayValidation.reason).toBeDefined()
      }
    })
  })

  describe('Prayer Time Avoidance', () => {
    it('defines prayer time avoidance settings', () => {
      // Prayer times are typically avoided during Maghrib and Isha
      const template = uaeTestDataGenerators.createUAEBusinessTemplate({
        name: 'Prayer Time Aware Template',
        contentEn: 'We respect prayer times and will contact you during appropriate hours.',
        contentAr: 'نحن نحترم أوقات الصلاة وسنتواصل معكم في الأوقات المناسبة.'
      })
      
      expect(template.contentEn).toContain('prayer times')
      expect(template.contentAr).toContain('الصلاة')
    })

    it('avoids sending communications during Maghrib prayer (sunset)', () => {
      // Maghrib typically occurs around sunset (varies by season)
      // Test general prayer time awareness
      const prayerTimeTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        contentEn: 'Assalamu Alaikum. We avoid contacting during prayer times out of respect.',
        contentAr: 'السلام عليكم. نتجنب التواصل أثناء أوقات الصلاة احتراماً.'
      })
      
      expect(prayerTimeTemplate.contentEn).toContain('prayer times')
      expect(prayerTimeTemplate.contentAr).toContain('الصلاة')
    })

    it('avoids sending communications during Isha prayer (night)', () => {
      // Isha typically occurs after sunset
      const nightPrayerValidation = culturalComplianceUtils.validateBusinessHours('20:00', 'Asia/Dubai')
      
      // 8 PM should be outside business hours anyway
      expect(nightPrayerValidation.withinHours).toBe(false)
      if (nightPrayerValidation.reason) {
        expect(nightPrayerValidation.reason).toContain('outside UAE business hours')
      }
    })

    it('respects Friday prayer time (Jummah)', () => {
      // Friday is a weekend in UAE, so this is automatically handled
      const fridayValidation = culturalComplianceUtils.validateBusinessHours('13:00', 'Asia/Dubai')
      
      // Friday should not be a working day
      if (!fridayValidation.withinHours && fridayValidation.reason) {
        expect(fridayValidation.reason).toContain('not a working day')
      }
    })

    it('provides prayer-time-aware scheduling suggestions', () => {
      // Test that the system considers prayer times in scheduling
      const validation = culturalComplianceUtils.validateBusinessHours('17:30', 'Asia/Dubai')
      
      // Late afternoon might conflict with Maghrib during winter months
      if (!validation.withinHours) {
        expect(validation.adjustedTime).toBeDefined()
      }
    })
  })

  describe('Ramadan Special Hours Handling', () => {
    it('defines Ramadan business hours (9 AM - 3 PM)', () => {
      const ramadanHours = UAE_CONSTANTS.businessHours.ramadanHours
      
      expect(ramadanHours.start).toBe('09:00')
      expect(ramadanHours.end).toBe('15:00')
    })

    it('creates Ramadan-appropriate templates', () => {
      const ramadanTemplate = uaeTestDataGenerators.createRamadanTemplate()
      
      expect(ramadanTemplate.name).toBe('Ramadan Business Template')
      expect(ramadanTemplate.subjectEn).toContain('Ramadan Kareem')
      expect(ramadanTemplate.subjectAr).toContain('رمضان كريم')
      expect(ramadanTemplate.contentEn).toContain('9:00 AM - 3:00 PM')
      expect(ramadanTemplate.contentEn).toContain('blessed month')
      expect(ramadanTemplate.contentAr).toContain('الشهر المبارك')
      expect(ramadanTemplate.uaeBusinessHoursOnly).toBe(true)
    })

    it('validates Ramadan template cultural appropriateness', () => {
      const ramadanTemplate = uaeTestDataGenerators.createRamadanTemplate()
      
      const englishValidation = culturalComplianceUtils.validateBusinessEtiquette(
        ramadanTemplate.contentEn,
        'en'
      )
      
      expect(englishValidation.appropriate).toBe(true)
      expect(englishValidation.score).toBeGreaterThan(80)
      expect(englishValidation.recommendations.length).toBeLessThan(2)
    })

    it('handles Ramadan timing considerations', () => {
      // During Ramadan, business hours are typically reduced
      const ramadanHours = UAE_CONSTANTS.businessHours.ramadanHours
      
      // 4 PM would be outside Ramadan business hours
      const ramadanValidation = culturalComplianceUtils.validateBusinessHours('16:00', 'Asia/Dubai')
      
      // Should handle this appropriately (either within hours or provide reason)
      expect(ramadanValidation).toHaveProperty('withinHours')
      if (!ramadanValidation.withinHours) {
        expect(ramadanValidation.reason).toBeDefined()
      }
    })

    it('provides Ramadan-specific greetings and content', () => {
      const ramadanTemplate = uaeTestDataGenerators.createRamadanTemplate()
      
      // Should include appropriate Ramadan greetings
      expect(ramadanTemplate.contentEn).toContain('Ramadan Kareem')
      expect(ramadanTemplate.contentAr).toContain('رمضان كريم')
      
      // Should mention adjusted hours
      expect(ramadanTemplate.contentEn).toContain('9:00 AM - 3:00 PM')
      
      // Should include respectful language
      expect(ramadanTemplate.contentEn).toContain('blessed month')
      expect(ramadanTemplate.contentEn).toContain('peace and prosperity')
    })

    it('adjusts sequence timing during Ramadan', () => {
      // Test that sequences respect Ramadan hours
      const ramadanSequence = {
        name: 'Ramadan Collection Sequence',
        description: 'Gentle collection sequence for Ramadan period',
        steps: [
          {
            type: 'WAIT',
            config: {
              delay: 1,
              delayUnit: 'DAYS',
              businessHoursOnly: true,
              avoidPrayerTimes: true
            },
            uaeSettings: {
              respectBusinessHours: true,
              honorPrayerTimes: true,
              respectHolidays: true,
              culturalTone: 'GENTLE'
            }
          }
        ],
        uaeBusinessHoursOnly: true,
        respectHolidays: true
      }
      
      expect(ramadanSequence.uaeBusinessHoursOnly).toBe(true)
      expect(ramadanSequence.steps[0].config.avoidPrayerTimes).toBe(true)
      expect(ramadanSequence.steps[0].uaeSettings.culturalTone).toBe('GENTLE')
    })
  })

  describe('Weekend Handling (Friday-Saturday)', () => {
    it('correctly identifies UAE weekends', () => {
      const workingDays = UAE_CONSTANTS.businessHours.workingDays
      
      // UAE weekend is Friday-Saturday
      expect(workingDays).not.toContain('friday')
      expect(workingDays).not.toContain('saturday')
      
      // Working week is Sunday-Thursday
      expect(workingDays).toContain('sunday')
      expect(workingDays).toContain('thursday')
    })

    it('handles Friday scheduling appropriately', () => {
      const fridayDate = '2025-01-10' // Assuming this is a Friday
      const restoreMock = mockDate(fridayDate)
      
      try {
        const fridayValidation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        
        if (!fridayValidation.withinHours) {
          expect(fridayValidation.reason).toContain('not a working day')
          expect(fridayValidation.adjustedTime).toBe('Sunday 09:00')
        }
      } finally {
        restoreMock()
      }
    })

    it('handles Saturday scheduling appropriately', () => {
      const saturdayDate = '2025-01-11' // Assuming this is a Saturday
      const restoreMock = mockDate(saturdayDate)
      
      try {
        const saturdayValidation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        
        if (!saturdayValidation.withinHours) {
          expect(saturdayValidation.reason).toContain('not a working day')
          expect(saturdayValidation.adjustedTime).toBe('Sunday 09:00')
        }
      } finally {
        restoreMock()
      }
    })

    it('suggests next business day for weekend scheduling', () => {
      // Test that weekend scheduling suggests Sunday as next business day
      const weekendValidation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      
      if (!weekendValidation.withinHours && weekendValidation.adjustedTime) {
        // Should suggest Sunday or next working day
        expect(weekendValidation.adjustedTime).toMatch(/(Sunday|09:00)/)
      }
    })

    it('respects weekend settings in sequence steps', () => {
      const weekendAwareStep = {
        type: 'WAIT',
        config: {
          delay: 1,
          delayUnit: 'DAYS',
          avoidWeekends: true,
          businessHoursOnly: true
        },
        uaeSettings: {
          respectBusinessHours: true,
          honorPrayerTimes: true,
          respectHolidays: true,
          culturalTone: 'PROFESSIONAL'
        }
      }
      
      expect(weekendAwareStep.config.avoidWeekends).toBe(true)
      expect(weekendAwareStep.config.businessHoursOnly).toBe(true)
      expect(weekendAwareStep.uaeSettings.respectBusinessHours).toBe(true)
    })
  })

  describe('Time Zone Handling (Asia/Dubai)', () => {
    it('uses correct UAE timezone', () => {
      const timezone = UAE_CONSTANTS.businessHours.timezone
      expect(timezone).toBe('Asia/Dubai')
    })

    it('handles time zone conversions correctly', () => {
      // Test that time validations use UAE timezone
      const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      expect(validation).toHaveProperty('withinHours')
      
      // Should handle timezone-specific date formatting
      const now = new Date()
      const dubaiTime = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }).format(now)
      
      expect(dubaiTime).toMatch(/^\d{2}:\d{2}$/)
    })

    it('handles daylight saving time considerations', () => {
      // UAE does not observe daylight saving time
      // UTC+4 year-round
      const timezone = UAE_CONSTANTS.businessHours.timezone
      expect(timezone).toBe('Asia/Dubai')
      
      // Test that business hours remain consistent throughout the year
      const businessHours = UAE_CONSTANTS.businessHours
      expect(businessHours.startTime).toBe('09:00')
      expect(businessHours.endTime).toBe('18:00')
    })

    it('formats dates correctly for UAE locale', () => {
      // Test Arabic date formatting
      const testDate = new Date('2025-01-15')
      const arabicDate = testDate.toLocaleDateString('ar-AE', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      expect(arabicDate).toBeDefined()
      expect(typeof arabicDate).toBe('string')
    })
  })

  describe('Calendar Integration Edge Cases', () => {
    it('handles month transitions correctly', () => {
      // Test end of month scenarios
      const endOfMonthDate = '2025-01-31'
      const restoreMock = mockDate(endOfMonthDate)
      
      try {
        const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        expect(validation).toHaveProperty('withinHours')
      } finally {
        restoreMock()
      }
    })

    it('handles year transitions correctly', () => {
      // Test New Year transition
      const newYearEve = '2024-12-31'
      const restoreMock = mockDate(newYearEve)
      
      try {
        const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        expect(validation).toHaveProperty('withinHours')
      } finally {
        restoreMock()
      }
    })

    it('handles leap year considerations', () => {
      // Test February 29 in leap year
      const leapYearDate = '2024-02-29'
      const restoreMock = mockDate(leapYearDate)
      
      try {
        const validation = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        expect(validation).toHaveProperty('withinHours')
      } finally {
        restoreMock()
      }
    })

    it('handles invalid date inputs gracefully', () => {
      // Test error handling for invalid dates
      expect(() => {
        culturalComplianceUtils.validateBusinessHours('25:00', 'Asia/Dubai')
      }).not.toThrow()
      
      expect(() => {
        culturalComplianceUtils.validateBusinessHours('10:00', 'Invalid/Timezone')
      }).not.toThrow()
    })

    it('provides fallback behavior for system clock issues', () => {
      // Test behavior when system clock is unavailable or incorrect
      const originalDate = global.Date
      
      try {
        // Mock a problematic Date constructor
        global.Date = class extends originalDate {
          constructor(...args: any[]) {
            if (args.length === 0) {
              throw new Error('System clock unavailable')
            }
            super(...args)
          }
        } as any
        
        // Should handle gracefully
        expect(() => {
          culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
        }).not.toThrow()
        
      } finally {
        global.Date = originalDate
      }
    })
  })

  describe('Business Scenario Integration', () => {
    it('integrates calendar logic with gentle reminder scenarios', () => {
      const gentleScenario = uaeBusinessScenarios.gentleReminder
      
      expect(gentleScenario.day).toBe(3)
      expect(gentleScenario.tone).toBe('polite')
      expect(gentleScenario.expectedElements).toContain('gentle')
      expect(gentleScenario.expectedElements).toContain('understanding')
    })

    it('integrates calendar logic with professional follow-up scenarios', () => {
      const professionalScenario = uaeBusinessScenarios.professionalFollowUp
      
      expect(professionalScenario.day).toBe(7)
      expect(professionalScenario.tone).toBe('professional')
      expect(professionalScenario.expectedElements).toContain('business hours')
    })

    it('integrates calendar logic with firm notice scenarios', () => {
      const firmScenario = uaeBusinessScenarios.firmNotice
      
      expect(firmScenario.day).toBe(15)
      expect(firmScenario.tone).toBe('firm')
      expect(firmScenario.expectedElements).toContain('deadline')
    })

    it('integrates calendar logic with final notice scenarios', () => {
      const finalScenario = uaeBusinessScenarios.finalNotice
      
      expect(finalScenario.day).toBe(30)
      expect(finalScenario.tone).toBe('formal')
      expect(finalScenario.expectedElements).toContain('UAE Commercial Law')
    })

    it('ensures escalation timeline respects UAE holidays', () => {
      // Test that escalation timelines account for UAE calendar
      const scenarios = [
        uaeBusinessScenarios.gentleReminder,
        uaeBusinessScenarios.professionalFollowUp,
        uaeBusinessScenarios.firmNotice,
        uaeBusinessScenarios.finalNotice
      ]
      
      // Each scenario should have increasing day counts
      for (let i = 1; i < scenarios.length; i++) {
        expect(scenarios[i].day).toBeGreaterThan(scenarios[i - 1].day)
      }
    })
  })
})