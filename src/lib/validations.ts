import { z } from 'zod'
import { 
  InvoiceStatus, 
  PaymentMethod, 
  UserRole,
  ImportBatchStatus,
  ImportType,
  ImportErrorType,
  EmailTemplateType,
  EmailLanguage,
  EmailDeliveryStatus
} from '@prisma/client'

// UAE-specific validation patterns
export const UAE_TRN_REGEX = /^\d{15}$/
export const UAE_PHONE_REGEX = /^(\+971|00971|971)?[0-9]{8,9}$/
export const UAE_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Common validation schemas
export const uaeTrnSchema = z.string()
  .regex(UAE_TRN_REGEX, 'TRN must be exactly 15 digits')
  .optional()

// Required TRN schema for customer creation
export const requiredUaeTrnSchema = z.string()
  .regex(UAE_TRN_REGEX, 'TRN must be exactly 15 digits')
  .min(15, 'TRN must be exactly 15 digits')
  .max(15, 'TRN must be exactly 15 digits')

export const uaePhoneSchema = z.string()
  .regex(UAE_PHONE_REGEX, 'Please enter a valid UAE phone number')
  .optional()

export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .regex(UAE_EMAIL_REGEX, 'Email format is not valid')

export const currencySchema = z.string()
  .length(3, 'Currency code must be 3 characters')
  .toUpperCase()
  .default('AED')

// Invoice validation schemas
export const createInvoiceSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  number: z.string().min(1, 'Invoice number is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: emailSchema,
  amount: z.number().positive('Amount must be positive').multipleOf(0.01),
  currency: currencySchema,
  dueDate: z.coerce.date().min(new Date(), 'Due date must be in the future'),
  description: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'Item description is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive').multipleOf(0.01),
    total: z.number().positive('Total must be positive').multipleOf(0.01),
  })).min(1, 'At least one item is required'),
})

// Base update schema - will be enhanced after createInvoiceWithVatSchema is defined
const baseUpdateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  number: z.string().min(1, 'Invoice number is required').optional(),
  customerName: z.string().min(1, 'Customer name is required').optional(),
  customerNameAr: z.string().optional(),
  customerEmail: emailSchema.optional(),
  customerPhone: uaePhoneSchema.optional(),
  amount: z.number().positive('Amount must be positive').multipleOf(0.01).optional(),
  subtotal: z.number().positive('Subtotal must be positive').multipleOf(0.01).optional(),
  vatAmount: z.number().min(0).multipleOf(0.01).optional(),
  totalAmount: z.number().positive('Total amount must be positive').multipleOf(0.01).optional(),
  currency: currencySchema.optional(),
  dueDate: z.coerce.date().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.never().optional(), // Prevent updating creation date
}).refine(
  (data) => {
    // If updating amounts, ensure consistency
    if (data.subtotal !== undefined && data.vatAmount !== undefined && data.totalAmount !== undefined) {
      const calculatedTotal = data.subtotal + data.vatAmount
      return Math.abs(calculatedTotal - data.totalAmount) < 0.01
    }
    return true
  },
  {
    message: 'VAT calculation error in update: subtotal + VAT amount must equal total amount',
    path: ['totalAmount']
  }
)

// Invoice status update with UAE business workflow validation
export const invoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
  reason: z.string().optional(), // Reason for status change (audit trail)
  notes: z.string().optional(), // Additional notes for status change
  notifyCustomer: z.boolean().default(false), // Whether to send notification to customer
  forceOverride: z.boolean().default(false), // Allow admin to override business rule restrictions
}).refine(
  (data) => {
    // Enhanced validation for UAE business rules
    // Certain status changes require reason for audit compliance
    if ([InvoiceStatus.DISPUTED, InvoiceStatus.WRITTEN_OFF].includes(data.status) && !data.reason && !data.forceOverride) {
      return false
    }
    
    return true
  },
  {
    message: 'DISPUTED and WRITTEN_OFF status changes require a reason for UAE audit compliance',
    path: ['reason']
  }
)

export const invoiceFiltersSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  customerEmail: emailSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  dueDateStart: z.coerce.date().optional(),
  dueDateEnd: z.coerce.date().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  trnNumber: z.string().optional(),
  search: z.string().optional(),
  isOverdue: z.coerce.boolean().optional(),
  hasPayments: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'number', 'customerName', 'amount', 'dueDate', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeAllPayments: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// UAE Business Types for customer validation
export const UAE_BUSINESS_TYPES = ['LLC', 'FREE_ZONE', 'SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'BRANCH'] as const
export type UAEBusinessType = typeof UAE_BUSINESS_TYPES[number]

// Customer validation schemas
export const createCustomerSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Customer name is required').max(200, 'Customer name is too long'),
  nameAr: z.string().max(200, 'Arabic name is too long').optional(),
  businessName: z.string().max(200, 'Business name is too long').optional(),
  email: emailSchema,
  phone: uaePhoneSchema,
  trn: uaeTrnSchema.optional(),
  businessType: z.enum(UAE_BUSINESS_TYPES).optional(),
  paymentTerms: z.number().int().min(1).max(365).default(30).optional(),
  creditLimit: z.number().positive().multipleOf(0.01).max(9999999999.99).optional(),
  notes: z.string().max(1000, 'Notes are too long').optional(),
  notesAr: z.string().max(1000, 'Arabic notes are too long').optional(),
}).refine(
  (data) => {
    // If business type is provided, business name should also be provided for proper record keeping
    if (data.businessType && !data.businessName) {
      return false
    }
    return true
  },
  {
    message: 'Business name is required when business type is specified',
    path: ['businessName']
  }
)

export const updateCustomerSchema = createCustomerSchema.partial().omit({ companyId: true })

// Customer search and filtering schema
export const customerFiltersSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  search: z.string().optional(),
  businessType: z.enum(UAE_BUSINESS_TYPES).optional(),
  hasOutstandingBalance: z.coerce.boolean().optional(),
  minCreditLimit: z.coerce.number().positive().optional(),
  maxCreditLimit: z.coerce.number().positive().optional(),
  paymentTermsMin: z.coerce.number().int().positive().optional(),
  paymentTermsMax: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.boolean().default(true),
  sortBy: z.enum(['name', 'email', 'createdAt', 'creditLimit', 'paymentTerms']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// Company validation schemas
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  trn: uaeTrnSchema,
  address: z.string().optional(),
  settings: z.record(z.any()).optional(),
})

export const updateCompanySchema = createCompanySchema.partial()

// User validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyId: z.string().min(1, 'Company ID is required'),
  role: z.nativeEnum(UserRole).default('FINANCE'),
})

export const updateUserSchema = createUserSchema.partial().omit({ password: true })

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// Follow-up sequence validation schemas
export const createFollowUpSequenceSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Sequence name is required'),
  steps: z.array(z.object({
    stepNumber: z.number().int().positive(),
    delayDays: z.number().int().min(0),
    emailSubject: z.string().min(1, 'Email subject is required'),
    emailContent: z.string().min(1, 'Email content is required'),
    active: z.boolean().default(true),
  })).min(1, 'At least one step is required'),
  active: z.boolean().default(true),
})

export const updateFollowUpSequenceSchema = createFollowUpSequenceSchema.partial().omit({ companyId: true })

// Payment validation schemas
export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Amount must be positive').multipleOf(0.01),
  paymentDate: z.coerce.date(),
  method: z.nativeEnum(PaymentMethod).default('BANK_TRANSFER'),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// Activity validation schemas
export const createActivitySchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  type: z.string().min(1, 'Activity type is required'),
  description: z.string().min(1, 'Activity description is required'),
  metadata: z.record(z.any()).optional(),
})

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const companyIdSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
})

// Utility function to validate and parse request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await request.json()
  return schema.parse(body)
}

// Week 2 Enhancement: CSV Import validation schemas
export const csvImportFieldMappingSchema = z.object({
  importBatchId: z.string().min(1, 'Import batch ID is required'),
  csvColumnName: z.string().min(1, 'CSV column name is required'),
  systemField: z.string().min(1, 'System field is required'),
  dataType: z.enum(['string', 'number', 'date', 'boolean', 'email', 'currency']).default('string'),
  isRequired: z.boolean().default(false),
  defaultValue: z.string().optional(),
  validationRule: z.string().optional(),
  transformation: z.string().optional(),
})

export const createImportBatchSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  filename: z.string().min(1, 'Filename is required'),
  originalFilename: z.string().min(1, 'Original filename is required'),
  fileSize: z.number().positive('File size must be positive'),
  importType: z.nativeEnum(ImportType).default('INVOICE'),
  fieldMappings: z.record(z.string()).optional(),
})

export const updateImportBatchSchema = z.object({
  status: z.nativeEnum(ImportBatchStatus).optional(),
  totalRecords: z.number().int().min(0).optional(),
  processedRecords: z.number().int().min(0).optional(),
  successfulRecords: z.number().int().min(0).optional(),
  failedRecords: z.number().int().min(0).optional(),
  processingStartedAt: z.coerce.date().optional(),
  processingEndedAt: z.coerce.date().optional(),
  errorSummary: z.string().optional(),
})

export const csvInvoiceRowSchema = z.object({
  number: z.string().min(1, 'Invoice number is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: emailSchema,
  amount: z.number().positive('Amount must be positive').or(z.string().transform((val) => parseFloat(val))),
  subtotal: z.number().positive().optional().or(z.string().transform((val) => val ? parseFloat(val) : undefined)),
  vatAmount: z.number().min(0).optional().or(z.string().transform((val) => val ? parseFloat(val) : undefined)),
  totalAmount: z.number().positive().optional().or(z.string().transform((val) => val ? parseFloat(val) : undefined)),
  currency: currencySchema,
  dueDate: z.string().transform((val) => new Date(val)).pipe(z.date()),
  status: z.nativeEnum(InvoiceStatus).optional().default('SENT'),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  notes: z.string().optional(),
  notesAr: z.string().optional(),
  trnNumber: uaeTrnSchema,
  // Line items as JSON string or array
  items: z.string().transform((val) => {
    try {
      return JSON.parse(val)
    } catch {
      return []
    }
  }).pipe(z.array(z.object({
    description: z.string().min(1, 'Item description is required'),
    descriptionAr: z.string().optional(),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive'),
    total: z.number().positive('Total must be positive'),
    vatRate: z.number().min(0).max(100).default(5),
    vatAmount: z.number().min(0).default(0),
    totalWithVat: z.number().min(0).optional(),
    taxCategory: z.enum(['STANDARD', 'EXEMPT', 'ZERO_RATED']).default('STANDARD'),
  }))).optional().default([]),
})

// Week 2 Enhancement: Email Integration validation schemas
export const createEmailTemplateSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  templateType: z.nativeEnum(EmailTemplateType).default('FOLLOW_UP'),
  subjectEn: z.string().min(1, 'English subject is required'),
  subjectAr: z.string().optional(),
  contentEn: z.string().min(1, 'English content is required'),
  contentAr: z.string().optional(),
  variables: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  uaeBusinessHoursOnly: z.boolean().default(true),
  createdBy: z.string().min(1, 'Created by user ID is required'),
})

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial().omit({ companyId: true, createdBy: true })

export const sendEmailSchema = z.object({
  templateId: z.string().optional(),
  companyId: z.string().min(1, 'Company ID is required'),
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  recipientEmail: emailSchema,
  recipientName: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  language: z.nativeEnum(EmailLanguage).default('ENGLISH'),
  uaeSendTime: z.coerce.date().optional(),
  variables: z.record(z.any()).optional(),
})

export const emailDeliveryFilterSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  templateId: z.string().optional(),
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  recipientEmail: emailSchema.optional(),
  deliveryStatus: z.nativeEnum(EmailDeliveryStatus).optional(),
  language: z.nativeEnum(EmailLanguage).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// Week 2 Enhancement: VAT Calculation validation schemas
export const vatCalculationSchema = z.object({
  subtotal: z.number().positive('Subtotal must be positive'),
  vatRate: z.number().min(0).max(100).default(5), // UAE standard VAT rate is 5%
  taxCategory: z.enum(['STANDARD', 'EXEMPT', 'ZERO_RATED']).default('STANDARD'),
  currency: currencySchema,
})

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  descriptionAr: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive').multipleOf(0.01),
  unitPrice: z.number().positive('Unit price must be positive').multipleOf(0.01),
  total: z.number().positive('Total must be positive').multipleOf(0.01),
  vatRate: z.number().min(0).max(100).default(5),
  vatAmount: z.number().min(0).multipleOf(0.01).default(0),
  totalWithVat: z.number().min(0).multipleOf(0.01).optional(),
  taxCategory: z.enum(['STANDARD', 'EXEMPT', 'ZERO_RATED']).default('STANDARD'),
})

// Enhanced invoice schema with UAE VAT support and bilingual fields
export const createInvoiceWithVatSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  number: z.string().min(1, 'Invoice number is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerNameAr: z.string().optional(),
  customerEmail: emailSchema,
  customerPhone: uaePhoneSchema,
  customerNotes: z.string().optional(),
  customerNotesAr: z.string().optional(),
  paymentTerms: z.number().int().positive().max(365).default(30).optional(),
  amount: z.number().positive('Amount must be positive').multipleOf(0.01),
  subtotal: z.number().positive('Subtotal must be positive').multipleOf(0.01).optional(),
  vatAmount: z.number().min(0).multipleOf(0.01).default(0).optional(),
  totalAmount: z.number().positive('Total amount must be positive').multipleOf(0.01),
  currency: currencySchema,
  dueDate: z.coerce.date(),
  status: z.nativeEnum(InvoiceStatus).default('SENT'),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  notes: z.string().optional(),
  notesAr: z.string().optional(),
  importBatchId: z.string().optional(),
  trnNumber: uaeTrnSchema,
  items: z.array(invoiceLineItemSchema).min(1, 'At least one item is required').optional(),
}).refine(
  (data) => {
    // Validate VAT calculations if all fields are provided
    if (data.subtotal && data.vatAmount && data.totalAmount) {
      const calculatedTotal = data.subtotal + data.vatAmount
      return Math.abs(calculatedTotal - data.totalAmount) < 0.01
    }
    return true
  },
  {
    message: 'VAT calculation error: subtotal + VAT amount must equal total amount',
    path: ['totalAmount']
  }
).refine(
  (data) => {
    // Ensure due date is reasonable (not too far in the past)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return data.dueDate >= thirtyDaysAgo
  },
  {
    message: 'Due date cannot be more than 30 days in the past',
    path: ['dueDate']
  }
)

// Bulk operations schemas
export const bulkInvoiceActionSchema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1, 'At least one invoice ID is required'),
  action: z.enum(['update_status', 'delete', 'send_reminder', 'export']),
  status: z.nativeEnum(InvoiceStatus).optional(),
  emailTemplateId: z.string().optional(),
})

export const bulkImportValidationSchema = z.object({
  importBatchId: z.string().min(1, 'Import batch ID is required'),
  validateOnly: z.boolean().default(false),
  rollbackOnError: z.boolean().default(true),
  chunkSize: z.number().int().positive().max(1000).default(100),
})

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['csv', 'xlsx', 'xls']),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  companyId: z.string().min(1, 'Company ID is required'),
  importType: z.nativeEnum(ImportType).default('INVOICE'),
})

// UAE Business Hours validation
export const uaeBusinessHoursSchema = z.object({
  timezone: z.string().default('Asia/Dubai'),
  workingDays: z.array(z.number().min(0).max(6)).default([0, 1, 2, 3, 4]), // Sun-Thu
  startHour: z.number().min(0).max(23).default(8),
  endHour: z.number().min(0).max(23).default(18),
  allowWeekends: z.boolean().default(false),
  allowHolidays: z.boolean().default(false),
})

// Utility function to validate TRN format
export function validateUAETRN(trn: string): boolean {
  if (!trn) return true // Optional field
  return UAE_TRN_REGEX.test(trn.replace(/\s/g, ''))
}

// Utility function to validate query parameters
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params = Object.fromEntries(searchParams.entries())
  return schema.parse(params)
}

// Utility function to validate multipart form data
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): T {
  const data: Record<string, unknown> = {}
  
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      data[key] = {
        name: value.name,
        size: value.size,
        type: value.type,
        lastModified: value.lastModified
      }
    } else {
      // Try to parse JSON, fallback to string
      try {
        data[key] = JSON.parse(value as string)
      } catch {
        data[key] = value
      }
    }
  }
  
  return schema.parse(data)
}

// Export the full update invoice schema (defined here to avoid circular dependency)
export const updateInvoiceSchema = baseUpdateInvoiceSchema