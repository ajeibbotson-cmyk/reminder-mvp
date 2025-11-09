'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  X,
  Mail,
  Search,
  SortAsc,
  SortDesc,
  Phone,
  FileText,
  AlertTriangle,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { useBucketDetails, formatCurrency, DetailedInvoice } from '@/hooks/use-invoice-buckets'

interface BucketDetailViewProps {
  bucketId: string
  bucketLabel: string
  onClose: () => void
  onEmailCampaign: (invoiceIds: string[]) => void
}

export function BucketDetailView({
  bucketId,
  bucketLabel,
  onClose,
  onEmailCampaign
}: BucketDetailViewProps) {
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('dueDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useBucketDetails(bucketId, {
    page,
    limit: 20,
    sortBy,
    sortOrder,
    search: searchTerm
  })

  // Memoized filtered data
  const filteredInvoices = useMemo(() => {
    if (!data?.invoices) return []
    return data.invoices
  }, [data?.invoices])

  const handleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    )
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const handleEmailCampaign = () => {
    if (selectedInvoices.length > 0) {
      onEmailCampaign(selectedInvoices)
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
  }

  const getActionBadges = (invoice: DetailedInvoice) => {
    const badges = []

    if (invoice.needsUrgentAttention) {
      badges.push(
        <Badge key="urgent" variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Urgent
        </Badge>
      )
    }

    if (invoice.isHighValue) {
      badges.push(
        <Badge key="high-value" variant="secondary" className="text-xs">
          <DollarSign className="h-3 w-3 mr-1" />
          High Value
        </Badge>
      )
    }

    if (invoice.canSendReminder) {
      badges.push(
        <Badge key="can-send" variant="outline" className="text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      )
    }

    return badges
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2">Loading bucket details...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center py-8 text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading bucket details: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl">
            {bucketLabel} - Invoice Details
          </CardTitle>
          <CardDescription>
            {selectedInvoices.length} of {data?.stats.totalInvoices || 0} invoices selected
            {data?.stats && (
              <span className="ml-2">
                • Total: {formatCurrency(data.stats.totalAmount)}
                • Avg: {formatCurrency(data.stats.averageAmount)}
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {selectedInvoices.length > 0 && (
            <Button onClick={handleEmailCampaign} className="bg-blue-600 hover:bg-blue-700">
              <Mail className="h-4 w-4 mr-2" />
              Send Reminders ({selectedInvoices.length})
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by customer name, email, or invoice number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={`${sortBy}_${sortOrder}`} onValueChange={(value) => {
            const [field, order] = value.split('_')
            setSortBy(field)
            setSortOrder(order as 'asc' | 'desc')
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate_asc">Due Date (Earliest)</SelectItem>
              <SelectItem value="dueDate_desc">Due Date (Latest)</SelectItem>
              <SelectItem value="amount_desc">Amount (High to Low)</SelectItem>
              <SelectItem value="amount_asc">Amount (Low to High)</SelectItem>
              <SelectItem value="customerName_asc">Customer (A-Z)</SelectItem>
              <SelectItem value="daysOverdue_desc">Days Overdue (Most)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.stats.eligibleForReminder}</div>
              <div className="text-sm text-gray-600">Can Send Reminder</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.stats.needsUrgentAttention}</div>
              <div className="text-sm text-gray-600">Need Attention</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.stats.highValueInvoices}</div>
              <div className="text-sm text-gray-600">High Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(data.stats.averageDaysOverdue)}d
              </div>
              <div className="text-sm text-gray-600">Avg Days Overdue</div>
            </div>
          </div>
        )}

        {/* Invoice Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('customerName')}
                >
                  <div className="flex items-center gap-2">
                    Customer {getSortIcon('customerName')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('number')}
                >
                  <div className="flex items-center gap-2">
                    Invoice {getSortIcon('number')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 text-right"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Amount {getSortIcon('amount')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-2">
                    Due Date {getSortIcon('dueDate')}
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Reminder</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className={selectedInvoices.includes(invoice.id) ? 'bg-blue-50' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedInvoices.includes(invoice.id)}
                      onCheckedChange={() => handleSelectInvoice(invoice.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.customerName}</div>
                      <div className="text-sm text-gray-500">{invoice.customerEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{invoice.number}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono font-bold">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                        {invoice.daysOverdue > 0 && (
                          <div className="text-xs text-red-600">
                            {invoice.daysOverdue} days overdue
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getActionBadges(invoice)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.lastReminderSent ? (
                      <div className="flex items-center gap-1 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div>
                          <div>{new Date(invoice.lastReminderSent).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">
                            {invoice.daysSinceLastReminder} days ago
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        Never
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!invoice.canSendReminder}
                        onClick={() => onEmailCampaign([invoice.id])}
                        title="Send Email Reminder"
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {/* Handle phone call action */}}
                        title="Call Customer"
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/invoices/${invoice.id}/pdf`)
                            const data = await response.json()
                            if (data.success) {
                              window.open(data.data.presignedUrl, '_blank')
                            } else {
                              console.error('No PDF available for this invoice')
                            }
                          } catch (error) {
                            console.error('Failed to load PDF:', error)
                          }
                        }}
                        title="View PDF Invoice"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
              {Math.min(data.pagination.page * data.pagination.limit, data.pagination.totalCount)} of{' '}
              {data.pagination.totalCount} invoices
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasPrev}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasNext}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}