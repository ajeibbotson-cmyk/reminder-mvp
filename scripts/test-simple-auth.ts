#!/usr/bin/env tsx
/**
 * Simple test to verify authentication works
 */

const BASE_URL = 'http://localhost:3000'
const TEST_EMAIL = 'smoke-test@example.com'
const TEST_PASSWORD = 'SmokeTest123!'

async function testAuth() {
  console.log('Testing NextAuth authentication...\n')

  try {
    // Test 1: Try to get CSRF token
    console.log('1. Getting CSRF token...')
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`)
    const csrfData = await csrfResponse.json()
    console.log('   CSRF Token:', csrfData.csrfToken ? 'Retrieved ✅' : 'Missing ❌')

    // Test 2: Try signin endpoint with credentials
    console.log('\n2. Attempting signin with credentials...')
    const signinResponse = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        csrfToken: csrfData.csrfToken || '',
        callbackUrl: `${BASE_URL}/dashboard`,
        json: 'true'
      }),
      redirect: 'manual'
    })

    console.log('   Status:', signinResponse.status)

    const signinBody = await signinResponse.text()
    console.log('   Response Body:', signinBody)
    console.log('   Headers:', Object.fromEntries(signinResponse.headers.entries()))

    const setCookie = signinResponse.headers.get('set-cookie')
    console.log('   Set-Cookie:', setCookie ? 'Present ✅' : 'Missing ❌')

    if (setCookie) {
      // Test 3: Try to access protected endpoint with cookie
      console.log('\n3. Testing protected endpoint with cookie...')
      const testResponse = await fetch(`${BASE_URL}/api/invoices`, {
        headers: {
          'Cookie': setCookie
        }
      })

      console.log('   Status:', testResponse.status)
      const data = await testResponse.json()
      console.log('   Response:', data)

      if (testResponse.ok) {
        console.log('\n✅ SUCCESS: Authentication working!')
      } else {
        console.log('\n❌ FAIL: Protected endpoint returned', testResponse.status)
      }
    } else {
      console.log('\n❌ FAIL: No authentication cookie received')
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  }
}

testAuth()
