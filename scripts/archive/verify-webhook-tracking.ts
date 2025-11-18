import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('\n🔍 Verifying Postmark Webhook Tracking\n')
  console.log('='.repeat(50))

  const emailLogId = '6d2c9360-d9f9-44d7-ab2a-38f40339ae6e' // From the test we just ran

  // Check the email log
  console.log('\n📧 Checking Email Log...')

  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: {
      invoice: true,
      customer: true
    }
  })

  if (!emailLog) {
    console.log('❌ Email log not found!')
    return
  }

  console.log(`  ✅ Email Log found`)
  console.log(`  📨 Recipient: ${emailLog.recipientEmail}`)
  console.log(`  📝 Status: ${emailLog.deliveryStatus}`)
  console.log(`  🆔 Message ID: ${emailLog.awsMessageId}`)
  console.log(`  📅 Sent: ${emailLog.sentAt}`)
  console.log(`  📅 Delivered: ${emailLog.deliveredAt}`)
  console.log(`  👁️  Opened: ${emailLog.openedAt || 'Not yet'}`)
  console.log('')

  // Check for open tracking
  console.log('👁️  Checking Email Open Tracking...')

  const opens = await prisma.emailOpenTracking.findMany({
    where: { emailLogId: emailLogId }
  })

  if (opens.length > 0) {
    console.log(`  ✅ Found ${opens.length} open event(s)`)
    for (const open of opens) {
      console.log(`  📅 Opened at: ${open.openedAt}`)
      console.log(`  📍 Location: ${open.location || 'Unknown'}`)
      console.log(`  🖥️  User Agent: ${open.userAgent?.substring(0, 50) || 'Unknown'}...`)
      console.log('')
    }
  } else {
    console.log(`  ⏳ No open events yet (email may not have been opened)`)
    console.log(`  💡 Tip: Open the email at ajeibbotson@gmail.com to trigger tracking`)
    console.log('')
  }

  // Check for click tracking
  console.log('🖱️  Checking Email Click Tracking...')

  const clicks = await prisma.emailClickTracking.findMany({
    where: { emailLogId: emailLogId }
  })

  if (clicks.length > 0) {
    console.log(`  ✅ Found ${clicks.length} click event(s)`)
    for (const click of clicks) {
      console.log(`  🔗 URL: ${click.url}`)
      console.log(`  📅 Clicked at: ${click.clickedAt}`)
      console.log('')
    }
  } else {
    console.log(`  ⏳ No click events yet`)
    console.log('')
  }

  // Check for bounce tracking
  console.log('⚠️  Checking Email Bounce Tracking...')

  const bounces = await prisma.emailBounceTracking.findMany({
    where: { emailLogId: emailLogId }
  })

  if (bounces.length > 0) {
    console.log(`  ⚠️  Found ${bounces.length} bounce event(s)`)
    for (const bounce of bounces) {
      console.log(`  Type: ${bounce.bounceType}`)
      console.log(`  Subtype: ${bounce.bounceSubtype || 'N/A'}`)
      console.log('')
    }
  } else {
    console.log(`  ✅ No bounces (good!)`)
    console.log('')
  }

  // Summary
  console.log('='.repeat(50))
  console.log('📊 Webhook Tracking Summary')
  console.log('='.repeat(50))
  console.log(`  Email Status: ${emailLog.deliveryStatus}`)
  console.log(`  Opens: ${opens.length}`)
  console.log(`  Clicks: ${clicks.length}`)
  console.log(`  Bounces: ${bounces.length}`)
  console.log('')

  if (opens.length > 0) {
    console.log('✅ Webhook tracking is WORKING!')
    console.log('   Postmark successfully sent open event to webhook')
    console.log('')
  } else {
    console.log('⏳ Webhook tracking setup complete, waiting for events')
    console.log('   Action: Open the email to trigger tracking')
    console.log('')
  }

  console.log('🔗 View in Postmark: https://account.postmarkapp.com/servers/17479339/streams/outbound/activity')
  console.log('🔗 Webhook logs: Check Vercel deployment logs for webhook calls')
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
