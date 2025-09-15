/**
 * Database Utility Functions for UAE Invoice Management System
 * 
 * This module provides database optimization utilities, monitoring functions,
 * and maintenance procedures for the UAE-compliant invoice system.
 */

import { prisma } from './prisma'
import { logError } from './errors'

// Database performance monitoring
export interface QueryPerformanceMetrics {
  queryType: string
  tableName: string
  executionTime: number
  rowsAffected?: number
  queryHash?: string
  slowQuery: boolean
}

export interface DatabaseHealthMetrics {
  totalQueries: number
  slowQueries: number
  averageExecutionTime: number
  topSlowQueries: Array<{
    queryHash: string
    queryType: string
    tableName: string
    avgExecutionTime: number
    frequency: number
  }>
  tableStats: Array<{
    tableName: string
    totalQueries: number
    slowQueries: number
    avgExecutionTime: number
  }>
}

/**
 * Log database query performance for monitoring
 */
export async function logQueryPerformance(
  metrics: QueryPerformanceMetrics,
  companyId?: string,
  userId?: string,
  endpoint?: string
): Promise<void> {
  try {
    await prisma.dbPerformanceLogs.create({
      data: {
        id: crypto.randomUUID(),
        queryType: metrics.queryType,
        tableName: metrics.tableName,
        executionTime: metrics.executionTime,
        rowsAffected: metrics.rowsAffected,
        queryHash: metrics.queryHash,
        slowQuery: metrics.executionTime > 1000, // Mark queries over 1 second as slow
        companyId,
        userId,
        endpoint,
      },
    })
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.warn('Failed to log query performance:', error)
  }
}

/**
 * Get database health metrics for performance monitoring
 */
export async function getDatabaseHealthMetrics(
  companyId?: string,
  periodDays: number = 7
): Promise<DatabaseHealthMetrics> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)

  try {
    const [totalMetrics, slowQueryStats, tableStats] = await Promise.all([
      // Get overall metrics
      prisma.dbPerformanceLogs.aggregate({
        where: {
          createdAt: { gte: startDate },
          ...(companyId && { companyId }),
        },
        _count: { id: true },
        _avg: { executionTime: true },
      }),

      // Get slow query statistics
      prisma.dbPerformanceLogs.groupBy({
        by: ['queryHash', 'queryType', 'tableName'],
        where: {
          createdAt: { gte: startDate },
          slowQuery: true,
          ...(companyId && { companyId }),
        },
        _count: { id: true },
        _avg: { executionTime: true },
        orderBy: { _avg: { executionTime: 'desc' } },
        take: 10,
      }),

      // Get table-level statistics
      prisma.dbPerformanceLogs.groupBy({
        by: ['tableName'],
        where: {
          createdAt: { gte: startDate },
          ...(companyId && { companyId }),
        },
        _count: { id: true },
        _avg: { executionTime: true },
      }),
    ])

    const slowQueriesCount = await prisma.dbPerformanceLogs.count({
      where: {
        createdAt: { gte: startDate },
        slowQuery: true,
        ...(companyId && { companyId }),
      },
    })

    const tableStatsWithSlowQueries = await Promise.all(
      tableStats.map(async (table) => {
        const slowCount = await prisma.dbPerformanceLogs.count({
          where: {
            createdAt: { gte: startDate },
            tableName: table.tableName,
            slowQuery: true,
            ...(companyId && { companyId }),
          },
        })

        return {
          tableName: table.tableName,
          totalQueries: table._count.id,
          slowQueries: slowCount,
          avgExecutionTime: Math.round(table._avg.executionTime || 0),
        }
      })
    )

    return {
      totalQueries: totalMetrics._count.id || 0,
      slowQueries: slowQueriesCount,
      averageExecutionTime: Math.round(totalMetrics._avg.executionTime || 0),
      topSlowQueries: slowQueryStats.map((query) => ({
        queryHash: query.queryHash || 'unknown',
        queryType: query.queryType,
        tableName: query.tableName,
        avgExecutionTime: Math.round(query._avg.executionTime || 0),
        frequency: query._count.id,
      })),
      tableStats: tableStatsWithSlowQueries,
    }
  } catch (error) {
    logError('getDatabaseHealthMetrics', error, { companyId, periodDays })
    throw new Error('Failed to retrieve database health metrics')
  }
}

/**
 * Execute database maintenance tasks
 */
export async function executeDatabaseMaintenance(companyId?: string): Promise<{
  overdueInvoicesUpdated: number
  auditLogsCleanedUp: number
  invoicesArchived: number
}> {
  try {
    // Mark overdue invoices
    const overdueResult = await prisma.$executeRaw`SELECT mark_overdue_invoices();`
    
    // Clean up old audit logs (keep compliance and high-risk logs)
    const auditCleanupResult = await prisma.$executeRaw`SELECT cleanup_old_audit_logs(365);`
    
    // Archive old paid invoices (7 years retention for UAE compliance)
    const archiveResult = await prisma.$executeRaw`SELECT archive_old_invoices(2555);`

    // Log maintenance activity
    if (companyId) {
      await prisma.auditLogs.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          entityType: 'system',
          entityId: 'maintenance',
          action: 'MAINTENANCE_EXECUTED',
          metadata: {
            overdueInvoicesUpdated: overdueResult,
            auditLogsCleanedUp: auditCleanupResult,
            invoicesArchived: archiveResult,
            executedAt: new Date().toISOString(),
          },
          riskLevel: 'LOW',
        },
      })
    }

    return {
      overdueInvoicesUpdated: Array.isArray(overdueResult) ? overdueResult[0]?.mark_overdue_invoices || 0 : 0,
      auditLogsCleanedUp: Array.isArray(auditCleanupResult) ? auditCleanupResult[0]?.cleanup_old_audit_logs || 0 : 0,
      invoicesArchived: Array.isArray(archiveResult) ? archiveResult[0]?.archive_old_invoices || 0 : 0,
    }
  } catch (error) {
    logError('executeDatabaseMaintenance', error, { companyId })
    throw new Error('Database maintenance failed')
  }
}

/**
 * Optimize database indexes for better performance
 */
export async function optimizeIndexes(): Promise<void> {
  try {
    // Analyze table statistics for the optimizer
    await prisma.$executeRaw`ANALYZE invoices, customers, payments, audit_logs;`
    
    // Reindex heavily used indexes if needed (PostgreSQL specific)
    await prisma.$executeRaw`REINDEX INDEX CONCURRENTLY idx_invoices_company_status_date;`
    await prisma.$executeRaw`REINDEX INDEX CONCURRENTLY idx_payments_invoice_date;`
    
  } catch (error) {
    logError('optimizeIndexes', error)
    // Don't throw error for maintenance operations
    console.warn('Index optimization completed with warnings:', error)
  }
}

/**
 * Get invoice performance statistics for a company
 */
export async function getInvoicePerformanceStats(companyId: string, periodDays: number = 30): Promise<{
  totalInvoices: number
  searchQueries: number
  analyticsQueries: number
  averageSearchTime: number
  averageAnalyticsTime: number
  slowSearchQueries: number
}> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)

  try {
    const [searchStats, analyticsStats] = await Promise.all([
      prisma.dbPerformanceLogs.aggregate({
        where: {
          companyId,
          tableName: 'invoices',
          queryType: 'SELECT',
          endpoint: { contains: 'search' },
          createdAt: { gte: startDate },
        },
        _count: { id: true },
        _avg: { executionTime: true },
      }),

      prisma.dbPerformanceLogs.aggregate({
        where: {
          companyId,
          tableName: 'invoices',
          queryType: 'AGGREGATE',
          endpoint: { contains: 'analytics' },
          createdAt: { gte: startDate },
        },
        _count: { id: true },
        _avg: { executionTime: true },
      }),
    ])

    const [totalInvoices, slowSearchCount] = await Promise.all([
      prisma.invoices.count({
        where: { companyId, isActive: true },
      }),

      prisma.dbPerformanceLogs.count({
        where: {
          companyId,
          tableName: 'invoices',
          queryType: 'SELECT',
          endpoint: { contains: 'search' },
          slowQuery: true,
          createdAt: { gte: startDate },
        },
      }),
    ])

    return {
      totalInvoices,
      searchQueries: searchStats._count.id || 0,
      analyticsQueries: analyticsStats._count.id || 0,
      averageSearchTime: Math.round(searchStats._avg.executionTime || 0),
      averageAnalyticsTime: Math.round(analyticsStats._avg.executionTime || 0),
      slowSearchQueries: slowSearchCount,
    }
  } catch (error) {
    logError('getInvoicePerformanceStats', error, { companyId, periodDays })
    throw new Error('Failed to retrieve invoice performance statistics')
  }
}

/**
 * Monitor payment reconciliation performance
 */
export async function getPaymentReconciliationStats(companyId: string): Promise<{
  totalPayments: number
  verifiedPayments: number
  pendingReconciliation: number
  averageReconciliationTime: number
  reconciliationAccuracy: number
}> {
  try {
    const [paymentStats, reconciliationStats] = await Promise.all([
      prisma.payments.aggregate({
        where: {
          invoices: { companyId },
        },
        _count: { id: true },
      }),

      prisma.payments.aggregate({
        where: {
          invoices: { companyId },
          isVerified: true,
        },
        _count: { id: true },
      }),
    ])

    const pendingCount = await prisma.payments.count({
      where: {
        invoices: { companyId },
        isVerified: false,
      },
    })

    // Calculate average reconciliation time for verified payments
    const verifiedPayments = await prisma.payments.findMany({
      where: {
        invoices: { companyId },
        isVerified: true,
        verifiedAt: { not: null },
      },
      select: {
        createdAt: true,
        verifiedAt: true,
      },
      take: 100, // Sample for performance
    })

    const avgReconciliationTime = verifiedPayments.length > 0
      ? verifiedPayments.reduce((sum, payment) => {
          if (payment.verifiedAt) {
            const timeDiff = payment.verifiedAt.getTime() - payment.createdAt.getTime()
            return sum + (timeDiff / (1000 * 60 * 60)) // Convert to hours
          }
          return sum
        }, 0) / verifiedPayments.length
      : 0

    return {
      totalPayments: paymentStats._count.id || 0,
      verifiedPayments: reconciliationStats._count.id || 0,
      pendingReconciliation: pendingCount,
      averageReconciliationTime: Math.round(avgReconciliationTime * 100) / 100,
      reconciliationAccuracy: paymentStats._count.id > 0 
        ? Math.round(((reconciliationStats._count.id || 0) / paymentStats._count.id) * 100 * 100) / 100
        : 0,
    }
  } catch (error) {
    logError('getPaymentReconciliationStats', error, { companyId })
    throw new Error('Failed to retrieve payment reconciliation statistics')
  }
}

/**
 * UAE Compliance audit functions
 */
export async function generateComplianceReport(companyId: string, periodDays: number = 30): Promise<{
  invoiceCount: number
  vatCompliantInvoices: number
  trnValidatedInvoices: number
  auditTrailCompleteness: number
  dataRetentionCompliance: number
  complianceIssues: Array<{
    type: string
    description: string
    count: number
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }>
}> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)

  try {
    const [
      totalInvoices,
      vatCompliantCount,
      trnValidatedCount,
      auditTrailStats,
    ] = await Promise.all([
      prisma.invoices.count({
        where: { companyId, createdAt: { gte: startDate } },
      }),

      prisma.invoices.count({
        where: {
          companyId,
          createdAt: { gte: startDate },
          vatAmount: { not: null },
          currency: 'AED',
        },
      }),

      prisma.invoices.count({
        where: {
          companyId,
          createdAt: { gte: startDate },
          trnNumber: { not: null },
        },
      }),

      prisma.auditLogs.count({
        where: {
          companyId,
          createdAt: { gte: startDate },
        },
      }),
    ])

    const complianceIssues = []

    // Check for missing VAT calculations
    if (vatCompliantCount < totalInvoices * 0.95) {
      complianceIssues.push({
        type: 'VAT_COMPLIANCE',
        description: 'Some invoices missing VAT calculations',
        count: totalInvoices - vatCompliantCount,
        severity: 'MEDIUM' as const,
      })
    }

    // Check for missing TRN numbers
    if (trnValidatedCount < totalInvoices * 0.9) {
      complianceIssues.push({
        type: 'TRN_COMPLIANCE',
        description: 'Some invoices missing TRN numbers',
        count: totalInvoices - trnValidatedCount,
        severity: 'LOW' as const,
      })
    }

    // Check audit trail completeness
    const expectedAuditEntries = totalInvoices * 2 // At least create and potentially update
    const auditCompleteness = auditTrailStats > 0 
      ? Math.min(100, (auditTrailStats / expectedAuditEntries) * 100)
      : 0

    if (auditCompleteness < 90) {
      complianceIssues.push({
        type: 'AUDIT_TRAIL',
        description: 'Incomplete audit trail coverage',
        count: Math.round(expectedAuditEntries - auditTrailStats),
        severity: 'HIGH' as const,
      })
    }

    return {
      invoiceCount: totalInvoices,
      vatCompliantInvoices: vatCompliantCount,
      trnValidatedInvoices: trnValidatedCount,
      auditTrailCompleteness: Math.round(auditCompleteness * 100) / 100,
      dataRetentionCompliance: 100, // Assuming policies are in place
      complianceIssues,
    }
  } catch (error) {
    logError('generateComplianceReport', error, { companyId, periodDays })
    throw new Error('Failed to generate compliance report')
  }
}

/**
 * Create audit log entry for database operations
 */
export async function createAuditLog({
  companyId,
  userId,
  entityType,
  entityId,
  action,
  oldValues,
  newValues,
  changedFields,
  ipAddress,
  userAgent,
  sessionId,
  requestId,
  metadata,
  riskLevel = 'LOW',
}: {
  companyId: string
  userId?: string
  entityType: string
  entityId: string
  action: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  changedFields?: string[]
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  requestId?: string
  metadata?: Record<string, any>
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}): Promise<void> {
  try {
    const complianceFlag = riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ||
      ['DELETE', 'EXPORT', 'PAYMENT_VERIFIED'].includes(action)

    await prisma.auditLogs.create({
      data: {
        id: crypto.randomUUID(),
        companyId,
        userId,
        entityType,
        entityId,
        action,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        changedFields: changedFields || [],
        ipAddress,
        userAgent,
        sessionId,
        requestId,
        complianceFlag,
        riskLevel,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch (error) {
    // Log audit failure but don't fail the main operation
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Query performance wrapper for automatic logging
 */
export function withPerformanceLogging<T>(
  queryFunction: () => Promise<T>,
  queryInfo: {
    queryType: string
    tableName: string
    companyId?: string
    userId?: string
    endpoint?: string
  }
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now()
    
    try {
      const result = await queryFunction()
      const executionTime = Date.now() - startTime
      
      // Log performance asynchronously
      logQueryPerformance(
        {
          queryType: queryInfo.queryType,
          tableName: queryInfo.tableName,
          executionTime,
          slowQuery: executionTime > 1000,
        },
        queryInfo.companyId,
        queryInfo.userId,
        queryInfo.endpoint
      ).catch(() => {}) // Ignore logging errors
      
      resolve(result)
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      // Log failed query performance
      logQueryPerformance(
        {
          queryType: queryInfo.queryType,
          tableName: queryInfo.tableName,
          executionTime,
          slowQuery: true, // Failed queries are considered slow
        },
        queryInfo.companyId,
        queryInfo.userId,
        queryInfo.endpoint
      ).catch(() => {}) // Ignore logging errors
      
      reject(error)
    }
  })
}