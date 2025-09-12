import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/errors'
import { UserRole } from '@prisma/client'

export interface AuthContext {
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

export async function getAuthContext(_request: NextRequest): Promise<AuthContext> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    throw new UnauthorizedError('Authentication required')
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      company: true
    }
  })

  if (!user) {
    throw new NotFoundError('User')
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId
    },
    company: {
      id: user.company.id,
      name: user.company.name,
      trn: user.company.trn
    }
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  return getAuthContext(request)
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthContext> {
  const authContext = await getAuthContext(request)
  
  if (!allowedRoles.includes(authContext.user.role)) {
    throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(', ')}`)
  }
  
  return authContext
}

export async function requireCompanyAccess(
  request: NextRequest,
  companyId: string
): Promise<AuthContext> {
  const authContext = await getAuthContext(request)
  
  if (authContext.user.companyId !== companyId) {
    throw new ForbiddenError('Access denied to this company data')
  }
  
  return authContext
}

export async function requireResourceAccess(
  request: NextRequest,
  resourceCompanyId: string
): Promise<AuthContext> {
  const authContext = await getAuthContext(request)
  
  if (authContext.user.companyId !== resourceCompanyId) {
    throw new ForbiddenError('Access denied to this resource')
  }
  
  return authContext
}

// Role-based access control helpers
export function canManageUsers(role: UserRole): boolean {
  return role === UserRole.ADMIN
}

export function canManageInvoices(role: UserRole): boolean {
  return [UserRole.ADMIN, UserRole.FINANCE].includes(role)
}

export function canViewReports(role: UserRole): boolean {
  return [UserRole.ADMIN, UserRole.FINANCE, UserRole.VIEWER].includes(role)
}

export function canManageSettings(role: UserRole): boolean {
  return role === UserRole.ADMIN
}