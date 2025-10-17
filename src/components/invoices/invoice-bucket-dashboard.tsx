'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Clock,
  Mail,
  DollarSign,
  BarChart3
} from 'lucide-react'
import { BucketCard } from './bucket-card'
import { BucketDetailView } from './bucket-detail-view'
import { EmailCampaignModal } from './email-campaign-modal'
import { useBucketData, formatCurrency, InvoiceBucket } from '@/hooks/use-invoice-buckets'

interface InvoiceBucketDashboardProps {
  onEmailCampaign?: (invoiceIds: string[]) => void
}

export function InvoiceBucketDashboard({ onEmailCampaign }: InvoiceBucketDashboardProps) {
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [campaignInvoiceIds, setCampaignInvoiceIds] = useState<string[]>([])
  const { data, isLoading, error, refetch } = useBucketData(60000) // Refresh every minute

  const handleBucketSelect = (bucketId: string) => {
    setSelectedBucket(selectedBucket === bucketId ? null : bucketId)
  }

  const handleQuickAction = async (bucket: InvoiceBucket, action: 'send_all' | 'review_all') => {
    if (action === 'send_all' && bucket.eligibleForReminder > 0) {
      // Fetch all invoice IDs for this bucket to create email campaign
      try {
        const response = await fetch(`/api/invoices/buckets/${bucket.id}?limit=1000`)
        if (!response.ok) throw new Error('Failed to fetch bucket invoices')

        const bucketData = await response.json()
        const invoiceIds = bucketData.invoiceIds || []

        // Open email modal with invoice IDs
        setCampaignInvoiceIds(invoiceIds)
        setShowEmailModal(true)

        // Also call callback if provided
        if (onEmailCampaign) {
          onEmailCampaign(invoiceIds)
        }
      } catch (error) {
        console.error('Failed to fetch invoice IDs:', error)
        alert('Failed to load invoices for email campaign')
      }
    } else if (action === 'review_all') {
      setSelectedBucket(bucket.id)
    }
  }

  const handleEmailCampaign = (invoiceIds: string[]) => {
    setCampaignInvoiceIds(invoiceIds)
    setShowEmailModal(true)
  }

  const selectedBucketData = data?.buckets.find(b => b.id === selectedBucket)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading invoice dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load invoice dashboard: {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Management</h1>
          <p className="text-gray-600">
            Organize and manage invoices by their overdue status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {data?.summary.eligibleForReminder && data.summary.eligibleForReminder > 0 && (
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Mail className="h-4 w-4 mr-2" />
              Send All Reminders ({data.summary.eligibleForReminder})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Statistics */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{data.summary.totalInvoices}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.summary.totalAmount)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{data.summary.overdueCount}</p>
                  <p className="text-sm text-gray-500">{formatCurrency(data.summary.overdueAmount)}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Can Send Reminders</p>
                  <p className="text-2xl font-bold text-blue-600">{data.summary.eligibleForReminder}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice Buckets - Show only when no bucket is selected */}
      {data?.buckets && !selectedBucket && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Invoice Categories</h2>
            {data.lastUpdated && (
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {data.buckets.map((bucket) => (
              <BucketCard
                key={bucket.id}
                bucket={bucket}
                isSelected={false}
                onSelect={() => handleBucketSelect(bucket.id)}
                onQuickAction={(action) => handleQuickAction(bucket, action)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detailed Bucket View - Full width when bucket is selected */}
      {selectedBucket && selectedBucketData && (
        <BucketDetailView
          bucketId={selectedBucket}
          bucketLabel={selectedBucketData.label}
          onClose={() => setSelectedBucket(null)}
          onEmailCampaign={handleEmailCampaign}
        />
      )}

      {/* Quick Actions Summary */}
      {data?.summary && (data.summary.criticalCount > 0 || data.summary.needsReview > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Action Required
            </CardTitle>
            <CardDescription>
              There are invoices that need immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.summary.criticalCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="font-medium text-red-800">Critical Invoices</p>
                    <p className="text-sm text-red-600">
                      {data.summary.criticalCount} invoices need urgent follow-up
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const criticalBucket = data.buckets.find(b => b.priority === 'critical' && b.count > 0)
                      if (criticalBucket) setSelectedBucket(criticalBucket.id)
                    }}
                  >
                    Review
                  </Button>
                </div>
              )}

              {data.summary.needsReview > 0 && (
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="font-medium text-orange-800">Need Review</p>
                    <p className="text-sm text-orange-600">
                      {data.summary.needsReview} high-value invoices need attention
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const reviewBucket = data.buckets.find(b => b.needsReview > 0)
                      if (reviewBucket) setSelectedBucket(reviewBucket.id)
                    }}
                  >
                    Review
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {data?.summary.totalInvoices === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              No Outstanding Invoices
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              Great job! You don't have any unpaid invoices at the moment.
              New invoices will appear here as they are created and become overdue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email Campaign Modal */}
      <EmailCampaignModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        invoiceIds={campaignInvoiceIds}
      />
    </div>
  )
}