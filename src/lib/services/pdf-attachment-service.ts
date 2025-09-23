/**
 * PDF Attachment Service
 * Handles generation and management of PDF attachments for consolidated emails
 * Supports multiple invoice PDFs and consolidated summary PDFs
 */

import { prisma } from '../prisma'

interface InvoicePDFData {
  id: string
  number: string
  customerName: string
  customerEmail: string
  businessName?: string
  customerAddress?: string
  amount: number
  currency: string
  dueDate: Date
  issueDate: Date
  description?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    vatRate?: number
  }>
  vatAmount?: number
  totalAmount: number
  companyDetails: {
    name: string
    address?: string
    trn?: string
    email?: string
    phone?: string
  }
}

interface PDFAttachment {
  filename: string
  content: Buffer
  contentType: string
  size: number
  encoding: string
}

interface ConsolidatedPDFSummary {
  customerName: string
  totalInvoices: number
  totalAmount: number
  currency: string
  oldestDueDate: Date
  newestDueDate: Date
  averageDaysOverdue: number
  invoices: Array<{
    number: string
    amount: number
    dueDate: Date
    daysOverdue: number
  }>
  companyDetails: {
    name: string
    address?: string
    trn?: string
    email?: string
    phone?: string
  }
}

export class PDFAttachmentService {
  private readonly MAX_ATTACHMENT_SIZE_MB = 25 // AWS SES limit
  private readonly MAX_TOTAL_ATTACHMENTS_SIZE_MB = 25
  private readonly SUPPORTED_FORMATS = ['pdf']

  /**
   * Generate PDF attachments for consolidated email
   */
  async generateConsolidatedPDFAttachments(
    invoiceIds: string[],
    options: {
      includeIndividualInvoices?: boolean
      includeSummaryPDF?: boolean
      companyId: string
      language?: 'en' | 'ar'
    }
  ): Promise<PDFAttachment[]> {
    try {
      console.log(`📄 Generating PDF attachments for ${invoiceIds.length} invoices`)

      const attachments: PDFAttachment[] = []
      let totalSize = 0

      // Get invoice data
      const invoiceData = await this.getInvoiceDataForPDF(invoiceIds, options.companyId)

      if (invoiceData.length === 0) {
        throw new Error('No valid invoices found for PDF generation')
      }

      // Generate individual invoice PDFs if requested
      if (options.includeIndividualInvoices) {
        for (const invoice of invoiceData) {
          const pdfAttachment = await this.generateIndividualInvoicePDF(invoice, options.language)

          if (this.canAddAttachment(totalSize, pdfAttachment.size)) {
            attachments.push(pdfAttachment)
            totalSize += pdfAttachment.size
          } else {
            console.warn(`Skipping PDF attachment for invoice ${invoice.number} - size limit exceeded`)
            break
          }
        }
      }

      // Generate consolidated summary PDF if requested
      if (options.includeSummaryPDF) {
        const summaryData = this.prepareSummaryData(invoiceData)
        const summaryPDF = await this.generateConsolidatedSummaryPDF(summaryData, options.language)

        if (this.canAddAttachment(totalSize, summaryPDF.size)) {
          attachments.push(summaryPDF)
          totalSize += summaryPDF.size
        } else {
          console.warn('Skipping summary PDF attachment - size limit exceeded')
        }
      }

      console.log(`✅ Generated ${attachments.length} PDF attachments (${this.formatFileSize(totalSize)})`)
      return attachments

    } catch (error) {
      console.error('Failed to generate PDF attachments:', error)
      throw error
    }
  }

  /**
   * Generate individual invoice PDF
   */
  async generateIndividualInvoicePDF(
    invoiceData: InvoicePDFData,
    language: 'en' | 'ar' = 'en'
  ): Promise<PDFAttachment> {
    try {
      // Generate PDF content using a PDF library (placeholder implementation)
      const pdfContent = await this.createInvoicePDF(invoiceData, language)

      const filename = this.generateInvoiceFilename(invoiceData.number, language)

      return {
        filename,
        content: pdfContent,
        contentType: 'application/pdf',
        size: pdfContent.length,
        encoding: 'base64'
      }

    } catch (error) {
      console.error(`Failed to generate PDF for invoice ${invoiceData.number}:`, error)
      throw error
    }
  }

  /**
   * Generate consolidated summary PDF
   */
  async generateConsolidatedSummaryPDF(
    summaryData: ConsolidatedPDFSummary,
    language: 'en' | 'ar' = 'en'
  ): Promise<PDFAttachment> {
    try {
      const pdfContent = await this.createSummaryPDF(summaryData, language)

      const filename = this.generateSummaryFilename(summaryData.customerName, language)

      return {
        filename,
        content: pdfContent,
        contentType: 'application/pdf',
        size: pdfContent.length,
        encoding: 'base64'
      }

    } catch (error) {
      console.error('Failed to generate consolidated summary PDF:', error)
      throw error
    }
  }

  /**
   * Validate PDF attachment constraints
   */
  validateAttachmentConstraints(attachments: PDFAttachment[]): {
    isValid: boolean
    errors: string[]
    totalSize: number
    maxSize: number
  } {
    const errors: string[] = []
    const totalSize = attachments.reduce((sum, att) => sum + att.size, 0)
    const maxSizeBytes = this.MAX_TOTAL_ATTACHMENTS_SIZE_MB * 1024 * 1024

    // Check total size
    if (totalSize > maxSizeBytes) {
      errors.push(`Total attachment size (${this.formatFileSize(totalSize)}) exceeds limit (${this.MAX_TOTAL_ATTACHMENTS_SIZE_MB}MB)`)
    }

    // Check individual file sizes
    attachments.forEach((attachment, index) => {
      const maxIndividualSizeBytes = this.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024
      if (attachment.size > maxIndividualSizeBytes) {
        errors.push(`Attachment ${index + 1} (${attachment.filename}) size (${this.formatFileSize(attachment.size)}) exceeds limit (${this.MAX_ATTACHMENT_SIZE_MB}MB)`)
      }
    })

    // Check file types
    attachments.forEach((attachment, index) => {
      const extension = attachment.filename.split('.').pop()?.toLowerCase()
      if (!extension || !this.SUPPORTED_FORMATS.includes(extension)) {
        errors.push(`Attachment ${index + 1} (${attachment.filename}) has unsupported format`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors,
      totalSize,
      maxSize: maxSizeBytes
    }
  }

  /**
   * Optimize PDF attachments for email delivery
   */
  async optimizePDFAttachments(attachments: PDFAttachment[]): Promise<PDFAttachment[]> {
    try {
      const optimized: PDFAttachment[] = []

      for (const attachment of attachments) {
        // Attempt to compress PDF if it's too large
        if (attachment.size > (this.MAX_ATTACHMENT_SIZE_MB * 0.8 * 1024 * 1024)) {
          const compressed = await this.compressPDF(attachment)
          optimized.push(compressed)
        } else {
          optimized.push(attachment)
        }
      }

      return optimized

    } catch (error) {
      console.error('Failed to optimize PDF attachments:', error)
      return attachments // Return original if optimization fails
    }
  }

  /**
   * Private helper methods
   */

  private async getInvoiceDataForPDF(invoiceIds: string[], companyId: string): Promise<InvoicePDFData[]> {
    const invoices = await prisma.invoices.findMany({
      where: {
        id: { in: invoiceIds },
        companyId,
        isActive: true
      },
      include: {
        customers: true,
        invoiceItems: true,
        companies: true
      }
    })

    return invoices.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      businessName: invoice.customers?.businessName,
      customerAddress: invoice.customers?.address,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      issueDate: invoice.createdAt,
      description: invoice.description,
      items: invoice.invoiceItems?.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        vatRate: item.vatRate ? Number(item.vatRate) : undefined
      })) || [],
      vatAmount: Number(invoice.vatAmount || 0),
      totalAmount: Number(invoice.totalAmount),
      companyDetails: {
        name: invoice.companies.name,
        address: invoice.companies.address,
        trn: invoice.companies.trn,
        email: process.env.AWS_SES_FROM_EMAIL,
        phone: '' // Would come from company settings
      }
    }))
  }

  private prepareSummaryData(invoiceData: InvoicePDFData[]): ConsolidatedPDFSummary {
    const totalAmount = invoiceData.reduce((sum, inv) => sum + inv.totalAmount, 0)
    const dueDates = invoiceData.map(inv => inv.dueDate.getTime())
    const oldestDueDate = new Date(Math.min(...dueDates))
    const newestDueDate = new Date(Math.max(...dueDates))

    const now = Date.now()
    const totalDaysOverdue = invoiceData.reduce((sum, inv) =>
      sum + Math.max(0, Math.floor((now - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))), 0
    )
    const averageDaysOverdue = Math.round(totalDaysOverdue / invoiceData.length)

    return {
      customerName: invoiceData[0]?.customerName || '',
      totalInvoices: invoiceData.length,
      totalAmount,
      currency: invoiceData[0]?.currency || 'AED',
      oldestDueDate,
      newestDueDate,
      averageDaysOverdue,
      invoices: invoiceData.map(inv => ({
        number: inv.number,
        amount: inv.totalAmount,
        dueDate: inv.dueDate,
        daysOverdue: Math.max(0, Math.floor((now - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      })),
      companyDetails: invoiceData[0]?.companyDetails || {
        name: '',
        address: '',
        trn: '',
        email: '',
        phone: ''
      }
    }
  }

  private async createInvoicePDF(invoiceData: InvoicePDFData, language: 'en' | 'ar'): Promise<Buffer> {
    // Placeholder for PDF generation using a library like PDFKit or Puppeteer
    // This would create a properly formatted invoice PDF with:
    // - Company header and branding
    // - Invoice details (number, dates, amounts)
    // - Line items table
    // - Payment terms and instructions
    // - Cultural formatting for Arabic if needed

    const htmlContent = this.generateInvoiceHTML(invoiceData, language)

    // For now, return a simple PDF placeholder
    // In a real implementation, use a library like Puppeteer or PDFKit
    return Buffer.from(this.generateDummyPDFContent(`Invoice ${invoiceData.number}`), 'utf8')
  }

  private async createSummaryPDF(summaryData: ConsolidatedPDFSummary, language: 'en' | 'ar'): Promise<Buffer> {
    // Placeholder for consolidated summary PDF generation
    // This would create a summary document with:
    // - Customer information
    // - Summary of all overdue invoices
    // - Total amounts and payment instructions
    // - Professional formatting with company branding

    const htmlContent = this.generateSummaryHTML(summaryData, language)

    // For now, return a simple PDF placeholder
    return Buffer.from(this.generateDummyPDFContent('Consolidated Invoice Summary'), 'utf8')
  }

  private generateInvoiceHTML(invoiceData: InvoicePDFData, language: 'en' | 'ar'): string {
    const isRTL = language === 'ar'
    const direction = isRTL ? 'rtl' : 'ltr'

    return `
<!DOCTYPE html>
<html dir="${direction}" lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceData.number}</title>
    <style>
        body { font-family: ${isRTL ? 'Arial, sans-serif' : 'Arial, sans-serif'}; direction: ${direction}; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-details { margin-bottom: 20px; }
        .customer-details { margin-bottom: 20px; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: ${isRTL ? 'right' : 'left'}; }
        .total-section { margin-top: 20px; text-align: ${isRTL ? 'left' : 'right'}; }
        .company-details { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${invoiceData.companyDetails.name}</h1>
        <p>${language === 'ar' ? 'فاتورة' : 'INVOICE'}</p>
    </div>

    <div class="invoice-details">
        <p><strong>${language === 'ar' ? 'رقم الفاتورة:' : 'Invoice Number:'}</strong> ${invoiceData.number}</p>
        <p><strong>${language === 'ar' ? 'تاريخ الإصدار:' : 'Issue Date:'}</strong> ${this.formatDate(invoiceData.issueDate, language)}</p>
        <p><strong>${language === 'ar' ? 'تاريخ الاستحقاق:' : 'Due Date:'}</strong> ${this.formatDate(invoiceData.dueDate, language)}</p>
    </div>

    <div class="customer-details">
        <h3>${language === 'ar' ? 'تفاصيل العميل' : 'Customer Details'}</h3>
        <p><strong>${language === 'ar' ? 'الاسم:' : 'Name:'}</strong> ${invoiceData.customerName}</p>
        ${invoiceData.businessName ? `<p><strong>${language === 'ar' ? 'الشركة:' : 'Business:'}</strong> ${invoiceData.businessName}</p>` : ''}
        <p><strong>${language === 'ar' ? 'البريد الإلكتروني:' : 'Email:'}</strong> ${invoiceData.customerEmail}</p>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>${language === 'ar' ? 'الوصف' : 'Description'}</th>
                <th>${language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                <th>${language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                <th>${language === 'ar' ? 'المجموع' : 'Total'}</th>
            </tr>
        </thead>
        <tbody>
            ${invoiceData.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${this.formatCurrency(item.unitPrice, invoiceData.currency)}</td>
                    <td>${this.formatCurrency(item.total, invoiceData.currency)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="total-section">
        <p><strong>${language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</strong> ${this.formatCurrency(invoiceData.amount, invoiceData.currency)}</p>
        ${invoiceData.vatAmount ? `<p><strong>${language === 'ar' ? 'ضريبة القيمة المضافة:' : 'VAT:'}</strong> ${this.formatCurrency(invoiceData.vatAmount, invoiceData.currency)}</p>` : ''}
        <p><strong>${language === 'ar' ? 'المجموع الكلي:' : 'Total Amount:'}</strong> ${this.formatCurrency(invoiceData.totalAmount, invoiceData.currency)}</p>
    </div>

    <div class="company-details">
        <p>${invoiceData.companyDetails.name}</p>
        ${invoiceData.companyDetails.address ? `<p>${invoiceData.companyDetails.address}</p>` : ''}
        ${invoiceData.companyDetails.trn ? `<p>${language === 'ar' ? 'رقم التسجيل التجاري:' : 'TRN:'} ${invoiceData.companyDetails.trn}</p>` : ''}
        ${invoiceData.companyDetails.email ? `<p>${language === 'ar' ? 'البريد الإلكتروني:' : 'Email:'} ${invoiceData.companyDetails.email}</p>` : ''}
    </div>
</body>
</html>`
  }

  private generateSummaryHTML(summaryData: ConsolidatedPDFSummary, language: 'en' | 'ar'): string {
    const isRTL = language === 'ar'
    const direction = isRTL ? 'rtl' : 'ltr'

    return `
<!DOCTYPE html>
<html dir="${direction}" lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consolidated Invoice Summary</title>
    <style>
        body { font-family: ${isRTL ? 'Arial, sans-serif' : 'Arial, sans-serif'}; direction: ${direction}; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { margin-bottom: 20px; }
        .invoices-table { width: 100%; border-collapse: collapse; }
        .invoices-table th, .invoices-table td { border: 1px solid #ddd; padding: 8px; text-align: ${isRTL ? 'right' : 'left'}; }
        .total-section { margin-top: 20px; text-align: ${isRTL ? 'left' : 'right'}; }
        .payment-instructions { margin-top: 30px; padding: 15px; background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${summaryData.companyDetails.name}</h1>
        <h2>${language === 'ar' ? 'ملخص الفواتير المستحقة' : 'Consolidated Invoice Summary'}</h2>
    </div>

    <div class="summary">
        <p><strong>${language === 'ar' ? 'العميل:' : 'Customer:'}</strong> ${summaryData.customerName}</p>
        <p><strong>${language === 'ar' ? 'عدد الفواتير:' : 'Number of Invoices:'}</strong> ${summaryData.totalInvoices}</p>
        <p><strong>${language === 'ar' ? 'المبلغ الإجمالي:' : 'Total Amount:'}</strong> ${this.formatCurrency(summaryData.totalAmount, summaryData.currency)}</p>
        <p><strong>${language === 'ar' ? 'متوسط الأيام المتأخرة:' : 'Average Days Overdue:'}</strong> ${summaryData.averageDaysOverdue} ${language === 'ar' ? 'يوم' : 'days'}</p>
    </div>

    <h3>${language === 'ar' ? 'تفاصيل الفواتير' : 'Invoice Details'}</h3>
    <table class="invoices-table">
        <thead>
            <tr>
                <th>${language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}</th>
                <th>${language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th>${language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                <th>${language === 'ar' ? 'الأيام المتأخرة' : 'Days Overdue'}</th>
            </tr>
        </thead>
        <tbody>
            ${summaryData.invoices.map(invoice => `
                <tr>
                    <td>${invoice.number}</td>
                    <td>${this.formatCurrency(invoice.amount, summaryData.currency)}</td>
                    <td>${this.formatDate(invoice.dueDate, language)}</td>
                    <td>${invoice.daysOverdue}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="total-section">
        <h3><strong>${language === 'ar' ? 'المجموع الكلي:' : 'Total Amount Due:'} ${this.formatCurrency(summaryData.totalAmount, summaryData.currency)}</strong></h3>
    </div>

    <div class="payment-instructions">
        <h4>${language === 'ar' ? 'تعليمات الدفع' : 'Payment Instructions'}</h4>
        <p>${language === 'ar' ? 'يرجى سداد المبلغ المستحق في أقرب وقت ممكن.' : 'Please settle the outstanding amount at your earliest convenience.'}</p>
        <p>${language === 'ar' ? 'للاستفسارات، يرجى التواصل معنا على:' : 'For inquiries, please contact us at:'} ${summaryData.companyDetails.email}</p>
    </div>
</body>
</html>`
  }

  private generateDummyPDFContent(title: string): string {
    // This is a placeholder - in real implementation, use a proper PDF library
    return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 58
>>
stream
BT
/F1 12 Tf
100 700 Td
(${title}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
313
%%EOF`
  }

  private canAddAttachment(currentSize: number, newAttachmentSize: number): boolean {
    const maxSizeBytes = this.MAX_TOTAL_ATTACHMENTS_SIZE_MB * 1024 * 1024
    return (currentSize + newAttachmentSize) <= maxSizeBytes
  }

  private async compressPDF(attachment: PDFAttachment): Promise<PDFAttachment> {
    // Placeholder for PDF compression
    // In real implementation, use a PDF compression library
    console.log(`Compressing PDF: ${attachment.filename}`)

    return {
      ...attachment,
      size: Math.floor(attachment.size * 0.7) // Simulate 30% compression
    }
  }

  private generateInvoiceFilename(invoiceNumber: string, language: 'en' | 'ar'): string {
    const prefix = language === 'ar' ? 'فاتورة' : 'Invoice'
    const sanitizedNumber = invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')
    return `${prefix}_${sanitizedNumber}.pdf`
  }

  private generateSummaryFilename(customerName: string, language: 'en' | 'ar'): string {
    const prefix = language === 'ar' ? 'ملخص_الفواتير' : 'Invoice_Summary'
    const sanitizedName = customerName.replace(/[^a-zA-Z0-9]/g, '_')
    return `${prefix}_${sanitizedName}.pdf`
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

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }
}

// Singleton instance for global use
export const pdfAttachmentService = new PDFAttachmentService()