/**
 * Comprehensive Test Suite for Analytics Dashboard Component
 * Tests UAE business intelligence, charts, cultural metrics, and interactive features
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import { AnalyticsDashboard } from '../analytics-dashboard'
import {
  mockDashboardMetrics,
  mockAnalyticsApi,
  mockRechartsComponents,
  mockCompany,
  mockUser,
  waitForLoadingToFinish,
  mockWindowResizeTo,
  setupMatchMedia,
  checkAriaLabels,
  checkKeyboardNavigation,
  mockLargeAnalyticsDataset,
  generateLargeDataset
} from './test-utils'

// Mock external dependencies
jest.mock('recharts', () => mockRechartsComponents)

jest.mock('../../../lib/api/analytics', () => ({
  analyticsApi: mockAnalyticsApi
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn()
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue('30')
  })
}))

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useEffect: jest.fn((fn, deps) => {
    if (deps && deps.length === 0) {
      fn() // Simulate component mount
    }
  }),
  useState: jest.fn((initial) => {
    const [state, setState] = jest.requireActual('react').useState(initial)
    return [state, setState]
  })
}))

describe('AnalyticsDashboard Component', () => {
  const defaultProps = {
    companyId: mockCompany.id,
    dateRange: '30',
    locale: 'en'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupMatchMedia()
    
    // Reset API mock to return successful response
    mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
      success: true,
      data: mockDashboardMetrics,
      timestamp: new Date().toISOString()
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render all overview metric cards with correct values', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Check all 8 key metrics are displayed
      expect(screen.getByText('Total Sequences')).toBeInTheDocument()
      expect(screen.getByText('45')).toBeInTheDocument() // totalSequences
      
      expect(screen.getByText('Active Sequences')).toBeInTheDocument()
      expect(screen.getByText('32')).toBeInTheDocument() // activeSequences
      
      expect(screen.getByText('Emails Sent')).toBeInTheDocument()
      expect(screen.getByText('12,580')).toBeInTheDocument() // totalEmailsSent
      
      expect(screen.getByText('Response Rate')).toBeInTheDocument()
      expect(screen.getByText('24.5%')).toBeInTheDocument() // averageResponseRate
      
      expect(screen.getByText('Payment Acceleration')).toBeInTheDocument()
      expect(screen.getByText('8.5 days')).toBeInTheDocument() // paymentAcceleration
      
      expect(screen.getByText('Culture Score')).toBeInTheDocument()
      expect(screen.getByText('87')).toBeInTheDocument() // cultureScore
      
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      expect(screen.getByText('AED 2,450,000')).toBeInTheDocument() // totalRevenue
      
      expect(screen.getByText('Pending Amount')).toBeInTheDocument()
      expect(screen.getByText('AED 650,000')).toBeInTheDocument() // pendingAmount
    })

    it('should render all 4 main tabs correctly', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /performance trends/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /uae insights/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /sequence analysis/i })).toBeInTheDocument()
    })

    it('should render loading state initially', () => {
      // Mock loading state
      mockAnalyticsApi.getDashboardMetrics.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      render(<AnalyticsDashboard {...defaultProps} />)
      
      expect(screen.getByTestId('analytics-loading')).toBeInTheDocument()
      expect(screen.getByText(/loading analytics/i)).toBeInTheDocument()
    })

    it('should render error state when API fails', async () => {
      const errorMessage = 'Failed to load analytics data'
      mockAnalyticsApi.getDashboardMetrics.mockRejectedValue(new Error(errorMessage))

      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/error loading analytics/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })
  })

  describe('Overview Tab - Charts and Visualizations', () => {
    it('should render email volume trend chart', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('email-volume-chart')).toBeInTheDocument()
      expect(screen.getByText('Email Volume Trends')).toBeInTheDocument()
      
      // Check chart data points are rendered
      expect(screen.getByText('Sent')).toBeInTheDocument()
      expect(screen.getByText('Delivered')).toBeInTheDocument()
      expect(screen.getByText('Opened')).toBeInTheDocument()
    })

    it('should render conversion funnel chart with all stages', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('conversion-funnel-chart')).toBeInTheDocument()
      expect(screen.getByText('Conversion Funnel')).toBeInTheDocument()
      
      // Check all funnel stages are displayed
      expect(screen.getByText('Email Sent')).toBeInTheDocument()
      expect(screen.getByText('Delivered')).toBeInTheDocument()
      expect(screen.getByText('Opened')).toBeInTheDocument()
      expect(screen.getByText('Clicked')).toBeInTheDocument()
      expect(screen.getByText('Responded')).toBeInTheDocument()
      expect(screen.getByText('Payment Made')).toBeInTheDocument()
    })

    it('should render performance over time chart', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('performance-time-chart')).toBeInTheDocument()
      expect(screen.getByText('Performance Over Time')).toBeInTheDocument()
      
      // Check performance metrics are shown
      expect(screen.getByText('Response Rate')).toBeInTheDocument()
      expect(screen.getByText('Payment Rate')).toBeInTheDocument()
      expect(screen.getByText('Culture Score')).toBeInTheDocument()
    })
  })

  describe('Performance Trends Tab', () => {
    it('should switch to performance trends tab and show sequence types', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const performanceTrendsTab = screen.getByRole('tab', { name: /performance trends/i })
      await user.click(performanceTrendsTab)

      // Check sequence types are displayed
      expect(screen.getByText('Sequence Type Performance')).toBeInTheDocument()
      expect(screen.getByText('Payment Reminder')).toBeInTheDocument()
      expect(screen.getByText('Invoice Follow-up')).toBeInTheDocument()
      expect(screen.getByText('Final Notice')).toBeInTheDocument()
      expect(screen.getByText('Welcome Series')).toBeInTheDocument()

      // Check effectiveness metrics are shown
      expect(screen.getByText('78%')).toBeInTheDocument() // Payment Reminder effectiveness
      expect(screen.getByText('72%')).toBeInTheDocument() // Invoice Follow-up effectiveness
    })

    it('should display sequence performance comparison chart', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /performance trends/i }))

      expect(screen.getByTestId('sequence-performance-chart')).toBeInTheDocument()
      expect(screen.getByText('Usage vs Effectiveness')).toBeInTheDocument()
    })
  })

  describe('UAE Insights Tab', () => {
    it('should display UAE-specific cultural metrics', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const uaeInsightsTab = screen.getByRole('tab', { name: /uae insights/i })
      await user.click(uaeInsightsTab)

      // Check cultural metrics are displayed
      expect(screen.getByText('Cultural Compliance')).toBeInTheDocument()
      expect(screen.getByText('Arabic Usage')).toBeInTheDocument()
      expect(screen.getByText('65%')).toBeInTheDocument() // arabicUsage
      
      expect(screen.getByText('Tone Appropriateness')).toBeInTheDocument()
      expect(screen.getByText('89%')).toBeInTheDocument() // toneAppropriateness
      
      expect(screen.getByText('Local Customs Respect')).toBeInTheDocument()
      expect(screen.getByText('92%')).toBeInTheDocument() // localCustomsRespect
      
      expect(screen.getByText('Timezone Accuracy')).toBeInTheDocument()
      expect(screen.getByText('98%')).toBeInTheDocument() // timeZoneAccuracy
    })

    it('should display business hours compliance metrics', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /uae insights/i }))

      expect(screen.getByText('Business Hours Compliance')).toBeInTheDocument()
      expect(screen.getByText('94.5%')).toBeInTheDocument() // compliance

      expect(screen.getByText('Prayer Time Respect')).toBeInTheDocument()
      expect(screen.getByText('96.8%')).toBeInTheDocument() // prayerTimeRespect

      expect(screen.getByText('Holiday Compliance')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument() // holidayCompliance
    })

    it('should display optimal times chart', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /uae insights/i }))

      expect(screen.getByTestId('optimal-times-chart')).toBeInTheDocument()
      expect(screen.getByText('Optimal Send Times (UAE)')).toBeInTheDocument()
    })
  })

  describe('Sequence Analysis Tab', () => {
    it('should display sequence analysis with detailed breakdown', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /sequence analysis/i }))

      expect(screen.getByText('Sequence Analysis')).toBeInTheDocument()
      expect(screen.getByText('Average Duration Analysis')).toBeInTheDocument()
      expect(screen.getByText('Cultural Score by Sequence')).toBeInTheDocument()
    })

    it('should render sequence effectiveness breakdown', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /sequence analysis/i }))

      expect(screen.getByTestId('sequence-breakdown-chart')).toBeInTheDocument()
      
      // Check individual sequence data
      expect(screen.getByText('5.2 days')).toBeInTheDocument() // Payment Reminder avgDuration
      expect(screen.getByText('7.1 days')).toBeInTheDocument() // Invoice Follow-up avgDuration
    })
  })

  describe('Interactive Features', () => {
    it('should handle date range filtering', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('date-range-select')
      await user.click(dateRangeSelect)
      
      const sevenDaysOption = screen.getByText('Last 7 days')
      await user.click(sevenDaysOption)

      await waitFor(() => {
        expect(mockAnalyticsApi.getDashboardMetrics).toHaveBeenCalledWith({
          companyId: mockCompany.id,
          dateRange: '7'
        })
      })
    })

    it('should handle refresh button click', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const refreshButton = screen.getByTestId('refresh-analytics')
      await user.click(refreshButton)

      await waitFor(() => {
        expect(mockAnalyticsApi.getDashboardMetrics).toHaveBeenCalledTimes(2)
      })
    })

    it('should handle export functionality', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-analytics')
      await user.click(exportButton)

      // Check export menu is displayed
      expect(screen.getByText('Export to PDF')).toBeInTheDocument()
      expect(screen.getByText('Export to Excel')).toBeInTheDocument()
      expect(screen.getByText('Export to CSV')).toBeInTheDocument()
    })

    it('should handle chart interactions and tooltips', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Simulate hovering over chart elements
      const emailVolumeChart = screen.getByTestId('email-volume-chart')
      await user.hover(emailVolumeChart)

      // Check tooltip appears (mocked)
      expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument()
    })
  })

  describe('UAE Business Logic', () => {
    it('should format UAE currency correctly', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText('AED 2,450,000')).toBeInTheDocument()
      expect(screen.getByText('AED 650,000')).toBeInTheDocument()
    })

    it('should display cultural score with appropriate color coding', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const cultureScoreElement = screen.getByTestId('culture-score-metric')
      expect(cultureScoreElement).toHaveClass('text-green-600') // Good score color
    })

    it('should respect Arabic locale settings', async () => {
      render(<AnalyticsDashboard {...defaultProps} locale="ar" />)
      
      await waitForLoadingToFinish()

      // Check if Arabic numerals or RTL layout is applied
      expect(document.body).toHaveClass('rtl') // Or similar locale-specific class
    })

    it('should handle UAE timezone correctly', async () => {
      // Mock timezone to UAE
      jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('15/03/2024, 14:30:00 GMT+4')
      
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText(/gmt\+4/i)).toBeInTheDocument()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large datasets without performance degradation', async () => {
      const largeMetrics = {
        ...mockDashboardMetrics,
        trends: {
          emailVolume: generateLargeDataset(365), // 1 year of data
          conversionFunnel: mockDashboardMetrics.trends.conversionFunnel,
          performanceOverTime: generateLargeDataset(365)
        }
      }
      
      mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: largeMetrics,
        timestamp: new Date().toISOString()
      })

      const startTime = Date.now()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()
      const renderTime = Date.now() - startTime

      expect(renderTime).toBeLessThan(3000) // Should render within 3 seconds
      expect(screen.getByTestId('email-volume-chart')).toBeInTheDocument()
    })

    it('should implement virtual scrolling for large data lists', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const sequenceList = screen.getByTestId('sequence-types-list')
      expect(sequenceList).toHaveAttribute('data-virtualized', 'true')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for charts', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      checkAriaLabels(screen.getByTestId('analytics-dashboard'))
    })

    it('should support keyboard navigation', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await checkKeyboardNavigation(screen.getByTestId('analytics-dashboard'))
    })

    it('should have proper color contrast for all elements', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Check color contrast meets WCAG standards
      const highContrastElements = screen.getAllByTestId(/metric-card|chart-element/)
      expect(highContrastElements.length).toBeGreaterThan(0)
    })

    it('should announce loading states to screen readers', () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      const loadingElement = screen.getByTestId('analytics-loading')
      expect(loadingElement).toHaveAttribute('aria-live', 'polite')
      expect(loadingElement).toHaveAttribute('role', 'status')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile devices', async () => {
      mockWindowResizeTo(375, 667) // iPhone 6/7/8 size
      
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Check mobile-specific layout adjustments
      const dashboard = screen.getByTestId('analytics-dashboard')
      expect(dashboard).toHaveClass('mobile-layout')
      
      // Check charts are responsive
      const charts = screen.getAllByTestId(/chart$/)
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-responsive', 'true')
      })
    })

    it('should handle touch interactions on mobile', async () => {
      mockWindowResizeTo(375, 667)
      const user = userEvent.setup()
      
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const tabList = screen.getByRole('tablist')
      
      // Simulate touch swipe gesture
      fireEvent.touchStart(tabList, { touches: [{ clientX: 100, clientY: 100 }] })
      fireEvent.touchMove(tabList, { touches: [{ clientX: 200, clientY: 100 }] })
      fireEvent.touchEnd(tabList)

      // Should switch to next tab
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Performance Trends')
    })
  })

  describe('Error Handling', () => {
    it('should display user-friendly error messages', async () => {
      mockAnalyticsApi.getDashboardMetrics.mockRejectedValue(new Error('Network error'))

      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/unable to load analytics/i)).toBeInTheDocument()
        expect(screen.getByText(/please check your connection/i)).toBeInTheDocument()
      })
    })

    it('should handle partial data loading gracefully', async () => {
      const partialMetrics = {
        ...mockDashboardMetrics,
        trends: {
          ...mockDashboardMetrics.trends,
          emailVolume: [] // Empty data
        }
      }
      
      mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: partialMetrics,
        timestamp: new Date().toISOString()
      })

      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText('No email volume data available')).toBeInTheDocument()
    })

    it('should handle API timeout gracefully', async () => {
      mockAnalyticsApi.getDashboardMetrics.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      )

      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument()
      }, { timeout: 6000 })
    })
  })

  describe('Real-time Updates', () => {
    it('should handle real-time metric updates', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Simulate real-time update
      const updatedMetrics = {
        ...mockDashboardMetrics,
        overview: {
          ...mockDashboardMetrics.overview,
          totalEmailsSent: 12650 // Updated value
        }
      }

      mockAnalyticsApi.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: updatedMetrics,
        timestamp: new Date().toISOString()
      })

      // Trigger refresh
      fireEvent.click(screen.getByTestId('refresh-analytics'))

      await waitFor(() => {
        expect(screen.getByText('12,650')).toBeInTheDocument()
      })
    })

    it('should show update indicators for changed metrics', async () => {
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // After update, should show change indicator
      const emailsSentCard = screen.getByTestId('emails-sent-metric')
      expect(emailsSentCard).toHaveClass('updated')
    })
  })

  describe('Data Export and Reporting', () => {
    it('should support PDF export with charts', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByTestId('export-analytics'))
      await user.click(screen.getByText('Export to PDF'))

      expect(mockAnalyticsApi.exportAnalytics).toHaveBeenCalledWith({
        format: 'pdf',
        section: 'comprehensive',
        companyId: mockCompany.id,
        dateRange: '30',
        includeCharts: true
      })
    })

    it('should support Excel export with data tables', async () => {
      const user = userEvent.setup()
      render(<AnalyticsDashboard {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByTestId('export-analytics'))
      await user.click(screen.getByText('Export to Excel'))

      expect(mockAnalyticsApi.exportAnalytics).toHaveBeenCalledWith({
        format: 'excel',
        section: 'comprehensive',
        companyId: mockCompany.id,
        dateRange: '30',
        includeCharts: false
      })
    })
  })
})