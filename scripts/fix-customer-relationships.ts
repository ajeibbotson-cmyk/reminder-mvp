import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const targetCompanyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8' // admin@testcompany.ae

  console.log('\n🔍 Finding invoices with missing customers...\n')

  // Get all unique customer emails from invoices
  const invoices = await prisma.invoice.findMany({
    where: { companyId: targetCompanyId },
    select: {
      customerEmail: true,
      companyId: true
    }
  })

  // Get unique emails
  const uniqueEmails = [...new Set(invoices.map(i => i.customerEmail))]
  console.log(`Found ${uniqueEmails.length} unique customer emails`)

  let fixed = 0

  for (const email of uniqueEmails) {
    // Check if customer exists for this company
    const customer = await prisma.customer.findFirst({
      where: {
        email: email,
        companyId: targetCompanyId
      }
    })

    if (!customer) {
      // Find customer in other company
      const otherCustomer = await prisma.customer.findFirst({
        where: {
          email: email
        }
      })

      if (otherCustomer) {
        // Move customer to target company
        await prisma.customer.update({
          where: { id: otherCustomer.id },
          data: { companyId: targetCompanyId }
        })
        console.log(`✅ Moved customer: ${email}`)
        fixed++
      }
    }
  }

  console.log(`\n📊 Fixed ${fixed} customer relationships\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
