/**
 * Import utility functions for CSV/Excel processing and UAE business logic
 */

import { validateInvoiceRowData, UAEValidationConfig } from '../validation/uae-validation'

export interface ImportRow {
  rowNumber: number
  data: Record<string, any>
  isValid: boolean
  errors: Array<{ field: string; message: string; suggestion?: string }>
  warnings: Array<{ field: string; message: string; suggestion?: string }>
  correctedData?: Record<string, any>
}

export interface ImportProcessingResult {
  totalRows: number
  validRows: number
  invalidRows: number
  processedRows: ImportRow[]
  summary: {
    newCustomers: number
    existingCustomers: number
    duplicateInvoices: number
    totalAmount: number
    totalVAT: number
  }
}

export interface FieldMapping {
  systemField: string
  csvColumn: string
  required: boolean
  dataType: 'string' | 'number' | 'date' | 'email' | 'phone'
}

export interface ImportOptions {
  hasHeaders: boolean
  skipEmptyRows: boolean
  strictValidation: boolean
  autoCorrectData: boolean
  duplicateHandling: 'skip' | 'update' | 'create'
  batchSize: number
}

const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  hasHeaders: true,
  skipEmptyRows: true,
  strictValidation: false,
  autoCorrectData: true,
  duplicateHandling: 'skip',
  batchSize: 100
}

/**
 * Parses CSV content and returns structured data
 */
export function parseCSVContent(
  content: string, 
  options: Partial<ImportOptions> = {}
): { headers: string[]; data: Record<string, any>[]; errors: string[] } {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options }
  const errors: string[] = []
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { headers: [], data: [], errors: ['File appears to be empty'] }
  }

  let headers: string[] = []
  let dataRows: string[] = []

  if (opts.hasHeaders) {
    headers = parseCSVLine(lines[0])
    dataRows = lines.slice(1)
  } else {
    // Generate default headers if no headers present
    const firstRow = parseCSVLine(lines[0])
    headers = firstRow.map((_, index) => `Column ${index + 1}`)
    dataRows = lines
  }

  // Validate headers
  if (headers.length === 0) {
    errors.push('No columns found in the file')
    return { headers: [], data: [], errors }
  }

  // Check for duplicate headers
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicateHeaders.length > 0) {
    errors.push(`Duplicate column headers found: ${duplicateHeaders.join(', ')}`)
  }

  // Parse data rows
  const data: Record<string, any>[] = []
  
  dataRows.forEach((line, index) => {
    if (opts.skipEmptyRows && line.trim() === '') return
    
    const values = parseCSVLine(line)
    
    if (values.length !== headers.length) {
      errors.push(`Row ${index + 2}: Expected ${headers.length} columns, got ${values.length}`)
      return
    }

    const rowData: Record<string, any> = {}
    headers.forEach((header, i) => {
      rowData[header] = values[i]?.trim() || ''
    })
    
    data.push(rowData)
  })

  return { headers, data, errors }
}

/**
 * Parses a single CSV line, handling quotes and commas correctly
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

/**
 * Processes import data with validation and business logic
 */
export function processImportData(
  data: Record<string, any>[],
  fieldMappings: Record<string, string>,
  options: Partial<ImportOptions> = {}
): ImportProcessingResult {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options }
  const processedRows: ImportRow[] = []
  
  const validationConfig: UAEValidationConfig = {
    strictMode: opts.strictValidation,
    autoCorrect: opts.autoCorrectData,
    defaultCurrency: 'AED',
    vatRate: 0.05
  }

  let totalAmount = 0
  let totalVAT = 0
  const customerNames = new Set<string>()
  const existingCustomers = new Set<string>()
  const invoiceNumbers = new Set<string>()
  let duplicateInvoices = 0

  data.forEach((rowData, index) => {
    const rowNumber = index + 1
    
    // Skip empty rows if configured
    if (opts.skipEmptyRows && isRowEmpty(rowData)) {
      return
    }

    // Validate the row
    const validation = validateInvoiceRowData(rowData, fieldMappings, validationConfig)
    
    // Process business logic
    const customerName = rowData[fieldMappings.customerName]
    const invoiceNumber = rowData[fieldMappings.invoiceNumber]
    const amount = parseFloat(rowData[fieldMappings.amount] || '0')
    
    if (customerName) {
      if (customerNames.has(customerName)) {
        existingCustomers.add(customerName)
      } else {
        customerNames.add(customerName)
      }
    }
    
    if (invoiceNumber) {
      if (invoiceNumbers.has(invoiceNumber)) {
        duplicateInvoices++
        validation.warnings.push({
          field: fieldMappings.invoiceNumber,
          message: 'Duplicate invoice number found',
          suggestion: 'This invoice number appears multiple times in the import'
        })
      } else {
        invoiceNumbers.add(invoiceNumber)
      }
    }
    
    if (!isNaN(amount) && amount > 0) {
      totalAmount += amount
      
      // Calculate VAT if not provided
      const vatAmount = rowData[fieldMappings.vatAmount]
      if (!vatAmount || vatAmount === '') {
        const calculatedVAT = amount * 0.05
        totalVAT += calculatedVAT
        
        if (validation.correctedData) {
          validation.correctedData[fieldMappings.vatAmount || 'vatAmount'] = calculatedVAT.toFixed(2)
        }
      } else {
        totalVAT += parseFloat(vatAmount) || 0
      }
    }

    processedRows.push({
      rowNumber,
      data: rowData,
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      correctedData: validation.correctedData
    })
  })

  const validRows = processedRows.filter(row => row.isValid).length
  const invalidRows = processedRows.length - validRows

  return {
    totalRows: processedRows.length,
    validRows,
    invalidRows,
    processedRows,
    summary: {
      newCustomers: customerNames.size - existingCustomers.size,
      existingCustomers: existingCustomers.size,
      duplicateInvoices,
      totalAmount,
      totalVAT
    }
  }
}

/**
 * Checks if a row is considered empty
 */
function isRowEmpty(rowData: Record<string, any>): boolean {
  return Object.values(rowData).every(value => 
    value === null || value === undefined || value.toString().trim() === ''
  )
}

/**
 * Generates field mapping suggestions based on CSV headers
 */
export function suggestFieldMappings(csvHeaders: string[]): Record<string, string> {
  const mappings: Record<string, string> = {}
  
  const mappingRules: Record<string, string[]> = {
    customerName: [
      'customer name', 'customer', 'client name', 'client', 'company name', 
      'business name', 'name', 'company', 'organisation', 'organization'
    ],
    customerEmail: [
      'email', 'customer email', 'email address', 'contact email', 'e-mail'
    ],
    customerPhone: [
      'phone', 'customer phone', 'phone number', 'mobile', 'contact number',
      'telephone', 'mobile number', 'contact phone'
    ],
    customerTrn: [
      'trn', 'customer trn', 'tax number', 'tax registration number',
      'vat number', 'tax id', 'business registration'
    ],
    invoiceNumber: [
      'invoice number', 'invoice', 'invoice no', 'inv no', 'reference number',
      'ref number', 'invoice id', 'number'
    ],
    amount: [
      'amount', 'invoice amount', 'total', 'subtotal', 'net amount',
      'base amount', 'price', 'value'
    ],
    vatAmount: [
      'vat', 'vat amount', 'tax', 'tax amount', 'sales tax', 'gst'
    ],
    totalAmount: [
      'total amount', 'grand total', 'gross amount', 'final amount',
      'amount with vat', 'including vat'
    ],
    dueDate: [
      'due date', 'payment due', 'due', 'payment date', 'pay by'
    ],
    issueDate: [
      'issue date', 'invoice date', 'date', 'created date', 'billing date'
    ],
    description: [
      'description', 'desc', 'details', 'item', 'service', 'product',
      'particulars', 'items'
    ],
    descriptionAr: [
      'description arabic', 'desc arabic', 'arabic description',
      'details arabic', 'وصف', 'تفاصيل'
    ],
    currency: [
      'currency', 'curr', 'currency code'
    ],
    paymentTerms: [
      'payment terms', 'terms', 'payment conditions', 'credit terms'
    ]
  }

  csvHeaders.forEach(header => {
    const lowerHeader = header.toLowerCase().trim()
    
    for (const [systemField, variations] of Object.entries(mappingRules)) {
      if (variations.some(variation => 
        lowerHeader.includes(variation) || variation.includes(lowerHeader)
      )) {
        // Only map if not already mapped
        if (!mappings[systemField]) {
          mappings[systemField] = header
        }
        break
      }
    }
  })

  return mappings
}

/**
 * Validates field mappings to ensure required fields are mapped
 */
export function validateFieldMappings(
  mappings: Record<string, string>,
  csvHeaders: string[]
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  const requiredFields = ['customerName', 'customerEmail', 'invoiceNumber', 'amount', 'dueDate']
  const recommendedFields = ['customerPhone', 'description', 'issueDate']

  // Check required fields
  requiredFields.forEach(field => {
    if (!mappings[field]) {
      errors.push(`Required field "${field}" is not mapped`)
    } else if (!csvHeaders.includes(mappings[field])) {
      errors.push(`Mapped column "${mappings[field]}" for field "${field}" does not exist in CSV`)
    }
  })

  // Check recommended fields
  recommendedFields.forEach(field => {
    if (!mappings[field]) {
      warnings.push(`Recommended field "${field}" is not mapped`)
    }
  })

  // Check for duplicate mappings
  const usedColumns = Object.values(mappings).filter(Boolean)
  const duplicates = usedColumns.filter((col, index) => usedColumns.indexOf(col) !== index)
  
  if (duplicates.length > 0) {
    errors.push(`The following columns are mapped multiple times: ${duplicates.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Processes data in chunks for large imports
 */
export function* processInChunks<T>(
  data: T[], 
  chunkSize: number = 100
): Generator<T[], void, unknown> {
  for (let i = 0; i < data.length; i += chunkSize) {
    yield data.slice(i, i + chunkSize)
  }
}

/**
 * Estimates processing time based on data size and complexity
 */
export function estimateProcessingTime(
  rowCount: number, 
  fieldCount: number, 
  hasComplexValidation: boolean = true
): { estimatedSeconds: number; estimatedMinutes: number } {
  // Base processing rate: rows per second
  let baseRate = 50
  
  // Adjust for field complexity
  if (fieldCount > 10) baseRate *= 0.8
  if (fieldCount > 20) baseRate *= 0.7
  
  // Adjust for validation complexity
  if (hasComplexValidation) baseRate *= 0.6
  
  const estimatedSeconds = Math.ceil(rowCount / baseRate)
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60)
  
  return { estimatedSeconds, estimatedMinutes }
}

/**
 * Creates a progress tracker for import operations
 */
export class ImportProgressTracker {
  private totalSteps: number
  private currentStep: number = 0
  private stepDetails: Map<number, string> = new Map()
  private startTime: Date
  private onProgress?: (progress: {
    step: number
    totalSteps: number
    percentage: number
    currentStepDetail: string
    elapsedTime: number
    estimatedRemaining: number
  }) => void

  constructor(totalSteps: number, onProgress?: ImportProgressTracker['onProgress']) {
    this.totalSteps = totalSteps
    this.startTime = new Date()
    this.onProgress = onProgress
  }

  nextStep(detail: string) {
    this.currentStep++
    this.stepDetails.set(this.currentStep, detail)
    this.updateProgress()
  }

  updateCurrentStep(detail: string) {
    this.stepDetails.set(this.currentStep, detail)
    this.updateProgress()
  }

  private updateProgress() {
    if (!this.onProgress) return

    const elapsedTime = Date.now() - this.startTime.getTime()
    const percentage = Math.round((this.currentStep / this.totalSteps) * 100)
    const estimatedRemaining = this.currentStep > 0 
      ? (elapsedTime / this.currentStep) * (this.totalSteps - this.currentStep)
      : 0

    this.onProgress({
      step: this.currentStep,
      totalSteps: this.totalSteps,
      percentage,
      currentStepDetail: this.stepDetails.get(this.currentStep) || '',
      elapsedTime,
      estimatedRemaining
    })
  }
}

/**
 * UAE-specific business logic for invoice processing
 */
export class UAEInvoiceProcessor {
  private config: UAEValidationConfig

  constructor(config: Partial<UAEValidationConfig> = {}) {
    this.config = {
      strictMode: false,
      autoCorrect: true,
      defaultCurrency: 'AED',
      vatRate: 0.05,
      ...config
    }
  }

  /**
   * Processes a single invoice row with UAE business rules
   */
  processInvoiceRow(rowData: Record<string, any>, fieldMappings: Record<string, string>) {
    const result = {
      invoice: {} as Record<string, any>,
      customer: {} as Record<string, any>,
      warnings: [] as string[],
      errors: [] as string[]
    }

    // Extract customer information
    if (fieldMappings.customerName) {
      result.customer.name = rowData[fieldMappings.customerName]
    }
    if (fieldMappings.customerEmail) {
      result.customer.email = rowData[fieldMappings.customerEmail]
    }
    if (fieldMappings.customerPhone) {
      result.customer.phone = rowData[fieldMappings.customerPhone]
    }
    if (fieldMappings.customerTrn) {
      result.customer.trn = rowData[fieldMappings.customerTrn]
    }

    // Extract invoice information
    if (fieldMappings.invoiceNumber) {
      result.invoice.number = rowData[fieldMappings.invoiceNumber]
    }
    if (fieldMappings.amount) {
      const amount = parseFloat(rowData[fieldMappings.amount] || '0')
      result.invoice.amount = amount
      
      // Auto-calculate VAT if not provided
      if (!fieldMappings.vatAmount || !rowData[fieldMappings.vatAmount]) {
        result.invoice.vatAmount = amount * this.config.vatRate!
        result.invoice.totalAmount = amount + result.invoice.vatAmount
        result.warnings.push('VAT amount auto-calculated at 5%')
      } else {
        result.invoice.vatAmount = parseFloat(rowData[fieldMappings.vatAmount] || '0')
        result.invoice.totalAmount = amount + result.invoice.vatAmount
      }
    }

    // Set default currency
    result.invoice.currency = rowData[fieldMappings.currency || ''] || this.config.defaultCurrency

    // Process dates
    if (fieldMappings.issueDate) {
      result.invoice.issueDate = this.parseDate(rowData[fieldMappings.issueDate])
    } else {
      result.invoice.issueDate = new Date()
      result.warnings.push('Issue date not provided, using current date')
    }

    if (fieldMappings.dueDate) {
      result.invoice.dueDate = this.parseDate(rowData[fieldMappings.dueDate])
    }

    // Process descriptions
    if (fieldMappings.description) {
      result.invoice.description = rowData[fieldMappings.description]
    }
    if (fieldMappings.descriptionAr) {
      result.invoice.descriptionAr = rowData[fieldMappings.descriptionAr]
    }

    return result
  }

  private parseDate(dateString: string): Date | null {
    if (!dateString) return null
    
    // Try different date formats
    const formats = [
      // ISO format
      /^\d{4}-\d{2}-\d{2}$/,
      // UAE common formats
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/
    ]

    let parsedDate: Date | null = null

    if (formats[0].test(dateString)) {
      parsedDate = new Date(dateString)
    } else if (formats[1].test(dateString)) {
      const parts = dateString.split('/')
      parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    } else if (formats[2].test(dateString)) {
      const parts = dateString.split('-')
      parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    } else {
      parsedDate = new Date(dateString)
    }

    return parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null
  }
}