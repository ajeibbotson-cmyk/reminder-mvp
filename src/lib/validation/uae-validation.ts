/**
 * UAE-specific validation utilities for invoice import
 * Handles TRN, phone numbers, VAT calculation, currency, and date formats
 */

export interface ValidationResult {
  isValid: boolean
  message?: string
  suggestion?: string
  correctedValue?: any
}

export interface UAEValidationConfig {
  strictMode?: boolean // If true, enforces stricter validation
  autoCorrect?: boolean // If true, attempts to auto-correct values
  defaultCurrency?: string // Default currency (AED)
  vatRate?: number // UAE VAT rate (5%)
}

const DEFAULT_CONFIG: UAEValidationConfig = {
  strictMode: false,
  autoCorrect: true,
  defaultCurrency: 'AED',
  vatRate: 0.05
}

/**
 * Validates UAE Tax Registration Number (TRN)
 */
export function validateUAETRN(trn: string, config: UAEValidationConfig = {}): ValidationResult {
  if (!trn || trn.trim() === '') {
    return { isValid: true } // TRN is optional
  }

  const cleanTrn = trn.replace(/\s|-/g, '')
  
  // TRN must be exactly 15 digits
  if (!/^\d{15}$/.test(cleanTrn)) {
    let suggestion = ''
    
    if (cleanTrn.length < 15) {
      suggestion = `TRN appears too short. Expected 15 digits, got ${cleanTrn.length}`
    } else if (cleanTrn.length > 15) {
      suggestion = `TRN appears too long. Expected 15 digits, got ${cleanTrn.length}`
    } else if (!/^\d+$/.test(cleanTrn)) {
      suggestion = 'TRN should contain only digits'
    }
    
    return {
      isValid: false,
      message: 'Invalid UAE TRN format',
      suggestion,
      correctedValue: config.autoCorrect && cleanTrn.length === 15 && /^\d+$/.test(cleanTrn) 
        ? cleanTrn 
        : undefined
    }
  }

  // Check for obviously invalid patterns
  if (cleanTrn === '000000000000000' || cleanTrn === '111111111111111') {
    return {
      isValid: false,
      message: 'TRN appears to be a placeholder or test value',
      suggestion: 'Please provide a valid UAE Tax Registration Number'
    }
  }

  return { 
    isValid: true, 
    correctedValue: config.autoCorrect ? cleanTrn : undefined 
  }
}

/**
 * Validates UAE phone numbers (mobile and landline)
 */
export function validateUAEPhone(phone: string, config: UAEValidationConfig = {}): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: true } // Phone is optional
  }

  let cleanPhone = phone.replace(/\s|-|\(|\)/g, '')
  let correctedValue = cleanPhone

  // Remove country code variations
  if (cleanPhone.startsWith('+971')) {
    cleanPhone = cleanPhone.substring(4)
    correctedValue = '+971' + cleanPhone
  } else if (cleanPhone.startsWith('00971')) {
    cleanPhone = cleanPhone.substring(5)
    correctedValue = '+971' + cleanPhone
  } else if (cleanPhone.startsWith('971')) {
    cleanPhone = cleanPhone.substring(3)
    correctedValue = '+971' + cleanPhone
  } else if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1)
    correctedValue = '+971' + cleanPhone
  } else {
    correctedValue = '+971' + cleanPhone
  }

  // UAE phone number patterns
  const mobilePattern = /^5[0-9]\d{7}$/ // 50xxxxxxx, 52xxxxxxx, etc.
  const landlinePatterns = [
    /^[2-4]\d{7}$/, // Abu Dhabi (02), Dubai (04), Sharjah (06)
    /^[7-9]\d{7}$/, // Other emirates (07, 09)
  ]

  const isValidMobile = mobilePattern.test(cleanPhone)
  const isValidLandline = landlinePatterns.some(pattern => pattern.test(cleanPhone))

  if (!isValidMobile && !isValidLandline) {
    let suggestion = 'Please provide a valid UAE phone number'
    
    if (cleanPhone.length !== 8) {
      suggestion = `Phone number should be 8 digits after country code. Got ${cleanPhone.length} digits`
    } else if (!cleanPhone.match(/^[2-9]/)) {
      suggestion = 'UAE phone numbers should start with 2-9 after the country code'
    }

    return {
      isValid: false,
      message: 'Invalid UAE phone number format',
      suggestion,
      correctedValue: config.autoCorrect ? correctedValue : undefined
    }
  }

  return { 
    isValid: true, 
    correctedValue: config.autoCorrect ? correctedValue : undefined 
  }
}

/**
 * Validates email addresses with UAE-specific considerations
 */
export function validateEmail(email: string, config: UAEValidationConfig = {}): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, message: 'Email is required' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      message: 'Invalid email format',
      suggestion: 'Please provide a valid email address (e.g., user@company.ae)'
    }
  }

  // Check for common UAE domains
  const uaeDomains = ['.ae', '.com.ae', '.org.ae', '.net.ae', '.gov.ae', '.ac.ae']
  const isUAEDomain = uaeDomains.some(domain => email.toLowerCase().endsWith(domain))
  
  // Warn about non-UAE domains in strict mode
  if (config.strictMode && !isUAEDomain) {
    return {
      isValid: true,
      message: 'Consider using a UAE domain (.ae) for local businesses',
      suggestion: 'UAE businesses typically use .ae domain extensions'
    }
  }

  return { isValid: true }
}

/**
 * Validates currency codes with UAE preferences
 */
export function validateCurrency(currency: string, config: UAEValidationConfig = DEFAULT_CONFIG): ValidationResult {
  if (!currency || currency.trim() === '') {
    return { 
      isValid: true, 
      correctedValue: config.autoCorrect ? config.defaultCurrency : undefined 
    }
  }

  const validCurrencies = [
    'AED', // UAE Dirham (primary)
    'USD', // US Dollar
    'EUR', // Euro
    'GBP', // British Pound
    'SAR', // Saudi Riyal
    'QAR', // Qatari Riyal
    'KWD', // Kuwaiti Dinar
    'BHD', // Bahraini Dinar
    'OMR', // Omani Rial
  ]

  const upperCurrency = currency.toUpperCase()
  
  if (!validCurrencies.includes(upperCurrency)) {
    return {
      isValid: false,
      message: `Unsupported currency: ${currency}`,
      suggestion: `Supported currencies: ${validCurrencies.join(', ')}`,
      correctedValue: config.autoCorrect ? config.defaultCurrency : undefined
    }
  }

  // Suggest AED for UAE-based transactions
  if (config.strictMode && upperCurrency !== 'AED') {
    return {
      isValid: true,
      message: 'Consider using AED for UAE-based transactions',
      suggestion: 'AED is the official currency of the UAE'
    }
  }

  return { 
    isValid: true, 
    correctedValue: config.autoCorrect ? upperCurrency : undefined 
  }
}

/**
 * Validates and calculates VAT for UAE
 */
export function validateAndCalculateVAT(
  amount: number, 
  vatAmount?: number, 
  config: UAEValidationConfig = DEFAULT_CONFIG
): ValidationResult & { calculatedVAT?: number; totalWithVAT?: number } {
  if (isNaN(amount) || amount <= 0) {
    return {
      isValid: false,
      message: 'Invalid amount',
      suggestion: 'Amount must be a positive number'
    }
  }

  const expectedVAT = amount * (config.vatRate || 0.05)
  const totalWithVAT = amount + expectedVAT

  // If VAT amount is provided, validate it
  if (vatAmount !== undefined && vatAmount !== null) {
    const difference = Math.abs(vatAmount - expectedVAT)
    const tolerance = expectedVAT * 0.01 // 1% tolerance
    
    if (difference > tolerance) {
      return {
        isValid: false,
        message: 'VAT amount does not match expected 5% rate',
        suggestion: `Expected VAT: ${expectedVAT.toFixed(2)}`,
        correctedValue: config.autoCorrect ? expectedVAT : undefined,
        calculatedVAT: expectedVAT,
        totalWithVAT
      }
    }
  }

  return {
    isValid: true,
    calculatedVAT: expectedVAT,
    totalWithVAT,
    correctedValue: config.autoCorrect ? expectedVAT : undefined
  }
}

/**
 * Validates date formats commonly used in UAE
 */
export function validateUAEDate(dateString: string, config: UAEValidationConfig = {}): ValidationResult {
  if (!dateString || dateString.trim() === '') {
    return {
      isValid: false,
      message: 'Date is required'
    }
  }

  let parsedDate: Date | null = null
  let correctedValue: string | undefined

  // Try different date formats commonly used in UAE
  const dateFormats = [
    // ISO format (preferred)
    /^\d{4}-\d{2}-\d{2}$/,
    // UAE common formats
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // D/M/YYYY or DD/M/YYYY
  ]

  const cleanDate = dateString.trim()

  // Try ISO format first
  if (dateFormats[0].test(cleanDate)) {
    parsedDate = new Date(cleanDate)
    correctedValue = cleanDate
  }
  // Try DD/MM/YYYY format
  else if (dateFormats[1].test(cleanDate)) {
    const parts = cleanDate.split('/')
    parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    correctedValue = config.autoCorrect ? `${parts[2]}-${parts[1]}-${parts[0]}` : cleanDate
  }
  // Try DD-MM-YYYY format
  else if (dateFormats[2].test(cleanDate)) {
    const parts = cleanDate.split('-')
    parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    correctedValue = config.autoCorrect ? `${parts[2]}-${parts[1]}-${parts[0]}` : cleanDate
  }
  // Try flexible D/M/YYYY format
  else if (dateFormats[3].test(cleanDate)) {
    const parts = cleanDate.split('/')
    const day = parts[0].padStart(2, '0')
    const month = parts[1].padStart(2, '0')
    parsedDate = new Date(`${parts[2]}-${month}-${day}`)
    correctedValue = config.autoCorrect ? `${parts[2]}-${month}-${day}` : cleanDate
  }
  else {
    // Try native Date parsing as fallback
    parsedDate = new Date(cleanDate)
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return {
      isValid: false,
      message: 'Invalid date format',
      suggestion: 'Please use YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY format'
    }
  }

  // Check if date is reasonable (not too far in past or future)
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate())

  if (parsedDate < oneYearAgo) {
    return {
      isValid: false,
      message: 'Date appears to be too far in the past',
      suggestion: 'Please check the date is correct'
    }
  }

  if (parsedDate > twoYearsFromNow) {
    return {
      isValid: false,
      message: 'Date appears to be too far in the future',
      suggestion: 'Please check the date is correct'
    }
  }

  return {
    isValid: true,
    correctedValue: config.autoCorrect ? correctedValue : undefined
  }
}

/**
 * Validates invoice amount with UAE business context
 */
export function validateInvoiceAmount(amount: string | number, config: UAEValidationConfig = {}): ValidationResult {
  const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount

  if (isNaN(numAmount)) {
    return {
      isValid: false,
      message: 'Invalid amount format',
      suggestion: 'Please provide a valid number'
    }
  }

  if (numAmount <= 0) {
    return {
      isValid: false,
      message: 'Amount must be greater than zero',
      suggestion: 'Please provide a positive amount'
    }
  }

  // Check for reasonable business amounts (warn about very small or very large amounts)
  if (config.strictMode) {
    if (numAmount < 1) {
      return {
        isValid: false,
        message: 'Amount appears too small for a business invoice',
        suggestion: 'Please check the amount is correct'
      }
    }

    if (numAmount > 10000000) { // 10 million AED
      return {
        isValid: true,
        message: 'This is a very large amount',
        suggestion: 'Please verify this amount is correct'
      }
    }
  }

  return {
    isValid: true,
    correctedValue: config.autoCorrect ? numAmount.toFixed(2) : undefined
  }
}

/**
 * Comprehensive validation for invoice row data
 */
export function validateInvoiceRowData(
  rowData: Record<string, any>, 
  fieldMappings: Record<string, string>,
  config: UAEValidationConfig = DEFAULT_CONFIG
): { 
  isValid: boolean
  errors: Array<{ field: string; message: string; suggestion?: string }>
  warnings: Array<{ field: string; message: string; suggestion?: string }>
  correctedData: Record<string, any>
} {
  const errors: Array<{ field: string; message: string; suggestion?: string }> = []
  const warnings: Array<{ field: string; message: string; suggestion?: string }> = []
  const correctedData: Record<string, any> = { ...rowData }

  // Validate each mapped field
  Object.entries(fieldMappings).forEach(([systemField, csvHeader]) => {
    if (!csvHeader) return
    
    const value = rowData[csvHeader]
    
    switch (systemField) {
      case 'customerTrn':
        if (value) {
          const result = validateUAETRN(value, config)
          if (!result.isValid) {
            errors.push({ field: csvHeader, message: result.message!, suggestion: result.suggestion })
          } else if (result.correctedValue) {
            correctedData[csvHeader] = result.correctedValue
          }
        }
        break
        
      case 'customerPhone':
        if (value) {
          const result = validateUAEPhone(value, config)
          if (!result.isValid) {
            errors.push({ field: csvHeader, message: result.message!, suggestion: result.suggestion })
          } else if (result.correctedValue) {
            correctedData[csvHeader] = result.correctedValue
          }
        }
        break
        
      case 'customerEmail':
        if (value) {
          const result = validateEmail(value, config)
          if (!result.isValid) {
            errors.push({ field: csvHeader, message: result.message!, suggestion: result.suggestion })
          } else if (result.message) {
            warnings.push({ field: csvHeader, message: result.message, suggestion: result.suggestion })
          }
        }
        break
        
      case 'currency':
        const result = validateCurrency(value, config)
        if (!result.isValid) {
          errors.push({ field: csvHeader, message: result.message!, suggestion: result.suggestion })
        } else if (result.correctedValue) {
          correctedData[csvHeader] = result.correctedValue
        } else if (result.message) {
          warnings.push({ field: csvHeader, message: result.message, suggestion: result.suggestion })
        }
        break
        
      case 'amount':
        if (value) {
          const result = validateInvoiceAmount(value, config)
          if (!result.isValid) {
            errors.push({ field: csvHeader, message: result.message!, suggestion: result.suggestion })
          } else if (result.correctedValue) {
            correctedData[csvHeader] = result.correctedValue
          } else if (result.message) {
            warnings.push({ field: csvHeader, message: result.message, suggestion: result.suggestion })
          }
        }
        break
        
      case 'vatAmount':
        if (value !== undefined && value !== null && value !== '') {
          const amountValue = rowData[fieldMappings['amount']]
          if (amountValue) {
            const amountNum = parseFloat(amountValue)
            const vatResult = validateAndCalculateVAT(amountNum, parseFloat(value), config)
            if (!vatResult.isValid) {
              errors.push({ field: csvHeader, message: vatResult.message!, suggestion: vatResult.suggestion })
            } else if (vatResult.correctedValue) {
              correctedData[csvHeader] = vatResult.correctedValue
            }
          }
        }
        break
        
      case 'dueDate':
      case 'issueDate':
        if (value) {
          const result = validateUAEDate(value, config)
          if (!result.isValid) {
            errors.push({ field: csvHeader, message: result.message!, suggestion: result.suggestion })
          } else if (result.correctedValue) {
            correctedData[csvHeader] = result.correctedValue
          }
        }
        break
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    correctedData
  }
}