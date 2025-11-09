import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { culturalCompliance, CulturalTone } from '@/lib/services/cultural-compliance-service'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'

interface SequenceStep {
  stepNumber: number
  delayDays: number
  templateId?: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC' | 'BOTH'
  tone: CulturalTone
  stopConditions?: string[]
  metadata?: Record<string, any>
}

interface CreateSequenceRequest {
  name: string
  description?: string
  steps: SequenceStep[]
  triggerConditions?: any[]
  active?: boolean
}

/**
 * GET /api/sequences
 * List all sequences for the company with analytics
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

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const active = searchParams.get('active')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {
      companyId: user.companies.id
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
        const analytics = await sequenceExecutionService.getSequenceAnalytics(sequence.id)
        
        return {
          id: sequence.id,
          name: sequence.name,
          description: sequence.description || '',
          active: sequence.active,
          stepsCount: Array.isArray(sequence.steps) ? sequence.steps.length : 
                     (typeof sequence.steps === 'string' ? JSON.parse(sequence.steps).length : 0),
          createdAt: sequence.createdAt,
          updatedAt: sequence.updatedAt,
          analytics: {
            totalExecutions: analytics.totalExecutions,
            activeExecutions: analytics.activeExecutions,
            conversionRate: analytics.conversionRate,
            averageCompletionTime: analytics.averageCompletionTime
          }
        }
      })
    )

    return NextResponse.json({
      sequences: sequencesWithAnalytics,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching sequences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sequences' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sequences
 * Create a new sequence with validation
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

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body: CreateSequenceRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json(
        { error: 'Name and steps are required' },
        { status: 400 }
      )
    }

    // Validate sequence name uniqueness
    const existingSequence = await prisma.follow_up_sequences.findFirst({
      where: {
        companyId: user.companies.id,
        name: body.name
      }
    })

    if (existingSequence) {
      return NextResponse.json(
        { error: 'Sequence name already exists' },
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

      // Cultural compliance validation
      const complianceCheck = culturalCompliance.validateTemplateContent({
        contentEn: step.content,
        subjectEn: step.subject
      })

      if (!complianceCheck.isValid) {
        stepErrors.push(`Step ${index + 1}: ${complianceCheck.issues.join(', ')}`)
      }

      validationErrors.push(...stepErrors)

      return {
        stepNumber: index + 1,
        delayDays: step.delayDays || 7,
        templateId: step.templateId,
        subject: step.subject?.trim() || '',
        content: step.content?.trim() || '',
        language: step.language || 'ENGLISH',
        tone: step.tone || 'BUSINESS',
        stopConditions: step.stopConditions || [],
        metadata: step.metadata || {}
      }
    })

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
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
        companyId: user.companies.id,
        name: body.name.trim(),
        description: body.description?.trim(),
        steps: JSON.stringify(sanitizedSteps),
        active: body.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Log creation activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companies.id,
        userId: user.id,
        type: 'SEQUENCE_CREATED',
        description: `Created sequence: ${body.name}`,
        metadata: {
          sequenceId: sequence.id,
          stepsCount: sanitizedSteps.length
        }
      }
    })

    return NextResponse.json({
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      active: sequence.active,
      stepsCount: sanitizedSteps.length,
      createdAt: sequence.createdAt,
      message: 'Sequence created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating sequence:', error)
    return NextResponse.json(
      { error: 'Failed to create sequence' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/sequences
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

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await request.json()
    const { sequenceIds, action } = body

    if (!Array.isArray(sequenceIds) || sequenceIds.length === 0) {
      return NextResponse.json(
        { error: 'Sequence IDs are required' },
        { status: 400 }
      )
    }

    if (!['activate', 'deactivate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be activate or deactivate' },
        { status: 400 }
      )
    }

    // Update sequences
    const updateResult = await prisma.follow_up_sequences.updateMany({
      where: {
        id: { in: sequenceIds },
        companyId: user.companies.id
      },
      data: {
        active: action === 'activate',
        updatedAt: new Date()
      }
    })

    // Log bulk action
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companies.id,
        userId: user.id,
        type: 'SEQUENCE_BULK_UPDATE',
        description: `Bulk ${action} on ${updateResult.count} sequences`,
        metadata: {
          sequenceIds,
          action,
          affectedCount: updateResult.count
        }
      }
    })

    return NextResponse.json({
      message: `Successfully ${action}d ${updateResult.count} sequences`,
      affectedCount: updateResult.count
    })

  } catch (error) {
    console.error('Error bulk updating sequences:', error)
    return NextResponse.json(
      { error: 'Failed to update sequences' },
      { status: 500 }
    )
  }
}