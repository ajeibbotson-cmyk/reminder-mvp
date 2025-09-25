/**
 * PDF Extraction Testing Script
 * Tests the accuracy of PDF text extraction and customer data parsing
 */

const fs = require('fs')
const path = require('path')
const PDFParser = require('pdf2json')

// Import our customer extraction service (we'll simulate the implementation)
class TestCustomerExtractionService {
  /**
   * Extract customer data from PDF text (simplified version for testing)
   */
  extractFromPDF(pdfText, fileName) {
    const extracted = {
      name: this.extractName(pdfText),
      email: this.extractEmail(pdfText),
      phone: this.extractPhone(pdfText),
      trn: this.extractTRN(pdfText),
      invoiceNumber: this.extractInvoiceNumber(pdfText),
      amount: this.extractAmount(pdfText),
      source: 'pdf',
      sourceFile: fileName,
      confidence: 0,
      rawData: { originalText: pdfText }
    }

    // Calculate confidence score
    extracted.confidence = this.calculateConfidence(extracted)

    return extracted
  }

  extractName(text) {
    // UAE invoice patterns for customer names
    const namePatterns = [
      /(?:Bill\s+To|Customer|Client)[\s:]+([A-Za-z\s&.-]+?)(?:\n|$)/i,
      /(?:To|For):\s*([A-Za-z\s&.-]+?)(?:\n|Email|Phone|TRN)/i,
      /Invoice\s+To:\s*([A-Za-z\s&.-]+?)(?:\n|$)/i,
      /Billing\s+Address:\s*([A-Za-z\s&.-]+?)(?:\n|$)/i
    ]

    for (const pattern of namePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const name = match[1].trim().replace(/\s+/g, ' ')
        if (name.length >= 2 && name.length <= 100) {
          return name
        }
      }
    }
    return null
  }

  extractEmail(text) {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    const matches = text.match(emailPattern)
    return matches ? matches[0] : null
  }

  extractPhone(text) {
    // UAE phone number patterns
    const phonePatterns = [
      /(?:\+971|00971|971)[\s-]?[2-9][\d\s-]{8}/g,
      /(?:\+971|00971|971)[\s-]?[5-9][\d\s-]{8}/g, // Mobile
      /0[2-9][\d\s-]{8}/g // Local format
    ]

    for (const pattern of phonePatterns) {
      const matches = text.match(pattern)
      if (matches) {
        return matches[0].replace(/\s/g, '')
      }
    }
    return null
  }

  extractTRN(text) {
    const trnPattern = /TRN[\s:]*(\d{15})/i
    const match = text.match(trnPattern)
    return match ? match[1] : null
  }

  extractInvoiceNumber(text) {
    const invoicePatterns = [
      /Invoice\s*(?:No|Number|#)?\s*:?\s*([A-Z0-9\-\/]+)/i,
      /INV[\s-]*(\d{6,})/i,
      /(?:^|\n)([A-Z]{2,4}\d{6,10})(?:\n|$)/m,
      /Reference:\s*([A-Z0-9\-\/]+)/i
    ]

    for (const pattern of invoicePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    return null
  }

  extractAmount(text) {
    const amountPatterns = [
      /Total[\s:]*AED[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /AED[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)[\s]*AED/i,
      /Total[\s:]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
    ]

    for (const pattern of amountPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        const amount = parseFloat(matches[1].replace(/,/g, ''))
        if (!isNaN(amount) && amount > 0) {
          return amount
        }
      }
    }
    return null
  }

  calculateConfidence(extracted) {
    let score = 0.2 // Base score

    if (extracted.name) score += 0.3
    if (extracted.email) score += 0.2
    if (extracted.phone) score += 0.15
    if (extracted.trn) score += 0.1
    if (extracted.invoiceNumber) score += 0.15
    if (extracted.amount) score += 0.1

    return Math.min(score, 1.0)
  }
}

/**
 * Extract text from PDF using pdf2json
 */
async function extractTextFromPDF(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error('PDF parsing error:', errData.parserError)
      resolve('') // Return empty string on error
    })

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let extractedText = ''

        // Extract text from all pages
        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          for (const page of pdfData.Pages) {
            if (page.Texts && Array.isArray(page.Texts)) {
              for (const textObj of page.Texts) {
                if (textObj.R && Array.isArray(textObj.R)) {
                  for (const textRun of textObj.R) {
                    if (textRun.T) {
                      // Decode URI component and add to text
                      const decodedText = decodeURIComponent(textRun.T)
                      extractedText += decodedText + ' '
                    }
                  }
                }
              }
              extractedText += '\n' // Add newline after each page
            }
          }
        }

        resolve(extractedText.trim())
      } catch (processingError) {
        console.error('Error processing PDF data:', processingError)
        resolve('') // Return empty string on processing error
      }
    })

    // Parse the PDF buffer
    pdfParser.parseBuffer(pdfBuffer)
  })
}

/**
 * Test extraction with sample text
 */
function testWithSampleText() {
  console.log('🧪 Testing with Sample Invoice Text...\n')

  const sampleInvoiceText = `
    INVOICE

    From: ABC Trading Company
    TRN: 123456789012345

    Bill To: POP Trading Company
    Email: finance@poptrading.com
    Phone: +971 50 123 4567
    Dubai, UAE

    Invoice Number: INV-2024-001
    Date: 2024-09-24

    Description: Clothing merchandise
    Amount: AED 15,000.00
    VAT: AED 750.00
    Total: AED 15,750.00

    Payment due within 30 days.
  `

  const extractor = new TestCustomerExtractionService()
  const result = extractor.extractFromPDF(sampleInvoiceText, 'sample-invoice.pdf')

  console.log('📋 Extraction Results:')
  console.log('='.repeat(50))
  console.log(`Customer Name: ${result.name || '❌ Not found'}`)
  console.log(`Email: ${result.email || '❌ Not found'}`)
  console.log(`Phone: ${result.phone || '❌ Not found'}`)
  console.log(`TRN: ${result.trn || '❌ Not found'}`)
  console.log(`Invoice Number: ${result.invoiceNumber || '❌ Not found'}`)
  console.log(`Amount: ${result.amount ? `AED ${result.amount}` : '❌ Not found'}`)
  console.log(`Confidence Score: ${(result.confidence * 100).toFixed(1)}%`)
  console.log('='.repeat(50))

  // Evaluate extraction quality
  const expectedFields = ['name', 'email', 'phone', 'trn', 'invoiceNumber', 'amount']
  const extractedFields = expectedFields.filter(field => result[field] !== null && result[field] !== undefined)

  console.log(`\n✅ Successfully extracted: ${extractedFields.length}/${expectedFields.length} fields`)
  console.log(`📊 Success Rate: ${((extractedFields.length / expectedFields.length) * 100).toFixed(1)}%`)

  if (result.confidence >= 0.8) {
    console.log('🎉 HIGH CONFIDENCE - Ready for production')
  } else if (result.confidence >= 0.6) {
    console.log('⚠️  MEDIUM CONFIDENCE - May need review')
  } else {
    console.log('❌ LOW CONFIDENCE - Needs improvement')
  }

  return result
}

/**
 * Test extraction with actual PDF files (if available)
 */
async function testWithPDFFiles() {
  console.log('\n🗂️  Testing with PDF Files...\n')

  const testPdfDir = path.join(__dirname, 'test-pdfs')

  // Check if test PDF directory exists
  if (!fs.existsSync(testPdfDir)) {
    console.log('📁 No test-pdfs directory found. Creating sample directory structure...')
    console.log(`   Create: ${testPdfDir}`)
    console.log('   Add your PDF invoices to this directory for testing')

    try {
      fs.mkdirSync(testPdfDir, { recursive: true })
      console.log('✅ Created test-pdfs directory')
      console.log('\n💡 To test with real PDFs:')
      console.log('   1. Copy invoice PDF files to test-pdfs/')
      console.log('   2. Run this script again')
    } catch (error) {
      console.error('❌ Could not create test-pdfs directory:', error.message)
    }
    return
  }

  const pdfFiles = fs.readdirSync(testPdfDir).filter(file =>
    file.toLowerCase().endsWith('.pdf')
  )

  if (pdfFiles.length === 0) {
    console.log('📄 No PDF files found in test-pdfs directory')
    console.log('   Add some invoice PDFs to test extraction accuracy')
    return
  }

  console.log(`Found ${pdfFiles.length} PDF file(s) to test:\n`)

  const extractor = new TestCustomerExtractionService()
  const results = []

  for (const pdfFile of pdfFiles) {
    console.log(`🔍 Processing: ${pdfFile}`)
    console.log('-'.repeat(40))

    try {
      const pdfPath = path.join(testPdfDir, pdfFile)
      const pdfBuffer = fs.readFileSync(pdfPath)

      console.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)

      // Extract text from PDF
      const extractedText = await extractTextFromPDF(pdfBuffer)

      if (!extractedText) {
        console.log('❌ Could not extract text from PDF')
        continue
      }

      console.log(`📝 Extracted text length: ${extractedText.length} characters`)

      // Extract customer data
      const result = extractor.extractFromPDF(extractedText, pdfFile)
      results.push({ file: pdfFile, ...result })

      // Display results
      console.log('\n📋 Extracted Data:')
      console.log(`   Customer: ${result.name || '❌ Not found'}`)
      console.log(`   Email: ${result.email || '❌ Not found'}`)
      console.log(`   Phone: ${result.phone || '❌ Not found'}`)
      console.log(`   TRN: ${result.trn || '❌ Not found'}`)
      console.log(`   Invoice #: ${result.invoiceNumber || '❌ Not found'}`)
      console.log(`   Amount: ${result.amount ? `AED ${result.amount}` : '❌ Not found'}`)
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)

      // Show preview of extracted text
      console.log('\n📄 Text Preview (first 200 chars):')
      console.log(extractedText.substring(0, 200) + '...')
      console.log('')

    } catch (error) {
      console.error(`❌ Error processing ${pdfFile}:`, error.message)
    }
  }

  // Summary statistics
  if (results.length > 0) {
    console.log('\n📊 SUMMARY STATISTICS')
    console.log('='.repeat(50))

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`)

    const fieldsCount = {
      name: results.filter(r => r.name).length,
      email: results.filter(r => r.email).length,
      phone: results.filter(r => r.phone).length,
      trn: results.filter(r => r.trn).length,
      invoiceNumber: results.filter(r => r.invoiceNumber).length,
      amount: results.filter(r => r.amount).length
    }

    console.log('\nField Extraction Success Rates:')
    Object.entries(fieldsCount).forEach(([field, count]) => {
      const rate = (count / results.length * 100).toFixed(1)
      console.log(`   ${field}: ${count}/${results.length} (${rate}%)`)
    })

    const highConfidenceCount = results.filter(r => r.confidence >= 0.8).length
    console.log(`\nHigh Confidence (≥80%): ${highConfidenceCount}/${results.length}`)
  }
}

/**
 * Main test runner
 */
async function runExtractionTests() {
  console.log('🧪 PDF EXTRACTION ACCURACY TESTING')
  console.log('=====================================\n')

  try {
    // Test 1: Sample text
    testWithSampleText()

    // Test 2: Real PDF files (if available)
    await testWithPDFFiles()

    console.log('\n✅ Testing Complete!')
    console.log('\n💡 Tips for improving extraction accuracy:')
    console.log('   - Use high-quality, searchable PDFs (not scanned images)')
    console.log('   - Ensure consistent invoice formatting')
    console.log('   - Include clear field labels (Invoice Number:, Total:, etc.)')
    console.log('   - Test with your actual invoice templates')

  } catch (error) {
    console.error('❌ Test execution failed:', error)
  }
}

// Run the tests
runExtractionTests()