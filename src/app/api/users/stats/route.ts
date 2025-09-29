import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireRole } from '@/lib/auth-utils'
import { userService } from '@/lib/services/user-service'
import { UserRole } from '@prisma/client'

// GET /api/users/stats - Get user statistics for dashboard (Admin only)
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN])

    const stats = await userService.getUserStats(
      authContext.user.companiesId,
      authContext.user.role
    )

    return successResponse(stats, 'User statistics retrieved successfully')

  } catch (error) {
    logError('GET /api/users/stats', error)
    return handleApiError(error)
  }
}