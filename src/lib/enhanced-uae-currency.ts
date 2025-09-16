import { Decimal } from 'decimal.js'

/**
 * Enhanced UAE Currency Formatting Library
 * Comprehensive AED currency formatting with UAE financial standards compliance
 *
 * Features:
 * - Central Bank of UAE formatting standards
 * - Arabic and English number formatting
 * - Invoice and financial document compliance
 * - Banking and accounting precision
 * - Regulatory reporting formats
 */

export interface UAECurrencyConfig {
  currency: string
  locale: string
  arabicLocale: string
  precision: number
  rounding: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_CEIL' | 'ROUND_FLOOR'
  showCurrency: boolean
  useSymbol: boolean
  useArabicNumerals: boolean
  bankingFormat: boolean
  invoiceFormat: boolean
  compactFormat: boolean
}

export interface UAEFormattingResult {
  formatted: string
  formattedAr: string
  numericValue: Decimal
  currency: string
  locale: string
  precision: number
  // Additional formats for different use cases
  formats: {
    banking: string
    invoice: string
    receipt: string
    statement: string
    regulatory: string
    compact: string
    arabicNumerals: string
    englishNumerals: string
  }
  // Validation and compliance
  compliance: {
    isValidAmount: boolean
    meetsMinimumPrecision: boolean
    withinBankingLimits: boolean
    invoiceCompliant: boolean
    regulatoryCompliant: boolean
  }
}

// UAE Central Bank approved currency configuration
export const DEFAULT_UAE_CURRENCY_CONFIG: UAECurrencyConfig = {
  currency: 'AED',
  locale: 'en-AE',
  arabicLocale: 'ar-AE',
  precision: 2,
  rounding: 'ROUND_HALF_UP',
  showCurrency: true,
  useSymbol: true,
  useArabicNumerals: false,
  bankingFormat: false,
  invoiceFormat: false,
  compactFormat: false
}

// Predefined configurations for different use cases
export const UAE_CURRENCY_PRESETS = {
  STANDARD: {
    ...DEFAULT_UAE_CURRENCY_CONFIG,
    invoiceFormat: false,
    bankingFormat: false
  },
  BANKING: {
    ...DEFAULT_UAE_CURRENCY_CONFIG,
    bankingFormat: true,
    precision: 3,
    useSymbol: false
  },
  INVOICE: {
    ...DEFAULT_UAE_CURRENCY_CONFIG,
    invoiceFormat: true,
    precision: 2,
    useSymbol: true
  },
  RECEIPT: {
    ...DEFAULT_UAE_CURRENCY_CONFIG,
    compactFormat: true,
    precision: 2
  },
  REGULATORY: {
    ...DEFAULT_UAE_CURRENCY_CONFIG,
    precision: 2,
    useSymbol: false,
    bankingFormat: true
  },
  STATEMENT: {
    ...DEFAULT_UAE_CURRENCY_CONFIG,
    precision: 2,
    useSymbol: true,
    bankingFormat: true
  }
} as const

// UAE financial regulatory limits and constraints
export const UAE_FINANCIAL_LIMITS = {
  MIN_FILS: new Decimal(0.01), // Minimum currency unit (1 fils)
  MAX_TRANSACTION: new Decimal(999999999.99), // Practical maximum for most transactions
  MAX_INVOICE: new Decimal(50000000.00), // Typical maximum invoice amount
  BANKING_PRECISION: 3, // Banking systems often use 3 decimal places
  INVOICE_PRECISION: 2, // Invoices use 2 decimal places
  REGULATORY_PRECISION: 2 // Regulatory reporting uses 2 decimal places
}

// Arabic numerals mapping
const ARABIC_NUMERALS_MAP: { [key: string]: string } = {
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩',
  '.': '.',
  ',': '،'
}

/**
 * Enhanced UAE currency formatting with comprehensive compliance
 */
export function formatEnhancedUAECurrency(
  amount: number | string | Decimal,
  config: Partial<UAECurrencyConfig> = {}
): UAEFormattingResult {
  const finalConfig = { ...DEFAULT_UAE_CURRENCY_CONFIG, ...config }

  // Convert to Decimal for precise calculations
  const amountDecimal = new Decimal(amount)

  // Apply rounding based on configuration
  const roundedAmount = applyUAERounding(amountDecimal, finalConfig)

  // Validate amount against UAE financial limits
  const compliance = validateUAEFinancialCompliance(roundedAmount, finalConfig)

  // Generate all format variations
  const formats = generateAllFormats(roundedAmount, finalConfig)

  // Primary formatted value
  const formatted = generatePrimaryFormat(roundedAmount, finalConfig, false)
  const formattedAr = generatePrimaryFormat(roundedAmount, finalConfig, true)

  return {
    formatted,
    formattedAr,
    numericValue: roundedAmount,
    currency: finalConfig.currency,
    locale: finalConfig.locale,
    precision: finalConfig.precision,
    formats,
    compliance
  }
}

/**
 * Apply UAE-specific rounding rules
 */
function applyUAERounding(amount: Decimal, config: UAECurrencyConfig): Decimal {
  const roundingMode = getRoundingMode(config.rounding)
  return amount.toDecimalPlaces(config.precision, roundingMode)
}

/**
 * Get Decimal.js rounding mode from config
 */
function getRoundingMode(rounding: UAECurrencyConfig['rounding']): Decimal.Rounding {
  switch (rounding) {
    case 'ROUND_HALF_UP': return Decimal.ROUND_HALF_UP
    case 'ROUND_HALF_DOWN': return Decimal.ROUND_HALF_DOWN
    case 'ROUND_CEIL': return Decimal.ROUND_CEIL
    case 'ROUND_FLOOR': return Decimal.ROUND_FLOOR
    default: return Decimal.ROUND_HALF_UP
  }
}

/**
 * Validate amount against UAE financial compliance requirements
 */
function validateUAEFinancialCompliance(
  amount: Decimal,
  config: UAECurrencyConfig
): UAEFormattingResult['compliance'] {
  const isValidAmount = amount.greaterThanOrEqualTo(0)
  const meetsMinimumPrecision = amount.decimalPlaces() <= config.precision
  const withinBankingLimits = amount.lessThanOrEqualTo(UAE_FINANCIAL_LIMITS.MAX_TRANSACTION)

  const invoiceCompliant = config.invoiceFormat ?
    amount.lessThanOrEqualTo(UAE_FINANCIAL_LIMITS.MAX_INVOICE) &&
    amount.decimalPlaces() <= UAE_FINANCIAL_LIMITS.INVOICE_PRECISION : true

  const regulatoryCompliant = amount.decimalPlaces() <= UAE_FINANCIAL_LIMITS.REGULATORY_PRECISION &&
    amount.greaterThanOrEqualTo(UAE_FINANCIAL_LIMITS.MIN_FILS)

  return {
    isValidAmount,
    meetsMinimumPrecision,
    withinBankingLimits,
    invoiceCompliant,
    regulatoryCompliant
  }
}

/**
 * Generate all format variations for different use cases
 */
function generateAllFormats(
  amount: Decimal,
  config: UAECurrencyConfig
): UAEFormattingResult['formats'] {
  return {
    banking: formatForBanking(amount, config),
    invoice: formatForInvoice(amount, config),
    receipt: formatForReceipt(amount, config),
    statement: formatForStatement(amount, config),
    regulatory: formatForRegulatory(amount, config),
    compact: formatCompact(amount, config),
    arabicNumerals: formatWithArabicNumerals(amount, config),
    englishNumerals: formatWithEnglishNumerals(amount, config)
  }
}

/**
 * Generate primary format based on configuration
 */
function generatePrimaryFormat(
  amount: Decimal,
  config: UAECurrencyConfig,
  useArabic: boolean = false
): string {
  const locale = useArabic ? config.arabicLocale : config.locale

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: config.showCurrency ? 'currency' : 'decimal',
      currency: config.currency,
      minimumFractionDigits: config.precision,
      maximumFractionDigits: config.precision,
      currencyDisplay: config.useSymbol ? 'symbol' : 'code'
    }).format(amount.toNumber())

    if (useArabic && config.useArabicNumerals) {
      return convertToArabicNumerals(formatted)
    }

    return formatted
  } catch (error) {
    // Fallback formatting if locale is not supported
    return fallbackFormat(amount, config, useArabic)
  }
}

/**
 * Banking format with enhanced precision and compliance
 */
function formatForBanking(amount: Decimal, config: UAECurrencyConfig): string {
  const bankingConfig = { ...config, precision: UAE_FINANCIAL_LIMITS.BANKING_PRECISION }
  const roundedAmount = applyUAERounding(amount, bankingConfig)

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'decimal',
      minimumFractionDigits: bankingConfig.precision,
      maximumFractionDigits: bankingConfig.precision,
      useGrouping: true
    }).format(roundedAmount.toNumber()) + ` ${config.currency}`
  } catch {
    return `${config.currency} ${roundedAmount.toFixed(bankingConfig.precision)}`
  }
}

/**
 * Invoice format with UAE FTA compliance
 */
function formatForInvoice(amount: Decimal, config: UAECurrencyConfig): string {
  const invoiceConfig = { ...config, precision: UAE_FINANCIAL_LIMITS.INVOICE_PRECISION }
  const roundedAmount = applyUAERounding(amount, invoiceConfig)

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
      minimumFractionDigits: invoiceConfig.precision,
      maximumFractionDigits: invoiceConfig.precision,
      currencyDisplay: 'symbol'
    }).format(roundedAmount.toNumber())
  } catch {
    return `${config.currency} ${roundedAmount.toFixed(invoiceConfig.precision)}`
  }
}

/**
 * Receipt format for point-of-sale systems
 */
function formatForReceipt(amount: Decimal, config: UAECurrencyConfig): string {
  const roundedAmount = applyUAERounding(amount, config)

  // Compact format for receipts
  if (roundedAmount.lessThan(1000)) {
    return `${config.currency} ${roundedAmount.toFixed(config.precision)}`
  }

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
      minimumFractionDigits: config.precision,
      maximumFractionDigits: config.precision,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(roundedAmount.toNumber())
  } catch {
    return `${config.currency} ${roundedAmount.toFixed(config.precision)}`
  }
}

/**
 * Statement format for financial statements
 */
function formatForStatement(amount: Decimal, config: UAECurrencyConfig): string {
  const roundedAmount = applyUAERounding(amount, config)

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
      minimumFractionDigits: config.precision,
      maximumFractionDigits: config.precision,
      currencyDisplay: 'code',
      useGrouping: true
    }).format(roundedAmount.toNumber())
  } catch {
    return `${roundedAmount.toFixed(config.precision)} ${config.currency}`
  }
}

/**
 * Regulatory format for UAE Federal Tax Authority reporting
 */
function formatForRegulatory(amount: Decimal, config: UAECurrencyConfig): string {
  const regulatoryConfig = { ...config, precision: UAE_FINANCIAL_LIMITS.REGULATORY_PRECISION }
  const roundedAmount = applyUAERounding(amount, regulatoryConfig)

  // Regulatory format requires specific decimal notation
  return `${roundedAmount.toFixed(regulatoryConfig.precision)} ${config.currency}`
}

/**
 * Compact format for space-constrained displays
 */
function formatCompact(amount: Decimal, config: UAECurrencyConfig): string {
  const roundedAmount = applyUAERounding(amount, config)

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(roundedAmount.toNumber())
  } catch {
    // Fallback compact format
    if (roundedAmount.greaterThanOrEqualTo(1000000)) {
      return `${config.currency} ${roundedAmount.dividedBy(1000000).toFixed(1)}M`
    } else if (roundedAmount.greaterThanOrEqualTo(1000)) {
      return `${config.currency} ${roundedAmount.dividedBy(1000).toFixed(1)}K`
    }
    return `${config.currency} ${roundedAmount.toFixed(config.precision)}`
  }
}

/**
 * Format with Arabic numerals for Arabic language contexts
 */
function formatWithArabicNumerals(amount: Decimal, config: UAECurrencyConfig): string {
  const formatted = generatePrimaryFormat(amount, config, false)
  return convertToArabicNumerals(formatted)
}

/**
 * Format with English numerals explicitly
 */
function formatWithEnglishNumerals(amount: Decimal, config: UAECurrencyConfig): string {
  return generatePrimaryFormat(amount, { ...config, useArabicNumerals: false }, false)
}

/**
 * Convert Western numerals to Arabic numerals
 */
function convertToArabicNumerals(text: string): string {
  return text.replace(/[0-9.,]/g, (match) => ARABIC_NUMERALS_MAP[match] || match)
}

/**
 * Fallback formatting for unsupported locales
 */
function fallbackFormat(
  amount: Decimal,
  config: UAECurrencyConfig,
  useArabic: boolean = false
): string {
  const roundedAmount = applyUAERounding(amount, config)
  const formattedNumber = roundedAmount.toFixed(config.precision)

  if (config.showCurrency) {
    const currencySymbol = config.currency === 'AED' ? 'د.إ' : config.currency
    return useArabic ?
      `${convertToArabicNumerals(formattedNumber)} ${currencySymbol}` :
      `${currencySymbol} ${formattedNumber}`
  }

  return useArabic ? convertToArabicNumerals(formattedNumber) : formattedNumber
}

/**
 * Parse UAE currency string back to Decimal
 */
export function parseUAECurrency(currencyString: string): Decimal | null {
  try {
    // Remove currency symbols and non-numeric characters except decimal point
    const cleaned = currencyString
      .replace(/[^\d.-]/g, '')
      .replace(/[٠-٩]/g, (match) => {
        // Convert Arabic numerals back to Western numerals
        return Object.keys(ARABIC_NUMERALS_MAP).find(key =>
          ARABIC_NUMERALS_MAP[key] === match
        ) || match
      })

    if (!cleaned || isNaN(parseFloat(cleaned))) {
      return null
    }

    return new Decimal(cleaned)
  } catch {
    return null
  }
}

/**
 * Validate UAE currency amount format
 */
export function validateUAECurrencyAmount(
  amount: number | string | Decimal,
  config: Partial<UAECurrencyConfig> = {}
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const finalConfig = { ...DEFAULT_UAE_CURRENCY_CONFIG, ...config }

  try {
    const amountDecimal = new Decimal(amount)

    // Check if amount is negative
    if (amountDecimal.lessThan(0)) {
      errors.push('Amount cannot be negative')
    }

    // Check minimum amount (1 fils)
    if (amountDecimal.greaterThan(0) && amountDecimal.lessThan(UAE_FINANCIAL_LIMITS.MIN_FILS)) {
      errors.push(`Amount cannot be less than ${UAE_FINANCIAL_LIMITS.MIN_FILS.toString()} AED (1 fils)`)
    }

    // Check maximum transaction limit
    if (amountDecimal.greaterThan(UAE_FINANCIAL_LIMITS.MAX_TRANSACTION)) {
      errors.push(`Amount exceeds maximum transaction limit of ${UAE_FINANCIAL_LIMITS.MAX_TRANSACTION.toString()} AED`)
    }

    // Check precision
    if (amountDecimal.decimalPlaces() > finalConfig.precision) {
      warnings.push(`Amount has more than ${finalConfig.precision} decimal places and will be rounded`)
    }

    // Invoice-specific validation
    if (finalConfig.invoiceFormat && amountDecimal.greaterThan(UAE_FINANCIAL_LIMITS.MAX_INVOICE)) {
      warnings.push(`Invoice amount is unusually high and may require additional verification`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  } catch (error) {
    errors.push('Invalid amount format')
    return { isValid: false, errors, warnings }
  }
}

/**
 * Get UAE currency configuration for specific use case
 */
export function getUAECurrencyConfig(preset: keyof typeof UAE_CURRENCY_PRESETS): UAECurrencyConfig {
  return { ...UAE_CURRENCY_PRESETS[preset] }
}

/**
 * Calculate currency conversion display (for future multi-currency support)
 */
export function formatUAECurrencyWithConversion(
  amount: Decimal,
  fromCurrency: string,
  exchangeRate?: Decimal,
  config: Partial<UAECurrencyConfig> = {}
): { primary: string; converted?: string; rate?: string } {
  const result = formatEnhancedUAECurrency(amount, config)

  if (fromCurrency !== 'AED' && exchangeRate) {
    const convertedAmount = amount.times(exchangeRate)
    const convertedResult = formatEnhancedUAECurrency(convertedAmount, config)

    return {
      primary: result.formatted,
      converted: convertedResult.formatted,
      rate: `1 ${fromCurrency} = ${exchangeRate.toFixed(4)} AED`
    }
  }

  return { primary: result.formatted }
}

/**
 * Format currency for UAE tax reporting (FTA compliance)
 */
export function formatForUAETaxReporting(amount: Decimal): string {
  return formatEnhancedUAECurrency(amount, UAE_CURRENCY_PRESETS.REGULATORY).formats.regulatory
}

/**
 * Format currency for UAE banking systems
 */
export function formatForUAEBanking(amount: Decimal): string {
  return formatEnhancedUAECurrency(amount, UAE_CURRENCY_PRESETS.BANKING).formats.banking
}

/**
 * Format currency for UAE invoices (FTA e-invoicing compliance)
 */
export function formatForUAEInvoicing(amount: Decimal): string {
  return formatEnhancedUAECurrency(amount, UAE_CURRENCY_PRESETS.INVOICE).formats.invoice
}

// Export utility types
export type UAECurrencyPreset = keyof typeof UAE_CURRENCY_PRESETS
export type UAECurrencyAmount = number | string | Decimal