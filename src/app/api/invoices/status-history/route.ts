/**
 * Invoice Status History API
 * Comprehensive status change tracking and reporting system
 * 
 * Features:
 * - Complete audit trail for status changes
 * - Advanced filtering and search capabilities
 * - Business analytics and insights
 * - UAE compliance reporting
 * - Export capabilities
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { z } from 'zod'
import { Decimal } from 'decimal.js'

// Query parameters validation schema
const statusHistoryQuerySchema = z.object({
  // Filtering options
  invoiceId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  customerEmail: z.string().email().optional(),
  fromStatus: z.nativeEnum(InvoiceStatus).optional(),
  toStatus: z.nativeEnum(InvoiceStatus).optional(),
  userId: z.string().uuid().optional(),
  automatedOnly: z.string().transform(val => val === 'true').optional(),
  manualOnly: z.string().transform(val => val === 'true').optional(),
  
  // Date range filtering
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  
  // Pagination
  page: z.string().transform(val => parseInt(val, 10)).default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val, 10), 1000)).default('50'),
  
  // Sorting
  sortBy: z.enum(['createdAt', 'invoiceNumber', 'amount', 'customerName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Additional options
  includeMetadata: z.string().transform(val => val === 'true').default('false'),
  includeBusinessContext: z.string().transform(val => val === 'true').default('false'),
  export: z.enum(['csv', 'xlsx', 'pdf']).optional()
})

/**
 * GET /api/invoices/status-history
 * Retrieve comprehensive status change history with advanced filtering
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    
    // Parse and validate query parameters
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const {
      invoiceId,
      invoiceNumber,
      customerEmail,
      fromStatus,
      toStatus,
      userId,
      automatedOnly,
      manualOnly,
      dateFrom,
      dateTo,
      page,
      limit,
      sortBy,
      sortOrder,
      includeMetadata,
      includeBusinessContext,
      export: exportFormat
    } = statusHistoryQuerySchema.parse(queryParams)

    // Build comprehensive filter conditions
    const whereConditions: any = {
      companyId: authContext.user.companiesId, // Enforce company isolation
      type: 'invoice_status_updated'
    }

    // Apply filters
    if (invoiceId) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['invoiceId'],
        equals: invoiceId
      }
    }

    if (invoiceNumber) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['invoiceNumber'],
        string_contains: invoiceNumber
      }
    }

    if (customerEmail) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['customerEmail'],
        string_contains: customerEmail
      }
    }

    if (fromStatus) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['previousStatus'],
        equals: fromStatus
      }
    }

    if (toStatus) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['newStatus'],
        equals: toStatus
      }
    }

    if (userId) {
      whereConditions.userId = userId
    }

    if (automatedOnly) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['automatedChange'],
        equals: true
      }
    }

    if (manualOnly) {
      whereConditions.metadata = {
        ...whereConditions.metadata,
        path: ['automatedChange'],
        equals: false
      }
    }

    if (dateFrom || dateTo) {
      whereConditions.createdAt = {}
      if (dateFrom) whereConditions.createdAt.gte = new Date(dateFrom)
      if (dateTo) whereConditions.createdAt.lte = new Date(dateTo)
    }

    // Handle export requests
    if (exportFormat) {
      return await handleStatusHistoryExport(
        whereConditions,
        exportFormat,
        authContext.user.companiesId,
        sortBy,
        sortOrder
      )
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get total count for pagination
    const totalCount = await prisma.activities.count({ where: whereConditions })

    // Fetch status history with related data
    const statusHistory = await prisma.activities.findMany({
      where: whereConditions,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        [sortBy === 'invoiceNumber' || sortBy === 'amount' || sortBy === 'customerName' ? 'createdAt' : sortBy]: sortOrder
      },
      skip,
      take: limit
    })

    // Enrich status history with business insights
    const enrichedHistory = await Promise.all(
      statusHistory.map(async (entry) => {
        const baseEntry = {
          id: entry.id,
          invoiceId: entry.metadata.invoiceId as string,
          invoiceNumber: entry.metadata.invoiceNumber as string,
          customerName: entry.metadata.customerName as string,
          customerEmail: entry.metadata.customerEmail as string,
          previousStatus: entry.metadata.previousStatus as InvoiceStatus,
          newStatus: entry.metadata.newStatus as InvoiceStatus,
          reason: entry.metadata.reason as string,
          notes: entry.metadata.notes as string,
          changedAt: entry.createdAt,
          changedBy: {
            id: entry.users?.id,
            name: entry.users?.name || 'System',
            email: entry.users?.email,
            role: entry.users?.role
          },
          automatedChange: entry.metadata.automatedChange as boolean,
          complianceFlags: entry.metadata.complianceFlags as string[],
          ...(includeMetadata && {
            metadata: {
              userAgent: entry.metadata.userAgent,
              ipAddress: entry.metadata.ipAddress,
              apiEndpoint: entry.metadata.apiEndpoint,
              batchOperation: entry.metadata.batchOperation,
              totalAmount: entry.metadata.totalAmount,
              daysFromDue: entry.metadata.daysFromDue,
              paymentCount: entry.metadata.paymentCount
            }
          })
        }

        // Add business context if requested
        if (includeBusinessContext && entry.metadata.invoiceId) {
          const businessContext = await getBusinessContext(entry.metadata.invoiceId as string)
          return {
            ...baseEntry,
            businessContext
          }
        }

        return baseEntry
      })
    )

    // Calculate analytics and insights
    const analytics = calculateStatusHistoryAnalytics(statusHistory)

    // Build response
    const response = {
      statusHistory: enrichedHistory,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrevious: page > 1
      },
      analytics,
      filters: {
        applied: Object.keys(queryParams).filter(key => queryParams[key] !== undefined),
        companyId: authContext.user.companiesId
      }
    }

    return successResponse(response, 'Status history retrieved successfully')

  } catch (error) {
    logError('GET /api/invoices/status-history', error, {
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId'
    })
    return handleApiError(error)
  }
}

/**
 * POST /api/invoices/status-history
 * Advanced analytics and reporting for status changes
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    const body = await request.json()
    const {
      reportType = 'summary',
      dateRange,
      groupBy = 'status',
      includeBusinessMetrics = true
    } = body

    let startDate, endDate
    if (dateRange) {
      startDate = new Date(dateRange.from)
      endDate = new Date(dateRange.to)
    } else {
      // Default to last 30 days
      endDate = new Date()
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }

    const analytics = await generateAdvancedStatusAnalytics(
      authContext.user.companiesId,
      startDate,
      endDate,
      reportType,
      groupBy,
      includeBusinessMetrics
    )

    return successResponse({
      analytics,
      reportParameters: {
        companyId: authContext.user.companiesId,
        reportType,
        dateRange: { from: startDate, to: endDate },
        groupBy,
        includeBusinessMetrics,
        generatedAt: new Date()
      }
    }, 'Advanced status analytics generated successfully')

  } catch (error) {
    logError('POST /api/invoices/status-history', error)
    return handleApiError(error)
  }
}

// Helper Functions

/**
 * Get current business context for an invoice
 */
async function getBusinessContext(invoiceId: string) {
  const invoice = await prisma.invoices.findUnique({
    where: { id: invoiceId },
    include: {
      payments: { select: { amount: true, paymentDate: true } },
      customers: { select: { name: true, email: true } }
    }
  })

  if (!invoice) return null

  const paidAmount = invoice.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Decimal(0)
  )
  const remainingAmount = new Decimal(invoice.totalAmount || invoice.amount).minus(paidAmount)
  const isOverdue = invoice.dueDate < new Date() && 
    ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)

  return {
    currentStatus: invoice.status,
    totalAmount: invoice.totalAmount || invoice.amount,
    paidAmount: paidAmount.toNumber(),
    remainingAmount: remainingAmount.toNumber(),
    isOverdue,
    daysPastDue: isOverdue ? 
      Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
    paymentCount: invoice.payments.length,
    formattedAmounts: {
      total: formatUAECurrency(new Decimal(invoice.totalAmount || invoice.amount), invoice.currency),
      paid: formatUAECurrency(paidAmount, invoice.currency),
      remaining: formatUAECurrency(remainingAmount, invoice.currency)
    }
  }
}

/**
 * Calculate analytics from status history
 */
function calculateStatusHistoryAnalytics(statusHistory: any[]) {
  const analytics = {
    totalChanges: statusHistory.length,
    automatedChanges: statusHistory.filter(h => h.metadata.automatedChange).length,
    manualChanges: statusHistory.filter(h => !h.metadata.automatedChange).length,
    
    // Status transition breakdown
    statusTransitions: {} as Record<string, number>,
    
    // User activity
    userActivity: {} as Record<string, number>,
    
    // Time-based analysis
    changeFrequency: {
      thisWeek: 0,
      thisMonth: 0,
      lastMonth: 0
    },
    
    // Compliance metrics
    complianceFlags: {} as Record<string, number>
  }

  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  statusHistory.forEach(entry => {
    // Status transitions
    const transition = `${entry.metadata.previousStatus}->${entry.metadata.newStatus}`
    analytics.statusTransitions[transition] = (analytics.statusTransitions[transition] || 0) + 1

    // User activity
    const userName = entry.users?.name || 'System'
    analytics.userActivity[userName] = (analytics.userActivity[userName] || 0) + 1

    // Time-based frequency
    const changeDate = new Date(entry.createdAt)
    if (changeDate >= oneWeekAgo) analytics.changeFrequency.thisWeek++
    if (changeDate >= oneMonthAgo) analytics.changeFrequency.thisMonth++
    if (changeDate >= twoMonthsAgo && changeDate < oneMonthAgo) analytics.changeFrequency.lastMonth++

    // Compliance flags
    const flags = entry.metadata.complianceFlags as string[] || []
    flags.forEach(flag => {
      analytics.complianceFlags[flag] = (analytics.complianceFlags[flag] || 0) + 1
    })
  })

  return analytics
}

/**
 * Generate advanced analytics report
 */
async function generateAdvancedStatusAnalytics(
  companyId: string,
  startDate: Date,
  endDate: Date,
  reportType: string,
  groupBy: string,
  includeBusinessMetrics: boolean
) {
  const whereConditions = {
    companyId,
    type: 'invoice_status_updated',
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  }

  const statusHistory = await prisma.activities.findMany({
    where: whereConditions,
    include: {
      users: { select: { name: true, role: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const analytics: any = {
    summary: {
      totalStatusChanges: statusHistory.length,
      automatedChanges: statusHistory.filter(h => h.metadata.automatedChange).length,
      manualChanges: statusHistory.filter(h => !h.metadata.automatedChange).length,
      uniqueInvoices: new Set(statusHistory.map(h => h.metadata.invoiceId)).size,
      uniqueUsers: new Set(statusHistory.map(h => h.userId)).size
    }
  }

  // Group by analysis
  if (groupBy === 'status') {
    analytics.statusBreakdown = {}
    Object.values(InvoiceStatus).forEach(status => {
      analytics.statusBreakdown[status] = statusHistory.filter(
        h => h.metadata.newStatus === status
      ).length
    })
  } else if (groupBy === 'user') {
    analytics.userBreakdown = {}
    statusHistory.forEach(entry => {
      const userName = entry.users?.name || 'System'
      analytics.userBreakdown[userName] = (analytics.userBreakdown[userName] || 0) + 1
    })
  } else if (groupBy === 'time') {
    analytics.timeBreakdown = {}
    // Group by day, week, or month based on date range
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const timeUnit = daysDiff <= 7 ? 'day' : daysDiff <= 60 ? 'week' : 'month'
    
    statusHistory.forEach(entry => {
      const date = new Date(entry.createdAt)
      let timeKey: string
      
      if (timeUnit === 'day') {
        timeKey = date.toISOString().split('T')[0]
      } else if (timeUnit === 'week') {
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()))
        timeKey = weekStart.toISOString().split('T')[0]
      } else {
        timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
      
      analytics.timeBreakdown[timeKey] = (analytics.timeBreakdown[timeKey] || 0) + 1
    })
  }

  // Business metrics if requested
  if (includeBusinessMetrics) {
    let totalAmountAffected = 0
    let overdueAmountAffected = 0
    let paidAmountAffected = 0

    statusHistory.forEach(entry => {
      const amount = parseFloat(entry.metadata.totalAmount as string) || 0
      totalAmountAffected += amount

      if (entry.metadata.newStatus === InvoiceStatus.OVERDUE) {
        overdueAmountAffected += amount
      } else if (entry.metadata.newStatus === InvoiceStatus.PAID) {
        paidAmountAffected += amount
      }
    })

    analytics.businessMetrics = {
      totalAmountAffected,
      overdueAmountAffected,
      paidAmountAffected,
      formattedAmounts: {
        total: formatUAECurrency(new Decimal(totalAmountAffected), 'AED'),
        overdue: formatUAECurrency(new Decimal(overdueAmountAffected), 'AED'),
        paid: formatUAECurrency(new Decimal(paidAmountAffected), 'AED')
      }
    }
  }

  return analytics
}

/**
 * Handle export requests for status history
 */
async function handleStatusHistoryExport(
  whereConditions: any,
  format: string,
  companyId: string,
  sortBy: string,
  sortOrder: string
) {
  // For now, return a placeholder response
  // In a full implementation, this would generate actual file exports
  return successResponse({
    exportRequested: true,
    format,
    estimatedRecords: await prisma.activities.count({ where: whereConditions }),
    downloadUrl: `/api/invoices/status-history/download?format=${format}&companyId=${companyId}`,
    message: 'Export will be generated and download link will be provided'
  }, `Status history export (${format}) requested successfully`)
}