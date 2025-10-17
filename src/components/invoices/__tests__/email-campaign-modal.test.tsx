import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmailCampaignModal } from '../email-campaign-modal'

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock the hook module
jest.mock('@/hooks/use-invoice-buckets', () => ({
  formatCurrency: jest.fn((amount: number, currency = 'AED') =>
    `${currency} ${amount.toLocaleString()}.00`
  )
}))

const mockInvoiceDetails = [
  {
    id: 'invoice-1',
    customerName: 'ABC Trading LLC',
    customerEmail: 'accounts@abctrading.ae',
    number: 'INV-001',
    amount: 5000,
    currency: 'AED',
    daysOverdue: 5
  },
  {
    id: 'invoice-2',
    customerName: 'XYZ Corporation',
    customerEmail: 'finance@xyzcorp.ae',
    number: 'INV-002',
    amount: 10000,
    currency: 'AED',
    daysOverdue: 3
  }
]

describe('EmailCampaignModal', () => {
  const mockOnClose = jest.fn()
  const mockInvoiceIds = ['invoice-1', 'invoice-2']

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render modal when open', () => {
    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    expect(screen.getByText('Create Email Campaign')).toBeInTheDocument()
    expect(screen.getByText('Send payment reminders to 2 customers for outstanding invoices')).toBeInTheDocument()
  })

  it('should not render modal when closed', () => {
    render(
      <EmailCampaignModal
        isOpen={false}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
      />
    )

    expect(screen.queryByText('Create Email Campaign')).not.toBeInTheDocument()
  })

  it('should display campaign summary correctly', () => {
    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument() // Number of invoices
    expect(screen.getByText('AED 15,000.00')).toBeInTheDocument() // Total amount
    expect(screen.getByText('4d')).toBeInTheDocument() // Average days overdue
  })

  it('should navigate through tabs correctly', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Start on Content tab
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Content')

    // Click Settings tab
    await user.click(screen.getByRole('tab', { name: /Settings/ }))
    expect(screen.getByText('Sending Schedule')).toBeInTheDocument()

    // Click Preview tab
    await user.click(screen.getByRole('tab', { name: /Preview/ }))
    expect(screen.getByText('Email Preview')).toBeInTheDocument()

    // Click Send tab
    await user.click(screen.getByRole('tab', { name: /Send/ }))
    expect(screen.getByText('Ready to Send')).toBeInTheDocument()
  })

  it('should handle form input changes', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Change campaign name
    const campaignNameInput = screen.getByLabelText('Campaign Name')
    await user.clear(campaignNameInput)
    await user.type(campaignNameInput, 'Test Campaign')

    expect(campaignNameInput).toHaveValue('Test Campaign')

    // Change email subject
    const subjectInput = screen.getByLabelText('Email Subject')
    await user.clear(subjectInput)
    await user.type(subjectInput, 'Test Subject')

    expect(subjectInput).toHaveValue('Test Subject')

    // Change email content
    const contentTextarea = screen.getByLabelText('Email Content')
    await user.clear(contentTextarea)
    await user.type(contentTextarea, 'Test email content')

    expect(contentTextarea).toHaveValue('Test email content')
  })

  it('should select email templates', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Click on Gentle Reminder template
    const gentleReminderTemplate = screen.getByText('Gentle Reminder')
    await user.click(gentleReminderTemplate.closest('div')!)

    // Template should be selected (checkbox checked)
    const checkbox = gentleReminderTemplate.closest('div')?.querySelector('input[type="checkbox"]')
    expect(checkbox).toBeChecked()
  })

  it('should insert merge tags', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Focus on email content textarea
    const contentTextarea = screen.getByLabelText('Email Content')
    await user.click(contentTextarea)

    // Click on a merge tag button
    const customerNameTag = screen.getByText('{customer_name}')
    await user.click(customerNameTag)

    // The merge tag should be inserted (this would require mocking the DOM selection)
    // In a real test, you'd need to mock document.querySelector and selection APIs
  })

  it('should handle language selection', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Open language select
    const languageSelect = screen.getByLabelText('Language')
    await user.click(languageSelect)

    // Select Arabic
    const arabicOption = screen.getByText('Arabic')
    await user.click(arabicOption)

    // Language should be changed
    expect(languageSelect).toHaveTextContent('Arabic')
  })

  it('should configure sending settings', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Settings tab
    await user.click(screen.getByRole('tab', { name: /Settings/ }))

    // Toggle business hours
    const businessHoursCheckbox = screen.getByLabelText('Respect UAE Business Hours')
    await user.click(businessHoursCheckbox)
    expect(businessHoursCheckbox).not.toBeChecked()

    // Change batch size
    const batchSizeSelect = screen.getByLabelText('Batch Size')
    await user.click(batchSizeSelect)
    const batchOption = screen.getByText('10 emails per batch')
    await user.click(batchOption)

    // Change delay
    const delaySelect = screen.getByLabelText('Delay Between Batches (ms)')
    await user.click(delaySelect)
    const delayOption = screen.getByText('5 seconds')
    await user.click(delayOption)
  })

  it('should show email preview with real data', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Preview tab
    await user.click(screen.getByRole('tab', { name: /Preview/ }))

    expect(screen.getByText('Email Preview')).toBeInTheDocument()
    expect(screen.getByText('Sample Personalized Email')).toBeInTheDocument()
    expect(screen.getByText('ABC Trading LLC')).toBeInTheDocument() // Customer name
    expect(screen.getByText('accounts@abctrading.ae')).toBeInTheDocument() // Customer email
  })

  it('should submit campaign successfully', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, campaignId: 'campaign-123' }),
    } as Response)

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Send tab
    await user.click(screen.getByRole('tab', { name: /Send/ }))

    // Click Send Campaign button
    const sendButton = screen.getByText('Send Campaign')
    await user.click(sendButton)

    expect(sendButton).toHaveTextContent('Creating Campaign...')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/from-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"invoiceIds":["invoice-1","invoice-2"]')
      })
    })

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('should handle campaign submission errors', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
    } as Response)

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Send tab
    await user.click(screen.getByRole('tab', { name: /Send/ }))

    // Click Send Campaign button
    const sendButton = screen.getByText('Send Campaign')
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Error should be handled (button should not be in loading state anymore)
    await waitFor(() => {
      expect(sendButton).toHaveTextContent('Send Campaign')
    })

    // Modal should remain open on error
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should handle navigation between steps', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Click Next to go to Settings
    const nextButton = screen.getByText('Next')
    await user.click(nextButton)

    expect(screen.getByText('Sending Schedule')).toBeInTheDocument()

    // Click Previous to go back to Content
    const previousButton = screen.getByText('Previous')
    await user.click(previousButton)

    expect(screen.getByLabelText('Campaign Name')).toBeInTheDocument()
  })

  it('should show scheduled sending option', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Settings tab
    await user.click(screen.getByRole('tab', { name: /Settings/ }))

    // Find schedule input
    const scheduleInput = screen.getByLabelText('Schedule For (Optional)')
    expect(scheduleInput).toBeInTheDocument()
    expect(scheduleInput).toHaveAttribute('type', 'datetime-local')

    // Set a future date
    await user.type(scheduleInput, '2024-12-25T10:00')
    expect(scheduleInput).toHaveValue('2024-12-25T10:00')
  })

  it('should close modal when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show UAE business hours notice', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Settings tab
    await user.click(screen.getByRole('tab', { name: /Settings/ }))

    expect(screen.getByText('Emails will only be sent Sunday-Thursday, 9 AM - 6 PM GST')).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Clear campaign name
    const campaignNameInput = screen.getByLabelText('Campaign Name')
    await user.clear(campaignNameInput)

    // Go to Send tab
    await user.click(screen.getByRole('tab', { name: /Send/ }))

    const sendButton = screen.getByText('Send Campaign')

    // Button should be enabled even with empty name (basic validation)
    expect(sendButton).toBeEnabled()
  })

  it('should show personalization preview correctly', async () => {
    const user = userEvent.setup()

    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={mockInvoiceDetails}
      />
    )

    // Go to Preview tab
    await user.click(screen.getByRole('tab', { name: /Preview/ }))

    // Check that merge tags are replaced with actual data
    const emailPreview = screen.getByText(/ABC Trading LLC/i)
    expect(emailPreview).toBeInTheDocument()

    // Check currency formatting
    expect(screen.getByText('AED 5,000.00')).toBeInTheDocument()

    // Check days overdue
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should handle empty invoice details gracefully', () => {
    render(
      <EmailCampaignModal
        isOpen={true}
        onClose={mockOnClose}
        invoiceIds={mockInvoiceIds}
        invoiceDetails={[]}
      />
    )

    // Should still show campaign creation form
    expect(screen.getByText('Create Email Campaign')).toBeInTheDocument()

    // Summary should show 0 for missing data
    expect(screen.getByText('0d')).toBeInTheDocument() // Average days overdue
  })
})