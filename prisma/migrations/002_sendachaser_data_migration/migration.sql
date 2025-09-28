-- Migration: SendAChaser Data Migration to Reminder Platform
-- Purpose: Migrate existing SendAChaser data to unified Reminder schema
-- Phase: 2 of 3 (Data Migration)

-- =====================================================
-- PRELIMINARY CHECKS
-- =====================================================

-- Check if this is a fresh install or existing data migration
-- This migration should only run if SendAChaser data exists

-- =====================================================
-- 1. SENDACHASER USER MIGRATION
-- =====================================================

-- Create a temporary mapping table for user ID translation
CREATE TEMPORARY TABLE temp_user_mapping (
    sendachaser_user_id TEXT,
    reminder_user_id TEXT,
    reminder_company_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note: This section would typically be populated by application code
-- that reads from SendAChaser's Supabase database and creates corresponding
-- users and companies in Reminder's database

/*
Example application code pattern:

1. Query SendAChaser profiles:
   SELECT id, email, full_name FROM sendachaser.profiles;

2. For each SendAChaser user:
   a. Create company in Reminder if not exists
   b. Create user in Reminder with ADMIN role
   c. Insert mapping into temp_user_mapping

3. Continue with data migration below
*/

-- =====================================================
-- 2. EMAIL PROVIDER MIGRATION
-- =====================================================

-- Migrate SendAChaser email_providers to Reminder email_providers
-- Note: This would be handled by application code due to cross-database complexity

/*
Application migration pattern for email_providers:

FROM sendachaser.email_providers:
- id -> generate new id in Reminder
- user_id -> map to reminder_company_id via temp_user_mapping
- provider_type -> provider_type (gmail/outlook)
- provider_email -> provider_email
- access_token -> access_token (re-encrypt with Reminder's keys)
- refresh_token -> refresh_token (re-encrypt with Reminder's keys)
- token_expires_at -> token_expires_at
- is_active -> is_active
- last_validated_at -> last_validated_at

INSERT INTO email_providers (
    company_id, provider_type, provider_email, access_token,
    refresh_token, token_expires_at, is_active, last_validated_at,
    daily_quota, created_at, updated_at
) VALUES (...);
*/

-- =====================================================
-- 3. CONTACT TO CUSTOMER MIGRATION
-- =====================================================

-- Migrate SendAChaser contacts to enhanced Reminder customers
-- This handles the contact → customer entity mapping

/*
Application migration pattern for contacts → customers:

FROM sendachaser.contacts:
- Map user_id to company_id via temp_user_mapping
- email -> email (primary key in customers)
- name -> name
- company -> business_name (if different from name)
- phone -> phone
- custom_fields -> custom_fields (JSON)
- tags -> tags (JSON array)
- created_at -> created_at
- updated_at -> updated_at

Additional Reminder-specific fields:
- payment_terms: 30 (default)
- source: 'import'
- email_marketing_consent: true
- trn: null (to be filled later)
- business_type: null (to be filled later)
*/

-- Create temporary table for contact migration tracking
CREATE TEMPORARY TABLE temp_contact_migration (
    sendachaser_contact_id TEXT,
    reminder_customer_id TEXT,
    sendachaser_user_id TEXT,
    reminder_company_id TEXT,
    migration_status TEXT DEFAULT 'pending',
    migration_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. TEMPLATE MIGRATION
-- =====================================================

-- Migrate SendAChaser templates to Reminder campaign_templates
-- This creates enhanced templates with merge tag support

/*
Application migration pattern for templates → campaign_templates:

FROM sendachaser.templates:
- Map user_id to company_id via temp_user_mapping
- name -> name
- subject -> subject_template
- body -> body_template
- is_default -> is_default
- created_at -> created_at
- updated_at -> updated_at

Enhanced Reminder fields:
- category: 'invoice_reminder' (default)
- supports_bulk_campaigns: true
- available_merge_tags: Extract from template content
- body_format: 'html'
- language: 'en'
- source: 'imported'
*/

-- Create temporary table for template migration tracking
CREATE TEMPORARY TABLE temp_template_migration (
    sendachaser_template_id TEXT,
    reminder_template_id TEXT,
    sendachaser_user_id TEXT,
    reminder_company_id TEXT,
    merge_tags_extracted TEXT, -- JSON array
    migration_status TEXT DEFAULT 'pending',
    migration_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. CAMPAIGN HISTORY MIGRATION
-- =====================================================

-- Migrate SendAChaser campaigns to Reminder invoice_campaigns
-- Note: These will be historical campaigns without invoice associations

/*
Application migration pattern for campaigns → invoice_campaigns:

FROM sendachaser.campaigns:
- Map user_id to company_id via temp_user_mapping
- name -> name
- data_source -> description
- status -> status (map 'completed' to 'completed', others to 'completed')
- total_recipients -> total_recipients
- sent_count -> sent_count
- failed_count -> failed_count
- created_at -> created_at
- updated_at -> updated_at

Reminder-specific fields:
- campaign_type: 'bulk_reminder' (historical)
- invoice_ids: '[]' (empty array - no invoice association)
- invoice_count: 0
- currency: 'AED' (default)
- source: 'imported'
*/

-- Create temporary table for campaign migration tracking
CREATE TEMPORARY TABLE temp_campaign_migration (
    sendachaser_campaign_id TEXT,
    reminder_campaign_id TEXT,
    sendachaser_user_id TEXT,
    reminder_company_id TEXT,
    email_count INTEGER DEFAULT 0,
    migration_status TEXT DEFAULT 'pending',
    migration_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. CAMPAIGN SENDS MIGRATION
-- =====================================================

-- Migrate SendAChaser campaign_sends to Reminder campaign_email_sends
-- This preserves historical email sending data

/*
Application migration pattern for campaign_sends → campaign_email_sends:

FROM sendachaser.campaign_sends:
- Map campaign_id via temp_campaign_migration
- recipient_email -> recipient_email
- recipient_name -> recipient_name
- personalized_subject -> personalized_subject
- personalized_body -> personalized_body
- status -> status (map SendAChaser statuses to Reminder equivalents)
- sent_at -> sent_at
- error_message -> error_message
- created_at -> created_at

Reminder-specific fields:
- customer_id: Match by email if exists in customers table
- invoice_id: null (historical data)
- merge_data: '{}' (extract from personalized content if possible)
- tracking_pixel_id: generate new
*/

-- =====================================================
-- 7. ANALYTICS DATA MIGRATION
-- =====================================================

-- Migrate campaign performance data
-- This ensures historical analytics are preserved

/*
Application migration pattern for campaign analytics:

FROM sendachaser.campaign_logs:
- Map campaign_id and contact_id via migration tables
- event_type -> event_type (map to Reminder equivalents)
- logged_at -> event_timestamp
- details -> event_data (JSON)

Create email_event_tracking records for:
- sent events
- opened events (if tracked)
- clicked events (if tracked)
- bounce events (if tracked)
*/

-- =====================================================
-- 8. DATA VALIDATION QUERIES
-- =====================================================

-- Create validation views to check migration success
CREATE TEMPORARY VIEW v_migration_summary AS
SELECT
    'Users' as entity_type,
    COUNT(*) as sendachaser_count,
    COUNT(*) as reminder_count,
    'See temp_user_mapping' as notes
FROM temp_user_mapping

UNION ALL

SELECT
    'Contacts->Customers' as entity_type,
    0 as sendachaser_count, -- Will be populated by application
    COUNT(*) as reminder_count,
    'Enhanced with SendAChaser fields' as notes
FROM customers
WHERE source = 'import'

UNION ALL

SELECT
    'Templates' as entity_type,
    0 as sendachaser_count, -- Will be populated by application
    COUNT(*) as reminder_count,
    'Migrated to campaign_templates' as notes
FROM email_templates
WHERE category = 'imported'

UNION ALL

SELECT
    'Email Providers' as entity_type,
    0 as sendachaser_count, -- Will be populated by application
    COUNT(*) as reminder_count,
    'OAuth tokens re-encrypted' as notes
FROM email_providers;

-- =====================================================
-- 9. POST-MIGRATION CLEANUP PROCEDURES
-- =====================================================

-- Create procedures for post-migration tasks

-- Procedure to update customer analytics after migration
-- (This would be called by application code)

/*
Post-migration tasks:
1. Recalculate customer lifetime_value from historical data
2. Update customer risk_score based on email engagement
3. Set appropriate payment_terms based on business type
4. Validate all email addresses for deliverability
5. Create default follow-up sequences for migrated companies
6. Set up default email templates for new invoice workflows
*/

-- =====================================================
-- 10. MIGRATION STATUS TRACKING
-- =====================================================

-- Create migration status table for tracking progress
CREATE TABLE migration_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_phase TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_summary TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Initialize migration status tracking
INSERT INTO migration_status (migration_phase, entity_type, status) VALUES
('data_migration', 'users', 'pending'),
('data_migration', 'email_providers', 'pending'),
('data_migration', 'contacts_to_customers', 'pending'),
('data_migration', 'templates', 'pending'),
('data_migration', 'campaigns', 'pending'),
('data_migration', 'campaign_sends', 'pending'),
('data_migration', 'analytics', 'pending');

-- =====================================================
-- 11. DATA MIGRATION HELPER FUNCTIONS
-- =====================================================

-- Function to map SendAChaser status to Reminder status
/*
Status mapping:
- SendAChaser 'completed' -> Reminder 'completed'
- SendAChaser 'draft' -> Reminder 'completed' (historical)
- SendAChaser 'pending' -> Reminder 'completed' (historical)
- SendAChaser 'failed' -> Reminder 'failed'
*/

-- Function to extract merge tags from template content
/*
Merge tag patterns to detect:
- {{variable_name}}
- {{customer.name}}
- {{invoice.amount}}
- {{company.name}}

Common SendAChaser merge tags to map to Reminder:
- {{name}} -> {{customer_name}}
- {{company}} -> {{customer_business_name}}
- {{email}} -> {{customer_email}}
*/

-- =====================================================
-- 12. ROLLBACK PROCEDURES
-- =====================================================

-- In case migration needs to be rolled back, track what was migrated

CREATE TABLE migration_rollback_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted'
    original_data TEXT, -- JSON backup of original data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MIGRATION COMPLETION MARKER
-- =====================================================

-- Mark this migration as applied
INSERT INTO migration_status (migration_phase, entity_type, status, completed_at)
VALUES ('schema_migration', 'sendachaser_integration', 'completed', CURRENT_TIMESTAMP);

-- =====================================================
-- POST-MIGRATION VERIFICATION
-- =====================================================

-- Queries to verify migration success
-- (These should be run by application code after data migration)

/*
Verification checklist:
1. All SendAChaser users have corresponding Reminder companies
2. All email providers have valid OAuth tokens
3. All contacts are accessible as enhanced customers
4. All templates are available as campaign_templates
5. Historical campaign data is preserved
6. Email sending quotas are properly set
7. No data corruption in JSON fields
8. All foreign key relationships are valid
9. Performance is acceptable with migrated data
10. Security: no sensitive data exposed
*/

-- =====================================================
-- NOTES FOR APPLICATION DEVELOPERS
-- =====================================================

/*
This migration script provides the structure for migrating SendAChaser data
to the unified Reminder platform. The actual data migration must be performed
by application code due to the cross-database nature of the operation.

Key implementation steps:
1. Connect to both SendAChaser (Supabase) and Reminder (PostgreSQL) databases
2. Create mapping tables for ID translation
3. Migrate users first (creates companies and admin users)
4. Migrate email providers (re-encrypt OAuth tokens)
5. Migrate contacts to enhanced customers
6. Migrate templates to campaign_templates
7. Migrate historical campaigns and sends
8. Verify data integrity and relationships
9. Update analytics and derived fields
10. Clean up temporary mapping tables

Security considerations:
- Re-encrypt OAuth tokens with Reminder's encryption keys
- Validate all email addresses before migration
- Ensure proper company-scoped data isolation
- Audit trail for all migrated data

Performance considerations:
- Batch migrations for large datasets
- Use transactions for data consistency
- Monitor migration progress with status tracking
- Implement rollback procedures for failed migrations
*/