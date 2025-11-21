/**
 * Bulk PDF Invoice Upload and Parallel Parsing API
 * Handles multiple PDF uploads with parallel Textract processing
 *
 * Performance: 60 PDFs in 2-3 minutes (vs 15 minutes sequential)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractPDFsInParallel, PDFInput, ExtractionResult } from '@/lib/services/textract-parallel'

export const maxDuration = 300 // 5 minutes max for bulk processing

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data with multiple files
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate all files
    const maxSize = 10 * 1024 * 1024 // 10MB per file
    const maxFiles = 100 // Maximum files per batch

    if (files.length > maxFiles) {
      return NextResponse.json(
        { error: `Maximum ${maxFiles} files allowed per upload` },
        { status: 400 }
      )
    }

    const invalidFiles: string[] = []
    const oversizedFiles: string[] = []

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        invalidFiles.push(file.name)
      }
      if (file.size > maxSize) {
        oversizedFiles.push(file.name)
      }
    }

    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { error: `Invalid file types (PDF only): ${invalidFiles.join(', ')}` },
        { status: 400 }
      )
    }

    if (oversizedFiles.length > 0) {
      return NextResponse.json(
        { error: `Files exceeding 10MB limit: ${oversizedFiles.join(', ')}` },
        { status: 400 }
      )
    }

    // Convert files to PDFInput format for parallel processing
    console.log(`[BulkUpload] Processing ${files.length} PDF files...`)

    const pdfInputs: PDFInput[] = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        return {
          fileName: file.name,
          buffer: Buffer.from(arrayBuffer)
        }
      })
    )

    // Process all PDFs in parallel using optimized Textract parallel processor
    console.log(`[BulkUpload] Starting parallel extraction...`)
    const results = await extractPDFsInParallel(pdfInputs)

    // Calculate statistics
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const totalTime = Date.now() - startTime

    console.log(`[BulkUpload] Complete: ${successful.length}/${results.length} successful in ${(totalTime/1000).toFixed(1)}s`)

    // Transform results for frontend
    const transformedResults = results.map((result: ExtractionResult) => ({
      fileName: result.fileName,
      success: result.success,
      error: result.error,
      processingTimeMs: result.processingTimeMs,
      extractedData: result.data ? {
        invoiceNumber: result.data.invoiceNumber,
        customerName: result.data.customerName,
        amount: result.data.amount,
        totalAmount: result.data.totalAmount,
        currency: result.data.currency || 'EUR',
        invoiceDate: result.data.invoiceDate,
        dueDate: result.data.dueDate,
        confidence: result.data.confidence,
        rawText: result.data.rawText?.substring(0, 500) // Truncate raw text
      } : null,
      validation: result.data ? {
        isValid: result.data.confidence >= 60,
        errors: result.data.confidence < 60 ? ['Low confidence extraction'] : [],
        warnings: [
          !result.data.invoiceNumber && 'Invoice number not found',
          !result.data.customerName && 'Customer name not found',
          !result.data.totalAmount && 'Total amount not found'
        ].filter(Boolean)
      } : {
        isValid: false,
        errors: [result.error || 'Extraction failed'],
        warnings: []
      }
    }))

    return NextResponse.json({
      success: true,
      summary: {
        totalFiles: files.length,
        successful: successful.length,
        failed: failed.length,
        totalTimeMs: totalTime,
        averageTimePerFile: Math.round(totalTime / files.length)
      },
      results: transformedResults
    })

  } catch (error) {
    console.error('[BulkUpload] Error:', error)

    return NextResponse.json(
      {
        error: 'Bulk PDF processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Configure route for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}
