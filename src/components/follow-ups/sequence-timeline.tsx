'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Clock,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ArrowRight,
  Calendar,
  Users,
  DollarSign,
  Timer,
  Target,
  Activity,
  Filter,
  Search,
  Download,
  RefreshCw,
  MoreHorizontal,
  ExternalLink,
  Reply,
  Forward,
  Trash2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface TimelineEvent {
  id: string
  type: 'EMAIL_SENT' | 'EMAIL_OPENED' | 'EMAIL_CLICKED' | 'RESPONSE_RECEIVED' | 'PAYMENT_RECEIVED' | 'SEQUENCE_PAUSED' | 'SEQUENCE_RESUMED' | 'STEP_SKIPPED' | 'ERROR_OCCURRED'
  timestamp: Date
  sequenceId: string
  sequenceName: string
  stepOrder?: number
  stepName?: string
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  emailSubject?: string
  emailTemplate?: string
  responseDetails?: {
    message?: string
    paymentAmount?: number
    responseTime?: number
  }
  deliveryStatus: 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'PENDING'
  metadata: {
    userAgent?: string
    ipAddress?: string
    emailClient?: string
    deviceType?: string
    location?: string
  }
  uaeCompliance: {
    sentDuringBusinessHours: boolean
    respectedHolidays: boolean
    avoidedPrayerTimes: boolean
  }
}

interface SequenceTimelineProps {
  events: TimelineEvent[]
  sequenceId?: string
  invoiceId?: string
  customerId?: string
  onEventClick?: (event: TimelineEvent) => void
  onInvoiceClick?: (invoiceId: string) => void
  onCustomerClick?: (customerId: string) => void
  autoRefresh?: boolean
  refreshInterval?: number
}

export function SequenceTimeline({
  events,
  sequenceId,
  invoiceId,
  customerId,
  onEventClick,
  onInvoiceClick,
  onCustomerClick,
  autoRefresh = false,
  refreshInterval = 30000
}: SequenceTimelineProps) {
  const t = useTranslations('followUps.timeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('all')
  const [timeRangeFilter, setTimeRangeFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [groupByDate, setGroupByDate] = useState(true)

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch =
        event.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.sequenceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.emailSubject?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesEventType = eventTypeFilter === 'all' || event.type === eventTypeFilter
      const matchesDeliveryStatus = deliveryStatusFilter === 'all' || event.deliveryStatus === deliveryStatusFilter

      let matchesTimeRange = true
      if (timeRangeFilter !== 'all') {
        const now = new Date()
        const eventDate = new Date(event.timestamp)
        const hoursDiff = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60)

        switch (timeRangeFilter) {
          case '1h':
            matchesTimeRange = hoursDiff <= 1
            break
          case '24h':
            matchesTimeRange = hoursDiff <= 24
            break
          case '7d':
            matchesTimeRange = hoursDiff <= 168
            break
          case '30d':
            matchesTimeRange = hoursDiff <= 720
            break
        }
      }

      return matchesSearch && matchesEventType && matchesDeliveryStatus && matchesTimeRange
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [events, searchQuery, eventTypeFilter, deliveryStatusFilter, timeRangeFilter])

  // Group events by date if enabled
  const groupedEvents = useMemo(() => {
    if (!groupByDate) {
      return { 'All Events': filteredEvents }
    }

    const groups: Record<string, TimelineEvent[]> = {}

    filteredEvents.forEach(event => {
      const dateKey = new Date(event.timestamp).toLocaleDateString('en-AE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(event)
    })

    return groups
  }, [filteredEvents, groupByDate])

  const getEventConfig = (type: string) => {
    switch (type) {
      case 'EMAIL_SENT':
        return {
          icon: Mail,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          label: 'Email Sent'
        }
      case 'EMAIL_OPENED':
        return {
          icon: Eye,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-200',
          label: 'Email Opened'
        }
      case 'EMAIL_CLICKED':
        return {
          icon: ExternalLink,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          borderColor: 'border-purple-200',
          label: 'Link Clicked'
        }
      case 'RESPONSE_RECEIVED':
        return {
          icon: Reply,
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-200',
          label: 'Response Received'
        }
      case 'PAYMENT_RECEIVED':
        return {
          icon: DollarSign,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-200',
          label: 'Payment Received'
        }
      case 'SEQUENCE_PAUSED':
        return {
          icon: Timer,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          label: 'Sequence Paused'
        }
      case 'SEQUENCE_RESUMED':
        return {
          icon: Activity,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          label: 'Sequence Resumed'
        }
      case 'STEP_SKIPPED':
        return {
          icon: Forward,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-200',
          label: 'Step Skipped'
        }
      case 'ERROR_OCCURRED':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-200',
          label: 'Error Occurred'
        }
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-200',
          label: type
        }
    }
  }

  const getDeliveryStatusBadge = (status: string) => {
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

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event)
    setShowEventDetails(true)
    onEventClick?.(event)
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

  const exportTimeline = () => {
    // Implementation for exporting timeline data
    const csvData = filteredEvents.map(event => ({
      timestamp: event.timestamp.toISOString(),
      type: event.type,
      sequence: event.sequenceName,
      customer: event.customerName,
      invoice: event.invoiceNumber,
      deliveryStatus: event.deliveryStatus
    }))
    console.log('Exporting timeline data:', csvData)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Follow-up Timeline</h3>
          <p className="text-gray-600">
            Track the history of all follow-up activities and customer interactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGroupByDate(!groupByDate)}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{groupByDate ? 'Ungroup by date' : 'Group by date'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="outline" size="sm" onClick={exportTimeline}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {autoRefresh && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Live
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="text-sm">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Customer, invoice, or sequence..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Event Type</Label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="EMAIL_SENT">Email Sent</SelectItem>
                  <SelectItem value="EMAIL_OPENED">Email Opened</SelectItem>
                  <SelectItem value="EMAIL_CLICKED">Link Clicked</SelectItem>
                  <SelectItem value="RESPONSE_RECEIVED">Response Received</SelectItem>
                  <SelectItem value="PAYMENT_RECEIVED">Payment Received</SelectItem>
                </SelectContent>
              </Select>
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
              <Label className="text-sm">Time Range</Label>
              <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="p-6">
          {Object.entries(groupedEvents).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(groupedEvents).map(([dateGroup, events]) => (
                <div key={dateGroup}>
                  {groupByDate && events.length > 0 && (
                    <div className="flex items-center gap-4 mb-6">
                      <h4 className="font-semibold text-gray-900">{dateGroup}</h4>
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <Badge variant="outline">{events.length} events</Badge>
                    </div>
                  )}

                  <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    {/* Timeline Events */}
                    <div className="space-y-4">
                      {events.map((event, index) => {
                        const config = getEventConfig(event.type)
                        const IconComponent = config.icon

                        return (
                          <div key={event.id} className="relative flex items-start gap-4">
                            {/* Timeline Dot */}
                            <div className={cn(
                              "relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2",
                              config.bgColor,
                              config.borderColor
                            )}>
                              <IconComponent className={cn("h-5 w-5", config.color)} />
                            </div>

                            {/* Event Content */}
                            <div
                              className="flex-1 min-w-0 p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => handleEventClick(event)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{config.label}</h4>
                                    {getDeliveryStatusBadge(event.deliveryStatus)}
                                    {event.uaeCompliance.sentDuringBusinessHours && (
                                      <Badge variant="secondary" className="text-xs">
                                        UAE Hours
                                      </Badge>
                                    )}
                                  </div>

                                  <p className="text-sm text-gray-600 mb-2">
                                    {event.emailSubject && (
                                      <span className="font-medium">"{event.emailSubject}" </span>
                                    )}
                                    sent to {event.customerName} for invoice {event.invoiceNumber}
                                  </p>

                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span>Sequence: {event.sequenceName}</span>
                                    {event.stepName && <span>Step: {event.stepName}</span>}
                                    <span>{formatTimeAgo(event.timestamp)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {event.responseDetails?.paymentAmount && (
                                    <Badge className="bg-green-100 text-green-800">
                                      <DollarSign className="h-3 w-3 mr-1" />
                                      {new Intl.NumberFormat('en-AE', {
                                        style: 'currency',
                                        currency: 'AED'
                                      }).format(event.responseDetails.paymentAmount)}
                                    </Badge>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => onInvoiceClick?.(event.invoiceId)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Invoice
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => onCustomerClick?.(event.customerId)}>
                                        <Users className="h-4 w-4 mr-2" />
                                        View Customer
                                      </DropdownMenuItem>
                                      {event.type === 'EMAIL_SENT' && (
                                        <DropdownMenuItem>
                                          <Forward className="h-4 w-4 mr-2" />
                                          Resend Email
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              {/* Additional event details */}
                              {event.responseDetails?.message && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                  <p className="text-sm">
                                    <strong>Customer Response:</strong> {event.responseDetails.message}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No timeline events found</h3>
              <p className="text-gray-600">
                {searchQuery || eventTypeFilter !== 'all' || deliveryStatusFilter !== 'all'
                  ? 'Try adjusting your filters to see more events'
                  : 'Timeline events will appear here as sequences are executed'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Modal */}
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>
              Detailed information about this timeline event
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-6">
              {/* Event Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Event Type</Label>
                  <p>{getEventConfig(selectedEvent.type).label}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Timestamp</Label>
                  <p>{selectedEvent.timestamp.toLocaleString('en-AE')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Customer</Label>
                  <p>{selectedEvent.customerName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Invoice</Label>
                  <p>{selectedEvent.invoiceNumber}</p>
                </div>
              </div>

              <Separator />

              {/* Sequence Details */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Sequence Information</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600">Sequence Name</Label>
                    <p className="text-sm">{selectedEvent.sequenceName}</p>
                  </div>
                  {selectedEvent.stepName && (
                    <div>
                      <Label className="text-xs text-gray-600">Step Name</Label>
                      <p className="text-sm">{selectedEvent.stepName} (Step {selectedEvent.stepOrder})</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Details */}
              {selectedEvent.emailSubject && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Email Details</Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-gray-600">Subject</Label>
                      <p className="text-sm">{selectedEvent.emailSubject}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Delivery Status</Label>
                      <div>{getDeliveryStatusBadge(selectedEvent.deliveryStatus)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* UAE Compliance */}
              <div>
                <Label className="text-sm font-medium mb-2 block">UAE Compliance</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full mx-auto mb-1",
                      selectedEvent.uaeCompliance.sentDuringBusinessHours ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <Label className="text-xs">Business Hours</Label>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full mx-auto mb-1",
                      selectedEvent.uaeCompliance.respectedHolidays ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <Label className="text-xs">Holiday Respect</Label>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "w-3 h-3 rounded-full mx-auto mb-1",
                      selectedEvent.uaeCompliance.avoidedPrayerTimes ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <Label className="text-xs">Prayer Times</Label>
                  </div>
                </div>
              </div>

              {/* Technical Metadata */}
              {selectedEvent.metadata && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Technical Details</Label>
                  <div className="text-xs text-gray-600 space-y-1">
                    {selectedEvent.metadata.userAgent && (
                      <p><strong>User Agent:</strong> {selectedEvent.metadata.userAgent}</p>
                    )}
                    {selectedEvent.metadata.deviceType && (
                      <p><strong>Device:</strong> {selectedEvent.metadata.deviceType}</p>
                    )}
                    {selectedEvent.metadata.location && (
                      <p><strong>Location:</strong> {selectedEvent.metadata.location}</p>
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