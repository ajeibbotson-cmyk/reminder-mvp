import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  const email = 'admin@testcompany.ae'
  const testPassword = 'TestPass123!'

  console.log(`\n🔍 Testing login for: ${email}`)

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true }
  })

  if (!user) {
    console.log('❌ User not found')
    return
  }

  console.log('\n✅ User found:')
  console.log('   Email:', user.email)
  console.log('   Name:', user.name)
  console.log('   Company:', user.company?.name)
  console.log('   Password hash length:', user.password?.length)

  const isValid = await bcrypt.compare(testPassword, user.password || '')

  console.log('\n🔐 Password Test:')
  console.log('   Testing password:', testPassword)
  console.log('   Result:', isValid ? '✅ VALID' : '❌ INVALID')

  if (!isValid) {
    console.log('\n⚠️  Password does not match. Resetting...')
    const newHash = await bcrypt.hash(testPassword, 12)
    await prisma.user.update({
      where: { email },
      data: { password: newHash }
    })
    console.log('✅ Password reset complete')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
