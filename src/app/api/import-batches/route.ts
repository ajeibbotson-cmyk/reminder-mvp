import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'
import { successResponse, handleApiError } from '@/lib/errors'

// GET /api/import-batches - Fetch import batches for a company
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')

    // Validate company access
    if (companyId !== authContext.user.companiesId) {
      return Response.json(
        { success: false, error: 'Access denied to this company data' },
        { status: 403 }
      )
    }

    // Fetch import batches for the company
    const batches = await prisma.importBatches.findMany({
      where: {
        company_id: companyId
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 50 // Limit to recent 50 batches
    })

    return successResponse(batches)

  } catch (error) {
    return handleApiError(error, 'Failed to fetch import batches')
  }
}

// POST /api/import-batches - Create new import batch
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])
    const body = await request.json()

    const { fileName, fileSize, totalRecords, fileType } = body

    // Create new import batch
    const batch = await prisma.importBatches.create({
      data: {
        company_id: authContext.user.companiesId,
        file_name: fileName,
        file_size: fileSize,
        total_records: totalRecords,
        file_type: fileType || 'CSV',
        status: 'PENDING',
        created_by: authContext.user.id
      }
    })

    return successResponse(batch)

  } catch (error) {
    return handleApiError(error, 'Failed to create import batch')
  }
}