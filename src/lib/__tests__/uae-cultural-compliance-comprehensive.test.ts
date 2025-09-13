/**
 * Comprehensive Test Suite for UAE Cultural Compliance Features
 * Tests all cultural compliance methods including calculateCulturalScore, Islamic greetings,
 * Arabic language detection, prayer times, and business relationship handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  CulturalComplianceService,
  CustomerRelationship,
  SequenceType
} from '../services/cultural-compliance-service'
import { 
  isUAEHoliday,
  isUAEBusinessDay,
  isNearPrayerTime,
  isRamadan,
  UAE_HOLIDAYS_2025,
  DUBAI_PRAYER_TIMES
} from '../utils/uae-calendar'

describe('UAE Cultural Compliance Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Cultural Score Calculation (0-100 System)', () => {
    describe('Perfect Cultural Score Scenarios', () => {
      it('should give perfect score for exemplary UAE business communication', () => {
        const exemplaryContent = `As-salamu alaykum and Dear Valued Customer Mr. Ahmed,

We hope this email finds you well during our UAE business hours (Sunday-Thursday, 9:00 AM - 6:00 PM).

We would kindly appreciate your attention to Invoice #UAE-001 at your convenience.

Please contact us during business hours for any assistance.

JazakAllahu khair and best regards,
Emirates Business Solutions LLC
TRN: 100123456789012`

        const result = CulturalComplianceService.calculateCulturalScore(exemplaryContent, {
          language: 'en',
          customerRelationship: 'REGULAR',
          isRamadan: false,
          sequenceType: 'FIRST_REMINDER'
        })

        expect(result.score).toBeGreaterThan(90)
        expect(result.breakdown.languageAppropriate).toBeGreaterThan(85)
        expect(result.breakdown.greetingsAndClosings).toBeGreaterThan(90)
        expect(result.breakdown.islamicEtiquette).toBeGreaterThan(90)
        expect(result.breakdown.businessFormality).toBeGreaterThan(85)
        expect(result.recommendations.length).toBeLessThan(3)
      })

      it('should score Arabic content with Islamic phrases highly', () => {
        const arabicContent = `السلام عليكم وعزيزي العميل المحترم السيد أحمد،

نأمل أن يصلكم هذا البريد خلال ساعات العمل في الإمارات (الأحد - الخميس، 9:00 ص - 6:00 م).

نود أن نلفت انتباهكم بكل احترام إلى الفاتورة رقم UAE-001.

يرجى الاتصال بنا خلال ساعات العمل للحصول على أي مساعدة.

بارك الله فيكم وأطيب التحيات،
شركة الإمارات للحلول التجارية ذ.م.م
الرقم الضريبي: 100123456789012`

        const result = CulturalComplianceService.calculateCulturalScore(arabicContent, {
          language: 'ar',
          customerRelationship: 'REGULAR'
        })

        expect(result.score).toBeGreaterThan(85)
        expect(result.breakdown.islamicEtiquette).toBeGreaterThan(90)
        expect(result.breakdown.greetingsAndClosings).toBeGreaterThan(85)
      })
    })

    describe('Cultural Score Penalties', () => {
      it('should heavily penalize aggressive and demanding language', () => {
        const aggressiveContent = `Hey customer,

You MUST pay this invoice IMMEDIATELY!!! No excuses!

Pay right now or we'll take legal action! This is urgent and demands your immediate attention!

We will not wait any longer!`

        const result = CulturalComplianceService.calculateCulturalScore(aggressiveContent, {
          language: 'en',
          customerRelationship: 'REGULAR'
        })

        expect(result.score).toBeLessThan(40)
        expect(result.breakdown.languageAppropriate).toBeLessThan(50)
        expect(result.breakdown.greetingsAndClosings).toBeLessThan(30)
        expect(result.breakdown.toneRespectfulness).toBeLessThan(20)
        expect(result.recommendations.length).toBeGreaterThan(5)
        
        expect(result.recommendations.some(r => r.includes('inappropriate phrase'))).toBe(true)
        expect(result.recommendations.some(r => r.includes('proper greeting'))).toBe(true)
        expect(result.recommendations.some(r => r.includes('demanding language'))).toBe(true)
      })

      it('should penalize culturally insensitive terms', () => {
        const insensitiveContent = `Dear Customer,

Your payment deadline has passed. We demand immediate payment or face penalty charges.

You must pay the late fees and interest charges right now.

Regards`

        const result = CulturalComplianceService.calculateCulturalScore(insensitiveContent, {
          customerRelationship: 'REGULAR'
        })

        expect(result.score).toBeLessThan(60)
        expect(result.recommendations.some(r => r.includes('deadline'))).toBe(true)
        expect(result.recommendations.some(r => r.includes('demand'))).toBe(true)
        expect(result.recommendations.some(r => r.includes('penalty'))).toBe(true)
      })

      it('should apply stricter standards for government customers', () => {
        const casualContent = `Hi there,

Hope you're doing well! Just wanted to follow up on that invoice.

Let me know when you can pay it.

Thanks!`

        const regularResult = CulturalComplianceService.calculateCulturalScore(casualContent, {
          customerRelationship: 'REGULAR'
        })

        const governmentResult = CulturalComplianceService.calculateCulturalScore(casualContent, {
          customerRelationship: 'GOVERNMENT'
        })

        expect(governmentResult.score).toBeLessThan(regularResult.score)
        expect(governmentResult.recommendations.some(r => 
          r.includes('formal language for government')
        )).toBe(true)
      })
    })

    describe('Ramadan Cultural Adjustments', () => {
      it('should recommend Ramadan greetings during holy month', () => {
        const standardContent = `Dear Valued Customer,

Please review your invoice at your convenience.

Best regards,
Company TRN: 123456789012345`

        const ramadanResult = CulturalComplianceService.calculateCulturalScore(standardContent, {
          isRamadan: true
        })

        expect(ramadanResult.recommendations.some(r => 
          r.includes('Ramadan greetings')
        )).toBe(true)
      })

      it('should score Ramadan-appropriate content higher during holy month', () => {
        const ramadanContent = `As-salamu alaykum and Ramadan Kareem, Dear Valued Customer,

During this blessed month, please review your invoice when convenient.

May this Ramadan bring you peace and prosperity.

Best regards,
Company TRN: 123456789012345`

        const regularResult = CulturalComplianceService.calculateCulturalScore(ramadanContent, {
          isRamadan: false
        })

        const ramadanResult = CulturalComplianceService.calculateCulturalScore(ramadanContent, {
          isRamadan: true
        })

        expect(ramadanResult.score).toBeGreaterThanOrEqual(regularResult.score)
      })
    })

    describe('Score Breakdown Analysis', () => {
      it('should provide detailed breakdown of all scoring categories', () => {
        const testContent = `Dear Customer, pay your invoice. Regards.`

        const result = CulturalComplianceService.calculateCulturalScore(testContent)

        expect(result.breakdown).toHaveProperty('languageAppropriate')
        expect(result.breakdown).toHaveProperty('greetingsAndClosings')
        expect(result.breakdown).toHaveProperty('toneRespectfulness')
        expect(result.breakdown).toHaveProperty('culturalSensitivity')
        expect(result.breakdown).toHaveProperty('islamicEtiquette')
        expect(result.breakdown).toHaveProperty('businessFormality')

        // All scores should be between 0-100
        Object.values(result.breakdown).forEach(score => {
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
        })
      })

      it('should weight categories correctly in final score', () => {
        const perfectGreeting = `As-salamu alaykum Dear Valued Customer,`
        const noGreeting = `Pay your invoice.`
        
        const goodResult = CulturalComplianceService.calculateCulturalScore(
          `${perfectGreeting} Please pay invoice. JazakAllahu khair.`
        )
        
        const badResult = CulturalComplianceService.calculateCulturalScore(
          `${noGreeting} TRN: 123. Business hours: 9-6.`
        )

        // Good greetings should significantly impact final score (20% weight)
        expect(goodResult.score - badResult.score).toBeGreaterThan(15)
      })
    })
  })

  describe('Islamic Greetings and Business Etiquette', () => {
    describe('Appropriate Greeting Validation', () => {
      it('should classify Islamic greetings as excellent', () => {
        const islamicGreetings = [
          'As-salamu alaykum Dear Customer',
          'Peace be upon you and greetings',
          'As-Salamu Alaykum and welcome'
        ]

        islamicGreetings.forEach(greeting => {
          const result = CulturalComplianceService.isAppropriateGreeting(greeting, 'en')
          expect(result.appropriate).toBe(true)
          expect(result.culturalLevel).toBe('excellent')
          expect(result.suggestion).toBeUndefined()
        })
      })

      it('should classify formal business greetings as good', () => {
        const formalGreetings = [
          'Dear Valued Customer',
          'Dear Esteemed Client',
          'Respected Customer Mr. Ahmed'
        ]

        formalGreetings.forEach(greeting => {
          const result = CulturalComplianceService.isAppropriateGreeting(greeting, 'en')
          expect(result.appropriate).toBe(true)
          expect(result.culturalLevel).toBe('good')
        })
      })

      it('should classify standard greetings as acceptable', () => {
        const standardGreetings = [
          'Dear Sir/Madam',
          'Dear Customer',
          'Dear Mr. Ahmed'
        ]

        standardGreetings.forEach(greeting => {
          const result = CulturalComplianceService.isAppropriateGreeting(greeting, 'en')
          expect(result.appropriate).toBe(true)
          expect(result.culturalLevel).toBe('acceptable')
        })
      })

      it('should classify informal greetings as poor', () => {
        const informalGreetings = [
          'Hi there!',
          'Hey customer',
          'Hello buddy'
        ]

        informalGreetings.forEach(greeting => {
          const result = CulturalComplianceService.isAppropriateGreeting(greeting, 'en')
          expect(result.appropriate).toBe(false)
          expect(result.culturalLevel).toBe('poor')
          expect(result.suggestion).toContain('formal greetings')
        })
      })

      it('should handle Arabic greetings appropriately', () => {
        const arabicGreetings = [
          'السلام عليكم عزيزي العميل',
          'عزيزي العميل المحترم',
          'المحترم السيد أحمد'
        ]

        arabicGreetings.forEach(greeting => {
          const result = CulturalComplianceService.isAppropriateGreeting(greeting, 'ar')
          expect(result.appropriate).toBe(true)
          expect(result.culturalLevel).toBe('excellent')
        })
      })
    })

    describe('Islamic Business Phrases Integration', () => {
      it('should recognize and reward common Islamic business phrases', () => {
        const islamicPhrases = [
          'Barakallahu feeki for your business',
          'JazakAllahu khair for your cooperation',
          'May Allah bless your business endeavors',
          'Fi Amanillah until we meet again'
        ]

        islamicPhrases.forEach(phrase => {
          const result = CulturalComplianceService.calculateCulturalScore(
            `Dear Customer, ${phrase}. Best regards, Company`
          )
          expect(result.breakdown.islamicEtiquette).toBeGreaterThan(100) // Bonus points
          expect(result.score).toBeGreaterThan(70)
        })
      })

      it('should suggest Islamic greetings when none are present', () => {
        const businessContent = `Dear Customer,
        
        Please pay your invoice.
        
        Best regards, Company TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(businessContent)
        
        expect(result.recommendations.some(r => 
          r.includes('Islamic greetings for stronger cultural connection')
        )).toBe(true)
      })
    })

    describe('Business Etiquette Context Awareness', () => {
      it('should adapt etiquette expectations based on sequence type', () => {
        const content = `Dear Customer, please review invoice. Regards.`

        const firstReminderResult = CulturalComplianceService.calculateCulturalScore(content, {
          sequenceType: 'FIRST_REMINDER'
        })

        const finalNoticeResult = CulturalComplianceService.calculateCulturalScore(content, {
          sequenceType: 'FINAL_NOTICE'
        })

        // Final notices may require more formal business language
        expect(finalNoticeResult.recommendations.length).toBeGreaterThanOrEqual(firstReminderResult.recommendations.length)
      })
    })
  })

  describe('Arabic Language Detection and RTL Support', () => {
    describe('Arabic Text Detection', () => {
      it('should accurately detect Arabic characters', () => {
        const testCases = [
          { text: 'مرحباً بكم في الإمارات', expected: true },
          { text: 'Welcome to UAE', expected: false },
          { text: 'Welcome مرحباً', expected: true },
          { text: 'الرقم الضريبي: TRN-123', expected: true },
          { text: '', expected: false }
        ]

        testCases.forEach(({ text, expected }) => {
          const result = CulturalComplianceService.detectArabicLanguage(text)
          expect(result.hasArabic).toBe(expected)
        })
      })

      it('should calculate Arabic percentage accurately', () => {
        const testCases = [
          { text: 'مرحبا', expectedRange: [90, 100] }, // Pure Arabic
          { text: 'Hello مرحبا', expectedRange: [30, 70] }, // Mixed
          { text: 'Hello World', expectedRange: [0, 5] } // No Arabic
        ]

        testCases.forEach(({ text, expectedRange }) => {
          const result = CulturalComplianceService.detectArabicLanguage(text)
          expect(result.arabicPercentage).toBeGreaterThanOrEqual(expectedRange[0])
          expect(result.arabicPercentage).toBeLessThanOrEqual(expectedRange[1])
        })
      })
    })

    describe('RTL Layout Requirements', () => {
      it('should determine RTL requirement correctly', () => {
        const testCases = [
          { 
            text: 'عزيزي العميل، يرجى دفع الفاتورة. شكراً لكم.',
            shouldBeRTL: true,
            requiresRTLLayout: true
          },
          { 
            text: 'Dear Customer عزيز, please pay فاتورة invoice.',
            shouldBeRTL: false,
            requiresRTLLayout: false
          },
          { 
            text: 'Hello World, this is English text.',
            shouldBeRTL: false,
            requiresRTLLayout: false
          }
        ]

        testCases.forEach(({ text, shouldBeRTL, requiresRTLLayout }) => {
          const result = CulturalComplianceService.detectArabicLanguage(text)
          expect(result.isRTL).toBe(shouldBeRTL)
          expect(result.requiresRTLLayout).toBe(requiresRTLLayout)
        })
      })
    })

    describe('Arabic Word Extraction', () => {
      it('should extract Arabic words correctly', () => {
        const text = 'Dear Customer عزيزي العميل, please pay الفاتورة.'
        const result = CulturalComplianceService.detectArabicLanguage(text)

        expect(result.arabicWords).toContain('عزيزي')
        expect(result.arabicWords).toContain('العميل')
        expect(result.arabicWords).toContain('الفاتورة')
        expect(result.arabicWords.length).toBe(3)
      })

      it('should handle complex Arabic text with diacritics', () => {
        const text = 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ'
        const result = CulturalComplianceService.detectArabicLanguage(text)

        expect(result.hasArabic).toBe(true)
        expect(result.arabicPercentage).toBeGreaterThan(95)
        expect(result.arabicWords.length).toBeGreaterThan(0)
      })
    })

    describe('Mixed Language Detection', () => {
      it('should detect mixed language content', () => {
        const mixedTexts = [
          'Dear عزيزي Customer العميل',
          'Invoice فاتورة #123 due تاريخ الاستحقاق',
          'TRN الرقم الضريبي: 100123456789012'
        ]

        mixedTexts.forEach(text => {
          const result = CulturalComplianceService.detectArabicLanguage(text)
          expect(result.mixedLanguage).toBe(true)
          expect(result.hasArabic).toBe(true)
          expect(result.arabicPercentage).toBeGreaterThan(0)
          expect(result.arabicPercentage).toBeLessThan(100)
        })
      })
    })
  })

  describe('Tone Escalation Validation', () => {
    describe('Appropriate Escalation Timing', () => {
      it('should validate proper timing between reminders', () => {
        const appropriateSteps = [
          { tone: 'FRIENDLY', content: 'Gentle reminder', delayDays: 7 },
          { tone: 'BUSINESS', content: 'Follow up', delayDays: 7 },
          { tone: 'FORMAL', content: 'Important notice', delayDays: 7 },
          { tone: 'FIRM', content: 'Final notice', delayDays: 7 }
        ]

        const result = CulturalComplianceService.validateToneEscalation(appropriateSteps, 'REGULAR')

        expect(result.appropriate).toBe(true)
        expect(result.issues.length).toBe(0)
        expect(result.suggestions.length).toBe(0)
      })

      it('should flag reminders that are too frequent', () => {
        const frequentSteps = [
          { tone: 'FRIENDLY', content: 'First reminder', delayDays: 2 }, // Too soon
          { tone: 'BUSINESS', content: 'Second reminder', delayDays: 3 }, // Too frequent
          { tone: 'FORMAL', content: 'Third reminder', delayDays: 2 }   // Too frequent
        ]

        const result = CulturalComplianceService.validateToneEscalation(frequentSteps, 'REGULAR')

        expect(result.appropriate).toBe(false)
        expect(result.issues.some(issue => issue.includes('First reminder too soon'))).toBe(true)
        expect(result.issues.some(issue => issue.includes('follows too quickly'))).toBe(true)
        expect(result.suggestions.some(s => s.includes('7 days before first reminder'))).toBe(true)
      })
    })

    describe('Customer Relationship-Based Tone Progression', () => {
      it('should recommend conservative progression for government customers', () => {
        const result = CulturalComplianceService.validateToneEscalation([], 'GOVERNMENT')
        const progression = result.recommendedProgression

        expect(progression).toEqual(['VERY_FORMAL', 'VERY_FORMAL', 'FORMAL', 'FORMAL'])
        expect(progression.every(tone => ['VERY_FORMAL', 'FORMAL'].includes(tone))).toBe(true)
      })

      it('should recommend balanced progression for VIP customers', () => {
        const result = CulturalComplianceService.validateToneEscalation([], 'VIP')
        const progression = result.recommendedProgression

        expect(progression).toEqual(['FRIENDLY', 'BUSINESS', 'FORMAL', 'FORMAL'])
        expect(progression[0]).toBe('FRIENDLY') // Start gentle
        expect(progression[3]).toBe('FORMAL')   // End formal, not firm
      })

      it('should allow firmer progression for regular customers', () => {
        const result = CulturalComplianceService.validateToneEscalation([], 'REGULAR')
        const progression = result.recommendedProgression

        expect(progression).toEqual(['FRIENDLY', 'BUSINESS', 'FORMAL', 'FIRM'])
        expect(progression[3]).toBe('FIRM') // Can end with firm tone
      })

      it('should start formal for new customers', () => {
        const result = CulturalComplianceService.validateToneEscalation([], 'NEW')
        const progression = result.recommendedProgression

        expect(progression[0]).toBe('VERY_FORMAL') // Start very formal
        expect(progression).toEqual(['VERY_FORMAL', 'FORMAL', 'BUSINESS', 'FORMAL'])
      })
    })

    describe('Tone Progression Validation', () => {
      it('should flag overly aggressive tone for customer type', () => {
        const aggressiveSteps = [
          { tone: 'URGENT', content: 'Pay immediately!', delayDays: 7 },
          { tone: 'FIRM', content: 'Final demand', delayDays: 7 }
        ]

        const governmentResult = CulturalComplianceService.validateToneEscalation(
          aggressiveSteps, 'GOVERNMENT'
        )
        const vipResult = CulturalComplianceService.validateToneEscalation(
          aggressiveSteps, 'VIP'
        )

        expect(governmentResult.appropriate).toBe(false)
        expect(vipResult.appropriate).toBe(false)
        expect(governmentResult.issues.some(i => i.includes('too aggressive'))).toBe(true)
        expect(vipResult.issues.some(i => i.includes('too aggressive'))).toBe(true)
      })

      it('should provide specific tone recommendations for each step', () => {
        const inappropriateSteps = [
          { tone: 'URGENT', content: 'Urgent payment!', delayDays: 7 },
          { tone: 'FIRM', content: 'Legal action pending', delayDays: 7 }
        ]

        const result = CulturalComplianceService.validateToneEscalation(
          inappropriateSteps, 'GOVERNMENT'
        )

        expect(result.suggestions.some(s => s.includes('VERY_FORMAL tone'))).toBe(true)
      })
    })
  })

  describe('Prayer Time and Islamic Calendar Integration', () => {
    describe('Prayer Time Awareness', () => {
      it('should detect when communication is near prayer times', () => {
        // Test Maghrib (sunset prayer) time
        const maghribTime = new Date('2025-01-15T18:10:00') // January Maghrib time
        const beforeMaghrib = new Date('2025-01-15T17:50:00') // 20 min before
        const afterMaghrib = new Date('2025-01-15T18:35:00') // 25 min after

        expect(isNearPrayerTime(beforeMaghrib, 30)).toBe(true)
        expect(isNearPrayerTime(afterMaghrib, 30)).toBe(true)
        expect(isNearPrayerTime(maghribTime, 30)).toBe(true)

        // Test outside prayer time buffer
        const morningTime = new Date('2025-01-15T10:00:00')
        expect(isNearPrayerTime(morningTime, 30)).toBe(false)
      })

      it('should provide prayer times for different months', () => {
        // Test that prayer times are defined for all 12 months
        Object.keys(DUBAI_PRAYER_TIMES).forEach(month => {
          const monthNum = parseInt(month)
          expect(monthNum).toBeGreaterThanOrEqual(1)
          expect(monthNum).toBeLessThanOrEqual(12)
          
          const prayers = DUBAI_PRAYER_TIMES[monthNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12]
          expect(prayers).toHaveProperty('fajr')
          expect(prayers).toHaveProperty('dhuhr')
          expect(prayers).toHaveProperty('asr')
          expect(prayers).toHaveProperty('maghrib')
          expect(prayers).toHaveProperty('isha')
        })
      })
    })

    describe('Islamic Holiday Detection', () => {
      it('should correctly identify UAE Islamic holidays', () => {
        const islamicHolidays = UAE_HOLIDAYS_2025.filter(h => h.type === 'ISLAMIC')
        
        expect(islamicHolidays.length).toBeGreaterThan(5)
        expect(islamicHolidays.some(h => h.name.includes('Eid Al-Fitr'))).toBe(true)
        expect(islamicHolidays.some(h => h.name.includes('Eid Al-Adha'))).toBe(true)
        expect(islamicHolidays.some(h => h.name.includes('Islamic New Year'))).toBe(true)
        expect(islamicHolidays.some(h => h.name.includes('Prophet Muhammad'))).toBe(true)
      })

      it('should identify UAE National holidays', () => {
        const nationalHolidays = UAE_HOLIDAYS_2025.filter(h => h.type === 'PUBLIC')
        
        expect(nationalHolidays.some(h => h.name.includes('UAE National Day'))).toBe(true)
        expect(nationalHolidays.some(h => h.name.includes('Commemoration Day'))).toBe(true)
        expect(nationalHolidays.some(h => h.name.includes('New Year'))).toBe(true)
      })

      it('should correctly identify holiday dates', () => {
        // Test specific known holidays
        const nationalDay = new Date('2025-12-02')
        const newYear = new Date('2025-01-01')
        const nonHoliday = new Date('2025-05-15')

        expect(isUAEHoliday(nationalDay)).toBeTruthy()
        expect(isUAEHoliday(newYear)).toBeTruthy()
        expect(isUAEHoliday(nonHoliday)).toBeNull()
      })
    })

    describe('Business Day Calculations', () => {
      it('should correctly identify UAE business days', () => {
        // UAE business week is Sunday-Thursday
        const sunday = new Date('2025-01-05')    // Business day
        const monday = new Date('2025-01-06')    // Business day
        const thursday = new Date('2025-01-09')  // Business day
        const friday = new Date('2025-01-10')    // Weekend
        const saturday = new Date('2025-01-11')  // Weekend

        expect(isUAEBusinessDay(sunday)).toBe(true)
        expect(isUAEBusinessDay(monday)).toBe(true)
        expect(isUAEBusinessDay(thursday)).toBe(true)
        expect(isUAEBusinessDay(friday)).toBe(false)
        expect(isUAEBusinessDay(saturday)).toBe(false)
      })

      it('should exclude holidays from business days', () => {
        const nationalDay = new Date('2025-12-02')
        expect(isUAEBusinessDay(nationalDay)).toBe(false)
      })
    })
  })

  describe('Ramadan Cultural Sensitivity', () => {
    describe('Ramadan Period Detection', () => {
      it('should detect Ramadan periods correctly', () => {
        const ramadanDate = new Date('2025-03-05') // During Ramadan 2025
        const nonRamadanDate = new Date('2025-05-15')

        expect(isRamadan(ramadanDate)).toBe(true)
        expect(isRamadan(nonRamadanDate)).toBe(false)
      })
    })

    describe('Ramadan Communication Adjustments', () => {
      it('should adjust cultural scoring during Ramadan', () => {
        const standardContent = `Dear Customer,
        
        Please review your invoice when convenient.
        
        Best regards, Company`

        const ramadanContent = `As-salamu alaykum and Ramadan Kareem,
        
        During this blessed month, please review your invoice at your convenience.
        
        May Allah bless you during this holy time.
        
        Best regards, Company`

        const standardScore = CulturalComplianceService.calculateCulturalScore(standardContent, {
          isRamadan: true
        })

        const ramadanScore = CulturalComplianceService.calculateCulturalScore(ramadanContent, {
          isRamadan: true
        })

        expect(ramadanScore.score).toBeGreaterThan(standardScore.score)
        expect(ramadanScore.breakdown.islamicEtiquette).toBeGreaterThan(90)
      })

      it('should recommend Ramadan-specific phrases during holy month', () => {
        const basicContent = `Dear Customer, please pay invoice. Regards.`

        const result = CulturalComplianceService.calculateCulturalScore(basicContent, {
          isRamadan: true
        })

        expect(result.recommendations.some(r => r.includes('Ramadan'))).toBe(true)
      })
    })

    describe('Ramadan Business Hour Considerations', () => {
      it('should provide appropriate business hours during Ramadan', () => {
        // This would integrate with the UAE calendar service
        const ramadanDate = new Date('2025-03-15')
        
        // During Ramadan, business hours are typically shorter
        // This test ensures the cultural compliance system is aware of these adjustments
        expect(isRamadan(ramadanDate)).toBe(true)
      })
    })
  })

  describe('UAE Business Hours and Holiday Integration', () => {
    describe('Business Hours Compliance', () => {
      it('should validate UAE business hours (Sunday-Thursday, 9 AM - 6 PM)', () => {
        // Test business hours validation through cultural compliance
        const businessContent = `Dear Customer,
        
        Please contact us during our business hours: Sunday-Thursday, 9:00 AM - 6:00 PM.
        
        Best regards, Company TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(businessContent)

        expect(result.breakdown.businessFormality).toBeGreaterThan(85)
        expect(result.recommendations.some(r => 
          r.includes('business hours')
        )).toBe(false) // Should not recommend since it's already included
      })

      it('should recommend business hours when missing', () => {
        const contentWithoutHours = `Dear Customer,
        
        Please contact us for assistance.
        
        Best regards, Company TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(contentWithoutHours)

        expect(result.recommendations.some(r => 
          r.includes('business hours information')
        )).toBe(true)
      })
    })

    describe('Holiday Awareness Integration', () => {
      it('should be aware of major UAE holidays in cultural context', () => {
        const holidayAwareContent = `Dear Customer,
        
        Please note our office will be closed for UAE National Day celebrations.
        
        Best regards, Company TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(holidayAwareContent)

        expect(result.score).toBeGreaterThan(70)
        expect(result.breakdown.culturalSensitivity).toBeGreaterThan(80)
      })
    })
  })

  describe('Customer Relationship-Based Tone Adjustment', () => {
    describe('Government Customer Handling', () => {
      it('should apply strictest cultural standards for government customers', () => {
        const casualContent = `Hi, hope you can pay the invoice soon. Thanks!`

        const governmentResult = CulturalComplianceService.calculateCulturalScore(casualContent, {
          customerRelationship: 'GOVERNMENT'
        })

        expect(governmentResult.score).toBeLessThan(50)
        expect(governmentResult.recommendations.some(r => 
          r.includes('formal language for government')
        )).toBe(true)
      })

      it('should recommend highest formality for government communications', () => {
        const formalContent = `Your Excellency,
        
        We respectfully request your attention to Invoice #GOV-001.
        
        With highest regards and respect,
        Company Name
        TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(formalContent, {
          customerRelationship: 'GOVERNMENT'
        })

        expect(result.score).toBeGreaterThan(80)
        expect(result.breakdown.toneRespectfulness).toBeGreaterThan(85)
      })
    })

    describe('VIP Customer Treatment', () => {
      it('should maintain respectful but warm tone for VIP customers', () => {
        const vipContent = `Dear Valued VIP Customer Mr. Ahmed,
        
        We hope this message finds you well. We would be honored if you could review Invoice #VIP-001 at your convenience.
        
        Please don't hesitate to contact our dedicated VIP service line.
        
        With our deepest respect,
        Company Name TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(vipContent, {
          customerRelationship: 'VIP'
        })

        expect(result.score).toBeGreaterThan(85)
        expect(result.breakdown.greetingsAndClosings).toBeGreaterThan(90)
      })
    })

    describe('Corporate Customer Balance', () => {
      it('should balance professionalism with warmth for corporate customers', () => {
        const corporateContent = `Dear Business Partner,
        
        We value our ongoing business relationship and would appreciate your review of Invoice #CORP-001.
        
        Best business regards,
        Company Name TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(corporateContent, {
          customerRelationship: 'CORPORATE'
        })

        expect(result.score).toBeGreaterThan(75)
        expect(result.breakdown.businessFormality).toBeGreaterThan(80)
      })
    })

    describe('Regular Customer Approach', () => {
      it('should use friendly but professional tone for regular customers', () => {
        const regularContent = `Dear Mr. Ahmed,
        
        We hope you're doing well. Please review Invoice #REG-001 when convenient.
        
        Thank you for your continued business.
        
        Best regards,
        Company Name TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(regularContent, {
          customerRelationship: 'REGULAR'
        })

        expect(result.score).toBeGreaterThan(70)
        expect(result.breakdown.toneRespectfulness).toBeGreaterThan(75)
      })
    })
  })

  describe('Emirates-Specific Customization', () => {
    describe('All Seven Emirates Recognition', () => {
      it('should recognize content mentioning specific emirates', () => {
        const emirates = [
          'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman',
          'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'
        ]

        emirates.forEach(emirate => {
          const emirateContent = `Dear Customer,
          
          Greetings from our ${emirate} office. Please review your invoice.
          
          Our ${emirate} business hours are Sunday-Thursday, 9 AM - 6 PM.
          
          Best regards, Company TRN: 123456789012345`

          const result = CulturalComplianceService.calculateCulturalScore(emirateContent)
          
          expect(result.score).toBeGreaterThan(75)
          expect(result.breakdown.businessFormality).toBeGreaterThan(80)
        })
      })

      it('should handle Arabic names of emirates', () => {
        const arabicEmirates = [
          'أبوظبي', 'دبي', 'الشارقة', 'عجمان',
          'أم القيوين', 'رأس الخيمة', 'الفجيرة'
        ]

        arabicEmirates.forEach(emirate => {
          const arabicEmirateContent = `عزيزي العميل،
          
          تحياتنا من مكتب ${emirate}. يرجى مراجعة فاتورتكم.
          
          ساعات العمل في ${emirate} من الأحد إلى الخميس، 9 ص - 6 م.
          
          أطيب التحيات، الشركة الرقم الضريبي: 123456789012345`

          const result = CulturalComplianceService.calculateCulturalScore(arabicEmirateContent, {
            language: 'ar'
          })
          
          expect(result.score).toBeGreaterThan(70)
        })
      })
    })

    describe('Regional Business Customs', () => {
      it('should recognize mentions of regional business practices', () => {
        const regionalContent = `Dear Customer,
        
        In accordance with UAE business customs, we extend our patience regarding Invoice #UAE-001.
        
        Following UAE Commercial Law, we kindly request your attention to this matter.
        
        Best regards, Company TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(regionalContent)

        expect(result.score).toBeGreaterThan(80)
        expect(result.breakdown.culturalSensitivity).toBeGreaterThan(85)
      })
    })
  })

  describe('Performance and Edge Case Testing', () => {
    describe('Large Content Analysis', () => {
      it('should handle large text content efficiently', () => {
        const largeContent = `
        ${'Dear Valued Customer, '.repeat(100)}
        
        ${'We appreciate your business and hope this email finds you well during UAE business hours. '.repeat(200)}
        
        ${'Please review your invoice at your convenience. '.repeat(50)}
        
        ${'JazakAllahu khair for your attention to this matter. '.repeat(25)}
        
        Best regards,
        Company Name
        TRN: 123456789012345
        `

        const startTime = performance.now()
        
        const result = CulturalComplianceService.calculateCulturalScore(largeContent)
        
        const endTime = performance.now()
        const processingTime = endTime - startTime

        expect(processingTime).toBeLessThan(1000) // Should complete within 1 second
        expect(result.score).toBeDefined()
        expect(result.score).toBeGreaterThan(0)
        expect(result.breakdown).toBeDefined()
      })

      it('should handle very long Arabic content', () => {
        const longArabicContent = `
        ${'عزيزي العميل المحترم، '.repeat(100)}
        
        ${'نأمل أن يصلكم هذا البريد وأنتم بأتم الصحة والعافية خلال ساعات العمل في الإمارات. '.repeat(100)}
        
        ${'يرجى مراجعة فاتورتكم في الوقت المناسب لكم. '.repeat(50)}
        
        أطيب التحيات،
        اسم الشركة
        الرقم الضريبي: 123456789012345
        `

        const result = CulturalComplianceService.detectArabicLanguage(longArabicContent)
        
        expect(result.hasArabic).toBe(true)
        expect(result.arabicPercentage).toBeGreaterThan(90)
        expect(result.arabicWords.length).toBeGreaterThan(50)
      })
    })

    describe('Mixed Language Edge Cases', () => {
      it('should handle complex mixed language scenarios', () => {
        const complexMixedContent = `Dear عزيزي Customer العميل Mr. Ahmed السيد أحمد,
        
        As-salamu alaykum السلام عليكم and greetings from our Dubai دبي office.
        
        Please pay فاتورة Invoice #INV-001 by due date تاريخ الاستحقاق.
        
        TRN الرقم الضريبي: 123456789012345
        Business hours ساعات العمل: Sunday-Thursday الأحد-الخميس 9AM-6PM
        
        JazakAllahu khair جزاكم الله خيراً,
        Company الشركة`

        const languageResult = CulturalComplianceService.detectArabicLanguage(complexMixedContent)
        const scoreResult = CulturalComplianceService.calculateCulturalScore(complexMixedContent, {
          language: 'mixed'
        })

        expect(languageResult.mixedLanguage).toBe(true)
        expect(languageResult.hasArabic).toBe(true)
        expect(scoreResult.score).toBeGreaterThan(70)
        expect(scoreResult.breakdown.islamicEtiquette).toBeGreaterThan(90) // Islamic phrases present
      })

      it('should handle empty and null content gracefully', () => {
        const edgeCases = ['', '   ', null, undefined]

        edgeCases.forEach(content => {
          expect(() => {
            CulturalComplianceService.calculateCulturalScore(content || '')
          }).not.toThrow()

          expect(() => {
            CulturalComplianceService.detectArabicLanguage(content || '')
          }).not.toThrow()

          expect(() => {
            CulturalComplianceService.isAppropriateGreeting(content || '')
          }).not.toThrow()
        })
      })
    })

    describe('Special Characters and Formatting', () => {
      it('should handle content with emojis and special characters', () => {
        const contentWithEmojis = `Dear Customer 👋,
        
        As-salamu alaykum 🕌 and greetings from UAE! 🇦🇪
        
        Please review Invoice #001 💰 during business hours ⏰
        
        Best regards 🙏
        Company TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(contentWithEmojis)
        
        expect(result.score).toBeGreaterThan(70)
        expect(result.breakdown.islamicEtiquette).toBeGreaterThan(90)
      })

      it('should handle HTML-like content', () => {
        const htmlContent = `<p>Dear Customer,</p>
        
        <div>As-salamu alaykum and greetings from our company.</div>
        
        <strong>Please review your invoice.</strong>
        
        <footer>Best regards,<br>Company TRN: 123456789012345</footer>`

        const result = CulturalComplianceService.calculateCulturalScore(htmlContent)
        
        expect(result.score).toBeGreaterThan(60)
        expect(result.breakdown.islamicEtiquette).toBeGreaterThan(90)
      })
    })

    describe('Performance Benchmarks', () => {
      it('should process multiple cultural analyses efficiently', () => {
        const testContents = Array.from({ length: 100 }, (_, i) => 
          `Dear Customer ${i}, As-salamu alaykum. Please pay invoice #${i}. JazakAllahu khair, Company TRN: 123456789012345`
        )

        const startTime = performance.now()
        
        const results = testContents.map(content => 
          CulturalComplianceService.calculateCulturalScore(content)
        )
        
        const endTime = performance.now()
        const totalTime = endTime - startTime

        expect(totalTime).toBeLessThan(5000) // Should complete 100 analyses within 5 seconds
        expect(results).toHaveLength(100)
        expect(results.every(r => r.score > 0)).toBe(true)
      })

      it('should handle concurrent cultural analysis requests', async () => {
        const testPromises = Array.from({ length: 50 }, (_, i) => 
          Promise.resolve(CulturalComplianceService.calculateCulturalScore(
            `Test content ${i} with As-salamu alaykum and TRN: 123456789012345`
          ))
        )

        const startTime = performance.now()
        const results = await Promise.all(testPromises)
        const endTime = performance.now()

        expect(endTime - startTime).toBeLessThan(3000) // Should complete within 3 seconds
        expect(results).toHaveLength(50)
        expect(results.every(r => r.score >= 0 && r.score <= 100)).toBe(true)
      })
    })
  })

  describe('Integration and Real-World Scenarios', () => {
    describe('Complete Email Template Analysis', () => {
      it('should analyze a complete UAE business email template', () => {
        const completeEmail = `Subject: Gentle Reminder - Invoice #UAE-2025-001

As-salamu alaykum and Dear Valued Customer Mr. Ahmed Al-Rashid,

We hope this email finds you and your family in good health and prosperity.

We are writing to you with a gentle reminder regarding Invoice #UAE-2025-001 dated January 15, 2025, for AED 5,000.00.

We understand that business priorities can be demanding, and we greatly appreciate your attention to this matter at your earliest convenience.

Our UAE business hours are Sunday through Thursday, 9:00 AM to 6:00 PM (UAE Time). Please feel free to contact us during these hours if you have any questions or require clarification.

During the holy month of Ramadan, please note our adjusted hours will be 9:00 AM to 3:00 PM to respect the blessed occasion.

We value our business relationship and look forward to your continued partnership.

JazakAllahu khair for your time and attention.

Warm regards,
Emirates Business Solutions LLC
Dubai, United Arab Emirates
TRN: 100123456789012
Phone: +971-4-123-4567
Email: info@emiratesbusiness.ae`

        const result = CulturalComplianceService.calculateCulturalScore(completeEmail, {
          language: 'en',
          customerRelationship: 'REGULAR',
          sequenceType: 'FIRST_REMINDER',
          isRamadan: false
        })

        expect(result.score).toBeGreaterThan(90)
        expect(result.breakdown.islamicEtiquette).toBeGreaterThan(100) // Bonus points
        expect(result.breakdown.greetingsAndClosings).toBeGreaterThan(95)
        expect(result.breakdown.businessFormality).toBeGreaterThan(90)
        expect(result.breakdown.culturalSensitivity).toBeGreaterThan(90)
        expect(result.recommendations.length).toBeLessThan(2) // Should have minimal recommendations
      })
    })

    describe('Escalation Sequence Analysis', () => {
      it('should analyze a complete 4-step escalation sequence', () => {
        const escalationSequence = [
          {
            tone: 'FRIENDLY',
            content: `As-salamu alaykum Dear Mr. Ahmed, we hope you're well. Gentle reminder about Invoice #001. JazakAllahu khair.`,
            delayDays: 7
          },
          {
            tone: 'BUSINESS',
            content: `Dear Valued Customer, following up on Invoice #001. Please review at your convenience during business hours. Best regards.`,
            delayDays: 7
          },
          {
            tone: 'FORMAL',
            content: `Dear Mr. Ahmed, we respectfully request your attention to overdue Invoice #001. Please contact us during UAE business hours. Regards.`,
            delayDays: 7
          },
          {
            tone: 'FIRM',
            content: `Dear Customer, final notice for Invoice #001. We value our relationship and seek resolution. Contact us during business hours. Regards.`,
            delayDays: 7
          }
        ]

        const result = CulturalComplianceService.validateToneEscalation(
          escalationSequence, 'REGULAR'
        )

        expect(result.appropriate).toBe(true)
        expect(result.issues).toHaveLength(0)
        expect(result.suggestions).toHaveLength(0)
        expect(result.recommendedProgression).toEqual(['FRIENDLY', 'BUSINESS', 'FORMAL', 'FIRM'])
      })
    })

    describe('Cross-Cultural Communication Scenarios', () => {
      it('should handle Western expat customer communications appropriately', () => {
        const expatContent = `Dear Mr. Johnson,

Greetings from Dubai! We hope you're settling in well to life in the UAE.

We wanted to reach out regarding Invoice #EXP-001. We understand adjusting to a new country can be busy.

Our office hours follow the UAE schedule: Sunday-Thursday, 9 AM - 6 PM.

Please don't hesitate to reach out if you need any assistance.

Best regards,
UAE Company LLC
TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(expatContent, {
          customerRelationship: 'NEW'
        })

        expect(result.score).toBeGreaterThan(80)
        expect(result.breakdown.culturalSensitivity).toBeGreaterThan(85)
        expect(result.breakdown.businessFormality).toBeGreaterThan(80)
      })

      it('should handle GCC regional customer communications', () => {
        const gccContent = `Dear Esteemed Customer,

As-salamu alaykum and greetings from the UAE.

We understand the importance of maintaining strong business relationships across the GCC region.

Please review Invoice #GCC-001 when convenient. We appreciate your continued partnership.

Our team is available during UAE business hours for any assistance.

With respect and best regards,
UAE Regional Office
TRN: 123456789012345`

        const result = CulturalComplianceService.calculateCulturalScore(gccContent, {
          customerRelationship: 'CORPORATE'
        })

        expect(result.score).toBeGreaterThan(85)
        expect(result.breakdown.islamicEtiquette).toBeGreaterThan(90)
        expect(result.breakdown.toneRespectfulness).toBeGreaterThan(85)
      })
    })
  })
})