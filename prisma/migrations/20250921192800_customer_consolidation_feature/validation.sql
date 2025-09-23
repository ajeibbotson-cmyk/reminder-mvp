-- Customer Consolidation Feature Validation Queries
-- Run these queries after migration to validate data integrity and performance

-- 1. Validate consolidation data integrity
SELECT
  'customer_consolidated_reminders' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE array_length(invoice_ids, 1) >= 2) as valid_consolidations,
  COUNT(*) FILTER (WHERE total_amount > 0) as valid_amounts,
  COUNT(*) FILTER (WHERE priority_score BETWEEN 0 AND 100) as valid_priorities,
  COUNT(*) FILTER (WHERE contact_interval_days > 0) as valid_intervals
FROM customer_consolidated_reminders;

-- 2. Validate foreign key relationships - no orphaned consolidations
SELECT
  'Orphaned consolidations' as check_type,
  COUNT(*) as count
FROM customer_consolidated_reminders ccr
LEFT JOIN customers c ON ccr.customer_id = c.id
WHERE c.id IS NULL;

-- 3. Validate foreign key relationships - no orphaned company references
SELECT
  'Orphaned company references' as check_type,
  COUNT(*) as count
FROM customer_consolidated_reminders ccr
LEFT JOIN companies comp ON ccr.company_id = comp.id
WHERE comp.id IS NULL;

-- 4. Validate template references (should allow NULL)
SELECT
  'Invalid template references' as check_type,
  COUNT(*) as count
FROM customer_consolidated_reminders ccr
LEFT JOIN email_templates et ON ccr.template_id = et.id
WHERE ccr.template_id IS NOT NULL AND et.id IS NULL;

-- 5. Validate email log consolidation tracking
SELECT
  'Email logs with consolidation tracking' as metric,
  COUNT(*) FILTER (WHERE consolidated_reminder_id IS NOT NULL) as with_consolidation,
  COUNT(*) as total_emails,
  ROUND(
    COALESCE(COUNT(*) FILTER (WHERE consolidated_reminder_id IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 0),
    2
  ) as percentage
FROM email_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 6. Validate consolidation preferences in customers
SELECT
  consolidation_preference,
  COUNT(*) as customer_count
FROM customers
GROUP BY consolidation_preference
ORDER BY customer_count DESC;

-- 7. Validate email template consolidation support
SELECT
  template_type,
  supports_consolidation,
  COUNT(*) as template_count,
  AVG(max_invoice_count) as avg_max_invoices
FROM email_templates
WHERE is_active = true
GROUP BY template_type, supports_consolidation
ORDER BY template_type, supports_consolidation;

-- 8. Check for index effectiveness (run EXPLAIN ANALYZE in actual database)
-- Test consolidation queue performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT ccr.id, ccr.customer_id, ccr.total_amount, ccr.priority_score
FROM customer_consolidated_reminders ccr
WHERE ccr.company_id = 'test-company-id'
  AND ccr.delivery_status = 'QUEUED'
ORDER BY ccr.priority_score DESC, ccr.created_at ASC
LIMIT 50;

-- 9. Test customer consolidation lookup performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.id, c.name, c.email, c.consolidation_preference
FROM customers c
WHERE c.company_id = 'test-company-id'
  AND c.is_active = true
  AND c.consolidation_preference IN ('ENABLED', 'AUTO')
ORDER BY c.name;

-- 10. Test email log consolidation analytics performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  DATE_TRUNC('month', el.sent_at) as month,
  COUNT(*) as total_emails,
  AVG(el.invoice_count) as avg_invoices_per_email,
  SUM(CASE WHEN el.invoice_count > 1 THEN el.invoice_count - 1 ELSE 0 END) as emails_saved
FROM email_logs el
WHERE el.company_id = 'test-company-id'
  AND el.sent_at >= CURRENT_DATE - INTERVAL '6 months'
  AND el.sent_at IS NOT NULL
GROUP BY DATE_TRUNC('month', el.sent_at)
ORDER BY month DESC;

-- 11. Validate constraint effectiveness
-- This should return no results if constraints are working
SELECT 'Invalid priority scores' as issue, COUNT(*)
FROM customer_consolidated_reminders
WHERE priority_score < 0 OR priority_score > 100

UNION ALL

SELECT 'Invalid total amounts' as issue, COUNT(*)
FROM customer_consolidated_reminders
WHERE total_amount <= 0

UNION ALL

SELECT 'Invalid contact intervals' as issue, COUNT(*)
FROM customer_consolidated_reminders
WHERE contact_interval_days <= 0

UNION ALL

SELECT 'Invalid invoice counts in consolidations' as issue, COUNT(*)
FROM customer_consolidated_reminders
WHERE invoice_count < 2

UNION ALL

SELECT 'Invalid email log invoice counts' as issue, COUNT(*)
FROM email_logs
WHERE invoice_count <= 0

UNION ALL

SELECT 'Invalid consolidation savings' as issue, COUNT(*)
FROM email_logs
WHERE consolidation_savings < 0 OR consolidation_savings > 100;

-- 12. Performance benchmark - should complete in under 100ms for small datasets
SELECT
  'Performance benchmark' as test,
  COUNT(*) as consolidation_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM customer_consolidated_reminders
WHERE company_id = 'test-company-id';

-- 13. Data consistency check - consolidation vs individual emails
SELECT
  'Email volume comparison' as metric,
  SUM(CASE WHEN consolidated_reminder_id IS NOT NULL THEN 1 ELSE 0 END) as consolidated_emails,
  SUM(CASE WHEN consolidated_reminder_id IS NULL THEN 1 ELSE 0 END) as individual_emails,
  SUM(CASE WHEN consolidated_reminder_id IS NOT NULL THEN invoice_count ELSE 1 END) as total_invoices_emailed
FROM email_logs
WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days';

-- 14. Enum validation - ensure all enum values are correctly stored
SELECT 'ReminderType values' as enum_type, reminder_type as value, COUNT(*) as usage_count
FROM customer_consolidated_reminders
GROUP BY reminder_type

UNION ALL

SELECT 'EscalationLevel values' as enum_type, escalation_level as value, COUNT(*) as usage_count
FROM customer_consolidated_reminders
GROUP BY escalation_level

UNION ALL

SELECT 'ConsolidationPreference values' as enum_type, consolidation_preference as value, COUNT(*) as usage_count
FROM customers
GROUP BY consolidation_preference;

-- 15. Storage efficiency check
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals
FROM pg_stats
WHERE tablename = 'customer_consolidated_reminders'
  AND attname IN ('company_id', 'customer_id', 'priority_score', 'delivery_status', 'reminder_type')
ORDER BY tablename, attname;