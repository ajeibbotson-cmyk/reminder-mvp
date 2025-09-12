import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { updateCustomerSchema, validateRequestBody } from '@/lib/validations'
import { UserRole } from '@prisma/client'

// GET /api/customers/[id] - Get specific customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const { id } = params

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            payments: true
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            trn: true
          }
        }
      }
    })

    if (!customer) {
      throw new NotFoundError('Customer')
    }

    // Check if user has access to this customer
    if (customer.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Customer')
    }

    return successResponse(customer)

  } catch (error) {
    logError('GET /api/customers/[id]', error, { 
      userId: 'authContext.user?.id',
      customerId: params.id
    })
    return handleApiError(error)
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to update customers')
    }

    const { id } = params
    const updateData = await validateRequestBody(request, updateCustomerSchema)

    // First check if customer exists and user has access
    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!existingCustomer) {
      throw new NotFoundError('Customer')
    }

    if (existingCustomer.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Customer')
    }

    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: {
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.email && { email: updateData.email }),
          ...(updateData.phone !== undefined && { phone: updateData.phone }),
          ...(updateData.paymentTerms !== undefined && { paymentTerms: updateData.paymentTerms }),
          ...(updateData.notes !== undefined && { notes: updateData.notes }),
        },
        include: {
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      })

      // If email changed, update all related invoices
      if (updateData.email && updateData.email !== existingCustomer.email) {
        await tx.invoice.updateMany({
          where: {
            customerEmail: existingCustomer.email,
            companyId: authContext.user.companyId
          },
          data: {
            customerEmail: updateData.email,
            customerName: updateData.name || existingCustomer.name
          }
        })
      }

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'customer_updated',
          description: `Updated customer ${customer.name}`,
          metadata: {
            customerId: customer.id,
            changes: Object.keys(updateData)
          }
        }
      })

      return customer
    })

    return successResponse(updatedCustomer, 'Customer updated successfully')

  } catch (error) {
    logError('PUT /api/customers/[id]', error, { 
      userId: 'authContext.user?.id',
      customerId: params.id
    })
    return handleApiError(error)
  }
}

// DELETE /api/customers/[id] - Delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to delete customers')
    }

    const { id } = params

    // First check if customer exists and user has access
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: true
      }
    })

    if (!existingCustomer) {
      throw new NotFoundError('Customer')
    }

    if (existingCustomer.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Customer')
    }

    // Check if customer has invoices
    if (existingCustomer.invoices.length > 0) {
      throw new Error('Cannot delete customer with existing invoices')
    }

    await prisma.$transaction(async (tx) => {
      await tx.customer.delete({
        where: { id }
      })

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'customer_deleted',
          description: `Deleted customer ${existingCustomer.name}`,
          metadata: {
            customerId: id,
            customerName: existingCustomer.name,
            customerEmail: existingCustomer.email
          }
        }
      })
    })

    return successResponse(null, 'Customer deleted successfully')

  } catch (error) {
    logError('DELETE /api/customers/[id]', error, { 
      userId: 'authContext.user?.id',
      customerId: params.id
    })
    return handleApiError(error)
  }
}