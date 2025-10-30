# Resume Session Guide

## Quick Resume Prompts

### General Resume (Let AI Suggest Next Steps)
```
Continue working on the Reminder MVP invoice system.
Last session completed: PDF attachment feature for reminder emails.

Review the PRD priorities and suggest which feature to tackle next,
explaining your reasoning based on dependencies and user value.
```

### Specific Feature Request
```
Continue working on Reminder MVP. Implement [FEATURE NAME] from the PRD priorities.
```

### Available Priorities (From PRD Discussion)

**All Important - No Rush - Q4 2025 Launch Target**

1. **Reply-To Header Configuration**
   - Add Reply-To to email headers
   - Configure per customer so replies go to customer, not Reminder
   - Customer email settings page needed

2. **Customer Email Settings UI**
   - Build settings page for customers
   - Configure: reply-to address, signature, custom messages
   - Simple template customization (opening lines only)

3. **Email Preview Functionality**
   - Allow customers to preview emails before sending
   - Show how email will look with merge tags resolved
   - Confirm attachment presence

4. **Bilingual Templates (English/Arabic)**
   - Simple templates with customizable opening lines
   - Always include: invoice number, amount, due date
   - Question: Are merge tags necessary? (May simplify further)

5. **Multi-Currency Support**
   - Critical for POP Trading Company (first customer)
   - Handle different currencies beyond AED
   - Required for launch

## Completed Features

### ✅ Reply-To Header Configuration (October 30, 2025)
- Reply-To header support for MIME and standard emails
- Company-level default Reply-To via email_settings JSON field
- Intelligent fallback to customer email
- Graceful degradation if unavailable
- Zero database migrations required
- **Status**: Production-ready, deployed to main branch
- **Next**: Settings UI to configure Reply-To

### ✅ PDF Attachment System (October 20, 2025)
- AWS S3 PDF retrieval with streaming downloads
- RFC-compliant MIME multipart email encoding
- Graceful fallback when PDFs unavailable
- Configurable per campaign (defaults to true)
- Integration with bucket auto-send system
- **Status**: Production-ready, tested, pushed to GitHub
- **User Feedback**: "Received and it was fantastic"

### ✅ Core MVP Features (Earlier Sessions)
- Invoice management (CSV/Excel import)
- Automated follow-up system (3-sequence)
- Payment tracking and reconciliation
- Multi-user access with role-based permissions
- UAE business hours and cultural compliance
- Advanced analytics dashboard
- Comprehensive testing framework (62% pass rate)

## Technical Context

### Current Stack
- Next.js 15 + React 19 + TypeScript
- PostgreSQL (Supabase) + Prisma ORM
- NextAuth.js v4 (JWT sessions)
- AWS SES (US-EAST-1 region) + AWS S3
- Tailwind CSS v4 + shadcn/ui

### AWS Configuration
- **Email Region**: US-EAST-1 (verified emails, stay here for all features)
- **S3 Region**: Configurable per bucket
- **Verified Emails**: hello@usereminder.com, ajeibbotson@gmail.com

### Database Schema
- Multi-tenant with company-scoped queries
- Invoice PDF fields: `pdf_s3_key`, `pdf_s3_bucket`, `pdf_uploaded_at`
- Campaign attachment: `attach_invoice_pdf` Boolean @default(true)
- Denormalized fields: `customer_email`, `customer_name` for performance

### Key Services
- `UnifiedEmailService` - Email campaigns with PDF attachments
- `bucket-auto-send-service` - Automated time-based reminders
- NextAuth with Prisma adapter - Authentication/authorization

## Repository State

### Clean Working Directory
- PDF attachment feature committed and pushed
- Test scripts removed (workspace cleaned)
- Documentation complete in `claudedocs/`

### Uncommitted Files (Non-Critical)
- Test results and playwright reports
- Documentation drafts from previous sessions
- Can be cleaned up or committed later

### Recent Commits
```
82f7fa2 - docs: Add Reply-To feature session summary
95bb990 - feat: Add Reply-To header support for invoice reminder emails
7a3ccfc - docs: Add resume session guide for future development
624e53b - docs: Add comprehensive PDF attachment session summary
01c3465 - feat: Add invoice PDF attachments to reminder emails
```

## User Preferences

### Development Approach
- **No Rush**: "We are not in any rush to complete"
- **Quality First**: Needs to be "robust before I'd start"
- **Simple Templates**: Standard template + customizable opening lines only
- **Question Merge Tags**: May not be necessary, keep simple

### Business Context
- **Launch**: Q4 2025
- **First Customer**: POP Trading Company (needs multi-currency)
- **Customers Waiting**: But needs robustness first

### Technical Decisions
- **AWS Region**: Stay on US-EAST-1 (necessary for other features)
- **Template Philosophy**: Simple, customizable opening lines only
- **Always Include**: Invoice number, amount, due date

## Next Session Best Practices

1. **Start with Git Status**: Check for uncommitted changes
2. **Review Recent Commits**: Understand what's done
3. **Check Documentation**: Read relevant claudedocs files
4. **Ask for Direction**: Let user choose priority or suggest based on dependencies
5. **Plan Before Code**: Use TodoWrite for multi-step features
6. **Test Thoroughly**: All features should be tested before commit
7. **Clean Workspace**: Remove temporary files before ending
8. **Document Well**: Update claudedocs with implementation details
9. **Commit Clearly**: Descriptive messages with context

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run lint            # ESLint validation

# Database
npx prisma generate     # Generate Prisma client
npx prisma db push      # Push schema changes
npx prisma studio       # Visual database browser

# Testing
npm run test            # Jest tests
npm run test:e2e        # Playwright E2E tests

# Git
git status              # Check repository state
git log --oneline -5    # Recent commits
git push                # Push to GitHub
```

## File Organization

```
claudedocs/              # Claude-specific documentation and analysis
docs/                    # User-facing documentation and reports
scripts/                 # Utility and test scripts
src/
├── app/                # Next.js App Router
├── components/         # React components
└── lib/                # Core utilities and services
    └── services/       # Business logic services
prisma/
└── schema.prisma      # Database schema
```

## Questions to Ask When Resuming

1. "Which feature from the PRD priorities should I tackle next?"
2. "Are there any blockers or issues from production I should know about?"
3. "Has anything changed with the POP Trading Company requirements?"
4. "Do you want me to clean up the uncommitted test files first?"
5. "Should I focus on a specific priority or suggest the best next step?"

---

**Last Updated**: October 30, 2025
**Last Completed**: Reply-To Header Configuration ✅
**PRD Progress**: 1/5 features complete (20%)
**Status**: Ready for next feature development
