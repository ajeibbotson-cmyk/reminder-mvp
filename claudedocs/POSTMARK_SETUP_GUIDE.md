# Postmark Setup Guide - Quick Start

**Date**: November 13, 2025
**Status**: ✅ Code Integration Complete - Ready for Postmark Account Setup
**Time to Complete**: 30-60 minutes

---

## What's Been Done ✅

### Code Changes Complete
- ✅ Postmark SDK installed (`postmark` + `@types/postmark`)
- ✅ EmailService class updated with Postmark provider
- ✅ `sendViaPostmark()` method implemented
- ✅ Environment variables documented in `.env.example`
- ✅ 5 webhook handlers created (bounce, open, click, delivery, complaint)
- ✅ Default provider changed to `postmark`

### Files Modified
1. **src/lib/email-service.ts** (Lines updated):
   - Line 30: Added `'postmark'` to provider type
   - Lines 40-41: Added `postmarkApiToken` and `postmarkServerId` to credentials
   - Lines 190-193: Added Postmark case in switch statement
   - Lines 465-528: Added complete `sendViaPostmark()` method
   - Lines 777-799: Updated `getDefaultEmailService()` with Postmark support

2. **.env.example**:
   - Lines 30-34: Added Postmark configuration section

3. **Webhook Handlers Created**:
   - `src/app/api/webhooks/postmark/bounce/route.ts`
   - `src/app/api/webhooks/postmark/open/route.ts`
   - `src/app/api/webhooks/postmark/click/route.ts`
   - `src/app/api/webhooks/postmark/delivery/route.ts`
   - `src/app/api/webhooks/postmark/complaint/route.ts`

---

## Next Steps: Postmark Account Setup

### Step 1: Create Postmark Account (10 minutes)

**1. Sign up at Postmark**:
- Go to: https://postmarkapp.com
- Click "Get started for free"
- Free trial includes $15 credit (~10,000 emails)
- No credit card required for trial

**2. Create Your Server**:
- After signup, you'll be prompted to create a "Server"
- Server Name: `Reminder Production`
- Server Type: **Transactional** (not Broadcast)
- Click "Create Server"

**3. Add Sender Signature**:
- Go to: Signatures → Add Sender Signature
- Select "Domain" (not single email address)
- Enter domain: `usereminder.com`
- Click "Verify Domain"

---

### Step 2: DNS Configuration (15 minutes)

Postmark will provide DNS records to add. You'll need to add these to **123-reg** (where your domain is registered):

**Records Postmark Will Provide**:

1. **DKIM Record** (1 CNAME):
   ```
   Type: CNAME
   Host: [unique-selector]._domainkey.usereminder.com
   Value: [postmark-value].dkim.postmarkapp.com
   TTL: 1 hour
   ```

2. **Return-Path Record** (1 CNAME):
   ```
   Type: CNAME
   Host: pm-bounces.usereminder.com
   Value: pm.mtasv.net
   TTL: 1 hour
   ```

**How to Add in 123-reg**:
1. Log into 123-reg account
2. Go to: Manage domain → DNS
3. Click "Add" for each record
4. Copy exact values from Postmark
5. Wait 15-30 minutes for DNS propagation

**Verify in Postmark**:
- Postmark checks DNS automatically
- Status will change from "Pending" to "Verified" (green checkmark)
- Usually takes 15-30 minutes

---

### Step 3: Get API Credentials (5 minutes)

**1. Get Server API Token**:
- In Postmark dashboard → Your server → API Tokens
- Find "Server API tokens" section
- Copy the token (starts with a long string of letters/numbers)
- **Save this securely** - you'll need it for environment variables

**2. Get Server ID**:
- In Postmark dashboard → Your server → Settings
- Look for "Server ID" (numeric, like `12345678`)
- **Save this** - you'll need it for environment variables

**3. Test API Token**:
Postmark provides a test command you can run:
```bash
curl "https://api.postmarkapp.com/server" \
  -X GET \
  -H "Accept: application/json" \
  -H "X-Postmark-Server-Token: YOUR_SERVER_API_TOKEN"
```

Should return your server details if token is valid.

---

### Step 4: Update Environment Variables (5 minutes)

**Local Development** (`.env.local`):

Add these lines to your `.env.local` file:

```env
# Email Provider Configuration
EMAIL_PROVIDER=postmark

# Postmark Configuration
POSTMARK_API_TOKEN=your-actual-server-api-token-here
POSTMARK_SERVER_ID=your-actual-server-id-here

# Email Settings
FROM_EMAIL=hello@usereminder.com
FROM_NAME=Reminder
REPLY_TO_EMAIL=support@usereminder.com
```

**Replace**:
- `your-actual-server-api-token-here` with the Server API Token from Step 3
- `your-actual-server-id-here` with the Server ID from Step 3

---

### Step 5: Configure Webhooks in Postmark (10 minutes)

**Purpose**: Webhooks let Postmark notify us in real-time about:
- Bounces (invalid email addresses)
- Opens (customer opened the email)
- Clicks (customer clicked links in email)
- Deliveries (email successfully delivered)
- Complaints (customer marked as spam)

**Setup in Postmark**:

1. Go to: Your server → Webhooks
2. Click "Add webhook"
3. **Add 5 webhooks** (one for each event type):

**Webhook 1 - Bounce**:
- URL: `https://reminder-mvp.vercel.app/api/webhooks/postmark/bounce`
- Events: ☑️ Bounce

**Webhook 2 - Open**:
- URL: `https://reminder-mvp.vercel.app/api/webhooks/postmark/open`
- Events: ☑️ Open

**Webhook 3 - Click**:
- URL: `https://reminder-mvp.vercel.app/api/webhooks/postmark/click`
- Events: ☑️ Click

**Webhook 4 - Delivery**:
- URL: `https://reminder-mvp.vercel.app/api/webhooks/postmark/delivery`
- Events: ☑️ Delivery

**Webhook 5 - Spam Complaint**:
- URL: `https://reminder-mvp.vercel.app/api/webhooks/postmark/complaint`
- Events: ☑️ Spam Complaint

4. Click "Save webhook" for each one
5. Click "Test" button to verify each webhook works

**Expected Test Result**: ✅ "HTTP 200 OK" response

---

### Step 6: Test Email Sending Locally (15 minutes)

**1. Start Development Server**:
```bash
npm run dev
```

**2. Create Test Script** (if not exists):

Create `scripts/test-postmark-email.ts`:

```typescript
import { getDefaultEmailService } from '../src/lib/email-service'

async function testPostmarkEmail() {
  console.log('🧪 Testing Postmark email sending...')

  const emailService = getDefaultEmailService()

  try {
    const emailLogId = await emailService.sendEmail({
      companyId: 'test-company-id',
      recipientEmail: 'your-email@example.com', // Replace with YOUR email
      recipientName: 'Test Recipient',
      subject: 'Postmark Test Email - Reminder Platform',
      content: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Postmark Integration Test</h2>
            <p>This is a test email from the Reminder platform using Postmark.</p>
            <p><strong>If you're seeing this, Postmark is working correctly!</strong></p>
            <hr/>
            <p style="color: #666; font-size: 12px;">
              Sent from Reminder - Invoice Management for UAE Businesses
            </p>
          </body>
        </html>
      `,
      language: 'ENGLISH',
      scheduleForBusinessHours: false
    })

    console.log('✅ Email sent successfully!')
    console.log('📧 Email Log ID:', emailLogId)
    console.log('📬 Check your inbox at: your-email@example.com')

  } catch (error) {
    console.error('❌ Email send failed:', error)
  }
}

testPostmarkEmail()
```

**3. Run Test**:
```bash
npx tsx scripts/test-postmark-email.ts
```

**Expected Output**:
```
🧪 Testing Postmark email sending...
[Postmark] Email sent successfully. MessageID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✅ Email sent successfully!
📧 Email Log ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
📬 Check your inbox at: your-email@example.com
```

**4. Verify in Postmark**:
- Go to: Your server → Activity
- You should see your test email listed
- Click on it to see delivery status, opens, clicks

**5. Check Your Inbox**:
- Email should arrive within 1-2 minutes
- Open the email (this will trigger open tracking webhook)
- Click any link (this will trigger click tracking webhook)

---

### Step 7: Update Vercel Production Environment Variables (10 minutes)

**1. Go to Vercel Dashboard**:
- Navigate to: https://vercel.com/dashboard
- Select project: `reminder-mvp`
- Go to: Settings → Environment Variables

**2. Add Postmark Variables**:

Click "Add New" for each:

| Name | Value | Environment |
|------|-------|-------------|
| `EMAIL_PROVIDER` | `postmark` | Production, Preview, Development |
| `POSTMARK_API_TOKEN` | `[your-server-api-token]` | Production, Preview, Development |
| `POSTMARK_SERVER_ID` | `[your-server-id]` | Production, Preview, Development |

**3. Redeploy**:
- After adding variables, trigger a redeploy
- Option 1: Go to Deployments → Click "..." → Redeploy
- Option 2: Push a commit to trigger auto-deploy

```bash
git add .
git commit -m "feat: integrate Postmark email provider"
git push
```

**4. Wait for Deployment**:
- Vercel will rebuild with new environment variables
- Takes 2-3 minutes typically
- Status: ✅ "Ready" when complete

---

### Step 8: Test Production Email Sending (10 minutes)

**Option 1: Test from Production Dashboard**

1. Log into production: https://reminder-mvp.vercel.app
2. Navigate to Invoices section
3. Create a test invoice
4. Send a payment reminder
5. Check Postmark Activity stream for delivery

**Option 2: Test Script Against Production**

Create `scripts/test-production-postmark.ts`:

```typescript
// Similar to test script but hits production API endpoint
async function testProductionEmail() {
  const response = await fetch('https://reminder-mvp.vercel.app/api/email/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-test-api-key'
    },
    body: JSON.stringify({
      recipientEmail: 'your-email@example.com',
      subject: 'Production Postmark Test',
      message: 'Testing Postmark from production deployment'
    })
  })

  console.log('Production test result:', await response.json())
}
```

**Run**:
```bash
npx tsx scripts/test-production-postmark.ts
```

---

## Monitoring & Validation

### Check Postmark Activity Stream

**Go to**: Your server → Activity

**What to Monitor**:
- ✅ Deliveries: Should be 95%+ (green)
- ⚠️ Bounces: Should be <2% (yellow if higher)
- 🚨 Spam Complaints: Should be <0.1% (red if any)
- 📊 Opens: Track engagement rates
- 🔗 Clicks: Track call-to-action effectiveness

### Check Database Email Logs

**Query**:
```sql
SELECT
  delivery_status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY delivery_status
ORDER BY count DESC;
```

**Expected Results**:
- `DELIVERED`: 95%+
- `OPENED`: 40-60% (typical for B2B)
- `CLICKED`: 20-40% (if call-to-action is clear)
- `BOUNCED`: <2%
- `COMPLAINED`: <0.1%

### Check Webhook Processing

**Query**:
```sql
-- Check bounce tracking
SELECT COUNT(*) FROM email_bounce_tracking WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check open tracking
SELECT COUNT(*) FROM email_open_tracking WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check click tracking
SELECT COUNT(*) FROM email_click_tracking WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Troubleshooting

### Issue: "Invalid Postmark API token"

**Cause**: Wrong token or missing from environment variables

**Fix**:
1. Check `.env.local` has correct `POSTMARK_API_TOKEN`
2. Verify token in Postmark dashboard → API Tokens
3. Restart dev server: `npm run dev`

---

### Issue: "Sender signature not confirmed"

**Cause**: Domain not verified in Postmark

**Fix**:
1. Check Postmark dashboard → Signatures
2. Verify DNS records are correct in 123-reg
3. Wait 15-30 minutes for DNS propagation
4. Click "Verify" in Postmark

---

### Issue: Email delivered but webhooks not firing

**Cause**: Webhook URLs incorrect or server not reachable

**Fix**:
1. Verify webhook URLs in Postmark match production domain
2. Test webhooks using Postmark's "Test" button
3. Check server logs for webhook errors
4. Verify API routes exist: `/api/webhooks/postmark/*`

---

### Issue: Emails going to spam

**Cause**: Domain not fully authenticated or content issues

**Fix**:
1. Verify DKIM record in Postmark (green checkmark)
2. Verify Return-Path record
3. Check email content for spam triggers:
   - Avoid ALL CAPS subject lines
   - Include clear unsubscribe link
   - Use professional sender name
   - Avoid spam words ("FREE", "GUARANTEE", etc.)

---

## Success Criteria

Before considering migration complete, verify:

- [ ] Domain verified in Postmark (green checkmark)
- [ ] Test email sent and received successfully
- [ ] Open tracking works (webhook fires, database updated)
- [ ] Click tracking works (webhook fires, database updated)
- [ ] Bounce handling works (hard bounce suppresses email)
- [ ] Production environment variables configured
- [ ] Production email sending works
- [ ] Postmark Activity stream shows deliveries
- [ ] Database email_logs table populated correctly
- [ ] Webhook handlers processing events

---

## Rollback Plan

If issues occur, rollback is instant:

**1. Change Environment Variable**:
```env
EMAIL_PROVIDER=aws-ses
```

**2. Redeploy or Restart**:
```bash
# Local
npm run dev

# Production (Vercel)
# Triggers automatic redeploy
git commit --allow-empty -m "Rollback to AWS SES"
git push
```

**3. Done** - emails will route through AWS SES again

---

## Post-Migration Benefits

### Immediate:
- ✅ **95%+ deliverability** (vs AWS SES 90-93%)
- ✅ **Open/click tracking** (prove ROI to clients)
- ✅ **Real-time bounce handling** (protect sender reputation)
- ✅ **No sandbox restrictions** (send to any email)

### Business:
- ✅ **Launch beta on schedule** (Dec 2025)
- ✅ **Prove DSO reduction** (with engagement data)
- ✅ **Professional image** (reliable email delivery)
- ✅ **Client confidence** (high deliverability rates)

### Technical:
- ✅ **Cleaner API** (less code, more features)
- ✅ **Better webhooks** (real-time event processing)
- ✅ **Easier debugging** (Postmark Activity stream)
- ✅ **Future-proof** (easy provider switching via env var)

---

## Support & Resources

**Postmark Documentation**:
- Getting Started: https://postmarkapp.com/developer/user-guide/getting-started
- API Reference: https://postmarkapp.com/developer/api/overview
- Webhook Reference: https://postmarkapp.com/developer/webhooks/webhooks-overview

**Postmark Support**:
- Email: support@postmarkapp.com
- Response time: Usually < 4 hours
- Chat: Available in dashboard

**Internal Resources**:
- Code: `/src/lib/email-service.ts`
- Webhooks: `/src/app/api/webhooks/postmark/*`
- Migration Plan: `/claudedocs/POSTMARK_MIGRATION_PLAN.md`

---

**Status**: Ready to begin Postmark account setup
**Next Step**: Go to https://postmarkapp.com and create your account
**Time Estimate**: 30-60 minutes total

---

**Last Updated**: November 13, 2025
