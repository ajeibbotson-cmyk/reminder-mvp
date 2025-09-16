'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Mail,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  Users,
  Calendar,
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Reply,
  Forward,
  Trash2,
  Archive,
  Target
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface FollowUpRecord {
  id: string
  emailId: string
  sequenceId: string
  sequenceName: string
  stepOrder: number
  stepName: string
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  subject: string
  templateName?: string
  sentAt: Date
  deliveryStatus: 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'PENDING'
  openedAt?: Date
  clickedAt?: Date
  respondedAt?: Date
  responseMessage?: string
  paymentReceivedAt?: Date
  paymentAmount?: number
  errorMessage?: string
  retryCount: number
  lastRetryAt?: Date
  nextRetryAt?: Date
  tags: string[]
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  uaeCompliance: {
    sentDuringBusinessHours: boolean
    respectedHolidays: boolean
    avoidedPrayerTimes: boolean
  }
  metadata: {
    userAgent?: string
    deviceType?: string
    location?: string
    emailClient?: string
  }
}

interface FollowUpHistoryTableProps {
  records: FollowUpRecord[]
  loading?: boolean
  onRecordClick?: (record: FollowUpRecord) => void
  onInvoiceClick?: (invoiceId: string) => void
  onCustomerClick?: (customerId: string) => void
  onResendEmail?: (recordId: string) => void
  onBulkAction?: (action: string, recordIds: string[]) => void
  showFilters?: boolean
  pageSize?: number
}

type SortField = 'sentAt' | 'customerName' | 'invoiceNumber' | 'deliveryStatus' | 'priority'
type SortDirection = 'asc' | 'desc'

export function FollowUpHistoryTable({
  records,
  loading = false,
  onRecordClick,
  onInvoiceClick,
  onCustomerClick,
  onResendEmail,
  onBulkAction,
  showFilters = true,
  pageSize = 50
}: FollowUpHistoryTableProps) {
  const t = useTranslations('followUps.history')
  const [searchQuery, setSearchQuery] = useState('')
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('all')
  const [sequenceFilter, setSequenceFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dateRangeFilter, setDateRangeFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('sentAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<FollowUpRecord | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Get unique sequences for filter
  const uniqueSequences = useMemo(() => {
    const sequences = new Set(records.map(r => r.sequenceName))
    return Array.from(sequences)
  }, [records])

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records.filter(record => {
      const matchesSearch =
        record.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.sequenceName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDeliveryStatus = deliveryStatusFilter === 'all' || record.deliveryStatus === deliveryStatusFilter
      const matchesSequence = sequenceFilter === 'all' || record.sequenceName === sequenceFilter
      const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter

      let matchesDateRange = true
      if (dateRangeFilter !== 'all') {
        const now = new Date()
        const sentDate = new Date(record.sentAt)
        const daysDiff = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)

        switch (dateRangeFilter) {
          case '1d':
            matchesDateRange = daysDiff <= 1
            break
          case '7d':
            matchesDateRange = daysDiff <= 7
            break
          case '30d':
            matchesDateRange = daysDiff <= 30
            break
          case '90d':
            matchesDateRange = daysDiff <= 90
            break
        }
      }

      return matchesSearch && matchesDeliveryStatus && matchesSequence && matchesPriority && matchesDateRange
    })

    // Sort records
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'sentAt':
          aValue = new Date(a.sentAt).getTime()
          bValue = new Date(b.sentAt).getTime()
          break
        case 'customerName':
          aValue = a.customerName.toLowerCase()
          bValue = b.customerName.toLowerCase()
          break
        case 'invoiceNumber':
          aValue = a.invoiceNumber.toLowerCase()
          bValue = b.invoiceNumber.toLowerCase()
          break
        case 'deliveryStatus':
          aValue = a.deliveryStatus
          bValue = b.deliveryStatus
          break
        case 'priority':
          const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
          aValue = priorityOrder[a.priority]
          bValue = priorityOrder[b.priority]
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

    return filtered
  }, [records, searchQuery, deliveryStatusFilter, sequenceFilter, priorityFilter, dateRangeFilter, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / pageSize)
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecords(paginatedRecords.map(r => r.id))
    } else {
      setSelectedRecords([])
    }
  }

  const handleSelectRecord = (recordId: string, checked: boolean) => {
    if (checked) {
      setSelectedRecords(prev => [...prev, recordId])
    } else {
      setSelectedRecords(prev => prev.filter(id => id !== recordId))
    }
  }

  const handleRecordClick = (record: FollowUpRecord) => {
    setSelectedRecord(record)
    setShowDetails(true)
    onRecordClick?.(record)
  }

  const handleBulkAction = (action: string) => {
    if (selectedRecords.length > 0) {
      onBulkAction?.(action, selectedRecords)
      setSelectedRecords([])
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'BOUNCED':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>
      case 'BOUNCED':
        return <Badge className="bg-red-100 text-red-800">Bounced</Badge>
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="h-4 w-4 text-blue-600" /> :
      <ArrowDown className="h-4 w-4 text-blue-600" />
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

  const exportData = () => {
    const csvData = filteredAndSortedRecords.map(record => ({
      sentAt: record.sentAt.toISOString(),
      customer: record.customerName,
      email: record.customerEmail,
      invoice: record.invoiceNumber,
      subject: record.subject,
      sequence: record.sequenceName,
      step: record.stepName,
      deliveryStatus: record.deliveryStatus,
      priority: record.priority,
      opened: record.openedAt ? 'Yes' : 'No',
      clicked: record.clickedAt ? 'Yes' : 'No',
      responded: record.respondedAt ? 'Yes' : 'No'
    }))
    console.log('Exporting follow-up history:', csvData)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading follow-up history...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter Follow-up History</CardTitle>
            <CardDescription>
              Search and filter email follow-up records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2">
                <Label className="text-sm">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Customer, invoice, subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm">Delivery Status</Label>
                <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="BOUNCED">Bounced</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Sequence</Label>
                <Select value={sequenceFilter} onValueChange={setSequenceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sequences</SelectItem>
                    {uniqueSequences.map(sequence => (
                      <SelectItem key={sequence} value={sequence}>
                        {sequence}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Date Range</Label>
                <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="1d">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 3 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedRecords.length === paginatedRecords.length && paginatedRecords.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">
                {selectedRecords.length} of {filteredAndSortedRecords.length} selected
              </span>

              {selectedRecords.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction('resend')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Resend
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction('archive')}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction('delete')}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}>
                    <Target className="h-4 w-4 mr-2" />
                    {viewMode === 'table' ? 'Card View' : 'Table View'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          {paginatedRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRecords.length === paginatedRecords.length && paginatedRecords.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('sentAt')}>
                      <div className="flex items-center gap-2">
                        Sent
                        {getSortIcon('sentAt')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('customerName')}>
                      <div className="flex items-center gap-2">
                        Customer
                        {getSortIcon('customerName')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('invoiceNumber')}>
                      <div className="flex items-center gap-2">
                        Invoice
                        {getSortIcon('invoiceNumber')}
                      </div>
                    </TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sequence</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('deliveryStatus')}>
                      <div className="flex items-center gap-2">
                        Status
                        {getSortIcon('deliveryStatus')}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('priority')}>
                      <div className="flex items-center gap-2">
                        Priority
                        {getSortIcon('priority')}
                      </div>
                    </TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRecordClick(record)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRecords.includes(record.id)}
                          onCheckedChange={(checked) => handleSelectRecord(record.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatTimeAgo(record.sentAt)}</div>
                          <div className="text-xs text-gray-500">
                            {record.sentAt.toLocaleDateString('en-AE')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.customerName}</div>
                          <div className="text-sm text-gray-600">{record.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-blue-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            onInvoiceClick?.(record.invoiceId)
                          }}
                        >
                          {record.invoiceNumber}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={record.subject}>
                          {record.subject}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{record.sequenceName}</div>
                          <div className="text-xs text-gray-500">
                            Step {record.stepOrder}: {record.stepName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(record.deliveryStatus)}
                          {getStatusBadge(record.deliveryStatus)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(record.priority)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  record.openedAt ? "bg-green-500" : "bg-gray-300"
                                )}></div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{record.openedAt ? 'Opened' : 'Not opened'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  record.clickedAt ? "bg-blue-500" : "bg-gray-300"
                                )}></div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{record.clickedAt ? 'Clicked' : 'Not clicked'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  record.respondedAt ? "bg-orange-500" : "bg-gray-300"
                                )}></div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{record.respondedAt ? 'Responded' : 'No response'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {record.paymentReceivedAt && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <DollarSign className="h-3 w-3 text-green-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Payment received</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleRecordClick(record)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onResendEmail?.(record.id)}>
                              <Forward className="h-4 w-4 mr-2" />
                              Resend Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onCustomerClick?.(record.customerId)}>
                              <Users className="h-4 w-4 mr-2" />
                              View Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onInvoiceClick?.(record.invoiceId)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Invoice
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No follow-up records found</h3>
              <p className="text-gray-600">
                {searchQuery || deliveryStatusFilter !== 'all' || sequenceFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Follow-up emails will appear here once sequences are executed'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredAndSortedRecords.length)} of {filteredAndSortedRecords.length} records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Record Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Follow-up Email Details</DialogTitle>
            <DialogDescription>
              Detailed information about this follow-up email
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6">
              {/* Email Information */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">Subject</Label>
                  <p className="text-sm mt-1">{selectedRecord.subject}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Sent At</Label>
                  <p className="text-sm mt-1">{selectedRecord.sentAt.toLocaleString('en-AE')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Customer</Label>
                  <p className="text-sm mt-1">{selectedRecord.customerName}</p>
                  <p className="text-xs text-gray-600">{selectedRecord.customerEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Invoice</Label>
                  <p className="text-sm mt-1">{selectedRecord.invoiceNumber}</p>
                </div>
              </div>

              <Separator />

              {/* Sequence Information */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Sequence Information</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600">Sequence</Label>
                    <p className="text-sm">{selectedRecord.sequenceName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Step</Label>
                    <p className="text-sm">Step {selectedRecord.stepOrder}: {selectedRecord.stepName}</p>
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Engagement Metrics</Label>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600">Delivered</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedRecord.deliveryStatus)}
                      <span className="text-sm">{selectedRecord.deliveryStatus}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Opened</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedRecord.openedAt ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">
                        {selectedRecord.openedAt ? formatTimeAgo(selectedRecord.openedAt) : 'Not opened'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Clicked</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedRecord.clickedAt ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">
                        {selectedRecord.clickedAt ? formatTimeAgo(selectedRecord.clickedAt) : 'Not clicked'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Responded</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedRecord.respondedAt ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">
                        {selectedRecord.respondedAt ? formatTimeAgo(selectedRecord.respondedAt) : 'No response'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Response and Payment */}
              {(selectedRecord.responseMessage || selectedRecord.paymentReceivedAt) && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Customer Response</Label>
                  {selectedRecord.responseMessage && (
                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                      <p className="text-sm">{selectedRecord.responseMessage}</p>
                    </div>
                  )}
                  {selectedRecord.paymentReceivedAt && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <DollarSign className="h-4 w-4" />
                      <span>
                        Payment of {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(selectedRecord.paymentAmount || 0)}
                        received {formatTimeAgo(selectedRecord.paymentReceivedAt)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* UAE Compliance */}
              <div>
                <Label className="text-sm font-medium mb-2 block">UAE Compliance</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full mx-auto mb-1",
                      selectedRecord.uaeCompliance.sentDuringBusinessHours ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <Label className="text-xs">Business Hours</Label>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full mx-auto mb-1",
                      selectedRecord.uaeCompliance.respectedHolidays ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <Label className="text-xs">Holiday Respect</Label>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full mx-auto mb-1",
                      selectedRecord.uaeCompliance.avoidedPrayerTimes ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <Label className="text-xs">Prayer Times</Label>
                  </div>
                </div>
              </div>

              {/* Error Information */}
              {selectedRecord.errorMessage && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Error Information</Label>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <p className="text-sm text-red-800">{selectedRecord.errorMessage}</p>
                    {selectedRecord.retryCount > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Retried {selectedRecord.retryCount} times
                        {selectedRecord.nextRetryAt && (
                          <span> • Next retry: {selectedRecord.nextRetryAt.toLocaleString('en-AE')}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}