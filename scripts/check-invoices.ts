import { prisma } from '@/lib/prisma'

async function checkInvoices() {
  const user = await prisma.users.findFirst({
    include: { companies: true },
  })

  if (!user) {
    console.log('No user found')
    process.exit(1)
  }

  console.log(`Company: ${user.companies.name} (${user.company_id})`)

  const allInvoices = await prisma.invoices.findMany({
    where: { company_id: user.company_id },
    select: { currency: true },
  })

  const grouped = allInvoices.reduce((acc, inv) => {
    acc[inv.currency] = (acc[inv.currency] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nInvoice currencies:')
  console.log(grouped)

  console.log(`\nTotal invoices: ${allInvoices.length}`)

  // Check what the API is filtering by
  const aedInvoices = await prisma.invoices.findMany({
    where: {
      company_id: user.company_id,
      currency: 'AED',
    },
  })

  const eurInvoices = await prisma.invoices.findMany({
    where: {
      company_id: user.company_id,
      currency: 'EUR',
    },
  })

  console.log(`\nAED invoices: ${aedInvoices.length}`)
  console.log(`EUR invoices: ${eurInvoices.length}`)
}

checkInvoices()
  .catch(console.error)
  .finally(() => process.exit(0))
