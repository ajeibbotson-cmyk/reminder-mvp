"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, Mail, Clock, FileText, DollarSign, AlertTriangle, ChevronRight } from "lucide-react"
import { BucketSettingsModal } from "@/components/bucket-settings-modal"
import { toast } from "sonner"
import Link from "next/link"

interface BucketConfig {
  id: string
  bucket_id: string
  auto_send_enabled: boolean
  send_time_hour: number
  send_days_of_week: number[]
  email_template_id: string | null
  last_auto_send_at: string | null
}

interface SampleInvoice {
  id: string
  number: string
  customerName: string
  amount: number
  daysOverdue: number
  lastReminderSent: string | null
}

interface BucketData {
  id: string
  label: string
  dayRange: { min: number; max: number | null }
  count: number
  totalAmount: number
  color: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  hasUrgentCustomers: boolean
  eligibleForReminder: number
  needsReview: number
  sampleInvoices: SampleInvoice[]
}

interface BucketSummary {
  totalInvoices: number
  totalAmount: number
  overdueCount: number
  overdueAmount: number
  criticalCount: number
  eligibleForReminder: number
  needsReview: number
}

const BUCKET_COLORS: Record<string, string> = {
  "not_due": "bg-green-500",
  "overdue_1_3": "bg-yellow-500",
  "overdue_4_7": "bg-orange-500",
  "overdue_8_14": "bg-red-500",
  "overdue_15_30": "bg-purple-500",
  "overdue_30_plus": "bg-gray-700"
}

const BUCKET_NAMES: Record<string, string> = {
  "not_due": "Not Due",
  "overdue_1_3": "1-3 Days Overdue",
  "overdue_4_7": "4-7 Days Overdue",
  "overdue_8_14": "8-14 Days Overdue",
  "overdue_15_30": "15-30 Days Overdue",
  "overdue_30_plus": "30+ Days Overdue"
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function BucketsContent() {
  const [configs, setConfigs] = useState<Record<string, BucketConfig>>({})
  const [buckets, setBuckets] = useState<BucketData[]>([])
  const [summary, setSummary] = useState<BucketSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  const loadData = async () => {
    try {
      // Fetch both configs and bucket data in parallel
      const [configsResponse, bucketsResponse] = await Promise.all([
        fetch("/api/bucket-configs"),
        fetch("/api/invoices/buckets")
      ])

      // Handle configs
      if (configsResponse.ok) {
        const configsData = await configsResponse.json()
        const configsArray = configsData.configs || []
        const configsMap = configsArray.reduce((acc: Record<string, BucketConfig>, config: BucketConfig) => {
          acc[config.bucket_id] = config
          return acc
        }, {})
        setConfigs(configsMap)
      }

      // Handle buckets data
      if (bucketsResponse.ok) {
        const bucketsData = await bucketsResponse.json()
        setBuckets(bucketsData.buckets || [])
        setSummary(bucketsData.summary || null)
      }
    } catch (error) {
      console.error("Error loading bucket data:", error)
      toast.error("Failed to load bucket data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatLastSend = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    return date.toLocaleString("en-AE", {
      timeZone: "Asia/Dubai",
      dateStyle: "medium",
      timeStyle: "short"
    })
  }

  const formatDays = (days: number[]) => {
    if (days.length === 7) return "Every day"
    if (days.length === 5 && days.every(d => d >= 0 && d <= 4)) return "Weekdays"
    return days.map(d => DAYS_OF_WEEK[d]).join(", ")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded w-24 mb-2" />
                <div className="h-4 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-32" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-sm">Total Outstanding</span>
              </div>
              <div className="text-2xl font-bold">{summary.totalInvoices}</div>
              <div className="text-sm text-muted-foreground">{formatCurrency(summary.totalAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Overdue</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{summary.overdueCount}</div>
              <div className="text-sm text-muted-foreground">{formatCurrency(summary.overdueAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Ready for Reminder</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{summary.eligibleForReminder}</div>
              <div className="text-sm text-muted-foreground">No recent contact</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Needs Review</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.needsReview}</div>
              <div className="text-sm text-muted-foreground">High value, no follow-up</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bucket Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {buckets.map(bucket => {
          const config = configs[bucket.id]
          const isEnabled = config?.auto_send_enabled ?? false
          const bucketColor = BUCKET_COLORS[bucket.id] || "bg-gray-500"
          const bucketName = BUCKET_NAMES[bucket.id] || bucket.label

          return (
            <Card key={bucket.id} className={`relative ${bucket.count > 0 && bucket.priority === 'critical' ? 'border-red-300' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${bucketColor}`} />
                    <div>
                      <CardTitle className="text-lg">{bucketName}</CardTitle>
                      <CardDescription className="mt-1">
                        {bucket.dayRange.max === null
                          ? `${bucket.dayRange.min}+ days overdue`
                          : bucket.dayRange.min <= 0
                            ? "Not yet due"
                            : `${bucket.dayRange.min}-${bucket.dayRange.max} days overdue`
                        }
                      </CardDescription>
                    </div>
                  </div>
                  {bucket.priority === 'critical' && bucket.count > 0 && (
                    <Badge variant="destructive" className="text-xs">Critical</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Invoice Count and Amount */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div>
                    <div className="text-2xl font-bold">{bucket.count}</div>
                    <div className="text-xs text-muted-foreground">invoices</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatCurrency(bucket.totalAmount)}</div>
                    <div className="text-xs text-muted-foreground">total</div>
                  </div>
                </div>

                {/* Sample Invoices Preview */}
                {bucket.sampleInvoices && bucket.sampleInvoices.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Invoices</div>
                    {bucket.sampleInvoices.slice(0, 2).map(invoice => (
                      <Link
                        key={invoice.id}
                        href={`/en/dashboard/invoices/${invoice.id}`}
                        className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50 transition-colors"
                      >
                        <div className="truncate flex-1">
                          <span className="font-medium">{invoice.number}</span>
                          <span className="text-muted-foreground ml-2 truncate">{invoice.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(invoice.amount)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                    {bucket.count > 2 && (
                      <Link
                        href={`/en/dashboard/invoices?bucket=${bucket.id}`}
                        className="text-xs text-blue-600 hover:underline block text-center py-1"
                      >
                        View all {bucket.count} invoices →
                      </Link>
                    )}
                  </div>
                )}

                {bucket.count === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No invoices in this bucket
                  </div>
                )}

                {/* Auto-Send Status */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Auto-Send</span>
                  <Badge variant={isEnabled ? "default" : "secondary"}>
                    {isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {isEnabled && config && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{config.send_time_hour.toString().padStart(2, '0')}:00 UAE</span>
                      <span>•</span>
                      <span>{formatDays(config.send_days_of_week)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span>Last: {formatLastSend(config.last_auto_send_at)}</span>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedBucket(bucket.id)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedBucket && (
        <BucketSettingsModal
          open={!!selectedBucket}
          onOpenChange={(open) => !open && setSelectedBucket(null)}
          bucketId={selectedBucket}
          bucketName={BUCKET_NAMES[selectedBucket] ?? ""}
          config={configs[selectedBucket] ?? null}
          onSave={loadData}
        />
      )}
    </>
  )
}
