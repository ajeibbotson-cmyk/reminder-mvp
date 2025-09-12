-- Performance Testing Script for UAE Pay MVP Database Optimization
-- Purpose: Measure query performance improvements after index implementation

-- Set up timing
\timing on

-- Test queries that should benefit from the new indexes

-- 1. Invoice dashboard query (company + status + due date)
-- Expected improvement: 70%+ with idx_invoices_company_status_due
EXPLAIN ANALYZE
SELECT 
    id, number, customer_name, amount, due_date, status
FROM invoices 
WHERE company_id = 'sample_company_id' 
    AND status IN ('SENT', 'OVERDUE') 
    AND due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY due_date ASC;

-- 2. Customer lookup for invoice creation
-- Expected improvement: 70%+ with idx_customers_company_email
EXPLAIN ANALYZE
SELECT 
    id, name, email, payment_terms
FROM customers 
WHERE company_id = 'sample_company_id' 
    AND email = 'customer@example.com';

-- 3. Follow-up log tracking for email performance
-- Expected improvement: 70%+ with idx_followup_logs_invoice_sent
EXPLAIN ANALYZE
SELECT 
    id, email_address, subject, sent_at, email_opened, email_clicked
FROM follow_up_logs 
WHERE invoice_id = 'sample_invoice_id'
ORDER BY sent_at DESC;

-- 4. Complex dashboard query with amounts
-- Expected improvement: 70%+ with idx_invoices_complex_dashboard
EXPLAIN ANALYZE
SELECT 
    COUNT(*) as total_invoices,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_count
FROM invoices 
WHERE company_id = 'sample_company_id' 
    AND status IN ('SENT', 'OVERDUE', 'PAID')
    AND due_date >= CURRENT_DATE - INTERVAL '90 days';

-- 5. Customer invoice history
-- Expected improvement: 70%+ with idx_invoices_customer_date
EXPLAIN ANALYZE
SELECT 
    i.id, i.number, i.amount, i.status, i.created_at
FROM invoices i
WHERE i.customer_email = 'customer@example.com' 
    AND i.company_id = 'sample_company_id'
ORDER BY i.created_at DESC
LIMIT 20;

-- 6. Follow-up automation query
-- Expected improvement: 70%+ with idx_followup_logs_automation
EXPLAIN ANALYZE
SELECT 
    fl.id, fl.step_number, fl.sent_at, fl.email_opened
FROM follow_up_logs fl
WHERE fl.sequence_id = 'sample_sequence_id'
    AND fl.step_number <= 3
ORDER BY fl.sent_at ASC;

-- 7. Overdue invoice detection
-- Expected improvement: 70%+ with idx_invoices_status_due_date
EXPLAIN ANALYZE
SELECT 
    id, number, customer_name, amount, due_date
FROM invoices 
WHERE status IN ('SENT', 'OVERDUE')
    AND due_date < CURRENT_DATE
ORDER BY due_date ASC;

-- 8. Company TRN lookup
-- Expected improvement: 90%+ with idx_companies_trn
EXPLAIN ANALYZE
SELECT 
    id, name, trn
FROM companies 
WHERE trn = '123456789012345';

-- 9. User access query
-- Expected improvement: 70%+ with idx_users_company_role
EXPLAIN ANALYZE
SELECT 
    id, name, email, role
FROM users 
WHERE company_id = 'sample_company_id'
    AND role IN ('ADMIN', 'FINANCE')
ORDER BY name;

-- 10. Activity audit query
-- Expected improvement: 70%+ with idx_activities_company_created
EXPLAIN ANALYZE
SELECT 
    id, type, description, created_at
FROM activities 
WHERE company_id = 'sample_company_id'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Performance benchmark queries
-- These should show significant improvements after index implementation

SELECT 'Performance Test Summary' as test_name;

-- Index usage verification
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- Table scan statistics
SELECT 
    schemaname,
    tablename,
    seq_scan as sequential_scans,
    seq_tup_read as sequential_tuples_read,
    idx_scan as index_scans,
    idx_tup_fetch as index_tuples_fetched
FROM pg_stat_user_tables 
WHERE tablename IN ('invoices', 'customers', 'follow_up_logs', 'companies', 'users', 'activities')
ORDER BY seq_scan DESC;

\timing off