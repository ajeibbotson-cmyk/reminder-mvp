// Direct Postmark test bypassing database
import { ServerClient } from 'postmark'

async function testPostmarkDirect() {
  console.log('🧪 Testing Postmark email sending (direct API)...')
  console.log('📧 API Token:', process.env.POSTMARK_API_TOKEN?.substring(0, 10) + '...')
  console.log('🆔 Server ID:', process.env.POSTMARK_SERVER_ID)

  if (!process.env.POSTMARK_API_TOKEN) {
    console.error('❌ POSTMARK_API_TOKEN not found in environment')
    return
  }

  const client = new ServerClient(process.env.POSTMARK_API_TOKEN)

  try {
    const result = await client.sendEmail({
      From: 'Reminder <hello@usereminder.com>',
      To: 'ajeibbotson@gmail.com',
      Subject: '✅ Postmark Direct API Test - Success!',
      HtmlBody: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #10b981;">✅ Postmark Integration Successful!</h2>
              <p>Congratulations! Your Postmark integration is working perfectly.</p>

              <div style="background-color: #d1fae5; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #10b981;">
                <p style="margin: 0; font-weight: bold;">✅ What's Working:</p>
                <ul style="margin: 10px 0;">
                  <li>Domain verified (usereminder.com)</li>
                  <li>API credentials configured</li>
                  <li>Email sending operational</li>
                  <li>Open tracking enabled</li>
                  <li>Click tracking enabled</li>
                </ul>
              </div>

              <p style="margin-top: 30px;">
                <a href="https://reminder-mvp.vercel.app"
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                  🚀 Visit Reminder Platform
                </a>
              </p>

              <div style="background-color: #fef3c7; padding: 15px; border-radius: 4px; margin: 30px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-weight: bold;">📊 Next Steps:</p>
                <ol style="margin: 10px 0;">
                  <li>Open this email (triggers open tracking)</li>
                  <li>Click the button above (triggers click tracking)</li>
                  <li>Check Postmark Activity stream</li>
                  <li>Verify webhooks are configured</li>
                </ol>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;"/>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                <strong>Reminder</strong> - Invoice Management for UAE Businesses<br/>
                <a href="https://reminder-mvp.vercel.app" style="color: #2563eb;">https://reminder-mvp.vercel.app</a><br/>
                This is a test email from your Postmark integration.
              </p>
            </div>
          </body>
        </html>
      `,
      TextBody: `Postmark Integration Successful!

Congratulations! Your Postmark integration is working perfectly.

What's Working:
- Domain verified (usereminder.com)
- API credentials configured
- Email sending operational
- Open tracking enabled
- Click tracking enabled

Next Steps:
1. Open this email (triggers open tracking)
2. Click the link (triggers click tracking)
3. Check Postmark Activity stream
4. Verify webhooks are configured

Visit: https://reminder-mvp.vercel.app

---
Reminder - Invoice Management for UAE Businesses
https://reminder-mvp.vercel.app`,
      MessageStream: 'outbound',
      TrackOpens: true,
      TrackLinks: 'HtmlAndText',
      Tag: 'test'
    })

    console.log('\n✅ EMAIL SENT SUCCESSFULLY!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧 Message ID:', result.MessageID)
    console.log('📬 Sent to:', result.To)
    console.log('⏰ Submitted at:', result.SubmittedAt)
    console.log('🔍 Error code:', result.ErrorCode || 'None')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('🔍 Next steps:')
    console.log('   1. Check your inbox at: ajeibbotson@gmail.com')
    console.log('   2. Open the email (triggers open tracking)')
    console.log('   3. Click the button (triggers click tracking)')
    console.log('   4. Go to Postmark Activity: https://account.postmarkapp.com/servers/' + process.env.POSTMARK_SERVER_ID + '/streams/outbound/activity')
    console.log('   5. Watch real-time delivery status\n')

    console.log('🎉 POSTMARK INTEGRATION COMPLETE!')

  } catch (error: any) {
    console.error('\n❌ Email send failed!')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    if (error.code) {
      console.error('Error Code:', error.code)

      switch (error.code) {
        case 300:
          console.error('❌ Invalid email request. Check sender signature.')
          break
        case 400:
          console.error('❌ Sender signature not confirmed in Postmark.')
          console.error('   Go to: https://account.postmarkapp.com/signatures')
          break
        case 401:
          console.error('❌ Invalid Postmark API token.')
          console.error('   Check POSTMARK_API_TOKEN in .env file')
          break
        case 422:
          console.error('❌ Invalid recipient email address')
          break
        default:
          console.error('❌ Postmark error:', error.message)
      }
    } else {
      console.error('Error:', error.message || error)
    }

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  }
}

testPostmarkDirect()
