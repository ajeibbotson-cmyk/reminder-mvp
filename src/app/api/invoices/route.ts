import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import {
  invoiceFiltersSchema,
  validateQueryParams
} from '@/lib/validations'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { randomUUID } from 'crypto'

// GET /api/invoices - Fetch invoices with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams

    // Handle empty status parameter before validation
    const params = Object.fromEntries(searchParams.entries())
    if (params.status === '') {
      delete params.status
    }

    const filters = invoiceFiltersSchema.parse(params)

    // Company ID comes from authenticated session, not query parameters
    const companyId = authContext.user.companyId

    const skip = (filters.page - 1) * filters.limit

    // Build comprehensive where clause with optimized filters for UAE business
    const where: Record<string, unknown> = {
      companyId: companyId, // Company-level data isolation
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
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              email: true,
              phone: true,
              paymentTerms: true
            }
          },
          company: {
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
          importBatch: {
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
      prisma.invoice.count({ where }),
      // Status breakdown for dashboard insights
      prisma.invoice.groupBy({
        by: ['status'],
        where: {
          companyId: companyId
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
        companyId: companyId
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

// POST /api/invoices - Create invoice from extracted PDF data
export async function POST(request: NextRequest) {
  try {
    // Authenticate user and require proper permissions
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const companyId = authContext.user.companyId

    // Parse request body
    const body = await request.json()
    const {
      number: invoiceNumber, // Rename 'number' field to 'invoiceNumber' for internal use
      customerName,
      customerEmail,
      amount,
      vatAmount,
      totalAmount,
      currency = 'AED',
      dueDate,
      invoiceDate,
      description,
      pdf_s3_key,
      pdf_s3_bucket,
      pdf_uploaded_at
    } = body

    // Validate required fields
    if (!invoiceNumber) {
      return handleApiError(new Error('Invoice number is required'), 'Missing invoice number')
    }
    if (!customerName) {
      return handleApiError(new Error('Customer name is required'), 'Missing customer name')
    }
    if (!customerEmail) {
      return handleApiError(new Error('Customer email is required'), 'Missing customer email')
    }
    if (!amount || amount <= 0) {
      return handleApiError(new Error('Valid amount is required'), 'Invalid amount')
    }

    // Calculate amounts if not provided
    const invoiceAmount = new Decimal(amount)
    const calculatedVatAmount = vatAmount ? new Decimal(vatAmount) : invoiceAmount.mul(0.05) // 5% UAE VAT
    const calculatedTotalAmount = totalAmount ? new Decimal(totalAmount) : invoiceAmount.add(calculatedVatAmount)

    // Parse invoice date or default to now
    let parsedInvoiceDate: Date
    if (invoiceDate) {
      parsedInvoiceDate = new Date(invoiceDate)
      if (isNaN(parsedInvoiceDate.getTime())) {
        return handleApiError(new Error('Invalid invoice date format'), 'Invalid invoice date')
      }
    } else {
      parsedInvoiceDate = new Date()
    }

    // Parse due date or set default (30 days from invoice date for UAE business terms)
    let parsedDueDate: Date
    if (dueDate) {
      parsedDueDate = new Date(dueDate)
      if (isNaN(parsedDueDate.getTime())) {
        return handleApiError(new Error('Invalid due date format'), 'Invalid due date')
      }
    } else {
      parsedDueDate = new Date(parsedInvoiceDate)
      parsedDueDate.setDate(parsedDueDate.getDate() + 30)
    }

    // Create invoice and invoice item in transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicate invoice number within company
      const existingInvoice = await tx.invoice.findFirst({
        where: {
          companyId: companyId,
          number: invoiceNumber
        }
      })

      if (existingInvoice) {
        throw new Error(`Invoice number ${invoiceNumber} already exists`)
      }

      // Create or find the customer (required relation for Invoice)
      const customer = await tx.customer.upsert({
        where: {
          email_companyId: {
            email: customerEmail,
            companyId: companyId
          }
        },
        update: {
          name: customerName,
          updatedAt: new Date()
        },
        create: {
          id: randomUUID(),
          companyId: companyId,
          name: customerName,
          email: customerEmail,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          id: randomUUID(),
          companyId: companyId,
          number: invoiceNumber,
          customerName: customerName,
          customerEmail: customerEmail,
          amount: invoiceAmount,
          subtotal: invoiceAmount,
          vatAmount: calculatedVatAmount,
          totalAmount: calculatedTotalAmount,
          currency: currency,
          dueDate: parsedDueDate,
          status: 'SENT',
          description: description || `Invoice ${invoiceNumber}`,
          pdfS3Key: pdf_s3_key || null,
          pdfS3Bucket: pdf_s3_bucket || null,
          pdfUploadedAt: pdf_uploaded_at ? new Date(pdf_uploaded_at) : null,
          createdAt: parsedInvoiceDate, // Use invoice date as created date
          updatedAt: new Date()
        }
      })

      // Create associated invoice item
      const invoiceItem = await tx.invoice_items.create({
        data: {
          id: randomUUID(),
          invoiceId: invoice.id,
          description: description || `Invoice ${invoiceNumber}`,
          quantity: new Decimal(1),
          unitPrice: invoiceAmount,
          total: invoiceAmount,
          vatRate: new Decimal(5.00), // UAE VAT rate
          vatAmount: calculatedVatAmount,
          totalWithVat: calculatedTotalAmount,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      return { invoice, invoiceItem }
    })

    // Log successful creation
    logError('POST /api/invoices', null, {
      action: 'invoice_created',
      invoiceId: result.invoice.id,
      invoiceNumber: invoiceNumber,
      companyId: companyId,
      userId: authContext.user.id
    })

    // Return success response
    return successResponse({
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
        customerName: result.invoice.customerName,
        customerEmail: result.invoice.customerEmail,
        totalAmount: result.invoice.totalAmount?.toString(),
        currency: result.invoice.currency,
        dueDate: result.invoice.dueDate,
        status: result.invoice.status
      }
    }, 'Invoice created successfully', 201)

  } catch (error) {
    logError('POST /api/invoices', error, {
      action: 'invoice_creation_failed',
      companyId: 'unknown'
    })
    return handleApiError(error, 'Failed to create invoice')
  }
}

