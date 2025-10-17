/**
 * Import Real Invoices to Dashboard - PARALLEL VERSION
 *
 * Imports 133 POP Trading invoices with parallel Textract processing
 * Expected time: 2-3 minutes (vs 30+ minutes sequential)
 */

import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'
import { extractPDFsInParallel, type ProgressUpdate } from '@/lib/services/textract-parallel'

async function importToRealDashboard() {
  const startTime = Date.now()

  console.log('📦 Importing 133 invoices with PARALLEL processing...\n')

  // Get the first user account
  const user = await prisma.users.findFirst({
    include: {
      companies: true,
    },
  })

  if (!user) {
    console.log('❌ User not found. Please create an account first.')
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.email}`)
  console.log(`✅ Company: ${user.companies.name}`)
  console.log(`✅ Company ID: ${user.company_id}\n`)

  // Find all PDFs
  const testPdfsDir = path.join(process.cwd(), 'test-pdfs')
  const pdfFiles = fs
    .readdirSync(testPdfsDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => path.join(testPdfsDir, f))

  console.log(`Found ${pdfFiles.length} PDF files\n`)

  // Load PDFs into memory
  console.log('📥 Loading PDFs...')
  const pdfs = pdfFiles.map((filePath) => ({
    fileName: path.basename(filePath),
    buffer: fs.readFileSync(filePath),
  }))
  console.log('✓ PDFs loaded\n')

  // Extract all PDFs in parallel
  console.log('🚀 Starting parallel extraction...\n')

  let lastProgressTime = Date.now()
  const results = await extractPDFsInParallel(pdfs, (progress: ProgressUpdate) => {
    const now = Date.now()
    const elapsed = (now - startTime) / 1000

    console.log(
      `📊 Progress: ${progress.completed}/${progress.total} ` +
        `(${Math.round((progress.completed / progress.total) * 100)}%) | ` +
        `Batch ${progress.currentBatch}/${progress.totalBatches} | ` +
        `✅ ${progress.successCount} | ❌ ${progress.failCount} | ` +
        `Elapsed: ${elapsed.toFixed(0)}s`
    )

    lastProgressTime = now
  })

  const extractionTime = Date.now() - startTime
  console.log(`\n✅ Extraction complete (${(extractionTime / 1000).toFixed(1)}s)\n`)

  // Import to database
  console.log('💾 Importing to database (batched)...\n')

  let imported = 0
  let failed = 0
  let skipped = 0

  const parseDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date()
    const parts = dateStr.split(/[-\/]/).map(Number)
    if (parts.length === 3) {
      const [month, day, year] = parts
      return new Date(year, month - 1, day)
    }
    return new Date(dateStr)
  }

  // Process database imports in batches for speed
  const DB_BATCH_SIZE = 10
  const successResults = results.filter((r) => r.success && r.data?.invoiceNumber && r.data?.amount)

  for (let i = 0; i < successResults.length; i += DB_BATCH_SIZE) {
    const batch = successResults.slice(i, i + DB_BATCH_SIZE)

    await Promise.all(
      batch.map(async (result) => {
        const extracted = result.data!

        try {
          // Check if invoice already exists
          const existing = await prisma.invoices.findFirst({
            where: {
              number: extracted.invoiceNumber,
              company_id: user.company_id,
            },
          })

          if (existing) {
            console.log(`   ⏭️  ${result.fileName}: Already exists (${extracted.invoiceNumber})`)
            skipped++
            return
          }

          // Determine status
          const dueDate = parseDate(extracted.dueDate)
          const today = new Date()
          const status: 'SENT' | 'OVERDUE' = dueDate < today ? 'OVERDUE' : 'SENT'

          // Create or get customer
          const customerEmail = `${extracted.customerName?.toLowerCase().replace(/[^a-z0-9]/g, '')}@customer.com`

          const customer = await prisma.customers.upsert({
            where: {
              email_company_id: {
                email: customerEmail,
                company_id: user.company_id,
              },
            },
            update: {},
            create: {
              id: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              company_id: user.company_id,
              name: extracted.customerName || 'Unknown Customer',
              email: customerEmail,
              payment_terms: 30,
              created_at: new Date(),
              updated_at: new Date(),
            },
          })

          // Create invoice
          await prisma.invoices.create({
            data: {
              id: `invoice_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              company_id: user.company_id,
              number: extracted.invoiceNumber,
              customer_name: extracted.customerName || 'Unknown Customer',
              customer_email: customer.email,
              amount: extracted.totalAmount || extracted.amount || 0,
              currency: extracted.currency || 'EUR',
              due_date: dueDate,
              status: status,
              description: `Imported from ${result.fileName}`,
              created_at: parseDate(extracted.invoiceDate),
              updated_at: new Date(),
            },
          })

          imported++
          console.log(
            `   ✅ ${result.fileName}: ${extracted.invoiceNumber} - €${extracted.totalAmount || extracted.amount}`
          )
        } catch (error) {
          failed++
          console.log(`   ❌ ${result.fileName}: ${error instanceof Error ? error.message : 'Failed'}`)
        }
      })
    )
  }

  // Handle failed extractions
  const failedExtractions = results.filter((r) => !r.success)
  failed += failedExtractions.length
  failedExtractions.forEach((result) => {
    console.log(`   ❌ ${result.fileName}: ${result.error}`)
  })

  // Handle missing required fields
  const missingFields = results.filter(
    (r) => r.success && (!r.data?.invoiceNumber || !r.data?.amount)
  )
  failed += missingFields.length
  missingFields.forEach((result) => {
    console.log(`   ⚠️  ${result.fileName}: Missing required fields`)
  })

  const totalTime = Date.now() - startTime

  console.log('\n' + '═'.repeat(60))
  console.log('📊 Import Summary')
  console.log('═'.repeat(60))
  console.log(`✅ Imported: ${imported}`)
  console.log(`⏭️  Skipped (already exists): ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📋 Total: ${pdfFiles.length}`)
  console.log('')
  console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(1)}s (${(totalTime / 60000).toFixed(1)} mins)`)
  console.log(
    `   Extraction: ${(extractionTime / 1000).toFixed(1)}s | Database: ${((totalTime - extractionTime) / 1000).toFixed(1)}s`
  )
  console.log('')
  console.log('🎉 Invoices are now in your dashboard!')
  console.log(`🌐 View at: http://localhost:3000/en/dashboard/invoices`)
  console.log('')
}

importToRealDashboard().catch((error) => {
  console.error('❌ Import failed:', error)
  process.exit(1)
})
