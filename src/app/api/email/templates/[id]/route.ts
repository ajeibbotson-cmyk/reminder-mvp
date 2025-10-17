import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { 
  updateEmailTemplateSchema,
  validateRequestBody
} from '@/lib/validations'
import { validateEmailTemplate } from '@/lib/email-service'
import { UserRole } from '@prisma/client'

// GET /api/email/templates/[id] - Get single email template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const { id } = params

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        company: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            emailLogs: true
          }
        }
      }
    })

    if (!template) {
      throw new Error('Email template not found')
    }

    // Verify user can access this template
    if (template.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to email template')
    }

    // Get detailed usage statistics
    const [
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      recentUsage
    ] = await Promise.all([
      prisma.emailLog.count({
        where: { templateId: id }
      }),
      prisma.emailLog.count({
        where: { templateId: id, deliveryStatus: 'DELIVERED' }
      }),
      prisma.emailLog.count({
        where: { templateId: id, openedAt: { not: null } }
      }),
      prisma.emailLog.count({
        where: { templateId: id, clickedAt: { not: null } }
      }),
      prisma.emailLog.count({
        where: { templateId: id, deliveryStatus: 'BOUNCED' }
      }),
      prisma.emailLog.findMany({
        where: { 
          templateId: id,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        },
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          deliveryStatus: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          bounceReason: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0

    const templateWithStats = {
      ...template,
      analytics: {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
        recentUsage
      }
    }

    return successResponse(templateWithStats)

  } catch (error) {
    logError('GET /api/email/templates/[id]', error, { 
      templateId: params.id
    })
    return handleApiError(error)
  }
}

// PUT /api/email/templates/[id] - Update email template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const { id } = params

    const updateData = await validateRequestBody(request, updateEmailTemplateSchema)

    // Get existing template
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      throw new Error('Email template not found')
    }

    // Verify user can access this template
    if (existingTemplate.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to email template')
    }

    // Validate template content if provided
    if (updateData.subjectEn || updateData.contentEn) {
      const templateToValidate = {
        subjectEn: updateData.subjectEn || existingTemplate.subjectEn,
        contentEn: updateData.contentEn || existingTemplate.contentEn,
        subjectAr: updateData.subjectAr || existingTemplate.subjectAr,
        contentAr: updateData.contentAr || existingTemplate.contentAr
      }
      
      const validationErrors = validateEmailTemplate(templateToValidate)
      if (validationErrors.length > 0) {
        throw new Error(`Template validation failed: ${validationErrors.join(', ')}`)
      }
    }

    // Check name uniqueness if name is being changed
    if (updateData.name && updateData.name !== existingTemplate.name) {
      const nameExists = await prisma.emailTemplate.findFirst({
        where: {
          companyId: existingTemplate.companyId,
          name: updateData.name,
          id: { not: id }
        }
      })

      if (nameExists) {
        throw new Error('Template with this name already exists')
      }
    }

    // If setting as default, unset other defaults of the same type
    if (updateData.isDefault === true) {
      const templateType = updateData.templateType || existingTemplate.templateType
      
      await prisma.emailTemplate.updateMany({
        where: {
          companyId: existingTemplate.companyId,
          templateType: templateType,
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      })
    }

    // Update template
    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Log activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: 'email_template_updated',
        description: `Updated email template: ${updatedTemplate.name}`,
        metadata: {
          templateId: updatedTemplate.id,
          changes: Object.keys(updateData),
          templateType: updatedTemplate.templateType,
          isDefault: updatedTemplate.isDefault
        }
      }
    })

    return successResponse(updatedTemplate, 'Email template updated successfully')

  } catch (error) {
    logError('PUT /api/email/templates/[id]', error, { 
      templateId: params.id
    })
    return handleApiError(error)
  }
}

// DELETE /api/email/templates/[id] - Delete email template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const { id } = params

    // Get existing template
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            emailLogs: true
          }
        }
      }
    })

    if (!existingTemplate) {
      throw new Error('Email template not found')
    }

    // Verify user can access this template
    if (existingTemplate.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to email template')
    }

    // Check if template is being used
    if (existingTemplate._count.emailLogs > 0) {
      // Instead of deleting, deactivate the template
      const deactivatedTemplate = await prisma.emailTemplate.update({
        where: { id },
        data: { 
          isActive: false,
          updatedAt: new Date()
        }
      })

      // Log activity
      await prisma.activities.create({
        data: {
          id: crypto.randomUUID(),
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'email_template_deactivated',
          description: `Deactivated email template: ${existingTemplate.name} (had ${existingTemplate._count.emailLogs} sent emails)`,
          metadata: {
            templateId: id,
            sentEmailsCount: existingTemplate._count.emailLogs
          }
        }
      })

      return successResponse({
        action: 'deactivated',
        template: deactivatedTemplate,
        reason: 'Template has been used to send emails and cannot be deleted. It has been deactivated instead.'
      }, 'Email template deactivated successfully')
    }

    // Safe to delete if no emails sent
    await prisma.emailTemplate.delete({
      where: { id }
    })

    // Log activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: 'email_template_deleted',
        description: `Deleted email template: ${existingTemplate.name}`,
        metadata: {
          templateId: id,
          templateType: existingTemplate.templateType
        }
      }
    })

    return successResponse({
      action: 'deleted',
      templateId: id
    }, 'Email template deleted successfully')

  } catch (error) {
    logError('DELETE /api/email/templates/[id]', error, { 
      templateId: params.id
    })
    return handleApiError(error)
  }
}