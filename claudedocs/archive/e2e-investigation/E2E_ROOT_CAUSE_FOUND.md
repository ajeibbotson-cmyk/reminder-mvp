# E2E Testing Root Cause - NEXTAUTH_URL Configuration Issue

**Date**: 2025-11-11
**Status**: 🔴 **ROOT CAUSE IDENTIFIED**
**Environment**: Production (Vercel)

---

## Root Cause Summary

The E2E tests are failing because **NextAuth is not configured correctly for Vercel production**. The authentication appears to succeed, but then the session immediately fails and redirects back to signin.

###  Evidence

**Test Output Shows:**
```
✅ Successfully redirected to dashboard
Current URL: https://reminder-mvp.vercel.app/en/dashboard
...
❌ Dashboard did not load properly
Current URL: https://reminder-mvp.vercel.app/en/auth/signin  ⬅️ REDIRECTED BACK!
```

The URL goes from `/dashboard` → `/signin`, meaning:
1. Authentication succeeds ✅
2. Redirect to dashboard works ✅
3. Session check fails ❌
4. Middleware redirects back to signin ❌

---

## The Problem: Environment Variable Mismatch

### Issue #1: NEXTAUTH_URL is Wrong for Production

**Your `.env` file** (`src/lib/auth.ts:11-14`):
```env
NEXTAUTH_URL="http://localhost:3001"  ⬅️ WRONG FOR VERCEL!
```

**What Vercel needs**:
```env
NEXTAUTH_URL="https://reminder-mvp.vercel.app"
```

**Why this breaks**:
- NextAuth uses `NEXTAUTH_URL` to generate secure cookies
- Cookie domain mismatch causes session validation to fail
- Middleware sees no valid session → redirects to signin

### Issue #2: Secure Cookies Configuration

**Your code** (`src/lib/auth.ts:11`):
```typescript
useSecureCookies: process.env.VERCEL_ENV === "production" || process.env.NEXTAUTH_URL?.includes("vercel.app"),
```

**Problems**:
1. `VERCEL_ENV` might be `"preview"` instead of `"production"`
2. Checking `NEXTAUTH_URL.includes("vercel.app")` works BUT only if `NEXTAUTH_URL` is set correctly on Vercel
3. Currently `NEXTAUTH_URL` is `localhost:3001` so this check fails

---

## How To Fix

### Fix #1: Set Vercel Environment Variables (CRITICAL)

Go to Vercel Dashboard → Project Settings → Environment Variables:

**Add/Update these**:
```
NEXTAUTH_URL = https://reminder-mvp.vercel.app
NEXTAUTH_SECRET = [your-secret-from-local-.env]
```

**For both**:
- ✅ Production
- ✅ Preview
- ✅ Development

### Fix #2: Improve NextAuth Configuration (RECOMMENDED)

Update `src/lib/auth.ts:10-24` to be more robust:

```typescript
// Detect production environment more reliably
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL_URL?.includes("vercel.app") ||
  process.env.NEXTAUTH_URL?.startsWith("https://");

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      name: isProduction
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  // ... rest of config
}
```

### Fix #3: Add Debug Logging (TEMPORARY)

Add this to see what's happening in production logs:

```typescript
// In src/lib/auth.ts at the top
console.log('🔧 NextAuth Config:', {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  useSecureCookies: isProduction,
});
```

---

## Testing the Fix

### Step 1: Update Vercel Environment Variables
```bash
# Via Vercel Dashboard or CLI
vercel env add NEXTAUTH_URL
# Enter: https://reminder-mvp.vercel.app

# Verify secret matches local
vercel env add NEXTAUTH_SECRET
# Enter: [same value from local .env]
```

### Step 2: Redeploy to Apply Changes
```bash
git commit -m "docs: Update E2E testing documentation"
git push origin main
# Or trigger manual deployment in Vercel dashboard
```

### Step 3: Wait for Deployment
- Vercel will redeploy with new environment variables
- This takes ~2-3 minutes

### Step 4: Re-test E2E
```bash
TEST_ENV=production npx playwright test tests/e2e/auth.setup.ts --project=setup
```

**Expected result**: ✅ Should pass and create auth state file

---

## Why This Wasn't Obvious

1. **Silent failure**: No error message shown to user
2. **Successful signin**: Authentication works, session creation fails
3. **Immediate redirect**: Happens so fast the test can't see it
4. **URL changes**: `/dashboard` → `/signin` in milliseconds

---

## Alternative: Test Locally First

While waiting for Vercel fixes, validate locally:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run E2E tests
npx playwright test tests/e2e/auth.setup.ts --project=setup
```

This will:
- Use `localhost:3001` (correct NEXTAUTH_URL)
- Create auth state file
- Validate test logic works
- Prove it's a production config issue

---

## Verification Checklist

After applying fixes, verify:

- [ ] Vercel environment variables updated
- [ ] `NEXTAUTH_URL` = `https://reminder-mvp.vercel.app`
- [ ] `NEXTAUTH_SECRET` matches local `.env`
- [ ] Vercel deployment completed successfully
- [ ] Manual signin works at https://reminder-mvp.vercel.app/en/auth/signin
- [ ] Dashboard stays loaded (doesn't redirect back)
- [ ] E2E auth setup test passes
- [ ] Auth state file created: `playwright/.auth/user.json`

---

## Quick Fix Commands

```bash
# 1. Set Vercel env vars (use Vercel dashboard)
# https://vercel.com/your-account/reminder-mvp/settings/environment-variables

# 2. (Optional) Improve auth config locally
# Edit src/lib/auth.ts lines 10-24 as shown above

# 3. Test locally to validate test logic
npm run dev  # Terminal 1
npx playwright test tests/e2e/auth.setup.ts --project=setup  # Terminal 2

# 4. Push changes and wait for Vercel deployment
git add .
git commit -m "fix: Update NextAuth configuration for Vercel"
git push origin main

# 5. Test production after deployment
TEST_ENV=production npx playwright test tests/e2e/auth.setup.ts --project=setup
```

---

## Expected Timeline

- **Immediate**: Update Vercel environment variables (5 minutes)
- **Wait**: Vercel redeployment (2-3 minutes)
- **Test**: Run E2E tests against production (30 seconds)
- **Total**: ~10 minutes to fix

---

## Success Criteria

When fixed, you'll see:

```
🔐 Setting up authentication...
📍 Using base URL: https://reminder-mvp.vercel.app
🔑 Attempting to sign in with: smoke-test@example.com
⏳ Waiting for authentication to complete...
✅ Successfully redirected to dashboard
Current URL: https://reminder-mvp.vercel.app/en/dashboard
✅ Dashboard loaded successfully  ⬅️ THIS WILL PASS!
🍪 Cookies found: ['__Secure-next-auth.session-token', ...]
✅ Session established
💾 Saved auth state to: playwright/.auth/user.json
✅ Authentication setup complete!
```

Then all other E2E tests will work! 🎉
