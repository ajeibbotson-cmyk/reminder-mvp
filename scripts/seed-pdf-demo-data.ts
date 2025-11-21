/**
 * Demo script to show what PDF reconciliation data looks like in the database
 * Run this to populate your database with sample data that mimics PDF extraction results
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedPDFDemoData() {
  console.log('🌱 Seeding PDF demo data...')

  try {
    // Get the first company (assuming you have test companies)
    const company = await prisma.company.findFirst()
    if (!company) {
      console.error('❌ No company found. Please create a company first.')
      return
    }

    console.log(`📊 Using company: ${company.name} (${company.id})`)

    // Get the first user
    const user = await prisma.user.findFirst({
      where: { companyId: company.id }
    })
    if (!user) {
      console.error('❌ No user found for this company.')
      return
    }

    // 1. Create import batch (simulating PDF processing)
    console.log('📁 Creating PDF import batch...')
    const importBatch = await prisma.importBatch.create({
      data: {
        id: 'pdf_demo_' + Date.now(),
        companyId: company.id,
        userId: user.id,
        filename: 'above-the-clouds-aw25.pdf',
        originalFilename: 'Above The Clouds AW25 Drop-1.pdf',
        fileSize: 299931,
        totalRecords: 1,
        processedRecords: 1,
        successfulRecords: 1,
        failedRecords: 0,
        status: 'COMPLETED',
        importType: 'INVOICE',

        // PDF extraction metadata - this shows the AI extraction results
        fieldMappings: {
          extractionMethod: 'pdf-ai-reconciliation',
          processingTime: 2341,
          overallConfidence: 92,
          extractionResults: [
            {
              field: 'customerName',
              extracted: 'Above The Clouds',
              confidence: 95,
              pattern: 'Above The Clouds format',
              userAccepted: true,
              finalValue: 'Above The Clouds'
            },
            {
              field: 'email',
              extracted: 'info@poptradingcompany.com',
              confidence: 95,
              pattern: 'Email address',
              userAccepted: true,
              finalValue: 'info@poptradingcompany.com'
            },
            {
              field: 'invoiceNumber',
              extracted: 'V01250703',
              confidence: 90,
              pattern: 'V-number format',
              userAccepted: true,
              finalValue: 'V01250703'
            },
            {
              field: 'amount',
              extracted: '866078952',
              confidence: 60,
              pattern: 'Large numbers',
              userAccepted: false,
              userValue: '978.00',
              finalValue: '978.00',
              note: 'User corrected extracted amount'
            },
            {
              field: 'dueDate',
              extracted: null,
              confidence: 0,
              pattern: 'Not found',
              userAccepted: false,
              userValue: '2024-12-15',
              finalValue: '2024-12-15',
              note: 'User provided missing due date'
            }
          ],
          userInteractions: {
            fieldsAutoAccepted: 3,
            fieldsManuallyEdited: 2,
            totalReviewTime: 120, // seconds
            confidenceThreshold: 95
          }
        },

        processingStartedAt: new Date(Date.now() - 300000), // 5 minutes ago
        processingEndedAt: new Date(Date.now() - 240000),   // 4 minutes ago
      }
    })

    // 2. Create customer from PDF extraction
    console.log('👤 Creating customer from PDF data...')
    const customer = await prisma.customer.create({
      data: {
        id: 'cust_above_clouds_' + Date.now(),
        companyId: company.id,
        name: 'Above The Clouds',
        email: 'info@poptradingcompany.com',
        phone: null, // Not extracted from this PDF
        paymentTerms: 30,
        businessType: 'LLC',
        isActive: true,
        notes: 'Customer created via PDF extraction - Above The Clouds AW25 Drop-1.pdf',

        // Analytics from extraction
        riskScore: new Decimal('2.5'), // Low risk
        outstandingBalance: new Decimal('978.00'),
        customerSince: new Date(),
        lastInteraction: new Date(),
        preferredLanguage: 'en',
        communicationPref: 'email'
      }
    })

    // 3. Create invoice from reconciled PDF data
    console.log('🧾 Creating invoice from reconciled data...')
    const invoice = await prisma.invoice.create({
      data: {
        id: 'inv_pdf_demo_' + Date.now(),
        companyId: company.id,
        number: 'V01250703',
        customerName: 'Above The Clouds',
        customerEmail: 'info@poptradingcompany.com',
        amount: new Decimal('978.00'),
        subtotal: new Decimal('930.48'), // Amount before VAT
        vatAmount: new Decimal('47.52'),  // 5% VAT
        totalAmount: new Decimal('978.00'),
        currency: 'EUR',
        dueDate: new Date('2024-12-15'),
        status: 'SENT',
        description: 'AW25 Drop-1 Invoice - Extracted from PDF',
        notes: 'Created via PDF AI extraction with 92% confidence',
        importBatchId: importBatch.id,
        isActive: true,
        lastReminderSent: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // 4. Create activity log
    console.log('📝 Creating activity log...')
    await prisma.activity.create({
      data: {
        id: 'activity_pdf_' + Date.now(),
        companyId: company.id,
        userId: user.id,
        type: 'invoice_created_via_pdf',
        description: 'Invoice V01250703 created via PDF AI extraction (92% confidence)',
        metadata: {
          source: 'pdf-ai-reconciliation',
          filename: 'Above The Clouds AW25 Drop-1.pdf',
          extractionConfidence: 92,
          fieldsAutoAccepted: 3,
          fieldsManuallyEdited: 2,
          processingTime: 2341
        }
      }
    })

    console.log('\n✅ Demo data created successfully!')
    console.log('\n📊 What to look for in Prisma Studio:')
    console.log('   • import_batches - Check fieldMappings JSON for extraction results')
    console.log('   • customers - New customer from PDF extraction')
    console.log('   • invoices - Invoice created from reconciled PDF data')
    console.log('   • activities - Audit log of PDF processing')

    console.log('\n🎯 This simulates what happens when you:')
    console.log('   1. Upload Above The Clouds PDF')
    console.log('   2. AI extracts data with confidence scores')
    console.log('   3. User reviews and corrects some fields')
    console.log('   4. Final data gets stored in your database')

  } catch (error) {
    console.error('❌ Error seeding data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if this file is executed directly
if (require.main === module) {
  seedPDFDemoData()
}

export { seedPDFDemoData }