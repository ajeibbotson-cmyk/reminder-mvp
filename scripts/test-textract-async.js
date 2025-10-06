#!/usr/bin/env node

/**
 * Test AWS Textract async extraction on all PDFs
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')

async function testAllPDFs() {
  // Dynamic import for ES modules
  const { TextractAsyncParser } = await import('../src/lib/services/textract-async-parser.ts')

  const testPdfsDir = path.join(__dirname, '../test-pdfs')
  const pdfFiles = fs.readdirSync(testPdfsDir).filter(f => f.endsWith('.pdf'))

  console.log(`\n📄 Testing ${pdfFiles.length} PDF invoices with Textract Async...\n`)
  console.log('='.repeat(80))

  const results = []

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(testPdfsDir, pdfFile)
    const pdfBuffer = fs.readFileSync(pdfPath)

    console.log(`\n📋 ${pdfFile}`)
    console.log('-'.repeat(80))
    console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`)

    try {
      const startTime = Date.now()
      const result = await TextractAsyncParser.parseInvoicePDF(pdfBuffer, pdfFile)
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)

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
      console.log(`  Processing Time: ${duration}s`)

      results.push({
        file: pdfFile,
        success: true,
        data: result,
        duration: parseFloat(duration)
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

  if (successful > 0) {
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

    // Average processing time
    const avgTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / successful

    console.log(`⏱️  Average Processing Time: ${avgTime.toFixed(1)}s`)
  }

  console.log('\n' + '='.repeat(80))

  // Failed PDFs
  if (failed > 0) {
    console.log('\n❌ Failed PDFs:\n')
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.file}`)
      console.log(`    Error: ${r.error}\n`)
    })
  }
}

testAllPDFs().catch(console.error)
