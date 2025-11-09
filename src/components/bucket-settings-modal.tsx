"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

interface BucketConfig {
  id: string
  bucket_id: string
  auto_send_enabled: boolean
  send_time_hour: number
  send_days_of_week: number[]
  email_template_id: string | null
}

interface BucketSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bucketId: string
  bucketName: string
  config: BucketConfig | null
  onSave: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`
}))

export function BucketSettingsModal({
  open,
  onOpenChange,
  bucketId,
  bucketName,
  config,
  onSave
}: BucketSettingsModalProps) {
  const [autoSendEnabled, setAutoSendEnabled] = useState(config?.auto_send_enabled ?? false)
  const [sendTimeHour, setSendTimeHour] = useState(config?.send_time_hour ?? 9)
  const [sendDaysOfWeek, setSendDaysOfWeek] = useState<number[]>(config?.send_days_of_week ?? [0, 1, 2, 3, 4])
  const [saving, setSaving] = useState(false)

  const handleDayToggle = (day: number) => {
    setSendDaysOfWeek(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const handleSave = async () => {
    if (autoSendEnabled && sendDaysOfWeek.length === 0) {
      toast.error("Please select at least one day of the week")
      return
    }

    setSaving(true)

    try {
      const response = await fetch("/api/bucket-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket_id: bucketId,
          auto_send_enabled: autoSendEnabled,
          send_time_hour: sendTimeHour,
          send_days_of_week: sendDaysOfWeek,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save settings")
      }

      toast.success("Bucket settings saved successfully")
      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving bucket settings:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{bucketName} - Auto-Send Settings</DialogTitle>
          <DialogDescription>
            Configure automatic email sending for this bucket
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-Send Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-send">Enable Auto-Send</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send payment reminders
              </p>
            </div>
            <Switch
              id="auto-send"
              checked={autoSendEnabled}
              onCheckedChange={setAutoSendEnabled}
            />
          </div>

          {autoSendEnabled && (
            <>
              {/* Send Time */}
              <div className="space-y-2">
                <Label htmlFor="send-time">Send Time (UAE Time)</Label>
                <Select
                  value={sendTimeHour.toString()}
                  onValueChange={(value) => setSendTimeHour(parseInt(value))}
                >
                  <SelectTrigger id="send-time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(hour => (
                      <SelectItem key={hour.value} value={hour.value.toString()}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Emails will be sent at this hour in UAE timezone (UTC+4)
                </p>
              </div>

              {/* Days of Week */}
              <div className="space-y-3">
                <Label>Send Days</Label>
                <div className="grid grid-cols-2 gap-3">
                  {DAYS_OF_WEEK.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={sendDaysOfWeek.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Select which days to send automatic reminders
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
