#!/usr/bin/env tsx
/**
 * Seed Bucket Configurations
 * Creates default bucket configs for all companies
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BUCKET_IDS = [
  'not_due',
  'overdue_1_3',
  'overdue_4_7',
  'overdue_8_14',
  'overdue_15_30',
  'overdue_30_plus'
]

async function seedBucketConfigs() {
  console.log('🌱 Seeding bucket configurations...\n')

  try {
    // Get all companies
    const companies = await prisma.companies.findMany({
      select: { id: true, name: true }
    })

    console.log(`Found ${companies.length} companies\n`)

    for (const company of companies) {
      console.log(`📊 Creating configs for: ${company.name}`)

      for (const bucketId of BUCKET_IDS) {
        // Check if config already exists
        const existing = await prisma.bucket_configs.findUnique({
          where: {
            company_id_bucket_id: {
              company_id: company.id,
              bucket_id: bucketId
            }
          }
        })

        if (existing) {
          console.log(`   ⏭️  ${bucketId} - already exists`)
          continue
        }

        // Create default config
        await prisma.bucket_configs.create({
          data: {
            company_id: company.id,
            bucket_id: bucketId,
            auto_send_enabled: false, // Default: manual send only
            send_time_hour: 9, // 9 AM UAE time
            send_days_of_week: [0, 1, 2, 3, 4] // Sunday-Thursday
          }
        })

        console.log(`   ✅ ${bucketId} - created`)
      }

      console.log()
    }

    console.log('✨ Bucket configuration seeding complete!\n')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedBucketConfigs().catch((error) => {
  console.error(error)
  process.exit(1)
})
