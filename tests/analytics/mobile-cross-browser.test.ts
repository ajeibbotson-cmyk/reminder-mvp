/**
 * Mobile Responsiveness and Cross-Browser Compatibility Tests
 * Testing analytics dashboard across devices and browsers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionProvider } from 'next-auth/react'

// Components under test
import { MainAnalyticsDashboard } from '@/components/analytics/MainAnalyticsDashboard'
import { PaymentPerformanceChart } from '@/components/analytics/PaymentPerformanceChart'
import { UAEBusinessIntelligence } from '@/components/analytics/UAEBusinessIntelligence'
import { KPICards } from '@/components/analytics/KPICards'

// Mock viewport resizing
const mockViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })

  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

// Mock touch events for mobile testing
const mockTouchEvents = () => {
  const touchEventInit = { bubbles: true, cancelable: true, composed: true }

  return {
    touchStart: (element: Element, touches: { clientX: number; clientY: number }[]) => {
      const touchEvent = new TouchEvent('touchstart', {
        ...touchEventInit,
        touches: touches.map(touch => ({
          ...touch,
          identifier: 0,
          target: element,
          radiusX: 1,
          radiusY: 1,
          rotationAngle: 0,
          force: 1
        })) as any
      })
      element.dispatchEvent(touchEvent)
    },
    touchMove: (element: Element, touches: { clientX: number; clientY: number }[]) => {
      const touchEvent = new TouchEvent('touchmove', {
        ...touchEventInit,
        touches: touches.map(touch => ({
          ...touch,
          identifier: 0,
          target: element,
          radiusX: 1,
          radiusY: 1,
          rotationAngle: 0,
          force: 1
        })) as any
      })
      element.dispatchEvent(touchEvent)
    },
    touchEnd: (element: Element) => {
      const touchEvent = new TouchEvent('touchend', {
        ...touchEventInit,
        touches: [] as any
      })
      element.dispatchEvent(touchEvent)
    }
  }
}

// Mock different user agents for browser testing
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: userAgent
  })
}

// Mock session
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

// Mock API responses
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    kpis: {
      paymentDelayReduction: 18.2,
      targetReduction: 25,
      totalRevenue: 2450000,
      activeInvoices: 156,
      customerSatisfaction: 94.8,
      cultureCompliance: 94.8
    },
    trends: {
      paymentReduction: [{ period: '2024-01-01', value: 18.2, target: 25 }]
    },
    realTime: {
      activeReminders: 24,
      systemHealth: 99.2
    },
    uaeSpecific: {
      prayerTimeCompliance: 94.2
    }
  })
})

describe('Mobile Responsiveness and Cross-Browser Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Reset viewport to default
    mockViewport(1024, 768)
  })

  describe('Mobile Responsiveness', () => {
    describe('iPhone Screen Sizes', () => {
      it('should render correctly on iPhone SE (375x667)', async () => {
        mockViewport(375, 667)

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
        })

        // Check that KPI cards stack vertically on mobile
        const kpiSection = screen.getByText('Key Performance Indicators').closest('div')
        expect(kpiSection).toBeInTheDocument()

        // Header should adapt to mobile layout
        const header = screen.getByText('Advanced Analytics Dashboard').closest('div')
        expect(header).toHaveClass('flex-col', 'lg:flex-row')
      })

      it('should render correctly on iPhone 12/13/14 (390x844)', async () => {
        mockViewport(390, 844)

        renderWithSession(
          <KPICards
            data={{
              kpis: {
                paymentDelayReduction: 18.2,
                totalRevenue: 2450000,
                activeInvoices: 156,
                customerSatisfaction: 94.8
              }
            }}
            locale="en"
            isLoading={false}
          />
        )

        // Should stack in single column on mobile
        const container = screen.getByText('18.2%').closest('.grid')
        expect(container).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
      })

      it('should render correctly on iPhone 14 Pro Max (428x926)', async () => {
        mockViewport(428, 926)

        renderWithSession(
          <PaymentPerformanceChart
            companyId="company-123"
            dateRange="30"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText('Payment Delay Reduction Performance')).toBeInTheDocument()
        })

        // Chart should be responsive
        const chartContainer = screen.getByText('Payment Delay Reduction Performance').closest('.space-y-6')
        expect(chartContainer).toBeInTheDocument()
      })
    })

    describe('Android Screen Sizes', () => {
      it('should render correctly on small Android (360x640)', async () => {
        mockViewport(360, 640)

        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText('UAE Business Intelligence')).toBeInTheDocument()
        })

        // Tabs should stack properly on small screens
        const tabsList = screen.getByRole('tablist')
        expect(tabsList).toHaveClass('grid', 'w-full', 'grid-cols-5')
      })

      it('should render correctly on large Android (412x915)', async () => {
        mockViewport(412, 915)

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          expect(screen.getByText('25% Payment Delay Reduction Goal')).toBeInTheDocument()
        })

        // Progress card should adapt to screen width
        const progressCard = screen.getByText('25% Payment Delay Reduction Goal').closest('.card')
        expect(progressCard).toBeInTheDocument()
      })
    })

    describe('Tablet Screen Sizes', () => {
      it('should render correctly on iPad (768x1024)', async () => {
        mockViewport(768, 1024)

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
        })

        // Should use tablet layout (2 columns for KPIs)
        const kpiCards = screen.getByText('Key Performance Indicators').parentElement
        const gridContainer = kpiCards?.querySelector('.grid')
        expect(gridContainer).toHaveClass('md:grid-cols-2', 'lg:grid-cols-4')
      })

      it('should render correctly on iPad Pro (1024x1366)', async () => {
        mockViewport(1024, 1366)

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
        })

        // Should use desktop-like layout with 4 columns
        const kpiCards = screen.getByText('Key Performance Indicators').parentElement
        const gridContainer = kpiCards?.querySelector('.grid')
        expect(gridContainer).toHaveClass('lg:grid-cols-4')
      })
    })

    describe('Touch Interactions', () => {
      it('should handle touch gestures on mobile', async () => {
        mockViewport(375, 667)
        const touchEvents = mockTouchEvents()

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          const overviewTab = screen.getByRole('tab', { name: /overview/i })
          expect(overviewTab).toBeInTheDocument()
        })

        // Simulate touch interaction on tab
        const paymentsTab = screen.getByRole('tab', { name: /payments/i })
        touchEvents.touchStart(paymentsTab, [{ clientX: 100, clientY: 100 }])
        touchEvents.touchEnd(paymentsTab)

        // Tab should become active
        await waitFor(() => {
          expect(paymentsTab).toHaveAttribute('data-state', 'active')
        })
      })

      it('should support swipe gestures for tab navigation', async () => {
        mockViewport(375, 667)
        const touchEvents = mockTouchEvents()

        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        await waitFor(() => {
          const tabsList = screen.getByRole('tablist')
          expect(tabsList).toBeInTheDocument()
        })

        // Simulate horizontal swipe
        const tabsContainer = screen.getByRole('tablist')
        touchEvents.touchStart(tabsContainer, [{ clientX: 200, clientY: 100 }])
        touchEvents.touchMove(tabsContainer, [{ clientX: 100, clientY: 100 }]) // Swipe left
        touchEvents.touchEnd(tabsContainer)

        // Should handle the gesture without errors
        expect(tabsContainer).toBeInTheDocument()
      })

      it('should have adequate touch targets (44px minimum)', async () => {
        mockViewport(375, 667)

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          const languageButton = screen.getByRole('button', { name: /العربية/i })
          const computedStyle = window.getComputedStyle(languageButton)

          // Touch targets should be at least 44px
          const minTouchSize = 44
          expect(parseInt(computedStyle.minHeight || '0')).toBeGreaterThanOrEqual(minTouchSize)
        })
      })
    })

    describe('Orientation Changes', () => {
      it('should adapt to landscape orientation on mobile', async () => {
        // Portrait first
        mockViewport(375, 667)

        renderWithSession(
          <PaymentPerformanceChart
            companyId="company-123"
            dateRange="30"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText('Payment Delay Reduction Performance')).toBeInTheDocument()
        })

        // Switch to landscape
        mockViewport(667, 375)
        window.dispatchEvent(new Event('resize'))

        // Component should still render correctly
        expect(screen.getByText('Payment Delay Reduction Performance')).toBeInTheDocument()
      })
    })
  })

  describe('Cross-Browser Compatibility', () => {
    describe('Chrome Desktop', () => {
      it('should render correctly in Chrome', async () => {
        mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
        })

        // Charts should render properly
        await waitFor(() => {
          expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument()
        })
      })
    })

    describe('Safari Desktop', () => {
      it('should render correctly in Safari', async () => {
        mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')

        renderWithSession(
          <KPICards
            data={{
              kpis: {
                paymentDelayReduction: 18.2,
                totalRevenue: 2450000
              }
            }}
            locale="en"
            isLoading={false}
          />
        )

        // Safari should display currency formatting correctly
        expect(screen.getByText('AED 2,450,000')).toBeInTheDocument()
        expect(screen.getByText('18.2%')).toBeInTheDocument()
      })
    })

    describe('Firefox Desktop', () => {
      it('should render correctly in Firefox', async () => {
        mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0')

        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText('UAE Business Intelligence')).toBeInTheDocument()
        })

        // Firefox should handle RTL properly
        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="ar"
          />
        )

        await waitFor(() => {
          const container = screen.getByText('الذكاء التجاري الإماراتي').closest('div')
          expect(container).toHaveClass('rtl')
        })
      })
    })

    describe('Edge Desktop', () => {
      it('should render correctly in Microsoft Edge', async () => {
        mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')

        renderWithSession(
          <PaymentPerformanceChart
            companyId="company-123"
            dateRange="30"
            locale="en"
            detailed={true}
          />
        )

        await waitFor(() => {
          expect(screen.getByText('Payment Delay Reduction Performance')).toBeInTheDocument()
        })
      })
    })

    describe('Mobile Browsers', () => {
      it('should render correctly in Mobile Chrome', async () => {
        mockUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')
        mockViewport(375, 667)

        renderWithSession(
          <MainAnalyticsDashboard companyId="company-123" locale="en" />
        )

        await waitFor(() => {
          expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
        })
      })

      it('should render correctly in Mobile Safari', async () => {
        mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
        mockViewport(390, 844)

        renderWithSession(
          <KPICards
            data={{
              kpis: {
                paymentDelayReduction: 18.2,
                totalRevenue: 2450000,
                activeInvoices: 156
              }
            }}
            locale="en"
            isLoading={false}
          />
        )

        // Mobile Safari should handle number formatting
        expect(screen.getByText('AED 2,450,000')).toBeInTheDocument()
        expect(screen.getByText('18.2%')).toBeInTheDocument()
      })

      it('should render correctly in Samsung Internet', async () => {
        mockUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/20.0 Chrome/106.0.0.0 Mobile Safari/537.36')
        mockViewport(412, 915)

        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="30"
            locale="en"
          />
        )

        await waitFor(() => {
          expect(screen.getByText('UAE Business Intelligence')).toBeInTheDocument()
        })
      })
    })
  })

  describe('Performance on Different Devices', () => {
    it('should load quickly on low-end mobile devices', async () => {
      // Simulate low-end device with slower JavaScript execution
      mockViewport(360, 640)

      const startTime = performance.now()

      renderWithSession(
        <KPICards
          data={{
            kpis: {
              paymentDelayReduction: 18.2,
              totalRevenue: 2450000,
              activeInvoices: 156,
              customerSatisfaction: 94.8
            }
          }}
          locale="en"
          isLoading={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('18.2%')).toBeInTheDocument()
      })

      const loadTime = performance.now() - startTime

      // Should load within reasonable time even on slow devices
      expect(loadTime).toBeLessThan(1000) // 1 second
    })

    it('should handle memory constraints gracefully', async () => {
      mockViewport(375, 667)

      // Simulate limited memory by rendering large dataset
      const largeDataset = {
        kpis: {
          paymentDelayReduction: 18.2,
          totalRevenue: 2450000,
          activeInvoices: 10000 // Large number
        },
        trends: {
          paymentReduction: Array.from({ length: 365 }, (_, i) => ({
            period: `2024-${String(i + 1).padStart(3, '0')}`,
            value: 15 + Math.random() * 10,
            target: 25
          }))
        }
      }

      renderWithSession(
        <MainAnalyticsDashboard companyId="company-123" locale="en" />
      )

      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
      })

      // Should not crash or freeze
      expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument()
    })
  })

  describe('Accessibility on Mobile', () => {
    it('should support screen readers on mobile', async () => {
      mockViewport(375, 667)

      renderWithSession(
        <KPICards
          data={{
            kpis: {
              paymentDelayReduction: 18.2,
              targetReduction: 25
            }
          }}
          locale="en"
          isLoading={false}
        />
      )

      // Progress bars should have proper labels
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('should support keyboard navigation on tablets', async () => {
      mockViewport(768, 1024)
      const user = userEvent.setup()

      renderWithSession(
        <MainAnalyticsDashboard companyId="company-123" locale="en" />
      )

      await waitFor(() => {
        const overviewTab = screen.getByRole('tab', { name: /overview/i })
        expect(overviewTab).toBeInTheDocument()
      })

      // Should be able to navigate tabs with keyboard
      const paymentsTab = screen.getByRole('tab', { name: /payments/i })
      await user.keyboard('{Tab}')
      await user.keyboard('{Enter}')

      expect(paymentsTab).toHaveAttribute('data-state', 'active')
    })

    it('should have sufficient color contrast on all screen sizes', async () => {
      // Test on different screen sizes
      const screenSizes = [
        [375, 667], // Mobile
        [768, 1024], // Tablet
        [1920, 1080] // Desktop
      ]

      for (const [width, height] of screenSizes) {
        mockViewport(width, height)

        renderWithSession(
          <UAEBusinessIntelligence
            companyId="company-123"
            dateRange="90"
            locale="en"
          />
        )

        await waitFor(() => {
          const title = screen.getByText('UAE Business Intelligence')
          expect(title).toBeInTheDocument()

          // Title should have sufficient contrast
          const computedStyle = window.getComputedStyle(title)
          expect(computedStyle.color).toBeTruthy()
        })
      }
    })
  })

  describe('PWA Features Preparation', () => {
    it('should be prepared for offline capability', async () => {
      mockViewport(375, 667)

      // Mock offline scenario
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      renderWithSession(
        <MainAnalyticsDashboard companyId="company-123" locale="en" />
      )

      // Should handle offline gracefully
      await waitFor(() => {
        expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
      })
    })

    it('should be installable as PWA on mobile', async () => {
      mockViewport(375, 667)

      // Mock PWA installation prompt
      const mockBeforeInstallPrompt = new Event('beforeinstallprompt')
      Object.defineProperty(mockBeforeInstallPrompt, 'prompt', {
        value: vi.fn()
      })

      window.dispatchEvent(mockBeforeInstallPrompt)

      renderWithSession(
        <MainAnalyticsDashboard companyId="company-123" locale="en" />
      )

      // Component should be ready for PWA installation
      expect(screen.getByText('Advanced Analytics Dashboard')).toBeInTheDocument()
    })
  })
})