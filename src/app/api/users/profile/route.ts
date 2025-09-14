import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireAuth } from '@/lib/auth-utils'
import { userService } from '@/lib/services/user-service'
import { updateUserSchema } from '@/lib/schemas/user'

// GET /api/users/profile - Get current user's profile
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuth(request)

    const user = await userService.getUserById(
      authContext.user.id,
      authContext.user.companyId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(user, 'Profile retrieved successfully')

  } catch (error) {
    logError('GET /api/users/profile', error)
    return handleApiError(error)
  }
}

// PUT /api/users/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const authContext = await requireAuth(request)
    const body = await request.json()
    
    // Validate request body - users can only update name and email, not role
    const updateData = updateUserSchema.parse(body)
    
    // Remove role from update data for profile updates
    const { role, ...profileUpdateData } = updateData

    const user = await userService.updateUser(
      authContext.user.id,
      profileUpdateData,
      authContext.user.companyId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(user, 'Profile updated successfully')

  } catch (error) {
    logError('PUT /api/users/profile', error)
    return handleApiError(error)
  }
}