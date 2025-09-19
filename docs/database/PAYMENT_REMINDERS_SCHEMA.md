# Payment Reminders Database Schema

## Overview

This document details the database schema extensions required for implementing customer-consolidated payment reminders in the reminder-mvp application. The schema builds upon the existing contact management system while adding invoice tracking and automated reminder capabilities.

## Existing Schema Integration

### Current Tables (Utilized)
- **contacts**: Customer information and relationships
- **campaigns**: Email campaign tracking (extended for reminders)
- **templates**: Email templates (extended for reminder templates)
- **users**: User authentication and tenant isolation

## New Table Specifications

### 1. invoices
Primary table for tracking customer invoices and payment status.

```sql
CREATE TABLE invoices (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,

  -- Invoice details
  invoice_number VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'AED' CHECK (currency IN ('AED', 'USD', 'EUR', 'GBP')),
  tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),

  -- Dates and terms
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL CHECK (due_date >= issue_date),
  payment_terms INTEGER DEFAULT 30 CHECK (payment_terms > 0),

  -- Status and tracking
  status invoice_status DEFAULT 'pending',
  payment_date DATE,
  description TEXT,
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint for user-scoped invoice numbers
  UNIQUE(user_id, invoice_number)
);

-- Enum for invoice status
CREATE TYPE invoice_status AS ENUM (
  'pending',    -- Not yet due
  'overdue',    -- Past due date
  'paid',       -- Payment received
  'partial',    -- Partially paid
  'disputed',   -- Under dispute
  'cancelled',  -- Cancelled invoice
  'written_off' -- Bad debt write-off
);
```

### 2. reminder_schedules
Configuration table for automated reminder rules and escalation policies.

```sql
CREATE TABLE reminder_schedules (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Schedule configuration
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Trigger configuration
  trigger_days INTEGER[] DEFAULT '{7,14,30,60,90}' CHECK (array_length(trigger_days, 1) > 0),
  consolidate_by_customer BOOLEAN DEFAULT true,
  min_days_between_reminders INTEGER DEFAULT 7 CHECK (min_days_between_reminders > 0),
  max_reminders_per_invoice INTEGER DEFAULT 5 CHECK (max_reminders_per_invoice > 0),

  -- Template assignments
  polite_template_id UUID REFERENCES templates(id),
  standard_template_id UUID REFERENCES templates(id),
  urgent_template_id UUID REFERENCES templates(id),
  final_template_id UUID REFERENCES templates(id),

  -- Business rules
  exclude_disputed BOOLEAN DEFAULT true,
  exclude_partial BOOLEAN DEFAULT false,
  minimum_amount DECIMAL(10,2) DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. customer_reminders
History table tracking all reminder communications sent to customers.

```sql
CREATE TABLE customer_reminders (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  schedule_id UUID REFERENCES reminder_schedules(id) ON DELETE SET NULL,

  -- Reminder content
  invoice_ids UUID[] NOT NULL CHECK (array_length(invoice_ids, 1) > 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  currency VARCHAR(3) DEFAULT 'AED',
  reminder_type reminder_type DEFAULT 'standard',

  -- Email tracking
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  template_id UUID REFERENCES templates(id),

  -- Delivery tracking
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_status email_delivery_status DEFAULT 'sent',
  delivery_id VARCHAR(255), -- External email service ID

  -- Response tracking
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  payment_received_at TIMESTAMP WITH TIME ZONE,

  -- Additional metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enums for reminder tracking
CREATE TYPE reminder_type AS ENUM ('polite', 'standard', 'urgent', 'final', 'manual');
CREATE TYPE email_delivery_status AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
```

### 4. invoice_payments
Track payment history for partial and multiple payments.

```sql
CREATE TABLE invoice_payments (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,

  -- Payment details
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'AED',
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),

  -- Status and notes
  status payment_status DEFAULT 'confirmed',
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
```

## Performance Indexes

### Primary Performance Indexes
```sql
-- Invoice queries
CREATE INDEX idx_invoices_user_status ON invoices(user_id, status) WHERE status IN ('pending', 'overdue');
CREATE INDEX idx_invoices_contact_due ON invoices(contact_id, due_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status = 'overdue';
CREATE INDEX idx_invoices_user_number ON invoices(user_id, invoice_number);

-- Reminder queries
CREATE INDEX idx_customer_reminders_contact_sent ON customer_reminders(contact_id, sent_at DESC);
CREATE INDEX idx_customer_reminders_user_date ON customer_reminders(user_id, sent_at);
CREATE INDEX idx_customer_reminders_invoice_ids ON customer_reminders USING GIN(invoice_ids);

-- Schedule queries
CREATE INDEX idx_reminder_schedules_user_active ON reminder_schedules(user_id, is_active);

-- Payment tracking
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id, payment_date DESC);
```

### Composite Indexes for Complex Queries
```sql
-- Overdue invoice consolidation query
CREATE INDEX idx_invoices_consolidation ON invoices(user_id, contact_id, status, due_date)
WHERE status = 'overdue';

-- Last contact lookup
CREATE INDEX idx_customer_reminders_last_contact ON customer_reminders(user_id, contact_id, sent_at DESC);

-- Reminder effectiveness analytics
CREATE INDEX idx_customer_reminders_analytics ON customer_reminders(user_id, sent_at, email_status, payment_received_at);
```

## Materialized Views

### customer_reminder_queue
Optimized view for the main reminder dashboard.

```sql
CREATE MATERIALIZED VIEW customer_reminder_queue AS
SELECT
  c.id as contact_id,
  c.user_id,
  c.name as contact_name,
  c.email,
  c.company,

  -- Invoice aggregations
  COUNT(i.id) as overdue_count,
  SUM(i.amount) as total_overdue,
  MIN(i.due_date) as earliest_due_date,
  MAX(CURRENT_DATE - i.due_date) as max_days_overdue,

  -- Last contact information
  MAX(cr.sent_at) as last_reminder_sent,
  COUNT(cr.id) as total_reminders_sent,

  -- Priority calculation
  CASE
    WHEN MAX(CURRENT_DATE - i.due_date) > 90 THEN 'high'
    WHEN MAX(CURRENT_DATE - i.due_date) > 30 THEN 'medium'
    ELSE 'low'
  END as priority,

  -- Eligibility for new reminder
  CASE
    WHEN MAX(cr.sent_at) IS NULL THEN true
    WHEN MAX(cr.sent_at) < CURRENT_DATE - INTERVAL '7 days' THEN true
    ELSE false
  END as eligible_for_reminder,

  NOW() as refreshed_at

FROM contacts c
JOIN invoices i ON c.id = i.contact_id
LEFT JOIN customer_reminders cr ON c.id = cr.contact_id
WHERE i.status = 'overdue'
  AND i.amount > 0
GROUP BY c.id, c.user_id, c.name, c.email, c.company
HAVING COUNT(i.id) > 0;

-- Refresh index for materialized view
CREATE UNIQUE INDEX idx_customer_reminder_queue_contact ON customer_reminder_queue(contact_id);
CREATE INDEX idx_customer_reminder_queue_user_priority ON customer_reminder_queue(user_id, priority, eligible_for_reminder);
```

### reminder_effectiveness_stats
Analytics view for measuring reminder success.

```sql
CREATE MATERIALIZED VIEW reminder_effectiveness_stats AS
SELECT
  cr.user_id,
  DATE_TRUNC('month', cr.sent_at) as month,
  cr.reminder_type,

  -- Volume metrics
  COUNT(*) as reminders_sent,
  COUNT(DISTINCT cr.contact_id) as unique_customers,
  AVG(cr.total_amount) as avg_reminder_amount,

  -- Engagement metrics
  COUNT(*) FILTER (WHERE cr.opened_at IS NOT NULL) as opened_count,
  COUNT(*) FILTER (WHERE cr.clicked_at IS NOT NULL) as clicked_count,
  COUNT(*) FILTER (WHERE cr.responded_at IS NOT NULL) as responded_count,

  -- Payment metrics
  COUNT(*) FILTER (WHERE cr.payment_received_at IS NOT NULL) as payment_count,
  SUM(cr.total_amount) FILTER (WHERE cr.payment_received_at IS NOT NULL) as payment_amount,

  -- Timing metrics
  AVG(EXTRACT(days FROM cr.payment_received_at - cr.sent_at)) as avg_payment_days,

  NOW() as refreshed_at

FROM customer_reminders cr
WHERE cr.sent_at >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY cr.user_id, DATE_TRUNC('month', cr.sent_at), cr.reminder_type;

CREATE INDEX idx_reminder_effectiveness_user_month ON reminder_effectiveness_stats(user_id, month DESC);
```

## Row Level Security (RLS) Policies

### invoices table policies
```sql
-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can only access their own invoices
CREATE POLICY invoices_user_isolation ON invoices
  FOR ALL
  USING (auth.uid() = user_id);

-- Service role can access all (for automated processes)
CREATE POLICY invoices_service_access ON invoices
  FOR ALL
  TO service_role
  USING (true);
```

### customer_reminders table policies
```sql
ALTER TABLE customer_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_reminders_user_isolation ON customer_reminders
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY customer_reminders_service_access ON customer_reminders
  FOR ALL
  TO service_role
  USING (true);
```

### reminder_schedules table policies
```sql
ALTER TABLE reminder_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminder_schedules_user_isolation ON reminder_schedules
  FOR ALL
  USING (auth.uid() = user_id);
```

### invoice_payments table policies
```sql
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_payments_user_isolation ON invoice_payments
  FOR ALL
  USING (auth.uid() = user_id);
```

## Functions and Triggers

### Update invoice status based on payments
```sql
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total DECIMAL(12,2);
  payments_total DECIMAL(12,2);
BEGIN
  -- Get invoice total
  SELECT amount INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;

  -- Get total payments for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO payments_total
  FROM invoice_payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'confirmed';

  -- Update invoice status based on payment amount
  UPDATE invoices
  SET
    status = CASE
      WHEN payments_total >= invoice_total THEN 'paid'
      WHEN payments_total > 0 THEN 'partial'
      WHEN CURRENT_DATE > due_date THEN 'overdue'
      ELSE 'pending'
    END,
    payment_date = CASE
      WHEN payments_total >= invoice_total THEN NEW.payment_date
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_status();
```

### Auto-refresh materialized views
```sql
CREATE OR REPLACE FUNCTION refresh_reminder_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_reminder_queue;
  REFRESH MATERIALIZED VIEW CONCURRENTLY reminder_effectiveness_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule hourly refresh (would be set up in cron or scheduled job)
```

### Calculate days overdue
```sql
CREATE OR REPLACE FUNCTION calculate_days_overdue(due_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(0, CURRENT_DATE - due_date);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

## Migration Strategy

### Migration Order
1. **Create types**: Execute all CREATE TYPE statements
2. **Create tables**: Execute table creation in dependency order
3. **Create indexes**: Add all performance indexes
4. **Create views**: Create materialized views
5. **Enable RLS**: Apply row level security policies
6. **Create functions**: Add business logic functions
7. **Create triggers**: Set up automated processing

### Rollback Procedures
```sql
-- Drop in reverse order
DROP TRIGGER IF EXISTS trigger_update_invoice_status ON invoice_payments;
DROP FUNCTION IF EXISTS update_invoice_status();
DROP FUNCTION IF EXISTS refresh_reminder_views();
DROP FUNCTION IF EXISTS calculate_days_overdue(DATE);

DROP MATERIALIZED VIEW IF EXISTS reminder_effectiveness_stats;
DROP MATERIALIZED VIEW IF EXISTS customer_reminder_queue;

DROP TABLE IF EXISTS invoice_payments;
DROP TABLE IF EXISTS customer_reminders;
DROP TABLE IF EXISTS reminder_schedules;
DROP TABLE IF EXISTS invoices;

DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS email_delivery_status;
DROP TYPE IF EXISTS reminder_type;
DROP TYPE IF EXISTS invoice_status;
```

### Data Validation Queries
```sql
-- Verify invoice totals
SELECT COUNT(*) as total_invoices,
       COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
       SUM(amount) as total_amount
FROM invoices;

-- Verify reminder consolidation
SELECT contact_id,
       COUNT(DISTINCT id) as reminder_count,
       COUNT(*) as total_invoice_refs
FROM customer_reminders cr
CROSS JOIN UNNEST(cr.invoice_ids) as invoice_id
GROUP BY contact_id
HAVING COUNT(DISTINCT id) > 1;

-- Verify no orphaned references
SELECT COUNT(*) FROM invoices i
LEFT JOIN contacts c ON i.contact_id = c.id
WHERE c.id IS NULL;
```

## Performance Considerations

### Expected Query Patterns
1. **Daily reminder queue**: Query overdue invoices grouped by customer
2. **Customer history**: Retrieve all reminders sent to specific customer
3. **Analytics aggregation**: Monthly/quarterly reminder effectiveness
4. **Invoice lookup**: Find invoices by number or customer

### Scaling Recommendations
- **Partitioning**: Consider partitioning large tables by user_id or date
- **Archiving**: Archive old reminders (>2 years) to separate tables
- **Caching**: Cache frequently accessed reminder queue data
- **Monitoring**: Monitor slow queries and add indexes as needed

### Resource Usage Estimates
- **Storage**: ~1KB per invoice, ~2KB per reminder
- **Query performance**: <100ms for typical dashboard queries
- **Index overhead**: ~20% additional storage for indexes
- **View refresh**: ~30 seconds for 10,000 invoices

---

**Document Version**: 1.0
**Last Updated**: September 19, 2025
**Next Review**: Post-Migration Deployment