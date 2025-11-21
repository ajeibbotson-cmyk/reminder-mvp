/**
 * Real-time Analytics API Route
 * Real-time KPIs and live dashboard updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { kpiCalculationEngine } from '@/lib/services/kpi-calculation-engine'
import { AnalyticsEvent } from '@/lib/types/analytics'
import { z } from 'zod'

const analyticsEventSchema = z.object({
  eventType: z.enum(['payment_received', 'invoice_created', 'email_sent', 'customer_updated', 'system_alert']),
  entityId: z.string(),
  entityType: z.string(),
  metadata: z.record(z.any()).optional(),
  impact: z.object({
    kpiUpdates: z.array(z.string()),
    realtimeRefresh: z.boolean(),
    cacheInvalidation: z.array(z.string())
  })
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.companyId

    // Get real-time metrics with minimal caching
    const filters = {
      dateRange: {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        endDate: new Date()
      }
    }

    const analytics = await kpiCalculationEngine.getDashboardAnalytics(companyId, filters)

    // Extract real-time specific data
    const realtimeData = {
      realtimeMetrics: analytics.data.realtimeMetrics,
      overview: analytics.data.overview,
      alerts: analytics.data.predictions.riskAlerts,
      lastUpdated: new Date()
    }

    const response = NextResponse.json({
      data: realtimeData,
      metadata: {
        queryTime: analytics.metadata.queryTime,
        freshness: new Date(),
        type: 'realtime-dashboard'
      }
    }, { status: 200 })

    // Minimal caching for real-time data
    response.headers.set('Cache-Control', 'private, max-age=30') // 30 seconds
    response.headers.set('X-Analytics-Type', 'realtime')

    return response

  } catch (error) {
    console.error('Real-time analytics API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch real-time analytics',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Process real-time analytics events
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const companyId = session.user.companyId
    const body = await request.json()

    // Validate event data
    const eventData = analyticsEventSchema.parse(body)

    // Create analytics event
    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      companyId,
      ...eventData
    }

    // Process real-time event
    await kpiCalculationEngine.processRealtimeEvent(event)

    return NextResponse.json({
      success: true,
      message: 'Real-time event processed successfully',
      eventId: event.id
    }, { status: 200 })

  } catch (error) {
    console.error('Real-time event processing API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to process real-time event',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Server-Sent Events endpoint for real-time updates (future implementation)
// CONNECT method not supported in Next.js 15, using GET for SSE instead
/*
export async function CONNECT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    // This would implement Server-Sent Events for real-time dashboard updates
    // For now, return a placeholder response
    return NextResponse.json({
      message: 'Real-time SSE endpoint - to be implemented with WebSocket or SSE infrastructure'
    }, { status: 501 })

  } catch (error) {
    console.error('Real-time SSE connection error:', error)
    return NextResponse.json(
      { error: 'Failed to establish real-time connection' },
      { status: 500 }
    )
  }
}
*/