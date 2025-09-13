import { PrismaClient } from '@prisma/client'
import { mockExecSync } from 'jest'

// Test database configuration
const TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/uaepay_test'

// Mock Prisma Client for testing
export class MockPrismaClient {
  private mocks: Map<string, any> = new Map()

  // Core models for email templates
  emailTemplate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  }

  emailLog = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn()
  }

  company = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }

  user = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }

  customer = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }

  invoice = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }

  activity = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }

  // Transaction support
  $transaction = jest.fn()
  $connect = jest.fn()
  $disconnect = jest.fn()

  // Reset all mocks
  resetMocks() {
    ;[
      this.emailTemplate,
      this.emailLog,
      this.company,
      this.user,
      this.customer,
      this.invoice,
      this.activity
    ].forEach(model => {
      Object.values(model).forEach(method => {
        if (jest.isMockFunction(method)) {
          method.mockReset()
        }
      })
    })

    this.$transaction.mockReset()
    this.$connect.mockReset()
    this.$disconnect.mockReset()
  }

  // Setup default mocks for successful operations
  setupDefaultMocks() {
    this.resetMocks()

    // Default company data
    const defaultCompany = {
      id: 'test-company-id',
      name: 'Test Company LLC',
      trn: '100123456789012',
      address: 'Dubai, UAE',
      settings: { defaultCurrency: 'AED', vatRate: 5.0 },
      emailSettings: {
        fromName: 'Test Company',
        fromEmail: 'noreply@testcompany.ae'
      },
      businessHours: {
        timezone: 'Asia/Dubai',
        workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
        startTime: '09:00',
        endTime: '18:00'
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }

    // Default user data
    const defaultUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      companyId: 'test-company-id',
      role: 'ADMIN',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }

    // Setup company mocks
    this.company.findUnique.mockResolvedValue(defaultCompany)
    this.company.findFirst.mockResolvedValue(defaultCompany)

    // Setup user mocks
    this.user.findUnique.mockResolvedValue(defaultUser)
    this.user.findFirst.mockResolvedValue(defaultUser)

    // Setup email template mocks
    this.emailTemplate.findMany.mockResolvedValue([])
    this.emailTemplate.count.mockResolvedValue(0)
    this.emailTemplate.create.mockImplementation(async (data) => ({
      id: 'test-template-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: defaultUser,
      _count: { emailLogs: 0 },
      ...data.data
    }))

    // Setup email log mocks
    this.emailLog.count.mockResolvedValue(0)
    this.emailLog.findMany.mockResolvedValue([])

    // Setup activity mocks
    this.activity.create.mockResolvedValue({
      id: 'test-activity-id',
      createdAt: new Date()
    })

    // Setup transaction mock
    this.$transaction.mockImplementation(async (operations) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations)
      }
      return operations(this)
    })
  }

  // Setup mock for email template creation
  setupEmailTemplateCreation(templateData: any) {
    this.emailTemplate.create.mockResolvedValue({
      id: templateData.id || 'test-template-id',
      ...templateData,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com'
      },
      _count: { emailLogs: 0 }
    })
  }

  // Setup mock for email template listing
  setupEmailTemplateListing(templates: any[]) {
    this.emailTemplate.findMany.mockResolvedValue(templates)
    this.emailTemplate.count.mockResolvedValue(templates.length)

    // Setup usage statistics for each template
    templates.forEach((template, index) => {
      this.emailLog.count
        .mockResolvedValueOnce(template._count?.emailLogs || 0) // Total usage
        .mockResolvedValueOnce(Math.floor((template._count?.emailLogs || 0) * 0.3)) // Last 30 days sent
        .mockResolvedValueOnce(Math.floor((template._count?.emailLogs || 0) * 0.8)) // Delivered
        .mockResolvedValueOnce(Math.floor((template._count?.emailLogs || 0) * 0.4)) // Opened
    })
  }

  // Setup error scenarios
  setupEmailTemplateError(error: Error) {
    this.emailTemplate.create.mockRejectedValue(error)
    this.emailTemplate.update.mockRejectedValue(error)
    this.emailTemplate.delete.mockRejectedValue(error)
  }
}

// Global test database instance
let testPrisma: MockPrismaClient

// Initialize test database
export function initTestDatabase(): MockPrismaClient {
  if (!testPrisma) {
    testPrisma = new MockPrismaClient()
  }
  
  testPrisma.setupDefaultMocks()
  return testPrisma
}

// Clean up test database
export function cleanupTestDatabase() {
  if (testPrisma) {
    testPrisma.resetMocks()
  }
}

// Setup for each test
export function setupTestDatabase() {
  beforeEach(() => {
    const db = initTestDatabase()
    db.setupDefaultMocks()
  })

  afterEach(() => {
    cleanupTestDatabase()
  })

  return () => testPrisma
}

// Test data factories
export const testDataFactories = {
  createEmailTemplate: (overrides: any = {}) => ({
    id: 'test-template-' + Math.random().toString(36).substr(2, 9),
    companyId: 'test-company-id',
    name: 'Test Template',
    description: 'A test email template',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Test Subject {{customer_name}}',
    subjectAr: 'موضوع تجريبي {{customer_name_ar}}',
    contentEn: 'Dear {{customer_name}}, this is a test email. TRN: {{company_trn}}',
    contentAr: 'عزيزي {{customer_name_ar}}، هذا بريد إلكتروني تجريبي. الرقم الضريبي: {{company_trn}}',
    variables: {
      customer_name: 'Customer name',
      customer_name_ar: 'اسم العميل',
      company_trn: 'Company TRN'
    },
    version: 1,
    isActive: true,
    isDefault: false,
    uaeBusinessHoursOnly: true,
    createdBy: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com'
    },
    _count: {
      emailLogs: 0
    },
    ...overrides
  }),

  createEmailLog: (overrides: any = {}) => ({
    id: 'test-log-' + Math.random().toString(36).substr(2, 9),
    templateId: 'test-template-id',
    companyId: 'test-company-id',
    invoiceId: 'test-invoice-id',
    customerId: 'test-customer-id',
    recipientEmail: 'test@example.com',
    recipientName: 'Test Recipient',
    subject: 'Test Email',
    content: 'Test email content',
    language: 'ENGLISH',
    deliveryStatus: 'SENT',
    sentAt: new Date(),
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    uaeSendTime: new Date(),
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createCompany: (overrides: any = {}) => ({
    id: 'test-company-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Company LLC',
    trn: '100123456789012',
    address: 'Dubai, UAE',
    settings: {
      defaultCurrency: 'AED',
      vatRate: 5.0
    },
    emailSettings: {
      fromName: 'Test Company',
      fromEmail: 'noreply@testcompany.ae',
      supportEmail: 'support@testcompany.ae'
    },
    businessHours: {
      timezone: 'Asia/Dubai',
      workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
      startTime: '09:00',
      endTime: '18:00'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createUser: (overrides: any = {}) => ({
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    email: 'test@example.com',
    name: 'Test User',
    companyId: 'test-company-id',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createCustomer: (overrides: any = {}) => ({
    id: 'test-customer-' + Math.random().toString(36).substr(2, 9),
    companyId: 'test-company-id',
    name: 'John Smith',
    nameAr: 'جون سميث',
    email: 'john@example.com',
    phone: '+971501234567',
    paymentTerms: 30,
    notes: 'VIP customer',
    notesAr: 'عميل مهم',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createInvoice: (overrides: any = {}) => ({
    id: 'test-invoice-' + Math.random().toString(36).substr(2, 9),
    companyId: 'test-company-id',
    number: 'INV-001',
    customerName: 'John Smith',
    customerEmail: 'john@example.com',
    amount: 1000.00,
    subtotal: 952.38,
    vatAmount: 47.62,
    totalAmount: 1000.00,
    currency: 'AED',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'SENT',
    description: 'Test invoice',
    descriptionAr: 'فاتورة تجريبية',
    trnNumber: '100123456789012',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
}

// Specialized setup functions for different test scenarios
export const testScenarios = {
  // Setup for testing email template CRUD operations
  emailTemplateCRUD: () => {
    const db = initTestDatabase()
    
    const templates = [
      testDataFactories.createEmailTemplate({
        name: 'Gentle Reminder',
        templateType: 'FOLLOW_UP',
        isDefault: true
      }),
      testDataFactories.createEmailTemplate({
        name: 'Professional Follow-up',
        templateType: 'FOLLOW_UP',
        isDefault: false
      })
    ]

    db.setupEmailTemplateListing(templates)
    return { db, templates }
  },

  // Setup for testing bilingual templates
  bilingualTemplates: () => {
    const db = initTestDatabase()
    
    const bilingualTemplate = testDataFactories.createEmailTemplate({
      name: 'Bilingual Template',
      subjectEn: 'Payment Reminder - Invoice {{invoice_number}}',
      subjectAr: 'تذكير بالدفع - فاتورة {{invoice_number}}',
      contentEn: 'Dear {{customer_name}}, please pay invoice {{invoice_number}}. TRN: {{company_trn}}',
      contentAr: 'عزيزي {{customer_name_ar}}، يرجى دفع الفاتورة رقم {{invoice_number}}. الرقم الضريبي: {{company_trn}}'
    })

    db.setupEmailTemplateCreation(bilingualTemplate)
    return { db, bilingualTemplate }
  },

  // Setup for testing UAE business compliance
  uaeCompliance: () => {
    const db = initTestDatabase()
    
    const uaeTemplate = testDataFactories.createEmailTemplate({
      name: 'UAE Business Template',
      uaeBusinessHoursOnly: true,
      contentEn: `Dear {{customer_name}},
        
We hope this email finds you well during UAE business hours.
Please contact us during our working hours (Sunday - Thursday, 9 AM - 6 PM).

Best regards,
{{company_name}}
TRN: {{company_trn}}`,
      contentAr: `عزيزي {{customer_name_ar}}،

نأمل أن يصلك هذا البريد خلال ساعات العمل في الإمارات.
يرجى الاتصال بنا خلال ساعات العمل (الأحد - الخميس، 9 ص - 6 م).

أطيب التحيات،
{{company_name}}
الرقم الضريبي: {{company_trn}}`
    })

    db.setupEmailTemplateCreation(uaeTemplate)
    return { db, uaeTemplate }
  },

  // Setup for testing error scenarios
  errorScenarios: () => {
    const db = initTestDatabase()
    
    const errors = {
      validationError: new Error('Template validation failed'),
      duplicateError: new Error('Template with this name already exists'),
      authError: new Error('Unauthorized access'),
      dbError: new Error('Database connection failed')
    }

    return { db, errors }
  }
}

export default {
  initTestDatabase,
  cleanupTestDatabase,
  setupTestDatabase,
  testDataFactories,
  testScenarios,
  MockPrismaClient
}