# Week 1 Day 2 - Resume Session Guide

**Created**: October 30, 2025 (End of Day 1)
**For**: Day 2 morning pickup
**Status**: Ready to fix 6 P0/P1 API endpoints

---

## Quick Resume Prompt

**Copy/paste this to Claude to resume**:

```
We're on Week 1 Day 2 of the December beta launch plan. Yesterday (Day 1) we:
1. Fixed critical database connection issue (DIRECT_URL vs DATABASE_URL)
2. Tested 8 API endpoints - 2 passing, 6 failing
3. Diagnosed exact root causes for all failures via server logs

Please read these files for context:
- WEEK1_API_TEST_RESULTS.md (test results)
- WEEK1_DAY1_API_FIX_PLAN.md (exact fixes needed)
- WEEK1_DAY1_FINAL_STATUS.md (session summary)

Then let's fix all 6 failing endpoints to get to 80%+ pass rate for frontend integration.
```

---

## Current State Snapshot

### Environment
- ✅ Dev server running: `http://localhost:3000`
- ✅ Database: Connected via DIRECT_URL (port 5432)
- ✅ Test user: `smoke-test@example.com` / `SmokeTest123!`
- ✅ Company ID: `cdc6776f-882a-49eb-98b1-302bdfa35c17`

### Session Token
**Valid until**: ~24 hours from Day 1 session

**To get new token if expired**:
1. Open browser to http://localhost:3000
2. Login with smoke-test@example.com / SmokeTest123!
3. DevTools → Application → Cookies → `next-auth.session-token`
4. Copy value

### Test Results
- **Passing (2)**: GET /api/invoices, GET /api/customers
- **Failing (6)**: Listed below with exact fixes

---

## Exact Fixes Needed (Priority Order)

### 🟢 QUICK WINS (15 minutes total)

#### Fix #1: POST /api/customers
**File**: `src/lib/validations.ts`
**Issue**: Validation expects `companyId` in request body
**Fix**: Make `companyId` optional in schema, auto-inject from session

**Current code** (line ~270):
```typescript
companyId: z.string()
```

**Change to**:
```typescript
companyId: z.string().optional()
```

**Then in** `src/app/api/customers/route.ts` **POST handler**:
Ensure companyId is injected from session, not from body.

---

#### Fix #2: GET /api/payments
**File**: `src/app/api/payments/route.ts`
**Issue**: Using `companyId` instead of `company_id` in Prisma query
**Line**: ~257-270 (where clause construction)

**Find**:
```typescript
invoices: {
  companyId: authContext.user.companyId
}
```

**Change to**:
```typescript
invoices: {
  company_id: authContext.user.companyId
}
```

---

#### Fix #3: GET /api/campaigns
**File**: `src/app/api/campaigns/route.ts`
**Issue**: Including non-existent `created_by_user` relation
**Line**: ~133 (include statement)

**Find**:
```typescript
include: {
  created_by_user: {
    select: { id: true, name: true }
  },
  // ...
}
```

**Fix Options**:
1. Remove `created_by_user` entirely
2. OR check Prisma schema for correct relation name (might be `users` or `created_by`)

**Recommended**: Remove it for now, add back after checking schema

---

### 🟡 AUTH FIX (5 minutes)

#### Fix #4: GET /api/analytics/dashboard
**File**: `src/app/api/analytics/dashboard/route.ts`
**Issue**: 401 Unauthorized despite valid session

**Investigation needed**:
1. Check if route has auth middleware
2. Compare with working routes (invoices, customers)
3. Ensure `requireRole` is called properly

**Likely fix**: Add missing auth check or fix existing one

---

### 🔴 WORKFLOW FIX (10 minutes)

#### Fix #5: POST /api/invoices
**Issue**: Foreign key constraint - customer must exist first
**Solution**: Two-step workflow

**Workflow**:
1. First: Create customer via POST /api/customers
2. Then: Create invoice with that customer's email

**Test payload for customer**:
```json
{
  "name": "Test Customer Ltd",
  "email": "test@customer.com",
  "payment_terms_days": 30
}
```

**Then test invoice**:
```json
{
  "invoiceNumber": "TEST-001",
  "customerName": "Test Customer Ltd",
  "customerEmail": "test@customer.com",  // MUST match customer email
  "amount": 5000.00,
  "currency": "AED",
  "dueDate": "2025-12-31"
}
```

---

## Step-by-Step Execution Plan

### Step 1: Start Dev Server (if not running)
```bash
cd /Users/ibbs/Development/reminder-mvp
npm run dev
```

### Step 2: Apply Fixes
```bash
# Fix #1: Edit src/lib/validations.ts
# Fix #2: Edit src/app/api/payments/route.ts
# Fix #3: Edit src/app/api/campaigns/route.ts
# Fix #4: Edit src/app/api/analytics/dashboard/route.ts
```

### Step 3: Restart Dev Server
```bash
# Kill existing server
lsof -ti:3000 | xargs kill -9

# Start fresh
npm run dev
```

### Step 4: Get Fresh Session Token
```bash
# Login to http://localhost:3000
# Copy session token from DevTools
```

### Step 5: Retest All Endpoints
```bash
export SESSION_TOKEN='your-token-here'

# Test all 8 endpoints again
# Verify 6+ passing (75%+ pass rate)
```

### Step 6: Update Documentation
- Update WEEK1_API_TEST_RESULTS.md with new results
- Mark fixes complete in todo list
- Create Day 2 session summary

---

## Files to Read for Context

### Critical Context (Read First)
1. **WEEK1_API_TEST_RESULTS.md** - Complete test results with error details
2. **WEEK1_DAY1_API_FIX_PLAN.md** - Exact fixes mapped to files/lines
3. **WEEK1_DAY1_FINAL_STATUS.md** - Session summary and current state

### Background Context (Optional)
4. **WEEK1_DAY1_CRITICAL_FIX.md** - Database connection fix details
5. **WEEK1_DAY1_DISCOVERIES.md** - Discovery process documentation
6. **WEEK1_MANUAL_API_TESTING_GUIDE.md** - Testing methodology

---

## Success Criteria for Day 2

### Minimum Success (Go/No-Go for Frontend)
- ✅ 80%+ API pass rate (6+ out of 8 endpoints)
- ✅ Core workflow working: Create customer → Create invoice
- ✅ Authentication working on all routes

### Optimal Success
- ✅ 100% pass rate (all 8 endpoints)
- ✅ All CRUD operations tested
- ✅ Ready for frontend integration Day 3

---

## Common Issues & Solutions

### Issue: Session Token Expired
**Symptom**: All endpoints return 401
**Solution**: Get fresh token from browser DevTools

### Issue: Dev Server Not Running
**Symptom**: Connection refused on localhost:3000
**Solution**: `npm run dev`

### Issue: Database Connection Error
**Symptom**: Can't reach database server
**Solution**: Already fixed - using DIRECT_URL (see WEEK1_DAY1_CRITICAL_FIX.md)

### Issue: Prisma Schema Changes Not Applied
**Symptom**: Unknown field errors
**Solution**: `npx prisma generate`

---

## Checklist for Day 2 Session

### Pre-Work (2 minutes)
- [ ] Dev server running
- [ ] Fresh session token obtained
- [ ] Read WEEK1_API_TEST_RESULTS.md
- [ ] Read WEEK1_DAY1_API_FIX_PLAN.md

### Fix Execution (30 minutes)
- [ ] Fix #1: POST /api/customers validation
- [ ] Fix #2: GET /api/payments field name
- [ ] Fix #3: GET /api/campaigns include
- [ ] Fix #4: GET /api/analytics/dashboard auth
- [ ] Restart dev server
- [ ] Retest all 8 endpoints

### Verification (15 minutes)
- [ ] Customer creation works
- [ ] Invoice creation works (after customer)
- [ ] Payments endpoint returns data
- [ ] Campaigns endpoint returns data
- [ ] Analytics dashboard accessible
- [ ] Pass rate ≥ 80%

### Documentation (10 minutes)
- [ ] Update test results
- [ ] Create Day 2 session summary
- [ ] Update DECEMBER_BETA_ROADMAP.md progress

---

## Quick Reference Commands

### Testing
```bash
# Set session token
export SESSION_TOKEN='your-token-here'

# Test endpoint
curl -X GET "http://localhost:3000/api/invoices" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -s

# Create customer
curl -X POST "http://localhost:3000/api/customers" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Ltd","email":"test@example.com","payment_terms_days":30}' \
  -s

# Create invoice (after customer exists)
curl -X POST "http://localhost:3000/api/invoices" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoiceNumber":"TEST-001","customerName":"Test Ltd","customerEmail":"test@example.com","amount":5000.00,"currency":"AED","dueDate":"2025-12-31"}' \
  -s
```

### Development
```bash
# Restart dev server
lsof -ti:3000 | xargs kill -9 && npm run dev

# Regenerate Prisma client (if schema changes)
npx prisma generate

# Check database connection
npx prisma db pull
```

---

## Timeline Expectations

**Day 2 Morning** (2-3 hours):
- Fix all 6 failing endpoints
- Test and verify 80%+ pass rate
- Document results

**Day 2 Afternoon** (2-3 hours):
- Test remaining 7 untested endpoints
- Aim for 90%+ overall pass rate
- Prepare for frontend integration

**Day 3** (Full day):
- Start frontend integration
- Wire up Invoice List UI
- Wire up Campaign creation UI

---

## Contact Points

**Current Progress**: Week 1 Day 1 complete
**Next Milestone**: 80%+ API pass rate (Day 2 goal)
**Critical Path**: Frontend integration starts Day 3
**Launch Target**: December 13-19, 2025

---

**Created by**: Claude (Week 1 Day 1 session)
**Status**: Ready for Day 2 execution
**Confidence**: High - all fixes mapped with exact file/line numbers
