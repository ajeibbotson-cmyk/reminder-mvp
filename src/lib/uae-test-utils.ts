import { testHelpers } from './test-utils'

// UAE-specific constants for testing
export const UAE_CONSTANTS = {
  // Business hours (UAE timezone: UTC+4)
  businessHours: {
    timezone: 'Asia/Dubai',
    workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    startTime: '09:00',
    endTime: '18:00',
    lunchBreak: { start: '12:00', end: '13:00' },
    ramadanHours: { start: '09:00', end: '15:00' } // Special hours during Ramadan
  },

  // UAE currency and financial formats
  currency: {
    code: 'AED',
    symbol: 'د.إ',
    position: 'before', // AED 100 or د.إ 100
    decimalPlaces: 2
  },

  // VAT information
  vat: {
    standardRate: 5.0,
    zeroRated: 0.0,
    exempt: null,
    registrationThreshold: 375000 // AED
  },

  // TRN (Tax Registration Number) format
  trn: {
    format: /^\d{15}$/, // 15 digits
    example: '100123456789012'
  },

  // UAE phone number formats
  phoneFormats: {
    mobile: /^\+971[0-9]{8,9}$/,
    landline: /^\+971[2-9][0-9]{6,7}$/,
    examples: ['+971501234567', '+971043334444']
  },

  // Emirate codes and regions
  emirates: [
    { code: 'AD', name: 'Abu Dhabi', nameAr: 'أبوظبي' },
    { code: 'DU', name: 'Dubai', nameAr: 'دبي' },
    { code: 'SH', name: 'Sharjah', nameAr: 'الشارقة' },
    { code: 'AJ', name: 'Ajman', nameAr: 'عجمان' },
    { code: 'UQ', name: 'Umm Al Quwain', nameAr: 'أم القيوين' },
    { code: 'RK', name: 'Ras Al Khaimah', nameAr: 'رأس الخيمة' },
    { code: 'FU', name: 'Fujairah', nameAr: 'الفجيرة' }
  ]
}

// Arabic language testing utilities
export const arabicTestUtils = {
  // Check if text contains Arabic characters
  hasArabicText: (text: string): boolean => {
    const arabicRegex = /[\u0600-\u06FF]/
    return arabicRegex.test(text)
  },

  // Check RTL (Right-to-Left) text direction
  isRTL: (text: string): boolean => {
    const rtlChars = /[\u0590-\u083F]|[\u08A0-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/mg
    const ltrChars = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF]/mg
    
    const rtlCount = (text.match(rtlChars) || []).length
    const ltrCount = (text.match(ltrChars) || []).length
    
    return rtlCount > ltrCount
  },

  // Common Arabic business phrases
  businessPhrases: {
    greetings: [
      'أهلاً وسهلاً', // Welcome
      'السلام عليكم', // Peace be upon you
      'صباح الخير', // Good morning
      'مساء الخير', // Good evening
      'عزيزي/عزيزتي' // Dear
    ],
    closings: [
      'أطيب التحيات', // Best regards
      'مع فائق الاحترام', // With highest respect
      'شكراً لتعاونكم', // Thank you for your cooperation
      'في أمان الله' // May God protect you
    ],
    businessTerms: [
      'فاتورة', // Invoice
      'دفع', // Payment
      'مبلغ', // Amount
      'تاريخ الاستحقاق', // Due date
      'الرقم الضريبي', // Tax number
      'شركة', // Company
      'عميل', // Customer
      'خدمة', // Service
      'منتج' // Product
    ]
  },

  // Validate Arabic business content
  validateArabicBusinessContent: (content: string): { valid: boolean; issues: string[] } => {
    const issues: string[] = []
    
    if (!arabicTestUtils.hasArabicText(content)) {
      issues.push('No Arabic text found')
      return { valid: false, issues }
    }

    // Check for required business terms in Arabic
    const requiredTerms = ['الرقم الضريبي', 'شركة', 'فاتورة']
    const missingTerms = requiredTerms.filter(term => !content.includes(term))
    
    if (missingTerms.length > 0) {
      issues.push(`Missing Arabic business terms: ${missingTerms.join(', ')}`)
    }

    return { valid: issues.length === 0, issues }
  }
}

// UAE business etiquette and cultural compliance
export const culturalComplianceUtils = {
  // Check for culturally appropriate language
  validateBusinessEtiquette: (content: string, language: 'en' | 'ar' = 'en'): { 
    appropriate: boolean; 
    score: number; 
    recommendations: string[] 
  } => {
    const recommendations: string[] = []
    let score = 100

    if (language === 'en') {
      // Check for appropriate English greetings
      const appropriateGreetings = ['Dear', 'Respected', 'Esteemed']
      const inappropriateGreetings = ['Hey', 'Yo', 'Hi there']
      
      const hasAppropriateGreeting = appropriateGreetings.some(greeting => 
        content.toLowerCase().includes(greeting.toLowerCase())
      )
      const hasInappropriateGreeting = inappropriateGreetings.some(greeting => 
        content.toLowerCase().includes(greeting.toLowerCase())
      )

      if (hasInappropriateGreeting) {
        score -= 20
        recommendations.push('Use formal greetings like "Dear" or "Respected"')
      } else if (!hasAppropriateGreeting) {
        score -= 10
        recommendations.push('Consider adding a formal greeting')
      }

      // Check for respectful closing
      const appropriateClosings = ['Best regards', 'Sincerely', 'With respect']
      const hasAppropriateClosing = appropriateClosings.some(closing => 
        content.toLowerCase().includes(closing.toLowerCase())
      )

      if (!hasAppropriateClosing) {
        score -= 10
        recommendations.push('Add a professional closing like "Best regards"')
      }

      // Check for aggressive language
      const aggressivePatterns = [
        /pay\s+now!!!/i,
        /urgent!!!/i,
        /immediately!!!/i,
        /must\s+pay/i
      ]
      
      const hasAggressiveLanguage = aggressivePatterns.some(pattern => pattern.test(content))
      if (hasAggressiveLanguage) {
        score -= 30
        recommendations.push('Soften aggressive language for UAE business culture')
      }
    } else {
      // Arabic content validation
      const { valid, issues } = arabicTestUtils.validateArabicBusinessContent(content)
      if (!valid) {
        score -= 20
        recommendations.push(...issues)
      }
    }

    // Check for UAE-specific requirements
    if (!content.includes('TRN') && !content.includes('الرقم الضريبي')) {
      score -= 15
      recommendations.push('Include TRN reference for UAE compliance')
    }

    if (!content.toLowerCase().includes('business hours') && !content.includes('ساعات العمل')) {
      score -= 10
      recommendations.push('Mention UAE business hours for clarity')
    }

    return {
      appropriate: score >= 70,
      score: Math.max(0, score),
      recommendations
    }
  },

  // Validate business hours compliance
  validateBusinessHours: (sendTime: string, timezone: string = 'Asia/Dubai'): {
    withinHours: boolean;
    adjustedTime?: string;
    reason?: string;
  } => {
    const now = new Date()
    const dubaiTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }).format(now)

    const currentHour = parseInt(dubaiTime.split(':')[0])
    const dayOfWeek = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      timeZone: timezone 
    }).toLowerCase()

    const workingDays = UAE_CONSTANTS.businessHours.workingDays
    const startHour = parseInt(UAE_CONSTANTS.businessHours.startTime.split(':')[0])
    const endHour = parseInt(UAE_CONSTANTS.businessHours.endTime.split(':')[0])

    if (!workingDays.includes(dayOfWeek)) {
      return {
        withinHours: false,
        reason: `${dayOfWeek} is not a working day in UAE`,
        adjustedTime: 'Sunday 09:00'
      }
    }

    if (currentHour < startHour || currentHour >= endHour) {
      return {
        withinHours: false,
        reason: `${dubaiTime} is outside UAE business hours (09:00-18:00)`,
        adjustedTime: '09:00'
      }
    }

    return { withinHours: true }
  }
}

// UAE-specific template validation
export const templateValidationUtils = {
  // Validate template for UAE market
  validateUAETemplate: (template: any): {
    valid: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
  } => {
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    // Check required fields
    if (!template.subjectEn || !template.contentEn) {
      issues.push('Missing English content')
      score -= 25
    }

    if (!template.subjectAr || !template.contentAr) {
      issues.push('Missing Arabic content for UAE bilingual support')
      score -= 20
      recommendations.push('Add Arabic translations for better customer experience')
    }

    // Validate English content
    if (template.contentEn) {
      const englishValidation = culturalComplianceUtils.validateBusinessEtiquette(
        template.contentEn, 'en'
      )
      if (!englishValidation.appropriate) {
        score -= 20
        issues.push('English content needs cultural refinement')
        recommendations.push(...englishValidation.recommendations)
      }
    }

    // Validate Arabic content
    if (template.contentAr) {
      const arabicValidation = culturalComplianceUtils.validateBusinessEtiquette(
        template.contentAr, 'ar'
      )
      if (!arabicValidation.appropriate) {
        score -= 15
        issues.push('Arabic content needs improvement')
        recommendations.push(...arabicValidation.recommendations)
      }
    }

    // Check for UAE business hours setting
    if (!template.uaeBusinessHoursOnly) {
      score -= 10
      recommendations.push('Enable UAE business hours only for better customer experience')
    }

    // Validate template variables
    const requiredVariables = ['customer_name', 'company_trn']
    const englishVariables = testHelpers.validateTemplateVariables(template.contentEn || '')
    const missingVariables = requiredVariables.filter(variable => 
      !englishVariables.includes(variable)
    )

    if (missingVariables.length > 0) {
      score -= 15
      issues.push(`Missing required variables: ${missingVariables.join(', ')}`)
    }

    return {
      valid: issues.length === 0,
      score: Math.max(0, score),
      issues,
      recommendations
    }
  },

  // Check template for specific UAE business scenarios
  validateScenario: (template: any, scenario: 'gentle' | 'professional' | 'firm' | 'final'): {
    appropriate: boolean;
    improvements: string[];
  } => {
    const improvements: string[] = []
    let appropriate = true

    const content = (template.contentEn || '').toLowerCase()

    switch (scenario) {
      case 'gentle':
        if (!content.includes('gentle') && !content.includes('reminder')) {
          improvements.push('Use gentler language like "gentle reminder"')
          appropriate = false
        }
        if (content.includes('urgent') || content.includes('immediate')) {
          improvements.push('Remove urgent language for gentle reminders')
          appropriate = false
        }
        break

      case 'professional':
        if (!content.includes('follow') && !content.includes('payment')) {
          improvements.push('Include professional follow-up language')
          appropriate = false
        }
        break

      case 'firm':
        if (!content.includes('notice') && !content.includes('required')) {
          improvements.push('Use firm but respectful language')
          appropriate = false
        }
        break

      case 'final':
        if (!content.includes('final') && !content.includes('last')) {
          improvements.push('Clearly indicate this is a final notice')
          appropriate = false
        }
        if (!content.includes('legal') && !content.includes('collection')) {
          improvements.push('Mention potential consequences as per UAE law')
          appropriate = false
        }
        break
    }

    return { appropriate, improvements }
  }
}

// Test data generators for UAE-specific scenarios
export const uaeTestDataGenerators = {
  // Generate UAE business template
  createUAEBusinessTemplate: (overrides: any = {}) => ({
    name: 'UAE Business Template',
    description: 'Professional template compliant with UAE business culture',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Business Communication - {{company_name}}',
    subjectAr: 'تواصل تجاري - {{company_name}}',
    contentEn: `Dear {{customer_name}},

Assalamu Alaikum and greetings from {{company_name}}.

We hope this email finds you well during UAE business hours (Sunday - Thursday, 9:00 AM - 6:00 PM).

Invoice Details:
- Number: {{invoice_number}}
- Amount: {{invoice_amount}} AED
- Due Date: {{due_date}}

Please contact us during our working hours for any assistance:
📧 {{support_email}}
📞 {{contact_phone}}

Best regards,
{{company_name}}
TRN: {{company_trn}}`,
    contentAr: `عزيزي {{customer_name_ar}}،

السلام عليكم وتحياتنا من {{company_name}}.

نأمل أن يصلك هذا البريد خلال ساعات العمل في الإمارات (الأحد - الخميس، 9:00 ص - 6:00 م).

تفاصيل الفاتورة:
- الرقم: {{invoice_number}}
- المبلغ: {{invoice_amount}} درهم
- تاريخ الاستحقاق: {{due_date}}

يرجى الاتصال بنا خلال ساعات العمل للحصول على أي مساعدة:
📧 {{support_email}}
📞 {{contact_phone}}

أطيب التحيات،
{{company_name}}
الرقم الضريبي: {{company_trn}}`,
    variables: {
      customer_name: 'Customer name',
      customer_name_ar: 'اسم العميل',
      company_name: 'Company name',
      invoice_number: 'Invoice number',
      invoice_amount: 'Invoice amount',
      due_date: 'Due date',
      company_trn: 'Company TRN',
      support_email: 'Support email',
      contact_phone: 'Contact phone'
    },
    uaeBusinessHoursOnly: true,
    isActive: true,
    ...overrides
  }),

  // Generate Ramadan-appropriate template
  createRamadanTemplate: (overrides: any = {}) => ({
    name: 'Ramadan Business Template',
    description: 'Respectful business communication during Ramadan',
    subjectEn: 'Ramadan Kareem - Business Communication',
    subjectAr: 'رمضان كريم - تواصل تجاري',
    contentEn: `Dear {{customer_name}},

Ramadan Kareem from all of us at {{company_name}}.

During this blessed month, our business hours are adjusted to 9:00 AM - 3:00 PM, Sunday to Thursday.

We appreciate your understanding and look forward to serving you.

May this Ramadan bring you peace and prosperity.

Best regards,
{{company_name}}
TRN: {{company_trn}}`,
    contentAr: `عزيزي {{customer_name_ar}}،

رمضان كريم من جميع العاملين في {{company_name}}.

خلال هذا الشهر المبارك، ساعات عملنا معدلة من 9:00 ص إلى 3:00 م، من الأحد إلى الخميس.

نقدر تفهمكم ونتطلع لخدمتكم.

عسى أن يجلب لكم هذا الرمضان السلام والازدهار.

أطيب التحيات،
{{company_name}}
الرقم الضريبي: {{company_trn}}`,
    uaeBusinessHoursOnly: true,
    variables: {
      customer_name: 'Customer name',
      customer_name_ar: 'اسم العميل',
      company_name: 'Company name',
      company_trn: 'Company TRN'
    },
    ...overrides
  }),

  // Generate culturally inappropriate template (for testing validation)
  createInappropriateTemplate: () => ({
    name: 'Inappropriate Template',
    subjectEn: 'HEY!!! PAY NOW!!!',
    contentEn: `Hey {{customer_name}},

You MUST pay this invoice IMMEDIATELY!!!

No excuses! Pay now or we'll take legal action right away!

Don't make us wait!!!`,
    contentAr: '', // Missing Arabic content
    uaeBusinessHoursOnly: false,
    variables: {}
  })
}

// UAE business scenarios for testing
export const uaeBusinessScenarios = {
  gentleReminder: {
    day: 3,
    tone: 'polite',
    expectedElements: ['gentle', 'reminder', 'understanding', 'relationship']
  },
  
  professionalFollowUp: {
    day: 7,
    tone: 'professional',
    expectedElements: ['follow-up', 'payment options', 'business hours']
  },
  
  firmNotice: {
    day: 15,
    tone: 'firm',
    expectedElements: ['notice', 'consequences', 'deadline']
  },
  
  finalNotice: {
    day: 30,
    tone: 'formal',
    expectedElements: ['final', 'legal', 'UAE Commercial Law']
  }
}

export default {
  UAE_CONSTANTS,
  arabicTestUtils,
  culturalComplianceUtils,
  templateValidationUtils,
  uaeTestDataGenerators,
  uaeBusinessScenarios
}