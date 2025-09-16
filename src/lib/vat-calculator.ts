import { Decimal } from 'decimal.js'

// UAE VAT Configuration
export const UAE_VAT_RATES = {
  STANDARD: new Decimal(5.00), // 5% standard VAT rate
  ZERO_RATED: new Decimal(0.00), // 0% for exports and essential goods
  EXEMPT: new Decimal(0.00), // Exempt from VAT (e.g., financial services)
} as const

export type VATCategory = keyof typeof UAE_VAT_RATES

export interface VATCalculationInput {
  amount: number | string | Decimal
  vatRate?: number | string | Decimal
  taxCategory?: VATCategory
  currency?: string
  isVatInclusive?: boolean
}

export interface VATCalculationResult {
  subtotal: Decimal
  vatRate: Decimal
  vatAmount: Decimal
  totalAmount: Decimal
  taxCategory: VATCategory
  currency: string
  isVatInclusive: boolean
  // Formatted strings for display (AED currency format)
  formatted: {
    subtotal: string
    vatAmount: string
    totalAmount: string
    vatRate: string
  }
}

export interface LineItemVAT {
  description: string
  quantity: Decimal
  unitPrice: Decimal
  lineTotal: Decimal
  vatRate: Decimal
  vatAmount: Decimal
  totalWithVat: Decimal
  taxCategory: VATCategory
}

export interface InvoiceVATSummary {
  lineItems: LineItemVAT[]
  subtotal: Decimal
  totalVatAmount: Decimal
  grandTotal: Decimal
  vatBreakdown: {
    [key in VATCategory]?: {
      rate: Decimal
      taxableAmount: Decimal
      vatAmount: Decimal
    }
  }
  currency: string
  formatted: {
    subtotal: string
    totalVatAmount: string
    grandTotal: string
  }
}

/**
 * Calculate VAT for a single amount based on UAE tax regulations
 */
export function calculateVAT(input: VATCalculationInput): VATCalculationResult {
  const {
    amount,
    vatRate,
    taxCategory = 'STANDARD',
    currency = 'AED',
    isVatInclusive = false
  } = input

  // Convert amount to Decimal for precise calculations
  const amountDecimal = new Decimal(amount)
  
  // Determine VAT rate based on tax category or custom rate
  let effectiveVatRate: Decimal
  if (vatRate !== undefined) {
    effectiveVatRate = new Decimal(vatRate)
  } else {
    effectiveVatRate = UAE_VAT_RATES[taxCategory]
  }

  // Validate VAT rate is within acceptable range (0-100%)
  if (effectiveVatRate.lessThan(0) || effectiveVatRate.greaterThan(100)) {
    throw new Error(`Invalid VAT rate: ${effectiveVatRate.toString()}%. Must be between 0% and 100%.`)
  }

  let subtotal: Decimal
  let vatAmount: Decimal
  let totalAmount: Decimal

  if (isVatInclusive) {
    // Amount includes VAT, need to calculate backwards
    totalAmount = amountDecimal
    
    // Formula: Subtotal = Total / (1 + VAT Rate / 100)
    const vatFactor = effectiveVatRate.dividedBy(100).plus(1)
    subtotal = totalAmount.dividedBy(vatFactor)
    vatAmount = totalAmount.minus(subtotal)
  } else {
    // Amount is exclusive of VAT
    subtotal = amountDecimal
    vatAmount = subtotal.times(effectiveVatRate.dividedBy(100))
    totalAmount = subtotal.plus(vatAmount)
  }

  // Round to 2 decimal places for currency precision
  subtotal = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  vatAmount = vatAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  totalAmount = totalAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  return {
    subtotal,
    vatRate: effectiveVatRate,
    vatAmount,
    totalAmount,
    taxCategory,
    currency,
    isVatInclusive,
    formatted: {
      subtotal: formatUAECurrency(subtotal, currency),
      vatAmount: formatUAECurrency(vatAmount, currency),
      totalAmount: formatUAECurrency(totalAmount, currency),
      vatRate: `${effectiveVatRate.toString()}%`
    }
  }
}

/**
 * Calculate VAT for multiple line items and provide invoice summary
 */
export function calculateInvoiceVAT(
  lineItems: Array<{
    description: string
    quantity: number | string | Decimal
    unitPrice: number | string | Decimal
    vatRate?: number | string | Decimal
    taxCategory?: VATCategory
  }>,
  currency = 'AED'
): InvoiceVATSummary {
  const calculatedLineItems: LineItemVAT[] = []
  const vatBreakdown: InvoiceVATSummary['vatBreakdown'] = {}

  let subtotal = new Decimal(0)
  let totalVatAmount = new Decimal(0)

  for (const item of lineItems) {
    const quantity = new Decimal(item.quantity)
    const unitPrice = new Decimal(item.unitPrice)
    const lineTotal = quantity.times(unitPrice)

    // Determine VAT rate for this line item
    const taxCategory: VATCategory = item.taxCategory || 'STANDARD'
    let vatRate: Decimal
    
    if (item.vatRate !== undefined) {
      vatRate = new Decimal(item.vatRate)
    } else {
      vatRate = UAE_VAT_RATES[taxCategory]
    }

    // Calculate VAT for this line item
    const vatCalculation = calculateVAT({
      amount: lineTotal,
      vatRate,
      taxCategory,
      currency,
      isVatInclusive: false
    })

    const lineItemVAT: LineItemVAT = {
      description: item.description,
      quantity,
      unitPrice,
      lineTotal: vatCalculation.subtotal,
      vatRate,
      vatAmount: vatCalculation.vatAmount,
      totalWithVat: vatCalculation.totalAmount,
      taxCategory
    }

    calculatedLineItems.push(lineItemVAT)

    // Accumulate totals
    subtotal = subtotal.plus(vatCalculation.subtotal)
    totalVatAmount = totalVatAmount.plus(vatCalculation.vatAmount)

    // Track VAT breakdown by category
    if (!vatBreakdown[taxCategory]) {
      vatBreakdown[taxCategory] = {
        rate: vatRate,
        taxableAmount: new Decimal(0),
        vatAmount: new Decimal(0)
      }
    }
    
    vatBreakdown[taxCategory]!.taxableAmount = 
      vatBreakdown[taxCategory]!.taxableAmount.plus(vatCalculation.subtotal)
    vatBreakdown[taxCategory]!.vatAmount = 
      vatBreakdown[taxCategory]!.vatAmount.plus(vatCalculation.vatAmount)
  }

  const grandTotal = subtotal.plus(totalVatAmount)

  return {
    lineItems: calculatedLineItems,
    subtotal: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalVatAmount: totalVatAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    grandTotal: grandTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    vatBreakdown,
    currency,
    formatted: {
      subtotal: formatUAECurrency(subtotal, currency),
      totalVatAmount: formatUAECurrency(totalVatAmount, currency),
      grandTotal: formatUAECurrency(grandTotal, currency)
    }
  }
}

/**
 * Validate TRN (Tax Registration Number) for UAE businesses
 */
export function validateUAETRN(trn: string): boolean {
  // UAE TRN format: 15 digits
  const trnRegex = /^\d{15}$/
  return trnRegex.test(trn.replace(/\s/g, ''))
}

/**
 * Format TRN for display with proper spacing
 */
export function formatUAETRN(trn: string): string {
  const cleanTrn = trn.replace(/\s/g, '')
  if (cleanTrn.length === 15) {
    // Format as: 123 456 789 123 456
    return cleanTrn.replace(/(\d{3})(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4 $5')
  }
  return cleanTrn
}

/**
 * Format currency amounts for UAE display (AED)
 */
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
    // Fallback formatting if locale is not supported
    return `${currency} ${amountDecimal.toFixed(2)}`
  }
}

/**
 * Check if a date/time falls within UAE business hours
 */
export function isUAEBusinessHours(
  date: Date,
  options: {
    workingDays?: number[] // 0=Sunday, 1=Monday, etc.
    startHour?: number
    endHour?: number
    timezone?: string
  } = {}
): boolean {
  const {
    workingDays = [0, 1, 2, 3, 4], // Sunday to Thursday (UAE working days)
    startHour = 8, // 8 AM
    endHour = 18, // 6 PM
    timezone = 'Asia/Dubai'
  } = options

  try {
    // Convert to UAE timezone
    const uaeDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    const dayOfWeek = uaeDate.getDay()
    const hour = uaeDate.getHours()

    // Check if it's a working day
    if (!workingDays.includes(dayOfWeek)) {
      return false
    }

    // Check if it's within working hours
    return hour >= startHour && hour < endHour
  } catch {
    // Fallback to simple check if timezone conversion fails
    const dayOfWeek = date.getDay()
    const hour = date.getHours()
    return workingDays.includes(dayOfWeek) && hour >= startHour && hour < endHour
  }
}

/**
 * Get the next UAE business hour time from a given date
 */
export function getNextUAEBusinessHour(
  fromDate: Date,
  options: {
    workingDays?: number[]
    startHour?: number
    endHour?: number
    timezone?: string
  } = {}
): Date {
  const {
    workingDays = [0, 1, 2, 3, 4],
    startHour = 8,
    endHour = 18,
    timezone = 'Asia/Dubai'
  } = options

  const currentDate = new Date(fromDate)
  const maxDays = 14 // Prevent infinite loop

  for (let i = 0; i < maxDays; i++) {
    if (isUAEBusinessHours(currentDate, options)) {
      return currentDate
    }

    // If we're past business hours for today, move to start of next business day
    try {
      const uaeDate = new Date(currentDate.toLocaleString('en-US', { timeZone: timezone }))
      const dayOfWeek = uaeDate.getDay()
      const hour = uaeDate.getHours()

      if (workingDays.includes(dayOfWeek) && hour >= endHour) {
        // Move to next day at start hour
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(startHour, 0, 0, 0)
      } else if (!workingDays.includes(dayOfWeek)) {
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(startHour, 0, 0, 0)
      } else {
        // Same day, just move to start hour
        currentDate.setHours(startHour, 0, 0, 0)
      }
    } catch {
      // Fallback: just add a day
      currentDate.setDate(currentDate.getDate() + 1)
      currentDate.setHours(startHour, 0, 0, 0)
    }
  }

  // If we couldn't find a business hour, return the original date
  return fromDate
}

/**
 * Calculate payment terms due date based on UAE business practices
 */
export function calculatePaymentDueDate(
  invoiceDate: Date,
  paymentTermsDays: number,
  excludeWeekends = true,
  excludeHolidays = false,
  uaeHolidays: Date[] = []
): Date {
  const dueDate = new Date(invoiceDate)
  let daysAdded = 0

  while (daysAdded < paymentTermsDays) {
    dueDate.setDate(dueDate.getDate() + 1)
    const dayOfWeek = dueDate.getDay()

    // Skip weekends (Friday = 5, Saturday = 6 in UAE)
    if (excludeWeekends && (dayOfWeek === 5 || dayOfWeek === 6)) {
      continue
    }

    // Skip holidays if specified
    if (excludeHolidays && uaeHolidays.some(holiday => 
      holiday.getFullYear() === dueDate.getFullYear() &&
      holiday.getMonth() === dueDate.getMonth() &&
      holiday.getDate() === dueDate.getDate()
    )) {
      continue
    }

    daysAdded++
  }

  return dueDate
}

// Export type utilities for better type safety
export type { VATCalculationInput, VATCalculationResult, LineItemVAT, InvoiceVATSummary }
// UAE_VAT_RATES already exported at top of file