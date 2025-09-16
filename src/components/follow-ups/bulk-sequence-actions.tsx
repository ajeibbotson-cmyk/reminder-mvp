'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Play,
  Pause,
  Square,
  Copy,
  Archive,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  Target,
  Calendar,
  Settings,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Edit,
  Eye,
  Mail,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface BulkSequence {
  id: string
  name: string
  type: string
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR' | 'DRAFT'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  progress: {
    totalInvoices: number
    completed: number
    inProgress: number
    pending: number
  }
  lastActivity: Date
  createdAt: Date
  updatedAt: Date
  active: boolean
  canEdit: boolean
  canDelete: boolean
  canDuplicate: boolean
  uaeCompliant: boolean
}

interface BulkOperationStatus {
  id: string
  operation: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  progress: number
  message?: string
  affectedSequences: number
  startedAt: Date
  completedAt?: Date
  errors?: string[]
}

interface BulkSequenceActionsProps {
  sequences: BulkSequence[]
  onBulkAction: (action: string, sequenceIds: string[], options?: any) => Promise<void>
  onImportSequences: (file: File) => Promise<void>
  onExportSequences: (sequenceIds: string[]) => Promise<void>
  disabled?: boolean
  companyId?: string
}

export function BulkSequenceActions({
  sequences,
  onBulkAction,
  onImportSequences,
  onExportSequences,
  disabled = false,
  companyId
}: BulkSequenceActionsProps) {
  const t = useTranslations('followUps.bulk')
  const [selectedSequences, setSelectedSequences] = useState<string[]>([])
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [bulkAction, setBulkAction] = useState<string>('')
  const [bulkOptions, setBulkOptions] = useState<any>({})
  const [operations, setOperations] = useState<BulkOperationStatus[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'lastActivity'>('lastActivity')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Filter and sort sequences
  const filteredSequences = sequences.filter(sequence => {
    const matchesSearch = sequence.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || sequence.status === statusFilter
    const matchesType = typeFilter === 'all' || sequence.type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  }).sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'status':
        aValue = a.status
        bValue = b.status
        break
      case 'lastActivity':
        aValue = new Date(a.lastActivity).getTime()
        bValue = new Date(b.lastActivity).getTime()
        break
      default:
        return 0
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSequences(filteredSequences.map(s => s.id))
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

  const handleBulkAction = async (action: string, options?: any) => {
    if (selectedSequences.length === 0) return

    const operationId = `bulk-${Date.now()}`
    const newOperation: BulkOperationStatus = {
      id: operationId,
      operation: action,
      status: 'IN_PROGRESS',
      progress: 0,
      affectedSequences: selectedSequences.length,
      startedAt: new Date()
    }

    setOperations(prev => [...prev, newOperation])

    try {
      await onBulkAction(action, selectedSequences, options)

      setOperations(prev =>
        prev.map(op =>
          op.id === operationId
            ? { ...op, status: 'COMPLETED', progress: 100, completedAt: new Date() }
            : op
        )
      )

      setSelectedSequences([])
      setShowBulkDialog(false)
    } catch (error) {
      setOperations(prev =>
        prev.map(op =>
          op.id === operationId
            ? {
                ...op,
                status: 'FAILED',
                message: error instanceof Error ? error.message : 'Operation failed',
                completedAt: new Date()
              }
            : op
        )
      )
    }
  }

  const handleScheduledAction = async () => {
    await handleBulkAction('SCHEDULE', bulkOptions)
    setShowScheduleDialog(false)
    setBulkOptions({})
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await onImportSequences(file)
      setShowImportDialog(false)
    } catch (error) {
      console.error('Import failed:', error)
    }
  }

  const handleExport = async () => {
    if (selectedSequences.length === 0) return

    try {
      await onExportSequences(selectedSequences)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Play className="h-4 w-4 text-green-600" />
      case 'PAUSED':
        return <Pause className="h-4 w-4 text-yellow-600" />
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'DRAFT':
        return <Target className="h-4 w-4 text-gray-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'PAUSED':
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>
      case 'COMPLETED':
        return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>
      case 'ERROR':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>
      case 'DRAFT':
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>
      case 'HIGH':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>
      case 'MEDIUM':
        return <Badge className="bg-blue-100 text-blue-800">Medium</Badge>
      case 'LOW':
        return <Badge className="bg-gray-100 text-gray-800">Low</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  const canPerformAction = (action: string) => {
    switch (action) {
      case 'ACTIVATE':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return seq && !seq.active
        })
      case 'PAUSE':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return seq && seq.active && seq.status === 'ACTIVE'
        })
      case 'DUPLICATE':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return seq && seq.canDuplicate
        })
      case 'DELETE':
        return selectedSequences.some(id => {
          const seq = sequences.find(s => s.id === id)
          return seq && seq.canDelete
        })
      default:
        return selectedSequences.length > 0
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Sequence Management
          </CardTitle>
          <CardDescription>
            Manage multiple sequences with bulk actions and operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="text-sm">Search</Label>
              <Input
                placeholder="Search sequences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="GENTLE_COLLECTION">Gentle Collection</SelectItem>
                  <SelectItem value="PROFESSIONAL_STANDARD">Professional Standard</SelectItem>
                  <SelectItem value="FIRM_RECOVERY">Firm Recovery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Sort By</Label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="lastActivity">Last Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setTypeFilter('all')
                  setSortBy('lastActivity')
                  setSortDirection('desc')
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedSequences.length === filteredSequences.length && filteredSequences.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={disabled}
              />
              <span className="text-sm font-medium">
                {selectedSequences.length} of {filteredSequences.length} selected
              </span>

              {selectedSequences.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('ACTIVATE')}
                    disabled={disabled || !canPerformAction('ACTIVATE')}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Activate
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('PAUSE')}
                    disabled={disabled || !canPerformAction('PAUSE')}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('DUPLICATE')}
                    disabled={disabled || !canPerformAction('DUPLICATE')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </Button>

                  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={disabled || selectedSequences.length === 0}>
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
                              <SelectItem value="ACTIVATE">Activate Sequences</SelectItem>
                              <SelectItem value="PAUSE">Pause Sequences</SelectItem>
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
                        <Button onClick={handleScheduledAction}>
                          Schedule Action
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={selectedSequences.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Sequences</DialogTitle>
                    <DialogDescription>
                      Upload a CSV or JSON file containing sequence configurations
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Select File</Label>
                      <Input
                        type="file"
                        accept=".csv,.json"
                        onChange={handleImport}
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Supported formats: CSV, JSON</p>
                      <p>File should include sequence name, type, steps, and configuration</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selectedSequences.length === 0}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkAction('ARCHIVE')}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive Selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleBulkAction('DELETE')}
                    className="text-red-600"
                    disabled={!canPerformAction('DELETE')}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sequence List */}
      <Card>
        <CardContent className="p-0">
          {filteredSequences.length > 0 ? (
            <div className="divide-y">
              {filteredSequences.map((sequence) => (
                <div key={sequence.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedSequences.includes(sequence.id)}
                      onCheckedChange={(checked) => handleSelectSequence(sequence.id, checked as boolean)}
                      disabled={disabled}
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{sequence.name}</h4>
                        {getStatusBadge(sequence.status)}
                        {getPriorityBadge(sequence.priority)}
                        {sequence.uaeCompliant && (
                          <Badge variant="secondary" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            UAE
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Type:</span> {sequence.type}
                        </div>
                        <div>
                          <span className="font-medium">Progress:</span>{' '}
                          {sequence.progress.completed}/{sequence.progress.totalInvoices}
                        </div>
                        <div>
                          <span className="font-medium">Last Activity:</span>{' '}
                          {formatTimeAgo(sequence.lastActivity)}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {sequence.createdAt.toLocaleDateString('en-AE')}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2">
                        <Progress
                          value={(sequence.progress.completed / sequence.progress.totalInvoices) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" disabled={!sequence.canEdit}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" disabled={!sequence.canDuplicate}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!sequence.canDelete}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No sequences found</h3>
              <p className="text-gray-600">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create some sequences to manage them in bulk'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operation Status */}
      {operations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Bulk Operations Status
            </CardTitle>
            <CardDescription>
              Monitor the progress of bulk operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {operations.slice(-3).map((operation) => (
                <div key={operation.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{operation.operation}</h4>
                      <Badge
                        variant={
                          operation.status === 'COMPLETED'
                            ? 'default'
                            : operation.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {operation.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-600">
                      {operation.affectedSequences} sequences
                    </span>
                  </div>

                  {operation.status === 'IN_PROGRESS' && (
                    <Progress value={operation.progress} className="mb-2" />
                  )}

                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Started: {operation.startedAt.toLocaleTimeString('en-AE')}</span>
                    {operation.completedAt && (
                      <span>Completed: {operation.completedAt.toLocaleTimeString('en-AE')}</span>
                    )}
                  </div>

                  {operation.message && (
                    <p className="text-sm mt-2 text-red-600">{operation.message}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}