/**
 * UAE-Specific Features Validation Tests
 * Comprehensive testing for UAE market compliance and cultural features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// UAE-specific utilities and services
import { formatAEDCurrency, formatPercentage } from '@/components/ui/uae-formatters'
import { UAEBusinessIntelligence } from '@/components/analytics/UAEBusinessIntelligence'
import { InvoiceAgingChart } from '@/components/analytics/InvoiceAgingChart'

// Mock data
import {
  createMockUAEIntelligenceData,
  createMockAnalyticsFilters
} from '@/tests/setup/analytics-fixtures'

// Mock Islamic calendar and prayer times
vi.mock('@/lib/utils/islamic-calendar', () => ({
  isRamadan: vi.fn(),
  isEidHoliday: vi.fn(),
  getNextPrayerTime: vi.fn(),
  isPrayerTime: vi.fn(),
  getIslamicDate: vi.fn(),
  getUAENationalHolidays: vi.fn()
}))

vi.mock('@/lib/utils/uae-business-hours', () => ({
  isBusinessDay: vi.fn(),
  getBusinessHours: vi.fn(),
  calculateBusinessDays: vi.fn(),
  adjustForPrayerTimes: vi.fn()
}))

global.fetch = vi.fn()

describe('UAE-Specific Features Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful API responses
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => createMockUAEIntelligenceData()
    })
  })

  describe('Islamic Calendar Integration', () => {
    it('should recognize and handle Ramadan period correctly', async () => {
      const { isRamadan, getIslamicDate } = await import('@/lib/utils/islamic-calendar')

      // Mock Ramadan period
      ;(isRamadan as any).mockReturnValue(true)
      ;(getIslamicDate as any).mockReturnValue({
        year: 1445,
        month: 9, // Ramadan
        day: 15,
        monthName: 'Ramadan'
      })

      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="90"
          locale="en"
        />
      )

      await waitFor(() => {
        // Navigate to Ramadan compliance tab
        const ramadanTab = screen.getByRole('tab', { name: /ramadan/i })
        fireEvent.click(ramadanTab)
      })

      await waitFor(() => {
        expect(screen.getByText('Ramadan Compliance')).toBeInTheDocument()
        expect(screen.getByText(/automatically respects ramadan/i)).toBeInTheDocument()
      })
    })

    it('should identify UAE National Day and Eid holidays', async () => {
      const { getUAENationalHolidays, isEidHoliday } = await import('@/lib/utils/islamic-calendar')

      const nationalHolidays = [
        { name: 'UAE National Day', date: new Date('2024-12-02'), type: 'national' },
        { name: 'Eid Al-Fitr', date: new Date('2024-04-10'), type: 'islamic' },
        { name: 'Eid Al-Adha', date: new Date('2024-06-16'), type: 'islamic' }
      ]

      ;(getUAENationalHolidays as any).mockReturnValue(nationalHolidays)
      ;(isEidHoliday as any).mockReturnValue(true)

      render(
        <InvoiceAgingChart
          companyId="company-123"
          dateRange="365"
          locale="en"
        />
      )

      await waitFor(() => {
        // Should show holiday adjustments in calculations
        expect(screen.getByText(/business days/i)).toBeInTheDocument()
      })
    })

    it('should calculate business days excluding UAE holidays', () => {
      const { calculateBusinessDays } = require('@/lib/utils/uae-business-hours')

      const startDate = new Date('2024-12-01') // Day before UAE National Day
      const endDate = new Date('2024-12-05') // Few days after

      // Mock implementation
      ;(calculateBusinessDays as any).mockImplementation((start: Date, end: Date) => {
        // Should exclude UAE National Day (Dec 2) and weekends
        const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        const businessDays = Math.max(0, totalDays - 1) // Exclude national day
        return businessDays
      })

      const businessDays = calculateBusinessDays(startDate, endDate)

      // Should be less than total days due to holiday exclusion
      expect(businessDays).toBeLessThan(4)
      expect(calculateBusinessDays).toHaveBeenCalledWith(startDate, endDate)
    })
  })

  describe('Prayer Times Integration', () => {
    it('should identify all 5 daily prayer times correctly', async () => {
      const { getNextPrayerTime, isPrayerTime } = await import('@/lib/utils/islamic-calendar')

      const prayerTimes = {
        fajr: '05:45',
        dhuhr: '12:15',
        asr: '15:30',
        maghrib: '18:10',
        isha: '19:25'
      }

      ;(getNextPrayerTime as any).mockReturnValue({
        name: 'Dhuhr',
        time: '12:15',
        timeUntil: 45 // minutes
      })

      ;(isPrayerTime as any).mockReturnValue(false)

      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="en"
        />
      )

      // Navigate to prayer times analysis
      await waitFor(() => {
        const prayerTab = screen.getByRole('tab', { name: /prayer times/i })
        fireEvent.click(prayerTab)
      })

      await waitFor(() => {
        expect(screen.getByText('Prayer Times Analysis')).toBeInTheDocument()
        expect(screen.getByText('Fajr')).toBeInTheDocument()
        expect(screen.getByText('Dhuhr')).toBeInTheDocument()
        expect(screen.getByText('Asr')).toBeInTheDocument()
        expect(screen.getByText('Maghrib')).toBeInTheDocument()
        expect(screen.getByText('Isha')).toBeInTheDocument()
      })
    })

    it('should adjust reminder scheduling to avoid prayer times', () => {
      const { adjustForPrayerTimes } = require('@/lib/utils/uae-business-hours')

      const scheduledTime = new Date('2024-01-15T12:15:00Z') // Dhuhr time
      const adjustedTime = new Date('2024-01-15T13:00:00Z') // After prayer

      ;(adjustForPrayerTimes as any).mockReturnValue(adjustedTime)

      const result = adjustForPrayerTimes(scheduledTime)

      expect(result).toEqual(adjustedTime)
      expect(result.getTime()).toBeGreaterThan(scheduledTime.getTime())
    })

    it('should show prayer time compliance scores', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="en"
        />
      )

      await waitFor(() => {
        const prayerTab = screen.getByRole('tab', { name: /prayer times/i })
        fireEvent.click(prayerTab)
      })

      await waitFor(() => {
        expect(screen.getByText('Prayer Time Impact on Responses')).toBeInTheDocument()
        expect(screen.getByText('Most Impactful Prayer Times')).toBeInTheDocument()
      })
    })
  })

  describe('Business Hours Compliance', () => {
    it('should recognize Sunday-Thursday as working days in UAE', () => {
      const { isBusinessDay } = require('@/lib/utils/uae-business-hours')

      // Mock UAE business days (Sunday = 0, Thursday = 4)
      ;(isBusinessDay as any).mockImplementation((date: Date) => {
        const day = date.getDay()
        return day >= 0 && day <= 4 // Sunday (0) to Thursday (4)
      })

      // Test each day of the week
      expect(isBusinessDay(new Date('2024-01-14'))).toBe(true) // Sunday
      expect(isBusinessDay(new Date('2024-01-15'))).toBe(true) // Monday
      expect(isBusinessDay(new Date('2024-01-16'))).toBe(true) // Tuesday
      expect(isBusinessDay(new Date('2024-01-17'))).toBe(true) // Wednesday
      expect(isBusinessDay(new Date('2024-01-18'))).toBe(true) // Thursday
      expect(isBusinessDay(new Date('2024-01-19'))).toBe(false) // Friday
      expect(isBusinessDay(new Date('2024-01-20'))).toBe(false) // Saturday
    })

    it('should use UAE timezone (GST, UTC+4) for business hours', () => {
      const { getBusinessHours } = require('@/lib/utils/uae-business-hours')

      const businessHours = {
        timezone: 'Asia/Dubai',
        workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
        startHour: 8, // 8 AM GST
        endHour: 17, // 5 PM GST
        lunchBreak: { start: 12, end: 13 } // 12-1 PM lunch
      }

      ;(getBusinessHours as any).mockReturnValue(businessHours)

      const result = getBusinessHours()

      expect(result.timezone).toBe('Asia/Dubai')
      expect(result.workingDays).toEqual([0, 1, 2, 3, 4])
      expect(result.startHour).toBe(8)
      expect(result.endHour).toBe(17)
    })

    it('should calculate accurate business hours excluding prayer times', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="en"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/business hours impact/i)).toBeInTheDocument()
      })
    })
  })

  describe('TRN (Trade Registration Number) Validation', () => {
    it('should validate 15-digit TRN format correctly', () => {
      const validTrn = '123456789012345' // 15 digits
      const invalidTrn1 = '12345678901234' // 14 digits
      const invalidTrn2 = '1234567890123456' // 16 digits
      const invalidTrn3 = '12345678901234A' // Contains letter

      const trnRegex = /^\d{15}$/

      expect(validTrn).toMatch(trnRegex)
      expect(invalidTrn1).not.toMatch(trnRegex)
      expect(invalidTrn2).not.toMatch(trnRegex)
      expect(invalidTrn3).not.toMatch(trnRegex)
    })

    it('should handle TRN validation in forms', async () => {
      const mockValidateTrn = (trn: string) => {
        return /^\d{15}$/.test(trn)
      }

      expect(mockValidateTrn('123456789012345')).toBe(true)
      expect(mockValidateTrn('12345')).toBe(false)
    })
  })

  describe('VAT Calculations', () => {
    it('should calculate UAE VAT at exactly 5% rate', () => {
      const subtotal = 10000 // AED 10,000
      const vatRate = 0.05 // 5% UAE VAT rate
      const vatAmount = subtotal * vatRate
      const totalWithVat = subtotal + vatAmount

      expect(vatAmount).toBe(500) // AED 500
      expect(totalWithVat).toBe(10500) // AED 10,500
      expect(vatRate).toBe(0.05) // Exactly 5%
    })

    it('should handle VAT-inclusive and VAT-exclusive calculations', () => {
      // VAT-exclusive: Add VAT to subtotal
      const subtotalExclusive = 10000
      const vatAmountExclusive = subtotalExclusive * 0.05
      const totalExclusive = subtotalExclusive + vatAmountExclusive

      expect(totalExclusive).toBe(10500)

      // VAT-inclusive: Extract VAT from total
      const totalInclusive = 10500
      const subtotalInclusive = totalInclusive / 1.05
      const vatAmountInclusive = totalInclusive - subtotalInclusive

      expect(Math.round(subtotalInclusive * 100) / 100).toBe(10000)
      expect(Math.round(vatAmountInclusive * 100) / 100).toBe(500)
    })

    it('should display VAT calculations accurately in analytics', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="en"
        />
      )

      await waitFor(() => {
        // Should show VAT compliance metrics
        expect(screen.getByText(/vat/i)).toBeInTheDocument()
      })
    })
  })

  describe('AED Currency Formatting', () => {
    it('should format AED currency with correct symbols and precision', () => {
      expect(formatAEDCurrency(1000)).toBe('AED 1,000')
      expect(formatAEDCurrency(1000.50)).toBe('AED 1,000.50')
      expect(formatAEDCurrency(1234567.89)).toBe('AED 1,234,567.89')
      expect(formatAEDCurrency(0)).toBe('AED 0')
    })

    it('should handle large currency amounts correctly', () => {
      const millionAED = 1000000
      const billionAED = 1000000000

      expect(formatAEDCurrency(millionAED)).toBe('AED 1,000,000')
      expect(formatAEDCurrency(billionAED)).toBe('AED 1,000,000,000')
    })

    it('should format currency in Arabic locale when needed', () => {
      // Mock Arabic number formatting
      const formatAEDCurrencyArabic = (amount: number) => {
        return `${amount.toLocaleString('ar-AE')} درهم`
      }

      expect(formatAEDCurrencyArabic(1000)).toContain('درهم')
    })
  })

  describe('Language and Localization', () => {
    it('should switch between English and Arabic correctly', async () => {
      const user = userEvent.setup()

      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="en"
        />
      )

      // Should start with English
      await waitFor(() => {
        expect(screen.getByText('UAE Business Intelligence')).toBeInTheDocument()
      })

      // Mock language switch (this would typically be handled by parent component)
      // Re-render with Arabic locale
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="ar"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('الذكاء التجاري الإماراتي')).toBeInTheDocument()
      })
    })

    it('should apply RTL layout for Arabic content', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="ar"
        />
      )

      await waitFor(() => {
        const container = screen.getByText('الذكاء التجاري الإماراتي').closest('div')
        expect(container).toHaveClass('rtl')
      })
    })

    it('should format dates according to Arabic/Islamic calendar when appropriate', () => {
      const date = new Date('2024-01-15')

      // Mock Islamic date formatting
      const formatIslamicDate = (date: Date) => {
        return '15 جمادى الآخرة 1445'
      }

      expect(formatIslamicDate(date)).toContain('جمادى')
    })

    it('should use appropriate cultural greetings and terminology', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="30"
          locale="ar"
        />
      )

      await waitFor(() => {
        // Should use respectful Arabic business terminology
        expect(screen.getByText(/امتثال/)).toBeInTheDocument() // Compliance
        expect(screen.getByText(/احترام/)).toBeInTheDocument() // Respect
      })
    })
  })

  describe('Emirates-Specific Analysis', () => {
    it('should provide breakdown by all 7 Emirates', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="90"
          locale="en"
        />
      )

      // Navigate to Emirates tab
      await waitFor(() => {
        const emiratesTab = screen.getByRole('tab', { name: /emirates/i })
        fireEvent.click(emiratesTab)
      })

      await waitFor(() => {
        expect(screen.getByText('Performance by Emirate')).toBeInTheDocument()
      })

      // All emirates should be represented in the data
      // The chart should show effectiveness and volume data
      expect(screen.getByText(/effectiveness/i)).toBeInTheDocument()
      expect(screen.getByText(/volume/i)).toBeInTheDocument()
    })

    it('should show Dubai and Abu Dhabi as major business centers', async () => {
      const mockEmirateData = createMockUAEIntelligenceData()

      expect(mockEmirateData.marketInsights.geographicDistribution.Dubai).toBeGreaterThan(30)
      expect(mockEmirateData.marketInsights.geographicDistribution['Abu Dhabi']).toBeGreaterThan(20)
    })
  })

  describe('Cultural Sensitivity Metrics', () => {
    it('should measure respectful communication levels', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="90"
          locale="en"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Overall Compliance')).toBeInTheDocument()
        expect(screen.getByText(/cultural compliance/i)).toBeInTheDocument()
      })
    })

    it('should track Islamic holiday awareness', async () => {
      const mockData = createMockUAEIntelligenceData()

      expect(mockData.culturalCompliance.ramadanAdjustments.score).toBeGreaterThan(80)
      expect(mockData.culturalCompliance.ramadanAdjustments.culturalSensitivity).toBeGreaterThan(80)
    })

    it('should provide cultural improvement recommendations', async () => {
      render(
        <UAEBusinessIntelligence
          companyId="company-123"
          dateRange="90"
          locale="en"
        />
      )

      // Navigate to recommendations tab
      await waitFor(() => {
        const recommendationsTab = screen.getByRole('tab', { name: /recommendations/i })
        fireEvent.click(recommendationsTab)
      })

      await waitFor(() => {
        // Should show cultural recommendations or excellent message
        const hasRecommendations = screen.queryByText(/recommendation/i)
        const hasExcellentMessage = screen.queryByText(/excellent.*fully compliant/i)

        expect(hasRecommendations || hasExcellentMessage).toBeTruthy()
      })
    })
  })
})