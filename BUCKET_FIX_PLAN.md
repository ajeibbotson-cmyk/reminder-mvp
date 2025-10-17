# Bucket System Issues & Fix Plan

## Issues Identified

### 1. **Double Pagination Problem** (CRITICAL)
- API fetches 20 invoices from DB
- Then filters by bucket day range (e.g., 30+ days overdue)
- Then slices again with offset/limit
- **Result**: Often returns 0 invoices because the 20 fetched don't match the bucket criteria

### 2. **Architecture Issue**
- Buckets are defined by `daysOverdue` ranges
- But `daysOverdue` is calculated at runtime, not stored in DB
- Can't filter efficiently in SQL
- Need to either:
  - Calculate ALL invoices' daysOverdue to filter (expensive)
  - Add a `days_overdue` computed column to DB (better)
  - Or fetch all invoices and filter in memory (current, but broken)

### 3. **Missing Data**
- Amounts showing as €0.00 likely because invoices array is empty or filtered out
- Currency showing € instead of AED (locale/formatting issue)

## Solutions

### Option A: Add days_overdue to database (RECOMMENDED)
1. Add `days_overdue` integer column to invoices table
2. Update it daily via cron or on-demand
3. Filter efficiently in SQL: `WHERE days_overdue BETWEEN 31 AND 999`
4. Proper pagination works

### Option B: Fix current implementation (QUICK FIX)
1. Remove the bucket filtering from API
2. Let frontend handle bucket categorization
3. Fetch ALL overdue invoices, frontend filters by bucket
4. Works but not scalable

### Option C: Smart SQL filtering (MIDDLE GROUND)
1. Calculate days_overdue in SQL: `(CURRENT_DATE - due_date)`
2. Filter in SQL query directly
3. Proper pagination
4. No schema changes needed

## Recommended Fix: Option C

```typescript
// In API route, add to whereClause:
const bucket = BUCKET_DEFINITIONS[bucketId]
if (bucket.max === null) {
  // For 30+ days bucket
  whereClause.due_date = {
    lte: new Date(Date.now() - bucket.min * 24 * 60 * 60 * 1000)
  }
} else {
  // For ranged buckets (1-3, 4-7, etc)
  whereClause.due_date = {
    gte: new Date(Date.now() - bucket.max * 24 * 60 * 60 * 1000),
    lte: new Date(Date.now() - bucket.min * 24 * 60 * 60 * 1000)
  }
}
```

This way:
- SQL filters invoices by due_date range
- Pagination works correctly
- Only matching invoices are returned
- No post-filtering needed

## Additional Fixes Needed

1. **Currency Symbol**: Already defaulting to 'AED' in API, issue might be in formatter
2. **Amount Display**: Should work once invoices are returned correctly
3. **Bucket Cards**: Already fixed - proper padding applied
4. **Click Behavior**: Already fixed - shows detail view, hides other buckets

## Implementation Order

1. Fix SQL filtering (Option C) - 15 min
2. Test with all buckets - 5 min
3. Verify amounts and currency display - 2 min

Total: ~22 minutes for complete fix
