import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'

// Global progress storage (in production, use Redis)
declare global {
  var processingProgress: Map<string, any> | undefined
}

const progressStore = globalThis.processingProgress || new Map()
if (!globalThis.processingProgress) {
  globalThis.processingProgress = progressStore
}

// GET /api/import/progress/[batchId] - Get real-time progress for import batch
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const { batchId } = params

    // Get import batch from database
    const importBatch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        company: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            importErrors: true,
            invoices: true
          }
        }
      }
    })

    if (!importBatch) {
      throw new Error('Import batch not found')
    }

    // Verify user can access this batch
    if (importBatch.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to import batch')
    }

    // Get real-time progress from memory/cache
    const liveProgress = progressStore.get(batchId)
    
    // Calculate progress percentage
    const progressPercentage = importBatch.totalRecords > 0 
      ? Math.round((importBatch.processedRecords / importBatch.totalRecords) * 100) 
      : 0

    // Estimate completion time
    let estimatedCompletion: Date | null = null
    if (liveProgress && liveProgress.processingRate && liveProgress.status === 'PROCESSING') {
      const remainingRecords = importBatch.totalRecords - importBatch.processedRecords
      const remainingTimeMs = (remainingRecords / liveProgress.processingRate) * 1000
      estimatedCompletion = new Date(Date.now() + remainingTimeMs)
    }

    // Calculate processing duration
    let processingDuration = 0
    if (importBatch.processingStartedAt) {
      const endTime = importBatch.processingEndedAt || new Date()
      processingDuration = endTime.getTime() - importBatch.processingStartedAt.getTime()
    }

    const response = {
      batchId: importBatch.id,
      status: importBatch.status,
      importType: importBatch.importType,
      filename: importBatch.originalFilename,
      fileSize: importBatch.fileSize,
      
      // Progress metrics
      progress: {
        totalRecords: importBatch.totalRecords,
        processedRecords: importBatch.processedRecords,
        successfulRecords: importBatch.successfulRecords,
        failedRecords: importBatch.failedRecords,
        progressPercentage,
        currentRecord: liveProgress?.currentRecord || importBatch.processedRecords,
        
        // Timing information
        startedAt: importBatch.processingStartedAt,
        estimatedCompletion,
        processingDuration,
        processingRate: liveProgress?.processingRate || null,
        
        // Status flags
        isProcessing: importBatch.status === 'PROCESSING',
        isCompleted: ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(importBatch.status),
        hasFailed: importBatch.status === 'FAILED',
        hasErrors: importBatch.failedRecords > 0
      },
      
      // Error summary
      errors: {
        totalErrors: importBatch._count.importErrors,
        errorSummary: importBatch.errorSummary,
        recentErrors: liveProgress?.errors?.slice(-5) || [] // Last 5 errors
      },
      
      // Results summary
      results: {
        createdInvoices: importBatch._count.invoices,
        createdCustomers: 0, // Would be calculated based on import type
        createdPayments: 0   // Would be calculated based on import type
      },
      
      // Metadata
      createdBy: importBatch.user,
      company: importBatch.company,
      createdAt: importBatch.createdAt,
      updatedAt: importBatch.updatedAt
    }

    return successResponse(response)

  } catch (error) {
    logError('GET /api/import/progress/[batchId]', error, { 
      batchId: 'params?.batchId'
    })
    return handleApiError(error)
  }
}

// DELETE /api/import/progress/[batchId] - Cancel import batch
export async function DELETE(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const { batchId } = params

    // Get import batch
    const importBatch = await prisma.importBatch.findUnique({
      where: { id: batchId }
    })

    if (!importBatch) {
      throw new Error('Import batch not found')
    }

    // Verify user can access this batch
    if (importBatch.companyId !== authContext.user.companyId) {
      throw new Error('Access denied to import batch')
    }

    // Can only cancel pending or processing batches
    if (!['PENDING', 'PROCESSING'].includes(importBatch.status)) {
      throw new Error(`Cannot cancel batch with status: ${importBatch.status}`)
    }

    // Update status to cancelled
    const updatedBatch = await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'CANCELLED',
        processingEndedAt: new Date(),
        errorSummary: 'Import cancelled by user'
      }
    })

    // Clear progress from memory
    progressStore.delete(batchId)

    // Log cancellation activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: authContext.user.companyId,
        userId: authContext.user.id,
        type: 'import_cancelled',
        description: `Import batch cancelled: ${importBatch.originalFilename}`,
        metadata: {
          importBatchId: batchId,
          totalRecords: importBatch.totalRecords,
          processedRecords: importBatch.processedRecords,
          importType: importBatch.importType
        }
      }
    })

    return successResponse({
      batchId,
      status: 'CANCELLED',
      message: 'Import batch cancelled successfully'
    }, 'Import batch cancelled successfully')

  } catch (error) {
    logError('DELETE /api/import/progress/[batchId]', error, { 
      batchId: 'params?.batchId'
    })
    return handleApiError(error)
  }
}