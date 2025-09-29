import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { validateQueryParams } from '@/lib/validations'
import { UserRole, Prisma } from '@prisma/client'
import { z } from 'zod'

// Analytics query schema
const analyticsSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  includeInactive: z.coerce.boolean().default(false),
  groupBy: z.enum(['month', 'quarter', 'year', 'businessType', 'paymentTerms']).default('month'),
  metrics: z.array(z.enum([
    'totalCustomers', 'activeCustomers', 'newCustomers', 'outstandingBalance', 
    'totalInvoiced', 'averageInvoiceValue', 'paymentBehavior', 'topCustomers'
  ])).default(['totalCustomers', 'outstandingBalance'])
})

// GET /api/customers/analytics - Customer analytics and reporting
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const filters = validateQueryParams(searchParams, analyticsSchema)
    
    // Ensure user can only access their company's data
    if (filters.companyId !== authContext.user.companiesId) {
      throw new Error('Access denied to company data')
    }

    // Set default date range if not provided
    const endDate = filters.endDate || new Date()
    const startDate = filters.startDate || new Date(endDate.getFullYear(), endDate.getMonth() - 12, 1)

    const baseWhereClause: Prisma.CustomerWhereInput = {
      companyId: authContext.user.companiesId,
      ...(filters.includeInactive ? {} : { isActive: true })
    }

    const analytics: any = {}

    // Execute analytics queries in parallel for better performance
    const queries = []

    // Total and Active Customers
    if (filters.metrics.includes('totalCustomers') || filters.metrics.includes('activeCustomers')) {
      queries.push(
        prisma.customers.aggregate({
          where: baseWhereClause,
          _count: { id: true }
        }).then(result => ({ totalCustomers: result._count.id }))
      )

      queries.push(
        prisma.customers.aggregate({
          where: {
            ...baseWhereClause,
            isActive: true
          },
          _count: { id: true }
        }).then(result => ({ activeCustomers: result._count.id }))
      )
    }

    // New Customers in period
    if (filters.metrics.includes('newCustomers')) {
      queries.push(
        prisma.customers.aggregate({
          where: {
            ...baseWhereClause,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _count: { id: true }
        }).then(result => ({ newCustomers: result._count.id }))
      )
    }

    // Outstanding Balance calculations
    if (filters.metrics.includes('outstandingBalance')) {
      queries.push(
        prisma.invoices.aggregate({
          where: {
            companyId: authContext.user.companiesId,
            isActive: true,
            status: { in: ['SENT', 'OVERDUE', 'DISPUTED'] },
            payments: { none: {} }
          },
          _sum: { totalAmount: true },
          _count: { id: true }
        }).then(result => ({ 
          outstandingBalance: result._sum.totalAmount || 0,
          outstandingInvoiceCount: result._count.id
        }))
      )
    }

    // Total Invoiced and Average Invoice Value
    if (filters.metrics.includes('totalInvoiced') || filters.metrics.includes('averageInvoiceValue')) {
      queries.push(
        prisma.invoices.aggregate({
          where: {
            companyId: authContext.user.companiesId,
            isActive: true,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { totalAmount: true },
          _avg: { totalAmount: true },
          _count: { id: true }
        }).then(result => ({ 
          totalInvoiced: result._sum.totalAmount || 0,
          averageInvoiceValue: result._avg.totalAmount || 0,
          totalInvoiceCount: result._count.id
        }))
      )
    }

    // Payment Behavior Analysis
    if (filters.metrics.includes('paymentBehavior')) {
      queries.push(
        prisma.$queryRaw<{ payment_behavior: string; count: number; avg_days: number }[]>`
          SELECT 
            CASE 
              WHEN AVG(EXTRACT(day FROM (p.payment_date - i.created_at))) <= i.payment_terms THEN 'on_time'
              WHEN AVG(EXTRACT(day FROM (p.payment_date - i.created_at))) <= i.payment_terms + 15 THEN 'late'
              ELSE 'very_late'
            END as payment_behavior,
            COUNT(DISTINCT c.id) as count,
            AVG(EXTRACT(day FROM (p.payment_date - i.created_at))) as avg_days
          FROM customers c
          JOIN invoices i ON i.customer_email = c.email AND i.company_id = c.company_id
          JOIN payments p ON p.invoice_id = i.id
          WHERE c.company_id = ${authContext.user.companiesId}
            AND c.is_active = ${!filters.includeInactive ? true : undefined}
            AND i.is_active = true
            AND i.status = 'PAID'
            AND i.created_at >= ${startDate}
            AND i.created_at <= ${endDate}
          GROUP BY c.id, i.payment_terms
        `.then(result => ({ paymentBehavior: result }))
      )
    }

    // Top Customers by Revenue
    if (filters.metrics.includes('topCustomers')) {
      queries.push(
        prisma.customers.findMany({
          where: baseWhereClause,
          include: {
            invoices: {
              where: {
                isActive: true,
                createdAt: {
                  gte: startDate,
                  lte: endDate
                }
              },
              select: {
                totalAmount: true,
                amount: true,
                status: true
              }
            }
          },
          take: 10
        }).then(customers => {
          const topCustomers = customers.map(customer => {
            const totalRevenue = customer.invoices.reduce((sum, invoice) => 
              sum + (invoice.totalAmount || invoice.amount), 0
            )
            const invoiceCount = customer.invoices.length
            return {
              id: customer.id,
              name: customer.name,
              nameAr: customer.nameAr,
              email: customer.email,
              totalRevenue,
              invoiceCount,
              averageInvoiceValue: invoiceCount > 0 ? totalRevenue / invoiceCount : 0
            }
          }).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10)
          
          return { topCustomers }
        })
      )
    }

    // Execute all queries
    const results = await Promise.all(queries)
    
    // Merge results
    results.forEach(result => Object.assign(analytics, result))

    // Time-series data based on groupBy parameter
    let timeSeriesData = []
    if (filters.groupBy === 'month') {
      timeSeriesData = await generateMonthlyCustomerMetrics(
        authContext.user.companiesId, 
        startDate, 
        endDate, 
        filters.includeInactive
      )
    } else if (filters.groupBy === 'businessType') {
      // Business type analysis would require schema updates
      timeSeriesData = await generateBusinessTypeMetrics(
        authContext.user.companiesId, 
        filters.includeInactive
      )
    } else if (filters.groupBy === 'paymentTerms') {
      timeSeriesData = await generatePaymentTermsMetrics(
        authContext.user.companiesId, 
        filters.includeInactive
      )
    }

    // Customer growth metrics
    const customerGrowthData = await generateCustomerGrowthMetrics(
      authContext.user.companiesId,
      startDate,
      endDate,
      filters.includeInactive
    )

    const responseTime = Date.now() - startTime

    // Log slow analytics queries
    if (responseTime > 600) {
      logError('GET /api/customers/analytics - Slow query', 
        new Error(`Analytics query took ${responseTime}ms`), 
        { 
          userId: authContext.user.id,
          metrics: filters.metrics,
          groupBy: filters.groupBy,
          responseTime
        }
      )
    }

    return successResponse({
      ...analytics,
      timeSeriesData,
      customerGrowthData,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy: filters.groupBy
      },
      responseTime
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('GET /api/customers/analytics', error, { 
      userId: 'authContext.user?.id',
      responseTime,
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// Helper function to generate monthly customer metrics
async function generateMonthlyCustomerMetrics(
  companyId: string, 
  startDate: Date, 
  endDate: Date, 
  includeInactive: boolean
) {
  try {
    const monthlyData = await prisma.$queryRaw<{
      month: string;
      year: number;
      new_customers: number;
      total_customers: number;
      total_revenue: number;
      avg_invoice_value: number;
    }[]>`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', c.created_at), 'Month') as month,
        EXTRACT(year FROM c.created_at) as year,
        COUNT(c.id) as new_customers,
        (
          SELECT COUNT(*) 
          FROM customers c2 
          WHERE c2.company_id = ${companyId}
            AND c2.created_at <= DATE_TRUNC('month', c.created_at) + INTERVAL '1 month' - INTERVAL '1 day'
            ${includeInactive ? '' : 'AND c2.is_active = true'}
        ) as total_customers,
        COALESCE(SUM(i.total_amount), 0) as total_revenue,
        COALESCE(AVG(i.total_amount), 0) as avg_invoice_value
      FROM customers c
      LEFT JOIN invoices i ON i.customer_email = c.email AND i.company_id = c.company_id
        AND i.is_active = true
        AND DATE_TRUNC('month', i.created_at) = DATE_TRUNC('month', c.created_at)
      WHERE c.company_id = ${companyId}
        AND c.created_at >= ${startDate}
        AND c.created_at <= ${endDate}
        ${includeInactive ? '' : 'AND c.is_active = true'}
      GROUP BY DATE_TRUNC('month', c.created_at)
      ORDER BY DATE_TRUNC('month', c.created_at)
    `
    
    return monthlyData
  } catch (error) {
    logError('generateMonthlyCustomerMetrics', error, { companyId })
    return []
  }
}

// Helper function to generate business type metrics
async function generateBusinessTypeMetrics(companyId: string, includeInactive: boolean) {
  try {
    // This would require businessType field in customer schema
    // For now, return empty array
    return []
  } catch (error) {
    logError('generateBusinessTypeMetrics', error, { companyId })
    return []
  }
}

// Helper function to generate payment terms metrics
async function generatePaymentTermsMetrics(companyId: string, includeInactive: boolean) {
  try {
    const paymentTermsData = await prisma.customers.groupBy({
      by: ['paymentTerms'],
      where: {
        companyId,
        ...(includeInactive ? {} : { isActive: true })
      },
      _count: {
        id: true
      },
      _avg: {
        creditLimit: true
      },
      orderBy: {
        paymentTerms: 'asc'
      }
    })

    return paymentTermsData.map(group => ({
      paymentTerms: group.paymentTerms,
      customerCount: group._count.id,
      averageCreditLimit: group._avg.creditLimit || 0
    }))
  } catch (error) {
    logError('generatePaymentTermsMetrics', error, { companyId })
    return []
  }
}

// Helper function to generate customer growth metrics
async function generateCustomerGrowthMetrics(
  companyId: string,
  startDate: Date,
  endDate: Date,
  includeInactive: boolean
) {
  try {
    const growthData = await prisma.$queryRaw<{
      period: string;
      new_customers: number;
      churned_customers: number;
      net_growth: number;
      growth_rate: number;
    }[]>`
      WITH monthly_stats AS (
        SELECT 
          DATE_TRUNC('month', created_at) as period,
          COUNT(*) as new_customers
        FROM customers
        WHERE company_id = ${companyId}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
          ${includeInactive ? '' : 'AND is_active = true'}
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      churned_stats AS (
        SELECT 
          DATE_TRUNC('month', archived_at) as period,
          COUNT(*) as churned_customers
        FROM customers
        WHERE company_id = ${companyId}
          AND archived_at >= ${startDate}
          AND archived_at <= ${endDate}
          AND is_active = false
        GROUP BY DATE_TRUNC('month', archived_at)
      )
      SELECT 
        TO_CHAR(ms.period, 'YYYY-MM') as period,
        COALESCE(ms.new_customers, 0) as new_customers,
        COALESCE(cs.churned_customers, 0) as churned_customers,
        COALESCE(ms.new_customers, 0) - COALESCE(cs.churned_customers, 0) as net_growth,
        CASE 
          WHEN LAG(ms.new_customers) OVER (ORDER BY ms.period) > 0 
          THEN ((ms.new_customers - LAG(ms.new_customers) OVER (ORDER BY ms.period))::float / LAG(ms.new_customers) OVER (ORDER BY ms.period)) * 100
          ELSE 0
        END as growth_rate
      FROM monthly_stats ms
      LEFT JOIN churned_stats cs ON ms.period = cs.period
      ORDER BY ms.period
    `

    return growthData
  } catch (error) {
    logError('generateCustomerGrowthMetrics', error, { companyId })
    return []
  }
}