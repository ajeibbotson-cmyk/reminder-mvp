import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
 * GET /api/follow-up-sequences/[id]
 * Get a specific follow-up sequence with detailed analytics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: (await params).id,
        companyId: user.companies.id
      },
      include: {
        _count: {
          select: {
            followUpLogs: true
          }
        }
      }
    })

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          error: 'Follow-up sequence not found'
        },
        { status: 404 }
      )
    }

    // Parse steps from JSON
    let steps: FollowUpStep[] = []
    try {
      steps = typeof sequence.steps === 'string'
        ? JSON.parse(sequence.steps)
        : sequence.steps as any
    } catch (error) {
      console.warn(`Failed to parse steps for sequence ${sequence.id}:`, error)
      steps = []
    }

    // Get detailed analytics
    const [
      totalLogs,
      successful,
      pending,
      failed,
      stepAnalytics,
      recentLogs
    ] = await Promise.all([
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
      }),
      // Step-by-step analytics
      prisma.follow_up_logs.groupBy({
        by: ['stepNumber'],
        where: { sequenceId: sequence.id },
        _count: { id: true },
        orderBy: { stepNumber: 'asc' }
      }),
      // Recent execution logs
      prisma.follow_up_logs.findMany({
        where: { sequenceId: sequence.id },
        include: {
          invoice: {
            select: {
              number: true,
              customerName: true,
              amount: true,
              currency: true,
              status: true
            }
          }
        },
        orderBy: { sentAt: 'desc' },
        take: 10
      })
    ])

    const stepStats = stepAnalytics.reduce((acc, stat) => {
      acc[stat.stepNumber] = stat._count.id
      return acc
    }, {} as Record<number, number>)

    return NextResponse.json({
      success: true,
      data: {
        id: sequence.id,
        name: sequence.name,
        description: sequence.description || '',
        active: sequence.active,
        steps: steps,
        stepsCount: steps.length,
        createdAt: sequence.createdAt,
        updatedAt: sequence.updatedAt,
        analytics: {
          totalExecutions: totalLogs,
          successful,
          pending,
          failed,
          successRate: totalLogs > 0 ? (successful / totalLogs) * 100 : 0,
          stepPerformance: steps.map((step, index) => ({
            stepNumber: step.stepNumber,
            escalationLevel: step.escalationLevel,
            delayDays: step.delayDays,
            executions: stepStats[step.stepNumber] || 0,
            subject: step.subject,
            language: step.language
          })),
          recentExecutions: recentLogs.map(log => ({
            id: log.id,
            stepNumber: log.stepNumber,
            emailAddress: log.emailAddress,
            subject: log.subject,
            sentAt: log.sentAt,
            deliveryStatus: log.deliveryStatus,
            emailOpened: log.emailOpened,
            emailClicked: log.emailClicked,
            invoice: log.invoice ? {
              number: log.invoice.number,
              customerName: log.invoice.customerName,
              amount: log.invoice.amount,
              currency: log.invoice.currency,
              status: log.invoice.status
            } : null
          }))
        }
      }
    })

  } catch (error) {
    console.error('Error fetching follow-up sequence:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch follow-up sequence'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/follow-up-sequences/[id]
 * Update a specific follow-up sequence
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: (await params).id,
        companyId: user.companies.id
      }
    })

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          error: 'Follow-up sequence not found'
        },
        { status: 404 }
      )
    }

    const body: UpdateFollowUpSequenceRequest = await request.json()

    // Validate name uniqueness if name is being updated
    if (body.name && body.name !== sequence.name) {
      const existingSequence = await prisma.follow_up_sequences.findFirst({
        where: {
          companyId: user.companies.id,
          name: body.name,
          id: { not: sequence.id }
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
    }

    // Validate and sanitize steps if provided
    let sanitizedSteps: FollowUpStep[] | undefined
    if (body.steps) {
      if (!Array.isArray(body.steps) || body.steps.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Steps must be a non-empty array'
          },
          { status: 400 }
        )
      }

      const validationErrors: string[] = []
      sanitizedSteps = body.steps.map((step, index) => {
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
          const prevStep = body.steps![index - 1]
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
    }

    // Validate triggerAfterDays if provided
    if (body.triggerAfterDays !== undefined && (body.triggerAfterDays < 1 || body.triggerAfterDays > 365)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trigger after days must be between 1 and 365'
        },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim()
    if (body.active !== undefined) updateData.active = body.active
    if (sanitizedSteps) updateData.steps = JSON.stringify(sanitizedSteps)

    // Update the sequence
    const updatedSequence = await prisma.follow_up_sequences.update({
      where: { id: sequence.id },
      data: updateData
    })

    // Log update activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companies.id,
        userId: user.id,
        type: 'FOLLOW_UP_SEQUENCE_UPDATED',
        description: `Updated follow-up sequence: ${updatedSequence.name}`,
        metadata: {
          sequenceId: sequence.id,
          changes: Object.keys(updateData).filter(key => key !== 'updatedAt'),
          stepsCount: sanitizedSteps?.length || (typeof sequence.steps === 'string' ? JSON.parse(sequence.steps).length : 0),
          previousActive: sequence.active,
          newActive: updatedSequence.active
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSequence.id,
        name: updatedSequence.name,
        description: updatedSequence.description,
        active: updatedSequence.active,
        stepsCount: sanitizedSteps?.length || (typeof sequence.steps === 'string' ? JSON.parse(sequence.steps).length : 0),
        updatedAt: updatedSequence.updatedAt
      },
      message: 'Follow-up sequence updated successfully'
    })

  } catch (error) {
    console.error('Error updating follow-up sequence:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update follow-up sequence'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/follow-up-sequences/[id]
 * Delete a specific follow-up sequence
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: (await params).id,
        companyId: user.companies.id
      },
      include: {
        _count: {
          select: {
            followUpLogs: true
          }
        }
      }
    })

    if (!sequence) {
      return NextResponse.json(
        {
          success: false,
          error: 'Follow-up sequence not found'
        },
        { status: 404 }
      )
    }

    // Check if sequence has active follow-ups
    const activeFollowUps = await prisma.follow_up_logs.count({
      where: {
        sequenceId: sequence.id,
        deliveryStatus: { in: ['QUEUED', 'SENT'] }
      }
    })

    if (activeFollowUps > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete sequence with ${activeFollowUps} active follow-ups. Please wait for them to complete or manually cancel them.`
        },
        { status: 400 }
      )
    }

    // Delete the sequence (cascade will handle follow-up logs)
    await prisma.follow_up_sequences.delete({
      where: { id: sequence.id }
    })

    // Log deletion activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companies.id,
        userId: user.id,
        type: 'FOLLOW_UP_SEQUENCE_DELETED',
        description: `Deleted follow-up sequence: ${sequence.name}`,
        metadata: {
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          totalLogsDeleted: sequence._count.followUpLogs
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Follow-up sequence "${sequence.name}" deleted successfully`,
      data: {
        deletedSequenceId: sequence.id,
        deletedLogsCount: sequence._count.followUpLogs
      }
    })

  } catch (error) {
    console.error('Error deleting follow-up sequence:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete follow-up sequence'
      },
      { status: 500 }
    )
  }
}