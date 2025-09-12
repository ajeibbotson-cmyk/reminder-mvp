import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireAuth } from '@/lib/auth-utils'

// GET /api/auth/me - Get current user data
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuth(request)

    const userData = {
      id: authContext.user.id,
      email: authContext.user.email,
      name: authContext.user.name,
      role: authContext.user.role,
      companyId: authContext.user.companyId,
      company: authContext.company
    }

    return successResponse(userData)

  } catch (error) {
    logError('GET /api/auth/me', error)
    return handleApiError(error)
  }
}