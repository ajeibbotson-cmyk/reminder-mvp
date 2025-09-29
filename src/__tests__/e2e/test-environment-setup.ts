/**
 * UAE Business Test Environment Setup
 * 
 * Comprehensive test environment configuration with UAE business calendar,
 * cultural compliance mocks, and realistic data generation for E2E testing.
 */

import { beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals'
import { prisma } from '@/lib/prisma'
import { UAETestUtils } from '@/lib/uae-test-utils'

// UAE Business Calendar Configuration
export interface UAEBusinessCalendar {
  businessDays: number[] // 0=Sunday, 1=Monday, etc.
  businessHours: { start: number; end: number }
  prayerTimes: {
    fajr: string
    dhuhr: string
    asr: string
    maghrib: string
    isha: string
  }
  holidays: Array<{
    date: Date
    name: string
    type: 'ISLAMIC' | 'NATIONAL' | 'PUBLIC'
    description: string
  }>
  ramadanPeriods: Array<{
    year: number
    startDate: Date
    endDate: Date
  }>
  culturalEvents: Array<{
    date: Date
    name: string
    impact: 'HIGH' | 'MEDIUM' | 'LOW'
    recommendations: string[]
  }>
}

// Test Data Templates
export interface UAETestDataTemplates {
  companies: Array<{
    name: string
    trn: string
    address: string
    businessType: 'GOVERNMENT' | 'PRIVATE' | 'SEMI_GOVERNMENT' | 'FREE_ZONE'
  }>
  customers: Array<{
    name: string
    nameAr: string
    email: string
    phone: string
    relationshipType: 'GOVERNMENT' | 'VIP' | 'CORPORATE' | 'REGULAR'
    culturalPreferences: {
      language: 'ENGLISH' | 'ARABIC' | 'BOTH'
      communicationStyle: 'FORMAL' | 'BUSINESS' | 'FRIENDLY'
      islamicGreetings: boolean
    }
  }>
  emailTemplates: Array<{
    name: string
    type: 'FIRST_REMINDER' | 'SECOND_REMINDER' | 'FINAL_NOTICE' | 'PAYMENT_CONFIRMATION'
    culturalTone: 'VERY_FORMAL' | 'FORMAL' | 'BUSINESS' | 'FRIENDLY'
    contentEn: string
    contentAr?: string
    subjectEn: string
    subjectAr?: string
    complianceScore: number
  }>
}

// Mock Services Configuration
export interface MockServicesConfig {
  emailService: {
    simulateDeliveryDelays: boolean
    simulateFailures: boolean
    failureRate: number
    avgDeliveryTime: number
  }
  externalAPIs: {
    simulateSlowResponses: boolean
    simulateTimeouts: boolean
    avgResponseTime: number
  }
  culturalCompliance: {
    strictMode: boolean
    customRules: Array<{
      rule: string
      severity: 'ERROR' | 'WARNING' | 'INFO'
      message: string
    }>
  }
}

/**
 * UAE Business Test Environment Manager
 */
export class UAEBusinessTestEnvironment {
  private calendar: UAEBusinessCalendar
  private dataTemplates: UAETestDataTemplates
  private mockConfig: MockServicesConfig
  private originalEnv: Record<string, string | undefined> = {}

  constructor() {
    this.calendar = this.createUAEBusinessCalendar()
    this.dataTemplates = this.createTestDataTemplates()
    this.mockConfig = this.createMockServicesConfig()
  }

  /**
   * Initialize the complete test environment
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing UAE Business Test Environment...')

    // Setup test database
    await this.setupTestDatabase()
    
    // Configure UAE business calendar
    this.setupUAECalendar()
    
    // Setup mocks
    this.setupMockServices()
    
    // Configure environment variables
    this.setupTestEnvironmentVariables()
    
    // Create base test data
    await this.createBaseTestData()

    console.log('✅ UAE Business Test Environment initialized')
  }

  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...')

    // Cleanup database
    await this.cleanupTestDatabase()
    
    // Restore mocks
    jest.restoreAllMocks()
    
    // Restore environment
    this.restoreEnvironmentVariables()

    console.log('✅ Test environment cleaned up')
  }

  /**
   * Get current UAE business context for testing
   */
  getCurrentUAEContext(testDate?: Date): {
    currentTime: Date
    isBusinessHours: boolean
    isPrayerTime: boolean
    isHoliday: boolean
    currentHoliday?: string
    isRamadan: boolean
    culturalConsiderations: string[]
  } {
    const now = testDate || new Date()
    const dayOfWeek = now.getDay()
    const hour = now.getHours()
    const timeString = `${hour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const isBusinessHours = this.calendar.businessDays.includes(dayOfWeek) &&
                           hour >= this.calendar.businessHours.start &&
                           hour < this.calendar.businessHours.end

    const isPrayerTime = this.isWithinPrayerTime(timeString)
    
    const currentHoliday = this.calendar.holidays.find(holiday => 
      this.isSameDate(holiday.date, now)
    )
    
    const isRamadan = this.isRamadanPeriod(now)

    const culturalConsiderations = this.getCulturalConsiderations(now)

    return {
      currentTime: now,
      isBusinessHours,
      isPrayerTime,
      isHoliday: !!currentHoliday,
      currentHoliday: currentHoliday?.name,
      isRamadan,
      culturalConsiderations
    }
  }

  /**
   * Create realistic test invoice data with UAE context
   */
  async createTestInvoice(customization: {
    companyId: string
    customerType?: 'GOVERNMENT' | 'VIP' | 'CORPORATE' | 'REGULAR'
    amount?: number
    status?: 'SENT' | 'OVERDUE' | 'PAID'
    daysOld?: number
  }) {
    const customer = this.getCustomerTemplate(customization.customerType || 'REGULAR')
    const amount = customization.amount || (Math.random() * 50000 + 1000)
    const vatAmount = amount * 0.05 // UAE VAT rate
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() - (customization.daysOld || 30))

    const invoiceId = UAETestUtils.generateId()
    const customerId = UAETestUtils.generateId()

    // Create customer first
    await prisma.customers.create({
      data: {
        id: customerId,
        companyId: customization.companyId,
        name: customer.name,
        nameAr: customer.nameAr,
        email: customer.email,
        phone: customer.phone,
        notes: `Test customer - ${customer.relationshipType} relationship`
      }
    })

    // Create invoice
    const invoice = await prisma.invoices.create({
      data: {
        id: invoiceId,
        companyId: customization.companyId,
        number: `INV-${invoiceId.slice(-8).toUpperCase()}`,
        customerName: customer.name,
        customerEmail: customer.email,
        amount,
        vatAmount,
        totalAmount: amount + vatAmount,
        currency: 'AED',
        dueDate,
        status: customization.status || 'OVERDUE',
        description: 'Professional services rendered',
        descriptionAr: 'خدمات مهنية مقدمة',
        trnNumber: '100474123400003'
      }
    })

    return { invoice, customer: { id: customerId, ...customer } }
  }

  /**
   * Create culturally compliant email sequence for testing
   */
  async createCulturallyCompliantSequence(companyId: string, customerType: 'GOVERNMENT' | 'VIP' | 'CORPORATE' | 'REGULAR') {
    const templates = this.getSequenceTemplatesForCustomerType(customerType)
    const sequenceId = UAETestUtils.generateId()

    const sequence = await prisma.follow_up_sequences.create({
      data: {
        id: sequenceId,
        companyId,
        name: `${customerType} Customer Sequence - Test`,
        steps: templates.map((template, index) => ({
          stepNumber: index + 1,
          delayDays: template.delayDays,
          subject: template.subjectEn,
          content: template.contentEn,
          tone: template.culturalTone,
          language: 'ENGLISH',
          metadata: {
            complianceScore: template.complianceScore,
            culturalTone: template.culturalTone,
            customerType
          }
        })),
        active: true,
        updatedAt: new Date()
      }
    })

    return sequence
  }

  /**
   * Simulate UAE business time progression
   */
  simulateTimeProgression(startTime: Date, progressionConfig: {
    skipWeekends?: boolean
    skipHolidays?: boolean
    skipPrayerTimes?: boolean
    progressionSpeed?: number // days per step
  }): Date[] {
    const progression = []
    let currentTime = new Date(startTime)
    const speed = progressionConfig.progressionSpeed || 1

    for (let i = 0; i < 30; i++) { // 30 steps
      currentTime = new Date(currentTime.getTime() + speed * 24 * 60 * 60 * 1000)
      
      if (progressionConfig.skipWeekends && this.isWeekend(currentTime)) {
        continue
      }
      
      if (progressionConfig.skipHolidays && this.isHoliday(currentTime)) {
        continue
      }
      
      if (progressionConfig.skipPrayerTimes && this.isPrayerTimeNow(currentTime)) {
        // Skip to next available time
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000) // 30 minutes later
      }
      
      progression.push(new Date(currentTime))
    }

    return progression
  }

  // Private helper methods

  private createUAEBusinessCalendar(): UAEBusinessCalendar {
    return {
      businessDays: [0, 1, 2, 3, 4], // Sunday to Thursday
      businessHours: { start: 8, end: 18 },
      prayerTimes: {
        fajr: '05:30',
        dhuhr: '12:15',
        asr: '15:30',
        maghrib: '18:30',
        isha: '20:00'
      },
      holidays: [
        {
          date: new Date('2024-01-01'),
          name: 'New Year Day',
          type: 'PUBLIC',
          description: 'International New Year celebration'
        },
        {
          date: new Date('2024-04-09'),
          name: 'Eid Al Fitr',
          type: 'ISLAMIC',
          description: 'End of Ramadan celebration - 3 day holiday'
        },
        {
          date: new Date('2024-06-16'),
          name: 'Eid Al Adha',
          type: 'ISLAMIC',
          description: 'Festival of Sacrifice - 3 day holiday'
        },
        {
          date: new Date('2024-07-07'),
          name: 'Islamic New Year',
          type: 'ISLAMIC',
          description: 'Islamic calendar new year'
        },
        {
          date: new Date('2024-09-15'),
          name: 'Prophet Muhammad Birthday',
          type: 'ISLAMIC',
          description: 'Mawlid an-Nabi celebration'
        },
        {
          date: new Date('2024-12-01'),
          name: 'Commemoration Day',
          type: 'NATIONAL',
          description: 'UAE Martyrs Day'
        },
        {
          date: new Date('2024-12-02'),
          name: 'UAE National Day',
          type: 'NATIONAL',
          description: 'UAE Independence celebration'
        }
      ],
      ramadanPeriods: [
        {
          year: 2024,
          startDate: new Date('2024-03-10'),
          endDate: new Date('2024-04-09')
        },
        {
          year: 2025,
          startDate: new Date('2025-02-28'),
          endDate: new Date('2025-03-30')
        }
      ],
      culturalEvents: [
        {
          date: new Date('2024-03-10'),
          name: 'Ramadan Start',
          impact: 'HIGH',
          recommendations: [
            'Use more formal tone',
            'Avoid late afternoon emails',
            'Include Ramadan greetings',
            'Be more patient with responses'
          ]
        }
      ]
    }
  }

  private createTestDataTemplates(): UAETestDataTemplates {
    return {
      companies: [
        {
          name: 'Al Jazeera Trading LLC',
          trn: '100474123400003',
          address: 'Dubai International Financial Centre, UAE',
          businessType: 'PRIVATE'
        },
        {
          name: 'Emirates Government Solutions',
          trn: '100123456700001',
          address: 'Abu Dhabi Government District, UAE',
          businessType: 'GOVERNMENT'
        },
        {
          name: 'Dubai Free Zone Enterprises',
          trn: '100987654300002',
          address: 'Dubai Multi Commodities Centre, UAE',
          businessType: 'FREE_ZONE'
        }
      ],
      customers: [
        {
          name: 'Dubai Municipality',
          nameAr: 'بلدية دبي',
          email: 'procurement@dm.gov.ae',
          phone: '+971-4-221-5555',
          relationshipType: 'GOVERNMENT',
          culturalPreferences: {
            language: 'BOTH',
            communicationStyle: 'FORMAL',
            islamicGreetings: true
          }
        },
        {
          name: 'His Highness Royal Foundation',
          nameAr: 'مؤسسة صاحب السمو الملكية',
          email: 'office@royalfoundation.ae',
          phone: '+971-2-444-8888',
          relationshipType: 'VIP',
          culturalPreferences: {
            language: 'BOTH',
            communicationStyle: 'FORMAL',
            islamicGreetings: true
          }
        },
        {
          name: 'Emirates Steel Arkan',
          nameAr: 'أركان الإمارات للصلب',
          email: 'accounts@emiratessteel.ae',
          phone: '+971-2-666-9999',
          relationshipType: 'CORPORATE',
          culturalPreferences: {
            language: 'ENGLISH',
            communicationStyle: 'BUSINESS',
            islamicGreetings: false
          }
        },
        {
          name: 'Ahmed Al-Rashid Trading',
          nameAr: 'أحمد الراشد للتجارة',
          email: 'ahmed@alrashidtrading.ae',
          phone: '+971-50-123-4567',
          relationshipType: 'REGULAR',
          culturalPreferences: {
            language: 'BOTH',
            communicationStyle: 'BUSINESS',
            islamicGreetings: true
          }
        }
      ],
      emailTemplates: [
        {
          name: 'Government First Reminder',
          type: 'FIRST_REMINDER',
          culturalTone: 'VERY_FORMAL',
          contentEn: `As-salamu alaykum and greetings,

Your Excellency,

We hope this message finds you in good health and prosperity.

We respectfully bring to your attention that Invoice {{invoiceNumber}} dated {{dueDate}} for the amount of {{currency}} {{invoiceAmount}} requires your kind attention.

We understand that government procedures may require additional processing time, and we remain at your service for any clarification needed.

Thank you for your continued cooperation and partnership.

With highest regards and respect,
{{companyName}} Finance Department
TRN: {{trnNumber}}

JazakAllahu khair`,
          subjectEn: 'Respectful Reminder: Invoice {{invoiceNumber}} - Your Attention Appreciated',
          complianceScore: 95
        }
      ]
    }
  }

  private createMockServicesConfig(): MockServicesConfig {
    return {
      emailService: {
        simulateDeliveryDelays: true,
        simulateFailures: false,
        failureRate: 0.05, // 5% failure rate
        avgDeliveryTime: 2000 // 2 seconds
      },
      externalAPIs: {
        simulateSlowResponses: true,
        simulateTimeouts: false,
        avgResponseTime: 500
      },
      culturalCompliance: {
        strictMode: true,
        customRules: [
          {
            rule: 'mandatory_islamic_greeting_for_government',
            severity: 'WARNING',
            message: 'Government customers should receive Islamic greetings'
          },
          {
            rule: 'avoid_aggressive_language',
            severity: 'ERROR',
            message: 'Aggressive language detected - not appropriate for UAE culture'
          }
        ]
      }
    }
  }

  private async setupTestDatabase(): Promise<void> {
    // Ensure clean state
    await this.cleanupTestDatabase()
  }

  private async cleanupTestDatabase(): Promise<void> {
    // Clean up in dependency order
    const models = [
      'emailLog',
      'followUpLog',
      'payment',
      'importError',
      'importFieldMapping',
      'importBatch',
      'invoiceItem',
      'invoice',
      'customer',
      'emailTemplate',
      'followUpSequence',
      'activity',
      'session',
      'account',
      'user',
      'company'
    ]

    for (const model of models) {
      try {
        await (prisma as any)[model].deleteMany({
          where: {
            OR: [
              { id: { contains: 'test-' } },
              { companyId: { contains: 'test-' } }
            ]
          }
        })
      } catch (error) {
        // Some models might not exist or have different field names
        console.warn(`Could not clean ${model}:`, error)
      }
    }
  }

  private setupUAECalendar(): void {
    // Mock current time to UAE business hours by default
    const businessHourTime = new Date('2024-03-19T06:00:00.000Z') // Tuesday 10 AM UAE
    jest.useFakeTimers()
    jest.setSystemTime(businessHourTime)
  }

  private setupMockServices(): void {
    // Mock AWS SES
    jest.doMock('@aws-sdk/client-ses', () => ({
      SESClient: jest.fn().mockImplementation(() => ({
        send: jest.fn().mockImplementation(async () => {
          if (this.mockConfig.emailService.simulateDeliveryDelays) {
            await new Promise(resolve => 
              setTimeout(resolve, this.mockConfig.emailService.avgDeliveryTime)
            )
          }
          
          if (this.mockConfig.emailService.simulateFailures && 
              Math.random() < this.mockConfig.emailService.failureRate) {
            throw new Error('Simulated email delivery failure')
          }
          
          return {
            MessageId: `test-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }
        })
      })),
      SendEmailCommand: jest.fn()
    }))

    // Mock external API calls
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (this.mockConfig.externalAPIs.simulateSlowResponses) {
        await new Promise(resolve => 
          setTimeout(resolve, this.mockConfig.externalAPIs.avgResponseTime)
        )
      }
      
      return {
        ok: true,
        json: async () => ({ success: true, data: 'mocked response' })
      }
    })
  }

  private setupTestEnvironmentVariables(): void {
    // Store original environment
    this.originalEnv = { ...process.env }
    
    // Set test environment variables
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/uaepay_test'
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    process.env.CRON_SECRET = 'test-cron-secret'
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.AWS_REGION = 'me-central-1'
  }

  private restoreEnvironmentVariables(): void {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (this.originalEnv[key] !== undefined) {
        process.env[key] = this.originalEnv[key]
      } else {
        delete process.env[key]
      }
    })
  }

  private async createBaseTestData(): Promise<void> {
    // Create one test company for general use
    const testCompanyId = 'test-company-main'
    const testUserId = 'test-user-main'

    await prisma.companies.create({
      data: {
        id: testCompanyId,
        name: 'UAE Test Company LLC',
        trn: '100474123400003',
        address: 'Dubai Test District, UAE',
        businessHours: {
          workingDays: [0, 1, 2, 3, 4],
          startHour: 8,
          endHour: 18,
          timezone: 'Asia/Dubai'
        }
      }
    })

    await prisma.users.create({
      data: {
        id: testUserId,
        email: 'test@uaetest.ae',
        name: 'Test User',
        companyId: testCompanyId,
        role: 'ADMIN'
      }
    })
  }

  private getCustomerTemplate(type: string) {
    return this.dataTemplates.customers.find(c => c.relationshipType === type) ||
           this.dataTemplates.customers[0]
  }

  private getSequenceTemplatesForCustomerType(customerType: string) {
    // Return appropriate sequence templates based on customer type
    const baseDelays = {
      'GOVERNMENT': [14, 21, 35], // Very patient
      'VIP': [7, 14, 28],         // Patient but responsive
      'CORPORATE': [7, 14, 21],   // Standard business
      'REGULAR': [7, 14, 21]      // Standard
    }

    const delays = baseDelays[customerType as keyof typeof baseDelays] || baseDelays.REGULAR

    return delays.map((delayDays, index) => ({
      delayDays,
      subjectEn: `${customerType} Reminder ${index + 1}`,
      contentEn: `Culturally appropriate content for ${customerType} customer step ${index + 1}`,
      culturalTone: customerType === 'GOVERNMENT' ? 'VERY_FORMAL' : 'BUSINESS' as any,
      complianceScore: 85 - (index * 5) // Decreasing compliance as sequence progresses
    }))
  }

  private isWithinPrayerTime(timeString: string): boolean {
    const prayerTimes = Object.values(this.calendar.prayerTimes)
    const currentMinutes = this.timeStringToMinutes(timeString)
    
    return prayerTimes.some(prayerTime => {
      const prayerMinutes = this.timeStringToMinutes(prayerTime)
      return Math.abs(currentMinutes - prayerMinutes) <= 15 // 15-minute buffer
    })
  }

  private timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  private isRamadanPeriod(date: Date): boolean {
    return this.calendar.ramadanPeriods.some(period =>
      date >= period.startDate && date <= period.endDate
    )
  }

  private getCulturalConsiderations(date: Date): string[] {
    const considerations = []
    
    if (this.isRamadanPeriod(date)) {
      considerations.push('Ramadan period - use respectful tone and avoid late sends')
    }
    
    if (this.isWeekend(date)) {
      considerations.push('Weekend in UAE - avoid business communications')
    }
    
    if (this.isPrayerTimeNow(date)) {
      considerations.push('Prayer time - avoid immediate sends')
    }
    
    const dayOfWeek = date.getDay()
    if (dayOfWeek >= 2 && dayOfWeek <= 4) { // Tuesday to Thursday
      considerations.push('Optimal UAE business days for communications')
    }
    
    return considerations
  }

  private isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay()
    return dayOfWeek === 5 || dayOfWeek === 6 // Friday or Saturday
  }

  private isHoliday(date: Date): boolean {
    return this.calendar.holidays.some(holiday =>
      this.isSameDate(holiday.date, date)
    )
  }

  private isPrayerTimeNow(date: Date): boolean {
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    return this.isWithinPrayerTime(timeString)
  }
}

// Export singleton instance
export const uaeTestEnvironment = new UAEBusinessTestEnvironment()

// Jest setup helpers
export const setupUAETestEnvironment = async (): Promise<void> => {
  await uaeTestEnvironment.initialize()
}

export const cleanupUAETestEnvironment = async (): Promise<void> => {
  await uaeTestEnvironment.cleanup()
}

// Test utilities for E2E tests
export const UAETestHelpers = {
  /**
   * Create a test scenario with realistic UAE business context
   */
  createBusinessScenario: async (scenario: {
    companyType: 'GOVERNMENT' | 'PRIVATE' | 'FREE_ZONE'
    customerCount: number
    invoiceCount: number
    timeframe: 'CURRENT' | 'RAMADAN' | 'HOLIDAY'
  }) => {
    // Implementation would create comprehensive test scenario
    return {
      companyId: 'test-scenario-company',
      customerIds: ['test-customer-1'],
      invoiceIds: ['test-invoice-1'],
      sequenceIds: ['test-sequence-1'],
      context: uaeTestEnvironment.getCurrentUAEContext()
    }
  },

  /**
   * Simulate realistic email engagement patterns
   */
  simulateEngagement: async (emailIds: string[], engagementProfile: 'HIGH' | 'MEDIUM' | 'LOW') => {
    const profiles = {
      HIGH: { openRate: 0.85, clickRate: 0.45, avgEngagement: 0.8 },
      MEDIUM: { openRate: 0.65, clickRate: 0.25, avgEngagement: 0.6 },
      LOW: { openRate: 0.35, clickRate: 0.10, avgEngagement: 0.3 }
    }
    
    const profile = profiles[engagementProfile]
    
    for (const emailId of emailIds) {
      const willOpen = Math.random() < profile.openRate
      const willClick = willOpen && Math.random() < profile.clickRate
      
      await prisma.emailLog.update({
        where: { id: emailId },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(),
          openedAt: willOpen ? new Date(Date.now() + 60000) : null,
          clickedAt: willClick ? new Date(Date.now() + 120000) : null,
          engagementScore: profile.avgEngagement + (Math.random() * 0.4 - 0.2) // ±0.2 variance
        }
      })
    }
  }
}