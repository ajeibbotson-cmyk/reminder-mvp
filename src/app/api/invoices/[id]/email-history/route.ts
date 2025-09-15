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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = params.id

    // Get user and company info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Verify invoice belongs to company
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: user.company.id
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get email history for this invoice
    const emailHistory = await prisma.emailLog.findMany({
      where: {
        invoiceId: invoiceId,
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
      orderBy: { createdAt: 'desc' }
    })

    // Format the response data
    const formattedHistory = emailHistory.map(log => ({
      id: log.id,
      subject: log.subject,
      content: log.content,
      recipientEmail: log.recipientEmail,
      recipientName: log.recipientName,
      deliveryStatus: log.deliveryStatus,
      language: log.language,
      sentAt: log.sentAt?.toISOString(),
      deliveredAt: log.deliveredAt?.toISOString(),
      openedAt: log.openedAt?.toISOString(),
      clickedAt: log.clickedAt?.toISOString(),
      bouncedAt: log.bouncedAt?.toISOString(),
      complainedAt: log.complainedAt?.toISOString(),
      bounceReason: log.bounceReason,
      complaintFeedback: log.complaintFeedback,
      retryCount: log.retryCount,
      awsMessageId: log.awsMessageId,
      template: log.emailTemplate ? {
        id: log.emailTemplate.id,
        name: log.emailTemplate.name,
        templateType: log.emailTemplate.templateType
      } : null,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString()
    }))

    // Calculate summary statistics
    const totalSent = emailHistory.length
    const delivered = emailHistory.filter(log => log.deliveryStatus === 'DELIVERED').length
    const opened = emailHistory.filter(log => log.openedAt !== null).length
    const bounced = emailHistory.filter(log => log.deliveryStatus === 'BOUNCED').length
    const failed = emailHistory.filter(log => log.deliveryStatus === 'FAILED').length

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
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail
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