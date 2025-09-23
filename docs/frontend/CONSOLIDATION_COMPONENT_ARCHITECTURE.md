# Consolidation Feature - Component Architecture Plan

## Overview

This document outlines the component architecture for the customer consolidation feature, designed to integrate seamlessly with the existing reminder-mvp dashboard and UI system.

## Architecture Principles

### 1. **Seamless Integration**
- Leverage existing shadcn/ui components and patterns
- Follow established dashboard layout and navigation structure
- Maintain consistency with current design system
- Integrate with existing state management (Zustand stores)

### 2. **Responsive Design**
- Mobile-first approach for UAE users
- Adaptive layouts for desktop, tablet, and mobile
- Graceful degradation of features on smaller screens
- Touch-friendly interfaces for mobile UAE business users

### 3. **Accessibility & Internationalization**
- Support for Arabic (RTL) and English (LTR) layouts
- ARIA labels and screen reader optimization
- Keyboard navigation support
- High contrast mode compatibility

### 4. **Performance Optimization**
- Lazy loading for large customer lists
- Virtual scrolling for performance
- Optimistic updates for better UX
- Efficient state management to minimize re-renders

## Component Hierarchy

```
📁 src/components/consolidation/
├── 📁 queue/
│   ├── ConsolidationQueue.tsx              # Main queue component
│   ├── ConsolidationQueueHeader.tsx        # Header with summary stats
│   ├── ConsolidationFilters.tsx            # Filter panel component
│   ├── ConsolidationTable.tsx              # Table view for desktop
│   ├── ConsolidationGrid.tsx               # Grid view for tablet
│   ├── ConsolidationList.tsx               # List view for mobile
│   └── CustomerConsolidationCard.tsx       # Individual customer card
├── 📁 actions/
│   ├── BulkActionPanel.tsx                 # Bulk action controls
│   ├── BulkActionConfirmation.tsx          # Confirmation dialogs
│   ├── ConsolidationActionMenu.tsx         # Individual customer actions
│   └── QuickActionButtons.tsx              # Send/Schedule quick actions
├── 📁 preview/
│   ├── ConsolidationPreviewModal.tsx       # Email preview modal
│   ├── EmailContentPreview.tsx             # Email content display
│   ├── ConsolidationSummary.tsx            # Invoice summary
│   └── AttachmentSettings.tsx              # PDF attachment options
├── 📁 analytics/
│   ├── ConsolidationMetricsCard.tsx        # Key metrics display
│   ├── EffectivenessChart.tsx              # Charts for effectiveness
│   ├── VolumeReductionChart.tsx            # Email volume charts
│   └── ConsolidationTrends.tsx             # Historical trends
├── 📁 scheduling/
│   ├── ConsolidationScheduler.tsx          # Schedule email modal
│   ├── BusinessHoursSelector.tsx           # UAE business hours
│   ├── CulturalComplianceIndicator.tsx     # Prayer times, holidays
│   └── ScheduleCalendar.tsx                # Calendar widget
└── 📁 shared/
    ├── ConsolidationStatus.tsx             # Status indicators
    ├── PriorityBadge.tsx                   # Priority level badges
    ├── EscalationIndicator.tsx             # Escalation level display
    ├── ContactEligibility.tsx              # Contact status display
    ├── ConsolidationEmpty.tsx              # Empty state component
    └── ConsolidationError.tsx              # Error boundary component
```

## Integration Points

### 1. **Dashboard Integration**

#### Main Dashboard (/dashboard/page.tsx)
```typescript
// Add consolidation summary widget
<ConsolidationMetricsCard
  companyId={session.user.companyId}
  showQuickActions={true}
  className="col-span-2"
/>
```

#### Navigation Menu
```typescript
// Add to src/components/navigation/dashboard-nav.tsx
{
  title: t('consolidation.title'),
  href: '/dashboard/consolidation',
  icon: Users,
  description: t('consolidation.description')
}
```

### 2. **Route Structure**

```
📁 src/app/[locale]/dashboard/consolidation/
├── page.tsx                    # Main consolidation queue
├── analytics/
│   └── page.tsx               # Detailed analytics
├── history/
│   └── page.tsx               # Consolidation history
├── settings/
│   └── page.tsx               # Consolidation preferences
└── preview/
    └── [customerId]/
        └── page.tsx           # Customer consolidation preview
```

### 3. **State Management Integration**

#### Existing Stores Integration
```typescript
// Leverage existing customer store for customer data
const { customers } = useCustomerStore()

// Integrate with invoice store for invoice details
const { invoices } = useInvoiceStore()

// Use activity store for logging consolidation actions
const { logActivity } = useActivityStore()

// Email template integration
const { templates } = useEmailTemplateStore()
```

#### New Consolidation Store
```typescript
// Primary consolidation state management
const {
  candidates,
  selectedCustomers,
  executeBulkAction,
  previewConsolidation
} = useConsolidationStore()
```

### 4. **UI Component Integration**

#### Existing shadcn/ui Components
- **Table** - For desktop consolidation queue
- **Card** - For customer consolidation cards
- **Badge** - For priority and status indicators
- **Button** - For actions and bulk operations
- **Dialog** - For preview and confirmation modals
- **Select** - For filters and template selection
- **Checkbox** - For customer selection
- **Progress** - For bulk operation progress
- **Tabs** - For different views (queue, analytics, history)

#### New Custom Components
- **ConsolidationQueue** - Main queue component
- **CustomerConsolidationCard** - Customer card with consolidation data
- **BulkActionPanel** - Bulk operation controls
- **ConsolidationPreviewModal** - Email preview functionality

## Mobile-First Design Strategy

### Breakpoint Strategy
```scss
// Mobile (320px - 768px)
.consolidation-mobile {
  @apply block md:hidden;
}

// Tablet (768px - 1024px)
.consolidation-tablet {
  @apply hidden md:block lg:hidden;
}

// Desktop (1024px+)
.consolidation-desktop {
  @apply hidden lg:block;
}
```

### Mobile Optimizations
1. **Stacked Layout** - Vertical card layout for easy scrolling
2. **Touch Targets** - Minimum 44px touch targets
3. **Simplified Actions** - Swipe gestures for quick actions
4. **Compact Information** - Essential data only on mobile
5. **Pull-to-Refresh** - Native mobile refresh patterns

### Tablet Optimizations
1. **Grid Layout** - 2-3 column grid for customer cards
2. **Side Panel** - Collapsible filter panel
3. **Dual Pane** - List and detail view
4. **Touch + Keyboard** - Support for both input methods

### Desktop Optimizations
1. **Table View** - Comprehensive data table
2. **Multi-Panel** - Filters, queue, and preview panels
3. **Keyboard Shortcuts** - Power user efficiency
4. **Bulk Operations** - Advanced multi-select capabilities

## Accessibility Implementation

### ARIA Support
```typescript
// Customer selection table
<table role="grid" aria-label="Customer consolidation queue">
  <thead role="rowgroup">
    <tr role="row">
      <th role="columnheader" aria-sort="descending">Priority</th>
      {/* ... */}
    </tr>
  </thead>
  <tbody role="rowgroup">
    {candidates.map(candidate => (
      <tr role="row" aria-selected={isSelected}>
        <td role="gridcell">{/* ... */}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### Screen Reader Support
```typescript
// Live regions for dynamic updates
<div aria-live="polite" aria-atomic="true">
  {`${selectedCount} customers selected for consolidation`}
</div>

// Descriptive labels
<button aria-describedby="send-consolidation-help">
  Send Consolidated Reminders
</button>
<div id="send-consolidation-help" className="sr-only">
  Sends payment reminders to selected customers with multiple overdue invoices
</div>
```

### Keyboard Navigation
```typescript
// Tab order management
const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      // Navigate to next customer
      break
    case 'ArrowUp':
      // Navigate to previous customer
      break
    case ' ': // Spacebar
      // Toggle customer selection
      break
    case 'Enter':
      // Open customer preview
      break
  }
}
```

## RTL (Arabic) Support

### Layout Adjustments
```scss
// RTL-aware layouts
.consolidation-container {
  @apply flex flex-row-reverse; /* RTL */

  &[dir="ltr"] {
    @apply flex-row; /* LTR override */
  }
}

// Number and currency alignment
.amount-display {
  @apply text-left; /* Numbers always LTR */

  html[dir="rtl"] & {
    @apply text-right; /* But align right in RTL */
  }
}
```

### Component Adjustments
```typescript
// Dynamic direction support
const { locale } = useLocale()
const isRTL = locale === 'ar'

return (
  <div dir={isRTL ? 'rtl' : 'ltr'} className={cn(
    'consolidation-queue',
    isRTL && 'rtl-layout'
  )}>
    {/* Component content */}
  </div>
)
```

## Performance Optimization Strategy

### Virtual Scrolling
```typescript
// Large list optimization
import { FixedSizeList as List } from 'react-window'

const ConsolidationQueue = ({ candidates }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <CustomerConsolidationCard candidate={candidates[index]} />
    </div>
  )

  return (
    <List
      height={600}
      itemCount={candidates.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  )
}
```

### Memoization
```typescript
// Expensive calculations
const priorityDistribution = useMemo(() => {
  return candidates.reduce((acc, candidate) => {
    const level = getPriorityLevel(candidate.priorityScore)
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}, [candidates])

// Component memoization
const CustomerConsolidationCard = memo(({ candidate, onSelect }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.candidate.customerId === nextProps.candidate.customerId &&
         prevProps.candidate.priorityScore === nextProps.candidate.priorityScore
})
```

### Lazy Loading
```typescript
// Code splitting for analytics
const ConsolidationAnalytics = lazy(() =>
  import('./analytics/ConsolidationAnalytics')
)

// Usage with Suspense
<Suspense fallback={<AnalyticsSkeletonLoader />}>
  <ConsolidationAnalytics />
</Suspense>
```

## Testing Strategy

### Component Testing
```typescript
// Jest + React Testing Library
describe('ConsolidationQueue', () => {
  it('renders customer list correctly', () => {
    render(
      <ConsolidationQueue
        candidates={mockCandidates}
        onSelectCustomer={mockOnSelect}
      />
    )

    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(mockCandidates.length + 1) // +1 for header
  })

  it('handles customer selection', async () => {
    const mockOnSelect = jest.fn()
    render(<ConsolidationQueue candidates={mockCandidates} onSelectCustomer={mockOnSelect} />)

    const firstCheckbox = screen.getAllByRole('checkbox')[1] // Skip select-all
    await user.click(firstCheckbox)

    expect(mockOnSelect).toHaveBeenCalledWith(mockCandidates[0].customerId, true)
  })
})
```

### E2E Testing
```typescript
// Playwright tests
test('consolidation workflow', async ({ page }) => {
  await page.goto('/dashboard/consolidation')

  // Select customers
  await page.getByRole('checkbox', { name: /customer-1/ }).click()
  await page.getByRole('checkbox', { name: /customer-2/ }).click()

  // Execute bulk action
  await page.getByRole('button', { name: /send consolidated reminders/i }).click()

  // Confirm action
  await page.getByRole('button', { name: /confirm/i }).click()

  // Verify success
  await expect(page.getByText(/reminders sent successfully/i)).toBeVisible()
})
```

## Performance Metrics

### Target Performance Goals
- **Initial Load** - < 2 seconds for 100 customers
- **Filter Response** - < 500ms for filter application
- **Bulk Actions** - < 1 second for selection of 50 customers
- **Mobile Responsiveness** - 60fps scrolling on mobile devices
- **Memory Usage** - < 100MB for 1000 customer records

### Monitoring
```typescript
// Performance monitoring
const ConsolidationQueue = () => {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure') {
          console.log(`${entry.name}: ${entry.duration}ms`)
        }
      })
    })

    observer.observe({ type: 'measure', buffered: true })

    return () => observer.disconnect()
  }, [])

  // Component implementation
}
```

This component architecture provides a solid foundation for implementing the consolidation feature in Sprint 2 and Sprint 3, ensuring seamless integration with the existing reminder-mvp system while delivering a superior user experience for UAE business users.