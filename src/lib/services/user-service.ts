import { hash, compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { 
  ValidationError, 
  NotFoundError, 
  ForbiddenError,
  AppError 
} from '@/lib/errors'
import {
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  UserQueryInput,
  UserResponse,
  BulkDeleteUsersInput,
  BulkUpdateUsersInput
} from '@/lib/schemas/user'
import { UserRole } from '@prisma/client'
import crypto from 'crypto'

export interface PaginatedUserResponse {
  users: UserResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(
    data: CreateUserInput, 
    creatorCompanyId: string, 
    creatorRole: UserRole
  ): Promise<UserResponse> {
    // Only ADMIN users can create other users
    if (creatorRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only administrators can create users')
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      throw new ValidationError('A user with this email already exists', 'email')
    }

    // Hash the password
    const hashedPassword = await hash(data.password, 12)

    // Use creator's company ID if not provided, or validate provided companyId
    const companyId = data.companyId || creatorCompanyId

    // Verify company exists and creator has access
    const company = await prisma.companies.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      throw new NotFoundError('Company')
    }

    // If companyId was provided, ensure creator can access it
    if (data.companyId && data.companyId !== creatorCompanyId) {
      throw new ForbiddenError('Cannot create users for other companies')
    }

    // Create the user
    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: data.role || UserRole.FINANCE,
        company_id: companyId
      },
      include: {
        companies: true
      }
    })

    // Log the activity
    await this.logUserActivity(
      companyId,
      user.id,
      'USER_CREATED',
      `User created by admin: ${data.email}`
    )

    return this.formatUserResponse(user)
  }

  /**
   * Get all users with filtering, pagination, and search
   */
  async getUsers(
    query: UserQueryInput,
    requesterCompanyId: string,
    requesterRole: UserRole
  ): Promise<PaginatedUserResponse> {
    // Only ADMIN users can view user lists
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only administrators can view user lists')
    }

    const { page, limit, search, role, sortBy, sortOrder } = query

    // Build where clause
    const whereClause: any = {
      company_id: requesterCompanyId // Only show users from same company
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (role) {
      whereClause.role = role
    }

    // Get total count for pagination
    const total = await prisma.users.count({ where: whereClause })

    // Get users with pagination
    const users = await prisma.users.findMany({
      where: whereClause,
      include: {
        companies: true
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const totalPages = Math.ceil(total / limit)

    return {
      users: users.map(user => this.formatUserResponse(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(
    userId: string, 
    requesterCompanyId: string, 
    requesterRole: UserRole,
    requesterId: string
  ): Promise<UserResponse> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        companies: true
      }
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    // Users can view their own profile, or admins can view any user in their company
    const canView = userId === requesterId || 
                   (requesterRole === UserRole.ADMIN && user.companies_id === requesterCompanyId)

    if (!canView) {
      throw new ForbiddenError('Access denied to this user')
    }

    return this.formatUserResponse(user)
  }

  /**
   * Update a user
   */
  async updateUser(
    userId: string,
    data: UpdateUserInput,
    requesterCompanyId: string,
    requesterRole: UserRole,
    requesterId: string
  ): Promise<UserResponse> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { companies: true }
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    // Check permissions - users can edit their own profile (limited), admins can edit any user in their company
    const isSelfEdit = userId === requesterId
    const isAdminEdit = requesterRole === UserRole.ADMIN && user.companies_id === requesterCompanyId

    if (!isSelfEdit && !isAdminEdit) {
      throw new ForbiddenError('Access denied to edit this user')
    }

    // Restrict what users can edit about themselves
    if (isSelfEdit && !isAdminEdit) {
      if (data.role !== undefined) {
        throw new ForbiddenError('You cannot change your own role')
      }
    }

    // Check for email uniqueness if email is being updated
    if (data.email && data.email !== user.email) {
      const existingUser = await prisma.users.findUnique({
        where: { email: data.email }
      })

      if (existingUser) {
        throw new ValidationError('A user with this email already exists', 'email')
      }
    }

    // Update the user
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.role && { role: data.role })
      },
      include: {
        companies: true
      }
    })

    // Log the activity
    await this.logUserActivity(
      requesterCompanyId,
      requesterId,
      'USER_UPDATED',
      `User updated: ${updatedUser.email}`
    )

    return this.formatUserResponse(updatedUser)
  }

  /**
   * Delete a user
   */
  async deleteUser(
    userId: string,
    requesterCompanyId: string,
    requesterRole: UserRole,
    requesterId: string
  ): Promise<void> {
    // Only ADMIN users can delete users
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only administrators can delete users')
    }

    // Cannot delete yourself
    if (userId === requesterId) {
      throw new ValidationError('You cannot delete your own account', 'userId')
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new NotFoundError('User')
    }

    // Can only delete users from same company
    if (user.companies_id !== requesterCompanyId) {
      throw new ForbiddenError('Cannot delete users from other companies')
    }

    // Soft delete by updating the user record (you might want to implement this differently)
    // For now, we'll do a hard delete but in production you might want to soft delete
    await prisma.users.delete({
      where: { id: userId }
    })

    // Log the activity
    await this.logUserActivity(
      requesterCompanyId,
      requesterId,
      'USER_DELETED',
      `User deleted: ${user.email}`
    )
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    data: ChangePasswordInput,
    requesterId: string
  ): Promise<void> {
    // Users can only change their own password
    if (userId !== requesterId) {
      throw new ForbiddenError('You can only change your own password')
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user || !user.password) {
      throw new NotFoundError('User')
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(data.currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      throw new ValidationError('Current password is incorrect', 'currentPassword')
    }

    // Hash new password
    const hashedPassword = await hash(data.newPassword, 12)

    // Update password
    await prisma.users.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    // Log the activity
    await this.logUserActivity(
      user.companies_id,
      userId,
      'PASSWORD_CHANGED',
      'Password changed successfully'
    )
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(
    data: BulkDeleteUsersInput,
    requesterCompanyId: string,
    requesterRole: UserRole,
    requesterId: string
  ): Promise<{ deletedCount: number }> {
    // Only ADMIN users can bulk delete
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only administrators can bulk delete users')
    }

    // Cannot delete yourself
    if (data.userIds.includes(requesterId)) {
      throw new ValidationError('You cannot delete your own account', 'userIds')
    }

    // Get users to validate they exist and belong to the same company
    const users = await prisma.users.findMany({
      where: {
        id: { in: data.userIds },
        company_id: requesterCompanyId
      }
    })

    if (users.length !== data.userIds.length) {
      throw new ValidationError('Some users were not found or do not belong to your company')
    }

    // Delete users
    const result = await prisma.users.deleteMany({
      where: {
        id: { in: data.userIds },
        company_id: requesterCompanyId
      }
    })

    // Log the activity
    await this.logUserActivity(
      requesterCompanyId,
      requesterId,
      'BULK_USER_DELETED',
      `Bulk deleted ${result.count} users`
    )

    return { deletedCount: result.count }
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(
    data: BulkUpdateUsersInput,
    requesterCompanyId: string,
    requesterRole: UserRole,
    requesterId: string
  ): Promise<{ updatedCount: number }> {
    // Only ADMIN users can bulk update
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only administrators can bulk update users')
    }

    // Get users to validate they exist and belong to the same company
    const users = await prisma.users.findMany({
      where: {
        id: { in: data.userIds },
        company_id: requesterCompanyId
      }
    })

    if (users.length !== data.userIds.length) {
      throw new ValidationError('Some users were not found or do not belong to your company')
    }

    // Update users
    const result = await prisma.users.updateMany({
      where: {
        id: { in: data.userIds },
        company_id: requesterCompanyId
      },
      data: data.updates
    })

    // Log the activity
    await this.logUserActivity(
      requesterCompanyId,
      requesterId,
      'BULK_USER_UPDATED',
      `Bulk updated ${result.count} users`
    )

    return { updatedCount: result.count }
  }

  /**
   * Get user statistics for dashboard
   */
  async getUserStats(requesterCompanyId: string, requesterRole: UserRole) {
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only administrators can view user statistics')
    }

    const [totalUsers, roleStats] = await Promise.all([
      prisma.users.count({
        where: { company_id: requesterCompanyId }
      }),
      prisma.users.groupBy({
        by: ['role'],
        where: { company_id: requesterCompanyId },
        _count: { role: true }
      })
    ])

    const roleDistribution = roleStats.reduce((acc, stat) => {
      acc[stat.role] = stat._count.role
      return acc
    }, {} as Record<UserRole, number>)

    return {
      totalUsers,
      roleDistribution
    }
  }

  /**
   * Private helper methods
   */
  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companies_id,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      company: user.companies ? {
        id: user.companies.id,
        name: user.companies.name,
        trn: user.companies.trn
      } : undefined
    }
  }

  private async logUserActivity(
    companyId: string,
    userId: string,
    type: string,
    description: string
  ): Promise<void> {
    try {
      await prisma.activities.create({
        data: {
          id: crypto.randomUUID(),
          company_id: companyId,
          user_id: userId,
          type,
          description,
          metadata: {}
        }
      })
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to log user activity:', error)
    }
  }
}

// Singleton instance
export const userService = new UserService()