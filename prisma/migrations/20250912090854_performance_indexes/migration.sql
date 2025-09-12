-- Performance Indexes Migration for UAE Pay MVP
-- Created: 2024-12-09 09:08:54
-- Purpose: Add critical performance indexes for UAE business operations

-- Critical indexes from roadmap requirements

-- 1. Invoice query optimization for company dashboard and status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_status_due 
ON invoices(company_id, status, due_date);

-- 2. Customer lookup optimization for invoice creation and management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_company_email 
ON customers(company_id, email);

-- 3. Follow-up log performance for email tracking and reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followup_logs_invoice_sent 
ON follow_up_logs(invoice_id, sent_at);

-- Additional critical indexes for UAE operations

-- 4. Invoice number search within company (frequently used for lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_number
ON invoices(company_id, number);

-- 5. Invoice amount filtering for financial reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_amount
ON invoices(company_id, amount);

-- 6. Invoice creation date for reporting and analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_created
ON invoices(company_id, created_at);

-- 7. Customer search optimization (name is frequently searched)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_company_name
ON customers(company_id, name);

-- 8. Follow-up sequence optimization for automation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followup_logs_sequence_step
ON follow_up_logs(sequence_id, step_number);

-- 9. Payment tracking for invoice reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_date
ON payments(invoice_id, payment_date);

-- 10. Activity logging for audit trails (common UAE requirement)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_company_created
ON activities(company_id, created_at);

-- 11. User access optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_role
ON users(company_id, role);

-- 12. TRN (Trade Registration Number) lookup for UAE companies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_trn
ON companies(trn) WHERE trn IS NOT NULL;

-- 13. Email tracking performance for follow-up analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followup_logs_email_opened
ON follow_up_logs(email_opened) WHERE email_opened IS NOT NULL;

-- 14. Overdue invoice detection (critical for UAE cash flow)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status_due_date
ON invoices(status, due_date) WHERE status IN ('SENT', 'OVERDUE');

-- 15. Invoice item optimization for detailed reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_invoice
ON invoice_items(invoice_id);

-- Composite indexes for complex queries

-- 16. Invoice dashboard queries (status + due date + company)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_complex_dashboard
ON invoices(company_id, status, due_date, amount);

-- 17. Customer invoice history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer_date
ON invoices(customer_email, company_id, created_at);

-- 18. Follow-up automation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followup_logs_automation
ON follow_up_logs(sequence_id, step_number, sent_at);

-- Performance comments and rationale:
-- These indexes are designed to support the most common query patterns in UAE business operations:
-- 1. Company-scoped queries (multi-tenant architecture)
-- 2. Invoice status and due date filtering (cash flow management)
-- 3. Customer relationship management
-- 4. Email automation and tracking
-- 5. Financial reporting and analytics
-- 6. Audit trail requirements (UAE compliance)
-- 
-- Using CONCURRENTLY ensures zero-downtime deployment to production
-- All indexes consider the multi-tenant nature of the application