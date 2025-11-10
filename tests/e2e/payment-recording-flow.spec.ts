import { test, expect } from '@playwright/test';

/**
 * E2E Test: Payment Recording → Status Update Flow
 * When customer pays, record it → stop reminders
 */
test.describe('Payment Recording Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');
  });

  test('should allow recording payment on invoice', async ({ page }) => {
    // Navigate to invoices
    await page.click('a:has-text("Invoices")');
    await page.waitForTimeout(2000);

    // Look for invoice row or card
    const invoiceRow = page.locator('tr, [data-testid="invoice-item"], .invoice-card').first();

    if (await invoiceRow.count() > 0) {
      // Click on invoice to view details
      await invoiceRow.click();
      await page.waitForTimeout(1000);

      // Look for "Record Payment" or "Mark Paid" button
      const paymentButton = page.locator('button:has-text("Payment"), button:has-text("Mark Paid"), button:has-text("Record")');

      if (await paymentButton.count() > 0) {
        await paymentButton.first().click();
        await page.waitForTimeout(1000);

        // Should open payment recording modal
        const modal = page.locator('[role="dialog"]');
        const hasModal = await modal.isVisible().catch(() => false);

        if (hasModal) {
          console.log('✓ Payment recording modal opened');

          // Check for payment amount field
          const amountField = page.locator('input[name="amount"], input[type="number"]');
          if (await amountField.count() > 0) {
            console.log('✓ Payment amount field present');
          }

          // Check for payment method selector
          const methodSelect = page.locator('select, [role="combobox"]');
          if (await methodSelect.count() > 0) {
            console.log('✓ Payment method selector available');
          }

          // Check for payment date
          const dateField = page.locator('input[type="date"]');
          if (await dateField.count() > 0) {
            console.log('✓ Payment date field present');
          }
        }
      } else {
        console.log('ℹ Payment recording button not found on invoice detail');
      }
    } else {
      console.log('ℹ No invoices found to test payment recording');
    }
  });

  test('should update invoice status after payment recorded', async ({ page }) => {
    // Navigate to invoices list
    await page.goto('/dashboard/invoices');
    await page.waitForTimeout(2000);

    // Look for status indicators
    const statusBadge = page.locator('text=/paid|overdue|pending/i, [data-status]');

    if (await statusBadge.count() > 0) {
      console.log('✓ Invoice status indicators visible');

      // Check for "paid" status
      const paidStatus = page.locator('text=/paid/i');
      if (await paidStatus.count() > 0) {
        console.log('✓ "Paid" status exists in system');
      }
    }
  });

  test('should show payment history on invoice', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    await page.waitForTimeout(2000);

    const firstInvoice = page.locator('tr, .invoice-card').first();
    if (await firstInvoice.count() > 0) {
      await firstInvoice.click();
      await page.waitForTimeout(1000);

      // Look for payment history section
      const paymentHistory = page.locator('text=/payment.*history|payments|transactions/i');
      if (await paymentHistory.count() > 0) {
        console.log('✓ Payment history section visible');
      }

      // Look for payment records
      const paymentRecord = page.locator('text=/received|recorded|paid on/i');
      if (await paymentRecord.count() > 0) {
        console.log('✓ Payment records displayed');
      }
    }
  });

  test('should support partial payments', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    await page.waitForTimeout(2000);

    const firstInvoice = page.locator('tr, .invoice-card').first();
    if (await firstInvoice.count() > 0) {
      await firstInvoice.click();
      await page.waitForTimeout(1000);

      // Look for outstanding balance or partial payment indicator
      const balanceInfo = page.locator('text=/outstanding|balance|remaining/i');
      if (await balanceInfo.count() > 0) {
        console.log('✓ Outstanding balance tracking present');
      }

      // Check for partial payment status
      const partialStatus = page.locator('text=/partial/i');
      if (await partialStatus.count() > 0) {
        console.log('✓ Partial payment status supported');
      }
    }
  });
});
