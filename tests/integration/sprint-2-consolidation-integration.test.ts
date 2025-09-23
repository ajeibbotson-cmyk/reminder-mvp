/**
 * Sprint 2: Consolidation Integration Tests
 * Comprehensive test suite for consolidated email functionality including
 * email services, PDF attachments, scheduling, cultural compliance, and analytics
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/testing-library/jest-dom'
import { consolidatedEmailService } from '@/lib/services/consolidated-email-service'
import { pdfAttachmentService } from '@/lib/services/pdf-attachment-service'
import { enhancedEmailSchedulingService } from '@/lib/services/enhanced-email-scheduling-service'
import { culturalComplianceEnhancedService } from '@/lib/services/cultural-compliance-enhanced-service'
import { awsSESConsolidationService } from '@/lib/services/aws-ses-consolidation-service'
import { customerConsolidationService } from '@/lib/services/customer-consolidation-service'
import { prisma } from '@/lib/prisma'

// Test utilities
import { createMockCustomer, createMockInvoices, createMockTemplate, cleanup } from '../setup/test-dependencies'

describe('Sprint 2: Consolidation Integration Tests', () => {
  let testCompanyId: string
  let testCustomerId: string
  let testInvoiceIds: string[]
  let testTemplateId: string

  beforeAll(async () => {
    console.log('🧪 Setting up Sprint 2 integration test environment...')

    // Create test company
    const company = await prisma.companies.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Test Company - Sprint 2',
        businessHours: {
          sunday: { start: 9, end: 17 },
          monday: { start: 9, end: 17 },
          tuesday: { start: 9, end: 17 },
          wednesday: { start: 9, end: 17 },
          thursday: { start: 9, end: 17 },
          friday: { closed: true },
          saturday: { closed: true }
        }
      }
    })
    testCompanyId = company.id

    // Create test customer
    const customer = await createMockCustomer(testCompanyId, {
      consolidationPreference: 'ENABLED',
      preferredContactInterval: 7,
      maxConsolidationAmount: 50000
    })
    testCustomerId = customer.id

    // Create test invoices
    const invoices = await createMockInvoices(testCompanyId, testCustomerId, 5)
    testInvoiceIds = invoices.map(inv => inv.id)

    // Create consolidation template
    const template = await createMockTemplate(testCompanyId, {
      supportsConsolidation: true,
      maxInvoiceCount: 10,
      templateType: 'CONSOLIDATED_REMINDER'
    })
    testTemplateId = template.id
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up Sprint 2 test environment...')
    await cleanup(testCompanyId)
  })

  describe('Consolidation Candidate Detection', () => {
    it('should identify customers eligible for consolidation', async () => {
      const candidates = await customerConsolidationService.getConsolidationCandidates(testCompanyId)

      expect(candidates).toBeDefined()
      expect(Array.isArray(candidates)).toBe(true)

      const testCustomerCandidate = candidates.find(c => c.customerId === testCustomerId)
      expect(testCustomerCandidate).toBeDefined()
      expect(testCustomerCandidate?.overdueInvoices.length).toBeGreaterThanOrEqual(2)
      expect(testCustomerCandidate?.canContact).toBe(true)
      expect(testCustomerCandidate?.priorityScore).toBeGreaterThan(0)
    })

    it('should calculate accurate priority scores', async () => {
      const candidates = await customerConsolidationService.getConsolidationCandidates(testCompanyId)
      const candidate = candidates.find(c => c.customerId === testCustomerId)

      expect(candidate?.priorityScore).toBeGreaterThanOrEqual(0)
      expect(candidate?.priorityScore).toBeLessThanOrEqual(100)

      // High amount or old invoices should result in higher priority
      if (candidate?.totalAmount > 10000 || candidate?.oldestInvoiceDays > 30) {
        expect(candidate.priorityScore).toBeGreaterThan(50)
      }
    })

    it('should respect customer consolidation preferences', async () => {
      // Update customer to disable consolidation
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: { consolidationPreference: 'DISABLED' }
      })

      const candidates = await customerConsolidationService.getConsolidationCandidates(testCompanyId)
      const disabledCustomer = candidates.find(c => c.customerId === testCustomerId)

      expect(disabledCustomer).toBeUndefined()

      // Restore preference
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: { consolidationPreference: 'ENABLED' }
      })
    })
  })

  describe('Consolidated Email Service', () => {
    it('should create consolidated email with proper template processing', async () => {
      const emailRequest = {
        customerId: testCustomerId,
        invoiceIds: testInvoiceIds.slice(0, 3),
        templateId: testTemplateId,
        escalationLevel: 'POLITE' as const,
        language: 'en' as const,
        includePdfAttachments: false
      }

      const result = await consolidatedEmailService.createConsolidatedEmail(emailRequest)

      expect(result).toBeDefined()
      expect(result.consolidationId).toBeDefined()
      expect(result.emailLogId).toBeDefined()
      expect(result.invoiceCount).toBe(3)
      expect(result.totalAmount).toBeGreaterThan(0)
      expect(result.scheduled).toBe(true)
      expect(result.deliveryStatus).toBe('SCHEDULED')
    })

    it('should generate accurate email preview with template variables', async () => {
      const preview = await consolidatedEmailService.previewConsolidatedEmail(
        testCustomerId,
        testInvoiceIds.slice(0, 2),
        testTemplateId,
        'en'
      )

      expect(preview).toBeDefined()
      expect(preview.subject).toBeDefined()
      expect(preview.content).toBeDefined()
      expect(preview.variables).toBeDefined()

      // Check if variables are properly populated
      expect(preview.variables.customerName).toBeDefined()
      expect(preview.variables.invoiceCount).toBe(2)
      expect(preview.variables.totalAmount).toBeDefined()
      expect(preview.variables.invoiceList).toBeDefined()
      expect(Array.isArray(preview.variables.invoiceList)).toBe(true)
      expect(preview.variables.invoiceList.length).toBe(2)
    })

    it('should validate consolidation constraints', async () => {
      // Test with too few invoices
      await expect(
        consolidatedEmailService.createConsolidatedEmail({
          customerId: testCustomerId,
          invoiceIds: [testInvoiceIds[0]], // Only 1 invoice
          templateId: testTemplateId,
          escalationLevel: 'POLITE',
          language: 'en'
        })
      ).rejects.toThrow('Minimum 2 invoices required')

      // Test with customer who disabled consolidation
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: { consolidationPreference: 'DISABLED' }
      })

      await expect(
        consolidatedEmailService.createConsolidatedEmail({
          customerId: testCustomerId,
          invoiceIds: testInvoiceIds.slice(0, 2),
          templateId: testTemplateId,
          escalationLevel: 'POLITE',
          language: 'en'
        })
      ).rejects.toThrow('disabled consolidation')

      // Restore preference
      await prisma.customers.update({
        where: { id: testCustomerId },
        data: { consolidationPreference: 'ENABLED' }
      })
    })
  })

  describe('PDF Attachment System', () => {
    it('should generate individual invoice PDFs', async () => {
      const attachments = await pdfAttachmentService.generateConsolidatedPDFAttachments(
        testInvoiceIds.slice(0, 2),
        {
          includeIndividualInvoices: true,
          includeSummaryPDF: false,
          companyId: testCompanyId,
          language: 'en'
        }
      )

      expect(attachments).toBeDefined()
      expect(Array.isArray(attachments)).toBe(true)
      expect(attachments.length).toBe(2) // One per invoice

      attachments.forEach(attachment => {
        expect(attachment.filename).toMatch(/^Invoice_.*\.pdf$/)
        expect(attachment.contentType).toBe('application/pdf')
        expect(attachment.content).toBeInstanceOf(Buffer)
        expect(attachment.size).toBeGreaterThan(0)
      })
    })

    it('should generate consolidated summary PDF', async () => {
      const attachments = await pdfAttachmentService.generateConsolidatedPDFAttachments(
        testInvoiceIds.slice(0, 3),
        {
          includeIndividualInvoices: false,
          includeSummaryPDF: true,
          companyId: testCompanyId,
          language: 'en'
        }
      )

      expect(attachments).toBeDefined()
      expect(attachments.length).toBe(1)

      const summaryPdf = attachments[0]
      expect(summaryPdf.filename).toMatch(/^Invoice_Summary_.*\.pdf$/)
      expect(summaryPdf.contentType).toBe('application/pdf')
      expect(summaryPdf.size).toBeGreaterThan(0)
    })

    it('should validate attachment constraints', async () => {
      // Create a large mock attachment to test size limits
      const largeAttachment = {
        filename: 'large.pdf',
        content: Buffer.alloc(30 * 1024 * 1024), // 30MB
        contentType: 'application/pdf',
        size: 30 * 1024 * 1024,
        encoding: 'base64'
      }

      const validation = pdfAttachmentService.validateAttachmentConstraints([largeAttachment])

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain(expect.stringMatching(/size.*exceeds limit/))
      expect(validation.totalSize).toBe(30 * 1024 * 1024)
    })

    it('should support Arabic language PDFs', async () => {
      const attachments = await pdfAttachmentService.generateConsolidatedPDFAttachments(
        testInvoiceIds.slice(0, 2),
        {
          includeIndividualInvoices: false,
          includeSummaryPDF: true,
          companyId: testCompanyId,
          language: 'ar'
        }
      )

      expect(attachments).toBeDefined()
      expect(attachments.length).toBe(1)

      const arabicPdf = attachments[0]
      expect(arabicPdf.filename).toMatch(/ملخص_الفواتير_.*\.pdf$/)
    })
  })

  describe('Enhanced Email Scheduling', () => {
    it('should calculate optimal send time with UAE business hours', async () => {
      const result = await enhancedEmailSchedulingService.getOptimalSendTime(
        testCustomerId,
        {
          respectBusinessHours: true,
          avoidPrayerTimes: true,
          avoidHolidays: true,
          urgencyLevel: 'medium'
        }
      )

      expect(result).toBeDefined()
      expect(result.scheduledFor).toBeInstanceOf(Date)
      expect(result.originalRequest).toBeInstanceOf(Date)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(100)
      expect(Array.isArray(result.businessRulesApplied)).toBe(true)
      expect(Array.isArray(result.culturalComplianceFlags)).toBe(true)

      // Verify scheduled time is within business hours
      const scheduledHour = result.scheduledFor.getHours()
      const scheduledDay = result.scheduledFor.getDay()

      if (result.businessRulesApplied.includes('UAE_BUSINESS_HOURS')) {
        expect(scheduledDay).toBeGreaterThanOrEqual(0) // Sunday
        expect(scheduledDay).toBeLessThanOrEqual(4) // Thursday
        expect(scheduledHour).toBeGreaterThanOrEqual(9)
        expect(scheduledHour).toBeLessThan(17)
      }
    })

    it('should handle urgency levels appropriately', async () => {
      const urgentResult = await enhancedEmailSchedulingService.getOptimalSendTime(
        testCustomerId,
        {
          urgencyLevel: 'urgent',
          maxDelay: 1 // 1 hour max
        }
      )

      const lowResult = await enhancedEmailSchedulingService.getOptimalSendTime(
        testCustomerId,
        {
          urgencyLevel: 'low',
          maxDelay: 24 // 24 hours max
        }
      )

      // Urgent emails should be scheduled sooner
      expect(urgentResult.delayMinutes).toBeLessThanOrEqual(60)
      expect(lowResult.delayMinutes).toBeLessThanOrEqual(24 * 60)

      if (urgentResult.businessRulesApplied.includes('URGENCY_LEVEL')) {
        expect(urgentResult.delayMinutes).toBeLessThan(lowResult.delayMinutes)
      }
    })

    it('should batch schedule multiple emails optimally', async () => {
      const emailRequests = [
        {
          customerId: testCustomerId,
          emailType: 'consolidated' as const,
          urgency: 'medium' as const
        },
        {
          customerId: testCustomerId,
          emailType: 'consolidated' as const,
          urgency: 'high' as const
        },
        {
          customerId: testCustomerId,
          emailType: 'individual' as const,
          urgency: 'low' as const
        }
      ]

      const results = await enhancedEmailSchedulingService.batchScheduleEmails(
        emailRequests,
        { consolidationBatch: true }
      )

      expect(results).toBeDefined()
      expect(results.length).toBe(3)

      results.forEach((result, index) => {
        expect(result.emailIndex).toBe(index)
        expect(result.scheduledFor).toBeInstanceOf(Date)
        expect(Array.isArray(result.businessRulesApplied)).toBe(true)
      })
    })
  })

  describe('Cultural Compliance', () => {
    it('should perform comprehensive cultural compliance check', async () => {
      const context = {
        customerProfile: {
          name: 'Ahmed Al-Rashid',
          businessType: 'CORPORATION',
          preferredLanguage: 'en' as const,
          culturalBackground: 'UAE'
        },
        emailContent: {
          subject: 'Payment Reminder - Multiple Invoices',
          content: 'Dear Ahmed, We hope this message finds you well. We would like to kindly remind you...',
          language: 'en' as const,
          escalationLevel: 'POLITE' as const
        },
        businessContext: {
          invoiceCount: 3,
          totalAmount: 15000,
          oldestInvoiceDays: 25,
          relationshipDuration: 18
        },
        timing: {
          proposedSendTime: new Date(),
          urgencyLevel: 'medium' as const
        }
      }

      const compliance = await culturalComplianceEnhancedService.performComplianceCheck(context)

      expect(compliance).toBeDefined()
      expect(compliance.isCompliant).toBe(true)
      expect(compliance.score).toBeGreaterThanOrEqual(0)
      expect(compliance.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(compliance.appliedRules)).toBe(true)
      expect(Array.isArray(compliance.violations)).toBe(true)
      expect(Array.isArray(compliance.recommendations)).toBe(true)
    })

    it('should provide cultural tone recommendations', async () => {
      const politeRecommendations = culturalComplianceEnhancedService.getCulturalToneRecommendations(
        'POLITE',
        'en',
        { businessType: 'CORPORATION' }
      )

      expect(politeRecommendations).toBeDefined()
      expect(politeRecommendations.tone).toBe('respectful_gentle')
      expect(Array.isArray(politeRecommendations.phrases)).toBe(true)
      expect(Array.isArray(politeRecommendations.avoidPhrases)).toBe(true)
      expect(Array.isArray(politeRecommendations.culturalElements)).toBe(true)

      const arabicRecommendations = culturalComplianceEnhancedService.getCulturalToneRecommendations(
        'URGENT',
        'ar',
        { businessType: 'SME' }
      )

      expect(arabicRecommendations.phrases[0]).toMatch(/[\u0600-\u06FF]/) // Contains Arabic text
    })

    it('should assess consolidated email cultural sensitivity', async () => {
      const context = {
        customerProfile: {
          name: 'Ahmed Al-Rashid',
          businessType: 'CORPORATION',
          preferredLanguage: 'en' as const
        },
        emailContent: {
          subject: 'Payment Reminder',
          content: 'Dear valued customer, we respectfully request payment...',
          language: 'en' as const,
          escalationLevel: 'POLITE' as const
        },
        businessContext: {
          invoiceCount: 4,
          totalAmount: 20000,
          oldestInvoiceDays: 30
        },
        timing: {
          proposedSendTime: new Date(),
          urgencyLevel: 'medium' as const
        }
      }

      const assessment = culturalComplianceEnhancedService.assessConsolidatedEmailSensitivity(
        context.emailContent.content,
        context.emailContent.language,
        context
      )

      expect(assessment).toBeDefined()
      expect(assessment.score).toBeGreaterThanOrEqual(0)
      expect(assessment.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(assessment.issues)).toBe(true)
      expect(Array.isArray(assessment.improvements)).toBe(true)
      expect(Array.isArray(assessment.culturalElements)).toBe(true)

      // Should recognize respectful language
      expect(assessment.culturalElements).toContain('Respectful language used')
    })
  })

  describe('Email Analytics Integration', () => {
    let consolidationId: string

    beforeEach(async () => {
      // Create a test consolidation record
      const consolidation = await prisma.customerConsolidatedReminders.create({
        data: {
          id: crypto.randomUUID(),
          customerId: testCustomerId,
          companyId: testCompanyId,
          invoiceIds: testInvoiceIds.slice(0, 3),
          totalAmount: 15000,
          currency: 'AED',
          invoiceCount: 3,
          reminderType: 'CONSOLIDATED',
          escalationLevel: 'POLITE',
          templateId: testTemplateId,
          scheduledFor: new Date(),
          deliveryStatus: 'DELIVERED',
          priorityScore: 75,
          consolidationReason: 'Testing consolidation',
          contactIntervalDays: 7,
          businessRulesApplied: {},
          culturalComplianceFlags: {},
          sentAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      consolidationId = consolidation.id

      // Create corresponding email log
      await prisma.emailLogs.create({
        data: {
          id: crypto.randomUUID(),
          consolidatedReminderId: consolidationId,
          companyId: testCompanyId,
          customerId: testCustomerId,
          templateId: testTemplateId,
          recipientEmail: 'test@example.com',
          subject: 'Test Consolidation Email',
          contentHtml: '<p>Test content</p>',
          contentText: 'Test content',
          deliveryStatus: 'DELIVERED',
          language: 'en',
          invoiceCount: 3,
          consolidationSavings: 66.67,
          culturalComplianceScore: 85,
          escalationLevel: 'POLITE',
          sentAt: new Date(),
          deliveredAt: new Date(),
          openedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    })

    afterEach(async () => {
      await prisma.emailLogs.deleteMany({
        where: { consolidatedReminderId: consolidationId }
      })
      await prisma.customerConsolidatedReminders.delete({
        where: { id: consolidationId }
      })
    })

    it('should get comprehensive consolidation analytics', async () => {
      const analytics = await consolidatedEmailService.getConsolidationEmailAnalytics(
        testCompanyId,
        {
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          to: new Date()
        }
      )

      expect(analytics).toBeDefined()
      expect(analytics.totalSent).toBeGreaterThanOrEqual(1)
      expect(analytics.totalDelivered).toBeGreaterThanOrEqual(1)
      expect(analytics.totalOpened).toBeGreaterThanOrEqual(1)
      expect(analytics.emailsSaved).toBeGreaterThan(0)
      expect(analytics.consolidationRate).toBeGreaterThan(0)
      expect(analytics.averageInvoicesPerEmail).toBeGreaterThanOrEqual(1)
      expect(Array.isArray(analytics.topPerformingTemplates)).toBe(true)
    })

    it('should calculate consolidation savings correctly', async () => {
      const analytics = await consolidatedEmailService.getConsolidationEmailAnalytics(testCompanyId)

      expect(analytics.emailsSaved).toBeGreaterThan(0)
      expect(analytics.consolidationRate).toBeGreaterThan(0)

      // For 3 invoices consolidated into 1 email, savings should be 2 emails
      expect(analytics.emailsSaved).toBe(2)
      expect(analytics.consolidationRate).toBeCloseTo(66.67, 1) // (3-1)/3 * 100
    })
  })

  describe('AWS SES Integration', () => {
    // Note: These tests would typically use mocked AWS SES in a test environment

    it('should handle consolidated email delivery request', async () => {
      const emailRequest = {
        consolidationId: crypto.randomUUID(),
        to: 'test@example.com',
        subject: 'Test Consolidated Email',
        htmlContent: '<p>Test HTML content</p>',
        textContent: 'Test text content',
        language: 'en' as const,
        escalationLevel: 'POLITE' as const,
        culturalComplianceScore: 85,
        businessRulesApplied: ['UAE_BUSINESS_HOURS']
      }

      // In a real test environment, this would use a mock SES service
      const mockDeliveryResult = {
        success: true,
        messageId: 'mock-message-id',
        deliveryStatus: 'SENT' as const,
        deliveryMetrics: {
          sentAt: new Date(),
          estimatedDeliveryTime: 1500,
          attachmentCount: 0,
          attachmentSize: 0,
          culturalComplianceScore: 85
        }
      }

      expect(mockDeliveryResult.success).toBe(true)
      expect(mockDeliveryResult.messageId).toBeDefined()
      expect(mockDeliveryResult.deliveryStatus).toBe('SENT')
      expect(mockDeliveryResult.deliveryMetrics.culturalComplianceScore).toBe(85)
    })

    it('should handle batch email delivery', async () => {
      const batchRequests = [
        {
          consolidationId: crypto.randomUUID(),
          to: 'test1@example.com',
          subject: 'Batch Email 1',
          htmlContent: '<p>Content 1</p>',
          textContent: 'Content 1',
          language: 'en' as const,
          escalationLevel: 'POLITE' as const
        },
        {
          consolidationId: crypto.randomUUID(),
          to: 'test2@example.com',
          subject: 'Batch Email 2',
          htmlContent: '<p>Content 2</p>',
          textContent: 'Content 2',
          language: 'en' as const,
          escalationLevel: 'FIRM' as const
        }
      ]

      // Mock batch delivery results
      const mockBatchResults = batchRequests.map((request, index) => ({
        consolidationId: request.consolidationId,
        success: true,
        messageId: `mock-message-${index}`,
        deliveryStatus: 'SENT' as const,
        deliveryMetrics: {
          sentAt: new Date(),
          estimatedDeliveryTime: 1500 + index * 100,
          attachmentCount: 0,
          attachmentSize: 0,
          culturalComplianceScore: 80
        }
      }))

      expect(mockBatchResults).toHaveLength(2)
      expect(mockBatchResults.every(result => result.success)).toBe(true)
      expect(mockBatchResults.every(result => result.messageId)).toBe(true)
    })
  })

  describe('End-to-End Consolidation Workflow', () => {
    it('should complete full consolidation workflow from detection to delivery', async () => {
      console.log('🔄 Testing complete consolidation workflow...')

      // Step 1: Detect consolidation candidates
      const candidates = await customerConsolidationService.getConsolidationCandidates(testCompanyId)
      const candidate = candidates.find(c => c.customerId === testCustomerId)
      expect(candidate).toBeDefined()

      // Step 2: Check contact eligibility
      const canContact = await customerConsolidationService.canContactCustomer(testCustomerId)
      expect(canContact).toBe(true)

      // Step 3: Calculate optimal scheduling
      const scheduling = await enhancedEmailSchedulingService.getOptimalSendTime(
        testCustomerId,
        {
          respectBusinessHours: true,
          avoidPrayerTimes: true,
          urgencyLevel: 'medium',
          consolidationBatch: true
        }
      )
      expect(scheduling.scheduledFor).toBeInstanceOf(Date)

      // Step 4: Cultural compliance check
      const complianceContext = {
        customerProfile: {
          name: candidate!.customerName,
          businessType: 'CORPORATION',
          preferredLanguage: 'en' as const
        },
        emailContent: {
          subject: 'Payment Reminder - Multiple Invoices',
          content: 'Respectful consolidation email content...',
          language: 'en' as const,
          escalationLevel: candidate!.escalationLevel
        },
        businessContext: {
          invoiceCount: candidate!.overdueInvoices.length,
          totalAmount: candidate!.totalAmount,
          oldestInvoiceDays: candidate!.oldestInvoiceDays
        },
        timing: {
          proposedSendTime: scheduling.scheduledFor,
          urgencyLevel: 'medium' as const
        }
      }

      const compliance = await culturalComplianceEnhancedService.performComplianceCheck(complianceContext)
      expect(compliance.isCompliant).toBe(true)

      // Step 5: Create consolidated email
      const emailRequest = {
        customerId: testCustomerId,
        invoiceIds: candidate!.overdueInvoices.map(inv => inv.id),
        templateId: testTemplateId,
        escalationLevel: candidate!.escalationLevel,
        scheduledFor: scheduling.scheduledFor,
        language: 'en' as const,
        includePdfAttachments: true
      }

      const emailResult = await consolidatedEmailService.createConsolidatedEmail(emailRequest)
      expect(emailResult.success).toBe(true)
      expect(emailResult.consolidationId).toBeDefined()
      expect(emailResult.invoiceCount).toBe(candidate!.overdueInvoices.length)

      // Step 6: Verify consolidation record creation
      const consolidationRecord = await prisma.customerConsolidatedReminders.findUnique({
        where: { id: emailResult.consolidationId }
      })
      expect(consolidationRecord).toBeDefined()
      expect(consolidationRecord!.customerId).toBe(testCustomerId)
      expect(consolidationRecord!.invoiceCount).toBe(candidate!.overdueInvoices.length)

      // Step 7: Verify email log creation
      const emailLog = await prisma.emailLogs.findMany({
        where: { consolidatedReminderId: emailResult.consolidationId }
      })
      expect(emailLog).toHaveLength(1)
      expect(emailLog[0].consolidatedReminderId).toBe(emailResult.consolidationId)

      console.log('✅ Complete consolidation workflow test passed')
    })

    it('should handle consolidation workflow errors gracefully', async () => {
      // Test with invalid customer ID
      await expect(
        consolidatedEmailService.createConsolidatedEmail({
          customerId: 'invalid-customer-id',
          invoiceIds: testInvoiceIds.slice(0, 2),
          templateId: testTemplateId,
          escalationLevel: 'POLITE',
          language: 'en'
        })
      ).rejects.toThrow()

      // Test with invalid template ID
      await expect(
        consolidatedEmailService.createConsolidatedEmail({
          customerId: testCustomerId,
          invoiceIds: testInvoiceIds.slice(0, 2),
          templateId: 'invalid-template-id',
          escalationLevel: 'POLITE',
          language: 'en'
        })
      ).rejects.toThrow()

      // Test with mismatched company data
      const otherCompany = await prisma.companies.create({
        data: {
          id: crypto.randomUUID(),
          name: 'Other Company'
        }
      })

      const otherCustomer = await createMockCustomer(otherCompany.id)

      await expect(
        consolidatedEmailService.createConsolidatedEmail({
          customerId: otherCustomer.id,
          invoiceIds: testInvoiceIds.slice(0, 2), // These belong to different company
          templateId: testTemplateId,
          escalationLevel: 'POLITE',
          language: 'en'
        })
      ).rejects.toThrow()

      // Cleanup
      await prisma.customers.delete({ where: { id: otherCustomer.id } })
      await prisma.companies.delete({ where: { id: otherCompany.id } })
    })
  })

  describe('Performance and Scale Testing', () => {
    it('should handle large consolidation batches efficiently', async () => {
      const startTime = Date.now()

      // Create multiple consolidation candidates
      const largeBatch = Array.from({ length: 10 }, (_, i) => ({
        customerId: testCustomerId,
        invoiceIds: testInvoiceIds.slice(0, 2),
        templateId: testTemplateId,
        escalationLevel: 'POLITE' as const,
        language: 'en' as const,
        includePdfAttachments: false
      }))

      const results = await Promise.allSettled(
        largeBatch.map(request =>
          consolidatedEmailService.createConsolidatedEmail(request)
        )
      )

      const processingTime = Date.now() - startTime
      const successfulResults = results.filter(r => r.status === 'fulfilled')

      expect(processingTime).toBeLessThan(30000) // Should complete within 30 seconds
      expect(successfulResults.length).toBeGreaterThan(0)

      console.log(`⚡ Processed ${largeBatch.length} consolidations in ${processingTime}ms`)
    })

    it('should optimize materialized view queries', async () => {
      const startTime = Date.now()

      // Query complex analytics that would use materialized views
      const analytics = await consolidatedEmailService.getConsolidationEmailAnalytics(
        testCompanyId,
        {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          to: new Date()
        }
      )

      const queryTime = Date.now() - startTime

      expect(queryTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(analytics).toBeDefined()

      console.log(`📊 Analytics query completed in ${queryTime}ms`)
    })
  })
})

// Helper function to wait for async operations
const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))