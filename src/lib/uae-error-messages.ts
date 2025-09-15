// Bilingual error messages for UAE compliance
export interface BilingualMessage {
  en: string
  ar: string
}

// Customer validation error messages
export const CUSTOMER_VALIDATION_ERRORS: Record<string, BilingualMessage> = {
  // Required field errors
  NAME_REQUIRED: {
    en: 'Customer name is required',
    ar: 'اسم العميل مطلوب'
  },
  EMAIL_REQUIRED: {
    en: 'Email address is required',
    ar: 'عنوان البريد الإلكتروني مطلوب'
  },
  EMAIL_INVALID: {
    en: 'Please enter a valid email address',
    ar: 'يرجى إدخال عنوان بريد إلكتروني صحيح'
  },
  
  // TRN validation errors
  TRN_INVALID_FORMAT: {
    en: 'TRN must be exactly 15 digits',
    ar: 'الرقم الضريبي يجب أن يكون 15 رقماً بالضبط'
  },
  TRN_REQUIRED_FOR_BUSINESS: {
    en: 'TRN is required for this business type',
    ar: 'الرقم الضريبي مطلوب لهذا النوع من الأعمال'
  },
  TRN_DUPLICATE: {
    en: 'A customer with this TRN already exists',
    ar: 'يوجد عميل آخر بنفس الرقم الضريبي'
  },
  TRN_CHECKSUM_INVALID: {
    en: 'Invalid TRN checksum',
    ar: 'الرقم الضريبي غير صحيح'
  },
  
  // Phone validation errors
  PHONE_INVALID_FORMAT: {
    en: 'Please enter a valid UAE phone number',
    ar: 'يرجى إدخال رقم هاتف صحيح في دولة الإمارات'
  },
  
  // Business type errors
  BUSINESS_TYPE_INVALID: {
    en: 'Invalid business type selected',
    ar: 'نوع النشاط التجاري المحدد غير صحيح'
  },
  BUSINESS_NAME_REQUIRED_FOR_TYPE: {
    en: 'Business name is required for this business type',
    ar: 'اسم المؤسسة مطلوب لهذا النوع من الأعمال'
  },
  
  // Payment terms errors
  PAYMENT_TERMS_OUT_OF_RANGE: {
    en: 'Payment terms must be between {min} and {max} days for this business type',
    ar: 'شروط الدفع يجب أن تكون بين {min} و {max} يوماً لهذا النوع من الأعمال'
  },
  PAYMENT_TERMS_NOT_STANDARD: {
    en: 'Payment terms should be one of the standard UAE terms: 7, 15, 30, 45, 60, or 90 days',
    ar: 'شروط الدفع يجب أن تكون إحدى الشروط المعيارية في الإمارات: 7، 15، 30، 45، 60، أو 90 يوماً'
  },
  
  // Credit limit errors
  CREDIT_LIMIT_NEGATIVE: {
    en: 'Credit limit cannot be negative',
    ar: 'حد الائتمان لا يمكن أن يكون سالباً'
  },
  CREDIT_LIMIT_EXCEEDS_MAXIMUM: {
    en: 'Credit limit exceeds the maximum allowed amount',
    ar: 'حد الائتمان يتجاوز الحد الأقصى المسموح'
  },
  CREDIT_LIMIT_HIGH_FOR_BUSINESS_TYPE: {
    en: 'Credit limit is unusually high for this business type',
    ar: 'حد الائتمان مرتفع بشكل غير اعتيادي لهذا النوع من الأعمال'
  },
  
  // Access and permission errors
  ACCESS_DENIED: {
    en: 'Access denied to company data',
    ar: 'تم رفض الوصول إلى بيانات الشركة'
  },
  INSUFFICIENT_PERMISSIONS: {
    en: 'Insufficient permissions for this operation',
    ar: 'صلاحيات غير كافية لهذه العملية'
  },
  CUSTOMER_NOT_FOUND: {
    en: 'Customer not found or access denied',
    ar: 'العميل غير موجود أو تم رفض الوصول'
  },
  
  // Business rule violations
  CUSTOMER_HAS_ACTIVE_INVOICES: {
    en: 'Cannot delete customer with active invoices',
    ar: 'لا يمكن حذف عميل لديه فواتير نشطة'
  },
  CUSTOMER_HAS_UNPAID_INVOICES: {
    en: 'Cannot delete customer with unpaid invoices',
    ar: 'لا يمكن حذف عميل لديه فواتير غير مدفوعة'
  },
  OUTSTANDING_BALANCE_EXCEEDS_LIMIT: {
    en: 'Outstanding balance exceeds credit limit',
    ar: 'الرصيد المستحق يتجاوز حد الائتمان'
  },
  
  // Data integrity errors
  EMAIL_DUPLICATE: {
    en: 'A customer with this email already exists in your company',
    ar: 'يوجد عميل آخر بنفس البريد الإلكتروني في شركتك'
  },
  NAME_TOO_LONG: {
    en: 'Customer name is too long (maximum 200 characters)',
    ar: 'اسم العميل طويل جداً (الحد الأقصى 200 حرف)'
  },
  NOTES_TOO_LONG: {
    en: 'Notes are too long (maximum 1000 characters)',
    ar: 'الملاحظات طويلة جداً (الحد الأقصى 1000 حرف)'
  },
  
  // Search and filtering errors
  SEARCH_QUERY_TOO_SHORT: {
    en: 'Search query must be at least 2 characters',
    ar: 'استعلام البحث يجب أن يكون على الأقل حرفين'
  },
  INVALID_FILTER_PARAMETERS: {
    en: 'Invalid filter parameters provided',
    ar: 'معايير التصفية المقدمة غير صحيحة'
  },
  
  // Bulk operation errors
  BULK_OPERATION_TOO_LARGE: {
    en: 'Bulk operation cannot exceed 100 customers',
    ar: 'العملية المجمعة لا يمكن أن تتجاوز 100 عميل'
  },
  BULK_OPERATION_NO_CUSTOMERS: {
    en: 'At least one customer must be selected for bulk operation',
    ar: 'يجب اختيار عميل واحد على الأقل للعملية المجمعة'
  },
  MERGE_PRIMARY_CUSTOMER_NOT_FOUND: {
    en: 'Primary customer for merge operation not found',
    ar: 'العميل الأساسي لعملية الدمج غير موجود'
  },
  
  // System and performance errors
  QUERY_TIMEOUT: {
    en: 'Request timeout. Please try again or contact support',
    ar: 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى أو الاتصال بالدعم'
  },
  SYSTEM_OVERLOAD: {
    en: 'System is currently overloaded. Please try again later',
    ar: 'النظام محمل حالياً. يرجى المحاولة لاحقاً'
  },
  DATABASE_CONNECTION_ERROR: {
    en: 'Database connection error. Please try again',
    ar: 'خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى'
  }
}

// Success messages
export const SUCCESS_MESSAGES: Record<string, BilingualMessage> = {
  CUSTOMER_CREATED: {
    en: 'Customer created successfully',
    ar: 'تم إنشاء العميل بنجاح'
  },
  CUSTOMER_UPDATED: {
    en: 'Customer updated successfully',
    ar: 'تم تحديث العميل بنجاح'
  },
  CUSTOMER_ARCHIVED: {
    en: 'Customer archived successfully',
    ar: 'تم أرشفة العميل بنجاح'
  },
  BULK_OPERATION_COMPLETED: {
    en: 'Bulk operation completed successfully',
    ar: 'تمت العملية المجمعة بنجاح'
  },
  CUSTOMERS_MERGED: {
    en: 'Customers merged successfully',
    ar: 'تم دمج العملاء بنجاح'
  },
  DATA_EXPORTED: {
    en: 'Data exported successfully',
    ar: 'تم تصدير البيانات بنجاح'
  }
}

// Warning messages
export const WARNING_MESSAGES: Record<string, BilingualMessage> = {
  HIGH_CREDIT_UTILIZATION: {
    en: 'Customer is approaching credit limit',
    ar: 'العميل يقترب من حد الائتمان'
  },
  SLOW_PAYMENT_HISTORY: {
    en: 'Customer has a history of slow payments',
    ar: 'العميل لديه تاريخ من التأخير في الدفع'
  },
  UNUSUAL_CREDIT_LIMIT: {
    en: 'Credit limit is unusually high for this business type',
    ar: 'حد الائتمان مرتفع بشكل غير اعتيادي لهذا النوع من الأعمال'
  },
  WEEKEND_OPERATION: {
    en: 'Operation performed outside UAE business hours',
    ar: 'تم تنفيذ العملية خارج ساعات العمل في الإمارات'
  },
  RAMADAN_HOURS_ACTIVE: {
    en: 'Ramadan business hours are currently active',
    ar: 'ساعات العمل في رمضان نشطة حالياً'
  }
}

// Helper function to get localized message
export function getLocalizedMessage(
  messageKey: string,
  language: 'en' | 'ar' = 'en',
  interpolations?: Record<string, string | number>
): string {
  const messages = {
    ...CUSTOMER_VALIDATION_ERRORS,
    ...SUCCESS_MESSAGES,
    ...WARNING_MESSAGES
  }
  
  const message = messages[messageKey]
  if (!message) {
    return `Message not found: ${messageKey}`
  }
  
  let localizedText = message[language]
  
  // Handle interpolations
  if (interpolations) {
    Object.entries(interpolations).forEach(([key, value]) => {
      localizedText = localizedText.replace(`{${key}}`, String(value))
    })
  }
  
  return localizedText
}

// Helper function to get bilingual message object
export function getBilingualMessage(
  messageKey: string,
  interpolations?: Record<string, string | number>
): BilingualMessage {
  return {
    en: getLocalizedMessage(messageKey, 'en', interpolations),
    ar: getLocalizedMessage(messageKey, 'ar', interpolations)
  }
}

// Error response formatter with bilingual support
export function formatValidationError(
  field: string,
  messageKey: string,
  language: 'en' | 'ar' = 'en',
  interpolations?: Record<string, string | number>
): {
  field: string
  message: string
  messageAr?: string
  code: string
} {
  const bilingualMessage = getBilingualMessage(messageKey, interpolations)
  
  return {
    field,
    message: bilingualMessage.en,
    messageAr: bilingualMessage.ar,
    code: messageKey
  }
}

// Business hours message formatter
export function getBusinessHoursMessage(language: 'en' | 'ar' = 'en'): string {
  const isRamadan = false // Would be calculated based on Islamic calendar
  
  if (isRamadan) {
    return language === 'en' 
      ? 'UAE business hours during Ramadan: Sunday to Thursday, 9:00 AM to 3:00 PM (Dubai time)'
      : 'ساعات العمل في الإمارات خلال رمضان: الأحد إلى الخميس، 9:00 صباحاً إلى 3:00 مساءً (توقيت دبي)'
  }
  
  return language === 'en'
    ? 'UAE business hours: Sunday to Thursday, 8:00 AM to 5:00 PM (Dubai time)'
    : 'ساعات العمل في الإمارات: الأحد إلى الخميس، 8:00 صباحاً إلى 5:00 مساءً (توقيت دبي)'
}

// Risk level messages
export const RISK_LEVEL_MESSAGES: Record<string, BilingualMessage> = {
  LOW: {
    en: 'Low Risk',
    ar: 'مخاطر منخفضة'
  },
  MEDIUM: {
    en: 'Medium Risk',
    ar: 'مخاطر متوسطة'
  },
  HIGH: {
    en: 'High Risk',
    ar: 'مخاطر عالية'
  },
  CRITICAL: {
    en: 'Critical Risk',
    ar: 'مخاطر حرجة'
  }
}

// Business type translations
export const BUSINESS_TYPE_LABELS: Record<string, BilingualMessage> = {
  LLC: {
    en: 'Limited Liability Company',
    ar: 'شركة ذات مسؤولية محدودة'
  },
  FREE_ZONE: {
    en: 'Free Zone Company',
    ar: 'شركة منطقة حرة'
  },
  SOLE_PROPRIETORSHIP: {
    en: 'Sole Proprietorship',
    ar: 'مؤسسة فردية'
  },
  PARTNERSHIP: {
    en: 'Partnership',
    ar: 'شراكة'
  },
  BRANCH: {
    en: 'Branch Office',
    ar: 'مكتب فرع'
  }
}

// Status message translations
export const STATUS_LABELS: Record<string, BilingualMessage> = {
  ACTIVE: {
    en: 'Active',
    ar: 'نشط'
  },
  INACTIVE: {
    en: 'Inactive',
    ar: 'غير نشط'
  },
  ARCHIVED: {
    en: 'Archived',
    ar: 'مؤرشف'
  },
  SUSPENDED: {
    en: 'Suspended',
    ar: 'معلق'
  }
}