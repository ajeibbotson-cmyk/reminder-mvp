import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'smoke-test@example.com' },
      include: { company: true }
    });
    
    console.log('User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('- Email:', user.email);
      console.log('- Has password:', !!user.password);
      console.log('- Password length:', user.password?.length || 0);
      console.log('- Company:', user.company?.name);
    } else {
      console.log('❌ Production test user does not exist!');
      console.log('The smoke-test@example.com user needs to be created in production DB');
    }
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
