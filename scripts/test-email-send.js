/**
 * Test Script: AWS SES Email Send
 * Tests the email service with a sample invoice reminder
 */

require('dotenv').config()

// Import the email service (we'll use dynamic import since it's TypeScript)
async function testEmailSend() {
  console.log('🧪 Testing AWS SES Email Send\n')
  console.log('📋 Configuration:')
  console.log(`   AWS Region: ${process.env.AWS_REGION}`)
  console.log(`   FROM Email: ${process.env.AWS_SES_FROM_EMAIL}`)
  console.log(`   AWS Key ID: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`)
  console.log('')

  // For this test, we'll construct the AWS SES call directly
  const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

  const sesClient = new SESClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })

  // Ask for recipient email
  const recipientEmail = process.argv[2] || 'YOUR_EMAIL@example.com'

  if (recipientEmail === 'YOUR_EMAIL@example.com') {
    console.log('❌ Please provide your email address as an argument:')
    console.log('   node scripts/test-email-send.js your.email@example.com')
    console.log('')
    process.exit(1)
  }

  console.log(`📧 Sending test email to: ${recipientEmail}\n`)

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #1f2937; margin-top: 0;">
      💰 Payment Reminder - Test Email
    </h2>
  </div>

  <p>Dear Valued Customer,</p>

  <p>This is a test email from the Reminder platform to verify AWS SES integration.</p>

  <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0;">
    <p style="margin: 8px 0;"><strong>Invoice Number:</strong> TEST-001</p>
    <p style="margin: 8px 0;"><strong>Amount Due:</strong> AED 1,000.00</p>
    <p style="margin: 8px 0;"><strong>Due Date:</strong> October 20, 2025</p>
  </div>

  <p>If you received this email, the AWS SES integration is working perfectly! ✅</p>

  <p>This is a test of the invoice reminder email template that will be used for real payment reminders.</p>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
    <p style="margin: 4px 0;">Best regards,</p>
    <p style="margin: 4px 0;"><strong>Reminder Team</strong></p>
    <p style="margin: 16px 0 4px 0; font-size: 12px;">
      This is a test email sent via AWS SES.
    </p>
  </div>

</body>
</html>
`

  const textContent = `
Payment Reminder - Test Email

Dear Valued Customer,

This is a test email from the Reminder platform to verify AWS SES integration.

Invoice Number: TEST-001
Amount Due: AED 1,000.00
Due Date: October 20, 2025

If you received this email, the AWS SES integration is working perfectly! ✅

This is a test of the invoice reminder email template that will be used for real payment reminders.

Best regards,
Reminder Team

---
This is a test email sent via AWS SES.
`

  try {
    const command = new SendEmailCommand({
      Source: process.env.AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: {
          Data: '💰 Test Invoice Reminder - Reminder Platform',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textContent,
            Charset: 'UTF-8',
          },
        },
      },
    })

    const response = await sesClient.send(command)

    console.log('✅ Email sent successfully!\n')
    console.log(`📧 Message ID: ${response.MessageId}`)
    console.log(`📬 Recipient: ${recipientEmail}`)
    console.log(`📤 From: ${process.env.AWS_SES_FROM_EMAIL}`)
    console.log('')
    console.log('✨ Check your inbox (and spam folder) for the test email!')
    console.log('')
  } catch (error) {
    console.error('❌ Email send failed:\n')
    console.error(error)
    console.log('')

    if (error.message?.includes('Email address is not verified')) {
      console.log('💡 Solution: The recipient email needs to be verified in AWS SES (sandbox mode)')
      console.log('   OR verify your domain (usereminder.com) to send to any email')
      console.log('')
    } else if (error.message?.includes('AccessDenied')) {
      console.log('💡 Solution: Check IAM permissions for ses:SendEmail')
      console.log('')
    }

    process.exit(1)
  }
}

testEmailSend()
