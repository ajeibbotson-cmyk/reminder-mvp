/**
 * Verify Production Authentication Setup
 *
 * This script tests if the smoke-test user exists in production
 * and if authentication would work correctly.
 */

import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();

async function verifyProductionAuth() {
  console.log('🔍 Verifying production authentication setup...\n');

  try {
    // Check database connection
    console.log('📡 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected\n');

    // Look up test user
    const testEmail = 'smoke-test@example.com';
    const testPassword = 'SmokeTest123!';

    console.log(`🔍 Looking for user: ${testEmail}`);
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { company: true }
    });

    if (!user) {
      console.log('❌ User NOT found in production database!');
      console.log('\n📝 To create this user, run:');
      console.log('   npx tsx scripts/create-test-user-for-smoke-tests.ts');
      process.exit(1);
    }

    console.log('✅ User found in database');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Company: ${user.company.name} (${user.company.id})`);
    console.log(`   Password hash present: ${!!user.password}`);
    console.log(`   Password hash length: ${user.password?.length || 0} chars\n`);

    // Test password validation
    console.log('🔐 Testing password validation...');
    const isValid = await compare(testPassword, user.password || '');

    if (isValid) {
      console.log('✅ Password validation PASSED');
    } else {
      console.log('❌ Password validation FAILED');
      console.log('   The password hash in production does not match "SmokeTest123!"');
      console.log('\n📝 To fix, delete and recreate the user:');
      console.log('   npx tsx scripts/create-test-user-for-smoke-tests.ts');
      process.exit(1);
    }

    console.log('\n✅ All authentication checks passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Ensure NEXTAUTH_URL is set to https://reminder-mvp.vercel.app on Vercel');
    console.log('   2. Ensure NEXTAUTH_SECRET matches between local and Vercel');
    console.log('   3. Run: TEST_ENV=production npx playwright test');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProductionAuth();
