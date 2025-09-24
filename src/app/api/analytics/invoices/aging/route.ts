/**
 * Invoice Aging Analytics API Route
 * Detailed aging analysis for UAE business days calculations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { invoiceAnalyticsService } from '@/lib/services/invoice-analytics-service'

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

    // Get comprehensive aging report
    const agingReport = await invoiceAnalyticsService.getInvoiceAgingReport(companyId)

    const response = NextResponse.json({
      data: agingReport,
      metadata: {
        queryTime: Date.now(),
        freshness: new Date(),
        type: 'aging-analysis'
      }
    }, { status: 200 })

    response.headers.set('Cache-Control', 'private, max-age=300') // 5 minutes
    response.headers.set('X-Analytics-Type', 'invoice-aging')

    return response

  } catch (error) {
    console.error('Invoice aging API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice aging analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Batch update overdue invoices
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.company_id

    // Batch update overdue invoices
    const updatedCount = await invoiceAnalyticsService.batchUpdateOverdueInvoices(companyId)

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} invoices to overdue status`,
      updatedCount
    }, { status: 200 })

  } catch (error) {
    console.error('Batch update overdue API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update overdue invoices',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}