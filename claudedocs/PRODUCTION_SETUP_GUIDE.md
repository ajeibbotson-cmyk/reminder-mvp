# Reminder Platform - Production Setup Guide

**Last Updated**: November 18, 2025
**Version**: 1.0
**Status**: Production Ready ✅

---

## 🎯 Overview

This guide covers the complete production setup for the Reminder platform, including infrastructure, email configuration, database, and deployment procedures.

## 📋 Prerequisites

### Required Accounts
- ✅ **Vercel Account** - Platform hosting
- ✅ **Supabase Account** - PostgreSQL database
- ✅ **Postmark Account** - Email delivery (APPROVED)
- ✅ **GitHub Account** - Code repository and CI/CD

### Required Tools
- Node.js v18+
- npm v9+
- Git
- TypeScript knowledge

---

## 🔧 Infrastructure Setup

### 1. Database (Supabase PostgreSQL)

**Connection URLs**:
```env
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

**Key Points**:
- **DATABASE_URL** (Port 6543): Connection-pooled access for application queries
- **DIRECT_URL** (Port 5432): Direct access for migrations and authentication
- **Region**: AWS Singapore (ap-southeast-1) for UAE proximity

**Database Schema**:
- Multi-tenant architecture with company-level data isolation
- 20+ tables including: users, companies, invoices, customers, email_logs
- Foreign key constraints for data integrity
- Indexes on frequently queried fields

**Maintenance**:
```bash
# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# Create migration
npx prisma migrate dev --name migration_name

# View database in browser
npx prisma studio
```

---

### 2. Email Infrastructure (Postmark)

**Status**: ✅ **APPROVED for Production** (November 18, 2025)

**Postmark Configuration**:
```env
EMAIL_PROVIDER="postmark"
POSTMARK_API_TOKEN="463c9eef-4ae4-434f-b5e8-757168118bae"
POSTMARK_SERVER_ID="17479339"
FROM_EMAIL="hello@usereminder.com"
FROM_NAME="Reminder"
REPLY_TO_EMAIL="support@usereminder.com"
```

**Domain Authentication**:
- ✅ Domain: `usereminder.com`
- ✅ DKIM: Verified
- ✅ Return-Path: Verified
- ✅ SPF: Configured
- ✅ DMARC: Configured

**Deliverability**:
- 95%+ inbox placement rate
- Real-time open/click tracking
- Automated bounce/complaint handling
- No sending restrictions (worldwide)

**Webhook Endpoints** (Production):
```
https://reminder-mvp.vercel.app/api/webhooks/postmark/bounce
https://reminder-mvp.vercel.app/api/webhooks/postmark/open
https://reminder-mvp.vercel.app/api/webhooks/postmark/click
https://reminder-mvp.vercel.app/api/webhooks/postmark/delivery
https://reminder-mvp.vercel.app/api/webhooks/postmark/complaint
```

**Webhook Configuration in Postmark**:
1. Go to Postmark Settings → Webhooks
2. Add webhook URL for each event type
3. Ensure "Post as JSON" is enabled
4. Save and test webhook delivery

**Monitoring**:
- Postmark Activity Stream: https://account.postmarkapp.com/servers/17479339/streams/outbound/activity
- Track deliverability, opens, clicks, bounces
- Review complaint rates (target <0.1%)

---

### 3. Authentication (NextAuth.js)

**Configuration**:
```env
NEXTAUTH_SECRET="xSEUx4xvDjK2sdpf0nHHhTEdNO/JgBTbCnKdydjZLu4="
NEXTAUTH_URL="https://reminder-mvp.vercel.app"
```

**Features**:
- JWT-based sessions
- Credentials provider (email + password)
- bcryptjs password hashing (strength 12)
- Role-based access control (ADMIN, FINANCE, VIEWER)
- Multi-user support per company

**Session Management**:
- Session duration: 30 days
- Automatic renewal on activity
- Secure cookies in production (HTTPS only)
- HttpOnly and SameSite=Lax for security

---

### 4. Deployment (Vercel)

**Production URL**: https://reminder-mvp.vercel.app

**Deployment Flow**:
1. Push code to GitHub `main` branch
2. Vercel automatically detects changes
3. Builds Next.js application
4. Deploys to production
5. Updates environment variables if needed

**Build Configuration**:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

**Environment Variables** (Vercel Dashboard):
Must be set for **Production**, **Preview**, and **Development**:

```
DATABASE_URL
DIRECT_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
EMAIL_PROVIDER
POSTMARK_API_TOKEN
POSTMARK_SERVER_ID
FROM_EMAIL
FROM_NAME
REPLY_TO_EMAIL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Deployment Commands**:
```bash
# Manual deployment (if needed)
vercel --prod

# View deployment logs
vercel logs

# Check deployment status
vercel ls
```

---

## 🚀 Initial Setup Checklist

### Step 1: Clone Repository
```bash
git clone https://github.com/ajeibbotson-cmyk/reminder-mvp.git
cd reminder-mvp
npm install
```

### Step 2: Configure Environment Variables
Create `.env` file with all required variables (see section above)

### Step 3: Setup Database
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Verify connection
npx prisma studio
```

### Step 4: Verify Email Configuration
```bash
# Test Postmark connection
npx tsx scripts/postmark-direct-test.ts

# Should send test email to ajeibbotson@gmail.com
# Check inbox and Postmark activity stream
```

### Step 5: Deploy to Vercel
```bash
# Link to Vercel project
vercel link

# Set environment variables
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
# ... (add all required env vars)

# Deploy to production
vercel --prod
```

### Step 6: Configure Postmark Webhooks
1. Go to Postmark → Settings → Webhooks
2. Add production webhook URLs (see section 2 above)
3. Test webhook delivery
4. Verify events appear in database

### Step 7: Create First Admin User
```bash
# Use production signup page
# Visit: https://reminder-mvp.vercel.app/auth/signup
# Create company and admin user
```

---

## 📊 Production Monitoring

### Key Metrics to Track

**Email Deliverability**:
- Delivery rate: Target >99%
- Bounce rate: Target <2%
- Complaint rate: Target <0.1%
- Open rate: 40-60% expected for invoices

**Application Performance**:
- Response time: <500ms for API calls
- Database query time: <100ms average
- Page load time: <2s first contentful paint

**Business Metrics**:
- Invoice reminders sent per day
- Payment collection rate improvement
- User active sessions
- Customer satisfaction (via support tickets)

### Monitoring Tools

**Vercel Analytics**:
- Real-time deployment status
- Performance metrics
- Error tracking
- Usage statistics

**Postmark Activity Stream**:
- Email delivery tracking
- Open/click rates
- Bounce analysis
- Complaint monitoring

**Supabase Dashboard**:
- Database health
- Connection pool status
- Query performance
- Storage usage

---

## 🔒 Security Best Practices

### Password Management
- Minimum 8 characters
- Requires uppercase, lowercase, number
- bcryptjs hashing with salt rounds: 12
- Password reset via email (planned)

### Session Security
- JWT tokens with expiration
- Secure cookies (HttpOnly, Secure, SameSite)
- Automatic session refresh
- Logout on inactivity (30 days)

### API Security
- Authentication required for all protected routes
- Role-based access control
- Company data isolation (multi-tenancy)
- Input validation with Zod schemas
- SQL injection protection via Prisma

### Email Security
- SPF, DKIM, DMARC configured
- Unsubscribe links in emails
- Suppression list for bounces/complaints
- Rate limiting (Postmark manages)

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Login redirects back to login page
**Solution**: Check `NEXTAUTH_URL` and `NEXTAUTH_SECRET` are set correctly in Vercel

**Issue**: Emails not sending
**Solution**:
1. Check `POSTMARK_API_TOKEN` is valid
2. Verify sender signature in Postmark
3. Check suppression list for recipient
4. Review Postmark activity stream for errors

**Issue**: Database connection errors
**Solution**:
1. Verify `DATABASE_URL` and `DIRECT_URL` are correct
2. Check Supabase project is active
3. Ensure connection pooling is enabled
4. Run `npx prisma generate` to refresh client

**Issue**: Webhooks not working
**Solution**:
1. Verify webhook URLs in Postmark settings
2. Check Vercel deployment logs for errors
3. Ensure endpoints return HTTP 200
4. Test with Postmark webhook tester

---

## 📞 Support Contacts

**Technical Support**:
- Email: andrew@usereminder.com
- GitHub Issues: https://github.com/ajeibbotson-cmyk/reminder-mvp/issues

**Service Providers**:
- Vercel Support: https://vercel.com/support
- Supabase Support: https://supabase.com/support
- Postmark Support: https://postmarkapp.com/support

---

## 📝 Maintenance Schedule

**Daily**:
- Monitor email deliverability metrics
- Check error logs in Vercel
- Review customer support tickets

**Weekly**:
- Database performance review
- Email template updates (if needed)
- User feedback analysis

**Monthly**:
- Security updates
- Dependency updates (npm)
- Performance optimization review
- Cost analysis (Vercel, Supabase, Postmark)

**Quarterly**:
- Full system audit
- Backup verification
- Disaster recovery testing
- Feature roadmap review

---

## ✅ Production Readiness Checklist

- [x] Database schema deployed and tested
- [x] Email infrastructure approved and operational
- [x] Authentication working on production
- [x] Vercel deployment automated
- [x] Environment variables configured
- [x] Webhooks configured and tested
- [x] Security best practices implemented
- [x] Monitoring tools configured
- [x] Documentation complete
- [x] Support contacts established

**Status**: ✅ **PRODUCTION READY**

**Launch Date**: December 2025 (Beta with POP Trading)

---

*For detailed API documentation, see API_REFERENCE.md*
*For user guide, see USER_GUIDE.md (to be created)*
