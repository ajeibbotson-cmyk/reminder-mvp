-- Materialized Views for Consolidation Analytics Performance
-- Sprint 3: Database Agent Implementation

-- 1. Consolidation Effectiveness Analytics Materialized View
CREATE MATERIALIZED VIEW consolidation_effectiveness_metrics AS
SELECT
    c.id as company_id,
    c.name as company_name,

    -- Time Period Aggregations
    DATE_TRUNC('day', ccr.created_at) as metric_date,
    DATE_TRUNC('week', ccr.created_at) as metric_week,
    DATE_TRUNC('month', ccr.created_at) as metric_month,

    -- Basic Consolidation Metrics
    COUNT(ccr.id) as total_consolidations,
    COUNT(DISTINCT ccr.customer_id) as unique_customers_consolidated,
    AVG(ccr.invoice_count) as avg_invoices_per_consolidation,
    SUM(ccr.total_amount) as total_consolidated_amount,

    -- Email Efficiency Metrics
    COUNT(el.id) as total_emails_sent,
    COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END) as emails_delivered,
    COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as emails_opened,
    COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as emails_clicked,

    -- Response and Payment Metrics
    COUNT(CASE WHEN ccr.customer_responded_at IS NOT NULL THEN 1 END) as customer_responses,
    COUNT(CASE WHEN ccr.payment_received_at IS NOT NULL THEN 1 END) as payments_received,

    -- Consolidation Savings (% reduction in emails vs individual)
    AVG(el.consolidation_savings) as avg_email_savings_percentage,

    -- Response Time Analytics
    AVG(EXTRACT(DAYS FROM ccr.customer_responded_at - ccr.sent_at)) as avg_response_time_days,
    AVG(EXTRACT(DAYS FROM ccr.payment_received_at - ccr.sent_at)) as avg_payment_time_days,

    -- Priority and Escalation Analytics
    AVG(ccr.priority_score) as avg_priority_score,
    COUNT(CASE WHEN ccr.escalation_level = 'POLITE' THEN 1 END) as polite_reminders,
    COUNT(CASE WHEN ccr.escalation_level = 'FIRM' THEN 1 END) as firm_reminders,
    COUNT(CASE WHEN ccr.escalation_level = 'URGENT' THEN 1 END) as urgent_reminders,
    COUNT(CASE WHEN ccr.escalation_level = 'FINAL' THEN 1 END) as final_reminders,

    -- Cultural Compliance Metrics
    COUNT(CASE WHEN ccr.cultural_compliance_flags::text != '{}' THEN 1 END) as cultural_flags_applied,

    CURRENT_TIMESTAMP as last_updated
FROM
    companies c
    LEFT JOIN customer_consolidated_reminders ccr ON c.id = ccr.company_id
    LEFT JOIN email_logs el ON ccr.id = el.consolidated_reminder_id
WHERE
    ccr.created_at >= CURRENT_DATE - INTERVAL '90 days'  -- Last 90 days for performance
GROUP BY
    c.id,
    c.name,
    DATE_TRUNC('day', ccr.created_at),
    DATE_TRUNC('week', ccr.created_at),
    DATE_TRUNC('month', ccr.created_at);

-- Index for fast querying
CREATE INDEX idx_consolidation_effectiveness_company_date
ON consolidation_effectiveness_metrics (company_id, metric_date);

CREATE INDEX idx_consolidation_effectiveness_metrics_week
ON consolidation_effectiveness_metrics (company_id, metric_week);

CREATE INDEX idx_consolidation_effectiveness_metrics_month
ON consolidation_effectiveness_metrics (company_id, metric_month);

-- 2. Customer-Level Analytics Materialized View
CREATE MATERIALIZED VIEW customer_consolidation_analytics AS
SELECT
    cust.id as customer_id,
    cust.company_id,
    cust.name as customer_name,
    cust.email as customer_email,

    -- Consolidation Behavior Metrics
    COUNT(ccr.id) as total_consolidations_received,
    SUM(ccr.total_amount) as total_amount_consolidated,
    AVG(ccr.invoice_count) as avg_invoices_per_consolidation,
    MAX(ccr.invoice_count) as max_invoices_consolidated,

    -- Response Pattern Analytics
    COUNT(CASE WHEN ccr.customer_responded_at IS NOT NULL THEN 1 END) as times_responded,
    COUNT(CASE WHEN ccr.payment_received_at IS NOT NULL THEN 1 END) as times_paid,

    -- Response Time Analysis
    AVG(EXTRACT(DAYS FROM ccr.customer_responded_at - ccr.sent_at)) as avg_response_time_days,
    AVG(EXTRACT(DAYS FROM ccr.payment_received_at - ccr.sent_at)) as avg_payment_time_days,

    -- Email Engagement
    COUNT(CASE WHEN ccr.email_opened_at IS NOT NULL THEN 1 END) as emails_opened,
    COUNT(CASE WHEN ccr.email_clicked_at IS NOT NULL THEN 1 END) as emails_clicked,

    -- Most Recent Activity
    MAX(ccr.sent_at) as last_consolidation_sent,
    MAX(ccr.customer_responded_at) as last_customer_response,
    MAX(ccr.payment_received_at) as last_payment_received,

    -- Preference and Effectiveness
    cust.consolidation_preference,
    cust.max_consolidation_amount,
    cust.preferred_contact_interval,

    -- Calculate effectiveness score (0-100)
    CASE
        WHEN COUNT(ccr.id) = 0 THEN 0
        ELSE ROUND(
            (COUNT(CASE WHEN ccr.payment_received_at IS NOT NULL THEN 1 END)::DECIMAL / COUNT(ccr.id) * 100), 2
        )
    END as consolidation_effectiveness_score,

    CURRENT_TIMESTAMP as last_updated
FROM
    customers cust
    LEFT JOIN customer_consolidated_reminders ccr ON cust.id = ccr.customer_id
WHERE
    cust.is_active = true
    AND (ccr.created_at >= CURRENT_DATE - INTERVAL '180 days' OR ccr.created_at IS NULL)  -- 6 months data
GROUP BY
    cust.id,
    cust.company_id,
    cust.name,
    cust.email,
    cust.consolidation_preference,
    cust.max_consolidation_amount,
    cust.preferred_contact_interval;

-- Indexes for customer analytics
CREATE INDEX idx_customer_consolidation_analytics_company
ON customer_consolidation_analytics (company_id);

CREATE INDEX idx_customer_consolidation_analytics_effectiveness
ON customer_consolidation_analytics (company_id, consolidation_effectiveness_score DESC);

CREATE INDEX idx_customer_consolidation_analytics_last_activity
ON customer_consolidation_analytics (company_id, last_consolidation_sent DESC);

-- 3. Real-time Dashboard Metrics View
CREATE MATERIALIZED VIEW dashboard_consolidation_metrics AS
SELECT
    c.id as company_id,
    c.name as company_name,

    -- Current Period Metrics (Last 30 days)
    COUNT(CASE WHEN ccr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as consolidations_last_30_days,
    COUNT(CASE WHEN ccr.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as consolidations_last_7_days,
    COUNT(CASE WHEN ccr.created_at >= CURRENT_DATE THEN 1 END) as consolidations_today,

    -- Pending Consolidations
    COUNT(CASE WHEN ccr.delivery_status = 'QUEUED' THEN 1 END) as queued_consolidations,
    COUNT(CASE WHEN ccr.delivery_status = 'SENT' THEN 1 END) as sent_consolidations,
    COUNT(CASE WHEN ccr.scheduled_for > CURRENT_TIMESTAMP THEN 1 END) as scheduled_consolidations,

    -- Amount Metrics
    SUM(CASE WHEN ccr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN ccr.total_amount ELSE 0 END) as amount_consolidated_30_days,
    SUM(CASE WHEN ccr.payment_received_at >= CURRENT_DATE - INTERVAL '30 days' THEN ccr.total_amount ELSE 0 END) as amount_collected_30_days,

    -- Email Efficiency
    AVG(CASE WHEN el.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN el.consolidation_savings END) as avg_email_savings_30_days,
    SUM(CASE WHEN el.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN el.invoice_count ELSE 0 END) as total_invoices_consolidated_30_days,

    -- Success Rates
    ROUND(
        COUNT(CASE WHEN ccr.payment_received_at IS NOT NULL AND ccr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::DECIMAL /
        NULLIF(COUNT(CASE WHEN ccr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END), 0) * 100, 2
    ) as payment_success_rate_30_days,

    ROUND(
        COUNT(CASE WHEN ccr.customer_responded_at IS NOT NULL AND ccr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::DECIMAL /
        NULLIF(COUNT(CASE WHEN ccr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END), 0) * 100, 2
    ) as response_rate_30_days,

    -- Top Priority Items
    COUNT(CASE WHEN ccr.priority_score >= 80 AND ccr.delivery_status IN ('QUEUED', 'SENT') THEN 1 END) as high_priority_pending,

    CURRENT_TIMESTAMP as last_updated
FROM
    companies c
    LEFT JOIN customer_consolidated_reminders ccr ON c.id = ccr.company_id
    LEFT JOIN email_logs el ON ccr.id = el.consolidated_reminder_id
GROUP BY
    c.id, c.name;

-- Index for dashboard metrics
CREATE INDEX idx_dashboard_consolidation_metrics_company
ON dashboard_consolidation_metrics (company_id);

-- 4. Performance Optimization Indexes for Existing Tables

-- Consolidation reminders performance indexes
CREATE INDEX IF NOT EXISTS idx_consolidated_reminders_company_status_priority
ON customer_consolidated_reminders (company_id, delivery_status, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_consolidated_reminders_scheduled_delivery
ON customer_consolidated_reminders (scheduled_for, delivery_status)
WHERE scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consolidated_reminders_response_tracking
ON customer_consolidated_reminders (company_id, sent_at, customer_responded_at, payment_received_at);

-- Email logs consolidation indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_consolidation_analytics
ON email_logs (consolidated_reminder_id, delivery_status, sent_at, invoice_count)
WHERE consolidated_reminder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_consolidation_savings
ON email_logs (company_id, sent_at, consolidation_savings)
WHERE consolidation_savings > 0;

-- Customer consolidation preference indexes
CREATE INDEX IF NOT EXISTS idx_customers_consolidation_preferences
ON customers (company_id, consolidation_preference, is_active);

CREATE INDEX IF NOT EXISTS idx_customers_consolidation_eligibility
ON customers (company_id, outstanding_balance, last_payment_date, consolidation_preference)
WHERE is_active = true;

-- 5. Analytics Function for Dynamic Querying
CREATE OR REPLACE FUNCTION get_consolidation_analytics(
    p_company_id VARCHAR,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_customer_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    total_consolidations BIGINT,
    total_amount DECIMAL,
    avg_invoices_per_consolidation DECIMAL,
    email_savings_percentage DECIMAL,
    payment_success_rate DECIMAL,
    avg_response_time_days DECIMAL,
    high_priority_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(ccr.id)::BIGINT as total_consolidations,
        COALESCE(SUM(ccr.total_amount), 0) as total_amount,
        COALESCE(AVG(ccr.invoice_count), 0) as avg_invoices_per_consolidation,
        COALESCE(AVG(el.consolidation_savings), 0) as email_savings_percentage,
        CASE
            WHEN COUNT(ccr.id) > 0 THEN
                ROUND(COUNT(CASE WHEN ccr.payment_received_at IS NOT NULL THEN 1 END)::DECIMAL / COUNT(ccr.id) * 100, 2)
            ELSE 0
        END as payment_success_rate,
        COALESCE(AVG(EXTRACT(DAYS FROM ccr.customer_responded_at - ccr.sent_at)), 0) as avg_response_time_days,
        COUNT(CASE WHEN ccr.priority_score >= 80 THEN 1 END)::BIGINT as high_priority_count
    FROM
        customer_consolidated_reminders ccr
        LEFT JOIN email_logs el ON ccr.id = el.consolidated_reminder_id
    WHERE
        ccr.company_id = p_company_id
        AND ccr.created_at::DATE BETWEEN p_start_date AND p_end_date
        AND (p_customer_id IS NULL OR ccr.customer_id = p_customer_id);
END;
$$ LANGUAGE plpgsql;

-- 6. Refresh Functions for Materialized Views
CREATE OR REPLACE FUNCTION refresh_consolidation_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW consolidation_effectiveness_metrics;
    REFRESH MATERIALIZED VIEW customer_consolidation_analytics;
    REFRESH MATERIALIZED VIEW dashboard_consolidation_metrics;
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic refresh (requires pg_cron extension or external scheduler)
-- This would typically be handled by application-level cron or cloud scheduler
-- COMMENT: Add to cron: SELECT refresh_consolidation_analytics(); every 15 minutes

-- 7. Data Cleanup Procedures
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS VOID AS $$
BEGIN
    -- Archive old email logs (older than 1 year)
    UPDATE email_logs
    SET consolidation_metadata = consolidation_metadata || '{"archived": true}'::jsonb
    WHERE sent_at < CURRENT_DATE - INTERVAL '1 year'
    AND consolidation_metadata::jsonb ->> 'archived' IS NULL;

    -- Clean up old temporary analytics data
    DELETE FROM consolidation_effectiveness_metrics
    WHERE metric_date < CURRENT_DATE - INTERVAL '180 days';

    -- Update customer analytics last_updated timestamp
    UPDATE customer_consolidation_analytics
    SET last_updated = CURRENT_TIMESTAMP
    WHERE last_updated < CURRENT_DATE - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring queries for Sprint 3 validation
CREATE OR REPLACE FUNCTION validate_analytics_performance()
RETURNS TABLE (
    query_description TEXT,
    execution_time_ms INTEGER,
    performance_status TEXT
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTEGER;
BEGIN
    -- Test 1: Dashboard metrics query
    start_time := clock_timestamp();
    PERFORM * FROM dashboard_consolidation_metrics LIMIT 100;
    end_time := clock_timestamp();
    duration := EXTRACT(milliseconds FROM end_time - start_time)::INTEGER;

    RETURN QUERY SELECT
        'Dashboard consolidation metrics'::TEXT,
        duration,
        CASE WHEN duration < 200 THEN 'EXCELLENT' WHEN duration < 500 THEN 'GOOD' ELSE 'NEEDS_OPTIMIZATION' END;

    -- Test 2: Customer analytics query
    start_time := clock_timestamp();
    PERFORM * FROM customer_consolidation_analytics WHERE company_id = (SELECT id FROM companies LIMIT 1) LIMIT 50;
    end_time := clock_timestamp();
    duration := EXTRACT(milliseconds FROM end_time - start_time)::INTEGER;

    RETURN QUERY SELECT
        'Customer consolidation analytics'::TEXT,
        duration,
        CASE WHEN duration < 200 THEN 'EXCELLENT' WHEN duration < 500 THEN 'GOOD' ELSE 'NEEDS_OPTIMIZATION' END;

    -- Test 3: Effectiveness metrics query
    start_time := clock_timestamp();
    PERFORM * FROM consolidation_effectiveness_metrics WHERE company_id = (SELECT id FROM companies LIMIT 1) LIMIT 30;
    end_time := clock_timestamp();
    duration := EXTRACT(milliseconds FROM end_time - start_time)::INTEGER;

    RETURN QUERY SELECT
        'Consolidation effectiveness metrics'::TEXT,
        duration,
        CASE WHEN duration < 200 THEN 'EXCELLENT' WHEN duration < 500 THEN 'GOOD' ELSE 'NEEDS_OPTIMIZATION' END;
END;
$$ LANGUAGE plpgsql;