import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { 
  bulkImportValidationSchema,
  validateRequestBody
} from '@/lib/validations'
import { 
  FileProcessor,
  ProcessingProgress
} from '@/lib/file-processor'
import { UserRole } from '@prisma/client'

// Store for tracking processing progress (in production, use Redis or database)
const processingProgress = new Map<string, ProcessingProgress>()

// POST /api/import/process - Start processing uploaded file
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    
    const processData = await validateRequestBody(request, bulkImportValidationSchema)
    
    // Get import batch
    const importBatch = await prisma.importBatches.findUnique({
      where: { 
        id: processData.importBatchId 
      },
      include: {
        companies: true,
        user: true
      }
    })

    if (!importBatch) {
      throw new Error('Import batch not found')
    }

    // Verify user can access this batch
    if (importBatch.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to import batch')
    }

    // Check if already processing
    if (importBatch.status === 'PROCESSING') {
      throw new Error('Import batch is already being processed')
    }

    if (importBatch.status === 'COMPLETED') {
      throw new Error('Import batch has already been completed')
    }

    // Read the uploaded file from storage (in production, this would be from cloud storage)
    const fileBuffer = await getFileFromStorage(importBatch.filename)
    
    // Create progress tracking
    const initialProgress: ProcessingProgress = {
      importBatchId: processData.importBatchId,
      totalRecords: importBatch.totalRecords,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      status: 'PENDING',
      errors: [],
      startTime: new Date()
    }
    
    processingProgress.set(processData.importBatchId, initialProgress)

    // Start processing asynchronously
    processFileAsync(
      importBatch,
      fileBuffer,
      processData,
      authContext.user.id
    ).catch(error => {
      logError('Async file processing failed', error, {
        importBatchId: processData.importBatchId,
        userId: authContext.user.id
      })
      
      // Update progress with error
      const progress = processingProgress.get(processData.importBatchId)
      if (progress) {
        progress.status = 'FAILED'
        progress.errors.push({
          rowNumber: 0,
          errorType: 'CONSTRAINT_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Processing failed',
          csvData: {}
        })
        processingProgress.set(processData.importBatchId, progress)
      }
    })

    return successResponse({
      importBatchId: processData.importBatchId,
      status: 'PROCESSING',
      message: 'Import processing started',
      progressUrl: `/api/import/progress/${processData.importBatchId}`,
      estimatedTime: Math.ceil(importBatch.totalRecords / 100) * 1000 // Rough estimate: 100 records per second
    }, 'Import processing started successfully')

  } catch (error) {
    logError('POST /api/import/process', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}

// Async function to process file in background
async function processFileAsync(
  importBatch: any,
  fileBuffer: Buffer,
  processData: any,
  userId: string
) {
  const processor = new FileProcessor(
    {
      companyId: importBatch.companyId,
      userId: userId,
      importType: importBatch.importType,
      chunkSize: processData.chunkSize || 100,
      validateOnly: processData.validateOnly || false,
      rollbackOnError: processData.rollbackOnError || true,
      fieldMappings: importBatch.fieldMappings || {}
    },
    // Progress callback
    (progress: ProcessingProgress) => {
      processingProgress.set(importBatch.id, progress)
      
      // Log significant milestones
      if (progress.processedRecords % 500 === 0) {
        logError('Import progress update', null, {
          importBatchId: importBatch.id,
          processed: progress.processedRecords,
          total: progress.totalRecords,
          rate: progress.processingRate
        })
      }
    }
  )

  try {
    const result = await processor.processFile(
      fileBuffer,
      importBatch.filename,
      importBatch.originalFilename
    )

    // Update final progress
    const finalProgress: ProcessingProgress = {
      importBatchId: importBatch.id,
      totalRecords: result.totalRecords,
      processedRecords: result.totalRecords,
      successfulRecords: result.successfulRecords,
      failedRecords: result.failedRecords,
      status: result.failedRecords > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED',
      errors: result.errors,
      startTime: new Date(Date.now() - result.processingTime),
      processingRate: result.totalRecords / (result.processingTime / 1000)
    }
    
    processingProgress.set(importBatch.id, finalProgress)

    // Log completion
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: importBatch.companyId,
        userId: userId,
        type: 'import_completed',
        description: `Import completed: ${result.successfulRecords}/${result.totalRecords} records processed`,
        metadata: {
          importBatchId: importBatch.id,
          totalRecords: result.totalRecords,
          successfulRecords: result.successfulRecords,
          failedRecords: result.failedRecords,
          processingTime: result.processingTime,
          importType: importBatch.importType
        }
      }
    })

    // Store errors in database
    if (result.errors.length > 0) {
      const errorData = result.errors.map(error => ({
        id: crypto.randomUUID(),
        importBatchId: importBatch.id,
        rowNumber: error.rowNumber,
        csvData: error.csvData,
        errorType: error.errorType,
        errorMessage: error.errorMessage,
        fieldName: error.fieldName,
        attemptedValue: error.attemptedValue,
        suggestion: error.suggestion
      }))

      // Insert in batches to avoid overwhelming database
      for (let i = 0; i < errorData.length; i += 100) {
        const batch = errorData.slice(i, i + 100)
        await prisma.importErrors.createMany({
          data: batch
        })
      }
    }

  } catch (error) {
    logError('File processing error in async function', error, {
      importBatchId: importBatch.id,
      userId: userId
    })

    // Update progress with error status
    const errorProgress: ProcessingProgress = {
      importBatchId: importBatch.id,
      totalRecords: importBatch.totalRecords,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: importBatch.totalRecords,
      status: 'FAILED',
      errors: [{
        rowNumber: 0,
        errorType: 'CONSTRAINT_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Processing failed',
        csvData: {}
      }],
      startTime: new Date()
    }
    
    processingProgress.set(importBatch.id, errorProgress)
  }
}

// Helper function to get file from storage
async function getFileFromStorage(filename: string): Promise<Buffer> {
  // In production, this would fetch from cloud storage (AWS S3, Google Cloud Storage, etc.)
  // For now, we'll simulate this with a placeholder
  
  // This is a placeholder - in real implementation:
  // - Files would be stored in cloud storage during upload
  // - This function would download the file using the storage service SDK
  
  try {
    // Simulate file retrieval
    // In production: return await s3.getObject({ Bucket: 'imports', Key: filename }).promise().Body
    throw new Error('File storage implementation needed for production')
  } catch (error) {
    throw new Error(`Failed to retrieve file from storage: ${filename}`)
  }
}

// GET /api/import/process - Get list of processing jobs for company
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const skip = (page - 1) * limit

    // Get import batches for company
    const [batches, totalCount] = await Promise.all([
      prisma.importBatches.findMany({
        where: {
          companyId: authContext.user.companyId
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              importErrors: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.importBatches.count({
        where: { companyId: authContext.user.companyId }
      })
    ])

    // Enhance with current progress for active batches
    const batchesWithProgress = batches.map(batch => {
      const progress = processingProgress.get(batch.id)
      
      return {
        ...batch,
        progress: batch.status === 'PROCESSING' ? progress : null,
        errorCount: batch._count.importErrors
      }
    })

    return successResponse({
      batches: batchesWithProgress,
      totalCount,
      page,
      limit,
      hasMore: skip + batches.length < totalCount,
      summary: {
        total: totalCount,
        processing: batches.filter(b => b.status === 'PROCESSING').length,
        completed: batches.filter(b => b.status === 'COMPLETED').length,
        failed: batches.filter(b => b.status === 'FAILED').length,
        partiallyCompleted: batches.filter(b => b.status === 'PARTIALLY_COMPLETED').length
      }
    })

  } catch (error) {
    logError('GET /api/import/process', error)
    return handleApiError(error)
  }
}