/**
 * Test PDF upload with an actual file
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function testPDFUploadWithFile() {
  console.log('🔍 Testing PDF Upload with File...\n');

  // Create a simple test PDF if it doesn't exist
  const testPdfPath = path.join(process.cwd(), 'test-results', 'test-invoice.pdf');
  if (!fs.existsSync(testPdfPath)) {
    console.log('⚠️  No test PDF found. Creating a dummy PDF...');
    // Simple PDF header (minimal valid PDF)
    const dummyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test Invoice) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n406\n%%EOF';
    fs.writeFileSync(testPdfPath, dummyPdf);
    console.log(`✅ Created test PDF at: ${testPdfPath}\n`);
  }

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

  // Monitor network requests
  const apiCalls: any[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      const status = response.status();
      let body = null;
      try {
        if (response.headers()['content-type']?.includes('json')) {
          body = await response.json();
        }
      } catch (e) {
        // Ignore parse errors
      }
      apiCalls.push({ url, status, body });
    }
  });

  // Monitor console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`\n❌ Browser console error: ${msg.text()}`);
    }
  });

  console.log('✅ Mock auth enabled');
  console.log('📍 Navigating to upload page...');

  await page.goto('https://reminder-mvp.vercel.app/en/dashboard/invoices/upload-pdf');
  await page.waitForLoadState('networkidle');

  console.log('📎 Attempting to upload PDF file...');

  // Find and click the file input
  const fileInput = page.locator('input[type="file"]').first();

  if (await fileInput.count() === 0) {
    console.log('❌ No file input found!');
    await browser.close();
    return;
  }

  // Upload the file
  await fileInput.setInputFiles(testPdfPath);
  console.log('✅ File selected');

  // Wait for processing
  console.log('⏳ Waiting for upload/processing...');
  await page.waitForTimeout(5000);

  // Check for any alerts or errors
  const alerts = await page.locator('[role="alert"]').all();
  if (alerts.length > 0) {
    console.log('\n📢 Alerts found:');
    for (const alert of alerts) {
      const text = await alert.textContent();
      if (text?.trim()) {
        console.log(`   - ${text.trim()}`);
      }
    }
  }

  // Check for success indicators
  const successIndicators = await page.locator('.success, [data-state="success"], .text-green-500').all();
  if (successIndicators.length > 0) {
    console.log('\n✅ Success indicators found');
  }

  // Log API calls
  console.log('\n🌐 API Calls Made:');
  for (const call of apiCalls) {
    console.log(`   ${call.status} ${call.url}`);
    if (call.body) {
      console.log(`      Response: ${JSON.stringify(call.body).substring(0, 100)}...`);
    }
  }

  // Take final screenshot
  await page.screenshot({ path: 'test-results/pdf-upload-with-file.png', fullPage: true });
  console.log('\n📸 Screenshot saved to: test-results/pdf-upload-with-file.png');

  console.log('\n⏳ Keeping browser open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('\n✅ Test complete');
}

testPDFUploadWithFile().catch(console.error);
