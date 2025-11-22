# AWS SES Domain Verification - Step-by-Step Guide

**Date**: November 11, 2025
**Domain**: usereminder.com
**Status**: Domain identity created, pending DNS verification
**Region**: ME South (Bahrain) - me-south-1

---

## Current Situation

You've successfully created the domain identity `usereminder.com` in AWS SES. The domain shows as "Pending" because AWS needs to verify you own the domain by checking DNS records.

## How to Get Your DNS Records

### Option 1: Direct URL (Fastest)
Open this URL in your browser:
```
https://me-south-1.console.aws.amazon.com/ses/home?region=me-south-1#/verified-identities/usereminder.com
```

This should take you directly to the domain details page where you'll see all DNS records.

### Option 2: Navigate Through Console
1. Go to: https://console.aws.amazon.com/ses
2. Make sure the region is set to **ME South (Bahrain)** in the top-right dropdown
3. In the left sidebar, click **Verified identities**
4. Find `usereminder.com` in the list (status will say "Pending")
5. Click on `usereminder.com` (click the domain name itself, not the checkbox)
6. You'll see a page with tabs: **DomainKeys Identified Mail (DKIM)**, **Custom MAIL FROM domain**, etc.

## What DNS Records You'll See

You should see a table with records like this:

### DKIM Records (3 CNAME Records)
```
Type: CNAME
Name: xxxxxxxx._domainkey.usereminder.com
Value: xxxxxxxx.dkim.amazonses.com
```

There will be 3 of these CNAME records. Each has a unique identifier.

### Additional Records You May Need

**SPF Record (TXT)**:
```
Type: TXT
Name: usereminder.com
Value: v=spf1 include:amazonses.com ~all
```

**DMARC Record (TXT)**:
```
Type: TXT
Name: _dmarc.usereminder.com
Value: v=DMARC1; p=none; rua=mailto:hello@usereminder.com
```

---

## What to Do With These Records - 123-reg Instructions

### Step 1: Copy the 3 CNAME Records from AWS

From the AWS SES page you're looking at, you should see a table with 3 CNAME records. Each has:
- **Name**: Something like `abc123._domainkey.usereminder.com`
- **Value**: Something like `abc123.dkim.amazonses.com`

**Important**: When adding to 123-reg, you'll need to remove `.usereminder.com` from the Name field.

For example:
- AWS shows: `abc123._domainkey.usereminder.com`
- In 123-reg, enter: `abc123._domainkey`

### Step 2: Log into 123-reg

1. Go to https://www.123-reg.co.uk/
2. Click "Sign In" (top right)
3. Log in with your credentials
4. Navigate to "Manage Domains"
5. Find `usereminder.com` and click "Manage"

### Step 3: Access DNS Settings

1. On the domain management page, look for "Manage DNS" or "Advanced DNS"
2. Click on it to access the DNS records management
3. You should see existing DNS records

### Step 4: Add the 3 CNAME Records

For **each of the 3 CNAME records** from AWS:

1. Click "Add DNS Record" or similar button
2. Select **Type**: CNAME
3. **Host/Name**: Enter the part BEFORE `.usereminder.com`
   - Example: If AWS shows `abc123._domainkey.usereminder.com`
   - Enter: `abc123._domainkey`
4. **Points To/Value**: Copy the full value from AWS
   - Example: `abc123.dkim.amazonses.com`
5. **TTL**: Leave default (usually 3600 or 1 hour)
6. Click "Save" or "Add"

Repeat for all 3 CNAME records.

### Step 5: Add SPF Record (TXT)

1. Click "Add DNS Record"
2. **Type**: TXT
3. **Host/Name**: `@` (represents root domain)
4. **Value**: `v=spf1 include:amazonses.com ~all`
5. **TTL**: Leave default
6. Click "Save"

**Note**: If you already have an SPF record, you need to **edit** it instead of creating a new one. Add `include:amazonses.com` to the existing SPF record.

### Step 6: Add DMARC Record (TXT)

1. Click "Add DNS Record"
2. **Type**: TXT
3. **Host/Name**: `_dmarc`
4. **Value**: `v=DMARC1; p=none; rua=mailto:hello@usereminder.com`
5. **TTL**: Leave default
6. Click "Save"

### Step 7: Save All Changes

1. Make sure all 5 records are saved (3 CNAME + 1 SPF + 1 DMARC)
2. 123-reg usually applies changes immediately
3. DNS propagation can take 15 minutes to 48 hours (usually < 1 hour)

### Step 8: Verify in AWS SES

1. Wait about 15-30 minutes
2. Go back to AWS SES console: https://me-south-1.console.aws.amazon.com/ses/home?region=me-south-1#/verified-identities
3. Find `usereminder.com` in the list
4. Click the refresh icon or refresh the page
5. Status should change from "Unverified" to "Verified"

If it doesn't verify after 1 hour, double-check:
- All 3 CNAME records are added correctly
- You removed `.usereminder.com` from the Name field
- The Values are copied exactly as shown in AWS

---

## Troubleshooting

**If you can't find the DNS records page:**
- Make absolutely sure you're in **ME South (Bahrain)** region
- The URL should show `me-south-1` not `us-east-1`
- Try the direct URL above

**If the domain doesn't appear:**
- Refresh the page
- Check the region again
- It may take a few seconds for the domain to appear after creation

**If you see the "Create identity" form again:**
- Click Cancel
- You should be back at the identities list
- Look for `usereminder.com` in the list

---

## After DNS Records Are Added

Once DNS propagates and AWS verifies the domain (status changes to "Verified"), you need to:

### Request Production Access

1. In AWS SES console, left sidebar: **Account dashboard**
2. Look for "Production access" section
3. Click **Request production access** button
4. Fill out the form:
   - **Use case**: Transactional emails (invoice reminders)
   - **Website URL**: https://reminder-mvp.vercel.app
   - **Email volume**: Expected 1,000-5,000 emails/month
   - **Compliance**: Confirm you follow AWS policies
5. Submit and wait for AWS approval (24-72 hours)

---

## When Complete

Once domain is verified AND production access is granted, come back and we'll:
1. Update environment variables in Vercel
2. Test email sending from production
3. Complete Week 3 validation

---

**Need Help?**: If you're stuck on any step, let me know:
- Which domain provider you're using
- Screenshot of what you see (without showing sensitive data)
- Any error messages

