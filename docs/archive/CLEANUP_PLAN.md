# Documentation Cleanup Plan

**Current State**: 25 markdown files in root + 17 in claudedocs = **42 docs total**
**Problem**: Completely disorganized, duplicate content, bloated sidebar
**Goal**: Clean, organized, easy to navigate structure

---

## Proposed New Structure

```
/Users/ibbs/Development/reminder-mvp/
├── README.md                        # Main project overview
├── CLAUDE.md                        # Claude Code instructions (keep)
│
├── docs/
│   ├── README.md                    # Docs index
│   │
│   ├── planning/                    # Strategic planning docs
│   │   ├── DECEMBER_BETA_ROADMAP.md
│   │   ├── PRODUCT_STATUS.md
│   │   └── IMPLEMENTATION_PLAN.md
│   │
│   ├── development/                 # Active development docs
│   │   ├── week1/
│   │   │   ├── README.md           # Week 1 index
│   │   │   ├── DAY1_HANDOFF.md     # Latest handoff
│   │   │   ├── DAY2_RESUME.md      # Resume guide
│   │   │   └── API_TEST_RESULTS.md
│   │   │
│   │   └── current-sprint/          # Active sprint docs
│   │       └── (future sprints here)
│   │
│   ├── deployment/                  # Production & deployment
│   │   ├── PRODUCTION_SETUP.md
│   │   └── DEPLOYMENT_STATUS.md
│   │
│   ├── features/                    # Feature documentation
│   │   ├── pdf-attachments.md
│   │   ├── reply-to-header.md
│   │   ├── auto-send.md
│   │   └── bucket-system.md
│   │
│   ├── archive/                     # Old/completed docs
│   │   ├── sprints/
│   │   │   └── sprint-3-completion.md
│   │   ├── testing/
│   │   │   └── invoice-upload-testing.md
│   │   └── historical/
│   │       └── (old roadmaps, status reports)
│   │
│   └── technical/                   # Technical references
│       ├── database-fixes.md
│       ├── api-reference.md
│       └── troubleshooting.md
│
└── claudedocs/                      # Internal Claude context (gitignored)
    ├── README.md                    # What this folder is for
    ├── session-summaries/
    └── implementation-notes/
```

---

## Cleanup Actions

### 1. Archive Old/Duplicate Docs
**Move to `docs/archive/`**:
- SPRINT_3_COMPLETION_REPORT.md
- WORKING_MVP_SUMMARY.md
- FINAL_STATUS_REPORT.md
- FOUNDATION_FIXES.md
- SCOPE_REDUCTION_IMPACT_ASSESSMENT.md
- BUCKET_FIX_PLAN.md
- UNIFIED_PLATFORM_ROADMAP.md
- IMPLEMENTATION_ROADMAP.md (duplicate of IMPLEMENTATION_PLAN)

### 2. Consolidate Planning Docs
**Keep in `docs/planning/`**:
- DECEMBER_BETA_ROADMAP.md (current active plan)
- PRODUCT_STATUS_NOVEMBER_2025.md → Rename to PRODUCT_STATUS.md
- IMPLEMENTATION_PLAN_10_WEEKS.md → Rename to IMPLEMENTATION_PLAN.md

**Archive**:
- BETA_SUPPORT_PLAN.md (premature - launch first)

### 3. Organize Week 1 Docs
**Move to `docs/development/week1/`**:
- WEEK1_DAY1_HANDOFF.md → Rename to DAY1_HANDOFF.md
- WEEK1_DAY2_RESUME_GUIDE.md → Rename to DAY2_RESUME.md
- WEEK1_API_TEST_RESULTS.md → Rename to API_TEST_RESULTS.md
- WEEK1_DAY1_CRITICAL_FIX.md → Move to technical/database-fixes.md
- WEEK1_MANUAL_API_TESTING_GUIDE.md → Rename to API_TESTING_GUIDE.md

**Delete (redundant)**:
- WEEK1_DAY1_DISCOVERIES.md (covered in handoff)
- WEEK1_DAY1_FINAL_STATUS.md (covered in handoff)
- WEEK1_DAY1_SESSION_SUMMARY.md (covered in handoff)
- WEEK1_DAY1_API_FIX_PLAN.md (covered in test results)

### 4. Organize Deployment Docs
**Move to `docs/deployment/`**:
- PRODUCTION_SETUP.md
- claudedocs/DEPLOYMENT_STATUS.md
- claudedocs/PRODUCTION_DEPLOYMENT.md

### 5. Organize Feature Docs
**Move to `docs/features/`** and consolidate:
- claudedocs/pdf-attachment-implementation.md + pdf-attachment-session-summary.md → **pdf-attachments.md**
- claudedocs/reply-to-header-implementation.md + reply-to-session-summary.md → **reply-to-header.md**
- claudedocs/auto-send-*.md files (3 files) → **auto-send.md**
- claudedocs/bucket-system-mvp-implementation-plan.md → **bucket-system.md**

### 6. Clean Up Root
**Keep in root** (only essentials):
- README.md
- CLAUDE.md
- STATUS.md (current status)

---

## File Count Reduction

**Before**: 42 files scattered everywhere
**After**: ~15 well-organized files + archive

**Root**: 3 files (README, CLAUDE, STATUS)
**Active docs**: ~12 files in organized folders
**Archive**: ~27 old files (still accessible but hidden)

---

## New Navigation Experience

### Root Level (Clean)
```
README.md          ← Project overview
CLAUDE.md          ← Claude instructions
STATUS.md          ← Current status
docs/              ← All documentation
```

### Docs Index (docs/README.md)
```markdown
# Documentation Index

## 🚀 Quick Start
- [Current Status](../STATUS.md)
- [Week 1 Progress](development/week1/README.md)

## 📋 Planning
- [December Beta Roadmap](planning/DECEMBER_BETA_ROADMAP.md)
- [Product Status](planning/PRODUCT_STATUS.md)
- [Implementation Plan](planning/IMPLEMENTATION_PLAN.md)

## 💻 Development
- [Week 1 - API Testing](development/week1/)
- [Current Sprint](development/current-sprint/)

## 🎯 Features
- [PDF Attachments](features/pdf-attachments.md)
- [Reply-To Header](features/reply-to-header.md)
- [Auto-Send System](features/auto-send.md)
- [Bucket System](features/bucket-system.md)

## 🚢 Deployment
- [Production Setup](deployment/PRODUCTION_SETUP.md)
- [Deployment Status](deployment/DEPLOYMENT_STATUS.md)

## 📚 Archive
- [Sprint History](archive/sprints/)
- [Historical Docs](archive/historical/)
```

---

## Benefits

### For You
✅ **Clean sidebar** - Only 3 files in root
✅ **Easy navigation** - Logical folder structure
✅ **Quick resume** - `docs/development/week1/DAY2_RESUME.md`
✅ **Clear history** - Archive preserves everything

### For Development
✅ **Faster file finding** - Know where everything lives
✅ **Better context** - Related docs together
✅ **Reduced clutter** - Focus on active work

### For Future
✅ **Scalable** - Add week2, week3 folders easily
✅ **Maintainable** - Clear patterns to follow
✅ **Professional** - GitHub-friendly structure

---

## Execution Plan

Would you like me to:

**Option A**: Execute full cleanup now (~15 minutes)
- Create folder structure
- Move and consolidate files
- Update all cross-references
- Delete redundant docs

**Option B**: Create shell script for you to review
- You approve changes
- Run script to execute
- Safer for important docs

**Option C**: Gradual cleanup
- Keep week1 docs as-is for now
- Archive old docs
- Organize future docs properly

---

## Recommendation

**Execute Option A** - Full cleanup now

Why:
- All important content is preserved
- Week 1 docs are fresh and can be easily reorganized
- Clean slate for Day 2
- Professional structure from start

The cleanup will:
1. Preserve all information (nothing lost)
2. Make navigation 10x easier
3. Set up scalable structure for Weeks 2-7
4. Take ~15 minutes

**Risk**: Very low - all files backed up in git

---

What would you prefer?
