import { prisma } from '../prisma'
import { emailAnalyticsService } from './email-analytics-service'

export interface SequencePerformanceMetrics {
  sequenceId: string
  sequenceName: string
  totalExecutions: number
  activeExecutions: number
  completedExecutions: number
  conversionRate: number
  averageCompletionTime: number
  paymentAcceleration: number // Days saved compared to manual follow-up
  roiMetrics: {
    totalInvoiceValue: number
    collectedAmount: number
    costPerExecution: number
    roi: number
  }
  culturalCompliance: {
    businessHoursCompliance: number
    culturalTimingScore: number
    arabicEngagementRate: number
    englishEngagementRate: number
  }
}

export interface PaymentCorrelation {
  sequenceId: string
  sequenceName: string
  paymentCorrelation: {
    totalInvoices: number
    paidAfterSequence: number
    averageDaysToPayment: number
    paymentRate: number
    averagePaymentAmount: number
  }
  stepCorrelation: Array<{
    stepNumber: number
    paymentsAfterStep: number
    averageDaysToPayment: number
    effectivenessScore: number
  }>
}

export interface CulturalEffectivenessReport {
  overallMetrics: {
    arabicVsEnglishPerformance: {
      arabic: { sent: number; openRate: number; conversionRate: number }
      english: { sent: number; openRate: number; conversionRate: number }
    }
    timingEffectiveness: {
      optimalTimes: Array<{
        hour: number
        dayOfWeek: number
        performance: number
      }>
      businessHoursCompliance: number
      weekendAvoidance: number
    }
    ramadanImpact: {
      duringRamadan: { sent: number; performance: number }
      outsideRamadan: { sent: number; performance: number }
      adjustmentRecommendations: string[]
    }
  }
  sequenceComparison: Array<{
    sequenceId: string
    sequenceName: string
    culturalScore: number
    improvementAreas: string[]
  }>
}

export interface ROIAnalysis {
  summary: {
    totalInvestment: number // Cost of automation system
    totalReturn: number // Additional payments collected
    netROI: number
    paybackPeriod: number // Months
  }
  sequenceROI: Array<{
    sequenceId: string
    sequenceName: string
    investment: number
    return: number
    roi: number
    executionCost: number
  }>
  comparisonMetrics: {
    automatedVsManual: {
      automated: {
        averageDaysToPayment: number
        collectionRate: number
        costPerCollection: number
      }
      manual: {
        averageDaysToPayment: number
        collectionRate: number
        costPerCollection: number
      }
      improvement: {
        fasterCollection: number // Days saved
        higherCollectionRate: number // % improvement
        costSavings: number // AED saved
      }
    }
  }
}

/**
 * Sequence Analytics Service
 * Provides comprehensive sequence performance analytics, cultural insights, and ROI analysis
 */
export class SequenceAnalyticsService {

  /**
   * Get comprehensive performance metrics for all sequences
   */
  async getSequencePerformanceMetrics(
    companyId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<SequencePerformanceMetrics[]> {
    
    const sequences = await prisma.follow_up_sequences.findMany({
      where: { companyId },
      include: {
        followUpLogs: {
          where: {
            sentAt: {
              gte: dateFrom,
              lte: dateTo
            }
          },
          include: {
            invoice: {
              include: { payments: true }
            },
            emailLogs: true
          }
        }
      }
    })

    const performanceMetrics: SequencePerformanceMetrics[] = []

    for (const sequence of sequences) {
      const metrics = await this.calculateSequenceMetrics(sequence, dateFrom, dateTo)
      performanceMetrics.push(metrics)
    }

    return performanceMetrics.sort((a, b) => b.conversionRate - a.conversionRate)
  }

  /**
   * Calculate detailed metrics for a single sequence
   */
  private async calculateSequenceMetrics(
    sequence: any,
    dateFrom: Date,
    dateTo: Date
  ): Promise<SequencePerformanceMetrics> {
    
    const logs = sequence.followUpLogs
    const totalExecutions = logs.length
    
    // Calculate completion metrics
    const steps = this.parseSequenceSteps(sequence.steps)
    const maxSteps = steps.length
    
    const completedExecutions = logs.filter((log: any) => 
      log.stepNumber >= maxSteps
    ).length
    
    const activeExecutions = totalExecutions - completedExecutions

    // Calculate conversion metrics
    const conversions = logs.filter((log: any) => {
      const invoice = log.invoice
      if (!invoice || !invoice.payments) return false
      
      const totalPaid = invoice.payments.reduce((sum: number, payment: any) => 
        sum + Number(payment.amount), 0
      )
      const invoiceAmount = Number(invoice.totalAmount || invoice.amount)
      
      return totalPaid >= invoiceAmount
    }).length

    const conversionRate = totalExecutions > 0 ? (conversions / totalExecutions) * 100 : 0

    // Calculate completion time
    const completedLogs = logs.filter((log: any) => log.stepNumber >= maxSteps)
    const averageCompletionTime = completedLogs.length > 0
      ? completedLogs.reduce((sum: number, log: any) => {
          const startDate = logs.find((l: any) => l.invoiceId === log.invoiceId && l.stepNumber === 1)?.sentAt || log.sentAt
          const endDate = log.sentAt
          return sum + (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        }, 0) / completedLogs.length
      : 0

    // Calculate ROI metrics
    const roiMetrics = await this.calculateROIMetrics(logs)

    // Calculate cultural compliance
    const culturalCompliance = await this.calculateCulturalCompliance(logs)

    // Calculate payment acceleration (simplified)
    const paymentAcceleration = Math.max(0, 15 - averageCompletionTime) // Assume manual takes 15 days

    return {
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      totalExecutions,
      activeExecutions,
      completedExecutions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageCompletionTime: Math.round(averageCompletionTime * 100) / 100,
      paymentAcceleration: Math.round(paymentAcceleration * 100) / 100,
      roiMetrics,
      culturalCompliance
    }
  }

  /**
   * Calculate ROI metrics for sequence logs
   */
  private async calculateROIMetrics(logs: any[]) {
    const totalInvoiceValue = logs.reduce((sum, log) => {
      const amount = Number(log.invoice?.totalAmount || log.invoice?.amount || 0)
      return sum + amount
    }, 0)

    const collectedAmount = logs.reduce((sum, log) => {
      if (!log.invoice?.payments) return sum
      const paid = log.invoice.payments.reduce((pSum: number, payment: any) => 
        pSum + Number(payment.amount), 0
      )
      return sum + paid
    }, 0)

    const costPerExecution = 5 // AED - simplified cost estimate
    const totalCost = logs.length * costPerExecution
    
    const roi = totalCost > 0 ? ((collectedAmount - totalCost) / totalCost) * 100 : 0

    return {
      totalInvoiceValue,
      collectedAmount,
      costPerExecution,
      roi: Math.round(roi * 100) / 100
    }
  }

  /**
   * Calculate cultural compliance metrics
   */
  private async calculateCulturalCompliance(logs: any[]) {
    const emailLogs = logs.flatMap(log => log.emailLogs || [])
    
    // Business hours compliance
    const businessHoursEmails = emailLogs.filter((email: any) => {
      if (!email.uaeSendTime) return false
      const day = email.uaeSendTime.getDay()
      const hour = email.uaeSendTime.getHours()
      return day >= 0 && day <= 4 && hour >= 8 && hour < 18
    }).length

    const businessHoursCompliance = emailLogs.length > 0 
      ? (businessHoursEmails / emailLogs.length) * 100 
      : 100

    // Cultural timing score (optimal times)
    const culturallyOptimalEmails = emailLogs.filter((email: any) => {
      if (!email.uaeSendTime) return false
      const day = email.uaeSendTime.getDay()
      const hour = email.uaeSendTime.getHours()
      return day >= 2 && day <= 4 && hour >= 10 && hour <= 11
    }).length

    const culturalTimingScore = emailLogs.length > 0 
      ? (culturallyOptimalEmails / emailLogs.length) * 100 
      : 100

    // Language engagement rates
    const arabicEmails = emailLogs.filter((email: any) => email.language === 'ARABIC')
    const englishEmails = emailLogs.filter((email: any) => email.language === 'ENGLISH')

    const arabicEngagementRate = arabicEmails.length > 0
      ? (arabicEmails.filter((email: any) => email.openedAt).length / arabicEmails.length) * 100
      : 0

    const englishEngagementRate = englishEmails.length > 0
      ? (englishEmails.filter((email: any) => email.openedAt).length / englishEmails.length) * 100
      : 0

    return {
      businessHoursCompliance: Math.round(businessHoursCompliance * 100) / 100,
      culturalTimingScore: Math.round(culturalTimingScore * 100) / 100,
      arabicEngagementRate: Math.round(arabicEngagementRate * 100) / 100,
      englishEngagementRate: Math.round(englishEngagementRate * 100) / 100
    }
  }

  /**
   * Analyze payment correlation with sequence execution
   */
  async getPaymentCorrelation(
    companyId: string,
    sequenceId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<PaymentCorrelation> {
    
    const sequence = await prisma.follow_up_sequences.findFirst({
      where: { id: sequenceId, companyId },
      include: {
        followUpLogs: {
          where: {
            sentAt: {
              gte: dateFrom,
              lte: dateTo
            }
          },
          include: {
            invoice: {
              include: { payments: true }
            }
          }
        }
      }
    })

    if (!sequence) {
      throw new Error('Sequence not found')
    }

    const logs = sequence.followUpLogs
    const invoiceIds = [...new Set(logs.map(log => log.invoiceId))]
    
    // Get payment data for invoices in this sequence
    const payments = await prisma.payment.findMany({
      where: {
        invoiceId: { in: invoiceIds },
        paymentDate: { gte: dateFrom, lte: dateTo }
      },
      include: { invoice: true }
    })

    // Calculate overall payment correlation
    const totalInvoices = invoiceIds.length
    const paidInvoices = payments.filter(payment => {
      const invoice = payment.invoice
      const sequenceStart = logs.find(log => log.invoiceId === invoice.id)?.sentAt
      return sequenceStart && payment.paymentDate >= sequenceStart
    })

    const paidAfterSequence = paidInvoices.length
    const paymentRate = totalInvoices > 0 ? (paidAfterSequence / totalInvoices) * 100 : 0

    const averageDaysToPayment = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, payment) => {
          const sequenceStart = logs.find(log => log.invoiceId === payment.invoice.id)?.sentAt
          if (!sequenceStart) return sum
          const days = (payment.paymentDate.getTime() - sequenceStart.getTime()) / (1000 * 60 * 60 * 24)
          return sum + days
        }, 0) / paidInvoices.length
      : 0

    const averagePaymentAmount = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, payment) => sum + Number(payment.amount), 0) / paidInvoices.length
      : 0

    // Calculate step-level correlation
    const steps = this.parseSequenceSteps(sequence.steps)
    const stepCorrelation = steps.map(step => {
      const stepLogs = logs.filter(log => log.stepNumber === step.stepNumber)
      const stepInvoiceIds = [...new Set(stepLogs.map(log => log.invoiceId))]
      
      const paymentsAfterStep = payments.filter(payment => {
        const stepLog = stepLogs.find(log => log.invoiceId === payment.invoice.id)
        return stepLog && payment.paymentDate >= stepLog.sentAt
      }).length

      const stepDaysToPayment = paymentsAfterStep > 0
        ? payments.filter(payment => {
            const stepLog = stepLogs.find(log => log.invoiceId === payment.invoice.id)
            return stepLog && payment.paymentDate >= stepLog.sentAt
          }).reduce((sum, payment) => {
            const stepLog = stepLogs.find(log => log.invoiceId === payment.invoice.id)
            if (!stepLog) return sum
            const days = (payment.paymentDate.getTime() - stepLog.sentAt.getTime()) / (1000 * 60 * 60 * 24)
            return sum + days
          }, 0) / paymentsAfterStep
        : 0

      const effectivenessScore = stepInvoiceIds.length > 0 
        ? (paymentsAfterStep / stepInvoiceIds.length) * 100 
        : 0

      return {
        stepNumber: step.stepNumber,
        paymentsAfterStep,
        averageDaysToPayment: Math.round(stepDaysToPayment * 100) / 100,
        effectivenessScore: Math.round(effectivenessScore * 100) / 100
      }
    })

    return {
      sequenceId,
      sequenceName: sequence.name,
      paymentCorrelation: {
        totalInvoices,
        paidAfterSequence,
        averageDaysToPayment: Math.round(averageDaysToPayment * 100) / 100,
        paymentRate: Math.round(paymentRate * 100) / 100,
        averagePaymentAmount: Math.round(averagePaymentAmount * 100) / 100
      },
      stepCorrelation
    }
  }

  /**
   * Generate cultural effectiveness report
   */
  async getCulturalEffectivenessReport(
    companyId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<CulturalEffectivenessReport> {
    
    // Get email analytics for language comparison
    const emailAnalytics = await emailAnalyticsService.getEmailAnalytics(companyId, dateFrom, dateTo)
    
    // Get sequence performance metrics
    const sequenceMetrics = await this.getSequencePerformanceMetrics(companyId, dateFrom, dateTo)

    // Calculate timing effectiveness
    const timingEffectiveness = {
      optimalTimes: emailAnalytics.timeAnalytics.hourlyStats
        .filter(hour => hour.sent > 5)
        .sort((a, b) => b.openRate - a.openRate)
        .slice(0, 5)
        .map(hour => ({
          hour: hour.hour,
          dayOfWeek: 2, // Simplified
          performance: hour.openRate
        })),
      businessHoursCompliance: emailAnalytics.timeAnalytics.dayOfWeekStats
        .filter(day => day.dayOfWeek >= 0 && day.dayOfWeek <= 4)
        .reduce((sum, day) => sum + day.sent, 0) / 
        emailAnalytics.timeAnalytics.dayOfWeekStats.reduce((sum, day) => sum + day.sent, 0) * 100,
      weekendAvoidance: 100 - (emailAnalytics.timeAnalytics.dayOfWeekStats
        .filter(day => day.dayOfWeek === 5 || day.dayOfWeek === 6)
        .reduce((sum, day) => sum + day.sent, 0) / 
        emailAnalytics.timeAnalytics.dayOfWeekStats.reduce((sum, day) => sum + day.sent, 0) * 100)
    }

    // Ramadan impact analysis (simplified)
    const ramadanImpact = {
      duringRamadan: { sent: 0, performance: 0 },
      outsideRamadan: { sent: emailAnalytics.summary.totalSent, performance: emailAnalytics.summary.openRate },
      adjustmentRecommendations: [
        'Avoid late afternoon sends during Ramadan',
        'Use more formal tone during holy month',
        'Respect iftar and suhur times'
      ]
    }

    // Sequence cultural comparison
    const sequenceComparison = sequenceMetrics.map(metrics => ({
      sequenceId: metrics.sequenceId,
      sequenceName: metrics.sequenceName,
      culturalScore: (
        metrics.culturalCompliance.businessHoursCompliance +
        metrics.culturalCompliance.culturalTimingScore +
        Math.max(metrics.culturalCompliance.arabicEngagementRate, metrics.culturalCompliance.englishEngagementRate)
      ) / 3,
      improvementAreas: this.identifyImprovementAreas(metrics.culturalCompliance)
    }))

    return {
      overallMetrics: {
        arabicVsEnglishPerformance: {
          arabic: emailAnalytics.languageAnalytics.arabic,
          english: emailAnalytics.languageAnalytics.english
        },
        timingEffectiveness,
        ramadanImpact
      },
      sequenceComparison
    }
  }

  /**
   * Calculate ROI analysis for the entire automation system
   */
  async getROIAnalysis(
    companyId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<ROIAnalysis> {
    
    const sequenceMetrics = await this.getSequencePerformanceMetrics(companyId, dateFrom, dateTo)
    
    // Calculate total investment (simplified)
    const totalInvestment = 10000 // AED - automation setup and maintenance cost
    
    // Calculate total return
    const totalReturn = sequenceMetrics.reduce((sum, metrics) => 
      sum + metrics.roiMetrics.collectedAmount, 0
    )
    
    const netROI = totalInvestment > 0 ? ((totalReturn - totalInvestment) / totalInvestment) * 100 : 0
    const paybackPeriod = totalReturn > 0 ? totalInvestment / (totalReturn / 12) : 0 // Months

    // Sequence-level ROI
    const sequenceROI = sequenceMetrics.map(metrics => ({
      sequenceId: metrics.sequenceId,
      sequenceName: metrics.sequenceName,
      investment: metrics.totalExecutions * 5, // AED per execution
      return: metrics.roiMetrics.collectedAmount,
      roi: metrics.roiMetrics.roi,
      executionCost: metrics.roiMetrics.costPerExecution
    }))

    // Automated vs manual comparison (estimated)
    const comparisonMetrics = {
      automatedVsManual: {
        automated: {
          averageDaysToPayment: sequenceMetrics.reduce((sum, m) => sum + m.averageCompletionTime, 0) / sequenceMetrics.length,
          collectionRate: sequenceMetrics.reduce((sum, m) => sum + m.conversionRate, 0) / sequenceMetrics.length,
          costPerCollection: 50 // AED
        },
        manual: {
          averageDaysToPayment: 25, // Estimated manual follow-up time
          collectionRate: 60, // Estimated manual collection rate
          costPerCollection: 150 // AED - staff time
        },
        improvement: {
          fasterCollection: 10, // Days saved
          higherCollectionRate: 15, // % improvement
          costSavings: 100 // AED per collection
        }
      }
    }

    return {
      summary: {
        totalInvestment,
        totalReturn,
        netROI: Math.round(netROI * 100) / 100,
        paybackPeriod: Math.round(paybackPeriod * 100) / 100
      },
      sequenceROI,
      comparisonMetrics
    }
  }

  /**
   * Parse sequence steps from JSON
   */
  private parseSequenceSteps(stepsJson: any): any[] {
    try {
      if (typeof stepsJson === 'string') {
        return JSON.parse(stepsJson)
      }
      return Array.isArray(stepsJson) ? stepsJson : []
    } catch {
      return []
    }
  }

  /**
   * Identify improvement areas for cultural compliance
   */
  private identifyImprovementAreas(compliance: any): string[] {
    const areas: string[] = []

    if (compliance.businessHoursCompliance < 90) {
      areas.push('Improve business hours compliance')
    }

    if (compliance.culturalTimingScore < 70) {
      areas.push('Optimize send times for UAE culture (Tue-Thu 10-11 AM)')
    }

    if (compliance.arabicEngagementRate < 20 && compliance.englishEngagementRate > compliance.arabicEngagementRate + 10) {
      areas.push('Improve Arabic content engagement')
    }

    if (compliance.englishEngagementRate < 20 && compliance.arabicEngagementRate > compliance.englishEngagementRate + 10) {
      areas.push('Improve English content engagement')
    }

    return areas
  }
}

// Export singleton instance
export const sequenceAnalyticsService = new SequenceAnalyticsService()