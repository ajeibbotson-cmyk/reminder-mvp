import { z } from 'zod'
import { Decimal } from 'decimal.js'
import { formatEnhancedUAECurrency, UAE_CURRENCY_PRESETS, UAECurrencyConfig } from './enhanced-uae-currency'

// Enhanced UAE Business Hours Configuration with granular controls
export interface UAEBusinessHours {
  timezone: string
  workingDays: number[] // 0 = Sunday, 1 = Monday, etc.
  startHour: number
  endHour: number
  allowWeekends: boolean
  allowHolidays: boolean
  ramadanHours?: {
    startHour: number
    endHour: number
  }
  // Enhanced granular controls
  prayerTimeBuffer: number // Minutes buffer around prayer times
  lunchBreak?: {
    startHour: number
    endHour: number
    enabled: boolean
  }
  fridayPrayerBreak?: {
    startHour: number
    endHour: number
    enabled: boolean
  }
  emergencyOverride?: {
    enabled: boolean
    contactHours: number[] // Hours when emergency contact is allowed
  }
  customHolidays: Date[]
  seasonalAdjustments?: {
    ramadan: {
      enabled: boolean
      startHour: number
      endHour: number
      noLunchBreak: boolean
    }
    summer: {
      enabled: boolean
      adjustedStartHour: number
      adjustedEndHour: number
      applicableMonths: number[] // Months where summer hours apply
    }
  }
  strictMode: boolean // Whether to enforce business hours strictly
  gracePeriod: number // Minutes before/after hours still considered acceptable
}

// Enhanced default UAE business hours with granular controls
export const DEFAULT_UAE_BUSINESS_HOURS: UAEBusinessHours = {
  timezone: 'Asia/Dubai',
  workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
  startHour: 8,
  endHour: 17,
  allowWeekends: false,
  allowHolidays: false,
  prayerTimeBuffer: 15, // 15 minutes buffer around prayer times
  lunchBreak: {
    startHour: 12,
    endHour: 13,
    enabled: true
  },
  fridayPrayerBreak: {
    startHour: 12,
    endHour: 13,
    enabled: true
  },
  emergencyOverride: {
    enabled: true,
    contactHours: [8, 9, 10, 11, 14, 15, 16, 17] // Excluding lunch and prayer times
  },
  customHolidays: [],
  seasonalAdjustments: {
    ramadan: {
      enabled: true,
      startHour: 9,
      endHour: 15,
      noLunchBreak: true
    },
    summer: {
      enabled: true,
      adjustedStartHour: 7,
      adjustedEndHour: 16,
      applicableMonths: [6, 7, 8] // June, July, August
    }
  },
  strictMode: false,
  gracePeriod: 30 // 30 minutes grace period
}

// UAE Business Types with validation rules
export const UAE_BUSINESS_TYPES = {
  LLC: {
    label: 'Limited Liability Company',
    labelAr: 'شركة ذات مسؤولية محدودة',
    requiresTRN: true,
    minShareCapital: 300000, // AED
    maxOwners: 50,
    paymentTermsRange: [7, 90],
    defaultPaymentTerms: 30
  },
  FREE_ZONE: {
    label: 'Free Zone Company',
    labelAr: 'شركة منطقة حرة',
    requiresTRN: true,
    minShareCapital: 100000, // AED (varies by free zone)
    maxOwners: 100,
    paymentTermsRange: [15, 60],
    defaultPaymentTerms: 30
  },
  SOLE_PROPRIETORSHIP: {
    label: 'Sole Proprietorship',
    labelAr: 'مؤسسة فردية',
    requiresTRN: false,
    minShareCapital: 0,
    maxOwners: 1,
    paymentTermsRange: [7, 45],
    defaultPaymentTerms: 15
  },
  PARTNERSHIP: {
    label: 'Partnership',
    labelAr: 'شراكة',
    requiresTRN: true,
    minShareCapital: 100000, // AED
    maxOwners: 20,
    paymentTermsRange: [15, 60],
    defaultPaymentTerms: 30
  },
  BRANCH: {
    label: 'Branch Office',
    labelAr: 'مكتب فرع',
    requiresTRN: true,
    minShareCapital: 0,
    maxOwners: 1,
    paymentTermsRange: [30, 90],
    defaultPaymentTerms: 45
  }
} as const

export type UAEBusinessType = keyof typeof UAE_BUSINESS_TYPES

// UAE Standard Payment Terms (in days)
export const UAE_STANDARD_PAYMENT_TERMS = [7, 15, 30, 45, 60, 90] as const

// UAE TRN validation
export function validateUAETRN(trn: string): boolean {
  if (!trn) return true // Optional field
  
  // Remove any formatting
  const cleanTrn = trn.replace(/\D/g, '')
  
  // Must be exactly 15 digits
  if (cleanTrn.length !== 15) return false
  
  // Additional validation rules for UAE TRN
  // First digit should be 1, 2, or 3 (entity type)
  const firstDigit = parseInt(cleanTrn[0])
  if (![1, 2, 3].includes(firstDigit)) return false
  
  // Simple checksum validation (simplified version)
  const checksum = calculateTRNChecksum(cleanTrn.substring(0, 14))
  return checksum === parseInt(cleanTrn[14])
}

// Calculate TRN checksum (simplified algorithm)
function calculateTRNChecksum(trnWithoutChecksum: string): number {
  let sum = 0
  for (let i = 0; i < trnWithoutChecksum.length; i++) {
    sum += parseInt(trnWithoutChecksum[i]) * (i + 1)
  }
  return sum % 10
}

// Format TRN for display
export function formatUAETRN(trn: string): string {
  if (!trn) return ''
  
  const cleanTrn = trn.replace(/\D/g, '')
  if (cleanTrn.length !== 15) return trn
  
  // Format as XXX-XXXX-XXXX-XXXX
  return `${cleanTrn.substring(0, 3)}-${cleanTrn.substring(3, 7)}-${cleanTrn.substring(7, 11)}-${cleanTrn.substring(11, 15)}`
}

// Validate business type specific rules
export function validateBusinessTypeRules(
  businessType: UAEBusinessType,
  data: {
    trn?: string
    creditLimit?: number
    paymentTerms?: number
  }
): { isValid: boolean; errors: string[] } {
  const rules = UAE_BUSINESS_TYPES[businessType]
  const errors: string[] = []
  
  // TRN requirement
  if (rules.requiresTRN && !data.trn) {
    errors.push(`TRN is required for ${rules.label}`)
  }
  
  if (data.trn && !validateUAETRN(data.trn)) {
    errors.push('Invalid TRN format')
  }
  
  // Payment terms validation
  if (data.paymentTerms) {
    const [minTerms, maxTerms] = rules.paymentTermsRange
    if (data.paymentTerms < minTerms || data.paymentTerms > maxTerms) {
      errors.push(`Payment terms for ${rules.label} must be between ${minTerms} and ${maxTerms} days`)
    }
  }
  
  // Credit limit validation (basic business logic)
  if (data.creditLimit && data.creditLimit > 10000000) { // 10M AED
    errors.push('Credit limit exceeds maximum allowed amount for UAE businesses')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Enhanced business hours validation with granular controls
export function isWithinUAEBusinessHours(
  businessHours: UAEBusinessHours = DEFAULT_UAE_BUSINESS_HOURS,
  dateTime?: Date
): {
  isWithinHours: boolean
  reason?: string
  nextAvailableTime?: Date
  contextInfo: {
    currentHour: number
    isWorkingDay: boolean
    isRamadan: boolean
    isSummer: boolean
    isLunchBreak: boolean
    isPrayerTime: boolean
    isHoliday: boolean
    gracePeriodActive: boolean
  }
} {
  const now = dateTime || new Date()

  // Convert to Dubai timezone
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: businessHours.timezone }))

  const dayOfWeek = dubaiTime.getDay()
  const hour = dubaiTime.getHours()
  const minute = dubaiTime.getMinutes()
  const month = dubaiTime.getMonth() + 1 // JavaScript months are 0-indexed

  // Context information
  const isWorkingDay = businessHours.workingDays.includes(dayOfWeek)
  const isRamadan = isRamadanPeriod(dubaiTime)
  const isSummer = businessHours.seasonalAdjustments?.summer.enabled &&
    businessHours.seasonalAdjustments.summer.applicableMonths.includes(month)
  const isHoliday = isUAEHoliday(dubaiTime, businessHours.customHolidays)

  // Determine effective working hours
  let effectiveStartHour = businessHours.startHour
  let effectiveEndHour = businessHours.endHour

  if (isRamadan && businessHours.seasonalAdjustments?.ramadan.enabled) {
    effectiveStartHour = businessHours.seasonalAdjustments.ramadan.startHour
    effectiveEndHour = businessHours.seasonalAdjustments.ramadan.endHour
  } else if (isSummer && businessHours.seasonalAdjustments?.summer.enabled) {
    effectiveStartHour = businessHours.seasonalAdjustments.summer.adjustedStartHour
    effectiveEndHour = businessHours.seasonalAdjustments.summer.adjustedEndHour
  }

  // Check various time restrictions
  const isLunchBreak = businessHours.lunchBreak?.enabled &&
    hour >= businessHours.lunchBreak.startHour &&
    hour < businessHours.lunchBreak.endHour &&
    !(isRamadan && businessHours.seasonalAdjustments?.ramadan.noLunchBreak)

  const isFridayPrayerTime = dayOfWeek === 5 && // Friday
    businessHours.fridayPrayerBreak?.enabled &&
    hour >= businessHours.fridayPrayerBreak.startHour &&
    hour < businessHours.fridayPrayerBreak.endHour

  const isPrayerTime = isPrayerTimeHour(hour, minute, businessHours.prayerTimeBuffer)

  // Grace period calculation
  const totalMinutes = hour * 60 + minute
  const startMinutes = effectiveStartHour * 60
  const endMinutes = effectiveEndHour * 60
  const gracePeriod = businessHours.gracePeriod

  const gracePeriodActive = !businessHours.strictMode && (
    (totalMinutes >= startMinutes - gracePeriod && totalMinutes < startMinutes) ||
    (totalMinutes >= endMinutes && totalMinutes < endMinutes + gracePeriod)
  )

  const contextInfo = {
    currentHour: hour,
    isWorkingDay,
    isRamadan,
    isSummer,
    isLunchBreak,
    isPrayerTime: isPrayerTime || isFridayPrayerTime,
    isHoliday,
    gracePeriodActive
  }

  // Main validation logic
  if (!isWorkingDay && !businessHours.allowWeekends) {
    return {
      isWithinHours: false,
      reason: `${getDayName(dayOfWeek)} is not a working day`,
      nextAvailableTime: getNextWorkingDay(dubaiTime, businessHours),
      contextInfo
    }
  }

  if (isHoliday && !businessHours.allowHolidays) {
    return {
      isWithinHours: false,
      reason: 'Today is a UAE public holiday',
      nextAvailableTime: getNextWorkingDay(dubaiTime, businessHours),
      contextInfo
    }
  }

  if (hour < effectiveStartHour || hour >= effectiveEndHour) {
    if (gracePeriodActive) {
      return {
        isWithinHours: true,
        reason: 'Within grace period',
        contextInfo
      }
    }

    return {
      isWithinHours: false,
      reason: `Outside business hours (${effectiveStartHour}:00 - ${effectiveEndHour}:00)`,
      nextAvailableTime: getNextAvailableTime(dubaiTime, businessHours),
      contextInfo
    }
  }

  if (isLunchBreak) {
    return {
      isWithinHours: false,
      reason: 'During lunch break',
      nextAvailableTime: getNextAvailableTime(dubaiTime, businessHours),
      contextInfo
    }
  }

  if (isFridayPrayerTime) {
    return {
      isWithinHours: false,
      reason: 'During Friday prayer time',
      nextAvailableTime: getNextAvailableTime(dubaiTime, businessHours),
      contextInfo
    }
  }

  if (isPrayerTime && businessHours.prayerTimeBuffer > 0) {
    return {
      isWithinHours: false,
      reason: 'During prayer time buffer',
      nextAvailableTime: getNextAvailableTime(dubaiTime, businessHours),
      contextInfo
    }
  }

  // Emergency override check
  if (businessHours.emergencyOverride?.enabled &&
      businessHours.emergencyOverride.contactHours.includes(hour)) {
    return {
      isWithinHours: true,
      reason: 'Emergency contact hours',
      contextInfo
    }
  }

  return {
    isWithinHours: true,
    contextInfo
  }
}

// Simple Ramadan detection (would need more sophisticated implementation)
function isRamadanPeriod(date: Date): boolean {
  // This is a simplified version - in reality, you'd need a proper Islamic calendar library
  // Ramadan dates change each year based on lunar calendar
  const year = date.getFullYear()
  
  // Example dates for 2024 (would need to be updated annually or calculated)
  if (year === 2024) {
    const ramadanStart = new Date('2024-03-10')
    const ramadanEnd = new Date('2024-04-09')
    return date >= ramadanStart && date <= ramadanEnd
  }
  
  return false
}

// Calculate next business day in UAE
export function getNextUAEBusinessDay(
  startDate: Date,
  businessHours: UAEBusinessHours = DEFAULT_UAE_BUSINESS_HOURS
): Date {
  const nextDay = new Date(startDate)
  nextDay.setDate(nextDay.getDate() + 1)
  
  while (!businessHours.workingDays.includes(nextDay.getDay())) {
    nextDay.setDate(nextDay.getDate() + 1)
  }
  
  return nextDay
}

// Validate UAE phone number
export function validateUAEPhoneNumber(phone: string): boolean {
  if (!phone) return true // Optional field
  
  // UAE phone number patterns
  const uaePhoneRegex = /^(\+971|00971|971)?[0-9]{8,9}$/
  return uaePhoneRegex.test(phone.replace(/\s/g, ''))
}

// Format UAE phone number
export function formatUAEPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  let cleanPhone = phone.replace(/\D/g, '')
  
  // Remove country code if present
  if (cleanPhone.startsWith('971')) {
    cleanPhone = cleanPhone.substring(3)
  }
  
  // Add country code and format
  if (cleanPhone.length === 8 || cleanPhone.length === 9) {
    return `+971 ${cleanPhone.substring(0, 1)} ${cleanPhone.substring(1, 4)} ${cleanPhone.substring(4)}`
  }
  
  return phone // Return original if can't format
}

// Validate customer credit based on UAE business rules
export function validateCustomerCredit(
  creditLimit: number,
  businessType: UAEBusinessType,
  outstandingBalance: number = 0
): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []
  
  // Basic credit limit validation
  if (creditLimit < 0) {
    errors.push('Credit limit cannot be negative')
  }
  
  if (creditLimit > 50000000) { // 50M AED
    errors.push('Credit limit exceeds regulatory maximum')
  }
  
  // Business type specific warnings
  const businessRules = UAE_BUSINESS_TYPES[businessType]
  if (businessType === 'SOLE_PROPRIETORSHIP' && creditLimit > 1000000) {
    warnings.push('High credit limit for sole proprietorship - consider additional verification')
  }
  
  if (businessType === 'LLC' && creditLimit > businessRules.minShareCapital * 10) {
    warnings.push('Credit limit is very high relative to minimum share capital')
  }
  
  // Outstanding balance warnings
  if (outstandingBalance > creditLimit * 0.8) {
    warnings.push('Outstanding balance is approaching credit limit')
  }
  
  if (outstandingBalance > creditLimit) {
    errors.push('Outstanding balance exceeds credit limit')
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

// Calculate payment due date based on UAE business rules
export function calculatePaymentDueDate(
  invoiceDate: Date,
  paymentTerms: number,
  businessHours: UAEBusinessHours = DEFAULT_UAE_BUSINESS_HOURS
): Date {
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + paymentTerms)
  
  // If due date falls on weekend/holiday, move to next business day
  while (!businessHours.workingDays.includes(dueDate.getDay())) {
    dueDate.setDate(dueDate.getDate() + 1)
  }
  
  return dueDate
}

// Generate customer risk assessment based on UAE business context
export function assessCustomerRisk(customerData: {
  businessType: UAEBusinessType
  paymentHistory?: { avgPaymentDays: number; latePayments: number; totalInvoices: number }
  creditUtilization?: number
  outstandingBalance?: number
  creditLimit?: number
}): {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskScore: number
  factors: string[]
  recommendations: string[]
} {
  let riskScore = 0
  const factors: string[] = []
  const recommendations: string[] = []
  
  // Business type risk
  const businessTypeRisk = {
    'LLC': 2,
    'FREE_ZONE': 3,
    'SOLE_PROPRIETORSHIP': 5,
    'PARTNERSHIP': 4,
    'BRANCH': 2
  }
  
  riskScore += businessTypeRisk[customerData.businessType]
  factors.push(`Business type: ${UAE_BUSINESS_TYPES[customerData.businessType].label}`)
  
  // Payment history risk
  if (customerData.paymentHistory) {
    const { avgPaymentDays, latePayments, totalInvoices } = customerData.paymentHistory
    const latePaymentRate = totalInvoices > 0 ? latePayments / totalInvoices : 0
    
    if (avgPaymentDays > 45) {
      riskScore += 15
      factors.push('Slow payment history')
      recommendations.push('Consider shorter payment terms')
    }
    
    if (latePaymentRate > 0.3) {
      riskScore += 20
      factors.push('High rate of late payments')
      recommendations.push('Implement payment reminders')
    }
  }
  
  // Credit utilization risk
  if (customerData.creditUtilization && customerData.creditUtilization > 0.8) {
    riskScore += 25
    factors.push('High credit utilization')
    recommendations.push('Review credit limit or request payment')
  }
  
  // Outstanding balance risk
  if (customerData.outstandingBalance && customerData.creditLimit) {
    const utilizationRatio = customerData.outstandingBalance / customerData.creditLimit
    if (utilizationRatio > 1) {
      riskScore += 30
      factors.push('Exceeds credit limit')
      recommendations.push('Immediate collection action required')
    }
  }
  
  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  if (riskScore <= 15) riskLevel = 'LOW'
  else if (riskScore <= 35) riskLevel = 'MEDIUM'
  else if (riskScore <= 60) riskLevel = 'HIGH'
  else riskLevel = 'CRITICAL'
  
  // Add general recommendations
  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    recommendations.push('Consider payment guarantee or advance payment')
    recommendations.push('Increase monitoring frequency')
  }
  
  return {
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    factors,
    recommendations
  }
}

// Enhanced helper functions for business hours enforcement

/**
 * Check if current time is during prayer time
 */
function isPrayerTimeHour(hour: number, minute: number, bufferMinutes: number): boolean {
  // Simplified prayer time detection (would need proper Islamic prayer time library)
  const prayerTimes = [
    { start: 5, end: 6 },   // Fajr
    { start: 12, end: 13 }, // Dhuhr
    { start: 15, end: 16 }, // Asr
    { start: 18, end: 19 }, // Maghrib
    { start: 20, end: 21 }  // Isha
  ]

  const currentMinutes = hour * 60 + minute

  return prayerTimes.some(prayer => {
    const startMinutes = prayer.start * 60 - bufferMinutes
    const endMinutes = prayer.end * 60 + bufferMinutes
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  })
}

/**
 * Check if date is a UAE public holiday
 */
function isUAEHoliday(date: Date, customHolidays: Date[]): boolean {
  // Check custom holidays
  const isCustomHoliday = customHolidays.some(holiday =>
    holiday.getFullYear() === date.getFullYear() &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getDate() === date.getDate()
  )

  if (isCustomHoliday) return true

  // UAE National Day (December 2)
  if (date.getMonth() === 11 && date.getDate() === 2) return true

  // UAE Commemoration Day (November 30)
  if (date.getMonth() === 10 && date.getDate() === 30) return true

  // New Year's Day (January 1)
  if (date.getMonth() === 0 && date.getDate() === 1) return true

  // Would need Islamic calendar library for Eid holidays, Prophet's Birthday, etc.
  return false
}

/**
 * Get day name for error messages
 */
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek] || 'Unknown'
}

/**
 * Get next working day
 */
function getNextWorkingDay(currentDate: Date, businessHours: UAEBusinessHours): Date {
  const nextDay = new Date(currentDate)
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(businessHours.startHour, 0, 0, 0)

  // Keep advancing until we find a working day
  let attempts = 0
  while (attempts < 14) { // Prevent infinite loop
    const dayOfWeek = nextDay.getDay()
    const isWorkingDay = businessHours.workingDays.includes(dayOfWeek)
    const isHoliday = isUAEHoliday(nextDay, businessHours.customHolidays)

    if (isWorkingDay && (!isHoliday || businessHours.allowHolidays)) {
      return nextDay
    }

    nextDay.setDate(nextDay.getDate() + 1)
    attempts++
  }

  return nextDay // Fallback
}

/**
 * Get next available time considering all restrictions
 */
function getNextAvailableTime(currentDate: Date, businessHours: UAEBusinessHours): Date {
  const nextTime = new Date(currentDate)
  const hour = nextTime.getHours()

  // If we're in the same day, try to find next available hour
  const dayOfWeek = nextTime.getDay()
  const isWorkingDay = businessHours.workingDays.includes(dayOfWeek)
  const isHoliday = isUAEHoliday(nextTime, businessHours.customHolidays)

  if (isWorkingDay && (!isHoliday || businessHours.allowHolidays)) {
    // Check if we can schedule later today
    const isRamadan = isRamadanPeriod(nextTime)
    const month = nextTime.getMonth() + 1
    const isSummer = businessHours.seasonalAdjustments?.summer.enabled &&
      businessHours.seasonalAdjustments.summer.applicableMonths.includes(month)

    let effectiveEndHour = businessHours.endHour
    if (isRamadan && businessHours.seasonalAdjustments?.ramadan.enabled) {
      effectiveEndHour = businessHours.seasonalAdjustments.ramadan.endHour
    } else if (isSummer && businessHours.seasonalAdjustments?.summer.enabled) {
      effectiveEndHour = businessHours.seasonalAdjustments.summer.adjustedEndHour
    }

    // If we're before end of day, try scheduling later today
    if (hour < effectiveEndHour - 1) {
      // Skip lunch break if applicable
      if (businessHours.lunchBreak?.enabled &&
          hour < businessHours.lunchBreak.endHour) {
        nextTime.setHours(businessHours.lunchBreak.endHour, 0, 0, 0)
        return nextTime
      }

      // Otherwise, schedule for next hour
      nextTime.setHours(hour + 1, 0, 0, 0)
      return nextTime
    }
  }

  // Schedule for next working day
  return getNextWorkingDay(currentDate, businessHours)
}

/**
 * Enhanced currency formatting for UAE business context
 */
export function formatUAEBusinessCurrency(
  amount: number | string | Decimal,
  context: 'invoice' | 'receipt' | 'statement' | 'banking' | 'regulatory' = 'invoice'
): string {
  const amountDecimal = new Decimal(amount)
  const config = UAE_CURRENCY_PRESETS[context.toUpperCase() as keyof typeof UAE_CURRENCY_PRESETS]

  const result = formatEnhancedUAECurrency(amountDecimal, config)
  return result.formatted
}

/**
 * Validate and format currency for specific business context
 */
export function validateAndFormatUAECurrency(
  amount: number | string | Decimal,
  context: 'invoice' | 'receipt' | 'statement' | 'banking' | 'regulatory' = 'invoice'
): {
  isValid: boolean
  formatted?: string
  errors: string[]
  warnings: string[]
} {
  try {
    const amountDecimal = new Decimal(amount)
    const config = UAE_CURRENCY_PRESETS[context.toUpperCase() as keyof typeof UAE_CURRENCY_PRESETS]

    const result = formatEnhancedUAECurrency(amountDecimal, config)

    const errors: string[] = []
    const warnings: string[] = []

    if (!result.compliance.isValidAmount) {
      errors.push('Invalid amount')
    }

    if (!result.compliance.invoiceCompliant && context === 'invoice') {
      warnings.push('Amount may require additional verification for invoicing')
    }

    if (!result.compliance.withinBankingLimits) {
      errors.push('Amount exceeds banking transaction limits')
    }

    return {
      isValid: errors.length === 0,
      formatted: result.formatted,
      errors,
      warnings
    }
  } catch (error) {
    return {
      isValid: false,
      errors: ['Invalid amount format'],
      warnings: []
    }
  }
}