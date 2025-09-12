import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { createCustomerSchema, companyIdSchema, validateRequestBody, validateQueryParams } from '@/lib/validations'
import { UserRole } from '@prisma/client'

// GET /api/customers - Fetch customers for a company
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const { companyId } = validateQueryParams(searchParams, companyIdSchema)
    
    // Ensure user can only access their company's customers
    if (companyId !== authContext.user.companyId) {
      throw new Error('Access denied to company data')
    }

    const customers = await prisma.customer.findMany({
      where: {
        companyId: authContext.user.companyId
      },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Only include recent invoices to optimize performance
          select: {
            id: true,
            number: true,
            amount: true,
            status: true,
            dueDate: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const totalCount = customers.length

    return successResponse({
      customers,
      totalCount
    })

  } catch (error) {
    logError('GET /api/customers', error, { 
      userId: 'authContext.user?.id',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
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

    const customer = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          companyId: customerData.companyId,
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          paymentTerms: customerData.paymentTerms,
          notes: customerData.notes
        },
        include: {
          invoices: true
        }
      })

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'customer_created',
          description: `Created customer ${customerData.name}`,
          metadata: {
            customerId: newCustomer.id,
            customerName: customerData.name,
            customerEmail: customerData.email
          }
        }
      })

      return newCustomer
    })

    return successResponse(customer, 'Customer created successfully')

  } catch (error) {
    logError('POST /api/customers', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}