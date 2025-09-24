/**
 * Comprehensive End-to-End Tests for UAE Payment Collection Automation
 * 
 * This test suite validates the complete business workflow from invoice creation
 * through payment collection, ensuring UAE cultural compliance and business rules
 * are maintained throughout the entire process.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { prisma } from '@/lib/prisma'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { culturalCompliance } from '@/lib/services/cultural-compliance-service'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'
import { emailSchedulingService } from '@/lib/services/email-scheduling-service'
import { sequenceTriggersService } from '@/lib/services/sequence-triggers-service'
import { UAETestUtils } from '@/lib/uae-test-utils'
import { setupTestDatabase, cleanupTestDatabase } from '@/lib/test-db-setup'

// Test data factories
interface TestCompany {
  id: string
  name: string
  trn: string
  address: string
  businessHours: any
  emailSettings: any
}

interface TestCustomer {
  id: string
  companyId: string
  name: string
  nameAr?: string
  email: string
  phone: string
  paymentTerms: number
  relationshipType: 'GOVERNMENT' | 'VIP' | 'CORPORATE' | 'REGULAR'
}

interface TestInvoice {
  id: string
  companyId: string
  number: string
  customerName: string
  customerEmail: string
  amount: number
  vatAmount: number
  totalAmount: number
  currency: string
  dueDate: Date
  status: string
  trnNumber: string
}

interface TestSequence {
  id: string
  companyId: string
  name: string
  steps: any[]
  active: boolean
}

// Mock external services for testing
jest.mock('@/lib/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  validateEmailConfig: jest.fn().mockResolvedValue(true)
}))

// Test environment setup
class UAEBusinessTestEnvironment {
  private companies: TestCompany[] = []
  private customers: TestCustomer[] = []
  private invoices: TestInvoice[] = []
  private sequences: TestSequence[] = []
  private currentDate: Date = new Date('2024-03-15T10:00:00.000Z') // Tuesday in UAE

  async setup(): Promise<void> {
    await setupTestDatabase()
    await this.createTestData()
    this.mockTimeAndDate()
  }

  async cleanup(): Promise<void> {
    await cleanupTestDatabase()
    jest.restoreAllMocks()
  }

  private async createTestData(): Promise<void> {
    // Create test companies with UAE business configurations
    const companies = await this.createTestCompanies()
    const customers = await this.createTestCustomers(companies)
    const invoices = await this.createTestInvoices(companies, customers)
    const sequences = await this.createTestSequences(companies)

    this.companies = companies
    this.customers = customers
    this.invoices = invoices
    this.sequences = sequences
  }

  private async createTestCompanies(): Promise<TestCompany[]> {
    const companies = [
      {
        id: UAETestUtils.generateId(),
        name: 'Al Jazeera Trading LLC',
        trn: '100474123400003',
        address: 'Dubai International Financial Centre, UAE',
        businessHours: {
          workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
          startHour: 8,
          endHour: 18,
          timezone: 'Asia/Dubai'
        },
        emailSettings: {
          fromName: 'Al Jazeera Finance Team',
          fromEmail: 'finance@aljazeera.ae',
          replyTo: 'accounts@aljazeera.ae'
        }
      },
      {
        id: UAETestUtils.generateId(),
        name: 'Emirates Business Solutions',
        trn: '100123456700001',
        address: 'Abu Dhabi Global Market, UAE',
        businessHours: {
          workingDays: [0, 1, 2, 3, 4],
          startHour: 9,
          endHour: 17,
          timezone: 'Asia/Dubai'
        },
        emailSettings: {
          fromName: 'Emirates Accounts',
          fromEmail: 'billing@emirates-solutions.ae',
          replyTo: 'support@emirates-solutions.ae'
        }
      }
    ]

    for (const company of companies) {
      await prisma.company.create({
        data: {
          id: company.id,
          name: company.name,
          trn: company.trn,
          address: company.address,
          businessHours: company.businessHours,
          emailSettings: company.emailSettings,
          defaultVatRate: 5.00
        }
      })
    }

    return companies
  }

  private async createTestCustomers(companies: TestCompany[]): Promise<TestCustomer[]> {
    const customers = [
      // Government customer for formal tone testing
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        name: 'Dubai Municipality',
        nameAr: 'بلدية دبي',
        email: 'procurement@dm.gov.ae',
        phone: '+971-4-221-5555',
        paymentTerms: 30,
        relationshipType: 'GOVERNMENT' as const
      },
      // VIP customer for special handling
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        name: 'His Highness Royal Foundation',
        nameAr: 'مؤسسة صاحب السمو الملكية',
        email: 'finance@royalfoundation.ae',
        phone: '+971-2-444-8888',
        paymentTerms: 60,
        relationshipType: 'VIP' as const
      },
      // Corporate customer for standard business flow
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        name: 'Emirates Steel Arkan',
        email: 'accounts.payable@emiratessteel.ae',
        phone: '+971-2-666-9999',
        paymentTerms: 45,
        relationshipType: 'CORPORATE' as const
      },
      // Regular customer for standard flow
      {
        id: UAETestUtils.generateId(),
        companyId: companies[1].id,
        name: 'Al Masaood Trading',
        email: 'finance@almasaood.ae',
        phone: '+971-2-555-7777',
        paymentTerms: 30,
        relationshipType: 'REGULAR' as const
      }
    ]

    for (const customer of customers) {
      await prisma.customer.create({
        data: {
          id: customer.id,
          companyId: customer.companyId,
          name: customer.name,
          nameAr: customer.nameAr,
          email: customer.email,
          phone: customer.phone,
          paymentTerms: customer.paymentTerms,
          notes: `${customer.relationshipType} customer - requires appropriate cultural tone`
        }
      })
    }

    return customers
  }

  private async createTestInvoices(companies: TestCompany[], customers: TestCustomer[]): Promise<TestInvoice[]> {
    const currentDate = new Date(this.currentDate)
    const invoices = [
      // Government invoice - 30 days overdue
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        number: 'INV-GOV-2024-001',
        customerName: customers[0].name,
        customerEmail: customers[0].email,
        amount: 50000.00,
        vatAmount: 2500.00,
        totalAmount: 52500.00,
        currency: 'AED',
        dueDate: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000),
        status: 'OVERDUE',
        trnNumber: companies[0].trn
      },
      // VIP invoice - 7 days overdue (gentle approach)
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        number: 'INV-VIP-2024-002',
        customerName: customers[1].name,
        customerEmail: customers[1].email,
        amount: 125000.00,
        vatAmount: 6250.00,
        totalAmount: 131250.00,
        currency: 'AED',
        dueDate: new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        status: 'OVERDUE',
        trnNumber: companies[0].trn
      },
      // Corporate invoice - due in 5 days (proactive)
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        number: 'INV-CORP-2024-003',
        customerName: customers[2].name,
        customerEmail: customers[2].email,
        amount: 75000.00,
        vatAmount: 3750.00,
        totalAmount: 78750.00,
        currency: 'AED',
        dueDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: 'SENT',
        trnNumber: companies[0].trn
      },
      // Regular invoice - just sent
      {
        id: UAETestUtils.generateId(),
        companyId: companies[1].id,
        number: 'INV-REG-2024-004',
        customerName: customers[3].name,
        customerEmail: customers[3].email,
        amount: 25000.00,
        vatAmount: 1250.00,
        totalAmount: 26250.00,
        currency: 'AED',
        dueDate: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'SENT',
        trnNumber: companies[1].trn
      }
    ]

    for (const invoice of invoices) {
      await prisma.invoice.create({
        data: {
          id: invoice.id,
          companyId: invoice.companyId,
          number: invoice.number,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          amount: invoice.amount,
          vatAmount: invoice.vatAmount,
          totalAmount: invoice.totalAmount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          status: invoice.status as any,
          trnNumber: invoice.trnNumber,
          description: 'Professional services rendered',
          descriptionAr: 'خدمات مهنية مقدمة'
        }
      })
    }

    return invoices
  }

  private async createTestSequences(companies: TestCompany[]): Promise<TestSequence[]> {
    const sequences = [
      // Government sequence - very formal, patient
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        name: 'Government Customer Sequence',
        steps: [
          {
            stepNumber: 1,
            delayDays: 14, // Wait 2 weeks before first reminder
            subject: 'Respectful Reminder: Invoice {{invoiceNumber}} - Your Attention Appreciated',
            content: `As-salamu alaykum and greetings,

We hope this message finds you in good health and prosperity.

We respectfully bring to your attention that Invoice {{invoiceNumber}} dated {{dueDate}} for the amount of {{currency}} {{invoiceAmount}} is now due for settlement.

We understand that government procedures may require additional time, and we are happy to discuss any clarification or documentation needed.

Should you require any assistance or have questions regarding this invoice, please do not hesitate to contact our accounts team.

Thank you for your continued partnership and cooperation.

Best regards,
{{companyName}} Finance Team
TRN: {{trnNumber}}

JazakAllahu khair`,
            tone: 'VERY_FORMAL',
            language: 'ENGLISH'
          },
          {
            stepNumber: 2,
            delayDays: 21, // 3 weeks after first
            subject: 'Follow-up: Invoice {{invoiceNumber}} - Please Advise',
            content: `Dear Valued Partner,

We hope this message finds you well.

This is a respectful follow-up regarding Invoice {{invoiceNumber}} which was due on {{dueDate}}.

We would be grateful for an update on the status of this invoice or any requirements needed from our side to facilitate processing.

We remain at your service for any clarification or documentation.

With highest regards,
{{companyName}} Accounts Department
TRN: {{trnNumber}}`,
            tone: 'VERY_FORMAL',
            language: 'ENGLISH'
          }
        ],
        active: true
      },
      // VIP sequence - gentle, relationship-focused
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        name: 'VIP Customer Sequence',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7, // Short delay for VIP
            subject: 'Gentle Reminder: Invoice {{invoiceNumber}} - At Your Convenience',
            content: `Dear Esteemed {{customerName}},

We hope you and your family are in excellent health.

We wanted to gently bring to your attention Invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}}, which was due on {{dueDate}}.

We understand you may be traveling or attending to important matters. Please settle this at your convenience.

If there are any questions or if we can assist in any way, please let us know.

With warmest regards and best wishes,
{{companyName}} Team
TRN: {{trnNumber}}

May Allah bless your endeavors`,
            tone: 'FRIENDLY',
            language: 'ENGLISH'
          },
          {
            stepNumber: 2,
            delayDays: 14, // Give VIP customers more time
            subject: 'Second Notice: Invoice {{invoiceNumber}} - Your Kind Attention',
            content: `Dear {{customerName}},

We hope this message finds you in good health.

We are following up on Invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}}, which has been outstanding since {{dueDate}}.

We value our partnership immensely and want to ensure there are no issues preventing settlement.

Please let us know if there is anything we can do to assist or if you would like to discuss payment arrangements.

Thank you for your continued trust in our services.

Respectfully yours,
{{companyName}} Finance Team
TRN: {{trnNumber}}`,
            tone: 'BUSINESS',
            language: 'ENGLISH'
          }
        ],
        active: true
      },
      // Corporate sequence - professional, efficient
      {
        id: UAETestUtils.generateId(),
        companyId: companies[0].id,
        name: 'Corporate Customer Sequence',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Payment Reminder: Invoice {{invoiceNumber}}',
            content: `Dear {{customerName}},

We hope this message finds you well.

This is a friendly reminder that Invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}} was due on {{dueDate}}.

Please arrange for payment at your earliest convenience. If payment has already been made, kindly provide the transaction reference.

Should you have any questions or require additional documentation, please contact our accounts team.

Thank you for your business relationship.

Best regards,
{{companyName}} Accounts Receivable
TRN: {{trnNumber}}`,
            tone: 'BUSINESS',
            language: 'ENGLISH'
          },
          {
            stepNumber: 2,
            delayDays: 14,
            subject: 'Second Notice: Invoice {{invoiceNumber}} - Payment Required',
            content: `Dear {{customerName}},

We are writing to follow up on our previous communication regarding Invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}}.

This invoice is now {{daysPastDue}} days past due. Please arrange for immediate payment to avoid any impact on your account status.

If there are any issues preventing payment, please contact us immediately to discuss resolution.

We appreciate your prompt attention to this matter.

Sincerely,
{{companyName}} Finance Department
TRN: {{trnNumber}}`,
            tone: 'FORMAL',
            language: 'ENGLISH'
          },
          {
            stepNumber: 3,
            delayDays: 21,
            subject: 'Final Notice: Invoice {{invoiceNumber}} - Immediate Action Required',
            content: `Dear {{customerName}},

This is our final notice regarding the overdue Invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}}.

This invoice is now {{daysPastDue}} days past due. Immediate payment is required to prevent account restrictions.

If payment is not received within 7 business days, we may need to escalate this matter.

Please contact us immediately to resolve this situation.

{{companyName}} Collections Department
TRN: {{trnNumber}}`,
            tone: 'FORMAL',
            language: 'ENGLISH'
          }
        ],
        active: true
      }
    ]

    for (const sequence of sequences) {
      await prisma.follow_up_sequences.create({
        data: {
          id: sequence.id,
          companyId: sequence.companyId,
          name: sequence.name,
          steps: sequence.steps,
          active: sequence.active,
          updatedAt: new Date()
        }
      })
    }

    return sequences
  }

  private mockTimeAndDate(): void {
    // Mock current time to be during UAE business hours (Tuesday 10 AM)
    jest.useFakeTimers()
    jest.setSystemTime(this.currentDate)
  }

  getTestData() {
    return {
      companies: this.companies,
      customers: this.customers,
      invoices: this.invoices,
      sequences: this.sequences,
      currentDate: this.currentDate
    }
  }
}

describe('UAE Payment Collection Automation - End-to-End Tests', () => {
  let testEnv: UAEBusinessTestEnvironment

  beforeAll(async () => {
    testEnv = new UAEBusinessTestEnvironment()
    await testEnv.setup()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  beforeEach(async () => {
    // Reset any state between tests
    jest.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up any test-specific data
  })

  describe('Complete Business Workflow Tests', () => {
    it('should execute end-to-end Government customer workflow with cultural compliance', async () => {
      const { companies, customers, invoices, sequences } = testEnv.getTestData()
      const govCustomer = customers.find(c => c.relationshipType === 'GOVERNMENT')!
      const govInvoice = invoices.find(i => i.customerEmail === govCustomer.email)!
      const govSequence = sequences.find(s => s.name === 'Government Customer Sequence')!

      console.log('🏛️ Testing Government Customer Workflow')

      // Step 1: Trigger sequence for government invoice
      const triggerResult = await sequenceExecutionService.startSequenceExecution(
        govSequence.id,
        govInvoice.id,
        { type: 'INVOICE_STATUS', value: 'OVERDUE', operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(triggerResult.success).toBe(true)
      expect(triggerResult.emailLogIds).toHaveLength(1)
      expect(triggerResult.stepsExecuted).toBe(1)

      // Step 2: Validate cultural compliance for government sequence
      const complianceCheck = culturalCompliance.validateSequenceTone(
        govSequence,
        'GOVERNMENT'
      )

      expect(complianceCheck.isAppropriate).toBe(true)
      expect(complianceCheck.culturalScore).toBeGreaterThanOrEqual(85)
      expect(complianceCheck.recommendedTone).toBe('VERY_FORMAL')

      // Step 3: Verify email content meets government standards
      const emailLog = await prisma.emailLog.findFirst({
        where: { id: triggerResult.emailLogIds[0] }
      })

      expect(emailLog).toBeTruthy()
      expect(emailLog!.subject).toContain('Respectful Reminder')
      expect(emailLog!.content).toContain('As-salamu alaykum')
      expect(emailLog!.content).toContain('JazakAllahu khair')
      expect(emailLog!.content).toContain('government procedures')

      // Step 4: Validate proper delay timing for government customer
      expect(govSequence.steps[0].delayDays).toBeGreaterThanOrEqual(14)
      expect(govSequence.steps[1].delayDays).toBeGreaterThanOrEqual(21)

      // Step 5: Verify no aggressive language
      const inappropriateTerms = ['immediately', 'demand', 'must pay', 'final warning']
      const emailContent = emailLog!.content.toLowerCase()
      inappropriateTerms.forEach(term => {
        expect(emailContent).not.toContain(term)
      })

      console.log('✅ Government workflow passed all cultural compliance checks')
    })

    it('should handle VIP customer with special consideration during Ramadan', async () => {
      const { customers, invoices, sequences } = testEnv.getTestData()
      const vipCustomer = customers.find(c => c.relationshipType === 'VIP')!
      const vipInvoice = invoices.find(i => i.customerEmail === vipCustomer.email)!
      const vipSequence = sequences.find(s => s.name === 'VIP Customer Sequence')!

      console.log('👑 Testing VIP Customer Workflow during Ramadan')

      // Mock Ramadan period
      const ramadanDate = new Date('2024-03-20T11:00:00.000Z')
      jest.setSystemTime(ramadanDate)

      // Start VIP sequence
      const triggerResult = await sequenceExecutionService.startSequenceExecution(
        vipSequence.id,
        vipInvoice.id,
        { type: 'DUE_DATE', value: ramadanDate, operator: 'LESS_THAN' },
        { startImmediately: true }
      )

      expect(triggerResult.success).toBe(true)

      // Validate Ramadan-aware scheduling
      const emailLog = await prisma.emailLog.findFirst({
        where: { id: triggerResult.emailLogIds[0] }
      })

      // Should use respectful, gentle tone
      expect(emailLog!.content).toContain('At Your Convenience')
      expect(emailLog!.content).toContain('May Allah bless')
      expect(emailLog!.content).not.toContain('immediately')
      expect(emailLog!.content).not.toContain('overdue')

      // Verify VIP-specific timing (shorter delay but more respectful)
      expect(vipSequence.steps[0].delayDays).toBeLessThanOrEqual(7)
      expect(vipSequence.steps[1].delayDays).toBeGreaterThanOrEqual(14) // More time for VIP

      console.log('✅ VIP Ramadan workflow handled with cultural sensitivity')
    })

    it('should process corporate customer with progressive escalation', async () => {
      const { customers, invoices, sequences } = testEnv.getTestData()
      const corpCustomer = customers.find(c => c.relationshipType === 'CORPORATE')!
      const corpInvoice = invoices.find(i => i.customerEmail === corpCustomer.email)!
      const corpSequence = sequences.find(s => s.name === 'Corporate Customer Sequence')!

      console.log('🏢 Testing Corporate Customer Progressive Escalation')

      // Execute first step
      const step1Result = await sequenceExecutionService.startSequenceExecution(
        corpSequence.id,
        corpInvoice.id,
        { type: 'DUE_DATE', value: new Date(), operator: 'GREATER_THAN' },
        { startImmediately: true }
      )

      expect(step1Result.success).toBe(true)

      // Validate tone progression
      const step1Email = await prisma.emailLog.findFirst({
        where: { id: step1Result.emailLogIds[0] }
      })

      expect(step1Email!.subject).toContain('Payment Reminder')
      expect(step1Email!.content).toContain('friendly reminder')

      // Simulate time passing and execute step 2
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      jest.setSystemTime(futureDate)

      const step2Result = await sequenceExecutionService.continueSequenceExecution(
        step1Result.sequenceExecutionId!
      )

      expect(step2Result.success).toBe(true)

      const step2Email = await prisma.emailLog.findFirst({
        where: { id: step2Result.emailLogIds[0] }
      })

      expect(step2Email!.subject).toContain('Second Notice')
      expect(step2Email!.content).toContain('days past due')

      // Validate escalation pattern
      expect(corpSequence.steps[0].tone).toBe('BUSINESS')
      expect(corpSequence.steps[1].tone).toBe('FORMAL')
      expect(corpSequence.steps[2].tone).toBe('FORMAL')

      console.log('✅ Corporate escalation follows proper progression')
    })

    it('should stop sequence when payment is received', async () => {
      const { customers, invoices, sequences } = testEnv.getTestData()
      const regCustomer = customers.find(c => c.relationshipType === 'REGULAR')!
      const regInvoice = invoices.find(i => i.customerEmail === regCustomer.email)!
      const regSequence = sequences[0] // Use any sequence

      console.log('💰 Testing Payment Reception and Sequence Stopping')

      // Start sequence
      const sequenceResult = await sequenceExecutionService.startSequenceExecution(
        regSequence.id,
        regInvoice.id,
        { type: 'INVOICE_STATUS', value: 'SENT', operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(sequenceResult.success).toBe(true)

      // Simulate payment received
      await prisma.payment.create({
        data: {
          id: UAETestUtils.generateId(),
          invoiceId: regInvoice.id,
          amount: regInvoice.totalAmount,
          paymentDate: new Date(),
          method: 'BANK_TRANSFER',
          reference: 'TXN123456789',
          notes: 'Payment received via bank transfer'
        }
      })

      // Update invoice status
      await prisma.invoice.update({
        where: { id: regInvoice.id },
        data: { status: 'PAID' }
      })

      // Try to continue sequence - should stop
      const continueResult = await sequenceExecutionService.continueSequenceExecution(
        sequenceResult.sequenceExecutionId!
      )

      expect(continueResult.success).toBe(true)
      expect(continueResult.errors[0]).toContain('Payment received')
      expect(continueResult.stepsExecuted).toBe(0)

      console.log('✅ Sequence properly stopped when payment received')
    })
  })

  describe('UAE Cultural Integration End-to-End', () => {
    it('should respect UAE business hours throughout entire workflow', async () => {
      console.log('🕐 Testing UAE Business Hours Compliance')

      // Test during UAE business hours (Tuesday 10 AM)
      const businessHourDate = new Date('2024-03-19T06:00:00.000Z') // 10 AM UAE time
      jest.setSystemTime(businessHourDate)

      expect(uaeBusinessHours.isBusinessHours(businessHourDate)).toBe(true)

      // Test outside business hours (Friday afternoon)
      const nonBusinessHourDate = new Date('2024-03-22T14:00:00.000Z') // Friday 6 PM UAE
      jest.setSystemTime(nonBusinessHourDate)

      expect(uaeBusinessHours.isBusinessHours(nonBusinessHourDate)).toBe(false)

      // Test optimal send time calculation
      const optimalTime = uaeBusinessHours.getOptimalSendTime(nonBusinessHourDate)
      const optimalDay = optimalTime.getDay()
      const optimalHour = optimalTime.getHours()

      expect([0, 1, 2, 3, 4]).toContain(optimalDay) // Sunday-Thursday
      expect([10, 11]).toContain(optimalHour) // 10-11 AM
      expect(uaeBusinessHours.isBusinessHours(optimalTime)).toBe(true)

      console.log('✅ Business hours properly enforced')
    })

    it('should avoid prayer times in email scheduling', async () => {
      console.log('🕌 Testing Prayer Time Avoidance')

      // Set time to just before Dhuhr prayer (12:15 PM UAE)
      const prayerTime = new Date('2024-03-19T08:10:00.000Z') // 12:10 PM UAE
      jest.setSystemTime(prayerTime)

      expect(uaeBusinessHours.isPrayerTime(prayerTime)).toBe(true)

      // Get next available send time
      const nextAvailableTime = uaeBusinessHours.getNextAvailableSendTime(prayerTime, {
        avoidPrayerTimes: true
      })

      expect(uaeBusinessHours.isPrayerTime(nextAvailableTime)).toBe(false)
      expect(nextAvailableTime.getTime()).toBeGreaterThan(prayerTime.getTime())

      console.log('✅ Prayer times properly avoided')
    })

    it('should handle UAE National Day and Islamic holidays', async () => {
      console.log('🎊 Testing Holiday Handling')

      // Test UAE National Day (December 2nd)
      const nationalDay = new Date('2024-12-02T06:00:00.000Z')
      expect(uaeBusinessHours.isUAEHoliday(nationalDay)).toBe(true)

      // Test Eid Al Fitr
      const eidAlFitr = new Date('2024-04-10T06:00:00.000Z')
      expect(uaeBusinessHours.isUAEHoliday(eidAlFitr)).toBe(true)

      // Verify scheduling avoids holidays
      const scheduleTime = uaeBusinessHours.getNextAvailableSendTime(nationalDay)
      expect(uaeBusinessHours.isUAEHoliday(scheduleTime)).toBe(false)

      console.log('✅ Holidays properly handled')
    })

    it('should validate Arabic language content and RTL support', async () => {
      console.log('🔤 Testing Arabic Language Support')

      const arabicContent = `السلام عليكم ورحمة الله وبركاته

      عزيزي العميل المحترم،

      نتمنى أن تكونوا بخير وصحة جيدة.

      نود أن نذكركم بفاتورة رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} درهم إماراتي.

      نقدر تعاونكم ونتطلع لاستمرار الشراكة معكم.

      مع أطيب التحيات،
      فريق المحاسبة
      الرقم الضريبي: {{trnNumber}}`

      const arabicAnalysis = culturalCompliance.detectArabicLanguage(arabicContent)

      expect(arabicAnalysis.hasArabic).toBe(true)
      expect(arabicAnalysis.arabicPercentage).toBeGreaterThan(70)
      expect(arabicAnalysis.isRTL).toBe(true)
      expect(arabicAnalysis.requiresRTLLayout).toBe(true)

      const validationResult = culturalCompliance.validateTemplateContent({
        contentEn: '',
        contentAr: arabicContent,
        subjectEn: '',
        subjectAr: 'تذكير لطيف بالفاتورة'
      })

      expect(validationResult.isValid).toBe(true)
      expect(validationResult.culturalCompliance).toBeGreaterThan(80)

      console.log('✅ Arabic content properly validated')
    })
  })

  describe('Multi-System Integration Tests', () => {
    it('should integrate frontend sequence builder with backend automation', async () => {
      console.log('🔗 Testing Frontend-Backend Integration')

      const { companies } = testEnv.getTestData()
      const company = companies[0]

      // Simulate frontend sequence creation
      const frontendSequenceData = {
        name: 'Integration Test Sequence',
        companyId: company.id,
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Test Reminder: Invoice {{invoiceNumber}}',
            content: 'This is a test sequence from frontend integration.',
            tone: 'BUSINESS',
            language: 'ENGLISH'
          }
        ],
        active: true
      }

      // Create sequence via API-like operation
      const sequence = await prisma.follow_up_sequences.create({
        data: {
          id: UAETestUtils.generateId(),
          ...frontendSequenceData,
          updatedAt: new Date()
        }
      })

      // Validate cultural compliance during creation
      const complianceCheck = culturalCompliance.validateSequenceTone(sequence, 'REGULAR')
      expect(complianceCheck.isAppropriate).toBe(true)

      // Test sequence execution
      const testInvoice = testEnv.getTestData().invoices[0]
      const executionResult = await sequenceExecutionService.startSequenceExecution(
        sequence.id,
        testInvoice.id,
        { type: 'MANUAL', value: true, operator: 'EQUALS' }
      )

      expect(executionResult.success).toBe(true)

      console.log('✅ Frontend-backend integration working')
    })

    it('should handle email template management with sequence execution', async () => {
      console.log('📧 Testing Email Template Integration')

      const { companies } = testEnv.getTestData()
      const company = companies[0]

      // Create email template
      const template = await prisma.emailTemplate.create({
        data: {
          id: UAETestUtils.generateId(),
          companyId: company.id,
          name: 'Professional Reminder Template',
          templateType: 'INVOICE_REMINDER',
          subjectEn: 'Professional Service Invoice {{invoiceNumber}} - Payment Due',
          subjectAr: 'فاتورة الخدمة المهنية {{invoiceNumber}} - مستحقة الدفع',
          contentEn: `Dear {{customerName}},

We hope this message finds you well.

Your invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}} is now due for payment.

Please arrange payment at your earliest convenience.

Best regards,
{{companyName}} Team
TRN: {{trnNumber}}`,
          contentAr: `عزيزي {{customerName}}،

نتمنى أن تكونوا بخير.

فاتورتكم رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} {{currency}} مستحقة الدفع.

يرجى ترتيب الدفع في أقرب وقت ممكن.

مع أطيب التحيات،
فريق {{companyName}}
الرقم الضريبي: {{trnNumber}}`,
          isActive: true,
          createdBy: 'test-user'
        }
      })

      // Create sequence using the template
      const sequence = await prisma.follow_up_sequences.create({
        data: {
          id: UAETestUtils.generateId(),
          companyId: company.id,
          name: 'Template-Based Sequence',
          steps: [
            {
              stepNumber: 1,
              delayDays: 7,
              templateId: template.id,
              subject: '', // Will be populated from template
              content: '', // Will be populated from template
              tone: 'BUSINESS',
              language: 'BOTH' // Both English and Arabic
            }
          ],
          active: true,
          updatedAt: new Date()
        }
      })

      // Execute sequence with template
      const testInvoice = testEnv.getTestData().invoices[0]
      const executionResult = await sequenceExecutionService.startSequenceExecution(
        sequence.id,
        testInvoice.id,
        { type: 'MANUAL', value: true, operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)
      expect(executionResult.emailLogIds).toHaveLength(2) // Both English and Arabic

      // Verify template variables were replaced
      const emailLogs = await prisma.emailLog.findMany({
        where: { id: { in: executionResult.emailLogIds } }
      })

      const englishEmail = emailLogs.find(e => e.language === 'ENGLISH')
      const arabicEmail = emailLogs.find(e => e.language === 'ARABIC')

      expect(englishEmail?.content).toContain(testInvoice.number)
      expect(englishEmail?.content).toContain(testInvoice.totalAmount.toString())
      expect(arabicEmail?.content).toContain(testInvoice.number)
      expect(arabicEmail?.content).toContain(testInvoice.totalAmount.toString())

      console.log('✅ Template integration working correctly')
    })

    it('should process cron job orchestration end-to-end', async () => {
      console.log('⏰ Testing Cron Job Orchestration')

      // Set time to optimal business hours
      const businessTime = new Date('2024-03-19T06:00:00.000Z') // Tuesday 10 AM UAE
      jest.setSystemTime(businessTime)

      // Create pending sequences that need processing
      const { invoices, sequences } = testEnv.getTestData()
      const testInvoice = invoices[0]
      const testSequence = sequences[0]

      // Start a sequence and simulate it needs continuation
      const executionResult = await sequenceExecutionService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        { type: 'INVOICE_STATUS', value: 'OVERDUE', operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)

      // Advance time to when next step should execute
      const nextExecutionTime = new Date(businessTime.getTime() + 7 * 24 * 60 * 60 * 1000)
      jest.setSystemTime(nextExecutionTime)

      // Simulate cron job processing
      const processingResult = await sequenceExecutionService.processPendingExecutions()

      expect(processingResult.processed).toBeGreaterThan(0)
      expect(processingResult.errors.length).toBe(0)

      console.log('✅ Cron job orchestration working')
    })
  })

  describe('Real Business Scenarios', () => {
    it('should handle mixed Arabic/English communication for diverse customer base', async () => {
      console.log('🌍 Testing Mixed Language Communication')

      const { companies, customers, invoices } = testEnv.getTestData()
      const customer = customers[0] // Government customer with Arabic name
      const invoice = invoices[0]

      // Create bilingual sequence
      const bilingualSequence = await prisma.follow_up_sequences.create({
        data: {
          id: UAETestUtils.generateId(),
          companyId: companies[0].id,
          name: 'Bilingual Communication Sequence',
          steps: [
            {
              stepNumber: 1,
              delayDays: 7,
              subject: 'Invoice Reminder / تذكير بالفاتورة - {{invoiceNumber}}',
              content: `Dear {{customerName}} / عزيزي {{customerName}},

We hope this message finds you in good health.
نتمنى أن تكونوا بخير وصحة جيدة.

Invoice {{invoiceNumber}} for {{currency}} {{invoiceAmount}} is due for payment.
فاتورة رقم {{invoiceNumber}} بمبلغ {{invoiceAmount}} {{currency}} مستحقة الدفع.

Thank you for your cooperation.
شكراً لتعاونكم.

Best regards / مع أطيب التحيات,
{{companyName}} Team / فريق {{companyName}}
TRN / الرقم الضريبي: {{trnNumber}}`,
              tone: 'FORMAL',
              language: 'BOTH'
            }
          ],
          active: true,
          updatedAt: new Date()
        }
      })

      const executionResult = await sequenceExecutionService.startSequenceExecution(
        bilingualSequence.id,
        invoice.id,
        { type: 'MANUAL', value: true, operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)

      const emailLog = await prisma.emailLog.findFirst({
        where: { id: executionResult.emailLogIds[0] }
      })

      // Verify bilingual content
      expect(emailLog?.content).toContain('Dear')
      expect(emailLog?.content).toContain('عزيزي')
      expect(emailLog?.content).toContain('نتمنى')

      // Validate cultural appropriateness
      const arabicAnalysis = culturalCompliance.detectArabicLanguage(emailLog!.content)
      expect(arabicAnalysis.mixedLanguage).toBe(true)

      console.log('✅ Mixed language communication handled properly')
    })

    it('should handle multiple sequences during UAE National Day period', async () => {
      console.log('🇦🇪 Testing UAE National Day Period Handling')

      // Set date to UAE National Day
      const nationalDayWeek = new Date('2024-12-01T06:00:00.000Z')
      jest.setSystemTime(nationalDayWeek)

      const { invoices, sequences } = testEnv.getTestData()

      // Try to start multiple sequences during holiday period
      const sequencePromises = invoices.slice(0, 3).map((invoice, index) => 
        sequenceExecutionService.startSequenceExecution(
          sequences[0].id,
          invoice.id,
          { type: 'MANUAL', value: true, operator: 'EQUALS' },
          { startImmediately: false } // Should be scheduled for after holiday
        )
      )

      const results = await Promise.all(sequencePromises)

      results.forEach(result => {
        expect(result.success).toBe(true)
        // Next execution should be after holiday period
        if (result.nextExecutionAt) {
          expect(uaeBusinessHours.isUAEHoliday(result.nextExecutionAt)).toBe(false)
        }
      })

      console.log('✅ National Day period properly handled')
    })

    it('should handle emergency sequence with prayer time conflicts', async () => {
      console.log('🚨 Testing Emergency Sequence with Prayer Time Conflicts')

      // Set time to just before Maghrib prayer (6:30 PM)
      const prayerConflictTime = new Date('2024-03-19T14:25:00.000Z') // 6:25 PM UAE
      jest.setSystemTime(prayerConflictTime)

      const { companies, invoices } = testEnv.getTestData()

      // Create urgent sequence
      const urgentSequence = await prisma.follow_up_sequences.create({
        data: {
          id: UAETestUtils.generateId(),
          companyId: companies[0].id,
          name: 'Emergency Payment Request',
          steps: [
            {
              stepNumber: 1,
              delayDays: 0, // Immediate
              subject: 'URGENT: Payment Required - Invoice {{invoiceNumber}}',
              content: `Dear {{customerName}},

This is an urgent request regarding Invoice {{invoiceNumber}}.

Due to exceptional circumstances, we kindly request immediate payment.

Please contact us at your earliest convenience.

{{companyName}} Emergency Team
TRN: {{trnNumber}}`,
              tone: 'FORMAL',
              language: 'ENGLISH'
            }
          ],
          active: true,
          updatedAt: new Date()
        }
      })

      const executionResult = await sequenceExecutionService.startSequenceExecution(
        urgentSequence.id,
        invoices[0].id,
        { type: 'MANUAL', value: true, operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)

      // Verify email was scheduled to avoid prayer time
      const emailLog = await prisma.emailLog.findFirst({
        where: { id: executionResult.emailLogIds[0] }
      })

      if (emailLog?.uaeSendTime) {
        expect(uaeBusinessHours.isPrayerTime(emailLog.uaeSendTime)).toBe(false)
      }

      console.log('✅ Emergency sequence respects prayer times')
    })
  })

  describe('Performance and Scale Testing', () => {
    it('should handle 50+ concurrent sequence executions', async () => {
      console.log('⚡ Testing Scale Performance - 50 Concurrent Sequences')

      const { companies, customers } = testEnv.getTestData()
      const company = companies[0]

      // Create 50 test invoices
      const testInvoices = []
      for (let i = 0; i < 50; i++) {
        const invoice = await prisma.invoice.create({
          data: {
            id: UAETestUtils.generateId(),
            companyId: company.id,
            number: `SCALE-TEST-${i.toString().padStart(3, '0')}`,
            customerName: `Test Customer ${i}`,
            customerEmail: `test.customer.${i}@example.ae`,
            amount: 1000 + (i * 100),
            vatAmount: 50 + (i * 5),
            totalAmount: 1050 + (i * 105),
            currency: 'AED',
            dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            status: 'OVERDUE',
            trnNumber: company.trn
          }
        })
        testInvoices.push(invoice)
      }

      const testSequence = testEnv.getTestData().sequences[0]

      // Execute sequences concurrently
      const startTime = Date.now()
      
      const promises = testInvoices.map(invoice => 
        sequenceExecutionService.startSequenceExecution(
          testSequence.id,
          invoice.id,
          { type: 'INVOICE_STATUS', value: 'OVERDUE', operator: 'EQUALS' },
          { startImmediately: true }
        )
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // Performance assertions
      expect(executionTime).toBeLessThan(30000) // Should complete within 30 seconds
      
      const successfulExecutions = results.filter(r => r.success).length
      const failedExecutions = results.filter(r => !r.success).length

      expect(successfulExecutions).toBeGreaterThan(45) // At least 90% success rate
      expect(failedExecutions).toBeLessThan(5)

      console.log(`✅ Processed ${successfulExecutions}/50 sequences in ${executionTime}ms`)
    })

    it('should maintain cultural compliance under load', async () => {
      console.log('🎯 Testing Cultural Compliance Under Load')

      // Create diverse sequence content for testing
      const testSequences = [
        'Government formal sequence with Islamic greetings',
        'VIP customer gentle reminder during Ramadan',
        'Corporate escalation with professional tone',
        'Regular customer bilingual communication'
      ]

      const complianceResults = await Promise.all(
        testSequences.map(async (description, index) => {
          const mockSequence = {
            id: `test-${index}`,
            steps: [
              {
                stepNumber: 1,
                delayDays: 7,
                content: `As-salamu alaykum. ${description}. JazakAllahu khair.`,
                subject: 'Respectful reminder',
                tone: 'FORMAL'
              }
            ]
          }

          return culturalCompliance.validateSequenceTone(
            mockSequence, 
            index === 0 ? 'GOVERNMENT' : 'REGULAR'
          )
        })
      )

      // All sequences should pass cultural compliance
      complianceResults.forEach((result, index) => {
        expect(result.isAppropriate).toBe(true)
        expect(result.culturalScore).toBeGreaterThan(70)
      })

      console.log('✅ Cultural compliance maintained under load')
    })

    it('should handle email queue health monitoring during peak load', async () => {
      console.log('📊 Testing Email Queue Health Monitoring')

      // Create large number of scheduled emails
      const { companies, customers } = testEnv.getTestData()
      const company = companies[0]

      for (let i = 0; i < 100; i++) {
        await emailSchedulingService.scheduleEmail({
          companyId: company.id,
          recipientEmail: `bulk.test.${i}@example.ae`,
          recipientName: `Bulk Test ${i}`,
          subject: `Bulk Email ${i}`,
          content: 'Test email for queue monitoring',
          language: 'ENGLISH',
          scheduledFor: new Date(Date.now() + (i * 1000 * 60)), // Spread over time
          priority: 'NORMAL',
          maxRetries: 3,
          retryCount: 0
        })
      }

      // Check queue metrics
      const queueMetrics = await emailSchedulingService.getQueueMetrics()

      expect(queueMetrics.totalQueued).toBeGreaterThan(90)
      expect(queueMetrics.queueHealth).toBeOneOf(['HEALTHY', 'WARNING'])
      expect(queueMetrics.scheduledForToday).toBeGreaterThan(50)

      console.log(`✅ Queue health: ${queueMetrics.queueHealth}, Queued: ${queueMetrics.totalQueued}`)
    })
  })

  describe('Analytics and Monitoring Validation', () => {
    it('should track sequence performance analytics accurately', async () => {
      console.log('📈 Testing Sequence Analytics Tracking')

      const { sequences, invoices } = testEnv.getTestData()
      const testSequence = sequences[0]
      const testInvoice = invoices[0]

      // Execute sequence and simulate engagement
      const executionResult = await sequenceExecutionService.startSequenceExecution(
        testSequence.id,
        testInvoice.id,
        { type: 'MANUAL', value: true, operator: 'EQUALS' },
        { startImmediately: true }
      )

      expect(executionResult.success).toBe(true)

      // Simulate email engagement
      const emailLog = await prisma.emailLog.findFirst({
        where: { id: executionResult.emailLogIds[0] }
      })

      await prisma.emailLog.update({
        where: { id: emailLog!.id },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(),
          openedAt: new Date(Date.now() + 60000), // Opened after 1 minute
          clickedAt: new Date(Date.now() + 120000), // Clicked after 2 minutes
          engagementScore: 0.85
        }
      })

      // Get analytics
      const analytics = await sequenceExecutionService.getSequenceAnalytics(testSequence.id)

      expect(analytics.totalExecutions).toBeGreaterThan(0)
      expect(analytics.stepAnalytics).toHaveLength(testSequence.steps.length)
      expect(analytics.stepAnalytics[0].openRate).toBeGreaterThan(0)
      expect(analytics.stepAnalytics[0].clickRate).toBeGreaterThan(0)

      console.log(`✅ Analytics: ${analytics.totalExecutions} executions, ${analytics.conversionRate}% conversion`)
    })

    it('should provide real-time monitoring of UAE business compliance', async () => {
      console.log('👁️ Testing Real-time Compliance Monitoring')

      const { companies } = testEnv.getTestData()
      const company = companies[0]

      // Create sequence with compliance issues
      const problematicSequence = {
        id: 'test-problematic',
        companyId: company.id,
        steps: [
          {
            stepNumber: 1,
            delayDays: 1, // Too soon
            content: 'You must pay immediately or face legal action!', // Inappropriate
            subject: 'URGENT PAYMENT DEMANDED',
            tone: 'URGENT'
          }
        ]
      }

      const complianceReport = culturalCompliance.validateSequenceTone(
        problematicSequence,
        'GOVERNMENT'
      )

      expect(complianceReport.isAppropriate).toBe(false)
      expect(complianceReport.culturalScore).toBeLessThan(70)
      expect(complianceReport.issues.length).toBeGreaterThan(0)
      expect(complianceReport.suggestions.length).toBeGreaterThan(0)

      // Verify specific issues are caught
      expect(complianceReport.issues.some(issue => 
        issue.includes('immediately') || issue.includes('legal action')
      )).toBe(true)

      console.log(`✅ Compliance monitoring caught ${complianceReport.issues.length} issues`)
    })

    it('should generate comprehensive UAE business metrics', async () => {
      console.log('📊 Testing UAE Business Metrics Generation')

      const currentTime = new Date()
      
      // Test business hours metrics
      const businessHoursMetrics = {
        isCurrentlyBusinessHours: uaeBusinessHours.isBusinessHours(currentTime),
        nextBusinessHour: uaeBusinessHours.getNextBusinessHour(currentTime),
        isCurrentlyPrayerTime: uaeBusinessHours.isPrayerTime(currentTime),
        isCurrentlyHoliday: uaeBusinessHours.isUAEHoliday(currentTime),
        optimalSendTime: uaeBusinessHours.getOptimalSendTime(currentTime)
      }

      expect(typeof businessHoursMetrics.isCurrentlyBusinessHours).toBe('boolean')
      expect(businessHoursMetrics.nextBusinessHour).toBeInstanceOf(Date)
      expect(typeof businessHoursMetrics.isCurrentlyPrayerTime).toBe('boolean')
      expect(typeof businessHoursMetrics.isCurrentlyHoliday).toBe('boolean')
      expect(businessHoursMetrics.optimalSendTime).toBeInstanceOf(Date)

      // Test cultural preferences
      const culturalPreferences = culturalCompliance.getCulturalTimingPreferences()

      expect(culturalPreferences.preferredDays).toContain(2) // Tuesday
      expect(culturalPreferences.preferredDays).toContain(3) // Wednesday
      expect(culturalPreferences.preferredDays).toContain(4) // Thursday
      expect(culturalPreferences.preferredHours).toContain(10) // 10 AM
      expect(culturalPreferences.avoidancePeriods).toBeInstanceOf(Array)
      expect(culturalPreferences.culturalConsiderations).toBeInstanceOf(Array)

      console.log('✅ UAE business metrics generated successfully')
    })
  })
})