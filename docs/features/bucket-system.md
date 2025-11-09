# Bucket System

**Status**: ✅ Complete and deployed
**Implementation Date**: October 1, 2025

## Overview

Visual organization of invoices into time-based buckets for better payment tracking and reminder management.

## Bucket Categories

### Bucket 1: Due Soon (7+ days before due)
- Color: Blue
- Priority: Low
- Action: Gentle reminder

### Bucket 2: Due Very Soon (1-6 days before due)
- Color: Yellow
- Priority: Medium
- Action: Urgent reminder

### Bucket 3: Overdue
- Color: Red
- Priority: High
- Action: Payment request

## Features

- Visual bucket cards on dashboard
- Invoice count per bucket
- Total amount per bucket
- Auto-send configuration per bucket
- Click to view invoices in bucket

## Implementation

### API Endpoints
- `GET /api/invoices/buckets` - Fetch bucket data
- `GET /api/bucket-configs` - Fetch configurations
- `POST /api/bucket-configs` - Create/update bucket config

### UI Components
- `src/components/dashboard/bucket-cards.tsx`
- `src/components/bucket-settings-modal.tsx`

## Configuration

### Bucket Settings
```typescript
{
  name: "Bucket 1: Due Soon",
  days_before_due: 7,
  days_after_due: null,
  auto_send_enabled: true,
  email_template_id: "template-id",
  send_time: "09:00"
}
```

## Benefits

✅ Visual invoice organization
✅ Clear priority indication
✅ Automated reminder triggers
✅ Easy bucket configuration
✅ Dashboard integration

## References

See `claudedocs/bucket-system-mvp-implementation-plan.md` for detailed implementation plan.
