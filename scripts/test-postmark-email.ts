import { getDefaultEmailService } from '../src/lib/email-service'

async function testPostmarkEmail() {
  console.log('🧪 Testing Postmark email sending...')
  console.log('📧 Provider:', process.env.EMAIL_PROVIDER)

  const emailService = getDefaultEmailService()

  try {
    const emailLogId = await emailService.sendEmail({
      companyId: 'test-company-id',
      recipientEmail: 'ajeibbotson@gmail.com', // Your verified email
      recipientName: 'Test Recipient',
      subject: '✅ Postmark Test Email - Reminder Platform',
      content: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #2563eb;">✅ Postmark Integration Test</h2>
              <p>This is a test email from the <strong>Reminder</strong> platform using Postmark.</p>
              <p><strong>If you're seeing this, Postmark is working correctly!</strong></p>

              <div style="background-color: #dbeafe; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Test Details:</strong></p>
                <ul style="margin: 10px 0;">
                  <li>Provider: Postmark</li>
                  <li>Domain: usereminder.com</li>
                  <li>Open Tracking: Enabled</li>
                  <li>Click Tracking: Enabled</li>
                </ul>
              </div>

              <p style="margin-top: 30px;">
                <a href="https://reminder-mvp.vercel.app" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                  Visit Reminder Platform
                </a>
              </p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;"/>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Sent from <strong>Reminder</strong> - Invoice Management for UAE Businesses<br/>
                <a href="https://reminder-mvp.vercel.app" style="color: #2563eb;">https://reminder-mvp.vercel.app</a>
              </p>
            </div>
          </body>
        </html>
      `,
      language: 'ENGLISH',
      scheduleForBusinessHours: false
    })

    console.log('✅ Email sent successfully!')
    console.log('📧 Email Log ID:', emailLogId)
    console.log('📬 Check your inbox at: ajeibbotson@gmail.com')
    console.log('')
    console.log('🔍 Next steps:')
    console.log('   1. Check your email inbox')
    console.log('   2. Open the email (triggers open tracking)')
    console.log('   3. Click the link (triggers click tracking)')
    console.log('   4. Check Postmark Activity stream for delivery status')

  } catch (error) {
    console.error('❌ Email send failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
  }
}

testPostmarkEmail()
