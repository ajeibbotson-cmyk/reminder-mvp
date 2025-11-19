import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('\n📧 Checking Email Templates\n')

  const templates = await prisma.emailTemplate.findMany({
    take: 10,
    select: {
      id: true,
      name: true,
      templateType: true,
      subjectEn: true,
      contentEn: true,
      isDefault: true,
      isActive: true
    }
  })

  console.log(`Found ${templates.length} email templates:\n`)

  templates.forEach(t => {
    console.log(`📄 ${t.name} (${t.templateType})`)
    console.log(`   Subject: ${t.subjectEn.substring(0, 60)}...`)
    console.log(`   Default: ${t.isDefault ? '✅' : '❌'} | Active: ${t.isActive ? '✅' : '❌'}`)
    console.log(`   Content preview: ${t.contentEn.substring(0, 80).replace(/\n/g, ' ')}...`)
    console.log('')
  })

  if (templates.length === 0) {
    console.log('⚠️  No email templates found in database')
    console.log('   Templates need to be created for automated reminders')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
