import { GET, PUT, DELETE } from '../route'
import { 
  createNextRequest, 
  setupEmailTemplateTests, 
  validateEmailTemplateData,
  testDataGenerators,
  testAssertions
} from '@/lib/api-test-utils'
import { testDataFactories } from '@/lib/test-db-setup'
import { uaeTestDataGenerators, templateValidationUtils } from '@/lib/uae-test-utils'

// Mock dependencies
jest.mock('@/lib/auth-utils')
jest.mock('@/lib/prisma')
jest.mock('@/lib/email-service')

describe('/api/email/templates/[id] API Routes', () => {
  let authContext: any
  let mockPrisma: any

  beforeEach(() => {
    const setup = setupEmailTemplateTests()
    authContext = setup.authContext
    mockPrisma = setup.prisma
  })

  describe('GET /api/email/templates/[id]', () => {
    it('returns email template by id', async () => {
      const template = testDataFactories.createEmailTemplate()
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates/test-id')

      const response = await GET(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      validateEmailTemplateData(data.data)
      expect(data.data.id).toBe(template.id)
    })

    it('includes full content without truncation', async () => {
      const longContent = 'A'.repeat(500)
      const template = testDataFactories.createEmailTemplate({ 
        contentEn: longContent,
        contentAr: 'ب'.repeat(500)
      })
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates/test-id')

      const response = await GET(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.contentEn).toHaveLength(500) // Full content, not truncated
      expect(data.data.contentAr).toHaveLength(500)
    })

    it('includes usage statistics', async () => {
      const template = testDataFactories.createEmailTemplate()
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)
      
      // Mock usage statistics
      mockPrisma.emailLog.count
        .mockResolvedValueOnce(50)  // Total usage
        .mockResolvedValueOnce(25)  // Last 30 days sent
        .mockResolvedValueOnce(20)  // Delivered
        .mockResolvedValueOnce(8)   // Opened
        .mockResolvedValueOnce(3)   // Clicked

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates/test-id')

      const response = await GET(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.usage).toEqual({
        totalSent: 50,
        last30Days: {
          sent: 25,
          delivered: 20,
          opened: 8,
          clicked: 3,
          openRate: 40,
          clickRate: 15
        }
      })
    })

    it('returns 404 for non-existent template', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates/non-existent')

      const response = await GET(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template not found')
      expect(response.status).toBe(404)
    })

    it('enforces company isolation', async () => {
      const template = testDataFactories.createEmailTemplate({ 
        companyId: 'different-company-id' 
      })
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates/test-id')

      const response = await GET(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template not found')
    })

    it('requires authentication', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Unauthorized'))

      const request = createNextRequest('GET', 'http://localhost:3000/api/email/templates/test-id')

      const response = await GET(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(data.success).toBe(false)
    })
  })

  describe('PUT /api/email/templates/[id]', () => {
    it('updates email template successfully', async () => {
      const existingTemplate = testDataFactories.createEmailTemplate()
      const updateData = {
        name: 'Updated Template Name',
        subjectEn: 'Updated Subject {{customer_name}}',
        contentEn: 'Updated content with TRN: {{company_trn}}'
      }
      const updatedTemplate = { ...existingTemplate, ...updateData }

      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existingTemplate)
      mockPrisma.emailTemplate.update.mockResolvedValue(updatedTemplate)
      mockPrisma.activity.create.mockResolvedValue({ id: 'activity-id' })

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.name).toBe(updateData.name)
      expect(data.data.subjectEn).toBe(updateData.subjectEn)
    })

    it('updates only provided fields', async () => {
      const existingTemplate = testDataFactories.createEmailTemplate()
      const partialUpdate = { name: 'New Name Only' }
      const updatedTemplate = { ...existingTemplate, ...partialUpdate }

      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existingTemplate)
      mockPrisma.emailTemplate.update.mockResolvedValue(updatedTemplate)

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: partialUpdate
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(data.data.name).toBe(partialUpdate.name)
      expect(data.data.subjectEn).toBe(existingTemplate.subjectEn) // Unchanged
    })

    it('handles default template switching', async () => {
      const existingTemplate = testDataFactories.createEmailTemplate({ 
        isDefault: false,
        templateType: 'FOLLOW_UP'
      })
      const updateData = { isDefault: true }
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existingTemplate)
      mockPrisma.emailTemplate.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.emailTemplate.update.mockResolvedValue({ 
        ...existingTemplate, 
        ...updateData 
      })

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      
      // Should have unset other default templates
      expect(mockPrisma.emailTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: authContext.user.companiesId,
          templateType: 'FOLLOW_UP',
          isDefault: true,
          id: { not: 'test-id' }
        },
        data: { isDefault: false }
      })
    })

    it('validates updated content', async () => {
      const { validateEmailTemplate } = require('@/lib/email-service')
      validateEmailTemplate.mockReturnValue(['Invalid variable syntax'])

      const existingTemplate = testDataFactories.createEmailTemplate()
      const updateData = { contentEn: 'Invalid {{incomplete_variable' }

      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existingTemplate)

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template validation failed')
    })

    it('creates activity log for updates', async () => {
      const existingTemplate = testDataFactories.createEmailTemplate()
      const updateData = { name: 'Updated Name' }
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existingTemplate)
      mockPrisma.emailTemplate.update.mockResolvedValue({ 
        ...existingTemplate, 
        ...updateData 
      })
      mockPrisma.activity.create.mockResolvedValue({ id: 'activity-id' })

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      await PUT(request, { params: { id: 'test-id' } })

      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'email_template_updated',
          description: `Updated email template: ${updateData.name}`,
          metadata: expect.objectContaining({
            templateId: 'test-id',
            changes: Object.keys(updateData)
          })
        })
      })
    })

    it('requires admin or finance role', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Insufficient permissions'))

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: { name: 'New Name' }
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(data.success).toBe(false)
    })

    it('returns 404 for non-existent template', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null)

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/non-existent', {
        body: { name: 'New Name' }
      })

      const response = await PUT(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template not found')
      expect(response.status).toBe(404)
    })

    it('enforces company isolation for updates', async () => {
      const template = testDataFactories.createEmailTemplate({ 
        companyId: 'different-company-id' 
      })
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: { name: 'New Name' }
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template not found')
    })
  })

  describe('DELETE /api/email/templates/[id]', () => {
    it('deletes email template successfully', async () => {
      const template = testDataFactories.createEmailTemplate()
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.emailTemplate.delete.mockResolvedValue(template)
      mockPrisma.activity.create.mockResolvedValue({ id: 'activity-id' })

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/test-id')

      const response = await DELETE(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      expect(mockPrisma.emailTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      })
    })

    it('prevents deletion of templates with sent emails', async () => {
      const template = testDataFactories.createEmailTemplate()
      const sentEmails = [testDataFactories.createEmailLog()]
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.emailLog.findFirst.mockResolvedValue(sentEmails[0])

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/test-id')

      const response = await DELETE(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Cannot delete template with sent emails')
    })

    it('prevents deletion of default templates', async () => {
      const defaultTemplate = testDataFactories.createEmailTemplate({ isDefault: true })
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(defaultTemplate)
      mockPrisma.emailLog.findFirst.mockResolvedValue(null)

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/test-id')

      const response = await DELETE(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Cannot delete default template')
    })

    it('creates activity log for deletion', async () => {
      const template = testDataFactories.createEmailTemplate()
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.emailLog.findFirst.mockResolvedValue(null)
      mockPrisma.emailTemplate.delete.mockResolvedValue(template)
      mockPrisma.activity.create.mockResolvedValue({ id: 'activity-id' })

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/test-id')

      await DELETE(request, { params: { id: 'test-id' } })

      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'email_template_deleted',
          description: `Deleted email template: ${template.name}`,
          metadata: expect.objectContaining({
            templateId: 'test-id',
            templateName: template.name,
            templateType: template.templateType
          })
        })
      })
    })

    it('requires admin role for deletion', async () => {
      const { requireRole } = require('@/lib/auth-utils')
      requireRole.mockRejectedValue(new Error('Insufficient permissions'))

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/test-id')

      const response = await DELETE(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(data.success).toBe(false)
    })

    it('returns 404 for non-existent template', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null)

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/non-existent')

      const response = await DELETE(request, { params: { id: 'non-existent' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template not found')
      expect(response.status).toBe(404)
    })

    it('enforces company isolation for deletion', async () => {
      const template = testDataFactories.createEmailTemplate({ 
        companyId: 'different-company-id' 
      })
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('DELETE', 'http://localhost:3000/api/email/templates/test-id')

      const response = await DELETE(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data, 'Template not found')
    })
  })

  describe('UAE Cultural Compliance Validation', () => {
    it('validates UAE compliance during updates', async () => {
      const existingTemplate = testDataFactories.createEmailTemplate()
      const updateData = uaeTestDataGenerators.createUAEBusinessTemplate()
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existingTemplate)
      mockPrisma.emailTemplate.update.mockResolvedValue({ 
        ...existingTemplate, 
        ...updateData 
      })

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      testAssertions.expectUAECompliance(data.data)
    })

    it('rejects culturally inappropriate updates', async () => {
      const existingTemplate = testDataFactories.createEmailTemplate()
      const inappropriateUpdate = {
        subjectEn: 'HEY!!! PAY NOW!!!',
        contentEn: 'You MUST pay immediately without any excuses!'
      }
      
      const validation = templateValidationUtils.validateUAETemplate({
        ...existingTemplate,
        ...inappropriateUpdate
      })
      
      expect(validation.appropriate).toBe(false)
      expect(validation.score).toBeLessThan(70)
    })

    it('preserves bilingual integrity during updates', async () => {
      const bilingualTemplate = testDataFactories.createEmailTemplate({
        subjectEn: 'Payment Reminder',
        subjectAr: 'تذكير بالدفع',
        contentEn: 'Dear customer, TRN: {{company_trn}}',
        contentAr: 'عزيزي العميل، الرقم الضريبي: {{company_trn}}'
      })
      
      const updateData = { subjectEn: 'Updated Payment Reminder' }
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(bilingualTemplate)
      mockPrisma.emailTemplate.update.mockResolvedValue({ 
        ...bilingualTemplate, 
        ...updateData 
      })

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectSuccessResponse(data)
      testAssertions.expectBilingualTemplate(data.data)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles concurrent updates gracefully', async () => {
      const template = testDataFactories.createEmailTemplate()
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.emailTemplate.update.mockRejectedValue(
        new Error('The record you are trying to update has been modified by another user')
      )

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: { name: 'Updated Name' }
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })

    it('validates template variable consistency', async () => {
      const template = testDataFactories.createEmailTemplate()
      const updateData = {
        contentEn: 'Hello {{customer_name}}, please pay {{invoice_amount}}',
        contentAr: 'مرحباً {{customer_name_ar}}' // Missing invoice_amount in Arabic
      }
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      // Should still succeed but could include warnings
      testAssertions.expectSuccessResponse(data)
    })

    it('handles database constraint violations', async () => {
      const template = testDataFactories.createEmailTemplate()
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.emailTemplate.update.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`companyId`,`name`,`version`)')
      )

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: { name: 'Duplicate Name' }
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      testAssertions.expectErrorResponse(data)
    })

    it('validates maximum content length', async () => {
      const template = testDataFactories.createEmailTemplate()
      const massiveContent = 'A'.repeat(100000) // Very large content
      
      const updateData = { contentEn: massiveContent }
      
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template)

      const request = createNextRequest('PUT', 'http://localhost:3000/api/email/templates/test-id', {
        body: updateData
      })

      const response = await PUT(request, { params: { id: 'test-id' } })
      const data = await response.json()

      // Should handle large content appropriately
      expect(response.status).toBeLessThan(500)
    })
  })
})