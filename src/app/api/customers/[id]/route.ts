import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { updateCustomerSchema, validateRequestBody, validateUAETRN } from '@/lib/validations'
import { UserRole, Prisma } from '@prisma/client'

// GET /api/customers/[id] - Get specific customer with enhanced details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const { id } = params

    const customer = await prisma.customer.findUnique({
      where: { 
        id,
        isActive: true // Only return active customers
      },
      include: {
        invoices: {
          where: {
            isActive: true
          },
          orderBy: { createdAt: 'desc' },
          include: {
            payments: {
              orderBy: { paymentDate: 'desc' }
            },
            invoiceItems: {
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            trn: true,
            defaultVatRate: true,
            businessHours: true
          }
        },
        emailLogs: {
          take: 10,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            templateType: true,
            subject: true,
            deliveryStatus: true,
            sentAt: true,
            openedAt: true
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

    // Calculate customer analytics
    const totalInvoiced = customer.invoices.reduce((sum, invoice) => 
      sum + (invoice.totalAmount || invoice.amount), 0
    )
    
    const totalPaid = customer.invoices.reduce((sum, invoice) => 
      sum + invoice.payments.reduce((pSum, payment) => pSum + payment.amount, 0), 0
    )
    
    const outstandingBalance = totalInvoiced - totalPaid
    
    const overdueInvoices = customer.invoices.filter(invoice => 
      ['SENT', 'OVERDUE'].includes(invoice.status) && 
      new Date(invoice.dueDate) < new Date() &&
      invoice.payments.length === 0
    )
    
    const pendingInvoices = customer.invoices.filter(invoice => 
      invoice.status === 'SENT' && 
      invoice.payments.length === 0
    )

    // Calculate average payment time
    const paidInvoices = customer.invoices.filter(invoice => 
      invoice.status === 'PAID' && invoice.payments.length > 0
    )
    
    const averagePaymentDays = paidInvoices.length > 0 ? 
      paidInvoices.reduce((sum, invoice) => {
        const firstPayment = invoice.payments[0]
        const daysDiff = Math.ceil(
          (new Date(firstPayment.paymentDate).getTime() - new Date(invoice.createdAt).getTime()) 
          / (1000 * 60 * 60 * 24)
        )
        return sum + daysDiff
      }, 0) / paidInvoices.length : 0

    // Group invoices by status for quick overview
    const invoicesByStatus = {
      sent: customer.invoices.filter(i => i.status === 'SENT').length,
      paid: customer.invoices.filter(i => i.status === 'PAID').length,
      overdue: customer.invoices.filter(i => i.status === 'OVERDUE').length,
      disputed: customer.invoices.filter(i => i.status === 'DISPUTED').length,
      cancelled: customer.invoices.filter(i => i.status === 'CANCELLED').length
    }

    const responseTime = Date.now() - startTime
    
    const enrichedCustomer = {
      ...customer,
      analytics: {
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        overdueAmount: overdueInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0),
        pendingAmount: pendingInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0),
        averagePaymentDays: Math.round(averagePaymentDays),
        invoicesByStatus,
        totalInvoices: customer.invoices.length,
        overdueCount: overdueInvoices.length,
        pendingCount: pendingInvoices.length
      },
      responseTime
    }

    return successResponse(enrichedCustomer)

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('GET /api/customers/[id]', error, { 
      userId: 'authContext.user?.id',
      customerId: params.id,
      responseTime
    })
    return handleApiError(error)
  }
}

// PUT /api/customers/[id] - Update customer with UAE business validation
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to update customers')
    }

    const { id } = params
    const updateData = await validateRequestBody(request, updateCustomerSchema)

    // First check if customer exists and user has access
    const existingCustomer = await prisma.customer.findUnique({
      where: { 
        id,
        isActive: true
      }
    })

    if (!existingCustomer) {
      throw new NotFoundError('Customer')
    }

    if (existingCustomer.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Customer')
    }

    // UAE-specific validations
    if (updateData.trn) {
      if (!validateUAETRN(updateData.trn)) {
        throw new Error('Invalid UAE TRN format. TRN must be exactly 15 digits.')
      }
      
      // Check for duplicate TRN (excluding current customer)
      const existingTrnCustomer = await prisma.customer.findFirst({
        where: {
          companyId: authContext.user.companyId,
          // trn: updateData.trn,
          id: { not: id },
          isActive: true
        }
      })
      
      if (existingTrnCustomer) {
        throw new Error('Another customer with this TRN already exists in your company.')
      }
    }

    // Check for duplicate email (excluding current customer)
    if (updateData.email && updateData.email !== existingCustomer.email) {
      const existingEmailCustomer = await prisma.customer.findFirst({
        where: {
          companyId: authContext.user.companyId,
          email: updateData.email,
          id: { not: id },
          isActive: true
        }
      })
      
      if (existingEmailCustomer) {
        throw new Error('Another customer with this email already exists in your company.')
      }
    }

    const updatedCustomer = await prisma.$transaction(async (tx) => {
      // Build update data object
      const updateFields: Prisma.CustomerUpdateInput = {}
      
      if (updateData.name !== undefined) updateFields.name = updateData.name
      if (updateData.nameAr !== undefined) updateFields.nameAr = updateData.nameAr
      if (updateData.email !== undefined) updateFields.email = updateData.email
      if (updateData.phone !== undefined) updateFields.phone = updateData.phone
      if (updateData.paymentTerms !== undefined) updateFields.paymentTerms = updateData.paymentTerms
      if (updateData.creditLimit !== undefined) updateFields.creditLimit = updateData.creditLimit
      if (updateData.notes !== undefined) updateFields.notes = updateData.notes
      if (updateData.notesAr !== undefined) updateFields.notesAr = updateData.notesAr
      // Note: These fields need to be added to schema
      // if (updateData.trn !== undefined) updateFields.trn = updateData.trn
      // if (updateData.businessType !== undefined) updateFields.businessType = updateData.businessType
      // if (updateData.businessName !== undefined) updateFields.businessName = updateData.businessName

      const customer = await tx.customer.update({
        where: { id },
        data: updateFields,
        include: {
          invoices: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              payments: true
            }
          }
        }
      })

      // If email changed, update all related invoices and maintain referential integrity
      if (updateData.email && updateData.email !== existingCustomer.email) {
        await tx.invoice.updateMany({
          where: {
            customerEmail: existingCustomer.email,
            companyId: authContext.user.companyId,
            isActive: true
          },
          data: {
            customerEmail: updateData.email,
            customerName: updateData.name || existingCustomer.name,
            customerNameAr: updateData.nameAr || existingCustomer.nameAr
          }
        })
      }

      // If name changed, update all related invoices
      if (updateData.name && updateData.name !== existingCustomer.name) {
        await tx.invoice.updateMany({
          where: {
            customerEmail: customer.email,
            companyId: authContext.user.companyId,
            isActive: true
          },
          data: {
            customerName: updateData.name,
            customerNameAr: updateData.nameAr
          }
        })
      }

      // Log detailed activity
      const changedFields = Object.keys(updateData).filter(key => 
        updateData[key as keyof typeof updateData] !== undefined
      )
      
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'customer_updated',
          description: `Updated customer ${customer.name}${customer.nameAr ? ` (${customer.nameAr})` : ''} - Fields: ${changedFields.join(', ')}`,
          metadata: {
            customerId: customer.id,
            changedFields,
            oldValues: {
              name: existingCustomer.name,
              nameAr: existingCustomer.nameAr,
              email: existingCustomer.email,
              phone: existingCustomer.phone,
              paymentTerms: existingCustomer.paymentTerms,
              creditLimit: existingCustomer.creditLimit?.toString()
            },
            newValues: updateData
          }
        }
      })

      return customer
    })

    const responseTime = Date.now() - startTime
    
    return successResponse({
      ...updatedCustomer,
      responseTime
    }, 'Customer updated successfully')

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('PUT /api/customers/[id]', error, { 
      userId: 'authContext.user?.id',
      customerId: params.id,
      responseTime
    })
    return handleApiError(error)
  }
}

// DELETE /api/customers/[id] - Soft delete customer with UAE compliance
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to delete customers')
    }

    const { id } = params

    // First check if customer exists and user has access
    const existingCustomer = await prisma.customer.findUnique({
      where: { 
        id,
        isActive: true
      },
      include: {
        invoices: {
          where: {
            isActive: true
          },
          include: {
            payments: true
          }
        }
      }
    })

    if (!existingCustomer) {
      throw new NotFoundError('Customer')
    }

    if (existingCustomer.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Customer')
    }

    // Enhanced business rules for UAE compliance
    const activeInvoices = existingCustomer.invoices.filter(invoice => 
      ['SENT', 'OVERDUE', 'DISPUTED'].includes(invoice.status)
    )
    
    const unpaidInvoices = existingCustomer.invoices.filter(invoice => 
      ['SENT', 'OVERDUE', 'DISPUTED'].includes(invoice.status) && 
      invoice.payments.length === 0
    )

    // Check business rules before deletion
    if (activeInvoices.length > 0) {
      throw new Error(
        `Cannot delete customer with ${activeInvoices.length} active invoice(s). ` +
        'Please complete or cancel all invoices before deleting the customer.'
      )
    }

    if (unpaidInvoices.length > 0) {
      throw new Error(
        `Cannot delete customer with ${unpaidInvoices.length} unpaid invoice(s). ` +
        'Please settle all outstanding invoices before deleting the customer.'
      )
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete the customer (UAE compliance - maintain audit trail)
      await tx.customer.update({
        where: { id },
        data: {
          isActive: false,
          archivedAt: new Date(),
          // Append timestamp to email to allow re-creation with same email
          email: `${existingCustomer.email}_archived_${Date.now()}`
        }
      })

      // Soft delete related invoices if any (for audit compliance)
      if (existingCustomer.invoices.length > 0) {
        await tx.invoice.updateMany({
          where: {
            customerEmail: existingCustomer.email,
            companyId: authContext.user.companyId
          },
          data: {
            isActive: false,
            archivedAt: new Date()
          }
        })
      }

      // Log comprehensive activity for UAE audit requirements
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'customer_deleted',
          description: `Archived customer ${existingCustomer.name}${existingCustomer.nameAr ? ` (${existingCustomer.nameAr})` : ''} for compliance`,
          metadata: {
            customerId: id,
            customerName: existingCustomer.name,
            customerNameAr: existingCustomer.nameAr,
            customerEmail: existingCustomer.email,
            totalInvoices: existingCustomer.invoices.length,
            paidInvoices: existingCustomer.invoices.filter(i => i.status === 'PAID').length,
            deletionReason: 'User initiated soft delete',
            complianceNote: 'Customer data archived for UAE audit requirements'
          }
        }
      })
    })

    const responseTime = Date.now() - startTime
    
    return successResponse({
      customerId: id,
      archivedAt: new Date().toISOString(),
      responseTime
    }, 'Customer archived successfully')

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('DELETE /api/customers/[id]', error, { 
      userId: 'authContext.user?.id',
      customerId: params.id,
      responseTime
    })
    return handleApiError(error)
  }
}