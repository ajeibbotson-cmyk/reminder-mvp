# Production Deployment Guide

**Reminder MVP - Phase 3A: Minimum Viable Production**

This guide covers the complete production deployment process for the Reminder platform using Vercel, Supabase, and AWS SES.

## 🎯 Deployment Overview

**Target Environment**: Vercel (Dubai region for UAE compliance)
**Database**: Supabase PostgreSQL (Singapore region)
**Email Service**: AWS SES (ME South - Bahrain)
**CDN**: Vercel Edge Network
**Monitoring**: Built-in performance monitoring

## 📋 Pre-Deployment Checklist

### 1. Production Environment Setup

#### ✅ Supabase Production Project
- [ ] Create new Supabase project for production
- [ ] Configure production database
- [ ] Set up Row Level Security (RLS)
- [ ] Create production API keys
- [ ] Configure connection pooling

#### ✅ AWS SES Production Setup
- [ ] Verify production email domain
- [ ] Move out of AWS SES sandbox
- [ ] Configure DKIM authentication
- [ ] Set up bounce/complaint handling
- [ ] Configure sending quotas

#### ✅ Environment Variables
- [ ] Copy `.env.production.template` to `.env.production`
- [ ] Fill in all production values
- [ ] Verify all credentials work

### 2. Code Preparation

#### ✅ Build Verification
```bash
npm run build          # Verify production build works
npm run lint           # Fix any linting issues
npx tsc --noEmit      # Verify TypeScript compilation
```

#### ✅ Database Preparation
```bash
npx prisma generate   # Generate production client
npx prisma migrate deploy # Apply migrations to production DB
```

## 🚀 Deployment Process

### Option 1: Automated Deployment (Recommended)

```bash
# Run the automated deployment script
./scripts/deploy-production.sh
```

The script will:
1. ✅ Verify build passes
2. ✅ Run linting and type checks
3. ✅ Generate Prisma client
4. ✅ Deploy to Vercel
5. ✅ Provide deployment URL

### Option 2: Manual Deployment

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
vercel login
```

#### Step 2: Configure Project
```bash
vercel
# Follow prompts to link project
```

#### Step 3: Set Environment Variables
```bash
# In Vercel dashboard or CLI
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
vercel env add AWS_REGION
vercel env add AWS_SES_FROM_EMAIL
```

#### Step 4: Deploy
```bash
vercel --prod
```

## 🔧 Environment Configuration

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXTAUTH_URL` | Production app URL | `https://reminder.vercel.app` |
| `NEXTAUTH_SECRET` | JWT signing secret | `random-32-char-string` |
| `DATABASE_URL` | Supabase pooled connection | `postgresql://...?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct connection | `postgresql://...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiI...` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | `...` |
| `AWS_REGION` | AWS region for SES | `me-south-1` |
| `AWS_SES_FROM_EMAIL` | Verified sender email | `noreply@yourdomain.com` |

### Production-Specific Settings

#### NextAuth Configuration
- **JWT Secret**: Use cryptographically secure 32+ character string
- **Session Strategy**: JWT for serverless compatibility
- **Cookie Settings**: Secure, HttpOnly, SameSite=strict

#### Database Configuration
- **Connection Pooling**: Use pgBouncer via Supabase
- **Connection Limits**: Configure based on Vercel function limits
- **Query Timeout**: 30 seconds max for Vercel functions

#### Security Headers
Automatically configured via `next.config.ts`:
- Content Security Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer-Policy

## 📊 Post-Deployment Verification

### 1. Application Health Check
Visit your production URL and verify:
- [ ] Homepage loads correctly
- [ ] Authentication flow works
- [ ] Dashboard is accessible after login
- [ ] Invoice management functions work
- [ ] Email sending is functional

### 2. Database Connectivity
```bash
# Test database connection
npx prisma db push --schema=./prisma/schema.prisma
```

### 3. Email Functionality
- [ ] Test sending from production environment
- [ ] Verify bounce/complaint handling
- [ ] Check delivery rates in AWS SES console

### 4. Performance Monitoring
- [ ] Verify Core Web Vitals in production
- [ ] Check Vercel function execution times
- [ ] Monitor database query performance

## 🔄 Domain Configuration (Optional)

### Custom Domain Setup
1. **Add Domain in Vercel Dashboard**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Choose redirect options

2. **Configure DNS**
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   ```

3. **Update Environment Variables**
   ```bash
   vercel env add NEXTAUTH_URL https://yourdomain.com
   ```

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
- **Cause**: TypeScript errors or missing dependencies
- **Solution**: Run `npm run build` locally and fix errors

#### Database Connection Issues
- **Cause**: Incorrect connection strings or firewall rules
- **Solution**: Verify DATABASE_URL and DIRECT_URL are correct

#### Authentication Problems
- **Cause**: Incorrect NEXTAUTH_URL or NEXTAUTH_SECRET
- **Solution**: Ensure NEXTAUTH_URL matches production domain

#### Email Sending Failures
- **Cause**: AWS SES not out of sandbox or unverified domain
- **Solution**: Complete AWS SES verification process

### Debugging Commands

```bash
# Check Vercel logs
vercel logs

# Check build logs
vercel build

# Test environment variables
vercel env ls

# Check function usage
vercel stats
```

## 📈 Monitoring & Maintenance

### Performance Monitoring
- **Built-in**: Core Web Vitals tracking in `src/lib/utils/performance.ts`
- **Vercel Analytics**: Automatic performance monitoring
- **Custom Events**: Track business metrics

### Error Tracking
- **Error Boundaries**: Comprehensive error handling
- **Console Monitoring**: Production error logging
- **User Feedback**: Error boundary user reports

### Database Maintenance
- **Backups**: Automatic Supabase backups
- **Monitoring**: Supabase dashboard metrics
- **Performance**: Query performance tracking

### Security Monitoring
- **Dependency Updates**: Regular `npm audit` checks
- **Security Headers**: Verify security configuration
- **Authentication**: Monitor failed login attempts

## 🎯 Success Metrics

### Technical Metrics
- **Build Time**: < 2 minutes
- **Function Cold Start**: < 1 second
- **Database Query Time**: < 500ms average
- **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1

### Business Metrics
- **User Registration**: Track conversion funnel
- **Invoice Processing**: Monitor success rates
- **Email Delivery**: Track delivery and engagement rates
- **System Uptime**: > 99.9% availability

## 🔄 Rollback Plan

### Emergency Rollback
```bash
# Rollback to previous deployment
vercel rollback

# Or deploy specific version
vercel --prod --target <previous-deployment-url>
```

### Database Rollback
```bash
# If database migration issues
npx prisma migrate reset
npx prisma migrate deploy
```

## 🎉 Launch Checklist

### Pre-Launch (T-1 Day)
- [ ] Complete full deployment verification
- [ ] Test all critical user journeys
- [ ] Verify monitoring is working
- [ ] Prepare rollback plan
- [ ] Notify stakeholders

### Launch Day (T-0)
- [ ] Final deployment
- [ ] Monitor for first 2 hours continuously
- [ ] Verify user registration flow
- [ ] Test email functionality
- [ ] Check system performance

### Post-Launch (T+1 Day)
- [ ] Review performance metrics
- [ ] Analyze user feedback
- [ ] Check error rates
- [ ] Document any issues
- [ ] Plan next iteration

---

**Deployment Contact**: Development Team
**Emergency Contact**: Technical Lead
**Documentation**: Keep this guide updated with any changes