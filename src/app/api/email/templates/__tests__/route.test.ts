import { GET, POST } from '../route'
import { 
  createNextRequest, 
  setupEmailTemplateTests, 
  validateAPIResponse,
  validateEmailTemplateData,
  validateBilingualTemplate,
  testDataGenerators,
  testAssertions
} from '@/lib/api-test-utils'
import { testDataFactories, testScenarios } from '@/lib/test-db-setup'
import { uaeTestDataGenerators, templateValidationUtils } from '@/lib/uae-test-utils'

// Mock dependencies
jest.mock('@/lib/auth-utils')
jest.mock('@/lib/prisma')
jest.mock('@/lib/email-service')

describe('/api/email/templates API Routes', () => {
  let authContext: any
  let mockPrisma: any

  beforeEach(() => {
    const setup = setupEmailTemplateTests()
    authContext = setup.authContext
    mockPrisma = setup.prisma
  })

  describe('GET /api/email/templates', () => {
    it('returns paginated list of email templates', async () => {
      const { db, templates } = testScenarios.emailTemplateCRUD()
      
      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates', {
        searchParams: { page: '1', limit: '10' }
      })

      const response = await GET(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.templates).toHaveLength(2)
      expect(data.data.totalCount).toBe(2)
      expect(data.data.page).toBe(1)
      expect(data.data.limit).toBe(10)
      
      data.data.templates.forEach((template: any) => {
        validateEmailTemplateData(template)
      })
    })

    it('filters templates by type', async () => {
      const templates = [
        testDataFactories.createEmailTemplate({ templateType: 'FOLLOW_UP' }),
        testDataFactories.createEmailTemplate({ templateType: 'WELCOME' })
      ]
      mockPrisma.emailTemplate.findMany.mockResolvedValue([templates[0]])
      mockPrisma.emailTemplate.count.mockResolvedValue(1)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates', {
        searchParams: { templateType: 'FOLLOW_UP' }
      })

      const response = await GET(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.templates).toHaveLength(1)
      expect(data.data.templates[0].templateType).toBe('FOLLOW_UP')
    })

    it('filters templates by active status', async () => {
      const activeTemplate = testDataFactories.createEmailTemplate({ isActive: true })
      mockPrisma.emailTemplate.findMany.mockResolvedValue([activeTemplate])
      mockPrisma.emailTemplate.count.mockResolvedValue(1)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates', {
        searchParams: { isActive: 'true' }
      })

      const response = await GET(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.templates[0].isActive).toBe(true)
    })

    it('includes usage statistics for templates', async () => {
      const template = testDataFactories.createEmailTemplate()
      mockPrisma.emailTemplate.findMany.mockResolvedValue([template])
      mockPrisma.emailTemplate.count.mockResolvedValue(1)
      
      // Mock email log counts for statistics
      mockPrisma.emailLog.count
        .mockResolvedValueOnce(25)  // Total usage
        .mockResolvedValueOnce(15)  // Last 30 days sent
        .mockResolvedValueOnce(12)  // Delivered
        .mockResolvedValueOnce(5)   // Opened

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates')

      const response = await GET(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.templates[0].usage).toBeDefined()
      expect(data.data.templates[0].usage.totalSent).toBe(25)
      expect(data.data.templates[0].usage.last30Days.sent).toBe(15)
      expect(data.data.templates[0].usage.last30Days.openRate).toBeCloseTo(41.67, 2)
    })

    it('truncates long content in list view', async () => {
      const longContent = 'A'.repeat(300) // Content longer than 200 characters
      const template = testDataFactories.createEmailTemplate({ 
        contentEn: longContent,
        contentAr: 'ب'.repeat(300)
      })
      mockPrisma.emailTemplate.findMany.mockResolvedValue([template])
      mockPrisma.emailTemplate.count.mockResolvedValue(1)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates')

      const response = await GET(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.templates[0].contentEn).toHaveLength(203) // 200 + '...'
      expect(data.data.templates[0].contentEn.endsWith('...')).toBe(true)
    })

    it('provides summary statistics', async () => {
      const templates = [
        testDataFactories.createEmailTemplate({ isActive: true, isDefault: true, templateType: 'FOLLOW_UP' }),
        testDataFactories.createEmailTemplate({ isActive: false, isDefault: false, templateType: 'WELCOME' }),
        testDataFactories.createEmailTemplate({ isActive: true, isDefault: false, templateType: 'FOLLOW_UP' })
      ]
      mockPrisma.emailTemplate.findMany.mockResolvedValue(templates)
      mockPrisma.emailTemplate.count.mockResolvedValue(3)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates')

      const response = await GET(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.summary).toEqual({
        total: 3,
        active: 2,
        inactive: 1,
        defaultTemplates: 1,
        byType: {
          FOLLOW_UP: 2,
          WELCOME: 1
        }
      })
    })

    it('requires authentication', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Unauthorized'))

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates')

      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(false)
    })

    it('respects company isolation', async () => {
      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates')

      await GET(request)

      expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: authContext.user.companyId
          })
        })
      )
    })
  })

  describe('POST /api/email/templates', () => {
    it('creates new email template successfully', async () => {
      const templateData = testDataGenerators.createTemplateData()
      const createdTemplate = testDataFactories.createEmailTemplate(templateData)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null) // No existing template
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)
      mockPrisma.activity.create.mockResolvedValue({ id: 'activity-id' })

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      validateEmailTemplateData(data.data)
      expect(data.data.name).toBe(templateData.name)
      expect(data.data.companyId).toBe(authContext.user.companyId)
      expect(data.data.createdBy).toBe(authContext.user.id)
    })

    it('creates bilingual template with Arabic content', async () => {
      const bilingualData = testDataGenerators.createArabicTemplate()
      const createdTemplate = testDataFactories.createEmailTemplate(bilingualData)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: bilingualData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      validateBilingualTemplate(data.data)
      testAssertions.expectBilingualTemplate(data.data)
    })

    it('creates UAE business compliant template', async () => {
      const uaeTemplate = uaeTestDataGenerators.createUAEBusinessTemplate()
      const createdTemplate = testDataFactories.createEmailTemplate(uaeTemplate)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: uaeTemplate
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      testAssertions.expectUAECompliance(data.data)
      
      const validation = templateValidationUtils.validateUAETemplate(data.data)
      expect(validation.valid).toBe(true)
      expect(validation.score).toBeGreaterThan(80)
    })

    it('validates required fields', async () => {
      const invalidData = testDataGenerators.createInvalidTemplateData('name')

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: invalidData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })

    it('prevents duplicate template names within company', async () => {
      const templateData = testDataGenerators.createTemplateData()
      const existingTemplate = testDataFactories.createEmailTemplate(templateData)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(existingTemplate)

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template with this name already exists')
    })

    it('unsets other default templates when creating new default', async () => {
      const templateData = testDataGenerators.createTemplateData({ 
        isDefault: true,
        templateType: 'FOLLOW_UP'
      })
      const createdTemplate = testDataFactories.createEmailTemplate(templateData)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)
      mockPrisma.emailTemplate.updateMany.mockResolvedValue({ count: 1 })

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      
      // Should have updated other templates to not be default
      expect(mockPrisma.emailTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: authContext.user.companyId,
          templateType: 'FOLLOW_UP',
          isDefault: true
        },
        data: { isDefault: false }
      })
    })

    it('enforces company id from auth context', async () => {
      const templateData = testDataGenerators.createTemplateData({ 
        companyId: 'different-company-id' // Should be overridden
      })
      const createdTemplate = testDataFactories.createEmailTemplate({
        ...templateData,
        companyId: authContext.user.companyId
      })
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.companyId).toBe(authContext.user.companyId)
    })

    it('validates email template content', async () => {
      const { validateEmailTemplate } = require('@/lib/email-service')
      validateEmailTemplate.mockReturnValue(['Missing required variable'])

      const templateData = testDataGenerators.createTemplateData()

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template validation failed')
    })

    it('creates activity log for template creation', async () => {
      const templateData = testDataGenerators.createTemplateData()
      const createdTemplate = testDataFactories.createEmailTemplate(templateData)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)
      mockPrisma.activity.create.mockResolvedValue({ id: 'activity-id' })

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      await POST(request)

      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: authContext.user.companyId,
          userId: authContext.user.id,
          type: 'email_template_created',
          description: `Created email template: ${templateData.name}`,
          metadata: expect.objectContaining({
            templateId: createdTemplate.id,
            templateType: createdTemplate.templateType,
            isDefault: createdTemplate.isDefault,
            hasArabicContent: true
          })
        })
      })
    })

    it('sets default values for optional fields', async () => {
      const minimalData = {
        name: 'Minimal Template',
        templateType: 'FOLLOW_UP',
        subjectEn: 'Test Subject',
        contentEn: 'Test Content with TRN: {{company_trn}}',
        subjectAr: 'موضوع تجريبي',
        contentAr: 'محتوى تجريبي مع الرقم الضريبي: {{company_trn}}',
        companyId: authContext.user.companyId
      }
      
      const createdTemplate = testDataFactories.createEmailTemplate(minimalData)
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: minimalData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.version).toBe(1)
      expect(data.data.isActive).toBe(true)
      expect(data.data.uaeBusinessHoursOnly).toBe(true)
    })

    it('requires admin or finance role', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Insufficient permissions'))

      const templateData = testDataGenerators.createTemplateData()

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
    })

    it('handles database errors gracefully', async () => {
      const templateData = testDataGenerators.createTemplateData()
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockRejectedValue(new Error('Database error'))

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })
  })

  describe('UAE Cultural Compliance Tests', () => {
    it('validates culturally appropriate content', async () => {
      const appropriateTemplate = uaeTestDataGenerators.createUAEBusinessTemplate()
      const validation = templateValidationUtils.validateUAETemplate(appropriateTemplate)
      
      expect(validation.valid).toBe(true)
      expect(validation.score).toBeGreaterThan(80)
      expect(validation.issues).toHaveLength(0)
    })

    it('rejects culturally inappropriate content', async () => {
      const inappropriateTemplate = uaeTestDataGenerators.createInappropriateTemplate()
      const validation = templateValidationUtils.validateUAETemplate(inappropriateTemplate)
      
      expect(validation.valid).toBe(false)
      expect(validation.score).toBeLessThan(70)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.recommendations.length).toBeGreaterThan(0)
    })

    it('requires TRN reference in business templates', async () => {
      const templateWithoutTrn = testDataGenerators.createTemplateData({
        contentEn: 'Dear {{customer_name}}, please pay your invoice.',
        contentAr: 'عزيزي {{customer_name_ar}}، يرجى دفع فاتورتك.'
      })
      
      const validation = templateValidationUtils.validateUAETemplate(templateWithoutTrn)
      expect(validation.recommendations).toContain('Include TRN reference for UAE compliance')
    })

    it('validates Arabic content quality', async () => {
      const arabicTemplate = testDataGenerators.createArabicTemplate()
      const validation = templateValidationUtils.validateUAETemplate(arabicTemplate)
      
      expect(validation.valid).toBe(true)
      expect(validation.recommendations).not.toContain('Add Arabic translations for better customer experience')
    })

    it('enforces UAE business hours setting', async () => {
      const templateData = testDataGenerators.createTemplateData({ 
        uaeBusinessHoursOnly: false 
      })
      
      const validation = templateValidationUtils.validateUAETemplate(templateData)
      expect(validation.recommendations).toContain('Enable UAE business hours only for better customer experience')
    })
  })

  describe('Error Scenarios', () => {
    it('handles invalid JSON gracefully', async () => {
      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })

    it('handles missing request body', async () => {
      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates')

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })

    it('handles Prisma connection errors', async () => {
      mockPrisma.emailTemplate.findFirst.mockRejectedValue(new Error('Connection timeout'))

      const templateData = testDataGenerators.createTemplateData()
      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: templateData
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })
  })

  describe('Integration with UAE Business Features', () => {
    it('creates Ramadan-appropriate template', async () => {
      const ramadanTemplate = uaeTestDataGenerators.createRamadanTemplate()
      const createdTemplate = testDataFactories.createEmailTemplate(ramadanTemplate)
      
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.create.mockResolvedValue(createdTemplate)

      const request = createNextRequest('POST', 'http://localhost:3000/api/email/templates', {
        body: ramadanTemplate
      })

      const response = await POST(request)
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.contentEn).toContain('Ramadan Kareem')
      expect(data.data.contentAr).toContain('رمضان كريم')
      expect(data.data.uaeBusinessHoursOnly).toBe(true)
    })

    it('validates business greeting templates', async () => {
      const businessTemplate = uaeTestDataGenerators.createUAEBusinessTemplate()
      
      expect(businessTemplate.contentEn).toContain('Assalamu Alaikum')
      expect(businessTemplate.contentAr).toContain('السلام عليكم')
      
      const validation = templateValidationUtils.validateUAETemplate(businessTemplate)
      expect(validation.valid).toBe(true)
    })

    it('supports multiple emirates and regional variations', async () => {
      const dubaiTemplate = testDataGenerators.createTemplateData({
        name: 'Dubai Business Template',
        contentEn: 'Greetings from Dubai, UAE business hours are Sunday-Thursday 9 AM to 6 PM',
        contentAr: 'تحيات من دبي، ساعات العمل في الإمارات من الأحد إلى الخميس من 9 ص إلى 6 م'
      })
      
      const validation = templateValidationUtils.validateUAETemplate(dubaiTemplate)
      expect(validation.valid).toBe(true)
    })
  })
})