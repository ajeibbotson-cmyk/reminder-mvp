# Customer Consolidation Database Schema

## Overview

This document details the database schema extensions required for implementing customer-consolidated payment reminders in the reminder-mvp application. The schema builds upon the existing invoice and customer management system while adding intelligent consolidation tracking and analytics capabilities.

## Existing Schema Analysis

### Current Tables (Utilized)
- **customers**: Customer profiles with UAE business information
- **invoices**: Invoice management with comprehensive tracking
- **email_logs**: Email delivery and analytics tracking
- **email_templates**: Template management with multi-language support
- **follow_up_logs**: Individual invoice follow-up tracking
- **follow_up_sequences**: Automation sequence configuration

### Current Relationships
```
companies (1) ──── (∞) customers (1) ──── (∞) invoices
companies (1) ──── (∞) email_templates
companies (1) ──── (∞) follow_up_sequences
invoices (1) ──── (∞) follow_up_logs
```

## New Table Specifications

### 1. customer_consolidated_reminders
Primary table for tracking customer-level consolidated reminders.

```sql
CREATE TABLE customer_consolidated_reminders (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

  -- Consolidation details
  invoice_ids UUID[] NOT NULL CHECK (array_length(invoice_ids, 1) >= 2),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  currency VARCHAR(3) DEFAULT 'AED' CHECK (currency IN ('AED', 'USD', 'EUR', 'GBP')),
  invoice_count INTEGER GENERATED ALWAYS AS (array_length(invoice_ids, 1)) STORED,

  -- Reminder configuration
  reminder_type reminder_type DEFAULT 'CONSOLIDATED',
  escalation_level escalation_level DEFAULT 'POLITE',
  template_id UUID REFERENCES email_templates(id),

  -- Scheduling and delivery
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status email_delivery_status DEFAULT 'QUEUED',
  aws_message_id VARCHAR(255), -- AWS SES message ID

  -- Contact management
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_eligible_contact TIMESTAMP WITH TIME ZONE,
  contact_interval_days INTEGER DEFAULT 7 CHECK (contact_interval_days > 0),

  -- Priority and metadata
  priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
  consolidation_reason TEXT,
  business_rules_applied JSONB DEFAULT '{}',
  cultural_compliance_flags JSONB DEFAULT '{}',

  -- Response tracking
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_clicked_at TIMESTAMP WITH TIME ZONE,
  customer_responded_at TIMESTAMP WITH TIME ZONE,
  payment_received_at TIMESTAMP WITH TIME ZONE,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_invoice_count CHECK (array_length(invoice_ids, 1) <= 25),
  CONSTRAINT valid_priority_score CHECK (priority_score >= 0 AND priority_score <= 100),
  CONSTRAINT valid_scheduling CHECK (
    (scheduled_for IS NULL AND sent_at IS NOT NULL) OR
    (scheduled_for IS NOT NULL AND sent_at IS NULL) OR
    (scheduled_for IS NULL AND sent_at IS NULL)
  ),
  CONSTRAINT valid_contact_sequence CHECK (
    last_contact_date IS NULL OR next_eligible_contact > last_contact_date
  )
);

-- Comments for documentation
COMMENT ON TABLE customer_consolidated_reminders IS 'Tracks customer-level consolidated payment reminders';
COMMENT ON COLUMN customer_consolidated_reminders.invoice_ids IS 'Array of invoice IDs included in this consolidation';
COMMENT ON COLUMN customer_consolidated_reminders.priority_score IS 'Calculated priority score (0-100) based on amount, age, and relationship factors';
COMMENT ON COLUMN customer_consolidated_reminders.business_rules_applied IS 'JSON record of business rules applied during consolidation';
COMMENT ON COLUMN customer_consolidated_reminders.cultural_compliance_flags IS 'JSON record of UAE cultural compliance checks performed';
```

### 2. New Enums for Consolidation

```sql
-- Reminder type enumeration
CREATE TYPE reminder_type AS ENUM (
  'CONSOLIDATED',           -- Standard consolidated reminder
  'URGENT_CONSOLIDATED',    -- Urgent consolidated reminder
  'FINAL_CONSOLIDATED',     -- Final notice consolidated reminder
  'MANUAL_CONSOLIDATED'     -- Manually triggered consolidated reminder
);

-- Escalation level enumeration
CREATE TYPE escalation_level AS ENUM (
  'POLITE',    -- First reminder, gentle tone
  'FIRM',      -- Second reminder, business tone
  'URGENT',    -- Third reminder, urgent tone
  'FINAL'      -- Final notice, serious tone
);
```

## Enhanced Existing Tables

### 1. email_logs (Enhanced)
Extend existing email_logs table to support consolidation tracking.

```sql
-- Add consolidation tracking columns
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS consolidated_reminder_id UUID REFERENCES customer_consolidated_reminders(id);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS invoice_count INTEGER DEFAULT 1 CHECK (invoice_count > 0);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS consolidation_savings DECIMAL(5,2) DEFAULT 0.00 CHECK (consolidation_savings >= 0 AND consolidation_savings <= 100);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS consolidation_metadata JSONB DEFAULT '{}';

-- Comments
COMMENT ON COLUMN email_logs.consolidated_reminder_id IS 'Links email log to consolidated reminder record';
COMMENT ON COLUMN email_logs.invoice_count IS 'Number of invoices included in this email (1 for individual, 2+ for consolidated)';
COMMENT ON COLUMN email_logs.consolidation_savings IS 'Percentage of emails saved through consolidation (0-100)';
COMMENT ON COLUMN email_logs.consolidation_metadata IS 'Additional metadata about consolidation process';
```

### 2. email_templates (Enhanced)
Extend existing email_templates table to support consolidation features.

```sql
-- Add consolidation support columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS supports_consolidation BOOLEAN DEFAULT FALSE;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS max_invoice_count INTEGER DEFAULT 1 CHECK (max_invoice_count > 0);
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS consolidation_variables JSONB DEFAULT '{}';

-- Update existing enum
ALTER TYPE emailtemplatetype ADD VALUE IF NOT EXISTS 'CONSOLIDATED_REMINDER';
ALTER TYPE emailtemplatetype ADD VALUE IF NOT EXISTS 'URGENT_CONSOLIDATED_REMINDER';

-- Comments
COMMENT ON COLUMN email_templates.supports_consolidation IS 'Whether this template supports multiple invoices in a single email';
COMMENT ON COLUMN email_templates.max_invoice_count IS 'Maximum number of invoices this template can handle';
COMMENT ON COLUMN email_templates.consolidation_variables IS 'Template variables specific to consolidation features';
```

### 3. customers (Enhanced)
Add consolidation preferences to existing customers table.

```sql
-- Add consolidation preferences
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consolidation_preference consolidation_preference DEFAULT 'ENABLED';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS max_consolidation_amount DECIMAL(12,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_contact_interval INTEGER DEFAULT 7 CHECK (preferred_contact_interval > 0);

-- New enum for consolidation preferences
CREATE TYPE consolidation_preference AS ENUM (
  'ENABLED',    -- Customer prefers consolidated reminders
  'DISABLED',   -- Customer prefers individual reminders
  'AUTO'        -- System decides based on invoice count
);

-- Comments
COMMENT ON COLUMN customers.consolidation_preference IS 'Customer preference for consolidated vs individual reminders';
COMMENT ON COLUMN customers.max_consolidation_amount IS 'Maximum amount for auto-consolidation (NULL = no limit)';
COMMENT ON COLUMN customers.preferred_contact_interval IS 'Preferred days between reminder contacts';
```

## Performance Indexes

### Primary Performance Indexes

```sql
-- Customer consolidation queries
CREATE INDEX idx_ccr_customer_company ON customer_consolidated_reminders(customer_id, company_id);
CREATE INDEX idx_ccr_company_status ON customer_consolidated_reminders(company_id, delivery_status);
CREATE INDEX idx_ccr_scheduled_delivery ON customer_consolidated_reminders(scheduled_for, delivery_status)
  WHERE scheduled_for IS NOT NULL AND delivery_status = 'QUEUED';

-- Priority and queue management
CREATE INDEX idx_ccr_priority_queue ON customer_consolidated_reminders(company_id, priority_score DESC, created_at)
  WHERE delivery_status = 'QUEUED';
CREATE INDEX idx_ccr_contact_eligibility ON customer_consolidated_reminders(customer_id, next_eligible_contact)
  WHERE next_eligible_contact IS NOT NULL;

-- Analytics and reporting
CREATE INDEX idx_ccr_company_analytics ON customer_consolidated_reminders(company_id, sent_at, delivery_status)
  WHERE sent_at IS NOT NULL;
CREATE INDEX idx_ccr_effectiveness ON customer_consolidated_reminders(company_id, escalation_level, delivery_status, sent_at)
  WHERE sent_at IS NOT NULL;

-- Invoice coverage analysis
CREATE INDEX idx_ccr_invoice_coverage ON customer_consolidated_reminders USING GIN(invoice_ids);

-- Response tracking for analytics
CREATE INDEX idx_ccr_response_tracking ON customer_consolidated_reminders(company_id, sent_at, payment_received_at)
  WHERE sent_at IS NOT NULL;
```

### Enhanced Email Logs Indexes

```sql
-- Consolidation email tracking
CREATE INDEX idx_email_logs_consolidated ON email_logs(consolidated_reminder_id, delivery_status)
  WHERE consolidated_reminder_id IS NOT NULL;

-- Consolidation analytics
CREATE INDEX idx_email_logs_consolidation_analytics ON email_logs(company_id, sent_at, invoice_count, consolidation_savings)
  WHERE consolidated_reminder_id IS NOT NULL;

-- Consolidation effectiveness
CREATE INDEX idx_email_logs_consolidation_effectiveness ON email_logs(company_id, delivered_at, opened_at, clicked_at)
  WHERE consolidated_reminder_id IS NOT NULL;
```

### Enhanced Template Indexes

```sql
-- Consolidation template queries
CREATE INDEX idx_email_templates_consolidation ON email_templates(template_type, supports_consolidation, is_active)
  WHERE supports_consolidation = TRUE;

-- Max invoice count filtering
CREATE INDEX idx_email_templates_invoice_capacity ON email_templates(template_type, max_invoice_count, is_active)
  WHERE supports_consolidation = TRUE;
```

## Materialized Views

### 1. customer_consolidation_queue
Optimized view for the main consolidation dashboard.

```sql
CREATE MATERIALIZED VIEW customer_consolidation_queue AS
SELECT
  c.id as customer_id,
  c.company_id,
  c.name as customer_name,
  c.email as customer_email,
  c.business_name as company_name,
  c.preferred_language,
  c.consolidation_preference,

  -- Invoice aggregations
  COUNT(i.id) as overdue_count,
  SUM(i.amount) as total_overdue,
  MIN(i.due_date) as earliest_due_date,
  MAX(CURRENT_DATE - i.due_date) as max_days_overdue,
  array_agg(i.id ORDER BY i.due_date ASC) as invoice_ids,

  -- Last contact information
  MAX(ccr.sent_at) as last_consolidation_sent,
  MAX(fl.sent_at) as last_individual_sent,
  GREATEST(
    COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
    COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
  ) as last_contact_date,

  -- Contact eligibility
  CASE
    WHEN GREATEST(
      COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
      COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
    ) < CURRENT_DATE - INTERVAL '7 days' THEN true
    ELSE false
  END as can_contact,

  GREATEST(
    COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
    COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
  ) + INTERVAL '7 days' as next_eligible_contact,

  -- Priority calculation (simplified)
  CASE
    WHEN MAX(CURRENT_DATE - i.due_date) > 90 THEN 'high'
    WHEN MAX(CURRENT_DATE - i.due_date) > 30 THEN 'medium'
    ELSE 'low'
  END as priority_level,

  -- Escalation level
  CASE
    WHEN MAX(CURRENT_DATE - i.due_date) > 90 THEN 'FINAL'
    WHEN MAX(CURRENT_DATE - i.due_date) > 60 THEN 'URGENT'
    WHEN MAX(CURRENT_DATE - i.due_date) > 30 THEN 'FIRM'
    ELSE 'POLITE'
  END as escalation_level,

  -- Consolidation eligibility
  COUNT(i.id) >= 2 as consolidation_eligible,

  NOW() as refreshed_at

FROM customers c
JOIN invoices i ON c.id = i.customer_id
LEFT JOIN customer_consolidated_reminders ccr ON c.id = ccr.customer_id
LEFT JOIN follow_up_logs fl ON i.id = fl.invoice_id
WHERE i.status = 'OVERDUE'
  AND i.is_active = true
  AND c.is_active = true
  AND (c.consolidation_preference = 'ENABLED' OR c.consolidation_preference = 'AUTO')
GROUP BY c.id, c.company_id, c.name, c.email, c.business_name, c.preferred_language, c.consolidation_preference
HAVING COUNT(i.id) >= 2; -- Only customers with 2+ overdue invoices

-- Unique index for materialized view
CREATE UNIQUE INDEX idx_consolidation_queue_customer ON customer_consolidation_queue(customer_id);

-- Performance indexes for filtering and sorting
CREATE INDEX idx_consolidation_queue_company_priority ON customer_consolidation_queue(company_id, priority_level, can_contact);
CREATE INDEX idx_consolidation_queue_amount ON customer_consolidation_queue(company_id, total_overdue DESC);
CREATE INDEX idx_consolidation_queue_age ON customer_consolidation_queue(company_id, max_days_overdue DESC);
CREATE INDEX idx_consolidation_queue_eligibility ON customer_consolidation_queue(company_id, consolidation_eligible, can_contact);
```

### 2. consolidation_effectiveness_stats
Analytics view for measuring consolidation success.

```sql
CREATE MATERIALIZED VIEW consolidation_effectiveness_stats AS
SELECT
  ccr.company_id,
  DATE_TRUNC('month', ccr.sent_at) as month,
  ccr.escalation_level,
  ccr.reminder_type,

  -- Volume metrics
  COUNT(*) as reminders_sent,
  COUNT(DISTINCT ccr.customer_id) as unique_customers,
  SUM(ccr.invoice_count) as total_invoices_covered,
  AVG(ccr.total_amount) as avg_reminder_amount,

  -- Consolidation savings
  SUM(ccr.invoice_count - 1) as emails_saved,
  AVG(ccr.invoice_count) as avg_invoices_per_consolidation,

  -- Engagement metrics
  COUNT(*) FILTER (WHERE ccr.email_opened_at IS NOT NULL) as opened_count,
  COUNT(*) FILTER (WHERE ccr.email_clicked_at IS NOT NULL) as clicked_count,
  COUNT(*) FILTER (WHERE ccr.customer_responded_at IS NOT NULL) as responded_count,

  -- Payment metrics
  COUNT(*) FILTER (WHERE ccr.payment_received_at IS NOT NULL) as payment_count,
  SUM(ccr.total_amount) FILTER (WHERE ccr.payment_received_at IS NOT NULL) as payment_amount,

  -- Timing metrics
  AVG(EXTRACT(days FROM ccr.payment_received_at - ccr.sent_at)) FILTER (WHERE ccr.payment_received_at IS NOT NULL) as avg_payment_days,
  AVG(EXTRACT(hours FROM ccr.email_opened_at - ccr.sent_at)) FILTER (WHERE ccr.email_opened_at IS NOT NULL) as avg_open_hours,

  -- Effectiveness rates
  (COUNT(*) FILTER (WHERE ccr.email_opened_at IS NOT NULL))::DECIMAL / COUNT(*) * 100 as open_rate,
  (COUNT(*) FILTER (WHERE ccr.payment_received_at IS NOT NULL))::DECIMAL / COUNT(*) * 100 as payment_rate,

  NOW() as refreshed_at

FROM customer_consolidated_reminders ccr
WHERE ccr.sent_at IS NOT NULL
  AND ccr.sent_at >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY ccr.company_id, DATE_TRUNC('month', ccr.sent_at), ccr.escalation_level, ccr.reminder_type;

-- Indexes for analytics queries
CREATE INDEX idx_consolidation_effectiveness_company_month ON consolidation_effectiveness_stats(company_id, month DESC);
CREATE INDEX idx_consolidation_effectiveness_escalation ON consolidation_effectiveness_stats(company_id, escalation_level, month);
CREATE INDEX idx_consolidation_effectiveness_type ON consolidation_effectiveness_stats(company_id, reminder_type, month);
```

## Database Functions and Triggers

### 1. Auto-update Priority Score Function

```sql
CREATE OR REPLACE FUNCTION calculate_consolidation_priority_score(
  total_amount_param DECIMAL,
  max_days_overdue_param INTEGER,
  customer_id_param UUID
) RETURNS INTEGER AS $$
DECLARE
  amount_score INTEGER;
  age_score INTEGER;
  history_score INTEGER;
  relationship_score INTEGER;
  final_score INTEGER;
BEGIN
  -- Amount score (40% weight, 0-40 points)
  amount_score := LEAST(40, FLOOR((total_amount_param / 100000.0) * 40));

  -- Age score (30% weight, 0-30 points)
  age_score := LEAST(30, FLOOR((max_days_overdue_param / 180.0) * 30));

  -- Payment history score (20% weight, 0-20 points)
  -- Simplified: get average payment delay from last 6 months
  SELECT COALESCE(
    20 - LEAST(20, FLOOR(AVG(EXTRACT(days FROM p.payment_date - i.due_date)) / 30.0 * 20)),
    10
  ) INTO history_score
  FROM payments p
  JOIN invoices i ON p.invoice_id = i.id
  WHERE i.customer_id = customer_id_param
    AND p.payment_date >= CURRENT_DATE - INTERVAL '6 months';

  -- Relationship score (10% weight, 0-10 points)
  -- Simplified: based on customer since date and business type
  SELECT CASE
    WHEN c.customer_since < CURRENT_DATE - INTERVAL '2 years' THEN 10
    WHEN c.customer_since < CURRENT_DATE - INTERVAL '1 year' THEN 7
    ELSE 5
  END INTO relationship_score
  FROM customers c
  WHERE c.id = customer_id_param;

  final_score := amount_score + age_score + COALESCE(history_score, 10) + COALESCE(relationship_score, 5);

  RETURN LEAST(100, final_score);
END;
$$ LANGUAGE plpgsql;
```

### 2. Auto-update Next Eligible Contact Trigger

```sql
CREATE OR REPLACE FUNCTION update_next_eligible_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate next eligible contact date
  NEW.next_eligible_contact := NEW.sent_at + (NEW.contact_interval_days || ' days')::INTERVAL;

  -- Update last contact date
  NEW.last_contact_date := NEW.sent_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_next_eligible_contact
  BEFORE UPDATE OF sent_at ON customer_consolidated_reminders
  FOR EACH ROW
  WHEN (NEW.sent_at IS NOT NULL AND OLD.sent_at IS NULL)
  EXECUTE FUNCTION update_next_eligible_contact();
```

### 3. Consolidation Metrics Update Function

```sql
CREATE OR REPLACE FUNCTION update_consolidation_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email_logs with consolidation information
  IF NEW.consolidated_reminder_id IS NOT NULL THEN
    -- Calculate consolidation savings
    UPDATE email_logs
    SET
      consolidation_savings = CASE
        WHEN invoice_count > 1 THEN ((invoice_count - 1)::DECIMAL / invoice_count * 100)
        ELSE 0
      END,
      consolidation_metadata = jsonb_build_object(
        'consolidation_id', NEW.consolidated_reminder_id,
        'emails_saved', GREATEST(0, invoice_count - 1),
        'original_emails_count', invoice_count
      )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_consolidation_metrics
  AFTER INSERT OR UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_consolidation_metrics();
```

## Migration Scripts

### Migration 001: Core Consolidation Tables

```sql
-- 001_create_consolidation_tables.sql
BEGIN;

-- Create new enums
CREATE TYPE reminder_type AS ENUM (
  'CONSOLIDATED',
  'URGENT_CONSOLIDATED',
  'FINAL_CONSOLIDATED',
  'MANUAL_CONSOLIDATED'
);

CREATE TYPE escalation_level AS ENUM (
  'POLITE',
  'FIRM',
  'URGENT',
  'FINAL'
);

CREATE TYPE consolidation_preference AS ENUM (
  'ENABLED',
  'DISABLED',
  'AUTO'
);

-- Create customer_consolidated_reminders table
CREATE TABLE customer_consolidated_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_ids UUID[] NOT NULL CHECK (array_length(invoice_ids, 1) >= 2),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  currency VARCHAR(3) DEFAULT 'AED' CHECK (currency IN ('AED', 'USD', 'EUR', 'GBP')),
  invoice_count INTEGER GENERATED ALWAYS AS (array_length(invoice_ids, 1)) STORED,
  reminder_type reminder_type DEFAULT 'CONSOLIDATED',
  escalation_level escalation_level DEFAULT 'POLITE',
  template_id UUID REFERENCES email_templates(id),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status email_delivery_status DEFAULT 'QUEUED',
  aws_message_id VARCHAR(255),
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_eligible_contact TIMESTAMP WITH TIME ZONE,
  contact_interval_days INTEGER DEFAULT 7 CHECK (contact_interval_days > 0),
  priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
  consolidation_reason TEXT,
  business_rules_applied JSONB DEFAULT '{}',
  cultural_compliance_flags JSONB DEFAULT '{}',
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_clicked_at TIMESTAMP WITH TIME ZONE,
  customer_responded_at TIMESTAMP WITH TIME ZONE,
  payment_received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  CONSTRAINT valid_invoice_count CHECK (array_length(invoice_ids, 1) <= 25),
  CONSTRAINT valid_priority_score CHECK (priority_score >= 0 AND priority_score <= 100),
  CONSTRAINT valid_scheduling CHECK (
    (scheduled_for IS NULL AND sent_at IS NOT NULL) OR
    (scheduled_for IS NOT NULL AND sent_at IS NULL) OR
    (scheduled_for IS NULL AND sent_at IS NULL)
  ),
  CONSTRAINT valid_contact_sequence CHECK (
    last_contact_date IS NULL OR next_eligible_contact > last_contact_date
  )
);

-- Add table and column comments
COMMENT ON TABLE customer_consolidated_reminders IS 'Tracks customer-level consolidated payment reminders';

-- Create primary performance indexes
CREATE INDEX idx_ccr_customer_company ON customer_consolidated_reminders(customer_id, company_id);
CREATE INDEX idx_ccr_priority_queue ON customer_consolidated_reminders(company_id, priority_score DESC, created_at) WHERE delivery_status = 'QUEUED';
CREATE INDEX idx_ccr_scheduled_delivery ON customer_consolidated_reminders(scheduled_for, delivery_status) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_ccr_company_analytics ON customer_consolidated_reminders(company_id, sent_at, delivery_status) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_ccr_invoice_coverage ON customer_consolidated_reminders USING GIN(invoice_ids);

COMMIT;
```

### Migration 002: Enhance Existing Tables

```sql
-- 002_enhance_existing_tables.sql
BEGIN;

-- Enhance email_logs table
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS consolidated_reminder_id UUID REFERENCES customer_consolidated_reminders(id);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS invoice_count INTEGER DEFAULT 1 CHECK (invoice_count > 0);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS consolidation_savings DECIMAL(5,2) DEFAULT 0.00 CHECK (consolidation_savings >= 0 AND consolidation_savings <= 100);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS consolidation_metadata JSONB DEFAULT '{}';

-- Enhance email_templates table
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS supports_consolidation BOOLEAN DEFAULT FALSE;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS max_invoice_count INTEGER DEFAULT 1 CHECK (max_invoice_count > 0);
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS consolidation_variables JSONB DEFAULT '{}';

-- Add new template types
ALTER TYPE emailtemplatetype ADD VALUE IF NOT EXISTS 'CONSOLIDATED_REMINDER';
ALTER TYPE emailtemplatetype ADD VALUE IF NOT EXISTS 'URGENT_CONSOLIDATED_REMINDER';

-- Enhance customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consolidation_preference consolidation_preference DEFAULT 'ENABLED';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS max_consolidation_amount DECIMAL(12,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_contact_interval INTEGER DEFAULT 7 CHECK (preferred_contact_interval > 0);

-- Create indexes for enhanced tables
CREATE INDEX idx_email_logs_consolidated ON email_logs(consolidated_reminder_id, delivery_status) WHERE consolidated_reminder_id IS NOT NULL;
CREATE INDEX idx_email_templates_consolidation ON email_templates(template_type, supports_consolidation, is_active) WHERE supports_consolidation = TRUE;

COMMIT;
```

### Migration 003: Create Functions and Views

```sql
-- 003_create_functions_and_views.sql
BEGIN;

-- Create priority calculation function
CREATE OR REPLACE FUNCTION calculate_consolidation_priority_score(
  total_amount_param DECIMAL,
  max_days_overdue_param INTEGER,
  customer_id_param UUID
) RETURNS INTEGER AS $$
DECLARE
  amount_score INTEGER;
  age_score INTEGER;
  history_score INTEGER;
  relationship_score INTEGER;
  final_score INTEGER;
BEGIN
  -- Amount score (40% weight, 0-40 points)
  amount_score := LEAST(40, FLOOR((total_amount_param / 100000.0) * 40));

  -- Age score (30% weight, 0-30 points)
  age_score := LEAST(30, FLOOR((max_days_overdue_param / 180.0) * 30));

  -- Payment history score (20% weight, 0-20 points)
  SELECT COALESCE(
    20 - LEAST(20, FLOOR(AVG(EXTRACT(days FROM p.payment_date - i.due_date)) / 30.0 * 20)),
    10
  ) INTO history_score
  FROM payments p
  JOIN invoices i ON p.invoice_id = i.id
  WHERE i.customer_id = customer_id_param
    AND p.payment_date >= CURRENT_DATE - INTERVAL '6 months';

  -- Relationship score (10% weight, 0-10 points)
  SELECT CASE
    WHEN c.customer_since < CURRENT_DATE - INTERVAL '2 years' THEN 10
    WHEN c.customer_since < CURRENT_DATE - INTERVAL '1 year' THEN 7
    ELSE 5
  END INTO relationship_score
  FROM customers c
  WHERE c.id = customer_id_param;

  final_score := amount_score + age_score + COALESCE(history_score, 10) + COALESCE(relationship_score, 5);

  RETURN LEAST(100, final_score);
END;
$$ LANGUAGE plpgsql;

-- Create customer consolidation queue materialized view
CREATE MATERIALIZED VIEW customer_consolidation_queue AS
SELECT
  c.id as customer_id,
  c.company_id,
  c.name as customer_name,
  c.email as customer_email,
  c.business_name as company_name,
  c.preferred_language,
  c.consolidation_preference,
  COUNT(i.id) as overdue_count,
  SUM(i.amount) as total_overdue,
  MIN(i.due_date) as earliest_due_date,
  MAX(CURRENT_DATE - i.due_date) as max_days_overdue,
  array_agg(i.id ORDER BY i.due_date ASC) as invoice_ids,
  MAX(ccr.sent_at) as last_consolidation_sent,
  MAX(fl.sent_at) as last_individual_sent,
  GREATEST(
    COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
    COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
  ) as last_contact_date,
  CASE
    WHEN GREATEST(
      COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
      COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
    ) < CURRENT_DATE - INTERVAL '7 days' THEN true
    ELSE false
  END as can_contact,
  GREATEST(
    COALESCE(MAX(ccr.sent_at), '1900-01-01'::timestamp),
    COALESCE(MAX(fl.sent_at), '1900-01-01'::timestamp)
  ) + INTERVAL '7 days' as next_eligible_contact,
  CASE
    WHEN MAX(CURRENT_DATE - i.due_date) > 90 THEN 'high'
    WHEN MAX(CURRENT_DATE - i.due_date) > 30 THEN 'medium'
    ELSE 'low'
  END as priority_level,
  CASE
    WHEN MAX(CURRENT_DATE - i.due_date) > 90 THEN 'FINAL'
    WHEN MAX(CURRENT_DATE - i.due_date) > 60 THEN 'URGENT'
    WHEN MAX(CURRENT_DATE - i.due_date) > 30 THEN 'FIRM'
    ELSE 'POLITE'
  END as escalation_level,
  COUNT(i.id) >= 2 as consolidation_eligible,
  NOW() as refreshed_at
FROM customers c
JOIN invoices i ON c.id = i.customer_id
LEFT JOIN customer_consolidated_reminders ccr ON c.id = ccr.customer_id
LEFT JOIN follow_up_logs fl ON i.id = fl.invoice_id
WHERE i.status = 'OVERDUE'
  AND i.is_active = true
  AND c.is_active = true
  AND (c.consolidation_preference = 'ENABLED' OR c.consolidation_preference = 'AUTO')
GROUP BY c.id, c.company_id, c.name, c.email, c.business_name, c.preferred_language, c.consolidation_preference
HAVING COUNT(i.id) >= 2;

-- Create indexes for materialized view
CREATE UNIQUE INDEX idx_consolidation_queue_customer ON customer_consolidation_queue(customer_id);
CREATE INDEX idx_consolidation_queue_company_priority ON customer_consolidation_queue(company_id, priority_level, can_contact);

COMMIT;
```

## Rollback Procedures

### Complete Rollback Script

```sql
-- rollback_consolidation_schema.sql
BEGIN;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS consolidation_effectiveness_stats;
DROP MATERIALIZED VIEW IF EXISTS customer_consolidation_queue;

-- Drop functions
DROP FUNCTION IF EXISTS calculate_consolidation_priority_score(DECIMAL, INTEGER, UUID);
DROP FUNCTION IF EXISTS update_next_eligible_contact();
DROP FUNCTION IF EXISTS update_consolidation_metrics();

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_next_eligible_contact ON customer_consolidated_reminders;
DROP TRIGGER IF EXISTS trigger_update_consolidation_metrics ON email_logs;

-- Remove columns from existing tables
ALTER TABLE customers DROP COLUMN IF EXISTS consolidation_preference;
ALTER TABLE customers DROP COLUMN IF EXISTS max_consolidation_amount;
ALTER TABLE customers DROP COLUMN IF EXISTS preferred_contact_interval;

ALTER TABLE email_templates DROP COLUMN IF EXISTS supports_consolidation;
ALTER TABLE email_templates DROP COLUMN IF EXISTS max_invoice_count;
ALTER TABLE email_templates DROP COLUMN IF EXISTS consolidation_variables;

ALTER TABLE email_logs DROP COLUMN IF EXISTS consolidated_reminder_id;
ALTER TABLE email_logs DROP COLUMN IF EXISTS invoice_count;
ALTER TABLE email_logs DROP COLUMN IF EXISTS consolidation_savings;
ALTER TABLE email_logs DROP COLUMN IF EXISTS consolidation_metadata;

-- Drop main table
DROP TABLE IF EXISTS customer_consolidated_reminders;

-- Drop enums
DROP TYPE IF EXISTS consolidation_preference;
DROP TYPE IF EXISTS escalation_level;
DROP TYPE IF EXISTS reminder_type;

COMMIT;
```

## Data Validation and Testing

### Validation Queries

```sql
-- Validate consolidation data integrity
SELECT
  'customer_consolidated_reminders' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE array_length(invoice_ids, 1) >= 2) as valid_consolidations,
  COUNT(*) FILTER (WHERE total_amount > 0) as valid_amounts,
  COUNT(*) FILTER (WHERE priority_score BETWEEN 0 AND 100) as valid_priorities
FROM customer_consolidated_reminders;

-- Validate foreign key relationships
SELECT
  'Orphaned consolidations' as check_type,
  COUNT(*) as count
FROM customer_consolidated_reminders ccr
LEFT JOIN customers c ON ccr.customer_id = c.id
WHERE c.id IS NULL;

-- Validate invoice references
WITH invalid_invoices AS (
  SELECT ccr.id, unnest(ccr.invoice_ids) as invoice_id
  FROM customer_consolidated_reminders ccr
),
missing_invoices AS (
  SELECT ii.id as consolidation_id, ii.invoice_id
  FROM invalid_invoices ii
  LEFT JOIN invoices i ON ii.invoice_id = i.id
  WHERE i.id IS NULL
)
SELECT
  'Invalid invoice references' as check_type,
  COUNT(*) as count
FROM missing_invoices;

-- Validate email log consolidation tracking
SELECT
  'Email logs with consolidation tracking' as metric,
  COUNT(*) FILTER (WHERE consolidated_reminder_id IS NOT NULL) as with_consolidation,
  COUNT(*) as total_emails,
  ROUND(
    COUNT(*) FILTER (WHERE consolidated_reminder_id IS NOT NULL)::DECIMAL / COUNT(*) * 100,
    2
  ) as percentage
FROM email_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
```

### Performance Testing Queries

```sql
-- Test consolidation queue performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM customer_consolidation_queue
WHERE company_id = 'test-company-id'
  AND can_contact = true
ORDER BY priority_level DESC, total_overdue DESC
LIMIT 50;

-- Test consolidation candidate lookup performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  c.id,
  COUNT(i.id) as invoice_count,
  SUM(i.amount) as total_amount
FROM customers c
JOIN invoices i ON c.id = i.customer_id
WHERE c.company_id = 'test-company-id'
  AND i.status = 'OVERDUE'
  AND i.is_active = true
GROUP BY c.id
HAVING COUNT(i.id) >= 2;

-- Test analytics query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  DATE_TRUNC('month', sent_at) as month,
  COUNT(*) as reminders_sent,
  AVG(invoice_count) as avg_invoices_per_reminder,
  SUM(invoice_count - 1) as emails_saved
FROM customer_consolidated_reminders
WHERE company_id = 'test-company-id'
  AND sent_at >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', sent_at)
ORDER BY month;
```

## Maintenance Procedures

### Regular Maintenance Tasks

```sql
-- Refresh materialized views (run daily)
REFRESH MATERIALIZED VIEW CONCURRENTLY customer_consolidation_queue;
REFRESH MATERIALIZED VIEW CONCURRENTLY consolidation_effectiveness_stats;

-- Cleanup old consolidation records (run weekly)
DELETE FROM customer_consolidated_reminders
WHERE created_at < CURRENT_DATE - INTERVAL '2 years'
  AND delivery_status IN ('SENT', 'DELIVERED', 'FAILED');

-- Update vacuum and analyze statistics (run weekly)
VACUUM ANALYZE customer_consolidated_reminders;
VACUUM ANALYZE email_logs;

-- Reindex for performance (run monthly)
REINDEX INDEX CONCURRENTLY idx_ccr_priority_queue;
REINDEX INDEX CONCURRENTLY idx_consolidation_queue_company_priority;
```

### Monitoring Queries

```sql
-- Monitor consolidation system health
SELECT
  'System Health Check' as metric,
  COUNT(*) FILTER (WHERE delivery_status = 'QUEUED') as queued_reminders,
  COUNT(*) FILTER (WHERE delivery_status = 'FAILED') as failed_reminders,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as todays_consolidations,
  AVG(invoice_count) as avg_invoices_per_consolidation
FROM customer_consolidated_reminders
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Monitor performance metrics
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE tablename = 'customer_consolidated_reminders'
  AND attname IN ('company_id', 'customer_id', 'priority_score', 'delivery_status');
```

---

**Document Version**: 1.0
**Last Updated**: September 19, 2025
**Next Review**: Sprint 1 Database Implementation