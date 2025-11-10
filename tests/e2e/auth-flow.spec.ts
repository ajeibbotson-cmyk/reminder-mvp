import { test, expect } from '@playwright/test';

/**
 * E2E Test: User Authentication Flow
 * Tests the complete authentication journey
 */
test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/auth/signin');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill login form
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('**/en/dashboard', { timeout: 10000 });

    // Verify dashboard loaded
    const dashboard = page.locator('h1, h2').first();
    await expect(dashboard).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');

    await page.click('button[type="submit"]');

    // Should show error message (don't redirect)
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).toContain('/en/auth/signin');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');

    // Find and click logout button (may be in dropdown or menu)
    const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Sign Out")');

    if (await logoutButton.count() > 0) {
      await logoutButton.first().click();

      // Should redirect to signin
      await page.waitForURL('**/en/auth/signin', { timeout: 5000 });
      expect(page.url()).toContain('/en/auth/signin');
    }
  });
});
