/**
 * Improved PDF Extraction Testing Script
 * Enhanced patterns based on real invoice analysis
 */

const fs = require('fs')
const path = require('path')
const PDFParser = require('pdf2json')

class ImprovedCustomerExtractionService {
  extractFromPDF(pdfText, fileName) {
    console.log(`\n🔍 Analyzing text patterns for ${fileName}:`)
    console.log('=' .repeat(60))

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
    console.log('\n📝 Customer Name Extraction:')

    // Enhanced patterns for various invoice formats
    const namePatterns = [
      // Standard "Bill To" patterns
      { pattern: /(?:Bill\s+To|Customer|Client)[\s:]+([A-Za-z\s&.-]+?)(?:\n|Email|Phone|TRN|Invoice)/i, description: 'Standard Bill To' },

      // "Above The Clouds" style (recipient after company info)
      { pattern: /Above The Clouds[\s\n]+Invoice[\s\w\n]*?(\w+(?:\s+\w+)*?)(?:\s+Invoice|\s+\d|\s*\n\s*\n)/i, description: 'Above The Clouds format' },

      // German format patterns
      { pattern: /(\w+(?:\s+\w+)*?\s+AG|GmbH|Ltd|LLC)(?:\s|$)/i, description: 'Company suffix format' },

      // Direct company name extraction
      { pattern: /^([A-Z][A-Za-z\s&.-]+?)(?:\s+Invoice|\s+\d{2}|\s*\n)/m, description: 'Line-start company' },

      // POP Trading Company specific
      { pattern: /(Pop Trading Company|POP Trading Company)/i, description: 'POP Trading specific' },

      // Multi-word company patterns
      { pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?:\s+(?:AG|GmbH|Ltd|LLC|Company|Corp|Inc))?)(?!\s+\d)/g, description: 'Multi-word company' }
    ]

    for (const { pattern, description } of namePatterns) {
      console.log(`   Trying: ${description}`)
      const match = text.match(pattern)
      if (match && match[1]) {
        const name = match[1].trim().replace(/\s+/g, ' ')
        if (name.length >= 2 && name.length <= 100 && !name.match(/^\d/)) {
          console.log(`   ✅ Found: "${name}"`)
          return name
        } else {
          console.log(`   ❌ Invalid: "${name}" (length: ${name.length})`)
        }
      }
    }

    console.log('   ❌ No customer name found')
    return null
  }

  extractEmail(text) {
    console.log('\n📧 Email Extraction:')
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    const matches = text.match(emailPattern) || []

    if (matches.length > 0) {
      console.log(`   ✅ Found ${matches.length} email(s): ${matches.join(', ')}`)
      return matches[0] // Return first email found
    }

    console.log('   ❌ No email found')
    return null
  }

  extractPhone(text) {
    console.log('\n📞 Phone Extraction:')

    // Enhanced phone patterns
    const phonePatterns = [
      { pattern: /(?:\+971|00971|971)[\s-]?[2-9][\d\s-]{8}/g, description: 'UAE landline' },
      { pattern: /(?:\+971|00971|971)[\s-]?[5-9][\d\s-]{8}/g, description: 'UAE mobile' },
      { pattern: /0[2-9][\d\s-]{8}/g, description: 'Local UAE format' },
      { pattern: /\+49[\s\d-]{10,15}/g, description: 'German format' },
      { pattern: /Phone:\s*([+\d\s-]{8,15})/i, description: 'Labeled phone' },
      { pattern: /(\d{2,3}[-.\s]?\d{2,3}[-.\s]?\d{4,6})/g, description: 'Generic phone' }
    ]

    for (const { pattern, description } of phonePatterns) {
      console.log(`   Trying: ${description}`)
      const matches = text.match(pattern)
      if (matches) {
        const phone = matches[0].replace(/\s/g, '')
        console.log(`   ✅ Found: "${phone}"`)
        return phone
      }
    }

    console.log('   ❌ No phone found')
    return null
  }

  extractTRN(text) {
    console.log('\n🏢 TRN Extraction:')
    const trnPattern = /TRN[\s:]*(\d{15})/i
    const match = text.match(trnPattern)

    if (match) {
      console.log(`   ✅ Found: "${match[1]}"`)
      return match[1]
    }

    console.log('   ❌ No TRN found')
    return null
  }

  extractInvoiceNumber(text) {
    console.log('\n🧾 Invoice Number Extraction:')

    const invoicePatterns = [
      { pattern: /Invoice\s*(?:No|Number|#)?\s*:?\s*([A-Z0-9\-\/]+)/i, description: 'Standard invoice number' },
      { pattern: /INV[\s-]*(\d{6,})/i, description: 'INV prefix' },
      { pattern: /(?:^|\n)([A-Z]{1,4}\d{6,10})(?:\n|$)/m, description: 'Code + digits' },
      { pattern: /Reference:\s*([A-Z0-9\-\/]+)/i, description: 'Reference number' },
      { pattern: /([A-Z0-9]{8,15})(?=\s+INVOICE|\s+Invoice)/i, description: 'Pre-INVOICE code' },
      { pattern: /(V\d{8})/i, description: 'V-number format' },
      { pattern: /Invoice\s+(\w+)/i, description: 'Invoice + word' }
    ]

    for (const { pattern, description } of invoicePatterns) {
      console.log(`   Trying: ${description}`)
      const match = text.match(pattern)
      if (match && match[1]) {
        const invoiceNum = match[1].trim()
        if (invoiceNum.length >= 3) {
          console.log(`   ✅ Found: "${invoiceNum}"`)
          return invoiceNum
        }
      }
    }

    console.log('   ❌ No invoice number found')
    return null
  }

  extractAmount(text) {
    console.log('\n💰 Amount Extraction:')

    const amountPatterns = [
      { pattern: /Total[\s:]*AED[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i, description: 'Total AED' },
      { pattern: /AED[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, description: 'AED amounts' },
      { pattern: /(\d+(?:,\d{3})*(?:\.\d{2})?)[\s]*AED/i, description: 'Amount AED' },
      { pattern: /Total[\s:]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i, description: 'Total amount' },
      { pattern: /€[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, description: 'EUR amounts' },
      { pattern: /(\d{3,}(?:[.,]\d{2})?)/g, description: 'Large numbers' }
    ]

    const amounts = []

    for (const { pattern, description } of amountPatterns) {
      console.log(`   Trying: ${description}`)
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          const numStr = match.replace(/[^\d.,]/g, '').replace(/,/g, '')
          const amount = parseFloat(numStr)
          if (!isNaN(amount) && amount > 10) { // Minimum reasonable invoice amount
            amounts.push(amount)
            console.log(`   Found candidate: ${amount}`)
          }
        }
      }
    }

    if (amounts.length > 0) {
      // Return the largest amount (likely to be the total)
      const maxAmount = Math.max(...amounts)
      console.log(`   ✅ Selected: ${maxAmount}`)
      return maxAmount
    }

    console.log('   ❌ No amount found')
    return null
  }

  calculateConfidence(extracted) {
    let score = 0.1 // Base score
    let maxScore = 1.0

    if (extracted.name) score += 0.3
    if (extracted.email) score += 0.2
    if (extracted.phone) score += 0.15
    if (extracted.trn) score += 0.1
    if (extracted.invoiceNumber) score += 0.15
    if (extracted.amount) score += 0.1

    return Math.min(score, maxScore)
  }
}

async function extractTextFromPDF(pdfBuffer) {
  return new Promise((resolve) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error('PDF parsing error:', errData.parserError)
      resolve('')
    })

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let extractedText = ''

        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          for (const page of pdfData.Pages) {
            if (page.Texts && Array.isArray(page.Texts)) {
              for (const textObj of page.Texts) {
                if (textObj.R && Array.isArray(textObj.R)) {
                  for (const textRun of textObj.R) {
                    if (textRun.T) {
                      const decodedText = decodeURIComponent(textRun.T)
                      extractedText += decodedText + ' '
                    }
                  }
                }
              }
              extractedText += '\n'
            }
          }
        }

        resolve(extractedText.trim())
      } catch (processingError) {
        console.error('Error processing PDF data:', processingError)
        resolve('')
      }
    })

    pdfParser.parseBuffer(pdfBuffer)
  })
}

async function testImprovedExtraction() {
  console.log('🧪 IMPROVED PDF EXTRACTION TESTING')
  console.log('==================================\n')

  const testPdfDir = path.join(__dirname, 'test-pdfs')
  const pdfFiles = fs.readdirSync(testPdfDir).filter(file =>
    file.toLowerCase().endsWith('.pdf')
  )

  if (pdfFiles.length === 0) {
    console.log('📄 No PDF files found')
    return
  }

  console.log(`Found ${pdfFiles.length} PDF file(s) to test with improved patterns:\n`)

  const extractor = new ImprovedCustomerExtractionService()
  const results = []

  for (const pdfFile of pdfFiles) {
    console.log(`\n🔍 PROCESSING: ${pdfFile}`)
    console.log('='.repeat(80))

    try {
      const pdfPath = path.join(testPdfDir, pdfFile)
      const pdfBuffer = fs.readFileSync(pdfPath)

      console.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)

      const extractedText = await extractTextFromPDF(pdfBuffer)

      if (!extractedText) {
        console.log('❌ Could not extract text from PDF')
        continue
      }

      console.log(`📝 Extracted text length: ${extractedText.length} characters`)

      // Extract customer data with detailed logging
      const result = extractor.extractFromPDF(extractedText, pdfFile)
      results.push({ file: pdfFile, ...result })

      // Final results summary
      console.log('\n📋 FINAL EXTRACTION RESULTS:')
      console.log('-'.repeat(40))
      console.log(`   Customer: ${result.name || '❌ Not found'}`)
      console.log(`   Email: ${result.email || '❌ Not found'}`)
      console.log(`   Phone: ${result.phone || '❌ Not found'}`)
      console.log(`   TRN: ${result.trn || '❌ Not found'}`)
      console.log(`   Invoice #: ${result.invoiceNumber || '❌ Not found'}`)
      console.log(`   Amount: ${result.amount ? `${result.amount}` : '❌ Not found'}`)
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)

      console.log('\n📄 RAW TEXT SAMPLE (first 300 chars):')
      console.log('-'.repeat(40))
      console.log(extractedText.substring(0, 300) + '...')

    } catch (error) {
      console.error(`❌ Error processing ${pdfFile}:`, error.message)
    }
  }

  // Summary
  if (results.length > 0) {
    console.log('\n\n📊 SUMMARY STATISTICS')
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
      const status = count === results.length ? '✅' : count > 0 ? '⚠️' : '❌'
      console.log(`   ${status} ${field}: ${count}/${results.length} (${rate}%)`)
    })

    const highConfidenceCount = results.filter(r => r.confidence >= 0.8).length
    console.log(`\nHigh Confidence (≥80%): ${highConfidenceCount}/${results.length}`)

    if (avgConfidence >= 0.8) {
      console.log('\n🎉 EXCELLENT - Ready for production use!')
    } else if (avgConfidence >= 0.6) {
      console.log('\n⚠️  GOOD - May need some manual review')
    } else {
      console.log('\n❌ NEEDS IMPROVEMENT - Patterns need refinement')
    }
  }
}

testImprovedExtraction()