# Start This Afternoon - Week 1, Day 1

**Goal**: Begin Week 1 with AWS SES email reliability foundation

**Total Time**: ~8 hours (full afternoon + evening session)

---

## ✅ Pre-Flight Check (5 minutes)

### Infrastructure Status
- ✅ **AWS Credentials**: Configured in `.env`
- ✅ **S3 Bucket**: `reminder-mvp-textract-pdfs` created
- ✅ **Database**: PostgreSQL via Supabase ready
- ✅ **PDF Extraction**: 100% success rate with Textract async
- ⚠️ **AWS SES**: Domain NOT verified yet (first priority today)

### Current Environment
```bash
AWS_ACCESS_KEY_ID="[configured in .env]"
AWS_SECRET_ACCESS_KEY="[configured in .env]"
AWS_REGION="us-east-1"
AWS_SES_FROM_EMAIL=""  # ← EMPTY - Need to verify domain
```

---

## 📋 Day 1 Tasks (4 tasks, ~8 hours)

### Task 1: AWS SES Domain Verification (2 hours)

**What**: Verify sending domain in AWS SES for production email delivery

**Steps**:
1. **Choose sending domain** (10 min)
   - Option A: `noreply@reminder.com` (if you own reminder.com)
   - Option B: `noreply@poptradingcompany.com` (use your own domain)
   - Decision: Which domain do you want to send reminders FROM?

2. **Verify domain in AWS SES Console** (30 min)
   - Go to AWS Console → SES → Verified Identities
   - Click "Create Identity" → Domain
   - Enter your domain (e.g., `poptradingcompany.com`)
   - AWS will provide DNS records (DKIM, SPF, DMARC)

3. **Add DNS records to domain registrar** (45 min)
   - Copy DKIM records (3 CNAME records)
   - Copy SPF record (1 TXT record)
   - Copy DMARC record (1 TXT record)
   - Add to your domain's DNS settings (GoDaddy, Namecheap, etc.)
   - Wait for DNS propagation (5-30 minutes)

4. **Verify domain verification** (15 min)
   - Check AWS SES console for "Verified" status
   - Update `.env`: `AWS_SES_FROM_EMAIL="noreply@yourdomain.com"`
   - Restart dev server

**Deliverable**: Domain verified in AWS SES, `.env` updated

**Success Criteria**: AWS SES shows "Verified" status in console

---

### Task 2: Request Production Access (if needed) (30 min)

**What**: AWS SES starts in "sandbox mode" - can only send to verified emails

**Check if needed**:
```bash
# Run this to check SES sending limits
aws ses get-account-sending-enabled --region us-east-1
```

**If in sandbox**:
1. AWS Console → SES → Account dashboard
2. Click "Request production access"
3. Fill out form:
   - Use case: "Invoice payment reminders for UAE businesses"
   - Website: (your website or "In development")
   - Expected volume: "500 emails/month initially"
   - Bounce/complaint rate: "< 1% (payment reminders to verified customers)"
4. Submit request

**Note**: Approval takes 24 hours. For TODAY'S testing, verify test email addresses in SES.

**Deliverable**: Production access requested OR test email verified for today

---

### Task 3: Implement Email Service (3 hours)

**What**: Create `email-service.ts` with AWS SES integration and error handling

**File**: `src/lib/services/email-service.ts`

**Implementation**:
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export interface SendEmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent: string
  fromEmail?: string
}

export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean
  messageId?: string
  error?: string
}> {
  try {
    const command = new SendEmailCommand({
      Source: params.fromEmail || process.env.AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: params.htmlContent,
            Charset: 'UTF-8',
          },
          Text: {
            Data: params.textContent,
            Charset: 'UTF-8',
          },
        },
      },
    })

    const response = await sesClient.send(command)

    console.log('Email sent successfully:', {
      messageId: response.MessageId,
      to: params.to,
      subject: params.subject,
    })

    return {
      success: true,
      messageId: response.MessageId,
    }
  } catch (error) {
    console.error('Email send failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**Steps**:
1. Create file `src/lib/services/email-service.ts` (30 min)
2. Add AWS SES SDK dependency check (already in package.json)
3. Implement basic `sendEmail` function (1 hour)
4. Add comprehensive logging (30 min)
5. Create email templates (simple HTML + text versions) (1 hour)

**Deliverable**: `email-service.ts` with send capability

**Success Criteria**: File compiles without errors, exports `sendEmail` function

---

### Task 4: Send First Test Email (1 hour)

**What**: Verify email service works end-to-end

**Create test script**: `scripts/test-email-send.js`

```javascript
const { sendEmail } = require('../src/lib/services/email-service')

async function testEmailSend() {
  console.log('🧪 Testing AWS SES email send...\n')

  const result = await sendEmail({
    to: 'your-email@example.com',  // ← Use YOUR email
    subject: 'Reminder Test Email - Invoice Payment Reminder',
    htmlContent: `
      <h2>Test Invoice Reminder</h2>
      <p>Dear Customer,</p>
      <p>This is a test email from the Reminder platform.</p>
      <p><strong>Invoice #:</strong> TEST-001</p>
      <p><strong>Amount Due:</strong> AED 1,000.00</p>
      <p><strong>Due Date:</strong> October 10, 2025</p>
      <p>If you have already paid, please disregard this message.</p>
      <p>Best regards,<br>POP Trading Company</p>
    `,
    textContent: `
      Test Invoice Reminder

      Dear Customer,

      This is a test email from the Reminder platform.

      Invoice #: TEST-001
      Amount Due: AED 1,000.00
      Due Date: October 10, 2025

      If you have already paid, please disregard this message.

      Best regards,
      POP Trading Company
    `,
  })

  if (result.success) {
    console.log('✅ Email sent successfully!')
    console.log('📧 Message ID:', result.messageId)
    console.log('📬 Check your inbox:', 'your-email@example.com')
  } else {
    console.error('❌ Email send failed:', result.error)
  }
}

testEmailSend()
```

**Steps**:
1. Create test script (15 min)
2. Update with YOUR email address (5 min)
3. Run test: `node scripts/test-email-send.js` (5 min)
4. Check inbox for email (10 min)
5. Verify email looks good (HTML rendering, content) (10 min)
6. Test error scenarios (invalid email, missing env vars) (15 min)

**Deliverable**: Successful test email received in inbox

**Success Criteria**: Email appears in inbox with proper formatting

---

## 🎯 Day 1 Success Criteria

By end of today, you should have:
- ✅ AWS SES domain verified (or test email verified)
- ✅ `email-service.ts` implemented
- ✅ First test email sent and received successfully
- ✅ Confidence in AWS SES integration

---

## 🚧 Parallel Work (Optional, if time permits)

### Fix 10 Critical Test Failures (2 hours)

**What**: Begin fixing test infrastructure to enable validation

**Steps**:
1. Run test suite: `npm run test`
2. Identify 10 critical failing tests (auth, database, core features)
3. Fix test infrastructure issues (mocking, environment setup)
4. Re-run tests to verify fixes

**Note**: This is OPTIONAL for Day 1. Email reliability is the priority.

---

## 📝 Day 1 Checklist

Before ending today's session:
- [ ] AWS SES domain verified (or test email verified for sandbox testing)
- [ ] `.env` updated with `AWS_SES_FROM_EMAIL`
- [ ] `email-service.ts` created and working
- [ ] Test email sent successfully to YOUR inbox
- [ ] Email formatting looks professional (HTML + text versions)
- [ ] Error handling tested (invalid email, missing credentials)
- [ ] Git commit: "feat: implement AWS SES email service with test validation"

---

## 🚀 What's Next (Day 2)

**Tomorrow's Focus**: Retry logic + bulk email testing

**Tasks**:
1. Implement exponential backoff retry logic (3 hours)
2. Add bounce/complaint handlers (1 hour)
3. Bulk email testing - send 100 test emails (3 hours)
4. Verify 99%+ delivery rate (1 hour)

**Deliverable**: Email system proven reliable at scale (100 emails)

---

## 🆘 Troubleshooting

### Domain verification stuck?
- DNS propagation can take up to 48 hours (usually <30 min)
- Use `dig` or `nslookup` to check DNS records
- Verify records added to correct domain (not subdomain)

### Email not arriving?
- Check spam folder
- Verify `AWS_SES_FROM_EMAIL` matches verified domain/email
- Check AWS SES sending statistics for bounces/complaints
- Ensure SES is out of sandbox OR recipient email is verified

### AWS credentials error?
- Verify `.env` has correct `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Check IAM user has `ses:SendEmail` permission
- Restart dev server after `.env` changes

---

## 💡 Key Insight

**Today's work validates the FIRST link in the quality chain**:
- Email reliability is foundational - if emails don't send, nothing else matters
- 99%+ delivery rate is non-negotiable for customer trust
- Starting with single email → bulk testing → retry logic ensures solid foundation

**The "Type SEND" authorization flow depends on reliable email delivery. We build this first.**
