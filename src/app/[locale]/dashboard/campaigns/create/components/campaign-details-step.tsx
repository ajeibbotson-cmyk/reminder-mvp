'use client'

import { useCampaignStore } from '@/lib/stores/campaign-store'

export function CampaignDetailsStep() {
  const { formData, errors, updateFormData, setError } = useCampaignStore()

  const handleInputChange = (field: string, value: any) => {
    updateFormData({ [field]: value })
    // Clear error when user starts typing
    if (errors[field]) {
      setError(field, '')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Campaign Details
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Provide basic information about your campaign.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Campaign Name */}
        <div>
          <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-1">
            Campaign Name *
          </label>
          <input
            type="text"
            id="campaignName"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${errors.name ? 'border-red-300' : 'border-gray-300'}
            `}
            placeholder="e.g., Q4 2025 Invoice Reminders"
            maxLength={100}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Choose a descriptive name to identify this campaign
          </p>
        </div>

        {/* Language Selection */}
        <div>
          <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
            Email Language
          </label>
          <select
            id="language"
            value={formData.language}
            onChange={(e) => handleInputChange('language', e.target.value as 'ENGLISH' | 'ARABIC')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ENGLISH">English</option>
            <option value="ARABIC">Arabic</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Choose the language for your email templates
          </p>
        </div>

        {/* Business Hours Respect */}
        <div>
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="respectBusinessHours"
                type="checkbox"
                checked={formData.respectBusinessHours}
                onChange={(e) => handleInputChange('respectBusinessHours', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="respectBusinessHours" className="font-medium text-gray-700">
                Respect UAE Business Hours
              </label>
              <p className="text-gray-500">
                Only send emails during business hours (Sunday-Thursday, 9 AM - 6 PM GST)
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="border-t pt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            Advanced Settings
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Batch Size */}
            <div>
              <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <select
                id="batchSize"
                value={formData.batchSize}
                onChange={(e) => handleInputChange('batchSize', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={2}>2 emails per batch</option>
                <option value={5}>5 emails per batch</option>
                <option value={10}>10 emails per batch</option>
                <option value={20}>20 emails per batch</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Number of emails to send in each batch
              </p>
            </div>

            {/* Delay Between Batches */}
            <div>
              <label htmlFor="delayBetweenBatches" className="block text-sm font-medium text-gray-700 mb-1">
                Delay Between Batches
              </label>
              <select
                id="delayBetweenBatches"
                value={formData.delayBetweenBatches}
                onChange={(e) => handleInputChange('delayBetweenBatches', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1000}>1 second</option>
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Time to wait between sending batches
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Recommended settings:</strong> Use 5 emails per batch with 3-second delays for optimal delivery rates and compliance with AWS SES limits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}