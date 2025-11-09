import { createMocks } from 'node-mocks-http'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}))

// Mock prisma transactions
const mockTransaction = jest.fn()

describe('/api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Setup default mock implementations
    mockTransaction.mockResolvedValue([
      { id: 'company-id', name: 'Test Company' }, // company creation result
      { id: 'user-id', email: 'test@example.com', name: 'Test User' } // user creation result
    ])
    
    ;(prisma.$transaction as jest.Mock) = mockTransaction
    ;(prisma.user.findUnique as jest.Mock) = jest.fn()
    ;(bcrypt.hash as jest.Mock) = jest.fn().mockResolvedValue('hashedpassword')
  })

  describe('POST /api/auth/signup', () => {
    it('should create a new user and company successfully', async () => {
      // Arrange
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null) // User doesn't exist

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          company: 'Test Company'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.message).toBe('User created successfully')
      expect(data.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User'
      })

      // Verify password was hashed
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
      
      // Verify user existence check
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      })
      
      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should return 400 if user already exists', async () => {
      // Arrange
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          company: 'Test Company'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('User already exists')
      
      // Verify transaction was not called
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should return 400 for missing required fields', async () => {
      // Arrange
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          // Missing password, name, and company
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('All fields are required')
    })

    it('should return 400 for invalid email format', async () => {
      // Arrange
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
          company: 'Test Company'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid email format')
    })

    it('should return 400 for weak password', async () => {
      // Arrange
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: '123', // Too short
          name: 'Test User',
          company: 'Test Company'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Password must be at least 8 characters long')
    })

    it('should return 500 for database transaction failure', async () => {
      // Arrange
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'))

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          company: 'Test Company'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should return 500 for bcrypt hashing failure', async () => {
      // Arrange
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'))

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          company: 'Test Company'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle special characters in company name', async () => {
      // Arrange
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          company: 'Test & Co. Ltd. - UAE Branch (Dubai)'
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data.message).toBe('User created successfully')
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should trim whitespace from inputs', async () => {
      // Arrange
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: {
          email: '  test@example.com  ',
          password: 'password123',
          name: '  Test User  ',
          company: '  Test Company  '
        },
      })

      // Act
      const response = await POST(req as any)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' } // Should be trimmed
      })
    })
  })
})