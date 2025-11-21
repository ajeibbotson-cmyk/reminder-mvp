/**
 * Async PDF Invoice Upload API
 * Returns immediately with tracking ID, processes in background
 *
 * Flow:
 * 1. User uploads PDF → Immediate response with trackingId
 * 2. Background processing via Textract ExpenseAnalysis
 * 3. Frontend polls /api/invoices/upload-status/[trackingId] for results
 *
 * This provides the best UX - users can continue working while PDFs process
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TextractExpenseParser } from '@/lib/services/textract-expense-parser'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// In-memory store for processing status (in production, use Redis)
// This works for single-instance deployments on Vercel
const processingJobs = new Map<string, {
  status: 'processing' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  result?: any
  error?: string
  fileName: string
  fileSize: number
}>()

// Cleanup old jobs after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const [id, job] of processingJobs) {
    if (job.startedAt.getTime() < oneHourAgo) {
      processingJobs.delete(id)
    }
  }
}, 5 * 60 * 1000) // Run every 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Generate tracking ID
    const trackingId = randomUUID()

    // Store initial status
    processingJobs.set(trackingId, {
      status: 'processing',
      startedAt: new Date(),
      fileName: file.name,
      fileSize: file.size
    })

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Return immediately with tracking ID
    const response = NextResponse.json({
      success: true,
      trackingId,
      message: 'Processing started',
      fileName: file.name,
      estimatedTime: '10-30 seconds'
    })

    // Process in background (don't await)
    processInBackground(trackingId, buffer, file.name, session.user.companyId)
      .catch(err => console.error('[AsyncUpload] Background processing error:', err))

    return response

  } catch (error) {
    console.error('[AsyncUpload] Error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Background processing function
 */
async function processInBackground(
  trackingId: string,
  buffer: Buffer,
  fileName: string,
  companyId: string
) {
  const startTime = Date.now()

  try {
    console.log(`[AsyncUpload] Starting background processing: ${trackingId}`)

    // Use the new expense parser (faster + more accurate)
    const extractedData = await TextractExpenseParser.parseInvoicePDF(buffer, fileName)

    const processingTime = Date.now() - startTime
    console.log(`[AsyncUpload] Completed in ${processingTime}ms: ${trackingId}`)

    // Build validation results
    const validation = {
      isValid: extractedData.confidence >= 60,
      errors: [] as string[],
      warnings: [] as string[]
    }

    if (!extractedData.invoiceNumber) validation.warnings.push('Invoice number not found')
    if (!extractedData.customerName && !extractedData.vendorName) validation.warnings.push('Customer/vendor name not found')
    if (!extractedData.totalAmount) validation.warnings.push('Total amount not found')
    if (extractedData.confidence < 60) validation.errors.push('Low confidence extraction')

    // Update job status
    processingJobs.set(trackingId, {
      status: 'completed',
      startedAt: processingJobs.get(trackingId)!.startedAt,
      completedAt: new Date(),
      fileName,
      fileSize: buffer.length,
      result: {
        fileName,
        fileSize: buffer.length,
        extractedData,
        validation,
        processingTimeMs: processingTime
      }
    })

  } catch (error) {
    console.error(`[AsyncUpload] Failed: ${trackingId}`, error)

    // Update with error status
    const job = processingJobs.get(trackingId)
    if (job) {
      processingJobs.set(trackingId, {
        ...job,
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Processing failed'
      })
    }
  }
}

/**
 * GET endpoint to check processing status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const trackingId = searchParams.get('trackingId')

  if (!trackingId) {
    return NextResponse.json({ error: 'trackingId required' }, { status: 400 })
  }

  const job = processingJobs.get(trackingId)

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.status === 'processing') {
    const elapsed = Date.now() - job.startedAt.getTime()
    return NextResponse.json({
      status: 'processing',
      trackingId,
      fileName: job.fileName,
      elapsedMs: elapsed,
      message: elapsed > 30000 ? 'Still processing, almost done...' : 'Processing your invoice...'
    })
  }

  if (job.status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      trackingId,
      error: job.error,
      processingTimeMs: job.completedAt ? job.completedAt.getTime() - job.startedAt.getTime() : 0
    })
  }

  // Completed
  return NextResponse.json({
    status: 'completed',
    trackingId,
    data: job.result,
    processingTimeMs: job.completedAt ? job.completedAt.getTime() - job.startedAt.getTime() : 0
  })
}
