/**
 * Invoice Analytics API Route
 * Invoice status analytics with real-time aging calculations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { invoiceAnalyticsService } from '@/lib/services/invoice-analytics-service'
import { AnalyticsFilters } from '@/lib/types/analytics'
import { z } from 'zod'

const invoiceFiltersSchema = z.object({
  dateRange: z.object({
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    preset: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional()
  }),
  invoiceStatus: z.array(z.enum(['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'DISPUTED', 'WRITTEN_OFF'])).optional(),
  customerIds: z.array(z.string()).optional(),
  includeArchived: z.boolean().default(false)
})

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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawFilters = {
      dateRange: {
        startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        preset: searchParams.get('preset') || 'month'
      },
      invoiceStatus: searchParams.get('invoiceStatus')?.split(','),
      customerIds: searchParams.get('customerIds')?.split(','),
      includeArchived: searchParams.get('includeArchived') === 'true'
    }

    const filters: AnalyticsFilters = invoiceFiltersSchema.parse(rawFilters)

    // Get invoice status analytics
    const analytics = await invoiceAnalyticsService.getInvoiceStatusAnalytics(companyId, filters)

    const response = NextResponse.json(analytics, { status: 200 })
    response.headers.set('Cache-Control', 'private, max-age=180') // 3 minutes cache
    response.headers.set('X-Analytics-Type', 'invoice-status')

    return response

  } catch (error) {
    console.error('Invoice analytics API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch invoice analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Endpoint for updating invoice status (triggers real-time analytics)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { invoiceId, newStatus, metadata } = body

    if (!invoiceId || !newStatus) {
      return NextResponse.json(
        { error: 'Invoice ID and new status are required' },
        { status: 400 }
      )
    }

    // Update invoice status with real-time analytics
    await invoiceAnalyticsService.updateInvoiceStatus(invoiceId, newStatus, metadata)

    return NextResponse.json(
      { success: true, message: 'Invoice status updated successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Invoice status update API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update invoice status',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}