#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function testAuth() {
  const user = await prisma.users.findUnique({
    where: { email: 'smoke-test@example.com' }
  })

  if (!user) {
    console.log('User not found')
    return
  }

  console.log('User found:', user.email)
  console.log('Password hash exists:', !!user.password)
  console.log('Password hash length:', user.password?.length)

  const testPassword = 'SmokeTest123!'
  const isValid = await bcrypt.compare(testPassword, user.password || '')

  console.log('\nPassword test:', testPassword)
  console.log('Result:', isValid ? 'VALID' : 'INVALID')

  if (!isValid) {
    console.log('\nResetting password...')
    const newHash = await bcrypt.hash(testPassword, 12)
    await prisma.users.update({
      where: { id: user.id },
      data: { password: newHash }
    })
    console.log('Password reset complete')

    const retest = await bcrypt.compare(testPassword, newHash)
    console.log('Retest:', retest ? 'VALID' : 'INVALID')
  }

  await prisma.$disconnect()
}

testAuth().catch(console.error)
