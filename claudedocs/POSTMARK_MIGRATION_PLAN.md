# Postmark Migration Plan - AWS SES Replacement

**Date**: November 12, 2025
**Reason**: AWS SES production access denied
**Target**: Postmark (superior deliverability for transactional email)
**Timeline**: 2-4 hours total

---

## Why Postmark is Perfect for Reminder

### Your Friend Claude Was Right ✅

**Deliverability Obsession** (95%+ inbox placement):
- Reject customers who harm sender reputation
- Dedicated IP pools for transactional vs broadcast
- Real-time blacklist monitoring
- Built for invoice reminders (your exact use case)

**Critical Data for DSO Reduction**:
- ✅ **Open tracking** - Did customer see reminder?
- ✅ **Link tracking** - Did they click to pay?
- ✅ **Delivery confirmation** - Did it reach inbox?
- ✅ **Bounce categorization** - Was email invalid?

This data proves ROI to clients: "Reminders delivered 95%, opened 65%, clicked 40% → Payment in 3 days average"

**Approval Process**:
- Fast approval for legitimate business (usually same day)
- Transparent about requirements
- No vague rejections like AWS

---

## Current Email Architecture Analysis

You have 3 email service files with different purposes:

### 1. `/src/lib/services/email-service.ts` (Main Production Service)
**Purpose**: AWS SES integration with retry logic, database logging
**Lines**: 459
**Key Features**:
- AWS SES client setup
- Comprehensive retry logic (3 attempts, exponential backoff)
- Database logging to `email_logs` table
- Invoice reminder templates
- Error handling with helpful messages

**This is your MAIN service** ✅

### 2. `/src/lib/email.ts` (Simple Wrapper)
**Purpose**: Basic AWS SES wrapper with templates
**Lines**: 250
**Key Features**:
- Simple send email function
- Template rendering with `{{variables}}`
- UAE-specific formatting
- Default follow-up templates (polite, firm, final)

**Usage**: Looks like a simpler alternative or early version

### 3. `/src/lib/email-service.ts` (Advanced Multi-Provider Class)
**Purpose**: Email service class with multi-provider support
**Lines**: 748
**Key Features**:
- Already has `sendViaSendGrid()` and `sendViaSMTP()` methods!
- UAE business hours scheduling
- Email suppression checking
- Template variable processing
- Bulk email sending with rate limiting
- Email analytics tracking
- **Already has provider abstraction** ✅

---

## Migration Strategy

###Option 1: Extend Existing EmailService Class (RECOMMENDED)

Your `email-service.ts` class already has provider abstraction! We just need to add Postmark:

**Current providers**:
```typescript
switch (this.config.provider) {
  case 'aws-ses': // exists
  case 'sendgrid': // exists (stub)
  case 'smtp': // exists (stub)
}
```

**Add Postmark**:
```typescript
case 'postmark':
  result = await this.sendViaPostmark(subject, content, recipientEmail, recipientName)
  break
```

**Advantages**:
- Minimal code changes
- Keep all existing features (retry, logging, analytics)
- Easy to switch providers via env variable
- Future-proof (can switch back to SES or try others)

---

## Step-by-Step Migration Plan

### Phase 1: Setup Postmark Account (20 minutes)

**1. Create Postmark Account**:
- Go to: https://postmarkapp.com
- Sign up (free trial: $15 credit, ~10k emails)
- No credit card required for trial

**2. Verify Your Domain**:
- Add `usereminder.com` as sender signature
- Add DNS records (DKIM, Return-Path)
- Usually verified in 15-30 minutes

**3. Get API Credentials**:
- Server API Token (for sending)
- Server ID (for tracking)
- Copy both to safe place

**4. Set Up Postmark Transactional Stream**:
- Create "Transactional" stream (not Broadcast)
- Enable open tracking
- Enable link tracking
- Set up webhooks (for bounces, opens, clicks)

---

### Phase 2: Install Postmark SDK (5 minutes)

```bash
npm install postmark
npm install @types/postmark --save-dev
```

**Postmark SDK is excellent**:
- TypeScript native
- Promise-based
- Comprehensive error handling
- Webhook validation built-in

---

### Phase 3: Add Postmark to EmailService Class (1 hour)

**File**: `src/lib/email-service.ts`

**Changes Required**:

**1. Update EmailServiceConfig interface** (line ~29):
```typescript
export interface EmailServiceConfig {
  provider: 'aws-ses' | 'sendgrid' | 'smtp' | 'postmark'  // Add postmark
  credentials: {
    // ... existing fields ...
    postmarkApiToken?: string  // Add this
    postmarkServerId?: string  // Add this
  }
  // ... rest stays same ...
}
```

**2. Add sendViaPostmark method** (after line ~453):
```typescript
/**
 * Send via Postmark (production transactional email)
 */
private async sendViaPostmark(
  subject: string,
  content: string,
  recipientEmail: string,
  recipientName?: string
): Promise<{ messageId: string }> {
  const { ServerClient } = await import('postmark')

  const client = new ServerClient(this.config.credentials.postmarkApiToken!)

  const toAddress = recipientName ?
    `${recipientName} <${recipientEmail}>` :
    recipientEmail

  const fromAddress = this.config.fromName ?
    `${this.config.fromName} <${this.config.fromEmail}>` :
    this.config.fromEmail

  try {
    const result = await client.sendEmail({
      From: fromAddress,
      To: toAddress,
      Subject: subject,
      HtmlBody: content,
      TextBody: this.stripHtml(content),
      ReplyTo: this.config.replyTo,
      MessageStream: 'outbound', // Postmark transactional stream
      TrackOpens: true,
      TrackLinks: 'HtmlAndText',
      Tag: 'invoice-reminder', // For analytics
      Metadata: {
        environment: process.env.NODE_ENV || 'development',
        service: 'Reminder-UAE'
      }
    })

    if (!result.MessageID) {
      throw new Error('Postmark did not return MessageID')
    }

    console.log(`[Postmark] Email sent successfully. MessageID: ${result.MessageID}`)
    return { messageId: result.MessageID }

  } catch (error: any) {
    console.error(`[Postmark] Failed to send email to ${recipientEmail}:`, error)

    // Enhanced error handling for Postmark
    if (error.code === 300) {
      throw new Error('Invalid email request. Check sender signature.')
    } else if (error.code === 400) {
      throw new Error('Sender signature not confirmed in Postmark.')
    } else if (error.code === 401) {
      throw new Error('Invalid Postmark API token.')
    } else if (error.code === 422) {
      throw new Error(`Invalid recipient: ${error.message}`)
    } else if (error.code === 429) {
      throw new Error('Postmark rate limit exceeded.')
    } else if (error.code === 500) {
      throw new Error('Postmark server error. Will retry.')
    } else {
      throw new Error(`Postmark delivery failed: ${error.message || 'Unknown error'}`)
    }
  }
}
```

**3. Update switch statement** (line ~183-198):
```typescript
switch (this.config.provider) {
  case 'aws-ses':
    result = await this.sendViaAWSSES(subject, content, recipientEmail, recipientName)
    messageId = result.messageId
    break
  case 'postmark':  // ADD THIS
    result = await this.sendViaPostmark(subject, content, recipientEmail, recipientName)
    messageId = result.messageId
    break
  case 'sendgrid':
    result = await this.sendViaSendGrid(subject, content, recipientEmail, recipientName)
    messageId = result.messageId
    break
  case 'smtp':
    result = await this.sendViaSMTP(subject, content, recipientEmail, recipientName)
    messageId = result.messageId
    break
  default:
    throw new Error(`Unsupported email provider: ${this.config.provider}`)
}
```

**4. Update getDefaultEmailService function** (line ~702):
```typescript
export const getDefaultEmailService = (): EmailService => {
  const provider = (process.env.EMAIL_PROVIDER || 'postmark') as 'aws-ses' | 'postmark' | 'sendgrid' | 'smtp'

  const config: EmailServiceConfig = {
    provider,
    credentials: {
      // AWS SES (fallback)
      accessKey: process.env.AWS_ACCESS_KEY_ID,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'me-south-1',
      // Postmark (primary)
      postmarkApiToken: process.env.POSTMARK_API_TOKEN,
      postmarkServerId: process.env.POSTMARK_SERVER_ID,
      // SendGrid (alternative)
      apiKey: process.env.SENDGRID_API_KEY,
    },
    fromEmail: process.env.FROM_EMAIL || 'hello@usereminder.com',
    fromName: process.env.FROM_NAME || 'Reminder',
    replyTo: process.env.REPLY_TO_EMAIL,
    maxRetries: 3,
    retryDelayMs: 5000
  }

  return new EmailService(config)
}
```

---

### Phase 4: Update Environment Variables (5 minutes)

**Local Development** (`.env.local`):
```env
# Email Provider Configuration
EMAIL_PROVIDER=postmark

# Postmark Configuration
POSTMARK_API_TOKEN=your-server-api-token-here
POSTMARK_SERVER_ID=your-server-id-here

# Email Settings
FROM_EMAIL=hello@usereminder.com
FROM_NAME=Reminder
REPLY_TO_EMAIL=support@usereminder.com

# Legacy AWS SES (keep for fallback)
AWS_ACCESS_KEY_ID=AKIA2NVKJ4PUBMN57APT
AWS_SECRET_ACCESS_KEY=gT5AF6i...
AWS_REGION=us-east-1
```

**Vercel Production**:
1. Go to Vercel Dashboard → reminder-mvp → Settings → Environment Variables
2. Add new variables:
   - `EMAIL_PROVIDER` = `postmark`
   - `POSTMARK_API_TOKEN` = `[your token]`
   - `POSTMARK_SERVER_ID` = `[your server id]`
3. Redeploy

---

### Phase 5: Set Up Postmark Webhooks (30 minutes)

**Purpose**: Track opens, clicks, bounces, complaints in real-time

**Webhook Endpoints to Create**:

**1. Bounce Webhook** → `/api/webhooks/postmark/bounce`
**2. Open Webhook** → `/api/webhooks/postmark/open`
**3. Click Webhook** → `/api/webhooks/postmark/click`
**4. Delivery Webhook** → `/api/webhooks/postmark/delivery`
**5. Spam Complaint** → `/api/webhooks/postmark/complaint`

**Example Webhook Handler**: `src/app/api/webhooks/postmark/bounce/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailSuppressionService } from '@/lib/services/email-suppression-service'

export async function POST(request: NextRequest) {
  try {
    const webhook = await request.json()

    // Postmark bounce webhook format
    const {
      MessageID,
      RecordType, // "Bounce"
      Type, // "HardBounce" or "SoftBounce"
      TypeCode, // Numeric code
      Email, // Recipient email
      BouncedAt, // ISO timestamp
      Description,
      Details,
      Inactive // true if email is permanently suppressed
    } = webhook

    // Find email log by Postmark MessageID
    const emailLog = await prisma.emailLog.findFirst({
      where: { awsMessageId: MessageID } // We store Postmark MessageID here too
    })

    if (!emailLog) {
      console.warn(`Email log not found for MessageID: ${MessageID}`)
      return NextResponse.json({ received: true })
    }

    // Update email log with bounce info
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        deliveryStatus: 'BOUNCED',
        bouncedAt: new Date(BouncedAt),
        bounceReason: `${Type}: ${Description}`,
        updatedAt: new Date()
      }
    })

    // Add to suppression list if hard bounce or permanently inactive
    if (Type === 'HardBounce' || Inactive) {
      await emailSuppressionService.suppressEmail(
        Email,
        emailLog.companyId,
        'HARD_BOUNCE',
        Description
      )
    }

    // Create bounce tracking record
    await prisma.emailBounceTracking.create({
      data: {
        id: crypto.randomUUID(),
        emailLogId: emailLog.id,
        bounceType: Type.toLowerCase().includes('hard') ? 'hard' : 'soft',
        bounceSubtype: Description,
        diagnosticCode: `Postmark TypeCode: ${TypeCode}`,
        arrivalDate: new Date(BouncedAt)
      }
    })

    console.log(`✅ Processed bounce webhook for ${Email}: ${Type}`)

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('❌ Postmark bounce webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
```

**Configure in Postmark**:
1. Settings → Webhooks
2. Add webhook URL: `https://reminder-mvp.vercel.app/api/webhooks/postmark/bounce`
3. Select events: Bounce, Open, Click, Delivery, SpamComplaint
4. Save and test

---

### Phase 6: Update Database Schema (Optional - 10 minutes)

Your `email_logs` table already has most fields needed. May want to add:

```sql
-- Add Postmark-specific tracking fields (optional)
ALTER TABLE email_logs
  ADD COLUMN postmark_message_id VARCHAR(255),
  ADD COLUMN open_count INTEGER DEFAULT 0,
  ADD COLUMN click_count INTEGER DEFAULT 0,
  ADD COLUMN first_opened_at TIMESTAMP,
  ADD COLUMN last_opened_at TIMESTAMP,
  ADD COLUMN first_clicked_at TIMESTAMP,
  ADD COLUMN last_clicked_at TIMESTAMP;

-- Index for webhook lookups
CREATE INDEX idx_email_logs_postmark_message_id ON email_logs(postmark_message_id);
```

Or reuse existing fields:
- `awsMessageId` → Store Postmark MessageID (it's just a string)
- `openedAt` → Already exists
- `clickedAt` → Already exists

---

### Phase 7: Testing (1 hour)

**1. Local Testing**:
```bash
# Test sending single email
npx tsx scripts/test-email-send.ts

# Test invoice reminder
npx tsx scripts/test-invoice-reminder.ts
```

**2. Postmark Activity Stream**:
- Go to Postmark Dashboard → Activity
- See real-time email delivery
- Click on email to see open/click tracking
- Verify recipient received email

**3. Check Database**:
```sql
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;
```

**4. Test Webhooks**:
- Send test email to invalid@example.com (will bounce)
- Check if bounce webhook processes correctly
- Verify suppression list updated

---

### Phase 8: Production Deployment (15 minutes)

**1. Commit Changes**:
```bash
git add .
git commit -m "feat: migrate from AWS SES to Postmark for email delivery"
git push
```

**2. Vercel Auto-Deploy**:
- Vercel detects push
- Builds and deploys automatically
- Email provider switches to Postmark

**3. Smoke Test Production**:
```bash
# Test production email sending
TEST_ENV=production npx tsx scripts/test-email-send.ts
```

**4. Monitor First 24 Hours**:
- Watch Postmark Activity stream
- Check delivery rates (should be 95%+)
- Monitor bounce rates (should be <2%)
- Verify webhook processing

---

## Migration Checklist

### Pre-Migration
- [ ] Create Postmark account
- [ ] Verify usereminder.com domain
- [ ] Get API token and Server ID
- [ ] Set up Transactional stream
- [ ] Enable open & link tracking

### Code Changes
- [ ] Install `postmark` npm package
- [ ] Add Postmark to EmailServiceConfig
- [ ] Implement sendViaPostmark() method
- [ ] Update provider switch statement
- [ ] Update getDefaultEmailService()
- [ ] Add environment variables

### Webhook Setup
- [ ] Create webhook endpoint files
- [ ] Implement bounce handling
- [ ] Implement open tracking
- [ ] Implement click tracking
- [ ] Configure webhooks in Postmark
- [ ] Test webhook delivery

### Testing
- [ ] Test locally with Postmark
- [ ] Verify database logging works
- [ ] Test bounce handling
- [ ] Test open/click tracking
- [ ] Run E2E tests with Postmark

### Deployment
- [ ] Add Vercel environment variables
- [ ] Deploy to production
- [ ] Test production email sending
- [ ] Monitor first emails
- [ ] Verify analytics tracking

### Post-Migration
- [ ] Monitor delivery rates (24-48 hours)
- [ ] Check bounce/complaint rates
- [ ] Verify webhook processing
- [ ] Update documentation
- [ ] Remove AWS SES references (optional)

---

## Postmark vs AWS SES Comparison

| Feature | AWS SES | Postmark |
|---------|---------|----------|
| **Approval** | ❌ Rejected you | ✅ Fast approval for legit business |
| **Deliverability** | ~90-93% | ✅ 95%+ (industry-leading) |
| **Open Tracking** | ❌ Manual setup | ✅ Built-in, easy |
| **Click Tracking** | ❌ Manual setup | ✅ Built-in, easy |
| **Bounce Handling** | ⚠️ Complex SNS setup | ✅ Real-time webhooks |
| **API Quality** | ⚠️ Complex, verbose | ✅ Simple, elegant |
| **Documentation** | ⚠️ Overwhelming | ✅ Clear, practical |
| **Support** | ⚠️ Slow, impersonal | ✅ Fast, helpful |
| **Pricing (10k emails)** | $1 | $15 (~$10 after trial) |
| **Focus** | ⚠️ Generic email | ✅ **Transactional specialist** |

---

## Rollback Plan

If Postmark has issues, rollback is simple:

**1. Change env variable**:
```env
EMAIL_PROVIDER=aws-ses
```

**2. Redeploy** (or restart if local)

**3. Done** - emails go through AWS SES again

Your code supports multiple providers, so switching is instant!

---

## Post-Migration Benefits

### Immediate Benefits:
- ✅ **Emails actually send** (no more AWS sandbox)
- ✅ **95%+ deliverability** (vs 90-93% with SES)
- ✅ **Open/click tracking** (prove ROI to clients)
- ✅ **Real-time bounce handling** (protect reputation)
- ✅ **Better support** (respond in hours, not days)

### Business Benefits:
- ✅ **Launch beta on time** (Dec 2025)
- ✅ **Prove DSO reduction** (with open/click data)
- ✅ **Professional image** (high deliverability)
- ✅ **Client trust** (reliable email delivery)

### Technical Benefits:
- ✅ **Cleaner API** (less code, more features)
- ✅ **Better webhooks** (real-time events)
- ✅ **Easier debugging** (activity stream)
- ✅ **Future-proof** (can switch providers easily)

---

## Timeline Summary

**Total Time**: 2-4 hours

- Phase 1: Postmark setup (20 min)
- Phase 2: Install SDK (5 min)
- Phase 3: Add to EmailService (1 hour)
- Phase 4: Environment variables (5 min)
- Phase 5: Webhooks (30 min)
- Phase 6: Database (10 min, optional)
- Phase 7: Testing (1 hour)
- Phase 8: Deployment (15 min)

**Can start sending emails**: After Phase 4 (1.5 hours)
**Full production-ready**: After Phase 8 (3-4 hours)

---

## Next Steps

**Ready to start migration?** I can:

1. ✅ Walk you through Postmark signup
2. ✅ Write the Postmark integration code
3. ✅ Set up webhook handlers
4. ✅ Test everything end-to-end
5. ✅ Deploy to production

**What would you like to do first?**

---

**Last Updated**: November 12, 2025
**Status**: Ready to begin migration
**Recommendation**: Proceed with Postmark - it's the right choice for Reminder
