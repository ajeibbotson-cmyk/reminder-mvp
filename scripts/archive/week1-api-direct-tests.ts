#!/usr/bin/env npx tsx
/**
 * Week 1 API Direct Tests - No Auth Required
 *
 * Tests API endpoint existence and structure without authentication
 * This tells us what's built vs what needs building
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: 'EXISTS' | 'NOT_FOUND' | 'ERROR';
  httpStatus?: number;
  message: string;
}

const results: TestResult[] = [];

async function testEndpoint(endpoint: string, method: string = 'GET'): Promise<TestResult> {
  try {
    const response = await fetch(`http://localhost:3000${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' }
    });

    // 401/403 means endpoint exists but needs auth
    // 404 means endpoint doesn't exist
    // 405 means endpoint exists but wrong method

    if (response.status === 404) {
      return {
        endpoint,
        method,
        status: 'NOT_FOUND',
        httpStatus: 404,
        message: 'Endpoint does not exist'
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        endpoint,
        method,
        status: 'EXISTS',
        httpStatus: response.status,
        message: 'Endpoint exists (requires auth)'
      };
    }

    if (response.status === 405) {
      return {
        endpoint,
        method,
        status: 'EXISTS',
        httpStatus: 405,
        message: 'Endpoint exists (method not allowed)'
      };
    }

    return {
      endpoint,
      method,
      status: 'EXISTS',
      httpStatus: response.status,
      message: `Endpoint exists (HTTP ${response.status})`
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 'ERROR',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  console.log('🔍 Week 1 API Endpoint Inventory\n');
  console.log('Testing which endpoints exist (no auth required)\n');

  console.log('═'.repeat(70));
  console.log('FLOW 1: DASHBOARD & ANALYTICS');
  console.log('═'.repeat(70) + '\n');

  const dashboardTests = [
    { endpoint: '/api/invoices/buckets', method: 'GET', name: 'Bucket distribution' },
    { endpoint: '/api/analytics/dashboard', method: 'GET', name: 'Dashboard metrics' },
    { endpoint: '/api/analytics/collection-rate', method: 'GET', name: 'Collection rate' },
  ];

  for (const test of dashboardTests) {
    const result = await testEndpoint(test.endpoint, test.method);
    results.push(result);
    const icon = result.status === 'EXISTS' ? '✅' : result.status === 'NOT_FOUND' ? '❌' : '⚠️';
    console.log(`${icon} ${test.method} ${test.endpoint}`);
    console.log(`   ${result.message}\n`);
  }

  console.log('═'.repeat(70));
  console.log('FLOW 2: INVOICE MANAGEMENT');
  console.log('═'.repeat(70) + '\n');

  const invoiceTests = [
    { endpoint: '/api/invoices', method: 'GET', name: 'List invoices' },
    { endpoint: '/api/invoices', method: 'POST', name: 'Create invoice' },
    { endpoint: '/api/invoices/upload', method: 'POST', name: 'Upload CSV/Excel' },
    { endpoint: '/api/invoices/extract-pdf', method: 'POST', name: 'Extract from PDF' },
  ];

  for (const test of invoiceTests) {
    const result = await testEndpoint(test.endpoint, test.method);
    results.push(result);
    const icon = result.status === 'EXISTS' ? '✅' : result.status === 'NOT_FOUND' ? '❌' : '⚠️';
    console.log(`${icon} ${test.method} ${test.endpoint}`);
    console.log(`   ${result.message}\n`);
  }

  console.log('═'.repeat(70));
  console.log('FLOW 3: EMAIL CAMPAIGNS');
  console.log('═'.repeat(70) + '\n');

  const campaignTests = [
    { endpoint: '/api/campaigns', method: 'GET', name: 'List campaigns' },
    { endpoint: '/api/campaigns', method: 'POST', name: 'Create campaign' },
    { endpoint: '/api/templates', method: 'GET', name: 'List email templates' },
    { endpoint: '/api/templates', method: 'POST', name: 'Create template' },
  ];

  for (const test of campaignTests) {
    const result = await testEndpoint(test.endpoint, test.method);
    results.push(result);
    const icon = result.status === 'EXISTS' ? '✅' : result.status === 'NOT_FOUND' ? '❌' : '⚠️';
    console.log(`${icon} ${test.method} ${test.endpoint}`);
    console.log(`   ${result.message}\n`);
  }

  console.log('═'.repeat(70));
  console.log('FLOW 4: PAYMENT TRACKING');
  console.log('═'.repeat(70) + '\n');

  const paymentTests = [
    { endpoint: '/api/payments', method: 'GET', name: 'List payments' },
    { endpoint: '/api/payments', method: 'POST', name: 'Record payment' },
  ];

  for (const test of paymentTests) {
    const result = await testEndpoint(test.endpoint, test.method);
    results.push(result);
    const icon = result.status === 'EXISTS' ? '✅' : result.status === 'NOT_FOUND' ? '❌' : '⚠️';
    console.log(`${icon} ${test.method} ${test.endpoint}`);
    console.log(`   ${result.message}\n`);
  }

  console.log('═'.repeat(70));
  console.log('FLOW 5: CUSTOMER MANAGEMENT');
  console.log('═'.repeat(70) + '\n');

  const customerTests = [
    { endpoint: '/api/customers', method: 'GET', name: 'List customers' },
    { endpoint: '/api/customers', method: 'POST', name: 'Create customer' },
  ];

  for (const test of customerTests) {
    const result = await testEndpoint(test.endpoint, test.method);
    results.push(result);
    const icon = result.status === 'EXISTS' ? '✅' : result.status === 'NOT_FOUND' ? '❌' : '⚠️';
    console.log(`${icon} ${test.method} ${test.endpoint}`);
    console.log(`   ${result.message}\n`);
  }

  // Summary
  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const exists = results.filter(r => r.status === 'EXISTS').length;
  const notFound = results.filter(r => r.status === 'NOT_FOUND').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  const percentage = Math.round((exists / results.length) * 100);

  console.log(`✅ Endpoints exist: ${exists}/${results.length} (${percentage}%)`);
  console.log(`❌ Not found:       ${notFound}/${results.length}`);
  console.log(`⚠️  Errors:          ${errors}/${results.length}`);

  if (notFound > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('MISSING ENDPOINTS (Need to build):');
    console.log('─'.repeat(70));
    results.filter(r => r.status === 'NOT_FOUND').forEach(r => {
      console.log(`❌ ${r.method} ${r.endpoint}`);
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('WEEK 1 BACKEND STATUS');
  console.log('═'.repeat(70));

  if (percentage === 100) {
    console.log('\n✅ EXCELLENT! All required API endpoints exist.');
    console.log('   Week 1 work: Just verify UI connections to these APIs.');
  } else if (percentage >= 80) {
    console.log('\n✅ GOOD! Most endpoints exist.');
    console.log(`   Week 1 work: Build ${notFound} missing endpoints + UI integration.`);
  } else {
    console.log('\n⚠️  NEEDS WORK! Significant backend gaps.');
    console.log(`   Week 1 work: Build ${notFound} missing endpoints before UI work.`);
  }

  console.log('\n' + '═'.repeat(70));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
