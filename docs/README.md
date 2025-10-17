# Reminder Documentation Index

Concise, actionable documentation for the Reminder invoice platform.

## 🎯 Start Here

**New to the project?** Read `/CLAUDE.md` in the root directory for complete overview.

**Current work?** See `16_WEEK_BUILD_PLAN.md` for roadmap and priorities.

**Need help with?** Check CLAUDE.md files in relevant directories:
- `/CLAUDE.md` - Project overview, setup, architecture
- `/messages/CLAUDE.md` - Internationalization (English/Arabic)
- `/prisma/CLAUDE.md` - Database schema and queries
- `/src/app/api/CLAUDE.md` - API route patterns
- `/src/components/CLAUDE.md` - React component patterns
- `/src/lib/CLAUDE.md` - Services and utilities

---

## 📁 Active Documentation

### Current Roadmap
- **`16_WEEK_BUILD_PLAN.md`** - Q4 2025 launch plan with weekly milestones
- **`BUCKET_FIX_PLAN.md`** - Active bug fix (pagination issue)
- **`claudedocs/bucket-system-mvp-implementation-plan.md`** - Email integration spec

### Infrastructure
- **`AWS_SETUP.md`** - AWS SES, S3, Textract configuration
- **`TEXTRACT_ASYNC_IMPLEMENTATION.md`** - PDF extraction system (100% success rate)
- **`PARALLEL_EXTRACTION.md`** - Performance optimization details
- **`TEXTRACT_TEST_RESULTS.md`** - Validation data from POP Trading PDFs

### Debugging
- **`claudedocs/frontend-issues-resolution.md`** - React hydration, DB connection issues
- **`claudedocs/invoice-upload-testing-summary.md`** - PDF upload test results

### Deployment
- **`claudedocs/DEPLOYMENT_STATUS.md`** - Production environment status
- **`claudedocs/PRODUCTION_DEPLOYMENT.md`** - Vercel deployment guide

---

## 🗂️ Archived Documentation

Historical planning docs and progress reports are in `docs/archive/`:
- Sprint planning (superseded by 16-week plan)
- Consolidation roadmaps (features now complete)
- Progress reports (captured in git history)
- Old MVP plans (replaced by current roadmap)

These are kept for reference but not actively maintained.

---

## 📊 Current Status

**Build**: ✅ Passing
**Production**: ✅ Live at reminder-mvp.vercel.app
**Tests**: 659/1487 passing (44%)
**Phase**: Pre-Week 1 (stabilization before email reliability sprint)

**Core Systems Complete**:
- ✅ Authentication & multi-tenant database
- ✅ PDF extraction (AWS Textract, 100% success)
- ✅ Invoice management (CSV/Excel/PDF import)
- ✅ Bucket system (6 time-based buckets)
- ✅ AWS SES configuration
- ✅ Email service infrastructure

**Next Priorities**:
1. Fix bucket pagination bug (SQL filtering)
2. AWS SES domain verification
3. Email template system
4. Bucket-to-campaign integration

---

## 🚀 Quick Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm test                       # Run tests

# Database
npx prisma generate            # Generate client after schema changes
npx prisma db push             # Push schema to database
npx prisma studio              # Visual database browser

# Testing
npm run test:e2e               # Playwright E2E tests
npm run test:coverage          # Coverage report
```

---

## 📝 Documentation Philosophy

**Keep it concise**: Only document what's needed, when it's needed.
**Code is truth**: Prisma schema > database docs, TypeScript > API specs.
**Active only**: Archive completed work, delete obsolete planning.
**CLAUDE.md files**: Single source of truth for each domain.

**When to document**:
- ✅ Current roadmap and active work
- ✅ Infrastructure setup (AWS, deployment)
- ✅ Active bug fixes and debugging
- ✅ Test results and validation data

**When NOT to document**:
- ❌ Historical progress reports (use git history)
- ❌ Completed sprints and old plans
- ❌ Feature specs for implemented code
- ❌ Anything redundant with code or Prisma schema

---

Last updated: 2025-10-17
Docs reduced from 6,192 lines to ~800 lines (87% reduction)
