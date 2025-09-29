import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sequenceTriggersService } from '@/lib/services/sequence-triggers-service'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { emailSchedulingService } from '@/lib/services/email-scheduling-service'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'

interface ProcessingMetrics {
  startTime: Date
  endTime: Date
  duration: number
  processed: {
    triggers: number
    executions: number
    emails: number
  }
  successful: {
    triggers: number
    executions: number
    emails: number
  }
  failed: {
    triggers: number
    executions: number
    emails: number
  }
  errors: string[]
  warnings: string[]
  nextScheduledRun: Date
}

/**
 * POST /api/cron/process-sequences
 * Main cron job that processes all sequence automation
 * 
 * This endpoint should be called by a cron service (like Vercel Cron, GitHub Actions, or external cron)
 * Recommended schedule: Every hour during UAE business hours
 */
export async function POST(request: NextRequest) {
  const startTime = new Date()
  const metrics: ProcessingMetrics = {
    startTime,
    endTime: new Date(),
    duration: 0,
    processed: { triggers: 0, executions: 0, emails: 0 },
    successful: { triggers: 0, executions: 0, emails: 0 },
    failed: { triggers: 0, executions: 0, emails: 0 },
    errors: [],
    warnings: [],
    nextScheduledRun: new Date(startTime.getTime() + 60 * 60 * 1000) // Default 1 hour
  }

  try {
    // Verify this is a legitimate cron request
    const cronAuth = await validateCronRequest(request)
    if (!cronAuth.valid) {
      return NextResponse.json(
        { error: 'Unauthorized cron request', details: cronAuth.reason },
        { status: 401 }
      )
    }

    console.log('🕐 Starting sequence processing cron job at', startTime.toISOString())

    // Check if we should process now (UAE business hours check)
    const shouldProcess = await shouldProcessNow()
    if (!shouldProcess.shouldProcess) {
      metrics.warnings.push(shouldProcess.reason || 'Outside processing window')
      metrics.nextScheduledRun = shouldProcess.nextProcessingTime || 
        new Date(startTime.getTime() + 60 * 60 * 1000)

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: shouldProcess.reason,
        nextRun: metrics.nextScheduledRun,
        metrics
      })
    }

    // Step 1: Monitor and trigger new sequences
    console.log('📊 Monitoring invoice events for sequence triggers...')
    const triggerResults = await sequenceTriggersService.monitorInvoiceEvents()
    
    metrics.processed.triggers = triggerResults.processed
    metrics.successful.triggers = triggerResults.triggered
    metrics.failed.triggers = triggerResults.processed - triggerResults.triggered
    metrics.errors.push(...triggerResults.errors)

    if (triggerResults.errors.length > 0) {
      console.warn('⚠️ Trigger monitoring errors:', triggerResults.errors)
    }

    // Step 2: Process pending sequence executions (continue existing sequences)
    console.log('⚙️ Processing pending sequence executions...')
    const executionResults = await sequenceExecutionService.processPendingExecutions()
    
    metrics.processed.executions = executionResults.processed
    metrics.successful.executions = executionResults.successful
    metrics.failed.executions = executionResults.failed
    metrics.errors.push(...executionResults.errors)

    if (executionResults.errors.length > 0) {
      console.warn('⚠️ Execution processing errors:', executionResults.errors)
    }

    // Step 3: Process scheduled emails
    console.log('📧 Processing scheduled emails...')
    const emailResults = await emailSchedulingService.processScheduledEmails()
    
    metrics.processed.emails = emailResults.processed
    metrics.successful.emails = emailResults.sent
    metrics.failed.emails = emailResults.failed
    
    if (emailResults.rescheduled > 0) {
      metrics.warnings.push(`${emailResults.rescheduled} emails rescheduled due to timing constraints`)
    }

    // Step 4: Health checks and monitoring
    console.log('🏥 Performing system health checks...')
    const healthChecks = await performHealthChecks()
    
    metrics.warnings.push(...healthChecks.warnings)
    metrics.errors.push(...healthChecks.errors)

    // Step 5: Log processing activity
    await logProcessingActivity(metrics)

    // Calculate final metrics
    metrics.endTime = new Date()
    metrics.duration = metrics.endTime.getTime() - startTime.getTime()

    const totalProcessed = metrics.processed.triggers + metrics.processed.executions + metrics.processed.emails
    const totalSuccessful = metrics.successful.triggers + metrics.successful.executions + metrics.successful.emails
    const totalFailed = metrics.failed.triggers + metrics.failed.executions + metrics.failed.emails

    console.log(`✅ Sequence processing completed in ${metrics.duration}ms`)
    console.log(`📈 Results: ${totalSuccessful}/${totalProcessed} successful, ${totalFailed} failed`)

    // Determine next run time based on UAE business hours
    metrics.nextScheduledRun = calculateNextRunTime()

    return NextResponse.json({
      success: true,
      processed: true,
      duration: metrics.duration,
      summary: {
        totalProcessed,
        totalSuccessful,
        totalFailed,
        successRate: totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 100
      },
      details: {
        triggers: {
          processed: metrics.processed.triggers,
          successful: metrics.successful.triggers,
          failed: metrics.failed.triggers
        },
        executions: {
          processed: metrics.processed.executions,
          successful: metrics.successful.executions,
          failed: metrics.failed.executions
        },
        emails: {
          processed: metrics.processed.emails,
          sent: metrics.successful.emails,
          failed: metrics.failed.emails,
          rescheduled: emailResults.rescheduled
        }
      },
      nextRun: metrics.nextScheduledRun,
      errors: metrics.errors,
      warnings: metrics.warnings
    })

  } catch (error) {
    metrics.endTime = new Date()
    metrics.duration = metrics.endTime.getTime() - startTime.getTime()
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    metrics.errors.push(errorMessage)

    console.error('❌ Sequence processing failed:', error)

    // Log the failure
    await logProcessingActivity(metrics, true)

    return NextResponse.json({
      success: false,
      error: 'Sequence processing failed',
      details: errorMessage,
      duration: metrics.duration,
      errors: metrics.errors,
      warnings: metrics.warnings
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/process-sequences
 * Get information about the cron job and next scheduled run
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const nextBusinessHour = uaeBusinessHours.getNextBusinessHour(now)
    
    // Get recent processing activity
    const recentActivity = await prisma.activities.findMany({
      where: {
        type: 'SEQUENCE_PROCESSING',
        createdAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Get queue health
    const queueMetrics = await emailSchedulingService.getQueueMetrics()
    
    // Check if we should be processing now
    const shouldProcess = await shouldProcessNow()

    return NextResponse.json({
      status: 'active',
      currentTime: now,
      timeZone: 'Asia/Dubai',
      isBusinessHours: uaeBusinessHours.isBusinessHours(now),
      nextBusinessHour,
      shouldProcessNow: shouldProcess.shouldProcess,
      processingWindow: {
        reason: shouldProcess.reason,
        nextAvailable: shouldProcess.nextProcessingTime
      },
      queueHealth: {
        status: queueMetrics.queueHealth,
        queued: queueMetrics.totalQueued,
        scheduledToday: queueMetrics.scheduledForToday,
        failedLastHour: queueMetrics.failedLastHour
      },
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        timestamp: activity.createdAt,
        description: activity.description,
        metadata: activity.metadata
      })),
      configuration: {
        processingInterval: '1 hour',
        businessHours: 'Sunday-Thursday, 8 AM - 6 PM UAE',
        holidayHandling: 'Skip UAE public and Islamic holidays',
        culturalCompliance: 'Enabled - optimal timing Tue-Thu 10-11 AM'
      }
    })

  } catch (error) {
    console.error('Error getting cron job status:', error)
    return NextResponse.json(
      { error: 'Failed to get cron job status' },
      { status: 500 }
    )
  }
}

/**
 * Validate that this is a legitimate cron request
 */
async function validateCronRequest(request: NextRequest): Promise<{
  valid: boolean
  reason?: string
}> {
  try {
    // Check for cron secret in headers (recommended for production)
    const cronSecret = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
      return { valid: false, reason: 'Invalid cron secret' }
    }

    // Check for Vercel cron headers (if using Vercel)
    const vercelCron = request.headers.get('x-vercel-cron')
    if (vercelCron) {
      return { valid: true }
    }

    // Check for other legitimate cron sources
    const userAgent = request.headers.get('user-agent')
    if (userAgent?.includes('vercel') || userAgent?.includes('github-actions')) {
      return { valid: true }
    }

    // Allow localhost for development
    const host = request.headers.get('host')
    if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
      return { valid: true }
    }

    return { valid: false, reason: 'Unrecognized cron source' }

  } catch (error) {
    return { valid: false, reason: 'Validation error' }
  }
}

/**
 * Determine if we should process sequences now
 */
async function shouldProcessNow(): Promise<{
  shouldProcess: boolean
  reason?: string
  nextProcessingTime?: Date
}> {
  const now = new Date()

  // Check UAE business hours
  if (!uaeBusinessHours.isBusinessHours(now)) {
    const nextBusinessHour = uaeBusinessHours.getNextBusinessHour(now)
    return {
      shouldProcess: false,
      reason: 'Outside UAE business hours (Sunday-Thursday, 8 AM - 6 PM)',
      nextProcessingTime: nextBusinessHour
    }
  }

  // Check if it's a UAE holiday
  if (uaeBusinessHours.isUAEHoliday(now)) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const nextBusinessDay = uaeBusinessHours.getNextBusinessHour(tomorrow)
    return {
      shouldProcess: false,
      reason: 'UAE holiday - sequence processing paused',
      nextProcessingTime: nextBusinessDay
    }
  }

  // Check if we're in a prayer time buffer
  if (uaeBusinessHours.isPrayerTime(now)) {
    const nextAvailable = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes later
    return {
      shouldProcess: false,
      reason: 'Prayer time - avoiding email sends',
      nextProcessingTime: nextAvailable
    }
  }

  // All checks passed
  return { shouldProcess: true }
}

/**
 * Perform system health checks
 */
async function performHealthChecks(): Promise<{
  warnings: string[]
  errors: string[]
}> {
  const warnings: string[] = []
  const errors: string[] = []

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`

    // Check for stuck sequences (running for too long)
    const stuckSequences = await prisma.follow_up_logs.count({
      where: {
        sentAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days old
        }
        // Add logic to check for sequences that should have continued but haven't
      }
    })

    if (stuckSequences > 10) {
      warnings.push(`${stuckSequences} sequences may be stuck`)
    }

    // Check email queue health
    const queueMetrics = await emailSchedulingService.getQueueMetrics()
    
    if (queueMetrics.queueHealth === 'CRITICAL') {
      errors.push('Email queue in critical state')
    } else if (queueMetrics.queueHealth === 'WARNING') {
      warnings.push('Email queue showing warning signs')
    }

    if (queueMetrics.totalQueued > 1000) {
      warnings.push(`Large email queue: ${queueMetrics.totalQueued} emails pending`)
    }

    // Check for high failure rates
    if (queueMetrics.failedLastHour > 50) {
      errors.push(`High email failure rate: ${queueMetrics.failedLastHour} failed in last hour`)
    }

  } catch (error) {
    errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { warnings, errors }
}

/**
 * Log processing activity for monitoring
 */
async function logProcessingActivity(
  metrics: ProcessingMetrics,
  isError: boolean = false
): Promise<void> {
  try {
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: 'system', // System-level activity
        userId: 'cron-job',
        type: 'SEQUENCE_PROCESSING',
        description: isError 
          ? `Sequence processing failed after ${metrics.duration}ms`
          : `Processed ${metrics.processed.triggers} triggers, ${metrics.processed.executions} executions, ${metrics.processed.emails} emails in ${metrics.duration}ms`,
        metadata: {
          startTime: metrics.startTime,
          endTime: metrics.endTime,
          duration: metrics.duration,
          processed: metrics.processed,
          successful: metrics.successful,
          failed: metrics.failed,
          errors: metrics.errors,
          warnings: metrics.warnings,
          isError
        }
      }
    })
  } catch (error) {
    console.error('Failed to log processing activity:', error)
  }
}

/**
 * Calculate next run time based on UAE business hours
 */
function calculateNextRunTime(): Date {
  const now = new Date()
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour later
  
  // If next hour is still within business hours, schedule then
  if (uaeBusinessHours.isBusinessHours(nextHour) && !uaeBusinessHours.isUAEHoliday(nextHour)) {
    return nextHour
  }
  
  // Otherwise, schedule for next business hour
  return uaeBusinessHours.getNextBusinessHour(nextHour)
}