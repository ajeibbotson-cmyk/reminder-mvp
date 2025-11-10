# Week 3: Settings UI Implementation - In Progress
**Date**: November 10, 2025
**Status**: Started - API Complete, UI Conversion Next
**Estimated Completion**: 3-4 hours remaining

---

## Overview

Started Week 3 implementation with Settings UI - the highest-value feature for UAT preparation. Settings allow users to configure their company information, email preferences, and system options before testing with real data.

---

## ✅ Completed Today

### 1. Settings API Routes - COMPLETE

**File Created**: `src/app/api/settings/route.ts`

**Features Implemented**:
- ✅ GET `/api/settings` - Fetch company settings
  - Authentication via NextAuth session
  - Returns company info, email settings, business hours
  - UAE-specific defaults (timezone, working days Sun-Thu)

- ✅ PATCH `/api/settings` - Update company settings
  - Admin-only access control (role check)
  - Zod validation for all fields
  - Supports partial updates
  - Activity logging for audit trail

**API Structure**:
```typescript
// GET Response
{
  id: string
  name: string
  trn?: string
  address?: string
  defaultVatRate: number
  emailSettings: {
    fromName: string
    replyTo: string
    signature: string
  }
  businessHours: {
    timezone: string
    workingDays: number[] // [0,1,2,3,4] = Sun-Thu
    startTime: string // "09:00"
    endTime: string // "18:00"
  }
  settings: {
    currency: string
    dateFormat: string
    language: 'en' | 'ar'
  }
}

// PATCH Request (all fields optional)
{
  name?: string
  trn?: string
  address?: string
  defaultVatRate?: number
  emailSettings?: {...}
  businessHours?: {...}
  settings?: {...}
}
```

**Key Design Decisions**:
1. **Admin-only updates**: Only ADMIN role can modify settings (prevents unauthorized changes)
2. **UAE defaults**: Automatic Dubai timezone, Sun-Thu working days
3. **Activity logging**: All changes tracked for audit compliance
4. **Zod validation**: Type-safe validation with clear error messages
5. **Partial updates**: Update only what's needed, preserve rest

---

## 📋 Remaining Work

### 2. Convert Settings Page to Client Component (2 hours)

**Current State**:
- Existing file: `src/app/[locale]/dashboard/settings/page.tsx` (501 lines)
- Status: Static UI mockup with 6 tabs (Company, Notifications, Integrations, Users, Billing, Security)
- Components: Already uses shadcn/ui (Card, Input, Tabs, etc.)

**Tasks**:
1. Add `"use client"` directive
2. Create state management for form fields
3. Implement `useEffect` to fetch settings on mount
4. Add loading and error states
5. Create save handler with PATCH request
6. Add toast notifications for success/error

**Approach**:
```typescript
"use client"

export default function SettingsPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data)
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (res.ok) toast.success('Settings saved')
    } catch (error) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ... rest of component
}
```

### 3. Wire Up Company Tab (1 hour)

**Fields to Connect**:
- Company Name → `settings.name`
- TRN → `settings.trn`
- Address → `settings.address`
- VAT Rate → `settings.defaultVatRate`

**Pattern**:
```typescript
<Input
  value={settings?.name || ''}
  onChange={(e) => setSettings({...settings, name: e.target.value})}
/>
```

### 4. Wire Up Email/Notifications Tab (1 hour)

**Fields to Connect**:
- From Name → `settings.emailSettings.fromName`
- Reply-To → `settings.emailSettings.replyTo`
- Signature → `settings.emailSettings.signature`

### 5. Test End-to-End (30 minutes)

**Test Cases**:
1. Load settings page - verify data loads
2. Update company name - verify save works
3. Update TRN - verify validation
4. Update email settings - verify save
5. Refresh page - verify changes persist
6. Non-admin user - verify blocked from editing

---

## Database Fields Used

**Company Model** (from `prisma/schema.prisma`):
```prisma
model Company {
  id                String    @id
  name              String
  trn               String?   @unique
  address           String?
  settings          Json?     @default("{}")
  businessHours     Json?     @map("business_hours")
  defaultVatRate    Decimal?  @default(5.00) @db.Decimal(5, 2)
  emailSettings     Json?     @map("email_settings")
  updatedAt         DateTime  @map("updated_at")
  // ... relations
}
```

**All settings stored in existing columns** - no schema changes needed!

---

## Week 3 Goals Progress

**Week 3 Deliverables** (Nov 15-21):
- ☐ E2E Test Suite Complete (100% pass rate) - **Deferred to after Settings**
- 🔄 Settings UI Built - **In Progress (40% complete)**
- ☐ Email Preview - **Pending**
- ☐ Bug Fixes - **As needed**

**Rational for Starting with Settings**:
1. Unblocks UAT - Users need to configure before testing
2. High value - Essential for production use
3. Independent - Doesn't depend on E2E tests
4. Lower complexity - Good warm-up for Week 3

---

## Next Session Plan

### Immediate Next Steps (3-4 hours)

**Step 1: Convert to Client Component** (60 minutes)
1. Backup existing file
2. Add "use client" and imports (useState, useEffect, toast)
3. Implement data fetching
4. Add loading/error states
5. Test data loads correctly

**Step 2: Wire Company Tab** (60 minutes)
1. Connect form fields to state
2. Implement controlled inputs
3. Add validation feedback
4. Test updates work

**Step 3: Wire Email Tab** (45 minutes)
1. Connect email settings fields
2. Add email format validation
3. Test signature field

**Step 4: Polish & Test** (45 minutes)
1. Add loading spinners
2. Add success/error toasts
3. Test with real user session
4. Test admin vs non-admin access
5. Verify persistence across page refreshes

### After Settings Complete

**Option A**: Continue with Email Preview (2-3 hours)
**Option B**: Complete E2E Auth Fix (2-3 hours) for 100% test pass rate

Recommend **Option B** (E2E fix) as it achieves Week 3 success metric directly.

---

## Technical Notes

### UAE Business Defaults

The API automatically provides UAE-appropriate defaults:

```typescript
businessHours: {
  timezone: 'Asia/Dubai',
  workingDays: [0, 1, 2, 3, 4], // Sun=0, Mon=1, ..., Thu=4
  startTime: '09:00',
  endTime: '18:00'
}

settings: {
  currency: 'AED',
  dateFormat: 'DD/MM/YYYY', // UAE standard
  language: 'en' // Can be changed to 'ar'
}
```

### Security Considerations

1. **Role-Based Access**: PATCH requires ADMIN role
   - Prevents FINANCE/VIEWER users from modifying settings
   - Returns 403 Forbidden if attempted

2. **Company Isolation**: All queries scoped to `session.user.companyId`
   - Multi-tenant data separation enforced
   - Impossible to access other companies' settings

3. **Activity Logging**: All changes tracked
   - Audit trail for compliance
   - Tracks who changed what and when

### Error Handling

API returns clear HTTP status codes:
- `200`: Success
- `400`: Validation error (with Zod error details)
- `401`: Unauthorized (no session)
- `403`: Forbidden (not admin)
- `404`: Company not found
- `500`: Server error

---

## Files Modified/Created

### Created
- `src/app/api/settings/route.ts` - Settings API (GET, PATCH)
- `claudedocs/WEEK3_SETTINGS_IN_PROGRESS_NOV_10.md` - This document

### To Modify
- `src/app/[locale]/dashboard/settings/page.tsx` - Convert to client component with data binding

---

## Success Criteria

Settings UI will be considered complete when:

1. ✅ API routes functional (GET, PATCH)
2. ☐ Page loads user's company settings
3. ☐ Company tab allows editing name, TRN, address, VAT
4. ☐ Email tab allows editing from name, reply-to, signature
5. ☐ Changes persist to database
6. ☐ Toast notifications show success/error
7. ☐ Admin-only access enforced
8. ☐ Loading states display properly
9. ☐ Validation errors show clearly
10. ☐ Works in real user session (not just localhost)

---

## Estimated Timeline

**Total Remaining**: ~3-4 hours
- Client component conversion: 1 hour
- Company tab wiring: 1 hour
- Email tab wiring: 45 minutes
- Testing & polish: 45 minutes
- Buffer for issues: 30 minutes

**Target Completion**: Next session (Nov 11 or later)

---

**Current Status**: Week 3 Settings UI - 40% Complete (API done, UI conversion next)

**Next Action**: Convert settings page to client component with data fetching
