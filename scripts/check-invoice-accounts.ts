import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking accounts with invoice data...\n')

  const users = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      company_id: true,
      role: true
    }
  })

  console.log('=== ACCOUNTS WITH INVOICE DATA ===\n')
  
  for (const user of users) {
    const invoiceCount = await prisma.invoices.count({
      where: { company_id: user.company_id }
    })
    
    if (invoiceCount > 0) {
      const company = await prisma.companies.findUnique({
        where: { id: user.company_id }
      })
      
      console.log(`📧 Email: ${user.email}`)
      console.log(`👤 Name: ${user.name}`)
      console.log(`🏢 Company: ${company?.name}`)
      console.log(`📄 Invoices: ${invoiceCount}`)
      console.log(`🔑 Company ID: ${user.company_id}`)
      console.log('---\n')
    }
  }
  
  const totalInvoices = await prisma.invoices.count()
  console.log(`📊 Total invoices in database: ${totalInvoices}`)
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
