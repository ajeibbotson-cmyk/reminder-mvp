/**
 * Comprehensive Test Suite for Sequence Performance Component
 * Tests funnel visualization, step analysis, timing charts, and UAE-specific recommendations
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import { SequencePerformance } from '../sequence-performance'
import {
  mockPerformanceData,
  mockAnalyticsApi,
  mockRechartsComponents,
  mockCompany,
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
    get: jest.fn().mockReturnValue('seq_12345')
  })
}))

// Mock custom funnel chart component
jest.mock('../components/funnel-chart', () => ({
  FunnelChart: ({ data, onStageClick }: { data: any[], onStageClick: (stage: any) => void }) => (
    <div data-testid="funnel-chart">
      {data.map((stage, index) => (
        <div 
          key={stage.stage}
          data-testid={`funnel-stage-${index}`}
          onClick={() => onStageClick(stage)}
          className="funnel-stage"
        >
          <span>{stage.stage}</span>
          <span>{stage.count}</span>
          <span>{stage.rate}%</span>
        </div>
      ))}
    </div>
  )
}))

describe('SequencePerformance Component', () => {
  const defaultProps = {
    sequenceId: 'seq_12345',
    dateRange: '30',
    companyId: mockCompany.id
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupMatchMedia()
    
    // Reset API mock to return successful response
    mockAnalyticsApi.getSequencePerformance.mockResolvedValue({
      success: true,
      data: mockPerformanceData,
      timestamp: new Date().toISOString()
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render sequence information header', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText('UAE Payment Reminder Sequence')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('5 Steps')).toBeInTheDocument()
      expect(screen.getByText('7.2 days avg')).toBeInTheDocument()
    })

    it('should render overview metrics cards', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Check all 6 overview metrics
      expect(screen.getByText('Total Contacts')).toBeInTheDocument()
      expect(screen.getByText('1,250')).toBeInTheDocument()
      
      expect(screen.getByText('Completion Rate')).toBeInTheDocument()
      expect(screen.getByText('78.5%')).toBeInTheDocument()
      
      expect(screen.getByText('Avg Response Time')).toBeInTheDocument()
      expect(screen.getByText('2.3 days')).toBeInTheDocument()
      
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      expect(screen.getByText('AED 485,000')).toBeInTheDocument()
      
      expect(screen.getByText('Cost Per Conversion')).toBeInTheDocument()
      expect(screen.getByText('AED 45.50')).toBeInTheDocument()
      
      expect(screen.getByText('ROI')).toBeInTheDocument()
      expect(screen.getByText('267%')).toBeInTheDocument()
    })

    it('should render all 4 performance tabs', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByRole('tab', { name: /funnel/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /steps/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /timing/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /recommendations/i })).toBeInTheDocument()
    })

    it('should display loading state initially', () => {
      mockAnalyticsApi.getSequencePerformance.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      render(<SequencePerformance {...defaultProps} />)
      
      expect(screen.getByTestId('sequence-performance-loading')).toBeInTheDocument()
      expect(screen.getByText(/loading sequence performance/i)).toBeInTheDocument()
    })

    it('should handle error states gracefully', async () => {
      const errorMessage = 'Failed to load sequence performance'
      mockAnalyticsApi.getSequencePerformance.mockRejectedValue(new Error(errorMessage))

      render(<SequencePerformance {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/error loading performance data/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })
  })

  describe('Funnel Tab - Conversion Visualization', () => {
    it('should render conversion funnel chart with all stages', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const funnelChart = screen.getByTestId('funnel-chart')
      expect(funnelChart).toBeInTheDocument()

      // Check all funnel stages are displayed
      expect(screen.getByTestId('funnel-stage-0')).toBeInTheDocument()
      expect(screen.getByTestId('funnel-stage-1')).toBeInTheDocument()
      expect(screen.getByTestId('funnel-stage-2')).toBeInTheDocument()
      expect(screen.getByTestId('funnel-stage-3')).toBeInTheDocument()
      expect(screen.getByTestId('funnel-stage-4')).toBeInTheDocument()
      expect(screen.getByTestId('funnel-stage-5')).toBeInTheDocument()

      // Check stage data
      expect(screen.getByText('Started')).toBeInTheDocument()
      expect(screen.getByText('1250')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
      
      expect(screen.getByText('Step 1 - Initial Reminder')).toBeInTheDocument()
      expect(screen.getByText('1225')).toBeInTheDocument()
      expect(screen.getByText('98%')).toBeInTheDocument()
    })

    it('should show dropoff rates and conversion metrics', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Check dropoff rates are displayed
      expect(screen.getByText('2% dropoff')).toBeInTheDocument()
      expect(screen.getByText('10.2% dropoff')).toBeInTheDocument()
      expect(screen.getByText('20.5% dropoff')).toBeInTheDocument()
      expect(screen.getByText('33.7% dropoff')).toBeInTheDocument()
      expect(screen.getByText('44.8% dropoff')).toBeInTheDocument()
    })

    it('should handle funnel stage click interactions', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const secondStage = screen.getByTestId('funnel-stage-1')
      await user.click(secondStage)

      // Should show detailed breakdown for clicked stage
      expect(screen.getByTestId('stage-detail-modal')).toBeInTheDocument()
      expect(screen.getByText('Step 1 - Initial Reminder Details')).toBeInTheDocument()
    })

    it('should display funnel insights and bottlenecks', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText('Funnel Insights')).toBeInTheDocument()
      expect(screen.getByText('Biggest Dropoff: Step 4 (33.7%)')).toBeInTheDocument()
      expect(screen.getByText('Best Conversion: Step 1 (98%)')).toBeInTheDocument()
    })
  })

  describe('Steps Tab - Step-by-Step Analysis', () => {
    it('should display detailed step analysis table', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      expect(screen.getByTestId('steps-analysis-table')).toBeInTheDocument()
      
      // Check table headers
      expect(screen.getByText('Step')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Type')).toBeInTheDocument()
      expect(screen.getByText('Delay')).toBeInTheDocument()
      expect(screen.getByText('Sent')).toBeInTheDocument()
      expect(screen.getByText('Delivered')).toBeInTheDocument()
      expect(screen.getByText('Opened')).toBeInTheDocument()
      expect(screen.getByText('Clicked')).toBeInTheDocument()
      expect(screen.getByText('Responded')).toBeInTheDocument()
      expect(screen.getByText('Culture Score')).toBeInTheDocument()
      expect(screen.getByText('Effectiveness')).toBeInTheDocument()
    })

    it('should show individual step performance metrics', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      // Check first step data
      expect(screen.getByText('Gentle Reminder (Arabic & English)')).toBeInTheDocument()
      expect(screen.getByText('1225')).toBeInTheDocument() // sent
      expect(screen.getByText('1198')).toBeInTheDocument() // delivered
      expect(screen.getByText('516')).toBeInTheDocument() // opened
      expect(screen.getByText('92')).toBeInTheDocument() // culture score

      // Check call step
      expect(screen.getByText('Personal Call (Arabic)')).toBeInTheDocument()
      expect(screen.getByText('call')).toBeInTheDocument()
      expect(screen.getByText('95')).toBeInTheDocument() // culture score for call
    })

    it('should highlight best and worst performing steps', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      const bestStepRow = screen.getByTestId('step-row-2') // Step 3 - Escalation Notice
      expect(bestStepRow).toHaveClass('best-performer')

      const worstStepRow = screen.getByTestId('step-row-4') // Step 5 - Final Legal Notice
      expect(worstStepRow).toHaveClass('needs-attention')
    })

    it('should display UAE-specific step insights', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      expect(screen.getByText('UAE Cultural Analysis')).toBeInTheDocument()
      expect(screen.getByText('Arabic content performs 15% better')).toBeInTheDocument()
      expect(screen.getByText('Call steps have 95% cultural compliance')).toBeInTheDocument()
    })

    it('should support step comparison functionality', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      // Select multiple steps for comparison
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0]) // Select step 1
      await user.click(checkboxes[1]) // Select step 2

      const compareButton = screen.getByText('Compare Selected Steps')
      await user.click(compareButton)

      expect(screen.getByTestId('step-comparison-modal')).toBeInTheDocument()
    })
  })

  describe('Timing Tab - Performance Analysis', () => {
    it('should display timing analysis charts', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByTestId('timing-analysis-chart')).toBeInTheDocument()
      expect(screen.getByText('Daily Performance Trends')).toBeInTheDocument()
      expect(screen.getByText('Response Rate Over Time')).toBeInTheDocument()
      expect(screen.getByText('Culture Compliance Trends')).toBeInTheDocument()
    })

    it('should show optimal timing recommendations for UAE', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('UAE Timing Insights')).toBeInTheDocument()
      expect(screen.getByText('Best performance: Sunday-Thursday 10 AM - 4 PM')).toBeInTheDocument()
      expect(screen.getByText('Avoid: Friday afternoons and prayer times')).toBeInTheDocument()
      expect(screen.getByText('Ramadan impact: 35% lower engagement')).toBeInTheDocument()
    })

    it('should display step delay optimization suggestions', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('Step Timing Analysis')).toBeInTheDocument()
      expect(screen.getByText('Current: 7 days')).toBeInTheDocument()
      expect(screen.getByText('Recommended: 5 days')).toBeInTheDocument()
      expect(screen.getByText('Expected improvement: +12%')).toBeInTheDocument()
    })

    it('should show business hours compliance metrics', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /timing/i }))

      expect(screen.getByText('UAE Business Hours Compliance')).toBeInTheDocument()
      expect(screen.getByText('94.5%')).toBeInTheDocument()
      expect(screen.getByText('Within business hours')).toBeInTheDocument()
      expect(screen.getByText('5.5%')).toBeInTheDocument()
      expect(screen.getByText('Outside business hours')).toBeInTheDocument()
    })
  })

  describe('Recommendations Tab - Smart Insights', () => {
    it('should display performance recommendations by priority', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /recommendations/i }))

      expect(screen.getByTestId('recommendations-list')).toBeInTheDocument()
      
      // Check recommendations are sorted by priority
      const recommendations = screen.getAllByTestId(/recommendation-item-/)
      expect(recommendations[0]).toHaveClass('priority-high')
      expect(recommendations[1]).toHaveClass('priority-medium')
      expect(recommendations[2]).toHaveClass('priority-medium')
      expect(recommendations[3]).toHaveClass('priority-low')
    })

    it('should show different recommendation types', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /recommendations/i }))

      // Check all recommendation types are represented
      expect(screen.getByText('Optimization')).toBeInTheDocument()
      expect(screen.getByText('Cultural')).toBeInTheDocument()
      expect(screen.getByText('Timing')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should display UAE-specific cultural recommendations', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /recommendations/i }))

      expect(screen.getByText('Enhance Arabic Content')).toBeInTheDocument()
      expect(screen.getByText('Include more culturally appropriate greetings')).toBeInTheDocument()
      expect(screen.getByText('+8% cultural score')).toBeInTheDocument()

      expect(screen.getByText('Avoid Prayer Time Sending')).toBeInTheDocument()
      expect(screen.getByText('Adjust scheduling logic')).toBeInTheDocument()
      expect(screen.getByText('+15% open rate')).toBeInTheDocument()
    })

    it('should show expected impact metrics for each recommendation', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /recommendations/i }))

      const highPriorityRecommendation = screen.getByTestId('recommendation-item-0')
      expect(within(highPriorityRecommendation).getByText('+12% response rate')).toBeInTheDocument()

      const mediumPriorityRecommendation = screen.getByTestId('recommendation-item-1')
      expect(within(mediumPriorityRecommendation).getByText('+8% cultural score')).toBeInTheDocument()
    })

    it('should support recommendation implementation tracking', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /recommendations/i }))

      const implementButton = screen.getByText('Mark as Implemented')
      await user.click(implementButton)

      expect(screen.getByText('Implementation Tracking')).toBeInTheDocument()
      expect(screen.getByText('Status: In Progress')).toBeInTheDocument()
    })

    it('should provide actionable next steps', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /recommendations/i }))

      const recommendationCard = screen.getByTestId('recommendation-item-0')
      await user.click(recommendationCard)

      expect(screen.getByTestId('recommendation-details-modal')).toBeInTheDocument()
      expect(screen.getByText('Action Steps')).toBeInTheDocument()
      expect(screen.getByText('1. Update sequence step timing')).toBeInTheDocument()
      expect(screen.getByText('2. Test with A/B split')).toBeInTheDocument()
      expect(screen.getByText('3. Monitor for 2 weeks')).toBeInTheDocument()
    })
  })

  describe('Interactive Features', () => {
    it('should support date range filtering', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const dateRangeSelect = screen.getByTestId('date-range-select')
      await user.click(dateRangeSelect)
      await user.click(screen.getByText('Last 7 days'))

      await waitFor(() => {
        expect(mockAnalyticsApi.getSequencePerformance).toHaveBeenCalledWith(
          expect.objectContaining({ dateRange: '7' })
        )
      })
    })

    it('should handle sequence comparison', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const compareButton = screen.getByTestId('compare-sequences')
      await user.click(compareButton)

      expect(screen.getByTestId('sequence-comparison-modal')).toBeInTheDocument()
      expect(screen.getByText('Select sequences to compare')).toBeInTheDocument()
    })

    it('should support data drill-down functionality', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      // Click on a metric card to drill down
      const responseTimeCard = screen.getByTestId('response-time-metric')
      await user.click(responseTimeCard)

      expect(screen.getByTestId('response-time-details')).toBeInTheDocument()
      expect(screen.getByText('Response Time Breakdown')).toBeInTheDocument()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large sequence datasets efficiently', async () => {
      const largePerformanceData = {
        ...mockPerformanceData,
        steps: generateLargeDataset(50).map((item, index) => ({
          stepNumber: index + 1,
          stepType: 'email',
          name: `Step ${index + 1}`,
          triggerDelay: index * 2,
          sent: 1000 - index * 10,
          delivered: 950 - index * 10,
          opened: 400 - index * 5,
          clicked: 100 - index * 2,
          responded: 50 - index,
          bounced: 20,
          unsubscribed: 5,
          effectiveness: 40 + Math.random() * 20,
          cultureScore: 80 + Math.random() * 15,
          dropoffRate: index * 2
        }))
      }

      mockAnalyticsApi.getSequencePerformance.mockResolvedValue({
        success: true,
        data: largePerformanceData,
        timestamp: new Date().toISOString()
      })

      const startTime = Date.now()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()
      const renderTime = Date.now() - startTime

      expect(renderTime).toBeLessThan(2000) // Should render within 2 seconds
      expect(screen.getByTestId('steps-analysis-table')).toBeInTheDocument()
    })

    it('should implement virtualization for large step lists', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      const stepsTable = screen.getByTestId('steps-analysis-table')
      expect(stepsTable).toHaveAttribute('data-virtualized', 'true')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for funnel visualization', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      checkAriaLabels(screen.getByTestId('sequence-performance'))
      
      const funnelChart = screen.getByTestId('funnel-chart')
      expect(funnelChart).toHaveAttribute('role', 'img')
      expect(funnelChart).toHaveAttribute('aria-label', expect.stringContaining('Conversion funnel'))
    })

    it('should support keyboard navigation through tabs and elements', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await checkKeyboardNavigation(screen.getByTestId('sequence-performance'))
    })

    it('should announce data updates to screen readers', async () => {
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const dataUpdateRegion = screen.getByTestId('performance-data-region')
      expect(dataUpdateRegion).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should adapt funnel visualization for mobile', async () => {
      mockWindowResizeTo(375, 667)
      
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const funnelChart = screen.getByTestId('funnel-chart')
      expect(funnelChart).toHaveClass('mobile-responsive')
      
      // Check that stages are stacked vertically on mobile
      expect(funnelChart).toHaveClass('vertical-layout')
    })

    it('should make tables scrollable on mobile', async () => {
      mockWindowResizeTo(375, 667)
      const user = userEvent.setup()
      
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      await user.click(screen.getByRole('tab', { name: /steps/i }))

      const stepsTable = screen.getByTestId('steps-analysis-table')
      expect(stepsTable).toHaveClass('mobile-scroll')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty sequence data gracefully', async () => {
      const emptyPerformanceData = {
        ...mockPerformanceData,
        funnel: [],
        steps: []
      }

      mockAnalyticsApi.getSequencePerformance.mockResolvedValue({
        success: true,
        data: emptyPerformanceData,
        timestamp: new Date().toISOString()
      })

      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
      expect(screen.getByText('This sequence has no execution history yet')).toBeInTheDocument()
    })

    it('should handle partial data loading', async () => {
      const partialData = {
        ...mockPerformanceData,
        funnel: mockPerformanceData.funnel,
        steps: [], // Missing steps data
        recommendations: mockPerformanceData.recommendations
      }

      mockAnalyticsApi.getSequencePerformance.mockResolvedValue({
        success: true,
        data: partialData,
        timestamp: new Date().toISOString()
      })

      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      expect(screen.getByTestId('funnel-chart')).toBeInTheDocument()
      expect(screen.getByText('Step analysis unavailable')).toBeInTheDocument()
      expect(screen.getByTestId('recommendations-list')).toBeInTheDocument()
    })

    it('should handle network timeouts gracefully', async () => {
      mockAnalyticsApi.getSequencePerformance.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      )

      render(<SequencePerformance {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument()
      }, { timeout: 6000 })
    })
  })

  describe('Export and Reporting', () => {
    it('should support sequence performance export', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const exportButton = screen.getByTestId('export-performance')
      await user.click(exportButton)

      expect(mockAnalyticsApi.exportAnalytics).toHaveBeenCalledWith({
        format: 'pdf',
        section: 'sequences',
        sequenceId: 'seq_12345',
        companyId: mockCompany.id,
        dateRange: '30'
      })
    })

    it('should generate performance summary reports', async () => {
      const user = userEvent.setup()
      render(<SequencePerformance {...defaultProps} />)
      
      await waitForLoadingToFinish()

      const summaryButton = screen.getByTestId('generate-summary')
      await user.click(summaryButton)

      expect(screen.getByTestId('performance-summary-modal')).toBeInTheDocument()
      expect(screen.getByText('Sequence Performance Summary')).toBeInTheDocument()
      expect(screen.getByText('Key Metrics')).toBeInTheDocument()
      expect(screen.getByText('Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Action Items')).toBeInTheDocument()
    })
  })
})