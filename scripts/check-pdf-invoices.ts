import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('\n🔍 Checking for invoices with PDFs...\n')

  const invoicesWithPDF = await prisma.invoice.findMany({
    where: {
      NOT: {
        pdfS3Key: null
      }
    },
    select: {
      id: true,
      number: true,
      pdfS3Bucket: true,
      pdfS3Key: true,
      pdfUploadedAt: true,
      totalAmount: true
    },
    take: 10
  })

  console.log(`📊 Found ${invoicesWithPDF.length} invoices with PDFs\n`)

  if (invoicesWithPDF.length > 0) {
    invoicesWithPDF.forEach(inv => {
      console.log(`Invoice: ${inv.number}`)
      console.log(`  Amount: AED ${inv.totalAmount}`)
      console.log(`  S3 Bucket: ${inv.pdfS3Bucket}`)
      console.log(`  S3 Key: ${inv.pdfS3Key}`)
      console.log(`  Uploaded: ${inv.pdfUploadedAt}`)
      console.log('')
    })
  } else {
    console.log('⚠️  No invoices have PDFs stored in S3 yet')
    console.log('   PDFs need to be uploaded to S3 when invoices are imported/created')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
