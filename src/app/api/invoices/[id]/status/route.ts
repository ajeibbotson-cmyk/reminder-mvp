import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { invoiceStatusSchema, validateRequestBody } from '@/lib/validations'
import { UserRole } from '@prisma/client'

// PATCH /api/invoices/[id]/status - Update invoice status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to update invoice status')
    }

    const { id } = params
    const { status } = await validateRequestBody(request, invoiceStatusSchema)

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

    // Update invoice status
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: { status },
        include: {
          customer: true,
          company: true,
          payments: true,
          items: true
        }
      })

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_status_updated',
          description: `Changed invoice ${invoice.number} status from ${existingInvoice.status} to ${status}`,
          metadata: {
            invoiceId: invoice.id,
            previousStatus: existingInvoice.status,
            newStatus: status
          }
        }
      })

      return invoice
    })

    return successResponse(updatedInvoice, `Invoice status updated to ${status}`)

  } catch (error) {
    logError('PATCH /api/invoices/[id]/status', error, { 
      userId: 'authContext.user?.id',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}