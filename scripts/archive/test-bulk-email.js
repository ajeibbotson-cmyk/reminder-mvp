/**
 * Bulk Email Test Script
 * Tests email service reliability at scale (10-100 emails)
 */

require('dotenv').config()
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

// Parse command line arguments
const numEmails = parseInt(process.argv[2]) || 10
const recipientEmail = process.argv[3] || 'YOUR_EMAIL@example.com'

if (recipientEmail === 'YOUR_EMAIL@example.com') {
  console.log('❌ Please provide your email address as an argument:')
  console.log('   node scripts/test-bulk-email.js <count> <your.email@example.com>')
  console.log('   Example: node scripts/test-bulk-email.js 10 ajeibbotson@gmail.com')
  console.log('')
  process.exit(1)
}

console.log('🧪 Bulk Email Test - AWS SES Reliability\n')
console.log(`📊 Test Parameters:`)
console.log(`   Emails to send: ${numEmails}`)
console.log(`   Recipient: ${recipientEmail}`)
console.log(`   FROM: ${process.env.AWS_SES_FROM_EMAIL}`)
console.log(`   Region: ${process.env.AWS_REGION}`)
console.log('')

// Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Send single email
async function sendTestEmail(index) {
  const command = new SendEmailCommand({
    Source: process.env.AWS_SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [recipientEmail],
    },
    Message: {
      Subject: {
        Data: `Bulk Test #${index} - Reminder Email Reliability Test`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>Bulk Email Test #${index}</h2>
  <p>This is test email ${index} of ${numEmails} in the bulk reliability test.</p>
  <p><strong>Test Invoice:</strong> INV-${String(index).padStart(3, '0')}</p>
  <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
  <p style="color: #666; font-size: 12px; margin-top: 20px;">
    This is an automated test email from the Reminder platform.
  </p>
</body>
</html>
          `,
          Charset: 'UTF-8',
        },
        Text: {
          Data: `
Bulk Email Test #${index}

This is test email ${index} of ${numEmails} in the bulk reliability test.

Test Invoice: INV-${String(index).padStart(3, '0')}
Timestamp: ${new Date().toISOString()}

---
This is an automated test email from the Reminder platform.
          `,
          Charset: 'UTF-8',
        },
      },
    },
  })

  try {
    const response = await sesClient.send(command)
    return {
      success: true,
      messageId: response.MessageId,
      index,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      index,
    }
  }
}

// Main test function
async function runBulkTest() {
  console.log(`🚀 Starting bulk send (${numEmails} emails)...\n`)

  const results = {
    sent: 0,
    failed: 0,
    errors: [],
  }

  const startTime = Date.now()

  // Send emails with rate limiting (AWS SES free tier: 1 email/second)
  for (let i = 1; i <= numEmails; i++) {
    process.stdout.write(`📧 Sending email ${i}/${numEmails}...`)

    const result = await sendTestEmail(i)

    if (result.success) {
      results.sent++
      process.stdout.write(` ✅\n`)
    } else {
      results.failed++
      results.errors.push({ index: i, error: result.error })
      process.stdout.write(` ❌ ${result.error}\n`)
    }

    // Rate limiting: 1 email per second (AWS SES free tier limit)
    if (i < numEmails) {
      await delay(1000)
    }
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(1)

  // Print results
  console.log('\n' + '='.repeat(60))
  console.log('📊 Bulk Email Test Results')
  console.log('='.repeat(60))
  console.log(`✅ Sent successfully: ${results.sent}/${numEmails} (${((results.sent / numEmails) * 100).toFixed(1)}%)`)
  console.log(`❌ Failed: ${results.failed}/${numEmails}`)
  console.log(`⏱️  Duration: ${duration} seconds`)
  console.log(`📈 Rate: ${(numEmails / (duration / 60)).toFixed(1)} emails/minute`)
  console.log('')

  if (results.failed > 0) {
    console.log('❌ Failed Emails:')
    results.errors.forEach(err => {
      console.log(`   #${err.index}: ${err.error}`)
    })
    console.log('')
  }

  // Success criteria
  const deliveryRate = (results.sent / numEmails) * 100

  if (deliveryRate >= 99) {
    console.log('✅ SUCCESS: 99%+ delivery rate achieved!')
    console.log('✅ Email system is production-ready for reliability.')
  } else if (deliveryRate >= 95) {
    console.log('⚠️  WARNING: 95-99% delivery rate')
    console.log('💡 Consider investigating failed sends before production.')
  } else {
    console.log('❌ FAILED: <95% delivery rate')
    console.log('💡 Email system needs fixes before production.')
  }

  console.log('')
  console.log(`💡 Check ${recipientEmail} inbox for ${results.sent} test emails`)
  console.log('')
}

runBulkTest().catch(error => {
  console.error('❌ Bulk test failed:', error)
  process.exit(1)
})
