import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/invoices/email/preview - Preview invoice reminder email before sending
 * Generates email preview with template variable substitution
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      invoiceId,
      templateId,
      language = 'ENGLISH',
      customSubject,
      customContent
    } = body

    // Validate required fields
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Fetch invoice with all relationships
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        companyId: session.user.companyId
      },
      include: {
        customer: true,
        company: true
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Fetch email template if provided, otherwise use defaults
    let template = null
    if (templateId) {
      template = await prisma.emailTemplate.findFirst({
        where: {
          id: templateId,
          companyId: session.user.companyId,
          isActive: true
        }
      })
    }

    // Calculate days overdue
    const daysOverdue = invoice.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    // Prepare template variables
    const variables = {
      customerName: invoice.customer?.name || invoice.customerName || 'Valued Customer',
      customerEmail: invoice.customer?.email || invoice.customerEmail || '',
      invoiceNumber: invoice.number,
      amount: `${invoice.currency || 'AED'} ${invoice.totalAmount.toLocaleString()}`,
      totalAmount: invoice.totalAmount.toLocaleString(),
      currency: invoice.currency || 'AED',
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'N/A',
      issueDate: invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'N/A',
      daysPastDue: daysOverdue.toString(),
      daysOverdue: daysOverdue.toString(),
      companyName: invoice.company?.name || 'Our Company',
      companyEmail: invoice.company?.contactEmail || 'info@company.com',
      paymentTerms: invoice.paymentTerms || 'Net 30',
      currentDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    // Default subject and content if not using template
    let subject = customSubject || template?.subjectEn || `Payment Reminder: Invoice ${invoice.number}`
    let content = customContent || template?.contentEn || generateDefaultEmailContent(variables)

    // Substitute variables in subject
    subject = substituteVariables(subject, variables)

    // Substitute variables in content
    content = substituteVariables(content, variables)

    // Calculate email metrics
    const textContent = content.replace(/<[^>]*>/g, '').trim()
    const wordCount = textContent.split(/\s+/).length
    const estimatedReadTime = Math.ceil(wordCount / 200) // 200 words per minute

    const metrics = {
      subjectLength: subject.length,
      contentLength: content.length,
      wordCount,
      estimatedReadTime,
      variablesUsed: Object.keys(variables).length,
      hasAttachment: !!invoice.pdfS3Key,
      language
    }

    // Generate insights
    const insights = {
      subjectLineQuality: assessSubjectLine(subject),
      contentQuality: assessContentQuality(content),
      personalizationLevel: assessPersonalizationLevel(variables, content),
      recommendations: generateRecommendations(subject, content, invoice)
    }

    return NextResponse.json({
      success: true,
      preview: {
        subject,
        content,
        variables,
        recipientEmail: invoice.customer?.email || invoice.customerEmail,
        recipientName: invoice.customer?.name || invoice.customerName
      },
      invoice: {
        number: invoice.number,
        amount: invoice.totalAmount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: invoice.status,
        hasPDF: !!invoice.pdfS3Key
      },
      metrics,
      insights,
      previewGenerated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Email preview error:', error)
    return NextResponse.json(
      { error: 'Failed to generate email preview' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to substitute template variables
 */
function substituteVariables(text: string, variables: Record<string, string>): string {
  let result = text

  // Replace {{variable}} patterns
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi')
    result = result.replace(regex, variables[key])
  })

  return result
}

/**
 * Generate default email content if no template provided
 */
function generateDefaultEmailContent(variables: Record<string, string>): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 20px;">Payment Reminder</h2>

      <p>Dear ${variables.customerName},</p>

      <p>This is a friendly reminder regarding the following outstanding invoice:</p>

      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #007bff; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #333;">Invoice Details</h3>
        <p style="margin: 8px 0;"><strong>Invoice Number:</strong> ${variables.invoiceNumber}</p>
        <p style="margin: 8px 0;"><strong>Amount Due:</strong> ${variables.amount}</p>
        <p style="margin: 8px 0;"><strong>Due Date:</strong> ${variables.dueDate}</p>
        <p style="margin: 8px 0;"><strong>Days Overdue:</strong> ${variables.daysOverdue} days</p>
      </div>

      <p>📎 <strong>Invoice PDF is attached to this email for your reference.</strong></p>

      <p>Please arrange payment at your earliest convenience. If you have already made payment, please disregard this reminder.</p>

      <p>If you have any questions or concerns, please don't hesitate to contact us.</p>

      <p>Thank you for your business.</p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        ${variables.companyName}
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

      <p style="font-size: 12px; color: #666; text-align: center;">
        This is an automated payment reminder from ${variables.companyName}<br>
        If you have questions, please contact us at ${variables.companyEmail}
      </p>
    </div>
  `
}

/**
 * Assess subject line quality
 */
function assessSubjectLine(subject: string) {
  const length = subject.length
  const hasNumbers = /\d/.test(subject)
  const hasUrgency = /urgent|important|final|overdue|reminder/i.test(subject)
  const hasPersonalization = subject.includes('{{') || /invoice #?\d+/i.test(subject)

  let score = 50

  // Length assessment (30-60 chars is optimal)
  if (length >= 30 && length <= 60) score += 20
  else if (length >= 20 && length <= 70) score += 10
  else score -= 10

  // Content assessment
  if (hasNumbers) score += 10
  if (hasUrgency) score += 15
  if (hasPersonalization) score += 15

  // Penalties
  if (subject.includes('!!!')) score -= 15
  if (subject.toUpperCase() === subject && subject.length > 0) score -= 20

  return {
    score: Math.max(0, Math.min(100, score)),
    length,
    hasNumbers,
    hasUrgency,
    hasPersonalization,
    assessment: score >= 70 ? 'good' : score >= 50 ? 'fair' : 'needs_improvement'
  }
}

/**
 * Assess content quality
 */
function assessContentQuality(content: string) {
  const textContent = content.replace(/<[^>]*>/g, '').trim()
  const wordCount = textContent.split(/\s+/).length
  const hasCallToAction = /pay|payment|settle|contact|click|respond/i.test(textContent)
  const hasPersonalization = /{{.*}}/.test(content)
  const hasList = /<ul>|<ol>|<li>/i.test(content)
  const hasInvoiceDetails = /invoice|amount|due date|overdue/i.test(textContent)

  let score = 50

  // Word count assessment (100-300 words is optimal)
  if (wordCount >= 100 && wordCount <= 300) score += 20
  else if (wordCount >= 50 && wordCount <= 400) score += 10
  else score -= 10

  // Content features
  if (hasCallToAction) score += 15
  if (hasPersonalization) score += 10
  if (hasList || hasInvoiceDetails) score += 10
  if (hasInvoiceDetails) score += 10

  return {
    score: Math.max(0, Math.min(100, score)),
    wordCount,
    hasCallToAction,
    hasPersonalization,
    hasList,
    hasInvoiceDetails,
    assessment: score >= 70 ? 'good' : score >= 50 ? 'fair' : 'needs_improvement'
  }
}

/**
 * Assess personalization level
 */
function assessPersonalizationLevel(variables: Record<string, string>, content: string) {
  const personalizedFields = [
    'customerName', 'invoiceNumber', 'amount', 'dueDate', 'daysOverdue'
  ]

  const usedFields = personalizedFields.filter(field =>
    content.includes(variables[field]) && variables[field]
  )

  const score = (usedFields.length / personalizedFields.length) * 100

  return {
    score,
    usedFields: usedFields.length,
    totalFields: personalizedFields.length,
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  }
}

/**
 * Generate recommendations for improvement
 */
function generateRecommendations(
  subject: string,
  content: string,
  invoice: any
): string[] {
  const recommendations = []

  // Subject line recommendations
  if (subject.length < 20) {
    recommendations.push('Consider making the subject line more descriptive')
  } else if (subject.length > 70) {
    recommendations.push('Consider shortening the subject line for better mobile display')
  }

  // Content recommendations
  const textContent = content.replace(/<[^>]*>/g, '').trim()
  const wordCount = textContent.split(/\s+/).length

  if (wordCount < 50) {
    recommendations.push('Consider adding more context to the email')
  } else if (wordCount > 400) {
    recommendations.push('Consider condensing the content for better readability')
  }

  // PDF attachment recommendation
  if (!invoice.pdfS3Key) {
    recommendations.push('⚠️ No PDF attached - consider uploading invoice PDF for professional presentation')
  }

  // Call to action recommendation
  if (!content.includes('pay') && !content.includes('payment')) {
    recommendations.push('Consider adding a clear call-to-action for payment')
  }

  // Personalization recommendation
  if (!content.includes('{{customerName}}') && !content.includes(invoice.customerName || '')) {
    recommendations.push('Consider personalizing the greeting with customer name')
  }

  // UAE business courtesy
  if (!content.includes('thank') && !content.includes('appreciate')) {
    recommendations.push('Consider adding courteous language for UAE business culture')
  }

  return recommendations
}
