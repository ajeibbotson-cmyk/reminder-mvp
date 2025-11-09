import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BUCKET_DEFINITIONS = {
  'not_due': { min: -999, max: 0 },
  'overdue_1_3': { min: 1, max: 3 },
  'overdue_4_7': { min: 4, max: 7 },
  'overdue_8_14': { min: 8, max: 14 },
  'overdue_15_30': { min: 15, max: 30 },
  'overdue_30_plus': { min: 31, max: null }
}

function calculateDaysOverdue(dueDate: Date): number {
  const today = new Date()
  const timeDiff = today.getTime() - dueDate.getTime()
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24))
}

function isInvoiceInBucket(daysOverdue: number, bucketId: string): boolean {
  const bucket = BUCKET_DEFINITIONS[bucketId as keyof typeof BUCKET_DEFINITIONS]
  if (!bucket) return false

  const { min, max } = bucket
  if (max === null) {
    return daysOverdue >= min
  } else {
    return daysOverdue >= min && daysOverdue <= max
  }
}

// Force recompilation - investigating SQL date filtering issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bucketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bucketId } = await params
    const companyId = session.user.companyId

    // Validate bucket ID
    if (!BUCKET_DEFINITIONS[bucketId as keyof typeof BUCKET_DEFINITIONS]) {
      return NextResponse.json({ error: 'Invalid bucket ID' }, { status: 400 })
    }

    // Parse pagination parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'dueDate'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * limit

    // Get bucket definition to filter by due date
    const bucketDef = BUCKET_DEFINITIONS[bucketId as keyof typeof BUCKET_DEFINITIONS]

    // Build where clause
    const whereClause: any = {
      companyId: companyId,
      status: {
        in: ['SENT', 'OVERDUE']
      },
      isActive: true
    }

    // Add date filtering based on bucket definition (SQL filtering - Option C)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today

    if (bucketDef.max === null) {
      // For 30+ days bucket (open-ended)
      const minDate = new Date(today)
      minDate.setDate(minDate.getDate() - bucketDef.min)

      whereClause.dueDate = {
        lte: minDate
      }
    } else {
      // For ranged buckets (1-3, 4-7, etc)
      const minDate = new Date(today)
      minDate.setDate(minDate.getDate() - bucketDef.max)

      const maxDate = new Date(today)
      maxDate.setDate(maxDate.getDate() - bucketDef.min)

      whereClause.dueDate = {
        gte: minDate,
        lte: maxDate
      }
    }

    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        {
          customerName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          customerEmail: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          number: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Get invoices with pagination
    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        select: {
          id: true,
          number: true,
          customerName: true,
          customerEmail: true,
          amount: true,
          totalAmount: true,
          currency: true,
          dueDate: true,
          status: true,
          lastReminderSent: true,
          createdAt: true,
          notes: true
        },
        orderBy: {
          [sortBy]: sortOrder as 'asc' | 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.invoice.count({
        where: whereClause
      })
    ])

    // Map invoices and add computed fields (no filtering needed, SQL already filtered)
    const bucketInvoices = invoices.map(invoice => {
      const daysOverdue = calculateDaysOverdue(new Date(invoice.dueDate))
      const amount = Number(invoice.totalAmount || invoice.amount || 0)

      // Calculate reminder eligibility
      const lastReminder = invoice.lastReminderSent ? new Date(invoice.lastReminderSent) : null
      const daysSinceLastReminder = lastReminder ?
        Math.floor((new Date().getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24)) : 999

      const canSendReminder = !lastReminder || daysSinceLastReminder >= 3
      const needsUrgentAttention = amount > 10000 || daysOverdue > 14
      const isHighValue = amount > 5000

      return {
        id: invoice.id,
        number: invoice.number,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        amount,
        currency: invoice.currency || 'AED',
        dueDate: invoice.dueDate,
        status: invoice.status,
        daysOverdue,
        lastReminderSent: invoice.lastReminderSent,
        daysSinceLastReminder,
        canSendReminder,
        needsUrgentAttention,
        isHighValue,
        createdAt: invoice.createdAt,
        notes: invoice.notes,
        // Suggested actions based on bucket and invoice characteristics
        suggestedActions: getSuggestedActions(bucketId, daysOverdue, amount, canSendReminder)
      }
    })

    // Calculate bucket-specific statistics
    const bucketStats = {
      totalInvoices: bucketInvoices.length,
      totalAmount: bucketInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      eligibleForReminder: bucketInvoices.filter(inv => inv.canSendReminder).length,
      needsUrgentAttention: bucketInvoices.filter(inv => inv.needsUrgentAttention).length,
      highValueInvoices: bucketInvoices.filter(inv => inv.isHighValue).length,
      averageAmount: bucketInvoices.length > 0 ?
        bucketInvoices.reduce((sum, inv) => sum + inv.amount, 0) / bucketInvoices.length : 0,
      averageDaysOverdue: bucketInvoices.length > 0 ?
        bucketInvoices.reduce((sum, inv) => sum + inv.daysOverdue, 0) / bucketInvoices.length : 0
    }

    // Pagination metadata
    const pagination = {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1
    }

    return NextResponse.json({
      bucketId,
      invoices: bucketInvoices,
      invoiceIds: bucketInvoices.map(inv => inv.id), // For email campaign integration
      stats: bucketStats,
      pagination,
      filters: {
        search,
        sortBy,
        sortOrder
      },
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching bucket details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bucket details' },
      { status: 500 }
    )
  }
}

function getSuggestedActions(
  bucketId: string,
  daysOverdue: number,
  amount: number,
  canSendReminder: boolean
): string[] {
  const actions: string[] = []

  switch (bucketId) {
    case 'not_due':
      if (amount > 10000) {
        actions.push('monitor_high_value')
      }
      break

    case 'overdue_1_3':
      if (canSendReminder) {
        actions.push('send_gentle_reminder')
      }
      actions.push('phone_call_consideration')
      break

    case 'overdue_4_7':
      if (canSendReminder) {
        actions.push('send_firm_reminder')
      }
      actions.push('personal_outreach_recommended')
      if (amount > 5000) {
        actions.push('manager_involvement')
      }
      break

    case 'overdue_8_14':
      actions.push('urgent_follow_up_required')
      if (canSendReminder) {
        actions.push('send_urgent_reminder')
      }
      actions.push('payment_plan_discussion')
      break

    case 'overdue_15_30':
      actions.push('escalation_required')
      actions.push('account_review')
      if (amount > 2000) {
        actions.push('legal_consultation')
      }
      break

    case 'overdue_30_plus':
      actions.push('debt_collection_consideration')
      actions.push('relationship_preservation_focus')
      actions.push('write_off_evaluation')
      break
  }

  return actions
}