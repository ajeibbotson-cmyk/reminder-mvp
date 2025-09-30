import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { NextIntlProvider } from 'next-intl'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'

// Mock translations for testing
const messages = {
  templateBuilder: {
    editTemplate: 'Edit Template',
    createTemplate: 'Create Template',
    builderDescription: 'Create and manage email templates',
    basicInfo: 'Basic Info',
    content: 'Content',
    settings: 'Settings',
    advanced: 'Advanced',
    templateInformation: 'Template Information',
    basicInfoDescription: 'Basic template information',
    templateName: 'Template Name',
    enterTemplateName: 'Enter template name',
    templateCategory: 'Template Category',
    description: 'Description',
    enterDescription: 'Enter description',
    quickTemplates: 'Quick Templates',
    preBuiltTemplates: 'Pre-built templates for UAE businesses',
    emailContent: 'Email Content',
    bilingualSupport: 'Bilingual support for English and Arabic',
    editingLanguage: 'Editing Language',
    emailSubject: 'Email Subject',
    enterSubjectEn: 'Enter English subject',
    enterSubjectAr: 'Enter Arabic subject',
    emailBody: 'Email Body',
    enterBodyEn: 'Enter English body',
    enterBodyAr: 'Enter Arabic body',
    useVariablesEn: 'Use variables like {{customer_name}}',
    useVariablesAr: 'Use variables like {{customer_name}}',
    templateSettings: 'Template Settings',
    priority: 'Priority',
    lowPriority: 'Low',
    normalPriority: 'Normal',
    highPriority: 'High',
    preferredSendTime: 'Preferred Send Time',
    uaeBusinessHours: 'UAE business hours: 9 AM - 6 PM',
    timezone: 'Timezone',
    businessHoursOnly: 'Send only during business hours',
    businessHoursDescription: 'Emails will only be sent during UAE business hours',
    advancedOptions: 'Advanced Options',
    tags: 'Tags',
    tagsDescription: 'Add tags to organize templates',
    enterTag: 'Enter tag',
    activeTemplate: 'Active Template',
    activeTemplateDescription: 'Enable this template for use',
    templateVariables: 'Template Variables',
    clickToInsert: 'Click to insert variable',
    'variableCategory.customer': 'Customer',
    'variableCategory.invoice': 'Invoice',
    'variableCategory.company': 'Company',
    'variableCategory.system': 'System',
    cancel: 'Cancel',
    saving: 'Saving...',
    saveTemplate: 'Save Template',
    updateTemplate: 'Update Template',
    hidePreview: 'Hide Preview',
    showPreview: 'Show Preview'
  },
  templateLibrary: {
    templateLibrary: 'Template Library',
    libraryDescription: 'Browse and import pre-built templates',
    import: 'Import',
    export: 'Export',
    searchTemplates: 'Search templates...',
    allCategories: 'All Categories',
    templates: 'templates',
    timesUsed: 'times used',
    effective: 'effective',
    popular: 'popular',
    effectiveness: 'Effectiveness',
    highEffectiveness: 'High',
    mediumEffectiveness: 'Medium',
    lowEffectiveness: 'Low',
    preview: 'Preview',
    useTemplate: 'Use Template',
    noTemplatesFound: 'No templates found',
    noTemplatesFoundDescription: 'Try adjusting your search criteria',
    clearFilters: 'Clear Filters',
    previewNote: 'This is how the email will appear to recipients',
    subject: 'Subject',
    body: 'Body',
    close: 'Close'
  }
}

// Mock session for testing
export const mockSession: Session = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  },
  expires: '2024-12-31'
}

// Enhanced session with company data
export const mockSessionWithCompany: Session & { user: { companyId: string; role: string } } = {
  ...mockSession,
  user: {
    ...mockSession.user!,
    companyId: 'test-company-id',
    role: 'ADMIN'
  }
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: string
  session?: Session | null
}

export function renderWithProviders(
  ui: ReactElement,
  {
    locale = 'en',
    session = mockSession,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider session={session}>
        <NextIntlProvider locale={locale} messages={messages}>
          {children}
        </NextIntlProvider>
      </SessionProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock Prisma client for testing
export const mockPrisma = {
  emailTemplate: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn()
  },
  emailLog: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn()
  },
  activity: {
    create: jest.fn()
  },
  company: {
    findUnique: jest.fn(),
    findFirst: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn()
  },
  customer: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  invoice: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  }
}

// Mock template data for testing
export const mockTemplateData = {
  basic: {
    id: 'test-template-1',
    companyId: 'test-company-id',
    name: 'Test Template',
    description: 'A test template',
    templateType: 'FOLLOW_UP' as const,
    subjectEn: 'Test Subject {{customer_name}}',
    subjectAr: 'موضوع تجريبي {{customer_name_ar}}',
    contentEn: 'Dear {{customer_name}}, This is a test email.',
    contentAr: 'عزيزي {{customer_name_ar}}، هذا بريد إلكتروني تجريبي.',
    variables: {},
    version: 1,
    isActive: true,
    isDefault: false,
    uaeBusinessHoursOnly: true,
    createdBy: 'test-user-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com'
    },
    _count: {
      emailLogs: 5
    }
  },
  gentle: {
    id: 'gentle-template-1',
    companyId: 'test-company-id',
    name: 'Gentle Reminder',
    description: 'Professional, respectful reminder',
    templateType: 'FOLLOW_UP' as const,
    subjectEn: 'Friendly Payment Reminder - Invoice {{invoice_number}}',
    subjectAr: 'تذكير ودي بالدفع - فاتورة {{invoice_number}}',
    contentEn: 'Dear {{customer_name}}, This is a gentle reminder...',
    contentAr: 'عزيزي {{customer_name_ar}}، هذا تذكير ودي...',
    variables: {
      'customer_name': 'Customer name',
      'customer_name_ar': 'Arabic customer name',
      'invoice_number': 'Invoice number'
    },
    version: 1,
    isActive: true,
    isDefault: true,
    uaeBusinessHoursOnly: true,
    createdBy: 'test-user-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com'
    },
    _count: {
      emailLogs: 25
    }
  }
}

// Mock company data
export const mockCompanyData = {
  id: 'test-company-id',
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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
}

// Mock customer data
export const mockCustomerData = {
  id: 'test-customer-1',
  companyId: 'test-company-id',
  name: 'John Smith',
  nameAr: 'جون سميث',
  email: 'john@example.com',
  phone: '+971501234567',
  paymentTerms: 30,
  notes: 'VIP customer',
  notesAr: 'عميل مهم',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
}

// Mock invoice data
export const mockInvoiceData = {
  id: 'test-invoice-1',
  companyId: 'test-company-id',
  number: 'INV-001',
  customerName: 'John Smith',
  customerEmail: 'john@example.com',
  amount: 1000.00,
  subtotal: 952.38,
  vatAmount: 47.62,
  totalAmount: 1000.00,
  currency: 'AED',
  dueDate: new Date('2024-02-01'),
  status: 'SENT' as const,
  description: 'Test invoice',
  descriptionAr: 'فاتورة تجريبية',
  trnNumber: '100123456789012',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
}

// UAE-specific test constants
export const UAE_TEST_CONSTANTS = {
  businessHours: {
    start: '09:00',
    end: '18:00',
    timezone: 'Asia/Dubai',
    workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']
  },
  currency: 'AED',
  vatRate: 5.0,
  phoneFormat: '+971XXXXXXXXX',
  trnFormat: 'XXXXXXXXXXXXXXX', // 15 digits
  greetings: {
    en: ['Dear', 'Hello', 'Good morning'],
    ar: ['عزيزي', 'مرحباً', 'صباح الخير']
  },
  businessPhrases: {
    en: ['Thank you for your business', 'We appreciate your prompt payment'],
    ar: ['شكراً لثقتكم بنا', 'نقدر سرعة دفعكم']
  }
}

// Cultural appropriateness test data
export const CULTURAL_TEST_DATA = {
  appropriate: {
    greetings: ['Dear {{customer_name}}', 'Respected {{customer_name}}'],
    closings: ['Best regards', 'With appreciation', 'Thank you'],
    businessHours: 'Sunday to Thursday, 9:00 AM to 6:00 PM UAE time',
    paymentTerms: 'As per UAE commercial practices'
  },
  inappropriate: {
    greetings: ['Hey {{customer_name}}', 'Yo {{customer_name}}'],
    closings: ['Cheers', 'Later', 'XOXO'],
    urgency: ['PAY NOW!!!', 'URGENT!!!'],
    threats: ['We will sue you', 'Legal action immediately']
  },
  required: {
    trnMention: 'TRN: {{company_trn}}',
    businessHours: 'During UAE business hours',
    paymentPortal: 'Secure payment portal'
  }
}

// Helper functions for tests
export const testHelpers = {
  // Generate mock API response
  mockApiResponse: (data: any, message = 'Success') => ({
    success: true,
    message,
    data
  }),

  // Generate mock API error
  mockApiError: (message = 'Error', code = 400) => ({
    success: false,
    message,
    error: { code, message }
  }),

  // Check if text contains Arabic characters
  hasArabicText: (text: string): boolean => {
    const arabicRegex = /[\u0600-\u06FF]/
    return arabicRegex.test(text)
  },

  // Check if text follows UAE business format
  isUAEBusinessFormat: (text: string): boolean => {
    const patterns = [
      /TRN:\s*\d{15}/, // UAE TRN format
      /AED\s*[\d,]+/, // UAE currency
      /\+971\d{8,9}/, // UAE phone format
      /(Sunday|Monday|Tuesday|Wednesday|Thursday).*UAE/i // Business days mention
    ]
    return patterns.some(pattern => pattern.test(text))
  },

  // Validate template variables
  validateTemplateVariables: (content: string): string[] => {
    const variableRegex = /\{\{([^}]+)\}\}/g
    const matches = content.match(variableRegex) || []
    return matches.map(match => match.slice(2, -2).trim())
  },

  // Check cultural appropriateness
  checkCulturalAppropriateness: (content: string): { appropriate: boolean; issues: string[] } => {
    const issues: string[] = []
    
    // Check for inappropriate language
    const inappropriatePatterns = [
      /pay now!!!/i,
      /urgent!!!/i,
      /immediately!!!/i,
      /\bhey\b/i,
      /\byo\b/i
    ]
    
    inappropriatePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        issues.push(`Inappropriate language detected: ${pattern.source}`)
      }
    })
    
    // Check for required UAE elements
    if (!content.includes('TRN')) {
      issues.push('Missing TRN reference')
    }
    
    return {
      appropriate: issues.length === 0,
      issues
    }
  }
}

// Re-export testing library utilities
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'