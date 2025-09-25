# User Flow Stress Testing Framework

## 🎯 Overview

Comprehensive testing framework to validate bulk invoice processing workflows under realistic user scenarios.

## 📋 Test Categories

### 1. PDF Extraction & Reconciliation Testing
### 2. Bulk Import Workflow Testing
### 3. CRM & Dashboard Performance Testing
### 4. Payment Management Testing
### 5. System Integration Testing

---

## 🧪 Test Category 1: PDF Extraction & Reconciliation

### Test 1.1: Single Invoice Accuracy
**Scenario**: Test AWS Textract with "Above The Clouds" invoice
**Expected Results**: Extract specific fields with high confidence

**Prerequisites**:
- AWS credentials configured
- Test PDF available: `Above The Clouds AW25 Drop-1.pdf`

**Test Steps**:
```bash
# 1. Validate AWS connection
node scripts/test-aws-textract-connection.js

# 2. Start development server
npm run dev

# 3. Navigate to PDF upload page
# http://localhost:3000/dashboard/invoices/import

# 4. Upload test PDF and validate extraction
```

**Success Criteria**:
- ✅ Total Amount: 7978 (not random number)
- ✅ Outstanding Amount: 5368.60 (detected)
- ✅ Paid Amount: 2609.40 (detected)
- ✅ Invoice Date: 07/15/2025 (detected)
- ✅ Payment Terms: "within 30 days" (detected)
- ✅ Currency: EUR (detected)
- ✅ Customer email: Correct customer email (not POP Trading)

**Performance Criteria**:
- Processing time: <30 seconds per page
- Confidence scores: >90% for key fields
- User can complete reconciliation in <5 minutes

### Test 1.2: PDF Format Variations
**Scenario**: Test different PDF formats and layouts
**Test Data**: Create sample invoices with:
- Different layouts (portrait/landscape)
- Various currencies (AED, EUR, USD)
- Multiple pages
- Scanned vs digital PDFs

**Validation**: Consistent extraction quality across formats

---

## 🧪 Test Category 2: Bulk Import Workflow

### Test 2.1: 50 Invoice Batch Processing
**Scenario**: Simulate user uploading 50 invoices from 10 companies

**Test Data Creation**:
```bash
# Create test data script
node scripts/generate-test-invoice-batch.js --invoices 50 --companies 10
```

**Test Steps**:
1. **Upload Batch**: Upload file with 50 invoices
2. **Pre-Import Analysis**: Validate customer matching suggestions
3. **Reconciliation Process**: Process invoices in smart batch mode
4. **Database Validation**: Verify correct customer relationships and invoice creation

**Success Criteria**:
- Customer matching: >90% accuracy for fuzzy matching
- Processing time: <2 hours total (vs 8+ hours individual)
- Data integrity: No duplicate customers or invoices
- User intervention: <20% of invoices require manual attention

### Test 2.2: Second Batch Processing (Learning Test)
**Scenario**: Upload second batch from same 10 companies after 2 days

**Test Steps**:
1. **Upload Second Batch**: Same companies, different invoices
2. **Pattern Recognition**: System should recognize existing customers
3. **Auto-Approval Rate**: Measure how many invoices auto-approve based on learned patterns

**Success Criteria**:
- Customer recognition: 100% accuracy for existing customers
- Auto-approval rate: >80% for invoices matching learned patterns
- Processing time: <30 minutes (significant improvement)

### Test 2.3: Duplicate Detection
**Scenario**: Upload file containing duplicate invoices

**Test Data**:
- 5 completely identical invoices
- 5 invoices with same number but different amounts
- 5 invoices with similar but not identical data

**Success Criteria**:
- 100% detection of exact duplicates
- Clear user interface for handling similar invoices
- No database constraint errors

---

## 🧪 Test Category 3: CRM & Dashboard Performance

### Test 3.1: Dashboard Load Performance
**Scenario**: Test dashboard with 100+ invoices and 10+ customers

**Test Setup**:
```sql
-- Seed database with test data
INSERT INTO customers (name, email, company_id) VALUES
  ('Above The Clouds', 'info@atc.com', 'test_company'),
  -- ... 9 more customers

INSERT INTO invoices (number, customer_email, amount, company_id) VALUES
  ('INV001', 'info@atc.com', 7978.00, 'test_company'),
  -- ... 99 more invoices
```

**Performance Criteria**:
- Dashboard load time: <3 seconds
- Customer list rendering: <2 seconds
- Invoice table scrolling: Smooth with virtual scrolling
- Filter/search response: <500ms

### Test 3.2: Customer Relationship View
**Scenario**: Test customer view with multiple invoices

**Test Steps**:
1. Navigate to customer detail page
2. View customer with 10+ invoices
3. Test bulk actions (select multiple invoices)
4. Test payment allocation interface

**Success Criteria**:
- Customer overview loads: <2 seconds
- All invoices visible in organized list
- Bulk selection works smoothly
- Outstanding balance calculations accurate

---

## 🧪 Test Category 4: Payment Management Testing

### Test 4.1: Bulk Payment Allocation
**Scenario**: Customer pays €25,000 covering multiple invoices

**Test Setup**:
- Customer: Above The Clouds
- Outstanding invoices: €7,978 + €8,900 + €22,622.60 = €39,500.60
- Payment: €25,000

**Test Steps**:
1. **Record Payment**: Enter €25,000 payment
2. **Smart Allocation**: System suggests allocation across invoices
3. **Manual Adjustment**: User can modify allocation
4. **Apply Payment**: Process allocation and update statuses

**Success Criteria**:
- Allocation suggestions accurate (oldest first)
- Partial payment handling correct
- Invoice statuses update properly (2 PAID, 1 PARTIALLY_PAID)
- Customer outstanding balance updates: €39,500.60 - €25,000 = €14,500.60

### Test 4.2: Payment Workflow Edge Cases
**Test Scenarios**:
- Overpayment (customer pays more than owed)
- Underpayment (payment doesn't cover full invoices)
- Multiple payments on same day
- Payment for already paid invoice

---

## 🧪 Test Category 5: System Integration Testing

### Test 5.1: End-to-End Workflow
**Scenario**: Complete workflow from PDF upload to payment

**Test Steps**:
1. **Upload PDF**: Process "Above The Clouds" invoice
2. **Reconciliation**: Complete smart reconciliation
3. **Customer Creation**: Verify customer record creation
4. **Invoice Storage**: Confirm invoice stored correctly
5. **Dashboard Update**: Verify metrics update
6. **Payment Processing**: Record payment for invoice
7. **Status Updates**: Confirm all systems reflect payment

**Success Criteria**:
- Complete workflow completes without errors
- Data consistency across all components
- UI updates reflect backend changes
- Audit trail captures all actions

### Test 5.2: Concurrent User Testing
**Scenario**: Multiple users processing invoices simultaneously

**Test Setup**:
- 3 users from same company
- Each processes different invoices
- Some overlap in customers

**Success Criteria**:
- No data conflicts or corruption
- UI updates correctly for all users
- Database integrity maintained

---

## 🛠 Test Execution Framework

### Test Environment Setup

```bash
# 1. Set up test database
createdb reminder_test
export DATABASE_URL="postgresql://user:pass@localhost:5432/reminder_test"

# 2. Run migrations
npx prisma migrate deploy

# 3. Seed test data
node scripts/seed-test-data.js

# 4. Start test environment
npm run test:integration
```

### Automated Test Scripts

```bash
# Performance testing
npm run test:performance

# Load testing with artillery
npm install -g artillery
artillery run test-configs/load-test.yml

# End-to-end testing with Playwright
npm run test:e2e
```

### Manual Testing Checklist

```
□ PDF extraction accuracy (Test 1.1)
□ Bulk import processing (Test 2.1)
□ Dashboard performance (Test 3.1)
□ Payment allocation (Test 4.1)
□ End-to-end workflow (Test 5.1)
□ Error handling and recovery
□ User experience validation
□ Data integrity verification
```

---

## 📊 Performance Benchmarks

### Response Time Targets
- PDF processing: <30 seconds per page
- Dashboard load: <3 seconds
- Customer view: <2 seconds
- Payment allocation: <1 second
- Search/filter: <500ms

### Throughput Targets
- Concurrent users: 10+ without degradation
- Invoice processing: 100+ invoices in <2 hours
- Database queries: <100ms for standard operations

### Accuracy Targets
- PDF extraction: >90% for key fields
- Customer matching: >95% accuracy
- Duplicate detection: 100% for exact matches
- Payment calculations: 100% accuracy

---

## 🔍 Monitoring & Validation

### Real-time Monitoring
```typescript
// Performance monitoring
interface TestMetrics {
  pdfProcessingTime: number[]
  dashboardLoadTime: number[]
  customerViewLoadTime: number[]
  paymentAllocationTime: number[]
  errorRate: number
  userSatisfactionScore: number
}
```

### Error Tracking
- PDF processing failures
- Database constraint violations
- UI responsiveness issues
- User workflow abandonment

### Success Validation
- Functional accuracy (features work as designed)
- Performance benchmarks (meet speed requirements)
- User experience (intuitive and efficient)
- Data integrity (no corruption or loss)

---

## 🚀 Test Execution Commands

### Quick Start Testing
```bash
# Run all critical tests
npm run test:critical

# Test specific workflows
npm run test:pdf-extraction
npm run test:bulk-import
npm run test:payment-allocation

# Performance testing
npm run test:load-dashboard
npm run test:stress-bulk-import
```

### Continuous Testing
```bash
# Set up continuous testing pipeline
npm run test:watch

# Generate test reports
npm run test:report

# Validate against benchmarks
npm run test:benchmark
```

This framework provides comprehensive validation of all bulk invoice processing workflows while measuring real performance under realistic conditions.