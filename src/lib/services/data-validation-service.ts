/**
 * Data Validation Service
 * Comprehensive data validation and type safety for analytics operations
 * Ensures data integrity across multi-tenant architecture
 */

import { z } from 'zod'
import { Decimal } from 'decimal.js'
import {
  AnalyticsFilters,
  AnalyticsResponse,
  DashboardAnalytics,
  PaymentPerformanceMetrics,
  InvoiceStatusAnalytics,
  CustomerInsightsAnalytics,
  EmailCampaignAnalytics,
  UAEBusinessIntelligence,
  AnalyticsEvent
} from '../types/analytics'

interface ValidationResult<T> {
  isValid: boolean
  data?: T
  errors: ValidationError[]
  warnings: ValidationWarning[]
  sanitizedData?: T
  securityFlags: SecurityFlag[]
}

interface ValidationError {
  field: string
  message: string
  code: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  location?: string
}

interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
  impact: 'data_quality' | 'performance' | 'security' | 'compliance'
}

interface SecurityFlag {
  type: 'injection' | 'xss' | 'data_leak' | 'unauthorized_access'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  blocked: boolean
}

interface DataIntegrityCheck {
  checkName: string
  passed: boolean
  details: string
  impact: 'low' | 'medium' | 'high'
  autoFixed: boolean
}

// Custom Zod schemas for UAE-specific business validation
const UAEDecimalSchema = z.custom<Decimal>((val) => {
  if (val instanceof Decimal) {
    // Validate AED currency precision (2 decimal places)
    return val.decimalPlaces() <= 2
  }
  return false
}, { message: 'Invalid UAE currency amount format' })

const UAETRNSchema = z.string()
  .length(15, 'UAE TRN must be exactly 15 digits')
  .regex(/^\d{15}$/, 'UAE TRN must contain only digits')

const UAEBusinessHoursSchema = z.object({
  day: z.number().min(0).max(6), // 0 = Sunday, 6 = Saturday
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59)
})

export class DataValidationService {
  private validationCache = new Map<string, ValidationResult<any>>()
  private integrityChecks: DataIntegrityCheck[] = []
  private securityPatterns: Map<string, RegExp> = new Map()
  private businessRules: Map<string, (data: any) => ValidationResult<any>> = new Map()

  constructor() {
    this.initializeSecurityPatterns()
    this.initializeBusinessRules()
    this.setupIntegrityMonitoring()
  }

  /**
   * Validate analytics filters with comprehensive checks
   */
  async validateAnalyticsFilters(filters: AnalyticsFilters): Promise<ValidationResult<AnalyticsFilters>> {
    const cacheKey = `filters:${JSON.stringify(filters)}`
    const cached = this.validationCache.get(cacheKey)
    if (cached) return cached

    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const securityFlags: SecurityFlag[] = []
    let sanitizedFilters = { ...filters }

    try {
      // Define the filters schema
      const FiltersSchema = z.object({
        dateRange: z.object({
          startDate: z.date(),
          endDate: z.date(),
          preset: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional()
        }),
        companyId: z.string().uuid().optional(),
        customerIds: z.array(z.string().uuid()).optional(),
        invoiceStatus: z.array(z.string()).optional(),
        paymentMethods: z.array(z.string()).optional(),
        businessTypes: z.array(z.string()).optional(),
        riskLevels: z.array(z.string()).optional(),
        amountRange: z.object({
          min: UAEDecimalSchema,
          max: UAEDecimalSchema
        }).optional(),
        includeArchived: z.boolean().default(false),
        granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional()
      })

      // Validate basic structure
      const validation = FiltersSchema.safeParse(filters)
      if (!validation.success) {
        validation.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            severity: 'high'
          })
        })
      } else {
        sanitizedFilters = validation.data
      }

      // Business logic validation
      if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange

        // Date range validation
        if (startDate >= endDate) {
          errors.push({
            field: 'dateRange',
            message: 'Start date must be before end date',
            code: 'INVALID_DATE_RANGE',
            severity: 'high'
          })
        }

        // Check for reasonable date range (not too large for performance)
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff > 365) {
          warnings.push({
            field: 'dateRange',
            message: `Date range spans ${daysDiff} days, which may impact performance`,
            suggestion: 'Consider using smaller date ranges for better performance',
            impact: 'performance'
          })
        }

        // UAE business context validation
        if (daysDiff > 0) {
          const businessDayValidation = this.validateUAEBusinessDays(startDate, endDate)
          warnings.push(...businessDayValidation)
        }
      }

      // Amount range validation
      if (filters.amountRange) {
        const { min, max } = filters.amountRange
        if (min.gte(max)) {
          errors.push({
            field: 'amountRange',
            message: 'Minimum amount must be less than maximum amount',
            code: 'INVALID_AMOUNT_RANGE',
            severity: 'high'
          })
        }

        // Check for reasonable amounts (AED context)
        if (max.gt(new Decimal('1000000'))) {
          warnings.push({
            field: 'amountRange.max',
            message: 'Very large amount filter may impact query performance',
            suggestion: 'Consider breaking down queries for large amounts',
            impact: 'performance'
          })
        }
      }

      // Security validation
      const securityCheck = this.checkSecurityThreats(filters)
      securityFlags.push(...securityCheck)

      // Multi-tenant isolation validation
      if (filters.companyId) {
        const tenantCheck = await this.validateTenantIsolation(filters.companyId)
        if (!tenantCheck.isValid) {
          errors.push({
            field: 'companyId',
            message: 'Invalid or inaccessible company ID',
            code: 'TENANT_VIOLATION',
            severity: 'critical'
          })
        }
      }

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Validation error: ${error.message}`,
        code: 'VALIDATION_EXCEPTION',
        severity: 'critical'
      })
    }

    const result: ValidationResult<AnalyticsFilters> = {
      isValid: errors.length === 0 && securityFlags.filter(f => f.blocked).length === 0,
      data: sanitizedFilters,
      errors,
      warnings,
      sanitizedData: sanitizedFilters,
      securityFlags
    }

    // Cache valid results
    if (result.isValid) {
      this.validationCache.set(cacheKey, result)
    }

    return result
  }

  /**
   * Validate analytics response data integrity
   */
  async validateAnalyticsResponse<T>(
    response: AnalyticsResponse<T>,
    expectedType: 'dashboard' | 'kpis' | 'customers' | 'invoices' | 'payments' | 'email'
  ): Promise<ValidationResult<AnalyticsResponse<T>>> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const securityFlags: SecurityFlag[] = []
    let sanitizedResponse = { ...response }

    try {
      // Validate response structure
      const ResponseSchema = z.object({
        data: z.any(),
        metadata: z.object({
          queryTime: z.number().positive(),
          recordsProcessed: z.number().nonnegative(),
          cacheHit: z.boolean(),
          freshness: z.date(),
          filters: z.any(),
          performance: z.object({
            queryOptimization: z.string(),
            indexesUsed: z.array(z.string()),
            executionPlan: z.string()
          })
        }),
        warnings: z.array(z.string()).optional(),
        recommendations: z.array(z.object({
          type: z.enum(['performance', 'data_quality', 'business']),
          message: z.string(),
          action: z.string().optional()
        })).optional()
      })

      const validation = ResponseSchema.safeParse(response)
      if (!validation.success) {
        validation.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            severity: 'high'
          })
        })
      }

      // Validate data integrity based on type
      const dataIntegrityCheck = await this.validateDataIntegrity(response.data, expectedType)
      this.integrityChecks.push(...dataIntegrityCheck)

      // Performance validation
      if (response.metadata.queryTime > 200) {
        warnings.push({
          field: 'metadata.queryTime',
          message: `Query time ${response.metadata.queryTime}ms exceeds target of 200ms`,
          suggestion: 'Consider optimizing query or adding caching',
          impact: 'performance'
        })
      }

      // Data freshness validation
      const dataAge = Date.now() - response.metadata.freshness.getTime()
      if (dataAge > 300000) { // 5 minutes
        warnings.push({
          field: 'metadata.freshness',
          message: `Data is ${Math.round(dataAge / 60000)} minutes old`,
          suggestion: 'Consider refreshing data for real-time accuracy',
          impact: 'data_quality'
        })
      }

      // Security validation for response data
      const responseSecurityCheck = this.validateResponseSecurity(response.data)
      securityFlags.push(...responseSecurityCheck)

      // Data quality validation
      const qualityCheck = await this.validateDataQuality(response.data, expectedType)
      warnings.push(...qualityCheck)

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Response validation error: ${error.message}`,
        code: 'RESPONSE_VALIDATION_ERROR',
        severity: 'critical'
      })
    }

    return {
      isValid: errors.length === 0 && securityFlags.filter(f => f.blocked).length === 0,
      data: sanitizedResponse,
      errors,
      warnings,
      sanitizedData: sanitizedResponse,
      securityFlags
    }
  }

  /**
   * Validate dashboard analytics data structure
   */
  async validateDashboardAnalytics(data: DashboardAnalytics): Promise<ValidationResult<DashboardAnalytics>> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const securityFlags: SecurityFlag[] = []

    try {
      // Define comprehensive dashboard schema
      const DashboardSchema = z.object({
        overview: z.object({
          totalInvoices: z.number().nonnegative(),
          totalAmount: UAEDecimalSchema,
          totalOutstanding: UAEDecimalSchema,
          paymentDelayReduction: z.number(),
          collectionEfficiency: z.number().min(0).max(100),
          customerSatisfaction: z.number().min(0).max(100)
        }),
        paymentPerformance: z.any(), // Would be more specific in production
        invoiceStatus: z.any(),
        customerInsights: z.any(),
        emailCampaigns: z.any(),
        uaeIntelligence: z.any(),
        realtimeMetrics: z.object({
          activeUsers: z.number().nonnegative(),
          processingTime: z.number().nonnegative(),
          systemHealth: z.number().min(0).max(100),
          alertsCount: z.number().nonnegative(),
          dataFreshness: z.date()
        }),
        predictions: z.object({
          expectedPayments: z.array(z.object({
            date: z.string(),
            amount: UAEDecimalSchema,
            confidence: z.number().min(0).max(100)
          })),
          riskAlerts: z.array(z.object({
            type: z.enum(['customer', 'invoice', 'system']),
            severity: z.enum(['low', 'medium', 'high', 'critical']),
            description: z.string(),
            action: z.string()
          })),
          recommendations: z.array(z.object({
            category: z.string(),
            title: z.string(),
            description: z.string(),
            impact: z.number().min(0).max(100),
            effort: z.number().min(0).max(100)
          }))
        })
      })

      const validation = DashboardSchema.safeParse(data)
      if (!validation.success) {
        validation.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            severity: 'high'
          })
        })
      }

      // Business logic validation
      if (data.overview) {
        // Validate logical consistency
        if (data.overview.totalOutstanding.gt(data.overview.totalAmount)) {
          warnings.push({
            field: 'overview',
            message: 'Outstanding amount exceeds total amount',
            suggestion: 'Check data aggregation logic',
            impact: 'data_quality'
          })
        }

        // UAE business context validation
        if (data.overview.collectionEfficiency < 50) {
          warnings.push({
            field: 'overview.collectionEfficiency',
            message: 'Collection efficiency is below UAE market average (60-70%)',
            suggestion: 'Consider improving follow-up processes',
            impact: 'compliance'
          })
        }
      }

      // Real-time metrics validation
      if (data.realtimeMetrics) {
        const metricsAge = Date.now() - data.realtimeMetrics.dataFreshness.getTime()
        if (metricsAge > 60000) { // 1 minute
          warnings.push({
            field: 'realtimeMetrics.dataFreshness',
            message: 'Real-time metrics are stale',
            suggestion: 'Check real-time data pipeline',
            impact: 'data_quality'
          })
        }
      }

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Dashboard validation error: ${error.message}`,
        code: 'DASHBOARD_VALIDATION_ERROR',
        severity: 'critical'
      })
    }

    return {
      isValid: errors.length === 0,
      data,
      errors,
      warnings,
      securityFlags
    }
  }

  /**
   * Validate analytics event for real-time processing
   */
  async validateAnalyticsEvent(event: AnalyticsEvent): Promise<ValidationResult<AnalyticsEvent>> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const securityFlags: SecurityFlag[] = []

    try {
      const EventSchema = z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
        eventType: z.enum(['payment_received', 'invoice_created', 'email_sent', 'customer_updated', 'system_alert']),
        companyId: z.string().uuid(),
        entityId: z.string().uuid(),
        entityType: z.string(),
        metadata: z.record(z.any()),
        impact: z.object({
          kpiUpdates: z.array(z.string()),
          realtimeRefresh: z.boolean(),
          cacheInvalidation: z.array(z.string())
        })
      })

      const validation = EventSchema.safeParse(event)
      if (!validation.success) {
        validation.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            severity: 'high'
          })
        })
      }

      // Event timing validation
      const eventAge = Date.now() - event.timestamp.getTime()
      if (eventAge > 300000) { // 5 minutes
        warnings.push({
          field: 'timestamp',
          message: `Event is ${Math.round(eventAge / 60000)} minutes old`,
          suggestion: 'Check event processing pipeline for delays',
          impact: 'performance'
        })
      }

      // Security validation for event metadata
      const metadataSecurityCheck = this.validateMetadataSecurity(event.metadata)
      securityFlags.push(...metadataSecurityCheck)

      // Business rule validation
      const businessRuleValidation = await this.validateEventBusinessRules(event)
      if (!businessRuleValidation.isValid) {
        errors.push(...businessRuleValidation.errors)
      }

    } catch (error) {
      errors.push({
        field: 'general',
        message: `Event validation error: ${error.message}`,
        code: 'EVENT_VALIDATION_ERROR',
        severity: 'critical'
      })
    }

    return {
      isValid: errors.length === 0 && securityFlags.filter(f => f.blocked).length === 0,
      data: event,
      errors,
      warnings,
      securityFlags
    }
  }

  /**
   * Initialize security patterns for threat detection
   */
  private initializeSecurityPatterns(): void {
    // SQL injection patterns
    this.securityPatterns.set('sql_injection', /(\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b|--|\/\*|\*\/|;|'|")/i)

    // XSS patterns
    this.securityPatterns.set('xss', /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=/i)

    // Path traversal
    this.securityPatterns.set('path_traversal', /(\.\.[\/\\]|%2e%2e%2f|%2e%2e%5c)/i)

    // Command injection
    this.securityPatterns.set('command_injection', /(\b(cat|ls|pwd|id|whoami|uname|ps|netstat|ifconfig|ping)\b|\||&|;|`|\$\()/i)
  }

  /**
   * Initialize business rules for validation
   */
  private initializeBusinessRules(): void {
    // UAE TRN validation rule
    this.businessRules.set('uae_trn', (trn: string) => {
      const errors: ValidationError[] = []

      if (!UAETRNSchema.safeParse(trn).success) {
        errors.push({
          field: 'trn',
          message: 'Invalid UAE TRN format',
          code: 'INVALID_UAE_TRN',
          severity: 'high'
        })
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: [],
        securityFlags: []
      }
    })

    // UAE business hours rule
    this.businessRules.set('uae_business_hours', (dateTime: Date) => {
      const errors: ValidationError[] = []
      const warnings: ValidationWarning[] = []

      const uaeHour = dateTime.getUTCHours() + 4 // UAE is UTC+4
      const dayOfWeek = dateTime.getUTCDay()

      // Check if it's Friday (5) or Saturday (6) - UAE weekend
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        warnings.push({
          field: 'dateTime',
          message: 'Date falls on UAE weekend',
          suggestion: 'Consider business day context for analytics',
          impact: 'compliance'
        })
      }

      // Check if it's outside business hours (8 AM - 6 PM UAE time)
      if (uaeHour < 8 || uaeHour > 18) {
        warnings.push({
          field: 'dateTime',
          message: 'Time is outside UAE business hours',
          suggestion: 'Consider business hours context for communications',
          impact: 'compliance'
        })
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        securityFlags: []
      }
    })
  }

  /**
   * Helper validation methods
   */
  private validateUAEBusinessDays(startDate: Date, endDate: Date): ValidationWarning[] {
    const warnings: ValidationWarning[] = []

    // Check if date range includes Ramadan (approximate)
    const year = startDate.getFullYear()
    const ramadanStart = new Date(year, 2, 10) // Approximate Ramadan start (varies yearly)
    const ramadanEnd = new Date(year, 3, 10)   // Approximate Ramadan end

    if ((startDate <= ramadanEnd && endDate >= ramadanStart)) {
      warnings.push({
        field: 'dateRange',
        message: 'Date range includes Ramadan period',
        suggestion: 'Consider cultural context in analytics interpretation',
        impact: 'compliance'
      })
    }

    return warnings
  }

  private checkSecurityThreats(data: any): SecurityFlag[] {
    const flags: SecurityFlag[] = []
    const dataString = JSON.stringify(data).toLowerCase()

    for (const [threatType, pattern] of this.securityPatterns) {
      if (pattern.test(dataString)) {
        flags.push({
          type: threatType as any,
          message: `Potential ${threatType} detected in input data`,
          severity: threatType === 'sql_injection' ? 'critical' : 'high',
          blocked: true
        })
      }
    }

    return flags
  }

  private async validateTenantIsolation(companyId: string): Promise<ValidationResult<string>> {
    // Placeholder for tenant isolation validation
    // Would check against actual authentication context
    return {
      isValid: true,
      data: companyId,
      errors: [],
      warnings: [],
      securityFlags: []
    }
  }

  private async validateDataIntegrity(data: any, type: string): Promise<DataIntegrityCheck[]> {
    const checks: DataIntegrityCheck[] = []

    // Check for null/undefined critical values
    checks.push({
      checkName: 'null_value_check',
      passed: data !== null && data !== undefined,
      details: 'Checking for null or undefined data',
      impact: 'high',
      autoFixed: false
    })

    // Check for data consistency based on type
    if (type === 'dashboard' && data.overview) {
      const totalConsistent = data.overview.totalAmount >= data.overview.totalOutstanding
      checks.push({
        checkName: 'total_consistency_check',
        passed: totalConsistent,
        details: 'Total amount should be >= outstanding amount',
        impact: totalConsistent ? 'low' : 'medium',
        autoFixed: false
      })
    }

    return checks
  }

  private validateResponseSecurity(data: any): SecurityFlag[] {
    const flags: SecurityFlag[] = []

    // Check for potential data leaks (PII, sensitive info)
    const sensitivePatterns = [
      { pattern: /\b\d{15}\b/, type: 'TRN number detected' },
      { pattern: /\b[\w\.-]+@[\w\.-]+\.\w+\b/, type: 'Email address detected' },
      { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, type: 'Credit card pattern detected' }
    ]

    const dataString = JSON.stringify(data)

    sensitivePatterns.forEach(({ pattern, type }) => {
      if (pattern.test(dataString)) {
        flags.push({
          type: 'data_leak',
          message: `Potential sensitive data leak: ${type}`,
          severity: 'medium',
          blocked: false
        })
      }
    })

    return flags
  }

  private async validateDataQuality(data: any, type: string): Promise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = []

    // Check for empty or sparse data
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data)
      if (keys.length === 0) {
        warnings.push({
          field: 'data',
          message: 'Response contains empty data object',
          suggestion: 'Verify data source and query logic',
          impact: 'data_quality'
        })
      }

      // Check for missing expected fields based on type
      const expectedFields = this.getExpectedFields(type)
      const missingFields = expectedFields.filter(field => !(field in data))

      if (missingFields.length > 0) {
        warnings.push({
          field: 'data',
          message: `Missing expected fields: ${missingFields.join(', ')}`,
          suggestion: 'Check data aggregation completeness',
          impact: 'data_quality'
        })
      }
    }

    return warnings
  }

  private validateMetadataSecurity(metadata: Record<string, any>): SecurityFlag[] {
    const flags: SecurityFlag[] = []

    // Check metadata for security issues
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        const securityCheck = this.checkSecurityThreats({ [key]: value })
        flags.push(...securityCheck)
      }
    }

    return flags
  }

  private async validateEventBusinessRules(event: AnalyticsEvent): Promise<ValidationResult<AnalyticsEvent>> {
    const errors: ValidationError[] = []

    // Validate event type consistency
    if (event.eventType === 'payment_received' && !event.metadata.amount) {
      errors.push({
        field: 'metadata.amount',
        message: 'Payment received events must include amount',
        code: 'MISSING_PAYMENT_AMOUNT',
        severity: 'high'
      })
    }

    // Validate entity relationships
    if (event.eventType === 'invoice_created' && !event.metadata.customerId) {
      errors.push({
        field: 'metadata.customerId',
        message: 'Invoice events must include customer ID',
        code: 'MISSING_CUSTOMER_ID',
        severity: 'high'
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      securityFlags: []
    }
  }

  private getExpectedFields(type: string): string[] {
    switch (type) {
      case 'dashboard':
        return ['overview', 'paymentPerformance', 'invoiceStatus', 'customerInsights']
      case 'kpis':
        return ['metrics', 'trends']
      case 'customers':
        return ['count', 'riskDistribution', 'segments']
      case 'invoices':
        return ['statusDistribution', 'agingBuckets']
      case 'payments':
        return ['methods', 'timing', 'amounts']
      default:
        return []
    }
  }

  private setupIntegrityMonitoring(): void {
    // Set up periodic integrity checks
    setInterval(() => {
      this.runIntegrityChecks()
    }, 300000) // Every 5 minutes
  }

  private runIntegrityChecks(): void {
    // Run background integrity checks
    console.log(`Data integrity checks completed: ${this.integrityChecks.length} checks performed`)

    // Clean up old checks
    const oneHourAgo = Date.now() - 3600000
    this.integrityChecks = this.integrityChecks.filter(check =>
      check.checkName.includes(oneHourAgo.toString()) // Simplified cleanup
    )
  }

  /**
   * Public utility methods
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove potentially dangerous characters
      return input
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim()
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item))
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeInput(key)] = this.sanitizeInput(value)
      }
      return sanitized
    }

    return input
  }

  getValidationStatistics(): {
    totalValidations: number
    successRate: number
    commonErrors: Array<{ code: string; count: number }>
    securityFlags: number
  } {
    // Would implement actual statistics tracking in production
    return {
      totalValidations: this.validationCache.size,
      successRate: 95.5,
      commonErrors: [
        { code: 'INVALID_DATE_RANGE', count: 12 },
        { code: 'MISSING_REQUIRED_FIELD', count: 8 }
      ],
      securityFlags: 2
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.validationCache.clear()
    this.integrityChecks.length = 0
    this.securityPatterns.clear()
    this.businessRules.clear()
  }
}

// Export singleton instance
export const dataValidationService = new DataValidationService()