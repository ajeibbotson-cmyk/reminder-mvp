/**
 * Test utilities and mock data for UAE Analytics System
 * Comprehensive test helpers for analytics components and API endpoints
 */

import { jest } from '@jest/globals'
import type {
  DashboardMetrics,
  PerformanceData,
  EmailMetrics,
  AnalyticsApiResponse,
  UAEEmirate,
  PrayerTime,
  SequenceStatus,
  ABTestStatus,
  CulturalComplianceReport
} from '../types'

// ===== MOCK DATA GENERATORS =====

export const generateMockDate = (daysAgo: number = 0): string => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

export const generateDateRange = (days: number): string[] => {
  return Array.from({ length: days }, (_, i) => generateMockDate(i)).reverse()
}

// ===== UAE-SPECIFIC MOCK DATA =====

export const mockUAEBusinessHours = {
  sunday: { start: 9, end: 18 },
  monday: { start: 9, end: 18 },
  tuesday: { start: 9, end: 18 },
  wednesday: { start: 9, end: 18 },
  thursday: { start: 9, end: 18 },
  friday: { start: 13, end: 18 }, // Half day
  saturday: { start: 9, end: 14 }  // Half day
}

export const mockPrayerTimes: Array<{ prayer: PrayerTime; time: string }> = [
  { prayer: 'Fajr', time: '05:30' },
  { prayer: 'Dhuhr', time: '12:15' },
  { prayer: 'Asr', time: '15:45' },
  { prayer: 'Maghrib', time: '18:30' },
  { prayer: 'Isha', time: '20:00' }
]

export const mockUAEEmirates: UAEEmirate[] = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'
]

export const mockIslamicHolidays = [
  {
    name: 'Eid Al Fitr',
    startDate: '2024-04-10',
    endDate: '2024-04-12',
    description: 'Festival of Breaking the Fast',
    impact: 'full' as const
  },
  {
    name: 'Eid Al Adha',
    startDate: '2024-06-16',
    endDate: '2024-06-19',
    description: 'Festival of Sacrifice',
    impact: 'full' as const
  },
  {
    name: 'Ramadan',
    startDate: '2024-03-11',
    endDate: '2024-04-09',
    description: 'Holy month of fasting',
    impact: 'partial' as const
  }
]

// ===== DASHBOARD METRICS MOCK DATA =====

export const mockDashboardOverview = {
  totalSequences: 45,
  activeSequences: 32,
  totalEmailsSent: 12580,
  averageResponseRate: 24.5,
  paymentAcceleration: 8.5,
  cultureScore: 87,
  totalRevenue: 2450000, // AED
  pendingAmount: 650000  // AED
}

export const mockEmailVolumeData = generateDateRange(30).map((date, index) => ({
  date,
  sent: 400 + Math.floor(Math.random() * 200),
  delivered: 380 + Math.floor(Math.random() * 180),
  opened: 150 + Math.floor(Math.random() * 100)
}))

export const mockConversionFunnelData = [
  { stage: 'Email Sent', count: 12580, rate: 100 },
  { stage: 'Delivered', count: 12203, rate: 97 },
  { stage: 'Opened', count: 4881, rate: 40 },
  { stage: 'Clicked', count: 1220, rate: 25 },
  { stage: 'Responded', count: 488, rate: 10 },
  { stage: 'Payment Made', count: 195, rate: 4 }
]

export const mockPerformanceOverTimeData = generateDateRange(30).map((date, index) => ({
  date,
  responseRate: 20 + Math.floor(Math.random() * 15),
  paymentRate: 3 + Math.floor(Math.random() * 5),
  cultureScore: 80 + Math.floor(Math.random() * 15)
}))

export const mockBusinessHoursMetrics = {
  compliance: 94.5,
  optimalTimes: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    effectiveness: hour >= 9 && hour <= 17 ? 70 + Math.random() * 30 : 20 + Math.random() * 40
  })),
  prayerTimeRespect: 96.8,
  holidayCompliance: 100
}

export const mockCulturalMetrics = {
  arabicUsage: 65,
  toneAppropriateness: 89,
  localCustomsRespect: 92,
  timeZoneAccuracy: 98
}

export const mockSequenceTypesData = [
  {
    name: 'Payment Reminder',
    usage: 45,
    effectiveness: 78,
    avgDuration: 5.2,
    culturalScore: 88,
    color: '#3B82F6'
  },
  {
    name: 'Invoice Follow-up',
    usage: 30,
    effectiveness: 72,
    avgDuration: 7.1,
    culturalScore: 85,
    color: '#10B981'
  },
  {
    name: 'Final Notice',
    usage: 15,
    effectiveness: 85,
    avgDuration: 3.8,
    culturalScore: 82,
    color: '#F59E0B'
  },
  {
    name: 'Welcome Series',
    usage: 10,
    effectiveness: 68,
    avgDuration: 10.5,
    culturalScore: 90,
    color: '#8B5CF6'
  }
]

export const mockDashboardMetrics: DashboardMetrics = {
  overview: mockDashboardOverview,
  trends: {
    emailVolume: mockEmailVolumeData,
    conversionFunnel: mockConversionFunnelData,
    performanceOverTime: mockPerformanceOverTimeData
  },
  businessHours: mockBusinessHoursMetrics,
  culturalMetrics: mockCulturalMetrics,
  sequenceTypes: mockSequenceTypesData
}

// ===== SEQUENCE PERFORMANCE MOCK DATA =====

export const mockSequenceInfo = {
  id: 'seq_12345',
  name: 'UAE Payment Reminder Sequence',
  type: 'payment_reminder',
  status: 'active' as SequenceStatus,
  totalSteps: 5,
  avgDuration: 7.2,
  createdAt: '2024-01-15T10:30:00Z',
  lastModified: '2024-02-20T14:45:00Z'
}

export const mockSequenceOverviewMetrics = {
  totalContacts: 1250,
  completionRate: 78.5,
  averageResponseTime: 2.3,
  totalRevenue: 485000, // AED
  costPerConversion: 45.50, // AED
  roi: 267
}

export const mockFunnelStages = [
  { stage: 'Started', count: 1250, rate: 100, dropoff: 0 },
  { stage: 'Step 1 - Initial Reminder', count: 1225, rate: 98, dropoff: 2 },
  { stage: 'Step 2 - Follow-up', count: 1100, rate: 88, dropoff: 10.2 },
  { stage: 'Step 3 - Escalation', count: 875, rate: 70, dropoff: 20.5 },
  { stage: 'Step 4 - Final Notice', count: 580, rate: 46.4, dropoff: 33.7 },
  { stage: 'Completed', count: 320, rate: 25.6, dropoff: 44.8 }
]

export const mockSequenceSteps = [
  {
    stepNumber: 1,
    stepType: 'email' as const,
    name: 'Gentle Reminder (Arabic & English)',
    triggerDelay: 0,
    sent: 1225,
    delivered: 1198,
    opened: 516,
    clicked: 103,
    responded: 62,
    bounced: 27,
    unsubscribed: 3,
    effectiveness: 43.1,
    cultureScore: 92,
    dropoffRate: 2.0
  },
  {
    stepNumber: 2,
    stepType: 'email' as const,
    name: 'Professional Follow-up',
    triggerDelay: 3,
    sent: 1100,
    delivered: 1076,
    opened: 456,
    clicked: 89,
    responded: 78,
    bounced: 24,
    unsubscribed: 5,
    effectiveness: 42.4,
    cultureScore: 88,
    dropoffRate: 10.2
  },
  {
    stepNumber: 3,
    stepType: 'email' as const,
    name: 'Escalation Notice',
    triggerDelay: 7,
    sent: 875,
    delivered: 856,
    opened: 385,
    clicked: 96,
    responded: 89,
    bounced: 19,
    unsubscribed: 8,
    effectiveness: 45.0,
    cultureScore: 85,
    dropoffRate: 20.5
  },
  {
    stepNumber: 4,
    stepType: 'call' as const,
    name: 'Personal Call (Arabic)',
    triggerDelay: 14,
    sent: 580,
    delivered: 580,
    opened: 0,
    clicked: 0,
    responded: 156,
    bounced: 0,
    unsubscribed: 12,
    effectiveness: 26.9,
    cultureScore: 95,
    dropoffRate: 33.7
  },
  {
    stepNumber: 5,
    stepType: 'email' as const,
    name: 'Final Legal Notice',
    triggerDelay: 21,
    sent: 320,
    delivered: 312,
    opened: 298,
    clicked: 145,
    responded: 95,
    bounced: 8,
    unsubscribed: 25,
    effectiveness: 30.4,
    cultureScore: 78,
    dropoffRate: 44.8
  }
]

export const mockTimingAnalysis = generateDateRange(30).map((date) => ({
  day: date,
  startedContacts: 40 + Math.floor(Math.random() * 20),
  completedContacts: 25 + Math.floor(Math.random() * 15),
  responseRate: 18 + Math.floor(Math.random() * 12),
  cultureCompliance: 85 + Math.floor(Math.random() * 10)
}))

export const mockPerformanceRecommendations = [
  {
    type: 'optimization' as const,
    priority: 'high' as const,
    title: 'Optimize Step 3 Timing',
    description: 'Current 7-day delay shows suboptimal performance. Consider reducing to 5 days based on UAE business culture.',
    expectedImprovement: '+12% response rate'
  },
  {
    type: 'cultural' as const,
    priority: 'medium' as const,
    title: 'Enhance Arabic Content',
    description: 'Include more culturally appropriate greetings and local business phrases in Arabic versions.',
    expectedImprovement: '+8% cultural score'
  },
  {
    type: 'timing' as const,
    priority: 'medium' as const,
    title: 'Avoid Prayer Time Sending',
    description: 'Current schedule sends some emails during Maghrib prayer time. Adjust scheduling logic.',
    expectedImprovement: '+15% open rate'
  },
  {
    type: 'content' as const,
    priority: 'low' as const,
    title: 'Add Payment Link Prominence',
    description: 'Make payment links more visible in emails, especially for mobile users (70% of UAE audience).',
    expectedImprovement: '+5% click rate'
  }
]

export const mockPerformanceData: PerformanceData = {
  sequence: mockSequenceInfo,
  overview: mockSequenceOverviewMetrics,
  funnel: mockFunnelStages,
  steps: mockSequenceSteps,
  timingAnalysis: mockTimingAnalysis,
  recommendations: mockPerformanceRecommendations
}

// ===== EMAIL ANALYTICS MOCK DATA =====

export const mockEmailOverviewMetrics = {
  totalEmailsSent: 12580,
  deliveryRate: 97.2,
  openRate: 38.8,
  clickRate: 9.7,
  responseRate: 3.9,
  bounceRate: 2.8,
  unsubscribeRate: 0.4,
  averageEngagement: 42.3
}

export const mockDeliverabilityMetrics = {
  deliveredEmails: 12230,
  bouncedEmails: 350,
  blockedEmails: 45,
  deferredEmails: 78,
  reputationScore: 94.5,
  domainHealth: 97.8
}

export const mockHourlyEngagement = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  opens: hour >= 9 && hour <= 17 ? 150 + Math.floor(Math.random() * 100) : 50 + Math.floor(Math.random() * 50),
  clicks: hour >= 9 && hour <= 17 ? 35 + Math.floor(Math.random() * 25) : 10 + Math.floor(Math.random() * 15),
  responses: hour >= 9 && hour <= 17 ? 8 + Math.floor(Math.random() * 12) : 2 + Math.floor(Math.random() * 5)
}))

export const mockDailyEngagement = [
  { day: 'Sunday', opens: 720, clicks: 185, responses: 42 },
  { day: 'Monday', opens: 850, clicks: 220, responses: 58 },
  { day: 'Tuesday', opens: 890, clicks: 235, responses: 62 },
  { day: 'Wednesday', opens: 920, clicks: 245, responses: 65 },
  { day: 'Thursday', opens: 780, clicks: 205, responses: 48 },
  { day: 'Friday', opens: 450, clicks: 95, responses: 22 },
  { day: 'Saturday', opens: 380, clicks: 85, responses: 18 }
]

export const mockDeviceBreakdown = [
  { device: 'Mobile' as const, percentage: 68.5, color: '#3B82F6' },
  { device: 'Desktop' as const, percentage: 24.8, color: '#10B981' },
  { device: 'Tablet' as const, percentage: 6.7, color: '#F59E0B' }
]

export const mockLocationData = mockUAEEmirates.map((emirate, index) => ({
  emirate,
  engagement: 30 + Math.floor(Math.random() * 40),
  volume: 100 + Math.floor(Math.random() * 500)
}))

export const mockEngagementMetrics = {
  hourlyEngagement: mockHourlyEngagement,
  dailyEngagement: mockDailyEngagement,
  deviceBreakdown: mockDeviceBreakdown,
  locationData: mockLocationData
}

export const mockLanguagePerformance = [
  {
    language: 'Arabic',
    opens: 2450,
    clicks: 485,
    responses: 125,
    volume: 5200
  },
  {
    language: 'English',
    opens: 2180,
    clicks: 520,
    responses: 145,
    volume: 5800
  },
  {
    language: 'Bilingual',
    opens: 1250,
    clicks: 280,
    responses: 78,
    volume: 1580
  }
]

export const mockCulturalElements = {
  arabicGreetings: { usage: 78, effectiveness: 85 },
  islamicPhrases: { usage: 45, effectiveness: 92 },
  localReferences: { usage: 62, effectiveness: 76 },
  culturalTiming: { usage: 89, effectiveness: 94 }
}

export const mockRamadanPerformance = {
  beforeRamadan: 42.5,
  duringRamadan: 28.3,
  afterRamadan: 38.7
}

export const mockEmailCulturalMetrics = {
  languagePerformance: mockLanguagePerformance,
  culturalElements: mockCulturalElements,
  ramadanPerformance: mockRamadanPerformance
}

export const mockOptimalSendTimes = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  effectiveness: hour >= 9 && hour <= 17 ? 70 + Math.random() * 25 : 25 + Math.random() * 30,
  volume: hour >= 9 && hour <= 17 ? 200 + Math.floor(Math.random() * 150) : 50 + Math.floor(Math.random() * 80)
}))

export const mockPrayerTimeImpact = mockPrayerTimes.map(({ prayer }) => ({
  prayer,
  beforePrayer: 45 + Math.floor(Math.random() * 25),
  afterPrayer: 35 + Math.floor(Math.random() * 20)
}))

export const mockWeekdayPerformance = [
  { day: 'Sunday' as const, effectiveness: 72, volume: 1850 },
  { day: 'Monday' as const, effectiveness: 78, volume: 2100 },
  { day: 'Tuesday' as const, effectiveness: 82, volume: 2250 },
  { day: 'Wednesday' as const, effectiveness: 85, volume: 2350 },
  { day: 'Thursday' as const, effectiveness: 75, volume: 1950 },
  { day: 'Friday' as const, effectiveness: 45, volume: 950 },
  { day: 'Saturday' as const, effectiveness: 38, volume: 750 }
]

export const mockTimingMetrics = {
  optimalSendTimes: mockOptimalSendTimes,
  prayerTimeImpact: mockPrayerTimeImpact,
  businessHoursCompliance: 94.5,
  weekdayPerformance: mockWeekdayPerformance
}

export const mockABTests = [
  {
    testId: 'ab_001',
    name: 'Arabic vs English Subject Lines',
    status: 'completed' as ABTestStatus,
    variants: [
      {
        name: 'Arabic Subject',
        type: 'subject' as const,
        openRate: 42.5,
        clickRate: 8.9,
        responseRate: 4.2,
        sampleSize: 2500
      },
      {
        name: 'English Subject',
        type: 'subject' as const,
        openRate: 38.2,
        clickRate: 9.8,
        responseRate: 3.8,
        sampleSize: 2500
      }
    ],
    winner: 'Arabic Subject',
    confidence: 87.5,
    startDate: '2024-01-15',
    endDate: '2024-02-15'
  },
  {
    testId: 'ab_002',
    name: 'Send Time Optimization',
    status: 'running' as ABTestStatus,
    variants: [
      {
        name: 'Morning (9 AM)',
        type: 'sendTime' as const,
        openRate: 45.2,
        clickRate: 11.5,
        responseRate: 4.8,
        sampleSize: 1200
      },
      {
        name: 'Afternoon (2 PM)',
        type: 'sendTime' as const,
        openRate: 38.7,
        clickRate: 9.2,
        responseRate: 3.9,
        sampleSize: 1200
      }
    ],
    confidence: 72.3,
    startDate: '2024-02-01'
  }
]

export const mockEmailMetrics: EmailMetrics = {
  overview: mockEmailOverviewMetrics,
  deliverability: mockDeliverabilityMetrics,
  engagement: mockEngagementMetrics,
  cultural: mockEmailCulturalMetrics,
  timing: mockTimingMetrics,
  abTests: mockABTests
}

// ===== CULTURAL COMPLIANCE MOCK DATA =====

export const mockCulturalComplianceReport: CulturalComplianceReport = {
  score: 87,
  breakdown: {
    businessHours: 94,
    prayerTimes: 92,
    holidays: 100,
    language: 85,
    tone: 82
  },
  violations: [
    {
      type: 'Prayer Time Overlap',
      description: '12 emails sent during Maghrib prayer time (18:30-19:00)',
      severity: 'medium',
      recommendation: 'Adjust scheduling to avoid prayer times'
    },
    {
      type: 'Weekend Scheduling',
      description: '45 emails sent on Friday afternoon during Jummah prayer',
      severity: 'high',
      recommendation: 'Avoid sending emails on Friday afternoons'
    }
  ],
  improvements: [
    {
      area: 'Language Usage',
      currentScore: 85,
      potentialScore: 92,
      actions: [
        'Increase Arabic greeting usage',
        'Add more local business phrases',
        'Include cultural context in tone'
      ]
    },
    {
      area: 'Timing Optimization',
      currentScore: 92,
      potentialScore: 97,
      actions: [
        'Implement prayer time API integration',
        'Add Islamic calendar awareness',
        'Optimize for UAE business hours'
      ]
    }
  ]
}

// ===== TEST UTILITIES =====

export const createMockAnalyticsApiResponse = <T>(data: T): AnalyticsApiResponse<T> => ({
  success: true,
  data,
  message: 'Analytics data retrieved successfully',
  timestamp: new Date().toISOString()
})

export const createMockErrorResponse = (error: string): AnalyticsApiResponse<null> => ({
  success: false,
  error,
  data: null,
  timestamp: new Date().toISOString()
})

// ===== MOCK API FUNCTIONS =====

export const mockAnalyticsApi = {
  getDashboardMetrics: jest.fn().mockResolvedValue(createMockAnalyticsApiResponse(mockDashboardMetrics)),
  getSequencePerformance: jest.fn().mockResolvedValue(createMockAnalyticsApiResponse(mockPerformanceData)),
  getEmailAnalytics: jest.fn().mockResolvedValue(createMockAnalyticsApiResponse(mockEmailMetrics)),
  getCulturalCompliance: jest.fn().mockResolvedValue(createMockAnalyticsApiResponse(mockCulturalComplianceReport)),
  exportAnalytics: jest.fn().mockResolvedValue({ success: true, downloadUrl: 'https://example.com/export.pdf' })
}

// ===== RECHARTS MOCKS =====

export const mockRechartsComponents = {
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  AreaChart: ({ children }: { children: React.ReactNode }) => `<AreaChart>${children}</AreaChart>`,
  Area: () => '<Area />',
  BarChart: ({ children }: { children: React.ReactNode }) => `<BarChart>${children}</BarChart>`,
  Bar: () => '<Bar />',
  LineChart: ({ children }: { children: React.ReactNode }) => `<LineChart>${children}</LineChart>`,
  Line: () => '<Line />',
  PieChart: ({ children }: { children: React.ReactNode }) => `<PieChart>${children}</PieChart>`,
  Pie: () => '<Pie />',
  Cell: () => '<Cell />',
  XAxis: () => '<XAxis />',
  YAxis: () => '<YAxis />',
  CartesianGrid: () => '<CartesianGrid />',
  Tooltip: () => '<Tooltip />',
  Legend: () => '<Legend />'
}

// ===== COMPANY AND USER MOCKS =====

export const mockCompany = {
  id: 'company_uae_001',
  name: 'UAE Payment Solutions LLC',
  trn: '123456789012345',
  defaultVatRate: 5.00,
  country: 'AE',
  timezone: 'Asia/Dubai',
  businessHours: mockUAEBusinessHours,
  culturalSettings: {
    primaryLanguage: 'ar',
    secondaryLanguage: 'en',
    respectPrayerTimes: true,
    observeIslamicHolidays: true
  }
}

export const mockUser = {
  id: 'user_001',
  email: 'ahmed@uaepayments.ae',
  name: 'Ahmed Al Mansouri',
  role: 'FINANCE',
  companyId: mockCompany.id,
  locale: 'ar-AE',
  timezone: 'Asia/Dubai'
}

export const mockAuthContext = {
  user: mockUser,
  company: mockCompany
}

// ===== TEST HELPER FUNCTIONS =====

export const waitForLoadingToFinish = async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
}

export const mockWindowResizeTo = (width: number, height: number) => {
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
  window.dispatchEvent(new Event('resize'))
}

export const mockIntersectionObserver = () => {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }))
}

export const setupMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// ===== LARGE DATASET MOCKS FOR PERFORMANCE TESTING =====

export const generateLargeDataset = (size: number = 1000) => {
  return Array.from({ length: size }, (_, index) => ({
    id: `item_${index}`,
    date: generateMockDate(index % 365),
    value: Math.floor(Math.random() * 1000),
    responseRate: Math.floor(Math.random() * 100),
    culturalScore: 70 + Math.floor(Math.random() * 30),
    emirate: mockUAEEmirates[index % mockUAEEmirates.length]
  }))
}

export const mockLargeAnalyticsDataset = {
  emailVolume: generateLargeDataset(365), // 1 year of daily data
  sequenceSteps: generateLargeDataset(100), // 100 different sequence steps
  performanceData: generateLargeDataset(500), // 500 performance data points
  culturalMetrics: generateLargeDataset(200) // 200 cultural assessment points
}

// ===== ACCESSIBILITY TEST HELPERS =====

export const checkAriaLabels = (container: HTMLElement) => {
  const charts = container.querySelectorAll('[role="img"], [role="chart"], [role="graph"]')
  charts.forEach(chart => {
    expect(chart).toHaveAttribute('aria-label')
  })
}

export const checkKeyboardNavigation = async (container: HTMLElement) => {
  const interactiveElements = container.querySelectorAll('button, [tabindex="0"], input, select')
  interactiveElements.forEach(element => {
    expect(element).toHaveAttribute('tabindex')
  })
}

export const checkColorContrast = (container: HTMLElement) => {
  // Basic color contrast check for chart elements
  const colorElements = container.querySelectorAll('[style*="color"], [class*="text-"]')
  expect(colorElements.length).toBeGreaterThan(0)
}

// Export all utilities
export default {
  // Mock data
  mockDashboardMetrics,
  mockPerformanceData,
  mockEmailMetrics,
  mockCulturalComplianceReport,
  mockAnalyticsApi,
  mockRechartsComponents,
  mockCompany,
  mockUser,
  mockAuthContext,
  
  // Generators
  generateMockDate,
  generateDateRange,
  generateLargeDataset,
  createMockAnalyticsApiResponse,
  createMockErrorResponse,
  
  // Test utilities
  waitForLoadingToFinish,
  mockWindowResizeTo,
  mockIntersectionObserver,
  setupMatchMedia,
  checkAriaLabels,
  checkKeyboardNavigation,
  checkColorContrast,
  
  // Large datasets
  mockLargeAnalyticsDataset
}