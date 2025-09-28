'use client'

import { useAuthGuard } from '@/lib/hooks/use-auth-guard'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  requireCompany?: boolean
}

export function ProtectedRoute({
  children,
  fallback,
  requireCompany = true
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuthGuard({ requireCompany })

  // Show loading state while checking authentication
  if (isLoading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, the useAuthGuard hook will handle redirects
  if (!isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  // Render protected content
  return <>{children}</>
}