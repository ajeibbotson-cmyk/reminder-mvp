import { NextRequest } from 'next/server'
import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'
import { mockPrisma, mockSessionWithCompany, mockCompanyData } from './test-utils'

// Mock NextAuth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

// Mock auth utilities
jest.mock('@/lib/auth-utils', () => ({
  requireRole: jest.fn(),
  getAuthContext: jest.fn()
}))

// Types for API testing
export interface APITestRequest extends Partial<NextApiRequest> {
  method?: string
  url?: string
  body?: any
  query?: Record<string, string | string[]>
  headers?: Record<string, string>
}

export interface APITestResponse extends NextApiResponse {
  _getData(): any
  _getStatusCode(): number
  _getHeaders(): Record<string, string>
}

// Create mock Next.js API request/response
export function createAPITestRequest(options: APITestRequest = {}) {
  const { req, res } = createMocks<NextApiRequest, APITestResponse>({
    method: 'GET',
    url: '/api/test',
    ...options
  })

  return { req, res }
}

// Create NextRequest for App Router API routes
export function createNextRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/test',
  options: {
    body?: any
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { body, headers = {}, searchParams = {} } = options

  // Build URL with search params
  const testUrl = new URL(url)
  Object.entries(searchParams).forEach(([key, value]) => {
    testUrl.searchParams.set(key, value)
  })

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  return new NextRequest(testUrl.toString(), requestInit)
}

// Mock authenticated context
export const mockAuthContext = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    companyId: 'test-company-id',
    role: 'ADMIN'
  },
  session: mockSessionWithCompany
}

// Setup mock auth for tests
export function setupMockAuth(authContext = mockAuthContext) {
  const { requireRole, getAuthContext } = require('@/lib/auth-utils')
  
  requireRole.mockImplementation(async () => authContext)
  getAuthContext.mockImplementation(async () => authContext)
  
  return authContext
}

// Setup mock Prisma for email templates
export function setupMockPrisma() {
  // Reset all mocks
  Object.values(mockPrisma).forEach(model => {
    Object.values(model).forEach(method => {
      if (jest.isMockFunction(method)) {
        method.mockReset()
      }
    })
  })

  // Setup default company mock
  mockPrisma.company.findUnique.mockResolvedValue(mockCompanyData)
  mockPrisma.company.findFirst.mockResolvedValue(mockCompanyData)

  return mockPrisma
}

// Specific setup for email template tests
export function setupEmailTemplateTests() {
  const authContext = setupMockAuth()
  const prisma = setupMockPrisma()
  
  return { authContext, prisma }
}

// Validate API response structure
export function validateAPIResponse(response: any) {
  expect(response).toHaveProperty('success')
  
  if (response.success) {
    expect(response).toHaveProperty('data')
    if (response.message) {
      expect(typeof response.message).toBe('string')
    }
  } else {
    expect(response).toHaveProperty('error')
    expect(response.error).toHaveProperty('message')
  }
}

// Validate email template data structure
export function validateEmailTemplateData(template: any) {
  expect(template).toHaveProperty('id')
  expect(template).toHaveProperty('companyId')
  expect(template).toHaveProperty('name')
  expect(template).toHaveProperty('templateType')
  expect(template).toHaveProperty('subjectEn')
  expect(template).toHaveProperty('contentEn')
  expect(template).toHaveProperty('isActive')
  expect(template).toHaveProperty('createdAt')
  expect(template).toHaveProperty('updatedAt')
  
  // Optional Arabic fields
  if (template.subjectAr) {
    expect(typeof template.subjectAr).toBe('string')
  }
  if (template.contentAr) {
    expect(typeof template.contentAr).toBe('string')
  }
  
  // UAE-specific fields
  expect(template).toHaveProperty('uaeBusinessHoursOnly')
  expect(typeof template.uaeBusinessHoursOnly).toBe('boolean')
}

// Validate bilingual template content
export function validateBilingualTemplate(template: any) {
  validateEmailTemplateData(template)
  
  // Check for Arabic content
  expect(template.subjectAr).toBeDefined()
  expect(template.contentAr).toBeDefined()
  expect(template.subjectAr.length).toBeGreaterThan(0)
  expect(template.contentAr.length).toBeGreaterThan(0)
  
  // Check for Arabic characters
  const arabicRegex = /[\u0600-\u06FF]/
  expect(arabicRegex.test(template.subjectAr)).toBe(true)
  expect(arabicRegex.test(template.contentAr)).toBe(true)
}

// Validate UAE business compliance
export function validateUAECompliance(content: string) {
  // Should contain TRN reference
  expect(content).toMatch(/TRN[:\s]*\{\{company_trn\}\}/i)
  
  // Should contain appropriate business language
  const businessPatterns = [
    /business hours?/i,
    /working hours?/i,
    /UAE/i,
    /emirates?/i
  ]
  
  const hasBusinessLanguage = businessPatterns.some(pattern => pattern.test(content))
  expect(hasBusinessLanguage).toBe(true)
}

// Test template variables
export function validateTemplateVariables(content: string, expectedVariables: string[]) {
  expectedVariables.forEach(variable => {
    const variablePattern = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`)
    expect(content).toMatch(variablePattern)
  })
}

// Mock email service functions
export const mockEmailService = {
  validateEmailTemplate: jest.fn(),
  sendEmail: jest.fn(),
  generatePreview: jest.fn(),
  checkBusinessHours: jest.fn(),
  renderTemplate: jest.fn()
}

// Setup email service mocks
export function setupMockEmailService() {
  jest.mock('@/lib/email-service', () => mockEmailService)
  
  // Default implementations
  mockEmailService.validateEmailTemplate.mockReturnValue([])
  mockEmailService.checkBusinessHours.mockReturnValue(true)
  mockEmailService.renderTemplate.mockImplementation((template, variables) => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match)
  })
  
  return mockEmailService
}

// Test data generators
export const testDataGenerators = {
  createTemplateData: (overrides: any = {}) => ({
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
    isActive: true,
    isDefault: false,
    uaeBusinessHoursOnly: true,
    companyId: 'test-company-id',
    ...overrides
  }),

  createInvalidTemplateData: (field: string) => {
    const base = testDataGenerators.createTemplateData()
    return {
      ...base,
      [field]: field === 'name' ? '' : undefined
    }
  },

  createArabicTemplate: () => testDataGenerators.createTemplateData({
    name: 'Arabic Template',
    subjectEn: 'Payment Reminder - Invoice {{invoice_number}}',
    subjectAr: 'تذكير بالدفع - فاتورة {{invoice_number}}',
    contentEn: 'Dear {{customer_name}}, please pay invoice {{invoice_number}} for {{invoice_amount}} AED. TRN: {{company_trn}}',
    contentAr: 'عزيزي {{customer_name_ar}}، يرجى دفع الفاتورة رقم {{invoice_number}} بمبلغ {{invoice_amount}} درهم. الرقم الضريبي: {{company_trn}}'
  }),

  createUAEBusinessTemplate: () => testDataGenerators.createTemplateData({
    name: 'UAE Business Template',
    subjectEn: 'Business Communication - {{company_name}}',
    subjectAr: 'تواصل تجاري - {{company_name}}',
    contentEn: `Dear {{customer_name}},

We hope this email finds you well during UAE business hours (Sunday - Thursday, 9 AM - 6 PM).

Please contact us during our working hours for any assistance.

Best regards,
{{company_name}}
TRN: {{company_trn}}
Phone: {{contact_phone}}`,
    contentAr: `عزيزي {{customer_name_ar}}،

نأمل أن يصلك هذا البريد خلال ساعات العمل في الإمارات (الأحد - الخميس، 9 ص - 6 م).

يرجى الاتصال بنا خلال ساعات العمل للحصول على أي مساعدة.

أطيب التحيات،
{{company_name}}
الرقم الضريبي: {{company_trn}}
الهاتف: {{contact_phone}}`
  })
}

// Test assertion helpers
export const testAssertions = {
  // Assert successful API response
  expectSuccessResponse: (response: any, expectedData?: any) => {
    expect(response.success).toBe(true)
    if (expectedData) {
      expect(response.data).toEqual(expect.objectContaining(expectedData))
    }
  },

  // Assert error API response
  expectErrorResponse: (response: any, expectedMessage?: string) => {
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
    if (expectedMessage) {
      expect(response.error.message).toContain(expectedMessage)
    }
  },

  // Assert template has bilingual support
  expectBilingualTemplate: (template: any) => {
    expect(template.subjectEn).toBeDefined()
    expect(template.subjectAr).toBeDefined()
    expect(template.contentEn).toBeDefined()
    expect(template.contentAr).toBeDefined()
    
    const arabicRegex = /[\u0600-\u06FF]/
    expect(arabicRegex.test(template.subjectAr)).toBe(true)
    expect(arabicRegex.test(template.contentAr)).toBe(true)
  },

  // Assert UAE business compliance
  expectUAECompliance: (template: any) => {
    expect(template.uaeBusinessHoursOnly).toBe(true)
    expect(template.contentEn).toMatch(/TRN/i)
    expect(template.contentAr).toMatch(/الرقم الضريبي|TRN/i)
  }
}

export default {
  createAPITestRequest,
  createNextRequest,
  setupMockAuth,
  setupMockPrisma,
  setupEmailTemplateTests,
  validateAPIResponse,
  validateEmailTemplateData,
  validateBilingualTemplate,
  validateUAECompliance,
  testDataGenerators,
  testAssertions
}