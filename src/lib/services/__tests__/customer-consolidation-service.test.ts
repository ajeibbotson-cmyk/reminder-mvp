/**
 * Unit tests for CustomerConsolidationService
 * Tests the core consolidation logic, business rules, and UAE compliance
 */

import { CustomerConsolidationService } from '../customer-consolidation-service'
import type { ConsolidationCandidate } from '../../types/consolidation'
import { ConsolidationError, ContactIntervalError, InsufficientInvoicesError } from '../../types/consolidation'

// Mock Prisma client
const mockPrisma = {
  companies: {
    findMany: jest.fn(),
  },
  customers: {
    findUnique: jest.fn(),
  },
  invoices: {
    findMany: jest.fn(),
  },
  customerConsolidatedReminders: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  followUpLogs: {
    findFirst: jest.fn(),
  },
  payments: {
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
  },
}

// Mock the prisma import
jest.mock('../../prisma', () => ({
  prisma: mockPrisma
}))

describe('CustomerConsolidationService', () => {
  let service: CustomerConsolidationService
  const mockCompanyId = 'comp-123'
  const mockCustomerId = 'cust-456'

  beforeEach(() => {
    service = new CustomerConsolidationService()
    jest.clearAllMocks()
  })

  describe('getConsolidationCandidates', () => {
    it('should return empty array when no overdue invoices exist', async () => {
      mockPrisma.invoices.findMany.mockResolvedValue([])

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toEqual([])
      expect(mockPrisma.invoices.findMany).toHaveBeenCalledWith({
        where: {
          companyId: mockCompanyId,
          status: { in: ['OVERDUE', 'SENT'] },
          isActive: true,
          dueDate: { lt: expect.any(Date) },
          customers: {
            isActive: true,
            consolidationPreference: { not: 'DISABLED' }
          }
        },
        include: {
          customers: {
            select: {
              id: true,
              name: true,
              email: true,
              businessName: true,
              businessType: true,
              consolidationPreference: true,
              maxConsolidationAmount: true,
              preferredContactInterval: true,
              preferredLanguage: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      })
    })

    it('should filter customers with insufficient invoices for consolidation', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          number: 'INV-001',
          totalAmount: 1000,
          currency: 'AED',
          dueDate: new Date('2024-01-01'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-01'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            businessName: 'Test Corp',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        }
      ]

      mockPrisma.invoices.findMany.mockResolvedValue(mockInvoices)

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toEqual([]) // Should be empty due to insufficient invoices (< 2)
    })

    it('should create candidates for customers with multiple overdue invoices', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          number: 'INV-001',
          totalAmount: 1000,
          currency: 'AED',
          dueDate: new Date('2024-01-01'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-01'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          description: 'Invoice 1',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            businessName: 'Test Corp',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        },
        {
          id: 'inv-2',
          number: 'INV-002',
          totalAmount: 2000,
          currency: 'AED',
          dueDate: new Date('2024-01-15'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-15'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          description: 'Invoice 2',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            businessName: 'Test Corp',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        }
      ]

      mockPrisma.invoices.findMany.mockResolvedValue(mockInvoices)
      mockPrisma.customerConsolidatedReminders.findFirst.mockResolvedValue(null) // No last contact
      mockPrisma.followUpLogs.findFirst.mockResolvedValue(null) // No last contact

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toHaveLength(1)
      expect(candidates[0]).toMatchObject({
        customerId: mockCustomerId,
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        companyName: 'Test Corp',
        totalAmount: 3000,
        currency: 'AED',
        overdueInvoices: expect.arrayContaining([
          expect.objectContaining({
            id: 'inv-1',
            number: 'INV-001',
            amount: 1000
          }),
          expect.objectContaining({
            id: 'inv-2',
            number: 'INV-002',
            amount: 2000
          })
        ]),
        canContact: true,
        escalationLevel: expect.stringMatching(/POLITE|FIRM|URGENT|FINAL/),
        customerPreferences: {
          consolidationPreference: 'ENABLED',
          preferredContactInterval: 7
        }
      })
    })

    it('should respect customer max consolidation amount limit', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          number: 'INV-001',
          totalAmount: 10000, // High amount
          currency: 'AED',
          dueDate: new Date('2024-01-01'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-01'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            consolidationPreference: 'ENABLED',
            maxConsolidationAmount: 5000, // Limit set to 5000
            preferredContactInterval: 7
          }
        },
        {
          id: 'inv-2',
          number: 'INV-002',
          totalAmount: 5000,
          currency: 'AED',
          dueDate: new Date('2024-01-15'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-15'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            consolidationPreference: 'ENABLED',
            maxConsolidationAmount: 5000,
            preferredContactInterval: 7
          }
        }
      ]

      mockPrisma.invoices.findMany.mockResolvedValue(mockInvoices)

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toEqual([]) // Should be empty due to total amount (15000) exceeding limit (5000)
    })

    it('should exclude customers with consolidation disabled', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          number: 'INV-001',
          totalAmount: 1000,
          currency: 'AED',
          dueDate: new Date('2024-01-01'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-01'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            consolidationPreference: 'DISABLED', // Disabled
            preferredContactInterval: 7
          }
        },
        {
          id: 'inv-2',
          number: 'INV-002',
          totalAmount: 2000,
          currency: 'AED',
          dueDate: new Date('2024-01-15'),
          status: 'OVERDUE',
          createdAt: new Date('2024-01-15'),
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customers: {
            id: mockCustomerId,
            name: 'Test Customer',
            email: 'test@example.com',
            consolidationPreference: 'DISABLED',
            preferredContactInterval: 7
          }
        }
      ]

      mockPrisma.invoices.findMany.mockResolvedValue([]) // Should be filtered out at query level

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toEqual([])
    })
  })

  describe('canContactCustomer', () => {
    it('should return true for customers never contacted before', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: mockCustomerId,
        consolidationPreference: 'ENABLED',
        preferredContactInterval: 7
      })
      mockPrisma.customerConsolidatedReminders.findFirst.mockResolvedValue(null)
      mockPrisma.followUpLogs.findFirst.mockResolvedValue(null)

      const canContact = await service.canContactCustomer(mockCustomerId)

      expect(canContact).toBe(true)
    })

    it('should return false for customers with consolidation disabled', async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: mockCustomerId,
        consolidationPreference: 'DISABLED',
        preferredContactInterval: 7
      })

      const canContact = await service.canContactCustomer(mockCustomerId)

      expect(canContact).toBe(false)
    })

    it('should respect customer contact interval preferences', async () => {
      const recentContactDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago

      mockPrisma.customers.findUnique.mockResolvedValue({
        id: mockCustomerId,
        consolidationPreference: 'ENABLED',
        preferredContactInterval: 7 // 7 days required
      })
      mockPrisma.customerConsolidatedReminders.findFirst.mockResolvedValue({
        sentAt: recentContactDate
      })

      const canContact = await service.canContactCustomer(mockCustomerId)

      expect(canContact).toBe(false) // Only 3 days passed, 7 required
    })

    it('should allow contact after interval has passed', async () => {
      const oldContactDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago

      mockPrisma.customers.findUnique.mockResolvedValue({
        id: mockCustomerId,
        consolidationPreference: 'ENABLED',
        preferredContactInterval: 7
      })
      mockPrisma.customerConsolidatedReminders.findFirst.mockResolvedValue({
        sentAt: oldContactDate
      })
      mockPrisma.followUpLogs.findFirst.mockResolvedValue(null)

      const canContact = await service.canContactCustomer(mockCustomerId)

      expect(canContact).toBe(true) // 8 days passed, 7 required
    })
  })

  describe('createConsolidatedReminder', () => {
    const mockCandidate: ConsolidationCandidate = {
      customerId: mockCustomerId,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      companyName: 'Test Corp',
      overdueInvoices: [
        {
          id: 'inv-1',
          number: 'INV-001',
          amount: 1000,
          currency: 'AED',
          issueDate: new Date('2024-01-01'),
          dueDate: new Date('2024-01-01'),
          daysOverdue: 30,
          description: 'Invoice 1',
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          status: 'OVERDUE'
        },
        {
          id: 'inv-2',
          number: 'INV-002',
          amount: 2000,
          currency: 'AED',
          issueDate: new Date('2024-01-15'),
          dueDate: new Date('2024-01-15'),
          daysOverdue: 15,
          description: 'Invoice 2',
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          status: 'OVERDUE'
        }
      ],
      totalAmount: 3000,
      currency: 'AED',
      oldestInvoiceDays: 30,
      lastContactDate: undefined,
      nextEligibleContact: new Date(),
      priorityScore: 75,
      escalationLevel: 'FIRM',
      canContact: true,
      consolidationReason: 'Multiple overdue invoices',
      customerPreferences: {
        consolidationPreference: 'ENABLED',
        preferredContactInterval: 7
      }
    }

    it('should create consolidated reminder successfully', async () => {
      const mockTemplate = {
        id: 'template-123',
        templateType: 'CONSOLIDATED_REMINDER',
        supportsConsolidation: true
      }

      const mockConsolidation = {
        id: 'cons-789',
        customerId: mockCustomerId,
        companyId: mockCompanyId,
        invoiceIds: ['inv-1', 'inv-2'],
        totalAmount: 3000,
        currency: 'AED',
        invoiceCount: 2,
        reminderType: 'CONSOLIDATED',
        escalationLevel: 'FIRM',
        templateId: 'template-123',
        deliveryStatus: 'QUEUED',
        priorityScore: 75,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock template selection
      mockPrisma.emailTemplates.findFirst.mockResolvedValue(mockTemplate)

      // Mock consolidation creation
      mockPrisma.customerConsolidatedReminders.create.mockResolvedValue(mockConsolidation)

      // Mock activity logging
      mockPrisma.activities.create.mockResolvedValue({})

      // Mock company lookup
      mockPrisma.customers.findUnique.mockResolvedValue({
        companyId: mockCompanyId
      })

      const result = await service.createConsolidatedReminder(mockCandidate)

      expect(result).toMatchObject({
        id: 'cons-789',
        customerId: mockCustomerId,
        totalAmount: 3000,
        invoiceCount: 2,
        escalationLevel: 'FIRM'
      })

      expect(mockPrisma.customerConsolidatedReminders.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: mockCustomerId,
          invoiceIds: ['inv-1', 'inv-2'],
          totalAmount: 3000,
          currency: 'AED',
          invoiceCount: 2,
          reminderType: 'CONSOLIDATED',
          escalationLevel: 'FIRM',
          deliveryStatus: 'QUEUED'
        })
      })
    })

    it('should throw error for insufficient invoices', async () => {
      const candidateWithOneInvoice = {
        ...mockCandidate,
        overdueInvoices: [mockCandidate.overdueInvoices[0]], // Only one invoice
        totalAmount: 1000,
        invoiceCount: 1
      }

      await expect(service.createConsolidatedReminder(candidateWithOneInvoice))
        .rejects
        .toThrow(InsufficientInvoicesError)
    })

    it('should throw error when customer cannot be contacted', async () => {
      const candidateCannotContact = {
        ...mockCandidate,
        canContact: false,
        nextEligibleContact: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      }

      await expect(service.createConsolidatedReminder(candidateCannotContact))
        .rejects
        .toThrow(ContactIntervalError)
    })

    it('should throw error when no consolidation template found', async () => {
      mockPrisma.emailTemplates.findFirst.mockResolvedValue(null) // No template found
      mockPrisma.customers.findUnique.mockResolvedValue({
        companyId: mockCompanyId
      })

      await expect(service.createConsolidatedReminder(mockCandidate))
        .rejects
        .toThrow(ConsolidationError)
    })
  })

  describe('getConsolidationMetrics', () => {
    it('should calculate metrics correctly', async () => {
      const mockConsolidations = [
        {
          id: 'cons-1',
          invoiceCount: 3,
          companyId: mockCompanyId,
          customerId: 'cust-1',
          customer: { name: 'Customer 1' }
        },
        {
          id: 'cons-2',
          invoiceCount: 2,
          companyId: mockCompanyId,
          customerId: 'cust-2',
          customer: { name: 'Customer 2' }
        }
      ]

      const mockEmailLogs = [
        { sentAt: new Date(), openedAt: new Date() },
        { sentAt: new Date(), openedAt: null }
      ]

      mockPrisma.customerConsolidatedReminders.findMany.mockResolvedValue(mockConsolidations)
      mockPrisma.emailLogs.findMany.mockResolvedValue(mockEmailLogs)

      // Mock candidates for current state
      const mockCandidates = [
        { canContact: true, priorityScore: 80 },
        { canContact: false, priorityScore: 60 },
        { canContact: true, priorityScore: 40 }
      ]

      jest.spyOn(service, 'getConsolidationCandidates').mockResolvedValue(mockCandidates as any)

      const metrics = await service.getConsolidationMetrics(mockCompanyId)

      expect(metrics).toMatchObject({
        totalCandidates: 3,
        eligibleForConsolidation: 2, // 2 can contact
        consolidationRate: expect.any(Number),
        emailsSaved: 3, // (3-1) + (2-1) = 3 emails saved
        averageInvoicesPerConsolidation: 2.5, // (3+2)/2 = 2.5
        effectivenessMetrics: {
          openRate: 50, // 1 out of 2 emails opened
          clickRate: 0,
          responseRate: 0,
          paymentRate: 0
        }
      })
    })

    it('should handle empty data gracefully', async () => {
      mockPrisma.customerConsolidatedReminders.findMany.mockResolvedValue([])
      mockPrisma.emailLogs.findMany.mockResolvedValue([])
      jest.spyOn(service, 'getConsolidationCandidates').mockResolvedValue([])

      const metrics = await service.getConsolidationMetrics(mockCompanyId)

      expect(metrics).toMatchObject({
        totalCandidates: 0,
        eligibleForConsolidation: 0,
        consolidationRate: 0,
        emailsSaved: 0,
        averageInvoicesPerConsolidation: 0
      })
    })
  })

  describe('Priority Score Calculation', () => {
    it('should calculate priority scores correctly', async () => {
      // This tests the private calculatePriorityScore method indirectly
      const mockInvoices = [
        {
          id: 'inv-1',
          number: 'INV-001',
          totalAmount: 50000, // High amount
          currency: 'AED',
          dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days overdue
          status: 'OVERDUE',
          createdAt: new Date(),
          customerName: 'High Priority Customer',
          customerEmail: 'high@example.com',
          customers: {
            id: 'cust-high',
            name: 'High Priority Customer',
            email: 'high@example.com',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        },
        {
          id: 'inv-2',
          number: 'INV-002',
          totalAmount: 50000,
          currency: 'AED',
          dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          status: 'OVERDUE',
          createdAt: new Date(),
          customerName: 'High Priority Customer',
          customerEmail: 'high@example.com',
          customers: {
            id: 'cust-high',
            name: 'High Priority Customer',
            email: 'high@example.com',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        }
      ]

      mockPrisma.invoices.findMany.mockResolvedValue(mockInvoices)
      mockPrisma.customerConsolidatedReminders.findFirst.mockResolvedValue(null)
      mockPrisma.followUpLogs.findFirst.mockResolvedValue(null)

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toHaveLength(1)
      expect(candidates[0].priorityScore).toBeGreaterThan(80) // Should be high priority
      expect(candidates[0].escalationLevel).toBe('FINAL') // Should escalate to final due to age and amount
    })

    it('should assign lower priority to small, recent invoices', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          number: 'INV-001',
          totalAmount: 500, // Small amount
          currency: 'AED',
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
          status: 'OVERDUE',
          createdAt: new Date(),
          customerName: 'Low Priority Customer',
          customerEmail: 'low@example.com',
          customers: {
            id: 'cust-low',
            name: 'Low Priority Customer',
            email: 'low@example.com',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        },
        {
          id: 'inv-2',
          number: 'INV-002',
          totalAmount: 500,
          currency: 'AED',
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          status: 'OVERDUE',
          createdAt: new Date(),
          customerName: 'Low Priority Customer',
          customerEmail: 'low@example.com',
          customers: {
            id: 'cust-low',
            name: 'Low Priority Customer',
            email: 'low@example.com',
            consolidationPreference: 'ENABLED',
            preferredContactInterval: 7
          }
        }
      ]

      mockPrisma.invoices.findMany.mockResolvedValue(mockInvoices)
      mockPrisma.customerConsolidatedReminders.findFirst.mockResolvedValue(null)
      mockPrisma.followUpLogs.findFirst.mockResolvedValue(null)

      const candidates = await service.getConsolidationCandidates(mockCompanyId)

      expect(candidates).toHaveLength(1)
      expect(candidates[0].priorityScore).toBeLessThan(30) // Should be low priority
      expect(candidates[0].escalationLevel).toBe('POLITE') // Should be polite for recent, small amounts
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.invoices.findMany.mockRejectedValue(new Error('Database connection failed'))

      await expect(service.getConsolidationCandidates(mockCompanyId))
        .rejects
        .toThrow(ConsolidationError)
    })

    it('should handle invalid company ID', async () => {
      await expect(service.getConsolidationCandidates(''))
        .rejects
        .toThrow(ConsolidationError)
    })
  })
})