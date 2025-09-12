import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { updateInvoiceSchema, validateRequestBody } from '@/lib/validations'
import { UserRole } from '@prisma/client'

// GET /api/invoices/[id] - Get specific invoice
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const { id } = params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        company: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        items: true,
        followUpLogs: {
          include: {
            sequence: true
          },
          orderBy: { sentAt: 'desc' }
        }
      }
    })

    if (!invoice) {
      throw new NotFoundError('Invoice')
    }

    // Check if user has access to this invoice
    if (invoice.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Invoice')
    }

    return successResponse(invoice)

  } catch (error) {
    logError('GET /api/invoices/[id]', error, { 
      userId: 'authContext.user?.id',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}

// PUT /api/invoices/[id] - Update invoice
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to update invoices')
    }

    const { id } = params
    const updateData = await validateRequestBody(request, updateInvoiceSchema)

    // First check if invoice exists and user has access
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!existingInvoice) {
      throw new NotFoundError('Invoice')
    }

    if (existingInvoice.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Invoice')
    }

    // Update invoice in transaction
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Update customer if needed
      if (updateData.customerName || updateData.customerEmail) {
        const customerData: Record<string, string> = {}
        if (updateData.customerName) customerData.name = updateData.customerName
        if (updateData.customerEmail) customerData.email = updateData.customerEmail

        if (Object.keys(customerData).length > 0) {
          await tx.customer.upsert({
            where: {
              email_companyId: {
                email: updateData.customerEmail || existingInvoice.customerEmail,
                companyId: existingInvoice.companyId
              }
            },
            update: customerData,
            create: {
              ...customerData,
              email: updateData.customerEmail || existingInvoice.customerEmail,
              companyId: existingInvoice.companyId
            }
          })
        }
      }

      // Update invoice
      const invoice = await tx.invoice.update({
        where: { id },
        data: {
          ...(updateData.number && { number: updateData.number }),
          ...(updateData.customerName && { customerName: updateData.customerName }),
          ...(updateData.customerEmail && { customerEmail: updateData.customerEmail }),
          ...(updateData.amount && { amount: updateData.amount }),
          ...(updateData.currency && { currency: updateData.currency }),
          ...(updateData.dueDate && { dueDate: updateData.dueDate }),
          ...(updateData.description !== undefined && { description: updateData.description }),
          ...(updateData.notes !== undefined && { notes: updateData.notes }),
        },
        include: {
          customer: true,
          company: true,
          payments: true,
          items: true
        }
      })

      // Update invoice items if provided
      if (updateData.items) {
        // Delete existing items
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id }
        })

        // Create new items
        if (updateData.items.length > 0) {
          await tx.invoiceItem.createMany({
            data: updateData.items.map(item => ({
              invoiceId: id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total
            }))
          })
        }
      }

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_updated',
          description: `Updated invoice ${invoice.number}`,
          metadata: {
            invoiceId: invoice.id,
            changes: Object.keys(updateData)
          }
        }
      })

      return invoice
    })

    return successResponse(updatedInvoice, 'Invoice updated successfully')

  } catch (error) {
    logError('PUT /api/invoices/[id]', error, { 
      userId: 'authContext.user?.id',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}

// DELETE /api/invoices/[id] - Delete invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to delete invoices')
    }

    const { id } = params

    // First check if invoice exists and user has access
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id }
    })

    if (!existingInvoice) {
      throw new NotFoundError('Invoice')
    }

    if (existingInvoice.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Invoice')
    }

    // Check if invoice has payments
    const paymentCount = await prisma.payment.count({
      where: { invoiceId: id }
    })

    if (paymentCount > 0) {
      throw new Error('Cannot delete invoice with existing payments')
    }

    // Delete invoice (cascade will handle related records)
    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({
        where: { id }
      })

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_deleted',
          description: `Deleted invoice ${existingInvoice.number}`,
          metadata: {
            invoiceId: id,
            customerName: existingInvoice.customerName,
            amount: existingInvoice.amount.toString()
          }
        }
      })
    })

    return successResponse(null, 'Invoice deleted successfully')

  } catch (error) {
    logError('DELETE /api/invoices/[id]', error, { 
      userId: 'authContext.user?.id',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}