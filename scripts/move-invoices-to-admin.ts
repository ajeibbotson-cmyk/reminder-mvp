import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const fromCompanyId = '5d18648e-5c82-4f98-8530-9ebde12c6563' // test company with ajeibbotson
  const toCompanyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8' // Test Company LLC with admin@testcompany.ae

  console.log('\n📦 Moving 111 invoices to admin@testcompany.ae account...\n')

  // Move customers first
  const customers = await prisma.customer.updateMany({
    where: { companyId: fromCompanyId },
    data: { companyId: toCompanyId }
  })

  console.log(`✅ Moved ${customers.count} customers`)

  // Move invoices
  const invoices = await prisma.invoice.updateMany({
    where: { companyId: fromCompanyId },
    data: { companyId: toCompanyId }
  })

  console.log(`✅ Moved ${invoices.count} invoices`)

  const finalCount = await prisma.invoice.count({
    where: { companyId: toCompanyId }
  })

  console.log(`\n📊 admin@testcompany.ae now has ${finalCount} invoices!\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
