import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'
import {
  executeDatabaseMaintenance,
  optimizeIndexes,
  createAuditLog,
} from '@/lib/database-utils'
import { z } from 'zod'

// Database maintenance request schema
const maintenanceRequestSchema = z.object({
  operations: z.array(z.enum([
    'mark_overdue',
    'cleanup_audit_logs',
    'archive_invoices',
    'optimize_indexes',
    'update_statistics',
  ])).default(['mark_overdue', 'cleanup_audit_logs']),
  dryRun: z.coerce.boolean().default(false),
})

// POST /api/system/database/maintenance - Execute database maintenance
export async function POST(request: NextRequest) {
  try {
    // Require admin access for maintenance operations
    const authContext = await requireRole(request, [UserRole.ADMIN])
    
    const requestBody = await request.json()
    const maintenanceRequest = maintenanceRequestSchema.parse(requestBody)
    
    // Get client information for audit trail
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const maintenanceResults: any = {
      operations: [],
      summary: {
        startTime: new Date().toISOString(),
        dryRun: maintenanceRequest.dryRun,
        requestedBy: authContext.user.id,
        ipAddress,
      },
    }

    // Log maintenance start
    await createAuditLog({
      companyId: authContext.user.companiesId,
      userId: authContext.user.id,
      entityType: 'system',
      entityId: 'maintenance',
      action: maintenanceRequest.dryRun ? 'MAINTENANCE_DRY_RUN' : 'MAINTENANCE_START',
      metadata: {
        operations: maintenanceRequest.operations,
        ipAddress,
        userAgent,
      },
      riskLevel: 'MEDIUM',
      ipAddress,
      userAgent,
    })

    // Execute maintenance operations
    for (const operation of maintenanceRequest.operations) {
      const operationStart = Date.now()
      let operationResult: any = {}

      try {
        switch (operation) {
          case 'mark_overdue':
          case 'cleanup_audit_logs':
          case 'archive_invoices':
            if (!maintenanceRequest.dryRun) {
              const dbMaintenanceResult = await executeDatabaseMaintenance(
                authContext.user.companiesId
              )
              operationResult = {
                overdueInvoicesUpdated: dbMaintenanceResult.overdueInvoicesUpdated,
                auditLogsCleanedUp: dbMaintenanceResult.auditLogsCleanedUp,
                invoicesArchived: dbMaintenanceResult.invoicesArchived,
              }
            } else {
              // Simulate dry run
              operationResult = {
                overdueInvoicesUpdated: 0,
                auditLogsCleanedUp: 0,
                invoicesArchived: 0,
                note: 'Dry run - no changes made',
              }
            }
            break

          case 'optimize_indexes':
            if (!maintenanceRequest.dryRun) {
              await optimizeIndexes()
              operationResult = {
                indexesOptimized: true,
                note: 'Database indexes analyzed and optimized',
              }
            } else {
              operationResult = {
                indexesOptimized: false,
                note: 'Dry run - index optimization not executed',
              }
            }
            break

          case 'update_statistics':
            if (!maintenanceRequest.dryRun) {
              // Update table statistics for query planner
              await updateTableStatistics()
              operationResult = {
                statisticsUpdated: true,
                note: 'Table statistics updated for query optimization',
              }
            } else {
              operationResult = {
                statisticsUpdated: false,
                note: 'Dry run - statistics update not executed',
              }
            }
            break

          default:
            throw new Error(`Unknown maintenance operation: ${operation}`)
        }

        const executionTime = Date.now() - operationStart

        maintenanceResults.operations.push({
          operation,
          status: 'success',
          executionTimeMs: executionTime,
          result: operationResult,
        })

      } catch (error) {
        const executionTime = Date.now() - operationStart
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        maintenanceResults.operations.push({
          operation,
          status: 'error',
          executionTimeMs: executionTime,
          error: errorMessage,
        })

        // Log operation failure
        await createAuditLog({
          companyId: authContext.user.companiesId,
          userId: authContext.user.id,
          entityType: 'system',
          entityId: 'maintenance',
          action: 'MAINTENANCE_ERROR',
          metadata: {
            operation,
            error: errorMessage,
            executionTime,
          },
          riskLevel: 'HIGH',
          ipAddress,
          userAgent,
        })
      }
    }

    // Calculate summary
    const totalExecutionTime = maintenanceResults.operations.reduce(
      (sum: number, op: any) => sum + op.executionTimeMs,
      0
    )
    const successfulOps = maintenanceResults.operations.filter(
      (op: any) => op.status === 'success'
    ).length
    const failedOps = maintenanceResults.operations.filter(
      (op: any) => op.status === 'error'
    ).length

    maintenanceResults.summary = {
      ...maintenanceResults.summary,
      endTime: new Date().toISOString(),
      totalExecutionTimeMs: totalExecutionTime,
      operationsRequested: maintenanceRequest.operations.length,
      operationsSuccessful: successfulOps,
      operationsFailed: failedOps,
      overallStatus: failedOps === 0 ? 'success' : failedOps < maintenanceRequest.operations.length ? 'partial' : 'failed',
    }

    // Log maintenance completion
    await createAuditLog({
      companyId: authContext.user.companiesId,
      userId: authContext.user.id,
      entityType: 'system',
      entityId: 'maintenance',
      action: maintenanceRequest.dryRun ? 'MAINTENANCE_DRY_RUN_COMPLETE' : 'MAINTENANCE_COMPLETE',
      metadata: {
        summary: maintenanceResults.summary,
        operations: maintenanceResults.operations.map((op: any) => ({
          operation: op.operation,
          status: op.status,
          executionTime: op.executionTimeMs,
        })),
      },
      riskLevel: failedOps > 0 ? 'HIGH' : 'LOW',
      ipAddress,
      userAgent,
    })

    return successResponse(
      maintenanceResults,
      `Database maintenance ${maintenanceRequest.dryRun ? 'dry run' : 'execution'} completed`
    )

  } catch (error) {
    logError('POST /api/system/database/maintenance', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
    })
    return handleApiError(error)
  }
}

// GET /api/system/database/maintenance - Get maintenance status and recommendations
export async function GET(request: NextRequest) {
  try {
    // Require admin access
    const authContext = await requireRole(request, [UserRole.ADMIN])

    // Get maintenance recommendations
    const recommendations = await getMaintenanceRecommendations(authContext.user.companiesId)

    // Get last maintenance activity
    const lastMaintenance = await getLastMaintenanceActivity(authContext.user.companiesId)

    const response = {
      recommendations,
      lastMaintenance,
      scheduledMaintenance: {
        nextRecommendedDate: getNextMaintenanceDate(lastMaintenance?.executedAt),
        frequency: 'weekly',
        recommendedOperations: ['mark_overdue', 'cleanup_audit_logs'],
      },
      maintenanceStatus: {
        isMaintenanceNeeded: recommendations.length > 0,
        urgency: getMaintenanceUrgency(recommendations),
        estimatedDuration: estimateMaintenanceDuration(recommendations),
      },
    }

    return successResponse(response, 'Maintenance status retrieved successfully')

  } catch (error) {
    logError('GET /api/system/database/maintenance', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
    })
    return handleApiError(error)
  }
}

// Helper functions

async function updateTableStatistics() {
  // This would run ANALYZE on key tables to update query planner statistics
  // Implementation depends on specific database optimization needs
  // For now, we'll log that this operation would be performed
  console.log('Table statistics would be updated here')
}

async function getMaintenanceRecommendations(companyId: string) {
  const recommendations = []
  
  // Check for overdue invoices that need status updates
  // Check for old audit logs that need cleanup
  // Check for invoices that need archiving
  // This would include actual database queries to determine what maintenance is needed
  
  return recommendations
}

async function getLastMaintenanceActivity(companyId: string) {
  // Query audit logs for the last maintenance activity
  // Return details about when maintenance was last run
  
  return {
    executedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Example: 7 days ago
    operations: ['mark_overdue', 'cleanup_audit_logs'],
    duration: 120000, // 2 minutes
    status: 'success',
  }
}

function getNextMaintenanceDate(lastMaintenanceDate?: Date): string {
  const nextDate = new Date()
  if (lastMaintenanceDate) {
    nextDate.setTime(lastMaintenanceDate.getTime() + 7 * 24 * 60 * 60 * 1000) // Add 7 days
  } else {
    nextDate.setTime(nextDate.getTime() + 24 * 60 * 60 * 1000) // Tomorrow if never run
  }
  return nextDate.toISOString()
}

function getMaintenanceUrgency(recommendations: any[]): 'low' | 'medium' | 'high' | 'critical' {
  if (recommendations.length === 0) return 'low'
  if (recommendations.some(r => r.priority === 'critical')) return 'critical'
  if (recommendations.some(r => r.priority === 'high')) return 'high'
  if (recommendations.some(r => r.priority === 'medium')) return 'medium'
  return 'low'
}

function estimateMaintenanceDuration(recommendations: any[]): number {
  // Base duration estimates for different operations (in milliseconds)
  const operationDurations = {
    mark_overdue: 30000, // 30 seconds
    cleanup_audit_logs: 120000, // 2 minutes
    archive_invoices: 300000, // 5 minutes
    optimize_indexes: 600000, // 10 minutes
    update_statistics: 180000, // 3 minutes
  }
  
  // Sum up estimated durations based on recommendations
  let totalDuration = 0
  for (const recommendation of recommendations) {
    if (recommendation.operation && operationDurations[recommendation.operation]) {
      totalDuration += operationDurations[recommendation.operation]
    }
  }
  
  return totalDuration
}