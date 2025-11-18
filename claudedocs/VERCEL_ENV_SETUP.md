# Vercel Environment Variables Setup for E2E Testing

## Quick Fix Checklist

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Select project: **reminder-mvp**
3. Click: **Settings** → **Environment Variables**

### Step 2: Check/Update These Variables

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXTAUTH_URL` | `https://reminder-mvp.vercel.app` | Production, Preview, Development |
| `NEXTAUTH_SECRET` | `xSEUx4xvDjK2sdpf0nHHhTEdNO/JgBTbCnKdydjZLu4=` | Production, Preview, Development |
| `DATABASE_URL` | (already set - don't change) | Production, Preview, Development |
| `DIRECT_URL` | (already set - don't change) | Production, Preview, Development |

### Step 3: What to Look For

**If `NEXTAUTH_URL` shows `http://localhost:3001`**:
- ❌ Click "Edit" or "Delete"
- ✅ Add new value: `https://reminder-mvp.vercel.app`
- ✅ Check boxes: Production, Preview, Development
- ✅ Click "Save"

**If `NEXTAUTH_URL` is missing**:
- ✅ Click "Add New"
- ✅ Name: `NEXTAUTH_URL`
- ✅ Value: `https://reminder-mvp.vercel.app`
- ✅ Check boxes: Production, Preview, Development
- ✅ Click "Save"

**If `NEXTAUTH_SECRET` is missing or different**:
- ✅ Add/update to match local `.env` value
- ✅ Check boxes: Production, Preview, Development
- ✅ Click "Save"

### Step 4: Redeploy

**Option A: Automatic (push any change)**
```bash
git commit --allow-empty -m "chore: Trigger Vercel redeploy for env vars"
git push origin main
```

**Option B: Manual**
- Go to Vercel Dashboard → Deployments
- Click "..." on latest deployment
- Click "Redeploy"

### Step 5: Wait for Deployment
- Watch deployment status in Vercel dashboard
- Wait until status shows: ✅ Ready
- Usually takes 2-3 minutes

### Step 6: Test E2E
```bash
TEST_ENV=production npx playwright test tests/e2e/auth.setup.ts --project=setup
```

**Expected output:**
```
✅ Successfully redirected to dashboard
Current URL: https://reminder-mvp.vercel.app/en/dashboard
✅ Dashboard loaded successfully
✅ Session established
💾 Saved auth state to: playwright/.auth/user.json
✅ Authentication setup complete!
```

## Verification Commands

Check Vercel environment variables (if using Vercel CLI):
```bash
vercel env ls
```

Check specific variable:
```bash
vercel env pull .env.vercel
cat .env.vercel | grep NEXTAUTH_URL
```

## Common Issues

**Issue**: E2E still fails after updating vars
**Fix**: Wait for deployment to complete, check deployment logs

**Issue**: Can't find environment variables page
**Fix**: Vercel Dashboard → reminder-mvp → Settings tab → Environment Variables (left sidebar)

**Issue**: Not sure which value to use for NEXTAUTH_SECRET
**Fix**: Use the value from your local `.env` file (check with `cat .env | grep NEXTAUTH_SECRET`)

## Success Criteria

✅ `NEXTAUTH_URL` = `https://reminder-mvp.vercel.app` on Vercel
✅ `NEXTAUTH_SECRET` matches local `.env`
✅ Deployment completed successfully
✅ E2E auth setup test passes
✅ File created: `playwright/.auth/user.json`
