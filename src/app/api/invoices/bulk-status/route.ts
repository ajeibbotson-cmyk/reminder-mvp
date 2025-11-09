/**
 * Bulk Invoice Status Update API
 * Enhanced endpoint for updating multiple invoice statuses with comprehensive validation
 * 
 * Features:
 * - Bulk status updates with validation
 * - UAE business rule enforcement
 * - Comprehensive audit trails
 * - Performance optimized for large datasets
 * - Detailed success/failure reporting
 */

import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { validateRequestBody } from '@/lib/validations'
import { invoiceStatusService } from '@/lib/services/invoice-status-service'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { z } from 'zod'

// Validation schema for bulk status update
const bulkStatusUpdateSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1, 'At least one invoice ID is required').max(1000, 'Maximum 1000 invoices can be updated at once'),
  status: z.nativeEnum(InvoiceStatus, { required_error: 'Status is required' }),
  reason: z.string().optional(),
  notes: z.string().optional(),
  forceOverride: z.boolean().default(false),
  enableNotifications: z.boolean().default(false),
  dryRun: z.boolean().default(false) // For testing without actual updates
})

/**
 * POST /api/invoices/bulk-status
 * Update status of multiple invoices with comprehensive validation and audit trail
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions for bulk invoice status updates')
    }

    const { 
      invoiceIds, 
      status, 
      reason, 
      notes, 
      forceOverride, 
      enableNotifications,
      dryRun 
    } = await validateRequestBody(request, bulkStatusUpdateSchema)

    // Enhanced logging for bulk operations
    console.log(`Bulk status update initiated by ${authContext.user.name} (${authContext.user.role})`)
    console.log(`Target status: ${status}, Invoice count: ${invoiceIds.length}, Dry run: ${dryRun}`)

    if (dryRun) {
      // Dry run mode - validate without updating
      console.log('DRY RUN MODE: Validating bulk status update without making changes')
      
      // Use invoice status service for validation
      const validationResult = await validateBulkStatusUpdate(
        invoiceIds,
        status,
        authContext.user.companyId,
        authContext.user.role,
        forceOverride
      )

      return successResponse({
        dryRun: true,
        validationResult,
        estimatedExecutionTime: `${Math.ceil(invoiceIds.length / 50)} seconds`, // Rough estimate
        message: 'Dry run completed - no changes made'
      }, 'Bulk status update validation completed')
    }

    // Perform actual bulk update using the enhanced service
    const result = await invoiceStatusService.bulkUpdateInvoiceStatus(
      invoiceIds,
      status,
      {
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        userRole: authContext.user.role,
        reason: reason || `Bulk update to ${status}`,
        forceOverride,
        enableNotifications
      }
    )

    const executionTime = Date.now() - startTime

    // Enhanced logging for audit purposes
    console.log(`Bulk status update completed in ${executionTime}ms`)
    console.log(`Results: ${result.successCount} success, ${result.failedCount} failed, ${result.skippedCount} skipped`)
    
    if (result.failedCount > 0) {
      console.warn('Bulk update had failures:', result.results.filter(r => !r.success))
    }

    // Create comprehensive response
    return successResponse({
      bulkOperation: {
        requestedCount: result.totalRequested,
        successCount: result.successCount,
        failedCount: result.failedCount,
        skippedCount: result.skippedCount,
        executionTimeMs: executionTime,
        targetStatus: status,
        completedAt: new Date().toISOString()
      },
      // Detailed results for each invoice
      invoiceResults: result.results.map(r => ({
        invoiceId: r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        success: r.success,
        oldStatus: r.oldStatus,
        newStatus: r.newStatus,
        error: r.error,
        reason: r.reason
      })),
      // Business impact summary
      businessSummary: {
        totalAmountAffected: result.businessSummary.totalAmountAffected,
        formattedTotalAmount: result.businessSummary.formattedTotalAmount,
        overdueAmountAffected: result.businessSummary.overdueAmountAffected,
        paidAmountAffected: result.businessSummary.paidAmountAffected
      },
      // Audit trail summary
      auditTrail: {
        entriesCreated: result.auditEntries.length,
        complianceFlags: result.auditEntries.flatMap(entry => entry.metadata.complianceFlags),
        automatedChanges: result.auditEntries.filter(entry => entry.metadata.automatedChange).length
      },
      // Error analysis
      errorAnalysis: result.failedCount > 0 ? analyzeErrors(result.results.filter(r => !r.success)) : null,
      // Performance metrics
      performanceMetrics: {
        averageProcessingTimePerInvoice: Math.round(executionTime / invoiceIds.length),
        throughputPerSecond: Math.round((invoiceIds.length / executionTime) * 1000),
        totalExecutionTime: executionTime
      }
    }, `Bulk status update completed: ${result.successCount}/${result.totalRequested} invoices updated successfully`)

  } catch (error) {
    const executionTime = Date.now() - startTime
    
    logError('POST /api/invoices/bulk-status', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      executionTime,
      requestSize: 'invoiceIds?.length'
    })
    
    return handleApiError(error)
  }
}

/**
 * GET /api/invoices/bulk-status
 * Get bulk operation status and history
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    // Get company-wide status insights
    const statusInsights = await invoiceStatusService.getStatusInsights(authContext.user.companyId)
    
    // Get recent bulk operations from audit trail
    const recentBulkOperations = await getBulkOperationHistory(authContext.user.companyId)
    
    return successResponse({
      statusInsights,
      recentBulkOperations,
      systemCapabilities: {
        maxBulkSize: 1000,
        supportedStatuses: Object.values(InvoiceStatus),
        supportsDryRun: true,
        supportsForceOverride: true,
        supportsNotifications: true
      },
      businessRules: {
        uaeCompliant: true,
        auditTrailEnabled: true,
        multiTenantSupport: true,
        roleBasedPermissions: true
      }
    }, 'Bulk status operation information retrieved successfully')

  } catch (error) {
    logError('GET /api/invoices/bulk-status', error)
    return handleApiError(error)
  }
}

// Helper Functions

/**
 * Validate bulk status update before execution
 */
async function validateBulkStatusUpdate(
  invoiceIds: string[],
  targetStatus: InvoiceStatus,
  companyId: string,
  userRole: UserRole,
  forceOverride: boolean
): Promise<{
  validInvoices: number
  invalidInvoices: number
  validationErrors: Array<{
    invoiceId: string
    error: string
  }>
  estimatedImpact: {
    totalAmount: number
    formattedAmount: string
  }
}> {
  const { prisma } = require('@/lib/prisma')
  
  // Fetch all invoices for validation
  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoiceIds },
      companyId // Enforce company isolation
    },
    include: {
      payments: { select: { amount: true } }
    }
  })

  if (invoices.length !== invoiceIds.length) {
    throw new Error(`${invoiceIds.length - invoices.length} invoices not found or access denied`)
  }

  let validInvoices = 0
  let invalidInvoices = 0
  const validationErrors: Array<{ invoiceId: string; error: string }> = []
  let totalAmount = 0

  for (const invoice of invoices) {
    try {
      // Validate each transition
      const validation = invoiceStatusService.validateStatusTransition(
        invoice.status,
        targetStatus,
        {
          invoice,
          user: { role: userRole, companyId },
          forceOverride
        }
      )

      if (validation.isValid) {
        validInvoices++
        totalAmount += invoice.totalAmount || invoice.amount
      } else {
        invalidInvoices++
        validationErrors.push({
          invoiceId: invoice.id,
          error: validation.reason || 'Invalid transition'
        })
      }
    } catch (error) {
      invalidInvoices++
      validationErrors.push({
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : 'Validation error'
      })
    }
  }

  return {
    validInvoices,
    invalidInvoices,
    validationErrors,
    estimatedImpact: {
      totalAmount,
      formattedAmount: new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED'
      }).format(totalAmount)
    }
  }
}

/**
 * Analyze bulk operation errors for insights
 */
function analyzeErrors(failedResults: Array<{ invoiceId: string; error?: string }>): {
  errorCategories: Record<string, number>
  commonErrors: string[]
  suggestedActions: string[]
} {
  const errorCategories: Record<string, number> = {}
  const errorMessages = failedResults.map(r => r.error || 'Unknown error')

  // Categorize errors
  errorMessages.forEach(error => {
    if (error.includes('transition')) {
      errorCategories['Invalid Transition'] = (errorCategories['Invalid Transition'] || 0) + 1
    } else if (error.includes('payment')) {
      errorCategories['Payment Validation'] = (errorCategories['Payment Validation'] || 0) + 1
    } else if (error.includes('permission')) {
      errorCategories['Permission Denied'] = (errorCategories['Permission Denied'] || 0) + 1
    } else if (error.includes('reason')) {
      errorCategories['Missing Reason'] = (errorCategories['Missing Reason'] || 0) + 1
    } else {
      errorCategories['Other'] = (errorCategories['Other'] || 0) + 1
    }
  })

  // Get most common errors
  const commonErrors = [...new Set(errorMessages)].slice(0, 5)

  // Generate suggested actions
  const suggestedActions = []
  if (errorCategories['Invalid Transition']) {
    suggestedActions.push('Review status transition rules for affected invoices')
  }
  if (errorCategories['Payment Validation']) {
    suggestedActions.push('Verify payment amounts before marking as PAID')
  }
  if (errorCategories['Missing Reason']) {
    suggestedActions.push('Provide reason for sensitive status changes (DISPUTED, WRITTEN_OFF)')
  }
  if (errorCategories['Permission Denied']) {
    suggestedActions.push('Use forceOverride for admin-level operations or contact administrator')
  }

  return {
    errorCategories,
    commonErrors,
    suggestedActions
  }
}

/**
 * Get recent bulk operation history
 */
async function getBulkOperationHistory(companyId: string) {
  const { prisma } = require('@/lib/prisma')
  
  const recentOperations = await prisma.activity.findMany({
    where: {
      companyId,
      type: 'invoice_status_updated',
      metadata: {
        path: ['batchOperation'],
        equals: true
      },
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    include: {
      users: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  return recentOperations.map(op => ({
    id: op.id,
    performedAt: op.createdAt,
    performedBy: op.users?.name || 'System',
    targetStatus: op.metadata.newStatus,
    invoiceNumber: op.metadata.invoiceNumber,
    reason: op.metadata.reason,
    automatedChange: op.metadata.automatedChange
  }))
}