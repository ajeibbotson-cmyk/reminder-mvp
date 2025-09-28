'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface UseAuthGuardOptions {
  redirectTo?: string
  requireCompany?: boolean
}

export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const {
    redirectTo = '/en/auth/signin',
    requireCompany = true
  } = options

  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Don't redirect while loading
    if (status === 'loading') return

    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push(redirectTo)
      return
    }

    // Check company association if required
    if (requireCompany && session && !session.user?.companyId) {
      router.push('/en/auth/signin?error=company_required')
      return
    }

    // Auto-refresh session before expiry (5 minutes before)
    if (session?.expires) {
      const expiryTime = new Date(session.expires).getTime()
      const currentTime = Date.now()
      const timeToExpiry = expiryTime - currentTime

      // If session expires in less than 5 minutes, refresh
      if (timeToExpiry < 5 * 60 * 1000 && timeToExpiry > 0) {
        // This will trigger a silent refresh
        window.location.reload()
      }
    }
  }, [session, status, router, redirectTo, requireCompany])

  return {
    session,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user: session?.user,
    companyId: session?.user?.companyId
  }
}