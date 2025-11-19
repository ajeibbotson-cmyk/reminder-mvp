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

  console.log('\n🔧 CREATING MISSING CUSTOMER RECORDS\n')
  console.log('='.repeat(70))

  // Get all unique customer emails from invoices
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    select: {
      customerEmail: true,
      customerName: true
    },
    distinct: ['customerEmail']
  })

  console.log(`\nFound ${invoices.length} unique customer emails in invoices\n`)

  let created = 0
  let existed = 0

  for (const invoice of invoices) {
    // Check if customer already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email: invoice.customerEmail,
        companyId
      }
    })

    if (existingCustomer) {
      console.log(`   ✓ Customer exists: ${invoice.customerEmail}`)
      existed++
    } else {
      // Create the customer
      await prisma.customer.create({
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
      console.log(`   ✅ Created customer: ${invoice.customerName} (${invoice.customerEmail})`)
      created++
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log(`\n✅ COMPLETE\n`)
  console.log(`   Customers Already Existed: ${existed}`)
  console.log(`   Customers Created: ${created}`)
  console.log(`\n` + '='.repeat(70))

  // Verify all invoices now have customer relationships
  console.log(`\n🔍 VERIFICATION\n`)

  const totalInvoices = await prisma.invoice.count({ where: { companyId } })
  const invoicesWithCustomer = await prisma.invoice.count({
    where: {
      companyId,
      customer: { is: {} }
    }
  })

  console.log(`   Total Invoices: ${totalInvoices}`)
  console.log(`   With Customer Link: ${invoicesWithCustomer}`)
  console.log(`   Missing Link: ${totalInvoices - invoicesWithCustomer}`)

  if (invoicesWithCustomer === totalInvoices) {
    console.log(`\n   🎉 ALL INVOICES NOW HAVE CUSTOMER RELATIONSHIPS!\n`)
  } else {
    console.log(`\n   ⚠️  Some invoices still missing customer links\n`)
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
