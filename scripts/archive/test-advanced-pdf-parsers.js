/**
 * Test Advanced PDF Parsing Libraries
 * Compare different PDF parsers for better extraction accuracy
 */

const fs = require('fs')
const path = require('path')

// Test different PDF parsing approaches
async function testAdvancedParsers() {
  console.log('🧪 Testing Advanced PDF Parsers')
  console.log('=' .repeat(50))

  const testPdfPath = path.join(__dirname, '../test-pdfs/Above The Clouds AW25 Drop-1.pdf')

  if (!fs.existsSync(testPdfPath)) {
    console.log('❌ Test PDF not found at:', testPdfPath)
    console.log('Please add the Above The Clouds PDF to test-pdfs/ directory')
    return
  }

  // Option 1: PDF-Parse (better structure preservation)
  await testPDFParse(testPdfPath)

  // Option 2: PDF2PIC + OCR (for image-like PDFs)
  await testOCRApproach(testPdfPath)

  // Option 3: Structured PDF extraction
  await testStructuredExtraction(testPdfPath)
}

async function testPDFParse(pdfPath) {
  console.log('\n📄 Testing pdf-parse library...')

  try {
    // Would need: npm install pdf-parse
    const pdfParse = require('pdf-parse')

    const pdfBuffer = fs.readFileSync(pdfPath)
    const data = await pdfParse(pdfBuffer)

    console.log(`✅ PDF-Parse Results:`)
    console.log(`   Text length: ${data.text.length} characters`)
    console.log(`   Pages: ${data.numpages}`)

    // Look for your specific patterns
    const patterns = {
      totalAmount: /total.*?([0-9,]+\.?[0-9]*)/gi,
      outstandingAmount: /outstanding.*?([0-9,]+\.?[0-9]*)/gi,
      paidAmount: /paid.*?([0-9,]+\.?[0-9]*)/gi,
      invoiceDate: /(0[1-9]|1[0-2])[\/\-](0[1-9]|[12][0-9]|3[01])[\/\-](20\d{2})/g,
      paymentTerms: /(within\s+\d+\s+days?|net\s+\d+|due\s+in\s+\d+)/gi,
      vatAmount: /vat.*?([0-9,]+\.?[0-9]*)/gi
    }

    console.log('\n🔍 Pattern Matches:')
    Object.entries(patterns).forEach(([name, pattern]) => {
      const matches = data.text.match(pattern)
      console.log(`   ${name}: ${matches ? matches.slice(0, 3).join(', ') : 'Not found'}`)
    })

    // Show text sample for manual inspection
    console.log('\n📝 Text Sample (first 500 chars):')
    console.log(data.text.substring(0, 500))

  } catch (error) {
    console.log('❌ pdf-parse not available:', error.message)
    console.log('   Install with: npm install pdf-parse')
  }
}

async function testOCRApproach(pdfPath) {
  console.log('\n🔍 OCR Approach Analysis...')

  console.log('📋 OCR would be useful if:')
  console.log('   - PDF contains scanned images')
  console.log('   - Text is in images/graphics')
  console.log('   - Complex layouts with tables')

  console.log('\n🛠️ OCR Libraries to consider:')
  console.log('   - Tesseract.js (client-side)')
  console.log('   - Google Vision API (cloud)')
  console.log('   - AWS Textract (cloud, table-aware)')
  console.log('   - Azure Form Recognizer (cloud)')
}

async function testStructuredExtraction(pdfPath) {
  console.log('\n📊 Structured Extraction Analysis...')

  const recommendations = [
    {
      library: 'pdf2json (current)',
      pros: ['Free', 'Fast', 'Node.js native'],
      cons: ['Poor complex layout handling', 'Misses table structure', 'Low accuracy'],
      score: '6/10'
    },
    {
      library: 'pdf-parse',
      pros: ['Better text extraction', 'Preserves spacing', 'Simple API'],
      cons: ['Still no table awareness', 'No positioning data'],
      score: '7/10'
    },
    {
      library: 'AWS Textract',
      pros: ['Table detection', 'Key-value pairs', 'High accuracy', 'Form understanding'],
      cons: ['Costs money', 'Cloud dependency', 'Latency'],
      score: '9/10'
    },
    {
      library: 'Google Document AI',
      pros: ['Invoice-specific models', 'Very high accuracy', 'Structured output'],
      cons: ['Expensive', 'Complexity', 'Vendor lock-in'],
      score: '9/10'
    },
    {
      library: 'Open Source: Tabula',
      pros: ['Table extraction', 'Free', 'Java-based'],
      cons: ['Java dependency', 'Complex setup'],
      score: '8/10'
    }
  ]

  console.log('\n📊 Library Comparison:')
  recommendations.forEach(lib => {
    console.log(`\n   ${lib.library} (${lib.score})`)
    console.log(`     ✅ Pros: ${lib.pros.join(', ')}`)
    console.log(`     ❌ Cons: ${lib.cons.join(', ')}`)
  })
}

// Specific patterns for Above The Clouds invoice
function analyzeAboveTheCloudsPatterns() {
  console.log('\n🎯 Above The Clouds Specific Patterns:')
  console.log('Based on your feedback, we need to extract:')

  const targetFields = {
    totalAmount: {
      expected: '7978',
      currentExtraction: '866078952',
      issue: 'Picking wrong number from text',
      solution: 'Better number filtering + context awareness'
    },
    outstandingAmount: {
      expected: '5368.60',
      currentExtraction: null,
      issue: 'Not looking for "outstanding" pattern',
      solution: 'Add outstanding balance patterns'
    },
    paidAmount: {
      expected: '2609.40',
      currentExtraction: null,
      issue: 'Not looking for "paid" pattern',
      solution: 'Add payment tracking patterns'
    },
    invoiceDate: {
      expected: '07/15/2025',
      currentExtraction: null,
      issue: 'Date patterns not comprehensive enough',
      solution: 'Add MM/DD/YYYY pattern variations'
    },
    paymentTerms: {
      expected: 'within 30 days',
      currentExtraction: null,
      issue: 'Missing "within X days" pattern',
      solution: 'Add payment terms pattern variations'
    }
  }

  Object.entries(targetFields).forEach(([field, info]) => {
    console.log(`\n   ${field}:`)
    console.log(`     Expected: "${info.expected}"`)
    console.log(`     Current: ${info.currentExtraction || 'null'}`)
    console.log(`     Issue: ${info.issue}`)
    console.log(`     Solution: ${info.solution}`)
  })
}

// Run the analysis
testAdvancedParsers()
analyzeAboveTheCloudsPatterns()

module.exports = { testAdvancedParsers }