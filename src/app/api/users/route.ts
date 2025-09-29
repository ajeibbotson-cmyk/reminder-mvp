import { NextRequest } from 'next/server'
import { handleApiError, successResponse, logError } from '@/lib/errors'
import { requireAuth, requireRole } from '@/lib/auth-utils'
import { userService } from '@/lib/services/user-service'
import { 
  createUserSchema, 
  userQuerySchema, 
  bulkDeleteUsersSchema,
  bulkUpdateUsersSchema 
} from '@/lib/schemas/user'
import { UserRole } from '@prisma/client'

// GET /api/users - Get all users with filtering, pagination, and search
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN])
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const queryData = userQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      role: searchParams.get('role'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder')
    })

    const result = await userService.getUsers(
      queryData,
      authContext.user.companiesId,
      authContext.user.role
    )

    return successResponse(result, 'Users retrieved successfully')

  } catch (error) {
    logError('GET /api/users', error)
    return handleApiError(error)
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN])
    const body = await request.json()
    
    // Validate request body
    const userData = createUserSchema.parse(body)

    const user = await userService.createUser(
      userData,
      authContext.user.companiesId,
      authContext.user.role
    )

    return successResponse(user, 'User created successfully')

  } catch (error) {
    logError('POST /api/users', error)
    return handleApiError(error)
  }
}

// DELETE /api/users - Bulk delete users
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN])
    const body = await request.json()
    
    // Validate request body
    const deleteData = bulkDeleteUsersSchema.parse(body)

    const result = await userService.bulkDeleteUsers(
      deleteData,
      authContext.user.companiesId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(result, `Successfully deleted ${result.deletedCount} users`)

  } catch (error) {
    logError('DELETE /api/users', error)
    return handleApiError(error)
  }
}

// PATCH /api/users - Bulk update users
export async function PATCH(request: NextRequest) {
  try {
    const authContext = await requireRole(request, [UserRole.ADMIN])
    const body = await request.json()
    
    // Validate request body
    const updateData = bulkUpdateUsersSchema.parse(body)

    const result = await userService.bulkUpdateUsers(
      updateData,
      authContext.user.companiesId,
      authContext.user.role,
      authContext.user.id
    )

    return successResponse(result, `Successfully updated ${result.updatedCount} users`)

  } catch (error) {
    logError('PATCH /api/users', error)
    return handleApiError(error)
  }
}