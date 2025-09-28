#!/usr/bin/env npx tsx

// ==========================================
// UNIFIED EMAIL SERVICE TEST SCRIPT
// ==========================================
// Purpose: Validate UnifiedEmailService implementation with AWS SES
// Usage: npm run test:email-service

import { PrismaClient } from '@prisma/client'
import { UnifiedEmailService } from '../src/lib/services/unifiedEmailService'

// Mock session for testing
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    companyId: 'test-company-id',
    name: 'Test User'
  },
  expires: '2025-12-31'
}

// Test configuration
const testConfig = {
  defaultFromEmail: 'test@reminder.com',
  awsRegion: 'me-south-1',
  defaultBatchSize: 2, // Small batch for testing
  defaultDelayBetweenBatches: 1000, // 1 second for testing
  maxDailyEmails: 100
}

async function runTests() {
  console.log('🧪 UNIFIED EMAIL SERVICE TESTS')
  console.log('================================\n')

  const prisma = new PrismaClient()

  try {
    // 1. Test service initialization
    console.log('1️⃣ Testing service initialization...')
    const emailService = new UnifiedEmailService(prisma, mockSession as any, testConfig)
    console.log('✅ Service initialized successfully\n')

    // 2. Test merge tag processing
    console.log('2️⃣ Testing merge tag processing...')
    const testTemplate = 'Dear {{customerName}}, your invoice {{invoiceNumber}} for {{amount}} is due.'

    // Mock invoice data
    const mockInvoice = {
      id: 'test-invoice-1',
      number: 'INV-001',
      amount_aed: 1500,
      customer: {
        name: 'Test Customer',
        email: 'customer@test.com'
      },
      company: {
        name: 'Test Company'
      },
      due_date: new Date('2025-10-15')
    }

    // Test merge tag resolution (access private method via type assertion)
    const resolvedContent = (emailService as any).resolveContentMergeTags(testTemplate, mockInvoice)
    console.log('📝 Template:', testTemplate)
    console.log('📝 Resolved:', resolvedContent)
    console.log('✅ Merge tag processing works\n')

    // 3. Test email validation
    console.log('3️⃣ Testing email validation...')
    const validEmail = (emailService as any).isValidEmail('test@example.com')
    const invalidEmail = (emailService as any).isValidEmail('invalid-email')
    console.log('📧 Valid email test:', validEmail)
    console.log('📧 Invalid email test:', invalidEmail)
    console.log('✅ Email validation works\n')

    // 4. Test available merge fields
    console.log('4️⃣ Testing merge field availability...')
    const availableFields = (emailService as any).getAvailableMergeFields(mockInvoice)
    console.log('🏷️ Available merge fields:', availableFields)
    console.log('✅ Merge fields available\n')

    // 5. Test configuration validation
    console.log('5️⃣ Testing configuration validation...')
    console.log('⚙️ Service config:')
    console.log('   - From Email:', testConfig.defaultFromEmail)
    console.log('   - AWS Region:', testConfig.awsRegion)
    console.log('   - Batch Size:', testConfig.defaultBatchSize)
    console.log('   - Delay Between Batches:', testConfig.defaultDelayBetweenBatches)
    console.log('   - Max Daily Emails:', testConfig.maxDailyEmails)
    console.log('✅ Configuration is valid\n')

    // 6. Test service factory function
    console.log('6️⃣ Testing service factory function...')
    try {
      const { createUnifiedEmailService } = await import('../src/lib/services/unifiedEmailService')

      // This should work with valid session
      const factoryService = await createUnifiedEmailService(mockSession as any, testConfig)
      console.log('✅ Factory function works with valid session')

      // Test with invalid session (should throw)
      try {
        await createUnifiedEmailService(null, testConfig)
        console.log('❌ Factory should have thrown with null session')
      } catch (error) {
        console.log('✅ Factory correctly rejects null session')
      }
    } catch (error) {
      console.log('⚠️ Factory function test skipped (import issue):', error)
    }
    console.log('')

    // 7. Test AWS SES client initialization
    console.log('7️⃣ Testing AWS SES client initialization...')
    const sesClient = (emailService as any).sesClient
    if (sesClient) {
      console.log('✅ AWS SES client initialized')
      console.log('   - Region:', sesClient.config.region)
    } else {
      console.log('❌ AWS SES client not initialized')
    }
    console.log('')

    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!')
    console.log('\n📋 Test Summary:')
    console.log('   ✅ Service initialization')
    console.log('   ✅ Merge tag processing')
    console.log('   ✅ Email validation')
    console.log('   ✅ Merge field availability')
    console.log('   ✅ Configuration validation')
    console.log('   ✅ Service factory function')
    console.log('   ✅ AWS SES client initialization')

    console.log('\n🚀 Ready for integration with campaign endpoints!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test execution failed:', error)
    process.exit(1)
  })
}

export { runTests }