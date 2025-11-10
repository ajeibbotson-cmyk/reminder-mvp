import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

/**
 * Playwright fixture that provides an authenticated page
 * Handles NextAuth session setup for all E2E tests
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to signin
    await page.goto('/en/auth/signin');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Fill in credentials
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');

    // Submit form and wait for navigation
    await Promise.all([
      page.waitForURL('**/en/dashboard', { timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);

    // Wait for dashboard to be fully loaded (not just loading spinner)
    // This ensures the session is fully established
    await page.waitForSelector('a:has-text("Invoices")', { timeout: 10000 });

    // Verify we're actually authenticated
    const currentUrl = page.url();
    expect(currentUrl).toContain('/en/dashboard');

    await use(page);
  }
});

export { expect };
