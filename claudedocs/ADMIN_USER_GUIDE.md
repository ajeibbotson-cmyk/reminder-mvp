# Reminder Platform - Admin User Guide

**For**: POP Trading Company
**Date**: November 2025
**Platform**: reminder.com (Production)

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Invoice Management](#invoice-management)
4. [Email Reminder System](#email-reminder-system)
5. [Customer Management](#customer-management)
6. [Payment Tracking](#payment-tracking)
7. [Reporting & Analytics](#reporting--analytics)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Login

1. **Access the Platform**: Navigate to https://reminder.com
2. **Login Credentials**: Use your admin email and password
3. **Dashboard**: You'll land on the main dashboard showing invoice overview

### User Roles

- **ADMIN**: Full access - manage invoices, customers, settings, users
- **FINANCE**: Invoice and payment management access
- **VIEWER**: Read-only access to reports and data

---

## Dashboard Overview

### Key Metrics (Top Cards)

**Total Outstanding**: AED amount of all unpaid invoices
**Overdue Invoices**: Count and amount of invoices past due date
**This Month**: Revenue collected in current month
**Average DSO**: Days Sales Outstanding (average payment time)

### Quick Actions

- **Send Reminder**: Trigger immediate payment reminder emails
- **Upload Invoices**: Bulk import invoices from CSV/Excel
- **Add Customer**: Create new customer record
- **View Reports**: Access detailed analytics

---

## Invoice Management

### Uploading Invoices

**Supported Formats**: CSV, Excel (XLS, XLSX)

**Required Fields**:
- Invoice Number (unique identifier)
- Customer Name
- Customer Email
- Total Amount (AED)
- Due Date (DD/MM/YYYY format)

**Optional Fields**:
- Issue Date
- Payment Terms (e.g., "Net 30")
- Notes
- PDF Invoice (S3 path for attachments)

**Upload Process**:
1. Click **"Upload Invoices"** button
2. Select your CSV/Excel file
3. Review validation summary
4. Confirm import
5. System creates customers automatically if they don't exist

**Example CSV Format**:
```csv
Invoice Number,Customer Name,Customer Email,Amount,Due Date,Issue Date,Payment Terms
INV-001,Dubai Tech Solutions,finance@dubaitech.ae,8500,15/12/2025,15/11/2025,Net 30
INV-002,Al Farsi Trading,accounts@alfarsi.ae,12300,20/12/2025,20/11/2025,Net 30
```

### Invoice Status Lifecycle

1. **SENT**: Invoice issued, payment pending
2. **OVERDUE**: Past due date, no payment received
3. **PAID**: Full payment received and reconciled
4. **PARTIAL**: Partial payment received
5. **DISPUTED**: Customer raised dispute or query
6. **CANCELLED**: Invoice voided or cancelled

### Manual Status Updates

1. Navigate to invoice detail page
2. Click **"Update Status"** dropdown
3. Select new status
4. Add notes (optional but recommended)
5. Confirm update

---

## Email Reminder System

### Automated Follow-Up Sequences

**Default 3-Sequence System**:

**Sequence 1**: 7 days before due date
- Template: Gentle reminder
- Tone: Professional, courteous
- Includes: Invoice PDF attachment

**Sequence 2**: 3 days after due date
- Template: Overdue notice
- Tone: Firm but respectful
- Includes: Payment urgency, PDF attachment

**Sequence 3**: 14 days after due date
- Template: Final reminder
- Tone: Serious, escalation warning
- Includes: PDF attachment, payment options

### Manual Reminder Triggers

**Send Immediate Reminder**:
1. Go to invoice detail page
2. Click **"Send Reminder Now"**
3. Select email template (or use default)
4. Add custom message (optional)
5. Confirm send

**Bulk Reminder Send**:
1. Select multiple invoices (checkbox)
2. Click **"Send Bulk Reminder"**
3. Choose template
4. Confirm send to all selected

### Email Templates

**Available Languages**: English, Arabic
**Template Types**: Gentle, Firm, Final, Custom

**Customization**:
- Company logo and branding
- Payment instructions specific to your bank
- Custom notes and terms
- UAE business hour compliance (automatic)

### Email Tracking

**Delivery Status**:
- **SENT**: Email dispatched via Postmark
- **DELIVERED**: Received by customer's mail server
- **OPENED**: Customer opened the email
- **CLICKED**: Customer clicked link in email
- **BOUNCED**: Email delivery failed
- **COMPLAINED**: Customer marked as spam

**View Email History**:
1. Go to invoice detail page
2. Scroll to **"Email History"** section
3. See all emails sent with timestamps and status

---

## Customer Management

### Customer Records

Each customer has:
- Name and email (required)
- Phone, address, contact person (optional)
- Payment terms (Net 7, Net 30, etc.)
- Outstanding balance (auto-calculated)
- Payment history
- Notes and tags

### Adding Customers

**Manual Creation**:
1. Click **"Add Customer"**
2. Fill in customer details
3. Set default payment terms
4. Save

**Automatic Creation**:
- Customers are created automatically during invoice upload
- System matches by email address
- Merges data if customer already exists

### Customer Detail Page

**Information Displayed**:
- Total outstanding amount
- Number of overdue invoices
- Average payment time (DSO)
- Recent invoice list
- Payment history
- Email communication log

### Customer Notes

**Adding Notes**:
1. Navigate to customer page
2. Click **"Add Note"**
3. Enter note text
4. Save

**Use Cases**:
- Payment disputes or queries
- Special payment arrangements
- Customer communication preferences
- Credit limit changes

---

## Payment Tracking

### Recording Payments

**Manual Payment Entry**:
1. Go to invoice detail page
2. Click **"Record Payment"**
3. Enter payment details:
   - Amount received
   - Payment date
   - Payment method (Bank Transfer, Cash, Cheque, Card)
   - Reference number
   - Notes
4. Save payment

**Partial Payments**:
- System supports multiple partial payments
- Automatically calculates remaining balance
- Updates invoice status to PARTIAL
- Marks PAID when fully settled

### Payment Methods Supported

- **Bank Transfer**: Most common for B2B
- **Cash**: For small amounts
- **Cheque**: Traditional payment method
- **Card**: Credit/debit card payments
- **Other**: Custom payment methods

### Payment Reconciliation

**Daily Reconciliation Process**:
1. Export bank statement
2. Match payments to invoices by reference
3. Record payments in system
4. Mark invoices as paid
5. Generate reconciliation report

**Auto-Reconciliation** (Coming Soon):
- Bank integration for automatic matching
- Stripe payment gateway integration
- Real-time payment updates

---

## Reporting & Analytics

### Standard Reports

**1. Outstanding Invoices Report**
- All unpaid invoices grouped by status
- Total outstanding by customer
- Aging analysis (0-30, 31-60, 61-90, 90+ days)

**2. Collection Performance Report**
- Payment collection rate (%)
- Average Days Sales Outstanding (DSO)
- Monthly collection trends
- Customer payment behavior

**3. Email Campaign Report**
- Emails sent vs delivered vs opened
- Click-through rates
- Bounce and complaint rates
- Template performance comparison

**4. Customer Analysis Report**
- Top customers by revenue
- Highest outstanding balances
- Payment term adherence
- Risk scoring (coming soon)

### Exporting Data

**Export Options**:
- CSV format for Excel
- PDF for formal reports
- Email scheduled reports (coming soon)

**Export Process**:
1. Navigate to report page
2. Apply filters (date range, customer, status)
3. Click **"Export"**
4. Choose format (CSV/PDF)
5. Download file

---

## Best Practices

### Invoice Management

✅ **Upload invoices immediately after issuing**
✅ **Include PDF attachments for professional presentation**
✅ **Set accurate due dates based on payment terms**
✅ **Review and validate bulk uploads before confirming**
✅ **Update invoice status promptly when payments received**

### Email Reminders

✅ **Let automated sequences run (avoid manual overrides)**
✅ **Use gentle tone for first reminders**
✅ **Escalate tone only after repeated non-payment**
✅ **Respect UAE business hours (automatic in system)**
✅ **Add personalized notes for high-value customers**

### Customer Relations

✅ **Maintain accurate customer contact details**
✅ **Document all payment discussions in notes**
✅ **Monitor email open rates to gauge engagement**
✅ **Flag customers with repeated payment issues**
✅ **Communicate proactively about payment terms**

### Payment Collection

✅ **Record payments same day received**
✅ **Include payment references for easy reconciliation**
✅ **Follow up on partial payments**
✅ **Reconcile bank statements weekly minimum**
✅ **Track DSO trends to identify collection issues early**

---

## Troubleshooting

### Email Delivery Issues

**Problem**: Customer says they didn't receive reminder email

**Solutions**:
1. Check email history on invoice page - verify status
2. Confirm customer email address is correct
3. Ask customer to check spam/junk folder
4. Resend email manually from invoice page
5. Contact support if status shows "BOUNCED"

**Problem**: Email shows "BOUNCED" status

**Solutions**:
1. Verify email address is valid (no typos)
2. Check if customer email server is blocking
3. Update to alternative email address
4. Contact customer via phone to confirm email

### Invoice Import Problems

**Problem**: CSV upload fails validation

**Solutions**:
1. Check file format matches example template
2. Ensure required fields are present
3. Verify date format is DD/MM/YYYY
4. Remove special characters from invoice numbers
5. Check for duplicate invoice numbers

**Problem**: Customers not auto-created during import

**Solutions**:
1. Ensure customer email field is populated
2. Verify email format is valid
3. Check customer name is provided
4. Review validation errors in upload summary

### Payment Recording Issues

**Problem**: Cannot mark invoice as paid

**Solutions**:
1. Ensure payment amount matches invoice total
2. For partial payments, use "Record Payment" not "Mark Paid"
3. Check payment date is valid (not future date)
4. Verify you have ADMIN or FINANCE role

### System Access Problems

**Problem**: Cannot login to platform

**Solutions**:
1. Verify you're using correct email address
2. Use "Forgot Password" to reset if needed
3. Clear browser cache and cookies
4. Try incognito/private browsing mode
5. Contact admin for account verification

---

## Support & Contact

### Getting Help

**Email Support**: support@reminder.com
**Response Time**: Within 24 hours (business days)

**Emergency Contact**: For critical payment collection issues
**Phone**: +971-XX-XXX-XXXX (Business hours: Sun-Thu, 9 AM - 6 PM UAE)

### Training Resources

**Video Tutorials**: Available on dashboard
**Knowledge Base**: help.reminder.com
**Live Training**: Scheduled for POP Trading team (TBD)

### Feedback

We value your feedback to improve the platform!

**Feature Requests**: features@reminder.com
**Bug Reports**: bugs@reminder.com
**General Feedback**: feedback@reminder.com

---

## Appendix: Keyboard Shortcuts

**Navigation**:
- `Ctrl/Cmd + K`: Quick search
- `Ctrl/Cmd + /`: Open command palette

**Actions**:
- `Ctrl/Cmd + N`: New invoice
- `Ctrl/Cmd + U`: Upload invoices
- `Ctrl/Cmd + S`: Save changes

**Views**:
- `Ctrl/Cmd + 1`: Dashboard
- `Ctrl/Cmd + 2`: Invoices
- `Ctrl/Cmd + 3`: Customers
- `Ctrl/Cmd + 4`: Reports

---

## Quick Reference Card

### Common Tasks

| Task | Steps | Time |
|------|-------|------|
| Upload invoices | Dashboard → Upload → Select file → Confirm | 2 min |
| Send reminder | Invoice page → Send Reminder → Confirm | 30 sec |
| Record payment | Invoice page → Record Payment → Enter details → Save | 1 min |
| View reports | Dashboard → Reports → Select type → Apply filters | 2 min |
| Add customer note | Customer page → Add Note → Enter text → Save | 30 sec |

### System Status

✅ **Email Delivery**: Postmark (99.9% uptime)
✅ **Database**: Supabase PostgreSQL (99.95% uptime)
✅ **PDF Storage**: AWS S3 UAE Region
✅ **Webhooks**: Real-time email tracking active

### UAE Compliance

✅ **Business Hours**: Sun-Thu, 9 AM - 6 PM (no emails outside)
✅ **Islamic Calendar**: Automatic Friday/holiday detection
✅ **Cultural Sensitivity**: Respectful tone in all communications
✅ **AED Currency**: Native support, local formatting
✅ **Arabic Language**: Full bilingual support

---

**Last Updated**: November 19, 2025
**Platform Version**: v1.0 (December 2025 Launch)
**Document Owner**: Reminder Platform Team
