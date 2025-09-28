import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Types for campaign creation workflow
interface CampaignFormData {
  name: string
  selectedInvoiceIds: string[]
  emailSubject: string
  emailContent: string
  language: 'ENGLISH' | 'ARABIC'
  batchSize: number
  delayBetweenBatches: number
  respectBusinessHours: boolean
  scheduledFor?: Date
}

interface CampaignFormState {
  // Form data
  formData: CampaignFormData

  // UI state
  currentStep: number
  isSubmitting: boolean
  errors: Record<string, string>

  // Invoice selection state
  invoiceSearchQuery: string
  selectedInvoices: any[]
  invoiceSelectionPage: number

  // Actions
  updateFormData: (data: Partial<CampaignFormData>) => void
  setCurrentStep: (step: number) => void
  setSubmitting: (isSubmitting: boolean) => void
  setError: (field: string, error: string) => void
  clearErrors: () => void
  setInvoiceSearchQuery: (query: string) => void
  toggleInvoiceSelection: (invoiceId: string) => void
  clearInvoiceSelection: () => void
  setInvoiceSelectionPage: (page: number) => void
  resetForm: () => void
}

const initialFormData: CampaignFormData = {
  name: '',
  selectedInvoiceIds: [],
  emailSubject: 'Payment Reminder for Invoice {{invoiceNumber}}',
  emailContent: `Dear {{customerName}},

We hope this email finds you well. We are writing to remind you that payment for Invoice {{invoiceNumber}} in the amount of AED {{amount}} was due on {{dueDate}}.

If you have already made this payment, please disregard this message. If not, we would appreciate your prompt attention to this matter.

If you have any questions about this invoice or need to discuss payment arrangements, please contact us.

Thank you for your business.

Best regards,
{{companyName}}`,
  language: 'ENGLISH',
  batchSize: 5,
  delayBetweenBatches: 3000,
  respectBusinessHours: true,
}

export const useCampaignStore = create<CampaignFormState>()(
  devtools(
    (set, get) => ({
      // Initial state
      formData: initialFormData,
      currentStep: 1,
      isSubmitting: false,
      errors: {},
      invoiceSearchQuery: '',
      selectedInvoices: [],
      invoiceSelectionPage: 1,

      // Actions
      updateFormData: (data) =>
        set((state) => ({
          formData: { ...state.formData, ...data }
        }), false, 'updateFormData'),

      setCurrentStep: (step) =>
        set({ currentStep: step }, false, 'setCurrentStep'),

      setSubmitting: (isSubmitting) =>
        set({ isSubmitting }, false, 'setSubmitting'),

      setError: (field, error) =>
        set((state) => ({
          errors: { ...state.errors, [field]: error }
        }), false, 'setError'),

      clearErrors: () =>
        set({ errors: {} }, false, 'clearErrors'),

      setInvoiceSearchQuery: (query) =>
        set({
          invoiceSearchQuery: query,
          invoiceSelectionPage: 1 // Reset to first page on search
        }, false, 'setInvoiceSearchQuery'),

      toggleInvoiceSelection: (invoiceId) =>
        set((state) => {
          const isSelected = state.formData.selectedInvoiceIds.includes(invoiceId)
          const newSelectedIds = isSelected
            ? state.formData.selectedInvoiceIds.filter(id => id !== invoiceId)
            : [...state.formData.selectedInvoiceIds, invoiceId]

          return {
            formData: {
              ...state.formData,
              selectedInvoiceIds: newSelectedIds
            }
          }
        }, false, 'toggleInvoiceSelection'),

      clearInvoiceSelection: () =>
        set((state) => ({
          formData: {
            ...state.formData,
            selectedInvoiceIds: []
          }
        }), false, 'clearInvoiceSelection'),

      setInvoiceSelectionPage: (page) =>
        set({ invoiceSelectionPage: page }, false, 'setInvoiceSelectionPage'),

      resetForm: () =>
        set({
          formData: initialFormData,
          currentStep: 1,
          isSubmitting: false,
          errors: {},
          invoiceSearchQuery: '',
          selectedInvoices: [],
          invoiceSelectionPage: 1,
        }, false, 'resetForm'),
    }),
    {
      name: 'campaign-store',
    }
  )
)