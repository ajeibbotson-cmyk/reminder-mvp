# Reminder Documentation Index

**Complete documentation for the Reminder invoice management and payment reminder platform.**

## 🎯 Quick Navigation

### 📋 Planning & Strategy
- [Product Status (November 2025)](planning/PRODUCT_STATUS_NOVEMBER_2025.md) - Current state assessment
- [December Beta Roadmap](planning/DECEMBER_BETA_ROADMAP.md) - 7-week launch plan
- [Implementation Plan](planning/IMPLEMENTATION_PLAN.md) - Detailed technical roadmap

### 🚀 Development

#### Week 1: Discovery + Critical Integration (Nov 1-7)
- [Week 1 Overview](development/week1/README.md) - Objectives, timeline, progress
- [Day 1 Handoff](development/week1/DAY1_HANDOFF.md) - Session summary and achievements
- [Day 2 Resume Guide](development/week1/DAY2_RESUME.md) - How to continue work
- [API Test Results](development/week1/API_TEST_RESULTS.md) - Endpoint validation status
- [API Testing Guide](development/week1/API_TESTING_GUIDE.md) - Testing methodology
- [API Fix Plan](development/week1/API_FIX_PLAN.md) - Exact fixes with file/line numbers
- [Critical Database Fix](development/week1/CRITICAL_DATABASE_FIX.md) - Pooler vs direct connection

### ✨ Features

#### Core Email Features
- [PDF Attachments](features/pdf-attachments.md) - Automated invoice PDF attachments
- [Reply-To Header](features/reply-to-header.md) - Configurable email reply routing
- [Auto-Send System](features/auto-send.md) - Automated bucket-based reminders
- [Bucket System](features/bucket-system.md) - Visual invoice organization

### 🚢 Deployment
- [AWS SES Setup](deployment/AWS_SES_SETUP.md) - Email service configuration
- [Environment Variables](deployment/ENVIRONMENT_VARIABLES.md) - Required configuration
- [Production Deployment](deployment/PRODUCTION_DEPLOYMENT.md) - Deployment guide

### 🔧 Technical Reference
- [Database Fixes](technical/database-fixes.md) - Pooler vs direct connection
- [Testing Framework](technical/testing.md) - Jest, Playwright, test infrastructure

### 📦 Archive
Historical documentation and old session summaries are in the [archive/](archive/) directory.

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
