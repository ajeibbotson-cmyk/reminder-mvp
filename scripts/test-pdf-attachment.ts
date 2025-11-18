import { PrismaClient } from '@prisma/client'
import { getDefaultEmailService } from '@/lib/email-service'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('\n🧪 Testing Invoice PDF Attachment\n')
  console.log('='.repeat(50))

  // Find the invoice with PDF
  const invoice = await prisma.invoice.findFirst({
    where: {
      number: 'V01250703'
    },
    include: {
      customer: true,
      company: true
    }
  })

  if (!invoice) {
    console.log('❌ Invoice V01250703 not found')
    return
  }

  console.log(`\n✅ Found invoice: ${invoice.number}`)
  console.log(`   Amount: AED ${invoice.totalAmount}`)
  console.log(`   Customer: ${invoice.customer?.name || invoice.customerName}`)
  console.log(`   PDF Bucket: ${invoice.pdfS3Bucket}`)
  console.log(`   PDF Key: ${invoice.pdfS3Key}`)
  console.log('')

  // Prepare email content
  const emailSubject = `Payment Reminder: Invoice ${invoice.number} - AED ${invoice.totalAmount}`
  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Payment Reminder</h2>

      <p>Dear ${invoice.customer?.name || invoice.customerName},</p>

      <p>This is a friendly reminder regarding Invoice <strong>${invoice.number}</strong> for <strong>AED ${invoice.totalAmount}</strong>.</p>

      <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="margin-top: 0;">Invoice Details</h3>
        <p><strong>Invoice Number:</strong> ${invoice.number}</p>
        <p><strong>Amount Due:</strong> AED ${invoice.totalAmount}</p>
        <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${invoice.status}</p>
      </div>

      <p>📎 <strong>Invoice PDF is attached to this email for your reference.</strong></p>

      <p>Please arrange payment at your earliest convenience.</p>

      <p>Thank you for your business.</p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

      <p style="font-size: 12px; color: #666;">
        This is an automated payment reminder from Reminder - CCaaS Platform<br>
        Powered by Postmark
      </p>
    </div>
  `

  console.log('📧 Sending email with PDF attachment...')
  console.log(`   To: ajeibbotson@gmail.com (test)`)
  console.log(`   Subject: ${emailSubject}`)
  console.log(`   Attachment: Invoice-${invoice.number}.pdf`)
  console.log('')

  const emailService = getDefaultEmailService()

  try {
    const emailLogId = await emailService.sendEmail({
      recipientEmail: 'ajeibbotson@gmail.com',
      recipientName: invoice.customer?.name || invoice.customerName || 'Test Customer',
      subject: emailSubject,
      content: emailContent,
      templateId: undefined,
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      customerId: invoice.customer?.id,
      language: 'ENGLISH',
      attachInvoicePDF: true // Enable PDF attachment
    })

    console.log('✅ Email sent successfully!')
    console.log(`   Email Log ID: ${emailLogId}`)
    console.log('')

    // Verify email log
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: {
        invoice: true,
        customer: true,
        company: true
      }
    })

    if (emailLog) {
      console.log('✅ Email log verified')
      console.log(`   Recipient: ${emailLog.recipientEmail}`)
      console.log(`   Status: ${emailLog.deliveryStatus}`)
      console.log(`   Provider Message ID: ${emailLog.providerMessageId}`)
      console.log('')
    }

    console.log('='.repeat(50))
    console.log('✅ PDF ATTACHMENT TEST COMPLETE')
    console.log('='.repeat(50))
    console.log('')
    console.log('🎯 Next Steps:')
    console.log('  1. Check ajeibbotson@gmail.com inbox')
    console.log('  2. Verify PDF attachment is present')
    console.log('  3. Open PDF to confirm it displays correctly')
    console.log('  4. Check Postmark Activity for delivery tracking')
    console.log('')
    console.log('🔗 Postmark Activity: https://account.postmarkapp.com/servers/17479339/streams/outbound/activity')
    console.log('')

  } catch (error: any) {
    console.log('❌ ERROR:', error.message)
    console.log('')
    throw error
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
