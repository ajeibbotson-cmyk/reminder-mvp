#!/usr/bin/env tsx
/**
 * Auto-Send End-to-End Test
 * Tests the complete auto-send flow:
 * 1. Create test bucket config with auto-send enabled
 * 2. Set send time to current hour
 * 3. Call cron endpoint
 * 4. Verify campaigns created and emails sent
 * 5. Check last_auto_send_at updated
 * 6. Verify no duplicate sends
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TestResult {
  step: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  message: string
  data?: any
}

const results: TestResult[] = []

function log(message: string) {
  console.log(`\n${message}`)
}

function addResult(step: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, data?: any) {
  results.push({ step, status, message, data })
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️'
  console.log(`${icon} ${step}: ${message}`)
  if (data) {
    console.log(`   Data:`, JSON.stringify(data, null, 2))
  }
}

async function runTests() {
  try {
    log('🧪 Starting Auto-Send End-to-End Test')
    log('=' .repeat(60))

    // Step 1: Find a test company
    log('\n📋 Step 1: Finding test company')
    const company = await prisma.companies.findFirst({
      where: { is_active: true },
      include: {
        invoices: {
          where: { status: { not: 'PAID' } },
          take: 5
        }
      }
    })

    if (!company) {
      addResult('Find Company', 'FAIL', 'No active company found')
      return
    }

    if (company.invoices.length === 0) {
      addResult('Find Company', 'SKIP', 'Company has no unpaid invoices', { companyId: company.id })
      return
    }

    addResult('Find Company', 'PASS', `Found company with ${company.invoices.length} unpaid invoices`, {
      companyId: company.id,
      companyName: company.name,
      invoiceCount: company.invoices.length
    })

    // Step 2: Get current UAE time
    log('\n📋 Step 2: Getting current UAE time')
    const now = new Date()
    const uaeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
    const currentHour = uaeTime.getHours()
    const currentDay = uaeTime.getDay() // 0 = Sunday

    addResult('UAE Time', 'PASS', `Current UAE time: ${uaeTime.toISOString()}`, {
      hour: currentHour,
      day: currentDay,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay]
    })

    // Step 3: Create/update bucket config with auto-send enabled
    log('\n📋 Step 3: Creating test bucket config')
    const testBucketId = 'overdue_1_3' // Use bucket likely to have invoices

    const bucketConfig = await prisma.bucket_configs.upsert({
      where: {
        company_id_bucket_id: {
          company_id: company.id,
          bucket_id: testBucketId
        }
      },
      update: {
        auto_send_enabled: true,
        send_time_hour: currentHour, // Set to current hour for immediate send
        send_days_of_week: [currentDay], // Include today
        last_auto_send_at: null // Reset to allow sending
      },
      create: {
        company_id: company.id,
        bucket_id: testBucketId,
        auto_send_enabled: true,
        send_time_hour: currentHour,
        send_days_of_week: [currentDay],
        last_auto_send_at: null
      }
    })

    addResult('Bucket Config', 'PASS', 'Created/updated bucket config', {
      bucketId: testBucketId,
      autoSendEnabled: bucketConfig.auto_send_enabled,
      sendTimeHour: bucketConfig.send_time_hour,
      sendDays: bucketConfig.send_days_of_week
    })

    // Step 4: Check how many invoices are in this bucket
    log('\n📋 Step 4: Checking invoices in bucket')
    const bucketInvoices = await prisma.invoices.findMany({
      where: {
        company_id: company.id,
        status: { not: 'PAID' },
        due_date: {
          lte: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // At least 1 day overdue
          gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)  // Max 3 days overdue
        }
      }
    })

    addResult('Bucket Invoices', bucketInvoices.length > 0 ? 'PASS' : 'SKIP',
      `Found ${bucketInvoices.length} invoices in ${testBucketId} bucket`, {
        count: bucketInvoices.length,
        invoiceIds: bucketInvoices.map(i => i.id)
      })

    if (bucketInvoices.length === 0) {
      addResult('Auto-Send Test', 'SKIP', 'No invoices in bucket to send', null)
      return
    }

    // Step 5: Call the cron endpoint
    log('\n📋 Step 5: Calling auto-send cron endpoint')
    const cronSecret = process.env.CRON_SECRET || 'development-secret-change-in-production'

    try {
      const response = await fetch('http://localhost:3000/api/cron/auto-send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()

      if (!response.ok) {
        addResult('Cron Endpoint', 'FAIL', `HTTP ${response.status}`, responseData)
        return
      }

      addResult('Cron Endpoint', 'PASS', 'Auto-send job executed', responseData)

      // Step 6: Verify results
      log('\n📋 Step 6: Verifying auto-send results')

      if (responseData.details.emailsSent > 0) {
        addResult('Emails Sent', 'PASS', `Sent ${responseData.details.emailsSent} emails`, {
          bucketsProcessed: responseData.details.bucketsProcessed,
          campaignsCreated: responseData.details.campaignsCreated
        })
      } else {
        addResult('Emails Sent', 'FAIL', 'No emails sent', responseData.details)
      }

      // Step 7: Check last_auto_send_at updated
      log('\n📋 Step 7: Verifying last send time updated')
      const updatedConfig = await prisma.bucket_configs.findUnique({
        where: {
          company_id_bucket_id: {
            company_id: company.id,
            bucket_id: testBucketId
          }
        }
      })

      if (updatedConfig?.last_auto_send_at) {
        const timeDiff = Date.now() - updatedConfig.last_auto_send_at.getTime()
        if (timeDiff < 60000) { // Within last minute
          addResult('Last Send Time', 'PASS', 'Updated recently', {
            lastSendAt: updatedConfig.last_auto_send_at.toISOString(),
            secondsAgo: Math.round(timeDiff / 1000)
          })
        } else {
          addResult('Last Send Time', 'FAIL', 'Not updated recently', {
            lastSendAt: updatedConfig.last_auto_send_at.toISOString(),
            secondsAgo: Math.round(timeDiff / 1000)
          })
        }
      } else {
        addResult('Last Send Time', 'FAIL', 'Not updated', null)
      }

      // Step 8: Test duplicate send prevention
      log('\n📋 Step 8: Testing duplicate send prevention')
      const response2 = await fetch('http://localhost:3000/api/cron/auto-send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        }
      })

      const responseData2 = await response2.json()

      if (responseData2.details.emailsSent === 0) {
        addResult('Duplicate Prevention', 'PASS', 'No duplicate emails sent', {
          bucketsProcessed: responseData2.details.bucketsProcessed,
          emailsSent: responseData2.details.emailsSent
        })
      } else {
        addResult('Duplicate Prevention', 'FAIL', `Duplicate emails sent: ${responseData2.details.emailsSent}`, responseData2.details)
      }

    } catch (error) {
      addResult('Cron Endpoint', 'FAIL', `Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`, null)
    }

  } catch (error) {
    console.error('\n❌ Test Suite Error:', error)
    addResult('Test Suite', 'FAIL', error instanceof Error ? error.message : 'Unknown error', null)
  } finally {
    await prisma.$disconnect()
  }
}

async function printSummary() {
  log('\n' + '='.repeat(60))
  log('📊 TEST SUMMARY')
  log('='.repeat(60))

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length
  const total = results.length

  console.log(`\n✅ Passed: ${passed}/${total}`)
  console.log(`❌ Failed: ${failed}/${total}`)
  console.log(`⏭️  Skipped: ${skipped}/${total}`)

  if (failed > 0) {
    log('\n❌ FAILED TESTS:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.step}: ${r.message}`)
    })
  }

  if (skipped > 0) {
    log('\n⏭️  SKIPPED TESTS:')
    results.filter(r => r.status === 'SKIP').forEach(r => {
      console.log(`  - ${r.step}: ${r.message}`)
    })
  }

  log('\n' + '='.repeat(60))

  if (failed === 0 && passed > 0) {
    log('✅ ALL TESTS PASSED!')
  } else if (failed > 0) {
    log('❌ SOME TESTS FAILED - Review above for details')
  } else {
    log('⏭️  NO TESTS RUN - Check test conditions')
  }

  log('='.repeat(60) + '\n')
}

// Run tests
runTests()
  .then(() => printSummary())
  .then(() => process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
