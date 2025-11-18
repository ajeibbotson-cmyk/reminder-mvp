/**
 * Create test user in production via API signup
 * Run: npx tsx scripts/create-production-test-user.ts
 */

async function createProductionTestUser() {
  const PRODUCTION_URL = 'https://reminder-mvp.vercel.app';

  const userData = {
    name: 'Smoke Test User',
    email: 'smoke-test@example.com',
    password: 'SmokeTest123!',
    company: 'Smoke Test Company'
  };

  console.log('🔧 Creating test user in production...');
  console.log(`📍 Target: ${PRODUCTION_URL}`);
  console.log(`📧 Email: ${userData.email}`);

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Signup failed:', response.status, response.statusText);
      console.error('Response:', JSON.stringify(data, null, 2));

      if (data.message && data.message.includes('already exists')) {
        console.log('ℹ️  User already exists - this is expected if previously created');
        console.log('✅ Test user is ready for E2E tests');
        return true;
      }

      return false;
    }

    console.log('✅ User created successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('');
    console.log('🎉 Test user ready for E2E tests');
    console.log('   Email: smoke-test@example.com');
    console.log('   Password: SmokeTest123!');

    return true;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return false;
  }
}

createProductionTestUser().then((success) => {
  process.exit(success ? 0 : 1);
});
