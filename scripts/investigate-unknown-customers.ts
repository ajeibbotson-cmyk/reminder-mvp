import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const companyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8'

  console.log('\n🔍 INVESTIGATING "Unknown Customer" ISSUE\n')
  console.log('='.repeat(70))

  // Get invoices showing on screen
  const screenInvoices = ['POP-2025-005', 'POP-2025-004', 'POP-2025-003', 'POP-2025-002', 'POP-2025-001', 'V01250845', 'V01250914', 'V01250851']

  for (const invoiceNum of screenInvoices) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        number: invoiceNum,
        companyId
      },
      include: {
        customer: true
      }
    })

    if (invoice) {
      console.log(`\n📄 Invoice: ${invoice.number}`)
      console.log(`   Customer ID: ${invoice.customerId || 'NULL'}`)
      console.log(`   Customer Name (field): ${invoice.customerName}`)
      console.log(`   Customer Email (field): ${invoice.customerEmail}`)

      if (invoice.customer) {
        console.log(`   ✅ Customer Record Found:`)
        console.log(`      ID: ${invoice.customer.id}`)
        console.log(`      Name: ${invoice.customer.name}`)
        console.log(`      Email: ${invoice.customer.email}`)
      } else {
        console.log(`   ❌ NO CUSTOMER RELATIONSHIP - This is the problem!`)

        // Try to find a matching customer
        const potentialCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              { email: invoice.customerEmail },
              { name: invoice.customerName }
            ],
            companyId
          }
        })

        if (potentialCustomer) {
          console.log(`   ⚠️  Found matching customer that SHOULD be linked:`)
          console.log(`      ID: ${potentialCustomer.id}`)
          console.log(`      Name: ${potentialCustomer.name}`)
          console.log(`      Email: ${potentialCustomer.email}`)
        } else {
          console.log(`   ⚠️  No customer exists for this email/name - needs to be created`)
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('\n📊 SUMMARY\n')

  const totalInvoices = await prisma.invoice.count({ where: { companyId } })
  const linkedInvoices = await prisma.invoice.count({
    where: {
      companyId,
      customerId: { not: null }
    }
  })
  const unlinkedInvoices = totalInvoices - linkedInvoices

  console.log(`Total Invoices: ${totalInvoices}`)
  console.log(`Linked to Customers: ${linkedInvoices}`)
  console.log(`Unlinked (NULL customerId): ${unlinkedInvoices}`)

  if (unlinkedInvoices > 0) {
    console.log(`\n❌ PROBLEM CONFIRMED: ${unlinkedInvoices} invoices have NULL customerId`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
