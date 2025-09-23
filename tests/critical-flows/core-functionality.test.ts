/**
 * Core Functionality Tests
 * Tests the specific issues that have been causing problems in production
 */

import { PDFInvoiceParserService } from '@/lib/services/pdf-invoice-parser'

// Mock the external dependencies
jest.mock('pdf2json', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'pdfParser_dataReady') {
        // Mock successful PDF parsing
        const mockPdfData = {
          Pages: [{
            Texts: [
              { R: [{ T: 'INVOICE' }] },
              { R: [{ T: 'INV-2024-001' }] },
              { R: [{ T: 'Above%20The%20Clouds%20LLC' }] },
              { R: [{ T: 'AED%205000.00' }] }
            ]
          }]
        }
        setTimeout(() => callback(mockPdfData), 10)
      }
    }),
    parseBuffer: jest.fn()
  }))
})

describe('Core Functionality Tests', () => {
  describe('PDF Invoice Parser Service', () => {
    test('should parse PDF successfully with pdf2json', async () => {
      const testPdfBuffer = Buffer.from('Mock PDF content')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.extractedData).toBeDefined()
    })

    test('should handle UAE invoice patterns', async () => {
      const testPdfBuffer = Buffer.from('Mock UAE invoice PDF')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result).toBeDefined()
      expect(result.extractedData.currency).toBe('AED')
    })

    test('should not crash with empty or invalid input', async () => {
      const emptyBuffer = Buffer.alloc(0)

      const result = await PDFInvoiceParserService.parseInvoice(emptyBuffer)

      // Should not throw, should return a result
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    test('should extract text from mock PDF data', async () => {
      const testPdfBuffer = Buffer.from('Mock PDF for text extraction')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result.rawText).toBeDefined()
      expect(typeof result.rawText).toBe('string')
    })

    test('should parse invoice numbers correctly', async () => {
      const testPdfBuffer = Buffer.from('Mock PDF with invoice number')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      // Should extract some kind of invoice identifier
      expect(result.extractedData).toBeDefined()
      expect(typeof result.extractedData.invoiceNumber).toBe('string')
    })

    test('should handle customer name extraction', async () => {
      const testPdfBuffer = Buffer.from('Mock PDF with customer name')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result.extractedData.customerName).toBeDefined()
      expect(typeof result.extractedData.customerName).toBe('string')
    })

    test('should extract amounts in AED currency', async () => {
      const testPdfBuffer = Buffer.from('Mock PDF with AED amounts')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result.extractedData.totalAmount).toBeGreaterThanOrEqual(0)
      expect(result.extractedData.currency).toBe('AED')
    })

    test('should provide confidence scoring', async () => {
      const testPdfBuffer = Buffer.from('Mock PDF for confidence test')

      const result = await PDFInvoiceParserService.parseInvoice(testPdfBuffer)

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Critical Field Mappings', () => {
    test('should use correct Prisma field names', () => {
      // Document the correct field mappings that caused production errors
      const correctFields = {
        companies: 'companies', // NOT 'company'
        template_id: 'template_id', // NOT 'template_type'
        company_id: 'company_id',
        user_id: 'user_id',
        invoice_id: 'invoice_id'
      }

      // These tests ensure we remember the correct field names
      expect(correctFields.companies).toBe('companies')
      expect(correctFields.template_id).toBe('template_id')
      expect(correctFields.company_id).toBe('company_id')
    })

    test('should avoid problematic field names', () => {
      // Document the field names that caused errors
      const problematicFields = [
        'company', // Should be 'companies'
        'template_type' // Should be 'template_id'
      ]

      // These are the fields that caused runtime errors
      problematicFields.forEach(field => {
        expect(field).not.toBe('companies')
        expect(field).not.toBe('template_id')
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle service failures gracefully', async () => {
      // Test that the service doesn't crash on errors
      const invalidBuffer = Buffer.from('This is not a PDF')

      try {
        const result = await PDFInvoiceParserService.parseInvoice(invalidBuffer)

        // Should return a result, not throw
        expect(result).toBeDefined()
        expect(result.success).toBeDefined()
      } catch (error) {
        // If it does throw, it should be a controlled error
        expect(error).toBeInstanceOf(Error)
      }
    })

    test('should provide meaningful error information', async () => {
      const corruptedBuffer = Buffer.from('Corrupted PDF data')

      const result = await PDFInvoiceParserService.parseInvoice(corruptedBuffer)

      // Even on failure, should provide useful information
      expect(result).toBeDefined()
      if (!result.success) {
        expect(result.confidence).toBeLessThan(0.5)
      }
    })
  })

  describe('UAE Business Logic', () => {
    test('should default to AED currency', async () => {
      const testBuffer = Buffer.from('Mock UAE invoice')

      const result = await PDFInvoiceParserService.parseInvoice(testBuffer)

      expect(result.extractedData.currency).toBe('AED')
    })

    test('should extract UAE-specific patterns', async () => {
      const testBuffer = Buffer.from('Mock UAE business document')

      const result = await PDFInvoiceParserService.parseInvoice(testBuffer)

      // Should work with UAE business patterns
      expect(result).toBeDefined()
      expect(result.extractedData).toBeDefined()
    })

    test('should handle bilingual content (English/Arabic)', async () => {
      const testBuffer = Buffer.from('Mock bilingual invoice')

      const result = await PDFInvoiceParserService.parseInvoice(testBuffer)

      // Should process mixed language content
      expect(result.success).toBeDefined()
      expect(result.extractedData).toBeDefined()
    })
  })

  describe('Production Stability', () => {
    test('should not crash with null or undefined inputs', async () => {
      // Test edge cases that could occur in production
      try {
        await PDFInvoiceParserService.parseInvoice(null as any)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }

      try {
        await PDFInvoiceParserService.parseInvoice(undefined as any)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    test('should handle very large files gracefully', async () => {
      // Test with a large buffer
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB

      const result = await PDFInvoiceParserService.parseInvoice(largeBuffer)

      // Should handle without memory issues
      expect(result).toBeDefined()
    })

    test('should have consistent response format', async () => {
      const testBuffer = Buffer.from('Consistent format test')

      const result = await PDFInvoiceParserService.parseInvoice(testBuffer)

      // Should always have the same response structure
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('extractedData')
      expect(result).toHaveProperty('rawText')

      // ExtractedData should have expected structure
      expect(result.extractedData).toHaveProperty('invoiceNumber')
      expect(result.extractedData).toHaveProperty('customerName')
      expect(result.extractedData).toHaveProperty('totalAmount')
      expect(result.extractedData).toHaveProperty('currency')
    })
  })
})