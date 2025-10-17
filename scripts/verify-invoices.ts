import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companyId = '2abe94be-b916-415d-be4b-dd9b6ffeff4d'

  console.log('🔍 Checking invoices for company:', companyId)
  console.log('')

  const invoices = await prisma.invoices.findMany({
    where: {
      company_id: companyId
    },
    select: {
      id: true,
      number: true,
      customer_name: true,
      status: true,
      due_date: true,
      total_amount: true,
      is_active: true
    },
    orderBy: {
      due_date: 'desc'
    }
  })

  console.log(`Found ${invoices.length} invoices:\n`)

  if (invoices.length === 0) {
    console.log('❌ No invoices found!')
    console.log('\nTrying to find ANY invoices in database...\n')

    const allInvoices = await prisma.invoices.findMany({
      take: 5,
      select: {
        id: true,
        number: true,
        company_id: true,
        customer_name: true
      }
    })

    if (allInvoices.length > 0) {
      console.log('Found invoices for other companies:')
      allInvoices.forEach(inv => {
        console.log(`  - ${inv.number} (Company: ${inv.company_id})`)
      })
    } else {
      console.log('No invoices found in entire database!')
    }

    return
  }

  invoices.forEach((inv, i) => {
    const today = new Date()
    const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))

    console.log(`${i + 1}. ${inv.number} - ${inv.customer_name}`)
    console.log(`   Amount: AED ${inv.total_amount}`)
    console.log(`   Status: ${inv.status}`)
    console.log(`   Due Date: ${new Date(inv.due_date).toLocaleDateString()}`)
    console.log(`   Days overdue: ${daysOverdue}`)
    console.log(`   Active: ${inv.is_active}`)
    console.log('')
  })

  // Check bucket API logic
  console.log('📊 Checking which buckets they should appear in:\n')

  const unpaidInvoices = invoices.filter(inv =>
    (inv.status === 'SENT' || inv.status === 'OVERDUE') && inv.is_active
  )

  console.log(`Unpaid/Active invoices (should appear in buckets): ${unpaidInvoices.length}`)

  if (unpaidInvoices.length === 0) {
    console.log('\n⚠️ Problem: No invoices with SENT or OVERDUE status!')
    console.log('Bucket API only shows invoices with status: SENT or OVERDUE')
  }
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
