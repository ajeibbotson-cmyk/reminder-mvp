# Week 1: AWS SES Setup Guide

**Status**: 🔴 BLOCKED - Domain verification required
**Current**: AWS SES in sandbox mode
**Blocker**: `usereminder.com` domain not verified in AWS SES

---

## Current State

### ✅ What Works
- Email service code implemented (`src/lib/services/email-service.ts`)
- Retry logic with exponential backoff (3 attempts)
- Database logging integrated
- AWS credentials configured
- Error handling comprehensive

### ❌ What's Blocked
- Cannot send emails - AWS SES sandbox mode
- Recipient address must be verified
- Error: `Email address is not verified`

### Test Results
```
❌ Email send failed
Error: Email address not verified in AWS SES.
Please verify smoke-test@example.com or verify your sending domain.
```

---

## Week 1 Days 1-2: Required Actions

### 1. AWS SES Domain Verification

**Access AWS Console:**
1. Log into AWS Console: https://console.aws.amazon.com/
2. Navigate to Amazon SES
3. Region: **US-EAST-1** (currently configured)
   - **NOTE**: Plan specifies ME-SOUTH-1 for UAE compliance
   - Decision needed: Stay in us-east-1 or migrate to me-south-1

**Verify Domain (`usereminder.com`):**
1. In SES Console → Configuration → Verified identities
2. Click "Create identity"
3. Select "Domain"
4. Enter domain: `usereminder.com`
5. Select "Easy DKIM" (recommended)
6. AWS will provide DNS records

### 2. DNS Record Configuration

AWS SES will provide 3 types of DNS records to add:

**A. DKIM Records** (3 CNAME records)
```
Format:
<selector1>._domainkey.usereminder.com → <value>.dkim.amazonses.com
<selector2>._domainkey.usereminder.com → <value>.dkim.amazonses.com
<selector3>._domainkey.usereminder.com → <value>.dkim.amazonses.com
```

**B. SPF Record** (TXT record)
```
usereminder.com TXT "v=spf1 include:amazonses.com ~all"
```

**C. DMARC Record** (TXT record)
```
_dmarc.usereminder.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@usereminder.com"
```

### 3. Verify DNS Propagation

**Check DNS:**
```bash
# DKIM verification
dig _amazonses.usereminder.com TXT

# SPF verification
dig usereminder.com TXT | grep spf

# DMARC verification
dig _dmarc.usereminder.com TXT
```

**Online Tools:**
- MXToolbox: https://mxtoolbox.com/dkim.aspx
- DMARC Analyzer: https://www.dmarcanalyzer.com/dmarc-inspector/

**Timeline:** DNS propagation takes 15 minutes - 48 hours

### 4. Request Production Access

AWS SES starts in sandbox mode with restrictions:
- Can only send to verified email addresses
- 200 emails per day limit
- 1 email per second

**Move to Production:**
1. In SES Console → Account dashboard
2. Click "Request production access"
3. Fill out form:
   - **Use case**: SaaS invoice reminder platform
   - **Description**: Automated payment reminders for B2B invoices
   - **Will you comply**: Yes
   - **Email type**: Transactional
   - **Expected volume**: 10,000 emails/month growing to 100,000
   - **Bounce handling**: Automated webhook processing
   - **Process**: Describe follow-up sequence system

**Approval Time:** Usually 24-48 hours

### 5. Update Environment Configuration

Once verified, update region if needed:

```env
# Current (US East)
AWS_REGION=us-east-1

# UAE Compliance (ME South)
AWS_REGION=me-south-1

AWS_SES_FROM_EMAIL="hello@usereminder.com"
```

**Note:** If changing regions, must verify domain in new region.

---

## Alternative: Email Address Verification (Temporary)

For immediate testing without domain verification:

**Verify Individual Email:**
1. AWS SES Console → Verified identities
2. Click "Create identity"
3. Select "Email address"
4. Enter your personal email
5. Check email for verification link
6. Click verification link

**Update Test Script:**
```bash
TEST_EMAIL=your.email@gmail.com npx tsx scripts/test-email-send.ts
```

**Limitations:**
- Only works in sandbox mode
- Must verify each recipient
- Not viable for production

---

## Week 1 Deliverable Checklist

**Days 1-2: Domain Verification**
- [ ] Access AWS SES Console
- [ ] Initiate domain verification for `usereminder.com`
- [ ] Obtain DNS records from AWS
- [ ] Add DNS records to domain registrar
- [ ] Wait for DNS propagation (15 min - 48 hrs)
- [ ] Confirm verification in AWS Console
- [ ] Request production access
- [ ] Await AWS approval (24-48 hrs)

**Days 3-5: Email Service Testing**
- [ ] Run test script: `npx tsx scripts/test-email-send.ts`
- [ ] Verify single email sent successfully ✅
- [ ] Check email delivery and rendering
- [ ] Test retry logic (simulate failures)
- [ ] Verify database logging
- [ ] Document email templates

**Deliverable**: Send 1 test email successfully

---

## Region Decision: US-EAST-1 vs ME-SOUTH-1

### US-EAST-1 (Virginia)
**Pros:**
- Already configured
- Fastest AWS service availability
- Lower latency to global endpoints
- More mature service features

**Cons:**
- Not UAE data residency compliant
- Higher latency to UAE users (~150ms)

### ME-SOUTH-1 (Bahrain)
**Pros:**
- UAE data residency compliant
- Lower latency to UAE users (~20ms)
- Better for UAE e-invoicing mandate

**Cons:**
- Need to verify domain in new region
- Some AWS services not available
- Slightly higher costs

**Recommendation:**
- **Short-term**: Stay in us-east-1 for speed
- **Before production**: Migrate to me-south-1 for compliance

---

## Testing Commands

### Test Email Send (after verification)
```bash
npx tsx scripts/test-email-send.ts
```

### Test with Custom Email
```bash
TEST_EMAIL=your.email@example.com npx tsx scripts/test-email-send.ts
```

### Check AWS SES Status
```bash
# Install AWS CLI if needed
aws ses get-account-sending-enabled --region us-east-1

# Check verified identities
aws ses list-verified-email-addresses --region us-east-1

# Check domain verification status
aws ses get-identity-verification-attributes \
  --identities usereminder.com \
  --region us-east-1
```

---

## Next Steps After Verification

Once domain is verified and production access granted:

**Week 1 Days 3-5:**
1. Test single email send ✅
2. Implement email templates
3. Test retry logic
4. Add bounce/complaint webhooks

**Week 2 Days 6-10:**
1. Bulk sending (100 test emails)
2. Rate limiting implementation
3. Queue management
4. Delivery monitoring (99%+ target)

---

## Support Resources

**AWS SES Documentation:**
- Domain Verification: https://docs.aws.amazon.com/ses/latest/dg/verify-domain-procedure.html
- Production Access: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- DKIM Setup: https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html

**DNS Verification Tools:**
- MXToolbox DKIM: https://mxtoolbox.com/dkim.aspx
- Google Admin Toolbox: https://toolbox.googleapps.com/apps/checkmx/

**AWS Support:**
- SES Support: https://console.aws.amazon.com/support/home

---

*Document created: November 10, 2025*
*Current phase: Week 1 Days 1-2 - Domain Verification*
