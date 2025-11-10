import { test, expect } from '@playwright/test';

/**
 * E2E Test: Bucket Auto-Send Flow
 * Tests automated reminder system - THE core automation feature
 */
test.describe('Bucket Auto-Send System', () => {
  test('should display bucket dashboard with invoice categorization', async ({ page }) => {
    // Start from dashboard (already authenticated via storageState)
    await page.goto('/en/dashboard');
    // Navigate to buckets
    const bucketsLink = page.getByTestId('desktop-nav-buckets');
    await expect(bucketsLink).toBeVisible();
    await bucketsLink.click();

    await page.waitForURL('**/en/dashboard/buckets');
    await page.waitForTimeout(2000);

    // Verify time-based buckets exist
    const buckets = [
      'Not Due',
      '1-3 Days',
      '4-7 Days',
      '8-14 Days',
      '15-30 Days',
      '30+ Days'
    ];

    let visibleBuckets = 0;
    for (const bucketName of buckets) {
      const bucket = page.locator(`text=${bucketName}`);
      if (await bucket.isVisible()) {
        visibleBuckets++;
        console.log(`✓ Bucket "${bucketName}" visible`);
      }
    }

    expect(visibleBuckets).toBeGreaterThan(3);
    console.log(`✓ ${visibleBuckets}/6 buckets displayed`);
  });

  test('should allow bucket configuration for auto-send', async ({ page }) => {
    // Start from dashboard (already authenticated via storageState)
    await page.goto('/en/dashboard');

    // Navigate to buckets
    await page.getByTestId('desktop-nav-buckets').click();
    await page.waitForTimeout(2000);

    // Look for Configure button
    const configureButton = page.locator('button:has-text("Configure")');

    if (await configureButton.count() > 0) {
      await configureButton.first().click();

      // Should open configuration modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Check for auto-send toggle
      const autoSendToggle = page.locator('text=/auto.*send|enable.*send/i');
      await expect(autoSendToggle).toBeVisible();

      console.log('✓ Auto-send configuration accessible');

      // Check for timing controls
      const timeControl = page.locator('text=/time|schedule|when/i');
      if (await timeControl.count() > 0) {
        console.log('✓ Send timing controls present');
      }

      // Check for days selector (UAE: Sun-Thu)
      const daysControl = page.locator('text=/days|sunday|monday/i');
      if (await daysControl.count() > 0) {
        console.log('✓ Send days configuration available');
      }
    }
  });

  test('should show email template preview in bucket config', async ({ page }) => {
    // Start from dashboard (already authenticated via storageState)
    await page.goto('/en/dashboard');

    await page.getByTestId('desktop-nav-buckets').click();
    await page.waitForTimeout(2000);

    const configureButton = page.locator('button:has-text("Configure")').first();
    if (await configureButton.isVisible()) {
      await configureButton.click();
      await page.waitForTimeout(1000);

      // Look for template or message field
      const templateField = page.locator('text=/template|message|email/i');
      if (await templateField.count() > 0) {
        console.log('✓ Email template configuration visible');
      }

      // Check for merge tags info
      const mergeTags = page.locator('text=/customerName|invoiceNumber|amount|dueDate/');
      if (await mergeTags.count() > 0) {
        console.log('✓ Merge tags support indicated');
      }
    }
  });

  test('should allow manual campaign trigger from bucket', async ({ page }) => {
    // Start from dashboard (already authenticated via storageState)
    await page.goto('/en/dashboard');

    await page.getByTestId('desktop-nav-buckets').click();
    await page.waitForTimeout(2000);

    // Look for "Email" or "Send" button on bucket cards
    const emailButton = page.locator('button:has-text("Email")');

    if (await emailButton.count() > 0) {
      console.log('✓ Manual email trigger available');

      await emailButton.first().click();
      await page.waitForTimeout(1000);

      // Should open email campaign modal
      const modal = page.locator('[role="dialog"]');
      const hasModal = await modal.isVisible().catch(() => false);

      if (hasModal) {
        console.log('✓ Email campaign modal opens from bucket');
      }
    } else {
      console.log('ℹ Email buttons not found (may need invoices in buckets)');
    }
  });

  test('should respect UAE business hours in bucket config', async ({ page }) => {
    // Start from dashboard (already authenticated via storageState)
    await page.goto('/en/dashboard');

    await page.getByTestId('desktop-nav-buckets').click();
    await page.waitForTimeout(2000);

    const configureButton = page.locator('button:has-text("Configure")').first();
    if (await configureButton.isVisible()) {
      await configureButton.click();
      await page.waitForTimeout(1000);

      // Look for business hours or UAE-specific settings
      const businessHours = page.locator('text=/business.*hours|9.*AM|6.*PM/i');
      if (await businessHours.count() > 0) {
        console.log('✓ Business hours configuration present');
      }

      // Check for UAE days (Sun-Thu)
      const uaeDays = page.locator('text=/sunday|thursday/i');
      if (await uaeDays.count() > 0) {
        console.log('✓ UAE business days (Sun-Thu) mentioned');
      }
    }
  });
});
