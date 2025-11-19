import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/invoices/[id]/email-history
 * Get email history for a specific invoice
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

    if (!user?.companies) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Verify invoice belongs to company
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: user.companies.id
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get email history for this invoice
    const emailHistory = await prisma.emailLog.findMany({
      where: {
        invoiceId: invoiceId,
        companyId: user.companies.id
      },
      include: {
        email_templates: {
          select: {
            id: true,
            name: true,
            templateId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Format the response data
    const formattedHistory = emailHistory.map(log => ({
      id: log.id,
      subject: log.subject,
      content: log.content,
      recipientEmail: log.recipient_email,
      recipientName: log.recipient_name,
      deliveryStatus: log.delivery_status,
      language: log.language,
      sentAt: log.sent_at?.toISOString(),
      deliveredAt: log.delivered_at?.toISOString(),
      openedAt: log.opened_at?.toISOString(),
      clickedAt: log.clicked_at?.toISOString(),
      bouncedAt: log.bounced_at?.toISOString(),
      complainedAt: log.complained_at?.toISOString(),
      bounceReason: log.bounce_reason,
      complaintFeedback: log.complaint_feedback,
      retryCount: log.retry_count,
      awsMessageId: log.aws_message_id,
      template: log.email_templates ? {
        id: log.email_templates.id,
        name: log.email_templates.name,
        templateType: log.email_templates.template_id
      } : null,
      createdAt: log.created_at.toISOString(),
      updatedAt: log.updated_at.toISOString()
    }))

    // Calculate summary statistics
    const totalSent = emailHistory.length
    const delivered = emailHistory.filter(log => log.delivery_status === 'DELIVERED').length
    const opened = emailHistory.filter(log => log.opened_at !== null).length
    const bounced = emailHistory.filter(log => log.delivery_status === 'BOUNCED').length
    const failed = emailHistory.filter(log => log.delivery_status === 'FAILED').length

    const summary = {
      total: totalSent,
      delivered,
      opened,
      bounced,
      failed,
      deliveryRate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          number: invoice.number,
          customerName: invoice.customer_name,
          customerEmail: invoice.customer_email
        },
        history: formattedHistory,
        summary
      }
    })

  } catch (error) {
    console.error('Failed to get invoice email history:', error)
    return NextResponse.json({
      error: 'Failed to get email history'
    }, { status: 500 })
  }
}