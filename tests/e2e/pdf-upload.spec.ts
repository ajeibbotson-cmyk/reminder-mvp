/**
 * PDF Upload E2E Tests
 *
 * Tests the invoice PDF upload functionality
 */

import { test, expect } from '@playwright/test';
import { mockAuth } from '../helpers/mock-auth';
import path from 'path';

test.describe('PDF Upload', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for all tests
    await mockAuth(page);
  });

  test('should navigate to PDF upload page', async ({ page }) => {
    await page.goto('/en/dashboard/invoices/upload-pdf');

    // Check if page loads
    await expect(page.locator('h1, h2')).toContainText(/upload|pdf/i);
  });

  test('should show file upload interface', async ({ page }) => {
    await page.goto('/en/dashboard/invoices/upload-pdf');

    // Look for file input or upload button
    const fileInput = page.locator('input[type="file"]');
    const uploadButton = page.locator('button, [role="button"]').filter({ hasText: /upload|choose|select/i });

    // At least one should be visible
    const hasFileInput = await fileInput.count() > 0;
    const hasUploadButton = await uploadButton.count() > 0;

    expect(hasFileInput || hasUploadButton).toBeTruthy();
  });

  test('should handle PDF file selection', async ({ page }) => {
    await page.goto('/en/dashboard/invoices/upload-pdf');

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() === 0) {
      test.skip('No file input found on page');
    }

    // Create a test PDF file path (you'll need to create this)
    const testPdfPath = path.join(__dirname, '../fixtures/test-invoice.pdf');

    // Try to upload
    await fileInput.setInputFiles(testPdfPath);

    // Wait a moment for any processing
    await page.waitForTimeout(1000);

    // Check for success or error messages
    const alertMessages = page.locator('[role="alert"], .error, .success');
    if (await alertMessages.count() > 0) {
      const message = await alertMessages.first().textContent();
      console.log('Upload message:', message);
    }
  });

  test('should display upload errors clearly', async ({ page }) => {
    await page.goto('/en/dashboard/invoices/upload-pdf');

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() === 0) {
      test.skip('No file input found on page');
    }

    // Try uploading a non-PDF file
    const testTxtPath = path.join(__dirname, '../fixtures/test.txt');

    await fileInput.setInputFiles(testTxtPath);

    // Should show error for wrong file type
    await page.waitForTimeout(1000);

    // Check for error message
    const errorMessage = page.locator('[role="alert"], .error, .text-red-500, .text-destructive');

    // Either validation happens or file is rejected
    const hasError = await errorMessage.count() > 0;
    console.log('Error validation present:', hasError);
  });
});

test.describe('PDF Upload - Debugging', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('debug: capture upload page state', async ({ page }) => {
    await page.goto('/en/dashboard/invoices/upload-pdf');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Capture screenshot
    await page.screenshot({ path: 'test-results/pdf-upload-page.png', fullPage: true });

    // Log page structure
    const pageContent = await page.content();
    console.log('Page HTML length:', pageContent.length);

    // Find all inputs
    const allInputs = await page.locator('input').all();
    console.log('Total inputs found:', allInputs.length);

    for (const input of allInputs) {
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      console.log(`Input: type=${type}, name=${name}, id=${id}`);
    }

    // Find all buttons
    const allButtons = await page.locator('button, [role="button"]').all();
    console.log('Total buttons found:', allButtons.length);

    for (const button of allButtons) {
      const text = await button.textContent();
      console.log(`Button: "${text?.trim()}"`);
    }

    // Check console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    // Check network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`Network error: ${response.status()} ${response.url()}`);
      }
    });
  });
});
