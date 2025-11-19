import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/templates - List company templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const templateType = searchParams.get('type')
    const activeOnly = searchParams.get('active') !== 'false'

    const whereClause: any = {
      companyId: session.user.companyId,
    }

    if (templateType) {
      whereClause.templateType = templateType
    }

    if (activeOnly) {
      whereClause.isActive = true
    }

    const templates = await prisma.emailTemplate.findMany({
      where: whereClause,
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        templateType: true,
        subjectEn: true,
        subjectAr: true,
        contentEn: true,
        contentAr: true,
        variables: true,
        version: true,
        isActive: true,
        isDefault: true,
        supportsConsolidation: true,
        maxInvoiceCount: true,
        uaeBusinessHoursOnly: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      templates,
      total: templates.length,
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields
    const requiredFields = ['name', 'template_type', 'subject_en', 'content_en']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // If setting as default, unset other defaults of same type
    if (body.is_default) {
      await prisma.emailTemplate.updateMany({
        where: {
          companyId: session.user.companyId,
          templateType: body.template_type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        createdBy: session.user.id,
        name: body.name,
        description: body.description || null,
        templateType: body.template_type,
        subjectEn: body.subject_en,
        subjectAr: body.subject_ar || null,
        contentEn: body.content_en,
        contentAr: body.content_ar || null,
        variables: body.variables || null,
        isActive: body.is_active !== false,
        isDefault: body.is_default || false,
        supportsConsolidation: body.supports_consolidation || false,
        maxInvoiceCount: body.max_invoice_count || 1,
        uaeBusinessHoursOnly: body.uae_business_hours_only !== false,
        consolidationVariables: body.consolidation_variables || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(
      {
        message: 'Template created successfully',
        template
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
