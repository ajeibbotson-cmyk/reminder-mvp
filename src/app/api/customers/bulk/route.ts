import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { validateRequestBody, validateUAETRN } from '@/lib/validations'
import { UserRole, Prisma } from '@prisma/client'
import { z } from 'zod'

// Bulk operations schema
const bulkCustomerActionSchema = z.object({
  action: z.enum(['update', 'delete', 'archive', 'export', 'merge']),
  customerIds: z.array(z.string().min(1)).min(1, 'At least one customer ID is required').max(100, 'Maximum 100 customers per bulk operation'),
  companyId: z.string().min(1, 'Company ID is required'),
  updateData: z.object({
    paymentTerms: z.number().int().positive().max(365).optional(),
    creditLimit: z.number().positive().multipleOf(0.01).optional(),
    notes: z.string().max(1000).optional(),
    notesAr: z.string().max(1000).optional(),
    businessType: z.enum(['LLC', 'FREE_ZONE', 'SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'BRANCH']).optional(),
    isActive: z.boolean().optional()
  }).optional(),
  mergeData: z.object({
    primaryCustomerId: z.string().min(1),
    secondaryCustomerIds: z.array(z.string().min(1)).min(1)
  }).optional(),
  exportFormat: z.enum(['csv', 'xlsx', 'json']).default('csv').optional(),
  reason: z.string().max(500).optional() // For audit trail
})

// POST /api/customers/bulk - Bulk customer operations
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions for bulk customer operations')
    }

    const bulkAction = await validateRequestBody(request, bulkCustomerActionSchema)
    
    // Ensure user can only operate on their company's customers
    if (bulkAction.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to company data')
    }

    // Validate that all customers belong to the user's company
    const customersToProcess = await prisma.customers.findMany({
      where: {
        id: { in: bulkAction.customerIds },
        companyId: authContext.user.companyId,
        isActive: true
      },
      include: {
        invoices: {
          where: { isActive: true },
          select: {
            id: true,
            status: true,
            amount: true,
            totalAmount: true,
            payments: {
              select: { amount: true }
            }
          }
        }
      }
    })

    if (customersToProcess.length !== bulkAction.customerIds.length) {
      throw new Error('Some customers were not found or you do not have access to them')
    }

    let results: any = {
      action: bulkAction.action,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      details: []
    }

    // Execute bulk operation
    switch (bulkAction.action) {
      case 'update':
        results = await performBulkUpdate(
          authContext.user.companyId,
          authContext.user.id,
          customersToProcess,
          bulkAction.updateData!
        )
        break

      case 'delete':
      case 'archive':
        results = await performBulkArchive(
          authContext.user.companyId,
          authContext.user.id,
          customersToProcess,
          bulkAction.reason
        )
        break

      case 'merge':
        if (!bulkAction.mergeData) {
          throw new Error('Merge data is required for merge operation')
        }
        results = await performBulkMerge(
          authContext.user.companyId,
          authContext.user.id,
          bulkAction.mergeData
        )
        break

      case 'export':
        results = await performBulkExport(
          customersToProcess,
          bulkAction.exportFormat || 'csv'
        )
        break

      default:
        throw new Error(`Unsupported bulk action: ${bulkAction.action}`)
    }

    const responseTime = Date.now() - startTime

    // Log bulk operation for audit
    await prisma.activities.create({
      data: {
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: `customer_bulk_${bulkAction.action}`,
        description: `Bulk ${bulkAction.action} operation on ${results.processedCount} customers`,
        metadata: {
          action: bulkAction.action,
          customerIds: bulkAction.customerIds,
          processedCount: results.processedCount,
          successCount: results.successCount,
          failureCount: results.failureCount,
          reason: bulkAction.reason,
          responseTime
        }
      }
    })

    return successResponse({
      ...results,
      responseTime
    }, `Bulk ${bulkAction.action} operation completed`)

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('POST /api/customers/bulk', error, { 
      userId: 'authContext.user?.id',
      responseTime
    })
    return handleApiError(error)
  }
}

// Bulk update implementation
async function performBulkUpdate(
  companyId: string,
  userId: string,
  customers: any[],
  updateData: any
) {
  const results = {
    action: 'update',
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    errors: [],
    details: []
  }

  for (const customer of customers) {
    try {
      results.processedCount++

      await prisma.$transaction(async (tx) => {
        // Build update object
        const updateFields: Prisma.CustomerUpdateInput = {}
        
        if (updateData.paymentTerms !== undefined) updateFields.paymentTerms = updateData.paymentTerms
        if (updateData.creditLimit !== undefined) updateFields.creditLimit = updateData.creditLimit
        if (updateData.notes !== undefined) updateFields.notes = updateData.notes
        if (updateData.notesAr !== undefined) updateFields.notesAr = updateData.notesAr
        if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive
        // Note: businessType field needs to be added to schema
        // if (updateData.businessType !== undefined) updateFields.businessType = updateData.businessType

        const updatedCustomer = await tx.customer.update({
          where: { id: customer.id },
          data: updateFields
        })

        // Log individual update
        await tx.activity.create({
          data: {
            companyId,
            userId,
            type: 'customer_bulk_update_item',
            description: `Bulk updated customer ${customer.name}`,
            metadata: {
              customerId: customer.id,
              changedFields: Object.keys(updateData).filter(key => updateData[key] !== undefined),
              oldValues: {
                paymentTerms: customer.paymentTerms,
                creditLimit: customer.creditLimit?.toString(),
                notes: customer.notes,
                notesAr: customer.notesAr
              },
              newValues: updateData
            }
          }
        })

        results.successCount++
        results.details.push({
          customerId: customer.id,
          customerName: customer.name,
          status: 'success',
          changes: Object.keys(updateData).filter(key => updateData[key] !== undefined)
        })
      })

    } catch (error) {
      results.failureCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push({
        customerId: customer.id,
        customerName: customer.name,
        error: errorMessage
      })
      results.details.push({
        customerId: customer.id,
        customerName: customer.name,
        status: 'failed',
        error: errorMessage
      })
    }
  }

  return results
}

// Bulk archive implementation
async function performBulkArchive(
  companyId: string,
  userId: string,
  customers: any[],
  reason?: string
) {
  const results = {
    action: 'archive',
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    errors: [],
    details: []
  }

  for (const customer of customers) {
    try {
      results.processedCount++

      // Check business rules before archiving
      const activeInvoices = customer.invoices.filter((invoice: any) => 
        ['SENT', 'OVERDUE', 'DISPUTED'].includes(invoice.status)
      )
      
      const unpaidInvoices = customer.invoices.filter((invoice: any) => 
        ['SENT', 'OVERDUE', 'DISPUTED'].includes(invoice.status) && 
        invoice.payments.length === 0
      )

      if (activeInvoices.length > 0 || unpaidInvoices.length > 0) {
        throw new Error(`Customer has ${activeInvoices.length} active and ${unpaidInvoices.length} unpaid invoices`)
      }

      await prisma.$transaction(async (tx) => {
        // Soft delete customer
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            isActive: false,
            archivedAt: new Date(),
            email: `${customer.email}_archived_${Date.now()}`
          }
        })

        // Archive related invoices
        await tx.invoice.updateMany({
          where: {
            customerEmail: customer.email,
            companyId,
            isActive: true
          },
          data: {
            isActive: false,
            archivedAt: new Date()
          }
        })

        // Log archival
        await tx.activity.create({
          data: {
            companyId,
            userId,
            type: 'customer_bulk_archive_item',
            description: `Bulk archived customer ${customer.name}`,
            metadata: {
              customerId: customer.id,
              customerName: customer.name,
              customerEmail: customer.email,
              reason: reason || 'Bulk archive operation',
              totalInvoices: customer.invoices.length
            }
          }
        })

        results.successCount++
        results.details.push({
          customerId: customer.id,
          customerName: customer.name,
          status: 'archived',
          archivedAt: new Date().toISOString()
        })
      })

    } catch (error) {
      results.failureCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push({
        customerId: customer.id,
        customerName: customer.name,
        error: errorMessage
      })
      results.details.push({
        customerId: customer.id,
        customerName: customer.name,
        status: 'failed',
        error: errorMessage
      })
    }
  }

  return results
}

// Bulk merge implementation
async function performBulkMerge(
  companyId: string,
  userId: string,
  mergeData: { primaryCustomerId: string; secondaryCustomerIds: string[] }
) {
  const results = {
    action: 'merge',
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    errors: [],
    details: []
  }

  try {
    const primaryCustomer = await prisma.customers.findUnique({
      where: { 
        id: mergeData.primaryCustomerId,
        companyId,
        isActive: true 
      },
      include: {
        invoices: { where: { isActive: true } }
      }
    })

    if (!primaryCustomer) {
      throw new Error('Primary customer not found')
    }

    const secondaryCustomers = await prisma.customers.findMany({
      where: {
        id: { in: mergeData.secondaryCustomerIds },
        companyId,
        isActive: true
      },
      include: {
        invoices: { where: { isActive: true } }
      }
    })

    await prisma.$transaction(async (tx) => {
      for (const secondaryCustomer of secondaryCustomers) {
        results.processedCount++

        // Transfer all invoices to primary customer
        await tx.invoice.updateMany({
          where: {
            customerEmail: secondaryCustomer.email,
            companyId
          },
          data: {
            customerEmail: primaryCustomer.email,
            customerName: primaryCustomer.name,
            customerNameAr: primaryCustomer.nameAr
          }
        })

        // Archive secondary customer
        await tx.customer.update({
          where: { id: secondaryCustomer.id },
          data: {
            isActive: false,
            archivedAt: new Date(),
            email: `${secondaryCustomer.email}_merged_${Date.now()}`,
            notes: `${secondaryCustomer.notes || ''}\n\nMerged into ${primaryCustomer.name} (${primaryCustomer.email}) on ${new Date().toISOString()}`
          }
        })

        // Log merge operation
        await tx.activity.create({
          data: {
            companyId,
            userId,
            type: 'customer_merged',
            description: `Merged customer ${secondaryCustomer.name} into ${primaryCustomer.name}`,
            metadata: {
              primaryCustomerId: primaryCustomer.id,
              secondaryCustomerId: secondaryCustomer.id,
              transferredInvoices: secondaryCustomer.invoices.length,
              mergedAt: new Date().toISOString()
            }
          }
        })

        results.successCount++
        results.details.push({
          customerId: secondaryCustomer.id,
          customerName: secondaryCustomer.name,
          status: 'merged',
          mergedInto: {
            id: primaryCustomer.id,
            name: primaryCustomer.name,
            email: primaryCustomer.email
          },
          transferredInvoices: secondaryCustomer.invoices.length
        })
      }
    })

  } catch (error) {
    results.failureCount++
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    results.errors.push({
      error: errorMessage
    })
  }

  return results
}

// Bulk export implementation
async function performBulkExport(customers: any[], format: string) {
  const results = {
    action: 'export',
    processedCount: customers.length,
    successCount: customers.length,
    failureCount: 0,
    errors: [],
    details: []
  }

  // Calculate customer metrics for export
  const exportData = customers.map(customer => {
    const totalInvoiced = customer.invoices.reduce((sum: number, invoice: any) => 
      sum + (invoice.totalAmount || invoice.amount), 0
    )
    
    const totalPaid = customer.invoices.reduce((sum: number, invoice: any) => 
      sum + invoice.payments.reduce((pSum: number, payment: any) => pSum + payment.amount, 0), 0
    )
    
    const outstandingBalance = totalInvoiced - totalPaid

    return {
      id: customer.id,
      name: customer.name,
      nameAr: customer.nameAr,
      email: customer.email,
      phone: customer.phone,
      paymentTerms: customer.paymentTerms,
      creditLimit: customer.creditLimit,
      totalInvoices: customer.invoices.length,
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    }
  })

  // Generate download link or return data based on format
  if (format === 'json') {
    results.details = exportData
  } else {
    // For CSV/XLSX, you would typically generate a file and return a download URL
    // For now, we'll return the data structure
    results.details = {
      format,
      dataRows: exportData.length,
      downloadUrl: `/api/customers/bulk/download/${Date.now()}.${format}`,
      data: exportData
    }
  }

  return results
}