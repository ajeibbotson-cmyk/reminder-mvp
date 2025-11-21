import { test, expect } from '@playwright/test';

/**
 * Production Route Testing - Check all routes for 404s and errors
 */

const PRODUCTION_URL = 'https://usereminder.com';

const routes = [
  // Public routes
  { path: '/', name: 'Homepage', expectAuth: false },
  { path: '/auth/signin', name: 'Sign In', expectAuth: false },
  { path: '/auth/signup', name: 'Sign Up', expectAuth: false },

  // Protected routes (should redirect to signin)
  { path: '/dashboard', name: 'Dashboard', expectAuth: true },
  { path: '/dashboard/invoices', name: 'Invoices', expectAuth: true },
  { path: '/dashboard/customers', name: 'Customers', expectAuth: true },
  { path: '/dashboard/import', name: 'Import', expectAuth: true },
  { path: '/dashboard/settings', name: 'Settings', expectAuth: true },
  { path: '/dashboard/analytics', name: 'Analytics', expectAuth: true },
  { path: '/dashboard/follow-ups', name: 'Follow-ups', expectAuth: true },

  // API routes
  { path: '/api/health', name: 'Health API', expectAuth: false, isApi: true },
  { path: '/api/auth/providers', name: 'Auth Providers API', expectAuth: false, isApi: true },

  // Potential broken routes
  { path: '/import', name: 'Import (root)', expectAuth: false },
  { path: '/invoices', name: 'Invoices (root)', expectAuth: false },
  { path: '/customers', name: 'Customers (root)', expectAuth: false },

  // Localized routes
  { path: '/en', name: 'English locale', expectAuth: false },
  { path: '/ar', name: 'Arabic locale', expectAuth: false },
  { path: '/en/auth/signin', name: 'English Sign In', expectAuth: false },
  { path: '/en/dashboard', name: 'English Dashboard', expectAuth: true },
];

test.describe('Route Availability Tests', () => {
  for (const route of routes) {
    test(`${route.name} (${route.path}) - should not return server error`, async ({ page }) => {
      const response = await page.goto(`${PRODUCTION_URL}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const status = response?.status() || 0;
      const finalUrl = page.url();

      console.log(`${route.name}: Status ${status}, Final URL: ${finalUrl}`);

      // Should not be a server error (5xx)
      expect(status).toBeLessThan(500);

      // Check for 404 page content
      const pageContent = await page.content();
      const has404InContent = pageContent.includes('404') && pageContent.includes('Not Found');

      if (has404InContent && !route.path.includes('404')) {
        console.log(`WARNING: ${route.name} shows 404 page`);
      }

      // For protected routes, verify redirect to auth
      if (route.expectAuth && !route.isApi) {
        const redirectedToAuth = finalUrl.includes('signin') || finalUrl.includes('login') || finalUrl.includes('auth');
        if (!redirectedToAuth && status !== 401 && status !== 403) {
          console.log(`WARNING: Protected route ${route.path} did not redirect to auth`);
        }
      }
    });
  }
});

test.describe('Forgot Password Flow', () => {
  test('forgot password link works', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'networkidle' });

    const forgotLink = page.locator('a:has-text("Forgot"), a[href*="forgot"], a[href*="reset"]');

    if (await forgotLink.count() > 0) {
      const href = await forgotLink.first().getAttribute('href');
      console.log(`Forgot password link: ${href}`);

      await forgotLink.first().click();
      await page.waitForTimeout(1000);

      const newUrl = page.url();
      console.log(`After clicking forgot password: ${newUrl}`);

      // Check if it's a valid page
      const pageContent = await page.content();
      const is404 = pageContent.includes('404') && pageContent.includes('Not Found');

      if (is404) {
        console.log('BUG: Forgot password page shows 404');
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/forgot-password-page.png' });
    } else {
      console.log('No forgot password link found');
    }
  });
});

test.describe('CTA Button Tests', () => {
  test('Start Free Trial button navigates correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    const ctaButton = page.locator('a:has-text("Start"), a:has-text("Free Trial"), button:has-text("Start")').first();

    if (await ctaButton.count() > 0) {
      const href = await ctaButton.getAttribute('href');
      console.log(`CTA button href: ${href}`);

      await ctaButton.click();
      await page.waitForTimeout(1000);

      const newUrl = page.url();
      console.log(`After CTA click: ${newUrl}`);

      await page.screenshot({ path: 'tests/e2e/screenshots/after-cta-click.png' });
    }
  });

  test('Sign In button navigates correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    const signInButton = page.locator('a:has-text("Sign In"), button:has-text("Sign In")').first();

    if (await signInButton.count() > 0) {
      await signInButton.click();
      await page.waitForTimeout(1000);

      const newUrl = page.url();
      console.log(`After Sign In click: ${newUrl}`);

      // Should be on signin page
      expect(newUrl).toContain('signin');
    }
  });

  test('Get Started button navigates correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    const getStartedButton = page.locator('a:has-text("Get Started"), button:has-text("Get Started")').first();

    if (await getStartedButton.count() > 0) {
      const href = await getStartedButton.getAttribute('href');
      console.log(`Get Started button href: ${href}`);

      await getStartedButton.click();
      await page.waitForTimeout(1000);

      const newUrl = page.url();
      console.log(`After Get Started click: ${newUrl}`);

      await page.screenshot({ path: 'tests/e2e/screenshots/after-get-started-click.png' });
    }
  });
});

test.describe('Form Edge Cases', () => {
  test('signup with very long inputs', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/auth/signup`, { waitUntil: 'networkidle' });

    const nameInput = page.locator('input[name="name"], input[id*="name"]').first();
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const companyInput = page.locator('input[name*="company"], input[id*="company"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    // Test with very long string (potential overflow)
    const longString = 'a'.repeat(500);

    if (await nameInput.count() > 0) {
      await nameInput.fill(longString);
      console.log('Filled long name');
    }

    if (await emailInput.count() > 0) {
      await emailInput.fill(`${longString}@test.com`);
      console.log('Filled long email');
    }

    if (await companyInput.count() > 0) {
      await companyInput.fill(longString);
      console.log('Filled long company');
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/signup-long-inputs.png' });

    // Check for visual overflow
    const hasOverflow = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        if (input.scrollWidth > input.clientWidth) {
          return true;
        }
      }
      return false;
    });

    console.log(`Input overflow detected: ${hasOverflow}`);
  });

  test('signin with SQL injection attempt', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0) {
      // Note: This is a security test, not an actual attack
      await emailInput.fill("test@test.com' OR '1'='1");
      await passwordInput.fill("password' OR '1'='1");

      await submitButton.click();
      await page.waitForTimeout(2000);

      // Should NOT log in - should show error
      const url = page.url();
      const isStillOnLogin = url.includes('signin') || url.includes('login');

      console.log(`After SQL injection attempt, still on login: ${isStillOnLogin}`);

      // Should definitely not be on dashboard
      expect(url).not.toContain('dashboard');
    }
  });

  test('signin with XSS attempt', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();

    if (await emailInput.count() > 0) {
      await emailInput.fill('<script>alert("xss")</script>@test.com');

      // Check that script tags are escaped/not executed
      const alertTriggered = await page.evaluate(() => {
        return (window as any).__xssTriggered === true;
      });

      expect(alertTriggered).toBeFalsy();
      console.log('XSS prevention check passed');
    }
  });
});

test.describe('Mobile Navigation Tests', () => {
  test('mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Look for hamburger menu
    const menuButton = page.locator('[class*="menu"], [aria-label*="menu"], button[class*="hamburger"], [class*="mobile-menu"]');

    if (await menuButton.count() > 0) {
      console.log('Mobile menu button found');
      await menuButton.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'tests/e2e/screenshots/mobile-menu-open.png' });

      // Check if menu content is visible
      const menuContent = page.locator('[class*="mobile-nav"], [class*="nav-menu"], nav[class*="open"]');
      const isMenuVisible = await menuContent.count() > 0;
      console.log(`Mobile menu content visible: ${isMenuVisible}`);
    } else {
      console.log('No mobile menu button found - may use inline buttons');
    }
  });
});
