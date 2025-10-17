import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { 
  createCustomerSchema, 
  companyIdSchema, 
  customerFiltersSchema,
  validateRequestBody, 
  validateQueryParams,
  validateUAETRN 
} from '@/lib/validations'
import { UserRole, Prisma } from '@prisma/client'

// GET /api/customers - Fetch customers with advanced filtering and search
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams

    // Parse and validate all filter parameters
    console.log('Query params:', Object.fromEntries(searchParams.entries()))
    const filters = validateQueryParams(searchParams, customerFiltersSchema)
    console.log('Parsed filters:', filters)

    // Build dynamic where clause for advanced filtering
    // Always use the authenticated user's company ID for security
    const whereClause: Prisma.customersWhereInput = {
      company_id: authContext.user.companyId,
      is_active: filters.isActive
    }

    // Advanced search functionality
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { name_ar: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        // TRN search - strip formatting and search
        {
          invoices: {
            some: {
              trn_number: { contains: searchTerm.replace(/\D/g, ''), mode: 'insensitive' }
            }
          }
        }
      ]
    }

    // Business type filtering (if available in schema)
    if (filters.businessType) {
      // Note: Business type field needs to be added to schema
      // whereClause.businessType = filters.businessType
    }

    // Credit limit range filtering
    if (filters.minCreditLimit !== undefined || filters.maxCreditLimit !== undefined) {
      whereClause.credit_limit = {}
      if (filters.minCreditLimit !== undefined) {
        whereClause.credit_limit.gte = filters.minCreditLimit
      }
      if (filters.maxCreditLimit !== undefined) {
        whereClause.credit_limit.lte = filters.maxCreditLimit
      }
    }

    // Payment terms filtering
    if (filters.paymentTermsMin !== undefined || filters.paymentTermsMax !== undefined) {
      whereClause.payment_terms = {}
      if (filters.paymentTermsMin !== undefined) {
        whereClause.payment_terms.gte = filters.paymentTermsMin
      }
      if (filters.paymentTermsMax !== undefined) {
        whereClause.payment_terms.lte = filters.paymentTermsMax
      }
    }

    // Outstanding balance filtering
    if (filters.hasOutstandingBalance !== undefined) {
      if (filters.hasOutstandingBalance) {
        whereClause.invoices = {
          some: {
            status: { in: ['SENT', 'OVERDUE', 'DISPUTED'] },
            payments: {
              none: {}
            }
          }
        }
      } else {
        whereClause.invoices = {
          none: {
            status: { in: ['SENT', 'OVERDUE', 'DISPUTED'] },
            payments: {
              none: {}
            }
          }
        }
      }
    }

    // Build sorting
    const orderBy: Prisma.customersOrderByWithRelationInput = {}
    switch (filters.sortBy) {
      case 'name':
        orderBy.name = filters.sortOrder
        break
      case 'email':
        orderBy.email = filters.sortOrder
        break
      case 'createdAt':
        orderBy.created_at = filters.sortOrder
        break
      case 'creditLimit':
        orderBy.credit_limit = filters.sortOrder
        break
      case 'paymentTerms':
        orderBy.payment_terms = filters.sortOrder
        break
      default:
        orderBy.name = 'asc'
    }

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit

    // Execute queries in parallel for performance
    const [customers, totalCount] = await Promise.all([
      prisma.customers.findMany({
        where: whereClause,
        include: {
          invoices: {
            orderBy: { created_at: 'desc' },
            take: 5, // Limit recent invoices for performance
            select: {
              id: true,
              number: true,
              amount: true,
              total_amount: true,
              status: true,
              due_date: true,
              created_at: true,
              payments: {
                select: {
                  amount: true,
                  payment_date: true
                }
              }
            }
          },
          _count: {
            select: {
              invoices: {
                where: {
                  status: { in: ['SENT', 'OVERDUE', 'DISPUTED'] }
                }
              }
            }
          }
        },
        orderBy,
        skip,
        take: filters.limit
      }),
      prisma.customers.count({ where: whereClause })
    ])

    // Calculate outstanding balances and enrich customer data
    const enrichedCustomers = customers.map(customer => {
      const outstandingInvoices = customer.invoices.filter(invoice => 
        ['SENT', 'OVERDUE', 'DISPUTED'].includes(invoice.status) && 
        invoice.payments.length === 0
      )
      
      const outstandingBalance = outstandingInvoices.reduce((sum, invoice) =>
        sum + (invoice.total_amount || invoice.amount), 0
      )

      const totalPaid = customer.invoices.reduce((sum, invoice) => 
        sum + invoice.payments.reduce((pSum, payment) => pSum + payment.amount, 0), 0
      )

      return {
        ...customer,
        outstandingBalance,
        totalPaid,
        outstandingInvoiceCount: outstandingInvoices.length,
        totalInvoiceCount: customer._count.invoices
      }
    })

    const responseTime = Date.now() - startTime
    
    // Log performance metrics
    if (responseTime > 500) {
      logError('GET /api/customers - Slow query', 
        new Error(`Query took ${responseTime}ms`), 
        { 
          userId: authContext.user.id,
          responseTime,
          totalCount,
          filters: JSON.stringify(filters)
        }
      )
    }

    return successResponse({
      customers: enrichedCustomers,
      totalCount,
      currentPage: filters.page,
      totalPages: Math.ceil(totalCount / filters.limit),
      responseTime
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('GET /api/customers', error, { 
      userId: 'authContext.user?.id',
      responseTime,
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// POST /api/customers - Create new customer with UAE business validation
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to create customers')
    }

    const customerData = await validateRequestBody(request, createCustomerSchema)
    
    // Ensure user can only create customers for their company
    if (customerData.companyId !== authContext.user.companyId) {
      customerData.companyId = authContext.user.companyId
    }

    // UAE-specific business validations
    if (customerData.trn && !validateUAETRN(customerData.trn)) {
      throw new Error('Invalid UAE TRN format. TRN must be exactly 15 digits.')
    }

    // Check for duplicate TRN within the company
    if (customerData.trn) {
      const existingTrnCustomer = await prisma.customers.findFirst({
        where: {
          company_id: authContext.user.companyId,
          // Note: TRN field needs to be added to customer schema
          // trn: customerData.trn,
          is_active: true
        }
      })

      if (existingTrnCustomer) {
        throw new Error('A customer with this TRN already exists in your company.')
      }
    }

    // Check for duplicate email within the company
    const existingEmailCustomer = await prisma.customers.findFirst({
      where: {
        company_id: authContext.user.companyId,
        email: customerData.email,
        is_active: true
      }
    })
    
    if (existingEmailCustomer) {
      throw new Error('A customer with this email already exists in your company.')
    }

    const customer = await prisma.$transaction(async (tx) => {
      // Create customer with UAE-specific fields
      const newCustomer = await tx.customers.create({
        data: {
          company_id: customerData.companyId,
          name: customerData.name,
          name_ar: customerData.nameAr,
          email: customerData.email,
          phone: customerData.phone,
          payment_terms: customerData.paymentTerms || 30, // UAE default
          credit_limit: customerData.creditLimit,
          notes: customerData.notes,
          notes_ar: customerData.notesAr,
          // Note: These fields need to be added to customer schema
          // trn: customerData.trn,
          // businessType: customerData.businessType,
          // businessName: customerData.businessName
        },
        include: {
          invoices: {
            take: 5,
            orderBy: { created_at: 'desc' }
          }
        }
      })

      // Log activity with detailed metadata
      await tx.activities.create({
        data: {
          company_id: authContext.user.companyId,
          user_id: authContext.user.id,
          type: 'customer_created',
          description: `Created customer ${customerData.name}${customerData.nameAr ? ` (${customerData.nameAr})` : ''}`,
          metadata: {
            customerId: newCustomer.id,
            customerName: customerData.name,
            customerNameAr: customerData.nameAr,
            customerEmail: customerData.email,
            businessType: customerData.businessType,
            trn: customerData.trn,
            paymentTerms: customerData.paymentTerms,
            creditLimit: customerData.creditLimit
          }
        }
      })

      return newCustomer
    })

    const responseTime = Date.now() - startTime
    
    return successResponse({
      ...customer,
      responseTime
    }, 'Customer created successfully')

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('POST /api/customers', error, { 
      userId: 'authContext.user?.id',
      responseTime
    })
    return handleApiError(error)
  }
}