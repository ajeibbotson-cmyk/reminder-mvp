-- Migration: Unified Platform Finalization
-- Purpose: Complete the integration with optimizations, constraints, and production-ready features
-- Phase: 3 of 3 (Finalization & Optimization)

-- =====================================================
-- 1. ADVANCED CONSTRAINTS & BUSINESS RULES
-- =====================================================

-- Ensure email providers have valid configuration
ALTER TABLE email_providers ADD CONSTRAINT chk_provider_quota
CHECK (daily_quota > 0 AND daily_quota <= 10000);

ALTER TABLE email_providers ADD CONSTRAINT chk_sent_within_quota
CHECK (daily_sent_count <= daily_quota);

-- Ensure campaign data integrity
ALTER TABLE invoice_campaigns ADD CONSTRAINT chk_campaign_dates
CHECK (
    scheduled_for IS NULL OR
    scheduled_for > created_at
);

ALTER TABLE invoice_campaigns ADD CONSTRAINT chk_campaign_counts
CHECK (
    sent_count <= total_recipients AND
    delivered_count <= sent_count AND
    opened_count <= delivered_count AND
    clicked_count <= opened_count
);

-- Ensure email send attempt limits
ALTER TABLE campaign_email_sends ADD CONSTRAINT chk_send_attempts
CHECK (attempt_count >= 0 AND attempt_count <= max_attempts);

-- =====================================================
-- 2. ADVANCED INDEXES FOR PERFORMANCE
-- =====================================================

-- Performance indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_dashboard_active_campaigns
ON invoice_campaigns(company_id, status, last_activity_at DESC)
WHERE status IN ('sending', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_dashboard_recent_activity
ON campaign_email_sends(company_id, sent_at DESC, status);

-- Analytics performance indexes
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_performance
ON campaign_email_sends(campaign_id, status, sent_at, opened_at, clicked_at);

CREATE INDEX IF NOT EXISTS idx_analytics_customer_engagement
ON campaign_email_sends(customer_id, sent_at DESC, opened_at, clicked_at);

-- Queue processing optimization
CREATE INDEX IF NOT EXISTS idx_email_queue_processing
ON campaign_email_sends(status, queued_at ASC, email_provider_id)
WHERE status = 'queued';

-- Provider quota management
CREATE INDEX IF NOT EXISTS idx_provider_daily_usage
ON email_providers(company_id, quota_reset_date, daily_sent_count, daily_quota);

-- Event tracking optimization
CREATE INDEX IF NOT EXISTS idx_event_tracking_recent
ON email_event_tracking(company_id, event_timestamp DESC, event_type);

-- Customer email history
CREATE INDEX IF NOT EXISTS idx_customer_email_timeline
ON campaign_email_sends(customer_id, invoice_id, sent_at DESC);

-- =====================================================
-- 3. CAMPAIGN WORKFLOW AUTOMATION TABLES
-- =====================================================

-- Campaign Automation Rules
CREATE TABLE campaign_automation_rules (
    id TEXT PRIMARY KEY DEFAULT ('car_' || lower(hex(randomblob(12)))),
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Rule Configuration
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,

    -- Trigger Conditions
    trigger_type TEXT NOT NULL CHECK (
        trigger_type IN ('invoice_overdue', 'invoice_created', 'payment_terms_reached', 'custom_date')
    ),
    trigger_conditions TEXT NOT NULL, -- JSON object with conditions

    -- Campaign Template
    template_id TEXT REFERENCES email_templates(id),
    email_provider_id TEXT REFERENCES email_providers(id),

    -- Automation Settings
    delay_days INTEGER DEFAULT 0,
    max_executions INTEGER DEFAULT 1, -- Per invoice
    execution_window_hours INTEGER DEFAULT 24, -- Business hours consideration

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id),

    -- Constraints
    CHECK (delay_days >= 0),
    CHECK (max_executions > 0),
    CHECK (execution_window_hours > 0)
);

CREATE INDEX idx_automation_rules_company ON campaign_automation_rules(company_id, is_active, trigger_type);
CREATE INDEX idx_automation_rules_trigger ON campaign_automation_rules(trigger_type, is_active);

-- Campaign Automation Executions (Track automatic campaign creation)
CREATE TABLE campaign_automation_executions (
    id TEXT PRIMARY KEY DEFAULT ('cae_' || lower(hex(randomblob(12)))),
    rule_id TEXT NOT NULL REFERENCES campaign_automation_rules(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES invoice_campaigns(id) ON DELETE SET NULL,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Execution Details
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id),

    -- Execution Status
    status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'executed', 'skipped', 'failed')
    ),

    -- Scheduling
    scheduled_for DATETIME NOT NULL,
    executed_at DATETIME,

    -- Results
    execution_result TEXT, -- JSON object with results
    error_message TEXT,

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(rule_id, invoice_id) -- Prevent duplicate executions per rule/invoice
);

CREATE INDEX idx_automation_executions_schedule ON campaign_automation_executions(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_automation_executions_invoice ON campaign_automation_executions(invoice_id, status);
CREATE INDEX idx_automation_executions_rule ON campaign_automation_executions(rule_id, executed_at DESC);

-- =====================================================
-- 4. EMAIL DELIVERABILITY & REPUTATION TRACKING
-- =====================================================

-- Email Reputation Tracking
CREATE TABLE email_reputation_tracking (
    id TEXT PRIMARY KEY DEFAULT ('ert_' || lower(hex(randomblob(12)))),
    email_provider_id TEXT NOT NULL REFERENCES email_providers(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Daily Metrics
    date DATE NOT NULL DEFAULT (date('now')),

    -- Sending Statistics
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_complained INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,

    -- Engagement Statistics
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,

    -- Reputation Metrics
    bounce_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN emails_sent > 0 THEN (emails_bounced * 100.0 / emails_sent) ELSE 0 END
    ) STORED,
    complaint_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN emails_delivered > 0 THEN (emails_complained * 100.0 / emails_delivered) ELSE 0 END
    ) STORED,
    engagement_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN emails_delivered > 0 THEN ((emails_opened + emails_clicked) * 100.0 / emails_delivered) ELSE 0 END
    ) STORED,

    -- Reputation Score (calculated)
    reputation_score DECIMAL(3, 2) DEFAULT 1.00, -- 0.00 to 1.00

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(email_provider_id, date),
    CHECK (reputation_score >= 0 AND reputation_score <= 1)
);

CREATE INDEX idx_reputation_tracking_provider ON email_reputation_tracking(email_provider_id, date DESC);
CREATE INDEX idx_reputation_tracking_company ON email_reputation_tracking(company_id, date DESC);
CREATE INDEX idx_reputation_tracking_score ON email_reputation_tracking(reputation_score ASC, date DESC);

-- =====================================================
-- 5. ADVANCED ANALYTICS TABLES
-- =====================================================

-- Campaign Cohort Analysis
CREATE TABLE campaign_cohort_analysis (
    id TEXT PRIMARY KEY DEFAULT ('cca_' || lower(hex(randomblob(12)))),
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Cohort Definition
    cohort_date DATE NOT NULL, -- Month/week of first campaign
    cohort_type TEXT DEFAULT 'monthly' CHECK (cohort_type IN ('weekly', 'monthly', 'quarterly')),

    -- Cohort Metrics
    total_customers INTEGER NOT NULL,
    active_customers INTEGER NOT NULL,
    total_campaigns INTEGER NOT NULL,
    total_emails_sent INTEGER NOT NULL,

    -- Engagement Metrics by Time Period
    period_1_engagement DECIMAL(5, 2) DEFAULT 0, -- First period (open rate)
    period_2_engagement DECIMAL(5, 2) DEFAULT 0, -- Second period
    period_3_engagement DECIMAL(5, 2) DEFAULT 0, -- Third period
    period_6_engagement DECIMAL(5, 2) DEFAULT 0, -- Sixth period
    period_12_engagement DECIMAL(5, 2) DEFAULT 0, -- Twelfth period

    -- Revenue Impact (if payment tracking available)
    total_invoice_value DECIMAL(12, 2) DEFAULT 0,
    paid_invoice_value DECIMAL(12, 2) DEFAULT 0,
    payment_acceleration_days DECIMAL(5, 1) DEFAULT 0, -- Days faster than normal

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(company_id, cohort_date, cohort_type)
);

CREATE INDEX idx_cohort_analysis_company ON campaign_cohort_analysis(company_id, cohort_date DESC);
CREATE INDEX idx_cohort_analysis_engagement ON campaign_cohort_analysis(period_1_engagement DESC, total_customers DESC);

-- A/B Testing Framework
CREATE TABLE campaign_ab_tests (
    id TEXT PRIMARY KEY DEFAULT ('abt_' || lower(hex(randomblob(12)))),
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Test Configuration
    test_name TEXT NOT NULL,
    description TEXT,
    hypothesis TEXT,

    -- Test Setup
    control_template_id TEXT REFERENCES email_templates(id),
    variant_template_id TEXT REFERENCES email_templates(id),
    split_percentage INTEGER DEFAULT 50, -- % for variant (0-100)

    -- Test Criteria
    minimum_sample_size INTEGER DEFAULT 100,
    confidence_level DECIMAL(3, 2) DEFAULT 0.95, -- 0.95 = 95% confidence
    test_metric TEXT DEFAULT 'open_rate' CHECK (
        test_metric IN ('open_rate', 'click_rate', 'conversion_rate', 'payment_rate')
    ),

    -- Test Status
    status TEXT DEFAULT 'draft' CHECK (
        status IN ('draft', 'running', 'completed', 'stopped')
    ),
    started_at DATETIME,
    ended_at DATETIME,

    -- Results
    control_participants INTEGER DEFAULT 0,
    variant_participants INTEGER DEFAULT 0,
    control_conversions INTEGER DEFAULT 0,
    variant_conversions INTEGER DEFAULT 0,
    control_conversion_rate DECIMAL(5, 2) DEFAULT 0,
    variant_conversion_rate DECIMAL(5, 2) DEFAULT 0,
    statistical_significance DECIMAL(5, 4), -- p-value
    winner TEXT CHECK (winner IN ('control', 'variant', 'inconclusive')),

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id),

    -- Constraints
    CHECK (split_percentage >= 0 AND split_percentage <= 100),
    CHECK (minimum_sample_size > 0),
    CHECK (confidence_level > 0 AND confidence_level < 1)
);

CREATE INDEX idx_ab_tests_company ON campaign_ab_tests(company_id, status, created_at DESC);
CREATE INDEX idx_ab_tests_running ON campaign_ab_tests(status, started_at) WHERE status = 'running';

-- A/B Test Assignments
CREATE TABLE campaign_ab_test_assignments (
    id TEXT PRIMARY KEY DEFAULT ('abta_' || lower(hex(randomblob(12)))),
    test_id TEXT NOT NULL REFERENCES campaign_ab_tests(id) ON DELETE CASCADE,
    campaign_send_id TEXT NOT NULL REFERENCES campaign_email_sends(id) ON DELETE CASCADE,

    -- Assignment Details
    assignment TEXT NOT NULL CHECK (assignment IN ('control', 'variant')),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Results
    converted BOOLEAN DEFAULT FALSE,
    conversion_value DECIMAL(10, 2),
    conversion_date DATETIME,

    -- Constraints
    UNIQUE(test_id, campaign_send_id)
);

CREATE INDEX idx_ab_assignments_test ON campaign_ab_test_assignments(test_id, assignment, converted);
CREATE INDEX idx_ab_assignments_send ON campaign_ab_test_assignments(campaign_send_id);

-- =====================================================
-- 6. ENHANCED BUSINESS INTELLIGENCE VIEWS
-- =====================================================

-- Comprehensive Campaign Performance View
CREATE VIEW v_campaign_dashboard AS
SELECT
    ic.company_id,
    ic.id as campaign_id,
    ic.name as campaign_name,
    ic.campaign_type,
    ic.status,
    ic.created_at,
    ic.processing_started_at,
    ic.processing_completed_at,

    -- Invoice Information
    ic.invoice_count,
    ic.total_amount,
    ic.currency,

    -- Email Statistics
    ic.total_recipients,
    ic.sent_count,
    ic.delivered_count,
    ic.opened_count,
    ic.clicked_count,
    ic.failed_count,
    ic.bounced_count,

    -- Performance Metrics
    ROUND(
        CASE WHEN ic.total_recipients > 0
        THEN (ic.sent_count * 100.0 / ic.total_recipients)
        ELSE 0 END, 2
    ) as send_rate,

    ROUND(
        CASE WHEN ic.sent_count > 0
        THEN (ic.delivered_count * 100.0 / ic.sent_count)
        ELSE 0 END, 2
    ) as delivery_rate,

    ROUND(
        CASE WHEN ic.delivered_count > 0
        THEN (ic.opened_count * 100.0 / ic.delivered_count)
        ELSE 0 END, 2
    ) as open_rate,

    ROUND(
        CASE WHEN ic.opened_count > 0
        THEN (ic.clicked_count * 100.0 / ic.opened_count)
        ELSE 0 END, 2
    ) as click_through_rate,

    -- Provider Information
    ep.provider_type,
    ep.provider_email,
    ep.is_active as provider_active,

    -- Template Information
    et.name as template_name,
    et.template_type as template_type,

    -- Processing Time
    CASE
        WHEN ic.processing_started_at IS NOT NULL AND ic.processing_completed_at IS NOT NULL
        THEN ROUND((julianday(ic.processing_completed_at) - julianday(ic.processing_started_at)) * 1440, 2)
        ELSE NULL
    END as processing_time_minutes

FROM invoice_campaigns ic
LEFT JOIN email_providers ep ON ic.email_provider_id = ep.id
LEFT JOIN email_templates et ON ic.template_id = et.id;

-- Customer Email Engagement Summary
CREATE VIEW v_customer_engagement AS
SELECT
    c.company_id,
    c.id as customer_id,
    c.name as customer_name,
    c.email as customer_email,
    c.business_name,

    -- Email Statistics
    COUNT(ces.id) as total_emails_received,
    COUNT(CASE WHEN ces.sent_at IS NOT NULL THEN 1 END) as emails_sent,
    COUNT(CASE WHEN ces.delivered_at IS NOT NULL THEN 1 END) as emails_delivered,
    COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) as emails_opened,
    COUNT(CASE WHEN ces.clicked_at IS NOT NULL THEN 1 END) as emails_clicked,
    COUNT(CASE WHEN ces.bounced_at IS NOT NULL THEN 1 END) as emails_bounced,

    -- Engagement Rates
    ROUND(
        CASE WHEN COUNT(ces.id) > 0
        THEN (COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(ces.id))
        ELSE 0 END, 2
    ) as open_rate,

    ROUND(
        CASE WHEN COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) > 0
        THEN (COUNT(CASE WHEN ces.clicked_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END))
        ELSE 0 END, 2
    ) as click_through_rate,

    -- Timeline
    MAX(ces.sent_at) as last_email_sent,
    MAX(ces.opened_at) as last_email_opened,
    MAX(ces.clicked_at) as last_email_clicked,

    -- Risk Indicators
    c.email_bounce_count,
    c.is_email_suppressed,

    -- Business Value
    c.outstanding_balance,
    c.lifetime_value

FROM customers c
LEFT JOIN campaign_email_sends ces ON c.id = ces.customer_id
GROUP BY c.id;

-- Daily Analytics Summary
CREATE VIEW v_daily_analytics AS
SELECT
    company_id,
    DATE(sent_at) as date,

    -- Volume Metrics
    COUNT(*) as emails_sent,
    COUNT(DISTINCT campaign_id) as campaigns_active,
    COUNT(DISTINCT customer_id) as customers_contacted,
    COUNT(DISTINCT invoice_id) as invoices_followed_up,

    -- Engagement Metrics
    COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END) as emails_delivered,
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as emails_opened,
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as emails_clicked,
    COUNT(CASE WHEN bounced_at IS NOT NULL THEN 1 END) as emails_bounced,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as emails_failed,

    -- Performance Metrics
    ROUND(
        (COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 2
    ) as delivery_rate,

    ROUND(
        (COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) * 100.0 /
         NULLIF(COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END), 0)), 2
    ) as open_rate,

    ROUND(
        (COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0 /
         NULLIF(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END), 0)), 2
    ) as click_through_rate

FROM campaign_email_sends
WHERE sent_at IS NOT NULL
GROUP BY company_id, DATE(sent_at);

-- =====================================================
-- 7. AUTOMATED MAINTENANCE PROCEDURES
-- =====================================================

-- Create triggers for automated maintenance

-- Update email reputation daily
CREATE TRIGGER trigger_update_email_reputation
    AFTER INSERT ON campaign_email_sends
    WHEN NEW.sent_at IS NOT NULL
BEGIN
    INSERT OR REPLACE INTO email_reputation_tracking (
        email_provider_id,
        company_id,
        date,
        emails_sent,
        emails_delivered,
        emails_bounced,
        emails_opened,
        emails_clicked
    )
    SELECT
        NEW.email_provider_id,
        NEW.company_id,
        DATE(NEW.sent_at),
        COUNT(*) as emails_sent,
        COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END) as emails_delivered,
        COUNT(CASE WHEN bounced_at IS NOT NULL THEN 1 END) as emails_bounced,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as emails_opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as emails_clicked
    FROM campaign_email_sends
    WHERE email_provider_id = NEW.email_provider_id
    AND DATE(sent_at) = DATE(NEW.sent_at);
END;

-- Reset daily quotas at midnight
CREATE TRIGGER trigger_reset_daily_quotas
    AFTER UPDATE ON email_providers
    WHEN DATE(NEW.quota_reset_date) < DATE('now')
BEGIN
    UPDATE email_providers
    SET
        daily_sent_count = 0,
        quota_reset_date = DATE('now'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Update customer last email sent timestamp
CREATE TRIGGER trigger_update_customer_email_timestamp
    AFTER UPDATE ON campaign_email_sends
    WHEN OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL
BEGIN
    UPDATE customers
    SET last_email_sent_at = NEW.sent_at
    WHERE id = NEW.customer_id;
END;

-- =====================================================
-- 8. SECURITY ENHANCEMENTS
-- =====================================================

-- Create audit trail for sensitive operations
CREATE TABLE email_security_audit (
    id TEXT PRIMARY KEY DEFAULT ('esa_' || lower(hex(randomblob(12)))),
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Audit Details
    event_type TEXT NOT NULL CHECK (
        event_type IN ('provider_added', 'provider_removed', 'token_refreshed',
                      'bulk_campaign_sent', 'template_modified', 'data_exported')
    ),
    user_id TEXT REFERENCES users(id),
    entity_type TEXT, -- table being modified
    entity_id TEXT,   -- ID of modified record

    -- Security Context
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,

    -- Change Details
    changes_made TEXT, -- JSON object with before/after values
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_audit_company ON email_security_audit(company_id, created_at DESC);
CREATE INDEX idx_security_audit_user ON email_security_audit(user_id, event_type, created_at DESC);
CREATE INDEX idx_security_audit_risk ON email_security_audit(risk_level, created_at DESC) WHERE risk_level IN ('high', 'critical');

-- =====================================================
-- 9. FINALIZATION & CLEANUP
-- =====================================================

-- Update schema version
CREATE TABLE IF NOT EXISTS schema_versions (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_versions (version, description) VALUES
('3.0.0', 'Unified Platform Integration Complete - Reminder + SendAChaser');

-- Clean up temporary migration tables
DROP TABLE IF EXISTS temp_user_mapping;
DROP TABLE IF EXISTS temp_contact_migration;
DROP TABLE IF EXISTS temp_template_migration;
DROP TABLE IF EXISTS temp_campaign_migration;

-- Update migration status
UPDATE migration_status
SET status = 'completed', completed_at = CURRENT_TIMESTAMP
WHERE migration_phase = 'unified_platform' AND entity_type = 'finalization';

-- =====================================================
-- 10. PERFORMANCE VALIDATION
-- =====================================================

-- Create performance test queries for validation

-- Test: Campaign dashboard load time (should be < 2 seconds)
EXPLAIN QUERY PLAN
SELECT * FROM v_campaign_dashboard
WHERE company_id = 'test_company_id'
ORDER BY created_at DESC
LIMIT 50;

-- Test: Customer engagement query (should be < 1 second)
EXPLAIN QUERY PLAN
SELECT * FROM v_customer_engagement
WHERE company_id = 'test_company_id'
AND total_emails_received > 0
ORDER BY last_email_sent DESC
LIMIT 100;

-- Test: Daily analytics aggregation (should be < 3 seconds)
EXPLAIN QUERY PLAN
SELECT * FROM v_daily_analytics
WHERE company_id = 'test_company_id'
AND date >= DATE('now', '-30 days')
ORDER BY date DESC;

-- =====================================================
-- MIGRATION COMPLETE: UNIFIED PLATFORM READY
-- =====================================================

/*
🎉 UNIFIED PLATFORM INTEGRATION COMPLETE!

The database schema now supports:
✅ Invoice → Campaign → Email workflow
✅ Multi-provider OAuth integration (Gmail/Outlook)
✅ Advanced email tracking and analytics
✅ Automated campaign workflows
✅ A/B testing framework
✅ Email deliverability monitoring
✅ Comprehensive business intelligence
✅ Security audit trails
✅ Performance optimization
✅ Data migration from SendAChaser

Next Steps:
1. Update Prisma schema to reflect all changes
2. Generate new Prisma client
3. Implement service layer (UnifiedEmailService)
4. Create API endpoints (/api/campaigns/*)
5. Build frontend components for campaign management
6. Test with POP Trading's 400+ invoice workflow
7. Deploy to production with monitoring

Target Achievement: 2.5 hours → 10 minutes workflow transformation! 🚀
*/