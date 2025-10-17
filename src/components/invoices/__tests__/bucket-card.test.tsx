import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BucketCard } from '../bucket-card'
import { InvoiceBucket } from '@/hooks/use-invoice-buckets'

// Mock the hook module
jest.mock('@/hooks/use-invoice-buckets', () => ({
  formatCurrency: jest.fn((amount: number) => `AED ${amount.toLocaleString()}.00`),
  getBucketColorClasses: jest.fn((color: string) => ({
    border: `border-${color}-200`,
    bg: `bg-${color}-50`,
    text: `text-${color}-700`
  })),
  getPriorityVariant: jest.fn((priority: string) => {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
      default:
        return 'secondary'
    }
  })
}))

const mockBucket: InvoiceBucket = {
  id: 'bucket-1-3-days',
  label: '1-3 Days Overdue',
  count: 5,
  totalAmount: 15000,
  priority: 'high',
  color: 'orange',
  eligibleForReminder: 3,
  needsReview: 2,
  sampleInvoices: [
    {
      id: 'invoice-1',
      customerName: 'ABC Trading LLC',
      number: 'INV-001',
      amount: 5000,
      daysOverdue: 2
    },
    {
      id: 'invoice-2',
      customerName: 'XYZ Corporation',
      number: 'INV-002',
      amount: 10000,
      daysOverdue: 1
    }
  ],
  hasUrgentCustomers: true,
  hasAutoRemindersEnabled: false,
  hasRecentActivity: true
}

describe('BucketCard', () => {
  const mockOnSelect = jest.fn()
  const mockOnQuickAction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render bucket card with basic information', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    expect(screen.getByText('1-3 Days Overdue')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // count
    expect(screen.getByText('AED 15,000.00')).toBeInTheDocument() // total amount
  })

  it('should display priority badge correctly', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    const priorityBadge = screen.getByText('HIGH')
    expect(priorityBadge).toBeInTheDocument()
    expect(priorityBadge).toHaveClass('text-xs', 'font-medium')
  })

  it('should show status indicators for urgent customers, auto reminders, and recent activity', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    // Check for urgent customers indicator
    const urgentIcon = document.querySelector('[data-testid="urgent-customers"]') ||
                      screen.getByTitle('Has urgent customers')
    expect(urgentIcon).toBeInTheDocument()

    // Check for recent activity indicator
    const activityIcon = document.querySelector('[data-testid="recent-activity"]') ||
                        screen.getByTitle('Recent activity')
    expect(activityIcon).toBeInTheDocument()

    // Auto reminders is false, so it should not be present
    const autoRemindersIcon = document.querySelector('[data-testid="auto-reminders"]')
    expect(autoRemindersIcon).not.toBeInTheDocument()
  })

  it('should display action indicators when present', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    expect(screen.getByText('Can send: 3')).toBeInTheDocument()
    expect(screen.getByText('Review: 2')).toBeInTheDocument()
  })

  it('should handle card click and expansion', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    const card = screen.getByRole('button', { name: /1-3 Days Overdue/i }) ||
                 screen.getByText('1-3 Days Overdue').closest('div')

    fireEvent.click(card!)

    expect(mockOnSelect).toHaveBeenCalledTimes(1)
  })

  it('should show sample invoices when expanded', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        isSelected={true}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    expect(screen.getByText('Recent Invoices:')).toBeInTheDocument()
    expect(screen.getByText('ABC Trading LLC')).toBeInTheDocument()
    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('XYZ Corporation')).toBeInTheDocument()
    expect(screen.getByText('INV-002')).toBeInTheDocument()
    expect(screen.getByText('2 days overdue')).toBeInTheDocument()
    expect(screen.getByText('1 days overdue')).toBeInTheDocument()
  })

  it('should show quick action buttons when expanded and actions are available', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        isSelected={true}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    const sendButton = screen.getByText('Send (3)')
    const reviewButton = screen.getByText('Review (2)')

    expect(sendButton).toBeInTheDocument()
    expect(reviewButton).toBeInTheDocument()

    fireEvent.click(sendButton)
    expect(mockOnQuickAction).toHaveBeenCalledWith('send_all')

    fireEvent.click(reviewButton)
    expect(mockOnQuickAction).toHaveBeenCalledWith('review_all')
  })

  it('should prevent event bubbling on quick action clicks', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        isSelected={true}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    const sendButton = screen.getByText('Send (3)')

    fireEvent.click(sendButton)

    expect(mockOnQuickAction).toHaveBeenCalledWith('send_all')
    // Should not trigger card selection due to event.stopPropagation()
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should show empty state for bucket with no invoices', () => {
    const emptyBucket = {
      ...mockBucket,
      count: 0,
      totalAmount: 0,
      eligibleForReminder: 0,
      needsReview: 0,
      sampleInvoices: []
    }

    render(
      <BucketCard
        bucket={emptyBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    expect(screen.getByText('No invoices in this category')).toBeInTheDocument()
  })

  it('should apply selected styling when isSelected is true', () => {
    const { container } = render(
      <BucketCard
        bucket={mockBucket}
        isSelected={true}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    const card = container.querySelector('.ring-2.ring-blue-500.shadow-lg')
    expect(card).toBeInTheDocument()
  })

  it('should show overflow indicator when there are more than 3 sample invoices', () => {
    const bucketWithManyInvoices = {
      ...mockBucket,
      count: 10,
      sampleInvoices: [
        { id: '1', customerName: 'Customer 1', number: 'INV-001', amount: 1000, daysOverdue: 1 },
        { id: '2', customerName: 'Customer 2', number: 'INV-002', amount: 2000, daysOverdue: 2 },
        { id: '3', customerName: 'Customer 3', number: 'INV-003', amount: 3000, daysOverdue: 3 },
        { id: '4', customerName: 'Customer 4', number: 'INV-004', amount: 4000, daysOverdue: 4 },
        { id: '5', customerName: 'Customer 5', number: 'INV-005', amount: 5000, daysOverdue: 5 }
      ]
    }

    render(
      <BucketCard
        bucket={bucketWithManyInvoices}
        isSelected={true}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    expect(screen.getByText('+7 more invoices')).toBeInTheDocument()
  })

  it('should handle different priority levels correctly', () => {
    const criticalBucket = { ...mockBucket, priority: 'critical' as const }
    const lowBucket = { ...mockBucket, priority: 'low' as const }

    const { rerender } = render(
      <BucketCard bucket={criticalBucket} onSelect={mockOnSelect} onQuickAction={mockOnQuickAction} />
    )

    expect(screen.getByText('CRITICAL')).toBeInTheDocument()

    rerender(
      <BucketCard bucket={lowBucket} onSelect={mockOnSelect} onQuickAction={mockOnQuickAction} />
    )

    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  it('should handle hover states and transitions', () => {
    const { container } = render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    const card = container.querySelector('.hover\\:scale-105.hover\\:shadow-md')
    expect(card).toBeInTheDocument()

    const transitionCard = container.querySelector('.transition-all.duration-300')
    expect(transitionCard).toBeInTheDocument()
  })

  it('should not show quick actions when no actions are available', () => {
    const noActionBucket = {
      ...mockBucket,
      eligibleForReminder: 0,
      needsReview: 0
    }

    render(
      <BucketCard
        bucket={noActionBucket}
        isSelected={true}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    expect(screen.queryByText(/Send \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Review \(/)).not.toBeInTheDocument()
  })

  it('should handle accessibility requirements', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    // Check for proper ARIA labels and roles
    const card = screen.getByRole('button') || screen.getByText('1-3 Days Overdue').closest('[role]')
    expect(card).toBeInTheDocument()

    // Check that action buttons are properly labeled
    if (mockBucket.eligibleForReminder > 0) {
      const sendButton = screen.queryByLabelText(/send reminders/i) || screen.getByText(/Send \(/)
      expect(sendButton).toBeInTheDocument()
    }
  })

  it('should display currency formatting correctly', () => {
    render(
      <BucketCard
        bucket={mockBucket}
        onSelect={mockOnSelect}
        onQuickAction={mockOnQuickAction}
      />
    )

    // Check that formatCurrency was called with the correct amount
    expect(require('@/hooks/use-invoice-buckets').formatCurrency).toHaveBeenCalledWith(15000)
  })
})