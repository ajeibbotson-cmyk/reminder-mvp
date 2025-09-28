'use client'

import { useCampaignStore } from '@/lib/stores/campaign-store'
import { useInvoices } from '@/lib/api/hooks'

export function ReviewStep() {
  const { formData } = useCampaignStore()

  // Fetch selected invoices for review
  const { data: invoicesData } = useInvoices({
    limit: 1000 // Get all to show selected ones
  })

  const selectedInvoices = (invoicesData?.invoices || []).filter(inv =>
    formData.selectedInvoiceIds.includes(inv.id)
  )

  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  const estimatedDuration = Math.ceil(selectedInvoices.length / formData.batchSize) * (formData.delayBetweenBatches / 1000)
  const durationMinutes = Math.ceil(estimatedDuration / 60)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Sample email preview with mock data
  const sampleEmail = {
    subject: formData.emailSubject
      .replace('{{invoiceNumber}}', 'INV-2025-001')
      .replace('{{customerName}}', 'Ahmed Al-Mansouri')
      .replace('{{amount}}', 'AED 2,500.00')
      .replace('{{dueDate}}', '15 Jan 2025'),
    content: formData.emailContent
      .replace(/{{customerName}}/g, 'Ahmed Al-Mansouri')
      .replace(/{{invoiceNumber}}/g, 'INV-2025-001')
      .replace(/{{amount}}/g, 'AED 2,500.00')
      .replace(/{{dueDate}}/g, '15 Jan 2025')
      .replace(/{{daysPastDue}}/g, '5')
      .replace(/{{companyName}}/g, 'Your Company')
      .replace(/{{customerEmail}}/g, 'ahmed@example.com')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Review & Create Campaign
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Please review all campaign details before creating. Once created, the campaign will be ready to send.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Summary */}
        <div className="space-y-6">
          {/* Basic Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Campaign Details</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Name:</dt>
                <dd className="text-sm font-medium text-gray-900">{formData.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Language:</dt>
                <dd className="text-sm font-medium text-gray-900">{formData.language}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Business Hours:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formData.respectBusinessHours ? 'Respect UAE hours' : 'Send anytime'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Selected Invoices */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Selected Invoices</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Count:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {selectedInvoices.length} invoice{selectedInvoices.length !== 1 ? 's' : ''}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Total Amount:</dt>
                <dd className="text-sm font-medium text-gray-900">{formatCurrency(totalAmount)}</dd>
              </div>
            </dl>

            {/* Invoice List Preview */}
            {selectedInvoices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-2">Invoice preview (first 5):</p>
                <div className="space-y-1">
                  {selectedInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex justify-between text-xs">
                      <span className="text-gray-600">#{invoice.number}</span>
                      <span className="text-gray-900">{formatCurrency(invoice.amount)}</span>
                    </div>
                  ))}
                  {selectedInvoices.length > 5 && (
                    <div className="text-xs text-gray-500">
                      ...and {selectedInvoices.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sending Configuration */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Sending Configuration</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Batch Size:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formData.batchSize} emails per batch
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Batch Delay:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formData.delayBetweenBatches / 1000} seconds
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Estimated Duration:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  ~{durationMinutes} minute{durationMinutes !== 1 ? 's' : ''}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Email Preview */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">Email Preview</h4>
              <p className="text-xs text-gray-600">Sample with mock customer data</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Email Headers */}
              <div className="space-y-2">
                <div className="flex">
                  <span className="text-xs font-medium text-gray-600 w-16">From:</span>
                  <span className="text-xs text-gray-900">Your Company &lt;noreply@yourcompany.com&gt;</span>
                </div>
                <div className="flex">
                  <span className="text-xs font-medium text-gray-600 w-16">To:</span>
                  <span className="text-xs text-gray-900">Ahmed Al-Mansouri &lt;ahmed@example.com&gt;</span>
                </div>
                <div className="flex">
                  <span className="text-xs font-medium text-gray-600 w-16">Subject:</span>
                  <span className="text-xs text-gray-900">{sampleEmail.subject}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-900 whitespace-pre-wrap">
                  {sampleEmail.content}
                </div>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h5 className="text-sm font-medium text-yellow-800">Important Notes</h5>
                <div className="mt-1 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Campaigns will be created in "draft" status</li>
                    <li>You can review and edit before sending</li>
                    <li>Emails will respect UAE business hours if enabled</li>
                    <li>Progress will be tracked in real-time during sending</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}