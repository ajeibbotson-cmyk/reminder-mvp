import { Readable } from 'stream'
import { parse as parseCSV, ParseResult } from 'papaparse'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { 
  csvInvoiceRowSchema, 
  validateUAETRN, 
  formatUAETRN,
  UAE_PHONE_REGEX,
  UAE_EMAIL_REGEX 
} from './validations'
import { calculateInvoiceVAT, validateUAETRN as validateTRN } from './vat-calculator'

export interface FileProcessingOptions {
  companyId: string
  userId: string
  importType: 'INVOICE' | 'CUSTOMER' | 'PAYMENT' | 'INVOICE_ITEMS'
  chunkSize?: number
  validateOnly?: boolean
  rollbackOnError?: boolean
  fieldMappings?: Record<string, string>
  skipFirstRow?: boolean
  delimiter?: string
  encoding?: string
}

export interface ProcessingProgress {
  importBatchId: string
  totalRecords: number
  processedRecords: number
  successfulRecords: number
  failedRecords: number
  currentRecord?: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  errors: ProcessingError[]
  startTime: Date
  estimatedCompletion?: Date
  processingRate?: number // records per second
}

export interface ProcessingError {
  rowNumber: number
  errorType: 'VALIDATION_ERROR' | 'FORMAT_ERROR' | 'DUPLICATE_ERROR' | 'REFERENCE_ERROR' | 'CONSTRAINT_ERROR' | 'BUSINESS_RULE_ERROR'
  errorMessage: string
  fieldName?: string
  attemptedValue?: string
  suggestion?: string
  csvData: Record<string, unknown>
}

export interface ProcessedRow {
  rowNumber: number
  originalData: Record<string, unknown>
  processedData: Record<string, unknown>
  isValid: boolean
  errors: ProcessingError[]
  warnings?: string[]
}

export interface FileProcessingResult {
  importBatchId: string
  totalRecords: number
  successfulRecords: number
  failedRecords: number
  processingTime: number
  errors: ProcessingError[]
  warnings: string[]
  createdRecords?: {
    invoices?: string[]
    customers?: string[]
    payments?: string[]
  }
}

/**
 * Main file processor class for handling CSV/Excel imports
 */
export class FileProcessor {
  private options: FileProcessingOptions
  private progressCallback?: (progress: ProcessingProgress) => void

  constructor(
    options: FileProcessingOptions,
    progressCallback?: (progress: ProcessingProgress) => void
  ) {
    this.options = options
    this.progressCallback = progressCallback
  }

  /**
   * Process uploaded file (CSV or Excel)
   */
  async processFile(
    file: Buffer | Readable,
    filename: string,
    originalFilename: string
  ): Promise<FileProcessingResult> {
    const startTime = Date.now()
    const fileExtension = filename.toLowerCase().split('.').pop()

    // Create import batch record
    const importBatch = await this.createImportBatch(filename, originalFilename, file.length)
    
    try {
      let rawData: Record<string, unknown>[]

      // Parse file based on type
      if (fileExtension === 'csv') {
        rawData = await this.parseCSV(file)
      } else if (['xlsx', 'xls'].includes(fileExtension!)) {
        rawData = await this.parseExcel(file)
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`)
      }

      // Skip first row if headers
      if (this.options.skipFirstRow && rawData.length > 0) {
        rawData = rawData.slice(1)
      }

      // Update batch with total records
      await this.updateImportBatch(importBatch.id, {
        totalRecords: rawData.length,
        status: 'PROCESSING',
        processingStartedAt: new Date()
      })

      // Process data in chunks
      const result = await this.processDataChunks(importBatch.id, rawData)
      
      // Calculate processing time
      const processingTime = Date.now() - startTime

      // Update final batch status
      await this.updateImportBatch(importBatch.id, {
        status: result.failedRecords > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED',
        processedRecords: result.totalRecords,
        successfulRecords: result.successfulRecords,
        failedRecords: result.failedRecords,
        processingEndedAt: new Date()
      })

      return {
        ...result,
        processingTime
      }

    } catch (error) {
      // Update batch with failure status
      await this.updateImportBatch(importBatch.id, {
        status: 'FAILED',
        errorSummary: error instanceof Error ? error.message : 'Unknown error',
        processingEndedAt: new Date()
      })

      throw error
    }
  }

  /**
   * Parse CSV file using PapaParse
   */
  private async parseCSV(file: Buffer | Readable): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      const csvString = file instanceof Buffer ? file.toString('utf-8') : ''
      
      parseCSV(csvString, {
        header: true,
        skipEmptyLines: true,
        delimiter: this.options.delimiter || 'auto',
        encoding: this.options.encoding || 'utf-8',
        transformHeader: (header: string) => {
          // Apply field mappings if provided
          return this.options.fieldMappings?.[header] || header.trim()
        },
        complete: (results: ParseResult<Record<string, unknown>>) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`))
          } else {
            resolve(results.data)
          }
        },
        error: (error: Error) => reject(error)
      })
    })
  }

  /**
   * Parse Excel file using XLSX
   */
  private async parseExcel(file: Buffer | Readable): Promise<Record<string, unknown>[]> {
    const buffer = file instanceof Buffer ? file : Buffer.from([])
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    // Use first worksheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use first row as headers
      defval: '', // Default value for empty cells
      raw: false // Keep as strings for consistent processing
    }) as unknown[][]

    if (jsonData.length < 2) {
      throw new Error('Excel file must contain at least 2 rows (header + data)')
    }

    // Convert to record format with field mappings
    const headers = jsonData[0] as string[]
    const mappedHeaders = headers.map(header => 
      this.options.fieldMappings?.[header] || header.trim()
    )

    return jsonData.slice(1).map((row: unknown[]) => {
      const record: Record<string, unknown> = {}
      mappedHeaders.forEach((header, index) => {
        record[header] = row[index] || ''
      })
      return record
    })
  }

  /**
   * Process data in manageable chunks
   */
  private async processDataChunks(
    importBatchId: string,
    rawData: Record<string, unknown>[]
  ): Promise<FileProcessingResult> {
    const chunkSize = this.options.chunkSize || 100
    const totalRecords = rawData.length
    let processedRecords = 0
    let successfulRecords = 0
    let failedRecords = 0
    const allErrors: ProcessingError[] = []
    const warnings: string[] = []
    const createdRecords: { invoices?: string[]; customers?: string[]; payments?: string[] } = {}

    // Initialize created records tracking
    if (this.options.importType === 'INVOICE') createdRecords.invoices = []
    if (this.options.importType === 'CUSTOMER') createdRecords.customers = []
    if (this.options.importType === 'PAYMENT') createdRecords.payments = []

    for (let i = 0; i < totalRecords; i += chunkSize) {
      const chunk = rawData.slice(i, Math.min(i + chunkSize, totalRecords))
      const chunkStartRow = i + 1 // 1-based row numbering

      try {
        const chunkResult = await this.processChunk(importBatchId, chunk, chunkStartRow)
        
        processedRecords += chunkResult.processedCount
        successfulRecords += chunkResult.successfulCount
        failedRecords += chunkResult.failedCount
        allErrors.push(...chunkResult.errors)
        warnings.push(...chunkResult.warnings)

        // Track created record IDs
        if (chunkResult.createdIds) {
          if (createdRecords.invoices && chunkResult.createdIds.invoices) {
            createdRecords.invoices.push(...chunkResult.createdIds.invoices)
          }
          if (createdRecords.customers && chunkResult.createdIds.customers) {
            createdRecords.customers.push(...chunkResult.createdIds.customers)
          }
          if (createdRecords.payments && chunkResult.createdIds.payments) {
            createdRecords.payments.push(...chunkResult.createdIds.payments)
          }
        }

        // Update progress
        const progress: ProcessingProgress = {
          importBatchId,
          totalRecords,
          processedRecords,
          successfulRecords,
          failedRecords,
          currentRecord: Math.min(i + chunkSize, totalRecords),
          status: 'PROCESSING',
          errors: allErrors,
          startTime: new Date(),
          processingRate: processedRecords / ((Date.now() - Date.now()) / 1000 || 1)
        }

        if (this.progressCallback) {
          this.progressCallback(progress)
        }

        // Update database progress
        await this.updateImportBatch(importBatchId, {
          processedRecords,
          successfulRecords,
          failedRecords
        })

        // If rollback on error is enabled and we have failures, stop processing
        if (this.options.rollbackOnError && failedRecords > 0) {
          warnings.push('Processing stopped due to rollback on error policy')
          break
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown chunk processing error'
        warnings.push(`Chunk ${i / chunkSize + 1} failed: ${errorMessage}`)
        
        if (this.options.rollbackOnError) {
          throw error
        }
      }
    }

    return {
      importBatchId,
      totalRecords,
      successfulRecords,
      failedRecords,
      processingTime: 0, // Will be set by caller
      errors: allErrors,
      warnings,
      createdRecords
    }
  }

  /**
   * Process a single chunk of data
   */
  private async processChunk(
    importBatchId: string,
    chunk: Record<string, unknown>[],
    startRowNumber: number
  ): Promise<{
    processedCount: number
    successfulCount: number
    failedCount: number
    errors: ProcessingError[]
    warnings: string[]
    createdIds?: { invoices?: string[]; customers?: string[]; payments?: string[] }
  }> {
    const processedRows: ProcessedRow[] = []
    const errors: ProcessingError[] = []
    const warnings: string[] = []
    const createdIds: { invoices?: string[]; customers?: string[]; payments?: string[] } = {}

    // Validate and process each row
    for (let i = 0; i < chunk.length; i++) {
      const rowNumber = startRowNumber + i
      const rawRow = chunk[i]

      try {
        const processedRow = await this.processRow(rawRow, rowNumber)
        processedRows.push(processedRow)
        
        if (processedRow.errors.length > 0) {
          errors.push(...processedRow.errors)
        }
      } catch (error) {
        const processingError: ProcessingError = {
          rowNumber,
          errorType: 'VALIDATION_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown row processing error',
          csvData: rawRow
        }
        errors.push(processingError)
      }
    }

    // If validation only, don't create records
    if (this.options.validateOnly) {
      return {
        processedCount: chunk.length,
        successfulCount: processedRows.filter(r => r.isValid).length,
        failedCount: processedRows.filter(r => !r.isValid).length,
        errors,
        warnings
      }
    }

    // Create database records for valid rows
    const validRows = processedRows.filter(row => row.isValid)
    
    if (validRows.length > 0) {
      try {
        const createResult = await this.createDatabaseRecords(importBatchId, validRows)
        Object.assign(createdIds, createResult.createdIds)
        warnings.push(...createResult.warnings)
      } catch (error) {
        warnings.push(`Failed to create database records: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      processedCount: chunk.length,
      successfulCount: validRows.length,
      failedCount: chunk.length - validRows.length,
      errors,
      warnings,
      createdIds
    }
  }

  /**
   * Process and validate a single row
   */
  private async processRow(
    rawRow: Record<string, unknown>,
    rowNumber: number
  ): Promise<ProcessedRow> {
    const errors: ProcessingError[] = []
    const warnings: string[] = []

    try {
      let processedData: Record<string, unknown>

      // Process based on import type
      switch (this.options.importType) {
        case 'INVOICE':
          processedData = await this.processInvoiceRow(rawRow, rowNumber, errors)
          break
        case 'CUSTOMER':
          processedData = await this.processCustomerRow(rawRow, rowNumber, errors)
          break
        case 'PAYMENT':
          processedData = await this.processPaymentRow(rawRow, rowNumber, errors)
          break
        default:
          throw new Error(`Unsupported import type: ${this.options.importType}`)
      }

      return {
        rowNumber,
        originalData: rawRow,
        processedData,
        isValid: errors.length === 0,
        errors,
        warnings
      }

    } catch (error) {
      const processingError: ProcessingError = {
        rowNumber,
        errorType: 'VALIDATION_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Row processing failed',
        csvData: rawRow
      }

      return {
        rowNumber,
        originalData: rawRow,
        processedData: {},
        isValid: false,
        errors: [processingError],
        warnings
      }
    }
  }

  /**
   * Process invoice row with UAE business validations
   */
  private async processInvoiceRow(
    rawRow: Record<string, unknown>,
    rowNumber: number,
    errors: ProcessingError[]
  ): Promise<Record<string, unknown>> {
    try {
      // Validate using schema
      const validatedData = csvInvoiceRowSchema.parse(rawRow)

      // Additional UAE business validations
      await this.validateUAEBusinessRules(validatedData, rowNumber, errors)

      // Calculate VAT if not provided
      if (validatedData.items && validatedData.items.length > 0) {
        const vatCalculation = calculateInvoiceVAT(
          validatedData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxCategory: item.taxCategory || 'STANDARD'
          }))
        )

        // Update calculated values
        validatedData.subtotal = vatCalculation.subtotal.toNumber()
        validatedData.vatAmount = vatCalculation.totalVatAmount.toNumber()
        validatedData.totalAmount = vatCalculation.grandTotal.toNumber()
      }

      return validatedData

    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            rowNumber,
            errorType: 'VALIDATION_ERROR',
            errorMessage: issue.message,
            fieldName: issue.path.join('.'),
            attemptedValue: String(issue.input || ''),
            suggestion: this.getSuggestionForField(issue.path.join('.'), String(issue.input || '')),
            csvData: rawRow
          })
        }
      } else {
        errors.push({
          rowNumber,
          errorType: 'VALIDATION_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Validation failed',
          csvData: rawRow
        })
      }
      
      return {}
    }
  }

  /**
   * Process customer row with UAE validations
   */
  private async processCustomerRow(
    rawRow: Record<string, unknown>,
    rowNumber: number,
    errors: ProcessingError[]
  ): Promise<Record<string, unknown>> {
    // Similar structure to processInvoiceRow but for customers
    // Implementation would follow same pattern with customer-specific validations
    return {}
  }

  /**
   * Process payment row
   */
  private async processPaymentRow(
    rawRow: Record<string, unknown>,
    rowNumber: number,
    errors: ProcessingError[]
  ): Promise<Record<string, unknown>> {
    // Similar structure to processInvoiceRow but for payments
    return {}
  }

  /**
   * Validate UAE-specific business rules
   */
  private async validateUAEBusinessRules(
    data: any,
    rowNumber: number,
    errors: ProcessingError[]
  ): Promise<void> {
    // Validate TRN if provided
    if (data.trnNumber && !validateTRN(data.trnNumber)) {
      errors.push({
        rowNumber,
        errorType: 'BUSINESS_RULE_ERROR',
        errorMessage: 'Invalid UAE TRN format. Must be 15 digits.',
        fieldName: 'trnNumber',
        attemptedValue: data.trnNumber,
        suggestion: 'Enter a valid 15-digit TRN number (e.g., 123456789012345)',
        csvData: data
      })
    }

    // Validate email format
    if (data.customerEmail && !UAE_EMAIL_REGEX.test(data.customerEmail)) {
      errors.push({
        rowNumber,
        errorType: 'BUSINESS_RULE_ERROR',
        errorMessage: 'Invalid email format',
        fieldName: 'customerEmail',
        attemptedValue: data.customerEmail,
        suggestion: 'Enter a valid email address (e.g., customer@company.com)',
        csvData: data
      })
    }

    // Check for duplicate invoice number in company
    if (data.number) {
      const existingInvoice = await prisma.invoices.findFirst({
        where: {
          companyId: this.options.companyId,
          number: data.number
        }
      })

      if (existingInvoice) {
        errors.push({
          rowNumber,
          errorType: 'DUPLICATE_ERROR',
          errorMessage: 'Invoice number already exists in company',
          fieldName: 'number',
          attemptedValue: data.number,
          suggestion: 'Use a unique invoice number',
          csvData: data
        })
      }
    }

    // Validate currency is AED or other accepted currencies
    if (data.currency && !['AED', 'USD', 'EUR'].includes(data.currency)) {
      errors.push({
        rowNumber,
        errorType: 'BUSINESS_RULE_ERROR',
        errorMessage: 'Unsupported currency',
        fieldName: 'currency',
        attemptedValue: data.currency,
        suggestion: 'Use AED, USD, or EUR',
        csvData: data
      })
    }
  }

  /**
   * Get suggestion for validation errors
   */
  private getSuggestionForField(fieldName: string, value: string): string {
    switch (fieldName) {
      case 'customerEmail':
        return 'Enter a valid email address (e.g., customer@company.ae)'
      case 'trnNumber':
        return 'Enter a 15-digit UAE TRN number'
      case 'amount':
        return 'Enter a positive number with up to 2 decimal places'
      case 'dueDate':
        return 'Enter date in YYYY-MM-DD format or DD/MM/YYYY'
      case 'currency':
        return 'Use AED for UAE Dirham'
      default:
        return 'Please check the field format and try again'
    }
  }

  /**
   * Create database records for processed data
   */
  private async createDatabaseRecords(
    importBatchId: string,
    validRows: ProcessedRow[]
  ): Promise<{
    createdIds: { invoices?: string[]; customers?: string[]; payments?: string[] }
    warnings: string[]
  }> {
    const createdIds: { invoices?: string[]; customers?: string[]; payments?: string[] } = {}
    const warnings: string[] = []

    if (this.options.importType === 'INVOICE') {
      createdIds.invoices = []
      
      for (const row of validRows) {
        try {
          const invoiceData = row.processedData as any
          
          // Create or find customer first
          const customer = await prisma.customers.upsert({
            where: {
              email_companyId: {
                email: invoiceData.customerEmail,
                companyId: this.options.companyId
              }
            },
            create: {
              id: crypto.randomUUID(),
              name: invoiceData.customerName,
              email: invoiceData.customerEmail,
              companyId: this.options.companyId
            },
            update: {
              name: invoiceData.customerName
            }
          })

          // Create invoice
          const invoice = await prisma.invoices.create({
            data: {
              id: crypto.randomUUID(),
              companyId: this.options.companyId,
              number: invoiceData.number,
              customerName: invoiceData.customerName,
              customerEmail: invoiceData.customerEmail,
              amount: invoiceData.amount,
              subtotal: invoiceData.subtotal,
              vatAmount: invoiceData.vatAmount,
              totalAmount: invoiceData.totalAmount,
              currency: invoiceData.currency,
              dueDate: invoiceData.dueDate,
              status: invoiceData.status,
              description: invoiceData.description,
              descriptionAr: invoiceData.descriptionAr,
              notes: invoiceData.notes,
              notesAr: invoiceData.notesAr,
              trnNumber: invoiceData.trnNumber,
              importBatchId
            }
          })

          // Create invoice items
          if (invoiceData.items && invoiceData.items.length > 0) {
            await prisma.invoiceItem.createMany({
              data: invoiceData.items.map((item: any) => ({
                id: crypto.randomUUID(),
                invoiceId: invoice.id,
                description: item.description,
                descriptionAr: item.descriptionAr,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                vatRate: item.vatRate,
                vatAmount: item.vatAmount,
                totalWithVat: item.totalWithVat,
                taxCategory: item.taxCategory
              }))
            })
          }

          createdIds.invoices!.push(invoice.id)
          
        } catch (error) {
          warnings.push(`Failed to create invoice for row ${row.rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    return { createdIds, warnings }
  }

  /**
   * Create import batch record
   */
  private async createImportBatch(
    filename: string,
    originalFilename: string,
    fileSize: number
  ): Promise<{ id: string }> {
    return await prisma.importBatch.create({
      data: {
        id: crypto.randomUUID(),
        companyId: this.options.companyId,
        userId: this.options.userId,
        filename,
        originalFilename,
        fileSize,
        importType: this.options.importType,
        fieldMappings: this.options.fieldMappings || {},
        status: 'PENDING'
      }
    })
  }

  /**
   * Update import batch progress
   */
  private async updateImportBatch(
    batchId: string,
    updates: Partial<{
      status: string
      totalRecords: number
      processedRecords: number
      successfulRecords: number
      failedRecords: number
      processingStartedAt: Date
      processingEndedAt: Date
      errorSummary: string
    }>
  ): Promise<void> {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: updates as any
    })
  }
}

// Utility functions for file validation
export function validateFileType(filename: string): boolean {
  const allowedExtensions = ['csv', 'xlsx', 'xls']
  const extension = filename.toLowerCase().split('.').pop()
  return allowedExtensions.includes(extension!)
}

export function validateFileSize(fileSize: number, maxSize = 50 * 1024 * 1024): boolean {
  return fileSize <= maxSize
}

export async function detectCSVDelimiter(sample: string): Promise<string> {
  const delimiters = [',', ';', '\t', '|']
  let maxCount = 0
  let bestDelimiter = ','

  for (const delimiter of delimiters) {
    const count = (sample.match(new RegExp(delimiter, 'g')) || []).length
    if (count > maxCount) {
      maxCount = count
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

export async function previewCSVData(
  file: Buffer,
  rows = 5,
  delimiter?: string
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const csvString = file.toString('utf-8')
    
    parseCSV(csvString, {
      header: true,
      preview: rows,
      delimiter: delimiter || 'auto',
      skipEmptyLines: true,
      complete: (results: ParseResult<Record<string, unknown>>) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV preview errors: ${results.errors.map(e => e.message).join(', ')}`))
        } else {
          resolve(results.data)
        }
      },
      error: (error: Error) => reject(error)
    })
  })
}