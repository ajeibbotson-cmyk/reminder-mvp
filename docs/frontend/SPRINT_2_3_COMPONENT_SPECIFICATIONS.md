# Sprint 2 & 3 Component Implementation Specifications

## Sprint Overview

### Sprint 2 (Weeks 3-4): Core UI Components & Email Integration
**Focus**: Essential consolidation UI components and email template management

### Sprint 3 (Weeks 5-6): Dashboard Integration & Analytics
**Focus**: Full dashboard integration, analytics, and advanced features

---

## Sprint 2 Implementation Plan

### Week 3: Core Queue Components

#### 1. ConsolidationQueue Component
**File**: `src/components/consolidation/queue/ConsolidationQueue.tsx`

**Requirements**:
- Main container component for consolidation queue
- Responsive layout switching (table/grid/list)
- Integration with consolidation store
- Real-time data updates
- Empty state handling

**Props Interface**:
```typescript
interface ConsolidationQueueProps {
  companyId: string
  refreshInterval?: number
  maxCandidatesPerPage?: number
  autoRefresh?: boolean
  onPreviewConsolidation?: (customerId: string) => void
  onSendConsolidation?: (customerIds: string[]) => Promise<void>
  onScheduleConsolidation?: (customerIds: string[], scheduledFor: Date) => Promise<void>
  className?: string
}
```

**Key Features**:
- Automatic refresh every 30 seconds
- Optimistic updates for actions
- Error boundary integration
- Loading states for all operations
- Keyboard navigation support

**Implementation Notes**:
```typescript
const ConsolidationQueue: React.FC<ConsolidationQueueProps> = ({
  companyId,
  refreshInterval = 30000,
  autoRefresh = true,
  ...props
}) => {
  const {
    candidates,
    loading,
    error,
    selectedCustomers,
    queue
  } = useConsolidationStore()

  const actions = useConsolidationActions()

  useEffect(() => {
    actions.initializeStore(companyId)
  }, [companyId])

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        actions.refreshAllData()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const viewComponent = useMemo(() => {
    switch (queue.view) {
      case 'table':
        return <ConsolidationTable candidates={candidates} />
      case 'grid':
        return <ConsolidationGrid candidates={candidates} />
      case 'list':
        return <ConsolidationList candidates={candidates} />
      default:
        return <ConsolidationTable candidates={candidates} />
    }
  }, [queue.view, candidates])

  if (error) {
    return <ConsolidationError error={error} onRetry={actions.refreshAllData} />
  }

  if (loading && candidates.length === 0) {
    return <ConsolidationQueueSkeleton />
  }

  return (
    <div className="consolidation-queue">
      <ConsolidationQueueHeader
        stats={queue.stats}
        view={queue.view}
        onViewChange={actions.setView}
        onRefresh={actions.refreshAllData}
      />

      <div className="consolidation-content">
        <ConsolidationFilters
          filters={queue.filters}
          onFiltersChange={actions.updateFilters}
          candidateStats={queue.candidateStats}
        />

        <div className="consolidation-main">
          {selectedCustomers.length > 0 && (
            <BulkActionPanel
              selectedCustomers={selectedCustomers}
              onAction={actions.executeBulkAction}
              onClearSelection={actions.clearSelection}
            />
          )}

          {viewComponent}
        </div>
      </div>
    </div>
  )
}
```

#### 2. CustomerConsolidationCard Component
**File**: `src/components/consolidation/queue/CustomerConsolidationCard.tsx`

**Requirements**:
- Individual customer display with consolidation data
- Priority and escalation level indicators
- Quick action buttons
- Expandable detail view
- Selection checkbox
- Responsive design

**Props Interface**:
```typescript
interface CustomerConsolidationCardProps {
  candidate: ConsolidationCandidate
  isSelected?: boolean
  isExpanded?: boolean
  showActions?: boolean
  onSelect?: (customerId: string, selected: boolean) => void
  onExpand?: (customerId: string, expanded: boolean) => void
  onPreview?: (customerId: string) => void
  onSendNow?: (customerId: string) => Promise<void>
  onSchedule?: (customerId: string, scheduledFor: Date) => Promise<void>
  className?: string
}
```

**Visual Design**:
```typescript
const CustomerConsolidationCard: React.FC<CustomerConsolidationCardProps> = ({
  candidate,
  isSelected = false,
  isExpanded = false,
  showActions = true,
  onSelect,
  onExpand,
  onPreview,
  onSendNow,
  onSchedule,
  className
}) => {
  const { t } = useTranslations('consolidation')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleAction = async (action: string, handler: () => Promise<void>) => {
    setActionLoading(action)
    try {
      await handler()
    } catch (error) {
      toast.error(`Failed to ${action}`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Card className={cn(
      'customer-consolidation-card',
      isSelected && 'ring-2 ring-primary',
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(candidate.customerId, !!checked)}
                aria-label={`Select ${candidate.customerName}`}
              />
            )}

            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm">{candidate.customerName}</h3>
                <PriorityBadge score={candidate.priorityScore} />
                <EscalationIndicator level={candidate.escalationLevel} />
              </div>

              <p className="text-sm text-muted-foreground">{candidate.customerEmail}</p>
              {candidate.companyName && (
                <p className="text-sm text-muted-foreground">{candidate.companyName}</p>
              )}

              <div className="flex items-center space-x-4 mt-2 text-sm">
                <span>{candidate.overdueInvoices.length} invoices</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('en-AE', {
                    style: 'currency',
                    currency: candidate.currency
                  }).format(candidate.totalAmount)}
                </span>
                <span>{candidate.oldestInvoiceDays} days overdue</span>
              </div>
            </div>
          </div>

          <ContactEligibility
            canContact={candidate.canContact}
            nextEligibleContact={candidate.nextEligibleContact}
          />
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            <ConsolidationSummary
              invoices={candidate.overdueInvoices}
              consolidationReason={candidate.consolidationReason}
            />
          </div>
        )}

        {showActions && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExpand?.(candidate.customerId, !isExpanded)}
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
              {isExpanded ? 'Less' : 'More'}
            </Button>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPreview?.(candidate.customerId)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>

              {candidate.canContact && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('schedule', () => onSchedule?.(candidate.customerId, new Date()))}
                    disabled={actionLoading === 'schedule'}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    {actionLoading === 'schedule' ? 'Scheduling...' : 'Schedule'}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleAction('send', () => onSendNow?.(candidate.customerId))}
                    disabled={actionLoading === 'send'}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    {actionLoading === 'send' ? 'Sending...' : 'Send Now'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### 3. ConsolidationFilters Component
**File**: `src/components/consolidation/queue/ConsolidationFilters.tsx`

**Requirements**:
- Priority level filtering
- Escalation level filtering
- Contact eligibility filtering
- Amount range filtering
- Search functionality
- Filter presets
- Clear filters option

**Key Features**:
- Real-time filtering as user types
- Filter combination logic
- Preset management
- Filter count indicators
- Collapsible design for mobile

### Week 4: Email Integration Components

#### 4. ConsolidationPreviewModal Component
**File**: `src/components/consolidation/preview/ConsolidationPreviewModal.tsx`

**Requirements**:
- Full-screen modal for email preview
- Template selection dropdown
- Language toggle (English/Arabic)
- Attachment settings
- Send/Schedule actions
- Real-time preview updates

**Props Interface**:
```typescript
interface ConsolidationPreviewModalProps {
  customerId: string | null
  isOpen: boolean
  onClose: () => void
  onSend?: () => Promise<void>
  onSchedule?: (scheduledFor: Date) => Promise<void>
}
```

#### 5. BulkActionPanel Component
**File**: `src/components/consolidation/actions/BulkActionPanel.tsx`

**Requirements**:
- Sticky panel for bulk actions
- Action availability based on selection
- Progress indicators for bulk operations
- Confirmation dialogs
- Success/error feedback

**Key Features**:
- Batch operation progress
- Rollback capability for failed operations
- Detailed result reporting
- Queue updates after actions

---

## Sprint 3 Implementation Plan

### Week 5: Dashboard Integration

#### 6. Dashboard Integration
**Files**:
- `src/app/[locale]/dashboard/consolidation/page.tsx`
- `src/components/dashboard/consolidation-widget.tsx`

**Requirements**:
- Main consolidation page in dashboard
- Dashboard widget for consolidation summary
- Navigation integration
- Breadcrumb support

**Main Page Implementation**:
```typescript
// src/app/[locale]/dashboard/consolidation/page.tsx
import { ConsolidationQueue } from '@/components/consolidation/queue/ConsolidationQueue'
import { ConsolidationMetricsCard } from '@/components/consolidation/analytics/ConsolidationMetricsCard'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ConsolidationPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.companyId) {
    redirect('/auth/signin')
  }

  return (
    <div className="consolidation-page">
      <div className="page-header">
        <h1 className="text-2xl font-bold">Customer Consolidation</h1>
        <p className="text-muted-foreground">
          Manage consolidated payment reminders for customers with multiple overdue invoices
        </p>
      </div>

      <div className="mb-6">
        <ConsolidationMetricsCard
          companyId={session.user.companyId}
          timeframe="30d"
        />
      </div>

      <ConsolidationQueue
        companyId={session.user.companyId}
        autoRefresh={true}
        refreshInterval={30000}
      />
    </div>
  )
}
```

#### 7. ConsolidationMetricsCard Component
**File**: `src/components/consolidation/analytics/ConsolidationMetricsCard.tsx`

**Requirements**:
- Key metrics display (total customers, emails saved, etc.)
- Timeframe selection
- Trend indicators
- Quick action buttons
- Responsive grid layout

### Week 6: Advanced Features & Analytics

#### 8. ConsolidationAnalytics Components
**Files**:
- `src/components/consolidation/analytics/EffectivenessChart.tsx`
- `src/components/consolidation/analytics/VolumeReductionChart.tsx`
- `src/components/consolidation/analytics/ConsolidationTrends.tsx`

**Requirements**:
- Interactive charts using Chart.js/Recharts
- Time series data visualization
- Export functionality
- Drill-down capabilities

#### 9. Advanced Scheduling Components
**Files**:
- `src/components/consolidation/scheduling/ConsolidationScheduler.tsx`
- `src/components/consolidation/scheduling/BusinessHoursSelector.tsx`
- `src/components/consolidation/scheduling/CulturalComplianceIndicator.tsx`

**Requirements**:
- UAE business hours integration
- Islamic calendar awareness
- Prayer time avoidance
- Holiday detection

---

## Testing Requirements

### Unit Testing (Each Component)
```typescript
// Example test structure
describe('CustomerConsolidationCard', () => {
  const mockCandidate: ConsolidationCandidate = {
    customerId: 'test-1',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    // ... other properties
  }

  it('renders customer information correctly', () => {
    render(
      <CustomerConsolidationCard
        candidate={mockCandidate}
        onSelect={jest.fn()}
      />
    )

    expect(screen.getByText(mockCandidate.customerName)).toBeInTheDocument()
    expect(screen.getByText(mockCandidate.customerEmail)).toBeInTheDocument()
  })

  it('handles selection correctly', async () => {
    const mockOnSelect = jest.fn()
    render(
      <CustomerConsolidationCard
        candidate={mockCandidate}
        onSelect={mockOnSelect}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(mockOnSelect).toHaveBeenCalledWith(mockCandidate.customerId, true)
  })

  it('shows contact eligibility correctly', () => {
    const ineligibleCandidate = {
      ...mockCandidate,
      canContact: false,
      nextEligibleContact: new Date('2024-01-15')
    }

    render(
      <CustomerConsolidationCard candidate={ineligibleCandidate} />
    )

    expect(screen.getByText(/waiting period/i)).toBeInTheDocument()
  })
})
```

### Integration Testing
```typescript
// Full workflow testing
describe('Consolidation Workflow', () => {
  it('completes bulk send workflow', async () => {
    render(<ConsolidationQueue companyId="test-company" />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })

    // Select customers
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // Skip select-all
    await user.click(checkboxes[2])

    // Execute bulk action
    const sendButton = screen.getByRole('button', { name: /send consolidated reminders/i })
    await user.click(sendButton)

    // Confirm action
    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/reminders sent successfully/i)).toBeInTheDocument()
    })
  })
})
```

### E2E Testing with Playwright
```typescript
test('consolidation queue functionality', async ({ page }) => {
  await page.goto('/dashboard/consolidation')

  // Check initial load
  await expect(page.getByRole('heading', { name: /customer consolidation/i })).toBeVisible()

  // Test filtering
  await page.getByRole('combobox', { name: /priority/i }).click()
  await page.getByRole('option', { name: /high/i }).click()

  // Verify filter applied
  await expect(page.getByText(/high priority/i)).toBeVisible()

  // Test customer selection
  const firstCheckbox = page.getByRole('checkbox').first()
  await firstCheckbox.check()

  // Test bulk action
  await page.getByRole('button', { name: /send consolidated reminders/i }).click()

  // Test confirmation dialog
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /confirm/i }).click()

  // Verify success
  await expect(page.getByText(/successfully/i)).toBeVisible()
})
```

---

## Performance Requirements

### Loading Performance
- **Initial Load**: < 2 seconds for 100 customers
- **Filter Response**: < 500ms
- **Bulk Action Response**: < 1 second for 50 customers
- **Chart Rendering**: < 1 second for 30-day data

### Memory Performance
- **Component Memory**: < 50MB for 500 customers
- **Store Memory**: < 100MB total state
- **Image Optimization**: Lazy loading for all images
- **Bundle Size**: < 500KB additional for consolidation features

### Monitoring Implementation
```typescript
// Performance monitoring hook
const usePerformanceMonitoring = (componentName: string) => {
  useEffect(() => {
    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime

      if (renderTime > 1000) {
        console.warn(`${componentName} render took ${renderTime}ms`)
      }

      // Send to analytics if available
      analytics?.track('component_performance', {
        component: componentName,
        renderTime,
        timestamp: new Date().toISOString()
      })
    }
  }, [componentName])
}
```

---

## Accessibility Compliance

### WCAG 2.1 AA Requirements
- **Color Contrast**: Minimum 4.5:1 ratio
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: ARIA labels and descriptions
- **Focus Management**: Logical tab order
- **Error Handling**: Clear error messages

### Implementation Checklist
- [ ] All interactive elements have focus indicators
- [ ] Form fields have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Tables have proper headers and scope
- [ ] Modals trap focus appropriately
- [ ] Loading states are announced
- [ ] Success/error actions are announced

---

## Internationalization Requirements

### Arabic (RTL) Support
- [ ] Layout flips correctly for RTL
- [ ] Icons and arrows flip direction
- [ ] Number and currency formatting respects locale
- [ ] Date formatting uses Arabic calendar when appropriate
- [ ] Text alignment adjusts for RTL

### Translation Keys Structure
```typescript
// messages/en.json
{
  "consolidation": {
    "queue": {
      "title": "Customer Consolidation Queue",
      "empty": "No customers require consolidation",
      "loading": "Loading customers...",
      "error": "Failed to load customers"
    },
    "actions": {
      "send": "Send Now",
      "schedule": "Schedule",
      "preview": "Preview",
      "select": "Select Customer",
      "selectAll": "Select All Customers"
    },
    "filters": {
      "priority": "Priority Level",
      "escalation": "Escalation Level",
      "contactEligibility": "Contact Status",
      "search": "Search customers"
    }
  }
}
```

This comprehensive specification provides clear guidelines for implementing the consolidation feature across Sprint 2 and Sprint 3, ensuring consistency with the existing reminder-mvp system while delivering the advanced consolidation functionality required by UAE businesses.