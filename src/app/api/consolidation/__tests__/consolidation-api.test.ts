/**
 * Integration tests for Consolidation API endpoints
 * Tests the complete API functionality including authentication, validation, and business logic
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { GET as getCandidates } from '../candidates/route'
import { POST as sendConsolidation } from '../send/route'
import { GET as getMetrics } from '../metrics/route'
import { GET as getDashboard } from '../dashboard/route'
import { GET as getConsolidation, PUT as updateConsolidation, DELETE as deleteConsolidation } from '../[id]/route'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/services/customer-consolidation-service', () => ({
  customerConsolidationService: {
    getConsolidationCandidates: jest.fn(),
    createConsolidatedReminder: jest.fn(),
    getConsolidationMetrics: jest.fn()
  }
}))

jest.mock('@/lib/services/sequence-execution-service', () => ({
  sequenceExecutionService: {
    startConsolidatedSequenceExecution: jest.fn()
  }
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    customerConsolidatedReminders: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    followUpSequences: {
      findFirst: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    invoices: {
      findMany: jest.fn(),
    },
    activities: {
      create: jest.fn(),
    },
    emailTemplates: {
      findFirst: jest.fn(),
    },
    emailLogs: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  }
}))

import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { prisma } from '@/lib/prisma'

describe('Consolidation API Endpoints', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      companyId: 'comp-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
  })

  describe('GET /api/consolidation/candidates', () => {
    it('should return consolidation candidates', async () => {
      const mockCandidates = [
        {
          customerId: 'cust-1',
          customerName: 'Test Customer',
          customerEmail: 'customer@example.com',
          totalAmount: 5000,
          currency: 'AED',
          overdueInvoices: [
            { id: 'inv-1', number: 'INV-001', amount: 2000 },
            { id: 'inv-2', number: 'INV-002', amount: 3000 }
          ],
          priorityScore: 75,
          escalationLevel: 'FIRM',
          canContact: true,
          consolidationReason: 'Multiple overdue invoices',
          customerPreferences: {
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        }
      ]

      ;(customerConsolidationService.getConsolidationCandidates as jest.Mock)
        .mockResolvedValue(mockCandidates)

      const request = new NextRequest('http://localhost:3000/api/consolidation/candidates')
      const response = await getCandidates(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0]).toMatchObject({
        customerId: 'cust-1',
        customerName: 'Test Customer',
        totalAmount: 5000,
        canContact: true
      })
      expect(data.summary).toMatchObject({
        totalCustomers: 1,
        eligibleCustomers: 1,
        totalOutstanding: 5000,
        emailsSaved: 1 // 2 invoices - 1 = 1 email saved
      })
    })

    it('should apply filters correctly', async () => {
      const mockCandidates = [
        {
          customerId: 'cust-1',
          customerName: 'High Priority Customer',
          customerEmail: 'high@example.com',
          totalAmount: 10000,
          priorityScore: 85,
          escalationLevel: 'URGENT',
          canContact: true,
          overdueInvoices: [{ id: 'inv-1' }, { id: 'inv-2' }],
          customerPreferences: { consolidationPreference: 'ENABLED', preferredContactInterval: 7 }
        },
        {
          customerId: 'cust-2',
          customerName: 'Low Priority Customer',
          customerEmail: 'low@example.com',
          totalAmount: 1000,
          priorityScore: 25,
          escalationLevel: 'POLITE',
          canContact: false,
          overdueInvoices: [{ id: 'inv-3' }, { id: 'inv-4' }],
          customerPreferences: { consolidationPreference: 'ENABLED', preferredContactInterval: 7 }
        }
      ]

      ;(customerConsolidationService.getConsolidationCandidates as jest.Mock)
        .mockResolvedValue(mockCandidates)

      // Test priority filter
      const request = new NextRequest('http://localhost:3000/api/consolidation/candidates?priority=high&contactEligibility=eligible')
      const response = await getCandidates(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(1) // Should filter to only high priority, eligible customer
      expect(data.data[0].customerName).toBe('High Priority Customer')
    })

    it('should return 401 for unauthenticated requests', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/consolidation/candidates')
      const response = await getCandidates(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle service errors gracefully', async () => {
      ;(customerConsolidationService.getConsolidationCandidates as jest.Mock)
        .mockRejectedValue(new Error('Service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/consolidation/candidates')
      const response = await getCandidates(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to retrieve consolidation candidates')
      expect(data.code).toBe('CANDIDATES_RETRIEVAL_FAILED')
    })
  })

  describe('POST /api/consolidation/send', () => {
    it('should send consolidations successfully', async () => {
      const mockCandidate = {
        customerId: 'cust-1',
        customerName: 'Test Customer',
        overdueInvoices: [{ id: 'inv-1' }, { id: 'inv-2' }],
        canContact: true,
        escalationLevel: 'FIRM'
      }

      const mockConsolidation = {
        id: 'cons-123',
        customerId: 'cust-1',
        scheduledFor: new Date()
      }

      const mockSequence = {
        id: 'seq-123',
        active: true
      }

      const mockExecutionResult = {
        success: true,
        emailLogIds: ['email-123'],
        errors: []
      }

      ;(customerConsolidationService.getConsolidationCandidates as jest.Mock)
        .mockResolvedValue([mockCandidate])
      ;(customerConsolidationService.createConsolidatedReminder as jest.Mock)
        .mockResolvedValue(mockConsolidation)
      ;(prisma.follow_up_sequencess.findFirst as jest.Mock)
        .mockResolvedValue(mockSequence)
      ;(sequenceExecutionService.startConsolidatedSequenceExecution as jest.Mock)
        .mockResolvedValue(mockExecutionResult)
      ;(prisma.customerConsolidatedReminder.update as jest.Mock)
        .mockResolvedValue(mockConsolidation)
      ;(prisma.activity.create as jest.Mock)
        .mockResolvedValue({})

      const requestBody = {
        customerIds: ['cust-1'],
        escalationLevelOverride: 'URGENT'
      }

      const request = new NextRequest('http://localhost:3000/api/consolidation/send', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await sendConsolidation(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.total).toBe(1)
      expect(data.data.successful).toBe(1)
      expect(data.data.failed).toBe(0)
      expect(data.data.results[0]).toMatchObject({
        customerId: 'cust-1',
        success: true,
        consolidationId: 'cons-123'
      })
    })

    it('should validate request body', async () => {
      const requestBody = {
        customerIds: [] // Empty array
      }

      const request = new NextRequest('http://localhost:3000/api/consolidation/send', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await sendConsolidation(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Customer IDs array is required and cannot be empty')
      expect(data.code).toBe('INVALID_REQUEST')
    })

    it('should limit batch size', async () => {
      const requestBody = {
        customerIds: Array.from({ length: 101 }, (_, i) => `cust-${i}`) // 101 customers
      }

      const request = new NextRequest('http://localhost:3000/api/consolidation/send', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await sendConsolidation(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Maximum 100 customers can be processed at once')
      expect(data.code).toBe('TOO_MANY_CUSTOMERS')
    })

    it('should handle customer not found', async () => {
      ;(customerConsolidationService.getConsolidationCandidates as jest.Mock)
        .mockResolvedValue([]) // No candidates found

      const requestBody = {
        customerIds: ['cust-nonexistent']
      }

      const request = new NextRequest('http://localhost:3000/api/consolidation/send', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await sendConsolidation(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results[0]).toMatchObject({
        customerId: 'cust-nonexistent',
        success: false,
        error: 'Customer not found or not eligible for consolidation'
      })
    })
  })

  describe('GET /api/consolidation/metrics', () => {
    it('should return consolidation metrics', async () => {
      const mockMetrics = {
        totalCandidates: 10,
        eligibleForConsolidation: 8,
        consolidationRate: 75,
        emailsSaved: 25,
        averageInvoicesPerConsolidation: 2.5,
        priorityDistribution: { high: 3, medium: 5, low: 2 },
        effectivenessMetrics: {
          openRate: 65,
          clickRate: 25,
          responseRate: 15,
          paymentRate: 45
        },
        volumeReduction: {
          emailsSaved: 25,
          percentageReduction: 62.5,
          periodComparison: { individual: 40, consolidated: 15 }
        }
      }

      const mockDetectionStats = {
        effectiveness: { openRate: 65, clickRate: 25, responseRate: 15 },
        emailsSaved: 25,
        totalInvoicesConsolidated: 40,
        consolidationsCreated: 15
      }

      ;(customerConsolidationService.getConsolidationMetrics as jest.Mock)
        .mockResolvedValue(mockMetrics)

      // Mock the followUpDetectionService call indirectly through metrics calculation
      jest.doMock('@/lib/services/follow-up-detection-service', () => ({
        followUpDetectionService: {
          getConsolidationStatistics: jest.fn().mockResolvedValue(mockDetectionStats)
        }
      }))

      const request = new NextRequest('http://localhost:3000/api/consolidation/metrics?period=month')
      const response = await getMetrics(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        totalCandidates: 10,
        consolidationRate: 75,
        emailsSaved: 25
      })
      expect(data.additional.period.label).toBe('month')
      expect(data.additional.recommendations).toBeDefined()
    })

    it('should handle custom date ranges', async () => {
      const mockMetrics = {
        totalCandidates: 5,
        eligibleForConsolidation: 4,
        consolidationRate: 80,
        emailsSaved: 12,
        averageInvoicesPerConsolidation: 3,
        priorityDistribution: {},
        effectivenessMetrics: { openRate: 70, clickRate: 30, responseRate: 20, paymentRate: 50 },
        volumeReduction: { emailsSaved: 12, percentageReduction: 60, periodComparison: { individual: 20, consolidated: 8 } }
      }

      ;(customerConsolidationService.getConsolidationMetrics as jest.Mock)
        .mockResolvedValue(mockMetrics)

      const fromDate = '2024-01-01'
      const toDate = '2024-01-31'
      const request = new NextRequest(`http://localhost:3000/api/consolidation/metrics?from=${fromDate}&to=${toDate}`)
      const response = await getMetrics(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.additional.period.from).toBe(new Date(fromDate).toISOString())
      expect(data.additional.period.to).toBe(new Date(toDate).toISOString())
    })
  })

  describe('GET /api/consolidation/[id]', () => {
    it('should return specific consolidation details', async () => {
      const mockConsolidation = {
        id: 'cons-123',
        customerId: 'cust-1',
        companyId: 'comp-123',
        invoiceIds: ['inv-1', 'inv-2'],
        totalAmount: 5000,
        currency: 'AED',
        invoiceCount: 2,
        deliveryStatus: 'SENT',
        customer: { id: 'cust-1', name: 'Test Customer', email: 'test@example.com' },
        company: { id: 'comp-123', name: 'Test Company' },
        emailLogs: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const mockInvoices = [
        { id: 'inv-1', number: 'INV-001', amount: 2000, dueDate: new Date('2024-01-01') },
        { id: 'inv-2', number: 'INV-002', amount: 3000, dueDate: new Date('2024-01-15') }
      ]

      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(mockConsolidation)
      ;(prisma.invoice.findMany as jest.Mock)
        .mockResolvedValue(mockInvoices)

      const response = await getConsolidation(
        new NextRequest('http://localhost:3000/api/consolidation/cons-123'),
        { params: { id: 'cons-123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('cons-123')
      expect(data.data.invoices).toHaveLength(2)
      expect(data.data.calculated.emailsSaved).toBe(1) // 2 invoices - 1
    })

    it('should return 404 for non-existent consolidation', async () => {
      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(null)

      const response = await getConsolidation(
        new NextRequest('http://localhost:3000/api/consolidation/nonexistent'),
        { params: { id: 'nonexistent' } }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Consolidation not found')
      expect(data.code).toBe('CONSOLIDATION_NOT_FOUND')
    })
  })

  describe('PUT /api/consolidation/[id]', () => {
    it('should update consolidation successfully', async () => {
      const mockExistingConsolidation = {
        id: 'cons-123',
        companyId: 'comp-123',
        sentAt: null, // Not sent yet
        scheduledFor: new Date(),
        escalationLevel: 'FIRM'
      }

      const mockUpdatedConsolidation = {
        ...mockExistingConsolidation,
        escalationLevel: 'URGENT',
        updatedAt: new Date(),
        customer: { id: 'cust-1', name: 'Test Customer', email: 'test@example.com' }
      }

      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(mockExistingConsolidation)
      ;(prisma.customerConsolidatedReminder.update as jest.Mock)
        .mockResolvedValue(mockUpdatedConsolidation)
      ;(prisma.activity.create as jest.Mock)
        .mockResolvedValue({})

      const updateData = {
        escalationLevel: 'URGENT',
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
      }

      const request = new NextRequest('http://localhost:3000/api/consolidation/cons-123', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await updateConsolidation(
        request,
        { params: { id: 'cons-123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.escalationLevel).toBe('URGENT')
    })

    it('should prevent updates to already sent consolidations', async () => {
      const mockSentConsolidation = {
        id: 'cons-123',
        companyId: 'comp-123',
        sentAt: new Date(), // Already sent
        scheduledFor: new Date()
      }

      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(mockSentConsolidation)

      const updateData = {
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }

      const request = new NextRequest('http://localhost:3000/api/consolidation/cons-123', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await updateConsolidation(
        request,
        { params: { id: 'cons-123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Cannot reschedule consolidation that has already been sent')
      expect(data.code).toBe('ALREADY_SENT')
    })
  })

  describe('DELETE /api/consolidation/[id]', () => {
    it('should delete consolidation successfully', async () => {
      const mockConsolidation = {
        id: 'cons-123',
        companyId: 'comp-123',
        sentAt: null, // Not sent yet
        customer: { id: 'cust-1', name: 'Test Customer', email: 'test@example.com' },
        invoiceCount: 2,
        totalAmount: 5000
      }

      const mockScheduledEmails = [
        { id: 'email-1', deliveryStatus: 'QUEUED' }
      ]

      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(mockConsolidation)
      ;(prisma.emailLog.findMany as jest.Mock)
        .mockResolvedValue(mockScheduledEmails)
      ;(prisma.emailLog.update as jest.Mock)
        .mockResolvedValue({})
      ;(prisma.customerConsolidatedReminder.delete as jest.Mock)
        .mockResolvedValue(mockConsolidation)
      ;(prisma.activity.create as jest.Mock)
        .mockResolvedValue({})

      const response = await deleteConsolidation(
        new NextRequest('http://localhost:3000/api/consolidation/cons-123', { method: 'DELETE' }),
        { params: { id: 'cons-123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
      expect(data.data.emailsCancelled).toBe(1)
    })

    it('should prevent deletion of already sent consolidations', async () => {
      const mockSentConsolidation = {
        id: 'cons-123',
        companyId: 'comp-123',
        sentAt: new Date(), // Already sent
        customer: { id: 'cust-1', name: 'Test Customer', email: 'test@example.com' }
      }

      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(mockSentConsolidation)

      const response = await deleteConsolidation(
        new NextRequest('http://localhost:3000/api/consolidation/cons-123', { method: 'DELETE' }),
        { params: { id: 'cons-123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Cannot delete consolidation that has already been sent')
      expect(data.code).toBe('ALREADY_SENT')
    })
  })

  describe('Company Data Isolation', () => {
    it('should enforce company data isolation across all endpoints', async () => {
      const otherCompanySession = {
        user: {
          id: 'user-456',
          companyId: 'comp-456', // Different company
          email: 'other@example.com',
          name: 'Other User'
        }
      }

      ;(getServerSession as jest.Mock).mockResolvedValue(otherCompanySession)
      ;(prisma.customerConsolidatedReminder.findFirst as jest.Mock)
        .mockResolvedValue(null) // Should not find consolidation from different company

      const response = await getConsolidation(
        new NextRequest('http://localhost:3000/api/consolidation/cons-123'),
        { params: { id: 'cons-123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Consolidation not found')

      // Verify the query included company isolation
      expect(prisma.customerConsolidatedReminder.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'cons-123',
          companyId: 'comp-456' // Should filter by the requesting user's company
        },
        include: expect.any(Object)
      })
    })
  })
})