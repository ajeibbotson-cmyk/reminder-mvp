import { z } from 'zod'
import { UserRole } from '@prisma/client'

// User creation schema
export const createUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .regex(/^[a-zA-Z\s]+$/, 'Name should only contain letters and spaces'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.FINANCE),
  companyId: z.string().uuid('Invalid company ID').optional()
})

// User update schema (all fields optional except ID)
export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .regex(/^[a-zA-Z\s]+$/, 'Name should only contain letters and spaces')
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required')
    .max(255, 'Email too long')
    .optional(),
  role: z.nativeEnum(UserRole).optional()
})

// Password change schema
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z
    .string()
    .min(1, 'Password confirmation is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

// Password reset request schema
export const resetPasswordRequestSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required')
})

// Password reset schema
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z
    .string()
    .min(1, 'Password confirmation is required')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

// User query schema for filtering/pagination
export const userQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1)
    .refine((val) => val > 0, 'Page must be greater than 0'),
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 10)
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  search: z
    .string()
    .max(255, 'Search term too long')
    .optional(),
  role: z
    .nativeEnum(UserRole)
    .optional(),
  sortBy: z
    .enum(['name', 'email', 'role', 'createdAt', 'updatedAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc')
})

// User response schema (what we send back to clients)
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.nativeEnum(UserRole),
  companyId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  company: z.object({
    id: z.string(),
    name: z.string(),
    trn: z.string().nullable()
  }).optional()
})

// Bulk operations schemas
export const bulkDeleteUsersSchema = z.object({
  userIds: z
    .array(z.string().uuid('Invalid user ID'))
    .min(1, 'At least one user ID is required')
    .max(50, 'Cannot delete more than 50 users at once')
})

export const bulkUpdateUsersSchema = z.object({
  userIds: z
    .array(z.string().uuid('Invalid user ID'))
    .min(1, 'At least one user ID is required')
    .max(50, 'Cannot update more than 50 users at once'),
  updates: z.object({
    role: z.nativeEnum(UserRole).optional()
  }).refine((data) => Object.keys(data).length > 0, 'At least one field must be updated')
})

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UserQueryInput = z.infer<typeof userQuerySchema>
export type UserResponse = z.infer<typeof userResponseSchema>
export type BulkDeleteUsersInput = z.infer<typeof bulkDeleteUsersSchema>
export type BulkUpdateUsersInput = z.infer<typeof bulkUpdateUsersSchema>