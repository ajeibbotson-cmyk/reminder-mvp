import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultEmailService } from '@/lib/email-service'
import { z } from 'zod'

const sendEmailSchema = z.object({
  templateId: z.string().uuid().optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
  subject: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  language: z.enum(['ENGLISH', 'ARABIC']).default('ENGLISH'),
  scheduleForBusinessHours: z.boolean().default(true),
  sendImmediately: z.boolean().default(false)
})

/**
 * POST /api/invoices/[id]/send-email
 * Send invoice email with template or custom content
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await params
    const body = await request.json()
    const validatedData = sendEmailSchema.parse(body)

    // Get user and company info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Get invoice with related data
    const invoice = await prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        companyId: user.company.id
      },
      include: {
        customer: true,
        company: true,
        invoiceItems: true,
        payments: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if invoice has a valid recipient
    const recipientEmail = validatedData.recipientEmail || invoice.customerEmail
    const recipientName = validatedData.recipientName || invoice.customerName

    if (!recipientEmail) {
      return NextResponse.json({
        error: 'No recipient email specified'
      }, { status: 400 })
    }

    // Check email suppression list
    const suppressionCheck = await prisma.emailSuppressionList.findFirst({
      where: {
        emailAddress: recipientEmail,
        companyId: user.company.id,
        isActive: true
      }
    })

    if (suppressionCheck) {
      return NextResponse.json({
        error: `Email address ${recipientEmail} is suppressed: ${suppressionCheck.reason}`,
        suppressionType: suppressionCheck.suppressionType
      }, { status: 400 })
    }

    // Get template if specified
    let template = null
    if (validatedData.templateId) {
      template = await prisma.emailTemplate.findFirst({
        where: {
          id: validatedData.templateId,
          companyId: user.company.id,
          isActive: true
        }
      })

      if (!template) {
        return NextResponse.json({
          error: 'Email template not found or inactive'
        }, { status: 404 })
      }
    }

    // Use default template if none specified
    if (!template && !validatedData.subject && !validatedData.content) {
      template = await prisma.emailTemplate.findFirst({
        where: {
          companyId: user.company.id,
          templateType: 'INVOICE_REMINDER',
          isDefault: true,
          isActive: true
        }
      })

      if (!template) {
        return NextResponse.json({
          error: 'No template specified and no default template found'
        }, { status: 400 })
      }
    }

    // Initialize email service
    const emailService = getDefaultEmailService()

    // Prepare email options
    const emailOptions = {
      templateId: template?.id,
      companyId: user.company.id,
      invoiceId: invoice.id,
      customerId: invoice.customer?.id,
      recipientEmail,
      recipientName,
      subject: validatedData.subject,
      content: validatedData.content,
      language: validatedData.language,
      scheduleForBusinessHours: validatedData.scheduleForBusinessHours,
      delayMinutes: validatedData.sendImmediately ? 0 : undefined
    }

    // Send email
    const emailLogId = await emailService.sendEmail(emailOptions)

    // Get the created email log for response
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: {
        emailTemplate: {
          select: {
            id: true,
            name: true,
            templateType: true
          }
        }
      }
    })

    // Log activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        userId: user.id,
        type: 'invoice_email_sent',
        description: `Sent email for invoice ${invoice.number} to ${recipientEmail}`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          recipientEmail,
          templateId: template?.id,
          templateName: template?.name,
          language: validatedData.language,
          emailLogId
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Email queued for delivery',
      data: {
        emailLogId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        recipientEmail,
        recipientName,
        subject: emailLog?.subject,
        language: validatedData.language,
        templateUsed: template ? {
          id: template.id,
          name: template.name,
          type: template.templateType
        } : null,
        status: emailLog?.deliveryStatus,
        scheduledSendTime: emailLog?.uaeSendTime,
        createdAt: emailLog?.createdAt
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to send invoice email:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send email'
    }, { status: 500 })
  }
}

/**
 * GET /api/invoices/[id]/send-email
 * Get email sending options and templates for invoice
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await params

    // Get user and company info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Get invoice
    const invoice = await prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        companyId: user.company.id
      },
      include: {
        customer: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get available email templates
    const templates = await prisma.emailTemplate.findMany({
      where: {
        companyId: user.company.id,
        isActive: true,
        templateType: {
          in: ['INVOICE_REMINDER', 'OVERDUE_NOTICE', 'PAYMENT_REQUEST', 'FOLLOW_UP']
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        templateType: true,
        subjectEn: true,
        subjectAr: true,
        isDefault: true,
        uaeBusinessHoursOnly: true,
        updatedAt: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' }
      ]
    })

    // Get recent email history for this invoice
    const emailHistory = await prisma.emailLog.findMany({
      where: {
        invoiceId: invoice.id,
        companyId: user.company.id
      },
      include: {
        emailTemplate: {
          select: {
            id: true,
            name: true,
            templateType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Check if customer email is suppressed
    const isEmailSuppressed = await prisma.emailSuppressionList.findFirst({
      where: {
        emailAddress: invoice.customerEmail,
        companyId: user.company.id,
        isActive: true
      }
    })

    // Get suggested template based on invoice status
    let suggestedTemplate = null
    if (invoice.status === 'OVERDUE') {
      suggestedTemplate = templates.find(t =>
        t.templateType === 'OVERDUE_NOTICE' && t.isDefault
      ) || templates.find(t => t.templateType === 'OVERDUE_NOTICE')
    } else if (['SENT', 'VIEWED'].includes(invoice.status)) {
      suggestedTemplate = templates.find(t =>
        t.templateType === 'INVOICE_REMINDER' && t.isDefault
      ) || templates.find(t => t.templateType === 'INVOICE_REMINDER')
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          number: invoice.number,
          amount: invoice.totalAmount || invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          dueDate: invoice.dueDate,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          daysPastDue: Math.max(0,
            Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          )
        },
        templates,
        suggestedTemplate,
        emailHistory: emailHistory.map(log => ({
          id: log.id,
          subject: log.subject,
          recipientEmail: log.recipientEmail,
          deliveryStatus: log.deliveryStatus,
          language: log.language,
          sentAt: log.sentAt,
          deliveredAt: log.deliveredAt,
          openedAt: log.openedAt,
          template: log.emailTemplate
        })),
        restrictions: {
          isEmailSuppressed: !!isEmailSuppressed,
          suppressionReason: isEmailSuppressed?.reason,
          canSendEmail: !isEmailSuppressed && !!invoice.customerEmail
        }
      }
    })

  } catch (error) {
    console.error('Failed to get invoice email options:', error)
    return NextResponse.json({
      error: 'Failed to get email options'
    }, { status: 500 })
  }
}