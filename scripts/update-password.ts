/**
 * Update password for admin@testcompany.ae user
 */

import { prisma } from '@/lib/prisma'

async function updatePassword() {
  console.log('🔐 Updating password for admin@testcompany.ae...\n')

  const hashedPassword = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7Aq.Z3wOKa' // Test123!

  try {
    const result = await prisma.users.update({
      where: {
        email: 'admin@testcompany.ae',
      },
      data: {
        password: hashedPassword,
      },
      select: {
        email: true,
        company_id: true,
      },
    })

    console.log('✅ Password updated successfully!')
    console.log(`   Email: ${result.email}`)
    console.log(`   Company ID: ${result.company_id}`)
    console.log(`   New password: Test123!\n`)
  } catch (error) {
    console.error('❌ Failed to update password:', error)
    process.exit(1)
  }
}

updatePassword()
  .catch(console.error)
  .finally(() => process.exit(0))
