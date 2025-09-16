'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Play,
  Pause,
  Square,
  SkipForward,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Shield,
  Users,
  Calendar,
  Settings,
  RefreshCw,
  Archive,
  Trash2,
  Copy,
  Edit,
  Eye,
  MoreHorizontal
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface SequenceOverride {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  type: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  progress: {
    totalInvoices: number
    completed: number
    inProgress: number
    pending: number
  }
  nextScheduled?: Date
  canPause: boolean
  canResume: boolean
  canStop: boolean
  canSkip: boolean
  requiresAttention: boolean
  uaeCompliant: boolean
}

interface ManualOverrideControlsProps {
  sequences: SequenceOverride[]
  onBulkAction: (action: string, sequenceIds: string[], options?: any) => Promise<void>
  onSequenceAction: (sequenceId: string, action: string, options?: any) => Promise<void>
  companyId?: string
  disabled?: boolean
}

export function ManualOverrideControls({
  sequences,
  onBulkAction,
  onSequenceAction,
  companyId,
  disabled = false
}: ManualOverrideControlsProps) {
  const t = useTranslations('followUps.controls')
  const [selectedSequences, setSelectedSequences] = useState<string[]>([])
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false)
  const [bulkAction, setBulkAction] = useState<string>('')
  const [bulkOptions, setBulkOptions] = useState<any>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [globalPause, setGlobalPause] = useState(false)
  const [emergencyStop, setEmergencyStop] = useState(false)

  // Quick action functions
  const handleQuickAction = async (action: string, sequenceId?: string, options?: any) => {
    if (disabled) return

    const targetSequences = sequenceId ? [sequenceId] : selectedSequences
    if (targetSequences.length === 0) return

    setLoading(prev => ({
      ...prev,
      [sequenceId || 'bulk']: true
    }))

    try {
      if (sequenceId) {
        await onSequenceAction(sequenceId, action, options)
      } else {
        await onBulkAction(action, targetSequences, options)
      }

      if (!sequenceId) {
        setSelectedSequences([])
      }
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setLoading(prev => ({
        ...prev,
        [sequenceId || 'bulk']: false
      }))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSequences(sequences.map(s => s.id))
    } else {
      setSelectedSequences([])
    }
  }

  const handleSelectSequence = (sequenceId: string, checked: boolean) => {
    if (checked) {
      setSelectedSequences(prev => [...prev, sequenceId])
    } else {
      setSelectedSequences(prev => prev.filter(id => id !== sequenceId))
    }
  }

  const handleGlobalPause = async () => {
    setGlobalPause(!globalPause)

    if (!globalPause) {
      // Pause all active sequences
      const activeSequences = sequences
        .filter(s => s.status === 'ACTIVE')
        .map(s => s.id)

      if (activeSequences.length > 0) {
        await onBulkAction('PAUSE_ALL', activeSequences, {
          reason: 'Global pause activated',
          timestamp: new Date()
        })
      }
    } else {
      // Resume all paused sequences
      const pausedSequences = sequences
        .filter(s => s.status === 'PAUSED')
        .map(s => s.id)

      if (pausedSequences.length > 0) {
        await onBulkAction('RESUME_ALL', pausedSequences, {
          reason: 'Global pause deactivated',
          timestamp: new Date()
        })
      }
    }
  }

  const handleEmergencyStop = async () => {
    setShowEmergencyDialog(false)
    setEmergencyStop(true)

    const activeSequences = sequences
      .filter(s => s.status === 'ACTIVE' || s.status === 'PAUSED')
      .map(s => s.id)

    if (activeSequences.length > 0) {
      await onBulkAction('EMERGENCY_STOP', activeSequences, {
        reason: 'Emergency stop activated',
        timestamp: new Date(),
        requiresManualRestart: true
      })
    }
  }

  const handleBulkSchedule = async () => {
    if (selectedSequences.length === 0) return

    await onBulkAction('SCHEDULE', selectedSequences, bulkOptions)
    setShowScheduleDialog(false)
    setSelectedSequences([])
    setBulkOptions({})
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-100'
      case 'PAUSED': return 'text-yellow-600 bg-yellow-100'
      case 'COMPLETED': return 'text-blue-600 bg-blue-100'
      case 'ERROR': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'text-red-600 bg-red-100'
      case 'HIGH': return 'text-orange-600 bg-orange-100'
      case 'MEDIUM': return 'text-blue-600 bg-blue-100'
      case 'LOW': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'PAUSE': return <Pause className="h-4 w-4" />
      case 'RESUME': return <Play className="h-4 w-4" />
      case 'STOP': return <Square className="h-4 w-4" />
      case 'SKIP': return <SkipForward className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  const canPerformBulkAction = (action: string) => {
    switch (action) {
      case 'PAUSE':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return seq?.status === 'ACTIVE' && seq.canPause
        })
      case 'RESUME':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return seq?.status === 'PAUSED' && seq.canResume
        })
      case 'STOP':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return (seq?.status === 'ACTIVE' || seq?.status === 'PAUSED') && seq.canStop
        })
      default:
        return selectedSequences.length > 0
    }
  }

  return (
    <div className="space-y-6">
      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Global Override Controls
          </CardTitle>
          <CardDescription>
            Emergency controls and global sequence management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="global-pause"
                  checked={globalPause}
                  onCheckedChange={handleGlobalPause}
                  disabled={disabled}
                />
                <Label htmlFor="global-pause" className="font-medium">
                  Global Pause
                </Label>
                <Badge variant={globalPause ? "destructive" : "outline"}>
                  {globalPause ? 'All Paused' : 'Normal Operation'}
                </Badge>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={disabled || emergencyStop}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Emergency Stop
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Emergency Stop All Sequences</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will immediately stop all active and paused sequences.
                        This action cannot be undone and sequences will need to be manually restarted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEmergencyStop} className="bg-red-600 hover:bg-red-700">
                        Emergency Stop
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {emergencyStop && (
                  <Badge variant="destructive" className="animate-pulse">
                    Emergency Stop Active
                  </Badge>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-600">
              {sequences.filter(s => s.status === 'ACTIVE').length} active, {' '}
              {sequences.filter(s => s.status === 'PAUSED').length} paused
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Sequence Actions
          </CardTitle>
          <CardDescription>
            Select sequences and perform bulk operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Bulk Action Bar */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={selectedSequences.length === sequences.length && sequences.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={disabled}
                />
                <span className="text-sm font-medium">
                  {selectedSequences.length} of {sequences.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('PAUSE')}
                  disabled={disabled || !canPerformBulkAction('PAUSE') || loading.bulk}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('RESUME')}
                  disabled={disabled || !canPerformBulkAction('RESUME') || loading.bulk}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>

                <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled || selectedSequences.length === 0}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Schedule Bulk Action</DialogTitle>
                      <DialogDescription>
                        Schedule an action for {selectedSequences.length} selected sequences
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Action Type</Label>
                        <Select onValueChange={(value) => setBulkOptions({...bulkOptions, action: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PAUSE">Pause Sequences</SelectItem>
                            <SelectItem value="RESUME">Resume Sequences</SelectItem>
                            <SelectItem value="RESTART">Restart Sequences</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Schedule Time</Label>
                        <Input
                          type="datetime-local"
                          onChange={(e) => setBulkOptions({...bulkOptions, scheduleTime: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label>Reason</Label>
                        <Textarea
                          placeholder="Optional reason for this action..."
                          onChange={(e) => setBulkOptions({...bulkOptions, reason: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkSchedule}>
                        Schedule Action
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled || selectedSequences.length === 0}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleQuickAction('DUPLICATE')}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleQuickAction('ARCHIVE')}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive Selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleQuickAction('DELETE')}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Sequence List */}
            <div className="space-y-2">
              {sequences.map((sequence) => (
                <div
                  key={sequence.id}
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-lg",
                    selectedSequences.includes(sequence.id) && "bg-blue-50 border-blue-200",
                    sequence.requiresAttention && "border-orange-300 bg-orange-50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedSequences.includes(sequence.id)}
                      onCheckedChange={(checked) => handleSelectSequence(sequence.id, checked as boolean)}
                      disabled={disabled}
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{sequence.name}</h4>
                        <Badge className={getStatusColor(sequence.status)}>
                          {sequence.status}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(sequence.priority)}>
                          {sequence.priority}
                        </Badge>
                        {sequence.uaeCompliant && (
                          <Badge variant="secondary">
                            <Shield className="h-3 w-3 mr-1" />
                            UAE
                          </Badge>
                        )}
                        {sequence.requiresAttention && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Attention
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                          Progress: {sequence.progress.completed}/{sequence.progress.totalInvoices}
                        </span>
                        {sequence.nextScheduled && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Next: {new Date(sequence.nextScheduled).toLocaleTimeString('en-AE')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Individual Controls */}
                  <div className="flex items-center gap-1">
                    {sequence.canPause && sequence.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAction('PAUSE', sequence.id)}
                        disabled={disabled || loading[sequence.id]}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}

                    {sequence.canResume && sequence.status === 'PAUSED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAction('RESUME', sequence.id)}
                        disabled={disabled || loading[sequence.id]}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}

                    {sequence.canSkip && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAction('SKIP_STEP', sequence.id)}
                        disabled={disabled || loading[sequence.id]}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    )}

                    {sequence.canStop && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickAction('STOP', sequence.id)}
                        disabled={disabled || loading[sequence.id]}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}

                    {loading[sequence.id] && (
                      <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {sequences.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No sequences available for management</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* UAE Business Hours Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">UAE Business Compliance</h4>
              <p className="text-sm text-blue-700">
                All manual overrides respect UAE business hours (Sunday-Thursday, 9 AM - 6 PM)
                and Islamic holidays. Emergency actions may bypass these restrictions when necessary.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}