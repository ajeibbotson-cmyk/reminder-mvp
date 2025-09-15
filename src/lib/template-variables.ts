import { prisma } from './prisma'
import { formatCurrency, formatDate } from './email'

export interface VariableContext {
  invoiceId?: string
  customerId?: string
  companyId: string
  language?: 'en' | 'ar'
}

export interface VariableValue {
  key: string
  value: string | number | boolean | Date | null
  type: 'string' | 'number' | 'currency' | 'date' | 'boolean'
  category: 'invoice' | 'customer' | 'company' | 'system'
  description?: string
}

/**
 * Get all available template variables with their current values
 */
export async function getTemplateVariables(context: VariableContext): Promise<VariableValue[]> {
  const variables: VariableValue[] = []

  // Add invoice variables
  if (context.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: context.invoiceId },
      include: {
        customer: true,
        company: true,
        invoiceItems: true,
        payments: true
      }
    })

    if (invoice) {
      const totalPaid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      const outstandingAmount = Number(invoice.totalAmount || invoice.amount) - totalPaid
      const daysPastDue = Math.max(0, Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)))

      variables.push(
        {
          key: 'invoiceNumber',
          value: invoice.number,
          type: 'string',
          category: 'invoice',
          description: 'Invoice number'
        },
        {
          key: 'invoiceAmount',
          value: formatCurrency(invoice.amount, invoice.currency),
          type: 'currency',
          category: 'invoice',
          description: 'Invoice base amount'
        },
        {
          key: 'invoiceSubtotal',
          value: formatCurrency(invoice.subtotal || 0, invoice.currency),
          type: 'currency',
          category: 'invoice',
          description: 'Invoice subtotal (before VAT)'
        },
        {
          key: 'invoiceVatAmount',
          value: formatCurrency(invoice.vatAmount || 0, invoice.currency),
          type: 'currency',
          category: 'invoice',
          description: 'VAT amount'
        },
        {
          key: 'invoiceTotalAmount',
          value: formatCurrency(invoice.totalAmount || invoice.amount, invoice.currency),
          type: 'currency',
          category: 'invoice',
          description: 'Total invoice amount (including VAT)'
        },
        {
          key: 'invoiceCurrency',
          value: invoice.currency,
          type: 'string',
          category: 'invoice',
          description: 'Invoice currency code'
        },
        {
          key: 'invoiceStatus',
          value: invoice.status,
          type: 'string',
          category: 'invoice',
          description: 'Current invoice status'
        },
        {
          key: 'invoiceDueDate',
          value: formatDate(invoice.dueDate),
          type: 'date',
          category: 'invoice',
          description: 'Invoice due date'
        },
        {
          key: 'invoiceDescription',
          value: invoice.description || '',
          type: 'string',
          category: 'invoice',
          description: 'Invoice description'
        },
        {
          key: 'invoiceDescriptionAr',
          value: invoice.descriptionAr || '',
          type: 'string',
          category: 'invoice',
          description: 'Invoice description in Arabic'
        },
        {
          key: 'daysPastDue',
          value: daysPastDue,
          type: 'number',
          category: 'invoice',
          description: 'Number of days past due date'
        },
        {
          key: 'totalPaid',
          value: formatCurrency(totalPaid, invoice.currency),
          type: 'currency',
          category: 'invoice',
          description: 'Total amount paid'
        },
        {
          key: 'outstandingAmount',
          value: formatCurrency(outstandingAmount, invoice.currency),
          type: 'currency',
          category: 'invoice',
          description: 'Outstanding amount due'
        },
        {
          key: 'itemCount',
          value: invoice.invoiceItems.length,
          type: 'number',
          category: 'invoice',
          description: 'Number of line items'
        }
      )

      // Add customer variables from invoice
      variables.push(
        {
          key: 'customerName',
          value: invoice.customerName,
          type: 'string',
          category: 'customer',
          description: 'Customer name'
        },
        {
          key: 'customerEmail',
          value: invoice.customerEmail,
          type: 'string',
          category: 'customer',
          description: 'Customer email address'
        }
      )

      // Add company variables from invoice
      variables.push(
        {
          key: 'companyName',
          value: invoice.company.name,
          type: 'string',
          category: 'company',
          description: 'Company name'
        },
        {
          key: 'companyTrn',
          value: invoice.company.trn || '',
          type: 'string',
          category: 'company',
          description: 'Company TRN (Trade Registration Number)'
        }
      )

      // Last payment date
      if (invoice.payments.length > 0) {
        const lastPaymentDate = new Date(Math.max(...invoice.payments.map(p => p.paymentDate.getTime())))
        variables.push({
          key: 'lastPaymentDate',
          value: formatDate(lastPaymentDate),
          type: 'date',
          category: 'invoice',
          description: 'Date of last payment received'
        })
      }
    }
  }

  // Add additional customer variables if customerId is provided
  if (context.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: context.customerId },
      include: {
        invoices: {
          where: { status: { in: ['SENT', 'OVERDUE'] } }
        }
      }
    })

    if (customer) {
      const totalOutstanding = customer.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount), 0)

      variables.push(
        {
          key: 'customerNameAr',
          value: customer.nameAr || '',
          type: 'string',
          category: 'customer',
          description: 'Customer name in Arabic'
        },
        {
          key: 'customerPhone',
          value: customer.phone || '',
          type: 'string',
          category: 'customer',
          description: 'Customer phone number'
        },
        {
          key: 'customerPaymentTerms',
          value: customer.paymentTerms || 30,
          type: 'number',
          category: 'customer',
          description: 'Customer payment terms (days)'
        },
        {
          key: 'customerNotes',
          value: customer.notes || '',
          type: 'string',
          category: 'customer',
          description: 'Customer notes'
        },
        {
          key: 'customerNotesAr',
          value: customer.notesAr || '',
          type: 'string',
          category: 'customer',
          description: 'Customer notes in Arabic'
        },
        {
          key: 'outstandingInvoiceCount',
          value: customer.invoices.length,
          type: 'number',
          category: 'customer',
          description: 'Number of outstanding invoices'
        },
        {
          key: 'totalOutstanding',
          value: formatCurrency(totalOutstanding, 'AED'),
          type: 'currency',
          category: 'customer',
          description: 'Total outstanding amount across all invoices'
        }
      )

      // Add business-specific fields
      if (customer.trn) {
        variables.push({
          key: 'customerTrn',
          value: customer.trn,
          type: 'string',
          category: 'customer',
          description: 'Customer TRN (Trade Registration Number)'
        })
      }

      if (customer.businessType) {
        variables.push({
          key: 'customerBusinessType',
          value: customer.businessType,
          type: 'string',
          category: 'customer',
          description: 'Customer business type'
        })
      }
    }
  }

  // Add company variables
  const company = await prisma.company.findUnique({
    where: { id: context.companyId }
  })

  if (company) {
    variables.push(
      {
        key: 'companyName',
        value: company.name,
        type: 'string',
        category: 'company',
        description: 'Company name'
      },
      {
        key: 'companyTrn',
        value: company.trn || '',
        type: 'string',
        category: 'company',
        description: 'Company TRN'
      },
      {
        key: 'companyAddress',
        value: company.address || '',
        type: 'string',
        category: 'company',
        description: 'Company address'
      }
    )
  }

  // Add system variables
  const now = new Date()
  const locale = context.language === 'ar' ? 'ar-AE' : 'en-AE'

  variables.push(
    {
      key: 'currentDate',
      value: now.toLocaleDateString(locale),
      type: 'date',
      category: 'system',
      description: 'Current date'
    },
    {
      key: 'currentTime',
      value: now.toLocaleTimeString(locale),
      type: 'string',
      category: 'system',
      description: 'Current time'
    },
    {
      key: 'currentYear',
      value: now.getFullYear(),
      type: 'number',
      category: 'system',
      description: 'Current year'
    },
    {
      key: 'businessYear',
      value: now.getFullYear(),
      type: 'number',
      category: 'system',
      description: 'Current business year'
    }
  )

  // Add default contact variables
  variables.push(
    {
      key: 'supportEmail',
      value: process.env.SUPPORT_EMAIL || 'support@yourdomain.ae',
      type: 'string',
      category: 'company',
      description: 'Support email address'
    },
    {
      key: 'supportPhone',
      value: process.env.SUPPORT_PHONE || '+971-4-XXX-XXXX',
      type: 'string',
      category: 'company',
      description: 'Support phone number'
    }
  )

  return variables
}

/**
 * Replace template variables in content with actual values
 */
export function replaceTemplateVariables(
  content: string,
  variables: VariableValue[]
): string {
  let processedContent = content

  variables.forEach(variable => {
    const placeholder = `{{${variable.key}}}`
    const value = variable.value !== null && variable.value !== undefined ?
      String(variable.value) : ''

    processedContent = processedContent.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      value
    )
  })

  return processedContent
}

/**
 * Extract variable placeholders from template content
 */
export function extractTemplateVariables(content: string): string[] {
  const variableRegex = /{{(\w+)}}/g
  const variables: string[] = []
  let match

  while ((match = variableRegex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }

  return variables.sort()
}

/**
 * Validate that all variables in template content are supported
 */
export async function validateTemplateVariables(
  content: string,
  context: VariableContext
): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
  missingVariables: string[]
  availableVariables: VariableValue[]
}> {
  const usedVariables = extractTemplateVariables(content)
  const availableVariables = await getTemplateVariables(context)
  const availableKeys = availableVariables.map(v => v.key)

  const missingVariables = usedVariables.filter(key => !availableKeys.includes(key))
  const errors: string[] = []
  const warnings: string[] = []

  // Check for missing variables
  if (missingVariables.length > 0) {
    errors.push(`Unknown variables: ${missingVariables.join(', ')}`)
  }

  // Check for invoice-specific variables without invoice context
  if (!context.invoiceId) {
    const invoiceVariables = usedVariables.filter(key =>
      availableVariables.find(v => v.key === key && v.category === 'invoice')
    )
    if (invoiceVariables.length > 0) {
      warnings.push(`Invoice variables (${invoiceVariables.join(', ')}) require invoice context`)
    }
  }

  // Check for customer-specific variables without customer context
  if (!context.customerId && !context.invoiceId) {
    const customerVariables = usedVariables.filter(key =>
      availableVariables.find(v => v.key === key && v.category === 'customer')
    )
    if (customerVariables.length > 0) {
      warnings.push(`Customer variables (${customerVariables.join(', ')}) require customer context`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingVariables,
    availableVariables
  }
}

/**
 * Generate preview content with sample data for template variables
 */
export function generatePreviewContent(
  content: string,
  language: 'en' | 'ar' = 'en'
): string {
  const sampleVariables: Record<string, string> = {
    // Invoice variables
    invoiceNumber: 'INV-2025-001',
    invoiceAmount: language === 'ar' ? '1,500.00 د.إ' : 'AED 1,500.00',
    invoiceSubtotal: language === 'ar' ? '1,428.57 د.إ' : 'AED 1,428.57',
    invoiceVatAmount: language === 'ar' ? '71.43 د.إ' : 'AED 71.43',
    invoiceTotalAmount: language === 'ar' ? '1,500.00 د.إ' : 'AED 1,500.00',
    invoiceCurrency: 'AED',
    invoiceStatus: language === 'ar' ? 'مستحق' : 'OVERDUE',
    invoiceDueDate: language === 'ar' ? '15 يناير 2025' : 'January 15, 2025',
    invoiceDescription: language === 'ar' ? 'خدمات استشارية' : 'Consulting services',
    daysPastDue: '5',
    totalPaid: language === 'ar' ? '0.00 د.إ' : 'AED 0.00',
    outstandingAmount: language === 'ar' ? '1,500.00 د.إ' : 'AED 1,500.00',
    itemCount: '3',

    // Customer variables
    customerName: language === 'ar' ? 'شركة الإمارات للتجارة ذ.م.م' : 'Emirates Trading Company LLC',
    customerNameAr: 'شركة الإمارات للتجارة ذ.م.م',
    customerEmail: 'accounts@emiratestrading.ae',
    customerPhone: '+971 4 123 4567',
    customerPaymentTerms: '30',
    customerTrn: '100234567890003',
    customerBusinessType: language === 'ar' ? 'شركة ذات مسئولية محدودة' : 'LLC',
    outstandingInvoiceCount: '2',
    totalOutstanding: language === 'ar' ? '3,250.00 د.إ' : 'AED 3,250.00',

    // Company variables
    companyName: language === 'ar' ? 'حلول الفواتير الذكية' : 'Smart Invoice Solutions',
    companyTrn: '100123456789001',
    companyAddress: language === 'ar' ? 'دبي، الإمارات العربية المتحدة' : 'Dubai, United Arab Emirates',
    supportEmail: 'support@smartinvoice.ae',
    supportPhone: '+971 4 567 8901',

    // System variables
    currentDate: language === 'ar' ? '20 يناير 2025' : 'January 20, 2025',
    currentTime: language === 'ar' ? '10:30 ص' : '10:30 AM',
    currentYear: '2025',
    businessYear: '2025',
    lastPaymentDate: language === 'ar' ? '10 ديسمبر 2024' : 'December 10, 2024'
  }

  let processedContent = content

  Object.entries(sampleVariables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    processedContent = processedContent.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      value
    )
  })

  return processedContent
}

/**
 * Get variables grouped by category for UI display
 */
export async function getVariablesByCategory(context: VariableContext): Promise<{
  invoice: VariableValue[]
  customer: VariableValue[]
  company: VariableValue[]
  system: VariableValue[]
}> {
  const variables = await getTemplateVariables(context)

  return {
    invoice: variables.filter(v => v.category === 'invoice'),
    customer: variables.filter(v => v.category === 'customer'),
    company: variables.filter(v => v.category === 'company'),
    system: variables.filter(v => v.category === 'system')
  }
}