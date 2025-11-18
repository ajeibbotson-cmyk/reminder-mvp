/**
 * Test Parallel PDF Extraction
 *
 * Tests the parallel Textract implementation with real POP Trading invoices
 * Validates: 60 PDFs process in 2-3 minutes (vs 15 minutes sequential)
 */

import { extractPDFsInParallel, type ProgressUpdate } from '@/lib/services/textract-parallel'
import * as fs from 'fs'
import * as path from 'path'

async function testParallelExtraction() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🧪 PARALLEL EXTRACTION TEST')
  console.log('Testing: 60 PDFs in 2-3 minutes (vs 15 mins sequential)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Find all PDFs in test-pdfs directory
  const testPdfsDir = path.join(process.cwd(), 'test-pdfs')

  if (!fs.existsSync(testPdfsDir)) {
    console.error('❌ test-pdfs directory not found')
    process.exit(1)
  }

  const pdfFiles = fs
    .readdirSync(testPdfsDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => path.join(testPdfsDir, f))

  console.log(`📂 Found ${pdfFiles.length} PDF files\n`)

  // Take first 60 PDFs for testing (or all if less than 60)
  const testPDFs = pdfFiles.slice(0, 60)
  console.log(`🎯 Testing with ${testPDFs.length} PDFs\n`)

  // Load PDFs into memory
  console.log('📥 Loading PDFs into memory...')
  const pdfs = testPDFs.map((filePath) => ({
    fileName: path.basename(filePath),
    buffer: fs.readFileSync(filePath),
  }))
  console.log('✓ PDFs loaded\n')

  // Progress tracking
  let lastUpdate = Date.now()

  function onProgress(progress: ProgressUpdate) {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdate
    lastUpdate = now

    console.log(
      `📊 Progress: ${progress.completed}/${progress.total} (${Math.round((progress.completed / progress.total) * 100)}%) | ` +
        `Batch ${progress.currentBatch}/${progress.totalBatches} | ` +
        `✅ ${progress.successCount} | ❌ ${progress.failCount} | ` +
        `+${(timeSinceLastUpdate / 1000).toFixed(1)}s`
    )
  }

  // Run parallel extraction
  const startTime = Date.now()
  const results = await extractPDFsInParallel(pdfs, onProgress)
  const totalTime = Date.now() - startTime

  // Analyze results
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('📊 TEST RESULTS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('⏱️  Performance:')
  console.log(`   Total time: ${(totalTime / 1000).toFixed(1)}s (${(totalTime / 60000).toFixed(1)} mins)`)
  console.log(`   Avg per PDF: ${(totalTime / results.length / 1000).toFixed(1)}s`)
  console.log(
    `   Throughput: ${((results.length / (totalTime / 1000)) * 60).toFixed(1)} PDFs/minute`
  )
  console.log('')

  console.log('✅ Success Rate:')
  console.log(`   Successful: ${successful.length}`)
  console.log(`   Failed: ${failed.length}`)
  console.log(`   Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`)
  console.log('')

  if (successful.length > 0) {
    console.log('📄 Extraction Quality:')
    const withInvoiceNumber = successful.filter((r) => r.data?.invoiceNumber).length
    const withAmount = successful.filter((r) => r.data?.amount).length
    const withCustomer = successful.filter((r) => r.data?.customerName).length
    const avgConfidence =
      successful.reduce((sum, r) => sum + (r.data?.confidence || 0), 0) / successful.length

    console.log(`   Invoice numbers found: ${withInvoiceNumber}/${successful.length}`)
    console.log(`   Amounts found: ${withAmount}/${successful.length}`)
    console.log(`   Customer names found: ${withCustomer}/${successful.length}`)
    console.log(`   Avg confidence: ${avgConfidence.toFixed(1)}%`)
    console.log('')

    // Show sample extracted data
    console.log('📋 Sample Extracted Data (first 3):')
    successful.slice(0, 3).forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.fileName}`)
      console.log(`      Invoice: ${result.data?.invoiceNumber || 'N/A'}`)
      console.log(`      Customer: ${result.data?.customerName || 'N/A'}`)
      console.log(`      Amount: €${result.data?.amount?.toFixed(2) || 'N/A'}`)
      console.log(`      Confidence: ${result.data?.confidence.toFixed(1)}%`)
      console.log('')
    })
  }

  if (failed.length > 0) {
    console.log('❌ Failed Extractions:')
    failed.forEach((result) => {
      console.log(`   - ${result.fileName}: ${result.error}`)
    })
    console.log('')
  }

  // Benchmark comparison
  console.log('📈 Benchmark Comparison:')
  const sequentialEstimate = results.length * 15 // 15s per PDF sequential
  const speedup = sequentialEstimate / (totalTime / 1000)
  console.log(
    `   Sequential estimate: ${(sequentialEstimate / 60).toFixed(1)} mins (${results.length} × 15s)`
  )
  console.log(`   Parallel actual: ${(totalTime / 60000).toFixed(1)} mins`)
  console.log(`   Speedup: ${speedup.toFixed(1)}x faster`)
  console.log('')

  // Quality gate check
  const passPerformance = totalTime / 60000 <= 3 // Should complete in 3 mins for 60 PDFs
  const passSuccessRate = (successful.length / results.length) * 100 >= 95
  const passExtraction = withInvoiceNumber >= successful.length * 0.95

  console.log('✅ Quality Gates:')
  console.log(
    `   ${passPerformance ? '✅' : '❌'} Performance: ${(totalTime / 60000).toFixed(1)} mins ${passPerformance ? '<= 3 mins' : '> 3 mins (FAILED)'}`
  )
  console.log(
    `   ${passSuccessRate ? '✅' : '❌'} Success rate: ${((successful.length / results.length) * 100).toFixed(1)}% ${passSuccessRate ? '>= 95%' : '< 95% (FAILED)'}`
  )
  console.log(
    `   ${passExtraction ? '✅' : '❌'} Data extraction: ${withInvoiceNumber}/${successful.length} invoices ${passExtraction ? '>= 95%' : '< 95% (FAILED)'}`
  )
  console.log('')

  const allPassed = passPerformance && passSuccessRate && passExtraction

  console.log('═══════════════════════════════════════════════════════════════')
  if (allPassed) {
    console.log('✅ TEST PASSED: Parallel extraction ready for production')
  } else {
    console.log('❌ TEST FAILED: Optimization needed before production')
  }
  console.log('═══════════════════════════════════════════════════════════════\n')

  process.exit(allPassed ? 0 : 1)
}

testParallelExtraction().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
