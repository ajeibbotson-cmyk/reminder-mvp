/**
 * Customer Churn Risk Analytics API Route
 * Identifies customers at risk of churn based on payment behavior
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { customerAnalyticsService } from '@/lib/services/customer-analytics-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.company_id

    // Get customers at risk of churn
    const churnRiskCustomers = await customerAnalyticsService.getChurnRiskCustomers(companyId)

    const response = NextResponse.json({
      data: {
        churnRiskCustomers,
        summary: {
          totalAtRisk: churnRiskCustomers.length,
          critical: churnRiskCustomers.filter(c => c.riskLevel === 'Critical').length,
          high: churnRiskCustomers.filter(c => c.riskLevel === 'High').length
        }
      },
      metadata: {
        queryTime: Date.now(),
        freshness: new Date(),
        type: 'churn-risk-analysis'
      }
    }, { status: 200 })

    response.headers.set('Cache-Control', 'private, max-age=900') // 15 minutes
    response.headers.set('X-Analytics-Type', 'churn-risk')

    return response

  } catch (error) {
    console.error('Churn risk API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch churn risk analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}