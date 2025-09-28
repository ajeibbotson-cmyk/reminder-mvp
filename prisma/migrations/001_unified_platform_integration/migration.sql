-- Migration: Unified Platform Integration (Reminder + SendAChaser)
-- Purpose: Add email automation capabilities to Reminder platform
-- Phase: 1 of 3 (Core Tables)

-- =====================================================
-- 1. EMAIL PROVIDERS TABLE (OAuth Integration)
-- =====================================================

CREATE TABLE email_providers (
    id TEXT PRIMARY KEY DEFAULT ('ep_' || lower(hex(randomblob(12)))),
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Provider Configuration
    provider_type TEXT NOT NULL CHECK (provider_type IN ('gmail', 'outlook', 'smtp')),
    provider_email TEXT NOT NULL,
    provider_name TEXT,

    -- OAuth Token Management (encrypted at application level)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    scope TEXT,

    -- Connection Status
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    last_validated_at DATETIME,
    validation_error TEXT,

    -- Rate Limiting & Quotas
    daily_quota INTEGER DEFAULT 500,
    daily_sent_count INTEGER DEFAULT 0,
    quota_reset_date DATE DEFAULT (date('now')),

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id),

    -- Constraints
    UNIQUE(company_id, provider_email)
);

-- Indexes for email_providers
CREATE INDEX idx_email_providers_company ON email_providers(company_id, is_active);
CREATE INDEX idx_email_providers_primary ON email_providers(company_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_email_providers_quota ON email_providers(quota_reset_date, daily_sent_count);

-- =====================================================
-- 2. INVOICE CAMPAIGNS TABLE (Campaign Management)
-- =====================================================

CREATE TABLE invoice_campaigns (
    id TEXT PRIMARY KEY DEFAULT ('ic_' || lower(hex(randomblob(12)))),
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Campaign Configuration
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'invoice_reminder' CHECK (
        campaign_type IN ('invoice_reminder', 'payment_follow_up', 'overdue_notice', 'bulk_reminder')
    ),

    -- Invoice Association
    invoice_ids TEXT NOT NULL, -- JSON array of invoice IDs
    invoice_count INTEGER, -- Calculated from invoice_ids array
    total_amount DECIMAL(12, 2),
    currency TEXT DEFAULT 'AED',

    -- Template & Content
    template_id TEXT REFERENCES email_templates(id),
    subject_template TEXT,
    body_template TEXT,
    merge_tags TEXT DEFAULT '{}', -- JSON object

    -- Sending Configuration
    email_provider_id TEXT REFERENCES email_providers(id),
    sender_name TEXT,
    sender_email TEXT,
    reply_to_email TEXT,

    -- Scheduling
    scheduled_for DATETIME,
    send_immediately BOOLEAN DEFAULT FALSE,
    timezone TEXT DEFAULT 'Asia/Dubai',

    -- Progress Tracking
    status TEXT DEFAULT 'draft' CHECK (
        status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'failed', 'cancelled')
    ),
    total_recipients INTEGER DEFAULT 0,
    queued_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,

    -- Processing Metadata
    processing_started_at DATETIME,
    processing_completed_at DATETIME,
    last_activity_at DATETIME,
    error_message TEXT,
    processing_metadata TEXT DEFAULT '{}', -- JSON object

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id),

    -- Validation
    CHECK (invoice_count > 0 OR json_array_length(invoice_ids) > 0),
    CHECK (total_recipients >= 0),
    CHECK (sent_count <= total_recipients)
);

-- Indexes for invoice_campaigns
CREATE INDEX idx_invoice_campaigns_company ON invoice_campaigns(company_id, status, created_at);
CREATE INDEX idx_invoice_campaigns_status ON invoice_campaigns(status, processing_started_at);
CREATE INDEX idx_invoice_campaigns_provider ON invoice_campaigns(email_provider_id, status);
CREATE INDEX idx_invoice_campaigns_scheduled ON invoice_campaigns(scheduled_for, status) WHERE status = 'scheduled';

-- =====================================================
-- 3. CAMPAIGN EMAIL SENDS TABLE (Individual Email Tracking)
-- =====================================================

CREATE TABLE campaign_email_sends (
    id TEXT PRIMARY KEY DEFAULT ('ces_' || lower(hex(randomblob(12)))),
    campaign_id TEXT NOT NULL REFERENCES invoice_campaigns(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Recipient Information
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    customer_id TEXT REFERENCES customers(id),
    invoice_id TEXT REFERENCES invoices(id),

    -- Email Content (Personalized)
    personalized_subject TEXT NOT NULL,
    personalized_body TEXT NOT NULL,
    merge_data TEXT DEFAULT '{}', -- JSON object with merge tag values

    -- Sending Details
    email_provider_id TEXT REFERENCES email_providers(id),
    sender_email TEXT,
    sender_name TEXT,

    -- Delivery Status
    status TEXT DEFAULT 'queued' CHECK (
        status IN ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'suppressed')
    ),

    -- External IDs & Tracking
    provider_message_id TEXT,
    aws_message_id TEXT,
    tracking_pixel_id TEXT DEFAULT ('tp_' || lower(hex(randomblob(12)))),

    -- Timestamps
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    delivered_at DATETIME,
    opened_at DATETIME,
    clicked_at DATETIME,
    bounced_at DATETIME,
    failed_at DATETIME,

    -- Error Handling
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    bounce_reason TEXT,
    bounce_type TEXT,

    -- Engagement Tracking
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    last_opened_at DATETIME,
    last_clicked_at DATETIME,
    user_agent TEXT,
    ip_address TEXT,

    -- Suppression
    is_suppressed BOOLEAN DEFAULT FALSE,
    suppression_reason TEXT,
    suppressed_at DATETIME,

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Validation
    CHECK (attempt_count <= max_attempts),
    CHECK (open_count >= 0),
    CHECK (click_count >= 0)
);

-- Indexes for campaign_email_sends
CREATE INDEX idx_campaign_sends_campaign ON campaign_email_sends(campaign_id, status);
CREATE INDEX idx_campaign_sends_recipient ON campaign_email_sends(recipient_email, company_id);
CREATE INDEX idx_campaign_sends_status ON campaign_email_sends(status, queued_at);
CREATE INDEX idx_campaign_sends_customer ON campaign_email_sends(customer_id, sent_at);
CREATE INDEX idx_campaign_sends_invoice ON campaign_email_sends(invoice_id, status);
CREATE INDEX idx_campaign_sends_tracking ON campaign_email_sends(tracking_pixel_id);
CREATE INDEX idx_campaign_sends_provider_msg ON campaign_email_sends(provider_message_id);

-- Composite indexes for analytics
CREATE INDEX idx_campaign_sends_engagement ON campaign_email_sends(campaign_id, opened_at, clicked_at);
CREATE INDEX idx_campaign_sends_timeline ON campaign_email_sends(company_id, sent_at, status);

-- =====================================================
-- 4. EMAIL EVENT TRACKING TABLE (Webhooks & Analytics)
-- =====================================================

CREATE TABLE email_event_tracking (
    id TEXT PRIMARY KEY DEFAULT ('eet_' || lower(hex(randomblob(12)))),
    campaign_send_id TEXT NOT NULL REFERENCES campaign_email_sends(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES invoice_campaigns(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Event Details
    event_type TEXT NOT NULL CHECK (
        event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed')
    ),
    event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Event Source
    source TEXT DEFAULT 'webhook' CHECK (source IN ('webhook', 'pixel', 'manual', 'api')),
    provider_event_id TEXT,

    -- Event Data
    event_data TEXT DEFAULT '{}', -- JSON object with raw event data
    user_agent TEXT,
    ip_address TEXT,
    device_type TEXT,
    email_client TEXT,

    -- Link Tracking (for click events)
    clicked_url TEXT,
    link_position INTEGER,

    -- Geographic Data
    country_code TEXT,
    city TEXT,
    timezone TEXT,

    -- Processing Status
    processed BOOLEAN DEFAULT FALSE,
    processed_at DATETIME,

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_event_tracking
CREATE INDEX idx_email_events_send ON email_event_tracking(campaign_send_id, event_type, event_timestamp);
CREATE INDEX idx_email_events_campaign ON email_event_tracking(campaign_id, event_type, event_timestamp);
CREATE INDEX idx_email_events_company ON email_event_tracking(company_id, event_timestamp);
CREATE INDEX idx_email_events_type ON email_event_tracking(event_type, event_timestamp);
CREATE INDEX idx_email_events_processing ON email_event_tracking(processed, created_at) WHERE processed = FALSE;

-- Analytics indexes
CREATE INDEX idx_email_events_analytics ON email_event_tracking(campaign_id, event_type, device_type, email_client);

-- =====================================================
-- 5. ENHANCE EXISTING CUSTOMERS TABLE
-- =====================================================

-- Add SendAChaser contact capabilities to existing customers table
ALTER TABLE customers ADD COLUMN custom_fields TEXT DEFAULT '{}'; -- JSON object
ALTER TABLE customers ADD COLUMN tags TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE customers ADD COLUMN source TEXT DEFAULT 'invoice' CHECK (source IN ('invoice', 'import', 'manual', 'api'));
ALTER TABLE customers ADD COLUMN email_marketing_consent BOOLEAN DEFAULT TRUE;
ALTER TABLE customers ADD COLUMN last_email_sent_at DATETIME;
ALTER TABLE customers ADD COLUMN email_bounce_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN is_email_suppressed BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN email_suppression_reason TEXT;

-- Add indexes for enhanced customers table
CREATE INDEX idx_customers_email_marketing ON customers(company_id, email_marketing_consent, is_email_suppressed);
CREATE INDEX idx_customers_bounce_tracking ON customers(email_bounce_count, is_email_suppressed);
CREATE INDEX idx_customers_source ON customers(company_id, source);

-- =====================================================
-- 6. ENHANCE EXISTING EMAIL_TEMPLATES TABLE
-- =====================================================

-- Add campaign capabilities to existing email_templates
ALTER TABLE email_templates ADD COLUMN supports_bulk_campaigns BOOLEAN DEFAULT FALSE;
ALTER TABLE email_templates ADD COLUMN max_invoice_count INTEGER DEFAULT 1;
ALTER TABLE email_templates ADD COLUMN available_merge_tags TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE email_templates ADD COLUMN category TEXT DEFAULT 'FOLLOW_UP';
ALTER TABLE email_templates ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE email_templates ADD COLUMN last_used_at DATETIME;

-- Add indexes for enhanced email_templates
CREATE INDEX idx_email_templates_bulk ON email_templates(company_id, supports_bulk_campaigns, is_active);
CREATE INDEX idx_email_templates_category ON email_templates(company_id, category, is_active);
CREATE INDEX idx_email_templates_usage ON email_templates(usage_count, last_used_at);

-- =====================================================
-- 7. ENHANCE EXISTING EMAIL_LOGS TABLE
-- =====================================================

-- Link existing email logs to new campaign system
ALTER TABLE email_logs ADD COLUMN campaign_id TEXT REFERENCES invoice_campaigns(id);
ALTER TABLE email_logs ADD COLUMN campaign_send_id TEXT REFERENCES campaign_email_sends(id);
ALTER TABLE email_logs ADD COLUMN merge_data TEXT DEFAULT '{}'; -- JSON object
ALTER TABLE email_logs ADD COLUMN tracking_pixel_id TEXT;
ALTER TABLE email_logs ADD COLUMN provider_message_id TEXT;

-- Add indexes for campaign linking
CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id, sent_at);
CREATE INDEX idx_email_logs_campaign_send ON email_logs(campaign_send_id);
CREATE INDEX idx_email_logs_tracking ON email_logs(tracking_pixel_id);

-- =====================================================
-- 8. CREATE UNIFIED WORKFLOW VIEWS
-- =====================================================

-- View: Active Campaigns with Statistics
CREATE VIEW v_active_campaigns AS
SELECT
    ic.*,
    COUNT(ces.id) as total_sends,
    COUNT(CASE WHEN ces.status = 'sent' THEN 1 END) as actual_sent,
    COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) as total_opens,
    COUNT(CASE WHEN ces.clicked_at IS NOT NULL THEN 1 END) as total_clicks,
    ROUND(
        (COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) * 100.0) /
        NULLIF(COUNT(CASE WHEN ces.status = 'sent' THEN 1 END), 0), 2
    ) as open_rate_percentage,
    ROUND(
        (COUNT(CASE WHEN ces.clicked_at IS NOT NULL THEN 1 END) * 100.0) /
        NULLIF(COUNT(CASE WHEN ces.status = 'sent' THEN 1 END), 0), 2
    ) as click_rate_percentage
FROM invoice_campaigns ic
LEFT JOIN campaign_email_sends ces ON ic.id = ces.campaign_id
WHERE ic.status IN ('scheduled', 'sending', 'completed')
GROUP BY ic.id;

-- View: Campaign Performance Summary
CREATE VIEW v_campaign_performance AS
SELECT
    ic.company_id,
    ic.id as campaign_id,
    ic.name as campaign_name,
    ic.campaign_type,
    ic.status,
    ic.total_recipients,
    ic.sent_count,
    ic.opened_count,
    ic.clicked_count,
    ic.failed_count,
    ic.created_at,
    ic.processing_started_at,
    ic.processing_completed_at,
    -- Calculate actual metrics from individual sends
    COUNT(ces.id) as actual_total_sends,
    COUNT(CASE WHEN ces.status = 'delivered' THEN 1 END) as actual_delivered,
    COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) as actual_opens,
    COUNT(CASE WHEN ces.clicked_at IS NOT NULL THEN 1 END) as actual_clicks,
    COUNT(CASE WHEN ces.bounced_at IS NOT NULL THEN 1 END) as actual_bounces,
    -- Performance metrics
    ROUND(
        (COUNT(CASE WHEN ces.status = 'delivered' THEN 1 END) * 100.0) /
        NULLIF(COUNT(ces.id), 0), 2
    ) as delivery_rate,
    ROUND(
        (COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END) * 100.0) /
        NULLIF(COUNT(CASE WHEN ces.status = 'delivered' THEN 1 END), 0), 2
    ) as open_rate,
    ROUND(
        (COUNT(CASE WHEN ces.clicked_at IS NOT NULL THEN 1 END) * 100.0) /
        NULLIF(COUNT(CASE WHEN ces.opened_at IS NOT NULL THEN 1 END), 0), 2
    ) as click_rate
FROM invoice_campaigns ic
LEFT JOIN campaign_email_sends ces ON ic.id = ces.campaign_id
GROUP BY ic.id;

-- =====================================================
-- 9. INITIALIZE DEFAULT DATA
-- =====================================================

-- Insert default campaign templates for invoice reminders
-- Note: This will be handled in application code to ensure proper company_id assignment

-- =====================================================
-- 10. UPDATE TRIGGERS FOR AUTOMATIC FIELD UPDATES
-- =====================================================

-- Trigger to update updated_at timestamp on email_providers
CREATE TRIGGER trigger_email_providers_updated_at
    AFTER UPDATE ON email_providers
BEGIN
    UPDATE email_providers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update updated_at timestamp on invoice_campaigns
CREATE TRIGGER trigger_invoice_campaigns_updated_at
    AFTER UPDATE ON invoice_campaigns
BEGIN
    UPDATE invoice_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    UPDATE invoice_campaigns SET last_activity_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update updated_at timestamp on campaign_email_sends
CREATE TRIGGER trigger_campaign_email_sends_updated_at
    AFTER UPDATE ON campaign_email_sends
BEGIN
    UPDATE campaign_email_sends SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update campaign statistics when email send status changes
CREATE TRIGGER trigger_update_campaign_stats
    AFTER UPDATE ON campaign_email_sends
    WHEN OLD.status != NEW.status
BEGIN
    UPDATE invoice_campaigns SET
        sent_count = (
            SELECT COUNT(*) FROM campaign_email_sends
            WHERE campaign_id = NEW.campaign_id AND status IN ('sent', 'delivered', 'opened', 'clicked')
        ),
        delivered_count = (
            SELECT COUNT(*) FROM campaign_email_sends
            WHERE campaign_id = NEW.campaign_id AND status IN ('delivered', 'opened', 'clicked')
        ),
        opened_count = (
            SELECT COUNT(*) FROM campaign_email_sends
            WHERE campaign_id = NEW.campaign_id AND opened_at IS NOT NULL
        ),
        clicked_count = (
            SELECT COUNT(*) FROM campaign_email_sends
            WHERE campaign_id = NEW.campaign_id AND clicked_at IS NOT NULL
        ),
        failed_count = (
            SELECT COUNT(*) FROM campaign_email_sends
            WHERE campaign_id = NEW.campaign_id AND status = 'failed'
        ),
        bounced_count = (
            SELECT COUNT(*) FROM campaign_email_sends
            WHERE campaign_id = NEW.campaign_id AND status = 'bounced'
        ),
        updated_at = CURRENT_TIMESTAMP,
        last_activity_at = CURRENT_TIMESTAMP
    WHERE id = NEW.campaign_id;
END;

-- =====================================================
-- 11. MIGRATION VALIDATION
-- =====================================================

-- Verify table creation
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%campaign%' OR name LIKE '%email_provider%';

-- Verify indexes
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%campaign%' OR name LIKE '%email_provider%';

-- Verify triggers
SELECT name FROM sqlite_master WHERE type='trigger' AND (name LIKE '%campaign%' OR name LIKE '%email_provider%');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- This migration adds core email automation capabilities to Reminder platform
-- Next steps:
-- 1. Update Prisma schema to reflect these changes
-- 2. Generate new Prisma client
-- 3. Implement service layer integration
-- 4. Test invoice → campaign workflow