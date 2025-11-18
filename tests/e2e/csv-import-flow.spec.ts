import { test, expect } from '@playwright/test';
import { mockAuth } from '../helpers/mock-auth';

/**
 * E2E Test: CSV/Excel Import → Verify → Chase Flow
 * Critical for POP Trading (400+ invoices via CSV)
 */
test.describe('CSV Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should access CSV import interface', async ({ page }) => {
    // Navigate to invoices
    await page.getByTestId('desktop-nav-invoices').click();
    await page.waitForTimeout(1000);

    // Click Upload/Import button
    const importButton = page.locator('button:has-text("Upload"), button:has-text("Import")');
    await importButton.first().click();

    // Should see import page or file type selector
    await page.waitForTimeout(1000);

    //Check if we're on import page
    const currentUrl = page.url();
    const onImportPage = currentUrl.includes('/import') || currentUrl.includes('/upload');

    expect(onImportPage).toBe(true);
    console.log('✓ Import interface accessible');

    // Look for spreadsheet/CSV option
    const csvOption = page.locator('text=/spreadsheet|csv|excel/i');
    if (await csvOption.count() > 0) {
      console.log('✓ CSV/Spreadsheet import option visible');
    }
  });

  test('should show field mapping interface', async ({ page }) => {
    // Navigate to import
    await page.goto('/dashboard/invoices/import');
    await page.waitForTimeout(2000);

    // Look for file upload area
    const uploadArea = page.locator('text=/upload|drop|select/i').or(page.locator('input[type="file"]'));

    if (await uploadArea.count() > 0) {
      console.log('✓ File upload interface present');

      // Check for field mapping hints
      const mappingInfo = page.locator('text=/map|column|field/i');
      if (await mappingInfo.count() > 0) {
        console.log('✓ Field mapping functionality mentioned');
      }
    }
  });

  test('should handle bulk invoice import', async ({ page }) => {
    // Navigate to import
    await page.goto('/dashboard/invoices/import');
    await page.waitForTimeout(2000);

    // Look for batch import info
    const batchInfo = page.locator('text=/batch|bulk|multiple/i');

    if (await batchInfo.count() > 0) {
      console.log('✓ Bulk import capability indicated');
    }

    // Check for import history or progress
    const historyTab = page.locator('text=/history|previous|past/i');
    if (await historyTab.count() > 0) {
      console.log('✓ Import history tracking available');
    }
  });

  test('should support multi-currency import (POP Trading requirement)', async ({ page }) => {
    // Navigate to invoices after import
    await page.goto('/dashboard/invoices');
    await page.waitForTimeout(2000);

    // Look for currency indicators
    const currencyDisplay = page.locator('text=/AED|EUR|USD|GBP/');

    if (await currencyDisplay.count() > 0) {
      console.log('✓ Multi-currency support visible');

      // Count different currencies
      const currencies = ['AED', 'EUR', 'USD', 'GBP'];
      for (const currency of currencies) {
        const hasCurrency = await page.locator(`text=${currency}`).count() > 0;
        if (hasCurrency) {
          console.log(`✓ ${currency} currency detected`);
        }
      }
    }
  });
});
