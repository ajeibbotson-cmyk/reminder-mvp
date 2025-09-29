import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createUnifiedEmailService } from '@/lib/services/unifiedEmailService'

// ==========================================
// CAMPAIGN PROGRESS ENDPOINT (Server-Sent Events)
// ==========================================
// GET /api/campaigns/[id]/progress
// Purpose: Real-time campaign progress updates via SSE

// Progress Event Types
interface ProgressEvent {
  type: 'progress' | 'completion' | 'error'
  data: any
  timestamp: string
}

interface ProgressData {
  campaignId: string
  sentCount: number
  failedCount: number
  currentBatch?: number
  totalBatches?: number
  percentComplete: number
  lastEmailTo?: string
  estimatedTimeRemaining?: string
  status: string
}

interface CompletionData {
  campaignId: string
  status: 'completed' | 'failed'
  totalSent: number
  totalFailed: number
  duration: string
  successRate: number
}

// ==========================================
// GET ROUTE HANDLER (SSE Stream)
// ==========================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Session validation
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!session.user.companiesId) {
      return new NextResponse('Company association required', { status: 401 })
    }

    const campaignId = params.id

    // 2. Validate campaign ID
    if (!campaignId || typeof campaignId !== 'string') {
      return new NextResponse('Invalid campaign ID', { status: 400 })
    }

    // 3. Initialize UnifiedEmailService
    const emailService = await createUnifiedEmailService(session)

    // 4. Validate campaign exists and user has access
    try {
      await emailService.getCampaignProgress(campaignId)
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return new NextResponse('Campaign not found', { status: 404 })
      }
      throw error
    }

    // 5. Set up Server-Sent Events headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // 6. Create ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const initEvent = createSSEEvent('connection', {
          campaignId,
          message: 'Connected to campaign progress stream',
          timestamp: new Date().toISOString()
        })
        controller.enqueue(initEvent)

        // Set up progress polling
        const pollInterval = setInterval(async () => {
          try {
            // Get current campaign progress
            const progress = await emailService.getCampaignProgress(campaignId)

            // Create progress event
            const progressData: ProgressData = {
              campaignId: progress.campaignId,
              sentCount: progress.sentCount,
              failedCount: progress.failedCount,
              currentBatch: progress.currentBatch,
              totalBatches: progress.totalBatches,
              percentComplete: progress.percentComplete,
              estimatedTimeRemaining: progress.estimatedTimeRemaining,
              status: progress.status
            }

            const progressEvent = createSSEEvent('progress', progressData)
            controller.enqueue(progressEvent)

            // Check if campaign is completed
            if (progress.status === 'completed' || progress.status === 'failed') {
              // Send completion event
              const completionData: CompletionData = {
                campaignId: progress.campaignId,
                status: progress.status,
                totalSent: progress.sentCount,
                totalFailed: progress.failedCount,
                duration: calculateDuration(progress),
                successRate: progress.totalRecipients > 0
                  ? Math.round((progress.sentCount / progress.totalRecipients) * 100)
                  : 0
              }

              const completionEvent = createSSEEvent('completion', completionData)
              controller.enqueue(completionEvent)

              // Clean up and close stream
              clearInterval(pollInterval)
              controller.close()
            }

          } catch (error) {
            console.error('Progress polling error:', error)

            // Send error event
            const errorEvent = createSSEEvent('error', {
              campaignId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(errorEvent)

            // Clean up on error
            clearInterval(pollInterval)
            controller.close()
          }
        }, 2000) // Poll every 2 seconds

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval)
          controller.close()
        })

        // Auto-cleanup after 30 minutes (safety measure)
        setTimeout(() => {
          clearInterval(pollInterval)
          if (!controller.closed) {
            const timeoutEvent = createSSEEvent('timeout', {
              campaignId,
              message: 'Progress stream timed out after 30 minutes',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(timeoutEvent)
            controller.close()
          }
        }, 30 * 60 * 1000) // 30 minutes
      },

      cancel() {
        // Stream cancelled by client
        console.log(`Progress stream cancelled for campaign ${campaignId}`)
      }
    })

    return new NextResponse(stream, { headers })

  } catch (error) {
    console.error('Campaign progress stream error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      campaignId: params.id,
      userId: (await getServerSession(authOptions))?.user?.id
    })

    return new NextResponse('Internal server error', { status: 500 })
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Create Server-Sent Event formatted string
 */
function createSSEEvent(type: string, data: any): Uint8Array {
  const event: ProgressEvent = {
    type,
    data,
    timestamp: new Date().toISOString()
  }

  const eventString = `event: ${type}\ndata: ${JSON.stringify(event.data)}\nid: ${Date.now()}\n\n`
  return new TextEncoder().encode(eventString)
}

/**
 * Calculate campaign duration
 */
function calculateDuration(progress: any): string {
  // This is a simplified calculation
  // In a real implementation, you'd track start/end times
  const estimatedSeconds = progress.totalRecipients * 0.6 // Rough estimate

  if (estimatedSeconds > 60) {
    return `${Math.round(estimatedSeconds / 60)} minutes`
  } else {
    return `${Math.round(estimatedSeconds)} seconds`
  }
}

// Note: GET function is already exported above