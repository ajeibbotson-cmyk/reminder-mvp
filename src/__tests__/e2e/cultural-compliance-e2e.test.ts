/**
 * UAE Cultural Compliance End-to-End Tests
 * 
 * Comprehensive validation of UAE cultural sensitivity, Islamic etiquette,
 * and business compliance throughout the entire payment automation workflow.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { culturalCompliance, CulturalComplianceService } from '@/lib/services/cultural-compliance-service'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { prisma } from '@/lib/prisma'
import { UAETestUtils } from '@/lib/uae-test-utils'
import { setupTestDatabase, cleanupTestDatabase } from '@/lib/test-db-setup'

describe('UAE Cultural Compliance End-to-End Tests', () => {
  let testCompanyId: string
  let testUserId: string

  beforeAll(async () => {
    await setupTestDatabase()
    
    testCompanyId = UAETestUtils.generateId()
    testUserId = UAETestUtils.generateId()

    await prisma.company.create({
      data: {
        id: testCompanyId,
        name: 'Al Jazeera Cultural Test LLC',
        trn: '100474123400003',
        address: 'Dubai International Financial Centre, UAE',
        businessHours: {
          workingDays: [0, 1, 2, 3, 4],
          startHour: 8,
          endHour: 18,
          timezone: 'Asia/Dubai'
        }
      }
    })

    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'cultural.test@aljazeera.ae',
        name: 'Cultural Test User',
        companyId: testCompanyId,
        role: 'ADMIN'
      }
    })
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('Islamic Greetings and Etiquette Validation', () => {
    it('should validate proper Islamic greetings in different contexts', async () => {
      const greetingTests = [
        {
          greeting: 'As-salamu alaykum, valued customer',
          language: 'en' as const,
          expected: { appropriate: true, culturalLevel: 'excellent' }
        },
        {
          greeting: 'Peace be upon you, esteemed partner',
          language: 'en' as const,
          expected: { appropriate: true, culturalLevel: 'excellent' }
        },
        {
          greeting: 'Dear valued customer',
          language: 'en' as const,
          expected: { appropriate: true, culturalLevel: 'good' }
        },
        {
          greeting: 'Hey there!',
          language: 'en' as const,
          expected: { appropriate: false, culturalLevel: 'poor' }
        },
        {
          greeting: 'السلام عليكم ورحمة الله وبركاته',
          language: 'ar' as const,
          expected: { appropriate: true, culturalLevel: 'excellent' }
        }
      ]

      for (const test of greetingTests) {
        const result = CulturalComplianceService.isAppropriateGreeting(
          test.greeting, 
          test.language
        )

        expect(result.appropriate).toBe(test.expected.appropriate)
        expect(result.culturalLevel).toBe(test.expected.culturalLevel)
        
        if (!result.appropriate) {
          expect(result.suggestion).toBeTruthy()
        }
      }
    })

    it('should validate closing phrases with Islamic context', async () => {
      const closingTests = [
        {
          content: `Thank you for your attention.\n\nJazakAllahu khair,\nTeam`,
          expectedScore: 90
        },
        {
          content: `Best regards,\nMay Allah bless your business\nFinance Team`,
          expectedScore: 85
        },
        {
          content: `Sincerely,\nFinance Department`,
          expectedScore: 70
        },
        {
          content: `Thanks,\nBye`,
          expectedScore: 40
        }
      ]

      for (const test of closingTests) {
        const analysis = CulturalComplianceService.calculateCulturalScore(test.content)
        expect(analysis.score).toBeGreaterThanOrEqual(test.expectedScore - 10)
      }
    })

    it('should recognize and reward use of Islamic phrases', async () => {
      const islamicPhraseTests = [
        'Barakallahu feeki for your cooperation',
        'May Allah bless this business partnership',
        'Fi Amanillah until we meet again',
        'InshaAllah we will resolve this matter soon'
      ]

      for (const phrase of islamicPhraseTests) {
        const analysis = CulturalComplianceService.calculateCulturalScore(phrase)
        
        // Should get bonus points for Islamic etiquette
        expect(analysis.breakdown.islamicEtiquette).toBeGreaterThan(100)
        expect(analysis.score).toBeGreaterThan(80)
      }
    })
  })

  describe('Customer Relationship Context Compliance', () => {
    it('should enforce very formal tone for government customers', async () => {
      const governmentSequence = {
        id: 'gov-test',
        steps: [
          {
            stepNumber: 1,
            delayDays: 14, // Appropriate delay for government
            content: `Your Excellency,

We respectfully bring to your attention the outstanding invoice for professional services rendered to your esteemed department.

We understand that government procedures may require additional processing time, and we remain at your service for any clarification needed.

With highest regards and respect,
Finance Department
TRN: 100474123400003`,
            subject: 'Respectful Reminder: Professional Services Invoice',
            tone: 'VERY_FORMAL'
          }
        ]
      }

      const validation = culturalCompliance.validateSequenceTone(
        governmentSequence, 
        'GOVERNMENT'
      )

      expect(validation.isAppropriate).toBe(true)
      expect(validation.culturalScore).toBeGreaterThan(85)
      expect(validation.recommendedTone).toBe('VERY_FORMAL')
      expect(validation.issues.length).toBe(0)
    })

    it('should handle VIP customers with special consideration', async () => {
      const vipSequence = {
        id: 'vip-test',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7, // Shorter but respectful delay for VIP
            content: `Dear Esteemed {{customerName}},

We hope you and your family are in excellent health and prosperity.

We wanted to gently bring to your attention our invoice for the recent services provided. We understand you may be attending to important matters, so please handle this at your convenience.

We deeply value our partnership and look forward to continuing our collaboration.

With warmest regards and best wishes,
{{companyName}} Team

May Allah bless your endeavors`,
            subject: 'Gentle Reminder - At Your Convenience',
            tone: 'FRIENDLY'
          }
        ]
      }

      const validation = culturalCompliance.validateSequenceTone(vipSequence, 'VIP')

      expect(validation.isAppropriate).toBe(true)
      expect(validation.culturalScore).toBeGreaterThan(80)
      expect(validation.issues.length).toBe(0)
      
      // Should not contain aggressive language
      const content = vipSequence.steps[0].content.toLowerCase()
      expect(content).not.toContain('immediately')
      expect(content).not.toContain('overdue')
      expect(content).not.toContain('demand')
    })

    it('should validate tone escalation appropriateness', async () => {
      const escalationSteps = [
        { tone: 'FRIENDLY', content: 'friendly reminder', delayDays: 7 },
        { tone: 'BUSINESS', content: 'business follow-up', delayDays: 14 },
        { tone: 'FORMAL', content: 'formal request', delayDays: 21 },
        { tone: 'FORMAL', content: 'final notice', delayDays: 28 }
      ]

      const validation = CulturalComplianceService.validateToneEscalation(
        escalationSteps,
        'CORPORATE'
      )

      expect(validation.appropriate).toBe(true)
      expect(validation.issues.length).toBe(0)
      expect(validation.recommendedProgression.length).toBeGreaterThan(0)
    })

    it('should flag inappropriate tone escalation', async () => {
      const inappropriateSteps = [
        { tone: 'URGENT', content: 'URGENT PAYMENT REQUIRED', delayDays: 1 },
        { tone: 'URGENT', content: 'IMMEDIATE ACTION DEMANDED', delayDays: 2 }
      ]

      const validation = CulturalComplianceService.validateToneEscalation(
        inappropriateSteps,
        'GOVERNMENT'
      )

      expect(validation.appropriate).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('Ramadan and Islamic Calendar Awareness', () => {
    it('should apply Ramadan-specific schedule adjustments', async () => {
      const ramadanDate = new Date('2024-03-20T10:00:00.000Z')
      const ramadanConfig = CulturalComplianceService.getRamadanAdjustments(ramadanDate)

      expect(ramadanConfig.preferredDays).toContain(0) // Sunday
      expect(ramadanConfig.preferredDays).toContain(1) // Monday
      expect(ramadanConfig.preferredDays).toContain(2) // Tuesday
      expect(ramadanConfig.preferredDays).toContain(3) // Wednesday
      expect(ramadanConfig.preferredDays).not.toContain(4) // Avoid Thursday before weekend

      expect(ramadanConfig.preferredHours).toContain(9)
      expect(ramadanConfig.preferredHours).toContain(10)
      expect(ramadanConfig.preferredHours).toContain(14)
      expect(ramadanConfig.preferredHours).toContain(15)
      
      expect(ramadanConfig.respectRamadan).toBe(true)
      expect(ramadanConfig.culturalTone).toBe('FORMAL')
    })

    it('should detect and handle Ramadan period appropriately', async () => {
      const ramadanContent = `As-salamu alaykum and Ramadan Kareem,

We hope you are having a blessed Ramadan and that your fasting and prayers are accepted.

We wanted to gently remind you of our pending invoice, understanding that this holy month requires your attention to spiritual matters.

Please handle this at your convenience after your religious obligations.

Ramadan Mubarak,
Finance Team`

      const analysis = CulturalComplianceService.calculateCulturalScore(ramadanContent, {
        isRamadan: true,
        language: 'en'
      })

      expect(analysis.score).toBeGreaterThan(90)
      expect(analysis.breakdown.islamicEtiquette).toBeGreaterThan(90)
      expect(analysis.breakdown.culturalSensitivity).toBeGreaterThan(85)
    })

    it('should provide appropriate cultural timing preferences', async () => {
      const preferences = CulturalComplianceService.getCulturalTimingPreferences(
        new Date('2024-03-10'), // Start of Ramadan
        new Date('2024-04-10')  // End of Ramadan
      )

      expect(preferences.preferredDays).toContain(2) // Tuesday
      expect(preferences.preferredDays).toContain(3) // Wednesday
      expect(preferences.preferredDays).toContain(4) // Thursday

      expect(preferences.avoidancePeriods.length).toBeGreaterThan(0)
      const ramadanPeriod = preferences.avoidancePeriods.find(p => p.name === 'Ramadan')
      expect(ramadanPeriod).toBeTruthy()

      expect(preferences.culturalConsiderations.length).toBeGreaterThan(0)
      expect(preferences.culturalConsiderations.some(c => 
        c.includes('Ramadan') || c.includes('formal tone')
      )).toBe(true)
    })
  })

  describe('Arabic Language and RTL Support', () => {
    it('should accurately detect Arabic content and RTL requirements', async () => {
      const arabicTests = [
        {
          text: 'السلام عليكم ورحمة الله وبركاته، عزيزي العميل المحترم',
          expectedArabicPercentage: 100,
          expectedRTL: true,
          expectedRequiresRTLLayout: true
        },
        {
          text: 'Dear Customer السلام عليكم How are you today?',
          expectedArabicPercentage: 25,
          expectedRTL: false,
          expectedRequiresRTLLayout: false,
          expectedMixed: true
        },
        {
          text: 'Hello, this is a test message in English only.',
          expectedArabicPercentage: 0,
          expectedRTL: false,
          expectedRequiresRTLLayout: false
        }
      ]

      for (const test of arabicTests) {
        const analysis = CulturalComplianceService.detectArabicLanguage(test.text)

        expect(analysis.arabicPercentage).toBeCloseTo(test.expectedArabicPercentage, 10)
        expect(analysis.isRTL).toBe(test.expectedRTL)
        expect(analysis.requiresRTLLayout).toBe(test.expectedRequiresRTLLayout)
        
        if (test.expectedMixed) {
          expect(analysis.mixedLanguage).toBe(true)
        }
      }
    })

    it('should validate bilingual template content', async () => {
      const bilingualTemplate = {
        contentEn: `Dear Valued Customer,

We hope this message finds you well.

Your invoice #INV-2024-001 for AED 5,250.00 is due for payment.

Thank you for your cooperation.

Best regards,
Finance Team
TRN: 100474123400003`,
        contentAr: `عزيزي العميل المحترم،

نتمنى أن تكونوا بخير وصحة جيدة.

فاتورتكم رقم INV-2024-001 بمبلغ 5,250.00 درهم إماراتي مستحقة الدفع.

شكراً لتعاونكم.

مع أطيب التحيات،
فريق المحاسبة
الرقم الضريبي: 100474123400003`,
        subjectEn: 'Invoice Reminder - Payment Due',
        subjectAr: 'تذكير بالفاتورة - مستحقة الدفع'
      }

      const validation = CulturalComplianceService.validateTemplateContent(bilingualTemplate)

      expect(validation.isValid).toBe(true)
      expect(validation.culturalCompliance).toBeGreaterThan(75)
      expect(validation.languageAppropriate).toBe(true)
      expect(validation.respectfulTone).toBe(true)
      expect(validation.businessAppropriate).toBe(true)
    })

    it('should extract and validate Arabic words correctly', async () => {
      const mixedContent = 'Welcome أهلاً وسهلاً to our store متجرنا for shopping تسوق'
      const analysis = CulturalComplianceService.detectArabicLanguage(mixedContent)

      expect(analysis.hasArabic).toBe(true)
      expect(analysis.arabicWords.length).toBeGreaterThan(0)
      expect(analysis.mixedLanguage).toBe(true)
      
      // Should contain Arabic words
      expect(analysis.arabicWords).toContain('أهلاً')
      expect(analysis.arabicWords).toContain('وسهلاً')
      expect(analysis.arabicWords).toContain('متجرنا')
      expect(analysis.arabicWords).toContain('تسوق')
    })
  })

  describe('Business Hours and Prayer Time Integration', () => {
    it('should validate scheduling respects prayer times throughout day', async () => {
      const prayerTimes = [
        { name: 'Fajr', time: '05:30', testTime: new Date('2024-03-19T01:30:00.000Z') },
        { name: 'Dhuhr', time: '12:15', testTime: new Date('2024-03-19T08:15:00.000Z') },
        { name: 'Asr', time: '15:30', testTime: new Date('2024-03-19T11:30:00.000Z') },
        { name: 'Maghrib', time: '18:30', testTime: new Date('2024-03-19T14:30:00.000Z') },
        { name: 'Isha', time: '20:00', testTime: new Date('2024-03-19T16:00:00.000Z') }
      ]

      for (const prayer of prayerTimes) {
        expect(uaeBusinessHours.isPrayerTime(prayer.testTime)).toBe(true)
        
        const nextAvailable = uaeBusinessHours.getNextAvailableSendTime(prayer.testTime, {
          avoidPrayerTimes: true
        })
        
        expect(uaeBusinessHours.isPrayerTime(nextAvailable)).toBe(false)
      }
    })

    it('should validate scheduled times against UAE business culture', async () => {
      const testSchedules = [
        {
          date: new Date('2024-03-19T06:00:00.000Z'), // Tuesday 10 AM UAE
          expectValid: true
        },
        {
          date: new Date('2024-03-22T06:00:00.000Z'), // Friday 10 AM UAE
          expectValid: false,
          expectedReason: 'Weekend in UAE'
        },
        {
          date: new Date('2024-12-02T06:00:00.000Z'), // UAE National Day
          expectValid: false,
          expectedReason: 'UAE Holiday'
        },
        {
          date: new Date('2024-03-19T08:15:00.000Z'), // Prayer time
          expectValid: false,
          expectedReason: 'Conflicts with prayer time'
        }
      ]

      for (const schedule of testSchedules) {
        const validation = uaeBusinessHours.validateScheduledTime(schedule.date)
        
        expect(validation.isValid).toBe(schedule.expectValid)
        
        if (!schedule.expectValid && schedule.expectedReason) {
          expect(validation.reasons.some(reason => 
            reason.includes(schedule.expectedReason!)
          )).toBe(true)
          expect(validation.suggestions.length).toBeGreaterThan(0)
        }
      }
    })

    it('should provide culturally appropriate subject line suggestions', async () => {
      const subjectTests = [
        {
          sequenceType: 'FIRST_REMINDER' as const,
          customerName: 'Ahmad Al-Maktoum',
          invoiceNumber: 'INV-2024-001'
        },
        {
          sequenceType: 'FINAL_NOTICE' as const,
          customerName: 'Dubai Municipality',
          invoiceNumber: 'INV-GOV-2024-005'
        }
      ]

      for (const test of subjectTests) {
        const suggestions = CulturalComplianceService.generateSubjectLineSuggestions(
          test.sequenceType,
          test.customerName,
          test.invoiceNumber
        )

        expect(suggestions.length).toBeGreaterThan(2)
        
        suggestions.forEach(suggestion => {
          expect(suggestion).toContain(test.invoiceNumber!)
          
          if (test.sequenceType === 'FIRST_REMINDER') {
            expect(suggestion.toLowerCase()).toContain('reminder')
            expect(suggestion.toLowerCase()).not.toContain('urgent')
          }
          
          if (test.sequenceType === 'FINAL_NOTICE') {
            expect(suggestion.toLowerCase()).toMatch(/important|final|critical/)
            expect(suggestion.toLowerCase()).not.toContain('demand')
          }
        })
      }
    })
  })

  describe('Integration with Sequence Execution', () => {
    it('should validate cultural compliance during sequence execution', async () => {
      // Create test invoice and customer
      const customerId = UAETestUtils.generateId()
      const invoiceId = UAETestUtils.generateId()

      await prisma.customer.create({
        data: {
          id: customerId,
          companyId: testCompanyId,
          name: 'Dubai Municipality',
          email: 'procurement@dm.gov.ae',
          phone: '+971-4-221-5555'
        }
      })

      await prisma.invoice.create({
        data: {
          id: invoiceId,
          companyId: testCompanyId,
          number: 'INV-CUL-001',
          customerName: 'Dubai Municipality',
          customerEmail: 'procurement@dm.gov.ae',
          amount: 10000,
          vatAmount: 500,
          totalAmount: 10500,
          currency: 'AED',
          dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          status: 'OVERDUE',
          trnNumber: '100474123400003'
        }
      })

      // Create culturally compliant sequence
      const sequence = await prisma.follow_up_sequences.create({
        data: {
          id: UAETestUtils.generateId(),
          companyId: testCompanyId,
          name: 'Government Cultural Compliance Test',
          steps: [
            {
              stepNumber: 1,
              delayDays: 14,
              subject: 'Respectful Reminder: Invoice {{invoiceNumber}} - Your Attention Appreciated',
              content: `As-salamu alaykum and greetings,

Your Excellency,

We respectfully bring to your attention that Invoice {{invoiceNumber}} dated {{dueDate}} for the amount of {{currency}} {{invoiceAmount}} requires your kind attention.

We understand that government procedures may require additional processing time, and we remain at your service for any clarification needed.

Thank you for your continued cooperation.

With highest regards,
{{companyName}} Finance Team
TRN: {{trnNumber}}

JazakAllahu khair`,
              tone: 'VERY_FORMAL',
              language: 'ENGLISH'
            }
          ],
          active: true,
          updatedAt: new Date()
        }
      })

      // Execute sequence and validate cultural compliance
      const executionResult = await sequenceExecutionService.startSequenceExecution(
        sequence.id,
        invoiceId,
        { type: 'INVOICE_STATUS', value: 'OVERDUE', operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)

      // Verify the executed email maintains cultural compliance
      const emailLog = await prisma.emailLog.findFirst({
        where: { id: executionResult.emailLogIds[0] }
      })

      expect(emailLog).toBeTruthy()
      
      // Content should contain Islamic greetings
      expect(emailLog!.content).toContain('As-salamu alaykum')
      expect(emailLog!.content).toContain('JazakAllahu khair')
      expect(emailLog!.content).toContain('Your Excellency')
      
      // Should not contain aggressive language
      const inappropriateTerms = ['immediately', 'demand', 'must pay', 'urgent']
      inappropriateTerms.forEach(term => {
        expect(emailLog!.content.toLowerCase()).not.toContain(term)
      })
    })

    it('should handle mixed language sequence execution', async () => {
      const customerId = UAETestUtils.generateId()
      const invoiceId = UAETestUtils.generateId()

      await prisma.customer.create({
        data: {
          id: customerId,
          companyId: testCompanyId,
          name: 'Ahmed Al-Rashid',
          nameAr: 'أحمد الراشد',
          email: 'ahmed@example.ae',
          phone: '+971-50-123-4567'
        }
      })

      await prisma.invoice.create({
        data: {
          id: invoiceId,
          companyId: testCompanyId,
          number: 'INV-MIX-001',
          customerName: 'Ahmed Al-Rashid',
          customerEmail: 'ahmed@example.ae',
          amount: 5000,
          vatAmount: 250,
          totalAmount: 5250,
          currency: 'AED',
          dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: 'OVERDUE',
          trnNumber: '100474123400003'
        }
      })

      const bilingualSequence = await prisma.follow_up_sequences.create({
        data: {
          id: UAETestUtils.generateId(),
          companyId: testCompanyId,
          name: 'Bilingual Cultural Test',
          steps: [
            {
              stepNumber: 1,
              delayDays: 7,
              subject: 'Invoice Reminder / تذكير بالفاتورة - {{invoiceNumber}}',
              content: `Dear {{customerName}} / عزيزي {{customerName}},

As-salamu alaykum / السلام عليكم

We hope this message finds you in good health.
نتمنى أن تكونوا بخير وصحة جيدة.

Your invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}} is due for payment.
فاتورتكم رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} {{currency}} مستحقة الدفع.

Thank you for your cooperation.
شكراً لتعاونكم.

Best regards / مع أطيب التحيات,
{{companyName}} Team / فريق {{companyName}}

JazakAllahu khair / جزاكم الله خيراً`,
              tone: 'BUSINESS',
              language: 'BOTH'
            }
          ],
          active: true,
          updatedAt: new Date()
        }
      })

      const executionResult = await sequenceExecutionService.startSequenceExecution(
        bilingualSequence.id,
        invoiceId,
        { type: 'MANUAL', value: true, operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)
      expect(executionResult.emailLogIds.length).toBeGreaterThan(0)

      // Validate cultural aspects of the bilingual content
      const emailLog = await prisma.emailLog.findFirst({
        where: { id: executionResult.emailLogIds[0] }
      })

      expect(emailLog).toBeTruthy()
      
      const arabicAnalysis = CulturalComplianceService.detectArabicLanguage(emailLog!.content)
      expect(arabicAnalysis.mixedLanguage).toBe(true)
      expect(arabicAnalysis.hasArabic).toBe(true)
      
      const complianceScore = CulturalComplianceService.calculateCulturalScore(emailLog!.content)
      expect(complianceScore.score).toBeGreaterThan(80)
    })
  })
})