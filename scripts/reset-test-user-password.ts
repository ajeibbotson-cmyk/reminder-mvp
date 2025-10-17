/**
 * Reset test user password to known value for testing
 */

import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

async function resetPassword() {
  const email = 'admin@testcompany.ae'
  const newPassword = 'Test123!'

  console.log(`🔐 Resetting password for: ${email}`)

  const hashedPassword = await hash(newPassword, 12)

  await prisma.users.update({
    where: { email },
    data: { password: hashedPassword },
  })

  console.log(`✅ Password reset successfully`)
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${newPassword}`)
}

resetPassword()
  .catch(console.error)
  .finally(() => process.exit(0))
