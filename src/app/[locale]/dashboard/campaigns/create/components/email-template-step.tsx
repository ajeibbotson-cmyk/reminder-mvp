'use client'

import { useCampaignStore } from '@/lib/stores/campaign-store'

export function EmailTemplateStep() {
  const { formData, errors, updateFormData, setError } = useCampaignStore()

  const handleInputChange = (field: string, value: string) => {
    updateFormData({ [field]: value })
    // Clear error when user starts typing
    if (errors[field]) {
      setError(field, '')
    }
  }

  const mergeFields = [
    { field: '{{customerName}}', description: 'Customer name' },
    { field: '{{invoiceNumber}}', description: 'Invoice number' },
    { field: '{{amount}}', description: 'Invoice amount in AED' },
    { field: '{{dueDate}}', description: 'Invoice due date' },
    { field: '{{daysPastDue}}', description: 'Days past due date' },
    { field: '{{companyName}}', description: 'Your company name' },
    { field: '{{customerEmail}}', description: 'Customer email address' }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Email Template
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Customize the email content that will be sent to customers. Use merge fields to personalize each email.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subject Line */}
          <div>
            <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700 mb-1">
              Email Subject *
            </label>
            <input
              type="text"
              id="emailSubject"
              value={formData.emailSubject}
              onChange={(e) => handleInputChange('emailSubject', e.target.value)}
              className={`
                w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${errors.emailSubject ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="Payment Reminder for Invoice {{invoiceNumber}}"
              maxLength={200}
            />
            {errors.emailSubject && (
              <p className="mt-1 text-sm text-red-600">{errors.emailSubject}</p>
            )}
          </div>

          {/* Email Content */}
          <div>
            <label htmlFor="emailContent" className="block text-sm font-medium text-gray-700 mb-1">
              Email Content *
            </label>
            <textarea
              id="emailContent"
              value={formData.emailContent}
              onChange={(e) => handleInputChange('emailContent', e.target.value)}
              rows={12}
              className={`
                w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${errors.emailContent ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="Dear {{customerName}},&#10;&#10;We hope this email finds you well..."
            />
            {errors.emailContent && (
              <p className="mt-1 text-sm text-red-600">{errors.emailContent}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Write a professional and respectful reminder message. Use merge fields to personalize the content.
            </p>
          </div>
        </div>

        {/* Merge Fields Reference */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Available Merge Fields
            </h4>
            <p className="text-xs text-gray-600 mb-3">
              Click any field to insert it into your email template:
            </p>
            <div className="space-y-2">
              {mergeFields.map((field) => (
                <button
                  key={field.field}
                  onClick={() => {
                    const textarea = document.getElementById('emailContent') as HTMLTextAreaElement
                    if (textarea) {
                      const start = textarea.selectionStart
                      const end = textarea.selectionEnd
                      const currentValue = formData.emailContent
                      const newValue = currentValue.substring(0, start) + field.field + currentValue.substring(end)
                      handleInputChange('emailContent', newValue)

                      // Set cursor position after the inserted field
                      setTimeout(() => {
                        textarea.focus()
                        textarea.setSelectionRange(start + field.field.length, start + field.field.length)
                      }, 0)
                    }
                  }}
                  className="w-full text-left p-2 text-xs bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-mono text-blue-600">
                    {field.field}
                  </div>
                  <div className="text-gray-500 mt-1">
                    {field.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Email Preview Tip */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Tip:</strong> Keep your message professional and respectful. Avoid overly aggressive language as it may damage customer relationships.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Language-specific notes */}
      {formData.language === 'ARABIC' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                <strong>Arabic Email Note:</strong> Ensure your email content is written in Arabic and follows UAE business communication customs. Consider cultural sensitivities around payment discussions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}