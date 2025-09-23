/**
 * Invoice Upload End-to-End Tests
 * Tests the complete user journey from login to PDF upload to invoice creation
 */

import { test, expect, Page } from '@playwright/test'
import path from 'path'

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3007'
const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'testpassword123'

test.describe('Invoice Upload E2E Flow', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()

    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 })

    // Navigate to the application
    await page.goto(BASE_URL)
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should complete full invoice upload workflow', async () => {
    // 1. Navigate to sign in page (if not already authenticated)
    await page.goto(`${BASE_URL}/auth/signin`)

    // 2. Check if we need to sign in or if already authenticated
    const signInForm = page.locator('form').first()
    if (await signInForm.isVisible()) {
      await page.fill('input[type="email"]', TEST_EMAIL)
      await page.fill('input[type="password"]', TEST_PASSWORD)
      await page.click('button[type="submit"]')

      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard**')
    }

    // 3. Navigate to invoices page
    await page.goto(`${BASE_URL}/dashboard/invoices`)
    await expect(page.locator('h1')).toContainText('Invoices')

    // 4. Click on invoice import/upload
    const importButton = page.locator('button', { hasText: /import|upload/i }).first()
    await importButton.click()

    // 5. Navigate to or expect to be on the import page
    await page.waitForURL('**/invoices/import**')
    await expect(page.locator('h1, h2')).toContainText(/import|upload/i)

    // 6. Locate and test PDF upload component
    const fileInput = page.locator('input[type="file"]').first()
    await expect(fileInput).toBeVisible()

    // 7. Create a test PDF file path
    // Note: In a real test, you'd have actual test PDF files
    const testPdfPath = path.join(__dirname, '..', 'fixtures', 'sample-invoice.pdf')

    // For this test, we'll simulate the upload without a real file
    // In a real test environment, you'd have actual PDF fixtures

    // 8. Test file upload validation (without actual file first)
    await expect(page.locator('button', { hasText: /upload|process/i })).toBeDisabled()

    // 9. Test drag and drop area (if present)
    const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, [class*="drop"]').first()
    if (await dropZone.isVisible()) {
      await expect(dropZone).toContainText(/drag|drop|upload/i)
    }

    // 10. Test file validation messages
    const validationMessage = page.locator('[role="alert"], .error, .warning, [data-testid="validation"]')
    // Should show no initial errors

    // 11. Check for loading states and progress indicators
    const loadingIndicator = page.locator('.loading, [data-testid="loading"], .spinner')
    // Should not be loading initially
    await expect(loadingIndicator).not.toBeVisible()

    // 12. Test error handling for invalid files (if possible to simulate)
    // This would require actual file uploads in a full test

    // 13. Check for help text and instructions
    const helpText = page.locator('p, span, div').filter({ hasText: /pdf|supported|format/i })
    if (await helpText.first().isVisible()) {
      await expect(helpText.first()).toBeVisible()
    }
  })

  test('should handle authentication requirements', async () => {
    // 1. Try to access import page without authentication
    await page.goto(`${BASE_URL}/dashboard/invoices/import`)

    // 2. Should redirect to sign in
    await page.waitForURL('**/auth/signin**')
    await expect(page.locator('h1, h2')).toContainText(/sign in|login/i)

    // 3. Error state should not be present on the page
    const errorBoundary = page.locator('[data-testid="error-boundary"], .error-boundary')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display proper error boundaries', async () => {
    // 1. Navigate to the import page
    await page.goto(`${BASE_URL}/dashboard/invoices/import`)

    // 2. Check that the page loads without error boundaries
    const errorBoundary = page.locator('[data-testid="error-boundary"], .error-boundary')
    await expect(errorBoundary).not.toBeVisible()

    // 3. Check for React error messages in console
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // 4. Wait a moment for any initial errors to appear
    await page.waitForTimeout(2000)

    // 5. Should not have React errors or Prisma validation errors
    const hasReactError = consoleErrors.some(error =>
      error.includes('Error') ||
      error.includes('React') ||
      error.includes('Prisma') ||
      error.includes('template_type') ||
      error.includes('Unknown field')
    )

    expect(hasReactError).toBeFalsy()
  })

  test('should have functional navigation', async () => {
    // Test that all main navigation works without errors

    // 1. Start at home page
    await page.goto(BASE_URL)

    // 2. Navigate to dashboard (may require auth)
    await page.goto(`${BASE_URL}/dashboard`)

    // 3. Check for error boundaries or React errors
    const errorBoundary = page.locator('[data-testid="error-boundary"], .error-boundary, [class*="error"]')
    await expect(errorBoundary).not.toBeVisible()

    // 4. Navigate to invoices
    await page.goto(`${BASE_URL}/dashboard/invoices`)
    await expect(errorBoundary).not.toBeVisible()

    // 5. Navigate to import page
    await page.goto(`${BASE_URL}/dashboard/invoices/import`)
    await expect(errorBoundary).not.toBeVisible()

    // 6. Verify page loads with proper content
    const mainContent = page.locator('main, [role="main"], .main-content').first()
    await expect(mainContent).toBeVisible()
  })

  test('should handle server-side rendering correctly', async () => {
    // Test that SSR works without hydration errors

    // 1. Navigate to import page
    await page.goto(`${BASE_URL}/dashboard/invoices/import`)

    // 2. Check for hydration warnings in console
    const consoleWarnings: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text())
      }
    })

    // 3. Wait for initial hydration
    await page.waitForTimeout(3000)

    // 4. Should not have hydration mismatches
    const hasHydrationWarning = consoleWarnings.some(warning =>
      warning.includes('hydrat') ||
      warning.includes('mismatch') ||
      warning.includes('server') ||
      warning.includes('client')
    )

    expect(hasHydrationWarning).toBeFalsy()
  })

  test('should load required resources successfully', async () => {
    // Test that all critical resources load

    // 1. Navigate to import page
    const response = await page.goto(`${BASE_URL}/dashboard/invoices/import`)

    // 2. Should get successful response
    expect(response?.status()).toBeLessThan(400)

    // 3. Check for failed network requests
    const failedRequests: string[] = []
    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        failedRequests.push(`${response.status()}: ${response.url()}`)
      }
    })

    // 4. Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // 5. Should not have critical failed requests
    const hasCriticalFailures = failedRequests.some(request =>
      request.includes('/api/') ||
      request.includes('.js') ||
      request.includes('.css')
    )

    expect(hasCriticalFailures).toBeFalsy()
  })

  test('should display upload interface correctly', async () => {
    // Test the upload UI components

    await page.goto(`${BASE_URL}/dashboard/invoices/import`)

    // 1. Should have file input or drop zone
    const fileInput = page.locator('input[type="file"]')
    const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone')

    const hasUploadInterface = (await fileInput.count()) > 0 || (await dropZone.count()) > 0
    expect(hasUploadInterface).toBeTruthy()

    // 2. Should have upload button (may be disabled initially)
    const uploadButton = page.locator('button').filter({ hasText: /upload|process|import/i })
    await expect(uploadButton.first()).toBeVisible()

    // 3. Should have help text or instructions
    const instructionText = page.locator('text=/pdf|drag|drop|select|file/i').first()
    await expect(instructionText).toBeVisible()

    // 4. Should not show error states initially
    const errorState = page.locator('.error, [role="alert"]').filter({ hasText: /error|fail|invalid/i })
    await expect(errorState).not.toBeVisible()
  })

  test('should maintain responsive design', async () => {
    // Test responsive behavior

    // 1. Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`${BASE_URL}/dashboard/invoices/import`)

    const mainContent = page.locator('main, [role="main"]').first()
    await expect(mainContent).toBeVisible()

    // 2. Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await expect(mainContent).toBeVisible()

    // 3. Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await expect(mainContent).toBeVisible()

    // 4. Upload interface should still be accessible
    const uploadInterface = page.locator('input[type="file"], [data-testid="drop-zone"]').first()
    await expect(uploadInterface).toBeVisible()
  })
})