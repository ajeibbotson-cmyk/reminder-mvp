import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { culturalCompliance, CulturalTone } from '@/lib/services/cultural-compliance-service'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'

interface UpdateSequenceRequest {
  name?: string
  description?: string
  steps?: {
    stepNumber: number
    delayDays: number
    templateId?: string
    subject: string
    content: string
    language: 'ENGLISH' | 'ARABIC' | 'BOTH'
    tone: CulturalTone
    stopConditions?: string[]
    metadata?: Record<string, any>
  }[]
  active?: boolean
}

/**
 * GET /api/sequences/[id]
 * Get a specific sequence with detailed analytics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.company.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    // Parse steps
    let steps = []
    try {
      steps = typeof sequence.steps === 'string' 
        ? JSON.parse(sequence.steps) 
        : sequence.steps || []
    } catch {
      steps = []
    }

    // Get detailed analytics
    const analytics = await sequenceExecutionService.getSequenceAnalytics(sequence.id)

    // Get recent executions
    const recentExecutions = await prisma.follow_up_logs.findMany({
      where: { sequenceId: sequence.id },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            customerName: true,
            amount: true,
            totalAmount: true,
            currency: true,
            status: true
          }
        }
      },
      orderBy: { sentAt: 'desc' },
      take: 10
    })

    return NextResponse.json({
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      active: sequence.active,
      steps,
      createdAt: sequence.createdAt,
      updatedAt: sequence.updatedAt,
      analytics: {
        ...analytics,
        recentExecutions: recentExecutions.map(execution => ({
          id: execution.id,
          stepNumber: execution.stepNumber,
          sentAt: execution.sentAt,
          emailOpened: !!execution.emailOpened,
          emailClicked: !!execution.emailClicked,
          responseReceived: !!execution.responseReceived,
          invoice: execution.invoice
        }))
      }
    })

  } catch (error) {
    console.error('Error fetching sequence:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sequence' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/sequences/[id]
 * Update a specific sequence
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const existingSequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.company.id
      }
    })

    if (!existingSequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    const body: UpdateSequenceRequest = await request.json()

    // Validate name uniqueness if changing name
    if (body.name && body.name !== existingSequence.name) {
      const nameExists = await prisma.follow_up_sequences.findFirst({
        where: {
          companyId: user.company.id,
          name: body.name,
          id: { not: params.id }
        }
      })

      if (nameExists) {
        return NextResponse.json(
          { error: 'Sequence name already exists' },
          { status: 400 }
        )
      }
    }

    // Validate and sanitize steps if provided
    let sanitizedSteps = undefined
    const validationErrors: string[] = []

    if (body.steps && Array.isArray(body.steps)) {
      if (body.steps.length === 0) {
        return NextResponse.json(
          { error: 'At least one step is required' },
          { status: 400 }
        )
      }

      sanitizedSteps = body.steps.map((step, index) => {
        const stepErrors: string[] = []

        // Validate step structure
        if (!step.subject || !step.content) {
          stepErrors.push(`Step ${index + 1}: Subject and content are required`)
        }

        if (step.delayDays < 0 || step.delayDays > 365) {
          stepErrors.push(`Step ${index + 1}: Delay days must be between 0 and 365`)
        }

        // Cultural compliance validation
        if (step.subject && step.content) {
          const complianceCheck = culturalCompliance.validateTemplateContent({
            contentEn: step.content,
            subjectEn: step.subject
          })

          if (!complianceCheck.isValid) {
            // Log warnings but don't block update for minor issues
            if (complianceCheck.culturalCompliance < 50) {
              stepErrors.push(`Step ${index + 1}: ${complianceCheck.issues.join(', ')}`)
            }
          }
        }

        validationErrors.push(...stepErrors)

        return {
          stepNumber: step.stepNumber || index + 1,
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
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.name !== undefined) {
      updateData.name = body.name.trim()
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null
    }

    if (sanitizedSteps !== undefined) {
      updateData.steps = JSON.stringify(sanitizedSteps)
    }

    if (body.active !== undefined) {
      updateData.active = body.active
    }

    // Update the sequence
    const updatedSequence = await prisma.follow_up_sequences.update({
      where: { id: params.id },
      data: updateData
    })

    // Log update activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        userId: user.id,
        type: 'SEQUENCE_UPDATED',
        description: `Updated sequence: ${updatedSequence.name}`,
        metadata: {
          sequenceId: updatedSequence.id,
          changes: Object.keys(updateData).filter(key => key !== 'updatedAt')
        }
      }
    })

    return NextResponse.json({
      id: updatedSequence.id,
      name: updatedSequence.name,
      description: updatedSequence.description,
      active: updatedSequence.active,
      updatedAt: updatedSequence.updatedAt,
      message: 'Sequence updated successfully'
    })

  } catch (error) {
    console.error('Error updating sequence:', error)
    return NextResponse.json(
      { error: 'Failed to update sequence' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sequences/[id]
 * Soft delete a sequence (deactivate and mark for deletion)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.company.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    // Check if sequence has active executions
    const activeExecutions = await prisma.follow_up_logs.count({
      where: {
        sequenceId: params.id,
        sentAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    })

    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    if (activeExecutions > 0 && !force) {
      return NextResponse.json({
        error: 'Sequence has active executions',
        message: 'This sequence has recent executions. Use force=true to delete anyway.',
        activeExecutions
      }, { status: 409 })
    }

    // Soft delete - deactivate sequence
    const deletedSequence = await prisma.follow_up_sequences.update({
      where: { id: params.id },
      data: {
        active: false,
        name: `[DELETED] ${sequence.name}`,
        updatedAt: new Date()
      }
    })

    // Stop any running executions for this sequence
    const runningExecutions = await prisma.follow_up_logs.findMany({
      where: { sequenceId: params.id },
      distinct: ['invoiceId']
    })

    for (const execution of runningExecutions) {
      await sequenceExecutionService.stopSequenceExecution(
        params.id,
        execution.invoiceId,
        'Sequence deleted'
      )
    }

    // Log deletion activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        userId: user.id,
        type: 'SEQUENCE_DELETED',
        description: `Deleted sequence: ${sequence.name}`,
        metadata: {
          sequenceId: params.id,
          originalName: sequence.name,
          activeExecutions,
          force
        }
      }
    })

    return NextResponse.json({
      message: 'Sequence deleted successfully',
      stoppedExecutions: runningExecutions.length
    })

  } catch (error) {
    console.error('Error deleting sequence:', error)
    return NextResponse.json(
      { error: 'Failed to delete sequence' },
      { status: 500 }
    )
  }
}