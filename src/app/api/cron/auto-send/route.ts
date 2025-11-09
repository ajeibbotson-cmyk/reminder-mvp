import { NextRequest, NextResponse } from 'next/server'
import { processAutoSendJob } from '@/lib/services/bucket-auto-send-service'

/**
 * POST /api/cron/auto-send
 * Cron job endpoint for processing automatic email sends
 *
 * This endpoint should be called hourly by an external cron service (e.g., Vercel Cron, GitHub Actions)
 *
 * Security: Uses API key or Vercel Cron secret for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'development-secret-change-in-production'

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Auto-Send Cron] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Auto-Send Cron] Starting auto-send job...')

    // Process auto-send
    const result = await processAutoSendJob()

    console.log('[Auto-Send Cron] Job completed:', result)

    return NextResponse.json({
      success: result.success,
      message: `Processed ${result.bucketsProcessed} buckets, sent ${result.emailsSent} emails`,
      details: {
        companiesProcessed: result.companiesProcessed,
        bucketsProcessed: result.bucketsProcessed,
        campaignsCreated: result.campaignsCreated,
        emailsSent: result.emailsSent,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('[Auto-Send Cron] Job failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Auto-send job failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/auto-send
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'auto-send cron job',
    message: 'Use POST with Bearer token to trigger auto-send'
  })
}
