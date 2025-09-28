'use client'

interface CampaignWizardStepsProps {
  currentStep: number
}

const steps = [
  {
    number: 1,
    title: 'Campaign Details',
    description: 'Basic campaign information'
  },
  {
    number: 2,
    title: 'Select Invoices',
    description: 'Choose invoices for this campaign'
  },
  {
    number: 3,
    title: 'Email Template',
    description: 'Customize email content'
  },
  {
    number: 4,
    title: 'Review & Create',
    description: 'Confirm and create campaign'
  }
]

export function CampaignWizardSteps({ currentStep }: CampaignWizardStepsProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            {/* Step Circle */}
            <div className="flex items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${
                    step.number === currentStep
                      ? 'bg-blue-600 text-white'
                      : step.number < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }
                `}
              >
                {step.number < currentStep ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {/* Step Info */}
              <div className="ml-3 hidden sm:block">
                <div
                  className={`
                    text-sm font-medium
                    ${
                      step.number === currentStep
                        ? 'text-blue-600'
                        : step.number < currentStep
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }
                  `}
                >
                  {step.title}
                </div>
                <div className="text-xs text-gray-500">
                  {step.description}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 mx-4
                  ${
                    step.number < currentStep
                      ? 'bg-green-600'
                      : 'bg-gray-200'
                  }
                `}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile-friendly step info */}
      <div className="sm:hidden mt-4 text-center">
        <div className="text-sm font-medium text-blue-600">
          {steps[currentStep - 1].title}
        </div>
        <div className="text-xs text-gray-500">
          {steps[currentStep - 1].description}
        </div>
      </div>
    </div>
  )
}