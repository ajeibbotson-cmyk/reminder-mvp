# Auto-Send System

**Status**: ✅ Complete and deployed
**Implementation Date**: October 19-20, 2025

## Overview

Automated invoice reminder emails based on bucket configuration and due date rules, with intelligent scheduling and template support.

## Key Features

- Automatic reminder sending based on bucket rules
- Configurable timing per bucket (7, 14, 30 days)
- Template-based email customization
- Cron job integration (`/api/cron/auto-send`)
- Comprehensive logging and tracking

## Bucket Configuration

### Database Schema
```typescript
bucket_configs {
  id: string
  company_id: string
  name: string
  days_before_due: number
  days_after_due: number
  auto_send_enabled: boolean
  email_template_id?: string
  send_time?: string
  created_at: Date
  updated_at: Date
}
```

### Example Buckets
- **Bucket 1**: 7+ days before due (gentle reminder)
- **Bucket 2**: 1-6 days before due (urgent reminder)
- **Bucket 3**: Overdue (payment request)

## Implementation

### Core Files
- `src/app/api/cron/auto-send/route.ts` - Cron handler
- `src/app/api/bucket-configs/route.ts` - Bucket configuration API
- `src/app/api/invoices/buckets/route.ts` - Bucket data retrieval

### Auto-Send Logic
1. Cron job triggers every hour/day
2. Fetch all bucket configurations with auto_send_enabled
3. Find invoices matching bucket criteria
4. Send email using configured template
5. Log activity and update last_reminder_sent

## Testing Results

- ✅ Integration tests passing
- ✅ Bucket categorization working
- ✅ Email sending confirmed
- ✅ UI displays correct buckets

## Integration

Works seamlessly with:
- PDF attachment feature
- Reply-To header feature
- Template system
- Email tracking

## References

See `claudedocs/auto-send-*.md` files for detailed implementation and testing notes.
