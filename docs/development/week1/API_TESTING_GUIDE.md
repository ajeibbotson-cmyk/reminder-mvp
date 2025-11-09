# Week 1 Day 1 - Manual API Testing Guide

**Purpose**: Validate critical API endpoints work correctly before frontend integration

**Method**: Manual testing with browser session cookie (NextAuth programmatic auth deferred to Week 3)

**Time Estimate**: 2-3 hours

---

## Setup (5 minutes)

### Step 1: Login to Application

1. Open browser to http://localhost:3000
2. Click "Sign In"
3. Login with test credentials:
   - Email: `smoke-test@example.com`
   - Password: `SmokeTest123!`
4. Should redirect to dashboard

### Step 2: Get Session Cookie

1. Open Browser DevTools (F12 or Cmd+Option+I)
2. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Click "Cookies" → "http://localhost:3000"
4. Find cookie named: `next-auth.session-token`
5. Copy the VALUE (long string of characters)
6. Save it in a text file for easy access

**Example cookie value** (yours will be different):
```
eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..._very_long_string_...
```

### Step 3: Choose Testing Tool

**Option A: curl** (command line)
- Fast, scriptable
- Good for quick tests
- Requires comfort with terminal

**Option B: Postman** (GUI)
- Visual interface
- Save requests for reuse
- Better for beginners

**Option C: VS Code REST Client** (editor extension)
- Test from VS Code
- Save tests in `.http` files
- Good middle ground

---

## API Testing Checklist

Test each endpoint below and mark ✅ PASS, ❌ FAIL, or ⚠️ PARTIAL

### 1. Invoice APIs

**Base URL**: `http://localhost:3000/api/invoices`

#### Test 1.1: List Invoices (GET)

**curl command**:
```bash
curl -X GET http://localhost:3000/api/invoices \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Postman**:
- Method: GET
- URL: `http://localhost:3000/api/invoices`
- Headers:
  - `Cookie`: `next-auth.session-token=YOUR_TOKEN_HERE`

**Expected Response**:
```json
[
  {
    "id": "uuid",
    "invoice_number": "INV-001",
    "customer_name": "Test Customer",
    "amount": 1000.00,
    "currency": "AED",
    "status": "sent",
    "due_date": "2025-12-31"
  }
]
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:
- Empty array `[]` is OK if no invoices exist
- Should return 200 status
- Should NOT return 401 Unauthorized


#### Test 1.2: Create Invoice (POST)

**curl command**:
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "TEST-001",
    "customer_name": "Manual Test Customer",
    "customer_email": "manual@test.com",
    "amount": 500.00,
    "currency": "AED",
    "due_date": "2025-12-31",
    "items": [
      {
        "description": "Test Item",
        "quantity": 1,
        "unit_price": 500.00
      }
    ]
  }'
```

**Expected Response**:
```json
{
  "id": "uuid",
  "invoice_number": "TEST-001",
  "customer_name": "Manual Test Customer",
  "amount": 500.00,
  "created_at": "2025-10-30T..."
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 1.3: Get Single Invoice (GET)

**After creating invoice above, copy its ID, then**:

**curl command**:
```bash
curl -X GET http://localhost:3000/api/invoices/INVOICE_ID_HERE \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "id": "INVOICE_ID",
  "invoice_number": "TEST-001",
  "customer_name": "Manual Test Customer",
  "amount": 500.00,
  "items": [...]
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 1.4: CSV Import (POST)

**curl command**:
```bash
curl -X POST http://localhost:3000/api/invoices/import \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: text/csv" \
  -d 'invoice_number,customer_name,customer_email,amount,due_date,currency
CSV-TEST-001,CSV Customer 1,csv1@test.com,1000.00,2025-12-31,AED
CSV-TEST-002,CSV Customer 2,csv2@test.com,1500.00,2025-12-31,AED'
```

**Expected Response**:
```json
{
  "success": true,
  "imported": 2,
  "failed": 0,
  "errors": []
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


---

### 2. Campaign APIs

**Base URL**: `http://localhost:3000/api/campaigns`

#### Test 2.1: Create Campaign (POST)

**Prerequisites**: Need invoice IDs from Test 1.2 or 1.4

**curl command**:
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manual Test Campaign",
    "invoice_ids": ["INVOICE_ID_1", "INVOICE_ID_2"],
    "subject": "Payment Reminder - Invoice {invoice_number}",
    "message": "Dear {customer_name}, Please pay invoice {invoice_number} for {amount} {currency}",
    "attach_invoice_pdf": false
  }'
```

**Expected Response**:
```json
{
  "id": "campaign-uuid",
  "name": "Manual Test Campaign",
  "created_at": "2025-10-30T...",
  "invoice_count": 2
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 2.2: List Campaigns (GET)

**curl command**:
```bash
curl -X GET http://localhost:3000/api/campaigns \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
[
  {
    "id": "campaign-uuid",
    "name": "Manual Test Campaign",
    "created_at": "2025-10-30T...",
    "status": "draft"
  }
]
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 2.3: Send Campaign (POST) - OPTIONAL

⚠️ **WARNING**: This will actually send emails! Only test if you want real emails sent.

**curl command**:
```bash
curl -X POST http://localhost:3000/api/campaigns/CAMPAIGN_ID_HERE/send \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "sent": 2,
  "failed": 0
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL | [ ] ⏭️ SKIPPED

**Notes**:


---

### 3. Payment APIs

**Base URL**: `http://localhost:3000/api/payments`

#### Test 3.1: Record Payment (POST)

**Prerequisites**: Need invoice ID from Test 1.2 or 1.4

**curl command**:
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "INVOICE_ID_HERE",
    "amount": 500.00,
    "payment_method": "bank_transfer",
    "payment_date": "2025-10-30",
    "reference": "MANUAL-TEST-PAY-001"
  }'
```

**Expected Response**:
```json
{
  "id": "payment-uuid",
  "invoice_id": "INVOICE_ID",
  "amount": 500.00,
  "payment_method": "bank_transfer",
  "created_at": "2025-10-30T..."
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 3.2: List Payments (GET)

**curl command**:
```bash
curl -X GET http://localhost:3000/api/payments \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
[
  {
    "id": "payment-uuid",
    "invoice_id": "...",
    "amount": 500.00,
    "payment_date": "2025-10-30"
  }
]
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


---

### 4. Customer APIs

**Base URL**: `http://localhost:3000/api/customers`

#### Test 4.1: Create Customer (POST)

**curl command**:
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manual Test Customer Ltd",
    "email": "manual-customer@test.com",
    "payment_terms_days": 30
  }'
```

**Expected Response**:
```json
{
  "id": "customer-uuid",
  "name": "Manual Test Customer Ltd",
  "email": "manual-customer@test.com",
  "payment_terms_days": 30
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 4.2: List Customers (GET)

**curl command**:
```bash
curl -X GET http://localhost:3000/api/customers \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
[
  {
    "id": "customer-uuid",
    "name": "Manual Test Customer Ltd",
    "email": "manual-customer@test.com"
  }
]
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 4.3: Update Customer (PUT)

**Prerequisites**: Customer ID from Test 4.1

**curl command**:
```bash
curl -X PUT http://localhost:3000/api/customers/CUSTOMER_ID_HERE \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_terms_days": 45
  }'
```

**Expected Response**:
```json
{
  "id": "CUSTOMER_ID",
  "name": "Manual Test Customer Ltd",
  "payment_terms_days": 45
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


---

### 5. Analytics APIs

**Base URL**: `http://localhost:3000/api/analytics`

#### Test 5.1: Dashboard Stats (GET)

**curl command**:
```bash
curl -X GET http://localhost:3000/api/analytics/dashboard \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "total_invoices": 5,
  "total_outstanding": 2500.00,
  "overdue_count": 1,
  "collection_rate": 75.5,
  "avg_days_to_pay": 18
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


#### Test 5.2: Collection Rate (GET)

**curl command**:
```bash
curl -X GET http://localhost:3000/api/analytics/collection-rate \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "collection_rate": 75.5,
  "total_invoiced": 10000.00,
  "total_collected": 7550.00,
  "outstanding": 2450.00
}
```

**Result**: [ ] ✅ PASS | [ ] ❌ FAIL | [ ] ⚠️ PARTIAL

**Notes**:


---

## Results Summary

Fill this out when done:

**Total Endpoints Tested**: _____ / 15

**Results**:
- ✅ PASS: _____ ( _____ %)
- ❌ FAIL: _____ ( _____ %)
- ⚠️ PARTIAL: _____ ( _____ %)
- ⏭️ SKIPPED: _____ ( _____ %)

**Success Rate**: _____ % (excluding skipped)

### P0 Blockers for Frontend Integration

List any endpoints that MUST work for frontend to function:

1. _____________________________
2. _____________________________
3. _____________________________

### P1 Issues (Important but has workaround)

1. _____________________________
2. _____________________________

### P2+ Issues (Nice to fix, not blocking)

1. _____________________________
2. _____________________________

---

## Next Steps

### If Success Rate > 80%
✅ **PROCEED WITH FRONTEND INTEGRATION (Week 1 Day 3)**
- Core APIs working
- Ready to wire up UI
- Document any failing endpoints as GitHub issues

### If Success Rate 60-80%
⚠️ **FIX CRITICAL ISSUES FIRST**
- Fix P0 blockers today
- Start frontend integration tomorrow (Day 2)
- December launch still on track

### If Success Rate < 60%
🚨 **MAJOR BACKEND ISSUES**
- Do NOT start frontend work yet
- Create GitHub issues for all failures
- Investigate root causes systematically
- May need to extend Week 1 by 1-2 days

---

## Creating GitHub Issues for Failures

For each failing endpoint, create an issue with this template:

```markdown
## Bug: [Endpoint] returning [Status Code]

**Endpoint**: POST /api/invoices
**Expected**: 201 Created with invoice object
**Actual**: 500 Internal Server Error

**Steps to Reproduce**:
1. Login as smoke-test@example.com
2. POST to /api/invoices with body: {...}
3. Observe 500 error

**Error Response**:
```json
{
  "error": "Database constraint violation"
}
```

**Priority**: P0 - Blocks frontend integration

**Labels**: bug, backend, API, P0-critical
```

---

**Document Owner**: Dev Team
**Last Updated**: Week 1 Day 1
**Status**: Ready for manual testing
