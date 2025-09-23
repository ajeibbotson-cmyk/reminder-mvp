// Sprint 3: Customer Detail Modal with Consolidated Invoice Views
// Mobile-responsive modal for detailed customer consolidation data

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  X, Mail, DollarSign, Calendar, TrendingUp, FileText,
  Clock, CheckCircle, AlertCircle, Eye, Download,
  ArrowRight, Settings, Edit, Send
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AEDAmount, UAEDateDisplay } from '@/components/ui/uae-formatters'
import { cn } from '@/lib/utils'

interface CustomerConsolidationModalProps {
  customerId: string
  onClose: () => void
  locale?: string
}

interface CustomerData {
  id: string
  name: string
  email: string
  phone?: string
  consolidationPreference: string
  effectivenessScore: number
  totalConsolidations: number
  totalAmount: number
  avgResponseTime: number
  lastActivity: string

  // Consolidation history
  consolidations: {
    id: string
    invoiceIds: string[]
    invoiceCount: number
    totalAmount: number
    status: string
    scheduledFor?: string
    sentAt?: string
    respondedAt?: string
    paidAt?: string
    escalationLevel: string
    priorityScore: number
  }[]

  // Individual invoices that could be consolidated
  eligibleInvoices: {
    id: string
    number: string
    amount: number
    dueDate: string
    status: string
    daysPastDue?: number
  }[]

  // Analytics for this customer
  analytics: {
    emailsSaved: number
    avgConsolidationSize: number
    responseRate: number
    paymentRate: number
    preferredContactTime: string
    monthlyTrends: {
      month: string
      consolidations: number
      amount: number
      success: number
    }[]
  }
}

export function CustomerConsolidationModal({
  customerId,
  onClose,
  locale = 'en'
}: CustomerConsolidationModalProps) {
  const t = useTranslations('customerModal')
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])

  useEffect(() => {
    loadCustomerData()
  }, [customerId])

  const loadCustomerData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}/consolidation-details`)
      const data = await response.json()
      setCustomer(data.customer)
    } catch (error) {
      console.error('Failed to load customer data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateConsolidation = async () => {
    if (selectedInvoices.length < 2) return

    try {
      const response = await fetch('/api/consolidation/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          invoiceIds: selectedInvoices,
          escalationLevel: 'POLITE',
          priorityScore: 50
        })
      })

      if (response.ok) {
        await loadCustomerData()
        setSelectedInvoices([])
      }
    } catch (error) {
      console.error('Failed to create consolidation:', error)
    }
  }

  const handleSendImmediate = async (consolidationId: string) => {
    try {
      await fetch('/api/consolidation/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consolidationIds: [consolidationId] })
      })
      await loadCustomerData()
    } catch (error) {
      console.error('Failed to send consolidation:', error)
    }
  }

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>{t('loading')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!customer) {
    return null
  }

  const isRTL = locale === 'ar'

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-5xl w-[95vw] max-h-[95vh] overflow-auto",
        isRTL && "text-right"
      )}>
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg md:text-xl truncate">{customer.name}</DialogTitle>
              <DialogDescription className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-1">
                <span className="text-sm truncate">{customer.email}</span>
                {customer.phone && <span className="text-sm">{customer.phone}</span>}
                <Badge
                  variant={customer.consolidationPreference === 'ENABLED' ? 'default' : 'secondary'}
                  className="self-start md:self-auto"
                >
                  {t(`preferences.${customer.consolidationPreference.toLowerCase()}`)}
                </Badge>
              </DialogDescription>
            </div>
            <Button variant="ghost" onClick={onClose} className="flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Mobile-Optimized Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-4 md:my-6">
          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-green-600">{customer.effectivenessScore}%</div>
              <p className="text-xs md:text-sm text-gray-600">{t('effectivenessScore')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold">{customer.totalConsolidations}</div>
              <p className="text-xs md:text-sm text-gray-600">{t('totalConsolidations')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold">
                <AEDAmount amount={customer.totalAmount} />
              </div>
              <p className="text-xs md:text-sm text-gray-600">{t('totalAmount')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold">{customer.avgResponseTime}</div>
              <p className="text-xs md:text-sm text-gray-600">{t('avgResponseDays')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Mobile-Optimized Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview" className="text-xs md:text-sm px-1 md:px-3">
              <span className="hidden sm:inline">{t('tabs.overview')}</span>
              <span className="sm:hidden">{t('tabs.overviewShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="consolidations" className="text-xs md:text-sm px-1 md:px-3">
              <span className="hidden sm:inline">{t('tabs.consolidations')}</span>
              <span className="sm:hidden">{t('tabs.consolidationsShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="eligible" className="text-xs md:text-sm px-1 md:px-3">
              <span className="hidden sm:inline">{t('tabs.eligible')}</span>
              <span className="sm:hidden">{t('tabs.eligibleShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs md:text-sm px-1 md:px-3">
              <span className="hidden sm:inline">{t('tabs.analytics')}</span>
              <span className="sm:hidden">{t('tabs.analyticsShort')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('overview.preferences')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>{t('consolidationPreference')}</span>
                    <Badge variant={customer.consolidationPreference === 'ENABLED' ? 'default' : 'secondary'}>
                      {customer.consolidationPreference}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('preferredContactTime')}</span>
                    <span>{customer.analytics.preferredContactTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('lastActivity')}</span>
                    <UAEDateDisplay date={customer.lastActivity} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('overview.performance')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>{t('responseRate')}</span>
                      <span>{customer.analytics.responseRate}%</span>
                    </div>
                    <Progress value={customer.analytics.responseRate} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span>{t('paymentRate')}</span>
                      <span>{customer.analytics.paymentRate}%</span>
                    </div>
                    <Progress value={customer.analytics.paymentRate} />
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <span>{t('emailsSaved')}</span>
                      <span className="font-medium text-green-600">{customer.analytics.emailsSaved}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Consolidations History Tab */}
          <TabsContent value="consolidations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('consolidationHistory')}</h3>
              <Badge variant="outline">{customer.consolidations.length} {t('total')}</Badge>
            </div>

            <div className="space-y-3">
              {customer.consolidations.map((consolidation) => (
                <Card key={consolidation.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              consolidation.status === 'DELIVERED' ? 'default' :
                              consolidation.status === 'SENT' ? 'secondary' :
                              consolidation.status === 'QUEUED' ? 'outline' : 'destructive'
                            }>
                              {consolidation.status}
                            </Badge>
                            <Badge variant="outline">
                              {consolidation.escalationLevel}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {consolidation.invoiceCount} {t('invoices')}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="font-medium">
                            <AEDAmount amount={consolidation.totalAmount} />
                          </p>
                          <p className="text-xs text-gray-600">{t('amount')}</p>
                        </div>

                        <div className="text-center">
                          <p className="text-sm">
                            {consolidation.scheduledFor ? (
                              <UAEDateDisplay date={consolidation.scheduledFor} format="short" />
                            ) : (
                              t('immediate')
                            )}
                          </p>
                          <p className="text-xs text-gray-600">{t('scheduled')}</p>
                        </div>

                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              consolidation.priorityScore >= 80 ? "bg-red-500" :
                              consolidation.priorityScore >= 50 ? "bg-orange-500" : "bg-green-500"
                            )} />
                            <span className="text-sm">{consolidation.priorityScore}</span>
                          </div>
                          <p className="text-xs text-gray-600">{t('priority')}</p>
                        </div>

                        <div className="text-center">
                          {consolidation.respondedAt ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                          ) : consolidation.sentAt ? (
                            <Mail className="h-5 w-5 text-blue-500 mx-auto" />
                          ) : (
                            <Clock className="h-5 w-5 text-gray-400 mx-auto" />
                          )}
                          <p className="text-xs text-gray-600 mt-1">
                            {consolidation.respondedAt ? t('responded') :
                             consolidation.sentAt ? t('sent') : t('pending')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {consolidation.status === 'QUEUED' && (
                          <Button
                            size="sm"
                            onClick={() => handleSendImmediate(consolidation.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {customer.consolidations.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noConsolidations')}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Eligible Invoices Tab */}
          <TabsContent value="eligible" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('eligibleInvoices')}</h3>
              <div className="flex items-center gap-2">
                {selectedInvoices.length > 1 && (
                  <Button onClick={handleCreateConsolidation}>
                    {t('createConsolidation')} ({selectedInvoices.length})
                  </Button>
                )}
                <Badge variant="outline">
                  {customer.eligibleInvoices.length} {t('eligible')}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              {customer.eligibleInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedInvoices.includes(invoice.id) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                  )}
                  onClick={() => {
                    setSelectedInvoices(prev =>
                      prev.includes(invoice.id)
                        ? prev.filter(id => id !== invoice.id)
                        : [...prev, invoice.id]
                    )
                  }}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.includes(invoice.id)}
                      onChange={() => {}}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium">{invoice.number}</p>
                      <p className="text-sm text-gray-600">
                        {t('due')}: <UAEDateDisplay date={invoice.dueDate} format="short" />
                        {invoice.daysPastDue && (
                          <span className="text-red-600 ml-2">
                            ({invoice.daysPastDue} {t('daysPastDue')})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant={
                      invoice.status === 'PAID' ? 'default' :
                      invoice.status === 'OVERDUE' ? 'destructive' : 'secondary'
                    }>
                      {invoice.status}
                    </Badge>
                    <div className="text-right">
                      <p className="font-medium">
                        <AEDAmount amount={invoice.amount} />
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {customer.eligibleInvoices.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noEligibleInvoices')}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.monthlyTrends')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {customer.analytics.monthlyTrends.map((trend) => (
                      <div key={trend.month} className="flex items-center justify-between p-2 rounded border">
                        <span className="text-sm font-medium">{trend.month}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{trend.consolidations} {t('sent')}</span>
                          <span><AEDAmount amount={trend.amount} /></span>
                          <span className="text-green-600">{trend.success}% {t('success')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.insights')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>{t('avgConsolidationSize')}</span>
                      <span className="font-medium">{customer.analytics.avgConsolidationSize} {t('invoices')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('totalEmailsSaved')}</span>
                      <span className="font-medium text-green-600">{customer.analytics.emailsSaved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('bestContactTime')}</span>
                      <span className="font-medium">{customer.analytics.preferredContactTime}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">{t('recommendations')}</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>• {t('recommendation1')}</li>
                      <li>• {t('recommendation2')}</li>
                      <li>• {t('recommendation3')}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}