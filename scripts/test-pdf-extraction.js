#!/usr/bin/env node

/**
 * Test PDF extraction on all invoices in test-pdfs directory
 */

const fs = require('fs')
const path = require('path')

async function testAllPDFs() {
  // Dynamic import for ES modules
  const { PDFInvoiceParser } = await import('../src/lib/services/pdf-invoice-parser.ts')

  const testPdfsDir = path.join(__dirname, '../test-pdfs')
  const pdfFiles = fs.readdirSync(testPdfsDir).filter(f => f.endsWith('.pdf'))

  console.log(`\n📄 Testing ${pdfFiles.length} PDF invoices...\n`)
  console.log('='.repeat(80))

  const results = []

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(testPdfsDir, pdfFile)
    const pdfBuffer = fs.readFileSync(pdfPath)

    console.log(`\n📋 ${pdfFile}`)
    console.log('-'.repeat(80))

    try {
      const result = await PDFInvoiceParser.parseInvoicePDF(pdfBuffer)

      // Display key fields
      console.log(`  Invoice Number:  ${result.invoiceNumber || '❌ MISSING'}`)
      console.log(`  Customer Name:   ${result.customerName || '❌ MISSING'}`)
      console.log(`  Customer Email:  ${result.customerEmail || '❌ MISSING'}`)
      console.log(`  Total Amount:    ${result.totalAmount ? `€${result.totalAmount.toLocaleString()}` : '❌ MISSING'}`)
      console.log(`  VAT Amount:      ${result.vatAmount !== undefined ? `€${result.vatAmount.toLocaleString()}` : '❌ MISSING'}`)
      console.log(`  Invoice Date:    ${result.invoiceDate || '❌ MISSING'}`)
      console.log(`  Due Date:        ${result.dueDate || '❌ MISSING'}`)
      console.log(`  Currency:        ${result.currency}`)
      console.log(`  Confidence:      ${result.confidence}%`)

      results.push({
        file: pdfFile,
        success: true,
        data: result
      })

    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`)
      results.push({
        file: pdfFile,
        success: false,
        error: error.message
      })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 EXTRACTION SUMMARY\n')

  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  console.log(`✅ Successful: ${successful}/${pdfFiles.length}`)
  console.log(`❌ Failed:     ${failed}/${pdfFiles.length}`)

  // Field extraction rates
  const fieldsToCheck = ['invoiceNumber', 'customerName', 'customerEmail', 'totalAmount', 'vatAmount', 'invoiceDate', 'dueDate']
  console.log('\n📈 Field Extraction Rates:')

  fieldsToCheck.forEach(field => {
    const extracted = results.filter(r => r.success && r.data[field] !== undefined).length
    const rate = ((extracted / successful) * 100).toFixed(0)
    console.log(`  ${field.padEnd(20)} ${extracted}/${successful} (${rate}%)`)
  })

  // Average confidence
  const avgConfidence = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.data.confidence, 0) / successful

  console.log(`\n🎯 Average Confidence: ${avgConfidence.toFixed(0)}%`)
  console.log('\n' + '='.repeat(80))
}

testAllPDFs().catch(console.error)
