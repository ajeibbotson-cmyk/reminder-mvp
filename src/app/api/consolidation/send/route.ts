/**
 * Consolidation Send API
 * POST /api/consolidation/send - Send consolidated reminders for selected customers
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import type { ConsolidationApiResponse, BulkOperationResult } from '@/lib/types/consolidation'
import { prisma } from '@/lib/prisma'

interface SendConsolidationRequest {
  customerIds: string[]
  scheduledFor?: string // ISO date string
  templateOverride?: string
  escalationLevelOverride?: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  priorityOverride?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  attachmentSettings?: {
    includeIndividualInvoices?: boolean
    includeConsolidatedStatement?: boolean
    maxAttachmentSize?: number
  }
  schedulingOptions?: {
    respectBusinessHours?: boolean
    avoidHolidays?: boolean
    avoidPrayerTimes?: boolean
  }
  trackingOptions?: {
    enableOpenTracking?: boolean
    enableClickTracking?: boolean
    enableDeliveryTracking?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 401 }
      )
    }

    const body: SendConsolidationRequest = await request.json()
    const { customerIds, scheduledFor, templateOverride, escalationLevelOverride } = body

    // Validate request
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer IDs array is required and cannot be empty',
          code: 'INVALID_REQUEST',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 400 }
      )
    }

    if (customerIds.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum 100 customers can be processed at once',
          code: 'TOO_MANY_CUSTOMERS',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 400 }
      )
    }

    console.log(`📧 Processing consolidation send for ${customerIds.length} customers`)

    // Get all consolidation candidates for the company
    const allCandidates = await customerConsolidationService.getConsolidationCandidates(session.user.companiesId)

    const results: BulkOperationResult['results'] = []
    let totalInvoicesConsolidated = 0

    // Process each customer
    for (const customerId of customerIds) {
      try {
        // Find the candidate for this customer
        const candidate = allCandidates.find(c => c.customerId === customerId)

        if (!candidate) {
          results.push({
            customerId,
            success: false,
            error: 'Customer not found or not eligible for consolidation'
          })
          continue
        }

        if (!candidate.canContact) {
          results.push({
            customerId,
            success: false,
            error: `Customer in waiting period until ${candidate.nextEligibleContact?.toISOString()}`
          })
          continue
        }

        // Apply overrides if provided
        if (escalationLevelOverride) {
          candidate.escalationLevel = escalationLevelOverride
        }

        // Create consolidated reminder
        const consolidation = await customerConsolidationService.createConsolidatedReminder(candidate)

        // Override template if specified
        if (templateOverride) {
          await prisma.customerConsolidatedReminders.update({
            where: { id: consolidation.id },
            data: { templateId: templateOverride }
          })
          consolidation.templateId = templateOverride
        }

        // Override scheduled time if specified
        const effectiveScheduledFor = scheduledFor
          ? new Date(scheduledFor)
          : consolidation.scheduledFor || new Date()

        await prisma.customerConsolidatedReminders.update({
          where: { id: consolidation.id },
          data: { scheduledFor: effectiveScheduledFor }
        })

        // Find an active sequence for execution
        const activeSequence = await prisma.follow_up_sequencess.findFirst({
          where: {
            companyId: session.user.companiesId,
            active: true
          }
        })

        if (!activeSequence) {
          results.push({
            customerId,
            success: false,
            error: 'No active follow-up sequence found for company'
          })
          continue
        }

        // Start sequence execution for the consolidation
        const executionResult = await sequenceExecutionService.startConsolidatedSequenceExecution(
          consolidation,
          activeSequence.id,
          {
            startImmediately: !scheduledFor, // Start immediately if no schedule specified
            customStartTime: effectiveScheduledFor
          }
        )

        if (executionResult.success) {
          totalInvoicesConsolidated += candidate.overdueInvoices.length

          results.push({
            customerId,
            success: true,
            consolidationId: consolidation.id,
            scheduledFor: effectiveScheduledFor
          })

          // Update consolidation with execution info
          await prisma.customerConsolidatedReminders.update({
            where: { id: consolidation.id },
            data: {
              deliveryStatus: scheduledFor ? 'QUEUED' : 'SENT',
              sentAt: scheduledFor ? null : new Date(),
              awsMessageId: executionResult.emailLogIds[0]
            }
          })

          console.log(`✅ Consolidation created for customer ${candidate.customerName}: ${consolidation.id}`)

        } else {
          results.push({
            customerId,
            success: false,
            error: `Sequence execution failed: ${executionResult.errors.join(', ')}`
          })
        }

      } catch (error) {
        console.error(`Error processing customer ${customerId}:`, error)
        results.push({
          customerId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }

    // Calculate summary
    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount
    const emailsSaved = results
      .filter(r => r.success)
      .reduce((sum, r) => {
        const candidate = allCandidates.find(c => c.customerId === r.customerId)
        return sum + (candidate ? candidate.overdueInvoices.length - 1 : 0)
      }, 0)

    const operationResult: BulkOperationResult = {
      total: results.length,
      successful: successCount,
      failed: failureCount,
      results,
      summary: {
        emailsSaved,
        totalInvoicesConsolidated,
        estimatedDeliveryTime: scheduledFor ? new Date(scheduledFor) : new Date()
      }
    }

    // Log the bulk operation
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companiesId,
        userId: session.user.id,
        type: 'BULK_CONSOLIDATION_SENT',
        description: `Bulk consolidation sent: ${successCount} successful, ${failureCount} failed`,
        metadata: {
          customerCount: customerIds.length,
          successCount,
          failureCount,
          emailsSaved,
          totalInvoicesConsolidated,
          scheduledFor,
          templateOverride,
          escalationLevelOverride
        }
      }
    })

    const response: ConsolidationApiResponse<BulkOperationResult> = {
      success: true,
      data: operationResult,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Consolidation send error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to send consolidated reminders',
      code: 'SEND_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}