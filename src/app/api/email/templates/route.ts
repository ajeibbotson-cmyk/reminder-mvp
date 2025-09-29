import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { 
  createEmailTemplateSchema,
  validateRequestBody,
  validateQueryParams,
  paginationSchema
} from '@/lib/validations'
import { validateEmailTemplate } from '@/lib/email-service'
import { UserRole, EmailTemplateType } from '@prisma/client'

// GET /api/email/templates - Get email templates for company
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const pagination = validateQueryParams(searchParams, paginationSchema)
    const templateType = searchParams.get('templateType') as EmailTemplateType | null
    const isActive = searchParams.get('isActive')
    const language = searchParams.get('language')
    
    const skip = (pagination.page - 1) * pagination.limit

    // Build where clause
    const where: Record<string, any> = {
      companyId: authContext.user.companyId
    }

    if (templateType) {
      where.templateType = templateType
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Execute queries in parallel
    const [templates, totalCount] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              emailLogs: true
            }
          }
        },
        orderBy: [
          { isDefault: 'desc' },
          { updatedAt: 'desc' }
        ],
        skip,
        take: pagination.limit
      }),
      prisma.emailTemplate.count({ where })
    ])

    // Enhance templates with usage statistics
    const templatesWithStats = await Promise.all(
      templates.map(async (template) => {
        // Get recent usage stats
        const [sentCount, deliveredCount, openedCount] = await Promise.all([
          prisma.emailLogs.count({
            where: { 
              templateId: template.id,
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
            }
          }),
          prisma.emailLogs.count({
            where: {
              templateId: template.id,
              deliveryStatus: 'DELIVERED',
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          }),
          prisma.emailLogs.count({
            where: {
              templateId: template.id,
              openedAt: { not: null },
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          })
        ])

        const openRate = deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0

        return {
          ...template,
          usage: {
            totalSent: template._count.emailLogs,
            last30Days: {
              sent: sentCount,
              delivered: deliveredCount,
              opened: openedCount,
              openRate: Math.round(openRate * 100) / 100
            }
          },
          // Remove content from list view for performance
          contentEn: template.contentEn.length > 200 ? template.contentEn.substring(0, 200) + '...' : template.contentEn,
          contentAr: template.contentAr ? (template.contentAr.length > 200 ? template.contentAr.substring(0, 200) + '...' : template.contentAr) : null
        }
      })
    )

    return successResponse({
      templates: templatesWithStats,
      totalCount,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: skip + templates.length < totalCount,
      summary: {
        total: totalCount,
        active: templates.filter(t => t.isActive).length,
        inactive: templates.filter(t => !t.isActive).length,
        defaultTemplates: templates.filter(t => t.isDefault).length,
        byType: templates.reduce((acc: any, t) => {
          acc[t.templateType] = (acc[t.templateType] || 0) + 1
          return acc
        }, {})
      }
    })

  } catch (error) {
    logError('GET /api/email/templates', error)
    return handleApiError(error)
  }
}

// POST /api/email/templates - Create new email template
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    const templateData = await validateRequestBody(request, createEmailTemplateSchema)
    
    // Ensure user can only create templates for their company
    if (templateData.companyId !== authContext.user.companyId) {
      templateData.companyId = authContext.user.companyId
    }

    // Set created by user
    templateData.createdBy = authContext.user.id

    // Validate template content
    const validationErrors = validateEmailTemplate(templateData)
    if (validationErrors.length > 0) {
      throw new Error(`Template validation failed: ${validationErrors.join(', ')}`)
    }

    // Check if name already exists for this company
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: {
        companyId: templateData.companyId,
        name: templateData.name,
        version: templateData.version || 1
      }
    })

    if (existingTemplate) {
      throw new Error('Template with this name already exists')
    }

    // If this is set as default, unset other defaults of the same type
    if (templateData.isDefault) {
      await prisma.emailTemplate.updateMany({
        where: {
          companyId: templateData.companyId,
          templateType: templateData.templateType,
          isDefault: true
        },
        data: { isDefault: false }
      })
    }

    // Create template
    const template = await prisma.emailTemplate.create({
      data: {
        id: crypto.randomUUID(),
        companyId: templateData.companyId,
        name: templateData.name,
        description: templateData.description,
        templateType: templateData.templateType,
        subjectEn: templateData.subjectEn,
        subjectAr: templateData.subjectAr,
        contentEn: templateData.contentEn,
        contentAr: templateData.contentAr,
        variables: templateData.variables || {},
        version: templateData.version || 1,
        isActive: templateData.isActive,
        isDefault: templateData.isDefault,
        uaeBusinessHoursOnly: templateData.uaeBusinessHoursOnly,
        createdBy: templateData.createdBy
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
        type: 'email_template_created',
        description: `Created email template: ${template.name}`,
        metadata: {
          templateId: template.id,
          templateType: template.templateType,
          isDefault: template.isDefault,
          hasArabicContent: !!template.subjectAr || !!template.contentAr
        }
      }
    })

    return successResponse(template, 'Email template created successfully')

  } catch (error) {
    logError('POST /api/email/templates', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}