'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PDFInvoiceUpload } from '@/components/invoices/pdf-invoice-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText } from 'lucide-react'

export default function PDFUploadPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleInvoiceCreate = async (invoiceData: any) => {
    setIsCreating(true)

    try {
      // Create invoice via API
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...invoiceData,
          companyId: session?.user?.companyId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create invoice')
      }

      const result = await response.json()

      toast.success('Invoice created successfully!', {
        description: `Invoice ${invoiceData.number} has been created and added to your system.`
      })

      // Redirect to invoice list or detail page
      router.push('/dashboard/invoices')

    } catch (error) {
      console.error('Invoice creation failed:', error)
      toast.error('Failed to create invoice', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsCreating(false)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-500">Please sign in to access this page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/invoices')}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Upload PDF Invoice
            </h1>
          </div>
          <p className="text-gray-600">
            Upload a PDF invoice to automatically extract data using AI
          </p>
        </div>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            Our AI-powered system extracts invoice data from your PDF files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-primary font-bold text-lg">1</span>
              </div>
              <h3 className="font-medium mb-2">Upload PDF</h3>
              <p className="text-sm text-gray-600">
                Upload your PDF invoice file (max 10MB)
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-primary font-bold text-lg">2</span>
              </div>
              <h3 className="font-medium mb-2">AI Extraction</h3>
              <p className="text-sm text-gray-600">
                AI extracts invoice number, amounts, dates, and customer info
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-primary font-bold text-lg">3</span>
              </div>
              <h3 className="font-medium mb-2">Review & Create</h3>
              <p className="text-sm text-gray-600">
                Review extracted data, make edits, and create the invoice
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Upload Component */}
      <PDFInvoiceUpload
        onInvoiceCreate={handleInvoiceCreate}
        isLoading={isCreating}
      />
    </div>
  )
}