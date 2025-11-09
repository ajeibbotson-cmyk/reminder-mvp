/**
 * Individual Consolidation Management API
 * GET /api/consolidation/[id] - Get specific consolidation details
 * PUT /api/consolidation/[id] - Update consolidation
 * DELETE /api/consolidation/[id] - Cancel/delete consolidation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ConsolidationApiResponse } from '@/lib/types/consolidation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // TODO: Implement proper consolidation model
    // Get consolidation with related data
    /*
    const consolidation = await prisma.customerConsolidatedReminder.findFirst({
      where: {
        id,
        companyId: session.user.companyId // Ensure company isolation
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            businessName: true,
            businessType: true,
            preferredLanguage: true,
            consolidationPreference: true,
            maxConsolidationAmount: true,
            preferredContactInterval: true
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            trn: true
          }
        },
        emailTemplate: {
          select: {
            id: true,
            name: true,
            templateType: true,
            supportsConsolidation: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        emailLogs: {
          where: {
            consolidatedReminderId: id
          },
          select: {
            id: true,
            recipientEmail: true,
            subject: true,
            deliveryStatus: true,
            sentAt: true,
            deliveredAt: true,
            openedAt: true,
            clickedAt: true,
            awsMessageId: true,
            invoiceCount: true,
            consolidationSavings: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    */

    // Return mock data for now to stop server errors
    const consolidation = null

    if (!consolidation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Consolidation not found',
          code: 'CONSOLIDATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 404 }
      )
    }

    // Get related invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: consolidation.invoiceIds },
        companyId: session.user.companyId
      },
      select: {
        id: true,
        number: true,
        amount: true,
        totalAmount: true,
        currency: true,
        dueDate: true,
        status: true,
        description: true,
        customerName: true,
        customerEmail: true,
        createdAt: true
      },
      orderBy: { dueDate: 'asc' }
    })

    // Calculate additional metrics
    const totalAmount = Number(consolidation.totalAmount)
    const oldestInvoice = invoices.reduce((oldest, inv) =>
      inv.dueDate < oldest.dueDate ? inv : oldest
    )
    const oldestDays = Math.max(0, Math.ceil(
      (Date.now() - oldestInvoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    ))

    const detailedConsolidation = {
      // Basic consolidation data
      id: consolidation.id,
      customerId: consolidation.customerId,
      companyId: consolidation.companyId,
      invoiceIds: consolidation.invoiceIds,
      totalAmount,
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
      businessRulesApplied: consolidation.businessRulesApplied,
      culturalComplianceFlags: consolidation.culturalComplianceFlags,

      // Response tracking
      emailOpenedAt: consolidation.emailOpenedAt,
      emailClickedAt: consolidation.emailClickedAt,
      customerRespondedAt: consolidation.customerRespondedAt,
      paymentReceivedAt: consolidation.paymentReceivedAt,
      awsMessageId: consolidation.awsMessageId,

      // Timestamps
      createdAt: consolidation.createdAt,
      updatedAt: consolidation.updatedAt,
      createdBy: consolidation.createdBy,

      // Related data
      customer: consolidation.customer,
      company: consolidation.company,
      emailTemplate: consolidation.emailTemplate,
      creator: consolidation.creator,
      emailLogs: consolidation.emailLogs,
      invoices,

      // Calculated metrics
      calculated: {
        oldestInvoiceDays: oldestDays,
        averageInvoiceAmount: totalAmount / consolidation.invoiceCount,
        emailsSaved: consolidation.invoiceCount - 1,
        daysUntilNextContact: consolidation.nextEligibleContact
          ? Math.max(0, Math.ceil((consolidation.nextEligibleContact.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0,
        canContactNow: !consolidation.nextEligibleContact || consolidation.nextEligibleContact <= new Date(),
        totalDeliveryTime: consolidation.sentAt && consolidation.createdAt
          ? Math.round((consolidation.sentAt.getTime() - consolidation.createdAt.getTime()) / (1000 * 60))
          : null, // minutes
        responseRate: consolidation.emailLogs.length > 0
          ? (consolidation.emailLogs.filter(log => log.openedAt).length / consolidation.emailLogs.length) * 100
          : 0
      }
    }

    const response: ConsolidationApiResponse<typeof detailedConsolidation> = {
      success: true,
      data: detailedConsolidation,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Get consolidation error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to retrieve consolidation details',
      code: 'CONSOLIDATION_RETRIEVAL_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params
    const updates = await request.json()

    // Validate consolidation exists and belongs to company
    const existingConsolidation = await prisma.customerConsolidatedReminder.findFirst({
      where: {
        id,
        companyId: session.user.companyId
      }
    })

    if (!existingConsolidation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Consolidation not found',
          code: 'CONSOLIDATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 404 }
      )
    }

    // Prevent updates if already sent
    if (existingConsolidation.sentAt && updates.scheduledFor) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot reschedule consolidation that has already been sent',
          code: 'ALREADY_SENT',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 400 }
      )
    }

    // Build update data with validation
    const updateData: any = {
      updatedAt: new Date()
    }

    if (updates.scheduledFor) {
      updateData.scheduledFor = new Date(updates.scheduledFor)

      // Validate future date
      if (updateData.scheduledFor <= new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Scheduled time must be in the future',
            code: 'INVALID_SCHEDULE_TIME',
            timestamp: new Date().toISOString()
          } as ConsolidationApiResponse,
          { status: 400 }
        )
      }
    }

    if (updates.escalationLevel && ['POLITE', 'FIRM', 'URGENT', 'FINAL'].includes(updates.escalationLevel)) {
      updateData.escalationLevel = updates.escalationLevel
    }

    if (updates.templateId) {
      // Validate template exists and supports consolidation
      const template = await prisma.emailTemplate.findFirst({
        where: {
          id: updates.templateId,
          companyId: session.user.companyId,
          isActive: true,
          supportsConsolidation: true
        }
      })

      if (!template) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid template or template does not support consolidation',
            code: 'INVALID_TEMPLATE',
            timestamp: new Date().toISOString()
          } as ConsolidationApiResponse,
          { status: 400 }
        )
      }

      updateData.templateId = updates.templateId
    }

    if (updates.priorityScore !== undefined) {
      const score = Number(updates.priorityScore)
      if (score >= 0 && score <= 100) {
        updateData.priorityScore = score
      }
    }

    if (updates.deliveryStatus && ['QUEUED', 'SENT', 'DELIVERED', 'FAILED'].includes(updates.deliveryStatus)) {
      updateData.deliveryStatus = updates.deliveryStatus
    }

    // Update the consolidation
    const updatedConsolidation = await prisma.customerConsolidatedReminder.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Log the update activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        userId: session.user.id,
        type: 'CONSOLIDATION_UPDATED',
        description: `Consolidation ${id} updated for customer ${updatedConsolidation.customer.name}`,
        metadata: {
          consolidationId: id,
          customerId: updatedConsolidation.customerId,
          updates: Object.keys(updateData),
          previousValues: {
            scheduledFor: existingConsolidation.scheduledFor,
            escalationLevel: existingConsolidation.escalationLevel,
            templateId: existingConsolidation.templateId,
            deliveryStatus: existingConsolidation.deliveryStatus
          }
        }
      }
    })

    const response: ConsolidationApiResponse<typeof updatedConsolidation> = {
      success: true,
      data: updatedConsolidation,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Update consolidation error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to update consolidation',
      code: 'CONSOLIDATION_UPDATE_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Get consolidation details before deletion
    const consolidation = await prisma.customerConsolidatedReminder.findFirst({
      where: {
        id,
        companyId: session.user.companyId
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!consolidation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Consolidation not found',
          code: 'CONSOLIDATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 404 }
      )
    }

    // Prevent deletion if already sent
    if (consolidation.sentAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete consolidation that has already been sent',
          code: 'ALREADY_SENT',
          timestamp: new Date().toISOString()
        } as ConsolidationApiResponse,
        { status: 400 }
      )
    }

    // Cancel any scheduled emails
    const scheduledEmails = await prisma.emailLog.findMany({
      where: {
        consolidatedReminderId: id,
        deliveryStatus: 'QUEUED'
      }
    })

    for (const email of scheduledEmails) {
      await prisma.emailLog.update({
        where: { id: email.id },
        data: { deliveryStatus: 'CANCELLED' }
      })
    }

    // Delete the consolidation
    await prisma.customerConsolidatedReminder.delete({
      where: { id }
    })

    // Log the deletion activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        userId: session.user.id,
        type: 'CONSOLIDATION_DELETED',
        description: `Consolidation ${id} deleted for customer ${consolidation.customer.name}`,
        metadata: {
          consolidationId: id,
          customerId: consolidation.customerId,
          invoiceCount: consolidation.invoiceCount,
          totalAmount: Number(consolidation.totalAmount),
          deliveryStatus: consolidation.deliveryStatus,
          emailsCancelled: scheduledEmails.length
        }
      }
    })

    const response: ConsolidationApiResponse<{ deleted: boolean; emailsCancelled: number }> = {
      success: true,
      data: {
        deleted: true,
        emailsCancelled: scheduledEmails.length
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Delete consolidation error:', error)

    const errorResponse: ConsolidationApiResponse = {
      success: false,
      error: 'Failed to delete consolidation',
      code: 'CONSOLIDATION_DELETE_FAILED',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}