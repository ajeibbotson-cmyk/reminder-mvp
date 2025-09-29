import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { createActivitySchema, validateRequestBody } from '@/lib/validations'
import { UserRole } from '@prisma/client'

// GET /api/activities - Fetch activities for a company
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER])
    const searchParams = request.nextUrl.searchParams
    
    const companyId = searchParams.get('companyId')
    const limitParam = searchParams.get('limit')
    
    // Ensure user can only access their company's activities
    if (companyId && companyId !== authContext.user.companiesId) {
      throw new Error('Access denied to company data')
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50
    const validLimit = Math.min(Math.max(limit, 1), 100) // Between 1 and 100

    const activities = await prisma.activities.findMany({
      where: {
        companyId: authContext.user.companiesId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: validLimit
    })

    return successResponse(activities)

  } catch (error) {
    logError('GET /api/activities', error, { 
      userId: 'authContext.user?.id',
      searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
    })
    return handleApiError(error)
  }
}

// POST /api/activities - Create new activity log
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN, UserRole.FINANCE])

    const activityData = await validateRequestBody(request, createActivitySchema)
    
    // Ensure user can only create activities for their company
    if (activityData.companyId !== authContext.user.companiesId) {
      activityData.companyId = authContext.user.companiesId
    }

    // Ensure user can only log activities for themselves
    if (activityData.userId !== authContext.user.id) {
      activityData.userId = authContext.user.id
    }

    const activity = await prisma.activities.create({
      data: {
        companyId: activityData.companyId,
        userId: activityData.userId,
        type: activityData.type,
        description: activityData.description,
        metadata: activityData.metadata || {}
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    return successResponse(activity, 'Activity logged successfully')

  } catch (error) {
    logError('POST /api/activities', error, { 
      userId: 'authContext.user?.id'
    })
    return handleApiError(error)
  }
}