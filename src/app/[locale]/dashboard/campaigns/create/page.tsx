'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCampaignStore } from '@/lib/stores/campaign-store'
import { useCreateCampaign } from '@/lib/api/hooks'
import { handleApiError } from '@/lib/api/client'

// Components (to be created)
import { CampaignWizardSteps } from './components/campaign-wizard-steps'
import { CampaignDetailsStep } from './components/campaign-details-step'
import { InvoiceSelectionStep } from './components/invoice-selection-step'
import { EmailTemplateStep } from './components/email-template-step'
import { ReviewStep } from './components/review-step'

export default function CreateCampaignPage() {
  const router = useRouter()
  const {
    currentStep,
    formData,
    isSubmitting,
    errors,
    setCurrentStep,
    setSubmitting,
    setError,
    clearErrors,
    resetForm
  } = useCampaignStore()

  const createCampaignMutation = useCreateCampaign()
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)

  const handleNext = () => {
    clearErrors()

    // Validate current step
    const isValid = validateCurrentStep()
    if (!isValid) return

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1: // Campaign Details
        if (!formData.name.trim()) {
          setError('name', 'Campaign name is required')
          return false
        }
        break

      case 2: // Invoice Selection
        if (formData.selectedInvoiceIds.length === 0) {
          setError('invoices', 'Please select at least one invoice')
          return false
        }
        break

      case 3: // Email Template
        if (!formData.emailSubject.trim()) {
          setError('emailSubject', 'Email subject is required')
          return false
        }
        if (!formData.emailContent.trim()) {
          setError('emailContent', 'Email content is required')
          return false
        }
        break
    }
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    clearErrors()

    try {
      const result = await createCampaignMutation.mutateAsync({
        name: formData.name,
        selectedInvoiceIds: formData.selectedInvoiceIds,
        emailSubject: formData.emailSubject,
        emailContent: formData.emailContent,
        language: formData.language,
        batchSize: formData.batchSize,
        delayBetweenBatches: formData.delayBetweenBatches,
        respectBusinessHours: formData.respectBusinessHours,
        scheduledFor: formData.scheduledFor?.toISOString(),
      })

      setCreatedCampaignId(result.campaignId)

      // Show success and redirect after a moment
      setTimeout(() => {
        resetForm()
        router.push(`/dashboard/campaigns/${result.campaignId}`)
      }, 2000)

    } catch (error) {
      const errorMessage = handleApiError(error)
      setError('submit', errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    router.push('/dashboard/campaigns')
  }

  if (createdCampaignId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-green-600 mb-2">
            Campaign Created Successfully!
          </h2>
          <p className="text-gray-600">
            Redirecting to campaign details...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Campaign
        </h1>
        <p className="text-gray-600">
          Set up an automated email campaign for invoice payment reminders
        </p>
      </div>

      {/* Progress Steps */}
      <CampaignWizardSteps currentStep={currentStep} />

      {/* Form Content */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {currentStep === 1 && <CampaignDetailsStep />}
        {currentStep === 2 && <InvoiceSelectionStep />}
        {currentStep === 3 && <EmailTemplateStep />}
        {currentStep === 4 && <ReviewStep />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Creating...
              </>
            ) : currentStep === 4 ? (
              'Create Campaign'
            ) : (
              'Next'
            )}
          </button>
        </div>
      </div>

      {/* Global Error Display */}
      {errors.submit && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-700 text-sm">
            {errors.submit}
          </div>
        </div>
      )}
    </div>
  )
}