# Week 1 Manual UI Testing Guide

**Date**: October 31, 2025
**Purpose**: Systematically test 5 core UI flows to verify UI-API integration
**Time Required**: ~2-3 hours

---

## 🎯 TESTING OBJECTIVE

Verify that the UI correctly connects to the backend APIs we know are working.

**What We Know**:
- ✅ All backend APIs exist (14/15 endpoints)
- ✅ Oct 17 tests proved backend business logic works 100%
- 🔍 UI-API connections need verification

**What We're Finding**:
- Does UI successfully call the APIs?
- Are there any field name mismatches after camelCase migration?
- Do the user flows work end-to-end?

---

## 🧪 TEST FLOWS

### TEST 1: Login → Dashboard (30 minutes)

**URL**: http://localhost:3000

**Steps**:
1. Open browser to http://localhost:3000
2. If not logged in, should redirect to signin page
3. Try to sign in with test credentials:
   - Email: `smoke-test@example.com`
   - Password: `SmokeTest123!`

**Expected Results**:
- [ ] Signin page loads correctly
- [ ] Credentials accepted
- [ ] Redirects to dashboard
- [ ] Dashboard displays without errors
- [ ] Hero metrics display (Total Invoices, Total Amount, etc.)
- [ ] 6 bucket cards display
- [ ] Each bucket shows count and amount

**Record Here**:
```
✅/❌ Login worked?
✅/❌ Dashboard loaded?
✅/❌ Metrics displayed?
✅/❌ Buckets displayed?

Issues found:
1.
2.
3.

Screenshots: (describe what you see)
```

**API Endpoints Being Tested**:
- POST `/api/auth/signin` (NextAuth)
- GET `/api/invoices/buckets`
- GET `/api/analytics/dashboard`

---

### TEST 2: Invoice Creation (45 minutes)

**Navigate to**: Invoice Management / Create Invoice (find the UI button/page)

**Test 2A: Manual Invoice Creation**

**Steps**:
1. Find "Create Invoice" or "New Invoice" button
2. Fill out invoice form:
   - Customer Name: Test Customer Manual
   - Customer Email: test-manual@example.com
   - Invoice Number: MAN-TEST-001
   - Amount: 1500 AED
   - Due Date: (select 30 days from today)
   - Description: Manual test invoice
3. Click "Create" or "Save"

**Expected Results**:
- [ ] Form loads without errors
- [ ] All fields accept input
- [ ] Validation works (try submitting empty form)
- [ ] Success message appears
- [ ] New invoice appears in invoice list
- [ ] Invoice appears in correct bucket (Not Due)

**Record Here**:
```
✅/❌ Form loaded?
✅/❌ Invoice created successfully?
✅/❌ Appears in invoice list?
✅/❌ In correct bucket?

Issues:
1.
2.
```

**Test 2B: CSV Upload** (if UI exists)

**Steps**:
1. Find "Import" or "Upload CSV" button
2. Create test CSV file:
   ```csv
   number,customerName,customerEmail,amount,currency,dueDate,description
   CSV-001,Test CSV Customer,csv@test.com,2000,AED,2025-12-01,CSV test
   ```
3. Upload file
4. Review import results

**Expected Results**:
- [ ] Upload button/page exists
- [ ] File upload works
- [ ] Preview or confirmation appears
- [ ] Invoice created successfully
- [ ] Appears in correct bucket

**Record Here**:
```
✅/❌ CSV upload UI exists?
✅/❌ Upload successful?
✅/❌ Invoice imported correctly?

Issues:
1.
2.
```

**Test 2C: PDF Upload** (if UI exists)

**Steps**:
1. Find "Upload PDF" or "Extract from PDF" button
2. Use a test invoice PDF (if available)
3. Upload and verify extraction

**Expected Results**:
- [ ] PDF upload UI exists
- [ ] Extraction starts
- [ ] Fields populated from PDF
- [ ] Can review/edit before saving

**Record Here**:
```
✅/❌ PDF upload exists?
✅/❌ Extraction worked?

Issues:
1.
2.
```

**API Endpoints Being Tested**:
- POST `/api/invoices` (manual creation)
- POST `/api/invoices/upload` (CSV)
- POST `/api/invoices/extract-pdf` (PDF)
- GET `/api/invoices` (list)

---

### TEST 3: Email Campaign Creation (45 minutes)

**Navigate to**: Invoice bucket with invoices

**Steps**:
1. Go to dashboard buckets view
2. Click on a bucket with invoices (e.g., "1-3 Days Overdue")
3. Select one or more invoices (checkboxes)
4. Click "Email Selected" or "Create Campaign" button
5. Verify email modal opens
6. Check template dropdown/selection
7. Select a template (e.g., "Gentle Reminder")
8. Review email preview
9. Check merge tags are substituted
10. Click "Send Campaign" or "Create Campaign"

**Expected Results**:
- [ ] Bucket detail view loads
- [ ] Invoices display with checkboxes
- [ ] Can select invoices
- [ ] "Email" button appears
- [ ] Modal opens with template selection
- [ ] Templates load from database (not hardcoded)
- [ ] Email preview shows with merge tags replaced
- [ ] Can send campaign
- [ ] Success message appears
- [ ] Campaign appears in campaign list

**Record Here**:
```
✅/❌ Bucket detail view works?
✅/❌ Invoice selection works?
✅/❌ Email modal opens?
✅/❌ Templates load?
✅/❌ Preview shows merge tags?
✅/❌ Campaign created?
✅/❌ Emails sent? (check email if possible)

Issues:
1.
2.
3.

Template count: ___ (should be 5+ if database templates working)
```

**API Endpoints Being Tested**:
- GET `/api/templates`
- POST `/api/campaigns`
- GET `/api/campaigns` (list)

---

### TEST 4: Payment Recording (30 minutes)

**Navigate to**: Invoice detail or payment recording page

**Steps**:
1. Find an invoice (preferably one created in Test 2)
2. Look for "Record Payment" button
3. Click and open payment form
4. Fill out payment details:
   - Amount: 1500 AED (full amount)
   - Payment Date: Today
   - Method: Bank Transfer
   - Reference: TEST-PAY-001
   - Notes: Manual test payment
5. Submit payment
6. Verify invoice status updates

**Expected Results**:
- [ ] Payment form/modal exists
- [ ] All fields work
- [ ] Payment records successfully
- [ ] Invoice status changes to "PAID"
- [ ] Dashboard metrics update (overdue amount decreases)
- [ ] Payment appears in payment list

**Record Here**:
```
✅/❌ Payment form exists?
✅/❌ Payment recorded?
✅/❌ Invoice status updated?
✅/❌ Dashboard metrics updated?

Issues:
1.
2.
```

**API Endpoints Being Tested**:
- POST `/api/payments`
- GET `/api/payments` (list)
- GET `/api/invoices` (updated status)

---

### TEST 5: Customer Management (30 minutes)

**Navigate to**: Customers page/section

**Test 5A: View Customers**

**Steps**:
1. Find "Customers" in navigation
2. Open customer list page

**Expected Results**:
- [ ] Customer list page loads
- [ ] Customers display (if any exist)
- [ ] Can search/filter

**Record Here**:
```
✅/❌ Customer list loads?
✅/❌ Customers display?

Customer count: ___
```

**Test 5B: Create Customer**

**Steps**:
1. Find "New Customer" or "Add Customer" button
2. Fill out form:
   - Name: Manual Test Customer
   - Email: manual-customer@test.com
   - Phone: +971501234567
   - Payment Terms: 30 days
3. Submit

**Expected Results**:
- [ ] Create form exists
- [ ] Customer created successfully
- [ ] Appears in customer list
- [ ] Can view customer detail

**Record Here**:
```
✅/❌ Create form exists?
✅/❌ Customer created?
✅/❌ Appears in list?

Issues:
1.
2.
```

**Test 5C: Edit Customer** (if UI exists)

**Steps**:
1. Click on a customer
2. Find "Edit" button
3. Modify customer details
4. Save changes

**Expected Results**:
- [ ] Edit functionality exists
- [ ] Changes save successfully
- [ ] Updates reflect in list

**Record Here**:
```
✅/❌ Edit exists?
✅/❌ Updates work?

Issues:
1.
```

**API Endpoints Being Tested**:
- GET `/api/customers`
- POST `/api/customers`
- PUT `/api/customers/:id` (if editing)

---

## 📊 RESULTS SUMMARY TEMPLATE

After completing all tests, fill this out:

### Overall Flow Status

| Flow | Status | Notes |
|------|--------|-------|
| 1. Login → Dashboard | ✅/⚠️/❌ | |
| 2. Invoice Creation | ✅/⚠️/❌ | |
| 3. Email Campaign | ✅/⚠️/❌ | |
| 4. Payment Recording | ✅/⚠️/❌ | |
| 5. Customer Management | ✅/⚠️/❌ | |

**Legend**:
- ✅ = Working perfectly
- ⚠️ = Working but has issues
- ❌ = Not working / blocked

### Critical Issues Found

List any issues that block core functionality:

1.
2.
3.

### Minor Issues Found

List any cosmetic or UX issues:

1.
2.
3.

### Positive Findings

What worked better than expected?

1.
2.
3.

### Week 1 Work Estimate

Based on findings:
- Backend fixes needed: ___ hours
- UI fixes needed: ___ hours
- Total remaining Week 1 work: ___ hours

---

## 🎯 DECISION FRAMEWORK

After testing, determine:

**If 4-5 flows working (✅)**:
→ Week 1 is mostly complete! Just fix the broken flow(s)
→ Estimated time: 1-2 days

**If 2-3 flows working (⚠️)**:
→ Week 1 needs focused integration work
→ Estimated time: 3-4 days

**If 0-1 flows working (❌)**:
→ Significant integration issues
→ Estimated time: Full week

---

## 📝 REPORTING

After testing, update:
1. `claudedocs/WEEK1_MANUAL_TEST_RESULTS.md` with findings
2. Create GitHub issues for each bug found
3. Update `WEEK1_INTEGRATION_STATUS.md` with actual status

---

**Ready to Start Testing!**

Open your browser to: http://localhost:3000

Start with TEST 1 and work through systematically.

Take screenshots of any errors or unexpected behavior.

**Good luck!** 🚀
