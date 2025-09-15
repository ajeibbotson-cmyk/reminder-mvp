import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole, InvoiceStatus } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { formatUAECurrency } from '@/lib/vat-calculator'
import { z } from 'zod'

// Advanced search schema with fuzzy matching and faceted search
const advancedSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  searchFields: z.array(z.enum([
    'number', 'customerName', 'customerEmail', 'description', 
    'descriptionAr', 'notes', 'notesAr', 'trnNumber', 'reference'
  ])).default(['number', 'customerName', 'customerEmail', 'description']),
  fuzzyMatch: z.coerce.boolean().default(true),
  fuzzyThreshold: z.coerce.number().min(0).max(1).default(0.7),
  status: z.array(z.nativeEnum(InvoiceStatus)).optional(),
  amountRange: z.object({
    min: z.coerce.number().positive().optional(),
    max: z.coerce.number().positive().optional()
  }).optional(),
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    field: z.enum(['createdAt', 'dueDate', 'updatedAt']).default('createdAt')
  }).optional(),
  currency: z.string().length(3).optional(),
  hasPayments: z.coerce.boolean().optional(),
  isOverdue: z.coerce.boolean().optional(),
  customerFilter: z.string().optional(),
  includeArchived: z.coerce.boolean().default(false),
  facets: z.array(z.enum([
    'status', 'currency', 'paymentMethod', 'customer', 'amount', 'dateCreated'
  ])).default(['status', 'currency']),
  sortBy: z.enum([
    'relevance', 'createdAt', 'updatedAt', 'number', 'customerName', 
    'amount', 'dueDate', 'status'
  ]).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  includeHighlights: z.coerce.boolean().default(true),
  includeSuggestions: z.coerce.boolean().default(true)
})

interface SearchResult {
  invoices: Array<{
    id: string
    number: string
    customerName: string
    customerEmail: string
    totalAmount: number
    formattedAmount: string
    currency: string
    status: InvoiceStatus
    dueDate: Date
    createdAt: Date
    isOverdue: boolean
    paidAmount: number
    remainingAmount: number
    relevanceScore: number
    highlights?: Record<string, string[]>
  }>
  facets: Record<string, Array<{
    value: string
    count: number
    percentage: number
  }>>
  pagination: {
    totalCount: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
    hasPrevious: boolean
  }
  suggestions?: Array<{
    query: string
    type: 'spelling' | 'completion' | 'related'
    confidence: number
  }>
  searchInfo: {
    query: string
    searchTime: number
    totalResults: number
    appliedFilters: string[]
    didYouMean?: string
  }
}

// GET /api/invoices/search - Advanced invoice search with facets and fuzzy matching
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER, UserRole.USER])
    const searchParams = request.nextUrl.searchParams
    
    const searchQuery = advancedSearchSchema.parse(Object.fromEntries(searchParams.entries()))
    
    // Build comprehensive search where clause
    const whereClause = buildSearchWhereClause(searchQuery, authContext.user.companyId)
    
    // Execute search with parallel queries for better performance
    const [invoices, totalCount, facetData] = await Promise.all([
      executeInvoiceSearch(whereClause, searchQuery),
      getSearchCount(whereClause),
      searchQuery.facets.length > 0 ? buildFacetData(whereClause, searchQuery.facets, authContext.user.companyId) : {}
    ])
    
    // Calculate relevance scores and apply highlighting
    const processedInvoices = await processSearchResults(
      invoices, 
      searchQuery.query, 
      searchQuery.searchFields,
      searchQuery.includeHighlights
    )
    
    // Generate search suggestions if enabled
    let suggestions = []
    if (searchQuery.includeSuggestions && processedInvoices.length < 5) {
      suggestions = await generateSearchSuggestions(
        searchQuery.query, 
        authContext.user.companyId
      )
    }
    
    const searchTime = Date.now() - startTime
    
    const result: SearchResult = {
      invoices: processedInvoices,
      facets: facetData,
      pagination: {
        totalCount,
        page: searchQuery.page,
        limit: searchQuery.limit,
        totalPages: Math.ceil(totalCount / searchQuery.limit),
        hasMore: (searchQuery.page * searchQuery.limit) < totalCount,
        hasPrevious: searchQuery.page > 1
      },
      suggestions,
      searchInfo: {
        query: searchQuery.query,
        searchTime,
        totalResults: totalCount,
        appliedFilters: getAppliedFilters(searchQuery),
        didYouMean: await generateDidYouMeanSuggestion(searchQuery.query, authContext.user.companyId)
      }
    }

    // Log search activity for analytics
    await logSearchActivity(authContext.user.id, authContext.user.companyId, searchQuery, result)

    return successResponse(result, `Found ${totalCount} invoices matching your search`)

  } catch (error) {
    logError('GET /api/invoices/search', error, { 
      userId: 'authContext.user?.id',
      companyId: 'authContext.user?.companyId',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// Helper functions for advanced search

function buildSearchWhereClause(searchQuery: any, companyId: string) {
  const where: any = {
    companyId, // Always enforce company isolation
  }

  // Build full-text search conditions
  const searchConditions = []
  
  for (const field of searchQuery.searchFields) {
    if (searchQuery.fuzzyMatch) {
      // For fuzzy matching, we'll use ilike with wildcards
      // In a production system, you'd want to use a proper full-text search solution
      searchConditions.push({
        [field]: {
          contains: searchQuery.query,
          mode: 'insensitive'
        }
      })
    } else {
      // Exact match search
      searchConditions.push({
        [field]: {
          equals: searchQuery.query,
          mode: 'insensitive'
        }
      })
    }
  }

  if (searchConditions.length > 0) {
    where.OR = searchConditions
  }

  // Apply filters
  if (searchQuery.status && searchQuery.status.length > 0) {
    where.status = { in: searchQuery.status }
  }

  if (searchQuery.amountRange) {
    where.totalAmount = {}
    if (searchQuery.amountRange.min) {
      where.totalAmount.gte = new Decimal(searchQuery.amountRange.min)
    }
    if (searchQuery.amountRange.max) {
      where.totalAmount.lte = new Decimal(searchQuery.amountRange.max)
    }
  }

  if (searchQuery.dateRange) {
    const dateField = searchQuery.dateRange.field
    where[dateField] = {}
    if (searchQuery.dateRange.startDate) {
      where[dateField].gte = searchQuery.dateRange.startDate
    }
    if (searchQuery.dateRange.endDate) {
      where[dateField].lte = searchQuery.dateRange.endDate
    }
  }

  if (searchQuery.currency) {
    where.currency = searchQuery.currency
  }

  if (searchQuery.hasPayments !== undefined) {
    where.payments = searchQuery.hasPayments ? { some: {} } : { none: {} }
  }

  if (searchQuery.isOverdue) {
    where.AND = [
      ...(where.AND || []),
      { 
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        dueDate: { lt: new Date() }
      }
    ]
  }

  if (searchQuery.customerFilter) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { customerName: { contains: searchQuery.customerFilter, mode: 'insensitive' } },
          { customerEmail: { contains: searchQuery.customerFilter, mode: 'insensitive' } }
        ]
      }
    ]
  }

  return where
}

async function executeInvoiceSearch(whereClause: any, searchQuery: any) {
  const skip = (searchQuery.page - 1) * searchQuery.limit
  
  // Determine sort order
  let orderBy: any = { createdAt: 'desc' }
  
  if (searchQuery.sortBy !== 'relevance') {
    orderBy = { [searchQuery.sortBy]: searchQuery.sortOrder }
  }

  return await prisma.invoices.findMany({
    where: whereClause,
    include: {
      customers: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      payments: {
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          method: true
        }
      },
      invoiceItems: {
        select: {
          id: true,
          description: true,
          descriptionAr: true,
          quantity: true,
          unitPrice: true,
          total: true
        },
        take: 3 // Limit for search results
      }
    },
    orderBy,
    skip,
    take: searchQuery.limit
  })
}

async function getSearchCount(whereClause: any) {
  return await prisma.invoices.count({ where: whereClause })
}

async function buildFacetData(whereClause: any, facets: string[], companyId: string) {
  const facetData: Record<string, any[]> = {}

  for (const facet of facets) {
    switch (facet) {
      case 'status':
        const statusFacets = await prisma.invoices.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { status: true }
        })
        
        const totalStatusCount = statusFacets.reduce((sum, item) => sum + item._count.status, 0)
        facetData.status = statusFacets.map(item => ({
          value: item.status,
          count: item._count.status,
          percentage: totalStatusCount > 0 ? Math.round((item._count.status / totalStatusCount) * 100) : 0
        }))
        break

      case 'currency':
        const currencyFacets = await prisma.invoices.groupBy({
          by: ['currency'],
          where: whereClause,
          _count: { currency: true }
        })
        
        const totalCurrencyCount = currencyFacets.reduce((sum, item) => sum + item._count.currency, 0)
        facetData.currency = currencyFacets.map(item => ({
          value: item.currency,
          count: item._count.currency,
          percentage: totalCurrencyCount > 0 ? Math.round((item._count.currency / totalCurrencyCount) * 100) : 0
        }))
        break

      case 'paymentMethod':
        const paymentMethodFacets = await prisma.payments.groupBy({
          by: ['method'],
          where: {
            invoices: whereClause
          },
          _count: { method: true }
        })
        
        const totalPaymentCount = paymentMethodFacets.reduce((sum, item) => sum + item._count.method, 0)
        facetData.paymentMethod = paymentMethodFacets.map(item => ({
          value: item.method,
          count: item._count.method,
          percentage: totalPaymentCount > 0 ? Math.round((item._count.method / totalPaymentCount) * 100) : 0
        }))
        break

      case 'customer':
        const customerFacets = await prisma.invoices.groupBy({
          by: ['customerName'],
          where: whereClause,
          _count: { customerName: true },
          orderBy: { _count: { customerName: 'desc' } },
          take: 10
        })
        
        const totalCustomerCount = customerFacets.reduce((sum, item) => sum + item._count.customerName, 0)
        facetData.customer = customerFacets.map(item => ({
          value: item.customerName,
          count: item._count.customerName,
          percentage: totalCustomerCount > 0 ? Math.round((item._count.customerName / totalCustomerCount) * 100) : 0
        }))
        break
    }
  }

  return facetData
}

async function processSearchResults(
  invoices: any[], 
  query: string, 
  searchFields: string[],
  includeHighlights: boolean
) {
  const now = new Date()
  
  return invoices.map(invoice => {
    // Calculate payment amounts
    const paidAmount = invoice.payments.reduce(
      (sum: Decimal, payment: any) => sum.plus(payment.amount),
      new Decimal(0)
    )
    const totalAmount = new Decimal(invoice.totalAmount || invoice.amount)
    const remainingAmount = totalAmount.minus(paidAmount)
    
    // Calculate overdue status
    const isOverdue = invoice.dueDate < now && 
      ![InvoiceStatus.PAID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)

    // Calculate relevance score based on query match
    const relevanceScore = calculateRelevanceScore(invoice, query, searchFields)
    
    // Generate highlights if requested
    let highlights = undefined
    if (includeHighlights) {
      highlights = generateHighlights(invoice, query, searchFields)
    }

    return {
      id: invoice.id,
      number: invoice.number,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      totalAmount: totalAmount.toNumber(),
      formattedAmount: formatUAECurrency(totalAmount, invoice.currency),
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      isOverdue,
      paidAmount: paidAmount.toNumber(),
      remainingAmount: remainingAmount.toNumber(),
      relevanceScore,
      highlights
    }
  })
}

function calculateRelevanceScore(invoice: any, query: string, searchFields: string[]): number {
  let score = 0
  const queryLower = query.toLowerCase()
  
  for (const field of searchFields) {
    const fieldValue = invoice[field]?.toLowerCase() || ''
    
    if (fieldValue.includes(queryLower)) {
      // Exact substring match gets higher score
      score += 10
      
      // Bonus for exact match
      if (fieldValue === queryLower) {
        score += 20
      }
      
      // Bonus for starting with query
      if (fieldValue.startsWith(queryLower)) {
        score += 15
      }
      
      // Consider field importance (e.g., invoice number more important than description)
      if (field === 'number') {
        score += 10
      } else if (field === 'customerName') {
        score += 5
      }
    }
  }
  
  // Normalize score to 0-100 range
  return Math.min(100, score)
}

function generateHighlights(invoice: any, query: string, searchFields: string[]): Record<string, string[]> {
  const highlights: Record<string, string[]> = {}
  const queryLower = query.toLowerCase()
  
  for (const field of searchFields) {
    const fieldValue = invoice[field] || ''
    
    if (fieldValue.toLowerCase().includes(queryLower)) {
      // Simple highlighting - in production, use more sophisticated highlighting
      const highlighted = fieldValue.replace(
        new RegExp(query, 'gi'),
        `<mark>$&</mark>`
      )
      highlights[field] = [highlighted]
    }
  }
  
  return highlights
}

async function generateSearchSuggestions(query: string, companyId: string): Promise<any[]> {
  const suggestions = []
  
  // Generate completion suggestions based on existing invoice data
  const customerSuggestions = await prisma.invoices.findMany({
    where: {
      companyId,
      customerName: {
        contains: query,
        mode: 'insensitive'
      }
    },
    select: { customerName: true },
    distinct: ['customerName'],
    take: 3
  })
  
  for (const customer of customerSuggestions) {
    suggestions.push({
      query: customer.customerName,
      type: 'completion' as const,
      confidence: 0.8
    })
  }
  
  // Generate invoice number suggestions
  const invoiceNumberSuggestions = await prisma.invoices.findMany({
    where: {
      companyId,
      number: {
        contains: query,
        mode: 'insensitive'
      }
    },
    select: { number: true },
    take: 2
  })
  
  for (const invoice of invoiceNumberSuggestions) {
    suggestions.push({
      query: invoice.number,
      type: 'completion' as const,
      confidence: 0.9
    })
  }
  
  return suggestions
}

async function generateDidYouMeanSuggestion(query: string, companyId: string): Promise<string | undefined> {
  // Simple implementation - in production, use more sophisticated spell checking
  if (query.length < 3) return undefined
  
  // Check for common misspellings in invoice context
  const commonTerms = await prisma.invoices.findMany({
    where: { companyId },
    select: { customerName: true, number: true },
    take: 100
  })
  
  const allTerms = [
    ...commonTerms.map(c => c.customerName),
    ...commonTerms.map(c => c.number)
  ].filter(Boolean)
  
  // Simple Levenshtein distance check for "did you mean"
  for (const term of allTerms) {
    if (levenshteinDistance(query.toLowerCase(), term.toLowerCase()) === 1) {
      return term
    }
  }
  
  return undefined
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

function getAppliedFilters(searchQuery: any): string[] {
  const filters = []
  
  if (searchQuery.status && searchQuery.status.length > 0) {
    filters.push(`status: ${searchQuery.status.join(', ')}`)
  }
  
  if (searchQuery.amountRange) {
    if (searchQuery.amountRange.min && searchQuery.amountRange.max) {
      filters.push(`amount: ${searchQuery.amountRange.min} - ${searchQuery.amountRange.max}`)
    } else if (searchQuery.amountRange.min) {
      filters.push(`amount: ≥ ${searchQuery.amountRange.min}`)
    } else if (searchQuery.amountRange.max) {
      filters.push(`amount: ≤ ${searchQuery.amountRange.max}`)
    }
  }
  
  if (searchQuery.dateRange && (searchQuery.dateRange.startDate || searchQuery.dateRange.endDate)) {
    filters.push(`${searchQuery.dateRange.field}: date range`)
  }
  
  if (searchQuery.currency) {
    filters.push(`currency: ${searchQuery.currency}`)
  }
  
  if (searchQuery.hasPayments !== undefined) {
    filters.push(`payments: ${searchQuery.hasPayments ? 'has payments' : 'no payments'}`)
  }
  
  if (searchQuery.isOverdue) {
    filters.push('overdue: true')
  }
  
  if (searchQuery.customerFilter) {
    filters.push(`customer: ${searchQuery.customerFilter}`)
  }
  
  return filters
}

async function logSearchActivity(userId: string, companyId: string, searchQuery: any, result: SearchResult) {
  try {
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId,
        userId,
        type: 'invoice_search',
        description: `Searched invoices: "${searchQuery.query}"`,
        metadata: {
          query: searchQuery.query,
          searchFields: searchQuery.searchFields,
          resultsCount: result.pagination.totalCount,
          searchTime: result.searchInfo.searchTime,
          appliedFilters: result.searchInfo.appliedFilters,
          facetsUsed: searchQuery.facets,
          page: searchQuery.page,
          limit: searchQuery.limit
        }
      }
    })
  } catch (error) {
    // Don't fail the search if logging fails
    console.warn('Failed to log search activity:', error)
  }
}