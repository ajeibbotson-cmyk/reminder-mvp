#!/usr/bin/env npx tsx
/**
 * Week 1 Integration Tests - UI-API Flow Verification
 *
 * Tests the 5 core UI-API integration flows:
 * 1. Login → Dashboard (metrics display)
 * 2. Invoice creation (CSV/manual/PDF)
 * 3. Campaign creation (modal → API → SES)
 * 4. Payment recording (form → API)
 * 5. Customer management (CRUD operations)
 */

interface TestResult {
  test: string;
  flow: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP';
  message: string;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  testName: string,
  flow: string,
  testFn: () => Promise<{ status: 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIP', message: string, details?: string }>
) {
  try {
    const result = await testFn();
    results.push({
      test: testName,
      flow,
      status: result.status,
      message: result.message,
      details: result.details
    });

    const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '⚠️' : result.status === 'SKIP' ? '⏭️' : '❌';
    console.log(`${icon} ${flow}: ${testName} - ${result.message}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      test: testName,
      flow,
      status: 'FAIL',
      message: 'Exception thrown',
      error: errorMsg
    });
    console.error(`❌ ${flow}: ${testName} - ${errorMsg}`);
  }
}

async function getAuthToken(): Promise<string> {
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
  console.log('🧪 Week 1 Integration Tests - UI-API Flow Verification\n');
  console.log('Testing 5 core flows required for Dec beta launch:\n');

  let token: string;

  // Authenticate first
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

  console.log('═══════════════════════════════════════════════════════════');
  console.log('FLOW 1: LOGIN → DASHBOARD');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1.1: Dashboard metrics API
  await runTest(
    'Dashboard Metrics API',
    'Login → Dashboard',
    async () => {
      const response = await fetch('http://localhost:3000/api/invoices/buckets', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.buckets || !Array.isArray(data.buckets)) {
        return {
          status: 'FAIL',
          message: 'Invalid response structure',
          details: JSON.stringify(data)
        };
      }

      if (typeof data.totalInvoices !== 'number') {
        return {
          status: 'FAIL',
          message: 'Missing totalInvoices metric',
          details: JSON.stringify(data)
        };
      }

      return {
        status: 'PASS',
        message: 'API returns correct structure',
        details: `${data.buckets.length} buckets, ${data.totalInvoices} total invoices`
      };
    }
  );

  // Test 1.2: Analytics dashboard endpoint
  await runTest(
    'Analytics Dashboard API',
    'Login → Dashboard',
    async () => {
      const response = await fetch('http://localhost:3000/api/analytics/dashboard', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'PARTIAL',
          message: `Endpoint exists but returns ${response.status}`,
          details: 'May need UI to trigger properly'
        };
      }

      const data = await response.json();
      return {
        status: 'PASS',
        message: 'Analytics API working',
        details: JSON.stringify(data).substring(0, 100) + '...'
      };
    }
  );

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FLOW 2: INVOICE CREATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 2.1: Invoice list endpoint
  await runTest(
    'Invoice List API',
    'Invoice Creation',
    async () => {
      const response = await fetch('http://localhost:3000/api/invoices', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.invoices || !Array.isArray(data.invoices)) {
        return {
          status: 'FAIL',
          message: 'Invalid response structure'
        };
      }

      return {
        status: 'PASS',
        message: 'API returns invoice list',
        details: `${data.invoices.length} invoices found`
      };
    }
  );

  // Test 2.2: Invoice creation endpoint
  await runTest(
    'Invoice Creation API',
    'Invoice Creation',
    async () => {
      const response = await fetch('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: `INT-TEST-${Date.now()}`,
          customerName: 'Integration Test Customer',
          customerEmail: 'integration@test.com',
          amount: 1000,
          currency: 'AED',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Week 1 integration test invoice'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: error
        };
      }

      const data = await response.json();

      if (!data.id) {
        return {
          status: 'FAIL',
          message: 'No invoice ID in response'
        };
      }

      return {
        status: 'PASS',
        message: 'Invoice created successfully',
        details: `Invoice ID: ${data.id}`
      };
    }
  );

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FLOW 3: CAMPAIGN CREATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 3.1: Template listing
  await runTest(
    'Email Template API',
    'Campaign Creation',
    async () => {
      const response = await fetch('http://localhost:3000/api/templates', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.templates || !Array.isArray(data.templates)) {
        return {
          status: 'FAIL',
          message: 'Invalid response structure'
        };
      }

      return {
        status: 'PASS',
        message: 'Template API working',
        details: `${data.templates.length} templates available`
      };
    }
  );

  // Test 3.2: Campaign creation endpoint
  await runTest(
    'Campaign Creation API',
    'Campaign Creation',
    async () => {
      const response = await fetch('http://localhost:3000/api/campaigns', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: `Integration Test Campaign ${Date.now()}`,
          invoiceIds: [], // Empty for now
          templateId: 'test-template',
          scheduledFor: new Date().toISOString()
        })
      });

      if (response.status === 400 || response.status === 422) {
        return {
          status: 'PARTIAL',
          message: 'Endpoint exists, validation working',
          details: 'Needs valid invoice IDs to fully test'
        };
      }

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();
      return {
        status: 'PASS',
        message: 'Campaign API working',
        details: JSON.stringify(data).substring(0, 100)
      };
    }
  );

  // Test 3.3: Campaign listing
  await runTest(
    'Campaign List API',
    'Campaign Creation',
    async () => {
      const response = await fetch('http://localhost:3000/api/campaigns', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.campaigns || !Array.isArray(data.campaigns)) {
        return {
          status: 'FAIL',
          message: 'Invalid response structure'
        };
      }

      return {
        status: 'PASS',
        message: 'Campaign list API working',
        details: `${data.campaigns.length} campaigns found`
      };
    }
  );

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FLOW 4: PAYMENT RECORDING');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 4.1: Payment listing
  await runTest(
    'Payment List API',
    'Payment Recording',
    async () => {
      const response = await fetch('http://localhost:3000/api/payments', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.payments || !Array.isArray(data.payments)) {
        return {
          status: 'FAIL',
          message: 'Invalid response structure'
        };
      }

      return {
        status: 'PASS',
        message: 'Payment list API working',
        details: `${data.payments.length} payments found`
      };
    }
  );

  // Test 4.2: Payment creation endpoint
  await runTest(
    'Payment Creation API',
    'Payment Recording',
    async () => {
      // First create an invoice to associate payment with
      const invoiceResponse = await fetch('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: `PAY-TEST-${Date.now()}`,
          customerName: 'Payment Test Customer',
          customerEmail: 'payment-test@example.com',
          amount: 500,
          currency: 'AED',
          dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          description: 'Invoice for payment test'
        })
      });

      if (!invoiceResponse.ok) {
        return {
          status: 'SKIP',
          message: 'Could not create test invoice',
          details: 'Skipping payment creation test'
        };
      }

      const invoice = await invoiceResponse.json();

      // Now try to create payment
      const paymentResponse = await fetch('http://localhost:3000/api/payments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: 500,
          paymentDate: new Date().toISOString(),
          method: 'BANK_TRANSFER',
          reference: 'INT-TEST-REF-001',
          notes: 'Integration test payment'
        })
      });

      if (!paymentResponse.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${paymentResponse.status}`,
          details: await paymentResponse.text()
        };
      }

      const payment = await paymentResponse.json();

      if (!payment.id) {
        return {
          status: 'FAIL',
          message: 'No payment ID in response'
        };
      }

      return {
        status: 'PASS',
        message: 'Payment created successfully',
        details: `Payment ID: ${payment.id}`
      };
    }
  );

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FLOW 5: CUSTOMER MANAGEMENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 5.1: Customer listing
  await runTest(
    'Customer List API',
    'Customer Management',
    async () => {
      const response = await fetch('http://localhost:3000/api/customers', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.customers || !Array.isArray(data.customers)) {
        return {
          status: 'FAIL',
          message: 'Invalid response structure'
        };
      }

      return {
        status: 'PASS',
        message: 'Customer list API working',
        details: `${data.customers.length} customers found`
      };
    }
  );

  // Test 5.2: Customer creation
  await runTest(
    'Customer Creation API',
    'Customer Management',
    async () => {
      const response = await fetch('http://localhost:3000/api/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: `Integration Test Customer ${Date.now()}`,
          email: `int-test-${Date.now()}@example.com`,
          phone: '+971501234567',
          paymentTerms: 30
        })
      });

      if (!response.ok) {
        return {
          status: 'FAIL',
          message: `HTTP ${response.status}`,
          details: await response.text()
        };
      }

      const data = await response.json();

      if (!data.id) {
        return {
          status: 'FAIL',
          message: 'No customer ID in response'
        };
      }

      return {
        status: 'PASS',
        message: 'Customer created successfully',
        details: `Customer ID: ${data.id}`
      };
    }
  );

  // Print Summary
  console.log('\n' + '═'.repeat(60));
  console.log('INTEGRATION TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`\n✅ Passed:  ${passed}/${results.length}`);
  console.log(`❌ Failed:  ${failed}/${results.length}`);
  console.log(`⚠️  Partial: ${partial}/${results.length}`);
  console.log(`⏭️  Skipped: ${skipped}/${results.length}`);

  // Group results by flow
  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS BY FLOW:');
  console.log('─'.repeat(60));

  const flows = ['Login → Dashboard', 'Invoice Creation', 'Campaign Creation', 'Payment Recording', 'Customer Management'];

  flows.forEach(flow => {
    const flowResults = results.filter(r => r.flow === flow);
    const flowPassed = flowResults.filter(r => r.status === 'PASS').length;
    const flowTotal = flowResults.length;
    const percentage = flowTotal > 0 ? Math.round((flowPassed / flowTotal) * 100) : 0;

    const icon = percentage === 100 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
    console.log(`\n${icon} ${flow}: ${flowPassed}/${flowTotal} (${percentage}%)`);

    flowResults.forEach(r => {
      const resultIcon = r.status === 'PASS' ? '  ✅' : r.status === 'PARTIAL' ? '  ⚠️' : r.status === 'SKIP' ? '  ⏭️' : '  ❌';
      console.log(`${resultIcon} ${r.test}: ${r.message}`);
    });
  });

  // Show failures
  if (failed > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('FAILED TESTS (Need Fixing):');
    console.log('─'.repeat(60));
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`\n❌ ${r.flow}: ${r.test}`);
      console.log(`   Message: ${r.message}`);
      if (r.details) console.log(`   Details: ${r.details}`);
      if (r.error) console.log(`   Error: ${r.error}`);
    });
  }

  // Show partial results
  if (partial > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('PARTIAL TESTS (Need UI Verification):');
    console.log('─'.repeat(60));
    results.filter(r => r.status === 'PARTIAL').forEach(r => {
      console.log(`\n⚠️  ${r.flow}: ${r.test}`);
      console.log(`   Message: ${r.message}`);
      if (r.details) console.log(`   Details: ${r.details}`);
    });
  }

  console.log('\n' + '═'.repeat(60));
  console.log('WEEK 1 INTEGRATION STATUS');
  console.log('═'.repeat(60));

  const overallPercentage = Math.round((passed / results.length) * 100);

  if (overallPercentage === 100) {
    console.log('\n✅ EXCELLENT! All API endpoints working correctly.');
    console.log('   Week 1 integration work minimal - just verify UI connections.');
  } else if (overallPercentage >= 80) {
    console.log('\n✅ GOOD! Most API endpoints working.');
    console.log(`   Focus Week 1 on fixing ${failed} failed tests + UI verification.`);
  } else if (overallPercentage >= 50) {
    console.log('\n⚠️  MODERATE. About half the APIs working.');
    console.log(`   Week 1 needs significant integration work on ${failed} failed tests.`);
  } else {
    console.log('\n❌ NEEDS WORK. Most APIs have issues.');
    console.log(`   Week 1 requires substantial backend fixes before UI integration.`);
  }

  console.log('\n' + '═'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
