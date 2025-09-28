# 🏗️ Unified Database Schema Design
## Reminder + SendAChaser Platform Integration

**Purpose**: Design comprehensive database schema for merging Reminder (invoice management) + SendAChaser (email automation) into unified invoice chasing platform.

**Architecture**: Reminder as primary platform + integrated SendAChaser email automation components
**Target**: Support POP Trading workflow (400+ invoices/season → 10-minute automated process)

---

## 📊 SCHEMA INTEGRATION STRATEGY

### Core Principles
1. **Reminder Foundation**: Keep existing production-ready multi-tenant architecture
2. **SendAChaser Enhancement**: Add email automation capabilities as extensions
3. **Data Consistency**: Maintain company-scoped isolation across all tables
4. **UAE Compliance**: Preserve bilingual support and business compliance features
5. **Performance**: Design for 400+ invoice batch processing with real-time tracking

### Integration Approach
```sql
-- EXISTING REMINDER TABLES: Enhanced with new relationships
-- NEW SENDACHASER TABLES: Adapted to Reminder's multi-tenant model
-- UNIFIED WORKFLOW: invoices → invoice_campaigns → bulk_email_sends → tracking
```

---

## 🆕 NEW TABLES (SendAChaser Integration)

### 1. Email Provider Management
```sql
CREATE TABLE email_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Provider Configuration
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gmail', 'outlook', 'smtp')),
  provider_email TEXT NOT NULL,
  provider_name TEXT, -- Display name for the email account

  -- OAuth Token Management
  access_token TEXT, -- Encrypted at application level
  refresh_token TEXT, -- Encrypted at application level
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT, -- OAuth scopes granted

  -- Connection Status
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- Primary provider for company
  last_validated_at TIMESTAMP WITH TIME ZONE,
  validation_error TEXT, -- Last validation error message

  -- Rate Limiting & Quotas
  daily_quota INTEGER DEFAULT 500, -- Daily sending limit
  daily_sent_count INTEGER DEFAULT 0,
  quota_reset_date DATE DEFAULT CURRENT_DATE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(company_id, provider_email),

  -- Indexes
  INDEX idx_email_providers_company (company_id, is_active),
  INDEX idx_email_providers_primary (company_id, is_primary) WHERE is_primary = true,
  INDEX idx_email_providers_quota (quota_reset_date, daily_sent_count)
);
```

### 2. Invoice Campaign Management
```sql
CREATE TABLE invoice_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Campaign Configuration
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT DEFAULT 'invoice_reminder' CHECK (
    campaign_type IN ('invoice_reminder', 'payment_follow_up', 'overdue_notice', 'bulk_reminder')
  ),

  -- Invoice Association
  invoice_ids UUID[] NOT NULL, -- Array of invoice IDs
  invoice_count INTEGER GENERATED ALWAYS AS (array_length(invoice_ids, 1)) STORED,
  total_amount DECIMAL(12, 2), -- Total amount across all invoices
  currency TEXT DEFAULT 'AED',

  -- Template & Content
  template_id UUID REFERENCES email_templates(id),
  subject_template TEXT,
  body_template TEXT,
  merge_tags JSON DEFAULT '{}', -- Available merge tags for this campaign

  -- Sending Configuration
  email_provider_id UUID REFERENCES email_providers(id),
  sender_name TEXT,
  sender_email TEXT,
  reply_to_email TEXT,

  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE,
  send_immediately BOOLEAN DEFAULT false,
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
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  processing_metadata JSON DEFAULT '{}',

  -- Analytics
  open_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE WHEN sent_count > 0 THEN (opened_count::DECIMAL / sent_count * 100) ELSE 0 END
  ) STORED,
  click_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE WHEN sent_count > 0 THEN (clicked_count::DECIMAL / sent_count * 100) ELSE 0 END
  ) STORED,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints & Validation
  CHECK (invoice_count > 0),
  CHECK (total_recipients >= 0),
  CHECK (sent_count <= total_recipients),

  -- Indexes
  INDEX idx_invoice_campaigns_company (company_id, status, created_at),
  INDEX idx_invoice_campaigns_status (status, processing_started_at),
  INDEX idx_invoice_campaigns_provider (email_provider_id, status),
  INDEX idx_invoice_campaigns_scheduled (scheduled_for, status) WHERE status = 'scheduled',
  INDEX idx_invoice_campaigns_invoices USING GIN (invoice_ids)
);
```

### 3. Campaign Email Sends (Individual Email Tracking)
```sql
CREATE TABLE campaign_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES invoice_campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Recipient Information
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id), -- Primary invoice for this send

  -- Email Content (Personalized)
  personalized_subject TEXT NOT NULL,
  personalized_body TEXT NOT NULL,
  merge_data JSON DEFAULT '{}', -- Merge tag values used for personalization

  -- Sending Details
  email_provider_id UUID REFERENCES email_providers(id),
  sender_email TEXT,
  sender_name TEXT,

  -- Delivery Status
  status TEXT DEFAULT 'queued' CHECK (
    status IN ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'suppressed')
  ),

  -- External IDs & Tracking
  provider_message_id TEXT, -- Gmail/Outlook message ID
  aws_message_id TEXT, -- If using AWS SES
  tracking_pixel_id UUID DEFAULT gen_random_uuid(),

  -- Timestamps
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,

  -- Error Handling
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  bounce_reason TEXT,
  bounce_type TEXT, -- hard, soft, complaint

  -- Engagement Tracking
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT, -- Browser/client info
  ip_address INET, -- For geolocation analytics

  -- Suppression
  is_suppressed BOOLEAN DEFAULT false,
  suppression_reason TEXT,
  suppressed_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (attempt_count <= max_attempts),
  CHECK (open_count >= 0),
  CHECK (click_count >= 0),

  -- Indexes
  INDEX idx_campaign_sends_campaign (campaign_id, status),
  INDEX idx_campaign_sends_recipient (recipient_email, company_id),
  INDEX idx_campaign_sends_status (status, queued_at),
  INDEX idx_campaign_sends_customer (customer_id, sent_at),
  INDEX idx_campaign_sends_invoice (invoice_id, status),
  INDEX idx_campaign_sends_tracking (tracking_pixel_id),
  INDEX idx_campaign_sends_provider_msg (provider_message_id),

  -- Composite indexes for analytics
  INDEX idx_campaign_sends_engagement (campaign_id, opened_at, clicked_at),
  INDEX idx_campaign_sends_timeline (company_id, sent_at, status)
);
```

### 4. Email Event Tracking (Webhooks & Analytics)
```sql
CREATE TABLE email_event_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_send_id UUID NOT NULL REFERENCES campaign_email_sends(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES invoice_campaigns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL CHECK (
    event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed')
  ),
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Event Source
  source TEXT DEFAULT 'webhook' CHECK (source IN ('webhook', 'pixel', 'manual', 'api')),
  provider_event_id TEXT, -- External event ID from email provider

  -- Event Data
  event_data JSON DEFAULT '{}', -- Raw event data from provider
  user_agent TEXT,
  ip_address INET,
  device_type TEXT, -- mobile, desktop, tablet
  email_client TEXT, -- gmail, outlook, apple_mail, etc.

  -- Link Tracking (for click events)
  clicked_url TEXT,
  link_position INTEGER, -- Position of link in email

  -- Geographic Data
  country_code TEXT,
  city TEXT,
  timezone TEXT,

  -- Processing Status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_email_events_send (campaign_send_id, event_type, event_timestamp),
  INDEX idx_email_events_campaign (campaign_id, event_type, event_timestamp),
  INDEX idx_email_events_company (company_id, event_timestamp),
  INDEX idx_email_events_type (event_type, event_timestamp),
  INDEX idx_email_events_processing (processed, created_at) WHERE NOT processed,

  -- Analytics indexes
  INDEX idx_email_events_analytics (campaign_id, event_type, device_type, email_client)
);
```

### 5. Campaign Templates (Enhanced Email Templates)
```sql
CREATE TABLE campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Template Identification
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'invoice_reminder' CHECK (
    category IN ('invoice_reminder', 'payment_follow_up', 'overdue_notice', 'welcome', 'system')
  ),

  -- Template Content
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  body_format TEXT DEFAULT 'html' CHECK (body_format IN ('html', 'text', 'both')),

  -- Merge Tag Configuration
  available_merge_tags JSON DEFAULT '[]', -- Array of available merge tags
  required_merge_tags JSON DEFAULT '[]', -- Required merge tags for validation
  sample_merge_data JSON DEFAULT '{}', -- Sample data for preview

  -- Template Settings
  supports_bulk_campaigns BOOLEAN DEFAULT true,
  supports_individual_sends BOOLEAN DEFAULT true,
  max_invoice_count INTEGER, -- Max invoices per campaign for this template

  -- Localization (UAE Support)
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  subject_template_ar TEXT, -- Arabic subject template
  body_template_ar TEXT, -- Arabic body template

  -- Usage & Analytics
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  average_open_rate DECIMAL(5, 2),
  average_click_rate DECIMAL(5, 2),

  -- Template Versioning
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES campaign_templates(id),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Template Source
  source TEXT DEFAULT 'custom' CHECK (source IN ('custom', 'system', 'imported')),
  imported_from TEXT, -- Source system if imported

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(company_id, name, version),
  CHECK (version > 0),

  -- Indexes
  INDEX idx_campaign_templates_company (company_id, is_active, category),
  INDEX idx_campaign_templates_usage (usage_count, last_used_at),
  INDEX idx_campaign_templates_default (company_id, is_default, category) WHERE is_default = true,
  INDEX idx_campaign_templates_parent (parent_template_id, version)
);
```

---

## 🔄 ENHANCED EXISTING TABLES

### 1. Enhanced Customers Table
```sql
-- Add SendAChaser contact capabilities to existing customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_fields JSON DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'invoice' CHECK (source IN ('invoice', 'import', 'manual', 'api'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_marketing_consent BOOLEAN DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_bounce_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_email_suppressed BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_suppression_reason TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_customers_tags USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customers_custom_fields USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_customers_email_marketing (company_id, email_marketing_consent, is_email_suppressed);
CREATE INDEX IF NOT EXISTS idx_customers_bounce_tracking (email_bounce_count, is_email_suppressed);
```

### 2. Enhanced Email Templates Table
```sql
-- Add campaign capabilities to existing email_templates
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS supports_bulk_campaigns BOOLEAN DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS max_invoice_count INTEGER DEFAULT 1;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS available_merge_tags JSON DEFAULT '[]';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'FOLLOW_UP';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Update existing enum to include campaign types
-- Note: This would need to be done via migration in Prisma
```

### 3. Enhanced Email Logs Table
```sql
-- Link existing email logs to new campaign system
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES invoice_campaigns(id);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS campaign_send_id UUID REFERENCES campaign_email_sends(id);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS merge_data JSON DEFAULT '{}';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS tracking_pixel_id UUID;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Add indexes for campaign linking
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign (campaign_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign_send (campaign_send_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_tracking (tracking_pixel_id);
```

---

## 🔗 RELATIONSHIP MAPPING

### Core Workflow Relationships
```sql
-- Invoice to Campaign Flow
invoices (1 to many) → invoice_campaigns → campaign_email_sends → email_event_tracking

-- Customer Contact Integration
customers (enhanced) ← campaign_email_sends → email_providers

-- Template System Integration
campaign_templates → invoice_campaigns → campaign_email_sends

-- Multi-tenant Isolation (ALL tables)
companies (1 to many) → ALL_TABLES (via company_id foreign key)
```

### Critical Foreign Key Relationships
```sql
-- Campaign Management
invoice_campaigns.company_id → companies.id
invoice_campaigns.template_id → campaign_templates.id
invoice_campaigns.email_provider_id → email_providers.id
invoice_campaigns.created_by → users.id

-- Email Sending Chain
campaign_email_sends.campaign_id → invoice_campaigns.id
campaign_email_sends.customer_id → customers.id
campaign_email_sends.invoice_id → invoices.id
email_event_tracking.campaign_send_id → campaign_email_sends.id

-- Provider Integration
email_providers.company_id → companies.id
email_providers.created_by → users.id
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Strategic Indexes
```sql
-- Campaign Performance
CREATE INDEX idx_active_campaigns ON invoice_campaigns (company_id, status, scheduled_for)
  WHERE status IN ('scheduled', 'sending');

-- Email Sending Queue
CREATE INDEX idx_email_send_queue ON campaign_email_sends (status, queued_at)
  WHERE status IN ('queued', 'sending');

-- Analytics Queries
CREATE INDEX idx_campaign_analytics ON campaign_email_sends (campaign_id, status, sent_at, opened_at);

-- Customer Email History
CREATE INDEX idx_customer_email_history ON campaign_email_sends (customer_id, sent_at DESC);

-- Provider Usage Tracking
CREATE INDEX idx_provider_quota ON email_providers (company_id, quota_reset_date, daily_sent_count);
```

### Partitioning Strategy
```sql
-- Consider partitioning for high-volume tables
-- email_event_tracking: Partition by month (event_timestamp)
-- campaign_email_sends: Partition by quarter (created_at)
```

---

## 🛡️ SECURITY & COMPLIANCE

### Data Encryption
```sql
-- Sensitive fields requiring application-level encryption:
-- email_providers.access_token
-- email_providers.refresh_token

-- UAE Compliance: Audit trail for all campaign activities
-- Use existing audit_logs table with enhanced entity types
```

### Row Level Security (Future Enhancement)
```sql
-- Postgres RLS policies for additional security
CREATE POLICY campaign_company_isolation ON invoice_campaigns
  FOR ALL TO authenticated
  USING (company_id = current_setting('app.current_company_id'));
```

---

## 🎯 MIGRATION STRATEGY

### Phase 1: Core Tables
1. Create `email_providers` table
2. Create `invoice_campaigns` table
3. Create `campaign_email_sends` table
4. Enhance existing `customers` table

### Phase 2: Advanced Features
1. Create `email_event_tracking` table
2. Create `campaign_templates` table
3. Enhance existing `email_templates` and `email_logs`

### Phase 3: Data Migration
1. Migrate SendAChaser `contacts` → enhanced `customers`
2. Migrate SendAChaser `templates` → `campaign_templates`
3. Set up OAuth provider connections
4. Test end-to-end invoice → campaign workflow

---

## 📊 SUCCESS METRICS

### Database Performance Targets
- **Campaign Creation**: < 2 seconds for 400 invoices
- **Email Queue Processing**: 5 emails/batch with 3-second delays
- **Real-time Analytics**: < 1 second dashboard load
- **Multi-tenant Isolation**: 100% data separation validation

### Workflow Validation
- **POP Trading Test**: Process 400+ Working Title invoices
- **Email Delivery**: >95% delivery rate to validated addresses
- **Tracking Accuracy**: 100% open/click event capture
- **Error Recovery**: Graceful handling of provider failures

This unified schema design enables the **2.5 hours → 10 minutes** workflow transformation while maintaining Reminder's production-grade foundation and adding SendAChaser's powerful email automation capabilities! 🚀