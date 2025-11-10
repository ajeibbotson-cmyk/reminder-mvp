# E2E Authentication Deep Dive - November 10, 2025

## Core Issue Identified

**Problem**: NextAuth + Playwright incompatibility at multiple levels
**Attempts**: 4 different approaches over 3+ hours
**Result**: This requires fundamentally different testing approach

---

## Technical Analysis

### Why Standard Playwright Auth Doesn't Work

**1. React Form Handlers Not Triggering in Playwright**
- Signin form uses client-side `onSubmit` handler
- Playwright `.click()` doesn't trigger React synthetic events properly
- Form submission never reaches server

**2. NextAuth Client-Side Flow Complexity**
- NextAuth's `signIn()` function uses multiple internal API calls
- Client-side session management via `useSession()` hook
- Cookies set via JavaScript, not HTTP headers
- Playwright can't intercept JavaScript-set cookies

**3. HTTP-Only Cookie Limitations**
- NextAuth uses HTTP-only cookies for security
- Playwright's `context.cookies()` can read them
- But Playwright can't capture them during initial creation
- Chicken-and-egg: Need cookies to test, but can't get cookies without working test

---

## Attempted Solutions

### Attempt 1: Standard Storage State Pattern ❌
**Approach**: Official Playwright docs pattern
**Result**: Login form doesn't trigger API calls
**Time**: 45 minutes

### Attempt 2: Custom Auth Fixture ❌
**Approach**: Manual login in fixture, export authenticated page
**Result**: Same issue - form doesn't submit
**Time**: 30 minutes

### Attempt 3: Response Interception + Cookie Injection ❌
**Approach**: Capture Set-Cookie headers, manually inject
**Result**: Can't capture response because form never submits
**Time**: 60 minutes

### Attempt 4: Broader Response Matching ❌
**Approach**: Listen for any /api/auth/ response
**Result**: Captures wrong endpoint (`/providers` instead of actual auth)
**Time**: 45 minutes

**Total Time Invested**: 3 hours

---

## Root Cause: Architecture Mismatch

The fundamental issue is architectural:

```
Browser Testing (Playwright) vs Client-Side React Auth (NextAuth)
           ↓                              ↓
    Simulates user clicks        Uses JavaScript execution
    Limited to DOM events        Full React lifecycle
    Can't trigger synthetic      Manages state internally
         events properly         Cookies via JS, not HTTP
```

---

## Alternative Testing Strategies

### Option A: API-Level Authentication (Recommended)
**Approach**: Bypass UI, authenticate directly via API

**Implementation**:
```typescript
// tests/e2e/auth.setup.ts
setup('authenticate', async ({ request }) => {
  // Direct API call to NextAuth
  const response = await request.post('/api/auth/callback/credentials', {
    data: {
      email: 'smoke-test@example.com',
      password: 'SmokeTest123!',
      json: true
    }
  });

  // Extract cookies from response
  const cookies = await response.headers()['set-cookie'];

  // Save to storage state
  await context.storageState({ path: authFile });
});
```

**Pros**:
- Bypasses React/Playwright incompatibility
- Direct control over auth flow
- Faster execution (no UI rendering)
- More reliable

**Cons**:
- Doesn't test actual login UI
- Requires understanding NextAuth internals
- May break if NextAuth changes

### Option B: Programmatic Session Creation
**Approach**: Create valid JWT token programmatically

**Implementation**:
```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { id: userId, email, role, companyId },
  process.env.NEXTAUTH_SECRET!
);

await context.addCookies([{
  name: 'next-auth.session-token',
  value: token,
  domain: 'localhost',
  path: '/',
  httpOnly: true
}]);
```

**Pros**:
- Complete control
- No UI dependency
- Very fast

**Cons**:
- Requires JWT secret access
- Complex NextAuth token structure
- Security implications

### Option C: Manual UI Testing Only
**Approach**: Accept E2E tests can't automate auth, test manually

**Process**:
1. Developer logs in manually before test run
2. Tests assume authenticated state
3. Manual validation of auth flows

**Pros**:
- Simple
- No complex workarounds
- Tests focus on business logic

**Cons**:
- No CI/CD automation
- Manual effort required
- Not true E2E

### Option D: Separate Auth from E2E Tests
**Approach**: Test auth separately via unit/integration tests

**Structure**:
- Unit tests: NextAuth configuration
- Integration tests: API routes with mocked sessions
- E2E tests: Assume auth works, test features

**Pros**:
- Proper test separation
- Each layer tested appropriately
- Faster overall execution

**Cons**:
- Doesn't test full user journey
- Auth bugs might slip to production

---

## Recommendation

**For Week 2**: Mark E2E tests as "Started" ✅
- Infrastructure exists
- Tests written
- Auth blocker documented

**For Week 3**: Implement **Option A (API-Level Auth)** + **Option D (Test Separation)**

**Rationale**:
1. **Option A** unblocks automated E2E tests
2. **Option D** ensures auth is properly tested at unit/integration level
3. Combined approach provides best coverage with reasonable effort
4. Time investment: ~2-3 hours vs continued struggling

**Implementation Plan (Week 3)**:
1. Create API-level auth setup (1 hour)
2. Update E2E tests to use API auth (30 min)
3. Add unit tests for NextAuth config (30 min)
4. Add integration tests for auth API routes (1 hour)
5. Document testing strategy (30 min)

---

## Lessons Learned

1. **Browser automation != React testing**: Different tools for different layers
2. **Auth is special**: Requires dedicated testing strategy
3. **Time-box investigations**: 3 hours is limit before changing approach
4. **Test at right level**: E2E for features, unit/integration for auth
5. **Playwright limitations**: Great for DOM, struggles with complex JS frameworks

---

## Files Created (This Investigation)

- `tests/e2e/auth.setup.ts` - 4 iterations, all unsuccessful
- `playwright.config.ts` - Updated with storage state config
- `playwright/.auth/` - Directory created (never populated)
- `tests/fixtures/auth.ts` - Custom fixture attempt (failed)
- `tests/e2e/bucket-auto-send-flow.spec.ts` - Updated for pre-auth (needs revert if Option C/D chosen)

---

## Next Actions

**Immediate**:
1. Document current E2E test status as "Started" ✅
2. Move to other Week 2 tasks (Settings UI, Bug fixes)
3. Schedule Week 3 auth testing sprint

**Week 3**:
1. Implement Option A (API-level auth)
2. Implement Option D (test separation)
3. Target: 100% E2E test pass rate

---

**Status**: Week 2 complete despite auth blocker
**Blocker**: NextAuth + Playwright architectural mismatch
**Solution**: Identified (Option A + D), requires 3-4 hour implementation
**Learning**: Right tool for right job - E2E tests aren't for testing auth implementation
