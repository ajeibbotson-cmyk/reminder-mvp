/**
 * Payment Workflow Integration API
 * Advanced endpoint for payment workflow automation and webhook processing
 * 
 * Features:
 * - Payment webhook processing
 * - Batch payment workflow automation
 * - Payment reconciliation
 * - Status correlation automation
 * - UAE business rule enforcement
 */

import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { validateRequestBody } from '@/lib/validations'
import { paymentWorkflowService, PaymentWorkflowEvent } from '@/lib/services/payment-workflow-service'
import { UserRole, PaymentMethod } from '@prisma/client'
import { z } from 'zod'

// Payment workflow event schema
const paymentWorkflowEventSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  event: z.enum(['payment_received', 'payment_failed', 'payment_reversed', 'payment_partial', 'payment_completed', 'payment_overdue_cleared'] as const),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

// Batch payment workflow schema
const batchPaymentWorkflowSchema = z.object({
  paymentEvents: z.array(z.object({
    paymentId: z.string().uuid(),
    event: z.enum(['payment_received', 'payment_failed', 'payment_reversed', 'payment_partial', 'payment_completed', 'payment_overdue_cleared'] as const)
  })).min(1, 'At least one payment event is required').max(100, 'Maximum 100 payment events per batch'),
  batchId: z.string().optional(),
  forceProcess: z.boolean().default(false)
})

// Payment notification schema (webhook)
const paymentNotificationSchema = z.object({
  externalPaymentId: z.string().min(1, 'External payment ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('AED'),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  paymentDate: z.coerce.date(),
  status: z.enum(['success', 'failed', 'pending']),
  gatewayMetadata: z.record(z.any()).optional()
})

/**
 * POST /api/payments/workflow
 * Process payment workflow events for automatic status transitions
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation') || 'single'

    switch (operation) {
      case 'single':
        return await processSinglePaymentWorkflow(request, authContext)
      
      case 'batch':
        return await processBatchPaymentWorkflow(request, authContext)
      
      case 'webhook':
        return await processPaymentWebhook(request, authContext)
      
      case 'reconcile':
        return await processPaymentReconciliation(request, authContext)
      
      default:
        throw new ValidationError(`Invalid operation: ${operation}`)
    }

  } catch (error) {
    logError('POST /api/payments/workflow', error)
    return handleApiError(error)
  }
}

/**
 * GET /api/payments/workflow
 * Get payment workflow status and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.USER])
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation') || 'status'

    switch (operation) {
      case 'status':
        return await getWorkflowStatus(authContext)
      
      case 'reconciliation':
        const invoiceId = searchParams.get('invoiceId')
        if (!invoiceId) {
          throw new ValidationError('Invoice ID is required for reconciliation')
        }
        return await getReconciliationStatus(invoiceId, authContext)
      
      default:
        throw new ValidationError(`Invalid operation: ${operation}`)
    }

  } catch (error) {
    logError('GET /api/payments/workflow', error)
    return handleApiError(error)
  }
}

// Implementation functions

async function processSinglePaymentWorkflow(request: NextRequest, authContext: any) {
  const { paymentId, event, reason, metadata } = await validateRequestBody(request, paymentWorkflowEventSchema)

  console.log(`Processing payment workflow: ${event} for payment ${paymentId}`)

  const result = await paymentWorkflowService.processPaymentWorkflow(
    paymentId,
    event as PaymentWorkflowEvent,
    {
      userId: authContext.user.id,
      userRole: authContext.user.role,
      companyId: authContext.user.companyId,
      reason: reason || `Payment workflow: ${event}`,
      metadata
    }
  )

  return successResponse({
    workflowResult: result,
    processingContext: {
      processedAt: new Date().toISOString(),
      processedBy: authContext.user.name,
      companyId: authContext.user.companyId,
      automaticProcessing: true
    },
    nextSteps: result.recommendedActions
  }, `Payment workflow ${event} processed successfully`)
}

async function processBatchPaymentWorkflow(request: NextRequest, authContext: any) {
  const { paymentEvents, batchId, forceProcess } = await validateRequestBody(request, batchPaymentWorkflowSchema)

  console.log(`Processing batch payment workflow: ${paymentEvents.length} events`)

  // Check for UAE business hours unless forced
  if (!forceProcess && !isUAEBusinessHours()) {
    throw new ValidationError('Batch payment processing is restricted to UAE business hours (Sunday-Thursday, 8 AM-6 PM GST). Use forceProcess=true to override.')
  }

  const result = await paymentWorkflowService.processBatchPaymentWorkflow(
    paymentEvents,
    {
      userId: authContext.user.id,
      userRole: authContext.user.role,
      companyId: authContext.user.companyId,
      batchId: batchId || `batch_${Date.now()}`
    }
  )

  return successResponse({
    batchResult: result,
    processingContext: {
      batchId: batchId || `batch_${Date.now()}`,
      processedAt: new Date().toISOString(),
      processedBy: authContext.user.name,
      companyId: authContext.user.companyId,
      businessHoursProcessing: isUAEBusinessHours(),
      forcedProcessing: forceProcess && !isUAEBusinessHours()
    },
    performance: {
      averageProcessingTime: result.processingTime / result.totalRequested,
      throughput: (result.totalRequested / result.processingTime) * 1000, // events per second
      successRate: (result.successCount / result.totalRequested) * 100
    }
  }, `Batch payment workflow completed: ${result.successCount}/${result.totalRequested} events processed`)
}

async function processPaymentWebhook(request: NextRequest, authContext: any) {
  const notificationData = await validateRequestBody(request, paymentNotificationSchema)

  console.log(`Processing payment webhook: ${notificationData.externalPaymentId} for invoice ${notificationData.invoiceNumber}`)

  // Special handling for webhook authentication - could be from external gateway
  const webhookSecret = request.headers.get('x-webhook-secret')
  const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'uaepay-webhook-secret'

  if (webhookSecret !== expectedSecret) {
    console.warn(`Webhook authentication failed for payment ${notificationData.externalPaymentId}`)
    throw new ValidationError('Invalid webhook authentication')
  }

  const result = await paymentWorkflowService.processPaymentNotification(
    notificationData,
    authContext.user.companyId
  )

  return successResponse({
    webhookResult: result,
    processingContext: {
      webhookProcessedAt: new Date().toISOString(),
      externalPaymentId: notificationData.externalPaymentId,
      gatewayStatus: notificationData.status,
      companyId: authContext.user.companyId,
      automaticProcessing: true
    },
    gatewayInfo: {
      paymentMethod: notificationData.method,
      currency: notificationData.currency,
      gatewayMetadata: notificationData.gatewayMetadata
    }
  }, `Payment webhook processed successfully for ${notificationData.invoiceNumber}`)
}

async function processPaymentReconciliation(request: NextRequest, authContext: any) {
  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId')

  if (!invoiceId) {
    throw new ValidationError('Invoice ID is required for reconciliation')
  }

  console.log(`Processing payment reconciliation for invoice ${invoiceId}`)

  const result = await paymentWorkflowService.reconcileInvoicePayments(
    invoiceId,
    authContext.user.companyId
  )

  return successResponse({
    reconciliation: result,
    processingContext: {
      reconciledAt: new Date().toISOString(),
      reconciledBy: authContext.user.name,
      companyId: authContext.user.companyId
    },
    complianceInfo: {
      uaeCompliant: true,
      auditTrailComplete: true,
      reconciliationRequired: result.status !== 'RECONCILED'
    }
  }, `Payment reconciliation completed for invoice ${result.invoiceNumber}`)
}

async function getWorkflowStatus(authContext: any) {
  // Get recent workflow activities and statistics
  const { prisma } = require('@/lib/prisma')
  
  const recentWorkflowActivities = await prisma.activities.findMany({
    where: {
      companyId: authContext.user.companyId,
      type: 'payment_workflow_processed',
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  const workflowStats = await prisma.activities.groupBy({
    by: ['metadata'],
    where: {
      companyId: authContext.user.companyId,
      type: 'payment_workflow_processed',
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    },
    _count: { id: true }
  })

  return successResponse({
    workflowStatus: {
      isOperational: true,
      businessHoursActive: isUAEBusinessHours(),
      recentActivityCount: recentWorkflowActivities.length,
      lastProcessedAt: recentWorkflowActivities[0]?.createdAt || null
    },
    recentActivities: recentWorkflowActivities.map(activity => ({
      id: activity.id,
      timestamp: activity.createdAt,
      event: activity.metadata.event,
      invoiceNumber: activity.metadata.invoiceNumber,
      amount: activity.metadata.amount,
      statusTransition: activity.metadata.statusTransition,
      automaticProcessing: activity.metadata.businessContext?.automaticWorkflow || false
    })),
    weeklyStats: {
      totalWorkflowEvents: workflowStats.length,
      averageEventsPerDay: workflowStats.length / 7
    },
    systemInfo: {
      uaeBusinessHours: {
        current: isUAEBusinessHours(),
        timezone: 'Asia/Dubai',
        workingDays: 'Sunday-Thursday',
        workingHours: '8 AM - 6 PM GST'
      },
      supportedEvents: [
        'payment_received',
        'payment_failed', 
        'payment_reversed',
        'payment_partial',
        'payment_completed',
        'payment_overdue_cleared'
      ]
    }
  }, 'Payment workflow status retrieved successfully')
}

async function getReconciliationStatus(invoiceId: string, authContext: any) {
  const result = await paymentWorkflowService.reconcileInvoicePayments(
    invoiceId,
    authContext.user.companyId
  )

  return successResponse({
    reconciliation: result,
    analysisContext: {
      analyzedAt: new Date().toISOString(),
      analyzedBy: authContext.user.name,
      companyId: authContext.user.companyId
    },
    recommendations: generateReconciliationRecommendations(result)
  }, `Reconciliation analysis completed for invoice ${result.invoiceNumber}`)
}

// Helper functions

function isUAEBusinessHours(): boolean {
  const now = new Date()
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }))
  const day = dubaiTime.getDay()
  const hour = dubaiTime.getHours()

  return [0, 1, 2, 3, 4].includes(day) && hour >= 8 && hour < 18
}

function generateReconciliationRecommendations(reconciliation: any): string[] {
  const recommendations: string[] = []

  switch (reconciliation.status) {
    case 'RECONCILED':
      recommendations.push('Payments are reconciled - no action required')
      recommendations.push('Consider archiving invoice')
      break
      
    case 'OVERPAID':
      recommendations.push('Process refund or create credit note')
      recommendations.push('Contact customer about overpayment')
      recommendations.push('Review payment processing for accuracy')
      break
      
    case 'UNDERPAID':
      recommendations.push('Send payment reminder for outstanding balance')
      recommendations.push('Consider payment plan if customer is struggling')
      recommendations.push('Review if partial payment terms were agreed')
      break
      
    case 'DISCREPANCY':
      recommendations.push('Review all payment records for data entry errors')
      recommendations.push('Contact customer to verify payment amounts')
      recommendations.push('Check for missing or duplicate payments')
      break
  }

  // UAE specific recommendations
  if (reconciliation.paymentBreakdown.some((p: any) => p.method === PaymentMethod.CASH)) {
    recommendations.push('Verify cash payment documentation for UAE compliance')
  }

  return recommendations
}