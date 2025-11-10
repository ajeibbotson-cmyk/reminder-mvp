/**
 * Test Script: Send Single Test Email via AWS SES
 * Week 1 Deliverable: Verify email service works
 */

import { sendEmail } from '../src/lib/services/email-service'

async function testEmailSend() {
  console.log('🧪 Testing AWS SES Email Send...\n')

  const testEmail = {
    to: process.env.TEST_EMAIL || 'smoke-test@example.com',
    subject: 'Reminder App - Test Email',
    htmlContent: `
      <h1>Test Email from Reminder</h1>
      <p>This is a test email to verify AWS SES configuration.</p>
      <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        This is an automated test email from Reminder platform.
      </p>
    `,
    textContent: `
Test Email from Reminder

This is a test email to verify AWS SES configuration.

Sent at: ${new Date().toISOString()}

---
This is an automated test email from Reminder platform.
    `,
    fromEmail: process.env.AWS_SES_FROM_EMAIL,
    fromName: 'Reminder App'
  }

  console.log(`📧 Sending test email to: ${testEmail.to}`)
  console.log(`📨 From: ${testEmail.fromName} <${testEmail.fromEmail}>`)
  console.log(`📝 Subject: ${testEmail.subject}\n`)

  try {
    const result = await sendEmail(testEmail)

    if (result.success) {
      console.log('✅ Email sent successfully!')
      console.log(`📬 Message ID: ${result.messageId}`)
      if (result.retried) {
        console.log(`🔄 Retries: ${result.attempts} attempts`)
      }
      console.log('\n✨ Week 1 Deliverable: COMPLETE')
      console.log('   "Send 1 test email successfully" ✓')
      return true
    } else {
      console.error('❌ Email send failed')
      console.error(`Error: ${result.error}`)
      if (result.attempts) {
        console.error(`Attempts made: ${result.attempts}`)
      }
      return false
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return false
  }
}

// Run the test
testEmailSend()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
