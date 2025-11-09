import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { 
  emailDeliveryFilterSchema,
  sendEmailSchema,
  validateRequestBody,
  validateQueryParams
} from '@/lib/validations'
import { getDefaultEmailService } from '@/lib/email-service'
import { UserRole } from '@prisma/client'

// GET /api/email/delivery - Get email delivery logs with filters
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const filters = validateQueryParams(searchParams, emailDeliveryFilterSchema)
    
    // Ensure user can only access their company's email logs
    if (filters.companyId !== authContext.user.companyId) {
      filters.companyId = authContext.user.companyId
    }

    const skip = (filters.page - 1) * filters.limit

    // Build where clause
    const where: Record<string, any> = {
      companyId: filters.companyId
    }

    if (filters.templateId) {
      where.templateId = filters.templateId
    }

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId
    }

    if (filters.customerId) {
      where.customerId = filters.customerId
    }

    if (filters.recipientEmail) {
      where.recipientEmail = { contains: filters.recipientEmail, mode: 'insensitive' }
    }

    if (filters.deliveryStatus) {
      where.deliveryStatus = filters.deliveryStatus
    }

    if (filters.language) {
      where.language = filters.language
    }

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: filters.startDate,
        lte: filters.endDate
      }
    } else if (filters.startDate) {
      where.createdAt = { gte: filters.startDate }
    } else if (filters.endDate) {
      where.createdAt = { lte: filters.endDate }
    }

    // Execute queries in parallel
    const [emailLogs, totalCount] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: {
          emailTemplates: {
            select: { id: true, name: true, templateType: true }
          },
          invoices: {
            select: { id: true, number: true, customerName: true }
          },
          customer: {
            select: { id: true, name: true, email: true }
          },
          followUpLogs: {
            select: { id: true, stepNumber: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit
      }),
      prisma.emailLog.count({ where })
    ])

    // Calculate delivery metrics for current page
    const metrics = {
      total: emailLogs.length,
      queued: emailLogs.filter(log => log.deliveryStatus === 'QUEUED').length,
      sent: emailLogs.filter(log => log.deliveryStatus === 'SENT').length,
      delivered: emailLogs.filter(log => log.deliveryStatus === 'DELIVERED').length,
      opened: emailLogs.filter(log => log.openedAt !== null).length,
      clicked: emailLogs.filter(log => log.clickedAt !== null).length,
      bounced: emailLogs.filter(log => log.deliveryStatus === 'BOUNCED').length,
      complained: emailLogs.filter(log => log.deliveryStatus === 'COMPLAINED').length,
      failed: emailLogs.filter(log => log.deliveryStatus === 'FAILED').length
    }

    return successResponse({
      emailLogs,
      totalCount,
      page: filters.page,
      limit: filters.limit,
      hasMore: skip + emailLogs.length < totalCount,
      metrics,
      filters: {
        templateId: filters.templateId,
        invoiceId: filters.invoiceId,
        customerId: filters.customerId,
        deliveryStatus: filters.deliveryStatus,
        language: filters.language,
        dateRange: {
          startDate: filters.startDate,
          endDate: filters.endDate
        }
      }
    })

  } catch (error) {
    logError('GET /api/email/delivery', error)
    return handleApiError(error)
  }
}

// POST /api/email/delivery - Send email manually
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    const emailData = await validateRequestBody(request, sendEmailSchema)
    
    // Ensure user can only send emails for their company
    if (emailData.companyId !== authContext.user.companyId) {
      emailData.companyId = authContext.user.companyId
    }

    // Initialize email service
    const emailService = getDefaultEmailService()

    // Send email
    const emailLogId = await emailService.sendEmail({
      templateId: emailData.templateId,
      companyId: emailData.companyId,
      invoiceId: emailData.invoiceId,
      customerId: emailData.customerId,
      recipientEmail: emailData.recipientEmail,
      recipientName: emailData.recipientName,
      subject: emailData.subject,
      content: emailData.content,
      language: emailData.language,
      variables: emailData.variables,
      scheduleForBusinessHours: true
    })

    // Get the created email log for response
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: {
        emailTemplates: {
          select: { id: true, name: true, templateType: true }
        }
      }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: 'email_sent_manually',
        description: `Manual email sent to ${emailData.recipientEmail}`,
        metadata: {
          emailLogId,
          recipientEmail: emailData.recipientEmail,
          subject: emailData.subject,
          templateId: emailData.templateId,
          invoiceId: emailData.invoiceId,
          language: emailData.language
        }
      }
    })

    return successResponse(emailLog, 'Email sent successfully')

  } catch (error) {
    logError('POST /api/email/delivery', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}