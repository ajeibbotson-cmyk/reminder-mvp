/**
 * Enhanced Cultural Compliance Test Suite
 * Comprehensive testing for UAE cultural appropriateness, Arabic language support, and Islamic etiquette
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  CulturalComplianceService,
  culturalCompliance,
  CulturalTone,
  SequenceType,
  CustomerRelationship,
  SequenceToneAnalysis,
  TemplateContentAnalysis,
  CulturalTimingPreferences
} from '../cultural-compliance-service'

describe('Enhanced Cultural Compliance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Sequence Tone Validation', () => {
    it('should validate appropriate business tone for regular customers', () => {
      const sequence = {
        steps: [
          {
            subject: 'Dear Valued Customer - Invoice Reminder',
            content: 'We hope this email finds you well. This is a gentle reminder about your invoice.',
            delayDays: 7,
            tone: 'BUSINESS'
          },
          {
            subject: 'Follow-up: Invoice Payment Request',
            content: 'Thank you for your attention. We would appreciate your cooperation in settling the invoice.',
            delayDays: 7,
            tone: 'FORMAL'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(sequence, 'REGULAR')

      expect(analysis.isAppropriate).toBe(true)
      expect(analysis.culturalScore).toBeGreaterThan(70)
      expect(analysis.recommendedTone).toBe('BUSINESS')
      expect(analysis.issues).toHaveLength(0)
    })

    it('should flag inappropriate aggressive language', () => {
      const aggressiveSequence = {
        steps: [
          {
            subject: 'URGENT: Pay immediately or face legal action',
            content: 'You must pay right now. Failure to pay will result in immediate legal proceedings.',
            delayDays: 1,
            tone: 'URGENT'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(aggressiveSequence, 'REGULAR')

      expect(analysis.isAppropriate).toBe(false)
      expect(analysis.culturalScore).toBeLessThan(70)
      expect(analysis.issues.length).toBeGreaterThan(0)
      expect(analysis.suggestions.length).toBeGreaterThan(0)
    })

    it('should recommend very formal tone for government customers', () => {
      const sequence = {
        steps: [
          {
            subject: 'Invoice Notification',
            content: 'Please pay.',
            delayDays: 7,
            tone: 'CASUAL'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(sequence, 'GOVERNMENT')

      expect(analysis.recommendedTone).toBe('VERY_FORMAL')
      expect(analysis.issues.some(issue => issue.includes('formal enough'))).toBe(true)
    })

    it('should validate timing appropriateness for UAE culture', () => {
      const tooQuickSequence = {
        steps: [
          {
            subject: 'First Reminder',
            content: 'Payment reminder',
            delayDays: 2, // Too soon for UAE culture
            tone: 'BUSINESS'
          },
          {
            subject: 'Second Reminder',
            content: 'Follow-up',
            delayDays: 2, // Too frequent
            tone: 'FORMAL'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(tooQuickSequence, 'REGULAR')

      expect(analysis.issues.some(issue => issue.includes('too soon'))).toBe(true)
      expect(analysis.issues.some(issue => issue.includes('too frequent'))).toBe(true)
      expect(analysis.suggestions.some(suggestion => suggestion.includes('7-14 days'))).toBe(true)
    })

    it('should validate greeting and closing formality', () => {
      const improperSequence = {
        steps: [
          {
            subject: 'Payment Due',
            content: 'Hi there! You owe us money. Pay up. Thanks.',
            delayDays: 7,
            tone: 'CASUAL'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(improperSequence, 'REGULAR')

      expect(analysis.suggestions.some(s => s.includes('greeting'))).toBe(true)
      expect(analysis.suggestions.some(s => s.includes('closing'))).toBe(true)
    })
  })

  describe('Template Content Analysis', () => {
    it('should validate culturally appropriate English templates', () => {
      const appropriateTemplate = {
        contentEn: 'Dear Valued Customer,\\n\\nWe hope this email finds you in good health. This is a gentle reminder regarding Invoice {{invoiceNumber}} for {{customerName}}.\\n\\nWe would appreciate your kind attention to this matter at your earliest convenience.\\n\\nThank you for your continued partnership.\\n\\nBest regards,\\nAccounts Team',
        subjectEn: 'Friendly Reminder: Invoice {{invoiceNumber}} - {{customerName}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(appropriateTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.culturalCompliance).toBeGreaterThan(70)
      expect(analysis.languageAppropriate).toBe(true)
      expect(analysis.respectfulTone).toBe(true)
      expect(analysis.businessAppropriate).toBe(true)
    })

    it('should flag inappropriate demanding language', () => {
      const demandingTemplate = {
        contentEn: 'You must pay immediately! This is urgent and requires immediate action. Failure to pay will result in penalties.',
        subjectEn: 'URGENT: Pay now or face consequences'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(demandingTemplate)

      expect(analysis.isValid).toBe(false)
      expect(analysis.languageAppropriate).toBe(false)
      expect(analysis.issues.length).toBeGreaterThan(0)
      expect(analysis.improvements.length).toBeGreaterThan(0)
    })

    it('should validate bilingual templates (Arabic + English)', () => {
      const bilingualTemplate = {
        contentEn: 'Dear Valued Customer, this is a reminder about your invoice. Thank you for your cooperation.',
        contentAr: 'عزيزي العميل الكريم، هذا تذكير بشأن فاتورتكم. شكراً لتعاونكم.',
        subjectEn: 'Invoice Reminder - Thank you',
        subjectAr: 'تذكير بالفاتورة - شكراً لكم'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(bilingualTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.issues.filter(i => i.includes('[Arabic]')).length).toBeGreaterThanOrEqual(0)
    })

    it('should detect missing personalization variables', () => {
      const impersonalTemplate = {
        contentEn: 'Dear Customer, please pay your invoice. Thank you.',
        subjectEn: 'Payment Required'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(impersonalTemplate)

      expect(analysis.improvements.some(i => i.includes('personalization'))).toBe(true)
    })

    it('should require proper greetings and closings', () => {
      const curtTemplate = {
        contentEn: 'Pay invoice now.',
        subjectEn: 'Pay'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(curtTemplate)

      expect(analysis.issues.some(i => i.includes('greeting'))).toBe(true)
      expect(analysis.issues.some(i => i.includes('closing'))).toBe(true)
      expect(analysis.improvements.length).toBeGreaterThan(1)
    })
  })

  describe('Cultural Timing Optimization', () => {
    it('should suggest optimal timing for first reminders', () => {
      const config = CulturalComplianceService.suggestOptimalTiming('FIRST_REMINDER', 'REGULAR')

      expect(config.preferredDays).toEqual([1, 2, 3]) // Monday-Wednesday
      expect(config.preferredHours).toEqual([10, 11, 14]) // Morning or early afternoon
      expect(config.culturalTone).toBe('FRIENDLY')
      expect(config.avoidPrayerTimes).toBe(true)
      expect(config.respectRamadan).toBe(true)
    })

    it('should suggest formal timing for final notices', () => {
      const config = CulturalComplianceService.suggestOptimalTiming('FINAL_NOTICE', 'REGULAR')

      expect(config.preferredDays).toEqual([1, 2]) // Monday-Tuesday
      expect(config.preferredHours).toEqual([9, 10]) // Early morning
      expect(config.culturalTone).toBe('FORMAL')
    })

    it('should adjust timing for government customers', () => {
      const config = CulturalComplianceService.suggestOptimalTiming('OVERDUE', 'GOVERNMENT')

      expect(config.culturalTone).toBe('VERY_FORMAL')
      expect(config.avoidPrayerTimes).toBe(true)
    })

    it('should provide Ramadan-specific adjustments', () => {
      const ramadanDate = new Date('2024-03-15')
      const config = CulturalComplianceService.getRamadanAdjustments(ramadanDate)

      expect(config.preferredDays).toEqual([0, 1, 2, 3]) // Sunday-Wednesday
      expect(config.preferredHours).toEqual([9, 10, 14, 15]) // Avoid iftar time
      expect(config.culturalTone).toBe('FORMAL')
      expect(config.respectRamadan).toBe(true)
    })
  })

  describe('Cultural Timing Preferences', () => {
    it('should identify cultural considerations for 90-day period', () => {
      const startDate = new Date('2024-03-01')
      const endDate = new Date('2024-05-30')

      const preferences = CulturalComplianceService.getCulturalTimingPreferences(startDate, endDate)

      expect(preferences.preferredDays).toEqual([2, 3, 4]) // Tuesday-Thursday
      expect(preferences.preferredHours).toEqual([10, 11, 14, 15])
      expect(preferences.avoidancePeriods.length).toBeGreaterThan(0)
      expect(preferences.culturalConsiderations.length).toBeGreaterThan(0)
    })

    it('should detect Ramadan period in timing preferences', () => {
      const ramadanPeriod = new Date('2024-03-15')
      const preferences = CulturalComplianceService.getCulturalTimingPreferences(ramadanPeriod)

      const ramadanAvoidance = preferences.avoidancePeriods.find(p => p.name === 'Ramadan')
      expect(ramadanAvoidance).toBeDefined()
      expect(ramadanAvoidance?.reason).toContain('Holy month')

      const ramadanConsideration = preferences.culturalConsiderations.find(c =>
        c.includes('Ramadan')
      )
      expect(ramadanConsideration).toBeDefined()
    })

    it('should include major Islamic holidays', () => {
      const yearStart = new Date('2024-01-01')
      const yearEnd = new Date('2024-12-31')

      const preferences = CulturalComplianceService.getCulturalTimingPreferences(yearStart, yearEnd)

      const expectedHolidays = ['Eid Al Fitr', 'Eid Al Adha', 'Islamic New Year']
      expectedHolidays.forEach(holidayName => {
        const holiday = preferences.avoidancePeriods.find(p => p.name === holidayName)
        expect(holiday).toBeDefined()
      })
    })
  })

  describe('Cultural Score Calculation', () => {
    it('should calculate high score for culturally appropriate content', () => {
      const excellentContent = 'As-salamu alaykum, dear valued customer. We hope this message finds you in good health and prosperity. We would kindly request your attention to Invoice #123. We appreciate your continued partnership. JazakAllahu khair for your cooperation.'

      const context = {
        language: 'en' as const,
        customerRelationship: 'REGULAR' as CustomerRelationship,
        isRamadan: false,
        sequenceType: 'FIRST_REMINDER' as SequenceType
      }

      const result = CulturalComplianceService.calculateCulturalScore(excellentContent, context)

      expect(result.score).toBeGreaterThan(85)
      expect(result.breakdown.islamicEtiquette).toBeGreaterThan(100) // Bonus for Islamic phrases
      expect(result.breakdown.greetingsAndClosings).toBeGreaterThan(80)
      expect(result.breakdown.toneRespectfulness).toBeGreaterThan(80)
    })

    it('should calculate low score for inappropriate content', () => {
      const poorContent = 'Hey! You need to pay immediately. This is urgent and we demand payment right now or else we will take legal action.'

      const context = {
        language: 'en' as const,
        customerRelationship: 'REGULAR' as CustomerRelationship,
        isRamadan: false,
        sequenceType: 'FIRST_REMINDER' as SequenceType
      }

      const result = CulturalComplianceService.calculateCulturalScore(poorContent, context)

      expect(result.score).toBeLessThan(50)
      expect(result.breakdown.languageAppropriate).toBeLessThan(80)
      expect(result.breakdown.toneRespectfulness).toBeLessThan(60)
      expect(result.recommendations.length).toBeGreaterThan(3)
    })

    it('should provide specific recommendations for improvements', () => {
      const needsWorkContent = 'Dear customer, please pay your bill. Thanks.'

      const result = CulturalComplianceService.calculateCulturalScore(needsWorkContent)

      expect(result.recommendations.length).toBeGreaterThan(2)
      expect(result.recommendations.some(r => r.includes('Islamic greetings'))).toBe(true)
      expect(result.recommendations.some(r => r.includes('TRN'))).toBe(true)
    })
  })

  describe('Greeting Appropriateness Validation', () => {
    it('should rate Islamic greetings as excellent', () => {
      const islamicGreeting = 'As-salamu alaykum, dear valued customer'
      const result = CulturalComplianceService.isAppropriateGreeting(islamicGreeting, 'en')

      expect(result.appropriate).toBe(true)
      expect(result.culturalLevel).toBe('excellent')
    })

    it('should rate formal greetings as good', () => {
      const formalGreeting = 'Dear esteemed customer'
      const result = CulturalComplianceService.isAppropriateGreeting(formalGreeting, 'en')

      expect(result.appropriate).toBe(true)
      expect(result.culturalLevel).toBe('good')
    })

    it('should rate standard greetings as acceptable', () => {
      const standardGreeting = 'Dear Sir/Madam'
      const result = CulturalComplianceService.isAppropriateGreeting(standardGreeting, 'en')

      expect(result.appropriate).toBe(true)
      expect(result.culturalLevel).toBe('acceptable')
    })

    it('should rate informal greetings as poor', () => {
      const informalGreeting = 'Hey there!'
      const result = CulturalComplianceService.isAppropriateGreeting(informalGreeting, 'en')

      expect(result.appropriate).toBe(false)
      expect(result.culturalLevel).toBe('poor')
      expect(result.suggestion).toBeDefined()
    })

    it('should handle Arabic greetings appropriately', () => {
      const arabicGreeting = 'السلام عليكم عزيزي العميل المحترم'
      const result = CulturalComplianceService.isAppropriateGreeting(arabicGreeting, 'ar')

      expect(result.appropriate).toBe(true)
      expect(result.culturalLevel).toBe('excellent')
    })
  })

  describe('Arabic Language Detection and Support', () => {
    it('should detect Arabic text correctly', () => {
      const arabicText = 'مرحباً بكم في خدماتنا المصرفية'
      const result = CulturalComplianceService.detectArabicLanguage(arabicText)

      expect(result.hasArabic).toBe(true)
      expect(result.arabicPercentage).toBeGreaterThan(80)
      expect(result.isRTL).toBe(true)
      expect(result.requiresRTLLayout).toBe(true)
      expect(result.arabicWords.length).toBeGreaterThan(0)
      expect(result.mixedLanguage).toBe(false)
    })

    it('should detect mixed language content', () => {
      const mixedText = 'Dear Customer عزيزي العميل, please pay فضلاً ادفع Invoice #123'
      const result = CulturalComplianceService.detectArabicLanguage(mixedText)

      expect(result.hasArabic).toBe(true)
      expect(result.mixedLanguage).toBe(true)
      expect(result.arabicWords.length).toBeGreaterThan(0)
    })

    it('should handle pure English text', () => {
      const englishText = 'Dear valued customer, please review your invoice.'
      const result = CulturalComplianceService.detectArabicLanguage(englishText)

      expect(result.hasArabic).toBe(false)
      expect(result.arabicPercentage).toBe(0)
      expect(result.isRTL).toBe(false)
      expect(result.requiresRTLLayout).toBe(false)
      expect(result.mixedLanguage).toBe(false)
    })

    it('should extract Arabic words correctly', () => {
      const arabicText = 'فاتورة رقم ١٢٣ مستحقة الدفع'
      const result = CulturalComplianceService.detectArabicLanguage(arabicText)

      expect(result.arabicWords).toContain('فاتورة')
      expect(result.arabicWords).toContain('مستحقة')
      expect(result.arabicWords).toContain('الدفع')
    })
  })

  describe('Tone Escalation Validation', () => {
    it('should validate appropriate tone progression for regular customers', () => {
      const appropriateSteps = [
        { tone: 'FRIENDLY', content: 'Gentle reminder...', delayDays: 7 },
        { tone: 'BUSINESS', content: 'Follow-up notice...', delayDays: 7 },
        { tone: 'FORMAL', content: 'Important notice...', delayDays: 7 }
      ]

      const validation = CulturalComplianceService.validateToneEscalation(appropriateSteps, 'REGULAR')

      expect(validation.appropriate).toBe(true)
      expect(validation.issues).toHaveLength(0)
      expect(validation.recommendedProgression).toEqual(['FRIENDLY', 'BUSINESS', 'FORMAL', 'FIRM'])
    })

    it('should flag inappropriate tone escalation', () => {
      const aggressiveSteps = [
        { tone: 'URGENT', content: 'Pay now!', delayDays: 2 },
        { tone: 'THREATENING', content: 'Legal action!', delayDays: 2 }
      ]

      const validation = CulturalComplianceService.validateToneEscalation(aggressiveSteps, 'REGULAR')

      expect(validation.appropriate).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.suggestions.length).toBeGreaterThan(0)
    })

    it('should provide different progression for government customers', () => {
      const steps = [
        { tone: 'FORMAL', content: 'Notice...', delayDays: 7 }
      ]

      const validation = CulturalComplianceService.validateToneEscalation(steps, 'GOVERNMENT')

      expect(validation.recommendedProgression).toEqual(['VERY_FORMAL', 'VERY_FORMAL', 'FORMAL', 'FORMAL'])
    })

    it('should flag timing issues in escalation', () => {
      const tooQuickSteps = [
        { tone: 'FRIENDLY', content: 'First...', delayDays: 3 }, // Too soon
        { tone: 'BUSINESS', content: 'Second...', delayDays: 2 }  // Too frequent
      ]

      const validation = CulturalComplianceService.validateToneEscalation(tooQuickSteps, 'REGULAR')

      expect(validation.issues.some(i => i.includes('too soon'))).toBe(true)
      expect(validation.issues.some(i => i.includes('too quickly'))).toBe(true)
      expect(validation.suggestions.some(s => s.includes('7 days'))).toBe(true)
    })
  })

  describe('Subject Line Generation', () => {
    it('should generate appropriate first reminder subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'FIRST_REMINDER',
        'Ahmad Al-Rashid',
        'INV-2024-001'
      )

      expect(suggestions.length).toBeGreaterThan(3)
      expect(suggestions.every(s => s.includes('INV-2024-001'))).toBe(true)
      expect(suggestions.some(s => s.toLowerCase().includes('gentle'))).toBe(true)
      expect(suggestions.some(s => s.toLowerCase().includes('reminder'))).toBe(true)
    })

    it('should generate escalated final notice subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'FINAL_NOTICE',
        'Ahmad Al-Rashid',
        'INV-2024-001'
      )

      expect(suggestions.some(s => s.toLowerCase().includes('final'))).toBe(true)
      expect(suggestions.some(s => s.toLowerCase().includes('important'))).toBe(true)
      expect(suggestions.some(s => s.toLowerCase().includes('attention'))).toBe(true)
    })

    it('should generate professional payment request subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'PAYMENT_REQUEST',
        'Ahmad Al-Rashid',
        'INV-2024-001'
      )

      expect(suggestions.some(s => s.toLowerCase().includes('payment'))).toBe(true)
      expect(suggestions.some(s => s.toLowerCase().includes('settlement'))).toBe(true)
      expect(suggestions.some(s => s.toLowerCase().includes('arrangement'))).toBe(true)
    })

    it('should handle missing customer information gracefully', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions('FIRST_REMINDER')

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.every(s => typeof s === 'string')).toBe(true)
    })
  })

  describe('Cultural Context Edge Cases', () => {
    it('should handle empty template content', () => {
      const emptyTemplate = {
        contentEn: '',
        subjectEn: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(emptyTemplate)

      expect(analysis.isValid).toBe(false)
      expect(analysis.issues.length).toBeGreaterThan(0)
    })

    it('should handle special characters and emojis', () => {
      const emojiTemplate = {
        contentEn: 'Dear customer 😊, please pay your invoice 💰. Thank you! 🙏',
        subjectEn: 'Invoice reminder 📧'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(emojiTemplate)

      // Should still work but might have recommendations
      expect(analysis.isValid).toBeDefined()
    })

    it('should handle very long content appropriately', () => {
      const longContent = 'Dear valued customer, '.repeat(100) + 'Please pay your invoice.'
      const longTemplate = {
        contentEn: longContent,
        subjectEn: 'Invoice reminder'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(longTemplate)
      expect(analysis).toBeDefined()
    })

    it('should handle different customer relationship types', () => {
      const relationships: CustomerRelationship[] = ['NEW', 'REGULAR', 'VIP', 'GOVERNMENT', 'CORPORATE']

      relationships.forEach(relationship => {
        const config = CulturalComplianceService.suggestOptimalTiming('FIRST_REMINDER', relationship)
        expect(config).toBeDefined()
        expect(config.culturalTone).toBeDefined()
      })
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent validations efficiently', async () => {
      const template = {
        contentEn: 'Dear customer, please pay your invoice.',
        subjectEn: 'Payment reminder'
      }

      const startTime = Date.now()

      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(CulturalComplianceService.validateTemplateContent(template))
      )

      await Promise.all(promises)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should efficiently analyze large template collections', () => {
      const startTime = Date.now()

      for (let i = 0; i < 1000; i++) {
        const template = {
          contentEn: `Template ${i}: Dear customer, please review invoice ${i}.`,
          subjectEn: `Invoice ${i} reminder`
        }
        CulturalComplianceService.validateTemplateContent(template)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(2000) // Should handle 1000 templates within 2 seconds
    })
  })

  describe('Integration with External Services', () => {
    it('should work consistently with singleton instance', () => {
      const instance1 = culturalCompliance
      const instance2 = culturalCompliance

      expect(instance1).toBe(instance2) // Should be same instance

      // Both should provide same validation results
      const template = {
        contentEn: 'Dear customer, please pay.',
        subjectEn: 'Payment due'
      }

      const result1 = CulturalComplianceService.validateTemplateContent(template)
      const result2 = CulturalComplianceService.validateTemplateContent(template)

      expect(result1.isValid).toBe(result2.isValid)
      expect(result1.culturalCompliance).toBe(result2.culturalCompliance)
    })
  })
})