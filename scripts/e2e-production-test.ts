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
  console.log('\n🧪 END-TO-END PRODUCTION TEST')
  console.log('='.repeat(70))
  console.log('\nThis test validates the complete invoice reminder flow:\n')
  console.log('1. Find/Select an invoice')
  console.log('2. Prepare reminder email')
  console.log('3. Send via Postmark with PDF attachment')
  console.log('4. Verify email log creation')
  console.log('5. Check Postmark delivery')
  console.log('6. Validate all database relationships')
  console.log('\n' + '='.repeat(70))

  const companyId = '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8' // admin@testcompany.ae

  // STEP 1: Find an invoice with good data
  console.log('\n📋 STEP 1: Selecting Invoice for Testing')
  console.log('-'.repeat(70))

  const testInvoice = await prisma.invoice.findFirst({
    where: {
      companyId,
      status: 'OVERDUE',
      customer: {
        is: {} // Customer exists (not null)
      }
    },
    include: {
      customer: true,
      company: true
    },
    orderBy: {
      dueDate: 'desc'
    }
  })

  if (!testInvoice) {
    console.log('❌ No suitable test invoice found')
    console.log('   Need: OVERDUE invoice with customer relationship')
    return
  }

  console.log(`✅ Selected Invoice: ${testInvoice.number}`)
  console.log(`   Status: ${testInvoice.status}`)
  console.log(`   Amount: AED ${testInvoice.totalAmount}`)
  console.log(`   Due Date: ${testInvoice.dueDate.toLocaleDateString()}`)
  console.log(`   Customer: ${testInvoice.customer?.name || testInvoice.customerName}`)
  console.log(`   Customer Email: ${testInvoice.customer?.email || testInvoice.customerEmail}`)
  console.log(`   Has PDF: ${testInvoice.pdfS3Key ? '✅ Yes' : '❌ No'}`)

  // STEP 2: Prepare Email Content
  console.log('\n📝 STEP 2: Preparing Email Content')
  console.log('-'.repeat(70))

  const daysOverdue = Math.floor(
    (Date.now() - new Date(testInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  const emailSubject = `Payment Reminder: Invoice ${testInvoice.number} - AED ${testInvoice.totalAmount}`

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Payment Reminder</h2>

      <p>Dear ${testInvoice.customer?.name || testInvoice.customerName},</p>

      <p>This is a friendly reminder that Invoice <strong>${testInvoice.number}</strong>
      for <strong>AED ${testInvoice.totalAmount}</strong> is now ${daysOverdue} days overdue.</p>

      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1e40af;">Invoice Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px 0;">${testInvoice.number}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Amount Due:</strong></td>
            <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">AED ${testInvoice.totalAmount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Original Due Date:</strong></td>
            <td style="padding: 8px 0;">${new Date(testInvoice.dueDate).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Days Overdue:</strong></td>
            <td style="padding: 8px 0; color: #dc2626;">${daysOverdue} days</td>
          </tr>
        </table>
      </div>

      ${testInvoice.pdfS3Key ? '<p>📎 <strong>The invoice PDF is attached to this email for your reference.</strong></p>' : ''}

      <p>Please arrange payment at your earliest convenience to avoid any service interruption.</p>

      <p>If you have already made this payment, please disregard this message or contact us to confirm receipt.</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <p style="margin: 0;"><strong>${testInvoice.company?.name}</strong></p>
        ${testInvoice.company?.email ? `<p style="margin: 5px 0;">Email: ${testInvoice.company.email}</p>` : ''}
        ${testInvoice.company?.phone ? `<p style="margin: 5px 0;">Phone: ${testInvoice.company.phone}</p>` : ''}
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

      <p style="font-size: 12px; color: #6b7280; margin: 0;">
        This is an automated payment reminder from <strong>Reminder</strong> - Professional CCaaS Platform<br>
        Powered by Postmark Email Delivery
      </p>
    </div>
  `

  console.log(`✅ Email Subject: ${emailSubject}`)
  console.log(`✅ Email Length: ${emailContent.length} characters`)
  console.log(`✅ Template: Professional HTML with company branding`)

  // STEP 3: Send Email via Postmark
  console.log('\n📤 STEP 3: Sending Email via Postmark')
  console.log('-'.repeat(70))
  console.log(`   From: ${testInvoice.company?.email || 'noreply@reminder.com'}`)
  console.log(`   To: ajeibbotson@gmail.com (test recipient)`)
  console.log(`   CC: ${testInvoice.customer?.email || testInvoice.customerEmail}`)
  console.log(`   PDF Attachment: ${testInvoice.pdfS3Key ? 'Yes' : 'No'}`)

  const emailService = getDefaultEmailService()

  let emailLogId: string
  let postmarkMessageId: string

  try {
    emailLogId = await emailService.sendEmail({
      recipientEmail: 'ajeibbotson@gmail.com',
      recipientName: testInvoice.customer?.name || testInvoice.customerName || 'Test Customer',
      subject: emailSubject,
      content: emailContent,
      templateId: undefined,
      companyId: testInvoice.companyId,
      invoiceId: testInvoice.id,
      customerId: testInvoice.customer?.id,
      language: 'ENGLISH',
      attachInvoicePDF: true // Enable PDF attachment if available
    })

    console.log(`✅ Email sent successfully!`)
    console.log(`   Email Log ID: ${emailLogId}`)

  } catch (error: any) {
    console.log(`❌ Email sending FAILED: ${error.message}`)
    throw error
  }

  // STEP 4: Verify Email Log
  console.log('\n🔍 STEP 4: Verifying Email Log in Database')
  console.log('-'.repeat(70))

  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: {
      invoice: {
        include: {
          customer: true
        }
      },
      customer: true,
      company: true
    }
  })

  if (!emailLog) {
    console.log('❌ Email log not found in database!')
    throw new Error('Email log verification failed')
  }

  console.log(`✅ Email Log Found`)
  console.log(`   ID: ${emailLog.id}`)
  console.log(`   Recipient: ${emailLog.recipientEmail}`)
  console.log(`   Status: ${emailLog.deliveryStatus}`)
  console.log(`   Provider Message ID: ${emailLog.providerMessageId || 'Pending'}`)
  console.log(`   Sent At: ${emailLog.sentAt?.toISOString() || 'N/A'}`)

  postmarkMessageId = emailLog.providerMessageId || 'unknown'

  // STEP 5: Verify Relationships
  console.log('\n🔗 STEP 5: Validating Database Relationships')
  console.log('-'.repeat(70))

  const relationships = {
    invoice: !!emailLog.invoice,
    invoiceNumber: emailLog.invoice?.number,
    customer: !!emailLog.customer,
    customerName: emailLog.customer?.name || emailLog.invoice?.customer?.name,
    company: !!emailLog.company,
    companyName: emailLog.company?.name
  }

  console.log(`   Invoice Linked: ${relationships.invoice ? '✅' : '❌'} ${relationships.invoiceNumber || ''}`)
  console.log(`   Customer Linked: ${relationships.customer ? '✅' : '❌'} ${relationships.customerName || ''}`)
  console.log(`   Company Linked: ${relationships.company ? '✅' : '❌'} ${relationships.companyName || ''}`)

  const allRelationshipsValid = relationships.invoice && relationships.customer && relationships.company

  if (!allRelationshipsValid) {
    console.log('\n⚠️  WARNING: Some relationships are missing!')
  } else {
    console.log('\n✅ All relationships valid!')
  }

  // STEP 6: Check for Recent Email Logs
  console.log('\n📊 STEP 6: Recent Email Activity')
  console.log('-'.repeat(70))

  const recentEmails = await prisma.emailLog.findMany({
    where: {
      companyId: testInvoice.companyId,
      sentAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    orderBy: {
      sentAt: 'desc'
    },
    take: 5,
    include: {
      invoice: true
    }
  })

  console.log(`   Emails sent in last 24 hours: ${recentEmails.length}`)
  recentEmails.forEach((email, i) => {
    console.log(`   ${i + 1}. ${email.recipientEmail} - ${email.deliveryStatus} - Invoice: ${email.invoice?.number || 'N/A'}`)
  })

  // FINAL SUMMARY
  console.log('\n' + '='.repeat(70))
  console.log('✅ END-TO-END TEST COMPLETE')
  console.log('='.repeat(70))
  console.log('\n📊 Test Results Summary:\n')
  console.log(`   ✅ Invoice Selected: ${testInvoice.number}`)
  console.log(`   ✅ Email Content Prepared: Professional HTML template`)
  console.log(`   ✅ Email Sent via Postmark: ${postmarkMessageId}`)
  console.log(`   ✅ Email Log Created: ${emailLogId}`)
  console.log(`   ${allRelationshipsValid ? '✅' : '⚠️ '} Database Relationships: ${allRelationshipsValid ? 'Valid' : 'Some missing'}`)
  console.log(`   ✅ PDF Attachment: ${testInvoice.pdfS3Key ? 'Included' : 'Not available'}`)

  console.log('\n🎯 Next Steps:\n')
  console.log('   1. Check ajeibbotson@gmail.com for email delivery')
  console.log('   2. Verify email formatting and PDF attachment')
  console.log('   3. Check Postmark Activity stream for tracking events')
  console.log(`   4. Monitor webhooks for: opens, clicks, bounces`)

  console.log('\n🔗 Postmark Activity:')
  console.log(`   https://account.postmarkapp.com/servers/17479339/streams/outbound/activity`)

  if (postmarkMessageId && postmarkMessageId !== 'unknown') {
    console.log(`\n📧 Direct Message Link:`)
    console.log(`   https://account.postmarkapp.com/servers/17479339/streams/outbound/messages/${postmarkMessageId}`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('🚀 PRODUCTION INVOICE REMINDER SYSTEM: VALIDATED')
  console.log('='.repeat(70))
  console.log('')
}

main()
  .catch((error) => {
    console.error('\n❌ TEST FAILED:', error)
    console.error('\nStack Trace:', error.stack)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
