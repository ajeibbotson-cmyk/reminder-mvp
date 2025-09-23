import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireAuth } from '@/lib/auth-utils'
import { userService } from '@/lib/services/user-service'
import { updateUserSchema } from '@/lib/schemas/user'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/users/[id] - Get a specific user by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const authContext = await requireAuth(request)
    const userId = (await params).id

    const user = await userService.getUserById(
      userId,
      authContext.user.companyId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(user, 'User retrieved successfully')

  } catch (error) {
    logError(`GET /api/users/${(await params).id}`, error)
    return handleApiError(error)
  }
}

// PUT /api/users/[id] - Update a specific user
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const authContext = await requireAuth(request)
    const userId = (await params).id
    const body = await request.json()
    
    // Validate request body
    const updateData = updateUserSchema.parse(body)

    const user = await userService.updateUser(
      userId,
      updateData,
      authContext.user.companyId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(user, 'User updated successfully')

  } catch (error) {
    logError(`PUT /api/users/${(await params).id}`, error)
    return handleApiError(error)
  }
}

// DELETE /api/users/[id] - Delete a specific user
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const authContext = await requireAuth(request)
    const userId = (await params).id

    await userService.deleteUser(
      userId,
      authContext.user.companyId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(null, 'User deleted successfully')

  } catch (error) {
    logError(`DELETE /api/users/${(await params).id}`, error)
    return handleApiError(error)
  }
}