import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'
import { getDefaultEmailService } from '@/lib/email-service'
import { culturalCompliance } from '@/lib/services/cultural-compliance-service'

interface FollowUpStep {
  stepNumber: number
  delayDays: number
  templateId?: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC' | 'BOTH'
  stopConditions?: string[]
  escalationLevel: 'GENTLE' | 'REMINDER' | 'URGENT' | 'FINAL'
}

interface ProcessingMetrics {
  startTime: Date
  endTime: Date
  duration: number
  processed: {
    overdueInvoices: number
    followUpLogs: number
    emailsSent: number
  }
  successful: {
    triggeredSequences: number
    sentEmails: number
    completedSteps: number
  }
  failed: {
    triggerFailures: number
    emailFailures: number
    businessRuleViolations: number
  }
  errors: string[]
  warnings: string[]
  skipped: {
    holidaySkips: number
    prayerTimeSkips: number
    businessHourSkips: number
    culturalComplianceSkips: number
  }
  nextScheduledRun: Date
}

/**
 * POST /api/cron/process-follow-ups
 * Main cron job that processes automated follow-up reminders for overdue invoices
 *
 * This endpoint should be called by a cron service every hour during UAE business hours
 * It handles:
 * 1. Detection of overdue invoices that need follow-ups
 * 2. Processing of existing follow-up sequences
 * 3. UAE business compliance (hours, holidays, prayer times)
 * 4. Cultural sensitivity and escalation management
 */
export async function POST(request: NextRequest) {
  const startTime = new Date()
  const metrics: ProcessingMetrics = {
    startTime,
    endTime: new Date(),
    duration: 0,
    processed: { overdueInvoices: 0, followUpLogs: 0, emailsSent: 0 },
    successful: { triggeredSequences: 0, sentEmails: 0, completedSteps: 0 },
    failed: { triggerFailures: 0, emailFailures: 0, businessRuleViolations: 0 },
    errors: [],
    warnings: [],
    skipped: { holidaySkips: 0, prayerTimeSkips: 0, businessHourSkips: 0, culturalComplianceSkips: 0 },
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

    console.log('🕐 Starting follow-up processing cron job at', startTime.toISOString())

    // Check if we should process now (UAE business hours and cultural considerations)
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

    // Step 1: Detect overdue invoices that need follow-up initiation
    console.log('🔍 Detecting overdue invoices for follow-up initiation...')
    const overdueResults = await detectAndInitiateFollowUps()
    metrics.processed.overdueInvoices = overdueResults.processed
    metrics.successful.triggeredSequences = overdueResults.triggered
    metrics.failed.triggerFailures = overdueResults.failed
    metrics.errors.push(...overdueResults.errors)

    // Step 2: Process existing follow-up sequences (send next steps)
    console.log('📧 Processing pending follow-up sequence steps...')
    const sequenceResults = await processPendingFollowUpSteps()
    metrics.processed.followUpLogs = sequenceResults.processed
    metrics.successful.completedSteps = sequenceResults.completed
    metrics.failed.emailFailures = sequenceResults.failed
    metrics.errors.push(...sequenceResults.errors)

    // Combine email metrics
    metrics.processed.emailsSent = sequenceResults.emailsSent
    metrics.successful.sentEmails = sequenceResults.emailsSent - sequenceResults.failed

    // Step 3: UAE business compliance and cultural sensitivity cleanup
    console.log('🇦🇪 Applying UAE business compliance and cultural sensitivity...')
    const complianceResults = await applyBusinessCompliance()
    metrics.skipped.businessHourSkips = complianceResults.businessHourSkips
    metrics.skipped.holidaySkips = complianceResults.holidaySkips
    metrics.skipped.prayerTimeSkips = complianceResults.prayerTimeSkips
    metrics.skipped.culturalComplianceSkips = complianceResults.culturalSkips
    metrics.warnings.push(...complianceResults.warnings)

    // Step 4: Cleanup and maintenance
    console.log('🧹 Performing cleanup and maintenance...')
    await performMaintenance()

    // Step 5: Log processing activity
    await logProcessingActivity(metrics)

    // Calculate final metrics
    metrics.endTime = new Date()
    metrics.duration = metrics.endTime.getTime() - startTime.getTime()

    const totalProcessed = metrics.processed.overdueInvoices + metrics.processed.followUpLogs
    const totalSuccessful = metrics.successful.triggeredSequences + metrics.successful.completedSteps
    const totalFailed = metrics.failed.triggerFailures + metrics.failed.emailFailures + metrics.failed.businessRuleViolations

    console.log(`✅ Follow-up processing completed in ${metrics.duration}ms`)
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
        successRate: totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 100,
        emailsSent: metrics.successful.sentEmails,
        sequencesTriggered: metrics.successful.triggeredSequences
      },
      details: {
        overdueInvoices: {
          processed: metrics.processed.overdueInvoices,
          triggered: metrics.successful.triggeredSequences,
          failed: metrics.failed.triggerFailures
        },
        followUpSequences: {
          processed: metrics.processed.followUpLogs,
          completed: metrics.successful.completedSteps,
          failed: metrics.failed.emailFailures
        },
        uaeCompliance: {
          businessHourSkips: metrics.skipped.businessHourSkips,
          holidaySkips: metrics.skipped.holidaySkips,
          prayerTimeSkips: metrics.skipped.prayerTimeSkips,
          culturalSkips: metrics.skipped.culturalComplianceSkips
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

    console.error('❌ Follow-up processing failed:', error)

    // Log the failure
    await logProcessingActivity(metrics, true)

    return NextResponse.json({
      success: false,
      error: 'Follow-up processing failed',
      details: errorMessage,
      duration: metrics.duration,
      errors: metrics.errors,
      warnings: metrics.warnings
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/process-follow-ups
 * Get information about the follow-up cron job status and health
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const nextBusinessHour = uaeBusinessHours.getNextBusinessHour(now)

    // Get recent processing activity
    const recentActivity = await prisma.activity.findMany({
      where: {
        type: 'FOLLOW_UP_PROCESSING',
        createdAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Get queue health metrics
    const [
      totalActiveSequences,
      pendingFollowUps,
      failedLastHour,
      overdueInvoices
    ] = await Promise.all([
      prisma.followUpSequence.count({ where: { active: true } }),
      prisma.followUpLog.count({
        where: {
          deliveryStatus: { in: ['QUEUED', 'SENT'] }
        }
      }),
      prisma.followUpLog.count({
        where: {
          deliveryStatus: 'FAILED',
          sentAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000) // Last hour
          }
        }
      }),
      prisma.invoice.count({
        where: {
          status: 'OVERDUE',
          dueDate: {
            lt: new Date()
          }
        }
      })
    ])

    // Check if we should be processing now
    const shouldProcess = await shouldProcessNow()

    // Calculate queue health status
    let queueHealth = 'HEALTHY'
    if (failedLastHour > 20) {
      queueHealth = 'CRITICAL'
    } else if (failedLastHour > 5 || pendingFollowUps > 500) {
      queueHealth = 'WARNING'
    }

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
        status: queueHealth,
        activeSequences: totalActiveSequences,
        pendingFollowUps,
        failedLastHour,
        overdueInvoices
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
        culturalCompliance: 'Enabled - optimal timing Tue-Thu 10-11 AM',
        escalationLevels: ['GENTLE', 'REMINDER', 'URGENT', 'FINAL'],
        prayerTimeRespect: 'Enabled - avoid ±15 minutes around prayer times'
      }
    })

  } catch (error) {
    console.error('Error getting follow-up cron job status:', error)
    return NextResponse.json(
      { error: 'Failed to get cron job status' },
      { status: 500 }
    )
  }
}

/**
 * Detect overdue invoices and initiate follow-up sequences
 */
async function detectAndInitiateFollowUps(): Promise<{
  processed: number
  triggered: number
  failed: number
  errors: string[]
}> {
  const results = { processed: 0, triggered: 0, failed: 0, errors: [] }

  try {
    // Find overdue invoices that don't have active follow-ups
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        dueDate: {
          lt: new Date()
        },
        // Exclude invoices that already have active follow-ups
        NOT: {
          followUpLogs: {
            some: {
              deliveryStatus: { in: ['QUEUED', 'SENT'] }
            }
          }
        }
      },
      include: {
        company: true,
        customer: true
      }
    })

    results.processed = overdueInvoices.length

    for (const invoice of overdueInvoices) {
      try {
        // Find active follow-up sequences for this company
        const activeSequences = await prisma.followUpSequence.findMany({
          where: {
            companyId: invoice.companyId,
            active: true
          }
        })

        if (activeSequences.length === 0) {
          results.errors.push(`No active follow-up sequences for company ${invoice.companyId}`)
          continue
        }

        // For simplicity, use the first active sequence
        // In a more sophisticated system, you'd match based on invoice criteria
        const sequence = activeSequences[0]

        // Parse sequence steps
        let steps: FollowUpStep[]
        try {
          steps = typeof sequence.steps === 'string'
            ? JSON.parse(sequence.steps)
            : sequence.steps as any
        } catch {
          results.errors.push(`Failed to parse steps for sequence ${sequence.id}`)
          results.failed++
          continue
        }

        if (steps.length === 0) {
          results.errors.push(`Sequence ${sequence.id} has no steps`)
          results.failed++
          continue
        }

        // Calculate when to send the first step (respecting UAE business hours)
        const daysPastDue = Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const firstStep = steps[0]

        // Determine send time based on UAE business compliance
        let scheduledSendTime = new Date()
        if (firstStep.delayDays > 0) {
          scheduledSendTime = new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000)
        }

        // Apply UAE business hours and cultural timing
        const optimalSendTime = uaeBusinessHours.getNextAvailableSendTime(scheduledSendTime, {
          preferredDays: [2, 3, 4], // Tuesday-Thursday
          preferredHours: [10, 11], // 10-11 AM
          avoidPrayerTimes: true,
          respectRamadan: true,
          culturalTone: 'BUSINESS'
        })

        // Create follow-up log entry for the first step
        await prisma.followUpLog.create({
          data: {
            id: crypto.randomUUID(),
            invoiceId: invoice.id,
            sequenceId: sequence.id,
            stepNumber: firstStep.stepNumber,
            emailAddress: invoice.customerEmail,
            subject: firstStep.subject,
            content: firstStep.content,
            sentAt: optimalSendTime,
            deliveryStatus: 'QUEUED'
          }
        })

        results.triggered++

      } catch (error) {
        results.failed++
        const errorMsg = `Failed to initiate follow-up for invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        results.errors.push(errorMsg)
        console.error(errorMsg, error)
      }
    }

  } catch (error) {
    const errorMsg = `Failed to detect overdue invoices: ${error instanceof Error ? error.message : 'Unknown error'}`
    results.errors.push(errorMsg)
    console.error(errorMsg, error)
  }

  return results
}

/**
 * Process pending follow-up sequence steps
 */
async function processPendingFollowUpSteps(): Promise<{
  processed: number
  completed: number
  failed: number
  emailsSent: number
  errors: string[]
}> {
  const results = { processed: 0, completed: 0, failed: 0, emailsSent: 0, errors: [] }

  try {
    const emailService = getDefaultEmailService()
    const now = new Date()

    // Find follow-up logs that are ready to be sent
    const pendingFollowUps = await prisma.followUpLog.findMany({
      where: {
        deliveryStatus: 'QUEUED',
        sentAt: {
          lte: now
        }
      },
      include: {
        invoice: {
          include: {
            company: true
          }
        },
        followUpSequence: true
      },
      orderBy: { sentAt: 'asc' },
      take: 100 // Process in batches
    })

    results.processed = pendingFollowUps.length

    for (const followUp of pendingFollowUps) {
      try {
        // Validate UAE business compliance before sending
        const validation = uaeBusinessHours.validateScheduledTime(followUp.sentAt)
        if (!validation.isValid) {
          // Reschedule to next optimal time
          const nextOptimalTime = uaeBusinessHours.getNextAvailableSendTime(new Date(), {
            preferredDays: [2, 3, 4],
            preferredHours: [10, 11],
            avoidPrayerTimes: true,
            respectRamadan: true,
            culturalTone: 'BUSINESS'
          })

          await prisma.followUpLog.update({
            where: { id: followUp.id },
            data: { sentAt: nextOptimalTime }
          })

          continue // Skip this iteration, will be processed next time
        }

        // Send the email
        const emailLogId = await emailService.sendEmail({
          companyId: followUp.invoice.companyId,
          invoiceId: followUp.invoiceId,
          customerId: followUp.invoice.customerId,
          recipientEmail: followUp.emailAddress,
          recipientName: followUp.invoice.customerName,
          subject: followUp.subject,
          content: followUp.content,
          scheduleForBusinessHours: true,
          variables: {
            invoiceNumber: followUp.invoice.number,
            customerName: followUp.invoice.customerName,
            stepNumber: followUp.stepNumber.toString(),
            escalationLevel: 'REMINDER' // Would be derived from step
          }
        })

        // Update follow-up log status
        await prisma.followUpLog.update({
          where: { id: followUp.id },
          data: {
            deliveryStatus: 'SENT',
            awsMessageId: emailLogId
          }
        })

        results.emailsSent++

        // Check if this was the last step in the sequence
        let steps: FollowUpStep[]
        try {
          steps = typeof followUp.followUpSequence.steps === 'string'
            ? JSON.parse(followUp.followUpSequence.steps)
            : followUp.followUpSequence.steps as any
        } catch {
          results.errors.push(`Failed to parse steps for sequence ${followUp.sequenceId}`)
          continue
        }

        const isLastStep = followUp.stepNumber >= steps.length
        if (isLastStep) {
          results.completed++
        } else {
          // Schedule next step
          const nextStep = steps[followUp.stepNumber] // stepNumber is 1-based, array is 0-based
          if (nextStep) {
            const nextSendTime = new Date(followUp.sentAt.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000)
            const optimalNextTime = uaeBusinessHours.getNextAvailableSendTime(nextSendTime, {
              preferredDays: [2, 3, 4],
              preferredHours: [10, 11],
              avoidPrayerTimes: true,
              respectRamadan: true,
              culturalTone: 'BUSINESS'
            })

            await prisma.followUpLog.create({
              data: {
                id: crypto.randomUUID(),
                invoiceId: followUp.invoiceId,
                sequenceId: followUp.sequenceId,
                stepNumber: nextStep.stepNumber,
                emailAddress: followUp.emailAddress,
                subject: nextStep.subject,
                content: nextStep.content,
                sentAt: optimalNextTime,
                deliveryStatus: 'QUEUED'
              }
            })
          }
        }

      } catch (error) {
        results.failed++
        const errorMsg = `Failed to process follow-up ${followUp.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        results.errors.push(errorMsg)
        console.error(errorMsg, error)

        // Mark as failed
        await prisma.followUpLog.update({
          where: { id: followUp.id },
          data: {
            deliveryStatus: 'FAILED'
          }
        }).catch(console.error)
      }
    }

  } catch (error) {
    const errorMsg = `Failed to process pending follow-ups: ${error instanceof Error ? error.message : 'Unknown error'}`
    results.errors.push(errorMsg)
    console.error(errorMsg, error)
  }

  return results
}

/**
 * Apply UAE business compliance and cultural sensitivity rules
 */
async function applyBusinessCompliance(): Promise<{
  businessHourSkips: number
  holidaySkips: number
  prayerTimeSkips: number
  culturalSkips: number
  warnings: string[]
}> {
  const results = { businessHourSkips: 0, holidaySkips: 0, prayerTimeSkips: 0, culturalSkips: 0, warnings: [] }

  try {
    const now = new Date()

    // Find emails scheduled outside business hours
    const missScheduledEmails = await prisma.followUpLog.findMany({
      where: {
        deliveryStatus: 'QUEUED',
        sentAt: {
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) // Next 24 hours
        }
      }
    })

    for (const email of missScheduledEmails) {
      const validation = uaeBusinessHours.validateScheduledTime(email.sentAt)

      if (!validation.isValid) {
        const nextOptimalTime = uaeBusinessHours.getNextAvailableSendTime(email.sentAt, {
          preferredDays: [2, 3, 4],
          preferredHours: [10, 11],
          avoidPrayerTimes: true,
          respectRamadan: true,
          culturalTone: 'BUSINESS'
        })

        await prisma.followUpLog.update({
          where: { id: email.id },
          data: { sentAt: nextOptimalTime }
        })

        // Categorize the type of rescheduling
        if (validation.reasons.includes('Outside business hours')) {
          results.businessHourSkips++
        }
        if (validation.reasons.some(r => r.includes('Holiday'))) {
          results.holidaySkips++
        }
        if (validation.reasons.includes('Conflicts with prayer time')) {
          results.prayerTimeSkips++
        }
        if (validation.reasons.includes('Ramadan period - suboptimal timing')) {
          results.culturalSkips++
        }

        results.warnings.push(`Rescheduled email ${email.id}: ${validation.reasons.join(', ')}`)
      }
    }

  } catch (error) {
    results.warnings.push(`Business compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}

/**
 * Perform maintenance tasks
 */
async function performMaintenance(): Promise<void> {
  try {
    // Clean up old completed follow-up logs (older than 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    await prisma.followUpLog.deleteMany({
      where: {
        deliveryStatus: { in: ['DELIVERED', 'OPENED', 'CLICKED', 'FAILED'] },
        sentAt: {
          lt: ninetyDaysAgo
        }
      }
    })

    // Clean up orphaned follow-up logs (invoices that no longer exist)
    await prisma.$executeRaw`
      DELETE FROM follow_up_logs
      WHERE invoice_id NOT IN (SELECT id FROM invoices)
    `

  } catch (error) {
    console.error('Maintenance failed:', error)
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
    // Check for cron secret in headers
    const cronSecret = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
      return { valid: false, reason: 'Invalid cron secret' }
    }

    // Check for Vercel cron headers
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
 * Determine if we should process follow-ups now
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
      reason: 'UAE holiday - follow-up processing paused',
      nextProcessingTime: nextBusinessDay
    }
  }

  // Check if we're in a prayer time buffer
  if (uaeBusinessHours.isPrayerTime(now)) {
    const nextAvailable = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes later
    return {
      shouldProcess: false,
      reason: 'Prayer time - avoiding email processing',
      nextProcessingTime: nextAvailable
    }
  }

  // All checks passed
  return { shouldProcess: true }
}

/**
 * Log processing activity for monitoring
 */
async function logProcessingActivity(
  metrics: ProcessingMetrics,
  isError: boolean = false
): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: 'system',
        userId: 'cron-job',
        type: 'FOLLOW_UP_PROCESSING',
        description: isError
          ? `Follow-up processing failed after ${metrics.duration}ms`
          : `Processed ${metrics.processed.overdueInvoices} overdue invoices, sent ${metrics.successful.sentEmails} follow-up emails in ${metrics.duration}ms`,
        metadata: {
          startTime: metrics.startTime,
          endTime: metrics.endTime,
          duration: metrics.duration,
          processed: metrics.processed,
          successful: metrics.successful,
          failed: metrics.failed,
          skipped: metrics.skipped,
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