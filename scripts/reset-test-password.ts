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
  const newPassword = 'TestPass123!'

  console.log(`\n🔐 Resetting password for: ${email}`)

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 12)

  // Update the user
  const user = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
    include: {
      company: {
        include: {
          _count: {
            select: { invoices: true }
          }
        }
      }
    }
  })

  console.log('\n✅ Password reset successful!\n')
  console.log('📧 Email:', user.email)
  console.log('🔑 Password:', newPassword)
  console.log('🏢 Company:', user.company?.name)
  console.log('📄 Invoices:', user.company?._count.invoices)
  console.log('👤 Role:', user.role)
  console.log('\n🌐 Login at: http://localhost:3000/auth/signin\n')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
