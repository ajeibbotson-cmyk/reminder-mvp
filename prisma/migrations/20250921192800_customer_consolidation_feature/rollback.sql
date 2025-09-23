-- Customer Consolidation Feature Rollback Migration
-- This migration rolls back all changes made by the customer consolidation feature
-- Use this to cleanly remove the consolidation functionality if needed

BEGIN;

-- Drop indexes first (in reverse order of creation)
DROP INDEX IF EXISTS "email_templates_template_type_max_invoice_count_is_acti_idx";
DROP INDEX IF EXISTS "email_templates_template_type_supports_consolidation_is__idx";
DROP INDEX IF EXISTS "email_logs_company_id_delivered_at_opened_at_clicked_at_idx";
DROP INDEX IF EXISTS "email_logs_company_id_sent_at_invoice_count_consolidati_idx";
DROP INDEX IF EXISTS "email_logs_consolidated_reminder_id_delivery_status_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_reminder_type_e_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_customer_id_sent_at_deliv_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_delivery_status__idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_created_at_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_escalation_level__idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_sent_at_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_customer_id_next_eligible_con_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_priority_score_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_scheduled_for_delivery_status_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_company_id_delivery_status_idx";
DROP INDEX IF EXISTS "customer_consolidated_reminders_customer_id_company_id_idx";

-- Drop foreign key constraints
ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "email_logs_consolidated_reminder_id_fkey";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_created_by_fkey";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_template_id_fkey";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_company_id_fkey";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_customer_id_fkey";

-- Drop check constraints
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_preferred_contact_interval_check";
ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "email_templates_max_invoice_count_check";
ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "email_logs_consolidation_savings_check";
ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "email_logs_invoice_count_check";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_invoice_count_check";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_contact_interval_days_check";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_priority_score_check";
ALTER TABLE "customer_consolidated_reminders" DROP CONSTRAINT IF EXISTS "customer_consolidated_reminders_total_amount_check";

-- Remove columns from existing tables (in reverse order)
ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "consolidation_metadata";
ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "consolidation_savings";
ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "invoice_count";
ALTER TABLE "email_logs" DROP COLUMN IF EXISTS "consolidated_reminder_id";

ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "consolidation_variables";
ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "max_invoice_count";
ALTER TABLE "email_templates" DROP COLUMN IF EXISTS "supports_consolidation";

ALTER TABLE "customers" DROP COLUMN IF EXISTS "preferred_contact_interval";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "max_consolidation_amount";
ALTER TABLE "customers" DROP COLUMN IF EXISTS "consolidation_preference";

-- Drop the main consolidation table
DROP TABLE IF EXISTS "customer_consolidated_reminders";

-- Note: We cannot remove enum values that were added to existing enums in PostgreSQL
-- The following would need to be done manually if absolutely required:
-- - EmailTemplateType enum values 'CONSOLIDATED_REMINDER' and 'URGENT_CONSOLIDATED_REMINDER'
-- This is a PostgreSQL limitation - enum values cannot be dropped

-- Drop the new enums (these can be dropped since they are standalone)
DROP TYPE IF EXISTS "ConsolidationPreference";
DROP TYPE IF EXISTS "EscalationLevel";
DROP TYPE IF EXISTS "ReminderType";

COMMIT;

-- Note: After running this rollback, you may need to manually clean up any
-- references to the removed enum values in your application code and any
-- existing data that uses 'CONSOLIDATED_REMINDER' or 'URGENT_CONSOLIDATED_REMINDER'
-- email template types.