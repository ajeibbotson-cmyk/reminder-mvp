import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole, canManageInvoices } from '@/lib/auth-utils'
import { 
  createInvoiceWithVatSchema,
  invoiceFiltersSchema, 
  validateRequestBody, 
  validateQueryParams,
  validateUAETRN,
  UAE_TRN_REGEX
} from '@/lib/validations'
import { calculateInvoiceVAT, validateUAETRN as validateTRN, formatUAECurrency } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'

// GET /api/invoices - Fetch invoices with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const filters = validateQueryParams(searchParams, invoiceFiltersSchema)
    
    // Enforce company-level data isolation - always filter by user's company
    filters.companyId = authContext.user.companyId

    const skip = (filters.page - 1) * filters.limit

    // Build comprehensive where clause with optimized filters for UAE business
    const where: Record<string, unknown> = {
      companyId: filters.companyId, // Company-level data isolation
    }

    // Status filtering with enum validation
    if (filters.status) {
      where.status = filters.status
    }

    // Customer email filtering
    if (filters.customerEmail) {
      where.customerEmail = {
        equals: filters.customerEmail,
        mode: 'insensitive'
      }
    }

    // Date range filtering (invoice creation or due dates)
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

    // Due date filtering for UAE payment terms
    if (filters.dueDateStart && filters.dueDateEnd) {
      where.dueDate = {
        gte: filters.dueDateStart,
        lte: filters.dueDateEnd
      }
    } else if (filters.dueDateStart) {
      where.dueDate = { gte: filters.dueDateStart }
    } else if (filters.dueDateEnd) {
      where.dueDate = { lte: filters.dueDateEnd }
    }

    // Amount filtering with Decimal support
    if (filters.minAmount || filters.maxAmount) {
      where.totalAmount = {}
      if (filters.minAmount) where.totalAmount.gte = new Decimal(filters.minAmount)
      if (filters.maxAmount) where.totalAmount.lte = new Decimal(filters.maxAmount)
    }

    // Currency filtering (default to AED for UAE)
    if (filters.currency) {
      where.currency = filters.currency
    }

    // TRN filtering for UAE tax compliance
    if (filters.trnNumber) {
      where.trnNumber = {
        contains: filters.trnNumber,
        mode: 'insensitive'
      }
    }

    // Comprehensive search across multiple fields (English and Arabic)
    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { customerName: { contains: filters.search, mode: 'insensitive' } },
        { customerEmail: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { descriptionAr: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { notesAr: { contains: filters.search, mode: 'insensitive' } },
        { trnNumber: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    // Advanced filtering for overdue invoices (UAE business logic)
    if (filters.isOverdue) {
      where.AND = [
        { status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } },
        { dueDate: { lt: new Date() } }
      ]
    }

    // Filter by payment status
    if (filters.hasPayments !== undefined) {
      where.payments = filters.hasPayments ? { some: {} } : { none: {} }
    }

    // Determine sorting order
    const orderBy = getInvoiceOrderBy(filters.sortBy, filters.sortOrder)

    // Execute optimized queries in parallel for better performance
    const [invoices, totalCount, statusCounts] = await Promise.all([
      prisma.invoices.findMany({
        where,
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
            orderBy: { paymentDate: 'desc' },
            take: filters.includeAllPayments ? undefined : 5
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
          },
          followUpLogs: {
            select: {
              id: true,
              stepNumber: true,
              emailAddress: true,
              subject: true,
              sentAt: true,
              emailOpened: true,
              responseReceived: true,
              deliveryStatus: true
            },
            orderBy: { sentAt: 'desc' },
            take: 3
          },
          importBatches: {
            select: {
              id: true,
              originalFilename: true,
              status: true,
              createdAt: true
            }
          },
          emailLogs: {
            select: {
              id: true,
              subject: true,
              deliveryStatus: true,
              sentAt: true,
              deliveredAt: true,
              openedAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        },
        orderBy,
        skip,
        take: filters.limit
      }),
      // Total count for pagination
      prisma.invoices.count({ where }),
      // Status breakdown for dashboard insights
      prisma.invoices.groupBy({
        by: ['status'],
        where: {
          companyId: filters.companyId
        },
        _count: {
          status: true
        }
      })
    ])

    // Calculate additional insights for UAE business needs
    const insights = await calculateInvoiceInsights(invoices, authContext.user.companyId)

    // Enhanced response with UAE business insights
    return successResponse({
      invoices: invoices.map(invoice => ({
        ...invoice,
        // Add computed fields for UAE business logic
        isOverdue: invoice.dueDate < new Date() && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status),
        daysPastDue: invoice.dueDate < new Date() ? Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        paidAmount: invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0)),
        remainingAmount: new Decimal(invoice.totalAmount || invoice.amount).minus(
          invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0))
        ),
        formattedAmounts: {
          subtotal: formatUAECurrency(invoice.subtotal || 0, invoice.currency),
          vatAmount: formatUAECurrency(invoice.vatAmount || 0, invoice.currency),
          totalAmount: formatUAECurrency(invoice.totalAmount || invoice.amount, invoice.currency)
        }
      })),
      pagination: {
        totalCount,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(totalCount / filters.limit),
        hasMore: skip + invoices.length < totalCount,
        hasPrevious: filters.page > 1
      },
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<InvoiceStatus, number>),
      insights,
      filters: {
        applied: Object.keys(filters).filter(key => 
          filters[key] !== undefined && filters[key] !== null && filters[key] !== ''
        ),
        companyId: filters.companyId
      }
    })

  } catch (error) {
    logError('GET /api/invoices', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// POST /api/invoices - Create new invoice with UAE business validation
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    if (!canManageInvoices(authContext.user.role)) {
      throw new Error('Insufficient permissions to create invoices')
    }

    const invoiceData = await validateRequestBody(request, createInvoiceWithVatSchema)
    
    // Enforce company-level data isolation - always use user's company
    invoiceData.companyId = authContext.user.companyId

    // UAE business validation
    await validateUAEBusinessRules(invoiceData, authContext.user.companyId)

    // Validate TRN if provided
    if (invoiceData.trnNumber && !validateTRN(invoiceData.trnNumber)) {
      throw new Error('Invalid TRN format. UAE TRN must be 15 digits.')
    }

    // Validate invoice number uniqueness within company
    const existingInvoice = await prisma.invoices.findUnique({
      where: {
        companyId_number: {
          companyId: invoiceData.companyId,
          number: invoiceData.number
        }
      }
    })

    if (existingInvoice) {
      throw new Error(`Invoice number ${invoiceData.number} already exists for this company`)
    }

    // Create invoice in a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if customer exists, create if not (UAE bilingual support)
      let customer = await tx.customers.findUnique({
        where: {
          email_companyId: {
            email: invoiceData.customerEmail,
            companyId: invoiceData.companyId
          }
        }
      })

      if (!customer) {
        // Generate unique customer ID
        const customerId = crypto.randomUUID()
        
        customer = await tx.customers.create({
          data: {
            id: customerId,
            name: invoiceData.customerName,
            nameAr: invoiceData.customerNameAr,
            email: invoiceData.customerEmail,
            phone: invoiceData.customerPhone,
            companyId: invoiceData.companyId,
            paymentTerms: invoiceData.paymentTerms || 30, // Default 30 days for UAE
            notes: invoiceData.customerNotes,
            notesAr: invoiceData.customerNotesAr
          }
        })
      } else if (invoiceData.customerName !== customer.name) {
        // Update customer info if name changed
        customer = await tx.customers.update({
          where: { id: customer.id },
          data: {
            name: invoiceData.customerName,
            nameAr: invoiceData.customerNameAr,
            phone: invoiceData.customerPhone
          }
        })
      }

      // Calculate comprehensive VAT for UAE compliance
      let vatCalculation = null
      if (invoiceData.items && invoiceData.items.length > 0) {
        vatCalculation = calculateInvoiceVAT(
          invoiceData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            taxCategory: item.taxCategory || 'STANDARD'
          })),
          invoiceData.currency
        )
      } else {
        // Calculate VAT for simple invoice (backward compatibility)
        vatCalculation = {
          subtotal: new Decimal(invoiceData.subtotal),
          totalVatAmount: new Decimal(invoiceData.vatAmount || 0),
          grandTotal: new Decimal(invoiceData.totalAmount)
        }
      }

      // Generate unique invoice ID
      const invoiceId = crypto.randomUUID()

      // Create invoice with comprehensive UAE VAT calculations
      const invoice = await tx.invoices.create({
        data: {
          id: invoiceId,
          companyId: invoiceData.companyId,
          number: invoiceData.number,
          customerName: invoiceData.customerName,
          customerEmail: invoiceData.customerEmail,
          amount: invoiceData.amount, // Keep for backward compatibility
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
        },
        include: {
          customers: true,
          companies: {
            select: {
              id: true,
              name: true,
              trn: true,
              defaultVatRate: true
            }
          }
        }
      })

      // Create detailed invoice items with UAE VAT compliance
      if (invoiceData.items && invoiceData.items.length > 0) {
        const itemsWithVat = vatCalculation ? vatCalculation.lineItems : invoiceData.items
        
        await tx.invoiceItems.createMany({
          data: itemsWithVat.map((item: any, index: number) => {
            const originalItem = invoiceData.items[index]
            return {
              id: crypto.randomUUID(),
              invoiceId: invoice.id,
              description: item.description || originalItem?.description,
              descriptionAr: originalItem?.descriptionAr,
              quantity: item.quantity || originalItem?.quantity,
              unitPrice: item.unitPrice || originalItem?.unitPrice,
              total: item.lineTotal || item.total || originalItem?.total,
              vatRate: item.vatRate || originalItem?.vatRate || 5.00, // UAE default VAT rate
              vatAmount: item.vatAmount || originalItem?.vatAmount || 0.00,
              totalWithVat: item.totalWithVat || originalItem?.totalWithVat,
              taxCategory: item.taxCategory || originalItem?.taxCategory || 'STANDARD'
            }
          })
        })
      }

      // Log comprehensive activity for UAE audit trail
      await tx.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'invoice_created',
          description: `Created invoice ${invoice.number} for ${invoiceData.customerName}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            customerName: invoiceData.customerName,
            customerEmail: invoiceData.customerEmail,
            amount: invoiceData.amount,
            subtotal: invoice.subtotal,
            vatAmount: invoice.vatAmount,
            totalAmount: invoice.totalAmount,
            currency: invoiceData.currency,
            dueDate: invoiceData.dueDate.toISOString(),
            status: invoiceData.status,
            trnNumber: invoiceData.trnNumber,
            itemCount: invoiceData.items?.length || 0,
            userAgent: request.headers.get('user-agent'),
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
          }
        }
      })

      // Fetch complete invoice with all relations for response
      const completeInvoice = await tx.invoices.findUnique({
        where: { id: invoice.id },
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

      return completeInvoice
    })

    // Return success response with formatted amounts
    return successResponse({
      ...result,
      // Add computed UAE business fields
      formattedAmounts: {
        subtotal: formatUAECurrency(result.subtotal || 0, result.currency),
        vatAmount: formatUAECurrency(result.vatAmount || 0, result.currency),
        totalAmount: formatUAECurrency(result.totalAmount || result.amount, result.currency)
      },
      vatBreakdown: vatCalculation?.vatBreakdown,
      isOverdue: false, // New invoice cannot be overdue
      daysPastDue: 0
    }, 'Invoice created successfully with UAE VAT compliance')

  } catch (error) {
    logError('POST /api/invoices', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId'
    })
    return handleApiError(error)
  }
}

// Helper function to determine invoice sorting order
function getInvoiceOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
  const order = sortOrder || 'desc'
  
  switch (sortBy) {
    case 'number':
      return { number: order }
    case 'customerName':
      return { customerName: order }
    case 'amount':
      return { totalAmount: order }
    case 'dueDate':
      return { dueDate: order }
    case 'status':
      return { status: order }
    case 'updatedAt':
      return { updatedAt: order }
    default:
      return { createdAt: order }
  }
}

// Helper function to calculate UAE business insights
async function calculateInvoiceInsights(invoices: any[], companyId: string) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
  
  // Calculate totals and insights
  const totalOutstanding = invoices
    .filter(inv => ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(inv.status))
    .reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0))
  
  const totalOverdue = invoices
    .filter(inv => inv.dueDate < now && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(inv.status))
    .reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0))
  
  const recentInvoices = invoices
    .filter(inv => inv.createdAt > thirtyDaysAgo)
    .length
  
  return {
    totalOutstanding: totalOutstanding.toNumber(),
    totalOverdue: totalOverdue.toNumber(),
    overdueCount: invoices.filter(inv => 
      inv.dueDate < now && ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(inv.status)
    ).length,
    recentInvoicesCount: recentInvoices,
    averageAmount: invoices.length > 0 
      ? invoices.reduce((sum, inv) => sum.plus(inv.totalAmount || inv.amount), new Decimal(0)).div(invoices.length).toNumber()
      : 0,
    formatted: {
      totalOutstanding: formatUAECurrency(totalOutstanding),
      totalOverdue: formatUAECurrency(totalOverdue)
    }
  }
}

// Helper function to validate UAE business rules
async function validateUAEBusinessRules(invoiceData: any, companyId: string) {
  // Validate currency (should be AED for UAE businesses, but allow others)
  if (!['AED', 'USD', 'EUR', 'GBP', 'SAR'].includes(invoiceData.currency)) {
    throw new Error(`Unsupported currency: ${invoiceData.currency}. Supported currencies: AED, USD, EUR, GBP, SAR`)
  }
  
  // Validate due date is not in the past
  if (invoiceData.dueDate < new Date()) {
    throw new Error('Due date cannot be in the past')
  }
  
  // Validate amounts are positive and reasonable
  const totalAmount = new Decimal(invoiceData.totalAmount || invoiceData.amount)
  if (totalAmount.lessThanOrEqualTo(0)) {
    throw new Error('Invoice total amount must be greater than zero')
  }
  
  // Validate that VAT calculations are consistent
  if (invoiceData.vatAmount && invoiceData.subtotal) {
    const vatAmount = new Decimal(invoiceData.vatAmount)
    const subtotal = new Decimal(invoiceData.subtotal)
    const calculatedTotal = subtotal.plus(vatAmount)
    
    if (!calculatedTotal.equals(totalAmount)) {
      throw new Error('VAT calculation inconsistency: subtotal + VAT amount must equal total amount')
    }
  }
  
  // Check if company exists and user has access
  const company = await prisma.companies.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, trn: true }
  })
  
  if (!company) {
    throw new Error('Invalid company ID')
  }
  
  // If TRN is provided, it should match company TRN or be valid
  if (invoiceData.trnNumber && company.trn && invoiceData.trnNumber !== company.trn) {
    // Allow different TRN if it's valid (for sub-entities)
    if (!validateTRN(invoiceData.trnNumber)) {
      throw new Error('TRN does not match company TRN and is not a valid UAE TRN format')
    }
  }
}