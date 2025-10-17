// Sprint 3: Backend Agent - Bulk Operations Service
// Manage 100+ simultaneous consolidation operations

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schemas
const bulkOperationSchema = z.object({
  operation: z.enum(['schedule', 'send', 'cancel', 'reschedule', 'update_priority']),
  consolidationIds: z.array(z.string()).min(1).max(100), // Limit to 100 operations
  parameters: z.object({
    scheduledFor: z.string().datetime().optional(),
    priorityScore: z.number().min(0).max(100).optional(),
    escalationLevel: z.enum(['POLITE', 'FIRM', 'URGENT', 'FINAL']).optional(),
    templateId: z.string().optional(),
    reason: z.string().optional()
  }).optional()
})

const bulkCreateSchema = z.object({
  customerIds: z.array(z.string()).min(1).max(50), // Create for up to 50 customers
  parameters: z.object({
    scheduledFor: z.string().datetime().optional(),
    priorityScore: z.number().min(0).max(100).default(50),
    escalationLevel: z.enum(['POLITE', 'FIRM', 'URGENT', 'FINAL']).default('POLITE'),
    templateId: z.string().optional(),
    minInvoiceCount: z.number().min(2).default(2),
    maxConsolidationAmount: z.number().positive().optional()
  })
})

interface BulkOperationResult {
  operationId: string
  operation: string
  totalRequested: number
  successfulOperations: number
  failedOperations: number
  results: {
    consolidationId: string
    status: 'success' | 'failed' | 'skipped'
    message?: string
  }[]
  executionTimeMs: number
  estimatedEmailsSaved?: number
}

// POST - Execute bulk operations
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = bulkOperationSchema.parse(body)

    // Generate operation ID for tracking
    const operationId = `bulk_${data.operation}_${Date.now()}`

    // Validate all consolidations belong to the company
    const validConsolidations = await prisma.customerConsolidatedReminder.findMany({
      where: {
        id: { in: data.consolidationIds },
        companyId: session.user.companyId
      },
      select: {
        id: true,
        deliveryStatus: true,
        scheduledFor: true,
        priorityScore: true,
        customerId: true
      }
    })

    if (validConsolidations.length !== data.consolidationIds.length) {
      return NextResponse.json({
        error: 'Some consolidations not found or unauthorized'
      }, { status: 400 })
    }

    // Execute bulk operation based on type
    let results: BulkOperationResult['results'] = []
    let estimatedEmailsSaved = 0

    switch (data.operation) {
      case 'schedule':
        results = await handleBulkSchedule(validConsolidations, data.parameters)
        break
      case 'send':
        results = await handleBulkSend(validConsolidations, session.user.companyId)
        estimatedEmailsSaved = calculateEmailsSaved(validConsolidations)
        break
      case 'cancel':
        results = await handleBulkCancel(validConsolidations, data.parameters?.reason)
        break
      case 'reschedule':
        results = await handleBulkReschedule(validConsolidations, data.parameters)
        break
      case 'update_priority':
        results = await handleBulkPriorityUpdate(validConsolidations, data.parameters)
        break
    }

    const response: BulkOperationResult = {
      operationId,
      operation: data.operation,
      totalRequested: data.consolidationIds.length,
      successfulOperations: results.filter(r => r.status === 'success').length,
      failedOperations: results.filter(r => r.status === 'failed').length,
      results,
      executionTimeMs: Date.now() - startTime,
      ...(estimatedEmailsSaved > 0 && { estimatedEmailsSaved })
    }

    // Log bulk operation for audit
    await logBulkOperation(
      session.user.companyId,
      session.user.id,
      operationId,
      data.operation,
      response
    )

    return NextResponse.json(response)

  } catch (error) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { error: 'Bulk operation failed' },
      { status: 500 }
    )
  }
}

// PUT - Create bulk consolidations for multiple customers
export async function PUT(request: NextRequest) {
  const startTime = Date.now()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = bulkCreateSchema.parse(body)

    // Get consolidation candidates for each customer
    const candidates = await getConsolidationCandidates(
      session.user.companyId,
      data.customerIds,
      data.parameters
    )

    const results: BulkOperationResult['results'] = []
    let estimatedEmailsSaved = 0

    // Create consolidations in parallel batches of 10
    const batchSize = 10
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(candidate => createConsolidation(candidate, data.parameters, session.user.id))
      )

      // Process batch results
      batchResults.forEach((result, index) => {
        const candidate = batch[index]
        if (result.status === 'fulfilled') {
          results.push({
            consolidationId: result.value.id,
            status: 'success',
            message: `Created consolidation with ${candidate.invoiceIds.length} invoices`
          })
          estimatedEmailsSaved += candidate.invoiceIds.length - 1 // One email instead of N
        } else {
          results.push({
            consolidationId: candidate.customerId,
            status: 'failed',
            message: result.reason?.toString() || 'Unknown error'
          })
        }
      })
    }

    const response: BulkOperationResult = {
      operationId: `bulk_create_${Date.now()}`,
      operation: 'create',
      totalRequested: data.customerIds.length,
      successfulOperations: results.filter(r => r.status === 'success').length,
      failedOperations: results.filter(r => r.status === 'failed').length,
      results,
      executionTimeMs: Date.now() - startTime,
      estimatedEmailsSaved
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Bulk create error:', error)
    return NextResponse.json(
      { error: 'Bulk create failed' },
      { status: 500 }
    )
  }
}

// Helper Functions

async function handleBulkSchedule(
  consolidations: any[],
  parameters: any
): Promise<BulkOperationResult['results']> {
  if (!parameters?.scheduledFor) {
    throw new Error('scheduledFor parameter required for schedule operation')
  }

  const scheduledFor = new Date(parameters.scheduledFor)
  const results: BulkOperationResult['results'] = []

  for (const consolidation of consolidations) {
    try {
      // Only schedule if not already sent
      if (consolidation.deliveryStatus === 'QUEUED') {
        await prisma.customerConsolidatedReminder.update({
          where: { id: consolidation.id },
          data: {
            scheduledFor,
            deliveryStatus: 'QUEUED'
          }
        })
        results.push({ consolidationId: consolidation.id, status: 'success' })
      } else {
        results.push({
          consolidationId: consolidation.id,
          status: 'skipped',
          message: `Cannot schedule - status is ${consolidation.deliveryStatus}`
        })
      }
    } catch (error) {
      results.push({
        consolidationId: consolidation.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function handleBulkSend(
  consolidations: any[],
  companyId: string
): Promise<BulkOperationResult['results']> {
  const results: BulkOperationResult['results'] = []

  for (const consolidation of consolidations) {
    try {
      // Only send if queued or scheduled
      if (['QUEUED', 'SCHEDULED'].includes(consolidation.deliveryStatus)) {
        // Update status to SENT (actual email sending would be handled by email service)
        await prisma.customerConsolidatedReminder.update({
          where: { id: consolidation.id },
          data: {
            deliveryStatus: 'SENT',
            sentAt: new Date()
          }
        })

        // Create email log entry
        await prisma.emailLog.create({
          data: {
            companyId,
            consolidatedReminderId: consolidation.id,
            recipientEmail: 'customer@example.com', // Would get from customer data
            subject: 'Consolidated Payment Reminder',
            content: 'Generated content',
            deliveryStatus: 'SENT',
            invoiceCount: 1, // Would calculate from actual invoices
            consolidationSavings: 50 // Would calculate actual savings
          }
        })

        results.push({ consolidationId: consolidation.id, status: 'success' })
      } else {
        results.push({
          consolidationId: consolidation.id,
          status: 'skipped',
          message: `Cannot send - status is ${consolidation.deliveryStatus}`
        })
      }
    } catch (error) {
      results.push({
        consolidationId: consolidation.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function handleBulkCancel(
  consolidations: any[],
  reason?: string
): Promise<BulkOperationResult['results']> {
  const results: BulkOperationResult['results'] = []

  for (const consolidation of consolidations) {
    try {
      if (['QUEUED', 'SCHEDULED'].includes(consolidation.deliveryStatus)) {
        await prisma.customerConsolidatedReminder.update({
          where: { id: consolidation.id },
          data: {
            deliveryStatus: 'FAILED', // Using FAILED to indicate cancelled
            businessRulesApplied: {
              cancelled: true,
              reason: reason || 'Bulk cancellation'
            }
          }
        })
        results.push({ consolidationId: consolidation.id, status: 'success' })
      } else {
        results.push({
          consolidationId: consolidation.id,
          status: 'skipped',
          message: `Cannot cancel - status is ${consolidation.deliveryStatus}`
        })
      }
    } catch (error) {
      results.push({
        consolidationId: consolidation.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function handleBulkReschedule(
  consolidations: any[],
  parameters: any
): Promise<BulkOperationResult['results']> {
  if (!parameters?.scheduledFor) {
    throw new Error('scheduledFor parameter required for reschedule operation')
  }

  const newScheduledFor = new Date(parameters.scheduledFor)
  const results: BulkOperationResult['results'] = []

  for (const consolidation of consolidations) {
    try {
      if (['QUEUED', 'SCHEDULED'].includes(consolidation.deliveryStatus)) {
        await prisma.customerConsolidatedReminder.update({
          where: { id: consolidation.id },
          data: {
            scheduledFor: newScheduledFor,
            deliveryStatus: 'QUEUED'
          }
        })
        results.push({ consolidationId: consolidation.id, status: 'success' })
      } else {
        results.push({
          consolidationId: consolidation.id,
          status: 'skipped',
          message: `Cannot reschedule - status is ${consolidation.deliveryStatus}`
        })
      }
    } catch (error) {
      results.push({
        consolidationId: consolidation.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function handleBulkPriorityUpdate(
  consolidations: any[],
  parameters: any
): Promise<BulkOperationResult['results']> {
  if (typeof parameters?.priorityScore !== 'number') {
    throw new Error('priorityScore parameter required for priority update')
  }

  const results: BulkOperationResult['results'] = []

  for (const consolidation of consolidations) {
    try {
      await prisma.customerConsolidatedReminder.update({
        where: { id: consolidation.id },
        data: {
          priorityScore: parameters.priorityScore,
          ...(parameters.escalationLevel && {
            escalationLevel: parameters.escalationLevel
          })
        }
      })
      results.push({ consolidationId: consolidation.id, status: 'success' })
    } catch (error) {
      results.push({
        consolidationId: consolidation.id,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function getConsolidationCandidates(
  companyId: string,
  customerIds: string[],
  parameters: any
) {
  // This would integrate with the existing consolidation service
  // For now, return mock data structure
  return customerIds.map(customerId => ({
    customerId,
    invoiceIds: [`inv_${customerId}_1`, `inv_${customerId}_2`],
    totalAmount: 1000,
    invoiceCount: 2
  }))
}

async function createConsolidation(candidate: any, parameters: any, userId: string) {
  return await prisma.customerConsolidatedReminder.create({
    data: {
      customerId: candidate.customerId,
      companyId: 'company_id', // Would get from session
      invoiceIds: candidate.invoiceIds,
      totalAmount: candidate.totalAmount,
      invoiceCount: candidate.invoiceCount,
      reminderType: 'CONSOLIDATED',
      escalationLevel: parameters.escalationLevel,
      priorityScore: parameters.priorityScore,
      scheduledFor: parameters.scheduledFor ? new Date(parameters.scheduledFor) : null,
      deliveryStatus: 'QUEUED',
      createdBy: userId
    }
  })
}

function calculateEmailsSaved(consolidations: any[]): number {
  // Each consolidation saves (invoiceCount - 1) emails
  return consolidations.reduce((total, c) => total + Math.max(0, (c.invoiceCount || 2) - 1), 0)
}

async function logBulkOperation(
  companyId: string,
  userId: string,
  operationId: string,
  operation: string,
  result: BulkOperationResult
) {
  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      entityType: 'customer_consolidated_reminders',
      entityId: operationId,
      action: `BULK_${operation.toUpperCase()}`,
      newValues: result,
      metadata: {
        operationType: 'bulk_consolidation',
        executionTimeMs: result.executionTimeMs,
        successRate: (result.successfulOperations / result.totalRequested) * 100
      }
    }
  })
}

// GET - Get bulk operation status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')

    if (operationId) {
      // Get specific operation status
      const operation = await prisma.auditLog.findFirst({
        where: {
          companyId: session.user.companyId,
          entityId: operationId,
          action: { startsWith: 'BULK_' }
        },
        select: {
          action: true,
          newValues: true,
          createdAt: true,
          metadata: true
        }
      })

      if (!operation) {
        return NextResponse.json({ error: 'Operation not found' }, { status: 404 })
      }

      return NextResponse.json({
        operationId,
        status: 'completed', // In a real system, this could be 'running', 'completed', 'failed'
        result: operation.newValues,
        executedAt: operation.createdAt,
        metadata: operation.metadata
      })
    }

    // Get recent bulk operations
    const recentOperations = await prisma.auditLog.findMany({
      where: {
        companyId: session.user.companyId,
        action: { startsWith: 'BULK_' }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        entityId: true,
        action: true,
        createdAt: true,
        metadata: true,
        newValues: true
      }
    })

    return NextResponse.json({
      recentOperations: recentOperations.map(op => ({
        operationId: op.entityId,
        operation: op.action,
        executedAt: op.createdAt,
        metadata: op.metadata,
        summary: {
          totalRequested: (op.newValues as any)?.totalRequested || 0,
          successfulOperations: (op.newValues as any)?.successfulOperations || 0,
          failedOperations: (op.newValues as any)?.failedOperations || 0
        }
      }))
    })

  } catch (error) {
    console.error('Get bulk operations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch operations' },
      { status: 500 }
    )
  }
}