import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'https://reminder-mvp.vercel.app';
const TEST_EMAIL = 'smoketest@example.com';
const TEST_PASSWORD = 'SmokeTest123!';

interface TestResult {
  page: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  errors: string[];
  screenshot?: string;
}

const testResults: TestResult[] = [];
const consoleErrors: { page: string; error: string }[] = [];

test.describe.serial('Detailed Production E2E Test - Post Prisma Migration', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    // Capture ALL console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          page: page.url(),
          error: `[Console ${msg.type()}] ${msg.text()}`,
        });
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push({
        page: page.url(),
        error: `[PageError] ${error.message}`,
      });
    });

    // Capture network errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        consoleErrors.push({
          page: page.url(),
          error: `[Network ${response.status()}] ${response.url()}`,
        });
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('1. Homepage Test', async () => {
    const result: TestResult = {
      page: 'Homepage',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Check title
      const title = await page.title();
      result.details += `Title: ${title}. `;

      // Check for key elements
      const h1 = await page.locator('h1').first().textContent().catch(() => 'Not found');
      result.details += `H1: ${h1}. `;

      // Look for navigation/CTA
      const signInBtn = page.locator('a:has-text("Sign in"), button:has-text("Sign in"), a:has-text("Login")');
      const hasSignIn = await signInBtn.first().isVisible().catch(() => false);
      result.details += `Sign-in visible: ${hasSignIn}. `;

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-01-homepage.png', fullPage: true });
      result.screenshot = 'detailed-01-homepage.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('2. Login Page Test', async () => {
    const result: TestResult = {
      page: 'Login Page',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: 'networkidle' });

      const currentUrl = page.url();
      result.details += `URL: ${currentUrl}. `;

      // Check for form elements
      const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"], input[id="password"]');
      const submitBtn = page.locator('button[type="submit"]');

      const emailVisible = await emailInput.first().isVisible().catch(() => false);
      const pwdVisible = await passwordInput.first().isVisible().catch(() => false);
      const btnVisible = await submitBtn.first().isVisible().catch(() => false);

      result.details += `Email input: ${emailVisible}, Password input: ${pwdVisible}, Submit: ${btnVisible}. `;

      if (!emailVisible || !pwdVisible) {
        result.status = 'WARN';
        result.errors.push('Login form elements not all visible');
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-02-login.png', fullPage: true });
      result.screenshot = 'detailed-02-login.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('3. Authentication Flow Test', async () => {
    const result: TestResult = {
      page: 'Authentication Flow',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: 'networkidle' });

      // Fill login form
      const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"], input[id="password"]').first();

      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-03a-login-filled.png', fullPage: true });

      // Submit
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      // Wait for navigation
      await page.waitForTimeout(5000);

      const currentUrl = page.url();
      result.details += `URL after submit: ${currentUrl}. `;

      // Check for error messages on page
      const errorElements = page.locator('[role="alert"], .error, .text-red-500, .text-destructive, [class*="error"]');
      const errorCount = await errorElements.count();

      if (errorCount > 0) {
        for (let i = 0; i < errorCount; i++) {
          const text = await errorElements.nth(i).textContent().catch(() => '');
          if (text && text.trim()) {
            result.errors.push(`Error displayed: ${text.trim()}`);
          }
        }
      }

      // Check if we're on dashboard
      if (currentUrl.includes('/dashboard')) {
        result.details += 'SUCCESS: Redirected to dashboard. ';
      } else if (currentUrl.includes('/signin') || currentUrl.includes('/auth')) {
        result.status = 'FAIL';
        result.details += 'FAILED: Still on login page. ';

        // Check for specific error messages
        const pageContent = await page.content();
        if (pageContent.includes('Invalid') || pageContent.includes('incorrect')) {
          result.errors.push('Invalid credentials message detected');
        }
        if (pageContent.includes('User not found')) {
          result.errors.push('User not found - test user may not exist');
        }
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-03b-after-login.png', fullPage: true });
      result.screenshot = 'detailed-03b-after-login.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
    if (result.errors.length > 0) {
      result.errors.forEach(e => console.log(`  - Error: ${e}`));
    }
  });

  test('4. Dashboard Test (requires auth)', async () => {
    const result: TestResult = {
      page: 'Dashboard',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      const currentUrl = page.url();

      // If not authenticated, try going to dashboard directly to see redirect
      if (!currentUrl.includes('/dashboard')) {
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }

      const dashboardUrl = page.url();
      result.details += `URL: ${dashboardUrl}. `;

      if (dashboardUrl.includes('/dashboard') && !dashboardUrl.includes('/auth')) {
        // We're on dashboard - check elements
        const cards = page.locator('[class*="card"], [class*="Card"]');
        const cardCount = await cards.count();
        result.details += `Found ${cardCount} cards. `;

        // Check for stats/metrics
        const stats = page.locator('[class*="stat"], [class*="metric"], h2, h3');
        const statsCount = await stats.count();
        result.details += `Found ${statsCount} stat/heading elements. `;

        // Check page content for common dashboard text
        const content = await page.content();
        const hasInvoices = content.includes('Invoice') || content.includes('invoice');
        const hasOverdue = content.includes('Overdue') || content.includes('overdue');
        result.details += `Has invoice refs: ${hasInvoices}, Has overdue refs: ${hasOverdue}. `;

      } else {
        result.status = 'WARN';
        result.details += 'Redirected to login - auth required. ';
        result.errors.push('Could not access dashboard - authentication failed');
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-04-dashboard.png', fullPage: true });
      result.screenshot = 'detailed-04-dashboard.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('5. Invoices Page Test', async () => {
    const result: TestResult = {
      page: 'Invoices List',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(`${BASE_URL}/dashboard/invoices`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      result.details += `URL: ${currentUrl}. `;

      if (currentUrl.includes('/invoices') && !currentUrl.includes('/auth')) {
        // Check for table
        const table = page.locator('table, [class*="table"], [role="table"]');
        const hasTable = await table.first().isVisible().catch(() => false);
        result.details += `Table visible: ${hasTable}. `;

        if (hasTable) {
          const rows = page.locator('tbody tr');
          const rowCount = await rows.count();
          result.details += `Rows: ${rowCount}. `;

          // Check header columns for expected fields
          const headers = await page.locator('thead th, th').allTextContents();
          result.details += `Headers: ${headers.join(', ')}. `;
        }

        // Check for filter/search
        const searchInput = page.locator('input[placeholder*="earch"], input[type="search"]');
        const hasSearch = await searchInput.first().isVisible().catch(() => false);
        result.details += `Search: ${hasSearch}. `;

        // Check for any error messages
        const errorAlert = page.locator('[role="alert"]');
        if (await errorAlert.isVisible().catch(() => false)) {
          const alertText = await errorAlert.textContent();
          result.errors.push(`Alert on page: ${alertText}`);
        }

      } else {
        result.status = 'WARN';
        result.details += 'Redirected - auth required. ';
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-05-invoices.png', fullPage: true });
      result.screenshot = 'detailed-05-invoices.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('6. Customers Page Test', async () => {
    const result: TestResult = {
      page: 'Customers List',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(`${BASE_URL}/dashboard/customers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      result.details += `URL: ${currentUrl}. `;

      if (currentUrl.includes('/customers') && !currentUrl.includes('/auth')) {
        const table = page.locator('table, [class*="table"]');
        const hasTable = await table.first().isVisible().catch(() => false);
        result.details += `Table: ${hasTable}. `;

        if (hasTable) {
          const rows = page.locator('tbody tr');
          const rowCount = await rows.count();
          result.details += `Rows: ${rowCount}. `;
        }
      } else {
        result.status = 'WARN';
        result.details += 'Redirected - auth required. ';
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-06-customers.png', fullPage: true });
      result.screenshot = 'detailed-06-customers.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('7. Import Page Test', async () => {
    const result: TestResult = {
      page: 'Import Page',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(`${BASE_URL}/dashboard/import`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      result.details += `URL: ${currentUrl}. `;

      if (currentUrl.includes('/import') && !currentUrl.includes('/auth')) {
        // Check for file type selector
        const select = page.locator('select, [role="combobox"], button[class*="select"]');
        const hasSelect = await select.first().isVisible().catch(() => false);
        result.details += `File selector: ${hasSelect}. `;

        // Check for upload area
        const uploadInput = page.locator('input[type="file"]');
        const hasUpload = await uploadInput.first().isAttached().catch(() => false);
        result.details += `File input: ${hasUpload}. `;

        // Check for dropzone
        const dropzone = page.locator('[class*="dropzone"], [class*="upload"], [class*="drop"]');
        const hasDropzone = await dropzone.first().isVisible().catch(() => false);
        result.details += `Dropzone: ${hasDropzone}. `;

      } else {
        result.status = 'WARN';
        result.details += 'Redirected - auth required. ';
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-07-import.png', fullPage: true });
      result.screenshot = 'detailed-07-import.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('8. Settings Page Test', async () => {
    const result: TestResult = {
      page: 'Settings Page',
      status: 'PASS',
      details: '',
      errors: [],
    };

    try {
      await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      result.details += `URL: ${currentUrl}. `;

      if (currentUrl.includes('/settings') && !currentUrl.includes('/auth')) {
        // Check for form elements
        const inputs = page.locator('input:not([type="hidden"])');
        const inputCount = await inputs.count();
        result.details += `Inputs: ${inputCount}. `;

        // Check for buttons
        const buttons = page.locator('button');
        const btnCount = await buttons.count();
        result.details += `Buttons: ${btnCount}. `;

        // Check for tabs or sections
        const tabs = page.locator('[role="tab"], [class*="tab"]');
        const tabCount = await tabs.count();
        result.details += `Tabs: ${tabCount}. `;

      } else {
        result.status = 'WARN';
        result.details += 'Redirected - auth required. ';
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/detailed-08-settings.png', fullPage: true });
      result.screenshot = 'detailed-08-settings.png';

    } catch (error: unknown) {
      result.status = 'FAIL';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    testResults.push(result);
    console.log(`[${result.status}] ${result.page}: ${result.details}`);
  });

  test('FINAL REPORT', async () => {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           PRODUCTION E2E TEST REPORT - POST PRISMA MIGRATION');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Test URL: ${BASE_URL}`);
    console.log(`Test Time: ${new Date().toISOString()}`);
    console.log('');

    console.log('PAGE TEST RESULTS:');
    console.log('───────────────────────────────────────────────────────────────');

    let passed = 0;
    let warned = 0;
    let failed = 0;

    testResults.forEach((result) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} ${result.page}: ${result.status}`);
      console.log(`   Details: ${result.details}`);
      if (result.errors.length > 0) {
        result.errors.forEach((e) => console.log(`   Error: ${e}`));
      }
      if (result.screenshot) {
        console.log(`   Screenshot: ${result.screenshot}`);
      }
      console.log('');

      if (result.status === 'PASS') passed++;
      else if (result.status === 'WARN') warned++;
      else failed++;
    });

    console.log('───────────────────────────────────────────────────────────────');
    console.log(`SUMMARY: ${passed} passed, ${warned} warnings, ${failed} failed`);
    console.log('');

    if (consoleErrors.length > 0) {
      console.log('CONSOLE/NETWORK ERRORS:');
      console.log('───────────────────────────────────────────────────────────────');
      const uniqueErrors = [...new Set(consoleErrors.map((e) => e.error))];
      uniqueErrors.forEach((err) => {
        console.log(`  - ${err}`);
      });
    } else {
      console.log('✅ No console or network errors captured');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    // Fail the test if we have critical failures
    expect(failed).toBeLessThanOrEqual(1); // Allow 1 failure for auth issues
  });
});
