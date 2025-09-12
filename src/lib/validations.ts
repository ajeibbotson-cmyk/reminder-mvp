import { z } from 'zod'
import { InvoiceStatus, PaymentMethod, UserRole } from '@prisma/client'

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

// Utility function to validate query parameters
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params = Object.fromEntries(searchParams.entries())
  return schema.parse(params)
}