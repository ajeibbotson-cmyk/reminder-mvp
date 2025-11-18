import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  // Get the Test Company LLC (the one with 111 invoices)
  const testCompany = await prisma.company.findFirst({
    where: { name: 'Test Company LLC' },
    include: {
      invoices: true,
      users: true
    }
  })

  // Get the user that just logged in
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@testcompany.ae' },
    include: { company: true }
  })

  if (!testCompany || !adminUser) {
    console.log('❌ Could not find companies or users')
    return
  }

  console.log(`\n📊 Current State:`)
  console.log(`   Test Company LLC has ${testCompany.invoices.length} invoices`)
  console.log(`   admin@testcompany.ae is in company: ${adminUser.company?.name}`)
  console.log(`   admin@testcompany.ae company has ID: ${adminUser.companyId}`)

  // Check if they're the same company
  if (testCompany.id === adminUser.companyId) {
    console.log('\n✅ Already linked! Invoices should be showing.')
    const invoiceCount = await prisma.invoice.count({
      where: { companyId: adminUser.companyId }
    })
    console.log(`   Invoice count for this company: ${invoiceCount}`)
  } else {
    console.log('\n🔄 Linking user to Test Company LLC...')

    // Update the user to belong to Test Company LLC
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { companyId: testCompany.id }
    })

    console.log(`✅ Updated! admin@testcompany.ae now has access to ${testCompany.invoices.length} invoices\n`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
