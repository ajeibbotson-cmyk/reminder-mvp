import { ScheduleConfig } from './uae-business-hours-service'

export interface SequenceToneAnalysis {
  isAppropriate: boolean
  culturalScore: number // 0-100, higher is better
  issues: string[]
  suggestions: string[]
  recommendedTone: CulturalTone
}

export interface TemplateContentAnalysis {
  isValid: boolean
  culturalCompliance: number // 0-100
  languageAppropriate: boolean
  respectfulTone: boolean
  businessAppropriate: boolean
  issues: string[]
  improvements: string[]
}

export interface CulturalTimingPreferences {
  preferredDays: number[]
  preferredHours: number[]
  avoidancePeriods: {
    name: string
    start: Date
    end: Date
    reason: string
  }[]
  culturalConsiderations: string[]
}

export type CulturalTone = 'VERY_FORMAL' | 'FORMAL' | 'BUSINESS' | 'FRIENDLY' | 'CASUAL'
export type SequenceType = 'FIRST_REMINDER' | 'SECOND_REMINDER' | 'FINAL_NOTICE' | 'OVERDUE' | 'PAYMENT_REQUEST'
export type CustomerRelationship = 'NEW' | 'REGULAR' | 'VIP' | 'GOVERNMENT' | 'CORPORATE'

/**
 * Cultural Compliance Engine for UAE Business Communications
 * Ensures all automated sequences respect UAE business culture and Islamic values
 */
export class CulturalComplianceService {
  
  /**
   * Culturally inappropriate phrases that should be avoided in UAE business communications
   */
  private static readonly INAPPROPRIATE_PHRASES = [
    // Aggressive or demanding language
    'immediately', 'urgent', 'asap', 'right now', 'demand', 'require',
    'must pay', 'you need to', 'failure to pay', 'legal action',
    'debt collection', 'final warning', 'last chance',
    
    // Culturally insensitive terms
    'deadline', 'penalty', 'interest charges', 'late fees',
    'your account is overdue', 'payment is overdue',
    
    // Impersonal or cold language
    'to whom it may concern', 'dear sir/madam', 'account holder',
    'payment reminder', 'outstanding debt', 'amount due'
  ]

  /**
   * Preferred phrases for UAE business culture
   */
  private static readonly PREFERRED_PHRASES = [
    // Respectful requests
    'kindly', 'please', 'we would appreciate', 'at your convenience',
    'when possible', 'we respectfully request', 'may we request',
    
    // Relationship-focused language
    'valued client', 'esteemed customer', 'business partner',
    'continued partnership', 'mutual benefit', 'collaboration',
    
    // Culturally appropriate terms
    'outstanding invoice', 'pending payment', 'invoice settlement',
    'payment arrangement', 'discussion', 'clarification needed'
  ]

  /**
   * Islamic greeting and closing phrases (optional but appreciated)
   */
  private static readonly ISLAMIC_PHRASES = {
    greetings: [
      'As-salamu alaykum', 'Peace be upon you',
      'Barakallahu feeki/feek', 'May Allah bless you'
    ],
    closings: [
      'Barakallahu feeki/feek', 'JazakAllahu khair',
      'May Allah bless your business', 'Fi Amanillah'
    ]
  }

  /**
   * Validate sequence tone for cultural appropriateness
   */
  static validateSequenceTone(
    sequence: any, // FollowUpSequence type
    customerRelationship: CustomerRelationship = 'REGULAR'
  ): SequenceToneAnalysis {
    const issues: string[] = []
    const suggestions: string[] = []
    let culturalScore = 100

    // Analyze each step in the sequence
    if (sequence.steps && Array.isArray(sequence.steps)) {
      sequence.steps.forEach((step: any, index: number) => {
        const stepAnalysis = this.analyzeStepTone(step, index, customerRelationship)
        issues.push(...stepAnalysis.issues)
        suggestions.push(...stepAnalysis.suggestions)
        culturalScore = Math.min(culturalScore, stepAnalysis.score)
      })
    }

    // Determine appropriate tone based on analysis
    let recommendedTone: CulturalTone = 'BUSINESS'
    if (customerRelationship === 'GOVERNMENT' || customerRelationship === 'VIP') {
      recommendedTone = 'VERY_FORMAL'
    } else if (customerRelationship === 'CORPORATE') {
      recommendedTone = 'FORMAL'
    } else if (customerRelationship === 'REGULAR') {
      recommendedTone = 'BUSINESS'
    }

    return {
      isAppropriate: culturalScore >= 70,
      culturalScore,
      issues,
      suggestions,
      recommendedTone
    }
  }

  /**
   * Analyze individual step tone
   */
  private static analyzeStepTone(
    step: any,
    stepIndex: number,
    customerRelationship: CustomerRelationship
  ): { score: number; issues: string[]; suggestions: string[] } {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    const content = step.content || ''
    const subject = step.subject || ''
    const fullText = (content + ' ' + subject).toLowerCase()

    // Check for inappropriate phrases
    this.INAPPROPRIATE_PHRASES.forEach(phrase => {
      if (fullText.includes(phrase.toLowerCase())) {
        issues.push(`Inappropriate phrase detected: "${phrase}"`)
        score -= 15
      }
    })

    // Check tone escalation appropriateness
    const delayDays = step.delayDays || 0
    if (stepIndex === 0 && delayDays < 7) {
      issues.push('First reminder too soon - UAE culture prefers patience')
      suggestions.push('Consider 7-14 days delay for first reminder')
      score -= 10
    }

    if (stepIndex > 0 && delayDays < 5) {
      issues.push('Follow-up too frequent - may appear aggressive')
      suggestions.push('Allow at least 5-7 days between reminders')
      score -= 10
    }

    // Check for greeting and closing formality
    if (!this.hasProperGreeting(content)) {
      suggestions.push('Add respectful greeting (e.g., "Dear Valued Customer")')
      score -= 5
    }

    if (!this.hasProperClosing(content)) {
      suggestions.push('Add respectful closing (e.g., "Thank you for your attention")')
      score -= 5
    }

    // Check for cultural sensitivity based on customer relationship
    if (customerRelationship === 'GOVERNMENT' && !this.isFormalEnough(content)) {
      issues.push('Tone not formal enough for government customer')
      suggestions.push('Use more formal language for government communications')
      score -= 20
    }

    return { score, issues, suggestions }
  }

  /**
   * Check if content has proper greeting
   */
  private static hasProperGreeting(content: string): boolean {
    const greetings = [
      'dear', 'greetings', 'hello', 'good morning', 'good afternoon',
      'peace be upon you', 'as-salamu alaykum', 'valued', 'esteemed'
    ]
    
    const firstLine = content.toLowerCase().split('\n')[0] || ''
    return greetings.some(greeting => firstLine.includes(greeting))
  }

  /**
   * Check if content has proper closing
   */
  private static hasProperClosing(content: string): boolean {
    const closings = [
      'thank you', 'regards', 'sincerely', 'best wishes',
      'jazakallahu khair', 'barakallahu', 'may allah bless'
    ]
    
    const lastLines = content.toLowerCase().split('\n').slice(-3).join(' ')
    return closings.some(closing => lastLines.includes(closing))
  }

  /**
   * Check if content is formal enough
   */
  private static isFormalEnough(content: string): boolean {
    const formalIndicators = [
      'respectfully', 'kindly', 'please', 'we would be grateful',
      'we appreciate', 'your cooperation', 'your attention'
    ]
    
    const text = content.toLowerCase()
    const formalCount = formalIndicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    return formalCount >= 2
  }

  /**
   * Suggest optimal timing for different sequence types
   */
  static suggestOptimalTiming(
    sequenceType: SequenceType,
    customerRelationship: CustomerRelationship = 'REGULAR'
  ): ScheduleConfig {
    const baseConfig: ScheduleConfig = {
      preferredDays: [2, 3, 4], // Tuesday-Thursday
      preferredHours: [10, 11], // 10-11 AM
      avoidPrayerTimes: true,
      respectRamadan: true,
      culturalTone: 'BUSINESS'
    }

    switch (sequenceType) {
      case 'FIRST_REMINDER':
        return {
          ...baseConfig,
          preferredDays: [1, 2, 3], // Monday-Wednesday (avoid pre-weekend)
          preferredHours: [10, 11, 14], // Morning or early afternoon
          culturalTone: 'FRIENDLY'
        }

      case 'SECOND_REMINDER':
        return {
          ...baseConfig,
          preferredDays: [2, 3], // Tuesday-Wednesday (mid-week)
          preferredHours: [10, 11], // Morning preferred
          culturalTone: 'BUSINESS'
        }

      case 'FINAL_NOTICE':
        return {
          ...baseConfig,
          preferredDays: [1, 2], // Monday-Tuesday (avoid weekend approach)
          preferredHours: [9, 10], // Early morning for attention
          culturalTone: 'FORMAL'
        }

      case 'OVERDUE':
        return {
          ...baseConfig,
          preferredDays: [0, 1, 2], // Sunday-Tuesday (start of week)
          preferredHours: [9, 10, 14], // Morning or early afternoon
          culturalTone: customerRelationship === 'GOVERNMENT' ? 'VERY_FORMAL' : 'FORMAL'
        }

      case 'PAYMENT_REQUEST':
        return {
          ...baseConfig,
          preferredDays: [0, 1, 2, 3], // Sunday-Wednesday
          preferredHours: [10, 11, 15], // Morning or mid-afternoon
          culturalTone: 'BUSINESS'
        }

      default:
        return baseConfig
    }
  }

  /**
   * Get Ramadan-specific adjustments
   */
  static getRamadanAdjustments(date: Date): ScheduleConfig {
    return {
      preferredDays: [0, 1, 2, 3], // Sunday-Wednesday (avoid Thursday before weekend)
      preferredHours: [9, 10, 14, 15], // Morning or mid-afternoon (avoid iftar time)
      avoidPrayerTimes: true,
      respectRamadan: true,
      culturalTone: 'FORMAL' // More formal during holy month
    }
  }

  /**
   * Validate template content for cultural compliance
   */
  static validateTemplateContent(template: any): TemplateContentAnalysis {
    const issues: string[] = []
    const improvements: string[] = []
    let culturalCompliance = 100

    const contentEn = template.contentEn || ''
    const contentAr = template.contentAr || ''
    const subjectEn = template.subjectEn || ''
    const subjectAr = template.subjectAr || ''

    // Check English content
    const enAnalysis = this.analyzeContentLanguage(contentEn + ' ' + subjectEn, 'ENGLISH')
    issues.push(...enAnalysis.issues)
    improvements.push(...enAnalysis.improvements)
    culturalCompliance = Math.min(culturalCompliance, enAnalysis.score)

    // Check Arabic content if present
    if (contentAr || subjectAr) {
      const arAnalysis = this.analyzeContentLanguage(contentAr + ' ' + subjectAr, 'ARABIC')
      issues.push(...arAnalysis.issues.map(issue => `[Arabic] ${issue}`))
      improvements.push(...arAnalysis.improvements.map(imp => `[Arabic] ${imp}`))
      culturalCompliance = Math.min(culturalCompliance, arAnalysis.score)
    }

    // Check for required elements
    if (!this.hasProperGreeting(contentEn)) {
      issues.push('Missing proper greeting')
      improvements.push('Add respectful greeting like "Dear Valued Customer"')
      culturalCompliance -= 10
    }

    if (!this.hasProperClosing(contentEn)) {
      issues.push('Missing proper closing')
      improvements.push('Add respectful closing like "Thank you for your cooperation"')
      culturalCompliance -= 10
    }

    // Check for template variables
    const variables = this.extractTemplateVariables(contentEn)
    if (variables.length === 0) {
      improvements.push('Consider adding personalization variables like {{customerName}}')
      culturalCompliance -= 5
    }

    return {
      isValid: culturalCompliance >= 70,
      culturalCompliance: Math.max(0, culturalCompliance),
      languageAppropriate: !issues.some(issue => issue.includes('inappropriate')),
      respectfulTone: culturalCompliance >= 80,
      businessAppropriate: !issues.some(issue => issue.includes('unprofessional')),
      issues,
      improvements
    }
  }

  /**
   * Analyze content for specific language (English/Arabic)
   */
  private static analyzeContentLanguage(
    content: string, 
    language: 'ENGLISH' | 'ARABIC'
  ): { score: number; issues: string[]; improvements: string[] } {
    const issues: string[] = []
    const improvements: string[] = []
    let score = 100

    const text = content.toLowerCase()

    // Check for inappropriate phrases
    this.INAPPROPRIATE_PHRASES.forEach(phrase => {
      if (text.includes(phrase.toLowerCase())) {
        issues.push(`Inappropriate phrase: "${phrase}"`)
        score -= 15
      }
    })

    // Check for preferred phrases
    const preferredFound = this.PREFERRED_PHRASES.filter(phrase => 
      text.includes(phrase.toLowerCase())
    ).length

    if (preferredFound === 0) {
      improvements.push('Consider using more respectful language')
      score -= 10
    }

    // Check tone appropriateness
    if (text.includes('must') || text.includes('need to') || text.includes('have to')) {
      issues.push('Language too demanding - use softer requests')
      score -= 10
    }

    // Check for personal touch
    if (!text.includes('{{') && !text.includes('your')) {
      improvements.push('Add personalization to make it more relationship-focused')
      score -= 5
    }

    return { score, issues, improvements }
  }

  /**
   * Extract template variables from content
   */
  private static extractTemplateVariables(content: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      variables.push(match[1])
    }

    return variables
  }

  /**
   * Get cultural timing preferences for different periods
   */
  static getCulturalTimingPreferences(
    startDate: Date = new Date(),
    endDate: Date = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
  ): CulturalTimingPreferences {
    const avoidancePeriods = []
    const culturalConsiderations = []

    // Check for Ramadan
    if (this.isRamadanPeriod(startDate, endDate)) {
      avoidancePeriods.push({
        name: 'Ramadan',
        start: new Date('2024-03-10'), // Approximate - use proper Islamic calendar
        end: new Date('2024-04-09'),
        reason: 'Holy month - adjust timing and tone'
      })
      culturalConsiderations.push('During Ramadan, use more formal tone and avoid late afternoon sends')
    }

    // Check for major Islamic holidays
    const holidays = [
      { name: 'Eid Al Fitr', start: new Date('2024-04-09'), days: 3 },
      { name: 'Eid Al Adha', start: new Date('2024-06-16'), days: 3 },
      { name: 'Islamic New Year', start: new Date('2024-07-07'), days: 1 }
    ]

    holidays.forEach(holiday => {
      const end = new Date(holiday.start)
      end.setDate(end.getDate() + holiday.days)
      
      if (holiday.start >= startDate && holiday.start <= endDate) {
        avoidancePeriods.push({
          name: holiday.name,
          start: holiday.start,
          end: end,
          reason: 'Islamic holiday - business communications typically paused'
        })
      }
    })

    return {
      preferredDays: [2, 3, 4], // Tuesday-Thursday
      preferredHours: [10, 11, 14, 15], // Morning or early afternoon
      avoidancePeriods,
      culturalConsiderations: [
        ...culturalConsiderations,
        'Always use respectful greetings and closings',
        'Avoid aggressive or demanding language',
        'Consider customer relationship level for tone',
        'Be patient with payment requests - UAE culture values relationship over urgency'
      ]
    }
  }

  /**
   * Check if date range overlaps with Ramadan
   */
  private static isRamadanPeriod(startDate: Date, endDate: Date): boolean {
    // Simplified Ramadan check - in production use proper Islamic calendar
    const ramadanPeriods = [
      { start: new Date('2024-03-10'), end: new Date('2024-04-09') },
      { start: new Date('2025-02-28'), end: new Date('2025-03-30') }
    ]

    return ramadanPeriods.some(ramadan => 
      (startDate <= ramadan.end && endDate >= ramadan.start)
    )
  }

  /**
   * Calculate overall cultural compliance score (0-100)
   */
  static calculateCulturalScore(
    content: string,
    context: {
      language?: 'en' | 'ar' | 'mixed'
      customerRelationship?: CustomerRelationship
      isRamadan?: boolean
      sequenceType?: SequenceType
    } = {}
  ): {
    score: number
    breakdown: {
      languageAppropriate: number
      greetingsAndClosings: number
      toneRespectfulness: number
      culturalSensitivity: number
      islamicEtiquette: number
      businessFormality: number
    }
    recommendations: string[]
  } {
    const recommendations: string[] = []
    const breakdown = {
      languageAppropriate: 100,
      greetingsAndClosings: 100,
      toneRespectfulness: 100,
      culturalSensitivity: 100,
      islamicEtiquette: 100,
      businessFormality: 100
    }

    // Language appropriateness (25% weight)
    const languageAnalysis = this.analyzeLanguageAppropriate(content, context.language || 'en')
    breakdown.languageAppropriate = languageAnalysis.score
    recommendations.push(...languageAnalysis.recommendations)

    // Greetings and closings (20% weight)
    const greetingAnalysis = this.analyzeGreetingsAndClosings(content)
    breakdown.greetingsAndClosings = greetingAnalysis.score
    recommendations.push(...greetingAnalysis.recommendations)

    // Tone respectfulness (20% weight)
    const toneAnalysis = this.analyzeToneRespectfulness(content, context.customerRelationship)
    breakdown.toneRespectfulness = toneAnalysis.score
    recommendations.push(...toneAnalysis.recommendations)

    // Cultural sensitivity (15% weight)
    const culturalAnalysis = this.analyzeCulturalSensitivity(content, context.isRamadan)
    breakdown.culturalSensitivity = culturalAnalysis.score
    recommendations.push(...culturalAnalysis.recommendations)

    // Islamic etiquette (10% weight)
    const islamicAnalysis = this.analyzeIslamicEtiquette(content)
    breakdown.islamicEtiquette = islamicAnalysis.score
    recommendations.push(...islamicAnalysis.recommendations)

    // Business formality (10% weight)
    const formalityAnalysis = this.analyzeBusinessFormality(content, context.sequenceType)
    breakdown.businessFormality = formalityAnalysis.score
    recommendations.push(...formalityAnalysis.recommendations)

    // Calculate weighted score
    const score = Math.round(
      (breakdown.languageAppropriate * 0.25) +
      (breakdown.greetingsAndClosings * 0.20) +
      (breakdown.toneRespectfulness * 0.20) +
      (breakdown.culturalSensitivity * 0.15) +
      (breakdown.islamicEtiquette * 0.10) +
      (breakdown.businessFormality * 0.10)
    )

    return {
      score: Math.max(0, Math.min(100, score)),
      breakdown,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    }
  }

  /**
   * Validate if greeting is appropriate for UAE business culture
   */
  static isAppropriateGreeting(greeting: string, language: 'en' | 'ar' = 'en'): {
    appropriate: boolean
    culturalLevel: 'excellent' | 'good' | 'acceptable' | 'poor'
    suggestion?: string
  } {
    const lowerGreeting = greeting.toLowerCase().trim()
    
    if (language === 'en') {
      // Excellent Islamic/Arabic greetings
      if (lowerGreeting.includes('as-salamu alaykum') || 
          lowerGreeting.includes('peace be upon you')) {
        return { appropriate: true, culturalLevel: 'excellent' }
      }
      
      // Good formal greetings
      if (lowerGreeting.includes('dear valued') || 
          lowerGreeting.includes('dear esteemed') ||
          lowerGreeting.includes('respected customer')) {
        return { appropriate: true, culturalLevel: 'good' }
      }
      
      // Acceptable standard greetings
      if (lowerGreeting.includes('dear sir') || 
          lowerGreeting.includes('dear madam') ||
          lowerGreeting.includes('dear customer')) {
        return { appropriate: true, culturalLevel: 'acceptable' }
      }
      
      // Poor informal greetings
      if (lowerGreeting.includes('hi') || 
          lowerGreeting.includes('hey') ||
          lowerGreeting.includes('hello there')) {
        return { 
          appropriate: false, 
          culturalLevel: 'poor',
          suggestion: 'Use formal greetings like "Dear Valued Customer" or "As-salamu alaykum"'
        }
      }
    } else {
      // Arabic greetings
      if (lowerGreeting.includes('السلام عليكم') || 
          lowerGreeting.includes('عزيزي العميل') ||
          lowerGreeting.includes('المحترم')) {
        return { appropriate: true, culturalLevel: 'excellent' }
      }
    }
    
    return { 
      appropriate: true, 
      culturalLevel: 'acceptable',
      suggestion: 'Consider using "As-salamu alaykum" or "Dear Valued Customer" for better cultural connection'
    }
  }

  /**
   * Detect Arabic language and provide RTL support information
   */
  static detectArabicLanguage(text: string): {
    hasArabic: boolean
    arabicPercentage: number
    isRTL: boolean
    requiresRTLLayout: boolean
    arabicWords: string[]
    mixedLanguage: boolean
  } {
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g
    const arabicMatches = text.match(arabicRegex) || []
    const totalChars = text.replace(/\s/g, '').length
    const arabicChars = arabicMatches.length
    
    const arabicPercentage = totalChars > 0 ? (arabicChars / totalChars) * 100 : 0
    const hasArabic = arabicChars > 0
    const isRTL = arabicPercentage > 30 // Predominantly Arabic
    
    // Extract Arabic words
    const arabicWordRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g
    const arabicWords = text.match(arabicWordRegex) || []
    
    // Check for mixed language (both Arabic and Latin scripts)
    const latinRegex = /[A-Za-z]/g
    const hasLatin = latinRegex.test(text)
    const mixedLanguage = hasArabic && hasLatin
    
    return {
      hasArabic,
      arabicPercentage: Math.round(arabicPercentage),
      isRTL,
      requiresRTLLayout: arabicPercentage > 50,
      arabicWords,
      mixedLanguage
    }
  }

  /**
   * Validate tone escalation sequence for cultural appropriateness
   */
  static validateToneEscalation(
    steps: Array<{ tone: string; content: string; delayDays: number }>,
    customerRelationship: CustomerRelationship = 'REGULAR'
  ): {
    appropriate: boolean
    issues: string[]
    suggestions: string[]
    recommendedProgression: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    
    // Define appropriate progression based on customer relationship
    const progressions = {
      'GOVERNMENT': ['VERY_FORMAL', 'VERY_FORMAL', 'FORMAL', 'FORMAL'],
      'VIP': ['FRIENDLY', 'BUSINESS', 'FORMAL', 'FORMAL'],
      'CORPORATE': ['BUSINESS', 'BUSINESS', 'FORMAL', 'FIRM'],
      'REGULAR': ['FRIENDLY', 'BUSINESS', 'FORMAL', 'FIRM'],
      'NEW': ['VERY_FORMAL', 'FORMAL', 'BUSINESS', 'FORMAL']
    }
    
    const recommendedProgression = progressions[customerRelationship] || progressions['REGULAR']
    
    // Check timing appropriateness
    if (steps.length > 0 && steps[0].delayDays < 7) {
      issues.push('First reminder too soon - UAE culture values patience')
      suggestions.push('Allow at least 7 days before first reminder')
    }
    
    // Check delay between steps
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].delayDays < 5) {
        issues.push(`Step ${i + 1} follows too quickly - may appear pushy`)
        suggestions.push('Allow 5-7 days between reminders for respectful pacing')
      }
    }
    
    // Check tone progression
    steps.forEach((step, index) => {
      const expectedTone = recommendedProgression[index]
      if (expectedTone && this.getToneLevel(step.tone) > this.getToneLevel(expectedTone)) {
        issues.push(`Step ${index + 1} tone too aggressive for ${customerRelationship} relationship`)
        suggestions.push(`Use ${expectedTone} tone for step ${index + 1}`)
      }
    })
    
    return {
      appropriate: issues.length === 0,
      issues,
      suggestions,
      recommendedProgression
    }
  }

  /**
   * Helper method to get tone aggression level
   */
  private static getToneLevel(tone: string): number {
    const levels = {
      'VERY_FORMAL': 1,
      'FORMAL': 2,
      'BUSINESS': 3,
      'FRIENDLY': 2,
      'FIRM': 4,
      'URGENT': 5
    }
    return levels[tone as keyof typeof levels] || 3
  }

  /**
   * Analyze language appropriateness
   */
  private static analyzeLanguageAppropriate(content: string, language: 'en' | 'ar'): {
    score: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    let score = 100
    
    // Check for inappropriate phrases
    this.INAPPROPRIATE_PHRASES.forEach(phrase => {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        score -= 15
        recommendations.push(`Remove inappropriate phrase: "${phrase}"`)
      }
    })
    
    // Check for preferred phrases
    const preferredFound = this.PREFERRED_PHRASES.filter(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    ).length
    
    if (preferredFound === 0) {
      score -= 10
      recommendations.push('Include respectful phrases like "kindly", "please", or "we appreciate"')
    }
    
    return { score: Math.max(0, score), recommendations }
  }

  /**
   * Analyze greetings and closings
   */
  private static analyzeGreetingsAndClosings(content: string): {
    score: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    let score = 100
    
    if (!this.hasProperGreeting(content)) {
      score -= 40
      recommendations.push('Add proper greeting like "Dear Valued Customer" or "As-salamu alaykum"')
    }
    
    if (!this.hasProperClosing(content)) {
      score -= 30
      recommendations.push('Add respectful closing like "Best regards" or "JazakAllahu khair"')
    }
    
    return { score: Math.max(0, score), recommendations }
  }

  /**
   * Analyze tone respectfulness
   */
  private static analyzeToneRespectfulness(content: string, relationship?: CustomerRelationship): {
    score: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    let score = 100
    
    // Check for demanding language
    const demandingPatterns = [
      /must\s+pay/i,
      /you\s+need\s+to/i,
      /immediately/i,
      /right\s+now/i
    ]
    
    demandingPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score -= 20
        recommendations.push('Soften demanding language to be more respectful')
      }
    })
    
    // Check formality for government customers
    if (relationship === 'GOVERNMENT' && !this.isFormalEnough(content)) {
      score -= 25
      recommendations.push('Use more formal language for government communications')
    }
    
    return { score: Math.max(0, score), recommendations }
  }

  /**
   * Analyze cultural sensitivity
   */
  private static analyzeCulturalSensitivity(content: string, isRamadan?: boolean): {
    score: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    let score = 100
    
    // Check for cultural insensitivity
    const insensitiveTerms = ['deadline', 'demand', 'force', 'penalty']
    insensitiveTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        score -= 15
        recommendations.push(`Replace "${term}" with more culturally sensitive language`)
      }
    })
    
    // Ramadan considerations
    if (isRamadan) {
      if (!content.toLowerCase().includes('ramadan') && !content.includes('رمضان')) {
        recommendations.push('Consider adding Ramadan greetings during the holy month')
      }
    }
    
    return { score: Math.max(0, score), recommendations }
  }

  /**
   * Analyze Islamic etiquette
   */
  private static analyzeIslamicEtiquette(content: string): {
    score: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    let score = 100
    
    // Check for Islamic phrases (bonus points)
    const islamicPhrases = this.ISLAMIC_PHRASES.greetings.concat(this.ISLAMIC_PHRASES.closings)
    const hasIslamicPhrase = islamicPhrases.some(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    )
    
    if (!hasIslamicPhrase) {
      recommendations.push('Consider adding Islamic greetings for stronger cultural connection')
    } else {
      score += 10 // Bonus for using Islamic phrases
    }
    
    return { score: Math.min(100, score), recommendations }
  }

  /**
   * Analyze business formality
   */
  private static analyzeBusinessFormality(content: string, sequenceType?: SequenceType): {
    score: number
    recommendations: string[]
  } {
    const recommendations: string[] = []
    let score = 100
    
    // Check for business context
    if (!content.toLowerCase().includes('business hours') && !content.includes('ساعات العمل')) {
      score -= 10
      recommendations.push('Include business hours information')
    }
    
    // Check for TRN reference
    if (!content.includes('TRN') && !content.includes('الرقم الضريبي')) {
      score -= 15
      recommendations.push('Include company TRN for UAE business compliance')
    }
    
    return { score: Math.max(0, score), recommendations }
  }

  /**
   * Generate culturally appropriate subject line suggestions
   */
  static generateSubjectLineSuggestions(
    sequenceType: SequenceType,
    customerName?: string,
    invoiceNumber?: string
  ): string[] {
    const suggestions: string[] = []
    const name = customerName ? ` ${customerName}` : ''
    const invoice = invoiceNumber ? ` #${invoiceNumber}` : ''

    switch (sequenceType) {
      case 'FIRST_REMINDER':
        suggestions.push(
          `Gentle reminder: Invoice${invoice} - Your attention appreciated`,
          `Invoice${invoice} - Pending your kind attention`,
          `Friendly reminder regarding Invoice${invoice}`,
          `Your invoice${invoice} - Awaiting your response`
        )
        break

      case 'SECOND_REMINDER':
        suggestions.push(
          `Second notice: Invoice${invoice} - Your cooperation needed`,
          `Follow-up: Invoice${invoice} - Please advise`,
          `Invoice${invoice} - Request for status update`,
          `Respectful follow-up on Invoice${invoice}`
        )
        break

      case 'FINAL_NOTICE':
        suggestions.push(
          `Important: Invoice${invoice} requires your attention`,
          `Final notice: Invoice${invoice} - Discussion needed`,
          `Invoice${invoice} - Urgent clarification required`,
          `Critical: Invoice${invoice} - Please respond`
        )
        break

      case 'PAYMENT_REQUEST':
        suggestions.push(
          `Payment request: Invoice${invoice}`,
          `Invoice${invoice} - Payment arrangement needed`,
          `Settlement request for Invoice${invoice}`,
          `Invoice${invoice} - Payment discussion`
        )
        break
    }

    return suggestions
  }
}

// Export singleton instance
export const culturalCompliance = new CulturalComplianceService()