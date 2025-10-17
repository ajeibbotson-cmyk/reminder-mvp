import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8' // admin@testcompany.ae
  
  console.log('\n📊 Dashboard Data Check\n')
  
  // Get invoice counts by status
  const statuses = await prisma.invoices.groupBy({
    by: ['status'],
    where: { company_id: companyId },
    _count: { _all: true },
    _sum: { total_amount: true }
  })
  
  console.log('Invoice Breakdown:')
  statuses.forEach(s => {
    console.log(`  ${s.status}: ${s._count._all} invoices, AED ${s._sum.total_amount?.toFixed(2) || 0}`)
  })
  
  // Get total outstanding
  const outstanding = await prisma.invoices.aggregate({
    where: {
      company_id: companyId,
      status: { in: ['PENDING', 'SENT', 'OVERDUE'] }
    },
    _sum: { total_amount: true },
    _count: { _all: true }
  })
  
  console.log(`\n💰 Total Outstanding: AED ${outstanding._sum.total_amount?.toFixed(2) || 0}`)
  console.log(`📝 Outstanding Invoices: ${outstanding._count._all}`)
  
  // Check for recent invoices
  const recentInvoices = await prisma.invoices.findMany({
    where: { company_id: companyId },
    select: {
      number: true,
      customer_name: true,
      total_amount: true,
      status: true,
      due_date: true
    },
    orderBy: { created_at: 'desc' },
    take: 5
  })
  
  console.log('\n📋 Recent Invoices:')
  recentInvoices.forEach(inv => {
    console.log(`  ${inv.number} - ${inv.customer_name}: AED ${inv.total_amount} [${inv.status}]`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
