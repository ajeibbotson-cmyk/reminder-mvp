import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'
import { consolidatedEmailService } from '@/lib/services/consolidated-email-service'
import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import { enhancedEmailSchedulingService } from '@/lib/services/enhanced-email-scheduling-service'

/**
 * POST /api/consolidation/email - Create and send consolidated email
 * Creates consolidated email for multiple invoices with advanced scheduling and compliance
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const body = await request.json()

    // Validate required fields
    const {
      customerId,
      invoiceIds,
      templateId,
      escalationLevel = 'POLITE',
      scheduledFor,
      language = 'en',
      includePdfAttachments = true,
      includeIndividualInvoices = false,
      includeSummaryPdf = true,
      customMessage,
      urgencyLevel = 'medium',
      respectBusinessHours = true,
      avoidPrayerTimes = true,
      avoidHolidays = true
    } = body

    // Validation
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 invoice IDs are required for consolidation' },
        { status: 400 }
      )
    }

    if (invoiceIds.length > 25) {
      return NextResponse.json(
        { error: 'Maximum 25 invoices can be consolidated in a single email' },
        { status: 400 }
      )
    }

    // Verify customer belongs to company
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId: authContext.user.companyId
      }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or access denied' },
        { status: 404 }
      )
    }

    // Verify invoices belong to customer and company
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        customerEmail: customer.email,
        companyId: authContext.user.companyId,
        status: { in: ['SENT', 'OVERDUE'] },
        isActive: true
      }
    })

    if (invoices.length !== invoiceIds.length) {
      return NextResponse.json(
        { error: 'Some invoices not found or invalid for consolidation' },
        { status: 400 }
      )
    }

    // Check customer consolidation preferences
    if (customer.consolidationPreference === 'DISABLED') {
      return NextResponse.json(
        { error: 'Customer has disabled consolidation emails' },
        { status: 400 }
      )
    }

    // Calculate optimal scheduling time if not provided
    let optimalScheduledFor = scheduledFor ? new Date(scheduledFor) : undefined

    if (!optimalScheduledFor) {
      const schedulingResult = await enhancedEmailSchedulingService.getOptimalSendTime(
        customerId,
        {
          respectBusinessHours,
          avoidPrayerTimes,
          avoidHolidays,
          urgencyLevel: urgencyLevel as any,
          consolidationBatch: true,
          preferredTimeSlot: 'any'
        }
      )
      optimalScheduledFor = schedulingResult.scheduledFor
    }

    // Prepare consolidated email request
    const emailRequest = {
      customerId,
      invoiceIds,
      templateId,
      escalationLevel: escalationLevel as any,
      scheduledFor: optimalScheduledFor,
      language: language as 'en' | 'ar',
      includePdfAttachments,
      customMessage
    }

    // Create consolidated email
    const result = await consolidatedEmailService.createConsolidatedEmail(emailRequest)

    // Log activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: 'consolidated_email_created',
        description: `Created consolidated email for ${customer.name} with ${invoiceIds.length} invoices`,
        metadata: {
          consolidationId: result.consolidationId,
          customerId,
          invoiceIds,
          invoiceCount: invoiceIds.length,
          totalAmount: result.totalAmount,
          templateId,
          scheduledFor: optimalScheduledFor,
          language,
          includePdfAttachments
        }
      }
    })

    return successResponse({
      ...result,
      scheduling: {
        optimalTime: optimalScheduledFor,
        businessRulesApplied: true,
        culturalComplianceApplied: true
      }
    }, 'Consolidated email created successfully')

  } catch (error) {
    logError('POST /api/consolidation/email', error, {
      userId: request.headers.get('user-id')
    })
    return handleApiError(error)
  }
}

/**
 * GET /api/consolidation/email - Get consolidated email history and status
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams

    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {
      companyId: authContext.user.companyId
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (status) {
      where.deliveryStatus = status
    }

    // Get consolidated emails with related data
    const [consolidatedEmails, totalCount] = await Promise.all([
      prisma.customerConsolidatedReminder.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              businessName: true
            }
          },
          emailTemplate: {
            select: {
              id: true,
              name: true,
              templateType: true
            }
          },
          emailLogs: {
            select: {
              id: true,
              deliveryStatus: true,
              sentAt: true,
              deliveredAt: true,
              openedAt: true,
              clickedAt: true,
              bouncedAt: true,
              awsMessageId: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder as any
        },
        skip: offset,
        take: limit
      }),
      prisma.customerConsolidatedReminder.count({ where })
    ])

    // Enrich with additional data
    const enrichedEmails = await Promise.all(
      consolidatedEmails.map(async (email) => {
        // Get invoice details
        const invoices = await prisma.invoice.findMany({
          where: {
            id: { in: email.invoiceIds }
          },
          select: {
            id: true,
            number: true,
            amount: true,
            totalAmount: true,
            currency: true,
            dueDate: true,
            status: true
          }
        })

        // Calculate metrics
        const totalInvoiceAmount = invoices.reduce((sum, inv) =>
          sum + Number(inv.totalAmount || inv.amount), 0
        )

        const oldestInvoiceDays = Math.max(...invoices.map(inv =>
          Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        ))

        // Get delivery metrics
        const emailLog = email.emailLogs[0]
        const deliveryMetrics = emailLog ? {
          delivered: !!emailLog.deliveredAt,
          opened: !!emailLog.openedAt,
          clicked: !!emailLog.clickedAt,
          bounced: !!emailLog.bouncedAt,
          deliveryTime: emailLog.deliveredAt ?
            Math.floor((emailLog.deliveredAt.getTime() - emailLog.sentAt!.getTime()) / 1000) : null,
          awsMessageId: emailLog.awsMessageId
        } : null

        return {
          id: email.id,
          customerId: email.customerId,
          customer: email.customer,
          invoiceCount: email.invoiceCount,
          invoices: invoices.map(inv => ({
            id: inv.id,
            number: inv.number,
            amount: Number(inv.totalAmount || inv.amount),
            currency: inv.currency,
            dueDate: inv.dueDate,
            status: inv.status,
            daysOverdue: Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          })),
          totalAmount: Number(email.totalAmount),
          calculatedTotal: totalInvoiceAmount,
          currency: email.currency,
          reminderType: email.reminderType,
          escalationLevel: email.escalationLevel,
          template: email.emailTemplate,
          scheduledFor: email.scheduledFor,
          sentAt: email.sentAt,
          deliveryStatus: email.deliveryStatus,
          priorityScore: email.priorityScore,
          consolidationReason: email.consolidationReason,
          oldestInvoiceDays,
          deliveryMetrics,
          businessRules: email.businessRulesApplied,
          culturalCompliance: email.culturalComplianceFlags,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt
        }
      })
    )

    // Calculate summary statistics
    const summary = {
      total: totalCount,
      byStatus: {
        scheduled: consolidatedEmails.filter(e => e.deliveryStatus === 'SCHEDULED').length,
        sent: consolidatedEmails.filter(e => e.deliveryStatus === 'SENT').length,
        delivered: consolidatedEmails.filter(e => e.deliveryStatus === 'DELIVERED').length,
        failed: consolidatedEmails.filter(e => e.deliveryStatus === 'FAILED').length
      },
      byEscalation: {
        polite: consolidatedEmails.filter(e => e.escalationLevel === 'POLITE').length,
        firm: consolidatedEmails.filter(e => e.escalationLevel === 'FIRM').length,
        urgent: consolidatedEmails.filter(e => e.escalationLevel === 'URGENT').length,
        final: consolidatedEmails.filter(e => e.escalationLevel === 'FINAL').length
      },
      totalInvoicesConsolidated: consolidatedEmails.reduce((sum, e) => sum + e.invoiceCount, 0),
      totalAmountConsolidated: consolidatedEmails.reduce((sum, e) => sum + Number(e.totalAmount), 0),
      averageInvoicesPerEmail: consolidatedEmails.length > 0 ?
        consolidatedEmails.reduce((sum, e) => sum + e.invoiceCount, 0) / consolidatedEmails.length : 0
    }

    return successResponse({
      consolidatedEmails: enrichedEmails,
      summary,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + consolidatedEmails.length < totalCount
      }
    }, 'Consolidated emails retrieved successfully')

  } catch (error) {
    logError('GET /api/consolidation/email', error)
    return handleApiError(error)
  }
}