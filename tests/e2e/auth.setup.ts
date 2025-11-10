/**
 * Playwright Global Auth Setup - API-Level Authentication
 *
 * This bypasses the UI and authenticates directly via NextAuth's API endpoints.
 * This approach is necessary because Playwright can't properly trigger React form handlers.
 *
 * Strategy: Use Playwright's request context to make direct API calls to NextAuth,
 * then use the returned cookies for all subsequent tests.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ browser }) => {
  console.log('🔐 Setting up authentication...');

  // Use the baseURL from playwright config (supports production via TEST_ENV=production)
  const baseURL = process.env.TEST_ENV === 'production'
    ? 'https://reminder-mvp.vercel.app'
    : (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001');
  console.log(`📍 Using base URL: ${baseURL}`);

  // Create a new context that we can control
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  // FIRST: Try to create user via UI signup (if user exists, it will fail and we'll login instead)
  console.log('🔧 Attempting to create/verify test user...');
  let userCreated = false;
  try {
    await page.goto(`${baseURL}/en/auth/signup`, { timeout: 15000 });

    // Wait for form to be ready
    await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 10000 });

    // Fill in signup form
    await page.fill('input[name="name"]', 'Smoke Test User');
    await page.fill('input[name="email"]', 'smoke-test@example.com');
    await page.fill('input[name="password"]', 'SmokeTest123!');
    await page.fill('input[name="company"]', 'Smoke Test Company');

    // Submit and wait for either dashboard or error
    await Promise.race([
      page.click('button[type="submit"]'),
      page.waitForTimeout(1000)
    ]);

    // Check if we reached dashboard (user created successfully)
    try {
      await page.waitForURL('**/dashboard', { timeout: 8000 });
      console.log('✅ Test user created successfully via signup');
      userCreated = true;

      // Save auth state immediately
      await page.context().storageState({ path: authFile });
      console.log('💾 Saved authentication state');
      return; // Success! We're done
    } catch (e) {
      console.log('ℹ️  Signup did not redirect to dashboard - user may already exist');
    }
  } catch (error) {
    console.log(`ℹ️  Signup attempt completed (${error.message}) - will try login`);
  }

  // If we get here, user either exists or signup failed - try to login via API
  if (!userCreated) {
    console.log('🔄 User exists or signup failed, attempting login via API...');
  }

  // Method 1: Get CSRF token
  await page.goto(`${baseURL}/api/auth/csrf`);
  const csrfData = await page.evaluate(() => {
    return JSON.parse(document.body.textContent || '{}');
  });
  const csrfToken = csrfData.csrfToken;

  console.log('✅ CSRF token obtained');

  // Method 2: Make auth request via fetch in the page context
  // This ensures cookies are set in the same context
  const authResult = await page.evaluate(async ({ email, password, token, base }) => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('csrfToken', token);
    formData.append('callbackUrl', `${base}/en/dashboard`); // Full URL with correct port
    formData.append('json', 'true');

    const response = await fetch('/api/auth/signin/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      credentials: 'include' // Important: include cookies
    });

    const data = await response.json();

    return {
      status: response.status,
      url: response.url,
      ok: response.ok,
      redirectUrl: data.url,
      error: data.error
    };
  }, {
    email: 'smoke-test@example.com',
    password: 'SmokeTest123!',
    token: csrfToken,
    base: baseURL
  });

  console.log('✅ Auth API response:', authResult.status);
  console.log('📍 Auth result:', JSON.stringify(authResult, null, 2));

  if (!authResult.ok || authResult.error) {
    console.error('❌ Authentication failed:', authResult.error || authResult.status);
    throw new Error(`Authentication failed: ${authResult.error || authResult.status}`);
  }

  console.log('✅ Authentication successful via API');

  // Check if redirect goes to dashboard (success) or signin (failure)
  if (authResult.redirectUrl && authResult.redirectUrl.includes('/signin')) {
    console.error(`❌ Auth failed - redirected to signin page: ${authResult.redirectUrl}`);
    throw new Error('Authentication failed - credentials may be incorrect');
  }

  // Navigate to dashboard
  console.log(`🔀 Navigating to dashboard...`);
  await page.goto(`${baseURL}/en/dashboard`);

  // Wait for dashboard to fully load
  await page.waitForSelector('a:has-text("Invoices")', {
    timeout: 15000,
    state: 'visible'
  });

  // Verify we're authenticated
  const url = page.url();
  expect(url).toContain('/en/dashboard');

  // Verify session cookies exist
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c =>
    c.name.includes('next-auth.session-token') ||
    c.name.includes('__Secure-next-auth.session-token')
  );

  if (!sessionCookie) {
    console.error('❌ NextAuth session cookie not found');
    console.log('Available cookies:', cookies.map(c => c.name));
    throw new Error('Authentication failed: No session cookie');
  }

  console.log('✅ Session established');
  console.log(`📝 Session cookie: ${sessionCookie.name}`);
  console.log(`🔑 Cookie value length: ${sessionCookie.value.length}`);

  // Save the authenticated state
  await page.context().storageState({ path: authFile });

  console.log(`💾 Saved auth state to: ${authFile}`);
  console.log('✅ Authentication setup complete');
});
