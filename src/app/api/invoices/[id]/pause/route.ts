import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/invoices/[id]/pause - Toggle pause state for an invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { paused, reason } = body

    // Verify the invoice belongs to the user's company
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
        isActive: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Update the invoice pause state
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        remindersPaused: paused,
        remindersPausedAt: paused ? new Date() : null,
        remindersPausedBy: paused ? session.user.id : null,
        remindersPauseReason: paused ? (reason || null) : null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        number: true,
        remindersPaused: true,
        remindersPausedAt: true,
        remindersPauseReason: true
      }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        userId: session.user.id,
        type: paused ? 'INVOICE_REMINDERS_PAUSED' : 'INVOICE_REMINDERS_RESUMED',
        description: paused
          ? `Paused reminders for invoice ${invoice.number}${reason ? `: ${reason}` : ''}`
          : `Resumed reminders for invoice ${invoice.number}`,
        metadata: {
          invoiceId: id,
          invoiceNumber: invoice.number,
          paused,
          reason: reason || null
        }
      }
    })

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice
    })

  } catch (error) {
    console.error('Error toggling invoice pause state:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// GET /api/invoices/[id]/pause - Get pause state for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
        isActive: true
      },
      select: {
        id: true,
        number: true,
        remindersPaused: true,
        remindersPausedAt: true,
        remindersPausedBy: true,
        remindersPauseReason: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)

  } catch (error) {
    console.error('Error getting invoice pause state:', error)
    return NextResponse.json(
      { error: 'Failed to get invoice pause state' },
      { status: 500 }
    )
  }
}
