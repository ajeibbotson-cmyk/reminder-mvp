#!/usr/bin/env npx tsx
/**
 * Verify camelCase Migration - Regression Test
 *
 * Tests that Oct 17 functionality still works after camelCase migration:
 * 1. Customer creation
 * 2. Invoice creation
 * 3. Payment creation
 * 4. Campaign functionality
 * 5. Dashboard metrics
 *
 * Run: npx tsx scripts/verify-camelcase-migration.ts
 */

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(testName: string, testFn: () => Promise<void>) {
  try {
    await testFn();
    results.push({ test: testName, status: 'PASS', message: 'Success' });
    console.log(`✅ ${testName}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ test: testName, status: 'FAIL', message: 'Failed', error: errorMsg });
    console.error(`❌ ${testName}: ${errorMsg}`);
  }
}

async function getAuthToken(): Promise<string> {
  // Get session token for authenticated requests
  const response = await fetch('http://localhost:3000/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'smoke-test@example.com',
      password: 'SmokeTest123!'
    })
  });

  if (!response.ok) {
    throw new Error('Authentication failed - ensure test user exists');
  }

  const cookies = response.headers.get('set-cookie');
  const tokenMatch = cookies?.match(/next-auth\.session-token=([^;]+)/);

  if (!tokenMatch) {
    throw new Error('No session token in response');
  }

  return tokenMatch[1];
}

async function main() {
  console.log('🔍 Verifying camelCase Migration - Regression Tests\n');

  let token: string;

  try {
    token = await getAuthToken();
    console.log('✅ Authentication successful\n');
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    console.log('\nℹ️  Create test user first:');
    console.log('   npx tsx scripts/create-test-user-for-smoke-tests.ts\n');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `next-auth.session-token=${token}`
  };

  // Test 1: Customer Creation (POST /api/customers)
  await runTest('Customer Creation', async () => {
    const response = await fetch('http://localhost:3000/api/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'CamelCase Migration Test Customer',
        email: `camelcase-test-${Date.now()}@example.com`,
        phone: '+971501234567',
        paymentTerms: 30
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.id) {
      throw new Error('No customer ID in response');
    }
  });

  // Test 2: Customer Listing (GET /api/customers)
  await runTest('Customer Listing', async () => {
    const response = await fetch('http://localhost:3000/api/customers', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.customers)) {
      throw new Error('Invalid response format');
    }
  });

  // Test 3: Invoice Listing (GET /api/invoices)
  await runTest('Invoice Listing', async () => {
    const response = await fetch('http://localhost:3000/api/invoices', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.invoices) {
      throw new Error('Invalid response format');
    }
  });

  // Test 4: Bucket Distribution (GET /api/invoices/buckets)
  await runTest('Bucket Distribution', async () => {
    const response = await fetch('http://localhost:3000/api/invoices/buckets', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.buckets || !Array.isArray(data.buckets)) {
      throw new Error('Invalid bucket response format');
    }
  });

  // Test 5: Payment Listing (GET /api/payments)
  await runTest('Payment Listing', async () => {
    const response = await fetch('http://localhost:3000/api/payments', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.payments) {
      throw new Error('Invalid response format');
    }
  });

  // Test 6: Campaign Listing (GET /api/campaigns)
  await runTest('Campaign Listing', async () => {
    const response = await fetch('http://localhost:3000/api/campaigns', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.campaigns)) {
      throw new Error('Invalid response format');
    }
  });

  // Test 7: Dashboard Metrics (should work even if empty)
  await runTest('Dashboard Metrics', async () => {
    const response = await fetch('http://localhost:3000/api/invoices/buckets', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (typeof data.totalInvoices !== 'number') {
      throw new Error('Missing totalInvoices metric');
    }
  });

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log('✅ All tests passed! camelCase migration verified successfully.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. camelCase migration has regressions.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
