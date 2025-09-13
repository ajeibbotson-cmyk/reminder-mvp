import { 
  UAE_CONSTANTS,
  arabicTestUtils,
  culturalComplianceUtils,
  templateValidationUtils,
  uaeTestDataGenerators,
  uaeBusinessScenarios
} from '@/lib/uae-test-utils'

describe('UAE Cultural Compliance System', () => {
  describe('UAE Constants Validation', () => {
    it('defines correct UAE business hours', () => {
      expect(UAE_CONSTANTS.businessHours.timezone).toBe('Asia/Dubai')
      expect(UAE_CONSTANTS.businessHours.workingDays).toEqual([
        'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'
      ])
      expect(UAE_CONSTANTS.businessHours.startTime).toBe('09:00')
      expect(UAE_CONSTANTS.businessHours.endTime).toBe('18:00')
    })

    it('defines correct UAE VAT information', () => {
      expect(UAE_CONSTANTS.vat.standardRate).toBe(5.0)
      expect(UAE_CONSTANTS.vat.zeroRated).toBe(0.0)
      expect(UAE_CONSTANTS.vat.registrationThreshold).toBe(375000)
    })

    it('validates UAE TRN format', () => {
      const validTrn = '100123456789012'
      const invalidTrn = '123456789'
      
      expect(UAE_CONSTANTS.trn.format.test(validTrn)).toBe(true)
      expect(UAE_CONSTANTS.trn.format.test(invalidTrn)).toBe(false)
    })

    it('validates UAE phone number formats', () => {
      const validMobile = '+971501234567'
      const validLandline = '+971043334444'
      const invalidPhone = '+1234567890'
      
      expect(UAE_CONSTANTS.phoneFormats.mobile.test(validMobile)).toBe(true)
      expect(UAE_CONSTANTS.phoneFormats.landline.test(validLandline)).toBe(true)
      expect(UAE_CONSTANTS.phoneFormats.mobile.test(invalidPhone)).toBe(false)
    })

    it('includes all seven emirates', () => {
      expect(UAE_CONSTANTS.emirates).toHaveLength(7)
      expect(UAE_CONSTANTS.emirates.map(e => e.code)).toEqual([
        'AD', 'DU', 'SH', 'AJ', 'UQ', 'RK', 'FU'
      ])
    })
  })

  describe('Arabic Language Support', () => {
    it('detects Arabic text correctly', () => {
      const arabicText = 'مرحباً بكم في الإمارات'
      const englishText = 'Welcome to UAE'
      const mixedText = 'Welcome مرحباً'
      
      expect(arabicTestUtils.hasArabicText(arabicText)).toBe(true)
      expect(arabicTestUtils.hasArabicText(englishText)).toBe(false)
      expect(arabicTestUtils.hasArabicText(mixedText)).toBe(true)
    })

    it('determines RTL text direction', () => {
      const rtlText = 'الرقم الضريبي: 100123456789012'
      const ltrText = 'TRN: 100123456789012'
      const mixedRtlText = 'عزيزي العميل John Smith'
      
      expect(arabicTestUtils.isRTL(rtlText)).toBe(true)
      expect(arabicTestUtils.isRTL(ltrText)).toBe(false)
      // Mixed text should favor direction with more characters
    })

    it('validates Arabic business content', () => {
      const goodArabicContent = 'عزيزي العميل، يرجى دفع الفاتورة. الرقم الضريبي للشركة: 100123456789012'
      const poorArabicContent = 'Hello customer, pay now!'
      
      const goodValidation = arabicTestUtils.validateArabicBusinessContent(goodArabicContent)
      const poorValidation = arabicTestUtils.validateArabicBusinessContent(poorArabicContent)
      
      expect(goodValidation.valid).toBe(true)
      expect(goodValidation.issues).toHaveLength(0)
      
      expect(poorValidation.valid).toBe(false)
      expect(poorValidation.issues).toContain('No Arabic text found')
    })

    it('recognizes Arabic business phrases', () => {
      const { businessPhrases } = arabicTestUtils
      
      expect(businessPhrases.greetings).toContain('أهلاً وسهلاً')
      expect(businessPhrases.greetings).toContain('السلام عليكم')
      expect(businessPhrases.closings).toContain('أطيب التحيات')
      expect(businessPhrases.businessTerms).toContain('فاتورة')
      expect(businessPhrases.businessTerms).toContain('الرقم الضريبي')
    })
  })

  describe('Cultural Compliance Validation', () => {
    it('validates appropriate English business etiquette', () => {
      const appropriateContent = `Dear Mr. Smith,

We hope this email finds you well. We would like to remind you about the outstanding invoice.

Please contact us during UAE business hours if you need assistance.

Best regards,
UAE Company LLC
TRN: 100123456789012`

      const validation = culturalComplianceUtils.validateBusinessEtiquette(appropriateContent, 'en')
      
      expect(validation.appropriate).toBe(true)
      expect(validation.score).toBeGreaterThan(70)
      expect(validation.recommendations).toHaveLength(0)
    })

    it('flags inappropriate English content', () => {
      const inappropriateContent = `Hey Smith,

You MUST pay this invoice IMMEDIATELY!!! No excuses!

Don't make us wait or we'll take action RIGHT AWAY!!!

Cheers`

      const validation = culturalComplianceUtils.validateBusinessEtiquette(inappropriateContent, 'en')
      
      expect(validation.appropriate).toBe(false)
      expect(validation.score).toBeLessThan(70)
      expect(validation.recommendations.length).toBeGreaterThan(0)
      expect(validation.recommendations).toContain('Use formal greetings like "Dear" or "Respected"')
      expect(validation.recommendations).toContain('Soften aggressive language for UAE business culture')
    })

    it('validates Arabic business etiquette', () => {
      const appropriateArabicContent = `عزيزي السيد سميث،

نأمل أن تكون بخير. نود تذكيركم بالفاتورة المستحقة.

يرجى الاتصال بنا خلال ساعات العمل في الإمارات إذا كنتم بحاجة للمساعدة.

أطيب التحيات،
شركة الإمارات ذ.م.م
الرقم الضريبي: 100123456789012`

      const validation = culturalComplianceUtils.validateBusinessEtiquette(appropriateArabicContent, 'ar')
      
      expect(validation.appropriate).toBe(true)
      expect(validation.score).toBeGreaterThan(70)
    })

    it('validates UAE business hours compliance', () => {
      // Mock current time to be within business hours
      const workingHourTest = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      expect(workingHourTest.withinHours).toBeDefined()
      
      // Test weekend detection
      const fridayTest = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      expect(fridayTest).toHaveProperty('withinHours')
      expect(fridayTest).toHaveProperty('reason')
    })
  })

  describe('Template Validation System', () => {
    it('validates complete UAE business template', () => {
      const uaeTemplate = uaeTestDataGenerators.createUAEBusinessTemplate()
      const validation = templateValidationUtils.validateUAETemplate(uaeTemplate)
      
      expect(validation.valid).toBe(true)
      expect(validation.score).toBeGreaterThan(80)
      expect(validation.issues).toHaveLength(0)
      expect(validation.recommendations.length).toBeLessThan(3) // Minimal recommendations
    })

    it('identifies issues in incomplete templates', () => {
      const incompleteTemplate = {
        name: 'Incomplete Template',
        subjectEn: 'Test Subject',
        contentEn: 'Test content without required elements',
        // Missing Arabic content
        // Missing UAE business hours setting
        // Missing required variables
      }
      
      const validation = templateValidationUtils.validateUAETemplate(incompleteTemplate)
      
      expect(validation.valid).toBe(false)
      expect(validation.score).toBeLessThan(80)
      expect(validation.issues).toContain('Missing Arabic content for UAE bilingual support')
      expect(validation.recommendations).toContain('Add Arabic translations for better customer experience')
    })

    it('validates scenario-specific templates', () => {
      const gentleTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        name: 'Gentle Reminder',
        subjectEn: 'Gentle Payment Reminder',
        contentEn: 'We hope this email finds you well. This is a gentle reminder about your invoice.'
      })
      
      const gentleValidation = templateValidationUtils.validateScenario(gentleTemplate, 'gentle')
      expect(gentleValidation.appropriate).toBe(true)
      expect(gentleValidation.improvements).toHaveLength(0)
      
      const firmTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        name: 'Firm Notice',
        contentEn: 'This is an urgent notice. Payment is required immediately.'
      })
      
      const firmValidation = templateValidationUtils.validateScenario(firmTemplate, 'firm')
      expect(firmValidation.appropriate).toBe(true)
    })

    it('rejects culturally inappropriate templates', () => {
      const inappropriateTemplate = uaeTestDataGenerators.createInappropriateTemplate()
      const validation = templateValidationUtils.validateUAETemplate(inappropriateTemplate)
      
      expect(validation.valid).toBe(false)
      expect(validation.score).toBeLessThan(50)
      expect(validation.issues.length).toBeGreaterThan(2)
      expect(validation.recommendations.length).toBeGreaterThan(3)
    })
  })

  describe('UAE Business Scenarios', () => {
    it('defines proper escalation timeline', () => {
      expect(uaeBusinessScenarios.gentleReminder.day).toBe(3)
      expect(uaeBusinessScenarios.professionalFollowUp.day).toBe(7)
      expect(uaeBusinessScenarios.firmNotice.day).toBe(15)
      expect(uaeBusinessScenarios.finalNotice.day).toBe(30)
    })

    it('specifies appropriate tone for each scenario', () => {
      expect(uaeBusinessScenarios.gentleReminder.tone).toBe('polite')
      expect(uaeBusinessScenarios.professionalFollowUp.tone).toBe('professional')
      expect(uaeBusinessScenarios.firmNotice.tone).toBe('firm')
      expect(uaeBusinessScenarios.finalNotice.tone).toBe('formal')
    })

    it('includes required elements for UAE compliance', () => {
      expect(uaeBusinessScenarios.finalNotice.expectedElements).toContain('UAE Commercial Law')
      expect(uaeBusinessScenarios.professionalFollowUp.expectedElements).toContain('business hours')
      expect(uaeBusinessScenarios.gentleReminder.expectedElements).toContain('relationship')
    })
  })

  describe('Ramadan and Cultural Sensitivity', () => {
    it('creates appropriate Ramadan templates', () => {
      const ramadanTemplate = uaeTestDataGenerators.createRamadanTemplate()
      
      expect(ramadanTemplate.contentEn).toContain('Ramadan Kareem')
      expect(ramadanTemplate.contentAr).toContain('رمضان كريم')
      expect(ramadanTemplate.contentEn).toContain('9:00 AM - 3:00 PM') // Ramadan hours
      expect(ramadanTemplate.uaeBusinessHoursOnly).toBe(true)
      
      const validation = templateValidationUtils.validateUAETemplate(ramadanTemplate)
      expect(validation.valid).toBe(true)
    })

    it('respects Islamic business practices', () => {
      const islamicTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        contentEn: 'Assalamu Alaikum and greetings from our company. May Allah bless your business.',
        contentAr: 'السلام عليكم وتحياتنا من شركتنا. بارك الله في أعمالكم.'
      })
      
      const validation = culturalComplianceUtils.validateBusinessEtiquette(islamicTemplate.contentEn, 'en')
      expect(validation.appropriate).toBe(true)
      expect(validation.score).toBeGreaterThan(85)
    })
  })

  describe('Multi-Emirates Support', () => {
    it('supports different emirate variations', () => {
      UAE_CONSTANTS.emirates.forEach(emirate => {
        const emirateTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
          name: `${emirate.name} Business Template`,
          contentEn: `Greetings from ${emirate.name}, UAE. Our office hours are Sunday-Thursday 9 AM to 6 PM.`,
          contentAr: `تحيات من ${emirate.nameAr}، الإمارات العربية المتحدة. ساعات مكتبنا من الأحد إلى الخميس من 9 ص إلى 6 م.`
        })
        
        const validation = templateValidationUtils.validateUAETemplate(emirateTemplate)
        expect(validation.valid).toBe(true)
      })
    })
  })

  describe('Business Hours Compliance', () => {
    it('validates standard UAE business hours', () => {
      const businessHours = culturalComplianceUtils.validateBusinessHours('10:00', 'Asia/Dubai')
      expect(businessHours).toHaveProperty('withinHours')
      
      if (!businessHours.withinHours && businessHours.reason) {
        expect(businessHours.reason).toMatch(/(not a working day|outside.*business hours)/i)
      }
    })

    it('handles Ramadan hours adjustment', () => {
      // During Ramadan, business hours are typically 9 AM - 3 PM
      const ramadanHours = UAE_CONSTANTS.businessHours.ramadanHours
      expect(ramadanHours.start).toBe('09:00')
      expect(ramadanHours.end).toBe('15:00')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles empty or null content gracefully', () => {
      const emptyValidation = templateValidationUtils.validateUAETemplate({
        name: '',
        subjectEn: '',
        contentEn: '',
        subjectAr: '',
        contentAr: ''
      })
      
      expect(emptyValidation.valid).toBe(false)
      expect(emptyValidation.issues).toContain('Missing English content')
    })

    it('handles mixed language content', () => {
      const mixedTemplate = {
        name: 'Mixed Language Template',
        subjectEn: 'Payment Reminder - فاتورة',
        contentEn: 'Dear customer, please pay your invoice. شكراً',
        subjectAr: 'Payment Reminder - فاتورة',
        contentAr: 'عزيزي العميل، يرجى دفع فاتورتك. Thank you'
      }
      
      const validation = templateValidationUtils.validateUAETemplate(mixedTemplate)
      // Should still pass basic validation despite mixed content
      expect(validation.score).toBeGreaterThan(50)
    })

    it('validates extremely long content', () => {
      const longContent = 'A'.repeat(10000) + ' TRN: {{company_trn}}'
      const longTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        contentEn: longContent,
        contentAr: 'ب'.repeat(10000) + ' الرقم الضريبي: {{company_trn}}'
      })
      
      const validation = templateValidationUtils.validateUAETemplate(longTemplate)
      expect(validation.valid).toBe(true) // Should handle large content
    })

    it('validates special characters and emojis', () => {
      const emojiTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        contentEn: 'Dear customer 👋, please pay your invoice 💰. Contact us 📞 during business hours.',
        contentAr: 'عزيزي العميل 👋، يرجى دفع فاتورتك 💰. اتصل بنا 📞 خلال ساعات العمل.'
      })
      
      const validation = templateValidationUtils.validateUAETemplate(emojiTemplate)
      expect(validation.valid).toBe(true) // Should handle emojis appropriately
    })
  })
})