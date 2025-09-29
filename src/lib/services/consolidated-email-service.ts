/**
 * Consolidated Email Service
 * Handles multi-invoice email processing, template management, and delivery for Sprint 2
 * Integrates with customer consolidation service and UAE business compliance
 */

import { prisma } from '../prisma'
import { customerConsolidationService } from './customer-consolidation-service'
import { emailSchedulingService } from './email-scheduling-service'
import { awsSESConsolidationService } from './aws-ses-consolidation-service'
import { pdfAttachmentService } from './pdf-attachment-service'
import { culturalComplianceEnhancedService } from './cultural-compliance-enhanced-service'
import type {
  ConsolidationCandidate,
  ConsolidatedReminder,
  ConsolidatedInvoice
} from '../types/consolidation'

interface ConsolidatedEmailTemplate {
  id: string
  name: string
  description?: string
  subjectEn: string
  subjectAr?: string
  contentEn: string
  contentAr?: string
  variables: Record<string, any>
  consolidationVariables: Record<string, any>
  supportsConsolidation: boolean
  maxInvoiceCount: number
  templateType: string
  isActive: boolean
  uaeBusinessHoursOnly: boolean
}

interface ConsolidatedEmailRequest {
  customerId: string
  invoiceIds: string[]
  templateId?: string
  escalationLevel?: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
  scheduledFor?: Date
  language?: 'en' | 'ar'
  includePdfAttachments?: boolean
  customMessage?: string
}

interface ConsolidatedEmailResponse {
  consolidationId: string
  emailLogId: string
  scheduled: boolean
  scheduledFor: Date
  invoiceCount: number
  totalAmount: number
  currency: string
  templateUsed: string
  deliveryStatus: string
  awsMessageId?: string
}

interface EmailTemplateVariables {
  // Customer variables
  customerName: string
  customerNameAr?: string
  businessName?: string
  businessNameAr?: string
  contactPerson?: string

  // Company variables
  companyName: string
  companyEmail: string
  companyPhone?: string
  companyAddress?: string

  // Consolidated invoice variables
  invoiceCount: number
  totalAmount: string
  currency: string
  oldestInvoiceDays: number
  invoiceList: Array<{
    number: string
    amount: string
    dueDate: string
    daysOverdue: number
    description?: string
  }>

  // Summary variables
  totalOverdueAmount: string
  averageDaysOverdue: number
  earliestDueDate: string
  latestDueDate: string

  // Cultural variables
  currentDate: string
  currentDateAr?: string
  islamicDate?: string
  greeting: string
  culturalSalutation: string

  // Action variables
  paymentLink?: string
  contactEmail: string
  contactPhone?: string
  nextFollowUpDate?: string
}

export class ConsolidatedEmailService {
  private readonly MAX_ATTACHMENTS_SIZE_MB = 25 // AWS SES limit
  private readonly SUPPORTED_ATTACHMENT_TYPES = ['pdf', 'jpg', 'jpeg', 'png']

  /**
   * Create and send consolidated email for multiple invoices
   */
  async createConsolidatedEmail(request: ConsolidatedEmailRequest): Promise<ConsolidatedEmailResponse> {
    try {
      console.log(`📧 Creating consolidated email for customer: ${request.customerId}`)

      // Get customer and invoice details
      const customer = await this.getCustomerDetails(request.customerId)
      if (!customer) {
        throw new Error(`Customer not found: ${request.customerId}`)
      }

      const invoices = await this.getInvoiceDetails(request.invoiceIds, customer.companyId)
      if (invoices.length === 0) {
        throw new Error('No valid invoices found for consolidation')
      }

      // Validate consolidation eligibility
      await this.validateConsolidationRequest(customer, invoices, request)

      // Get or select appropriate template
      const template = await this.getConsolidationTemplate(
        customer.companyId,
        request.templateId,
        request.escalationLevel,
        invoices.length
      )

      // Calculate totals and metadata
      const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
      const oldestInvoiceDays = Math.max(...invoices.map(inv =>
        Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      ))

      // Create consolidation record first
      const consolidationId = await this.createConsolidationRecord({
        customerId: request.customerId,
        companyId: customer.companyId,
        invoiceIds: request.invoiceIds,
        totalAmount,
        invoiceCount: invoices.length,
        escalationLevel: request.escalationLevel || this.determineEscalationLevel(oldestInvoiceDays, totalAmount),
        templateId: template.id,
        scheduledFor: request.scheduledFor,
        language: request.language || customer.preferredLanguage || 'en'
      })

      // Generate email content with template variables
      const templateVariables = await this.generateTemplateVariables(customer, invoices, {
        companyId: customer.companyId,
        language: request.language || 'en',
        customMessage: request.customMessage
      })

      const emailContent = await this.processEmailTemplate(template, templateVariables, request.language || 'en')

      // Handle PDF attachments if requested
      let attachments: any[] = []
      if (request.includePdfAttachments) {
        attachments = await this.generateConsolidatedPDFAttachments(invoices, {
          language: request.language || 'en',
          format: options.attachmentOptions?.pdfFormat || 'INDIVIDUAL'
        })
      }

      // Calculate optimal scheduling time
      const scheduledFor = request.scheduledFor || await this.calculateOptimalSendTime(customer, template)

      // Create email log entry
      const emailLogId = await this.createEmailLog({
        consolidationId,
        customerId: request.customerId,
        companyId: customer.companyId,
        templateId: template.id,
        recipientEmail: customer.email,
        subject: emailContent.subject,
        content: emailContent.content,
        invoiceIds: request.invoiceIds,
        invoiceCount: invoices.length,
        totalAmount,
        scheduledFor,
        attachments
      })

      // Schedule email delivery using AWS SES
      const deliveryResult = await this.deliverConsolidatedEmail({
        emailLogId,
        consolidationId,
        recipientEmail: customer.email,
        subject: emailContent.subject,
        htmlContent: emailContent.content,
        language: request.language || 'en',
        escalationLevel: request.escalationLevel || this.determineEscalationLevel(oldestInvoiceDays, totalAmount),
        attachments,
        scheduledFor,
        customMessage: request.customMessage,
        templateVariables
      })

      console.log(`✅ Consolidated email created: ${consolidationId}`)

      return {
        consolidationId,
        emailLogId,
        scheduled: true,
        scheduledFor,
        invoiceCount: invoices.length,
        totalAmount,
        currency: invoices[0]?.currency || 'AED',
        templateUsed: template.name,
        deliveryStatus: deliveryResult.deliveryStatus,
        awsMessageId: deliveryResult.messageId
      }

    } catch (error) {
      console.error('Failed to create consolidated email:', error)
      throw error
    }
  }

  /**
   * Get all consolidation-enabled templates for a company
   */
  async getConsolidationTemplates(companyId: string, language?: 'en' | 'ar'): Promise<ConsolidatedEmailTemplate[]> {
    try {
      const templates = await prisma.emailTemplate.findMany({
        where: {
          companyId,
          isActive: true,
          supportsConsolidation: true
        },
        orderBy: [
          { isDefault: 'desc' },
          { templateType: 'asc' },
          { version: 'desc' }
        ]
      })

      return templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        subjectEn: template.subjectEn,
        subjectAr: template.subjectAr,
        contentEn: template.contentEn,
        contentAr: template.contentAr,
        variables: template.variables as Record<string, any> || {},
        consolidationVariables: template.consolidationVariables as Record<string, any> || {},
        supportsConsolidation: template.supportsConsolidation,
        maxInvoiceCount: template.maxInvoiceCount,
        templateType: template.templateType,
        isActive: template.isActive,
        uaeBusinessHoursOnly: template.uaeBusinessHoursOnly
      }))

    } catch (error) {
      console.error('Failed to get consolidation templates:', error)
      throw error
    }
  }

  /**
   * Preview consolidated email without sending
   */
  async previewConsolidatedEmail(
    customerId: string,
    invoiceIds: string[],
    templateId: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<{ subject: string; content: string; variables: EmailTemplateVariables }> {
    try {
      const customer = await this.getCustomerDetails(customerId)
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`)
      }

      const invoices = await this.getInvoiceDetails(invoiceIds, customer.companyId)
      const template = await this.getTemplateById(templateId)

      const variables = await this.generateTemplateVariables(customer, invoices, {
        companyId: customer.companyId,
        language
      })

      const emailContent = await this.processEmailTemplate(template, variables, language)

      return {
        subject: emailContent.subject,
        content: emailContent.content,
        variables
      }

    } catch (error) {
      console.error('Failed to preview consolidated email:', error)
      throw error
    }
  }

  /**
   * Get consolidation email analytics
   */
  async getConsolidationEmailAnalytics(
    companyId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalSent: number
    totalDelivered: number
    totalOpened: number
    totalClicked: number
    emailsSaved: number
    consolidationRate: number
    averageInvoicesPerEmail: number
    topPerformingTemplates: Array<{ templateName: string; openRate: number; clickRate: number }>
  }> {
    try {
      const whereClause: any = {
        companyId,
        consolidatedReminderId: { not: null }
      }

      if (dateRange) {
        whereClause.sentAt = {
          gte: dateRange.from,
          lte: dateRange.to
        }
      }

      const consolidatedEmails = await prisma.emailLogs.findMany({
        where: whereClause,
        include: {
          emailTemplates: {
            select: { name: true }
          }
        }
      })

      const totalSent = consolidatedEmails.length
      const totalDelivered = consolidatedEmails.filter(e => e.deliveredAt).length
      const totalOpened = consolidatedEmails.filter(e => e.openedAt).length
      const totalClicked = consolidatedEmails.filter(e => e.clickedAt).length

      const emailsSaved = consolidatedEmails.reduce((sum, email) =>
        sum + (email.invoiceCount - 1), 0
      )

      const totalIndividualEmails = consolidatedEmails.reduce((sum, email) =>
        sum + email.invoiceCount, 0
      )

      const consolidationRate = totalIndividualEmails > 0
        ? ((totalIndividualEmails - totalSent) / totalIndividualEmails) * 100
        : 0

      const averageInvoicesPerEmail = totalSent > 0
        ? consolidatedEmails.reduce((sum, email) => sum + email.invoiceCount, 0) / totalSent
        : 0

      // Calculate template performance
      const templatePerformance = new Map<string, { sent: number; opened: number; clicked: number }>()

      consolidatedEmails.forEach(email => {
        const templateName = email.emailTemplates?.name || 'Unknown'
        const stats = templatePerformance.get(templateName) || { sent: 0, opened: 0, clicked: 0 }

        stats.sent++
        if (email.openedAt) stats.opened++
        if (email.clickedAt) stats.clicked++

        templatePerformance.set(templateName, stats)
      })

      const topPerformingTemplates = Array.from(templatePerformance.entries())
        .map(([templateName, stats]) => ({
          templateName,
          openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
          clickRate: stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0
        }))
        .sort((a, b) => b.openRate - a.openRate)
        .slice(0, 5)

      return {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        emailsSaved,
        consolidationRate: Math.round(consolidationRate * 100) / 100,
        averageInvoicesPerEmail: Math.round(averageInvoicesPerEmail * 100) / 100,
        topPerformingTemplates
      }

    } catch (error) {
      console.error('Failed to get consolidation email analytics:', error)
      throw error
    }
  }

  /**
   * Private helper methods
   */

  private async getCustomerDetails(customerId: string) {
    return await prisma.customers.findUnique({
      where: { id: customerId },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            emailSettings: true,
            businessHours: true
          }
        }
      }
    })
  }

  private async getInvoiceDetails(invoiceIds: string[], companyId: string) {
    return await prisma.invoices.findMany({
      where: {
        id: { in: invoiceIds },
        companyId,
        status: { in: ['SENT', 'OVERDUE'] },
        isActive: true
      },
      include: {
        customers: true,
        invoiceItems: true
      },
      orderBy: { dueDate: 'asc' }
    })
  }

  private async validateConsolidationRequest(customer: any, invoices: any[], request: ConsolidatedEmailRequest) {
    // Check minimum invoices
    if (invoices.length < 2) {
      throw new Error('Minimum 2 invoices required for consolidation')
    }

    // Check customer preferences
    if (customer.consolidationPreference === 'DISABLED') {
      throw new Error('Customer has disabled consolidation')
    }

    // Check total amount against customer limit
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    if (customer.maxConsolidationAmount && totalAmount > Number(customer.maxConsolidationAmount)) {
      throw new Error(`Total amount exceeds customer limit: ${totalAmount}`)
    }

    // Check template capacity
    if (request.templateId) {
      const template = await this.getTemplateById(request.templateId)
      if (invoices.length > template.maxInvoiceCount) {
        throw new Error(`Template supports maximum ${template.maxInvoiceCount} invoices`)
      }
    }
  }

  private async getConsolidationTemplate(
    companyId: string,
    templateId?: string,
    escalationLevel?: string,
    invoiceCount?: number
  ): Promise<ConsolidatedEmailTemplate> {
    let template

    if (templateId) {
      template = await prisma.emailTemplate.findFirst({
        where: {
          id: templateId,
          companyId,
          isActive: true,
          supportsConsolidation: true
        }
      })
    } else {
      // Auto-select based on escalation level and invoice count
      const templateType = this.getTemplateTypeForEscalation(escalationLevel || 'POLITE')

      template = await prisma.emailTemplate.findFirst({
        where: {
          companyId,
          templateType,
          isActive: true,
          supportsConsolidation: true,
          maxInvoiceCount: { gte: invoiceCount || 2 }
        },
        orderBy: [
          { isDefault: 'desc' },
          { version: 'desc' }
        ]
      })
    }

    if (!template) {
      throw new Error('No suitable consolidation template found')
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      subjectEn: template.subjectEn,
      subjectAr: template.subjectAr,
      contentEn: template.contentEn,
      contentAr: template.contentAr,
      variables: template.variables as Record<string, any> || {},
      consolidationVariables: template.consolidationVariables as Record<string, any> || {},
      supportsConsolidation: template.supportsConsolidation,
      maxInvoiceCount: template.maxInvoiceCount,
      templateType: template.templateType,
      isActive: template.isActive,
      uaeBusinessHoursOnly: template.uaeBusinessHoursOnly
    }
  }

  private async getTemplateById(templateId: string): Promise<ConsolidatedEmailTemplate> {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      subjectEn: template.subjectEn,
      subjectAr: template.subjectAr,
      contentEn: template.contentEn,
      contentAr: template.contentAr,
      variables: template.variables as Record<string, any> || {},
      consolidationVariables: template.consolidationVariables as Record<string, any> || {},
      supportsConsolidation: template.supportsConsolidation,
      maxInvoiceCount: template.maxInvoiceCount,
      templateType: template.templateType,
      isActive: template.isActive,
      uaeBusinessHoursOnly: template.uaeBusinessHoursOnly
    }
  }

  private determineEscalationLevel(daysOverdue: number, amount: number): 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL' {
    if (daysOverdue >= 90 || amount >= 50000) return 'FINAL'
    if (daysOverdue >= 60 || amount >= 25000) return 'URGENT'
    if (daysOverdue >= 30 || amount >= 10000) return 'FIRM'
    return 'POLITE'
  }

  private getTemplateTypeForEscalation(escalationLevel: string): string {
    switch (escalationLevel) {
      case 'URGENT':
      case 'FINAL':
        return 'URGENT_CONSOLIDATED_REMINDER'
      case 'FIRM':
        return 'FIRM_CONSOLIDATED_REMINDER'
      default:
        return 'CONSOLIDATED_REMINDER'
    }
  }

  private async generateTemplateVariables(
    customer: any,
    invoices: any[],
    options: { companyId: string; language: string; customMessage?: string }
  ): Promise<EmailTemplateVariables> {
    // Get company details
    const company = await prisma.companies.findUnique({
      where: { id: options.companyId }
    })

    // Calculate aggregated values
    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    const oldestInvoiceDays = Math.max(...invoices.map(inv =>
      Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    ))
    const averageDaysOverdue = Math.round(
      invoices.reduce((sum, inv) =>
        sum + Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)), 0
      ) / invoices.length
    )

    // Format invoice list
    const invoiceList = invoices.map(invoice => ({
      number: invoice.number,
      amount: this.formatCurrency(Number(invoice.totalAmount), invoice.currency || 'AED'),
      dueDate: this.formatDate(invoice.dueDate, options.language),
      daysOverdue: Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      description: invoice.description
    }))

    // Generate cultural elements
    const currentDate = new Date()
    const greeting = this.getCulturalGreeting(options.language, currentDate)
    const culturalSalutation = this.getCulturalSalutation(options.language)

    return {
      // Customer variables
      customerName: customer.name,
      customerNameAr: customer.nameAr,
      businessName: customer.businessName,
      businessNameAr: customer.businessNameAr,
      contactPerson: customer.contactPerson,

      // Company variables
      companyName: company?.name || '',
      companyEmail: process.env.AWS_SES_FROM_EMAIL || '',
      companyPhone: '', // Would come from company settings
      companyAddress: company?.address,

      // Consolidated invoice variables
      invoiceCount: invoices.length,
      totalAmount: this.formatCurrency(totalAmount, invoices[0]?.currency || 'AED'),
      currency: invoices[0]?.currency || 'AED',
      oldestInvoiceDays,
      invoiceList,

      // Summary variables
      totalOverdueAmount: this.formatCurrency(totalAmount, invoices[0]?.currency || 'AED'),
      averageDaysOverdue,
      earliestDueDate: this.formatDate(new Date(Math.min(...invoices.map(inv => inv.dueDate.getTime()))), options.language),
      latestDueDate: this.formatDate(new Date(Math.max(...invoices.map(inv => inv.dueDate.getTime()))), options.language),

      // Cultural variables
      currentDate: this.formatDate(currentDate, options.language),
      currentDateAr: options.language === 'ar' ? this.formatDate(currentDate, 'ar') : undefined,
      islamicDate: this.formatIslamicDate(currentDate),
      greeting,
      culturalSalutation,

      // Action variables
      paymentLink: `${process.env.NEXTAUTH_URL}/payment/${invoices[0]?.id}`,
      contactEmail: process.env.AWS_SES_FROM_EMAIL || '',
      contactPhone: '', // Would come from company settings
      nextFollowUpDate: this.formatDate(
        new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
        options.language
      )
    }
  }

  private async processEmailTemplate(
    template: ConsolidatedEmailTemplate,
    variables: EmailTemplateVariables,
    language: 'en' | 'ar'
  ): Promise<{ subject: string; content: string }> {
    const subject = language === 'ar' && template.subjectAr
      ? template.subjectAr
      : template.subjectEn

    const content = language === 'ar' && template.contentAr
      ? template.contentAr
      : template.contentEn

    // Replace template variables
    const processedSubject = this.replaceTemplateVariables(subject, variables)
    const processedContent = this.replaceTemplateVariables(content, variables)

    return {
      subject: processedSubject,
      content: processedContent
    }
  }

  private replaceTemplateVariables(template: string, variables: EmailTemplateVariables): string {
    let processed = template

    // Replace all variables in the format {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processed = processed.replace(regex, String(value || ''))
    })

    // Handle invoice list template
    if (template.includes('{{#invoiceList}}') && template.includes('{{/invoiceList}}')) {
      const listRegex = /{{#invoiceList}}(.*?){{\/invoiceList}}/gs
      const listMatch = template.match(listRegex)

      if (listMatch && variables.invoiceList) {
        const listTemplate = listMatch[0].replace('{{#invoiceList}}', '').replace('{{/invoiceList}}', '')
        const listItems = variables.invoiceList.map(invoice => {
          let item = listTemplate
          Object.entries(invoice).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
            item = item.replace(regex, String(value || ''))
          })
          return item
        })
        processed = processed.replace(listRegex, listItems.join('\n'))
      }
    }

    return processed
  }

  private formatCurrency(amount: number, currency: string = 'AED'): string {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  private formatDate(date: Date, language: string = 'en'): string {
    const locale = language === 'ar' ? 'ar-AE' : 'en-AE'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  private formatIslamicDate(date: Date): string {
    // Placeholder for Islamic date formatting
    // Would integrate with Islamic calendar library
    return this.formatDate(date, 'ar')
  }

  private getCulturalGreeting(language: string, date: Date): string {
    const hour = date.getHours()

    if (language === 'ar') {
      if (hour < 12) return 'صباح الخير'
      if (hour < 17) return 'مساء الخير'
      return 'مساء الخير'
    }

    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  private getCulturalSalutation(language: string): string {
    return language === 'ar'
      ? 'مع أطيب التحيات'
      : 'Best regards'
  }

  private async generateConsolidatedPDFAttachments(
    invoices: any[],
    options: { language: 'en' | 'ar'; format: 'INDIVIDUAL' | 'MERGED' | 'BOTH' }
  ): Promise<any[]> {
    try {
      console.log(`📎 Generating PDF attachments for ${invoices.length} invoices`)

      const attachments = []

      if (options.format === 'INDIVIDUAL' || options.format === 'BOTH') {
        // Generate individual invoice PDFs
        const individualAttachments = await pdfAttachmentService.generateConsolidatedPDFAttachments(
          invoices,
          {
            includeInvoicePDFs: true,
            includeConsolidatedSummary: false,
            pdfFormat: 'INDIVIDUAL'
          }
        )
        attachments.push(...individualAttachments)
      }

      if (options.format === 'MERGED' || options.format === 'BOTH') {
        // Generate consolidated summary PDF
        const summaryAttachment = await pdfAttachmentService.generateConsolidatedPDFAttachments(
          invoices,
          {
            includeInvoicePDFs: false,
            includeConsolidatedSummary: true,
            pdfFormat: 'MERGED'
          }
        )
        attachments.push(...summaryAttachment)
      }

      return attachments

    } catch (error) {
      console.error('Failed to generate PDF attachments:', error)
      return []
    }
  }

  /**
   * Deliver consolidated email using AWS SES
   */
  private async deliverConsolidatedEmail(data: {
    emailLogId: string
    consolidationId: string
    recipientEmail: string
    subject: string
    htmlContent: string
    language: 'en' | 'ar'
    escalationLevel: 'POLITE' | 'FIRM' | 'URGENT' | 'FINAL'
    attachments: any[]
    scheduledFor: Date
    customMessage?: string
    templateVariables: EmailTemplateVariables
  }): Promise<{
    success: boolean
    deliveryStatus: 'SENT' | 'FAILED' | 'QUEUED'
    messageId?: string
    error?: string
  }> {
    try {
      // Perform cultural compliance check
      const complianceResult = await culturalComplianceEnhancedService.performComplianceCheck(
        data.htmlContent,
        {
          language: data.language,
          recipientType: 'business',
          escalationLevel: data.escalationLevel,
          contextMetadata: {
            invoiceCount: data.templateVariables.invoiceCount,
            totalAmount: data.templateVariables.totalAmount,
            oldestInvoiceDays: data.templateVariables.oldestInvoiceDays
          }
        }
      )

      // Generate text content from HTML
      const textContent = this.htmlToText(data.htmlContent)

      // Add custom message if provided
      let finalHtmlContent = data.htmlContent
      let finalTextContent = textContent

      if (data.customMessage) {
        const customMessageSection = data.language === 'ar'
          ? `<p style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #0ea5e9;">${data.customMessage}</p>`
          : `<p style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">${data.customMessage}</p>`

        finalHtmlContent = finalHtmlContent.replace('{{CUSTOM_MESSAGE}}', customMessageSection)
        finalTextContent = finalTextContent.replace('{{CUSTOM_MESSAGE}}', `\n\n${data.customMessage}\n\n`)
      } else {
        finalHtmlContent = finalHtmlContent.replace('{{CUSTOM_MESSAGE}}', '')
        finalTextContent = finalTextContent.replace('{{CUSTOM_MESSAGE}}', '')
      }

      // Prepare AWS SES request
      const sesRequest = {
        consolidationId: data.consolidationId,
        to: data.recipientEmail,
        subject: data.subject,
        htmlContent: finalHtmlContent,
        textContent: finalTextContent,
        language: data.language,
        escalationLevel: data.escalationLevel,
        attachments: data.attachments,
        customMessage: data.customMessage,
        scheduledFor: data.scheduledFor,
        culturalComplianceScore: complianceResult.overallScore,
        businessRulesApplied: complianceResult.appliedRules?.map(rule => rule.id) || []
      }

      // Check if email should be sent immediately or scheduled
      const now = new Date()
      if (data.scheduledFor <= now) {
        // Send immediately
        const deliveryResult = await awsSESConsolidationService.sendConsolidatedEmail(sesRequest)

        if (deliveryResult.success) {
          // Update email log with delivery information
          await this.updateEmailLogDelivery(data.emailLogId, {
            awsMessageId: deliveryResult.messageId,
            deliveryStatus: 'SENT',
            sentAt: new Date(),
            culturalComplianceScore: complianceResult.overallScore,
            deliveryMetrics: deliveryResult.deliveryMetrics
          })

          return {
            success: true,
            deliveryStatus: 'SENT',
            messageId: deliveryResult.messageId
          }
        } else {
          return {
            success: false,
            deliveryStatus: 'FAILED',
            error: deliveryResult.errorMessage
          }
        }
      } else {
        // Schedule for later delivery
        // In a production system, this would use a job queue (Redis, SQS, etc.)
        console.log(`📅 Email scheduled for ${data.scheduledFor.toISOString()}`)

        await this.updateEmailLogDelivery(data.emailLogId, {
          deliveryStatus: 'QUEUED',
          culturalComplianceScore: complianceResult.overallScore,
          scheduledFor: data.scheduledFor
        })

        return {
          success: true,
          deliveryStatus: 'QUEUED'
        }
      }

    } catch (error) {
      console.error('Failed to deliver consolidated email:', error)

      await this.updateEmailLogDelivery(data.emailLogId, {
        deliveryStatus: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        deliveryStatus: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send multiple consolidated emails in batch
   */
  async sendConsolidatedEmailBatch(
    requests: Array<{
      consolidatedReminderId: string
      options?: {
        templateId?: string
        customMessage?: string
        attachmentOptions?: {
          includeInvoicePDFs: boolean
          includeConsolidatedSummary: boolean
          pdfFormat: 'INDIVIDUAL' | 'MERGED' | 'BOTH'
        }
      }
    }>
  ): Promise<Array<{
    consolidatedReminderId: string
    success: boolean
    messageId?: string
    error?: string
  }>> {
    const results = []

    // Convert to consolidated email requests for batch processing
    const sesRequests = []

    for (const request of requests) {
      try {
        // Get consolidation details
        const consolidation = await prisma.customerConsolidatedReminders.findUnique({
          where: { id: request.consolidatedReminderId },
          include: {
            customers: true,
            companies: true
          }
        })

        if (!consolidation) {
          results.push({
            consolidatedReminderId: request.consolidatedReminderId,
            success: false,
            error: 'Consolidation not found'
          })
          continue
        }

        // Get invoices
        const invoices = await this.getInvoiceDetails(
          consolidation.invoiceIds,
          consolidation.companyId
        )

        // Get template
        const template = await this.getConsolidationTemplate(
          consolidation.companyId,
          request.options?.templateId,
          consolidation.escalationLevel,
          invoices.length
        )

        // Generate variables and content
        const templateVariables = await this.generateTemplateVariables(
          consolidation.customers,
          invoices,
          {
            companyId: consolidation.companyId,
            language: 'en',
            customMessage: request.options?.customMessage
          }
        )

        const emailContent = await this.processEmailTemplate(
          template,
          templateVariables,
          'en'
        )

        // Generate attachments if requested
        let attachments: any[] = []
        if (request.options?.attachmentOptions?.includeInvoicePDFs) {
          attachments = await this.generateConsolidatedPDFAttachments(invoices, {
            language: 'en',
            format: request.options.attachmentOptions.pdfFormat || 'INDIVIDUAL'
          })
        }

        sesRequests.push({
          consolidationId: request.consolidatedReminderId,
          to: consolidation.customers.email,
          subject: emailContent.subject,
          htmlContent: emailContent.content,
          textContent: this.htmlToText(emailContent.content),
          language: 'en' as const,
          escalationLevel: consolidation.escalationLevel as any,
          attachments,
          customMessage: request.options?.customMessage
        })

      } catch (error) {
        results.push({
          consolidatedReminderId: request.consolidatedReminderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Send batch using AWS SES
    const batchResults = await awsSESConsolidationService.batchSendConsolidatedEmails(sesRequests)

    // Combine results
    batchResults.forEach(result => {
      results.push({
        consolidatedReminderId: result.consolidationId,
        success: result.success,
        messageId: result.messageId,
        error: result.errorMessage
      })
    })

    return results
  }

  private async updateEmailLogDelivery(
    emailLogId: string,
    updates: {
      awsMessageId?: string
      deliveryStatus?: string
      sentAt?: Date
      deliveredAt?: Date
      culturalComplianceScore?: number
      deliveryMetrics?: any
      scheduledFor?: Date
      errorMessage?: string
    }
  ): Promise<void> {
    await prisma.emailLogs.update({
      where: { id: emailLogId },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    })
  }

  private async calculateOptimalSendTime(customer: any, template: ConsolidatedEmailTemplate): Promise<Date> {
    // Use email scheduling service if available
    if (emailSchedulingService) {
      return await emailSchedulingService.getOptimalSendTime(customer.id, {
        respectBusinessHours: template.uaeBusinessHoursOnly,
        avoidPrayerTimes: true,
        avoidHolidays: true
      })
    }

    // Fallback to simple business hours calculation
    const now = new Date()
    const businessStart = new Date(now)
    businessStart.setHours(9, 0, 0, 0)

    if (now.getHours() >= 9 && now.getHours() < 17 && now.getDay() >= 0 && now.getDay() <= 4) {
      return new Date(now.getTime() + (5 * 60 * 1000)) // 5 minutes from now
    }

    // Schedule for next business day
    const nextBusinessDay = new Date(businessStart)
    nextBusinessDay.setDate(nextBusinessDay.getDate() + 1)
    return nextBusinessDay
  }

  private async createConsolidationRecord(data: {
    customerId: string
    companyId: string
    invoiceIds: string[]
    totalAmount: number
    invoiceCount: number
    escalationLevel: string
    templateId: string
    scheduledFor?: Date
    language: string
  }): Promise<string> {
    const consolidation = await prisma.customerConsolidatedReminders.create({
      data: {
        id: crypto.randomUUID(),
        customerId: data.customerId,
        companyId: data.companyId,
        invoiceIds: data.invoiceIds,
        totalAmount: data.totalAmount,
        currency: 'AED',
        invoiceCount: data.invoiceCount,
        reminderType: 'CONSOLIDATED',
        escalationLevel: data.escalationLevel,
        templateId: data.templateId,
        scheduledFor: data.scheduledFor || new Date(),
        deliveryStatus: 'QUEUED',
        priorityScore: 75, // Default priority
        consolidationReason: `Consolidated ${data.invoiceCount} overdue invoices`,
        contactIntervalDays: 7,
        businessRulesApplied: {},
        culturalComplianceFlags: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return consolidation.id
  }

  private async createEmailLog(data: {
    consolidationId: string
    customerId: string
    companyId: string
    templateId: string
    recipientEmail: string
    subject: string
    content: string
    invoiceIds: string[]
    invoiceCount: number
    totalAmount: number
    scheduledFor: Date
    attachments: any[]
  }): Promise<string> {
    const emailLog = await prisma.emailLogs.create({
      data: {
        id: crypto.randomUUID(),
        templateId: data.templateId,
        companyId: data.companyId,
        customerId: data.customerId,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        contentHtml: data.content,
        contentText: this.htmlToText(data.content),
        deliveryStatus: 'SCHEDULED',
        language: 'en', // Would be passed from request
        consolidatedReminderId: data.consolidationId,
        invoiceCount: data.invoiceCount,
        consolidationSavings: data.invoiceCount > 1 ? ((data.invoiceCount - 1) / data.invoiceCount) * 100 : 0,
        consolidationMetadata: {
          invoiceIds: data.invoiceIds,
          totalAmount: data.totalAmount,
          attachmentCount: data.attachments.length
        },
        uaeSendTime: data.scheduledFor,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return emailLog.id
  }


  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

// Singleton instance for global use
export const consolidatedEmailService = new ConsolidatedEmailService()