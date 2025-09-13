/**
 * Comprehensive Dashboard Component Tests with Data Mocking
 * Tests invoice dashboard with realistic UAE business data and scenarios
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { IntlProvider } from 'next-intl'
import { ThemeProvider } from 'next-themes'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'
import { InvoiceSearch } from '@/components/invoices/invoice-search'
import { InvoiceStats } from '@/components/invoices/invoice-stats'
import { BulkOperationsPanel } from '@/components/invoices/bulk-operations-panel'
import { ImportInterface } from '@/components/invoices/import-interface'
import { 
  generateUAECompany, 
  generateInvoiceBatch, 
  testScenarios,
  accessibilityTestHelpers,
  performanceConfig
} from '../utils/uae-test-data'

// Mock next-intl
const mockMessages = {
  invoices: {
    invoiceNumber: 'Invoice Number',
    customer: 'Customer',
    amount: 'Amount',
    dueDate: 'Due Date',
    status: 'Status',
    actions: 'Actions',
    addInvoice: 'Add Invoice',
    searchPlaceholder: 'Search invoices...',
    filterByStatus: 'Filter by Status',
    filterByDateRange: 'Filter by Date Range',
    sortBy: 'Sort By',
    selectAll: 'Select All',
    bulkActions: 'Bulk Actions',
    markAsPaid: 'Mark as Paid',
    sendReminder: 'Send Reminder',
    exportPdf: 'Export PDF',
    exportCsv: 'Export CSV',
    deleteSelected: 'Delete Selected',
    noInvoicesFound: 'No invoices found',
    loading: 'Loading invoices...'
  },
  dashboard: {
    totalInvoices: 'Total Invoices',
    totalRevenue: 'Total Revenue',
    pendingPayments: 'Pending Payments',
    overdueInvoices: 'Overdue Invoices',
    recentActivity: 'Recent Activity',
    quickStats: 'Quick Stats'
  },
  import: {
    title: 'Import Invoices',
    description: 'Upload CSV or Excel files to import multiple invoices',
    dragDrop: 'Drag and drop files here',
    browseFiles: 'Browse Files',
    supportedFormats: 'Supported formats: CSV, Excel (.xlsx, .xls)',
    maxSize: 'Maximum file size: 10MB',
    startImport: 'Start Import',
    processing: 'Processing...',
    uploadComplete: 'Upload Complete',
    errorTitle: 'Import Error'
  },
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    previous: 'Previous',
    next: 'Next'
  }
}

// Mock stores
const mockInvoiceStore = {
  invoices: [],
  loading: false,
  error: null,
  totalCount: 0,
  fetchInvoices: jest.fn(),
  updateInvoiceStatus: jest.fn(),
  deleteInvoice: jest.fn(),
  clearError: jest.fn(),
  bulkUpdateStatus: jest.fn(),
  bulkDelete: jest.fn()
}

const mockImportBatchStore = {
  batches: [],
  isLoading: false,
  error: null,
  uploadFile: jest.fn(),
  getProgress: jest.fn(),
  processImport: jest.fn(),
  clearError: jest.fn()
}

// Mock hooks
jest.mock('@/lib/stores/invoice-store', () => ({
  useInvoiceStore: () => mockInvoiceStore
}))

jest.mock('@/lib/stores/import-batch-store', () => ({
  useImportBatchStore: () => mockImportBatchStore
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const keys = key.split('.')
    let value: any = mockMessages
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  },
  useLocale: () => 'en',
  IntlProvider: ({ children }: any) => children
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    pathname: '/dashboard/invoices',
    search: '',
    hash: ''
  },
  writable: true
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
})

const TestWrapper: React.FC<{ children: React.ReactNode; locale?: string }> = ({ 
  children, 
  locale = 'en' 
}) => (
  <IntlProvider locale={locale} messages={mockMessages}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  </IntlProvider>
)

describe('Dashboard Component Tests with Data Mocking', () => {
  let testCompany: ReturnType<typeof generateUAECompany>
  let mockInvoices: ReturnType<typeof generateInvoiceBatch>
  const user = userEvent.setup()

  beforeEach(() => {
    testCompany = generateUAECompany()
    mockInvoices = generateInvoiceBatch(50, { companyId: testCompany.id })
    
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup default mock implementations
    mockInvoiceStore.invoices = mockInvoices
    mockInvoiceStore.totalCount = mockInvoices.length
    mockInvoiceStore.loading = false
    mockInvoiceStore.error = null
    
    mockInvoiceStore.fetchInvoices.mockResolvedValue(mockInvoices)
    mockInvoiceStore.updateInvoiceStatus.mockResolvedValue(undefined)
    mockInvoiceStore.deleteInvoice.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Invoice Dashboard Rendering', () => {
    it('should render invoice table with realistic UAE data', async () => {
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 10)}
            totalCount={mockInvoices.length}
          />
        </TestWrapper>
      )

      // Check table headers
      expect(screen.getByText('Invoice Number')).toBeInTheDocument()
      expect(screen.getByText('Customer')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
      expect(screen.getByText('Due Date')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()

      // Check first invoice data
      const firstInvoice = mockInvoices[0]
      expect(screen.getByText(firstInvoice.invoiceNumber)).toBeInTheDocument()
      expect(screen.getByText(firstInvoice.customerName)).toBeInTheDocument()
      
      // Check UAE currency formatting
      expect(screen.getByText(new RegExp('AED', 'i'))).toBeInTheDocument()
      
      // Check UAE phone format if displayed
      if (firstInvoice.customerPhone) {
        expect(screen.getByText(new RegExp('\\+971', 'i'))).toBeInTheDocument()
      }
    })

    it('should render Arabic locale correctly with RTL layout', async () => {
      render(
        <TestWrapper locale="ar">
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 5)}
            totalCount={5}
          />
        </TestWrapper>
      )

      const table = screen.getByRole('table')
      expect(table.closest('.rtl')).toBeInTheDocument()
      
      // Check Arabic text alignment
      const headers = screen.getAllByRole('columnheader')
      headers.forEach(header => {
        expect(header).toHaveClass('text-right')
      })
    })

    it('should display loading state correctly', async () => {
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[]}
            loading={true}
            totalCount={0}
          />
        </TestWrapper>
      )

      expect(screen.getByText('Loading invoices...')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should display empty state when no invoices exist', async () => {
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[]}
            totalCount={0}
          />
        </TestWrapper>
      )

      expect(screen.getByText('No invoices yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first invoice to get started')).toBeInTheDocument()
      expect(screen.getByText('Add Invoice')).toBeInTheDocument()
    })
  })

  describe('Filtering and Search Functionality', () => {
    it('should filter invoices by status', async () => {
      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper>
          <InvoiceFilters 
            filters={{}}
            onFiltersChange={onFiltersChange}
          />
        </TestWrapper>
      )

      const statusFilter = screen.getByLabelText(/filter by status/i)
      await user.click(statusFilter)
      
      const paidOption = screen.getByText('Paid')
      await user.click(paidOption)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paid' })
      )
    })

    it('should search invoices by customer name', async () => {
      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper>
          <InvoiceSearch 
            onSearch={(query) => onFiltersChange({ search: query })}
            placeholder="Search invoices..."
          />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search invoices...')
      await user.type(searchInput, 'Ahmed Trading')

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledWith({ search: 'Ahmed Trading' })
      })
    })

    it('should filter by date range with UAE calendar support', async () => {
      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper>
          <InvoiceFilters 
            filters={{}}
            onFiltersChange={onFiltersChange}
          />
        </TestWrapper>
      )

      const dateRangeFilter = screen.getByLabelText(/date range/i)
      await user.click(dateRangeFilter)

      // Select this month
      const thisMonthOption = screen.getByText('This Month')
      await user.click(thisMonthOption)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date)
          })
        })
      )
    })

    it('should handle complex filter combinations', async () => {
      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper>
          <InvoiceFilters 
            filters={{}}
            onFiltersChange={onFiltersChange}
          />
        </TestWrapper>
      )

      // Apply multiple filters
      const statusFilter = screen.getByLabelText(/status/i)
      await user.click(statusFilter)
      await user.click(screen.getByText('Overdue'))

      const amountFilter = screen.getByLabelText(/amount range/i)
      await user.type(amountFilter, '1000-5000')

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'overdue',
          amountRange: { min: 1000, max: 5000 }
        })
      )
    })
  })

  describe('Sorting Functionality', () => {
    it('should sort invoices by amount ascending/descending', async () => {
      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 10)}
            onFiltersChange={onFiltersChange}
            totalCount={10}
          />
        </TestWrapper>
      )

      const amountHeader = screen.getByText('Amount').closest('button')
      await user.click(amountHeader!)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'amount',
          sort_order: 'asc'
        })
      )

      // Click again for descending
      await user.click(amountHeader!)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'amount',
          sort_order: 'desc'
        })
      )
    })

    it('should sort by due date with proper UAE date handling', async () => {
      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 10)}
            onFiltersChange={onFiltersChange}
            totalCount={10}
          />
        </TestWrapper>
      )

      const dueDateHeader = screen.getByText('Due Date').closest('button')
      await user.click(dueDateHeader!)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'due_date',
          sort_order: 'asc'
        })
      )
    })

    it('should sort by customer name with Arabic support', async () => {
      const arabicInvoices = mockInvoices.slice(0, 5).map(inv => ({
        ...inv,
        customerName: `شركة ${inv.customerName}`
      }))

      const onFiltersChange = jest.fn()
      
      render(
        <TestWrapper locale="ar">
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={arabicInvoices}
            onFiltersChange={onFiltersChange}
            totalCount={5}
          />
        </TestWrapper>
      )

      const customerHeader = screen.getByText('Customer').closest('button')
      await user.click(customerHeader!)

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'customer_name',
          sort_order: 'asc'
        })
      )
    })
  })

  describe('Bulk Actions Integration', () => {
    it('should select multiple invoices and perform bulk actions', async () => {
      const invoicesSubset = mockInvoices.slice(0, 5)
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={invoicesSubset}
            totalCount={5}
          />
        </TestWrapper>
      )

      // Select first two invoices
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[1]) // First invoice checkbox
      await user.click(checkboxes[2]) // Second invoice checkbox

      // Verify bulk actions panel appears
      expect(screen.getByText('2 invoices selected')).toBeInTheDocument()
      expect(screen.getByText('Bulk Actions')).toBeInTheDocument()
    })

    it('should select all invoices with select all checkbox', async () => {
      const invoicesSubset = mockInvoices.slice(0, 3)
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={invoicesSubset}
            totalCount={3}
          />
        </TestWrapper>
      )

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(selectAllCheckbox)

      expect(screen.getByText('3 invoices selected')).toBeInTheDocument()
    })

    it('should perform bulk status update', async () => {
      const invoicesSubset = mockInvoices.slice(0, 3)
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={invoicesSubset}
            totalCount={3}
          />
        </TestWrapper>
      )

      // Select all invoices
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(selectAllCheckbox)

      // Click bulk actions menu
      const bulkActionsButton = screen.getByText('Bulk Actions')
      await user.click(bulkActionsButton)

      // Select mark as paid
      const markPaidOption = screen.getByText('Mark as Paid')
      await user.click(markPaidOption)

      expect(mockInvoiceStore.bulkUpdateStatus).toHaveBeenCalledWith(
        invoicesSubset.map(inv => inv.id),
        'paid'
      )
    })

    it('should handle bulk delete with confirmation', async () => {
      // Mock window.confirm
      window.confirm = jest.fn(() => true)
      
      const invoicesSubset = mockInvoices.slice(0, 2)
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={invoicesSubset}
            totalCount={2}
          />
        </TestWrapper>
      )

      // Select invoices
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[1])
      await user.click(checkboxes[2])

      // Bulk delete
      const bulkActionsButton = screen.getByText('Bulk Actions')
      await user.click(bulkActionsButton)

      const deleteOption = screen.getByText('Delete Selected')
      await user.click(deleteOption)

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete 2 invoices?'
      )
      expect(mockInvoiceStore.bulkDelete).toHaveBeenCalledWith(
        invoicesSubset.map(inv => inv.id)
      )
    })
  })

  describe('Real-time Updates and State Management', () => {
    it('should update invoice status and reflect changes immediately', async () => {
      const testInvoice = mockInvoices[0]
      mockInvoiceStore.updateInvoiceStatus.mockResolvedValue(undefined)
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[testInvoice]}
            totalCount={1}
          />
        </TestWrapper>
      )

      // Find and click invoice actions menu
      const actionsButton = screen.getByLabelText(`Actions for invoice ${testInvoice.invoiceNumber}`)
      await user.click(actionsButton)

      // Update status
      const markPaidOption = screen.getByText('Mark as Paid')
      await user.click(markPaidOption)

      expect(mockInvoiceStore.updateInvoiceStatus).toHaveBeenCalledWith(
        testInvoice.id,
        'paid'
      )
    })

    it('should handle optimistic updates for better UX', async () => {
      const testInvoice = { ...mockInvoices[0], status: 'sent' }
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[testInvoice]}
            totalCount={1}
          />
        </TestWrapper>
      )

      // Status should be shown as 'sent' initially
      expect(screen.getByText('Sent')).toBeInTheDocument()

      // Simulate status update
      const actionsButton = screen.getByLabelText(`Actions for invoice ${testInvoice.invoiceNumber}`)
      await user.click(actionsButton)

      const markPaidOption = screen.getByText('Mark as Paid')
      await user.click(markPaidOption)

      // Should optimistically update the UI
      await waitFor(() => {
        expect(screen.queryByText('Sent')).not.toBeInTheDocument()
        expect(screen.getByText('Paid')).toBeInTheDocument()
      })
    })

    it('should handle error states gracefully', async () => {
      mockInvoiceStore.error = 'Failed to load invoices'
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[]}
            totalCount={0}
          />
        </TestWrapper>
      )

      expect(screen.getByText('Failed to load invoices')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness and Accessibility', () => {
    it('should be accessible with proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 3)}
            totalCount={3}
          />
        </TestWrapper>
      )

      // Check table accessibility
      const table = screen.getByRole('table')
      expect(table).toHaveAttribute('aria-label', 'Invoice management table')

      // Check checkbox accessibility
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toHaveAttribute('aria-label', 'Select all invoices')
      expect(checkboxes[1]).toHaveAttribute('aria-label', `Select invoice ${mockInvoices[0].invoiceNumber}`)

      // Check sort button accessibility
      const sortButtons = screen.getAllByRole('button')
      const amountSortButton = sortButtons.find(btn => btn.textContent?.includes('Amount'))
      expect(amountSortButton).toHaveAttribute('aria-label', 'Sort by amount')
    })

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 3)}
            totalCount={3}
          />
        </TestWrapper>
      )

      const firstCheckbox = screen.getAllByRole('checkbox')[1]
      
      // Tab to checkbox and use keyboard
      firstCheckbox.focus()
      await user.keyboard(' ') // Space to select

      expect(firstCheckbox).toBeChecked()

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      const nextRow = screen.getAllByRole('checkbox')[2]
      expect(nextRow).toHaveFocus()
    })

    it('should be responsive on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 3)}
            totalCount={3}
          />
        </TestWrapper>
      )

      // Check mobile-specific classes
      const container = screen.getByRole('table').closest('.mobile-responsive')
      expect(container).toBeInTheDocument()
    })

    it('should handle screen reader announcements', async () => {
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={mockInvoices.slice(0, 3)}
            totalCount={3}
          />
        </TestWrapper>
      )

      // Check live region for status updates
      const liveRegion = screen.getByRole('status', { hidden: true })
      expect(liveRegion).toBeInTheDocument()

      // Select an invoice and verify announcement
      const firstCheckbox = screen.getAllByRole('checkbox')[1]
      await user.click(firstCheckbox)

      expect(liveRegion).toHaveTextContent('1 invoice selected')
    })
  })

  describe('UAE-specific Formatting and Validation', () => {
    it('should format AED currency correctly for different locales', () => {
      const invoiceWithAmount = { ...mockInvoices[0], amount: 1234.56 }
      
      render(
        <TestWrapper locale="en">
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[invoiceWithAmount]}
            totalCount={1}
          />
        </TestWrapper>
      )

      expect(screen.getByText('AED 1,234.56')).toBeInTheDocument()
    })

    it('should format Arabic currency display', () => {
      const invoiceWithAmount = { ...mockInvoices[0], amount: 1234.56 }
      
      render(
        <TestWrapper locale="ar">
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[invoiceWithAmount]}
            totalCount={1}
          />
        </TestWrapper>
      )

      expect(screen.getByText('١٬٢٣٤٫٥٦ د.إ')).toBeInTheDocument()
    })

    it('should display UAE dates in correct format', () => {
      const testDate = new Date('2024-03-15T10:00:00Z')
      const invoiceWithDate = { ...mockInvoices[0], dueDate: testDate }
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[invoiceWithDate]}
            totalCount={1}
          />
        </TestWrapper>
      )

      // Check UAE date format (DD/MM/YYYY)
      expect(screen.getByText('15/03/2024')).toBeInTheDocument()
    })

    it('should validate and display UAE phone numbers correctly', () => {
      const invoiceWithPhone = { 
        ...mockInvoices[0], 
        customerPhone: '+971501234567' 
      }
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[invoiceWithPhone]}
            totalCount={1}
          />
        </TestWrapper>
      )

      expect(screen.getByText('+971 50 123 4567')).toBeInTheDocument()
    })

    it('should handle TRN display when available', () => {
      const invoiceWithTRN = { 
        ...mockInvoices[0], 
        trnNumber: '100123456789' 
      }
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={[invoiceWithTRN]}
            totalCount={1}
          />
        </TestWrapper>
      )

      expect(screen.getByText('TRN: 100123456789')).toBeInTheDocument()
    })
  })

  describe('Performance Testing', () => {
    it('should render large datasets efficiently', async () => {
      const largeDataset = generateInvoiceBatch(1000)
      const startTime = performance.now()
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={largeDataset.slice(0, 100)} // Paginated view
            totalCount={1000}
          />
        </TestWrapper>
      )

      const renderTime = performance.now() - startTime
      
      expect(renderTime).toBeLessThan(performanceConfig.thresholds.renderTime)
      expect(screen.getByText('Showing 1-100 of 1000')).toBeInTheDocument()
    })

    it('should handle search with performance constraints', async () => {
      const searchStartTime = performance.now()
      
      render(
        <TestWrapper>
          <InvoiceSearch onSearch={jest.fn()} />
        </TestWrapper>
      )

      const searchInput = screen.getByPlaceholderText('Search invoices...')
      await user.type(searchInput, 'test search query')

      const searchTime = performance.now() - searchStartTime
      expect(searchTime).toBeLessThan(performanceConfig.thresholds.searchResponseTime)
    })

    it('should handle bulk operations efficiently', async () => {
      const bulkDataset = generateInvoiceBatch(50)
      
      const startTime = performance.now()
      
      render(
        <TestWrapper>
          <InvoiceTable 
            companyId={testCompany.id}
            invoices={bulkDataset}
            totalCount={50}
          />
        </TestWrapper>
      )

      // Select all invoices
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(selectAllCheckbox)

      const bulkTime = performance.now() - startTime
      expect(bulkTime).toBeLessThan(performanceConfig.thresholds.bulkActionTime)
    })
  })

  describe('Import Interface Integration', () => {
    it('should integrate with import interface for CSV uploads', async () => {
      render(
        <TestWrapper>
          <ImportInterface 
            companyId={testCompany.id}
            onImportComplete={jest.fn()}
          />
        </TestWrapper>
      )

      expect(screen.getByText('Import Invoices')).toBeInTheDocument()
      expect(screen.getByText('Upload CSV or Excel files to import multiple invoices')).toBeInTheDocument()
      expect(screen.getByText('Drag and drop files here')).toBeInTheDocument()
    })

    it('should handle file upload with progress tracking', async () => {
      const onImportComplete = jest.fn()
      mockImportBatchStore.uploadFile.mockResolvedValue({ batchId: 'test-batch-123' })
      mockImportBatchStore.getProgress.mockResolvedValue({ progress: 50 })
      
      render(
        <TestWrapper>
          <ImportInterface 
            companyId={testCompany.id}
            onImportComplete={onImportComplete}
          />
        </TestWrapper>
      )

      // Create a mock CSV file
      const csvFile = new File(['test,data\n1,2'], 'test.csv', { type: 'text/csv' })
      
      const fileInput = screen.getByLabelText(/upload/i)
      await user.upload(fileInput, csvFile)

      expect(screen.getByText('test.csv')).toBeInTheDocument()
      
      const uploadButton = screen.getByText('Start Import')
      await user.click(uploadButton)

      expect(mockImportBatchStore.uploadFile).toHaveBeenCalledWith(csvFile, testCompany.id)
    })
  })
})