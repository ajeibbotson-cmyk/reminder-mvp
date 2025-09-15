# Phase 3: Customer Management Database Optimization - Deployment Guide

## Overview

This document provides comprehensive deployment instructions for Phase 3 of the Customer Management System, which implements advanced database optimization, UAE-specific business features, and performance enhancements.

## Pre-Deployment Checklist

### 1. Environment Verification
- [ ] Database connectivity confirmed
- [ ] Backup of current database completed
- [ ] Prisma CLI updated to latest version
- [ ] Environment variables configured
- [ ] Rollback plan prepared

### 2. Database Requirements
- [ ] PostgreSQL 12+ running
- [ ] `pg_stat_statements` extension enabled
- [ ] Sufficient storage space (estimate +20% for new indexes)
- [ ] Database user has CREATE privileges

### 3. Performance Baseline
- [ ] Current customer query performance documented
- [ ] Index usage statistics captured
- [ ] Table size and row count recorded

## Deployment Steps

### Step 1: Schema Backup
```bash
# Create complete database backup
pg_dump -h your-host -U your-user -d your-database > backup_pre_phase3.sql

# Verify backup integrity
pg_restore --list backup_pre_phase3.sql
```

### Step 2: Apply Migration

#### Option A: Using Prisma (Recommended)
```bash
# Apply the migration when database is accessible
npx prisma migrate deploy
```

#### Option B: Manual SQL Execution
```bash
# If Prisma is not accessible, apply SQL directly
psql -h your-host -U your-user -d your-database -f prisma/migrations/20250915100000_phase3_customer_optimization_uae_enhancement/migration.sql
```

### Step 3: Validate Migration
```bash
# Run validation script
psql -h your-host -U your-user -d your-database -f scripts/database/validate_phase3_migration.sql
```

### Step 4: Update Application
```bash
# Generate new Prisma client
npx prisma generate

# Restart application services
npm run build
npm start
```

## Post-Deployment Verification

### 1. Schema Validation
Verify all new features are properly deployed:

```sql
-- Check new customer fields
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND column_name IN ('trn', 'business_type', 'risk_score', 'outstanding_balance');

-- Verify enum creation
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'UaeBusinessType'::regtype;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'customers' 
AND indexname LIKE 'idx_customers_%';
```

### 2. Performance Testing
Run performance benchmarks to ensure targets are met:

```sql
-- Test customer list query (target: < 200ms)
\timing on
SELECT id, name, email, business_type, outstanding_balance 
FROM customers 
WHERE company_id = 'your-company-id' 
AND is_active = true 
ORDER BY name LIMIT 50;

-- Test TRN lookup (target: < 50ms)
SELECT * FROM customers 
WHERE company_id = 'your-company-id' 
AND trn = '123456789012345';
\timing off
```

### 3. Functional Testing
Verify UAE-specific features work correctly:

```sql
-- Test customer search function
SELECT * FROM search_customers_uae(
    'your-company-id',
    'search term',
    'LLC',
    'en',
    10,
    0
);

-- Test Arabic search
SELECT * FROM search_customers_uae(
    'your-company-id',
    'اختبار',
    NULL,
    'ar',
    10,
    0
);
```

## Performance Optimization

### 1. Initial Index Statistics
After deployment, collect index usage statistics:

```sql
-- Update table statistics
ANALYZE customers;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW customer_analytics_summary;
```

### 2. Monitor Performance
Use the provided monitoring scripts:

```bash
# Run daily performance monitoring
psql -f scripts/database/performance_monitoring.sql
```

### 3. Maintenance Schedule
Set up automated maintenance:

```sql
-- Schedule in your database maintenance window
VACUUM ANALYZE customers;
REINDEX TABLE customers;
REFRESH MATERIALIZED VIEW customer_analytics_summary;
```

## Configuration Updates

### 1. Application Environment Variables
Update your `.env` file if needed:

```env
# Ensure these are configured for optimal performance
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"
DATABASE_CONNECTION_LIMIT=20
DATABASE_TIMEOUT=30000
```

### 2. Prisma Client Configuration
Update `prisma/schema.prisma` if needed:

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "metrics"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## UAE-Specific Features Guide

### 1. TRN (Trade Registration Number) Management
```typescript
// Validate TRN format (15 digits)
const trnRegex = /^[0-9]{15}$/;
const isValidTrn = trnRegex.test(customerTrn);

// Ensure TRN uniqueness within company
const existingCustomer = await prisma.customers.findFirst({
  where: {
    company_id: companyId,
    trn: customerTrn,
    id: { not: currentCustomerId } // Exclude current customer on update
  }
});
```

### 2. Business Type Handling
```typescript
import { UaeBusinessType } from '@prisma/client';

const businessTypes: UaeBusinessType[] = [
  'LLC',
  'FREE_ZONE',
  'SOLE_PROPRIETORSHIP',
  'PARTNERSHIP',
  'BRANCH',
  'PUBLIC_SHAREHOLDING_COMPANY',
  'PRIVATE_SHAREHOLDING_COMPANY',
  'GOVERNMENT_ENTITY'
];
```

### 3. Arabic Text Support
```typescript
// Handle bilingual customer data
const customerData = {
  name: "Emirates Trading Company",
  name_ar: "شركة الإمارات للتجارة",
  business_name: "Emirates Trading LLC",
  business_name_ar: "شركة الإمارات للتجارة ذ.م.م",
  address: "Sheikh Zayed Road, Dubai",
  address_ar: "شارع الشيخ زايد، دبي",
  preferred_language: "ar"
};
```

### 4. Risk Scoring Implementation
```typescript
// Calculate customer risk score (0-10 scale)
const calculateRiskScore = (paymentHistory: PaymentData[]) => {
  const avgDaysToPay = paymentHistory.reduce((sum, payment) => 
    sum + payment.daysAfterDue, 0) / paymentHistory.length;
  
  let riskScore = 5.0; // Base score
  
  if (avgDaysToPay <= 0) riskScore = 1.0;
  else if (avgDaysToPay <= 5) riskScore = 2.0;
  else if (avgDaysToPay <= 15) riskScore = 4.0;
  else if (avgDaysToPay <= 30) riskScore = 6.0;
  else if (avgDaysToPay <= 60) riskScore = 8.0;
  else riskScore = 9.0;
  
  return Math.min(10.0, Math.max(0.0, riskScore));
};
```

## Monitoring and Alerts

### 1. Performance Monitoring
Set up automated monitoring using the provided views:

```sql
-- Daily performance check
SELECT * FROM daily_customer_performance;

-- Weekly trends analysis
SELECT * FROM weekly_customer_trends;

-- Performance alerts
SELECT * FROM pg_stat_statements 
WHERE query ILIKE '%customers%' 
AND mean_time > 1000;
```

### 2. Data Integrity Monitoring
```sql
-- Check for data integrity issues
SELECT 
  'TRN_FORMAT_ISSUES' as issue_type,
  COUNT(*) as count
FROM customers 
WHERE trn IS NOT NULL 
AND LENGTH(trn) != 15

UNION ALL

SELECT 
  'INVALID_RISK_SCORES' as issue_type,
  COUNT(*) as count
FROM customers 
WHERE risk_score IS NOT NULL 
AND (risk_score < 0 OR risk_score > 10);
```

### 3. Capacity Planning
```sql
-- Monitor customer growth
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as new_customers,
  business_type
FROM customers 
WHERE created_at > NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at), business_type
ORDER BY week DESC;
```

## Troubleshooting

### Common Issues

#### 1. Migration Timeout
If migration takes too long:
```sql
-- Check for blocking locks
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query
FROM pg_stat_activity 
WHERE state != 'idle';

-- Increase timeout if needed
SET statement_timeout = '10min';
```

#### 2. Index Creation Fails
```sql
-- Check disk space
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  pg_size_pretty(pg_total_relation_size('customers')) as customers_table_size;

-- Create indexes one by one if needed
CREATE INDEX CONCURRENTLY idx_customers_company_trn 
ON customers(company_id, trn) WHERE trn IS NOT NULL;
```

#### 3. Performance Degradation
```sql
-- Check for missing statistics
SELECT 
  tablename,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename = 'customers';

-- Update statistics if needed
ANALYZE customers;
```

## Rollback Procedure

If rollback is required:

### 1. Application Rollback
```bash
# Revert to previous Prisma schema
git checkout HEAD~1 -- prisma/schema.prisma
npx prisma generate
npm run build
npm start
```

### 2. Database Rollback
```bash
# Restore from backup
pg_restore -h your-host -U your-user -d your-database backup_pre_phase3.sql
```

### 3. Verify Rollback
```sql
-- Verify customer table structure
\d customers

-- Check application connectivity
SELECT COUNT(*) FROM customers;
```

## Security Considerations

### 1. Data Access Control
- Ensure row-level security policies are maintained
- Verify multi-tenant isolation is preserved
- Audit user permissions for new fields

### 2. Sensitive Data Handling
- TRN numbers should be treated as sensitive business data
- Implement proper logging for TRN access
- Consider encryption for PII fields

### 3. Compliance Requirements
- Audit logs capture all customer data changes
- Data retention policies are enforced
- Backup and recovery procedures are tested

## Success Criteria

Phase 3 deployment is successful when:

- [ ] All migration tests pass
- [ ] Customer list queries complete in < 200ms
- [ ] TRN lookups complete in < 50ms
- [ ] Arabic search functions properly
- [ ] Customer analytics load in < 500ms
- [ ] Audit logging is working
- [ ] No data integrity issues detected
- [ ] Application features work as expected

## Support and Maintenance

### 1. Regular Maintenance
- Weekly: Run performance monitoring queries
- Monthly: Refresh materialized views
- Quarterly: Review index usage and optimization

### 2. Monitoring Dashboard
Consider implementing:
- Customer growth metrics
- Query performance trends
- System resource utilization
- Data quality indicators

### 3. Documentation Updates
Keep documentation current with:
- Schema changes
- Performance baselines
- Operational procedures
- Business rule updates

## Conclusion

Phase 3 significantly enhances the customer management system with UAE-specific features, performance optimizations, and comprehensive monitoring capabilities. Follow this guide carefully to ensure a successful deployment and optimal system performance.

For support or questions, refer to the technical documentation or contact the development team.