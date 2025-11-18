/**
 * Test what the API actually returns
 * This simulates the exact API response to debug frontend rendering
 */

import { prisma } from '@/lib/prisma'

async function testAPIResponse() {
  const user = await prisma.users.findFirst({
    include: { companies: true },
  })

  if (!user) {
    console.log('No user found')
    process.exit(1)
  }

  console.log('🔍 Testing API Response Format\n')

  // Simulate the exact query the API runs
  const [invoices, totalCount, statusCounts] = await Promise.all([
    prisma.invoices.findMany({
      where: {
        company_id: user.company_id,
      },
      include: {
        customers: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            payment_terms: true,
          },
        },
        companies: {
          select: {
            id: true,
            name: true,
            trn: true,
            default_vat_rate: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            payment_date: true,
            method: true,
          },
          orderBy: { payment_date: 'desc' },
          take: 5,
        },
        invoice_items: true,
        follow_up_logs: true,
        import_batches: true,
        email_logs: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: 0,
      take: 10,
    }),
    prisma.invoices.count({
      where: {
        company_id: user.company_id,
      },
    }),
    prisma.invoices.groupBy({
      by: ['status'],
      where: {
        company_id: user.company_id,
      },
      _count: {
        status: true,
      },
    }),
  ])

  console.log(`✅ Total Count: ${totalCount}`)
  console.log(`✅ Invoices Returned: ${invoices.length}`)
  console.log(`✅ Status Counts:`, statusCounts)

  console.log('\n📦 Sample Invoice Structure:')
  if (invoices.length > 0) {
    const sample = invoices[0]
    console.log({
      id: sample.id,
      number: sample.number,
      customer_name: sample.customer_name,
      amount: sample.amount.toString(),
      currency: sample.currency,
      status: sample.status,
      hasCustomers: !!sample.customers,
      hasCompanies: !!sample.companies,
    })
  }

  // This is what gets sent to frontend
  const apiResponse = {
    success: true,
    data: {
      invoices: invoices,
      pagination: {
        totalCount,
        page: 1,
        limit: 10,
        totalPages: Math.ceil(totalCount / 10),
        hasMore: 10 < totalCount,
        hasPrevious: false,
      },
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<string, number>),
    },
  }

  console.log('\n📡 API Response Structure:')
  console.log('success:', apiResponse.success)
  console.log('data.invoices.length:', apiResponse.data.invoices.length)
  console.log('data.pagination:', apiResponse.data.pagination)
  console.log('data.statusCounts:', apiResponse.data.statusCounts)

  if (apiResponse.data.invoices.length === 0) {
    console.log('\n❌ PROBLEM: API returns 0 invoices!')
  } else {
    console.log('\n✅ API returns invoices correctly')
  }
}

testAPIResponse()
  .catch(console.error)
  .finally(() => process.exit(0))
