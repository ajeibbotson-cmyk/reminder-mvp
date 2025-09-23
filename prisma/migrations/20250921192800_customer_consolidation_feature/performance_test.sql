-- Customer Consolidation Feature Performance Tests
-- Run these tests to ensure the schema meets performance requirements

-- Test 1: Consolidation Queue Performance (Target: <500ms for 10,000 customers)
-- This simulates the main dashboard query for customer consolidation
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
WITH overdue_customers AS (
  SELECT
    c.id as customer_id,
    c.company_id,
    c.name as customer_name,
    c.email as customer_email,
    c.consolidation_preference,
    COUNT(i.id) as overdue_count,
    SUM(i.amount) as total_overdue,
    MIN(i.due_date) as earliest_due_date,
    MAX(CURRENT_DATE - i.due_date) as max_days_overdue,
    array_agg(i.id ORDER BY i.due_date ASC) as invoice_ids
  FROM customers c
  JOIN invoices i ON c.id = i.customer_id
  LEFT JOIN customer_consolidated_reminders ccr ON c.id = ccr.customer_id
    AND ccr.sent_at > CURRENT_DATE - INTERVAL '7 days'
  WHERE i.status = 'OVERDUE'
    AND i.is_active = true
    AND c.is_active = true
    AND c.company_id = 'test-company-id'
    AND (c.consolidation_preference = 'ENABLED' OR c.consolidation_preference = 'AUTO')
    AND ccr.id IS NULL -- No recent consolidation sent
  GROUP BY c.id, c.company_id, c.name, c.email, c.consolidation_preference
  HAVING COUNT(i.id) >= 2
)
SELECT *
FROM overdue_customers
ORDER BY max_days_overdue DESC, total_overdue DESC
LIMIT 100;

-- Test 2: Consolidation History Analytics (Target: <200ms)
-- This tests the analytics queries for consolidation effectiveness
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  DATE_TRUNC('week', ccr.sent_at) as week_start,
  COUNT(*) as total_reminders,
  COUNT(DISTINCT ccr.customer_id) as unique_customers,
  SUM(ccr.invoice_count) as total_invoices_consolidated,
  SUM(ccr.invoice_count - 1) as emails_saved,
  AVG(ccr.total_amount) as avg_reminder_amount,
  AVG(ccr.priority_score) as avg_priority_score,
  COUNT(*) FILTER (WHERE ccr.email_opened_at IS NOT NULL) as opened_count,
  COUNT(*) FILTER (WHERE ccr.payment_received_at IS NOT NULL) as payment_count
FROM customer_consolidated_reminders ccr
WHERE ccr.company_id = 'test-company-id'
  AND ccr.sent_at >= CURRENT_DATE - INTERVAL '3 months'
  AND ccr.sent_at IS NOT NULL
GROUP BY DATE_TRUNC('week', ccr.sent_at)
ORDER BY week_start DESC;

-- Test 3: Customer Contact Eligibility Check (Target: <100ms)
-- This tests the contact frequency validation
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  c.id,
  c.name,
  c.email,
  c.preferred_contact_interval,
  MAX(ccr.sent_at) as last_consolidation_sent,
  MAX(fl.sent_at) as last_individual_sent,
  GREATEST(
    COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
    COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
  ) as last_contact_date,
  CASE
    WHEN GREATEST(
      COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
      COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
    ) < CURRENT_DATE - (c.preferred_contact_interval || ' days')::INTERVAL THEN true
    ELSE false
  END as can_contact
FROM customers c
LEFT JOIN customer_consolidated_reminders ccr ON c.id = ccr.customer_id
LEFT JOIN invoices i ON c.id = i.customer_id
LEFT JOIN follow_up_logs fl ON i.id = fl.invoice_id
WHERE c.company_id = 'test-company-id'
  AND c.is_active = true
GROUP BY c.id, c.name, c.email, c.preferred_contact_interval
HAVING GREATEST(
  COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
  COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
) < CURRENT_DATE - (c.preferred_contact_interval || ' days')::INTERVAL
ORDER BY c.name
LIMIT 100;

-- Test 4: Email Log Consolidation Tracking (Target: <300ms)
-- This tests the email analytics with consolidation data
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  el.consolidated_reminder_id,
  el.invoice_count,
  el.consolidation_savings,
  el.delivery_status,
  el.sent_at,
  el.opened_at,
  el.clicked_at,
  ccr.total_amount,
  ccr.escalation_level,
  ccr.reminder_type
FROM email_logs el
JOIN customer_consolidated_reminders ccr ON el.consolidated_reminder_id = ccr.id
WHERE el.company_id = 'test-company-id'
  AND el.sent_at >= CURRENT_DATE - INTERVAL '1 month'
  AND el.consolidated_reminder_id IS NOT NULL
ORDER BY el.sent_at DESC
LIMIT 1000;

-- Test 5: Template Consolidation Support Query (Target: <50ms)
-- This tests the template selection for consolidation
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  et.id,
  et.name,
  et.template_type,
  et.supports_consolidation,
  et.max_invoice_count,
  et.subject_en,
  et.is_active,
  et.is_default
FROM email_templates et
WHERE et.company_id = 'test-company-id'
  AND et.is_active = true
  AND et.supports_consolidation = true
  AND et.template_type IN ('CONSOLIDATED_REMINDER', 'URGENT_CONSOLIDATED_REMINDER')
  AND et.max_invoice_count >= 5
ORDER BY et.is_default DESC, et.template_type, et.name;

-- Test 6: Bulk Consolidation Scheduling Performance (Target: <1000ms for 100 customers)
-- This simulates bulk operations on multiple customers
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
WITH eligible_customers AS (
  SELECT
    c.id as customer_id,
    c.company_id,
    array_agg(i.id ORDER BY i.due_date ASC) as invoice_ids,
    SUM(i.amount) as total_amount,
    COUNT(i.id) as invoice_count,
    MAX(CURRENT_DATE - i.due_date) as max_days_overdue
  FROM customers c
  JOIN invoices i ON c.id = i.customer_id
  WHERE i.status = 'OVERDUE'
    AND i.is_active = true
    AND c.is_active = true
    AND c.company_id = 'test-company-id'
    AND c.consolidation_preference = 'ENABLED'
  GROUP BY c.id, c.company_id
  HAVING COUNT(i.id) >= 2
    AND COUNT(i.id) <= 10 -- Reasonable consolidation size
    AND SUM(i.amount) <= 50000 -- Within consolidation limits
)
SELECT
  ec.customer_id,
  ec.company_id,
  ec.invoice_ids,
  ec.total_amount,
  ec.invoice_count,
  ec.max_days_overdue,
  CASE
    WHEN ec.max_days_overdue > 90 THEN 'FINAL'
    WHEN ec.max_days_overdue > 60 THEN 'URGENT'
    WHEN ec.max_days_overdue > 30 THEN 'FIRM'
    ELSE 'POLITE'
  END as escalation_level,
  -- Priority score calculation (simplified)
  LEAST(100,
    FLOOR((ec.total_amount / 10000.0) * 40) +
    FLOOR((ec.max_days_overdue / 90.0) * 30) +
    20 -- base relationship score
  ) as priority_score
FROM eligible_customers ec
ORDER BY priority_score DESC, total_amount DESC
LIMIT 100;

-- Test 7: Index Usage Analysis
-- Check if our indexes are being used effectively
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('customer_consolidated_reminders', 'email_logs', 'email_templates', 'customers')
  AND indexname LIKE '%consolidation%' OR indexname LIKE '%ccr_%'
ORDER BY times_used DESC;

-- Test 8: Storage and Bloat Analysis
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE tablename IN ('customer_consolidated_reminders', 'email_logs', 'email_templates', 'customers')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Test 9: Concurrent Access Simulation
-- Test for lock contention and concurrent performance
BEGIN;
  -- Simulate reading consolidation queue
  SELECT COUNT(*) FROM customer_consolidated_reminders
  WHERE company_id = 'test-company-id' AND delivery_status = 'QUEUED';

  -- Simulate updating consolidation status
  UPDATE customer_consolidated_reminders
  SET delivery_status = 'SENT', sent_at = NOW()
  WHERE id = 'test-consolidation-id';

  -- Simulate inserting email log
  INSERT INTO email_logs (
    id, company_id, consolidated_reminder_id, invoice_count,
    recipient_email, subject, content, delivery_status
  ) VALUES (
    'test-email-log-id', 'test-company-id', 'test-consolidation-id', 3,
    'test@example.com', 'Test Subject', 'Test Content', 'SENT'
  );
ROLLBACK;

-- Test 10: Memory Usage for Large Result Sets
-- Test memory efficiency for dashboard queries
SELECT
  'Large result set test' as test_name,
  COUNT(*) as total_rows,
  pg_size_pretty(
    COUNT(*) * (
      32 + -- customer_id
      32 + -- company_id
      8 + -- total_amount
      4 + -- invoice_count
      4 + -- priority_score
      200 -- estimated overhead per row
    )
  ) as estimated_memory_usage
FROM customer_consolidated_reminders;

-- Performance Targets Summary:
-- 1. Consolidation Queue: <500ms for 10,000 customers
-- 2. Analytics Queries: <200ms for 3 months of data
-- 3. Contact Eligibility: <100ms for 1,000 customers
-- 4. Email Tracking: <300ms for 1 month of logs
-- 5. Template Selection: <50ms
-- 6. Bulk Operations: <1000ms for 100 customers
-- 7. Index Efficiency: >80% hit ratio
-- 8. Storage Efficiency: <10% bloat
-- 9. Concurrent Access: <10ms lock wait time
-- 10. Memory Usage: <100MB for 10,000 consolidations