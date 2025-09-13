/**
 * Comprehensive Test Suite for Email Analytics Component
 * Tests UAE-specific metrics, cultural insights, A/B testing, and deliverability analysis
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import { EmailAnalytics } from '../email-analytics'
import {
  mockEmailMetrics,
  mockAnalyticsApi,
  mockRechartsComponents,
  mockCompany,
  mockPrayerTimes,
  mockUAEEmirates,
  waitForLoadingToFinish,
  mockWindowResizeTo,
  setupMatchMedia,
  checkAriaLabels,
  checkKeyboardNavigation,
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

// Mock UAE-specific components
jest.mock('../components/prayer-time-chart', () => ({
  PrayerTimeChart: ({ data }: { data: any[] }) => (
    <div data-testid="prayer-time-chart">
      {data.map((prayer, index) => (
        <div key={prayer.prayer} data-testid={`prayer-${prayer.prayer.toLowerCase()}`}>
          {prayer.prayer}: {prayer.beforePrayer}% / {prayer.afterPrayer}%
        </div>
      ))}
    </div>
  )
}))

jest.mock('../components/emirates-map', () => ({
  EmiratesMap: ({ data }: { data: any[] }) => (
    <div data-testid="emirates-map">
      {data.map((emirate, index) => (
        <div key={emirate.emirate} data-testid={`emirate-${emirate.emirate.replace(/\s+/g, '-').toLowerCase()}`}>
          {emirate.emirate}: {emirate.engagement}%
        </div>
      ))}
    </div>
  )
}))

describe('EmailAnalytics Component', () => {
  const defaultProps = {
    companyId: mockCompany.id,
    dateRange: '30',
    templateId: 'template_001'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupMatchMedia()
    
    // Reset API mock to return successful response
    mockAnalyticsApi.getEmailAnalytics.mockResolvedValue({
      success: true,
      data: mockEmailMetrics,
      timestamp: new Date().toISOString()
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render all 8 key email metrics cards', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Check all overview metrics are displayed
      expect(screen.getByText('Total Emails Sent')).toBeInTheDocument()
      expect(screen.getByText('12,580')).toBeInTheDocument()
      
      expect(screen.getByText('Delivery Rate')).toBeInTheDocument()
      expect(screen.getByText('97.2%')).toBeInTheDocument()
      
      expect(screen.getByText('Open Rate')).toBeInTheDocument()
      expect(screen.getByText('38.8%')).toBeInTheDocument()
      
      expect(screen.getByText('Click Rate')).toBeInTheDocument()
      expect(screen.getByText('9.7%')).toBeInTheDocument()
      
      expect(screen.getByText('Response Rate')).toBeInTheDocument()
      expect(screen.getByText('3.9%')).toBeInTheDocument()
      
      expect(screen.getByText('Bounce Rate')).toBeInTheDocument()
      expect(screen.getByText('2.8%')).toBeInTheDocument()
      
      expect(screen.getByText('Unsubscribe Rate')).toBeInTheDocument()
      expect(screen.getByText('0.4%')).toBeInTheDocument()
      
      expect(screen.getByText('Average Engagement')).toBeInTheDocument()
      expect(screen.getByText('42.3%')).toBeInTheDocument()
    })

    it('should render all 5 analytics sections tabs', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByRole('tab', { name: /engagement/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /deliverability/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /cultural insights/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /timing/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /a\/b testing/i })).toBeInTheDocument()
    })

    it('should display loading state initially', () => {
      mockAnalyticsApi.getEmailAnalytics.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      render(<EmailAnalytics {...defaultProps} />)
      
      expect(screen.getByTestId('email-analytics-loading')).toBeInTheDocument()
      expect(screen.getByText(/loading email analytics/i)).toBeInTheDocument()
    })

    it('should handle error states gracefully', async () => {
      const errorMessage = 'Failed to load email analytics'
      mockAnalyticsApi.getEmailAnalytics.mockRejectedValue(new Error(errorMessage))

      render(<EmailAnalytics {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/error loading email analytics/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })
  })

  describe('Engagement Tab - User Interaction Analysis', () => {
    it('should display hourly engagement patterns', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('hourly-engagement-chart')).toBeInTheDocument()
      expect(screen.getByText('Hourly Engagement Patterns')).toBeInTheDocument()
      expect(screen.getByText('Peak Hours: 10 AM - 2 PM')).toBeInTheDocument()
    })

    it('should show daily engagement breakdown', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('daily-engagement-chart')).toBeInTheDocument()
      expect(screen.getByText('Daily Engagement Analysis')).toBeInTheDocument()
      
      // Check all weekdays are displayed
      expect(screen.getByText('Sunday: 720 opens')).toBeInTheDocument()
      expect(screen.getByText('Monday: 850 opens')).toBeInTheDocument()
      expect(screen.getByText('Wednesday: 920 opens')).toBeInTheDocument() // Peak day
      expect(screen.getByText('Friday: 450 opens')).toBeInTheDocument() // Low due to Jummah
    })

    it('should display device breakdown with mobile-first insights', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('device-breakdown-chart')).toBeInTheDocument()
      expect(screen.getByText('Device Usage Breakdown')).toBeInTheDocument()
      
      // Check mobile dominance in UAE
      expect(screen.getByText('Mobile: 68.5%')).toBeInTheDocument()
      expect(screen.getByText('Desktop: 24.8%')).toBeInTheDocument()
      expect(screen.getByText('Tablet: 6.7%')).toBeInTheDocument()
      
      expect(screen.getByText('Mobile-first optimization recommended')).toBeInTheDocument()
    })

    it('should show UAE emirates engagement data', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('emirates-map')).toBeInTheDocument()
      expect(screen.getByText('Engagement by Emirates')).toBeInTheDocument()
      
      // Check all UAE emirates are represented
      expect(screen.getByTestId('emirate-dubai')).toBeInTheDocument()
      expect(screen.getByTestId('emirate-abu-dhabi')).toBeInTheDocument()
      expect(screen.getByTestId('emirate-sharjah')).toBeInTheDocument()
      expect(screen.getByTestId('emirate-ajman')).toBeInTheDocument()
    })

    it('should provide engagement optimization recommendations', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText('Engagement Optimization')).toBeInTheDocument()
      expect(screen.getByText('Best performing time: Wednesday 11 AM')).toBeInTheDocument()
      expect(screen.getByText('Mobile optimization critical (68.5% mobile users)')).toBeInTheDocument()
      expect(screen.getByText('Dubai shows highest engagement (45%)')).toBeInTheDocument()
    })
  })

  describe('Deliverability Tab - Email Health Analysis', () => {
    it('should display comprehensive deliverability metrics', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /deliverability/i }))

      expect(screen.getByText('Deliverability Overview')).toBeInTheDocument()
      expect(screen.getByText('12,230')).toBeInTheDocument() // delivered
      expect(screen.getByText('350')).toBeInTheDocument() // bounced
      expect(screen.getByText('45')).toBeInTheDocument() // blocked
      expect(screen.getByText('78')).toBeInTheDocument() // deferred
    })

    it('should show reputation and domain health scores', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /deliverability/i }))

      expect(screen.getByText('Reputation Score')).toBeInTheDocument()
      expect(screen.getByText('94.5%')).toBeInTheDocument()
      
      expect(screen.getByText('Domain Health')).toBeInTheDocument()
      expect(screen.getByText('97.8%')).toBeInTheDocument()
      
      expect(screen.getByTestId('reputation-score-gauge')).toBeInTheDocument()
    })

    it('should display bounce analysis and categorization', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /deliverability/i }))

      expect(screen.getByText('Bounce Analysis')).toBeInTheDocument()
      expect(screen.getByText('Hard Bounces: 280 (80%)')).toBeInTheDocument()
      expect(screen.getByText('Soft Bounces: 70 (20%)')).toBeInTheDocument()
      
      expect(screen.getByTestId('bounce-reasons-chart')).toBeInTheDocument()
    })

    it('should provide deliverability improvement recommendations', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /deliverability/i }))

      expect(screen.getByText('Deliverability Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Clean email list regularly')).toBeInTheDocument()
      expect(screen.getByText('Monitor reputation score weekly')).toBeInTheDocument()
      expect(screen.getByText('Implement double opt-in for UAE compliance')).toBeInTheDocument()
    })
  })

  describe('Cultural Insights Tab - UAE-Specific Analysis', () => {
    it('should display Arabic vs English performance comparison', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /cultural insights/i }))

      expect(screen.getByText('Language Performance Analysis')).toBeInTheDocument()
      expect(screen.getByTestId('language-performance-chart')).toBeInTheDocument()
      
      // Check Arabic performance
      expect(screen.getByText('Arabic')).toBeInTheDocument()
      expect(screen.getByText('2,450 opens')).toBeInTheDocument()
      expect(screen.getByText('485 clicks')).toBeInTheDocument()
      
      // Check English performance
      expect(screen.getByText('English')).toBeInTheDocument()
      expect(screen.getByText('2,180 opens')).toBeInTheDocument()
      expect(screen.getByText('520 clicks')).toBeInTheDocument()
      
      // Check bilingual performance
      expect(screen.getByText('Bilingual')).toBeInTheDocument()
      expect(screen.getByText('1,250 opens')).toBeInTheDocument()
      expect(screen.getByText('280 clicks')).toBeInTheDocument()
    })

    it('should show cultural elements effectiveness', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /cultural insights/i }))

      expect(screen.getByText('Cultural Elements Analysis')).toBeInTheDocument()
      
      expect(screen.getByText('Arabic Greetings')).toBeInTheDocument()
      expect(screen.getByText('Usage: 78%')).toBeInTheDocument()
      expect(screen.getByText('Effectiveness: 85%')).toBeInTheDocument()
      
      expect(screen.getByText('Islamic Phrases')).toBeInTheDocument()
      expect(screen.getByText('Usage: 45%')).toBeInTheDocument()
      expect(screen.getByText('Effectiveness: 92%')).toBeInTheDocument()
      
      expect(screen.getByText('Local References')).toBeInTheDocument()
      expect(screen.getByText('Usage: 62%')).toBeInTheDocument()
      expect(screen.getByText('Effectiveness: 76%')).toBeInTheDocument()
    })

    it('should display Ramadan performance analysis', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /cultural insights/i }))

      expect(screen.getByText('Ramadan Impact Analysis')).toBeInTheDocument()
      expect(screen.getByTestId('ramadan-performance-chart')).toBeInTheDocument()
      
      expect(screen.getByText('Before Ramadan: 42.5%')).toBeInTheDocument()
      expect(screen.getByText('During Ramadan: 28.3%')).toBeInTheDocument()
      expect(screen.getByText('After Ramadan: 38.7%')).toBeInTheDocument()
      
      expect(screen.getByText('33% decrease during Ramadan')).toBeInTheDocument()
    })

    it('should provide cultural compliance recommendations', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /cultural insights/i }))

      expect(screen.getByText('Cultural Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Increase Islamic phrases usage (+15% effectiveness)')).toBeInTheDocument()
      expect(screen.getByText('Use more Arabic greetings for local customers')).toBeInTheDocument()
      expect(screen.getByText('Adjust strategy during Ramadan period')).toBeInTheDocument()
      expect(screen.getByText('Reference local events and celebrations')).toBeInTheDocument()
    })
  })

  describe('Timing Tab - UAE Business Hours & Prayer Times', () => {
    it('should display optimal send times for UAE timezone', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('Optimal Send Times (UAE)')).toBeInTheDocument()
      expect(screen.getByTestId('optimal-times-chart')).toBeInTheDocument()
      
      expect(screen.getByText('Best performance: 10 AM - 2 PM')).toBeInTheDocument()
      expect(screen.getByText('Avoid: 12 PM - 1 PM (Dhuhr prayer)')).toBeInTheDocument()
    })

    it('should show prayer time impact analysis', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('Prayer Time Impact')).toBeInTheDocument()
      expect(screen.getByTestId('prayer-time-chart')).toBeInTheDocument()
      
      // Check all prayer times are analyzed
      expect(screen.getByTestId('prayer-fajr')).toBeInTheDocument()
      expect(screen.getByTestId('prayer-dhuhr')).toBeInTheDocument()
      expect(screen.getByTestId('prayer-asr')).toBeInTheDocument()
      expect(screen.getByTestId('prayer-maghrib')).toBeInTheDocument()
      expect(screen.getByTestId('prayer-isha')).toBeInTheDocument()
    })

    it('should display business hours compliance metrics', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('Business Hours Compliance')).toBeInTheDocument()
      expect(screen.getByText('94.5%')).toBeInTheDocument()
      expect(screen.getByText('Within UAE business hours')).toBeInTheDocument()
      
      expect(screen.getByTestId('business-hours-breakdown')).toBeInTheDocument()
    })

    it('should show weekday performance analysis', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('Weekday Performance')).toBeInTheDocument()
      expect(screen.getByTestId('weekday-performance-chart')).toBeInTheDocument()
      
      // Check UAE weekend consideration (Friday-Saturday)
      expect(screen.getByText('Best: Tuesday-Thursday')).toBeInTheDocument()
      expect(screen.getByText('Avoid: Friday afternoons')).toBeInTheDocument()
      expect(screen.getByText('Saturday: Limited business activity')).toBeInTheDocument()
    })

    it('should provide timing optimization recommendations', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('Timing Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Schedule emails for 10 AM - 2 PM')).toBeInTheDocument()
      expect(screen.getByText('Avoid prayer times (especially Dhuhr & Maghrib)')).toBeInTheDocument()
      expect(screen.getByText('Skip Friday afternoons during Jummah')).toBeInTheDocument()
      expect(screen.getByText('Tuesday-Thursday show best engagement')).toBeInTheDocument()
    })
  })

  describe('A/B Testing Tab - Statistical Analysis', () => {
    it('should display active and completed A/B tests', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /a\/b testing/i }))

      expect(screen.getByText('A/B Testing Overview')).toBeInTheDocument()
      expect(screen.getByTestId('ab-tests-list')).toBeInTheDocument()
      
      // Check completed test
      expect(screen.getByText('Arabic vs English Subject Lines')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Winner: Arabic Subject')).toBeInTheDocument()
      expect(screen.getByText('Confidence: 87.5%')).toBeInTheDocument()
      
      // Check running test
      expect(screen.getByText('Send Time Optimization')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Confidence: 72.3%')).toBeInTheDocument()
    })

    it('should show detailed test variant performance', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /a\/b testing/i }))

      const completedTest = screen.getByTestId('ab-test-ab_001')
      await user.click(completedTest)

      expect(screen.getByTestId('test-details-modal')).toBeInTheDocument()
      expect(screen.getByText('Test Variant Performance')).toBeInTheDocument()
      
      // Check Arabic variant
      expect(screen.getByText('Arabic Subject: 42.5% open rate')).toBeInTheDocument()
      expect(screen.getByText('2,500 sample size')).toBeInTheDocument()
      
      // Check English variant
      expect(screen.getByText('English Subject: 38.2% open rate')).toBeInTheDocument()
      expect(screen.getByText('2,500 sample size')).toBeInTheDocument()
    })

    it('should display statistical significance and confidence levels', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /a\/b testing/i }))

      expect(screen.getByText('Statistical Significance')).toBeInTheDocument()
      expect(screen.getByTestId('confidence-levels-chart')).toBeInTheDocument()
      
      expect(screen.getByText('Required: 95% confidence')).toBeInTheDocument()
      expect(screen.getByText('Current: 87.5% confidence')).toBeInTheDocument()
    })

    it('should support creating new A/B tests', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /a\/b testing/i }))

      const createTestButton = screen.getByTestId('create-ab-test')
      await user.click(createTestButton)

      expect(screen.getByTestId('create-test-modal')).toBeInTheDocument()
      expect(screen.getByText('Create New A/B Test')).toBeInTheDocument()
      expect(screen.getByText('Test Type')).toBeInTheDocument()
      expect(screen.getByText('Sample Size')).toBeInTheDocument()
      expect(screen.getByText('Success Metric')).toBeInTheDocument()
    })

    it('should provide A/B testing insights and recommendations', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /a\/b testing/i }))

      expect(screen.getByText('A/B Testing Insights')).toBeInTheDocument()
      expect(screen.getByText('Arabic subject lines perform 11% better')).toBeInTheDocument()
      expect(screen.getByText('Morning sends (9 AM) outperform afternoon (2 PM)')).toBeInTheDocument()
      expect(screen.getByText('Recommended: Test cultural greetings next')).toBeInTheDocument()
    })
  })

  describe('Interactive Features', () => {
    it('should handle date range filtering across all sections', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('date-range-select')
      await user.click(dateRangeSelect)
      await user.click(screen.getByText('Last 7 days'))

      await waitFor(() => {
        expect(mockAnalyticsApi.getEmailAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ dateRange: '7' })
        )
      })
    })

    it('should support filtering by email template', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const templateFilter = screen.getByTestId('template-filter')
      await user.click(templateFilter)
      await user.click(screen.getByText('Payment Reminder Template'))

      await waitFor(() => {
        expect(mockAnalyticsApi.getEmailAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ templateId: 'payment_reminder_001' })
        )
      })
    })

    it('should handle chart interactions and drill-down', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Click on engagement chart element
      const engagementChart = screen.getByTestId('hourly-engagement-chart')
      await user.click(engagementChart)

      expect(screen.getByTestId('engagement-drill-down')).toBeInTheDocument()
      expect(screen.getByText('Detailed Engagement Analysis')).toBeInTheDocument()
    })

    it('should support metric comparison across time periods', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const compareButton = screen.getByTestId('compare-periods')
      await user.click(compareButton)

      expect(screen.getByTestId('period-comparison-modal')).toBeInTheDocument()
      expect(screen.getByText('Compare Time Periods')).toBeInTheDocument()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large email datasets efficiently', async () => {
      const largeEmailMetrics = {
        ...mockEmailMetrics,
        engagement: {
          ...mockEmailMetrics.engagement,
          hourlyEngagement: generateLargeDataset(24).map((_, hour) => ({
            hour,
            opens: 100 + Math.random() * 200,
            clicks: 20 + Math.random() * 50,
            responses: 5 + Math.random() * 15
          }))
        }
      }

      mockAnalyticsApi.getEmailAnalytics.mockResolvedValue({
        success: true,
        data: largeEmailMetrics,
        timestamp: new Date().toISOString()
      })

      const startTime = Date.now()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()
      const renderTime = Date.now() - startTime

      expect(renderTime).toBeLessThan(2500) // Should render within 2.5 seconds
      expect(screen.getByTestId('hourly-engagement-chart')).toBeInTheDocument()
    })

    it('should implement lazy loading for charts', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Charts should not be loaded until tab is active
      await user.click(screen.getByRole('tab', { name: /cultural insights/i }))

      expect(screen.getByTestId('language-performance-chart')).toHaveAttribute('data-lazy-loaded', 'true')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for all charts and metrics', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      checkAriaLabels(screen.getByTestId('email-analytics'))
      
      // Check specific chart accessibility
      const hourlyChart = screen.getByTestId('hourly-engagement-chart')
      expect(hourlyChart).toHaveAttribute('role', 'img')
      expect(hourlyChart).toHaveAttribute('aria-label', expect.stringContaining('engagement'))
    })

    it('should support keyboard navigation through all sections', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await checkKeyboardNavigation(screen.getByTestId('email-analytics'))
    })

    it('should announce metric updates to screen readers', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const metricsRegion = screen.getByTestId('email-metrics-region')
      expect(metricsRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide alternative text for visual charts', async () => {
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const deviceChart = screen.getByTestId('device-breakdown-chart')
      expect(deviceChart).toHaveAttribute('aria-describedby', 'device-chart-description')
      
      const description = screen.getByTestId('device-chart-description')
      expect(description).toHaveTextContent('Mobile devices account for 68.5% of email opens')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should adapt charts for mobile viewing', async () => {
      mockWindowResizeTo(375, 667)
      
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const charts = screen.getAllByTestId(/chart$/)
      charts.forEach(chart => {
        expect(chart).toHaveClass('mobile-responsive')
      })
    })

    it('should make metric cards scrollable on mobile', async () => {
      mockWindowResizeTo(375, 667)
      
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const metricsContainer = screen.getByTestId('email-metrics-container')
      expect(metricsContainer).toHaveClass('mobile-scroll')
    })

    it('should optimize tab layout for mobile', async () => {
      mockWindowResizeTo(375, 667)
      
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const tabsList = screen.getByRole('tablist')
      expect(tabsList).toHaveClass('mobile-tabs')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing cultural data gracefully', async () => {
      const partialMetrics = {
        ...mockEmailMetrics,
        cultural: {
          languagePerformance: [],
          culturalElements: mockEmailMetrics.cultural.culturalElements,
          ramadanPerformance: mockEmailMetrics.cultural.ramadanPerformance
        }
      }

      mockAnalyticsApi.getEmailAnalytics.mockResolvedValue({
        success: true,
        data: partialMetrics,
        timestamp: new Date().toISOString()
      })

      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: /cultural insights/i }))

      expect(screen.getByText('No language performance data available')).toBeInTheDocument()
    })

    it('should handle empty A/B testing data', async () => {
      const noTestsMetrics = {
        ...mockEmailMetrics,
        abTests: []
      }

      mockAnalyticsApi.getEmailAnalytics.mockResolvedValue({
        success: true,
        data: noTestsMetrics,
        timestamp: new Date().toISOString()
      })

      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: /a\/b testing/i }))

      expect(screen.getByText('No A/B tests found')).toBeInTheDocument()
      expect(screen.getByText('Create your first A/B test')).toBeInTheDocument()
    })

    it('should handle API timeouts gracefully', async () => {
      mockAnalyticsApi.getEmailAnalytics.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      )

      render(<EmailAnalytics {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument()
      }, { timeout: 6000 })
    })
  })

  describe('Export and Reporting', () => {
    it('should support comprehensive email analytics export', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-email-analytics')
      await user.click(exportButton)

      expect(mockAnalyticsApi.exportAnalytics).toHaveBeenCalledWith({
        format: 'pdf',
        section: 'emails',
        companyId: mockCompany.id,
        dateRange: '30',
        templateId: 'template_001',
        includeCharts: true,
        includeRecommendations: true
      })
    })

    it('should generate executive summary reports', async () => {
      const user = userEvent.setup()
      render(<EmailAnalytics {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const summaryButton = screen.getByTestId('generate-executive-summary')
      await user.click(summaryButton)

      expect(screen.getByTestId('executive-summary-modal')).toBeInTheDocument()
      expect(screen.getByText('Email Performance Executive Summary')).toBeInTheDocument()
      expect(screen.getByText('Key Achievements')).toBeInTheDocument()
      expect(screen.getByText('Cultural Insights')).toBeInTheDocument()
      expect(screen.getByText('Action Items')).toBeInTheDocument()
    })
  })
})