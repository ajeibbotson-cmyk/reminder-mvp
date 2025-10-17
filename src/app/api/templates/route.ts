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
      company_id: session.user.companyId,
    }

    if (templateType) {
      whereClause.template_type = templateType
    }

    if (activeOnly) {
      whereClause.is_active = true
    }

    const templates = await prisma.email_templates.findMany({
      where: whereClause,
      orderBy: [
        { is_default: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        template_type: true,
        subject_en: true,
        subject_ar: true,
        content_en: true,
        content_ar: true,
        variables: true,
        version: true,
        is_active: true,
        is_default: true,
        supports_consolidation: true,
        max_invoice_count: true,
        uae_business_hours_only: true,
        created_at: true,
        updated_at: true,
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
      await prisma.email_templates.updateMany({
        where: {
          company_id: session.user.companyId,
          template_type: body.template_type,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      })
    }

    const template = await prisma.email_templates.create({
      data: {
        id: crypto.randomUUID(),
        company_id: session.user.companyId,
        created_by: session.user.id,
        name: body.name,
        description: body.description || null,
        template_type: body.template_type,
        subject_en: body.subject_en,
        subject_ar: body.subject_ar || null,
        content_en: body.content_en,
        content_ar: body.content_ar || null,
        variables: body.variables || null,
        is_active: body.is_active !== false,
        is_default: body.is_default || false,
        supports_consolidation: body.supports_consolidation || false,
        max_invoice_count: body.max_invoice_count || 1,
        uae_business_hours_only: body.uae_business_hours_only !== false,
        consolidation_variables: body.consolidation_variables || null,
        created_at: new Date(),
        updated_at: new Date(),
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
