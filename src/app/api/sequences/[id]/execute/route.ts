import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { sequenceExecutionService, TriggerCondition } from '@/lib/services/sequence-execution-service'
import { sequenceTriggersService } from '@/lib/services/sequence-triggers-service'

interface ExecuteSequenceRequest {
  invoiceId: string
  triggerReason?: string
  startImmediately?: boolean
  customStartTime?: string
  skipValidation?: boolean
}

/**
 * POST /api/sequences/[id]/execute
 * Manually trigger a sequence execution for an invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const body: ExecuteSequenceRequest = await request.json()

    if (!body.invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Verify sequence exists and belongs to company
    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.companies.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    if (!sequence.active) {
      return NextResponse.json(
        { error: 'Sequence is not active' },
        { status: 400 }
      )
    }

    // Verify invoice exists and belongs to company
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: body.invoiceId,
        companyId: user.companies.id
      },
      include: {
        customer: true,
        payments: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if invoice is in a valid state for sequence execution
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot execute sequence on paid invoice' },
        { status: 400 }
      )
    }

    if (invoice.status === 'WRITTEN_OFF') {
      return NextResponse.json(
        { error: 'Cannot execute sequence on written-off invoice' },
        { status: 400 }
      )
    }

    // Check for existing active sequence
    const existingExecution = await sequenceExecutionService.getSequenceExecutionStatus(
      params.id,
      body.invoiceId
    )

    if (existingExecution && existingExecution.status === 'ACTIVE') {
      return NextResponse.json({
        error: 'Sequence already running for this invoice',
        executionId: existingExecution.id,
        currentStep: existingExecution.currentStep,
        nextExecutionAt: existingExecution.nextExecutionAt
      }, { status: 409 })
    }

    // Prepare trigger condition
    const triggerCondition: TriggerCondition = {
      type: 'MANUAL',
      value: body.triggerReason || 'Manual execution',
      operator: 'EQUALS'
    }

    // Parse custom start time if provided
    let customStartTime: Date | undefined
    if (body.customStartTime) {
      customStartTime = new Date(body.customStartTime)
      if (isNaN(customStartTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid custom start time format' },
          { status: 400 }
        )
      }
    }

    // Execute the sequence
    const executionResult = await sequenceExecutionService.startSequenceExecution(
      params.id,
      body.invoiceId,
      triggerCondition,
      {
        startImmediately: body.startImmediately || false,
        customStartTime,
        skipValidation: body.skipValidation || false
      }
    )

    if (executionResult.success) {
      // Log manual execution activity
      await prisma.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: user.companies.id,
          userId: user.id,
          type: 'SEQUENCE_MANUAL_EXECUTION',
          description: `Manually executed sequence: ${sequence.name} for invoice ${invoice.number}`,
          metadata: {
            sequenceId: params.id,
            sequenceName: sequence.name,
            invoiceId: body.invoiceId,
            invoiceNumber: invoice.number,
            executionId: executionResult.sequenceExecutionId,
            triggerReason: body.triggerReason,
            startImmediately: body.startImmediately
          }
        }
      })

      return NextResponse.json({
        success: true,
        executionId: executionResult.sequenceExecutionId,
        message: 'Sequence execution started successfully',
        details: {
          sequenceName: sequence.name,
          invoiceNumber: invoice.number,
          customerName: invoice.customerName,
          nextExecutionAt: executionResult.nextExecutionAt,
          stepsExecuted: executionResult.stepsExecuted,
          stepsRemaining: executionResult.stepsRemaining,
          emailLogIds: executionResult.emailLogIds
        }
      }, { status: 201 })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to start sequence execution',
        details: executionResult.errors
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error executing sequence:', error)
    return NextResponse.json(
      { error: 'Failed to execute sequence' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sequences/[id]/execute
 * Get execution status for a sequence
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Verify sequence belongs to company
    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.companies.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    // Get execution status
    const executionStatus = await sequenceExecutionService.getSequenceExecutionStatus(
      params.id,
      invoiceId
    )

    if (!executionStatus) {
      return NextResponse.json({
        hasExecution: false,
        message: 'No execution found for this sequence and invoice'
      })
    }

    // Get detailed execution logs
    const executionLogs = await prisma.follow_up_logs.findMany({
      where: {
        sequenceId: params.id,
        invoiceId: invoiceId
      },
      include: {
        emailLogs: {
          select: {
            id: true,
            deliveryStatus: true,
            sentAt: true,
            deliveredAt: true,
            openedAt: true,
            clickedAt: true,
            responseReceived: true,
            bounceReason: true
          }
        }
      },
      orderBy: { stepNumber: 'asc' }
    })

    return NextResponse.json({
      hasExecution: true,
      execution: {
        ...executionStatus,
        logs: executionLogs.map(log => ({
          id: log.id,
          stepNumber: log.stepNumber,
          subject: log.subject,
          sentAt: log.sentAt,
          emailOpened: log.emailOpened,
          emailClicked: log.emailClicked,
          responseReceived: log.responseReceived,
          emailLogs: log.emailLogs
        }))
      }
    })

  } catch (error) {
    console.error('Error getting execution status:', error)
    return NextResponse.json(
      { error: 'Failed to get execution status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sequences/[id]/execute
 * Stop/cancel a running sequence execution
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const reason = searchParams.get('reason') || 'Stopped by user'

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Verify sequence belongs to company
    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.companies.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    // Verify invoice belongs to company
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: user.companies.id
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Stop the sequence execution
    const stopResult = await sequenceExecutionService.stopSequenceExecution(
      params.id,
      invoiceId,
      reason
    )

    if (stopResult) {
      // Log stop activity
      await prisma.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: user.companies.id,
          userId: user.id,
          type: 'SEQUENCE_EXECUTION_STOPPED',
          description: `Stopped sequence execution: ${sequence.name} for invoice ${invoice.number}`,
          metadata: {
            sequenceId: params.id,
            sequenceName: sequence.name,
            invoiceId: invoiceId,
            invoiceNumber: invoice.number,
            reason
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Sequence execution stopped successfully',
        reason
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to stop sequence execution',
        message: 'The sequence may not be running or may have already completed'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error stopping sequence execution:', error)
    return NextResponse.json(
      { error: 'Failed to stop sequence execution' },
      { status: 500 }
    )
  }
}