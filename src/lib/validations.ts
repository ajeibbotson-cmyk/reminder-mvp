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

export const updateInvoiceSchema = createInvoiceSchema.partial().omit({ companyId: true })

export const invoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
})

export const invoiceFiltersSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  status: z.nativeEnum(InvoiceStatus).optional(),
  customerEmail: emailSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// Customer validation schemas
export const createCustomerSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Customer name is required'),
  email: emailSchema,
  phone: uaePhoneSchema,
  paymentTerms: z.number().int().positive().max(365).optional(),
  notes: z.string().optional(),
})

export const updateCustomerSchema = createCustomerSchema.partial().omit({ companyId: true })

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
  vatAmount: z.number().min(0).default(0).multipleOf(0.01),
  totalWithVat: z.number().min(0).optional().multipleOf(0.01),
  taxCategory: z.enum(['STANDARD', 'EXEMPT', 'ZERO_RATED']).default('STANDARD'),
})

// Enhanced invoice schema with VAT support
export const createInvoiceWithVatSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  number: z.string().min(1, 'Invoice number is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: emailSchema,
  amount: z.number().positive('Amount must be positive').multipleOf(0.01),
  subtotal: z.number().positive('Subtotal must be positive').multipleOf(0.01),
  vatAmount: z.number().min(0).default(0).multipleOf(0.01),
  totalAmount: z.number().positive('Total amount must be positive').multipleOf(0.01),
  currency: currencySchema,
  dueDate: z.coerce.date().min(new Date(), 'Due date must be in the future'),
  status: z.nativeEnum(InvoiceStatus).default('SENT'),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  notes: z.string().optional(),
  notesAr: z.string().optional(),
  importBatchId: z.string().optional(),
  trnNumber: uaeTrnSchema,
  items: z.array(invoiceLineItemSchema).min(1, 'At least one item is required'),
})

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