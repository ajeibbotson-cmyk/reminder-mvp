import { Decimal } from 'decimal.js'

/**
 * Enhanced UAE VAT Calculator
 * Comprehensive implementation with exemptions, zero-rated items, and compliance features
 * Based on UAE Federal Tax Authority regulations
 */

// Enhanced VAT categories with detailed descriptions
export const UAE_VAT_CATEGORIES = {
  STANDARD: {
    rate: new Decimal(5.00),
    code: 'S',
    description: 'Standard Rate (5%)',
    descriptionAr: 'المعدل القياسي (٥٪)',
    applies: 'Most goods and services'
  },
  ZERO_RATED: {
    rate: new Decimal(0.00),
    code: 'Z',
    description: 'Zero Rated (0%)',
    descriptionAr: 'معدل صفر (٠٪)',
    applies: 'Exports, international transport, precious metals'
  },
  EXEMPT: {
    rate: new Decimal(0.00),
    code: 'E',
    description: 'Exempt from VAT',
    descriptionAr: 'معفى من ضريبة القيمة المضافة',
    applies: 'Financial services, healthcare, education, real estate'
  },
  OUT_OF_SCOPE: {
    rate: new Decimal(0.00),
    code: 'O',
    description: 'Out of Scope',
    descriptionAr: 'خارج النطاق',
    applies: 'Activities not subject to VAT'
  }
} as const

export type UAEVATCategory = keyof typeof UAE_VAT_CATEGORIES

// Specific item categories for automatic VAT classification
export const UAE_ITEM_CATEGORIES = {
  // Zero-rated items
  EXPORTS: { category: 'ZERO_RATED' as UAEVATCategory, description: 'Goods exported outside GCC' },
  INTERNATIONAL_TRANSPORT: { category: 'ZERO_RATED' as UAEVATCategory, description: 'International passenger and freight transport' },
  PRECIOUS_METALS: { category: 'ZERO_RATED' as UAEVATCategory, description: 'Investment grade precious metals' },
  QUALIFYING_MEDICINES: { category: 'ZERO_RATED' as UAEVATCategory, description: 'Essential medicines approved by MoH' },

  // Exempt items
  FINANCIAL_SERVICES: { category: 'EXEMPT' as UAEVATCategory, description: 'Banking, insurance, investment services' },
  HEALTHCARE_SERVICES: { category: 'EXEMPT' as UAEVATCategory, description: 'Medical and healthcare services' },
  EDUCATION_SERVICES: { category: 'EXEMPT' as UAEVATCategory, description: 'Educational services by licensed providers' },
  RESIDENTIAL_PROPERTY: { category: 'EXEMPT' as UAEVATCategory, description: 'Residential property sales and rentals' },
  LOCAL_PASSENGER_TRANSPORT: { category: 'EXEMPT' as UAEVATCategory, description: 'Local public transport services' },

  // Standard rate items
  GENERAL_GOODS: { category: 'STANDARD' as UAEVATCategory, description: 'General goods and services' },
  COMMERCIAL_PROPERTY: { category: 'STANDARD' as UAEVATCategory, description: 'Commercial property transactions' },
  HOSPITALITY: { category: 'STANDARD' as UAEVATCategory, description: 'Hotel and restaurant services' },
  TELECOMMUNICATIONS: { category: 'STANDARD' as UAEVATCategory, description: 'Telecom and IT services' }
} as const

export interface EnhancedVATCalculationInput {
  amount: number | string | Decimal
  vatCategory?: UAEVATCategory
  customVatRate?: number | string | Decimal
  itemCategory?: keyof typeof UAE_ITEM_CATEGORIES
  currency?: string
  isVatInclusive?: boolean
  businessPurpose?: 'B2B' | 'B2C' | 'EXPORT' | 'IMPORT'
  customerLocation?: 'UAE' | 'GCC' | 'INTERNATIONAL'
  description?: string
}

export interface EnhancedVATCalculationResult {
  // Core calculation
  subtotal: Decimal
  vatRate: Decimal
  vatAmount: Decimal
  totalAmount: Decimal

  // Classification
  vatCategory: UAEVATCategory
  vatCode: string
  description: string
  descriptionAr: string

  // Compliance
  currency: string
  isVatInclusive: boolean
  businessPurpose?: string
  customerLocation?: string

  // Formatted display
  formatted: {
    subtotal: string
    vatAmount: string
    totalAmount: string
    vatRate: string
    vatDisplay: string // e.g., "5% VAT", "VAT Exempt", "Zero Rated"
  }

  // Compliance notes
  complianceNotes: string[]
}

export interface EnhancedInvoiceVATSummary {
  lineItems: EnhancedLineItemVAT[]

  // Totals by category
  categoryTotals: {
    [K in UAEVATCategory]?: {
      category: K
      description: string
      taxableAmount: Decimal
      vatAmount: Decimal
      lineCount: number
    }
  }

  // Overall totals
  subtotal: Decimal
  totalVatAmount: Decimal
  grandTotal: Decimal
  currency: string

  // Compliance information
  vatRegistrationRequired: boolean
  reverseChargeApplicable: boolean
  complianceNotes: string[]

  // Formatted totals
  formatted: {
    subtotal: string
    totalVatAmount: string
    grandTotal: string
    vatSummary: string
  }
}

export interface EnhancedLineItemVAT {
  description: string
  quantity: Decimal
  unitPrice: Decimal
  lineTotal: Decimal
  vatCategory: UAEVATCategory
  vatRate: Decimal
  vatAmount: Decimal
  totalWithVat: Decimal
  vatCode: string
  complianceNotes: string[]
}

/**
 * Enhanced VAT calculation with comprehensive UAE compliance
 */
export function calculateEnhancedVAT(input: EnhancedVATCalculationInput): EnhancedVATCalculationResult {
  const {
    amount,
    vatCategory,
    customVatRate,
    itemCategory,
    currency = 'AED',
    isVatInclusive = false,
    businessPurpose,
    customerLocation = 'UAE',
    description = ''
  } = input

  // Convert amount to Decimal for precise calculations
  const amountDecimal = new Decimal(amount)

  // Determine VAT category and rate
  let effectiveVatCategory: UAEVATCategory
  let effectiveVatRate: Decimal

  if (customVatRate !== undefined) {
    effectiveVatRate = new Decimal(customVatRate)
    effectiveVatCategory = determineVATCategoryFromRate(effectiveVatRate)
  } else if (vatCategory) {
    effectiveVatCategory = vatCategory
    effectiveVatRate = UAE_VAT_CATEGORIES[vatCategory].rate
  } else if (itemCategory) {
    effectiveVatCategory = UAE_ITEM_CATEGORIES[itemCategory].category
    effectiveVatRate = UAE_VAT_CATEGORIES[effectiveVatCategory].rate
  } else {
    // Apply business rules to determine category
    const autoCategory = determineVATCategoryFromContext(businessPurpose, customerLocation)
    effectiveVatCategory = autoCategory
    effectiveVatRate = UAE_VAT_CATEGORIES[autoCategory].rate
  }

  // Validate VAT rate
  if (effectiveVatRate.lessThan(0) || effectiveVatRate.greaterThan(100)) {
    throw new Error(`Invalid VAT rate: ${effectiveVatRate.toString()}%. Must be between 0% and 100%.`)
  }

  // Calculate amounts
  let subtotal: Decimal
  let vatAmount: Decimal
  let totalAmount: Decimal

  if (isVatInclusive) {
    totalAmount = amountDecimal
    if (effectiveVatRate.equals(0)) {
      subtotal = totalAmount
      vatAmount = new Decimal(0)
    } else {
      const vatFactor = effectiveVatRate.dividedBy(100).plus(1)
      subtotal = totalAmount.dividedBy(vatFactor)
      vatAmount = totalAmount.minus(subtotal)
    }
  } else {
    subtotal = amountDecimal
    vatAmount = subtotal.times(effectiveVatRate.dividedBy(100))
    totalAmount = subtotal.plus(vatAmount)
  }

  // Round to 2 decimal places
  subtotal = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  vatAmount = vatAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  totalAmount = totalAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  // Generate compliance notes
  const complianceNotes = generateComplianceNotes(effectiveVatCategory, businessPurpose, customerLocation, subtotal)

  const categoryInfo = UAE_VAT_CATEGORIES[effectiveVatCategory]

  return {
    subtotal,
    vatRate: effectiveVatRate,
    vatAmount,
    totalAmount,
    vatCategory: effectiveVatCategory,
    vatCode: categoryInfo.code,
    description: categoryInfo.description,
    descriptionAr: categoryInfo.descriptionAr,
    currency,
    isVatInclusive,
    businessPurpose,
    customerLocation,
    formatted: {
      subtotal: formatUAECurrency(subtotal, currency),
      vatAmount: formatUAECurrency(vatAmount, currency),
      totalAmount: formatUAECurrency(totalAmount, currency),
      vatRate: `${effectiveVatRate.toString()}%`,
      vatDisplay: formatVATDisplay(effectiveVatCategory, effectiveVatRate)
    },
    complianceNotes
  }
}

/**
 * Calculate VAT for complete invoice with multiple line items
 */
export function calculateEnhancedInvoiceVAT(
  lineItems: Array<{
    description: string
    quantity: number | string | Decimal
    unitPrice: number | string | Decimal
    vatCategory?: UAEVATCategory
    customVatRate?: number | string | Decimal
    itemCategory?: keyof typeof UAE_ITEM_CATEGORIES
    businessPurpose?: 'B2B' | 'B2C' | 'EXPORT' | 'IMPORT'
  }>,
  options: {
    currency?: string
    customerLocation?: 'UAE' | 'GCC' | 'INTERNATIONAL'
    supplierVATRegistered?: boolean
    customerVATRegistered?: boolean
  } = {}
): EnhancedInvoiceVATSummary {
  const {
    currency = 'AED',
    customerLocation = 'UAE',
    supplierVATRegistered = true,
    customerVATRegistered = false
  } = options

  const calculatedLineItems: EnhancedLineItemVAT[] = []
  const categoryTotals: EnhancedInvoiceVATSummary['categoryTotals'] = {}

  let subtotal = new Decimal(0)
  let totalVatAmount = new Decimal(0)

  for (const item of lineItems) {
    const quantity = new Decimal(item.quantity)
    const unitPrice = new Decimal(item.unitPrice)
    const lineTotal = quantity.times(unitPrice)

    // Calculate VAT for this line item
    const vatCalculation = calculateEnhancedVAT({
      amount: lineTotal,
      vatCategory: item.vatCategory,
      customVatRate: item.customVatRate,
      itemCategory: item.itemCategory,
      businessPurpose: item.businessPurpose,
      currency,
      customerLocation,
      isVatInclusive: false,
      description: item.description
    })

    const lineItemVAT: EnhancedLineItemVAT = {
      description: item.description,
      quantity,
      unitPrice,
      lineTotal: vatCalculation.subtotal,
      vatCategory: vatCalculation.vatCategory,
      vatRate: vatCalculation.vatRate,
      vatAmount: vatCalculation.vatAmount,
      totalWithVat: vatCalculation.totalAmount,
      vatCode: vatCalculation.vatCode,
      complianceNotes: vatCalculation.complianceNotes
    }

    calculatedLineItems.push(lineItemVAT)

    // Accumulate totals
    subtotal = subtotal.plus(vatCalculation.subtotal)
    totalVatAmount = totalVatAmount.plus(vatCalculation.vatAmount)

    // Track category totals
    const category = vatCalculation.vatCategory
    if (!categoryTotals[category]) {
      categoryTotals[category] = {
        category,
        description: vatCalculation.description,
        taxableAmount: new Decimal(0),
        vatAmount: new Decimal(0),
        lineCount: 0
      }
    }

    categoryTotals[category]!.taxableAmount = categoryTotals[category]!.taxableAmount.plus(vatCalculation.subtotal)
    categoryTotals[category]!.vatAmount = categoryTotals[category]!.vatAmount.plus(vatCalculation.vatAmount)
    categoryTotals[category]!.lineCount++
  }

  const grandTotal = subtotal.plus(totalVatAmount)

  // Determine compliance requirements
  const vatRegistrationRequired = determineVATRegistrationRequirement(subtotal, supplierVATRegistered)
  const reverseChargeApplicable = determineReverseCharge(customerLocation, customerVATRegistered, supplierVATRegistered)

  const complianceNotes = generateInvoiceComplianceNotes({
    categoryTotals,
    customerLocation,
    supplierVATRegistered,
    customerVATRegistered,
    vatRegistrationRequired,
    reverseChargeApplicable,
    totalAmount: grandTotal
  })

  return {
    lineItems: calculatedLineItems,
    categoryTotals,
    subtotal: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalVatAmount: totalVatAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    grandTotal: grandTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    currency,
    vatRegistrationRequired,
    reverseChargeApplicable,
    complianceNotes,
    formatted: {
      subtotal: formatUAECurrency(subtotal, currency),
      totalVatAmount: formatUAECurrency(totalVatAmount, currency),
      grandTotal: formatUAECurrency(grandTotal, currency),
      vatSummary: generateVATSummaryText(categoryTotals, currency)
    }
  }
}

/**
 * Helper functions
 */

function determineVATCategoryFromRate(rate: Decimal): UAEVATCategory {
  if (rate.equals(5)) return 'STANDARD'
  if (rate.equals(0)) return 'ZERO_RATED' // Default assumption for 0%
  throw new Error(`Unsupported VAT rate: ${rate.toString()}%`)
}

function determineVATCategoryFromContext(
  businessPurpose?: 'B2B' | 'B2C' | 'EXPORT' | 'IMPORT',
  customerLocation?: 'UAE' | 'GCC' | 'INTERNATIONAL'
): UAEVATCategory {
  // Export transactions are typically zero-rated
  if (businessPurpose === 'EXPORT' || customerLocation === 'INTERNATIONAL') {
    return 'ZERO_RATED'
  }

  // Default to standard rate for UAE domestic transactions
  return 'STANDARD'
}

function generateComplianceNotes(
  category: UAEVATCategory,
  businessPurpose?: string,
  customerLocation?: string,
  amount?: Decimal
): string[] {
  const notes: string[] = []

  if (category === 'ZERO_RATED') {
    notes.push('Zero-rated supply - maintain supporting documentation for export/qualifying goods')
  }

  if (category === 'EXEMPT') {
    notes.push('Exempt supply - no VAT recovery on related input costs')
  }

  if (businessPurpose === 'EXPORT') {
    notes.push('Export transaction - ensure proper export documentation is maintained')
  }

  if (customerLocation === 'GCC') {
    notes.push('GCC transaction - verify customer VAT registration status for reverse charge')
  }

  if (amount && amount.greaterThan(10000)) {
    notes.push('High-value transaction - additional compliance verification may be required')
  }

  return notes
}

function determineVATRegistrationRequirement(totalAmount: Decimal, isRegistered: boolean): boolean {
  // UAE VAT registration threshold is AED 375,000 annual turnover
  // This is a simplified check - in practice, this would track annual totals
  return totalAmount.greaterThan(375000) || isRegistered
}

function determineReverseCharge(
  customerLocation?: string,
  customerVATRegistered?: boolean,
  supplierVATRegistered?: boolean
): boolean {
  // Simplified reverse charge logic
  return customerLocation === 'GCC' && customerVATRegistered === true && supplierVATRegistered === true
}

function generateInvoiceComplianceNotes(context: {
  categoryTotals: EnhancedInvoiceVATSummary['categoryTotals']
  customerLocation?: string
  supplierVATRegistered?: boolean
  customerVATRegistered?: boolean
  vatRegistrationRequired: boolean
  reverseChargeApplicable: boolean
  totalAmount: Decimal
}): string[] {
  const notes: string[] = []

  if (context.reverseChargeApplicable) {
    notes.push('Reverse charge mechanism may apply - customer responsible for VAT accounting')
  }

  if (!context.supplierVATRegistered && context.vatRegistrationRequired) {
    notes.push('VAT registration may be required based on transaction volume')
  }

  if (context.categoryTotals.EXEMPT || context.categoryTotals.ZERO_RATED) {
    notes.push('Mixed supply detected - ensure proper VAT treatment documentation')
  }

  if (context.totalAmount.greaterThan(50000)) {
    notes.push('High-value invoice - consider additional compliance verification')
  }

  return notes
}

function formatVATDisplay(category: UAEVATCategory, rate: Decimal): string {
  switch (category) {
    case 'STANDARD':
      return `${rate.toString()}% VAT`
    case 'ZERO_RATED':
      return 'Zero Rated'
    case 'EXEMPT':
      return 'VAT Exempt'
    case 'OUT_OF_SCOPE':
      return 'Out of Scope'
    default:
      return `${rate.toString()}% VAT`
  }
}

function generateVATSummaryText(
  categoryTotals: EnhancedInvoiceVATSummary['categoryTotals'],
  currency: string
): string {
  const summaryParts: string[] = []

  Object.entries(categoryTotals).forEach(([category, totals]) => {
    if (totals) {
      summaryParts.push(`${totals.description}: ${formatUAECurrency(totals.vatAmount, currency)}`)
    }
  })

  return summaryParts.join(', ')
}

export function formatUAECurrency(
  amount: number | string | Decimal,
  currency = 'AED',
  locale = 'en-AE'
): string {
  const amountDecimal = new Decimal(amount)
  const numericAmount = amountDecimal.toNumber()

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericAmount)
  } catch {
    return `${currency} ${amountDecimal.toFixed(2)}`
  }
}

/**
 * Validate VAT number format (for GCC cross-border transactions)
 */
export function validateGCCVATNumber(vatNumber: string, country: 'UAE' | 'KSA' | 'BHR' | 'OMN' | 'QAT' | 'KWT'): boolean {
  const patterns = {
    UAE: /^\d{15}$/, // Same as TRN
    KSA: /^\d{15}$/,
    BHR: /^\d{8}$/,
    OMN: /^\d{8}$/,
    QAT: /^\d{11}$/,
    KWT: /^\d{12}$/
  }

  return patterns[country].test(vatNumber.replace(/\D/g, ''))
}

// Types are already exported as interfaces above