-- Database Constraint Verification Script
-- Purpose: Test that all UAE-specific validation constraints work correctly

-- Test 1: TRN Format Validation
-- Should succeed: Valid 15-digit TRN
INSERT INTO companies (id, name, trn) 
VALUES ('test_company_1', 'Test Company Valid TRN', '123456789012345')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Should fail: Invalid TRN format (less than 15 digits)
-- Expected error: chk_companies_trn_format
DO $$
BEGIN
    INSERT INTO companies (id, name, trn) 
    VALUES ('test_company_2', 'Test Company Invalid TRN', '12345');
    RAISE NOTICE 'ERROR: Invalid TRN was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Invalid TRN correctly rejected';
END $$;

-- Test 2: Email Format Validation
-- Should succeed: Valid email format
INSERT INTO users (id, email, name, company_id, role) 
VALUES ('test_user_1', 'valid@example.com', 'Test User', 'test_company_1', 'FINANCE')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Should fail: Invalid email format
DO $$
BEGIN
    INSERT INTO users (id, email, name, company_id, role) 
    VALUES ('test_user_2', 'invalid-email', 'Test User Bad Email', 'test_company_1', 'FINANCE');
    RAISE NOTICE 'ERROR: Invalid email was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Invalid email correctly rejected';
END $$;

-- Test 3: Amount Validation
-- Should succeed: Valid positive amount
INSERT INTO invoices (id, company_id, number, customer_name, customer_email, amount, due_date) 
VALUES ('test_invoice_1', 'test_company_1', 'INV-001', 'Test Customer', 'customer@example.com', 100.50, CURRENT_DATE + 30)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

-- Should fail: Negative amount
DO $$
BEGIN
    INSERT INTO invoices (id, company_id, number, customer_name, customer_email, amount, due_date) 
    VALUES ('test_invoice_2', 'test_company_1', 'INV-002', 'Test Customer', 'customer@example.com', -100.50, CURRENT_DATE + 30);
    RAISE NOTICE 'ERROR: Negative amount was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Negative amount correctly rejected';
END $$;

-- Test 4: Currency Validation
-- Should succeed: Valid currency
UPDATE invoices SET currency = 'AED' WHERE id = 'test_invoice_1';

-- Should fail: Invalid currency
DO $$
BEGIN
    INSERT INTO invoices (id, company_id, number, customer_name, customer_email, amount, currency, due_date) 
    VALUES ('test_invoice_3', 'test_company_1', 'INV-003', 'Test Customer', 'customer@example.com', 100.50, 'JPY', CURRENT_DATE + 30);
    RAISE NOTICE 'ERROR: Invalid currency was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Invalid currency correctly rejected';
END $$;

-- Test 5: UAE Phone Number Validation
-- Should succeed: Valid UAE phone numbers
INSERT INTO customers (id, company_id, name, email, phone) 
VALUES ('test_customer_1', 'test_company_1', 'Test Customer UAE Phone', 'customer1@example.com', '+971501234567')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;

INSERT INTO customers (id, company_id, name, email, phone) 
VALUES ('test_customer_2', 'test_company_1', 'Test Customer UAE Phone 2', 'customer2@example.com', '971501234567')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;

INSERT INTO customers (id, company_id, name, email, phone) 
VALUES ('test_customer_3', 'test_company_1', 'Test Customer UAE Phone 3', 'customer3@example.com', '0501234567')
ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone;

-- Should fail: Invalid phone format
DO $$
BEGIN
    INSERT INTO customers (id, company_id, name, email, phone) 
    VALUES ('test_customer_4', 'test_company_1', 'Test Customer Bad Phone', 'customer4@example.com', '123456789');
    RAISE NOTICE 'ERROR: Invalid phone number was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Invalid phone number correctly rejected';
END $$;

-- Test 6: Date Logic Validation
-- Should fail: Payment date in future
DO $$
BEGIN
    INSERT INTO payments (id, invoice_id, amount, payment_date) 
    VALUES ('test_payment_1', 'test_invoice_1', 50.00, CURRENT_DATE + 1);
    RAISE NOTICE 'ERROR: Future payment date was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Future payment date correctly rejected';
END $$;

-- Test 7: Empty String Validation
-- Should fail: Empty company name
DO $$
BEGIN
    INSERT INTO companies (id, name) 
    VALUES ('test_company_empty', '   ');
    RAISE NOTICE 'ERROR: Empty company name was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Empty company name correctly rejected';
END $$;

-- Test 8: Payment Terms Validation
-- Should succeed: Valid payment terms
INSERT INTO customers (id, company_id, name, email, payment_terms) 
VALUES ('test_customer_terms', 'test_company_1', 'Test Customer Terms', 'terms@example.com', 30)
ON CONFLICT (id) DO UPDATE SET payment_terms = EXCLUDED.payment_terms;

-- Should fail: Invalid payment terms (negative)
DO $$
BEGIN
    INSERT INTO customers (id, company_id, name, email, payment_terms) 
    VALUES ('test_customer_bad_terms', 'test_company_1', 'Test Customer Bad Terms', 'badterms@example.com', -5);
    RAISE NOTICE 'ERROR: Negative payment terms was accepted when it should have been rejected';
EXCEPTION 
    WHEN check_violation THEN 
        RAISE NOTICE 'SUCCESS: Negative payment terms correctly rejected';
END $$;

-- Cleanup test data
DELETE FROM customers WHERE id LIKE 'test_customer%';
DELETE FROM payments WHERE id LIKE 'test_payment%';
DELETE FROM invoices WHERE id LIKE 'test_invoice%';
DELETE FROM users WHERE id LIKE 'test_user%';
DELETE FROM companies WHERE id LIKE 'test_company%';

-- Summary
SELECT 'All constraint validation tests completed' as test_summary;