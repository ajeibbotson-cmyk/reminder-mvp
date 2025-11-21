"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, CheckCircle, Mail, AlertCircle, Clock, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActivityItem {
  id: string
  type: 'payment' | 'reminder_sent' | 'overdue' | 'invoice_created' | 'reminder_opened'
  title: string
  description: string
  timestamp: Date
  amount?: number
  currency?: string
}

interface RecentActivityProps {
  activities?: ActivityItem[]
  maxItems?: number
}

const activityIcons = {
  payment: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-100' },
  reminder_sent: { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100' },
  overdue: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
  invoice_created: { icon: CheckCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
  reminder_opened: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-100' }
}

export function RecentActivity({ activities = [], maxItems = 5 }: RecentActivityProps) {
  const formatCurrency = (amount: number, currency = 'AED') => {
    return `${currency} ${new Intl.NumberFormat('en-AE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }

  // Generate sample activities if none provided
  const displayActivities = activities.length > 0 ? activities : generateSampleActivities()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayActivities.slice(0, maxItems).map((activity) => {
              const { icon: Icon, color, bg } = activityIcons[activity.type]
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-full", bg)}>
                    <Icon className={cn("h-4 w-4", color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {activity.description}
                    </p>
                    {activity.amount && (
                      <p className={cn(
                        "text-sm font-medium mt-1",
                        activity.type === 'payment' ? 'text-green-600' : 'text-gray-700'
                      )}>
                        {formatCurrency(activity.amount, activity.currency)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function generateSampleActivities(): ActivityItem[] {
  const now = new Date()

  return [
    {
      id: '1',
      type: 'payment',
      title: 'Payment Received',
      description: 'Invoice #INV-2024-001 paid by Acme Corp',
      timestamp: new Date(now.getTime() - 2 * 3600000),
      amount: 5420,
      currency: 'AED'
    },
    {
      id: '2',
      type: 'reminder_sent',
      title: 'Reminder Sent',
      description: '3 reminders sent for overdue invoices',
      timestamp: new Date(now.getTime() - 5 * 3600000)
    },
    {
      id: '3',
      type: 'reminder_opened',
      title: 'Email Opened',
      description: 'Gulf Trading viewed reminder for INV-2024-015',
      timestamp: new Date(now.getTime() - 8 * 3600000)
    },
    {
      id: '4',
      type: 'overdue',
      title: 'Invoice Overdue',
      description: 'Invoice #INV-2024-023 is now 7 days overdue',
      timestamp: new Date(now.getTime() - 24 * 3600000),
      amount: 12500,
      currency: 'AED'
    },
    {
      id: '5',
      type: 'payment',
      title: 'Payment Received',
      description: 'Invoice #INV-2024-019 paid by Dubai Trading LLC',
      timestamp: new Date(now.getTime() - 48 * 3600000),
      amount: 8750,
      currency: 'AED'
    }
  ]
}
