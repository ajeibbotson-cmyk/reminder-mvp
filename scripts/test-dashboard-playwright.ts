/**
 * Test dashboard invoice display with Playwright
 * Full browser test including login and API calls
 */

import { chromium } from 'playwright'

async function testDashboard() {
  console.log('🚀 Starting Playwright Dashboard Test\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Step 1: Navigate to login page
    console.log('📍 Step 1: Navigate to login page')
    await page.goto('http://localhost:3000/en/auth/signin')
    await page.waitForLoadState('networkidle')
    console.log('✓ Login page loaded\n')

    // Step 2: Fill in credentials
    console.log('📝 Step 2: Enter credentials')
    await page.fill('input[name="email"]', 'admin@testcompany.ae')
    await page.fill('input[name="password"]', 'Test123!')
    console.log('✓ Credentials entered\n')

    // Step 3: Submit login form
    console.log('🔐 Step 3: Submit login')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    console.log('✓ Login successful, redirected to dashboard\n')

    // Step 4: Wait for invoices page to load
    console.log('📊 Step 4: Navigate to invoices')
    await page.goto('http://localhost:3000/en/dashboard/invoices')
    await page.waitForLoadState('networkidle')
    console.log('✓ Invoices page loaded\n')

    // Step 5: Intercept API calls
    console.log('🔍 Step 5: Check API responses')
    const apiResponses: any[] = []

    page.on('response', async (response) => {
      if (response.url().includes('/api/invoices')) {
        const status = response.status()
        console.log(`  API: ${response.url()} - Status: ${status}`)

        if (status === 200) {
          try {
            const data = await response.json()
            apiResponses.push(data)
            console.log(`  ✓ Response: ${data.data?.invoices?.length || 0} invoices`)
          } catch (e) {
            console.log(`  ✗ Failed to parse JSON`)
          }
        } else {
          const text = await response.text()
          console.log(`  ✗ Error: ${text}`)
        }
      }
    })

    // Trigger a page reload to capture API calls
    await page.reload({ waitUntil: 'networkidle' })

    // Step 6: Check page content
    console.log('\n📄 Step 6: Check page content')

    await page.waitForTimeout(2000) // Give time for data to render

    const pageText = await page.textContent('body')

    if (pageText?.includes('No invoices yet')) {
      console.log('❌ Page shows "No invoices yet"')
    } else if (pageText?.includes('Loading')) {
      console.log('⏳ Page shows "Loading..."')
    } else {
      console.log('✓ Page has content (not showing empty state)')
    }

    // Check for invoice table
    const hasTable = await page.locator('table').count()
    console.log(`  Tables found: ${hasTable}`)

    const hasRows = await page.locator('table tbody tr').count()
    console.log(`  Table rows: ${hasRows}`)

    // Step 7: Take screenshot
    console.log('\n📸 Step 7: Taking screenshot')
    await page.screenshot({ path: '/tmp/dashboard-test.png', fullPage: true })
    console.log('✓ Screenshot saved to /tmp/dashboard-test.png\n')

    // Step 8: Summary
    console.log('📊 SUMMARY:')
    console.log(`  API Calls: ${apiResponses.length}`)
    if (apiResponses.length > 0) {
      const lastResponse = apiResponses[apiResponses.length - 1]
      console.log(`  Invoices Returned: ${lastResponse.data?.invoices?.length || 0}`)
      console.log(`  Total Count: ${lastResponse.data?.pagination?.totalCount || 0}`)
      console.log(`  Success: ${lastResponse.success}`)
    }
    console.log(`  Table Rows Rendered: ${hasRows}`)

    if (hasRows > 0) {
      console.log('\n✅ SUCCESS: Dashboard displaying invoices correctly!')
    } else if (apiResponses.length > 0 && apiResponses[0].data?.invoices?.length > 0) {
      console.log('\n⚠️ ISSUE: API returns data but not rendering in table')
    } else {
      console.log('\n❌ FAILURE: No data returned from API or rendering failed')
    }

    // Keep browser open for inspection
    console.log('\n⏸️  Browser kept open for inspection (Ctrl+C to close)')
    await page.waitForTimeout(60000)
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    await page.screenshot({ path: '/tmp/dashboard-error.png', fullPage: true })
    console.log('📸 Error screenshot saved to /tmp/dashboard-error.png')
  } finally {
    await browser.close()
  }
}

testDashboard()
  .catch(console.error)
  .finally(() => process.exit(0))
