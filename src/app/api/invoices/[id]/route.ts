import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError, NotFoundError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { updateInvoiceSchema, validateRequestBody, validateUAETRN } from '@/lib/validations'
import { calculateInvoiceVAT, formatUAECurrency, validateUAETRN as validateTRN } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'

// GET /api/invoices/[id] - Get specific invoice
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const { id } = params

    // Fetch invoice with comprehensive UAE business data
    const invoice = await prisma.invoices.findUnique({
      where: { id },
      include: {
        customers: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            email: true,
            phone: true,
            paymentTerms: true,
            notes: true,
            notesAr: true
          }
        },
        companies: {
          select: {
            id: true,
            name: true,
            trn: true,
            address: true,
            defaultVatRate: true,
            settings: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            reference: true,
            notes: true,
            createdAt: true
          },
          orderBy: { paymentDate: 'desc' }
        },
        invoiceItems: {
          select: {
            id: true,
            description: true,
            descriptionAr: true,
            quantity: true,
            unitPrice: true,
            total: true,
            vatRate: true,
            vatAmount: true,
            totalWithVat: true,
            taxCategory: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        },
        followUpLogs: {
          include: {
            followUpSequences: {
              select: {
                id: true,
                name: true,
                active: true
              }
            }
          },
          orderBy: { sentAt: 'desc' },
          take: 10
        },
        importBatches: {
          select: {
            id: true,
            originalFilename: true,
            status: true,
            createdAt: true,
            errorSummary: true
          }
        },
        emailLogs: {
          select: {
            id: true,
            subject: true,
            deliveryStatus: true,
            sentAt: true,
            deliveredAt: true,
            openedAt: true,
            clickedAt: true,
            language: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!invoice) {
      throw new NotFoundError('Invoice')
    }

    // Enforce company-level data isolation
    if (invoice.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Invoice')
    }

    // Calculate additional UAE business insights
    const now = new Date()
    const paidAmount = invoice.payments.reduce((sum, payment) => 
      sum.plus(payment.amount), new Decimal(0)
    )
    const remainingAmount = new Decimal(invoice.totalAmount || invoice.amount).minus(paidAmount)
    const isOverdue = invoice.dueDate < now && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)
    const daysPastDue = isOverdue ? Math.ceil((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

    // Return enhanced invoice data with UAE business logic
    return successResponse({
      ...invoice,
      // Computed fields for UAE business needs
      paidAmount: paidAmount.toNumber(),
      remainingAmount: remainingAmount.toNumber(),
      isOverdue,
      daysPastDue,
      isFullyPaid: remainingAmount.lessThanOrEqualTo(0),
      paymentStatus: remainingAmount.lessThanOrEqualTo(0) ? 'FULLY_PAID' : 
                    paidAmount.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID',
      // Formatted amounts for UAE currency display
      formattedAmounts: {
        subtotal: formatUAECurrency(invoice.subtotal || 0, invoice.currency),
        vatAmount: formatUAECurrency(invoice.vatAmount || 0, invoice.currency),
        totalAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
        paidAmount: formatUAECurrency(paidAmount, invoice.currency),
        remainingAmount: formatUAECurrency(remainingAmount, invoice.currency)
      },
      // VAT summary for UAE compliance
      vatSummary: invoice.invoiceItems.length > 0 ? {
        standardRate: invoice.invoiceItems.filter(item => item.taxCategory === 'STANDARD'),
        zeroRated: invoice.invoiceItems.filter(item => item.taxCategory === 'ZERO_RATED'),
        exempt: invoice.invoiceItems.filter(item => item.taxCategory === 'EXEMPT')
      } : null
    })

  } catch (error) {
    logError('GET /api/invoices/[id]', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
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
    const existingInvoice = await prisma.invoices.findUnique({
      where: { id },
      include: { 
        invoiceItems: true,
        payments: true,
        customers: true,
        companies: true
      }
    })

    if (!existingInvoice) {
      throw new NotFoundError('Invoice')
    }

    // Enforce company-level data isolation
    if (existingInvoice.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Invoice')
    }

    // UAE business validation for updates
    await validateInvoiceUpdateRules(existingInvoice, updateData)

    // Validate TRN if being updated
    if (updateData.trnNumber && !validateTRN(updateData.trnNumber)) {
      throw new Error('Invalid TRN format. UAE TRN must be 15 digits.')
    }

    // Check invoice number uniqueness if being updated
    if (updateData.number && updateData.number !== existingInvoice.number) {
      const duplicateInvoice = await prisma.invoices.findUnique({
        where: {
          companyId_number: {
            companyId: existingInvoice.companyId,
            number: updateData.number
          }
        }
      })

      if (duplicateInvoice) {
        throw new Error(`Invoice number ${updateData.number} already exists for this company`)
      }
    }

    // Update invoice in transaction with UAE business logic
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Update customer information if needed (UAE bilingual support)
      if (updateData.customerName || updateData.customerEmail || updateData.customerNameAr || updateData.customerPhone) {
        const customerData: any = {}
        if (updateData.customerName) customerData.name = updateData.customerName
        if (updateData.customerNameAr) customerData.nameAr = updateData.customerNameAr
        if (updateData.customerEmail) customerData.email = updateData.customerEmail
        if (updateData.customerPhone) customerData.phone = updateData.customerPhone
        if (updateData.customerNotes) customerData.notes = updateData.customerNotes
        if (updateData.customerNotesAr) customerData.notesAr = updateData.customerNotesAr

        if (Object.keys(customerData).length > 0) {
          await tx.customers.upsert({
            where: {
              email_companyId: {
                email: updateData.customerEmail || existingInvoice.customerEmail,
                companyId: existingInvoice.companyId
              }
            },
            update: customerData,
            create: {
              id: crypto.randomUUID(),
              ...customerData,
              email: updateData.customerEmail || existingInvoice.customerEmail,
              companyId: existingInvoice.companyId,
              paymentTerms: updateData.paymentTerms || 30
            }
          })
        }
      }

      // Recalculate VAT if items are being updated
      let vatCalculation = null
      if (updateData.items && updateData.items.length > 0) {
        vatCalculation = calculateInvoiceVAT(
          updateData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            taxCategory: item.taxCategory || 'STANDARD'
          })),
          updateData.currency || existingInvoice.currency
        )
      }

      // Update invoice with comprehensive UAE fields
      const invoice = await tx.invoices.update({
        where: { id },
        data: {
          // Basic invoice fields
          ...(updateData.number && { number: updateData.number }),
          ...(updateData.customerName && { customerName: updateData.customerName }),
          ...(updateData.customerEmail && { customerEmail: updateData.customerEmail }),
          ...(updateData.currency && { currency: updateData.currency }),
          ...(updateData.dueDate && { dueDate: updateData.dueDate }),
          
          // UAE bilingual fields
          ...(updateData.description !== undefined && { description: updateData.description }),
          ...(updateData.descriptionAr !== undefined && { descriptionAr: updateData.descriptionAr }),
          ...(updateData.notes !== undefined && { notes: updateData.notes }),
          ...(updateData.notesAr !== undefined && { notesAr: updateData.notesAr }),
          
          // UAE tax compliance
          ...(updateData.trnNumber !== undefined && { trnNumber: updateData.trnNumber }),
          
          // Financial amounts (with VAT recalculation if applicable)
          ...(vatCalculation ? {
            amount: updateData.amount || existingInvoice.amount, // Backward compatibility
            subtotal: vatCalculation.subtotal.toNumber(),
            vatAmount: vatCalculation.totalVatAmount.toNumber(),
            totalAmount: vatCalculation.grandTotal.toNumber()
          } : {
            ...(updateData.amount !== undefined && { amount: updateData.amount }),
            ...(updateData.subtotal !== undefined && { subtotal: updateData.subtotal }),
            ...(updateData.vatAmount !== undefined && { vatAmount: updateData.vatAmount }),
            ...(updateData.totalAmount !== undefined && { totalAmount: updateData.totalAmount })
          })
        },
        include: {
          customers: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              email: true,
              phone: true,
              paymentTerms: true
            }
          },
          companies: {
            select: {
              id: true,
              name: true,
              trn: true,
              defaultVatRate: true
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              method: true,
              reference: true
            },
            orderBy: { paymentDate: 'desc' }
          },
          invoiceItems: {
            select: {
              id: true,
              description: true,
              descriptionAr: true,
              quantity: true,
              unitPrice: true,
              total: true,
              vatRate: true,
              vatAmount: true,
              totalWithVat: true,
              taxCategory: true
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      // Update invoice items if provided (UAE VAT compliant)
      if (updateData.items) {
        // Delete existing items
        await tx.invoiceItems.deleteMany({
          where: { invoiceId: id }
        })

        // Create new items with VAT calculations
        if (updateData.items.length > 0) {
          const itemsWithVat = vatCalculation ? vatCalculation.lineItems : updateData.items
          
          await tx.invoiceItems.createMany({
            data: itemsWithVat.map((item: any, index: number) => {
              const originalItem = updateData.items![index]
              return {
                id: crypto.randomUUID(),
                invoiceId: id,
                description: item.description || originalItem?.description,
                descriptionAr: originalItem?.descriptionAr,
                quantity: item.quantity || originalItem?.quantity,
                unitPrice: item.unitPrice || originalItem?.unitPrice,
                total: item.lineTotal || item.total || originalItem?.total,
                vatRate: item.vatRate || originalItem?.vatRate || 5.00,
                vatAmount: item.vatAmount || originalItem?.vatAmount || 0.00,
                totalWithVat: item.totalWithVat || originalItem?.totalWithVat,
                taxCategory: item.taxCategory || originalItem?.taxCategory || 'STANDARD'
              }
            })
          })
        }
      }

      // Log comprehensive activity for UAE audit trail
      const changedFields = Object.keys(updateData).filter(key => 
        updateData[key] !== existingInvoice[key as keyof typeof existingInvoice]
      )
      
      await tx.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_updated',
          description: `Updated invoice ${invoice.number}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            changedFields,
            previousValues: changedFields.reduce((acc, field) => {
              acc[field] = existingInvoice[field as keyof typeof existingInvoice]
              return acc
            }, {} as Record<string, any>),
            newValues: changedFields.reduce((acc, field) => {
              acc[field] = updateData[field as keyof typeof updateData]
              return acc
            }, {} as Record<string, any>),
            userAgent: request.headers.get('user-agent'),
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            updateReason: updateData.notes || 'No reason provided'
          }
        }
      })

      return invoice
    })

    // Calculate additional insights for the updated invoice
    const paidAmount = updatedInvoice.payments.reduce((sum, payment) => 
      sum.plus(payment.amount), new Decimal(0)
    )
    const remainingAmount = new Decimal(updatedInvoice.totalAmount || updatedInvoice.amount).minus(paidAmount)
    
    // Return enhanced response with UAE business data
    return successResponse({
      ...updatedInvoice,
      // Computed fields for UAE business needs
      paidAmount: paidAmount.toNumber(),
      remainingAmount: remainingAmount.toNumber(),
      isOverdue: updatedInvoice.dueDate < new Date() && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(updatedInvoice.status),
      isFullyPaid: remainingAmount.lessThanOrEqualTo(0),
      // Formatted amounts for UAE currency display
      formattedAmounts: {
        subtotal: formatUAECurrency(updatedInvoice.subtotal || 0, updatedInvoice.currency),
        vatAmount: formatUAECurrency(updatedInvoice.vatAmount || 0, updatedInvoice.currency),
        totalAmount: formatUAECurrency(updatedInvoice.totalAmount || updatedInvoice.amount, updatedInvoice.currency),
        paidAmount: formatUAECurrency(paidAmount, updatedInvoice.currency),
        remainingAmount: formatUAECurrency(remainingAmount, updatedInvoice.currency)
      },
      vatBreakdown: vatCalculation?.vatBreakdown
    }, 'Invoice updated successfully with UAE VAT compliance')

  } catch (error) {
    logError('PUT /api/invoices/[id]', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
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
    const existingInvoice = await prisma.invoices.findUnique({
      where: { id },
      include: {
        payments: true,
        followUpLogs: true,
        emailLogs: true,
        importBatches: {
          select: { id: true, status: true }
        }
      }
    })

    if (!existingInvoice) {
      throw new NotFoundError('Invoice')
    }

    // Enforce company-level data isolation
    if (existingInvoice.companyId !== authContext.user.companyId) {
      throw new NotFoundError('Invoice')
    }

    // UAE business validation for deletion
    await validateInvoiceDeletionRules(existingInvoice)

    // Additional checks for UAE compliance
    if (existingInvoice.payments.length > 0) {
      throw new Error('Cannot delete invoice with existing payments. UAE tax regulations require maintaining payment records.')
    }

    if (existingInvoice.followUpLogs.length > 0) {
      throw new Error('Cannot delete invoice with follow-up history. This would break the audit trail.')
    }

    // Check if this invoice is part of a completed import batch
    if (existingInvoice.importBatches && existingInvoice.importBatches.status === 'COMPLETED') {
      throw new Error('Cannot delete invoice from a completed import batch. This would compromise data integrity.')
    }

    // Soft delete invoice with comprehensive audit trail (UAE compliance)
    await prisma.$transaction(async (tx) => {
      // First, delete related records that should be cleaned up
      await tx.invoiceItems.deleteMany({
        where: { invoiceId: id }
      })

      // Delete the invoice
      await tx.invoices.delete({
        where: { id }
      })

      // Log comprehensive deletion activity for UAE audit requirements
      await tx.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_deleted',
          description: `Deleted invoice ${existingInvoice.number} for ${existingInvoice.customerName}`,
          metadata: {
            invoiceId: id,
            invoiceNumber: existingInvoice.number,
            customerName: existingInvoice.customerName,
            customerEmail: existingInvoice.customerEmail,
            amount: existingInvoice.amount.toString(),
            subtotal: existingInvoice.subtotal?.toString(),
            vatAmount: existingInvoice.vatAmount?.toString(),
            totalAmount: (existingInvoice.totalAmount || existingInvoice.amount).toString(),
            currency: existingInvoice.currency,
            status: existingInvoice.status,
            dueDate: existingInvoice.dueDate.toISOString(),
            createdAt: existingInvoice.createdAt.toISOString(),
            trnNumber: existingInvoice.trnNumber,
            itemCount: existingInvoice.invoiceItems?.length || 0,
            deletionReason: 'User requested deletion',
            userAgent: request.headers.get('user-agent'),
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            complianceNote: 'Invoice deleted in compliance with UAE business regulations'
          }
        }
      })
    })

    return successResponse({
      deletedInvoice: {
        id: existingInvoice.id,
        number: existingInvoice.number,
        customerName: existingInvoice.customerName,
        totalAmount: formatUAECurrency(existingInvoice.totalAmount || existingInvoice.amount, existingInvoice.currency),
        deletedAt: new Date().toISOString()
      }
    }, 'Invoice deleted successfully in compliance with UAE regulations')

  } catch (error) {
    logError('DELETE /api/invoices/[id]', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      invoiceId: params.id
    })
    return handleApiError(error)
  }
}

// Helper function to validate UAE business rules for invoice updates
async function validateInvoiceUpdateRules(existingInvoice: any, updateData: any) {
  // Prevent updates to invoices that are already paid
  if (existingInvoice.status === InvoiceStatus.PAID) {
    // Only allow specific fields to be updated for paid invoices
    const allowedFields = ['description', 'descriptionAr', 'notes', 'notesAr']
    const updateFields = Object.keys(updateData)
    const restrictedFields = updateFields.filter(field => !allowedFields.includes(field))
    
    if (restrictedFields.length > 0) {
      throw new Error(`Cannot update ${restrictedFields.join(', ')} for paid invoices. Only description and notes can be modified.`)
    }
  }
  
  // Prevent updates to critical financial data if payments exist
  const hasPayments = existingInvoice.payments && existingInvoice.payments.length > 0
  if (hasPayments) {
    const financialFields = ['amount', 'subtotal', 'vatAmount', 'totalAmount', 'items']
    const updateFields = Object.keys(updateData)
    const restrictedFields = updateFields.filter(field => financialFields.includes(field))
    
    if (restrictedFields.length > 0) {
      throw new Error(`Cannot update financial data (${restrictedFields.join(', ')}) for invoices with payments. This would break UAE audit compliance.`)
    }
  }
  
  // Validate due date changes
  if (updateData.dueDate) {
    const newDueDate = new Date(updateData.dueDate)
    const originalDueDate = existingInvoice.dueDate
    const now = new Date()
    
    // Don't allow extending due date for overdue invoices without proper reason
    if (existingInvoice.status === InvoiceStatus.OVERDUE && newDueDate > originalDueDate) {
      if (!updateData.notes || updateData.notes.length < 10) {
        throw new Error('Extending due date for overdue invoices requires a detailed reason in notes (minimum 10 characters)')
      }
    }
    
    // Don't allow setting due date too far in the past
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)
    if (newDueDate < thirtyDaysAgo) {
      throw new Error('Due date cannot be more than 30 days in the past')
    }
  }
  
  // Validate currency changes
  if (updateData.currency && updateData.currency !== existingInvoice.currency) {
    if (hasPayments) {
      throw new Error('Cannot change currency for invoices with payments')
    }
    
    // Only allow specific currency changes in UAE
    const allowedCurrencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR']
    if (!allowedCurrencies.includes(updateData.currency)) {
      throw new Error(`Currency ${updateData.currency} not allowed. Supported: ${allowedCurrencies.join(', ')}`)
    }
  }
}

// Helper function to validate UAE business rules for invoice deletion
async function validateInvoiceDeletionRules(invoice: any) {
  // Check invoice age - don't allow deleting old invoices (UAE audit requirements)
  const createdDate = new Date(invoice.createdAt)
  const now = new Date()
  const daysSinceCreation = Math.ceil((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceCreation > 90) {
    throw new Error('Cannot delete invoices older than 90 days. UAE regulations require maintaining financial records.')
  }
  
  // Don't allow deleting invoices that have been sent to customers
  if ([InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PAID].includes(invoice.status)) {
    throw new Error(`Cannot delete invoices with status ${invoice.status}. Only draft invoices can be deleted.`)
    }
  
  // Additional check for TRN invoices (tax invoices cannot be deleted)
  if (invoice.trnNumber && invoice.vatAmount && parseFloat(invoice.vatAmount) > 0) {
    throw new Error('Cannot delete VAT invoices with TRN. UAE tax regulations require maintaining these records.')
  }
  
  // Check if invoice is part of regulatory reporting
  if (invoice.emailLogs && invoice.emailLogs.length > 0) {
    const hasSentEmails = invoice.emailLogs.some((log: any) => 
      ['SENT', 'DELIVERED', 'OPENED'].includes(log.deliveryStatus)
    )
    
    if (hasSentEmails) {
      throw new Error('Cannot delete invoices that have been emailed to customers. This would break the communication audit trail.')
    }
  }
}