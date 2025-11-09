#!/usr/bin/env tsx
/**
 * Get authenticated session for API testing
 *
 * This script gets a valid NextAuth session token for programmatic API testing
 */

const BASE_URL = 'http://localhost:3000'
const TEST_EMAIL = 'smoke-test@example.com'
const TEST_PASSWORD = 'SmokeTest123!'

async function getAuthSession() {
  console.log('Getting authenticated session for API testing...\n')

  try {
    // Method 1: Try the callback/credentials endpoint directly
    console.log('Attempting direct credentials callback...')

    const authResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        redirect: false,
        callbackUrl: `${BASE_URL}/dashboard`
      }),
      redirect: 'manual'
    })

    console.log('Status:', authResponse.status)

    const setCookieHeader = authResponse.headers.get('set-cookie')
    console.log('Set-Cookie header:', setCookieHeader ? 'Present' : 'Missing')

    if (setCookieHeader) {
      console.log('\nFull Set-Cookie:')
      console.log(setCookieHeader)

      // Extract the session token
      const sessionMatch = setCookieHeader.match(/next-auth\.session-token=([^;]+)/)
      if (sessionMatch) {
        console.log('\n✅ Session token found!')
        console.log('Token:', sessionMatch[1].substring(0, 20) + '...')

        // Test with the session token
        console.log('\nTesting API with session token...')
        const testResponse = await fetch(`${BASE_URL}/api/invoices`, {
          headers: {
            'Cookie': `next-auth.session-token=${sessionMatch[1]}`
          }
        })

        console.log('API Response Status:', testResponse.status)

        if (testResponse.ok) {
          const data = await testResponse.json()
          console.log('\n✅ SUCCESS! API responded with:', data)
          console.log('\nUse this cookie for API testing:')
          console.log(`Cookie: next-auth.session-token=${sessionMatch[1]}`)
        } else {
          console.log('❌ API still returned:', testResponse.status)
          const error = await testResponse.json()
          console.log('Error:', error)
        }
      } else {
        console.log('\n❌ No session token in cookie')
      }
    } else {
      console.log('\n❌ No Set-Cookie header received')
      const body = await authResponse.text()
      console.log('Response:', body)
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  }
}

getAuthSession()
