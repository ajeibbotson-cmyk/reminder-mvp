/**
 * Bilingual Template Validation Test Suite
 * Comprehensive testing for Arabic/English template support in UAE automation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  CulturalComplianceService,
  culturalCompliance,
  TemplateContentAnalysis
} from '../cultural-compliance-service'

describe('Bilingual Template Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Arabic Language Detection and Processing', () => {
    it('should accurately detect pure Arabic content', () => {
      const arabicText = 'عزيزي العميل، نتمنى أن تكون بخير وصحة جيدة. هذا تذكير لطيف بخصوص الفاتورة رقم'

      const detection = CulturalComplianceService.detectArabicLanguage(arabicText)

      expect(detection.hasArabic).toBe(true)
      expect(detection.arabicPercentage).toBeGreaterThan(90)
      expect(detection.isRTL).toBe(true)
      expect(detection.requiresRTLLayout).toBe(true)
      expect(detection.mixedLanguage).toBe(false)
      expect(detection.arabicWords.length).toBeGreaterThan(5)
    })

    it('should detect mixed Arabic-English content', () => {
      const mixedText = 'Dear العميل الكريم, your فاتورة number INV-2024-001 for مبلغ 5000 AED is مستحقة الدفع'

      const detection = CulturalComplianceService.detectArabicLanguage(mixedText)

      expect(detection.hasArabic).toBe(true)
      expect(detection.mixedLanguage).toBe(true)
      expect(detection.arabicWords).toContain('العميل')
      expect(detection.arabicWords).toContain('فاتورة')
      expect(detection.arabicWords).toContain('مبلغ')
      expect(detection.arabicWords).toContain('مستحقة')
      expect(detection.arabicWords).toContain('الدفع')
    })

    it('should handle Arabic numerals and punctuation correctly', () => {
      const arabicWithNumbers = 'فاتورة رقم ١٢٣٤٥ بتاريخ ٢٠٢٤/٠١/١٥ بمبلغ ٥٬٠٠٠ درهم'

      const detection = CulturalComplianceService.detectArabicLanguage(arabicWithNumbers)

      expect(detection.hasArabic).toBe(true)
      expect(detection.arabicPercentage).toBeGreaterThan(70)
      expect(detection.arabicWords).toContain('فاتورة')
      expect(detection.arabicWords).toContain('بتاريخ')
      expect(detection.arabicWords).toContain('بمبلغ')
      expect(detection.arabicWords).toContain('درهم')
    })

    it('should identify different Arabic script variants', () => {
      const variants = [
        'السلام عليكم ورحمة الله وبركاته',  // Standard Arabic
        'مرحبا بك في شركتنا',                 // Simplified Arabic
        'فاتورة ضريبية رقم ١٠٠١',            // Arabic with numbers
        'الإمارات العربية المتحدة',           // Country name in Arabic
        'وزارة المالية',                     // Government entity
        'مؤسسة الإمارات للاتصالات'             // Corporate name
      ]

      variants.forEach(text => {
        const detection = CulturalComplianceService.detectArabicLanguage(text)
        expect(detection.hasArabic).toBe(true)
        expect(detection.arabicWords.length).toBeGreaterThan(0)
      })
    })

    it('should handle special Arabic characters and diacritics', () => {
      const textWithDiacritics = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'
      const textWithHamza = 'إِنَّ هَٰذَا لَهُوَ الْقَصَصُ الْحَقُّ'
      const textWithTaMarbouta = 'شركة الإمارات للطيران'

      const texts = [textWithDiacritics, textWithHamza, textWithTaMarbouta]

      texts.forEach(text => {
        const detection = CulturalComplianceService.detectArabicLanguage(text)
        expect(detection.hasArabic).toBe(true)
        expect(detection.arabicPercentage).toBeGreaterThan(80)
      })
    })
  })

  describe('Arabic Template Content Validation', () => {
    it('should validate pure Arabic email templates', () => {
      const arabicTemplate = {
        contentAr: 'عزيزي العميل الكريم،\\n\\nالسلام عليكم ورحمة الله وبركاته\\n\\nنتمنى أن تكون بأفضل حال. هذا تذكير لطيف بخصوص الفاتورة رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} {{currency}}.\\n\\nنقدر تعاونكم في تسوية هذا المبلغ في أقرب وقت ممكن.\\n\\nبارك الله فيكم\\n\\nمع خالص التقدير\\nفريق المحاسبة - {{companyName}}',
        subjectAr: 'تذكير: فاتورة رقم {{invoiceNumber}} - {{customerName}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(arabicTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.culturalCompliance).toBeGreaterThan(80)
      expect(analysis.languageAppropriate).toBe(true)
      expect(analysis.respectfulTone).toBe(true)
    })

    it('should validate bilingual Arabic-English templates', () => {
      const bilingualTemplate = {
        contentEn: 'Dear Valued Customer {{customerName}},\\n\\nAs-salamu alaykum and greetings! We hope this email finds you in good health.\\n\\nThis is a gentle reminder regarding Invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}}.\\n\\nWe would appreciate your kind attention to this matter.\\n\\nJazakAllahu khair for your cooperation.\\n\\nBest regards,\\n{{companyName}} Team',
        contentAr: 'عزيزي العميل {{customerName}}،\\n\\nالسلام عليكم ورحمة الله وبركاته\\n\\nنتمنى أن تكون بأفضل حال. هذا تذكير لطيف بخصوص الفاتورة رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} {{currency}}.\\n\\nنقدر تعاونكم في هذا الأمر.\\n\\nجزاكم الله خيراً\\n\\nمع خالص التقدير\\nفريق {{companyName}}',
        subjectEn: 'Gentle Reminder: Invoice {{invoiceNumber}} - {{customerName}}',
        subjectAr: 'تذكير لطيف: فاتورة {{invoiceNumber}} - {{customerName}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(bilingualTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.languageAppropriate).toBe(true)
      expect(analysis.businessAppropriate).toBe(true)

      // Should detect both languages
      const englishDetection = CulturalComplianceService.detectArabicLanguage(bilingualTemplate.contentEn)
      const arabicDetection = CulturalComplianceService.detectArabicLanguage(bilingualTemplate.contentAr)

      expect(englishDetection.hasArabic).toBe(true) // Contains Islamic phrases
      expect(arabicDetection.hasArabic).toBe(true)
      expect(arabicDetection.arabicPercentage).toBeGreaterThan(80)
    })

    it('should identify inappropriate Arabic content', () => {
      const inappropriateArabicTemplate = {
        contentAr: 'يجب عليك دفع الفاتورة فوراً! هذا أمر عاجل ولا يمكن تأجيله. إذا لم تدفع سنتخذ إجراءات قانونية ضدك!',
        subjectAr: 'عاجل: ادفع الآن أو واجه العواقب!'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(inappropriateArabicTemplate)

      expect(analysis.isValid).toBe(false)
      expect(analysis.respectfulTone).toBe(false)
      expect(analysis.issues.length).toBeGreaterThan(0)
      expect(analysis.improvements.length).toBeGreaterThan(0)
    })

    it('should validate Arabic business terminology', () => {
      const businessArabicTemplate = {
        contentAr: 'الموضوع: فاتورة ضريبية\\nرقم التسجيل الضريبي: {{companyTRN}}\\nالعميل المحترم: {{customerName}}\\nالمبلغ المستحق: {{invoiceAmount}} درهم إماراتي\\nتاريخ الاستحقاق: {{dueDate}}\\n\\nنشكركم على ثقتكم بخدماتنا\\nالشركة: {{companyName}}\\nدولة الإمارات العربية المتحدة',
        subjectAr: 'فاتورة ضريبية رقم {{invoiceNumber}} - {{companyName}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(businessArabicTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.businessAppropriate).toBe(true)

      // Should contain proper Arabic business terms
      expect(businessArabicTemplate.contentAr).toContain('فاتورة ضريبية')
      expect(businessArabicTemplate.contentAr).toContain('رقم التسجيل الضريبي')
      expect(businessArabicTemplate.contentAr).toContain('درهم إماراتي')
      expect(businessArabicTemplate.contentAr).toContain('الإمارات العربية المتحدة')
    })
  })

  describe('RTL Layout and Formatting Support', () => {
    it('should identify content requiring RTL layout', () => {
      const testCases = [
        {
          text: 'مرحباً بكم في شركة الإمارات',
          expectedRTL: true,
          description: 'Pure Arabic text'
        },
        {
          text: 'Hello مرحباً mixed content',
          expectedRTL: false,
          description: 'Mixed content with more English'
        },
        {
          text: 'عزيزي العميل الكريم، نتمنى أن تكون بخير. هذا تذكير بخصوص Hello',
          expectedRTL: true,
          description: 'Predominantly Arabic with some English'
        },
        {
          text: 'Invoice #123 for فاتورة العميل',
          expectedRTL: false,
          description: 'Predominantly English with some Arabic'
        }
      ]

      testCases.forEach(testCase => {
        const detection = CulturalComplianceService.detectArabicLanguage(testCase.text)
        expect(detection.requiresRTLLayout).toBe(testCase.expectedRTL)
      })
    })

    it('should handle Arabic numerals vs Western numerals', () => {
      const arabicNumerals = 'فاتورة رقم ١٢٣٤٥ بمبلغ ٥٬٠٠٠ درهم'
      const westernNumerals = 'فاتورة رقم 12345 بمبلغ 5,000 درهم'
      const mixedNumerals = 'فاتورة رقم ١٢٣ / Invoice #123 بمبلغ ٥٬٠٠٠ / Amount 5,000 درهم'

      const detections = [arabicNumerals, westernNumerals, mixedNumerals].map(text =>
        CulturalComplianceService.detectArabicLanguage(text)
      )

      detections.forEach(detection => {
        expect(detection.hasArabic).toBe(true)
        expect(detection.arabicWords.length).toBeGreaterThan(2)
      })
    })

    it('should identify bidirectional text handling requirements', () => {
      const bidiTexts = [
        'Customer Name: أحمد الراشد',
        'Invoice #123 للعميل المحترم',
        'Amount: 5,000 درهم إماراتي AED',
        'Due Date: ٢٠٢٤/١٢/٣١ تاريخ الاستحقاق',
        'Company: شركة الإمارات للطيران Emirates Airlines'
      ]

      bidiTexts.forEach(text => {
        const detection = CulturalComplianceService.detectArabicLanguage(text)
        expect(detection.mixedLanguage).toBe(true)
        expect(detection.hasArabic).toBe(true)
      })
    })
  })

  describe('Template Variable Processing in Arabic', () => {
    it('should properly handle Arabic template variables', () => {
      const arabicTemplateWithVariables = {
        contentAr: 'عزيزي العميل {{customerName}}،\\n\\nالفاتورة: {{invoiceNumber}}\\nالمبلغ: {{invoiceAmount}} {{currency}}\\nتاريخ الاستحقاق: {{dueDate}}\\nاسم الشركة: {{companyName}}\\n\\nشكراً لتعاونكم',
        subjectAr: 'فاتورة {{invoiceNumber}} للعميل {{customerName}}'
      }

      // Mock invoice data in Arabic context
      const mockArabicInvoiceData = {
        customerName: 'أحمد محمد الراشد',
        invoiceNumber: 'INV-2024-001',
        invoiceAmount: '٥٬٥٠٠',
        currency: 'درهم إماراتي',
        dueDate: '٢٠٢٤/١٢/٣١',
        companyName: 'شركة الإمارات التجارية ذ.م.م'
      }

      // Simulate variable replacement
      let processedContent = arabicTemplateWithVariables.contentAr
      Object.entries(mockArabicInvoiceData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value)
      })

      expect(processedContent).toContain('أحمد محمد الراشد')
      expect(processedContent).toContain('INV-2024-001')
      expect(processedContent).toContain('٥٬٥٠٠')
      expect(processedContent).toContain('درهم إماراتي')
      expect(processedContent).toContain('شركة الإمارات التجارية ذ.م.م')
      expect(processedContent).not.toContain('{{')
    })

    it('should validate mixed-script template variables', () => {
      const mixedTemplate = {
        contentEn: 'Dear {{customerNameAr}} / {{customerNameEn}},\\n\\nInvoice: {{invoiceNumber}}\\nAmount: {{invoiceAmount}} {{currencyAr}} / {{currencyEn}}',
        contentAr: 'عزيزي {{customerNameAr}}،\\n\\nفاتورة: {{invoiceNumber}}\\nالمبلغ: {{invoiceAmount}} {{currencyAr}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(mixedTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.businessAppropriate).toBe(true)

      // Should detect template variables in both versions
      const englishVars = (mixedTemplate.contentEn.match(/\{\{[^}]+\}\}/g) || []).length
      const arabicVars = (mixedTemplate.contentAr.match(/\{\{[^}]+\}\}/g) || []).length

      expect(englishVars).toBeGreaterThan(0)
      expect(arabicVars).toBeGreaterThan(0)
    })
  })

  describe('Cultural Context in Bilingual Templates', () => {
    it('should validate Islamic greetings in both languages', () => {
      const islamicBilingualTemplate = {
        contentEn: 'As-salamu alaykum wa rahmatullahi wa barakatuh, Dear {{customerName}},\\n\\nMay Allah bless you and your family.\\n\\nThis is regarding Invoice {{invoiceNumber}}.\\n\\nJazakAllahu khair for your attention.\\n\\nBarakallahu feeki,\\n{{companyName}}',
        contentAr: 'السلام عليكم ورحمة الله وبركاته، عزيزي {{customerName}}\\n\\nأسأل الله أن يبارك فيكم وفي عائلتكم الكريمة.\\n\\nهذا بخصوص الفاتورة رقم {{invoiceNumber}}.\\n\\nجزاكم الله خيراً على اهتمامكم.\\n\\nبارك الله فيكم\\n{{companyName}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(islamicBilingualTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.respectfulTone).toBe(true)

      // Should have high cultural score due to Islamic phrases
      const englishScore = CulturalComplianceService.calculateCulturalScore(islamicBilingualTemplate.contentEn)
      const arabicScore = CulturalComplianceService.calculateCulturalScore(islamicBilingualTemplate.contentAr, { language: 'ar' })

      expect(englishScore.score).toBeGreaterThan(85)
      expect(arabicScore.score).toBeGreaterThan(85)
      expect(englishScore.breakdown.islamicEtiquette).toBeGreaterThan(100) // Bonus points
      expect(arabicScore.breakdown.islamicEtiquette).toBeGreaterThan(100)
    })

    it('should validate Ramadan-specific bilingual content', () => {
      const ramadanTemplate = {
        contentEn: 'Ramadan Mubarak, {{customerName}}!\\n\\nWe hope this blessed month brings you peace and prosperity.\\n\\nRegarding Invoice {{invoiceNumber}}, we kindly request your attention when convenient.\\n\\nMay Allah accept your fasting and prayers.\\n\\nRamadan Kareem,\\n{{companyName}}',
        contentAr: 'رمضان مبارك، {{customerName}}!\\n\\nنتمنى أن يكون هذا الشهر الكريم مباركاً عليكم.\\n\\nبخصوص الفاتورة {{invoiceNumber}}، نرجو التكرم بالنظر فيها عند المناسبة.\\n\\nتقبل الله صيامكم وقيامكم.\\n\\nرمضان كريم\\n{{companyName}}'
      }

      const context = {
        isRamadan: true,
        language: 'mixed' as const,
        customerRelationship: 'REGULAR' as const
      }

      const englishScore = CulturalComplianceService.calculateCulturalScore(ramadanTemplate.contentEn, context)
      const arabicScore = CulturalComplianceService.calculateCulturalScore(ramadanTemplate.contentAr, { ...context, language: 'ar' })

      expect(englishScore.score).toBeGreaterThan(90)
      expect(arabicScore.score).toBeGreaterThan(90)
      expect(englishScore.breakdown.culturalSensitivity).toBeGreaterThan(85)
      expect(arabicScore.breakdown.culturalSensitivity).toBeGreaterThan(85)
    })

    it('should validate formal government communication in Arabic', () => {
      const governmentArabicTemplate = {
        contentAr: 'المحترمون / {{customerName}}\\n\\nتحية طيبة وبعد،\\n\\nيشرفنا أن نوجه لسيادتكم هذا الخطاب بخصوص الفاتورة الضريبية رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} درهم إماراتي.\\n\\nنرجو من سيادتكم التكرم بتسوية المبلغ المذكور في أقرب وقت ممكن.\\n\\nونشكر لكم حسن تعاونكم المستمر معنا.\\n\\nوتفضلوا بقبول فائق الاحترام والتقدير\\n\\n{{companyName}}\\nدولة الإمارات العربية المتحدة',
        subjectAr: 'فاتورة ضريبية - {{customerName}} - {{invoiceNumber}}'
      }

      const analysis = CulturalComplianceService.validateTemplateContent(governmentArabicTemplate)

      expect(analysis.isValid).toBe(true)
      expect(analysis.respectfulTone).toBe(true)
      expect(analysis.businessAppropriate).toBe(true)

      // Should contain formal Arabic expressions
      expect(governmentArabicTemplate.contentAr).toContain('المحترمون')
      expect(governmentArabicTemplate.contentAr).toContain('تحية طيبة وبعد')
      expect(governmentArabicTemplate.contentAr).toContain('يشرفنا')
      expect(governmentArabicTemplate.contentAr).toContain('سيادتكم')
      expect(governmentArabicTemplate.contentAr).toContain('فائق الاحترام والتقدير')
    })
  })

  describe('Performance with Bilingual Content', () => {
    it('should efficiently process large bilingual templates', () => {
      const startTime = Date.now()

      // Create large bilingual template
      const largeTemplate = {
        contentEn: 'Dear Valued Customer, '.repeat(100) + 'Invoice details follow...',
        contentAr: 'عزيزي العميل الكريم، '.repeat(100) + 'تفاصيل الفاتورة كما يلي...'
      }

      for (let i = 0; i < 100; i++) {
        CulturalComplianceService.validateTemplateContent(largeTemplate)
        CulturalComplianceService.detectArabicLanguage(largeTemplate.contentAr)
      }

      const endTime = Date.now()
      const processingTime = endTime - startTime

      expect(processingTime).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should handle concurrent bilingual validations', async () => {
      const templates = Array.from({ length: 50 }, (_, i) => ({
        contentEn: `Template ${i}: Dear customer, please review invoice.`,
        contentAr: `قالب ${i}: عزيزي العميل، يرجى مراجعة الفاتورة.`
      }))

      const startTime = Date.now()

      const promises = templates.map(template =>
        Promise.resolve(CulturalComplianceService.validateTemplateContent(template))
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()

      const processingTime = endTime - startTime

      expect(results.length).toBe(50)
      expect(results.every(r => r.isValid)).toBe(true)
      expect(processingTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('Error Handling in Bilingual Context', () => {
    it('should handle corrupted Arabic text gracefully', () => {
      const corruptedTemplate = {
        contentAr: 'عزيزي العميل \uFFFD\uFFFD\uFFFD مرحباً \uFFFD', // Contains replacement characters
        subjectAr: 'فاتورة \uFFFD\uFFFD'
      }

      expect(() => {
        const analysis = CulturalComplianceService.validateTemplateContent(corruptedTemplate)
        expect(analysis).toBeDefined()
      }).not.toThrow()
    })

    it('should handle empty bilingual templates', () => {
      const emptyTemplate = {
        contentEn: '',
        contentAr: '',
        subjectEn: '',
        subjectAr: ''
      }

      const analysis = CulturalComplianceService.validateTemplateContent(emptyTemplate)

      expect(analysis.isValid).toBe(false)
      expect(analysis.issues.length).toBeGreaterThan(0)
    })

    it('should handle mixed encoding issues', () => {
      const mixedEncodingTemplate = {
        contentEn: 'Dear Customer أحمد', // Arabic name in English template
        contentAr: 'عزيزي Ahmed العميل' // English name in Arabic template
      }

      const analysis = CulturalComplianceService.validateTemplateContent(mixedEncodingTemplate)

      expect(analysis).toBeDefined()
      expect(analysis.languageAppropriate).toBeDefined()
    })
  })

  describe('Accessibility in Bilingual Templates', () => {
    it('should provide language direction metadata', () => {
      const bilingualTexts = [
        'This is English text with بعض النص العربي mixed in',
        'هذا نص عربي with some English text مختلط',
        'Pure English text only',
        'نص عربي خالص فقط'
      ]

      bilingualTexts.forEach(text => {
        const detection = CulturalComplianceService.detectArabicLanguage(text)

        expect(detection).toHaveProperty('isRTL')
        expect(detection).toHaveProperty('requiresRTLLayout')
        expect(detection).toHaveProperty('mixedLanguage')

        // Should provide clear guidance for layout
        expect(typeof detection.isRTL).toBe('boolean')
        expect(typeof detection.requiresRTLLayout).toBe('boolean')
        expect(typeof detection.mixedLanguage).toBe('boolean')
      })
    })

    it('should identify screen reader considerations for Arabic', () => {
      const arabicText = 'مبلغ ٥٬٠٠٠ درهم إماراتي في تاريخ ٢٠٢٤/١٢/٣١'

      const detection = CulturalComplianceService.detectArabicLanguage(arabicText)

      // Arabic content requires special screen reader considerations
      expect(detection.hasArabic).toBe(true)
      expect(detection.arabicWords.length).toBeGreaterThan(0)

      // Should contain Arabic numerals that need special handling
      expect(arabicText).toMatch(/[٠-٩]/) // Arabic-Indic digits
    })
  })
})