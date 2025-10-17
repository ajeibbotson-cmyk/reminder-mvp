import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding test invoices from POP Trading Company...')

  // Get the user's email from command line argument or use default
  const userEmail = process.argv[2] || 'ajeelbotson@gmail.com'

  console.log(`Looking up company for user: ${userEmail}`)

  // Find the user and their company
  const user = await prisma.users.findUnique({
    where: { email: userEmail },
    select: {
      id: true,
      company_id: true,
      email: true,
      name: true
    }
  })

  if (!user || !user.company_id) {
    throw new Error(`User not found or has no company: ${userEmail}`)
  }

  console.log(`✓ Found user: ${user.name} (${user.email})`)
  console.log(`✓ Company ID: ${user.company_id}`)

  // Calculate due dates based on today (2025-10-01)
  const today = new Date('2025-10-01')

  const calculateDueDate = (daysAgo: number): Date => {
    const date = new Date(today)
    date.setDate(date.getDate() - daysAgo)
    return date
  }

  // Real POP Trading invoice data
  const testInvoices = [
    {
      number: 'POP-2025-001',
      customer_name: 'Al Manara Trading LLC',
      customer_email: 'accounts@almanara-trading.ae',
      amount: 15000.00,
      total_amount: 15000.00,
      subtotal: 15000.00,
      vat_amount: 0.00,
      due_date: calculateDueDate(-5), // 5 days in future (Not Due bucket)
      status: 'SENT' as const,
      description: 'Office furniture and equipment supply',
      description_ar: 'توريد أثاث ومعدات مكتبية',
      trn_number: '100123456789001'
    },
    {
      number: 'POP-2025-002',
      customer_name: 'Dubai Tech Solutions',
      customer_email: 'finance@dubaitech.ae',
      amount: 8500.00,
      total_amount: 8500.00,
      subtotal: 8500.00,
      vat_amount: 0.00,
      due_date: calculateDueDate(2), // 2 days ago (1-3 Days bucket)
      status: 'OVERDUE' as const,
      description: 'IT equipment and software licenses',
      description_ar: 'معدات تقنية المعلومات وتراخيص البرمجيات',
      trn_number: '100234567890002',
      last_reminder_sent: calculateDueDate(1) // Reminder sent 1 day ago
    },
    {
      number: 'POP-2025-003',
      customer_name: 'Emirates Construction Co',
      customer_email: 'payments@emiratesconstruction.ae',
      amount: 25750.00,
      total_amount: 25750.00,
      subtotal: 25750.00,
      vat_amount: 0.00,
      due_date: calculateDueDate(6), // 6 days ago (4-7 Days bucket)
      status: 'OVERDUE' as const,
      description: 'Construction materials and tools',
      description_ar: 'مواد وأدوات البناء',
      trn_number: '100345678901003'
    },
    {
      number: 'POP-2025-004',
      customer_name: 'Abu Dhabi Imports',
      customer_email: 'accounting@abudhabi-imports.ae',
      amount: 12300.00,
      total_amount: 12300.00,
      subtotal: 12300.00,
      vat_amount: 0.00,
      due_date: calculateDueDate(22), // 22 days ago (15-30 Days bucket)
      status: 'OVERDUE' as const,
      description: 'Import goods and logistics services',
      description_ar: 'البضائع المستوردة وخدمات اللوجستيات',
      trn_number: '100456789012004',
      last_reminder_sent: calculateDueDate(10) // Reminder sent 10 days ago
    },
    {
      number: 'POP-2025-005',
      customer_name: 'Sharjah Wholesale Market',
      customer_email: 'finance@sharjah-wholesale.ae',
      amount: 18900.00,
      total_amount: 18900.00,
      subtotal: 18900.00,
      vat_amount: 0.00,
      due_date: calculateDueDate(45), // 45 days ago (30+ Days bucket)
      status: 'OVERDUE' as const,
      description: 'Wholesale goods bulk order',
      description_ar: 'طلب كمية كبيرة من البضائع بالجملة',
      trn_number: '100567890123005',
      notes: 'Customer requested payment plan - follow up required'
    }
  ]

  // First, create customers
  console.log('\n📋 Creating customers...')

  for (const invoice of testInvoices) {
    await prisma.customers.upsert({
      where: {
        email_company_id: {
          email: invoice.customer_email,
          company_id: user.company_id
        }
      },
      create: {
        id: randomUUID(),
        company_id: user.company_id,
        name: invoice.customer_name,
        email: invoice.customer_email,
        payment_terms: 30, // 30 days standard
        created_at: new Date(),
        updated_at: new Date()
      },
      update: {
        name: invoice.customer_name,
        updated_at: new Date()
      }
    })
    console.log(`  ✓ ${invoice.customer_name}`)
  }

  // Create invoices
  console.log('\n💰 Creating invoices...')

  const createdInvoices = []

  for (const invoiceData of testInvoices) {
    const invoice = await prisma.invoices.create({
      data: {
        id: randomUUID(),
        company_id: user.company_id,
        number: invoiceData.number,
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        amount: invoiceData.amount,
        total_amount: invoiceData.total_amount,
        subtotal: invoiceData.subtotal,
        vat_amount: invoiceData.vat_amount,
        currency: 'AED',
        due_date: invoiceData.due_date,
        status: invoiceData.status,
        description: invoiceData.description,
        description_ar: invoiceData.description_ar,
        trn_number: invoiceData.trn_number,
        notes: invoiceData.notes,
        is_active: true,
        last_reminder_sent: invoiceData.last_reminder_sent || null,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    createdInvoices.push(invoice)

    const daysOverdue = Math.floor((today.getTime() - invoiceData.due_date.getTime()) / (1000 * 60 * 60 * 24))
    console.log(`  ✓ ${invoice.number} - ${invoice.customer_name}`)
    console.log(`    Amount: AED ${invoice.amount.toString()}`)
    console.log(`    Status: ${invoice.status}`)
    console.log(`    Days overdue: ${daysOverdue > 0 ? daysOverdue : 'Not due yet'}`)
  }

  // Calculate summary
  const totalAmount = createdInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)
  const overdueInvoices = createdInvoices.filter(inv => inv.status === 'OVERDUE')
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

  console.log('\n📊 Summary:')
  console.log(`  Total invoices created: ${createdInvoices.length}`)
  console.log(`  Total outstanding: AED ${totalAmount.toFixed(2)}`)
  console.log(`  Overdue invoices: ${overdueInvoices.length}`)
  console.log(`  Overdue amount: AED ${overdueAmount.toFixed(2)}`)

  console.log('\n✨ Bucket distribution:')
  console.log('  Not Due: 1 invoice (AED 15,000.00)')
  console.log('  1-3 Days: 1 invoice (AED 8,500.00)')
  console.log('  4-7 Days: 1 invoice (AED 25,750.00)')
  console.log('  8-14 Days: 0 invoices')
  console.log('  15-30 Days: 1 invoice (AED 12,300.00)')
  console.log('  30+ Days: 1 invoice (AED 18,900.00)')

  console.log('\n✅ Seed completed successfully!')
  console.log('\n📍 Next steps:')
  console.log('  1. Refresh your dashboard at: reminder-mvp.vercel.app/en/dashboard')
  console.log('  2. Scroll down to see the populated bucket system')
  console.log('  3. Click on bucket cards to see invoice details')
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
