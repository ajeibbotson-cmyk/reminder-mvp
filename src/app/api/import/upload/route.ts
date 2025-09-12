import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { 
  fileUploadSchema,
  validateFormData
} from '@/lib/validations'
import { 
  FileProcessor,
  validateFileType,
  validateFileSize,
  previewCSVData 
} from '@/lib/file-processor'
import { UserRole } from '@prisma/client'

// POST /api/import/upload - Upload and validate import file
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('No file uploaded')
    }

    // Validate file basic properties
    if (!validateFileType(file.name)) {
      throw new Error('Invalid file type. Only CSV, XLSX, and XLS files are allowed.')
    }

    if (!validateFileSize(file.size)) {
      throw new Error('File size too large. Maximum size is 50MB.')
    }

    // Extract other form fields
    const uploadData = validateFormData(formData, fileUploadSchema.extend({
      file: fileUploadSchema.shape.filename.optional() // File is handled separately
    }))

    // Ensure user can only upload for their company
    if (uploadData.companyId !== authContext.user.companyId) {
      uploadData.companyId = authContext.user.companyId
    }

    // Read file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    
    // Generate unique filename
    const timestamp = Date.now()
    const uniqueFilename = `${timestamp}_${file.name}`

    try {
      // Preview file data (first 5 rows)
      let preview: Record<string, unknown>[] = []
      if (file.name.toLowerCase().endsWith('.csv')) {
        preview = await previewCSVData(fileBuffer, 5)
      }

      // Create file processor
      const processor = new FileProcessor({
        companyId: uploadData.companyId,
        userId: authContext.user.id,
        importType: uploadData.importType,
        validateOnly: true // Only validate for preview
      })

      // Process file for validation
      const validationResult = await processor.processFile(
        fileBuffer,
        uniqueFilename,
        file.name
      )

      // Return upload details and preview
      return successResponse({
        fileId: validationResult.importBatchId,
        filename: file.name,
        fileSize: file.size,
        importType: uploadData.importType,
        preview: preview.slice(0, 5), // First 5 rows
        validation: {
          totalRecords: validationResult.totalRecords,
          validRecords: validationResult.successfulRecords,
          invalidRecords: validationResult.failedRecords,
          errors: validationResult.errors.slice(0, 10), // First 10 errors
          hasErrors: validationResult.failedRecords > 0
        },
        uploadedAt: new Date().toISOString()
      }, 'File uploaded and validated successfully')

    } catch (processingError) {
      logError('File processing error', processingError, { 
        userId: authContext.user.id,
        filename: file.name,
        fileSize: file.size
      })

      throw new Error(`File processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`)
    }

  } catch (error) {
    logError('POST /api/import/upload', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}

// GET /api/import/upload - Get file upload limits and supported formats
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    
    return successResponse({
      supportedFormats: ['csv', 'xlsx', 'xls'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxFileSizeMB: 50,
      importTypes: ['INVOICE', 'CUSTOMER', 'PAYMENT', 'INVOICE_ITEMS'],
      sampleTemplates: {
        invoice: {
          downloadUrl: '/api/import/templates/invoice',
          requiredFields: [
            'number', 'customerName', 'customerEmail', 
            'amount', 'currency', 'dueDate'
          ],
          optionalFields: [
            'description', 'descriptionAr', 'notes', 'notesAr',
            'trnNumber', 'status', 'items'
          ]
        },
        customer: {
          downloadUrl: '/api/import/templates/customer',
          requiredFields: ['name', 'email'],
          optionalFields: ['phone', 'paymentTerms', 'notes', 'nameAr', 'notesAr']
        }
      },
      validationRules: {
        uae: {
          trnFormat: '15 digits (e.g., 123456789012345)',
          phoneFormat: '+971XXXXXXXX or 0XXXXXXXX',
          currency: 'AED (default), USD, EUR supported',
          vatRate: '5% standard UAE VAT rate'
        }
      }
    })

  } catch (error) {
    logError('GET /api/import/upload', error)
    return handleApiError(error)
  }
}