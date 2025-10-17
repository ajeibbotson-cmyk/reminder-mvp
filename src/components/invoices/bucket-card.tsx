'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  AlertTriangle,
  Activity,
  Mail,
  Eye,
  TrendingUp,
  DollarSign,
  FileText
} from 'lucide-react'
import { InvoiceBucket, formatCurrency, getBucketColorClasses, getPriorityVariant } from '@/hooks/use-invoice-buckets'

interface BucketCardProps {
  bucket: InvoiceBucket
  isSelected?: boolean
  onSelect?: () => void
  onQuickAction?: (action: 'send_all' | 'review_all') => void
}

export function BucketCard({
  bucket,
  isSelected = false,
  onSelect,
  onQuickAction
}: BucketCardProps) {
  const colorClasses = getBucketColorClasses(bucket.color)

  const handleCardClick = () => {
    if (onSelect) {
      onSelect()
    }
  }

  const handleQuickAction = (action: 'send_all' | 'review_all', e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card selection
    if (onQuickAction) {
      onQuickAction(action)
    }
  }

  return (
    <Card
      className={`
        cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md
        min-h-[200px] flex flex-col
        ${colorClasses.border}
      `}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge
            variant={getPriorityVariant(bucket.priority) as any}
            className="text-xs font-medium"
          >
            {bucket.priority.toUpperCase()}
          </Badge>
          <div className="flex items-center gap-1">
            {bucket.hasUrgentCustomers && (
              <AlertTriangle className="h-4 w-4 text-red-500" title="Has urgent customers" />
            )}
            {bucket.hasAutoRemindersEnabled && (
              <Clock className="h-4 w-4 text-blue-500" title="Auto reminders enabled" />
            )}
            {bucket.hasRecentActivity && (
              <Activity className="h-4 w-4 text-green-500" title="Recent activity" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Bucket Title and Main Metrics */}
        <div>
          <h3 className="font-semibold text-sm text-gray-900 mb-2">
            {bucket.label}
          </h3>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Invoices:</span>
              </div>
              <span className="font-mono font-bold">{bucket.count}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">Total:</span>
              </div>
              <span className="font-mono font-bold">
                {formatCurrency(bucket.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Indicators */}
        {(bucket.eligibleForReminder > 0 || bucket.needsReview > 0) && (
          <div className="space-y-1 text-xs">
            {bucket.eligibleForReminder > 0 && (
              <div className="flex items-center gap-1 text-blue-600">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Can send: {bucket.eligibleForReminder}</span>
              </div>
            )}
            {bucket.needsReview > 0 && (
              <div className="flex items-center gap-1 text-orange-600">
                <Eye className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Review: {bucket.needsReview}</span>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats for Empty Buckets */}
        {bucket.count === 0 && (
          <div className="text-center text-gray-400 py-4 text-xs">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No invoices in this category</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}