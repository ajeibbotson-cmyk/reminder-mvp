/**
 * Consolidation Candidates API
 * GET /api/consolidation/candidates - Get customers eligible for consolidated reminders
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import type { ConsolidationApiResponse } from '@/lib/types/consolidation'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      priority: searchParams.get('priority') || 'all',
      escalationLevel: searchParams.get('escalationLevel') || 'all',
      contactEligibility: searchParams.get('contactEligibility') || 'all',
      minAmount: searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined,
      maxAmount: searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined,
      searchQuery: searchParams.get('searchQuery') || '',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    }

    console.log(`🔍 Getting consolidation candidates for company ${session.user.companyId}`)

    // Get consolidation candidates
    const allCandidates = await customerConsolidationService.getConsolidationCandidates(session.user.companyId)

    // Apply filters
    let filteredCandidates = allCandidates

    if (filters.priority !== 'all') {
      filteredCandidates = filteredCandidates.filter(candidate => {
        const priority = getPriorityLevel(candidate.priorityScore)
        return priority === filters.priority
      })
    }

    if (filters.escalationLevel !== 'all') {
      filteredCandidates = filteredCandidates.filter(candidate =>
        candidate.escalationLevel.toLowerCase() === filters.escalationLevel
      )
    }

    if (filters.contactEligibility !== 'all') {
      if (filters.contactEligibility === 'eligible') {
        filteredCandidates = filteredCandidates.filter(candidate => candidate.canContact)
      } else {
        filteredCandidates = filteredCandidates.filter(candidate => !candidate.canContact)
      }
    }

    if (filters.minAmount !== undefined) {
      filteredCandidates = filteredCandidates.filter(candidate => candidate.totalAmount >= filters.minAmount!)
    }

    if (filters.maxAmount !== undefined) {
      filteredCandidates = filteredCandidates.filter(candidate => candidate.totalAmount <= filters.maxAmount!)
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filteredCandidates = filteredCandidates.filter(candidate =>
        candidate.customerName.toLowerCase().includes(query) ||
        candidate.customerEmail.toLowerCase().includes(query) ||
        (candidate.companyName && candidate.companyName.toLowerCase().includes(query))
      )
    }

    // Apply pagination
    const total = filteredCandidates.length
    const paginatedCandidates = filteredCandidates.slice(filters.offset, filters.offset + filters.limit)

    // Calculate summary statistics
    const summary = {
      totalCustomers: allCandidates.length,
      eligibleCustomers: allCandidates.filter(c => c.canContact).length,
      totalOutstanding: allCandidates.reduce((sum, c) => sum + c.totalAmount, 0),
      emailsSaved: allCandidates.reduce((sum, c) => sum + c.overdueInvoices.length - 1, 0),
      filteredCount: total,
      avgPriorityScore: total > 0 ? filteredCandidates.reduce((sum, c) => sum + c.priorityScore, 0) / total : 0
    }

    const response: ConsolidationApiResponse<typeof paginatedCandidates> = {
      success: true,
      data: paginatedCandidates,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      ...response,
      summary,
      pagination: {
        total,
        offset: filters.offset,
        limit: filters.limit,
        hasNext: filters.offset + filters.limit < total,
        hasPrev: filters.offset > 0
      }
    })

  } catch (error) {
    console.error('Consolidation candidates error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to retrieve consolidation candidates',
      code: 'CANDIDATES_RETRIEVAL_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * Helper function to determine priority level from score
 */
function getPriorityLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}