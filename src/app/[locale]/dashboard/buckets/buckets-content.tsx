"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, Mail, Clock, Calendar } from "lucide-react"
import { BucketSettingsModal } from "@/components/bucket-settings-modal"
import { toast } from "sonner"

interface BucketConfig {
  id: string
  bucket_id: string
  auto_send_enabled: boolean
  send_time_hour: number
  send_days_of_week: number[]
  email_template_id: string | null
  last_auto_send_at: string | null
}

const BUCKETS = [
  {
    id: "not_due",
    name: "Not Due",
    description: "Invoices not yet due",
    color: "bg-green-500"
  },
  {
    id: "overdue_1_3",
    name: "1-3 Days Overdue",
    description: "Recently overdue invoices",
    color: "bg-yellow-500"
  },
  {
    id: "overdue_4_7",
    name: "4-7 Days Overdue",
    description: "Moderately overdue invoices",
    color: "bg-orange-500"
  },
  {
    id: "overdue_8_14",
    name: "8-14 Days Overdue",
    description: "Significantly overdue invoices",
    color: "bg-red-500"
  },
  {
    id: "overdue_15_30",
    name: "15-30 Days Overdue",
    description: "Long overdue invoices",
    color: "bg-purple-500"
  },
  {
    id: "overdue_30_plus",
    name: "30+ Days Overdue",
    description: "Very long overdue invoices",
    color: "bg-gray-500"
  },
]

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function BucketsContent() {
  const [configs, setConfigs] = useState<Record<string, BucketConfig>>({})
  const [loading, setLoading] = useState(true)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  const loadConfigs = async () => {
    try {
      const response = await fetch("/api/bucket-configs")
      if (!response.ok) throw new Error("Failed to load configs")

      const data = await response.json()
      const configsArray = data.configs || []
      const configsMap = configsArray.reduce((acc: Record<string, BucketConfig>, config: BucketConfig) => {
        acc[config.bucket_id] = config
        return acc
      }, {})

      setConfigs(configsMap)
    } catch (error) {
      console.error("Error loading bucket configs:", error)
      toast.error("Failed to load bucket configurations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
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

  if (loading) {
    return <div>Loading bucket configurations...</div>
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {BUCKETS.map(bucket => {
          const config = configs[bucket.id]
          const isEnabled = config?.auto_send_enabled ?? false

          return (
            <Card key={bucket.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                    <div>
                      <CardTitle className="text-lg">{bucket.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {bucket.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Auto-Send</span>
                  <Badge variant={isEnabled ? "default" : "secondary"}>
                    {isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {isEnabled && config && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{config.send_time_hour.toString().padStart(2, '0')}:00 UAE Time</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDays(config.send_days_of_week)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Last sent: {formatLastSend(config.last_auto_send_at)}</span>
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
          bucketName={BUCKETS.find(b => b.id === selectedBucket)?.name ?? ""}
          config={configs[selectedBucket] ?? null}
          onSave={loadConfigs}
        />
      )}
    </>
  )
}
