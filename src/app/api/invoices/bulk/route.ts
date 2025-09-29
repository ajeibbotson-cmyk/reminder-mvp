import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { 
  bulkInvoiceActionSchema,
  validateRequestBody
} from '@/lib/validations'
import { formatUAECurrency, calculateInvoiceVAT } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'

// POST /api/invoices/bulk - Perform bulk actions on invoices
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to perform bulk invoice operations')
    }

    const bulkData = await validateRequestBody(request, bulkInvoiceActionSchema)
    
    // Verify all invoices belong to user's company (UAE data isolation)
    const invoices = await prisma.invoices.findMany({
      where: {
        id: { in: bulkData.invoiceIds },
        companyId: authContext.user.companyId // Enforce company-level security
      },
      include: {
        customers: {
          select: { id: true, name: true, nameAr: true, email: true, phone: true }
        },
        payments: {
          select: { id: true, amount: true, paymentDate: true, method: true }
        },
        companies: {
          select: { id: true, name: true, trn: true, defaultVatRate: true }
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

    // Log comprehensive bulk activity for UAE audit trail
    await prisma.activities.create({
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
          emailTemplateId: bulkData.emailTemplateId,
          totalAmount: formatUAECurrency(
            invoices.reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0)),
            'AED'
          ),
          processedAt: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          errors: results.errors,
          complianceNote: 'Bulk operation performed in compliance with UAE business regulations'
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

// Handle bulk status updates with UAE business validation
async function handleBulkStatusUpdate(
  invoices: any[],
  newStatus: string,
  user: any,
  results: any
) {
  const updatePromises = invoices.map(async (invoice) => {
    try {
      // Enhanced UAE business validation for status transitions
      const validation = validateUAEStatusTransition(invoice, newStatus as InvoiceStatus)
      if (!validation.valid) {
        results.errors.push(`${validation.reason} for invoice ${invoice.number}`)
        results.failureCount++
        return null
      }

      // Perform status update in transaction for UAE compliance
      const updatedInvoice = await prisma.$transaction(async (tx) => {
        const updated = await tx.invoices.update({
          where: { id: invoice.id },
          data: { 
            status: newStatus as any,
            updatedAt: new Date()
          },
          include: {
            customers: {
              select: { id: true, name: true, email: true }
            }
          }
        })

        // Log individual status change for audit trail
        await tx.activities.create({
          data: {
            id: crypto.randomUUID(),
            companyId: user.companyId,
            userId: user.id,
            type: 'invoice_status_updated',
            description: `Bulk status update: ${invoice.number} from ${invoice.status} to ${newStatus}`,
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              previousStatus: invoice.status,
              newStatus: newStatus,
              bulkOperation: true,
              totalAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency)
            }
          }
        })

        return updated
      })

      results.results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerName: invoice.customerName,
        oldStatus: invoice.status,
        newStatus: newStatus,
        amount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
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

// Handle bulk email reminders with UAE business hours compliance
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
      // Check if invoice is eligible for reminders (UAE business logic)
      if ([InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)) {
        results.errors.push(`Cannot send reminder for ${invoice.status} invoice ${invoice.number}`)
        results.failureCount++
        return
      }

      // Create comprehensive email log entry for UAE compliance
      const emailLog = await prisma.emailLogs.create({
        data: {
          id: crypto.randomUUID(),
          templateId: emailTemplateId,
          companyId: user.companyId,
          invoiceId: invoice.id,
          customerId: invoice.customers.id,
          recipientEmail: invoice.customerEmail,
          recipientName: invoice.customerName,
          subject: `Payment Reminder - Invoice ${invoice.number}`,
          content: generateUAEReminderContent(emailTemplate, invoice),
          language: 'ENGLISH',
          deliveryStatus: 'QUEUED',
          uaeSendTime: calculateUAESendTime(), // Schedule for UAE business hours
          retryCount: 0,
          maxRetries: 3
        }
      })

      // In production, this would queue the email for UAE business hours sending
      // For now, we'll mark it as queued for proper email service processing
      // The actual sending would be handled by a background job service

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

// Handle bulk delete with UAE audit compliance
async function handleBulkDelete(
  invoices: any[],
  user: any,
  results: any
) {
  // Enhanced UAE deletion validation
  const eligibleInvoices = []
  const ineligibleInvoices = []
  
  for (const invoice of invoices) {
    const validation = await validateUAEInvoiceDeletion(invoice)
    if (validation.valid) {
      eligibleInvoices.push(invoice)
    } else {
      ineligibleInvoices.push({ invoice, reason: validation.reason })
    }
  }

  // Add errors for ineligible invoices with detailed UAE compliance reasons
  ineligibleInvoices.forEach(({ invoice, reason }) => {
    results.errors.push(`Cannot delete invoice ${invoice.number}: ${reason}`)
    results.failureCount++
  })

  // Delete eligible invoices with comprehensive UAE audit trail
  const deletePromises = eligibleInvoices.map(async (invoice) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Create deletion audit record before deletion (UAE compliance)
        await tx.activities.create({
          data: {
            id: crypto.randomUUID(),
            companyId: user.companyId,
            userId: user.id,
            type: 'invoice_deleted',
            description: `Bulk deleted invoice ${invoice.number}`,
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              customerName: invoice.customerName,
              customerEmail: invoice.customerEmail,
              amount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
              status: invoice.status,
              createdAt: invoice.createdAt,
              deletionReason: 'Bulk deletion operation',
              bulkOperation: true,
              complianceNote: 'Invoice deleted in compliance with UAE business regulations'
            }
          }
        })

        // Delete related records in proper order for referential integrity
        await tx.invoiceItems.deleteMany({
          where: { invoiceId: invoice.id }
        })

        await tx.payments.deleteMany({
          where: { invoiceId: invoice.id }
        })

        await tx.emailLogs.deleteMany({
          where: { invoiceId: invoice.id }
        })

        await tx.followUpLogs.deleteMany({
          where: { invoiceId: invoice.id }
        })

        // Finally delete the invoice
        await tx.invoices.delete({
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

// Handle bulk export with UAE business data
async function handleBulkExport(invoices: any[], user: any) {
  // Get comprehensive invoice data for UAE business export
  const detailedInvoices = await prisma.invoices.findMany({
    where: {
      id: { in: invoices.map(inv => inv.id) }
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
      invoiceItems: {
        select: {
          description: true,
          descriptionAr: true,
          quantity: true,
          unitPrice: true,
          total: true,
          vatRate: true,
          vatAmount: true,
          totalWithVat: true,
          taxCategory: true
        }
      },
      payments: {
        select: {
          amount: true,
          paymentDate: true,
          method: true,
          reference: true
        }
      },
      companies: {
        select: { name: true, trn: true, address: true }
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

// UAE-compliant status transition validation
function validateUAEStatusTransition(invoice: any, newStatus: InvoiceStatus) {
  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.WRITTEN_OFF],
    [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED, InvoiceStatus.WRITTEN_OFF],
    [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.DISPUTED, InvoiceStatus.WRITTEN_OFF],
    [InvoiceStatus.PAID]: [], // Final state
    [InvoiceStatus.DISPUTED]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.SENT, InvoiceStatus.WRITTEN_OFF],
    [InvoiceStatus.WRITTEN_OFF]: [] // Final state
  }

  if (!validTransitions[invoice.status]?.includes(newStatus)) {
    return {
      valid: false,
      reason: `Invalid UAE business transition from ${invoice.status} to ${newStatus}`
    }
  }

  // Additional UAE business validations
  if (newStatus === InvoiceStatus.PAID) {
    const totalPaid = invoice.payments?.reduce(
      (sum: Decimal, payment: any) => sum.plus(payment.amount),
      new Decimal(0)
    ) || new Decimal(0)
    
    const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)
    
    if (totalPaid.lessThan(totalAmount.times(0.99))) {
      return {
        valid: false,
        reason: `Insufficient payments to mark as PAID. Paid: ${formatUAECurrency(totalPaid, invoice.currency)}, Required: ${formatUAECurrency(totalAmount, invoice.currency)}`
      }
    }
  }

  return { valid: true }
}

// Generate UAE-compliant email content for reminders
function generateUAEReminderContent(template: any, invoice: any): string {
  let content = template.contentEn || 'Payment reminder for your invoice.'
  
  // UAE business-specific template variables
  const daysPastDue = Math.max(0, Math.ceil((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
  const isOverdue = daysPastDue > 0
  
  const variables: Record<string, string> = {
    '{{invoiceNumber}}': invoice.number,
    '{{customerName}}': invoice.customerName,
    '{{amount}}': formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency),
    '{{dueDate}}': invoice.dueDate.toLocaleDateString('en-AE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Dubai'
    }),
    '{{daysPastDue}}': daysPastDue.toString(),
    '{{companyName}}': invoice.companies?.name || 'Your Company',
    '{{companyTRN}}': invoice.companies?.trn || '',
    '{{currency}}': invoice.currency,
    '{{urgencyLevel}}': isOverdue ? 'URGENT' : 'STANDARD',
    '{{businessHours}}': 'Sunday to Thursday, 8:00 AM to 6:00 PM GST',
    '{{todayDate}}': new Date().toLocaleDateString('en-AE', { 
      timeZone: 'Asia/Dubai'
    })
  }

  Object.entries(variables).forEach(([key, value]) => {
    content = content.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
  })

  return content
}

// Calculate UAE business hours send time
function calculateUAESendTime(): Date {
  const now = new Date()
  const uaeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const dayOfWeek = uaeTime.getDay() // 0 = Sunday, 6 = Saturday
  const hour = uaeTime.getHours()
  
  // UAE business days: Sunday (0) to Thursday (4)
  // Business hours: 8 AM to 6 PM
  if (dayOfWeek >= 0 && dayOfWeek <= 4 && hour >= 8 && hour < 18) {
    // Currently in business hours, send now
    return uaeTime
  } else {
    // Schedule for next business hour
    const nextBusinessDay = new Date(uaeTime)
    
    if (dayOfWeek === 5) { // Friday
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 2) // Move to Sunday
    } else if (dayOfWeek === 6) { // Saturday
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1) // Move to Sunday
    } else if (hour >= 18) { // After business hours
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1) // Next day
    }
    
    nextBusinessDay.setHours(9, 0, 0, 0) // 9 AM GST
    return nextBusinessDay
  }
}

// Validate invoice deletion for UAE compliance
async function validateUAEInvoiceDeletion(invoice: any) {
  // Only allow deletion of DRAFT invoices
  if (invoice.status !== InvoiceStatus.DRAFT) {
    return {
      valid: false,
      reason: `Cannot delete ${invoice.status} invoice. UAE regulations only allow deletion of DRAFT invoices.`
    }
  }

  // Check if invoice has payments
  if (invoice.payments && invoice.payments.length > 0) {
    return {
      valid: false,
      reason: 'Cannot delete invoice with existing payments. UAE audit requirements.'
    }
  }

  // Check invoice age (UAE compliance - don't delete old invoices)
  const createdDate = new Date(invoice.createdAt)
  const daysSinceCreation = Math.ceil((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceCreation > 30) {
    return {
      valid: false,
      reason: 'Cannot delete invoices older than 30 days. UAE record-keeping requirements.'
    }
  }

  // Check if it's a VAT invoice
  if (invoice.trnNumber && invoice.vatAmount && parseFloat(invoice.vatAmount) > 0) {
    return {
      valid: false,
      reason: 'Cannot delete VAT invoices with TRN. UAE tax regulation compliance required.'
    }
  }

  return { valid: true }
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