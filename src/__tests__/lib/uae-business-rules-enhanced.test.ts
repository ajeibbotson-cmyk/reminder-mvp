/**
 * Test suite for enhanced UAE business rules validation
 * Validates all Sprint 2.4 enhancements: TRN validation, VAT calculations, currency formatting, and business hours
 */

import { describe, it, expect } from '@jest/globals'
import { Decimal } from 'decimal.js'

// Enhanced TRN validation
import {
  validateEnhancedUAETRN,
  formatTRNForDisplay,
  generateSampleTRN,
  UAEEntityType
} from '../../lib/enhanced-uae-trn-validation'

// Enhanced VAT calculations
import {
  calculateEnhancedVAT,
  calculateEnhancedInvoiceVAT,
  UAE_VAT_RATES_ENHANCED,
  UAEVATCategory
} from '../../lib/enhanced-uae-vat-calculator'

// Enhanced currency formatting
import {
  formatEnhancedUAECurrency,
  parseUAECurrency,
  validateUAECurrencyAmount,
  UAE_CURRENCY_PRESETS
} from '../../lib/enhanced-uae-currency'

// Enhanced business hours
import {
  isWithinUAEBusinessHours,
  formatUAEBusinessCurrency,
  validateAndFormatUAECurrency,
  DEFAULT_UAE_BUSINESS_HOURS
} from '../../lib/uae-business-rules'

describe('Enhanced UAE Business Rules - Sprint 2.4', () => {
  describe('Enhanced TRN Validation', () => {
    it('should validate a properly formatted TRN with checksum', () => {
      // Generate a sample TRN for testing
      const sampleTrn = '400123456700123' // Company entity type with valid structure
      const result = validateEnhancedUAETRN(sampleTrn)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.entityType).toBe(UAEEntityType.COMPANY)
      expect(result.formatted).toBe('400-1234-5670-0123')
    })

    it('should detect invalid TRN format', () => {
      const invalidTrn = '123456789012345' // Invalid entity type
      const result = validateEnhancedUAETRN(invalidTrn)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should format TRN for display correctly', () => {
      const trn = '400123456700123'
      const formatted = formatTRNForDisplay(trn)
      expect(formatted).toBe('400-1234-5670-0123')
    })

    it('should validate entity type specific rules', () => {
      const individualTrn = '500123456700123'
      const result = validateEnhancedUAETRN(individualTrn)

      expect(result.entityType).toBe(UAEEntityType.INDIVIDUAL)
      expect(result.warnings).toContain('Individual TRN detected. Ensure this is for business purposes.')
    })
  })

  describe('Enhanced VAT Calculations', () => {
    it('should calculate standard VAT correctly', () => {
      const result = calculateEnhancedVAT({
        amount: new Decimal(1000),
        vatCategory: 'STANDARD',
        currency: 'AED',
        businessPurpose: 'B2B',
        customerLocation: 'UAE'
      })

      expect(result.subtotal.toString()).toBe('1000')
      expect(result.vatAmount.toString()).toBe('50') // 5% VAT
      expect(result.totalAmount.toString()).toBe('1050')
      expect(result.vatCategory).toBe('STANDARD')
    })

    it('should handle zero-rated transactions', () => {
      const result = calculateEnhancedVAT({
        amount: new Decimal(1000),
        vatCategory: 'ZERO_RATED',
        currency: 'AED',
        businessPurpose: 'EXPORT',
        customerLocation: 'INTERNATIONAL'
      })

      expect(result.vatAmount.toString()).toBe('0')
      expect(result.vatCategory).toBe('ZERO_RATED')
      expect(result.complianceNotes).toContain('Zero-rated for export transactions to international customers')
    })

    it('should handle exempt transactions', () => {
      const result = calculateEnhancedVAT({
        amount: new Decimal(1000),
        vatCategory: 'EXEMPT',
        currency: 'AED',
        businessPurpose: 'B2B'
      })

      expect(result.vatAmount.toString()).toBe('0')
      expect(result.vatCategory).toBe('EXEMPT')
    })

    it('should calculate multi-line invoice VAT correctly', () => {
      const lineItems = [
        {
          description: 'Standard Item',
          quantity: 2,
          unitPrice: 100,
          vatCategory: 'STANDARD' as UAEVATCategory
        },
        {
          description: 'Exempt Service',
          quantity: 1,
          unitPrice: 500,
          vatCategory: 'EXEMPT' as UAEVATCategory
        }
      ]

      const result = calculateEnhancedInvoiceVAT(lineItems, {
        currency: 'AED',
        customerLocation: 'UAE'
      })

      expect(result.subtotal.toString()).toBe('700')
      expect(result.totalVatAmount.toString()).toBe('10') // Only standard items have VAT
      expect(result.grandTotal.toString()).toBe('710')
    })
  })

  describe('Enhanced Currency Formatting', () => {
    it('should format AED currency with UAE standards', () => {
      const amount = new Decimal(1234.56)
      const result = formatEnhancedUAECurrency(amount, UAE_CURRENCY_PRESETS.STANDARD)

      expect(result.formatted).toMatch(/AED\s*1,234\.56|1,234\.56\s*AED/)
      expect(result.compliance.isValidAmount).toBe(true)
      expect(result.compliance.invoiceCompliant).toBe(true)
    })

    it('should format for banking context', () => {
      const amount = new Decimal(1234.567)
      const result = formatEnhancedUAECurrency(amount, UAE_CURRENCY_PRESETS.BANKING)

      expect(result.formats.banking).toContain('1,234.567')
      expect(result.precision).toBe(3)
    })

    it('should format for invoice context', () => {
      const amount = new Decimal(1234.56)
      const result = formatEnhancedUAECurrency(amount, UAE_CURRENCY_PRESETS.INVOICE)

      expect(result.formats.invoice).toMatch(/AED.*1,234\.56/)
      expect(result.compliance.invoiceCompliant).toBe(true)
    })

    it('should parse UAE currency strings correctly', () => {
      const currencyString = 'AED 1,234.56'
      const parsed = parseUAECurrency(currencyString)

      expect(parsed?.toString()).toBe('1234.56')
    })

    it('should validate currency amounts', () => {
      const validation = validateUAECurrencyAmount(1234.56)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject negative amounts', () => {
      const validation = validateUAECurrencyAmount(-100)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Amount cannot be negative')
    })
  })

  describe('Enhanced Business Hours Enforcement', () => {
    it('should validate standard business hours', () => {
      // Create a date for Tuesday at 10 AM Dubai time
      const businessHourDate = new Date('2024-01-02T10:00:00+04:00') // Tuesday
      const result = isWithinUAEBusinessHours(DEFAULT_UAE_BUSINESS_HOURS, businessHourDate)

      expect(result.isWithinHours).toBe(true)
      expect(result.contextInfo.isWorkingDay).toBe(true)
      expect(result.contextInfo.isLunchBreak).toBe(false)
    })

    it('should reject weekend days', () => {
      // Create a date for Friday
      const weekendDate = new Date('2024-01-05T10:00:00+04:00') // Friday
      const result = isWithinUAEBusinessHours(DEFAULT_UAE_BUSINESS_HOURS, weekendDate)

      expect(result.isWithinHours).toBe(false)
      expect(result.reason).toContain('not a working day')
      expect(result.contextInfo.isWorkingDay).toBe(false)
    })

    it('should detect lunch break hours', () => {
      // Create a date for Tuesday at 12:30 PM (lunch break)
      const lunchDate = new Date('2024-01-02T12:30:00+04:00') // Tuesday lunch time
      const result = isWithinUAEBusinessHours(DEFAULT_UAE_BUSINESS_HOURS, lunchDate)

      expect(result.isWithinHours).toBe(false)
      expect(result.reason).toBe('During lunch break')
      expect(result.contextInfo.isLunchBreak).toBe(true)
    })

    it('should handle grace period', () => {
      // Create a date for Tuesday at 7:45 AM (15 minutes before start, within grace period)
      const gracePeriodDate = new Date('2024-01-02T07:45:00+04:00')
      const result = isWithinUAEBusinessHours(DEFAULT_UAE_BUSINESS_HOURS, gracePeriodDate)

      expect(result.isWithinHours).toBe(true)
      expect(result.reason).toBe('Within grace period')
      expect(result.contextInfo.gracePeriodActive).toBe(true)
    })

    it('should provide next available time', () => {
      // Create a date for Friday at 10 AM (weekend)
      const weekendDate = new Date('2024-01-05T10:00:00+04:00') // Friday
      const result = isWithinUAEBusinessHours(DEFAULT_UAE_BUSINESS_HOURS, weekendDate)

      expect(result.nextAvailableTime).toBeDefined()
      expect(result.nextAvailableTime!.getDay()).toBe(0) // Should be Sunday (next working day)
    })
  })

  describe('Currency Integration with Business Rules', () => {
    it('should format currency for UAE business context', () => {
      const amount = new Decimal(1234.56)
      const formatted = formatUAEBusinessCurrency(amount, 'invoice')

      expect(formatted).toMatch(/AED.*1,234\.56/)
    })

    it('should validate and format currency with context', () => {
      const result = validateAndFormatUAECurrency(1234.56, 'banking')

      expect(result.isValid).toBe(true)
      expect(result.formatted).toBeDefined()
      expect(result.errors).toHaveLength(0)
    })

    it('should handle large amounts with warnings', () => {
      const largeAmount = 60000000 // 60M AED (exceeds invoice limit)
      const result = validateAndFormatUAECurrency(largeAmount, 'invoice')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Amount exceeds banking transaction limits')
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete UAE business transaction workflow', () => {
      // Generate valid TRN
      const sampleTrn = '400123456700123'
      const trnValidation = validateEnhancedUAETRN(sampleTrn)
      expect(trnValidation.isValid).toBe(true)

      // Calculate VAT for transaction
      const vatCalculation = calculateEnhancedVAT({
        amount: new Decimal(10000),
        vatCategory: 'STANDARD',
        currency: 'AED',
        businessPurpose: 'B2B',
        customerLocation: 'UAE'
      })
      expect(vatCalculation.vatAmount.toString()).toBe('500')

      // Format currency for invoice
      const currencyFormatting = formatEnhancedUAECurrency(
        vatCalculation.totalAmount,
        UAE_CURRENCY_PRESETS.INVOICE
      )
      expect(currencyFormatting.compliance.invoiceCompliant).toBe(true)

      // Check business hours
      const businessHourDate = new Date('2024-01-02T10:00:00+04:00') // Tuesday
      const businessHours = isWithinUAEBusinessHours(DEFAULT_UAE_BUSINESS_HOURS, businessHourDate)
      expect(businessHours.isWithinHours).toBe(true)
    })
  })
})