import { getDefaultEmailService } from '@/lib/email-service'

async function main() {
  console.log('\n🚀 Testing Postmark Production Setup\n')

  const emailService = getDefaultEmailService()

  console.log('📧 Email Provider:', process.env.EMAIL_PROVIDER || 'postmark')
  console.log('🔑 Postmark API Token:', process.env.POSTMARK_API_TOKEN ? '✅ Set' : '❌ Missing')
  console.log('🆔 Postmark Server ID:', process.env.POSTMARK_SERVER_ID || 'Not set')
  console.log('📨 From Email:', process.env.FROM_EMAIL || 'hello@usereminder.com')
  console.log('')

  // Send test email
  console.log('📤 Sending test email via Postmark...\n')

  try {
    await emailService.sendEmail({
      recipientEmail: 'ajeibbotson@gmail.com',
      recipientName: 'Andrew Ibbotson',
      subject: '✅ Postmark Production Activated - Reminder Platform',
      htmlContent: `
        <h1>🎉 Postmark is Live!</h1>
        <p>Your Reminder platform email infrastructure is now fully operational.</p>

        <h2>What's Working:</h2>
        <ul>
          <li>✅ Production email sending (no restrictions)</li>
          <li>✅ 95%+ deliverability to inbox</li>
          <li>✅ Real-time open/click tracking</li>
          <li>✅ Automated bounce/complaint handling</li>
          <li>✅ Webhook integration active</li>
        </ul>

        <h2>Next Steps:</h2>
        <ul>
          <li>Send invoice reminders from production dashboard</li>
          <li>Monitor deliverability in Postmark Activity stream</li>
          <li>Review webhook data in database</li>
        </ul>

        <p><strong>Platform Ready for December Launch! 🚀</strong></p>

        <hr>
        <p style="color: #666; font-size: 12px;">
          This is a test email from Reminder - CCaaS Platform<br>
          Powered by Postmark
        </p>
      `,
      templateId: null,
      companyId: null,
      language: 'ENGLISH'
    })

    console.log('✅ SUCCESS! Test email sent via Postmark')
    console.log('📬 Check ajeibbotson@gmail.com for confirmation')
    console.log('🔍 View activity: https://account.postmarkapp.com/servers/17479339/streams/outbound/activity')
    console.log('')
  } catch (error: any) {
    console.error('❌ ERROR:', error.message)
    console.log('')
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
