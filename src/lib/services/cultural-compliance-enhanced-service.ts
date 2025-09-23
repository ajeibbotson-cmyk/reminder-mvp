/**
 * Enhanced Cultural Compliance Service
 * Advanced cultural sensitivity and compliance service specifically designed for
 * UAE business customs, Islamic culture, and consolidated email communications
 */

import { prisma } from '../prisma'

interface CulturalComplianceRules {
  islamicCalendarChecked: boolean
  prayerTimesRespected: boolean
  ramadanSensitivity: boolean
  uaeBusinessCustoms: boolean
  languageAppropriate: boolean
  toneRespectful: boolean
  timingCulturallyAppropriate: boolean
}

interface CulturalComplianceResult {
  isCompliant: boolean
  score: number // 0-100
  appliedRules: string[]
  violations: string[]
  recommendations: string[]
  adjustments: {
    timing?: Date
    language?: string
    tone?: string
    content?: string
  }
}

interface IslamicCalendarInfo {
  isRamadan: boolean
  isHolyMonth: boolean
  currentHijriMonth: string
  currentHijriYear: number
  specialConsiderations: string[]
}

interface UAEBusinessCustoms {
  workingDays: number[]
  businessHours: { start: number; end: number }
  nationalHolidays: Date[]
  culturalEvents: Array<{ name: string; date: Date; impact: 'low' | 'medium' | 'high' }>
  communicationPreferences: {
    formal: boolean
    respectful: boolean
    indirect: boolean
  }
}

interface ConsolidatedEmailCulturalContext {
  customerProfile: {
    name: string
    businessType: string
    preferredLanguage: 'en' | 'ar'
    culturalBackground?: string
    communicationPreference?: string
  }
  emailContent: {
    subject: string
    content: string
    language: 'en' | 'ar'
    escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  }
  businessContext: {
    invoiceCount: number
    totalAmount: number
    oldestInvoiceDays: number
    relationshipDuration?: number
  }
  timing: {
    proposedSendTime: Date
    urgencyLevel: 'low' | 'medium' | 'high' | 'urgent'
  }
}

export class CulturalComplianceEnhancedService {
  private readonly UAE_TIMEZONE = 'Asia/Dubai'
  private readonly ISLAMIC_CALENDAR_API_ENDPOINT = 'https://api.islamicfinder.us' // Example

  // Cultural sensitivity thresholds
  private readonly COMPLIANCE_THRESHOLDS = {
    minimum: 70,
    good: 80,
    excellent: 90
  }

  // Prayer times (approximate - would use precise API in production)
  private readonly PRAYER_TIMES = {
    fajr: { start: 5, duration: 30 },
    dhuhr: { start: 12, duration: 45 },
    asr: { start: 15, duration: 30 },
    maghrib: { start: 18, duration: 30 },
    isha: { start: 19, duration: 30 }
  }

  /**
   * Perform comprehensive cultural compliance check for consolidated email
   */
  async performComplianceCheck(
    context: ConsolidatedEmailCulturalContext
  ): Promise<CulturalComplianceResult> {
    try {
      console.log('🕌 Performing cultural compliance check for consolidated email')

      let complianceScore = 100
      const appliedRules: string[] = []
      const violations: string[] = []
      const recommendations: string[] = []
      const adjustments: any = {}

      // 1. Islamic Calendar Compliance
      const islamicCompliance = await this.checkIslamicCalendarCompliance(context.timing.proposedSendTime)
      if (!islamicCompliance.isCompliant) {
        complianceScore -= 15
        violations.push('Islamic calendar sensitivity required')
        if (islamicCompliance.adjustedTime) {
          adjustments.timing = islamicCompliance.adjustedTime
        }
      } else {
        appliedRules.push('ISLAMIC_CALENDAR_COMPLIANT')
      }

      // 2. Prayer Times Respect
      const prayerCompliance = this.checkPrayerTimesCompliance(context.timing.proposedSendTime)
      if (!prayerCompliance.isCompliant) {
        complianceScore -= 10
        violations.push('Prayer times should be respected')
        if (prayerCompliance.adjustedTime) {
          adjustments.timing = prayerCompliance.adjustedTime
        }
      } else {
        appliedRules.push('PRAYER_TIMES_RESPECTED')
      }

      // 3. UAE Business Customs
      const businessCompliance = await this.checkUAEBusinessCustoms(context)
      complianceScore += businessCompliance.scoreAdjustment
      appliedRules.push(...businessCompliance.appliedRules)
      violations.push(...businessCompliance.violations)

      // 4. Language and Tone Appropriateness
      const languageCompliance = this.checkLanguageAppropriatenesss(context)
      complianceScore += languageCompliance.scoreAdjustment
      appliedRules.push(...languageCompliance.appliedRules)
      violations.push(...languageCompliance.violations)
      if (languageCompliance.contentAdjustments) {
        adjustments.content = languageCompliance.contentAdjustments
      }

      // 5. Consolidation Cultural Sensitivity
      const consolidationCompliance = this.checkConsolidationCulturalSensitivity(context)
      complianceScore += consolidationCompliance.scoreAdjustment
      appliedRules.push(...consolidationCompliance.appliedRules)
      recommendations.push(...consolidationCompliance.recommendations)

      // 6. Timing Cultural Appropriateness
      const timingCompliance = await this.checkTimingCulturalAppropriateness(context)
      complianceScore += timingCompliance.scoreAdjustment
      appliedRules.push(...timingCompliance.appliedRules)
      if (timingCompliance.adjustedTime) {
        adjustments.timing = timingCompliance.adjustedTime
      }

      // 7. Escalation Level Cultural Sensitivity
      const escalationCompliance = this.checkEscalationLevelSensitivity(context)
      complianceScore += escalationCompliance.scoreAdjustment
      appliedRules.push(...escalationCompliance.appliedRules)
      recommendations.push(...escalationCompliance.recommendations)

      // Ensure score is within bounds
      complianceScore = Math.max(0, Math.min(100, complianceScore))

      // Generate overall recommendations
      const overallRecommendations = this.generateOverallRecommendations(
        complianceScore,
        context,
        violations
      )
      recommendations.push(...overallRecommendations)

      const result: CulturalComplianceResult = {
        isCompliant: complianceScore >= this.COMPLIANCE_THRESHOLDS.minimum,
        score: Math.round(complianceScore),
        appliedRules,
        violations,
        recommendations,
        adjustments
      }

      console.log(`✅ Cultural compliance check completed: ${result.score}/100`)
      return result

    } catch (error) {
      console.error('Failed to perform cultural compliance check:', error)

      // Return safe fallback
      return {
        isCompliant: false,
        score: 50,
        appliedRules: ['FALLBACK_MODE'],
        violations: ['Cultural compliance check failed'],
        recommendations: ['Please review email manually for cultural sensitivity'],
        adjustments: {}
      }
    }
  }

  /**
   * Get cultural tone recommendations based on context
   */
  getCulturalToneRecommendations(
    escalationLevel: string,
    language: 'en' | 'ar',
    customerProfile: any
  ): {
    tone: string
    phrases: string[]
    avoidPhrases: string[]
    culturalElements: string[]
  } {
    const isArabic = language === 'ar'

    if (escalationLevel === 'POLITE') {
      return {
        tone: 'respectful_gentle',
        phrases: isArabic ? [
          'نأمل من سيادتكم',
          'مع كامل الاحترام',
          'نقدر تفهمكم',
          'في أقرب وقت ممكن'
        ] : [
          'We kindly request',
          'With utmost respect',
          'We appreciate your understanding',
          'At your earliest convenience'
        ],
        avoidPhrases: isArabic ? [
          'يجب عليكم',
          'فوراً',
          'بدون تأخير'
        ] : [
          'You must',
          'Immediately',
          'Without delay'
        ],
        culturalElements: isArabic ? [
          'Traditional Arabic greeting',
          'Islamic courtesy phrases',
          'Respectful closing'
        ] : [
          'Professional courtesy',
          'Understanding tone',
          'Respectful language'
        ]
      }
    }

    if (escalationLevel === 'FIRM') {
      return {
        tone: 'professional_firm',
        phrases: isArabic ? [
          'نود التذكير',
          'من الضروري',
          'نتطلع إلى',
          'في أسرع وقت'
        ] : [
          'We must remind you',
          'It is essential',
          'We expect',
          'As soon as possible'
        ],
        avoidPhrases: isArabic ? [
          'غير مقبول',
          'نطالب'
        ] : [
          'Unacceptable',
          'We demand'
        ],
        culturalElements: isArabic ? [
          'Maintain respect while being firm',
          'Use business formality',
          'Reference mutual respect'
        ] : [
          'Professional assertiveness',
          'Business formality',
          'Respectful firmness'
        ]
      }
    }

    if (escalationLevel === 'URGENT') {
      return {
        tone: 'urgent_respectful',
        phrases: isArabic ? [
          'نلفت انتباهكم',
          'الأمر عاجل',
          'نقدر تعاونكم',
          'في غضون'
        ] : [
          'We draw your attention',
          'This matter is urgent',
          'We appreciate your cooperation',
          'Within the next'
        ],
        avoidPhrases: isArabic ? [
          'تحذير نهائي',
          'تهديد'
        ] : [
          'Final warning',
          'Threat'
        ],
        culturalElements: isArabic ? [
          'Urgent but respectful',
          'Maintain dignity',
          'Cultural sensitivity'
        ] : [
          'Urgent professionalism',
          'Respectful urgency',
          'Cultural awareness'
        ]
      }
    }

    // FINAL escalation
    return {
      tone: 'formal_final',
      phrases: isArabic ? [
        'للأسف نضطر',
        'كإجراء أخير',
        'نأسف للوصول',
        'مع الاحترام'
      ] : [
        'Regrettably, we must',
        'As a final measure',
        'We regret having to',
        'With due respect'
      ],
      avoidPhrases: isArabic ? [
        'نهددكم',
        'عواقب وخيمة'
      ] : [
        'We threaten',
        'Dire consequences'
      ],
      culturalElements: isArabic ? [
        'Maintain dignity even in final notice',
        'Express regret for necessity',
        'Offer final opportunity'
      ] : [
        'Professional finality',
        'Respectful conclusion',
        'Dignified firmness'
      ]
    }
  }

  /**
   * Assess cultural sensitivity of consolidated email content
   */
  assessConsolidatedEmailSensitivity(
    content: string,
    language: 'en' | 'ar',
    context: ConsolidatedEmailCulturalContext
  ): {
    score: number
    issues: string[]
    improvements: string[]
    culturalElements: string[]
  } {
    let score = 70 // Base score
    const issues: string[] = []
    const improvements: string[] = []
    const culturalElements: string[] = []

    const contentLower = content.toLowerCase()

    // Positive cultural elements
    if (language === 'ar') {
      if (content.includes('بسم الله')) {
        score += 5
        culturalElements.push('Islamic greeting used')
      }
      if (content.includes('مع أطيب التحيات')) {
        score += 5
        culturalElements.push('Traditional Arabic closing')
      }
      if (content.includes('إن شاء الله')) {
        score += 3
        culturalElements.push('Islamic courtesy phrase')
      }
    } else {
      if (contentLower.includes('respectfully') || contentLower.includes('kindly')) {
        score += 5
        culturalElements.push('Respectful language used')
      }
      if (contentLower.includes('understanding') || contentLower.includes('appreciate')) {
        score += 5
        culturalElements.push('Appreciation expressed')
      }
    }

    // Check for consolidation sensitivity
    if (context.businessContext.invoiceCount > 5) {
      if (contentLower.includes('consolidat') || contentLower.includes('combined')) {
        score += 5
        culturalElements.push('Consolidation explained clearly')
      } else {
        issues.push('Consolidation not clearly explained')
        improvements.push('Explain the benefit of consolidated communication')
      }
    }

    // Check for urgency appropriateness
    if (context.emailContent.escalationLevel === 'URGENT' || context.emailContent.escalationLevel === 'FINAL') {
      if (contentLower.includes('immediately') || contentLower.includes('asap')) {
        score -= 10
        issues.push('Overly urgent language may be culturally insensitive')
        improvements.push('Use more respectful urgency expressions')
      }
    }

    // Check for amount sensitivity
    if (context.businessContext.totalAmount > 50000) {
      if (!contentLower.includes('significant') && !contentLower.includes('substantial')) {
        score += 3
        culturalElements.push('Appropriate handling of large amounts')
      }
    }

    // Business relationship considerations
    if (context.businessContext.relationshipDuration && context.businessContext.relationshipDuration > 12) {
      if (contentLower.includes('valued') || contentLower.includes('appreciate')) {
        score += 5
        culturalElements.push('Long-term relationship acknowledged')
      } else {
        improvements.push('Acknowledge long-term business relationship')
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      improvements,
      culturalElements
    }
  }

  /**
   * Private helper methods
   */

  private async checkIslamicCalendarCompliance(proposedTime: Date): Promise<{
    isCompliant: boolean
    adjustedTime?: Date
    reason?: string
  }> {
    try {
      // Get Islamic calendar information
      const islamicInfo = await this.getIslamicCalendarInfo(proposedTime)

      // Check if it's Ramadan
      if (islamicInfo.isRamadan) {
        const hour = proposedTime.getHours()

        // Avoid late afternoon during Ramadan (before Iftar)
        if (hour >= 16 && hour <= 19) {
          const adjustedTime = new Date(proposedTime)
          adjustedTime.setHours(20, 0, 0, 0) // After Iftar

          return {
            isCompliant: false,
            adjustedTime,
            reason: 'Adjusted for Ramadan Iftar time'
          }
        }

        // Avoid very early morning during Ramadan (before/during Suhur)
        if (hour >= 3 && hour <= 6) {
          const adjustedTime = new Date(proposedTime)
          adjustedTime.setHours(8, 0, 0, 0) // After morning prayers

          return {
            isCompliant: false,
            adjustedTime,
            reason: 'Adjusted for Ramadan Suhur time'
          }
        }
      }

      // Check for Islamic holidays
      if (islamicInfo.specialConsiderations.length > 0) {
        const adjustedTime = new Date(proposedTime)
        adjustedTime.setDate(adjustedTime.getDate() + 1)
        adjustedTime.setHours(10, 0, 0, 0)

        return {
          isCompliant: false,
          adjustedTime,
          reason: 'Adjusted for Islamic holiday'
        }
      }

      return { isCompliant: true }

    } catch (error) {
      console.error('Islamic calendar check failed:', error)
      return { isCompliant: true } // Fail gracefully
    }
  }

  private checkPrayerTimesCompliance(proposedTime: Date): {
    isCompliant: boolean
    adjustedTime?: Date
    reason?: string
  } {
    const hour = proposedTime.getHours()
    const minute = proposedTime.getMinutes()
    const timeInMinutes = hour * 60 + minute

    for (const [prayerName, prayer] of Object.entries(this.PRAYER_TIMES)) {
      const prayerStart = prayer.start * 60
      const prayerEnd = prayerStart + prayer.duration

      if (timeInMinutes >= prayerStart && timeInMinutes <= prayerEnd) {
        const adjustedTime = new Date(proposedTime)
        adjustedTime.setHours(prayer.start, prayer.duration, 0, 0)

        return {
          isCompliant: false,
          adjustedTime,
          reason: `Adjusted to avoid ${prayerName} prayer time`
        }
      }
    }

    return { isCompliant: true }
  }

  private async checkUAEBusinessCustoms(context: ConsolidatedEmailCulturalContext): Promise<{
    scoreAdjustment: number
    appliedRules: string[]
    violations: string[]
  }> {
    let scoreAdjustment = 0
    const appliedRules: string[] = []
    const violations: string[] = []

    // Check business day
    const dayOfWeek = context.timing.proposedSendTime.getDay()
    if (dayOfWeek >= 0 && dayOfWeek <= 4) { // Sunday to Thursday
      scoreAdjustment += 5
      appliedRules.push('UAE_BUSINESS_DAYS')
    } else {
      violations.push('Email scheduled outside UAE business days')
    }

    // Check business hours
    const hour = context.timing.proposedSendTime.getHours()
    if (hour >= 9 && hour <= 17) {
      scoreAdjustment += 5
      appliedRules.push('UAE_BUSINESS_HOURS')
    } else {
      violations.push('Email scheduled outside standard business hours')
    }

    // Check for UAE holidays
    const isHoliday = await this.isUAEHoliday(context.timing.proposedSendTime)
    if (!isHoliday) {
      scoreAdjustment += 3
      appliedRules.push('UAE_HOLIDAY_AVOIDANCE')
    } else {
      violations.push('Email scheduled on UAE holiday')
    }

    return { scoreAdjustment, appliedRules, violations }
  }

  private checkLanguageAppropriatenesss(context: ConsolidatedEmailCulturalContext): {
    scoreAdjustment: number
    appliedRules: string[]
    violations: string[]
    contentAdjustments?: string
  } {
    let scoreAdjustment = 0
    const appliedRules: string[] = []
    const violations: string[] = []

    const { subject, content, language } = context.emailContent
    const contentLower = content.toLowerCase()

    // Language consistency check
    if (language === context.customerProfile.preferredLanguage) {
      scoreAdjustment += 10
      appliedRules.push('PREFERRED_LANGUAGE_USED')
    }

    // Tone appropriateness
    const toneRecommendations = this.getCulturalToneRecommendations(
      context.emailContent.escalationLevel,
      language,
      context.customerProfile
    )

    // Check for appropriate phrases
    const hasAppropriatePhrases = toneRecommendations.phrases.some(phrase =>
      contentLower.includes(phrase.toLowerCase())
    )

    if (hasAppropriatePhrases) {
      scoreAdjustment += 8
      appliedRules.push('CULTURALLY_APPROPRIATE_PHRASES')
    }

    // Check for inappropriate phrases
    const hasInappropriatePhrases = toneRecommendations.avoidPhrases.some(phrase =>
      contentLower.includes(phrase.toLowerCase())
    )

    if (hasInappropriatePhrases) {
      scoreAdjustment -= 15
      violations.push('Contains culturally inappropriate phrases')
    }

    // Formality level check
    if (context.customerProfile.businessType === 'CORPORATION' ||
        context.customerProfile.businessType === 'GOVERNMENT') {
      if (contentLower.includes('dear sir') || contentLower.includes('respected')) {
        scoreAdjustment += 5
        appliedRules.push('FORMAL_BUSINESS_TONE')
      }
    }

    return { scoreAdjustment, appliedRules, violations }
  }

  private checkConsolidationCulturalSensitivity(context: ConsolidatedEmailCulturalContext): {
    scoreAdjustment: number
    appliedRules: string[]
    recommendations: string[]
  } {
    let scoreAdjustment = 0
    const appliedRules: string[] = []
    const recommendations: string[] = []

    const { invoiceCount, totalAmount } = context.businessContext
    const content = context.emailContent.content.toLowerCase()

    // Check if consolidation is explained sensitively
    if (invoiceCount > 3) {
      if (content.includes('convenience') || content.includes('simplif')) {
        scoreAdjustment += 10
        appliedRules.push('CONSOLIDATION_BENEFIT_EXPLAINED')
      } else {
        recommendations.push('Explain consolidation as a convenience for the customer')
      }
    }

    // Check for overwhelm mitigation
    if (invoiceCount > 5 || totalAmount > 25000) {
      if (content.includes('summary') || content.includes('overview')) {
        scoreAdjustment += 8
        appliedRules.push('OVERWHELM_MITIGATION')
      } else {
        recommendations.push('Provide clear summary to avoid overwhelming the customer')
      }
    }

    // Check for payment assistance offer
    if (totalAmount > 15000) {
      if (content.includes('payment plan') || content.includes('discuss')) {
        scoreAdjustment += 5
        appliedRules.push('PAYMENT_ASSISTANCE_OFFERED')
      } else {
        recommendations.push('Consider offering payment plan discussion for large amounts')
      }
    }

    return { scoreAdjustment, appliedRules, recommendations }
  }

  private async checkTimingCulturalAppropriateness(context: ConsolidatedEmailCulturalContext): Promise<{
    scoreAdjustment: number
    appliedRules: string[]
    adjustedTime?: Date
  }> {
    let scoreAdjustment = 0
    const appliedRules: string[] = []

    const proposedTime = context.timing.proposedSendTime
    const urgency = context.timing.urgencyLevel

    // Check for culturally appropriate timing based on urgency
    if (urgency === 'low' || urgency === 'medium') {
      // For non-urgent emails, prefer mid-morning
      const hour = proposedTime.getHours()
      if (hour >= 10 && hour <= 11) {
        scoreAdjustment += 5
        appliedRules.push('OPTIMAL_CULTURAL_TIMING')
      }
    }

    // Avoid culturally sensitive times
    const isRamadan = await this.isRamadanPeriod()
    if (isRamadan) {
      scoreAdjustment += 5
      appliedRules.push('RAMADAN_SENSITIVITY_APPLIED')
    }

    return { scoreAdjustment, appliedRules }
  }

  private checkEscalationLevelSensitivity(context: ConsolidatedEmailCulturalContext): {
    scoreAdjustment: number
    appliedRules: string[]
    recommendations: string[]
  } {
    let scoreAdjustment = 0
    const appliedRules: string[] = []
    const recommendations: string[] = []

    const { escalationLevel } = context.emailContent
    const { oldestInvoiceDays, totalAmount } = context.businessContext

    // Check if escalation level is culturally appropriate
    if (escalationLevel === 'FINAL' && oldestInvoiceDays < 60) {
      scoreAdjustment -= 10
      recommendations.push('Final notice may be too aggressive for invoice age')
    }

    if (escalationLevel === 'POLITE' && oldestInvoiceDays > 90 && totalAmount > 20000) {
      recommendations.push('Consider more assertive tone for significantly overdue amounts')
    }

    // Cultural escalation appropriateness
    if (escalationLevel === 'URGENT' || escalationLevel === 'FINAL') {
      if (context.emailContent.content.toLowerCase().includes('respect') ||
          context.emailContent.content.toLowerCase().includes('understand')) {
        scoreAdjustment += 8
        appliedRules.push('RESPECTFUL_ESCALATION')
      }
    }

    return { scoreAdjustment, appliedRules, recommendations }
  }

  private generateOverallRecommendations(
    score: number,
    context: ConsolidatedEmailCulturalContext,
    violations: string[]
  ): string[] {
    const recommendations: string[] = []

    if (score < this.COMPLIANCE_THRESHOLDS.minimum) {
      recommendations.push('Major cultural compliance improvements needed')
    }

    if (violations.length > 2) {
      recommendations.push('Review email for cultural sensitivity before sending')
    }

    if (context.businessContext.invoiceCount > 5) {
      recommendations.push('Consider breaking consolidation into smaller groups')
    }

    if (context.emailContent.language === 'ar' &&
        !context.emailContent.content.includes('مع أطيب التحيات')) {
      recommendations.push('Add traditional Arabic closing salutation')
    }

    return recommendations
  }

  private async getIslamicCalendarInfo(date: Date): Promise<IslamicCalendarInfo> {
    // Placeholder - would integrate with Islamic calendar API
    return {
      isRamadan: false,
      isHolyMonth: false,
      currentHijriMonth: 'Safar',
      currentHijriYear: 1446,
      specialConsiderations: []
    }
  }

  private async isUAEHoliday(date: Date): Promise<boolean> {
    // Placeholder - would check against UAE holiday calendar
    const holidays = [
      new Date(date.getFullYear(), 0, 1), // New Year
      new Date(date.getFullYear(), 11, 2), // UAE National Day
    ]

    return holidays.some(holiday =>
      holiday.toDateString() === date.toDateString()
    )
  }

  private async isRamadanPeriod(): Promise<boolean> {
    // Placeholder - would check Islamic calendar
    return false
  }
}

// Singleton instance for global use
export const culturalComplianceEnhancedService = new CulturalComplianceEnhancedService()

// Backward compatibility
export const culturalComplianceService = culturalComplianceEnhancedService