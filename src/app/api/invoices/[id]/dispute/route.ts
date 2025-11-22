import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/invoices/[id]/dispute - Mark an invoice as disputed
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
    const { reason, notes } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 })
    }

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

    // Update the invoice to disputed status
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'DISPUTED',
        disputedAt: new Date(),
        disputeReason: reason.trim(),
        disputeNotes: notes?.trim() || null,
        disputeResolvedAt: null,
        disputeResolution: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        number: true,
        status: true,
        disputedAt: true,
        disputeReason: true,
        disputeNotes: true
      }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        userId: session.user.id,
        type: 'INVOICE_DISPUTED',
        description: `Marked invoice ${invoice.number} as disputed: ${reason}`,
        metadata: {
          invoiceId: id,
          invoiceNumber: invoice.number,
          previousStatus: invoice.status,
          disputeReason: reason,
          disputeNotes: notes || null
        }
      }
    })

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice
    })

  } catch (error) {
    console.error('Error marking invoice as disputed:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE /api/invoices/[id]/dispute - Resolve a dispute
export async function DELETE(
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
    const { resolution, newStatus } = body

    if (!resolution || resolution.trim() === '') {
      return NextResponse.json({ error: 'Resolution is required' }, { status: 400 })
    }

    // Verify the invoice belongs to the user's company and is disputed
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
        isActive: true,
        status: 'DISPUTED'
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Disputed invoice not found' }, { status: 404 })
    }

    // Determine new status - default to previous status logic
    const resolvedStatus = newStatus || (invoice.dueDate < new Date() ? 'OVERDUE' : 'SENT')

    // Update the invoice to resolve the dispute
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: resolvedStatus,
        disputeResolvedAt: new Date(),
        disputeResolution: resolution.trim(),
        updatedAt: new Date()
      },
      select: {
        id: true,
        number: true,
        status: true,
        disputedAt: true,
        disputeReason: true,
        disputeNotes: true,
        disputeResolvedAt: true,
        disputeResolution: true
      }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        userId: session.user.id,
        type: 'INVOICE_DISPUTE_RESOLVED',
        description: `Resolved dispute for invoice ${invoice.number}: ${resolution}`,
        metadata: {
          invoiceId: id,
          invoiceNumber: invoice.number,
          newStatus: resolvedStatus,
          resolution,
          originalDispute: {
            reason: invoice.disputeReason,
            notes: invoice.disputeNotes,
            disputedAt: invoice.disputedAt
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice
    })

  } catch (error) {
    console.error('Error resolving dispute:', error)
    return NextResponse.json(
      { error: 'Failed to resolve dispute' },
      { status: 500 }
    )
  }
}

// GET /api/invoices/[id]/dispute - Get dispute info for an invoice
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
        status: true,
        disputedAt: true,
        disputeReason: true,
        disputeNotes: true,
        disputeResolvedAt: true,
        disputeResolution: true
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
      isDisputed: invoice.status === 'DISPUTED',
      wasDisputed: invoice.disputedAt !== null,
      ...invoice
    })

  } catch (error) {
    console.error('Error getting dispute info:', error)
    return NextResponse.json(
      { error: 'Failed to get dispute info' },
      { status: 500 }
    )
  }
}
