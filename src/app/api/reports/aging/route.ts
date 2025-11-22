import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AgingBucket {
  id: string
  label: string
  minDays: number
  maxDays: number | null
  count: number
  totalAmount: number
  invoices: {
    id: string
    number: string
    customerName: string
    customerEmail: string
    amount: number
    dueDate: string
    daysOverdue: number
    lastReminderSent: string | null
    status: string
    remindersPaused: boolean
  }[]
}

const AGING_BUCKETS = [
  { id: 'current', label: 'Current (Not Due)', minDays: -999, maxDays: 0 },
  { id: '1-30', label: '1-30 Days', minDays: 1, maxDays: 30 },
  { id: '31-60', label: '31-60 Days', minDays: 31, maxDays: 60 },
  { id: '61-90', label: '61-90 Days', minDays: 61, maxDays: 90 },
  { id: '90+', label: '90+ Days', minDays: 91, maxDays: null }
]

function calculateDaysOverdue(dueDate: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const customerId = searchParams.get('customerId')

    // Get all unpaid invoices
    const whereClause: any = {
      companyId: session.user.companyId,
      status: { in: ['SENT', 'OVERDUE', 'DISPUTED'] },
      isActive: true
    }

    if (customerId) {
      whereClause.customer = { id: customerId }
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      select: {
        id: true,
        number: true,
        customerName: true,
        customerEmail: true,
        amount: true,
        totalAmount: true,
        dueDate: true,
        status: true,
        lastReminderSent: true,
        remindersPaused: true,
        currency: true
      },
      orderBy: { dueDate: 'asc' }
    })

    // Categorize invoices into aging buckets
    const buckets: AgingBucket[] = AGING_BUCKETS.map(bucket => ({
      ...bucket,
      count: 0,
      totalAmount: 0,
      invoices: []
    }))

    let totalOutstanding = 0
    let totalOverdue = 0

    for (const invoice of invoices) {
      const daysOverdue = calculateDaysOverdue(new Date(invoice.dueDate))
      const amount = Number(invoice.totalAmount || invoice.amount || 0)
      totalOutstanding += amount

      if (daysOverdue > 0) {
        totalOverdue += amount
      }

      // Find the appropriate bucket
      for (const bucket of buckets) {
        const inBucket = bucket.maxDays === null
          ? daysOverdue >= bucket.minDays
          : daysOverdue >= bucket.minDays && daysOverdue <= bucket.maxDays

        if (inBucket) {
          bucket.count++
          bucket.totalAmount += amount
          bucket.invoices.push({
            id: invoice.id,
            number: invoice.number,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            amount,
            dueDate: invoice.dueDate.toISOString(),
            daysOverdue,
            lastReminderSent: invoice.lastReminderSent?.toISOString() || null,
            status: invoice.status,
            remindersPaused: invoice.remindersPaused
          })
          break
        }
      }
    }

    // Summary statistics
    const summary = {
      totalInvoices: invoices.length,
      totalOutstanding,
      totalOverdue,
      averageDaysOverdue: invoices.length > 0
        ? Math.round(invoices.reduce((sum, inv) => {
            const days = calculateDaysOverdue(new Date(inv.dueDate))
            return sum + Math.max(0, days)
          }, 0) / invoices.filter(inv => calculateDaysOverdue(new Date(inv.dueDate)) > 0).length || 0)
        : 0,
      generatedAt: new Date().toISOString()
    }

    // Return CSV format if requested
    if (format === 'csv') {
      const csvRows = [
        ['Invoice Number', 'Customer', 'Email', 'Amount (AED)', 'Due Date', 'Days Overdue', 'Aging Bucket', 'Status', 'Reminders Paused', 'Last Reminder'].join(',')
      ]

      for (const bucket of buckets) {
        for (const invoice of bucket.invoices) {
          csvRows.push([
            `"${invoice.number}"`,
            `"${invoice.customerName}"`,
            `"${invoice.customerEmail}"`,
            invoice.amount.toFixed(2),
            new Date(invoice.dueDate).toISOString().split('T')[0],
            invoice.daysOverdue.toString(),
            `"${bucket.label}"`,
            invoice.status,
            invoice.remindersPaused ? 'Yes' : 'No',
            invoice.lastReminderSent ? new Date(invoice.lastReminderSent).toISOString().split('T')[0] : 'Never'
          ].join(','))
        }
      }

      // Add summary section
      csvRows.push('')
      csvRows.push('SUMMARY')
      csvRows.push(`Total Invoices,${summary.totalInvoices}`)
      csvRows.push(`Total Outstanding,AED ${summary.totalOutstanding.toFixed(2)}`)
      csvRows.push(`Total Overdue,AED ${summary.totalOverdue.toFixed(2)}`)
      csvRows.push(`Average Days Overdue,${summary.averageDaysOverdue}`)
      csvRows.push(`Report Generated,${new Date(summary.generatedAt).toISOString()}`)

      const csvContent = csvRows.join('\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="aging-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Return JSON format
    return NextResponse.json({
      buckets,
      summary,
      generatedAt: summary.generatedAt
    })

  } catch (error) {
    console.error('Error generating aging report:', error)
    return NextResponse.json(
      { error: 'Failed to generate aging report' },
      { status: 500 }
    )
  }
}
