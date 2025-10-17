/**
 * Import Real Invoices to Dashboard
 *
 * Imports 133 POP Trading invoices to your actual user account
 * for real-world UX testing
 */

import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'
import { TextractAsyncParser } from '@/lib/services/textract-async-parser'

async function importToRealDashboard() {
  console.log('📦 Importing 133 invoices to real dashboard...\n')

  // Get the first user account
  const user = await prisma.users.findFirst({
    include: {
      companies: true
    }
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
  const pdfFiles = fs.readdirSync(testPdfsDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(testPdfsDir, f))

  console.log(`Found ${pdfFiles.length} PDF files\n`)

  let imported = 0
  let failed = 0

  // Process in batches
  const batchSize = 10
  for (let i = 0; i < pdfFiles.length; i += batchSize) {
    const batch = pdfFiles.slice(i, i + batchSize)
    console.log(`\n📋 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pdfFiles.length / batchSize)}`)

    for (const pdfPath of batch) {
      const fileName = path.basename(pdfPath)

      try {
        console.log(`   Processing: ${fileName}`)

        const pdfBuffer = fs.readFileSync(pdfPath)
        const extracted = await TextractAsyncParser.parseInvoicePDF(pdfBuffer, fileName)

        if (!extracted.invoiceNumber || !extracted.amount) {
          console.log(`   ⚠️  Skipping ${fileName} - missing required fields`)
          failed++
          continue
        }

        // Check if invoice already exists
        const existing = await prisma.invoices.findFirst({
          where: {
            number: extracted.invoiceNumber,
            company_id: user.company_id
          }
        })

        if (existing) {
          console.log(`   ⏭️  ${fileName}: Already exists (${extracted.invoiceNumber})`)
          continue
        }

        // Parse dates
        const parseDate = (dateStr?: string): Date => {
          if (!dateStr) return new Date()
          const parts = dateStr.split(/[-\/]/).map(Number)
          if (parts.length === 3) {
            const [month, day, year] = parts
            return new Date(year, month - 1, day)
          }
          return new Date(dateStr)
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
              company_id: user.company_id
            }
          },
          update: {},
          create: {
            id: `customer_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            company_id: user.company_id,
            name: extracted.customerName || 'Unknown Customer',
            email: customerEmail,
            payment_terms: 30,
            created_at: new Date(),
            updated_at: new Date()
          }
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
            description: `Imported from ${fileName}`,
            created_at: parseDate(extracted.invoiceDate),
            updated_at: new Date()
          }
        })

        imported++
        console.log(`   ✅ ${fileName}: ${extracted.invoiceNumber} - €${extracted.totalAmount || extracted.amount}`)

      } catch (error) {
        failed++
        console.log(`   ❌ ${fileName}: ${error instanceof Error ? error.message : 'Failed'}`)
      }
    }

    // Pause between batches
    if (i + batchSize < pdfFiles.length) {
      console.log('   ⏸️  Pausing 5s...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('📊 Import Summary')
  console.log('═'.repeat(60))
  console.log(`✅ Imported: ${imported}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📋 Total: ${pdfFiles.length}`)
  console.log('')
  console.log('🎉 Invoices are now in your dashboard!')
  console.log(`🌐 View at: http://localhost:3000/en/dashboard/invoices`)
  console.log('')
}

importToRealDashboard().catch(error => {
  console.error('❌ Import failed:', error)
  process.exit(1)
})
