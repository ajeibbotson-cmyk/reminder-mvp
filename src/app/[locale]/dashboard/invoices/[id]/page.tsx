'use client'

import { useSession } from 'next-auth/react'
import { useLocale } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Separator } from "@/components/ui/separator"
import { useInvoiceStore } from '@/lib/stores/invoice-store'
import {
  Receipt,
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle,
  Pencil,
  Eye,
  FileText,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { InvoiceControls } from '@/components/invoices/invoice-controls'

export default function InvoiceDetailPage() {
  const { data: session } = useSession()
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const isRTL = locale === 'ar'

  const { getInvoiceById, updateInvoice } = useInvoiceStore()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<any>({})
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfUploadedAt, setPdfUploadedAt] = useState<Date | null>(null)

  const invoiceId = params.id as string

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      try {
        setLoading(true)
        setError(null)

        const invoiceData = getInvoiceById(invoiceId)
        if (invoiceData) {
          setInvoice(invoiceData)
          setEditedData({
            number: invoiceData.number || '',
            customerName: invoiceData.customerName || '',
            customerEmail: invoiceData.customerEmail || '',
            amount: invoiceData.amount || invoiceData.totalAmount || 0,
            currency: invoiceData.currency || 'AED',
            invoiceDate: invoiceData.createdAt ? new Date(invoiceData.createdAt).toISOString().split('T')[0] : '',
            dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate).toISOString().split('T')[0] : ''
          })
        } else {
          setError(locale === 'ar' ? 'لم يتم العثور على الفاتورة' : 'Invoice not found')
        }
      } catch (error) {
        console.error('Failed to load invoice:', error)
        setError(locale === 'ar' ? 'فشل في تحميل الفاتورة' : 'Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }

    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId, getInvoiceById, locale])

  // Load PDF preview URL
  useEffect(() => {
    const loadPdfUrl = async () => {
      if (!invoiceId) return

      setPdfLoading(true)
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/pdf`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.presignedUrl) {
            setPdfUrl(data.data.presignedUrl)
            if (data.data.uploadedAt) {
              setPdfUploadedAt(new Date(data.data.uploadedAt))
            }
          }
        }
      } catch (error) {
        console.error('Failed to load PDF URL:', error)
      } finally {
        setPdfLoading(false)
      }
    }

    loadPdfUrl()
  }, [invoiceId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateInvoice(invoiceId, {
        number: editedData.number,
        customerName: editedData.customerName,
        customerEmail: editedData.customerEmail,
        amount: parseFloat(editedData.amount) || 0,
        currency: editedData.currency,
        dueDate: new Date(editedData.dueDate)
      })

      // Update local state
      setInvoice({
        ...invoice,
        number: editedData.number,
        customerName: editedData.customerName,
        customerEmail: editedData.customerEmail,
        amount: parseFloat(editedData.amount) || 0,
        totalAmount: parseFloat(editedData.amount) || 0,
        currency: editedData.currency,
        dueDate: new Date(editedData.dueDate)
      })

      setIsEditing(false)
      toast.success(locale === 'ar' ? 'تم حفظ التغييرات' : 'Changes saved')
    } catch (error) {
      toast.error(locale === 'ar' ? 'فشل في حفظ التغييرات' : 'Failed to save changes')
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditedData((prev: any) => ({ ...prev, [field]: value }))
  }

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '-'
    try {
      const date = new Date(dateValue)
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return '-'
    }
  }

  const formatCurrency = (amount: number, currency: string = 'AED'): string => {
    return `${currency} ${new Intl.NumberFormat('en-AE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0)}`
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
          <span className="ml-3">
            {locale === 'ar' ? 'جاري تحميل الفاتورة...' : 'Loading invoice...'}
          </span>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error || (locale === 'ar' ? 'لم يتم العثور على الفاتورة' : 'Invoice not found')}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={() => router.push(`/${locale}/dashboard/invoices`)} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {locale === 'ar' ? 'العودة للفواتير' : 'Back to Invoices'}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID'

  // Field definitions matching PDF upload form
  const fields = [
    { key: 'number', label: 'Invoice Number', type: 'text' },
    { key: 'customerName', label: 'Customer Name', type: 'text' },
    { key: 'customerEmail', label: 'Email Address', type: 'email' },
    { key: 'amount', label: 'Invoice Amount', type: 'number' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
    { key: 'dueDate', label: 'Due Date', type: 'date' }
  ]

  return (
    <DashboardLayout>
      <div className={cn('space-y-6 p-6', isRTL ? 'rtl' : 'ltr')}>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Invoice #{invoice.number}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={invoice.status === 'PAID' ? 'default' : 'secondary'}>
                  {invoice.status}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/dashboard/invoices`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Invoices
            </Button>

            {isEditing ? (
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: PDF Preview */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Invoice Preview
              </CardTitle>
              <CardDescription>
                {pdfUploadedAt
                  ? `Uploaded on ${pdfUploadedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : 'Uploaded invoice PDF'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pdfLoading ? (
                <div className="flex items-center justify-center h-[500px] bg-gray-50 rounded-lg">
                  <LoadingSpinner size="lg" />
                </div>
              ) : pdfUrl ? (
                <div className="border rounded-lg overflow-hidden bg-gray-50">
                  <iframe
                    src={pdfUrl}
                    className="w-full h-[500px]"
                    title="Invoice PDF Preview"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[500px] bg-gray-50 rounded-lg text-gray-500">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p className="font-medium">No PDF available</p>
                  <p className="text-sm">This invoice doesn't have an attached PDF</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column: Details + Controls */}
          <div className="space-y-6">
            {/* Invoice Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Invoice Details
                </CardTitle>
              <CardDescription>
                {isEditing ? 'Edit invoice information' : 'Invoice information extracted from PDF'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </Label>

                    {isEditing ? (
                      <Input
                        id={field.key}
                        type={field.type === 'number' ? 'text' : field.type}
                        inputMode={field.type === 'number' ? 'decimal' : undefined}
                        value={editedData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="font-medium"
                      />
                    ) : (
                      <div className="text-base font-semibold py-2 px-3 bg-gray-50 rounded-md">
                        {field.type === 'date'
                          ? formatDate(field.key === 'invoiceDate' ? invoice.createdAt : invoice.dueDate)
                          : field.key === 'amount'
                            ? formatCurrency(invoice.amount || invoice.totalAmount, invoice.currency)
                            : invoice[field.key] || '-'
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <>
                  <Separator className="my-6" />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        // Reset to original values
                        setEditedData({
                          number: invoice.number || '',
                          customerName: invoice.customerName || '',
                          customerEmail: invoice.customerEmail || '',
                          amount: invoice.amount || invoice.totalAmount || 0,
                          currency: invoice.currency || 'AED',
                          invoiceDate: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : '',
                          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : ''
                        })
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
            </Card>

            {/* Invoice Controls Card - Pause & Dispute */}
            <InvoiceControls
              invoiceId={invoiceId}
              invoiceNumber={invoice.number}
              status={invoice.status}
              remindersPaused={invoice.remindersPaused || false}
              remindersPausedAt={invoice.remindersPausedAt}
              remindersPauseReason={invoice.remindersPauseReason}
              disputedAt={invoice.disputedAt}
              disputeReason={invoice.disputeReason}
              disputeNotes={invoice.disputeNotes}
              disputeResolvedAt={invoice.disputeResolvedAt}
              disputeResolution={invoice.disputeResolution}
              onUpdate={() => {
                // Refresh invoice data
                window.location.reload()
              }}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
