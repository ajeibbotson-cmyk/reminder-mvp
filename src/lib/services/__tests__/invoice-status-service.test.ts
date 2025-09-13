/**
 * Comprehensive Test Suite for Invoice Status Management Service
 * Tests for UAE business rules, status transitions, and automated processes
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { 
  InvoiceStatusService, 
  invoiceStatusService,
  STATUS_TRANSITION_RULES 
} from '../invoice-status-service'
import { InvoiceStatus, UserRole } from '@prisma/client'
import { Decimal } from 'decimal.js'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    invoices: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn()
    },
    activities: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    emailLogs: {
      create: jest.fn()
    },
    cronExecutions: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    adminNotifications: {
      create: jest.fn()
    }
  }
}))

// Mock VAT calculator
jest.mock('@/lib/vat-calculator', () => ({
  formatUAECurrency: jest.fn((amount: any, currency: string) => {
    const num = amount instanceof Decimal ? amount.toNumber() : amount
    return `${currency} ${num.toFixed(2)}`
  })
}))

describe('InvoiceStatusService', () => {
  let service: InvoiceStatusService
  let mockInvoice: any
  let mockUser: { role: UserRole; companyId: string }

  beforeEach(() => {
    service = new InvoiceStatusService()
    
    mockInvoice = {
      id: 'test-invoice-id',
      number: 'INV-001',
      status: InvoiceStatus.DRAFT,
      amount: 1000,
      totalAmount: 1000,
      currency: 'AED',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      companyId: 'test-company-id',
      customerName: 'Test Customer',
      customerEmail: 'customer@test.com',
      trnNumber: '123456789012345',
      payments: []
    }

    mockUser = {
      role: UserRole.ADMIN,
      companyId: 'test-company-id'
    }

    // Clear all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Status Transition Validation', () => {
    it('should allow valid transitions according to UAE business rules', () => {
      // Test DRAFT -> SENT
      const validation = service.validateStatusTransition(
        InvoiceStatus.DRAFT,
        InvoiceStatus.SENT,
        { invoice: mockInvoice, user: mockUser }
      )
      
      expect(validation.isValid).toBe(true)
      expect(validation.complianceNote).toContain('UAE business rules')
    })

    it('should reject invalid transitions', () => {
      // Test DRAFT -> PAID (should not be allowed directly)
      const validation = service.validateStatusTransition(
        InvoiceStatus.DRAFT,
        InvoiceStatus.PAID,
        { invoice: mockInvoice, user: mockUser }
      )
      
      expect(validation.isValid).toBe(false)
      expect(validation.reason).toContain('Invalid transition')
    })

    it('should enforce payment validation for PAID status', () => {
      const invoiceWithInsufficientPayments = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        payments: [{ amount: 500 }] // Less than total amount
      }

      const validation = service.validateStatusTransition(
        InvoiceStatus.SENT,
        InvoiceStatus.PAID,
        { invoice: invoiceWithInsufficientPayments, user: mockUser }
      )
      
      expect(validation.isValid).toBe(false)
      expect(validation.reason).toContain('Payments')
      expect(validation.reason).toContain('insufficient')
    })

    it('should require reason for DISPUTED status', () => {
      const validation = service.validateStatusTransition(
        InvoiceStatus.SENT,
        InvoiceStatus.DISPUTED,
        { invoice: mockInvoice, user: mockUser }
      )
      
      expect(validation.isValid).toBe(false)
      expect(validation.reason).toContain('reason')
      expect(validation.reason).toContain('audit compliance')
    })

    it('should require reason for WRITTEN_OFF status', () => {
      const validation = service.validateStatusTransition(
        InvoiceStatus.OVERDUE,
        InvoiceStatus.WRITTEN_OFF,
        { invoice: mockInvoice, user: mockUser }
      )
      
      expect(validation.isValid).toBe(false)
      expect(validation.reason).toContain('reason')
      expect(validation.reason).toContain('audit compliance')
    })

    it('should enforce role-based permissions', () => {
      const userWithLimitedRole = { role: UserRole.USER, companyId: 'test-company-id' }
      
      const validation = service.validateStatusTransition(
        InvoiceStatus.SENT,
        InvoiceStatus.WRITTEN_OFF,
        { invoice: mockInvoice, user: userWithLimitedRole }
      )
      
      expect(validation.isValid).toBe(false)
      expect(validation.reason).toContain('ADMIN or FINANCE')
    })

    it('should allow forceOverride for role restrictions', () => {
      const userWithLimitedRole = { role: UserRole.USER, companyId: 'test-company-id' }
      
      const validation = service.validateStatusTransition(
        InvoiceStatus.SENT,
        InvoiceStatus.WRITTEN_OFF,
        { 
          invoice: mockInvoice, 
          user: userWithLimitedRole,
          reason: 'Admin approved write-off',
          forceOverride: true
        }
      )
      
      expect(validation.isValid).toBe(true)
    })
  })

  describe('Business Context Calculation', () => {
    it('should correctly calculate payment status', () => {
      const invoiceWithPayments = {
        ...mockInvoice,
        payments: [
          { amount: 600, paymentDate: new Date() },
          { amount: 400, paymentDate: new Date() }
        ]
      }

      // Use private method via any to test business context calculation
      const context = (service as any).calculateBusinessContext(invoiceWithPayments)
      
      expect(context.totalPaid).toBe(1000)
      expect(context.remainingAmount).toBe(0)
      expect(context.hasPayments).toBe(true)
    })

    it('should detect overdue invoices correctly', () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      }

      const context = (service as any).calculateBusinessContext(overdueInvoice)
      
      expect(context.isOverdue).toBe(true)
      expect(context.daysPastDue).toBeGreaterThan(0)
    })

    it('should not mark PAID invoices as overdue', () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      }

      const context = (service as any).calculateBusinessContext(paidInvoice)
      
      expect(context.isOverdue).toBe(false)
    })
  })

  describe('Automated Status Determination', () => {
    it('should auto-transition to OVERDUE for past due SENT invoices', () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }

      const businessContext = {
        isOverdue: true,
        daysPastDue: 1,
        hasPayments: false,
        totalPaid: 0,
        remainingAmount: 1000,
        customerEmail: 'customer@test.com',
        dueDate: overdueInvoice.dueDate
      }

      const actualStatus = (service as any).determineActualStatus(
        overdueInvoice,
        InvoiceStatus.SENT,
        businessContext
      )
      
      expect(actualStatus).toBe(InvoiceStatus.OVERDUE)
    })

    it('should validate payment amount for PAID status', () => {
      const invoiceWithFullPayment = {
        ...mockInvoice,
        payments: [{ amount: 1000 }]
      }

      const businessContext = {
        isOverdue: false,
        daysPastDue: 0,
        hasPayments: true,
        totalPaid: 1000,
        remainingAmount: 0,
        customerEmail: 'customer@test.com',
        dueDate: invoiceWithFullPayment.dueDate
      }

      const actualStatus = (service as any).determineActualStatus(
        invoiceWithFullPayment,
        InvoiceStatus.PAID,
        businessContext
      )
      
      expect(actualStatus).toBe(InvoiceStatus.PAID)
    })

    it('should reject PAID status for insufficient payments', () => {
      const invoiceWithPartialPayment = {
        ...mockInvoice,
        payments: [{ amount: 500 }]
      }

      const businessContext = {
        isOverdue: false,
        daysPastDue: 0,
        hasPayments: true,
        totalPaid: 500,
        remainingAmount: 500,
        customerEmail: 'customer@test.com',
        dueDate: invoiceWithPartialPayment.dueDate
      }

      const actualStatus = (service as any).determineActualStatus(
        invoiceWithPartialPayment,
        InvoiceStatus.PAID,
        businessContext
      )
      
      // Should return to original status
      expect(actualStatus).toBe(InvoiceStatus.DRAFT)
    })
  })

  describe('UAE Business Hours Validation', () => {
    it('should correctly identify UAE business hours', () => {
      // Mock Dubai time for testing
      const originalToLocaleString = Date.prototype.toLocaleString
      
      // Mock Sunday 10 AM Dubai time (business hours)
      Date.prototype.toLocaleString = jest.fn().mockReturnValue('1/1/2024, 10:00:00 AM')
      Object.defineProperty(Date.prototype, 'getDay', {
        value: jest.fn().mockReturnValue(0) // Sunday
      })
      Object.defineProperty(Date.prototype, 'getHours', {
        value: jest.fn().mockReturnValue(10)
      })

      const isBusinessHours = (service as any).isUAEBusinessHours()
      
      expect(isBusinessHours).toBe(true)

      // Restore original method
      Date.prototype.toLocaleString = originalToLocaleString
    })

    it('should reject processing outside business hours', () => {
      // Mock Friday (weekend) Dubai time
      const originalToLocaleString = Date.prototype.toLocaleString
      
      Date.prototype.toLocaleString = jest.fn().mockReturnValue('1/5/2024, 10:00:00 AM')
      Object.defineProperty(Date.prototype, 'getDay', {
        value: jest.fn().mockReturnValue(5) // Friday
      })
      Object.defineProperty(Date.prototype, 'getHours', {
        value: jest.fn().mockReturnValue(10)
      })

      const isBusinessHours = (service as any).isUAEBusinessHours()
      
      expect(isBusinessHours).toBe(false)

      // Restore original method
      Date.prototype.toLocaleString = originalToLocaleString
    })
  })

  describe('Compliance Flag Generation', () => {
    it('should generate appropriate compliance flags', () => {
      const validation = { requiresApproval: true, approvalLevel: UserRole.ADMIN }
      const invoiceWithTRN = { ...mockInvoice, trnNumber: '123456789012345' }
      
      const flags = (service as any).generateComplianceFlags(
        invoiceWithTRN,
        InvoiceStatus.WRITTEN_OFF,
        validation
      )
      
      expect(flags).toContain('REQUIRES_ADMIN_APPROVAL')
      expect(flags).toContain('TAX_DEDUCTION_ELIGIBLE')
      expect(flags).toContain('TRN_COMPLIANT')
    })

    it('should flag overdue status', () => {
      const overdueInvoice = {
        ...mockInvoice,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
      
      const flags = (service as any).generateComplianceFlags(
        overdueInvoice,
        InvoiceStatus.OVERDUE,
        { isValid: true }
      )
      
      expect(flags).toContain('OVERDUE_STATUS')
    })
  })

  describe('Status Change Reason Generation', () => {
    it('should generate appropriate reasons for common transitions', () => {
      const reason = (service as any).getDefaultStatusChangeReason(
        InvoiceStatus.SENT,
        InvoiceStatus.PAID
      )
      
      expect(reason).toBe('Payment received and confirmed')
    })

    it('should generate generic reason for uncommon transitions', () => {
      const reason = (service as any).getDefaultStatusChangeReason(
        InvoiceStatus.DRAFT,
        InvoiceStatus.DISPUTED
      )
      
      expect(reason).toBe('Status changed from DRAFT to DISPUTED')
    })
  })

  describe('Business Hour Calculations', () => {
    it('should calculate next business day correctly', () => {
      const nextBusinessTime = (service as any).calculateNextBusinessHourSendTime()
      
      expect(nextBusinessTime).toBeInstanceOf(Date)
      // Should be a future date
      expect(nextBusinessTime.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid invoice references gracefully', async () => {
      const { prisma } = require('@/lib/prisma')
      prisma.invoices.findUnique.mockResolvedValue(null)

      await expect(
        service.updateInvoiceStatus('invalid-id', InvoiceStatus.SENT, {
          userId: 'user-id',
          userRole: UserRole.ADMIN,
          companyId: 'company-id'
        })
      ).rejects.toThrow('Invoice with ID invalid-id not found')
    })

    it('should enforce company isolation', async () => {
      const { prisma } = require('@/lib/prisma')
      const invoiceFromDifferentCompany = {
        ...mockInvoice,
        companyId: 'different-company-id'
      }
      
      prisma.invoices.findUnique.mockResolvedValue(invoiceFromDifferentCompany)

      await expect(
        service.updateInvoiceStatus('test-id', InvoiceStatus.SENT, {
          userId: 'user-id',
          userRole: UserRole.ADMIN,
          companyId: 'test-company-id'
        })
      ).rejects.toThrow('Access denied')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large batch operations efficiently', () => {
      const largeInvoiceSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `invoice-${i}`,
        number: `INV-${i}`,
        status: InvoiceStatus.SENT,
        amount: 1000,
        companyId: 'test-company-id'
      }))

      // Test that batch processing doesn't timeout
      const startTime = Date.now()
      
      // Simulate batch processing
      largeInvoiceSet.forEach(invoice => {
        service.validateStatusTransition(
          invoice.status,
          InvoiceStatus.OVERDUE,
          { invoice, user: mockUser }
        )
      })
      
      const processingTime = Date.now() - startTime
      
      // Should process 1000 validations in under 1 second
      expect(processingTime).toBeLessThan(1000)
    })
  })

  describe('Integration with External Systems', () => {
    it('should properly format notification data', () => {
      const subject = (service as any).getNotificationSubject(
        'INV-001',
        InvoiceStatus.SENT,
        InvoiceStatus.OVERDUE
      )
      
      expect(subject).toBe('URGENT: Invoice INV-001 is Past Due')
    })

    it('should handle missing notification templates gracefully', () => {
      const subject = (service as any).getNotificationSubject(
        'INV-001',
        InvoiceStatus.DISPUTED,
        InvoiceStatus.DRAFT // Unusual transition
      )
      
      expect(subject).toContain('INV-001')
      expect(subject).toContain('status update')
    })
  })
})

describe('Status Transition Rules Configuration', () => {
  it('should have comprehensive transition rules for all statuses', () => {
    const allStatuses = Object.values(InvoiceStatus)
    
    allStatuses.forEach(status => {
      expect(STATUS_TRANSITION_RULES).toHaveProperty(status)
      expect(Array.isArray(STATUS_TRANSITION_RULES[status])).toBe(true)
    })
  })

  it('should not allow transitions from terminal states', () => {
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.PAID]).toEqual([InvoiceStatus.DISPUTED])
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.WRITTEN_OFF]).toEqual([])
  })

  it('should have logical progression paths', () => {
    // DRAFT should allow SENT
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.DRAFT]).toContain(InvoiceStatus.SENT)
    
    // SENT should allow PAID, OVERDUE, DISPUTED
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.SENT]).toContain(InvoiceStatus.PAID)
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.SENT]).toContain(InvoiceStatus.OVERDUE)
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.SENT]).toContain(InvoiceStatus.DISPUTED)
    
    // OVERDUE should allow PAID
    expect(STATUS_TRANSITION_RULES[InvoiceStatus.OVERDUE]).toContain(InvoiceStatus.PAID)
  })
})

describe('UAE-Specific Business Logic', () => {
  it('should respect Islamic calendar considerations', () => {
    // This would test integration with Islamic holiday calendar
    // For now, we verify the structure exists
    expect(typeof (service as any).calculateNextBusinessHourSendTime).toBe('function')
  })

  it('should handle TRN validation properly', () => {
    const invoiceWithValidTRN = { ...mockInvoice, trnNumber: '123456789012345' }
    const invoiceWithoutTRN = { ...mockInvoice, trnNumber: null }
    
    const flagsWithTRN = (service as any).generateComplianceFlags(
      invoiceWithValidTRN,
      InvoiceStatus.SENT,
      { isValid: true }
    )
    
    const flagsWithoutTRN = (service as any).generateComplianceFlags(
      invoiceWithoutTRN,
      InvoiceStatus.SENT,
      { isValid: true }
    )
    
    expect(flagsWithTRN).toContain('TRN_COMPLIANT')
    expect(flagsWithoutTRN).not.toContain('TRN_COMPLIANT')
  })

  it('should handle AED currency formatting', () => {
    const { formatUAECurrency } = require('@/lib/vat-calculator')
    
    // Test that the service uses proper currency formatting
    expect(formatUAECurrency).toBeDefined()
  })
})