import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/errors'
import { UserRole } from '@prisma/client'

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string
    email: string
    name: string
    role: UserRole
    companyId: string
  }
  company: {
    id: string
    name: string
    trn?: string | null
  }
}

export interface MiddlewareOptions {
  roles?: UserRole[]
  requireCompanyAccess?: boolean
  allowSelfAccess?: boolean
  rateLimiting?: {
    windowMs: number
    maxRequests: number
  }
}

/**
 * Enhanced authentication middleware with advanced features
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      // 1. Authentication Check
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.email) {
        throw new UnauthorizedError('Authentication required')
      }

      // 2. Get user from database with fresh data
      const user = await prisma.users.findUnique({
        where: { email: session.user.email },
        include: {
          companies: true
        }
      })

      if (!user) {
        throw new NotFoundError('User')
      }

      // 3. Role-based authorization
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(user.role)) {
          throw new ForbiddenError(`Access denied. Required roles: ${options.roles.join(', ')}`)
        }
      }

      // 4. Company access validation
      if (options.requireCompanyAccess && context?.params?.companyId) {
        if (user.company_id !== context.params.companyId) {
          throw new ForbiddenError('Access denied to this company data')
        }
      }

      // 5. Self-access validation (for user-specific endpoints)
      if (options.allowSelfAccess && context?.params?.id) {
        const targetUserId = context.params.id
        const isSelfAccess = user.id === targetUserId
        const isAdminAccess = user.role === UserRole.ADMIN
        
        if (!isSelfAccess && !isAdminAccess) {
          throw new ForbiddenError('Access denied to this user data')
        }
      }

      // 6. Rate limiting (basic implementation)
      if (options.rateLimiting) {
        const rateLimit = await checkRateLimit(
          user.id, 
          options.rateLimiting.windowMs, 
          options.rateLimiting.maxRequests
        )
        
        if (!rateLimit.allowed) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Rate limit exceeded',
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfter: rateLimit.retryAfter 
            },
            { 
              status: 429,
              headers: {
                'Retry-After': rateLimit.retryAfter.toString(),
                'X-RateLimit-Limit': options.rateLimiting.maxRequests.toString(),
                'X-RateLimit-Remaining': Math.max(0, options.rateLimiting.maxRequests - rateLimit.currentCount).toString(),
                'X-RateLimit-Reset': new Date(Date.now() + options.rateLimiting.windowMs).toISOString()
              }
            }
          )
        }
      }

      // 7. Attach user and company data to request
      const authenticatedRequest = request as AuthenticatedRequest
      authenticatedRequest.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.company_id
      }
      authenticatedRequest.company = {
        id: user.companies.id,
        name: user.companies.name,
        trn: user.companies.trn
      }

      // 8. Log API access for security monitoring
      await logApiAccess(user.id, user.company_id, request.method, request.nextUrl.pathname)

      // 9. Call the actual handler
      return await handler(authenticatedRequest, context)

    } catch (error) {
      // Log security events
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        await logSecurityEvent(
          request.nextUrl.pathname,
          request.method,
          error.message,
          session?.user?.email
        )
      }

      // Re-throw for global error handler
      throw error
    }
  }
}

/**
 * Specialized middleware for admin-only endpoints
 */
export function withAdminAuth(
  handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
  return withAuth(handler, { 
    roles: [UserRole.ADMIN],
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100 // 100 requests per window
    }
  })
}

/**
 * Specialized middleware for user self-access or admin access
 */
export function withSelfOrAdminAuth(
  handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
  return withAuth(handler, { 
    allowSelfAccess: true,
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 200 // 200 requests per window
    }
  })
}

/**
 * Basic rate limiting implementation
 * In production, use Redis or external rate limiting service
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>()

async function checkRateLimit(
  userId: string, 
  windowMs: number, 
  maxRequests: number
): Promise<{ allowed: boolean; currentCount: number; retryAfter: number }> {
  const now = Date.now()
  const key = `rate_limit:${userId}`
  
  let userLimit = requestCounts.get(key)
  
  if (!userLimit || now > userLimit.resetTime) {
    userLimit = {
      count: 0,
      resetTime: now + windowMs
    }
  }
  
  userLimit.count++
  requestCounts.set(key, userLimit)
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of requestCounts.entries()) {
      if (now > v.resetTime) {
        requestCounts.delete(k)
      }
    }
  }
  
  const allowed = userLimit.count <= maxRequests
  const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000)
  
  return {
    allowed,
    currentCount: userLimit.count,
    retryAfter: allowed ? 0 : retryAfter
  }
}

/**
 * Log API access for monitoring and security
 */
async function logApiAccess(
  userId: string,
  companyId: string,
  method: string,
  path: string
): Promise<void> {
  try {
    // In production, you might want to use a separate logging system
    // or queue this to avoid blocking the request
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        company_id: companyId,
        user_id: userId,
        type: 'API_ACCESS',
        description: `${method} ${path}`,
        metadata: {
          method,
          path,
          timestamp: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log API access:', error)
  }
}

/**
 * Log security events for monitoring
 */
async function logSecurityEvent(
  path: string,
  method: string,
  errorMessage: string,
  userEmail?: string
): Promise<void> {
  try {
    console.warn('Security Event:', {
      timestamp: new Date().toISOString(),
      path,
      method,
      error: errorMessage,
      userEmail,
      type: 'AUTHENTICATION_FAILURE'
    })
    
    // In production, you might want to:
    // 1. Send alerts for suspicious patterns
    // 2. Store in a security event database
    // 3. Integrate with security monitoring tools
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

/**
 * Helper to validate resource ownership
 */
export async function validateResourceOwnership(
  userId: string,
  companyId: string,
  resourceCompanyId: string,
  role: UserRole
): Promise<boolean> {
  // Admin users can access any resource in their company
  if (role === UserRole.ADMIN && companyId === resourceCompanyId) {
    return true
  }
  
  // Non-admin users can only access resources in their company
  // and might have additional restrictions based on business logic
  return companyId === resourceCompanyId
}

/**
 * Helper to check if user can perform action on target user
 */
export async function canAccessUser(
  requesterId: string,
  requesterRole: UserRole,
  requesterCompanyId: string,
  targetUserId: string
): Promise<boolean> {
  // Users can always access their own data
  if (requesterId === targetUserId) {
    return true
  }
  
  // Admins can access other users in their company
  if (requesterRole === UserRole.ADMIN) {
    const targetUser = await prisma.users.findUnique({
      where: { id: targetUserId }
    })
    
    return targetUser?.company_id === requesterCompanyId
  }
  
  return false
}