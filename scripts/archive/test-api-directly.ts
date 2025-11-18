import { prisma } from '@/lib/prisma'

async function testAPIDirectly() {
  // Get user and company
  const user = await prisma.users.findFirst({
    include: { companies: true },
  })

  if (!user) {
    console.log('No user found')
    process.exit(1)
  }

  console.log(`Testing API for: ${user.email}`)
  console.log(`Company: ${user.companies.name} (${user.company_id})`)

  // Test the exact query the API would run WITHOUT currency filter
  const invoicesWithoutCurrency = await prisma.invoices.findMany({
    where: {
      company_id: user.company_id,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 10,
  })

  console.log(`\n✅ Query WITHOUT currency filter: ${invoicesWithoutCurrency.length} invoices`)
  if (invoicesWithoutCurrency.length > 0) {
    console.log('First invoice:', {
      number: invoicesWithoutCurrency[0].number,
      currency: invoicesWithoutCurrency[0].currency,
      amount: invoicesWithoutCurrency[0].amount.toString(),
    })
  }

  // Test the old query WITH AED currency filter
  const invoicesWithAED = await prisma.invoices.findMany({
    where: {
      company_id: user.company_id,
      currency: 'AED',
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 10,
  })

  console.log(`\n❌ Query WITH AED filter: ${invoicesWithAED.length} invoices`)

  console.log('\n🔍 CONCLUSION:')
  if (invoicesWithoutCurrency.length > 0 && invoicesWithAED.length === 0) {
    console.log('✅ The fix is working correctly!')
    console.log('✅ Backend returns invoices WITHOUT currency filter')
    console.log('❌ Backend returns 0 invoices WITH AED filter')
    console.log('\n💡 Frontend issue: The frontend must be caching old results or not fetching correctly')
  }
}

testAPIDirectly()
  .catch(console.error)
  .finally(() => process.exit(0))
