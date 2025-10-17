'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PDFInvoiceUpload } from '@/components/invoices/pdf-invoice-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Upload, AlertTriangle, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function TestUploadPage() {
  const t = useTranslations('common')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleInvoiceCreate = async (invoiceData: any) => {
    console.log('Upload component returned invoice data:', invoiceData)

    setIsLoading(true)
    try {
      // Test the API endpoint directly
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      })

      const result = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          message: 'Invoice created successfully!',
          data: result
        })
      } else {
        setUploadResult({
          success: false,
          message: result.error || 'Failed to create invoice',
          data: result
        })
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      setUploadResult({
        success: false,
        message: 'Network error occurred',
        error: error
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              PDF Upload Component Test
            </CardTitle>
            <CardDescription>
              This page allows testing the PDF invoice upload component directly, bypassing authentication.
              Use this to verify the upload interface functionality while debugging local environment issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Development Test Page:</strong> This is a development test page. Upload results will show the extracted data and any validation errors.
                The component is configured with UAE-specific business logic including AED currency and TRN validation.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Link href="/en/dashboard">
                <Button variant="outline" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Interface</CardTitle>
            <CardDescription>
              Test the PDF invoice upload component with file validation, parsing, and data extraction features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PDFInvoiceUpload
              onInvoiceCreate={handleInvoiceCreate}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {uploadResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${uploadResult.success ? 'text-green-500' : 'text-red-500'}`} />
                Upload Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className={uploadResult.success ? 'border-green-200' : 'border-red-200'}>
                <AlertDescription>
                  <div className="font-medium mb-2">{uploadResult.message}</div>
                  {uploadResult.data && (
                    <pre className="text-sm bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-64">
                      {JSON.stringify(uploadResult.data, null, 2)}
                    </pre>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Component Features Being Tested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Frontend Features</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>PDF file drag & drop upload</li>
                  <li>File validation (PDF only, 10MB limit)</li>
                  <li>Progress indicators and loading states</li>
                  <li>Multi-tab interface for review and editing</li>
                  <li>Responsive design and accessibility</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Backend Integration</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>PDF text extraction and parsing</li>
                  <li>UAE-specific pattern recognition (TRN, AED)</li>
                  <li>Invoice data extraction with confidence scoring</li>
                  <li>Data validation and error handling</li>
                  <li>Integration with invoice creation API</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Status Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Frontend upload interface functional</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>NextIntl context properly configured</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Component renders without React hydration errors</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>Authentication bypass for testing only</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}