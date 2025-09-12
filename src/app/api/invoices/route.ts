import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { 
  createInvoiceSchema, 
  createInvoiceWithVatSchema,
  invoiceFiltersSchema, 
  validateRequestBody, 
  validateQueryParams 
} from '@/lib/validations'
import { calculateInvoiceVAT } from '@/lib/vat-calculator'
import { UserRole } from '@prisma/client'

// GET /api/invoices - Fetch invoices with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const filters = validateQueryParams(searchParams, invoiceFiltersSchema)
    
    // Ensure user can only access their company's invoices
    if (filters.companyId !== authContext.user.companyId) {
      filters.companyId = authContext.user.companyId
    }

    const skip = (filters.page - 1) * filters.limit

    // Build where clause with optimized filters
    const where: Record<string, unknown> = {
      companyId: filters.companyId,
    }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.customerEmail) {
      where.customerEmail = filters.customerEmail
    }

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: filters.startDate,
        lte: filters.endDate
      }
    } else if (filters.startDate) {
      where.createdAt = { gte: filters.startDate }
    } else if (filters.endDate) {
      where.createdAt = { lte: filters.endDate }
    }

    if (filters.minAmount || filters.maxAmount) {
      where.amount = {}
      if (filters.minAmount) where.amount.gte = filters.minAmount
      if (filters.maxAmount) where.amount.lte = filters.maxAmount
    }

    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { customerName: { contains: filters.search, mode: 'insensitive' } },
        { customerEmail: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    // Execute queries in parallel for better performance
    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          company: true,
          payments: {
            orderBy: { createdAt: 'desc' }
          },
          invoiceItems: {
            orderBy: { createdAt: 'asc' }
          },
          followUpLogs: {
            orderBy: { sentAt: 'desc' },
            take: 5
          },
          importBatches: {
            select: {
              id: true,
              originalFilename: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit
      }),
      prisma.invoice.count({ where })
    ])

    return successResponse({
      invoices,
      totalCount,
      page: filters.page,
      limit: filters.limit,
      hasMore: skip + invoices.length < totalCount
    })

  } catch (error) {
    logError('GET /api/invoices', error, { 
      userId: 'authContext.user?.id',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// POST /api/invoices - Create new invoice
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to create invoices')
    }

    const invoiceData = await validateRequestBody(request, createInvoiceWithVatSchema)
    
    // Ensure user can only create invoices for their company
    if (invoiceData.companyId !== authContext.user.companyId) {
      invoiceData.companyId = authContext.user.companyId
    }

    // Create invoice in a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if customer exists, create if not
      let customer = await tx.customer.findUnique({
        where: {
          email_companyId: {
            email: invoiceData.customerEmail,
            companyId: invoiceData.companyId
          }
        }
      })

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name: invoiceData.customerName,
            email: invoiceData.customerEmail,
            companyId: invoiceData.companyId
          }
        })
      }

      // Calculate VAT if line items are provided
      let vatCalculation = null
      if (invoiceData.items && invoiceData.items.length > 0) {
        vatCalculation = calculateInvoiceVAT(
          invoiceData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxCategory: item.taxCategory || 'STANDARD'
          })),
          invoiceData.currency
        )
      }

      // Create invoice with VAT calculations
      const invoice = await tx.invoice.create({
        data: {
          id: crypto.randomUUID(),
          companyId: invoiceData.companyId,
          number: invoiceData.number,
          customerName: invoiceData.customerName,
          customerEmail: invoiceData.customerEmail,
          amount: invoiceData.amount,
          subtotal: vatCalculation ? vatCalculation.subtotal.toNumber() : invoiceData.subtotal,
          vatAmount: vatCalculation ? vatCalculation.totalVatAmount.toNumber() : invoiceData.vatAmount,
          totalAmount: vatCalculation ? vatCalculation.grandTotal.toNumber() : invoiceData.totalAmount,
          currency: invoiceData.currency,
          dueDate: invoiceData.dueDate,
          status: invoiceData.status,
          description: invoiceData.description,
          descriptionAr: invoiceData.descriptionAr,
          notes: invoiceData.notes,
          notesAr: invoiceData.notesAr,
          trnNumber: invoiceData.trnNumber,
          importBatchId: invoiceData.importBatchId
        }
      })

      // Create invoice items with VAT calculations
      if (invoiceData.items && invoiceData.items.length > 0) {
        const itemsWithVat = vatCalculation ? vatCalculation.lineItems : invoiceData.items
        
        await tx.invoiceItem.createMany({
          data: itemsWithVat.map((item: any, index: number) => ({
            id: crypto.randomUUID(),
            invoiceId: invoice.id,
            description: item.description,
            descriptionAr: invoiceData.items[index]?.descriptionAr,
            quantity: item.quantity || invoiceData.items[index]?.quantity,
            unitPrice: item.unitPrice || invoiceData.items[index]?.unitPrice,
            total: item.lineTotal || item.total,
            vatRate: item.vatRate || invoiceData.items[index]?.vatRate || 5.00,
            vatAmount: item.vatAmount || invoiceData.items[index]?.vatAmount || 0.00,
            totalWithVat: item.totalWithVat || invoiceData.items[index]?.totalWithVat,
            taxCategory: item.taxCategory || invoiceData.items[index]?.taxCategory || 'STANDARD'
          }))
        })
      }

      // Log activity
      await tx.activity.create({
        data: {
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_created',
          description: `Created invoice ${invoice.number} for ${invoiceData.customerName}`,
          metadata: {
            invoiceId: invoice.id,
            amount: invoiceData.amount,
            currency: invoiceData.currency
          }
        }
      })

      return invoice
    })

    return successResponse(result, 'Invoice created successfully')

  } catch (error) {
    logError('POST /api/invoices', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}