/**
 * Tests for UAE Test Data Utilities
 */

import { describe, it, expect } from '@jest/globals'
import {
  generateTRN,
  generateUAEPhone,
  generateBusinessEmail,
  generateUAEAddress,
  generateUAECompany,
  generateUAECustomer,
  generateUAEInvoice,
  generateInvoiceBatch,
  generateCSVContent,
  UAE_BUSINESS_DATA
} from './uae-test-data'

describe('UAE Test Data Utilities', () => {
  describe('TRN Generation', () => {
    it('should generate valid UAE TRN format', () => {
      const trn = generateTRN()
      expect(trn).toMatch(/^100\d{9}$/)
      expect(trn).toHaveLength(12)
    })

    it('should generate unique TRNs', () => {
      const trns = Array.from({ length: 10 }, () => generateTRN())
      const uniqueTrns = new Set(trns)
      expect(uniqueTrns.size).toBe(10)
    })
  })

  describe('UAE Phone Generation', () => {
    it('should generate valid UAE phone format', () => {
      const phone = generateUAEPhone()
      expect(phone).toMatch(/^\+971(50|52|54|55|56|58)\d{7}$/)
    })

    it('should generate different phone numbers', () => {
      const phones = Array.from({ length: 5 }, () => generateUAEPhone())
      const uniquePhones = new Set(phones)
      expect(uniquePhones.size).toBeGreaterThan(1)
    })
  })

  describe('Business Email Generation', () => {
    it('should generate valid business email with .ae domain', () => {
      const email = generateBusinessEmail('Test Company')
      expect(email).toMatch(/^[a-z]+@testcompany\.ae$/)
    })

    it('should generate email without company name', () => {
      const email = generateBusinessEmail()
      expect(email).toMatch(/^[a-z]+@[a-z]+\.ae$/)
    })
  })

  describe('UAE Address Generation', () => {
    it('should generate complete UAE address', () => {
      const address = generateUAEAddress()
      
      expect(address).toHaveProperty('street')
      expect(address).toHaveProperty('area')
      expect(address).toHaveProperty('emirate')
      expect(address).toHaveProperty('poBox')
      expect(address).toHaveProperty('country', 'United Arab Emirates')
      
      expect(UAE_BUSINESS_DATA.emirates).toContain(address.emirate)
      expect(address.poBox).toMatch(/^P\.O\. Box \d+$/)
    })
  })

  describe('Company Generation', () => {
    it('should generate realistic UAE company', () => {
      const company = generateUAECompany()
      
      expect(company).toHaveProperty('id')
      expect(company).toHaveProperty('name')
      expect(company).toHaveProperty('trn')
      expect(company).toHaveProperty('email')
      expect(company).toHaveProperty('phone')
      expect(company).toHaveProperty('address')
      expect(company).toHaveProperty('businessType')
      expect(company).toHaveProperty('bankAccount')
      expect(company).toHaveProperty('isActive', true)
      
      expect(company.trn).toMatch(/^100\d{9}$/)
      expect(company.phone).toMatch(/^\+971/)
      expect(company.email).toMatch(/\.ae$/)
      expect(UAE_BUSINESS_DATA.businessTypes).toContain(company.businessType)
      expect(UAE_BUSINESS_DATA.bankNames).toContain(company.bankAccount.bankName)
    })
  })

  describe('Customer Generation', () => {
    it('should generate UAE customer with correct properties', () => {
      const customer = generateUAECustomer()
      
      expect(customer).toHaveProperty('id')
      expect(customer).toHaveProperty('name')
      expect(customer).toHaveProperty('email')
      expect(customer).toHaveProperty('phone')
      expect(customer).toHaveProperty('address')
      expect(customer).toHaveProperty('isIndividual')
      expect(customer).toHaveProperty('preferredLanguage')
      
      expect(['en', 'ar']).toContain(customer.preferredLanguage)
      expect(customer.phone).toMatch(/^\+971/)
      
      if (!customer.isIndividual) {
        expect(customer.trn).toBeDefined()
        expect(customer.trn).toMatch(/^100\d{9}$/)
      }
    })
  })

  describe('Invoice Generation', () => {
    it('should generate invoice with UAE-specific data', () => {
      const invoice = generateUAEInvoice()
      
      expect(invoice).toHaveProperty('id')
      expect(invoice).toHaveProperty('invoiceNumber')
      expect(invoice).toHaveProperty('amount')
      expect(invoice).toHaveProperty('vatAmount')
      expect(invoice).toHaveProperty('totalAmount')
      expect(invoice).toHaveProperty('currency', 'AED')
      expect(invoice).toHaveProperty('lineItems')
      
      expect(invoice.invoiceNumber).toMatch(/^INV-\d+$/)
      expect(invoice.vatAmount).toBe(invoice.amount * 0.05)
      expect(invoice.totalAmount).toBe(invoice.amount + invoice.vatAmount)
      expect(invoice.customerPhone).toMatch(/^\+971/)
      expect(invoice.lineItems).toHaveLength(expect.any(Number))
      expect(invoice.lineItems.length).toBeGreaterThan(0)
    })

    it('should apply overrides correctly', () => {
      const overrides = {
        amount: 1000,
        currency: 'AED',
        status: 'paid' as const
      }
      
      const invoice = generateUAEInvoice(overrides)
      
      expect(invoice.amount).toBe(1000)
      expect(invoice.currency).toBe('AED')
      expect(invoice.status).toBe('paid')
    })
  })

  describe('Batch Generation', () => {
    it('should generate specified number of invoices', () => {
      const count = 5
      const batch = generateInvoiceBatch(count)
      
      expect(batch).toHaveLength(count)
      batch.forEach(invoice => {
        expect(invoice).toHaveProperty('id')
        expect(invoice).toHaveProperty('invoiceNumber')
        expect(invoice.currency).toBe('AED')
      })
    })

    it('should apply overrides to all invoices in batch', () => {
      const overrides = { companyId: 'test-company-123' }
      const batch = generateInvoiceBatch(3, overrides)
      
      batch.forEach(invoice => {
        expect(invoice.companyId).toBe('test-company-123')
      })
    })
  })

  describe('CSV Generation', () => {
    it('should generate valid CSV content', () => {
      const invoices = generateInvoiceBatch(2)
      const csv = generateCSVContent(invoices)
      
      const lines = csv.split('\n')
      expect(lines).toHaveLength(3) // header + 2 data rows
      
      const headers = lines[0].split(',')
      expect(headers).toContain('"customerName"')
      expect(headers).toContain('"customerEmail"')
      expect(headers).toContain('"amount"')
      expect(headers).toContain('"currency"')
      
      const firstDataRow = lines[1].split(',')
      expect(firstDataRow).toHaveLength(headers.length)
    })

    it('should properly escape CSV values', () => {
      const invoice = generateUAEInvoice({
        customerName: 'Test Company, LLC',
        description: 'Service with "quotes" and commas'
      })
      
      const csv = generateCSVContent([invoice])
      const lines = csv.split('\n')
      
      expect(lines[1]).toContain('"Test Company, LLC"')
      expect(lines[1]).toContain('"Service with ""quotes"" and commas"')
    })
  })

  describe('Constants and Configuration', () => {
    it('should have valid UAE business data', () => {
      expect(UAE_BUSINESS_DATA.currencies).toContain('AED')
      expect(UAE_BUSINESS_DATA.emirates).toHaveLength(7)
      expect(UAE_BUSINESS_DATA.businessHours.timezone).toBe('Asia/Dubai')
      expect(UAE_BUSINESS_DATA.businessHours.workingDays).toContain(1) // Sunday
      expect(UAE_BUSINESS_DATA.businessHours.workingDays).not.toContain(0) // Saturday
    })

    it('should have realistic business types', () => {
      expect(UAE_BUSINESS_DATA.businessTypes).toContain('Trading Company')
      expect(UAE_BUSINESS_DATA.businessTypes).toContain('Construction Company')
      expect(UAE_BUSINESS_DATA.businessTypes.length).toBeGreaterThan(5)
    })

    it('should have UAE bank names', () => {
      expect(UAE_BUSINESS_DATA.bankNames).toContain('Emirates NBD')
      expect(UAE_BUSINESS_DATA.bankNames).toContain('First Abu Dhabi Bank')
      expect(UAE_BUSINESS_DATA.bankNames.length).toBeGreaterThan(5)
    })
  })
})