import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking for existing users...\n')

  const users = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      company_id: true,
      role: true,
      created_at: true
    },
    orderBy: {
      created_at: 'desc'
    }
  })

  if (users.length === 0) {
    console.log('❌ No users found in database')
    console.log('\n📝 To create test invoices, you need to:')
    console.log('  1. Sign up at: reminder-mvp.vercel.app/en/auth/signup')
    console.log('  2. Then run: npx tsx scripts/seed-test-invoices.ts YOUR_EMAIL')
    return
  }

  console.log(`✅ Found ${users.length} user(s):\n`)

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email})`)
    console.log(`   Company ID: ${user.company_id}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Created: ${user.created_at.toLocaleDateString()}`)
    console.log('')
  })

  console.log('📌 To seed invoices for a user, run:')
  console.log(`   npx tsx scripts/seed-test-invoices.ts ${users[0].email}`)
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
