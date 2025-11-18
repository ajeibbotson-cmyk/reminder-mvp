import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('\n📝 Updating Email Templates to Mention PDF Attachment\n')
  console.log('='.repeat(60))

  // Get all active templates
  const templates = await prisma.emailTemplate.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      name: true,
      contentEn: true,
      contentAr: true
    }
  })

  console.log(`\nFound ${templates.length} active templates to update\n`)

  let updatedCount = 0

  for (const template of templates) {
    let needsUpdate = false
    let newContentEn = template.contentEn
    let newContentAr = template.contentAr

    // Check if English content already mentions PDF attachment
    if (!newContentEn.includes('PDF') && !newContentEn.includes('attached')) {
      // Add PDF mention after the greeting/intro, before the closing
      // Find a good insertion point (after first paragraph or invoice details)
      const insertionPoint = newContentEn.indexOf('Please')

      if (insertionPoint > -1) {
        const pdfNotice = '\n\n📎 For your convenience, a copy of the invoice is attached to this email as a PDF.\n'
        newContentEn = newContentEn.slice(0, insertionPoint) + pdfNotice + '\n' + newContentEn.slice(insertionPoint)
        needsUpdate = true
      }
    }

    // Check if Arabic content needs update
    if (newContentAr && !newContentAr.includes('PDF') && !newContentAr.includes('مرفق')) {
      const insertionPoint = newContentAr.indexOf('نرجو')

      if (insertionPoint > -1) {
        const pdfNoticeAr = '\n\n📎 للراحة الخاصة بك، نسخة من الفاتورة مرفقة بهذا البريد الإلكتروني بصيغة PDF.\n'
        newContentAr = newContentAr.slice(0, insertionPoint) + pdfNoticeAr + '\n' + newContentAr.slice(insertionPoint)
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await prisma.emailTemplate.update({
        where: { id: template.id },
        data: {
          contentEn: newContentEn,
          contentAr: newContentAr,
          updatedAt: new Date()
        }
      })

      console.log(`✅ Updated: ${template.name}`)
      updatedCount++
    } else {
      console.log(`⏭️  Skipped: ${template.name} (already mentions PDF or no good insertion point)`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Update Complete: ${updatedCount}/${templates.length} templates updated`)
  console.log('='.repeat(60))
  console.log('\n📧 Email templates now mention PDF attachments')
  console.log('🎯 Reminder emails will automatically attach invoice PDFs when available\n')
}

main()
  .catch((error) => {
    console.error('\n❌ Update failed:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
