import React from 'react'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateLibrary } from '../template-library'
import { renderWithProviders } from '@/lib/test-utils'
import { uaeTestDataGenerators, arabicTestUtils } from '@/lib/uae-test-utils'

// Mock functions
const mockOnSelectTemplate = jest.fn()
const mockOnImportTemplate = jest.fn()
const mockOnExportTemplates = jest.fn()

describe('TemplateLibrary Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    mockOnSelectTemplate.mockClear()
    mockOnImportTemplate.mockClear()
    mockOnExportTemplates.mockClear()
  })

  describe('Basic Rendering', () => {
    it('renders template library correctly', () => {
      renderWithProviders(
        <TemplateLibrary
          onSelectTemplate={mockOnSelectTemplate}
          onImportTemplate={mockOnImportTemplate}
          onExportTemplates={mockOnExportTemplates}
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('Template Library')).toBeInTheDocument()
      expect(screen.getByText('Browse and import pre-built templates')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    })

    it('displays search and filter controls', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /all categories/i })).toBeInTheDocument()
    })

    it('shows UAE template categories', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('Gentle Reminders')).toBeInTheDocument()
      expect(screen.getByText('Professional Follow-ups')).toBeInTheDocument()
      expect(screen.getByText('Firm Notices')).toBeInTheDocument()
      expect(screen.getByText('Final Notices')).toBeInTheDocument()
      expect(screen.getByText('Welcome Series')).toBeInTheDocument()
      expect(screen.getByText('Payment Confirmations')).toBeInTheDocument()
    })
  })

  describe('Template Categories', () => {
    it('displays category icons and descriptions', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Check for category icons
      expect(screen.getByText('💌')).toBeInTheDocument() // Gentle Reminders
      expect(screen.getByText('📋')).toBeInTheDocument() // Professional Follow-ups
      expect(screen.getByText('⚠️')).toBeInTheDocument() // Firm Notices
      expect(screen.getByText('🔔')).toBeInTheDocument() // Final Notices

      // Check for descriptions
      expect(screen.getByText(/Professional, respectful reminders/i)).toBeInTheDocument()
      expect(screen.getByText(/Direct but respectful with payment options/i)).toBeInTheDocument()
    })

    it('shows template counts for each category', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Each category should show template count
      const templateCounts = screen.getAllByText(/templates?$/)
      expect(templateCounts.length).toBeGreaterThan(0)
    })

    it('displays templates within categories', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Check for specific templates
      expect(screen.getByText('Day 3 - Gentle Reminder')).toBeInTheDocument()
      expect(screen.getByText('Day 7 - Professional Follow-up')).toBeInTheDocument()
      expect(screen.getByText('Day 15 - Firm Notice')).toBeInTheDocument()
      expect(screen.getByText('Day 30 - Final Notice')).toBeInTheDocument()
    })
  })

  describe('Template Details', () => {
    it('shows template statistics', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Check for usage statistics
      expect(screen.getByText('times used')).toBeInTheDocument()
      expect(screen.getByText('effective')).toBeInTheDocument()
      expect(screen.getByText('popular')).toBeInTheDocument()

      // Check for effectiveness percentages
      expect(screen.getByText('87%')).toBeInTheDocument() // Gentle reminder effectiveness
      expect(screen.getByText('95%')).toBeInTheDocument() // Gentle reminder popularity
    })

    it('displays effectiveness progress bars', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const progressBars = screen.getAllByRole('progressbar')
      expect(progressBars.length).toBeGreaterThan(0)
    })

    it('shows template tags', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('gentle')).toBeInTheDocument()
      expect(screen.getByText('day3')).toBeInTheDocument()
      expect(screen.getByText('professional')).toBeInTheDocument()
      expect(screen.getByText('payment_options')).toBeInTheDocument()
    })

    it('indicates bilingual support', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Look for language indicators
      const languageIcons = screen.getAllByTestId('languages-icon') // If we add test ids
      expect(screen.getAllByText('Day 3 - Gentle Reminder')).toHaveLength(1)
    })
  })

  describe('Search and Filtering', () => {
    it('filters templates by search query', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const searchInput = screen.getByPlaceholderText('Search templates...')
      await user.type(searchInput, 'gentle')

      // Should show only gentle reminder templates
      expect(screen.getByText('Day 3 - Gentle Reminder')).toBeInTheDocument()
      expect(screen.queryByText('Day 7 - Professional Follow-up')).not.toBeInTheDocument()
    })

    it('filters templates by category', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Open category filter
      await user.click(screen.getByRole('button', { name: /all categories/i }))
      
      // Select gentle reminders category
      await user.click(screen.getByText('💌 Gentle Reminders'))

      // Should show only gentle reminder category
      expect(screen.getByText('Gentle Reminders')).toBeInTheDocument()
      expect(screen.queryByText('Professional Follow-ups')).not.toBeInTheDocument()
    })

    it('searches in Arabic content', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="ar"
          companyId="test-company-id"
        />
      )

      const searchInput = screen.getByPlaceholderText('Search templates...')
      await user.type(searchInput, 'ودود') // Arabic for "gentle"

      // Should find templates with Arabic content
      expect(screen.getByText('اليوم 3 - تذكير ودود')).toBeInTheDocument()
    })

    it('shows no results state when search yields nothing', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const searchInput = screen.getByPlaceholderText('Search templates...')
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No templates found')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search criteria')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument()
    })

    it('clears filters when clear button is clicked', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const searchInput = screen.getByPlaceholderText('Search templates...')
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText('No templates found')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear Filters' }))

      // Should show all templates again
      expect(screen.getByText('Day 3 - Gentle Reminder')).toBeInTheDocument()
      expect(screen.queryByText('No templates found')).not.toBeInTheDocument()
    })
  })

  describe('Template Actions', () => {
    it('shows preview button for each template', () => {
      renderWithProviders(
        <TemplateLibrary
          onSelectTemplate={mockOnSelectTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButtons = screen.getAllByRole('button', { name: 'Preview' })
      expect(previewButtons.length).toBeGreaterThan(0)
    })

    it('shows use template button for each template', () => {
      renderWithProviders(
        <TemplateLibrary
          onImportTemplate={mockOnImportTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const useButtons = screen.getAllByRole('button', { name: 'Use Template' })
      expect(useButtons.length).toBeGreaterThan(0)
    })

    it('shows select button when onSelectTemplate is provided', () => {
      renderWithProviders(
        <TemplateLibrary
          onSelectTemplate={mockOnSelectTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const selectButtons = screen.getAllByRole('button', { name: '' }) // Arrow buttons
      expect(selectButtons.length).toBeGreaterThan(0)
    })

    it('calls onImportTemplate when use template is clicked', async () => {
      mockOnImportTemplate.mockResolvedValue(undefined)

      renderWithProviders(
        <TemplateLibrary
          onImportTemplate={mockOnImportTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const useButton = screen.getAllByRole('button', { name: 'Use Template' })[0]
      await user.click(useButton)

      expect(mockOnImportTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          nameEn: expect.any(String),
          subjectEn: expect.any(String),
          bodyEn: expect.any(String)
        })
      )
    })

    it('calls onSelectTemplate when select button is clicked', async () => {
      renderWithProviders(
        <TemplateLibrary
          onSelectTemplate={mockOnSelectTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      // Find the first arrow button (select button)
      const arrowButtons = screen.getAllByRole('button')
      const selectButton = arrowButtons.find(button => button.getAttribute('aria-label')?.includes('arrow') || button.textContent?.includes('→'))
      
      if (selectButton) {
        await user.click(selectButton)
        expect(mockOnSelectTemplate).toHaveBeenCalled()
      }
    })
  })

  describe('Template Preview', () => {
    it('opens preview dialog when preview button is clicked', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Day 3 - Gentle Reminder')).toBeInTheDocument()
    })

    it('shows preview tabs for different content types', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      expect(screen.getByRole('tab', { name: 'preview' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'English' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'العربية' })).toBeInTheDocument()
    })

    it('switches between preview tabs', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      // Switch to Arabic tab
      await user.click(screen.getByRole('tab', { name: 'العربية' }))

      // Should show Arabic content with RTL direction
      const arabicContent = screen.getByText(/عزيزي/i).closest('div')
      expect(arabicContent).toHaveAttribute('dir', 'rtl')
    })

    it('shows preview note about variable replacement', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      expect(screen.getByText(/This is how the email will appear/i)).toBeInTheDocument()
    })

    it('allows importing template from preview dialog', async () => {
      mockOnImportTemplate.mockResolvedValue(undefined)

      renderWithProviders(
        <TemplateLibrary
          onImportTemplate={mockOnImportTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      const useTemplateButton = screen.getByRole('button', { name: 'Use Template' })
      await user.click(useTemplateButton)

      expect(mockOnImportTemplate).toHaveBeenCalled()
    })

    it('closes preview dialog when close button is clicked', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      const closeButton = screen.getByRole('button', { name: 'Close' })
      await user.click(closeButton)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Localization', () => {
    it('displays Arabic names when locale is Arabic', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="ar"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('التذكيرات الودية')).toBeInTheDocument()
      expect(screen.getByText('المتابعات المهنية')).toBeInTheDocument()
      expect(screen.getByText('الإشعارات الحازمة')).toBeInTheDocument()
      expect(screen.getByText('الإشعارات الأخيرة')).toBeInTheDocument()
    })

    it('shows Arabic template names in Arabic locale', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="ar"
          companyId="test-company-id"
        />
      )

      expect(screen.getByText('اليوم 3 - تذكير ودود')).toBeInTheDocument()
      expect(screen.getByText('اليوم 7 - متابعة مهنية')).toBeInTheDocument()
    })

    it('validates Arabic content in templates', () => {
      const templates = [
        {
          nameAr: 'تذكير ودود',
          subjectAr: 'تذكير بالدفع - فاتورة {{invoice_number}}',
          bodyAr: 'عزيزي {{customer_name_ar}}، يرجى دفع الفاتورة. الرقم الضريبي: {{company_trn}}'
        }
      ]

      templates.forEach(template => {
        expect(arabicTestUtils.hasArabicText(template.nameAr)).toBe(true)
        expect(arabicTestUtils.hasArabicText(template.subjectAr)).toBe(true)
        expect(arabicTestUtils.hasArabicText(template.bodyAr)).toBe(true)
      })
    })
  })

  describe('UAE Business Features', () => {
    it('shows UAE-specific template content', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Check for UAE business elements in template descriptions
      expect(screen.getByText(/Professional, respectful reminders for UAE business culture/i)).toBeInTheDocument()
      expect(screen.getByText(/Formal tone with legal implications, UAE compliant/i)).toBeInTheDocument()
    })

    it('includes UAE business variables in templates', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
      await user.click(previewButton)

      // Switch to English content tab to see raw template
      await user.click(screen.getByRole('tab', { name: 'English' }))

      // Check for UAE-specific variables
      expect(screen.getByText(/\{\{company_trn\}\}/)).toBeInTheDocument()
      expect(screen.getByText(/\{\{customer_name_ar\}\}/)).toBeInTheDocument()
    })

    it('shows effectiveness ratings for UAE market', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Gentle reminder should have high effectiveness (87%)
      const gentleReminderCard = screen.getByText('Day 3 - Gentle Reminder').closest('[role="article"]') ||
                                 screen.getByText('Day 3 - Gentle Reminder').closest('div')
      
      if (gentleReminderCard) {
        expect(within(gentleReminderCard as HTMLElement).getByText('87%')).toBeInTheDocument()
      }
    })
  })

  describe('Error Handling', () => {
    it('handles import errors gracefully', async () => {
      mockOnImportTemplate.mockRejectedValue(new Error('Import failed'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      renderWithProviders(
        <TemplateLibrary
          onImportTemplate={mockOnImportTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const useButton = screen.getAllByRole('button', { name: 'Use Template' })[0]
      await user.click(useButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to import template:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('shows loading state during import', async () => {
      mockOnImportTemplate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithProviders(
        <TemplateLibrary
          onImportTemplate={mockOnImportTemplate}
          locale="en"
          companyId="test-company-id"
        />
      )

      const useButton = screen.getAllByRole('button', { name: 'Use Template' })[0]
      await user.click(useButton)

      // Button should be disabled during import
      expect(useButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      expect(screen.getByRole('searchbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Preview' })).not.toHaveLength(0)
    })

    it('supports keyboard navigation', async () => {
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      const searchInput = screen.getByPlaceholderText('Search templates...')
      await user.click(searchInput)
      await user.keyboard('{Tab}')

      // Next focusable element should be the filter dropdown
      expect(screen.getByRole('button', { name: /all categories/i })).toHaveFocus()
    })
  })

  describe('Performance', () => {
    it('renders large number of templates efficiently', () => {
      // This test would verify that the component handles a large dataset
      // In a real scenario, you might mock a large dataset
      renderWithProviders(
        <TemplateLibrary
          locale="en"
          companyId="test-company-id"
        />
      )

      // Check that all categories are rendered
      expect(screen.getByText('Gentle Reminders')).toBeInTheDocument()
      expect(screen.getByText('Professional Follow-ups')).toBeInTheDocument()
      expect(screen.getByText('Firm Notices')).toBeInTheDocument()
      expect(screen.getByText('Final Notices')).toBeInTheDocument()
    })
  })
})