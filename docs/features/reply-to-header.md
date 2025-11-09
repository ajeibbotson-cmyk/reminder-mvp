# Reply-To Header Feature

**Status**: ✅ Complete and deployed
**Implementation Date**: October 30, 2025

## Overview

Configurable Reply-To header functionality for professional email communication and proper reply routing to finance/sales teams.

## Key Features

- Company-level default Reply-To configuration
- Intelligent fallback to customer email
- Graceful degradation if Reply-To unavailable
- Works with both MIME and standard emails
- No database migrations required

## Configuration

### Company Settings
```sql
UPDATE companies
SET email_settings = '{"replyTo": "finance@yourcompany.com"}'
WHERE id = 'company-id';
```

### Priority Logic
1. Company default Reply-To (`companies.email_settings.replyTo`)
2. Customer email from invoice (fallback)
3. No Reply-To header (graceful degradation)

## Implementation

### Core Changes
- `src/lib/services/unifiedEmailService.ts`:
  - `getReplyToAddress()` method
  - Updated `buildMimeEmailWithAttachment()`
  - Updated `sendEmailWithoutAttachment()`

### AWS SES Compatibility
- Works with SendRawEmailCommand (MIME)
- Works with SendEmailCommand (standard)
- RFC 5322 compliant
- No impact on DKIM/SPF authentication

## Benefits

✅ Professional email communication
✅ Proper reply routing to teams
✅ Better customer experience
✅ Organized email threads
✅ Foundation for customer settings UI

## Future Enhancements

- Phase 2: Settings UI for easy configuration
- Customer-level Reply-To overrides
- Per-template Reply-To customization

## References

See `claudedocs/reply-to-header-implementation.md` and `claudedocs/reply-to-session-summary.md` for detailed implementation notes.
