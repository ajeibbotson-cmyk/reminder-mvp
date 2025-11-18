import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const fromEmail = 'admin@testcompany.ae'
  const toEmail = 'ajeibbotson@gmail.com'

  console.log(`\n📦 Transferring invoices from ${fromEmail} to ${toEmail}`)

  // Get source company
  const fromUser = await prisma.user.findUnique({
    where: { email: fromEmail },
    include: { company: true }
  })

  const toUser = await prisma.user.findUnique({
    where: { email: toEmail },
    include: { company: true }
  })

  if (!fromUser?.companyId || !toUser?.companyId) {
    console.log('❌ Users or companies not found')
    return
  }

  // Transfer customers FIRST (invoices have FK to customers)
  const customers = await prisma.customer.updateMany({
    where: { companyId: fromUser.companyId },
    data: { companyId: toUser.companyId }
  })

  console.log(`✅ Transferred ${customers.count} customers`)

  // Transfer invoices
  const result = await prisma.invoice.updateMany({
    where: { companyId: fromUser.companyId },
    data: { companyId: toUser.companyId }
  })

  console.log(`✅ Transferred ${result.count} invoices`)

  // Verify
  const invoiceCount = await prisma.invoice.count({
    where: { companyId: toUser.companyId }
  })

  console.log(`\n📊 ${toEmail} now has ${invoiceCount} invoices\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
