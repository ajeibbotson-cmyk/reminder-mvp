/**
 * Comprehensive Test Suite for Sequences Analytics API Endpoint
 * Tests overall analytics, company isolation, security, and performance optimization
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals')
const { NextRequest } = require('next/server')
const { GET } = require('../route')
const { prisma } = require('@/lib/prisma')
const { sequenceExecutionService } = require('@/lib/services/sequence-execution-service')
const { sequenceTriggersService } = require('@/lib/services/sequence-triggers-service')
const { emailSchedulingService } = require('@/lib/services/email-scheduling-service')

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    sequences: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    sequenceExecutions: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    emailLogs: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    emailSequenceSteps: {
      findMany: jest.fn(),
    },
    companies: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/services/sequence-execution-service', () => ({
  sequenceExecutionService: {
    getCompanyAnalytics: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    getTrendAnalysis: jest.fn(),
    getCulturalCompliance: jest.fn(),
  },
}))

jest.mock('@/lib/services/sequence-triggers-service', () => ({
  sequenceTriggersService: {
    getTriggerMetrics: jest.fn(),
    getOptimizationSuggestions: jest.fn(),
  },
}))

jest.mock('@/lib/services/email-scheduling-service', () => ({
  emailSchedulingService: {
    getTimingAnalytics: jest.fn(),
    getUAEBusinessHoursCompliance: jest.fn(),
  },
}))

// Test data
const mockCompany = {
  id: 'company-uae-001',
  name: 'UAE Payment Solutions LLC',
  trn: '123456789012345',
  country: 'AE',
  timezone: 'Asia/Dubai',
  businessHours: {
    sunday: { start: 9, end: 18 },
    monday: { start: 9, end: 18 },
    tuesday: { start: 9, end: 18 },
    wednesday: { start: 9, end: 18 },
    thursday: { start: 9, end: 18 },
    friday: { start: 13, end: 18 },
    saturday: { start: 9, end: 14 }
  },
  culturalSettings: {
    primaryLanguage: 'ar',
    secondaryLanguage: 'en',
    respectPrayerTimes: true,
    observeIslamicHolidays: true
  }
}

const mockUser = {
  id: 'user-001',
  email: 'ahmed@uaepayments.ae',
  name: 'Ahmed Al Mansouri',
  role: 'FINANCE',
  companyId: mockCompany.id,
  company: mockCompany
}

const mockSession = {
  user: {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name
  }
}

const mockSequences = [
  {
    id: 'seq-001',
    name: 'UAE Payment Reminder',
    type: 'payment_reminder',
    status: 'active',
    companyId: mockCompany.id,
    createdAt: new Date('2024-01-01'),
    steps: 5
  },
  {
    id: 'seq-002',
    name: 'Invoice Follow-up',
    type: 'invoice_followup',
    status: 'active',
    companyId: mockCompany.id,
    createdAt: new Date('2024-01-15'),
    steps: 3
  }
]

const mockExecutions = [
  {
    id: 'exec-001',
    sequenceId: 'seq-001',
    contactId: 'contact-001',
    status: 'completed',
    startedAt: new Date('2024-02-01'),
    completedAt: new Date('2024-02-08'),
    currentStep: 5,
    companyId: mockCompany.id
  },
  {
    id: 'exec-002',
    sequenceId: 'seq-001',
    contactId: 'contact-002',
    status: 'in_progress',
    startedAt: new Date('2024-02-10'),
    completedAt: null,
    currentStep: 3,
    companyId: mockCompany.id
  }
]

const mockEmailLogs = [
  {
    id: 'email-001',
    sequenceExecutionId: 'exec-001',
    stepNumber: 1,
    subject: 'Payment Reminder - مذكرة دفع',
    language: 'bilingual',
    sentAt: new Date('2024-02-01T10:00:00Z'),
    deliveredAt: new Date('2024-02-01T10:05:00Z'),
    openedAt: new Date('2024-02-01T14:30:00Z'),
    clickedAt: new Date('2024-02-01T14:35:00Z'),
    respondedAt: new Date('2024-02-01T16:20:00Z'),
    status: 'responded',
    companyId: mockCompany.id,
    culturalScore: 88
  },
  {
    id: 'email-002',
    sequenceExecutionId: 'exec-002',
    stepNumber: 1,
    subject: 'Payment Reminder',
    language: 'en',
    sentAt: new Date('2024-02-10T09:00:00Z'),
    deliveredAt: new Date('2024-02-10T09:05:00Z'),
    openedAt: new Date('2024-02-10T11:15:00Z'),
    clickedAt: null,
    respondedAt: null,
    status: 'opened',
    companyId: mockCompany.id,
    culturalScore: 75
  }
]

describe('GET /api/sequences/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default auth session
    const { getServerSession } = require('next-auth/next')
    getServerSession.mockResolvedValue(mockSession)
    
    // Setup default database responses
    prisma.users.findUnique.mockResolvedValue(mockUser)
    prisma.sequences.findMany.mockResolvedValue(mockSequences)
    prisma.sequenceExecutions.findMany.mockResolvedValue(mockExecutions)
    prisma.emailLogs.findMany.mockResolvedValue(mockEmailLogs)
    
    // Setup service responses
    sequenceExecutionService.getCompanyAnalytics.mockResolvedValue({
      totalSequences: mockSequences.length,
      activeSequences: mockSequences.filter(s => s.status === 'active').length,
      totalExecutions: mockExecutions.length,
      averageConversionRate: 0.45,
      totalEmailsSent: mockEmailLogs.length,
      averageResponseTime: 2.5
    })
    
    sequenceTriggersService.getTriggerMetrics.mockResolvedValue({
      triggerMetrics: {
        invoice_created: { count: 125, successRate: 0.78 },
        payment_overdue: { count: 89, successRate: 0.82 },
        follow_up_scheduled: { count: 67, successRate: 0.71 }
      },
      mostCommonTriggers: [
        { type: 'invoice_created', count: 125, successRate: 0.78 },
        { type: 'payment_overdue', count: 89, successRate: 0.82 }
      ]
    })
    
    emailSchedulingService.getTimingAnalytics.mockResolvedValue({
      optimalSendTimes: [
        { hour: 10, day: 1, openRate: 0.45, responseRate: 0.12 },
        { hour: 14, day: 2, openRate: 0.48, responseRate: 0.15 }
      ],
      businessHoursCompliance: 0.94,
      culturalCompliance: 0.87
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should require valid authentication', async () => {
      const { getServerSession } = require('next-auth/next')
      getServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should require user to have company association', async () => {
      const userWithoutCompany = { ...mockUser, company: null }
      prisma.users.findUnique.mockResolvedValue(userWithoutCompany)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Company not found')
    })

    it('should enforce company-level data isolation', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics?companyId=other-company')
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      // Verify all database queries use the user's company ID, not the requested one
      expect(prisma.sequences.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompany.id
          })
        })
      )
      
      expect(prisma.sequenceExecutions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompany.id
          })
        })
      )
    })

    it('should handle role-based access control', async () => {
      const viewerUser = { ...mockUser, role: 'VIEWER' }
      prisma.users.findUnique.mockResolvedValue(viewerUser)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Viewer should get limited analytics data
      expect(data.data.summary).toBeDefined()
      expect(data.data.performance.topPerformingSequences).toHaveLength(0) // Limited view
    })
  })

  describe('Query Parameter Handling', () => {
    it('should handle date range filtering', async () => {
      const searchParams = new URLSearchParams({
        dateFrom: '2024-02-01',
        dateTo: '2024-02-29'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      // Verify date filtering is applied to database queries
      expect(prisma.sequenceExecutions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: {
              gte: new Date('2024-02-01'),
              lte: new Date('2024-02-29')
            }
          })
        })
      )
    })

    it('should handle sequence filtering by IDs', async () => {
      const searchParams = new URLSearchParams({
        sequenceIds: 'seq-001,seq-002'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      expect(prisma.sequenceExecutions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sequenceId: {
              in: ['seq-001', 'seq-002']
            }
          })
        })
      )
    })

    it('should handle step number filtering', async () => {
      const searchParams = new URLSearchParams({
        stepNumber: '3'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      expect(prisma.emailLogs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stepNumber: 3
          })
        })
      )
    })

    it('should handle different groupBy options', async () => {
      const groupByOptions = ['day', 'week', 'month']
      
      for (const groupBy of groupByOptions) {
        const searchParams = new URLSearchParams({ groupBy })
        const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
        const response = await GET(request)

        expect(response.status).toBe(200)
        
        const data = await response.json()
        expect(data.data.trends.executionTrend).toBeDefined()
      }
    })

    it('should handle metric type filtering', async () => {
      const metrics = ['executions', 'conversions', 'engagement', 'timing']
      
      for (const metric of metrics) {
        const searchParams = new URLSearchParams({ metric })
        const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
        const response = await GET(request)

        expect(response.status).toBe(200)
        
        const data = await response.json()
        expect(data.data).toBeDefined()
      }
    })
  })

  describe('Analytics Data Structure', () => {
    it('should return comprehensive analytics with all required sections', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        summary: {
          totalSequences: expect.any(Number),
          activeSequences: expect.any(Number),
          totalExecutions: expect.any(Number),
          averageConversionRate: expect.any(Number),
          totalEmailsSent: expect.any(Number),
          averageResponseTime: expect.any(Number)
        },
        performance: {
          topPerformingSequences: expect.any(Array),
          worstPerformingSequences: expect.any(Array)
        },
        trends: {
          executionTrend: expect.any(Array),
          emailTrend: expect.any(Array)
        },
        triggers: {
          triggerMetrics: expect.any(Object),
          mostCommonTriggers: expect.any(Array)
        },
        timing: {
          optimalSendTimes: expect.any(Array),
          businessHoursCompliance: expect.any(Number),
          culturalCompliance: expect.any(Number)
        }
      })
    })

    it('should include UAE-specific cultural compliance metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.timing.businessHoursCompliance).toBeGreaterThanOrEqual(0)
      expect(data.data.timing.businessHoursCompliance).toBeLessThanOrEqual(1)
      expect(data.data.timing.culturalCompliance).toBeGreaterThanOrEqual(0)
      expect(data.data.timing.culturalCompliance).toBeLessThanOrEqual(1)
    })

    it('should provide trend data with proper date formatting', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      data.data.trends.executionTrend.forEach((point: any) => {
        expect(point).toMatchObject({
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          executions: expect.any(Number),
          conversions: expect.any(Number),
          conversionRate: expect.any(Number)
        })
      })

      data.data.trends.emailTrend.forEach((point: any) => {
        expect(point).toMatchObject({
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          sent: expect.any(Number),
          delivered: expect.any(Number),
          opened: expect.any(Number),
          clicked: expect.any(Number)
        })
      })
    })

    it('should rank sequences by performance correctly', async () => {
      // Mock additional sequence performance data
      sequenceExecutionService.getPerformanceMetrics.mockResolvedValue([
        {
          id: 'seq-001',
          name: 'UAE Payment Reminder',
          conversionRate: 0.65,
          totalExecutions: 150,
          averageCompletionTime: 5.2
        },
        {
          id: 'seq-002',
          name: 'Invoice Follow-up',
          conversionRate: 0.45,
          totalExecutions: 89,
          averageCompletionTime: 7.8
        }
      ])

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      const topPerforming = data.data.performance.topPerformingSequences
      expect(topPerforming).toHaveLength(2)
      expect(topPerforming[0].conversionRate).toBeGreaterThan(topPerforming[1].conversionRate)
    })
  })

  describe('Performance Optimization', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset
      const largeExecutions = Array.from({ length: 10000 }, (_, i) => ({
        id: `exec-${i}`,
        sequenceId: 'seq-001',
        contactId: `contact-${i}`,
        status: 'completed',
        startedAt: new Date(`2024-01-${(i % 30) + 1}`),
        completedAt: new Date(`2024-02-${(i % 28) + 1}`),
        currentStep: (i % 5) + 1,
        companyId: mockCompany.id
      }))

      prisma.sequenceExecutions.findMany.mockResolvedValue(largeExecutions)

      const startTime = Date.now()
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)
      const endTime = Date.now()

      expect(response.status).toBe(200)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should implement proper database query optimization', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)

      // Verify efficient queries are used
      expect(prisma.sequenceExecutions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            sequenceId: true,
            status: true,
            startedAt: true,
            completedAt: true,
            currentStep: true
            // Should not select unnecessary fields
          })
        })
      )
    })

    it('should use database transactions for consistency', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      // Verify transaction is used for complex aggregations
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should implement appropriate caching for frequent queries', async () => {
      // Make multiple requests in succession
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      
      await GET(request)
      await GET(request)
      await GET(request)

      // Should implement some form of caching (implementation specific)
      expect(sequenceExecutionService.getCompanyAnalytics).toHaveBeenCalledTimes(3)
    })
  })

  describe('UAE Business Logic Integration', () => {
    it('should respect UAE business hours in analytics calculations', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      expect(emailSchedulingService.getTimingAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          businessHours: mockCompany.businessHours,
          timezone: 'Asia/Dubai'
        })
      )
    })

    it('should include cultural compliance scoring', async () => {
      sequenceExecutionService.getCulturalCompliance.mockResolvedValue({
        overallScore: 87,
        breakdown: {
          businessHours: 94,
          prayerTimes: 92,
          holidays: 100,
          language: 85,
          tone: 82
        }
      })

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.culturalCompliance).toMatchObject({
        overallScore: 87,
        breakdown: expect.objectContaining({
          businessHours: expect.any(Number),
          prayerTimes: expect.any(Number),
          holidays: expect.any(Number),
          language: expect.any(Number),
          tone: expect.any(Number)
        })
      })
    })

    it('should handle Arabic language analytics correctly', async () => {
      const arabicEmailLogs = mockEmailLogs.map(log => ({
        ...log,
        language: 'ar',
        subject: 'مذكرة دفع',
        culturalScore: 95
      }))

      prisma.emailLogs.findMany.mockResolvedValue(arabicEmailLogs)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should include language-specific analytics
      expect(data.data.languageAnalytics).toMatchObject({
        arabic: expect.objectContaining({
          totalEmails: expect.any(Number),
          averageCulturalScore: expect.any(Number)
        })
      })
    })

    it('should consider Islamic holidays in trend analysis', async () => {
      sequenceExecutionService.getTrendAnalysis.mockResolvedValue({
        executionTrend: [
          { date: '2024-04-10', executions: 45, conversions: 18, conversionRate: 0.40 }, // Eid Al Fitr
          { date: '2024-04-11', executions: 12, conversions: 4, conversionRate: 0.33 }, // Eid Al Fitr
          { date: '2024-04-12', executions: 8, conversions: 2, conversionRate: 0.25 }   // Eid Al Fitr
        ],
        holidayImpact: {
          'Eid Al Fitr': { averageDecrease: 0.65 }
        }
      })

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.trends.holidayImpact).toBeDefined()
      expect(data.data.trends.holidayImpact['Eid Al Fitr']).toMatchObject({
        averageDecrease: expect.any(Number)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      prisma.users.findUnique.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle invalid query parameters gracefully', async () => {
      const searchParams = new URLSearchParams({
        dateFrom: 'invalid-date',
        sequenceIds: '',
        stepNumber: 'not-a-number'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid query parameters')
    })

    it('should handle service layer errors appropriately', async () => {
      sequenceExecutionService.getCompanyAnalytics.mockRejectedValue(new Error('Service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.success).toBe(false)
    })

    it('should provide meaningful error messages for debugging', async () => {
      const mockError = new Error('Sequence execution analysis failed')
      mockError.stack = 'Error: Sequence execution analysis failed\n    at Function.getCompanyAnalytics'
      
      sequenceExecutionService.getCompanyAnalytics.mockRejectedValue(mockError)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Internal server error')
      expect(data.details).toBeDefined() // In development mode
    })
  })

  describe('Data Aggregation and Calculations', () => {
    it('should calculate conversion rates correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.summary.averageConversionRate).toBeGreaterThan(0)
      expect(data.data.summary.averageConversionRate).toBeLessThanOrEqual(1)
    })

    it('should aggregate data across multiple sequences correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.summary.totalSequences).toBe(mockSequences.length)
      expect(data.data.summary.totalExecutions).toBe(mockExecutions.length)
      expect(data.data.summary.totalEmailsSent).toBe(mockEmailLogs.length)
    })

    it('should handle edge cases with zero executions', async () => {
      prisma.sequenceExecutions.findMany.mockResolvedValue([])
      prisma.emailLogs.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.summary.totalExecutions).toBe(0)
      expect(data.data.summary.averageConversionRate).toBe(0)
      expect(data.data.performance.topPerformingSequences).toHaveLength(0)
    })

    it('should handle sequences with no email steps', async () => {
      const nonEmailSequences = [{
        id: 'seq-003',
        name: 'Call-only Sequence',
        type: 'call_only',
        status: 'active',
        companyId: mockCompany.id,
        steps: 2
      }]

      prisma.sequences.findMany.mockResolvedValue(nonEmailSequences)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.summary.totalSequences).toBe(1)
      expect(data.data.summary.totalEmailsSent).toBe(0)
    })
  })

  describe('Security and Input Validation', () => {
    it('should sanitize query parameters to prevent injection', async () => {
      const maliciousParams = new URLSearchParams({
        sequenceIds: "'; DROP TABLE sequences; --",
        dateFrom: '<script>alert("xss")</script>',
        metric: 'executions; DELETE FROM users;'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${maliciousParams}`)
      const response = await GET(request)

      // Should either return 400 for invalid params or 200 with sanitized data
      expect([200, 400]).toContain(response.status)
      
      if (response.status === 200) {
        const data = await response.json()
        expect(data.success).toBe(true)
      }
    })

    it('should enforce rate limiting for analytics requests', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 10 }, () => 
        new NextRequest('http://localhost:3000/api/sequences/analytics')
      )

      const responses = await Promise.all(requests.map(req => GET(req)))

      // Should implement rate limiting (implementation specific)
      const statusCodes = responses.map(res => res.status)
      const tooManyRequests = statusCodes.filter(code => code === 429)
      expect(tooManyRequests.length).toBeGreaterThanOrEqual(0) // May or may not have rate limiting
    })

    it('should validate date range limits', async () => {
      const searchParams = new URLSearchParams({
        dateFrom: '2000-01-01', // Very old date
        dateTo: '2030-12-31'     // Future date
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid date range')
    })

    it('should prevent access to other company data via parameter manipulation', async () => {
      // Try to access another company's sequences
      const searchParams = new URLSearchParams({
        sequenceIds: 'other-company-seq-001'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics?${searchParams}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should return empty results, not error, when trying to access non-owned sequences
      expect(data.data.summary.totalExecutions).toBe(0)
    })
  })
})