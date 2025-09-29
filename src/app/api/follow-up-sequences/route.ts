import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'
import { culturalCompliance } from '@/lib/services/cultural-compliance-service'

interface FollowUpStep {
  stepNumber: number
  delayDays: number
  templateId?: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC' | 'BOTH'
  stopConditions?: string[]
  escalationLevel: 'GENTLE' | 'REMINDER' | 'URGENT' | 'FINAL'
}

interface CreateFollowUpSequenceRequest {
  name: string
  description?: string
  triggerAfterDays: number
  steps: FollowUpStep[]
  active?: boolean
  uaeBusinessHoursOnly?: boolean
  respectHolidays?: boolean
  respectPrayerTimes?: boolean
}

interface UpdateFollowUpSequenceRequest {
  name?: string
  description?: string
  triggerAfterDays?: number
  steps?: FollowUpStep[]
  active?: boolean
  uaeBusinessHoursOnly?: boolean
  respectHolidays?: boolean
  respectPrayerTimes?: boolean
}

/**
 * GET /api/follow-up-sequences
 * List all follow-up sequences for the company with analytics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const active = searchParams.get('active')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {
      companyId: user.company.id
    }

    if (active !== null) {
      where.active = active === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get sequences with pagination
    const [sequences, totalCount] = await Promise.all([
      prisma.follow_up_sequences.findMany({
        where,
        include: {
          _count: {
            select: {
              followUpLogs: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.follow_up_sequences.count({ where })
    ])

    // Get analytics for each sequence
    const sequencesWithAnalytics = await Promise.all(
      sequences.map(async (sequence) => {
        const [totalLogs, successful, pending, failed] = await Promise.all([
          prisma.follow_up_logs.count({
            where: { sequenceId: sequence.id }
          }),
          prisma.follow_up_logs.count({
            where: {
              sequenceId: sequence.id,
              deliveryStatus: { in: ['DELIVERED', 'OPENED', 'CLICKED'] }
            }
          }),
          prisma.follow_up_logs.count({
            where: {
              sequenceId: sequence.id,
              deliveryStatus: { in: ['QUEUED', 'SENT'] }
            }
          }),
          prisma.follow_up_logs.count({
            where: {
              sequenceId: sequence.id,
              deliveryStatus: { in: ['FAILED', 'BOUNCED'] }
            }
          })
        ])

        // Parse steps from JSON
        let steps: FollowUpStep[] = []
        try {
          steps = typeof sequence.steps === 'string'
            ? JSON.parse(sequence.steps)
            : sequence.steps as any
        } catch (error) {
          console.warn(`Failed to parse steps for sequence ${sequence.id}:`, error)
        }

        return {
          id: sequence.id,
          name: sequence.name,
          description: sequence.description || '',
          triggerAfterDays: 7, // Default, would need to be stored in DB
          active: sequence.active,
          stepsCount: steps.length,
          createdAt: sequence.createdAt,
          updatedAt: sequence.updatedAt,
          analytics: {
            totalExecutions: totalLogs,
            successful,
            pending,
            failed,
            successRate: totalLogs > 0 ? (successful / totalLogs) * 100 : 0
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: sequencesWithAnalytics,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching follow-up sequences:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch follow-up sequences'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/follow-up-sequences
 * Create a new follow-up sequence with UAE business compliance validation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body: CreateFollowUpSequenceRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name and steps are required'
        },
        { status: 400 }
      )
    }

    if (body.triggerAfterDays < 1 || body.triggerAfterDays > 365) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trigger after days must be between 1 and 365'
        },
        { status: 400 }
      )
    }

    // Validate sequence name uniqueness
    const existingSequence = await prisma.follow_up_sequences.findFirst({
      where: {
        companyId: user.company.id,
        name: body.name
      }
    })

    if (existingSequence) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sequence name already exists'
        },
        { status: 400 }
      )
    }

    // Validate and sanitize steps
    const validationErrors: string[] = []
    const sanitizedSteps = body.steps.map((step, index) => {
      const stepErrors: string[] = []

      // Validate step structure
      if (!step.subject || !step.content) {
        stepErrors.push(`Step ${index + 1}: Subject and content are required`)
      }

      if (step.delayDays < 0 || step.delayDays > 365) {
        stepErrors.push(`Step ${index + 1}: Delay days must be between 0 and 365`)
      }

      // Cultural compliance validation for UAE businesses
      const complianceCheck = culturalCompliance.validateTemplateContent({
        contentEn: step.content,
        subjectEn: step.subject
      })

      if (!complianceCheck.isValid) {
        stepErrors.push(`Step ${index + 1}: ${complianceCheck.issues.join(', ')}`)
      }

      // Validate escalation levels are in ascending order
      const escalationOrder = ['GENTLE', 'REMINDER', 'URGENT', 'FINAL']
      if (index > 0) {
        const prevStep = body.steps[index - 1]
        const currentIndex = escalationOrder.indexOf(step.escalationLevel)
        const prevIndex = escalationOrder.indexOf(prevStep.escalationLevel)

        if (currentIndex < prevIndex) {
          stepErrors.push(`Step ${index + 1}: Escalation level should increase or stay same`)
        }
      }

      validationErrors.push(...stepErrors)

      return {
        stepNumber: index + 1,
        delayDays: step.delayDays || 7,
        templateId: step.templateId,
        subject: step.subject?.trim() || '',
        content: step.content?.trim() || '',
        language: step.language || 'ENGLISH',
        stopConditions: step.stopConditions || [],
        escalationLevel: step.escalationLevel || 'GENTLE'
      }
    })

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationErrors
        },
        { status: 400 }
      )
    }

    // Create the sequence
    const sequence = await prisma.follow_up_sequences.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        name: body.name.trim(),
        description: body.description?.trim(),
        steps: JSON.stringify(sanitizedSteps),
        active: body.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Log creation activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        userId: user.id,
        type: 'FOLLOW_UP_SEQUENCE_CREATED',
        description: `Created follow-up sequence: ${body.name}`,
        metadata: {
          sequenceId: sequence.id,
          stepsCount: sanitizedSteps.length,
          triggerAfterDays: body.triggerAfterDays,
          uaeBusinessHoursOnly: body.uaeBusinessHoursOnly ?? true,
          respectHolidays: body.respectHolidays ?? true,
          respectPrayerTimes: body.respectPrayerTimes ?? true
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: sequence.id,
        name: sequence.name,
        description: sequence.description,
        active: sequence.active,
        stepsCount: sanitizedSteps.length,
        createdAt: sequence.createdAt
      },
      message: 'Follow-up sequence created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating follow-up sequence:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create follow-up sequence'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/follow-up-sequences
 * Bulk update sequences (activate/deactivate)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await request.json()
    const { sequenceIds, action } = body

    if (!Array.isArray(sequenceIds) || sequenceIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sequence IDs are required'
        },
        { status: 400 }
      )
    }

    if (!['activate', 'deactivate'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be activate or deactivate'
        },
        { status: 400 }
      )
    }

    // Verify all sequences belong to the company
    const existingSequences = await prisma.follow_up_sequences.findMany({
      where: {
        id: { in: sequenceIds },
        companyId: user.company.id
      },
      select: { id: true, name: true }
    })

    if (existingSequences.length !== sequenceIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some sequences not found or unauthorized'
        },
        { status: 404 }
      )
    }

    // Update sequences
    const updateResult = await prisma.follow_up_sequences.updateMany({
      where: {
        id: { in: sequenceIds },
        companyId: user.company.id
      },
      data: {
        active: action === 'activate',
        updatedAt: new Date()
      }
    })

    // Log bulk action
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        userId: user.id,
        type: 'FOLLOW_UP_SEQUENCE_BULK_UPDATE',
        description: `Bulk ${action} on ${updateResult.count} follow-up sequences`,
        metadata: {
          sequenceIds,
          action,
          affectedCount: updateResult.count,
          sequenceNames: existingSequences.map(s => s.name)
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `Successfully ${action}d ${updateResult.count} sequences`,
        affectedCount: updateResult.count,
        affectedSequences: existingSequences.map(s => ({ id: s.id, name: s.name }))
      }
    })

  } catch (error) {
    console.error('Error bulk updating follow-up sequences:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update sequences'
      },
      { status: 500 }
    )
  }
}