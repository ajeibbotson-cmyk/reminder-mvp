import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { z } from 'zod'

// Bulk update request schema
const bulkUpdateSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1, 'At least one invoice ID is required'),
  status: z.nativeEnum(InvoiceStatus),
  reason: z.string().optional(),
  forceUpdate: z.boolean().default(false)
})

interface BulkUpdateResult {
  action: string
  requestedCount: number
  processedCount: number
  successCount: number
  failureCount: number
  results: Array<{
    id: string
    success: boolean
    previousStatus: string
    newStatus: string
    error?: string
  }>
  errors: Array<{
    id: string
    error: string
    reason: string
  }>
}

// PATCH /api/invoices/bulk-update-status - Bulk update invoice statuses
export async function PATCH(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])

    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to bulk update invoices')
    }

    const body = await request.json()
    const { invoiceIds, status, reason, forceUpdate } = bulkUpdateSchema.parse(body)

    // Validate that all invoices belong to the user's company
    const invoicesCheck = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        companyId: authContext.user.companyId
      },
      select: {
        id: true,
        status: true,
        number: true,
        customerName: true
      }
    })

    if (invoicesCheck.length !== invoiceIds.length) {
      throw new ValidationError('Some invoices not found or do not belong to your company')
    }

    const result: BulkUpdateResult = {
      action: 'bulk-update-status',
      requestedCount: invoiceIds.length,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      errors: []
    }

    // Process updates in transaction for consistency
    await prisma.$transaction(async (tx) => {
      for (const invoice of invoicesCheck) {
        try {
          // Business rules validation
          if (!forceUpdate) {
            const validationError = validateStatusTransition(invoice.status, status)
            if (validationError) {
              result.errors.push({
                id: invoice.id,
                error: validationError,
                reason: 'Invalid status transition'
              })
              result.failureCount++
              continue
            }
          }

          // Update invoice status
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status,
              updatedAt: new Date()
            }
          })

          // Log the status change activity
          await tx.activity.create({
            data: {
              id: crypto.randomUUID(),
              companyId: authContext.user.companyId,
              userId: authContext.user.id,
              type: 'invoice_status_bulk_updated',
              description: `Bulk updated invoice ${invoice.number} status from ${invoice.status} to ${status}`,
              metadata: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                customerName: invoice.customerName,
                previousStatus: invoice.status,
                newStatus: status,
                reason: reason || 'Bulk update operation',
                bulkOperation: true,
                userAgent: request.headers.get('user-agent'),
                ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
              }
            }
          })

          result.results.push({
            id: invoice.id,
            success: true,
            previousStatus: invoice.status,
            newStatus: status
          })

          result.successCount++
          result.processedCount++

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push({
            id: invoice.id,
            error: errorMessage,
            reason: 'Update failed'
          })
          result.failureCount++
          result.processedCount++
        }
      }

      // Create summary activity log
      await tx.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_bulk_operation_completed',
          description: `Bulk status update completed: ${result.successCount} successful, ${result.failureCount} failed`,
          metadata: {
            operation: 'bulk-update-status',
            targetStatus: status,
            requestedCount: result.requestedCount,
            successCount: result.successCount,
            failureCount: result.failureCount,
            invoiceIds: invoiceIds,
            reason: reason || 'Bulk update operation'
          }
        }
      })
    })

    return successResponse({
      ...result,
      message: `Bulk update completed: ${result.successCount} updated, ${result.failureCount} failed`
    }, `Successfully processed ${result.processedCount} of ${result.requestedCount} invoices`)

  } catch (error) {
    logError('PATCH /api/invoices/bulk-update-status', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId'
    })
    return handleApiError(error)
  }
}

// Helper function to validate status transitions
function validateStatusTransition(currentStatus: string, newStatus: InvoiceStatus): string | null {
  const validTransitions: Record<string, InvoiceStatus[]> = {
    DRAFT: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
    SENT: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED, InvoiceStatus.CANCELLED],
    OVERDUE: [InvoiceStatus.PAID, InvoiceStatus.DISPUTED, InvoiceStatus.WRITTEN_OFF],
    DISPUTED: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.WRITTEN_OFF],
    PAID: [], // Generally cannot change from PAID
    WRITTEN_OFF: [], // Generally cannot change from WRITTEN_OFF
    CANCELLED: [] // Generally cannot change from CANCELLED
  }

  const allowedTransitions = validTransitions[currentStatus] || []

  if (!allowedTransitions.includes(newStatus)) {
    return `Cannot change status from ${currentStatus} to ${newStatus}. Use forceUpdate to override.`
  }

  return null
}