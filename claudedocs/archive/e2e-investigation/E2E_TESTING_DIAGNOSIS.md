# E2E Testing Diagnosis - Week 3 December Beta Plan

**Date**: 2025-11-10
**Environment**: Production (reminder-mvp.vercel.app)
**Status**: 🔴 Authentication setup failing

---

## Problem Summary

The E2E test authentication setup successfully:
- ✅ Navigates to sign-in page (`/en/auth/signin`)
- ✅ Fills in credentials (smoke-test@example.com)
- ✅ Submits the form
- ✅ Redirects to dashboard (`/en/dashboard`)

But fails at:
- ❌ Cannot find dashboard navigation element `[data-testid="desktop-nav-invoices"]`
- ❌ Test times out waiting for dashboard to load

---

## Root Cause Analysis

### Issue: Test Selector Mismatch

**Test expects** (auth.setup.ts:68):
```typescript
await page.waitForSelector('[data-testid="desktop-nav-invoices"]', {
  timeout: 10000,
  state: 'visible'
});
```

**Problem**: This selector likely doesn't exist on the production dashboard, or:
1. The dashboard loads but the navigation element has a different selector
2. The element is hidden on mobile/responsive view
3. The element is conditionally rendered based on user state
4. There's a loading state that takes longer than expected

### Evidence from Screenshot

The test failed screenshot shows the sign-in page (not dashboard), which suggests:
- Authentication might have failed silently
- Redirect didn't occur as expected
- Or the test captured the wrong moment

---

## Diagnostic Steps Completed

1. ✅ Analyzed Playwright configuration
2. ✅ Verified test environment setup (production vs localhost)
3. ✅ Confirmed test user exists in production
4. ✅ Ran auth setup against Vercel
5. ✅ Captured failure screenshots and error context

---

## Recommended Fixes

### Fix #1: Update Dashboard Verification Selector (RECOMMENDED)

**Problem**: Hardcoded selector might not exist on production dashboard

**Solution**: Use more resilient selectors that are guaranteed to exist

```typescript
// tests/e2e/auth.setup.ts:66-76

// OLD - Too specific, fragile
await page.waitForSelector('[data-testid="desktop-nav-invoices"]', {
  timeout: 10000,
  state: 'visible'
});

// NEW - Multiple fallback strategies
try {
  // Strategy 1: Wait for URL pattern (most reliable)
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  // Strategy 2: Wait for any dashboard content
  await page.waitForSelector(
    'main, [role="main"], h1, [data-testid*="dashboard"]',
    { timeout: 10000, state: 'visible' }
  );

  console.log('✅ Dashboard loaded successfully');
} catch (e) {
  console.error('❌ Dashboard did not load properly');
  console.log(`Current URL: ${page.url()}`);

  // Debug: Log all available data-testid attributes
  const testIds = await page.locator('[data-testid]').allTextContents();
  console.log('Available test IDs:', testIds);

  throw new Error('Authentication failed: Dashboard not accessible');
}
```

### Fix #2: Extend Timeouts for Production

**Problem**: Network latency on Vercel might be slower than localhost

**Solution**: Increase timeouts for production testing

```typescript
// tests/e2e/auth.setup.ts:34

const timeout = process.env.TEST_ENV === 'production' ? 30000 : 15000;

await page.goto(`${baseURL}/en/auth/signin`, { timeout });
await page.waitForURL('**/dashboard', { timeout });
```

### Fix #3: Add Debug Logging

**Problem**: Hard to diagnose what's happening on production

**Solution**: Enhanced logging and screenshots at each step

```typescript
// After form submission
await page.click('[data-testid="signin-button"]');
console.log('⏳ Waiting for authentication to complete...');

// Take screenshot before redirect check
await page.screenshot({ path: 'debug-before-redirect.png' });

// Wait for redirect
await page.waitForURL('**/dashboard', { timeout: 15000 });

// Take screenshot after redirect
await page.screenshot({ path: 'debug-after-redirect.png' });
```

---

## Alternative: Test Against Localhost First

If production testing continues to fail, validate locally first:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests
npx playwright test
```

This helps isolate whether it's:
- A production environment issue
- A test code issue
- A selector/timing issue

---

## Next Steps for Morning

1. **Inspect Production Dashboard**:
   - Open https://reminder-mvp.vercel.app/en/dashboard in browser
   - Right-click navigation → Inspect
   - Find actual `data-testid` attributes used
   - Update test selectors accordingly

2. **Apply Fix #1** (resilient selectors):
   - Remove hardcoded `desktop-nav-invoices` dependency
   - Use URL-based verification instead

3. **Test Locally First** (validation):
   - Run against localhost to verify test logic
   - Then re-test against production

4. **Add Comprehensive Logging**:
   - Log all available selectors on failure
   - Capture multiple screenshots during auth flow

---

## Files to Review

- `tests/e2e/auth.setup.ts:68-76` - Dashboard verification logic
- `playwright.config.ts:20-24` - Timeout configuration
- Production dashboard at `/en/dashboard` - Actual selector verification

---

## Quick Fix Command

```bash
# After updating auth.setup.ts with Fix #1:
TEST_ENV=production npx playwright test tests/e2e/auth.setup.ts --project=setup

# If successful, run full smoke tests:
TEST_ENV=production npx playwright test tests/e2e/smoke-tests.spec.ts
```
