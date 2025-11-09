/**
 * Comprehensive Test Suite for Individual Sequence Analytics API Endpoint
 * Tests sequence-specific analytics, performance data, and UAE cultural compliance
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals')
const { NextRequest } = require('next/server')
const { GET } = require('../route')
const { prisma } = require('@/lib/prisma')

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    sequences: {
      findUnique: jest.fn(),
    },
    sequenceExecutions: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    emailLogs: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    emailSequenceSteps: {
      findMany: jest.fn(),
    },
    sequenceStepExecutions: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

// Test data
const mockCompany = {
  id: 'company-uae-001',
  name: 'UAE Payment Solutions LLC',
  trn: '123456789012345',
  country: 'AE',
  timezone: 'Asia/Dubai',
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

const mockSequence = {
  id: 'seq-12345',
  name: 'UAE Payment Reminder Sequence',
  type: 'payment_reminder',
  status: 'active',
  companyId: mockCompany.id,
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-02-20T14:45:00Z'),
  description: 'Culturally appropriate payment reminder sequence for UAE customers',
  isActive: true,
  steps: [
    {
      id: 'step-001',
      stepNumber: 1,
      stepType: 'email',
      name: 'Gentle Reminder (Arabic & English)',
      triggerDelay: 0,
      isActive: true,
      culturalSettings: {
        arabicContent: true,
        respectPrayerTimes: true,
        tone: 'respectful'
      }
    },
    {
      id: 'step-002',
      stepNumber: 2,
      stepType: 'email',
      name: 'Professional Follow-up',
      triggerDelay: 3,
      isActive: true,
      culturalSettings: {
        arabicContent: true,
        respectPrayerTimes: true,
        tone: 'professional'
      }
    },
    {
      id: 'step-003',
      stepNumber: 3,
      stepType: 'email',
      name: 'Escalation Notice',
      triggerDelay: 7,
      isActive: true,
      culturalSettings: {
        arabicContent: true,
        respectPrayerTimes: true,
        tone: 'firm'
      }
    },
    {
      id: 'step-004',
      stepNumber: 4,
      stepType: 'call',
      name: 'Personal Call (Arabic)',
      triggerDelay: 14,
      isActive: true,
      culturalSettings: {
        language: 'ar',
        respectBusinessHours: true
      }
    },
    {
      id: 'step-005',
      stepNumber: 5,
      stepType: 'email',
      name: 'Final Legal Notice',
      triggerDelay: 21,
      isActive: true,
      culturalSettings: {
        arabicContent: true,
        respectPrayerTimes: true,
        tone: 'formal'
      }
    }
  ]
}

const mockExecutions = [
  {
    id: 'exec-001',
    sequenceId: 'seq-12345',
    contactId: 'contact-001',
    status: 'completed',
    startedAt: new Date('2024-02-01T10:00:00Z'),
    completedAt: new Date('2024-02-08T16:30:00Z'),
    currentStep: 5,
    companyId: mockCompany.id,
    totalRevenue: 2500.00,
    responseReceived: true,
    responseStep: 3,
    responseTime: 2.5
  },
  {
    id: 'exec-002',
    sequenceId: 'seq-12345',
    contactId: 'contact-002',
    status: 'in_progress',
    startedAt: new Date('2024-02-10T09:00:00Z'),
    completedAt: null,
    currentStep: 3,
    companyId: mockCompany.id,
    totalRevenue: 0,
    responseReceived: false,
    responseStep: null,
    responseTime: null
  },
  {
    id: 'exec-003',
    sequenceId: 'seq-12345',
    contactId: 'contact-003',
    status: 'completed',
    startedAt: new Date('2024-02-05T14:00:00Z'),
    completedAt: new Date('2024-02-12T11:20:00Z'),
    currentStep: 5,
    companyId: mockCompany.id,
    totalRevenue: 1850.00,
    responseReceived: true,
    responseStep: 4,
    responseTime: 4.2
  }
]

const mockStepExecutions = [
  {
    id: 'step-exec-001',
    sequenceExecutionId: 'exec-001',
    stepNumber: 1,
    stepType: 'email',
    executedAt: new Date('2024-02-01T10:00:00Z'),
    status: 'completed',
    emailId: 'email-001',
    culturalScore: 92
  },
  {
    id: 'step-exec-002',
    sequenceExecutionId: 'exec-001',
    stepNumber: 2,
    stepType: 'email',
    executedAt: new Date('2024-02-04T11:00:00Z'),
    status: 'completed',
    emailId: 'email-002',
    culturalScore: 88
  },
  {
    id: 'step-exec-003',
    sequenceExecutionId: 'exec-001',
    stepNumber: 3,
    stepType: 'email',
    executedAt: new Date('2024-02-08T10:30:00Z'),
    status: 'completed',
    emailId: 'email-003',
    culturalScore: 85
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
    culturalScore: 92,
    bounced: false,
    unsubscribed: false
  },
  {
    id: 'email-002',
    sequenceExecutionId: 'exec-001',
    stepNumber: 2,
    subject: 'Follow-up - متابعة',
    language: 'bilingual',
    sentAt: new Date('2024-02-04T11:00:00Z'),
    deliveredAt: new Date('2024-02-04T11:05:00Z'),
    openedAt: new Date('2024-02-04T15:45:00Z'),
    clickedAt: new Date('2024-02-04T15:50:00Z'),
    respondedAt: null,
    status: 'clicked',
    companyId: mockCompany.id,
    culturalScore: 88,
    bounced: false,
    unsubscribed: false
  },
  {
    id: 'email-003',
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
    culturalScore: 75,
    bounced: false,
    unsubscribed: false
  }
]

describe('GET /api/sequences/analytics/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default auth session
    const { getServerSession } = require('next-auth/next')
    getServerSession.mockResolvedValue(mockSession)
    
    // Setup default database responses
    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.sequences.findUnique.mockResolvedValue(mockSequence)
    prisma.sequenceExecutions.findMany.mockResolvedValue(mockExecutions)
    prisma.sequenceStepExecutions.findMany.mockResolvedValue(mockStepExecutions)
    prisma.emailLog.findMany.mockResolvedValue(mockEmailLogs)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should require valid authentication', async () => {
      const { getServerSession } = require('next-auth/next')
      getServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should require user to have company association', async () => {
      const userWithoutCompany = { ...mockUser, company: null }
      prisma.user.findUnique.mockResolvedValue(userWithoutCompany)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Company not found')
    })

    it('should enforce company-level data isolation', async () => {
      const otherCompanySequence = {
        ...mockSequence,
        id: 'other-seq-001',
        companyId: 'other-company-001'
      }
      
      prisma.sequences.findUnique.mockResolvedValue(otherCompanySequence)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/other-seq-001')
      const response = await GET(request, { params: { id: 'other-seq-001' } })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Sequence not found')
    })

    it('should handle non-existent sequence IDs', async () => {
      prisma.sequences.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/non-existent')
      const response = await GET(request, { params: { id: 'non-existent' } })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Sequence not found')
    })
  })

  describe('Sequence Information', () => {
    it('should return comprehensive sequence information', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.sequence).toMatchObject({
        id: 'seq-12345',
        name: 'UAE Payment Reminder Sequence',
        type: 'payment_reminder',
        status: 'active',
        totalSteps: 5,
        avgDuration: expect.any(Number),
        createdAt: expect.any(String),
        lastModified: expect.any(String)
      })
    })

    it('should calculate average duration correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should calculate average duration from completed executions
      const completedExecutions = mockExecutions.filter(exec => exec.status === 'completed')
      const expectedAvgDuration = completedExecutions.reduce((sum, exec) => {
        const duration = (new Date(exec.completedAt!).getTime() - new Date(exec.startedAt).getTime()) / (1000 * 60 * 60 * 24)
        return sum + duration
      }, 0) / completedExecutions.length

      expect(data.data.sequence.avgDuration).toBeCloseTo(expectedAvgDuration, 1)
    })
  })

  describe('Overview Metrics', () => {
    it('should return accurate overview metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.overview).toMatchObject({
        totalContacts: mockExecutions.length,
        completionRate: expect.any(Number),
        averageResponseTime: expect.any(Number),
        totalRevenue: expect.any(Number),
        costPerConversion: expect.any(Number),
        roi: expect.any(Number)
      })

      // Validate calculated metrics
      const completedExecutions = mockExecutions.filter(exec => exec.status === 'completed')
      const expectedCompletionRate = (completedExecutions.length / mockExecutions.length) * 100
      expect(data.data.overview.completionRate).toBeCloseTo(expectedCompletionRate, 1)

      const totalRevenue = mockExecutions.reduce((sum, exec) => sum + exec.totalRevenue, 0)
      expect(data.data.overview.totalRevenue).toBe(totalRevenue)
    })

    it('should handle sequences with no executions', async () => {
      prisma.sequenceExecutions.findMany.mockResolvedValue([])
      prisma.emailLog.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.overview).toMatchObject({
        totalContacts: 0,
        completionRate: 0,
        averageResponseTime: 0,
        totalRevenue: 0,
        costPerConversion: 0,
        roi: 0
      })
    })
  })

  describe('Funnel Analysis', () => {
    it('should generate conversion funnel with correct stage data', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.funnel).toBeInstanceOf(Array)
      expect(data.data.funnel).toHaveLength(6) // Started + 5 steps

      // Check funnel stages structure
      data.data.funnel.forEach((stage: any) => {
        expect(stage).toMatchObject({
          stage: expect.any(String),
          count: expect.any(Number),
          rate: expect.any(Number),
          dropoff: expect.any(Number)
        })
      })

      // First stage should be 'Started' with 100% rate
      expect(data.data.funnel[0].stage).toBe('Started')
      expect(data.data.funnel[0].rate).toBe(100)
      expect(data.data.funnel[0].dropoff).toBe(0)
    })

    it('should calculate dropoff rates correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Dropoff rates should increase or stay same at each stage
      for (let i = 1; i < data.data.funnel.length; i++) {
        expect(data.data.funnel[i].dropoff).toBeGreaterThanOrEqual(data.data.funnel[i - 1].dropoff)
      }
    })
  })

  describe('Step-by-Step Analysis', () => {
    it('should provide detailed step performance metrics', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.steps).toBeInstanceOf(Array)
      expect(data.data.steps).toHaveLength(5) // 5 steps in sequence

      data.data.steps.forEach((step: any) => {
        expect(step).toMatchObject({
          stepNumber: expect.any(Number),
          stepType: expect.stringMatching(/^(email|sms|call|wait)$/),
          name: expect.any(String),
          triggerDelay: expect.any(Number),
          sent: expect.any(Number),
          delivered: expect.any(Number),
          opened: expect.any(Number),
          clicked: expect.any(Number),
          responded: expect.any(Number),
          bounced: expect.any(Number),
          unsubscribed: expect.any(Number),
          effectiveness: expect.any(Number),
          cultureScore: expect.any(Number),
          dropoffRate: expect.any(Number)
        })
      })
    })

    it('should handle different step types appropriately', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      const emailSteps = data.data.steps.filter((step: any) => step.stepType === 'email')
      const callSteps = data.data.steps.filter((step: any) => step.stepType === 'call')

      // Email steps should have email-specific metrics
      emailSteps.forEach((step: any) => {
        expect(step.sent).toBeGreaterThanOrEqual(0)
        expect(step.delivered).toBeGreaterThanOrEqual(0)
        expect(step.opened).toBeGreaterThanOrEqual(0)
        expect(step.clicked).toBeGreaterThanOrEqual(0)
      })

      // Call steps should have different metrics structure
      callSteps.forEach((step: any) => {
        expect(step.sent).toBe(0) // Calls don't have 'sent'
        expect(step.delivered).toBe(0) // Calls don't have 'delivered'
        expect(step.opened).toBe(0) // Calls don't have 'opened'
        expect(step.clicked).toBe(0) // Calls don't have 'clicked'
      })
    })

    it('should calculate step effectiveness correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      data.data.steps.forEach((step: any) => {
        if (step.stepType === 'email' && step.sent > 0) {
          // Effectiveness should be a reasonable percentage
          expect(step.effectiveness).toBeGreaterThanOrEqual(0)
          expect(step.effectiveness).toBeLessThanOrEqual(100)
        }
      })
    })
  })

  describe('UAE Cultural Compliance', () => {
    it('should include cultural scores for each step', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      data.data.steps.forEach((step: any) => {
        expect(step.cultureScore).toBeGreaterThanOrEqual(0)
        expect(step.cultureScore).toBeLessThanOrEqual(100)
      })
    })

    it('should provide overall cultural compliance assessment', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.culturalCompliance).toMatchObject({
        overallScore: expect.any(Number),
        breakdown: expect.objectContaining({
          businessHours: expect.any(Number),
          prayerTimes: expect.any(Number),
          holidays: expect.any(Number),
          language: expect.any(Number),
          tone: expect.any(Number)
        }),
        violations: expect.any(Array),
        improvements: expect.any(Array)
      })
    })

    it('should identify cultural violations and improvements', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      if (data.data.culturalCompliance.violations.length > 0) {
        data.data.culturalCompliance.violations.forEach((violation: any) => {
          expect(violation).toMatchObject({
            type: expect.any(String),
            description: expect.any(String),
            severity: expect.stringMatching(/^(high|medium|low)$/),
            recommendation: expect.any(String)
          })
        })
      }

      if (data.data.culturalCompliance.improvements.length > 0) {
        data.data.culturalCompliance.improvements.forEach((improvement: any) => {
          expect(improvement).toMatchObject({
            area: expect.any(String),
            currentScore: expect.any(Number),
            potentialScore: expect.any(Number),
            actions: expect.any(Array)
          })
        })
      }
    })
  })

  describe('Timing Analysis', () => {
    it('should provide timing performance data', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.timingAnalysis).toBeInstanceOf(Array)
      
      data.data.timingAnalysis.forEach((point: any) => {
        expect(point).toMatchObject({
          day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          startedContacts: expect.any(Number),
          completedContacts: expect.any(Number),
          responseRate: expect.any(Number),
          cultureCompliance: expect.any(Number)
        })
      })
    })

    it('should respect UAE business hours in analysis', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      // Should include business hours compliance metrics
      expect(data.data.businessHoursAnalysis).toMatchObject({
        compliance: expect.any(Number),
        violations: expect.any(Array),
        recommendations: expect.any(Array)
      })
    })
  })

  describe('Performance Recommendations', () => {
    it('should generate actionable performance recommendations', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.data.recommendations).toBeInstanceOf(Array)
      
      data.data.recommendations.forEach((recommendation: any) => {
        expect(recommendation).toMatchObject({
          type: expect.stringMatching(/^(optimization|cultural|timing|content)$/),
          priority: expect.stringMatching(/^(high|medium|low)$/),
          title: expect.any(String),
          description: expect.any(String),
          expectedImprovement: expect.any(String)
        })
      })
    })

    it('should prioritize recommendations correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      // High priority recommendations should come first
      let lastPriorityValue = 3 // high = 3, medium = 2, low = 1
      data.data.recommendations.forEach((recommendation: any) => {
        const priorityValue = { high: 3, medium: 2, low: 1 }[recommendation.priority]
        expect(priorityValue).toBeLessThanOrEqual(lastPriorityValue)
        lastPriorityValue = priorityValue
      })
    })

    it('should include UAE-specific recommendations', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      const culturalRecommendations = data.data.recommendations.filter((rec: any) => rec.type === 'cultural')
      expect(culturalRecommendations.length).toBeGreaterThan(0)

      const timingRecommendations = data.data.recommendations.filter((rec: any) => rec.type === 'timing')
      expect(timingRecommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Query Parameters and Filtering', () => {
    it('should handle date range filtering', async () => {
      const searchParams = new URLSearchParams({
        dateFrom: '2024-02-01',
        dateTo: '2024-02-15'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics/seq-12345?${searchParams}`)
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      
      // Verify date filtering is applied
      expect(prisma.sequenceExecutions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: {
              gte: new Date('2024-02-01'),
              lte: new Date('2024-02-15')
            }
          })
        })
      )
    })

    it('should handle step number filtering', async () => {
      const searchParams = new URLSearchParams({
        stepNumber: '2'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics/seq-12345?${searchParams}`)
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      // Should focus analysis on specific step
      expect(data.data.stepFocus).toBe(2)
    })

    it('should handle groupBy parameter for trend analysis', async () => {
      const searchParams = new URLSearchParams({
        groupBy: 'week'
      })
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics/seq-12345?${searchParams}`)
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      // Should group timing analysis by week
      expect(data.data.timingAnalysis.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.sequenceExecutions.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.success).toBe(false)
    })

    it('should handle invalid sequence ID format', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/invalid-id-format')
      const response = await GET(request, { params: { id: 'invalid-id-format' } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid sequence ID format')
    })

    it('should handle sequences with corrupted data', async () => {
      const corruptedSequence = {
        ...mockSequence,
        steps: null // Corrupted steps data
      }
      
      prisma.sequences.findUnique.mockResolvedValue(corruptedSequence)

      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Sequence data corrupted')
    })
  })

  describe('Performance Optimization', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset
      const largeExecutions = Array.from({ length: 5000 }, (_, i) => ({
        id: `exec-${i}`,
        sequenceId: 'seq-12345',
        contactId: `contact-${i}`,
        status: i % 3 === 0 ? 'completed' : 'in_progress',
        startedAt: new Date(`2024-01-${(i % 30) + 1}`),
        completedAt: i % 3 === 0 ? new Date(`2024-02-${(i % 28) + 1}`) : null,
        currentStep: (i % 5) + 1,
        companyId: mockCompany.id,
        totalRevenue: i % 3 === 0 ? Math.random() * 1000 : 0,
        responseReceived: i % 4 === 0,
        responseStep: i % 4 === 0 ? (i % 5) + 1 : null,
        responseTime: i % 4 === 0 ? Math.random() * 10 : null
      }))

      prisma.sequenceExecutions.findMany.mockResolvedValue(largeExecutions)

      const startTime = Date.now()
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })
      const endTime = Date.now()

      expect(response.status).toBe(200)
      expect(endTime - startTime).toBeLessThan(3000) // Should complete within 3 seconds
    })

    it('should use database transactions for data consistency', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should implement efficient aggregation queries', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      
      // Should use aggregate functions instead of loading all data
      expect(prisma.sequenceExecutions.aggregate).toHaveBeenCalled()
    })
  })

  describe('Security Validation', () => {
    it('should sanitize sequence ID parameter', async () => {
      const maliciousId = "seq-123'; DROP TABLE sequences; --"
      
      const request = new NextRequest(`http://localhost:3000/api/sequences/analytics/${encodeURIComponent(maliciousId)}`)
      const response = await GET(request, { params: { id: maliciousId } })

      // Should either return 400 for invalid ID or handle safely
      expect([400, 404]).toContain(response.status)
    })

    it('should validate company ownership consistently', async () => {
      const request = new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      const response = await GET(request, { params: { id: 'seq-12345' } })

      expect(response.status).toBe(200)
      
      // All database queries should include company filter
      expect(prisma.sequences.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'seq-12345',
            companyId: mockCompany.id
          })
        })
      )
    })

    it('should handle concurrent requests safely', async () => {
      const requests = Array.from({ length: 5 }, () => 
        new NextRequest('http://localhost:3000/api/sequences/analytics/seq-12345')
      )

      const responses = await Promise.all(
        requests.map(req => GET(req, { params: { id: 'seq-12345' } }))
      )

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })
})