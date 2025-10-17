# Bucket System → Email Sending MVP Implementation Plan

**Date**: 2025-10-01
**Project**: Reminder MVP - Invoice Management Platform
**Status**: Planning Phase

## 🎯 Goal
Connect existing bucket system infrastructure to email campaign creation/sending to enable manual and automated invoice reminder workflows.

---

## 📊 Current State Analysis

### ✅ Already Built (Discovered in Codebase)

**Bucket System Infrastructure:**
- `/src/app/api/invoices/buckets/route.ts` - API with 6 predefined time-based buckets
  - Not Due (min: -999, max: 0)
  - 1-3 Days Overdue (min: 1, max: 3)
  - 4-7 Days Overdue (min: 4, max: 7)
  - 8-14 Days Overdue (min: 8, max: 14)
  - 15-30 Days Overdue (min: 15, max: 30)
  - 30+ Days Overdue (min: 31, max: null)
- `/src/components/invoices/invoice-bucket-dashboard.tsx` - Dashboard UI with summary stats
- `/src/components/invoices/bucket-card.tsx` - Individual bucket cards with quick action buttons
- `/src/components/invoices/bucket-detail-view.tsx` - Detailed view with invoice selection capability
- `/src/hooks/use-invoice-buckets.ts` - Data fetching hook with auto-refresh

**Email Campaign System:**
- `/src/lib/services/unifiedEmailService.ts` - AWS SES integration (ME-South region)
- `/src/lib/services/consolidated-email-service.ts` - Customer consolidation (68% email reduction)
- `/src/app/api/campaigns/from-invoices/route.ts` - Campaign creation accepting invoice IDs
- `/src/app/api/campaigns/[id]/send/route.ts` - Campaign sending with batch processing
- Merge tag processing: {{customer_name}}, {{invoice_number}}, {{amount}}, etc.

**Core Platform:**
- Multi-tenant architecture with company_id isolation
- Authentication flow with NextAuth.js v4
- Invoice import (CSV/Excel + PDF with 93% accuracy)
- Dashboard with real-time KPIs
- PostgreSQL via Supabase with Prisma ORM

### ❌ Missing for MVP Completion

1. **Email Template System**
   - Database table to store email templates
   - Template creation/editing UI interface
   - Template-to-bucket association logic
   - Merge tag insertion and preview capability

2. **Bucket Configuration**
   - Database table for bucket settings
   - Auto-send toggle per bucket
   - Template selection per bucket
   - Configuration persistence

3. **Bucket → Campaign Integration**
   - Wire "Email Selected" button to campaign creation
   - Pass selected invoice IDs + bucket template to API
   - Template merge with actual invoice data
   - Confirmation dialog with preview

4. **Auto-Send Scheduler**
   - Scheduled job to check auto-send enabled buckets
   - Automatic campaign creation for eligible invoices
   - Business hours respect (UAE timezone)
   - AWS SES daily limit management

5. **Progressive Escalation Templates**
   - 5 default templates with escalating tone/urgency
   - Arabic and English variants for each template
   - Merge tag support for all invoice/customer fields
   - Cultural appropriateness for UAE business context

---

## 📋 Implementation Phases

### Phase 1: Database Schema Extensions
**Estimated Time**: 1-2 hours

**Tasks:**
1. Add `EmailTemplate` table to Prisma schema
   ```prisma
   model EmailTemplate {
     id          String   @id @default(uuid())
     company_id  String
     name        String
     subject     String
     content     String   @db.Text
     language    Language @default(ENGLISH)
     bucket_id   String?  // Optional: link to specific bucket
     is_active   Boolean  @default(true)
     created_at  DateTime @default(now())
     updated_at  DateTime @updatedAt

     company     companies @relation(fields: [company_id], references: [id])
   }
   ```

2. Add `BucketConfig` table
   ```prisma
   model BucketConfig {
     id                String   @id @default(uuid())
     company_id        String
     bucket_id         String   // 'not_due', 'overdue_1_3', etc.
     auto_send_enabled Boolean  @default(false)
     template_id       String?
     created_at        DateTime @default(now())
     updated_at        DateTime @updatedAt

     company     companies      @relation(fields: [company_id], references: [id])
     template    EmailTemplate? @relation(fields: [template_id], references: [id])

     @@unique([company_id, bucket_id])
   }
   ```

3. Create and run migrations
   ```bash
   npx prisma migrate dev --name add_email_templates_and_bucket_config
   npx prisma generate
   ```

4. Seed database with 5 progressive escalation templates
   - Template 1 (Not Due): Friendly reminder
   - Template 2 (1-7 Days): Polite follow-up
   - Template 3 (8-14 Days): Firm reminder
   - Template 4 (15-30 Days): Urgent notice
   - Template 5 (30+ Days): Final notice before escalation

**Deliverables:**
- Updated Prisma schema
- Migration files
- Seed script with default templates

---

### Phase 2: Template Management UI
**Estimated Time**: 3-4 hours

**Tasks:**
1. Create `/src/app/[locale]/dashboard/templates/page.tsx`
   - List all templates with filters (language, bucket)
   - Create/Edit/Delete actions
   - Preview functionality

2. Create `/src/components/templates/template-editor.tsx`
   - Rich text editor or textarea with formatting
   - Merge tag insertion toolbar
   - Language toggle (English/Arabic)
   - Subject and content fields
   - Bucket assignment dropdown

3. Create `/src/components/templates/merge-tag-selector.tsx`
   - Dropdown showing available merge tags
   - Categorized by source (invoice, customer, company)
   - Click to insert at cursor position

4. Create `/src/components/templates/template-preview.tsx`
   - Real-time preview with sample data
   - Shows how merge tags will render
   - Toggle between English/Arabic preview

5. Create API endpoints
   - `POST /api/templates` - Create template
   - `GET /api/templates` - List templates (company-scoped)
   - `PUT /api/templates/[id]` - Update template
   - `DELETE /api/templates/[id]` - Delete template

**Deliverables:**
- Template management page
- Template editor component
- Merge tag selector component
- Preview component
- CRUD API endpoints

---

### Phase 3: Bucket Configuration UI
**Estimated Time**: 2-3 hours

**Tasks:**
1. Update `/src/components/invoices/bucket-card.tsx`
   - Add "Settings" button/icon to bucket card
   - Open configuration modal on click

2. Create `/src/components/invoices/bucket-settings-modal.tsx`
   - Auto-send toggle switch
   - Template selection dropdown (filtered by bucket or company)
   - Save button to persist configuration
   - Show current configuration status

3. Create API endpoints
   - `GET /api/buckets/config` - Get all bucket configs for company
   - `PUT /api/buckets/config/[bucket_id]` - Update bucket config
   - `POST /api/buckets/config` - Create bucket config

4. Update `/src/hooks/use-invoice-buckets.ts`
   - Include bucket configuration in query
   - Show auto-send status on bucket cards

**Deliverables:**
- Bucket settings modal component
- Updated bucket card with settings button
- Bucket configuration API endpoints
- Updated hook to fetch configurations

---

### Phase 4: Manual Send Integration
**Estimated Time**: 2-3 hours

**Tasks:**
1. Update `/src/components/invoices/bucket-detail-view.tsx`
   - Wire "Email Selected Invoices" button to campaign creation
   - Get bucket's assigned template
   - Validate at least one invoice selected

2. Create `/src/components/campaigns/campaign-confirmation-dialog.tsx`
   - Show selected invoice count
   - Display template preview with actual data
   - Customer consolidation summary
   - "Send Now" vs "Save Draft" options

3. Create workflow logic
   - Get selected invoice IDs from bucket detail view
   - Fetch bucket's assigned template
   - Merge template with invoice data
   - Call `/api/campaigns/from-invoices` with:
     - `invoiceIds`: selected invoices
     - `templateId`: bucket's template
     - `campaignName`: auto-generated from bucket name
     - `sendingOptions`: immediate or scheduled

4. Navigation flow
   - After campaign creation, navigate to campaign detail page
   - Show success toast with campaign ID
   - Clear selection after successful creation

**Deliverables:**
- Updated bucket detail view with wired button
- Campaign confirmation dialog
- Integration logic connecting buckets → campaigns
- Success/error handling

---

### Phase 5: Auto-Send Scheduler
**Estimated Time**: 3-4 hours

**Tasks:**
1. Create `/src/app/api/cron/auto-send-reminders/route.ts`
   - Query all companies
   - For each company, get bucket configs where auto_send_enabled = true
   - For each enabled bucket:
     - Get eligible invoices (unpaid, in bucket's day range)
     - Get bucket's assigned template
     - Create campaign via internal API call
     - Send immediately or schedule based on business hours

2. Business logic
   - Respect UAE business hours (9 AM - 6 PM GST)
   - Check AWS SES daily sending limits
   - Handle customer consolidation (group by customer)
   - Skip invoices already in active campaigns
   - Log all auto-send activities to Activity table

3. Scheduling configuration
   - Set up Vercel Cron job in `vercel.json`:
     ```json
     {
       "crons": [{
         "path": "/api/cron/auto-send-reminders",
         "schedule": "0 9 * * *"
       }]
     }
     ```
   - Or use alternative: AWS EventBridge, GitHub Actions, or cron-job.org

4. Safety measures
   - Rate limiting to prevent email spam
   - Maximum emails per company per day
   - Dry-run mode for testing
   - Detailed logging for debugging

**Deliverables:**
- Auto-send cron API endpoint
- Business hours and limit checking logic
- Scheduling configuration
- Activity logging
- Safety mechanisms

---

### Phase 6: Testing & Refinement
**Estimated Time**: 2-3 hours

**Test Scenarios:**

1. **Template Management**
   - ✅ Create new template with merge tags
   - ✅ Edit existing template
   - ✅ Preview template with sample data
   - ✅ Delete unused template
   - ✅ Switch language (English/Arabic)

2. **Bucket Configuration**
   - ✅ Enable auto-send for bucket
   - ✅ Assign template to bucket
   - ✅ Disable auto-send for bucket
   - ✅ View configuration status on bucket card

3. **Manual Send Workflow**
   - ✅ Select invoices in bucket detail view
   - ✅ Click "Email Selected Invoices"
   - ✅ Preview campaign with actual invoice data
   - ✅ Confirm and send
   - ✅ Navigate to campaign page
   - ✅ Verify emails sent via AWS SES

4. **Auto-Send Workflow**
   - ✅ Enable auto-send for test bucket
   - ✅ Trigger cron job manually
   - ✅ Verify campaigns created for eligible invoices
   - ✅ Verify emails respect business hours
   - ✅ Check activity logs for auto-send records

5. **Merge Tags**
   - ✅ {{customer_name}} renders correctly
   - ✅ {{invoice_number}} renders correctly
   - ✅ {{amount}} formats with AED currency
   - ✅ {{days_overdue}} calculates correctly
   - ✅ {{due_date}} formats with UAE locale

6. **Progressive Escalation**
   - ✅ Not Due bucket uses friendly template
   - ✅ 1-3 Days uses polite follow-up
   - ✅ 4-7 Days uses firm reminder
   - ✅ 8-14 Days uses urgent notice
   - ✅ 15-30 Days uses serious warning
   - ✅ 30+ Days uses final notice

**Deliverables:**
- Test scenarios documented
- All tests passing
- Bug fixes for discovered issues
- Performance optimization if needed

---

## ⏱️ Timeline Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Database Schema | 1-2 hours |
| Phase 2 | Template Management UI | 3-4 hours |
| Phase 3 | Bucket Configuration | 2-3 hours |
| Phase 4 | Manual Send Integration | 2-3 hours |
| Phase 5 | Auto-Send Scheduler | 3-4 hours |
| Phase 6 | Testing & Refinement | 2-3 hours |
| **Total** | **All Phases** | **13-19 hours** |

**Expected Duration**: 2-3 days of focused development

---

## 🚀 Acceptance Criteria

### Must Have (MVP)
1. ✅ User can create/edit email templates with merge tags
2. ✅ User can assign templates to buckets
3. ✅ User can toggle auto-send per bucket
4. ✅ User can select invoices in bucket detail view and send emails manually
5. ✅ Auto-send creates and sends campaigns daily for enabled buckets
6. ✅ Progressive escalation: templates get firmer as overdue days increase
7. ✅ All emails respect UAE business hours and AWS SES limits
8. ✅ Customer consolidation works (multiple invoices → single email per customer)
9. ✅ Merge tags render correctly with invoice/customer data
10. ✅ Activity logging tracks all auto-send and manual send operations

### Nice to Have (Post-MVP)
- Template versioning and history
- A/B testing for template effectiveness
- Email open/click tracking
- Smart send time optimization (ML-based)
- WhatsApp integration as alternative channel
- Custom merge tag creation by users
- Template marketplace/sharing

---

## 🎨 Key Design Decisions

### Technical Decisions
- **Template Storage**: Database (not hardcoded) for easy editing without deployments
- **Auto-Send Frequency**: Daily at 9 AM UAE time (GST/GMT+4)
- **Manual Send**: Immediate with confirmation dialog and preview
- **Merge Tags**: Support all invoice/customer/company fields
- **Escalation Mapping**: 5 templates mapped to 6 buckets (Not Due uses friendly, 30+ uses firmest)

### Business Logic
- **Customer Consolidation**: Enabled by default (68% email reduction)
- **Business Hours**: 9 AM - 6 PM GST, Sunday-Thursday (UAE business week)
- **Sending Limits**: Respect AWS SES limits (varies by account tier)
- **Rate Limiting**: Maximum 50 emails per batch, 3-second delays between batches
- **Cultural Sensitivity**: Templates respect UAE business customs and communication norms

### User Experience
- **One-Click Actions**: Quick actions on bucket cards for common workflows
- **Preview Before Send**: Always show preview with actual data before sending
- **Clear Status Indicators**: Visual indicators for auto-send enabled, template assigned, etc.
- **Progressive Disclosure**: Simple defaults with advanced options available
- **Undo Capability**: Draft campaigns before sending, can be edited or cancelled

---

## 🔄 Integration Points

### Existing Systems
- **Invoice Management**: Buckets pull from existing invoices table
- **Customer Data**: Templates use customer information from customers table
- **Campaign System**: Bucket sends create standard campaigns via existing API
- **Email Delivery**: Uses existing unifiedEmailService.ts (AWS SES)
- **Activity Logging**: All actions logged to existing activities table
- **Authentication**: Company-scoped with NextAuth session validation

### Data Flow
```
User Action (Manual Send):
Bucket Detail View → Select Invoices → Click "Email Selected"
→ Fetch Bucket Template → Merge with Invoice Data → Preview Dialog
→ Confirm → Create Campaign → Send via AWS SES → Log Activity

Automated Flow (Auto-Send):
Cron Trigger (9 AM Daily) → Query Auto-Send Enabled Buckets
→ For Each Bucket: Get Eligible Invoices → Fetch Template
→ Create Campaign → Send via AWS SES → Log Activity
```

---

## 📊 Success Metrics

### Technical Metrics
- Email delivery rate > 95% (AWS SES bounce rate < 5%)
- Template rendering time < 500ms
- Campaign creation time < 2s for 100 invoices
- Auto-send execution time < 5 minutes for 1000 invoices
- Zero data loss in template/config operations

### Business Metrics
- Average days to payment reduced by 25%
- Customer consolidation reduces email volume by 68%
- Auto-send adoption rate > 60% of companies
- Manual send usage > 10 campaigns per company per month
- Template customization rate > 40% of companies

### User Experience Metrics
- Template creation time < 5 minutes
- Bucket configuration time < 2 minutes
- Manual send workflow completion rate > 90%
- User satisfaction score > 8/10
- Support tickets related to email sending < 5% of total

---

## 🚨 Risk Mitigation

### Technical Risks
- **AWS SES Limits**: Monitor sending quotas, implement circuit breaker
- **Email Deliverability**: Proper SPF/DKIM/DMARC configuration, warm-up plan
- **Template Errors**: Validation before save, fallback to default template
- **Cron Reliability**: Implement heartbeat monitoring, alert on failures
- **Database Performance**: Index bucket_id, company_id, created_at columns

### Business Risks
- **Spam Complaints**: Clear unsubscribe mechanism, respect opt-outs
- **Cultural Sensitivity**: Templates reviewed by UAE business experts
- **Over-Automation**: Default to manual send, require explicit auto-send enablement
- **Customer Relationships**: Allow manual override, pause for sensitive customers
- **Legal Compliance**: Ensure GDPR/UAE data protection law compliance

### Operational Risks
- **Email Volume Spike**: Gradual rollout, monitor AWS SES quotas
- **Support Load**: Comprehensive documentation, in-app guidance
- **Data Migration**: Backup before schema changes, test rollback procedures
- **Feature Complexity**: Progressive disclosure, simple defaults
- **Performance Degradation**: Load testing before launch, CDN for static assets

---

## 📝 Next Steps

1. **Review Plan**: Stakeholder review and approval
2. **Finalize Design**: UI/UX mockups for template editor and bucket settings
3. **Set Up Environment**: Ensure Supabase, AWS SES, and Vercel Cron configured
4. **Begin Phase 1**: Database schema extensions and migrations
5. **Iterate**: Build → Test → Refine for each phase
6. **User Testing**: Beta test with POP Trading Company (first customer)
7. **Launch**: Production deployment with monitoring and support readiness

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Author**: Claude Code Analysis
**Status**: Ready for Implementation
