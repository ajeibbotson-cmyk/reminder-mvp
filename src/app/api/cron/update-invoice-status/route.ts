/**
 * Automated Invoice Status Update Cron Job
 * Daily scheduled task to detect and update overdue invoices
 * 
 * Schedule: Daily at 9:00 AM UAE time (Sunday-Thursday)
 * Purpose: Automatically transition SENT invoices to OVERDUE when past due date
 * Features:
 * - UAE business hours compliance
 * - Batch processing for performance
 * - Comprehensive audit logging
 * - Error handling and recovery
 * - Holiday and weekend respect
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invoiceStatusService, BatchStatusChangeResult } from '@/lib/services/invoice-status-service'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { InvoiceStatus } from '@prisma/client'

// Cron job configuration
const CRON_CONFIG = {
  // Security token for cron authentication
  CRON_SECRET: process.env.CRON_SECRET || 'uaepay-cron-secret-2024',
  
  // UAE business hours (Sunday-Thursday, 8 AM-6 PM GST)
  UAE_BUSINESS_HOURS: {
    workingDays: [0, 1, 2, 3, 4], // Sunday=0 to Thursday=4
    startHour: 8,
    endHour: 18
  },
  
  // Processing configuration
  BATCH_SIZE: 50,
  MAX_PROCESSING_TIME: 300000, // 5 minutes max
  GRACE_PERIOD_DAYS: 0, // No grace period for overdue detection
  
  // Notification settings
  ENABLE_CUSTOMER_NOTIFICATIONS: true,
  ENABLE_ADMIN_NOTIFICATIONS: true
}

// UAE holidays (2024-2025) - dates when processing should be skipped
const UAE_HOLIDAYS = [
  // Islamic holidays and UAE national holidays
  '2024-09-15', // Prophet's Birthday
  '2024-12-02', // National Day
  '2024-12-03', // National Day Holiday
  '2025-01-01', // New Year's Day
  '2025-03-29', // Ramadan starts (example)
  // Add more holidays as needed
]

/**
 * POST /api/cron/update-invoice-status
 * Automated cron job to detect and update overdue invoices
 * 
 * Authentication: Requires CRON_SECRET header
 * Schedule: Daily at 9:00 AM UAE time
 * Processing: Batch updates with comprehensive logging
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const processingSummary: {
    companiesProcessed: number
    totalInvoicesChecked: number
    invoicesUpdated: number
    errors: string[]
    executionTime: number
    completedAt: string
  } = {
    companiesProcessed: 0,
    totalInvoicesChecked: 0,
    invoicesUpdated: 0,
    errors: [],
    executionTime: 0,
    completedAt: ''
  }

  try {
    // 1. Authenticate cron request
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '') || 
                      request.headers.get('x-cron-secret')

    if (cronSecret !== CRON_CONFIG.CRON_SECRET) {
      logError('CRON Authentication Failed', new Error('Invalid cron secret'), {
        providedSecret: cronSecret?.substring(0, 10) + '...',
        expectedLength: CRON_CONFIG.CRON_SECRET.length
      })
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // 2. Validate UAE business hours and holidays
    const businessHoursValidation = validateUAEBusinessSchedule()
    if (!businessHoursValidation.canProcess) {
      console.log(`Skipping cron execution: ${businessHoursValidation.reason}`)
      return successResponse({
        skipped: true,
        reason: businessHoursValidation.reason,
        nextScheduledRun: businessHoursValidation.nextRunTime
      }, 'Cron execution skipped - outside business hours or on holiday')
    }

    console.log('Starting automated invoice status update process...')

    // 3. Create system execution log
    const executionLog = await createExecutionLog()

    try {
      // 4. Process all companies in the system
      const companies = await prisma.companies.findMany({
        select: { id: true, name: true },
        where: { deletedAt: null } // Only active companies
      })

      console.log(`Processing ${companies.length} companies...`)

      for (const company of companies) {
        try {
          // Process overdue detection for this company
          const result = await processCompanyOverdueInvoices(company.id, company.name)
          
          processingSummary.companiesProcessed++
          processingSummary.totalInvoicesChecked += result.totalRequested
          processingSummary.invoicesUpdated += result.successCount
          
          if (result.failedCount > 0) {
            processingSummary.errors.push(
              `Company ${company.name}: ${result.failedCount} failures`
            )
          }

          // Log company processing result
          console.log(`Company ${company.name}: ${result.successCount}/${result.totalRequested} invoices updated`)

          // Prevent timeout by checking execution time
          if (Date.now() - startTime > CRON_CONFIG.MAX_PROCESSING_TIME) {
            processingSummary.errors.push('Processing timeout - completed partial execution')
            break
          }

        } catch (error) {
          processingSummary.errors.push(`Company ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          logError(`Company Processing Error: ${company.id}`, error, { companyName: company.name })
        }
      }

      // 5. Update execution log with results
      const executionTime = Date.now() - startTime
      processingSummary.executionTime = executionTime
      processingSummary.completedAt = new Date().toISOString()

      await updateExecutionLog(executionLog.id, processingSummary)

      // 6. Send admin notification if there were significant updates or errors
      if (processingSummary.invoicesUpdated > 0 || processingSummary.errors.length > 0) {
        await sendAdminNotification(processingSummary)
      }

      console.log('Automated invoice status update completed successfully')
      console.log(`Summary: ${processingSummary.invoicesUpdated} invoices updated across ${processingSummary.companiesProcessed} companies`)

      return successResponse({
        executionSummary: processingSummary,
        businessMetrics: {
          companiesProcessed: processingSummary.companiesProcessed,
          invoicesChecked: processingSummary.totalInvoicesChecked,
          invoicesUpdated: processingSummary.invoicesUpdated,
          errorCount: processingSummary.errors.length,
          executionTimeMs: processingSummary.executionTime
        },
        nextScheduledRun: getNextBusinessDayRunTime()
      }, 'Automated invoice status update completed successfully')

    } catch (error) {
      // Update execution log with error
      await updateExecutionLog(executionLog.id, {
        ...processingSummary,
        errors: [...processingSummary.errors, error instanceof Error ? error.message : 'Unknown execution error'],
        executionTime: Date.now() - startTime,
        completedAt: new Date().toISOString()
      })
      throw error
    }

  } catch (error) {
    logError('Cron Job Execution Failed', error, {
      processingTime: Date.now() - startTime,
      summary: processingSummary
    })
    return handleApiError(error)
  }
}

/**
 * GET /api/cron/update-invoice-status
 * Check cron job status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Basic authentication for status check
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    if (cronSecret !== CRON_CONFIG.CRON_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get recent execution logs
    const recentExecutions = await prisma.cronExecutions.findMany({
      where: { jobType: 'invoice_status_update' },
      orderBy: { startTime: 'desc' },
      take: 5
    })

    // Check current business hours status
    const businessHoursValidation = validateUAEBusinessSchedule()

    // Get overdue statistics
    const overdueStats = await getOverdueStatistics()

    return successResponse({
      status: 'operational',
      configuration: {
        batchSize: CRON_CONFIG.BATCH_SIZE,
        maxProcessingTime: CRON_CONFIG.MAX_PROCESSING_TIME,
        gracePeriodDays: CRON_CONFIG.GRACE_PERIOD_DAYS,
        businessHours: CRON_CONFIG.UAE_BUSINESS_HOURS
      },
      businessHours: {
        currentTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }),
        canProcessNow: businessHoursValidation.canProcess,
        reason: businessHoursValidation.reason,
        nextRunTime: businessHoursValidation.nextRunTime
      },
      recentExecutions: recentExecutions.map(exec => ({
        startTime: exec.startTime,
        endTime: exec.endTime,
        status: exec.status,
        companiesProcessed: exec.metadata.companiesProcessed,
        invoicesUpdated: exec.metadata.invoicesUpdated,
        errorCount: exec.metadata.errors?.length || 0
      })),
      overdueStatistics: overdueStats
    }, 'Cron job status retrieved successfully')

  } catch (error) {
    logError('Cron Status Check Failed', error)
    return handleApiError(error)
  }
}

// Helper Functions

/**
 * Validate if cron should run based on UAE business hours and holidays
 */
function validateUAEBusinessSchedule(): {
  canProcess: boolean
  reason: string
  nextRunTime?: string
} {
  const now = new Date()
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const currentDay = dubaiTime.getDay()
  const currentHour = dubaiTime.getHours()
  const currentDate = dubaiTime.toISOString().split('T')[0]

  // Check if it's a UAE holiday
  if (UAE_HOLIDAYS.includes(currentDate)) {
    return {
      canProcess: false,
      reason: 'UAE public holiday - processing suspended',
      nextRunTime: getNextBusinessDayRunTime()
    }
  }

  // Check if it's a working day (Sunday=0 to Thursday=4)
  if (!CRON_CONFIG.UAE_BUSINESS_HOURS.workingDays.includes(currentDay)) {
    return {
      canProcess: false,
      reason: 'Non-working day (Friday/Saturday)',
      nextRunTime: getNextBusinessDayRunTime()
    }
  }

  // Check if it's within business hours
  if (currentHour < CRON_CONFIG.UAE_BUSINESS_HOURS.startHour || 
      currentHour >= CRON_CONFIG.UAE_BUSINESS_HOURS.endHour) {
    return {
      canProcess: false,
      reason: 'Outside business hours (8 AM - 6 PM GST)',
      nextRunTime: getNextBusinessDayRunTime()
    }
  }

  return {
    canProcess: true,
    reason: 'Within UAE business hours - processing approved'
  }
}

/**
 * Calculate next business day run time
 */
function getNextBusinessDayRunTime(): string {
  const now = new Date()
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const nextRun = new Date(dubaiTime)

  // Set to 9:00 AM
  nextRun.setHours(9, 0, 0, 0)

  // If it's past 9 AM today or not a working day, move to next working day
  if (dubaiTime.getHours() >= 9 || !CRON_CONFIG.UAE_BUSINESS_HOURS.workingDays.includes(dubaiTime.getDay())) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  // Skip to next working day if needed
  while (!CRON_CONFIG.UAE_BUSINESS_HOURS.workingDays.includes(nextRun.getDay())) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  // Check for holidays
  let nextRunDate = nextRun.toISOString().split('T')[0]
  while (UAE_HOLIDAYS.includes(nextRunDate)) {
    nextRun.setDate(nextRun.getDate() + 1)
    while (!CRON_CONFIG.UAE_BUSINESS_HOURS.workingDays.includes(nextRun.getDay())) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
    nextRunDate = nextRun.toISOString().split('T')[0]
  }

  return nextRun.toISOString()
}

/**
 * Process overdue invoices for a specific company
 */
async function processCompanyOverdueInvoices(companyId: string, companyName: string): Promise<BatchStatusChangeResult> {
  console.log(`Processing overdue invoices for company: ${companyName}`)

  // Use the invoice status service for overdue detection
  const result = await invoiceStatusService.detectAndUpdateOverdueInvoices(companyId, {
    gracePeriodDays: CRON_CONFIG.GRACE_PERIOD_DAYS,
    respectBusinessHours: true,
    respectHolidays: true,
    batchSize: CRON_CONFIG.BATCH_SIZE,
    enableNotifications: CRON_CONFIG.ENABLE_CUSTOMER_NOTIFICATIONS,
    dryRun: false
  })

  // Log detailed results for this company
  if (result.successCount > 0) {
    console.log(`${companyName}: Updated ${result.successCount} invoices to OVERDUE status`)
    console.log(`${companyName}: Total amount affected: ${result.businessSummary.formattedTotalAmount}`)
  }

  if (result.failedCount > 0) {
    console.warn(`${companyName}: Failed to update ${result.failedCount} invoices`)
    result.results.filter(r => !r.success).forEach(failure => {
      console.warn(`  - Invoice ${failure.invoiceNumber}: ${failure.error}`)
    })
  }

  return result
}

/**
 * Create execution log entry
 */
async function createExecutionLog() {
  return await prisma.cronExecutions.create({
    data: {
      id: crypto.randomUUID(),
      jobType: 'invoice_status_update',
      startTime: new Date(),
      status: 'RUNNING',
      metadata: {
        batchSize: CRON_CONFIG.BATCH_SIZE,
        gracePeriodDays: CRON_CONFIG.GRACE_PERIOD_DAYS,
        uaeBusinessHours: CRON_CONFIG.UAE_BUSINESS_HOURS
      }
    }
  })
}

/**
 * Update execution log with results
 */
async function updateExecutionLog(executionId: string, summary: any) {
  await prisma.cronExecutions.update({
    where: { id: executionId },
    data: {
      endTime: new Date(),
      status: summary.errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      metadata: {
        ...summary,
        batchSize: CRON_CONFIG.BATCH_SIZE,
        gracePeriodDays: CRON_CONFIG.GRACE_PERIOD_DAYS
      }
    }
  })
}

/**
 * Send admin notification for significant events
 */
async function sendAdminNotification(summary: any) {
  if (!CRON_CONFIG.ENABLE_ADMIN_NOTIFICATIONS) return

  try {
    // Create admin notification record
    await prisma.adminNotifications.create({
      data: {
        id: crypto.randomUUID(),
        type: 'CRON_EXECUTION_SUMMARY',
        title: 'Daily Invoice Status Update Completed',
        message: `Processed ${summary.companiesProcessed} companies, updated ${summary.invoicesUpdated} invoices`,
        metadata: summary,
        priority: summary.errors.length > 0 ? 'HIGH' : 'NORMAL',
        channels: ['EMAIL', 'DASHBOARD']
      }
    })

    console.log('Admin notification created for cron execution summary')
  } catch (error) {
    console.error('Failed to create admin notification:', error)
  }
}

/**
 * Get system-wide overdue statistics
 */
async function getOverdueStatistics() {
  const stats = await prisma.invoices.aggregate({
    where: {
      status: InvoiceStatus.SENT,
      dueDate: { lt: new Date() }
    },
    _count: { id: true },
    _sum: { totalAmount: true, amount: true }
  })

  const totalOverdueInvoices = await prisma.invoices.count({
    where: { status: InvoiceStatus.OVERDUE }
  })

  return {
    invoicesPastDue: stats._count.id,
    totalOverdueInvoices,
    estimatedOverdueAmount: stats._sum.totalAmount || stats._sum.amount || 0
  }
}

// Export configuration for external monitoring
export const cronConfig = {
  schedule: 'Daily at 9:00 AM UAE time (Sunday-Thursday)',
  maxExecutionTime: CRON_CONFIG.MAX_PROCESSING_TIME,
  batchSize: CRON_CONFIG.BATCH_SIZE,
  gracePeriod: CRON_CONFIG.GRACE_PERIOD_DAYS,
  businessHours: CRON_CONFIG.UAE_BUSINESS_HOURS
}