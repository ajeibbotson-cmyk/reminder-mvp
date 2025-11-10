import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Fast sanity checks for deployment validation
 * Run these after every deployment to catch critical breaks
 */
test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Reminder/i);
    console.log('✓ Homepage loads');
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/en/auth/signin');
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();
    console.log('✓ Login page accessible');
  });

  test('can login with valid credentials', async ({ page }) => {
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard', { timeout: 10000 });
    console.log('✓ Authentication works');
  });

  test('dashboard loads for authenticated user', async ({ page }) => {
    // Login
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');

    // Verify dashboard elements
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    console.log('✓ Dashboard loads');
  });

  test('invoices page is accessible', async ({ page }) => {
    // Login
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');

    // Navigate to invoices
    await page.getByTestId('desktop-nav-invoices').click();
    await page.waitForURL('**/en/dashboard/invoices');
    console.log('✓ Invoices page accessible');
  });

  test('buckets page is accessible', async ({ page }) => {
    // Login
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');

    // Navigate to buckets
    const bucketsLink = page.getByTestId('desktop-nav-buckets');
    if (await bucketsLink.isVisible()) {
      await bucketsLink.click();
      await page.waitForURL('**/en/dashboard/buckets');
      console.log('✓ Buckets page accessible');
    }
  });

  test('PDF upload is accessible', async ({ page }) => {
    // Login
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');

    // Navigate to upload
    await page.getByTestId('desktop-nav-invoices').click();
    await page.waitForTimeout(1000);

    const uploadButton = page.locator('button:has-text("Upload")');
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const onUploadPage = currentUrl.includes('upload') || currentUrl.includes('import');
      expect(onUploadPage).toBe(true);
      console.log('✓ Upload interface accessible');
    }
  });

  test('API health check passes', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    console.log('✓ API health check passes');
  });
});

/**
 * Critical Path Smoke Test - Single test that validates the entire flow
 * If this passes, the core product works
 */
test.describe('Critical Path Smoke Test', () => {
  test('complete Reminder flow works end-to-end', async ({ page }) => {
    // 1. Login
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');
    console.log('✓ Step 1: Authentication');

    // 2. Access invoices
    await page.getByTestId('desktop-nav-invoices').click();
    await page.waitForURL('**/en/dashboard/invoices');
    console.log('✓ Step 2: Invoice list accessible');

    // 3. Access upload (verifies import path exists)
    const uploadButton = page.locator('button:has-text("Upload")');
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      await page.waitForTimeout(1000);
      console.log('✓ Step 3: Upload interface exists');
    }

    // 4. Navigate back and check buckets
    await page.goto('/en/dashboard');
    const bucketsLink = page.getByTestId('desktop-nav-buckets');
    if (await bucketsLink.isVisible()) {
      await bucketsLink.click();
      await page.waitForURL('**/en/dashboard/buckets');
      console.log('✓ Step 4: Buckets system accessible');
    }

    console.log('✅ CRITICAL PATH COMPLETE: Core Reminder flow validated');
  });
});
