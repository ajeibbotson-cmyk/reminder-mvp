/**
 * Create a test user via Playwright browser automation
 */

import { chromium } from 'playwright'

async function createTestUser() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    console.log('🌐 Navigating to signup page...')
    await page.goto('http://localhost:3002/en/auth/signup')
    await page.waitForLoadState('networkidle')

    console.log('📝 Filling signup form...')
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', 'test@demo.com')
    await page.fill('input[name="password"]', 'Test123!')
    await page.fill('input[name="company"]', 'Demo Company')

    console.log('✅ Submitting signup...')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard or success
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    console.log('✅ Test user created successfully!')
    console.log('   Email: test@demo.com')
    console.log('   Password: Test123!')

    await page.waitForTimeout(2000)
  } catch (error) {
    console.error('❌ Failed:', error)
    await page.screenshot({ path: '/tmp/signup-error.png' })
  } finally {
    await browser.close()
  }
}

createTestUser()
  .catch(console.error)
  .finally(() => process.exit(0))
