/**
 * Phase 4 Sprint 1.5: UAE Compliance Validation Integration Tests
 * 
 * Tests UAE-specific business rules and compliance requirements:
 * - TRN validation integration across all components
 * - UAE VAT calculations accuracy and consistency
 * - Arabic/English bilingual support (RTL for Arabic)
 * - AED currency formatting throughout the system
 * - Business hours validation and UAE holiday awareness
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals'
import { NextRequest } from 'next/server'
import { InvoiceStatus, PaymentMethod, UserRole, TaxCategory } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Import API handlers
import { POST as InvoicesPost } from '../../src/app/api/invoices/route'
import { POST as PaymentsPost } from '../../src/app/api/payments/route'
import { POST as SignupPost } from '../../src/app/api/auth/signup/route'

// Import UAE compliance services
import { validateUAETRN, calculateInvoiceVAT, formatUAECurrency } from '../../src/lib/vat-calculator'
import { isUAEBusinessHours, isUAEHoliday, getUAETimezone } from '../../src/lib/services/uae-business-calendar'
import { prisma } from '../../src/lib/prisma'

// Test data for UAE compliance scenarios
const validUAETRNs = [
  '100123456780003',
  '100234567890123',
  '100345678901234',
  '123456789012345'
]

const invalidUAETRNs = [
  '123456789',      // Too short
  '1234567890123456', // Too long
  'ABC123456780003', // Contains letters
  '000000000000000', // All zeros
  '999999999999999', // Invalid check digit
]

const uaeVATScenarios = [
  {
    name: 'Standard VAT 5%',
    items: [{ unitPrice: 1000, quantity: 1, vatRate: 5 }],
    expected: { subtotal: 952.38, vatAmount: 47.62, total: 1000 }
  },
  {
    name: 'Zero-rated items',
    items: [{ unitPrice: 1000, quantity: 1, vatRate: 0 }],
    expected: { subtotal: 1000, vatAmount: 0, total: 1000 }
  },
  {
    name: 'Mixed VAT rates',
    items: [
      { unitPrice: 500, quantity: 2, vatRate: 5 },   // Standard items
      { unitPrice: 300, quantity: 1, vatRate: 0 }    // Zero-rated item
    ],
    expected: { subtotal: 1300, vatAmount: 47.62, total: 1347.62 }
  },
  {
    name: 'High precision calculations',
    items: [{ unitPrice: 333.33, quantity: 3, vatRate: 5 }],
    expected: { subtotal: 952.27, vatAmount: 47.61, total: 999.88 }
  }
]

const arabicTestData = {
  companyName: 'شركة الإمارات للتجارة المحدودة',
  customerName: 'عميل اختبار عربي',
  invoiceDescription: 'خدمات استشارية متخصصة في مجال التكنولوجيا',
  itemDescription: 'خدمات تطوير البرمجيات',
  notes: 'يرجى الدفع خلال 30 يوماً من تاريخ الإصدار',
  address: 'دبي، دولة الإمارات العربية المتحدة',
  paymentTerms: 'الدفع مقدماً أو خلال 30 يوماً'
}

// Helper function to create test company with UAE compliance
function createUAECompany() {
  const timestamp = Date.now()
  return {
    id: `uae-company-${timestamp}`,
    name: 'UAE Test Company Ltd',
    nameAr: arabicTestData.companyName,
    trn: validUAETRNs[0],
    email: `company${timestamp}@uaetest.ae`,
    phone: '+971 4 123 4567',
    address: 'Dubai International Financial Centre, Dubai, UAE',
    addressAr: arabicTestData.address,
    defaultVatRate: new Decimal(5.0),
    currency: 'AED',
    timezone: 'Asia/Dubai',
    businessHours: {
      sunday: { open: '09:00', close: '18:00' },
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { closed: true },
      saturday: { closed: true }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function createAuthenticatedRequest(url: string, method: string = 'GET', body?: any) {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'en,ar',
      'X-Timezone': 'Asia/Dubai'
    },
    ...(body && { body: JSON.stringify(body) })
  })
}

describe('UAE Compliance Validation Integration Tests', () => {
  let testCompany: any
  let testUser: any

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.activities.deleteMany({ where: { companyId: { contains: 'uae-company-' } } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'uae-invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'uae-invoice-' } } })
    await prisma.invoices.deleteMany({ where: { id: { contains: 'uae-invoice-' } } })
    await prisma.customers.deleteMany({ where: { companyId: { contains: 'uae-company-' } } })
    await prisma.users.deleteMany({ where: { companyId: { contains: 'uae-company-' } } })
    await prisma.companies.deleteMany({ where: { id: { contains: 'uae-company-' } } })
  })

  beforeEach(async () => {
    testCompany = createUAECompany()
    testUser = {
      id: `uae-user-${Date.now()}`,
      email: `testuser${Date.now()}@uaetest.ae`,
      name: 'UAE Test User',
      role: UserRole.FINANCE,
      companyId: testCompany.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await prisma.companies.create({ data: testCompany })
    await prisma.users.create({ data: testUser })
  })

  afterEach(async () => {
    await prisma.activities.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.payments.deleteMany({ where: { invoiceId: { contains: 'uae-invoice-' } } })
    await prisma.invoiceItems.deleteMany({ where: { invoiceId: { contains: 'uae-invoice-' } } })
    await prisma.invoices.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.customers.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.users.deleteMany({ where: { companyId: testCompany.id } })
    await prisma.companies.deleteMany({ where: { id: testCompany.id } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('TRN Validation Integration', () => {
    it('should validate TRN format in company registration', async () => {
      for (const validTRN of validUAETRNs) {
        const signupData = {
          companyName: `Test Company ${validTRN}`,
          trn: validTRN,
          name: 'Test User',
          email: `test${validTRN}@uaetest.ae`,
          password: 'SecurePass123!'
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/auth/signup',
          'POST',
          signupData
        )

        const response = await SignupPost(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data.company.trn).toBe(validTRN)

        // Cleanup
        await prisma.users.delete({ where: { email: signupData.email } })
        await prisma.companies.delete({ where: { trn: validTRN } })
      }
    })

    it('should reject invalid TRN formats', async () => {
      for (const invalidTRN of invalidUAETRNs) {
        const signupData = {
          companyName: `Invalid Company ${invalidTRN}`,
          trn: invalidTRN,
          name: 'Test User',
          email: `invalid${Date.now()}@uaetest.ae`,
          password: 'SecurePass123!'
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/auth/signup',
          'POST',
          signupData
        )

        const response = await SignupPost(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('INVALID_TRN_FORMAT')
      }
    })

    it('should validate TRN consistency in invoice creation', async () => {
      const invoiceData = {
        companyId: testCompany.id,
        number: 'UAE-INV-001',
        customerName: arabicTestData.customerName,
        customerEmail: 'customer@uaetest.ae',
        amount: 1000,
        currency: 'AED',
        trnNumber: testCompany.trn, // Should match company TRN
        items: [{
          description: arabicTestData.itemDescription,
          quantity: 1,
          unitPrice: 952.38,
          vatRate: 5,
          taxCategory: TaxCategory.STANDARD
        }]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        invoiceData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.invoice.trnNumber).toBe(testCompany.trn)
    })

    it('should reject invoices with mismatched TRN', async () => {
      const invoiceData = {
        companyId: testCompany.id,
        number: 'UAE-INV-002',
        customerName: 'Test Customer',
        customerEmail: 'customer@uaetest.ae',
        amount: 1000,
        currency: 'AED',
        trnNumber: '999999999999999', // Invalid/mismatched TRN
        items: [{
          description: 'Test Service',
          quantity: 1,
          unitPrice: 952.38,
          vatRate: 5,
          taxCategory: TaxCategory.STANDARD
        }]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        invoiceData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('TRN_MISMATCH')
    })
  })

  describe('UAE VAT Calculations Integration', () => {
    it('should calculate VAT correctly for various scenarios', async () => {
      for (const scenario of uaeVATScenarios) {
        const invoiceData = {
          companyId: testCompany.id,
          number: `VAT-TEST-${Date.now()}`,
          customerName: arabicTestData.customerName,
          customerEmail: 'customer@uaetest.ae',
          currency: 'AED',
          trnNumber: testCompany.trn,
          items: scenario.items.map((item, index) => ({
            description: `${scenario.name} - Item ${index + 1}`,
            descriptionAr: `${scenario.name} - العنصر ${index + 1}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            taxCategory: item.vatRate === 0 ? TaxCategory.ZERO_RATED : TaxCategory.STANDARD
          }))
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices',
          'POST',
          invoiceData
        )

        const response = await InvoicesPost(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)

        // Verify VAT calculations
        const invoice = data.data.invoice
        expect(Math.abs(invoice.subtotal - scenario.expected.subtotal)).toBeLessThan(0.01)
        expect(Math.abs(invoice.vatAmount - scenario.expected.vatAmount)).toBeLessThan(0.01)
        expect(Math.abs(invoice.totalAmount - scenario.expected.total)).toBeLessThan(0.01)

        // Verify VAT breakdown is provided
        expect(data.data.vatBreakdown).toBeDefined()
        expect(data.data.vatBreakdown.totalVatAmount).toBeDefined()
        
        // Verify formatted amounts are in AED
        expect(data.data.formattedAmounts.subtotal).toContain('AED')
        expect(data.data.formattedAmounts.vatAmount).toContain('AED')
        expect(data.data.formattedAmounts.totalAmount).toContain('AED')
      }
    })

    it('should handle VAT calculations with high precision', async () => {
      // Test edge case with many decimal places
      const precisionTestData = {
        companyId: testCompany.id,
        number: 'PRECISION-TEST',
        customerName: 'Precision Test Customer',
        customerEmail: 'precision@uaetest.ae',
        currency: 'AED',
        trnNumber: testCompany.trn,
        items: [{
          description: 'High precision service',
          quantity: 7,
          unitPrice: 142.857142857, // 1000/7
          vatRate: 5,
          taxCategory: TaxCategory.STANDARD
        }]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        precisionTestData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      // Verify precision handling
      const invoice = data.data.invoice
      expect(invoice.subtotal).toBeLessThan(1000)
      expect(invoice.vatAmount).toBeLessThan(50)
      expect(invoice.totalAmount).toBeLessThan(1050)
      
      // Verify total is sum of subtotal + VAT (within rounding tolerance)
      const calculatedTotal = invoice.subtotal + invoice.vatAmount
      expect(Math.abs(invoice.totalAmount - calculatedTotal)).toBeLessThan(0.01)
    })
  })

  describe('Arabic/English Bilingual Support', () => {
    it('should handle Arabic text in all invoice fields', async () => {
      const bilingualInvoiceData = {
        companyId: testCompany.id,
        number: 'ARABIC-001',
        customerName: arabicTestData.customerName,
        customerNameAr: arabicTestData.customerName,
        customerEmail: 'arabic@uaetest.ae',
        description: 'Professional consultancy services',
        descriptionAr: arabicTestData.invoiceDescription,
        notes: 'Payment due within 30 days',
        notesAr: arabicTestData.notes,
        currency: 'AED',
        trnNumber: testCompany.trn,
        items: [{
          description: 'Software development services',
          descriptionAr: arabicTestData.itemDescription,
          quantity: 1,
          unitPrice: 952.38,
          vatRate: 5,
          taxCategory: TaxCategory.STANDARD
        }]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        bilingualInvoiceData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      const invoice = data.data.invoice
      expect(invoice.customerNameAr).toBe(arabicTestData.customerName)
      expect(invoice.descriptionAr).toBe(arabicTestData.invoiceDescription)
      expect(invoice.notesAr).toBe(arabicTestData.notes)

      // Verify Arabic content is properly stored and retrieved
      const storedInvoice = await prisma.invoices.findUnique({
        where: { id: invoice.id },
        include: { invoiceItems: true }
      })

      expect(storedInvoice).toBeTruthy()
      expect(storedInvoice!.customerNameAr).toBe(arabicTestData.customerName)
      expect(storedInvoice!.invoiceItems[0].descriptionAr).toBe(arabicTestData.itemDescription)
    })

    it('should support RTL layout indicators for Arabic content', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'GET'
      )
      
      // Add Arabic locale header
      request.headers.set('Accept-Language', 'ar')

      // This would typically be tested in E2E tests, but we can verify
      // that the API responds with appropriate RTL indicators
      const response = await InvoicesGet(request)
      expect(response.status).toBe(200)

      // Verify response includes RTL context
      const responseHeaders = response.headers
      expect(responseHeaders.get('Content-Language')).toContain('ar')
    })
  })

  describe('AED Currency Formatting', () => {
    it('should format AED currency consistently across all components', async () => {
      const amounts = [
        { input: 1000, expected: 'AED 1,000.00' },
        { input: 1234.56, expected: 'AED 1,234.56' },
        { input: 0.50, expected: 'AED 0.50' },
        { input: 1000000, expected: 'AED 1,000,000.00' },
        { input: 999.999, expected: 'AED 1,000.00' } // Rounding test
      ]

      for (const testCase of amounts) {
        const formatted = formatUAECurrency(testCase.input, 'AED')
        expect(formatted).toBe(testCase.expected)
      }
    })

    it('should handle multi-currency scenarios with proper AED formatting', async () => {
      const currencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR']
      
      for (const currency of currencies) {
        const invoiceData = {
          companyId: testCompany.id,
          number: `CURR-${currency}`,
          customerName: 'Multi-currency Customer',
          customerEmail: 'multicurrency@uaetest.ae',
          currency,
          amount: 1000,
          trnNumber: testCompany.trn,
          items: [{
            description: `Service in ${currency}`,
            quantity: 1,
            unitPrice: 952.38,
            vatRate: currency === 'AED' ? 5 : 0, // VAT only for AED
            taxCategory: currency === 'AED' ? TaxCategory.STANDARD : TaxCategory.EXEMPT
          }]
        }

        const request = createAuthenticatedRequest(
          'http://localhost:3000/api/invoices',
          'POST',
          invoiceData
        )

        const response = await InvoicesPost(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data.invoice.currency).toBe(currency)
        
        // Verify formatted amounts use correct currency
        expect(data.data.formattedAmounts.totalAmount).toContain(currency)
      }
    })
  })

  describe('UAE Business Hours and Holiday Validation', () => {
    it('should respect UAE business hours for time-sensitive operations', () => {
      // Test during UAE business hours (Sunday-Thursday, 9 AM - 6 PM)
      const dubaiBusiness = new Date('2024-02-05T10:00:00+04:00') // Monday 10 AM Dubai time
      const dubaiWeekend = new Date('2024-02-09T10:00:00+04:00')  // Friday 10 AM Dubai time
      const dubaiEvening = new Date('2024-02-05T20:00:00+04:00')  // Monday 8 PM Dubai time

      expect(isUAEBusinessHours(dubaiBusiness)).toBe(true)
      expect(isUAEBusinessHours(dubaiWeekend)).toBe(false)
      expect(isUAEBusinessHours(dubaiEvening)).toBe(false)
    })

    it('should recognize UAE national holidays', () => {
      // Test UAE National Day (December 2nd)
      const nationalDay = new Date('2024-12-02T10:00:00+04:00')
      const newYearsDay = new Date('2024-01-01T10:00:00+04:00')
      const regularDay = new Date('2024-02-05T10:00:00+04:00')

      expect(isUAEHoliday(nationalDay)).toBe(true)
      expect(isUAEHoliday(newYearsDay)).toBe(true)
      expect(isUAEHoliday(regularDay)).toBe(false)
    })

    it('should handle timezone conversions correctly', () => {
      const utcTime = new Date('2024-02-05T06:00:00Z') // 6 AM UTC = 10 AM Dubai
      const dubaiTime = getUAETimezone(utcTime)
      
      expect(dubaiTime.getHours()).toBe(10) // Should be 10 AM in Dubai
      expect(isUAEBusinessHours(dubaiTime)).toBe(true)
    })

    it('should apply business hours validation to payment processing', async () => {
      // Create an invoice first
      const invoice = await prisma.invoices.create({
        data: {
          id: 'uae-invoice-business-hours',
          companyId: testCompany.id,
          number: 'BH-001',
          customerName: 'Business Hours Customer',
          customerEmail: 'bh@uaetest.ae',
          amount: new Decimal(1000),
          subtotal: new Decimal(952.38),
          vatAmount: new Decimal(47.62),
          totalAmount: new Decimal(1000),
          currency: 'AED',
          status: InvoiceStatus.SENT,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trnNumber: testCompany.trn,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Test payment during business hours
      const paymentData = {
        invoiceId: invoice.id,
        amount: 1000,
        paymentDate: new Date().toISOString(),
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'BH-PAY-001',
        notes: 'Payment during business hours',
        respectBusinessHours: true
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/payments',
        'POST',
        paymentData
      )

      const response = await PaymentsPost(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      
      // Verify business hours context is included in response
      expect(data.data.businessRules).toBeDefined()
      expect(data.data.businessRules.businessHours).toBeDefined()
    })
  })

  describe('Comprehensive UAE Compliance Integration', () => {
    it('should validate complete UAE compliance workflow', async () => {
      // Create a fully compliant UAE invoice with all features
      const compliantInvoiceData = {
        companyId: testCompany.id,
        number: 'UAE-COMPLIANT-001',
        customerName: arabicTestData.customerName,
        customerNameAr: arabicTestData.customerName,
        customerEmail: 'compliant@uaetest.ae',
        customerPhone: '+971 50 123 4567',
        description: 'Complete UAE compliant invoice',
        descriptionAr: arabicTestData.invoiceDescription,
        notes: arabicTestData.notes,
        notesAr: arabicTestData.notes,
        currency: 'AED',
        trnNumber: testCompany.trn,
        respectBusinessHours: true,
        respectUAEHolidays: true,
        items: [
          {
            description: 'Standard VAT Service',
            descriptionAr: 'خدمة خاضعة لضريبة القيمة المضافة',
            quantity: 2,
            unitPrice: 476.19,
            vatRate: 5,
            taxCategory: TaxCategory.STANDARD
          },
          {
            description: 'Zero-rated Export Service',
            descriptionAr: 'خدمة تصدير معفاة من الضريبة',
            quantity: 1,
            unitPrice: 500,
            vatRate: 0,
            taxCategory: TaxCategory.ZERO_RATED
          }
        ]
      }

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/invoices',
        'POST',
        compliantInvoiceData
      )

      const response = await InvoicesPost(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      // Verify all UAE compliance features
      const invoice = data.data.invoice
      expect(invoice.currency).toBe('AED')
      expect(invoice.trnNumber).toBe(testCompany.trn)
      expect(invoice.customerNameAr).toBe(arabicTestData.customerName)
      
      // Verify VAT calculations
      expect(data.data.vatBreakdown).toBeDefined()
      expect(data.data.vatBreakdown.standardRate).toBeDefined()
      expect(data.data.vatBreakdown.zeroRate).toBeDefined()
      
      // Verify formatted amounts
      expect(data.data.formattedAmounts.totalAmount).toContain('AED')
      
      // Verify compliance flags
      expect(data.data.complianceFlags).toContain('TRN_VALID')
      expect(data.data.complianceFlags).toContain('VAT_CALCULATED')
      expect(data.data.complianceFlags).toContain('CURRENCY_AED')
      expect(data.data.complianceFlags).toContain('BILINGUAL_SUPPORT')
      
      // Verify business rules are respected
      expect(data.data.businessRules.uaeCompliant).toBe(true)
      expect(data.data.businessRules.businessHours).toBeDefined()
      expect(data.data.businessRules.holidayAware).toBe(true)
    })
  })
})