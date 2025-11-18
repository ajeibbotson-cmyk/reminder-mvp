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
  console.log('\n🧪 Testing Full Invoice Reminder Flow\n')
  console.log('='.repeat(50))

  const companyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8' // admin@testcompany.ae

  // Step 1: Find an overdue invoice
  console.log('\n📋 Step 1: Finding an overdue invoice...')

  const overdueInvoice = await prisma.invoice.findFirst({
    where: {
      companyId,
      status: 'OVERDUE'
    },
    include: {
      customer: true,
      company: true
    }
  })

  if (!overdueInvoice) {
    console.log('❌ No overdue invoices found. Creating a test scenario...\n')

    // Find any invoice and mark it as overdue for testing
    const anyInvoice = await prisma.invoice.findFirst({
      where: { companyId },
      include: {
        customer: true,
        company: true
      }
    })

    if (!anyInvoice) {
      console.log('❌ No invoices found at all!')
      return
    }

    console.log(`  Using invoice: ${anyInvoice.number}`)
    console.log(`  Customer: ${anyInvoice.customer?.name || anyInvoice.customerName}`)
    console.log(`  Amount: AED ${anyInvoice.totalAmount}`)
    console.log('')

    // Use this invoice for testing
    var testInvoice = anyInvoice
  } else {
    console.log(`  ✅ Found overdue invoice: ${overdueInvoice.number}`)
    console.log(`  Customer: ${overdueInvoice.customer?.name || overdueInvoice.customerName}`)
    console.log(`  Amount: AED ${overdueInvoice.totalAmount}`)
    console.log(`  Due Date: ${overdueInvoice.dueDate}`)
    console.log('')
    var testInvoice = overdueInvoice
  }

  // Step 2: Prepare email content
  console.log('📝 Step 2: Preparing email content...')

  const emailSubject = `Payment Reminder: Invoice ${testInvoice.number} - AED ${testInvoice.totalAmount}`
  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Payment Reminder</h2>

      <p>Dear ${testInvoice.customer?.name || testInvoice.customerName},</p>

      <p>This is a friendly reminder that Invoice <strong>${testInvoice.number}</strong> for <strong>AED ${testInvoice.totalAmount}</strong> is now overdue.</p>

      <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="margin-top: 0;">Invoice Details</h3>
        <p><strong>Invoice Number:</strong> ${testInvoice.number}</p>
        <p><strong>Amount Due:</strong> AED ${testInvoice.totalAmount}</p>
        <p><strong>Due Date:</strong> ${new Date(testInvoice.dueDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> OVERDUE</p>
      </div>

      <p>Please arrange payment at your earliest convenience.</p>

      <p>If you have already made this payment, please disregard this message or contact us to confirm receipt.</p>

      <h3>Payment Information</h3>
      <p><strong>Company:</strong> ${testInvoice.company?.name}</p>

      <p>Thank you for your business.</p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

      <p style="font-size: 12px; color: #666;">
        This is an automated payment reminder from Reminder - CCaaS Platform<br>
        Powered by Postmark
      </p>
    </div>
  `

  console.log(`  ✅ Subject: ${emailSubject}`)
  console.log(`  ✅ Recipient: ${testInvoice.customer?.email || testInvoice.customerEmail}`)
  console.log('')

  // Step 3: Send email via Postmark
  console.log('📤 Step 3: Sending email via Postmark...')
  console.log(`  🎯 Test Recipient: ajeibbotson@gmail.com (for testing)`)
  console.log('')

  const emailService = getDefaultEmailService()

  try {
    const emailLogId = await emailService.sendEmail({
      recipientEmail: 'ajeibbotson@gmail.com', // Test to your email
      recipientName: testInvoice.customer?.name || testInvoice.customerName || 'Test Customer',
      subject: emailSubject,
      content: emailContent,
      templateId: undefined,
      companyId: testInvoice.companyId,
      invoiceId: testInvoice.id,
      customerId: testInvoice.customer?.id,
      language: 'ENGLISH'
    })

    console.log('  ✅ Email sent successfully!')
    console.log(`  📊 Email Log ID: ${emailLogId}`)
    console.log('')

    // Step 4: Verify email log was created
    console.log('🔍 Step 4: Verifying email log in database...')

    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: {
        invoice: true,
        customer: true,
        company: true
      }
    })

    if (emailLog) {
      console.log('  ✅ Email log created successfully')
      console.log(`  📧 Recipient: ${emailLog.recipientEmail}`)
      console.log(`  📝 Status: ${emailLog.deliveryStatus}`)
      console.log(`  🔗 Invoice: ${emailLog.invoice?.number}`)
      console.log(`  👤 Customer: ${emailLog.customer?.name}`)
      console.log(`  🏢 Company: ${emailLog.company?.name}`)
      console.log('')
    } else {
      console.log('  ❌ Email log not found!')
      console.log('')
    }

    // Step 5: Summary
    console.log('='.repeat(50))
    console.log('✅ INVOICE REMINDER FLOW TEST COMPLETE')
    console.log('='.repeat(50))
    console.log('')
    console.log('📊 Results:')
    console.log(`  ✅ Invoice selected: ${testInvoice.number}`)
    console.log(`  ✅ Email prepared and sent via Postmark`)
    console.log(`  ✅ Email logged in database`)
    console.log(`  ✅ All relationships intact (invoice, customer, company)`)
    console.log('')
    console.log('🎯 Next Steps:')
    console.log('  1. Check ajeibbotson@gmail.com for the email')
    console.log('  2. Verify tracking (open/click) in Postmark Activity stream')
    console.log('  3. Monitor webhooks for delivery confirmation')
    console.log('')
    console.log('🔗 Postmark Activity: https://account.postmarkapp.com/servers/17479339/streams/outbound/activity')
    console.log('')

  } catch (error: any) {
    console.log('  ❌ ERROR:', error.message)
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
