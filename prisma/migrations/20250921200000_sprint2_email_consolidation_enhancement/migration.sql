-- Sprint 2: Email Consolidation Enhancement Migration
-- Adds missing fields and indexes for comprehensive consolidation support

BEGIN;

-- Add missing consolidation fields to email_logs if they don't exist
DO $$
BEGIN
    -- Add consolidation_batch_id for grouping related consolidation emails
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'consolidation_batch_id') THEN
        ALTER TABLE email_logs ADD COLUMN consolidation_batch_id VARCHAR(36);
    END IF;

    -- Add cultural_compliance_score for tracking cultural sensitivity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'cultural_compliance_score') THEN
        ALTER TABLE email_logs ADD COLUMN cultural_compliance_score INTEGER DEFAULT 0;
    END IF;

    -- Add cultural_compliance_flags as JSONB for detailed compliance tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'cultural_compliance_flags') THEN
        ALTER TABLE email_logs ADD COLUMN cultural_compliance_flags JSONB DEFAULT '{}';
    END IF;

    -- Add scheduling_adjustments for tracking time adjustments made for cultural compliance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'scheduling_adjustments') THEN
        ALTER TABLE email_logs ADD COLUMN scheduling_adjustments JSONB DEFAULT '{}';
    END IF;

    -- Add pdf_attachment_count for tracking attachment metrics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'pdf_attachment_count') THEN
        ALTER TABLE email_logs ADD COLUMN pdf_attachment_count INTEGER DEFAULT 0;
    END IF;

    -- Add pdf_attachment_size for tracking attachment sizes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'pdf_attachment_size') THEN
        ALTER TABLE email_logs ADD COLUMN pdf_attachment_size BIGINT DEFAULT 0;
    END IF;

    -- Add original_scheduled_time to track scheduling changes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'original_scheduled_time') THEN
        ALTER TABLE email_logs ADD COLUMN original_scheduled_time TIMESTAMP;
    END IF;

    -- Add business_rules_applied for tracking which business rules were applied
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'business_rules_applied') THEN
        ALTER TABLE email_logs ADD COLUMN business_rules_applied JSONB DEFAULT '[]';
    END IF;

    -- Add template_variables_used for tracking template personalization
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'template_variables_used') THEN
        ALTER TABLE email_logs ADD COLUMN template_variables_used JSONB DEFAULT '{}';
    END IF;

    -- Add escalation_level for tracking email escalation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_logs' AND column_name = 'escalation_level') THEN
        ALTER TABLE email_logs ADD COLUMN escalation_level VARCHAR(20) DEFAULT 'POLITE';
    END IF;
END $$;

-- Add missing consolidation fields to customer_consolidated_reminders if they don't exist
DO $$
BEGIN
    -- Add actual_send_time to track when email was actually sent vs scheduled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_consolidated_reminders' AND column_name = 'actual_send_time') THEN
        ALTER TABLE customer_consolidated_reminders ADD COLUMN actual_send_time TIMESTAMP;
    END IF;

    -- Add pdf_attachments_generated for tracking PDF generation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_consolidated_reminders' AND column_name = 'pdf_attachments_generated') THEN
        ALTER TABLE customer_consolidated_reminders ADD COLUMN pdf_attachments_generated JSONB DEFAULT '[]';
    END IF;

    -- Add cultural_adjustments_made for tracking cultural compliance adjustments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_consolidated_reminders' AND column_name = 'cultural_adjustments_made') THEN
        ALTER TABLE customer_consolidated_reminders ADD COLUMN cultural_adjustments_made JSONB DEFAULT '{}';
    END IF;

    -- Add effectiveness_metrics for tracking consolidation effectiveness
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_consolidated_reminders' AND column_name = 'effectiveness_metrics') THEN
        ALTER TABLE customer_consolidated_reminders ADD COLUMN effectiveness_metrics JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add missing fields to email_templates for enhanced consolidation support
DO $$
BEGIN
    -- Add consolidation_template_variables for specific consolidation variables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'consolidation_template_variables') THEN
        ALTER TABLE email_templates ADD COLUMN consolidation_template_variables JSONB DEFAULT '{}';
    END IF;

    -- Add cultural_compliance_level for template cultural sensitivity rating
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'cultural_compliance_level') THEN
        ALTER TABLE email_templates ADD COLUMN cultural_compliance_level INTEGER DEFAULT 0;
    END IF;

    -- Add performance_metrics for template effectiveness tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'performance_metrics') THEN
        ALTER TABLE email_templates ADD COLUMN performance_metrics JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create new indexes for improved consolidation query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_consolidation_batch
ON email_logs (consolidation_batch_id) WHERE consolidation_batch_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_cultural_compliance
ON email_logs (cultural_compliance_score) WHERE cultural_compliance_score > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_consolidation_metrics
ON email_logs (company_id, consolidation_savings, invoice_count)
WHERE consolidated_reminder_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_escalation_tracking
ON email_logs (company_id, escalation_level, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_attachment_metrics
ON email_logs (pdf_attachment_count, pdf_attachment_size)
WHERE pdf_attachment_count > 0;

-- Composite index for consolidation analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_consolidation_analytics
ON email_logs (company_id, consolidated_reminder_id, delivery_status, sent_at, opened_at, clicked_at)
WHERE consolidated_reminder_id IS NOT NULL;

-- Index for customer consolidation reminder performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consolidated_reminders_performance
ON customer_consolidated_reminders (company_id, delivery_status, priority_score, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consolidated_reminders_effectiveness
ON customer_consolidated_reminders (customer_id, sent_at, escalation_level);

-- Index for template consolidation features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_templates_consolidation_features
ON email_templates (supports_consolidation, max_invoice_count, is_active)
WHERE supports_consolidation = true;

-- Add constraints for data integrity
DO $$
BEGIN
    -- Ensure cultural compliance score is within valid range
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_cultural_compliance_score_range') THEN
        ALTER TABLE email_logs ADD CONSTRAINT check_cultural_compliance_score_range
        CHECK (cultural_compliance_score >= 0 AND cultural_compliance_score <= 100);
    END IF;

    -- Ensure escalation level is valid
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_escalation_level_valid') THEN
        ALTER TABLE email_logs ADD CONSTRAINT check_escalation_level_valid
        CHECK (escalation_level IN ('POLITE', 'FIRM', 'URGENT', 'FINAL'));
    END IF;

    -- Ensure PDF attachment count is non-negative
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_pdf_attachment_count_positive') THEN
        ALTER TABLE email_logs ADD CONSTRAINT check_pdf_attachment_count_positive
        CHECK (pdf_attachment_count >= 0);
    END IF;

    -- Ensure PDF attachment size is non-negative
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_pdf_attachment_size_positive') THEN
        ALTER TABLE email_logs ADD CONSTRAINT check_pdf_attachment_size_positive
        CHECK (pdf_attachment_size >= 0);
    END IF;
END $$;

-- Create function for updating consolidation effectiveness metrics
CREATE OR REPLACE FUNCTION update_consolidation_effectiveness_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update effectiveness metrics when email status changes
    IF NEW.consolidated_reminder_id IS NOT NULL AND
       (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status OR
        OLD.opened_at IS DISTINCT FROM NEW.opened_at OR
        OLD.clicked_at IS DISTINCT FROM NEW.clicked_at) THEN

        -- Update the consolidated reminder record with latest metrics
        UPDATE customer_consolidated_reminders
        SET effectiveness_metrics = jsonb_build_object(
            'last_status_update', NOW(),
            'delivery_status', NEW.delivery_status,
            'was_opened', NEW.opened_at IS NOT NULL,
            'was_clicked', NEW.clicked_at IS NOT NULL,
            'delivery_time_seconds', CASE
                WHEN NEW.delivered_at IS NOT NULL AND NEW.sent_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.sent_at))
                ELSE NULL
            END
        ),
        updated_at = NOW()
        WHERE id = NEW.consolidated_reminder_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic effectiveness metrics updates
DROP TRIGGER IF EXISTS trigger_update_consolidation_effectiveness ON email_logs;
CREATE TRIGGER trigger_update_consolidation_effectiveness
    AFTER UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_consolidation_effectiveness_metrics();

-- Create function for calculating consolidation savings
CREATE OR REPLACE FUNCTION calculate_consolidation_savings()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically calculate consolidation savings when invoice count is set
    IF NEW.invoice_count IS NOT NULL AND NEW.invoice_count > 1 THEN
        NEW.consolidation_savings = ((NEW.invoice_count - 1)::DECIMAL / NEW.invoice_count::DECIMAL) * 100;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic consolidation savings calculation
DROP TRIGGER IF EXISTS trigger_calculate_consolidation_savings ON email_logs;
CREATE TRIGGER trigger_calculate_consolidation_savings
    BEFORE INSERT OR UPDATE ON email_logs
    FOR EACH ROW
    WHEN (NEW.consolidated_reminder_id IS NOT NULL)
    EXECUTE FUNCTION calculate_consolidation_savings();

-- Update existing records to set default values for new fields
UPDATE email_logs
SET
    cultural_compliance_score = 75,
    cultural_compliance_flags = '{"basic_compliance": true}',
    business_rules_applied = '["UAE_BUSINESS_HOURS"]',
    escalation_level = CASE
        WHEN content_html ILIKE '%urgent%' THEN 'URGENT'
        WHEN content_html ILIKE '%final%' THEN 'FINAL'
        WHEN content_html ILIKE '%reminder%' THEN 'POLITE'
        ELSE 'POLITE'
    END
WHERE consolidated_reminder_id IS NOT NULL
  AND cultural_compliance_score = 0;

-- Update email templates with default consolidation support
UPDATE email_templates
SET
    cultural_compliance_level = 80,
    consolidation_template_variables = CASE
        WHEN supports_consolidation = true THEN
            '{"invoiceList": "array", "totalAmount": "currency", "invoiceCount": "number", "oldestInvoiceDays": "number"}'
        ELSE '{}'
    END,
    performance_metrics = '{}'
WHERE supports_consolidation = true
  AND cultural_compliance_level = 0;

-- Create view for consolidation analytics
CREATE OR REPLACE VIEW consolidation_analytics_view AS
SELECT
    el.company_id,
    el.consolidation_batch_id,
    el.consolidated_reminder_id,
    el.template_id,
    el.customer_id,
    el.invoice_count,
    el.consolidation_savings,
    el.cultural_compliance_score,
    el.escalation_level,
    el.delivery_status,
    el.sent_at,
    el.delivered_at,
    el.opened_at,
    el.clicked_at,
    el.pdf_attachment_count,
    el.pdf_attachment_size,
    cr.total_amount,
    cr.currency,
    cr.priority_score,
    c.name as customer_name,
    c.business_type,
    et.name as template_name,
    et.template_type,
    CASE
        WHEN el.delivered_at IS NOT NULL THEN 'delivered'
        WHEN el.sent_at IS NOT NULL THEN 'sent'
        ELSE 'scheduled'
    END as status_category,
    CASE
        WHEN el.clicked_at IS NOT NULL THEN 'clicked'
        WHEN el.opened_at IS NOT NULL THEN 'opened'
        WHEN el.delivered_at IS NOT NULL THEN 'delivered'
        ELSE 'no_engagement'
    END as engagement_level,
    el.created_at
FROM email_logs el
LEFT JOIN customer_consolidated_reminders cr ON el.consolidated_reminder_id = cr.id
LEFT JOIN customers c ON el.customer_id = c.id
LEFT JOIN email_templates et ON el.template_id = et.id
WHERE el.consolidated_reminder_id IS NOT NULL;

-- Grant permissions on the view
GRANT SELECT ON consolidation_analytics_view TO PUBLIC;

-- Add comments for documentation
COMMENT ON COLUMN email_logs.consolidation_batch_id IS 'Groups related consolidation emails sent together';
COMMENT ON COLUMN email_logs.cultural_compliance_score IS 'Score (0-100) indicating cultural sensitivity compliance';
COMMENT ON COLUMN email_logs.cultural_compliance_flags IS 'JSON object containing specific cultural compliance flags';
COMMENT ON COLUMN email_logs.scheduling_adjustments IS 'JSON object tracking any time adjustments made for cultural compliance';
COMMENT ON COLUMN email_logs.pdf_attachment_count IS 'Number of PDF attachments included with the email';
COMMENT ON COLUMN email_logs.pdf_attachment_size IS 'Total size in bytes of all PDF attachments';
COMMENT ON COLUMN email_logs.business_rules_applied IS 'JSON array of business rules applied during email creation';
COMMENT ON COLUMN email_logs.escalation_level IS 'Level of urgency/escalation for the email';

COMMENT ON VIEW consolidation_analytics_view IS 'Comprehensive view for consolidation email analytics and reporting';

-- Create function to cleanup old consolidation data
CREATE OR REPLACE FUNCTION cleanup_old_consolidation_data(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old consolidation records older than retention period
    DELETE FROM customer_consolidated_reminders
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
      AND delivery_status IN ('DELIVERED', 'FAILED')
      AND sent_at IS NOT NULL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Log the cleanup
    INSERT INTO activities (id, company_id, user_id, type, description, metadata, created_at)
    SELECT
        gen_random_uuid(),
        'system',
        'system',
        'consolidation_cleanup',
        'Cleaned up old consolidation data',
        jsonb_build_object('deleted_count', deleted_count, 'retention_days', retention_days),
        NOW()
    WHERE deleted_count > 0;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create index for cleanup function performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consolidated_reminders_cleanup
ON customer_consolidated_reminders (created_at, delivery_status, sent_at)
WHERE delivery_status IN ('DELIVERED', 'FAILED');

COMMIT;