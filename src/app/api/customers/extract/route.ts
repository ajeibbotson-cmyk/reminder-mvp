import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCustomerExtractionService, ExtractedCustomerData, CustomerMatchResult } from '@/lib/services/customer-extraction'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.companyId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { extractedData, action, matchResults } = body

    const extractionService = createCustomerExtractionService(session.user.companiesId)

    switch (action) {
      case 'extract_spreadsheet': {
        const { data, fileName, fieldMappings } = body

        if (!data || !Array.isArray(data)) {
          return NextResponse.json(
            { success: false, error: 'Invalid spreadsheet data' },
            { status: 400 }
          )
        }

        const extracted = extractionService.extractFromSpreadsheet(
          data,
          fileName,
          fieldMappings || {}
        )

        return NextResponse.json({
          success: true,
          data: {
            extracted,
            totalCount: extracted.length
          }
        })
      }

      case 'extract_pdf': {
        const { pdfText, fileName } = body

        if (!pdfText) {
          return NextResponse.json(
            { success: false, error: 'Invalid PDF text' },
            { status: 400 }
          )
        }

        const extracted = extractionService.extractFromPDF(pdfText, fileName)

        return NextResponse.json({
          success: true,
          data: {
            extracted,
            totalCount: extracted.length
          }
        })
      }

      case 'match_customers': {
        if (!extractedData || !Array.isArray(extractedData)) {
          return NextResponse.json(
            { success: false, error: 'Invalid extracted data' },
            { status: 400 }
          )
        }

        const matchResults = await extractionService.matchCustomers(extractedData)
        const summary = extractionService.generateSummary(matchResults)

        return NextResponse.json({
          success: true,
          data: {
            matchResults,
            summary
          }
        })
      }

      case 'create_customers': {
        if (!matchResults || !Array.isArray(matchResults)) {
          return NextResponse.json(
            { success: false, error: 'Invalid match results' },
            { status: 400 }
          )
        }

        const newCustomers = await extractionService.createNewCustomers(
          matchResults,
          session.user.id
        )

        return NextResponse.json({
          success: true,
          data: {
            newCustomers,
            createdCount: newCustomers.length
          }
        })
      }

      case 'process_batch': {
        // Full end-to-end processing for a batch of files
        const { files } = body

        if (!files || !Array.isArray(files)) {
          return NextResponse.json(
            { success: false, error: 'Invalid file data' },
            { status: 400 }
          )
        }

        let allExtracted: ExtractedCustomerData[] = []

        // Extract from all files
        for (const file of files) {
          let extracted: ExtractedCustomerData[] = []

          if (file.type === 'spreadsheet' && file.data) {
            extracted = extractionService.extractFromSpreadsheet(
              file.data,
              file.name,
              file.fieldMappings || {}
            )
          } else if (file.type === 'pdf' && file.pdfText) {
            extracted = extractionService.extractFromPDF(file.pdfText, file.name)
          }

          allExtracted = allExtracted.concat(extracted)
        }

        // Match customers
        const matchResults = await extractionService.matchCustomers(allExtracted)

        // Create new customers
        const newCustomers = await extractionService.createNewCustomers(
          matchResults,
          session.user.id
        )

        // Generate summary
        const summary = extractionService.generateSummary(matchResults)

        return NextResponse.json({
          success: true,
          data: {
            extracted: allExtracted,
            matchResults,
            newCustomers,
            summary,
            statistics: {
              filesProcessed: files.length,
              customersExtracted: allExtracted.length,
              customersCreated: newCustomers.length,
              exactMatches: summary.exactMatches,
              fuzzyMatches: summary.fuzzyMatches,
              manualReviewRequired: summary.manualReviewRequired
            }
          }
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Customer extraction API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint for retrieving extraction results
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.companyId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Batch ID required' },
        { status: 400 }
      )
    }

    // This would typically retrieve stored extraction results
    // For now, return placeholder data
    return NextResponse.json({
      success: true,
      data: {
        batchId,
        status: 'completed',
        extractedCount: 0,
        createdCount: 0,
        summary: {
          totalExtracted: 0,
          exactMatches: 0,
          fuzzyMatches: 0,
          newCustomers: 0,
          duplicatesFound: 0,
          manualReviewRequired: 0,
          errors: []
        }
      }
    })
  } catch (error) {
    console.error('Customer extraction GET API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}