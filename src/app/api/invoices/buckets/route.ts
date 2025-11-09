import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface InvoiceBucket {
  id: string
  label: string
  dayRange: { min: number; max: number | null }
  count: number
  totalAmount: number
  color: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  hasUrgentCustomers: boolean
  hasAutoRemindersEnabled: boolean
  hasRecentActivity: boolean
  eligibleForReminder: number
  needsReview: number
}

const INVOICE_BUCKETS = [
  {
    id: 'not_due',
    label: 'Not Overdue',
    dayRange: { min: -999, max: 0 },
    color: 'green',
    priority: 'low' as const
  },
  {
    id: 'overdue_1_3',
    label: '1-3 Days',
    dayRange: { min: 1, max: 3 },
    color: 'yellow',
    priority: 'medium' as const
  },
  {
    id: 'overdue_4_7',
    label: '4-7 Days',
    dayRange: { min: 4, max: 7 },
    color: 'amber',
    priority: 'high' as const
  },
  {
    id: 'overdue_8_14',
    label: '8-14 Days',
    dayRange: { min: 8, max: 14 },
    color: 'orange',
    priority: 'high' as const
  },
  {
    id: 'overdue_15_30',
    label: '15-30 Days',
    dayRange: { min: 15, max: 30 },
    color: 'red',
    priority: 'critical' as const
  },
  {
    id: 'overdue_30_plus',
    label: '30+ Days',
    dayRange: { min: 31, max: null },
    color: 'dark-red',
    priority: 'critical' as const
  }
]

function calculateDaysOverdue(dueDate: Date): number {
  const today = new Date()
  const timeDiff = today.getTime() - dueDate.getTime()
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24))
}

function categorizeInvoice(daysOverdue: number): string {
  for (const bucket of INVOICE_BUCKETS) {
    const { min, max } = bucket.dayRange
    if (max === null) {
      if (daysOverdue >= min) return bucket.id
    } else {
      if (daysOverdue >= min && daysOverdue <= max) return bucket.id
    }
  }
  return 'not_due' // Default fallback
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = session.user.companyId

    // Get all unpaid invoices for the company - ONLY fetch what we need for categorization
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: companyId,
        status: {
          in: ['SENT', 'OVERDUE']
        },
        isActive: true
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        amount: true,
        totalAmount: true,
        dueDate: true,
        lastReminderSent: true,
        createdAt: true
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    // Initialize bucket data
    const buckets: Record<string, InvoiceBucket> = {}
    INVOICE_BUCKETS.forEach(bucket => {
      buckets[bucket.id] = {
        ...bucket,
        count: 0,
        totalAmount: 0,
        hasUrgentCustomers: false,
        hasAutoRemindersEnabled: false,
        hasRecentActivity: false,
        eligibleForReminder: 0,
        needsReview: 0
      }
    })

    // Categorize invoices into buckets
    const categorizedInvoices: Record<string, any[]> = {}
    let totalInvoices = 0
    let totalAmount = 0
    let overdueCount = 0

    for (const invoice of invoices) {
      const daysOverdue = calculateDaysOverdue(new Date(invoice.dueDate))
      const bucketId = categorizeInvoice(daysOverdue)

      // Initialize array if not exists
      if (!categorizedInvoices[bucketId]) {
        categorizedInvoices[bucketId] = []
      }

      // Add invoice to bucket
      categorizedInvoices[bucketId].push({
        ...invoice,
        daysOverdue
      })

      // Update bucket metrics
      buckets[bucketId].count++
      const amount = Number(invoice.totalAmount || invoice.amount || 0)
      buckets[bucketId].totalAmount += amount

      // Check for urgent customers (high amount or long overdue)
      if (amount > 10000 || daysOverdue > 14) {
        buckets[bucketId].hasUrgentCustomers = true
      }

      // Check if eligible for reminder (no reminder sent in last 3 days)
      const lastReminder = invoice.lastReminderSent ? new Date(invoice.lastReminderSent) : null
      const daysSinceLastReminder = lastReminder ?
        Math.floor((new Date().getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24)) : 999

      if (!lastReminder || daysSinceLastReminder >= 3) {
        buckets[bucketId].eligibleForReminder++
      }

      // Check if needs review (high amount without recent reminder)
      if (amount > 5000 && daysSinceLastReminder > 7) {
        buckets[bucketId].needsReview++
      }

      // Check for recent activity (created or reminded in last 7 days)
      const daysSinceCreated = Math.floor((new Date().getTime() - new Date(invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceCreated <= 7 || daysSinceLastReminder <= 7) {
        buckets[bucketId].hasRecentActivity = true
      }

      // Update totals
      totalInvoices++
      totalAmount += Number(invoice.totalAmount || 0)
      if (daysOverdue > 0) {
        overdueCount++
      }
    }

    // Convert buckets object to array and add sample invoices for preview
    const bucketsArray = INVOICE_BUCKETS.map(bucketDef => {
      const bucket = buckets[bucketDef.id]
      const invoicesInBucket = categorizedInvoices[bucketDef.id] || []

      return {
        ...bucket,
        // Add up to 3 sample invoices for preview
        sampleInvoices: invoicesInBucket.slice(0, 3).map(inv => ({
          id: inv.id,
          number: inv.number,
          customerName: inv.customerName,
          amount: Number(inv.totalAmount || 0),
          daysOverdue: inv.daysOverdue,
          lastReminderSent: inv.lastReminderSent
        }))
      }
    })

    // Calculate summary statistics
    const summary = {
      totalInvoices,
      totalAmount,
      overdueCount,
      overdueAmount: bucketsArray
        .filter(b => b.id !== 'not_due')
        .reduce((sum, b) => sum + b.totalAmount, 0),
      criticalCount: bucketsArray
        .filter(b => b.priority === 'critical')
        .reduce((sum, b) => sum + b.count, 0),
      eligibleForReminder: bucketsArray
        .reduce((sum, b) => sum + b.eligibleForReminder, 0),
      needsReview: bucketsArray
        .reduce((sum, b) => sum + b.needsReview, 0)
    }

    return NextResponse.json({
      buckets: bucketsArray,
      summary,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching invoice buckets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice buckets' },
      { status: 500 }
    )
  }
}