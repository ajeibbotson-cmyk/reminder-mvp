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

  console.log('\n🔗 LINKING INVOICES TO CUSTOMERS\n')
  console.log('='.repeat(70))

  // Get all invoices without customer links
  const unlinkedInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      customerId: null
    },
    select: {
      id: true,
      number: true,
      customerName: true,
      customerEmail: true
    }
  })

  console.log(`\nFound ${unlinkedInvoices.length} invoices without customer links\n`)

  let linked = 0
  let created = 0

  for (const invoice of unlinkedInvoices) {
    // Try to find existing customer by email
    let customer = await prisma.customer.findFirst({
      where: {
        email: invoice.customerEmail,
        companyId
      }
    })

    // If not found by email, try by name
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: {
          name: invoice.customerName,
          companyId
        }
      })
    }

    // If still not found, create the customer
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          id: crypto.randomUUID(),
          name: invoice.customerName || 'Unknown',
          email: invoice.customerEmail || `unknown-${Date.now()}@customer.com`,
          companyId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      console.log(`   ✅ Created customer: ${customer.name} (${customer.email})`)
      created++
    }

    // Link invoice to customer
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { customerId: customer.id }
    })

    console.log(`   🔗 Linked ${invoice.number} → ${customer.name}`)
    linked++
  }

  console.log('\n' + '='.repeat(70))
  console.log(`\n✅ COMPLETE\n`)
  console.log(`   Invoices Linked: ${linked}`)
  console.log(`   Customers Created: ${created}`)
  console.log(`\n` + '='.repeat(70) + '\n')
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
