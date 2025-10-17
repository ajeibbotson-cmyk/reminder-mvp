/**
 * Move existing invoices to new test user's company
 */

import { prisma } from '@/lib/prisma'

async function moveInvoices() {
  // Get the new test user
  const newUser = await prisma.users.findUnique({
    where: { email: 'test@demo.com' },
    select: { company_id: true, email: true },
  })

  if (!newUser) {
    console.error('❌ New user not found')
    process.exit(1)
  }

  console.log(`✅ New user found: test@demo.com`)
  console.log(`   Company ID: ${newUser.company_id}`)

  // Get the old test company with invoices
  const oldUser = await prisma.users.findUnique({
    where: { email: 'admin@testcompany.ae' },
    select: { company_id: true },
  })

  if (!oldUser) {
    console.error('❌ Old user not found')
    process.exit(1)
  }

  console.log(`✅ Old user company ID: ${oldUser.company_id}`)

  // Count invoices before
  const invoiceCount = await prisma.invoices.count({
    where: { company_id: oldUser.company_id },
  })

  console.log(`📊 Moving ${invoiceCount} invoices...`)

  // Move all invoices to new company
  const result = await prisma.invoices.updateMany({
    where: { company_id: oldUser.company_id },
    data: { company_id: newUser.company_id },
  })

  console.log(`✅ Moved ${result.count} invoices to new user's company`)

  // Move customers too
  const customerResult = await prisma.customers.updateMany({
    where: { company_id: oldUser.company_id },
    data: { company_id: newUser.company_id },
  })

  console.log(`✅ Moved ${customerResult.count} customers`)
}

moveInvoices()
  .catch(console.error)
  .finally(() => process.exit(0))
