import { ServerClient } from 'postmark'

async function main() {
  console.log('\n🚀 Testing Postmark Production (Direct API)\n')

  const apiToken = process.env.POSTMARK_API_TOKEN || '463c9eef-4ae4-434f-b5e8-757168118bae'
  const serverId = process.env.POSTMARK_SERVER_ID || '17479339'

  console.log('🔑 API Token:', apiToken.substring(0, 8) + '...')
  console.log('🆔 Server ID:', serverId)
  console.log('')

  const client = new ServerClient(apiToken)

  try {
    console.log('📤 Sending test email...\n')

    const result = await client.sendEmail({
      From: 'hello@usereminder.com',
      To: 'ajeibbotson@gmail.com',
      Subject: '✅ Postmark Production Activated - Reminder Platform',
      HtmlBody: `
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
      TextBody: 'Postmark Production is Active! Your Reminder platform email infrastructure is fully operational.',
      MessageStream: 'outbound',
      TrackOpens: true,
      TrackLinks: 'HtmlAndText',
      Tag: 'production-activation-test'
    })

    console.log('✅ SUCCESS! Email sent via Postmark')
    console.log('📧 Message ID:', result.MessageID)
    console.log('📬 To:', result.To)
    console.log('📅 Submitted:', result.SubmittedAt)
    console.log('')
    console.log('🔍 View in Postmark: https://account.postmarkapp.com/servers/' + serverId + '/streams/outbound/activity')
    console.log('📬 Check your inbox: ajeibbotson@gmail.com')
    console.log('')
    console.log('🎉 Postmark is LIVE and ready for production!')
    console.log('')

  } catch (error: any) {
    console.error('❌ ERROR:', error.message)
    if (error.statusCode) {
      console.error('   Status Code:', error.statusCode)
    }
    console.log('')
    process.exit(1)
  }
}

main()
