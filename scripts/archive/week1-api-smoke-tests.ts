#!/usr/bin/env tsx
/**
 * Week 1 Day 1-2: API Smoke Tests
 *
 * Purpose: Validate all critical API endpoints before frontend integration
 *
 * Tests:
 * - Invoice APIs (create, list, get, import CSV)
 * - Campaign APIs (create, send, status)
 * - Payment APIs (create, list)
 * - Customer APIs (create, list, update)
 * - Analytics APIs (dashboard stats, collection rate)
 *
 * Success Criteria: 80%+ endpoints returning 200 OK with valid data
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

// Use DIRECT_URL for reliable connection (pooler may have issues)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
// Use test user created by scripts/create-test-user-for-smoke-tests.ts
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'smoke-test@example.com'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'SmokeTest123!'

// Test results tracking
interface TestResult {
  endpoint: string
  method: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  statusCode?: number
  error?: string
  duration?: number
}

const results: TestResult[] = []

// Helper: Add test result
function addResult(result: TestResult) {
  results.push(result)
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️'
  const duration = result.duration ? ` (${result.duration}ms)` : ''
  console.log(`${icon} ${result.method} ${result.endpoint}${duration}`)
  if (result.error) {
    console.log(`   Error: ${result.error}`)
  }
}

// Helper: Create test user and company
async function setupTestUser(): Promise<{ userId: string; companyId: string; authCookie: string } | null> {
  try {
    console.log('\n🔧 Setting up test user...')

    // Check if test user exists
    let user = await prisma.users.findUnique({
      where: { email: TEST_EMAIL },
      include: { companies: true }
    })

    if (!user) {
      console.error(`❌ No user found with email: ${TEST_EMAIL}`)
      console.error(`   Please set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables`)
      console.error(`   Or ensure user ${TEST_EMAIL} exists in database`)
      return null
    }

    console.log(`✅ Found existing test user: ${TEST_EMAIL}`)
    console.log(`   Company ID: ${user.company_id}`)

    // Get authentication cookie
    const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        redirect: false
      })
    })

    if (!loginResponse.ok) {
      // Try to reset password and login again
      console.log('⚠️  Login failed, resetting password...')
      await prisma.users.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(TEST_PASSWORD, 12) }
      })

      const retryLogin = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          redirect: false
        })
      })

      if (!retryLogin.ok) {
        throw new Error('Failed to authenticate test user')
      }
    }

    const setCookie = loginResponse.headers.get('set-cookie')
    if (!setCookie) {
      throw new Error('No auth cookie returned')
    }

    return {
      userId: user.id,
      companyId: user.company_id,
      authCookie: setCookie
    }

  } catch (error) {
    console.error('❌ Failed to setup test user:', error)
    return null
  }
}

// Helper: Make authenticated request
async function authenticatedRequest(
  endpoint: string,
  method: string,
  authCookie: string,
  body?: any
): Promise<{ ok: boolean; status: number; data?: any; error?: string; duration: number }> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const duration = Date.now() - startTime
    let data

    try {
      data = await response.json()
    } catch {
      data = null
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      duration
    }

  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    }
  }
}

// Test Suite: Invoice APIs
async function testInvoiceAPIs(authCookie: string, companyId: string) {
  console.log('\n\n📋 Testing Invoice APIs...\n')

  // 1. Create Invoice
  const invoiceData = {
    invoice_number: `SMOKE-${Date.now()}`,
    customer_name: 'Test Customer',
    customer_email: 'customer@test.com',
    amount: 1000.00,
    currency: 'AED',
    due_date: '2025-12-31',
    items: [
      { description: 'Test Item', quantity: 1, unit_price: 1000.00 }
    ]
  }

  const createInvoice = await authenticatedRequest('/api/invoices', 'POST', authCookie, invoiceData)

  addResult({
    endpoint: '/api/invoices',
    method: 'POST',
    status: createInvoice.ok ? 'PASS' : 'FAIL',
    statusCode: createInvoice.status,
    error: createInvoice.error,
    duration: createInvoice.duration
  })

  let invoiceId: string | null = null
  if (createInvoice.ok && createInvoice.data?.id) {
    invoiceId = createInvoice.data.id
  }

  // 2. List Invoices
  const listInvoices = await authenticatedRequest('/api/invoices', 'GET', authCookie)

  addResult({
    endpoint: '/api/invoices',
    method: 'GET',
    status: listInvoices.ok ? 'PASS' : 'FAIL',
    statusCode: listInvoices.status,
    error: listInvoices.error,
    duration: listInvoices.duration
  })

  // 3. Get Single Invoice
  if (invoiceId) {
    const getInvoice = await authenticatedRequest(`/api/invoices/${invoiceId}`, 'GET', authCookie)

    addResult({
      endpoint: `/api/invoices/[id]`,
      method: 'GET',
      status: getInvoice.ok ? 'PASS' : 'FAIL',
      statusCode: getInvoice.status,
      error: getInvoice.error,
      duration: getInvoice.duration
    })
  } else {
    addResult({
      endpoint: `/api/invoices/[id]`,
      method: 'GET',
      status: 'SKIP',
      error: 'No invoice created to test with'
    })
  }

  // 4. CSV Import (simple test)
  const csvData = `invoice_number,customer_name,customer_email,amount,due_date,currency
SMOKE-CSV-${Date.now()},CSV Customer,csv@test.com,500.00,2025-12-31,AED`

  const importCSV = await fetch(`${BASE_URL}/api/invoices/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'Cookie': authCookie
    },
    body: csvData
  })

  const importDuration = Date.now()
  addResult({
    endpoint: '/api/invoices/import',
    method: 'POST',
    status: importCSV.ok ? 'PASS' : 'FAIL',
    statusCode: importCSV.status,
    error: importCSV.ok ? undefined : 'CSV import failed',
    duration: importDuration
  })

  return invoiceId
}

// Test Suite: Campaign APIs
async function testCampaignAPIs(authCookie: string, invoiceId: string | null) {
  console.log('\n\n📧 Testing Campaign APIs...\n')

  if (!invoiceId) {
    addResult({
      endpoint: '/api/campaigns',
      method: 'POST',
      status: 'SKIP',
      error: 'No invoice available to create campaign'
    })
    return null
  }

  // 1. Create Campaign
  const campaignData = {
    name: `Smoke Test Campaign ${Date.now()}`,
    invoice_ids: [invoiceId],
    subject: 'Test Reminder',
    message: 'This is a test message for {customer_name}',
    attach_invoice_pdf: false
  }

  const createCampaign = await authenticatedRequest('/api/campaigns', 'POST', authCookie, campaignData)

  addResult({
    endpoint: '/api/campaigns',
    method: 'POST',
    status: createCampaign.ok ? 'PASS' : 'FAIL',
    statusCode: createCampaign.status,
    error: createCampaign.error,
    duration: createCampaign.duration
  })

  let campaignId: string | null = null
  if (createCampaign.ok && createCampaign.data?.id) {
    campaignId = createCampaign.data.id
  }

  // 2. List Campaigns
  const listCampaigns = await authenticatedRequest('/api/campaigns', 'GET', authCookie)

  addResult({
    endpoint: '/api/campaigns',
    method: 'GET',
    status: listCampaigns.ok ? 'PASS' : 'FAIL',
    statusCode: listCampaigns.status,
    error: listCampaigns.error,
    duration: listCampaigns.duration
  })

  // 3. Get Campaign Status
  if (campaignId) {
    const getCampaign = await authenticatedRequest(`/api/campaigns/${campaignId}`, 'GET', authCookie)

    addResult({
      endpoint: `/api/campaigns/[id]`,
      method: 'GET',
      status: getCampaign.ok ? 'PASS' : 'FAIL',
      statusCode: getCampaign.status,
      error: getCampaign.error,
      duration: getCampaign.duration
    })

    // 4. Send Campaign (commented out to avoid actually sending emails during test)
    // Uncomment when you want to test actual sending
    /*
    const sendCampaign = await authenticatedRequest(`/api/campaigns/${campaignId}/send`, 'POST', authCookie)

    addResult({
      endpoint: `/api/campaigns/[id]/send`,
      method: 'POST',
      status: sendCampaign.ok ? 'PASS' : 'FAIL',
      statusCode: sendCampaign.status,
      error: sendCampaign.error,
      duration: sendCampaign.duration
    })
    */

    addResult({
      endpoint: `/api/campaigns/[id]/send`,
      method: 'POST',
      status: 'SKIP',
      error: 'Skipped to avoid sending real emails (uncomment to test)'
    })
  }

  return campaignId
}

// Test Suite: Payment APIs
async function testPaymentAPIs(authCookie: string, invoiceId: string | null) {
  console.log('\n\n💰 Testing Payment APIs...\n')

  if (!invoiceId) {
    addResult({
      endpoint: '/api/payments',
      method: 'POST',
      status: 'SKIP',
      error: 'No invoice available to record payment'
    })
    return
  }

  // 1. Record Payment
  const paymentData = {
    invoice_id: invoiceId,
    amount: 1000.00,
    payment_method: 'bank_transfer',
    payment_date: '2025-11-01',
    reference: `SMOKE-PAY-${Date.now()}`
  }

  const createPayment = await authenticatedRequest('/api/payments', 'POST', authCookie, paymentData)

  addResult({
    endpoint: '/api/payments',
    method: 'POST',
    status: createPayment.ok ? 'PASS' : 'FAIL',
    statusCode: createPayment.status,
    error: createPayment.error,
    duration: createPayment.duration
  })

  // 2. List Payments
  const listPayments = await authenticatedRequest('/api/payments', 'GET', authCookie)

  addResult({
    endpoint: '/api/payments',
    method: 'GET',
    status: listPayments.ok ? 'PASS' : 'FAIL',
    statusCode: listPayments.status,
    error: listPayments.error,
    duration: listPayments.duration
  })
}

// Test Suite: Customer APIs
async function testCustomerAPIs(authCookie: string) {
  console.log('\n\n👥 Testing Customer APIs...\n')

  // 1. Create Customer
  const customerData = {
    name: `Smoke Test Customer ${Date.now()}`,
    email: `smoke-customer-${Date.now()}@test.com`,
    payment_terms_days: 30
  }

  const createCustomer = await authenticatedRequest('/api/customers', 'POST', authCookie, customerData)

  addResult({
    endpoint: '/api/customers',
    method: 'POST',
    status: createCustomer.ok ? 'PASS' : 'FAIL',
    statusCode: createCustomer.status,
    error: createCustomer.error,
    duration: createCustomer.duration
  })

  let customerId: string | null = null
  if (createCustomer.ok && createCustomer.data?.id) {
    customerId = createCustomer.data.id
  }

  // 2. List Customers
  const listCustomers = await authenticatedRequest('/api/customers', 'GET', authCookie)

  addResult({
    endpoint: '/api/customers',
    method: 'GET',
    status: listCustomers.ok ? 'PASS' : 'FAIL',
    statusCode: listCustomers.status,
    error: listCustomers.error,
    duration: listCustomers.duration
  })

  // 3. Update Customer
  if (customerId) {
    const updateCustomer = await authenticatedRequest(
      `/api/customers/${customerId}`,
      'PUT',
      authCookie,
      { payment_terms_days: 45 }
    )

    addResult({
      endpoint: `/api/customers/[id]`,
      method: 'PUT',
      status: updateCustomer.ok ? 'PASS' : 'FAIL',
      statusCode: updateCustomer.status,
      error: updateCustomer.error,
      duration: updateCustomer.duration
    })
  } else {
    addResult({
      endpoint: `/api/customers/[id]`,
      method: 'PUT',
      status: 'SKIP',
      error: 'No customer created to test with'
    })
  }
}

// Test Suite: Analytics APIs
async function testAnalyticsAPIs(authCookie: string) {
  console.log('\n\n📊 Testing Analytics APIs...\n')

  // 1. Dashboard Stats
  const dashboardStats = await authenticatedRequest('/api/analytics/dashboard', 'GET', authCookie)

  addResult({
    endpoint: '/api/analytics/dashboard',
    method: 'GET',
    status: dashboardStats.ok ? 'PASS' : 'FAIL',
    statusCode: dashboardStats.status,
    error: dashboardStats.error,
    duration: dashboardStats.duration
  })

  // 2. Collection Rate
  const collectionRate = await authenticatedRequest('/api/analytics/collection-rate', 'GET', authCookie)

  addResult({
    endpoint: '/api/analytics/collection-rate',
    method: 'GET',
    status: collectionRate.ok ? 'PASS' : 'FAIL',
    statusCode: collectionRate.status,
    error: collectionRate.error,
    duration: collectionRate.duration
  })
}

// Generate Summary Report
function generateSummary() {
  console.log('\n\n═══════════════════════════════════════════════')
  console.log('   SMOKE TEST SUMMARY')
  console.log('═══════════════════════════════════════════════\n')

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length
  const total = results.length

  console.log(`Total Tests: ${total}`)
  console.log(`✅ Passed: ${passed} (${Math.round(passed / total * 100)}%)`)
  console.log(`❌ Failed: ${failed} (${Math.round(failed / total * 100)}%)`)
  console.log(`⏭️  Skipped: ${skipped} (${Math.round(skipped / total * 100)}%)`)

  const successRate = Math.round(passed / (total - skipped) * 100)
  console.log(`\n📊 Success Rate: ${successRate}% (excluding skipped)`)

  if (successRate >= 80) {
    console.log('\n🎉 SUCCESS: 80%+ endpoints working - Ready for frontend integration!')
  } else if (successRate >= 60) {
    console.log('\n⚠️  WARNING: 60-79% endpoints working - Fix critical issues before proceeding')
  } else {
    console.log('\n🚨 CRITICAL: <60% endpoints working - Major backend issues need fixing')
  }

  // List failed tests
  const failedTests = results.filter(r => r.status === 'FAIL')
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:\n')
    failedTests.forEach(test => {
      console.log(`   ${test.method} ${test.endpoint}`)
      console.log(`   Status Code: ${test.statusCode}`)
      console.log(`   Error: ${test.error}`)
      console.log('')
    })

    console.log('📝 Next Steps:')
    console.log('   1. Review failed endpoints above')
    console.log('   2. Check API route implementations')
    console.log('   3. Verify database schema matches API expectations')
    console.log('   4. Create GitHub issues for each failing endpoint')
    console.log('   5. Re-run smoke tests after fixes')
  }

  console.log('\n═══════════════════════════════════════════════\n')
}

// Cleanup: Remove test data
async function cleanup(companyId: string) {
  try {
    console.log('🧹 Cleaning up test data...')

    // Delete test data (optional - comment out if you want to keep data for inspection)
    await prisma.payments.deleteMany({ where: { company_id: companyId } })
    await prisma.email_logs.deleteMany({ where: { company_id: companyId } })
    await prisma.campaigns.deleteMany({ where: { company_id: companyId } })
    await prisma.invoices.deleteMany({ where: { company_id: companyId } })
    await prisma.customers.deleteMany({ where: { company_id: companyId } })

    console.log('✅ Cleanup complete')
  } catch (error) {
    console.error('⚠️  Cleanup failed (non-critical):', error)
  }
}

// Main execution
async function runSmokeTests() {
  console.log('═══════════════════════════════════════════════')
  console.log('   REMINDER MVP - API SMOKE TESTS')
  console.log('   Week 1 Discovery Sprint')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log('═══════════════════════════════════════════════')

  try {
    // Setup
    const auth = await setupTestUser()
    if (!auth) {
      console.error('\n❌ CRITICAL: Failed to setup test user - cannot proceed with tests')
      process.exit(1)
    }

    const { userId, companyId, authCookie } = auth

    // Run test suites
    const invoiceId = await testInvoiceAPIs(authCookie, companyId)
    const campaignId = await testCampaignAPIs(authCookie, invoiceId)
    await testPaymentAPIs(authCookie, invoiceId)
    await testCustomerAPIs(authCookie)
    await testAnalyticsAPIs(authCookie)

    // Generate summary
    generateSummary()

    // Cleanup (optional)
    // await cleanup(companyId)

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Execute
runSmokeTests()
