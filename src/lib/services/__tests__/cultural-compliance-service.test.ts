/**
 * Comprehensive Test Suite for Cultural Compliance Service
 * Tests UAE cultural appropriateness, tone validation, and Islamic business etiquette
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
import { ScheduleConfig } from '../uae-business-hours-service'

describe('CulturalComplianceService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Sequence Tone Validation', () => {
    let mockSequence: any

    beforeEach(() => {
      mockSequence = {
        id: 'sequence-123',
        name: 'Payment Reminder Sequence',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Gentle reminder about your invoice',
            content: 'Dear valued customer, we hope this email finds you well. We wanted to respectfully remind you about your outstanding invoice.',
            tone: 'BUSINESS'
          },
          {
            stepNumber: 2,
            delayDays: 7,
            subject: 'Follow-up on your invoice',
            content: 'Dear esteemed client, we would appreciate your attention to the pending invoice at your convenience.',
            tone: 'FORMAL'
          }
        ]
      }
    })

    it('should validate appropriate sequence tone for regular customers', () => {
      const analysis = CulturalComplianceService.validateSequenceTone(
        mockSequence,
        'REGULAR'
      )

      expect(analysis.isAppropriate).toBe(true)
      expect(analysis.culturalScore).toBeGreaterThan(70)
      expect(analysis.recommendedTone).toBe('BUSINESS')
    })

    it('should recommend more formal tone for government customers', () => {
      const analysis = CulturalComplianceService.validateSequenceTone(
        mockSequence,
        'GOVERNMENT'
      )

      expect(analysis.recommendedTone).toBe('VERY_FORMAL')
    })

    it('should recommend formal tone for VIP customers', () => {
      const analysis = CulturalComplianceService.validateSequenceTone(
        mockSequence,
        'VIP'
      )

      expect(analysis.recommendedTone).toBe('VERY_FORMAL')
    })

    it('should recommend formal tone for corporate customers', () => {
      const analysis = CulturalComplianceService.validateSequenceTone(
        mockSequence,
        'CORPORATE'
      )

      expect(analysis.recommendedTone).toBe('FORMAL')
    })

    it('should flag inappropriate aggressive language', () => {
      const aggressiveSequence = {
        ...mockSequence,
        steps: [
          {
            stepNumber: 1,
            delayDays: 1,
            subject: 'Pay immediately!',
            content: 'You must pay right now or face legal action. This is urgent and demands immediate attention.',
            tone: 'BUSINESS'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(
        aggressiveSequence,
        'REGULAR'
      )

      expect(analysis.isAppropriate).toBe(false)
      expect(analysis.culturalScore).toBeLessThan(70)
      expect(analysis.issues.length).toBeGreaterThan(0)
      expect(analysis.issues.some(issue => issue.includes('Inappropriate phrase'))).toBe(true)
    })

    it('should flag reminders that are too frequent', () => {
      const frequentSequence = {
        ...mockSequence,
        steps: [
          {
            stepNumber: 1,
            delayDays: 2, // Too soon for first reminder
            subject: 'Invoice reminder',
            content: 'Please pay your invoice.',
            tone: 'BUSINESS'
          },
          {
            stepNumber: 2,
            delayDays: 2, // Too frequent follow-up
            subject: 'Second reminder',
            content: 'Please pay your invoice.',
            tone: 'BUSINESS'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(
        frequentSequence,
        'REGULAR'
      )

      expect(analysis.issues.some(issue => 
        issue.includes('First reminder too soon') || 
        issue.includes('Follow-up too frequent')
      )).toBe(true)
      expect(analysis.suggestions.length).toBeGreaterThan(0)
    })

    it('should suggest proper greetings and closings', () => {
      const impersonalSequence = {
        ...mockSequence,
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Invoice reminder',
            content: 'Your invoice is overdue. Please pay immediately. Thank you.',
            tone: 'BUSINESS'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(
        impersonalSequence,
        'REGULAR'
      )

      expect(analysis.suggestions.some(suggestion => 
        suggestion.includes('Add respectful greeting') ||
        suggestion.includes('Add respectful closing')
      )).toBe(true)
    })

    it('should enforce higher standards for government customers', () => {
      const casualSequence = {
        ...mockSequence,
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Hey, about that invoice',
            content: 'Hi there! Just wanted to check on your invoice payment.',
            tone: 'FRIENDLY'
          }
        ]
      }

      const analysis = CulturalComplianceService.validateSequenceTone(
        casualSequence,
        'GOVERNMENT'
      )

      expect(analysis.issues.some(issue => 
        issue.includes('not formal enough for government')
      )).toBe(true)
      expect(analysis.suggestions.some(suggestion => 
        suggestion.includes('more formal language for government')
      )).toBe(true)
    })

    it('should handle sequences without steps gracefully', () => {
      const emptySequence = {
        ...mockSequence,
        steps: null
      }

      const analysis = CulturalComplianceService.validateSequenceTone(
        emptySequence,
        'REGULAR'
      )

      expect(analysis.culturalScore).toBe(100) // No issues found
      expect(analysis.isAppropriate).toBe(true)
    })
  })

  describe('Template Content Validation', () => {
    it('should validate appropriate template content', () => {
      const goodTemplate = {
        contentEn: 'Dear valued customer, we hope this message finds you well. We would appreciate your attention to Invoice #123 at your convenience. Thank you for your cooperation.',
        subjectEn: 'Gentle reminder regarding Invoice #123',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(goodTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.culturalCompliance).toBeGreaterThan(70)
      expect(analysis.languageAppropriate).toBe(true)
      expect(analysis.respectfulTone).toBe(true)
      expect(analysis.businessAppropriate).toBe(true)
    })

    it('should flag inappropriate demanding language', () => {
      const aggressiveTemplate = {
        contentEn: 'You must pay immediately! Failure to pay will result in legal action. This is urgent and demands your attention right now.',
        subjectEn: 'URGENT: Pay now or face consequences!',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(aggressiveTemplate)

      expect(analysis.isValid).toBe(false)
      expect(analysis.culturalCompliance).toBeLessThan(70)
      expect(analysis.languageAppropriate).toBe(false)
      expect(analysis.issues.length).toBeGreaterThan(0)
      expect(analysis.issues.some(issue => issue.includes('Inappropriate phrase'))).toBe(true)
    })

    it('should validate bilingual templates', () => {
      const bilingualTemplate = {
        contentEn: 'Dear valued customer, please review your invoice at your convenience.',
        subjectEn: 'Invoice review requested',
        contentAr: 'عزيزي العميل، يرجى مراجعة فاتورتك في الوقت المناسب',
        subjectAr: 'مطلوب مراجعة الفاتورة'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(bilingualTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.culturalCompliance).toBeGreaterThan(70)
    })

    it('should flag missing greetings', () => {
      const coldTemplate = {
        contentEn: 'Your invoice is due. Please pay.',
        subjectEn: 'Invoice due',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(coldTemplate)

      expect(analysis.issues.some(issue => issue.includes('Missing proper greeting'))).toBe(true)
      expect(analysis.improvements.some(imp => 
        imp.includes('Add respectful greeting like "Dear Valued Customer"')
      )).toBe(true)
    })

    it('should flag missing closings', () => {
      const abruptTemplate = {
        contentEn: 'Dear customer, please pay your invoice.',
        subjectEn: 'Invoice payment',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(abruptTemplate)

      expect(analysis.issues.some(issue => issue.includes('Missing proper closing'))).toBe(true)
      expect(analysis.improvements.some(imp => 
        imp.includes('Add respectful closing like "Thank you for your cooperation"')
      )).toBe(true)
    })

    it('should suggest personalization for impersonal templates', () => {
      const impersonalTemplate = {
        contentEn: 'The invoice is due. Payment is required.',
        subjectEn: 'Invoice due',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(impersonalTemplate)

      expect(analysis.improvements.some(imp => 
        imp.includes('Add personalization to make it more relationship-focused')
      )).toBe(true)
    })

    it('should flag demanding modal verbs', () => {
      const demandingTemplate = {
        contentEn: 'You must pay your invoice. You need to contact us immediately. You have to resolve this now.',
        subjectEn: 'Payment required',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(demandingTemplate)

      expect(analysis.issues.some(issue => 
        issue.includes('Language too demanding')
      )).toBe(true)
    })

    it('should encourage respectful language usage', () => {
      const basicTemplate = {
        contentEn: 'Pay your invoice.',
        subjectEn: 'Invoice',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(basicTemplate)

      expect(analysis.improvements.some(imp => 
        imp.includes('Consider using more respectful language')
      )).toBe(true)
    })

    it('should suggest template variables when none present', () => {
      const staticTemplate = {
        contentEn: 'Dear customer, please pay your invoice. Thank you.',
        subjectEn: 'Invoice payment reminder',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(staticTemplate)

      expect(analysis.improvements.some(imp => 
        imp.includes('Consider adding personalization variables like {{customerName}}')
      )).toBe(true)
    })

    it('should recognize and extract template variables', () => {
      const templateWithVariables = {
        contentEn: 'Dear {{customerName}}, your invoice {{invoiceNumber}} for {{amount}} is due.',
        subjectEn: 'Invoice {{invoiceNumber}} reminder',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(templateWithVariables)

      // Should not suggest adding variables since they're already present
      expect(analysis.improvements.some(imp => 
        imp.includes('Consider adding personalization variables')
      )).toBe(false)
    })
  })

  describe('Optimal Timing Suggestions', () => {
    it('should suggest appropriate timing for first reminders', () => {
      const config = CulturalComplianceService.suggestOptimalTiming(
        'FIRST_REMINDER',
        'REGULAR'
      )

      expect(config.preferredDays).toEqual([1, 2, 3]) // Monday-Wednesday
      expect(config.preferredHours).toEqual([10, 11, 14]) // Morning or early afternoon
      expect(config.culturalTone).toBe('FRIENDLY')
      expect(config.avoidPrayerTimes).toBe(true)
      expect(config.respectRamadan).toBe(true)
    })

    it('should suggest stricter timing for final notices', () => {
      const config = CulturalComplianceService.suggestOptimalTiming(
        'FINAL_NOTICE',
        'REGULAR'
      )

      expect(config.preferredDays).toEqual([1, 2]) // Monday-Tuesday
      expect(config.preferredHours).toEqual([9, 10]) // Early morning
      expect(config.culturalTone).toBe('FORMAL')
    })

    it('should suggest very formal tone for government overdue notices', () => {
      const config = CulturalComplianceService.suggestOptimalTiming(
        'OVERDUE',
        'GOVERNMENT'
      )

      expect(config.culturalTone).toBe('VERY_FORMAL')
      expect(config.preferredDays).toEqual([0, 1, 2]) // Sunday-Tuesday
    })

    it('should suggest conservative timing for payment requests', () => {
      const config = CulturalComplianceService.suggestOptimalTiming(
        'PAYMENT_REQUEST',
        'VIP'
      )

      expect(config.preferredDays).toEqual([0, 1, 2, 3]) // Sunday-Wednesday
      expect(config.preferredHours).toEqual([10, 11, 15]) // Morning or mid-afternoon
      expect(config.culturalTone).toBe('BUSINESS')
    })

    it('should provide balanced timing for second reminders', () => {
      const config = CulturalComplianceService.suggestOptimalTiming(
        'SECOND_REMINDER',
        'CORPORATE'
      )

      expect(config.preferredDays).toEqual([2, 3]) // Tuesday-Wednesday
      expect(config.preferredHours).toEqual([10, 11]) // Morning preferred
      expect(config.culturalTone).toBe('BUSINESS')
    })

    it('should always respect cultural constraints', () => {
      const types: SequenceType[] = ['FIRST_REMINDER', 'SECOND_REMINDER', 'FINAL_NOTICE', 'OVERDUE', 'PAYMENT_REQUEST']
      
      types.forEach(type => {
        const config = CulturalComplianceService.suggestOptimalTiming(type)
        
        expect(config.avoidPrayerTimes).toBe(true)
        expect(config.respectRamadan).toBe(true)
        expect(config.preferredDays.length).toBeGreaterThan(0)
        expect(config.preferredHours.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Ramadan Adjustments', () => {
    it('should provide Ramadan-specific schedule configuration', () => {
      const ramadanDate = new Date('2024-03-15') // During Ramadan
      const config = CulturalComplianceService.getRamadanAdjustments(ramadanDate)

      expect(config.preferredDays).toEqual([0, 1, 2, 3]) // Sunday-Wednesday
      expect(config.preferredHours).toEqual([9, 10, 14, 15]) // Avoid iftar time
      expect(config.avoidPrayerTimes).toBe(true)
      expect(config.respectRamadan).toBe(true)
      expect(config.culturalTone).toBe('FORMAL') // More formal during holy month
    })

    it('should detect Ramadan periods correctly', () => {
      const ramadan2024 = new Date('2024-03-15')
      const ramadan2025 = new Date('2025-03-05')
      const nonRamadan = new Date('2024-01-15')

      // Test the private method through the public interface
      const preferences2024 = CulturalComplianceService.getCulturalTimingPreferences(
        ramadan2024,
        new Date(ramadan2024.getTime() + 30 * 24 * 60 * 60 * 1000)
      )
      
      const preferences2025 = CulturalComplianceService.getCulturalTimingPreferences(
        ramadan2025,
        new Date(ramadan2025.getTime() + 30 * 24 * 60 * 60 * 1000)
      )

      const preferencesNormal = CulturalComplianceService.getCulturalTimingPreferences(
        nonRamadan,
        new Date(nonRamadan.getTime() + 30 * 24 * 60 * 60 * 1000)
      )

      expect(preferences2024.avoidancePeriods.some(p => p.name === 'Ramadan')).toBe(true)
      expect(preferences2025.avoidancePeriods.some(p => p.name === 'Ramadan')).toBe(true)
      expect(preferencesNormal.avoidancePeriods.some(p => p.name === 'Ramadan')).toBe(false)
    })
  })

  describe('Cultural Timing Preferences', () => {
    it('should identify Islamic holidays in timing preferences', () => {
      const startDate = new Date('2024-04-01')
      const endDate = new Date('2024-07-01')
      
      const preferences = CulturalComplianceService.getCulturalTimingPreferences(
        startDate,
        endDate
      )

      expect(preferences.avoidancePeriods.length).toBeGreaterThan(0)
      
      // Should include Eid holidays
      const hasEidAlFitr = preferences.avoidancePeriods.some(p => 
        p.name.includes('Eid Al Fitr')
      )
      expect(hasEidAlFitr).toBe(true)
    })

    it('should provide cultural considerations', () => {
      const preferences = CulturalComplianceService.getCulturalTimingPreferences()

      expect(preferences.culturalConsiderations.length).toBeGreaterThan(0)
      expect(preferences.culturalConsiderations.some(c => 
        c.includes('respectful greetings')
      )).toBe(true)
      expect(preferences.culturalConsiderations.some(c => 
        c.includes('aggressive or demanding language')
      )).toBe(true)
      expect(preferences.culturalConsiderations.some(c => 
        c.includes('relationship over urgency')
      )).toBe(true)
    })

    it('should set optimal UAE business days and hours', () => {
      const preferences = CulturalComplianceService.getCulturalTimingPreferences()

      expect(preferences.preferredDays).toEqual([2, 3, 4]) // Tuesday-Thursday
      expect(preferences.preferredHours).toEqual([10, 11, 14, 15]) // Optimal times
    })

    it('should handle date range edge cases', () => {
      const sameDay = new Date('2024-04-09') // Eid day
      const preferences = CulturalComplianceService.getCulturalTimingPreferences(
        sameDay,
        sameDay
      )

      // Should still detect holidays even for single day
      expect(preferences.avoidancePeriods.some(p => 
        p.name.includes('Eid')
      )).toBe(true)
    })
  })

  describe('Subject Line Generation', () => {
    it('should generate culturally appropriate first reminder subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'FIRST_REMINDER',
        'Ahmed Al-Rashid',
        'INV-001'
      )

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.every(s => s.includes('#INV-001'))).toBe(true)
      expect(suggestions.some(s => s.includes('Gentle reminder'))).toBe(true)
      expect(suggestions.some(s => s.includes('appreciated'))).toBe(true)
      
      // Should avoid aggressive language
      expect(suggestions.every(s => !s.includes('URGENT'))).toBe(true)
      expect(suggestions.every(s => !s.includes('PAY NOW'))).toBe(true)
    })

    it('should generate escalated but respectful final notice subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'FINAL_NOTICE',
        'Ahmed Al-Rashid',
        'INV-001'
      )

      expect(suggestions.some(s => s.includes('Important'))).toBe(true)
      expect(suggestions.some(s => s.includes('Final notice'))).toBe(true)
      expect(suggestions.some(s => s.includes('attention'))).toBe(true)
      
      // Should avoid threatening language
      expect(suggestions.every(s => !s.includes('legal action'))).toBe(true)
      expect(suggestions.every(s => !s.includes('consequences'))).toBe(true)
    })

    it('should generate professional second reminder subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'SECOND_REMINDER',
        'Ahmed Al-Rashid',
        'INV-001'
      )

      expect(suggestions.some(s => s.includes('Second notice'))).toBe(true)
      expect(suggestions.some(s => s.includes('Follow-up'))).toBe(true)
      expect(suggestions.some(s => s.includes('cooperation'))).toBe(true)
    })

    it('should generate appropriate payment request subjects', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'PAYMENT_REQUEST',
        'Ahmed Al-Rashid',
        'INV-001'
      )

      expect(suggestions.some(s => s.includes('Payment request'))).toBe(true)
      expect(suggestions.some(s => s.includes('arrangement'))).toBe(true)
      expect(suggestions.some(s => s.includes('Settlement'))).toBe(true)
    })

    it('should handle missing customer information gracefully', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'FIRST_REMINDER'
      )

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.every(s => typeof s === 'string')).toBe(true)
      
      // Should work without customer name or invoice number
      expect(() => CulturalComplianceService.generateSubjectLineSuggestions(
        'SECOND_REMINDER',
        undefined,
        undefined
      )).not.toThrow()
    })

    it('should include appropriate variables in suggestions', () => {
      const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
        'FIRST_REMINDER',
        'Ahmed Al-Rashid',
        'INV-2024-001'
      )

      expect(suggestions.every(s => s.includes('#INV-2024-001'))).toBe(true)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined sequence gracefully', () => {
      expect(() => CulturalComplianceService.validateSequenceTone(
        null as any,
        'REGULAR'
      )).not.toThrow()

      expect(() => CulturalComplianceService.validateSequenceTone(
        undefined as any,
        'REGULAR'
      )).not.toThrow()
    })

    it('should handle empty template content', () => {
      const emptyTemplate = {
        contentEn: '',
        subjectEn: '',
        contentAr: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(emptyTemplate)

      expect(analysis.isValid).toBe(false) // Empty content is not valid
      expect(analysis.culturalCompliance).toBeLessThan(70)
    })

    it('should handle malformed sequence steps', () => {
      const malformedSequence = {
        id: 'sequence-123',
        steps: 'not an array'
      }

      expect(() => CulturalComplianceService.validateSequenceTone(
        malformedSequence,
        'REGULAR'
      )).not.toThrow()
    })

    it('should handle missing step properties', () => {
      const incompleteSequence = {
        id: 'sequence-123',
        steps: [
          {
            stepNumber: 1
            // Missing other properties
          }
        ]
      }

      expect(() => CulturalComplianceService.validateSequenceTone(
        incompleteSequence,
        'REGULAR'
      )).not.toThrow()
    })

    it('should handle invalid customer relationship types', () => {
      expect(() => CulturalComplianceService.validateSequenceTone(
        { steps: [] },
        'INVALID_TYPE' as any
      )).not.toThrow()
    })

    it('should handle invalid sequence types in timing suggestions', () => {
      expect(() => CulturalComplianceService.suggestOptimalTiming(
        'INVALID_TYPE' as any,
        'REGULAR'
      )).not.toThrow()
    })
  })

  describe('Performance and Consistency', () => {
    it('should consistently analyze the same content', () => {
      const template = {
        contentEn: 'Dear valued customer, please kindly review your invoice at your convenience. Thank you for your cooperation.',
        subjectEn: 'Invoice review request',
        contentAr: '',
        subjectAr: ''
      }

      const results = Array.from({ length: 10 }, () => 
        CulturalComplianceService.validateTemplateContent(template)
      )

      // All results should be identical
      const firstResult = results[0]
      results.forEach(result => {
        expect(result.isValid).toBe(firstResult.isValid)
        expect(result.culturalCompliance).toBe(firstResult.culturalCompliance)
        expect(result.issues).toEqual(firstResult.issues)
      })
    })

    it('should handle rapid successive calls efficiently', () => {
      const startTime = Date.now()

      // Make 1000 rapid validation calls
      for (let i = 0; i < 1000; i++) {
        CulturalComplianceService.validateTemplateContent({
          contentEn: `Dear customer ${i}, please pay your invoice.`,
          subjectEn: `Invoice ${i}`,
          contentAr: '',
          subjectAr: ''
        })
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle large content efficiently', () => {
      const largeContent = 'Dear valued customer, '.repeat(1000) + 
        'please kindly review your invoice at your convenience. Thank you for your cooperation.'

      const startTime = Date.now()
      
      const analysis = CulturalComplianceService.validateTemplateContent({
        contentEn: largeContent,
        subjectEn: 'Very long invoice review request',
        contentAr: '',
        subjectAr: ''
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      expect(analysis.isValid).toBeDefined()
    })
  })

  describe('Singleton Instance', () => {
    it('should provide consistent singleton instance', () => {
      const instance1 = culturalCompliance
      const instance2 = culturalCompliance

      expect(instance1).toBe(instance2)
      expect(instance1).toBeInstanceOf(CulturalComplianceService)
    })

    it('should maintain state consistency across calls', () => {
      // Static methods should not depend on instance state
      const result1 = CulturalComplianceService.validateTemplateContent({
        contentEn: 'Test content',
        subjectEn: 'Test subject',
        contentAr: '',
        subjectAr: ''
      })

      const result2 = culturalCompliance.constructor.validateTemplateContent({
        contentEn: 'Test content',
        subjectEn: 'Test subject',
        contentAr: '',
        subjectAr: ''
      })

      // Results should be identical since they're static methods
      expect(result1.isValid).toBe(result2.isValid)
      expect(result1.culturalCompliance).toBe(result2.culturalCompliance)
    })
  })

  describe('Integration with Other Services', () => {
    it('should provide schedule configs compatible with UAE business hours', () => {
      const config = CulturalComplianceService.suggestOptimalTiming('FIRST_REMINDER')

      // Should return ScheduleConfig interface
      expect(config).toHaveProperty('preferredDays')
      expect(config).toHaveProperty('preferredHours')
      expect(config).toHaveProperty('avoidPrayerTimes')
      expect(config).toHaveProperty('respectRamadan')
      expect(config).toHaveProperty('culturalTone')

      // Values should be valid for UAE context
      expect(Array.isArray(config.preferredDays)).toBe(true)
      expect(Array.isArray(config.preferredHours)).toBe(true)
      expect(typeof config.avoidPrayerTimes).toBe('boolean')
      expect(typeof config.respectRamadan).toBe('boolean')
      expect(['VERY_FORMAL', 'FORMAL', 'BUSINESS', 'FRIENDLY', 'CASUAL']).toContain(config.culturalTone)
    })

    it('should provide timing preferences compatible with scheduling systems', () => {
      const preferences = CulturalComplianceService.getCulturalTimingPreferences()

      expect(preferences).toHaveProperty('preferredDays')
      expect(preferences).toHaveProperty('preferredHours')
      expect(preferences).toHaveProperty('avoidancePeriods')
      expect(preferences).toHaveProperty('culturalConsiderations')

      // Avoidance periods should have proper structure
      preferences.avoidancePeriods.forEach(period => {
        expect(period).toHaveProperty('name')
        expect(period).toHaveProperty('start')
        expect(period).toHaveProperty('end')
        expect(period).toHaveProperty('reason')
        expect(period.start).toBeInstanceOf(Date)
        expect(period.end).toBeInstanceOf(Date)
      })
    })
  })
})