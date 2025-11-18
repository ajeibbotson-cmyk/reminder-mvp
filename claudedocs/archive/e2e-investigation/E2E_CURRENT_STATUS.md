# E2E Testing Current Status - Session Issue on Vercel

**Date**: 2025-11-11
**Status**: 🔴 Authentication succeeds but session fails to persist
**Environment**: Production (Vercel)

---

## What We've Fixed So Far

✅ **Build Issues**:
- Fixed `use-toast` import error (switched to `sonner`)
- Added `DIRECT_URL` environment variable for Prisma
- Deployment now builds successfully

✅ **Environment Variables Set on Vercel**:
- `NEXTAUTH_URL` = `https://reminder-mvp.vercel.app`
- `NEXTAUTH_SECRET` = `xSEUx4xvDjK2sdpf0nHHhTEdNO/JgBTbCnKdydjZLu4=`
- `DIRECT_URL` = Direct database connection
- `DATABASE_URL` = Pooled connection

✅ **Test User Exists**:
- Email: `smoke-test@example.com`
- Password: `SmokeTest123!`
- Confirmed in production Supabase database

---

## Current Problem

**Symptom**: Authentication appears to succeed but session immediately fails

**Evidence from test output**:
```
✅ Successfully redirected to dashboard
Current URL: https://reminder-mvp.vercel.app/en/dashboard
❌ Dashboard did not load properly
Current URL: https://reminder-mvp.vercel.app/en/auth/signin
```

The URL changes from `/dashboard` → `/signin` in milliseconds, indicating:
1. Login succeeds ✅
2. Initial redirect works ✅
3. Session check fails ❌
4. Middleware redirects back to signin ❌

---

## Verification Checklist

### 1. Verify Environment Variables on Vercel

Go to: Vercel → reminder-mvp → Settings → Environment Variables

**Check these are EXACTLY correct**:

- [ ] `NEXTAUTH_URL` = `https://reminder-mvp.vercel.app`
  - No `http://`
  - No trailing slash
  - Exactly matches production domain

- [ ] `NEXTAUTH_SECRET` = `xSEUx4xvDjK2sdpf0nHHhTEdNO/JgBTbCnKdydjZLu4=`
  - Exactly matches local `.env`
  - No extra quotes
  - No extra spaces

- [ ] All variables are set for: Production, Preview, Development

### 2. Manual Login Test

**Test in browser**:
1. Open: https://reminder-mvp.vercel.app/en/auth/signin
2. Enter:
   - Email: `smoke-test@example.com`
   - Password: `SmokeTest123!`
3. Click Sign In
4. **Expected**: Stay on dashboard
5. **Actual**: Does it redirect back to signin?

**If it works in browser but not in E2E test**: Cookie/session issue specific to Playwright
**If it fails in browser too**: NextAuth configuration issue on Vercel

### 3. Check Vercel Runtime Logs

Go to: Vercel → reminder-mvp → Deployments → [Latest] → Functions

Look for errors related to:
- NextAuth session creation
- Cookie setting failures
- JWT token generation errors
- Database connection issues during auth

### 4. Verify Middleware Configuration

The middleware at `src/middleware.ts` might be too strict. Check if it's redirecting authenticated users.

---

## Possible Root Causes

### Theory 1: Cookie Domain Mismatch
**Symptom**: Cookies are set but browser rejects them
**Cause**: `NEXTAUTH_URL` mismatch or secure cookie settings
**Fix**: Verify `NEXTAUTH_URL` exactly matches Vercel domain

### Theory 2: JWT Secret Mismatch
**Symptom**: JWT tokens can't be validated
**Cause**: `NEXTAUTH_SECRET` different between deployments
**Fix**: Ensure secret matches exactly (done ✅)

### Theory 3: Session Strategy Issue
**Symptom**: JWT sessions not working on Vercel
**Cause**: Configuration in `src/lib/auth.ts` not compatible with Vercel
**Fix**: May need to adjust session configuration

### Theory 4: Middleware Over-protection
**Symptom**: Middleware blocks all sessions
**Cause**: Middleware not recognizing valid sessions
**Fix**: Check middleware logic in `src/middleware.ts`

### Theory 5: Database Connection During Auth
**Symptom**: Auth queries failing silently
**Cause**: Database connection issues from Vercel
**Fix**: Check Vercel function logs for Prisma errors

---

## Next Debugging Steps

### Step 1: Check Vercel Function Logs

1. Go to Vercel → reminder-mvp → Deployments → [Latest]
2. Click on "Functions" tab
3. Look for `/api/auth/[...nextauth]` function
4. Check for errors during login attempts

### Step 2: Add Debug Logging to NextAuth

Temporarily add to `src/lib/auth.ts`:

```typescript
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "production",
  logger: {
    error(code, metadata) {
      console.error('❌ NextAuth Error:', code, metadata)
    },
    warn(code) {
      console.warn('⚠️ NextAuth Warning:', code)
    },
    debug(code, metadata) {
      console.log('🔍 NextAuth Debug:', code, metadata)
    }
  },
  // ... rest of config
}
```

This will show detailed logs in Vercel functions.

### Step 3: Test with Simpler Auth Check

Create a minimal test endpoint to verify auth works:

```typescript
// src/app/api/test-auth/route.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)

  return NextResponse.json({
    authenticated: !!session,
    session: session,
    env: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    }
  })
}
```

Then test: `curl https://reminder-mvp.vercel.app/api/test-auth`

### Step 4: Check Browser DevTools

Manually login at https://reminder-mvp.vercel.app/en/auth/signin

In browser DevTools → Application → Cookies:
- Look for `__Secure-next-auth.session-token` or `next-auth.session-token`
- Check if cookie is being set
- Check cookie domain, path, secure, httpOnly flags

---

## Quick Test Commands

### Test Production Login via API
```bash
curl -X POST 'https://reminder-mvp.vercel.app/api/auth/signin' \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-test@example.com","password":"SmokeTest123!"}'
```

### Test E2E Auth Setup
```bash
TEST_ENV=production npx playwright test tests/e2e/auth.setup.ts --project=setup
```

### Test with Debug Output
```bash
TEST_ENV=production npx playwright test tests/e2e/auth.setup.ts --project=setup --debug
```

---

## Files to Review

1. **`src/lib/auth.ts`** - NextAuth configuration
2. **`src/middleware.ts`** - Route protection logic
3. **`tests/e2e/auth.setup.ts`** - E2E test logic
4. **Vercel Environment Variables** - All NextAuth vars

---

## Success Criteria

When fixed, the E2E test should show:

```
✅ Successfully redirected to dashboard
Current URL: https://reminder-mvp.vercel.app/en/dashboard
✅ Dashboard loaded successfully
🍪 Cookies found: ['__Secure-next-auth.session-token', ...]
✅ Session established
💾 Saved auth state to: playwright/.auth/user.json
✅ Authentication setup complete!
```

And you should be able to:
1. ✅ Login manually at https://reminder-mvp.vercel.app
2. ✅ Stay logged in (not redirect back to signin)
3. ✅ Run E2E tests against production
4. ✅ See auth state file created
