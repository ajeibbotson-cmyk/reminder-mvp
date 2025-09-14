import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { UserService } from '../user-service'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    users: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn()
    },
    companies: {
      findUnique: jest.fn()
    },
    activities: {
      create: jest.fn()
    }
  }
}))

jest.mock('bcryptjs')

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockHash = hash as jest.MockedFunction<typeof hash>

describe('UserService', () => {
  let userService: UserService

  beforeEach(() => {
    jest.clearAllMocks()
    userService = new UserService()
  })

  const mockCompany = {
    id: 'company-1',
    name: 'Test Company',
    trn: 'TRN123456789'
  }

  const mockUser = {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Test User',
    password: 'hashedpassword',
    role: UserRole.FINANCE,
    company_id: 'company-1',
    created_at: new Date(),
    updated_at: new Date(),
    companies: mockCompany
  }

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null) // No existing user
      mockPrisma.companies.findUnique.mockResolvedValue(mockCompany)
      mockHash.mockResolvedValue('hashedpassword')
      mockPrisma.users.create.mockResolvedValue(mockUser)
      mockPrisma.activities.create.mockResolvedValue({} as any)

      const userData = {
        email: 'user@test.com',
        name: 'Test User',
        password: 'StrongPassword123',
        role: UserRole.FINANCE
      }

      const result = await userService.createUser(
        userData,
        'company-1',
        UserRole.ADMIN
      )

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@test.com',
        name: 'Test User',
        role: UserRole.FINANCE,
        companyId: 'company-1',
        createdAt: mockUser.created_at,
        updatedAt: mockUser.updated_at,
        company: mockCompany
      })

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@test.com' }
      })
      expect(mockHash).toHaveBeenCalledWith('StrongPassword123', 12)
      expect(mockPrisma.users.create).toHaveBeenCalled()
    })

    it('should throw error if user already exists', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)

      const userData = {
        email: 'user@test.com',
        name: 'Test User',
        password: 'StrongPassword123',
        role: UserRole.FINANCE
      }

      await expect(
        userService.createUser(userData, 'company-1', UserRole.ADMIN)
      ).rejects.toThrow(ValidationError)
    })

    it('should throw error if non-admin tries to create user', async () => {
      const userData = {
        email: 'user@test.com',
        name: 'Test User',
        password: 'StrongPassword123',
        role: UserRole.FINANCE
      }

      await expect(
        userService.createUser(userData, 'company-1', UserRole.FINANCE)
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [mockUser]
      mockPrisma.users.count.mockResolvedValue(1)
      mockPrisma.users.findMany.mockResolvedValue(mockUsers)

      const query = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const
      }

      const result = await userService.getUsers(
        query,
        'company-1',
        UserRole.ADMIN
      )

      expect(result.users).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)

      expect(mockPrisma.users.findMany).toHaveBeenCalledWith({
        where: { company_id: 'company-1' },
        include: { companies: true },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      })
    })

    it('should filter users by search term', async () => {
      mockPrisma.users.count.mockResolvedValue(0)
      mockPrisma.users.findMany.mockResolvedValue([])

      const query = {
        page: 1,
        limit: 10,
        search: 'john',
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const
      }

      await userService.getUsers(query, 'company-1', UserRole.ADMIN)

      expect(mockPrisma.users.count).toHaveBeenCalledWith({
        where: {
          company_id: 'company-1',
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } }
          ]
        }
      })
    })

    it('should throw error if non-admin tries to get users', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const
      }

      await expect(
        userService.getUsers(query, 'company-1', UserRole.FINANCE)
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('getUserById', () => {
    it('should return user when requesting own profile', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)

      const result = await userService.getUserById(
        'user-1',
        'company-1',
        UserRole.FINANCE,
        'user-1' // Same as userId (self)
      )

      expect(result.id).toBe('user-1')
      expect(result.email).toBe('user@test.com')
    })

    it('should return user when admin requests user in same company', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)

      const result = await userService.getUserById(
        'user-1',
        'company-1',
        UserRole.ADMIN,
        'admin-user-id'
      )

      expect(result.id).toBe('user-1')
    })

    it('should throw error when user not found', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null)

      await expect(
        userService.getUserById('nonexistent', 'company-1', UserRole.ADMIN, 'admin-user-id')
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw error when non-admin tries to access other user', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)

      await expect(
        userService.getUserById('user-1', 'company-1', UserRole.FINANCE, 'other-user-id')
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' }
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.users.update.mockResolvedValue(updatedUser)
      mockPrisma.activities.create.mockResolvedValue({} as any)

      const updateData = { name: 'Updated Name' }

      const result = await userService.updateUser(
        'user-1',
        updateData,
        'company-1',
        UserRole.ADMIN,
        'admin-user-id'
      )

      expect(result.name).toBe('Updated Name')
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name' },
        include: { companies: true }
      })
    })

    it('should prevent non-admin from changing role', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)

      const updateData = { role: UserRole.ADMIN }

      await expect(
        userService.updateUser('user-1', updateData, 'company-1', UserRole.FINANCE, 'user-1')
      ).rejects.toThrow(ForbiddenError)
    })

    it('should validate email uniqueness', async () => {
      const existingUser = { ...mockUser, id: 'other-user-id' }
      mockPrisma.users.findUnique
        .mockResolvedValueOnce(mockUser) // First call for target user
        .mockResolvedValueOnce(existingUser) // Second call for email check

      const updateData = { email: 'existing@test.com' }

      await expect(
        userService.updateUser('user-1', updateData, 'company-1', UserRole.ADMIN, 'admin-user-id')
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.users.delete.mockResolvedValue(mockUser)
      mockPrisma.activities.create.mockResolvedValue({} as any)

      await userService.deleteUser('user-1', 'company-1', UserRole.ADMIN, 'admin-user-id')

      expect(mockPrisma.users.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' }
      })
    })

    it('should prevent non-admin from deleting users', async () => {
      await expect(
        userService.deleteUser('user-1', 'company-1', UserRole.FINANCE, 'user-1')
      ).rejects.toThrow(ForbiddenError)
    })

    it('should prevent admin from deleting themselves', async () => {
      await expect(
        userService.deleteUser('admin-user-id', 'company-1', UserRole.ADMIN, 'admin-user-id')
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const bcrypt = require('bcryptjs')
      bcrypt.compare = jest.fn().mockResolvedValue(true)
      bcrypt.hash = jest.fn().mockResolvedValue('newhasheedpassword')

      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.users.update.mockResolvedValue(mockUser)
      mockPrisma.activities.create.mockResolvedValue({} as any)

      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'NewStrongPassword123',
        confirmPassword: 'NewStrongPassword123'
      }

      await userService.changePassword('user-1', passwordData, 'user-1')

      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'newhasheedpassword' }
      })
    })

    it('should prevent changing other users password', async () => {
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'NewStrongPassword123',
        confirmPassword: 'NewStrongPassword123'
      }

      await expect(
        userService.changePassword('user-1', passwordData, 'other-user-id')
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      mockPrisma.users.count.mockResolvedValue(5)
      mockPrisma.users.groupBy.mockResolvedValue([
        { role: UserRole.ADMIN, _count: { role: 1 } },
        { role: UserRole.FINANCE, _count: { role: 3 } },
        { role: UserRole.VIEWER, _count: { role: 1 } }
      ])

      const result = await userService.getUserStats('company-1', UserRole.ADMIN)

      expect(result.totalUsers).toBe(5)
      expect(result.roleDistribution).toEqual({
        [UserRole.ADMIN]: 1,
        [UserRole.FINANCE]: 3,
        [UserRole.VIEWER]: 1
      })
    })

    it('should prevent non-admin from viewing stats', async () => {
      await expect(
        userService.getUserStats('company-1', UserRole.FINANCE)
      ).rejects.toThrow(ForbiddenError)
    })
  })
})