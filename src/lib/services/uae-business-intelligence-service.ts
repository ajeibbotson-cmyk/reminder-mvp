/**
 * UAE Business Intelligence Analytics Service
 * UAE market-specific analytics with cultural compliance, business intelligence, and economic insights
 */

import { prisma } from '../prisma'
import { Decimal } from 'decimal.js'
import {
  UAEBusinessIntelligence,
  AnalyticsDateRange,
  AnalyticsFilters,
  AnalyticsResponse
} from '../types/analytics'
import { DEFAULT_UAE_BUSINESS_HOURS } from '../uae-business-rules'

export class UAEBusinessIntelligenceService {

  /**
   * Get comprehensive UAE business intelligence analytics
   */
  async getUAEBusinessIntelligence(
    companyId: string,
    filters: AnalyticsFilters
  ): Promise<AnalyticsResponse<UAEBusinessIntelligence>> {
    const startTime = Date.now()

    try {
      // Get cultural compliance metrics
      const culturalCompliance = await this.getCulturalComplianceMetrics(companyId, filters.dateRange)

      // Get UAE market insights
      const marketInsights = await this.getUAEMarketInsights(companyId)

      // Get economic impact analysis
      const economicImpact = await this.getEconomicImpactAnalysis(companyId, filters.dateRange)

      const intelligence: UAEBusinessIntelligence = {
        culturalCompliance,
        marketInsights,
        economicImpact
      }

      const queryTime = Date.now() - startTime

      return {
        data: intelligence,
        metadata: {
          queryTime,
          recordsProcessed: await this.getTotalRecordsCount(companyId),
          cacheHit: false,
          freshness: new Date(),
          filters,
          performance: {
            queryOptimization: 'UAE-specific analytics with cultural and economic indicators',
            indexesUsed: [
              'uae_send_time',
              'company_id_business_type',
              'company_id_trn'
            ],
            executionPlan: 'Cultural compliance scoring with business intelligence aggregations'
          }
        },
        recommendations: this.generateUAERecommendations(intelligence)
      }
    } catch (error) {
      console.error('Error calculating UAE business intelligence:', error)
      throw new Error('Failed to calculate UAE business intelligence metrics')
    }
  }

  /**
   * Get cultural compliance metrics
   */
  private async getCulturalComplianceMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    // Get business hours compliance
    const businessHoursRespect = await this.getBusinessHoursCompliance(companyId, dateRange)

    // Get prayer time avoidance metrics
    const prayerTimeAvoidance = await this.getPrayerTimeAvoidanceMetrics(companyId, dateRange)

    // Get Ramadan adjustments
    const ramadanAdjustments = await this.getRamadanAdjustments(companyId, dateRange)

    // Get language effectiveness
    const languageEffectiveness = await this.getLanguageEffectiveness(companyId, dateRange)

    // Calculate overall cultural compliance score
    const overallScore = this.calculateCulturalComplianceScore({
      businessHoursRespect,
      prayerTimeAvoidance,
      ramadanAdjustments,
      languageEffectiveness
    })

    return {
      overallScore,
      businessHoursRespect,
      prayerTimeAvoidance,
      ramadanAdjustments,
      languageEffectiveness
    }
  }

  /**
   * Get business hours compliance metrics
   */
  private async getBusinessHoursCompliance(companyId: string, dateRange: AnalyticsDateRange) {
    const businessHours = DEFAULT_UAE_BUSINESS_HOURS

    // Get all emails sent during the period
    const emails = await prisma.emailLog.findMany({
      where: {
        companyId,
        sentAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      },
      select: {
        id: true,
        sentAt: true,
        uaeSendTime: true
      }
    })

    let compliantEmails = 0
    let violationsCount = 0
    const improvements: string[] = []

    emails.forEach(email => {
      const sendTime = email.uaeSendTime || email.sentAt
      if (!sendTime) return

      const hour = sendTime.getHours()
      const dayOfWeek = sendTime.getDay()

      // Check if sent during UAE business hours
      const isWorkingDay = businessHours.workingDays.includes(dayOfWeek)
      const isWorkingHour = hour >= businessHours.startHour && hour <= businessHours.endHour

      // Check for lunch break
      const isDuringLunch = businessHours.lunchBreak?.enabled &&
                           hour >= businessHours.lunchBreak.startHour &&
                           hour < businessHours.lunchBreak.endHour

      // Check for Friday prayer time
      const isDuringFridayPrayer = dayOfWeek === 5 && // Friday
                                  businessHours.fridayPrayerBreak?.enabled &&
                                  hour >= businessHours.fridayPrayerBreak.startHour &&
                                  hour < businessHours.fridayPrayerBreak.endHour

      if (isWorkingDay && isWorkingHour && !isDuringLunch && !isDuringFridayPrayer) {
        compliantEmails++
      } else {
        violationsCount++
      }
    })

    const complianceRate = emails.length > 0 ? (compliantEmails / emails.length) * 100 : 100

    // Generate improvements based on violations
    if (violationsCount > 0) {
      improvements.push(`${violationsCount} emails sent outside business hours`)
      improvements.push('Consider implementing automated scheduling for UAE business hours')
    }

    return {
      score: Math.round(complianceRate),
      violationsCount,
      improvements
    }
  }

  /**
   * Get prayer time avoidance metrics
   */
  private async getPrayerTimeAvoidanceMetrics(companyId: string, dateRange: AnalyticsDateRange) {
    // Prayer times in UAE (approximate, should be calculated dynamically)
    const prayerTimes = {
      fajr: { start: 5, end: 6 },
      dhuhr: { start: 12, end: 13 },
      asr: { start: 15, end: 16 },
      maghrib: { start: 18, end: 19 },
      isha: { start: 19, end: 20 }
    }

    const emails = await prisma.emailLog.findMany({
      where: {
        companyId,
        sentAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      },
      select: {
        sentAt: true,
        uaeSendTime: true
      }
    })

    let respectfulTiming = 0
    let adjustmentsMade = 0

    emails.forEach(email => {
      const sendTime = email.uaeSendTime || email.sentAt
      if (!sendTime) return

      const hour = sendTime.getHours()
      let isDuringPrayer = false

      // Check if email was sent during prayer times
      Object.values(prayerTimes).forEach(prayer => {
        if (hour >= prayer.start && hour < prayer.end) {
          isDuringPrayer = true
        }
      })

      if (!isDuringPrayer) {
        respectfulTiming++
      }

      // Count adjustments if UAE send time differs from original sent time
      if (email.uaeSendTime && email.sentAt &&
          email.uaeSendTime.getTime() !== email.sentAt.getTime()) {
        adjustmentsMade++
      }
    })

    const respectfulRate = emails.length > 0 ? (respectfulTiming / emails.length) * 100 : 100

    return {
      score: Math.round(respectfulRate),
      respectfulTiming,
      adjustmentsMade
    }
  }

  /**
   * Get Ramadan adjustments metrics
   */
  private async getRamadanAdjustments(companyId: string, dateRange: AnalyticsDateRange) {
    // Identify if date range overlaps with Ramadan (approximate dates)
    const isRamadanPeriod = this.isRamadanPeriod(dateRange)

    if (!isRamadanPeriod) {
      return {
        score: 100, // Full score if not during Ramadan
        adaptedCommunications: 0,
        culturalSensitivity: 100
      }
    }

    // Get emails during Ramadan period
    const emails = await prisma.emailLog.findMany({
      where: {
        companyId,
        sentAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      },
      select: {
        sentAt: true,
        uaeSendTime: true,
        subject: true,
        content: true
      }
    })

    let adaptedCommunications = 0
    let culturallySensitiveEmails = 0

    emails.forEach(email => {
      const sendTime = email.uaeSendTime || email.sentAt
      if (!sendTime) return

      const hour = sendTime.getHours()

      // Check if sent during Ramadan-appropriate hours (shorter working hours)
      if (hour >= 9 && hour <= 15) { // Ramadan working hours
        adaptedCommunications++
      }

      // Check for cultural sensitivity in content (simplified check)
      const content = (email.subject + ' ' + email.content).toLowerCase()
      if (content.includes('ramadan') || content.includes('iftar') || content.includes('blessed')) {
        culturallySensitiveEmails++
      }
    })

    const adaptationRate = emails.length > 0 ? (adaptedCommunications / emails.length) * 100 : 0
    const sensitivityRate = emails.length > 0 ? (culturallySensitiveEmails / emails.length) * 100 : 0

    return {
      score: Math.round((adaptationRate + sensitivityRate) / 2),
      adaptedCommunications,
      culturalSensitivity: Math.round(sensitivityRate)
    }
  }

  /**
   * Get language effectiveness metrics
   */
  private async getLanguageEffectiveness(companyId: string, dateRange: AnalyticsDateRange) {
    const [englishMetrics, arabicMetrics] = await Promise.all([
      this.getLanguageMetrics(companyId, dateRange, 'ENGLISH'),
      this.getLanguageMetrics(companyId, dateRange, 'ARABIC')
    ])

    const totalUsage = englishMetrics.usage + arabicMetrics.usage
    const bilingualEffectiveness = totalUsage > 0 ?
      ((englishMetrics.effectiveness * englishMetrics.usage +
        arabicMetrics.effectiveness * arabicMetrics.usage) / totalUsage) : 0

    return {
      arabicUsage: arabicMetrics.usage,
      englishUsage: englishMetrics.usage,
      bilingualEffectiveness: Math.round(bilingualEffectiveness)
    }
  }

  /**
   * Get metrics for specific language
   */
  private async getLanguageMetrics(companyId: string, dateRange: AnalyticsDateRange, language: 'ENGLISH' | 'ARABIC') {
    const emails = await prisma.emailLog.findMany({
      where: {
        companyId,
        language,
        sentAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      },
      select: {
        openedAt: true,
        clickedAt: true
      }
    })

    const usage = emails.length
    const opened = emails.filter(e => e.openedAt).length
    const clicked = emails.filter(e => e.clickedAt).length

    const openRate = usage > 0 ? (opened / usage) * 100 : 0
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
    const effectiveness = (openRate + clickRate) / 2

    return {
      usage,
      effectiveness: Math.round(effectiveness)
    }
  }

  /**
   * Get UAE market insights
   */
  private async getUAEMarketInsights(companyId: string) {
    // Get business type distribution
    const businessTypeDistribution = await this.getBusinessTypeDistribution(companyId)

    // Get geographic distribution
    const geographicDistribution = await this.getGeographicDistribution(companyId)

    // Get industry performance
    const industryPerformance = await this.getIndustryPerformance(companyId)

    // Get TRN compliance rate
    const trnComplianceRate = await this.getTRNComplianceRate(companyId)

    // Get VAT calculation accuracy
    const vatCalculationAccuracy = await this.getVATCalculationAccuracy(companyId)

    return {
      businessTypeDistribution,
      geographicDistribution,
      industryPerformance,
      trnComplianceRate,
      vatCalculationAccuracy
    }
  }

  /**
   * Get business type distribution
   */
  private async getBusinessTypeDistribution(companyId: string) {
    const distribution = await prisma.customer.groupBy({
      by: ['businessType'],
      where: {
        companyId,
        isActive: true,
        businessType: { not: null }
      },
      _count: { id: true }
    })

    const result: Record<string, number> = {}
    distribution.forEach(item => {
      if (item.businessType) {
        result[item.businessType] = item._count.id
      }
    })

    return result
  }

  /**
   * Get geographic distribution (simplified)
   */
  private async getGeographicDistribution(companyId: string) {
    // Simplified geographic distribution based on common UAE emirates
    const customers = await prisma.customer.count({
      where: { companyId, isActive: true }
    })

    // Simulated distribution (would be based on actual address data)
    return {
      'Dubai': Math.round(customers * 0.4),
      'Abu Dhabi': Math.round(customers * 0.25),
      'Sharjah': Math.round(customers * 0.15),
      'Ajman': Math.round(customers * 0.1),
      'Other Emirates': Math.round(customers * 0.1)
    }
  }

  /**
   * Get industry performance analysis
   */
  private async getIndustryPerformance(companyId: string) {
    const customers = await prisma.customer.findMany({
      where: {
        companyId,
        isActive: true
      },
      include: {
        invoices: {
          where: { isActive: true },
          include: {
            payments: true
          }
        }
      }
    })

    // Group by business type and calculate performance metrics
    const industryData: Record<string, {
      totalInvoices: number
      paidInvoices: number
      totalDays: number
      totalAmount: Decimal
      riskScores: number[]
    }> = {}

    customers.forEach(customer => {
      const businessType = customer.businessType || 'Unknown'

      if (!industryData[businessType]) {
        industryData[businessType] = {
          totalInvoices: 0,
          paidInvoices: 0,
          totalDays: 0,
          totalAmount: new Decimal(0),
          riskScores: []
        }
      }

      customer.invoices.forEach(invoice => {
        industryData[businessType].totalInvoices++
        industryData[businessType].totalAmount = industryData[businessType].totalAmount.add(invoice.totalAmount || 0)

        if (invoice.status === 'PAID' && invoice.payments.length > 0) {
          industryData[businessType].paidInvoices++
          const payment = invoice.payments[0]
          const days = Math.ceil((payment.paymentDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          industryData[businessType].totalDays += Math.max(0, days)
        }
      })

      if (customer.riskScore) {
        industryData[businessType].riskScores.push(customer.riskScore.toNumber())
      }
    })

    // Calculate performance metrics
    return Object.entries(industryData).map(([industry, data]) => ({
      industry,
      avgPaymentDays: data.paidInvoices > 0 ? Math.round((data.totalDays / data.paidInvoices) * 100) / 100 : 0,
      collectionRate: data.totalInvoices > 0 ? (data.paidInvoices / data.totalInvoices) * 100 : 0,
      riskLevel: data.riskScores.length > 0 ?
        data.riskScores.reduce((sum, score) => sum + score, 0) / data.riskScores.length : 0
    }))
  }

  /**
   * Get TRN compliance rate
   */
  private async getTRNComplianceRate(companyId: string) {
    const [totalCustomers, customersWithTRN] = await Promise.all([
      prisma.customer.count({
        where: { companyId, isActive: true }
      }),
      prisma.customer.count({
        where: {
          companyId,
          isActive: true,
          trn: { not: null }
        }
      })
    ])

    return totalCustomers > 0 ? (customersWithTRN / totalCustomers) * 100 : 0
  }

  /**
   * Get VAT calculation accuracy
   */
  private async getVATCalculationAccuracy(companyId: string) {
    const invoices = await prisma.invoices.findMany({
      where: {
        companyId,
        isActive: true,
        vatAmount: { not: null }
      },
      include: {
        invoiceItems: true
      }
    })

    let accurateCalculations = 0

    invoices.forEach(invoice => {
      // Verify VAT calculation accuracy (simplified check)
      const expectedVAT = invoice.invoiceItems.reduce((sum, item) => {
        const vatRate = item.vatRate?.toNumber() || 0
        const itemTotal = item.total.toNumber()
        return sum + (itemTotal * vatRate / 100)
      }, 0)

      const actualVAT = invoice.vatAmount?.toNumber() || 0
      const difference = Math.abs(expectedVAT - actualVAT)

      // Consider accurate if difference is less than 0.01 AED
      if (difference < 0.01) {
        accurateCalculations++
      }
    })

    return invoices.length > 0 ? (accurateCalculations / invoices.length) * 100 : 100
  }

  /**
   * Get economic impact analysis
   */
  private async getEconomicImpactAnalysis(companyId: string, dateRange: AnalyticsDateRange) {
    // Currency stability indicator (simplified)
    const currencyStability = 98.5 // AED is pegged to USD, so highly stable

    // Business confidence based on payment behaviors
    const businessConfidence = await this.calculateBusinessConfidence(companyId, dateRange)

    // Seasonal impacts
    const seasonalImpacts = await this.getSeasonalImpacts(companyId, dateRange)

    return {
      currencyStability,
      businessConfidence,
      seasonalImpacts
    }
  }

  /**
   * Calculate business confidence indicator
   */
  private async calculateBusinessConfidence(companyId: string, dateRange: AnalyticsDateRange) {
    const invoices = await prisma.invoices.findMany({
      where: {
        companyId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        },
        isActive: true
      },
      include: {
        payments: true
      }
    })

    const paidOnTime = invoices.filter(invoice =>
      invoice.status === 'PAID' &&
      invoice.payments.length > 0 &&
      invoice.payments[0].paymentDate <= invoice.dueDate
    ).length

    const confidence = invoices.length > 0 ? (paidOnTime / invoices.length) * 100 : 50

    return Math.round(confidence)
  }

  /**
   * Get seasonal impacts
   */
  private async getSeasonalImpacts(companyId: string, dateRange: AnalyticsDateRange) {
    const ramadanImpact = await this.calculateRamadanImpact(companyId, dateRange)
    const summerImpact = await this.calculateSummerImpact(companyId, dateRange)
    const yearEndImpact = await this.calculateYearEndImpact(companyId, dateRange)

    return {
      ramadan: {
        impact: ramadanImpact,
        adjustments: [
          'Reduced working hours during Ramadan',
          'Cultural sensitivity in communications',
          'Adjusted collection schedules'
        ]
      },
      summer: {
        impact: summerImpact,
        adjustments: [
          'Earlier morning communications',
          'Avoid midday contact',
          'Extended evening hours consideration'
        ]
      },
      yearEnd: {
        impact: yearEndImpact,
        adjustments: [
          'Holiday schedule adjustments',
          'Year-end payment reminders',
          'Budget cycle considerations'
        ]
      }
    }
  }

  /**
   * Helper methods for seasonal impact calculations
   */
  private calculateRamadanImpact(companyId: string, dateRange: AnalyticsDateRange): Promise<number> {
    // Simplified calculation - would be more sophisticated in production
    return Promise.resolve(this.isRamadanPeriod(dateRange) ? 15 : 0) // 15% impact during Ramadan
  }

  private calculateSummerImpact(companyId: string, dateRange: AnalyticsDateRange): Promise<number> {
    const summerMonths = [6, 7, 8] // June, July, August
    const isSummer = summerMonths.includes(dateRange.startDate.getMonth() + 1)
    return Promise.resolve(isSummer ? 10 : 0) // 10% impact during summer
  }

  private calculateYearEndImpact(companyId: string, dateRange: AnalyticsDateRange): Promise<number> {
    const isYearEnd = dateRange.startDate.getMonth() >= 10 // November, December
    return Promise.resolve(isYearEnd ? 20 : 0) // 20% impact during year-end
  }

  /**
   * Check if date range overlaps with Ramadan period
   */
  private isRamadanPeriod(dateRange: AnalyticsDateRange): boolean {
    // Simplified check - in production, would use Islamic calendar calculations
    const year = dateRange.startDate.getFullYear()
    const approximateRamadanStart = new Date(year, 2, 15) // Approximate March 15
    const approximateRamadanEnd = new Date(year, 3, 15) // Approximate April 15

    return dateRange.startDate <= approximateRamadanEnd && dateRange.endDate >= approximateRamadanStart
  }

  /**
   * Calculate overall cultural compliance score
   */
  private calculateCulturalComplianceScore(metrics: {
    businessHoursRespect: { score: number }
    prayerTimeAvoidance: { score: number }
    ramadanAdjustments: { score: number }
    languageEffectiveness: { bilingualEffectiveness: number }
  }): number {
    const weights = {
      businessHours: 0.3,
      prayerTime: 0.25,
      ramadan: 0.2,
      language: 0.25
    }

    return Math.round(
      metrics.businessHoursRespect.score * weights.businessHours +
      metrics.prayerTimeAvoidance.score * weights.prayerTime +
      metrics.ramadanAdjustments.score * weights.ramadan +
      metrics.languageEffectiveness.bilingualEffectiveness * weights.language
    )
  }

  /**
   * Get total records count for performance metadata
   */
  private async getTotalRecordsCount(companyId: string): Promise<number> {
    const [emails, customers, invoices] = await Promise.all([
      prisma.emailLog.count({ where: { companyId } }),
      prisma.customer.count({ where: { companyId, isActive: true } }),
      prisma.invoices.count({ where: { companyId, isActive: true } })
    ])

    return emails + customers + invoices
  }

  /**
   * Generate UAE-specific recommendations
   */
  private generateUAERecommendations(intelligence: UAEBusinessIntelligence) {
    const recommendations = []

    // Cultural compliance recommendations
    if (intelligence.culturalCompliance.overallScore < 80) {
      recommendations.push({
        type: 'business' as const,
        message: 'Cultural compliance score below 80%. Review communication timing and content.',
        action: 'Implement UAE cultural best practices'
      })
    }

    if (intelligence.culturalCompliance.businessHoursRespect.violationsCount > 10) {
      recommendations.push({
        type: 'business' as const,
        message: `${intelligence.culturalCompliance.businessHoursRespect.violationsCount} business hours violations detected.`,
        action: 'Enable automatic UAE business hours scheduling'
      })
    }

    // Market insights recommendations
    if (intelligence.marketInsights.trnComplianceRate < 90) {
      recommendations.push({
        type: 'business' as const,
        message: `TRN compliance at ${Math.round(intelligence.marketInsights.trnComplianceRate)}%. Improve customer data collection.`,
        action: 'Enhance customer onboarding with TRN validation'
      })
    }

    if (intelligence.marketInsights.vatCalculationAccuracy < 95) {
      recommendations.push({
        type: 'performance' as const,
        message: 'VAT calculation accuracy needs improvement.',
        action: 'Review VAT calculation algorithms and validation'
      })
    }

    return recommendations
  }
}

// Export singleton instance
export const uaeBusinessIntelligenceService = new UAEBusinessIntelligenceService()