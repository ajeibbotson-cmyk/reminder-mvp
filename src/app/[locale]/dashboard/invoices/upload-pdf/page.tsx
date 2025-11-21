'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PDFInvoiceUpload } from '@/components/invoices/pdf-invoice-upload'
import { BulkPDFUpload } from '@/components/invoices/bulk-pdf-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, FileText, Files, Zap } from 'lucide-react'

export default function PDFUploadPage() {
  const { data: session, status } = useSession()
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

  const handleBulkComplete = (results: any[]) => {
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    if (failed === 0) {
      toast.success(`All ${successful} invoices extracted successfully!`, {
        description: 'Review the results and import them to your system.'
      })
    } else {
      toast.info(`Extraction complete: ${successful} successful, ${failed} failed`, {
        description: 'Review the results below.'
      })
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
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
              Upload PDF Invoices
            </h1>
          </div>
          <p className="text-gray-600">
            Upload PDF invoices to automatically extract data using AI
          </p>
        </div>
      </div>

      {/* Upload Mode Tabs */}
      <Tabs defaultValue="bulk" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Files className="h-4 w-4" />
            <span>Bulk Upload</span>
            <Zap className="h-3 w-3 text-yellow-500" />
          </TabsTrigger>
          <TabsTrigger value="single" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Single Upload</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" className="space-y-6">
          {/* Bulk Upload Instructions */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Zap className="h-5 w-5 text-yellow-500" />
                Recommended: Bulk Upload
              </CardTitle>
              <CardDescription className="text-green-700">
                Upload all your invoices at once! Our parallel processing handles 60 PDFs in 2-3 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-white rounded-lg">
                  <div className="font-bold text-2xl text-green-600">60</div>
                  <div className="text-sm text-gray-600">Invoices per batch</div>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <div className="font-bold text-2xl text-green-600">2-3</div>
                  <div className="text-sm text-gray-600">Minutes total</div>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <div className="font-bold text-2xl text-green-600">5x</div>
                  <div className="text-sm text-gray-600">Faster than single</div>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <div className="font-bold text-2xl text-green-600">93%</div>
                  <div className="text-sm text-gray-600">Extraction accuracy</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Upload Component */}
          <BulkPDFUpload onComplete={handleBulkComplete} />
        </TabsContent>

        <TabsContent value="single" className="space-y-6">
          {/* Single Upload Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                Upload one invoice at a time with detailed review before import
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

          {/* Single PDF Upload Component */}
          <PDFInvoiceUpload
            onInvoiceCreate={handleInvoiceCreate}
            isLoading={isCreating}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
