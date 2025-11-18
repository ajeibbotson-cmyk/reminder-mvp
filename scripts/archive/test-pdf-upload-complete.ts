/**
 * Complete PDF upload flow test - including clicking Start Import
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function testCompletePDFUpload() {
  console.log('🔍 Testing Complete PDF Upload Flow...\n');

  const testPdfPath = path.join(process.cwd(), 'test-results', 'test-invoice.pdf');
  if (!fs.existsSync(testPdfPath)) {
    const dummyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test Invoice) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n406\n%%EOF';
    fs.writeFileSync(testPdfPath, dummyPdf);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Mock auth
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
          company: { id: 'test-company-id', name: 'Test Company' }
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
  });

  // Track API calls
  const apiCalls: any[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      const status = response.status();
      let body = null;
      try {
        const contentType = response.headers()['content-type'];
        if (contentType?.includes('json')) {
          body = await response.json();
        } else {
          body = await response.text();
        }
      } catch (e) {
        // Ignore
      }
      apiCalls.push({ url, status, body });
      console.log(`🌐 API: ${status} ${url.replace('https://reminder-mvp.vercel.app', '')}`);
    }
  });

  // Track console messages
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') {
      console.log(`❌ Console: ${msg.text()}`);
    } else if (type === 'warn') {
      console.log(`⚠️  Console: ${msg.text()}`);
    }
  });

  console.log('✅ Mock auth enabled');
  await page.goto('https://reminder-mvp.vercel.app/en/dashboard/invoices/upload-pdf');
  await page.waitForLoadState('networkidle');

  console.log('\n📎 Step 1: Uploading file...');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(testPdfPath);
  await page.waitForTimeout(1000);

  console.log('✅ File selected\n');

  // Wait for "Start Import" button
  console.log('🔍 Step 2: Looking for Start Import button...');
  const startButton = page.locator('button:has-text("Start Import"), button:has-text("Import")').first();

  const isVisible = await startButton.isVisible({ timeout: 5000 }).catch(() => false);
  if (!isVisible) {
    console.log('❌ Start Import button not found!');
    await page.screenshot({ path: 'test-results/no-button.png', fullPage: true });
    await browser.close();
    return;
  }

  console.log('✅ Start Import button found');

  // Click the button
  console.log('\n🖱️  Step 3: Clicking Start Import...');
  await startButton.click();

  // Wait for processing
  console.log('⏳ Waiting for API response...\n');
  await page.waitForTimeout(10000);

  // Check for errors
  console.log('📢 Checking for alerts/errors...');
  const errorAlerts = await page.locator('[role="alert"], .error, .text-red-500, .text-destructive').all();

  for (const alert of errorAlerts) {
    const text = await alert.textContent();
    if (text?.trim()) {
      console.log(`   ❌ Error: ${text.trim()}`);
    }
  }

  // Check for success
  const successAlerts = await page.locator('.success, .text-green-500, [data-state="success"]').all();
  for (const alert of successAlerts) {
    const text = await alert.textContent();
    if (text?.trim()) {
      console.log(`   ✅ Success: ${text.trim()}`);
    }
  }

  // Show API calls summary
  console.log('\n📊 API Calls Summary:');
  for (const call of apiCalls) {
    if (call.url.includes('/upload-pdf')) {
      console.log(`\n   ${call.status} ${call.url}`);
      if (call.body) {
        const bodyStr = typeof call.body === 'string' ? call.body : JSON.stringify(call.body, null, 2);
        console.log(`   Response: ${bodyStr.substring(0, 500)}`);
      }
    }
  }

  await page.screenshot({ path: 'test-results/pdf-upload-complete.png', fullPage: true });
  console.log('\n📸 Screenshot: test-results/pdf-upload-complete.png');

  console.log('\n⏳ Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('✅ Test complete');
}

testCompletePDFUpload().catch(console.error);
