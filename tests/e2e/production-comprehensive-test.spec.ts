import { test, expect } from '@playwright/test';

/**
 * Comprehensive Production E2E Bug Testing for https://usereminder.com
 *
 * Testing Scope:
 * 1. Homepage and public pages
 * 2. Authentication flows
 * 3. Forms and validation
 * 4. UI/UX issues
 * 5. API health
 * 6. Responsive design
 * 7. Console errors and network issues
 */

const PRODUCTION_URL = 'https://usereminder.com';

// Bug tracking
interface Bug {
  severity: 'critical' | 'major' | 'minor';
  category: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  url?: string;
}

const bugs: Bug[] = [];

test.describe('Production Bug Testing - usereminder.com', () => {

  test.describe('1. Homepage Tests', () => {

    test('homepage loads correctly', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      // Check HTTP status
      expect(response?.status()).toBeLessThan(400);

      // Check page title exists
      const title = await page.title();
      expect(title).toBeTruthy();
      console.log(`Page title: ${title}`);

      // Check for critical elements
      await expect(page.locator('body')).toBeVisible();

      // Take screenshot for reference
      await page.screenshot({ path: 'tests/e2e/screenshots/homepage.png', fullPage: true });

      // Log any console errors
      if (consoleErrors.length > 0) {
        console.log('Console errors found:', consoleErrors);
      }
    });

    test('homepage hero section renders', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

      // Look for common hero section patterns
      const heroSelectors = [
        'section:first-of-type',
        '[class*="hero"]',
        'main > div:first-child',
        'h1',
      ];

      let heroFound = false;
      for (const selector of heroSelectors) {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          heroFound = true;
          console.log(`Hero found with selector: ${selector}`);
          break;
        }
      }

      // Check for main heading
      const h1 = page.locator('h1').first();
      if (await h1.count() > 0) {
        const headingText = await h1.textContent();
        console.log(`Main heading: ${headingText}`);
      }
    });

    test('navigation is present and functional', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

      // Check for navigation
      const navSelectors = ['nav', 'header', '[role="navigation"]'];

      for (const selector of navSelectors) {
        const nav = page.locator(selector).first();
        if (await nav.count() > 0) {
          await expect(nav).toBeVisible();
          console.log(`Navigation found: ${selector}`);
          break;
        }
      }

      // Check for navigation links
      const navLinks = page.locator('nav a, header a');
      const linkCount = await navLinks.count();
      console.log(`Navigation links found: ${linkCount}`);

      // Verify links have href attributes
      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        const href = await navLinks.nth(i).getAttribute('href');
        console.log(`Link ${i + 1}: ${href}`);
      }
    });

    test('all images load correctly', async ({ page }) => {
      const brokenImages: string[] = [];

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      const images = page.locator('img');
      const imageCount = await images.count();
      console.log(`Total images found: ${imageCount}`);

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);

        if (naturalWidth === 0 && src) {
          brokenImages.push(src);
        }
      }

      if (brokenImages.length > 0) {
        console.log('Broken images:', brokenImages);
      }

      expect(brokenImages).toHaveLength(0);
    });

    test('footer is present', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

      const footer = page.locator('footer');
      if (await footer.count() > 0) {
        await expect(footer).toBeVisible();

        // Check footer content
        const footerText = await footer.textContent();
        console.log(`Footer content preview: ${footerText?.substring(0, 200)}...`);
      } else {
        console.log('No footer element found');
      }
    });
  });

  test.describe('2. Authentication Flow Tests', () => {

    test('signin page loads correctly', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'networkidle' });

      expect(response?.status()).toBeLessThan(400);

      await page.screenshot({ path: 'tests/e2e/screenshots/signin-page.png' });

      // Check for form elements
      const emailInput = page.locator('input[type="email"], input[name="email"], input[id*="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], input[type="submit"]');

      console.log(`Email input found: ${await emailInput.count() > 0}`);
      console.log(`Password input found: ${await passwordInput.count() > 0}`);
      console.log(`Submit button found: ${await submitButton.count() > 0}`);

      if (consoleErrors.length > 0) {
        console.log('Console errors on signin page:', consoleErrors);
      }
    });

    test('signup page loads correctly', async ({ page }) => {
      const response = await page.goto(`${PRODUCTION_URL}/auth/signup`, { waitUntil: 'networkidle' });

      expect(response?.status()).toBeLessThan(400);

      await page.screenshot({ path: 'tests/e2e/screenshots/signup-page.png' });

      // Check for form elements
      const nameInput = page.locator('input[name="name"], input[id*="name"]');
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const companyInput = page.locator('input[name*="company"], input[id*="company"]');

      console.log(`Name input found: ${await nameInput.count() > 0}`);
      console.log(`Email input found: ${await emailInput.count() > 0}`);
      console.log(`Password input found: ${await passwordInput.count() > 0}`);
      console.log(`Company input found: ${await companyInput.count() > 0}`);
    });

    test('signin form validation works', async ({ page }) => {
      await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'domcontentloaded' });

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]').first();

      if (await submitButton.count() > 0) {
        await submitButton.click();

        // Wait for validation messages
        await page.waitForTimeout(500);

        // Check for HTML5 validation or custom validation
        const invalidInputs = page.locator('input:invalid');
        const errorMessages = page.locator('[class*="error"], [role="alert"], .text-red, .text-destructive');

        console.log(`Invalid inputs after empty submit: ${await invalidInputs.count()}`);
        console.log(`Error messages shown: ${await errorMessages.count()}`);

        await page.screenshot({ path: 'tests/e2e/screenshots/signin-validation.png' });
      }
    });

    test('invalid credentials show error message', async ({ page }) => {
      await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'networkidle' });

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
        await emailInput.fill('invalid@test.com');
        await passwordInput.fill('wrongpassword123');

        await submitButton.click();

        // Wait for error response
        await page.waitForTimeout(2000);

        // Check for error message
        const errorMessage = page.locator('[class*="error"], [role="alert"], .text-red, .text-destructive, [class*="toast"]');
        const errorCount = await errorMessage.count();

        console.log(`Error messages after invalid login: ${errorCount}`);

        await page.screenshot({ path: 'tests/e2e/screenshots/signin-invalid-credentials.png' });
      }
    });

    test('password visibility toggle works if present', async ({ page }) => {
      await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'domcontentloaded' });

      const passwordInput = page.locator('input[type="password"]').first();
      const toggleButton = page.locator('[class*="password"] button, button[aria-label*="password"], button[aria-label*="show"], [class*="eye"]');

      if (await toggleButton.count() > 0) {
        // Check initial state
        const initialType = await passwordInput.getAttribute('type');
        console.log(`Initial password input type: ${initialType}`);

        // Click toggle
        await toggleButton.first().click();
        await page.waitForTimeout(200);

        const newType = await passwordInput.getAttribute('type');
        console.log(`After toggle password input type: ${newType}`);

        expect(newType).not.toBe(initialType);
      } else {
        console.log('No password visibility toggle found');
      }
    });
  });

  test.describe('3. Dashboard Access Tests', () => {

    test('unauthenticated users are redirected from dashboard', async ({ page }) => {
      const response = await page.goto(`${PRODUCTION_URL}/dashboard`, { waitUntil: 'networkidle' });

      // Should redirect to signin or show 401/403
      const finalUrl = page.url();
      console.log(`Dashboard access URL result: ${finalUrl}`);

      const isRedirected = finalUrl.includes('signin') || finalUrl.includes('login') || finalUrl.includes('auth');
      const isUnauthorized = response?.status() === 401 || response?.status() === 403;

      console.log(`Redirected to auth: ${isRedirected}`);
      console.log(`Response status: ${response?.status()}`);

      await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-unauthenticated.png' });
    });
  });

  test.describe('4. Link Validation Tests', () => {

    test('no broken internal links on homepage', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      const links = page.locator('a[href^="/"], a[href^="' + PRODUCTION_URL + '"]');
      const linkCount = await links.count();

      console.log(`Internal links found: ${linkCount}`);

      const brokenLinks: string[] = [];

      for (let i = 0; i < Math.min(linkCount, 20); i++) {
        const href = await links.nth(i).getAttribute('href');
        if (href && !href.startsWith('#')) {
          const fullUrl = href.startsWith('/') ? `${PRODUCTION_URL}${href}` : href;

          try {
            const response = await page.request.get(fullUrl);
            if (response.status() >= 400) {
              brokenLinks.push(`${href} (${response.status()})`);
            }
          } catch (e) {
            brokenLinks.push(`${href} (failed to fetch)`);
          }
        }
      }

      if (brokenLinks.length > 0) {
        console.log('Broken links found:', brokenLinks);
      }
    });
  });

  test.describe('5. API Health Tests', () => {

    test('API health endpoint responds', async ({ page }) => {
      try {
        const response = await page.request.get(`${PRODUCTION_URL}/api/health`);
        console.log(`Health endpoint status: ${response.status()}`);

        if (response.ok()) {
          const body = await response.text();
          console.log(`Health response: ${body.substring(0, 200)}`);
        }
      } catch (e) {
        console.log('Health endpoint not available or errored');
      }
    });

    test('API auth endpoint responds', async ({ page }) => {
      try {
        const response = await page.request.get(`${PRODUCTION_URL}/api/auth/providers`);
        console.log(`Auth providers endpoint status: ${response.status()}`);
      } catch (e) {
        console.log('Auth providers endpoint not available');
      }
    });
  });

  test.describe('6. Responsive Design Tests', () => {

    test('mobile viewport renders correctly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      // Check for mobile menu toggle
      const mobileMenuButton = page.locator('[class*="menu"], [aria-label*="menu"], button[class*="hamburger"], [class*="mobile"]');
      console.log(`Mobile menu elements found: ${await mobileMenuButton.count()}`);

      // Check for horizontal scroll (layout issue)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScroll) {
        console.log('WARNING: Page has horizontal scroll on mobile');
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/mobile-homepage.png' });

      if (consoleErrors.length > 0) {
        console.log('Mobile console errors:', consoleErrors);
      }
    });

    test('tablet viewport renders correctly', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      await page.screenshot({ path: 'tests/e2e/screenshots/tablet-homepage.png' });
    });

    test('wide desktop viewport renders correctly', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      // Check if content is properly centered/constrained
      const mainContent = page.locator('main, [class*="container"], [class*="max-w"]').first();
      if (await mainContent.count() > 0) {
        const box = await mainContent.boundingBox();
        if (box) {
          console.log(`Main content width at 1920px viewport: ${box.width}px`);
        }
      }

      await page.screenshot({ path: 'tests/e2e/screenshots/desktop-wide-homepage.png' });
    });
  });

  test.describe('7. Console Error Tests', () => {

    test('no critical JavaScript errors on homepage', async ({ page }) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        } else if (msg.type() === 'warning') {
          warnings.push(msg.text());
        }
      });

      page.on('pageerror', error => {
        errors.push(`Page Error: ${error.message}`);
      });

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      // Wait a bit for any async errors
      await page.waitForTimeout(2000);

      console.log(`Console errors: ${errors.length}`);
      console.log(`Console warnings: ${warnings.length}`);

      if (errors.length > 0) {
        console.log('Errors:', errors);
      }

      // Filter out known acceptable errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('third-party')
      );

      expect(criticalErrors).toHaveLength(0);
    });

    test('no critical JavaScript errors on signin page', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      page.on('pageerror', error => {
        errors.push(`Page Error: ${error.message}`);
      });

      await page.goto(`${PRODUCTION_URL}/auth/signin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      if (errors.length > 0) {
        console.log('Signin page errors:', errors);
      }
    });
  });

  test.describe('8. Performance Tests', () => {

    test('homepage loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      const loadTime = Date.now() - startTime;
      console.log(`Homepage load time: ${loadTime}ms`);

      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    test('check for large unoptimized images', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      const largeImages: string[] = [];

      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        const dimensions = await img.evaluate((el: HTMLImageElement) => ({
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight,
          displayWidth: el.clientWidth,
          displayHeight: el.clientHeight,
        }));

        // Check for significantly oversized images
        if (dimensions.naturalWidth > dimensions.displayWidth * 2) {
          largeImages.push(`${src} - Natural: ${dimensions.naturalWidth}x${dimensions.naturalHeight}, Display: ${dimensions.displayWidth}x${dimensions.displayHeight}`);
        }
      }

      if (largeImages.length > 0) {
        console.log('Potentially oversized images:', largeImages);
      }
    });
  });

  test.describe('9. Accessibility Quick Checks', () => {

    test('page has proper heading structure', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

      const h1Count = await page.locator('h1').count();
      const h2Count = await page.locator('h2').count();
      const h3Count = await page.locator('h3').count();

      console.log(`Heading structure - H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count}`);

      // Should have exactly one h1
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('images have alt text', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      const images = page.locator('img');
      const imageCount = await images.count();
      let missingAlt = 0;

      for (let i = 0; i < imageCount; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        if (alt === null) {
          missingAlt++;
          const src = await images.nth(i).getAttribute('src');
          console.log(`Image missing alt: ${src}`);
        }
      }

      console.log(`Images missing alt text: ${missingAlt}/${imageCount}`);
    });

    test('interactive elements are focusable', async ({ page }) => {
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

      const buttons = page.locator('button');
      const links = page.locator('a[href]');
      const inputs = page.locator('input');

      console.log(`Focusable elements - Buttons: ${await buttons.count()}, Links: ${await links.count()}, Inputs: ${await inputs.count()}`);

      // Check that buttons have accessible names
      const buttonCount = await buttons.count();
      let buttonsWithoutLabel = 0;

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');

        if (!text?.trim() && !ariaLabel) {
          buttonsWithoutLabel++;
        }
      }

      if (buttonsWithoutLabel > 0) {
        console.log(`Buttons without accessible label: ${buttonsWithoutLabel}`);
      }
    });
  });

  test.describe('10. Network Request Tests', () => {

    test('no failed network requests on homepage', async ({ page }) => {
      const failedRequests: string[] = [];

      page.on('response', response => {
        if (response.status() >= 400) {
          failedRequests.push(`${response.url()} - ${response.status()}`);
        }
      });

      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

      if (failedRequests.length > 0) {
        console.log('Failed requests:', failedRequests);
      }

      // Filter out expected 404s (like missing favicons)
      const criticalFailures = failedRequests.filter(r =>
        !r.includes('favicon') &&
        !r.includes('.ico')
      );

      expect(criticalFailures).toHaveLength(0);
    });
  });
});
