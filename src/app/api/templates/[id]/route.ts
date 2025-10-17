import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const templateId = params.id
    const body = await request.json()

    // Verify template exists and belongs to company
    const existingTemplate = await prisma.email_templates.findFirst({
      where: {
        id: templateId,
        company_id: session.user.companyId,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // If setting as default, unset other defaults of same type
    if (body.is_default && existingTemplate.template_type) {
      await prisma.email_templates.updateMany({
        where: {
          company_id: session.user.companyId,
          template_type: existingTemplate.template_type,
          is_default: true,
          id: { not: templateId },
        },
        data: {
          is_default: false,
        },
      })
    }

    const updateData: any = {
      updated_at: new Date(),
    }

    // Only update provided fields
    const allowedFields = [
      'name',
      'description',
      'subject_en',
      'subject_ar',
      'content_en',
      'content_ar',
      'variables',
      'is_active',
      'is_default',
      'supports_consolidation',
      'max_invoice_count',
      'uae_business_hours_only',
      'consolidation_variables',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const template = await prisma.email_templates.update({
      where: { id: templateId },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Template updated successfully',
      template,
    })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Soft delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const templateId = params.id

    // Verify template exists and belongs to company
    const existingTemplate = await prisma.email_templates.findFirst({
      where: {
        id: templateId,
        company_id: session.user.companyId,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting is_active to false
    const template = await prisma.email_templates.update({
      where: { id: templateId },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Template deleted successfully',
      template,
    })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
