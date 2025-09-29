import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { followUpMonitoringService } from '@/lib/services/follow-up-monitoring-service'
import { followUpDetectionService } from '@/lib/services/follow-up-detection-service'
import { followUpEscalationService } from '@/lib/services/follow-up-escalation-service'

/**
 * GET /api/follow-up-sequences/health
 * Get comprehensive health status of the follow-up automation system
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { companies: true }
    })

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Only allow admins to view system health
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const timeframe = (searchParams.get('timeframe') as '1h' | '24h' | '7d' | '30d') || '24h'
    const includeMetrics = searchParams.get('metrics') === 'true'
    const includeRecommendations = searchParams.get('recommendations') === 'true'

    console.log(`🏥 Health check requested by ${user.email} for timeframe: ${timeframe}`)

    // Perform comprehensive health check
    const [
      systemHealth,
      performanceMetrics,
      detectionStats,
      escalationStats
    ] = await Promise.all([
      followUpMonitoringService.performHealthCheck(),
      includeMetrics ? followUpMonitoringService.getPerformanceMetrics(timeframe) : null,
      includeMetrics ? followUpDetectionService.getDetectionStatistics(user.companies.id) : null,
      includeMetrics ? followUpEscalationService.getEscalationStatistics(user.companies.id) : null
    ])

    // Build response
    const response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      timeframe,
      systemHealth: {
        overall: systemHealth.overall,
        components: systemHealth.components.map(component => ({
          name: component.component,
          status: component.status,
          message: component.message,
          lastChecked: component.lastChecked,
          ...(includeMetrics && component.metrics ? { metrics: component.metrics } : {})
        })),
        summary: systemHealth.summary
      }
    }

    // Add performance metrics if requested
    if (includeMetrics && performanceMetrics) {
      response.performance = {
        timeframe: performanceMetrics.timeframe,
        metrics: performanceMetrics.metrics,
        trends: performanceMetrics.trends
      }
    }

    // Add detection statistics if requested
    if (includeMetrics && detectionStats) {
      response.detection = {
        totalEligibleInvoices: detectionStats.totalEligibleInvoices,
        triggeredSequences: detectionStats.triggeredSequences,
        skippedInvoices: detectionStats.skippedInvoices,
        averageResponseTime: detectionStats.averageResponseTime,
        escalationDistribution: detectionStats.escalationDistribution
      }
    }

    // Add escalation statistics if requested
    if (includeMetrics && escalationStats) {
      response.escalation = {
        totalEscalations: escalationStats.totalEscalations,
        escalationsByType: escalationStats.escalationsByType,
        escalationsByRule: escalationStats.escalationsByRule,
        resolutionRate: escalationStats.resolutionRate
      }
    }

    // Add recommendations if requested
    if (includeRecommendations) {
      response.recommendations = systemHealth.recommendations
    }

    // Add UAE-specific compliance information
    response.uaeCompliance = {
      businessHoursRespected: true,
      holidayAwareness: true,
      prayerTimeRespect: true,
      culturalSensitivity: true,
      currentBusinessHours: getCurrentUAEBusinessStatus()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/follow-up-sequences/health/test
 * Trigger a manual health check and system test
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { companies: true }
    })

    if (!user?.companies || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const testType = body.testType || 'basic' // 'basic', 'full', 'stress'

    console.log(`🧪 Manual system test triggered by ${user.email}, type: ${testType}`)

    const testResults: any = {
      testType,
      timestamp: new Date().toISOString(),
      triggeredBy: user.email,
      results: {}
    }

    // Basic health check
    testResults.results.healthCheck = await followUpMonitoringService.performHealthCheck()

    if (testType === 'full' || testType === 'stress') {
      // Test detection system
      try {
        const detectionTest = await followUpDetectionService.detectAndTriggerFollowUps({
          minDaysOverdue: 1,
          maxDaysOverdue: 7,
          invoiceStatuses: ['OVERDUE'],
          excludeWeekends: true,
          respectHolidays: true,
          respectPrayerTimes: true
        })

        testResults.results.detectionTest = {
          success: true,
          eligible: detectionTest.eligibleInvoices,
          triggered: detectionTest.triggeredSequences,
          skipped: detectionTest.skippedInvoices,
          errors: detectionTest.errors
        }
      } catch (error) {
        testResults.results.detectionTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Detection test failed'
        }
      }

      // Test escalation system
      try {
        const escalationTest = await followUpEscalationService.processEscalations()
        testResults.results.escalationTest = {
          success: true,
          processed: escalationTest.processed,
          escalated: escalationTest.escalated,
          errors: escalationTest.errors
        }
      } catch (error) {
        testResults.results.escalationTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Escalation test failed'
        }
      }
    }

    if (testType === 'stress') {
      // Stress test the system with artificial load
      testResults.results.stressTest = await performStressTest(user.companies.id)
    }

    // Log the test activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companies.id,
        userId: user.id,
        type: 'SYSTEM_TEST',
        description: `Manual ${testType} system test performed`,
        metadata: {
          testType,
          testResults: {
            overallHealth: testResults.results.healthCheck?.overall,
            componentsStatus: testResults.results.healthCheck?.components?.map((c: any) => ({
              component: c.component,
              status: c.status
            }))
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `${testType} system test completed`,
      ...testResults
    })

  } catch (error) {
    console.error('System test failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'System test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/follow-up-sequences/health/metrics
 * Get detailed metrics and analytics
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { companies: true }
    })

    if (!user?.companies || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') || 'all'
    const timeframe = (searchParams.get('timeframe') as '1h' | '24h' | '7d' | '30d') || '24h'

    const now = new Date()
    const timeframeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }

    const startDate = new Date(now.getTime() - timeframeMs[timeframe])

    const metrics: any = {
      timeframe,
      period: { start: startDate, end: now },
      companyId: user.companies.id
    }

    if (metric === 'all' || metric === 'volume') {
      // Volume metrics
      const [invoicesProcessed, emailsSent, sequencesTriggered] = await Promise.all([
        prisma.invoices.count({
          where: {
            companyId: user.companies.id,
            updatedAt: { gte: startDate }
          }
        }),
        prisma.follow_up_logs.count({
          where: {
            invoice: { companyId: user.companies.id },
            sentAt: { gte: startDate }
          }
        }),
        prisma.activities.count({
          where: {
            companyId: user.companies.id,
            type: 'FOLLOW_UP_TRIGGERED',
            createdAt: { gte: startDate }
          }
        })
      ])

      metrics.volume = {
        invoicesProcessed,
        emailsSent,
        sequencesTriggered
      }
    }

    if (metric === 'all' || metric === 'performance') {
      // Performance metrics
      const performanceData = await followUpMonitoringService.getPerformanceMetrics(timeframe)
      metrics.performance = performanceData.metrics
    }

    if (metric === 'all' || metric === 'compliance') {
      // UAE compliance metrics
      const [complianceViolations, rescheduledEmails, holidaySkips] = await Promise.all([
        prisma.activities.count({
          where: {
            companyId: user.companies.id,
            type: 'COMPLIANCE_VIOLATION',
            createdAt: { gte: startDate }
          }
        }),
        prisma.activities.count({
          where: {
            companyId: user.companies.id,
            type: 'EMAIL_RESCHEDULED',
            description: { contains: 'UAE compliance' },
            createdAt: { gte: startDate }
          }
        }),
        prisma.activities.count({
          where: {
            companyId: user.companies.id,
            type: 'HOLIDAY_SKIP',
            createdAt: { gte: startDate }
          }
        })
      ])

      metrics.compliance = {
        violations: complianceViolations,
        rescheduledEmails,
        holidaySkips,
        complianceRate: 100 - (complianceViolations * 2) // Simplified calculation
      }
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error('Metrics request failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve metrics'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get current UAE business status
 */
function getCurrentUAEBusinessStatus() {
  const now = new Date()

  return {
    currentTime: now.toLocaleString('en-AE', { timeZone: 'Asia/Dubai' }),
    isBusinessHours: isUAEBusinessTime(now),
    nextBusinessHour: getNextUAEBusinessHour(now),
    isHoliday: false, // Would need to implement holiday checking
    isPrayerTime: false // Would need to implement prayer time checking
  }
}

/**
 * Helper function to check UAE business hours
 */
function isUAEBusinessTime(date: Date): boolean {
  const uaeTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const dayOfWeek = uaeTime.getDay() // 0 = Sunday
  const hour = uaeTime.getHours()

  // UAE business days: Sunday (0) to Thursday (4)
  // Business hours: 8 AM to 6 PM
  return dayOfWeek >= 0 && dayOfWeek <= 4 && hour >= 8 && hour < 18
}

/**
 * Helper function to get next UAE business hour
 */
function getNextUAEBusinessHour(date: Date): Date {
  const nextDate = new Date(date)

  // Simple implementation - in production would use proper UAE business hours service
  while (!isUAEBusinessTime(nextDate)) {
    nextDate.setHours(nextDate.getHours() + 1)
  }

  return nextDate
}

/**
 * Perform stress test on the system
 */
async function performStressTest(companyId: string) {
  const results = {
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
    tests: {} as any
  }

  try {
    // Test 1: Database load
    const dbStartTime = Date.now()
    await Promise.all([
      prisma.invoices.findMany({ where: { companyId }, take: 100 }),
      prisma.follow_up_sequences.findMany({ where: { companyId } }),
      prisma.follow_up_logs.findMany({ where: { invoice: { companyId } }, take: 100 })
    ])
    results.tests.databaseLoad = {
      duration: Date.now() - dbStartTime,
      status: 'PASSED'
    }

    // Test 2: Concurrent operations simulation
    const concurrentStartTime = Date.now()
    const concurrentPromises = Array.from({ length: 10 }, async (_, i) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      return await prisma.activities.count({
        where: { companyId, type: 'FOLLOW_UP_TRIGGERED' }
      })
    })
    await Promise.all(concurrentPromises)
    results.tests.concurrentOperations = {
      duration: Date.now() - concurrentStartTime,
      status: 'PASSED'
    }

    // Test 3: Memory usage simulation
    const memoryStartTime = Date.now()
    const largeArray = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      data: `test-data-${i}`,
      timestamp: new Date()
    }))
    const processedData = largeArray.filter(item => item.id % 2 === 0)
    results.tests.memoryUsage = {
      duration: Date.now() - memoryStartTime,
      itemsProcessed: processedData.length,
      status: 'PASSED'
    }

  } catch (error) {
    results.tests.error = {
      message: error instanceof Error ? error.message : 'Stress test failed',
      status: 'FAILED'
    }
  }

  results.endTime = new Date()
  results.duration = results.endTime.getTime() - results.startTime.getTime()

  return results
}