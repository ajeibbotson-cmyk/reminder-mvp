import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { validateQueryParams } from '@/lib/validations'
import { UserRole, Prisma } from '@prisma/client'
import { z } from 'zod'

// Advanced search schema with UAE-specific patterns
const customerSearchSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  q: z.string().min(1, 'Search query is required'),
  searchType: z.enum(['fuzzy', 'exact', 'prefix']).default('fuzzy'),
  fields: z.array(z.enum(['name', 'nameAr', 'email', 'phone', 'trn', 'businessName'])).default(['name', 'email']),
  includeInactive: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().positive().max(50).default(20),
  businessType: z.enum(['LLC', 'FREE_ZONE', 'SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'BRANCH']).optional(),
  minOutstandingBalance: z.coerce.number().positive().optional(),
  maxOutstandingBalance: z.coerce.number().positive().optional(),
})

// POST /api/customers/search - Advanced customer search with UAE-specific patterns
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const filters = validateQueryParams(searchParams, customerSearchSchema)
    
    // Ensure user can only search their company's customers
    if (filters.companyId !== authContext.user.companiesId) {
      throw new Error('Access denied to company data')
    }

    const searchTerm = filters.q.toLowerCase().trim()
    
    // Build search conditions based on search type and fields
    const searchConditions: Prisma.CustomerWhereInput[] = []

    // Text search across specified fields
    filters.fields.forEach(field => {
      switch (field) {
        case 'name':
          if (filters.searchType === 'exact') {
            searchConditions.push({ name: { equals: searchTerm, mode: 'insensitive' } })
          } else if (filters.searchType === 'prefix') {
            searchConditions.push({ name: { startsWith: searchTerm, mode: 'insensitive' } })
          } else {
            searchConditions.push({ name: { contains: searchTerm, mode: 'insensitive' } })
          }
          break
          
        case 'nameAr':
          // Arabic name search with fuzzy matching
          if (filters.searchType === 'exact') {
            searchConditions.push({ nameAr: { equals: searchTerm, mode: 'insensitive' } })
          } else {
            searchConditions.push({ nameAr: { contains: searchTerm, mode: 'insensitive' } })
          }
          break
          
        case 'email':
          if (filters.searchType === 'exact') {
            searchConditions.push({ email: { equals: searchTerm, mode: 'insensitive' } })
          } else if (filters.searchType === 'prefix') {
            searchConditions.push({ email: { startsWith: searchTerm, mode: 'insensitive' } })
          } else {
            searchConditions.push({ email: { contains: searchTerm, mode: 'insensitive' } })
          }
          break
          
        case 'phone':
          // Phone search with number normalization
          const normalizedPhone = searchTerm.replace(/\D/g, '')
          searchConditions.push({ 
            phone: { 
              contains: normalizedPhone, 
              mode: 'insensitive' 
            } 
          })
          break
          
        case 'trn':
          // TRN search - normalize and search
          const normalizedTrn = searchTerm.replace(/\D/g, '')
          searchConditions.push({
            invoices: {
              some: {
                trnNumber: { 
                  contains: normalizedTrn, 
                  mode: 'insensitive' 
                }
              }
            }
          })
          break
          
        case 'businessName':
          // Business name search (would need to be added to schema)
          // searchConditions.push({ businessName: { contains: searchTerm, mode: 'insensitive' } })
          break
      }
    })

    // Build main where clause
    const whereClause: Prisma.CustomerWhereInput = {
      companyId: authContext.user.companiesId,
      isActive: filters.includeInactive ? undefined : true,
      OR: searchConditions.length > 0 ? searchConditions : undefined
    }

    // Add business type filter
    if (filters.businessType) {
      // Note: businessType field needs to be added to schema
      // whereClause.businessType = filters.businessType
    }

    // Add outstanding balance filters (complex query)
    if (filters.minOutstandingBalance !== undefined || filters.maxOutstandingBalance !== undefined) {
      // This would require a complex subquery - for now, we'll filter post-query
    }

    // Execute search with performance optimization
    const customers = await prisma.customers.findMany({
      where: whereClause,
      include: {
        invoices: {
          where: {
            isActive: true,
            status: { in: ['SENT', 'OVERDUE', 'DISPUTED', 'PAID'] }
          },
          select: {
            id: true,
            number: true,
            amount: true,
            totalAmount: true,
            status: true,
            dueDate: true,
            createdAt: true,
            payments: {
              select: {
                amount: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 3 // Limit for performance
        },
        _count: {
          select: {
            invoices: {
              where: {
                isActive: true,
                status: { in: ['SENT', 'OVERDUE', 'DISPUTED'] }
              }
            }
          }
        }
      },
      take: filters.limit,
      orderBy: [
        // Boost exact name matches
        { name: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Calculate search relevance and outstanding balances
    const enrichedResults = customers.map(customer => {
      const outstandingInvoices = customer.invoices.filter(invoice => 
        ['SENT', 'OVERDUE', 'DISPUTED'].includes(invoice.status) && 
        invoice.payments.length === 0
      )
      
      const outstandingBalance = outstandingInvoices.reduce((sum, invoice) => 
        sum + (invoice.totalAmount || invoice.amount), 0
      )

      const totalPaid = customer.invoices.reduce((sum, invoice) => 
        sum + invoice.payments.reduce((pSum, payment) => pSum + payment.amount, 0), 0
      )

      // Calculate search relevance score
      let relevanceScore = 0
      const searchLower = searchTerm.toLowerCase()
      
      // Exact matches get highest score
      if (customer.name.toLowerCase() === searchLower) relevanceScore += 100
      if (customer.email.toLowerCase() === searchLower) relevanceScore += 100
      if (customer.nameAr?.toLowerCase() === searchLower) relevanceScore += 100
      
      // Prefix matches get medium score
      if (customer.name.toLowerCase().startsWith(searchLower)) relevanceScore += 50
      if (customer.email.toLowerCase().startsWith(searchLower)) relevanceScore += 50
      
      // Contains matches get lower score
      if (customer.name.toLowerCase().includes(searchLower)) relevanceScore += 25
      if (customer.email.toLowerCase().includes(searchLower)) relevanceScore += 25
      if (customer.nameAr?.toLowerCase().includes(searchLower)) relevanceScore += 25

      return {
        ...customer,
        outstandingBalance,
        totalPaid,
        outstandingInvoiceCount: outstandingInvoices.length,
        relevanceScore,
        searchHighlights: {
          name: customer.name.toLowerCase().includes(searchLower),
          nameAr: customer.nameAr?.toLowerCase().includes(searchLower) || false,
          email: customer.email.toLowerCase().includes(searchLower),
          phone: customer.phone?.includes(searchTerm.replace(/\D/g, '')) || false
        }
      }
    })

    // Apply outstanding balance filters if specified
    let filteredResults = enrichedResults
    if (filters.minOutstandingBalance !== undefined) {
      filteredResults = filteredResults.filter(c => c.outstandingBalance >= filters.minOutstandingBalance!)
    }
    if (filters.maxOutstandingBalance !== undefined) {
      filteredResults = filteredResults.filter(c => c.outstandingBalance <= filters.maxOutstandingBalance!)
    }

    // Sort by relevance score
    filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore)

    const responseTime = Date.now() - startTime

    // Log slow searches for optimization
    if (responseTime > 300) {
      logError('POST /api/customers/search - Slow search', 
        new Error(`Search took ${responseTime}ms`), 
        { 
          userId: authContext.user.id,
          searchTerm: filters.q,
          searchType: filters.searchType,
          fields: filters.fields,
          responseTime,
          resultCount: filteredResults.length
        }
      )
    }

    return successResponse({
      customers: filteredResults,
      totalResults: filteredResults.length,
      searchTerm: filters.q,
      searchType: filters.searchType,
      fields: filters.fields,
      responseTime
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    logError('POST /api/customers/search', error, { 
      userId: 'authContext.user?.id',
      responseTime,
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// GET /api/customers/search - Simple search endpoint for backward compatibility
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  
  if (!query) {
    return handleApiError(new Error('Search query parameter "q" is required'))
  }

  // Redirect to POST with default parameters
  searchParams.set('searchType', 'fuzzy')
  searchParams.set('fields', 'name,email')
  
  return POST(request)
}