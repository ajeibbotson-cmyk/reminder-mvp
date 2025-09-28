import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createUnifiedEmailService } from '@/lib/services/unifiedEmailService'

// ==========================================
// CAMPAIGN SEND EXECUTION ENDPOINT
// ==========================================
// POST /api/campaigns/[id]/send
// Purpose: Execute campaign with real-time progress tracking

// Request Schema
const SendCampaignRequestSchema = z.object({
  confirmSend: z.boolean().refine(val => val === true, {
    message: 'confirmSend must be true to execute campaign'
  }),
  finalValidation: z.boolean().optional().default(false)
})

// Response Types
interface SendCampaignResponse {
  success: true
  campaignId: string
  totalEmails: number
  estimatedDuration: string
  progressEndpoint: string
  message: string
}

interface SendCampaignError {
  error: string
  code?: string
  details?: any
  retryable?: boolean
  suggestions?: string[]
}

// ==========================================
// POST ROUTE HANDLER
// ==========================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Session validation
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Valid session required' },
        { status: 401 }
      )
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized - Company association required' },
        { status: 401 }
      )
    }

    const campaignId = params.id

    // 2. Validate campaign ID
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid campaign ID' },
        { status: 400 }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    let validatedData

    try {
      validatedData = SendCampaignRequestSchema.parse(body)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request data',
            details: validationError.errors
          },
          { status: 400 }
        )
      }
      throw validationError
    }

    // 4. Initialize UnifiedEmailService
    const emailService = await createUnifiedEmailService(session)

    // 5. Get campaign progress for validation
    const campaignProgress = await emailService.getCampaignProgress(campaignId)

    // 6. Validate campaign can be sent
    if (campaignProgress.status !== 'draft') {
      const errorResponse: SendCampaignError = {
        error: `Campaign cannot be sent. Current status: ${campaignProgress.status}`,
        code: 'INVALID_CAMPAIGN_STATUS',
        retryable: false,
        suggestions: campaignProgress.status === 'completed'
          ? ['Create a new campaign for additional sends']
          : campaignProgress.status === 'sending'
          ? ['Wait for current campaign to complete']
          : ['Check campaign status and resolve any issues']
      }

      return NextResponse.json(errorResponse, { status: 400 })
    }

    // 7. Check if campaign has recipients
    if (campaignProgress.totalRecipients === 0) {
      const errorResponse: SendCampaignError = {
        error: 'Campaign has no valid recipients',
        code: 'NO_VALID_RECIPIENTS',
        retryable: false,
        suggestions: [
          'Ensure invoices have valid customer email addresses',
          'Check email suppression list',
          'Verify invoice selection includes customers with emails'
        ]
      }

      return NextResponse.json(errorResponse, { status: 400 })
    }

    // 8. Calculate estimated duration
    const batchSize = 5 // Default from UnifiedEmailService
    const totalBatches = Math.ceil(campaignProgress.totalRecipients / batchSize)
    const delayBetweenBatches = 3000 // Default delay
    const estimatedSeconds = (totalBatches * delayBetweenBatches + totalBatches * 2000) / 1000

    const estimatedDuration = estimatedSeconds > 60
      ? `${Math.round(estimatedSeconds / 60)} minutes`
      : `${Math.round(estimatedSeconds)} seconds`

    // 9. Start campaign execution asynchronously
    // Note: We start the campaign but don't wait for completion
    // Progress is tracked via the progress endpoint
    const campaignExecution = emailService.sendCampaign(
      campaignId,
      (progress) => {
        // Progress updates are handled internally and can be accessed via progress endpoint
        console.log(`Campaign ${campaignId} progress: ${progress.percentComplete}%`)
      },
      (result) => {
        // Email result logging
        console.log(`Email sent to ${result.recipientEmail}: ${result.status}`)
      }
    ).catch(error => {
      // Log execution errors but don't fail the response
      console.error(`Campaign ${campaignId} execution failed:`, error)
    })

    // 10. Return immediate success response
    const response: SendCampaignResponse = {
      success: true,
      campaignId,
      totalEmails: campaignProgress.totalRecipients,
      estimatedDuration,
      progressEndpoint: `/api/campaigns/${campaignId}/progress`,
      message: `Campaign started successfully. ${campaignProgress.totalRecipients} emails will be sent in ${totalBatches} batches.`
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Campaign send error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      campaignId: params.id,
      userId: (await getServerSession(authOptions))?.user?.id
    })

    // Determine error type and response
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        const errorResponse: SendCampaignError = {
          error: 'Campaign not found or access denied',
          code: 'CAMPAIGN_NOT_FOUND',
          retryable: false
        }
        return NextResponse.json(errorResponse, { status: 404 })
      }

      if (error.message.includes('DAILY_QUOTA_EXCEEDED')) {
        const errorResponse: SendCampaignError = {
          error: 'Daily email quota exceeded',
          code: 'DAILY_QUOTA_EXCEEDED',
          retryable: true,
          suggestions: [
            'Wait until tomorrow for quota reset',
            'Reduce campaign size',
            'Contact support to increase quota'
          ]
        }
        return NextResponse.json(errorResponse, { status: 429 })
      }

      if (error.message.includes('AWS SES')) {
        const errorResponse: SendCampaignError = {
          error: 'Email service temporarily unavailable',
          code: 'EMAIL_SERVICE_ERROR',
          retryable: true,
          suggestions: [
            'Try again in a few minutes',
            'Contact support if problem persists'
          ]
        }
        return NextResponse.json(errorResponse, { status: 503 })
      }

      // Generic error response
      const errorResponse: SendCampaignError = {
        error: error.message,
        retryable: true
      }
      return NextResponse.json(errorResponse, { status: 500 })
    }

    // Unknown error
    const errorResponse: SendCampaignError = {
      error: 'Internal server error',
      code: 'UNKNOWN_ERROR',
      retryable: true
    }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// Note: POST function is already exported above