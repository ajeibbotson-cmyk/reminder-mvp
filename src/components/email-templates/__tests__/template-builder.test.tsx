import React from 'react'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateBuilder } from '../template-builder'
import { renderWithProviders } from '@/lib/test-utils'
import { uaeTestDataGenerators, templateValidationUtils, culturalComplianceUtils } from '@/lib/uae-test-utils'

// Mock the form submission
const mockOnSave = jest.fn()
const mockOnCancel = jest.fn()

// Mock modules
jest.mock('@/lib/email-service', () => ({
  validateEmailTemplate: jest.fn(() => [])
}))

describe('TemplateBuilder Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    mockOnSave.mockClear()
    mockOnCancel.mockClear()
  })

  describe('Basic Rendering', () => {
    it('renders create template form correctly', () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('Create Template')).toBeInTheDocument()
      expect(screen.getByText('Create and manage email templates')).toBeInTheDocument()
      expect(screen.getByLabelText('Template Name *')).toBeInTheDocument()
      expect(screen.getByLabelText('Template Category *')).toBeInTheDocument()
    })

    it('renders edit template form when templateId is provided', () => {
      const initialData = uaeTestDataGenerators.createUAEBusinessTemplate()
      
      renderWithProviders(
        <TemplateBuilder
          templateId="test-template-id"
          initialData={initialData}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('Edit Template')).toBeInTheDocument()
      expect(screen.getByDisplayValue(initialData.name)).toBeInTheDocument()
    })

    it('displays all required tabs', () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByRole('tab', { name: 'Basic Info' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Content' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Advanced' })).toBeInTheDocument()
    })
  })

  describe('Basic Information Tab', () => {
    it('validates required fields', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: 'Save Template' }))

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument()
      })
    })

    it('populates template content when category is selected', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Select a category
      await user.click(screen.getByRole('button', { name: /template category/i }))
      await user.click(screen.getByText('Gentle Reminder (Day 3)'))

      // Check that content gets populated
      await waitFor(() => {
        expect(screen.getByDisplayValue(/friendly payment reminder/i)).toBeInTheDocument()
      })
    })

    it('shows UAE business context alert', () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('UAE Business Context')).toBeInTheDocument()
      expect(screen.getByText(/follows UAE business etiquette/i)).toBeInTheDocument()
    })

    it('displays quick template options', () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('Quick Templates')).toBeInTheDocument()
      expect(screen.getByText('Gentle Reminder (Day 3)')).toBeInTheDocument()
      expect(screen.getByText('Professional Follow-up (Day 7)')).toBeInTheDocument()
    })

    it('applies quick template when clicked', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Click on a quick template
      const quickTemplateButton = screen.getByRole('button', { name: /gentle reminder/i })
      await user.click(quickTemplateButton)

      // Check that the form gets populated
      await waitFor(() => {
        const categorySelect = screen.getByDisplayValue(/gentle reminder/i)
        expect(categorySelect).toBeInTheDocument()
      })
    })
  })

  describe('Content Tab', () => {
    beforeEach(async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Navigate to content tab
      await user.click(screen.getByRole('tab', { name: 'Content' }))
    })

    it('shows language selector', () => {
      expect(screen.getByText('Editing Language:')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /english/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /العربية/i })).toBeInTheDocument()
    })

    it('switches between English and Arabic content', async () => {
      // Initially shows English content
      expect(screen.getByLabelText('Email Subject *')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Body *')).toBeInTheDocument()

      // Switch to Arabic
      await user.click(screen.getByRole('button', { name: /العربية/i }))

      // Should still show the same labels (translated)
      expect(screen.getByLabelText('Email Subject *')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Body *')).toBeInTheDocument()

      // Check for RTL direction
      const arabicSection = screen.getByText('العربية').closest('div')
      expect(arabicSection).toHaveAttribute('dir', 'rtl')
    })

    it('validates bilingual content requirements', async () => {
      // Fill only English content
      await user.type(screen.getByLabelText('Email Subject *'), 'Test Subject')
      await user.type(screen.getByLabelText('Email Body *'), 'Test body content')

      // Try to submit
      await user.click(screen.getByRole('button', { name: 'Save Template' }))

      await waitFor(() => {
        expect(screen.getByText('Arabic subject is required')).toBeInTheDocument()
        expect(screen.getByText('Arabic body is required')).toBeInTheDocument()
      })
    })

    it('shows proper font family for Arabic content', async () => {
      await user.click(screen.getByRole('button', { name: /العربية/i }))

      const arabicSubjectInput = screen.getByLabelText('Email Subject *')
      const arabicBodyTextarea = screen.getByLabelText('Email Body *')

      expect(arabicSubjectInput).toHaveStyle('font-family: Noto Sans Arabic, Arial Unicode MS, sans-serif')
      expect(arabicBodyTextarea).toHaveStyle('font-family: Noto Sans Arabic, Arial Unicode MS, sans-serif')
    })
  })

  describe('Variable Insertion', () => {
    beforeEach(async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.click(screen.getByRole('tab', { name: 'Content' }))
    })

    it('displays template variables sidebar', () => {
      expect(screen.getByText('Template Variables')).toBeInTheDocument()
      expect(screen.getByText('Click to insert variable')).toBeInTheDocument()
      expect(screen.getByText('Customer')).toBeInTheDocument()
      expect(screen.getByText('Invoice')).toBeInTheDocument()
      expect(screen.getByText('Company')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('shows UAE-specific variables', () => {
      expect(screen.getByText('{{customer_name}}')).toBeInTheDocument()
      expect(screen.getByText('{{customer_name_ar}}')).toBeInTheDocument()
      expect(screen.getByText('{{company_trn}}')).toBeInTheDocument()
      expect(screen.getByText('{{invoice_amount}}')).toBeInTheDocument()
      expect(screen.getByText('{{payment_link}}')).toBeInTheDocument()
    })

    it('inserts variables when clicked', async () => {
      const bodyTextarea = screen.getByLabelText('Email Body *')
      await user.click(bodyTextarea)

      // Click on a variable
      await user.click(screen.getByText('{{customer_name}}'))

      // Check that variable was inserted
      expect(bodyTextarea).toHaveValue('{{customer_name}}')
    })

    it('shows variable descriptions in current locale', () => {
      expect(screen.getByText('Customer name')).toBeInTheDocument()
      expect(screen.getByText('Invoice amount in AED')).toBeInTheDocument()
      expect(screen.getByText('Company TRN')).toBeInTheDocument()
    })
  })

  describe('Settings Tab', () => {
    beforeEach(async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.click(screen.getByRole('tab', { name: 'Settings' }))
    })

    it('shows UAE-specific settings', () => {
      expect(screen.getByText('Send only during business hours')).toBeInTheDocument()
      expect(screen.getByText(/emails will only be sent during UAE business hours/i)).toBeInTheDocument()
    })

    it('defaults to UAE timezone', () => {
      const timezoneSelect = screen.getByDisplayValue('Asia/Dubai (GMT+4)')
      expect(timezoneSelect).toBeInTheDocument()
    })

    it('shows UAE business hours information', () => {
      expect(screen.getByText(/UAE business hours: 9 AM - 6 PM/i)).toBeInTheDocument()
    })

    it('allows priority selection', async () => {
      await user.click(screen.getByRole('button', { name: /priority/i }))
      
      expect(screen.getByText('Low')).toBeInTheDocument()
      expect(screen.getByText('Normal')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument()
    })

    it('has business hours only enabled by default', () => {
      const businessHoursSwitch = screen.getByRole('switch', { name: /business hours only/i })
      expect(businessHoursSwitch).toBeChecked()
    })
  })

  describe('Advanced Tab', () => {
    beforeEach(async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.click(screen.getByRole('tab', { name: 'Advanced' }))
    })

    it('allows adding and removing tags', async () => {
      const tagInput = screen.getByPlaceholderText('Enter tag')
      const addButton = screen.getByRole('button', { name: /plus/i })

      // Add a tag
      await user.type(tagInput, 'urgent')
      await user.click(addButton)

      expect(screen.getByText('urgent')).toBeInTheDocument()

      // Remove the tag
      const removeButton = screen.getByLabelText('Remove tag urgent')
      await user.click(removeButton)

      expect(screen.queryByText('urgent')).not.toBeInTheDocument()
    })

    it('shows active template toggle', () => {
      const activeSwitch = screen.getByRole('switch', { name: /active template/i })
      expect(activeSwitch).toBeChecked() // Should be active by default
    })

    it('allows entering tags with Enter key', async () => {
      const tagInput = screen.getByPlaceholderText('Enter tag')

      await user.type(tagInput, 'professional')
      await user.keyboard('{Enter}')

      expect(screen.getByText('professional')).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('submits valid template data', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Fill required fields
      await user.type(screen.getByLabelText('Template Name *'), 'Test Template')
      
      // Navigate to content tab and fill content
      await user.click(screen.getByRole('tab', { name: 'Content' }))
      await user.type(screen.getByLabelText('Email Subject *'), 'Test Subject {{customer_name}}')
      await user.type(screen.getByLabelText('Email Body *'), 'Test body with TRN: {{company_trn}}')

      // Fill Arabic content
      await user.click(screen.getByRole('button', { name: /العربية/i }))
      await user.type(screen.getByLabelText('Email Subject *'), 'موضوع تجريبي {{customer_name_ar}}')
      await user.type(screen.getByLabelText('Email Body *'), 'محتوى تجريبي مع الرقم الضريبي: {{company_trn}}')

      // Submit
      await user.click(screen.getByRole('button', { name: 'Save Template' }))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Template',
            subjectEn: 'Test Subject {{customer_name}}',
            bodyEn: 'Test body with TRN: {{company_trn}}',
            subjectAr: 'موضوع تجريبي {{customer_name_ar}}',
            bodyAr: 'محتوى تجريبي مع الرقم الضريبي: {{company_trn}}',
            uaeBusinessHoursOnly: true
          })
        )
      })
    })

    it('shows loading state during submission', async () => {
      mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Fill minimum required fields
      await user.type(screen.getByLabelText('Template Name *'), 'Test Template')
      
      await user.click(screen.getByRole('tab', { name: 'Content' }))
      await user.type(screen.getByLabelText('Email Subject *'), 'Test Subject')
      await user.type(screen.getByLabelText('Email Body *'), 'Test body')

      await user.click(screen.getByRole('button', { name: /العربية/i }))
      await user.type(screen.getByLabelText('Email Subject *'), 'موضوع تجريبي')
      await user.type(screen.getByLabelText('Email Body *'), 'محتوى تجريبي')

      // Submit
      await user.click(screen.getByRole('button', { name: 'Save Template' }))

      // Check loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })

    it('calls onCancel when cancel button is clicked', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('UAE Cultural Compliance', () => {
    it('validates cultural appropriateness of content', async () => {
      const inappropriateTemplate = uaeTestDataGenerators.createInappropriateTemplate()
      
      renderWithProviders(
        <TemplateBuilder
          initialData={inappropriateTemplate}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      // The component should show validation errors for inappropriate content
      await user.click(screen.getByRole('tab', { name: 'Content' }))
      
      // Check if inappropriate content is detected
      const validation = culturalComplianceUtils.validateBusinessEtiquette(inappropriateTemplate.contentEn, 'en')
      expect(validation.appropriate).toBe(false)
      expect(validation.recommendations).toContain('Use formal greetings like "Dear" or "Respected"')
    })

    it('requires TRN reference in templates', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.type(screen.getByLabelText('Template Name *'), 'Test Template')
      
      await user.click(screen.getByRole('tab', { name: 'Content' }))
      await user.type(screen.getByLabelText('Email Subject *'), 'Test Subject')
      await user.type(screen.getByLabelText('Email Body *'), 'Test body without TRN') // Missing TRN

      const validation = templateValidationUtils.validateUAETemplate({
        subjectEn: 'Test Subject',
        contentEn: 'Test body without TRN',
        subjectAr: 'موضوع تجريبي',
        contentAr: 'محتوى تجريبي بدون رقم ضريبي'
      })

      expect(validation.recommendations).toContain('Include TRN reference for UAE compliance')
    })

    it('validates Arabic content quality', () => {
      const template = uaeTestDataGenerators.createUAEBusinessTemplate()
      const validation = templateValidationUtils.validateUAETemplate(template)
      
      expect(validation.valid).toBe(true)
      expect(validation.score).toBeGreaterThan(80)
    })
  })

  describe('Arabic Language Support', () => {
    it('renders Arabic interface correctly when locale is ar', () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="ar"
          companyId="test-company-id"
        />
      )

      // Check for RTL layout
      const container = screen.getByText('Create Template').closest('div')
      expect(container).toHaveClass('text-right')
    })

    it('validates Arabic text input', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.click(screen.getByRole('tab', { name: 'Content' }))
      await user.click(screen.getByRole('button', { name: /العربية/i }))

      const arabicSubject = screen.getByLabelText('Email Subject *')
      await user.type(arabicSubject, 'موضوع بالعربية')

      expect(arabicSubject).toHaveValue('موضوع بالعربية')
    })
  })

  describe('Preview Functionality', () => {
    it('shows preview button', () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByRole('button', { name: 'Show Preview' })).toBeInTheDocument()
    })

    it('toggles preview visibility', async () => {
      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getByRole('button', { name: 'Show Preview' })
      await user.click(previewButton)

      expect(screen.getByRole('button', { name: 'Hide Preview' })).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles submission errors gracefully', async () => {
      mockOnSave.mockRejectedValue(new Error('Submission failed'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      renderWithProviders(
        <TemplateBuilder
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          locale="en"
          companyId="test-company-id"
        />
      )

      await user.type(screen.getByLabelText('Template Name *'), 'Test Template')
      
      await user.click(screen.getByRole('tab', { name: 'Content' }))
      await user.type(screen.getByLabelText('Email Subject *'), 'Test Subject')
      await user.type(screen.getByLabelText('Email Body *'), 'Test body')

      await user.click(screen.getByRole('button', { name: /العربية/i }))
      await user.type(screen.getByLabelText('Email Subject *'), 'موضوع تجريبي')
      await user.type(screen.getByLabelText('Email Body *'), 'محتوى تجريبي')

      await user.click(screen.getByRole('button', { name: 'Save Template' }))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save template:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })
})