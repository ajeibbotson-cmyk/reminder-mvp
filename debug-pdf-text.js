/**
 * Debug PDF text extraction to see what we're actually working with
 */

const fs = require('fs')
const path = require('path')
const PDFParser = require('pdf2json')

async function debugPDFText() {
  const testDir = path.join(__dirname, 'test-pdfs')
  const testFile = 'Working Title AW25 Drop-1.pdf' // Let's debug the one we know

  const filePath = path.join(testDir, testFile)
  console.log(`📄 DEBUGGING: ${testFile}`)
  console.log('=' .repeat(60))

  try {
    const pdfParser = new PDFParser()

    await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', reject)
      pdfParser.on('pdfParser_dataReady', () => {
        const rawText = pdfParser.getRawTextContent()
        const decodedText = decodeURIComponent(rawText)

        console.log('🔍 RAW TEXT LENGTH:', rawText.length)
        console.log('🔍 DECODED TEXT LENGTH:', decodedText.length)

        console.log('\n📝 FIRST 500 CHARACTERS OF RAW TEXT:')
        console.log('-' .repeat(50))
        console.log(rawText.substring(0, 500))

        console.log('\n📝 FIRST 500 CHARACTERS OF DECODED TEXT:')
        console.log('-' .repeat(50))
        console.log(decodedText.substring(0, 500))

        console.log('\n🔍 LOOKING FOR KEY PATTERNS:')
        console.log('-' .repeat(50))

        // Check for V-number
        const vMatch = decodedText.match(/V\d{8}/g)
        console.log('V-numbers found:', vMatch)

        // Check for Working Title
        const nameMatch = decodedText.match(/Working Title/gi)
        console.log('Working Title matches:', nameMatch)

        // Check for amounts
        const amountMatches = decodedText.match(/\d{2,4}[.,]\d{2}/g)
        console.log('Amount patterns found:', amountMatches?.slice(0, 10))

        // Check for dates
        const dateMatches = decodedText.match(/\d{2}[-/]\d{2}[-/]\d{4}/g)
        console.log('Date patterns found:', dateMatches)

        // Check for EUR
        const eurMatches = decodedText.match(/EUR\s*\d+/gi)
        console.log('EUR patterns found:', eurMatches)

        resolve()
      })

      pdfParser.loadPDF(filePath)
    })

  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
  }
}

// Run the debug
debugPDFText().catch(console.error)