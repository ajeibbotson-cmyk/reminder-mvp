/**
 * POP Trading Company Specific PDF Extraction
 * Tailored patterns for POP's standardized invoice format
 */

const fs = require('fs')
const path = require('path')
const PDFParser = require('pdf2json')

class POPInvoiceExtractionService {
  extractFromPDF(pdfText, fileName) {
    console.log(`\n🔍 POP TRADING EXTRACTION: ${fileName}`)
    console.log('=' .repeat(70))

    const extracted = {
      customerName: this.extractCustomerName(pdfText),
      companyName: this.extractCompanyName(pdfText),
      invoiceNumber: this.extractInvoiceNumber(pdfText),
      amount: this.extractAmount(pdfText),
      dueDate: this.extractDueDate(pdfText),
      invoiceDate: this.extractInvoiceDate(pdfText),
      source: 'pdf',
      sourceFile: fileName,
      confidence: 0
    }

    // Calculate confidence score
    extracted.confidence = this.calculateConfidence(extracted)
    return extracted
  }

  extractCustomerName(text) {
    console.log('\n👤 CUSTOMER NAME EXTRACTION:')

    // POP format: Customer name appears after sender info, before invoice details
    const patterns = [
      // Direct customer name extraction (after POP company info)
      /Pop Trading Company[\s\S]*?finance@poptradingcompany\.com[\s\n]+([A-Za-z\s&.-]{2,50})[\s\n]+Invoice number/i,

      // Alternative: Name before address
      /finance@poptradingcompany\.com[\s\n]+([A-Za-z\s&.-]{2,50})[\s\n]+.*?Invoice number/i,

      // Between email and invoice number
      /poptradingcompany\.com[\s\n]+([A-Za-z][A-Za-z\s&.-]{1,49})[\s\n]+Invoice/i,

      // Working Title specific pattern
      /(Working Title)[\s\n]/i,

      // Above The Clouds specific
      /(Above The Clouds)[\s\n]/i,

      // Seven Stones specific
      /(Seven Stones)[\s\n]/i,

      // SVD specific patterns
      /(SVD .*?)[\s\n]/i,

      // ITK pattern
      /(ITK)[\s\n]/i
    ]

    for (let i = 0; i < patterns.length; i++) {
      console.log(`   Pattern ${i + 1}: Testing`)
      const match = text.match(patterns[i])
      if (match && match[1]) {
        const name = match[1].trim().replace(/\s+/g, ' ')
        if (name && !name.includes('Invoice') && !name.includes('@') && name.length >= 2) {
          console.log(`   ✅ Found: "${name}"`)
          return name
        }
      }
    }

    console.log('   ❌ No customer name found')
    return null
  }

  extractCompanyName(pdfText) {
    // For POP invoices, company name is same as customer name
    return this.extractCustomerName(pdfText)
  }

  extractInvoiceNumber(text) {
    console.log('\n📄 INVOICE NUMBER EXTRACTION:')

    // POP format: Always V followed by 8 digits
    const patterns = [
      // V + 8 digits at start of document
      /^(V\d{8})/m,

      // V number anywhere in text
      /(V\d{8})/g,

      // Invoice number field
      /Invoice number[\s:]*([V\d]{9})/i,

      // In payment reference
      /payment reference[\s:]*([V\d]{9})/i
    ]

    for (let i = 0; i < patterns.length; i++) {
      console.log(`   Pattern ${i + 1}: Testing`)
      const match = text.match(patterns[i])
      if (match && match[1]) {
        const invoiceNum = match[1].trim()
        if (invoiceNum.startsWith('V') && invoiceNum.length === 9) {
          console.log(`   ✅ Found: "${invoiceNum}"`)
          return invoiceNum
        }
      }
    }

    console.log('   ❌ No invoice number found')
    return null
  }

  extractAmount(text) {
    console.log('\n💰 AMOUNT EXTRACTION:')

    let bestMatch = null
    let highestAmount = 0

    // Pattern 1: "To pay: EUR XXX,XX" - most reliable for POP invoices
    console.log('   Pattern 1: Testing "To pay: EUR"')
    let match = text.match(/To pay:[\s]*EUR\s*([\d.,]+)/i)
    if (match && match[1]) {
      const amountStr = match[1].replace(/[,\s]/g, '')
      const amount = parseFloat(amountStr)
      if (amount > 10 && amount < 100000) {
        console.log(`   Found: €${amount}`)
        bestMatch = `€${amount.toFixed(2)}`
        highestAmount = amount
      }
    }

    // Pattern 2: "Total" followed by EUR amount
    if (!bestMatch) {
      console.log('   Pattern 2: Testing "Total EUR"')
      match = text.match(/Total[\s]*EUR\s*([\d.,]+)/i)
      if (match && match[1]) {
        const amountStr = match[1].replace(/[,\s]/g, '')
        const amount = parseFloat(amountStr)
        if (amount > 10 && amount < 100000) {
          console.log(`   Found: €${amount}`)
          bestMatch = `€${amount.toFixed(2)}`
          highestAmount = amount
        }
      }
    }

    // Pattern 3: Look for amounts in XXX,XX format (POP uses comma decimals)
    if (!bestMatch) {
      console.log('   Pattern 3: Testing amount patterns')
      const amountMatches = text.match(/(\d{1,4}[.,]\d{2})/g)
      if (amountMatches) {
        for (const amountStr of amountMatches) {
          const amount = parseFloat(amountStr.replace(',', '.'))
          if (amount > 50 && amount < 10000) { // Reasonable invoice range
            console.log(`   Found candidate: €${amount}`)
            if (amount > highestAmount) {
              highestAmount = amount
              bestMatch = `€${amount.toFixed(2)}`
            }
          }
        }
      }
    }

    if (bestMatch) {
      console.log(`   ✅ Selected: ${bestMatch}`)
      return bestMatch
    }

    console.log('   ❌ No amount found')
    return null
  }

  extractInvoiceDate(text) {
    console.log('\n📅 INVOICE DATE EXTRACTION:')

    // POP format: MM-DD-YYYY
    const patterns = [
      /Invoice date[\s:]*(\d{2}-\d{2}-\d{4})/i,
      /Date[\s:]*(\d{2}-\d{2}-\d{4})/i,
      /(\d{2}-\d{2}-\d{4})/g
    ]

    for (let i = 0; i < patterns.length; i++) {
      console.log(`   Pattern ${i + 1}: Testing`)
      const match = text.match(patterns[i])
      if (match && match[1]) {
        console.log(`   ✅ Found: ${match[1]}`)
        return match[1]
      }
    }

    console.log('   ❌ No invoice date found')
    return null
  }

  extractDueDate(text) {
    console.log('\n⏰ DUE DATE CALCULATION:')

    const invoiceDate = this.extractInvoiceDate(text)
    if (invoiceDate) {
      try {
        // POP terms: "Payment within 5 days"
        const [month, day, year] = invoiceDate.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        date.setDate(date.getDate() + 5) // Add 5 days

        const dueDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getFullYear()}`
        console.log(`   ✅ Calculated: ${dueDate} (${invoiceDate} + 5 days)`)
        return dueDate
      } catch (error) {
        console.log(`   ❌ Date calculation error: ${error.message}`)
      }
    }

    console.log('   ❌ Cannot calculate due date')
    return null
  }

  calculateConfidence(extracted) {
    let score = 0
    let maxScore = 5

    if (extracted.customerName) score += 1
    if (extracted.invoiceNumber && extracted.invoiceNumber.startsWith('V')) score += 1
    if (extracted.amount && extracted.amount.includes('€')) score += 1
    if (extracted.invoiceDate) score += 1
    if (extracted.dueDate) score += 1

    const confidence = Math.round((score / maxScore) * 100)
    console.log(`\n📊 CONFIDENCE SCORE: ${confidence}% (${score}/${maxScore})`)
    return confidence
  }
}

// Test all POP invoices
async function testPOPExtraction() {
  const testDir = path.join(__dirname, 'test-pdfs')
  const service = new POPInvoiceExtractionService()

  console.log('🧪 POP TRADING EXTRACTION TEST')
  console.log('=' .repeat(50))

  if (!fs.existsSync(testDir)) {
    console.log('❌ test-pdfs directory not found')
    return
  }

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.pdf'))
  console.log(`\nFound ${files.length} PDF files to test\n`)

  const results = []

  for (const file of files) {
    const filePath = path.join(testDir, file)

    try {
      const pdfParser = new PDFParser()

      await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', reject)
        pdfParser.on('pdfParser_dataReady', () => {
          const text = decodeURIComponent(pdfParser.getRawTextContent())
          const result = service.extractFromPDF(text, file)

          console.log('\n📋 EXTRACTION RESULTS:')
          console.log('-' .repeat(40))
          console.log(`Customer: ${result.customerName || '❌ Not found'}`)
          console.log(`Invoice #: ${result.invoiceNumber || '❌ Not found'}`)
          console.log(`Amount: ${result.amount || '❌ Not found'}`)
          console.log(`Invoice Date: ${result.invoiceDate || '❌ Not found'}`)
          console.log(`Due Date: ${result.dueDate || '❌ Not found'}`)
          console.log(`Confidence: ${result.confidence}%`)

          results.push(result)
          resolve()
        })

        pdfParser.loadPDF(filePath)
      })

    } catch (error) {
      console.log(`❌ Error processing ${file}: ${error.message}`)
    }
  }

  // Summary
  console.log('\n\n📊 SUMMARY RESULTS')
  console.log('=' .repeat(50))

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length
  const successfulExtractions = results.filter(r => r.confidence >= 80)

  console.log(`Average Confidence: ${avgConfidence.toFixed(1)}%`)
  console.log(`High Confidence (≥80%): ${successfulExtractions.length}/${results.length}`)

  console.log('\nField Success Rates:')
  const fields = ['customerName', 'invoiceNumber', 'amount', 'invoiceDate', 'dueDate']
  fields.forEach(field => {
    const success = results.filter(r => r[field]).length
    const rate = (success / results.length * 100).toFixed(1)
    const status = rate >= 80 ? '✅' : rate >= 60 ? '⚠️' : '❌'
    console.log(`   ${status} ${field}: ${success}/${results.length} (${rate}%)`)
  })

  if (avgConfidence >= 80) {
    console.log('\n🎉 EXCELLENT - Ready for production!')
  } else if (avgConfidence >= 60) {
    console.log('\n⚠️ GOOD - Minor improvements needed')
  } else {
    console.log('\n❌ NEEDS WORK - Major pattern fixes required')
  }
}

// Run the test
if (require.main === module) {
  testPOPExtraction().catch(console.error)
}

module.exports = { POPInvoiceExtractionService }