/**
 * PDF Invoice Upload and Parsing API
 * Handles PDF upload, extracts invoice data using Claude AI with Textract fallback
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseInvoiceWithFallback } from '@/lib/services/claude-invoice-parser'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 10MB allowed.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse PDF using Claude AI with Textract fallback
    console.log('[PDF Upload] Starting extraction with Claude AI...')
    const startTime = Date.now()
    const extractedData = await parseInvoiceWithFallback(buffer)
    const processingTime = Date.now() - startTime
    console.log(`[PDF Upload] Extraction completed in ${processingTime}ms:`, extractedData)

    // Validate extracted data (basic validation)
    const validation = {
      isValid: extractedData.confidence >= 60,
      errors: [] as string[],
      warnings: [] as string[]
    }

    if (!extractedData.invoiceNumber) validation.warnings.push('Invoice number not found')
    if (!extractedData.customerName) validation.warnings.push('Customer name not found')
    if (!extractedData.totalAmount) validation.warnings.push('Total amount not found')
    if (extractedData.confidence < 60) validation.errors.push('Low confidence extraction')

    // Return extracted data with validation results
    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        extractedData,
        validation,
        processingTime,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[PDF Upload] Error:', error)

    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF'

    return NextResponse.json(
      {
        error: 'PDF processing failed',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

// Configure route for file uploads
export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
}