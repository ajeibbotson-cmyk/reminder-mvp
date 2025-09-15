/**
 * UAE Business Compliance Service
 * Comprehensive compliance system for UAE business regulations and practices
 * 
 * Features:
 * - UAE VAT compliance validation
 * - TRN (Tax Registration Number) validation and verification
 * - UAE business hours enforcement
 * - Holiday calendar awareness
 * - Currency compliance (AED focus)
 * - Financial year calculations (UAE fiscal year)
 * - Arabic language support validation
 * - Emirates-specific business rules
 * - Federal tax authority integration (mock)
 * - Automated compliance reporting
 */

import { Decimal } from 'decimal.js'
import { 
  validateUAETRN, 
  formatUAETRN, 
  calculateInvoiceVAT, 
  formatUAECurrency,
  isUAEBusinessHours,
  getNextUAEBusinessHour,
  calculatePaymentDueDate 
} from '@/lib/vat-calculator'

// UAE-specific constants
export const UAE_VAT_RATES = {
  STANDARD: 5.0, // 5% VAT rate
  ZERO_RATED: 0.0, // Essential goods, exports
  EXEMPT: 0.0 // Financial services, education, healthcare
} as const

export const UAE_FISCAL_YEAR = {
  START_MONTH: 1, // January
  START_DAY: 1,
  END_MONTH: 12, // December
  END_DAY: 31
} as const

export const UAE_BUSINESS_DAYS = [0, 1, 2, 3, 4] // Sunday to Thursday
export const UAE_WEEKEND_DAYS = [5, 6] // Friday and Saturday

export const UAE_SUPPORTED_CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR'] as const

// Emirates enum for location-specific rules
export enum Emirates {
  ABU_DHABI = 'Abu Dhabi',
  DUBAI = 'Dubai',
  SHARJAH = 'Sharjah',
  AJMAN = 'Ajman',
  UMM_AL_QUWAIN = 'Umm Al Quwain',
  RAS_AL_KHAIMAH = 'Ras Al Khaimah',
  FUJAIRAH = 'Fujairah'
}

// Compliance validation result
export interface ComplianceValidationResult {
  isCompliant: boolean
  violations: ComplianceViolation[]
  warnings: ComplianceWarning[]
  score: number // 0-100 compliance score
  recommendations: string[]
  metadata: {
    validatedAt: Date
    validatorVersion: string
    regulationsChecked: string[]
  }
}

// Compliance violation
export interface ComplianceViolation {
  code: string
  type: 'VAT' | 'TRN' | 'CURRENCY' | 'BUSINESS_HOURS' | 'LANGUAGE' | 'FINANCIAL'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  field: string
  currentValue: any
  expectedValue?: any
  regulation: string
  remediation: string
}

// Compliance warning
export interface ComplianceWarning {
  code: string
  type: string
  description: string
  recommendation: string
}

// UAE business context
export interface UAEBusinessContext {
  companyTRN?: string
  emirate: Emirates
  businessType: 'MAINLAND' | 'FREE_ZONE' | 'OFFSHORE'
  fiscalYearEnd: Date
  defaultCurrency: string
  arabicSupport: boolean
  businessHours: {
    start: number // 24-hour format
    end: number
    timezone: string
  }
}

// Invoice compliance check
export interface InvoiceComplianceCheck {
  invoiceNumber: string
  issueDate: Date
  dueDate: Date
  supplierTRN: string
  customerTRN?: string
  currency: string
  subtotal: Decimal
  vatAmount: Decimal
  totalAmount: Decimal
  lineItems: Array<{
    description: string
    descriptionAr?: string
    quantity: Decimal
    unitPrice: Decimal
    vatRate: Decimal
    taxCategory: string
  }>
  arabicSupport: boolean
}

// UAE holiday information
export interface UAEHoliday {
  name: string
  nameAr: string
  date: Date
  type: 'NATIONAL' | 'RELIGIOUS' | 'CULTURAL'
  isObserved: boolean
  emirateSpecific?: Emirates[]
}

/**
 * UAE Business Compliance Service
 * Comprehensive compliance validation for UAE business regulations
 */
export class UAEComplianceService {
  private readonly currentYear = new Date().getFullYear()
  
  // UAE public holidays (2024-2025)
  private readonly uaeHolidays: UAEHoliday[] = [
    {
      name: 'New Year\'s Day',
      nameAr: 'رأس السنة الميلادية',
      date: new Date(this.currentYear, 0, 1),
      type: 'NATIONAL',
      isObserved: true
    },
    {
      name: 'Eid Al Fitr',
      nameAr: 'عيد الفطر',
      date: new Date(this.currentYear, 3, 10), // Approximate - varies by lunar calendar
      type: 'RELIGIOUS',
      isObserved: true
    },
    {
      name: 'Arafat Day',
      nameAr: 'يوم عرفة',
      date: new Date(this.currentYear, 5, 15), // Approximate
      type: 'RELIGIOUS',
      isObserved: true
    },
    {
      name: 'Eid Al Adha',
      nameAr: 'عيد الأضحى',
      date: new Date(this.currentYear, 5, 16), // Approximate
      type: 'RELIGIOUS',
      isObserved: true
    },
    {
      name: 'Islamic New Year',
      nameAr: 'رأس السنة الهجرية',
      date: new Date(this.currentYear, 6, 7), // Approximate
      type: 'RELIGIOUS',
      isObserved: true
    },
    {
      name: 'Prophet Muhammad\'s Birthday',
      nameAr: 'المولد النبوي الشريف',
      date: new Date(this.currentYear, 8, 15), // Approximate
      type: 'RELIGIOUS',
      isObserved: true
    },
    {
      name: 'UAE National Day',
      nameAr: 'اليوم الوطني لدولة الإمارات',
      date: new Date(this.currentYear, 11, 2),
      type: 'NATIONAL',
      isObserved: true
    },
    {
      name: 'Commemoration Day',
      nameAr: 'يوم الشهيد',
      date: new Date(this.currentYear, 10, 30),
      type: 'NATIONAL',
      isObserved: true
    }
  ]

  /**
   * Validate comprehensive UAE business compliance
   */
  public validateCompliance(
    data: any,
    businessContext: UAEBusinessContext,
    checkType: 'INVOICE' | 'PAYMENT' | 'CUSTOMER' | 'GENERAL' = 'GENERAL'
  ): ComplianceValidationResult {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []
    const regulationsChecked: string[] = []

    // VAT compliance validation
    const vatValidation = this.validateVATCompliance(data, businessContext)
    violations.push(...vatValidation.violations)
    warnings.push(...vatValidation.warnings)
    regulationsChecked.push('UAE VAT Law', 'Federal Decree-Law No. 8 of 2017')

    // TRN validation
    const trnValidation = this.validateTRNCompliance(data, businessContext)
    violations.push(...trnValidation.violations)
    warnings.push(...trnValidation.warnings)
    regulationsChecked.push('Tax Registration Number Requirements')

    // Currency compliance
    const currencyValidation = this.validateCurrencyCompliance(data, businessContext)
    violations.push(...currencyValidation.violations)
    warnings.push(...currencyValidation.warnings)
    regulationsChecked.push('UAE Central Bank Regulations')

    // Business hours compliance
    const businessHoursValidation = this.validateBusinessHoursCompliance(data, businessContext)
    violations.push(...businessHoursValidation.violations)
    warnings.push(...businessHoursValidation.warnings)
    regulationsChecked.push('UAE Labour Law')

    // Arabic language support (if required)
    if (businessContext.arabicSupport) {
      const languageValidation = this.validateArabicSupport(data)
      violations.push(...languageValidation.violations)
      warnings.push(...languageValidation.warnings)
      regulationsChecked.push('UAE Language Requirements')
    }

    // Calculate compliance score
    const score = this.calculateComplianceScore(violations, warnings)

    // Generate recommendations
    const recommendations = this.generateRecommendations(violations, warnings)

    return {
      isCompliant: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0,
      violations,
      warnings,
      score,
      recommendations,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '1.0.0',
        regulationsChecked
      }
    }
  }

  /**
   * Validate invoice-specific UAE compliance
   */
  public validateInvoiceCompliance(invoice: InvoiceComplianceCheck, businessContext: UAEBusinessContext): ComplianceValidationResult {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    // Invoice number format validation
    if (!this.validateInvoiceNumberFormat(invoice.invoiceNumber)) {
      violations.push({
        code: 'INV_001',
        type: 'FINANCIAL',
        severity: 'MEDIUM',
        description: 'Invoice number format does not meet UAE requirements',
        field: 'invoiceNumber',
        currentValue: invoice.invoiceNumber,
        expectedValue: 'Sequential numbering with year prefix (e.g., 2024-001)',
        regulation: 'UAE VAT Law Article 63',
        remediation: 'Use sequential invoice numbering with clear format'
      })
    }

    // VAT calculation validation
    const vatValidation = this.validateInvoiceVAT(invoice)
    violations.push(...vatValidation.violations)
    warnings.push(...vatValidation.warnings)

    // Due date validation (UAE standard payment terms)
    const dueDateValidation = this.validatePaymentTerms(invoice.issueDate, invoice.dueDate)
    violations.push(...dueDateValidation.violations)

    // Arabic description validation (if required)
    if (businessContext.arabicSupport) {
      invoice.lineItems.forEach((item, index) => {
        if (!item.descriptionAr) {
          warnings.push({
            code: 'LANG_001',
            type: 'LANGUAGE',
            description: `Line item ${index + 1} missing Arabic description`,
            recommendation: 'Add Arabic translations for better compliance and customer experience'
          })
        }
      })
    }

    // Customer TRN validation (if B2B transaction)
    if (invoice.customerTRN && !validateUAETRN(invoice.customerTRN)) {
      violations.push({
        code: 'TRN_002',
        type: 'TRN',
        severity: 'HIGH',
        description: 'Customer TRN format is invalid',
        field: 'customerTRN',
        currentValue: invoice.customerTRN,
        regulation: 'UAE TRN Format Requirements',
        remediation: 'Verify and correct customer TRN format (15 digits)'
      })
    }

    const score = this.calculateComplianceScore(violations, warnings)

    return {
      isCompliant: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0,
      violations,
      warnings,
      score,
      recommendations: this.generateRecommendations(violations, warnings),
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '1.0.0',
        regulationsChecked: ['UAE VAT Law', 'Invoice Requirements', 'TRN Regulations']
      }
    }
  }

  /**
   * Get UAE fiscal year information
   */
  public getUAEFiscalYear(date: Date = new Date()): {
    startDate: Date
    endDate: Date
    year: number
    quarter: number
    isCurrentFiscalYear: boolean
  } {
    const year = date.getFullYear()
    const startDate = new Date(year, UAE_FISCAL_YEAR.START_MONTH - 1, UAE_FISCAL_YEAR.START_DAY)
    const endDate = new Date(year, UAE_FISCAL_YEAR.END_MONTH - 1, UAE_FISCAL_YEAR.END_DAY)
    
    const quarter = Math.ceil((date.getMonth() + 1) / 3)
    const now = new Date()
    const isCurrentFiscalYear = now >= startDate && now <= endDate

    return {
      startDate,
      endDate,
      year,
      quarter,
      isCurrentFiscalYear
    }
  }

  /**
   * Check if date falls on UAE holiday
   */
  public isUAEHoliday(date: Date, emirate?: Emirates): boolean {
    return this.uaeHolidays.some(holiday => {
      const isSameDate = holiday.date.toDateString() === date.toDateString()
      const isObserved = holiday.isObserved
      const isEmirateSpecific = !holiday.emirateSpecific || 
        (emirate && holiday.emirateSpecific.includes(emirate))
      
      return isSameDate && isObserved && isEmirateSpecific
    })
  }

  /**
   * Get next UAE business day (excluding weekends and holidays)
   */
  public getNextUAEBusinessDay(fromDate: Date, emirate?: Emirates): Date {
    let nextDate = new Date(fromDate)
    nextDate.setDate(nextDate.getDate() + 1)

    while (UAE_WEEKEND_DAYS.includes(nextDate.getDay()) || this.isUAEHoliday(nextDate, emirate)) {
      nextDate.setDate(nextDate.getDate() + 1)
    }

    return nextDate
  }

  /**
   * Calculate business days between dates (UAE calendar)
   */
  public calculateUAEBusinessDays(startDate: Date, endDate: Date, emirate?: Emirates): number {
    let businessDays = 0
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      if (UAE_BUSINESS_DAYS.includes(currentDate.getDay()) && 
          !this.isUAEHoliday(currentDate, emirate)) {
        businessDays++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return businessDays
  }

  /**
   * Generate UAE compliance report
   */
  public generateComplianceReport(
    data: any[],
    businessContext: UAEBusinessContext,
    period: { startDate: Date; endDate: Date }
  ): {
    summary: {
      totalItems: number
      compliantItems: number
      complianceRate: number
      criticalViolations: number
      highViolations: number
    }
    violationsByType: Record<string, number>
    recommendations: string[]
    nextAuditDate: Date
  } {
    const results = data.map(item => this.validateCompliance(item, businessContext))
    
    const totalItems = results.length
    const compliantItems = results.filter(r => r.isCompliant).length
    const complianceRate = totalItems > 0 ? (compliantItems / totalItems) * 100 : 100

    const allViolations = results.flatMap(r => r.violations)
    const criticalViolations = allViolations.filter(v => v.severity === 'CRITICAL').length
    const highViolations = allViolations.filter(v => v.severity === 'HIGH').length

    const violationsByType = allViolations.reduce((acc, violation) => {
      acc[violation.type] = (acc[violation.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const allRecommendations = results.flatMap(r => r.recommendations)
    const uniqueRecommendations = [...new Set(allRecommendations)]

    // Next audit should be quarterly for UAE compliance
    const nextAuditDate = new Date()
    nextAuditDate.setMonth(nextAuditDate.getMonth() + 3)

    return {
      summary: {
        totalItems,
        compliantItems,
        complianceRate: Math.round(complianceRate * 100) / 100,
        criticalViolations,
        highViolations
      },
      violationsByType,
      recommendations: uniqueRecommendations,
      nextAuditDate
    }
  }

  // Private helper methods

  private validateVATCompliance(data: any, businessContext: UAEBusinessContext) {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    // VAT registration requirement
    if (!businessContext.companyTRN) {
      violations.push({
        code: 'VAT_001',
        type: 'VAT',
        severity: 'CRITICAL',
        description: 'Company TRN is required for VAT compliance',
        field: 'companyTRN',
        currentValue: null,
        regulation: 'UAE VAT Law - Mandatory Registration',
        remediation: 'Obtain TRN from Federal Tax Authority'
      })
    }

    // VAT rate validation
    if (data.vatRate !== undefined) {
      const validRates = Object.values(UAE_VAT_RATES)
      if (!validRates.includes(data.vatRate)) {
        violations.push({
          code: 'VAT_002',
          type: 'VAT',
          severity: 'HIGH',
          description: 'Invalid VAT rate used',
          field: 'vatRate',
          currentValue: data.vatRate,
          expectedValue: validRates,
          regulation: 'UAE VAT Law - Approved Rates',
          remediation: 'Use approved UAE VAT rates: 0% or 5%'
        })
      }
    }

    return { violations, warnings }
  }

  private validateTRNCompliance(data: any, businessContext: UAEBusinessContext) {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    if (data.trnNumber && !validateUAETRN(data.trnNumber)) {
      violations.push({
        code: 'TRN_001',
        type: 'TRN',
        severity: 'HIGH',
        description: 'Invalid TRN format',
        field: 'trnNumber',
        currentValue: data.trnNumber,
        expectedValue: '15-digit numeric format',
        regulation: 'UAE TRN Format Requirements',
        remediation: 'Correct TRN format to 15 digits'
      })
    }

    return { violations, warnings }
  }

  private validateCurrencyCompliance(data: any, businessContext: UAEBusinessContext) {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    if (data.currency && !UAE_SUPPORTED_CURRENCIES.includes(data.currency)) {
      warnings.push({
        code: 'CURR_001',
        type: 'CURRENCY',
        description: `Currency ${data.currency} is not commonly used in UAE`,
        recommendation: 'Consider using AED or other supported currencies for better compliance'
      })
    }

    return { violations, warnings }
  }

  private validateBusinessHoursCompliance(data: any, businessContext: UAEBusinessContext) {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    if (data.timestamp && !isUAEBusinessHours(new Date(data.timestamp))) {
      warnings.push({
        code: 'BH_001',
        type: 'BUSINESS_HOURS',
        description: 'Transaction occurred outside UAE business hours',
        recommendation: 'Consider processing during UAE business hours for better compliance'
      })
    }

    return { violations, warnings }
  }

  private validateArabicSupport(data: any) {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    const arabicFields = ['descriptionAr', 'nameAr', 'notesAr']
    const missingArabicFields = arabicFields.filter(field => 
      data[field.replace('Ar', '')] && !data[field]
    )

    if (missingArabicFields.length > 0) {
      warnings.push({
        code: 'LANG_002',
        type: 'LANGUAGE',
        description: `Missing Arabic translations for: ${missingArabicFields.join(', ')}`,
        recommendation: 'Add Arabic translations for better UAE compliance'
      })
    }

    return { violations, warnings }
  }

  private validateInvoiceNumberFormat(invoiceNumber: string): boolean {
    // UAE recommended format: Year-Sequential (e.g., 2024-001, 2024-002)
    const uaeFormat = /^\d{4}-\d{3,}$/
    return uaeFormat.test(invoiceNumber)
  }

  private validateInvoiceVAT(invoice: InvoiceComplianceCheck) {
    const violations: ComplianceViolation[] = []
    const warnings: ComplianceWarning[] = []

    // Recalculate VAT to verify
    const calculatedVAT = calculateInvoiceVAT(
      invoice.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate
      })),
      invoice.currency
    )

    const tolerance = new Decimal(0.01) // 1 cent tolerance
    
    if (!invoice.vatAmount.equals(calculatedVAT.totalVatAmount)) {
      const difference = invoice.vatAmount.minus(calculatedVAT.totalVatAmount).abs()
      
      if (difference.greaterThan(tolerance)) {
        violations.push({
          code: 'VAT_003',
          type: 'VAT',
          severity: 'HIGH',
          description: 'VAT calculation mismatch',
          field: 'vatAmount',
          currentValue: invoice.vatAmount.toNumber(),
          expectedValue: calculatedVAT.totalVatAmount.toNumber(),
          regulation: 'UAE VAT Calculation Requirements',
          remediation: 'Recalculate VAT using correct rates and amounts'
        })
      }
    }

    return { violations, warnings }
  }

  private validatePaymentTerms(issueDate: Date, dueDate: Date) {
    const violations: ComplianceViolation[] = []
    
    const daysDifference = Math.ceil((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // UAE standard payment terms are typically 30-90 days
    if (daysDifference > 90) {
      violations.push({
        code: 'PAY_001',
        type: 'FINANCIAL',
        severity: 'MEDIUM',
        description: 'Payment terms exceed UAE recommended maximum',
        field: 'dueDate',
        currentValue: daysDifference,
        expectedValue: '30-90 days',
        regulation: 'UAE Commercial Best Practices',
        remediation: 'Consider reducing payment terms to standard range'
      })
    }

    return { violations, warnings: [] }
  }

  private calculateComplianceScore(violations: ComplianceViolation[], warnings: ComplianceWarning[]): number {
    let score = 100
    
    violations.forEach(violation => {
      switch (violation.severity) {
        case 'CRITICAL':
          score -= 25
          break
        case 'HIGH':
          score -= 15
          break
        case 'MEDIUM':
          score -= 10
          break
        case 'LOW':
          score -= 5
          break
      }
    })

    warnings.forEach(() => {
      score -= 2
    })

    return Math.max(0, Math.min(100, score))
  }

  private generateRecommendations(violations: ComplianceViolation[], warnings: ComplianceWarning[]): string[] {
    const recommendations = [
      ...violations.map(v => v.remediation),
      ...warnings.map(w => w.recommendation)
    ]

    // Add general UAE compliance recommendations
    if (violations.some(v => v.type === 'VAT')) {
      recommendations.push('Review UAE VAT guidelines and ensure proper tax registration')
    }

    if (violations.some(v => v.type === 'TRN')) {
      recommendations.push('Verify all TRN numbers with Federal Tax Authority database')
    }

    return [...new Set(recommendations)] // Remove duplicates
  }
}

// Export singleton instance
export const uaeComplianceService = new UAEComplianceService()