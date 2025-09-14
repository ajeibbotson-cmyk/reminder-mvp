import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireAuth } from '@/lib/auth-utils'
import { userService } from '@/lib/services/user-service'
import { changePasswordSchema } from '@/lib/schemas/user'

// POST /api/users/change-password - Change current user's password
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuth(request)
    const body = await request.json()
    
    // Validate request body
    const passwordData = changePasswordSchema.parse(body)

    await userService.changePassword(
      authContext.user.id,
      passwordData,
      authContext.user.id
    )

    return successResponse(null, 'Password changed successfully')

  } catch (error) {
    logError('POST /api/users/change-password', error)
    return handleApiError(error)
  }
}