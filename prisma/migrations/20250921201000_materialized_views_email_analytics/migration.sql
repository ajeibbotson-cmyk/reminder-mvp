-- Materialized Views for Email Analytics Performance
-- Optimizes complex consolidation analytics queries through pre-computed aggregations

BEGIN;

-- Drop existing materialized views if they exist (for redeployment)
DROP MATERIALIZED VIEW IF EXISTS mv_consolidation_performance_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_consolidation_customer_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_consolidation_template_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_consolidation_cultural_compliance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_consolidation_savings_summary CASCADE;

-- 1. Daily Consolidation Performance Materialized View
-- Aggregates daily metrics for consolidation performance tracking
CREATE MATERIALIZED VIEW mv_consolidation_performance_daily AS
SELECT
    company_id,
    DATE(created_at) as metric_date,
    COUNT(*) as total_consolidations,
    SUM(invoice_count) as total_invoices_consolidated,
    AVG(invoice_count::DECIMAL) as avg_invoices_per_consolidation,
    SUM(consolidation_savings) as total_email_savings,
    AVG(consolidation_savings) as avg_consolidation_savings,
    AVG(cultural_compliance_score) as avg_cultural_compliance,

    -- Delivery metrics
    COUNT(CASE WHEN delivery_status = 'DELIVERED' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN delivery_status = 'FAILED' THEN 1 END) as failed_count,
    COUNT(CASE WHEN delivery_status = 'BOUNCED' THEN 1 END) as bounced_count,

    -- Engagement metrics
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count,

    -- Escalation distribution
    COUNT(CASE WHEN escalation_level = 'POLITE' THEN 1 END) as polite_count,
    COUNT(CASE WHEN escalation_level = 'FIRM' THEN 1 END) as firm_count,
    COUNT(CASE WHEN escalation_level = 'URGENT' THEN 1 END) as urgent_count,
    COUNT(CASE WHEN escalation_level = 'FINAL' THEN 1 END) as final_count,

    -- PDF attachment metrics
    AVG(pdf_attachment_count) as avg_attachments,
    AVG(pdf_attachment_size) as avg_attachment_size,

    -- Timing metrics
    AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) as avg_delivery_time_seconds,
    AVG(EXTRACT(EPOCH FROM (opened_at - delivered_at))) as avg_open_time_seconds,

    -- Calculated rates
    CASE
        WHEN COUNT(*) > 0 THEN
            (COUNT(CASE WHEN delivery_status = 'DELIVERED' THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0
    END as delivery_rate,

    CASE
        WHEN COUNT(CASE WHEN delivery_status = 'DELIVERED' THEN 1 END) > 0 THEN
            (COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::DECIMAL /
             COUNT(CASE WHEN delivery_status = 'DELIVERED' THEN 1 END)) * 100
        ELSE 0
    END as open_rate,

    CASE
        WHEN COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) > 0 THEN
            (COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::DECIMAL /
             COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)) * 100
        ELSE 0
    END as click_to_open_rate,

    NOW() as last_updated
FROM email_logs
WHERE consolidated_reminder_id IS NOT NULL
GROUP BY company_id, DATE(created_at);

-- Create indexes for the materialized view
CREATE UNIQUE INDEX idx_mv_consolidation_daily_pk
ON mv_consolidation_performance_daily (company_id, metric_date);

CREATE INDEX idx_mv_consolidation_daily_date
ON mv_consolidation_performance_daily (metric_date DESC);

-- 2. Customer Consolidation Metrics Materialized View
-- Aggregates metrics by customer for customer insight analysis
CREATE MATERIALIZED VIEW mv_consolidation_customer_metrics AS
SELECT
    el.company_id,
    el.customer_id,
    c.name as customer_name,
    c.business_type,
    c.consolidation_preference,

    -- Volume metrics
    COUNT(*) as total_consolidations,
    SUM(el.invoice_count) as total_invoices_consolidated,
    AVG(el.invoice_count::DECIMAL) as avg_invoices_per_consolidation,

    -- Financial metrics
    SUM(cr.total_amount) as total_amount_consolidated,
    AVG(cr.total_amount) as avg_amount_per_consolidation,

    -- Engagement metrics
    COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as opened_count,
    COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as clicked_count,

    -- Cultural compliance
    AVG(el.cultural_compliance_score) as avg_cultural_compliance,

    -- Timing metrics
    MIN(el.created_at) as first_consolidation,
    MAX(el.created_at) as last_consolidation,

    -- Effectiveness metrics
    CASE
        WHEN COUNT(*) > 0 THEN
            (COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0
    END as delivery_rate,

    CASE
        WHEN COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END) > 0 THEN
            (COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)::DECIMAL /
             COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END)) * 100
        ELSE 0
    END as open_rate,

    -- Savings metrics
    SUM(el.consolidation_savings) as total_email_savings,
    AVG(el.consolidation_savings) as avg_consolidation_savings,

    -- Escalation patterns
    COUNT(CASE WHEN el.escalation_level = 'POLITE' THEN 1 END) as polite_count,
    COUNT(CASE WHEN el.escalation_level = 'URGENT' THEN 1 END) as urgent_count,
    COUNT(CASE WHEN el.escalation_level = 'FINAL' THEN 1 END) as final_count,

    NOW() as last_updated
FROM email_logs el
JOIN customers c ON el.customer_id = c.id
LEFT JOIN customer_consolidated_reminders cr ON el.consolidated_reminder_id = cr.id
WHERE el.consolidated_reminder_id IS NOT NULL
GROUP BY el.company_id, el.customer_id, c.name, c.business_type, c.consolidation_preference;

-- Create indexes for customer metrics view
CREATE UNIQUE INDEX idx_mv_customer_metrics_pk
ON mv_consolidation_customer_metrics (company_id, customer_id);

CREATE INDEX idx_mv_customer_metrics_performance
ON mv_consolidation_customer_metrics (company_id, open_rate DESC, total_consolidations DESC);

-- 3. Template Performance Materialized View
-- Analyzes performance by email template for optimization insights
CREATE MATERIALIZED VIEW mv_consolidation_template_performance AS
SELECT
    et.company_id,
    et.id as template_id,
    et.name as template_name,
    et.template_type,
    et.supports_consolidation,
    et.max_invoice_count,

    -- Usage metrics
    COUNT(el.id) as total_uses,
    SUM(el.invoice_count) as total_invoices_processed,
    AVG(el.invoice_count::DECIMAL) as avg_invoices_per_use,

    -- Performance metrics
    COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as opened_count,
    COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as clicked_count,

    -- Cultural compliance
    AVG(el.cultural_compliance_score) as avg_cultural_compliance,
    STDDEV(el.cultural_compliance_score) as cultural_compliance_stddev,

    -- Effectiveness rates
    CASE
        WHEN COUNT(el.id) > 0 THEN
            (COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END)::DECIMAL / COUNT(el.id)) * 100
        ELSE 0
    END as delivery_rate,

    CASE
        WHEN COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END) > 0 THEN
            (COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)::DECIMAL /
             COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END)) * 100
        ELSE 0
    END as open_rate,

    CASE
        WHEN COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) > 0 THEN
            (COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END)::DECIMAL /
             COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)) * 100
        ELSE 0
    END as click_to_open_rate,

    -- Savings analysis
    AVG(el.consolidation_savings) as avg_consolidation_savings,

    -- Escalation distribution for this template
    COUNT(CASE WHEN el.escalation_level = 'POLITE' THEN 1 END) as polite_usage,
    COUNT(CASE WHEN el.escalation_level = 'FIRM' THEN 1 END) as firm_usage,
    COUNT(CASE WHEN el.escalation_level = 'URGENT' THEN 1 END) as urgent_usage,
    COUNT(CASE WHEN el.escalation_level = 'FINAL' THEN 1 END) as final_usage,

    -- Timing metrics
    MIN(el.created_at) as first_use,
    MAX(el.created_at) as last_use,

    -- Template ranking score (weighted performance metric)
    CASE
        WHEN COUNT(el.id) > 0 THEN
            ((COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END)::DECIMAL / COUNT(el.id)) * 0.3 +
             (CASE WHEN COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END) > 0
                   THEN (COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)::DECIMAL /
                         COUNT(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 END))
                   ELSE 0 END) * 0.4 +
             (AVG(el.cultural_compliance_score) / 100) * 0.3) * 100
        ELSE 0
    END as performance_score,

    NOW() as last_updated
FROM email_templates et
LEFT JOIN email_logs el ON et.id = el.template_id AND el.consolidated_reminder_id IS NOT NULL
WHERE et.supports_consolidation = true
GROUP BY et.company_id, et.id, et.name, et.template_type, et.supports_consolidation, et.max_invoice_count;

-- Create indexes for template performance view
CREATE UNIQUE INDEX idx_mv_template_performance_pk
ON mv_consolidation_template_performance (company_id, template_id);

CREATE INDEX idx_mv_template_performance_score
ON mv_consolidation_template_performance (company_id, performance_score DESC);

-- 4. Cultural Compliance Materialized View
-- Analyzes cultural compliance patterns and effectiveness
CREATE MATERIALIZED VIEW mv_consolidation_cultural_compliance AS
SELECT
    company_id,

    -- Overall compliance metrics
    COUNT(*) as total_consolidations,
    AVG(cultural_compliance_score) as avg_compliance_score,
    STDDEV(cultural_compliance_score) as compliance_score_stddev,

    -- Compliance distribution
    COUNT(CASE WHEN cultural_compliance_score >= 90 THEN 1 END) as excellent_compliance,
    COUNT(CASE WHEN cultural_compliance_score >= 80 AND cultural_compliance_score < 90 THEN 1 END) as good_compliance,
    COUNT(CASE WHEN cultural_compliance_score >= 70 AND cultural_compliance_score < 80 THEN 1 END) as acceptable_compliance,
    COUNT(CASE WHEN cultural_compliance_score < 70 THEN 1 END) as poor_compliance,

    -- Language distribution
    COUNT(CASE WHEN language = 'en' THEN 1 END) as english_emails,
    COUNT(CASE WHEN language = 'ar' THEN 1 END) as arabic_emails,

    -- Escalation vs compliance correlation
    AVG(CASE WHEN escalation_level = 'POLITE' THEN cultural_compliance_score END) as polite_avg_compliance,
    AVG(CASE WHEN escalation_level = 'FIRM' THEN cultural_compliance_score END) as firm_avg_compliance,
    AVG(CASE WHEN escalation_level = 'URGENT' THEN cultural_compliance_score END) as urgent_avg_compliance,
    AVG(CASE WHEN escalation_level = 'FINAL' THEN cultural_compliance_score END) as final_avg_compliance,

    -- Performance correlation with compliance
    CORR(cultural_compliance_score,
         CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as compliance_open_correlation,
    CORR(cultural_compliance_score,
         CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as compliance_click_correlation,

    -- Time-based compliance trends
    DATE_TRUNC('month', MIN(created_at)) as earliest_month,
    DATE_TRUNC('month', MAX(created_at)) as latest_month,

    NOW() as last_updated
FROM email_logs
WHERE consolidated_reminder_id IS NOT NULL
GROUP BY company_id;

-- Create indexes for cultural compliance view
CREATE UNIQUE INDEX idx_mv_cultural_compliance_pk
ON mv_consolidation_cultural_compliance (company_id);

-- 5. Consolidation Savings Summary Materialized View
-- Comprehensive savings and efficiency analysis
CREATE MATERIALIZED VIEW mv_consolidation_savings_summary AS
SELECT
    company_id,

    -- Volume metrics
    COUNT(*) as total_consolidations,
    SUM(invoice_count) as total_invoices_consolidated,

    -- Savings calculations
    SUM(consolidation_savings) as total_email_savings,
    AVG(consolidation_savings) as avg_consolidation_savings,
    SUM(invoice_count - 1) as actual_emails_saved,

    -- Efficiency metrics
    AVG(invoice_count::DECIMAL) as avg_consolidation_ratio,
    MAX(invoice_count) as max_invoices_consolidated,

    -- Time savings (estimated)
    SUM(invoice_count - 1) * 5 as estimated_time_saved_minutes, -- 5 min per individual email

    -- Cost savings (estimated at $0.10 per email)
    SUM(invoice_count - 1) * 0.10 as estimated_cost_savings_usd,

    -- Attachment efficiency
    AVG(pdf_attachment_count) as avg_attachments_per_consolidation,
    AVG(pdf_attachment_size) as avg_attachment_size_bytes,

    -- Performance impact of consolidation
    AVG(CASE WHEN delivery_status = 'DELIVERED' THEN 1.0 ELSE 0.0 END) as consolidation_delivery_rate,
    AVG(CASE WHEN opened_at IS NOT NULL THEN 1.0 ELSE 0.0 END) as consolidation_open_rate,

    -- Consolidation trends by month
    DATE_TRUNC('month', MIN(created_at)) as first_consolidation_month,
    DATE_TRUNC('month', MAX(created_at)) as last_consolidation_month,

    -- ROI calculations
    CASE
        WHEN COUNT(*) > 0 THEN
            (SUM(invoice_count - 1) * 0.10) / (COUNT(*) * 0.05) -- Savings vs implementation cost
        ELSE 0
    END as estimated_roi_ratio,

    NOW() as last_updated
FROM email_logs
WHERE consolidated_reminder_id IS NOT NULL
  AND invoice_count > 1
GROUP BY company_id;

-- Create indexes for savings summary view
CREATE UNIQUE INDEX idx_mv_savings_summary_pk
ON mv_consolidation_savings_summary (company_id);

-- Create refresh function for all materialized views
CREATE OR REPLACE FUNCTION refresh_consolidation_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_consolidation_performance_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_consolidation_customer_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_consolidation_template_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_consolidation_cultural_compliance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_consolidation_savings_summary;

    -- Log the refresh
    INSERT INTO activities (id, company_id, user_id, type, description, metadata, created_at)
    VALUES (
        gen_random_uuid(),
        'system',
        'system',
        'materialized_view_refresh',
        'Refreshed consolidation analytics materialized views',
        jsonb_build_object('refresh_time', NOW()),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to refresh views for specific company (for real-time updates)
CREATE OR REPLACE FUNCTION refresh_company_consolidation_views(target_company_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- For company-specific updates, we'd typically refresh only relevant data
    -- This is a simplified version that refreshes all views
    PERFORM refresh_consolidation_materialized_views();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on materialized views
GRANT SELECT ON mv_consolidation_performance_daily TO PUBLIC;
GRANT SELECT ON mv_consolidation_customer_metrics TO PUBLIC;
GRANT SELECT ON mv_consolidation_template_performance TO PUBLIC;
GRANT SELECT ON mv_consolidation_cultural_compliance TO PUBLIC;
GRANT SELECT ON mv_consolidation_savings_summary TO PUBLIC;

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW mv_consolidation_performance_daily IS 'Daily aggregated metrics for consolidation performance tracking';
COMMENT ON MATERIALIZED VIEW mv_consolidation_customer_metrics IS 'Customer-level consolidation metrics for insight analysis';
COMMENT ON MATERIALIZED VIEW mv_consolidation_template_performance IS 'Template performance analysis for optimization';
COMMENT ON MATERIALIZED VIEW mv_consolidation_cultural_compliance IS 'Cultural compliance patterns and effectiveness analysis';
COMMENT ON MATERIALIZED VIEW mv_consolidation_savings_summary IS 'Comprehensive savings and efficiency analysis';

-- Initial refresh of all materialized views
SELECT refresh_consolidation_materialized_views();

COMMIT;