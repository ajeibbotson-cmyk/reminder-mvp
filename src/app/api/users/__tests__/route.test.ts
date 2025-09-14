import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import { NextRequest } from 'next/server'
import { GET, POST, DELETE, PATCH } from '../route'
import { userService } from '@/lib/services/user-service'
import { requireRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/services/user-service')
jest.mock('@/lib/auth-utils')

const mockUserService = userService as jest.Mocked<typeof userService>
const mockRequireRole = requireRole as jest.MockedFunction<typeof requireRole>

const mockAuthContext = {
  user: {
    id: 'admin-user-id',
    email: 'admin@test.com',
    name: 'Admin User',
    role: UserRole.ADMIN,
    companyId: 'company-1'
  },
  company: {
    id: 'company-1',
    name: 'Test Company',
    trn: 'TRN123456789'
  }
}

describe('/api/users', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRole.mockResolvedValue(mockAuthContext)
  })

  describe('GET /api/users', () => {
    it('should return paginated users successfully', async () => {
      const mockResponse = {
        users: [
          {
            id: 'user-1',
            email: 'user1@test.com',
            name: 'User One',
            role: UserRole.FINANCE,
            companyId: 'company-1',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }

      mockUserService.getUsers.mockResolvedValue(mockResponse)

      const url = new URL('http://localhost:3000/api/users?page=1&limit=10')
      const request = new NextRequest(url)
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResponse)
      expect(mockUserService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10
        }),
        'company-1',
        UserRole.ADMIN
      )
    })

    it('should handle search and filtering', async () => {
      const mockResponse = {
        users: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      }

      mockUserService.getUsers.mockResolvedValue(mockResponse)

      const url = new URL('http://localhost:3000/api/users?search=john&role=FINANCE&sortBy=name&sortOrder=asc')
      const request = new NextRequest(url)
      
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockUserService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'john',
          role: UserRole.FINANCE,
          sortBy: 'name',
          sortOrder: 'asc'
        }),
        'company-1',
        UserRole.ADMIN
      )
    })

    it('should require admin role', async () => {
      mockRequireRole.mockRejectedValue(new Error('Access denied'))

      const request = new NextRequest('http://localhost:3000/api/users')
      const response = await GET(request)

      expect(mockRequireRole).toHaveBeenCalledWith(request, [UserRole.ADMIN])
    })
  })

  describe('POST /api/users', () => {
    it('should create user successfully', async () => {
      const mockUser = {
        id: 'new-user-id',
        email: 'newuser@test.com',
        name: 'New User',
        role: UserRole.FINANCE,
        companyId: 'company-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserService.createUser.mockResolvedValue(mockUser)

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'newuser@test.com',
          name: 'New User',
          password: 'StrongPassword123',
          role: 'FINANCE'
        }
      })

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newuser@test.com',
          name: 'New User',
          password: 'StrongPassword123',
          role: 'FINANCE'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockUser)
      expect(mockUserService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@test.com',
          name: 'New User',
          password: 'StrongPassword123',
          role: 'FINANCE'
        }),
        'company-1',
        UserRole.ADMIN
      )
    })

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          name: '',
          password: '123' // too short
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('DELETE /api/users', () => {
    it('should bulk delete users successfully', async () => {
      const mockResult = { deletedCount: 2 }
      mockUserService.bulkDeleteUsers.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'DELETE',
        body: JSON.stringify({
          userIds: ['user-1', 'user-2']
        })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(mockUserService.bulkDeleteUsers).toHaveBeenCalledWith(
        { userIds: ['user-1', 'user-2'] },
        'company-1',
        UserRole.ADMIN,
        'admin-user-id'
      )
    })
  })

  describe('PATCH /api/users', () => {
    it('should bulk update users successfully', async () => {
      const mockResult = { updatedCount: 2 }
      mockUserService.bulkUpdateUsers.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'PATCH',
        body: JSON.stringify({
          userIds: ['user-1', 'user-2'],
          updates: { role: 'VIEWER' }
        })
      })

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(mockUserService.bulkUpdateUsers).toHaveBeenCalledWith(
        { 
          userIds: ['user-1', 'user-2'],
          updates: { role: 'VIEWER' }
        },
        'company-1',
        UserRole.ADMIN,
        'admin-user-id'
      )
    })
  })
})