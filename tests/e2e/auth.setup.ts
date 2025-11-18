/**
 * Playwright Global Auth Setup - Form-Based Authentication
 *
 * This uses the actual sign-in form to authenticate, which properly triggers
 * NextAuth's session creation and cookie setting. API-based auth doesn't work
 * because NextAuth needs the full browser flow to set session cookies correctly.
 */

import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ browser }) => {
  console.log('🔐 Setting up authentication...');

  // Use the baseURL from playwright config (supports production via TEST_ENV=production)
  const baseURL = process.env.TEST_ENV === 'production'
    ? 'https://reminder-mvp.vercel.app'
    : (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001');
  console.log(`📍 Using base URL: ${baseURL}`);

  // Create a new context that we can control
  // For production HTTPS, we need to accept insecure certificates
  const isProduction = process.env.TEST_ENV === 'production';
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: isProduction,
    // Accept all cookies including __Secure- prefixed ones
    acceptDownloads: true,
  });
  const page = await context.newPage();

  // Use existing test user credentials
  const testEmail = 'smoke-test@example.com';
  const testPassword = 'SmokeTest123!';

  console.log(`🔑 Attempting to sign in with: ${testEmail}`);

  // Navigate to sign-in page
  await page.goto(`${baseURL}/en/auth/signin`, { timeout: 15000 });
  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 10000 });

  // Fill in the sign-in form
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);

  // Submit the form and wait for navigation
  await page.click('[data-testid="signin-button"]');

  console.log('⏳ Waiting for authentication to complete...');

  // Wait a moment for form submission to process
  await page.waitForTimeout(1000);

  // Check for error messages on signin page BEFORE checking redirect
  const errorText = await page.locator('[role="alert"], .error-message, .text-red-500, .text-destructive').first().textContent().catch(() => null);
  if (errorText) {
    console.error(`❌ Authentication error shown: ${errorText}`);
    throw new Error(`Authentication failed: ${errorText}`);
  }

  // Wait for redirect to dashboard
  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✅ Successfully redirected to dashboard');
    console.log(`Current URL: ${page.url()}`);

    // Check cookies immediately after redirect
    const cookies = await context.cookies();
    console.log('🍪 Cookies immediately after redirect:', cookies.map(c => c.name));
    const sessionCookie = cookies.find(c => c.name.includes('session-token'));
    if (sessionCookie) {
      console.log(`✅ Session cookie found: ${sessionCookie.name}`);
      console.log(`   Domain: ${sessionCookie.domain}`);
      console.log(`   Path: ${sessionCookie.path}`);
      console.log(`   Secure: ${sessionCookie.secure}`);
      console.log(`   HttpOnly: ${sessionCookie.httpOnly}`);
      console.log(`   SameSite: ${sessionCookie.sameSite}`);
    } else {
      console.error('❌ No session cookie found after redirect!');
    }
  } catch (e) {
    console.error('❌ Failed to redirect to dashboard');
    console.log(`Current URL: ${page.url()}`);

    // Take screenshot of signin page
    await page.screenshot({ path: 'test-results/signin-failure.png' });

    throw new Error(`Authentication failed: Did not redirect to dashboard. Current URL: ${page.url()}`);
  }

  // Give NextAuth time to set all cookies
  await page.waitForTimeout(2000);

  // Check what page we're actually on
  const currentUrl = page.url();
  console.log(`Current URL after wait: ${currentUrl}`);

  // If we got redirected back to signin, check for error messages
  if (currentUrl.includes('/auth/signin')) {
    console.error('❌ Redirected back to signin page');

    // Check for any error/alert messages
    const alertText = await page.locator('[role="alert"]').textContent().catch(() => null);
    if (alertText) {
      console.error(`❌ Error message: ${alertText}`);
    }

    // Check cookies at this point
    const cookies = await context.cookies();
    console.log('🍪 Cookies after redirect:', cookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`));

    await page.screenshot({ path: 'test-results/signin-redirect-failure.png' });
    throw new Error(`Authentication failed: Redirected to signin. Alert: ${alertText || 'none'}`);
  }

  // Verify we can see dashboard content - using resilient verification
  try {
    // Strategy 1: Wait for any main dashboard content (more reliable than specific nav element)
    await page.waitForSelector('main, [role="main"], h1', {
      timeout: 15000,
      state: 'visible'
    });
    console.log('✅ Dashboard loaded successfully');
  } catch (e) {
    console.error('❌ Dashboard did not load properly');
    console.log(`Current URL: ${page.url()}`);

    // Debug: Take screenshot and log page content
    await page.screenshot({ path: 'test-results/dashboard-load-failure.png' });
    const pageContent = await page.content();
    console.log('Page HTML length:', pageContent.length);

    throw new Error('Authentication failed: Dashboard not accessible');
  }

  // Verify session cookies exist
  const cookies = await page.context().cookies();
  console.log('🍪 Cookies found:', cookies.map(c => c.name));

  const sessionCookie = cookies.find(c =>
    c.name.includes('next-auth.session-token') ||
    c.name.includes('__Secure-next-auth.session-token')
  );

  if (!sessionCookie) {
    console.error('❌ NextAuth session cookie not found');
    console.log('Available cookies:', cookies.map(c => c.name));
    throw new Error('Authentication failed: No session cookie created');
  }

  console.log('✅ Session established');
  console.log(`📝 Session cookie: ${sessionCookie.name}`);
  console.log(`🔑 Cookie value length: ${sessionCookie.value.length} characters`);

  // Save the authenticated state for all other tests
  await page.context().storageState({ path: authFile });
  console.log(`💾 Saved auth state to: ${authFile}`);
  console.log('✅ Authentication setup complete!');

  // Close context to clean up
  await context.close();
});
