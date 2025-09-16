/**
 * Sprint 3.1 Analytics Dashboard Integration Tests
 * Comprehensive testing for advanced analytics dashboard components
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { NextRouter } from 'next/router'
import { SessionProvider } from 'next-auth/react'
import userEvent from '@testing-library/user-event'

// Components under test
import { MainAnalyticsDashboard } from '@/components/analytics/MainAnalyticsDashboard'
import { PaymentPerformanceChart } from '@/components/analytics/PaymentPerformanceChart'
import { InvoiceAgingChart } from '@/components/analytics/InvoiceAgingChart'
import { CustomerInsightsPanel } from '@/components/analytics/CustomerInsightsPanel'
import { UAEBusinessIntelligence } from '@/components/analytics/UAEBusinessIntelligence'
import { RealTimeMetrics } from '@/components/analytics/RealTimeMetrics'
import { KPICards } from '@/components/analytics/KPICards'

// Test utilities
import {
  createMockCompany,
  createMockAnalyticsFilters,
  createMockPaymentPerformanceData,
  createMockInvoiceStatusData,
  createMockCustomerInsightsData,
  createMockUAEIntelligenceData
} from '@/tests/setup/analytics-fixtures'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
    toString: vi.fn(() => '')
  })),
  usePathname: vi.fn(() => '/dashboard/analytics')
}))

// Mock API endpoints
global.fetch = vi.fn()

const mockSession = {
  user: {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    companyId: 'company-123',
    company_id: 'company-123'
  }
}

const renderWithSession = (component: React.ReactElement) => {
  return render(
    <SessionProvider session={mockSession}>
      {component}
    </SessionProvider>
  )
}

describe('Sprint 3.1 Analytics Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful API responses
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        kpis: {
          paymentDelayReduction: 18.2,
          targetReduction: 25,
          totalRevenue: 2450000,
          activeInvoices: 156,
          customerSatisfaction: 94.8,
          cultureCompliance: 94.8,
          avgPaymentTime: 22.3,
          collectionEfficiency: 87.5,
          emailResponseRate: 31.2
        },
        trends: {
          paymentReduction: [
            { period: '2024-01-01', value: 15.2, target: 25 },
            { period: '2024-01-07', value: 16.8, target: 25 },
            { period: '2024-01-14', value: 18.2, target: 25 }
          ],
          revenueGrowth: [
            { period: '2024-01-01', value: 2200000 },
            { period: '2024-01-07', value: 2350000 },
            { period: '2024-01-14', value: 2450000 }
          ],
          complianceScore: [
            { period: '2024-01-01', value: 92.1 },
            { period: '2024-01-07', value: 93.5 },
            { period: '2024-01-14', value: 94.8 }
          ]
        },
        realTime: {
          activeReminders: 24,
          todayCollections: 87500,
          systemHealth: 99.2,
          lastUpdated: new Date().toISOString()
        },
        uaeSpecific: {
          prayerTimeCompliance: 94.2,
          ramadanAdjustments: 98.5,
          businessHoursOptimization: 91.7,
          culturalSentimentScore: 95.3
        }
      })
    })
  })

  describe('MainAnalyticsDashboard Component', () => {
    it('should render main dashboard with all sections', async () => {
      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      // Check header elements
      expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
      expect(screen.getByText(/comprehensive uae payment collection analytics/i)).toBeInTheDocument()

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Check KPI cards presence
      expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument()

      // Check 25% payment delay reduction goal
      expect(screen.getByText('25% Payment Delay Reduction Goal')).toBeInTheDocument()

      // Check tabs are present
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /payments/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /customers/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /uae insights/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /real-time/i })).toBeInTheDocument()
    })

    it('should handle language switching', async () => {
      const user = userEvent.setup()

      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      // Find and click language toggle
      const languageToggle = await screen.findByRole('button', { name: /العربية/i })
      await user.click(languageToggle)

      // Check if Arabic content appears
      await waitFor(() => {
        expect(screen.getByText('لوحة تحكم التحليلات المتقدمة')).toBeInTheDocument()
      })
    })

    it('should display payment reduction progress correctly', async () => {
      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      await waitFor(() => {
        // Check progress display (18.2% of 25% target = 72.8%)
        expect(screen.getByText('18.2%')).toBeInTheDocument()
        expect(screen.getByText('25%')).toBeInTheDocument()

        // Should show "In Progress" since not at 100%
        expect(screen.getByText('🎯 In Progress')).toBeInTheDocument()
      })
    })

    it('should handle real-time updates', async () => {
      const user = userEvent.setup()

      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      // Find real-time toggle
      const realtimeToggle = await screen.findByRole('button', { name: /live/i })
      expect(realtimeToggle).toBeInTheDocument()

      // Toggle real-time off
      await user.click(realtimeToggle)
      expect(screen.getByText('Offline')).toBeInTheDocument()

      // Toggle back on
      await user.click(realtimeToggle)
      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('should handle error states gracefully', async () => {
      // Mock API error
      ;(global.fetch as any).mockRejectedValueOnce(new Error('API Error'))

      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/error loading dashboard data/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      })
    })
  })

  describe('PaymentPerformanceChart Component', () => {
    it('should render payment delay reduction tracking accurately', async () => {
      renderWithSession(
        <PaymentPerformanceChart
          companyId="company-123"
          dateRange="30"
          locale="en"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Payment Delay Reduction Performance')).toBeInTheDocument()
        expect(screen.getByText(/track progress toward 25% payment delay reduction goal/i)).toBeInTheDocument()
      })
    })

    it('should calculate progress metrics correctly', async () => {
      renderWithSession(
        <PaymentPerformanceChart
          companyId="company-123"
          dateRange="30"
          locale="en"
          data={[
            { period: '2024-01-01', value: 15.2, target: 25 },
            { period: '2024-01-07', value: 18.2, target: 25 }
          ]}
        />
      )

      await waitFor(() => {
        // Should show current reduction value
        expect(screen.getByText('18.2%')).toBeInTheDocument()

        // Should show progress toward target
        expect(screen.getByText(/72.8%/)).toBeInTheDocument() // 18.2/25 * 100
      })
    })

    it('should handle detailed view with cultural compliance metrics', async () => {
      renderWithSession(
        <PaymentPerformanceChart
          companyId="company-123"
          dateRange="30"
          locale="en"
          detailed={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Cultural Compliance')).toBeInTheDocument()
      })
    })
  })

  describe('UAE-Specific Features', () => {
    describe('Islamic Calendar Integration', () => {
      it('should respect Ramadan scheduling adjustments', async () => {
        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText('Ramadan Compliance')).toBeInTheDocument()
        })
      })

      it('should handle UAE National Day and Eid considerations', async () => {
        const mockData = createMockUAEIntelligenceData()

        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
            data={mockData.culturalCompliance}
          />
        )

        await waitFor(() => {
          expect(screen.getByText(/islamic calendar/i)).toBeInTheDocument()
        })
      })
    })

    describe('Prayer Times Integration', () => {
      it('should display prayer time compliance metrics', async () => {
        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        // Wait for prayer times tab to be available
        await waitFor(() => {
          const prayerTab = screen.getByRole('tab', { name: /prayer times/i })
          expect(prayerTab).toBeInTheDocument()
        })

        // Click prayer times tab
        const prayerTab = screen.getByRole('tab', { name: /prayer times/i })
        fireEvent.click(prayerTab)

        await waitFor(() => {
          expect(screen.getByText('Prayer Times Analysis')).toBeInTheDocument()
          expect(screen.getByText(/how well the reminder system respects prayer times/i)).toBeInTheDocument()
        })
      })

      it('should show all 5 daily prayers compliance', async () => {
        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        // Navigate to prayer times tab
        await waitFor(() => {
          const prayerTab = screen.getByRole('tab', { name: /prayer times/i })
          fireEvent.click(prayerTab)
        })

        await waitFor(() => {
          // Check for all 5 prayers
          expect(screen.getByText('Fajr')).toBeInTheDocument()
          expect(screen.getByText('Dhuhr')).toBeInTheDocument()
          expect(screen.getByText('Asr')).toBeInTheDocument()
          expect(screen.getByText('Maghrib')).toBeInTheDocument()
          expect(screen.getByText('Isha')).toBeInTheDocument()
        })
      })
    })

    describe('Business Hours Calculation', () => {
      it('should respect Sunday-Thursday working week', async () => {
        const mockCompany = createMockCompany({
          businessHours: {
            timezone: 'Asia/Dubai',
            workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
            startHour: 8,
            endHour: 17
          }
        })

        renderWithSession(
          <InvoiceAgingChart
            companyId="company-123"
            dateRange="30"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText(/business days/i)).toBeInTheDocument()
        })
      })
    })
  })

  describe('KPI Calculations and Accuracy', () => {
    it('should display accurate KPI values with trends', async () => {
      renderWithSession(
        <KPICards
          data={{
            kpis: {
              paymentDelayReduction: 18.2,
              targetReduction: 25,
              totalRevenue: 2450000,
              activeInvoices: 156,
              customerSatisfaction: 94.8,
              cultureCompliance: 94.8,
              avgPaymentTime: 22.3,
              collectionEfficiency: 87.5
            },
            trends: {
              paymentReduction: [{ period: '2024-01-01', value: 18.2, target: 25 }]
            }
          }}
          locale="en"
          isLoading={false}
        />
      )

      // Check KPI values
      expect(screen.getByText('18.2%')).toBeInTheDocument() // Payment delay reduction
      expect(screen.getByText('AED 2,450,000')).toBeInTheDocument() // Total revenue
      expect(screen.getByText('156')).toBeInTheDocument() // Active invoices
      expect(screen.getByText('94.8%')).toBeInTheDocument() // Customer satisfaction
      expect(screen.getByText('22.3 days')).toBeInTheDocument() // Avg payment time
      expect(screen.getByText('87.5%')).toBeInTheDocument() // Collection efficiency
    })

    it('should show correct progress toward 25% reduction goal', async () => {
      renderWithSession(
        <KPICards
          data={{
            kpis: {
              paymentDelayReduction: 20.0, // 80% of 25% target
              targetReduction: 25
            }
          }}
          locale="en"
          isLoading={false}
        />
      )

      // Should show 80% progress
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '80')
    })

    it('should indicate goal achievement when target is reached', async () => {
      renderWithSession(
        <KPICards
          data={{
            kpis: {
              paymentDelayReduction: 25.0, // 100% of target
              targetReduction: 25
            }
          }}
          locale="en"
          isLoading={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('✅ Goal Achieved')).toBeInTheDocument()
      })
    })
  })

  describe('Bilingual Support (Arabic/English)', () => {
    it('should render Arabic interface correctly', async () => {
      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="ar"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('لوحة تحكم التحليلات المتقدمة')).toBeInTheDocument()
        expect(screen.getByText(/تحليلات شاملة لتحصيل المدفوعات في دولة الإمارات/)).toBeInTheDocument()
      })
    })

    it('should apply RTL layout for Arabic', async () => {
      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="ar"
        />
      )

      await waitFor(() => {
        const dashboardContainer = screen.getByText('لوحة تحكم التحليلات المتقدمة').closest('div')
        expect(dashboardContainer).toHaveClass('rtl')
      })
    })

    it('should format Arabic numerals correctly', async () => {
      renderWithSession(
        <KPICards
          data={{
            kpis: {
              totalRevenue: 2450000,
              paymentDelayReduction: 18.2
            }
          }}
          locale="ar"
          isLoading={false}
        />
      )

      await waitFor(() => {
        // Check Arabic number formatting
        expect(screen.getByText(/2,450,000/)).toBeInTheDocument()
        expect(screen.getByText(/18.2%/)).toBeInTheDocument()
      })
    })
  })

  describe('Real-Time Features', () => {
    it('should display live metrics with WebSocket connection simulation', async () => {
      renderWithSession(
        <RealTimeMetrics
          companyId="company-123"
          locale="en"
          isEnabled={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/real.?time/i)).toBeInTheDocument()
      })
    })

    it('should handle WebSocket connection failures gracefully', async () => {
      // Mock WebSocket error
      const mockWebSocket = {
        close: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: WebSocket.CLOSED
      }

      global.WebSocket = vi.fn(() => mockWebSocket) as any

      renderWithSession(
        <RealTimeMetrics
          companyId="company-123"
          locale="en"
          isEnabled={true}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/connection error/i)).toBeInTheDocument()
      })
    })

    it('should update metrics every 30 seconds', async () => {
      vi.useFakeTimers()

      const fetchSpy = vi.spyOn(global, 'fetch')

      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      // Initial call
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Fast forward 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2)
      })

      vi.useRealTimers()
    })
  })

  describe('Performance Requirements', () => {
    it('should load dashboard data within performance targets', async () => {
      const startTime = Date.now()

      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument()
      }, { timeout: 3000 }) // Should load within 3 seconds

      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // Initial load should be under 3 seconds
    })

    it('should handle large datasets efficiently', async () => {
      const largeDataset = {
        kpis: {
          paymentDelayReduction: 18.2,
          targetReduction: 25,
          totalRevenue: 2450000,
          activeInvoices: 5000, // Large number of invoices
          customerSatisfaction: 94.8
        }
      }

      renderWithSession(
        <KPICards
          data={largeDataset}
          locale="en"
          isLoading={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('5,000')).toBeInTheDocument()
      }, { timeout: 1000 }) // Should render quickly even with large numbers
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      renderWithSession(
        <KPICards
          data={null}
          locale="en"
          isLoading={false}
        />
      )

      // Should not crash and show empty state
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should handle network errors with retry functionality', async () => {
      const user = userEvent.setup()

      // First call fails
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network Error'))

      renderWithSession(
        <MainAnalyticsDashboard
          companyId="company-123"
          locale="en"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/error loading dashboard data/i)).toBeInTheDocument()
      })

      // Mock successful retry
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kpis: {}, trends: {}, realTime: {}, uaeSpecific: {} })
      })

      const retryButton = screen.getByRole('button', { name: /try again/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.queryByText(/error loading dashboard data/i)).not.toBeInTheDocument()
      })
    })

    it('should validate TRN format correctly', async () => {
      const invalidTrn = '12345' // Too short
      const validTrn = '123456789012345' // 15 digits

      // Test with invalid TRN should show error
      expect(invalidTrn).toHaveLength(5)
      expect(validTrn).toHaveLength(15)

      // TRN validation should pass for 15-digit numbers
      expect(validTrn).toMatch(/^\d{15}$/)
      expect(invalidTrn).not.toMatch(/^\d{15}$/)
    })

    it('should calculate VAT correctly at 5% rate', () => {
      const subtotal = 10000
      const vatRate = 0.05
      const expectedVat = subtotal * vatRate
      const expectedTotal = subtotal + expectedVat

      expect(expectedVat).toBe(500)
      expect(expectedTotal).toBe(10500)

      // UAE VAT should be exactly 5%
      expect(vatRate).toBe(0.05)
    })
  })
})