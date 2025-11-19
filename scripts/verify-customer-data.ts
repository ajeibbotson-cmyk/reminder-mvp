import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const companyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8'
  
  console.log('\n📊 CUSTOMER DATA INTEGRITY REPORT')
  console.log('='.repeat(70))
  
  // Total invoices
  const totalInvoices = await prisma.invoice.count({
    where: { companyId }
  })
  
  // Invoices with customer relationships
  const invoicesWithCustomer = await prisma.invoice.count({
    where: {
      companyId,
      customer: { is: {} }
    }
  })
  
  // Invoices without customer relationships
  const invoicesWithoutCustomer = await prisma.invoice.count({
    where: {
      companyId,
      customer: { isNot: {} }
    }
  })
  
  // Total customers
  const totalCustomers = await prisma.customer.count({
    where: { companyId }
  })
  
  console.log(`\n📋 Invoice Data:`)
  console.log(`   Total Invoices: ${totalInvoices}`)
  console.log(`   With Customer Link: ${invoicesWithCustomer}`)
  console.log(`   Without Customer Link: ${invoicesWithoutCustomer}`)
  
  console.log(`\n👥 Customer Data:`)
  console.log(`   Total Customers: ${totalCustomers}`)
  
  // Sample invoices without customers
  if (invoicesWithoutCustomer > 0) {
    console.log(`\n⚠️  Sample Invoices Without Customer Links:`)
    const samples = await prisma.invoice.findMany({
      where: {
        companyId,
        customer: { isNot: {} }
      },
      select: {
        number: true,
        customerEmail: true,
        customerName: true
      },
      take: 5
    })
    
    samples.forEach(inv => {
      console.log(`   - ${inv.number}: ${inv.customerName} (${inv.customerEmail})`)
    })
  } else {
    console.log(`\n✅ All invoices have customer links!`)
  }
  
  console.log('\n' + '='.repeat(70))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
