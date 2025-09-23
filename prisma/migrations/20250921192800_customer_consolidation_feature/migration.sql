-- Customer Consolidation Feature Migration
-- This migration adds the core customer consolidation functionality
-- including new enums, main consolidation table, and existing table extensions

BEGIN;

-- Create new enums for consolidation
CREATE TYPE "ReminderType" AS ENUM ('CONSOLIDATED', 'URGENT_CONSOLIDATED', 'FINAL_CONSOLIDATED', 'MANUAL_CONSOLIDATED');
CREATE TYPE "EscalationLevel" AS ENUM ('POLITE', 'FIRM', 'URGENT', 'FINAL');
CREATE TYPE "ConsolidationPreference" AS ENUM ('ENABLED', 'DISABLED', 'AUTO');

-- Add new values to existing EmailTemplateType enum
ALTER TYPE "EmailTemplateType" ADD VALUE 'CONSOLIDATED_REMINDER';
ALTER TYPE "EmailTemplateType" ADD VALUE 'URGENT_CONSOLIDATED_REMINDER';

-- Create the main customer_consolidated_reminders table
CREATE TABLE "customer_consolidated_reminders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    -- Consolidation details
    "invoice_ids" TEXT[] NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "invoice_count" INTEGER NOT NULL,

    -- Reminder configuration
    "reminder_type" "ReminderType" NOT NULL DEFAULT 'CONSOLIDATED',
    "escalation_level" "EscalationLevel" NOT NULL DEFAULT 'POLITE',
    "template_id" TEXT,

    -- Scheduling and delivery
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivery_status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "aws_message_id" TEXT,

    -- Contact management
    "last_contact_date" TIMESTAMP(3),
    "next_eligible_contact" TIMESTAMP(3),
    "contact_interval_days" INTEGER NOT NULL DEFAULT 7,

    -- Priority and metadata
    "priority_score" INTEGER NOT NULL DEFAULT 0,
    "consolidation_reason" TEXT,
    "business_rules_applied" JSONB DEFAULT '{}',
    "cultural_compliance_flags" JSONB DEFAULT '{}',

    -- Response tracking
    "email_opened_at" TIMESTAMP(3),
    "email_clicked_at" TIMESTAMP(3),
    "customer_responded_at" TIMESTAMP(3),
    "payment_received_at" TIMESTAMP(3),

    -- Audit fields
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "customer_consolidated_reminders_pkey" PRIMARY KEY ("id")
);

-- Add consolidation preferences to customers table
ALTER TABLE "customers" ADD COLUMN "consolidation_preference" "ConsolidationPreference" NOT NULL DEFAULT 'ENABLED';
ALTER TABLE "customers" ADD COLUMN "max_consolidation_amount" DECIMAL(12,2);
ALTER TABLE "customers" ADD COLUMN "preferred_contact_interval" INTEGER NOT NULL DEFAULT 7;

-- Add consolidation support to email_templates table
ALTER TABLE "email_templates" ADD COLUMN "supports_consolidation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_templates" ADD COLUMN "max_invoice_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "email_templates" ADD COLUMN "consolidation_variables" JSONB DEFAULT '{}';

-- Add consolidation tracking to email_logs table
ALTER TABLE "email_logs" ADD COLUMN "consolidated_reminder_id" TEXT;
ALTER TABLE "email_logs" ADD COLUMN "invoice_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "email_logs" ADD COLUMN "consolidation_savings" DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE "email_logs" ADD COLUMN "consolidation_metadata" JSONB DEFAULT '{}';

-- Create foreign key constraints
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_consolidated_reminder_id_fkey" FOREIGN KEY ("consolidated_reminder_id") REFERENCES "customer_consolidated_reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create performance indexes for customer_consolidated_reminders
CREATE INDEX "customer_consolidated_reminders_customer_id_company_id_idx" ON "customer_consolidated_reminders"("customer_id", "company_id");
CREATE INDEX "customer_consolidated_reminders_company_id_delivery_status_idx" ON "customer_consolidated_reminders"("company_id", "delivery_status");
CREATE INDEX "customer_consolidated_reminders_scheduled_for_delivery_status_idx" ON "customer_consolidated_reminders"("scheduled_for", "delivery_status");
CREATE INDEX "customer_consolidated_reminders_company_id_priority_score_idx" ON "customer_consolidated_reminders"("company_id", "priority_score");
CREATE INDEX "customer_consolidated_reminders_customer_id_next_eligible_con_idx" ON "customer_consolidated_reminders"("customer_id", "next_eligible_contact");
CREATE INDEX "customer_consolidated_reminders_company_id_sent_at_idx" ON "customer_consolidated_reminders"("company_id", "sent_at");
CREATE INDEX "customer_consolidated_reminders_company_id_escalation_level__idx" ON "customer_consolidated_reminders"("company_id", "escalation_level", "delivery_status");
CREATE INDEX "customer_consolidated_reminders_company_id_created_at_idx" ON "customer_consolidated_reminders"("company_id", "created_at");

-- Composite indexes for complex queries
CREATE INDEX "customer_consolidated_reminders_company_id_delivery_status__idx" ON "customer_consolidated_reminders"("company_id", "delivery_status", "priority_score");
CREATE INDEX "customer_consolidated_reminders_customer_id_sent_at_deliv_idx" ON "customer_consolidated_reminders"("customer_id", "sent_at", "delivery_status");
CREATE INDEX "customer_consolidated_reminders_company_id_reminder_type_e_idx" ON "customer_consolidated_reminders"("company_id", "reminder_type", "escalation_level");

-- Create additional indexes for email_logs consolidation features
CREATE INDEX "email_logs_consolidated_reminder_id_delivery_status_idx" ON "email_logs"("consolidated_reminder_id", "delivery_status");
CREATE INDEX "email_logs_company_id_sent_at_invoice_count_consolidati_idx" ON "email_logs"("company_id", "sent_at", "invoice_count", "consolidation_savings");
CREATE INDEX "email_logs_company_id_delivered_at_opened_at_clicked_at_idx" ON "email_logs"("company_id", "delivered_at", "opened_at", "clicked_at");

-- Create indexes for email_templates consolidation features
CREATE INDEX "email_templates_template_type_supports_consolidation_is__idx" ON "email_templates"("template_type", "supports_consolidation", "is_active");
CREATE INDEX "email_templates_template_type_max_invoice_count_is_acti_idx" ON "email_templates"("template_type", "max_invoice_count", "is_active");

-- Add check constraints for data validation
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_total_amount_check" CHECK ("total_amount" > 0);
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_priority_score_check" CHECK ("priority_score" >= 0 AND "priority_score" <= 100);
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_contact_interval_days_check" CHECK ("contact_interval_days" > 0);
ALTER TABLE "customer_consolidated_reminders" ADD CONSTRAINT "customer_consolidated_reminders_invoice_count_check" CHECK ("invoice_count" >= 2);
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_invoice_count_check" CHECK ("invoice_count" > 0);
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_consolidation_savings_check" CHECK ("consolidation_savings" >= 0 AND "consolidation_savings" <= 100);
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_max_invoice_count_check" CHECK ("max_invoice_count" > 0);
ALTER TABLE "customers" ADD CONSTRAINT "customers_preferred_contact_interval_check" CHECK ("preferred_contact_interval" > 0);

-- Add table and column comments for documentation
COMMENT ON TABLE "customer_consolidated_reminders" IS 'Tracks customer-level consolidated payment reminders';
COMMENT ON COLUMN "customer_consolidated_reminders"."invoice_ids" IS 'Array of invoice IDs included in this consolidation';
COMMENT ON COLUMN "customer_consolidated_reminders"."priority_score" IS 'Calculated priority score (0-100) based on amount, age, and relationship factors';
COMMENT ON COLUMN "customer_consolidated_reminders"."business_rules_applied" IS 'JSON record of business rules applied during consolidation';
COMMENT ON COLUMN "customer_consolidated_reminders"."cultural_compliance_flags" IS 'JSON record of UAE cultural compliance checks performed';
COMMENT ON COLUMN "email_logs"."consolidated_reminder_id" IS 'Links email log to consolidated reminder record';
COMMENT ON COLUMN "email_logs"."invoice_count" IS 'Number of invoices included in this email (1 for individual, 2+ for consolidated)';
COMMENT ON COLUMN "email_logs"."consolidation_savings" IS 'Percentage of emails saved through consolidation (0-100)';
COMMENT ON COLUMN "email_logs"."consolidation_metadata" IS 'Additional metadata about consolidation process';
COMMENT ON COLUMN "email_templates"."supports_consolidation" IS 'Whether this template supports multiple invoices in a single email';
COMMENT ON COLUMN "email_templates"."max_invoice_count" IS 'Maximum number of invoices this template can handle';
COMMENT ON COLUMN "email_templates"."consolidation_variables" IS 'Template variables specific to consolidation features';
COMMENT ON COLUMN "customers"."consolidation_preference" IS 'Customer preference for consolidated vs individual reminders';
COMMENT ON COLUMN "customers"."max_consolidation_amount" IS 'Maximum amount for auto-consolidation (NULL = no limit)';
COMMENT ON COLUMN "customers"."preferred_contact_interval" IS 'Preferred days between reminder contacts';

COMMIT;