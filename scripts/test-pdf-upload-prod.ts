/**
 * Quick script to test PDF upload on production
 */

import { chromium } from 'playwright';

async function testPDFUpload() {
  console.log('🔍 Testing PDF Upload on Production...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Mock authentication
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user',
          email: 'smoke-test@example.com',
          name: 'Test User',
          role: 'ADMIN',
          companyId: 'test-company-id',
          company: {
            id: 'test-company-id',
            name: 'Test Company'
          }
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
  });

  console.log('✅ Mock auth enabled');

  // Navigate to PDF upload page
  console.log('📍 Navigating to: https://reminder-mvp.vercel.app/en/dashboard/invoices/upload-pdf');
  await page.goto('https://reminder-mvp.vercel.app/en/dashboard/invoices/upload-pdf');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log(`📄 Current URL: ${page.url()}`);

  // Check for errors
  const errorMessages = await page.locator('[role="alert"], .error').all();
  if (errorMessages.length > 0) {
    console.log('\n⚠️  Error messages found:');
    for (const error of errorMessages) {
      const text = await error.textContent();
      console.log(`   - ${text?.trim()}`);
    }
  }

  // Find file inputs
  const fileInputs = await page.locator('input[type="file"]').all();
  console.log(`\n📎 File inputs found: ${fileInputs.length}`);

  if (fileInputs.length > 0) {
    for (let i = 0; i < fileInputs.length; i++) {
      const input = fileInputs[i];
      const name = await input.getAttribute('name');
      const accept = await input.getAttribute('accept');
      const id = await input.getAttribute('id');
      console.log(`   Input ${i + 1}: name="${name}", accept="${accept}", id="${id}"`);
    }
  }

  // Find buttons
  const buttons = await page.locator('button, [role="button"]').all();
  console.log(`\n🔘 Buttons found: ${buttons.length}`);

  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    const button = buttons[i];
    const text = await button.textContent();
    const disabled = await button.isDisabled();
    console.log(`   Button ${i + 1}: "${text?.trim()}" ${disabled ? '(disabled)' : ''}`);
  }

  // Capture screenshot
  await page.screenshot({ path: 'test-results/prod-pdf-upload.png', fullPage: true });
  console.log('\n📸 Screenshot saved to: test-results/prod-pdf-upload.png');

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`\n❌ Browser console error: ${msg.text()}`);
    }
  });

  // Listen for network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`\n🌐 Network error: ${response.status()} ${response.url()}`);
    }
  });

  console.log('\n⏳ Page will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('\n✅ Test complete');
}

testPDFUpload().catch(console.error);
