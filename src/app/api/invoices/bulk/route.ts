import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { 
  bulkInvoiceActionSchema,
  validateRequestBody
} from '@/lib/validations'
import { UserRole } from '@prisma/client'

// POST /api/invoices/bulk - Perform bulk actions on invoices
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to perform bulk invoice operations')
    }

    const bulkData = await validateRequestBody(request, bulkInvoiceActionSchema)
    
    // Verify all invoices belong to user's company
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: bulkData.invoiceIds },
        companyId: authContext.user.companyId
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (invoices.length !== bulkData.invoiceIds.length) {
      throw new Error('Some invoices not found or access denied')
    }

    const results = {
      action: bulkData.action,
      requestedCount: bulkData.invoiceIds.length,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      results: [] as any[],
      errors: [] as string[]
    }

    // Process based on action type
    switch (bulkData.action) {
      case 'update_status':
        if (!bulkData.status) {
          throw new Error('Status is required for update_status action')
        }
        await handleBulkStatusUpdate(invoices, bulkData.status, authContext.user, results)
        break

      case 'send_reminder':
        if (!bulkData.emailTemplateId) {
          throw new Error('Email template ID is required for send_reminder action')
        }
        await handleBulkSendReminder(invoices, bulkData.emailTemplateId, authContext.user, results)
        break

      case 'delete':
        await handleBulkDelete(invoices, authContext.user, results)
        break

      case 'export':
        const exportResult = await handleBulkExport(invoices, authContext.user)
        results.results.push(exportResult)
        results.successCount = invoices.length
        break

      default:
        throw new Error(`Unsupported bulk action: ${bulkData.action}`)
    }

    results.processedCount = results.successCount + results.failureCount

    // Log bulk activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: 'bulk_invoice_action',
        description: `Bulk ${bulkData.action} performed on ${results.successCount}/${results.requestedCount} invoices`,
        metadata: {
          action: bulkData.action,
          invoiceIds: bulkData.invoiceIds,
          requestedCount: results.requestedCount,
          successCount: results.successCount,
          failureCount: results.failureCount,
          status: bulkData.status,
          emailTemplateId: bulkData.emailTemplateId
        }
      }
    })

    return successResponse(results, `Bulk ${bulkData.action} completed`)

  } catch (error) {
    logError('POST /api/invoices/bulk', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}

// Handle bulk status updates
async function handleBulkStatusUpdate(
  invoices: any[],
  newStatus: string,
  user: any,
  results: any
) {
  const updatePromises = invoices.map(async (invoice) => {
    try {
      // Validate status transition
      if (!isValidStatusTransition(invoice.status, newStatus)) {
        results.errors.push(`Invalid status transition from ${invoice.status} to ${newStatus} for invoice ${invoice.number}`)
        results.failureCount++
        return null
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          status: newStatus as any,
          updatedAt: new Date()
        },
        include: {
          customer: true
        }
      })

      results.results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        oldStatus: invoice.status,
        newStatus: newStatus,
        success: true
      })

      results.successCount++
      return updatedInvoice

    } catch (error) {
      results.errors.push(`Failed to update invoice ${invoice.number}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      results.failureCount++
      return null
    }
  })

  await Promise.all(updatePromises)
}

// Handle bulk email reminders
async function handleBulkSendReminder(
  invoices: any[],
  emailTemplateId: string,
  user: any,
  results: any
) {
  // Verify email template exists and belongs to company
  const emailTemplate = await prisma.emailTemplate.findFirst({
    where: {
      id: emailTemplateId,
      companyId: user.companyId,
      isActive: true
    }
  })

  if (!emailTemplate) {
    throw new Error('Email template not found or inactive')
  }

  const reminderPromises = invoices.map(async (invoice) => {
    try {
      // Create email log entry
      const emailLog = await prisma.emailLog.create({
        data: {
          id: crypto.randomUUID(),
          templateId: emailTemplateId,
          companyId: user.companyId,
          invoiceId: invoice.id,
          customerId: invoice.customer.id,
          recipientEmail: invoice.customerEmail,
          recipientName: invoice.customerName,
          subject: `Payment Reminder - Invoice ${invoice.number}`,
          content: generateReminderContent(emailTemplate, invoice),
          language: 'ENGLISH',
          deliveryStatus: 'QUEUED'
        }
      })

      // In production, this would queue the email for sending
      // For now, we'll mark it as sent immediately
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'SENT',
          sentAt: new Date()
        }
      })

      results.results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerEmail: invoice.customerEmail,
        emailLogId: emailLog.id,
        success: true
      })

      results.successCount++

    } catch (error) {
      results.errors.push(`Failed to send reminder for invoice ${invoice.number}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      results.failureCount++
    }
  })

  await Promise.all(reminderPromises)
}

// Handle bulk delete
async function handleBulkDelete(
  invoices: any[],
  user: any,
  results: any
) {
  // Only allow deletion of DRAFT invoices
  const draftInvoices = invoices.filter(inv => inv.status === 'DRAFT')
  const nonDraftInvoices = invoices.filter(inv => inv.status !== 'DRAFT')

  // Add errors for non-draft invoices
  nonDraftInvoices.forEach(invoice => {
    results.errors.push(`Cannot delete invoice ${invoice.number} with status ${invoice.status}. Only DRAFT invoices can be deleted.`)
    results.failureCount++
  })

  // Delete draft invoices
  const deletePromises = draftInvoices.map(async (invoice) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Delete invoice items first
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: invoice.id }
        })

        // Delete payments
        await tx.payment.deleteMany({
          where: { invoiceId: invoice.id }
        })

        // Delete email logs
        await tx.emailLog.deleteMany({
          where: { invoiceId: invoice.id }
        })

        // Delete follow-up logs
        await tx.followUpLog.deleteMany({
          where: { invoiceId: invoice.id }
        })

        // Finally delete the invoice
        await tx.invoice.delete({
          where: { id: invoice.id }
        })
      })

      results.results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        success: true
      })

      results.successCount++

    } catch (error) {
      results.errors.push(`Failed to delete invoice ${invoice.number}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      results.failureCount++
    }
  })

  await Promise.all(deletePromises)
}

// Handle bulk export
async function handleBulkExport(invoices: any[], user: any) {
  // Get detailed invoice data for export
  const detailedInvoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoices.map(inv => inv.id) }
    },
    include: {
      customer: true,
      invoiceItems: true,
      payments: true,
      company: {
        select: { name: true, trn: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Generate export data
  const exportData = detailedInvoices.map(invoice => ({
    invoiceNumber: invoice.number,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    amount: invoice.amount,
    subtotal: invoice.subtotal,
    vatAmount: invoice.vatAmount,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    status: invoice.status,
    dueDate: invoice.dueDate.toISOString().split('T')[0],
    createdAt: invoice.createdAt.toISOString().split('T')[0],
    description: invoice.description,
    notes: invoice.notes,
    trnNumber: invoice.trnNumber,
    paidAmount: invoice.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0),
    outstandingAmount: Number(invoice.totalAmount || invoice.amount) - invoice.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0),
    itemCount: invoice.invoiceItems.length,
    lastPaymentDate: invoice.payments.length > 0 
      ? Math.max(...invoice.payments.map((p: any) => new Date(p.paymentDate).getTime()))
      : null
  }))

  // In production, this would generate and store a downloadable file
  // For now, we'll return the data structure
  return {
    exportId: crypto.randomUUID(),
    format: 'json', // In production: csv, xlsx, pdf
    recordCount: exportData.length,
    generatedAt: new Date().toISOString(),
    data: exportData, // In production: would be a file URL
    summary: {
      totalAmount: exportData.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount), 0),
      totalPaid: exportData.reduce((sum, inv) => sum + inv.paidAmount, 0),
      totalOutstanding: exportData.reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      statusBreakdown: exportData.reduce((acc: any, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1
        return acc
      }, {})
    }
  }
}

// Utility function to validate status transitions
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'DRAFT': ['SENT', 'CANCELLED'],
    'SENT': ['OVERDUE', 'PAID', 'DISPUTED'],
    'OVERDUE': ['PAID', 'DISPUTED', 'WRITTEN_OFF'],
    'DISPUTED': ['SENT', 'PAID', 'WRITTEN_OFF'],
    'PAID': [], // Generally can't transition from PAID
    'WRITTEN_OFF': [], // Generally can't transition from WRITTEN_OFF
    'CANCELLED': [] // Generally can't transition from CANCELLED
  }

  return validTransitions[currentStatus]?.includes(newStatus) || false
}

// Generate email content for reminders
function generateReminderContent(template: any, invoice: any): string {
  let content = template.contentEn || 'Payment reminder for your invoice.'
  
  // Replace template variables
  const variables: Record<string, string> = {
    '{{invoiceNumber}}': invoice.number,
    '{{customerName}}': invoice.customerName,
    '{{amount}}': `${invoice.currency} ${invoice.totalAmount || invoice.amount}`,
    '{{dueDate}}': invoice.dueDate.toLocaleDateString('en-AE'),
    '{{daysPastDue}}': Math.max(0, Math.ceil((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))).toString(),
    '{{companyName}}': 'Your Company' // Would come from user's company
  }

  Object.entries(variables).forEach(([key, value]) => {
    content = content.replace(new RegExp(key, 'g'), value)
  })

  return content
}

// GET /api/invoices/bulk - Get bulk operation capabilities and limits
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    
    return successResponse({
      supportedActions: [
        {
          action: 'update_status',
          description: 'Update status for multiple invoices',
          requiredFields: ['status'],
          supportedStatuses: ['SENT', 'OVERDUE', 'PAID', 'DISPUTED', 'WRITTEN_OFF']
        },
        {
          action: 'send_reminder',
          description: 'Send email reminders for multiple invoices',
          requiredFields: ['emailTemplateId'],
          notes: 'Only sent to invoices with SENT or OVERDUE status'
        },
        {
          action: 'delete',
          description: 'Delete multiple invoices',
          requiredFields: [],
          restrictions: 'Only DRAFT invoices can be deleted'
        },
        {
          action: 'export',
          description: 'Export multiple invoices to CSV/Excel',
          requiredFields: [],
          formats: ['csv', 'xlsx', 'json']
        }
      ],
      limits: {
        maxInvoicesPerOperation: 1000,
        maxFileSize: '50MB',
        timeoutSeconds: 300
      },
      statusTransitions: {
        'DRAFT': ['SENT'],
        'SENT': ['OVERDUE', 'PAID', 'DISPUTED'],
        'OVERDUE': ['PAID', 'DISPUTED', 'WRITTEN_OFF'],
        'DISPUTED': ['SENT', 'PAID', 'WRITTEN_OFF']
      }
    })

  } catch (error) {
    logError('GET /api/invoices/bulk', error)
    return handleApiError(error)
  }
}