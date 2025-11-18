# E2E Testing Plan - Mock Auth Strategy

**Date**: 2025-11-11
**Status**: ✅ Mock auth working - 7/8 smoke tests passing on production

---

## Executive Summary

Successfully bypassed the real authentication issue by implementing mock auth. Now able to test against production with **87.5% of smoke tests passing** (7/8).

---

## Current Test Results

### Smoke Tests on Production
```bash
TEST_ENV=production npx playwright test tests/e2e/smoke-tests.spec.ts --project=chromium
```

**Results:**
- ✅ Homepage loads successfully
- ✅ Login page is accessible
- ✅ Dashboard loads for authenticated user
- ✅ Invoices page is accessible
- ✅ Buckets page is accessible
- ✅ PDF upload is accessible
- ✅ API health check passes
- ❌ Complete Reminder flow (timeout on test ID - needs fixing)

**Pass Rate**: 7/8 (87.5%)

---

## Mock Auth Implementation

### Files Created

**`tests/helpers/mock-auth.ts`**
- Bypasses NextAuth by mocking `/api/auth/session` endpoint
- Default test user with ADMIN role
- Supports custom user scenarios

**Usage:**
```typescript
import { mockAuth } from '../helpers/mock-auth';

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test('my test', async ({ page }) => {
  await page.goto('/en/dashboard');
  // Test authenticated pages without real login
});
```

### Playwright Config Updated

**`playwright.config.ts`** - Simplified to single chromium project:
- Removed setup/dependency projects
- Uses mock auth (no auth file needed)
- Works on both local and production (`TEST_ENV=production`)

---

## Test Files Status

### ✅ Updated with Mock Auth
1. `smoke-tests.spec.ts` - 7/8 passing
2. `pdf-upload.spec.ts` - Ready to test

### 🚧 Need Mock Auth Added
3. `payment-recording-flow.spec.ts`
4. `bucket-invoice-management.spec.ts`
5. `user-journey.spec.ts`
6. `invoice-workflow-e2e.spec.ts`
7. `dashboard-hybrid.spec.ts`
8. `bucket-auto-send-flow.spec.ts`
9. `pdf-upload-chase-flow.spec.ts`
10. `csv-import-flow.spec.ts`

### ⏭️ Skip (Tests Real Auth)
- `auth-flow.spec.ts` - Tests actual login flow
- `auth.setup.ts` - Old real auth approach

---

## Testing Strategy Going Forward

### Local Development Testing
```bash
# Start dev server
npm run dev

# Run tests against localhost
npx playwright test --project=chromium
```

### Production Validation
```bash
# Run smoke tests against production
TEST_ENV=production npx playwright test tests/e2e/smoke-tests.spec.ts --project=chromium

# Run all E2E tests against production
TEST_ENV=production npx playwright test --project=chromium
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: TEST_ENV=production npx playwright test --project=chromium
  env:
    NEXTAUTH_URL: https://reminder-mvp.vercel.app
    NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
```

---

## Next Steps to Complete Testing

### Phase 1: Fix Failing Test (Immediate)
**File:** `smoke-tests.spec.ts:99` - Complete Reminder flow test

**Issue:** Timeout waiting for `desktop-nav-invoices` test ID

**Fix:**
1. Check if element exists on production
2. Update selector or increase timeout
3. Add better error handling

### Phase 2: Add Mock Auth to Remaining Tests (1-2 hours)

**Approach:** For each test file:
1. Add `import { mockAuth } from '../helpers/mock-auth';`
2. Add `test.beforeEach(async ({ page }) => { await mockAuth(page); });`
3. Remove manual login code blocks
4. Update navigation to go directly to authenticated pages

**Example Conversion:**
```typescript
// OLD (manual login in every test)
test('invoice test', async ({ page }) => {
  await page.goto('/en/auth/signin');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  // ... actual test
});

// NEW (with mock auth)
test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test('invoice test', async ({ page }) => {
  await page.goto('/en/dashboard/invoices');
  // ... actual test
});
```

### Phase 3: Run Full Test Suite (30 mins)

```bash
# Run all tests locally
npx playwright test --project=chromium

# Run all tests against production
TEST_ENV=production npx playwright test --project=chromium
```

**Expected Results:**
- Goal: 60+ passing tests (out of ~63)
- Acceptable: 50+ passing (80% pass rate)

### Phase 4: Document & Optimize (30 mins)

1. **Create Test Report:**
   - List all passing tests
   - Document any failures with root causes
   - Identify tests that need updates

2. **Create Test Maintenance Guide:**
   - How to add new tests
   - Mock auth best practices
   - Running tests in CI/CD

3. **Set up Test Scripts:**
   ```json
   // package.json
   {
     "scripts": {
       "test:e2e": "playwright test --project=chromium",
       "test:e2e:prod": "TEST_ENV=production playwright test --project=chromium",
       "test:smoke": "playwright test tests/e2e/smoke-tests.spec.ts",
       "test:smoke:prod": "TEST_ENV=production playwright test tests/e2e/smoke-tests.spec.ts"
     }
   }
   ```

---

## Benefits of Mock Auth Approach

### ✅ Advantages
1. **Fast & Reliable:** No authentication timing issues
2. **No Auth Dependencies:** Tests run without real auth flow
3. **Flexible:** Can test different user roles easily
4. **Production Safe:** Works on both local and production
5. **Simple:** Easy to understand and maintain

### ⚠️ Limitations
1. **Doesn't Test Real Auth:** Need separate tests for login flow
2. **Mock Can Diverge:** Keep mock user data realistic
3. **Session Edge Cases:** May miss some auth edge cases

### 🎯 Best Use Cases
- Testing business logic and workflows
- Testing UI components and navigation
- Regression testing after deployments
- Testing API integrations
- Performance testing

---

## Test Coverage Goals

### Critical Paths (Must Pass)
- ✅ Homepage loads
- ✅ Dashboard accessible
- ✅ Invoice listing works
- ✅ PDF upload accessible
- ⏳ Complete invoice workflow (needs fix)

### Important Paths (Should Pass)
- Payment recording flow
- Bucket management
- CSV import
- Email automation triggers

### Nice to Have
- Edge cases
- Error handling
- Multi-user scenarios

---

## Troubleshooting Guide

### Test Fails with "Session not found"
**Cause:** Mock auth not called before test
**Fix:** Add `test.beforeEach(async ({ page }) => { await mockAuth(page); });`

### Test Fails with "Element not found"
**Cause:** UI changed or wrong environment
**Fix:**
1. Check screenshot in `test-results/`
2. Update selector
3. Verify page actually loads

### Tests Pass Locally But Fail on Production
**Cause:** Environment differences
**Fix:**
1. Check production deployment is complete
2. Verify environment variables on Vercel
3. Check for production-specific issues (HTTPS, cookies, etc.)

### All Tests Timeout
**Cause:** Dev server not running (for local) or network issues (for production)
**Fix:**
1. Local: Start `npm run dev`
2. Production: Check Vercel status
3. Check network/firewall

---

## Success Metrics

**Current:** 7/8 smoke tests passing (87.5%)
**Phase 1 Target:** 8/8 smoke tests passing (100%)
**Phase 2 Target:** 9 test files with mock auth
**Phase 3 Target:** 60+/63 total tests passing (95%+)

---

## Commands Reference

```bash
# Smoke tests (quick validation)
TEST_ENV=production npx playwright test tests/e2e/smoke-tests.spec.ts

# All E2E tests
TEST_ENV=production npx playwright test --project=chromium

# Specific test file
TEST_ENV=production npx playwright test tests/e2e/invoice-workflow-e2e.spec.ts

# Show test report
npx playwright show-report

# Debug mode
TEST_ENV=production npx playwright test --debug

# Headed mode (see browser)
TEST_ENV=production npx playwright test --headed
```
