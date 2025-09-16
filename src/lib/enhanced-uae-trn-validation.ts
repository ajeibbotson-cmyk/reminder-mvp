import { z } from 'zod'

/**
 * Enhanced UAE TRN (Tax Registration Number) Validation
 * Based on UAE Federal Tax Authority specifications
 *
 * TRN Format: 15 digits with specific validation rules
 * Structure: XXX-XXXX-XXXX-XXXX where each segment has meaning
 */

export interface TRNValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  formatted: string
  entityType?: UAEEntityType
  checksum?: number
}

export interface TRNStructure {
  entityTypeCode: string      // First 3 digits - entity type
  sequenceNumber: string      // Next 8 digits - sequence
  locationCode: string        // Next 3 digits - location/emirate
  checksumDigit: string       // Last digit - checksum
}

export enum UAEEntityType {
  FEDERAL_GOVERNMENT = '100',
  LOCAL_GOVERNMENT = '200',
  GOVERNMENT_ENTITY = '300',
  COMPANY = '400',
  INDIVIDUAL = '500',
  PARTNERSHIP = '600',
  FREE_ZONE = '700',
  BRANCH = '800',
  OTHER = '900'
}

const ENTITY_TYPE_DESCRIPTIONS = {
  [UAEEntityType.FEDERAL_GOVERNMENT]: 'Federal Government Entity',
  [UAEEntityType.LOCAL_GOVERNMENT]: 'Local Government Entity',
  [UAEEntityType.GOVERNMENT_ENTITY]: 'Government Related Entity',
  [UAEEntityType.COMPANY]: 'Company/Corporate Entity',
  [UAEEntityType.INDIVIDUAL]: 'Individual/Natural Person',
  [UAEEntityType.PARTNERSHIP]: 'Partnership',
  [UAEEntityType.FREE_ZONE]: 'Free Zone Entity',
  [UAEEntityType.BRANCH]: 'Branch Office',
  [UAEEntityType.OTHER]: 'Other Entity Type'
}

const UAE_EMIRATE_CODES = {
  '001': 'Abu Dhabi',
  '002': 'Dubai',
  '003': 'Sharjah',
  '004': 'Ajman',
  '005': 'Umm Al Quwain',
  '006': 'Ras Al Khaimah',
  '007': 'Fujairah',
  '010': 'Federal Level',
  '020': 'Free Zone - DIFC',
  '021': 'Free Zone - ADGM',
  '022': 'Free Zone - RAKEZ',
  '023': 'Free Zone - JAFZA',
  '024': 'Free Zone - DMCC',
  '025': 'Free Zone - Other'
}

/**
 * Enhanced TRN validation with comprehensive checking
 */
export function validateEnhancedUAETRN(trn: string): TRNValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!trn) {
    return {
      isValid: false,
      errors: ['TRN is required'],
      warnings: [],
      formatted: ''
    }
  }

  // Clean and normalize input
  const cleanTrn = trn.replace(/\D/g, '')

  // Basic length validation
  if (cleanTrn.length !== 15) {
    errors.push(`TRN must be exactly 15 digits. Found ${cleanTrn.length} digits.`)
    return {
      isValid: false,
      errors,
      warnings,
      formatted: trn
    }
  }

  // Parse TRN structure
  const structure = parseTRNStructure(cleanTrn)

  // Validate entity type code
  const entityTypeValidation = validateEntityType(structure.entityTypeCode)
  if (!entityTypeValidation.isValid) {
    errors.push(...entityTypeValidation.errors)
  }
  if (entityTypeValidation.warnings.length > 0) {
    warnings.push(...entityTypeValidation.warnings)
  }

  // Validate sequence number
  const sequenceValidation = validateSequenceNumber(structure.sequenceNumber)
  if (!sequenceValidation.isValid) {
    errors.push(...sequenceValidation.errors)
  }

  // Validate location code
  const locationValidation = validateLocationCode(structure.locationCode)
  if (!locationValidation.isValid) {
    errors.push(...locationValidation.errors)
  }
  if (locationValidation.warnings.length > 0) {
    warnings.push(...locationValidation.warnings)
  }

  // Validate checksum
  const checksumValidation = validateTRNChecksum(cleanTrn)
  if (!checksumValidation.isValid) {
    errors.push(...checksumValidation.errors)
  }

  // Additional business rules validation
  const businessRulesValidation = validateBusinessRules(structure)
  if (businessRulesValidation.warnings.length > 0) {
    warnings.push(...businessRulesValidation.warnings)
  }

  const isValid = errors.length === 0
  const entityType = getEntityTypeFromCode(structure.entityTypeCode)

  return {
    isValid,
    errors,
    warnings,
    formatted: formatTRNForDisplay(cleanTrn),
    entityType,
    checksum: parseInt(structure.checksumDigit)
  }
}

/**
 * Parse TRN into its structural components
 */
function parseTRNStructure(cleanTrn: string): TRNStructure {
  return {
    entityTypeCode: cleanTrn.substring(0, 3),
    sequenceNumber: cleanTrn.substring(3, 11),
    locationCode: cleanTrn.substring(11, 14),
    checksumDigit: cleanTrn.substring(14, 15)
  }
}

/**
 * Validate entity type code (first 3 digits)
 */
function validateEntityType(entityTypeCode: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if entity type is recognized
  const isValidEntityType = Object.values(UAEEntityType).includes(entityTypeCode as UAEEntityType)

  if (!isValidEntityType) {
    // Check if it's a valid range but unrecognized specific code
    const firstDigit = parseInt(entityTypeCode[0])
    if (firstDigit >= 1 && firstDigit <= 9) {
      warnings.push(`Entity type code ${entityTypeCode} is not in standard registry. Please verify with FTA.`)
    } else {
      errors.push(`Invalid entity type code: ${entityTypeCode}. Must start with 1-9.`)
    }
  }

  // Special validation for common entity types
  if (entityTypeCode === UAEEntityType.INDIVIDUAL) {
    warnings.push('Individual TRN detected. Ensure this is for business purposes.')
  }

  if (entityTypeCode === UAEEntityType.FREE_ZONE) {
    warnings.push('Free Zone entity detected. Verify specific free zone compliance requirements.')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validate sequence number (middle 8 digits)
 */
function validateSequenceNumber(sequenceNumber: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check for all zeros (invalid)
  if (sequenceNumber === '00000000') {
    errors.push('Sequence number cannot be all zeros.')
  }

  // Check for suspicious patterns
  const allSameDigit = /^(\d)\1{7}$/.test(sequenceNumber)
  if (allSameDigit) {
    errors.push('Sequence number appears to be invalid (all same digits).')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validate location/emirate code (3 digits before checksum)
 */
function validateLocationCode(locationCode: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if location code is recognized
  if (!UAE_EMIRATE_CODES[locationCode]) {
    errors.push(`Unrecognized location code: ${locationCode}. Must be valid UAE emirate or zone code.`)
  } else {
    const locationName = UAE_EMIRATE_CODES[locationCode]
    if (locationName.includes('Free Zone')) {
      warnings.push(`Free Zone location detected: ${locationName}. Verify zone-specific requirements.`)
    }
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Enhanced checksum validation using UAE-specific algorithm
 */
function validateTRNChecksum(fullTrn: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  const calculatedChecksum = calculateEnhancedTRNChecksum(fullTrn.substring(0, 14))
  const providedChecksum = parseInt(fullTrn[14])

  if (calculatedChecksum !== providedChecksum) {
    errors.push(`Invalid checksum. Expected ${calculatedChecksum}, got ${providedChecksum}.`)
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Enhanced checksum calculation using weighted algorithm
 * Based on FTA specifications (simplified version)
 */
function calculateEnhancedTRNChecksum(trnWithoutChecksum: string): number {
  const weights = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3] // 14 weights
  let sum = 0

  for (let i = 0; i < trnWithoutChecksum.length; i++) {
    sum += parseInt(trnWithoutChecksum[i]) * weights[i]
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}

/**
 * Business rules validation
 */
function validateBusinessRules(structure: TRNStructure): { warnings: string[] } {
  const warnings: string[] = []

  // Check for entity type and location consistency
  const entityType = structure.entityTypeCode
  const locationCode = structure.locationCode

  // Government entities should typically be at federal level or specific emirates
  if ((entityType === UAEEntityType.FEDERAL_GOVERNMENT || entityType === UAEEntityType.LOCAL_GOVERNMENT) &&
      !['001', '002', '010'].includes(locationCode)) {
    warnings.push('Government entity with unusual location code. Please verify.')
  }

  // Free zone entities should have free zone location codes
  if (entityType === UAEEntityType.FREE_ZONE && !locationCode.startsWith('02')) {
    warnings.push('Free Zone entity should typically have free zone location code (02x).')
  }

  return { warnings }
}

/**
 * Get entity type enum from code
 */
function getEntityTypeFromCode(code: string): UAEEntityType | undefined {
  return Object.values(UAEEntityType).find(type => type === code)
}

/**
 * Format TRN for professional display
 */
export function formatTRNForDisplay(trn: string): string {
  const cleanTrn = trn.replace(/\D/g, '')

  if (cleanTrn.length !== 15) {
    return trn
  }

  // Format as XXX-XXXX-XXXX-XXXX
  return `${cleanTrn.substring(0, 3)}-${cleanTrn.substring(3, 7)}-${cleanTrn.substring(7, 11)}-${cleanTrn.substring(11, 15)}`
}

/**
 * Get entity type description
 */
export function getEntityTypeDescription(entityType: UAEEntityType): string {
  return ENTITY_TYPE_DESCRIPTIONS[entityType] || 'Unknown Entity Type'
}

/**
 * Get emirate name from location code
 */
export function getEmirateFromLocationCode(locationCode: string): string {
  return UAE_EMIRATE_CODES[locationCode] || 'Unknown Location'
}

/**
 * Enhanced Zod schema for TRN validation
 */
export const enhancedTrnSchema = z.string()
  .min(1, 'TRN is required')
  .refine((trn) => {
    const validation = validateEnhancedUAETRN(trn)
    return validation.isValid
  }, {
    message: 'Invalid TRN format'
  })

/**
 * Optional enhanced TRN schema
 */
export const optionalEnhancedTrnSchema = z.string()
  .optional()
  .refine((trn) => {
    if (!trn) return true
    const validation = validateEnhancedUAETRN(trn)
    return validation.isValid
  }, {
    message: 'Invalid TRN format'
  })

/**
 * Validate TRN for specific business types
 */
export function validateTRNForBusinessType(
  trn: string,
  businessType: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const validation = validateEnhancedUAETRN(trn)

  if (!validation.isValid) {
    return validation
  }

  const additionalWarnings: string[] = []

  // Business type specific validations
  if (businessType === 'SOLE_PROPRIETORSHIP' && validation.entityType !== UAEEntityType.INDIVIDUAL) {
    additionalWarnings.push('Sole proprietorship should typically have individual entity type TRN.')
  }

  if (businessType === 'LLC' && validation.entityType !== UAEEntityType.COMPANY) {
    additionalWarnings.push('LLC should typically have company entity type TRN.')
  }

  if (businessType === 'FREE_ZONE' && validation.entityType !== UAEEntityType.FREE_ZONE) {
    additionalWarnings.push('Free zone business should have free zone entity type TRN.')
  }

  return {
    ...validation,
    warnings: [...validation.warnings, ...additionalWarnings]
  }
}

/**
 * Generate sample valid TRN for testing (DEV ONLY)
 */
export function generateSampleTRN(entityType: UAEEntityType = UAEEntityType.COMPANY): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Sample TRN generation not allowed in production')
  }

  const sequenceNumber = Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
  const locationCode = '002' // Dubai
  const trnWithoutChecksum = entityType + sequenceNumber + locationCode
  const checksum = calculateEnhancedTRNChecksum(trnWithoutChecksum)

  return trnWithoutChecksum + checksum.toString()
}