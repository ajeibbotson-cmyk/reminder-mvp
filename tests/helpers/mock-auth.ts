/**
 * Mock Authentication Helper for E2E Tests
 *
 * Bypasses NextAuth by mocking the session API endpoint.
 * Use this instead of real auth flow for reliable E2E testing.
 */

import { Page } from '@playwright/test';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'FINANCE' | 'VIEWER';
  companyId: string;
  company: {
    id: string;
    name: string;
    trn?: string;
  };
}

export const defaultMockUser: MockUser = {
  id: 'test-user-id',
  email: 'smoke-test@example.com',
  name: 'Test User',
  role: 'ADMIN',
  companyId: 'test-company-id',
  company: {
    id: 'test-company-id',
    name: 'Test Company',
    trn: '123456789012345'
  }
};

/**
 * Mock authentication for E2E tests
 *
 * @param page - Playwright page instance
 * @param user - Optional custom user data (defaults to defaultMockUser)
 *
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await mockAuth(page);
 * });
 *
 * test('dashboard loads', async ({ page }) => {
 *   await page.goto('/en/dashboard');
 *   await expect(page.locator('h1')).toBeVisible();
 * });
 */
export async function mockAuth(page: Page, user: MockUser = defaultMockUser) {
  // Mock the session API endpoint
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
  });

  // Mock the CSRF token endpoint if needed
  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        csrfToken: 'mock-csrf-token'
      })
    });
  });

  console.log(`🔓 Mock auth enabled for: ${user.email} (${user.role})`);
}

/**
 * Create a custom mock user for specific test scenarios
 *
 * @example
 * const financeUser = createMockUser({
 *   role: 'FINANCE',
 *   email: 'finance@test.com',
 *   name: 'Finance User'
 * });
 * await mockAuth(page, financeUser);
 */
export function createMockUser(overrides: Partial<MockUser>): MockUser {
  return {
    ...defaultMockUser,
    ...overrides,
    company: {
      ...defaultMockUser.company,
      ...(overrides.company || {})
    }
  };
}
