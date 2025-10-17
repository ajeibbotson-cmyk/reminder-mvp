import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'
import { consolidatedEmailService } from '@/lib/services/consolidated-email-service'
import { pdfAttachmentService } from '@/lib/services/pdf-attachment-service'

/**
 * POST /api/consolidation/email/preview - Preview consolidated email before sending
 * Generates email preview with template processing and attachment information
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const body = await request.json()

    const {
      customerId,
      invoiceIds,
      templateId,
      language = 'en',
      includePdfAttachments = false,
      includeIndividualInvoices = false,
      includeSummaryPdf = true,
      customMessage
    } = body

    // Validate required fields
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length < 1) {
      return NextResponse.json(
        { error: 'At least 1 invoice ID is required' },
        { status: 400 }
      )
    }

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Generate email preview
    const emailPreview = await consolidatedEmailService.previewConsolidatedEmail(
      customerId,
      invoiceIds,
      templateId,
      language as 'en' | 'ar'
    )

    // Generate PDF attachment preview if requested
    let attachmentPreview = null
    if (includePdfAttachments) {
      try {
        const attachments = await pdfAttachmentService.generateConsolidatedPDFAttachments(
          invoiceIds,
          {
            includeIndividualInvoices,
            includeSummaryPDF: includeSummaryPdf,
            companyId: authContext.user.companyId,
            language: language as 'en' | 'ar'
          }
        )

        // Validate attachment constraints
        const validation = pdfAttachmentService.validateAttachmentConstraints(attachments)

        attachmentPreview = {
          attachments: attachments.map(att => ({
            filename: att.filename,
            size: att.size,
            contentType: att.contentType,
            // Don't include actual content in preview for performance
            sizeFormatted: formatFileSize(att.size)
          })),
          validation,
          totalSize: attachments.reduce((sum, att) => sum + att.size, 0),
          totalSizeFormatted: formatFileSize(attachments.reduce((sum, att) => sum + att.size, 0))
        }
      } catch (attachmentError) {
        console.error('Failed to generate attachment preview:', attachmentError)
        attachmentPreview = {
          error: 'Failed to generate PDF attachments',
          attachments: [],
          validation: { isValid: false, errors: ['PDF generation failed'], totalSize: 0, maxSize: 0 }
        }
      }
    }

    // Calculate email metrics
    const metrics = {
      subjectLength: emailPreview.subject.length,
      contentLength: emailPreview.content.length,
      estimatedReadTime: Math.ceil(emailPreview.content.replace(/<[^>]*>/g, '').length / 200), // words per minute
      variablesUsed: Object.keys(emailPreview.variables).length,
      hasCustomMessage: !!customMessage?.trim(),
      language: language
    }

    // Generate preview insights
    const insights = {
      subjectLineQuality: assessSubjectLine(emailPreview.subject),
      contentQuality: assessContentQuality(emailPreview.content),
      personalizationLevel: assessPersonalizationLevel(emailPreview.variables),
      culturalCompliance: assessCulturalCompliance(emailPreview, language),
      recommendations: generatePreviewRecommendations(emailPreview, metrics, attachmentPreview)
    }

    return successResponse({
      preview: {
        subject: emailPreview.subject,
        content: emailPreview.content,
        variables: emailPreview.variables,
        customMessage: customMessage || null
      },
      attachments: attachmentPreview,
      metrics,
      insights,
      previewGenerated: new Date().toISOString()
    }, 'Email preview generated successfully')

  } catch (error) {
    logError('POST /api/consolidation/email/preview', error, {
      userId: request.headers.get('user-id')
    })
    return handleApiError(error)
  }
}

/**
 * Helper functions for preview analysis
 */

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

function assessSubjectLine(subject: string) {
  const length = subject.length
  const hasNumbers = /\d/.test(subject)
  const hasUrgency = /urgent|important|final|overdue/i.test(subject)
  const hasPersonalization = /\{\{.*\}\}/.test(subject) || subject.includes('{{')

  let score = 50 // Base score

  // Length assessment
  if (length >= 30 && length <= 50) score += 20
  else if (length >= 20 && length <= 60) score += 10
  else score -= 10

  // Content assessment
  if (hasNumbers) score += 10
  if (hasUrgency) score += 15
  if (hasPersonalization) score += 15

  // Penalties
  if (subject.includes('!!!')) score -= 15
  if (subject.toUpperCase() === subject) score -= 20

  return {
    score: Math.max(0, Math.min(100, score)),
    length,
    hasNumbers,
    hasUrgency,
    hasPersonalization,
    assessment: score >= 70 ? 'good' : score >= 50 ? 'fair' : 'needs_improvement'
  }
}

function assessContentQuality(content: string) {
  const textContent = content.replace(/<[^>]*>/g, '').trim()
  const wordCount = textContent.split(/\s+/).length
  const hasCallToAction = /pay|payment|settle|contact|click|respond/i.test(textContent)
  const hasPersonalization = /\{\{.*\}\}/.test(content)
  const hasList = /<ul>|<ol>|<li>/i.test(content)

  let score = 50

  // Word count assessment
  if (wordCount >= 100 && wordCount <= 300) score += 20
  else if (wordCount >= 50 && wordCount <= 400) score += 10
  else score -= 10

  // Content features
  if (hasCallToAction) score += 20
  if (hasPersonalization) score += 15
  if (hasList) score += 10

  return {
    score: Math.max(0, Math.min(100, score)),
    wordCount,
    hasCallToAction,
    hasPersonalization,
    hasList,
    assessment: score >= 70 ? 'good' : score >= 50 ? 'fair' : 'needs_improvement'
  }
}

function assessPersonalizationLevel(variables: Record<string, any>) {
  const personalizedFields = [
    'customerName', 'businessName', 'contactPerson',
    'invoiceList', 'totalAmount', 'oldestInvoiceDays'
  ]

  const usedPersonalizedFields = personalizedFields.filter(field =>
    variables.hasOwnProperty(field) && variables[field]
  )

  const score = (usedPersonalizedFields.length / personalizedFields.length) * 100

  return {
    score,
    usedFields: usedPersonalizedFields.length,
    totalFields: personalizedFields.length,
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  }
}

function assessCulturalCompliance(preview: any, language: string) {
  const content = preview.content.toLowerCase()
  const subject = preview.subject.toLowerCase()

  let score = 50
  const flags = []

  // Language-specific checks
  if (language === 'ar') {
    // Arabic cultural considerations
    if (content.includes('inshallah') || content.includes('إن شاء الله')) score += 10
    if (subject.includes('تذكير') || subject.includes('reminder')) score += 5
  } else {
    // English cultural considerations for UAE
    if (content.includes('respectfully') || content.includes('kindly')) score += 10
    if (content.includes('urgent') && content.includes('please')) score += 5
  }

  // General cultural compliance
  if (content.includes('understanding') || content.includes('appreciate')) {
    score += 10
    flags.push('polite_tone')
  }

  if (content.includes('business hours') || content.includes('working days')) {
    score += 5
    flags.push('business_context')
  }

  // Check for potentially insensitive content
  if (content.includes('immediately') || content.includes('asap')) {
    score -= 5
    flags.push('potentially_urgent')
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    level: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
    flags,
    recommendations: score < 70 ? [
      'Consider adding more polite language',
      'Include cultural sensitivity phrases',
      'Respect UAE business customs'
    ] : []
  }
}

function generatePreviewRecommendations(
  preview: any,
  metrics: any,
  attachments: any
): string[] {
  const recommendations = []

  // Subject line recommendations
  if (metrics.subjectLength < 20) {
    recommendations.push('Consider making the subject line more descriptive')
  } else if (metrics.subjectLength > 60) {
    recommendations.push('Consider shortening the subject line for better mobile display')
  }

  // Content recommendations
  if (metrics.contentLength < 500) {
    recommendations.push('Consider adding more context about the consolidation benefits')
  }

  if (metrics.estimatedReadTime > 3) {
    recommendations.push('Consider condensing the content for better readability')
  }

  // Attachment recommendations
  if (attachments?.validation && !attachments.validation.isValid) {
    recommendations.push('PDF attachments have issues that need to be resolved')
  }

  if (attachments?.totalSize > 20 * 1024 * 1024) { // 20MB
    recommendations.push('Consider reducing attachment size for better delivery')
  }

  // Personalization recommendations
  if (metrics.variablesUsed < 5) {
    recommendations.push('Consider adding more personalization variables')
  }

  // Cultural recommendations
  if (metrics.language === 'ar' && !preview.content.includes('مع أطيب التحيات')) {
    recommendations.push('Consider adding traditional Arabic closing salutation')
  }

  return recommendations
}