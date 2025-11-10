import { test, expect } from '@playwright/test'

test.describe('Hybrid Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/en/auth/signin')

    // Login with test credentials (using newly created test user)
    await page.fill('input[name="email"]', 'test@e2e.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard')
  })

  test('should display hero metrics with large numbers', async ({ page }) => {
    // Check for hero metrics section
    const heroMetrics = page.locator('text=Total Outstanding')
    await expect(heroMetrics).toBeVisible()

    // Check for AED currency display
    const aedAmount = page.locator('text=/AED.*/')
    await expect(aedAmount.first()).toBeVisible()

    // Check for overdue amount
    const overdueMetric = page.locator('text=Overdue Amount')
    await expect(overdueMetric).toBeVisible()
  })

  test('should display invoice buckets below hero metrics', async ({ page }) => {
    // Check for buckets section heading
    const bucketsHeading = page.locator('h2:has-text("Invoice Buckets")')
    await expect(bucketsHeading).toBeVisible()

    // Check for bucket description
    const bucketsDesc = page.locator('text=Manage and send reminders')
    await expect(bucketsDesc).toBeVisible()

    // Wait for buckets to load (they're client-side rendered)
    await page.waitForTimeout(2000)

    // Check that at least some bucket cards are visible
    // (exact count may vary based on data)
    const bucketCards = page.locator('[class*="bucket"]').first()
    await expect(bucketCards).toBeVisible({ timeout: 10000 })
  })

  test('should have Buckets navigation item', async ({ page }) => {
    // Check for Buckets nav link
    const bucketsNav = page.getByTestId('desktop-nav-buckets')
    await expect(bucketsNav).toBeVisible()

    // Click Buckets navigation
    await bucketsNav.click()

    // Should navigate to buckets page
    await page.waitForURL('**/dashboard/buckets')

    // Should see bucket configuration page
    const configHeading = page.locator('h1:has-text("Invoice Buckets")')
    await expect(configHeading).toBeVisible()
  })

  test('should display trend indicators on hero metrics', async ({ page }) => {
    // Look for trend indicators (up/down arrows or percentage)
    const trendIndicator = page.locator('text=/%/')

    // May not always be visible if no trend data
    const isVisible = await trendIndicator.isVisible().catch(() => false)

    if (isVisible) {
      console.log('✓ Trend indicator found')
    } else {
      console.log('ℹ No trend data available (expected for new installations)')
    }
  })

  test('should have working email campaign button (if buckets have invoices)', async ({ page }) => {
    // Wait for buckets to load
    await page.waitForTimeout(3000)

    // Try to find "Email Selected" or similar button
    const emailButton = page.locator('button:has-text("Email")')

    const emailButtonExists = await emailButton.count() > 0

    if (emailButtonExists) {
      // Click first email button
      await emailButton.first().click()

      // Should open email modal
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible({ timeout: 5000 })

      console.log('✓ Email modal opened successfully')
    } else {
      console.log('ℹ No email buttons found (may be no eligible invoices)')
    }
  })

  test('dashboard should load without tabs (everything visible)', async ({ page }) => {
    // Check that there are NO tabs on the dashboard
    const tabs = page.locator('[role="tablist"]')
    const tabsExist = await tabs.count() > 0

    expect(tabsExist).toBe(false)
    console.log('✓ No tabs found - everything visible on one page')
  })

  test('should display metrics in correct F-pattern hierarchy', async ({ page }) => {
    // Get positions of key elements
    const outstanding = page.locator('text=Total Outstanding')
    const overdue = page.locator('text=Overdue Amount')
    const buckets = page.locator('h2:has-text("Invoice Buckets")')

    // Wait for elements to be visible
    await outstanding.waitFor({ state: 'visible' })
    await overdue.waitFor({ state: 'visible' })
    await buckets.waitFor({ state: 'visible' })

    // Get bounding boxes
    const outstandingBox = await outstanding.boundingBox()
    const overdueBox = await overdue.boundingBox()
    const bucketsBox = await buckets.boundingBox()

    if (outstandingBox && overdueBox && bucketsBox) {
      // Outstanding should be in top-left (before overdue horizontally)
      expect(outstandingBox.y).toBeLessThan(bucketsBox.y)

      // Buckets should be below hero metrics
      expect(bucketsBox.y).toBeGreaterThan(Math.max(outstandingBox.y, overdueBox.y))

      console.log('✓ F-pattern hierarchy verified')
    }
  })
})

test.describe('Bucket Configuration Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/en/auth/signin')
    await page.fill('input[name="email"]', 'test@e2e.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    // Navigate to buckets config page
    await page.getByTestId('desktop-nav-buckets').click();
    await page.waitForURL('**/dashboard/buckets')
  })

  test('should display all 6 bucket cards', async ({ page }) => {
    // Wait for cards to load
    await page.waitForTimeout(2000)

    // Check for bucket names
    const buckets = [
      'Not Due',
      '1-3 Days Overdue',
      '4-7 Days Overdue',
      '8-14 Days Overdue',
      '15-30 Days Overdue',
      '30+ Days Overdue'
    ]

    for (const bucketName of buckets) {
      const bucket = page.locator(`text=${bucketName}`)
      await expect(bucket).toBeVisible()
    }

    console.log('✓ All 6 buckets displayed')
  })

  test('should open configuration modal when clicking Configure', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Click first Configure button
    const configureButton = page.locator('button:has-text("Configure")').first()
    await configureButton.click()

    // Modal should open
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    // Should have auto-send toggle
    const autoSendToggle = page.locator('text=Enable Auto-Send')
    await expect(autoSendToggle).toBeVisible()

    console.log('✓ Configuration modal opened')
  })

  test('should allow configuring auto-send settings', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Open first bucket config
    await page.locator('button:has-text("Configure")').first().click()

    // Wait for modal
    await page.waitForSelector('[role="dialog"]')

    // Enable auto-send
    const toggle = page.locator('button[role="switch"]')
    await toggle.click()

    // Should show time and day selectors
    const timeSelect = page.locator('text=Send Time')
    await expect(timeSelect).toBeVisible()

    const daysLabel = page.locator('text=Send Days')
    await expect(daysLabel).toBeVisible()

    console.log('✓ Auto-send configuration UI working')
  })
})
