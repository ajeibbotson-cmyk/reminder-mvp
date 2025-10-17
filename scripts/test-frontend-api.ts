/**
 * Test what the frontend receives from the API
 * Makes actual HTTP request like the browser does
 */

async function testFrontendAPI() {
  const baseUrl = 'http://localhost:3000'

  console.log('🔐 Step 1: Get CSRF token\n')

  // Get CSRF token first
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`)
  const { csrfToken } = await csrfResponse.json()
  console.log(`CSRF Token: ${csrfToken ? 'Received' : 'None'}`)

  const csrfCookies = csrfResponse.headers.get('set-cookie')

  console.log('\n🔐 Step 2: Login with credentials\n')

  // Login with CSRF token
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookies || '',
    },
    body: new URLSearchParams({
      email: 'test@reminder.com',
      password: 'password123',
      csrfToken,
      callbackUrl: `${baseUrl}/dashboard`,
      redirect: 'false',
      json: 'true',
    }),
    redirect: 'manual', // Don't follow redirects
  })

  console.log(`Login Status: ${loginResponse.status}`)

  const loginCookies = loginResponse.headers.get('set-cookie')
  console.log(`Login Cookies: ${loginCookies ? 'Received' : 'None'}`)

  // Combine cookies from both requests
  const allCookies = [csrfCookies, loginCookies].filter(Boolean).join('; ')

  if (!allCookies) {
    console.error('\n❌ No session cookie received - authentication failed')
    return
  }

  console.log('\n📋 Combined Cookies for API request')

  console.log('\n📊 Step 3: Fetch invoices with session cookie\n')

  // Fetch invoices
  const invoicesResponse = await fetch(
    `${baseUrl}/api/invoices?status=&page=1&limit=10&sort_by=created_at&sort_order=desc`,
    {
      headers: {
        Cookie: allCookies,
      },
    }
  )

  console.log(`API Status: ${invoicesResponse.status}`)
  console.log(`Content-Type: ${invoicesResponse.headers.get('content-type')}`)

  const responseText = await invoicesResponse.text()

  if (invoicesResponse.status !== 200) {
    console.error(`\n❌ API returned ${invoicesResponse.status}`)
    console.error('Response:', responseText)
    return
  }

  const data = JSON.parse(responseText)

  console.log('\n✅ API Response Structure:')
  console.log(JSON.stringify(data, null, 2))

  if (data.success && data.data) {
    console.log(`\n📦 Data Summary:`)
    console.log(`- success: ${data.success}`)
    console.log(`- invoices count: ${data.data.invoices?.length || 0}`)
    console.log(`- totalCount: ${data.data.pagination?.totalCount || 0}`)
    console.log(`- statusCounts:`, data.data.statusCounts || {})

    if (data.data.invoices && data.data.invoices.length > 0) {
      console.log(`\n📄 Sample Invoice:`)
      const sample = data.data.invoices[0]
      console.log({
        number: sample.number,
        customer_name: sample.customer_name,
        amount: sample.amount,
        currency: sample.currency,
        status: sample.status,
      })
    } else {
      console.log('\n⚠️ API returned 0 invoices despite 200 status')
    }
  } else {
    console.log('\n❌ Unexpected response structure:', data)
  }
}

testFrontendAPI()
  .catch(console.error)
  .finally(() => process.exit(0))
