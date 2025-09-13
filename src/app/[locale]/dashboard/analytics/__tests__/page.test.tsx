/**
 * Comprehensive Test Suite for Analytics Page
 * Tests unified dashboard integration, export capabilities, and authentication
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import AnalyticsPage from '../page'
import {
  mockDashboardMetrics,
  mockPerformanceData,
  mockEmailMetrics,
  mockAnalyticsApi,
  mockCompany,
  mockUser,
  mockAuthContext,
  waitForLoadingToFinish,
  setupMatchMedia,
  checkAriaLabels,
  checkKeyboardNavigation,
  mockWindowResizeTo
} from '../../../../components/analytics/__tests__/test-utils'

// Mock Next.js dependencies
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    replace: jest.fn()
  }),
  useSearchParams: () => ({
    get: jest.fn((key: string) => {
      const params: Record<string, string> = {
        'dateRange': '30',
        'section': 'overview',
        'export': '',
        'sequenceId': '',
        'templateId': ''
      }
      return params[key] || null
    }),
    set: jest.fn(),
    delete: jest.fn(),
    toString: jest.fn().mockReturnValue('dateRange=30&section=overview')
  }),
  usePathname: () => '/en/dashboard/analytics',
  notFound: jest.fn()
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useMessages: () => ({}),
}))

// Mock layout and auth
jest.mock('../../layout', () => {
  return function MockLayout({ children }: { children: React.ReactNode }) {
    return (
      <div data-testid="dashboard-layout">
        <nav data-testid="dashboard-nav">
          <div>Analytics</div>
        </nav>
        <main>{children}</main>
      </div>
    )
  }
})

jest.mock('@/lib/auth-utils', () => ({
  requireAuth: jest.fn().mockResolvedValue(mockAuthContext),
  requireRole: jest.fn().mockResolvedValue(mockAuthContext),
  canAccessAnalytics: jest.fn().mockReturnValue(true)
}))

// Mock analytics components
jest.mock('@/components/analytics/analytics-dashboard', () => ({
  AnalyticsDashboard: ({ companyId, dateRange, locale }: any) => (
    <div data-testid="analytics-dashboard" data-company-id={companyId} data-date-range={dateRange} data-locale={locale}>
      Analytics Dashboard Component
    </div>
  )
}))

jest.mock('@/components/analytics/sequence-performance', () => ({
  SequencePerformance: ({ sequenceId, companyId, dateRange }: any) => (
    <div data-testid="sequence-performance" data-sequence-id={sequenceId} data-company-id={companyId} data-date-range={dateRange}>
      Sequence Performance Component
    </div>
  )
}))

jest.mock('@/components/analytics/email-analytics', () => ({
  EmailAnalytics: ({ companyId, dateRange, templateId }: any) => (
    <div data-testid="email-analytics" data-company-id={companyId} data-date-range={dateRange} data-template-id={templateId}>
      Email Analytics Component
    </div>
  )
}))

// Mock API endpoints
global.fetch = jest.fn()

describe('Analytics Page', () => {
  const mockParams = {
    locale: 'en'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupMatchMedia()
    
    // Setup successful auth response
    const { requireAuth } = require('@/lib/auth-utils')
    requireAuth.mockResolvedValue(mockAuthContext)
    
    // Setup API mocks
    mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
      success: true,
      data: mockDashboardMetrics,
      timestamp: new Date().toISOString()
    })
    
    mockAnalyticsApi.getSequencePerformance.mockResolvedValue({
      success: true,
      data: mockPerformanceData,
      timestamp: new Date().toISOString()
    })
    
    mockAnalyticsApi.getEmailAnalytics.mockResolvedValue({
      success: true,
      data: mockEmailMetrics,
      timestamp: new Date().toISOString()
    })
    
    // Mock fetch for exports
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock-pdf-content'], { type: 'application/pdf' })),
      json: () => Promise.resolve({ success: true, downloadUrl: 'https://example.com/export.pdf' })
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Page Rendering and Authentication', () => {
    it('should render the analytics page with proper layout', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
      expect(screen.getByTestId('analytics-page')).toBeInTheDocument()
      expect(screen.getByText('Analytics Overview')).toBeInTheDocument()
    })

    it('should enforce authentication requirements', async () => {
      const { requireAuth } = require('@/lib/auth-utils')
      requireAuth.mockRejectedValue(new Error('Unauthorized'))

      render(<AnalyticsPage params={mockParams} />)
      
      await waitFor(() => {
        expect(screen.getByText(/unauthorized/i)).toBeInTheDocument()
      })
    })

    it('should check analytics access permissions', async () => {
      const { canAccessAnalytics } = require('@/lib/auth-utils')
      canAccessAnalytics.mockReturnValue(false)

      render(<AnalyticsPage params={mockParams} />)
      
      await waitFor(() => {
        expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument()
      })
    })

    it('should handle role-based access control', async () => {
      const restrictedUser = {
        ...mockUser,
        role: 'VIEWER' // Limited role
      }
      
      const { requireAuth } = require('@/lib/auth-utils')
      requireAuth.mockResolvedValue({
        user: restrictedUser,
        company: mockCompany
      })

      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Should show limited view
      expect(screen.getByText('Limited Analytics View')).toBeInTheDocument()
      expect(screen.queryByTestId('export-controls')).not.toBeInTheDocument()
    })
  })

  describe('Unified Dashboard Integration', () => {
    it('should display the main analytics dashboard by default', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const dashboard = screen.getByTestId('analytics-dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(dashboard).toHaveAttribute('data-company-id', mockCompany.id)
      expect(dashboard).toHaveAttribute('data-date-range', '30')
      expect(dashboard).toHaveAttribute('data-locale', 'en')
    })

    it('should render analytics navigation with all sections', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('analytics-navigation')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /sequences/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /emails/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /cultural insights/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /reports/i })).toBeInTheDocument()
    })

    it('should handle section switching correctly', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Switch to sequences section
      await user.click(screen.getByRole('tab', { name: /sequences/i }))
      
      expect(screen.getByTestId('sequence-performance')).toBeInTheDocument()
      expect(screen.queryByTestId('analytics-dashboard')).not.toBeInTheDocument()

      // Switch to emails section
      await user.click(screen.getByRole('tab', { name: /emails/i }))
      
      expect(screen.getByTestId('email-analytics')).toBeInTheDocument()
      expect(screen.queryByTestId('sequence-performance')).not.toBeInTheDocument()
    })

    it('should preserve URL state when switching sections', async () => {
      const user = userEvent.setup()
      const mockRouter = require('next/navigation').useRouter()
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /sequences/i }))
      
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining('section=sequences')
      )
    })
  })

  describe('Date Range Filtering', () => {
    it('should provide comprehensive date range options', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('global-date-range-select')
      await userEvent.click(dateRangeSelect)

      expect(screen.getByText('Last 7 days')).toBeInTheDocument()
      expect(screen.getByText('Last 30 days')).toBeInTheDocument()
      expect(screen.getByText('Last 90 days')).toBeInTheDocument()
      expect(screen.getByText('Last 1 year')).toBeInTheDocument()
      expect(screen.getByText('Custom range')).toBeInTheDocument()
    })

    it('should handle date range changes across all components', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('global-date-range-select')
      await user.click(dateRangeSelect)
      await user.click(screen.getByText('Last 7 days'))

      await waitFor(() => {
        const dashboard = screen.getByTestId('analytics-dashboard')
        expect(dashboard).toHaveAttribute('data-date-range', '7')
      })
    })

    it('should support custom date range selection', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('global-date-range-select')
      await user.click(dateRangeSelect)
      await user.click(screen.getByText('Custom range'))

      expect(screen.getByTestId('custom-date-range-modal')).toBeInTheDocument()
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
      expect(screen.getByLabelText('End Date')).toBeInTheDocument()
    })

    it('should validate custom date ranges', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('global-date-range-select')
      await user.click(dateRangeSelect)
      await user.click(screen.getByText('Custom range'))

      // Set invalid date range (end before start)
      const startDateInput = screen.getByLabelText('Start Date')
      const endDateInput = screen.getByLabelText('End Date')
      
      await user.type(startDateInput, '2024-03-01')
      await user.type(endDateInput, '2024-02-01')
      
      const applyButton = screen.getByText('Apply')
      await user.click(applyButton)

      expect(screen.getByText('End date must be after start date')).toBeInTheDocument()
    })
  })

  describe('Export Capabilities', () => {
    it('should display export controls for authorized users', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('export-controls')).toBeInTheDocument()
      expect(screen.getByText('Export Analytics')).toBeInTheDocument()
    })

    it('should provide multiple export format options', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics-button')
      await user.click(exportButton)

      expect(screen.getByTestId('export-options-menu')).toBeInTheDocument()
      expect(screen.getByText('Export to PDF')).toBeInTheDocument()
      expect(screen.getByText('Export to Excel')).toBeInTheDocument()
      expect(screen.getByText('Export to CSV')).toBeInTheDocument()
    })

    it('should handle PDF export with charts', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics-button')
      await user.click(exportButton)
      await user.click(screen.getByText('Export to PDF'))

      expect(screen.getByTestId('export-progress-modal')).toBeInTheDocument()
      expect(screen.getByText('Generating PDF report...')).toBeInTheDocument()

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/analytics/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: 'pdf',
            section: 'comprehensive',
            companyId: mockCompany.id,
            dateRange: '30',
            includeCharts: true,
            includeRecommendations: true
          })
        })
      })
    })

    it('should handle Excel export for data analysis', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics-button')
      await user.click(exportButton)
      await user.click(screen.getByText('Export to Excel'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/analytics/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: 'excel',
            section: 'comprehensive',
            companyId: mockCompany.id,
            dateRange: '30',
            includeCharts: false,
            includeRecommendations: true
          })
        })
      })
    })

    it('should show export progress and completion status', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics-button')
      await user.click(exportButton)
      await user.click(screen.getByText('Export to PDF'))

      // Check progress modal
      expect(screen.getByTestId('export-progress-modal')).toBeInTheDocument()
      expect(screen.getByText('Generating PDF report...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('Export completed successfully!')).toBeInTheDocument()
        expect(screen.getByText('Download Report')).toBeInTheDocument()
      })
    })

    it('should handle export errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Export failed'))
      
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics-button')
      await user.click(exportButton)
      await user.click(screen.getByText('Export to PDF'))

      await waitFor(() => {
        expect(screen.getByText('Export failed')).toBeInTheDocument()
        expect(screen.getByText('Please try again later')).toBeInTheDocument()
      })
    })
  })

  describe('Custom Reports Section', () => {
    it('should display 6 pre-built report types', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /reports/i }))

      expect(screen.getByTestId('custom-reports-section')).toBeInTheDocument()
      expect(screen.getByText('Pre-built Reports')).toBeInTheDocument()
      
      // Check all 6 report types
      expect(screen.getByText('Comprehensive Analytics')).toBeInTheDocument()
      expect(screen.getByText('Sequence Performance')).toBeInTheDocument()
      expect(screen.getByText('Email Engagement')).toBeInTheDocument()
      expect(screen.getByText('Cultural Insights')).toBeInTheDocument()
      expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      expect(screen.getByText('Optimization Report')).toBeInTheDocument()
      expect(screen.getByText('Deliverability Analysis')).toBeInTheDocument()
      expect(screen.getByText('Revenue Impact')).toBeInTheDocument()
    })

    it('should allow customization of report parameters', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /reports/i }))

      const comprehensiveReport = screen.getByTestId('report-comprehensive')
      await user.click(comprehensiveReport)

      expect(screen.getByTestId('report-customization-modal')).toBeInTheDocument()
      expect(screen.getByText('Customize Report')).toBeInTheDocument()
      expect(screen.getByLabelText('Date Range')).toBeInTheDocument()
      expect(screen.getByLabelText('Include Charts')).toBeInTheDocument()
      expect(screen.getByLabelText('Include Recommendations')).toBeInTheDocument()
      expect(screen.getByLabelText('Output Format')).toBeInTheDocument()
    })

    it('should support scheduled report generation', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /reports/i }))

      const scheduleButton = screen.getByTestId('schedule-reports-button')
      await user.click(scheduleButton)

      expect(screen.getByTestId('schedule-reports-modal')).toBeInTheDocument()
      expect(screen.getByText('Schedule Automated Reports')).toBeInTheDocument()
      expect(screen.getByLabelText('Frequency')).toBeInTheDocument()
      expect(screen.getByLabelText('Recipients')).toBeInTheDocument()
      expect(screen.getByLabelText('Report Type')).toBeInTheDocument()
    })
  })

  describe('Performance and User Experience', () => {
    it('should implement lazy loading for analytics sections', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Initially only overview should be loaded
      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument()
      expect(screen.queryByTestId('sequence-performance')).not.toBeInTheDocument()
      expect(screen.queryByTestId('email-analytics')).not.toBeInTheDocument()
    })

    it('should handle loading states for each section', async () => {
      const user = userEvent.setup()
      
      // Delay the API response to test loading state
      mockAnalyticsApi.getSequencePerformance.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /sequences/i }))

      expect(screen.getByTestId('section-loading')).toBeInTheDocument()
      expect(screen.getByText('Loading sequence analytics...')).toBeInTheDocument()
    })

    it('should cache analytics data to improve performance', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Switch to sequences and back to overview
      await user.click(screen.getByRole('tab', { name: /sequences/i }))
      await user.click(screen.getByRole('tab', { name: /overview/i }))

      // Dashboard should load immediately from cache
      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument()
      expect(mockAnalyticsApi.getDashboardMetrics).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should handle concurrent data fetching efficiently', async () => {
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Rapidly switch between sections
      await user.click(screen.getByRole('tab', { name: /sequences/i }))
      await user.click(screen.getByRole('tab', { name: /emails/i }))
      await user.click(screen.getByRole('tab', { name: /overview/i }))

      // Should not cause race conditions or multiple unnecessary requests
      expect(mockAnalyticsApi.getDashboardMetrics).toHaveBeenCalledTimes(1)
      expect(mockAnalyticsApi.getSequencePerformance).toHaveBeenCalledTimes(1)
      expect(mockAnalyticsApi.getEmailAnalytics).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility and Internationalization', () => {
    it('should have proper ARIA labels and navigation structure', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      checkAriaLabels(screen.getByTestId('analytics-page'))
      
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveAttribute('aria-label', 'Analytics Dashboard')
      
      const navigation = screen.getByTestId('analytics-navigation')
      expect(navigation).toHaveAttribute('role', 'tablist')
    })

    it('should support keyboard navigation through all sections', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await checkKeyboardNavigation(screen.getByTestId('analytics-page'))
    })

    it('should handle Arabic locale correctly', async () => {
      const arabicParams = { locale: 'ar' }
      render(<AnalyticsPage params={arabicParams} />)
      
      await waitForLoadingToFinish()

      const analyticsPage = screen.getByTestId('analytics-page')
      expect(analyticsPage).toHaveAttribute('dir', 'rtl')
      
      const dashboard = screen.getByTestId('analytics-dashboard')
      expect(dashboard).toHaveAttribute('data-locale', 'ar')
    })

    it('should provide proper screen reader announcements', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const liveRegion = screen.getByTestId('analytics-live-region')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile devices', async () => {
      mockWindowResizeTo(375, 667)
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const analyticsPage = screen.getByTestId('analytics-page')
      expect(analyticsPage).toHaveClass('mobile-layout')
      
      const navigation = screen.getByTestId('analytics-navigation')
      expect(navigation).toHaveClass('mobile-tabs')
    })

    it('should handle touch interactions on mobile', async () => {
      mockWindowResizeTo(375, 667)
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const tabList = screen.getByRole('tablist')
      
      // Simulate touch swipe gesture
      fireEvent.touchStart(tabList, { touches: [{ clientX: 100, clientY: 100 }] })
      fireEvent.touchMove(tabList, { touches: [{ clientX: 200, clientY: 100 }] })
      fireEvent.touchEnd(tabList)

      // Should support swipe navigation
      const activeTab = screen.getByRole('tab', { selected: true })
      expect(activeTab).toHaveTextContent('Sequences')
    })

    it('should optimize mobile export experience', async () => {
      mockWindowResizeTo(375, 667)
      const user = userEvent.setup()
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics-button')
      await user.click(exportButton)

      // Should show mobile-optimized export options
      expect(screen.getByTestId('mobile-export-menu')).toBeInTheDocument()
      expect(screen.getByText('PDF (Optimized for mobile)')).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network connectivity issues', async () => {
      mockAnalyticsApi.getDashboardMetrics.mockRejectedValue(new Error('Network error'))
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('network-error-banner')).toBeInTheDocument()
        expect(screen.getByText('Connection issue detected')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('should handle partial data loading gracefully', async () => {
      mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: mockDashboardMetrics,
        timestamp: new Date().toISOString()
      })
      
      mockAnalyticsApi.getSequencePerformance.mockRejectedValue(new Error('Sequence data unavailable'))
      
      const user = userEvent.setup()
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /sequences/i }))

      expect(screen.getByText('Sequence data temporarily unavailable')).toBeInTheDocument()
      expect(screen.getByText('Other analytics sections remain available')).toBeInTheDocument()
    })

    it('should handle session expiration during analytics usage', async () => {
      const { requireAuth } = require('@/lib/auth-utils')
      requireAuth.mockRejectedValue(new Error('Session expired'))
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('session-expired-modal')).toBeInTheDocument()
        expect(screen.getByText('Your session has expired')).toBeInTheDocument()
        expect(screen.getByText('Please sign in again')).toBeInTheDocument()
      })
    })

    it('should handle insufficient data scenarios', async () => {
      const emptyMetrics = {
        overview: { ...mockDashboardMetrics.overview, totalEmailsSent: 0 },
        trends: { emailVolume: [], conversionFunnel: [], performanceOverTime: [] },
        businessHours: mockDashboardMetrics.businessHours,
        culturalMetrics: mockDashboardMetrics.culturalMetrics,
        sequenceTypes: []
      }
      
      mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: emptyMetrics,
        timestamp: new Date().toISOString()
      })
      
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('empty-analytics-state')).toBeInTheDocument()
      expect(screen.getByText('No analytics data available')).toBeInTheDocument()
      expect(screen.getByText('Start creating sequences to see analytics')).toBeInTheDocument()
    })
  })

  describe('Real-time Updates and Notifications', () => {
    it('should show data freshness indicators', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('data-freshness-indicator')).toBeInTheDocument()
      expect(screen.getByText(/last updated/i)).toBeInTheDocument()
    })

    it('should handle real-time data updates', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Simulate real-time update
      const updatedMetrics = {
        ...mockDashboardMetrics,
        overview: {
          ...mockDashboardMetrics.overview,
          totalEmailsSent: 13000 // Updated value
        }
      }

      mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: updatedMetrics,
        timestamp: new Date().toISOString()
      })

      // Trigger manual refresh
      const refreshButton = screen.getByTestId('refresh-analytics')
      await userEvent.click(refreshButton)

      await waitFor(() => {
        expect(screen.getByText('Analytics data updated')).toBeInTheDocument()
      })
    })

    it('should display update notifications appropriately', async () => {
      render(<AnalyticsPage params={mockParams} />)
      
      await waitForLoadingToFinish()

      // Should show subtle notification for successful updates
      const refreshButton = screen.getByTestId('refresh-analytics')
      await userEvent.click(refreshButton)

      expect(screen.getByTestId('update-notification')).toBeInTheDocument()
      expect(screen.getByText('Data refreshed successfully')).toBeInTheDocument()
    })
  })
})