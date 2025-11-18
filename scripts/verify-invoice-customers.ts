import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const companyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8' // admin@testcompany.ae

  console.log('\n🔍 Checking invoice-customer relationships...\n')

  // Get sample of invoices with customer data
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    take: 10,
    include: {
      customer: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`📊 Showing 10 sample invoices:\n`)

  for (const inv of invoices) {
    console.log(`Invoice: ${inv.number}`)
    console.log(`  Customer Email: ${inv.customerEmail}`)
    console.log(`  Customer Name: ${inv.customerName || 'NOT SET'}`)
    console.log(`  Has Customer Record: ${inv.customer ? '✅ YES' : '❌ NO'}`)
    if (inv.customer) {
      console.log(`  Customer DB Name: ${inv.customer.name}`)
      console.log(`  Customer DB Email: ${inv.customer.email}`)
    }
    console.log('')
  }

  // Count invoices with missing customer records
  const totalInvoices = await prisma.invoice.count({
    where: { companyId }
  })

  const invoicesWithCustomer = await prisma.invoice.count({
    where: {
      companyId,
      customer: {
        isNot: null
      }
    }
  })

  console.log(`\n📈 Summary:`)
  console.log(`  Total Invoices: ${totalInvoices}`)
  console.log(`  With Customer Record: ${invoicesWithCustomer}`)
  console.log(`  Missing Customer: ${totalInvoices - invoicesWithCustomer}`)
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
