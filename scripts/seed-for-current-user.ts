import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const companyId = '911e9eb0-f9bc-443a-9cb7-b1d1e38ef81a' // From error logs

  console.log('🌱 Seeding invoices for logged-in company:', companyId)

  const company = await prisma.companies.findUnique({
    where: { id: companyId },
    include: { users: true }
  })

  if (!company) {
    throw new Error('Company not found!')
  }

  console.log(`✓ Company: ${company.name}`)
  console.log(`✓ Users: ${company.users.map(u => u.email).join(', ')}`)

  const today = new Date('2025-10-01')
  const calculateDueDate = (daysAgo: number): Date => {
    const date = new Date(today)
    date.setDate(date.getDate() - daysAgo)
    return date
  }

  const testInvoices = [
    {
      number: 'POP-2025-001',
      customer_name: 'Al Manara Trading LLC',
      customer_email: 'accounts@almanara-trading.ae',
      amount: 15000.00,
      due_date: calculateDueDate(-5),
      status: 'SENT' as const,
      description: 'Office furniture and equipment supply',
    },
    {
      number: 'POP-2025-002',
      customer_name: 'Dubai Tech Solutions',
      customer_email: 'finance@dubaitech.ae',
      amount: 8500.00,
      due_date: calculateDueDate(2),
      status: 'OVERDUE' as const,
      description: 'IT equipment and software licenses',
    },
    {
      number: 'POP-2025-003',
      customer_name: 'Emirates Construction Co',
      customer_email: 'payments@emiratesconstruction.ae',
      amount: 25750.00,
      due_date: calculateDueDate(6),
      status: 'OVERDUE' as const,
      description: 'Construction materials and tools',
    },
    {
      number: 'POP-2025-004',
      customer_name: 'Abu Dhabi Imports',
      customer_email: 'accounting@abudhabi-imports.ae',
      amount: 12300.00,
      due_date: calculateDueDate(22),
      status: 'OVERDUE' as const,
      description: 'Import goods and logistics services',
    },
    {
      number: 'POP-2025-005',
      customer_name: 'Sharjah Wholesale Market',
      customer_email: 'finance@sharjah-wholesale.ae',
      amount: 18900.00,
      due_date: calculateDueDate(45),
      status: 'OVERDUE' as const,
      description: 'Wholesale goods bulk order',
    }
  ]

  console.log('\n📋 Creating customers...')
  for (const invoice of testInvoices) {
    await prisma.customers.upsert({
      where: {
        email_company_id: {
          email: invoice.customer_email,
          company_id: companyId
        }
      },
      create: {
        id: randomUUID(),
        company_id: companyId,
        name: invoice.customer_name,
        email: invoice.customer_email,
        payment_terms: 30,
        created_at: new Date(),
        updated_at: new Date()
      },
      update: {}
    })
    console.log(`  ✓ ${invoice.customer_name}`)
  }

  console.log('\n💰 Creating invoices...')
  for (const invoiceData of testInvoices) {
    await prisma.invoices.create({
      data: {
        id: randomUUID(),
        company_id: companyId,
        number: invoiceData.number,
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        amount: invoiceData.amount,
        total_amount: invoiceData.amount,
        subtotal: invoiceData.amount,
        vat_amount: 0,
        currency: 'AED',
        due_date: invoiceData.due_date,
        status: invoiceData.status,
        description: invoiceData.description,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    const daysOverdue = Math.floor((today.getTime() - invoiceData.due_date.getTime()) / (1000 * 60 * 60 * 24))
    console.log(`  ✓ ${invoiceData.number} - ${invoiceData.customer_name}`)
    console.log(`    Days overdue: ${daysOverdue > 0 ? daysOverdue : 'Not due yet'}`)
  }

  console.log('\n✅ Done! Refresh your dashboard!')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
