# Follow-up Automation Dashboard Components

## Overview

This directory contains the comprehensive UI components for Sprint 2.3: Follow-up Automation. These components provide a complete dashboard interface for managing and monitoring automated follow-up sequences in the UAE payment collection platform.

## Architecture

The follow-up automation dashboard is built with a modular component architecture that emphasizes:

- **Real-time monitoring** of sequence execution
- **UAE business compliance** with cultural and regulatory requirements
- **Intuitive user experience** for non-technical users
- **Comprehensive analytics** and performance tracking
- **Flexible automation controls** with manual override capabilities

## Core Components

### 1. AutomationDashboard
**File**: `automation-dashboard.tsx`

The main dashboard component that provides real-time monitoring of active sequences.

**Features**:
- Real-time status updates with configurable refresh intervals
- Tabbed interface for different views (Overview, Sequences, Metrics, Activity)
- Stats cards showing key performance indicators
- Integration with all other dashboard components
- Bulk action capabilities
- Export and settings management

**Props**:
```typescript
interface AutomationDashboardProps {
  companyId?: string
  refreshInterval?: number
  onSequenceClick?: (sequenceId: string) => void
  onInvoiceClick?: (invoiceId: string) => void
}
```

**Usage**:
```tsx
<AutomationDashboard
  companyId={session?.user?.companyId}
  refreshInterval={30000}
  onSequenceClick={(sequenceId) => {
    // Handle sequence selection
  }}
  onInvoiceClick={(invoiceId) => {
    router.push(`/dashboard/invoices/${invoiceId}`)
  }}
/>
```

### 2. ManualOverrideControls
**File**: `manual-override-controls.tsx`

Provides manual control capabilities for automation sequences with emergency controls.

**Features**:
- Global pause/resume controls
- Emergency stop functionality
- Bulk sequence management
- Individual sequence controls (pause, resume, skip, stop)
- Scheduled action capabilities
- UAE business hours compliance enforcement

**Props**:
```typescript
interface ManualOverrideControlsProps {
  sequences: SequenceOverride[]
  onBulkAction: (action: string, sequenceIds: string[], options?: any) => Promise<void>
  onSequenceAction: (sequenceId: string, action: string, options?: any) => Promise<void>
  companyId?: string
  disabled?: boolean
}
```

### 3. SequenceMetrics
**File**: `sequence-metrics.tsx`

Comprehensive performance analytics and metrics visualization.

**Features**:
- Email funnel performance tracking
- Time-series data visualization
- Sequence performance comparison
- UAE compliance metrics
- Performance trends analysis
- Exportable analytics data

**Key Metrics Tracked**:
- Email delivery rates
- Open and click-through rates
- Response and conversion rates
- Payment collection success
- UAE business compliance scores
- Cultural appropriateness metrics

### 4. SequenceTimeline
**File**: `sequence-timeline.tsx`

Visual timeline of follow-up activities and customer interactions.

**Features**:
- Chronological event timeline
- Real-time activity updates
- Event filtering and search
- Detailed event information
- Customer interaction tracking
- UAE compliance indicators

**Event Types**:
- `EMAIL_SENT` - Email successfully sent
- `EMAIL_OPENED` - Customer opened email
- `EMAIL_CLICKED` - Customer clicked email link
- `RESPONSE_RECEIVED` - Customer responded
- `PAYMENT_RECEIVED` - Payment was received
- `SEQUENCE_PAUSED` - Sequence was paused
- `SEQUENCE_RESUMED` - Sequence was resumed
- `STEP_SKIPPED` - Step was manually skipped
- `ERROR_OCCURRED` - System error occurred

### 5. FollowUpHistoryTable
**File**: `follow-up-history-table.tsx`

Detailed tabular view of all sent follow-up emails with comprehensive filtering.

**Features**:
- Sortable and filterable table
- Email engagement tracking
- Bulk actions on records
- Detailed email metadata
- Export capabilities
- Pagination support

**Table Columns**:
- Sent timestamp
- Customer information
- Invoice details
- Email subject
- Sequence and step information
- Delivery status
- Engagement metrics (opened, clicked, responded)
- Payment status

### 6. StatusIndicators
**File**: `status-indicators.tsx`

Visual status indicators and health monitoring for sequences.

**Features**:
- Real-time status visualization
- Health score indicators
- Performance trend arrows
- Priority distribution
- Compliance status
- Interactive status filtering

**Status Types**:
- `ACTIVE` - Sequence is running
- `PAUSED` - Sequence is temporarily paused
- `COMPLETED` - Sequence finished successfully
- `ERROR` - Sequence encountered errors
- `SCHEDULED` - Sequence scheduled for future
- `DRAFT` - Sequence not yet activated

### 7. BulkSequenceActions
**File**: `bulk-sequence-actions.tsx`

Advanced bulk operations management for multiple sequences.

**Features**:
- Multi-sequence selection
- Bulk operation execution
- Operation status monitoring
- Import/export capabilities
- Scheduled bulk actions
- Operation history tracking

**Supported Actions**:
- Activate/Pause multiple sequences
- Duplicate sequences
- Archive sequences
- Delete sequences
- Schedule future actions
- Export sequence configurations
- Import sequence templates

## Integration Points

### Store Integration
All components integrate with the Zustand follow-up store:

```typescript
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'

const {
  sequences,
  fetchSequences,
  addSequence,
  updateSequence,
  deleteSequence,
  toggleSequenceActive
} = useFollowUpSequenceStore()
```

### API Endpoints
Components expect these API endpoints to be available:

- `GET /api/follow-up-sequences/active` - Active sequence data
- `POST /api/follow-up-sequences/bulk-action` - Bulk operations
- `GET /api/follow-up-sequences/timeline` - Timeline events
- `GET /api/follow-up-sequences/history` - Email history
- `GET /api/follow-up-sequences/metrics` - Performance metrics

### Real-time Updates
Components support real-time updates through:
- Configurable polling intervals
- WebSocket integration (planned)
- Manual refresh capabilities
- Event-driven updates

## UAE Business Compliance

All components include UAE-specific business logic:

### Business Hours
- Sunday to Thursday: 9:00 AM - 6:00 PM GST
- Automatic scheduling outside business hours
- Holiday calendar integration
- Prayer time avoidance

### Cultural Considerations
- Respectful messaging tone
- Appropriate urgency levels
- Cultural sensitivity scoring
- Bilingual support (Arabic/English)

### Compliance Metrics
- Business hours compliance percentage
- Holiday respect tracking
- Prayer time avoidance rate
- Cultural appropriateness score

## Styling and Theming

Components use Tailwind CSS with shadcn/ui components:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
```

### Color Scheme
- **Green**: Success states, active sequences, positive metrics
- **Blue**: Information, primary actions, neutral states
- **Yellow**: Warning states, paused sequences, attention needed
- **Red**: Error states, critical issues, destructive actions
- **Purple**: Special features, UAE compliance, premium features

## Testing

Components include comprehensive test coverage:

```bash
# Run tests
npm test src/components/follow-ups

# Run tests with coverage
npm test src/components/follow-ups -- --coverage

# Run specific component tests
npm test automation-dashboard.test.tsx
```

### Testing Utilities
The test files include utilities for creating mock data:

```typescript
import { createMockSequence, createMockTimelineEvent } from './__tests__/automation-dashboard.test'

const mockSequence = createMockSequence({
  name: 'Custom Test Sequence',
  status: 'ACTIVE'
})
```

## Performance Considerations

### Optimization Strategies
- **Virtualization**: Large lists use virtual scrolling
- **Memoization**: Expensive calculations are memoized
- **Lazy Loading**: Components load data on demand
- **Debounced Updates**: Real-time updates are debounced
- **Efficient Filtering**: Client-side filtering for responsive UX

### Memory Management
- Automatic cleanup of intervals and subscriptions
- Efficient state management with Zustand
- Proper event listener cleanup
- Optimized re-rendering with React.memo

## Accessibility

Components follow WCAG 2.1 AA guidelines:

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and descriptions
- **Color Contrast**: Meets contrast requirements
- **Focus Management**: Clear focus indicators
- **Semantic HTML**: Proper semantic structure

## Internationalization

Components support Arabic and English:

```typescript
import { useTranslations } from 'next-intl'

const t = useTranslations('followUps.dashboard')
```

### Translation Keys
- `followUps.dashboard.*` - Dashboard specific text
- `followUps.metrics.*` - Metrics and analytics text
- `followUps.timeline.*` - Timeline specific text
- `followUps.controls.*` - Control actions text
- `followUps.status.*` - Status indicators text

## Future Enhancements

### Planned Features
1. **Real-time WebSocket Integration**
   - Live sequence updates
   - Real-time notifications
   - Collaborative editing indicators

2. **Advanced Analytics**
   - Predictive analytics
   - A/B testing support
   - Machine learning insights

3. **Mobile Optimization**
   - Responsive design improvements
   - Touch-friendly controls
   - Mobile-specific UX patterns

4. **Enhanced UAE Features**
   - Ramadan scheduling
   - Multiple prayer time sources
   - Advanced cultural scoring

### Integration Roadmap
- **CRM Integration**: Connect with popular CRM systems
- **Accounting Software**: Direct integration with accounting platforms
- **Payment Gateways**: Enhanced payment tracking
- **Communication Channels**: SMS and WhatsApp support

## Contributing

When contributing to these components:

1. **Follow TypeScript Patterns**: Use the defined interfaces and types
2. **Maintain UAE Compliance**: Include cultural and business considerations
3. **Add Tests**: Include comprehensive test coverage
4. **Update Documentation**: Keep README and code comments current
5. **Consider Accessibility**: Follow WCAG guidelines
6. **Performance**: Optimize for large datasets and real-time updates

## Support

For questions or issues with these components:

1. Check the existing tests for usage examples
2. Review the TypeScript interfaces for prop requirements
3. Consult the integration examples in the main follow-ups page
4. Check the Zustand store implementation for data flow

## License

These components are part of the UAE Pay MVP project and follow the project's licensing terms.