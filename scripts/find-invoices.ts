import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const companies = await prisma.company.findMany({
    include: {
      _count: {
        select: { invoices: true }
      },
      users: {
        select: { email: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log('\n📊 Companies with invoices:\n')

  for (const company of companies) {
    if (company._count.invoices > 0) {
      console.log(`Company: ${company.name}`)
      console.log(`  Invoices: ${company._count.invoices}`)
      console.log(`  Users: ${company.users.map(u => u.email).join(', ')}`)
      console.log(`  ID: ${company.id}`)
      console.log('')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
