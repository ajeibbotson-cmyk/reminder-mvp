import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import {
  invoiceFiltersSchema,
  validateQueryParams
} from '@/lib/validations'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'

// GET /api/invoices - Fetch invoices with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams

    // Handle empty status parameter before validation
    const params = Object.fromEntries(searchParams.entries())
    if (params.status === '') {
      delete params.status
    }

    const filters = invoiceFiltersSchema.parse(params)

    // Company ID comes from authenticated session, not query parameters
    const companyId = authContext.user.companyId

    const skip = (filters.page - 1) * filters.limit

    // Build comprehensive where clause with optimized filters for UAE business
    const where: Record<string, unknown> = {
      company_id: companyId, // Company-level data isolation
    }

    // Status filtering with enum validation
    if (filters.status) {
      where.status = filters.status
    }

    // Customer email filtering
    if (filters.customerEmail) {
      where.customer_email = {
        equals: filters.customerEmail,
        mode: 'insensitive'
      }
    }

    // Date range filtering (invoice creation or due dates)
    if (filters.startDate && filters.endDate) {
      where.created_at = {
        gte: filters.startDate,
        lte: filters.endDate
      }
    } else if (filters.startDate) {
      where.created_at = { gte: filters.startDate }
    } else if (filters.endDate) {
      where.created_at = { lte: filters.endDate }
    }

    // Due date filtering for UAE payment terms
    if (filters.dueDateStart && filters.dueDateEnd) {
      where.due_date = {
        gte: filters.dueDateStart,
        lte: filters.dueDateEnd
      }
    } else if (filters.dueDateStart) {
      where.due_date = { gte: filters.dueDateStart }
    } else if (filters.dueDateEnd) {
      where.due_date = { lte: filters.dueDateEnd }
    }

    // Amount filtering with Decimal support
    if (filters.minAmount || filters.maxAmount) {
      where.total_amount = {}
      if (filters.minAmount) where.total_amount.gte = new Decimal(filters.minAmount)
      if (filters.maxAmount) where.total_amount.lte = new Decimal(filters.maxAmount)
    }

    // Currency filtering (default to AED for UAE)
    if (filters.currency) {
      where.currency = filters.currency
    }

    // TRN filtering for UAE tax compliance
    if (filters.trnNumber) {
      where.trn_number = {
        contains: filters.trnNumber,
        mode: 'insensitive'
      }
    }

    // Comprehensive search across multiple fields (English and Arabic)
    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { customer_name: { contains: filters.search, mode: 'insensitive' } },
        { customer_email: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { description_ar: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { notes_ar: { contains: filters.search, mode: 'insensitive' } },
        { trn_number: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    // Advanced filtering for overdue invoices (UAE business logic)
    if (filters.isOverdue) {
      where.AND = [
        { status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } },
        { due_date: { lt: new Date() } }
      ]
    }

    // Filter by payment status
    if (filters.hasPayments !== undefined) {
      where.payments = filters.hasPayments ? { some: {} } : { none: {} }
    }

    // Determine sorting order
    const orderBy = getInvoiceOrderBy(filters.sortBy, filters.sortOrder)

    // Execute optimized queries in parallel for better performance
    const [invoices, totalCount, statusCounts] = await Promise.all([
      prisma.invoices.findMany({
        where,
        include: {
          customers: {
            select: {
              id: true,
              name: true,
              name_ar: true,
              email: true,
              phone: true,
              payment_terms: true
            }
          },
          companies: {
            select: {
              id: true,
              name: true,
              trn: true,
              default_vat_rate: true
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              payment_date: true,
              method: true,
              reference: true
            },
            orderBy: { payment_date: 'desc' },
            take: filters.includeAllPayments ? undefined : 5
          },
          invoice_items: {
            select: {
              id: true,
              description: true,
              description_ar: true,
              quantity: true,
              unit_price: true,
              total: true,
              vat_rate: true,
              vat_amount: true,
              total_with_vat: true,
              tax_category: true
            },
            orderBy: { created_at: 'asc' }
          },
          follow_up_logs: {
            select: {
              id: true,
              step_number: true,
              email_address: true,
              subject: true,
              sent_at: true,
              email_opened: true,
              response_received: true,
              delivery_status: true
            },
            orderBy: { sent_at: 'desc' },
            take: 3
          },
          import_batches: {
            select: {
              id: true,
              original_filename: true,
              status: true,
              created_at: true
            }
          },
          email_logs: {
            select: {
              id: true,
              subject: true,
              delivery_status: true,
              sent_at: true,
              delivered_at: true,
              opened_at: true
            },
            orderBy: { created_at: 'desc' },
            take: 3
          }
        },
        orderBy,
        skip,
        take: filters.limit
      }),
      // Total count for pagination
      prisma.invoices.count({ where }),
      // Status breakdown for dashboard insights
      prisma.invoices.groupBy({
        by: ['status'],
        where: {
          company_id: companyId
        },
        _count: {
          status: true
        }
      })
    ])

    // Calculate additional insights for UAE business needs
    const insights = await calculateInvoiceInsights(invoices, authContext.user.companyId)

    // Enhanced response with UAE business insights
    return successResponse({
      invoices: invoices.map(invoice => ({
        ...invoice,
        // Add computed fields for UAE business logic
        isOverdue: invoice.dueDate < new Date() && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status),
        daysPastDue: invoice.dueDate < new Date() ? Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        paidAmount: invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0)),
        remainingAmount: new Decimal(invoice.totalAmount || invoice.amount).minus(
          invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0))
        ),
        formattedAmounts: {
          subtotal: formatUAECurrency(invoice.subtotal || 0, invoice.currency),
          vatAmount: formatUAECurrency(invoice.vatAmount || 0, invoice.currency),
          totalAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency)
        }
      })),
      pagination: {
        totalCount,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(totalCount / filters.limit),
        hasMore: skip + invoices.length < totalCount,
        hasPrevious: filters.page > 1
      },
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<InvoiceStatus, number>),
      insights,
      filters: {
        applied: Object.keys(filters).filter(key =>
          filters[key] !== undefined && filters[key] !== null && filters[key] !== ''
        ),
        companyId: companyId
      }
    })

  } catch (error) {
    logError('GET /api/invoices', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}


// Helper function to determine invoice sorting order
function getInvoiceOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
  const order = sortOrder || 'desc'
  
  switch (sortBy) {
    case 'number':
      return { number: order }
    case 'customerName':
      return { customer_name: order }
    case 'amount':
      return { total_amount: order }
    case 'dueDate':
      return { due_date: order }
    case 'status':
      return { status: order }
    case 'updatedAt':
      return { updated_at: order }
    default:
      return { created_at: order }
  }
}

// Helper function to calculate UAE business insights
async function calculateInvoiceInsights(invoices: any[], companyId: string) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
  
  // Calculate totals and insights
  const totalOutstanding = invoices
    .filter(inv => ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(inv.status))
    .reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0))
  
  const totalOverdue = invoices
    .filter(inv => inv.dueDate < now && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(inv.status))
    .reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0))
  
  const recentInvoices = invoices
    .filter(inv => inv.created_at > thirtyDaysAgo)
    .length
  
  return {
    totalOutstanding: totalOutstanding.toNumber(),
    totalOverdue: totalOverdue.toNumber(),
    overdueCount: invoices.filter(inv => 
      inv.dueDate < now && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(inv.status)
    ).length,
    recentInvoicesCount: recentInvoices,
    averageAmount: invoices.length > 0 
      ? invoices.reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0)).div(invoices.length).toNumber()
      : 0,
    formatted: {
      totalOutstanding: formatUAECurrency(totalOutstanding),
      totalOverdue: formatUAECurrency(totalOverdue)
    }
  }
}

