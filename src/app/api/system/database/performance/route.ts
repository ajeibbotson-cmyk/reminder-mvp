import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'
import {
  getDatabaseHealthMetrics,
  getInvoicePerformanceStats,
  getPaymentReconciliationStats,
  generateComplianceReport,
} from '@/lib/database-utils'
import { z } from 'zod'

// Database performance query schema
const performanceQuerySchema = z.object({
  period: z.coerce.number().int().min(1).max(365).default(7),
  includeCompliance: z.coerce.boolean().default(false),
  includePayments: z.coerce.boolean().default(false),
  includeInvoices: z.coerce.boolean().default(true),
})

// GET /api/system/database/performance - Get database performance metrics
export async function GET(request: NextRequest) {
  try {
    // Require admin access for system monitoring
    const authContext = await requireRole(request, [UserRole.ADMIN])
    const searchParams = request.nextUrl.searchParams
    
    const query = performanceQuerySchema.parse(Object.fromEntries(searchParams.entries()))
    
    // Get overall database health metrics
    const healthMetrics = await getDatabaseHealthMetrics(
      authContext.user.companyId,
      query.period
    )

    // Prepare response data
    const responseData: any = {
      healthMetrics,
      metadata: {
        companyId: authContext.user.companyId,
        periodDays: query.period,
        generatedAt: new Date().toISOString(),
        requestedBy: authContext.user.id,
      },
    }

    // Include invoice performance stats if requested
    if (query.includeInvoices) {
      responseData.invoicePerformance = await getInvoicePerformanceStats(
        authContext.user.companyId,
        query.period
      )
    }

    // Include payment reconciliation stats if requested
    if (query.includePayments) {
      responseData.paymentReconciliation = await getPaymentReconciliationStats(
        authContext.user.companyId
      )
    }

    // Include compliance report if requested
    if (query.includeCompliance) {
      responseData.complianceReport = await generateComplianceReport(
        authContext.user.companyId,
        query.period
      )
    }

    // Generate performance insights
    const insights = generatePerformanceInsights(responseData)
    responseData.insights = insights

    return successResponse(responseData, 'Database performance metrics retrieved successfully')

  } catch (error) {
    logError('GET /api/system/database/performance', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    })
    return handleApiError(error)
  }
}

// Helper function to generate performance insights
function generatePerformanceInsights(data: any) {
  const insights = []

  // Database health insights
  if (data.healthMetrics) {
    const { totalQueries, slowQueries, averageExecutionTime } = data.healthMetrics

    if (slowQueries > totalQueries * 0.1) {
      insights.push({
        type: 'warning',
        category: 'performance',
        title: 'High Slow Query Rate',
        description: `${Math.round((slowQueries / totalQueries) * 100)}% of queries are slow (>${1000}ms). Consider query optimization.`,
        priority: 'high',
        actionable: true,
        recommendations: [
          'Review and optimize slow query patterns',
          'Check if additional indexes are needed',
          'Consider query result caching for frequent operations',
        ],
      })
    }

    if (averageExecutionTime > 500) {
      insights.push({
        type: 'warning',
        category: 'performance',
        title: 'High Average Query Time',
        description: `Average query execution time is ${averageExecutionTime}ms. Target should be under 200ms.`,
        priority: 'medium',
        actionable: true,
        recommendations: [
          'Analyze query execution plans',
          'Optimize database indexes',
          'Consider database connection pooling',
        ],
      })
    } else if (averageExecutionTime < 100) {
      insights.push({
        type: 'success',
        category: 'performance',
        title: 'Excellent Query Performance',
        description: `Average query time of ${averageExecutionTime}ms is excellent.`,
        priority: 'low',
        actionable: false,
      })
    }

    // Table-specific insights
    if (data.healthMetrics.tableStats) {
      const problematicTables = data.healthMetrics.tableStats.filter(
        (table: any) => table.slowQueries > table.totalQueries * 0.2
      )

      if (problematicTables.length > 0) {
        insights.push({
          type: 'warning',
          category: 'performance',
          title: 'Tables with Performance Issues',
          description: `Tables ${problematicTables.map((t: any) => t.tableName).join(', ')} have high slow query rates.`,
          priority: 'medium',
          actionable: true,
          recommendations: [
            'Review indexes on affected tables',
            'Consider table partitioning for large tables',
            'Optimize queries accessing these tables',
          ],
        })
      }
    }
  }

  // Invoice performance insights
  if (data.invoicePerformance) {
    const { totalInvoices, averageSearchTime, slowSearchQueries } = data.invoicePerformance

    if (totalInvoices > 10000 && averageSearchTime > 300) {
      insights.push({
        type: 'info',
        category: 'scalability',
        title: 'Large Dataset Performance',
        description: `With ${totalInvoices.toLocaleString()} invoices, search time of ${averageSearchTime}ms is within acceptable range but could be optimized.`,
        priority: 'medium',
        actionable: true,
        recommendations: [
          'Implement full-text search indexing',
          'Consider result pagination optimization',
          'Add search result caching',
        ],
      })
    }

    if (slowSearchQueries > 0) {
      insights.push({
        type: 'warning',
        category: 'user_experience',
        title: 'Slow Search Queries Detected',
        description: `${slowSearchQueries} search queries exceeded 1 second. This affects user experience.`,
        priority: 'high',
        actionable: true,
        recommendations: [
          'Optimize search query structure',
          'Add missing search indexes',
          'Implement search query result caching',
        ],
      })
    }
  }

  // Payment reconciliation insights
  if (data.paymentReconciliation) {
    const { reconciliationAccuracy, averageReconciliationTime, pendingReconciliation } = data.paymentReconciliation

    if (reconciliationAccuracy < 90) {
      insights.push({
        type: 'warning',
        category: 'financial',
        title: 'Low Payment Reconciliation Rate',
        description: `Only ${reconciliationAccuracy}% of payments are reconciled. This poses financial risk.`,
        priority: 'high',
        actionable: true,
        recommendations: [
          'Review payment verification processes',
          'Implement automated reconciliation rules',
          'Train staff on reconciliation procedures',
        ],
      })
    }

    if (averageReconciliationTime > 24) {
      insights.push({
        type: 'warning',
        category: 'operational',
        title: 'Slow Payment Reconciliation',
        description: `Average reconciliation time of ${averageReconciliationTime.toFixed(1)} hours is too slow.`,
        priority: 'medium',
        actionable: true,
        recommendations: [
          'Automate reconciliation workflows',
          'Implement real-time payment notifications',
          'Optimize bank integration processes',
        ],
      })
    }

    if (pendingReconciliation > 50) {
      insights.push({
        type: 'warning',
        category: 'operational',
        title: 'High Pending Reconciliation Count',
        description: `${pendingReconciliation} payments pending reconciliation. This creates financial reporting delays.`,
        priority: 'medium',
        actionable: true,
        recommendations: [
          'Process pending reconciliations immediately',
          'Review reconciliation workflow efficiency',
          'Consider batch processing improvements',
        ],
      })
    }
  }

  // Compliance insights
  if (data.complianceReport) {
    const { vatCompliantInvoices, invoiceCount, complianceIssues } = data.complianceReport

    if (vatCompliantInvoices < invoiceCount * 0.95) {
      insights.push({
        type: 'warning',
        category: 'compliance',
        title: 'VAT Compliance Issue',
        description: `${invoiceCount - vatCompliantInvoices} invoices missing proper VAT calculations. UAE requires VAT compliance.`,
        priority: 'high',
        actionable: true,
        recommendations: [
          'Update invoice templates to include VAT',
          'Train staff on UAE VAT requirements',
          'Implement automated VAT calculation validation',
        ],
      })
    }

    if (complianceIssues.some((issue: any) => issue.severity === 'CRITICAL')) {
      insights.push({
        type: 'error',
        category: 'compliance',
        title: 'Critical Compliance Issues',
        description: 'Critical compliance violations detected that require immediate attention.',
        priority: 'critical',
        actionable: true,
        recommendations: [
          'Address critical compliance issues immediately',
          'Consult legal/compliance team',
          'Implement corrective measures',
        ],
      })
    }
  }

  return insights
}