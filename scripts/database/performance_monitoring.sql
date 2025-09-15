-- Database Performance Monitoring for UAE Pay MVP - Customer Management System
-- Created: 2025-09-15
-- Purpose: Comprehensive database performance monitoring queries and maintenance scripts

-- =============================================
-- 1. CUSTOMER QUERY PERFORMANCE ANALYSIS
-- =============================================

-- Check index usage for customers table
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE tablename = 'customers' 
ORDER BY n_distinct DESC;

-- Analyze customer query performance patterns
WITH customer_query_stats AS (
    SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
    FROM pg_stat_statements 
    WHERE query ILIKE '%customers%'
    ORDER BY total_time DESC
    LIMIT 20
)
SELECT 
    substring(query, 1, 100) || '...' as query_preview,
    calls,
    round(total_time::numeric, 2) as total_time_ms,
    round(mean_time::numeric, 2) as avg_time_ms,
    rows,
    round(hit_percent::numeric, 2) as cache_hit_percent
FROM customer_query_stats;

-- =============================================
-- 2. INDEX EFFECTIVENESS ANALYSIS
-- =============================================

-- Check index usage statistics for customer-related indexes
SELECT 
    t.tablename,
    indexname,
    c.reltuples AS num_rows,
    pg_size_pretty(pg_relation_size(quote_ident(t.tablename)::text)) AS table_size,
    pg_size_pretty(pg_relation_size(quote_ident(indexrelname)::text)) AS index_size,
    CASE WHEN indisunique THEN 'Y' ELSE 'N' END AS unique,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_tables t
LEFT OUTER JOIN pg_class c ON c.relname = t.tablename
LEFT OUTER JOIN (
    SELECT 
        c.relname AS ctablename, 
        ipg.relname AS indexname, 
        x.indnatts AS number_of_columns, 
        idx_scan, 
        idx_tup_read, 
        idx_tup_fetch, 
        indexrelname, 
        indisunique 
    FROM pg_index x
    JOIN pg_class c ON c.oid = x.indrelid
    JOIN pg_class ipg ON ipg.oid = x.indexrelid
    JOIN pg_stat_all_indexes psai ON x.indexrelid = psai.indexrelid
) AS foo ON t.tablename = foo.ctablename
WHERE t.tablename = 'customers'
ORDER BY 1, 2;

-- Find unused indexes on customers table
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE tablename = 'customers'
AND idx_scan = 0
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- =============================================
-- 3. CUSTOMER TABLE STATISTICS AND HEALTH
-- =============================================

-- Customer table statistics overview
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    round(100.0 * n_dead_tup / GREATEST(n_live_tup + n_dead_tup, 1), 2) as dead_tuple_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename = 'customers';

-- Check for customers table bloat
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
    round(100.0 * pg_relation_size(tablename::regclass) / pg_total_relation_size(tablename::regclass), 2) as table_percent
FROM pg_tables 
WHERE tablename = 'customers';

-- =============================================
-- 4. CUSTOMER BUSINESS ANALYTICS PERFORMANCE
-- =============================================

-- Analyze customer distribution by business type
EXPLAIN (ANALYZE, BUFFERS) 
SELECT 
    business_type,
    COUNT(*) as customer_count,
    AVG(outstanding_balance) as avg_balance,
    SUM(outstanding_balance) as total_balance
FROM customers 
WHERE is_active = true 
GROUP BY business_type;

-- Test TRN lookup performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, business_name, outstanding_balance
FROM customers 
WHERE company_id = 'test-company-id' 
AND trn = '123456789012345';

-- Test Arabic name search performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, name_ar, business_name_ar
FROM customers 
WHERE company_id = 'test-company-id'
AND to_tsvector('arabic', COALESCE(name_ar, '') || ' ' || COALESCE(business_name_ar, ''))
@@ plainto_tsquery('arabic', 'اختبار');

-- =============================================
-- 5. CUSTOMER SEARCH FUNCTION PERFORMANCE
-- =============================================

-- Test customer search function performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM search_customers_uae(
    'test-company-id',
    'test search term',
    NULL,
    'en',
    50,
    0
);

-- Test materialized view refresh performance
EXPLAIN (ANALYZE, BUFFERS)
REFRESH MATERIALIZED VIEW customer_analytics_summary;

-- =============================================
-- 6. DATABASE MAINTENANCE RECOMMENDATIONS
-- =============================================

-- Generate vacuum and analyze recommendations for customers table
SELECT 
    'VACUUM ANALYZE customers;' as maintenance_command,
    'High dead tuple percentage detected' as reason
FROM pg_stat_user_tables 
WHERE tablename = 'customers'
AND n_dead_tup > 1000
AND (n_dead_tup::float / GREATEST(n_live_tup + n_dead_tup, 1)) > 0.1

UNION ALL

SELECT 
    'REINDEX TABLE customers;' as maintenance_command,
    'Index bloat may be present' as reason
FROM pg_stat_user_tables 
WHERE tablename = 'customers'
AND n_tup_upd > 10000

UNION ALL

SELECT 
    'REFRESH MATERIALIZED VIEW customer_analytics_summary;' as maintenance_command,
    'Materialized view may be stale' as reason
WHERE EXISTS (
    SELECT 1 FROM pg_stat_user_tables 
    WHERE tablename = 'customers' 
    AND (last_autoanalyze > NOW() - INTERVAL '1 hour' OR last_analyze > NOW() - INTERVAL '1 hour')
);

-- =============================================
-- 7. PERFORMANCE BENCHMARKING QUERIES
-- =============================================

-- Benchmark common customer queries
\timing on

-- Test 1: Customer list with pagination (target: < 200ms)
SELECT id, name, email, business_type, outstanding_balance, risk_score
FROM customers 
WHERE company_id = 'test-company-id' 
AND is_active = true 
ORDER BY name 
LIMIT 50 OFFSET 0;

-- Test 2: TRN lookup (target: < 50ms)
SELECT id, name, business_name, trn, business_type
FROM customers 
WHERE company_id = 'test-company-id' 
AND trn = '123456789012345';

-- Test 3: Arabic name search (target: < 300ms)
SELECT id, name, name_ar, business_name_ar
FROM customers 
WHERE company_id = 'test-company-id'
AND is_active = true
AND name_ar ILIKE '%اختبار%';

-- Test 4: Outstanding balance aggregation (target: < 100ms)
SELECT 
    business_type,
    COUNT(*) as customer_count,
    SUM(outstanding_balance) as total_outstanding,
    AVG(outstanding_balance) as avg_outstanding
FROM customers 
WHERE company_id = 'test-company-id' 
AND is_active = true
AND outstanding_balance > 0
GROUP BY business_type;

-- Test 5: Customer analytics view (target: < 500ms)
SELECT * FROM customer_performance_metrics 
WHERE company_id = 'test-company-id';

\timing off

-- =============================================
-- 8. MONITORING QUERY TEMPLATES
-- =============================================

-- Daily performance monitoring query
CREATE OR REPLACE VIEW daily_customer_performance AS
SELECT 
    DATE_TRUNC('day', NOW()) as monitoring_date,
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_customers_today,
    AVG(outstanding_balance) as avg_outstanding_balance,
    COUNT(*) FILTER (WHERE outstanding_balance > 0) as customers_with_balance,
    COUNT(*) FILTER (WHERE risk_score > 7.0) as high_risk_customers,
    COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '7 days') as active_customers_7d
FROM customers 
WHERE is_active = true;

-- Weekly customer trends
CREATE OR REPLACE VIEW weekly_customer_trends AS
SELECT 
    DATE_TRUNC('week', created_at) as week_start,
    COUNT(*) as new_customers,
    COUNT(*) FILTER (WHERE business_type = 'LLC') as new_llc,
    COUNT(*) FILTER (WHERE business_type = 'FREE_ZONE') as new_free_zone,
    COUNT(*) FILTER (WHERE preferred_language = 'ar') as new_arabic_customers,
    AVG(risk_score) as avg_risk_score
FROM customers 
WHERE created_at > NOW() - INTERVAL '12 weeks'
AND is_active = true
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

-- =============================================
-- 9. ALERT QUERIES FOR MONITORING
-- =============================================

-- Performance alert: Slow customer queries
SELECT 
    'PERFORMANCE_ALERT' as alert_type,
    'Slow customer queries detected' as message,
    query,
    calls,
    mean_time as avg_time_ms
FROM pg_stat_statements 
WHERE query ILIKE '%customers%'
AND mean_time > 1000 -- Queries taking more than 1 second
ORDER BY mean_time DESC;

-- Data integrity alert: Customers with invalid data
SELECT 
    'DATA_INTEGRITY_ALERT' as alert_type,
    'Customers with potential data issues' as message,
    COUNT(*) as affected_count
FROM customers 
WHERE (
    (trn IS NOT NULL AND LENGTH(trn) != 15) OR
    (outstanding_balance < 0) OR
    (risk_score IS NOT NULL AND (risk_score < 0 OR risk_score > 10)) OR
    (email NOT LIKE '%@%') OR
    (preferred_language NOT IN ('en', 'ar'))
);

-- Capacity alert: High customer growth
SELECT 
    'CAPACITY_ALERT' as alert_type,
    'High customer growth rate detected' as message,
    company_id,
    COUNT(*) as customers_added_today
FROM customers 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY company_id
HAVING COUNT(*) > 100;

-- =============================================
-- PERFORMANCE MONITORING SUMMARY
-- =============================================

-- This script provides comprehensive monitoring for:
-- ✅ Index usage and effectiveness analysis
-- ✅ Query performance benchmarking
-- ✅ Table health and maintenance recommendations
-- ✅ Customer search function optimization
-- ✅ Business analytics performance
-- ✅ Real-time performance alerts
-- ✅ Capacity planning metrics
-- ✅ Data integrity monitoring

-- Usage Instructions:
-- 1. Run daily performance monitoring queries
-- 2. Check weekly trends for capacity planning
-- 3. Execute maintenance commands as recommended
-- 4. Monitor alert queries for performance issues
-- 5. Benchmark critical queries after schema changes

COMMENT ON VIEW daily_customer_performance IS 'Daily customer performance metrics for monitoring and alerts';
COMMENT ON VIEW weekly_customer_trends IS 'Weekly customer growth and behavior trends for capacity planning';