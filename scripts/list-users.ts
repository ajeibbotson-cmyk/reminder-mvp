import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const users = await prisma.user.findMany({
    include: {
      company: {
        include: {
          _count: {
            select: {
              invoices: true,
              customers: true
            }
          }
        }
      }
    }
  })

  console.log('\n📋 All Users in Database:\n')

  for (const user of users) {
    console.log(`📧 Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)
    console.log(`   Role: ${user.role}`)
    if (user.company) {
      console.log(`   Company: ${user.company.name}`)
      console.log(`   Invoices: ${user.company._count.invoices}`)
      console.log(`   Customers: ${user.company._count.customers}`)
    }
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
