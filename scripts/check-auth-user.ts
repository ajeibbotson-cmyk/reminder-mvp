import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
})

async function checkUser() {
  try {
    console.log('🔍 Checking authentication user...')

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        email: {
          contains: 'andrew',
          mode: 'insensitive'
        }
      },
      include: {
        company: true
      }
    })

    if (!user) {
      console.log('❌ No user found with email containing "andrew"')

      // List all users
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      })
      console.log(`\n📋 Found ${allUsers.length} total users:`)
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.name}) [${u.role}]`)
      })
    } else {
      console.log(`✅ User found: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Name: ${user.name}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Company: ${user.company?.name}`)
      console.log(`   Has password: ${!!user.password}`)
      console.log(`   Password length: ${user.password?.length || 0}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()
