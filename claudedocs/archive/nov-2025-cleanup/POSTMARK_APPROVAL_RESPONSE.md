# Postmark Approval Response

**Account**: hello@usereminder.com (Server ID: 17479339)

---

### 1. Mailing List Management and Updates

Reminder is a B2B invoice reminder platform sending 100% transactional emails to existing business customers with outstanding invoices.

**List Management**:
- All recipients are existing business customers (no purchased/scraped lists)
- Automated bounce handling via Postmark webhooks → instant suppression
- Spam complaints trigger immediate suppression
- Database-driven suppression list prevents future sends to bounced/complained addresses
- Customers with no active invoices are excluded from sends
- Manual opt-out requests honored immediately

**Technical Implementation**: Webhook integration automatically processes bounces and complaints in real-time, adding them to our `email_suppression` database table to prevent all future sends.

---

### 2. Email Sending Performance Stats

We're a new platform launching Q4 2025, so no historical performance data is available yet to export.

**Migration Context**: We migrated to Postmark after AWS SES rejected our production access request (screenshot shared in initial signup). AWS SES was in sandbox mode with limited testing before rejection.

**Expected Performance** (based on transactional B2B email standards):
- Projected volume: 1,000-5,000 emails/month initially (scaling to 10,000+)
- Target bounce rate: <2% (high-quality B2B recipients with verified invoices)
- Target complaint rate: <0.1% (100% transactional, no marketing)
- Expected open rate: 40-60% (payment reminders are business-critical)

**First Customer**: POP Trading Company (UAE-based, 400+ invoices/season)

---

### 3. Example Message Content

**Example Invoice Payment Reminder**:

```
Subject: Payment Reminder: Invoice INV-2025-001 - AED 15,750.00

---

Dear Ahmed Al-Mansouri,

This is a friendly reminder that Invoice INV-2025-001 for AED 15,750.00 is now overdue.

Invoice Details:
• Invoice Number: INV-2025-001
• Invoice Date: October 15, 2025
• Due Date: November 14, 2025
• Amount Due: AED 15,750.00
• Days Overdue: 0 days

You can view and pay your invoice here:
[View Invoice] (link to secure invoice portal)

Payment Methods:
• Bank Transfer: Emirates NBD - Account: 1234567890
• Cheque: Payable to "POP Trading Company"

If you have already made this payment, please disregard this message or contact us to confirm receipt.

For any questions, please contact:
Email: accounts@poptrading.ae
Phone: +971 4 123 4567

Thank you for your business.

Best regards,
POP Trading Company
Dubai, UAE

---
TRN: 123456789012345

This is an automated payment reminder from Reminder (usereminder.com).
If you believe you received this email in error, please contact support@usereminder.com.
```

**Email Frequency**: Maximum 3 reminders per invoice (at 7, 14, and 30 days after due date)

**Note**: Bilingual support available (English + Arabic) for UAE market

---

## About Reminder

Reminder is a B2B SaaS platform helping UAE businesses automate invoice payment collection. We're launching Q4 2025 with POP Trading Company as our first customer.

**Why we chose Postmark**: AWS SES rejected our production access request. We need professional deliverability (95%+ inbox placement), open/click tracking for ROI measurement, and real-time webhook processing.

**Technical Infrastructure**:
- Domain authentication: DKIM, SPF, DMARC configured
- Real-time webhook integration for bounce/complaint processing
- Database-driven suppression system
- Multi-tenant SaaS architecture with company data isolation

We're committed to maintaining excellent sender reputation and following Postmark best practices. Happy to provide additional information if needed.

Best regards,
Andrew Ibbotson
Founder, Reminder
hello@usereminder.com
