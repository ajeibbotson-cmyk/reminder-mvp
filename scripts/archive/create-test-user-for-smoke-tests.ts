#!/usr/bin/env tsx
/**
 * Create Test User for Smoke Tests
 *
 * Creates a test user with known credentials for API testing
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

const TEST_EMAIL = 'smoke-test@example.com'
const TEST_PASSWORD = 'SmokeTest123!'

async function createTestUser() {
  console.log('Creating test user for smoke tests...\n')

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL }
    })

    if (existingUser) {
      console.log(`✅ Test user already exists: ${TEST_EMAIL}`)
      console.log(`   Updating password to ensure it's correct...`)

      // Update password to ensure it's correct
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: await bcrypt.hash(TEST_PASSWORD, 12)
        }
      })

      console.log(`✅ Password updated successfully\n`)
      console.log(`📧 Email: ${TEST_EMAIL}`)
      console.log(`🔑 Password: ${TEST_PASSWORD}`)
      console.log(`🏢 Company ID: ${existingUser.company_id}`)

      return
    }

    // Create test company first
    console.log('Creating test company...')
    const companyId = randomUUID()
    const userId = randomUUID()

    const company = await prisma.company.create({
      data: {
        id: companyId,
        name: 'Smoke Test Company',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`✅ Created company: ${company.name} (${company.id})`)

    // Create test user
    console.log('Creating test user...')
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: TEST_EMAIL,
        name: 'Smoke Test User',
        password: await bcrypt.hash(TEST_PASSWORD, 12),
        role: 'ADMIN',
        companyId: companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`✅ Created user: ${user.name} (${user.email})`)
    console.log(`\n✅ Test user created successfully!\n`)
    console.log(`📧 Email: ${TEST_EMAIL}`)
    console.log(`🔑 Password: ${TEST_PASSWORD}`)
    console.log(`🏢 Company ID: ${companyId}`)
    console.log(`\nYou can now run smoke tests with these credentials.`)

  } catch (error) {
    console.error('❌ Error creating test user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()
