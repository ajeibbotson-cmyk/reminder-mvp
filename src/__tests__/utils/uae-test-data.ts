/**
 * UAE-specific test data utilities for comprehensive testing
 * Provides realistic UAE business data for testing invoice management system
 */

import { faker } from '@faker-js/faker'

// Configure faker for UAE locale
faker.setLocale('en')

// UAE-specific business data constants
export const UAE_BUSINESS_DATA = {
  currencies: ['AED'],
  businessHours: {
    start: '08:00',
    end: '18:00',
    timezone: 'Asia/Dubai',
    workingDays: [1, 2, 3, 4, 5, 6] // Sunday to Friday
  },
  emirates: [
    'Abu Dhabi',
    'Dubai', 
    'Sharjah',
    'Ajman',
    'Umm Al Quwain',
    'Ras Al Khaimah',
    'Fujairah'
  ],
  businessTypes: [
    'Trading Company',
    'Construction Company',
    'Technology Services',
    'Consulting Services',
    'Import/Export',
    'Retail Business',
    'Manufacturing',
    'Hospitality Services'
  ],
  bankNames: [
    'Emirates NBD',
    'First Abu Dhabi Bank',
    'Dubai Islamic Bank',
    'ADCB',
    'HSBC UAE',
    'Mashreq Bank',
    'CBD Now',
    'ENBD'
  ]
} as const

// TRN (Tax Registration Number) generator
export const generateTRN = (): string => {
  return `100${faker.number.int({ min: 100000000, max: 999999999 })}`
}

// UAE phone number generator
export const generateUAEPhone = (): string => {
  const prefixes = ['050', '052', '054', '055', '056', '058']
  const prefix = faker.helpers.arrayElement(prefixes)
  const number = faker.number.int({ min: 1000000, max: 9999999 })
  return `+971${prefix}${number}`
}

// UAE business email generator
export const generateBusinessEmail = (companyName?: string): string => {
  const domain = companyName 
    ? `${companyName.toLowerCase().replace(/\s+/g, '')}.ae`
    : `${faker.company.name().toLowerCase().replace(/\s+/g, '')}.ae`
  return `${faker.person.firstName().toLowerCase()}@${domain}`
}

// UAE address generator
export const generateUAEAddress = (): {
  street: string
  area: string
  emirate: string
  poBox: string
  country: string
} => {
  return {
    street: `${faker.location.streetName()}, ${faker.location.buildingNumber()}`,
    area: faker.location.city(),
    emirate: faker.helpers.arrayElement(UAE_BUSINESS_DATA.emirates),
    poBox: `P.O. Box ${faker.number.int({ min: 1000, max: 999999 })}`,
    country: 'United Arab Emirates'
  }
}

// Generate realistic UAE company data
export const generateUAECompany = (): {
  id: string
  name: string
  nameAr?: string
  trn: string
  email: string
  phone: string
  address: ReturnType<typeof generateUAEAddress>
  businessType: string
  bankAccount: {
    accountNumber: string
    bankName: string
    iban: string
  }
  logo?: string
  isActive: boolean
  createdAt: Date
} => {
  const companyName = faker.company.name()
  return {
    id: faker.string.uuid(),
    name: companyName,
    nameAr: `شركة ${faker.company.name()}`, // Arabic company name
    trn: generateTRN(),
    email: generateBusinessEmail(companyName),
    phone: generateUAEPhone(),
    address: generateUAEAddress(),
    businessType: faker.helpers.arrayElement(UAE_BUSINESS_DATA.businessTypes),
    bankAccount: {
      accountNumber: faker.finance.accountNumber(12),
      bankName: faker.helpers.arrayElement(UAE_BUSINESS_DATA.bankNames),
      iban: `AE${faker.number.int({ min: 10, max: 99 })}${faker.finance.accountNumber(19)}`
    },
    logo: faker.image.url(),
    isActive: true,
    createdAt: faker.date.past({ years: 2 })
  }
}

// Generate realistic UAE customer data
export const generateUAECustomer = (): {
  id: string
  name: string
  nameAr?: string
  email: string
  phone: string
  address: ReturnType<typeof generateUAEAddress>
  trn?: string
  isIndividual: boolean
  preferredLanguage: 'en' | 'ar'
  createdAt: Date
} => {
  const isIndividual = faker.datatype.boolean()
  return {
    id: faker.string.uuid(),
    name: isIndividual ? faker.person.fullName() : faker.company.name(),
    nameAr: isIndividual 
      ? `${faker.person.firstName()} ${faker.person.lastName()}` 
      : `شركة ${faker.company.name()}`,
    email: faker.internet.email(),
    phone: generateUAEPhone(),
    address: generateUAEAddress(),
    trn: !isIndividual ? generateTRN() : undefined,
    isIndividual,
    preferredLanguage: faker.helpers.arrayElement(['en', 'ar']),
    createdAt: faker.date.past({ years: 1 })
  }
}

// Generate realistic invoice data
export const generateUAEInvoice = (overrides?: Partial<any>): {
  id: string
  invoiceNumber: string
  companyId: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  amount: number
  vatAmount: number
  totalAmount: number
  currency: string
  dueDate: Date
  issueDate: Date
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'
  description: string
  descriptionAr?: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    vatRate: number
  }>
  paymentTerms: string
  notes?: string
  notesAr?: string
  createdAt: Date
  updatedAt: Date
} => {
  const amount = faker.number.float({ min: 100, max: 50000, fractionDigits: 2 })
  const vatRate = 0.05 // 5% VAT in UAE
  const vatAmount = amount * vatRate
  const totalAmount = amount + vatAmount
  
  const baseInvoice = {
    id: faker.string.uuid(),
    invoiceNumber: `INV-${faker.number.int({ min: 10000, max: 99999 })}`,
    companyId: faker.string.uuid(),
    customerId: faker.string.uuid(),
    customerName: faker.company.name(),
    customerEmail: faker.internet.email(),
    customerPhone: generateUAEPhone(),
    amount,
    vatAmount,
    totalAmount,
    currency: 'AED',
    dueDate: faker.date.future({ days: 30 }),
    issueDate: faker.date.recent({ days: 7 }),
    status: faker.helpers.arrayElement(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const),
    description: faker.commerce.productDescription(),
    descriptionAr: `وصف المنتج: ${faker.commerce.product()}`,
    lineItems: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => {
      const quantity = faker.number.int({ min: 1, max: 10 })
      const unitPrice = faker.number.float({ min: 50, max: 1000, fractionDigits: 2 })
      const total = quantity * unitPrice
      return {
        description: faker.commerce.productName(),
        quantity,
        unitPrice,
        total,
        vatRate: 0.05
      }
    }),
    paymentTerms: faker.helpers.arrayElement(['Net 15', 'Net 30', 'Net 45', 'Due on Receipt']),
    notes: faker.lorem.sentence(),
    notesAr: 'ملاحظات إضافية للفاتورة',
    createdAt: faker.date.recent({ days: 30 }),
    updatedAt: faker.date.recent({ days: 7 })
  }

  return { ...baseInvoice, ...overrides }
}

// Generate batch of invoices for testing large datasets
export const generateInvoiceBatch = (count: number, overrides?: Partial<any>): ReturnType<typeof generateUAEInvoice>[] => {
  return Array.from({ length: count }, () => generateUAEInvoice(overrides))
}

// Generate CSV content for import testing
export const generateCSVContent = (invoices: ReturnType<typeof generateUAEInvoice>[]): string => {
  const headers = [
    'customerName',
    'customerEmail', 
    'customerPhone',
    'invoiceNumber',
    'amount',
    'currency',
    'dueDate',
    'description',
    'paymentTerms',
    'notes'
  ]

  const rows = invoices.map(invoice => [
    invoice.customerName,
    invoice.customerEmail,
    invoice.customerPhone,
    invoice.invoiceNumber,
    invoice.amount.toString(),
    invoice.currency,
    invoice.dueDate.toISOString().split('T')[0],
    invoice.description,
    invoice.paymentTerms,
    invoice.notes || ''
  ])

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')
}

// Mock external service responses
export const mockAWSResponse = {
  ses: {
    sendEmail: {
      MessageId: faker.string.uuid(),
      ResponseMetadata: {
        RequestId: faker.string.uuid(),
        HTTPStatusCode: 200
      }
    }
  }
}

export const mockPaymentGatewayResponse = {
  success: {
    transactionId: faker.string.uuid(),
    status: 'completed',
    amount: faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
    currency: 'AED',
    paymentMethod: faker.helpers.arrayElement(['card', 'bank_transfer', 'digital_wallet']),
    processedAt: new Date().toISOString()
  },
  failure: {
    error: 'insufficient_funds',
    message: 'Transaction declined due to insufficient funds',
    code: 'E001'
  }
}

// Test scenarios for different business cases
export const testScenarios = {
  // Large import scenarios
  largeImport: {
    size: 1000,
    description: 'Large batch import with 1000+ invoices',
    generateData: () => generateInvoiceBatch(1000)
  },
  
  // Error scenarios
  invalidData: {
    missingRequiredFields: () => generateUAEInvoice({
      customerName: '',
      customerEmail: 'invalid-email',
      amount: -100
    }),
    invalidTRN: () => generateUAEInvoice({
      customerName: 'Test Company',
      // Invalid TRN format
    }),
    invalidPhoneNumber: () => generateUAEInvoice({
      customerPhone: '123-456-7890' // Non-UAE format
    })
  },

  // Multi-tenant scenarios
  multiTenant: {
    company1: generateUAECompany(),
    company2: generateUAECompany(),
    generateIsolatedData: (companyId: string) => 
      generateInvoiceBatch(50, { companyId })
  },

  // Workflow scenarios
  invoiceLifecycle: {
    draft: () => generateUAEInvoice({ status: 'draft' }),
    sent: () => generateUAEInvoice({ status: 'sent' }),
    viewed: () => generateUAEInvoice({ status: 'viewed' }),
    paid: () => generateUAEInvoice({ status: 'paid' }),
    overdue: () => generateUAEInvoice({ 
      status: 'overdue',
      dueDate: faker.date.past({ days: 30 })
    })
  }
}

// Accessibility test helpers
export const accessibilityTestHelpers = {
  // Screen reader text expectations
  screenReaderTexts: {
    invoiceTable: 'Invoice management table',
    filterControls: 'Filter and search controls',
    bulkActions: 'Bulk actions for selected invoices',
    importProgress: 'Import progress indicator',
    statusUpdates: 'Invoice status updates'
  },
  
  // Keyboard navigation sequences
  keyboardSequences: {
    navigateTable: ['Tab', 'ArrowDown', 'ArrowUp', 'Enter'],
    bulkSelect: ['Space', 'Shift+ArrowDown', 'Ctrl+a'],
    filterSearch: ['Tab', 'Enter', 'Escape']
  },

  // ARIA attributes to test
  ariaAttributes: [
    'role',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-expanded',
    'aria-selected',
    'aria-sort'
  ]
}

// Performance test configurations
export const performanceConfig = {
  // Large dataset thresholds
  thresholds: {
    renderTime: 2000, // 2 seconds max
    searchResponseTime: 500, // 0.5 seconds max
    importProcessingTime: 30000, // 30 seconds max for 1000 records
    bulkActionTime: 5000 // 5 seconds max for bulk operations
  },

  // Load test scenarios
  loadTest: {
    concurrentUsers: 10,
    requestsPerSecond: 50,
    testDuration: 60 // seconds
  }
}

export default {
  UAE_BUSINESS_DATA,
  generateTRN,
  generateUAEPhone,
  generateBusinessEmail,
  generateUAEAddress,
  generateUAECompany,
  generateUAECustomer,
  generateUAEInvoice,
  generateInvoiceBatch,
  generateCSVContent,
  mockAWSResponse,
  mockPaymentGatewayResponse,
  testScenarios,
  accessibilityTestHelpers,
  performanceConfig
}