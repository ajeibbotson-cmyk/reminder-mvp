/**
 * Test Production API Authentication
 *
 * This script tests the actual NextAuth API endpoint in production
 * to see if authentication is working correctly.
 */

async function testProductionAuth() {
  const baseURL = 'https://reminder-mvp.vercel.app';
  const testEmail = 'smoke-test@example.com';
  const testPassword = 'SmokeTest123!';

  console.log('🧪 Testing Production API Authentication\n');
  console.log(`📍 Target: ${baseURL}`);
  console.log(`👤 Email: ${testEmail}`);
  console.log(`🔑 Password: ${testPassword}\n`);

  try {
    // Step 1: Get CSRF token
    console.log('1️⃣  Getting CSRF token...');
    const csrfResponse = await fetch(`${baseURL}/api/auth/csrf`);
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;
    console.log(`   ✅ CSRF Token obtained: ${csrfToken.substring(0, 20)}...\n`);

    // Step 2: Attempt signin
    console.log('2️⃣  Attempting signin via API...');
    const signinResponse = await fetch(`${baseURL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: testEmail,
        password: testPassword,
        csrfToken: csrfToken,
        callbackUrl: `${baseURL}/en/dashboard`,
        json: 'true',
      }),
      redirect: 'manual', // Don't follow redirects
    });

    console.log(`   📊 Response Status: ${signinResponse.status}`);
    console.log(`   📍 Response URL: ${signinResponse.url}`);

    // Check headers
    const setCookieHeaders = signinResponse.headers.get('set-cookie');
    if (setCookieHeaders) {
      console.log(`   🍪 Set-Cookie header present`);
      const cookies = setCookieHeaders.split(',').map(c => c.split(';')[0]);
      console.log(`   🍪 Cookies being set: ${cookies.length}`);
      cookies.forEach(cookie => {
        const [name] = cookie.split('=');
        console.log(`      - ${name.trim()}`);
      });
    } else {
      console.log(`   ❌ No Set-Cookie header found!`);
    }

    // Try to get response body
    const contentType = signinResponse.headers.get('content-type');
    console.log(`   📄 Content-Type: ${contentType}`);

    if (contentType?.includes('application/json')) {
      const jsonResponse = await signinResponse.json();
      console.log(`   📦 JSON Response:`);
      console.log(JSON.stringify(jsonResponse, null, 2));

      if (jsonResponse.error) {
        console.log(`\n   ❌ Authentication ERROR: ${jsonResponse.error}`);
      } else if (jsonResponse.url) {
        console.log(`\n   ✅ Authentication successful!`);
        console.log(`   📍 Redirect URL: ${jsonResponse.url}`);
      }
    } else {
      const textResponse = await signinResponse.text();
      console.log(`   📄 Response (first 500 chars):`);
      console.log(textResponse.substring(0, 500));
    }

    // Step 3: Check session
    console.log(`\n3️⃣  Checking session...`);
    const sessionResponse = await fetch(`${baseURL}/api/auth/session`, {
      headers: {
        'Cookie': setCookieHeaders || '',
      },
    });
    const sessionData = await sessionResponse.json();
    console.log(`   📦 Session data:`);
    console.log(JSON.stringify(sessionData, null, 2));

    if (sessionData.user) {
      console.log(`\n   ✅ Session established successfully!`);
      console.log(`   👤 User: ${sessionData.user.email}`);
    } else {
      console.log(`\n   ❌ No session established!`);
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

testProductionAuth();
