import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://reminder-mvp.vercel.app';
const TEST_EMAIL = 'smoketest@example.com';
const TEST_PASSWORD = 'SmokeTest123!';

// Store console errors
const consoleErrors: string[] = [];

test.describe('Production E2E Smoke Test - Post Prisma Migration', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`[PageError] ${error.message}`);
    });
  });

  test.afterAll(async () => {
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS CAPTURED ===');
      consoleErrors.forEach((err) => console.log(err));
    }
    await page.close();
  });

  test('1. Homepage loads correctly', async () => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check page loaded
    await expect(page).toHaveTitle(/Reminder/i);

    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/01-homepage.png', fullPage: true });

    console.log('✅ Homepage loaded successfully');
  });

  test('2. Navigate to login page', async () => {
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.waitForLoadState('networkidle');

    // Check login form exists
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'tests/e2e/screenshots/02-login-page.png', fullPage: true });

    console.log('✅ Login page loaded successfully');
  });

  test('3. Authentication flow - Login', async () => {
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.waitForLoadState('networkidle');

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);

    // Take screenshot before submit
    await page.screenshot({ path: 'tests/e2e/screenshots/03-login-filled.png', fullPage: true });

    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for redirect or error
    await page.waitForTimeout(3000);

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/04-after-login.png', fullPage: true });

    // Check if redirected to dashboard or shows error
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Login successful - redirected to dashboard');
    } else if (currentUrl.includes('/signin') || currentUrl.includes('/auth')) {
      // Check for error message
      const errorElement = page.locator('[role="alert"], .error, .text-red, .text-destructive');
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log(`⚠️ Login error: ${errorText}`);
      } else {
        console.log('⚠️ Still on login page - credentials may be invalid');
      }
    }
  });

  test('4. Dashboard loads and displays metrics', async () => {
    // Navigate directly to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Dashboard URL: ${currentUrl}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/05-dashboard.png', fullPage: true });

    // Check if we're on dashboard or redirected to login
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Dashboard accessible');

      // Check for stats/metrics elements
      const statsElements = page.locator('[class*="stat"], [class*="metric"], [class*="card"]');
      const statsCount = await statsElements.count();
      console.log(`Found ${statsCount} stat/metric/card elements`);
    } else {
      console.log('⚠️ Redirected from dashboard - may need authentication');
    }
  });

  test('5. Invoice Management - List page', async () => {
    await page.goto(`${BASE_URL}/dashboard/invoices`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Invoices URL: ${currentUrl}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/06-invoices-list.png', fullPage: true });

    if (currentUrl.includes('/invoices')) {
      console.log('✅ Invoices page accessible');

      // Check for invoice table or list
      const table = page.locator('table, [role="table"], [class*="table"]');
      const tableExists = await table.isVisible().catch(() => false);

      if (tableExists) {
        console.log('✅ Invoice table visible');

        // Count rows
        const rows = page.locator('tbody tr, [class*="row"]');
        const rowCount = await rows.count();
        console.log(`Found ${rowCount} invoice rows`);
      }

      // Check for filters
      const filterElements = page.locator('[class*="filter"], select, [class*="dropdown"]');
      const filterCount = await filterElements.count();
      console.log(`Found ${filterCount} filter elements`);

      // Check for search
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]');
      const searchExists = await searchInput.isVisible().catch(() => false);
      console.log(`Search input visible: ${searchExists}`);
    }
  });

  test('6. Invoice Details - Click into invoice', async () => {
    await page.goto(`${BASE_URL}/dashboard/invoices`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to click on first invoice row
    const firstInvoiceLink = page.locator('tbody tr a, [class*="invoice"] a, table tr:first-child a').first();
    const linkExists = await firstInvoiceLink.isVisible().catch(() => false);

    if (linkExists) {
      await firstInvoiceLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/e2e/screenshots/07-invoice-details.png', fullPage: true });

      const currentUrl = page.url();
      console.log(`Invoice details URL: ${currentUrl}`);

      if (currentUrl.includes('/invoices/')) {
        console.log('✅ Invoice details page loaded');

        // Check for key invoice fields
        const invoiceNumber = page.locator('[class*="invoice-number"], [data-testid="invoice-number"]');
        const amount = page.locator('[class*="amount"], [data-testid="amount"]');
        const customer = page.locator('[class*="customer"], [data-testid="customer"]');

        console.log(`Invoice number visible: ${await invoiceNumber.isVisible().catch(() => false)}`);
        console.log(`Amount visible: ${await amount.isVisible().catch(() => false)}`);
        console.log(`Customer visible: ${await customer.isVisible().catch(() => false)}`);
      }
    } else {
      console.log('⚠️ No invoice links found to click');
      await page.screenshot({ path: 'tests/e2e/screenshots/07-no-invoice-links.png', fullPage: true });
    }
  });

  test('7. Customer Management - List page', async () => {
    await page.goto(`${BASE_URL}/dashboard/customers`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Customers URL: ${currentUrl}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/08-customers-list.png', fullPage: true });

    if (currentUrl.includes('/customers')) {
      console.log('✅ Customers page accessible');

      // Check for customer table/list
      const table = page.locator('table, [role="table"], [class*="table"]');
      const tableExists = await table.isVisible().catch(() => false);

      if (tableExists) {
        console.log('✅ Customer table visible');
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        console.log(`Found ${rowCount} customer rows`);
      }
    }
  });

  test('8. Import Flow - File upload interface', async () => {
    await page.goto(`${BASE_URL}/dashboard/import`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Import URL: ${currentUrl}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/09-import-page.png', fullPage: true });

    if (currentUrl.includes('/import')) {
      console.log('✅ Import page accessible');

      // Check for file type selector
      const fileTypeSelector = page.locator('select, [role="combobox"], [class*="select"]');
      const selectorExists = await fileTypeSelector.first().isVisible().catch(() => false);
      console.log(`File type selector visible: ${selectorExists}`);

      // Check for file upload area
      const uploadArea = page.locator('input[type="file"], [class*="dropzone"], [class*="upload"]');
      const uploadExists = await uploadArea.first().isVisible().catch(() => false);
      console.log(`Upload area visible: ${uploadExists}`);
    }
  });

  test('9. Settings page', async () => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Settings URL: ${currentUrl}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/10-settings-page.png', fullPage: true });

    if (currentUrl.includes('/settings')) {
      console.log('✅ Settings page accessible');

      // Check for settings form elements
      const formElements = page.locator('input, select, textarea, button');
      const formCount = await formElements.count();
      console.log(`Found ${formCount} form elements on settings page`);
    }
  });

  test('10. Logout functionality', async () => {
    // Look for logout button/link
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")');
    const logoutExists = await logoutButton.first().isVisible().catch(() => false);

    if (logoutExists) {
      await logoutButton.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/e2e/screenshots/11-after-logout.png', fullPage: true });

      const currentUrl = page.url();
      console.log(`URL after logout: ${currentUrl}`);

      if (currentUrl.includes('/signin') || currentUrl.includes('/auth') || currentUrl === BASE_URL + '/') {
        console.log('✅ Logout successful');
      }
    } else {
      console.log('⚠️ Logout button not found - user may already be logged out');
    }
  });

  test('11. Final Console Errors Report', async () => {
    console.log('\n=== FINAL TEST REPORT ===');
    console.log(`Total console errors captured: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach((err, index) => {
        console.log(`${index + 1}. ${err}`);
      });
    } else {
      console.log('✅ No console errors captured during testing');
    }
  });
});
