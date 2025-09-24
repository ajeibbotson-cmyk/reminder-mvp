import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Valid PDF file required' },
        { status: 400 }
      )
    }

    // Convert File to Buffer for server-side processing
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Use pdf2json for text extraction (server-side only)
    const PDFParser = (await import('pdf2json')).default

    const extractedText = await new Promise<string>((resolve) => {
      const pdfParser = new PDFParser()

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('PDF parsing error:', errData.parserError)
        resolve('') // Return empty string on parsing error
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = ''

          // Extract text from all pages
          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            for (const page of pdfData.Pages) {
              if (page.Texts && Array.isArray(page.Texts)) {
                for (const textObj of page.Texts) {
                  if (textObj.R && Array.isArray(textObj.R)) {
                    for (const textRun of textObj.R) {
                      if (textRun.T) {
                        // Decode URI component and add to text
                        const decodedText = decodeURIComponent(textRun.T)
                        text += decodedText + ' '
                      }
                    }
                  }
                }
                text += '\n' // Add newline after each page
              }
            }
          }

          resolve(text.trim())
        } catch (processingError) {
          console.error('Error processing PDF data:', processingError)
          resolve('') // Return empty string on processing error
        }
      })

      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer)
    })

    return NextResponse.json({
      success: true,
      text: extractedText,
      filename: file.name,
      size: file.size
    })

  } catch (error) {
    console.error('PDF text extraction API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'