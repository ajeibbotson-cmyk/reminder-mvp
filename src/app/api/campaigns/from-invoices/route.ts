import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createUnifiedEmailService } from '@/lib/services/unifiedEmailService'

// ==========================================
// CREATE CAMPAIGN FROM INVOICES ENDPOINT
// ==========================================
// POST /api/campaigns/from-invoices
// Purpose: Create email campaign from selected invoices (AWS SES MVP)

// Request Schema Validation
const CreateCampaignRequestSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(100),
  campaignName: z.string().min(1).max(100),
  emailSubject: z.string().min(1).max(200),
  emailContent: z.string().min(10),
  language: z.enum(['ENGLISH', 'ARABIC']).default('ENGLISH'),
  templateId: z.string().uuid().optional(),

  // Sending configuration (simplified for AWS SES)
  sendingOptions: z.object({
    scheduleFor: z.string().datetime().optional(), // ISO string for scheduled sending
    respectBusinessHours: z.boolean().default(true),
    batchSize: z.number().min(1).max(50).default(5),
    delayBetweenBatches: z.number().min(1000).default(3000)
  }).optional().default({}),

  // Personalization options
  personalization: z.object({
    enableMergeTags: z.boolean().default(true),
    customFields: z.record(z.any()).optional(),
    fallbackContent: z.string().optional()
  }).optional().default({})
})

type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>

// Response Types
interface CreateCampaignResponse {
  campaign: {
    id: string
    name: string
    status: 'draft'
    totalRecipients: number
    estimatedDuration: string

    validationSummary: {
      validEmails: number
      invalidEmails: number
      suppressedEmails: number
      duplicateEmails: number
      issues: Array<{
        type: string
        invoiceId: string
        email: string
        message: string
      }>
    }

    previewData: {
      sampleEmail: {
        to: string
        subject: string
        content: string
        mergeTagsUsed: string[]
      }
      mergeTags: {
        available: string[]
        used: string[]
        missing: string[]
      }
    }
  }

  readyToSend: boolean
  requiredActions?: string[]
}

// ==========================================
// MAIN ROUTE HANDLER
// ==========================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Session validation
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Valid session required' },
        { status: 401 }
      )
    }

    if (!session.user.companiesId) {
      return NextResponse.json(
        { error: 'Unauthorized - Company association required' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    let validatedData: CreateCampaignRequest

    try {
      validatedData = CreateCampaignRequestSchema.parse(body)
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

    // 3. Initialize UnifiedEmailService
    const emailService = await createUnifiedEmailService(session)

    // 4. Convert schedule string to Date if provided
    const campaignOptions = {
      ...validatedData,
      sendingOptions: {
        ...validatedData.sendingOptions,
        scheduleFor: validatedData.sendingOptions?.scheduleFor
          ? new Date(validatedData.sendingOptions.scheduleFor)
          : undefined
      }
    }

    // 5. Create campaign from invoices
    const result = await emailService.createCampaignFromInvoices(
      validatedData.invoiceIds,
      campaignOptions
    )

    // 6. Calculate estimated duration
    const totalBatches = Math.ceil(result.validation.validEmails / (validatedData.sendingOptions?.batchSize || 5))
    const delayBetweenBatches = validatedData.sendingOptions?.delayBetweenBatches || 3000
    const estimatedSeconds = (totalBatches * delayBetweenBatches + totalBatches * 2000) / 1000 // Add 2s per batch processing
    const estimatedDuration = estimatedSeconds > 60
      ? `Approximately ${Math.round(estimatedSeconds / 60)} minutes`
      : `Approximately ${Math.round(estimatedSeconds)} seconds`

    // 7. Generate preview data
    const previewData = await generateCampaignPreview(
      result.campaign,
      validatedData.emailSubject,
      validatedData.emailContent
    )

    // 8. Determine required actions
    const requiredActions: string[] = []
    if (result.validation.invalidEmails > 0) {
      requiredActions.push(`Fix ${result.validation.invalidEmails} invalid email addresses`)
    }
    if (result.validation.suppressedEmails > 0) {
      requiredActions.push(`Remove ${result.validation.suppressedEmails} suppressed email addresses`)
    }
    if (result.validation.duplicateEmails > 0) {
      requiredActions.push(`Resolve ${result.validation.duplicateEmails} duplicate email addresses`)
    }

    // 9. Build response
    const response: CreateCampaignResponse = {
      campaign: {
        id: result.campaign.id,
        name: result.campaign.name,
        status: 'draft',
        totalRecipients: result.validation.validEmails,
        estimatedDuration,
        validationSummary: {
          validEmails: result.validation.validEmails,
          invalidEmails: result.validation.invalidEmails,
          suppressedEmails: result.validation.suppressedEmails,
          duplicateEmails: result.validation.duplicateEmails,
          issues: result.validation.issues
        },
        previewData
      },
      readyToSend: result.readyToSend,
      requiredActions: requiredActions.length > 0 ? requiredActions : undefined
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Campaign creation error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      userId: (await getServerSession(authOptions))?.user?.id
    })

    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'One or more invoices not found or access denied' },
          { status: 404 }
        )
      }

      if (error.message.includes('Invalid merge tags')) {
        return NextResponse.json(
          {
            error: 'Invalid merge tags in email template',
            details: error.message
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate campaign preview with sample email and merge tag analysis
 */
async function generateCampaignPreview(
  campaign: any,
  emailSubject: string,
  emailContent: string
): Promise<CreateCampaignResponse['campaign']['previewData']> {
  // Get first campaign send for preview
  const sampleSend = campaign.campaign_email_sends?.[0]

  if (!sampleSend) {
    throw new Error('No valid recipients found for preview generation')
  }

  // Extract merge tags from template
  const subjectMergeTags = extractMergeTags(emailSubject)
  const contentMergeTags = extractMergeTags(emailContent)
  const allUsedTags = [...new Set([...subjectMergeTags, ...contentMergeTags])]

  // Available merge tags
  const availableTags = [
    'invoiceNumber',
    'customerName',
    'amount',
    'dueDate',
    'daysPastDue',
    'companyName',
    'customerEmail'
  ]

  // Find missing tags
  const missingTags = allUsedTags.filter(tag => !availableTags.includes(tag))

  return {
    sampleEmail: {
      to: sampleSend.recipient_email,
      subject: sampleSend.email_subject, // Already has merge tags resolved
      content: sampleSend.email_content.substring(0, 200) + '...', // Truncated preview
      mergeTagsUsed: allUsedTags
    },
    mergeTags: {
      available: availableTags,
      used: allUsedTags,
      missing: missingTags
    }
  }
}

/**
 * Extract merge tags from template string
 */
function extractMergeTags(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || []
  return matches.map(match => match.replace(/[{}]/g, ''))
}

// Note: POST function is already exported above