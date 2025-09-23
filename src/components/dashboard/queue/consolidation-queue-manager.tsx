// Sprint 3: Consolidation Queue Manager
// Real-time queue management with bulk operations

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Clock, Play, Pause, AlertCircle, CheckCircle, Filter,
  MoreVertical, Eye, Edit, Send, Calendar, ArrowUp,
  ArrowDown, Search, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AEDAmount, UAEDateDisplay } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface QueueItem {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  invoiceCount: number
  totalAmount: number
  scheduledFor?: string
  priorityScore: number
  escalationLevel: string
  status: string
  createdAt: string
  estimatedSendTime?: string
}

interface ConsolidationQueueManagerProps {
  queue: QueueItem[]
  onSelectionChange: (selectedIds: string[]) => void
  onBulkAction: (action: string, itemIds: string[]) => Promise<void>
  locale?: string
}

interface FilterOptions {
  status: string
  escalationLevel: string
  priority: string
  searchTerm: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export function ConsolidationQueueManager({
  queue,
  onSelectionChange,
  onBulkAction,
  locale = 'en'
}: ConsolidationQueueManagerProps) {
  const t = useTranslations('queueManager')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    escalationLevel: 'all',
    priority: 'all',
    searchTerm: '',
    sortBy: 'priorityScore',
    sortOrder: 'desc'
  })
  const [filteredQueue, setFilteredQueue] = useState<QueueItem[]>(queue)

  // Update parent when selection changes
  useEffect(() => {
    onSelectionChange(selectedItems)
  }, [selectedItems, onSelectionChange])

  // Apply filters and sorting
  useEffect(() => {
    let filtered = queue.filter(item => {
      // Status filter
      if (filters.status !== 'all' && item.status !== filters.status) {
        return false
      }

      // Escalation level filter
      if (filters.escalationLevel !== 'all' && item.escalationLevel !== filters.escalationLevel) {
        return false
      }

      // Priority filter
      if (filters.priority !== 'all') {
        const priority = item.priorityScore
        if (filters.priority === 'high' && priority < 80) return false
        if (filters.priority === 'medium' && (priority < 50 || priority >= 80)) return false
        if (filters.priority === 'low' && priority >= 50) return false
      }

      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        return (
          item.customerName.toLowerCase().includes(searchLower) ||
          item.customerEmail.toLowerCase().includes(searchLower) ||
          item.id.toLowerCase().includes(searchLower)
        )
      }

      return true
    })

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (filters.sortBy) {
        case 'priorityScore':
          aValue = a.priorityScore
          bValue = b.priorityScore
          break
        case 'totalAmount':
          aValue = a.totalAmount
          bValue = b.totalAmount
          break
        case 'scheduledFor':
          aValue = new Date(a.scheduledFor || a.createdAt)
          bValue = new Date(b.scheduledFor || b.createdAt)
          break
        case 'customerName':
          aValue = a.customerName
          bValue = b.customerName
          break
        default:
          aValue = a.createdAt
          bValue = b.createdAt
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredQueue(filtered)
  }, [queue, filters])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredQueue.map(item => item.id))
    } else {
      setSelectedItems([])
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId])
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId))
    }
  }

  const handleQuickAction = async (action: string, itemId: string) => {
    try {
      await onBulkAction(action, [itemId])
    } catch (error) {
      console.error('Quick action failed:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'SCHEDULED':
        return <Calendar className="h-4 w-4 text-orange-500" />
      case 'SENT':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'bg-red-500'
    if (score >= 50) return 'bg-orange-500'
    return 'bg-green-500'
  }

  const getEscalationBadgeVariant = (level: string) => {
    switch (level) {
      case 'FINAL':
        return 'destructive' as const
      case 'URGENT':
        return 'default' as const
      case 'FIRM':
        return 'secondary' as const
      default:
        return 'outline' as const
    }
  }

  const isRTL = locale === 'ar'
  const allSelected = filteredQueue.length > 0 && selectedItems.length === filteredQueue.length
  const someSelected = selectedItems.length > 0 && selectedItems.length < filteredQueue.length

  return (
    <div className={cn("space-y-6", isRTL && "text-right")}>
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('title')}
              </CardTitle>
              <CardDescription>
                {t('description', { total: queue.length, filtered: filteredQueue.length })}
              </CardDescription>
            </div>

            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('filters.search.placeholder')}
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.status.all')}</SelectItem>
                <SelectItem value="QUEUED">{t('filters.status.queued')}</SelectItem>
                <SelectItem value="SCHEDULED">{t('filters.status.scheduled')}</SelectItem>
                <SelectItem value="SENT">{t('filters.status.sent')}</SelectItem>
                <SelectItem value="FAILED">{t('filters.status.failed')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select
              value={filters.priority}
              onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.priority.all')}</SelectItem>
                <SelectItem value="high">{t('filters.priority.high')}</SelectItem>
                <SelectItem value="medium">{t('filters.priority.medium')}</SelectItem>
                <SelectItem value="low">{t('filters.priority.low')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select
              value={filters.sortBy}
              onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priorityScore">{t('filters.sortBy.priority')}</SelectItem>
                <SelectItem value="totalAmount">{t('filters.sortBy.amount')}</SelectItem>
                <SelectItem value="scheduledFor">{t('filters.sortBy.scheduled')}</SelectItem>
                <SelectItem value="customerName">{t('filters.sortBy.customer')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setFilters(prev => ({
                ...prev,
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
              }))}
            >
              {filters.sortOrder === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queue Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                ref={(ref) => {
                  if (ref) {
                    ref.indeterminate = someSelected
                  }
                }}
              />
              <span className="text-sm font-medium">
                {selectedItems.length > 0
                  ? t('selectedCount', { count: selectedItems.length })
                  : t('selectAll')
                }
              </span>
            </div>

            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onBulkAction('send', selectedItems)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t('bulkActions.send')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBulkAction('schedule', selectedItems)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {t('bulkActions.schedule')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredQueue.length > 0 ? (
              filteredQueue.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-4 p-4 border rounded-lg transition-colors",
                    selectedItems.includes(item.id)
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-gray-50"
                  )}
                >
                  {/* Selection Checkbox */}
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                  />

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(item.status)}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    {/* Customer Info */}
                    <div>
                      <div className="font-medium">{item.customerName}</div>
                      <div className="text-sm text-gray-600">{item.customerEmail}</div>
                    </div>

                    {/* Invoice Count & Amount */}
                    <div className="text-center">
                      <div className="font-medium">{item.invoiceCount}</div>
                      <div className="text-sm text-gray-600">{t('invoices')}</div>
                    </div>

                    <div className="text-center">
                      <div className="font-medium">
                        <AEDAmount amount={item.totalAmount} />
                      </div>
                      <div className="text-sm text-gray-600">{t('amount')}</div>
                    </div>

                    {/* Priority */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          getPriorityColor(item.priorityScore)
                        )} />
                        <span className="font-medium">{item.priorityScore}</span>
                      </div>
                      <div className="text-sm text-gray-600">{t('priority')}</div>
                    </div>

                    {/* Escalation & Scheduled */}
                    <div className="text-center">
                      <Badge variant={getEscalationBadgeVariant(item.escalationLevel)} className="mb-1">
                        {item.escalationLevel}
                      </Badge>
                      {item.scheduledFor && (
                        <div className="text-xs text-gray-600">
                          <UAEDateDisplay date={item.scheduledFor} format="short" />
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="text-center">
                      <Badge variant={
                        item.status === 'SENT' ? 'default' :
                        item.status === 'FAILED' ? 'destructive' :
                        'secondary'
                      }>
                        {item.status}
                      </Badge>
                      {item.estimatedSendTime && (
                        <div className="text-xs text-gray-600 mt-1">
                          {t('estimatedSend')}: <UAEDateDisplay date={item.estimatedSendTime} format="time" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.status === 'QUEUED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleQuickAction('send', item.id)}
                        title={t('quickActions.sendNow')}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      title={t('quickActions.view')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleQuickAction('send', item.id)}>
                          <Send className="h-4 w-4 mr-2" />
                          {t('quickActions.send')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleQuickAction('schedule', item.id)}>
                          <Calendar className="h-4 w-4 mr-2" />
                          {t('quickActions.schedule')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('quickActions.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleQuickAction('cancel', item.id)}
                          className="text-red-600"
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          {t('quickActions.cancel')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {filters.searchTerm || filters.status !== 'all'
                    ? t('noMatchingItems')
                    : t('noQueueItems')
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}