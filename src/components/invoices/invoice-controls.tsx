'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { PauseCircle, PlayCircle, AlertTriangle, CheckCircle, Clock, MessageSquare } from 'lucide-react'

interface InvoiceControlsProps {
  invoiceId: string
  invoiceNumber: string
  status: string
  remindersPaused: boolean
  remindersPausedAt?: string | null
  remindersPauseReason?: string | null
  disputedAt?: string | null
  disputeReason?: string | null
  disputeNotes?: string | null
  disputeResolvedAt?: string | null
  disputeResolution?: string | null
  onUpdate: () => void
}

export function InvoiceControls({
  invoiceId,
  invoiceNumber,
  status,
  remindersPaused,
  remindersPausedAt,
  remindersPauseReason,
  disputedAt,
  disputeReason,
  disputeNotes,
  disputeResolvedAt,
  disputeResolution,
  onUpdate
}: InvoiceControlsProps) {
  const [pauseLoading, setPauseLoading] = useState(false)
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState('')

  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false)
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [newDisputeReason, setNewDisputeReason] = useState('')
  const [newDisputeNotes, setNewDisputeNotes] = useState('')

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolutionText, setResolutionText] = useState('')
  const [resolvedStatus, setResolvedStatus] = useState<string>('SENT')

  const isDisputed = status === 'DISPUTED'
  const wasDisputed = disputedAt !== null && !isDisputed

  const handleTogglePause = async (shouldPause: boolean) => {
    if (shouldPause && !pauseReason.trim()) {
      setPauseDialogOpen(true)
      return
    }

    setPauseLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paused: shouldPause,
          reason: pauseReason.trim() || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      toast.success(shouldPause ? 'Reminders paused' : 'Reminders resumed')
      setPauseDialogOpen(false)
      setPauseReason('')
      onUpdate()
    } catch (error) {
      toast.error('Failed to update reminder status')
    } finally {
      setPauseLoading(false)
    }
  }

  const handleConfirmPause = async () => {
    await handleTogglePause(true)
  }

  const handleMarkDisputed = async () => {
    if (!newDisputeReason.trim()) {
      toast.error('Please provide a reason for the dispute')
      return
    }

    setDisputeLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: newDisputeReason.trim(),
          notes: newDisputeNotes.trim() || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      toast.success('Invoice marked as disputed')
      setDisputeDialogOpen(false)
      setNewDisputeReason('')
      setNewDisputeNotes('')
      onUpdate()
    } catch (error) {
      toast.error('Failed to mark invoice as disputed')
    } finally {
      setDisputeLoading(false)
    }
  }

  const handleResolveDispute = async () => {
    if (!resolutionText.trim()) {
      toast.error('Please provide a resolution')
      return
    }

    setResolveLoading(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/dispute`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: resolutionText.trim(),
          newStatus: resolvedStatus
        })
      })

      if (!response.ok) {
        throw new Error('Failed to resolve dispute')
      }

      toast.success('Dispute resolved')
      setResolveDialogOpen(false)
      setResolutionText('')
      setResolvedStatus('SENT')
      onUpdate()
    } catch (error) {
      toast.error('Failed to resolve dispute')
    } finally {
      setResolveLoading(false)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice Controls</CardTitle>
          <CardDescription>Manage reminders and dispute status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pause Reminders Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {remindersPaused ? (
                  <PauseCircle className="h-5 w-5 text-orange-500" />
                ) : (
                  <PlayCircle className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">Email Reminders</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!remindersPaused}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      setPauseDialogOpen(true)
                    } else {
                      handleTogglePause(false)
                    }
                  }}
                  disabled={pauseLoading || isDisputed}
                />
                <Badge variant={remindersPaused ? "secondary" : "default"}>
                  {remindersPaused ? 'Paused' : 'Active'}
                </Badge>
              </div>
            </div>

            {remindersPaused && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">Reminders paused</p>
                    {remindersPausedAt && (
                      <p className="text-orange-600 text-xs mt-1">
                        Since {formatDate(remindersPausedAt)}
                      </p>
                    )}
                    {remindersPauseReason && (
                      <p className="text-orange-700 mt-1">{remindersPauseReason}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isDisputed && !remindersPaused && (
              <p className="text-xs text-muted-foreground">
                Reminders are automatically paused for disputed invoices.
              </p>
            )}
          </div>

          <div className="border-t pt-4" />

          {/* Dispute Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${isDisputed ? 'text-red-500' : 'text-muted-foreground'}`} />
                <span className="font-medium">Dispute Status</span>
              </div>
              <Badge variant={isDisputed ? "destructive" : wasDisputed ? "outline" : "secondary"}>
                {isDisputed ? 'Disputed' : wasDisputed ? 'Previously Disputed' : 'No Dispute'}
              </Badge>
            </div>

            {isDisputed && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">Reason: {disputeReason}</p>
                    {disputedAt && (
                      <p className="text-red-600 text-xs mt-1">
                        Disputed on {formatDate(disputedAt)}
                      </p>
                    )}
                    {disputeNotes && (
                      <p className="text-red-700 mt-2">{disputeNotes}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResolveDialogOpen(true)}
                  className="w-full mt-2"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve Dispute
                </Button>
              </div>
            )}

            {wasDisputed && disputeResolution && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Dispute Resolved</p>
                    {disputeResolvedAt && (
                      <p className="text-green-600 text-xs mt-1">
                        Resolved on {formatDate(disputeResolvedAt)}
                      </p>
                    )}
                    <p className="text-green-700 mt-1">{disputeResolution}</p>
                  </div>
                </div>
              </div>
            )}

            {!isDisputed && status !== 'PAID' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisputeDialogOpen(true)}
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Mark as Disputed
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pause Dialog */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Reminders</DialogTitle>
            <DialogDescription>
              Stop sending payment reminders for invoice #{invoiceNumber}. You can resume them at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pauseReason">Reason (optional)</Label>
              <Input
                id="pauseReason"
                placeholder="e.g., Customer requested delay, Payment in progress..."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPause} disabled={pauseLoading}>
              {pauseLoading ? 'Pausing...' : 'Pause Reminders'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Disputed</DialogTitle>
            <DialogDescription>
              Record a dispute for invoice #{invoiceNumber}. Email reminders will continue unless paused separately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disputeReason">Dispute Reason *</Label>
              <Input
                id="disputeReason"
                placeholder="e.g., Incorrect amount, Services not received..."
                value={newDisputeReason}
                onChange={(e) => setNewDisputeReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disputeNotes">Additional Notes</Label>
              <Textarea
                id="disputeNotes"
                placeholder="Any additional details about the dispute..."
                value={newDisputeNotes}
                onChange={(e) => setNewDisputeNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkDisputed}
              disabled={disputeLoading || !newDisputeReason.trim()}
            >
              {disputeLoading ? 'Saving...' : 'Mark as Disputed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Record how this dispute was resolved for invoice #{invoiceNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution *</Label>
              <Textarea
                id="resolution"
                placeholder="Describe how the dispute was resolved..."
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newStatus">New Invoice Status</Label>
              <Select value={resolvedStatus} onValueChange={setResolvedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SENT">Sent (active)</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="WRITTEN_OFF">Written Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolveDispute}
              disabled={resolveLoading || !resolutionText.trim()}
            >
              {resolveLoading ? 'Saving...' : 'Resolve Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
