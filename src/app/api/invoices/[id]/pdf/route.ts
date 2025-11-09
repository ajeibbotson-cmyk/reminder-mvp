/**
 * Invoice PDF Access API
 * Generates presigned URLs for secure PDF access from S3
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const invoiceId = params.id

    // Fetch invoice and verify company access
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId: session.user.companyId
      },
      select: {
        id: true,
        number: true,
        pdf_s3_key: true,
        pdf_s3_bucket: true,
        pdf_uploaded_at: true
      }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or access denied' },
        { status: 404 }
      )
    }

    // Check if PDF exists
    if (!invoice.pdf_s3_key || !invoice.pdf_s3_bucket) {
      return NextResponse.json(
        { error: 'No PDF available for this invoice' },
        { status: 404 }
      )
    }

    // Generate presigned URL (valid for 1 hour)
    const command = new GetObjectCommand({
      Bucket: invoice.pdf_s3_bucket,
      Key: invoice.pdf_s3_key,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600 // 1 hour
    })

    return NextResponse.json({
      success: true,
      data: {
        presignedUrl,
        fileName: `invoice-${invoice.number}.pdf`,
        uploadedAt: invoice.pdf_uploaded_at,
        expiresIn: 3600
      }
    })

  } catch (error) {
    console.error('PDF access error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF access URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
