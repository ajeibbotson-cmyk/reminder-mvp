import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin() {
  const testEmail = 'smoke-test@example.com';
  const testPassword = 'SmokeTest123!';

  console.log('🧪 Testing production login authentication...\n');

  try {
    // Fetch user exactly like NextAuth does
    console.log(`📧 Looking up user: ${testEmail}`);
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { company: true }
    });

    if (!user) {
      console.error('❌ User not found');
      return;
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`🏢 Company: ${user.company?.name}`);
    console.log(`🔑 Has password: ${!!user.password}`);
    console.log(`📏 Password length: ${user.password?.length || 0} characters`);

    if (!user.password) {
      console.error('❌ User has no password set');
      return;
    }

    // Test bcrypt comparison exactly like NextAuth does
    console.log(`\n🔐 Testing password comparison...`);
    console.log(`   Test password: "${testPassword}"`);

    const isPasswordValid = await compare(testPassword, user.password);

    console.log(`\n${isPasswordValid ? '✅' : '❌'} Password comparison result: ${isPasswordValid}`);

    if (isPasswordValid) {
      console.log('\n🎉 SUCCESS: Authentication should work!');
      console.log(`   User would be authenticated as:`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Company ID: ${user.companyId}`);
    } else {
      console.log('\n❌ FAILURE: Password comparison failed!');
      console.log('   Possible causes:');
      console.log('   1. Wrong password stored in database');
      console.log('   2. Password not properly hashed');
      console.log('   3. Bcrypt rounds mismatch');
    }
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
