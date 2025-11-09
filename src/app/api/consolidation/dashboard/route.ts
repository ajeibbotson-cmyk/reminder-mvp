/**
 * Consolidation Dashboard API
 * GET /api/consolidation/dashboard - Get consolidation dashboard overview data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import { prisma } from '@/lib/prisma'
import type { ConsolidationApiResponse, ConsolidationDashboardData } from '@/lib/types/consolidation'

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

    console.log(`📊 Getting consolidation dashboard for company ${session.user.companyId}`)

    // Get current consolidation candidates
    const candidates = await customerConsolidationService.getConsolidationCandidates(session.user.companyId)
    const eligibleCandidates = candidates.filter(c => c.canContact)

    // Calculate queue summary
    const queueSummary = {
      totalCustomers: candidates.length,
      eligibleCustomers: eligibleCandidates.length,
      totalOutstanding: candidates.reduce((sum, c) => sum + c.totalAmount, 0),
      emailsSaved: candidates.reduce((sum, c) => sum + (c.overdueInvoices.length - 1), 0),
      avgPriorityScore: candidates.length > 0
        ? Math.round(candidates.reduce((sum, c) => sum + c.priorityScore, 0) / candidates.length)
        : 0
    }

    // Get recent consolidation activity (last 7 days)
    const recentActivity = await prisma.customerConsolidatedReminder.findMany({
      where: {
        companyId: session.user.companyId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        emailLogs: {
          select: {
            id: true,
            deliveryStatus: true,
            openedAt: true,
            clickedAt: true,
            sentAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Transform recent activity
    const activityFeed = recentActivity.flatMap(consolidation => {
      const activities = []

      // Consolidation created
      activities.push({
        id: `${consolidation.id}-created`,
        customerId: consolidation.customerId,
        customerName: consolidation.customer.name,
        action: 'created' as const,
        timestamp: consolidation.createdAt,
        invoiceCount: consolidation.invoiceCount,
        amount: Number(consolidation.totalAmount)
      })

      // Email sent
      if (consolidation.sentAt) {
        activities.push({
          id: `${consolidation.id}-sent`,
          customerId: consolidation.customerId,
          customerName: consolidation.customer.name,
          action: 'sent' as const,
          timestamp: consolidation.sentAt,
          invoiceCount: consolidation.invoiceCount,
          amount: Number(consolidation.totalAmount)
        })
      }

      // Email interactions
      consolidation.emailLogs.forEach(email => {
        if (email.openedAt) {
          activities.push({
            id: `${consolidation.id}-opened`,
            customerId: consolidation.customerId,
            customerName: consolidation.customer.name,
            action: 'opened' as const,
            timestamp: email.openedAt,
            invoiceCount: consolidation.invoiceCount,
            amount: Number(consolidation.totalAmount)
          })
        }

        if (email.clickedAt) {
          activities.push({
            id: `${consolidation.id}-clicked`,
            customerId: consolidation.customerId,
            customerName: consolidation.customer.name,
            action: 'clicked' as const,
            timestamp: email.clickedAt,
            invoiceCount: consolidation.invoiceCount,
            amount: Number(consolidation.totalAmount)
          })
        }
      })

      return activities
    })

    // Sort by timestamp and take most recent
    const sortedActivity = activityFeed
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 15)

    // Get upcoming scheduled consolidations
    const upcomingScheduled = await prisma.customerConsolidatedReminder.findMany({
      where: {
        companyId: session.user.companyId,
        deliveryStatus: 'QUEUED',
        scheduledFor: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        emailTemplate: {
          select: {
            id: true,
            name: true,
            templateType: true
          }
        }
      },
      orderBy: { scheduledFor: 'asc' },
      take: 10
    })

    // Transform upcoming scheduled to match interface
    const upcomingScheduledFormatted = upcomingScheduled.map(consolidation => ({
      id: consolidation.id,
      customerId: consolidation.customerId,
      companyId: consolidation.companyId,
      invoiceIds: consolidation.invoiceIds,
      totalAmount: Number(consolidation.totalAmount),
      currency: consolidation.currency,
      invoiceCount: consolidation.invoiceCount,
      reminderType: consolidation.reminderType,
      escalationLevel: consolidation.escalationLevel,
      templateId: consolidation.templateId,
      scheduledFor: consolidation.scheduledFor,
      sentAt: consolidation.sentAt,
      deliveryStatus: consolidation.deliveryStatus,
      lastContactDate: consolidation.lastContactDate,
      nextEligibleContact: consolidation.nextEligibleContact,
      contactIntervalDays: consolidation.contactIntervalDays,
      priorityScore: consolidation.priorityScore,
      consolidationReason: consolidation.consolidationReason,
      businessRules: consolidation.businessRulesApplied || {},
      culturalCompliance: consolidation.culturalComplianceFlags || {},
      responseTracking: {
        emailOpenedAt: consolidation.emailOpenedAt,
        emailClickedAt: consolidation.emailClickedAt,
        customerRespondedAt: consolidation.customerRespondedAt,
        paymentReceivedAt: consolidation.paymentReceivedAt,
        awsMessageId: consolidation.awsMessageId
      },
      createdAt: consolidation.createdAt,
      updatedAt: consolidation.updatedAt,
      createdBy: consolidation.createdBy
    }))

    // Get effectiveness metrics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const effectivenessMetrics = await customerConsolidationService.getConsolidationMetrics(
      session.user.companyId,
      { from: thirtyDaysAgo, to: new Date() }
    )

    const dashboardData: ConsolidationDashboardData = {
      queueSummary,
      recentActivity: sortedActivity,
      upcomingScheduled: upcomingScheduledFormatted,
      effectivenessMetrics
    }

    // Add additional insights
    const insights = {
      trending: {
        candidatesChange: 0, // Would calculate vs previous period
        emailSavingsChange: 0, // Would calculate vs previous period
        effectivenessChange: 0 // Would calculate vs previous period
      },
      alerts: generateAlerts(queueSummary, effectivenessMetrics),
      quickActions: [
        {
          type: 'send_urgent',
          label: 'Send Urgent Consolidations',
          count: eligibleCandidates.filter(c => c.escalationLevel === 'URGENT').length,
          enabled: eligibleCandidates.filter(c => c.escalationLevel === 'URGENT').length > 0
        },
        {
          type: 'schedule_batch',
          label: 'Schedule Batch Processing',
          count: eligibleCandidates.length,
          enabled: eligibleCandidates.length > 0
        },
        {
          type: 'review_waiting',
          label: 'Review Waiting Customers',
          count: candidates.filter(c => !c.canContact).length,
          enabled: candidates.filter(c => !c.canContact).length > 0
        }
      ]
    }

    const response: ConsolidationApiResponse<ConsolidationDashboardData> = {
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      ...response,
      insights
    })

  } catch (error) {
    console.error('Consolidation dashboard error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to retrieve consolidation dashboard data',
      code: 'DASHBOARD_RETRIEVAL_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * Generate dashboard alerts based on current state
 */
function generateAlerts(
  queueSummary: any,
  effectivenessMetrics: any
): Array<{ type: string; severity: 'info' | 'warning' | 'error'; message: string; action?: string }> {
  const alerts = []

  // Queue backlog alert
  if (queueSummary.eligibleCustomers > 50) {
    alerts.push({
      type: 'queue_backlog',
      severity: 'warning' as const,
      message: `${queueSummary.eligibleCustomers} customers are eligible for consolidation. Consider batch processing.`,
      action: 'Process batch consolidation'
    })
  }

  // High outstanding amount alert
  if (queueSummary.totalOutstanding > 100000) {
    alerts.push({
      type: 'high_outstanding',
      severity: 'error' as const,
      message: `${new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(queueSummary.totalOutstanding)} in outstanding invoices ready for consolidation.`,
      action: 'Process high-value consolidations immediately'
    })
  }

  // Low effectiveness alert
  if (effectivenessMetrics.effectivenessMetrics.openRate < 25) {
    alerts.push({
      type: 'low_effectiveness',
      severity: 'warning' as const,
      message: `Email open rate is ${effectivenessMetrics.effectivenessMetrics.openRate.toFixed(1)}%, below optimal threshold.`,
      action: 'Review email templates and timing'
    })
  }

  // Success notification
  if (effectivenessMetrics.emailsSaved > 200) {
    alerts.push({
      type: 'success',
      severity: 'info' as const,
      message: `Excellent! ${effectivenessMetrics.emailsSaved} emails saved through consolidation this period.`,
      action: 'View detailed metrics'
    })
  }

  return alerts
}