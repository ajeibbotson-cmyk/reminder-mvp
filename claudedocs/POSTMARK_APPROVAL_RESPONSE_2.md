# Postmark Follow-Up Response to Ignacio

**Account**: hello@usereminder.com (Server ID: 17479339)

---

Hi Ignacio,

Thanks for getting back to me. Happy to provide more details about Reminder.

## What Reminder Does

**Reminder** is a Credit Control as a Service (CCaaS) platform that automates invoice payment reminders for businesses globally.

**Problem We Solve**: Every business faces the same challenge - chasing overdue invoices is time-consuming (average 2.5 hours per week) and uncomfortable. We automate this process down to 10 minutes while maintaining professional, culturally-appropriate communication.

**Industry**: B2B SaaS / FinTech (Accounts Receivable Automation)

## Launch Strategy

**Global Product, Strategic Launch Market**: While Reminder is designed for businesses worldwide, we're launching first in the UAE for strategic reasons:

1. **E-invoicing Mandate**: UAE requires all invoices to be digital and compliant by July 2026, creating urgent demand for automation tools
2. **Smaller Market**: Easier to validate product-market fit before global expansion
3. **First Customer**: POP Trading Company (Amsterdam-based, operating in UAE) - 400+ invoices per season

**Post-UAE Expansion**: Once validated in UAE, we'll expand to other markets globally (Europe, North America, Asia-Pacific).

## Site/App Status

**Current Status**: Platform in final beta development, launching Q4 2025

**Production Domain**: https://reminder-mvp.vercel.app (development deployment, not public-facing yet)

**Screenshots**: I've attached screenshots showing:
1. Sign-in page and authentication flow
2. Dashboard with invoice management
3. Email template system (English + Arabic)
4. Automated follow-up sequence configuration
5. Payment tracking and reconciliation

## Email Use Case

**Email Type**: 100% transactional invoice payment reminders (no marketing, no newsletters)

**Recipients**: Existing business customers with outstanding invoices only

**Example Flow**:
- Customer receives invoice from business
- Invoice becomes overdue
- Reminder automatically sends professional payment reminder
- Maximum 3 reminders per invoice (7, 14, 30 days after due date)
- All bounces/complaints automatically suppressed

**Why Postmark**: We chose Postmark for its industry-leading deliverability (95%+ inbox placement), built-in open/click tracking, and real-time webhook processing - essential features for a mission-critical use case where businesses depend on getting invoices paid.

## Technical Infrastructure

- **Multi-tenant SaaS**: Company-isolated data architecture
- **Domain Authentication**: DKIM, SPF, DMARC fully configured
- **Webhook Integration**: Real-time bounce/complaint processing
- **Database Suppression**: Automated email suppression system
- **Compliance**: UAE business hours respect, cultural sensitivity, GDPR-ready

## Business Model

- **Target Market**: SMEs globally (starting with UAE companies under AED 3M turnover)
- **Revenue Model**: SaaS subscription (per-company pricing)
- **First Customer**: POP Trading Company (existing relationship, Amsterdam-based)
- **Growth Plan**: 10-50 customers by Q1 2026, scaling globally thereafter

## Why We're Legitimate

- Real SaaS business solving universal business problem (late payment collection)
- Amsterdam-based first customer with existing relationship
- Professional technical infrastructure with proper domain authentication
- Automated suppression and bounce handling
- 100% transactional emails (no marketing/spam)
- Clear business model and growth strategy

I'm happy to provide any additional information, a demo walkthrough, or access to our beta platform if that would be helpful for approval.

Thanks for your consideration.

Best regards,
Andrew Ibbotson
Founder, Reminder
hello@usereminder.com
